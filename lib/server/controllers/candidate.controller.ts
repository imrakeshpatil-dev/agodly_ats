import { Request, Response } from "express";
import { promises as fs } from "fs";
import path from "path";

import { AppError } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { AuthUser, isFounderRole } from "../services/auth.service";
import { candidateStoreService } from "../services/candidate-store.service";
import { bulkUploadService } from "../services/bulk-upload.service";
import {
  classifyResumeAIError,
  parseResumeWithAIResult,
  ResumeAIParseResult
} from "../services/resumeAIParser";
import { extractTextFromDOCX, extractTextFromPDF } from "../services/resumeTextExtractor";
import { CandidateInput, CandidateProfileUpdate, CandidateRecord } from "../types/candidate";
import { uniqueStrings } from "../utils/text";
import { normalizeResumeExtraction } from "../utils/resume-normalizer";
import { resolveRuntimeDataPath } from "../utils/runtime-data";

export const listPendingDuplicates = async (_req: Request, res: Response): Promise<void> => {
  const duplicates = await bulkUploadService.listPendingDuplicates();

  res.status(200).json({
    success: true,
    duplicates
  });
};

export const listCandidates = async (req: Request, res: Response): Promise<void> => {
  const statusRaw = String(req.query.status || "ACTIVE").trim().toUpperCase();
  const status = statusRaw === "DELETED" ? "DELETED" : statusRaw === "ALL" ? "ALL" : "ACTIVE";
  const query = String(req.query.q || "").trim();
  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 25);
  const sortBy = String(req.query.sortBy || "createdAt").trim();
  const sortDir = String(req.query.sortDir || "desc").trim().toLowerCase() === "asc" ? "asc" : "desc";
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;

  if (authUser && !isFounderRole(authUser.role)) {
    const allCandidates = await candidateStoreService.getAllCandidates();
    const scopedCandidates = allCandidates.filter((candidate) => canAuthUserAccessCandidate(authUser, candidate));
    const queryFiltered = scopedCandidates.filter((candidate) => matchesCandidateSearch(candidate, query));
    const statusCounts = {
      active: queryFiltered.filter((candidate) => candidate.status === "ACTIVE").length,
      deleted: queryFiltered.filter((candidate) => candidate.status === "DELETED").length
    };
    const statusFiltered = queryFiltered.filter((candidate) => {
      if (status === "ACTIVE") return candidate.status === "ACTIVE";
      if (status === "DELETED") return candidate.status === "DELETED";
      return candidate.status === "ACTIVE" || candidate.status === "DELETED";
    });
    const sorted = [...statusFiltered].sort((a, b) => compareCandidateForApi(a, b, sortBy, sortDir));
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;

    res.status(200).json({
      success: true,
      data: {
        rows: sorted.slice(start, start + limit),
        page: safePage,
        limit,
        total,
        totalPages,
        statusCounts
      }
    });
    return;
  }

  const result = await candidateStoreService.listCandidates({
    status,
    query,
    page,
    limit,
    sortBy,
    sortDir
  });

  res.status(200).json({
    success: true,
    data: result
  });
};

export const createCandidate = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body || {}) as Record<string, unknown>;
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (authUser?.role === "Viewer") {
    throw new AppError("Viewer access is read-only and cannot create candidates", 403);
  }
  const requestedRecruiter = toOptionalString(body.recruiter);
  const recruiter = authUser && !isFounderRole(authUser.role)
    ? authUser.name || authUser.email || "Unassigned"
    : requestedRecruiter || authUser?.name || authUser?.email || "Unassigned";
  const now = new Date().toISOString();

  const candidateInput: CandidateInput = {
    name: toOptionalString(body.name) || "Unknown Candidate",
    email: toOptionalString(body.email) || "",
    phone: toOptionalString(body.phone) || "",
    recruiter,
    stage: toOptionalString(body.stage) || "Identified",
    jobId: toOptionalString(body.jobId) || "",
    currentRole: toOptionalString(body.currentRole) || "",
    skills: toOptionalStringArray(body.skills) || [],
    experienceYears: toOptionalNumber(body.experienceYears) ?? null,
    profileSummary: toOptionalString(body.profileSummary) || "",
    keywords: toOptionalStringArray(body.keywords) || [],
    location: toOptionalString(body.location) || "",
    education: toOptionalString(body.education) || "",
    currentCompany: toOptionalString(body.currentCompany) || "",
    resumeUrl: toOptionalString(body.resumeUrl) || "",
    parsedData: {
      ...(toOptionalObject(body.parsedData) || {}),
      uploadedBy: authUser?.name || recruiter,
      uploadedByUserId: authUser?.id || "",
      uploadedAt: now,
      origin: toOptionalString(body.resumeUrl) ? "RESUME_UPLOAD" : "MANUAL_ENTRY"
    },
    parsingStatus: toOptionalParsingStatus(body.parsingStatus) || "COMPLETED",
    source: toOptionalString(body.source) || "Manual Entry"
  };

  if (!candidateInput.name.trim()) {
    throw new AppError("Candidate name is required", 400);
  }

  const allowDuplicate = Boolean(body.allowDuplicate);
  const matches = await candidateStoreService.findPotentialMatches(candidateInput);
  if (matches.length && !allowDuplicate) {
    res.status(409).json({
      success: false,
      error: {
        message: "Potential duplicate candidate found",
        code: "DUPLICATE_CANDIDATE"
      },
      duplicates: matches
    });
    return;
  }

  const candidate = await candidateStoreService.addActiveCandidate(candidateInput);

  res.status(201).json({
    success: true,
    candidate,
    duplicateWarning: matches.length
      ? {
          count: matches.length,
          matches
        }
      : null
  });
};

