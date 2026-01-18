/**
 * CONTEXT GRAPH API ROUTES - Phase 9
 * Cognalith Inc. | Monolith System
 *
 * Provides endpoints for context graph visualization and analysis:
 * - Graph data retrieval (nodes, edges)
 * - Execution traces
 * - Agent workload views
 * - Workflow patterns
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Agent colors for visualization
const AGENT_COLORS = {
  ceo: '#FFD700',
  cfo: '#4CAF50',
  cto: '#2196F3',
  coo: '#9C27B0',
  cmo: '#FF9800',
  cpo: '#00BCD4',
  cos: '#E91E63',
  ciso: '#F44336',
  clo: '#795548',
  chro: '#607D8B',
  devops: '#3F51B5',
  qa: '#009688',
  swe: '#673AB7',
};

// Status colors
const STATUS_COLORS = {
  queued: '#888888',
  active: '#00F0FF',
  completed: '#4CAF50',
  blocked: '#FF3D00',
  failed: '#F44336',
};

// ============================================================================
// GRAPH DATA ENDPOINTS
// ============================================================================

/**
 * GET /graph
 * Get the full context graph (nodes + edges)
 * Query params: ?include_tasks=true&include_agents=true&status=active
 */
router.get('/graph', async (req, res) => {
  try {
    const { include_tasks = 'true', include_agents = 'true', status } = req.query;

    // Fetch nodes
    let nodesQuery = supabase.from('monolith_context_nodes').select('*');

    if (include_tasks !== 'true') {
      nodesQuery = nodesQuery.neq('node_type', 'task');
    }
    if (include_agents !== 'true') {
      nodesQuery = nodesQuery.neq('node_type', 'agent');
    }
    if (status) {
      nodesQuery = nodesQuery.eq('status', status);
    }

    const { data: nodes, error: nodesError } = await nodesQuery;
    if (nodesError) throw nodesError;

    // Fetch edges for these nodes
    const nodeIds = (nodes || []).map(n => n.id);
    const { data: edges, error: edgesError } = await supabase
      .from('monolith_context_edges')
      .select('*')
      .or(`source_node_id.in.(${nodeIds.join(',')}),target_node_id.in.(${nodeIds.join(',')})`);

    if (edgesError && nodeIds.length > 0) throw edgesError;

    res.json({
      nodes: nodes || [],
      edges: edges || [],
      meta: {
        node_count: (nodes || []).length,
        edge_count: (edges || []).length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[CONTEXT-GRAPH] GET /graph error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /graph/task-flow
 * Get task dependency graph with execution flow
 * Returns nodes for tasks and edges for dependencies
 */
router.get('/graph/task-flow', async (req, res) => {
  try {
    const { status, agent, limit = 100 } = req.query;

    // Build task query
    let taskQuery = supabase
      .from('monolith_task_queue')
      .select('*')
      .order('priority', { ascending: false })
      .limit(parseInt(limit));

    if (status) {
      taskQuery = taskQuery.eq('status', status);
    }
    if (agent) {
      taskQuery = taskQuery.eq('assigned_agent', agent.toLowerCase());
    }

    const { data: tasks, error: tasksError } = await taskQuery;
    if (tasksError) throw tasksError;

    // Get dependencies
    const taskIds = (tasks || []).map(t => t.id);
    const { data: dependencies, error: depsError } = await supabase
      .from('monolith_task_dependencies')
      .select('*')
      .or(`task_id.in.(${taskIds.join(',')}),depends_on_task_id.in.(${taskIds.join(',')})`);

    if (depsError && taskIds.length > 0) throw depsError;

    // Transform to graph format
    const nodes = (tasks || []).map(task => ({
      id: task.id,
      type: 'task',
      label: task.title,
      data: {
        taskId: task.task_id,
        agent: task.assigned_agent,
        status: task.status,
        priority: task.priority,
        createdAt: task.created_at,
        tokensUsed: task.tokens_total,
      },
      position: { x: 0, y: 0 }, // Will be calculated by frontend
      style: {
        backgroundColor: STATUS_COLORS[task.status] || '#888',
        borderColor: AGENT_COLORS[task.assigned_agent] || '#fff',
      },
    }));

    const edges = (dependencies || []).map(dep => ({
      id: dep.id,
      source: dep.depends_on_task_id,
      target: dep.task_id,
      type: dep.dependency_type || 'depends_on',
      animated: dep.status === 'pending',
      style: {
        stroke: dep.status === 'satisfied' ? '#4CAF50' : '#FF9800',
      },
    }));

    res.json({
      nodes,
      edges,
      summary: {
        total_tasks: nodes.length,
        total_dependencies: edges.length,
        by_status: groupBy(tasks || [], 'status'),
        by_agent: groupBy(tasks || [], 'assigned_agent'),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CONTEXT-GRAPH] GET /graph/task-flow error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /graph/agent-network
 * Get agent relationship network with workload
 */
router.get('/graph/agent-network', async (req, res) => {
  try {
    // Get agent workload from view
    const { data: workload, error: workloadError } = await supabase
      .from('v_agent_workload')
      .select('*');

    if (workloadError) throw workloadError;

    // Get agent nodes
    const { data: agents, error: agentsError } = await supabase
      .from('monolith_context_nodes')
      .select('*')
      .eq('node_type', 'agent');

    if (agentsError) throw agentsError;

    // Get inter-agent task flows (tasks that went from one agent to another)
    const { data: flows, error: flowsError } = await supabase
      .from('monolith_task_dependencies')
      .select(`
        task_id,
        depends_on_task_id,
        monolith_task_queue!monolith_task_dependencies_task_id_fkey(assigned_agent),
        blocking_task:monolith_task_queue!monolith_task_dependencies_depends_on_task_id_fkey(assigned_agent)
      `)
      .not('monolith_task_queue.assigned_agent', 'is', null);

    // Build agent flow map
    const agentFlows = new Map();
    (flows || []).forEach(flow => {
      const source = flow.blocking_task?.assigned_agent;
      const target = flow.monolith_task_queue?.assigned_agent;
      if (source && target && source !== target) {
        const key = `${source}->${target}`;
        agentFlows.set(key, (agentFlows.get(key) || 0) + 1);
      }
    });

    // Transform to graph format
    const nodes = (agents || []).map(agent => {
      const stats = (workload || []).find(w => w.assigned_agent === agent.node_id) || {};
      return {
        id: agent.node_id,
        type: 'agent',
        label: agent.label,
        data: {
          description: agent.description,
          queued: stats.queued_count || 0,
          active: stats.active_count || 0,
          blocked: stats.blocked_count || 0,
          completed24h: stats.completed_24h || 0,
          tokensUsed: stats.total_tokens_used || 0,
          costUsd: parseFloat(stats.total_cost_usd || 0),
        },
        style: {
          backgroundColor: agent.color || AGENT_COLORS[agent.node_id],
          size: Math.max(30, (stats.queued_count || 0) + (stats.active_count || 0) * 3),
        },
      };
    });

    const edges = [];
    agentFlows.forEach((count, key) => {
      const [source, target] = key.split('->');
      edges.push({
        id: `flow-${source}-${target}`,
        source,
        target,
        type: 'task_flow',
        label: `${count} tasks`,
        style: {
          strokeWidth: Math.min(5, count),
        },
      });
    });

    res.json({
      nodes,
      edges,
      summary: {
        total_agents: nodes.length,
        total_flows: edges.length,
        total_workload: (workload || []).reduce((sum, w) =>
          sum + (w.queued_count || 0) + (w.active_count || 0) + (w.blocked_count || 0), 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CONTEXT-GRAPH] GET /graph/agent-network error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// EXECUTION TRACES
// ============================================================================

/**
 * GET /traces
 * Get execution traces for analysis
 */
router.get('/traces', async (req, res) => {
  try {
    const { trace_id, agent, event_type, hours = 24, limit = 500 } = req.query;

    let query = supabase
      .from('monolith_execution_traces')
      .select('*')
      .gte('created_at', new Date(Date.now() - parseInt(hours) * 3600000).toISOString())
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (trace_id) query = query.eq('trace_id', trace_id);
    if (agent) query = query.eq('agent_role', agent);
    if (event_type) query = query.eq('event_type', event_type);

    const { data: traces, error } = await query;
    if (error) throw error;

    // Group by trace
    const traceGroups = {};
    (traces || []).forEach(t => {
      if (!traceGroups[t.trace_id]) {
        traceGroups[t.trace_id] = [];
      }
      traceGroups[t.trace_id].push(t);
    });

    // Sort each group by sequence
    Object.values(traceGroups).forEach(group => {
      group.sort((a, b) => a.sequence_num - b.sequence_num);
    });

    res.json({
      traces: traceGroups,
      raw_events: traces || [],
      summary: {
        trace_count: Object.keys(traceGroups).length,
        event_count: (traces || []).length,
        total_tokens: (traces || []).reduce((sum, t) => sum + (t.tokens_used || 0), 0),
        total_cost: (traces || []).reduce((sum, t) => sum + parseFloat(t.cost_usd || 0), 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CONTEXT-GRAPH] GET /traces error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /traces
 * Record a new execution trace event
 */
router.post('/traces', async (req, res) => {
  try {
    const { trace_id, event_type, task_id, agent_role, event_data, tokens_used, cost_usd, duration_ms } = req.body;

    if (!trace_id || !event_type) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'trace_id and event_type are required',
      });
    }

    // Get next sequence number
    const { data: lastEvent } = await supabase
      .from('monolith_execution_traces')
      .select('sequence_num')
      .eq('trace_id', trace_id)
      .order('sequence_num', { ascending: false })
      .limit(1)
      .single();

    const sequence_num = (lastEvent?.sequence_num || 0) + 1;

    const { data: trace, error } = await supabase
      .from('monolith_execution_traces')
      .insert([{
        trace_id,
        sequence_num,
        event_type,
        task_id,
        agent_role,
        event_data: event_data || {},
        tokens_used: tokens_used || 0,
        cost_usd: cost_usd || 0,
        duration_ms,
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      trace,
    });
  } catch (error) {
    console.error('[CONTEXT-GRAPH] POST /traces error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AGENT CONTEXT
// ============================================================================

/**
 * GET /agents/context
 * Get current context state for all agents
 */
router.get('/agents/context', async (req, res) => {
  try {
    // Get latest snapshot for each agent
    const { data: contexts, error } = await supabase
      .from('monolith_agent_context')
      .select('*')
      .order('snapshot_at', { ascending: false });

    if (error) throw error;

    // Keep only latest per agent
    const latestByAgent = {};
    (contexts || []).forEach(c => {
      if (!latestByAgent[c.agent_role]) {
        latestByAgent[c.agent_role] = c;
      }
    });

    res.json({
      agents: Object.values(latestByAgent),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CONTEXT-GRAPH] GET /agents/context error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /agents/:agentRole/context
 * Update agent context snapshot
 */
router.post('/agents/:agentRole/context', async (req, res) => {
  try {
    const { agentRole } = req.params;
    const { context_tokens, working_memory, recent_outputs } = req.body;

    // Get current task counts
    const { data: stats } = await supabase
      .from('monolith_task_queue')
      .select('status')
      .eq('assigned_agent', agentRole.toLowerCase());

    const pending = (stats || []).filter(s => s.status === 'queued').length;
    const blocked = (stats || []).filter(s => s.status === 'blocked').length;
    const active = (stats || []).filter(s => s.status === 'active').length;

    const { data: context, error } = await supabase
      .from('monolith_agent_context')
      .insert([{
        agent_role: agentRole.toLowerCase(),
        context_tokens: context_tokens || 0,
        context_utilization: context_tokens ? (context_tokens / 128000 * 100) : 0,
        pending_tasks: pending,
        blocked_tasks: blocked,
        working_memory: working_memory || {},
        recent_outputs: recent_outputs || [],
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      context,
    });
  } catch (error) {
    console.error('[CONTEXT-GRAPH] POST /agents/:agentRole/context error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// WORKLOAD VIEWS
// ============================================================================

/**
 * GET /workload
 * Get agent workload distribution
 */
router.get('/workload', async (req, res) => {
  try {
    const { data: workload, error } = await supabase
      .from('v_agent_workload')
      .select('*');

    if (error) throw error;

    // Calculate totals
    const totals = (workload || []).reduce((acc, w) => ({
      queued: acc.queued + (w.queued_count || 0),
      active: acc.active + (w.active_count || 0),
      blocked: acc.blocked + (w.blocked_count || 0),
      completed24h: acc.completed24h + (w.completed_24h || 0),
      tokens: acc.tokens + (parseInt(w.total_tokens_used) || 0),
      cost: acc.cost + (parseFloat(w.total_cost_usd) || 0),
    }), { queued: 0, active: 0, blocked: 0, completed24h: 0, tokens: 0, cost: 0 });

    res.json({
      agents: (workload || []).map(w => ({
        agent: w.assigned_agent,
        agentName: getAgentName(w.assigned_agent),
        queued: w.queued_count || 0,
        active: w.active_count || 0,
        blocked: w.blocked_count || 0,
        completed24h: w.completed_24h || 0,
        tokensUsed: parseInt(w.total_tokens_used) || 0,
        costUsd: parseFloat(w.total_cost_usd) || 0,
        avgPriority: parseFloat(w.avg_priority) || 50,
      })),
      totals,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CONTEXT-GRAPH] GET /workload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /execution-flow
 * Get hourly execution flow metrics
 */
router.get('/execution-flow', async (req, res) => {
  try {
    const { data: flow, error } = await supabase
      .from('v_execution_flow')
      .select('*');

    if (error) throw error;

    res.json({
      flow: flow || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CONTEXT-GRAPH] GET /execution-flow error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// HELPERS
// ============================================================================

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const val = item[key] || 'unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

function getAgentName(role) {
  const names = {
    ceo: 'Chief Executive Officer',
    cfo: 'Chief Financial Officer',
    coo: 'Chief Operating Officer',
    cto: 'Chief Technology Officer',
    cmo: 'Chief Marketing Officer',
    chro: 'Chief Human Resources Officer',
    ciso: 'Chief Information Security Officer',
    clo: 'General Counsel',
    cos: 'Chief of Staff',
    cpo: 'Chief Product Officer',
    devops: 'DevOps Lead',
    qa: 'QA Lead',
    swe: 'Software Engineer',
  };
  return names[role?.toLowerCase()] || role?.toUpperCase() || 'Unknown';
}

export default router;
