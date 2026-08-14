import { AIProvider } from "./aiProvider";
import { AIProviderConfig, getAIProviderConfig } from "./aiConfig";
import { DisabledProvider } from "./providers/disabledProvider";
import { OllamaProvider } from "./providers/ollamaProvider";
import { OpenAICompatibleProvider } from "./providers/openAICompatibleProvider";

let providerInstance: AIProvider | null = null;

export const createAIProvider = (config: AIProviderConfig): AIProvider => {
  if (config.provider === "ollama") return new OllamaProvider(config);
  if (config.provider === "openai" || config.provider === "openrouter") {
    return new OpenAICompatibleProvider(config);
  }
  return new DisabledProvider(config);
};

export const getAIProvider = (): AIProvider => {
  if (!providerInstance) providerInstance = createAIProvider(getAIProviderConfig());
  return providerInstance;
};

export const resetAIProviderForTests = (): void => {
  providerInstance = null;
};
