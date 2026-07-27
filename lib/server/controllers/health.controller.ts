import { Request, Response } from "express";

import { env } from "../config/env";
import { getDiagnosticsStatus, getHealthStatus, getReadinessStatus } from "../services/health.service";

export const healthCheck = (_req: Request, res: Response): void => {
  const payload = getHealthStatus(env.nodeEnv);
  res.status(200).json(payload);
};

export const readinessCheck = async (_req: Request, res: Response): Promise<void> => {
  const payload = await getReadinessStatus();
  res.status(payload.success ? 200 : 503).json(payload);
};

export const diagnosticsCheck = async (_req: Request, res: Response): Promise<void> => {
  const payload = await getDiagnosticsStatus();
  res.status(payload.success ? 200 : 503).json(payload);
};
