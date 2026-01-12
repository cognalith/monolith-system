/**
 * MONOLITH OS - Phase 8: Role Task Counts API
 * Task 8.3.1 - Role task counts endpoint for notification badges
 * Updated to use real NotebookLM-extracted task data
 */

import express from 'express';
import { getTaskCountsByRole, getPrioritySummary } from './taskDataLoader.js';
import { ROLES_HIERARCHY } from './rolesRoutes.js';

const router = express.Router();

/**
 * GET /api/role-task-counts
 * Returns pending task count per role for notification badges
 */
router.get('/', async (req, res) => {
  try {
    // Get real task counts from JSON files
    const realCounts = getTaskCountsByRole();
    const prioritySummary = getPrioritySummary();

    // Initialize all roles with 0 count, then overlay real counts
    const counts = {};
    ROLES_HIERARCHY.forEach(role => {
      counts[role.id] = realCounts[role.id] || 0;
    });

    // Add any roles from JSON that aren't in the hierarchy
    for (const [roleId, count] of Object.entries(realCounts)) {
      if (!counts.hasOwnProperty(roleId)) {
        counts[roleId] = count;
      }
    }

    // Calculate total
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    res.json({
      counts,
      total,
      by_priority: prioritySummary,
      updated_at: new Date().toISOString(),
      source: 'notebooklm_json'
    });
  } catch (error) {
    console.error('[ROLE-TASK-COUNTS] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve role task counts'
    });
  }
});

export default router;
