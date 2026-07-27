import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { parse } from "csv-parse/sync";

import { env } from "../config/env";
import { parseResumeWithAI, ResumeStructuredData } from "./resumeAIParser";
import { CandidateInput } from "../types/candidate";
import { uniqueStrings } from "../utils/text";
import { normalizeResumeExtraction } from "../utils/resume-normalizer";

const SKILL_KEYWORDS = [
  "typescript",
  "javascript",
  "node.js",
  "node",
  "react",
  "next.js",
  "nextjs",
  "python",
  "java",
  "spring",
  "django",
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "terraform",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "graphql",
  "rest",
  "ci/cd",
  "devops",
  "recruitment",
  "talent acquisition",
  "sourcing",
  "stakeholder management",
  "communication",
  "figma",
  "design systems"
];
const ROLE_KEYWORDS = [
  "software engineer",
  "backend engineer",
  "frontend engineer",
  "full stack engineer",
  "devops engineer",
  "data engineer",
  "qa engineer",
  "sre",
  "product manager",
  "project manager",
  "business analyst",
  "technical recruiter",
  "recruiter",
  "talent acquisition specialist",
  "sourcer",
  "designer",
  "ux designer",
  "ui designer",
  "data scientist",
  "machine learning engineer"
];

export class CvParserService {
  async parseCsv(buffer: Buffer, sourceFileName: string): Promise<CandidateInput[]> {
    const records = parse(buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Array<Record<string, string>>;

    return records
      .map((row, index) => this.mapCsvRow(row, sourceFileName, index))
      .filter((item): item is CandidateInput => Boolean(item));
  }

  async parseResumeFile(buffer: Buffer, extension: string, fileName: string): Promise<CandidateInput> {
    if (extension === "pdf") {
      const parsed = await pdfParse(buffer);
      return this.extractCandidateFromResumeText(parsed.text, fileName);
    }

    if (extension === "docx") {
      const parsed = await mammoth.extractRawText({ buffer });
      return this.extractCandidateFromResumeText(parsed.value, fileName);
    }

    if (extension === "doc") {
      // Binary DOC is not reliably parseable without external conversion.
      // Fallback to filename extraction to keep upload flow resilient.
      return this.extractCandidateFromFilename(fileName);
    }

    throw new Error("Unsupported resume format");
  }

  private async extractCandidateFromResumeText(rawText: string, fileName: string): Promise<CandidateInput> {
    const text = cleanResumeText(rawText);
    if (!text) {
      return this.extractCandidateFromFilename(fileName);
    }

    const aiCandidate = await this.tryExtractCandidateWithAI(text, fileName);
    if (aiCandidate) {
      return aiCandidate;
    }

    return this.extractCandidateFromText(text, fileName);
  }

  private async tryExtractCandidateWithAI(resumeText: string, fileName: string): Promise<CandidateInput | null> {
    if (!env.openAiApiKey) return null;

    try {
      const parsed = await parseResumeWithAI(resumeText);
      return mapAiStructuredDataToCandidate(parsed, fileName, resumeText);
    } catch {
      return null;
    }
  }

  private mapCsvRow(row: Record<string, string>, sourceFileName: string, index: number): CandidateInput | null {
    const get = (...keys: string[]): string => {
      for (const key of keys) {
        const normalized = key.toLowerCase().trim();
        const match = Object.entries(row).find(([header]) => header.toLowerCase().trim() === normalized);
        if (match && String(match[1]).trim()) return String(match[1]).trim();
      }
      return "";
    };

    const name = get("name", "candidate name", "full name");
    const email = get("email", "email id", "mail");
    const phone = get("phone", "mobile", "phone number", "contact");

    if (!name && !email && !phone) {
      return null;
    }

    const skillsRaw = get("skills", "skill", "technologies");
    const profileSummary = get("summary", "profile summary", "about", "objective");
    const skills = sanitizeSkillsList([...splitMulti(skillsRaw), ...extractSkills(profileSummary)]);
    const experienceYears = extractExperience(get("experience", "experience years", "exp"));
    const currentRole = get("current role", "role", "designation", "title", "job title");
    const location = get("location", "city");
    const education = get("education", "qualification");
    const currentCompany = get("current company", "company");
    const keywords = uniqueStrings([...skills, ...extractSkills(`${profileSummary} ${skills.join(" ")}`)]);

    return {
      name: name || deriveNameFromEmail(email) || `Candidate ${index + 1}`,
      email,
      phone,
      recruiter: "Bulk Upload",
      stage: "Identified",
      jobId: "",
      currentRole: sanitizeRole(currentRole || inferRole(`${profileSummary} ${skills.join(" ")}`)),
      skills,
      experienceYears,
      profileSummary: sanitizeProfileSummary(profileSummary),
      keywords,
      location: sanitizeLocation(location),
      education: sanitizeEducation(education),
      currentCompany: sanitizeCompany(currentCompany),
      source: `CSV Upload (${sourceFileName})`
    };
  }

  private extractCandidateFromText(rawText: string, fileName: string): CandidateInput {
    const text = cleanResumeText(rawText);

    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,14}/);
    const experienceYears = extractExperience(text);

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 1);

    const name = findLikelyName(lines) || this.extractCandidateFromFilename(fileName).name;
    const skills = extractSkills(text, lines);
    const currentRole = sanitizeRole(findLikelyRole(lines) || inferRole(`${skills.join(" ")} ${text}`));
    const location = findLikelyLocation(lines);
    const education = findLikelyEducation(lines);
    const currentCompany = findLikelyCompany(lines);
    const profileSummary = buildFallbackProfileSummary({
      text,
      currentRole,
      experienceYears,
      skills
    });

    return {
      name,
      email: emailMatch ? emailMatch[0] : "",
      phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, " ").trim() : "",
      recruiter: "Bulk Upload",
      stage: "Identified",
      jobId: "",
      currentRole,
      skills,
      experienceYears,
      profileSummary: sanitizeProfileSummary(profileSummary),
      keywords: uniqueStrings([...skills, ...extractSkills(profileSummary)]),
      location,
      education,
      currentCompany,
      source: `Resume Upload (${fileName})`,
      parsingStatus: "COMPLETED",
      parsedData: {
        parser: "HEURISTIC",
        sourceFileName: fileName,
        resumeText: text.slice(0, 40000)
      }
    };
  }

  private extractCandidateFromFilename(fileName: string): CandidateInput {
    const base = fileName.replace(/\.[^.]+$/, "");
    const emailMatch = base.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = base.match(/(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,14}/);

    const stripped = base
      .replace(emailMatch?.[0] || "", "")
      .replace(phoneMatch?.[0] || "", "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      name: stripped || "Unknown Candidate",
      email: emailMatch ? emailMatch[0] : "",
      phone: phoneMatch ? phoneMatch[0] : "",
      recruiter: "Bulk Upload",
      stage: "Identified",
      jobId: "",
      currentRole: inferRole(stripped),
      skills: [],
      experienceYears: null,
      profileSummary: `Uploaded resume file: ${fileName}`,
      keywords: [],
      location: "",
      education: "",
      currentCompany: "",
      source: `Resume Upload (${fileName})`,
      parsingStatus: "COMPLETED",
      parsedData: {
        parser: "FILENAME_FALLBACK",
        sourceFileName: fileName
      }
    };
  }
}

