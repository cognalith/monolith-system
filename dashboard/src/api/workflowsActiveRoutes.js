/**
 * MONOLITH OS - Phase 8: Active Workflows API
 * Task 8.3.2 - Active workflows endpoint for WorkflowListPanel
 * Updated to use real NotebookLM-extracted task data
 */

import express from 'express';
import { getActiveWorkflows } from './taskDataLoader.js';
import { ROLES_HIERARCHY } from './rolesRoutes.js';

const router = express.Router();

// Helper to get role full name
function getRoleFullName(roleId) {
  const role = ROLES_HIERARCHY.find(r => r.id === roleId?.toLowerCase());
  return role ? role.fullName : roleId;
}

/**
 * GET /api/workflows/active
 * Returns list of active workflows with status, owner, and progress
 * Query params: ?role=cfo (filter by owner role)
 */
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;

    // Get real workflows from JSON files
    let workflows = getActiveWorkflows(role);

    // Enrich with role names
    workflows = workflows.map(wf => ({
      ...wf,
      owner_name: getRoleFullName(wf.owner_role) || wf.owner_name
    }));

    res.json({
      workflows,
      total: workflows.length,
      source: 'notebooklm_json'
    });
  } catch (error) {
    console.error('[WORKFLOWS-ACTIVE] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve active workflows'
    });
  }
});

export default router;
