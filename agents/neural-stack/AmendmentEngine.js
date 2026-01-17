/**
 * AMENDMENT ENGINE - Phase 5C
 * Cognalith Inc. | Monolith System
 *
 * Generates amendments from detected patterns. Amendments are instruction
 * deltas that modify agent behavior to address performance issues.
 *
 * KEY PRINCIPLE: Amendments only modify the Knowledge layer (Layer 3).
 * Persona (Layer 1) and Skills (Layer 2) are immutable.
 */

import { createClient } from '@supabase/supabase-js';
import { PATTERN_TYPES } from './PatternDetector.js';

// Amendment templates by pattern type
const AMENDMENT_TEMPLATES = {
  [PATTERN_TYPES.REPEATED_FAILURE]: {
    amendment_type: 'behavioral',
    template: (pattern) => ({
      trigger_pattern: `task_category:${pattern.data.primary_category}`,
      instruction_delta: `When handling ${pattern.data.primary_category} tasks, apply extra caution. Common failure points: ${pattern.data.common_reasons.join(', ')}. Verify each step before proceeding.`,
      knowledge_mutation: {
        category_guidance: {
          [pattern.data.primary_category]: {
            risk_level: 'elevated',
            common_failures: pattern.data.common_reasons,
            recommended_approach: 'step-by-step verification',
          },
        },
      },
    }),
  },

  [PATTERN_TYPES.TIME_REGRESSION]: {
    amendment_type: 'efficiency',
    template: (pattern) => ({
      trigger_pattern: `task_category:${pattern.data.slowest_category}`,
      instruction_delta: `Optimize execution time for ${pattern.data.slowest_category} tasks. Current: ${pattern.data.recent_avg_seconds}s, Target: ${pattern.data.baseline_avg_seconds}s. Identify bottlenecks before starting.`,
      knowledge_mutation: {
        efficiency_targets: {
          [pattern.data.slowest_category]: {
            target_seconds: pattern.data.baseline_avg_seconds,
            current_seconds: pattern.data.recent_avg_seconds,
            optimization_required: true,
          },
        },
      },
    }),
  },

  [PATTERN_TYPES.QUALITY_DECLINE]: {
    amendment_type: 'quality',
    template: (pattern) => ({
      trigger_pattern: 'quality_check:pre_delivery',
      instruction_delta: `Quality focus required. Recent average: ${pattern.data.recent_avg_quality}, Baseline: ${pattern.data.baseline_avg_quality}. Review deliverables against quality checklist before submission.`,
      knowledge_mutation: {
        quality_standards: {
          min_acceptable: parseFloat(pattern.data.baseline_avg_quality),
          current_trend: 'declining',
          review_required: true,
        },
      },
    }),
  },

  [PATTERN_TYPES.CATEGORY_WEAKNESS]: {
    amendment_type: 'skill_gap',
    template: (pattern) => ({
      trigger_pattern: `task_category:${pattern.data.weak_category}`,
      instruction_delta: `Enhanced attention needed for ${pattern.data.weak_category} tasks. Success rate: ${(parseFloat(pattern.data.category_success_rate) * 100).toFixed(0)}%. Break down into smaller steps and validate each component.`,
      knowledge_mutation: {
        skill_gaps: {
          [pattern.data.weak_category]: {
            current_success_rate: parseFloat(pattern.data.category_success_rate),
            target_success_rate: 0.85,
            approach: 'decomposition',
          },
        },
      },
    }),
  },

  [PATTERN_TYPES.TOOL_INEFFICIENCY]: {
    amendment_type: 'tooling',
    template: (pattern) => ({
      trigger_pattern: `tool_use:${pattern.data.inefficient_tool}`,
      instruction_delta: `Reconsider using ${pattern.data.inefficient_tool}. Success rate: ${(parseFloat(pattern.data.tool_success_rate) * 100).toFixed(0)}%. Consider alternatives or validate preconditions before use.`,
      knowledge_mutation: {
        tool_guidance: {
          [pattern.data.inefficient_tool]: {
            reliability: parseFloat(pattern.data.tool_success_rate),
            recommendation: 'use_with_caution',
            validate_before_use: true,
          },
        },
      },
    }),
  },
};

/**
 * Amendment Engine
 * Generates amendments from detected patterns
 */
class AmendmentEngine {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
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
  // AMENDMENT GENERATION
  // ============================================================================