export const getCandidate = async (req: Request, res: Response): Promise<void> => {
  const candidateId = String(req.params.id || "").trim();
  if (!candidateId) {
    throw new AppError("Candidate id is required", 400);
  }

  const candidate = await candidateStoreService.getCandidateById(candidateId);
  if (!candidate) {
    throw new AppError("Candidate not found", 404);
  }
  assertCanAccessCandidate(req, candidate);

  res.status(200).json({
    success: true,
    candidate
  });
};

export const downloadCandidateResume = async (req: Request, res: Response): Promise<void> => {
  const candidateId = String(req.params.id || "").trim();
  if (!candidateId) {
    throw new AppError("Candidate id is required", 400);
  }

  const candidate = await candidateStoreService.getCandidateById(candidateId);
  if (!candidate) {
    throw new AppError("Candidate not found", 404);
  }
  assertCanAccessCandidate(req, candidate);

  const resumeUrl = String(candidate.resumeUrl || "").trim();
  if (!resumeUrl) {
    throw new AppError("Original resume file is not available for this candidate", 404);
  }

  const resumesDir = path.resolve(resolveRuntimeDataPath("resumes"));
  const absolutePath = path.resolve(process.cwd(), resumeUrl);
  if (!absolutePath.startsWith(`${resumesDir}${path.sep}`) && absolutePath !== resumesDir) {
    throw new AppError("Resume path is outside the allowed storage directory", 403);
  }

  try {
    await fs.access(absolutePath);
  } catch {
    throw new AppError("Stored resume file was not found", 404);
  }

  res.download(absolutePath, getOriginalResumeFileName(candidate));
};

export const mergeDuplicate = async (req: Request, res: Response): Promise<void> => {
  const { primaryCandidateId, duplicateCandidateId } = req.body as {
    primaryCandidateId?: string;
    duplicateCandidateId?: string;
  };

  if (!primaryCandidateId || !duplicateCandidateId) {
    throw new AppError("primaryCandidateId and duplicateCandidateId are required", 400);
  }

  const mergedCandidate = await bulkUploadService.mergeDuplicate(primaryCandidateId, duplicateCandidateId);

  res.status(200).json({
    success: true,
    mergedCandidate
  });
};

export const ignoreDuplicate = async (req: Request, res: Response): Promise<void> => {
  const duplicateCandidateId = String(req.params.id || "").trim();
  if (!duplicateCandidateId) {
    throw new AppError("Duplicate candidate id is required", 400);
  }

  const ignoredCandidate = await bulkUploadService.ignoreDuplicate(duplicateCandidateId);

  res.status(200).json({
    success: true,
    ignoredCandidate
  });
};

