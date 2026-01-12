/**
 * MONOLITH OS - LLM Router
 * Intelligent routing of tasks to the most appropriate LLM
 * Supports: Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google), Local (Ollama)
 */

import Anthropic from '@anthropic-ai/sdk';

// LLM Provider configurations
const LLM_CONFIGS = {
  'claude-opus-4': {
    provider: 'anthropic',
    model: 'claude-opus-4-20250514',
    maxTokens: 8192,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    capabilities: ['strategic', 'reasoning', 'analysis', 'creative'],
  },
  'claude-sonnet-4': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8192,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    capabilities: ['analysis', 'coding', 'documentation', 'general'],
  },
  'claude-haiku': {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    maxTokens: 4096,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    capabilities: ['routing', 'classification', 'summarization', 'fast'],
  },
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 4096,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    capabilities: ['structured', 'json', 'coding', 'general'],
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    capabilities: ['fast', 'classification', 'simple'],
  },
  'gemini-1.5-pro': {
    provider: 'google',
    model: 'gemini-1.5-pro',
    maxTokens: 8192,
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
    capabilities: ['long-context', 'documents', 'analysis'],
  },
  'ollama-llama3': {
    provider: 'ollama',
    model: 'llama3',
    maxTokens: 4096,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    capabilities: ['privacy', 'local', 'general'],
  },
};

// Task type to LLM mapping
const TASK_TYPE_ROUTING = {
  strategic_decision: ['claude-opus-4', 'gpt-4o'],
  document_draft: ['claude-sonnet-4', 'gpt-4o'],
  analysis: ['claude-sonnet-4', 'gemini-1.5-pro'],
  code_review: ['claude-sonnet-4', 'gpt-4o'],
  routing: ['claude-haiku', 'gpt-4o-mini'],
  classification: ['claude-haiku', 'gpt-4o-mini'],
  summarization: ['claude-sonnet-4', 'claude-haiku'],
  long_document: ['gemini-1.5-pro', 'claude-sonnet-4'],
  structured_output: ['gpt-4o', 'claude-sonnet-4'],
  privacy_sensitive: ['ollama-llama3'],
  general: ['claude-sonnet-4', 'gpt-4o'],
};

class LLMRouter {
  constructor(config = {}) {
    this.anthropic = null;
    this.openai = null;
    this.usageStats = {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      byModel: {},
    };

    // Initialize providers based on available API keys
    this.initializeProviders(config);
  }

