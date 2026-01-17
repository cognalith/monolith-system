/**
 * KNOWLEDGE BOT - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Implements Knowledge Bots for each team (Tech, Marketing, Product, Ops, Finance, People).
 * Knowledge Bots research best practices and generate improvement recommendations
 * for their team's subordinates.
 *
 * SAFETY CONSTRAINTS (HARDCODED - CANNOT BE MODIFIED):
 * - Knowledge Bots are ADVISORY ONLY - cannot apply amendments directly
 * - No execution tools available (web_search and deep_research only)
 * - Team isolation enforced - can only research for own team
 * - Recommendations expire after 7 days
 * - Cannot generate recommendations for self
 *
 * ARCHITECTURE:
 * - Each team has one Knowledge Bot (6 total)
 * - Knowledge Bots report to their respective Team Lead
 * - Research happens on daily cadence
 * - Recommendations are suggestions only - Team Lead decides whether to apply
 */

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} KnowledgeBotConfig
 * @property {string} role - 'tech_knowledge_bot', 'marketing_knowledge_bot', etc.
 * @property {string} team_id - 'tech', 'marketing', 'product', 'operations', 'finance', 'people'
 * @property {Object} persona
 * @property {string} persona.identity - Bot identity description
 * @property {string} persona.purpose - Bot purpose description
 * @property {string} persona.authority_level - 'advisory'
 * @property {string} persona.reports_to - Team Lead role
 * @property {Object} skills
 * @property {string[]} skills.core - ['web_search', 'deep_research']
 * @property {string[]} skills.optional - ['arxiv_search', 'github_search']
 * @property {string[]} skills.restricted - [] (No execution tools)
 * @property {Object} knowledge
 * @property {string} knowledge.base - Domain expertise prompt
 * @property {string[]} knowledge.research_focus - Areas of research focus
 * @property {Map<string, string[]>} knowledge.subordinate_specialties - Per-subordinate research areas
 * @property {Object} research_config
 * @property {string} research_config.cadence - 'daily'
 * @property {number} research_config.recommendations_per_subordinate - 2
 * @property {string} research_config.research_depth - 'deep'
 */

/**
 * @typedef {Object} KnowledgeBotStats
 * @property {number} total_recommendations - Total recommendations generated
 * @property {number} successful_recommendations - Recommendations that were applied
 * @property {Date|null} last_research_cycle - Timestamp of last research cycle
 */

// ============================================================================
// HARDCODED SAFETY CONSTRAINTS
// ============================================================================

const KNOWLEDGE_BOT_SAFETY_CONSTRAINTS = Object.freeze({
  // Knowledge Bots are advisory only - cannot apply amendments
  ADVISORY_ONLY: true,

  // No execution tools allowed
  NO_EXECUTION_TOOLS: true,

  // Can only research for own team's subordinates
  TEAM_ISOLATION: true,

  // Recommendations expire after 7 days
  RECOMMENDATION_EXPIRY_DAYS: 7,

  // Cannot generate recommendations for self
  NO_SELF_RECOMMENDATION: true,

  // Allowed skills (research only)
  ALLOWED_SKILLS: Object.freeze(['web_search', 'deep_research', 'arxiv_search', 'github_search']),

  // Maximum recommendations per subordinate per cycle
  MAX_RECOMMENDATIONS_PER_SUBORDINATE: 3,

  // Minimum confidence threshold for recommendations
  MIN_CONFIDENCE_THRESHOLD: 0.6,
});

// ============================================================================
// TECH KNOWLEDGE BOT DETAILED CONFIG (Phase 6C)
// ============================================================================

/**
 * Detailed Tech Knowledge Bot Configuration for Phase 6C
 * Exported separately for deployment script usage
 */