export const updateCandidateProfile = async (req: Request, res: Response): Promise<void> => {
  const candidateId = String(req.params.id || "").trim();
  if (!candidateId) {
    throw new AppError("Candidate id is required", 400);
  }

  const body = (req.body || {}) as Record<string, unknown>;

  const patch: CandidateProfileUpdate = {
    name: toOptionalString(body.name),
    email: toOptionalString(body.email),
    phone: toOptionalString(body.phone),
    recruiter: toOptionalString(body.recruiter),
    stage: toOptionalString(body.stage),
    jobId: toOptionalString(body.jobId),
    currentRole: toOptionalString(body.currentRole),
    skills: toOptionalStringArray(body.skills),
    experienceYears: toOptionalNumber(body.experienceYears),
    profileSummary: toOptionalString(body.profileSummary),
    keywords: toOptionalStringArray(body.keywords),
    location: toOptionalString(body.location),
    education: toOptionalString(body.education),
    currentCompany: toOptionalString(body.currentCompany),
    resumeUrl: toOptionalString(body.resumeUrl),
    parsedData: toOptionalObject(body.parsedData),
    parsingStatus: toOptionalParsingStatus(body.parsingStatus),
    source: toOptionalString(body.source)
  };

  Object.keys(patch).forEach((key) => {
    const typedKey = key as keyof CandidateProfileUpdate;
    if (patch[typedKey] === undefined) {
      delete patch[typedKey];
    }
  });

  if (!Object.keys(patch).length) {
    throw new AppError("At least one profile field is required", 400);
  }

  const existingCandidate = await candidateStoreService.getCandidateById(candidateId);
  if (!existingCandidate) {
    throw new AppError("Candidate not found", 404);
  }
  assertCanMutateCandidate(req, existingCandidate);
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (authUser && !isFounderRole(authUser.role) && patch.recruiter && normalizePersonKey(patch.recruiter) !== normalizePersonKey(existingCandidate.recruiter)) {
    throw new AppError("Only CEO, Managing Director, or Admin can reassign candidate ownership", 403);
  }

  const candidate = await candidateStoreService.updateCandidateProfile(candidateId, patch);

  res.status(200).json({
    success: true,
    candidate
  });
};

export const softDeleteCandidate = async (req: Request, res: Response): Promise<void> => {
  const candidateId = String(req.params.id || "").trim();
  if (!candidateId) {
    throw new AppError("Candidate id is required", 400);
  }

  const confirmationToken = String(req.body?.confirmationToken || "").trim().toUpperCase();
  if (confirmationToken !== "DELETE") {
    throw new AppError('confirmationToken must be "DELETE"', 400);
  }

  const existingCandidate = await candidateStoreService.getCandidateById(candidateId);
  if (!existingCandidate) {
    throw new AppError("Candidate not found", 404);
  }
  assertCanMutateCandidate(req, existingCandidate);

  const candidate = await candidateStoreService.softDeleteCandidate(candidateId);

  res.status(200).json({
    success: true,
    candidate
  });
};

export const restoreCandidate = async (req: Request, res: Response): Promise<void> => {
  const candidateId = String(req.params.id || "").trim();
  if (!candidateId) {
    throw new AppError("Candidate id is required", 400);
  }

  const existingCandidate = await candidateStoreService.getCandidateById(candidateId);
  if (!existingCandidate) {
    throw new AppError("Candidate not found", 404);
  }
  assertCanMutateCandidate(req, existingCandidate);

  const candidate = await candidateStoreService.restoreCandidate(candidateId);

  res.status(200).json({
    success: true,
    candidate
  });
};

export const reparseCandidateWithAI = async (req: Request, res: Response): Promise<void> => {
  const candidateId = String(req.params.id || "").trim();
  if (!candidateId) {
    throw new AppError("Candidate id is required", 400);
  }

  const candidate = await candidateStoreService.getCandidateById(candidateId);
  if (!candidate) {
    throw new AppError("Candidate not found", 404);
  }
  assertCanMutateCandidate(req, candidate);

  const resumeText = await resolveCandidateResumeText(candidate);
  if (!resumeText) {
    throw new AppError(
      "No resume text found for this candidate. Re-upload CV while backend is connected, then retry AI re-parse.",
      400
    );
  }

  const result = await parseResumeWithAIResult(resumeText);
  const patch = buildPatchFromAiResult(result, candidate, resumeText);
  const updated = await candidateStoreService.updateCandidateProfile(candidateId, patch);

  res.status(200).json({
    success: true,
    candidate: updated
  });
};

