/**
 * MONOLITH OS - Phase 8: Role Hierarchy API
 * Task 8.3.6 - Role hierarchy endpoint
 */

import express from 'express';

const router = express.Router();

// Role hierarchy configuration with abbreviations, full names, tiers, and ranks
// Updated to include all NotebookLM-extracted roles
const ROLES_HIERARCHY = [
  // Tier 1: C-Suite Executives
  { id: 'ceo', abbr: 'CEO', fullName: 'Chief Executive Officer', tier: 1, rank: 1 },
  { id: 'cfo', abbr: 'CFO', fullName: 'Chief Financial Officer', tier: 1, rank: 2 },
  { id: 'coo', abbr: 'COO', fullName: 'Chief Operating Officer', tier: 1, rank: 3 },
  { id: 'cto', abbr: 'CTO', fullName: 'Chief Technology Officer', tier: 1, rank: 4 },
  { id: 'ciso', abbr: 'CISO', fullName: 'Chief Information Security Officer', tier: 1, rank: 5 },
  { id: 'cmo', abbr: 'CMO', fullName: 'Chief Marketing Officer', tier: 1, rank: 6 },
  { id: 'chro', abbr: 'CHRO', fullName: 'Chief Human Resources Officer', tier: 1, rank: 7 },

  // Tier 2: Chiefs
  { id: 'cos', abbr: 'CoS', fullName: 'Chief of Staff', tier: 2, rank: 8 },
  { id: 'clo', abbr: 'CLO', fullName: 'General Counsel', tier: 2, rank: 9 },
  { id: 'cco', abbr: 'CCO', fullName: 'Chief Compliance Officer', tier: 2, rank: 10 },
  { id: 'cpo', abbr: 'CPO', fullName: 'Chief Product Officer', tier: 2, rank: 11 },
  { id: 'cro', abbr: 'CRO', fullName: 'Chief Revenue Officer', tier: 2, rank: 12 },
  { id: 'cdo', abbr: 'CDO', fullName: 'Chief Data Officer', tier: 2, rank: 13 },
  { id: 'cso', abbr: 'CSO', fullName: 'Chief Strategy Officer', tier: 2, rank: 14 },
  { id: 'csuso', abbr: 'CSusO', fullName: 'Chief Sustainability Officer', tier: 2, rank: 15 },

  // Tier 3: Vice Presidents
  { id: 'vp-employer-branding', abbr: 'VP-EB', fullName: 'VP of Employer Branding', tier: 3, rank: 16 },
  { id: 'vp-sales', abbr: 'VP-Sales', fullName: 'VP of Sales', tier: 3, rank: 17 },
  { id: 'vp-ops', abbr: 'VP-Ops', fullName: 'VP of Operations', tier: 3, rank: 18 },
  { id: 'vp-product', abbr: 'VP-Product', fullName: 'VP of Product', tier: 3, rank: 19 },
  { id: 'vp-eng', abbr: 'VP-Eng', fullName: 'VP of Engineering', tier: 3, rank: 20 },
  { id: 'vp-mktg', abbr: 'VP-Mktg', fullName: 'VP of Marketing', tier: 3, rank: 21 },
  { id: 'vp-hr', abbr: 'VP-HR', fullName: 'VP of Human Resources', tier: 3, rank: 22 },
  { id: 'vp-fin', abbr: 'VP-Fin', fullName: 'VP of Finance', tier: 3, rank: 23 },

  // Tier 4: Directors
  { id: 'dir-communications', abbr: 'Dir-Comms', fullName: 'Director of Communications', tier: 4, rank: 24 },
  { id: 'dir-learning-dev', abbr: 'Dir-L&D', fullName: 'Director of Learning & Development', tier: 4, rank: 25 },
  { id: 'dir-sales', abbr: 'Dir-Sales', fullName: 'Director of Sales', tier: 4, rank: 26 },
  { id: 'dir-ops', abbr: 'Dir-Ops', fullName: 'Director of Operations', tier: 4, rank: 27 },
  { id: 'dir-product', abbr: 'Dir-Product', fullName: 'Director of Product', tier: 4, rank: 28 },
  { id: 'dir-eng', abbr: 'Dir-Eng', fullName: 'Director of Engineering', tier: 4, rank: 29 },
  { id: 'dir-mktg', abbr: 'Dir-Mktg', fullName: 'Director of Marketing', tier: 4, rank: 30 },
  { id: 'dir-hr', abbr: 'Dir-HR', fullName: 'Director of HR', tier: 4, rank: 31 },
  { id: 'dir-fin', abbr: 'Dir-Fin', fullName: 'Director of Finance', tier: 4, rank: 32 },

  // Tier 5: Leads & Specialists
  { id: 'head-cs', abbr: 'Head-CS', fullName: 'Head of Customer Success', tier: 5, rank: 33 },
  { id: 'devops-lead', abbr: 'DevOps', fullName: 'DevOps & Infrastructure Lead', tier: 5, rank: 34 },
  { id: 'qa-lead', abbr: 'QA', fullName: 'QA Lead', tier: 5, rank: 35 },
  { id: 'lead-web-designer', abbr: 'Lead-Web', fullName: 'Lead Web Designer', tier: 5, rank: 36 },
  { id: 'internal-creative-director', abbr: 'ICD', fullName: 'Internal Creative Director', tier: 5, rank: 37 },
  { id: 'change-mgmt-lead', abbr: 'ChgMgmt', fullName: 'Change Management Lead', tier: 5, rank: 38 }
];

const TIER_DESCRIPTIONS = {
  '1': 'C-Suite Executive',
  '2': 'Chiefs',
  '3': 'Vice Presidents',
  '4': 'Directors',
  '5': 'Managers & Specialists'
};

/**
 * GET /api/roles/hierarchy
 * Returns role hierarchy with abbreviations, full names, tiers, and ranks
 */
router.get('/hierarchy', (req, res) => {
  try {
    const { tier } = req.query;

    let roles = [...ROLES_HIERARCHY];

    // Filter by tier if specified
    if (tier) {
      const tierNum = parseInt(tier, 10);
      if (isNaN(tierNum) || tierNum < 1 || tierNum > 5) {
        return res.status(400).json({
          error: 'Invalid tier parameter',
          message: 'Tier must be a number between 1 and 5'
        });
      }
      roles = roles.filter(r => r.tier === tierNum);
    }

    res.json({
      roles,
      tiers: TIER_DESCRIPTIONS
    });
  } catch (error) {
    console.error('[ROLES] Hierarchy error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve role hierarchy'
    });
  }
});

/**
 * GET /api/roles/:roleId
 * Returns details for a specific role
 */
router.get('/:roleId', (req, res) => {
  try {
    const { roleId } = req.params;
    const role = ROLES_HIERARCHY.find(r => r.id === roleId.toLowerCase());

    if (!role) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Role '${roleId}' not found`
      });
    }

    res.json({
      role,
      tierDescription: TIER_DESCRIPTIONS[role.tier.toString()]
    });
  } catch (error) {
    console.error('[ROLES] Get role error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve role'
    });
  }
});

// Export the roles hierarchy for use in other modules
export { ROLES_HIERARCHY, TIER_DESCRIPTIONS };
export default router;