  /**
   * Generate amendment from a detected pattern
   */
  generateAmendment(pattern) {
    const template = AMENDMENT_TEMPLATES[pattern.type];
    if (!template) {
      return {
        error: `No template for pattern type: ${pattern.type}`,
        amendment: null,
      };
    }

    const generated = template.template(pattern);

    return {
      error: null,
      amendment: {
        amendment_type: template.amendment_type,
        trigger_pattern: generated.trigger_pattern,
        instruction_delta: generated.instruction_delta,
        knowledge_mutation: generated.knowledge_mutation,
        source_pattern: pattern,
        pattern_confidence: pattern.confidence,
      },
    };
  }

  /**
   * Create amendment in database (pending approval)
   */
  async createAmendment(agentRole, amendment, autoApprove = false) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Check amendment limit
    const { data: limitOk } = await this.supabase.rpc('check_amendment_limit', {
      p_agent_role: agentRole,
    });

    if (limitOk === false) {
      return {
        data: null,
        error: { message: 'Amendment limit reached (max 10 active amendments)' },
      };
    }

    // Check for existing similar amendment
    const { data: existing } = await this.supabase
      .from('monolith_amendments')
      .select('id, trigger_pattern')
      .eq('agent_role', agentRole)
      .eq('trigger_pattern', amendment.trigger_pattern)
      .eq('is_active', true)
      .single();

    if (existing) {
      return {
        data: null,
        error: { message: `Active amendment already exists for trigger: ${amendment.trigger_pattern}` },
        existing_id: existing.id,
      };
    }

    // Create amendment
    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .insert([{
        agent_role: agentRole,
        amendment_type: amendment.amendment_type,
        trigger_pattern: amendment.trigger_pattern,
        instruction_delta: amendment.instruction_delta,
        knowledge_mutation: amendment.knowledge_mutation,
        source_pattern: amendment.source_pattern,
        pattern_confidence: amendment.pattern_confidence,
        approval_status: autoApprove ? 'auto_approved' : 'pending',
        is_active: autoApprove,
        evaluation_status: autoApprove ? 'evaluating' : 'pending',
      }])
      .select()
      .single();

    if (!error) {
      console.log(`[AMENDMENT] Created ${amendment.amendment_type} amendment for ${agentRole}: ${amendment.trigger_pattern}`);
    }

