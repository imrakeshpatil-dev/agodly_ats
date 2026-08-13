import { AIChatOptions, AIChatResult, AIMessage, AIProviderError, AIToolCall } from "../aiProvider";
import { AIProviderConfig } from "../aiConfig";
import { BaseAIProvider } from "./baseProvider";

export class OpenAICompatibleProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super(config);
  }

  async chat(messages: AIMessage[], options: AIChatOptions = {}): Promise<AIChatResult> {
    if (!this.config.apiKey) {
      throw new AIProviderError("not_configured", `${this.config.provider} API key is not configured`, 503);
    }

    const payload = await this.requestJson(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.provider === "openrouter"
          ? { "HTTP-Referer": "https://admin.agodly.com", "X-Title": "Agodly ATS" }
          : {})
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: options.temperature ?? 0.1,
        max_tokens: Math.min(options.maxOutputTokens ?? this.config.maxOutputTokens, this.config.maxOutputTokens),
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...(options.tools?.length
          ? {
              tools: options.tools.map((tool) => ({ type: "function", function: tool })),
              tool_choice: "auto"
            }
          : {}),
        messages: messages.map(toOpenAIMessage)
      })
    });

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const message = choices[0] && typeof choices[0] === "object"
      ? (choices[0] as Record<string, unknown>).message
      : null;
    if (!message || typeof message !== "object") {
      throw new AIProviderError("invalid_response", "AI provider returned no message", 502);
    }
    const messageObject = message as Record<string, unknown>;
    const usage = payload.usage && typeof payload.usage === "object" ? payload.usage as Record<string, unknown> : {};

    return {
      content: String(messageObject.content ?? ""),
      toolCalls: parseOpenAIToolCalls(messageObject.tool_calls),
      usage: {
        inputTokens: toOptionalNumber(usage.prompt_tokens),
        outputTokens: toOptionalNumber(usage.completion_tokens)
      }
    };
  }

  async healthCheck() {
    if (!this.config.apiKey) return this.healthResult("not_configured", "not_configured");
    const previousLastSuccess = this.lastSuccessfulRequestAt;
    try {
      await this.requestJson(`${this.config.baseUrl.replace(/\/$/, "")}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.config.apiKey}` }
      });
      this.lastSuccessfulRequestAt = previousLastSuccess;
      return this.healthResult("available");
    } catch (error) {
      this.lastSuccessfulRequestAt = previousLastSuccess;
      return this.healthResult(
        "unavailable",
        error instanceof AIProviderError ? error.category : "unavailable"
      );
    }
  }
}

const toOpenAIMessage = (message: AIMessage): Record<string, unknown> => ({
  role: message.role,
  content: message.content,
  ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
  ...(message.toolCalls?.length
    ? {
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.arguments }
        }))
      }
    : {})
});

const parseOpenAIToolCalls = (value: unknown): AIToolCall[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const fn = row.function && typeof row.function === "object" ? row.function as Record<string, unknown> : {};
    const name = String(fn.name ?? "").trim();
    if (!name) return [];
    return [{ id: String(row.id ?? `tool-${crypto.randomUUID()}`), name, arguments: String(fn.arguments ?? "{}") }];
  });
};

const toOptionalNumber = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};
