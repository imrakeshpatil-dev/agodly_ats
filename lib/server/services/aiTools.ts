import { env } from "../config/env";
import { AppError } from "../middleware/error.middleware";
import { candidateStoreService } from "./candidate-store.service";
import { CandidateRecord } from "../types/candidate";
import { getAIProvider } from "./ai/aiProviderFactory";

export interface CandidateSearchFilters {
  skill?: string;
  skills?: string[];
  keywords?: string[];
  query?: string;
  requireAllSkills?: boolean;
  experience?: number;
  location?: string;
  company?: string;
  role?: string;
  limit?: number;
}

export interface AIToolResponse {
  explanation: string;
  results: Record<string, unknown>[];
}

export interface ATSheetQueryInput {
  sheet?: string;
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface JobMatchInput {
  jobDescription: string;
  keywords?: string;
  topK?: number;
}

type PrismaClientLike = {
  candidate?: {
    findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    findUnique?: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  };
};

const SKILL_CATALOG = [
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
  "microservices",
  "devops",
  "recruitment",
  "talent acquisition",
  "sourcing",
  "communication"
];
const MATCH_STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "from",
  "into",
  "this",
  "that",
  "will",
  "your",
  "their",
  "have",
  "has",
  "must",
  "years",
  "year",
  "experience",
  "candidate",
  "candidates",
  "role",
  "job",
  "description",
  "skills",
  "required",
  "preferred"
]);

let prismaClient: PrismaClientLike | null = null;
let prismaInitAttempted = false;

const getPrismaClient = (): PrismaClientLike | null => {
  if (prismaInitAttempted) return prismaClient;
  prismaInitAttempted = true;

  try {
    // Use Prisma when available. Fallback to local JSON store otherwise.
    const prismaPkg = require("@prisma/client") as { PrismaClient: new () => PrismaClientLike };
    prismaClient = new prismaPkg.PrismaClient();
  } catch {
    prismaClient = null;
  }

  return prismaClient;
};

