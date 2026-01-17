/**
 * MONOLITH OS - Phase 7: Orchestration API Routes
 * Task Queue Management, CEO Decisions, and System Status
 *
 * Provides endpoints for:
 * - Task management (CRUD, queues, blocking)
 * - CEO decision workflow
 * - System health and throughput metrics
 *
 * Tables used:
 * - monolith_task_queue
 * - monolith_task_dependencies
 * - monolith_ceo_decisions
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Valid task statuses
const VALID_STATUSES = ['pending', 'queued', 'active', 'blocked', 'completed', 'failed', 'cancelled'];

// Valid priorities (string to integer mapping)
const PRIORITY_MAP = {
  low: 25,
  medium: 50,
  high: 75,
  critical: 100,
};
const VALID_PRIORITIES = Object.keys(PRIORITY_MAP);

// Generate human-readable task ID
function generateTaskId() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TASK-${dateStr}-${random}`;
}

// Valid decision choices
const VALID_DECISION_CHOICES = ['approve', 'reject', 'modify', 'escalate'];

// Helper to get full role name
function getRoleFullName(roleId) {
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
  return roleNames[roleId?.toLowerCase()] || roleId?.toUpperCase() || 'Unknown';
}

// ============================================================================
// TASK MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /tasks
 * Create a new task in the queue
 * Body: { title, description, assigned_agent, assigned_team, priority, tags, deliverables }
 */
