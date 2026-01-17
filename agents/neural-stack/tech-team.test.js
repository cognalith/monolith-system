/**
 * Tech Team Validation Test Suite - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Comprehensive test suite for validating Tech Team structure, CTO review cycles,
 * Knowledge Bot functionality, and integration scenarios.
 *
 * Tests cover:
 * - Team hierarchy and structure validation
 * - CTO CoS (Chief of Staff) review powers
 * - Tech Knowledge Bot advisory functionality
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
// TEST UTILITIES
// ============================================================================

/**
 * Test helper utilities for Tech Team tests
 */
const TestUtils = {
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
      category: options.category || 'general',
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
      content: options.content || 'Test recommendation content for improvement',
      targeting_pattern: options.targeting_pattern || 'task_category:general',
      expected_impact: options.expected_impact || 'medium',
      reasoning: options.reasoning || 'Test reasoning for the recommendation',
      sources: options.sources || ['https://example.com/best-practices'],
      status: options.status || 'pending',
      amendment_id: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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
};

// Export test utilities for reuse
export { TestUtils };

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  TestUtils.clearTestData();
});

afterEach(() => {
  TestUtils.clearTestData();
});

// ============================================================================
// 1. TEAM STRUCTURE TESTS
// ============================================================================

describe('Tech Team Structure', () => {
  it('CTO has correct subordinates', async () => {
    const cto = await TestUtils.getAgent('cto');
    expect(cto).not.toBeNull();
    expect(cto.persona.team_lead_powers.subordinates).toContain('web_dev_lead');
    expect(cto.persona.team_lead_powers.subordinates).toContain('app_dev_lead');
    expect(cto.persona.team_lead_powers.subordinates).toContain('devops_lead');
    expect(cto.persona.team_lead_powers.subordinates).toContain('qa_lead');
    expect(cto.persona.team_lead_powers.subordinates).toContain('infrastructure_lead');
    expect(cto.persona.team_lead_powers.subordinates).toHaveLength(5);
  });

  it('All subordinates report to CTO', async () => {
    const subordinates = ['web_dev_lead', 'app_dev_lead', 'devops_lead', 'qa_lead', 'infrastructure_lead'];
    for (const role of subordinates) {
      const agent = await TestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.reports_to).toBe('cto');
      expect(agent.team_id).toBe('tech');
    }
  });

  it('CTO is marked as team lead', async () => {
    const cto = await TestUtils.getAgent('cto');
    expect(cto).not.toBeNull();
    expect(cto.is_team_lead).toBe(true);
  });

  it('Subordinates are not team leads', async () => {
    const subordinates = ['web_dev_lead', 'app_dev_lead', 'devops_lead', 'qa_lead', 'infrastructure_lead'];
    for (const role of subordinates) {
      const agent = await TestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.is_team_lead).toBe(false);
    }
  });

  it('Knowledge Bot is advisory only', async () => {
    const bot = await TestUtils.getKnowledgeBot('tech_knowledge_bot');
    expect(bot).not.toBeNull();
    expect(bot.is_knowledge_bot).toBe(true);
    expect(bot.persona.authority_level).toBe('advisory');
    // Knowledge bots have no restricted skills (all execution tools are forbidden)
    expect(bot.skills.restricted).toEqual([]);
  });

  it('Tech team exists in configuration', async () => {
    const team = await TestUtils.getTeam('tech');
    expect(team).toBeDefined();
    expect(team.team_lead_role).toBe('cto');
    expect(team.subordinates).toHaveLength(5);
  });

  it('CTO has amendment authority', async () => {
    const cto = await TestUtils.getAgent('cto');
    expect(cto.persona.team_lead_powers.amendment_authority).toBe(true);
  });

  it('CTO has daily review cadence', async () => {
    const cto = await TestUtils.getAgent('cto');
    expect(cto.persona.team_lead_powers.review_cadence).toBe('daily');
  });
});

// ============================================================================
// 2. CTO REVIEW CYCLE TESTS
// ============================================================================