const normalizeSkill = (value: string): string => String(value || "").trim().toLowerCase();
const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const normalizeMatchText = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const splitMulti = (value: string): string[] =>
  String(value || "")
    .split(/[|,;/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
const uniqueNormalized = (items: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];
  items.forEach((item) => {
    const normalized = normalizeSkill(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
};
const toQueryTerms = (value: string): string[] =>
  normalizeMatchText(value)
    .split(/\s+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
const uniqueTerms = (items: string[]): string[] => {
  const seen = new Set<string>();
  const rows: string[] = [];
  items.forEach((item) => {
    const normalized = normalizeMatchText(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    rows.push(normalized);
  });
  return rows;
};
const uniqueLowerItems = (items: string[]): string[] => {
  const seen = new Set<string>();
  const rows: string[] = [];
  items.forEach((item) => {
    const value = String(item || "").trim().toLowerCase();
    if (!value || seen.has(value)) return;
    seen.add(value);
    rows.push(value);
  });
  return rows;
};
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const trimSnippet = (value: unknown, maxLength = 320): string => String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
const toStringArraySafe = (value: unknown, max = 20): string[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, max);
const toOptionalInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
};
const normalizeConfidence = (value: unknown, fallback: "High" | "Medium" | "Low"): "High" | "Medium" | "Low" => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return fallback;
};

const getConfidenceLabel = (
  score: number,
  matchedMustHaveCount: number,
  mustHaveCount: number,
  experienceGapYears: number
): "High" | "Medium" | "Low" => {
  const coverage = mustHaveCount ? matchedMustHaveCount / mustHaveCount : 1;
  if (score >= 80 && coverage >= 0.65 && experienceGapYears <= 0) return "High";
  if (score >= 55 && coverage >= 0.35 && experienceGapYears <= 2) return "Medium";
  return "Low";
};

const buildConfidenceExplanation = (input: {
  score: number;
  matchedTermsCount: number;
  requiredTermsCount: number;
  matchedMustHaveCount: number;
  mustHaveCount: number;
  experienceGapYears: number;
}): string => {
  const termLine = `Matched ${input.matchedTermsCount}/${input.requiredTermsCount || 0} required terms`;
  const mustHaveLine = input.mustHaveCount
    ? `${input.matchedMustHaveCount}/${input.mustHaveCount} must-have skills covered`
    : "No explicit must-have skills found in JD";
  const expLine = input.experienceGapYears > 0 ? `experience short by ${input.experienceGapYears} year(s)` : "experience requirement satisfied";
  return `${termLine}; ${mustHaveLine}; ${expLine}; confidence score ${input.score}%.`;
};

interface SearchContext {
  limit: number;
  requestedSkills: string[];
  requireAllSkills: boolean;
  queryTerms: string[];
  requestedLocation: string;
  requestedCompany: string;
  requestedRole: string;
  requestedExp: number | null;
}

interface CandidateMatchScore {
  candidate: Record<string, unknown>;
  score: number;
  skillHits: number;
  queryHits: number;
}

const normalizeCandidate = (candidate: CandidateRecord | Record<string, unknown>): Record<string, unknown> => {
  const source = candidate as Record<string, unknown>;
  const skills = Array.isArray(source.skills) ? source.skills.map((item) => String(item)) : [];

  return {
    id: String(source.id || ""),
    name: String(source.name || "Unknown Candidate"),
    email: String(source.email || ""),
    phone: String(source.phone || ""),
    location: String(source.location || ""),
    currentRole: String(source.currentRole || ""),
    currentCompany: String(source.currentCompany || ""),
    experienceYears: source.experienceYears == null ? null : Number(source.experienceYears),
    skills,
    profileSummary: String(source.profileSummary || ""),
    source: String(source.source || ""),
    resumeUrl: String(source.resumeUrl || ""),
    parsingStatus: String(source.parsingStatus || "")
  };
};

const parseNumberOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const candidateSearchText = (candidate: CandidateRecord | Record<string, unknown>): string => {
  const source = candidate as Record<string, unknown>;
  const skills = Array.isArray(source.skills) ? source.skills.map((item) => String(item)) : [];
  const keywords = Array.isArray(source.keywords) ? source.keywords.map((item) => String(item)) : [];
  const parsedDataText =
    source.parsedData && typeof source.parsedData === "object" ? JSON.stringify(source.parsedData) : String(source.parsedData || "");
  return [
    String(source.name || ""),
    String(source.email || ""),
    String(source.phone || ""),
    String(source.location || ""),
    String(source.currentRole || ""),
    String(source.currentCompany || ""),
    String(source.profileSummary || ""),
    skills.join(" "),
    keywords.join(" "),
    parsedDataText
  ]
    .join(" ")
    .toLowerCase();
};

const extractSkillsFromJobDescription = (jobDescription: string): string[] => {
  const lower = String(jobDescription || "").toLowerCase();
  const found = SKILL_CATALOG.filter((skill) => lower.includes(skill));
  return [...new Set(found.map((item) => normalizeSkill(item)))];
};

const extractMinExperienceYears = (text: string): number | null => {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|year|yrs|yr)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const toLower = (value: unknown): string => String(value || "").trim().toLowerCase();

const skillsMatch = (left: string, right: string): boolean => {
  const a = normalizeMatchText(left);
  const b = normalizeMatchText(right);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
};

const countSkillHits = (candidateSkills: string[], requestedSkills: string[]): number =>
  requestedSkills.filter((requestedSkill) =>
    candidateSkills.some((candidateSkill) => skillsMatch(candidateSkill, requestedSkill))
  ).length;

const buildSearchContext = (filters: CandidateSearchFilters): SearchContext => ({
  limit: Math.min(Math.max(Number(filters.limit || 20), 1), 100),
  requestedSkills: uniqueNormalized([
    ...splitMulti(filters.skill || ""),
    ...(Array.isArray(filters.skills) ? filters.skills : [])
  ]),
  requireAllSkills: Boolean(filters.requireAllSkills),
  queryTerms: uniqueTerms([
    ...toQueryTerms(filters.query || ""),
    ...toQueryTerms(Array.isArray(filters.keywords) ? filters.keywords.join(" ") : "")
  ]),
  requestedLocation: normalizeMatchText(filters.location || ""),
  requestedCompany: normalizeMatchText(filters.company || ""),
  requestedRole: normalizeMatchText(filters.role || ""),
  requestedExp: parseNumberOrNull(filters.experience)
});

const scoreCandidate = (
  candidate: CandidateRecord | Record<string, unknown>,
  context: SearchContext
): CandidateMatchScore | null => {
  const source = candidate as Record<string, unknown>;
  const candidateSkills = Array.isArray(source.skills) ? source.skills.map((item) => normalizeMatchText(String(item))) : [];
  const skillHits = countSkillHits(candidateSkills, context.requestedSkills);

  if (context.requestedSkills.length) {
    if (context.requireAllSkills ? skillHits < context.requestedSkills.length : skillHits === 0) {
      return null;
    }
  }

  if (context.requestedLocation && !normalizeMatchText(String(source.location || "")).includes(context.requestedLocation)) return null;
  if (context.requestedCompany && !normalizeMatchText(String(source.currentCompany || "")).includes(context.requestedCompany)) return null;
  if (context.requestedRole && !normalizeMatchText(String(source.currentRole || "")).includes(context.requestedRole)) return null;
  if (context.requestedExp != null && Number(source.experienceYears || 0) < context.requestedExp) return null;

  const haystack = candidateSearchText(source);
  const queryHits = context.queryTerms.filter((term) => haystack.includes(term)).length;
  if (context.queryTerms.length && queryHits === 0 && skillHits === 0) return null;

  const exp = Number(source.experienceYears || 0);
  const score = skillHits * 100 + queryHits * 20 + exp;
  return {
    candidate: {
      ...normalizeCandidate(source),
      matchedSkillCount: skillHits,
      queryHitCount: queryHits
    },
    score,
    skillHits,
    queryHits
  };
};

const getFallbackCandidates = async (): Promise<CandidateRecord[]> => candidateStoreService.getActiveCandidates();

const searchFromFallback = async (filters: CandidateSearchFilters): Promise<Record<string, unknown>[]> => {
  const candidates = await getFallbackCandidates();
  const context = buildSearchContext(filters);
  const matched = candidates
    .map((candidate) => scoreCandidate(candidate, context))
    .filter((entry): entry is CandidateMatchScore => Boolean(entry))
    .sort((a, b) => b.score - a.score)
    .slice(0, context.limit)
    .map((entry) => entry.candidate);

  return matched;
};

export const searchCandidates = async (filters: CandidateSearchFilters): Promise<AIToolResponse> => {
  const prisma = getPrismaClient();
  const context = buildSearchContext(filters);
  let results: Record<string, unknown>[] = [];

  if (prisma?.candidate?.findMany) {
    const where: Record<string, unknown> = {};

    if (filters.role) {
      where.currentRole = { contains: String(filters.role), mode: "insensitive" };
    }
    if (filters.location) {
      where.location = { contains: String(filters.location), mode: "insensitive" };
    }
    if (filters.company) {
      where.currentCompany = { contains: String(filters.company), mode: "insensitive" };
    }
    if (filters.experience !== undefined && filters.experience !== null) {
      where.experienceYears = { gte: Number(filters.experience) };
    }

    try {
      const rows = await prisma.candidate.findMany({
        where,
        take: Math.max(context.limit * 4, 80),
        orderBy: [{ experienceYears: "desc" }, { createdAt: "desc" }]
      });
      results = rows
        .map((row) => scoreCandidate(row, context))
        .filter((entry): entry is CandidateMatchScore => Boolean(entry))
        .sort((a, b) => b.score - a.score)
        .slice(0, context.limit)
        .map((entry) => entry.candidate);
    } catch {
      results = await searchFromFallback(filters);
    }
  } else {
    results = await searchFromFallback(filters);
  }

  if (
    !results.length &&
    (context.requestedSkills.length || context.queryTerms.length || context.requestedRole || context.requestedLocation || context.requestedCompany)
  ) {
    // Relax strict skill constraints once to avoid false-zero results for loosely phrased prompts.
    const relaxedFilters: CandidateSearchFilters = {
      ...filters,
      requireAllSkills: false
    };
    results = await searchFromFallback(relaxedFilters);
  }

  return {
    explanation: results.length
      ? `Found ${results.length} candidate(s) matching your filters.`
      : "No candidates found with the provided filters.",
    results
  };
};

export const countActiveCandidates = async (): Promise<AIToolResponse> => {
  const candidates = (await candidateStoreService.getAllCandidates()).filter(
    (candidate) => candidate.status !== "DELETED"
  );
  const count = candidates.length;

  return {
    explanation: `There are ${count} active candidate${count === 1 ? "" : "s"} in the ATS.`,
    results: [{ metric: "activeCandidates", count }]
  };
};

const rerankWithConfiguredProviderForJobMatch = async (input: {
  jobDescription: string;
  requiredTerms: string[];
  mustHaveTerms: string[];
  minExperienceYears: number | null;
  ranked: Record<string, unknown>[];
  topK: number;
}): Promise<Record<string, unknown>[] | null> => {
  if (!input.ranked.length) return [];

  const shortlist = input.ranked.slice(0, Math.min(input.ranked.length, 25)).map((candidate) => ({
    id: String(candidate.id || ""),
    name: String(candidate.name || ""),
    currentRole: String(candidate.currentRole || ""),
    currentCompany: String(candidate.currentCompany || ""),
    location: String(candidate.location || ""),
    experienceYears: Number(candidate.experienceYears || 0),
    skills: toStringArraySafe(candidate.skills, 25),
    profileSummary: trimSnippet(candidate.profileSummary, 420),
    heuristicMatchPercentage: Number(candidate.matchPercentage || 0),
    heuristicMatchedSkills: toStringArraySafe(candidate.matchedSkills, 20),
    heuristicMatchedTerms: toStringArraySafe(candidate.matchedTerms, 20),
    heuristicMissingMustHaves: toStringArraySafe(candidate.missingMustHaves, 20)
  }));

  try {
    const provider = getAIProvider();
    const parsed = await provider.generateStructuredData<{ scores: Array<Record<string, unknown>> }>({
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You are an ATS match-scoring engine. Return valid JSON only. Score each candidate from 0-100. Be strict and evidence-based from provided data."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Score and rank candidates for a job description",
            scoringRubric: {
              terms: 0.65,
              skills: 0.25,
              experience: 0.1
            },
            requiredTerms: input.requiredTerms.slice(0, 60),
            mustHaveTerms: input.mustHaveTerms.slice(0, 20),
            minExperienceYears: input.minExperienceYears,
            jobDescription: trimSnippet(input.jobDescription, 5000),
            candidates: shortlist,
            outputFormat: {
              scores: [
                {
                  id: "candidate id",
                  matchPercentage: "integer 0..100",
                  confidenceLabel: "High|Medium|Low",
                  matchedSkills: ["up to 20"],
                  matchedTerms: ["up to 20"],
                  missingMustHaves: ["up to 20"],
                  experienceGapYears: "integer >= 0",
                  confidenceExplanation: "short reason",
                  scoreBreakdown: {
                    weights: { terms: 0.65, skills: 0.25, experience: 0.1 },
                    normalized: { terms: "0..100", skills: "0..100", experience: "0..100" },
                    weightedPoints: { terms: "0..65", skills: "0..25", experience: "0..10" }
                  }
                }
              ]
            }
          })
        }
      ],
      validate: (payload) => {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Object required");
        const scores = (payload as Record<string, unknown>).scores;
        if (!Array.isArray(scores)) throw new Error("Scores array required");
        return { scores: scores.filter(isObject) };
      }
    });

    const rows = parsed.scores;
    if (!rows.length) return null;

    const byId = new Map<string, Record<string, unknown>>();
    rows.forEach((row) => {
      const id = String(row.id || "").trim();
      if (!id) return;
      byId.set(id, row);
    });

    const merged = input.ranked
      .map((candidate) => {
        const candidateId = String(candidate.id || "");
        const llm = byId.get(candidateId);
        if (!llm) return candidate;

        const fallbackScore = clamp(Number(candidate.matchPercentage || 0), 0, 100);
        const rawScore = toOptionalInteger(llm.matchPercentage);
        const matchPercentage = rawScore == null ? fallbackScore : clamp(rawScore, 0, 100);
        const fallbackConfidence =
          fallbackScore >= 80 ? "High" : fallbackScore >= 55 ? "Medium" : "Low";
        const confidenceLabel = normalizeConfidence(llm.confidenceLabel, fallbackConfidence);
        const experienceGapYears = clamp(
          toOptionalInteger(llm.experienceGapYears) ?? Number(candidate.experienceGapYears || 0),
          0,
          99
        );

        const matchedSkills = toStringArraySafe(llm.matchedSkills).length
          ? toStringArraySafe(llm.matchedSkills)
          : toStringArraySafe(candidate.matchedSkills);
        const matchedTerms = toStringArraySafe(llm.matchedTerms).length
          ? toStringArraySafe(llm.matchedTerms)
          : toStringArraySafe(candidate.matchedTerms);
        const missingMustHaves = toStringArraySafe(llm.missingMustHaves).length
          ? toStringArraySafe(llm.missingMustHaves)
          : toStringArraySafe(candidate.missingMustHaves);

        const scoreBreakdown =
          llm.scoreBreakdown && typeof llm.scoreBreakdown === "object" ? llm.scoreBreakdown : candidate.scoreBreakdown;

        return {
          ...candidate,
          matchPercentage,
          confidenceLabel,
          experienceGapYears,
          matchedSkills,
          matchedTerms,
          missingMustHaves,
          confidenceExplanation: trimSnippet(llm.confidenceExplanation || candidate.confidenceExplanation, 320),
          scoreBreakdown
        };
      })
      .sort(
        (a, b) =>
          Number(b.matchPercentage || 0) - Number(a.matchPercentage || 0) ||
          Number((b as Record<string, unknown>).experienceYears || 0) - Number((a as Record<string, unknown>).experienceYears || 0)
      )
      .slice(0, input.topK);

    return merged;
  } catch {
    return null;
  }
};

