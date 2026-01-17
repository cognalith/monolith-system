/**
 * MONOLITH OS - Smart Router
 * Intelligent task routing based on context, capability, and load
 * Persists learnings to database for continuous improvement
 *
 * Features:
 * - Route tasks to best-fit agents
 * - Load balancing across agents
 * - Priority-aware scheduling
 * - Learn from routing outcomes
 * - Persist learnings to database
 */

import databaseService from '../services/DatabaseService.js';

class SmartRouter {
  constructor(config = {}) {
    this.agents = config.agents || {};
    this.routingHistory = [];
    this.agentLoad = new Map();
    this.routingRules = new Map();
    this.learnings = new Map();

    // Database service
    this.dbService = config.dbService || databaseService;

    // Initialize default routing rules
    this.initializeDefaultRules();

    // Load learnings from database on startup
    this.loadLearningsFromDb();
  }

  /**
   * Initialize default routing rules
   */
  initializeDefaultRules() {
    // Keyword-based routing
    this.routingRules.set('keyword', {
      financial: ['cfo'],
      budget: ['cfo'],
      expense: ['cfo'],
      technical: ['cto'],
      architecture: ['cto'],
      infrastructure: ['cto', 'devops'],
      deploy: ['devops'],
      pipeline: ['devops', 'data'],
      security: ['ciso'],
      vulnerability: ['ciso'],
      compliance: ['cco', 'clo'],
      legal: ['clo'],
      contract: ['clo'],
      marketing: ['cmo'],
      campaign: ['cmo'],
      product: ['cpo'],
      feature: ['cpo'],
      roadmap: ['cpo'],
      sales: ['cro'],
      revenue: ['cro'],
      hiring: ['chro'],
      employee: ['chro'],
      operations: ['coo'],
      vendor: ['coo'],
      data: ['data'],
      analytics: ['data'],
      test: ['qa'],
      quality: ['qa'],
    });

    // Priority-based adjustments
    this.routingRules.set('priority', {
      CRITICAL: { preferSenior: true, allowMultiple: true },
      HIGH: { preferSenior: true },
      MEDIUM: { preferSenior: false },
      LOW: { preferSenior: false, allowDelegate: true },
    });
  }

  /**
   * Load learnings from database
   */
  async loadLearningsFromDb() {
    if (!this.dbService.isAvailable()) {
      console.log('[SMART-ROUTER] Database unavailable, using in-memory learnings');
      return;
    }

    try {
      const { data, error } = await this.dbService.getLearningStats();

      if (!error && data) {
        for (const [key, stats] of Object.entries(data)) {
          this.learnings.set(key, {
            total: stats.total,
            success: stats.success,
            successRate: stats.successRate,
          });
        }
        console.log(`[SMART-ROUTER] Loaded ${Object.keys(data).length} learning entries from database`);
      }
    } catch (error) {
      console.warn('[SMART-ROUTER] Failed to load learnings from database:', error.message);
    }
  }

  /**
   * Route a task to the best agent(s)
   */
  async route(task) {
    const analysis = this.analyzeTask(task);
    const candidates = this.findCandidates(analysis);
    const ranked = this.rankCandidates(candidates, task, analysis);

    const routing = {
      taskId: task.id,
      primaryAgent: ranked[0]?.role || null,
      alternateAgents: ranked.slice(1, 3).map(r => r.role),
      confidence: ranked[0]?.score || 0,
      analysis,
      reasoning: this.explainRouting(ranked, analysis),
      timestamp: new Date().toISOString(),
    };

    // Store routing decision
    this.routingHistory.push(routing);
    if (this.routingHistory.length > 1000) {
      this.routingHistory = this.routingHistory.slice(-1000);
    }

    return routing;
  }

  /**
   * Analyze task to determine routing factors
   */
  analyzeTask(task) {
    const content = (task.content || '').toLowerCase();

    // Extract keywords
    const keywordMatches = {};
    for (const [keyword, roles] of Object.entries(this.routingRules.get('keyword'))) {
      if (content.includes(keyword)) {
        for (const role of roles) {
          keywordMatches[role] = (keywordMatches[role] || 0) + 1;
        }
      }
    }

    // Detect task type
    const taskType = this.detectTaskType(content);

    // Check for explicit role assignment
    const explicitRole = task.assigned_role;

    // Check for workflow context
    const workflowContext = task.workflow || null;

    return {
      keywordMatches,
      taskType,
      explicitRole,
      workflowContext,
      priority: task.priority || 'MEDIUM',
      complexity: this.assessComplexity(content),
    };
  }

