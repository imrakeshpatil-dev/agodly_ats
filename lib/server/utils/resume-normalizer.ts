import { uniqueStrings } from "./text";

export interface ResumeExtractionSeed {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  skills?: string[];
  totalExperienceYears?: number | null;
  currentRole?: string;
  currentCompany?: string;
  education?: string[];
  previousCompanies?: string[];
  linkedin?: string;
  github?: string;
}

export interface NormalizedResumeData {
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
  profileSummary: string;
  keywords: string[];
  quality: {
    hasCoreIdentity: boolean;
    hasContact: boolean;
    hasRoleSignal: boolean;
    hasSkillSignal: boolean;
  };
}

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
  "salesforce",
  "mulesoft",
  "ci/cd",
  "devops",
  "selenium",
  "cypress",
  "playwright",
  "recruitment",
  "talent acquisition"
];

const ROLE_KEYWORDS = [
  "software engineer",
  "backend engineer",
  "frontend engineer",
  "full stack engineer",
  "devops engineer",
  "data engineer",
  "qa engineer",
  "recruiter",
  "talent acquisition specialist",
  "product manager",
  "project manager",
  "business analyst",
  "designer"
];

const LOCATION_HINTS = [
  "bangalore",
  "bengaluru",
  "hyderabad",
  "pune",
  "mumbai",
  "delhi",
  "gurgaon",
  "gurugram",
  "noida",
  "chennai",
  "kolkata",
  "ahmedabad",
  "remote",
  "india"
];

const FIELD_NOISE_PATTERN =
  /\b(responsibilit|project|client|team|develop|work(ed)?|implement|using|technology|framework|skills?|experience|objective|summary)\b/i;
const COMPANY_SUFFIX_PATTERN =
  /\b(ltd|limited|llp|inc|corp|corporation|pvt|private|technologies|technology|solutions|systems|consulting|services|labs?)\b/i;