export const matchCandidatesToJob = async (jobMatchInput: string | JobMatchInput): Promise<AIToolResponse> => {
  const jobDescription =
    typeof jobMatchInput === "string" ? jobMatchInput : String(jobMatchInput.jobDescription || "");
  const keywords =
    typeof jobMatchInput === "string" ? "" : String(jobMatchInput.keywords || "").trim();
  const topK = clamp(
    Number(typeof jobMatchInput === "string" ? 15 : jobMatchInput.topK || 15),
    1,
    25
  );

  const enhancedJobText = keywords ? `${jobDescription}\n\nKeywords:\n${keywords}` : jobDescription;

  const coreSkills = extractSkillsFromJobDescription(enhancedJobText);
  const minExperienceYears = extractMinExperienceYears(enhancedJobText);
  const jdTerms = uniqueLowerItems(
    toQueryTerms(enhancedJobText)
      .filter((term) => !MATCH_STOP_WORDS.has(term))
      .slice(0, 60)
  );
  const requiredTerms = uniqueLowerItems([...coreSkills, ...jdTerms]);
  const mustHaveTerms = coreSkills.length ? coreSkills : requiredTerms.slice(0, Math.min(10, requiredTerms.length));

  const filters: CandidateSearchFilters = {
    skills: coreSkills.length ? coreSkills : undefined,
    keywords: jdTerms.length ? jdTerms.slice(0, 20) : undefined,
    query: requiredTerms.slice(0, 30).join(" "),
    experience: minExperienceYears ?? undefined,
    limit: 120
  };

  const searchResult = await searchCandidates(filters);
  const heuristicRanked = searchResult.results
    .map((candidate) => {
      const candidateSkills = Array.isArray(candidate.skills)
        ? candidate.skills.map((item) => normalizeMatchText(String(item)))
        : [];
      const haystack = candidateSearchText(candidate);

      const matchedSkills = coreSkills.filter((skill) => candidateSkills.some((candidateSkill) => skillsMatch(candidateSkill, skill)));
      const matchedTerms = requiredTerms.filter((term) => haystack.includes(term));
      const matchedMustHaves = mustHaveTerms.filter((term) => haystack.includes(term));
      const missingMustHaves = mustHaveTerms.filter((term) => !haystack.includes(term));

      const termsScore = requiredTerms.length ? matchedTerms.length / requiredTerms.length : 1;
      const skillScore = coreSkills.length ? matchedSkills.length / coreSkills.length : termsScore;
      const expYears = Number(candidate.experienceYears || 0);
      const expScore =
        minExperienceYears == null ? 1 : expYears >= minExperienceYears ? 1 : expYears / Math.max(minExperienceYears, 1);
      const rawScore = Math.max(0, Math.min(1, termsScore * 0.65 + skillScore * 0.25 + expScore * 0.1));
      const matchPercentage = Math.round(rawScore * 100);
      const experienceGapYears = minExperienceYears == null ? 0 : Math.max(0, Math.ceil(minExperienceYears - expYears));
      const weightedPoints = {
        terms: Math.round(termsScore * 65 * 10) / 10,
        skills: Math.round(skillScore * 25 * 10) / 10,
        experience: Math.round(expScore * 10 * 10) / 10
      };
      const confidenceLabel = getConfidenceLabel(
        matchPercentage,
        matchedMustHaves.length,
        mustHaveTerms.length,
        experienceGapYears
      );
      const confidenceExplanation = buildConfidenceExplanation({
        score: matchPercentage,
        matchedTermsCount: matchedTerms.length,
        requiredTermsCount: requiredTerms.length,
        matchedMustHaveCount: matchedMustHaves.length,
        mustHaveCount: mustHaveTerms.length,
        experienceGapYears
      });

      return {
        ...candidate,
        matchedSkills,
        matchedTerms: matchedTerms.slice(0, 20),
        missingMustHaves: missingMustHaves.slice(0, 20),
        matchPercentage,
        minExperienceRequired: minExperienceYears,
        experienceGapYears,
        confidenceLabel,
        confidenceExplanation,
        scoreBreakdown: {
          weights: { terms: 0.65, skills: 0.25, experience: 0.1 },
          normalized: {
            terms: Math.round(termsScore * 1000) / 10,
            skills: Math.round(skillScore * 1000) / 10,
            experience: Math.round(expScore * 1000) / 10
          },
          weightedPoints
        }
      };
    })
    .filter((item) => item.matchPercentage > 0)
    .sort(
      (a, b) =>
        Number(b.matchPercentage) -
          Number(a.matchPercentage) ||
        Number((b as Record<string, unknown>).experienceYears || 0) - Number((a as Record<string, unknown>).experienceYears || 0)
    )
    .slice(0, Math.max(topK, 25));

  const llmRanked = await rerankWithConfiguredProviderForJobMatch({
    jobDescription: enhancedJobText,
    requiredTerms,
    mustHaveTerms,
    minExperienceYears,
    ranked: heuristicRanked,
    topK
  });
  const ranked = (llmRanked ?? heuristicRanked).slice(0, topK);
  const usedAI = llmRanked !== null;

  return {
    explanation: ranked.length
      ? usedAI
        ? `Ranked ${ranked.length} candidate(s) using ${getAIProvider().getProviderName()}-assisted match scoring with ATS evidence.`
        : `Ranked ${ranked.length} candidate(s) against the JD with term/skill/experience confidence scoring.`
      : "No suitable candidates found for the provided job description or keywords.",
    results: ranked
  };
};

