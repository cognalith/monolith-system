/**
 * MONOLITH OS - API v1 Workflows Routes
 * RESTful API for workflow management operations
 *
 * Endpoints:
 * - GET /v1/workflows - List all workflows
 * - POST /v1/workflows - Create a new workflow
 * - GET /v1/workflows/:workflowId - Get workflow by ID
 * - PATCH /v1/workflows/:workflowId - Update workflow
 * - GET /v1/workflows/active - Get active workflows
 */

import express from 'express';
import { getActiveWorkflows } from '../taskDataLoader.js';
import { ROLES_HIERARCHY } from '../rolesRoutes.js';

const router = express.Router();

// In-memory workflow store (in production, use database)
const workflowStore = new Map();

/**
 * Helper to get role full name
 */
function getRoleFullName(roleId) {
  const role = ROLES_HIERARCHY.find(r => r.id === roleId?.toLowerCase());
  return role ? role.fullName : roleId;
}

/**
 * Valid workflow statuses
 */
const VALID_STATUSES = ['active', 'paused', 'completed', 'cancelled', 'draft'];

/**
 * Valid workflow types
 */
const VALID_TYPES = ['operational', 'strategic', 'compliance', 'hr', 'financial', 'technical'];

/**
 * Generate mock workflows for development/demo
 */
function generateMockWorkflows() {
  const now = new Date();

  return [
    {
      id: 'wf-001',
      name: 'Q4 Strategic Planning',
      description: 'Quarterly strategic planning and budget allocation',
      status: 'active',
      type: 'strategic',
      owner_role: 'ceo',
      owner_name: 'Chief Executive Officer',
      progress: 65,
      start_date: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      target_date: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      tasks_total: 12,
      tasks_completed: 8,
      created_at: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'wf-002',
      name: 'Security Audit 2026',
      description: 'Annual security audit and compliance review',
      status: 'active',
      type: 'compliance',
      owner_role: 'ciso',
      owner_name: 'Chief Information Security Officer',
      progress: 40,
      start_date: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
      target_date: new Date(now + 45 * 24 * 60 * 60 * 1000).toISOString(),
      tasks_total: 20,
      tasks_completed: 8,
      created_at: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'wf-003',
      name: 'Employee Onboarding Process',
      description: 'Standardized onboarding workflow for new hires',
      status: 'active',
      type: 'hr',
      owner_role: 'chro',
      owner_name: 'Chief Human Resources Officer',
      progress: 100,
      start_date: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(),
      target_date: null,
      tasks_total: 15,
      tasks_completed: 15,
      created_at: new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'wf-004',
      name: 'Budget Review FY2026',
      description: 'Annual budget review and reallocation',
      status: 'active',
      type: 'financial',
      owner_role: 'cfo',
      owner_name: 'Chief Financial Officer',
      progress: 25,
      start_date: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      target_date: new Date(now + 21 * 24 * 60 * 60 * 1000).toISOString(),
      tasks_total: 8,
      tasks_completed: 2,
      created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'wf-005',
      name: 'Cloud Migration Phase 2',
      description: 'Infrastructure migration to cloud platform',
      status: 'paused',
      type: 'technical',
      owner_role: 'cto',
      owner_name: 'Chief Technology Officer',
      progress: 50,
      start_date: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(),
      target_date: new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(),
      tasks_total: 25,
      tasks_completed: 12,
      created_at: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
}

// Initialize mock workflows
generateMockWorkflows().forEach(wf => workflowStore.set(wf.id, wf));

/**
 * GET /v1/workflows
 * List workflows with optional filtering and pagination
 *
 * Query Parameters:
 * - status: Filter by status
 * - type: Filter by workflow type
 * - owner_role: Filter by owner role
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      type,
      owner_role,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
          field: 'status'
        }
      });
    }

    // Validate type if provided
    if (type && !VALID_TYPES.includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Type must be one of: ${VALID_TYPES.join(', ')}`,
          field: 'type'
        }
      });
    }

    // Get real workflows from task data
    let workflows = getActiveWorkflows(owner_role);

    // Merge with stored workflows
    const storedWorkflows = Array.from(workflowStore.values());
    const mergedWorkflows = [...workflows];

    // Add stored workflows that aren't in the real data
    storedWorkflows.forEach(sw => {
      if (!workflows.find(w => w.id === sw.id)) {
        mergedWorkflows.push(sw);
      }
    });

    workflows = mergedWorkflows;

    // Apply filters
    if (status) {
      workflows = workflows.filter(w => w.status?.toLowerCase() === status.toLowerCase());
    }

    if (type) {
      workflows = workflows.filter(w => w.type?.toLowerCase() === type.toLowerCase());
    }

    if (owner_role) {
      workflows = workflows.filter(w => w.owner_role?.toLowerCase() === owner_role.toLowerCase());
    }

    // Sort by created_at descending
    workflows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const total = workflows.length;

    // Apply pagination
    workflows = workflows.slice(offset, offset + limitNum);

    // Enrich with role names
    workflows = workflows.map(wf => ({
      ...wf,
      owner_name: getRoleFullName(wf.owner_role) || wf.owner_name
    }));

    res.json({
      success: true,
      data: workflows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: offset + limitNum < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('[API-V1-WORKFLOWS] Error listing workflows:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve workflows'
      }
    });
  }
});

/**
 * GET /v1/workflows/active
 * Get active workflows only
 */
router.get('/active', async (req, res) => {
  try {
    const { owner_role } = req.query;

    let workflows = getActiveWorkflows(owner_role);

    // Enrich with role names
    workflows = workflows.map(wf => ({
      ...wf,
      owner_name: getRoleFullName(wf.owner_role) || wf.owner_name
    }));

    res.json({
      success: true,
      data: workflows,
      total: workflows.length
    });
  } catch (error) {
    console.error('[API-V1-WORKFLOWS] Error getting active workflows:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve active workflows'
      }
    });
  }
});

