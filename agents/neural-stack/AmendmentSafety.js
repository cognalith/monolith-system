/**
 * AMENDMENT SAFETY - Phase 5C
 * Cognalith Inc. | Monolith System
 *
 * Enforces safety constraints for the amendment system.
 *
 * Safety Rules (HARDCODED - cannot be modified by agents):
 * 1. Max 10 active amendments per agent
 * 2. Auto-revert after 3 consecutive failures
 * 3. Protected patterns cannot be modified
 * 4. Conflicting amendments are rejected
 * 5. Only CoS can generate amendments (agents cannot self-modify)
 */

import { createClient } from '@supabase/supabase-js';

// Safety constraints
const SAFETY_LIMITS = {
  MAX_ACTIVE_AMENDMENTS: 10,
  AUTO_REVERT_FAILURES: 3,
  EVALUATION_TIMEOUT_HOURS: 168, // 1 week
  MIN_EVALUATION_TASKS: 5,
};

// Protected patterns that cannot be modified
const PROTECTED_PATTERNS = [
  // Financial escalation - HARDCODED in EscalationClient.js
  /checkout/i, /billing/i, /payment/i, /subscribe/i,
  /credit.?card/i, /cvv/i, /purchase/i, /buy.?now/i,

  // Authority boundaries
  /escalate.*authority/i,
  /bypass.*approval/i,
  /override.*decision/i,

  // Core safety
  /disable.*safety/i,
  /remove.*constraint/i,
  /modify.*protected/i,
];

// Constraint types for logging
const CONSTRAINT_TYPES = {
  MAX_AMENDMENTS_EXCEEDED: 'max_amendments_exceeded',
  PROTECTED_PATTERN_VIOLATION: 'protected_pattern_violation',
  AUTO_REVERT_TRIGGERED: 'auto_revert_triggered',
  EVALUATION_TIMEOUT: 'evaluation_timeout',
  CONFLICTING_AMENDMENT: 'conflicting_amendment',
};

/**
 * Amendment Safety
 * Enforces safety constraints on the amendment system
 */