const TECH_KNOWLEDGE_BOT_CONFIG = {
  role: 'tech_knowledge_bot',
  team_id: 'tech',
  is_knowledge_bot: true,
  reports_to: 'cto',

  persona: {
    identity: "Tech Knowledge Bot for Cognalith Technology Team",
    purpose: "Research best practices and generate improvement recommendations for Tech Team members.",
    authority_level: 'advisory'
  },

  skills: {
    core: ['web_search', 'deep_research'],
    optional: ['arxiv_search', 'github_search', 'stackoverflow_search'],
    restricted: ['github_write', 'vercel_deploy', 'any_execution_tool']
  },

  knowledge: {
    base: `You are the Tech Knowledge Bot for Cognalith Inc.'s Technology Team.

           Your purpose is to:
           1. Research best practices in web development, mobile development, DevOps, QA, and IT
           2. Analyze subordinate performance patterns
           3. Generate 2 targeted recommendations per subordinate daily

           You serve: Web Dev Lead, App Dev Lead, DevOps Lead, QA Lead, Infrastructure Lead

           Research focus areas by subordinate:
           - Web Dev Lead: React patterns, TypeScript best practices, performance optimization
           - App Dev Lead: React Native updates, Capacitor features, app store guidelines
           - DevOps Lead: CI/CD optimization, container best practices, monitoring strategies
           - QA Lead: Testing strategies, automation patterns, quality metrics
           - Infrastructure Lead: Security hardening, Google Workspace tips, backup strategies

           When generating recommendations:
           - Be specific and actionable
           - Target documented failure patterns
           - Consider past recommendation success rates
           - Cite your research sources`,
    standard: '',
    amendments: []
  },

  research_config: {
    cadence: 'daily',
    recommendations_per_subordinate: 2,
    research_depth: 'deep'
  },

  // Detailed subordinate specialties map
  subordinate_specialties: {
    'web_dev_lead': ['React', 'TypeScript', 'Vite', 'Tailwind', 'Next.js', 'Web Performance', 'Accessibility', 'Core Web Vitals'],
    'app_dev_lead': ['React Native', 'Capacitor', 'iOS', 'Android', 'EAS', 'App Store', 'Google Play', 'Push Notifications'],
    'devops_lead': ['GitHub Actions', 'Vercel', 'Railway', 'Docker', 'CI/CD', 'Monitoring', 'Secrets Management', 'Zero-downtime Deployments'],
    'qa_lead': ['Playwright', 'Jest', 'E2E Testing', 'Unit Testing', 'Test Strategy', 'Quality Metrics', 'Bug Tracking', 'Acceptance Criteria'],
    'infrastructure_lead': ['Google Workspace', 'Security Hardening', 'DNS', 'Backups', 'Disaster Recovery', 'Access Controls', 'Vendor Management']
  },

  model: {
    provider: 'anthropic',
    model_id: 'claude-sonnet-4-20250514',
    extended_thinking: false,
    temperature: 0.4,  // Slightly higher for research creativity
    max_tokens: 4096
  }
};

// ============================================================================
// MARKETING KNOWLEDGE BOT DETAILED CONFIG (Phase 6C)
// ============================================================================

/**
 * Detailed Marketing Knowledge Bot Configuration for Phase 6C
 * Exported separately for deployment script usage
 */
