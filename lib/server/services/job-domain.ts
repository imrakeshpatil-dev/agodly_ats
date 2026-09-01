import { AppError } from "../middleware/error.middleware";

export const JOB_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "ON_HOLD",
  "FILLED",
  "CLOSED",
  "CANCELLED",
  "ARCHIVED"
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_PRIORITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW"] as const;
export const WORK_MODES = ["ONSITE", "HYBRID", "REMOTE"] as const;
export const JOB_VISIBILITY_SCOPES = ["DIRECT_TEAM", "ORGANIZATION"] as const;
export type JobVisibilityScope = (typeof JOB_VISIBILITY_SCOPES)[number];

type JobRecord = Record<string, unknown>;

const TECH_FAMILIES: Array<{ key: string; label: string; terms: string[] }> = [
  { key: "salesforce", label: "Salesforce", terms: ["salesforce", "apex", "lightning", "mulesoft", "soql", "cpq"] },
  { key: "sap", label: "SAP", terms: ["sap", "abap", "s/4hana", "hana", "successfactors"] },
  { key: "workday", label: "Workday", terms: ["workday", "hcm", "workday studio"] },
  { key: "java-spring", label: "Java / Spring", terms: ["java", "spring", "spring boot", "hibernate"] },
  { key: "react-node", label: "React / Node.js", terms: ["react", "next.js", "nextjs", "node", "node.js", "typescript", "javascript"] },
  { key: "cloud-devops", label: "Cloud / DevOps", terms: ["aws", "azure", "gcp", "devops", "docker", "kubernetes", "terraform", "ci/cd"] },
  { key: "data-engineering", label: "Data Engineering", terms: ["data engineer", "spark", "databricks", "etl", "snowflake", "airflow", "kafka"] },
  { key: "oracle", label: "Oracle", terms: ["oracle", "pl/sql", "fusion", "ebs"] }
];

const STATUS_ALIASES: Record<string, JobStatus> = {
  open: "ACTIVE",
  active: "ACTIVE",
  published: "ACTIVE",
  paused: "PAUSED",
  hold: "ON_HOLD",
  "on hold": "ON_HOLD",
  on_hold: "ON_HOLD",
  filled: "FILLED",
  closed: "CLOSED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
  archived: "ARCHIVED",
  draft: "DRAFT"
};

const ALLOWED_TRANSITIONS: Record<JobStatus, Set<JobStatus>> = {
  DRAFT: new Set(["ACTIVE", "CANCELLED", "ARCHIVED"]),
  ACTIVE: new Set(["PAUSED", "ON_HOLD", "FILLED", "CLOSED", "CANCELLED", "ARCHIVED"]),
  PAUSED: new Set(["ACTIVE", "ON_HOLD", "CLOSED", "CANCELLED", "ARCHIVED"]),
  ON_HOLD: new Set(["ACTIVE", "PAUSED", "CLOSED", "CANCELLED", "ARCHIVED"]),
  FILLED: new Set(["ACTIVE", "ARCHIVED"]),
  CLOSED: new Set(["ACTIVE", "ARCHIVED"]),
  CANCELLED: new Set(["DRAFT", "ACTIVE", "ARCHIVED"]),
  ARCHIVED: new Set(["DRAFT", "ACTIVE"])
};

export interface NormalizedJobInput {
  title: string;
  clientId: string | null;
  description: string | null;
  jdText: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  minExperience: number | null;
  maxExperience: number | null;
  locations: string[];
  location: string | null;
  workMode: string | null;
  remoteScope: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  primaryTimeZone: string | null;
  supportedTimeZones: string[];
  workingHours: string | null;
  minTimeZoneOverlap: number | null;
  jobType: string | null;
  openings: number;
  currency: string;
  minCtcLpa: number | null;
  maxCtcLpa: number | null;
  minBillingRate: number | null;
  maxBillingRate: number | null;
  billingRateType: string | null;
  compensationUndisclosed: boolean;
  priority: string;
  visibilityScope: JobVisibilityScope;
  assignedRecruiterId: string | null;
  ownerUserId: string | null;
  targetClosureAt: Date | null;
  status: JobStatus;
}

