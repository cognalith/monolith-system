/**
 * MONOLITH OS - Knowledge Base
 * Learn from past decisions and provide context for future ones
 *
 * Features:
 * - Store and retrieve past decisions
 * - Find similar past situations
 * - Provide historical context for new tasks
 * - Track decision outcomes
 */

class KnowledgeBase {
  constructor(config = {}) {
    this.decisions = [];
    this.outcomes = new Map();
    this.patterns = new Map();
    this.storage = config.storage || 'memory';
    this.maxDecisions = config.maxDecisions || 10000;
  }

  /**
   * Store a decision
   */
  async storeDecision(decision) {
    const entry = {
      id: decision.id || `dec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: decision.role,
      task: decision.task,
      analysis: decision.analysis,
      action: decision.action,
      timestamp: new Date().toISOString(),
      keywords: this.extractKeywords(decision.task?.content || ''),
      category: this.categorizeDecision(decision),
      outcome: null, // To be updated later
    };

    this.decisions.push(entry);

    // Keep within size limits
    if (this.decisions.length > this.maxDecisions) {
      this.decisions = this.decisions.slice(-this.maxDecisions);
    }

    // Update patterns
    this.updatePatterns(entry);

    return entry.id;
  }

  /**
   * Record the outcome of a decision
   */
  async recordOutcome(decisionId, outcome) {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (decision) {
      decision.outcome = {
        ...outcome,
        recordedAt: new Date().toISOString(),
      };
      this.outcomes.set(decisionId, decision.outcome);

      // Update pattern success rates
      this.updatePatternSuccess(decision);
    }
  }

  /**
   * Find similar past decisions
   */
  async findSimilar(task, options = {}) {
    const limit = options.limit || 5;
    const keywords = this.extractKeywords(task.content || '');
    const category = options.category || null;

    // Score each decision based on similarity
    const scored = this.decisions
      .filter(d => !category || d.category === category)
      .map(decision => ({
        decision,
        score: this.calculateSimilarity(keywords, decision.keywords),
      }))
      .filter(item => item.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(item => ({
      ...item.decision,
      similarityScore: item.score,
    }));
  }

  /**
   * Get context for a new task based on past decisions
   */
  async getContext(task, role) {
    const similar = await this.findSimilar(task, { limit: 3 });
    const roleDecisions = this.decisions
      .filter(d => d.role === role)
      .slice(-10);

    // Get relevant patterns
    const category = this.categorizeDecision({ task });
    const patterns = this.patterns.get(category) || {};

    return {
      similarPastDecisions: similar,
      recentRoleDecisions: roleDecisions.length,
      patterns: {
        category,
        commonActions: patterns.commonActions || [],
        successRate: patterns.successRate || null,
        avgProcessingTime: patterns.avgProcessingTime || null,
      },
      recommendations: this.generateRecommendations(similar, patterns),
    };
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});
  }

  /**
   * Calculate similarity between two keyword sets
   */
  calculateSimilarity(keywords1, keywords2) {
    const keys1 = new Set(Object.keys(keywords1));
    const keys2 = new Set(Object.keys(keywords2));

    const intersection = [...keys1].filter(k => keys2.has(k));
    const union = new Set([...keys1, ...keys2]);

    if (union.size === 0) return 0;

    // Jaccard similarity with TF weighting
    let weightedIntersection = 0;
    for (const key of intersection) {
      weightedIntersection += Math.min(keywords1[key], keywords2[key]);
    }

    let weightedUnion = 0;
    for (const key of union) {
      weightedUnion += Math.max(keywords1[key] || 0, keywords2[key] || 0);
    }

    return weightedUnion > 0 ? weightedIntersection / weightedUnion : 0;
  }

  /**
   * Categorize a decision
   */
  categorizeDecision(decision) {
    const content = (decision.task?.content || '').toLowerCase();

    const categories = {
      financial: ['budget', 'expense', 'cost', 'revenue', 'pricing', 'financial'],
      technical: ['code', 'architecture', 'deploy', 'infrastructure', 'api', 'database'],
      legal: ['contract', 'legal', 'compliance', 'policy', 'terms'],
      operational: ['process', 'workflow', 'operations', 'vendor', 'migration'],
      security: ['security', 'vulnerability', 'threat', 'breach', 'compliance'],
      product: ['feature', 'roadmap', 'user', 'product', 'ux'],
      marketing: ['campaign', 'marketing', 'brand', 'content'],
      hr: ['hiring', 'employee', 'talent', 'performance'],
      revenue: ['sales', 'deal', 'pipeline', 'customer'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => content.includes(kw))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Update patterns based on new decision
   */
  updatePatterns(entry) {
    const category = entry.category;

    if (!this.patterns.has(category)) {
      this.patterns.set(category, {
        count: 0,
        actions: {},
        successCount: 0,
        totalTime: 0,
      });
    }

    const pattern = this.patterns.get(category);
    pattern.count++;

    if (entry.action) {
      pattern.actions[entry.action] = (pattern.actions[entry.action] || 0) + 1;
    }
  }

  /**
   * Update pattern success rates
   */
  updatePatternSuccess(decision) {
    const pattern = this.patterns.get(decision.category);
    if (!pattern) return;

    if (decision.outcome?.success) {
      pattern.successCount++;
    }

    pattern.successRate = pattern.successCount / pattern.count;

    // Calculate common successful actions
    const successfulActions = this.decisions
      .filter(d => d.category === decision.category && d.outcome?.success)
      .map(d => d.action)
      .filter(Boolean);

    const actionCounts = {};
    for (const action of successfulActions) {
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    }

    pattern.commonActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action]) => action);
  }

  /**
   * Generate recommendations based on past decisions
   */
  generateRecommendations(similar, patterns) {
    const recommendations = [];

    // Based on similar successful decisions
    const successfulSimilar = similar.filter(d => d.outcome?.success);
    if (successfulSimilar.length > 0) {
      recommendations.push({
        type: 'similar_success',
        message: `${successfulSimilar.length} similar tasks were successfully completed`,
        actions: [...new Set(successfulSimilar.map(d => d.action).filter(Boolean))],
      });
    }

    // Based on pattern success rate
    if (patterns.successRate !== null) {
      if (patterns.successRate > 0.8) {
        recommendations.push({
          type: 'high_success_rate',
          message: `This type of task has ${Math.round(patterns.successRate * 100)}% success rate`,
          actions: patterns.commonActions,
        });
      } else if (patterns.successRate < 0.5) {
        recommendations.push({
          type: 'low_success_rate',
          message: `Caution: This type of task has only ${Math.round(patterns.successRate * 100)}% success rate`,
          suggestion: 'Consider escalating or requesting additional review',
        });
      }
    }

    return recommendations;
  }

  /**
   * Get statistics
   */
  getStats() {
    const categoryStats = {};
    for (const [category, pattern] of this.patterns.entries()) {
      categoryStats[category] = {
        count: pattern.count,
        successRate: pattern.successRate || 'N/A',
        topActions: pattern.commonActions?.slice(0, 3) || [],
      };
    }

    return {
      totalDecisions: this.decisions.length,
      decisionsWithOutcomes: [...this.outcomes.keys()].length,
      categories: categoryStats,
      oldestDecision: this.decisions[0]?.timestamp || null,
      newestDecision: this.decisions[this.decisions.length - 1]?.timestamp || null,
    };
  }

  /**
   * Export knowledge base
   */
  export() {
    return {
      decisions: this.decisions,
      patterns: Object.fromEntries(this.patterns),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import knowledge base
   */
  import(data) {
    if (data.decisions) {
      this.decisions = data.decisions;
    }
    if (data.patterns) {
      this.patterns = new Map(Object.entries(data.patterns));
    }
  }
}

export default KnowledgeBase;
