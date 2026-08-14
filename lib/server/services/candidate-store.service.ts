import { promises as fs } from "fs";
import path from "path";

import { AppError } from "../middleware/error.middleware";
import { createId } from "../utils/id";
import { resolveRuntimeDataPath } from "../utils/runtime-data";
import { normalizeEmail, uniqueStrings } from "../utils/text";
import { CandidateInput, CandidateProfileUpdate, CandidateRecord, DuplicateGroup } from "../types/candidate";
import { matchCandidateIdentity, summarizeCandidateIdentityMatches } from "../utils/candidate-duplicates";
import { normalizeResumeExtraction } from "../utils/resume-normalizer";
import { runtimeStateService } from "./runtime-state.service";
import { authorizationService, type AuthorizationContext } from "./authorization.service";

interface CandidateStoreFile {
  candidates: CandidateRecord[];
}

export interface CandidateListOptions {
  status?: "ACTIVE" | "DELETED" | "ALL";
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface CandidateListResult {
  rows: CandidateRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  statusCounts: {
    active: number;
    deleted: number;
  };
}

export interface UniqueCandidateAddResult {
  candidate: CandidateRecord | null;
  matches: CandidateRecord[];
}

class CandidateStoreService {
  private readonly stateKey = "candidate-store";
  private readonly filePath: string;
  private records: CandidateRecord[] = [];
  private initialized = false;
  private uniqueAddQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.filePath = resolveRuntimeDataPath("candidate-store.json");
  }

  async getActiveCandidates(): Promise<CandidateRecord[]> {
    await this.reloadFromStore();
    return this.records.filter((item) => item.status === "ACTIVE").map((item) => ({ ...item }));
  }

  async getCandidatesForContext(context: AuthorizationContext): Promise<CandidateRecord[]> {
    await this.reloadFromStore();
    return authorizationService.scopeCandidates(context, this.records).map((item) => ({ ...item }));
  }

  async getActiveCandidatesForContext(context: AuthorizationContext): Promise<CandidateRecord[]> {
    const candidates = await this.getCandidatesForContext(context);
    return candidates.filter((item) => item.status === "ACTIVE");
  }

  async getAllCandidates(): Promise<CandidateRecord[]> {
    await this.reloadFromStore();
    return this.records.map((item) => ({ ...item }));
  }

  async getCandidateById(candidateId: string): Promise<CandidateRecord | null> {
    await this.reloadFromStore();
    const found = this.records.find((item) => item.id === candidateId);
    return found ? { ...found } : null;
  }

  async getCandidateForContext(
    context: AuthorizationContext,
    candidateId: string
  ): Promise<CandidateRecord | null> {
    await this.reloadFromStore();
    const found = this.records.find((item) => item.id === candidateId);
    return found && authorizationService.canViewCandidate(context, found) ? { ...found } : null;
  }

  async listCandidates(options: CandidateListOptions): Promise<CandidateListResult> {
    await this.reloadFromStore();

    return listCandidateRecords(this.records, options);
  }

  async listCandidatesForContext(
    context: AuthorizationContext,
    options: CandidateListOptions
  ): Promise<CandidateListResult> {
    await this.reloadFromStore();
    const scoped = authorizationService.scopeCandidates(context, this.records);
    return listCandidateRecords(scoped, options);
  }

  async findPotentialMatches(input: CandidateInput): Promise<CandidateRecord[]> {
    await this.reloadFromStore();

    return this.findPotentialMatchesInMemory(input);
  }

  async addActiveCandidate(input: CandidateInput): Promise<CandidateRecord> {
    await this.reloadFromStore();

    return this.appendActiveCandidate(input);
  }

  async addActiveCandidateIfUnique(input: CandidateInput): Promise<UniqueCandidateAddResult> {
    return this.runUniqueAdd(async () => {
      await this.reloadFromStore();
      const matches = this.findPotentialMatchesInMemory(input);

      if (matches.length) {
        return { candidate: null, matches };
      }

      const candidate = await this.appendActiveCandidate(input);
      return { candidate, matches: [] };
    });
  }

