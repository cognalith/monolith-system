/**
 * DAILY SCHEDULER - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Schedules and runs daily Team Lead reviews at 00:00 UTC.
 * Orchestrates the Team Lead review cycle and top-level CoS review.
 *
 * KEY RESPONSIBILITIES:
 * - Run all Team Lead reviews daily
 * - Trigger top-level CoS review of Team Leads after individual reviews
 * - Support manual trigger for testing
 * - Integration with node-cron or simple interval scheduling
 */

import { createClient } from '@supabase/supabase-js';
import ChiefOfStaffAgent, { TEAM_LEADS, TEAM_LEAD_ROLES } from '../roles/cos/agent.js';
import { PatternDetector } from './PatternDetector.js';
import { AmendmentEngine } from './AmendmentEngine.js';

// Team Lead configuration for scheduling
const TEAM_LEAD_CONFIGS = Object.values(TEAM_LEADS);

// Scheduler state
let isSchedulerRunning = false;
let schedulerInterval = null;
let lastReviewTime = null;

/**
 * Initialize Supabase client
 */
function initializeSupabase(config = {}) {
  const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
  const supabaseKey = config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration required (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: true, persistSession: false },
  });
}

// ============================================================================
// TEAM LEAD REVIEW CYCLE
// ============================================================================

/**
 * Run a single Team Lead review cycle
 * Detects patterns, generates amendments if needed
 *
 * @param {Object} teamLeadConfig - Team Lead configuration from TEAM_LEADS
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Review cycle result
 */
async function runTeamLeadReviewCycle(teamLeadConfig, options = {}) {
  const { role, name, subordinates } = teamLeadConfig;
  const supabase = options.supabase || initializeSupabase(options);

  console.log(`[SCHEDULER] Starting review cycle for ${name} (${role})`);

  const cycleResult = {
    teamLead: role,
    teamLeadName: name,
    subordinates,
    startedAt: new Date().toISOString(),
    patterns: [],
    amendments: [],
    errors: [],
  };

  try {
    // Initialize pattern detector
    const patternDetector = new PatternDetector(options);

    // 1. Detect patterns for Team Lead
    const { patterns: leadPatterns, error: leadError } = await patternDetector.detectPatterns(role);

    if (leadError) {
      cycleResult.errors.push({ role, error: leadError.message });
    } else if (leadPatterns.length > 0) {
      cycleResult.patterns.push(...leadPatterns.map(p => ({ ...p, source: role })));

      // Log patterns
      for (const pattern of leadPatterns) {
        await patternDetector.logPattern(role, pattern, { role, type: 'team_lead_review' });
      }
    }

    // 2. Detect patterns for subordinates (Team Lead is evaluated based on aggregate)
    const subordinatePatterns = [];
    for (const subRole of subordinates) {
      const { patterns: subPatterns, error: subError } = await patternDetector.detectPatterns(subRole);

      if (subError) {
        cycleResult.errors.push({ role: subRole, error: subError.message });
      } else if (subPatterns.length > 0) {
        subordinatePatterns.push(...subPatterns.map(p => ({ ...p, source: subRole })));
      }
    }

    // 3. If subordinate patterns exist, this reflects on Team Lead
    if (subordinatePatterns.length > 0) {
      cycleResult.patterns.push(...subordinatePatterns);

      // Generate Team Lead advisory amendment based on subordinate patterns
      if (subordinatePatterns.length >= 2) {
        const amendmentEngine = new AmendmentEngine(options);

        const teamIssueAmendment = {
          amendment_type: 'team_oversight',
          trigger_pattern: `team_lead:${role}:subordinate_patterns`,
          instruction_delta: `Multiple subordinates showing patterns. Issues detected in: ${[...new Set(subordinatePatterns.map(p => p.source))].join(', ')}. Review team workload and provide additional guidance.`,
          knowledge_mutation: {
            team_oversight: {
              subordinate_issues: subordinatePatterns.map(p => ({
                source: p.source,
                type: p.type,
                confidence: p.confidence,
              })),
              review_date: new Date().toISOString(),
            },
          },
          source_pattern: {
            type: 'subordinate_pattern_aggregate',
            team_lead: role,
            pattern_count: subordinatePatterns.length,
          },
          pattern_confidence: Math.min(0.85, 0.5 + (subordinatePatterns.length * 0.1)),
        };

        const { data: amendment, error: amendError } = await amendmentEngine.createAmendment(
          role,
          teamIssueAmendment,
          true // Auto-approve for Team Lead oversight
        );

        if (!amendError && amendment) {
          cycleResult.amendments.push(amendment);
          console.log(`[SCHEDULER] Created team oversight amendment for ${role}`);
        }
      }
    }

    // 4. Generate amendments for Team Lead patterns (not subordinates)
    if (leadPatterns.length > 0) {
      const amendmentEngine = new AmendmentEngine(options);

      for (const pattern of leadPatterns) {
        const { error: genError, amendment } = amendmentEngine.generateAmendment(pattern);

        if (!genError && amendment) {
          const { data: createdAmendment, error: createError } = await amendmentEngine.createAmendment(
            role,
            amendment,
            true // Auto-approve for daily review
          );

          if (!createError && createdAmendment) {
            cycleResult.amendments.push(createdAmendment);
          } else if (createError) {
            cycleResult.errors.push({ role, patternType: pattern.type, error: createError.message });
          }
        }
      }
    }

    cycleResult.completedAt = new Date().toISOString();
    cycleResult.success = true;

    console.log(`[SCHEDULER] Completed review cycle for ${name}: ${cycleResult.patterns.length} patterns, ${cycleResult.amendments.length} amendments`);

  } catch (error) {
    cycleResult.success = false;
    cycleResult.error = error.message;
    cycleResult.completedAt = new Date().toISOString();
    console.error(`[SCHEDULER] Error in review cycle for ${name}: ${error.message}`);
  }

  return cycleResult;
}