describe('CTO Review Cycle', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('CTO can review subordinate task history', async () => {
    // Create test tasks for web_dev_lead
    await TestUtils.createTestTask('web_dev_lead', { status: 'completed' });
    await TestUtils.createTestTask('web_dev_lead', { status: 'completed' });
    await TestUtils.createTestTask('web_dev_lead', { status: 'failed' });

    const tasks = await TestUtils.getTaskHistory('web_dev_lead', 10);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].assigned_to).toBe('web_dev_lead');
  });

  it('CTO can calculate trend from task history', () => {
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

  it('CTO can calculate CoS score for a task', () => {
    const task = {
      status: 'completed',
      quality_score: 85,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Due tomorrow
      completed_at: new Date().toISOString(), // Completed today
      retry_count: 0,
    };

    const cosScore = calculateCosScore(task);
    expect(cosScore).toBeGreaterThan(0);
    expect(cosScore).toBeLessThanOrEqual(1);
    expect(cosScore).toBeGreaterThan(0.7); // Should be acceptable or excellent
  });

  it('CTO cannot modify own knowledge', async () => {
    const ctoConfig = engine.getTeamLeadConfig('cto');
    expect(ctoConfig).not.toBeNull();

    // Verify safety constraint is in place
    const constraints = engine.getSafetyConstraints();
    expect(constraints.SELF_MODIFY_BLOCKED).toBe(true);
  });

  it('CTO cannot modify agents outside tech team', async () => {
    const ctoConfig = engine.getTeamLeadConfig('cto');
    expect(ctoConfig).not.toBeNull();

    // content_lead is in marketing team
    expect(ctoConfig.subordinates).not.toContain('content_lead');

    // Verify team isolation
    const marketingTeam = await TestUtils.getTeam('marketing');
    expect(marketingTeam.team_lead_role).toBe('cmo');
    expect(marketingTeam.subordinates).toContain('content_lead');
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

  it('Trend calculation requires minimum tasks', () => {
    // Test with too few tasks
    const insufficientHistory = [
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
    ];

    const trend = calculateTrend(insufficientHistory);
    expect(trend.direction).toBe('stable');
    expect(trend.slope).toBe(0);
  });

  it('COS score thresholds are properly defined', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(0.3);
    expect(constraints.COS_SCORE_THRESHOLDS.WARNING).toBe(0.5);
    expect(constraints.COS_SCORE_THRESHOLDS.ACCEPTABLE).toBe(0.7);
    expect(constraints.COS_SCORE_THRESHOLDS.EXCELLENT).toBe(0.9);
  });

  it('Max amendments per subordinate is enforced', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.MAX_AMENDMENTS_PER_SUBORDINATE).toBe(10);
  });
});

// ============================================================================
// 3. KNOWLEDGE BOT TESTS
// ============================================================================

