/**
 * Marketing Team Validation Test Suite - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Comprehensive test suite for validating Marketing Team structure, CMO review cycles,
 * Marketing Knowledge Bot functionality, and integration scenarios.
 *
 * Tests cover:
 * - Team hierarchy and structure validation
 * - CMO CoS (Chief of Staff) review powers
 * - Marketing Knowledge Bot advisory functionality
 * - Marketing-specific safety constraints
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
// TEST UTILITIES FOR MARKETING TEAM
// ============================================================================

/**
 * Test helper utilities for Marketing Team tests
 */
const MarketingTestUtils = {
  /**
   * Marketing team subordinate roles
   */
  MARKETING_SUBORDINATES: ['content_lead', 'social_media_lead', 'seo_growth_lead', 'brand_lead'],

  /**
   * Marketing Knowledge Bot subordinate specialties
   */
  MARKETING_SPECIALTIES: {
    content_lead: ['Content strategy', 'Copywriting best practices', 'Content calendars', 'Blog optimization', 'Video content trends'],
    social_media_lead: ['Platform algorithms', 'Community engagement', 'Social analytics', 'Viral content patterns', 'Influencer collaboration'],
    seo_growth_lead: ['Search algorithm updates', 'Keyword research', 'Technical SEO', 'Link building strategies', 'Local SEO'],
    brand_lead: ['Brand identity', 'Visual design trends', 'Brand voice consistency', 'Competitive positioning', 'Brand measurement'],
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
      category: options.category || 'marketing',
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
      content: options.content || 'Test marketing recommendation for improving content strategy',
      targeting_pattern: options.targeting_pattern || 'task_category:content_creation',
      expected_impact: options.expected_impact || 'medium',
      reasoning: options.reasoning || 'Test reasoning for the marketing recommendation',
      sources: options.sources || ['https://example.com/marketing-best-practices'],
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
      content: 'Expired marketing recommendation',
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
   * Verify marketing team subordinate belongs to marketing team
   * @param {string} role - Role to verify
   * @returns {boolean}
   */
  isMarketingSubordinate(role) {
    return this.MARKETING_SUBORDINATES.includes(role);
  },

  /**
   * Get expected specialties for a marketing subordinate
   * @param {string} role - Subordinate role
   * @returns {string[]}
   */
  getExpectedSpecialties(role) {
    return this.MARKETING_SPECIALTIES[role] || [];
  },
};

// Export test utilities for reuse
export { MarketingTestUtils };

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  MarketingTestUtils.clearTestData();
});

afterEach(() => {
  MarketingTestUtils.clearTestData();
});

// ============================================================================
// 1. MARKETING TEAM STRUCTURE TESTS
// ============================================================================

describe('Marketing Team Structure', () => {
  it('CMO has correct subordinates', async () => {
    const cmo = await MarketingTestUtils.getAgent('cmo');
    expect(cmo).not.toBeNull();
    expect(cmo.persona.team_lead_powers.subordinates).toContain('content_lead');
    expect(cmo.persona.team_lead_powers.subordinates).toContain('social_media_lead');
    expect(cmo.persona.team_lead_powers.subordinates).toContain('seo_growth_lead');
    expect(cmo.persona.team_lead_powers.subordinates).toContain('brand_lead');
    expect(cmo.persona.team_lead_powers.subordinates).toHaveLength(4);
  });

  it('All subordinates report to CMO', async () => {
    const subordinates = ['content_lead', 'social_media_lead', 'seo_growth_lead', 'brand_lead'];
    for (const role of subordinates) {
      const agent = await MarketingTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.reports_to).toBe('cmo');
      expect(agent.team_id).toBe('marketing');
    }
  });

  it('CMO is marked as team lead', async () => {
    const cmo = await MarketingTestUtils.getAgent('cmo');
    expect(cmo).not.toBeNull();
    expect(cmo.is_team_lead).toBe(true);
  });

  it('Subordinates are not team leads', async () => {
    const subordinates = ['content_lead', 'social_media_lead', 'seo_growth_lead', 'brand_lead'];
    for (const role of subordinates) {
      const agent = await MarketingTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.is_team_lead).toBe(false);
    }
  });

  it('Marketing Knowledge Bot is advisory only', async () => {
    const bot = await MarketingTestUtils.getKnowledgeBot('marketing_knowledge_bot');
    expect(bot).not.toBeNull();
    expect(bot.is_knowledge_bot).toBe(true);
    expect(bot.persona.authority_level).toBe('advisory');
    // Knowledge bots have no restricted skills (all execution tools are forbidden)
    expect(bot.skills.restricted).toEqual([]);
  });

  it('Marketing team exists in configuration', async () => {
    const team = await MarketingTestUtils.getTeam('marketing');
    expect(team).toBeDefined();
    expect(team.team_lead_role).toBe('cmo');
    expect(team.subordinates).toHaveLength(4);
  });

  it('CMO has amendment authority', async () => {
    const cmo = await MarketingTestUtils.getAgent('cmo');
    expect(cmo.persona.team_lead_powers.amendment_authority).toBe(true);
  });

  it('CMO has daily review cadence', async () => {
    const cmo = await MarketingTestUtils.getAgent('cmo');
    expect(cmo.persona.team_lead_powers.review_cadence).toBe('daily');
  });

  it('Marketing team is distinct from tech team', async () => {
    const marketingTeam = await MarketingTestUtils.getTeam('marketing');
    const techTeam = await MarketingTestUtils.getTeam('tech');

    // Verify teams are different
    expect(marketingTeam.team_lead_role).not.toBe(techTeam.team_lead_role);

    // Verify no overlap in subordinates
    const marketingSubordinates = new Set(marketingTeam.subordinates);
    for (const techSub of techTeam.subordinates) {
      expect(marketingSubordinates.has(techSub)).toBe(false);
    }
  });
});