// ============================================================================
// TOP-LEVEL COS REVIEW
// ============================================================================

/**
 * Run top-level CoS review of all Team Leads
 * Called after individual Team Lead reviews complete
 *
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Top-level review result
 */
async function runTopLevelCosReview(options = {}) {
  console.log('[SCHEDULER] Starting top-level CoS review of Team Leads');

  const supabase = options.supabase || initializeSupabase(options);

  const reviewResult = {
    startedAt: new Date().toISOString(),
    teamLeadReviews: [],
    crossTeamPatterns: [],
    amendments: [],
    errors: [],
  };

  try {
    // Initialize CoS Agent
    const cosAgent = new ChiefOfStaffAgent();

    // Run the daily review (uses CoS Agent's runDailyReview method)
    const dailyReview = await cosAgent.runDailyReview(supabase);

    if (dailyReview.success) {
      reviewResult.teamLeadReviews = dailyReview.teamLeadReviews || [];
      reviewResult.crossTeamPatterns = dailyReview.crossTeamPatterns || [];
      reviewResult.amendments = dailyReview.amendments || [];
    } else {
      reviewResult.errors.push({ type: 'daily_review', error: dailyReview.error });
    }

    // Log cross-team patterns if critical
    for (const pattern of reviewResult.crossTeamPatterns) {
      if (pattern.severity === 'critical') {
        // Create CEO alert for critical cross-team patterns
        await supabase
          .from('ceo_alerts')
          .insert([{
            alert_type: 'cross_team_pattern',
            severity: 'HIGH',
            message: pattern.message,
            metrics: {
              patternType: pattern.type,
              affectedTeams: pattern.affectedTeams,
              recommendedAction: pattern.recommendedAction,
            },
            status: 'active',
          }]);

        console.log(`[SCHEDULER] Created CEO alert for critical cross-team pattern: ${pattern.type}`);
      }
    }

    reviewResult.completedAt = new Date().toISOString();
    reviewResult.success = true;

    console.log(`[SCHEDULER] Completed top-level CoS review: ${reviewResult.teamLeadReviews.length} leads reviewed, ${reviewResult.crossTeamPatterns.length} cross-team patterns`);

  } catch (error) {
    reviewResult.success = false;
    reviewResult.error = error.message;
    reviewResult.completedAt = new Date().toISOString();
    console.error(`[SCHEDULER] Error in top-level CoS review: ${error.message}`);
  }

  return reviewResult;
}

