/**
 * MONOLITH OS - Phase 8: Completed Tasks API
 * Task 8.3.3 - Completed tasks endpoint for CompletedTasksPanel
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { ROLES_HIERARCHY } from './rolesRoutes.js';

const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Helper to get role full name
function getRoleFullName(roleId) {
  const role = ROLES_HIERARCHY.find(r => r.id === roleId?.toLowerCase());
  return role ? role.fullName : roleId;
}

/**
 * GET /api/tasks/completed-today
 * Returns today's completed tasks with timestamps and role info
 * Query params: ?role=cpo (filter by role)
 */
router.get('/completed-today', async (req, res) => {
  try {
    const { role } = req.query;
    let tasks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Try to fetch from Supabase if available
    if (supabase) {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, workflows(id, name)')
        .eq('status', 'COMPLETED')
        .gte('updated_at', today.toISOString())
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[TASKS-COMPLETED] Supabase error:', error.message);
        tasks = generateMockCompletedTasks();
      } else if (data && data.length > 0) {
        tasks = data.map(t => ({
          id: t.id,
          title: t.content || t.title,
          completed_at: t.updated_at || t.completed_at,
          completed_by_role: t.assigned_role?.toLowerCase() || 'unknown',
          completed_by_name: getRoleFullName(t.assigned_role),
          workflow_id: t.workflows?.id || t.workflow_id,
          workflow_name: t.workflows?.name || 'Unknown Workflow'
        }));
      } else {
        tasks = generateMockCompletedTasks();
      }
    } else {
      tasks = generateMockCompletedTasks();
    }

    // Filter by role if specified
    if (role) {
      const normalizedRole = role.toLowerCase();
      tasks = tasks.filter(t => t.completed_by_role === normalizedRole);
    }

    res.json({
      tasks,
      total: tasks.length,
      date: todayStr
    });
  } catch (error) {
    console.error('[TASKS-COMPLETED] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve completed tasks'
    });
  }
});

/**
 * Generate mock completed tasks for development/demo
 */
function generateMockCompletedTasks() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  return [
    {
      id: 'task-101',
      title: 'Approve vendor contract',
      completed_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      completed_by_role: 'cpo',
      completed_by_name: 'Chief Procurement Officer',
      workflow_id: 'wf-003',
      workflow_name: 'Vendor Onboarding'
    },
    {
      id: 'task-102',
      title: 'Review quarterly financial report',
      completed_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      completed_by_role: 'cfo',
      completed_by_name: 'Chief Financial Officer',
      workflow_id: 'wf-001',
      workflow_name: 'Q1 Budget Review'
    },
    {
      id: 'task-103',
      title: 'Approve security policy updates',
      completed_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      completed_by_role: 'ciso',
      completed_by_name: 'Chief Information Security Officer',
      workflow_id: 'wf-002',
      workflow_name: 'Security Audit'
    },
    {
      id: 'task-104',
      title: 'Sign off on marketing materials',
      completed_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
      completed_by_role: 'cmo',
      completed_by_name: 'Chief Marketing Officer',
      workflow_id: 'wf-004',
      workflow_name: 'Marketing Campaign Launch'
    },
    {
      id: 'task-105',
      title: 'Review compliance documentation',
      completed_at: new Date(now - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      completed_by_role: 'cco',
      completed_by_name: 'Chief Compliance Officer',
      workflow_id: 'wf-005',
      workflow_name: 'Annual Compliance Review'
    },
    {
      id: 'task-106',
      title: 'Approve budget allocation',
      completed_at: new Date(now - 7 * 60 * 60 * 1000).toISOString(), // 7 hours ago
      completed_by_role: 'cfo',
      completed_by_name: 'Chief Financial Officer',
      workflow_id: 'wf-001',
      workflow_name: 'Q1 Budget Review'
    },
    {
      id: 'task-107',
      title: 'Review hiring proposal',
      completed_at: new Date(now - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
      completed_by_role: 'chro',
      completed_by_name: 'Chief Human Resources Officer',
      workflow_id: 'wf-007',
      workflow_name: 'Talent Acquisition'
    },
    {
      id: 'task-108',
      title: 'Approve strategic initiative',
      completed_at: new Date(now - 9 * 60 * 60 * 1000).toISOString(), // 9 hours ago
      completed_by_role: 'ceo',
      completed_by_name: 'Chief Executive Officer',
      workflow_id: 'wf-006',
      workflow_name: 'Strategic Planning FY2026'
    }
  ];
}

export default router;
