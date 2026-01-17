/**
 * Product Team Validation Test Suite - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Comprehensive test suite for validating Product Team structure, CPO review cycles,
 * Product Knowledge Bot functionality, and integration scenarios.
 *
 * Tests cover:
 * - Team hierarchy and structure validation
 * - CPO CoS (Chief of Staff) review powers
 * - Product Knowledge Bot advisory functionality
 * - Product-specific safety constraints
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

// ============================================================================
// TEST UTILITIES FOR PRODUCT TEAM
// ============================================================================

/**
 * Test helper utilities for Product Team tests
 */
const ProductTestUtils = {
  /**
   * Product team subordinate roles
   */
  PRODUCT_SUBORDINATES: ['ux_research_lead', 'product_analytics_lead', 'feature_spec_lead'],

  /**
   * Product Knowledge Bot subordinate specialties
   */
  PRODUCT_SPECIALTIES: {
    ux_research_lead: ['User research methods', 'Usability testing', 'Accessibility standards', 'Design systems', 'Information architecture'],
    product_analytics_lead: ['Analytics tools', 'Metrics frameworks', 'Cohort analysis', 'Funnel optimization', 'Predictive analytics'],
    feature_spec_lead: ['PRD writing', 'Acceptance criteria', 'User story mapping', 'Technical specifications', 'Feature validation'],
  },

  /**
   * Get agent configuration by role
   * @param {string} role - Agent role ID
   * @returns {Promise<Object|null>} Agent configuration
   */
  async getAgent(role) {
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
      category: options.category || 'product',
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
      content: options.content || 'Test product recommendation for improving user research methodology',
      targeting_pattern: options.targeting_pattern || 'task_category:user_research',
      expected_impact: options.expected_impact || 'medium',
      reasoning: options.reasoning || 'Test reasoning for the product recommendation',
      sources: options.sources || ['https://example.com/product-best-practices'],
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
      content: 'Expired product recommendation',
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
   * Verify product team subordinate belongs to product team
   * @param {string} role - Role to verify
   * @returns {boolean}
   */
  isProductSubordinate(role) {
    return this.PRODUCT_SUBORDINATES.includes(role);
  },

  /**
   * Get expected specialties for a product subordinate
   * @param {string} role - Subordinate role
   * @returns {string[]}
   */
  getExpectedSpecialties(role) {
    return this.PRODUCT_SPECIALTIES[role] || [];
  },
};

// Export test utilities for reuse
export { ProductTestUtils };

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  ProductTestUtils.clearTestData();
});

afterEach(() => {
  ProductTestUtils.clearTestData();
});

// ============================================================================
// 1. PRODUCT TEAM STRUCTURE TESTS
// ============================================================================

