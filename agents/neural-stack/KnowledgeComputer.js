/**
 * KNOWLEDGE COMPUTER - Phase 5C
 * Cognalith Inc. | Monolith System
 *
 * Computes effective knowledge for agents from three layers:
 * - Base Knowledge: Immutable persona-level knowledge
 * - Standard Knowledge: Role-specific operational standards
 * - Amendment Knowledge: CoS-generated behavioral modifications
 *
 * Formula: effective_knowledge = base + standard + amendments
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Knowledge Computer
 * Manages the computation and caching of effective knowledge
 */
class KnowledgeComputer {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.cache = new Map(); // In-memory cache for frequently accessed knowledge
    this.cacheTimeout = config.cacheTimeout || 60000; // 1 minute default
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
  // KNOWLEDGE RETRIEVAL
  // ============================================================================

  /**
   * Get effective knowledge for an agent (with caching)
   */
  async getEffectiveKnowledge(agentRole, forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this.cache.has(agentRole)) {
      const cached = this.cache.get(agentRole);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return { data: cached.knowledge, error: null, fromCache: true };
      }
    }

    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Check if recomputation needed
    const { data: layer } = await this.supabase
      .from('monolith_knowledge_layer')
      .select('*')
      .eq('agent_role', agentRole)
      .single();

    if (!layer) {
      // Initialize knowledge layer
      await this.initializeKnowledgeLayer(agentRole);
      return this.getEffectiveKnowledge(agentRole, true);
    }

    // Check if amendments have changed since last computation
    const needsRecompute = await this.checkAmendmentsChanged(agentRole, layer);

    if (needsRecompute) {
      const result = await this.computeEffectiveKnowledge(agentRole);
      return result;
    }

    // Cache and return existing
    this.cache.set(agentRole, {
      knowledge: layer.effective_knowledge,
      timestamp: Date.now(),
    });

    return { data: layer.effective_knowledge, error: null, fromCache: false };
  }

  /**
   * Check if amendments have changed since last computation
   */
  async checkAmendmentsChanged(agentRole, layer) {
    const { data: amendments } = await this.supabase
      .from('monolith_amendments')
      .select('id')
      .eq('agent_role', agentRole)
      .eq('is_active', true);

    const currentIds = (amendments || []).map(a => a.id).sort();
    const storedIds = (layer.amendments_applied || []).sort();

    return JSON.stringify(currentIds) !== JSON.stringify(storedIds);
  }

  // ============================================================================
  // KNOWLEDGE COMPUTATION
  // ============================================================================

  /**
   * Compute effective knowledge from all layers
   */
  async computeEffectiveKnowledge(agentRole) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get current layer
    let { data: layer } = await this.supabase
      .from('monolith_knowledge_layer')
      .select('*')
      .eq('agent_role', agentRole)
      .single();

    if (!layer) {
      await this.initializeKnowledgeLayer(agentRole);
      const result = await this.supabase
        .from('monolith_knowledge_layer')
        .select('*')
        .eq('agent_role', agentRole)
        .single();
      layer = result.data;
    }

    // Get active amendments
    const { data: amendments } = await this.supabase
      .from('monolith_amendments')
      .select('id, knowledge_mutation, trigger_pattern, instruction_delta')
      .eq('agent_role', agentRole)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    // Build amendment knowledge by merging mutations
    const amendmentKnowledge = this.mergeAmendments(amendments || []);

    // Compute effective knowledge
    const effectiveKnowledge = this.mergeKnowledgeLayers(
      layer.base_knowledge || {},
      layer.standard_knowledge || {},
      amendmentKnowledge
    );

    // Store computed knowledge
    const { data: updated, error } = await this.supabase
      .from('monolith_knowledge_layer')
      .update({
        amendment_knowledge: amendmentKnowledge,
        effective_knowledge: effectiveKnowledge,
        amendments_applied: (amendments || []).map(a => a.id),
        last_computed_at: new Date().toISOString(),
        computation_version: (layer.computation_version || 0) + 1,
      })
      .eq('agent_role', agentRole)
      .select()
      .single();

    // Update cache
    if (updated) {
      this.cache.set(agentRole, {
        knowledge: effectiveKnowledge,
        timestamp: Date.now(),
      });
    }

    console.log(`[KNOWLEDGE] Computed effective knowledge for ${agentRole} (${(amendments || []).length} amendments)`);

    return { data: effectiveKnowledge, error };
  }

  /**
   * Merge multiple amendment knowledge mutations
   */
  mergeAmendments(amendments) {
    const merged = {
      instruction_deltas: [],
      category_guidance: {},
      efficiency_targets: {},
      quality_standards: {},
      skill_gaps: {},
      tool_guidance: {},
    };

    for (const amendment of amendments) {
      // Add instruction delta
      if (amendment.instruction_delta) {
        merged.instruction_deltas.push({
          trigger: amendment.trigger_pattern,
          instruction: amendment.instruction_delta,
        });
      }

      // Merge knowledge mutation
      const mutation = amendment.knowledge_mutation || {};

      if (mutation.category_guidance) {
        merged.category_guidance = {
          ...merged.category_guidance,
          ...mutation.category_guidance,
        };
      }

      if (mutation.efficiency_targets) {
        merged.efficiency_targets = {
          ...merged.efficiency_targets,
          ...mutation.efficiency_targets,
        };
      }

      if (mutation.quality_standards) {
        merged.quality_standards = {
          ...merged.quality_standards,
          ...mutation.quality_standards,
        };
      }

      if (mutation.skill_gaps) {
        merged.skill_gaps = {
          ...merged.skill_gaps,
          ...mutation.skill_gaps,
        };
      }

      if (mutation.tool_guidance) {
        merged.tool_guidance = {
          ...merged.tool_guidance,
          ...mutation.tool_guidance,
        };
      }
    }

    return merged;
  }

  /**
   * Merge knowledge layers (base + standard + amendments)
   */
  mergeKnowledgeLayers(base, standard, amendments) {
    return {
      // Base knowledge (immutable persona)
      persona: base.persona || {},

      // Standard knowledge (role-specific)
      standards: standard.standards || {},
      procedures: standard.procedures || {},

      // Amendment knowledge (CoS-generated)
      amendments: {
        instruction_deltas: amendments.instruction_deltas || [],
        category_guidance: amendments.category_guidance || {},
        efficiency_targets: amendments.efficiency_targets || {},
        quality_standards: amendments.quality_standards || {},
        skill_gaps: amendments.skill_gaps || {},
        tool_guidance: amendments.tool_guidance || {},
      },

      // Metadata
      _computed_at: new Date().toISOString(),
    };
  }

  // ============================================================================
  // KNOWLEDGE LAYER MANAGEMENT
  // ============================================================================

  /**
   * Initialize knowledge layer for an agent
   */
  async initializeKnowledgeLayer(agentRole) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const baseKnowledge = this.getDefaultBaseKnowledge(agentRole);
    const standardKnowledge = this.getDefaultStandardKnowledge(agentRole);

    const { data, error } = await this.supabase
      .from('monolith_knowledge_layer')
      .upsert([{
        agent_role: agentRole,
        base_knowledge: baseKnowledge,
        standard_knowledge: standardKnowledge,
        amendment_knowledge: {},
        effective_knowledge: this.mergeKnowledgeLayers(baseKnowledge, standardKnowledge, {}),
      }], {
        onConflict: 'agent_role',
      })
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get default base knowledge for agent role
   */
  getDefaultBaseKnowledge(agentRole) {
    const rolePersonas = {
      ceo: { focus: 'strategic_direction', authority: 'executive', style: 'decisive' },
      cfo: { focus: 'financial_oversight', authority: 'financial', style: 'analytical' },
      cto: { focus: 'technology_strategy', authority: 'technical', style: 'innovative' },
      coo: { focus: 'operations', authority: 'operational', style: 'efficient' },
      cmo: { focus: 'marketing', authority: 'brand', style: 'creative' },
      chro: { focus: 'people', authority: 'hr', style: 'empathetic' },
      clo: { focus: 'legal', authority: 'compliance', style: 'precise' },
      ciso: { focus: 'security', authority: 'security', style: 'vigilant' },
      cos: { focus: 'coordination', authority: 'cross_functional', style: 'adaptive' },
      cco: { focus: 'customer', authority: 'customer_success', style: 'supportive' },
      cpo: { focus: 'product', authority: 'product', style: 'user_focused' },
      cro: { focus: 'revenue', authority: 'revenue', style: 'growth_oriented' },
      devops: { focus: 'infrastructure', authority: 'platform', style: 'reliable' },
      data: { focus: 'analytics', authority: 'data', style: 'evidence_based' },
      qa: { focus: 'quality', authority: 'quality', style: 'thorough' },
    };

    return {
      persona: rolePersonas[agentRole] || { focus: 'general', authority: 'standard', style: 'professional' },
    };
  }

  /**
   * Get default standard knowledge for agent role
   */
  getDefaultStandardKnowledge(agentRole) {
    const roleStandards = {
      cfo: {
        standards: {
          accuracy_required: 0.99,
          review_threshold_cad: 100,
          escalation_required: ['new_vendor', 'annual_commit', 'budget_override'],
        },
        procedures: {
          expense_approval: 'tier_based',
          budget_tracking: 'monthly',
          reporting: 'quarterly',
        },
      },
      cto: {
        standards: {
          code_review_required: true,
          security_scan_required: true,
          documentation_required: true,
        },
        procedures: {
          architecture_review: 'for_new_systems',
          tech_debt_tracking: 'continuous',
        },
      },
      devops: {
        standards: {
          uptime_target: 0.999,
          deployment_strategy: 'rolling',
          monitoring_required: true,
        },
        procedures: {
          incident_response: 'immediate',
          backup_frequency: 'daily',
        },
      },
      // Add more role-specific standards as needed
    };

    return roleStandards[agentRole] || { standards: {}, procedures: {} };
  }

  /**
   * Update base knowledge (admin only - typically immutable)
   */
  async updateBaseKnowledge(agentRole, baseKnowledge) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_knowledge_layer')
      .update({ base_knowledge: baseKnowledge })
      .eq('agent_role', agentRole)
      .select()
      .single();

    // Trigger recomputation
    if (!error) {
      await this.computeEffectiveKnowledge(agentRole);
    }

    return { data, error };
  }

  /**
   * Update standard knowledge
   */
  async updateStandardKnowledge(agentRole, standardKnowledge) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_knowledge_layer')
      .update({ standard_knowledge: standardKnowledge })
      .eq('agent_role', agentRole)
      .select()
      .single();

    // Trigger recomputation
    if (!error) {
      await this.computeEffectiveKnowledge(agentRole);
    }

    return { data, error };
  }

  // ============================================================================
  // KNOWLEDGE QUERIES
  // ============================================================================

  /**
   * Get instruction deltas applicable to a task context
   */
  async getApplicableInstructions(agentRole, taskContext) {
    const { data: knowledge } = await this.getEffectiveKnowledge(agentRole);
    if (!knowledge || !knowledge.amendments) return [];

    const instructions = knowledge.amendments.instruction_deltas || [];
    const applicable = [];

    for (const delta of instructions) {
      if (this.matchesTrigger(delta.trigger, taskContext)) {
        applicable.push(delta.instruction);
      }
    }

    return applicable;
  }

  /**
   * Check if trigger matches task context
   */
  matchesTrigger(trigger, context) {
    if (!trigger || !context) return false;

    // Parse trigger format: "key:value"
    const [key, value] = trigger.split(':');

    if (key === 'task_category' && context.category) {
      return context.category.toLowerCase() === value.toLowerCase();
    }

    if (key === 'tool_use' && context.tools) {
      return context.tools.includes(value);
    }

    if (key === 'quality_check' && context.phase) {
      return context.phase === value;
    }

    return false;
  }

  /**
   * Get category guidance for a task
   */
  async getCategoryGuidance(agentRole, category) {
    const { data: knowledge } = await this.getEffectiveKnowledge(agentRole);
    if (!knowledge || !knowledge.amendments) return null;

    return knowledge.amendments.category_guidance?.[category] || null;
  }

  /**
   * Get tool guidance
   */
  async getToolGuidance(agentRole, tool) {
    const { data: knowledge } = await this.getEffectiveKnowledge(agentRole);
    if (!knowledge || !knowledge.amendments) return null;

    return knowledge.amendments.tool_guidance?.[tool] || null;
  }

  /**
   * Invalidate cache for an agent
   */
  invalidateCache(agentRole) {
    this.cache.delete(agentRole);
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export
export { KnowledgeComputer };
export default KnowledgeComputer;