  private async appendActiveCandidate(input: CandidateInput): Promise<CandidateRecord> {
    const normalized = normalizeCandidateInput(input);
    const now = new Date().toISOString();
    const record: CandidateRecord = {
      id: createId(),
      ownerUserId: normalizeOwnershipId(normalized.ownerUserId),
      uploadedByUserId: normalizeOwnershipId(normalized.uploadedByUserId),
      assignedRecruiterId: normalizeOwnershipId(normalized.assignedRecruiterId),
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      recruiter: normalized.recruiter,
      stage: normalized.stage,
      jobId: normalized.jobId,
      currentRole: normalized.currentRole,
      skills: normalized.skills,
      experienceYears: normalized.experienceYears,
      profileSummary: normalized.profileSummary,
      keywords: normalized.keywords,
      location: normalized.location,
      education: normalized.education,
      currentCompany: normalized.currentCompany,
      resumeUrl: normalized.resumeUrl || "",
      parsedData: input.parsedData ?? null,
      parsingStatus: normalized.parsingStatus || "COMPLETED",
      source: normalized.source,
      createdAt: now,
      updatedAt: now,
      status: "ACTIVE",
      deletedAt: null,
      duplicateOf: [],
      mergedInto: null
    };

    this.records.push(record);
    await this.persist();
    return { ...record };
  }

  private findPotentialMatchesInMemory(input: CandidateInput): CandidateRecord[] {
    return this.records
      .filter((item) => item.status === "ACTIVE" || item.status === "DUPLICATE_PENDING")
      .filter((item) => {
        const matched = matchCandidateIdentity(input, item);
        return matched.email || matched.phone;
      })
      .map((item) => ({ ...item }));
  }

  private async runUniqueAdd<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.uniqueAddQueue;
    let release = (): void => undefined;
    this.uniqueAddQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async addDuplicateCandidate(input: CandidateInput, matchIds: string[]): Promise<CandidateRecord> {
    await this.reloadFromStore();

    const normalized = normalizeCandidateInput(input);
    const now = new Date().toISOString();
    const record: CandidateRecord = {
      id: createId(),
      ownerUserId: normalizeOwnershipId(normalized.ownerUserId),
      uploadedByUserId: normalizeOwnershipId(normalized.uploadedByUserId),
      assignedRecruiterId: normalizeOwnershipId(normalized.assignedRecruiterId),
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      recruiter: normalized.recruiter,
      stage: normalized.stage,
      jobId: normalized.jobId,
      currentRole: normalized.currentRole,
      skills: normalized.skills,
      experienceYears: normalized.experienceYears,
      profileSummary: normalized.profileSummary,
      keywords: normalized.keywords,
      location: normalized.location,
      education: normalized.education,
      currentCompany: normalized.currentCompany,
      resumeUrl: normalized.resumeUrl || "",
      parsedData: input.parsedData ?? null,
      parsingStatus: normalized.parsingStatus || "COMPLETED",
      source: normalized.source,
      createdAt: now,
      updatedAt: now,
      status: "DUPLICATE_PENDING",
      deletedAt: null,
      duplicateOf: [...new Set(matchIds)],
      mergedInto: null
    };

    this.records.push(record);
    await this.persist();
    return { ...record };
  }

  async listPendingDuplicateGroups(): Promise<DuplicateGroup[]> {
    await this.reloadFromStore();

    return this.records
      .filter((item) => item.status === "DUPLICATE_PENDING")
      .map((duplicateCandidate) => {
        const matchedCandidates = duplicateCandidate.duplicateOf
          .map((id) => this.records.find((item) => item.id === id))
          .filter((item): item is CandidateRecord => Boolean(item))
          .filter((item) => item.status === "ACTIVE")
          .map((item) => ({ ...item }));

        return {
          duplicateCandidate: { ...duplicateCandidate },
          matchedCandidates,
          reason: this.buildDuplicateReason(duplicateCandidate, matchedCandidates)
        };
      })
      .filter((group) => group.matchedCandidates.length > 0);
  }