class AmendmentSafety {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.limits = { ...SAFETY_LIMITS, ...config.limits };
    this.initialize(config);
  }

  initialize(config) {
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: true, persistSession: false },
      });
      this.isConnected = true;
    }
  }

  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ============================================================================
  // CONSTRAINT VALIDATION
  // ============================================================================

  /**
   * Validate amendment before creation
   * Returns { valid: boolean, violations: string[] }
   */
  async validateAmendment(agentRole, amendment) {
    const violations = [];

    // Check protected patterns
    const protectedViolation = this.checkProtectedPatterns(amendment);
    if (protectedViolation) {
      violations.push(protectedViolation);
    }

    // Check amendment limit
    const limitViolation = await this.checkAmendmentLimit(agentRole);
    if (limitViolation) {
      violations.push(limitViolation);
    }

    // Check for conflicts
    const conflictViolation = await this.checkConflicts(agentRole, amendment);
    if (conflictViolation) {
      violations.push(conflictViolation);
    }

    // Log violations if any
    if (violations.length > 0) {
      for (const violation of violations) {
        await this.logSafetyEvent(agentRole, violation.type, violation.data, violation.action);
      }
    }

    return {
      valid: violations.length === 0,
      violations: violations.map(v => v.message),
    };
  }

  /**
   * Check if amendment modifies protected patterns
   */
  checkProtectedPatterns(amendment) {
    const textToCheck = [
      amendment.trigger_pattern,
      amendment.instruction_delta,
      JSON.stringify(amendment.knowledge_mutation || {}),
    ].join(' ');

    for (const pattern of PROTECTED_PATTERNS) {
      if (pattern.test(textToCheck)) {
        return {
          type: CONSTRAINT_TYPES.PROTECTED_PATTERN_VIOLATION,
          message: `Amendment attempts to modify protected pattern: ${pattern.toString()}`,
          data: {
            matched_pattern: pattern.toString(),
            amendment_content: textToCheck.substring(0, 200),
          },
          action: 'Amendment rejected - protected pattern violation',
        };
      }
    }

    return null;
  }

  /**
   * Check if agent has reached amendment limit
   */
  async checkAmendmentLimit(agentRole) {
    if (!this.isAvailable()) return null;

    const { data: amendments } = await this.supabase
      .from('monolith_amendments')
      .select('id')
      .eq('agent_role', agentRole)
      .eq('is_active', true);

    const count = amendments?.length || 0;

    if (count >= this.limits.MAX_ACTIVE_AMENDMENTS) {
      return {
        type: CONSTRAINT_TYPES.MAX_AMENDMENTS_EXCEEDED,
        message: `Agent ${agentRole} has reached maximum active amendments (${this.limits.MAX_ACTIVE_AMENDMENTS})`,
        data: {
          current_count: count,
          max_allowed: this.limits.MAX_ACTIVE_AMENDMENTS,
        },
        action: 'Amendment rejected - limit exceeded',
      };
    }

    return null;
  }

  /**
   * Check for conflicting amendments
   */
  async checkConflicts(agentRole, amendment) {
    if (!this.isAvailable()) return null;

    const { data: existing } = await this.supabase
      .from('monolith_amendments')
      .select('id, trigger_pattern, instruction_delta')
      .eq('agent_role', agentRole)
      .eq('is_active', true);

    if (!existing) return null;

    for (const existingAmendment of existing) {
      // Check for same trigger pattern
      if (existingAmendment.trigger_pattern === amendment.trigger_pattern) {
        return {
          type: CONSTRAINT_TYPES.CONFLICTING_AMENDMENT,
          message: `Amendment conflicts with existing amendment (same trigger: ${amendment.trigger_pattern})`,
          data: {
            existing_amendment_id: existingAmendment.id,
            trigger_pattern: amendment.trigger_pattern,
          },
          action: 'Amendment rejected - conflict with existing',
        };
      }

      // Check for contradictory instructions (simple heuristic)
      if (this.detectContradiction(existingAmendment.instruction_delta, amendment.instruction_delta)) {
        return {
          type: CONSTRAINT_TYPES.CONFLICTING_AMENDMENT,
          message: `Amendment may contradict existing amendment instructions`,
          data: {
            existing_amendment_id: existingAmendment.id,
            existing_instruction: existingAmendment.instruction_delta.substring(0, 100),
            new_instruction: amendment.instruction_delta.substring(0, 100),
          },
          action: 'Amendment flagged - potential contradiction',
        };
      }
    }

    return null;
  }

  /**
   * Simple contradiction detection
   */
  detectContradiction(existing, newInstruction) {
    const existingLower = existing.toLowerCase();
    const newLower = newInstruction.toLowerCase();

    // Check for obvious contradictions
    const contradictionPairs = [
      ['increase', 'decrease'],
      ['faster', 'slower'],
      ['more', 'less'],
      ['always', 'never'],
      ['enable', 'disable'],
      ['add', 'remove'],
    ];

    for (const [word1, word2] of contradictionPairs) {
      if ((existingLower.includes(word1) && newLower.includes(word2)) ||
          (existingLower.includes(word2) && newLower.includes(word1))) {
        // Additional check: same subject
        const existingWords = existingLower.split(/\s+/);
        const newWords = newLower.split(/\s+/);
        const commonWords = existingWords.filter(w => newWords.includes(w) && w.length > 4);
        if (commonWords.length > 0) {
          return true;
        }
      }
    }

    return false;
  }

  // ============================================================================
  // ENFORCEMENT ACTIONS
  // ============================================================================

  /**
   * Check and enforce evaluation timeout
   */
  async enforceEvaluationTimeout() {
    if (!this.isAvailable()) {
      return { processed: 0, error: { message: 'Database unavailable' } };
    }

    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() - this.limits.EVALUATION_TIMEOUT_HOURS);

    // Find amendments stuck in evaluation
    const { data: stuckAmendments } = await this.supabase
      .from('monolith_amendments')
      .select('*')
      .eq('evaluation_status', 'evaluating')
      .lt('approved_at', timeoutDate.toISOString());

    if (!stuckAmendments || stuckAmendments.length === 0) {
      return { processed: 0, error: null };
    }

    let processed = 0;

    for (const amendment of stuckAmendments) {
      // Check evaluation progress
      const { data: evaluations } = await this.supabase
        .from('monolith_amendment_evaluations')
        .select('success')
        .eq('amendment_id', amendment.id);

      const evalCount = evaluations?.length || 0;

      if (evalCount < this.limits.MIN_EVALUATION_TASKS) {
        // Insufficient evaluations - revert
        await this.supabase
          .from('monolith_amendments')
          .update({
            is_active: false,
            evaluation_status: 'reverted',
            superseded_at: new Date().toISOString(),
          })
          .eq('id', amendment.id);

        await this.logSafetyEvent(
          amendment.agent_role,
          CONSTRAINT_TYPES.EVALUATION_TIMEOUT,
          {
            amendment_id: amendment.id,
            evaluations_completed: evalCount,
            required_evaluations: this.limits.MIN_EVALUATION_TASKS,
            timeout_hours: this.limits.EVALUATION_TIMEOUT_HOURS,
          },
          'Amendment reverted due to evaluation timeout'
        );

        processed++;
      }
    }

    console.log(`[SAFETY] Processed ${processed} timed-out amendments`);
    return { processed, error: null };
  }

  /**
   * Check for consecutive failures and trigger auto-revert
   * (This is also handled by database trigger, but can be called manually)
   */
  async checkAutoRevert(amendmentId) {
    if (!this.isAvailable()) {
      return { reverted: false, error: { message: 'Database unavailable' } };
    }

    const { data: evaluations } = await this.supabase
      .from('monolith_amendment_evaluations')
      .select('success, evaluation_position')
      .eq('amendment_id', amendmentId)
      .order('evaluation_position', { ascending: false })
      .limit(this.limits.AUTO_REVERT_FAILURES);

    if (!evaluations || evaluations.length < this.limits.AUTO_REVERT_FAILURES) {
      return { reverted: false, error: null };
    }

    // Check if all recent evaluations are failures
    const allFailures = evaluations.every(e => !e.success);

    if (allFailures) {
      // Get amendment details for logging
      const { data: amendment } = await this.supabase
        .from('monolith_amendments')
        .select('agent_role, trigger_pattern')
        .eq('id', amendmentId)
        .single();

      // Revert
      await this.supabase
        .from('monolith_amendments')
        .update({
          is_active: false,
          evaluation_status: 'reverted',
          superseded_at: new Date().toISOString(),
        })
        .eq('id', amendmentId);

      await this.logSafetyEvent(
        amendment?.agent_role || 'unknown',
        CONSTRAINT_TYPES.AUTO_REVERT_TRIGGERED,
        {
          amendment_id: amendmentId,
          trigger_pattern: amendment?.trigger_pattern,
          consecutive_failures: this.limits.AUTO_REVERT_FAILURES,
        },
        `Amendment auto-reverted after ${this.limits.AUTO_REVERT_FAILURES} consecutive failures`
      );

      console.log(`[SAFETY] Auto-reverted amendment ${amendmentId}`);
      return { reverted: true, error: null };
    }

    return { reverted: false, error: null };
  }

  // ============================================================================
  // SAFETY LOGGING
  // ============================================================================

  /**
   * Log safety event to database
   */
  async logSafetyEvent(agentRole, constraintType, constraintData, actionTaken, amendmentId = null) {
    if (!this.isAvailable()) return;

    await this.supabase
      .from('monolith_safety_log')
      .insert([{
        agent_role: agentRole,
        constraint_type: constraintType,
        constraint_data: constraintData,
        action_taken: actionTaken,
        amendment_id: amendmentId,
      }]);

    console.log(`[SAFETY] ${constraintType}: ${actionTaken}`);
  }

  /**
   * Get safety log for an agent
   */
  async getSafetyLog(agentRole = null, limit = 50) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from('monolith_safety_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (agentRole) {
      query = query.eq('agent_role', agentRole);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  }

  /**
   * Get safety statistics
   */
  async getSafetyStats() {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data: logs } = await this.supabase
      .from('monolith_safety_log')
      .select('constraint_type, agent_role');

    if (!logs) return { data: null, error: null };

    const stats = {
      total_events: logs.length,
      by_type: {},
      by_agent: {},
    };

    for (const log of logs) {
      stats.by_type[log.constraint_type] = (stats.by_type[log.constraint_type] || 0) + 1;
      stats.by_agent[log.agent_role] = (stats.by_agent[log.agent_role] || 0) + 1;
    }

    return { data: stats, error: null };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Run all safety checks (scheduled job)
   */
  async runSafetyChecks() {
    console.log('[SAFETY] Running safety checks...');

    const results = {
      timeouts: await this.enforceEvaluationTimeout(),
    };

    console.log('[SAFETY] Safety checks complete:', results);
    return results;
  }

  /**
   * Check if an action is protected (cannot be amended)
   */
  isProtectedAction(action) {
    for (const pattern of PROTECTED_PATTERNS) {
      if (pattern.test(action)) {
        return true;
      }
    }
    return false;
  }
}

// Export
export { AmendmentSafety, SAFETY_LIMITS, PROTECTED_PATTERNS, CONSTRAINT_TYPES };
export default AmendmentSafety;
