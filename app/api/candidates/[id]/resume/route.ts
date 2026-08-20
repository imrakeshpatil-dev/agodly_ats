import type { Request as ExpressRequest, Response as ExpressResponse } from "express";

import { attachCandidateResume, downloadCandidateResume } from "@/lib/server/controllers/candidate.controller";
import { handle, UploadedFile, validateUploads } from "@/lib/server/http";

export const GET = handle(downloadCandidateResume, { auth: true });
export const PUT = handle(
  async (req: ExpressRequest, res: ExpressResponse) => {
    const shim = req as unknown as { file?: UploadedFile; files?: UploadedFile[] };
    validateUploads(shim.files ?? (shim.file ? [shim.file] : []), {
      allowedExtensions: [".pdf", ".docx"],
      maxFiles: 1,
      maxBytes: 10 * 1024 * 1024,
      label: "Only PDF and DOCX CV files are supported"
    });
    await attachCandidateResume(req, res);
  },
  { auth: true }
);