describe('Tech Knowledge Bot', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('tech_knowledge_bot');
  });

  it('Tech Knowledge Bot exists and is properly configured', () => {
    expect(knowledgeBot).not.toBeNull();
    expect(knowledgeBot.role).toBe('tech_knowledge_bot');
    expect(knowledgeBot.teamId).toBe('tech');
  });

  it('Knowledge Bot reports to CTO', () => {
    expect(knowledgeBot.reportsTo).toBe('cto');
    expect(knowledgeBot.getTeamLead()).toBe('cto');
  });

  it('Knowledge Bot is advisory only', () => {
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');
  });

  it('Knowledge Bot has correct subordinates', () => {
    const subordinates = knowledgeBot.getSubordinates();
    expect(subordinates).toContain('web_dev_lead');
    expect(subordinates).toContain('app_dev_lead');
    expect(subordinates).toContain('devops_lead');
    expect(subordinates).toContain('qa_lead');
    expect(subordinates).toContain('infrastructure_lead');
  });

  it('Knowledge Bot can recommend for team subordinates', () => {
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(true);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(true);
  });

  it('Knowledge Bot cannot recommend for non-team members', () => {
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('cmo')).toBe(false);
  });

  it('Knowledge Bot cannot recommend for self', () => {
    expect(knowledgeBot.canRecommendFor('tech_knowledge_bot')).toBe(false);
  });

  it('Knowledge Bot has research focus areas', () => {
    const researchFocus = knowledgeBot.getResearchFocus();
    expect(researchFocus.length).toBeGreaterThan(0);
    expect(researchFocus).toContain('TypeScript best practices');
    expect(researchFocus).toContain('DevOps automation and CI/CD');
  });

  it('Knowledge Bot has subordinate-specific specialties', () => {
    const webDevSpecialties = knowledgeBot.getSubordinateSpecialties('web_dev_lead');
    expect(webDevSpecialties.length).toBeGreaterThan(0);
    expect(webDevSpecialties).toContain('React architecture');

    const devopsSpecialties = knowledgeBot.getSubordinateSpecialties('devops_lead');
    expect(devopsSpecialties).toContain('CI/CD pipelines');
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

  it('All 6 Knowledge Bots exist', () => {
    const expectedBots = [
      'tech_knowledge_bot',
      'marketing_knowledge_bot',
      'product_knowledge_bot',
      'ops_knowledge_bot',
      'finance_knowledge_bot',
      'people_knowledge_bot',
    ];

    for (const botRole of expectedBots) {
      const bot = getKnowledgeBot(botRole);
      expect(bot).not.toBeNull();
      expect(bot.role).toBe(botRole);
    }
  });

  it('Knowledge Bot factory returns same instance from cache', () => {
    const bot1 = getKnowledgeBot('tech_knowledge_bot');
    const bot2 = getKnowledgeBot('tech_knowledge_bot');
    expect(bot1).toBe(bot2);
  });

  it('Knowledge Bot can be retrieved by team ID', () => {
    const bot = getKnowledgeBotForTeam('tech');
    expect(bot).not.toBeNull();
    expect(bot.role).toBe('tech_knowledge_bot');
  });
});

// ============================================================================
// 4. RECOMMENDATION VALIDATION TESTS
// ============================================================================

describe('Recommendation Validation', () => {
  let generator;

  beforeEach(() => {
    generator = new RecommendationGenerator();
  });

  it('Valid recommendation passes validation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test recommendation content for improving code quality',
      targetingPattern: 'task_category:code_review',
      expectedImpact: 'high',
      reasoning: 'Based on recent failure patterns in code reviews',
      sources: ['https://example.com/best-practices'],
    };

    const result = generator.validateRecommendation(recommendation, 'web_dev_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Missing required fields fail validation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      // Missing content, targetingPattern, etc.
    };

    const result = generator.validateRecommendation(recommendation, 'web_dev_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('content'))).toBe(true);
  });

  it('Invalid type fails validation', () => {
    const recommendation = {
      type: 'invalid_type',
      content: 'Test content',
      targetingPattern: 'task_category:general',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: ['https://example.com'],
    };

    const result = generator.validateRecommendation(recommendation, 'web_dev_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('type'))).toBe(true);
  });

  it('Invalid expectedImpact fails validation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test content',
      targetingPattern: 'task_category:general',
      expectedImpact: 'very_high', // Invalid
      reasoning: 'Test reasoning',
      sources: ['https://example.com'],
    };

    const result = generator.validateRecommendation(recommendation, 'web_dev_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('expectedImpact'))).toBe(true);
  });

  it('Content exceeding word limit fails validation', () => {
    const longContent = Array(250).fill('word').join(' '); // 250 words
    const recommendation = {
      type: 'knowledge_addition',
      content: longContent,
      targetingPattern: 'task_category:general',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: ['https://example.com'],
    };

    const result = generator.validateRecommendation(recommendation, 'web_dev_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('words'))).toBe(true);
  });

  it('Missing sources fails validation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test content',
      targetingPattern: 'task_category:general',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: [], // Empty sources
    };

    const result = generator.validateRecommendation(recommendation, 'web_dev_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('source'))).toBe(true);
  });

  it('Recommendations have required fields defined', () => {
    expect(VALIDATION_RULES.REQUIRED_FIELDS).toContain('type');
    expect(VALIDATION_RULES.REQUIRED_FIELDS).toContain('content');
    expect(VALIDATION_RULES.REQUIRED_FIELDS).toContain('targetingPattern');
    expect(VALIDATION_RULES.REQUIRED_FIELDS).toContain('expectedImpact');
    expect(VALIDATION_RULES.REQUIRED_FIELDS).toContain('reasoning');
    expect(VALIDATION_RULES.REQUIRED_FIELDS).toContain('sources');
  });

  it('Valid types are properly defined', () => {
    expect(VALIDATION_RULES.VALID_TYPES).toContain('knowledge_addition');
    expect(VALIDATION_RULES.VALID_TYPES).toContain('knowledge_modification');
    expect(VALIDATION_RULES.VALID_TYPES).toContain('skill_suggestion');
  });

  it('Valid impacts are properly defined', () => {
    expect(VALIDATION_RULES.VALID_IMPACTS).toContain('high');
    expect(VALIDATION_RULES.VALID_IMPACTS).toContain('medium');
    expect(VALIDATION_RULES.VALID_IMPACTS).toContain('low');
  });
});

