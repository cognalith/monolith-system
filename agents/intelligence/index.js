/**
 * MONOLITH OS - Intelligence Module
 * Smart learning, optimization, and performance tracking
 */

import KnowledgeBase from './KnowledgeBase.js';
import PerformanceTracker from './PerformanceTracker.js';
import CostOptimizer from './CostOptimizer.js';
import SmartRouter from './SmartRouter.js';

/**
 * Intelligence Hub - Central coordinator for all intelligence features
 */
class IntelligenceHub {
  constructor(config = {}) {
    this.knowledgeBase = new KnowledgeBase(config.knowledge);
    this.performanceTracker = new PerformanceTracker(config.performance);
    this.costOptimizer = new CostOptimizer(config.cost);
    this.smartRouter = new SmartRouter(config.routing);

    this.enabled = {
      learning: config.enableLearning !== false,
      caching: config.enableCaching !== false,
      costOptimization: config.enableCostOptimization !== false,
      smartRouting: config.enableSmartRouting !== false,
    };
  }

  /**
   * Get context for a task
   */
  async getTaskContext(task, role) {
    const context = {};

    if (this.enabled.learning) {
      context.knowledge = await this.knowledgeBase.getContext(task, role);
    }

    if (this.enabled.costOptimization) {
      context.modelRecommendation = this.costOptimizer.selectModel(task);
    }

    if (this.enabled.smartRouting) {
      context.routing = await this.smartRouter.route(task);
    }

    return context;
  }

  /**
   * Record task completion
   */
  async recordTaskCompletion(data) {
    const { role, task, result, startTime, endTime, tokens, cost } = data;

    // Track performance
    this.performanceTracker.trackTaskCompletion({
      role,
      taskId: task.id,
      startTime,
      endTime,
      success: result.success !== false && !result.error,
      escalated: result.escalate === true,
      tokens,
      cost,
    });

    // Store decision in knowledge base
    if (this.enabled.learning) {
      const decisionId = await this.knowledgeBase.storeDecision({
        role,
        task,
        analysis: result.analysis,
        action: result.action,
      });

      // If outcome is known, record it
      if (result.success !== undefined) {
        await this.knowledgeBase.recordOutcome(decisionId, {
          success: result.success,
        });
      }
    }

    // Record cost
    if (this.enabled.costOptimization && (tokens || cost)) {
      this.costOptimizer.recordUsage({
        model: data.model,
        inputTokens: tokens?.input || tokens,
        outputTokens: tokens?.output || 0,
        cost,
      });
    }

    // Update routing learnings
    if (this.enabled.smartRouting) {
      this.smartRouter.recordOutcome(task.id, {
        success: result.success !== false && !result.error,
      });
      this.smartRouter.updateLoad(role, -1);
    }
  }

  /**
   * Record workflow completion
   */
  recordWorkflowCompletion(data) {
    this.performanceTracker.trackWorkflowCompletion(data);
  }

  /**
   * Check response cache
   */
  checkCache(taskContent) {
    if (!this.enabled.caching) {
      return { hit: false };
    }
    return this.costOptimizer.checkCache(taskContent);
  }

  /**
   * Cache a response
   */
  cacheResponse(taskContent, response, cost) {
    if (this.enabled.caching) {
      this.costOptimizer.cacheResponse(taskContent, response, cost);
    }
  }

  /**
   * Get dashboard data
   */
  getDashboard() {
    return {
      system: this.performanceTracker.getSystemOverview(),
      agents: this.performanceTracker.getAllAgentPerformance(),
      costs: this.costOptimizer.getSummary(),
      knowledge: this.knowledgeBase.getStats(),
      routing: this.smartRouter.getStats(),
    };
  }

  /**
   * Get health report
   */
  getHealthReport() {
    const system = this.performanceTracker.getSystemOverview();
    const costs = this.costOptimizer.getSummary();
    const alerts = [];

    // Check escalation rate
    if (system.escalationRate > 0.3) {
      alerts.push({
        type: 'high_escalation_rate',
        message: `${Math.round(system.escalationRate * 100)}% of tasks are being escalated`,
        severity: 'warning',
      });
    }

    // Check budget
    if (costs.budget.spentToday / costs.budget.daily > 0.9) {
      alerts.push({
        type: 'budget_warning',
        message: `Daily budget is ${Math.round((costs.budget.spentToday / costs.budget.daily) * 100)}% used`,
        severity: costs.budget.spentToday >= costs.budget.daily ? 'critical' : 'warning',
      });
    }

    // Agent-specific alerts
    for (const agent of this.performanceTracker.getAllAgentPerformance()) {
      const agentAlerts = this.performanceTracker.checkAlerts(agent.role);
      alerts.push(...agentAlerts);
    }

    return {
      status: alerts.some(a => a.severity === 'critical') ? 'critical' :
              alerts.some(a => a.severity === 'warning') ? 'warning' : 'healthy',
      alerts,
      metrics: {
        tasksProcessed: system.tasksProcessed,
        escalationRate: system.escalationRate,
        uptime: system.uptimeHuman,
        dailyCost: costs.budget.spentToday,
      },
    };
  }

  /**
   * Export all data
   */
  export() {
    return {
      knowledge: this.knowledgeBase.export(),
      performance: this.performanceTracker.export(),
      routing: this.smartRouter.getStats(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import data
   */
  import(data) {
    if (data.knowledge) {
      this.knowledgeBase.import(data.knowledge);
    }
  }
}

export {
  IntelligenceHub,
  KnowledgeBase,
  PerformanceTracker,
  CostOptimizer,
  SmartRouter,
};

export default IntelligenceHub;
