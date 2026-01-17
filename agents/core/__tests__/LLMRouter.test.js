/**
 * Unit tests for LLMRouter class
 * Tests model selection, provider availability, and routing logic
 */

import { jest } from '@jest/globals';

// Mock Anthropic SDK
jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ text: 'Mock response' }],
        usage: { input_tokens: 100, output_tokens: 50 }
      })
    }
  }))
}));

// Store original env
const originalEnv = process.env;

describe('LLMRouter', () => {
  let LLMRouter, LLM_CONFIGS, TASK_TYPE_ROUTING;

  beforeAll(async () => {
    // Import after mocking
    const module = await import('../LLMRouter.js');
    LLMRouter = module.default;
    LLM_CONFIGS = module.LLM_CONFIGS;
    TASK_TYPE_ROUTING = module.TASK_TYPE_ROUTING;
  });

  beforeEach(() => {
    // Reset environment
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('LLM_CONFIGS export', () => {
    it('should export model configurations', () => {
      expect(LLM_CONFIGS).toBeDefined();
      expect(typeof LLM_CONFIGS).toBe('object');
    });

    it('should have Claude Opus 4 configuration', () => {
      expect(LLM_CONFIGS['claude-opus-4']).toBeDefined();
      expect(LLM_CONFIGS['claude-opus-4'].provider).toBe('anthropic');
      expect(LLM_CONFIGS['claude-opus-4'].model).toContain('claude-opus-4');
    });

    it('should have Claude Sonnet 4 configuration', () => {
      expect(LLM_CONFIGS['claude-sonnet-4']).toBeDefined();
      expect(LLM_CONFIGS['claude-sonnet-4'].provider).toBe('anthropic');
    });

    it('should have Claude Haiku configuration', () => {
      expect(LLM_CONFIGS['claude-haiku']).toBeDefined();
      expect(LLM_CONFIGS['claude-haiku'].provider).toBe('anthropic');
    });

    it('should have GPT-4o configuration', () => {
      expect(LLM_CONFIGS['gpt-4o']).toBeDefined();
      expect(LLM_CONFIGS['gpt-4o'].provider).toBe('openai');
    });

    it('should have GPT-4o-mini configuration', () => {
      expect(LLM_CONFIGS['gpt-4o-mini']).toBeDefined();
      expect(LLM_CONFIGS['gpt-4o-mini'].provider).toBe('openai');
    });

    it('should have Gemini configuration', () => {
      expect(LLM_CONFIGS['gemini-1.5-pro']).toBeDefined();
      expect(LLM_CONFIGS['gemini-1.5-pro'].provider).toBe('google');
    });

    it('should have Ollama configuration', () => {
      expect(LLM_CONFIGS['ollama-llama3']).toBeDefined();
      expect(LLM_CONFIGS['ollama-llama3'].provider).toBe('ollama');
      expect(LLM_CONFIGS['ollama-llama3'].costPer1kInput).toBe(0);
    });

    it('should include cost information for each model', () => {
      for (const [modelId, config] of Object.entries(LLM_CONFIGS)) {
        expect(config.costPer1kInput).toBeDefined();
        expect(config.costPer1kOutput).toBeDefined();
        expect(typeof config.costPer1kInput).toBe('number');
        expect(typeof config.costPer1kOutput).toBe('number');
      }
    });

    it('should include capabilities for each model', () => {
      for (const [modelId, config] of Object.entries(LLM_CONFIGS)) {
        expect(config.capabilities).toBeDefined();
        expect(Array.isArray(config.capabilities)).toBe(true);
        expect(config.capabilities.length).toBeGreaterThan(0);
      }
    });

    it('should include maxTokens for each model', () => {
      for (const [modelId, config] of Object.entries(LLM_CONFIGS)) {
        expect(config.maxTokens).toBeDefined();
        expect(typeof config.maxTokens).toBe('number');
        expect(config.maxTokens).toBeGreaterThan(0);
      }
    });
  });

  describe('TASK_TYPE_ROUTING export', () => {
    it('should export task type routing', () => {
      expect(TASK_TYPE_ROUTING).toBeDefined();
      expect(typeof TASK_TYPE_ROUTING).toBe('object');
    });

    it('should have routing for strategic decisions', () => {
      expect(TASK_TYPE_ROUTING.strategic_decision).toBeDefined();
      expect(TASK_TYPE_ROUTING.strategic_decision).toContain('claude-opus-4');
    });

    it('should have routing for document drafts', () => {
      expect(TASK_TYPE_ROUTING.document_draft).toBeDefined();
    });

    it('should have routing for analysis', () => {
      expect(TASK_TYPE_ROUTING.analysis).toBeDefined();
    });

    it('should have routing for code review', () => {
      expect(TASK_TYPE_ROUTING.code_review).toBeDefined();
    });

    it('should have routing for classification', () => {
      expect(TASK_TYPE_ROUTING.classification).toBeDefined();
      expect(TASK_TYPE_ROUTING.classification).toContain('claude-haiku');
    });

    it('should have routing for summarization', () => {
      expect(TASK_TYPE_ROUTING.summarization).toBeDefined();
    });

    it('should have routing for long documents', () => {
      expect(TASK_TYPE_ROUTING.long_document).toBeDefined();
      expect(TASK_TYPE_ROUTING.long_document).toContain('gemini-1.5-pro');
    });

    it('should have routing for privacy sensitive tasks', () => {
      expect(TASK_TYPE_ROUTING.privacy_sensitive).toBeDefined();
      expect(TASK_TYPE_ROUTING.privacy_sensitive).toContain('ollama-llama3');
    });

    it('should have general routing as fallback', () => {
      expect(TASK_TYPE_ROUTING.general).toBeDefined();
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const router = new LLMRouter();
      expect(router.usageStats).toBeDefined();
      expect(router.usageStats.totalCalls).toBe(0);
    });

    it('should initialize usage stats', () => {
      const router = new LLMRouter();
      expect(router.usageStats.totalCalls).toBe(0);
      expect(router.usageStats.totalInputTokens).toBe(0);
      expect(router.usageStats.totalOutputTokens).toBe(0);
      expect(router.usageStats.totalCost).toBe(0);
      expect(router.usageStats.byModel).toEqual({});
    });

    it('should initialize Anthropic when API key is available', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();
      expect(router.anthropic).toBeDefined();
    });

    it('should accept API key via config', () => {
      delete process.env.ANTHROPIC_API_KEY;
      const router = new LLMRouter({ anthropicApiKey: 'config-key' });
      expect(router.anthropic).toBeDefined();
    });

    it('should configure OpenAI when API key is available', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const router = new LLMRouter();
      expect(router.openaiApiKey).toBeDefined();
    });

    it('should configure Google when API key is available', () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key';
      const router = new LLMRouter();
      expect(router.googleApiKey).toBeDefined();
    });

    it('should set default Ollama endpoint', () => {
      const router = new LLMRouter();
      expect(router.ollamaEndpoint).toBe('http://localhost:11434');
    });

    it('should accept custom Ollama endpoint', () => {
      const router = new LLMRouter({ ollamaEndpoint: 'http://custom:11434' });
      expect(router.ollamaEndpoint).toBe('http://custom:11434');
    });
  });

  describe('isProviderAvailable', () => {
    it('should return true for anthropic when initialized', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();
      expect(router.isProviderAvailable('anthropic')).toBe(true);
    });

    it('should return false for anthropic when not initialized', () => {
      delete process.env.ANTHROPIC_API_KEY;
      const router = new LLMRouter();
      expect(router.isProviderAvailable('anthropic')).toBe(false);
    });

    it('should return true for openai when API key is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const router = new LLMRouter();
      expect(router.isProviderAvailable('openai')).toBe(true);
    });

    it('should return false for openai when API key is not set', () => {
      delete process.env.OPENAI_API_KEY;
      const router = new LLMRouter();
      expect(router.isProviderAvailable('openai')).toBe(false);
    });

    it('should return true for google when API key is set', () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key';
      const router = new LLMRouter();
      expect(router.isProviderAvailable('google')).toBe(true);
    });

    it('should always return true for ollama', () => {
      const router = new LLMRouter();
      expect(router.isProviderAvailable('ollama')).toBe(true);
    });

    it('should return false for unknown providers', () => {
      const router = new LLMRouter();
      expect(router.isProviderAvailable('unknown')).toBe(false);
    });
  });

  describe('selectLLM', () => {
    it('should select ollama for privacy-sensitive data', () => {
      const router = new LLMRouter();
      const result = router.selectLLM({ containsPII: true });
      expect(result).toBe('ollama-llama3');
    });

    it('should select ollama for confidential data', () => {
      const router = new LLMRouter();
      const result = router.selectLLM({ confidential: true });
      expect(result).toBe('ollama-llama3');
    });

    it('should select gemini for long context documents', () => {
      process.env.GOOGLE_AI_API_KEY = 'test-key';
      const router = new LLMRouter();
      const result = router.selectLLM({ contextLength: 150000 });
      expect(result).toBe('gemini-1.5-pro');
    });

    it('should use task type routing for specific task types', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();

      const strategicResult = router.selectLLM({ type: 'strategic_decision' });
      expect(strategicResult).toBe('claude-opus-4');
    });

    it('should fall back to general routing for unknown types', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();

      const result = router.selectLLM({ type: 'unknown_type' });
      expect(['claude-sonnet-4', 'gpt-4o']).toContain(result);
    });

    it('should select first available model from candidates', () => {
      // Only Anthropic available
      process.env.ANTHROPIC_API_KEY = 'test-key';
      delete process.env.OPENAI_API_KEY;

      const router = new LLMRouter();
      const result = router.selectLLM({ type: 'general' });

      expect(result).toBe('claude-sonnet-4');
    });

    it('should select appropriate model for classification tasks', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();

      const result = router.selectLLM({ type: 'classification' });
      expect(result).toBe('claude-haiku');
    });

    it('should handle tasks without type', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();

      const result = router.selectLLM({});
      expect(result).toBeDefined();
    });
  });

  describe('trackUsage', () => {
    it('should update total usage stats', () => {
      const router = new LLMRouter();
      const config = LLM_CONFIGS['claude-sonnet-4'];

      router.trackUsage('claude-sonnet-4', 1000, 500, config);

      expect(router.usageStats.totalCalls).toBe(1);
      expect(router.usageStats.totalInputTokens).toBe(1000);
      expect(router.usageStats.totalOutputTokens).toBe(500);
    });

    it('should calculate cost correctly', () => {
      const router = new LLMRouter();
      const config = LLM_CONFIGS['claude-sonnet-4'];

      router.trackUsage('claude-sonnet-4', 1000, 1000, config);

      // Cost = (1000/1000) * 0.003 + (1000/1000) * 0.015 = 0.018
      expect(router.usageStats.totalCost).toBeCloseTo(0.018, 4);
    });

    it('should track by model', () => {
      const router = new LLMRouter();
      const config = LLM_CONFIGS['claude-sonnet-4'];

      router.trackUsage('claude-sonnet-4', 100, 50, config);
      router.trackUsage('claude-sonnet-4', 200, 100, config);

      expect(router.usageStats.byModel['claude-sonnet-4'].calls).toBe(2);
      expect(router.usageStats.byModel['claude-sonnet-4'].inputTokens).toBe(300);
      expect(router.usageStats.byModel['claude-sonnet-4'].outputTokens).toBe(150);
    });

    it('should track multiple models separately', () => {
      const router = new LLMRouter();

      router.trackUsage('claude-sonnet-4', 100, 50, LLM_CONFIGS['claude-sonnet-4']);
      router.trackUsage('claude-haiku', 200, 100, LLM_CONFIGS['claude-haiku']);

      expect(router.usageStats.byModel['claude-sonnet-4'].calls).toBe(1);
      expect(router.usageStats.byModel['claude-haiku'].calls).toBe(1);
    });
  });

  describe('getUsageStats', () => {
    it('should return current usage stats', () => {
      const router = new LLMRouter();
      const stats = router.getUsageStats();

      expect(stats).toBe(router.usageStats);
    });
  });

  describe('resetUsageStats', () => {
    it('should reset all usage stats', () => {
      const router = new LLMRouter();
      router.trackUsage('claude-sonnet-4', 100, 50, LLM_CONFIGS['claude-sonnet-4']);

      router.resetUsageStats();

      expect(router.usageStats.totalCalls).toBe(0);
      expect(router.usageStats.totalInputTokens).toBe(0);
      expect(router.usageStats.totalOutputTokens).toBe(0);
      expect(router.usageStats.totalCost).toBe(0);
      expect(router.usageStats.byModel).toEqual({});
    });
  });

  describe('complete', () => {
    it('should call appropriate provider', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();

      const result = await router.complete({
        modelId: 'claude-sonnet-4',
        systemPrompt: 'You are helpful.',
        userMessage: 'Hello'
      });

      expect(result.content).toBeDefined();
      expect(result.model).toBe('claude-sonnet-4');
      expect(result.provider).toBe('anthropic');
    });

    it('should include token counts in response', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();

      const result = await router.complete({
        modelId: 'claude-sonnet-4',
        systemPrompt: 'You are helpful.',
        userMessage: 'Hello'
      });

      expect(result.inputTokens).toBeDefined();
      expect(result.outputTokens).toBeDefined();
    });

    it('should include latency in response', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();

      const result = await router.complete({
        modelId: 'claude-sonnet-4',
        systemPrompt: 'You are helpful.',
        userMessage: 'Hello'
      });

      expect(result.latencyMs).toBeDefined();
      expect(typeof result.latencyMs).toBe('number');
    });

    it('should auto-select model when modelId not provided', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();

      const result = await router.complete({
        systemPrompt: 'You are helpful.',
        userMessage: 'Hello'
      });

      expect(result.model).toBeDefined();
    });

    it('should throw error for unknown model', async () => {
      const router = new LLMRouter();

      await expect(router.complete({
        modelId: 'unknown-model',
        systemPrompt: 'Test',
        userMessage: 'Test'
      })).rejects.toThrow('Unknown model');
    });

    it('should track usage after completion', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const router = new LLMRouter();

      await router.complete({
        modelId: 'claude-sonnet-4',
        systemPrompt: 'Test',
        userMessage: 'Test'
      });

      expect(router.usageStats.totalCalls).toBe(1);
    });
  });

  describe('provider methods', () => {
    describe('completeWithAnthropic', () => {
      it('should throw if Anthropic not initialized', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        const router = new LLMRouter();

        await expect(
          router.completeWithAnthropic(
            LLM_CONFIGS['claude-sonnet-4'],
            'System',
            'User',
            [],
            1000,
            0.7
          )
        ).rejects.toThrow('Anthropic not initialized');
      });
    });

    describe('completeWithGoogle', () => {
      it('should throw not implemented error', async () => {
        const router = new LLMRouter();

        await expect(
          router.completeWithGoogle(
            LLM_CONFIGS['gemini-1.5-pro'],
            'System',
            'User',
            [],
            1000,
            0.7
          )
        ).rejects.toThrow('not yet implemented');
      });
    });
  });
});
