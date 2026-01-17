/**
 * TEAM HIERARCHY API ROUTES - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * API endpoints for Team Lead review cycles and team hierarchy management.
 * Connects to Phase 5A-5E Supabase tables and introduces Team Lead oversight.
 *
 * Team Structure:
 * - CEO -> All C-Suite (direct reports)
 * - CTO -> Engineering teams (devops, qa, data, etc.)
 * - CFO -> Finance teams
 * - COO -> Operations teams
 * - CMO -> Marketing teams
 * - CHRO -> HR teams
 * - CoS -> Cross-functional support (Knowledge Bot coordination)
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// ============================================================================
// TEAM HIERARCHY CONFIGURATION
// ============================================================================

/**
 * Team definitions mapping Team Leads to their subordinates.
 * Knowledge Bot for each team provides domain-specific assistance.
 */
const TEAM_HIERARCHY = {
  executive: {
    team_id: 'executive',
    team_name: 'Executive Team',
    team_lead_role: 'ceo',
    subordinates: ['cfo', 'coo', 'cto', 'cmo', 'chro', 'ciso', 'clo'],
    knowledge_bot: 'executive-kb',
    description: 'C-Suite executives reporting directly to CEO',
  },
  technology: {
    team_id: 'technology',
    team_name: 'Technology Team',
    team_lead_role: 'cto',
    subordinates: ['devops', 'data', 'qa', 'ciso'],
    knowledge_bot: 'tech-kb',
    description: 'Technology, infrastructure, and security teams',
  },
  operations: {
    team_id: 'operations',
    team_name: 'Operations Team',
    team_lead_role: 'coo',
    subordinates: ['cos', 'cpo', 'cco'],
    knowledge_bot: 'ops-kb',
    description: 'Operations, product, and compliance teams',
  },
  finance: {
    team_id: 'finance',
    team_name: 'Finance Team',
    team_lead_role: 'cfo',
    subordinates: ['cro'],
    knowledge_bot: 'finance-kb',
    description: 'Finance and revenue teams',
  },
  marketing: {
    team_id: 'marketing',
    team_name: 'Marketing Team',
    team_lead_role: 'cmo',
    subordinates: [],
    knowledge_bot: 'marketing-kb',
    description: 'Marketing and communications teams',
  },
  hr: {
    team_id: 'hr',
    team_name: 'Human Resources Team',
    team_lead_role: 'chro',
    subordinates: [],
    knowledge_bot: 'hr-kb',
    description: 'Human resources and talent teams',
  },
};

// Helper to get team by ID
const getTeamById = (teamId) => TEAM_HIERARCHY[teamId] || null;

// Helper to find team by role (as subordinate or lead)
const findTeamByRole = (role) => {
  for (const team of Object.values(TEAM_HIERARCHY)) {
    if (team.team_lead_role === role || team.subordinates.includes(role)) {
      return team;
    }
  }
  return null;
};

// ============================================================================
// LIST ALL TEAMS WITH HEALTH METRICS
// ============================================================================

/**
 * GET /api/neural-stack/teams
 * Returns all teams with aggregated health metrics
 */
