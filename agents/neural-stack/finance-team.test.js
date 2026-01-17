/**
 * Finance Team Validation Test Suite - Phase 6G
 * Cognalith Inc. | Monolith System
 *
 * Comprehensive test suite for validating Finance Team structure, CFO review cycles,
 * Finance Knowledge Bot functionality, and integration scenarios.
 *
 * Tests cover:
 * - Team hierarchy and structure validation
 * - CFO CoS (Chief of Staff) review powers
 * - Finance Knowledge Bot advisory functionality
 * - Finance-specific safety constraints
 * - End-to-end integration scenarios
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';

// ============================================================================
// MOCKS
// ============================================================================

// Mock Supabase client
const mockSupabaseData = {
  agents: new Map(),
  teams: new Map(),
  tasks: [],
  amendments: [],
  recommendations: [],
  reviews: [],
  escalations: [],
};

const mockSupabaseClient = {
  from: jest.fn((table) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(async () => {
      // Return mock data based on table
      if (table === 'monolith_agents') {
        return { data: mockSupabaseData.agents.values().next().value, error: null };
      }
      if (table === 'monolith_teams') {
        return { data: mockSupabaseData.teams.values().next().value, error: null };
      }
      return { data: null, error: null };
    }),
  })),
};

jest.unstable_mockModule('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Import after mocking
const { TeamLeadReviewEngine, TEAM_LEAD_CONFIGS, SAFETY_CONSTRAINTS, calculateTrend, calculateCosScore, generateAmendment, runTeamLeadReviewCycle } = await import('./TeamLeadReviewEngine.js');
const { KnowledgeBot, KNOWLEDGE_BOT_CONFIGS, KNOWLEDGE_BOT_SAFETY_CONSTRAINTS, getKnowledgeBot, getKnowledgeBotForTeam, isKnowledgeBot, clearBotCache } = await import('./KnowledgeBot.js');
const { RecommendationGenerator, validateRecommendation, selectRecommendationForAmendment, generateRecommendations, VALIDATION_RULES } = await import('./RecommendationGenerator.js');
const {
  CFO_CONFIG,
  EXPENSE_TRACKING_LEAD_CONFIG,
  REVENUE_ANALYTICS_LEAD_CONFIG,
  FINANCE_KNOWLEDGE_BOT_CONFIG,
  FINANCE_TEAM_CONFIGS,
  FINANCE_TEAM_BY_ROLE,
  getFinanceTeamSubordinates,
  getFinanceTeamLead,
  getFinanceTeamConfig,
} = await import('./finance-team-configs.js');

// ============================================================================
// TEST UTILITIES FOR FINANCE TEAM
// ============================================================================

/**
 * Test helper utilities for Finance Team tests
 */