  async mergeCandidates(primaryCandidateId: string, duplicateCandidateId: string): Promise<CandidateRecord> {
    await this.reloadFromStore();

    const primary = this.records.find((item) => item.id === primaryCandidateId);
    const duplicate = this.records.find((item) => item.id === duplicateCandidateId);

    if (!primary) {
      throw new AppError("Primary candidate not found", 404);
    }

    if (!duplicate) {
      throw new AppError("Duplicate candidate not found", 404);
    }

    if (primary.id === duplicate.id) {
      throw new AppError("Primary and duplicate candidates must be different", 400);
    }

    if (primary.status !== "ACTIVE") {
      throw new AppError("Primary candidate must be active", 400);
    }

    if (duplicate.status !== "DUPLICATE_PENDING") {
      throw new AppError("Duplicate candidate is not pending merge", 400);
    }

    primary.name = primary.name || duplicate.name;
    primary.email = primary.email || duplicate.email;
    primary.phone = primary.phone || duplicate.phone;
    primary.recruiter = primary.recruiter || duplicate.recruiter;
    primary.stage = primary.stage || duplicate.stage;
    primary.jobId = primary.jobId || duplicate.jobId;
    primary.currentRole = primary.currentRole || duplicate.currentRole;
    primary.skills = uniqueStrings([...primary.skills, ...duplicate.skills]);
    primary.keywords = uniqueStrings([...(primary.keywords || []), ...(duplicate.keywords || [])]);
    primary.profileSummary = primary.profileSummary || duplicate.profileSummary;
    primary.location = primary.location || duplicate.location;
    primary.education = primary.education || duplicate.education;
    primary.currentCompany = primary.currentCompany || duplicate.currentCompany;
    primary.resumeUrl = primary.resumeUrl || duplicate.resumeUrl;
    primary.parsedData = primary.parsedData || duplicate.parsedData;
    primary.parsingStatus = primary.parsingStatus === "COMPLETED" ? "COMPLETED" : duplicate.parsingStatus;
    primary.experienceYears = Math.max(primary.experienceYears || 0, duplicate.experienceYears || 0) || null;
    primary.updatedAt = new Date().toISOString();

    duplicate.status = "MERGED";
    duplicate.mergedInto = primary.id;
    duplicate.updatedAt = new Date().toISOString();

    await this.persist();

    return { ...primary };
  }

  async updateCandidateProfile(candidateId: string, patch: CandidateProfileUpdate): Promise<CandidateRecord> {
    await this.reloadFromStore();

    const candidate = this.records.find((item) => item.id === candidateId);
    if (!candidate) {
      throw new AppError("Candidate not found", 404);
    }

    if (patch.name !== undefined) {
      candidate.name = patch.name.trim() || candidate.name;
    }

    if (patch.ownerUserId !== undefined) {
      candidate.ownerUserId = normalizeOwnershipId(patch.ownerUserId);
    }

    if (patch.assignedRecruiterId !== undefined) {
      candidate.assignedRecruiterId = normalizeOwnershipId(patch.assignedRecruiterId);
    }

    if (patch.email !== undefined) {
      candidate.email = normalizeEmail(patch.email);
    }

    if (patch.phone !== undefined) {
      candidate.phone = patch.phone.trim();
    }

    if (patch.recruiter !== undefined) {
      candidate.recruiter = patch.recruiter.trim();
    }

    if (patch.stage !== undefined) {
      candidate.stage = patch.stage.trim() || "Identified";
    }

    if (patch.jobId !== undefined) {
      candidate.jobId = patch.jobId.trim();
    }

    if (patch.currentRole !== undefined) {
      candidate.currentRole = sanitizeLine(patch.currentRole, 90);
    }

    if (patch.skills !== undefined) {
      candidate.skills = sanitizeStringList(patch.skills, 24, 32);
    }

    if (patch.experienceYears !== undefined) {
      candidate.experienceYears = clampExperience(patch.experienceYears);
    }

    if (patch.profileSummary !== undefined) {
      candidate.profileSummary = sanitizeLine(patch.profileSummary, 320);
    }

    if (patch.keywords !== undefined) {
      candidate.keywords = sanitizeStringList(patch.keywords, 40, 36);
    }

    if (patch.location !== undefined) {
      candidate.location = sanitizeLine(patch.location, 52);
    }

    if (patch.education !== undefined) {
      candidate.education = sanitizeLine(patch.education, 160);
    }

    if (patch.currentCompany !== undefined) {
      candidate.currentCompany = sanitizeLine(patch.currentCompany, 72);
    }

    if (patch.resumeUrl !== undefined) {
      candidate.resumeUrl = patch.resumeUrl.trim();
    }

    if (patch.parsedData !== undefined) {
      candidate.parsedData = patch.parsedData;
    }

    if (patch.parsingStatus !== undefined) {
      candidate.parsingStatus = patch.parsingStatus;
    }

    if (patch.source !== undefined) {
      candidate.source = patch.source.trim();
    }

    candidate.updatedAt = new Date().toISOString();
    await this.persist();

    return { ...candidate };
  }

  async ignoreDuplicate(duplicateCandidateId: string): Promise<CandidateRecord> {
    await this.reloadFromStore();

    const duplicate = this.records.find((item) => item.id === duplicateCandidateId);
    if (!duplicate) {
      throw new AppError("Duplicate candidate not found", 404);
    }

    if (duplicate.status !== "DUPLICATE_PENDING") {
      throw new AppError("Duplicate candidate is not pending", 400);
    }

    duplicate.status = "IGNORED";
    duplicate.updatedAt = new Date().toISOString();

    await this.persist();
    return { ...duplicate };
  }

