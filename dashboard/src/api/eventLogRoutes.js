/**
 * EVENT LOG API ROUTES - Phase 11
 * Cognalith Inc. | Monolith System
 *
 * Unified event log API for troubleshooting and debugging agent execution.
 * Queries Phase 10 memory tables: conversations, state changes, audits, artifacts.
 *
 * Endpoints:
 * - GET /api/event-log - Unified event stream
 * - GET /api/event-log/agent/:role - Agent-specific events
 * - GET /api/event-log/task/:taskId - Task-specific timeline
 * - GET /api/event-log/memory/:agent - Agent memory state
 * - GET /api/event-log/compression-status - Memory compression stats
 * - POST /api/event-log/compress/:agent - Trigger memory compression
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import MemoryCompressionService from '../../../agents/services/MemoryCompressionService.js';

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

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
    swe: 'Software Engineer',
  };
  return roleNames[roleId] || roleId?.toUpperCase() || 'Unknown';
}

// Helper to merge and sort events from multiple sources
function mergeAndSortEvents(events, limit = 100) {
  return events
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

// Helper to calculate time ago
function getTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// GET /api/event-log - Unified Event Stream
// ============================================================================

/**
 * GET /api/event-log
 * Returns unified event stream from all sources
 * Query params: ?agent=cos&type=task,conversation&hours=24&limit=100
 */
