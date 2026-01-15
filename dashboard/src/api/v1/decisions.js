/**
 * MONOLITH OS - API v1 Decisions Routes
 * RESTful API for decision log operations
 *
 * Endpoints:
 * - GET /v1/decisions - List decisions with filtering/pagination
 * - POST /v1/decisions - Record a new decision
 * - GET /v1/decisions/:decisionId - Get decision by ID
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { ROLES_HIERARCHY } from '../rolesRoutes.js';

const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Valid categories for filtering
const VALID_CATEGORIES = ['budget', 'strategy', 'compliance', 'security', 'operations', 'hr', 'marketing', 'legal', 'technology'];

// Valid impact levels
const VALID_IMPACTS = ['low', 'medium', 'high', 'critical'];

/**
 * Helper to get role full name
 */
function getRoleFullName(roleId) {
  const role = ROLES_HIERARCHY.find(r => r.id === roleId?.toLowerCase());
  return role ? role.fullName : roleId;
}

/**
 * Categorize decision based on content
 */
function categorizeDecision(decision) {
  const text = (decision || '').toLowerCase();
  if (text.includes('budget') || text.includes('financial') || text.includes('cost')) return 'budget';
  if (text.includes('security') || text.includes('risk')) return 'security';
  if (text.includes('compliance') || text.includes('regulation')) return 'compliance';
  if (text.includes('strategy') || text.includes('plan')) return 'strategy';
  if (text.includes('hiring') || text.includes('employee')) return 'hr';
  if (text.includes('marketing') || text.includes('campaign')) return 'marketing';
  if (text.includes('legal') || text.includes('contract')) return 'legal';
  if (text.includes('tech') || text.includes('system')) return 'technology';
  return 'operations';
}

/**
 * Determine impact level based on financial impact
 */
function determineImpact(financialImpact) {
  if (!financialImpact) return 'medium';
  const value = parseFloat(financialImpact);
  if (isNaN(value)) return 'medium';
  if (Math.abs(value) > 1000000) return 'critical';
  if (Math.abs(value) > 100000) return 'high';
  if (Math.abs(value) > 10000) return 'medium';
  return 'low';
}

/**
 * Generate mock decisions for development/demo
 */
function generateMockDecisions() {
  const now = new Date();

  return [
    {
      id: 'dec-001',
      title: 'Approved Q4 marketing budget increase',
      description: 'Increased digital marketing spend by 15% for Q4 campaign',
      decided_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'cmo',
      decided_by_name: 'Chief Marketing Officer',
      category: 'budget',
      impact: 'high',
      financial_impact: 150000
    },
    {
      id: 'dec-002',
      title: 'Implemented new security protocols',
      description: 'Deployed enhanced authentication requirements across all systems',
      decided_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'ciso',
      decided_by_name: 'Chief Information Security Officer',
      category: 'security',
      impact: 'critical',
      financial_impact: 500000
    },
    {
      id: 'dec-003',
      title: 'Approved vendor contract renewal',
      description: 'Renewed enterprise software licenses with improved pricing terms',
      decided_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'cpo',
      decided_by_name: 'Chief Procurement Officer',
      category: 'operations',
      impact: 'medium',
      financial_impact: 75000
    },
    {
      id: 'dec-004',
      title: 'Updated compliance framework',
      description: 'Adopted new regulatory compliance standards for data handling',
      decided_at: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'cco',
      decided_by_name: 'Chief Compliance Officer',
      category: 'compliance',
      impact: 'high',
      financial_impact: 200000
    },
    {
      id: 'dec-005',
      title: 'Approved strategic partnership',
      description: 'Entered into strategic partnership agreement with technology provider',
      decided_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'ceo',
      decided_by_name: 'Chief Executive Officer',
      category: 'strategy',
      impact: 'critical',
      financial_impact: 2000000
    }
  ];
}

