import { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware";
import { bulkUploadService } from "../services/bulk-upload.service";

export const parseBulkUpload = async (req: Request, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    throw new AppError("At least one file is required", 400);
  }

  const response = await bulkUploadService.processFiles(files);

  res.status(200).json({
    success: true,
    ...response
  });
};
