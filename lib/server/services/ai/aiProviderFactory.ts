import { AIProvider, AIWorkloadTier } from "./aiProvider";
import { AIProviderConfig, getAIProviderConfig } from "./aiConfig";
import { DisabledProvider } from "./providers/disabledProvider";
import { OllamaProvider } from "./providers/ollamaProvider";
import { OpenAICompatibleProvider } from "./providers/openAICompatibleProvider";

const providerInstances = new Map<AIWorkloadTier, AIProvider>();

export const createAIProvider = (config: AIProviderConfig): AIProvider => {
  if (config.provider === "ollama") return new OllamaProvider(config);
  if (config.provider === "openai" || config.provider === "openrouter") {
    return new OpenAICompatibleProvider(config);
  }
  return new DisabledProvider(config);
};

export const getAIProvider = (workload: AIWorkloadTier = "standard"): AIProvider => {
  const existing = providerInstances.get(workload);
  if (existing) return existing;
  const provider = createAIProvider(getAIProviderConfig(workload));
  providerInstances.set(workload, provider);
  return provider;
};

export const resetAIProviderForTests = (): void => {
  providerInstances.clear();
};
