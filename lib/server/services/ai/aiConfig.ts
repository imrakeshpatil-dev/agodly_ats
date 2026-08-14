import { env } from "../../config/env";
import { AIProviderName } from "./aiProvider";

export interface AIProviderConfig {
  provider: AIProviderName;
  model: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
}

const VALID_PROVIDERS = new Set<AIProviderName>(["ollama", "openai", "openrouter", "disabled"]);

export const getAIProviderConfig = (): AIProviderConfig => {
  const requested = env.aiProvider as AIProviderName;
  const provider = VALID_PROVIDERS.has(requested) ? requested : "disabled";

  if (provider === "openai") {
    return {
      provider,
      model: env.openAiModel,
      baseUrl: "https://api.openai.com/v1",
      apiKey: env.openAiApiKey,
      timeoutMs: env.aiRequestTimeoutMs,
      maxRetries: env.aiMaxRetries,
      maxOutputTokens: env.aiMaxOutputTokens
    };
  }

  if (provider === "openrouter") {
    return {
      provider,
      model: env.openRouterModel,
      baseUrl: env.openRouterBaseUrl,
      apiKey: env.openRouterApiKey,
      timeoutMs: env.aiRequestTimeoutMs,
      maxRetries: env.aiMaxRetries,
      maxOutputTokens: env.aiMaxOutputTokens
    };
  }

  return {
    provider,
    model: provider === "ollama" ? env.ollamaModel : "disabled",
    baseUrl: provider === "ollama" ? env.ollamaBaseUrl : "",
    apiKey: "",
    timeoutMs: env.aiRequestTimeoutMs,
    maxRetries: env.aiMaxRetries,
    maxOutputTokens: env.aiMaxOutputTokens
  };
};
