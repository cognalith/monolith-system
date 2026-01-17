/**
 * APPROVAL WORKFLOW - Phase 5C
 * Cognalith Inc. | Monolith System
 *
 * CEO Approval Gate for amendments.
 *
 * This is a TEMPORARY safety measure until trust is established.
 * Over time, as the system proves reliable, approval requirements
 * may be relaxed for certain amendment types.
 *
 * Current approval requirements:
 * - ALL amendments require CEO (Frank) approval
 * - Auto-approval can be enabled for proven low-risk patterns
 */

import { createClient } from '@supabase/supabase-js';

// Approval tiers (for future relaxation)
const APPROVAL_TIERS = {
  ALWAYS_REQUIRED: 'always_required',      // Always needs CEO approval
  AUTO_AFTER_TRUST: 'auto_after_trust',    // Can auto-approve after trust built
  AUTO_APPROVED: 'auto_approved',           // Can auto-approve immediately
};

// Amendment type to approval tier mapping
const AMENDMENT_APPROVAL_MAP = {
  behavioral: APPROVAL_TIERS.ALWAYS_REQUIRED,
  efficiency: APPROVAL_TIERS.AUTO_AFTER_TRUST,
  quality: APPROVAL_TIERS.AUTO_AFTER_TRUST,
  skill_gap: APPROVAL_TIERS.ALWAYS_REQUIRED,
  tooling: APPROVAL_TIERS.AUTO_AFTER_TRUST,
};

// Trust thresholds for auto-approval (future use)
const TRUST_THRESHOLDS = {
  MIN_PROVEN_AMENDMENTS: 5,      // Agent needs 5 proven amendments
  MIN_SUCCESS_RATE: 0.8,         // 80% success rate on amendments
  MIN_ACTIVE_DAYS: 30,           // System active for 30 days
};

/**
 * Approval Workflow
 * Manages CEO approval gate for amendments
 */
class ApprovalWorkflow {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.trustThresholds = { ...TRUST_THRESHOLDS, ...config.trustThresholds };

    // Current mode: 'strict' (all require approval) or 'trust' (some auto-approve)
    this.mode = config.mode || 'strict';

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
  // APPROVAL REQUIREMENTS
  // ============================================================================

  /**
   * Check if amendment requires approval
   * In strict mode (current), all amendments require approval
   */
  async requiresApproval(agentRole, amendmentType) {
    if (this.mode === 'strict') {
      return {
        required: true,
        reason: 'Strict mode: all amendments require CEO approval',
        tier: APPROVAL_TIERS.ALWAYS_REQUIRED,
      };
    }

    // Trust mode: check if auto-approval is possible
    const tier = AMENDMENT_APPROVAL_MAP[amendmentType] || APPROVAL_TIERS.ALWAYS_REQUIRED;

    if (tier === APPROVAL_TIERS.ALWAYS_REQUIRED) {
      return {
        required: true,
        reason: `Amendment type "${amendmentType}" always requires approval`,
        tier,
      };
    }

    if (tier === APPROVAL_TIERS.AUTO_APPROVED) {
      return {
        required: false,
        reason: 'Amendment type eligible for auto-approval',
        tier,
      };
    }

    // AUTO_AFTER_TRUST: check trust level
    const trust = await this.checkAgentTrust(agentRole);
    if (trust.trusted) {
      return {
        required: false,
        reason: `Agent ${agentRole} has established trust (${trust.provenAmendments} proven amendments, ${(trust.successRate * 100).toFixed(0)}% success)`,
        tier,
      };
    }

    return {
      required: true,
      reason: `Agent ${agentRole} has not established sufficient trust yet`,
      tier,
      trustProgress: trust,
    };
  }

  /**
   * Check agent's trust level based on amendment history
   */
  async checkAgentTrust(agentRole) {
    if (!this.isAvailable()) {
      return { trusted: false, error: 'Database unavailable' };
    }

    // Get agent's amendment history
    const { data: amendments } = await this.supabase
      .from('monolith_amendments')
      .select('evaluation_status')
      .eq('agent_role', agentRole)
      .not('evaluation_status', 'eq', 'pending')
      .not('evaluation_status', 'eq', 'evaluating');

    if (!amendments || amendments.length === 0) {
      return {
        trusted: false,
        provenAmendments: 0,
        successRate: 0,
        reason: 'No amendment history',
      };
    }

    const proven = amendments.filter(a => a.evaluation_status === 'proven').length;
    const total = amendments.length;
    const successRate = proven / total;

    const trusted = proven >= this.trustThresholds.MIN_PROVEN_AMENDMENTS &&
                    successRate >= this.trustThresholds.MIN_SUCCESS_RATE;

    return {
      trusted,
      provenAmendments: proven,
      totalAmendments: total,
      successRate,
      thresholds: this.trustThresholds,
    };
  }

  // ============================================================================
  // APPROVAL OPERATIONS
  // ============================================================================