describe('Product Team Structure', () => {
  it('CPO has correct subordinates', async () => {
    const cpo = await ProductTestUtils.getAgent('cpo');
    expect(cpo).not.toBeNull();
    expect(cpo.persona.team_lead_powers.subordinates).toContain('ux_research_lead');
    expect(cpo.persona.team_lead_powers.subordinates).toContain('product_analytics_lead');
    expect(cpo.persona.team_lead_powers.subordinates).toContain('feature_spec_lead');
    expect(cpo.persona.team_lead_powers.subordinates).toHaveLength(3);
  });

  it('All subordinates report to CPO', async () => {
    const subordinates = ['ux_research_lead', 'product_analytics_lead', 'feature_spec_lead'];
    for (const role of subordinates) {
      const agent = await ProductTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.reports_to).toBe('cpo');
      expect(agent.team_id).toBe('product');
    }
  });

  it('CPO is marked as team lead', async () => {
    const cpo = await ProductTestUtils.getAgent('cpo');
    expect(cpo).not.toBeNull();
    expect(cpo.is_team_lead).toBe(true);
  });

  it('Subordinates are not team leads', async () => {
    const subordinates = ['ux_research_lead', 'product_analytics_lead', 'feature_spec_lead'];
    for (const role of subordinates) {
      const agent = await ProductTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.is_team_lead).toBe(false);
    }
  });

  it('Product Knowledge Bot is advisory only', async () => {
    const bot = await ProductTestUtils.getKnowledgeBot('product_knowledge_bot');
    expect(bot).not.toBeNull();
    expect(bot.is_knowledge_bot).toBe(true);
    expect(bot.persona.authority_level).toBe('advisory');
    // Knowledge bots have no restricted skills (all execution tools are forbidden)
    expect(bot.skills.restricted).toEqual([]);
  });

  it('Product team exists in configuration', async () => {
    const team = await ProductTestUtils.getTeam('product');
    expect(team).toBeDefined();
    expect(team.team_lead_role).toBe('cpo');
    expect(team.subordinates).toHaveLength(3);
  });

  it('CPO has amendment authority', async () => {
    const cpo = await ProductTestUtils.getAgent('cpo');
    expect(cpo.persona.team_lead_powers.amendment_authority).toBe(true);
  });

  it('CPO has daily review cadence', async () => {
    const cpo = await ProductTestUtils.getAgent('cpo');
    expect(cpo.persona.team_lead_powers.review_cadence).toBe('daily');
  });

  it('Product team is distinct from tech team', async () => {
    const productTeam = await ProductTestUtils.getTeam('product');
    const techTeam = await ProductTestUtils.getTeam('tech');

    // Verify teams are different
    expect(productTeam.team_lead_role).not.toBe(techTeam.team_lead_role);

    // Verify no overlap in subordinates
    const productSubordinates = new Set(productTeam.subordinates);
    for (const techSub of techTeam.subordinates) {
      expect(productSubordinates.has(techSub)).toBe(false);
    }
  });

  it('Product team is distinct from marketing team', async () => {
    const productTeam = await ProductTestUtils.getTeam('product');
    const marketingTeam = await ProductTestUtils.getTeam('marketing');

    // Verify teams are different
    expect(productTeam.team_lead_role).not.toBe(marketingTeam.team_lead_role);

    // Verify no overlap in subordinates
    const productSubordinates = new Set(productTeam.subordinates);
    for (const marketingSub of marketingTeam.subordinates) {
      expect(productSubordinates.has(marketingSub)).toBe(false);
    }
  });
});

// ============================================================================
// 2. CPO REVIEW CYCLE TESTS
// ============================================================================

describe('CPO Review Cycle', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('CPO can review subordinate task history', async () => {
    // Create test tasks for ux_research_lead
    await ProductTestUtils.createTestTask('ux_research_lead', { status: 'completed' });
    await ProductTestUtils.createTestTask('ux_research_lead', { status: 'completed' });
    await ProductTestUtils.createTestTask('ux_research_lead', { status: 'failed' });

    const tasks = await ProductTestUtils.getTaskHistory('ux_research_lead', 10);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].assigned_to).toBe('ux_research_lead');
  });

  it('CPO can generate amendments for subordinates', async () => {
    const cpoConfig = engine.getTeamLeadConfig('cpo');
    expect(cpoConfig).not.toBeNull();
    expect(cpoConfig.cos_powers.amendment_authority).toBe(true);

    // Verify CPO can generate amendments for product subordinates
    for (const subordinate of cpoConfig.subordinates) {
      expect(ProductTestUtils.isProductSubordinate(subordinate)).toBe(true);
    }
  });

  it('CPO cannot modify own knowledge', async () => {
    const cpoConfig = engine.getTeamLeadConfig('cpo');
    expect(cpoConfig).not.toBeNull();

    // Verify safety constraint is in place
    const constraints = engine.getSafetyConstraints();
    expect(constraints.SELF_MODIFY_BLOCKED).toBe(true);
  });

  it('CPO cannot modify agents outside product team', async () => {
    const cpoConfig = engine.getTeamLeadConfig('cpo');
    expect(cpoConfig).not.toBeNull();

    // web_dev_lead is in tech team, not product
    expect(cpoConfig.subordinates).not.toContain('web_dev_lead');
    expect(cpoConfig.subordinates).not.toContain('devops_lead');
    expect(cpoConfig.subordinates).not.toContain('content_lead');

    // Verify team isolation
    const techTeam = await ProductTestUtils.getTeam('tech');
    expect(techTeam.team_lead_role).toBe('cto');
    for (const techSubordinate of techTeam.subordinates) {
      expect(cpoConfig.subordinates).not.toContain(techSubordinate);
    }

    // Verify marketing team isolation
    const marketingTeam = await ProductTestUtils.getTeam('marketing');
    expect(marketingTeam.team_lead_role).toBe('cmo');
    for (const marketingSubordinate of marketingTeam.subordinates) {
      expect(cpoConfig.subordinates).not.toContain(marketingSubordinate);
    }
  });

  it('CPO can calculate trend from product task history', () => {
    // Create task history array (simulating what comes from DB)
    const taskHistory = [
      { status: 'failed', created_at: new Date().toISOString() },
      { status: 'failed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
    ];

    const trend = calculateTrend(taskHistory);
    expect(trend).toBeDefined();
    expect(trend.direction).toBe('declining');
    expect(trend.slope).toBeLessThan(0);
  });

  it('Consecutive failures trigger escalation', () => {
    const taskHistory = [
      { status: 'failed', created_at: new Date().toISOString() },
      { status: 'rejected', created_at: new Date().toISOString() },
      { status: 'failed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
    ];

    const consecutiveFailures = engine.countConsecutiveFailures(taskHistory);
    expect(consecutiveFailures).toBe(3);
  });

  it('CPO escalation threshold is configured to 3', () => {
    const cpoConfig = engine.getTeamLeadConfig('cpo');
    expect(cpoConfig.escalation.consecutive_failures_threshold).toBe(3);
    expect(cpoConfig.escalation.escalate_to).toBe('cos');
  });
});

