/**
 * EXCEPTION ESCALATION - Phase 5E
 * Cognalith Inc. | Monolith System
 *
 * Exception-only escalation logic for CEO involvement.
 * In autonomous mode, CoS operates independently EXCEPT for:
 *
 * ESCALATION TRIGGERS (HARDCODED):
 * 1. Skills layer modification attempt
 * 2. Persona layer modification attempt (should never happen)
 * 3. 3+ consecutive failures on same agent
 * 4. Cross-agent pattern detected (3+ agents declining)
 *
 * All other amendments are handled autonomously by CoS.
 */

import { createClient } from '@supabase/supabase-js';

// Escalation reasons (HARDCODED - cannot be modified by CoS)
const ESCALATION_REASONS = Object.freeze({
  SKILLS_LAYER_MODIFICATION: 'skills_layer_mod',
  PERSONA_LAYER_MODIFICATION: 'persona_layer_mod',
  CONSECUTIVE_FAILURES: 'consecutive_failures',
  CROSS_AGENT_PATTERN: 'cross_agent_pattern',
});

// Hardcoded thresholds (CoS cannot modify these)
const ESCALATION_THRESHOLDS = Object.freeze({
  CONSECUTIVE_FAILURE_TRIGGER: 3,  // 3 consecutive failures → escalate
  CROSS_AGENT_DECLINE_COUNT: 3,    // 3+ agents declining → escalate
  CROSS_AGENT_TIME_WINDOW_HOURS: 1, // Within 1 hour
});

// Protected layer keywords
const SKILLS_LAYER_KEYWORDS = [
  'skill', 'capability', 'ability', 'competency',
  'can_do', 'cannot_do', 'authority', 'permission',
];

const PERSONA_LAYER_KEYWORDS = [
  'persona', 'identity', 'core_values', 'fundamental',
  'base_behavior', 'immutable', 'character', 'personality',
];

/**
 * Exception Escalation
 * Determines when amendments require CEO escalation
 */
class ExceptionEscalation {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.thresholds = ESCALATION_THRESHOLDS; // Cannot be overridden
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
  // ESCALATION DETECTION
  // ============================================================================

  /**
   * Check if amendment requires escalation
   * Returns { shouldEscalate: boolean, reason: string|null, analysis: object }
   */
  async shouldEscalate(amendment, agentRole) {
    // Check 1: Skills layer modification
    const skillsCheck = this.checkSkillsLayerModification(amendment);
    if (skillsCheck.detected) {
      return {
        shouldEscalate: true,
        reason: ESCALATION_REASONS.SKILLS_LAYER_MODIFICATION,
        analysis: skillsCheck,
      };
    }

    // Check 2: Persona layer modification
    const personaCheck = this.checkPersonaLayerModification(amendment);
    if (personaCheck.detected) {
      return {
        shouldEscalate: true,
        reason: ESCALATION_REASONS.PERSONA_LAYER_MODIFICATION,
        analysis: personaCheck,
      };
    }

    // Check 3: Consecutive failures (requires DB)
    if (this.isAvailable()) {
      const failureCheck = await this.checkConsecutiveFailures(agentRole);
      if (failureCheck.detected) {
        return {
          shouldEscalate: true,
          reason: ESCALATION_REASONS.CONSECUTIVE_FAILURES,
          analysis: failureCheck,
        };
      }

      // Check 4: Cross-agent pattern
      const crossAgentCheck = await this.checkCrossAgentPattern();
      if (crossAgentCheck.detected) {
        return {
          shouldEscalate: true,
          reason: ESCALATION_REASONS.CROSS_AGENT_PATTERN,
          analysis: crossAgentCheck,
        };
      }
    }

    // No escalation needed - proceed autonomously
    return {
      shouldEscalate: false,
      reason: null,
      analysis: { autonomous: true },
    };
  }

