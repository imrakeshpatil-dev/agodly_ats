import type { Request as ExpressRequest, Response as ExpressResponse } from "express";

import { handle, validateUploads, UploadedFile } from "@/lib/server/http";
import { parseBulkUpload } from "@/lib/server/controllers/bulk-upload.controller";

export const POST = handle(
  async (req: ExpressRequest, res: ExpressResponse) => {
    validateUploads((req as unknown as { files?: UploadedFile[] }).files, {
      allowedExtensions: [".csv", ".xlsx", ".pdf", ".doc", ".docx"],
      maxFiles: 100,
      maxBytes: 10 * 1024 * 1024,
      label: "Only CSV, XLSX, PDF, DOC, and DOCX files are supported"
    });
    await parseBulkUpload(req, res);
  },
  { auth: true }
);