router.post('/tasks', async (req, res) => {
  try {
    const { title, description, assigned_agent, assigned_team, priority, tags, deliverables } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title is required',
      });
    }

    // Validate priority if provided
    if (priority && !VALID_PRIORITIES.includes(priority.toLowerCase())) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`,
      });
    }

    // Build task object - convert string priority to integer
    const priorityInt = priority
      ? PRIORITY_MAP[priority.toLowerCase()] || 50
      : 50;

    const taskData = {
      task_id: generateTaskId(),
      title,
      description: description || null,
      assigned_agent: assigned_agent?.toLowerCase() || null,
      assigned_team: assigned_team?.toLowerCase() || null,
      priority: priorityInt,
      tags: tags || [],
      deliverables: deliverables || [],
      status: 'queued',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: task, error } = await supabase
      .from('monolith_task_queue')
      .insert([taskData])
      .select()
      .single();

    if (error) throw error;

    console.log(`[ORCHESTRATION] Task created: ${task.id} - ${title}`);

    res.status(201).json({
      success: true,
      task: {
        ...task,
        assigned_agent_name: getRoleFullName(task.assigned_agent),
      },
    });
  } catch (error) {
    console.error('[ORCHESTRATION] POST /tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tasks
 * List tasks with optional filters
 * Query params: ?status=active&agent=cos&team=technology&limit=50
 */
router.get('/tasks', async (req, res) => {
  try {
    const { status, agent, team, limit = 50 } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    let query = supabase
      .from('monolith_task_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limitNum);

    // Apply filters
    if (status) {
      if (!VALID_STATUSES.includes(status.toLowerCase())) {
        return res.status(400).json({
          error: 'Validation Error',
          message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
      query = query.eq('status', status.toLowerCase());
    }

    if (agent) {
      query = query.eq('assigned_agent', agent.toLowerCase());
    }

    if (team) {
      query = query.eq('assigned_team', team.toLowerCase());
    }

    const { data: tasks, error } = await query;

    if (error) throw error;

    res.json({
      tasks: (tasks || []).map(task => ({
        ...task,
        assigned_agent_name: getRoleFullName(task.assigned_agent),
      })),
      total: (tasks || []).length,
      filters: { status, agent, team, limit: limitNum },
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tasks/blocked
 * Get all blocked tasks
 * NOTE: This route must be defined BEFORE /tasks/:id to avoid matching "blocked" as an ID
 */
router.get('/tasks/blocked', async (req, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from('monolith_task_queue')
      .select('*')
      .eq('status', 'blocked')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Get dependencies for blocked tasks
    const taskIds = (tasks || []).map(t => t.id);
    let dependencies = [];

    if (taskIds.length > 0) {
      const { data: deps, error: depError } = await supabase
        .from('monolith_task_dependencies')
        .select('*')
        .in('task_id', taskIds)
        .eq('resolved', false);

      if (depError) console.warn('[ORCHESTRATION] Dependencies query error:', depError.message);
      dependencies = deps || [];
    }

    // Enrich tasks with dependencies
    const enrichedTasks = (tasks || []).map(task => ({
      ...task,
      assigned_agent_name: getRoleFullName(task.assigned_agent),
      blocking_dependencies: dependencies.filter(d => d.task_id === task.id),
    }));

    res.json({
      tasks: enrichedTasks,
      total: enrichedTasks.length,
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /tasks/blocked error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tasks/active
 * Get all active tasks
 * NOTE: This route must be defined BEFORE /tasks/:id to avoid matching "active" as an ID
 */
router.get('/tasks/active', async (req, res) => {
  try {
    const { data: tasks, error } = await supabase
      .from('monolith_task_queue')
      .select('*')
      .eq('status', 'active')
      .order('started_at', { ascending: true });

    if (error) throw error;

    res.json({
      tasks: (tasks || []).map(task => ({
        ...task,
        assigned_agent_name: getRoleFullName(task.assigned_agent),
        duration_minutes: task.started_at
          ? Math.round((Date.now() - new Date(task.started_at).getTime()) / 60000)
          : null,
      })),
      total: (tasks || []).length,
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /tasks/active error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tasks/queue/:agentRole
 * Get an agent's task queue
 * NOTE: This route must be defined BEFORE /tasks/:id to avoid matching "queue" as an ID
 */
router.get('/tasks/queue/:agentRole', async (req, res) => {
  try {
    const { agentRole } = req.params;
    const normalizedRole = agentRole.toLowerCase();

    // Get queued and active tasks for this agent
    const { data: tasks, error } = await supabase
      .from('monolith_task_queue')
      .select('*')
      .eq('assigned_agent', normalizedRole)
      .in('status', ['queued', 'active', 'blocked'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Separate by status
    const queue = {
      active: (tasks || []).filter(t => t.status === 'active'),
      queued: (tasks || []).filter(t => t.status === 'queued'),
      blocked: (tasks || []).filter(t => t.status === 'blocked'),
    };

    res.json({
      agent_role: normalizedRole,
      agent_name: getRoleFullName(normalizedRole),
      queue,
      total: (tasks || []).length,
      active_count: queue.active.length,
      queued_count: queue.queued.length,
      blocked_count: queue.blocked.length,
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /tasks/queue/:agentRole error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tasks/:id
 * Get a specific task by ID
 */
router.get('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: task, error } = await supabase
      .from('monolith_task_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Not Found',
          message: `Task '${id}' not found`,
        });
      }
      throw error;
    }

    // Get dependencies for this task
    const { data: dependencies, error: depError } = await supabase
      .from('monolith_task_dependencies')
      .select('*')
      .eq('task_id', id);

    if (depError) console.warn('[ORCHESTRATION] Dependencies query error:', depError.message);

    res.json({
      task: {
        ...task,
        assigned_agent_name: getRoleFullName(task.assigned_agent),
        dependencies: dependencies || [],
      },
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /tasks/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /tasks/:id
 * Update a task
 */
router.patch('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate status if provided
    if (updates.status && !VALID_STATUSES.includes(updates.status.toLowerCase())) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    // Validate priority if provided
    if (updates.priority && !VALID_PRIORITIES.includes(updates.priority.toLowerCase())) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`,
      });
    }

    // Normalize values
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.status) updateData.status = updates.status.toLowerCase();
    if (updates.priority) updateData.priority = PRIORITY_MAP[updates.priority.toLowerCase()] || 50;
    if (updates.assigned_agent) updateData.assigned_agent = updates.assigned_agent.toLowerCase();
    if (updates.assigned_team) updateData.assigned_team = updates.assigned_team.toLowerCase();

    // Track completion
    if (updateData.status === 'completed' && !updates.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: task, error } = await supabase
      .from('monolith_task_queue')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Not Found',
          message: `Task '${id}' not found`,
        });
      }
      throw error;
    }

    console.log(`[ORCHESTRATION] Task ${id} updated: ${JSON.stringify(updates)}`);

    res.json({
      success: true,
      task: {
        ...task,
        assigned_agent_name: getRoleFullName(task.assigned_agent),
      },
    });
  } catch (error) {
    console.error('[ORCHESTRATION] PATCH /tasks/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /tasks/:id
 * Cancel/delete a task
 */
router.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First check if task exists
    const { data: existing, error: checkError } = await supabase
      .from('monolith_task_queue')
      .select('id, status')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Not Found',
          message: `Task '${id}' not found`,
        });
      }
      throw checkError;
    }

    // Soft delete by setting status to cancelled
    const { data: task, error } = await supabase
      .from('monolith_task_queue')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[ORCHESTRATION] Task ${id} cancelled`);

    res.json({
      success: true,
      message: `Task '${id}' has been cancelled`,
      task,
    });
  } catch (error) {
    console.error('[ORCHESTRATION] DELETE /tasks/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CEO DECISIONS ENDPOINTS
// ============================================================================

/**
 * GET /decisions
 * List pending CEO decisions
 */
router.get('/decisions', async (req, res) => {
  try {
    const { status = 'pending', limit = 50 } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    let query = supabase
      .from('monolith_ceo_decisions')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limitNum);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: decisions, error } = await query;

    if (error) throw error;

    res.json({
      decisions: (decisions || []).map(d => ({
        ...d,
        requesting_agent_name: getRoleFullName(d.requesting_agent),
        delegate_to_name: d.delegate_to ? getRoleFullName(d.delegate_to) : null,
      })),
      total: (decisions || []).length,
      filter_status: status,
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /decisions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /decisions/:id
 * Get decision details
 */
router.get('/decisions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: decision, error } = await supabase
      .from('monolith_ceo_decisions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Not Found',
          message: `Decision '${id}' not found`,
        });
      }
      throw error;
    }

    // Get related task if exists
    let relatedTask = null;
    if (decision.task_id) {
      const { data: task, error: taskError } = await supabase
        .from('monolith_task_queue')
        .select('id, title, status, assigned_agent')
        .eq('id', decision.task_id)
        .single();

      if (!taskError && task) {
        relatedTask = {
          ...task,
          assigned_agent_name: getRoleFullName(task.assigned_agent),
        };
      }
    }

    res.json({
      decision: {
        ...decision,
        requesting_agent_name: getRoleFullName(decision.requesting_agent),
        delegate_to_name: decision.delegate_to ? getRoleFullName(decision.delegate_to) : null,
      },
      related_task: relatedTask,
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /decisions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /decisions/:id/decide
 * Submit Frank's decision
 * Body: { choice, notes }
 */
router.post('/decisions/:id/decide', async (req, res) => {
  try {
    const { id } = req.params;
    const { choice, notes } = req.body;

    // Validate choice
    if (!choice || !VALID_DECISION_CHOICES.includes(choice.toLowerCase())) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Choice must be one of: ${VALID_DECISION_CHOICES.join(', ')}`,
      });
    }

    // Get current decision
    const { data: existing, error: checkError } = await supabase
      .from('monolith_ceo_decisions')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Not Found',
          message: `Decision '${id}' not found`,
        });
      }
      throw checkError;
    }

    if (existing.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid State',
        message: `Decision is already ${existing.status}`,
      });
    }

    // Update decision
    const { data: decision, error } = await supabase
      .from('monolith_ceo_decisions')
      .update({
        status: 'decided',
        choice: choice.toLowerCase(),
        decision_notes: notes || null,
        decided_at: new Date().toISOString(),
        decided_by: 'frank',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[ORCHESTRATION] CEO Decision ${id}: ${choice.toUpperCase()}`);

    res.json({
      success: true,
      decision: {
        ...decision,
        requesting_agent_name: getRoleFullName(decision.requesting_agent),
      },
    });
  } catch (error) {
    console.error('[ORCHESTRATION] POST /decisions/:id/decide error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /decisions/:id/defer
 * Defer a decision
 */
router.post('/decisions/:id/defer', async (req, res) => {
  try {
    const { id } = req.params;
    const { defer_until, reason } = req.body;

    // Get current decision
    const { data: existing, error: checkError } = await supabase
      .from('monolith_ceo_decisions')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Not Found',
          message: `Decision '${id}' not found`,
        });
      }
      throw checkError;
    }

    if (existing.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid State',
        message: `Decision is already ${existing.status}`,
      });
    }

    // Update decision
    const { data: decision, error } = await supabase
      .from('monolith_ceo_decisions')
      .update({
        status: 'deferred',
        defer_until: defer_until || null,
        defer_reason: reason || null,
        deferred_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[ORCHESTRATION] CEO Decision ${id}: DEFERRED`);

    res.json({
      success: true,
      decision: {
        ...decision,
        requesting_agent_name: getRoleFullName(decision.requesting_agent),
      },
    });
  } catch (error) {
    console.error('[ORCHESTRATION] POST /decisions/:id/defer error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /decisions/:id/delegate
 * Delegate a decision to another agent
 * Body: { delegate_to }
 */
router.post('/decisions/:id/delegate', async (req, res) => {
  try {
    const { id } = req.params;
    const { delegate_to } = req.body;

    if (!delegate_to) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'delegate_to is required',
      });
    }

    // Get current decision
    const { data: existing, error: checkError } = await supabase
      .from('monolith_ceo_decisions')
      .select('*')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Not Found',
          message: `Decision '${id}' not found`,
        });
      }
      throw checkError;
    }

    if (existing.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid State',
        message: `Decision is already ${existing.status}`,
      });
    }

    // Update decision
    const { data: decision, error } = await supabase
      .from('monolith_ceo_decisions')
      .update({
        status: 'delegated',
        delegate_to: delegate_to.toLowerCase(),
        delegated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[ORCHESTRATION] CEO Decision ${id}: DELEGATED to ${delegate_to}`);

    res.json({
      success: true,
      decision: {
        ...decision,
        requesting_agent_name: getRoleFullName(decision.requesting_agent),
        delegate_to_name: getRoleFullName(decision.delegate_to),
      },
    });
  } catch (error) {
    console.error('[ORCHESTRATION] POST /decisions/:id/delegate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SYSTEM STATUS ENDPOINTS
// ============================================================================

/**
 * GET /health
 * System health metrics
 */
router.get('/health', async (req, res) => {
  try {
    // Get task counts by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('monolith_task_queue')
      .select('status');

    if (statusError) throw statusError;

    // Count by status
    const counts = {
      queued: 0,
      active: 0,
      blocked: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      pending: 0,
    };

    (statusCounts || []).forEach(t => {
      if (counts.hasOwnProperty(t.status)) {
        counts[t.status]++;
      }
    });

    // Get pending CEO decisions count
    const { data: pendingDecisions, error: decisionError } = await supabase
      .from('monolith_ceo_decisions')
      .select('id')
      .eq('status', 'pending');

    if (decisionError) console.warn('[ORCHESTRATION] Decision count error:', decisionError.message);

    // Get today's completed tasks for throughput
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: completedToday, error: completedError } = await supabase
      .from('monolith_task_queue')
      .select('id, completed_at, started_at')
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString());

    if (completedError) console.warn('[ORCHESTRATION] Completed today error:', completedError.message);

    // Calculate average completion time
    let avgCompletionMinutes = 0;
    const completedTasks = completedToday || [];
    if (completedTasks.length > 0) {
      const durations = completedTasks
        .filter(t => t.started_at && t.completed_at)
        .map(t => (new Date(t.completed_at) - new Date(t.started_at)) / 60000);

      if (durations.length > 0) {
        avgCompletionMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      }
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      task_counts: counts,
      total_tasks: (statusCounts || []).length,
      pending_decisions: (pendingDecisions || []).length,
      throughput: {
        completed_today: completedTasks.length,
        avg_completion_minutes: avgCompletionMinutes,
      },
      summary: {
        queued: counts.queued,
        active: counts.active,
        blocked: counts.blocked,
      },
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /health error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /agents
 * All agents' work status
 */
router.get('/agents', async (req, res) => {
  try {
    // Get all tasks grouped by agent
    const { data: tasks, error: taskError } = await supabase
      .from('monolith_task_queue')
      .select('assigned_agent, status, started_at, title, id')
      .in('status', ['queued', 'active', 'blocked']);

    if (taskError) throw taskError;

    // Define all agent roles
    const agentRoles = [
      'ceo', 'cfo', 'coo', 'cto', 'cmo', 'chro', 'ciso', 'clo',
      'cos', 'cco', 'cpo', 'cro', 'devops', 'data', 'qa'
    ];

    // Build status for each agent
    const agentStatus = agentRoles.map(role => {
      const agentTasks = (tasks || []).filter(t => t.assigned_agent === role);
      const activeTasks = agentTasks.filter(t => t.status === 'active');
      const queuedTasks = agentTasks.filter(t => t.status === 'queued');
      const blockedTasks = agentTasks.filter(t => t.status === 'blocked');

      return {
        role,
        name: getRoleFullName(role),
        active_task: activeTasks.length > 0 ? {
          id: activeTasks[0].id,
          title: activeTasks[0].title,
          started_at: activeTasks[0].started_at,
          duration_minutes: activeTasks[0].started_at
            ? Math.round((Date.now() - new Date(activeTasks[0].started_at).getTime()) / 60000)
            : null,
        } : null,
        queue_depth: queuedTasks.length,
        blocked_count: blockedTasks.length,
        status: activeTasks.length > 0 ? 'working' : queuedTasks.length > 0 ? 'ready' : 'idle',
      };
    });

    // Summary counts
    const summary = {
      working: agentStatus.filter(a => a.status === 'working').length,
      ready: agentStatus.filter(a => a.status === 'ready').length,
      idle: agentStatus.filter(a => a.status === 'idle').length,
      total_queued: agentStatus.reduce((sum, a) => sum + a.queue_depth, 0),
      total_blocked: agentStatus.reduce((sum, a) => sum + a.blocked_count, 0),
    };

    res.json({
      agents: agentStatus,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /agents error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// BULK IMPORT ENDPOINTS
// ============================================================================

/**
 * POST /tasks/bulk
 * Bulk import tasks into the queue
 * Body: { tasks: [{ title, description, assigned_agent, assigned_team, priority, tags, deliverables, status }] }
 */
router.post('/tasks/bulk', async (req, res) => {
  try {
    const { tasks } = req.body;

    // Validate input
    if (!Array.isArray(tasks)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request body must contain a "tasks" array',
      });
    }

    if (tasks.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Tasks array cannot be empty',
      });
    }

    if (tasks.length > 100) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Maximum 100 tasks per bulk import',
      });
    }

    const results = {
      success_count: 0,
      error_count: 0,
      errors: [],
      inserted_ids: [],
    };

    // Validate and prepare tasks
    const validTasks = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      // Validate required fields
      if (!task.title) {
        results.error_count++;
        results.errors.push({
          index: i,
          error: 'Title is required',
          task: task,
        });
        continue;
      }

      // Validate status if provided
      if (task.status && !VALID_STATUSES.includes(task.status.toLowerCase())) {
        results.error_count++;
        results.errors.push({
          index: i,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
          task: task,
        });
        continue;
      }

      // Validate priority if provided
      if (task.priority && typeof task.priority === 'string' && !VALID_PRIORITIES.includes(task.priority.toLowerCase())) {
        results.error_count++;
        results.errors.push({
          index: i,
          error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
          task: task,
        });
        continue;
      }

      // Build task object - handle both string and integer priorities
      let priorityInt = 50;
      if (task.priority) {
        if (typeof task.priority === 'number') {
          priorityInt = task.priority;
        } else if (typeof task.priority === 'string') {
          priorityInt = PRIORITY_MAP[task.priority.toLowerCase()] || 50;
        }
      }

      const taskData = {
        task_id: task.task_id || generateTaskId(),
        title: task.title,
        description: task.description || null,
        assigned_agent: task.assigned_agent?.toLowerCase() || null,
        assigned_team: task.assigned_team?.toLowerCase() || null,
        priority: priorityInt,
        tags: task.tags || [],
        deliverables: task.deliverables || [],
        status: task.status?.toLowerCase() || 'queued',
        created_at: task.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Include optional fields if provided
      if (task.started_at) taskData.started_at = task.started_at;
      if (task.completed_at) taskData.completed_at = task.completed_at;
      if (task.due_date) taskData.due_date = task.due_date;
      if (task.parent_task_id) taskData.parent_task_id = task.parent_task_id;
      if (task.source_system) taskData.source_system = task.source_system;
      if (task.external_id) taskData.external_id = task.external_id;

      validTasks.push({ index: i, data: taskData });
    }

    // Batch insert valid tasks
    if (validTasks.length > 0) {
      const { data: insertedTasks, error } = await supabase
        .from('monolith_task_queue')
        .insert(validTasks.map(t => t.data))
        .select();

      if (error) {
        // If batch insert fails, try individual inserts
        console.warn('[ORCHESTRATION] Bulk insert failed, trying individual inserts:', error.message);

        for (const validTask of validTasks) {
          const { data: singleTask, error: singleError } = await supabase
            .from('monolith_task_queue')
            .insert([validTask.data])
            .select()
            .single();

          if (singleError) {
            results.error_count++;
            results.errors.push({
              index: validTask.index,
              error: singleError.message,
              task: tasks[validTask.index],
            });
          } else {
            results.success_count++;
            results.inserted_ids.push(singleTask.id);
          }
        }
      } else {
        results.success_count = (insertedTasks || []).length;
        results.inserted_ids = (insertedTasks || []).map(t => t.id);
      }
    }

    console.log(`[ORCHESTRATION] Bulk import: ${results.success_count} success, ${results.error_count} errors`);

    res.status(results.error_count > 0 && results.success_count === 0 ? 400 : 201).json({
      success: results.success_count > 0,
      ...results,
      total_submitted: tasks.length,
    });
  } catch (error) {
    console.error('[ORCHESTRATION] POST /tasks/bulk error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /dependencies/bulk
 * Bulk import task dependencies
 * Body: { dependencies: [{ task_id, depends_on_task_id, dependency_type }] }
 */
router.post('/dependencies/bulk', async (req, res) => {
  try {
    const { dependencies } = req.body;

    // Validate input
    if (!Array.isArray(dependencies)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request body must contain a "dependencies" array',
      });
    }

    if (dependencies.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Dependencies array cannot be empty',
      });
    }

    if (dependencies.length > 500) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Maximum 500 dependencies per bulk import',
      });
    }

    const validDependencyTypes = ['blocks', 'soft', 'sequential'];

    const results = {
      success_count: 0,
      error_count: 0,
      errors: [],
      inserted_ids: [],
    };

    // Validate and prepare dependencies
    const validDeps = [];
    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i];

      // Validate required fields
      if (!dep.task_id) {
        results.error_count++;
        results.errors.push({
          index: i,
          error: 'task_id is required',
          dependency: dep,
        });
        continue;
      }

      if (!dep.depends_on_task_id) {
        results.error_count++;
        results.errors.push({
          index: i,
          error: 'depends_on_task_id is required',
          dependency: dep,
        });
        continue;
      }

      // Validate dependency type if provided
      const depType = dep.dependency_type?.toLowerCase() || 'blocks';
      if (!validDependencyTypes.includes(depType)) {
        results.error_count++;
        results.errors.push({
          index: i,
          error: `Invalid dependency_type. Must be one of: ${validDependencyTypes.join(', ')}`,
          dependency: dep,
        });
        continue;
      }

      const depData = {
        task_id: dep.task_id,
        depends_on_task_id: dep.depends_on_task_id,
        dependency_type: depType,
        resolved: dep.resolved || false,
        created_at: new Date().toISOString(),
      };

      validDeps.push({ index: i, data: depData });
    }

    // Batch insert valid dependencies
    if (validDeps.length > 0) {
      const { data: insertedDeps, error } = await supabase
        .from('monolith_task_dependencies')
        .insert(validDeps.map(d => d.data))
        .select();

      if (error) {
        // If batch insert fails, try individual inserts
        console.warn('[ORCHESTRATION] Bulk dependency insert failed, trying individual inserts:', error.message);

        for (const validDep of validDeps) {
          const { data: singleDep, error: singleError } = await supabase
            .from('monolith_task_dependencies')
            .insert([validDep.data])
            .select()
            .single();

          if (singleError) {
            results.error_count++;
            results.errors.push({
              index: validDep.index,
              error: singleError.message,
              dependency: dependencies[validDep.index],
            });
          } else {
            results.success_count++;
            results.inserted_ids.push(singleDep.id);
          }
        }
      } else {
        results.success_count = (insertedDeps || []).length;
        results.inserted_ids = (insertedDeps || []).map(d => d.id);
      }
    }

    console.log(`[ORCHESTRATION] Bulk dependency import: ${results.success_count} success, ${results.error_count} errors`);

    res.status(results.error_count > 0 && results.success_count === 0 ? 400 : 201).json({
      success: results.success_count > 0,
      ...results,
      total_submitted: dependencies.length,
    });
  } catch (error) {
    console.error('[ORCHESTRATION] POST /dependencies/bulk error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /migration/status
 * Get migration statistics
 * Returns count of migrated tasks, dependencies, and orphaned dependencies
 */
router.get('/migration/status', async (req, res) => {
  try {
    // Get total task count
    const { data: tasks, error: taskError } = await supabase
      .from('monolith_task_queue')
      .select('id, status, source_system, created_at');

    if (taskError) throw taskError;

    const allTasks = tasks || [];
    const taskIds = new Set(allTasks.map(t => t.id));

    // Get dependency count
    const { data: dependencies, error: depError } = await supabase
      .from('monolith_task_dependencies')
      .select('id, task_id, depends_on_task_id, resolved');

    if (depError) throw depError;

    const allDeps = dependencies || [];

    // Find orphaned dependencies (where task_id or depends_on_task_id doesn't exist in tasks)
    const orphanedDeps = allDeps.filter(dep =>
      !taskIds.has(dep.task_id) || !taskIds.has(dep.depends_on_task_id)
    );

    // Count tasks by source system (for migration tracking)
    const bySourceSystem = {};
    allTasks.forEach(task => {
      const source = task.source_system || 'native';
      if (!bySourceSystem[source]) {
        bySourceSystem[source] = 0;
      }
      bySourceSystem[source]++;
    });

    // Count tasks by status
    const byStatus = {};
    allTasks.forEach(task => {
      if (!byStatus[task.status]) {
        byStatus[task.status] = 0;
      }
      byStatus[task.status]++;
    });

    // Count resolved vs unresolved dependencies
    const resolvedDeps = allDeps.filter(d => d.resolved).length;
    const unresolvedDeps = allDeps.filter(d => !d.resolved).length;

    // Get oldest and newest task dates
    const sortedTasks = [...allTasks].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );
    const oldestTask = sortedTasks.length > 0 ? sortedTasks[0].created_at : null;
    const newestTask = sortedTasks.length > 0 ? sortedTasks[sortedTasks.length - 1].created_at : null;

    res.json({
      migration_status: 'complete',
      timestamp: new Date().toISOString(),
      tasks: {
        total: allTasks.length,
        by_status: byStatus,
        by_source_system: bySourceSystem,
        oldest_created: oldestTask,
        newest_created: newestTask,
      },
      dependencies: {
        total: allDeps.length,
        resolved: resolvedDeps,
        unresolved: unresolvedDeps,
        orphaned_count: orphanedDeps.length,
        orphaned_dependencies: orphanedDeps.map(d => ({
          id: d.id,
          task_id: d.task_id,
          depends_on_task_id: d.depends_on_task_id,
          task_exists: taskIds.has(d.task_id),
          depends_on_exists: taskIds.has(d.depends_on_task_id),
        })),
      },
      health: {
        has_orphaned_dependencies: orphanedDeps.length > 0,
        dependency_integrity: orphanedDeps.length === 0 ? 'healthy' : 'needs_cleanup',
      },
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /migration/status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// THROUGHPUT ENDPOINTS
// ============================================================================

/**
 * GET /throughput
 * Throughput metrics
 */
router.get('/throughput', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = Math.min(30, Math.max(1, parseInt(days, 10) || 7));

    // Get completed tasks for the period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    startDate.setHours(0, 0, 0, 0);

    const { data: completedTasks, error } = await supabase
      .from('monolith_task_queue')
      .select('id, completed_at, started_at, assigned_agent, priority')
      .eq('status', 'completed')
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: true });

    if (error) throw error;

    const tasks = completedTasks || [];

    // Calculate metrics
    const totalCompleted = tasks.length;
    const completedPerDay = totalCompleted / daysNum;

    // Average completion time
    let avgCompletionMinutes = 0;
    const durations = tasks
      .filter(t => t.started_at && t.completed_at)
      .map(t => (new Date(t.completed_at) - new Date(t.started_at)) / 60000);

    if (durations.length > 0) {
      avgCompletionMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }

    // By agent breakdown
    const byAgent = {};
    tasks.forEach(t => {
      if (!byAgent[t.assigned_agent]) {
        byAgent[t.assigned_agent] = { count: 0, durations: [] };
      }
      byAgent[t.assigned_agent].count++;
      if (t.started_at && t.completed_at) {
        byAgent[t.assigned_agent].durations.push(
          (new Date(t.completed_at) - new Date(t.started_at)) / 60000
        );
      }
    });

    const agentMetrics = Object.entries(byAgent).map(([agent, data]) => ({
      agent,
      agent_name: getRoleFullName(agent),
      completed: data.count,
      avg_completion_minutes: data.durations.length > 0
        ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
        : 0,
    })).sort((a, b) => b.completed - a.completed);

    // By priority breakdown (priority stored as integer: 25=low, 50=medium, 75=high, 100=critical)
    const byPriority = {
      critical: tasks.filter(t => t.priority === 100).length,
      high: tasks.filter(t => t.priority === 75).length,
      medium: tasks.filter(t => t.priority === 50).length,
      low: tasks.filter(t => t.priority === 25).length,
    };

    // Daily breakdown
    const dailyBreakdown = [];
    for (let i = 0; i < daysNum; i++) {
      const dayStart = new Date();
      dayStart.setDate(dayStart.getDate() - (daysNum - 1 - i));
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTasks = tasks.filter(t => {
        const completedAt = new Date(t.completed_at);
        return completedAt >= dayStart && completedAt <= dayEnd;
      });

      dailyBreakdown.push({
        date: dayStart.toISOString().split('T')[0],
        completed: dayTasks.length,
      });
    }

    res.json({
      period_days: daysNum,
      total_completed: totalCompleted,
      completed_per_day: Math.round(completedPerDay * 10) / 10,
      avg_completion_minutes: avgCompletionMinutes,
      by_agent: agentMetrics,
      by_priority: byPriority,
      daily_breakdown: dailyBreakdown,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /throughput error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TOKEN TRACKING ENDPOINTS
// ============================================================================

/**
 * GET /tokens/stats
 * Get system-wide token usage statistics
 */
router.get('/tokens/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = Math.min(30, Math.max(1, parseInt(days, 10) || 7));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get agent token stats
    const { data: agentStats, error: statsError } = await supabase
      .from('monolith_agent_token_stats')
      .select('*')
      .gte('stats_date', startDate.toISOString().split('T')[0]);

    if (statsError) {
      // Table might not exist yet
      if (statsError.code === '42P01') {
        return res.json({
          period_days: daysNum,
          total_tokens: 0,
          total_cost_usd: 0,
          total_tasks: 0,
          by_agent: [],
          message: 'Token tracking tables not yet created. Run migration 009_token_tracking.sql'
        });
      }
      throw statsError;
    }

    // Aggregate stats
    const byAgent = {};
    let totalTokens = 0;
    let totalCost = 0;
    let totalTasks = 0;

    (agentStats || []).forEach(row => {
      if (!byAgent[row.agent_role]) {
        byAgent[row.agent_role] = {
          tokens_used: 0,
          cost_usd: 0,
          tasks_executed: 0,
          tasks_completed: 0,
          llm_calls: 0,
        };
      }
      byAgent[row.agent_role].tokens_used += row.total_tokens_used || 0;
      byAgent[row.agent_role].cost_usd += parseFloat(row.total_cost_usd || 0);
      byAgent[row.agent_role].tasks_executed += row.tasks_executed || 0;
      byAgent[row.agent_role].tasks_completed += row.tasks_completed || 0;
      byAgent[row.agent_role].llm_calls += row.total_llm_calls || 0;

      totalTokens += row.total_tokens_used || 0;
      totalCost += parseFloat(row.total_cost_usd || 0);
      totalTasks += row.tasks_executed || 0;
    });

    // Convert to array and add names
    const agentMetrics = Object.entries(byAgent).map(([agent, data]) => ({
      agent,
      agent_name: getRoleFullName(agent),
      ...data,
      avg_tokens_per_task: data.tasks_executed > 0
        ? Math.round(data.tokens_used / data.tasks_executed)
        : 0,
    })).sort((a, b) => b.tokens_used - a.tokens_used);

    res.json({
      period_days: daysNum,
      total_tokens: totalTokens,
      total_cost_usd: totalCost.toFixed(6),
      total_tasks: totalTasks,
      avg_tokens_per_task: totalTasks > 0 ? Math.round(totalTokens / totalTasks) : 0,
      avg_cost_per_task: totalTasks > 0 ? (totalCost / totalTasks).toFixed(6) : '0.000000',
      by_agent: agentMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /tokens/stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tokens/agent/:agentRole
 * Get token usage for a specific agent
 */
router.get('/tokens/agent/:agentRole', async (req, res) => {
  try {
    const { agentRole } = req.params;
    const { days = 7 } = req.query;
    const daysNum = Math.min(30, Math.max(1, parseInt(days, 10) || 7));
    const normalizedRole = agentRole.toLowerCase();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Get agent stats
    const { data: stats, error: statsError } = await supabase
      .from('monolith_agent_token_stats')
      .select('*')
      .eq('agent_role', normalizedRole)
      .gte('stats_date', startDate.toISOString().split('T')[0])
      .order('stats_date', { ascending: false });

    if (statsError && statsError.code !== '42P01') {
      throw statsError;
    }

    // Get recent token usage log
    const { data: usageLogs, error: logError } = await supabase
      .from('monolith_token_usage_log')
      .select('*')
      .eq('agent_role', normalizedRole)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (logError && logError.code !== '42P01') {
      console.warn('[ORCHESTRATION] Token log query error:', logError.message);
    }

    // Aggregate totals
    const totals = (stats || []).reduce((acc, day) => ({
      tasks_executed: acc.tasks_executed + (day.tasks_executed || 0),
      tasks_completed: acc.tasks_completed + (day.tasks_completed || 0),
      tasks_failed: acc.tasks_failed + (day.tasks_failed || 0),
      tokens_estimated: acc.tokens_estimated + (day.total_tokens_estimated || 0),
      tokens_used: acc.tokens_used + (day.total_tokens_used || 0),
      llm_calls: acc.llm_calls + (day.total_llm_calls || 0),
      cost_usd: acc.cost_usd + parseFloat(day.total_cost_usd || 0),
    }), {
      tasks_executed: 0,
      tasks_completed: 0,
      tasks_failed: 0,
      tokens_estimated: 0,
      tokens_used: 0,
      llm_calls: 0,
      cost_usd: 0,
    });

    // Calculate efficiency
    const estimationAccuracy = totals.tokens_estimated > 0
      ? Math.round((totals.tokens_used / totals.tokens_estimated) * 100)
      : 100;

    res.json({
      agent_role: normalizedRole,
      agent_name: getRoleFullName(normalizedRole),
      period_days: daysNum,
      totals: {
        ...totals,
        cost_usd: totals.cost_usd.toFixed(6),
        avg_tokens_per_task: totals.tasks_executed > 0
          ? Math.round(totals.tokens_used / totals.tasks_executed)
          : 0,
      },
      estimation_accuracy: `${estimationAccuracy}%`,
      daily_breakdown: (stats || []).map(s => ({
        date: s.stats_date,
        tokens_used: s.total_tokens_used,
        tasks_executed: s.tasks_executed,
        cost_usd: s.total_cost_usd,
      })),
      recent_calls: (usageLogs || []).slice(0, 20).map(log => ({
        id: log.id,
        model: log.model,
        tokens_input: log.tokens_input,
        tokens_output: log.tokens_output,
        tokens_total: log.tokens_total,
        cost_usd: log.cost_usd,
        call_type: log.call_type,
        latency_ms: log.latency_ms,
        created_at: log.created_at,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /tokens/agent/:agentRole error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /tokens/tasks
 * Get token usage for tasks
 */
router.get('/tokens/tasks', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    // Get tasks with token data
    const { data: tasks, error } = await supabase
      .from('monolith_task_queue')
      .select('id, task_id, title, assigned_agent, status, tokens_estimated, tokens_input, tokens_output, tokens_total, llm_calls, execution_cost_usd, model_used, completed_at')
      .gt('tokens_total', 0)
      .order('tokens_total', { ascending: false })
      .limit(limitNum);

    if (error) throw error;

    res.json({
      tasks: (tasks || []).map(t => ({
        ...t,
        assigned_agent_name: getRoleFullName(t.assigned_agent),
        estimation_accuracy: t.tokens_estimated > 0
          ? `${Math.round((t.tokens_total / t.tokens_estimated) * 100)}%`
          : 'N/A',
      })),
      total: (tasks || []).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[ORCHESTRATION] GET /tokens/tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /execute/:agentRole
 * Trigger task execution for an agent (manual trigger)
 * This starts the agent executor for the next queued task
 */
router.post('/execute/:agentRole', async (req, res) => {
  try {
    const { agentRole } = req.params;
    const normalizedRole = agentRole.toLowerCase();

    // Get the next queued task for this agent
    const { data: task, error: taskError } = await supabase
      .from('monolith_task_queue')
      .select('*')
      .eq('assigned_agent', normalizedRole)
      .eq('status', 'queued')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (taskError) {
      if (taskError.code === 'PGRST116') {
        return res.json({
          success: false,
          message: `No queued tasks for agent ${normalizedRole}`,
          agent_role: normalizedRole,
        });
      }
      throw taskError;
    }

    // Mark task as active
    const { data: activeTask, error: updateError } = await supabase
      .from('monolith_task_queue')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log(`[ORCHESTRATION] Started execution for ${normalizedRole}: ${task.title}`);

    // Note: In production, this would trigger the actual AgentExecutor
    // For now, we just mark it as started and return the task info

    res.json({
      success: true,
      message: `Task execution started for ${normalizedRole}`,
      agent_role: normalizedRole,
      agent_name: getRoleFullName(normalizedRole),
      task: {
        ...activeTask,
        assigned_agent_name: getRoleFullName(activeTask.assigned_agent),
      },
      note: 'Task marked as active. AgentExecutor integration pending.',
    });
  } catch (error) {
    console.error('[ORCHESTRATION] POST /execute/:agentRole error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