const cleanText = (rawText: string): string =>
  String(rawText || "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeInline = (value: string): string =>
  String(value || "")
    .replace(/[\u2022•▪◆■]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const titleCase = (value: string): string =>
  String(value || "")
    .split(/\s+/g)
    .filter(Boolean)
    .map((word) => (word.includes(".") ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ")
    .trim();

const clampExperience = (value: number | null): number | null => {
  if (value == null || !Number.isFinite(value)) return null;
  const bounded = Math.max(0, Math.min(50, value));
  return Math.round(bounded * 10) / 10;
};

const extractExperience = (text: string): number | null => {
  const source = String(text || "").toLowerCase();
  if (!source) return null;

  const totalMatch = source.match(
    /(?:total\s+experience|experience)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|year|yrs|yr|y)\s*(?:(\d{1,2})\s*(?:months|month|mos))?/i
  );
  if (totalMatch) {
    const years = Number(totalMatch[1]);
    const months = totalMatch[2] ? Number(totalMatch[2]) : 0;
    return clampExperience(Number.isFinite(years) ? years + months / 12 : null);
  }

  const shortMatch = source.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|year|yrs|yr|y)\b/i);
  if (shortMatch) {
    const years = Number(shortMatch[1]);
    return clampExperience(Number.isFinite(years) ? years : null);
  }

  return null;
};

const sanitizeEmail = (value: string): string => {
  const normalized = normalizeInline(value).toLowerCase();
  const match = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match ? match[0] : "";
};

const sanitizePhone = (value: string): string => {
  const source = normalizeInline(value);
  const match = source.match(/(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,14}/);
  if (!match) return "";
  return match[0].replace(/[^\d+]/g, "").slice(0, 16);
};

const sanitizeRole = (value: string): string => normalizeInline(value).slice(0, 90);

const sanitizeEducation = (value: string): string => normalizeInline(value).slice(0, 160);

const sanitizeLocation = (value: string): string => {
  const cleaned = normalizeInline(value)
    .replace(/^(location|current location|address|based in)\s*[:\-]?\s*/i, "")
    .replace(/\S+@\S+/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length > 52) return "";
  if (/\.com\b/i.test(cleaned)) return "";
  if (FIELD_NOISE_PATTERN.test(cleaned)) return "";

  const low = cleaned.toLowerCase();
  if (!LOCATION_HINTS.some((item) => low.includes(item)) && !/,/.test(cleaned) && cleaned.split(/\s+/).length > 3) {
    return "";
  }

  return cleaned.replace(/\s*,\s*/g, ", ");
};

const sanitizeCompany = (value: string): string => {
  const cleaned = normalizeInline(value)
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

const inferRole = (text: string): string => {
  const normalized = String(text || "").toLowerCase();
  const exact = ROLE_KEYWORDS.find((role) => normalized.includes(role));
  if (exact) return titleCase(exact);
  if (normalized.includes("engineer")) return "Software Engineer";
  if (normalized.includes("developer")) return "Software Developer";
  if (normalized.includes("recruit")) return "Recruiter";
  if (normalized.includes("designer")) return "Designer";
  if (normalized.includes("manager")) return "Manager";
  return "";
};

const extractSkills = (resumeText: string, inputSkills: string[]): string[] => {
  const text = String(resumeText || "").toLowerCase();
  const inferred = SKILL_KEYWORDS.filter((item) => text.includes(item.toLowerCase()));
  const merged = uniqueStrings(
    [...(Array.isArray(inputSkills) ? inputSkills : []), ...inferred]
      .map((item) => normalizeInline(item).toLowerCase())
      .filter((item) => item.length >= 2 && item.length <= 32)
      .filter((item) => !FIELD_NOISE_PATTERN.test(item))
  );
  return merged.slice(0, 24);
};

const findLikelyName = (resumeText: string): string => {
  const lines = cleanText(resumeText)
    .split(/\r?\n/)
    .map((line) => normalizeInline(line))
    .filter(Boolean)
    .slice(0, 12);

  for (const line of lines) {
    if (line.length < 2 || line.length > 70) continue;
    if (/@/.test(line)) continue;
    if (/curriculum|resume|cv|profile|summary/i.test(line)) continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 5) return line;
  }

  return "";
};

const findLikelyLocation = (resumeText: string): string => {
  const lines = cleanText(resumeText)
    .split(/\r?\n/)
    .map((line) => normalizeInline(line))
    .filter(Boolean);

  for (const line of lines.slice(0, 40)) {
    const labeled = line.match(/(?:location|current location|based in|address)\s*[:\-]?\s*(.+)$/i);
    if (labeled) {
      const candidate = sanitizeLocation(labeled[1]);
      if (candidate) return candidate;
    }
    const low = line.toLowerCase();
    const city = LOCATION_HINTS.find((item) => low.includes(item));
    if (city) return titleCase(city);
  }
  return "";
};

const findLikelyCompany = (resumeText: string): string => {
  const lines = cleanText(resumeText)
    .split(/\r?\n/)
    .map((line) => normalizeInline(line))
    .filter(Boolean);

  for (const line of lines.slice(0, 60)) {
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

const deriveProfileSummary = (input: {
  role: string;
  company: string;
  experienceYears: number | null;
  skills: string[];
}): string => {
  const parts = [
    input.role ? `Role: ${input.role}` : "",
    input.company ? `Company: ${input.company}` : "",
    input.experienceYears != null ? `Experience: ${input.experienceYears} years` : "",
    input.skills.length ? `Skills: ${input.skills.slice(0, 10).join(", ")}` : ""
  ].filter(Boolean);

  return parts.join(" | ").trim().slice(0, 320);
};

export const normalizeResumeExtraction = (
  seed: ResumeExtractionSeed,
  resumeText: string
): NormalizedResumeData => {
  const text = cleanText(resumeText);
  const email = sanitizeEmail(seed.email || text);
  const phone = sanitizePhone(seed.phone || text);
  const inferredExperience = extractExperience(text);
  const experienceYears = clampExperience(
    seed.totalExperienceYears == null ? inferredExperience : Number(seed.totalExperienceYears)
  );
  const location = sanitizeLocation(seed.location || findLikelyLocation(text));
  const currentCompany = sanitizeCompany(seed.currentCompany || findLikelyCompany(text));
  const skills = extractSkills(text, seed.skills || []);
  const currentRole = sanitizeRole(seed.currentRole || inferRole(`${skills.join(" ")} ${text}`));
  const fullName = normalizeInline(seed.fullName || findLikelyName(text)).slice(0, 90);
  const education = uniqueStrings((seed.education || []).map((item) => sanitizeEducation(item))).slice(0, 8);
  const previousCompanies = uniqueStrings((seed.previousCompanies || []).map((item) => sanitizeCompany(item))).filter(Boolean).slice(0, 12);
  const linkedin = normalizeInline(seed.linkedin || "").slice(0, 220);
  const github = normalizeInline(seed.github || "").slice(0, 220);

  const profileSummary = deriveProfileSummary({
    role: currentRole,
    company: currentCompany,
    experienceYears,
    skills
  });

  const keywords = uniqueStrings([...skills, ...education, ...previousCompanies, currentRole, location]).slice(0, 40);

  return {
    fullName: fullName || "Unknown Candidate",
    email,
    phone,
    location,
    skills,
    totalExperienceYears: experienceYears,
    currentRole,
    currentCompany,
    education,
    previousCompanies,
    linkedin,
    github,
    profileSummary,
    keywords,
    quality: {
      hasCoreIdentity: Boolean(fullName && fullName !== "Unknown Candidate"),
      hasContact: Boolean(email || phone),
      hasRoleSignal: Boolean(currentRole || currentCompany || experienceYears != null),
      hasSkillSignal: skills.length > 0
    }
  };
};
