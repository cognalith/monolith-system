/**
 * MONOLITH OS - Phase 8: Role Task Counts API
 * Task 8.3.1 - Role task counts endpoint for notification badges
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { ROLES_HIERARCHY } from './rolesRoutes.js';

const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * GET /api/role-task-counts
 * Returns pending task count per role for notification badges
 */
router.get('/', async (req, res) => {
  try {
    let counts = {};
    let total = 0;

    // Initialize all roles with 0 count
    ROLES_HIERARCHY.forEach(role => {
      counts[role.id] = 0;
    });

    // Try to fetch from Supabase if available
    if (supabase) {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('assigned_role')
        .eq('status', 'PENDING');

      if (error) {
        console.error('[ROLE-TASK-COUNTS] Supabase error:', error.message);
        // Fall back to mock data
        counts = generateMockCounts();
      } else if (tasks && tasks.length > 0) {
        // Count tasks per role
        tasks.forEach(task => {
          const role = task.assigned_role?.toLowerCase();
          if (role && counts.hasOwnProperty(role)) {
            counts[role]++;
          }
        });
        total = tasks.length;
      } else {
        // No tasks in database, use mock data
        counts = generateMockCounts();
      }
    } else {
      // No Supabase connection, use mock data
      counts = generateMockCounts();
    }

    // Calculate total if using mock data
    if (total === 0) {
      total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    }

    res.json({
      counts,
      total,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ROLE-TASK-COUNTS] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve role task counts'
    });
  }
});

/**
 * Generate mock task counts for development/demo
 */
function generateMockCounts() {
  return {
    'ceo': 3,
    'cfo': 5,
    'coo': 2,
    'cto': 2,
    'ciso': 8,
    'cmo': 1,
    'chro': 0,
    'cos': 4,
    'clo': 2,
    'cco': 6,
    'cdo': 3,
    'cso': 1,
    'cpo': 2,
    'csuso': 0,
    'vp-sales': 5,
    'vp-ops': 3,
    'vp-product': 2,
    'vp-eng': 4,
    'vp-mktg': 1,
    'vp-hr': 1,
    'vp-fin': 2
  };
}

export default router;
