/**
 * Role Hierarchy Configuration
 * Defines all organizational roles with their abbreviations, full names,
 * tier levels, and hierarchy rank for dashboard display and filtering.
 * Updated to match NotebookLM-extracted roles.
 */

// Role definitions ordered by organizational hierarchy
export const ROLES = [
  // Tier 1 - C-Suite (ranks 1-7)
  { id: 'ceo', abbr: 'CEO', fullName: 'Chief Executive Officer', tier: 1, rank: 1 },
  { id: 'cfo', abbr: 'CFO', fullName: 'Chief Financial Officer', tier: 1, rank: 2 },
  { id: 'coo', abbr: 'COO', fullName: 'Chief Operating Officer', tier: 1, rank: 3 },
  { id: 'cto', abbr: 'CTO', fullName: 'Chief Technology Officer', tier: 1, rank: 4 },
  { id: 'ciso', abbr: 'CISO', fullName: 'Chief Information Security Officer', tier: 1, rank: 5 },
  { id: 'cmo', abbr: 'CMO', fullName: 'Chief Marketing Officer', tier: 1, rank: 6 },
  { id: 'chro', abbr: 'CHRO', fullName: 'Chief Human Resources Officer', tier: 1, rank: 7 },

  // Tier 2 - Chiefs (ranks 8-15)
  { id: 'cos', abbr: 'CoS', fullName: 'Chief of Staff', tier: 2, rank: 8 },
  { id: 'clo', abbr: 'CLO', fullName: 'General Counsel', tier: 2, rank: 9 },
  { id: 'cco', abbr: 'CCO', fullName: 'Chief Compliance Officer', tier: 2, rank: 10 },
  { id: 'cpo', abbr: 'CPO', fullName: 'Chief Product Officer', tier: 2, rank: 11 },
  { id: 'cro', abbr: 'CRO', fullName: 'Chief Revenue Officer', tier: 2, rank: 12 },
  { id: 'cdo', abbr: 'CDO', fullName: 'Chief Data Officer', tier: 2, rank: 13 },
  { id: 'cso', abbr: 'CSO', fullName: 'Chief Strategy Officer', tier: 2, rank: 14 },
  { id: 'csuso', abbr: 'CSusO', fullName: 'Chief Sustainability Officer', tier: 2, rank: 15 },

  // Tier 3 - VPs (ranks 16-23)
  { id: 'vp-employer-branding', abbr: 'VP-EB', fullName: 'VP of Employer Branding', tier: 3, rank: 16 },
  { id: 'vp-sales', abbr: 'VP-Sales', fullName: 'Vice President of Sales', tier: 3, rank: 17 },
  { id: 'vp-ops', abbr: 'VP-Ops', fullName: 'Vice President of Operations', tier: 3, rank: 18 },
  { id: 'vp-product', abbr: 'VP-Product', fullName: 'Vice President of Product', tier: 3, rank: 19 },
  { id: 'vp-eng', abbr: 'VP-Eng', fullName: 'Vice President of Engineering', tier: 3, rank: 20 },
  { id: 'vp-mktg', abbr: 'VP-Mktg', fullName: 'Vice President of Marketing', tier: 3, rank: 21 },
  { id: 'vp-hr', abbr: 'VP-HR', fullName: 'Vice President of Human Resources', tier: 3, rank: 22 },
  { id: 'vp-fin', abbr: 'VP-Fin', fullName: 'Vice President of Finance', tier: 3, rank: 23 },

  // Tier 4 - Directors (ranks 24-32)
  { id: 'dir-communications', abbr: 'Dir-Comms', fullName: 'Director of Communications', tier: 4, rank: 24 },
  { id: 'dir-learning-dev', abbr: 'Dir-L&D', fullName: 'Director of Learning & Development', tier: 4, rank: 25 },
  { id: 'dir-sales', abbr: 'Dir-Sales', fullName: 'Director of Sales', tier: 4, rank: 26 },
  { id: 'dir-ops', abbr: 'Dir-Ops', fullName: 'Director of Operations', tier: 4, rank: 27 },
  { id: 'dir-product', abbr: 'Dir-Product', fullName: 'Director of Product', tier: 4, rank: 28 },
  { id: 'dir-eng', abbr: 'Dir-Eng', fullName: 'Director of Engineering', tier: 4, rank: 29 },
  { id: 'dir-mktg', abbr: 'Dir-Mktg', fullName: 'Director of Marketing', tier: 4, rank: 30 },
  { id: 'dir-hr', abbr: 'Dir-HR', fullName: 'Director of Human Resources', tier: 4, rank: 31 },
  { id: 'dir-fin', abbr: 'Dir-Fin', fullName: 'Director of Finance', tier: 4, rank: 32 },

  // Tier 5 - Leads & Specialists (ranks 33+)
  { id: 'head-cs', abbr: 'Head-CS', fullName: 'Head of Customer Success', tier: 5, rank: 33 },
  { id: 'devops-lead', abbr: 'DevOps', fullName: 'DevOps & Infrastructure Lead', tier: 5, rank: 34 },
  { id: 'qa-lead', abbr: 'QA', fullName: 'QA Lead', tier: 5, rank: 35 },
  { id: 'lead-web-designer', abbr: 'Lead-Web', fullName: 'Lead Web Designer', tier: 5, rank: 36 },
  { id: 'internal-creative-director', abbr: 'ICD', fullName: 'Internal Creative Director', tier: 5, rank: 37 },
  { id: 'change-mgmt-lead', abbr: 'ChgMgmt', fullName: 'Change Management Lead', tier: 5, rank: 38 },

  // Technical/Development roles
  { id: 'database-architect', abbr: 'DB-Arch', fullName: 'Database Architect', tier: 5, rank: 39 },
  { id: 'backend-developer', abbr: 'BE-Dev', fullName: 'Backend Developer', tier: 5, rank: 40 },
  { id: 'frontend-developer', abbr: 'FE-Dev', fullName: 'Frontend Developer', tier: 5, rank: 41 },
];

