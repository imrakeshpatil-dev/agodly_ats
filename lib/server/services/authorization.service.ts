import type { AuthUser } from "./auth.service";
import { isFounderRole } from "./auth.service";
import { appStateStoreService } from "./app-state-store.service";
import { runtimeStateService } from "./runtime-state.service";
import type { CandidateRecord } from "../types/candidate";
import type { AppStateSnapshot } from "../types/app-state";
import type { AppStateStorePayload } from "../types/app-state";
import { logger } from "../utils/logger";

export interface AuthorizationContext {
  user: AuthUser;
  visibleUserIds: Set<string>;
  visibleAliases: Set<string>;
  reportingManagerUserIds?: Set<string>;
  reportingManagerAliases?: Set<string>;
}

export interface AuthorizationAuditEvent {
  userId: string;
  endpoint: string;
  entityType: string;
  entityId: string;
  timestamp: string;
}

type AtsRecord = Record<string, unknown>;

class AuthorizationService {
  private readonly auditStateKey = "authorization-audit-v1";

  async createContext(user: AuthUser): Promise<AuthorizationContext> {
    const users = await appStateStoreService.getUsers();
    const ownAliases = new Set([normalize(user.id), normalize(user.name), normalize(user.email)].filter(Boolean));
    const visibleUserIds = new Set<string>([normalize(user.id)]);
    const visibleAliases = new Set<string>(ownAliases);
    const reportingManagerUserIds = new Set<string>();
    const reportingManagerAliases = new Set<string>();

    users
      .filter((record) => userMatchesAliases(record, ownAliases))
      .forEach((record) => {
        [record.managerId, record.manager, record.managerEmail]
          .map(normalize)
          .filter(Boolean)
          .forEach((reference) => reportingManagerAliases.add(reference));
      });

    users.forEach((record) => {
      if (!userMatchesAliases(record, reportingManagerAliases)) return;
      const id = normalize(record.id);
      if (id) reportingManagerUserIds.add(id);
      [record.name, record.email].map(normalize).filter(Boolean).forEach((alias) => reportingManagerAliases.add(alias));
    });

    if (isFounderRole(user.role)) {
      users.forEach((record) => addUserIdentity(record, visibleUserIds, visibleAliases));
      return { user, visibleUserIds, visibleAliases, reportingManagerUserIds, reportingManagerAliases };
    }

    if (user.role === "TA Manager") {
      users.forEach((record) => {
        const managerReferences = [record.managerId, record.manager, record.managerEmail].map(normalize).filter(Boolean);
        if (managerReferences.some((reference) => ownAliases.has(reference))) {
          addUserIdentity(record, visibleUserIds, visibleAliases);
        }
      });
    }

    return { user, visibleUserIds, visibleAliases, reportingManagerUserIds, reportingManagerAliases };
  }

  canViewCandidate(context: AuthorizationContext, candidate: CandidateRecord): boolean {
    if (isFounderRole(context.user.role)) return true;

    const ownerUserId = normalize(candidate.ownerUserId);
    const assignedRecruiterId = normalize(candidate.assignedRecruiterId);
    const uploadedByUserId = normalize(candidate.uploadedByUserId ?? candidate.parsedData?.uploadedByUserId);
    const legacyRecruiter = normalize(candidate.recruiter);

    if (assignedRecruiterId && context.visibleUserIds.has(assignedRecruiterId)) return true;
    if (ownerUserId && context.visibleUserIds.has(ownerUserId)) return true;
    if (ownerUserId) return false;
    if (uploadedByUserId) return context.visibleUserIds.has(uploadedByUserId);
    return Boolean(!assignedRecruiterId && legacyRecruiter && context.visibleAliases.has(legacyRecruiter));
  }

  canEditCandidate(context: AuthorizationContext, candidate: CandidateRecord): boolean {
    return context.user.role !== "Viewer" && this.canViewCandidate(context, candidate);
  }

  canAssignCandidateOwner(context: AuthorizationContext, targetUserId: string | null | undefined): boolean {
    if (isFounderRole(context.user.role)) return true;
    if (context.user.role !== "TA Manager") return normalize(targetUserId) === normalize(context.user.id);
    const target = normalize(targetUserId);
    return Boolean(target && context.visibleUserIds.has(target));
  }

  canViewSubmission(context: AuthorizationContext, submission: AtsRecord, candidates: CandidateRecord[]): boolean {
    return this.canViewCandidateReference(context, submission, candidates);
  }

  canEditSubmission(context: AuthorizationContext, submission: AtsRecord, candidates: CandidateRecord[]): boolean {
    return context.user.role !== "Viewer" && this.canViewSubmission(context, submission, candidates);
  }

  canViewInterview(context: AuthorizationContext, interview: AtsRecord, candidates: CandidateRecord[]): boolean {
    return this.canViewCandidateReference(context, interview, candidates);
  }

