import { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { applyLearningFeedback, handleUserPrompt } from "../services/aiAgentService";
import { authorizationService } from "../services/authorization.service";
import { matchCandidatesToJob } from "../services/aiTools";

export const chatWithAi = async (req: Request, res: Response): Promise<void> => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    throw new AppError("prompt is required", 400);
  }

  const authUser = requireAuthUser(req);
  const authContext = await authorizationService.createContext(authUser);
  const conversationId = String(req.body?.conversationId || "").trim() || undefined;
  const response = await handleUserPrompt(prompt, conversationId, authContext);

  res.status(200).json({
    success: true,
    explanation: response.explanation,
    results: response.results,
    toolCalls: response.toolCalls,
    conversationId: response.conversationId,
    interactionId: response.interactionId
  });
};

export const submitAiFeedback = async (req: Request, res: Response): Promise<void> => {
  const interactionId = String(req.body?.interactionId || "").trim();
  const helpfulRaw = req.body?.helpful;
  const correction = String(req.body?.correction || "").trim();

  if (!interactionId) {
    throw new AppError("interactionId is required", 400);
  }

  if (typeof helpfulRaw !== "boolean") {
    throw new AppError("helpful must be boolean", 400);
  }

  const authUser = requireAuthUser(req);
  let output: Awaited<ReturnType<typeof applyLearningFeedback>>;
  try {
    output = await applyLearningFeedback(interactionId, helpfulRaw, correction || undefined, authUser.id);
  } catch {
    await authorizationService.logUnauthorizedAccess({
      userId: authUser.id,
      endpoint: "ai/feedback",
      entityType: "ai-interaction-feedback",
      entityId: interactionId
    });
    throw new AppError("AI interaction not found", 404);
  }

  res.status(200).json({
    success: true,
    explanation: "Feedback recorded for AI self-learning memory.",
    results: [output]
  });
};

export const scoreAiMatch = async (req: Request, res: Response): Promise<void> => {
  const jobDescription = String(req.body?.jobDescription || "").trim();
  const keywords = String(req.body?.keywords || "").trim();
  const topKRaw = Number(req.body?.topK || 15);
  const topK = Number.isFinite(topKRaw) ? Math.min(Math.max(Math.round(topKRaw), 1), 25) : 15;

  if (!jobDescription) {
    throw new AppError("jobDescription is required", 400);
  }

  const authUser = requireAuthUser(req);
  const authContext = await authorizationService.createContext(authUser);
  const output = await matchCandidatesToJob({
    jobDescription,
    keywords: keywords || undefined,
    topK
  }, authContext);

  res.status(200).json({
    success: true,
    explanation: output.explanation,
    results: output.results
  });
};

const requireAuthUser = (req: Request): AuthenticatedRequest["authUser"] => {
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (!authUser) throw new AppError("Unauthorized", 401);
  return authUser;
};
