import type { Job, Prisma } from "@prisma/client";

import { AppError } from "../middleware/error.middleware";
import type { AuthUser } from "./auth.service";
import { isFounderRole } from "./auth.service";
import { appStateStoreService } from "./app-state-store.service";
import { authorizationService, type AuthorizationContext } from "./authorization.service";
import { candidateStoreService } from "./candidate-store.service";
import {
  assertJobStatusTransition,
  buildDemandInsights,
  candidateMatchesSkills,
  classifyTechnologyFamily,
  normalizeJobInput,
  normalizeJobStatus,
  type JobStatus
} from "./job-domain";
import { prisma } from "./prisma.service";

type JobRecord = Record<string, unknown>;

const STATUS_REASON_REQUIRED = new Set<JobStatus>(["PAUSED", "ON_HOLD", "CLOSED", "CANCELLED", "ARCHIVED"]);

class JobService {
  private legacyImportInFlight: Promise<void> | null = null;

  async listForContext(context: AuthorizationContext): Promise<JobRecord[]> {
    await this.ensureLegacyJobsImported();
    const jobs = await prisma.job.findMany({ orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }] });
    return jobs.map(serializeJob).filter((job) => authorizationService.canViewJob(context, job));
  }

  async listAllForBootstrap(): Promise<JobRecord[]> {
    await this.ensureLegacyJobsImported();
    const jobs = await prisma.job.findMany({ orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }] });
    return jobs.map(serializeJob);
  }

  async getForContext(context: AuthorizationContext, jobId: string): Promise<{ job: JobRecord; audit: JobRecord[] }> {
    const job = await this.requireJob(jobId);
    const serialized = serializeJob(job);
    if (!authorizationService.canViewJob(context, serialized)) {
      await authorizationService.logUnauthorizedAccess({
        userId: context.user.id,
        endpoint: `/api/jobs/${jobId}`,
        entityType: "job",
        entityId: jobId
      });
      throw new AppError("Job not found", 404);
    }
    const audit = await prisma.jobAudit.findMany({ where: { jobId }, orderBy: { createdAt: "desc" }, take: 100 });
    return { job: serialized, audit: audit.map(serializeAudit) };
  }

  async create(context: AuthorizationContext, input: JobRecord): Promise<JobRecord> {
    this.assertWritable(context.user);
    await this.ensureLegacyJobsImported();

    const defaultOwnerUserId = context.user.id;
    const normalized = normalizeJobInput(input, { defaultOwnerUserId });
    await this.ensureClientReference(normalized.clientId);
    const assignedRecruiterId = normalized.assignedRecruiterId || defaultOwnerUserId;
    this.assertCanAssign(context, assignedRecruiterId);
    const now = new Date();

    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          ...toPrismaJobData(normalized),
          referenceNo: createReferenceNumber(),
          assignedRecruiterId,
          createdByUserId: context.user.id,
          updatedByUserId: context.user.id,
          openedAt: normalized.status === "ACTIVE" ? now : null
        }
      });
      await tx.jobAudit.create({
        data: auditData(created, context.user, "CREATED", null, created.status, null, {
          title: created.title,
          referenceNo: created.referenceNo
        })
      });
      return created;
    });

    await this.mirrorJobs();
    return serializeJob(job);
  }

  async update(context: AuthorizationContext, jobId: string, input: JobRecord): Promise<JobRecord> {
    this.assertWritable(context.user);
    const existing = await this.requireEditableJob(context, jobId);
    const existingRecord = serializeJob(existing);
    const requestedStatus = input.status === undefined ? existing.status : input.status;
    const nextStatus = normalizeJobStatus(requestedStatus);
    if (nextStatus !== normalizeJobStatus(existing.status)) {
      throw new AppError("Use the job status endpoint to change status", 409);
    }

    const normalized = normalizeJobInput({ ...existingRecord, ...input, status: existing.status }, {
      existingStatus: existing.status,
      defaultOwnerUserId: existing.ownerUserId || context.user.id
    });
    await this.ensureClientReference(normalized.clientId);
    const assignedRecruiterId = normalized.assignedRecruiterId || existing.assignedRecruiterId || context.user.id;
    this.assertCanAssign(context, assignedRecruiterId);
    const data = { ...toPrismaJobData(normalized), assignedRecruiterId, updatedByUserId: context.user.id };
    const changes = diffRecord(existingRecord, { ...existingRecord, ...serializeWriteData(data) });

    const job = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({ where: { id: jobId }, data });
      await tx.jobAudit.create({ data: auditData(updated, context.user, "UPDATED", existing.status, updated.status, null, changes) });
      return updated;
    });

    await this.mirrorJobs();
    return serializeJob(job);
  }

  async changeStatus(context: AuthorizationContext, jobId: string, statusInput: unknown, reasonInput: unknown): Promise<JobRecord> {
    this.assertWritable(context.user);
    const existing = await this.requireEditableJob(context, jobId);
    const nextStatus = assertJobStatusTransition(existing.status, statusInput);
    const reason = String(reasonInput || "").trim().slice(0, 500) || null;
    if (STATUS_REASON_REQUIRED.has(nextStatus) && !reason) {
      throw new AppError(`A reason is required when changing a job to ${nextStatus.replace(/_/g, " ").toLowerCase()}`, 400);
    }
    const now = new Date();
    const isClosed = nextStatus === "CLOSED" || nextStatus === "FILLED" || nextStatus === "CANCELLED";

    const job = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({
        where: { id: jobId },
        data: {
          status: nextStatus,
          statusReason: reason,
          updatedByUserId: context.user.id,
          openedAt: nextStatus === "ACTIVE" ? existing.openedAt || now : existing.openedAt,
          closedAt: isClosed ? now : nextStatus === "ACTIVE" ? null : existing.closedAt,
          archivedAt: nextStatus === "ARCHIVED" ? now : nextStatus === "ACTIVE" || nextStatus === "DRAFT" ? null : existing.archivedAt
        }
      });
      await tx.jobAudit.create({
        data: auditData(updated, context.user, nextStatus === "ARCHIVED" ? "ARCHIVED" : "STATUS_CHANGED", existing.status, nextStatus, reason, {
          status: { from: existing.status, to: nextStatus }
        })
      });
      return updated;
    });

    await this.mirrorJobs();
    return serializeJob(job);
  }

  async duplicate(context: AuthorizationContext, jobId: string): Promise<JobRecord> {
    const existing = await this.requireViewableJob(context, jobId);
    return this.create(context, {
      ...serializeJob(existing),
      id: undefined,
      referenceNo: undefined,
      title: `${existing.title} (Copy)`,
      status: "DRAFT"
    });
  }

  async permanentlyDelete(context: AuthorizationContext, jobId: string, confirmationInput: unknown): Promise<void> {
    if (!isFounderRole(context.user.role)) throw new AppError("Founder access is required for permanent job deletion", 403);
    const existing = await this.requireJob(jobId);
    const confirmation = String(confirmationInput || "").trim();
    if (confirmation !== existing.title) throw new AppError("Type the exact job title to confirm permanent deletion", 400);

    const [candidateRows, stateReferences] = await Promise.all([
      candidateStoreService.getAllCandidates(),
      appStateStoreService.getJobReferences(jobId)
    ]);
    const candidateCount = candidateRows.filter((candidate) => String(candidate.jobId || "") === jobId).length;
    const databaseCandidateCount = await prisma.candidate.count({ where: { jobId } });
    const linkedCount = candidateCount + databaseCandidateCount + stateReferences.interviews + stateReferences.submissions;
    if (linkedCount > 0) {
      throw new AppError(
        `Permanent deletion is blocked: ${candidateCount + databaseCandidateCount} candidate(s), ${stateReferences.submissions} submission(s), and ${stateReferences.interviews} interview(s) still reference this job. Archive it instead.`,
        409
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.jobAudit.create({
        data: auditData(existing, context.user, "PERMANENTLY_DELETED", existing.status, null, "Confirmed by exact title", {
          referenceNo: existing.referenceNo,
          title: existing.title
        })
      });
      await tx.job.delete({ where: { id: jobId } });
    });
    await this.mirrorJobs();
  }

  async insights(context: AuthorizationContext): Promise<JobRecord[]> {
    const [jobs, candidates] = await Promise.all([
      this.listForContext(context),
      candidateStoreService.getActiveCandidatesForContext(context)
    ]);
    return buildDemandInsights(jobs, candidates as unknown as JobRecord[]);
  }

  async createPoolFromJob(context: AuthorizationContext, jobId: string): Promise<JobRecord> {
    this.assertWritable(context.user);
    const job = await this.requireViewableJob(context, jobId);
    const record = serializeJob(job);
    const family = classifyTechnologyFamily(record);
    return this.createPool(context, {
      name: `${family.label} candidate pool`,
      techStack: family.label,
      sourceJobId: job.id,
      skills: record.requiredSkills,
      minExperience: record.expMin,
      maxExperience: record.expMax,
      locations: record.locations,
      sourceInsight: { source: "job", jobId: job.id, referenceNo: job.referenceNo }
    });
  }

  async createPoolFromInsight(context: AuthorizationContext, input: JobRecord): Promise<JobRecord> {
    this.assertWritable(context.user);
    const insights = await this.insights(context);
    const key = String(input.key || "").trim();
    const insight = insights.find((item) => String(item.key) === key);
    if (!insight) throw new AppError("Demand insight not found", 404);
    return this.createPool(context, {
      name: `${String(insight.label)} proactive pool`,
      techStack: String(insight.label),
      sourceJobId: String(insight.sourceJobId || "") || null,
      skills: insight.skills,
      locations: insight.commonLocations,
      sourceInsight: insight
    });
  }

  private async createPool(context: AuthorizationContext, input: JobRecord): Promise<JobRecord> {
    const skills = toStringArray(input.skills);
    const candidates = await candidateStoreService.getActiveCandidatesForContext(context);
    const minExperience = nullableFinite(input.minExperience);
    const maxExperience = nullableFinite(input.maxExperience);
    const matches = candidates.filter((candidate) => {
      if (!candidateMatchesSkills(candidate as unknown as JobRecord, skills)) return false;
      const experience = candidate.experienceYears;
      if (minExperience !== null && (experience === null || experience < minExperience)) return false;
      if (maxExperience !== null && (experience === null || experience > maxExperience)) return false;
      return true;
    });
    const criteria = {
      skills,
      minExperience,
      maxExperience,
      locations: toStringArray(input.locations)
    };

    const pool = await prisma.$transaction(async (tx) => {
      const created = await tx.candidatePool.create({
        data: {
          name: String(input.name || "Candidate pool").trim().slice(0, 140),
          techStack: String(input.techStack || "General").trim().slice(0, 100),
          sourceJobId: input.sourceJobId ? String(input.sourceJobId) : null,
          criteria: criteria as Prisma.InputJsonValue,
          sourceInsight: (input.sourceInsight || {}) as Prisma.InputJsonValue,
          createdByUserId: context.user.id
        }
      });
      if (matches.length) {
        await tx.candidatePoolMember.createMany({
          data: matches.map((candidate) => ({
            poolId: created.id,
            candidateId: candidate.id,
            matchReason: { matchedSkills: skills.filter((skill) => candidateMatchesSkills(candidate as unknown as JobRecord, [skill])) } as Prisma.InputJsonValue
          }))
        });
      }
      return created;
    });

    return {
      id: pool.id,
      name: pool.name,
      techStack: pool.techStack,
      memberCount: matches.length,
      candidateIds: matches.map((candidate) => candidate.id),
      criteria,
      createdAt: pool.createdAt.toISOString()
    };
  }

  private assertWritable(user: AuthUser): void {
    if (user.role === "Viewer") throw new AppError("This account has read-only ATS access", 403);
  }

  private assertCanAssign(context: AuthorizationContext, assignedRecruiterId: string): void {
    if (!authorizationService.canAssignCandidateOwner(context, assignedRecruiterId)) {
      throw new AppError("You cannot assign this job outside your visible recruiting team", 403);
    }
  }

  private async requireJob(jobId: string): Promise<Job> {
    await this.ensureLegacyJobsImported();
    const job = await prisma.job.findUnique({ where: { id: String(jobId || "").trim() } });
    if (!job) throw new AppError("Job not found", 404);
    return job;
  }

  private async requireViewableJob(context: AuthorizationContext, jobId: string): Promise<Job> {
    const job = await this.requireJob(jobId);
    if (!authorizationService.canViewJob(context, serializeJob(job))) throw new AppError("Job not found", 404);
    return job;
  }

  private async requireEditableJob(context: AuthorizationContext, jobId: string): Promise<Job> {
    const job = await this.requireJob(jobId);
    if (!authorizationService.canEditJob(context, serializeJob(job))) throw new AppError("You do not have permission to edit this job", 403);
    return job;
  }

  private async ensureLegacyJobsImported(): Promise<void> {
    if (!this.legacyImportInFlight) {
      this.legacyImportInFlight = this.importLegacyJobs().finally(() => {
        this.legacyImportInFlight = null;
      });
    }
    await this.legacyImportInFlight;
  }

  private async ensureClientReference(clientId: string | null): Promise<void> {
    if (!clientId) return;
    const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (existing) return;
    const clients = await appStateStoreService.getClients();
    const legacy = clients.find((client) => String(client.id || "").trim() === clientId);
    await prisma.client.create({
      data: {
        id: clientId,
        name: String(legacy?.name || `Legacy client ${clientId}`).trim().slice(0, 140),
        notes: "Created to preserve the ATS job-to-client reference."
      }
    });
  }

  private async importLegacyJobs(): Promise<void> {
    const [legacyJobs, legacyClients] = await Promise.all([
      appStateStoreService.getJobs(),
      appStateStoreService.getClients()
    ]);
    const clientIds = new Set(legacyJobs.map((job) => String(job.clientId || "").trim()).filter(Boolean));
    const importedClientIds = new Set<string>();
    for (const client of legacyClients) {
      const id = String(client.id || "").trim();
      if (!id) continue;
      importedClientIds.add(id);
      await prisma.client.upsert({
        where: { id },
        update: {},
        create: {
          id,
          name: String(client.name || "Legacy client").trim().slice(0, 140) || "Legacy client",
          contact: nullableString(client.contact || client.owner),
          email: nullableString(client.email),
          phone: nullableString(client.phone),
          location: nullableString(client.location),
          notes: "Imported from the legacy ATS state during the Jobs API migration."
        }
      });
    }

    for (const clientId of clientIds) {
      if (importedClientIds.has(clientId)) continue;
      await prisma.client.upsert({
        where: { id: clientId },
        update: {},
        create: {
          id: clientId,
          name: `Legacy client ${clientId}`.slice(0, 140),
          notes: "Placeholder created to preserve a legacy job-to-client reference."
        }
      });
    }

    if (!legacyJobs.length) return;

    const existingIds = new Set((await prisma.job.findMany({ select: { id: true } })).map((job) => job.id));
    for (const legacy of legacyJobs) {
      const id = String(legacy.id || "").trim();
      if (!id || existingIds.has(id)) continue;
      const normalized = normalizeJobInput({ ...legacy, status: normalizeJobStatus(legacy.status) }, {
        defaultOwnerUserId: nullableString(legacy.ownerUserId) || undefined,
        allowIncompleteActive: true
      });
      await prisma.$transaction(async (tx) => {
        const created = await tx.job.create({
          data: {
            id,
            ...toPrismaJobData(normalized),
            referenceNo: nullableString(legacy.referenceNo) || `LEGACY-${id}`.slice(0, 100),
            createdAt: safeDate(legacy.createdAt) || new Date(),
            updatedAt: safeDate(legacy.updatedAt) || safeDate(legacy.createdAt) || new Date(),
            openedAt: normalized.status === "ACTIVE" ? safeDate(legacy.createdAt) || new Date() : null,
            assignedRecruiterId: normalized.assignedRecruiterId || normalized.ownerUserId,
            legacyData: legacy as Prisma.InputJsonValue
          }
        });
        await tx.jobAudit.create({
          data: auditData(created, null, "LEGACY_IMPORTED", null, created.status, "Imported without changing the legacy record", {
            legacyId: id
          })
        });
      });
    }
  }

  private async mirrorJobs(): Promise<void> {
    const jobs = await prisma.job.findMany({ orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }] });
    await appStateStoreService.mirrorJobs(jobs.map(serializeJob));
  }
}

