export type AIProviderName = "ollama" | "openai" | "openrouter" | "disabled";
export type AIErrorCategory =
  | "disabled"
  | "not_configured"
  | "timeout"
  | "authentication"
  | "rate_limit"
  | "unavailable"
  | "invalid_response"
  | "provider_error";

export interface AIToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: AIToolCall[];
}

export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AIChatOptions {
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
  tools?: AIToolDefinition[];
}

export interface AIChatResult {
  content: string;
  toolCalls: AIToolCall[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AIStructuredRequest<T> {
  messages: AIMessage[];
  validate: (payload: unknown) => T;
  repairInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AIHealthResult {
  provider: AIProviderName;
  model: string;
  status: "available" | "unavailable" | "disabled" | "not_configured";
  fallbackStatus: "ready";
  lastSuccessfulRequestAt: string | null;
  errorCategory?: AIErrorCategory;
}

export interface AIProvider {
  chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult>;
  generateStructuredData<T>(request: AIStructuredRequest<T>): Promise<T>;
  healthCheck(): Promise<AIHealthResult>;
  getProviderName(): AIProviderName;
  getModelName(): string;
}

export class AIProviderError extends Error {
  readonly category: AIErrorCategory;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(category: AIErrorCategory, message: string, statusCode = 503, retryable = false) {
    super(message);
    this.name = "AIProviderError";
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export const parseJsonObject = (raw: string): Record<string, unknown> => {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON object required");
    return parsed as Record<string, unknown>;
  } catch {
    throw new AIProviderError("invalid_response", "AI provider returned invalid structured data", 502);
  }
};

export const getAIErrorCategory = (error: unknown): AIErrorCategory =>
  error instanceof AIProviderError ? error.category : "provider_error";
