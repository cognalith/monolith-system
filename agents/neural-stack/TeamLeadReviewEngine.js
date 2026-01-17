/**
 * TEAM LEAD REVIEW ENGINE - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Implements Team Lead CoS (Chief of Staff) powers for Phase 6A.
 * Team Leads can review subordinate performance and generate Knowledge amendments.
 *
 * SAFETY CONSTRAINTS (HARDCODED - CANNOT BE MODIFIED):
 * - Team Leads CANNOT modify their own Knowledge/Skills
 * - Team Leads CANNOT modify Persona layer (Layer 1)
 * - Max 10 active amendments per subordinate
 * - Financial Escalation Framework bypasses team hierarchy
 *
 * ARCHITECTURE:
 * - Team Leads have limited CoS powers over their subordinates
 * - Reviews happen on daily or weekly cadence based on config
 * - Amendments only modify Knowledge layer (Layer 3)
 * - Escalations go to top-level CoS when thresholds are breached
 */

import { createClient } from '@supabase/supabase-js';
import DatabaseService from '../services/DatabaseService.js';

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} TeamLeadConfig
 * @property {string} role - 'cto', 'cmo', etc.
 * @property {string} team_id - 'tech', 'marketing', etc.
 * @property {Object} cos_powers
 * @property {string} cos_powers.review_cadence - 'daily' or 'weekly'
 * @property {boolean} cos_powers.amendment_authority
 * @property {boolean} cos_powers.skill_modification_authority
 * @property {number} cos_powers.max_amendments_per_subordinate
 * @property {string[]} subordinates - ['web_dev_lead', 'app_dev_lead', ...]
 * @property {string} knowledge_bot
 * @property {Object} escalation
 * @property {number} escalation.consecutive_failures_threshold
 * @property {string} escalation.escalate_to - 'cos' or 'ceo'
 */

/**
 * @typedef {Object} TrendResult
 * @property {'improving'|'stable'|'declining'} direction
 * @property {number} slope - Rate of change (-1 to 1)
 */

/**
 * @typedef {Object} ReviewData
 * @property {string} team_lead_role
 * @property {string} subordinate_role
 * @property {string} review_type - 'daily' or 'weekly'
 * @property {TrendResult} trend
 * @property {number} cos_score
 * @property {Object|null} amendment_generated
 * @property {boolean} escalated
 * @property {string|null} escalation_reason
 * @property {Object} metrics
 */

// ============================================================================
// HARDCODED SAFETY CONSTRAINTS
// ============================================================================

const SAFETY_CONSTRAINTS = Object.freeze({
  // Team Leads cannot modify their own Knowledge/Skills
  SELF_MODIFY_BLOCKED: true,

  // Team Leads cannot modify Persona layer
  PERSONA_MODIFY_BLOCKED: true,

  // Max active amendments per subordinate
  MAX_AMENDMENTS_PER_SUBORDINATE: 10,

  // Financial Escalation Framework bypass
  FINANCIAL_BYPASS_ENABLED: true,

  // Minimum tasks required for trend calculation
  MIN_TASKS_FOR_TREND: 5,

  // CoS score thresholds
  COS_SCORE_THRESHOLDS: Object.freeze({
    CRITICAL: 0.3,    // Below this triggers immediate escalation
    WARNING: 0.5,     // Below this generates amendment
    ACCEPTABLE: 0.7,  // Target minimum
    EXCELLENT: 0.9,   // High performance
  }),

  // Trend thresholds for amendment generation
  TREND_THRESHOLDS: Object.freeze({
    SEVERE_DECLINE: -0.3,
    MODERATE_DECLINE: -0.15,
    STABLE: 0.05,
    IMPROVEMENT: 0.15,
  }),
});

// ============================================================================
// DEFAULT TEAM LEAD CONFIGURATIONS
// ============================================================================

/**
 * Default configurations for all 6 Team Leads
 * @type {TeamLeadConfig[]}
 */