  async softDeleteCandidate(candidateId: string): Promise<CandidateRecord> {
    await this.reloadFromStore();

    const candidate = this.records.find((item) => item.id === candidateId);
    if (!candidate) {
      throw new AppError("Candidate not found", 404);
    }

    if (candidate.status === "DELETED") {
      throw new AppError("Candidate is already in deleted candidates", 400);
    }

    candidate.status = "DELETED";
    candidate.deletedAt = new Date().toISOString();
    candidate.updatedAt = candidate.deletedAt;

    await this.persist();
    return { ...candidate };
  }

  async restoreCandidate(candidateId: string): Promise<CandidateRecord> {
    await this.reloadFromStore();

    const candidate = this.records.find((item) => item.id === candidateId);
    if (!candidate) {
      throw new AppError("Candidate not found", 404);
    }

    if (candidate.status !== "DELETED") {
      throw new AppError("Candidate is not in deleted candidates", 400);
    }

    candidate.status = "ACTIVE";
    candidate.deletedAt = null;
    candidate.updatedAt = new Date().toISOString();

    await this.persist();
    return { ...candidate };
  }

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await runtimeStateService.get<Partial<CandidateStoreFile>>(this.stateKey);
      if (stored) {
        this.records = normalizeCandidateStoreFile(stored);
        this.initialized = true;
        return;
      }
    } catch {
      await this.loadLegacyFile();
      this.initialized = true;
      return;
    }

    await this.loadLegacyFile();
    this.initialized = true;
  }

  private async reloadFromStore(): Promise<void> {
    if (!this.initialized) {
      await this.ensureLoaded();
      return;
    }

    const stored = await runtimeStateService.get<Partial<CandidateStoreFile>>(this.stateKey);
    if (stored) {
      this.records = normalizeCandidateStoreFile(stored);
      return;
    }

    this.records = [];
  }

  private async persist(): Promise<void> {
    const payload: CandidateStoreFile = {
      candidates: this.records
    };

    await runtimeStateService.set(this.stateKey, payload);
  }

  private async loadLegacyFile(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      this.records = normalizeCandidateStoreFile(JSON.parse(raw) as Partial<CandidateStoreFile>);
    } catch {
      this.records = [];
    }

    await this.persist();
  }

  private buildDuplicateReason(duplicate: CandidateRecord, matches: CandidateRecord[]): string {
    const matched = summarizeCandidateIdentityMatches(duplicate, matches);

    if (matched.email && matched.phone) {
      return "Matched by email and phone";
    }

    if (matched.email) {
      return "Matched by email";
    }

    if (matched.phone) {
      return "Matched by phone";
    }

    return "Potential duplicate";
  }
}

export const candidateStoreService = new CandidateStoreService();

const normalizeCandidateStoreFile = (parsed: Partial<CandidateStoreFile>): CandidateRecord[] =>
  Array.isArray(parsed.candidates)
    ? parsed.candidates
        .map((item) => normalizeCandidateRecord(item))
        .filter((item): item is CandidateRecord => Boolean(item))
    : [];