// Tier labels for display
export const TIER_LABELS = {
  1: 'C-Suite',
  2: 'Chiefs',
  3: 'Vice Presidents',
  4: 'Directors',
  5: 'Leads & Specialists',
};

// Tier colors for visual hierarchy
export const TIER_COLORS = {
  1: 'monolith-green',
  2: 'monolith-amber',
  3: 'blue-400',
  4: 'purple-400',
  5: 'gray-400',
};

/**
 * Get a role by its abbreviation
 * @param {string} abbr - Role abbreviation (e.g., 'CEO', 'CFO')
 * @returns {object|undefined} Role object or undefined
 */
export const getRoleByAbbr = (abbr) => {
  return ROLES.find((role) => role.abbr.toLowerCase() === abbr.toLowerCase());
};

/**
 * Get a role by its ID
 * @param {string} id - Role ID (e.g., 'ceo', 'cos')
 * @returns {object|undefined} Role object or undefined
 */
export const getRoleById = (id) => {
  return ROLES.find((role) => role.id === id?.toLowerCase());
};

/**
 * Get all roles sorted by rank (hierarchy importance)
 * @returns {array} Sorted array of role objects
 */
export const getRolesSorted = () => {
  return [...ROLES].sort((a, b) => a.rank - b.rank);
};

/**
 * Get roles for a specific tier
 * @param {number} tier - Tier number (1-5)
 * @returns {array} Array of role objects in that tier
 */
export const getTierRoles = (tier) => {
  return ROLES.filter((role) => role.tier === tier).sort((a, b) => a.rank - b.rank);
};

/**
 * Get abbreviation from role ID
 * @param {string} roleId - Role ID
 * @returns {string} Role abbreviation or formatted ID if not found
 */
export const getAbbrFromId = (roleId) => {
  const role = getRoleById(roleId);
  if (role) return role.abbr;
  // Fallback: format unknown ID nicely
  if (!roleId) return 'Unknown';
  return roleId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('-');
};

/**
 * Get full name from role ID
 * @param {string} roleId - Role ID
 * @returns {string} Full role name
 */
export const getFullNameFromId = (roleId) => {
  const role = getRoleById(roleId);
  if (role) return role.fullName;
  if (!roleId) return 'Unknown Role';
  return roleId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export default ROLES;