const TEAM_LEAD_CONFIGS = [
  {
    role: 'cto',
    team_id: 'tech',
    cos_powers: {
      review_cadence: 'daily',
      amendment_authority: true,
      skill_modification_authority: false,
      max_amendments_per_subordinate: 10,
    },
    subordinates: [
      'web_dev_lead',
      'app_dev_lead',
      'devops_lead',
      'qa_lead',
      'infrastructure_lead',
    ],
    knowledge_bot: 'tech_kb',
    escalation: {
      consecutive_failures_threshold: 3,
      escalate_to: 'cos',
    },
  },
  {
    role: 'cmo',
    team_id: 'marketing',
    cos_powers: {
      review_cadence: 'daily',
      amendment_authority: true,
      skill_modification_authority: false,
      max_amendments_per_subordinate: 10,
    },
    subordinates: [
      'content_lead',
      'social_media_lead',
      'seo_growth_lead',
      'brand_lead',
    ],
    knowledge_bot: 'marketing_kb',
    escalation: {
      consecutive_failures_threshold: 3,
      escalate_to: 'cos',
    },
  },
  {
    role: 'cpo',
    team_id: 'product',
    cos_powers: {
      review_cadence: 'daily',
      amendment_authority: true,
      skill_modification_authority: false,
      max_amendments_per_subordinate: 10,
    },
    subordinates: [
      'ux_research_lead',
      'product_analytics_lead',
      'feature_spec_lead',
    ],
    knowledge_bot: 'product_kb',
    escalation: {
      consecutive_failures_threshold: 3,
      escalate_to: 'cos',
    },
  },
  {
    role: 'coo',
    team_id: 'operations',
    cos_powers: {
      review_cadence: 'weekly',
      amendment_authority: true,
      skill_modification_authority: false,
      max_amendments_per_subordinate: 10,
    },
    subordinates: [
      'vendor_management_lead',
      'process_automation_lead',
    ],
    knowledge_bot: 'operations_kb',
    escalation: {
      consecutive_failures_threshold: 3,
      escalate_to: 'cos',
    },
  },
  {
    role: 'cfo',
    team_id: 'finance',
    cos_powers: {
      review_cadence: 'weekly',
      amendment_authority: true,
      skill_modification_authority: false,
      max_amendments_per_subordinate: 10,
    },
    subordinates: [
      'expense_tracking_lead',
      'revenue_analytics_lead',
    ],
    knowledge_bot: 'finance_kb',
    escalation: {
      consecutive_failures_threshold: 2, // Stricter for finance
      escalate_to: 'cos',
    },
  },
  {
    role: 'chro',
    team_id: 'people',
    cos_powers: {
      review_cadence: 'weekly',
      amendment_authority: true,
      skill_modification_authority: false,
      max_amendments_per_subordinate: 10,
    },
    subordinates: [
      'hiring_lead',
      'compliance_lead',
    ],
    knowledge_bot: 'people_kb',
    escalation: {
      consecutive_failures_threshold: 3,
      escalate_to: 'cos',
    },
  },
];

// ============================================================================
// TEAM LEAD REVIEW ENGINE CLASS
// ============================================================================

/**
 * Team Lead Review Engine
 * Manages Team Lead CoS powers for subordinate oversight
 */
class TeamLeadReviewEngine {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.db = DatabaseService;

    // Load team lead configs (can be overridden via config)
    this.teamLeadConfigs = config.teamLeadConfigs || TEAM_LEAD_CONFIGS;

    // Build lookup maps for efficiency
    this.teamLeadByRole = new Map();
    this.teamLeadByTeam = new Map();
    this.subordinateToTeamLead = new Map();