const normalizeCandidateRecord = (item: Partial<CandidateRecord> | null | undefined): CandidateRecord | null => {
  if (!item || !item.id) return null;

  const now = new Date().toISOString();
  const createdAt = String(item.createdAt || now);

  return {
    id: String(item.id),
    ownerUserId: normalizeOwnershipId(item.ownerUserId ?? item.parsedData?.uploadedByUserId),
    uploadedByUserId: normalizeOwnershipId(item.uploadedByUserId ?? item.parsedData?.uploadedByUserId),
    assignedRecruiterId: normalizeOwnershipId(item.assignedRecruiterId),
    name: sanitizeLine(String(item.name || "Unknown Candidate"), 90) || "Unknown Candidate",
    email: normalizeEmail(item.email || ""),
    phone: String(item.phone || ""),
    recruiter: sanitizeLine(String(item.recruiter || "Bulk Upload"), 60) || "Bulk Upload",
    stage: sanitizeLine(String(item.stage || "Identified"), 60) || "Identified",
    jobId: String(item.jobId || ""),
    currentRole: sanitizeLine(String(item.currentRole || ""), 90),
    skills: Array.isArray(item.skills) ? sanitizeStringList(item.skills.map((skill) => String(skill)), 24, 32) : [],
    experienceYears:
      typeof item.experienceYears === "number" && Number.isFinite(item.experienceYears) ? clampExperience(item.experienceYears) : null,
    profileSummary: sanitizeLine(String(item.profileSummary || ""), 320),
    keywords: Array.isArray(item.keywords) ? sanitizeStringList(item.keywords.map((keyword) => String(keyword)), 40, 36) : [],
    location: sanitizeLine(String(item.location || ""), 52),
    education: sanitizeLine(String(item.education || ""), 160),
    currentCompany: sanitizeLine(String(item.currentCompany || ""), 72),
    resumeUrl: String(item.resumeUrl || ""),
    parsedData:
      item.parsedData && typeof item.parsedData === "object" && !Array.isArray(item.parsedData)
        ? (item.parsedData as Record<string, unknown>)
        : null,
    parsingStatus: normalizeParsingStatus(item.parsingStatus),
    source: String(item.source || "Bulk Upload"),
    createdAt,
    updatedAt: String(item.updatedAt || createdAt),
    status: normalizeCandidateStatus(item.status),
    deletedAt: item.deletedAt ? String(item.deletedAt) : null,
    duplicateOf: Array.isArray(item.duplicateOf) ? item.duplicateOf.map((id) => String(id)) : [],
    mergedInto: item.mergedInto ? String(item.mergedInto) : null
  };
};

const normalizeCandidateStatus = (value: unknown): CandidateRecord["status"] => {
  const status = String(value || "").trim().toUpperCase();
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "DUPLICATE_PENDING") return "DUPLICATE_PENDING";
  if (status === "MERGED") return "MERGED";
  if (status === "IGNORED") return "IGNORED";
  if (status === "DELETED") return "DELETED";
  return "ACTIVE";
};

const normalizeParsingStatus = (value: unknown): CandidateRecord["parsingStatus"] => {
  const status = String(value || "").trim().toUpperCase();
  if (status === "PENDING") return "PENDING";
  if (status === "FAILED") return "FAILED";
  return "COMPLETED";
};

const listCandidateRecords = (
  records: CandidateRecord[],
  options: CandidateListOptions
): CandidateListResult => {
  const status = normalizeListStatus(options.status);
  const query = String(options.query || "").trim().toLowerCase();
  const page = normalizePositiveInt(options.page, 1);
  const limit = Math.min(normalizePositiveInt(options.limit, 25), 100);
  const sortBy = normalizeSortBy(options.sortBy);
  const sortDir = normalizeSortDir(options.sortDir);
  const queryFiltered = records.filter((item) => matchesCandidateQuery(item, query));
  const statusCounts = {
    active: queryFiltered.filter((item) => item.status === "ACTIVE").length,
    deleted: queryFiltered.filter((item) => item.status === "DELETED").length
  };
  const statusFiltered = queryFiltered.filter((item) => {
    if (status === "ACTIVE") return item.status === "ACTIVE";
    if (status === "DELETED") return item.status === "DELETED";
    return item.status === "ACTIVE" || item.status === "DELETED";
  });
  const sorted = [...statusFiltered].sort((a, b) => compareCandidateValues(a, b, sortBy, sortDir));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;

  return {
    rows: sorted.slice(start, start + limit).map((item) => ({ ...item })),
    page: safePage,
    limit,
    total,
    totalPages,
    statusCounts
  };
};

const normalizeListStatus = (value: unknown): "ACTIVE" | "DELETED" | "ALL" => {
  const status = String(value || "").trim().toUpperCase();
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "DELETED") return "DELETED";
  return "ALL";
};

const normalizePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const normalizeSortBy = (value: unknown): string => {
  const allowed = new Set([
    "name",
    "email",
    "currentRole",
    "experienceYears",
    "createdAt",
    "updatedAt",
    "stage",
    "source",
    "recruiter",
    "location"
  ]);
  const sortBy = String(value || "createdAt").trim();
  return allowed.has(sortBy) ? sortBy : "createdAt";
};

const normalizeSortDir = (value: unknown): "asc" | "desc" => {
  const dir = String(value || "desc").trim().toLowerCase();
  return dir === "asc" ? "asc" : "desc";
};

