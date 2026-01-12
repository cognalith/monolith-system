/**
 * MONOLITH OS - Performance Tracker
 * Track and analyze agent performance metrics
 *
 * Features:
 * - Track task completion times
 * - Monitor success/failure rates
 * - Measure LLM usage and costs
 * - Generate performance reports
 */

class PerformanceTracker {
  constructor(config = {}) {
    this.metrics = {
      agents: new Map(),
      workflows: new Map(),
      llm: {
        calls: [],
        totalTokens: 0,
        totalCost: 0,
      },
      system: {
        startTime: Date.now(),
        tasksProcessed: 0,
        escalations: 0,
        workflowsCompleted: 0,
      },
    };

    this.aggregations = {
      hourly: [],
      daily: [],
    };

    this.alertThresholds = config.alertThresholds || {
      errorRate: 0.2,
      avgResponseTime: 30000,
      costPerHour: 10,
    };
  }

  /**
   * Track task completion
   */
  trackTaskCompletion(data) {
    const {
      role,
      taskId,
      startTime,
      endTime,
      success,
      escalated,
      tokens,
      cost,
    } = data;

    const duration = endTime - startTime;

    // Update agent metrics
    if (!this.metrics.agents.has(role)) {
      this.metrics.agents.set(role, {
        tasksCompleted: 0,
        tasksFailed: 0,
        tasksEscalated: 0,
        totalDuration: 0,
        totalTokens: 0,
        totalCost: 0,
        history: [],
      });
    }

    const agentMetrics = this.metrics.agents.get(role);

    if (success) {
      agentMetrics.tasksCompleted++;
    } else {
      agentMetrics.tasksFailed++;
    }

    if (escalated) {
      agentMetrics.tasksEscalated++;
      this.metrics.system.escalations++;
    }

    agentMetrics.totalDuration += duration;
    agentMetrics.totalTokens += tokens || 0;
    agentMetrics.totalCost += cost || 0;

    // Store recent history
    agentMetrics.history.push({
      taskId,
      duration,
      success,
      escalated,
      tokens,
      cost,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 100 entries
    if (agentMetrics.history.length > 100) {
      agentMetrics.history = agentMetrics.history.slice(-100);
    }

    // Update system totals
    this.metrics.system.tasksProcessed++;

    // Track LLM usage
    if (tokens || cost) {
      this.trackLLMUsage({ role, tokens, cost });
    }

    // Check for alerts
    this.checkAlerts(role);

    return {
      role,
      taskId,
      duration,
      success,
    };
  }

  /**
   * Track workflow completion
   */
  trackWorkflowCompletion(data) {
    const {
      workflowId,
      instanceId,
      startTime,
      endTime,
      status,
      stepsCompleted,
      totalSteps,
    } = data;

    const duration = endTime - startTime;

    if (!this.metrics.workflows.has(workflowId)) {
      this.metrics.workflows.set(workflowId, {
        completed: 0,
        failed: 0,
        escalated: 0,
        totalDuration: 0,
        avgStepsCompleted: 0,
        history: [],
      });
    }

    const workflowMetrics = this.metrics.workflows.get(workflowId);

    if (status === 'completed') {
      workflowMetrics.completed++;
      this.metrics.system.workflowsCompleted++;
    } else if (status === 'failed') {
      workflowMetrics.failed++;
    } else if (status === 'escalated') {
      workflowMetrics.escalated++;
    }

    workflowMetrics.totalDuration += duration;

    // Update average steps completed
    const total = workflowMetrics.completed + workflowMetrics.failed + workflowMetrics.escalated;
    workflowMetrics.avgStepsCompleted =
      (workflowMetrics.avgStepsCompleted * (total - 1) + stepsCompleted) / total;

    workflowMetrics.history.push({
      instanceId,
      duration,
      status,
      stepsCompleted,
      totalSteps,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 50 entries
    if (workflowMetrics.history.length > 50) {
      workflowMetrics.history = workflowMetrics.history.slice(-50);
    }

    return {
      workflowId,
      instanceId,
      duration,
      status,
    };
  }

  /**
   * Track LLM usage
   */
  trackLLMUsage(data) {
    const { role, model, tokens, cost, prompt, response } = data;

    this.metrics.llm.calls.push({
      role,
      model,
      tokens,
      cost,
      timestamp: new Date().toISOString(),
    });

    this.metrics.llm.totalTokens += tokens || 0;
    this.metrics.llm.totalCost += cost || 0;

    // Keep only last 1000 calls
    if (this.metrics.llm.calls.length > 1000) {
      this.metrics.llm.calls = this.metrics.llm.calls.slice(-1000);
    }
  }

  /**
   * Get agent performance summary
   */
  getAgentPerformance(role) {
    const metrics = this.metrics.agents.get(role);
    if (!metrics) {
      return null;
    }

    const total = metrics.tasksCompleted + metrics.tasksFailed;

    return {
      role,
      tasksCompleted: metrics.tasksCompleted,
      tasksFailed: metrics.tasksFailed,
      tasksEscalated: metrics.tasksEscalated,
      totalTasks: total,
      successRate: total > 0 ? metrics.tasksCompleted / total : 0,
      escalationRate: total > 0 ? metrics.tasksEscalated / total : 0,
      avgDuration: total > 0 ? metrics.totalDuration / total : 0,
      avgTokens: total > 0 ? metrics.totalTokens / total : 0,
      avgCost: total > 0 ? metrics.totalCost / total : 0,
      totalCost: metrics.totalCost,
      recentHistory: metrics.history.slice(-10),
    };
  }

  /**
   * Get all agents performance
   */
  getAllAgentPerformance() {
    const results = [];
    for (const role of this.metrics.agents.keys()) {
      results.push(this.getAgentPerformance(role));
    }
    return results.sort((a, b) => b.totalTasks - a.totalTasks);
  }

  /**
   * Get workflow performance
   */
  getWorkflowPerformance(workflowId) {
    const metrics = this.metrics.workflows.get(workflowId);
    if (!metrics) {
      return null;
    }

    const total = metrics.completed + metrics.failed + metrics.escalated;

    return {
      workflowId,
      completed: metrics.completed,
      failed: metrics.failed,
      escalated: metrics.escalated,
      total,
      successRate: total > 0 ? metrics.completed / total : 0,
      avgDuration: total > 0 ? metrics.totalDuration / total : 0,
      avgStepsCompleted: metrics.avgStepsCompleted,
      recentHistory: metrics.history.slice(-10),
    };
  }

  /**
   * Get LLM usage summary
   */
  getLLMUsage(period = 'all') {
    let calls = this.metrics.llm.calls;

    if (period !== 'all') {
      const now = Date.now();
      const periods = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
      };

      const cutoff = now - (periods[period] || periods.day);
      calls = calls.filter(c => new Date(c.timestamp).getTime() > cutoff);
    }

    const byModel = {};
    const byRole = {};
    let totalTokens = 0;
    let totalCost = 0;

    for (const call of calls) {
      totalTokens += call.tokens || 0;
      totalCost += call.cost || 0;

      if (call.model) {
        byModel[call.model] = byModel[call.model] || { calls: 0, tokens: 0, cost: 0 };
        byModel[call.model].calls++;
        byModel[call.model].tokens += call.tokens || 0;
        byModel[call.model].cost += call.cost || 0;
      }

      if (call.role) {
        byRole[call.role] = byRole[call.role] || { calls: 0, tokens: 0, cost: 0 };
        byRole[call.role].calls++;
        byRole[call.role].tokens += call.tokens || 0;
        byRole[call.role].cost += call.cost || 0;
      }
    }

    return {
      period,
      totalCalls: calls.length,
      totalTokens,
      totalCost,
      avgTokensPerCall: calls.length > 0 ? totalTokens / calls.length : 0,
      avgCostPerCall: calls.length > 0 ? totalCost / calls.length : 0,
      byModel,
      byRole,
    };
  }

  /**
   * Get system overview
   */
  getSystemOverview() {
    const uptime = Date.now() - this.metrics.system.startTime;

    return {
      uptime,
      uptimeHuman: this.formatDuration(uptime),
      tasksProcessed: this.metrics.system.tasksProcessed,
      escalations: this.metrics.system.escalations,
      workflowsCompleted: this.metrics.system.workflowsCompleted,
      escalationRate: this.metrics.system.tasksProcessed > 0
        ? this.metrics.system.escalations / this.metrics.system.tasksProcessed
        : 0,
      activeAgents: this.metrics.agents.size,
      activeWorkflows: this.metrics.workflows.size,
      llmUsage: this.getLLMUsage('day'),
    };
  }

  /**
   * Check for alert conditions
   */
  checkAlerts(role) {
    const perf = this.getAgentPerformance(role);
    if (!perf) return [];

    const alerts = [];

    // Check error rate
    if (perf.successRate < (1 - this.alertThresholds.errorRate) && perf.totalTasks > 5) {
      alerts.push({
        type: 'high_error_rate',
        role,
        message: `Agent ${role} has ${Math.round((1 - perf.successRate) * 100)}% error rate`,
        severity: 'warning',
      });
    }

    // Check response time
    if (perf.avgDuration > this.alertThresholds.avgResponseTime) {
      alerts.push({
        type: 'slow_response',
        role,
        message: `Agent ${role} average response time is ${this.formatDuration(perf.avgDuration)}`,
        severity: 'warning',
      });
    }

    return alerts;
  }

  /**
   * Format duration for display
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Export metrics
   */
  export() {
    return {
      agents: Object.fromEntries(this.metrics.agents),
      workflows: Object.fromEntries(this.metrics.workflows),
      llm: this.metrics.llm,
      system: this.metrics.system,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      agents: new Map(),
      workflows: new Map(),
      llm: {
        calls: [],
        totalTokens: 0,
        totalCost: 0,
      },
      system: {
        startTime: Date.now(),
        tasksProcessed: 0,
        escalations: 0,
        workflowsCompleted: 0,
      },
    };
  }
}

export default PerformanceTracker;
