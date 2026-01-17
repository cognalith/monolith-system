/**
 * MONOLITH OS - Metering Service
 * Phase 7: Usage metering and billing
 *
 * Tracks and meters usage across the system including:
 * - LLM token consumption and costs
 * - Task processing
 * - Email notifications
 * - Browser automation sessions
 */

import tenantService from './TenantService.js';

/**
 * Metric types for metering
 */
export const MetricType = {
  LLM_TOKENS: 'LLM_TOKENS',
  LLM_COST: 'LLM_COST',
  TASKS_PROCESSED: 'TASKS_PROCESSED',
  EMAILS_SENT: 'EMAILS_SENT',
  BROWSER_SESSIONS: 'BROWSER_SESSIONS',
  API_CALLS: 'API_CALLS',
  STORAGE_BYTES: 'STORAGE_BYTES'
};

/**
 * LLM model pricing (per 1000 tokens)
 */
export const LLM_PRICING = {
  // OpenAI models
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },

  // Anthropic models
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },

  // Google models
  'gemini-pro': { input: 0.00025, output: 0.0005 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },

  // Default fallback
  'default': { input: 0.001, output: 0.002 }
};

/**
 * Service pricing
 */
export const SERVICE_PRICING = {
  emailSent: 0.001, // per email
  browserSession: 0.01, // per session
  storageGb: 0.02 // per GB per month
};

/**
 * MeteringService class
 * Tracks and manages usage metering
 */
export class MeteringService {
  constructor(options = {}) {
    this.tenantService = options.tenantService || tenantService;
    this.defaultTenantId = options.defaultTenantId || '00000000-0000-0000-0000-000000000001';

    // In-memory buffer for batch recording
    this.usageBuffer = [];
    this.bufferFlushInterval = options.bufferFlushInterval || 10000; // 10 seconds
    this.bufferMaxSize = options.bufferMaxSize || 100;

    // Start buffer flush timer
    this._startBufferFlush();
  }

  /**
   * Start periodic buffer flushing
   */
  _startBufferFlush() {
    this.flushTimer = setInterval(async () => {
      await this._flushBuffer();
    }, this.bufferFlushInterval);
  }