const matchesCandidateQuery = (candidate: CandidateRecord, query: string): boolean => {
  if (!query) return true;

  const haystack = [
    candidate.name,
    candidate.email,
    candidate.phone,
    candidate.currentRole,
    candidate.currentCompany,
    candidate.location,
    candidate.education,
    candidate.source,
    candidate.recruiter,
    candidate.profileSummary,
    candidate.parsedData ? JSON.stringify(candidate.parsedData) : "",
    (candidate.skills || []).join(" "),
    (candidate.keywords || []).join(" ")
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
};

const compareCandidateValues = (a: CandidateRecord, b: CandidateRecord, sortBy: string, sortDir: "asc" | "desc"): number => {
  const left = getComparableValue(a, sortBy);
  const right = getComparableValue(b, sortBy);

  let result = 0;
  if (typeof left === "number" && typeof right === "number") {
    result = left - right;
  } else {
    result = String(left).localeCompare(String(right));
  }

  return sortDir === "asc" ? result : -result;
};

const getComparableValue = (candidate: CandidateRecord, sortBy: string): string | number => {
  if (sortBy === "experienceYears") {
    return Number(candidate.experienceYears || 0);
  }

  if (sortBy === "createdAt" || sortBy === "updatedAt") {
    const time = new Date(candidate[sortBy]).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  const value = candidate[sortBy as keyof CandidateRecord];
  return typeof value === "string" ? value.toLowerCase() : String(value || "").toLowerCase();
};

const sanitizeLine = (value: string, maxLength: number): string =>
  String(value || "")
    .replace(/[\u2022•▪◆■]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const sanitizeStringList = (items: string[], maxItems: number, maxTokenLength: number): string[] =>
  uniqueStrings(
    (Array.isArray(items) ? items : [])
      .map((item) => sanitizeLine(item, maxTokenLength))
      .filter(Boolean)
  ).slice(0, maxItems);

const clampExperience = (value: number | null | undefined): number | null => {
  if (value == null || !Number.isFinite(value)) return null;
  const bounded = Math.max(0, Math.min(50, Number(value)));
  return Math.round(bounded * 10) / 10;
};

const normalizeCandidateInput = (input: CandidateInput): CandidateInput => {
  const normalized = normalizeResumeExtraction(
    {
      fullName: input.name,
      email: input.email,
      phone: input.phone,
      location: input.location,
      skills: input.skills,
      totalExperienceYears: input.experienceYears,
      currentRole: input.currentRole,
      currentCompany: input.currentCompany,
      education: splitEducation(input.education)
    },
    String(input.profileSummary || "")
  );

  return {
    ...input,
    ownerUserId: normalizeOwnershipId(input.ownerUserId ?? input.parsedData?.uploadedByUserId),
    uploadedByUserId: normalizeOwnershipId(input.uploadedByUserId ?? input.parsedData?.uploadedByUserId),
    assignedRecruiterId: normalizeOwnershipId(
      input.assignedRecruiterId ?? input.ownerUserId ?? input.parsedData?.uploadedByUserId
    ),
    name: sanitizeLine(normalized.fullName || input.name || "Unknown Candidate", 90) || "Unknown Candidate",
    email: normalizeEmail(normalized.email || input.email || ""),
    phone: sanitizeLine(normalized.phone || input.phone || "", 24),
    recruiter: sanitizeLine(input.recruiter || "Bulk Upload", 60) || "Bulk Upload",
    stage: sanitizeLine(input.stage || "Identified", 60) || "Identified",
    jobId: sanitizeLine(input.jobId || "", 80),
    currentRole: sanitizeLine(normalized.currentRole || input.currentRole || "", 90),
    skills: sanitizeStringList(normalized.skills.length ? normalized.skills : input.skills, 24, 32),
    experienceYears: clampExperience(normalized.totalExperienceYears ?? input.experienceYears),
    profileSummary: sanitizeLine(normalized.profileSummary || input.profileSummary || "", 320),
    keywords: sanitizeStringList(normalized.keywords.length ? normalized.keywords : input.keywords, 40, 36),
    location: sanitizeLine(normalized.location || input.location || "", 52),
    education: sanitizeLine((normalized.education || []).join(" | ") || input.education || "", 160),
    currentCompany: sanitizeLine(normalized.currentCompany || input.currentCompany || "", 72),
    resumeUrl: sanitizeLine(input.resumeUrl || "", 220),
    parsingStatus: input.parsingStatus || "COMPLETED",
    source: sanitizeLine(input.source || "Bulk Upload", 80) || "Bulk Upload"
  };
};

const splitEducation = (value: string): string[] =>
  String(value || "")
    .split(/[|,;/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeOwnershipId = (value: unknown): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};
