import { promises as fs } from "fs";
import path from "path";

import { CandidateProfileUpdate, CandidateRecord } from "../types/candidate";
import { createId } from "../utils/id";
import { resolveRuntimeDataPath } from "../utils/runtime-data";
import { cvParserService } from "./cv-parser.service";

export interface CandidateResumeActor {
  id: string;
  name: string;
  email: string;
}

export interface CandidateResumeVersion {
  versionId: string;
  fileName: string;
  fileType: string;
  storedFileName: string;
  resumeUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByUserId: string;
}

class CandidateResumeService {
  private readonly resumeDir = resolveRuntimeDataPath("resumes");

  async storeAndBuildPatch(
    candidate: CandidateRecord,
    file: Express.Multer.File,
    actor: CandidateResumeActor
  ): Promise<CandidateProfileUpdate> {
    const extension = path.extname(file.originalname).replace(".", "").toLowerCase();
    await fs.mkdir(this.resumeDir, { recursive: true });

    const storedFileName = `${Date.now()}-${createId()}-${sanitizeFileName(file.originalname)}`;
    const storedPath = path.resolve(this.resumeDir, storedFileName);
    await fs.writeFile(storedPath, file.buffer);

    const now = new Date().toISOString();
    const version: CandidateResumeVersion = {
      versionId: createId(),
      fileName: file.originalname,
      fileType: extension.toUpperCase(),
      storedFileName,
      resumeUrl: toPosixPath(path.relative(process.cwd(), storedPath)),
      mimeType: file.mimetype || "application/octet-stream",
      sizeBytes: file.size || file.buffer.length,
      uploadedAt: now,
      uploadedBy: actor.name || actor.email,
      uploadedByUserId: actor.id
    };

    let parsingStatus: "COMPLETED" | "FAILED" = "COMPLETED";
    let extraction: Record<string, unknown>;
    try {
      const parsed = await cvParserService.parseResumeFile(file.buffer, extension, file.originalname);
      extraction = buildReadableExtraction(parsed);
    } catch (error) {
      parsingStatus = "FAILED";
      extraction = {
        status: "FAILED",
        message: "The CV was stored safely, but automatic extraction could not be completed.",
        errorCategory: error instanceof Error ? error.name : "ParseError",
        parsedAt: now
      };
    }

    return buildDataPreservingResumePatch(candidate, version, extraction, parsingStatus, actor, now);
  }
}

export const buildDataPreservingResumePatch = (
  candidate: CandidateRecord,
  version: CandidateResumeVersion,
  extraction: Record<string, unknown>,
  parsingStatus: "COMPLETED" | "FAILED",
  actor: CandidateResumeActor,
  timestamp: string
): CandidateProfileUpdate => {
  const existingData = candidate.parsedData && typeof candidate.parsedData === "object"
    ? candidate.parsedData
    : {};
  const existingVersions = Array.isArray(existingData.resumeVersions)
    ? existingData.resumeVersions.filter((item) => item && typeof item === "object")
    : [];
  const previousOriginal = toResumeVersion(existingData.originalResume, candidate);
  const resumeVersions = [
    version,
    ...existingVersions,
    ...(previousOriginal && !existingVersions.some((item) => sameResumeVersion(item, previousOriginal))
      ? [previousOriginal]
      : [])
  ];
  const timeline = Array.isArray(existingData.timeline) ? existingData.timeline : [];

  return {
    resumeUrl: version.resumeUrl,
    parsingStatus,
    parsedData: {
      ...existingData,
      originalResume: version,
      resumeVersions,
      resumeExtraction: extraction,
      parser: String(extraction.parser || "CV_ATTACHMENT"),
      parsedAt: String(extraction.parsedAt || timestamp),
      timeline: [
        {
          id: createId(),
          eventType: candidate.resumeUrl ? "CV Replaced" : "CV Attached",
          candidateId: candidate.id,
          jobId: candidate.jobId,
          recruiter: candidate.recruiter,
          user: actor.name || actor.email,
          timestamp,
          currentStage: candidate.stage,
          remarks: `${version.fileName} stored as a new CV version`,
          attachments: [version.fileName]
        },
        ...timeline
      ]
    }
  };
};

const buildReadableExtraction = (parsed: Awaited<ReturnType<typeof cvParserService.parseResumeFile>>): Record<string, unknown> => {
  const data = parsed.parsedData && typeof parsed.parsedData === "object" ? parsed.parsedData : {};
  return {
    status: "COMPLETED",
    fullName: parsed.name || "",
    email: parsed.email || "",
    phone: parsed.phone || "",
    location: parsed.location || "",
    profileSummary: parsed.profileSummary || "",
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    currentRole: parsed.currentRole || "",
    currentCompany: parsed.currentCompany || "",
    totalExperienceYears: parsed.experienceYears,
    education: parsed.education ? [parsed.education] : [],
    employment: Array.isArray(data.previousCompanies) ? data.previousCompanies : [],
    certifications: Array.isArray(data.certifications) ? data.certifications : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    linkedin: String(data.linkedin || ""),
    github: String(data.github || ""),
    portfolio: String(data.portfolio || ""),
    parser: String(data.parser || "HEURISTIC"),
    provider: String(data.provider || ""),
    model: String(data.model || ""),
    mode: String(data.mode || ""),
    parsedAt: new Date().toISOString(),
    missingInformation: buildMissingInformation(parsed, data)
  };
};

const buildMissingInformation = (
  parsed: Awaited<ReturnType<typeof cvParserService.parseResumeFile>>,
  data: Record<string, unknown>
): string[] => {
  const missing: string[] = [];
  if (!parsed.email) missing.push("Email");
  if (!parsed.phone) missing.push("Phone");
  if (!parsed.location) missing.push("Location");
  if (!parsed.education) missing.push("Education");
  if (!parsed.currentRole) missing.push("Current role");
  if (!Array.isArray(data.projects) || data.projects.length === 0) missing.push("Projects");
  return missing;
};

const toResumeVersion = (value: unknown, candidate: CandidateRecord): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const resumeUrl = String(item.resumeUrl || candidate.resumeUrl || "").trim();
  if (!resumeUrl) return null;
  return {
    versionId: String(item.versionId || createId()),
    fileName: String(item.fileName || path.basename(resumeUrl)),
    fileType: String(item.fileType || path.extname(resumeUrl).slice(1).toUpperCase()),
    storedFileName: String(item.storedFileName || path.basename(resumeUrl)),
    resumeUrl,
    mimeType: String(item.mimeType || "application/octet-stream"),
    sizeBytes: Number(item.sizeBytes || 0),
    uploadedAt: String(item.uploadedAt || candidate.createdAt),
    uploadedBy: String(item.uploadedBy || candidate.recruiter || "Unknown"),
    uploadedByUserId: String(item.uploadedByUserId || candidate.uploadedByUserId || "")
  };
};

const sameResumeVersion = (left: unknown, right: Record<string, unknown>): boolean => {
  if (!left || typeof left !== "object" || Array.isArray(left)) return false;
  const item = left as Record<string, unknown>;
  return String(item.resumeUrl || "") === String(right.resumeUrl || "");
};

const sanitizeFileName = (value: string): string =>
  String(value || "resume")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "resume";

const toPosixPath = (value: string): string => value.replace(/\\/g, "/");

export const candidateResumeService = new CandidateResumeService();