    this.initialize(config);
    this.buildLookupMaps();
  }

  initialize(config) {
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: true, persistSession: false },
      });
      this.isConnected = true;
      console.log('[TEAM-LEAD-REVIEW] Connected to Supabase');
    } else {
      console.warn('[TEAM-LEAD-REVIEW] Running in offline mode - no Supabase credentials');
    }
  }

  buildLookupMaps() {
    for (const config of this.teamLeadConfigs) {
      this.teamLeadByRole.set(config.role, config);
      this.teamLeadByTeam.set(config.team_id, config);

      for (const subordinate of config.subordinates) {
        this.subordinateToTeamLead.set(subordinate, config);
      }
    }
  }

  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ============================================================================
  // CORE REVIEW FUNCTIONS
  // ============================================================================

  /**
   * Run the daily/weekly review cycle for a Team Lead
   * @param {TeamLeadConfig} teamLead - Team Lead configuration
   * @returns {Promise<Object>} Review results for all subordinates
   */
  async runTeamLeadReviewCycle(teamLead) {
    if (!this.isAvailable()) {
      return {
        error: 'Database unavailable',
        reviews: [],
      };
    }

    console.log(`[TEAM-LEAD-REVIEW] Starting ${teamLead.cos_powers.review_cadence} review for ${teamLead.role}`);

    const reviews = [];
    const subordinates = await this.getTeamSubordinates(teamLead.team_id);

    for (const subordinateRole of subordinates) {
      try {
        // Safety check: Team Lead cannot review themselves
        if (subordinateRole === teamLead.role) {
          console.warn(`[TEAM-LEAD-REVIEW] BLOCKED: ${teamLead.role} cannot review self`);
          continue;
        }

        // Get task history for subordinate
        const taskHistory = await this.getSubordinateTaskHistory(subordinateRole, 30);

        if (taskHistory.length < SAFETY_CONSTRAINTS.MIN_TASKS_FOR_TREND) {
          console.log(`[TEAM-LEAD-REVIEW] Insufficient data for ${subordinateRole} (${taskHistory.length} tasks)`);
          reviews.push({
            subordinate_role: subordinateRole,
            status: 'insufficient_data',
            tasks_found: taskHistory.length,
            min_required: SAFETY_CONSTRAINTS.MIN_TASKS_FOR_TREND,
          });
          continue;
        }

        // Calculate trend
        const trend = calculateTrend(taskHistory);

        // Calculate CoS score
        const latestTask = taskHistory[0];
        const cosScore = calculateCosScore(latestTask);

        // Determine if amendment or escalation is needed
        let amendmentGenerated = null;
        let escalated = false;
        let escalationReason = null;

        // Check for consecutive failures that require escalation
        const consecutiveFailures = this.countConsecutiveFailures(taskHistory);

        if (consecutiveFailures >= teamLead.escalation.consecutive_failures_threshold) {
          escalated = true;
          escalationReason = `${consecutiveFailures} consecutive task failures`;
          await escalateToCoS(
            teamLead.role,
            subordinateRole,
            escalationReason
          );
        } else if (cosScore < SAFETY_CONSTRAINTS.COS_SCORE_THRESHOLDS.CRITICAL) {
          // Critical score - escalate immediately
          escalated = true;
          escalationReason = `Critical CoS score: ${(cosScore * 100).toFixed(1)}%`;
          await escalateToCoS(
            teamLead.role,
            subordinateRole,
            escalationReason
          );
        } else if (
          trend.direction === 'declining' ||
          cosScore < SAFETY_CONSTRAINTS.COS_SCORE_THRESHOLDS.WARNING
        ) {
          // Generate amendment if Team Lead has authority
          if (teamLead.cos_powers.amendment_authority) {
            amendmentGenerated = await generateAmendment(
              subordinateRole,
              trend,
              taskHistory
            );
          }
        }

        // Log the review
        const reviewData = {
          team_lead_role: teamLead.role,
          subordinate_role: subordinateRole,
          review_type: teamLead.cos_powers.review_cadence,
          trend,
          cos_score: cosScore,
          amendment_generated: amendmentGenerated,
          escalated,
          escalation_reason: escalationReason,
          metrics: {
            tasks_reviewed: taskHistory.length,
            consecutive_failures: consecutiveFailures,
          },
        };

        await logTeamLeadReview(reviewData);
        reviews.push(reviewData);

      } catch (error) {
        console.error(`[TEAM-LEAD-REVIEW] Error reviewing ${subordinateRole}:`, error.message);
        reviews.push({
          subordinate_role: subordinateRole,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log(`[TEAM-LEAD-REVIEW] Completed review for ${teamLead.role}: ${reviews.length} subordinates reviewed`);

    return {
      team_lead: teamLead.role,
      team_id: teamLead.team_id,
      review_type: teamLead.cos_powers.review_cadence,
      timestamp: new Date().toISOString(),
      reviews,
    };
  }

  /**
   * Get subordinates for a team
   * @param {string} teamId - Team identifier
   * @returns {Promise<string[]>} List of subordinate roles
   */
  async getTeamSubordinates(teamId) {
    const teamLead = this.teamLeadByTeam.get(teamId);
    if (!teamLead) {
      console.warn(`[TEAM-LEAD-REVIEW] Unknown team: ${teamId}`);
      return [];
    }
    return teamLead.subordinates;
  }

  /**
   * Get task history for a subordinate
   * @param {string} subordinateRole - Subordinate role ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object[]>} Task history
   */
  async getSubordinateTaskHistory(subordinateRole, days = 30) {
    if (!this.isAvailable()) {
      return [];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', subordinateRole)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error(`[TEAM-LEAD-REVIEW] Error fetching task history:`, error.message);
      return [];
    }

    return data || [];
  }

  /**
   * Count consecutive failures in task history
   * @param {Object[]} taskHistory - Task history (newest first)
   * @returns {number} Number of consecutive failures
   */
  countConsecutiveFailures(taskHistory) {
    let count = 0;
    for (const task of taskHistory) {
      if (task.status === 'failed' || task.status === 'rejected') {
        count++;
      } else if (task.status === 'completed' || task.status === 'success') {
        break; // Stop counting at first success
      }
    }
    return count;
  }

  /**
   * Get Team Lead config by role
   * @param {string} role - Team Lead role
   * @returns {TeamLeadConfig|null}
   */
  getTeamLeadConfig(role) {
    return this.teamLeadByRole.get(role) || null;
  }

  /**
   * Get Team Lead for a subordinate
   * @param {string} subordinateRole - Subordinate role
   * @returns {TeamLeadConfig|null}
   */
  getTeamLeadForSubordinate(subordinateRole) {
    return this.subordinateToTeamLead.get(subordinateRole) || null;
  }

  /**
   * Check if a role is a Team Lead
   * @param {string} role - Role to check
   * @returns {boolean}
   */
  isTeamLead(role) {
    return this.teamLeadByRole.has(role);
  }

  /**
   * Get all Team Lead configs
   * @returns {TeamLeadConfig[]}
   */
  getAllTeamLeadConfigs() {
    return this.teamLeadConfigs;
  }

  /**
   * Get safety constraints (for transparency)
   * @returns {Object}
   */
  getSafetyConstraints() {
    return {
      ...SAFETY_CONSTRAINTS,
      note: 'These constraints are HARDCODED and cannot be modified',
    };
  }

  /**
   * Run review cycles for all Team Leads
   * @returns {Promise<Object>} Results for all teams
   */
  async runAllTeamReviews() {
    const results = {};

    for (const teamLead of this.teamLeadConfigs) {
      results[teamLead.team_id] = await this.runTeamLeadReviewCycle(teamLead);
    }

    return results;
  }
}

// ============================================================================
// STANDALONE FUNCTIONS (also exported individually)
// ============================================================================

/**
 * Calculate trend from task history
 * @param {Object[]} taskHistory - Task history (newest first)
 * @returns {TrendResult} Trend direction and slope
 */
function calculateTrend(taskHistory) {
  if (!taskHistory || taskHistory.length < SAFETY_CONSTRAINTS.MIN_TASKS_FOR_TREND) {
    return { direction: 'stable', slope: 0 };
  }

  // Split into recent and older halves
  const midpoint = Math.floor(taskHistory.length / 2);
  const recentTasks = taskHistory.slice(0, midpoint);
  const olderTasks = taskHistory.slice(midpoint);

  // Calculate success rates for each half
  const recentSuccessRate = calculateSuccessRate(recentTasks);
  const olderSuccessRate = calculateSuccessRate(olderTasks);

  // Calculate slope (rate of change)
  const slope = recentSuccessRate - olderSuccessRate;

  // Determine direction based on thresholds
  let direction = 'stable';
  if (slope <= SAFETY_CONSTRAINTS.TREND_THRESHOLDS.SEVERE_DECLINE) {
    direction = 'declining';
  } else if (slope <= SAFETY_CONSTRAINTS.TREND_THRESHOLDS.MODERATE_DECLINE) {
    direction = 'declining';
  } else if (slope >= SAFETY_CONSTRAINTS.TREND_THRESHOLDS.IMPROVEMENT) {
    direction = 'improving';
  }

  return { direction, slope };
}

/**
 * Calculate success rate for a set of tasks
 * @param {Object[]} tasks - Tasks to analyze
 * @returns {number} Success rate (0-1)
 */
function calculateSuccessRate(tasks) {
  if (!tasks || tasks.length === 0) return 0;

  const successStatuses = ['completed', 'success', 'approved'];
  const successCount = tasks.filter(t => successStatuses.includes(t.status)).length;

  return successCount / tasks.length;
}

/**
 * Calculate CoS score for a task
 * @param {Object} task - Task to score
 * @returns {number} CoS score (0-1)
 */
function calculateCosScore(task) {
  if (!task) return 0;

  let score = 0;
  let weights = 0;

  // Success/completion factor (40% weight)
  const successStatuses = ['completed', 'success', 'approved'];
  if (successStatuses.includes(task.status)) {
    score += 0.4;
  } else if (task.status === 'in_progress') {
    score += 0.2;
  }
  weights += 0.4;

  // Quality score factor (30% weight)
  if (task.quality_score !== undefined && task.quality_score !== null) {
    score += 0.3 * (task.quality_score / 100);
  } else if (successStatuses.includes(task.status)) {
    score += 0.3 * 0.7; // Default to 70% quality for completed tasks
  }
  weights += 0.3;

  // On-time factor (20% weight)
  if (task.due_date) {
    const dueDate = new Date(task.due_date);
    const completedDate = task.completed_at ? new Date(task.completed_at) : new Date();
    if (completedDate <= dueDate) {
      score += 0.2;
    } else {
      // Partial credit for late but completed
      const daysLate = (completedDate - dueDate) / (1000 * 60 * 60 * 24);
      score += 0.2 * Math.max(0, 1 - (daysLate / 7)); // Lose all credit after 7 days late
    }
  } else {
    score += 0.2 * 0.5; // Default 50% if no due date
  }
  weights += 0.2;

  // Retry count factor (10% weight) - fewer retries is better
  const retryCount = task.retry_count || 0;
  score += 0.1 * Math.max(0, 1 - (retryCount / 5)); // Lose all credit at 5+ retries
  weights += 0.1;

  return Math.min(1, Math.max(0, score));
}

/**
 * Generate a Knowledge amendment for a subordinate
 * @param {string} subordinateRole - Subordinate role
 * @param {TrendResult} trend - Calculated trend
 * @param {Object[]} taskHistory - Task history
 * @returns {Promise<Object|null>} Generated amendment or null
 */
async function generateAmendment(subordinateRole, trend, taskHistory) {
  // SAFETY: Cannot generate amendments for self (this is checked at caller level)

  // Analyze common failure patterns
  const failedTasks = taskHistory.filter(t =>
    t.status === 'failed' || t.status === 'rejected'
  );

  if (failedTasks.length === 0 && trend.direction !== 'declining') {
    return null; // No amendment needed
  }

  // Find common failure categories
  const categoryFailures = {};
  for (const task of failedTasks) {
    const category = task.metadata?.category || task.category || 'general';
    categoryFailures[category] = (categoryFailures[category] || 0) + 1;
  }

  // Find the most problematic category
  let primaryCategory = 'general';
  let maxFailures = 0;
  for (const [category, count] of Object.entries(categoryFailures)) {
    if (count > maxFailures) {
      maxFailures = count;
      primaryCategory = category;
    }
  }

  // Generate amendment
  const amendment = {
    agent_role: subordinateRole,
    amendment_type: trend.slope < SAFETY_CONSTRAINTS.TREND_THRESHOLDS.SEVERE_DECLINE
      ? 'performance_critical'
      : 'performance_improvement',
    trigger_pattern: `task_category:${primaryCategory}`,
    instruction_delta: generateInstructionDelta(trend, primaryCategory, failedTasks),
    knowledge_mutation: {
      performance_guidance: {
        [primaryCategory]: {
          trend_direction: trend.direction,
          trend_slope: trend.slope,
          failure_count: maxFailures,
          recommended_approach: getRecommendedApproach(trend),
          generated_at: new Date().toISOString(),
          generated_by: 'team_lead_review',
        },
      },
    },
    source: 'team_lead_review',
    auto_approved: false, // Team Lead amendments require CoS approval
    evaluation_status: 'pending',
  };

  // Check amendment limit for subordinate
  const activeAmendments = await countActiveAmendments(subordinateRole);
  if (activeAmendments >= SAFETY_CONSTRAINTS.MAX_AMENDMENTS_PER_SUBORDINATE) {
    console.warn(`[TEAM-LEAD-REVIEW] Amendment limit reached for ${subordinateRole} (${activeAmendments} active)`);
    return {
      ...amendment,
      blocked: true,
      block_reason: `Max amendments reached (${SAFETY_CONSTRAINTS.MAX_AMENDMENTS_PER_SUBORDINATE})`,
    };
  }

  // Save amendment to database
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: true, persistSession: false },
      });

      const { data, error } = await supabase
        .from('monolith_amendments')
        .insert([{
          agent_role: amendment.agent_role,
          amendment_type: amendment.amendment_type,
          trigger_pattern: amendment.trigger_pattern,
          instruction_delta: amendment.instruction_delta,
          knowledge_mutation: amendment.knowledge_mutation,
          source_pattern: { source: 'team_lead_review', trend },
          approval_status: 'pending', // Team Lead amendments need CoS approval
          is_active: false,
          auto_approved: false,
          evaluation_status: 'pending',
        }])
        .select()
        .single();

      if (error) {
        console.error('[TEAM-LEAD-REVIEW] Error saving amendment:', error.message);
        return { ...amendment, error: error.message };
      }

      console.log(`[TEAM-LEAD-REVIEW] Amendment generated for ${subordinateRole}: ${amendment.trigger_pattern}`);
      return { ...amendment, id: data.id, saved: true };
    }
  } catch (error) {
    console.error('[TEAM-LEAD-REVIEW] Error generating amendment:', error.message);
    return { ...amendment, error: error.message };
  }

  return amendment;
}