const toPrismaJobData = (job: ReturnType<typeof normalizeJobInput>): Prisma.JobUncheckedCreateInput => ({
  title: job.title,
  clientId: job.clientId,
  description: job.description,
  jdText: job.jdText,
  requiredSkills: job.requiredSkills as Prisma.InputJsonValue,
  preferredSkills: job.preferredSkills as Prisma.InputJsonValue,
  minExperience: job.minExperience,
  maxExperience: job.maxExperience,
  location: job.location,
  locations: job.locations as Prisma.InputJsonValue,
  workMode: job.workMode,
  remoteScope: job.remoteScope,
  country: job.country,
  state: job.state,
  city: job.city,
  primaryTimeZone: job.primaryTimeZone,
  supportedTimeZones: job.supportedTimeZones as Prisma.InputJsonValue,
  workingHours: job.workingHours,
  minTimeZoneOverlap: job.minTimeZoneOverlap,
  jobType: job.jobType,
  openings: job.openings,
  currency: job.currency,
  minCtcLpa: job.minCtcLpa,
  maxCtcLpa: job.maxCtcLpa,
  minBillingRate: job.minBillingRate,
  maxBillingRate: job.maxBillingRate,
  billingRateType: job.billingRateType,
  compensationUndisclosed: job.compensationUndisclosed,
  priority: job.priority,
  status: job.status,
  ownerUserId: job.ownerUserId,
  assignedRecruiterId: job.assignedRecruiterId,
  targetClosureAt: job.targetClosureAt
});

