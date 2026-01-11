/**
 * MONOLITH OS - Phase 8: Decisions API
 * Task 8.3.4 - Decision log endpoint for DecisionLogPanel
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

// Valid categories for filtering
const VALID_CATEGORIES = ['budget', 'strategy', 'compliance', 'security', 'operations', 'hr', 'marketing', 'legal', 'technology'];

// Valid impact levels
const VALID_IMPACTS = ['low', 'medium', 'high', 'critical'];

/**
 * GET /api/decisions
 * Returns decision history with pagination and filtering
 * Query params: ?role=cmo&page=1&per_page=20&category=budget&impact=high
 */
router.get('/', async (req, res) => {
  try {
    const { role, page = 1, per_page = 20, category, impact } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(per_page, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    let decisions = [];
    let total = 0;

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid category parameter',
        message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    // Validate impact if provided
    if (impact && !VALID_IMPACTS.includes(impact.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid impact parameter',
        message: `Impact must be one of: ${VALID_IMPACTS.join(', ')}`
      });
    }

    // Try to fetch from Supabase if available
    if (supabase) {
      let query = supabase
        .from('decision_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false });

      // Apply filters
      if (role) {
        query = query.eq('role', role.toLowerCase());
      }

      const { data, error, count } = await query.range(offset, offset + perPage - 1);

      if (error) {
        console.error('[DECISIONS] Supabase error:', error.message);
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
          impact: d.impact || determineImpact(d.financial_impact)
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

    // Apply role filter if specified (for mock data)
    if (role && !supabase) {
      const normalizedRole = role.toLowerCase();
      decisions = decisions.filter(d => d.decided_by_role === normalizedRole);
      total = decisions.length;
    }

    // Apply category filter if specified (for mock data)
    if (category && !supabase) {
      const normalizedCategory = category.toLowerCase();
      decisions = decisions.filter(d => d.category === normalizedCategory);
      total = decisions.length;
    }

    // Apply impact filter if specified (for mock data)
    if (impact && !supabase) {
      const normalizedImpact = impact.toLowerCase();
      decisions = decisions.filter(d => d.impact === normalizedImpact);
      total = decisions.length;
    }

    // Apply pagination for mock data
    if (!supabase) {
      decisions = decisions.slice(offset, offset + perPage);
    }

    res.json({
      decisions,
      total,
      page: pageNum,
      per_page: perPage
    });
  } catch (error) {
    console.error('[DECISIONS] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve decisions'
    });
  }
});

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
      impact: 'high'
    },
    {
      id: 'dec-002',
      title: 'Implemented new security protocols',
      description: 'Deployed enhanced authentication requirements across all systems',
      decided_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'ciso',
      decided_by_name: 'Chief Information Security Officer',
      category: 'security',
      impact: 'critical'
    },
    {
      id: 'dec-003',
      title: 'Approved vendor contract renewal',
      description: 'Renewed enterprise software licenses with improved pricing terms',
      decided_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'cpo',
      decided_by_name: 'Chief Procurement Officer',
      category: 'operations',
      impact: 'medium'
    },
    {
      id: 'dec-004',
      title: 'Updated compliance framework',
      description: 'Adopted new regulatory compliance standards for data handling',
      decided_at: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'cco',
      decided_by_name: 'Chief Compliance Officer',
      category: 'compliance',
      impact: 'high'
    },
    {
      id: 'dec-005',
      title: 'Approved strategic partnership',
      description: 'Entered into strategic partnership agreement with technology provider',
      decided_at: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'ceo',
      decided_by_name: 'Chief Executive Officer',
      category: 'strategy',
      impact: 'critical'
    },
    {
      id: 'dec-006',
      title: 'Approved hiring plan for Q2',
      description: 'Authorized headcount increase of 15 positions in engineering',
      decided_at: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'chro',
      decided_by_name: 'Chief Human Resources Officer',
      category: 'hr',
      impact: 'high'
    },
    {
      id: 'dec-007',
      title: 'Revised annual budget projections',
      description: 'Updated FY2026 budget projections based on Q1 performance',
      decided_at: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'cfo',
      decided_by_name: 'Chief Financial Officer',
      category: 'budget',
      impact: 'critical'
    },
    {
      id: 'dec-008',
      title: 'Approved technology infrastructure upgrade',
      description: 'Authorized cloud infrastructure migration and modernization project',
      decided_at: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'cto',
      decided_by_name: 'Chief Technology Officer',
      category: 'technology',
      impact: 'high'
    },
    {
      id: 'dec-009',
      title: 'Legal review of partnership terms',
      description: 'Completed legal review and approved partnership agreement terms',
      decided_at: new Date(now - 60 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'clo',
      decided_by_name: 'General Counsel',
      category: 'legal',
      impact: 'medium'
    },
    {
      id: 'dec-010',
      title: 'Sustainability initiative approval',
      description: 'Approved carbon neutrality initiative for manufacturing operations',
      decided_at: new Date(now - 72 * 60 * 60 * 1000).toISOString(),
      decided_by_role: 'csuso',
      decided_by_name: 'Chief Sustainability Officer',
      category: 'operations',
      impact: 'high'
    }
  ];
}

export default router;