router.get('/', async (req, res) => {
  try {
    const { agent, type, hours = 24, limit = 100 } = req.query;
    const cutoffTime = new Date(Date.now() - parseInt(hours) * 3600000).toISOString();
    const eventLimit = Math.min(parseInt(limit) || 100, 500);

    // Parse event types filter
    const eventTypes = type ? type.split(',') : ['task', 'conversation', 'state_change', 'audit'];

    const events = [];
    const errors = [];

    // Query tasks
    if (eventTypes.includes('task')) {
      try {
        let taskQuery = supabase
          .from('monolith_task_queue')
          .select('id, task_id, title, assigned_agent, status, priority, created_at, started_at, completed_at')
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(eventLimit);

        if (agent) {
          taskQuery = taskQuery.eq('assigned_agent', agent);
        }

        const { data: tasks, error: taskError } = await taskQuery;

        if (taskError) {
          errors.push({ source: 'tasks', error: taskError.message });
        } else {
          (tasks || []).forEach(t => {
            events.push({
              id: `task-${t.id}`,
              type: 'task',
              subtype: t.status,
              agent_role: t.assigned_agent,
              agent_name: getFullRoleName(t.assigned_agent),
              task_id: t.task_id || t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              timestamp: t.created_at,
              time_ago: getTimeAgo(t.created_at),
              metadata: {
                started_at: t.started_at,
                completed_at: t.completed_at,
              },
            });
          });
        }
      } catch (err) {
        errors.push({ source: 'tasks', error: err.message });
      }
    }

    // Query conversations
    if (eventTypes.includes('conversation')) {
      try {
        let convQuery = supabase
          .from('monolith_agent_conversations')
          .select('id, agent_role, conversation_id, task_id, messages, token_count, is_compressed, created_at')
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(eventLimit);

        if (agent) {
          convQuery = convQuery.eq('agent_role', agent);
        }

        const { data: conversations, error: convError } = await convQuery;

        if (convError) {
          if (convError.code !== '42P01') { // Table doesn't exist
            errors.push({ source: 'conversations', error: convError.message });
          }
        } else {
          (conversations || []).forEach(c => {
            // Get message preview
            let messagePreview = '';
            if (c.messages && Array.isArray(c.messages)) {
              const assistantMsg = c.messages.find(m => m.role === 'assistant');
              if (assistantMsg) {
                messagePreview = assistantMsg.content?.substring(0, 200) + (assistantMsg.content?.length > 200 ? '...' : '');
              }
            }

            events.push({
              id: `conv-${c.id}`,
              type: 'conversation',
              subtype: c.is_compressed ? 'compressed' : 'active',
              agent_role: c.agent_role,
              agent_name: getFullRoleName(c.agent_role),
              task_id: c.task_id,
              conversation_id: c.conversation_id,
              token_count: c.token_count,
              is_compressed: c.is_compressed,
              message_preview: messagePreview,
              timestamp: c.created_at,
              time_ago: getTimeAgo(c.created_at),
              metadata: {
                message_count: c.messages?.length || 0,
              },
            });
          });
        }
      } catch (err) {
        errors.push({ source: 'conversations', error: err.message });
      }
    }

    // Query state changes
    if (eventTypes.includes('state_change')) {
      try {
        let stateQuery = supabase
          .from('monolith_task_state_log')
          .select('id, task_id, change_type, old_value, new_value, changed_by, changed_by_type, metadata, created_at')
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(eventLimit);

        if (agent) {
          stateQuery = stateQuery.eq('changed_by', agent);
        }

        const { data: stateChanges, error: stateError } = await stateQuery;

        if (stateError) {
          if (stateError.code !== '42P01') {
            errors.push({ source: 'state_changes', error: stateError.message });
          }
        } else {
          (stateChanges || []).forEach(s => {
            events.push({
              id: `state-${s.id}`,
              type: 'state_change',
              subtype: s.change_type,
              agent_role: s.changed_by,
              agent_name: getFullRoleName(s.changed_by),
              task_id: s.task_id,
              change_type: s.change_type,
              old_value: s.old_value,
              new_value: s.new_value,
              changed_by_type: s.changed_by_type,
              timestamp: s.created_at,
              time_ago: getTimeAgo(s.created_at),
              metadata: s.metadata || {},
            });
          });
        }
      } catch (err) {
        errors.push({ source: 'state_changes', error: err.message });
      }
    }

    // Query audits
    if (eventTypes.includes('audit')) {
      try {
        let auditQuery = supabase
          .from('monolith_task_audits')
          .select('id, task_id, audited_agent, accuracy_score, completeness_score, quality_score, efficiency_score, overall_score, drift_detected, drift_severity, created_at')
          .gte('created_at', cutoffTime)
          .order('created_at', { ascending: false })
          .limit(eventLimit);

        if (agent) {
          auditQuery = auditQuery.eq('audited_agent', agent);
        }

        const { data: audits, error: auditError } = await auditQuery;

        if (auditError) {
          if (auditError.code !== '42P01') {
            errors.push({ source: 'audits', error: auditError.message });
          }
        } else {
          (audits || []).forEach(a => {
            events.push({
              id: `audit-${a.id}`,
              type: 'audit',
              subtype: a.drift_detected ? 'drift_detected' : 'normal',
              agent_role: a.audited_agent,
              agent_name: getFullRoleName(a.audited_agent),
              task_id: a.task_id,
              overall_score: a.overall_score,
              drift_detected: a.drift_detected,
              drift_severity: a.drift_severity,
              timestamp: a.created_at,
              time_ago: getTimeAgo(a.created_at),
              metadata: {
                accuracy: a.accuracy_score,
                completeness: a.completeness_score,
                quality: a.quality_score,
                efficiency: a.efficiency_score,
              },
            });
          });
        }
      } catch (err) {
        errors.push({ source: 'audits', error: err.message });
      }
    }

    // Merge and sort all events
    const sortedEvents = mergeAndSortEvents(events, eventLimit);

    // Calculate summary stats
    const summary = {
      total: sortedEvents.length,
      by_type: {},
      by_agent: {},
    };

    sortedEvents.forEach(e => {
      summary.by_type[e.type] = (summary.by_type[e.type] || 0) + 1;
      if (e.agent_role) {
        summary.by_agent[e.agent_role] = (summary.by_agent[e.agent_role] || 0) + 1;
      }
    });

    res.json({
      events: sortedEvents,
      summary,
      filters: {
        agent: agent || 'all',
        types: eventTypes,
        hours: parseInt(hours),
        limit: eventLimit,
      },
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[EVENT-LOG] unified stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/event-log/agent/:role - Agent-Specific Events
// ============================================================================

/**
 * GET /api/event-log/agent/:role
 * Returns all events for a specific agent
 */
router.get('/agent/:role', async (req, res) => {
  try {
    const { role } = req.params;
    const { hours = 24, limit = 100 } = req.query;
    const cutoffTime = new Date(Date.now() - parseInt(hours) * 3600000).toISOString();
    const eventLimit = Math.min(parseInt(limit) || 100, 500);

    const events = [];
    const errors = [];

    // Query tasks for this agent
    try {
      const { data: tasks, error: taskError } = await supabase
        .from('monolith_task_queue')
        .select('*')
        .eq('assigned_agent', role)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(eventLimit);

      if (taskError && taskError.code !== '42P01') {
        errors.push({ source: 'tasks', error: taskError.message });
      }

      (tasks || []).forEach(t => {
        events.push({
          id: `task-${t.id}`,
          type: 'task',
          subtype: t.status,
          task_id: t.task_id || t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          timestamp: t.created_at,
          time_ago: getTimeAgo(t.created_at),
        });
      });
    } catch (err) {
      errors.push({ source: 'tasks', error: err.message });
    }

    // Query conversations for this agent
    try {
      const { data: conversations, error: convError } = await supabase
        .from('monolith_agent_conversations')
        .select('*')
        .eq('agent_role', role)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(eventLimit);

      if (convError && convError.code !== '42P01') {
        errors.push({ source: 'conversations', error: convError.message });
      }

      (conversations || []).forEach(c => {
        events.push({
          id: `conv-${c.id}`,
          type: 'conversation',
          subtype: c.is_compressed ? 'compressed' : 'active',
          task_id: c.task_id,
          conversation_id: c.conversation_id,
          token_count: c.token_count,
          is_compressed: c.is_compressed,
          timestamp: c.created_at,
          time_ago: getTimeAgo(c.created_at),
        });
      });
    } catch (err) {
      errors.push({ source: 'conversations', error: err.message });
    }

    // Query state changes where this agent is involved
    try {
      const { data: stateChanges, error: stateError } = await supabase
        .from('monolith_task_state_log')
        .select('*')
        .eq('changed_by', role)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(eventLimit);

      if (stateError && stateError.code !== '42P01') {
        errors.push({ source: 'state_changes', error: stateError.message });
      }

      (stateChanges || []).forEach(s => {
        events.push({
          id: `state-${s.id}`,
          type: 'state_change',
          subtype: s.change_type,
          task_id: s.task_id,
          change_type: s.change_type,
          old_value: s.old_value,
          new_value: s.new_value,
          timestamp: s.created_at,
          time_ago: getTimeAgo(s.created_at),
        });
      });
    } catch (err) {
      errors.push({ source: 'state_changes', error: err.message });
    }

    // Query audits for this agent
    try {
      const { data: audits, error: auditError } = await supabase
        .from('monolith_task_audits')
        .select('*')
        .eq('audited_agent', role)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(eventLimit);

      if (auditError && auditError.code !== '42P01') {
        errors.push({ source: 'audits', error: auditError.message });
      }

      (audits || []).forEach(a => {
        events.push({
          id: `audit-${a.id}`,
          type: 'audit',
          subtype: a.drift_detected ? 'drift' : 'normal',
          task_id: a.task_id,
          overall_score: a.overall_score,
          drift_detected: a.drift_detected,
          timestamp: a.created_at,
          time_ago: getTimeAgo(a.created_at),
        });
      });
    } catch (err) {
      errors.push({ source: 'audits', error: err.message });
    }

    // Sort events
    const sortedEvents = mergeAndSortEvents(events, eventLimit);

    res.json({
      agent_role: role,
      agent_name: getFullRoleName(role),
      events: sortedEvents,
      total: sortedEvents.length,
      filters: { hours: parseInt(hours), limit: eventLimit },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[EVENT-LOG] agent events error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/event-log/task/:taskId - Task-Specific Timeline
// ============================================================================

/**
 * GET /api/event-log/task/:taskId
 * Returns complete timeline for a specific task
 */
router.get('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const events = [];
    const errors = [];

    // Get the task itself
    let task = null;
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('monolith_task_queue')
        .select('*')
        .or(`id.eq.${taskId},task_id.eq.${taskId}`)
        .single();

      if (taskError && taskError.code !== 'PGRST116') {
        errors.push({ source: 'task', error: taskError.message });
      }
      task = taskData;
    } catch (err) {
      errors.push({ source: 'task', error: err.message });
    }

    // Get state changes for this task
    try {
      const { data: stateChanges, error: stateError } = await supabase
        .from('monolith_task_state_log')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (stateError && stateError.code !== '42P01') {
        errors.push({ source: 'state_changes', error: stateError.message });
      }

      (stateChanges || []).forEach(s => {
        events.push({
          id: `state-${s.id}`,
          type: 'state_change',
          change_type: s.change_type,
          old_value: s.old_value,
          new_value: s.new_value,
          changed_by: s.changed_by,
          changed_by_type: s.changed_by_type,
          timestamp: s.created_at,
          time_ago: getTimeAgo(s.created_at),
          metadata: s.metadata,
        });
      });
    } catch (err) {
      errors.push({ source: 'state_changes', error: err.message });
    }

    // Get conversations for this task
    try {
      const { data: conversations, error: convError } = await supabase
        .from('monolith_agent_conversations')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (convError && convError.code !== '42P01') {
        errors.push({ source: 'conversations', error: convError.message });
      }

      (conversations || []).forEach(c => {
        events.push({
          id: `conv-${c.id}`,
          type: 'conversation',
          agent_role: c.agent_role,
          agent_name: getFullRoleName(c.agent_role),
          conversation_id: c.conversation_id,
          messages: c.messages,
          token_count: c.token_count,
          is_compressed: c.is_compressed,
          timestamp: c.created_at,
          time_ago: getTimeAgo(c.created_at),
        });
      });
    } catch (err) {
      errors.push({ source: 'conversations', error: err.message });
    }

    // Get audits for this task
    try {
      const { data: audits, error: auditError } = await supabase
        .from('monolith_task_audits')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (auditError && auditError.code !== '42P01') {
        errors.push({ source: 'audits', error: auditError.message });
      }

      (audits || []).forEach(a => {
        events.push({
          id: `audit-${a.id}`,
          type: 'audit',
          audited_agent: a.audited_agent,
          original_request: a.original_request,
          actual_output_summary: a.actual_output_summary,
          estimated_hours: a.estimated_hours,
          actual_hours: a.actual_hours,
          time_variance_percent: a.time_variance_percent,
          accuracy_score: a.accuracy_score,
          completeness_score: a.completeness_score,
          quality_score: a.quality_score,
          efficiency_score: a.efficiency_score,
          overall_score: a.overall_score,
          drift_detected: a.drift_detected,
          drift_severity: a.drift_severity,
          drift_details: a.drift_details,
          timestamp: a.created_at,
          time_ago: getTimeAgo(a.created_at),
        });
      });
    } catch (err) {
      errors.push({ source: 'audits', error: err.message });
    }

    // Get artifacts for this task
    try {
      const { data: artifacts, error: artifactError } = await supabase
        .from('monolith_task_artifacts')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (artifactError && artifactError.code !== '42P01') {
        errors.push({ source: 'artifacts', error: artifactError.message });
      }

      (artifacts || []).forEach(a => {
        events.push({
          id: `artifact-${a.id}`,
          type: 'artifact',
          artifact_type: a.artifact_type,
          content_summary: a.content_summary,
          size_bytes: a.size_bytes,
          version: a.version,
          timestamp: a.created_at,
          time_ago: getTimeAgo(a.created_at),
        });
      });
    } catch (err) {
      errors.push({ source: 'artifacts', error: err.message });
    }

    // Sort events chronologically
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      task_id: taskId,
      task: task ? {
        id: task.id,
        task_id: task.task_id,
        title: task.title,
        assigned_agent: task.assigned_agent,
        status: task.status,
        priority: task.priority,
        created_at: task.created_at,
        started_at: task.started_at,
        completed_at: task.completed_at,
      } : null,
      timeline: events,
      event_count: events.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[EVENT-LOG] task timeline error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/event-log/memory/:agent - Agent Memory State
// ============================================================================

/**
 * GET /api/event-log/memory/:agent
 * Returns memory state for a specific agent
 */
router.get('/memory/:agent', async (req, res) => {
  try {
    const { agent } = req.params;

    // Get conversation counts
    let conversationStats = { total: 0, compressed: 0, active: 0, total_tokens: 0 };
    try {
      const { data: conversations, error: convError } = await supabase
        .from('monolith_agent_conversations')
        .select('id, token_count, is_compressed')
        .eq('agent_role', agent);

      if (convError && convError.code !== '42P01') {
        console.warn('[EVENT-LOG] conversation stats error:', convError.message);
      }

      (conversations || []).forEach(c => {
        conversationStats.total++;
        conversationStats.total_tokens += c.token_count || 0;
        if (c.is_compressed) {
          conversationStats.compressed++;
        } else {
          conversationStats.active++;
        }
      });
    } catch (err) {
      console.warn('[EVENT-LOG] conversation stats error:', err.message);
    }

    // Get knowledge items
    let knowledgeStats = { total: 0, by_domain: {} };
    try {
      const { data: knowledge, error: knowError } = await supabase
        .from('monolith_agent_knowledge')
        .select('id, knowledge_domain, confidence_score')
        .eq('agent_role', agent);

      if (knowError && knowError.code !== '42P01') {
        console.warn('[EVENT-LOG] knowledge stats error:', knowError.message);
      }

      (knowledge || []).forEach(k => {
        knowledgeStats.total++;
        const domain = k.knowledge_domain || 'general';
        knowledgeStats.by_domain[domain] = (knowledgeStats.by_domain[domain] || 0) + 1;
      });
    } catch (err) {
      console.warn('[EVENT-LOG] knowledge stats error:', err.message);
    }

    // Get recent compressions
    let compressions = [];
    try {
      const { data: compData, error: compError } = await supabase
        .from('monolith_memory_compressions')
        .select('*')
        .eq('agent_role', agent)
        .order('created_at', { ascending: false })
        .limit(10);

      if (compError && compError.code !== '42P01') {
        console.warn('[EVENT-LOG] compression stats error:', compError.message);
      }

      compressions = (compData || []).map(c => ({
        id: c.id,
        compression_type: c.compression_type,
        original_tokens: c.original_token_count,
        compressed_tokens: c.compressed_token_count,
        compression_ratio: c.compression_ratio,
        created_at: c.created_at,
        time_ago: getTimeAgo(c.created_at),
      }));
    } catch (err) {
      console.warn('[EVENT-LOG] compression stats error:', err.message);
    }

    // Get recent tasks completed
    let recentTasks = [];
    try {
      const { data: tasks, error: taskError } = await supabase
        .from('monolith_task_queue')
        .select('id, task_id, title, status, completed_at')
        .eq('assigned_agent', agent)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (taskError && taskError.code !== '42P01') {
        console.warn('[EVENT-LOG] recent tasks error:', taskError.message);
      }

      recentTasks = (tasks || []).map(t => ({
        id: t.id,
        task_id: t.task_id,
        title: t.title,
        completed_at: t.completed_at,
        time_ago: getTimeAgo(t.completed_at),
      }));
    } catch (err) {
      console.warn('[EVENT-LOG] recent tasks error:', err.message);
    }

    // Get audit scores
    let auditStats = { count: 0, avg_score: 0, drift_count: 0 };
    try {
      const { data: audits, error: auditError } = await supabase
        .from('monolith_task_audits')
        .select('overall_score, drift_detected')
        .eq('audited_agent', agent);

      if (auditError && auditError.code !== '42P01') {
        console.warn('[EVENT-LOG] audit stats error:', auditError.message);
      }

      const scores = (audits || []).map(a => a.overall_score).filter(s => s !== null);
      auditStats.count = (audits || []).length;
      auditStats.avg_score = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
        : 0;
      auditStats.drift_count = (audits || []).filter(a => a.drift_detected).length;
    } catch (err) {
      console.warn('[EVENT-LOG] audit stats error:', err.message);
    }

    res.json({
      agent_role: agent,
      agent_name: getFullRoleName(agent),
      memory: {
        conversations: conversationStats,
        knowledge: knowledgeStats,
        compressions: compressions,
        audits: auditStats,
      },
      recent_tasks: recentTasks,
      context_estimate: {
        active_tokens: conversationStats.total_tokens - (conversationStats.compressed * 500), // rough estimate
        estimated_utilization: Math.min(100, Math.round((conversationStats.total_tokens / 128000) * 100)),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[EVENT-LOG] agent memory error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/event-log/compression-status - Memory Compression Stats
// ============================================================================

/**
 * GET /api/event-log/compression-status
 * Returns overall memory compression statistics
 */
router.get('/compression-status', async (req, res) => {
  try {
    // Get all agents' conversation stats
    const { data: conversations, error: convError } = await supabase
      .from('monolith_agent_conversations')
      .select('agent_role, token_count, is_compressed');

    if (convError && convError.code !== '42P01') {
      return res.json({
        by_agent: {},
        total: { conversations: 0, tokens: 0, compressed: 0 },
        message: 'Conversations table not yet available',
      });
    }

    // Aggregate by agent
    const byAgent = {};
    let totalConversations = 0;
    let totalTokens = 0;
    let totalCompressed = 0;

    (conversations || []).forEach(c => {
      const agent = c.agent_role;
      if (!byAgent[agent]) {
        byAgent[agent] = {
          role: agent,
          name: getFullRoleName(agent),
          conversations: 0,
          tokens: 0,
          compressed: 0,
          needs_compression: false,
        };
      }
      byAgent[agent].conversations++;
      byAgent[agent].tokens += c.token_count || 0;
      if (c.is_compressed) {
        byAgent[agent].compressed++;
      }
      totalConversations++;
      totalTokens += c.token_count || 0;
      if (c.is_compressed) totalCompressed++;
    });

    // Mark agents that need compression (>50k active tokens)
    Object.values(byAgent).forEach(a => {
      const activeTokens = a.tokens - (a.compressed * 500);
      a.needs_compression = activeTokens > 50000;
      a.active_tokens = activeTokens;
    });

    // Get recent compressions
    let recentCompressions = [];
    try {
      const { data: compData, error: compError } = await supabase
        .from('monolith_memory_compressions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (compError && compError.code !== '42P01') {
        console.warn('[EVENT-LOG] compression history error:', compError.message);
      }

      recentCompressions = (compData || []).map(c => ({
        id: c.id,
        agent_role: c.agent_role,
        compression_type: c.compression_type,
        original_tokens: c.original_token_count,
        compressed_tokens: c.compressed_token_count,
        ratio: c.compression_ratio,
        created_at: c.created_at,
        time_ago: getTimeAgo(c.created_at),
      }));
    } catch (err) {
      console.warn('[EVENT-LOG] compression history error:', err.message);
    }

    res.json({
      by_agent: Object.values(byAgent).sort((a, b) => b.tokens - a.tokens),
      total: {
        conversations: totalConversations,
        tokens: totalTokens,
        compressed: totalCompressed,
        compression_rate: totalConversations > 0
          ? Math.round((totalCompressed / totalConversations) * 100)
          : 0,
      },
      agents_needing_compression: Object.values(byAgent).filter(a => a.needs_compression).map(a => a.role),
      recent_compressions: recentCompressions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[EVENT-LOG] compression status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/event-log/compress/:agent - Trigger Memory Compression
// ============================================================================

/**
 * POST /api/event-log/compress/:agent
 * Triggers memory compression for a specific agent
 * Uses MemoryCompressionService to compress old conversations
 */
router.post('/compress/:agent', async (req, res) => {
  try {
    const { agent } = req.params;
    const { older_than_hours = 24, dry_run = false } = req.body;

    console.log(`[EVENT-LOG] Triggering compression for ${agent} (older than ${older_than_hours}h, dryRun: ${dry_run})`);

    // Initialize compression service
    const compressionService = new MemoryCompressionService({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
    });

    // Run compression for the specified agent
    const result = await compressionService.compressAgentMemory(agent, {
      olderThanHours: parseInt(older_than_hours),
      dryRun: dry_run,
    });

    if (!result.success) {
      return res.status(400).json({
        agent_role: agent,
        agent_name: getFullRoleName(agent),
        status: 'error',
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      agent_role: agent,
      agent_name: getFullRoleName(agent),
      status: result.dryRun ? 'preview' : (result.compressed === false ? 'skipped' : 'completed'),
      message: result.dryRun
        ? `Dry run: Found ${result.conversationsFound} conversations (${result.totalTokens} tokens) to compress`
        : (result.compressed === false
          ? result.reason
          : `Compressed ${result.conversationsCompressed} conversations: ${result.originalTokenCount} → ${result.compressedTokenCount} tokens`),
      result: {
        conversations_found: result.conversationsFound,
        conversations_compressed: result.conversationsCompressed || 0,
        original_tokens: result.originalTokenCount || result.totalTokens || 0,
        compressed_tokens: result.compressedTokenCount || result.estimatedCompressedTokens || 0,
        tokens_saved: result.savedTokens || 0,
        compression_ratio: result.compressionRatio || null,
        compression_record_id: result.compressionRecordId || null,
        dry_run: result.dryRun || false,
      },
      parameters: {
        older_than_hours: parseInt(older_than_hours),
        dry_run: dry_run,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[EVENT-LOG] compress trigger error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