const serializeJob = (job: Job): JobRecord => ({
  id: job.id,
  referenceNo: job.referenceNo || "",
  title: job.title,
  clientId: job.clientId || "",
  description: job.description || "",
  jdText: job.jdText || job.description || "",
  requiredSkills: toStringArray(job.requiredSkills),
  preferredSkills: toStringArray(job.preferredSkills),
  minExperience: job.minExperience,
  maxExperience: job.maxExperience,
  expMin: job.minExperience ?? "",
  expMax: job.maxExperience ?? "",
  location: job.location || "",
  locations: toStringArray(job.locations),
  workMode: job.workMode || "Hybrid",
  remoteScope: job.remoteScope || "",
  country: job.country || "",
  state: job.state || "",
  city: job.city || "",
  primaryTimeZone: job.primaryTimeZone || "",
  supportedTimeZones: toStringArray(job.supportedTimeZones),
  workingHours: job.workingHours || "",
  minTimeZoneOverlap: job.minTimeZoneOverlap ?? "",
  jobType: job.jobType || "FTE",
  openings: job.openings,
  currency: job.currency,
  minCtcLpa: job.minCtcLpa,
  maxCtcLpa: job.maxCtcLpa,
  ctcMin: job.minCtcLpa ?? "",
  ctcMax: job.maxCtcLpa ?? "",
  minBillingRate: job.minBillingRate,
  maxBillingRate: job.maxBillingRate,
  rateMin: job.minBillingRate ?? "",
  rateMax: job.maxBillingRate ?? "",
  billingRateType: job.billingRateType || "Monthly",
  compensationUndisclosed: job.compensationUndisclosed,
  ctcNotDisclosed: job.compensationUndisclosed,
  priority: job.priority,
  status: job.status,
  statusReason: job.statusReason || "",
  ownerUserId: job.ownerUserId || "",
  assignedRecruiterId: job.assignedRecruiterId || "",
  openedAt: job.openedAt?.toISOString() || "",
  targetClosureAt: job.targetClosureAt?.toISOString() || "",
  closedAt: job.closedAt?.toISOString() || "",
  archivedAt: job.archivedAt?.toISOString() || "",
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString()
});