const RESUME_HEADING_PATTERN =
  /^(summary|profile|objective|experience|work experience|professional experience|employment|education|projects?|certifications?|skills?|technical skills?|core skills?|contact|personal details?)[:\s]*$/i;
const FIELD_NOISE_PATTERN =
  /\b(responsibilit|project|client|team|develop|work(ed)?|implement|using|technology|framework|skills?|experience|objective|summary)\b/i;
const COMPANY_SUFFIX_PATTERN =
  /\b(ltd|limited|llp|inc|corp|corporation|pvt|private|technologies|technology|solutions|systems|consulting|services|labs?)\b/i;
const SKILL_STOPWORDS = new Set([
  "skill",
  "skills",
  "technical",
  "technologies",
  "technology",
  "tools",
  "responsibility",
  "responsibilities",
  "project",
  "projects",
  "client",
  "clients",
  "profile",
  "summary",
  "experience"
]);
const LOCATION_HINTS = [
  "bangalore",
  "bengaluru",
  "hyderabad",
  "pune",
  "mumbai",
  "delhi",
  "gurgaon",
  "noida",
  "chennai",
  "kolkata",
  "ahmedabad",
  "coimbatore",
  "kochi",
  "indore",
  "jaipur",
  "lucknow",
  "nagpur",
  "remote"
];

