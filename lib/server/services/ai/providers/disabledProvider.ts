import { AIChatOptions, AIChatResult, AIMessage, AIProviderError } from "../aiProvider";
import { AIProviderConfig } from "../aiConfig";
import { BaseAIProvider } from "./baseProvider";

export class DisabledProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super(config);
  }

  async chat(_messages: AIMessage[], _options?: AIChatOptions): Promise<AIChatResult> {
    throw new AIProviderError("disabled", "AI provider is disabled", 503);
  }

  async healthCheck() {
    return this.healthResult("disabled", "disabled");
  }
}
