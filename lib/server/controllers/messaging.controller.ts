import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { messagingService } from "../services/messaging.service";

const authUser = (req: Request) => (req as AuthenticatedRequest).authUser;

export const listMessageDirectory = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, users: await messagingService.listDirectory(authUser(req)) });
};

export const listConversations = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, conversations: await messagingService.listConversations(authUser(req)) });
};

export const createConversation = async (req: Request, res: Response): Promise<void> => {
  const conversation = await messagingService.createConversation(authUser(req), req.body || {});
  res.status(201).json({ success: true, conversation });
};

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  const data = await messagingService.getConversation(authUser(req), String(req.params.id || ""));
  res.status(200).json({ success: true, ...data });
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  const message = await messagingService.sendMessage(authUser(req), String(req.params.id || ""), req.body || {});
  res.status(201).json({ success: true, message });
};

export const updateMessageReceipt = async (req: Request, res: Response): Promise<void> => {
  const receipt = await messagingService.updateReceipt(authUser(req), String(req.params.id || ""), req.body || {});
  res.status(200).json({ success: true, receipt });
};