export const summarizeCandidate = async (candidateId: string): Promise<AIToolResponse> => {
  const cleanId = String(candidateId || "").trim();
  if (!cleanId) {
    throw new AppError("candidateId is required", 400);
  }

  let candidate: Record<string, unknown> | null = null;
  const prisma = getPrismaClient();

  if (prisma?.candidate?.findUnique) {
    try {
      candidate = await prisma.candidate.findUnique({ where: { id: cleanId } });
    } catch {
      candidate = null;
    }
  }

  if (!candidate) {
    const fallback = await candidateStoreService.getCandidateById(cleanId);
    candidate = fallback ? normalizeCandidate(fallback) : null;
  } else {
    candidate = normalizeCandidate(candidate);
  }

  if (!candidate) {
    throw new AppError("Candidate not found", 404);
  }

  const skills = Array.isArray(candidate.skills) ? candidate.skills.map((item) => String(item)) : [];
  const profileSummary = String(candidate.profileSummary || "");
  const role = String(candidate.currentRole || "Candidate");
  const company = String(candidate.currentCompany || "N/A");
  const exp = candidate.experienceYears == null ? "Not specified" : `${candidate.experienceYears} years`;
  const strengths = skills.slice(0, 5);

  return {
    explanation: `Candidate summary prepared for ${String(candidate.name || "candidate")}.`,
    results: [
      {
        candidateId: candidate.id,
        shortProfileSummary: profileSummary || `${role} profile with background at ${company}.`,
        keySkills: skills,
        experienceOverview: `${exp} in relevant roles.`,
        strengths: strengths.length ? strengths : ["Profile analysis pending additional data"]
      }
    ]
  };
};

