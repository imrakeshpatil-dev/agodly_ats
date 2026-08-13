import { Request, Response } from "express";

import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { authService, isFounderRole } from "../services/auth.service";

export const login = async (req: Request, res: Response): Promise<void> => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    throw new AppError("email and password are required", 400);
  }

  const session = await authService.login(email, password);
  if (!session) {
    throw new AppError("Invalid credentials", 401);
  }

  res.status(200).json({
    success: true,
    token: session.token,
    user: session.user
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  await authService.logout((req as AuthenticatedRequest).authSession.token);

  res.status(200).json({
    success: true
  });
};

export const me = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    user: (req as AuthenticatedRequest).authUser
  });
};

export const setPassword = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const newPassword = String(req.body?.newPassword || "");
  const targetUserId = String(req.body?.userId || "").trim();
  const targetEmail = String(req.body?.email || "").trim().toLowerCase();

  if (targetUserId === "usr-admin" || targetEmail === String(env.adminEmail || "").trim().toLowerCase()) {
    throw new AppError("This administrator password is managed through server environment configuration", 409);
  }

  if (newPassword.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  const targetsSelf =
    (!targetUserId && !targetEmail) ||
    (targetUserId && targetUserId === authReq.authUser.id) ||
    (targetEmail && targetEmail === authReq.authUser.email);

  if (!targetsSelf && !isFounderRole(authReq.authUser.role)) {
    throw new AppError("Founder access required to reset another user's password", 403);
  }

  const identifier =
    !targetUserId && !targetEmail
      ? { id: authReq.authUser.id, email: authReq.authUser.email }
      : { id: targetUserId || undefined, email: targetEmail || undefined };

  const updated = await authService.setUserPassword(identifier, newPassword);
  if (!updated) {
    throw new AppError("User not found, or account password is managed via environment configuration", 404);
  }

  res.status(200).json({ success: true });
};
