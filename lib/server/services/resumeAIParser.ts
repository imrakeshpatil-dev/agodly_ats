import OpenAI from "openai";

import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { normalizeResumeExtraction } from "../utils/resume-normalizer";

export interface ResumeStructuredData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  totalExperienceYears: number | null;
  currentRole: string;
  currentCompany: string;
  education: string[];
  previousCompanies: string[];
  linkedin: string;
  github: string;
}

const DEFAULT_DATA: ResumeStructuredData = {
  fullName: "",
  email: "",
  phone: "",
  location: "",
  skills: [],
  totalExperienceYears: null,
  currentRole: "",
  currentCompany: "",
  education: [],
  previousCompanies: [],
  linkedin: "",
  github: ""
};

const SYSTEM_PROMPT =
  "You extract candidate profile data from resume text. Return only valid JSON with no markdown and no extra commentary. Do not output paragraphs for single fields. If unknown, return empty string or empty array.";

const USER_PROMPT_PREFIX = `Extract structured candidate data from this resume text.

Return JSON with the following fields:
{
  "fullName": string,
  "email": string,
  "phone": string,
  "location": string,
  "skills": string[],
  "totalExperienceYears": number | null,
  "currentRole": string,
  "currentCompany": string,
  "education": string[],
  "previousCompanies": string[],
  "linkedin": string,
  "github": string
}

Ensure response is valid JSON.
Rules:
- location must be short city/region only
- currentCompany must be company name only
- currentRole must be role title only
- skills must be a concise list of technologies/competencies only`;

const openAiClient = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;

export const parseResumeWithAI = async (resumeText: string): Promise<ResumeStructuredData> => {
  if (!env.openAiApiKey || !openAiClient) {
    throw new AppError("OPENAI_API_KEY is not configured", 500);
  }

  const trimmedText = String(resumeText || "").trim();
  if (!trimmedText) {
    throw new AppError("Resume text is empty", 400);
  }

  const completion = await openAiClient.chat.completions.create({
    model: env.openAiModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${USER_PROMPT_PREFIX}\n\nResume text:\n${trimmedText.slice(0, 18000)}` }
    ]
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new AppError("AI parser returned an empty response", 502);
  }

  const parsed = parseJsonPayload(content);
  return normalizeStructuredData(parsed, trimmedText);
};

const parseJsonPayload = (content: string): Record<string, unknown> => {
  const raw = String(content || "").trim();
  const cleaned = raw.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new AppError("AI parser returned invalid JSON", 502);
  }
};

const normalizeStructuredData = (payload: Record<string, unknown>, resumeText: string): ResumeStructuredData => {
  const totalExperienceYearsRaw = payload.totalExperienceYears;
  const experience =
    totalExperienceYearsRaw === null || totalExperienceYearsRaw === undefined || totalExperienceYearsRaw === ""
      ? null
      : Number(totalExperienceYearsRaw);

  const normalized = normalizeResumeExtraction(
    {
      fullName: toStringValue(payload.fullName),
      email: toStringValue(payload.email),
      phone: toStringValue(payload.phone),
      location: toStringValue(payload.location),
      skills: toStringArray(payload.skills),
      totalExperienceYears: Number.isFinite(experience) ? experience : DEFAULT_DATA.totalExperienceYears,
      currentRole: toStringValue(payload.currentRole),
      currentCompany: toStringValue(payload.currentCompany),
      education: toStringArray(payload.education),
      previousCompanies: toStringArray(payload.previousCompanies),
      linkedin: toStringValue(payload.linkedin),
      github: toStringValue(payload.github)
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
    currentRole: normalized.currentRole,
    currentCompany: normalized.currentCompany,
    education: normalized.education,
    previousCompanies: normalized.previousCompanies,
    linkedin: normalized.linkedin,
    github: normalized.github
  };
};

const toStringValue = (value: unknown): string => String(value ?? "").trim();

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  return String(value)
    .split(/[|,;/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
};