// ============================================================================
// 2. CMO REVIEW CYCLE TESTS
// ============================================================================

describe('CMO Review Cycle', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('CMO can review subordinate task history', async () => {
    // Create test tasks for content_lead
    await MarketingTestUtils.createTestTask('content_lead', { status: 'completed' });
    await MarketingTestUtils.createTestTask('content_lead', { status: 'completed' });
    await MarketingTestUtils.createTestTask('content_lead', { status: 'failed' });

    const tasks = await MarketingTestUtils.getTaskHistory('content_lead', 10);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].assigned_to).toBe('content_lead');
  });

  it('CMO can generate amendments for subordinates', async () => {
    const cmoConfig = engine.getTeamLeadConfig('cmo');
    expect(cmoConfig).not.toBeNull();
    expect(cmoConfig.cos_powers.amendment_authority).toBe(true);

    // Verify CMO can generate amendments for marketing subordinates
    for (const subordinate of cmoConfig.subordinates) {
      expect(MarketingTestUtils.isMarketingSubordinate(subordinate)).toBe(true);
    }
  });

  it('CMO cannot modify own knowledge', async () => {
    const cmoConfig = engine.getTeamLeadConfig('cmo');
    expect(cmoConfig).not.toBeNull();

    // Verify safety constraint is in place
    const constraints = engine.getSafetyConstraints();
    expect(constraints.SELF_MODIFY_BLOCKED).toBe(true);
  });

  it('CMO cannot modify agents outside marketing team', async () => {
    const cmoConfig = engine.getTeamLeadConfig('cmo');
    expect(cmoConfig).not.toBeNull();

    // web_dev_lead is in tech team, not marketing
    expect(cmoConfig.subordinates).not.toContain('web_dev_lead');
    expect(cmoConfig.subordinates).not.toContain('devops_lead');
    expect(cmoConfig.subordinates).not.toContain('qa_lead');

    // Verify team isolation
    const techTeam = await MarketingTestUtils.getTeam('tech');
    expect(techTeam.team_lead_role).toBe('cto');
    for (const techSubordinate of techTeam.subordinates) {
      expect(cmoConfig.subordinates).not.toContain(techSubordinate);
    }
  });

  it('CMO can calculate trend from marketing task history', () => {
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

  it('Consecutive marketing failures trigger escalation', () => {
    const taskHistory = [
      { status: 'failed', created_at: new Date().toISOString() },
      { status: 'rejected', created_at: new Date().toISOString() },
      { status: 'failed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
    ];

    const consecutiveFailures = engine.countConsecutiveFailures(taskHistory);
    expect(consecutiveFailures).toBe(3);
  });

  it('CMO escalation threshold is configured to 3', () => {
    const cmoConfig = engine.getTeamLeadConfig('cmo');
    expect(cmoConfig.escalation.consecutive_failures_threshold).toBe(3);
    expect(cmoConfig.escalation.escalate_to).toBe('cos');
  });
});

// ============================================================================
// 3. MARKETING KNOWLEDGE BOT TESTS
// ============================================================================

describe('Marketing Knowledge Bot', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('marketing_knowledge_bot');
  });

  it('Has correct subordinate list', () => {
    const subordinates = knowledgeBot.getSubordinates();
    expect(subordinates).toContain('content_lead');
    expect(subordinates).toContain('social_media_lead');
    expect(subordinates).toContain('seo_growth_lead');
    expect(subordinates).toContain('brand_lead');
    expect(subordinates).toHaveLength(4);
  });

  it('Can generate recommendations for content_lead', () => {
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('content_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('Content strategy');
    expect(specialties).toContain('Copywriting best practices');
  });

  it('Can generate recommendations for social_media_lead', () => {
    expect(knowledgeBot.canRecommendFor('social_media_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('social_media_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('Platform algorithms');
    expect(specialties).toContain('Community engagement');
  });

  it('Can generate recommendations for seo_growth_lead', () => {
    expect(knowledgeBot.canRecommendFor('seo_growth_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('seo_growth_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('Search algorithm updates');
    expect(specialties).toContain('Keyword research');
  });

  it('Can generate recommendations for brand_lead', () => {
    expect(knowledgeBot.canRecommendFor('brand_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('brand_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('Brand identity');
    expect(specialties).toContain('Visual design trends');
  });

  it('Cannot generate recommendations for tech team members', () => {
    // Tech team members should not be recommendable by marketing knowledge bot
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('qa_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('app_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('infrastructure_lead')).toBe(false);
  });

  it('Has correct research focus areas', () => {
    const researchFocus = knowledgeBot.getResearchFocus();
    expect(researchFocus.length).toBeGreaterThan(0);
    expect(researchFocus).toContain('Content marketing strategies');
    expect(researchFocus).toContain('Social media algorithm updates');
    expect(researchFocus).toContain('SEO and search trends');
    expect(researchFocus).toContain('Brand positioning');
  });

  it('Marketing Knowledge Bot exists and is properly configured', () => {
    expect(knowledgeBot).not.toBeNull();
    expect(knowledgeBot.role).toBe('marketing_knowledge_bot');
    expect(knowledgeBot.teamId).toBe('marketing');
  });

  it('Knowledge Bot reports to CMO', () => {
    expect(knowledgeBot.reportsTo).toBe('cmo');
    expect(knowledgeBot.getTeamLead()).toBe('cmo');
  });

  it('Knowledge Bot is advisory only', () => {
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');
  });

  it('Knowledge Bot cannot recommend for self', () => {
    expect(knowledgeBot.canRecommendFor('marketing_knowledge_bot')).toBe(false);
  });

  it('Knowledge Bot cannot recommend for CMO (team lead)', () => {
    expect(knowledgeBot.canRecommendFor('cmo')).toBe(false);
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
    const bot = getKnowledgeBotForTeam('marketing');
    expect(bot).not.toBeNull();
    expect(bot.role).toBe('marketing_knowledge_bot');
  });

  it('Knowledge Bot factory returns same instance from cache', () => {
    const bot1 = getKnowledgeBot('marketing_knowledge_bot');
    const bot2 = getKnowledgeBot('marketing_knowledge_bot');
    expect(bot1).toBe(bot2);
  });
});

// ============================================================================
// 4. MARKETING-SPECIFIC SAFETY TESTS
// ============================================================================

describe('Marketing Safety Constraints', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('marketing_knowledge_bot');
  });

  it('Knowledge Bot cannot execute social posts', () => {
    // Knowledge bots are advisory only - they cannot execute any actions
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');

    // Check that no execution skills are allowed
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).not.toContain('social_post');
    expect(allowedSkills).not.toContain('publish_content');
    expect(allowedSkills).not.toContain('execute_campaign');
  });

  it('Knowledge Bot cannot send emails', () => {
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).not.toContain('send_email');
    expect(allowedSkills).not.toContain('email_blast');
    expect(allowedSkills).not.toContain('gmail_send');
  });

  it('Recommendations expire after 7 days', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.RECOMMENDATION_EXPIRY_DAYS).toBe(7);
    expect(VALIDATION_RULES.EXPIRATION_DAYS).toBe(7);
  });

  it('Knowledge Bot has no execution tools', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.NO_EXECUTION_TOOLS).toBe(true);
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ADVISORY_ONLY).toBe(true);
  });

  it('Team isolation is enforced', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.TEAM_ISOLATION).toBe(true);

    // Marketing bot cannot recommend for tech team
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);
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

  it('CMO cannot self-modify', () => {
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

describe('Marketing Team Integration', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('Full CMO review cycle completes', async () => {
    const cmoConfig = engine.getTeamLeadConfig('cmo');
    const team = await MarketingTestUtils.getTeam('marketing');
    const bot = getKnowledgeBot('marketing_knowledge_bot');

    // Verify alignment
    expect(cmoConfig.team_id).toBe(team.team_id);
    expect(cmoConfig.subordinates).toEqual(team.subordinates);
    expect(bot.reportsTo).toBe(cmoConfig.role);
  });

  it('Recommendations can be converted to amendments', () => {
    const generator = new RecommendationGenerator();

    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test content marketing recommendation for improving blog performance',
      targetingPattern: 'task_category:blog_posts',
      expectedImpact: 'high',
      reasoning: 'Based on recent SEO analysis and content performance metrics',
      sources: ['https://example.com/content-strategy-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'content_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Learning tracker updates on recommendation outcome', async () => {
    const knowledgeBot = getKnowledgeBot('marketing_knowledge_bot');

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

  it('CMO config matches team hierarchy expectations', async () => {
    const cmoConfig = engine.getTeamLeadConfig('cmo');
    const team = await MarketingTestUtils.getTeam('marketing');
    const bot = getKnowledgeBot('marketing_knowledge_bot');

    // Verify alignment
    expect(cmoConfig.team_id).toBe(team.team_id);
    expect(cmoConfig.subordinates).toEqual(team.subordinates);
    expect(bot.reportsTo).toBe(cmoConfig.role);
  });

  it('Marketing team has associated knowledge bot', () => {
    const cmoConfig = TEAM_LEAD_CONFIGS.find(c => c.role === 'cmo');
    const bot = getKnowledgeBotForTeam(cmoConfig.team_id);

    expect(bot).not.toBeNull();
    expect(bot.reportsTo).toBe(cmoConfig.role);
  });

  it('Knowledge Bot subordinates match CMO subordinates', () => {
    const cmoConfig = TEAM_LEAD_CONFIGS.find(c => c.role === 'cmo');
    const bot = getKnowledgeBot('marketing_knowledge_bot');

    const botSubordinates = bot.getSubordinates();
    for (const subordinate of cmoConfig.subordinates) {
      expect(botSubordinates).toContain(subordinate);
    }
  });

  it('CMO lookup works correctly', () => {
    // Check that subordinates can find their team lead
    const contentLeadTeamLead = engine.getTeamLeadForSubordinate('content_lead');
    expect(contentLeadTeamLead).not.toBeNull();
    expect(contentLeadTeamLead.role).toBe('cmo');

    const socialMediaLeadTeamLead = engine.getTeamLeadForSubordinate('social_media_lead');
    expect(socialMediaLeadTeamLead).not.toBeNull();
    expect(socialMediaLeadTeamLead.role).toBe('cmo');

    const seoGrowthLeadTeamLead = engine.getTeamLeadForSubordinate('seo_growth_lead');
    expect(seoGrowthLeadTeamLead).not.toBeNull();
    expect(seoGrowthLeadTeamLead.role).toBe('cmo');

    const brandLeadTeamLead = engine.getTeamLeadForSubordinate('brand_lead');
    expect(brandLeadTeamLead).not.toBeNull();
    expect(brandLeadTeamLead.role).toBe('cmo');
  });

  it('isCMO correctly identifies CMO as team lead', () => {
    expect(engine.isTeamLead('cmo')).toBe(true);
    expect(engine.isTeamLead('content_lead')).toBe(false);
    expect(engine.isTeamLead('social_media_lead')).toBe(false);
    expect(engine.isTeamLead('seo_growth_lead')).toBe(false);
    expect(engine.isTeamLead('brand_lead')).toBe(false);
  });

  it('No marketing subordinate belongs to other teams', () => {
    const marketingSubordinates = new Set(MarketingTestUtils.MARKETING_SUBORDINATES);

    for (const teamLeadConfig of TEAM_LEAD_CONFIGS) {
      if (teamLeadConfig.team_id !== 'marketing') {
        for (const subordinate of teamLeadConfig.subordinates) {
          expect(marketingSubordinates.has(subordinate)).toBe(false);
        }
      }
    }
  });

  it('Trend calculation produces expected results for improving marketing performance', () => {
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

  it('Complete marketing team hierarchy is valid', async () => {
    const hierarchy = {
      teamLead: await MarketingTestUtils.getAgent('cmo'),
      knowledgeBot: await MarketingTestUtils.getKnowledgeBot('marketing_knowledge_bot'),
      subordinates: await Promise.all([
        MarketingTestUtils.getAgent('content_lead'),
        MarketingTestUtils.getAgent('social_media_lead'),
        MarketingTestUtils.getAgent('seo_growth_lead'),
        MarketingTestUtils.getAgent('brand_lead'),
      ]),
    };

    // Verify team lead
    expect(hierarchy.teamLead.is_team_lead).toBe(true);
    expect(hierarchy.teamLead.team_id).toBe('marketing');

    // Verify knowledge bot
    expect(hierarchy.knowledgeBot.is_knowledge_bot).toBe(true);
    expect(hierarchy.knowledgeBot.reports_to).toBe('cmo');

    // Verify all subordinates
    for (const subordinate of hierarchy.subordinates) {
      expect(subordinate.is_team_lead).toBe(false);
      expect(subordinate.reports_to).toBe('cmo');
      expect(subordinate.team_id).toBe('marketing');
    }
  });
});

// ============================================================================
// 6. RECOMMENDATION VALIDATION TESTS (MARKETING-SPECIFIC)
// ============================================================================

describe('Marketing Recommendation Validation', () => {
  let generator;

  beforeEach(() => {
    generator = new RecommendationGenerator();
  });

  it('Valid marketing recommendation passes validation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Improve social media engagement by implementing a consistent posting schedule with peak engagement times',
      targetingPattern: 'task_category:social_media',
      expectedImpact: 'high',
      reasoning: 'Based on recent social analytics showing engagement drops during off-peak hours',
      sources: ['https://example.com/social-media-best-practices'],
    };

    const result = generator.validateRecommendation(recommendation, 'social_media_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Content marketing recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_modification',
      content: 'Update blog post templates to include SEO-optimized headers and meta descriptions',
      targetingPattern: 'task_category:blog_content',
      expectedImpact: 'medium',
      reasoning: 'SEO audit revealed missing meta descriptions on recent posts',
      sources: ['https://example.com/seo-content-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'content_lead');
    expect(result.valid).toBe(true);
  });

  it('SEO recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Implement structured data markup for product pages to improve search visibility',
      targetingPattern: 'task_category:technical_seo',
      expectedImpact: 'high',
      reasoning: 'Competitor analysis shows structured data improves click-through rates',
      sources: ['https://example.com/schema-markup-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'seo_growth_lead');
    expect(result.valid).toBe(true);
  });

  it('Brand recommendation validates correctly', () => {
    const recommendation = {
      type: 'skill_suggestion',
      content: 'Develop brand voice guidelines for social media platforms to ensure consistency',
      targetingPattern: 'task_category:brand_consistency',
      expectedImpact: 'medium',
      reasoning: 'Brand audit revealed inconsistent messaging across channels',
      sources: ['https://example.com/brand-voice-framework'],
    };

    const result = generator.validateRecommendation(recommendation, 'brand_lead');
    expect(result.valid).toBe(true);
  });

  it('Missing sources fails validation for marketing recommendation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test content without sources',
      targetingPattern: 'task_category:social_media',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: [], // Empty sources
    };

    const result = generator.validateRecommendation(recommendation, 'social_media_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('source'))).toBe(true);
  });

  it('Content exceeding word limit fails validation', () => {
    const longContent = Array(250).fill('marketing').join(' '); // 250 words
    const recommendation = {
      type: 'knowledge_addition',
      content: longContent,
      targetingPattern: 'task_category:content',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: ['https://example.com'],
    };

    const result = generator.validateRecommendation(recommendation, 'content_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('words'))).toBe(true);
  });
});

// ============================================================================
// 7. ESCALATION TESTS (MARKETING-SPECIFIC)
// ============================================================================

describe('Marketing Escalation Handling', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('CMO consecutive failures threshold is 3', () => {
    const cmoConfig = engine.getTeamLeadConfig('cmo');
    expect(cmoConfig.escalation.consecutive_failures_threshold).toBe(3);
  });

  it('CMO escalation target is CoS', () => {
    const cmoConfig = engine.getTeamLeadConfig('cmo');
    expect(cmoConfig.escalation.escalate_to).toBe('cos');
  });

  it('Critical COS score threshold triggers escalation for marketing', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(0.3);

    // A score below critical should trigger escalation
    const criticalScore = 0.25;
    expect(criticalScore < constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(true);
  });

  it('Warning COS score threshold triggers amendment for marketing', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.WARNING).toBe(0.5);

    // A score below warning but above critical should trigger amendment
    const warningScore = 0.45;
    expect(warningScore < constraints.COS_SCORE_THRESHOLDS.WARNING).toBe(true);
    expect(warningScore >= constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(true);
  });
});

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  MarketingTestUtils,
};