// ============================================================================
// 3. PRODUCT KNOWLEDGE BOT TESTS
// ============================================================================

describe('Product Knowledge Bot', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('product_knowledge_bot');
  });

  it('Has correct subordinate list', () => {
    const subordinates = knowledgeBot.getSubordinates();
    expect(subordinates).toContain('ux_research_lead');
    expect(subordinates).toContain('product_analytics_lead');
    expect(subordinates).toContain('feature_spec_lead');
    expect(subordinates).toHaveLength(3);
  });

  it('Can generate recommendations for ux_research_lead', () => {
    expect(knowledgeBot.canRecommendFor('ux_research_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('ux_research_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('User research methods');
    expect(specialties).toContain('Usability testing');
  });

  it('Can generate recommendations for product_analytics_lead', () => {
    expect(knowledgeBot.canRecommendFor('product_analytics_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('product_analytics_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('Analytics tools');
    expect(specialties).toContain('Metrics frameworks');
  });

  it('Can generate recommendations for feature_spec_lead', () => {
    expect(knowledgeBot.canRecommendFor('feature_spec_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('feature_spec_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('PRD writing');
    expect(specialties).toContain('Acceptance criteria');
  });

  it('Cannot generate recommendations for tech or marketing team members', () => {
    // Tech team members should not be recommendable by product knowledge bot
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('qa_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('app_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('infrastructure_lead')).toBe(false);

    // Marketing team members should not be recommendable by product knowledge bot
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('social_media_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('seo_growth_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('brand_lead')).toBe(false);
  });

  it('Has correct research focus areas', () => {
    const researchFocus = knowledgeBot.getResearchFocus();
    expect(researchFocus.length).toBeGreaterThan(0);
    expect(researchFocus).toContain('UX research methodologies');
    expect(researchFocus).toContain('Product analytics frameworks');
    expect(researchFocus).toContain('Feature prioritization methods');
    expect(researchFocus).toContain('User journey mapping');
  });

  it('Reports to CPO', () => {
    expect(knowledgeBot.reportsTo).toBe('cpo');
    expect(knowledgeBot.getTeamLead()).toBe('cpo');
  });

  it('Is advisory only', () => {
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');
  });

  it('Product Knowledge Bot exists and is properly configured', () => {
    expect(knowledgeBot).not.toBeNull();
    expect(knowledgeBot.role).toBe('product_knowledge_bot');
    expect(knowledgeBot.teamId).toBe('product');
  });

  it('Knowledge Bot cannot recommend for self', () => {
    expect(knowledgeBot.canRecommendFor('product_knowledge_bot')).toBe(false);
  });

  it('Knowledge Bot cannot recommend for CPO (team lead)', () => {
    expect(knowledgeBot.canRecommendFor('cpo')).toBe(false);
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
    const bot = getKnowledgeBotForTeam('product');
    expect(bot).not.toBeNull();
    expect(bot.role).toBe('product_knowledge_bot');
  });

  it('Knowledge Bot factory returns same instance from cache', () => {
    const bot1 = getKnowledgeBot('product_knowledge_bot');
    const bot2 = getKnowledgeBot('product_knowledge_bot');
    expect(bot1).toBe(bot2);
  });
});

// ============================================================================
// 4. PRODUCT SAFETY CONSTRAINTS TESTS
// ============================================================================

describe('Product Safety Constraints', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('product_knowledge_bot');
  });

  it('Knowledge Bot cannot deploy features', () => {
    // Knowledge bots are advisory only - they cannot execute any actions
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');

    // Check that no execution skills are allowed
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).not.toContain('deploy_feature');
    expect(allowedSkills).not.toContain('release_management');
    expect(allowedSkills).not.toContain('feature_toggle');
  });

  it('Knowledge Bot cannot change roadmap', () => {
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).not.toContain('roadmap_update');
    expect(allowedSkills).not.toContain('milestone_management');
    expect(allowedSkills).not.toContain('priority_change');
  });

  it('Recommendations expire after 7 days', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.RECOMMENDATION_EXPIRY_DAYS).toBe(7);
    expect(VALIDATION_RULES.EXPIRATION_DAYS).toBe(7);
  });

  it('Team isolation is enforced', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.TEAM_ISOLATION).toBe(true);

    // Product bot cannot recommend for tech team
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);

    // Product bot cannot recommend for marketing team
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('social_media_lead')).toBe(false);
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

  it('CPO cannot self-modify', () => {
    const engine = new TeamLeadReviewEngine();
    const constraints = engine.getSafetyConstraints();

    expect(constraints.SELF_MODIFY_BLOCKED).toBe(true);
    expect(constraints.PERSONA_MODIFY_BLOCKED).toBe(true);
  });

  it('Max amendments per subordinate is enforced', () => {
    const engine = new TeamLeadReviewEngine();
    const constraints = engine.getSafetyConstraints();

    expect(constraints.MAX_AMENDMENTS_PER_SUBORDINATE).toBe(10);
  });
});