export const reparseCandidatesBatchWithAI = async (req: Request, res: Response): Promise<void> => {
  const candidateIds = Array.isArray(req.body?.candidateIds)
    ? req.body.candidateIds.map((item: unknown) => String(item || "").trim()).filter(Boolean)
    : [];
  const onlyFailed = Boolean(req.body?.onlyFailed);
  const limit = Math.min(Math.max(parsePositiveInt(req.body?.limit, 25), 1), 200);
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;

  const all = await candidateStoreService.getAllCandidates();
  const accessible = authUser && !isFounderRole(authUser.role)
    ? all.filter((candidate) => canAuthUserAccessCandidate(authUser, candidate) && canAuthUserMutateCandidate(authUser, candidate))
    : all;
  const pool = candidateIds.length
    ? accessible.filter((candidate) => candidateIds.includes(candidate.id))
    : accessible.filter((candidate) => (onlyFailed ? candidate.parsingStatus === "FAILED" : candidate.status === "ACTIVE"));

  const target = pool.slice(0, limit);
  const results: Array<Record<string, unknown>> = [];
  let successCount = 0;
  let failedCount = 0;

  for (const candidate of target) {
    try {
      const resumeText = await resolveCandidateResumeText(candidate);
      if (!resumeText) {
        results.push({
          candidateId: candidate.id,
          name: candidate.name,
          status: "skipped",
          reason: "No resume text available"
        });
        continue;
      }

      const result = await parseResumeWithAIResult(resumeText);
      const patch = buildPatchFromAiResult(result, candidate, resumeText);
      const updated = await candidateStoreService.updateCandidateProfile(candidate.id, patch);
      successCount += 1;
      results.push({
        candidateId: candidate.id,
        name: candidate.name,
        status: "updated",
        parsingStatus: updated.parsingStatus
      });
    } catch (error) {
      failedCount += 1;
      results.push({
        candidateId: candidate.id,
        name: candidate.name,
        status: "failed",
        reason: classifyResumeAIError(error)
      });
    }
  }

  res.status(200).json({
    success: true,
    summary: {
      requested: target.length,
      updated: successCount,
      failed: failedCount
    },
    results
  });
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return String(value);
};

const toOptionalStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
  }
  return String(value)
    .split(/[|,;/]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const toOptionalNumber = (value: unknown): number | null | undefined => {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new AppError("experienceYears must be a valid number", 400);
  }
  return parsed;
};

const toOptionalObject = (value: unknown): Record<string, unknown> | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("parsedData must be a JSON object", 400);
  }
  return value as Record<string, unknown>;
};

const toOptionalParsingStatus = (value: unknown): "PENDING" | "COMPLETED" | "FAILED" | undefined => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (normalized === "PENDING" || normalized === "COMPLETED" || normalized === "FAILED") {
    return normalized;
  }
  throw new AppError("parsingStatus must be one of PENDING, COMPLETED, FAILED", 400);
};

const getOriginalResumeFileName = (candidate: CandidateRecord): string => {
  const parsedData = candidate.parsedData || {};
  const originalResume = parsedData.originalResume;
  if (originalResume && typeof originalResume === "object" && !Array.isArray(originalResume)) {
    const fileName = String((originalResume as Record<string, unknown>).fileName || "").trim();
    if (fileName) return fileName;
  }

  const uploadFileName = String(parsedData.uploadFileName || "").trim();
  if (uploadFileName) return uploadFileName;

  return path.basename(String(candidate.resumeUrl || "resume"));
};

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const assertCanAccessCandidate = (req: Request, candidate: CandidateRecord): void => {
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (!authUser || canAuthUserAccessCandidate(authUser, candidate)) return;
  throw new AppError("You do not have access to this candidate", 403);
};

const assertCanMutateCandidate = (req: Request, candidate: CandidateRecord): void => {
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (!authUser) {
    throw new AppError("Unauthorized", 401);
  }

  if (canAuthUserMutateCandidate(authUser, candidate)) return;
  throw new AppError("You can only update candidates assigned to you unless you are CEO, Managing Director, or Admin", 403);
};

const canAuthUserMutateCandidate = (user: AuthUser, candidate: CandidateRecord): boolean => {
  if (isFounderRole(user.role)) return true;
  if (user.role === "Viewer") return false;
  return isCandidateAssignedToUser(user, candidate);
};

const canAuthUserAccessCandidate = (user: AuthUser, candidate: CandidateRecord): boolean => {
  if (isFounderRole(user.role)) return true;
  return isCandidateAssignedToUser(user, candidate);
};

const isCandidateAssignedToUser = (user: AuthUser, candidate: CandidateRecord): boolean => {
  const recruiterKey = normalizePersonKey(candidate.recruiter);
  const userNameKey = normalizePersonKey(user.name);
  const userEmailKey = normalizePersonKey(user.email);
  return Boolean(recruiterKey && (recruiterKey === userNameKey || recruiterKey === userEmailKey));
};

const normalizePersonKey = (value: unknown): string => String(value || "").trim().toLowerCase();