/**
 * POST /v1/workflows
 * Create a new workflow
 *
 * Body:
 * - name: Workflow name (required)
 * - description: Workflow description
 * - type: Workflow type
 * - owner_role: Owner role (required)
 * - target_date: Target completion date
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      type = 'operational',
      owner_role,
      target_date
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Workflow name is required',
          field: 'name'
        }
      });
    }

    if (!owner_role) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Owner role is required',
          field: 'owner_role'
        }
      });
    }

    // Validate type
    if (!VALID_TYPES.includes(type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Type must be one of: ${VALID_TYPES.join(', ')}`,
          field: 'type'
        }
      });
    }

    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const workflow = {
      id: workflowId,
      name,
      description: description || '',
      status: 'draft',
      type: type.toLowerCase(),
      owner_role: owner_role.toLowerCase(),
      owner_name: getRoleFullName(owner_role),
      progress: 0,
      start_date: null,
      target_date: target_date || null,
      tasks_total: 0,
      tasks_completed: 0,
      created_at: now,
      updated_at: now
    };

    workflowStore.set(workflowId, workflow);

    res.status(201).json({
      success: true,
      data: workflow,
      message: `Workflow ${workflowId} created successfully`
    });
  } catch (error) {
    console.error('[API-V1-WORKFLOWS] Error creating workflow:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create workflow'
      }
    });
  }
});

/**
 * GET /v1/workflows/:workflowId
 * Get a single workflow by ID
 */
router.get('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;

    // Check stored workflows
    let workflow = workflowStore.get(workflowId);

    // Check active workflows from task data
    if (!workflow) {
      const activeWorkflows = getActiveWorkflows();
      workflow = activeWorkflows.find(w => w.id === workflowId);
    }

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Workflow ${workflowId} not found`
        }
      });
    }

    // Enrich with role name
    workflow = {
      ...workflow,
      owner_name: getRoleFullName(workflow.owner_role) || workflow.owner_name
    };

    res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    console.error('[API-V1-WORKFLOWS] Error getting workflow:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve workflow'
      }
    });
  }
});

/**
 * PATCH /v1/workflows/:workflowId
 * Update a workflow
 *
 * Body (all optional):
 * - name: Updated name
 * - description: Updated description
 * - status: Updated status
 * - target_date: Updated target date
 */
router.patch('/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { name, description, status, target_date } = req.body;

    let workflow = workflowStore.get(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Workflow ${workflowId} not found`
        }
      });
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Status must be one of: ${VALID_STATUSES.join(', ')}`,
          field: 'status'
        }
      });
    }

    // Apply updates
    if (name) workflow.name = name;
    if (description !== undefined) workflow.description = description;
    if (status) {
      workflow.status = status.toLowerCase();
      // Set start_date when workflow becomes active
      if (status.toLowerCase() === 'active' && !workflow.start_date) {
        workflow.start_date = new Date().toISOString();
      }
    }
    if (target_date !== undefined) workflow.target_date = target_date;
    workflow.updated_at = new Date().toISOString();

    workflowStore.set(workflowId, workflow);

    res.json({
      success: true,
      data: workflow,
      message: `Workflow ${workflowId} updated successfully`
    });
  } catch (error) {
    console.error('[API-V1-WORKFLOWS] Error updating workflow:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update workflow'
      }
    });
  }
});

export default router;
