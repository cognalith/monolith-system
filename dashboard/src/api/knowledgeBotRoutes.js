/**
 * KNOWLEDGE BOT API ROUTES - Phase 6B
 * Cognalith Inc. | Monolith System
 *
 * API endpoints for Knowledge Bot management, research cycles, and recommendations.
 * Knowledge Bots provide domain-specific research and recommendations to subordinate agents.
 *
 * Team Structure with Knowledge Bots:
 * - executive-kb: CEO's Knowledge Bot for C-Suite
 * - tech-kb: CTO's Knowledge Bot for Technology team
 * - ops-kb: COO's Knowledge Bot for Operations team
 * - finance-kb: CFO's Knowledge Bot for Finance team
 * - marketing-kb: CMO's Knowledge Bot for Marketing team
 * - hr-kb: CHRO's Knowledge Bot for HR team
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
// KNOWLEDGE BOT CONFIGURATION
// ============================================================================

/**
 * Knowledge Bot definitions with their team mappings.
 * Each Knowledge Bot is associated with a Team Lead and provides
 * research and recommendations for subordinates.
 */
const KNOWLEDGE_BOTS = {
  'executive-kb': {
    role: 'executive-kb',
    team_id: 'executive',
    team_lead_role: 'ceo',
    subordinates: ['cfo', 'coo', 'cto', 'cmo', 'chro', 'ciso', 'clo'],
    name: 'Executive Knowledge Bot',
    description: 'Strategic intelligence and executive decision support',
    domains: ['strategy', 'leadership', 'organizational_design', 'governance'],
  },
  'tech-kb': {
    role: 'tech-kb',
    team_id: 'technology',
    team_lead_role: 'cto',
    subordinates: ['devops', 'data', 'qa', 'ciso'],
    name: 'Technology Knowledge Bot',
    description: 'Technical research, architecture patterns, and engineering best practices',
    domains: ['architecture', 'devops', 'security', 'data_engineering', 'quality_assurance'],
  },
  'ops-kb': {
    role: 'ops-kb',
    team_id: 'operations',
    team_lead_role: 'coo',
    subordinates: ['cos', 'cpo', 'cco'],
    name: 'Operations Knowledge Bot',
    description: 'Operational efficiency, process optimization, and compliance',
    domains: ['operations', 'process_improvement', 'compliance', 'product_management'],
  },
  'finance-kb': {
    role: 'finance-kb',
    team_id: 'finance',
    team_lead_role: 'cfo',
    subordinates: ['cro'],
    name: 'Finance Knowledge Bot',
    description: 'Financial analysis, revenue optimization, and budgeting',
    domains: ['finance', 'revenue', 'budgeting', 'forecasting'],
  },
  'marketing-kb': {
    role: 'marketing-kb',
    team_id: 'marketing',
    team_lead_role: 'cmo',
    subordinates: [],
    name: 'Marketing Knowledge Bot',
    description: 'Marketing strategy, brand management, and customer insights',
    domains: ['marketing', 'brand', 'customer_acquisition', 'analytics'],
  },
  'hr-kb': {
    role: 'hr-kb',
    team_id: 'hr',
    team_lead_role: 'chro',
    subordinates: [],
    name: 'HR Knowledge Bot',
    description: 'Talent management, culture, and organizational development',
    domains: ['talent', 'culture', 'compensation', 'development'],
  },
};

// Helper to get Knowledge Bot by role
const getKnowledgeBotConfig = (role) => KNOWLEDGE_BOTS[role] || null;

// Helper to find Knowledge Bot for a subordinate
const findKnowledgeBotForSubordinate = (subordinateRole) => {
  for (const kb of Object.values(KNOWLEDGE_BOTS)) {
    if (kb.subordinates.includes(subordinateRole)) {
      return kb;
    }
  }
  return null;
};

// Helper to get full role name
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
    'executive-kb': 'Executive Knowledge Bot',
    'tech-kb': 'Technology Knowledge Bot',
    'ops-kb': 'Operations Knowledge Bot',
    'finance-kb': 'Finance Knowledge Bot',
    'marketing-kb': 'Marketing Knowledge Bot',
    'hr-kb': 'HR Knowledge Bot',
  };
  return roleNames[roleId] || roleId.toUpperCase();
}

// ============================================================================
// LIST ALL KNOWLEDGE BOTS WITH METRICS
// ============================================================================