const MARKETING_KNOWLEDGE_BOT_CONFIG = {
  role: 'marketing_knowledge_bot',
  team_id: 'marketing',
  is_knowledge_bot: true,
  reports_to: 'cmo',

  persona: {
    identity: "Marketing Knowledge Bot for Cognalith Marketing Team",
    purpose: "Research marketing best practices and generate improvement recommendations for Marketing Team members.",
    authority_level: 'advisory'
  },

  skills: {
    core: ['web_search', 'deep_research'],
    optional: ['trend_analysis', 'competitor_research', 'social_listening'],
    restricted: ['social_post', 'email_send', 'any_execution_tool']
  },

  knowledge: {
    base: `You are the Marketing Knowledge Bot for Cognalith Inc.'s Marketing Team.

           Your purpose is to:
           1. Research best practices in content marketing, social media, SEO, and branding
           2. Analyze subordinate performance patterns
           3. Generate 2 targeted recommendations per subordinate daily

           You serve: Content Lead, Social Media Lead, SEO/Growth Lead, Brand Lead

           Research focus areas by subordinate:
           - Content Lead: Content strategy, copywriting trends, email marketing, engagement metrics
           - Social Media Lead: Platform algorithms, viral content, community management, scheduling
           - SEO/Growth Lead: Search algorithm updates, keyword strategies, conversion optimization
           - Brand Lead: Brand positioning, design trends, visual identity, brand voice

           Current brands to consider:
           - Cognalith: B2B AI implementation services
           - TeeMates: Social golf app for finding playing partners
           - VR Golf Leagues: VR gaming leagues and tournaments

           When generating recommendations:
           - Be specific and actionable
           - Target documented failure patterns
           - Consider past recommendation success rates
           - Cite your research sources`,
    standard: '',
    amendments: []
  },

  research_config: {
    cadence: 'daily',
    recommendations_per_subordinate: 2,
    research_depth: 'deep'
  },

  subordinate_specialties: {
    'content_lead': ['Content Strategy', 'Copywriting', 'Blog SEO', 'Email Marketing', 'Content Calendar', 'Storytelling', 'Lead Magnets'],
    'social_media_lead': ['Social Algorithms', 'Community Management', 'Viral Content', 'Engagement', 'Scheduling', 'Influencer Marketing', 'UGC'],
    'seo_growth_lead': ['Technical SEO', 'Keyword Research', 'Link Building', 'Google Ads', 'Conversion Rate', 'A/B Testing', 'Analytics'],
    'brand_lead': ['Brand Identity', 'Visual Design', 'Brand Voice', 'Style Guides', 'Logo Usage', 'Color Theory', 'Typography']
  },

  model: {
    provider: 'anthropic',
    model_id: 'claude-sonnet-4-20250514',
    temperature: 0.4,
    max_tokens: 4096
  }
};

// ============================================================================
// PRODUCT KNOWLEDGE BOT DETAILED CONFIG (Phase 6C)
// ============================================================================

/**
 * Detailed Product Knowledge Bot Configuration for Phase 6C
 * Exported separately for deployment script usage
 */
const PRODUCT_KNOWLEDGE_BOT_CONFIG = {
  role: 'product_knowledge_bot',
  team_id: 'product',
  is_knowledge_bot: true,
  reports_to: 'cpo',

  persona: {
    identity: "Product Knowledge Bot for Cognalith Product Team",
    purpose: "Research product management best practices and generate improvement recommendations for Product Team members.",
    authority_level: 'advisory'
  },

  skills: {
    core: ['web_search', 'deep_research'],
    optional: ['competitor_analysis', 'market_research', 'user_feedback_analysis'],
    restricted: ['feature_deploy', 'roadmap_change', 'any_execution_tool']
  },

  knowledge: {
    base: `You are the Product Knowledge Bot for Cognalith Inc.'s Product Team.

           Your purpose is to:
           1. Research best practices in UX research, product analytics, and feature specification
           2. Analyze subordinate performance patterns
           3. Generate 2 targeted recommendations per subordinate daily

           You serve: UX Research Lead, Product Analytics Lead, Feature Spec Lead

           Research focus areas by subordinate:
           - UX Research Lead: User research methods, usability testing, interview techniques, persona development
           - Product Analytics Lead: Analytics tools, metric frameworks, A/B testing, cohort analysis
           - Feature Spec Lead: PRD writing, user story formats, prioritization frameworks, agile methodologies

           Current products to consider:
           - Monolith System: AI agent orchestration (B2B SaaS)
           - TeeMates: Social golf app (B2C mobile)
           - VR Golf Leagues: VR gaming platform (B2C gaming)

           When generating recommendations:
           - Be specific and actionable
           - Target documented failure patterns
           - Consider past recommendation success rates
           - Cite your research sources`,
    standard: '',
    amendments: []
  },

  research_config: {
    cadence: 'daily',
    recommendations_per_subordinate: 2,
    research_depth: 'deep'
  },

  subordinate_specialties: {
    'ux_research_lead': ['User Research', 'Usability Testing', 'User Interviews', 'Personas', 'Journey Mapping', 'Heuristic Evaluation', 'Card Sorting'],
    'product_analytics_lead': ['Product Metrics', 'A/B Testing', 'Cohort Analysis', 'Funnel Analysis', 'Retention Analysis', 'Feature Adoption', 'North Star Metric'],
    'feature_spec_lead': ['PRD Writing', 'User Stories', 'Acceptance Criteria', 'RICE Scoring', 'MoSCoW', 'Story Mapping', 'Jobs-to-be-Done']
  },

  model: {
    provider: 'anthropic',
    model_id: 'claude-sonnet-4-20250514',
    temperature: 0.4,
    max_tokens: 4096
  }
};