router.get('/', async (req, res) => {
  try {
    // Get agent memory for all agents
    const { data: agents, error: agentError } = await supabase
      .from('monolith_agent_memory')
      .select('agent_role, avg_variance_percent, current_trend, tasks_since_last_review, updated_at');

    if (agentError) throw agentError;

    // Get recent amendments count per agent
    const { data: amendments, error: amendError } = await supabase
      .from('monolith_amendments')
      .select('agent_role, created_at')
      .eq('is_active', true);

    if (amendError) throw amendError;

    // Get recent team reviews
    const { data: reviews, error: reviewError } = await supabase
      .from('monolith_team_reviews')
      .select('team_id, review_date, subordinate_role, amendment_generated')
      .order('review_date', { ascending: false })
      .limit(100);

    // May not exist yet, so just log warning
    if (reviewError) console.warn('[TEAMS] team_reviews table may not exist:', reviewError.message);

    // Build agent lookup
    const agentMap = {};
    (agents || []).forEach(a => {
      agentMap[a.agent_role] = a;
    });

    // Count amendments per agent
    const amendmentCounts = {};
    (amendments || []).forEach(a => {
      amendmentCounts[a.agent_role] = (amendmentCounts[a.agent_role] || 0) + 1;
    });

    // Count recent reviews per team
    const reviewCounts = {};
    (reviews || []).forEach(r => {
      reviewCounts[r.team_id] = (reviewCounts[r.team_id] || 0) + 1;
    });

    // Build team response with health metrics
    const teams = Object.values(TEAM_HIERARCHY).map(team => {
      // Calculate team health score (average of subordinate metrics)
      const subordinateAgents = team.subordinates
        .map(role => agentMap[role])
        .filter(Boolean);

      const leadAgent = agentMap[team.team_lead_role];

      // Calculate average variance across team
      let avgVariance = 0;
      let healthyCount = 0;
      let decliningCount = 0;

      subordinateAgents.forEach(agent => {
        avgVariance += parseFloat(agent.avg_variance_percent || 0);
        if (agent.current_trend === 'DECLINING') decliningCount++;
        else if (agent.current_trend !== 'INSUFFICIENT_DATA') healthyCount++;
      });

      const subordinateCount = subordinateAgents.length || 1;
      avgVariance = avgVariance / subordinateCount;

      // Health score: 100 - (avg_variance * 2) - (declining_count * 10)
      // Capped between 0-100
      let healthScore = Math.round(100 - (avgVariance * 2) - (decliningCount * 10));
      healthScore = Math.max(0, Math.min(100, healthScore));

      // Count recent amendments in this team
      const teamAmendments = team.subordinates.reduce((sum, role) => {
        return sum + (amendmentCounts[role] || 0);
      }, 0);

      return {
        team_id: team.team_id,
        team_name: team.team_name,
        team_lead_role: team.team_lead_role,
        team_lead_name: getFullRoleName(team.team_lead_role),
        description: team.description,
        health_score: healthScore,
        subordinate_count: team.subordinates.length,
        recent_amendments: teamAmendments,
        recent_reviews: reviewCounts[team.team_id] || 0,
        lead_status: leadAgent ? {
          variance: parseFloat(leadAgent.avg_variance_percent || 0).toFixed(1),
          trend: leadAgent.current_trend,
          tasks_reviewed: leadAgent.tasks_since_last_review || 0,
        } : null,
      };
    });

    res.json({
      teams,
      total_teams: teams.length,
      hierarchy_version: '6A',
    });
  } catch (error) {
    console.error('[TEAMS] list teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET TEAM DETAIL WITH SUBORDINATES
// ============================================================================

/**
 * GET /api/neural-stack/teams/:teamId
 * Returns detailed team information including subordinate status
 */
router.get('/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = getTeamById(teamId);

    if (!team) {
      return res.status(404).json({ error: `Team '${teamId}' not found` });
    }

    // Get all subordinate agent data
    const { data: agents, error: agentError } = await supabase
      .from('monolith_agent_memory')
      .select('*')
      .in('agent_role', [...team.subordinates, team.team_lead_role]);

    if (agentError) throw agentError;

    // Get recent task history for subordinates
    const { data: tasks, error: taskError } = await supabase
      .from('monolith_task_history')
      .select('agent_role, variance_percent, cos_score, completed_at, success')
      .in('agent_role', team.subordinates)
      .order('completed_at', { ascending: false })
      .limit(100);

    if (taskError) throw taskError;

    // Get active amendments for team
    const { data: amendments, error: amendError } = await supabase
      .from('monolith_amendments')
      .select('id, agent_role, amendment_type, trigger_pattern, is_active, created_at')
      .in('agent_role', team.subordinates)
      .eq('is_active', true);

    if (amendError) throw amendError;

    // Get last review dates for each subordinate
    const { data: lastReviews, error: reviewError } = await supabase
      .from('monolith_team_reviews')
      .select('subordinate_role, review_date')
      .eq('team_id', teamId)
      .order('review_date', { ascending: false });

    // May not exist yet
    if (reviewError) console.warn('[TEAMS] team_reviews lookup warning:', reviewError.message);

    // Build agent lookup
    const agentMap = {};
    (agents || []).forEach(a => {
      agentMap[a.agent_role] = a;
    });

    // Build last review lookup
    const lastReviewMap = {};
    (lastReviews || []).forEach(r => {
      if (!lastReviewMap[r.subordinate_role]) {
        lastReviewMap[r.subordinate_role] = r.review_date;
      }
    });

    // Calculate task stats per subordinate
    const taskStats = {};
    team.subordinates.forEach(role => {
      taskStats[role] = { variances: [], scores: [], total: 0 };
    });

    (tasks || []).forEach(t => {
      if (taskStats[t.agent_role] && taskStats[t.agent_role].total < 20) {
        if (t.variance_percent !== null) {
          taskStats[t.agent_role].variances.push(parseFloat(t.variance_percent));
        }
        if (t.cos_score !== null) {
          taskStats[t.agent_role].scores.push(parseFloat(t.cos_score));
        }
        taskStats[t.agent_role].total++;
      }
    });

    // Build subordinate details
    const subordinates = team.subordinates.map(role => {
      const agent = agentMap[role];
      const stats = taskStats[role];

      // Calculate trend from recent variances
      let trend = 'stable';
      if (stats.variances.length >= 4) {
        const recent = stats.variances.slice(0, Math.floor(stats.variances.length / 2));
        const older = stats.variances.slice(Math.floor(stats.variances.length / 2));
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        if (recentAvg < olderAvg - 5) trend = 'improving';
        else if (recentAvg > olderAvg + 5) trend = 'declining';
      }

      const avgVariance = stats.variances.length > 0
        ? stats.variances.reduce((a, b) => a + b, 0) / stats.variances.length
        : 0;

      return {
        role,
        full_name: getFullRoleName(role),
        variance_percent: Math.round(avgVariance * 10) / 10,
        trend,
        current_status: agent?.current_trend || 'INSUFFICIENT_DATA',
        tasks_completed: stats.total,
        active_amendments: (amendments || []).filter(a => a.agent_role === role).length,
        last_review: lastReviewMap[role] || null,
      };
    });

    // Get team lead details
    const teamLead = agentMap[team.team_lead_role];

    res.json({
      team: {
        team_id: team.team_id,
        team_name: team.team_name,
        description: team.description,
        knowledge_bot: team.knowledge_bot,
      },
      team_lead: {
        role: team.team_lead_role,
        full_name: getFullRoleName(team.team_lead_role),
        variance_percent: teamLead ? parseFloat(teamLead.avg_variance_percent || 0).toFixed(1) : null,
        trend: teamLead?.current_trend || 'INSUFFICIENT_DATA',
        tasks_since_review: teamLead?.tasks_since_last_review || 0,
      },
      subordinates,
      knowledge_bot: {
        id: team.knowledge_bot,
        status: 'active',
        description: `Domain-specific knowledge assistant for ${team.team_name}`,
      },
    });
  } catch (error) {
    console.error('[TEAMS] get team detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET TEAM LEAD REVIEW HISTORY
// ============================================================================

/**
 * GET /api/neural-stack/teams/:teamId/reviews
 * Returns Team Lead review history for a team
 */
router.get('/:teamId/reviews', async (req, res) => {
  try {
    const { teamId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const team = getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: `Team '${teamId}' not found` });
    }

    // Get team reviews
    const { data: reviews, error, count } = await supabase
      .from('monolith_team_reviews')
      .select('*', { count: 'exact' })
      .eq('team_id', teamId)
      .order('review_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      // Table may not exist - return empty with instruction
      if (error.code === '42P01') {
        return res.json({
          reviews: [],
          total: 0,
          limit,
          offset,
          message: 'Team reviews table not yet created. Run Phase 6A migration.',
        });
      }
      throw error;
    }

    res.json({
      team_id: teamId,
      team_name: team.team_name,
      reviews: (reviews || []).map(r => ({
        id: r.id,
        review_date: r.review_date,
        subordinate_role: r.subordinate_role,
        subordinate_name: getFullRoleName(r.subordinate_role),
        trend_direction: r.trend_direction,
        variance_at_review: r.variance_at_review,
        amendment_generated: r.amendment_generated,
        amendment_id: r.amendment_id,
        escalated: r.escalated_to_cos || false,
        notes: r.review_notes,
      })),
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[TEAMS] get review history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET AMENDMENTS WITHIN TEAM
// ============================================================================

/**
 * GET /api/neural-stack/teams/:teamId/amendments
 * Returns all amendments for agents in a team
 */
router.get('/:teamId/amendments', async (req, res) => {
  try {
    const { teamId } = req.params;
    const activeOnly = req.query.active !== 'false';

    const team = getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: `Team '${teamId}' not found` });
    }

    // Build query for amendments
    let query = supabase
      .from('monolith_amendments')
      .select('*')
      .in('agent_role', team.subordinates)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: amendments, error } = await query;

    if (error) throw error;

    // Group by subordinate
    const byAgent = {};
    team.subordinates.forEach(role => {
      byAgent[role] = [];
    });

    (amendments || []).forEach(a => {
      if (byAgent[a.agent_role]) {
        byAgent[a.agent_role].push({
          id: a.id,
          amendment_id: a.amendment_id,
          type: a.amendment_type,
          trigger_pattern: a.trigger_pattern,
          target_area: a.target_area,
          content: a.content,
          is_active: a.is_active,
          evaluation_status: a.evaluation_status,
          created_at: a.created_at,
        });
      }
    });

    res.json({
      team_id: teamId,
      team_name: team.team_name,
      amendments: amendments || [],
      by_agent: byAgent,
      total: (amendments || []).length,
      active_only: activeOnly,
    });
  } catch (error) {
    console.error('[TEAMS] get team amendments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TRIGGER MANUAL TEAM LEAD REVIEW
// ============================================================================

/**
 * POST /api/neural-stack/teams/:teamId/review
 * Triggers a manual Team Lead review cycle
 */
router.post('/:teamId/review', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { subordinate_role } = req.body;

    const team = getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: `Team '${teamId}' not found` });
    }

    // Determine which subordinates to review
    const rolesToReview = subordinate_role
      ? [subordinate_role]
      : team.subordinates;

    // Validate subordinate_role if provided
    if (subordinate_role && !team.subordinates.includes(subordinate_role)) {
      return res.status(400).json({
        error: `Role '${subordinate_role}' is not a subordinate of team '${teamId}'`,
      });
    }

    const reviewResults = [];
    const amendmentsGenerated = [];

    for (const role of rolesToReview) {
      // Get agent data
      const { data: agent, error: agentError } = await supabase
        .from('monolith_agent_memory')
        .select('*')
        .eq('agent_role', role)
        .single();

      if (agentError) {
        console.warn(`[TEAMS] Could not fetch agent ${role}:`, agentError.message);
        continue;
      }

      // Get recent task performance
      const { data: tasks, error: taskError } = await supabase
        .from('monolith_task_history')
        .select('variance_percent, cos_score, success')
        .eq('agent_role', role)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (taskError) {
        console.warn(`[TEAMS] Could not fetch tasks for ${role}:`, taskError.message);
      }

      // Calculate trend
      const variances = (tasks || [])
        .map(t => parseFloat(t.variance_percent))
        .filter(v => !isNaN(v));

      let trendDirection = 'stable';
      let needsAmendment = false;

      if (variances.length >= 4) {
        const recent = variances.slice(0, Math.floor(variances.length / 2));
        const older = variances.slice(Math.floor(variances.length / 2));
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

        if (recentAvg < olderAvg - 5) {
          trendDirection = 'improving';
        } else if (recentAvg > olderAvg + 5) {
          trendDirection = 'declining';
          needsAmendment = recentAvg > 15; // Flag for amendment if variance > 15%
        }
      }

      const avgVariance = variances.length > 0
        ? variances.reduce((a, b) => a + b, 0) / variances.length
        : 0;

      // Create review record
      const reviewRecord = {
        team_id: teamId,
        team_lead_role: team.team_lead_role,
        subordinate_role: role,
        review_date: new Date().toISOString(),
        trend_direction: trendDirection,
        variance_at_review: avgVariance,
        tasks_analyzed: variances.length,
        amendment_generated: false,
        escalated_to_cos: false,
        review_notes: `Manual review triggered. Trend: ${trendDirection}, Avg variance: ${avgVariance.toFixed(1)}%`,
      };

      // Insert review record (table may not exist)
      const { data: insertedReview, error: insertError } = await supabase
        .from('monolith_team_reviews')
        .insert([reviewRecord])
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '42P01') {
          // Table doesn't exist - just log the review result
          console.warn('[TEAMS] monolith_team_reviews table not found, skipping insert');
        } else {
          console.warn(`[TEAMS] Could not insert review for ${role}:`, insertError.message);
        }
      }

      // If declining trend with high variance, escalate to CoS for amendment
      let amendmentId = null;
      if (needsAmendment) {
        // Create amendment suggestion for CoS to review
        const amendmentData = {
          amendment_id: `team-${teamId}-${role}-${Date.now()}`,
          agent_role: role,
          trigger_reason: `Team Lead review: declining trend with ${avgVariance.toFixed(1)}% variance`,
          trigger_pattern: 'team_lead_intervention',
          amendment_type: 'append',
          target_area: 'time_estimation',
          content: `[Team Lead Review] Consider reviewing time estimation patterns. Recent variance: ${avgVariance.toFixed(1)}%`,
          performance_before: {
            avg_variance: avgVariance,
            trend: trendDirection,
            tasks_analyzed: variances.length,
          },
          evaluation_status: 'pending',
          approval_status: 'pending',
          is_active: false,
          approval_required: true,
        };

        const { data: amendment, error: amendErr } = await supabase
          .from('monolith_amendments')
          .insert([amendmentData])
          .select()
          .single();

        if (amendErr) {
          console.warn(`[TEAMS] Could not create amendment for ${role}:`, amendErr.message);
        } else {
          amendmentId = amendment.id;
          amendmentsGenerated.push({
            role,
            amendment_id: amendment.id,
            reason: amendmentData.trigger_reason,
          });

          // Update review record with amendment info if it was created
          if (insertedReview) {
            await supabase
              .from('monolith_team_reviews')
              .update({
                amendment_generated: true,
                amendment_id: amendment.id,
                escalated_to_cos: true,
              })
              .eq('id', insertedReview.id);
          }
        }
      }

      reviewResults.push({
        role,
        full_name: getFullRoleName(role),
        trend_direction: trendDirection,
        avg_variance: Math.round(avgVariance * 10) / 10,
        tasks_analyzed: variances.length,
        amendment_generated: needsAmendment && amendmentId !== null,
        amendment_id: amendmentId,
      });
    }

    res.json({
      success: true,
      team_id: teamId,
      team_name: team.team_name,
      reviewed_by: team.team_lead_role,
      reviews_completed: reviewResults.length,
      amendments_generated: amendmentsGenerated.length,
      results: reviewResults,
      amendments: amendmentsGenerated,
    });
  } catch (error) {
    console.error('[TEAMS] trigger review error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get full role name from role ID
 */
function getFullRoleName(roleId) {
  const roleNames = {
    ceo: 'Chief Executive Officer',
    cfo: 'Chief Financial Officer',
    coo: 'Chief Operating Officer',
    cto: 'Chief Technology Officer',
    cmo: 'Chief Marketing Officer',
    chro: 'Chief Human Resources Officer',
    ciso: 'Chief Information Security Officer',
    clo: 'General Counsel',
    cos: 'Chief of Staff',
    cco: 'Chief Compliance Officer',
    cpo: 'Chief Product Officer',
    cro: 'Chief Revenue Officer',
    devops: 'DevOps & Infrastructure Lead',
    data: 'Data Engineer',
    qa: 'QA Lead',
  };
  return roleNames[roleId] || roleId.toUpperCase();
}

export default router;
