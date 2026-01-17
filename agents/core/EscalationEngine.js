/**
 * MONOLITH OS - Escalation Engine
 * Determines when tasks require CEO decision
 */

// Default escalation thresholds
const DEFAULT_THRESHOLDS = {
  // Financial thresholds
  financial: {
    singleExpense: 10000, // Single expense > $10k
    contractValue: 50000, // Contract > $50k
    budgetReallocation: 0.2, // Budget reallocation > 20%
  },

  // Risk levels that require escalation
  riskKeywords: [
    'legal liability',
    'compliance violation',
    'security incident',
    'data breach',
    'regulatory',
    'lawsuit',
    'termination',
    'acquisition',
    'merger',
  ],

  // Strategic keywords that require CEO input
  strategicKeywords: [
    'strategic direction',
    'company policy',
    'organizational change',
    'new market',
    'product pivot',
    'partnership',
    'investment',
    'fundraising',
  ],

  // Roles that always escalate certain decisions
  roleSpecificRules: {
    cfo: {
      escalateAbove: 25000,
      alwaysEscalate: ['major investment', 'audit finding'],
    },
    cto: {
      escalateAbove: 15000,
      alwaysEscalate: ['architecture change', 'vendor switch', 'security vulnerability'],
    },
    clo: {
      alwaysEscalate: ['contract signature', 'legal settlement', 'regulatory filing'],
    },
    chro: {
      alwaysEscalate: ['executive hiring', 'termination', 'compensation change'],
    },
    ciso: {
      alwaysEscalate: ['security breach', 'incident response', 'vulnerability disclosure'],
    },
  },
};

class EscalationEngine {
  constructor(config = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
    this.customRules = config.customRules || [];

    // CEO Agent integration for processing escalations
    this.ceoAgent = config.ceoAgent || null;

    // Database connection for persistent escalation storage (optional)
    this.db = config.db || null;

    // In-memory escalation queue (used when no database)
    this.escalationQueue = [];

    // Event emitter for escalation events
    this.eventListeners = new Map();

    console.log('[ESCALATION] Escalation Engine initialized');
    if (this.ceoAgent) {
      console.log('[ESCALATION] CEO Agent connected for escalation processing');
    }
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach((callback) => callback(data));
  }

  /**
   * Set the CEO Agent for processing escalations
   */
  setCEOAgent(ceoAgent) {
    this.ceoAgent = ceoAgent;
    console.log('[ESCALATION] CEO Agent connected');
  }

