/**
 * NEURAL STACK API ROUTES - Phase 5E
 * Cognalith Inc. | Monolith System
 *
 * API endpoints for Neural Stack dashboard components.
 * Connects to Phase 5A-5C Supabase tables.
 *
 * PHASE 5E: Added autonomy endpoints
 * - Exception escalations (CEO-only involvement)
 * - CoS health monitoring
 * - Baked amendments
 * - Autonomy statistics
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
// AGENT HEALTH OVERVIEW
// ============================================================================

/**
 * GET /api/neural-stack/agent-health
 * Returns health metrics for all 15 agents
 */
router.get('/agent-health', async (req, res) => {
  try {
    // Get agent memory with recent performance
    const { data: agents, error: agentError } = await supabase
      .from('monolith_agent_memory')
      .select('*')
      .order('agent_role', { ascending: true });

    if (agentError) throw agentError;

    // Get active amendment counts per agent
    const { data: amendments, error: amendError } = await supabase
      .from('monolith_amendments')
      .select('agent_role')
      .eq('is_active', true);

    if (amendError) throw amendError;

    // Count amendments per agent
    const amendmentCounts = {};
    (amendments || []).forEach(a => {
      amendmentCounts[a.agent_role] = (amendmentCounts[a.agent_role] || 0) + 1;
    });

    // Get recent task stats per agent (last 20 tasks)
    const { data: recentTasks, error: taskError } = await supabase
      .from('monolith_task_history')
      .select('agent_role, variance_percent, cos_score, success')
      .order('completed_at', { ascending: false })
      .limit(300); // ~20 per agent

    if (taskError) throw taskError;

    // Aggregate task stats per agent
    const taskStats = {};
    (recentTasks || []).forEach(t => {
      if (!taskStats[t.agent_role]) {
        taskStats[t.agent_role] = { variances: [], scores: [], successes: 0, total: 0 };
      }
      const stats = taskStats[t.agent_role];
      if (stats.total < 20) { // Limit to 20 per agent
        if (t.variance_percent !== null) stats.variances.push(parseFloat(t.variance_percent));
        if (t.cos_score !== null) stats.scores.push(parseFloat(t.cos_score));
        if (t.success) stats.successes++;
        stats.total++;
      }
    });

    // Build response with health status
    const agentHealth = (agents || []).map(agent => {
      const stats = taskStats[agent.agent_role] || { variances: [], scores: [], successes: 0, total: 0 };
      const avgVariance = stats.variances.length > 0
        ? stats.variances.reduce((a, b) => a + b, 0) / stats.variances.length
        : 0;
      const avgScore = stats.scores.length > 0
        ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
        : 0;
      const successRate = stats.total > 0 ? stats.successes / stats.total : 1;

      // Determine trend from variance history
      let trend = 'stable';
      if (stats.variances.length >= 4) {
        const recent = stats.variances.slice(0, Math.floor(stats.variances.length / 2));
        const older = stats.variances.slice(Math.floor(stats.variances.length / 2));
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        if (recentAvg < olderAvg - 5) trend = 'improving';
        else if (recentAvg > olderAvg + 5) trend = 'declining';
      }

      // Determine health status
      let status = 'healthy';
      if (avgVariance > 25 || successRate < 0.7) status = 'declining';
      else if (avgVariance > 10 || successRate < 0.85) status = 'attention';

      return {
        agent_role: agent.agent_role,
        avg_variance_percent: Math.round(avgVariance * 10) / 10,
        avg_cos_score: Math.round(avgScore * 100) / 100,
        success_rate: Math.round(successRate * 100),
        trend,
        status,
        active_amendments: amendmentCounts[agent.agent_role] || 0,
        tasks_completed: agent.tasks_completed || 0,
        last_active: agent.updated_at,
      };
    });

    res.json({ agents: agentHealth });
  } catch (error) {
    console.error('[NEURAL-STACK] agent-health error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// VARIANCE TREND DATA
// ============================================================================

/**
 * GET /api/neural-stack/variance-trend/:agent
 * Returns task history for variance trend chart
 */
router.get('/variance-trend/:agent', async (req, res) => {
  try {
    const { agent } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Get task history with variance data
    const { data: tasks, error: taskError } = await supabase
      .from('monolith_task_history')
      .select('task_id, title, variance_percent, cos_score, completed_at, success')
      .eq('agent_role', agent)
      .not('variance_percent', 'is', null)
      .order('completed_at', { ascending: true })
      .limit(limit);

    if (taskError) throw taskError;

    // Get amendments for this agent to annotate on chart
    const { data: amendments, error: amendError } = await supabase
      .from('monolith_amendments')
      .select('id, amendment_type, trigger_pattern, created_at, is_active, evaluation_status')
      .eq('agent_role', agent)
      .order('created_at', { ascending: true });

    if (amendError) throw amendError;

    // Calculate linear regression for trend line
    const points = (tasks || []).map((t, i) => ({
      x: i,
      y: parseFloat(t.variance_percent),
    }));

    let trendLine = null;
    if (points.length >= 3) {
      const n = points.length;
      const sumX = points.reduce((a, p) => a + p.x, 0);
      const sumY = points.reduce((a, p) => a + p.y, 0);
      const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
      const sumX2 = points.reduce((a, p) => a + p.x * p.x, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      trendLine = {
        slope: Math.round(slope * 1000) / 1000,
        intercept: Math.round(intercept * 100) / 100,
        direction: slope < -0.5 ? 'improving' : slope > 0.5 ? 'declining' : 'stable',
      };
    }

    res.json({
      agent_role: agent,
      tasks: tasks || [],
      amendments: amendments || [],
      trend_line: trendLine,
      data_points: points.length,
    });
  } catch (error) {
    console.error('[NEURAL-STACK] variance-trend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PENDING ESCALATIONS
// ============================================================================

/**
 * GET /api/neural-stack/escalations/pending
 * Returns pending Tier 2-3 escalations awaiting Frank's approval
 */
router.get('/escalations/pending', async (req, res) => {
  try {
    const { data: escalations, error } = await supabase
      .from('monolith_escalation_log')
      .select('*')
      .is('frank_decided_at', null)
      .in('escalation_tier', ['TIER_2_FINANCIAL', 'TIER_3_STRATEGIC'])
      .order('mona_prepared_at', { ascending: true });

    if (error) throw error;

    // Get monthly spend summary
    const { data: monthlySpend, error: spendError } = await supabase
      .from('monolith_monthly_escalation_spend')
      .select('*')
      .limit(1);

    if (spendError) console.warn('[NEURAL-STACK] monthly spend error:', spendError);

    res.json({
      pending: escalations || [],
      pending_count: (escalations || []).length,
      monthly_spend: monthlySpend?.[0] || null,
    });
  } catch (error) {
    console.error('[NEURAL-STACK] escalations/pending error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/neural-stack/escalations/:id/decide
 * Record Frank's decision on an escalation
 */
router.post('/escalations/:id/decide', async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, notes, modified_action, resume_instructions } = req.body;

    if (!['APPROVED', 'DENIED', 'MODIFIED', 'DEFERRED'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }

    const { data, error } = await supabase
      .from('monolith_escalation_log')
      .update({
        frank_decision: decision,
        frank_notes: notes,
        frank_modified_action: modified_action,
        frank_resume_instructions: resume_instructions,
        frank_decided_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[NEURAL-STACK] Escalation ${id} decided: ${decision}`);
    res.json({ success: true, escalation: data });
  } catch (error) {
    console.error('[NEURAL-STACK] escalations/decide error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/neural-stack/escalations/history
 * Returns escalation history with cost tracking
 */
router.get('/escalations/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const { data: escalations, error } = await supabase
      .from('monolith_escalation_log')
      .select('*')
      .not('frank_decided_at', 'is', null)
      .order('frank_decided_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({ history: escalations || [] });
  } catch (error) {
    console.error('[NEURAL-STACK] escalations/history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AMENDMENT ACTIVITY
// ============================================================================

/**
 * GET /api/neural-stack/amendments/recent
 * Returns recent amendment activity across all agents
 */
router.get('/amendments/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;

    const { data: amendments, error } = await supabase
      .from('monolith_amendments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Get pattern log for context
    const { data: patterns, error: patternError } = await supabase
      .from('monolith_pattern_log')
      .select('id, agent_role, pattern_type, confidence, amendment_generated, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (patternError) console.warn('[NEURAL-STACK] pattern log error:', patternError);

    res.json({
      amendments: amendments || [],
      patterns: patterns || [],
    });
  } catch (error) {
    console.error('[NEURAL-STACK] amendments/recent error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/neural-stack/amendments/pending-approval
 * Returns amendments awaiting CEO approval
 */
router.get('/amendments/pending-approval', async (req, res) => {
  try {
    const { data: amendments, error } = await supabase
      .from('monolith_amendments')
      .select('*')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({
      pending: amendments || [],
      count: (amendments || []).length,
    });
  } catch (error) {
    console.error('[NEURAL-STACK] amendments/pending-approval error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/neural-stack/amendments/:id/approve
 * Approve an amendment
 */
router.post('/amendments/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const { data, error } = await supabase
      .from('monolith_amendments')
      .update({
        approval_status: 'approved',
        approved_by: 'frank',
        approved_at: new Date().toISOString(),
        approval_notes: notes,
        is_active: true,
        evaluation_status: 'evaluating',
      })
      .eq('id', id)
      .eq('approval_status', 'pending')
      .select()
      .single();

    if (error) throw error;

    console.log(`[NEURAL-STACK] Amendment ${id} approved`);
    res.json({ success: true, amendment: data });
  } catch (error) {
    console.error('[NEURAL-STACK] amendments/approve error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/neural-stack/amendments/:id/reject
 * Reject an amendment
 */
router.post('/amendments/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { data, error } = await supabase
      .from('monolith_amendments')
      .update({
        approval_status: 'rejected',
        approved_by: 'frank',
        approved_at: new Date().toISOString(),
        approval_notes: reason,
        is_active: false,
      })
      .eq('id', id)
      .eq('approval_status', 'pending')
      .select()
      .single();

    if (error) throw error;

    console.log(`[NEURAL-STACK] Amendment ${id} rejected`);
    res.json({ success: true, amendment: data });
  } catch (error) {
    console.error('[NEURAL-STACK] amendments/reject error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CROSS-AGENT HEATMAP
// ============================================================================

/**
 * GET /api/neural-stack/heatmap
 * Returns cross-agent metric matrix for heatmap visualization
 */
router.get('/heatmap', async (req, res) => {
  try {
    // Get aggregated metrics per agent
    const { data: agents, error: agentError } = await supabase
      .from('monolith_agent_memory')
      .select('agent_role, tasks_completed, avg_success_rate, avg_time_variance');

    if (agentError) throw agentError;

    // Get additional metrics from task history
    const { data: taskStats, error: taskError } = await supabase
      .rpc('get_agent_task_stats'); // We'll create this function or aggregate here

    // For now, aggregate manually
    const { data: recentTasks, error: recentError } = await supabase
      .from('monolith_task_history')
      .select('agent_role, variance_percent, cos_score, success, time_taken_seconds')
      .order('completed_at', { ascending: false })
      .limit(500);

    if (recentError) throw recentError;

    // Aggregate per agent
    const metrics = {};
    const agentRoles = ['ceo', 'cfo', 'cto', 'coo', 'cmo', 'chro', 'clo', 'ciso', 'cos', 'cco', 'cpo', 'cro', 'devops', 'data', 'qa'];

    agentRoles.forEach(role => {
      metrics[role] = {
        agent_role: role,
        variance_avg: 0,
        cos_score_avg: 0,
        success_rate: 100,
        avg_time: 0,
        task_count: 0,
      };
    });

    (recentTasks || []).forEach(t => {
      if (metrics[t.agent_role]) {
        const m = metrics[t.agent_role];
        m.task_count++;
        if (t.variance_percent !== null) {
          m.variance_avg = (m.variance_avg * (m.task_count - 1) + parseFloat(t.variance_percent)) / m.task_count;
        }
        if (t.cos_score !== null) {
          m.cos_score_avg = (m.cos_score_avg * (m.task_count - 1) + parseFloat(t.cos_score)) / m.task_count;
        }
        if (t.success !== null) {
          const successes = Math.round(m.success_rate * (m.task_count - 1) / 100) + (t.success ? 1 : 0);
          m.success_rate = (successes / m.task_count) * 100;
        }
        if (t.time_taken_seconds !== null) {
          m.avg_time = (m.avg_time * (m.task_count - 1) + t.time_taken_seconds) / m.task_count;
        }
      }
    });

    // Get amendment counts
    const { data: amendments, error: amendError } = await supabase
      .from('monolith_amendments')
      .select('agent_role')
      .eq('is_active', true);

    if (amendError) console.warn('[NEURAL-STACK] amendment count error:', amendError);

    (amendments || []).forEach(a => {
      if (metrics[a.agent_role]) {
        metrics[a.agent_role].active_amendments = (metrics[a.agent_role].active_amendments || 0) + 1;
      }
    });

    // Format for heatmap
    const heatmapData = Object.values(metrics).map(m => ({
      agent: m.agent_role.toUpperCase(),
      variance: Math.round(m.variance_avg * 10) / 10,
      cos_score: Math.round(m.cos_score_avg * 100) / 100,
      success_rate: Math.round(m.success_rate),
      avg_time_min: Math.round(m.avg_time / 60),
      amendments: m.active_amendments || 0,
      tasks: m.task_count,
    }));

    res.json({
      agents: heatmapData,
      metrics: ['variance', 'cos_score', 'success_rate', 'avg_time_min', 'amendments'],
    });
  } catch (error) {
    console.error('[NEURAL-STACK] heatmap error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PHASE 5E: EXCEPTION ESCALATIONS
// ============================================================================

/**
 * GET /api/neural-stack/exception-escalations
 * Returns pending exception escalations for CEO review
 * (Skills/Persona mods, consecutive failures, cross-agent patterns)
 */
router.get('/exception-escalations', async (req, res) => {
  try {
    const { data: escalations, error } = await supabase
      .from('exception_escalations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get amendment details for each escalation
    const escalationIds = (escalations || []).map(e => e.amendment_id).filter(Boolean);
    let amendments = [];

    if (escalationIds.length > 0) {
      const { data: amendmentData, error: amendError } = await supabase
        .from('monolith_amendments')
        .select('id, agent_role, amendment_type, trigger_pattern, instruction_delta, created_at')
        .in('id', escalationIds);

      if (amendError) console.warn('[NEURAL-STACK] escalation amendments error:', amendError);
      amendments = amendmentData || [];
    }

    // Join amendment details
    const enrichedEscalations = (escalations || []).map(e => ({
      ...e,
      amendment: amendments.find(a => a.id === e.amendment_id) || null,
    }));

    res.json({
      escalations: enrichedEscalations,
      count: enrichedEscalations.length,
    });
  } catch (error) {
    console.error('[NEURAL-STACK] exception-escalations error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/neural-stack/exception-escalations/:id/resolve
 * CEO resolves an exception escalation
 */
router.post('/exception-escalations/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, notes } = req.body;

    if (!['approved', 'rejected'].includes(resolution)) {
      return res.status(400).json({ error: 'Invalid resolution. Use "approved" or "rejected".' });
    }

    // Get escalation details first
    const { data: escalation, error: getError } = await supabase
      .from('exception_escalations')
      .select('*')
      .eq('id', id)
      .single();

    if (getError) throw getError;
    if (!escalation) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    // Update escalation
    const { data, error } = await supabase
      .from('exception_escalations')
      .update({
        status: resolution,
        resolved_by: 'frank',
        resolution_notes: notes,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If approved, activate the amendment
    if (resolution === 'approved' && escalation.amendment_id) {
      const { error: amendError } = await supabase
        .from('monolith_amendments')
        .update({
          approval_status: 'approved',
          approved_by: 'frank',
          approved_at: new Date().toISOString(),
          approval_notes: `Exception approved: ${notes}`,
          is_active: true,
          evaluation_status: 'evaluating',
        })
        .eq('id', escalation.amendment_id);

      if (amendError) console.warn('[NEURAL-STACK] amendment activation error:', amendError);
    }

    // If rejected, reject the amendment
    if (resolution === 'rejected' && escalation.amendment_id) {
      const { error: amendError } = await supabase
        .from('monolith_amendments')
        .update({
          approval_status: 'rejected',
          approved_by: 'frank',
          approved_at: new Date().toISOString(),
          approval_notes: `Exception rejected: ${notes}`,
          is_active: false,
        })
        .eq('id', escalation.amendment_id);

      if (amendError) console.warn('[NEURAL-STACK] amendment rejection error:', amendError);
    }

    console.log(`[NEURAL-STACK] Exception escalation ${id} resolved: ${resolution}`);
    res.json({ success: true, escalation: data });
  } catch (error) {
    console.error('[NEURAL-STACK] exception-escalations/resolve error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PHASE 5E: COS HEALTH MONITORING
// ============================================================================

/**
 * GET /api/neural-stack/cos-health
 * Returns CoS success rate and alert status
 */
router.get('/cos-health', async (req, res) => {
  try {
    // Get recent CoS monitoring entries (last 20)
    const { data: monitoring, error: monitorError } = await supabase
      .from('cos_monitoring')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(20);

    if (monitorError) throw monitorError;

    // Calculate success rate
    const entries = monitoring || [];
    const successCount = entries.filter(e => e.success).length;
    const successRate = entries.length > 0 ? successCount / entries.length : 1;

    // Determine alert status
    const ALERT_THRESHOLD = 0.50;
    const MIN_FOR_ALERT = 10;
    const alertTriggered = entries.length >= MIN_FOR_ALERT && successRate < ALERT_THRESHOLD;

    // Get active CEO alerts
    const { data: alerts, error: alertError } = await supabase
      .from('ceo_alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (alertError) console.warn('[NEURAL-STACK] CEO alerts error:', alertError);

    // Get historical success rate trend (last 5 windows of 20)
    const { data: allMonitoring, error: histError } = await supabase
      .from('cos_monitoring')
      .select('success, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(100);

    if (histError) console.warn('[NEURAL-STACK] monitoring history error:', histError);

    // Calculate trend
    const trend = [];
    const allEntries = allMonitoring || [];
    for (let i = 0; i < 5; i++) {
      const window = allEntries.slice(i * 20, (i + 1) * 20);
      if (window.length > 0) {
        const rate = window.filter(e => e.success).length / window.length;
        trend.push({
          window: i + 1,
          success_rate: Math.round(rate * 100),
          sample_size: window.length,
        });
      }
    }

    res.json({
      current: {
        success_rate: Math.round(successRate * 100),
        sample_size: entries.length,
        successes: successCount,
        failures: entries.length - successCount,
      },
      alert: {
        triggered: alertTriggered,
        threshold: ALERT_THRESHOLD * 100,
        min_sample_size: MIN_FOR_ALERT,
      },
      active_alerts: alerts || [],
      trend: trend.reverse(), // Oldest first for chart
      hardcoded_constraints: {
        alert_threshold: '50%',
        window_size: 20,
        min_for_alert: 10,
        note: 'These values are hardcoded and cannot be modified by CoS',
      },
    });
  } catch (error) {
    console.error('[NEURAL-STACK] cos-health error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/neural-stack/cos-health/acknowledge-alert
 * CEO acknowledges a CoS health alert
 */
router.post('/cos-health/acknowledge-alert/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const { data, error } = await supabase
      .from('ceo_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: 'frank',
        notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[NEURAL-STACK] CEO alert ${id} acknowledged`);
    res.json({ success: true, alert: data });
  } catch (error) {
    console.error('[NEURAL-STACK] acknowledge-alert error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PHASE 5E: BAKED AMENDMENTS
// ============================================================================

/**
 * GET /api/neural-stack/baked-amendments
 * Returns history of baked amendments
 */
router.get('/baked-amendments', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const agentRole = req.query.agent;

    let query = supabase
      .from('baked_amendments')
      .select('*')
      .order('baked_at', { ascending: false })
      .limit(limit);

    if (agentRole) {
      query = query.eq('agent_role', agentRole);
    }

    const { data: baked, error } = await query;

    if (error) throw error;

    // Get baking statistics
    const { data: allBaked, error: statsError } = await supabase
      .from('baked_amendments')
      .select('agent_role, baked_at');

    if (statsError) console.warn('[NEURAL-STACK] baking stats error:', statsError);

    // Calculate stats
    const stats = {
      total_baked: (allBaked || []).length,
      by_agent: {},
      recent_week: 0,
    };

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    (allBaked || []).forEach(b => {
      stats.by_agent[b.agent_role] = (stats.by_agent[b.agent_role] || 0) + 1;
      if (new Date(b.baked_at) > weekAgo) {
        stats.recent_week++;
      }
    });

    res.json({
      baked: baked || [],
      stats,
      baking_config: {
        amendment_threshold: 10,
        min_successful_evals: 5,
        min_success_rate: '60%',
        note: 'Amendments bake when agent reaches 10 active amendments',
      },
    });
  } catch (error) {
    console.error('[NEURAL-STACK] baked-amendments error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/neural-stack/baked-amendments/:agent/version-history
 * Returns version hash history for an agent
 */
router.get('/baked-amendments/:agent/version-history', async (req, res) => {
  try {
    const { agent } = req.params;

    const { data: versions, error } = await supabase
      .from('baked_amendments')
      .select('previous_version_hash, new_version_hash, baked_at, trigger_pattern, amendment_type')
      .eq('agent_role', agent)
      .order('baked_at', { ascending: true });

    if (error) throw error;

    res.json({
      agent_role: agent,
      versions: versions || [],
      total_bakes: (versions || []).length,
    });
  } catch (error) {
    console.error('[NEURAL-STACK] version-history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PHASE 5E: AUTONOMY STATISTICS
// ============================================================================

/**
 * GET /api/neural-stack/autonomy-stats
 * Returns autonomous vs escalated amendment breakdown
 */
router.get('/autonomy-stats', async (req, res) => {
  try {
    // Get all amendments with auto_approved flag
    const { data: amendments, error: amendError } = await supabase
      .from('monolith_amendments')
      .select('id, agent_role, auto_approved, approval_status, created_at, escalation_id');

    if (amendError) throw amendError;

    // Get all exception escalations
    const { data: escalations, error: escError } = await supabase
      .from('exception_escalations')
      .select('id, reason, status, created_at');

    if (escError) console.warn('[NEURAL-STACK] escalation stats error:', escError);

    // Calculate stats
    const allAmends = amendments || [];
    const allEscalations = escalations || [];

    const stats = {
      total_amendments: allAmends.length,
      autonomous: allAmends.filter(a => a.auto_approved).length,
      escalated: allAmends.filter(a => a.escalation_id).length,
      pending_approval: allAmends.filter(a => a.approval_status === 'pending').length,
      approved: allAmends.filter(a => a.approval_status === 'approved' || a.approval_status === 'auto_approved').length,
      rejected: allAmends.filter(a => a.approval_status === 'rejected').length,
    };

    // Autonomy rate
    stats.autonomy_rate = stats.total_amendments > 0
      ? Math.round((stats.autonomous / stats.total_amendments) * 100)
      : 100;

    // Breakdown by escalation reason
    const escalationReasons = {};
    allEscalations.forEach(e => {
      escalationReasons[e.reason] = (escalationReasons[e.reason] || 0) + 1;
    });

    // Recent activity (last 24 hours)
    const dayAgo = new Date();
    dayAgo.setDate(dayAgo.getDate() - 1);

    const recentAmends = allAmends.filter(a => new Date(a.created_at) > dayAgo);
    const recentStats = {
      total: recentAmends.length,
      autonomous: recentAmends.filter(a => a.auto_approved).length,
      escalated: recentAmends.filter(a => a.escalation_id).length,
    };

    // By agent breakdown
    const byAgent = {};
    allAmends.forEach(a => {
      if (!byAgent[a.agent_role]) {
        byAgent[a.agent_role] = { total: 0, autonomous: 0, escalated: 0 };
      }
      byAgent[a.agent_role].total++;
      if (a.auto_approved) byAgent[a.agent_role].autonomous++;
      if (a.escalation_id) byAgent[a.agent_role].escalated++;
    });

    // Get reversion stats
    const { data: reversions, error: revError } = await supabase
      .from('revert_log')
      .select('id, reverted_at');

    if (revError) console.warn('[NEURAL-STACK] reversion stats error:', revError);

    res.json({
      overall: stats,
      recent_24h: recentStats,
      by_agent: byAgent,
      escalation_reasons: escalationReasons,
      total_escalations: allEscalations.length,
      pending_escalations: allEscalations.filter(e => e.status === 'pending').length,
      total_reversions: (reversions || []).length,
      autonomy_mode: {
        status: 'active',
        description: 'CoS operates autonomously for standard Knowledge layer amendments',
        exceptions: [
          'Skills layer modifications',
          'Persona layer modifications',
          '3+ consecutive failures',
          'Cross-agent decline patterns',
        ],
      },
    });
  } catch (error) {
    console.error('[NEURAL-STACK] autonomy-stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/neural-stack/revert-log
 * Returns history of auto-reverted amendments
 */
router.get('/revert-log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const { data: reversions, error } = await supabase
      .from('revert_log')
      .select('*')
      .order('reverted_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Get amendment details for context
    const amendmentIds = (reversions || []).map(r => r.amendment_id).filter(Boolean);
    let amendments = [];

    if (amendmentIds.length > 0) {
      const { data: amendmentData, error: amendError } = await supabase
        .from('monolith_amendments')
        .select('id, agent_role, trigger_pattern, instruction_delta')
        .in('id', amendmentIds);

      if (amendError) console.warn('[NEURAL-STACK] revert amendments error:', amendError);
      amendments = amendmentData || [];
    }

    // Enrich reversions with amendment details
    const enrichedReversions = (reversions || []).map(r => ({
      ...r,
      amendment: amendments.find(a => a.id === r.amendment_id) || null,
    }));

    res.json({
      reversions: enrichedReversions,
      total: (reversions || []).length,
    });
  } catch (error) {
    console.error('[NEURAL-STACK] revert-log error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/neural-stack/consecutive-failures
 * Returns agents with consecutive failure tracking
 */
router.get('/consecutive-failures', async (req, res) => {
  try {
    const { data: failures, error } = await supabase
      .from('consecutive_failures')
      .select('*')
      .order('failure_count', { ascending: false });

    if (error) throw error;

    // Filter to show only agents with failures
    const withFailures = (failures || []).filter(f => f.failure_count > 0);

    res.json({
      agents: withFailures,
      escalation_threshold: 3,
      note: 'Agents with 3+ consecutive failures trigger CEO escalation',
    });
  } catch (error) {
    console.error('[NEURAL-STACK] consecutive-failures error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
