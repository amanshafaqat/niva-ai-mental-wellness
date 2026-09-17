import { Injectable, Logger } from '@nestjs/common';
import { AIProvider } from './interfaces/ai-provider.interface';
import { StubAIProviderService } from './providers/stub-ai-provider.service';
import { GeminiAIProviderService } from './providers/gemini-ai-provider.service';

export type SupportedAIProviderType = 'gemini' | 'anthropic' | 'openai' | 'stub';

@Injectable()
export class AIProviderFactory {
  private readonly logger = new Logger(AIProviderFactory.name);

  constructor(
    private readonly stubProvider: StubAIProviderService,
    private readonly geminiProvider: GeminiAIProviderService,
  ) {}

  getProvider(providerType?: SupportedAIProviderType): AIProvider {
    const selected = providerType || (process.env.GEMINI_API_KEY ? 'gemini' : 'stub');
    switch (selected) {
      case 'gemini':
        this.logger.debug(`Providing AI engine: ${this.geminiProvider.providerName}`);
        return this.geminiProvider;
      case 'stub':
      default:
        this.logger.debug(`Providing AI engine: ${this.stubProvider.providerName}`);
        return this.stubProvider;
    }
  }
}
