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
  const previewOnly = String((req.body as { previewOnly?: unknown } | undefined)?.previewOnly || "") === "true";

  const response = await bulkUploadService.processFiles(files, {
    id: authUser.id,
    name: authUser.name,
    email: authUser.email
  }, { previewOnly });
  const safeResponse = isFounderRole(authUser.role)
    ? response
    : {
        ...response,
        blockedDuplicates: response.blockedDuplicates.map((duplicate) => ({
          ...duplicate,
          matchedCandidateIds: []
        })),
        duplicates: []
      };

  if (!previewOnly && !isFounderRole(authUser.role)) {
    await appStateStoreService.recordBulkUploadForUser(authUser.id, {
      totalFiles: safeResponse.summary.totalFiles,
      pending: safeResponse.summary.pending,
      completed: safeResponse.summary.completed,
      failed: safeResponse.summary.failed,
      blockedCount: safeResponse.summary.duplicateCandidates,
      lastRunAt: new Date().toISOString(),
      results: safeResponse.results,
      blockedDuplicates: safeResponse.blockedDuplicates,
      duplicates: safeResponse.duplicates,
      candidateNotes: safeResponse.addedCandidates
    });
  }

  res.status(200).json({
    success: true,
    ...safeResponse
  });
};