export const normalizeJobStatus = (value: unknown): JobStatus => {
  const normalized = String(value || "DRAFT").trim().toLowerCase().replace(/-/g, "_");
  return STATUS_ALIASES[normalized] || "DRAFT";
};

export const normalizeJobVisibilityScope = (value: unknown): JobVisibilityScope => {
  const normalized = String(value || "DIRECT_TEAM").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return normalized === "ORGANIZATION" || normalized === "ORGANISATION" ? "ORGANIZATION" : "DIRECT_TEAM";
};

export const assertJobStatusTransition = (fromValue: unknown, toValue: unknown): JobStatus => {
  const from = normalizeJobStatus(fromValue);
  const to = normalizeJobStatus(toValue);
  if (from === to) return to;
  if (!ALLOWED_TRANSITIONS[from].has(to)) {
    throw new AppError(`Job status cannot move directly from ${formatJobStatus(from)} to ${formatJobStatus(to)}`, 409);
  }
  return to;
};

export const normalizeJobInput = (
  input: JobRecord,
  options: { existingStatus?: unknown; defaultOwnerUserId?: string; allowIncompleteActive?: boolean } = {}
): NormalizedJobInput => {
  const status = normalizeJobStatus(input.status ?? options.existingStatus ?? "DRAFT");
  const workMode = normalizeEnum(input.workMode, WORK_MODES, "HYBRID");
  const locations = uniqueStrings(toStringArray(input.locations ?? input.location), 12, 90);
  const primaryTimeZone = nullableLine(input.primaryTimeZone, 80);
  const supportedTimeZones = uniqueStrings(input.supportedTimeZones, 8, 80);

  [primaryTimeZone, ...supportedTimeZones].filter(Boolean).forEach((timeZone) => {
    if (!isValidTimeZone(timeZone as string)) {
      throw new AppError(`Invalid IANA time zone: ${timeZone}`, 400);
    }
  });

  const normalized: NormalizedJobInput = {
    title: requiredLine(input.title, "Job title", 140),
    clientId: nullableLine(input.clientId, 100),
    description: nullableText(input.description, 20_000),
    jdText: nullableText(input.jdText ?? input.description, 30_000),
    requiredSkills: uniqueStrings(input.requiredSkills, 30, 80),
    preferredSkills: uniqueStrings(input.preferredSkills, 30, 80),
    minExperience: nullableNumber(input.minExperience ?? input.expMin, 0, 80),
    maxExperience: nullableNumber(input.maxExperience ?? input.expMax, 0, 80),
    locations,
    location: locations.join(", ") || nullableLine(input.location, 500),
    workMode,
    remoteScope: nullableLine(input.remoteScope, 80),
    country: nullableLine(input.country, 80),
    state: nullableLine(input.state, 80),
    city: nullableLine(input.city, 80),
    primaryTimeZone,
    supportedTimeZones,
    workingHours: nullableLine(input.workingHours, 120),
    minTimeZoneOverlap: nullableInteger(input.minTimeZoneOverlap, 0, 24),
    jobType: nullableLine(input.jobType, 40),
    openings: nullableInteger(input.openings, 1, 10_000) ?? 1,
    currency: nullableLine(input.currency, 8) || "INR",
    minCtcLpa: nullableNumber(input.minCtcLpa ?? input.ctcMin, 0, 1_000_000),
    maxCtcLpa: nullableNumber(input.maxCtcLpa ?? input.ctcMax, 0, 1_000_000),
    minBillingRate: nullableNumber(input.minBillingRate ?? input.rateMin, 0, 1_000_000_000),
    maxBillingRate: nullableNumber(input.maxBillingRate ?? input.rateMax, 0, 1_000_000_000),
    billingRateType: nullableLine(input.billingRateType, 30),
    compensationUndisclosed: Boolean(input.compensationUndisclosed ?? input.ctcNotDisclosed),
    priority: normalizeEnum(input.priority, JOB_PRIORITIES, "NORMAL") || "NORMAL",
    visibilityScope: normalizeJobVisibilityScope(input.visibilityScope),
    assignedRecruiterId: nullableLine(input.assignedRecruiterId, 100),
    ownerUserId: nullableLine(input.ownerUserId, 100) || options.defaultOwnerUserId || null,
    targetClosureAt: nullableDate(input.targetClosureAt),
    status
  };

  if (normalized.minExperience !== null && normalized.maxExperience !== null && normalized.minExperience > normalized.maxExperience) {
    throw new AppError("Minimum experience cannot exceed maximum experience", 400);
  }

  if (status === "ACTIVE" && !options.allowIncompleteActive) {
    if (!normalized.clientId) throw new AppError("Client is required before publishing a job", 400);
    if (!normalized.requiredSkills.length) throw new AppError("At least one required skill is required before publishing a job", 400);
    if (!normalized.primaryTimeZone) throw new AppError("Primary time zone is required before publishing a job", 400);
    if (workMode !== "REMOTE" && !normalized.locations.length) {
      throw new AppError("At least one city is required for onsite or hybrid jobs", 400);
    }
  }

  return normalized;
};

