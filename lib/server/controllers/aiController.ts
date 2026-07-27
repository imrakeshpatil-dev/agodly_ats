import { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware";
import { applyLearningFeedback, handleUserPrompt } from "../services/aiAgentService";
import { matchCandidatesToJob } from "../services/aiTools";

export const chatWithAi = async (req: Request, res: Response): Promise<void> => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) {
    throw new AppError("prompt is required", 400);
  }

  const conversationId = String(req.body?.conversationId || "").trim() || undefined;
  const response = await handleUserPrompt(prompt, conversationId);

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

  const output = await applyLearningFeedback(interactionId, helpfulRaw, correction || undefined);

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

  const output = await matchCandidatesToJob({
    jobDescription,
    keywords: keywords || undefined,
    topK
  });

  res.status(200).json({
    success: true,
    explanation: output.explanation,
    results: output.results
  });
};
