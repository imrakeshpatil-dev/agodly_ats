import { Request, Response } from "express";

import { AppError } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { isFounderRole } from "../services/auth.service";
import { appStateStoreService } from "../services/app-state-store.service";
import { bulkUploadService } from "../services/bulk-upload.service";

export const parseBulkUpload = async (req: Request, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  const authUser = (req as Partial<AuthenticatedRequest>).authUser;

  if (!files || files.length === 0) {
    throw new AppError("At least one file is required", 400);
  }
  if (!authUser) {
    throw new AppError("Unauthorized", 401);
  }
  if (authUser.role === "Viewer") {
    throw new AppError("Viewer access is read-only and cannot upload candidates", 403);
  }

  const response = await bulkUploadService.processFiles(files, {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email
  });

  if (!isFounderRole(authUser.role)) {
    await appStateStoreService.recordBulkUploadForUser(authUser.id, {
      totalFiles: response.summary.totalFiles,
      pending: response.summary.pending,
      completed: response.summary.completed,
      failed: response.summary.failed,
      blockedCount: response.summary.duplicateCandidates,
      lastRunAt: new Date().toISOString(),
      results: response.results,
      blockedDuplicates: response.blockedDuplicates,
      duplicates: response.duplicates,
      candidateNotes: response.addedCandidates
    });
  }

  res.status(200).json({
    success: true,
    ...response
  });
};