// ============================================================================
// OPS KNOWLEDGE BOT DETAILED CONFIG (Phase 6C)
// ============================================================================

/**
 * Detailed Ops Knowledge Bot Configuration for Phase 6C
 * Exported separately for deployment script usage
 */
const OPS_KNOWLEDGE_BOT_CONFIG = {
  role: 'ops_knowledge_bot',
  team_id: 'operations',
  is_knowledge_bot: true,
  reports_to: 'coo',

  persona: {
    identity: "Operations Knowledge Bot for Cognalith Operations Team",
    purpose: "Research operational best practices and generate improvement recommendations for Operations Team members.",
    authority_level: 'advisory'
  },

  skills: {
    core: ['web_search', 'deep_research'],
    optional: ['vendor_research', 'process_analysis', 'benchmark_research'],
    restricted: []  // Knowledge bots are advisory only - all execution tools forbidden by default
  },

  knowledge: {
    base: `You are the Operations Knowledge Bot for Cognalith Inc.'s Operations Team.

           Your purpose is to:
           1. Research best practices in vendor management and process automation
           2. Analyze subordinate performance patterns
           3. Generate 2 targeted recommendations per subordinate daily

           You serve: Vendor Management Lead, Process Automation Lead

           Research focus areas by subordinate:
           - Vendor Management Lead: Vendor evaluation, contract negotiation, SLA best practices, procurement strategies
           - Process Automation Lead: Workflow automation, integration patterns, no-code tools, efficiency metrics

           Key vendors to consider:
           - Cloud: Vercel, Railway, Supabase, AWS
           - AI: Anthropic, OpenAI
           - Tools: Notion, Slack, GitHub, Google Workspace
           - Automation: Zapier, Make, n8n

           When generating recommendations:
           - Be specific and actionable
           - Target documented failure patterns
           - Consider past recommendation success rates
           - Cite your research sources`,
    standard: '',
    amendments: []
  },

  research_config: {
    cadence: 'daily',
    recommendations_per_subordinate: 2,
    research_depth: 'deep'
  },

  subordinate_specialties: {
    'vendor_management_lead': ['Vendor evaluation', 'Contract negotiation', 'SLA management', 'Procurement', 'Vendor risk', 'Cost optimization', 'Relationship management'],
    'process_automation_lead': ['Workflow automation tools', 'RPA implementation', 'System integration', 'Zapier', 'Make', 'n8n', 'Process mapping', 'Efficiency metrics']
  },

  research_focus: [
    'Vendor management strategies',
    'Process automation tools',
    'Workflow optimization',
    'SLA management',
    'Cost reduction strategies',
    'Integration best practices'
  ],

  model: {
    provider: 'anthropic',
    model_id: 'claude-sonnet-4-20250514',
    temperature: 0.4,
    max_tokens: 4096
  }
};

// ============================================================================
// KNOWLEDGE BOT CONFIGURATIONS (6 Bots)
// ============================================================================

/**
 * Default configurations for all 6 Knowledge Bots
 * @type {KnowledgeBotConfig[]}
 */
