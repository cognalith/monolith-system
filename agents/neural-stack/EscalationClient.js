/**
 * ESCALATION CLIENT
 * Cognalith Inc. | Monolith System - Phase 5B
 *
 * Authorization escalation framework for financial safety.
 * HARDCODED SAFETY - no agent can modify Financial Escalation triggers.
 * No amendment can bypass this layer.
 */

import { createClient } from '@supabase/supabase-js';

// Table names
const TABLES = {
  escalationLog: 'monolith_escalation_log',
  agentConfig: 'monolith_agent_config',
  monthlySpendView: 'monolith_monthly_escalation_spend',
};

// HARDCODED Financial Escalation Triggers - NOT CONFIGURABLE
const FINANCIAL_TRIGGERS = {
  URL_PATTERNS: [
    /checkout/i, /billing/i, /subscribe/i, /payment/i,
    /upgrade/i, /pricing/i, /cart/i, /purchase/i,
  ],
  FORM_PATTERNS: [
    /credit.?card/i, /card.?number/i, /cvv/i, /cvc/i,
    /expir/i, /billing.?address/i, /payment.?method/i,
  ],
  ACTION_PATTERNS: [
    /purchase/i, /buy.?now/i, /start.?trial/i, /upgrade.?plan/i,
    /add.?to.?cart/i, /complete.?order/i, /confirm.?payment/i, /place.?order/i,
  ],
  CLOUD_PATTERNS: [
    /create.?instance/i, /launch/i, /provision/i, /deploy/i,
    /spin.?up/i, /start.?cluster/i,
  ],
  API_PATTERNS: [
    /generate.?api.?key/i, /create.?token/i, /oauth/i,
    /authorize/i, /connect.?account/i,
  ],
  COST_KEYWORDS: ['$', 'USD', 'CAD', '/month', '/year', '/mo', '/yr', 'billed', 'invoice', 'per seat', 'per user'],
};

/**
 * Escalation Client
 * Manages authorization escalation for financial/strategic decisions
 */
