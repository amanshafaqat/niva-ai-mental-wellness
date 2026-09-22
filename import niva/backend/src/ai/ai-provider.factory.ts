import { Injectable, Logger } from '@nestjs/common';
import { AIProvider } from './interfaces/ai-provider.interface';
import { StubAIProviderService } from './providers/stub-ai-provider.service';

export type SupportedAIProviderType = 'gemini' | 'anthropic' | 'openai' | 'stub';

@Injectable()
export class AIProviderFactory {
  private readonly logger = new Logger(AIProviderFactory.name);

  constructor(private readonly stubProvider: StubAIProviderService) {}

  getProvider(providerType: SupportedAIProviderType = 'stub'): AIProvider {
    switch (providerType) {
      case 'stub':
      default:
        this.logger.debug(`Providing AI engine: ${this.stubProvider.providerName}`);
        return this.stubProvider;
    }
  }
}