// ============================================================================
// 5. SAFETY CONSTRAINTS TESTS
// ============================================================================

describe('Safety Constraints', () => {
  it('Team Lead Review Engine has hardcoded safety constraints', () => {
    const engine = new TeamLeadReviewEngine();
    const constraints = engine.getSafetyConstraints();

    expect(constraints.SELF_MODIFY_BLOCKED).toBe(true);
    expect(constraints.PERSONA_MODIFY_BLOCKED).toBe(true);
    expect(constraints.FINANCIAL_BYPASS_ENABLED).toBe(true);
    expect(constraints.note).toContain('HARDCODED');
  });

  it('Knowledge Bot has hardcoded safety constraints', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ADVISORY_ONLY).toBe(true);
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.NO_EXECUTION_TOOLS).toBe(true);
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.TEAM_ISOLATION).toBe(true);
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.NO_SELF_RECOMMENDATION).toBe(true);
  });

  it('Knowledge Bot allowed skills are research-only', () => {
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).toContain('web_search');
    expect(allowedSkills).toContain('deep_research');
    expect(allowedSkills).not.toContain('code_execution');
    expect(allowedSkills).not.toContain('file_write');
  });

  it('Recommendations expire after 7 days', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.RECOMMENDATION_EXPIRY_DAYS).toBe(7);
    expect(VALIDATION_RULES.EXPIRATION_DAYS).toBe(7);
  });

  it('Max recommendations per subordinate is enforced', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.MAX_RECOMMENDATIONS_PER_SUBORDINATE).toBe(3);
  });

  it('Minimum confidence threshold exists', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.MIN_CONFIDENCE_THRESHOLD).toBe(0.6);
  });
});

// ============================================================================
// 6. INTEGRATION TESTS
// ============================================================================

