import type { Request, Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { pushNotificationService } from "../services/push-notification.service";

const authUser = (req: Request) => (req as AuthenticatedRequest).authUser;

export const getPushConfig = async (req: Request, res: Response): Promise<void> => {
  const user = authUser(req);
  res.status(200).json({
    success: true,
    ...pushNotificationService.getPublicConfig(),
    subscribed: await pushNotificationService.hasActiveSubscription(user.id)
  });
};

export const subscribePush = async (req: Request, res: Response): Promise<void> => {
  await pushNotificationService.subscribe(authUser(req), req.body || {});
  res.status(201).json({ success: true });
};

export const unsubscribePush = async (req: Request, res: Response): Promise<void> => {
  await pushNotificationService.unsubscribe(authUser(req), req.body?.endpoint);
  res.status(200).json({ success: true });
};

export const getPushPreferences = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ success: true, preferences: await pushNotificationService.getPreferences(authUser(req).id) });
};

export const updatePushPreferences = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    preferences: await pushNotificationService.updatePreferences(authUser(req).id, req.body || {})
  });
};

export const testPush = async (req: Request, res: Response): Promise<void> => {
  await pushNotificationService.sendTestPush(authUser(req));
  res.status(200).json({ success: true });
};
