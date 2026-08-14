import { AppError } from "../middleware/error.middleware";
import { aiMemoryService } from "./aiMemory.service";
import { AIMessage, AIToolDefinition } from "./ai/aiProvider";
import { getAIProvider } from "./ai/aiProviderFactory";
import {
  AIToolResponse,
  ATSheetQueryInput,
  CandidateSearchFilters,
  draftRecruiterMessage,
  generateInterviewQuestions,
  matchCandidatesToJob,
  queryAtsSheet,
  searchCandidates,
  summarizeCandidate,
  webSearch
} from "./aiTools";

export interface AgentResponse {
  explanation: string;
  results: Record<string, unknown>[];
  toolCalls: string[];
  conversationId: string;
  interactionId: string;
}

const SYSTEM_PROMPT = `You are an AI Copilot inside a Recruitment ATS.

You can access candidates, jobs, clients and hiring data.

Your goal is to help recruiters find talent quickly and make better hiring decisions.

Use available tools whenever data lookup is required instead of guessing.`;

const TOOL_SCHEMAS: Array<{ type: "function"; function: AIToolDefinition }> = [
  {
    type: "function",
    function: {
      name: "searchCandidates",
      description: "Search candidates by skill, experience, location, company, or role.",
      parameters: {
        type: "object",
        properties: {
          skill: { type: "string" },
          skills: {
            type: "array",
            items: { type: "string" }
          },
          keywords: {
            type: "array",
            items: { type: "string" }
          },
          query: { type: "string" },
          requireAllSkills: { type: "boolean" },
          experience: { type: "number" },
          location: { type: "string" },
          company: { type: "string" },
          role: { type: "string" },
          limit: { type: "number" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "matchCandidatesToJob",
      description: "Match candidates to a job description and rank by skill and experience fit.",
      parameters: {
        type: "object",
        properties: {
          jobDescription: { type: "string" },
          keywords: { type: "string" },
          topK: { type: "number" }
        },
        required: ["jobDescription"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "summarizeCandidate",
      description: "Summarize a candidate profile by candidate id.",
      parameters: {
        type: "object",
        properties: {
          candidateId: { type: "string" }
        },
        required: ["candidateId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generateInterviewQuestions",
      description: "Generate five interview questions for a skill.",
      parameters: {
        type: "object",
        properties: {
          skill: { type: "string" }
        },
        required: ["skill"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draftRecruiterMessage",
      description: "Draft a recruiter outreach message for a candidate.",
      parameters: {
        type: "object",
        properties: {
          candidateName: { type: "string" },
          role: { type: "string" }
        },
        required: ["candidateName", "role"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "webSearch",
      description: "Fetch real-time internet search results for latest information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          maxResults: { type: "number" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "queryAtsSheet",
      description: "Query ATS sheet-like datasets such as candidates, pipeline, parsing, analytics.",
      parameters: {
        type: "object",
        properties: {
          sheet: { type: "string" },
          filters: { type: "object" },
          limit: { type: "number" }
        }
      }
    }
  }
];

const PROVIDER_TOOLS = TOOL_SCHEMAS.map((tool) => tool.function);
const SKILL_HINTS = [
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
  "microservices",
  "devops",
  "recruitment",
  "sourcing"
];
const ROLE_HINTS = [
  "software engineer",
  "backend engineer",
  "frontend engineer",
  "full stack engineer",
  "devops engineer",
  "data engineer",
  "qa engineer",
  "recruiter",
  "talent acquisition",
  "designer",
  "product manager",
  "project manager",
  "business analyst"
];
const LOCATION_HINTS = [
  "bangalore",
  "bengaluru",
  "hyderabad",
  "pune",
  "mumbai",
  "delhi",
  "gurugram",
  "noida",
  "chennai",
  "kolkata",
  "remote"
];
const QUERY_STOP_WORDS = new Set([
  "find",
  "search",
  "show",
  "list",
  "get",
  "candidate",
  "candidates",
  "profile",
  "profiles",
  "talent",
  "with",
  "from",
  "for",
  "and",
  "the",
  "that",
  "who",
  "having",
  "experience",
  "years",
  "year"
]);

export const handleUserPrompt = async (prompt: string, conversationIdInput?: string): Promise<AgentResponse> => {
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) {
    throw new AppError("prompt is required", 400);
  }

  const conversation = await aiMemoryService.getConversation(conversationIdInput || "");
  const relevantMemories = await aiMemoryService.findRelevantMemories(cleanPrompt, 3);
  const memoryContext = buildMemoryContext(relevantMemories);
  const directJobMatchIntent = parseJobMatchIntent(cleanPrompt);
  const directSearchIntent = parseSearchIntentFromPrompt(cleanPrompt);

  if (directJobMatchIntent) {
    const matchOutput = await matchCandidatesToJob(cleanPrompt);
    const interactionId = await aiMemoryService.recordInteraction({
      prompt: cleanPrompt,
      explanation: matchOutput.explanation,
      toolCalls: ["matchCandidatesToJob"],
      results: matchOutput.results,
      conversationId: conversation.id
    });

    return {
      explanation: matchOutput.explanation,
      results: matchOutput.results,
      toolCalls: ["matchCandidatesToJob"],
      conversationId: conversation.id,
      interactionId
    };
  }

  if (directSearchIntent.shouldSearch) {
    const searchOutput = await searchCandidates(directSearchIntent.filters);
    const interactionId = await aiMemoryService.recordInteraction({
      prompt: cleanPrompt,
      explanation: searchOutput.explanation,
      toolCalls: ["searchCandidates"],
      results: searchOutput.results,
      conversationId: conversation.id
    });

    return {
      explanation: searchOutput.explanation,
      results: searchOutput.results,
      toolCalls: ["searchCandidates"],
      conversationId: conversation.id,
      interactionId
    };
  }

  const messages: AIMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  if (memoryContext) {
    messages.push({
      role: "system",
      content: `Prior learning signals from recruiter feedback:\n${memoryContext}`
    });
  }

  const recentConversation = conversation.messages.slice(-8);
  recentConversation.forEach((message) => {
    messages.push({
      role: message.role,
      content: message.content
    });
  });
  messages.push({ role: "user", content: cleanPrompt });

  try {
    const provider = getAIProvider();
    const first = await provider.chat(messages, { temperature: 0.1, tools: PROVIDER_TOOLS });
    const toolCalls = first.toolCalls;
    if (!toolCalls.length) {
      const explanation = first.content || "I’m ready to help. Please provide a specific recruiting request.";
      return recordAgentResponse(cleanPrompt, conversation.id, explanation, [], []);
    }

    const executedToolNames: string[] = [];
    const toolOutputs: AIToolResponse[] = [];
    messages.push({ role: "assistant", content: first.content, toolCalls });

    for (const toolCall of toolCalls) {
      const output = await executeToolCall(toolCall.name, toolCall.arguments || "{}");
      executedToolNames.push(toolCall.name);
      toolOutputs.push(output);
      messages.push({ role: "tool", toolCallId: toolCall.id, content: JSON.stringify(output) });
    }

    const payload = await provider.generateStructuredData<{
      explanation: string;
      results: Record<string, unknown>[];
    }>({
      temperature: 0.2,
      messages: [
        ...messages,
        {
          role: "user",
          content: 'Using the tool results above, return JSON only: {"explanation":"...", "results":[...]}'
        }
      ],
      validate: (value) => {
        if (!isObject(value) || typeof value.explanation !== "string" || !Array.isArray(value.results)) {
          throw new Error("Agent response shape is invalid");
        }
        return {
          explanation: value.explanation,
          results: value.results.map((item) => isObject(item) ? item : { value: item })
        };
      }
    }).catch(() => ({
      explanation: toolOutputs[0]?.explanation || "No tool output available",
      results: toolOutputs[0]?.results || []
    }));

    return recordAgentResponse(cleanPrompt, conversation.id, payload.explanation, payload.results, executedToolNames);
  } catch {
    const heuristic = await runHeuristicAgent(cleanPrompt);
    return recordAgentResponse(
      cleanPrompt,
      conversation.id,
      `AI assistant is temporarily unavailable. Core ATS functions continue to work normally. ${heuristic.explanation}`,
      heuristic.results,
      heuristic.toolCalls
    );
  }
};

const recordAgentResponse = async (
  prompt: string,
  conversationId: string,
  explanation: string,
  results: Record<string, unknown>[],
  toolCalls: string[]
): Promise<AgentResponse> => {
  const interactionId = await aiMemoryService.recordInteraction({
    prompt,
    explanation,
    toolCalls,
    results,
    conversationId
  });
  return { explanation, results, toolCalls, conversationId, interactionId };
};

export const applyLearningFeedback = async (
  interactionId: string,
  helpful: boolean,
  correction?: string
): Promise<{ interactionId: string; helpful: boolean }> => {
  const result = await aiMemoryService.applyFeedback({
    interactionId,
    helpful,
    correction
  });

  return {
    interactionId: result.id,
    helpful: result.helpful === true
  };
};

const executeToolCall = async (toolName: string, rawArgs: string): Promise<AIToolResponse> => {
  const args = safeParseJson(rawArgs) || {};

  switch (toolName) {
    case "searchCandidates":
      return searchCandidates({
        skill: toOptionalString(args.skill),
        skills: toOptionalStringArray(args.skills),
        keywords: toOptionalStringArray(args.keywords),
        query: toOptionalString(args.query),
        requireAllSkills: toOptionalBoolean(args.requireAllSkills) ?? undefined,
        experience: toOptionalNumber(args.experience) ?? undefined,
        location: toOptionalString(args.location),
        company: toOptionalString(args.company),
        role: toOptionalString(args.role),
        limit: toOptionalNumber(args.limit) ?? undefined
      } satisfies CandidateSearchFilters);

    case "matchCandidatesToJob":
      return matchCandidatesToJob({
        jobDescription: toOptionalString(args.jobDescription) || "",
        keywords: toOptionalString(args.keywords),
        topK: toOptionalNumber(args.topK) ?? undefined
      });

    case "summarizeCandidate":
      return summarizeCandidate(toOptionalString(args.candidateId) || "");

    case "generateInterviewQuestions":
      return generateInterviewQuestions(toOptionalString(args.skill) || "");

    case "draftRecruiterMessage":
      return draftRecruiterMessage(toOptionalString(args.candidateName) || "", toOptionalString(args.role) || "");

    case "webSearch":
      return webSearch(toOptionalString(args.query) || "", toOptionalNumber(args.maxResults) ?? 5);

    case "queryAtsSheet":
      return queryAtsSheet({
        sheet: toOptionalString(args.sheet),
        filters: isObject(args.filters) ? args.filters : undefined,
        limit: toOptionalNumber(args.limit) ?? undefined
      } satisfies ATSheetQueryInput);

    default:
      throw new AppError(`Unsupported tool requested: ${toolName}`, 400);
  }
};

const runHeuristicAgent = async (
  prompt: string
): Promise<{ explanation: string; results: Record<string, unknown>[]; toolCalls: string[] }> => {
  const lower = prompt.toLowerCase();
  let output: AIToolResponse;
  let toolName = "searchCandidates";
  const searchIntent = parseSearchIntentFromPrompt(prompt);

  if (searchIntent.shouldSearch) {
    output = await searchCandidates({
      skill: searchIntent.filters.skill,
      skills: searchIntent.filters.skills,
      keywords: searchIntent.filters.keywords,
      query: searchIntent.filters.query,
      requireAllSkills: searchIntent.filters.requireAllSkills,
      role: searchIntent.filters.role || extractAfterKeyword(prompt, "role"),
      location: searchIntent.filters.location || extractAfterKeyword(prompt, "location"),
      company: searchIntent.filters.company || extractAfterKeyword(prompt, "company"),
      experience: searchIntent.filters.experience ?? extractNumber(prompt) ?? undefined,
      limit: 20
    });
    toolName = "searchCandidates";
  } else if (lower.includes("latest") || lower.includes("today") || lower.includes("news") || lower.includes("internet")) {
    output = await webSearch(prompt, 5);
    toolName = "webSearch";
  } else if (lower.includes("sheet") || lower.includes("pipeline") || lower.includes("analytics")) {
    output = await queryAtsSheet({
      sheet: lower.includes("pipeline") ? "pipeline" : lower.includes("analytics") ? "analytics" : "candidates",
      limit: 30
    });
    toolName = "queryAtsSheet";
  } else if (lower.includes("interview question")) {
    const skill = extractAfterKeyword(prompt, "for") || "javascript";
    output = await generateInterviewQuestions(skill);
    toolName = "generateInterviewQuestions";
  } else if (lower.includes("draft") || lower.includes("outreach") || lower.includes("message")) {
    const role = extractAfterKeyword(prompt, "for role") || "open role";
    output = await draftRecruiterMessage("Candidate", role);
    toolName = "draftRecruiterMessage";
  } else if (lower.includes("summarize candidate")) {
    const candidateId = extractCandidateId(prompt);
    output = await summarizeCandidate(candidateId || "");
    toolName = "summarizeCandidate";
  } else if (lower.includes("match") && lower.includes("job")) {
    output = await matchCandidatesToJob(prompt);
    toolName = "matchCandidatesToJob";
  } else {
    output = await searchCandidates({
      skill: searchIntent.filters.skill,
      skills: searchIntent.filters.skills,
      keywords: searchIntent.filters.keywords,
      query: searchIntent.filters.query,
      requireAllSkills: searchIntent.filters.requireAllSkills,
      role: searchIntent.filters.role || extractAfterKeyword(prompt, "role"),
      location: searchIntent.filters.location || extractAfterKeyword(prompt, "location"),
      company: searchIntent.filters.company || extractAfterKeyword(prompt, "company"),
      experience: searchIntent.filters.experience ?? extractNumber(prompt) ?? undefined,
      limit: 20
    });
    toolName = "searchCandidates";
  }

  return {
    explanation: output.explanation,
    results: output.results,
    toolCalls: [toolName]
  };
};

const buildMemoryContext = (
  entries: Array<{
    prompt: string;
    explanation: string;
    helpful: boolean | null;
    correction: string;
  }>
): string => {
  if (!entries.length) return "";

  return entries
    .map((entry, index) => {
      const status = entry.helpful === true ? "helpful" : entry.helpful === false ? "not helpful" : "unrated";
      return `Memory ${index + 1} (${status}): Prompt="${entry.prompt}" | Response="${entry.explanation}"${
        entry.correction ? ` | Correction="${entry.correction}"` : ""
      }`;
    })
    .join("\n");
};

const safeParseJson = (raw: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(String(raw || "").trim()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const toOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return undefined;
};

const toOptionalStringArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const rows = value.map((item) => String(item).trim()).filter(Boolean);
    return rows.length ? rows : undefined;
  }
  const rows = String(value)
    .split(/[|,;/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
  return rows.length ? rows : undefined;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const extractAfterKeyword = (text: string, keyword: string): string | undefined => {
  const pattern = new RegExp(`${keyword}\\s*[:=-]?\\s*([a-zA-Z0-9+.#/\\-\\s]{2,60})`, "i");
  const match = String(text || "").match(pattern);
  return match ? match[1].trim() : undefined;
};

const extractNumber = (text: string): number | null => {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractCandidateId = (text: string): string | undefined => {
  const match = String(text || "").match(/(cand-[a-z0-9-]+|[a-f0-9]{12,})/i);
  return match ? match[1] : undefined;
};

const parseJobMatchIntent = (prompt: string): boolean => {
  const lower = String(prompt || "").toLowerCase();
  const hasMatchSignal = /\b(match|best fit|ideal candidates|shortlist)\b/i.test(lower);
  const hasJobSignal = /\b(job|jd|job description|requirement|requirements)\b/i.test(lower);
  const hasSkillBlock = /\b(?:skills?|keywords?)\s*[:=-]/i.test(prompt);
  return (hasMatchSignal && hasJobSignal) || (hasJobSignal && hasSkillBlock);
};

const parseSearchIntentFromPrompt = (
  prompt: string
): { shouldSearch: boolean; filters: CandidateSearchFilters } => {
  const text = String(prompt || "").trim();
  const lower = text.toLowerCase();
  const explicitKeywords = extractExplicitKeywordList(text);
  const freeformSkills = extractFreeformSkills(text);

  const analyticsSheetIntent =
    lower.includes("sheet") && (lower.includes("pipeline") || lower.includes("analytics") || lower.includes("parsing"));
  const nonSearchIntent =
    lower.includes("interview question") ||
    lower.includes("draft") ||
    lower.includes("outreach") ||
    lower.includes("summarize candidate") ||
    (lower.includes("match") && lower.includes("job")) ||
    lower.includes("latest") ||
    lower.includes("internet") ||
    lower.includes("news") ||
    analyticsSheetIntent;

  const skills = uniqueLower([...SKILL_HINTS.filter((skill) => lower.includes(skill)), ...freeformSkills]);
  const roles = ROLE_HINTS.filter((role) => lower.includes(role));
  const locations = LOCATION_HINTS.filter((location) => lower.includes(location));
  const experience = extractYearsFromPrompt(lower);
  const company = extractCompanyFromPrompt(text);
  const searchVerb = /\b(find|search|show|list|get|source|lookup)\b/i.test(text);

  const queryTerms = text
    .split(/\s+/g)
    .map((item) => item.trim())
    .map((item) => item.toLowerCase().replace(/[^a-z0-9+.#/-]/g, ""))
    .filter((item) => item.length >= 3 && !QUERY_STOP_WORDS.has(item))
    .slice(0, 8);

  const filters: CandidateSearchFilters = {
    skill: skills[0] || undefined,
    skills: skills.length ? skills : undefined,
    keywords: explicitKeywords.length ? explicitKeywords : undefined,
    query: queryTerms.length ? queryTerms.join(" ") : undefined,
    requireAllSkills: /\b(all|must have|mandatory)\b/i.test(text) ? true : undefined,
    experience: experience ?? undefined,
    location: locations[0] || undefined,
    role: roles[0] || undefined,
    company: company || undefined,
    limit: 25
  };

  const hasSearchSignals = Boolean(
    searchVerb ||
      skills.length ||
      roles.length ||
      locations.length ||
      experience != null ||
      company ||
      explicitKeywords.length ||
      /\bcandidate|profiles|talent\b/i.test(text)
  );

  return {
    shouldSearch: !nonSearchIntent && hasSearchSignals,
    filters
  };
};

const extractYearsFromPrompt = (text: string): number | null => {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|year|yrs|yr)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractCompanyFromPrompt = (text: string): string => {
  const fromMatch = text.match(/\b(?:from|at|company)\s+([A-Za-z0-9&.\- ]{2,50})/i);
  return fromMatch ? fromMatch[1].trim() : "";
};

const extractExplicitKeywordList = (text: string): string[] => {
  const keywordBlock = text.match(/\b(?:keywords?|skills?)\s*[:=-]\s*([^\n]+)/i);
  if (!keywordBlock) return [];
  return keywordBlock[1]
    .split(/[|,;/]+/g)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length >= 2)
    .slice(0, 20);
};

const extractFreeformSkills = (text: string): string[] => {
  const clauses = [
    text.match(/\bwith\s+([A-Za-z0-9+.#/\-&,\s]{3,120})/i)?.[1] || "",
    text.match(/\bmust(?:\s+have)?\s+([A-Za-z0-9+.#/\-&,\s]{3,120})/i)?.[1] || "",
    text.match(/\brequiring\s+([A-Za-z0-9+.#/\-&,\s]{3,120})/i)?.[1] || ""
  ]
    .map((item) => item.trim())
    .filter(Boolean);

  const items = clauses
    .flatMap((clause) => clause.split(/[|,;/]+|\band\b/gi))
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length >= 2 && item.length <= 40 && !QUERY_STOP_WORDS.has(item))
    .filter((item) => !/^\d/.test(item))
    .filter((item) => !/\b(year|years|yr|yrs|experience|exp|location|city|based)\b/.test(item))
    .filter((item) => !LOCATION_HINTS.includes(item))
    .slice(0, 20);

  return items;
};

const uniqueLower = (items: string[]): string[] => {
  const seen = new Set<string>();
  const rows: string[] = [];
  items.forEach((item) => {
    const normalized = String(item || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    rows.push(normalized);
  });
  return rows;
};