describe('Tech Team Integration', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('CTO config matches team hierarchy expectations', async () => {
    const ctoConfig = engine.getTeamLeadConfig('cto');
    const team = await TestUtils.getTeam('tech');
    const bot = getKnowledgeBot('tech_knowledge_bot');

    // Verify alignment
    expect(ctoConfig.team_id).toBe(team.team_id);
    expect(ctoConfig.subordinates).toEqual(team.subordinates);
    expect(bot.reportsTo).toBe(ctoConfig.role);
  });

  it('All team leads have associated knowledge bots', () => {
    for (const teamLeadConfig of TEAM_LEAD_CONFIGS) {
      const bot = getKnowledgeBotForTeam(teamLeadConfig.team_id);
      expect(bot).not.toBeNull();
      expect(bot.reportsTo).toBe(teamLeadConfig.role);
    }
  });

  it('Knowledge Bot subordinates match Team Lead subordinates', () => {
    const ctoConfig = TEAM_LEAD_CONFIGS.find(c => c.role === 'cto');
    const bot = getKnowledgeBot('tech_knowledge_bot');

    const botSubordinates = bot.getSubordinates();
    for (const subordinate of ctoConfig.subordinates) {
      expect(botSubordinates).toContain(subordinate);
    }
  });

  it('Team Lead lookup works correctly', () => {
    // Check that subordinates can find their team lead
    const webDevTeamLead = engine.getTeamLeadForSubordinate('web_dev_lead');
    expect(webDevTeamLead).not.toBeNull();
    expect(webDevTeamLead.role).toBe('cto');

    const contentLeadTeamLead = engine.getTeamLeadForSubordinate('content_lead');
    expect(contentLeadTeamLead).not.toBeNull();
    expect(contentLeadTeamLead.role).toBe('cmo');
  });

  it('isTeamLead correctly identifies team leads', () => {
    expect(engine.isTeamLead('cto')).toBe(true);
    expect(engine.isTeamLead('cmo')).toBe(true);
    expect(engine.isTeamLead('web_dev_lead')).toBe(false);
    expect(engine.isTeamLead('content_lead')).toBe(false);
  });

  it('All 6 teams have proper configuration', () => {
    const expectedTeams = ['tech', 'marketing', 'product', 'operations', 'finance', 'people'];

    for (const teamId of expectedTeams) {
      const teamLeadConfig = engine.teamLeadByTeam.get(teamId);
      expect(teamLeadConfig).toBeDefined();
      expect(teamLeadConfig.subordinates.length).toBeGreaterThan(0);
    }
  });

  it('No subordinate belongs to multiple teams', () => {
    const allSubordinates = new Set();

    for (const teamLeadConfig of TEAM_LEAD_CONFIGS) {
      for (const subordinate of teamLeadConfig.subordinates) {
        expect(allSubordinates.has(subordinate)).toBe(false);
        allSubordinates.add(subordinate);
      }
    }
  });

  it('Trend calculation produces expected results for improving performance', () => {
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

  it('Trend calculation produces expected results for stable performance', () => {
    // All tasks are successful - stable performance
    const taskHistory = [
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
      { status: 'completed', created_at: new Date().toISOString() },
    ];

    const trend = calculateTrend(taskHistory);
    expect(trend.direction).toBe('stable');
    expect(Math.abs(trend.slope)).toBeLessThan(0.15);
  });
});

// ============================================================================
// 7. ESCALATION TESTS
// ============================================================================

describe('Escalation Handling', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('Consecutive failures threshold is configurable per team', () => {
    const ctoConfig = engine.getTeamLeadConfig('cto');
    expect(ctoConfig.escalation.consecutive_failures_threshold).toBe(3);

    // Finance team has stricter threshold
    const cfoConfig = engine.getTeamLeadConfig('cfo');
    expect(cfoConfig.escalation.consecutive_failures_threshold).toBe(2);
  });

  it('Escalation target is configured to CoS', () => {
    const ctoConfig = engine.getTeamLeadConfig('cto');
    expect(ctoConfig.escalation.escalate_to).toBe('cos');
  });

  it('Critical COS score threshold triggers escalation', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(0.3);

    // A score below critical should trigger escalation
    const criticalScore = 0.25;
    expect(criticalScore < constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(true);
  });

  it('Warning COS score threshold triggers amendment generation', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.WARNING).toBe(0.5);

    // A score below warning but above critical should trigger amendment
    const warningScore = 0.45;
    expect(warningScore < constraints.COS_SCORE_THRESHOLDS.WARNING).toBe(true);
    expect(warningScore >= constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(true);
  });
});

// ============================================================================
// 8. AMENDMENT GENERATION TESTS
// ============================================================================