const serializeAudit = (audit: {
  id: string;
  jobId: string;
  jobTitle: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  changes: unknown;
  createdAt: Date;
}): JobRecord => ({ ...audit, createdAt: audit.createdAt.toISOString() });

const auditData = (
  job: Job,
  actor: AuthUser | null,
  action: string,
  fromStatus: string | null,
  toStatus: string | null,
  reason: string | null,
  changes: JobRecord
): Prisma.JobAuditUncheckedCreateInput => ({
  jobId: job.id,
  jobTitle: job.title,
  actorId: actor?.id || null,
  actorName: actor?.name || actor?.email || null,
  action,
  fromStatus,
  toStatus,
  reason,
  changes: changes as Prisma.InputJsonValue
});

const serializeWriteData = (data: Prisma.JobUncheckedUpdateInput): JobRecord => ({
  ...data,
  requiredSkills: data.requiredSkills,
  preferredSkills: data.preferredSkills,
  locations: data.locations,
  supportedTimeZones: data.supportedTimeZones
}) as JobRecord;

const diffRecord = (before: JobRecord, after: JobRecord): JobRecord => {
  const changes: JobRecord = {};
  Object.keys(after).forEach((key) => {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes[key] = { from: before[key] ?? null, to: after[key] ?? null };
  });
  return changes;
};

const createReferenceNumber = (): string => {
  const now = new Date();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `JOB-${now.getUTCFullYear()}-${now.getTime().toString(36).toUpperCase()}-${random}`;
};

const toStringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.map(String).map((item) => item.trim()).filter(Boolean)
  : typeof value === "string"
    ? value.split(/[,;|]/g).map((item) => item.trim()).filter(Boolean)
    : [];

const nullableString = (value: unknown): string | null => String(value ?? "").trim() || null;
const nullableFinite = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const safeDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const jobService = new JobService();
