/**
 * TOKEN TRACKER - Phase 8 Token Efficiency
 * Cognalith Inc. | Monolith System
 *
 * Tracks and estimates token usage for LLM calls:
 * - Pre-execution token estimation
 * - Actual usage tracking
 * - Cost calculation
 * - Efficiency metrics
 */

import { createClient } from '@supabase/supabase-js';

// Token pricing per 1K tokens (as of 2026)
const MODEL_PRICING = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
};

// Default model for cost estimation
const DEFAULT_MODEL = 'gpt-4o-mini';

// Average tokens per character (rough estimate)
const TOKENS_PER_CHAR = 0.25;

// Base tokens for system prompts per agent role
const AGENT_BASE_TOKENS = {
  ceo: 1500,
  cfo: 1200,
  cto: 1400,
  coo: 1100,
  cmo: 1200,
  cpo: 1100,
  cos: 1300,
  ciso: 1200,
  clo: 1100,
  chro: 1000,
  devops: 1000,
  qa: 900,
  swe: 1000,
  default: 1000,
};

// Task complexity multipliers
const COMPLEXITY_MULTIPLIERS = {
  trivial: 0.5,
  simple: 1.0,
  moderate: 1.5,
  complex: 2.5,
  critical: 3.0,
};

/**
 * TokenTracker class for managing token usage
 */
class TokenTracker {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.config = config;
    this.currentSession = {
      totalTokens: 0,
      totalCost: 0,
      callCount: 0,
    };