const cleanResumeText = (rawText: string): string =>
  String(rawText || "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeInlineValue = (value: string): string =>
  String(value || "")
    .replace(/[\u2022•▪◆■]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeProfileSummary = (value: string): string => normalizeInlineValue(value).slice(0, 320);

const sanitizeRole = (value: string): string => normalizeInlineValue(value).slice(0, 80);

const sanitizeEducation = (value: string): string => normalizeInlineValue(value).slice(0, 160);

const sanitizeLocation = (value: string): string => {
  let cleaned = normalizeInlineValue(value)
    .replace(/^(location|current location|address|based in)\s*[:\-]?\s*/i, "")
    .replace(/\S+@\S+/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length > 48) return "";
  if (/\.com\b/i.test(cleaned)) return "";
  if (FIELD_NOISE_PATTERN.test(cleaned)) return "";

  const low = cleaned.toLowerCase();
  if (!LOCATION_HINTS.some((item) => low.includes(item)) && !/,/.test(cleaned) && cleaned.split(/\s+/).length > 3) {
    return "";
  }

  return cleaned.replace(/\s*,\s*/g, ", ");
};

const sanitizeCompany = (value: string): string => {
  let cleaned = normalizeInlineValue(value)
    .replace(/^(current company|present company|company|organization|employer|currently at|working at|at)\s*[:\-]?\s*/i, "")
    .replace(/\S+@\S+/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length > 72) return "";
  if (/\.com\b/i.test(cleaned)) return "";
  if (/[.!?].+[.!?]/.test(cleaned)) return "";
  if (FIELD_NOISE_PATTERN.test(cleaned) && !COMPANY_SUFFIX_PATTERN.test(cleaned)) return "";

  return cleaned;
};

const isSkillToken = (token: string): boolean => {
  const clean = normalizeInlineValue(token).toLowerCase();
  if (!clean) return false;
  if (clean.length < 2 || clean.length > 32) return false;
  if (SKILL_STOPWORDS.has(clean)) return false;
  if (/^\d+$/.test(clean)) return false;
  if (clean.split(/\s+/).length > 4) return false;
  if (FIELD_NOISE_PATTERN.test(clean)) return false;
  return /^[a-z0-9+.#\-/ ]+$/i.test(clean);
};

const sanitizeSkillsList = (skills: string[]): string[] =>
  uniqueStrings((Array.isArray(skills) ? skills : []).map((item) => normalizeInlineValue(item).toLowerCase()).filter(isSkillToken)).slice(0, 24);

const splitMulti = (value: string): string[] => {
  if (!value) return [];
  return sanitizeSkillsList(String(value).split(/[|,;/]+/g));
};

const deriveNameFromEmail = (email: string): string => {
  if (!email.includes("@")) return "";
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const clampExperience = (value: number | null): number | null => {
  if (value == null || !Number.isFinite(value)) return null;
  const bounded = Math.max(0, Math.min(50, value));
  return Math.round(bounded * 10) / 10;
};

const extractExperience = (value: string): number | null => {
  const text = String(value || "").toLowerCase();
  if (!text) return null;

  const totalMatch = text.match(
    /(?:total\s+experience|experience)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|year|yrs|yr|y)\s*(?:(\d{1,2})\s*(?:months|month|mos))?/i
  );
  if (totalMatch) {
    const years = Number(totalMatch[1]);
    const months = totalMatch[2] ? Number(totalMatch[2]) : 0;
    return clampExperience(Number.isFinite(years) ? years + months / 12 : null);
  }

  const yearMonthMatch = text.match(/(\d{1,2})\s*(?:years|year|yrs|yr)\s*(\d{1,2})\s*(?:months|month|mos)/i);
  if (yearMonthMatch) {
    const years = Number(yearMonthMatch[1]);
    const months = Number(yearMonthMatch[2]);
    return clampExperience(Number.isFinite(years) ? years + months / 12 : null);
  }

  const rangeMatch = text.match(/(\d{1,2}(?:\.\d+)?)\s*(?:-|to)\s*(\d{1,2}(?:\.\d+)?)\s*(?:years|year|yrs|yr|y)/i);
  if (rangeMatch) {
    const high = Number(rangeMatch[2]);
    return clampExperience(Number.isFinite(high) ? high : null);
  }

  const shortMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|year|yrs|yr|y)\b/i);
  if (shortMatch) {
    const years = Number(shortMatch[1]);
    return clampExperience(Number.isFinite(years) ? years : null);
  }

  return null;
};

const extractSkillsFromSections = (lines: string[]): string[] => {
  const source = Array.isArray(lines) ? lines : [];
  const collected: string[] = [];

  for (let i = 0; i < source.length; i += 1) {
    const line = normalizeInlineValue(source[i]);
    if (!/^(technical\s+)?skills?|core\s+skills?|skills?\s*set|tech\s*stack|competencies|tools/i.test(line)) {
      continue;
    }

    const sectionLines: string[] = [];
    for (let j = i; j < Math.min(source.length, i + 9); j += 1) {
      const current = normalizeInlineValue(source[j]);
      if (!current) continue;
      if (j > i && RESUME_HEADING_PATTERN.test(current)) break;
      sectionLines.push(current);
    }

    sectionLines.forEach((entry) => {
      const withoutPrefix = entry.replace(/^(technical\s+)?skills?|core\s+skills?|skills?\s*set|tech\s*stack|competencies|tools\s*[:\-]?\s*/i, "");
      withoutPrefix
        .split(/[|,;/]+/g)
        .map((token) => normalizeInlineValue(token))
        .filter(isSkillToken)
        .forEach((token) => collected.push(token.toLowerCase()));
    });
  }

  return sanitizeSkillsList(collected);
};

const extractSkills = (value: string, lines: string[] = []): string[] => {
  const lower = String(value || "").toLowerCase();
  const matchedCatalog = SKILL_KEYWORDS.filter((skill) => lower.includes(skill.toLowerCase()));
  const fromSections = extractSkillsFromSections(lines);
  return sanitizeSkillsList([...fromSections, ...matchedCatalog]);
};

const findLikelyName = (lines: string[]): string => {
  for (const line of lines.slice(0, 12)) {
    if (line.length < 2 || line.length > 70) continue;
    if (/@/.test(line)) continue;
    if (/\d/.test(line) && !/\s/.test(line)) continue;
    if (/curriculum|resume|cv|profile|summary/i.test(line)) continue;

    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 5) {
      return normalizeInlineValue(line);
    }
  }

  return "";
};

