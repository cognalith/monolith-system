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

    console.log('[ESCALATION] Escalation Engine initialized');
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