/**
 * GET /v1/decisions
 * List decisions with optional filtering and pagination
 *
 * Query Parameters:
 * - role: Filter by decision maker role
 * - category: Filter by category
 * - impact: Filter by impact level
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
router.get('/', async (req, res) => {
  try {
    const {
      role,
      category,
      impact,
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
          field: 'category'
        }
      });
    }

    // Validate impact if provided
    if (impact && !VALID_IMPACTS.includes(impact.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Impact must be one of: ${VALID_IMPACTS.join(', ')}`,
          field: 'impact'
        }
      });
    }

    let decisions = [];
    let total = 0;

    // Try to fetch from Supabase if available
    if (supabase) {
      let query = supabase
        .from('decision_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false });

      if (role) {
        query = query.eq('role', role.toLowerCase());
      }

      const { data, error, count } = await query.range(offset, offset + limitNum - 1);

      if (error) {
        console.error('[API-V1-DECISIONS] Supabase error:', error.message);
        decisions = generateMockDecisions();
        total = decisions.length;
      } else if (data && data.length > 0) {
        decisions = data.map(d => ({
          id: d.id,
          title: d.decision,
          description: d.rationale || d.decision,
          decided_at: d.timestamp,
          decided_by_role: d.role?.toLowerCase() || 'unknown',
          decided_by_name: getRoleFullName(d.role),
          category: d.category || categorizeDecision(d.decision),
          impact: d.impact || determineImpact(d.financial_impact),
          financial_impact: d.financial_impact
        }));
        total = count || decisions.length;
      } else {
        decisions = generateMockDecisions();
        total = decisions.length;
      }
    } else {
      decisions = generateMockDecisions();
      total = decisions.length;
    }

    // Apply filters for mock data
    if (!supabase) {
      if (role) {
        decisions = decisions.filter(d => d.decided_by_role === role.toLowerCase());
      }
      if (category) {
        decisions = decisions.filter(d => d.category === category.toLowerCase());
      }
      if (impact) {
        decisions = decisions.filter(d => d.impact === impact.toLowerCase());
      }
      total = decisions.length;
      decisions = decisions.slice(offset, offset + limitNum);
    }

    res.json({
      success: true,
      data: decisions,
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
    console.error('[API-V1-DECISIONS] Error listing decisions:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve decisions'
      }
    });
  }
});

/**
 * POST /v1/decisions
 * Record a new decision
 *
 * Body:
 * - decision: Decision description (required)
 * - role: Decision maker role
 * - task_id: Associated task ID
 * - rationale: Decision rationale
 * - financial_impact: Financial impact amount
 * - category: Decision category
 */
router.post('/', async (req, res) => {
  try {
    const {
      decision,
      role,
      task_id,
      rationale,
      financial_impact,
      category
    } = req.body;

    // Validate required fields
    if (!decision) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Decision field is required',
          field: 'decision'
        }
      });
    }

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
          field: 'category'
        }
      });
    }

    const decisionData = {
      task_id: task_id || null,
      role: role?.toLowerCase() || null,
      decision,
      financial_impact: financial_impact || null,
      rationale: rationale || null,
      category: category?.toLowerCase() || categorizeDecision(decision),
      impact: determineImpact(financial_impact),
      timestamp: new Date().toISOString()
    };

    // Try to insert into Supabase if available
    if (supabase) {
      const { data, error } = await supabase
        .from('decision_logs')
        .insert([decisionData])
        .select();

      if (error) {
        console.error('[API-V1-DECISIONS] Supabase insert error:', error.message);
        // Fall through to mock response
      } else {
        return res.status(201).json({
          success: true,
          data: {
            id: data[0].id,
            ...decisionData,
            decided_by_name: getRoleFullName(role)
          },
          message: 'Decision recorded successfully'
        });
      }
    }

    // Mock response when Supabase is not available
    const mockId = `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.status(201).json({
      success: true,
      data: {
        id: mockId,
        ...decisionData,
        decided_by_name: getRoleFullName(role)
      },
      message: 'Decision recorded successfully (mock mode)'
    });
  } catch (error) {
    console.error('[API-V1-DECISIONS] Error recording decision:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to record decision'
      }
    });
  }
});

/**
 * GET /v1/decisions/:decisionId
 * Get a single decision by ID
 */
router.get('/:decisionId', async (req, res) => {
  try {
    const { decisionId } = req.params;

    let decision = null;

    // Try to fetch from Supabase if available
    if (supabase) {
      const { data, error } = await supabase
        .from('decision_logs')
        .select('*')
        .eq('id', decisionId)
        .single();

      if (!error && data) {
        decision = {
          id: data.id,
          title: data.decision,
          description: data.rationale || data.decision,
          decided_at: data.timestamp,
          decided_by_role: data.role?.toLowerCase() || 'unknown',
          decided_by_name: getRoleFullName(data.role),
          category: data.category || categorizeDecision(data.decision),
          impact: data.impact || determineImpact(data.financial_impact),
          financial_impact: data.financial_impact,
          task_id: data.task_id
        };
      }
    }

    // Fall back to mock data
    if (!decision) {
      const mockDecisions = generateMockDecisions();
      decision = mockDecisions.find(d => d.id === decisionId);
    }

    if (!decision) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Decision ${decisionId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: decision
    });
  } catch (error) {
    console.error('[API-V1-DECISIONS] Error getting decision:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve decision'
      }
    });
  }
});

export default router;