export const formatJobStatus = (value: unknown): string =>
  normalizeJobStatus(value)
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const classifyTechnologyFamily = (job: JobRecord): { key: string; label: string; skills: string[] } => {
  const skills = uniqueStrings(job.requiredSkills, 30, 80);
  const haystack = `${String(job.title || "")} ${skills.join(" ")} ${String(job.jdText || job.description || "")}`.toLowerCase();
  let best = TECH_FAMILIES[0];
  let bestScore = 0;

  TECH_FAMILIES.forEach((family) => {
    const score = family.terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    if (score > bestScore) {
      best = family;
      bestScore = score;
    }
  });

  if (!bestScore) {
    const fallback = skills[0] || String(job.title || "General").split(/\s+/).slice(0, 2).join(" ");
    return { key: slugify(fallback || "general"), label: fallback || "General", skills };
  }
  return { key: best.key, label: best.label, skills };
};

export const buildDemandInsights = (
  jobs: JobRecord[],
  candidates: JobRecord[],
  now = new Date()
): Array<Record<string, unknown>> => {
  const groups = new Map<string, { label: string; jobs: JobRecord[]; skills: Set<string> }>();

  jobs.forEach((job) => {
    if (normalizeJobStatus(job.status) === "DRAFT") return;
    const family = classifyTechnologyFamily(job);
    const group = groups.get(family.key) || { label: family.label, jobs: [], skills: new Set<string>() };
    group.jobs.push(job);
    family.skills.forEach((skill) => group.skills.add(skill));
    groups.set(family.key, group);
  });

  return [...groups.entries()]
    .map(([key, group]) => {
      const sorted = [...group.jobs].sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
      const jobs3m = sorted.filter((job) => isWithinMonths(job.createdAt, now, 3));
      const jobs6m = sorted.filter((job) => isWithinMonths(job.createdAt, now, 6));
      const jobs12m = sorted.filter((job) => isWithinMonths(job.createdAt, now, 12));
      const openings12m = jobs12m.reduce((total, job) => total + Math.max(1, Number(job.openings || 1)), 0);
      const requestedSkills = [...group.skills];
      const availableCandidates = candidates.filter((candidate) => candidateMatchesSkills(candidate, requestedSkills)).length;
      const recommendedPoolSize = Math.max(5, Math.ceil(Math.max(openings12m, jobs12m.length) * 1.5));
      const supplyGap = Math.max(0, recommendedPoolSize - availableCandidates);
      const intervals = sorted.slice(1).map((job, index) =>
        Math.max(1, Math.round((toTimestamp(job.createdAt) - toTimestamp(sorted[index].createdAt)) / 86_400_000))
      );
      const averageFrequencyDays = intervals.length
        ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length)
        : null;
      const fillDurations = sorted
        .map((job) => {
          if (!job.closedAt) return null;
          return Math.max(0, Math.round((toTimestamp(job.closedAt) - toTimestamp(job.createdAt)) / 86_400_000));
        })
        .filter((value): value is number => value !== null && Number.isFinite(value));
      const lastJob = sorted.at(-1);
      const lastRequirementAt = lastJob ? toIsoDate(lastJob.createdAt) : null;
      const likelyNextRequirementAt = averageFrequencyDays && lastJob
        ? new Date(toTimestamp(lastJob.createdAt) + averageFrequencyDays * 86_400_000).toISOString()
        : null;

      return {
        key,
        label: group.label,
        skills: requestedSkills.slice(0, 12),
        jobs3m: jobs3m.length,
        jobs6m: jobs6m.length,
        jobs12m: jobs12m.length,
        openings12m,
        totalJobs: sorted.length,
        averageFrequencyDays,
        averageTimeToFillDays: fillDurations.length
          ? Math.round(fillDurations.reduce((sum, value) => sum + value, 0) / fillDurations.length)
          : null,
        availableCandidates,
        recommendedPoolSize,
        supplyGap,
        commonLocations: topValues(sorted.flatMap((job) => toStringArray(job.locations ?? job.location)), 3),
        commonTimeZones: topValues(sorted.flatMap((job) => toStringArray(job.supportedTimeZones ?? job.primaryTimeZone)), 3),
        commonClientIds: topValues(sorted.map((job) => String(job.clientId || "")).filter(Boolean), 3),
        lastRequirementAt,
        likelyNextRequirementAt,
        sourceJobId: lastJob ? String(lastJob.id || "") : ""
      };
    })
    .sort((a, b) => Number(b.jobs12m) - Number(a.jobs12m) || Number(b.totalJobs) - Number(a.totalJobs));
};

