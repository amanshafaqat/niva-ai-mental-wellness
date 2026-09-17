import { Global, Module } from '@nestjs/common';
import { StubAIProviderService } from './providers/stub-ai-provider.service';
import { GeminiAIProviderService } from './providers/gemini-ai-provider.service';
import { AIProviderFactory } from './ai-provider.factory';

@Global()
@Module({
  providers: [StubAIProviderService, GeminiAIProviderService, AIProviderFactory],
  exports: [StubAIProviderService, GeminiAIProviderService, AIProviderFactory],
})
export class AiModule {}
