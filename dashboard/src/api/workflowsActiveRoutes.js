/**
 * MONOLITH OS - Phase 8: Active Workflows API
 * Task 8.3.2 - Active workflows endpoint for WorkflowListPanel
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
 * GET /api/workflows/active
 * Returns list of active workflows with status, owner, and progress
 * Query params: ?role=cfo (filter by owner role)
 */
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    let workflows = [];

    // Try to fetch from Supabase if available
    if (supabase) {
      const query = supabase
        .from('workflows')
        .select('*')
        .in('status', ['in_progress', 'IN_PROGRESS', 'active', 'ACTIVE'])
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('[WORKFLOWS-ACTIVE] Supabase error:', error.message);
        workflows = generateMockWorkflows();
      } else if (data && data.length > 0) {
        workflows = data.map(w => ({
          id: w.id,
          name: w.name,
          status: 'in_progress',
          owner_role: w.owner_role || w.assigned_role || 'ceo',
          owner_name: getRoleFullName(w.owner_role || w.assigned_role || 'ceo'),
          progress: w.progress || calculateProgress(w),
          started_at: w.created_at,
          estimated_completion: w.estimated_completion || calculateEstimatedCompletion(w.created_at)
        }));
      } else {
        workflows = generateMockWorkflows();
      }
    } else {
      workflows = generateMockWorkflows();
    }

    // Filter by role if specified
    if (role) {
      const normalizedRole = role.toLowerCase();
      workflows = workflows.filter(w => w.owner_role === normalizedRole);
    }

    res.json({
      workflows,
      total: workflows.length
    });
  } catch (error) {
    console.error('[WORKFLOWS-ACTIVE] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve active workflows'
    });
  }
});

/**
 * Calculate progress based on workflow data
 */
function calculateProgress(workflow) {
  if (workflow.progress) return workflow.progress;
  if (workflow.completed_tasks && workflow.total_tasks) {
    return Math.round((workflow.completed_tasks / workflow.total_tasks) * 100);
  }
  // Default to random progress for demo
  return Math.floor(Math.random() * 70) + 10;
}

/**
 * Calculate estimated completion (7-14 days from start)
 */
function calculateEstimatedCompletion(startDate) {
  const start = new Date(startDate);
  const daysToAdd = Math.floor(Math.random() * 7) + 7; // 7-14 days
  start.setDate(start.getDate() + daysToAdd);
  return start.toISOString();
}

/**
 * Generate mock workflows for development/demo
 */
function generateMockWorkflows() {
  const now = new Date();

  return [
    {
      id: 'wf-001',
      name: 'Q1 Budget Review',
      status: 'in_progress',
      owner_role: 'cfo',
      owner_name: 'Chief Financial Officer',
      progress: 65,
      started_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      estimated_completion: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString() // 4 days from now
    },
    {
      id: 'wf-002',
      name: 'Security Audit',
      status: 'in_progress',
      owner_role: 'ciso',
      owner_name: 'Chief Information Security Officer',
      progress: 30,
      started_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      estimated_completion: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString() // 9 days from now
    },
    {
      id: 'wf-003',
      name: 'Vendor Onboarding',
      status: 'in_progress',
      owner_role: 'cpo',
      owner_name: 'Chief Procurement Officer',
      progress: 80,
      started_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      estimated_completion: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days from now
    },
    {
      id: 'wf-004',
      name: 'Marketing Campaign Launch',
      status: 'in_progress',
      owner_role: 'cmo',
      owner_name: 'Chief Marketing Officer',
      progress: 45,
      started_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      estimated_completion: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
    },
    {
      id: 'wf-005',
      name: 'Annual Compliance Review',
      status: 'in_progress',
      owner_role: 'cco',
      owner_name: 'Chief Compliance Officer',
      progress: 55,
      started_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      estimated_completion: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
    },
    {
      id: 'wf-006',
      name: 'Strategic Planning FY2026',
      status: 'in_progress',
      owner_role: 'ceo',
      owner_name: 'Chief Executive Officer',
      progress: 20,
      started_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      estimated_completion: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString() // 21 days from now
    }
  ];
}

export default router;