    return { data, error };
  }

  /**
   * Generate and create amendment from pattern in one step
   */
  async processPattern(agentRole, pattern, autoApprove = false) {
    const { error: genError, amendment } = this.generateAmendment(pattern);
    if (genError) {
      return { data: null, error: { message: genError } };
    }

    return this.createAmendment(agentRole, amendment, autoApprove);
  }

  // ============================================================================
  // AMENDMENT MANAGEMENT
  // ============================================================================

  /**
   * Get pending amendments (awaiting approval)
   */
  async getPendingAmendments(agentRole = null) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from('monolith_amendments')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });

    if (agentRole) {
      query = query.eq('agent_role', agentRole);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  }

  /**
   * Get active amendments for an agent
   */
  async getActiveAmendments(agentRole) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .select('*')
      .eq('agent_role', agentRole)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return { data: data || [], error };
  }

  /**
   * Approve amendment (CEO gate)
   */
  async approveAmendment(amendmentId, approvedBy, notes = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .update({
        approval_status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        approval_notes: notes,
        is_active: true,
        evaluation_status: 'evaluating',
      })
      .eq('id', amendmentId)
      .eq('approval_status', 'pending')
      .select()
      .single();

    if (!error && data) {
      console.log(`[AMENDMENT] Approved by ${approvedBy}: ${data.trigger_pattern}`);
    }

    return { data, error };
  }

  /**
   * Reject amendment
   */
  async rejectAmendment(amendmentId, rejectedBy, reason) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .update({
        approval_status: 'rejected',
        approved_by: rejectedBy,
        approved_at: new Date().toISOString(),
        approval_notes: reason,
        is_active: false,
      })
      .eq('id', amendmentId)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Deactivate amendment (manual or auto-revert)
   */
  async deactivateAmendment(amendmentId, reason = 'manual') {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .update({
        is_active: false,
        evaluation_status: reason === 'auto_revert' ? 'reverted' : 'superseded',
        superseded_at: new Date().toISOString(),
      })
      .eq('id', amendmentId)
      .select()
      .single();

    return { data, error };
  }

  // ============================================================================
  // EVALUATION TRACKING
  // ============================================================================

  /**
   * Record evaluation result for an amendment
   */
  async recordEvaluation(amendmentId, taskId, result) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get current evaluation count
    const { data: existing } = await this.supabase
      .from('monolith_amendment_evaluations')
      .select('evaluation_position')
      .eq('amendment_id', amendmentId)
      .order('evaluation_position', { ascending: false })
      .limit(1);

    const nextPosition = existing && existing.length > 0
      ? existing[0].evaluation_position + 1
      : 1;

    if (nextPosition > 5) {
      // Evaluation window complete - finalize
      return this.finalizeEvaluation(amendmentId);
    }

    const { data, error } = await this.supabase
      .from('monolith_amendment_evaluations')
      .insert([{
        amendment_id: amendmentId,
        task_id: taskId,
        success: result.success,
        time_seconds: result.time_seconds,
        quality_score: result.quality_score,
        agent_feedback: result.feedback,
        evaluation_position: nextPosition,
      }])
      .select()
      .single();

    // Check if this completes the window
    if (nextPosition === 5) {
      await this.finalizeEvaluation(amendmentId);
    }

    return { data, error };
  }

  /**
   * Finalize evaluation after 5-task window
   */
  async finalizeEvaluation(amendmentId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get all evaluations
    const { data: evaluations } = await this.supabase
      .from('monolith_amendment_evaluations')
      .select('*')
      .eq('amendment_id', amendmentId);

    if (!evaluations || evaluations.length === 0) {
      return { data: null, error: { message: 'No evaluations found' } };
    }

    const successCount = evaluations.filter(e => e.success).length;
    const failureCount = evaluations.filter(e => !e.success).length;
    const successRate = successCount / evaluations.length;

    // Determine outcome
    const status = successRate >= 0.6 ? 'proven' : 'reverted';
    const isActive = status === 'proven';

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .update({
        evaluation_status: status,
        is_active: isActive,
        success_count: successCount,
        failure_count: failureCount,
        superseded_at: isActive ? null : new Date().toISOString(),
      })
      .eq('id', amendmentId)
      .select()
      .single();

    console.log(`[AMENDMENT] Evaluation complete: ${status} (${successCount}/${evaluations.length} success)`);

    return { data, error };
  }

  /**
   * Get evaluation progress for an amendment
   */
  async getEvaluationProgress(amendmentId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data: evaluations } = await this.supabase
      .from('monolith_amendment_evaluations')
      .select('*')
      .eq('amendment_id', amendmentId)
      .order('evaluation_position', { ascending: true });

    const { data: amendment } = await this.supabase
      .from('monolith_amendments')
      .select('evaluation_status, is_active')
      .eq('id', amendmentId)
      .single();

    return {
      data: {
        completed: evaluations?.length || 0,
        total: 5,
        successes: evaluations?.filter(e => e.success).length || 0,
        failures: evaluations?.filter(e => !e.success).length || 0,
        evaluations: evaluations || [],
        status: amendment?.evaluation_status,
        is_active: amendment?.is_active,
      },
      error: null,
    };
  }

  // ============================================================================
  // VERSION MANAGEMENT
  // ============================================================================

  /**
   * Create new version of an amendment (supersedes previous)
   */
  async createNewVersion(amendmentId, updates) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get original
    const { data: original } = await this.supabase
      .from('monolith_amendments')
      .select('*')
      .eq('id', amendmentId)
      .single();

    if (!original) {
      return { data: null, error: { message: 'Original amendment not found' } };
    }

    // Deactivate original
    await this.deactivateAmendment(amendmentId, 'superseded');

    // Create new version
    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .insert([{
        agent_role: original.agent_role,
        amendment_type: updates.amendment_type || original.amendment_type,
        trigger_pattern: updates.trigger_pattern || original.trigger_pattern,
        instruction_delta: updates.instruction_delta || original.instruction_delta,
        knowledge_mutation: updates.knowledge_mutation || original.knowledge_mutation,
        source_pattern: original.source_pattern,
        pattern_confidence: original.pattern_confidence,
        version: original.version + 1,
        parent_amendment_id: original.id,
        approval_status: 'pending',
        is_active: false,
      }])
      .select()
      .single();

    return { data, error };
  }
}

// Export
export { AmendmentEngine, AMENDMENT_TEMPLATES };
export default AmendmentEngine;
