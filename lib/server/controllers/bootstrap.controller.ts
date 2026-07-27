import { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware";
import { appStateStoreService } from "../services/app-state-store.service";
import { candidateStoreService } from "../services/candidate-store.service";
import { AppStateStorePayload } from "../types/app-state";

export const getBootstrapState = async (_req: Request, res: Response): Promise<void> => {
  const candidates = await candidateStoreService.getAllCandidates();
  const data = await appStateStoreService.getSnapshot(candidates);

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

  const payload: AppStateStorePayload = {
    bulkUpload: toOptionalObject(body.bulkUpload),
    users: toOptionalRowArray(body.users),
    clients: toOptionalRowArray(body.clients),
    jobs: toOptionalRowArray(body.jobs),
    interviews: toOptionalRowArray(body.interviews),
    placements: toOptionalRowArray(body.placements),
    activities: toOptionalRowArray(body.activities)
  };

  await appStateStoreService.updateState(payload);

  const candidates = await candidateStoreService.getAllCandidates();
  const data = await appStateStoreService.getSnapshot(candidates);

  res.status(200).json({
    success: true,
    data,
    meta: {
      candidateCount: candidates.length,
      candidateSyncMode: ignoredCandidateRows ? "ignored-browser-candidate-replacement" : "unchanged"
    }
  });
};

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