export const generateInterviewQuestions = async (skill: string): Promise<AIToolResponse> => {
  const cleanSkill = String(skill || "").trim();
  if (!cleanSkill) {
    throw new AppError("skill is required", 400);
  }

  try {
      const parsed = await getAIProvider().generateStructuredData<{ questions: string[] }>({
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "You create concise interview questions. Return only valid JSON."
          },
          {
            role: "user",
            content: `Generate 5 interview questions for skill: ${cleanSkill}. Return JSON: {"questions": ["..."]}`
          }
        ],
        validate: (payload) => {
          if (!isObject(payload) || !Array.isArray(payload.questions)) throw new Error("Questions array required");
          return { questions: payload.questions.map((item) => String(item).trim()).filter(Boolean).slice(0, 5) };
        }
      });

      const questions = parsed.questions;

      return {
        explanation: `Generated interview questions for ${cleanSkill}.`,
        results: questions.map((question, index) => ({ index: index + 1, question }))
      };
  } catch {
    // Deterministic fallback below.
  }

  const fallbackQuestions = [
    `How would you explain core concepts of ${cleanSkill} to a junior engineer?`,
    `Describe a complex problem you solved using ${cleanSkill}.`,
    `What are common performance pitfalls in ${cleanSkill} and how do you avoid them?`,
    `How do you test and debug solutions built with ${cleanSkill}?`,
    `What best practices would you enforce for maintainable ${cleanSkill} code?`
  ];

  return {
    explanation: `Generated template interview questions for ${cleanSkill}.`,
    results: fallbackQuestions.map((question, index) => ({ index: index + 1, question }))
  };
};