  initializeProviders(config) {
    // Anthropic (Claude)
    if (process.env.ANTHROPIC_API_KEY || config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      });
      console.log('[LLM-ROUTER] Anthropic provider initialized');
    }

    // OpenAI (GPT-4)
    if (process.env.OPENAI_API_KEY || config.openaiApiKey) {
      // Dynamic import for OpenAI when needed
      this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
      console.log('[LLM-ROUTER] OpenAI provider configured');
    }

    // Google (Gemini) - placeholder
    if (process.env.GOOGLE_AI_API_KEY || config.googleApiKey) {
      this.googleApiKey = config.googleApiKey || process.env.GOOGLE_AI_API_KEY;
      console.log('[LLM-ROUTER] Google AI provider configured');
    }

    // Ollama (Local)
    this.ollamaEndpoint = config.ollamaEndpoint || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
  }

  /**
   * Select the best LLM for a given task
   */
  selectLLM(task) {
    const { type, containsPII, confidential, priority, contextLength } = task;

    // Privacy-sensitive data always uses local
    if (containsPII || confidential) {
      return 'ollama-llama3';
    }

    // Long context documents
    if (contextLength && contextLength > 100000) {
      return 'gemini-1.5-pro';
    }

    // Get candidates for task type
    const taskType = type || 'general';
    const candidates = TASK_TYPE_ROUTING[taskType] || TASK_TYPE_ROUTING.general;

    // Select first available provider
    for (const modelId of candidates) {
      const config = LLM_CONFIGS[modelId];
      if (this.isProviderAvailable(config.provider)) {
        return modelId;
      }
    }

    // Fallback
    return this.anthropic ? 'claude-sonnet-4' : 'gpt-4o';
  }

  isProviderAvailable(provider) {
    switch (provider) {
      case 'anthropic':
        return !!this.anthropic;
      case 'openai':
        return !!this.openaiApiKey;
      case 'google':
        return !!this.googleApiKey;
      case 'ollama':
        return true; // Assume local is always available
      default:
        return false;
    }
  }

  /**
   * Execute a completion request
   */
  async complete(options) {
    const {
      modelId,
      systemPrompt,
      userMessage,
      messages = [],
      maxTokens = 4096,
      temperature = 0.7,
      jsonMode = false,
    } = options;

    const selectedModel = modelId || this.selectLLM({ type: 'general' });
    const config = LLM_CONFIGS[selectedModel];

    if (!config) {
      throw new Error(`Unknown model: ${selectedModel}`);
    }

    const startTime = Date.now();
    let result;

    try {
      switch (config.provider) {
        case 'anthropic':
          result = await this.completeWithAnthropic(config, systemPrompt, userMessage, messages, maxTokens, temperature);
          break;
        case 'openai':
          result = await this.completeWithOpenAI(config, systemPrompt, userMessage, messages, maxTokens, temperature, jsonMode);
          break;
        case 'google':
          result = await this.completeWithGoogle(config, systemPrompt, userMessage, messages, maxTokens, temperature);
          break;
        case 'ollama':
          result = await this.completeWithOllama(config, systemPrompt, userMessage, messages, maxTokens, temperature);
          break;
        default:
          throw new Error(`Unsupported provider: ${config.provider}`);
      }

      // Track usage
      this.trackUsage(selectedModel, result.inputTokens, result.outputTokens, config);

      return {
        content: result.content,
        model: selectedModel,
        provider: config.provider,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`[LLM-ROUTER] Error with ${selectedModel}:`, error.message);

      // Try fallback
      const fallbacks = TASK_TYPE_ROUTING.general.filter((m) => m !== selectedModel);
      for (const fallbackModel of fallbacks) {
        const fallbackConfig = LLM_CONFIGS[fallbackModel];
        if (this.isProviderAvailable(fallbackConfig.provider)) {
          console.log(`[LLM-ROUTER] Falling back to ${fallbackModel}`);
          return this.complete({ ...options, modelId: fallbackModel });
        }
      }

      throw error;
    }
  }

  async completeWithAnthropic(config, systemPrompt, userMessage, messages, maxTokens, temperature) {
    if (!this.anthropic) {
      throw new Error('Anthropic not initialized');
    }

    const formattedMessages = messages.length > 0
      ? messages
      : [{ role: 'user', content: userMessage }];

    const response = await this.anthropic.messages.create({
      model: config.model,
      max_tokens: Math.min(maxTokens, config.maxTokens),
      temperature,
      system: systemPrompt,
      messages: formattedMessages,
    });

    return {
      content: response.content[0].text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  async completeWithOpenAI(config, systemPrompt, userMessage, messages, maxTokens, temperature, jsonMode) {
    // Dynamic import OpenAI
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: this.openaiApiKey });

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages.length > 0 ? messages : [{ role: 'user', content: userMessage }]),
    ];

    const response = await openai.chat.completions.create({
      model: config.model,
      max_tokens: Math.min(maxTokens, config.maxTokens),
      temperature,
      messages: formattedMessages,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    });

    return {
      content: response.choices[0].message.content,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
    };
  }

  async completeWithGoogle(config, systemPrompt, userMessage, messages, maxTokens, temperature) {
    // Placeholder for Google Gemini integration
    throw new Error('Google Gemini integration not yet implemented');
  }

  async completeWithOllama(config, systemPrompt, userMessage, messages, maxTokens, temperature) {
    const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: `${systemPrompt}\n\nUser: ${userMessage}`,
        stream: false,
        options: {
          num_predict: maxTokens,
          temperature,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.response,
      inputTokens: data.prompt_eval_count || 0,
      outputTokens: data.eval_count || 0,
    };
  }

  trackUsage(modelId, inputTokens, outputTokens, config) {
    const cost =
      (inputTokens / 1000) * config.costPer1kInput +
      (outputTokens / 1000) * config.costPer1kOutput;

    this.usageStats.totalCalls++;
    this.usageStats.totalInputTokens += inputTokens;
    this.usageStats.totalOutputTokens += outputTokens;
    this.usageStats.totalCost += cost;

    if (!this.usageStats.byModel[modelId]) {
      this.usageStats.byModel[modelId] = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    }
    this.usageStats.byModel[modelId].calls++;
    this.usageStats.byModel[modelId].inputTokens += inputTokens;
    this.usageStats.byModel[modelId].outputTokens += outputTokens;
    this.usageStats.byModel[modelId].cost += cost;
  }

  getUsageStats() {
    return this.usageStats;
  }

  resetUsageStats() {
    this.usageStats = {
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      byModel: {},
    };
  }
}

export default LLMRouter;
export { LLM_CONFIGS, TASK_TYPE_ROUTING };