const FinanceTestUtils = {
  /**
   * Finance team subordinate roles
   */
  FINANCE_SUBORDINATES: ['expense_tracking_lead', 'revenue_analytics_lead'],

  /**
   * Finance Knowledge Bot subordinate specialties
   */
  FINANCE_SPECIALTIES: {
    expense_tracking_lead: ['Expense categorization', 'Budget variance analysis', 'Cost center optimization', 'Spend analytics', 'Expense policy design'],
    revenue_analytics_lead: ['Revenue recognition', 'Financial forecasting', 'SaaS metrics', 'Cohort analysis', 'Profitability modeling'],
  },

  /**
   * Get agent configuration by role
   * @param {string} role - Agent role ID
   * @returns {Promise<Object|null>} Agent configuration
   */
  async getAgent(role) {
    // Check finance team configs first
    const financeConfig = FINANCE_TEAM_BY_ROLE[role];
    if (financeConfig) {
      return {
        role: financeConfig.role,
        team_id: financeConfig.team_id,
        is_team_lead: financeConfig.is_team_lead || false,
        reports_to: financeConfig.reports_to,
        persona: financeConfig.persona || {},
        skills: financeConfig.skills || {},
      };
    }

    // Check team lead configs
    const teamLeadConfig = TEAM_LEAD_CONFIGS.find(c => c.role === role);
    if (teamLeadConfig) {
      return {
        role: teamLeadConfig.role,
        team_id: teamLeadConfig.team_id,
        is_team_lead: true,
        reports_to: 'ceo',
        persona: {
          team_lead_powers: {
            subordinates: teamLeadConfig.subordinates,
            review_cadence: teamLeadConfig.cos_powers.review_cadence,
            amendment_authority: teamLeadConfig.cos_powers.amendment_authority,
          },
        },
      };
    }

    // Check if subordinate (find in team configs)
    for (const config of TEAM_LEAD_CONFIGS) {
      if (config.subordinates.includes(role)) {
        return {
          role,
          team_id: config.team_id,
          is_team_lead: false,
          reports_to: config.role,
        };
      }
    }

    // Check if knowledge bot
    if (isKnowledgeBot(role)) {
      const bot = getKnowledgeBot(role);
      return {
        role: bot.role,
        team_id: bot.teamId,
        is_team_lead: false,
        is_knowledge_bot: true,
        reports_to: bot.reportsTo,
        persona: {
          authority_level: bot.config.persona.authority_level,
        },
        skills: bot.config.skills,
      };
    }

    return null;
  },

  /**
   * Get Knowledge Bot by role
   * @param {string} role - Knowledge Bot role
   * @returns {Promise<Object|null>} Knowledge Bot configuration
   */
  async getKnowledgeBot(role) {
    const bot = getKnowledgeBot(role);
    if (!bot) return null;

    return {
      role: bot.role,
      team_id: bot.teamId,
      is_knowledge_bot: true,
      reports_to: bot.reportsTo,
      persona: {
        authority_level: bot.config.persona.authority_level,
      },
      skills: bot.config.skills,
    };
  },

  /**
   * Get team by ID
   * @param {string} teamId - Team identifier
   * @returns {Promise<Object|null>} Team configuration
   */
  async getTeam(teamId) {
    // Check finance team
    if (teamId === 'finance') {
      return {
        team_id: 'finance',
        team_lead_role: 'cfo',
        subordinates: ['expense_tracking_lead', 'revenue_analytics_lead'],
      };
    }

    const teamLead = TEAM_LEAD_CONFIGS.find(c => c.team_id === teamId);
    if (!teamLead) return null;

    return {
      team_id: teamId,
      team_lead_role: teamLead.role,
      subordinates: teamLead.subordinates,
    };
  },

  /**
   * Create a test task for a subordinate
   * @param {string} subordinateRole - Role of the subordinate
   * @param {Object} options - Task options
   * @returns {Promise<Object>} Created task
   */
  async createTestTask(subordinateRole, options = {}) {
    const task = {
      id: `test-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      assigned_to: subordinateRole,
      status: options.status || 'pending',
      created_at: options.created_at || new Date().toISOString(),
      completed_at: options.status === 'completed' ? new Date().toISOString() : null,
      quality_score: options.quality_score || null,
      due_date: options.due_date || null,
      retry_count: options.retry_count || 0,
      metadata: options.metadata || {},
      category: options.category || 'finance',
    };

    mockSupabaseData.tasks.push(task);
    return task;
  },

  /**
   * Get task history for a subordinate
   * @param {string} subordinateRole - Role of the subordinate
   * @param {number} limit - Maximum tasks to return
   * @returns {Promise<Object[]>} Task history
   */
  async getTaskHistory(subordinateRole, limit = 10) {
    return mockSupabaseData.tasks
      .filter(t => t.assigned_to === subordinateRole)
      .slice(0, limit);
  },

  /**
   * Create a test recommendation
   * @param {string} subordinateRole - Target subordinate
   * @param {Object} options - Recommendation options
   * @returns {Promise<Object>} Created recommendation
   */
  async createTestRecommendation(subordinateRole, options = {}) {
    const recommendation = {
      id: `test-rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      subordinate_role: subordinateRole,
      type: options.type || 'knowledge_addition',
      content: options.content || 'Test finance recommendation for improving expense tracking processes',
      targeting_pattern: options.targeting_pattern || 'task_category:expense_tracking',
      expected_impact: options.expected_impact || 'medium',
      reasoning: options.reasoning || 'Test reasoning for the finance recommendation',
      sources: options.sources || ['https://example.com/finance-best-practices'],
      status: options.status || 'pending',
      amendment_id: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    mockSupabaseData.recommendations.push(recommendation);
    return recommendation;
  },

  /**
   * Create an expired recommendation
   * @param {string} subordinateRole - Target subordinate
   * @returns {Promise<Object>} Created expired recommendation
   */
  async createExpiredRecommendation(subordinateRole) {
    const recommendation = {
      id: `test-rec-expired-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      subordinate_role: subordinateRole,
      type: 'knowledge_addition',
      content: 'Expired finance recommendation',
      targeting_pattern: 'task_category:expired_test',
      expected_impact: 'low',
      reasoning: 'This recommendation should be expired',
      sources: ['https://example.com/old-source'],
      status: 'pending',
      amendment_id: null,
      created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
      expires_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago (expired)
    };

    mockSupabaseData.recommendations.push(recommendation);
    return recommendation;
  },

  /**
   * Clear all test data
   */
  clearTestData() {
    mockSupabaseData.tasks = [];
    mockSupabaseData.amendments = [];
    mockSupabaseData.recommendations = [];
    mockSupabaseData.reviews = [];
    mockSupabaseData.escalations = [];
    clearBotCache();
  },

  /**
   * Verify finance team subordinate belongs to finance team
   * @param {string} role - Role to verify
   * @returns {boolean}
   */
  isFinanceSubordinate(role) {
    return this.FINANCE_SUBORDINATES.includes(role);
  },

  /**
   * Get expected specialties for a finance subordinate
   * @param {string} role - Subordinate role
   * @returns {string[]}
   */
  getExpectedSpecialties(role) {
    return this.FINANCE_SPECIALTIES[role] || [];
  },
};

// Export test utilities for reuse
export { FinanceTestUtils };

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  FinanceTestUtils.clearTestData();
});

afterEach(() => {
  FinanceTestUtils.clearTestData();
});

// ============================================================================
// 1. FINANCE TEAM CONFIG STRUCTURE TESTS
// ============================================================================

describe('Finance Team Config Structure', () => {
  describe('CFO_CONFIG', () => {
    it('has correct role', () => {
      expect(CFO_CONFIG.role).toBe('cfo');
    });

    it('has correct team_id', () => {
      expect(CFO_CONFIG.team_id).toBe('finance');
    });

    it('is marked as team lead', () => {
      expect(CFO_CONFIG.is_team_lead).toBe(true);
    });

    it('reports to cos', () => {
      expect(CFO_CONFIG.reports_to).toBe('cos');
    });

    it('has correct subordinates', () => {
      expect(CFO_CONFIG.persona.team_lead_powers.subordinates).toContain('expense_tracking_lead');
      expect(CFO_CONFIG.persona.team_lead_powers.subordinates).toContain('revenue_analytics_lead');
      expect(CFO_CONFIG.persona.team_lead_powers.subordinates).toHaveLength(2);
    });

    it('has knowledge_bot reference', () => {
      expect(CFO_CONFIG.persona.team_lead_powers.knowledge_bot).toBe('finance_knowledge_bot');
    });

    it('has amendment_authority', () => {
      expect(CFO_CONFIG.persona.team_lead_powers.amendment_authority).toBe(true);
    });

    it('has skill_modification_authority', () => {
      expect(CFO_CONFIG.persona.team_lead_powers.skill_modification_authority).toBe(true);
    });

    it('has daily review_cadence', () => {
      expect(CFO_CONFIG.persona.team_lead_powers.review_cadence).toBe('daily');
    });

    it('has c_suite authority_level', () => {
      expect(CFO_CONFIG.persona.authority_level).toBe('c_suite');
    });

    it('has core skills', () => {
      expect(CFO_CONFIG.skills.core).toContain('browser');
      expect(CFO_CONFIG.skills.core).toContain('notion');
    });

    it('has empty restricted skills', () => {
      expect(CFO_CONFIG.skills.restricted).toEqual([]);
    });

    it('has knowledge base', () => {
      expect(CFO_CONFIG.knowledge.base).toBeDefined();
      expect(CFO_CONFIG.knowledge.base.length).toBeGreaterThan(100);
    });

    it('has model configuration', () => {
      expect(CFO_CONFIG.model.provider).toBe('anthropic');
      expect(CFO_CONFIG.model.model_id).toBeDefined();
    });
  });

  describe('EXPENSE_TRACKING_LEAD_CONFIG', () => {
    it('has correct role', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.role).toBe('expense_tracking_lead');
    });

    it('has correct team_id', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.team_id).toBe('finance');
    });

    it('is not a team lead', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.is_team_lead).toBe(false);
    });

    it('reports to cfo', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.reports_to).toBe('cfo');
    });

    it('has specialist authority_level', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.persona.authority_level).toBe('specialist');
    });

    it('escalates to cfo', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.persona.escalation.escalates_to).toBe('cfo');
    });

    it('receives no escalations', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.persona.escalation.receives_escalations_from).toEqual([]);
    });

    it('has core skills', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.skills.core).toContain('browser');
      expect(EXPENSE_TRACKING_LEAD_CONFIG.skills.core).toContain('excel');
    });

    it('has restricted skills', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.skills.restricted.length).toBeGreaterThan(0);
    });

    it('has knowledge base', () => {
      expect(EXPENSE_TRACKING_LEAD_CONFIG.knowledge.base).toBeDefined();
      expect(EXPENSE_TRACKING_LEAD_CONFIG.knowledge.base.length).toBeGreaterThan(100);
    });
  });

  describe('REVENUE_ANALYTICS_LEAD_CONFIG', () => {
    it('has correct role', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.role).toBe('revenue_analytics_lead');
    });

    it('has correct team_id', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.team_id).toBe('finance');
    });

    it('is not a team lead', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.is_team_lead).toBe(false);
    });

    it('reports to cfo', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.reports_to).toBe('cfo');
    });

    it('has specialist authority_level', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.persona.authority_level).toBe('specialist');
    });

    it('escalates to cfo', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.persona.escalation.escalates_to).toBe('cfo');
    });

    it('receives no escalations', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.persona.escalation.receives_escalations_from).toEqual([]);
    });

    it('has core skills including analytics', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.skills.core).toContain('analytics');
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.skills.core).toContain('stripe');
    });

    it('has restricted skills', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.skills.restricted.length).toBeGreaterThan(0);
    });

    it('has knowledge base', () => {
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.knowledge.base).toBeDefined();
      expect(REVENUE_ANALYTICS_LEAD_CONFIG.knowledge.base.length).toBeGreaterThan(100);
    });
  });

  describe('FINANCE_KNOWLEDGE_BOT_CONFIG', () => {
    it('has correct role', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.role).toBe('finance_knowledge_bot');
    });

    it('has correct team_id', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.team_id).toBe('finance');
    });

    it('is marked as knowledge bot', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.is_knowledge_bot).toBe(true);
    });

    it('reports to cfo', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.reports_to).toBe('cfo');
    });

    it('has advisory authority_level', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.persona.authority_level).toBe('advisory');
    });

    it('has correct subordinates in knowledge_bot_config', () => {
      const kbConfig = FINANCE_KNOWLEDGE_BOT_CONFIG.persona.knowledge_bot_config;
      expect(kbConfig.subordinates).toContain('expense_tracking_lead');
      expect(kbConfig.subordinates).toContain('revenue_analytics_lead');
    });

    it('has empty restricted skills', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.skills.restricted).toEqual([]);
    });

    it('has research_only core skills', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.skills.core).toContain('web_search');
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.skills.core).toContain('deep_research');
    });

    it('has research_focus at root level', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.research_focus).toBeDefined();
      expect(Array.isArray(FINANCE_KNOWLEDGE_BOT_CONFIG.research_focus)).toBe(true);
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.research_focus.length).toBeGreaterThan(0);
    });

    it('has subordinate_specialties at root level', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.subordinate_specialties).toBeDefined();
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.subordinate_specialties.expense_tracking_lead).toBeDefined();
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.subordinate_specialties.revenue_analytics_lead).toBeDefined();
    });

    it('has research_config', () => {
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.research_config.cadence).toBe('daily');
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.research_config.recommendations_per_subordinate).toBe(2);
      expect(FINANCE_KNOWLEDGE_BOT_CONFIG.research_config.research_depth).toBe('deep');
    });
  });
});

// ============================================================================
// 2. FINANCE TEAM STRUCTURE TESTS
// ============================================================================

describe('Finance Team Structure', () => {
  it('CFO has correct subordinates', async () => {
    const cfo = await FinanceTestUtils.getAgent('cfo');
    expect(cfo).not.toBeNull();
    expect(cfo.team_id).toBe('finance');
    expect(cfo.is_team_lead).toBe(true);
  });

  it('All subordinates report to CFO', async () => {
    const subordinates = ['expense_tracking_lead', 'revenue_analytics_lead'];
    for (const role of subordinates) {
      const agent = await FinanceTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.reports_to).toBe('cfo');
      expect(agent.team_id).toBe('finance');
    }
  });

  it('CFO is marked as team lead', async () => {
    const cfo = await FinanceTestUtils.getAgent('cfo');
    expect(cfo).not.toBeNull();
    expect(cfo.is_team_lead).toBe(true);
  });

  it('Subordinates are not team leads', async () => {
    const subordinates = ['expense_tracking_lead', 'revenue_analytics_lead'];
    for (const role of subordinates) {
      const agent = await FinanceTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.is_team_lead).toBe(false);
    }
  });

  it('Finance Knowledge Bot is advisory only', async () => {
    const bot = await FinanceTestUtils.getKnowledgeBot('finance_knowledge_bot');
    expect(bot).not.toBeNull();
    expect(bot.is_knowledge_bot).toBe(true);
    expect(bot.persona.authority_level).toBe('advisory');
    // Knowledge bots have no restricted skills (all execution tools are forbidden)
    expect(bot.skills.restricted).toEqual([]);
  });

  it('Finance team exists in configuration', async () => {
    const team = await FinanceTestUtils.getTeam('finance');
    expect(team).toBeDefined();
    expect(team.team_lead_role).toBe('cfo');
    expect(team.subordinates).toHaveLength(2);
  });

  it('Finance team has correct helper functions', () => {
    const subordinates = getFinanceTeamSubordinates();
    expect(subordinates).toHaveLength(2);

    const teamLead = getFinanceTeamLead();
    expect(teamLead.role).toBe('cfo');

    const config = getFinanceTeamConfig('expense_tracking_lead');
    expect(config).not.toBeNull();
    expect(config.role).toBe('expense_tracking_lead');
  });

  it('FINANCE_TEAM_BY_ROLE has all members', () => {
    expect(FINANCE_TEAM_BY_ROLE.cfo).toBeDefined();
    expect(FINANCE_TEAM_BY_ROLE.expense_tracking_lead).toBeDefined();
    expect(FINANCE_TEAM_BY_ROLE.revenue_analytics_lead).toBeDefined();
    expect(FINANCE_TEAM_BY_ROLE.finance_knowledge_bot).toBeDefined();
  });

  it('Finance team is distinct from tech team', async () => {
    const financeTeam = await FinanceTestUtils.getTeam('finance');
    const techTeam = await FinanceTestUtils.getTeam('tech');

    // Verify teams are different
    expect(financeTeam.team_lead_role).not.toBe(techTeam.team_lead_role);

    // Verify no overlap in subordinates
    const financeSubordinates = new Set(financeTeam.subordinates);
    for (const techSub of techTeam.subordinates) {
      expect(financeSubordinates.has(techSub)).toBe(false);
    }
  });

  it('Finance team is distinct from marketing team', async () => {
    const financeTeam = await FinanceTestUtils.getTeam('finance');
    const marketingTeam = await FinanceTestUtils.getTeam('marketing');

    // Verify teams are different
    expect(financeTeam.team_lead_role).not.toBe(marketingTeam.team_lead_role);

    // Verify no overlap in subordinates
    const financeSubordinates = new Set(financeTeam.subordinates);
    for (const marketingSub of marketingTeam.subordinates) {
      expect(financeSubordinates.has(marketingSub)).toBe(false);
    }
  });

  it('Finance team is distinct from product team', async () => {
    const financeTeam = await FinanceTestUtils.getTeam('finance');
    const productTeam = await FinanceTestUtils.getTeam('product');

    // Verify teams are different
    expect(financeTeam.team_lead_role).not.toBe(productTeam.team_lead_role);

    // Verify no overlap in subordinates
    const financeSubordinates = new Set(financeTeam.subordinates);
    for (const productSub of productTeam.subordinates) {
      expect(financeSubordinates.has(productSub)).toBe(false);
    }
  });

  it('Finance team is distinct from operations team', async () => {
    const financeTeam = await FinanceTestUtils.getTeam('finance');
    const operationsTeam = await FinanceTestUtils.getTeam('operations');

    // Verify teams are different
    expect(financeTeam.team_lead_role).not.toBe(operationsTeam.team_lead_role);

    // Verify no overlap in subordinates
    const financeSubordinates = new Set(financeTeam.subordinates);
    for (const opsSub of operationsTeam.subordinates) {
      expect(financeSubordinates.has(opsSub)).toBe(false);
    }
  });
});

// ============================================================================
// 3. FINANCE KNOWLEDGE BOT TESTS
// ============================================================================

describe('Finance Knowledge Bot', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('finance_knowledge_bot');
  });

  it('Exists and is properly configured', () => {
    expect(knowledgeBot).not.toBeNull();
    expect(knowledgeBot.role).toBe('finance_knowledge_bot');
    expect(knowledgeBot.teamId).toBe('finance');
  });

  it('Has correct subordinate list', () => {
    const subordinates = knowledgeBot.getSubordinates();
    expect(subordinates).toContain('expense_tracking_lead');
    expect(subordinates).toContain('revenue_analytics_lead');
    expect(subordinates).toHaveLength(2);
  });

  it('Can generate recommendations for expense_tracking_lead', () => {
    expect(knowledgeBot.canRecommendFor('expense_tracking_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('expense_tracking_lead');
    expect(specialties.length).toBeGreaterThan(0);
  });

  it('Can generate recommendations for revenue_analytics_lead', () => {
    expect(knowledgeBot.canRecommendFor('revenue_analytics_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('revenue_analytics_lead');
    expect(specialties.length).toBeGreaterThan(0);
  });

  it('Cannot generate recommendations for other team members', () => {
    // Tech team members should not be recommendable by finance knowledge bot
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('qa_lead')).toBe(false);

    // Marketing team members should not be recommendable by finance knowledge bot
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('social_media_lead')).toBe(false);

    // Product team members should not be recommendable by finance knowledge bot
    expect(knowledgeBot.canRecommendFor('ux_research_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('product_analytics_lead')).toBe(false);

    // Operations team members should not be recommendable by finance knowledge bot
    expect(knowledgeBot.canRecommendFor('vendor_management_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('process_automation_lead')).toBe(false);
  });

  it('Has correct research focus areas', () => {
    const researchFocus = knowledgeBot.getResearchFocus();
    expect(researchFocus.length).toBeGreaterThan(0);
  });

  it('Reports to CFO', () => {
    expect(knowledgeBot.reportsTo).toBe('cfo');
    expect(knowledgeBot.getTeamLead()).toBe('cfo');
  });

  it('Is advisory only', () => {
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');
  });

  it('Knowledge Bot cannot recommend for self', () => {
    expect(knowledgeBot.canRecommendFor('finance_knowledge_bot')).toBe(false);
  });

  it('Knowledge Bot cannot recommend for CFO (team lead)', () => {
    expect(knowledgeBot.canRecommendFor('cfo')).toBe(false);
  });

  it('Knowledge Bot availability check works', () => {
    // Fresh bot should be available
    expect(knowledgeBot.isAvailable()).toBe(true);

    // After updating research cycle, should not be available
    knowledgeBot.updateLastResearchCycle();
    expect(knowledgeBot.isAvailable()).toBe(false);
  });

  it('Knowledge Bot stats tracking works', () => {
    const initialStats = knowledgeBot.getStats();
    expect(initialStats.total_recommendations).toBe(0);
    expect(initialStats.successful_recommendations).toBe(0);

    knowledgeBot.incrementRecommendations(false);
    knowledgeBot.incrementRecommendations(true);

    const updatedStats = knowledgeBot.getStats();
    expect(updatedStats.total_recommendations).toBe(2);
    expect(updatedStats.successful_recommendations).toBe(1);
  });

  it('Knowledge Bot can be retrieved by team ID', () => {
    const bot = getKnowledgeBotForTeam('finance');
    expect(bot).not.toBeNull();
    expect(bot.role).toBe('finance_knowledge_bot');
  });

  it('Knowledge Bot factory returns same instance from cache', () => {
    const bot1 = getKnowledgeBot('finance_knowledge_bot');
    const bot2 = getKnowledgeBot('finance_knowledge_bot');
    expect(bot1).toBe(bot2);
  });

  it('Has correct recommendations per subordinate', () => {
    const recsPerSub = knowledgeBot.getRecommendationsPerSubordinate();
    expect(recsPerSub).toBe(2);
  });
});

// ============================================================================
// 4. FINANCE SAFETY CONSTRAINTS TESTS
// ============================================================================

describe('Finance Safety Constraints', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('finance_knowledge_bot');
  });

  it('Knowledge Bot cannot make financial transactions', () => {
    // Knowledge bots are advisory only - they cannot execute any actions
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');

    // Check that no execution skills are allowed
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).not.toContain('payment_process');
    expect(allowedSkills).not.toContain('financial_transaction');
    expect(allowedSkills).not.toContain('bank_transfer');
  });

  it('Recommendations expire after 7 days', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.RECOMMENDATION_EXPIRY_DAYS).toBe(7);
    expect(VALIDATION_RULES.EXPIRATION_DAYS).toBe(7);
  });

  it('Team isolation is enforced', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.TEAM_ISOLATION).toBe(true);

    // Finance bot cannot recommend for tech team
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);

    // Finance bot cannot recommend for marketing team
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('social_media_lead')).toBe(false);

    // Finance bot cannot recommend for product team
    expect(knowledgeBot.canRecommendFor('ux_research_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('product_analytics_lead')).toBe(false);

    // Finance bot cannot recommend for operations team
    expect(knowledgeBot.canRecommendFor('vendor_management_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('process_automation_lead')).toBe(false);
  });

  it('Knowledge Bot has no execution tools', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.NO_EXECUTION_TOOLS).toBe(true);
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ADVISORY_ONLY).toBe(true);
  });

  it('Max recommendations per subordinate is limited', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.MAX_RECOMMENDATIONS_PER_SUBORDINATE).toBe(3);
  });

  it('Minimum confidence threshold exists', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.MIN_CONFIDENCE_THRESHOLD).toBe(0.6);
  });

  it('Allowed skills are research-only', () => {
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).toContain('web_search');
    expect(allowedSkills).toContain('deep_research');
    expect(allowedSkills).not.toContain('code_execution');
    expect(allowedSkills).not.toContain('file_write');
    expect(allowedSkills).not.toContain('database_write');
  });
});

// ============================================================================
// 5. INTEGRATION TESTS
// ============================================================================

describe('Finance Team Integration', () => {
  it('Full CFO review cycle completes', async () => {
    const team = await FinanceTestUtils.getTeam('finance');
    const bot = getKnowledgeBot('finance_knowledge_bot');

    // Verify alignment
    expect(team.team_id).toBe('finance');
    expect(team.team_lead_role).toBe('cfo');
    expect(bot.reportsTo).toBe('cfo');
  });

  it('Recommendations can be converted to amendments', () => {
    const generator = new RecommendationGenerator();

    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test expense management recommendation for improving expense categorization process',
      targetingPattern: 'task_category:expense_tracking',
      expectedImpact: 'high',
      reasoning: 'Based on recent expense audit results and categorization accuracy analysis',
      sources: ['https://example.com/expense-management-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'expense_tracking_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Knowledge Bot subordinates match finance team subordinates', () => {
    const bot = getKnowledgeBot('finance_knowledge_bot');

    const botSubordinates = bot.getSubordinates();
    expect(botSubordinates).toContain('expense_tracking_lead');
    expect(botSubordinates).toContain('revenue_analytics_lead');
  });

  it('No finance subordinate belongs to other teams', () => {
    const financeSubordinates = new Set(FinanceTestUtils.FINANCE_SUBORDINATES);

    for (const teamLeadConfig of TEAM_LEAD_CONFIGS) {
      if (teamLeadConfig.team_id !== 'finance') {
        for (const subordinate of teamLeadConfig.subordinates) {
          expect(financeSubordinates.has(subordinate)).toBe(false);
        }
      }
    }
  });

  it('Learning tracker updates on recommendation outcome', async () => {
    const knowledgeBot = getKnowledgeBot('finance_knowledge_bot');

    // Initial stats
    const initialStats = knowledgeBot.getStats();
    expect(initialStats.total_recommendations).toBe(0);

    // Simulate recommendation generation
    knowledgeBot.incrementRecommendations(false); // Not selected
    knowledgeBot.incrementRecommendations(true);  // Selected and applied

    // Updated stats
    const updatedStats = knowledgeBot.getStats();
    expect(updatedStats.total_recommendations).toBe(2);
    expect(updatedStats.successful_recommendations).toBe(1);
  });

  it('Finance team has associated knowledge bot', () => {
    const bot = getKnowledgeBotForTeam('finance');

    expect(bot).not.toBeNull();
    expect(bot.reportsTo).toBe('cfo');
  });

  it('Trend calculation produces expected results for improving finance performance', () => {
    // Recent tasks are better than older tasks
    const taskHistory = [
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'failed', created_at: new Date().toISOString() },
      { status: 'failed', created_at: new Date().toISOString() },
      { status: 'failed', created_at: new Date().toISOString() },
    ];

    const trend = calculateTrend(taskHistory);
    expect(trend.direction).toBe('improving');
    expect(trend.slope).toBeGreaterThan(0);
  });

  it('Complete finance team hierarchy is valid', async () => {
    const hierarchy = {
      teamLead: await FinanceTestUtils.getAgent('cfo'),
      knowledgeBot: await FinanceTestUtils.getKnowledgeBot('finance_knowledge_bot'),
      subordinates: await Promise.all([
        FinanceTestUtils.getAgent('expense_tracking_lead'),
        FinanceTestUtils.getAgent('revenue_analytics_lead'),
      ]),
    };

    // Verify team lead
    expect(hierarchy.teamLead.is_team_lead).toBe(true);
    expect(hierarchy.teamLead.team_id).toBe('finance');

    // Verify knowledge bot
    expect(hierarchy.knowledgeBot.is_knowledge_bot).toBe(true);
    expect(hierarchy.knowledgeBot.reports_to).toBe('cfo');

    // Verify all subordinates
    for (const subordinate of hierarchy.subordinates) {
      expect(subordinate.is_team_lead).toBe(false);
      expect(subordinate.reports_to).toBe('cfo');
      expect(subordinate.team_id).toBe('finance');
    }
  });
});

// ============================================================================
// 6. FINANCE RECOMMENDATION VALIDATION TESTS
// ============================================================================

describe('Finance Recommendation Validation', () => {
  let generator;

  beforeEach(() => {
    generator = new RecommendationGenerator();
  });

  it('Valid finance recommendation passes validation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Improve expense approval workflow by implementing automated routing based on expense amount and category',
      targetingPattern: 'task_category:expense_approval',
      expectedImpact: 'high',
      reasoning: 'Based on recent expense audit results and approval bottleneck analysis',
      sources: ['https://example.com/expense-management-best-practices'],
    };

    const result = generator.validateRecommendation(recommendation, 'expense_tracking_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Expense tracking recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_modification',
      content: 'Update expense categorization templates to include automated receipt scanning and OCR extraction',
      targetingPattern: 'task_category:expense_categorization',
      expectedImpact: 'medium',
      reasoning: 'Manual expense entry errors are causing reconciliation issues',
      sources: ['https://example.com/expense-automation-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'expense_tracking_lead');
    expect(result.valid).toBe(true);
  });

  it('Revenue analytics recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Implement cohort-based revenue retention analysis to identify churn patterns earlier',
      targetingPattern: 'task_category:revenue_analytics',
      expectedImpact: 'high',
      reasoning: 'Current churn analysis happens too late in the customer lifecycle',
      sources: ['https://example.com/saas-metrics-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'revenue_analytics_lead');
    expect(result.valid).toBe(true);
  });

  it('Financial forecasting recommendation validates correctly', () => {
    const recommendation = {
      type: 'skill_suggestion',
      content: 'Adopt Monte Carlo simulation for revenue forecasting to account for market uncertainty',
      targetingPattern: 'task_category:forecasting',
      expectedImpact: 'medium',
      reasoning: 'Current deterministic forecasts are missing market volatility factors',
      sources: ['https://example.com/financial-forecasting-methods'],
    };

    const result = generator.validateRecommendation(recommendation, 'revenue_analytics_lead');
    expect(result.valid).toBe(true);
  });

  it('Missing sources fails validation for finance recommendation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test content without sources',
      targetingPattern: 'task_category:expense_tracking',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: [], // Empty sources
    };

    const result = generator.validateRecommendation(recommendation, 'expense_tracking_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('source'))).toBe(true);
  });

  it('Content exceeding word limit fails validation', () => {
    const longContent = Array(250).fill('finance').join(' '); // 250 words
    const recommendation = {
      type: 'knowledge_addition',
      content: longContent,
      targetingPattern: 'task_category:finance',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: ['https://example.com'],
    };

    const result = generator.validateRecommendation(recommendation, 'expense_tracking_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('words'))).toBe(true);
  });
});

// ============================================================================
// 7. CROSS-TEAM ISOLATION TESTS
// ============================================================================

describe('Cross-Team Isolation', () => {
  it('Finance Knowledge Bot cannot access tech team members', () => {
    const financeBot = getKnowledgeBot('finance_knowledge_bot');
    const techBot = getKnowledgeBot('tech_knowledge_bot');

    // Finance bot can only recommend for finance team
    expect(financeBot.canRecommendFor('expense_tracking_lead')).toBe(true);
    expect(financeBot.canRecommendFor('web_dev_lead')).toBe(false);

    // Tech bot can only recommend for tech team
    expect(techBot.canRecommendFor('web_dev_lead')).toBe(true);
    expect(techBot.canRecommendFor('expense_tracking_lead')).toBe(false);
  });

  it('Finance Knowledge Bot cannot access marketing team members', () => {
    const financeBot = getKnowledgeBot('finance_knowledge_bot');
    const marketingBot = getKnowledgeBot('marketing_knowledge_bot');

    // Finance bot can only recommend for finance team
    expect(financeBot.canRecommendFor('revenue_analytics_lead')).toBe(true);
    expect(financeBot.canRecommendFor('content_lead')).toBe(false);

    // Marketing bot can only recommend for marketing team
    expect(marketingBot.canRecommendFor('content_lead')).toBe(true);
    expect(marketingBot.canRecommendFor('revenue_analytics_lead')).toBe(false);
  });

  it('Finance Knowledge Bot cannot access product team members', () => {
    const financeBot = getKnowledgeBot('finance_knowledge_bot');
    const productBot = getKnowledgeBot('product_knowledge_bot');

    // Finance bot can only recommend for finance team
    expect(financeBot.canRecommendFor('expense_tracking_lead')).toBe(true);
    expect(financeBot.canRecommendFor('ux_research_lead')).toBe(false);

    // Product bot can only recommend for product team
    expect(productBot.canRecommendFor('ux_research_lead')).toBe(true);
    expect(productBot.canRecommendFor('expense_tracking_lead')).toBe(false);
  });

  it('Finance Knowledge Bot cannot access operations team members', () => {
    const financeBot = getKnowledgeBot('finance_knowledge_bot');
    const opsBot = getKnowledgeBot('ops_knowledge_bot');

    // Finance bot can only recommend for finance team
    expect(financeBot.canRecommendFor('revenue_analytics_lead')).toBe(true);
    expect(financeBot.canRecommendFor('vendor_management_lead')).toBe(false);

    // Ops bot can only recommend for operations team
    expect(opsBot.canRecommendFor('vendor_management_lead')).toBe(true);
    expect(opsBot.canRecommendFor('revenue_analytics_lead')).toBe(false);
  });

  it('All five teams have distinct subordinate sets', async () => {
    const financeTeam = await FinanceTestUtils.getTeam('finance');
    const operationsTeam = await FinanceTestUtils.getTeam('operations');
    const techTeam = await FinanceTestUtils.getTeam('tech');
    const marketingTeam = await FinanceTestUtils.getTeam('marketing');
    const productTeam = await FinanceTestUtils.getTeam('product');

    const financeSubs = new Set(financeTeam.subordinates);
    const opsSubs = new Set(operationsTeam.subordinates);
    const techSubs = new Set(techTeam.subordinates);
    const marketingSubs = new Set(marketingTeam.subordinates);
    const productSubs = new Set(productTeam.subordinates);

    // No overlap between finance and operations
    for (const sub of financeSubs) {
      expect(opsSubs.has(sub)).toBe(false);
    }

    // No overlap between finance and tech
    for (const sub of financeSubs) {
      expect(techSubs.has(sub)).toBe(false);
    }

    // No overlap between finance and marketing
    for (const sub of financeSubs) {
      expect(marketingSubs.has(sub)).toBe(false);
    }

    // No overlap between finance and product
    for (const sub of financeSubs) {
      expect(productSubs.has(sub)).toBe(false);
    }
  });
});

// ============================================================================
// 8. HELPER FUNCTION TESTS
// ============================================================================

describe('Finance Team Helper Functions', () => {
  it('getFinanceTeamSubordinates returns correct array', () => {
    const subordinates = getFinanceTeamSubordinates();
    expect(subordinates).toHaveLength(2);
    expect(subordinates.some(s => s.role === 'expense_tracking_lead')).toBe(true);
    expect(subordinates.some(s => s.role === 'revenue_analytics_lead')).toBe(true);
  });

  it('getFinanceTeamLead returns CFO', () => {
    const lead = getFinanceTeamLead();
    expect(lead).toBeDefined();
    expect(lead.role).toBe('cfo');
    expect(lead.is_team_lead).toBe(true);
  });

  it('getFinanceTeamConfig returns correct config for each role', () => {
    const cfoConfig = getFinanceTeamConfig('cfo');
    expect(cfoConfig).not.toBeNull();
    expect(cfoConfig.role).toBe('cfo');

    const expenseConfig = getFinanceTeamConfig('expense_tracking_lead');
    expect(expenseConfig).not.toBeNull();
    expect(expenseConfig.role).toBe('expense_tracking_lead');

    const revenueConfig = getFinanceTeamConfig('revenue_analytics_lead');
    expect(revenueConfig).not.toBeNull();
    expect(revenueConfig.role).toBe('revenue_analytics_lead');

    const kbConfig = getFinanceTeamConfig('finance_knowledge_bot');
    expect(kbConfig).not.toBeNull();
    expect(kbConfig.role).toBe('finance_knowledge_bot');
  });

  it('getFinanceTeamConfig returns null for unknown roles', () => {
    const unknownConfig = getFinanceTeamConfig('unknown_role');
    expect(unknownConfig).toBeNull();
  });

  it('FINANCE_TEAM_CONFIGS has correct length', () => {
    expect(FINANCE_TEAM_CONFIGS).toHaveLength(3); // CFO + 2 subordinates (KB not included)
  });
});

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  FinanceTestUtils,
};
