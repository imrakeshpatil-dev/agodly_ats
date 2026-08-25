import crypto from "node:crypto";

import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { normalizeResumeExtraction } from "../utils/resume-normalizer";
import { AIProvider, getAIErrorCategory } from "./ai/aiProvider";
import { getAIProvider } from "./ai/aiProviderFactory";
import { runtimeStateService } from "./runtime-state.service";

export interface ResumeStructuredData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  totalExperienceYears: number | null;
  relevantExperienceYears: number | null;
  currentRole: string;
  currentCompany: string;
  education: string[];
  certifications: string[];
  previousCompanies: string[];
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface ResumeParsingMetadata {
  mode: "AI" | "AI_CACHE";
  provider: string;
  model: string;
  parsedAt: string;
  status: "COMPLETED";
  confidence: "high" | "medium" | "low";
  errorCategory: null;
}

export interface ResumeAIParseResult {
  data: ResumeStructuredData;
  metadata: ResumeParsingMetadata;
}

const SYSTEM_PROMPT = `You extract candidate profile data only from supplied resume text.
Return one valid JSON object with no markdown or commentary. Never invent or infer facts that are not supported by the resume. Use empty strings, empty arrays, or null when unknown.`;

const USER_PROMPT_PREFIX = `Extract this exact JSON shape:
{
  "fullName": string,
  "email": string,
  "phone": string,
  "skills": string[],
  "totalExperienceYears": number | null,
  "relevantExperienceYears": number | null,
  "location": string,
  "currentRole": string,
  "currentCompany": string,
  "previousCompanies": string[],
  "education": string[],
  "certifications": string[],
  "linkedin": string,
  "github": string,
  "portfolio": string
}
Rules:
- location is a short city/region
- roles and companies are names/titles only
- skills and credentials are concise evidence-based lists
- do not guess missing values`;

export const parseResumeWithAIResult = async (
  resumeText: string,
  provider: AIProvider = getAIProvider("bulk"),
  useCache = true
): Promise<ResumeAIParseResult> => {
  const trimmedText = String(resumeText || "").trim();
  if (!trimmedText) throw new AppError("Resume text is empty", 400);

  const cacheKey = createCacheKey(trimmedText, provider);
  if (useCache) {
    const cached = await getCachedResult(cacheKey);
    if (cached) {
      return {
        data: cached,
        metadata: buildMetadata(cached, provider, "AI_CACHE")
      };
    }
  }

  const data = await provider.generateStructuredData<ResumeStructuredData>({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${USER_PROMPT_PREFIX}\n\nResume text:\n${trimmedText.slice(0, env.aiResumeMaxChars)}`
      }
    ],
    temperature: 0,
    maxOutputTokens: env.aiMaxOutputTokens,
    validate: (payload) => validateAndNormalizeResume(payload, trimmedText),
    repairInstruction:
      "Repair the response into the exact requested JSON object. Keep only facts present in the resume; use empty values when uncertain."
  });

  if (useCache) await setCachedResult(cacheKey, data);
  return { data, metadata: buildMetadata(data, provider, "AI") };
};

/** Keeps the existing public API stable for current callers. */
export const parseResumeWithAI = async (resumeText: string): Promise<ResumeStructuredData> =>
  (await parseResumeWithAIResult(resumeText)).data;

export const classifyResumeAIError = (error: unknown): string => getAIErrorCategory(error);

const validateAndNormalizeResume = (payload: unknown, resumeText: string): ResumeStructuredData => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Resume response must be an object");
  }
  const row = payload as Record<string, unknown>;
  const totalExperienceYears = toNullableExperience(row.totalExperienceYears);
  const relevantExperienceYears = toNullableExperience(row.relevantExperienceYears);
  const normalized = normalizeResumeExtraction(
    {
      fullName: toStringValue(row.fullName, 90),
      email: toStringValue(row.email, 200),
      phone: toStringValue(row.phone, 32),
      location: toStringValue(row.location, 80),
      skills: toStringArray(row.skills, 40, 80),
      totalExperienceYears,
      currentRole: toStringValue(row.currentRole, 100),
      currentCompany: toStringValue(row.currentCompany, 100),
      education: toStringArray(row.education, 12, 180),
      previousCompanies: toStringArray(row.previousCompanies, 20, 120),
      linkedin: toStringValue(row.linkedin, 300),
      github: toStringValue(row.github, 300)
    },
    resumeText
  );

  return {
    fullName: normalized.fullName,
    email: normalized.email,
    phone: normalized.phone,
    location: normalized.location,
    skills: normalized.skills,
    totalExperienceYears: normalized.totalExperienceYears,
    relevantExperienceYears,
    currentRole: normalized.currentRole,
    currentCompany: normalized.currentCompany,
    education: normalized.education,
    certifications: toStringArray(row.certifications, 20, 180),
    previousCompanies: normalized.previousCompanies,
    linkedin: normalized.linkedin,
    github: normalized.github,
    portfolio: toStringValue(row.portfolio, 300)
  };
};

const buildMetadata = (
  data: ResumeStructuredData,
  provider: AIProvider,
  mode: ResumeParsingMetadata["mode"]
): ResumeParsingMetadata => {
  const evidenceCount = [
    data.fullName && data.fullName !== "Unknown Candidate",
    data.email || data.phone,
    data.skills.length > 0,
    data.currentRole || data.currentCompany,
    data.totalExperienceYears != null
  ].filter(Boolean).length;
  return {
    mode,
    provider: provider.getProviderName(),
    model: provider.getModelName(),
    parsedAt: new Date().toISOString(),
    status: "COMPLETED",
    confidence: evidenceCount >= 4 ? "high" : evidenceCount >= 2 ? "medium" : "low",
    errorCategory: null
  };
};

const createCacheKey = (resumeText: string, provider: AIProvider): string => {
  const hash = crypto.createHash("sha256").update(resumeText).digest("hex");
  return `ai-resume-cache:${provider.getProviderName()}:${provider.getModelName()}:${hash}`;
};

const getCachedResult = async (key: string): Promise<ResumeStructuredData | null> => {
  try {
    const cached = await runtimeStateService.get<{ data?: ResumeStructuredData }>(key);
    return cached?.data ?? null;
  } catch {
    return null;
  }
};

const setCachedResult = async (key: string, data: ResumeStructuredData): Promise<void> => {
  try {
    await runtimeStateService.set(key, { data, cachedAt: new Date().toISOString() });
  } catch {
    // Cache failure must never fail a resume upload.
  }
};

const toNullableExperience = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Experience must be a number or null");
  return Math.round(Math.min(Math.max(number, 0), 50) * 10) / 10;
};

const toStringValue = (value: unknown, maxLength: number): string => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new Error("Expected string field");
  return value.trim().slice(0, maxLength);
};

const toStringArray = (value: unknown, maxItems: number, maxLength: number): string[] => {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Expected array field");
  return [...new Set(value.map((item) => {
    if (typeof item !== "string") throw new Error("Expected string array values");
    return item.trim().slice(0, maxLength);
  }).filter(Boolean))].slice(0, maxItems);
};
