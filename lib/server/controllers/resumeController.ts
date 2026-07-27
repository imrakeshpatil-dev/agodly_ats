import { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware";
import { resumeProcessingService } from "../services/resumeProcessingService";

export const processResume = async (req: Request, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw new AppError("Resume file is required", 400);
  }

  const result = await resumeProcessingService.processUploadedResume(file);

  res.status(202).json(result);
};