export const draftRecruiterMessage = async (candidateName: string, role: string): Promise<AIToolResponse> => {
  const cleanName = String(candidateName || "").trim() || "Candidate";
  const cleanRole = String(role || "").trim() || "the role";

  try {
      const parsed = await getAIProvider().generateStructuredData<{ subject: string; message: string }>({
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content: "You write concise recruiter outreach emails. Return only valid JSON."
          },
          {
            role: "user",
            content: `Draft a recruiter outreach message for ${cleanName} about ${cleanRole}. Return JSON: {"subject":"...","message":"..."}`
          }
        ],
        validate: (payload) => {
          if (!isObject(payload)) throw new Error("Object required");
          return { subject: String(payload.subject || "").trim(), message: String(payload.message || "").trim() };
        }
      });

      return {
        explanation: `Drafted recruiter message for ${cleanName}.`,
        results: [
          {
            subject: String(parsed.subject || `Opportunity for ${cleanRole}`),
            message: String(parsed.message || "")
          }
        ]
      };
  } catch {
    // Deterministic fallback below.
  }

  return {
    explanation: `Drafted recruiter message for ${cleanName}.`,
    results: [
      {
        subject: `Opportunity: ${cleanRole}`,
        message: `Hi ${cleanName},\n\nI came across your profile and thought you could be a strong fit for our ${cleanRole} opening. If you're open to exploring this role, I'd be happy to share more details.\n\nBest regards,\nAgodly ATS Recruitment Team`
      }
    ]
  };
};