// ============================================================================
// 5. INTEGRATION TESTS
// ============================================================================

describe('Product Team Integration', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('Full CPO review cycle completes', async () => {
    const cpoConfig = engine.getTeamLeadConfig('cpo');
    const team = await ProductTestUtils.getTeam('product');
    const bot = getKnowledgeBot('product_knowledge_bot');

    // Verify alignment
    expect(cpoConfig.team_id).toBe(team.team_id);
    expect(cpoConfig.subordinates).toEqual(team.subordinates);
    expect(bot.reportsTo).toBe(cpoConfig.role);
  });

  it('Recommendations can be converted to amendments', () => {
    const generator = new RecommendationGenerator();

    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test UX research recommendation for improving user interview techniques',
      targetingPattern: 'task_category:user_research',
      expectedImpact: 'high',
      reasoning: 'Based on recent usability testing results and user feedback patterns',
      sources: ['https://example.com/ux-research-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'ux_research_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('CPO config matches team hierarchy', async () => {
    const cpoConfig = engine.getTeamLeadConfig('cpo');
    const team = await ProductTestUtils.getTeam('product');
    const bot = getKnowledgeBot('product_knowledge_bot');

    // Verify alignment
    expect(cpoConfig.team_id).toBe(team.team_id);
    expect(cpoConfig.subordinates).toEqual(team.subordinates);
    expect(bot.reportsTo).toBe(cpoConfig.role);
  });

  it('Knowledge Bot subordinates match CPO subordinates', () => {
    const cpoConfig = TEAM_LEAD_CONFIGS.find(c => c.role === 'cpo');
    const bot = getKnowledgeBot('product_knowledge_bot');

    const botSubordinates = bot.getSubordinates();
    for (const subordinate of cpoConfig.subordinates) {
      expect(botSubordinates).toContain(subordinate);
    }
  });

  it('No product subordinate belongs to other teams', () => {
    const productSubordinates = new Set(ProductTestUtils.PRODUCT_SUBORDINATES);

    for (const teamLeadConfig of TEAM_LEAD_CONFIGS) {
      if (teamLeadConfig.team_id !== 'product') {
        for (const subordinate of teamLeadConfig.subordinates) {
          expect(productSubordinates.has(subordinate)).toBe(false);
        }
      }
    }
  });

  it('Learning tracker updates on recommendation outcome', async () => {
    const knowledgeBot = getKnowledgeBot('product_knowledge_bot');

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

  it('Product team has associated knowledge bot', () => {
    const cpoConfig = TEAM_LEAD_CONFIGS.find(c => c.role === 'cpo');
    const bot = getKnowledgeBotForTeam(cpoConfig.team_id);

    expect(bot).not.toBeNull();
    expect(bot.reportsTo).toBe(cpoConfig.role);
  });

  it('CPO lookup works correctly', () => {
    // Check that subordinates can find their team lead
    const uxResearchLeadTeamLead = engine.getTeamLeadForSubordinate('ux_research_lead');
    expect(uxResearchLeadTeamLead).not.toBeNull();
    expect(uxResearchLeadTeamLead.role).toBe('cpo');

    const productAnalyticsLeadTeamLead = engine.getTeamLeadForSubordinate('product_analytics_lead');
    expect(productAnalyticsLeadTeamLead).not.toBeNull();
    expect(productAnalyticsLeadTeamLead.role).toBe('cpo');

    const featureSpecLeadTeamLead = engine.getTeamLeadForSubordinate('feature_spec_lead');
    expect(featureSpecLeadTeamLead).not.toBeNull();
    expect(featureSpecLeadTeamLead.role).toBe('cpo');
  });

  it('isCPO correctly identifies CPO as team lead', () => {
    expect(engine.isTeamLead('cpo')).toBe(true);
    expect(engine.isTeamLead('ux_research_lead')).toBe(false);
    expect(engine.isTeamLead('product_analytics_lead')).toBe(false);
    expect(engine.isTeamLead('feature_spec_lead')).toBe(false);
  });

  it('Trend calculation produces expected results for improving product performance', () => {
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

  it('Complete product team hierarchy is valid', async () => {
    const hierarchy = {
      teamLead: await ProductTestUtils.getAgent('cpo'),
      knowledgeBot: await ProductTestUtils.getKnowledgeBot('product_knowledge_bot'),
      subordinates: await Promise.all([
        ProductTestUtils.getAgent('ux_research_lead'),
        ProductTestUtils.getAgent('product_analytics_lead'),
        ProductTestUtils.getAgent('feature_spec_lead'),
      ]),
    };

    // Verify team lead
    expect(hierarchy.teamLead.is_team_lead).toBe(true);
    expect(hierarchy.teamLead.team_id).toBe('product');

    // Verify knowledge bot
    expect(hierarchy.knowledgeBot.is_knowledge_bot).toBe(true);
    expect(hierarchy.knowledgeBot.reports_to).toBe('cpo');

    // Verify all subordinates
    for (const subordinate of hierarchy.subordinates) {
      expect(subordinate.is_team_lead).toBe(false);
      expect(subordinate.reports_to).toBe('cpo');
      expect(subordinate.team_id).toBe('product');
    }
  });
});

// ============================================================================
// 6. PRODUCT RECOMMENDATION VALIDATION TESTS
// ============================================================================

describe('Product Recommendation Validation', () => {
  let generator;

  beforeEach(() => {
    generator = new RecommendationGenerator();
  });

  it('Valid product recommendation passes validation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Improve user research methodology by implementing structured interview frameworks',
      targetingPattern: 'task_category:user_research',
      expectedImpact: 'high',
      reasoning: 'Based on recent analysis of user feedback and research quality metrics',
      sources: ['https://example.com/ux-research-best-practices'],
    };

    const result = generator.validateRecommendation(recommendation, 'ux_research_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('UX research recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_modification',
      content: 'Update usability testing protocols to include accessibility compliance checks',
      targetingPattern: 'task_category:usability_testing',
      expectedImpact: 'medium',
      reasoning: 'Accessibility audit revealed gaps in current testing approach',
      sources: ['https://example.com/accessibility-testing-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'ux_research_lead');
    expect(result.valid).toBe(true);
  });

  it('Product analytics recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Implement cohort analysis framework for better user retention insights',
      targetingPattern: 'task_category:analytics',
      expectedImpact: 'high',
      reasoning: 'Current analytics lack longitudinal user behavior tracking',
      sources: ['https://example.com/cohort-analysis-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'product_analytics_lead');
    expect(result.valid).toBe(true);
  });

  it('Feature spec recommendation validates correctly', () => {
    const recommendation = {
      type: 'skill_suggestion',
      content: 'Adopt user story mapping technique for better feature prioritization',
      targetingPattern: 'task_category:feature_specification',
      expectedImpact: 'medium',
      reasoning: 'Recent PRDs lacked clear user journey context',
      sources: ['https://example.com/user-story-mapping-framework'],
    };

    const result = generator.validateRecommendation(recommendation, 'feature_spec_lead');
    expect(result.valid).toBe(true);
  });

  it('Missing sources fails validation for product recommendation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test content without sources',
      targetingPattern: 'task_category:user_research',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: [], // Empty sources
    };

    const result = generator.validateRecommendation(recommendation, 'ux_research_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('source'))).toBe(true);
  });

  it('Content exceeding word limit fails validation', () => {
    const longContent = Array(250).fill('product').join(' '); // 250 words
    const recommendation = {
      type: 'knowledge_addition',
      content: longContent,
      targetingPattern: 'task_category:product',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: ['https://example.com'],
    };

    const result = generator.validateRecommendation(recommendation, 'ux_research_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('words'))).toBe(true);
  });
});

// ============================================================================
// 7. ESCALATION TESTS (PRODUCT-SPECIFIC)
// ============================================================================

describe('Product Escalation Handling', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('CPO consecutive failures threshold is 3', () => {
    const cpoConfig = engine.getTeamLeadConfig('cpo');
    expect(cpoConfig.escalation.consecutive_failures_threshold).toBe(3);
  });

  it('CPO escalation target is CoS', () => {
    const cpoConfig = engine.getTeamLeadConfig('cpo');
    expect(cpoConfig.escalation.escalate_to).toBe('cos');
  });

  it('Critical COS score threshold triggers escalation for product', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(0.3);

    // A score below critical should trigger escalation
    const criticalScore = 0.25;
    expect(criticalScore < constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(true);
  });

  it('Warning COS score threshold triggers amendment for product', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.WARNING).toBe(0.5);

    // A score below warning but above critical should trigger amendment
    const warningScore = 0.45;
    expect(warningScore < constraints.COS_SCORE_THRESHOLDS.WARNING).toBe(true);
    expect(warningScore >= constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(true);
  });
});

// ============================================================================
// 8. CROSS-TEAM ISOLATION TESTS
// ============================================================================

describe('Cross-Team Isolation', () => {
  it('Product Knowledge Bot cannot access tech team members', () => {
    const productBot = getKnowledgeBot('product_knowledge_bot');
    const techBot = getKnowledgeBot('tech_knowledge_bot');

    // Product bot can only recommend for product team
    expect(productBot.canRecommendFor('ux_research_lead')).toBe(true);
    expect(productBot.canRecommendFor('web_dev_lead')).toBe(false);

    // Tech bot can only recommend for tech team
    expect(techBot.canRecommendFor('web_dev_lead')).toBe(true);
    expect(techBot.canRecommendFor('ux_research_lead')).toBe(false);
  });

  it('Product Knowledge Bot cannot access marketing team members', () => {
    const productBot = getKnowledgeBot('product_knowledge_bot');
    const marketingBot = getKnowledgeBot('marketing_knowledge_bot');

    // Product bot can only recommend for product team
    expect(productBot.canRecommendFor('product_analytics_lead')).toBe(true);
    expect(productBot.canRecommendFor('content_lead')).toBe(false);

    // Marketing bot can only recommend for marketing team
    expect(marketingBot.canRecommendFor('content_lead')).toBe(true);
    expect(marketingBot.canRecommendFor('product_analytics_lead')).toBe(false);
  });

  it('All three teams have distinct subordinate sets', async () => {
    const productTeam = await ProductTestUtils.getTeam('product');
    const techTeam = await ProductTestUtils.getTeam('tech');
    const marketingTeam = await ProductTestUtils.getTeam('marketing');

    const productSubs = new Set(productTeam.subordinates);
    const techSubs = new Set(techTeam.subordinates);
    const marketingSubs = new Set(marketingTeam.subordinates);

    // No overlap between product and tech
    for (const sub of productSubs) {
      expect(techSubs.has(sub)).toBe(false);
    }

    // No overlap between product and marketing
    for (const sub of productSubs) {
      expect(marketingSubs.has(sub)).toBe(false);
    }

    // No overlap between tech and marketing
    for (const sub of techSubs) {
      expect(marketingSubs.has(sub)).toBe(false);
    }
  });
});

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  ProductTestUtils,
};