const KNOWLEDGE_BOT_CONFIGS = [
  // 1. Tech Knowledge Bot (Phase 6C detailed config)
  TECH_KNOWLEDGE_BOT_CONFIG,

  // 2. Marketing Knowledge Bot (Phase 6C detailed config)
  MARKETING_KNOWLEDGE_BOT_CONFIG,

  // 3. Product Knowledge Bot (Phase 6C detailed config)
  PRODUCT_KNOWLEDGE_BOT_CONFIG,

  // 4. Operations Knowledge Bot (Phase 6C detailed config)
  OPS_KNOWLEDGE_BOT_CONFIG,

  // 5. Finance Knowledge Bot
  {
    role: 'finance_knowledge_bot',
    team_id: 'finance',
    persona: {
      identity: 'Finance Knowledge Bot for Cognalith Finance Team',
      purpose: 'Research finance best practices and generate improvement recommendations for finance team subordinates',
      authority_level: 'advisory',
      reports_to: 'cfo',
    },
    skills: {
      core: ['web_search', 'deep_research'],
      optional: ['arxiv_search', 'github_search'],
      restricted: [],
    },
    knowledge: {
      base: `You are a finance research specialist focused on financial management best practices.
Your expertise spans expense tracking and revenue analytics.
You research industry trends, financial frameworks, and analytics methodologies to help
the finance team continuously improve their processes and financial insights.`,
      research_focus: [
        'Expense management strategies',
        'Revenue analytics methods',
        'Financial forecasting',
        'Budget optimization',
        'Cash flow management',
        'Financial reporting standards',
        'Cost allocation methods',
        'Financial KPIs',
      ],
      subordinate_specialties: new Map([
        ['expense_tracking_lead', ['Expense categorization', 'Cost center management', 'Expense policy optimization', 'Audit trail management', 'Expense analytics']],
        ['revenue_analytics_lead', ['Revenue recognition', 'Pricing analytics', 'Customer lifetime value', 'Revenue forecasting', 'Churn analysis']],
      ]),
    },
    research_config: {
      cadence: 'daily',
      recommendations_per_subordinate: 2,
      research_depth: 'deep',
    },
  },

  // 6. People Knowledge Bot
  {
    role: 'people_knowledge_bot',
    team_id: 'people',
    persona: {
      identity: 'People Knowledge Bot for Cognalith People Team',
      purpose: 'Research HR best practices and generate improvement recommendations for people team subordinates',
      authority_level: 'advisory',
      reports_to: 'chro',
    },
    skills: {
      core: ['web_search', 'deep_research'],
      optional: ['arxiv_search', 'github_search'],
      restricted: [],
    },
    knowledge: {
      base: `You are an HR research specialist focused on human resources best practices.
Your expertise spans hiring and compliance.
You research industry trends, HR frameworks, and compliance requirements to help
the people team continuously improve their processes and employee experience.`,
      research_focus: [
        'Hiring best practices',
        'Compliance requirements',
        'Employee engagement',
        'Performance management',
        'Diversity and inclusion',
        'Remote work policies',
        'Compensation benchmarking',
        'HR technology trends',
      ],
      subordinate_specialties: new Map([
        ['hiring_lead', ['Sourcing strategies', 'Interview techniques', 'Candidate experience', 'Offer management', 'Onboarding optimization']],
        ['compliance_lead', ['Labor law updates', 'Policy documentation', 'Audit preparation', 'Training requirements', 'Workplace safety']],
      ]),
    },
    research_config: {
      cadence: 'daily',
      recommendations_per_subordinate: 2,
      research_depth: 'deep',
    },
  },
];

// ============================================================================
// KNOWLEDGE BOT CLASS
// ============================================================================

/**
 * Knowledge Bot
 * Manages research and recommendation generation for a team's subordinates
 */
class KnowledgeBot {
  /**
   * Create a new KnowledgeBot instance
   * @param {KnowledgeBotConfig} config - Bot configuration
   */
  constructor(config) {
    if (!config || !config.role || !config.team_id) {
      throw new Error('KnowledgeBot requires valid configuration with role and team_id');
    }

    this.config = config;
    this.role = config.role;
    this.teamId = config.team_id;
    // reports_to can be at root level or in persona
    this.reportsTo = config.reports_to || (config.persona && config.persona.reports_to);

    // Initialize stats
    this.stats = {
      total_recommendations: 0,
      successful_recommendations: 0,
      last_research_cycle: null,
    };

    // Validate configuration against safety constraints
    this._validateConfig();
  }