  /**
   * Detect task type
   */
  detectTaskType(content) {
    const types = {
      analysis: ['analyze', 'review', 'assess', 'evaluate'],
      creation: ['create', 'draft', 'write', 'design'],
      decision: ['approve', 'decide', 'choose', 'select'],
      investigation: ['investigate', 'find', 'research', 'understand'],
      execution: ['implement', 'execute', 'deploy', 'launch'],
    };

    for (const [type, keywords] of Object.entries(types)) {
      if (keywords.some(kw => content.includes(kw))) {
        return type;
      }
    }

    return 'general';
  }

  /**
   * Assess task complexity
   */
  assessComplexity(content) {
    const wordCount = content.split(/\s+/).length;
    const hasMultipleParts = content.includes(' and ') || content.includes(', ');
    const hasConditions = content.includes(' if ') || content.includes(' when ');

    let score = wordCount / 50;
    if (hasMultipleParts) score += 0.5;
    if (hasConditions) score += 0.3;

    if (score < 0.5) return 'simple';
    if (score < 1.5) return 'medium';
    return 'complex';
  }

  /**
   * Find candidate agents
   */
  findCandidates(analysis) {
    const candidates = new Set();

    // Add explicitly assigned role
    if (analysis.explicitRole) {
      candidates.add(analysis.explicitRole);
    }

    // Add keyword-matched roles
    for (const role of Object.keys(analysis.keywordMatches)) {
      candidates.add(role);
    }

    // Add workflow-related roles
    if (analysis.workflowContext) {
      // Add roles commonly involved in the workflow
      const workflowRoles = this.getWorkflowRoles(analysis.workflowContext);
      for (const role of workflowRoles) {
        candidates.add(role);
      }
    }

    // If no candidates found, use general roles
    if (candidates.size === 0) {
      candidates.add('cos'); // Chief of Staff as fallback
    }

    return Array.from(candidates);
  }

  /**
   * Rank candidate agents
   */
  rankCandidates(candidates, task, analysis) {
    const ranked = [];

    for (const role of candidates) {
      let score = 0;
      const factors = [];

      // Explicit assignment gets highest priority
      if (role === analysis.explicitRole) {
        score += 100;
        factors.push('explicit_assignment');
      }

      // Keyword match score
      const keywordScore = analysis.keywordMatches[role] || 0;
      score += keywordScore * 20;
      if (keywordScore > 0) {
        factors.push(`keyword_match_${keywordScore}`);
      }

      // Check agent availability and load
      const load = this.agentLoad.get(role) || 0;
      score -= load * 5;
      if (load > 5) {
        factors.push('high_load_penalty');
      }

      // Priority preference
      const priorityRules = this.routingRules.get('priority')[analysis.priority];
      if (priorityRules?.preferSenior) {
        const seniorRoles = ['ceo', 'cfo', 'cto', 'coo', 'clo', 'cos'];
        if (seniorRoles.includes(role)) {
          score += 10;
          factors.push('senior_preference');
        }
      }

      // Historical success rate for similar tasks
      const learningKey = `${role}_${analysis.taskType}`;
      const learning = this.learnings.get(learningKey);
      if (learning?.successRate) {
        score += learning.successRate * 10;
        factors.push(`historical_success_${Math.round(learning.successRate * 100)}%`);
      }

      ranked.push({
        role,
        score,
        factors,
      });
    }

    return ranked.sort((a, b) => b.score - a.score);
  }

  /**
   * Get roles associated with a workflow
   */
  getWorkflowRoles(workflowName) {
    const workflowRoles = {
      'Daily Operations': ['cos', 'coo'],
      'Financial': ['cfo', 'coo'],
      'Technical': ['cto', 'devops', 'qa'],
      'Legal': ['clo', 'cco'],
      'Security': ['ciso', 'cto'],
      'Marketing': ['cmo', 'cro'],
      'Product': ['cpo', 'cto', 'qa'],
      'HR': ['chro'],
    };

    return workflowRoles[workflowName] || [];
  }

  /**
   * Explain routing decision
   */
  explainRouting(ranked, analysis) {
    if (ranked.length === 0) {
      return 'No suitable agent found';
    }

    const primary = ranked[0];
    let explanation = `Routed to ${primary.role} (score: ${primary.score})`;

    if (primary.factors.length > 0) {
      explanation += `. Factors: ${primary.factors.join(', ')}`;
    }

    if (ranked.length > 1) {
      explanation += `. Alternates: ${ranked.slice(1, 3).map(r => r.role).join(', ')}`;
    }

    return explanation;
  }

