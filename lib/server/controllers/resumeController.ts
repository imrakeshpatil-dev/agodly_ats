import { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { resumeProcessingService } from "../services/resumeProcessingService";

export const processResume = async (req: Request, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined;
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;
  if (!file) {
    throw new AppError("Resume file is required", 400);
  }
  if (!authUser) {
    throw new AppError("Unauthorized", 401);
  }
  if (authUser.role === "Viewer") {
    throw new AppError("Viewer access is read-only and cannot upload candidates", 403);
  }

  const result = await resumeProcessingService.processUploadedResume(file, {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email
  });

  res.status(202).json(result);
};