    this.initialize();
  }

  /**
   * Initialize Supabase connection
   */
  initialize() {
    const supabaseUrl = this.config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = this.config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: true, persistSession: false },
      });
      this.isConnected = true;
      console.log('[TOKEN-TRACKER] Connected to Supabase');
    } else {
      console.warn('[TOKEN-TRACKER] No Supabase credentials found');
    }
  }

  /**
   * Estimate tokens for a task before execution
   * @param {Object} task - The task object
   * @returns {Object} Token estimation
   */
  estimateTaskTokens(task) {
    const agentRole = task.assigned_agent || 'default';
    const baseTokens = AGENT_BASE_TOKENS[agentRole] || AGENT_BASE_TOKENS.default;

    // Estimate input tokens from task content
    const titleTokens = this.estimateTextTokens(task.title || '');
    const descTokens = this.estimateTextTokens(task.description || '');
    const metadataTokens = this.estimateTextTokens(JSON.stringify(task.metadata || {}));

    // Determine complexity
    const complexity = this.determineComplexity(task);
    const multiplier = COMPLEXITY_MULTIPLIERS[complexity];

    // Calculate estimated tokens
    const inputTokens = Math.ceil((baseTokens + titleTokens + descTokens + metadataTokens) * multiplier);

    // Estimate output tokens (typically 50-150% of input for task completion)
    const outputRatio = complexity === 'complex' || complexity === 'critical' ? 1.5 : 1.0;
    const outputTokens = Math.ceil(inputTokens * outputRatio);

    const totalTokens = inputTokens + outputTokens;

    // Calculate cost estimate
    const model = this.config.defaultModel || DEFAULT_MODEL;
    const cost = this.calculateCost(inputTokens, outputTokens, model);

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: cost,
      model,
      complexity,
      breakdown: {
        baseTokens,
        titleTokens,
        descTokens,
        metadataTokens,
        multiplier,
      },
    };
  }

  /**
   * Estimate tokens for a text string
   * @param {string} text - The text to estimate
   * @returns {number} Estimated token count
   */
  estimateTextTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length * TOKENS_PER_CHAR);
  }

  /**
   * Determine task complexity based on various factors
   * @param {Object} task - The task object
   * @returns {string} Complexity level
   */
  determineComplexity(task) {
    const priority = task.priority || 50;
    const hasDescription = !!task.description;
    const hasSteps = task.metadata?.steps?.length > 0;
    const tags = task.tags || [];

    // Priority-based complexity
    if (priority >= 100) return 'critical';
    if (priority >= 75) {
      if (hasSteps || tags.includes('complex')) return 'complex';
      return 'moderate';
    }
    if (priority >= 50) return hasDescription ? 'moderate' : 'simple';
    return 'trivial';
  }

  /**
   * Calculate cost for token usage
   * @param {number} inputTokens - Input token count
   * @param {number} outputTokens - Output token count
   * @param {string} model - Model name
   * @returns {number} Cost in USD
   */
  calculateCost(inputTokens, outputTokens, model = DEFAULT_MODEL) {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    return Math.round((inputCost + outputCost) * 1000000) / 1000000; // 6 decimal places
  }

  /**
   * Record actual token usage for a task
   * @param {Object} params - Usage parameters
   * @returns {Promise<Object>} Recorded usage
   */
  async recordUsage(params) {
    const {
      taskId,
      agentRole,
      model = DEFAULT_MODEL,
      inputTokens,
      outputTokens,
      latencyMs,
      callType = 'task_execution',
      promptTemplate,
    } = params;

    const totalTokens = inputTokens + outputTokens;
    const cost = this.calculateCost(inputTokens, outputTokens, model);

    // Update session totals
    this.currentSession.totalTokens += totalTokens;
    this.currentSession.totalCost += cost;
    this.currentSession.callCount++;

    console.log(`[TOKEN-TRACKER] ${agentRole} used ${totalTokens} tokens ($${cost.toFixed(6)})`);

    if (!this.isConnected) {
      return { totalTokens, cost, logged: false };
    }

    // Log to token_usage_log
    const { data: logData, error: logError } = await this.supabase
      .from('monolith_token_usage_log')
      .insert([{
        task_id: taskId,
        agent_role: agentRole,
        model,
        provider: model.startsWith('claude') ? 'anthropic' : 'openai',
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        tokens_total: totalTokens,
        cost_usd: cost,
        latency_ms: latencyMs,
        call_type: callType,
        prompt_template: promptTemplate,
      }])
      .select()
      .single();

    if (logError) {
      console.error('[TOKEN-TRACKER] Log error:', logError.message);
    }

    // Update task with token usage
    if (taskId) {
      await this.updateTaskTokens(taskId, {
        tokensInput: inputTokens,
        tokensOutput: outputTokens,
        tokensTotal: totalTokens,
        cost,
        model,
        incrementCalls: true,
      });
    }

    return {
      totalTokens,
      cost,
      logged: !logError,
      logId: logData?.id,
    };
  }

  /**
   * Update task with token usage
   * @param {string} taskId - Task ID
   * @param {Object} tokenData - Token data
   */
  async updateTaskTokens(taskId, tokenData) {
    if (!this.isConnected) return;

    // Get current task data
    const { data: task } = await this.supabase
      .from('monolith_task_queue')
      .select('tokens_input, tokens_output, tokens_total, llm_calls, execution_cost_usd')
      .eq('id', taskId)
      .single();

    const currentInput = task?.tokens_input || 0;
    const currentOutput = task?.tokens_output || 0;
    const currentTotal = task?.tokens_total || 0;
    const currentCalls = task?.llm_calls || 0;
    const currentCost = parseFloat(task?.execution_cost_usd || 0);

    const { error } = await this.supabase
      .from('monolith_task_queue')
      .update({
        tokens_input: currentInput + tokenData.tokensInput,
        tokens_output: currentOutput + tokenData.tokensOutput,
        tokens_total: currentTotal + tokenData.tokensTotal,
        llm_calls: currentCalls + (tokenData.incrementCalls ? 1 : 0),
        execution_cost_usd: currentCost + tokenData.cost,
        model_used: tokenData.model,
      })
      .eq('id', taskId);

    if (error) {
      console.error('[TOKEN-TRACKER] Update task error:', error.message);
    }
  }

  /**
   * Set estimated tokens for a task before execution
   * @param {string} taskId - Task ID
   * @param {number} estimatedTokens - Estimated tokens
   */
  async setEstimatedTokens(taskId, estimatedTokens) {
    if (!this.isConnected) return;

    const { error } = await this.supabase
      .from('monolith_task_queue')
      .update({ tokens_estimated: estimatedTokens })
      .eq('id', taskId);

    if (error) {
      console.error('[TOKEN-TRACKER] Set estimate error:', error.message);
    }
  }

  /**
   * Update daily agent stats
   * @param {string} agentRole - Agent role
   * @param {Object} stats - Stats to add
   */
  async updateAgentStats(agentRole, stats) {
    if (!this.isConnected) return;

    const today = new Date().toISOString().split('T')[0];

    // Upsert agent stats
    const { data: existing } = await this.supabase
      .from('monolith_agent_token_stats')
      .select('*')
      .eq('agent_role', agentRole)
      .eq('stats_date', today)
      .single();

    if (existing) {
      // Update existing record
      const { error } = await this.supabase
        .from('monolith_agent_token_stats')
        .update({
          tasks_executed: existing.tasks_executed + (stats.executed || 0),
          tasks_completed: existing.tasks_completed + (stats.completed || 0),
          tasks_failed: existing.tasks_failed + (stats.failed || 0),
          total_tokens_estimated: existing.total_tokens_estimated + (stats.tokensEstimated || 0),
          total_tokens_input: existing.total_tokens_input + (stats.tokensInput || 0),
          total_tokens_output: existing.total_tokens_output + (stats.tokensOutput || 0),
          total_tokens_used: existing.total_tokens_used + (stats.tokensUsed || 0),
          total_llm_calls: existing.total_llm_calls + (stats.llmCalls || 0),
          total_cost_usd: parseFloat(existing.total_cost_usd || 0) + (stats.cost || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('[TOKEN-TRACKER] Update stats error:', error.message);
      }
    } else {
      // Insert new record
      const { error } = await this.supabase
        .from('monolith_agent_token_stats')
        .insert([{
          agent_role: agentRole,
          stats_date: today,
          tasks_executed: stats.executed || 0,
          tasks_completed: stats.completed || 0,
          tasks_failed: stats.failed || 0,
          total_tokens_estimated: stats.tokensEstimated || 0,
          total_tokens_input: stats.tokensInput || 0,
          total_tokens_output: stats.tokensOutput || 0,
          total_tokens_used: stats.tokensUsed || 0,
          total_llm_calls: stats.llmCalls || 0,
          total_cost_usd: stats.cost || 0,
        }]);

      if (error) {
        console.error('[TOKEN-TRACKER] Insert stats error:', error.message);
      }
    }
  }

  /**
   * Get token stats for an agent
   * @param {string} agentRole - Agent role
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Agent stats
   */
  async getAgentStats(agentRole, days = 7) {
    if (!this.isConnected) {
      return { error: 'Database unavailable' };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('monolith_agent_token_stats')
      .select('*')
      .eq('agent_role', agentRole)
      .gte('stats_date', startDate.toISOString().split('T')[0])
      .order('stats_date', { ascending: false });

    if (error) {
      return { error: error.message };
    }

    // Aggregate stats
    const totals = data.reduce((acc, day) => ({
      tasksExecuted: acc.tasksExecuted + day.tasks_executed,
      tasksCompleted: acc.tasksCompleted + day.tasks_completed,
      tasksFailed: acc.tasksFailed + day.tasks_failed,
      tokensEstimated: acc.tokensEstimated + day.total_tokens_estimated,
      tokensUsed: acc.tokensUsed + day.total_tokens_used,
      llmCalls: acc.llmCalls + day.total_llm_calls,
      cost: acc.cost + parseFloat(day.total_cost_usd || 0),
    }), {
      tasksExecuted: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      tokensEstimated: 0,
      tokensUsed: 0,
      llmCalls: 0,
      cost: 0,
    });

    // Calculate efficiency
    const efficiency = totals.tokensEstimated > 0
      ? Math.round((totals.tokensUsed / totals.tokensEstimated) * 100)
      : 100;

    return {
      agentRole,
      period: `${days} days`,
      daily: data,
      totals,
      efficiency: `${efficiency}%`,
      avgTokensPerTask: totals.tasksExecuted > 0
        ? Math.round(totals.tokensUsed / totals.tasksExecuted)
        : 0,
      avgCostPerTask: totals.tasksExecuted > 0
        ? (totals.cost / totals.tasksExecuted).toFixed(6)
        : 0,
    };
  }

  /**
   * Get system-wide token stats
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} System stats
   */
  async getSystemStats(days = 7) {
    if (!this.isConnected) {
      return { error: 'Database unavailable' };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('monolith_agent_token_stats')
      .select('*')
      .gte('stats_date', startDate.toISOString().split('T')[0]);

    if (error) {
      return { error: error.message };
    }

    // Aggregate by agent
    const byAgent = {};
    let totalTokens = 0;
    let totalCost = 0;
    let totalTasks = 0;

    for (const row of data) {
      if (!byAgent[row.agent_role]) {
        byAgent[row.agent_role] = {
          tokensUsed: 0,
          cost: 0,
          tasks: 0,
        };
      }
      byAgent[row.agent_role].tokensUsed += row.total_tokens_used;
      byAgent[row.agent_role].cost += parseFloat(row.total_cost_usd || 0);
      byAgent[row.agent_role].tasks += row.tasks_executed;

      totalTokens += row.total_tokens_used;
      totalCost += parseFloat(row.total_cost_usd || 0);
      totalTasks += row.tasks_executed;
    }

    return {
      period: `${days} days`,
      totalTokens,
      totalCost: totalCost.toFixed(6),
      totalTasks,
      avgTokensPerTask: totalTasks > 0 ? Math.round(totalTokens / totalTasks) : 0,
      avgCostPerTask: totalTasks > 0 ? (totalCost / totalTasks).toFixed(6) : 0,
      byAgent,
    };
  }

  /**
   * Get session stats
   * @returns {Object} Current session stats
   */
  getSessionStats() {
    return {
      ...this.currentSession,
      avgTokensPerCall: this.currentSession.callCount > 0
        ? Math.round(this.currentSession.totalTokens / this.currentSession.callCount)
        : 0,
    };
  }

  /**
   * Reset session stats
   */
  resetSession() {
    this.currentSession = {
      totalTokens: 0,
      totalCost: 0,
      callCount: 0,
    };
  }
}

// Export
export {
  TokenTracker,
  MODEL_PRICING,
  AGENT_BASE_TOKENS,
  COMPLEXITY_MULTIPLIERS,
};

export default TokenTracker;