/**
 * Generate instruction delta based on trend and failures
 */
function generateInstructionDelta(trend, category, failedTasks) {
  const failureReasons = failedTasks
    .map(t => t.metadata?.failure_reason || t.failure_reason)
    .filter(Boolean)
    .slice(0, 3);

  if (trend.slope < SAFETY_CONSTRAINTS.TREND_THRESHOLDS.SEVERE_DECLINE) {
    return `CRITICAL: Performance declining severely in ${category} tasks. ` +
      `Recent issues: ${failureReasons.join('; ') || 'unspecified'}. ` +
      `Break tasks into smaller steps, verify each component before proceeding, ` +
      `and request assistance if uncertain.`;
  }

  if (trend.direction === 'declining') {
    return `ATTENTION: Performance declining in ${category} tasks. ` +
      `Common issues: ${failureReasons.join('; ') || 'unspecified'}. ` +
      `Apply extra verification before task completion.`;
  }

  return `IMPROVEMENT NEEDED: Focus on ${category} task quality. ` +
    `Review approach and verify deliverables against requirements.`;
}

/**
 * Get recommended approach based on trend
 */
function getRecommendedApproach(trend) {
  if (trend.slope < SAFETY_CONSTRAINTS.TREND_THRESHOLDS.SEVERE_DECLINE) {
    return 'decomposition_with_checkpoints';
  }
  if (trend.direction === 'declining') {
    return 'enhanced_verification';
  }
  return 'standard_review';
}