  canViewFollowUp(context: AuthorizationContext, followUp: AtsRecord, candidates: CandidateRecord[]): boolean {
    if (this.recordOwnedByVisibleUser(context, followUp)) return true;
    return this.canViewCandidateReference(context, followUp, candidates);
  }

  canViewJob(context: AuthorizationContext, job: AtsRecord): boolean {
    if (isFounderRole(context.user.role)) return true;
    if (normalize(job.visibilityScope) === "organization") return true;
    if (normalize(job.visibilityScope) === "direct_team" && this.isJobOwnedByReportingManager(context, job)) return true;
    const assignedIds = collectIdentityValues(job, ["ownerUserId", "assignedRecruiterId", "recruiterId", "assignedUserId"]);
    const assignedAliases = collectIdentityValues(job, ["owner", "recruiter", "assignedTo"]);
    if (!assignedIds.length && !assignedAliases.length) return true;
    return assignedIds.some((id) => context.visibleUserIds.has(id)) || assignedAliases.some((alias) => context.visibleAliases.has(alias));
  }

  canEditJob(context: AuthorizationContext, job: AtsRecord): boolean {
    if (isFounderRole(context.user.role)) return true;
    if (context.user.role === "Viewer") return false;
    const assignedIds = collectIdentityValues(job, ["ownerUserId", "assignedRecruiterId", "recruiterId", "assignedUserId"]);
    const assignedAliases = collectIdentityValues(job, ["owner", "recruiter", "assignedTo"]);
    return assignedIds.some((id) => context.visibleUserIds.has(id)) || assignedAliases.some((alias) => context.visibleAliases.has(alias));
  }

  canViewClient(context: AuthorizationContext, client: AtsRecord, visibleJobs: AtsRecord[]): boolean {
    if (isFounderRole(context.user.role) || context.user.role === "TA Manager") return true;
    return visibleJobs.some((job) => normalize(job.clientId) === normalize(client.id));
  }

  canViewRevenue(context: AuthorizationContext): boolean {
    return isFounderRole(context.user.role);
  }

  canViewPrivateNote(context: AuthorizationContext, note: AtsRecord): boolean {
    const visibility = normalize(note.visibility || "shared");
    if (visibility === "shared") return true;
    if (isFounderRole(context.user.role)) return true;
    return this.recordOwnedByVisibleUser(context, note);
  }

  canViewActivity(context: AuthorizationContext, activity: AtsRecord, candidates: CandidateRecord[]): boolean {
    if (isFounderRole(context.user.role)) return true;
    if (this.recordOwnedByVisibleUser(context, activity)) return true;
    return this.canViewCandidateReference(context, activity, candidates);
  }

  scopeCandidates(context: AuthorizationContext, candidates: CandidateRecord[]): CandidateRecord[] {
    return candidates.filter((candidate) => this.canViewCandidate(context, candidate));
  }

  scopeAppState(context: AuthorizationContext, snapshot: AppStateSnapshot): AppStateSnapshot {
    if (isFounderRole(context.user.role)) return snapshot;

    const candidates = this.scopeCandidates(context, snapshot.candidates);
    const jobs = snapshot.jobs.filter((job) => this.canViewJob(context, job));
    const clients = snapshot.clients.filter((client) => this.canViewClient(context, client, jobs));
    const interviews = snapshot.interviews.filter((interview) => this.canViewInterview(context, interview, candidates));
    const placements = snapshot.placements
      .filter((placement) => this.canViewSubmission(context, placement, candidates))
      .map((placement) => this.canViewRevenue(context)
        ? placement
        : omitFields(placement, ["revenue", "cost", "margin", "billingRate", "ctc"]));
    const activities = snapshot.activities.filter((activity) => this.canViewActivity(context, activity, candidates));
    const users = snapshot.users.filter((user) => {
      const id = normalize(user.id);
      return Boolean(id && context.visibleUserIds.has(id));
    });

    return {
      ...snapshot,
      bulkUpload: this.scopeBulkUpload(snapshot.bulkUpload, candidates),
      users,
      candidates,
      clients,
      jobs,
      interviews,
      placements,
      activities
    };
  }

  scopeSyncPayload(
    context: AuthorizationContext,
    payload: AppStateStorePayload,
    permittedCandidates: CandidateRecord[]
  ): AppStateStorePayload {
    if (isFounderRole(context.user.role)) return payload;

    return {
      clients: context.user.role === "TA Manager"
        ? payload.clients?.filter((client) => this.canViewClient(context, client, payload.jobs || []))
        : undefined,
      jobs: payload.jobs?.filter((job) => this.canEditJob(context, job)),
      interviews: payload.interviews?.filter((interview) => this.canViewInterview(context, interview, permittedCandidates)),
      placements: context.user.role === "TA Manager"
        ? payload.placements?.filter((placement) => this.canViewSubmission(context, placement, permittedCandidates))
        : undefined,
      activities: payload.activities?.filter((activity) => this.canViewActivity(context, activity, permittedCandidates))
    };
  }

