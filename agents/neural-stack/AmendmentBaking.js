/**
 * AMENDMENT BAKING - Phase 5E
 * Cognalith Inc. | Monolith System
 *
 * Amendment baking mechanism for proven amendments.
 * When an agent hits 10 active amendments, the oldest proven amendment
 * is "baked" into standard_knowledge, making it permanent.
 *
 * BAKING PROCESS:
 * 1. Select oldest proven amendment with 5+ successful evaluations
 * 2. Extract knowledge changes from amendment
 * 3. Merge into standard_knowledge layer
 * 4. Update knowledge version hash
 * 5. Mark amendment as baked
 * 6. Archive with full history
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Baking thresholds
const BAKING_CONFIG = {
  AMENDMENT_THRESHOLD: 10,       // Bake when agent hits 10 active amendments
  MIN_SUCCESSFUL_EVALS: 5,       // Amendment needs 5+ successful evaluations
  MIN_SUCCESS_RATE: 0.6,         // 60% success rate required
};

/**
 * Amendment Baking
 * Merges proven amendments into standard knowledge
 */
class AmendmentBaking {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.config = { ...BAKING_CONFIG, ...config };
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
  // BAKING THRESHOLD CHECK
  // ============================================================================

  /**
   * Check if agent has reached baking threshold
   */
  async checkBakingThreshold(agentRole) {
    if (!this.isAvailable()) {
      return { needsBaking: false, error: { message: 'Database unavailable' } };
    }

    const { data: amendments } = await this.supabase
      .from('monolith_amendments')
      .select('id')
      .eq('agent_role', agentRole)
      .eq('is_active', true)
      .eq('is_baked', false);

    const count = amendments?.length || 0;

    return {
      needsBaking: count >= this.config.AMENDMENT_THRESHOLD,
      currentCount: count,
      threshold: this.config.AMENDMENT_THRESHOLD,
      error: null,
    };
  }

