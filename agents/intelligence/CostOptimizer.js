/**
 * MONOLITH OS - Cost Optimizer
 * Optimize LLM usage and reduce costs
 *
 * Features:
 * - Smart model selection based on task complexity
 * - Response caching for similar queries
 * - Budget tracking and limits
 * - Cost recommendations
 */

class CostOptimizer {
  constructor(config = {}) {
    this.budget = {
      daily: config.dailyBudget || 100,
      monthly: config.monthlyBudget || 2000,
      spent: {
        today: 0,
        thisMonth: 0,
      },
      lastReset: {
        daily: new Date().toDateString(),
        monthly: new Date().toISOString().slice(0, 7),
      },
    };

    this.modelCosts = {
      'claude-opus-4': { input: 15, output: 75 }, // per 1M tokens
      'claude-sonnet-4': { input: 3, output: 15 },
      'claude-haiku': { input: 0.25, output: 1.25 },
      'gpt-4o': { input: 5, output: 15 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gemini-1.5-pro': { input: 3.5, output: 10.5 },
      'gemini-1.5-flash': { input: 0.075, output: 0.3 },
    };

    this.cache = new Map();
    this.cacheMaxSize = config.cacheMaxSize || 1000;
    this.cacheTTL = config.cacheTTL || 3600000; // 1 hour

    this.complexityThresholds = {
      simple: 100,    // Token count for simple tasks
      medium: 500,    // Token count for medium tasks
      complex: 1000,  // Token count for complex tasks
    };

    this.history = [];
  }

  /**
   * Select optimal model based on task
   */
  selectModel(task, options = {}) {
    // Reset budget if needed
    this.checkBudgetReset();

    const complexity = this.assessComplexity(task);
    const priority = task.priority || 'MEDIUM';
    const role = task.assigned_role;

    // Check budget
    if (this.budget.spent.today >= this.budget.daily * 0.9) {
      // Near daily limit - use cheapest model
      return {
        model: 'claude-haiku',
        reason: 'near_daily_budget_limit',
        estimated_cost: this.estimateCost('claude-haiku', complexity.tokens),
      };
    }

    // Model selection logic
    let selectedModel;
    let reason;

    if (priority === 'CRITICAL') {
      // Always use best model for critical tasks
      selectedModel = 'claude-opus-4';
      reason = 'critical_priority';
    } else if (complexity.level === 'simple') {
      selectedModel = 'claude-haiku';
      reason = 'simple_task';
    } else if (complexity.level === 'medium') {
      selectedModel = 'claude-sonnet-4';
      reason = 'medium_complexity';
    } else {
      // Complex task
      if (priority === 'LOW') {
        selectedModel = 'claude-sonnet-4';
        reason = 'complex_but_low_priority';
      } else {
        selectedModel = 'claude-sonnet-4';
        reason = 'complex_task';
      }
    }

    // Role-specific overrides
    if (role === 'clo' || role === 'cco') {
      // Legal and compliance need more precise responses
      if (complexity.level !== 'simple') {
        selectedModel = 'claude-sonnet-4';
        reason = 'legal_compliance_precision';
      }
    }

    if (role === 'ciso') {
      // Security needs thorough analysis
      if (task.content?.toLowerCase().includes('incident')) {
        selectedModel = 'claude-sonnet-4';
        reason = 'security_incident';
      }
    }

    // Allow user override
    if (options.preferredModel) {
      selectedModel = options.preferredModel;
      reason = 'user_override';
    }

    return {
      model: selectedModel,
      reason,
      complexity,
      estimated_cost: this.estimateCost(selectedModel, complexity.tokens),
    };
  }

  /**
   * Assess task complexity
   */
  assessComplexity(task) {
    const content = task.content || '';
    const wordCount = content.split(/\s+/).length;
    const estimatedTokens = Math.ceil(wordCount * 1.3); // Rough estimate

    // Factor in additional complexity indicators
    let complexityScore = estimatedTokens;

    // Multi-step tasks are more complex
    if (content.includes('and') || content.includes('then')) {
      complexityScore *= 1.2;
    }

    // Questions requiring analysis are more complex
    const analyticalKeywords = ['analyze', 'evaluate', 'review', 'assess', 'compare'];
    if (analyticalKeywords.some(kw => content.toLowerCase().includes(kw))) {
      complexityScore *= 1.3;
    }

    // Technical tasks are more complex
    const technicalKeywords = ['architecture', 'security', 'compliance', 'legal', 'code'];
    if (technicalKeywords.some(kw => content.toLowerCase().includes(kw))) {
      complexityScore *= 1.2;
    }

    let level;
    if (complexityScore < this.complexityThresholds.simple) {
      level = 'simple';
    } else if (complexityScore < this.complexityThresholds.medium) {
      level = 'medium';
    } else if (complexityScore < this.complexityThresholds.complex) {
      level = 'complex';
    } else {
      level = 'very_complex';
    }

    return {
      level,
      score: complexityScore,
      tokens: Math.ceil(complexityScore),
      factors: {
        wordCount,
        estimatedTokens,
      },
    };
  }

  /**
   * Estimate cost for a task
   */
  estimateCost(model, tokens) {
    const costs = this.modelCosts[model];
    if (!costs) return 0;

    // Assume 2x output tokens vs input
    const inputCost = (tokens / 1000000) * costs.input;
    const outputCost = ((tokens * 2) / 1000000) * costs.output;

    return inputCost + outputCost;
  }

  /**
   * Record actual usage
   */
  recordUsage(data) {
    const { model, inputTokens, outputTokens, cost } = data;

    // Calculate cost if not provided
    const actualCost = cost || this.calculateCost(model, inputTokens, outputTokens);

    // Update budget
    this.budget.spent.today += actualCost;
    this.budget.spent.thisMonth += actualCost;

    // Store history
    this.history.push({
      model,
      inputTokens,
      outputTokens,
      cost: actualCost,
      timestamp: new Date().toISOString(),
    });

    // Keep history manageable
    if (this.history.length > 10000) {
      this.history = this.history.slice(-10000);
    }

    return {
      cost: actualCost,
      dailyRemaining: this.budget.daily - this.budget.spent.today,
      monthlyRemaining: this.budget.monthly - this.budget.spent.thisMonth,
    };
  }

  /**
   * Calculate actual cost
   */
  calculateCost(model, inputTokens, outputTokens) {
    const costs = this.modelCosts[model];
    if (!costs) return 0;

    const inputCost = (inputTokens / 1000000) * costs.input;
    const outputCost = (outputTokens / 1000000) * costs.output;

    return inputCost + outputCost;
  }

  /**
   * Check and cache response
   */
  checkCache(taskContent) {
    const cacheKey = this.generateCacheKey(taskContent);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return {
        hit: true,
        response: cached.response,
        savedCost: cached.cost,
      };
    }

    return { hit: false };
  }