  /**
   * Check if amendment attempts to modify Skills layer
   */
  checkSkillsLayerModification(amendment) {
    const textToCheck = [
      amendment.trigger_pattern || '',
      amendment.instruction_delta || '',
      JSON.stringify(amendment.knowledge_mutation || {}),
    ].join(' ').toLowerCase();

    const matchedKeywords = [];
    for (const keyword of SKILLS_LAYER_KEYWORDS) {
      if (textToCheck.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    // Check for explicit layer targeting
    const targetsSkills = textToCheck.includes('layer_2') ||
                          textToCheck.includes('skills_layer') ||
                          textToCheck.includes('modify_skill');

    return {
      detected: matchedKeywords.length >= 2 || targetsSkills,
      matchedKeywords,
      targetsSkills,
      reason: 'Amendment may modify Skills layer (Layer 2)',
    };
  }

  /**
   * Check if amendment attempts to modify Persona layer
   */
  checkPersonaLayerModification(amendment) {
    const textToCheck = [
      amendment.trigger_pattern || '',
      amendment.instruction_delta || '',
      JSON.stringify(amendment.knowledge_mutation || {}),
    ].join(' ').toLowerCase();

    const matchedKeywords = [];
    for (const keyword of PERSONA_LAYER_KEYWORDS) {
      if (textToCheck.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    // Check for explicit layer targeting
    const targetsPersona = textToCheck.includes('layer_1') ||
                           textToCheck.includes('persona_layer') ||
                           textToCheck.includes('base_knowledge');

    return {
      detected: matchedKeywords.length >= 2 || targetsPersona,
      matchedKeywords,
      targetsPersona,
      reason: 'Amendment may modify Persona layer (Layer 1) - CRITICAL',
    };
  }

  /**
   * Check for consecutive failures on an agent
   */
  async checkConsecutiveFailures(agentRole) {
    if (!this.isAvailable()) {
      return { detected: false, error: 'Database unavailable' };
    }

    const { data } = await this.supabase
      .from('consecutive_failures')
      .select('failure_count, failure_pattern, last_failure_at, escalated')
      .eq('agent_role', agentRole)
      .single();

    if (!data) {
      return { detected: false, failure_count: 0 };
    }

    // Already escalated for this failure streak
    if (data.escalated) {
      return { detected: false, already_escalated: true, failure_count: data.failure_count };
    }

    const shouldEscalate = data.failure_count >= this.thresholds.CONSECUTIVE_FAILURE_TRIGGER;

    return {
      detected: shouldEscalate,
      failure_count: data.failure_count,
      failure_pattern: data.failure_pattern,
      last_failure_at: data.last_failure_at,
      threshold: this.thresholds.CONSECUTIVE_FAILURE_TRIGGER,
      reason: shouldEscalate
        ? `${data.failure_count} consecutive failures on ${agentRole}`
        : null,
    };
  }

  /**
   * Check for cross-agent decline pattern
   */
  async checkCrossAgentPattern() {
    if (!this.isAvailable()) {
      return { detected: false, error: 'Database unavailable' };
    }

    const timeWindow = new Date();
    timeWindow.setHours(timeWindow.getHours() - this.thresholds.CROSS_AGENT_TIME_WINDOW_HOURS);

    // Get recent amendment evaluations
    const { data: recentEvals } = await this.supabase
      .from('monolith_amendment_evaluations')
      .select('amendment_id, success')
      .eq('success', false)
      .gte('evaluated_at', timeWindow.toISOString());

    if (!recentEvals || recentEvals.length === 0) {
      return { detected: false, declining_agents: [] };
    }

    // Get agent roles for failed amendments
    const amendmentIds = [...new Set(recentEvals.map(e => e.amendment_id))];

    const { data: amendments } = await this.supabase
      .from('monolith_amendments')
      .select('agent_role')
      .in('id', amendmentIds);

    if (!amendments) {
      return { detected: false, declining_agents: [] };
    }

    // Count failures per agent
    const agentFailures = {};
    for (const a of amendments) {
      agentFailures[a.agent_role] = (agentFailures[a.agent_role] || 0) + 1;
    }

    // Find agents with multiple failures
    const decliningAgents = Object.entries(agentFailures)
      .filter(([_, count]) => count >= 2)
      .map(([agent]) => agent);

    const shouldEscalate = decliningAgents.length >= this.thresholds.CROSS_AGENT_DECLINE_COUNT;

    return {
      detected: shouldEscalate,
      declining_agents: decliningAgents,
      agent_count: decliningAgents.length,
      threshold: this.thresholds.CROSS_AGENT_DECLINE_COUNT,
      time_window_hours: this.thresholds.CROSS_AGENT_TIME_WINDOW_HOURS,
      reason: shouldEscalate
        ? `Cross-agent decline: ${decliningAgents.length} agents showing failures`
        : null,
    };
  }

  // ============================================================================
  // ESCALATION MANAGEMENT
  // ============================================================================

  /**
   * Create escalation record
   */
  async createEscalation(amendment, agentRole, reason, analysis) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('exception_escalations')
      .insert([{
        amendment_id: amendment?.id || null,
        agent_role: agentRole,
        reason,
        analysis,
        status: 'pending',
      }])
      .select()
      .single();

    if (!error && data) {
      console.log(`[ESCALATION] Created: ${reason} for ${agentRole}`);

      // If consecutive failures, mark as escalated
      if (reason === ESCALATION_REASONS.CONSECUTIVE_FAILURES) {
        await this.supabase
          .from('consecutive_failures')
          .update({ escalated: true, escalation_id: data.id })
          .eq('agent_role', agentRole);
      }
    }

    return { data, error };
  }

  /**
   * Get active escalations for CEO review
   */
  async getActiveEscalations() {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('exception_escalations')
      .select(`
        *,
        amendment:monolith_amendments(
          trigger_pattern,
          instruction_delta,
          amendment_type,
          pattern_confidence
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    return { data: data || [], error };
  }

  /**
   * Resolve escalation (CEO action)
   */
  async resolveEscalation(escalationId, resolution, resolvedBy = 'frank', notes = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    if (!['approved', 'rejected', 'dismissed'].includes(resolution)) {
      return { data: null, error: { message: 'Invalid resolution. Use: approved, rejected, dismissed' } };
    }

    const { data, error } = await this.supabase
      .from('exception_escalations')
      .update({
        status: resolution,
        resolved_by: resolvedBy,
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', escalationId)
      .eq('status', 'pending')
      .select()
      .single();

    if (!error && data) {
      console.log(`[ESCALATION] Resolved by ${resolvedBy}: ${resolution}`);

      // If approved and has amendment, activate it
      if (resolution === 'approved' && data.amendment_id) {
        await this.supabase
          .from('monolith_amendments')
          .update({
            approval_status: 'approved',
            approved_by: resolvedBy,
            approved_at: new Date().toISOString(),
            is_active: true,
            evaluation_status: 'evaluating',
          })
          .eq('id', data.amendment_id);
      }

      // Reset consecutive failures if this was that type of escalation
      if (data.reason === ESCALATION_REASONS.CONSECUTIVE_FAILURES) {
        await this.supabase
          .from('consecutive_failures')
          .update({
            failure_count: 0,
            escalated: false,
            reset_at: new Date().toISOString(),
          })
          .eq('agent_role', data.agent_role);
      }
    }

    return { data, error };
  }

  /**
   * Get escalation history
   */
  async getEscalationHistory(limit = 50) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('exception_escalations')
      .select('*')
      .not('status', 'eq', 'pending')
      .order('resolved_at', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  /**
   * Get escalation statistics
   */
  async getEscalationStats() {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data } = await this.supabase
      .from('exception_escalations')
      .select('status, reason, agent_role');

    if (!data) return { data: null, error: null };

    const stats = {
      total: data.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      dismissed: 0,
      by_reason: {},
      by_agent: {},
    };

    for (const e of data) {
      stats[e.status] = (stats[e.status] || 0) + 1;
      stats.by_reason[e.reason] = (stats.by_reason[e.reason] || 0) + 1;
      stats.by_agent[e.agent_role] = (stats.by_agent[e.agent_role] || 0) + 1;
    }

    return { data: stats, error: null };
  }

  // ============================================================================
  // CONSECUTIVE FAILURE TRACKING
  // ============================================================================

  /**
   * Record a failure for consecutive failure tracking
   */
  async recordFailure(agentRole, failurePattern = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Upsert consecutive_failures record
    const { data: existing } = await this.supabase
      .from('consecutive_failures')
      .select('*')
      .eq('agent_role', agentRole)
      .single();

    if (existing) {
      // Increment
      const { data, error } = await this.supabase
        .from('consecutive_failures')
        .update({
          failure_count: existing.failure_count + 1,
          failure_pattern: failurePattern || existing.failure_pattern,
          last_failure_at: new Date().toISOString(),
        })
        .eq('agent_role', agentRole)
        .select()
        .single();

      return { data, error };
    } else {
      // Create new
      const { data, error } = await this.supabase
        .from('consecutive_failures')
        .insert([{
          agent_role: agentRole,
          failure_count: 1,
          failure_pattern: failurePattern,
          last_failure_at: new Date().toISOString(),
        }])
        .select()
        .single();

      return { data, error };
    }
  }

  /**
   * Reset consecutive failures (on success)
   */
  async resetConsecutiveFailures(agentRole) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('consecutive_failures')
      .update({
        failure_count: 0,
        failure_pattern: null,
        escalated: false,
        escalation_id: null,
        reset_at: new Date().toISOString(),
      })
      .eq('agent_role', agentRole)
      .select()
      .single();

    return { data, error };
  }
}

// Export
export { ExceptionEscalation, ESCALATION_REASONS, ESCALATION_THRESHOLDS };
export default ExceptionEscalation;