const matchesCandidateSearch = (candidate: CandidateRecord, query: string): boolean => {
  const cleanQuery = String(query || "").trim().toLowerCase();
  if (!cleanQuery) return true;
  return [
    candidate.name,
    candidate.email,
    candidate.phone,
    candidate.currentRole,
    candidate.currentCompany,
    candidate.location,
    candidate.education,
    candidate.source,
    candidate.recruiter,
    ...(candidate.skills || []),
    ...(candidate.keywords || [])
  ]
    .join(" ")
    .toLowerCase()
    .includes(cleanQuery);
};

const compareCandidateForApi = (a: CandidateRecord, b: CandidateRecord, sortBy: string, sortDir: "asc" | "desc"): number => {
  const direction = sortDir === "asc" ? 1 : -1;
  const left = getCandidateSortValue(a, sortBy);
  const right = getCandidateSortValue(b, sortBy);

  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * direction;
  }

  return String(left).localeCompare(String(right)) * direction;
};

const getCandidateSortValue = (candidate: CandidateRecord, sortBy: string): string | number => {
  if (sortBy === "experienceYears") return Number(candidate.experienceYears || 0);
  if (sortBy === "updatedAt") return candidate.updatedAt || "";
  if (sortBy === "name") return candidate.name || "";
  if (sortBy === "currentRole") return candidate.currentRole || "";
  if (sortBy === "location") return candidate.location || "";
  if (sortBy === "stage") return candidate.stage || "";
  if (sortBy === "source") return candidate.source || "";
  if (sortBy === "recruiter") return candidate.recruiter || "";
  if (sortBy === "email") return candidate.email || "";
  return candidate.createdAt || "";
};

const resolveCandidateResumeText = async (candidate: CandidateRecord): Promise<string> => {
  const parsedData = candidate.parsedData || {};
  const parsedText = getFirstNonEmptyString([
    parsedData.resumeText,
    parsedData.resumeTextFull,
    parsedData.rawResumeText,
    parsedData.text
  ]);
  if (parsedText) return parsedText.slice(0, 40000);

  const resumeUrl = String(candidate.resumeUrl || "").trim();
  if (!resumeUrl) return "";

  const absolutePath = path.resolve(process.cwd(), resumeUrl);
  const extension = path.extname(absolutePath).toLowerCase();

  if (extension === ".pdf") {
    return extractTextFromPDF(absolutePath);
  }

  if (extension === ".docx") {
    return extractTextFromDOCX(absolutePath);
  }

  return "";
};

const getFirstNonEmptyString = (values: unknown[]): string => {
  for (const value of values) {
    const candidate = String(value || "").trim();
    if (candidate) return candidate;
  }
  return "";
};

const buildPatchFromAiResult = (
  result: ResumeAIParseResult,
  existing: CandidateRecord,
  resumeText: string
): CandidateProfileUpdate => {
  const parsed = result.data;
  const normalized = normalizeResumeExtraction(parsed, resumeText);
  const skills = uniqueStrings(normalized.skills || []);
  const currentRole = String(normalized.currentRole || existing.currentRole || "").trim();
  const summary = [
    currentRole ? `Role: ${currentRole}` : "",
    normalized.currentCompany ? `Company: ${normalized.currentCompany}` : "",
    normalized.totalExperienceYears != null ? `Experience: ${normalized.totalExperienceYears} years` : "",
    skills.length ? `Skills: ${skills.slice(0, 10).join(", ")}` : ""
  ]
    .filter(Boolean)
    .join(" | ")
    .trim();

  const previousKeywords = Array.isArray(existing.keywords) ? existing.keywords : [];
  const keywords = uniqueStrings([
    ...previousKeywords,
    ...normalized.keywords
  ]);

  return {
    name: normalized.fullName || existing.name,
    email: normalized.email || existing.email,
    phone: normalized.phone || existing.phone,
    location: normalized.location || existing.location,
    currentRole: currentRole || existing.currentRole,
    currentCompany: normalized.currentCompany || existing.currentCompany,
    education: normalized.education?.length ? normalized.education.join(" | ") : existing.education,
    skills: skills.length ? skills : existing.skills,
    experienceYears:
      normalized.totalExperienceYears != null ? normalized.totalExperienceYears : existing.experienceYears,
    profileSummary: normalized.profileSummary || summary || existing.profileSummary,
    keywords,
    parsingStatus: "COMPLETED",
    parsedData: {
      ...(existing.parsedData || {}),
      parser: "AI_REPARSE",
      ...result.metadata,
      reparsedAt: new Date().toISOString(),
      resumeText: resumeText.slice(0, 40000),
      ...normalized
    }
  };
};