/**
 * Count active amendments for a subordinate
 */
async function countActiveAmendments(subordinateRole) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) return 0;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: true, persistSession: false },
    });

    const { data, error } = await supabase
      .from('monolith_amendments')
      .select('id')
      .eq('agent_role', subordinateRole)
      .eq('is_active', true);

    if (error) return 0;
    return data?.length || 0;
  } catch {
    return 0;
  }
}

/**
 * Escalate issue to top-level CoS
 * @param {string} teamLeadRole - Team Lead initiating escalation
 * @param {string} subordinateRole - Subordinate being escalated
 * @param {string} reason - Reason for escalation
 * @returns {Promise<Object>} Escalation result
 */
async function escalateToCoS(teamLeadRole, subordinateRole, reason) {
  console.log(`[TEAM-LEAD-REVIEW] ESCALATION: ${teamLeadRole} escalating ${subordinateRole} - ${reason}`);

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { error: 'Database unavailable' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: true, persistSession: false },
    });

    // Create escalation record
    const { data, error } = await supabase
      .from('escalations')
      .insert([{
        from_role: teamLeadRole,
        reason: `Team Lead escalation for ${subordinateRole}: ${reason}`,
        recommendation: `Review ${subordinateRole} performance and consider intervention`,
        priority: 'HIGH',
        status: 'pending',
        context: {
          escalation_type: 'team_lead_review',
          subordinate_role: subordinateRole,
          original_reason: reason,
        },
      }])
      .select()
      .single();

    if (error) {
      console.error('[TEAM-LEAD-REVIEW] Error creating escalation:', error.message);
      return { error: error.message };
    }

    // Also create CEO alert for visibility
    await supabase
      .from('ceo_alerts')
      .insert([{
        alert_type: 'team_lead_escalation',
        severity: 'HIGH',
        message: `${teamLeadRole} escalated ${subordinateRole}: ${reason}`,
        metrics: {
          team_lead: teamLeadRole,
          subordinate: subordinateRole,
          reason,
        },
        status: 'active',
      }]);

    return { data, escalated: true };
  } catch (error) {
    console.error('[TEAM-LEAD-REVIEW] Error escalating to CoS:', error.message);
    return { error: error.message };
  }
}

