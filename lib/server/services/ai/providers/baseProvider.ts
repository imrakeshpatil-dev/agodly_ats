import {
  AIChatOptions,
  AIChatResult,
  AIErrorCategory,
  AIHealthResult,
  AIMessage,
  AIProvider,
  AIProviderError,
  AIProviderName,
  AIStructuredRequest,
  parseJsonObject
} from "../aiProvider";
import { AIProviderConfig } from "../aiConfig";

export abstract class BaseAIProvider implements AIProvider {
  protected lastSuccessfulRequestAt: string | null = null;

  constructor(protected readonly config: AIProviderConfig) {}

  abstract chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIChatResult>;
  abstract healthCheck(): Promise<AIHealthResult>;

  getProviderName(): AIProviderName {
    return this.config.provider;
  }

  getModelName(): string {
    return this.config.model;
  }

  async generateStructuredData<T>(request: AIStructuredRequest<T>): Promise<T> {
    const first = await this.chat(request.messages, {
      temperature: request.temperature ?? 0,
      maxOutputTokens: request.maxOutputTokens,
      jsonMode: true
    });

    try {
      return request.validate(parseJsonObject(first.content));
    } catch (error) {
      const repairMessages: AIMessage[] = [
        ...request.messages,
        { role: "assistant", content: first.content.slice(0, 12_000) },
        {
          role: "user",
          content:
            request.repairInstruction ??
            "The previous response was invalid. Return one valid JSON object matching the requested shape. Do not add markdown or commentary."
        }
      ];
      const repaired = await this.chat(repairMessages, {
        temperature: 0,
        maxOutputTokens: request.maxOutputTokens,
        jsonMode: true
      });

      try {
        return request.validate(parseJsonObject(repaired.content));
      } catch {
        if (error instanceof AIProviderError && error.category !== "invalid_response") throw error;
        throw new AIProviderError("invalid_response", "AI provider returned invalid structured data after one repair attempt", 502);
      }
    }
  }

  protected markSuccess(): void {
    this.lastSuccessfulRequestAt = new Date().toISOString();
  }

  protected async requestJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) throw this.toHttpError(response.status);
        this.markSuccess();
        return body;
      } catch (error) {
        lastError = normalizeTransportError(error);
        if (!(lastError instanceof AIProviderError) || !lastError.retryable || attempt >= this.config.maxRetries) {
          throw lastError;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError instanceof Error ? lastError : new AIProviderError("provider_error", "AI request failed");
  }

  protected toHttpError(status: number): AIProviderError {
    if (status === 401 || status === 403) {
      return new AIProviderError("authentication", "AI provider authentication failed", 503);
    }
    if (status === 429) {
      return new AIProviderError("rate_limit", "AI provider rate limit reached", 503, true);
    }
    if (status >= 500) {
      return new AIProviderError("unavailable", "AI provider is unavailable", 503, true);
    }
    return new AIProviderError("provider_error", "AI provider rejected the request", 502);
  }

  protected healthResult(
    status: AIHealthResult["status"],
    errorCategory?: AIErrorCategory
  ): AIHealthResult {
    return {
      provider: this.getProviderName(),
      model: this.getModelName(),
      status,
      fallbackStatus: "ready",
      lastSuccessfulRequestAt: this.lastSuccessfulRequestAt,
      ...(errorCategory ? { errorCategory } : {})
    };
  }
}

const normalizeTransportError = (error: unknown): AIProviderError => {
  if (error instanceof AIProviderError) return error;
  if (error instanceof Error && (error.name === "AbortError" || /aborted|timeout/i.test(error.message))) {
    return new AIProviderError("timeout", "AI provider request timed out", 503, true);
  }
  return new AIProviderError("unavailable", "AI provider could not be reached", 503, true);
};