  /**
   * Queue an escalation for processing
   */
  async queueEscalation(escalation) {
    const queuedEscalation = {
      id: `ESC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...escalation,
      status: 'pending',
      queuedAt: new Date().toISOString(),
    };

    // Store in database if available, otherwise in memory
    if (this.db) {
      try {
        await this.db.from('escalations').insert(queuedEscalation);
      } catch (error) {
        console.error('[ESCALATION] Database insert failed, using in-memory queue:', error.message);
        this.escalationQueue.push(queuedEscalation);
      }
    } else {
      this.escalationQueue.push(queuedEscalation);
    }

    this.emit('escalationQueued', queuedEscalation);
    return queuedEscalation;
  }

  /**
   * Get pending escalations from database or memory
   */
  async getPendingEscalations() {
    if (this.db) {
      try {
        const { data, error } = await this.db
          .from('escalations')
          .select('*')
          .eq('status', 'pending')
          .order('queuedAt', { ascending: true });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('[ESCALATION] Database query failed, using in-memory queue:', error.message);
        return this.escalationQueue.filter((e) => e.status === 'pending');
      }
    }

    return this.escalationQueue.filter((e) => e.status === 'pending');
  }

  /**
   * Process the escalation queue using CEO Agent
   * CEO Agent analyzes each escalation and prepares recommendations for human review
   */
  async processEscalationQueue() {
    if (!this.ceoAgent) {
      console.warn('[ESCALATION] No CEO Agent configured - escalations cannot be processed');
      return { processed: 0, errors: [] };
    }

    const pendingEscalations = await this.getPendingEscalations();
    const results = {
      processed: 0,
      errors: [],
      analyses: [],
    };

    console.log(`[ESCALATION] Processing ${pendingEscalations.length} pending escalations`);

    for (const escalation of pendingEscalations) {
      try {
        // Have CEO Agent analyze the escalation
        const analysis = await this.ceoAgent.processEscalation(escalation);

        // Update escalation status
        await this.updateEscalationStatus(escalation.id, 'analyzed', analysis);

        results.analyses.push(analysis);
        results.processed++;

        // Emit event - NOT 'escalationResolved' since human still needs to review
        this.emit('escalationAnalyzed', {
          escalation,
          analysis,
          status: 'pending_human_review',
        });

      } catch (error) {
        console.error(`[ESCALATION] Error processing escalation ${escalation.id}:`, error.message);
        results.errors.push({
          escalationId: escalation.id,
          error: error.message,
        });

        // Mark as failed
        await this.updateEscalationStatus(escalation.id, 'failed', { error: error.message });
      }
    }

    console.log(`[ESCALATION] Processed ${results.processed} escalations, ${results.errors.length} errors`);
    return results;
  }

  /**
   * Update escalation status in database or memory
   */
  async updateEscalationStatus(id, status, data = {}) {
    if (this.db) {
      try {
        await this.db
          .from('escalations')
          .update({
            status,
            ...data,
            updatedAt: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (error) {
        console.error('[ESCALATION] Database update failed:', error.message);
        // Fallback to in-memory update
        const escalation = this.escalationQueue.find((e) => e.id === id);
        if (escalation) {
          escalation.status = status;
          Object.assign(escalation, data);
          escalation.updatedAt = new Date().toISOString();
        }
      }
    } else {
      const escalation = this.escalationQueue.find((e) => e.id === id);
      if (escalation) {
        escalation.status = status;
        Object.assign(escalation, data);
        escalation.updatedAt = new Date().toISOString();
      }
    }
  }

  /**
   * Get escalations that are ready for human review
   * These have been analyzed by CEO Agent but not yet acted upon by human
   */
  async getEscalationsForHumanReview() {
    if (this.db) {
      try {
        const { data, error } = await this.db
          .from('escalations')
          .select('*')
          .eq('status', 'analyzed')
          .order('priority', { ascending: false })
          .order('queuedAt', { ascending: true });

        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('[ESCALATION] Database query failed:', error.message);
        return this.escalationQueue.filter((e) => e.status === 'analyzed');
      }
    }

    // Return from in-memory queue, sorted by priority then time
    return this.escalationQueue
      .filter((e) => e.status === 'analyzed')
      .sort((a, b) => {
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.queuedAt) - new Date(b.queuedAt);
      });
  }

  /**
   * Mark an escalation as resolved by human
   */
  async resolveEscalation(id, resolution) {
    const resolvedData = {
      resolution,
      resolvedAt: new Date().toISOString(),
      resolvedBy: resolution.resolvedBy || 'human',
    };

    await this.updateEscalationStatus(id, 'resolved', resolvedData);

    this.emit('escalationResolved', {
      escalationId: id,
      resolution,
    });

    return resolvedData;
  }

  /**
   * Get escalation statistics
   */
  async getStats() {
    let escalations;

    if (this.db) {
      try {
        const { data, error } = await this.db.from('escalations').select('*');
        if (error) throw error;
        escalations = data || [];
      } catch (error) {
        escalations = this.escalationQueue;
      }
    } else {
      escalations = this.escalationQueue;
    }

    return {
      total: escalations.length,
      pending: escalations.filter((e) => e.status === 'pending').length,
      analyzed: escalations.filter((e) => e.status === 'analyzed').length,
      resolved: escalations.filter((e) => e.status === 'resolved').length,
      failed: escalations.filter((e) => e.status === 'failed').length,
      byPriority: {
        critical: escalations.filter((e) => e.priority === 'CRITICAL' && e.status !== 'resolved').length,
        high: escalations.filter((e) => e.priority === 'HIGH' && e.status !== 'resolved').length,
        medium: escalations.filter((e) => e.priority === 'MEDIUM' && e.status !== 'resolved').length,
        low: escalations.filter((e) => e.priority === 'LOW' && e.status !== 'resolved').length,
      },
    };
  }

  /**
   * Check if a task requires CEO escalation
   */
  shouldEscalate(task, result, role) {
    const reasons = [];

    // Check explicit escalation markers
    if (this.hasExplicitEscalation(task)) {
      reasons.push('Task explicitly marked for CEO approval');
    }

    // Check financial thresholds
    const financialReason = this.checkFinancialThresholds(task, result, role);
    if (financialReason) {
      reasons.push(financialReason);
    }

    // Check risk keywords
    const riskReason = this.checkRiskKeywords(task, result);
    if (riskReason) {
      reasons.push(riskReason);
    }

    // Check strategic keywords
    const strategicReason = this.checkStrategicKeywords(task, result);
    if (strategicReason) {
      reasons.push(strategicReason);
    }

    // Check role-specific rules
    const roleReason = this.checkRoleSpecificRules(task, result, role);
    if (roleReason) {
      reasons.push(roleReason);
    }

    // Check custom rules
    const customReason = this.checkCustomRules(task, result, role);
    if (customReason) {
      reasons.push(customReason);
    }

    return {
      shouldEscalate: reasons.length > 0,
      reasons,
      priority: this.calculateEscalationPriority(reasons, task),
    };
  }

  /**
   * Check for explicit escalation markers
   */
  hasExplicitEscalation(task) {
    const content = (task.content + ' ' + (task.notes || '')).toLowerCase();
    const markers = [
      'ceo approval',
      'ceo decision',
      'requires ceo',
      'escalate to ceo',
      'executive decision',
      'board approval',
    ];

    return markers.some((marker) => content.includes(marker));
  }

  /**
   * Check financial thresholds
   */
  checkFinancialThresholds(task, result, role) {
    const content = (task.content + ' ' + (result?.action || '')).toLowerCase();

    // Try to extract dollar amounts
    const amountMatch = content.match(/\$[\d,]+(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|usd)/gi);

    if (amountMatch) {
      for (const match of amountMatch) {
        const amount = parseFloat(match.replace(/[$,\s]/g, '').replace(/dollars?|usd/i, ''));

        // Check against role-specific threshold
        const roleRules = this.thresholds.roleSpecificRules[role];
        if (roleRules?.escalateAbove && amount > roleRules.escalateAbove) {
          return `Financial amount $${amount.toLocaleString()} exceeds ${role.toUpperCase()} authority ($${roleRules.escalateAbove.toLocaleString()})`;
        }

        // Check against general thresholds
        if (amount > this.thresholds.financial.singleExpense) {
          return `Financial amount $${amount.toLocaleString()} exceeds single expense threshold ($${this.thresholds.financial.singleExpense.toLocaleString()})`;
        }
      }
    }

    // Check for contract mentions
    if (content.includes('contract') && amountMatch) {
      const amount = parseFloat(amountMatch[0].replace(/[$,\s]/g, '').replace(/dollars?|usd/i, ''));
      if (amount > this.thresholds.financial.contractValue) {
        return `Contract value $${amount.toLocaleString()} exceeds threshold ($${this.thresholds.financial.contractValue.toLocaleString()})`;
      }
    }

    return null;
  }

  /**
   * Check for risk keywords
   */
  checkRiskKeywords(task, result) {
    const content = (
      task.content +
      ' ' +
      (task.notes || '') +
      ' ' +
      (result?.analysis || '') +
      ' ' +
      (result?.decision || '')
    ).toLowerCase();

    for (const keyword of this.thresholds.riskKeywords) {
      if (content.includes(keyword)) {
        return `Risk indicator detected: "${keyword}"`;
      }
    }

    return null;
  }

  /**
   * Check for strategic keywords
   */
  checkStrategicKeywords(task, result) {
    const content = (
      task.content +
      ' ' +
      (task.notes || '') +
      ' ' +
      (result?.analysis || '') +
      ' ' +
      (result?.decision || '')
    ).toLowerCase();

    for (const keyword of this.thresholds.strategicKeywords) {
      if (content.includes(keyword)) {
        return `Strategic decision required: "${keyword}"`;
      }
    }

    return null;
  }

  /**
   * Check role-specific escalation rules
   */
  checkRoleSpecificRules(task, result, role) {
    const roleRules = this.thresholds.roleSpecificRules[role];
    if (!roleRules?.alwaysEscalate) return null;

    const content = (
      task.content +
      ' ' +
      (task.notes || '') +
      ' ' +
      (result?.action || '')
    ).toLowerCase();

    for (const trigger of roleRules.alwaysEscalate) {
      if (content.includes(trigger.toLowerCase())) {
        return `${role.toUpperCase()} role requires CEO approval for: "${trigger}"`;
      }
    }

    return null;
  }

  /**
   * Check custom rules
   */
  checkCustomRules(task, result, role) {
    for (const rule of this.customRules) {
      if (rule.condition(task, result, role)) {
        return rule.reason || 'Custom escalation rule triggered';
      }
    }
    return null;
  }

  /**
   * Calculate escalation priority
   */
  calculateEscalationPriority(reasons, task) {
    let priority = 'MEDIUM';

    // Check for critical indicators
    const criticalIndicators = [
      'security',
      'breach',
      'legal',
      'compliance',
      'liability',
      'urgent',
    ];

    const reasonText = reasons.join(' ').toLowerCase();

    for (const indicator of criticalIndicators) {
      if (reasonText.includes(indicator)) {
        priority = 'CRITICAL';
        break;
      }
    }

    // Inherit task priority if higher
    if (task.priority === 'CRITICAL' && priority !== 'CRITICAL') {
      priority = 'CRITICAL';
    } else if (task.priority === 'HIGH' && priority === 'MEDIUM') {
      priority = 'HIGH';
    }

    return priority;
  }

  /**
   * Add a custom escalation rule
   */
  addRule(rule) {
    this.customRules.push(rule);
  }

  /**
   * Update thresholds
   */
  updateThresholds(updates) {
    this.thresholds = {
      ...this.thresholds,
      ...updates,
      financial: { ...this.thresholds.financial, ...updates.financial },
      roleSpecificRules: { ...this.thresholds.roleSpecificRules, ...updates.roleSpecificRules },
    };
  }

  /**
   * Get current thresholds
   */
  getThresholds() {
    return this.thresholds;
  }
}

export default EscalationEngine;
export { DEFAULT_THRESHOLDS };
