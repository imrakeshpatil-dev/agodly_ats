import type { Request as ExpressRequest, Response as ExpressResponse } from "express";

import { handle, validateUploads, UploadedFile } from "@/lib/server/http";
import { processResume } from "@/lib/server/controllers/resumeController";

export const POST = handle(
  async (req: ExpressRequest, res: ExpressResponse) => {
    const shim = req as unknown as { file?: UploadedFile; files?: UploadedFile[] };
    validateUploads(shim.files ?? (shim.file ? [shim.file] : []), {
      allowedExtensions: [".pdf", ".docx"],
      maxFiles: 1,
      maxBytes: 10 * 1024 * 1024,
      label: "Only PDF and DOCX resume files are supported"
    });
    await processResume(req, res);
  },
  { auth: true }
);