const buildFallbackProfileSummary = (input: {
  text: string;
  currentRole: string;
  experienceYears: number | null;
  skills: string[];
}): string => {
  const parts = [
    input.currentRole ? `Role: ${sanitizeRole(input.currentRole)}` : "",
    input.experienceYears != null ? `Experience: ${input.experienceYears} years` : "",
    input.skills.length ? `Skills: ${input.skills.slice(0, 8).join(", ")}` : ""
  ].filter(Boolean);

  if (parts.length) return parts.join(" | ");

  const cleaned = normalizeInlineValue(input.text);
  return cleaned.slice(0, 220);
};

const findLikelyLocation = (lines: string[]): string => {
  for (const raw of lines.slice(0, 35)) {
    const line = normalizeInlineValue(raw);
    const labeled = line.match(/(?:location|current location|based in|address)\s*[:\-]?\s*(.+)$/i);
    if (labeled) {
      const candidate = sanitizeLocation(labeled[1]);
      if (candidate) return candidate;
    }

    const cityState = line.match(/\b([A-Za-z]{3,}(?:\s+[A-Za-z]{2,}){0,2},\s*[A-Za-z]{2,})\b/);
    if (cityState) {
      const candidate = sanitizeLocation(cityState[1]);
      if (candidate) return candidate;
    }

    const low = line.toLowerCase();
    const directCity = LOCATION_HINTS.find((city) => low.includes(city));
    if (directCity) {
      return toTitleCase(directCity);
    }
  }
  return "";
};

