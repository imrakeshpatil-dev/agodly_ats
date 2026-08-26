import { Request, Response } from "express";
import { promises as fs } from "fs";
import path from "path";

import { isPipelineStage } from "../constants/pipeline";
import { AppError } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { isFounderRole } from "../services/auth.service";
import { authorizationService, type AuthorizationContext } from "../services/authorization.service";
import { candidateStoreService } from "../services/candidate-store.service";
import { candidateResumeService } from "../services/candidate-resume.service";
import { bulkUploadService } from "../services/bulk-upload.service";
import {
  addFounderReviewRequest,
  completeFounderReview,
  isFounderReviewStage
} from "../services/founder-review.service";
import {
  classifyResumeAIError,
  parseResumeWithAIResult,
  ResumeAIParseResult
} from "../services/resumeAIParser";
import { extractTextFromDOCX, extractTextFromPDF } from "../services/resumeTextExtractor";
import { CandidateInput, CandidateProfileUpdate, CandidateRecord } from "../types/candidate";
import { normalizeResumeExtraction } from "../utils/resume-normalizer";
import { resolveRuntimeDataPath } from "../utils/runtime-data";

export const listPendingDuplicates = async (req: Request, res: Response): Promise<void> => {
  const context = await getAuthorizationContext(req);
  const duplicates = await bulkUploadService.listPendingDuplicates();
  const scopedDuplicates = duplicates
    .filter((group) => authorizationService.canViewCandidate(context, group.duplicateCandidate))
    .map((group) => ({
      ...group,
      matchedCandidates: group.matchedCandidates.filter((candidate) =>
        authorizationService.canViewCandidate(context, candidate)
      )
    }))
    .filter((group) => group.matchedCandidates.length > 0);

  res.status(200).json({
    success: true,
    duplicates: scopedDuplicates
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
  const context = await getAuthorizationContext(req);
  const result = await candidateStoreService.listCandidatesForContext(context, {
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
  if (!authUser) throw new AppError("Unauthorized", 401);
  const context = await authorizationService.createContext(authUser);
  const requestedOwnerUserId = toOptionalString(body.ownerUserId) || toOptionalString(body.assignedRecruiterId);
  const ownerUserId = isFounderRole(authUser.role)
    ? requestedOwnerUserId || authUser.id
    : authorizationService.canAssignCandidateOwner(context, requestedOwnerUserId || authUser.id)
      ? requestedOwnerUserId || authUser.id
      : authUser.id;
  const recruiter = !isFounderRole(authUser.role)
    ? authUser.name || authUser.email || "Unassigned"
    : requestedRecruiter || authUser?.name || authUser?.email || "Unassigned";
  const now = new Date().toISOString();
  const requestedStage = toOptionalString(body.stage) || "Identified";
  if (!isPipelineStage(requestedStage)) {
    throw new AppError("Invalid candidate pipeline stage", 400);
  }

  const candidateInput: CandidateInput = {
    ownerUserId,
    uploadedByUserId: authUser.id,
    assignedRecruiterId: ownerUserId,
    name: toOptionalString(body.name) || "Unknown Candidate",
    email: toOptionalString(body.email) || "",
    phone: toOptionalString(body.phone) || "",
    recruiter,
    stage: requestedStage,
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

  const matches = await candidateStoreService.findPotentialMatches(candidateInput);
  if (matches.length) {
    res.status(409).json({
      success: false,
      error: {
        message: "Potential duplicate candidate found",
        code: "DUPLICATE_CANDIDATE"
      },
      duplicates: isFounderRole(authUser.role) ? matches : []
    });
    return;
  }

  const uniqueResult = await candidateStoreService.addActiveCandidateIfUnique(candidateInput);
  if (!uniqueResult.candidate) {
    res.status(409).json({
      success: false,
      error: {
        message: "Potential duplicate candidate found",
        code: "DUPLICATE_CANDIDATE"
      },
      duplicates: isFounderRole(authUser.role) ? uniqueResult.matches : []
    });
    return;
  }
  const candidate = uniqueResult.candidate;

  res.status(201).json({
    success: true,
    candidate,
    duplicateWarning: null
  });
};

export const getCandidate = async (req: Request, res: Response): Promise<void> => {
  const candidateId = String(req.params.id || "").trim();
  if (!candidateId) {
    throw new AppError("Candidate id is required", 400);
  }

  const context = await getAuthorizationContext(req);
  const candidate = await getCandidateOrDeny(req, context, candidateId, "candidate-read");

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

  const context = await getAuthorizationContext(req);
  const candidate = await getCandidateOrDeny(req, context, candidateId, "candidate-resume");

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

export const attachCandidateResume = async (req: Request, res: Response): Promise<void> => {
  const candidateId = String(req.params.id || "").trim();
  const file = req.file as Express.Multer.File | undefined;
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (!candidateId) throw new AppError("Candidate id is required", 400);
  if (!file) throw new AppError("CV file is required", 400);
  if (!authUser) throw new AppError("Unauthorized", 401);

  const context = await getAuthorizationContext(req);
  const candidate = await getCandidateOrDeny(req, context, candidateId, "candidate-resume-upload");
  await assertCanMutateCandidate(req, candidate);

  const patch = await candidateResumeService.storeAndBuildPatch(candidate, file, {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email
  });
  const updated = await candidateStoreService.updateCandidateProfile(candidateId, patch);

  res.status(200).json({ success: true, candidate: updated });
};

export const mergeDuplicate = async (req: Request, res: Response): Promise<void> => {
  const { primaryCandidateId, duplicateCandidateId } = req.body as {
    primaryCandidateId?: string;
    duplicateCandidateId?: string;
  };

  if (!primaryCandidateId || !duplicateCandidateId) {
    throw new AppError("primaryCandidateId and duplicateCandidateId are required", 400);
  }

  const context = await getAuthorizationContext(req);
  const primaryCandidate = await getCandidateOrDeny(req, context, primaryCandidateId, "candidate-merge");
  const duplicateCandidate = await getCandidateOrDeny(req, context, duplicateCandidateId, "candidate-merge");
  await assertCanMutateCandidate(req, primaryCandidate);
  await assertCanMutateCandidate(req, duplicateCandidate);

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

  const context = await getAuthorizationContext(req);
  const duplicateCandidate = await getCandidateOrDeny(req, context, duplicateCandidateId, "candidate-duplicate-ignore");
  await assertCanMutateCandidate(req, duplicateCandidate);

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
    ownerUserId: toOptionalNullableString(body.ownerUserId),
    assignedRecruiterId: toOptionalNullableString(body.assignedRecruiterId),
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

  const accessContext = await getAuthorizationContext(req);
  const existingCandidate = await getCandidateOrDeny(req, accessContext, candidateId, "candidate-update");
  const context = await assertCanMutateCandidate(req, existingCandidate);
  if (patch.stage !== undefined && !isPipelineStage(patch.stage)) {
    throw new AppError("Invalid candidate pipeline stage", 400);
  }
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  const targetOwnerId = patch.assignedRecruiterId ?? patch.ownerUserId;
  const changesOwnership =
    (patch.ownerUserId !== undefined && normalizeIdentity(patch.ownerUserId) !== normalizeIdentity(existingCandidate.ownerUserId)) ||
    (patch.assignedRecruiterId !== undefined && normalizeIdentity(patch.assignedRecruiterId) !== normalizeIdentity(existingCandidate.assignedRecruiterId)) ||
    (patch.recruiter !== undefined && normalizeIdentity(patch.recruiter) !== normalizeIdentity(existingCandidate.recruiter));
  if (changesOwnership && authUser?.role === "Recruiter") {
    await denyCandidateAccess(req, existingCandidate, "candidate-ownership-change");
  }
  if (changesOwnership && !authorizationService.canAssignCandidateOwner(context, targetOwnerId || existingCandidate.ownerUserId)) {
    await denyCandidateAccess(req, existingCandidate, "candidate-ownership-change");
  }
  if (changesOwnership && authUser) {
    void authorizationService.logSecurityEvent({
      userId: authUser.id,
      endpoint: requestEndpoint(req),
      entityType: "candidate-ownership-change",
      entityId: existingCandidate.id
    });
  }

  if (
    patch.stage !== undefined &&
    patch.stage !== existingCandidate.stage &&
    isFounderReviewStage(patch.stage) &&
    authUser
  ) {
    patch.parsedData = addFounderReviewRequest(patch.parsedData ?? existingCandidate.parsedData, {
      candidateId: existingCandidate.id,
      stage: patch.stage,
      previousStage: existingCandidate.stage,
      actor: authUser
    });
  }

  const candidate = await candidateStoreService.updateCandidateProfile(candidateId, patch);

  res.status(200).json({
    success: true,
    candidate
  });
};

export const submitFounderCandidateReview = async (req: Request, res: Response): Promise<void> => {
  const candidateId = String(req.params.id || "").trim();
  const reviewId = String(req.body?.reviewId || "").trim();
  const rating = Number(req.body?.rating);
  const notes = String(req.body?.notes || "").trim();
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;

  if (!candidateId || !reviewId) throw new AppError("Candidate id and review id are required", 400);
  if (!authUser) throw new AppError("Unauthorized", 401);
  if (authUser.role !== "CEO" && authUser.role !== "Managing Director") {
    throw new AppError("Only the CEO or Managing Director can rate submitted candidates", 403);
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
    throw new AppError("Candidate rating must be between 1 and 10", 400);
  }

  const context = await authorizationService.createContext(authUser);
  const candidate = await getCandidateOrDeny(req, context, candidateId, "candidate-founder-review");
  const completed = completeFounderReview(candidate.parsedData, {
    reviewId,
    rating,
    notes,
    actor: authUser
  });
  if (!completed.review) {
    throw new AppError("Pending founder review was not found or was already completed", 409);
  }

  const updated = await candidateStoreService.updateCandidateProfile(candidate.id, {
    parsedData: completed.parsedData
  });

  res.status(200).json({
    success: true,
    candidate: updated,
    review: completed.review
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

  const context = await getAuthorizationContext(req);
  const existingCandidate = await getCandidateOrDeny(req, context, candidateId, "candidate-delete");
  await assertCanMutateCandidate(req, existingCandidate);

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

  const context = await getAuthorizationContext(req);
  const existingCandidate = await getCandidateOrDeny(req, context, candidateId, "candidate-restore");
  await assertCanMutateCandidate(req, existingCandidate);

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

  const context = await getAuthorizationContext(req);
  const candidate = await getCandidateOrDeny(req, context, candidateId, "candidate-ai-reparse");
  await assertCanMutateCandidate(req, candidate);

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

  if (!authUser) throw new AppError("Unauthorized", 401);
  const context = await authorizationService.createContext(authUser);
  const accessible = (await candidateStoreService.getCandidatesForContext(context)).filter((candidate) =>
    authorizationService.canEditCandidate(context, candidate)
  );
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

const toOptionalNullableString = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  return String(value).trim();
};

const normalizeIdentity = (value: unknown): string => String(value || "").trim().toLowerCase();

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

  return path.basename(String(candidate.resumeUrl || "resume"));
};

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const getAuthorizationContext = async (req: Request): Promise<AuthorizationContext> => {
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (!authUser) throw new AppError("Unauthorized", 401);
  return authorizationService.createContext(authUser);
};

const assertCanMutateCandidate = async (
  req: Request,
  candidate: CandidateRecord
): Promise<AuthorizationContext> => {
  const context = await getAuthorizationContext(req);
  if (authorizationService.canEditCandidate(context, candidate)) return context;
  return denyCandidateAccess(req, candidate, "candidate-edit");
};

const denyCandidateAccess = async (
  req: Request,
  candidate: CandidateRecord,
  entityType: string
): Promise<never> => {
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (authUser) {
    await authorizationService.logUnauthorizedAccess({
      userId: authUser.id,
      endpoint: requestEndpoint(req),
      entityType,
      entityId: candidate.id
    });
  }
  throw new AppError("You do not have access to this candidate", 403);
};

const getCandidateOrDeny = async (
  req: Request,
  context: AuthorizationContext,
  candidateId: string,
  entityType: string
): Promise<CandidateRecord> => {
  const candidate = await candidateStoreService.getCandidateForContext(context, candidateId);
  if (!candidate) return denyCandidateLookup(req, candidateId, entityType);
  return candidate;
};

const denyCandidateLookup = async (
  req: Request,
  candidateId: string,
  entityType: string
): Promise<never> => {
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (authUser) {
    await authorizationService.logUnauthorizedAccess({
      userId: authUser.id,
      endpoint: requestEndpoint(req),
      entityType,
      entityId: candidateId
    });
  }
  throw new AppError("Candidate not found", 404);
};

const requestEndpoint = (req: Request): string =>
  String((req as Request & { originalUrl?: string; path?: string }).originalUrl ||
    (req as Request & { path?: string }).path ||
    "candidate-api");

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
  return {
    parsingStatus: "COMPLETED",
    parsedData: {
      ...(existing.parsedData || {}),
      parser: "AI_REPARSE",
      ...result.metadata,
      reparsedAt: new Date().toISOString(),
      resumeText: resumeText.slice(0, 40000),
      resumeExtraction: {
        ...normalized,
        parser: "AI_REPARSE",
        ...result.metadata,
        status: "COMPLETED",
        parsedAt: new Date().toISOString()
      }
    }
  };
};