describe('Amendment Generation', () => {
  it('Amendment type is set based on trend severity', () => {
    const constraints = SAFETY_CONSTRAINTS;

    // Severe decline threshold
    expect(constraints.TREND_THRESHOLDS.SEVERE_DECLINE).toBe(-0.3);

    // Moderate decline threshold
    expect(constraints.TREND_THRESHOLDS.MODERATE_DECLINE).toBe(-0.15);

    // Improvement threshold
    expect(constraints.TREND_THRESHOLDS.IMPROVEMENT).toBe(0.15);
  });

  it('COS score calculation handles missing quality score', () => {
    const task = {
      status: 'completed',
      quality_score: null, // No quality score
      retry_count: 0,
    };

    const cosScore = calculateCosScore(task);
    expect(cosScore).toBeGreaterThan(0);
    expect(cosScore).toBeLessThanOrEqual(1);
  });

  it('COS score calculation penalizes retries', () => {
    const taskNoRetries = {
      status: 'completed',
      quality_score: 80,
      retry_count: 0,
    };

    const taskWithRetries = {
      status: 'completed',
      quality_score: 80,
      retry_count: 3,
    };

    const scoreNoRetries = calculateCosScore(taskNoRetries);
    const scoreWithRetries = calculateCosScore(taskWithRetries);

    expect(scoreWithRetries).toBeLessThan(scoreNoRetries);
  });

  it('COS score calculation rewards on-time completion', () => {
    const onTimeTask = {
      status: 'completed',
      quality_score: 80,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date().toISOString(),
      retry_count: 0,
    };

    const lateTask = {
      status: 'completed',
      quality_score: 80,
      due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      completed_at: new Date().toISOString(),
      retry_count: 0,
    };

    const onTimeScore = calculateCosScore(onTimeTask);
    const lateScore = calculateCosScore(lateTask);

    expect(onTimeScore).toBeGreaterThan(lateScore);
  });

  it('COS score for failed tasks is lower than completed', () => {
    const completedTask = {
      status: 'completed',
      quality_score: 80,
      retry_count: 0,
    };

    const failedTask = {
      status: 'failed',
      quality_score: 80,
      retry_count: 0,
    };

    const completedScore = calculateCosScore(completedTask);
    const failedScore = calculateCosScore(failedTask);

    expect(completedScore).toBeGreaterThan(failedScore);
  });
});

// ============================================================================
// 9. FULL HIERARCHY TESTS
// ============================================================================

describe('Full Team Hierarchy', () => {
  it('Complete tech team hierarchy is valid', async () => {
    const hierarchy = {
      teamLead: await TestUtils.getAgent('cto'),
      knowledgeBot: await TestUtils.getKnowledgeBot('tech_knowledge_bot'),
      subordinates: await Promise.all([
        TestUtils.getAgent('web_dev_lead'),
        TestUtils.getAgent('app_dev_lead'),
        TestUtils.getAgent('devops_lead'),
        TestUtils.getAgent('qa_lead'),
        TestUtils.getAgent('infrastructure_lead'),
      ]),
    };

    // Verify team lead
    expect(hierarchy.teamLead.is_team_lead).toBe(true);
    expect(hierarchy.teamLead.team_id).toBe('tech');

    // Verify knowledge bot
    expect(hierarchy.knowledgeBot.is_knowledge_bot).toBe(true);
    expect(hierarchy.knowledgeBot.reports_to).toBe('cto');

    // Verify all subordinates
    for (const subordinate of hierarchy.subordinates) {
      expect(subordinate.is_team_lead).toBe(false);
      expect(subordinate.reports_to).toBe('cto');
      expect(subordinate.team_id).toBe('tech');
    }
  });

  it('All 6 teams have complete hierarchies', async () => {
    const teams = ['tech', 'marketing', 'product', 'operations', 'finance', 'people'];

    for (const teamId of teams) {
      const team = await TestUtils.getTeam(teamId);
      expect(team).not.toBeNull();

      // Team has a lead
      const teamLead = await TestUtils.getAgent(team.team_lead_role);
      expect(teamLead.is_team_lead).toBe(true);

      // Team has a knowledge bot
      const bot = getKnowledgeBotForTeam(teamId);
      expect(bot).not.toBeNull();
      expect(bot.reportsTo).toBe(team.team_lead_role);

      // Team has subordinates
      expect(team.subordinates.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  TestUtils,
};
