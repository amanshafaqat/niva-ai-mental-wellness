import { Test, TestingModule } from '@nestjs/testing';
import { StubAIProviderService } from './providers/stub-ai-provider.service';
import { AIProviderFactory } from './ai-provider.factory';

describe('AI Provider Abstraction', () => {
  let stubProvider: StubAIProviderService;
  let factory: AIProviderFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StubAIProviderService, AIProviderFactory],
    }).compile();

    stubProvider = module.get<StubAIProviderService>(StubAIProviderService);
    factory = module.get<AIProviderFactory>(AIProviderFactory);
  });

  it('should initialize stub provider with ready status', async () => {
    const health = await stubProvider.checkHealth();
    expect(health.status).toBe('ready');
    expect(stubProvider.providerName).toBe('niva-ai-abstraction-stub');
  });

  it('should return factory provider without fabricating unrequested AI responses', async () => {
    const provider = factory.getProvider('stub');
    expect(provider).toBeDefined();

    const response = await provider.generateResponse([], { userId: 'user-1' });
    expect(response.finishReason).toBe('stop');
    expect(response.content).toContain('Phase 1 System Notice');
  });
});