const findLikelyEducation = (lines: string[]): string => {
  const pattern = /\b(B\.?Tech|M\.?Tech|BCA|MCA|MBA|BSc|MSc|Bachelor|Master|PhD)\b/i;
  for (const line of lines.slice(0, 40)) {
    if (pattern.test(line)) return sanitizeEducation(line);
  }
  return "";
};

const findLikelyCompany = (lines: string[]): string => {
  for (const raw of lines.slice(0, 50)) {
    const line = normalizeInlineValue(raw);
    if (!line) continue;

    const labeled = line.match(/(?:current company|present company|company|organization|employer|currently at|working at)\s*[:\-]?\s*(.+)$/i);
    if (labeled) {
      const candidate = sanitizeCompany(labeled[1]);
      if (candidate) return candidate;
    }

    if (line.split(/\s+/).length <= 8 && COMPANY_SUFFIX_PATTERN.test(line)) {
      const candidate = sanitizeCompany(line);
      if (candidate) return candidate;
    }
  }
  return "";
};

const findLikelyRole = (lines: string[]): string => {
  for (const line of lines.slice(0, 24)) {
    const normalized = line.toLowerCase();
    const hit = ROLE_KEYWORDS.find((role) => normalized.includes(role));
    if (hit) return toTitleCase(hit);
  }

  return "";
};

const inferRole = (text: string): string => {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return "";

  const hit = ROLE_KEYWORDS.find((role) => normalized.includes(role));
  if (hit) return toTitleCase(hit);

  if (normalized.includes("engineer")) return "Software Engineer";
  if (normalized.includes("developer")) return "Software Developer";
  if (normalized.includes("recruit")) return "Recruiter";
  if (normalized.includes("designer")) return "Designer";
  if (normalized.includes("manager")) return "Manager";
  if (normalized.includes("analyst")) return "Analyst";

  return "";
};

const toTitleCase = (value: string): string =>
  String(value || "")
    .split(/\s+/g)
    .map((word) => (word.includes(".") ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ")
    .trim();

const mapAiStructuredDataToCandidate = (
  parsed: ResumeStructuredData,
  fileName: string,
  resumeText: string
): CandidateInput => {
  const normalized = normalizeResumeExtraction(parsed, resumeText);
  const skills = sanitizeSkillsList(normalized.skills || []);
  const experienceYears = clampExperience(normalized.totalExperienceYears ?? extractExperience(resumeText));
  const currentRole = sanitizeRole(normalized.currentRole || inferRole(`${skills.join(" ")} ${resumeText}`));
  const currentCompany = sanitizeCompany(normalized.currentCompany || "");
  const location = sanitizeLocation(normalized.location || "");
  const profileSummary =
    normalizeInlineValue(normalized.profileSummary) ||
    buildAiProfileSummary(parsed, skills, currentRole, currentCompany, experienceYears);
  const keywords = uniqueStrings(normalized.keywords);

  return {
    name: normalizeInlineValue(normalized.fullName || "").slice(0, 90) || "Unknown Candidate",
    email: normalized.email?.trim() || "",
    phone: normalized.phone?.trim() || "",
    recruiter: "Bulk Upload",
    stage: "Identified",
    jobId: "",
    currentRole,
    skills,
    experienceYears,
    profileSummary,
    keywords,
    location,
    education: sanitizeEducation(uniqueStrings(parsed.education || []).join(" | ")),
    currentCompany,
    source: `Resume Upload (${fileName})`,
    parsingStatus: "COMPLETED",
    parsedData: {
      parser: "AI",
      model: env.openAiModel,
      sourceFileName: fileName,
      resumeText: resumeText.slice(0, 40000),
      ...normalized,
      rawAiExtraction: parsed
    }
  };
};

const buildAiProfileSummary = (
  parsed: ResumeStructuredData,
  skills: string[],
  currentRole: string,
  currentCompany: string,
  experienceYears: number | null
): string => {
  const parts = [
    currentRole ? `Role: ${currentRole}` : "",
    currentCompany ? `Company: ${currentCompany}` : "",
    experienceYears != null ? `Experience: ${experienceYears} years` : "",
    skills.length ? `Skills: ${skills.slice(0, 10).join(", ")}` : ""
  ].filter(Boolean);

  return parts.join(" | ").trim();
};

export const cvParserService = new CvParserService();