// ============================================================================
// DAILY REVIEW ORCHESTRATION
// ============================================================================

/**
 * Run all Team Lead reviews daily at 00:00 UTC
 * Main entry point for scheduled daily reviews
 *
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Complete daily review results
 */
async function runDailyTeamLeadReviews(options = {}) {
  console.log('[SCHEDULER] ========================================');
  console.log('[SCHEDULER] Starting Daily Team Lead Reviews');
  console.log(`[SCHEDULER] Time: ${new Date().toISOString()}`);
  console.log('[SCHEDULER] ========================================');

  const dailyResults = {
    startedAt: new Date().toISOString(),
    teamLeadCycles: [],
    topLevelReview: null,
    summary: {
      totalTeamLeads: TEAM_LEAD_CONFIGS.length,
      successfulReviews: 0,
      failedReviews: 0,
      totalPatterns: 0,
      totalAmendments: 0,
      crossTeamPatterns: 0,
    },
  };

  const supabase = options.supabase || initializeSupabase(options);
  const sharedOptions = { ...options, supabase };

  // 1. Run individual Team Lead review cycles
  for (const teamLeadConfig of TEAM_LEAD_CONFIGS) {
    const cycleResult = await runTeamLeadReviewCycle(teamLeadConfig, sharedOptions);
    dailyResults.teamLeadCycles.push(cycleResult);

    if (cycleResult.success) {
      dailyResults.summary.successfulReviews++;
      dailyResults.summary.totalPatterns += cycleResult.patterns.length;
      dailyResults.summary.totalAmendments += cycleResult.amendments.length;
    } else {
      dailyResults.summary.failedReviews++;
    }
  }

  // 2. After all Team Lead reviews, run top-level CoS review
  dailyResults.topLevelReview = await runTopLevelCosReview(sharedOptions);

  if (dailyResults.topLevelReview.success) {
    dailyResults.summary.crossTeamPatterns = dailyResults.topLevelReview.crossTeamPatterns.length;
    dailyResults.summary.totalAmendments += dailyResults.topLevelReview.amendments.length;
  }

  dailyResults.completedAt = new Date().toISOString();
  lastReviewTime = new Date();

  // Log summary
  console.log('[SCHEDULER] ========================================');
  console.log('[SCHEDULER] Daily Review Complete');
  console.log(`[SCHEDULER] Team Leads: ${dailyResults.summary.successfulReviews}/${dailyResults.summary.totalTeamLeads} successful`);
  console.log(`[SCHEDULER] Patterns: ${dailyResults.summary.totalPatterns}`);
  console.log(`[SCHEDULER] Amendments: ${dailyResults.summary.totalAmendments}`);
  console.log(`[SCHEDULER] Cross-Team Patterns: ${dailyResults.summary.crossTeamPatterns}`);
  console.log('[SCHEDULER] ========================================');

  // Store daily review log
  try {
    await supabase
      .from('daily_review_log')
      .insert([{
        review_date: new Date().toISOString().split('T')[0],
        summary: dailyResults.summary,
        team_lead_results: dailyResults.teamLeadCycles.map(c => ({
          role: c.teamLead,
          success: c.success,
          patterns: c.patterns.length,
          amendments: c.amendments.length,
        })),
        cross_team_patterns: dailyResults.topLevelReview?.crossTeamPatterns || [],
      }]);
  } catch (logError) {
    console.warn('[SCHEDULER] Failed to log daily review results:', logError.message);
  }

  return dailyResults;
}

// ============================================================================
// SCHEDULING FUNCTIONS
// ============================================================================

/**
 * Calculate milliseconds until next 00:00 UTC
 */