  async logUnauthorizedAccess(event: Omit<AuthorizationAuditEvent, "timestamp">): Promise<void> {
    await this.logSecurityEvent(event);
  }

  async logSecurityEvent(event: Omit<AuthorizationAuditEvent, "timestamp">): Promise<void> {
    try {
      const existing = await runtimeStateService.get<AuthorizationAuditEvent[]>(this.auditStateKey);
      const events = Array.isArray(existing) ? existing.slice(-499) : [];
      events.push({ ...event, timestamp: new Date().toISOString() });
      await runtimeStateService.set(this.auditStateKey, events);
      logger.warn("Authorization denied", event);
    } catch (error) {
      logger.error("Failed to record authorization denial", {
        error: error instanceof Error ? error.message : String(error),
        ...event
      });
    }
  }

  private canViewCandidateReference(
    context: AuthorizationContext,
    record: AtsRecord,
    candidates: CandidateRecord[]
  ): boolean {
    if (isFounderRole(context.user.role)) return true;
    const candidateId = normalize(record.candidateId);
    const candidate = candidateId ? candidates.find((item) => normalize(item.id) === candidateId) : undefined;
    if (candidateId) return candidate ? this.canViewCandidate(context, candidate) : false;
    return this.recordOwnedByVisibleUser(context, record);
  }

  private recordOwnedByVisibleUser(context: AuthorizationContext, record: AtsRecord): boolean {
    if (isFounderRole(context.user.role)) return true;
    const ids = collectIdentityValues(record, ["ownerUserId", "assignedRecruiterId", "uploadedByUserId", "actorUserId"]);
    const aliases = collectIdentityValues(record, ["owner", "recruiter", "assignedTo", "actorName", "actorEmail"]);
    return ids.some((id) => context.visibleUserIds.has(id)) || aliases.some((alias) => context.visibleAliases.has(alias));
  }

  private isJobOwnedByReportingManager(context: AuthorizationContext, job: AtsRecord): boolean {
    const managerIds = context.reportingManagerUserIds || new Set<string>();
    const managerAliases = context.reportingManagerAliases || new Set<string>();
    const ownerIds = collectIdentityValues(job, ["ownerUserId", "createdByUserId"]);
    const ownerAliases = collectIdentityValues(job, ["owner", "createdBy", "createdByEmail"]);
    return ownerIds.some((id) => managerIds.has(id)) || ownerAliases.some((alias) => managerAliases.has(alias));
  }

  private scopeBulkUpload(bulkUpload: Record<string, unknown>, candidates: CandidateRecord[]): Record<string, unknown> {
    const visibleCandidateIds = new Set(candidates.map((candidate) => normalize(candidate.id)));
    const candidateNotes = toRecordArray(bulkUpload.candidateNotes)
      .filter((candidate) => visibleCandidateIds.has(normalize(candidate.id)));
    const duplicates = toRecordArray(bulkUpload.duplicates)
      .map((group) => {
        const duplicateCandidate = toRecord(group.duplicateCandidate);
        if (!duplicateCandidate || !visibleCandidateIds.has(normalize(duplicateCandidate.id))) return null;
        const matchedCandidates = toRecordArray(group.matchedCandidates)
          .filter((candidate) => visibleCandidateIds.has(normalize(candidate.id)));
        if (!matchedCandidates.length) return null;
        return { ...group, duplicateCandidate, matchedCandidates };
      })
      .filter((group) => group !== null);
    const blockedDuplicates = toRecordArray(bulkUpload.blockedDuplicates)
      .map((duplicate) => ({ ...duplicate, matchedCandidateIds: [] }));

    return {
      ...bulkUpload,
      candidateNotes,
      duplicates,
      blockedDuplicates
    };
  }
}

const addUserIdentity = (record: AtsRecord, ids: Set<string>, aliases: Set<string>): void => {
  const id = normalize(record.id);
  if (id) ids.add(id);
  [record.name, record.email].map(normalize).filter(Boolean).forEach((alias) => aliases.add(alias));
};

const userMatchesAliases = (record: AtsRecord, aliases: Set<string>): boolean => {
  if (!aliases.size) return false;
  return [record.id, record.name, record.email].map(normalize).some((identity) => Boolean(identity) && aliases.has(identity));
};

const collectIdentityValues = (record: AtsRecord, fields: string[]): string[] =>
  fields.map((field) => normalize(record[field])).filter(Boolean);

const normalize = (value: unknown): string => String(value || "").trim().toLowerCase();

const omitFields = (record: AtsRecord, fields: string[]): AtsRecord => {
  const sanitized = { ...record };
  fields.forEach((field) => delete sanitized[field]);
  return sanitized;
};

const toRecord = (value: unknown): AtsRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as AtsRecord : null;

const toRecordArray = (value: unknown): AtsRecord[] =>
  Array.isArray(value) ? value.map(toRecord).filter((item): item is AtsRecord => Boolean(item)) : [];

export const authorizationService = new AuthorizationService();
