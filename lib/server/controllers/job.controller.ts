import type { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware";
import { authorizationService } from "../services/authorization.service";
import type { AuthUser } from "../services/auth.service";
import { jobService } from "../services/job.service";

type AuthenticatedRequest = Request & { authUser?: AuthUser };

export const listJobs = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const jobs = await jobService.listForContext(context);
  res.status(200).json({ success: true, data: { jobs } });
};

export const createJob = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const job = await jobService.create(context, bodyFor(req));
  res.status(201).json({ success: true, data: { job } });
};

export const getJob = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const data = await jobService.getForContext(context, req.params.id);
  res.status(200).json({ success: true, data });
};

export const updateJob = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const job = await jobService.update(context, req.params.id, bodyFor(req));
  res.status(200).json({ success: true, data: { job } });
};

export const changeJobStatus = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const body = bodyFor(req);
  const job = await jobService.changeStatus(context, req.params.id, body.status, body.reason);
  res.status(200).json({ success: true, data: { job } });
};

export const archiveJob = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const body = bodyFor(req);
  const job = await jobService.changeStatus(context, req.params.id, "ARCHIVED", body.reason);
  res.status(200).json({ success: true, data: { job } });
};

export const duplicateJob = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const job = await jobService.duplicate(context, req.params.id);
  res.status(201).json({ success: true, data: { job } });
};

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  await jobService.permanentlyDelete(context, req.params.id, bodyFor(req).confirmation);
  res.status(200).json({ success: true, data: { deleted: true } });
};

export const listJobInsights = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const insights = await jobService.insights(context);
  res.status(200).json({ success: true, data: { insights } });
};

export const createJobCandidatePool = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const pool = await jobService.createPoolFromJob(context, req.params.id);
  res.status(201).json({ success: true, data: { pool } });
};

export const createInsightCandidatePool = async (req: Request, res: Response): Promise<void> => {
  const context = await contextFor(req);
  const pool = await jobService.createPoolFromInsight(context, bodyFor(req));
  res.status(201).json({ success: true, data: { pool } });
};

const contextFor = async (req: Request) => {
  const authUser = (req as AuthenticatedRequest).authUser;
  if (!authUser) throw new AppError("Unauthorized", 401);
  return authorizationService.createContext(authUser);
};

const bodyFor = (req: Request): Record<string, unknown> => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError("Request body must be a JSON object", 400);
  return body as Record<string, unknown>;
};