function msUntilMidnightUTC() {
  const now = new Date();
  const nextMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return nextMidnight.getTime() - now.getTime();
}

/**
 * Schedule daily reviews using simple interval
 * Runs at 00:00 UTC every day
 *
 * @param {Object} options - Configuration options
 * @returns {Object} Scheduler control object
 */
function scheduleDailyReviews(options = {}) {
  if (isSchedulerRunning) {
    console.log('[SCHEDULER] Scheduler already running');
    return { status: 'already_running' };
  }

  isSchedulerRunning = true;
  console.log('[SCHEDULER] Starting daily review scheduler');

  // Calculate time until first run (next 00:00 UTC)
  const msUntilFirst = msUntilMidnightUTC();
  const hoursUntilFirst = (msUntilFirst / (1000 * 60 * 60)).toFixed(2);

  console.log(`[SCHEDULER] First review in ${hoursUntilFirst} hours (at 00:00 UTC)`);

  // Schedule first run
  const firstRunTimeout = setTimeout(async () => {
    // Run first review
    await runDailyTeamLeadReviews(options);

    // Then schedule recurring reviews every 24 hours
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    schedulerInterval = setInterval(async () => {
      await runDailyTeamLeadReviews(options);
    }, TWENTY_FOUR_HOURS);

    console.log('[SCHEDULER] Recurring daily reviews scheduled (every 24 hours)');

  }, msUntilFirst);

  return {
    status: 'scheduled',
    firstRunAt: new Date(Date.now() + msUntilFirst).toISOString(),
    stop: () => {
      clearTimeout(firstRunTimeout);
      if (schedulerInterval) {
        clearInterval(schedulerInterval);
      }
      isSchedulerRunning = false;
      console.log('[SCHEDULER] Daily reviews stopped');
    },
  };
}

/**
 * Stop the daily review scheduler
 */
function stopDailyReviews() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isSchedulerRunning = false;
  console.log('[SCHEDULER] Daily review scheduler stopped');
}

// ============================================================================
// MANUAL TRIGGERS FOR TESTING
// ============================================================================

/**
 * Manual trigger for testing a single Team Lead review
 *
 * @param {string} teamLeadRole - The Team Lead role to review (e.g., 'cto')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Review cycle result
 */
async function triggerManualReview(teamLeadRole, options = {}) {
  console.log(`[SCHEDULER] Manual review triggered for: ${teamLeadRole}`);

  // Find the Team Lead config
  const teamLeadConfig = TEAM_LEAD_CONFIGS.find(tl => tl.role === teamLeadRole);

  if (!teamLeadConfig) {
    return {
      success: false,
      error: `Unknown Team Lead role: ${teamLeadRole}. Valid roles: ${TEAM_LEAD_ROLES.join(', ')}`,
    };
  }

  return await runTeamLeadReviewCycle(teamLeadConfig, options);
}

/**
 * Manual trigger for full daily review (testing)
 *
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Full daily review results
 */
async function triggerFullDailyReview(options = {}) {
  console.log('[SCHEDULER] Manual full daily review triggered');
  return await runDailyTeamLeadReviews(options);
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    isRunning: isSchedulerRunning,
    lastReviewTime: lastReviewTime?.toISOString() || null,
    teamLeads: TEAM_LEAD_ROLES,
    teamLeadCount: TEAM_LEAD_CONFIGS.length,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Main functions
  runDailyTeamLeadReviews,
  runTeamLeadReviewCycle,
  runTopLevelCosReview,

  // Scheduling
  scheduleDailyReviews,
  stopDailyReviews,
  getSchedulerStatus,

  // Manual triggers for testing
  triggerManualReview,
  triggerFullDailyReview,

  // Configuration
  TEAM_LEAD_CONFIGS,
  TEAM_LEAD_ROLES,
};

export default {
  runDailyTeamLeadReviews,
  scheduleDailyReviews,
  stopDailyReviews,
  triggerManualReview,
  triggerFullDailyReview,
  getSchedulerStatus,
};
