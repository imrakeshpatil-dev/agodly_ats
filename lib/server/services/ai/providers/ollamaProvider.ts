import { AIChatOptions, AIChatResult, AIMessage, AIProviderError, AIToolCall } from "../aiProvider";
import { AIProviderConfig } from "../aiConfig";
import { BaseAIProvider } from "./baseProvider";

export class OllamaProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super(config);
  }

  async chat(messages: AIMessage[], options: AIChatOptions = {}): Promise<AIChatResult> {
    const payload = await this.requestJson(`${this.config.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        stream: false,
        messages: messages.map(toOllamaMessage),
        ...(options.jsonMode ? { format: "json" } : {}),
        ...(options.tools?.length
          ? { tools: options.tools.map((tool) => ({ type: "function", function: tool })) }
          : {}),
        options: {
          temperature: options.temperature ?? 0.1,
          num_predict: Math.min(options.maxOutputTokens ?? this.config.maxOutputTokens, this.config.maxOutputTokens)
        }
      })
    });

    const message = payload.message;
    if (!message || typeof message !== "object") {
      throw new AIProviderError("invalid_response", "Ollama returned no message", 502);
    }
    const row = message as Record<string, unknown>;

    return {
      content: String(row.content ?? ""),
      toolCalls: parseOllamaToolCalls(row.tool_calls),
      usage: {
        inputTokens: toOptionalNumber(payload.prompt_eval_count),
        outputTokens: toOptionalNumber(payload.eval_count)
      }
    };
  }

  async healthCheck() {
    const previousLastSuccess = this.lastSuccessfulRequestAt;
    try {
      const result = await this.requestJson(`${this.config.baseUrl.replace(/\/$/, "")}/api/tags`, { method: "GET" });
      const models = Array.isArray(result.models) ? result.models : [];
      const configuredModel = this.config.model.split(":")[0];
      const modelPresent = models.some((item) => {
        if (!item || typeof item !== "object") return false;
        const name = String((item as Record<string, unknown>).name ?? "");
        return name === this.config.model || name.split(":")[0] === configuredModel;
      });
      this.lastSuccessfulRequestAt = previousLastSuccess;
      return modelPresent || !models.length
        ? this.healthResult("available")
        : this.healthResult("unavailable", "not_configured");
    } catch (error) {
      this.lastSuccessfulRequestAt = previousLastSuccess;
      return this.healthResult(
        "unavailable",
        error instanceof AIProviderError ? error.category : "unavailable"
      );
    }
  }
}

const toOllamaMessage = (message: AIMessage): Record<string, unknown> => ({
  role: message.role,
  content: message.content,
  ...(message.toolCalls?.length
    ? {
        tool_calls: message.toolCalls.map((call) => ({
          function: { name: call.name, arguments: safeParseArguments(call.arguments) }
        }))
      }
    : {})
});

const parseOllamaToolCalls = (value: unknown): AIToolCall[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const fn = row.function && typeof row.function === "object" ? row.function as Record<string, unknown> : {};
    const name = String(fn.name ?? "").trim();
    if (!name) return [];
    return [{
      id: `ollama-tool-${index + 1}`,
      name,
      arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {})
    }];
  });
};

const safeParseArguments = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const toOptionalNumber = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};