  /**
   * Validate configuration against safety constraints
   * @private
   */
  _validateConfig() {
    // Ensure no execution tools are configured
    const allSkills = [
      ...(this.config.skills.core || []),
      ...(this.config.skills.optional || []),
    ];

    for (const skill of allSkills) {
      if (!KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS.includes(skill)) {
        console.warn(`[KNOWLEDGE-BOT] Warning: Skill '${skill}' is not in allowed list for ${this.role}`);
      }
    }

    // Ensure restricted skills are empty
    if (this.config.skills.restricted && this.config.skills.restricted.length > 0) {
      console.warn(`[KNOWLEDGE-BOT] Warning: Restricted skills should be empty for ${this.role}`);
    }

    // Ensure authority level is advisory
    if (this.config.persona.authority_level !== 'advisory') {
      console.warn(`[KNOWLEDGE-BOT] Warning: Authority level should be 'advisory' for ${this.role}`);
      this.config.persona.authority_level = 'advisory'; // Enforce advisory
    }
  }

  /**
   * Get the bot configuration
   * @returns {KnowledgeBotConfig}
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get subordinate roles for this bot's team
   * @returns {string[]}
   */
  getSubordinates() {
    // Check both root level and knowledge level for subordinate_specialties
    const subordinateSpecialties = this.config.subordinate_specialties ||
                                   (this.config.knowledge && this.config.knowledge.subordinate_specialties);

    if (!subordinateSpecialties) {
      return [];
    }

    // Handle both Map and plain object
    if (subordinateSpecialties instanceof Map) {
      return Array.from(subordinateSpecialties.keys());
    }

    return Object.keys(subordinateSpecialties);
  }

  /**
   * Get research areas for a specific subordinate
   * @param {string} subordinateRole - Subordinate role ID
   * @returns {string[]} Research areas for the subordinate
   */
  getSubordinateSpecialties(subordinateRole) {
    // Check both root level and knowledge level for subordinate_specialties
    const subordinateSpecialties = this.config.subordinate_specialties ||
                                   (this.config.knowledge && this.config.knowledge.subordinate_specialties);

    if (!subordinateSpecialties) {
      return [];
    }

    // Handle both Map and plain object
    if (subordinateSpecialties instanceof Map) {
      return subordinateSpecialties.get(subordinateRole) || [];
    }

    return subordinateSpecialties[subordinateRole] || [];
  }

  /**
   * Check if bot can run a research cycle
   * @returns {boolean}
   */
  isAvailable() {
    // Check if enough time has passed since last research cycle
    if (!this.stats.last_research_cycle) {
      return true;
    }

    const lastCycle = new Date(this.stats.last_research_cycle);
    const now = new Date();
    const hoursSinceLastCycle = (now - lastCycle) / (1000 * 60 * 60);

    // For daily cadence, require at least 20 hours between cycles
    if (this.config.research_config.cadence === 'daily') {
      return hoursSinceLastCycle >= 20;
    }

    // For weekly cadence, require at least 6 days between cycles
    if (this.config.research_config.cadence === 'weekly') {
      return hoursSinceLastCycle >= 144; // 6 days
    }

    return true;
  }

  /**
   * Update timestamp after completing a research cycle
   */
  updateLastResearchCycle() {
    this.stats.last_research_cycle = new Date().toISOString();
  }

  /**
   * Increment recommendation statistics
   * @param {boolean} succeeded - Whether the recommendation was successfully applied
   */
  incrementRecommendations(succeeded = false) {
    this.stats.total_recommendations++;
    if (succeeded) {
      this.stats.successful_recommendations++;
    }
  }

  /**
   * Get bot statistics
   * @returns {KnowledgeBotStats}
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get the Team Lead this bot reports to
   * @returns {string}
   */
  getTeamLead() {
    return this.reportsTo;
  }