export const webSearch = async (query: string, maxResults = 5): Promise<AIToolResponse> => {
  const cleanQuery = String(query || "").trim();
  const take = Math.min(Math.max(Number(maxResults || 5), 1), 10);
  if (!cleanQuery) {
    throw new AppError("query is required", 400);
  }

  if (env.searchApiKey) {
    try {
      const response = await fetch(env.searchApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.searchApiKey}`
        },
        body: JSON.stringify({
          query: cleanQuery,
          search_depth: "advanced",
          max_results: take
        })
      });

      const payload = (await response.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      const results = Array.isArray(payload.results)
        ? payload.results.slice(0, take).map((item) => ({
            title: String(item.title || ""),
            url: String(item.url || ""),
            snippet: String(item.content || "").slice(0, 320)
          }))
        : [];

      return {
        explanation: results.length
          ? `Fetched ${results.length} real-time web result(s) for "${cleanQuery}".`
          : `No web results found for "${cleanQuery}".`,
        results
      };
    } catch {
      // fallback below
    }
  }

  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(ddgUrl, { method: "GET" });
    const payload = (await response.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const related = Array.isArray(payload.RelatedTopics) ? payload.RelatedTopics : [];
    const relatedResults = related
      .filter((item) => item && typeof item === "object")
      .slice(0, take)
      .map((item) => ({
        title: String((item as { Text?: string }).Text || "").slice(0, 120),
        url: String((item as { FirstURL?: string }).FirstURL || ""),
        snippet: String((item as { Text?: string }).Text || "")
      }))
      .filter((item) => item.title || item.url || item.snippet);

    const primaryResult =
      payload.AbstractText || payload.AbstractURL
        ? [
            {
              title: String(payload.Heading || cleanQuery),
              url: String(payload.AbstractURL || ""),
              snippet: String(payload.AbstractText || "").slice(0, 320)
            }
          ]
        : [];

    const results = [...primaryResult, ...relatedResults].slice(0, take);
    return {
      explanation: results.length
        ? `Fetched ${results.length} web result(s) for "${cleanQuery}" via fallback search.`
        : `No web results found for "${cleanQuery}".`,
      results
    };
  } catch {
    return {
      explanation: `Web search is unavailable right now for "${cleanQuery}".`,
      results: []
    };
  }
};

export const queryAtsSheet = async (input: ATSheetQueryInput): Promise<AIToolResponse> => {
  const sheet = String(input.sheet || "candidates").trim().toLowerCase();
  const filters = input.filters && typeof input.filters === "object" ? input.filters : {};
  const limit = Math.min(Math.max(Number(input.limit || 25), 1), 200);
  const allCandidates = await candidateStoreService.getAllCandidates();

  if (sheet === "candidates") {
    const rows = allCandidates
      .filter((candidate) => {
        const skill = toLower(filters.skill);
        const role = toLower(filters.role);
        const location = toLower(filters.location);
        const company = toLower(filters.company);
        const status = toLower(filters.status);
        const minExp = parseNumberOrNull(filters.experience);

        if (skill) {
          const skills = (candidate.skills || []).map((item) => toLower(item));
          if (!skills.some((item) => item.includes(skill) || skill.includes(item))) return false;
        }
        if (role && !toLower(candidate.currentRole).includes(role)) return false;
        if (location && !toLower(candidate.location).includes(location)) return false;
        if (company && !toLower(candidate.currentCompany).includes(company)) return false;
        if (status && toLower(candidate.status) !== status) return false;
        if (minExp != null && Number(candidate.experienceYears || 0) < minExp) return false;
        return true;
      })
      .slice(0, limit)
      .map((candidate) => normalizeCandidate(candidate));

    return {
      explanation: rows.length
        ? `Fetched ${rows.length} row(s) from ATS candidate sheet.`
        : "No rows found in ATS candidate sheet for the provided filters.",
      results: rows
    };
  }

  if (sheet === "pipeline") {
    const stageMap = new Map<string, number>();
    allCandidates.forEach((candidate) => {
      const stage = String(candidate.stage || "Identified");
      stageMap.set(stage, (stageMap.get(stage) || 0) + 1);
    });

    const rows = Array.from(stageMap.entries())
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count);

    return {
      explanation: "Pipeline sheet summary generated from ATS data.",
      results: rows
    };
  }

  if (sheet === "parsing") {
    const parsingMap = new Map<string, number>();
    allCandidates.forEach((candidate) => {
      const status = String(candidate.parsingStatus || "COMPLETED");
      parsingMap.set(status, (parsingMap.get(status) || 0) + 1);
    });

    const rows = Array.from(parsingMap.entries()).map(([parsingStatus, count]) => ({ parsingStatus, count }));
    return {
      explanation: "Resume parsing sheet summary generated from ATS data.",
      results: rows
    };
  }

  if (sheet === "analytics") {
    const activeCandidates = allCandidates.filter((candidate) => candidate.status === "ACTIVE").length;
    const duplicates = allCandidates.filter((candidate) => candidate.status === "DUPLICATE_PENDING").length;
    const failedParsing = allCandidates.filter((candidate) => candidate.parsingStatus === "FAILED").length;
    const completedParsing = allCandidates.filter((candidate) => candidate.parsingStatus === "COMPLETED").length;

    return {
      explanation: "ATS analytics sheet snapshot generated.",
      results: [
        {
          totalCandidates: allCandidates.length,
          activeCandidates,
          pendingDuplicates: duplicates,
          completedParsing,
          failedParsing
        }
      ]
    };
  }

  return {
    explanation:
      'Unknown sheet requested. Supported sheets: "candidates", "pipeline", "parsing", "analytics".',
    results: []
  };
};