export const candidateMatchesSkills = (candidate: JobRecord, skills: string[]): boolean => {
  const required = skills.map(normalizeToken).filter(Boolean);
  if (!required.length) return false;
  const candidateText = [
    ...toStringArray(candidate.skills),
    ...toStringArray(candidate.keywords),
    String(candidate.currentRole || ""),
    String(candidate.profileSummary || "")
  ].join(" ").toLowerCase();
  return required.some((skill) => candidateText.includes(skill));
};

const normalizeEnum = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] => {
  const normalized = String(value || fallback).trim().toUpperCase().replace(/[ -]+/g, "_");
  return (allowed as readonly string[]).includes(normalized) ? normalized as T[number] : fallback;
};

const requiredLine = (value: unknown, label: string, max: number): string => {
  const clean = String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
  if (!clean) throw new AppError(`${label} is required`, 400);
  return clean;
};

const nullableLine = (value: unknown, max: number): string | null => {
  const clean = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  return clean || null;
};

const nullableText = (value: unknown, max: number): string | null => {
  const clean = String(value ?? "").trim().slice(0, max);
  return clean || null;
};

const nullableNumber = (value: unknown, min: number, max: number): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new AppError("A numeric job field is outside its allowed range", 400);
  return number;
};

const nullableInteger = (value: unknown, min: number, max: number): number | null => {
  const number = nullableNumber(value, min, max);
  return number === null ? null : Math.round(number);
};

const nullableDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new AppError("Target closure date is invalid", 400);
  return date;
};

const isValidTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const uniqueStrings = (value: unknown, limit: number, maxLength: number): string[] => {
  const seen = new Set<string>();
  return toStringArray(value)
    .map((item) => item.trim().replace(/\s+/g, " ").slice(0, maxLength))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/[,;|]/g).map((item) => item.trim()).filter(Boolean);
  return [];
};

const normalizeToken = (value: string): string => value.trim().toLowerCase();
const slugify = (value: string): string => normalizeToken(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";
const toTimestamp = (value: unknown): number => {
  const timestamp = new Date(String(value || 0)).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};
const toIsoDate = (value: unknown): string | null => {
  const timestamp = toTimestamp(value);
  return timestamp ? new Date(timestamp).toISOString() : null;
};
const isWithinMonths = (value: unknown, now: Date, months: number): boolean => {
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - months);
  const timestamp = toTimestamp(value);
  return timestamp >= threshold.getTime() && timestamp <= now.getTime();
};
const topValues = (values: string[], limit: number): string[] => {
  const counts = new Map<string, { label: string; count: number }>();
  values.map((value) => value.trim()).filter(Boolean).forEach((value) => {
    const key = value.toLowerCase();
    const current = counts.get(key) || { label: value, count: 0 };
    current.count += 1;
    counts.set(key, current);
  });
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit).map((item) => item.label);
};
