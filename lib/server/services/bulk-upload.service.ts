import { promises as fs } from "fs";
import path from "path";

import { CandidateInput, BulkUploadResponse, CandidateRecord, UploadFileResult } from "../types/candidate";
import { resolveRuntimeDataPath } from "../utils/runtime-data";
import { candidateStoreService } from "./candidate-store.service";
import { cvParserService } from "./cv-parser.service";

export class BulkUploadService {
  private readonly resumeDir = resolveRuntimeDataPath("resumes");

  async processFiles(files: Express.Multer.File[]): Promise<BulkUploadResponse> {
    const summary: BulkUploadResponse["summary"] = {
      totalFiles: files.length,
      pending: files.length,
      completed: 0,
      failed: 0,
      addedCandidates: 0,
      duplicateCandidates: 0
    };

    const results: UploadFileResult[] = [];
    const addedCandidates: CandidateRecord[] = [];
    const duplicates: BulkUploadResponse["duplicates"] = [];

    for (const file of files) {
      const extension = path.extname(file.originalname).replace(".", "").toLowerCase();

      try {
        let parsedCandidates: CandidateInput[] = [];
        const originalResume = ["pdf", "doc", "docx"].includes(extension)
          ? await this.storeOriginalResume(file, extension)
          : null;

        if (extension === "csv") {
          parsedCandidates = await cvParserService.parseCsv(file.buffer, file.originalname);
        } else if (["pdf", "doc", "docx"].includes(extension)) {
          parsedCandidates = [await cvParserService.parseResumeFile(file.buffer, extension, file.originalname)];
        } else {
          throw new Error("Unsupported file format");
        }

        let addedForFile = 0;
        let duplicateForFile = 0;
        const parserModes = new Set<string>();

        for (const parsedCandidate of parsedCandidates) {
          const parserMode = String(parsedCandidate.parsedData?.parser || "").trim().toUpperCase();
          if (parserMode) {
            parserModes.add(parserMode);
          }

          const candidateInput: CandidateInput = {
            ...parsedCandidate,
            resumeUrl: originalResume?.resumeUrl || parsedCandidate.resumeUrl || "",
            source: parsedCandidate.source?.trim() || buildSourceLabel(extension, file.originalname),
            parsingStatus: parsedCandidate.parsingStatus ?? "COMPLETED",
            parsedData: {
              ...(parsedCandidate.parsedData || {}),
              originalResume: originalResume
                ? {
                    fileName: file.originalname,
                    fileType: extension.toUpperCase(),
                    storedFileName: originalResume.storedFileName,
                    resumeUrl: originalResume.resumeUrl,
                    mimeType: file.mimetype || "",
                    sizeBytes: file.size || file.buffer.length
                  }
                : undefined,
              uploadFileName: file.originalname,
              uploadFileType: extension.toUpperCase(),
              uploadedAt: new Date().toISOString()
            }
          };

          const matches = await candidateStoreService.findPotentialMatches(candidateInput);

          if (matches.length) {
            const pendingCandidate = await candidateStoreService.addDuplicateCandidate(
              candidateInput,
              matches.map((item) => item.id)
            );

            duplicates.push({
              duplicateCandidate: pendingCandidate,
              matchedCandidates: matches,
              reason: buildDuplicateReason(candidateInput, matches)
            });

            duplicateForFile += 1;
            summary.duplicateCandidates += 1;
            continue;
          }

          const added = await candidateStoreService.addActiveCandidate(candidateInput);
          addedCandidates.push(added);
          addedForFile += 1;
          summary.addedCandidates += 1;
        }

        summary.completed += 1;
        summary.pending -= 1;
        results.push({
          fileName: file.originalname,
          kind: extension.toUpperCase(),
          status: "Completed",
          added: addedForFile,
          message:
            extension === "csv"
              ? `Parsed ${parsedCandidates.length} row(s), ${duplicateForFile} duplicate(s)`
              : buildResumeParseMessage(parserModes, duplicateForFile)
        });
      } catch (error) {
        summary.failed += 1;
        summary.pending -= 1;
        results.push({
          fileName: file.originalname,
          kind: extension.toUpperCase() || "Unknown",
          status: "Failed",
          added: 0,
          message: error instanceof Error ? error.message : "Could not parse file"
        });
      }
    }

    return {
      summary,
      results,
      addedCandidates,
      duplicates
    };
  }

  async listPendingDuplicates(): Promise<BulkUploadResponse["duplicates"]> {
    return candidateStoreService.listPendingDuplicateGroups();
  }

  async mergeDuplicate(primaryCandidateId: string, duplicateCandidateId: string): Promise<CandidateRecord> {
    return candidateStoreService.mergeCandidates(primaryCandidateId, duplicateCandidateId);
  }

  async ignoreDuplicate(duplicateCandidateId: string): Promise<CandidateRecord> {
    return candidateStoreService.ignoreDuplicate(duplicateCandidateId);
  }

  private async storeOriginalResume(
    file: Express.Multer.File,
    extension: string
  ): Promise<{ resumeUrl: string; storedFileName: string }> {
    await fs.mkdir(this.resumeDir, { recursive: true });
    const storedFileName = `${Date.now()}-${sanitizeFileName(file.originalname || `resume.${extension}`)}`;
    const storedPath = path.resolve(this.resumeDir, storedFileName);
    await fs.writeFile(storedPath, file.buffer);

    return {
      storedFileName,
      resumeUrl: toPosixPath(path.relative(process.cwd(), storedPath))
    };
  }
}

const buildDuplicateReason = (incoming: CandidateInput, matches: CandidateRecord[]): string => {
  const email = incoming.email.trim().toLowerCase();
  const phone = incoming.phone.replace(/\D/g, "");

  const hasEmailMatch = email ? matches.some((item) => item.email.trim().toLowerCase() === email) : false;
  const hasPhoneMatch = phone ? matches.some((item) => item.phone.replace(/\D/g, "") === phone) : false;

  if (hasEmailMatch && hasPhoneMatch) return "Matched by email and phone";
  if (hasEmailMatch) return "Matched by email";
  if (hasPhoneMatch) return "Matched by phone";
  return "Potential duplicate";
};

const buildSourceLabel = (extension: string, fileName: string): string => {
  if (extension === "csv") {
    return `CSV Upload (${fileName})`;
  }
  return `Resume Upload (${fileName})`;
};

const buildResumeParseMessage = (parserModes: Set<string>, duplicateForFile: number): string => {
  const hasAiParser = parserModes.has("AI");
  const hasHeuristicParser = parserModes.has("HEURISTIC");
  const hasFilenameFallback = parserModes.has("FILENAME_FALLBACK");

  if (duplicateForFile > 0) {
    if (hasAiParser) return "AI parsed resume with duplicate matches";
    return "Processed with duplicate matches";
  }

  if (hasAiParser) return "AI parsed resume successfully";
  if (hasHeuristicParser) return "Heuristic parser extracted resume details";
  if (hasFilenameFallback) return "Fallback parser used (limited details)";
  return "Parsed resume successfully";
};

const sanitizeFileName = (value: string): string =>
  String(value || "resume")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const toPosixPath = (value: string): string => value.replace(/\\/g, "/");

export const bulkUploadService = new BulkUploadService();