  /**
   * Select amendment for baking (oldest proven with sufficient evaluations)
   */
  async selectAmendmentForBaking(agentRole) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get oldest proven amendment that hasn't been baked
    const { data: candidates } = await this.supabase
      .from('monolith_amendments')
      .select('*')
      .eq('agent_role', agentRole)
      .eq('is_active', true)
      .eq('is_baked', false)
      .eq('evaluation_status', 'proven')
      .gte('success_count', this.config.MIN_SUCCESSFUL_EVALS)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!candidates || candidates.length === 0) {
      return {
        data: null,
        error: { message: 'No eligible amendments for baking' },
      };
    }

    const amendment = candidates[0];

    // Verify success rate
    const totalEvals = (amendment.success_count || 0) + (amendment.failure_count || 0);
    if (totalEvals > 0) {
      const successRate = amendment.success_count / totalEvals;
      if (successRate < this.config.MIN_SUCCESS_RATE) {
        return {
          data: null,
          error: { message: `Amendment success rate ${(successRate * 100).toFixed(0)}% is below ${this.config.MIN_SUCCESS_RATE * 100}% threshold` },
        };
      }
    }

    return { data: amendment, error: null };
  }

  // ============================================================================
  // BAKING PROCESS
  // ============================================================================

  /**
   * Bake amendment into standard knowledge
   */
  async bakeAmendment(amendmentId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get amendment details
    const { data: amendment } = await this.supabase
      .from('monolith_amendments')
      .select('*')
      .eq('id', amendmentId)
      .single();

    if (!amendment) {
      return { data: null, error: { message: 'Amendment not found' } };
    }

    if (amendment.is_baked) {
      return { data: null, error: { message: 'Amendment already baked' } };
    }

    // Get current knowledge layer
    const { data: layer } = await this.supabase
      .from('monolith_knowledge_layer')
      .select('*')
      .eq('agent_role', amendment.agent_role)
      .single();

    if (!layer) {
      return { data: null, error: { message: 'Knowledge layer not found' } };
    }

    // Compute previous version hash
    const previousHash = this.computeVersionHash(layer.standard_knowledge || {});

    // Merge amendment into standard knowledge
    const mergedKnowledge = this.mergeIntoStandard(
      layer.standard_knowledge || {},
      amendment.knowledge_mutation || {},
      amendment.instruction_delta
    );

    // Compute new version hash
    const newHash = this.computeVersionHash(mergedKnowledge);

    // Get evaluation history
    const { data: evaluations } = await this.supabase
      .from('monolith_amendment_evaluations')
      .select('*')
      .eq('amendment_id', amendmentId);

    // Begin transaction-like operations
    // 1. Update knowledge layer
    const { error: layerError } = await this.supabase
      .from('monolith_knowledge_layer')
      .update({
        standard_knowledge: mergedKnowledge,
        last_computed_at: new Date().toISOString(),
        computation_version: (layer.computation_version || 0) + 1,
      })
      .eq('agent_role', amendment.agent_role);

    if (layerError) {
      return { data: null, error: layerError };
    }

    // 2. Mark amendment as baked
    const { error: amendmentError } = await this.supabase
      .from('monolith_amendments')
      .update({
        is_baked: true,
        baked_at: new Date().toISOString(),
        is_active: false, // No longer active as separate amendment
      })
      .eq('id', amendmentId);

    if (amendmentError) {
      return { data: null, error: amendmentError };
    }

    // 3. Archive baked amendment
    const archiveData = {
      original_amendment_id: amendmentId,
      agent_role: amendment.agent_role,
      amendment_type: amendment.amendment_type,
      trigger_pattern: amendment.trigger_pattern,
      instruction_delta: amendment.instruction_delta,
      baked_changes: amendment.knowledge_mutation,
      previous_version_hash: previousHash,
      new_version_hash: newHash,
      evaluation_history: evaluations || [],
      total_successes: amendment.success_count || 0,
      total_evaluations: (amendment.success_count || 0) + (amendment.failure_count || 0),
    };

    const { data: archived, error: archiveError } = await this.supabase
      .from('baked_amendments')
      .insert([archiveData])
      .select()
      .single();

    if (archiveError) {
      console.error('[BAKING] Archive error:', archiveError);
      // Non-fatal - baking still succeeded
    }

    console.log(`[BAKING] Amendment baked for ${amendment.agent_role}: ${amendment.trigger_pattern}`);
    console.log(`[BAKING] Version hash: ${previousHash.substring(0, 8)}... -> ${newHash.substring(0, 8)}...`);

    return {
      data: {
        amendmentId,
        agentRole: amendment.agent_role,
        triggerPattern: amendment.trigger_pattern,
        previousHash,
        newHash,
        archived: archived || archiveData,
      },
      error: null,
    };
  }

  /**
   * Merge amendment knowledge into standard knowledge
   */
  mergeIntoStandard(standard, mutation, instructionDelta) {
    const merged = { ...standard };

    // Merge category guidance
    if (mutation.category_guidance) {
      merged.category_guidance = {
        ...(merged.category_guidance || {}),
        ...mutation.category_guidance,
      };
    }

    // Merge efficiency targets
    if (mutation.efficiency_targets) {
      merged.efficiency_targets = {
        ...(merged.efficiency_targets || {}),
        ...mutation.efficiency_targets,
      };
    }

    // Merge quality standards
    if (mutation.quality_standards) {
      merged.quality_standards = {
        ...(merged.quality_standards || {}),
        ...mutation.quality_standards,
      };
    }

    // Merge skill gaps
    if (mutation.skill_gaps) {
      merged.skill_gaps = {
        ...(merged.skill_gaps || {}),
        ...mutation.skill_gaps,
      };
    }

    // Merge tool guidance
    if (mutation.tool_guidance) {
      merged.tool_guidance = {
        ...(merged.tool_guidance || {}),
        ...mutation.tool_guidance,
      };
    }

    // Add instruction to permanent instructions
    if (instructionDelta) {
      if (!merged.permanent_instructions) {
        merged.permanent_instructions = [];
      }
      merged.permanent_instructions.push({
        instruction: instructionDelta,
        baked_at: new Date().toISOString(),
      });
    }

    // Update metadata
    merged._last_baked_at = new Date().toISOString();

    return merged;
  }

  /**
   * Compute SHA256 hash of knowledge for version tracking
   */
  computeVersionHash(knowledge) {
    const content = JSON.stringify(knowledge, Object.keys(knowledge).sort());
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // ============================================================================
  // AUTOMATIC BAKING
  // ============================================================================

  /**
   * Run automatic baking check for an agent
   */
  async runAutoBaking(agentRole) {
    // Check if baking is needed
    const { needsBaking, currentCount } = await this.checkBakingThreshold(agentRole);

    if (!needsBaking) {
      return {
        baked: false,
        reason: `Current count (${currentCount}) below threshold (${this.config.AMENDMENT_THRESHOLD})`,
      };
    }

    // Select amendment for baking
    const { data: amendment, error: selectError } = await this.selectAmendmentForBaking(agentRole);

    if (selectError || !amendment) {
      return {
        baked: false,
        reason: selectError?.message || 'No eligible amendment',
      };
    }

    // Bake the amendment
    const { data: result, error: bakeError } = await this.bakeAmendment(amendment.id);

    if (bakeError) {
      return {
        baked: false,
        reason: bakeError.message,
      };
    }

    return {
      baked: true,
      result,
    };
  }

  /**
   * Run baking check for all agents
   */
  async runGlobalBakingCheck() {
    if (!this.isAvailable()) {
      return { results: [], error: { message: 'Database unavailable' } };
    }

    // Get all agents with active amendments
    const { data: agents } = await this.supabase
      .from('monolith_amendments')
      .select('agent_role')
      .eq('is_active', true)
      .eq('is_baked', false);

    if (!agents) {
      return { results: [], error: null };
    }

    const uniqueAgents = [...new Set(agents.map(a => a.agent_role))];
    const results = [];

    for (const agentRole of uniqueAgents) {
      const result = await this.runAutoBaking(agentRole);
      results.push({
        agentRole,
        ...result,
      });
    }

    return { results, error: null };
  }

  // ============================================================================
  // ARCHIVE QUERIES
  // ============================================================================

  /**
   * Get baked amendments history
   */
  async getBakedAmendments(agentRole = null, limit = 50) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from('baked_amendments')
      .select('*')
      .order('baked_at', { ascending: false })
      .limit(limit);

    if (agentRole) {
      query = query.eq('agent_role', agentRole);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  }

  /**
   * Get baking statistics
   */
  async getBakingStats() {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data: baked } = await this.supabase
      .from('baked_amendments')
      .select('agent_role, baked_at');

    if (!baked) return { data: null, error: null };

    const stats = {
      total_baked: baked.length,
      by_agent: {},
      recent: baked.filter(b => {
        const date = new Date(b.baked_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date > weekAgo;
      }).length,
    };

    for (const b of baked) {
      stats.by_agent[b.agent_role] = (stats.by_agent[b.agent_role] || 0) + 1;
    }

    return { data: stats, error: null };
  }

  /**
   * Get version history for an agent
   */
  async getVersionHistory(agentRole) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('baked_amendments')
      .select('previous_version_hash, new_version_hash, baked_at, trigger_pattern')
      .eq('agent_role', agentRole)
      .order('baked_at', { ascending: true });

    return { data: data || [], error };
  }
}

// Export
export { AmendmentBaking, BAKING_CONFIG };
export default AmendmentBaking;