  /**
   * Get research focus areas
   * @returns {string[]}
   */
  getResearchFocus() {
    // Check root level first, then knowledge level
    return this.config.research_focus ||
           (this.config.knowledge && this.config.knowledge.research_focus) ||
           [];
  }

  /**
   * Get the number of recommendations per subordinate
   * @returns {number}
   */
  getRecommendationsPerSubordinate() {
    return this.config.research_config.recommendations_per_subordinate ||
      KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.MAX_RECOMMENDATIONS_PER_SUBORDINATE;
  }

  /**
   * Check if this bot can recommend for a given subordinate
   * SAFETY: Enforces team isolation and no self-recommendation
   * @param {string} subordinateRole - Role to check
   * @returns {boolean}
   */
  canRecommendFor(subordinateRole) {
    // Cannot recommend for self
    if (subordinateRole === this.role) {
      return false;
    }

    // Can only recommend for subordinates in own team
    const subordinates = this.getSubordinates();
    return subordinates.includes(subordinateRole);
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

// Cache for bot instances
const botInstanceCache = new Map();

/**
 * Get a KnowledgeBot instance by role
 * @param {string} role - Bot role (e.g., 'tech_knowledge_bot')
 * @returns {KnowledgeBot|null}
 */
function getKnowledgeBot(role) {
  // Check cache first
  if (botInstanceCache.has(role)) {
    return botInstanceCache.get(role);
  }

  // Find config for this role
  const config = KNOWLEDGE_BOT_CONFIGS.find(c => c.role === role);
  if (!config) {
    console.warn(`[KNOWLEDGE-BOT] No configuration found for role: ${role}`);
    return null;
  }

  // Create and cache instance
  const bot = new KnowledgeBot(config);
  botInstanceCache.set(role, bot);
  return bot;
}

/**
 * Get a KnowledgeBot instance by team ID
 * @param {string} teamId - Team ID (e.g., 'tech', 'marketing')
 * @returns {KnowledgeBot|null}
 */
function getKnowledgeBotForTeam(teamId) {
  // Find config for this team
  const config = KNOWLEDGE_BOT_CONFIGS.find(c => c.team_id === teamId);
  if (!config) {
    console.warn(`[KNOWLEDGE-BOT] No configuration found for team: ${teamId}`);
    return null;
  }

  return getKnowledgeBot(config.role);
}

/**
 * Get all KnowledgeBot instances
 * @returns {KnowledgeBot[]}
 */
function getAllKnowledgeBots() {
  return KNOWLEDGE_BOT_CONFIGS.map(config => getKnowledgeBot(config.role)).filter(Boolean);
}

/**
 * Get all KnowledgeBot roles
 * @returns {string[]}
 */
function getAllKnowledgeBotRoles() {
  return KNOWLEDGE_BOT_CONFIGS.map(c => c.role);
}

/**
 * Check if a role is a KnowledgeBot
 * @param {string} role - Role to check
 * @returns {boolean}
 */
function isKnowledgeBot(role) {
  return KNOWLEDGE_BOT_CONFIGS.some(c => c.role === role);
}

/**
 * Clear the bot instance cache (useful for testing)
 */
function clearBotCache() {
  botInstanceCache.clear();
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export class
export { KnowledgeBot };

// Export configs and safety constraints
export { KNOWLEDGE_BOT_CONFIGS, KNOWLEDGE_BOT_SAFETY_CONSTRAINTS, TECH_KNOWLEDGE_BOT_CONFIG, MARKETING_KNOWLEDGE_BOT_CONFIG, PRODUCT_KNOWLEDGE_BOT_CONFIG, OPS_KNOWLEDGE_BOT_CONFIG };

// Export factory functions
export {
  getKnowledgeBot,
  getKnowledgeBotForTeam,
  getAllKnowledgeBots,
  getAllKnowledgeBotRoles,
  isKnowledgeBot,
  clearBotCache,
};

// Default export
export default KnowledgeBot;
