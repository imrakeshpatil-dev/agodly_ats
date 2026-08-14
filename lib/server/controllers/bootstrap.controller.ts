import { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware";
import { canSyncAppState, scopeAppStatePayloadForRole } from "../services/app-state-access.service";
import { appStateStoreService } from "../services/app-state-store.service";
import { isFounderRole, type AuthUser } from "../services/auth.service";
import { candidateStoreService } from "../services/candidate-store.service";
import type { CandidateRecord } from "../types/candidate";
import { AppStateStorePayload } from "../types/app-state";

export const getBootstrapState = async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as Request & { authUser?: AuthUser }).authUser;
  if (!authUser) {
    throw new AppError("Unauthorized", 401);
  }

  const allCandidates = await candidateStoreService.getAllCandidates();
  const data = await buildBootstrapSnapshot(authUser, allCandidates);

  res.status(200).json({
    success: true,
    data
  });
};

export const syncBootstrapState = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("State payload must be a JSON object", 400);
  }

  const ignoredCandidateRows = Array.isArray(body.candidates) ? body.candidates.length : 0;

  const requestedBulkUpload = toOptionalObject(body.bulkUpload);
  const requestedPayload: AppStateStorePayload = {
    bulkUpload: requestedBulkUpload,
    users: toOptionalRowArray(body.users),
    clients: toOptionalRowArray(body.clients),
    jobs: toOptionalRowArray(body.jobs),
    interviews: toOptionalRowArray(body.interviews),
    placements: toOptionalRowArray(body.placements),
    activities: toOptionalRowArray(body.activities)
  };

  const authUser = (req as Request & { authUser?: AuthUser }).authUser;
  if (!authUser || !canSyncAppState(authUser.role)) {
    throw new AppError("This account has read-only ATS access", 403);
  }

  const payload = scopeAppStatePayloadForRole(requestedPayload, authUser.role);

  if (!isFounderRole(authUser.role) && requestedBulkUpload) {
    await appStateStoreService.updateBulkUploadForUser(authUser.id, requestedBulkUpload);
  }

  await appStateStoreService.updateState(payload);

  const allCandidates = await candidateStoreService.getAllCandidates();
  const data = await buildBootstrapSnapshot(authUser, allCandidates);

  res.status(200).json({
    success: true,
    data,
    meta: {
      candidateCount: data.candidates.length,
      candidateSyncMode: ignoredCandidateRows ? "ignored-browser-candidate-replacement" : "unchanged",
      syncedCollections: Object.keys(payload)
    }
  });
};

const buildBootstrapSnapshot = async (
  authUser: AuthUser,
  allCandidates: CandidateRecord[]
) => {
  const founder = isFounderRole(authUser.role);
  const candidates = founder
    ? allCandidates
    : allCandidates.filter((candidate) => isCandidateAssignedToUser(authUser, candidate));
  const data = await appStateStoreService.getSnapshot(candidates, {
    bulkUploadOwnerId: founder ? undefined : authUser.id
  });

  if (!founder) {
    data.bulkUpload = includeOwnedUploadCandidates(data.bulkUpload, candidates, authUser);
  }

  return data;
};

const includeOwnedUploadCandidates = (
  bulkUpload: Record<string, unknown>,
  candidates: CandidateRecord[],
  authUser: AuthUser
): Record<string, unknown> => {
  const existingNotes = Array.isArray(bulkUpload.candidateNotes)
    ? bulkUpload.candidateNotes.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
  const notesById = new Map(existingNotes.map((item) => [String(item.id || ""), item]));

  candidates
    .filter((candidate) => isCandidateFromBulkUpload(candidate, authUser))
    .forEach((candidate) => notesById.set(candidate.id, { ...candidate }));

  return {
    ...bulkUpload,
    candidateNotes: [...notesById.values()].slice(0, 120)
  };
};

const isCandidateFromBulkUpload = (candidate: CandidateRecord, authUser: AuthUser): boolean => {
  const uploadedByUserId = String(candidate.parsedData?.uploadedByUserId || "").trim();
  if (uploadedByUserId && uploadedByUserId === authUser.id) return true;
  return /(?:csv|resume|bulk) upload/i.test(candidate.source);
};

const isCandidateAssignedToUser = (authUser: AuthUser, candidate: CandidateRecord): boolean => {
  const recruiter = normalizePersonKey(candidate.recruiter);
  return Boolean(
    recruiter &&
    (recruiter === normalizePersonKey(authUser.name) || recruiter === normalizePersonKey(authUser.email))
  );
};

const normalizePersonKey = (value: unknown): string => String(value || "").trim().toLowerCase();

const toOptionalObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
};

const toOptionalRowArray = (value: unknown): Array<Record<string, unknown>> | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({ ...(item as Record<string, unknown>) }));
};
