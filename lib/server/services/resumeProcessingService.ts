import { promises as fs } from "fs";
import path from "path";

import { AppError } from "../middleware/error.middleware";
import { candidateStoreService } from "./candidate-store.service";
import { parseResumeWithAI } from "./resumeAIParser";
import { extractTextFromDOCX, extractTextFromPDF } from "./resumeTextExtractor";
import { uniqueStrings } from "../utils/text";
import { normalizeResumeExtraction } from "../utils/resume-normalizer";
import { resolveRuntimeDataPath } from "../utils/runtime-data";

interface ResumeProcessResponse {
  status: "processing";
  candidateId: string;
}

class ResumeProcessingService {
  private readonly resumeDir = resolveRuntimeDataPath("resumes");

  async processUploadedResume(file: Express.Multer.File): Promise<ResumeProcessResponse> {
    if (!file) {
      throw new AppError("Resume file is required", 400);
    }

    const extension = path.extname(file.originalname || "").toLowerCase();
    if (extension !== ".pdf" && extension !== ".docx") {
      throw new AppError("Only PDF and DOCX resume files are supported", 400);
    }

    await fs.mkdir(this.resumeDir, { recursive: true });

    const storedFileName = `${Date.now()}-${sanitizeFileName(file.originalname || "resume")}`;
    const storedPath = path.resolve(this.resumeDir, storedFileName);
    await fs.writeFile(storedPath, file.buffer);

    const resumeUrl = toPosixPath(path.relative(process.cwd(), storedPath));
    const placeholderName = deriveNameFromFilename(file.originalname);

    const pendingCandidate = await candidateStoreService.addActiveCandidate({
      name: placeholderName || "Unknown Candidate",
      email: "",
      phone: "",
      recruiter: "Bulk Upload",
      stage: "Identified",
      jobId: "",
      currentRole: "",
      skills: [],
      experienceYears: null,
      profileSummary: "Resume uploaded. Parsing in progress.",
      keywords: [],
      location: "",
      education: "",
      currentCompany: "",
      resumeUrl,
      parsedData: {
        originalResume: {
          fileName: file.originalname,
          fileType: extension.replace(".", "").toUpperCase(),
          storedFileName,
          resumeUrl,
          mimeType: file.mimetype || "",
          sizeBytes: file.size || file.buffer.length
        },
        uploadedAt: new Date().toISOString()
      },
      parsingStatus: "PENDING",
      source: "Resume Upload"
    });

    void this.runAsyncParsing(pendingCandidate.id, storedPath, extension, resumeUrl, file.originalname || storedFileName, storedFileName);

    return {
      status: "processing",
      candidateId: pendingCandidate.id
    };
  }

  private async runAsyncParsing(
    candidateId: string,
    storedPath: string,
    extension: ".pdf" | ".docx",
    resumeUrl: string,
    originalFileName: string,
    storedFileName: string
  ): Promise<void> {
    let resumeText = "";
    try {
      resumeText = extension === ".pdf" ? await extractTextFromPDF(storedPath) : await extractTextFromDOCX(storedPath);
      if (!resumeText.trim()) {
        throw new Error("Resume text extraction returned empty content");
      }

      const extracted = await parseResumeWithAI(resumeText);
      const normalized = normalizeResumeExtraction(extracted, resumeText);
      const keywords = uniqueStrings(normalized.keywords);

      await candidateStoreService.updateCandidateProfile(candidateId, {
        name: normalized.fullName || "Unknown Candidate",
        email: normalized.email || "",
        phone: normalized.phone || "",
        location: normalized.location || "",
        currentRole: normalized.currentRole || "",
        currentCompany: normalized.currentCompany || "",
        skills: normalized.skills || [],
        experienceYears: normalized.totalExperienceYears,
        education: (normalized.education || []).join(" | "),
        profileSummary: normalized.profileSummary || buildProfileSummary(normalized),
        keywords,
        resumeUrl,
        parsedData: {
          ...normalized,
          rawAiExtraction: extracted,
          originalResume: {
            fileName: originalFileName,
            fileType: extension.replace(".", "").toUpperCase(),
            storedFileName,
            resumeUrl
          },
          parsedAt: new Date().toISOString()
        },
        parsingStatus: "COMPLETED",
        source: "Resume Upload (AI Parsed)"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resume parsing failed";

      if (resumeText.trim()) {
        const fallback = normalizeResumeExtraction({}, resumeText);
        const hasUsableSignal =
          fallback.quality.hasCoreIdentity ||
          fallback.quality.hasContact ||
          fallback.quality.hasRoleSignal ||
          fallback.quality.hasSkillSignal;

        if (hasUsableSignal) {
          await candidateStoreService.updateCandidateProfile(candidateId, {
            name: fallback.fullName || "Unknown Candidate",
            email: fallback.email || "",
            phone: fallback.phone || "",
            location: fallback.location || "",
            currentRole: fallback.currentRole || "",
            currentCompany: fallback.currentCompany || "",
            skills: fallback.skills || [],
            experienceYears: fallback.totalExperienceYears,
            education: (fallback.education || []).join(" | "),
            profileSummary:
              fallback.profileSummary ||
              "Resume parsed with fallback extraction. Please review fields.",
            keywords: uniqueStrings(fallback.keywords),
            resumeUrl,
            parsingStatus: "COMPLETED",
            source: "Resume Upload (Heuristic Fallback)",
            parsedData: {
              ...fallback,
              parser: "HEURISTIC_FALLBACK",
              originalResume: {
                fileName: originalFileName,
                fileType: extension.replace(".", "").toUpperCase(),
                storedFileName,
                resumeUrl
              },
              fallbackReason: message,
              parsedAt: new Date().toISOString()
            }
          });
          return;
        }
      }

      await candidateStoreService.updateCandidateProfile(candidateId, {
        resumeUrl,
        parsingStatus: "FAILED",
        parsedData: {
          error: message,
          originalResume: {
            fileName: originalFileName,
            fileType: extension.replace(".", "").toUpperCase(),
            storedFileName,
            resumeUrl
          },
          failedAt: new Date().toISOString()
        },
        profileSummary: "Resume parsing failed. Review resume file and retry."
      });
    }
  }
}

const sanitizeFileName = (value: string): string =>
  String(value || "resume")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const deriveNameFromFilename = (fileName: string): string => {
  const base = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return base || "";
};

const buildProfileSummary = (payload: {
  currentRole: string;
  currentCompany: string;
  totalExperienceYears: number | null;
  skills: string[];
}): string => {
  const segments = [
    payload.currentRole ? `Role: ${payload.currentRole}` : "",
    payload.currentCompany ? `Company: ${payload.currentCompany}` : "",
    payload.totalExperienceYears != null ? `Experience: ${payload.totalExperienceYears} years` : "",
    payload.skills?.length ? `Skills: ${payload.skills.slice(0, 8).join(", ")}` : ""
  ].filter(Boolean);

  return segments.join(" | ").trim();
};

const toPosixPath = (value: string): string => value.replace(/\\/g, "/");

export const resumeProcessingService = new ResumeProcessingService();