  /**
   * Store response in cache
   */
  cacheResponse(taskContent, response, cost) {
    const cacheKey = this.generateCacheKey(taskContent);

    this.cache.set(cacheKey, {
      response,
      cost,
      timestamp: Date.now(),
    });

    // Enforce cache size limit
    if (this.cache.size > this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(content) {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `cache_${hash}`;
  }

  /**
   * Check and reset budget if needed
   */
  checkBudgetReset() {
    const today = new Date().toDateString();
    const thisMonth = new Date().toISOString().slice(0, 7);

    if (this.budget.lastReset.daily !== today) {
      this.budget.spent.today = 0;
      this.budget.lastReset.daily = today;
    }

    if (this.budget.lastReset.monthly !== thisMonth) {
      this.budget.spent.thisMonth = 0;
      this.budget.lastReset.monthly = thisMonth;
    }
  }

  /**
   * Get cost recommendations
   */
  getRecommendations() {
    this.checkBudgetReset();

    const recommendations = [];

    // Analyze usage patterns
    const last24h = this.history.filter(
      h => Date.now() - new Date(h.timestamp).getTime() < 86400000
    );

    if (last24h.length > 0) {
      // Calculate model usage breakdown
      const modelUsage = {};
      for (const entry of last24h) {
        modelUsage[entry.model] = modelUsage[entry.model] || { count: 0, cost: 0 };
        modelUsage[entry.model].count++;
        modelUsage[entry.model].cost += entry.cost;
      }

      // Check if expensive models are overused
      const opusUsage = modelUsage['claude-opus-4'];
      if (opusUsage && opusUsage.count > 10) {
        const potentialSavings = opusUsage.cost * 0.7;
        recommendations.push({
          type: 'model_downgrade',
          message: `Consider using Claude Sonnet for some Opus tasks`,
          potentialSavings: potentialSavings.toFixed(2),
          details: `${opusUsage.count} Opus calls in last 24h`,
        });
      }

      // Check cache hit rate
      const cacheHits = this.cache.size;
      if (cacheHits < 10 && last24h.length > 50) {
        recommendations.push({
          type: 'caching',
          message: 'Enable response caching for repeated queries',
          potentialSavings: (last24h.reduce((s, h) => s + h.cost, 0) * 0.1).toFixed(2),
        });
      }
    }

    // Budget warnings
    const dailyUsage = this.budget.spent.today / this.budget.daily;
    if (dailyUsage > 0.8) {
      recommendations.push({
        type: 'budget_warning',
        message: `Daily budget ${Math.round(dailyUsage * 100)}% used`,
        severity: dailyUsage > 0.95 ? 'critical' : 'warning',
      });
    }

    return recommendations;
  }

  /**
   * Get cost summary
   */
  getSummary() {
    this.checkBudgetReset();

    const last24h = this.history.filter(
      h => Date.now() - new Date(h.timestamp).getTime() < 86400000
    );

    return {
      budget: {
        daily: this.budget.daily,
        monthly: this.budget.monthly,
        spentToday: this.budget.spent.today,
        spentThisMonth: this.budget.spent.thisMonth,
        remainingToday: this.budget.daily - this.budget.spent.today,
        remainingThisMonth: this.budget.monthly - this.budget.spent.thisMonth,
      },
      last24h: {
        calls: last24h.length,
        cost: last24h.reduce((s, h) => s + h.cost, 0),
        tokens: last24h.reduce((s, h) => s + (h.inputTokens || 0) + (h.outputTokens || 0), 0),
      },
      cache: {
        size: this.cache.size,
        maxSize: this.cacheMaxSize,
      },
      recommendations: this.getRecommendations(),
    };
  }

  /**
   * Set budget limits
   */
  setBudget(daily, monthly) {
    this.budget.daily = daily;
    this.budget.monthly = monthly;
  }
}

export default CostOptimizer;