  /**
   * Stop buffer flushing
   */
  stopBufferFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
  }

  /**
   * Flush usage buffer to storage
   */
  async _flushBuffer() {
    if (this.usageBuffer.length === 0) return;

    const toFlush = [...this.usageBuffer];
    this.usageBuffer = [];

    for (const usage of toFlush) {
      try {
        await this.tenantService.recordUsage(usage.tenantId, usage);
      } catch (error) {
        console.error('[MeteringService] Failed to flush usage record:', error.message);
        // Re-add to buffer for retry
        this.usageBuffer.push(usage);
      }
    }
  }

  /**
   * Add usage to buffer
   */
  _bufferUsage(usage) {
    this.usageBuffer.push(usage);

    // Flush if buffer is full
    if (this.usageBuffer.length >= this.bufferMaxSize) {
      this._flushBuffer().catch(err => {
        console.error('[MeteringService] Buffer flush failed:', err.message);
      });
    }
  }

  /**
   * Record LLM usage
   * @param {object} params - Usage parameters
   * @returns {Promise<object>} Recorded usage
   */
  async recordLLMUsage(params) {
    const {
      tenantId = this.defaultTenantId,
      model = 'default',
      inputTokens = 0,
      outputTokens = 0,
      taskId,
      agentId,
      requestId
    } = params;

    const totalTokens = inputTokens + outputTokens;
    const pricing = LLM_PRICING[model] || LLM_PRICING.default;

    // Calculate cost
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    // Record token usage
    const tokenUsage = {
      tenantId,
      metricType: MetricType.LLM_TOKENS,
      quantity: totalTokens,
      unit: 'tokens',
      metadata: {
        model,
        inputTokens,
        outputTokens,
        taskId,
        agentId,
        requestId
      }
    };

    // Record cost usage
    const costUsage = {
      tenantId,
      metricType: MetricType.LLM_COST,
      quantity: totalCost,
      unit: 'USD',
      unitCost: 1,
      metadata: {
        model,
        inputCost,
        outputCost,
        inputTokens,
        outputTokens,
        taskId,
        agentId,
        requestId
      }
    };

    // Buffer both records
    this._bufferUsage(tokenUsage);
    this._bufferUsage(costUsage);

    console.log(`[MeteringService] LLM usage: ${model} - ${totalTokens} tokens, $${totalCost.toFixed(6)}`);

    return {
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens
      },
      cost: {
        input: inputCost,
        output: outputCost,
        total: totalCost
      },
      model
    };
  }

  /**
   * Record task processing
   * @param {object} params - Usage parameters
   * @returns {Promise<object>} Recorded usage
   */
  async recordTaskProcessed(params) {
    const {
      tenantId = this.defaultTenantId,
      taskId,
      agentId,
      status = 'completed',
      processingTimeMs
    } = params;

    const usage = {
      tenantId,
      metricType: MetricType.TASKS_PROCESSED,
      quantity: 1,
      unit: 'tasks',
      metadata: {
        taskId,
        agentId,
        status,
        processingTimeMs
      }
    };

    this._bufferUsage(usage);

    console.log(`[MeteringService] Task processed: ${taskId} (${status})`);

    return usage;
  }

  /**
   * Record email sent
   * @param {object} params - Usage parameters
   * @returns {Promise<object>} Recorded usage
   */
  async recordEmailSent(params) {
    const {
      tenantId = this.defaultTenantId,
      recipient,
      subject,
      messageId,
      templateId
    } = params;

    const usage = {
      tenantId,
      metricType: MetricType.EMAILS_SENT,
      quantity: 1,
      unit: 'emails',
      unitCost: SERVICE_PRICING.emailSent,
      metadata: {
        recipient,
        subject,
        messageId,
        templateId
      }
    };

    this._bufferUsage(usage);

    console.log(`[MeteringService] Email sent to: ${recipient}`);

    return usage;
  }

  /**
   * Record browser session
   * @param {object} params - Usage parameters
   * @returns {Promise<object>} Recorded usage
   */
  async recordBrowserSession(params) {
    const {
      tenantId = this.defaultTenantId,
      sessionId,
      taskId,
      agentId,
      durationMs,
      pagesVisited = 0,
      actionsPerformed = 0
    } = params;

    const usage = {
      tenantId,
      metricType: MetricType.BROWSER_SESSIONS,
      quantity: 1,
      unit: 'sessions',
      unitCost: SERVICE_PRICING.browserSession,
      metadata: {
        sessionId,
        taskId,
        agentId,
        durationMs,
        pagesVisited,
        actionsPerformed
      }
    };

    this._bufferUsage(usage);

    console.log(`[MeteringService] Browser session: ${sessionId} (${durationMs}ms)`);

    return usage;
  }

  /**
   * Record API call
   * @param {object} params - Usage parameters
   * @returns {Promise<object>} Recorded usage
   */
  async recordApiCall(params) {
    const {
      tenantId = this.defaultTenantId,
      endpoint,
      method,
      statusCode,
      responseTimeMs,
      requestId
    } = params;

    const usage = {
      tenantId,
      metricType: MetricType.API_CALLS,
      quantity: 1,
      unit: 'calls',
      metadata: {
        endpoint,
        method,
        statusCode,
        responseTimeMs,
        requestId
      }
    };

    this._bufferUsage(usage);

    return usage;
  }

  /**
   * Get billable usage for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {object} options - Query options
   * @returns {Promise<object>} Billable usage summary
   */
  async getBillableUsage(tenantId, options = {}) {
    const {
      periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      periodEnd = new Date()
    } = options;

    // Flush buffer to ensure latest data
    await this._flushBuffer();

    // Get usage summary from tenant service
    const summary = await this.tenantService.getUsageSummary(tenantId, {
      periodStart,
      periodEnd
    });

    // Calculate costs by category
    const billableUsage = {
      tenantId,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString()
      },
      categories: {
        llm: {
          tokens: summary.metrics[MetricType.LLM_TOKENS]?.quantity || 0,
          cost: summary.metrics[MetricType.LLM_COST]?.quantity || 0
        },
        tasks: {
          processed: summary.metrics[MetricType.TASKS_PROCESSED]?.quantity || 0,
          cost: 0 // Tasks are included in plan
        },
        email: {
          sent: summary.metrics[MetricType.EMAILS_SENT]?.quantity || 0,
          cost: (summary.metrics[MetricType.EMAILS_SENT]?.quantity || 0) * SERVICE_PRICING.emailSent
        },
        browser: {
          sessions: summary.metrics[MetricType.BROWSER_SESSIONS]?.quantity || 0,
          cost: (summary.metrics[MetricType.BROWSER_SESSIONS]?.quantity || 0) * SERVICE_PRICING.browserSession
        },
        api: {
          calls: summary.metrics[MetricType.API_CALLS]?.quantity || 0,
          cost: 0 // API calls are included in plan
        }
      },
      totalCost: 0
    };

    // Calculate total cost
    billableUsage.totalCost =
      billableUsage.categories.llm.cost +
      billableUsage.categories.email.cost +
      billableUsage.categories.browser.cost;

    // Get tenant info for plan details
    const tenant = await this.tenantService.getTenant(tenantId);
    if (tenant) {
      billableUsage.plan = tenant.plan;
      billableUsage.limits = tenant.planLimits;
    }

    return billableUsage;
  }

  /**
   * Get usage trends for a tenant
   * @param {string} tenantId - Tenant ID
   * @param {string} metricType - Metric type
   * @param {number} days - Number of days to look back
   * @returns {Promise<object[]>} Daily usage data
   */
  async getUsageTrends(tenantId, metricType, days = 30) {
    const trends = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const summary = await this.tenantService.getUsageSummary(tenantId, {
        periodStart: date,
        periodEnd: nextDate
      });

      trends.push({
        date: date.toISOString().split('T')[0],
        quantity: summary.metrics[metricType]?.quantity || 0,
        cost: summary.metrics[metricType]?.cost || 0
      });
    }

    return trends;
  }

  /**
   * Check if usage is approaching limits
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<object>} Limit warnings
   */
  async checkUsageLimits(tenantId) {
    const billableUsage = await this.getBillableUsage(tenantId);
    const warnings = [];

    if (!billableUsage.limits) {
      return { warnings: [], healthy: true };
    }

    // Check LLM tokens
    const tokenLimit = billableUsage.limits.maxLlmTokensPerMonth;
    if (tokenLimit > 0) {
      const tokenUsagePercent = (billableUsage.categories.llm.tokens / tokenLimit) * 100;
      if (tokenUsagePercent >= 90) {
        warnings.push({
          metric: MetricType.LLM_TOKENS,
          current: billableUsage.categories.llm.tokens,
          limit: tokenLimit,
          percentage: tokenUsagePercent,
          severity: tokenUsagePercent >= 100 ? 'critical' : 'warning'
        });
      }
    }

    // Check tasks processed
    const taskLimit = billableUsage.limits.maxTasksPerMonth;
    if (taskLimit > 0) {
      const taskUsagePercent = (billableUsage.categories.tasks.processed / taskLimit) * 100;
      if (taskUsagePercent >= 90) {
        warnings.push({
          metric: MetricType.TASKS_PROCESSED,
          current: billableUsage.categories.tasks.processed,
          limit: taskLimit,
          percentage: taskUsagePercent,
          severity: taskUsagePercent >= 100 ? 'critical' : 'warning'
        });
      }
    }

    return {
      warnings,
      healthy: warnings.length === 0,
      criticalCount: warnings.filter(w => w.severity === 'critical').length
    };
  }

  /**
   * Estimate cost for a planned operation
   * @param {object} operation - Operation details
   * @returns {object} Cost estimate
   */
  estimateCost(operation) {
    const { type, params } = operation;

    switch (type) {
      case 'llm_request': {
        const { model = 'default', estimatedInputTokens = 0, estimatedOutputTokens = 0 } = params;
        const pricing = LLM_PRICING[model] || LLM_PRICING.default;
        const inputCost = (estimatedInputTokens / 1000) * pricing.input;
        const outputCost = (estimatedOutputTokens / 1000) * pricing.output;
        return {
          tokens: estimatedInputTokens + estimatedOutputTokens,
          cost: inputCost + outputCost,
          breakdown: { inputCost, outputCost }
        };
      }

      case 'email_batch': {
        const { count = 0 } = params;
        return {
          count,
          cost: count * SERVICE_PRICING.emailSent
        };
      }

      case 'browser_automation': {
        const { estimatedSessions = 1 } = params;
        return {
          sessions: estimatedSessions,
          cost: estimatedSessions * SERVICE_PRICING.browserSession
        };
      }

      default:
        return { cost: 0 };
    }
  }
}

// Export singleton instance
const meteringService = new MeteringService();
export default meteringService;