  /**
   * Get pending amendments for CEO review
   */
  async getPendingApprovals() {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .select(`
        *,
        pattern_log:source_pattern
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });

    return { data: data || [], error };
  }

  /**
   * Format pending amendments for CEO review
   */
  formatPendingAmendments(amendments) {
    if (!amendments || amendments.length === 0) {
      return '\n✅ No pending amendments requiring approval.\n';
    }

    let output = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PENDING AMENDMENTS FOR APPROVAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    for (let i = 0; i < amendments.length; i++) {
      const a = amendments[i];
      const confidence = a.pattern_confidence
        ? `${(a.pattern_confidence * 100).toFixed(0)}%`
        : 'N/A';

      output += `
[${i + 1}] ${a.agent_role.toUpperCase()} - ${a.amendment_type}
    ID: ${a.id.substring(0, 8)}...
    Trigger: ${a.trigger_pattern}
    Confidence: ${confidence}

    Instruction:
    ${a.instruction_delta}

    Created: ${new Date(a.created_at).toLocaleString()}
    ─────────────────────────────────────────────────
`;
    }

    output += `
Total: ${amendments.length} pending amendment(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    return output;
  }

  /**
   * Approve amendment (CEO action)
   */
  async approve(amendmentId, approverName = 'frank', notes = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .update({
        approval_status: 'approved',
        approved_by: approverName,
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
      console.log(`[APPROVAL] Amendment approved by ${approverName}: ${data.trigger_pattern}`);
    }

    return { data, error };
  }

  /**
   * Reject amendment (CEO action)
   */
  async reject(amendmentId, approverName = 'frank', reason) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .update({
        approval_status: 'rejected',
        approved_by: approverName,
        approved_at: new Date().toISOString(),
        approval_notes: reason,
        is_active: false,
      })
      .eq('id', amendmentId)
      .eq('approval_status', 'pending')
      .select()
      .single();

    if (!error && data) {
      console.log(`[APPROVAL] Amendment rejected by ${approverName}: ${reason}`);
    }

    return { data, error };
  }

  /**
   * Bulk approve all pending amendments (use with caution)
   */
  async approveAll(approverName = 'frank', notes = 'Bulk approved') {
    const { data: pending } = await this.getPendingApprovals();

    if (!pending || pending.length === 0) {
      return { approved: 0, error: null };
    }

    let approved = 0;
    for (const amendment of pending) {
      const { error } = await this.approve(amendment.id, approverName, notes);
      if (!error) approved++;
    }

    return { approved, error: null };
  }

  // ============================================================================
  // APPROVAL QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Get approval queue stats
   */
  async getQueueStats() {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data: amendments } = await this.supabase
      .from('monolith_amendments')
      .select('approval_status, agent_role, created_at');

    if (!amendments) return { data: null, error: null };

    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      auto_approved: 0,
      by_agent: {},
      oldest_pending: null,
    };

    let oldestDate = null;

    for (const a of amendments) {
      stats[a.approval_status] = (stats[a.approval_status] || 0) + 1;

      if (!stats.by_agent[a.agent_role]) {
        stats.by_agent[a.agent_role] = { pending: 0, approved: 0, rejected: 0 };
      }
      stats.by_agent[a.agent_role][a.approval_status]++;

      if (a.approval_status === 'pending') {
        const date = new Date(a.created_at);
        if (!oldestDate || date < oldestDate) {
          oldestDate = date;
          stats.oldest_pending = a.created_at;
        }
      }
    }

    return { data: stats, error: null };
  }

  /**
   * Get approval history
   */
  async getApprovalHistory(limit = 20) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .select('*')
      .not('approval_status', 'eq', 'pending')
      .order('approved_at', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  // ============================================================================
  // MODE MANAGEMENT
  // ============================================================================

  /**
   * Set approval mode
   */
  setMode(mode) {
    if (!['strict', 'trust'].includes(mode)) {
      throw new Error('Invalid mode. Use "strict" or "trust".');
    }
    this.mode = mode;
    console.log(`[APPROVAL] Mode set to: ${mode}`);
  }

  /**
   * Get current mode
   */
  getMode() {
    return {
      mode: this.mode,
      description: this.mode === 'strict'
        ? 'All amendments require CEO approval'
        : 'Trusted agents can auto-approve certain amendments',
    };
  }

  /**
   * Check system readiness for trust mode
   */
  async checkTrustModeReadiness() {
    if (!this.isAvailable()) {
      return { ready: false, error: 'Database unavailable' };
    }

    // Check overall system metrics
    const { data: amendments } = await this.supabase
      .from('monolith_amendments')
      .select('evaluation_status, created_at')
      .not('evaluation_status', 'eq', 'pending')
      .not('evaluation_status', 'eq', 'evaluating');

    if (!amendments || amendments.length < this.trustThresholds.MIN_PROVEN_AMENDMENTS) {
      return {
        ready: false,
        reason: 'Insufficient amendment history',
        current: amendments?.length || 0,
        required: this.trustThresholds.MIN_PROVEN_AMENDMENTS,
      };
    }

    const proven = amendments.filter(a => a.evaluation_status === 'proven').length;
    const successRate = proven / amendments.length;

    if (successRate < this.trustThresholds.MIN_SUCCESS_RATE) {
      return {
        ready: false,
        reason: 'Success rate below threshold',
        current: successRate,
        required: this.trustThresholds.MIN_SUCCESS_RATE,
      };
    }

    // Check system age
    const oldest = amendments.reduce((min, a) => {
      const date = new Date(a.created_at);
      return date < min ? date : min;
    }, new Date());

    const daysSinceFirst = (Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceFirst < this.trustThresholds.MIN_ACTIVE_DAYS) {
      return {
        ready: false,
        reason: 'System not active long enough',
        current: Math.floor(daysSinceFirst),
        required: this.trustThresholds.MIN_ACTIVE_DAYS,
      };
    }

    return {
      ready: true,
      metrics: {
        provenAmendments: proven,
        successRate,
        activeDays: Math.floor(daysSinceFirst),
      },
    };
  }
}

// Export
export { ApprovalWorkflow, APPROVAL_TIERS, TRUST_THRESHOLDS };
export default ApprovalWorkflow;
