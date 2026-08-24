import { promises as fs } from "fs";
import path from "path";

import { CandidateInput, BulkUploadResponse, CandidateRecord, UploadFileResult } from "../types/candidate";
import { attributeCandidateToUploader, BulkUploadActor } from "../utils/bulk-upload-attribution";
import { buildBlockedDuplicateReason } from "../utils/candidate-duplicates";
import { resolveRuntimeDataPath } from "../utils/runtime-data";
import { candidateStoreService } from "./candidate-store.service";
import { cvParserService } from "./cv-parser.service";

export class BulkUploadService {
  private readonly resumeDir = resolveRuntimeDataPath("resumes");

  async processFiles(
    files: Express.Multer.File[],
    actor: BulkUploadActor,
    options: { previewOnly?: boolean } = {}
  ): Promise<BulkUploadResponse> {
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
    const previewCandidates: CandidateInput[] = [];
    const blockedDuplicates: BulkUploadResponse["blockedDuplicates"] = [];

    for (const file of files) {
      const extension = path.extname(file.originalname).replace(".", "").toLowerCase();
      let originalResume: StoredResume | null = null;

      try {
        let parsedCandidates: CandidateInput[] = [];

        if (extension === "csv") {
          parsedCandidates = await cvParserService.parseCsv(file.buffer, file.originalname);
        } else if (extension === "xlsx") {
          parsedCandidates = await cvParserService.parseSpreadsheet(file.buffer, file.originalname);
        } else if (["pdf", "doc", "docx"].includes(extension)) {
          parsedCandidates = [await cvParserService.parseResumeFile(file.buffer, extension, file.originalname)];
        } else {
          throw new Error("Unsupported file format");
        }

        let addedForFile = 0;
        let duplicateForFile = 0;
        const parserModes = new Set<string>();
        const blockedReasons = new Set<string>();

        for (const parsedCandidate of parsedCandidates) {
          const parserMode = String(parsedCandidate.parsedData?.parser || "").trim().toUpperCase();
          if (parserMode) {
            parserModes.add(parserMode);
          }

          const candidateInput = attributeCandidateToUploader({
            ...parsedCandidate,
            resumeUrl: parsedCandidate.resumeUrl || "",
            source: parsedCandidate.source?.trim() || buildSourceLabel(extension, file.originalname),
            parsingStatus: parsedCandidate.parsingStatus ?? "COMPLETED",
            parsedData: {
              ...(parsedCandidate.parsedData || {}),
              uploadFileName: file.originalname,
              uploadFileType: extension.toUpperCase()
            }
          }, actor);

          const preflightMatches = await candidateStoreService.findPotentialMatches(candidateInput);

          if (preflightMatches.length) {
            recordBlockedDuplicate(candidateInput, preflightMatches, blockedDuplicates, blockedReasons);
            duplicateForFile += 1;
            summary.duplicateCandidates += 1;
            continue;
          }

          if (options.previewOnly) {
            previewCandidates.push(candidateInput);
            addedForFile += 1;
            summary.addedCandidates += 1;
            continue;
          }

          if (["pdf", "doc", "docx"].includes(extension) && !originalResume) {
            originalResume = await this.storeOriginalResume(file, extension);
            candidateInput.resumeUrl = originalResume.resumeUrl;
            candidateInput.parsedData = {
              ...(candidateInput.parsedData || {}),
              originalResume: {
                fileName: file.originalname,
                fileType: extension.toUpperCase(),
                storedFileName: originalResume.storedFileName,
                resumeUrl: originalResume.resumeUrl,
                mimeType: file.mimetype || "",
                sizeBytes: file.size || file.buffer.length
              }
            };
          }

          const uniqueResult = await candidateStoreService.addActiveCandidateIfUnique(candidateInput);

          if (!uniqueResult.candidate) {
            if (originalResume && addedForFile === 0) {
              await this.removeStoredResume(originalResume);
              originalResume = null;
            }
            recordBlockedDuplicate(candidateInput, uniqueResult.matches, blockedDuplicates, blockedReasons);
            duplicateForFile += 1;
            summary.duplicateCandidates += 1;
            continue;
          }

          addedCandidates.push(uniqueResult.candidate);
          addedForFile += 1;
          summary.addedCandidates += 1;
        }

        summary.completed += 1;
        summary.pending -= 1;
        results.push({
          fileName: file.originalname,
          kind: extension.toUpperCase(),
          status: addedForFile === 0 && duplicateForFile > 0 ? "Blocked" : "Completed",
          added: addedForFile,
          blocked: duplicateForFile,
          message:
            ["csv", "xlsx"].includes(extension)
              ? buildCsvParseMessage(parsedCandidates.length, addedForFile, duplicateForFile)
              : buildResumeParseMessage(parserModes, duplicateForFile, blockedReasons)
        });
      } catch (error) {
        if (originalResume) {
          await this.removeStoredResume(originalResume).catch(() => undefined);
        }
        summary.failed += 1;
        summary.pending -= 1;
        results.push({
          fileName: file.originalname,
          kind: extension.toUpperCase() || "Unknown",
          status: "Failed",
          added: 0,
          blocked: 0,
          message: error instanceof Error ? error.message : "Could not parse file"
        });
      }
    }

    return {
      summary,
      results,
      addedCandidates,
      previewCandidates,
      blockedDuplicates,
      duplicates: []
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
  ): Promise<StoredResume> {
    await fs.mkdir(this.resumeDir, { recursive: true });
    const storedFileName = `${Date.now()}-${sanitizeFileName(file.originalname || `resume.${extension}`)}`;
    const storedPath = path.resolve(this.resumeDir, storedFileName);
    await fs.writeFile(storedPath, file.buffer);

    return {
      storedFileName,
      resumeUrl: toPosixPath(path.relative(process.cwd(), storedPath)),
      storedPath
    };
  }

  private async removeStoredResume(resume: StoredResume): Promise<void> {
    await fs.rm(resume.storedPath, { force: true });
  }
}

interface StoredResume {
  resumeUrl: string;
  storedFileName: string;
  storedPath: string;
}

const recordBlockedDuplicate = (
  candidate: CandidateInput,
  matches: CandidateRecord[],
  blockedDuplicates: BulkUploadResponse["blockedDuplicates"],
  blockedReasons: Set<string>
): void => {
  const reason = buildBlockedDuplicateReason(candidate, matches);
  blockedReasons.add(reason);
  blockedDuplicates.push({
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    reason,
    matchedCandidateIds: [...new Set(matches.map((item) => item.id))]
  });
};

const buildSourceLabel = (extension: string, fileName: string): string => {
  if (["csv", "xlsx"].includes(extension)) {
    return `${extension === "xlsx" ? "Excel" : "CSV"} Upload (${fileName})`;
  }
  return `Resume Upload (${fileName})`;
};

const buildCsvParseMessage = (parsed: number, added: number, blocked: number): string => {
  if (blocked > 0) {
    return `Parsed ${parsed} row(s): ${added} added, ${blocked} blocked because the email or phone already exists`;
  }
  return `Parsed ${parsed} row(s): ${added} added`;
};

const buildResumeParseMessage = (
  parserModes: Set<string>,
  duplicateForFile: number,
  blockedReasons: Set<string>
): string => {
  const hasAiParser = parserModes.has("AI");
  const hasHeuristicParser = parserModes.has("HEURISTIC");
  const hasFilenameFallback = parserModes.has("FILENAME_FALLBACK");

  if (duplicateForFile > 0) {
    return [...blockedReasons][0] || "Blocked: candidate already exists in the database";
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
