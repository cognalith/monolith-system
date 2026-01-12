/**
 * MONOLITH OS - Phase 8: Completed Tasks API
 * Task 8.3.3 - Completed tasks endpoint for CompletedTasksPanel
 * Updated to use real NotebookLM-extracted task data
 */

import express from 'express';
import { getCompletedTasks } from './taskDataLoader.js';
import { ROLES_HIERARCHY } from './rolesRoutes.js';

const router = express.Router();

// Helper to get role full name
function getRoleFullName(roleId) {
  const role = ROLES_HIERARCHY.find(r => r.id === roleId?.toLowerCase());
  return role ? role.fullName : roleId;
}

/**
 * GET /api/tasks/completed-today
 * Returns completed tasks with timestamps and role info
 * Query params: ?role=cpo (filter by role)
 */
router.get('/completed-today', async (req, res) => {
  try {
    const { role } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Get real completed tasks from JSON files
    let completedTasks = getCompletedTasks(role);

    // Transform to expected format
    const tasks = completedTasks.map(t => ({
      id: t.id,
      title: t.content,
      completed_at: t.created_at, // Using created_at as proxy since we don't have completed_at
      completed_by_role: t.assigned_role,
      completed_by_name: getRoleFullName(t.assigned_role) || t.role_name,
      workflow_id: `wf-${(t.workflow || 'unknown').toLowerCase().replace(/\s+/g, '-')}`,
      workflow_name: t.workflow || 'Unknown Workflow'
    }));

    res.json({
      tasks,
      total: tasks.length,
      date: todayStr,
      source: 'notebooklm_json'
    });
  } catch (error) {
    console.error('[TASKS-COMPLETED] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve completed tasks'
    });
  }
});

export default router;