/**
 * GET /api/neural-stack/knowledge-bots
 * Returns all Knowledge Bots with their metrics
 */
router.get('/', async (req, res) => {
  try {
    // Get Knowledge Bot records from database
    const { data: kbRecords, error: kbError } = await supabase
      .from('monolith_knowledge_bots')
      .select('*');

    // Table may not exist yet - handle gracefully
    if (kbError && kbError.code !== '42P01') {
      console.warn('[KNOWLEDGE-BOTS] database error:', kbError.message);
    }

    // Get recommendation counts per Knowledge Bot
    const { data: recommendations, error: recError } = await supabase
      .from('monolith_kb_recommendations')
      .select('knowledge_bot_role, status, created_at');

    if (recError && recError.code !== '42P01') {
      console.warn('[KNOWLEDGE-BOTS] recommendations error:', recError.message);
    }

    // Get research cycle history
    const { data: researchHistory, error: researchError } = await supabase
      .from('monolith_kb_research_cycles')
      .select('knowledge_bot_role, completed_at, recommendations_generated, success')
      .order('completed_at', { ascending: false })
      .limit(100);

    if (researchError && researchError.code !== '42P01') {
      console.warn('[KNOWLEDGE-BOTS] research history error:', researchError.message);
    }

    // Build KB record lookup
    const kbMap = {};
    (kbRecords || []).forEach(kb => {
      kbMap[kb.role] = kb;
    });

    // Aggregate recommendation stats
    const recStats = {};
    (recommendations || []).forEach(r => {
      if (!recStats[r.knowledge_bot_role]) {
        recStats[r.knowledge_bot_role] = { total: 0, pending: 0, applied: 0, rejected: 0 };
      }
      recStats[r.knowledge_bot_role].total++;
      if (r.status === 'pending') recStats[r.knowledge_bot_role].pending++;
      else if (r.status === 'applied') recStats[r.knowledge_bot_role].applied++;
      else if (r.status === 'rejected') recStats[r.knowledge_bot_role].rejected++;
    });

    // Aggregate research cycle stats
    const researchStats = {};
    (researchHistory || []).forEach(r => {
      if (!researchStats[r.knowledge_bot_role]) {
        researchStats[r.knowledge_bot_role] = { cycles: 0, total_recommendations: 0, successes: 0 };
      }
      researchStats[r.knowledge_bot_role].cycles++;
      researchStats[r.knowledge_bot_role].total_recommendations += r.recommendations_generated || 0;
      if (r.success) researchStats[r.knowledge_bot_role].successes++;
    });

    // Build response for each Knowledge Bot
    const bots = Object.values(KNOWLEDGE_BOTS).map(kb => {
      const dbRecord = kbMap[kb.role] || {};
      const rStats = recStats[kb.role] || { total: 0, pending: 0, applied: 0, rejected: 0 };
      const rCycles = researchStats[kb.role] || { cycles: 0, total_recommendations: 0, successes: 0 };

      // Calculate success rate
      const successRate = rStats.total > 0
        ? Math.round((rStats.applied / rStats.total) * 100)
        : 100;

      // Calculate confidence trend (placeholder - would need historical data)
      const confidenceTrend = rCycles.successes > 0 ? 'stable' : 'insufficient_data';

      return {
        role: kb.role,
        name: kb.name,
        team_id: kb.team_id,
        team_lead_role: kb.team_lead_role,
        subordinates: kb.subordinates,
        description: kb.description,
        domains: kb.domains,
        last_research_cycle: dbRecord.last_research_cycle || null,
        recommendations_generated: rStats.total,
        pending_recommendations: rStats.pending,
        applied_recommendations: rStats.applied,
        success_rate: successRate,
        confidence_trend: confidenceTrend,
        research_cycles_completed: rCycles.cycles,
        status: dbRecord.status || 'active',
      };
    });

    res.json({
      bots,
      total_bots: bots.length,
      version: '6B',
    });
  } catch (error) {
    console.error('[KNOWLEDGE-BOTS] list bots error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET KNOWLEDGE BOT DETAIL WITH FULL METRICS
// ============================================================================

/**
 * GET /api/neural-stack/knowledge-bots/:role
 * Returns detailed information for a specific Knowledge Bot
 */
router.get('/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const kbConfig = getKnowledgeBotConfig(role);

    if (!kbConfig) {
      return res.status(404).json({ error: `Knowledge Bot '${role}' not found` });
    }

    // Get Knowledge Bot database record
    const { data: kbRecord, error: kbError } = await supabase
      .from('monolith_knowledge_bots')
      .select('*')
      .eq('role', role)
      .single();

    if (kbError && kbError.code !== '42P01' && kbError.code !== 'PGRST116') {
      console.warn('[KNOWLEDGE-BOTS] database lookup error:', kbError.message);
    }

    // Get recommendations for this KB
    const { data: recommendations, error: recError } = await supabase
      .from('monolith_kb_recommendations')
      .select('id, subordinate_role, type, status, expected_impact, created_at')
      .eq('knowledge_bot_role', role)
      .order('created_at', { ascending: false })
      .limit(50);

    if (recError && recError.code !== '42P01') {
      console.warn('[KNOWLEDGE-BOTS] recommendations error:', recError.message);
    }

    // Get research cycle history
    const { data: researchHistory, error: researchError } = await supabase
      .from('monolith_kb_research_cycles')
      .select('*')
      .eq('knowledge_bot_role', role)
      .order('completed_at', { ascending: false })
      .limit(20);

    if (researchError && researchError.code !== '42P01') {
      console.warn('[KNOWLEDGE-BOTS] research history error:', researchError.message);
    }

    // Get learning data (patterns learned from subordinate performance)
    const { data: learningData, error: learningError } = await supabase
      .from('monolith_kb_learning')
      .select('*')
      .eq('knowledge_bot_role', role)
      .order('learned_at', { ascending: false })
      .limit(30);

    if (learningError && learningError.code !== '42P01') {
      console.warn('[KNOWLEDGE-BOTS] learning data error:', learningError.message);
    }

    // Calculate metrics
    const recs = recommendations || [];
    const metrics = {
      total_recommendations: recs.length,
      pending_recommendations: recs.filter(r => r.status === 'pending').length,
      applied_recommendations: recs.filter(r => r.status === 'applied').length,
      rejected_recommendations: recs.filter(r => r.status === 'rejected').length,
      success_rate: recs.length > 0
        ? Math.round((recs.filter(r => r.status === 'applied').length / recs.length) * 100)
        : 100,
      research_cycles: (researchHistory || []).length,
      learning_entries: (learningData || []).length,
    };

    // Get subordinate agent health for context
    const { data: subordinateHealth, error: healthError } = await supabase
      .from('monolith_agent_memory')
      .select('agent_role, avg_variance_percent, current_trend, tasks_since_last_review')
      .in('agent_role', kbConfig.subordinates);

    if (healthError) {
      console.warn('[KNOWLEDGE-BOTS] subordinate health error:', healthError.message);
    }

    res.json({
      bot: {
        ...kbConfig,
        status: kbRecord?.status || 'active',
        last_research_cycle: kbRecord?.last_research_cycle || null,
        created_at: kbRecord?.created_at || null,
      },
      metrics,
      recent_recommendations: recs.slice(0, 10).map(r => ({
        id: r.id,
        subordinate_role: r.subordinate_role,
        subordinate_name: getFullRoleName(r.subordinate_role),
        type: r.type,
        status: r.status,
        expected_impact: r.expected_impact,
        created_at: r.created_at,
      })),
      research_history: (researchHistory || []).map(r => ({
        id: r.id,
        completed_at: r.completed_at,
        recommendations_generated: r.recommendations_generated,
        success: r.success,
        duration_seconds: r.duration_seconds,
        research_focus: r.research_focus,
      })),
      learning_data: (learningData || []).map(l => ({
        id: l.id,
        pattern_type: l.pattern_type,
        subordinate_role: l.subordinate_role,
        insight: l.insight,
        confidence: l.confidence,
        learned_at: l.learned_at,
      })),
      subordinate_health: (subordinateHealth || []).map(s => ({
        role: s.agent_role,
        full_name: getFullRoleName(s.agent_role),
        variance: parseFloat(s.avg_variance_percent || 0).toFixed(1),
        trend: s.current_trend,
        tasks_reviewed: s.tasks_since_last_review || 0,
      })),
    });
  } catch (error) {
    console.error('[KNOWLEDGE-BOTS] get bot detail error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET PENDING RECOMMENDATIONS FROM A KNOWLEDGE BOT
// ============================================================================

/**
 * GET /api/neural-stack/knowledge-bots/:role/recommendations
 * Returns recommendations from a Knowledge Bot with optional filters
 * Query params: ?status=pending&subordinate=devops
 */
router.get('/:role/recommendations', async (req, res) => {
  try {
    const { role } = req.params;
    const { status, subordinate } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    const kbConfig = getKnowledgeBotConfig(role);
    if (!kbConfig) {
      return res.status(404).json({ error: `Knowledge Bot '${role}' not found` });
    }

    // Validate subordinate if provided
    if (subordinate && !kbConfig.subordinates.includes(subordinate)) {
      return res.status(400).json({
        error: `Role '${subordinate}' is not a subordinate of Knowledge Bot '${role}'`,
        valid_subordinates: kbConfig.subordinates,
      });
    }

    // Build query
    let query = supabase
      .from('monolith_kb_recommendations')
      .select('*')
      .eq('knowledge_bot_role', role)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (subordinate) {
      query = query.eq('subordinate_role', subordinate);
    }

    const { data: recommendations, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist yet
        return res.json({
          recommendations: [],
          knowledge_bot: role,
          filters: { status, subordinate },
          message: 'Recommendations table not yet created. Run Phase 6B migration.',
        });
      }
      throw error;
    }

    res.json({
      recommendations: (recommendations || []).map(r => ({
        id: r.id,
        subordinate_role: r.subordinate_role,
        subordinate_name: getFullRoleName(r.subordinate_role),
        type: r.type,
        content: r.content,
        expected_impact: r.expected_impact,
        confidence: r.confidence,
        status: r.status,
        research_source: r.research_source,
        created_at: r.created_at,
        applied_at: r.applied_at,
        amendment_id: r.amendment_id,
      })),
      knowledge_bot: role,
      knowledge_bot_name: kbConfig.name,
      filters: { status, subordinate },
      total: (recommendations || []).length,
    });
  } catch (error) {
    console.error('[KNOWLEDGE-BOTS] get recommendations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TRIGGER MANUAL RESEARCH CYCLE FOR A KNOWLEDGE BOT
// ============================================================================

/**
 * POST /api/neural-stack/knowledge-bots/:role/research
 * Triggers a manual research cycle for a Knowledge Bot
 * Body: { subordinate_role?: string } (optional, research specific subordinate)
 */
router.post('/:role/research', async (req, res) => {
  try {
    const { role } = req.params;
    const { subordinate_role } = req.body;

    const kbConfig = getKnowledgeBotConfig(role);
    if (!kbConfig) {
      return res.status(404).json({ error: `Knowledge Bot '${role}' not found` });
    }

    // Validate subordinate if provided
    if (subordinate_role && !kbConfig.subordinates.includes(subordinate_role)) {
      return res.status(400).json({
        error: `Role '${subordinate_role}' is not a subordinate of Knowledge Bot '${role}'`,
        valid_subordinates: kbConfig.subordinates,
      });
    }

    // Determine which subordinates to research
    const rolesToResearch = subordinate_role
      ? [subordinate_role]
      : kbConfig.subordinates;

    const researchResults = [];
    const recommendationsGenerated = [];
    const startTime = Date.now();

    for (const targetRole of rolesToResearch) {
      // Get recent performance data for the subordinate
      const { data: recentTasks, error: taskError } = await supabase
        .from('monolith_task_history')
        .select('variance_percent, cos_score, success, task_type, completed_at')
        .eq('agent_role', targetRole)
        .order('completed_at', { ascending: false })
        .limit(20);

      if (taskError) {
        console.warn(`[KNOWLEDGE-BOTS] Could not fetch tasks for ${targetRole}:`, taskError.message);
        continue;
      }

      // Get agent memory for context
      const { data: agentMemory, error: memoryError } = await supabase
        .from('monolith_agent_memory')
        .select('*')
        .eq('agent_role', targetRole)
        .single();

      if (memoryError && memoryError.code !== 'PGRST116') {
        console.warn(`[KNOWLEDGE-BOTS] Could not fetch memory for ${targetRole}:`, memoryError.message);
      }

      // Analyze performance patterns
      const tasks = recentTasks || [];
      const variances = tasks
        .map(t => parseFloat(t.variance_percent))
        .filter(v => !isNaN(v));

      const avgVariance = variances.length > 0
        ? variances.reduce((a, b) => a + b, 0) / variances.length
        : 0;

      const successRate = tasks.length > 0
        ? tasks.filter(t => t.success).length / tasks.length
        : 1;

      // Determine trend
      let trend = 'stable';
      let needsRecommendation = false;
      let recommendationType = null;
      let recommendationContent = null;
      let expectedImpact = null;

      if (variances.length >= 4) {
        const recent = variances.slice(0, Math.floor(variances.length / 2));
        const older = variances.slice(Math.floor(variances.length / 2));
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

        if (recentAvg < olderAvg - 5) {
          trend = 'improving';
        } else if (recentAvg > olderAvg + 5) {
          trend = 'declining';
          needsRecommendation = true;
          recommendationType = 'time_estimation';
          recommendationContent = `Consider reviewing time estimation patterns. Recent variance: ${avgVariance.toFixed(1)}%. Recommend adding buffer time for ${targetRole} tasks.`;
          expectedImpact = 'medium';
        }
      }

      // Check for high variance
      if (avgVariance > 15 && !needsRecommendation) {
        needsRecommendation = true;
        recommendationType = 'process_improvement';
        recommendationContent = `High variance detected (${avgVariance.toFixed(1)}%). Recommend process review and standardization for ${getFullRoleName(targetRole)} tasks.`;
        expectedImpact = 'high';
      }

      // Check for low success rate
      if (successRate < 0.85 && !needsRecommendation) {
        needsRecommendation = true;
        recommendationType = 'skill_enhancement';
        recommendationContent = `Success rate below threshold (${Math.round(successRate * 100)}%). Recommend reviewing task requirements and providing additional guidance.`;
        expectedImpact = 'high';
      }

      // Create recommendation if needed
      if (needsRecommendation) {
        const recData = {
          knowledge_bot_role: role,
          subordinate_role: targetRole,
          type: recommendationType,
          content: recommendationContent,
          expected_impact: expectedImpact,
          confidence: Math.round((1 - avgVariance / 100) * 100) / 100,
          status: 'pending',
          research_source: 'manual_research_cycle',
          research_context: {
            avg_variance: avgVariance,
            success_rate: successRate,
            trend,
            tasks_analyzed: tasks.length,
          },
          created_at: new Date().toISOString(),
        };

        const { data: recommendation, error: recError } = await supabase
          .from('monolith_kb_recommendations')
          .insert([recData])
          .select()
          .single();

        if (recError) {
          if (recError.code === '42P01') {
            console.warn('[KNOWLEDGE-BOTS] recommendations table not found, skipping insert');
          } else {
            console.warn(`[KNOWLEDGE-BOTS] Could not create recommendation for ${targetRole}:`, recError.message);
          }
        } else {
          recommendationsGenerated.push({
            id: recommendation.id,
            subordinate_role: targetRole,
            type: recommendationType,
            expected_impact: expectedImpact,
          });
        }
      }

      researchResults.push({
        subordinate_role: targetRole,
        subordinate_name: getFullRoleName(targetRole),
        tasks_analyzed: tasks.length,
        avg_variance: Math.round(avgVariance * 10) / 10,
        success_rate: Math.round(successRate * 100),
        trend,
        recommendation_generated: needsRecommendation,
      });
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // Log research cycle
    const cycleData = {
      knowledge_bot_role: role,
      completed_at: new Date().toISOString(),
      recommendations_generated: recommendationsGenerated.length,
      success: true,
      duration_seconds: durationSeconds,
      research_focus: subordinate_role || 'all_subordinates',
      subordinates_researched: rolesToResearch.length,
    };

    const { error: cycleError } = await supabase
      .from('monolith_kb_research_cycles')
      .insert([cycleData]);

    if (cycleError && cycleError.code !== '42P01') {
      console.warn('[KNOWLEDGE-BOTS] Could not log research cycle:', cycleError.message);
    }

    // Update Knowledge Bot last research cycle timestamp
    const { error: updateError } = await supabase
      .from('monolith_knowledge_bots')
      .upsert({
        role,
        last_research_cycle: new Date().toISOString(),
        status: 'active',
      });

    if (updateError && updateError.code !== '42P01') {
      console.warn('[KNOWLEDGE-BOTS] Could not update KB record:', updateError.message);
    }

    res.json({
      success: true,
      knowledge_bot: role,
      knowledge_bot_name: kbConfig.name,
      research_completed: researchResults.length,
      recommendations_generated: recommendationsGenerated.length,
      duration_seconds: durationSeconds,
      results: researchResults,
      recommendations: recommendationsGenerated,
    });
  } catch (error) {
    console.error('[KNOWLEDGE-BOTS] research cycle error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
