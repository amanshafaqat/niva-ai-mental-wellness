import { Global, Module } from '@nestjs/common';
import { StubAIProviderService } from './providers/stub-ai-provider.service';
import { AIProviderFactory } from './ai-provider.factory';

@Global()
@Module({
  providers: [StubAIProviderService, AIProviderFactory],
  exports: [StubAIProviderService, AIProviderFactory],
})
export class AiModule {}