  /**
   * Record routing outcome and persist to database
   */
  async recordOutcome(taskId, outcome) {
    const routing = this.routingHistory.find(r => r.taskId === taskId);
    if (!routing) return;

    routing.outcome = outcome;

    // Update in-memory learnings
    const learningKey = `${routing.primaryAgent}_${routing.analysis.taskType}`;
    if (!this.learnings.has(learningKey)) {
      this.learnings.set(learningKey, {
        total: 0,
        success: 0,
        successRate: 0,
      });
    }

    const learning = this.learnings.get(learningKey);
    learning.total++;
    if (outcome.success) {
      learning.success++;
    }
    learning.successRate = learning.success / learning.total;

    // Persist to database
    if (this.dbService.isAvailable()) {
      await this.persistLearning(routing, outcome);
    }
  }

  /**
   * Persist learning to database
   */
  async persistLearning(routing, outcome) {
    if (!this.dbService.isAvailable()) {
      return { success: false, error: 'Database unavailable' };
    }

    const learningKey = `${routing.primaryAgent}_${routing.analysis.taskType}`;
    const learning = this.learnings.get(learningKey);

    const { data, error } = await this.dbService.saveLearning({
      role_id: routing.primaryAgent,
      task_type: routing.analysis.taskType,
      context: {
        taskId: routing.taskId,
        analysis: routing.analysis,
        confidence: routing.confidence,
        alternates: routing.alternateAgents,
      },
      outcome: {
        success: outcome.success,
        details: outcome,
        routing_reasoning: routing.reasoning,
      },
      success: outcome.success,
      success_rate: learning?.successRate || (outcome.success ? 1 : 0),
      total_count: learning?.total || 1,
      success_count: learning?.success || (outcome.success ? 1 : 0),
      metadata: {
        routing_factors: routing.analysis,
        recorded_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.warn('[SMART-ROUTER] Failed to persist learning:', error.message);
      return { success: false, error };
    }

    return { success: true, data };
  }

  /**
   * Update learning stats in database (batch update)
   */
  async syncLearningsToDb() {
    if (!this.dbService.isAvailable()) {
      console.warn('[SMART-ROUTER] Database unavailable for sync');
      return { synced: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    for (const [key, learning] of this.learnings) {
      const [roleId, taskType] = key.split('_');

      const { error } = await this.dbService.saveLearning({
        role_id: roleId,
        task_type: taskType,
        context: {},
        outcome: { aggregated: true },
        success_rate: learning.successRate,
        total_count: learning.total,
        success_count: learning.success,
      });

      if (error) {
        errors++;
      } else {
        synced++;
      }
    }

    console.log(`[SMART-ROUTER] Synced ${synced} learnings, ${errors} errors`);
    return { synced, errors };
  }

  /**
   * Update agent load
   */
  updateLoad(role, change) {
    const current = this.agentLoad.get(role) || 0;
    this.agentLoad.set(role, Math.max(0, current + change));
  }

  /**
   * Get routing statistics
   */
  async getStats() {
    const roleStats = {};

    // Combine in-memory routing history
    for (const routing of this.routingHistory) {
      const role = routing.primaryAgent;
      if (!roleStats[role]) {
        roleStats[role] = { routed: 0, successful: 0 };
      }
      roleStats[role].routed++;
      if (routing.outcome?.success) {
        roleStats[role].successful++;
      }
    }

    // Calculate success rates
    for (const role of Object.keys(roleStats)) {
      const stats = roleStats[role];
      stats.successRate = stats.routed > 0 ? stats.successful / stats.routed : 0;
    }

    // Get database learnings if available
    let dbLearnings = {};
    if (this.dbService.isAvailable()) {
      const { data } = await this.dbService.getLearningStats();
      if (data) {
        dbLearnings = data;
      }
    }

    return {
      totalRoutings: this.routingHistory.length,
      byRole: roleStats,
      currentLoad: Object.fromEntries(this.agentLoad),
      learnings: Object.fromEntries(this.learnings),
      dbLearnings,
      databaseConnected: this.dbService.isAvailable(),
    };
  }

  /**
   * Get learnings for a specific role
   */
  async getLearningsForRole(roleId, limit = 50) {
    if (!this.dbService.isAvailable()) {
      // Return in-memory learnings for this role
      const roleLearnings = {};
      for (const [key, learning] of this.learnings) {
        if (key.startsWith(`${roleId}_`)) {
          roleLearnings[key] = learning;
        }
      }
      return roleLearnings;
    }

    const { data, error } = await this.dbService.getLearningsByRole(roleId, null, limit);
    if (error) {
      console.warn('[SMART-ROUTER] Failed to get learnings from database:', error.message);
      return {};
    }

    return data;
  }

  /**
   * Set custom routing rule
   */
  setCustomRule(keyword, roles) {
    const rules = this.routingRules.get('keyword');
    rules[keyword] = roles;
  }

  /**
   * Check if database is connected
   */
  isUsingDatabase() {
    return this.dbService.isAvailable();
  }
}

export default SmartRouter;