/**
 * Log Team Lead review to database
 * @param {ReviewData} reviewData - Review data to log
 * @returns {Promise<Object>} Log result
 */
async function logTeamLeadReview(reviewData) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log('[TEAM-LEAD-REVIEW] Review logged (offline):', reviewData.subordinate_role);
      return { offline: true };
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: true, persistSession: false },
    });

    const { data, error } = await supabase
      .from('team_lead_reviews')
      .insert([{
        team_lead_role: reviewData.team_lead_role,
        subordinate_role: reviewData.subordinate_role,
        review_type: reviewData.review_type,
        trend_direction: reviewData.trend.direction,
        trend_slope: reviewData.trend.slope,
        cos_score: reviewData.cos_score,
        amendment_generated: reviewData.amendment_generated !== null,
        amendment_id: reviewData.amendment_generated?.id || null,
        escalated: reviewData.escalated,
        escalation_reason: reviewData.escalation_reason,
        metrics: reviewData.metrics,
      }])
      .select()
      .single();

    if (error) {
      // Table might not exist yet - log warning but don't fail
      if (error.code === '42P01') {
        console.log('[TEAM-LEAD-REVIEW] team_lead_reviews table not found, logging to console');
        console.log('[TEAM-LEAD-REVIEW] Review:', JSON.stringify(reviewData, null, 2));
        return { tableNotFound: true };
      }
      console.error('[TEAM-LEAD-REVIEW] Error logging review:', error.message);
      return { error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('[TEAM-LEAD-REVIEW] Error logging review:', error.message);
    return { error: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export class
export { TeamLeadReviewEngine };

// Export configs
export { TEAM_LEAD_CONFIGS, SAFETY_CONSTRAINTS };

// Export standalone functions
export {
  calculateTrend,
  calculateCosScore,
  generateAmendment,
  escalateToCoS,
  logTeamLeadReview,
};

// Convenience function to get subordinates (wraps class method)
export async function getTeamSubordinates(teamId) {
  const engine = new TeamLeadReviewEngine();
  return engine.getTeamSubordinates(teamId);
}

// Convenience function to run review cycle (wraps class method)
export async function runTeamLeadReviewCycle(teamLead) {
  const engine = new TeamLeadReviewEngine();
  return engine.runTeamLeadReviewCycle(teamLead);
}

// Default export
export default TeamLeadReviewEngine;