class EscalationClient {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.config = config;
    this.initialize();
  }

  initialize() {
    const supabaseUrl = this.config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = this.config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: true, persistSession: false },
      });
      this.isConnected = true;
      console.log('[ESCALATION] Connected to Supabase');
    } else {
      console.warn('[ESCALATION] No Supabase credentials found');
    }
  }

  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ============================================================================
  // TRIGGER DETECTION (HARDCODED - CANNOT BE MODIFIED BY AGENTS)
  // ============================================================================

  /**
   * Check if URL contains financial trigger patterns
   */
  checkUrlTriggers(url) {
    if (!url) return null;
    for (const pattern of FINANCIAL_TRIGGERS.URL_PATTERNS) {
      if (pattern.test(url)) {
        return { type: 'url', pattern: pattern.toString() };
      }
    }
    return null;
  }

  /**
   * Check if text contains financial trigger patterns
   */
  checkTextTriggers(text) {
    if (!text) return null;

    // Check form patterns
    for (const pattern of FINANCIAL_TRIGGERS.FORM_PATTERNS) {
      if (pattern.test(text)) {
        return { type: 'form', pattern: pattern.toString() };
      }
    }

    // Check action patterns
    for (const pattern of FINANCIAL_TRIGGERS.ACTION_PATTERNS) {
      if (pattern.test(text)) {
        return { type: 'action', pattern: pattern.toString() };
      }
    }

    // Check cloud patterns
    for (const pattern of FINANCIAL_TRIGGERS.CLOUD_PATTERNS) {
      if (pattern.test(text)) {
        return { type: 'cloud', pattern: pattern.toString() };
      }
    }

    // Check API patterns
    for (const pattern of FINANCIAL_TRIGGERS.API_PATTERNS) {
      if (pattern.test(text)) {
        return { type: 'api', pattern: pattern.toString() };
      }
    }

    // Check cost keywords
    for (const keyword of FINANCIAL_TRIGGERS.COST_KEYWORDS) {
      if (text.includes(keyword)) {
        return { type: 'cost', pattern: keyword };
      }
    }

    return null;
  }

  /**
   * Determine escalation tier based on context
   */
  determineTier(triggerType, costEstimate = null, isNewVendor = false, isAnnualCommit = false) {
    // TIER_3_STRATEGIC: >$100, annual commits, new vendors
    if ((costEstimate && costEstimate > 100) || isAnnualCommit || isNewVendor) {
      return 'TIER_3_STRATEGIC';
    }

    // TIER_2_FINANCIAL: any payment/subscription
    if (['payment_form', 'subscription', 'cloud_provision'].includes(triggerType)) {
      return 'TIER_2_FINANCIAL';
    }

    // TIER_1_SENSITIVE: OAuth, API keys that might have billing
    if (['oauth_new_service', 'api_key_billing'].includes(triggerType)) {
      return 'TIER_1_SENSITIVE';
    }

    // TIER_0_ROUTINE: everything else
    return 'TIER_0_ROUTINE';
  }

  /**
   * Check if escalation is required for a given action
   * Returns { required: boolean, tier: string, trigger: object } or null
   */
  checkEscalationRequired(context) {
    const { url, text, actionType, costEstimate, vendor, isAnnualCommit } = context;

    // Check URL triggers
    const urlTrigger = this.checkUrlTriggers(url);
    if (urlTrigger) {
      const tier = this.determineTier('payment_form', costEstimate, !vendor, isAnnualCommit);
      return {
        required: tier !== 'TIER_0_ROUTINE',
        tier,
        trigger: { type: 'payment_form', ...urlTrigger, url },
      };
    }

    // Check text triggers
    const textTrigger = this.checkTextTriggers(text);
    if (textTrigger) {
      const triggerType = textTrigger.type === 'cloud' ? 'cloud_provision' :
                         textTrigger.type === 'api' ? 'api_key_billing' :
                         'payment_form';
      const tier = this.determineTier(triggerType, costEstimate, !vendor, isAnnualCommit);
      return {
        required: tier !== 'TIER_0_ROUTINE',
        tier,
        trigger: { type: triggerType, ...textTrigger },
      };
    }

    return { required: false, tier: 'TIER_0_ROUTINE', trigger: null };
  }

  // ============================================================================
  // ESCALATION LOG OPERATIONS
  // ============================================================================

  /**
   * Create escalation request (MonA prepares, waits for Frank)
   */
  async createEscalation(request) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.escalationLog)
      .insert([{
        task_id: request.task_id,
        agent_role: request.agent_role,
        escalation_tier: request.tier,
        trigger_type: request.trigger.type,
        trigger_url: request.trigger.url,
        trigger_pattern: request.trigger.pattern_matched,
        screenshot_path: request.trigger.screenshot_path,
        action_requested: request.request.action,
        vendor: request.request.vendor,
        cost_estimate_cad: request.request.cost_estimate,
        cost_frequency: request.request.cost_frequency,
        mona_recommendation: request.mona_recommendation.reasoning,
        mona_should_proceed: request.mona_recommendation.should_proceed,
        mona_alternatives: request.mona_recommendation.alternatives,
      }])
      .select()
      .single();

    if (error) {
      console.error('[ESCALATION] createEscalation error:', error.message);
    } else {
      console.log(`[ESCALATION] Created ${request.tier} escalation: ${request.request.action}`);
    }

    return { data, error };
  }

  /**
   * Record Frank's decision
   */
  async recordFrankDecision(escalationId, decision) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.escalationLog)
      .update({
        frank_decision: decision.decision,
        frank_notes: decision.notes,
        frank_modified_action: decision.modified_action,
        frank_resume_instructions: decision.resume_instructions,
        frank_decided_at: new Date().toISOString(),
      })
      .eq('id', escalationId)
      .select()
      .single();

    if (error) {
      console.error('[ESCALATION] recordFrankDecision error:', error.message);
    } else {
      console.log(`[ESCALATION] Frank decision recorded: ${decision.decision}`);
    }

    return { data, error };
  }

  /**
   * Record escalation outcome
   */
  async recordOutcome(escalationId, outcome, notes = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.escalationLog)
      .update({
        outcome,
        outcome_notes: notes,
        completed_at: new Date().toISOString(),
      })
      .eq('id', escalationId)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get pending escalations (waiting for Frank)
   */
  async getPendingEscalations() {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.escalationLog)
      .select('*')
      .is('frank_decided_at', null)
      .order('mona_prepared_at', { ascending: true });

    return { data: data || [], error };
  }

  /**
   * Get escalation history
   */
  async getEscalationHistory(limit = 50, tierFilter = null) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from(TABLES.escalationLog)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tierFilter) {
      query = query.eq('escalation_tier', tierFilter);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  }

  /**
   * Get monthly spend summary
   */
  async getMonthlySpend() {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.monthlySpendView)
      .select('*')
      .limit(12);

    return { data: data || [], error };
  }

  // ============================================================================
  // AGENT CONFIG OPERATIONS
  // ============================================================================

  /**
   * Get agent config
   */
  async getAgentConfig(agentRole) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.agentConfig)
      .select('*')
      .eq('agent_role', agentRole)
      .single();

    return { data, error };
  }

  /**
   * Update agent config
   */
  async updateAgentConfig(agentRole, updates) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.agentConfig)
      .update(updates)
      .eq('agent_role', agentRole)
      .select()
      .single();

    if (error) {
      console.error('[ESCALATION] updateAgentConfig error:', error.message);
    }

    return { data, error };
  }

  /**
   * Get all agent configs
   */
  async getAllAgentConfigs() {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.agentConfig)
      .select('*')
      .order('agent_role', { ascending: true });

    return { data: data || [], error };
  }

  /**
   * Increment token usage for an agent
   */
  async incrementTokenUsage(agentRole, tokensUsed) {
    const { data: config } = await this.getAgentConfig(agentRole);
    if (!config) return { data: null, error: { message: 'Agent config not found' } };

    const newTotal = (config.tokens_used_this_month || 0) + tokensUsed;

    return this.updateAgentConfig(agentRole, {
      tokens_used_this_month: newTotal,
    });
  }

  // ============================================================================
  // PLAYWRIGHT INTEGRATION HELPER
  // ============================================================================

  /**
   * Format escalation for console output to Frank
   */
  formatEscalationAlert(request, screenshotPath = null) {
    const costLine = request.request.cost_estimate
      ? `Cost: $${request.request.cost_estimate} CAD ${request.request.cost_frequency || ''}`
      : '';
    const vendorLine = request.request.vendor ? `Vendor: ${request.request.vendor}` : '';

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 ESCALATION REQUIRED — ${request.tier}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: ${request.agent_role}
Action: ${request.request.action}
${costLine}
${vendorLine}

MonA Recommendation: ${request.mona_recommendation.should_proceed ? '✅ Proceed' : '⚠️ Reconsider'}
Reasoning: ${request.mona_recommendation.reasoning}
${request.mona_recommendation.alternatives?.length ? `Alternatives: ${request.mona_recommendation.alternatives.join(', ')}` : ''}

${request.trigger.url ? `Current URL: ${request.trigger.url}` : ''}
${screenshotPath ? `Screenshot: ${screenshotPath}` : ''}

Ready for your authentication, Frank.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }
}

// Export singleton and class
const escalationClient = new EscalationClient();

export { EscalationClient, escalationClient, TABLES, FINANCIAL_TRIGGERS };
export default escalationClient;
