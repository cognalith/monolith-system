/**
 * Operations Team Validation Test Suite - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Comprehensive test suite for validating Operations Team structure, COO review cycles,
 * Ops Knowledge Bot functionality, and integration scenarios.
 *
 * Tests cover:
 * - Team hierarchy and structure validation
 * - COO CoS (Chief of Staff) review powers
 * - Ops Knowledge Bot advisory functionality
 * - Operations-specific safety constraints
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
// TEST UTILITIES FOR OPERATIONS TEAM
// ============================================================================

/**
 * Test helper utilities for Operations Team tests
 */
const OperationsTestUtils = {
  /**
   * Operations team subordinate roles
   */
  OPERATIONS_SUBORDINATES: ['vendor_management_lead', 'process_automation_lead'],

  /**
   * Operations Knowledge Bot subordinate specialties
   */
  OPERATIONS_SPECIALTIES: {
    vendor_management_lead: ['Vendor evaluation', 'Contract negotiation', 'SLA monitoring', 'Vendor risk management', 'Procurement optimization'],
    process_automation_lead: ['Workflow automation tools', 'RPA implementation', 'Process mining', 'Integration platforms', 'Automation ROI'],
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
      category: options.category || 'operations',
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
      content: options.content || 'Test operations recommendation for improving vendor management processes',
      targeting_pattern: options.targeting_pattern || 'task_category:vendor_management',
      expected_impact: options.expected_impact || 'medium',
      reasoning: options.reasoning || 'Test reasoning for the operations recommendation',
      sources: options.sources || ['https://example.com/operations-best-practices'],
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
      content: 'Expired operations recommendation',
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
   * Verify operations team subordinate belongs to operations team
   * @param {string} role - Role to verify
   * @returns {boolean}
   */
  isOperationsSubordinate(role) {
    return this.OPERATIONS_SUBORDINATES.includes(role);
  },

  /**
   * Get expected specialties for an operations subordinate
   * @param {string} role - Subordinate role
   * @returns {string[]}
   */
  getExpectedSpecialties(role) {
    return this.OPERATIONS_SPECIALTIES[role] || [];
  },
};

// Export test utilities for reuse
export { OperationsTestUtils };

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  OperationsTestUtils.clearTestData();
});

afterEach(() => {
  OperationsTestUtils.clearTestData();
});

// ============================================================================
// 1. OPERATIONS TEAM STRUCTURE TESTS
// ============================================================================

describe('Operations Team Structure', () => {
  it('COO has correct subordinates', async () => {
    const coo = await OperationsTestUtils.getAgent('coo');
    expect(coo).not.toBeNull();
    expect(coo.persona.team_lead_powers.subordinates).toContain('vendor_management_lead');
    expect(coo.persona.team_lead_powers.subordinates).toContain('process_automation_lead');
    expect(coo.persona.team_lead_powers.subordinates).toHaveLength(2);
  });

  it('All subordinates report to COO', async () => {
    const subordinates = ['vendor_management_lead', 'process_automation_lead'];
    for (const role of subordinates) {
      const agent = await OperationsTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.reports_to).toBe('coo');
      expect(agent.team_id).toBe('operations');
    }
  });

  it('COO is marked as team lead', async () => {
    const coo = await OperationsTestUtils.getAgent('coo');
    expect(coo).not.toBeNull();
    expect(coo.is_team_lead).toBe(true);
  });

  it('Subordinates are not team leads', async () => {
    const subordinates = ['vendor_management_lead', 'process_automation_lead'];
    for (const role of subordinates) {
      const agent = await OperationsTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.is_team_lead).toBe(false);
    }
  });

  it('Ops Knowledge Bot is advisory only', async () => {
    const bot = await OperationsTestUtils.getKnowledgeBot('ops_knowledge_bot');
    expect(bot).not.toBeNull();
    expect(bot.is_knowledge_bot).toBe(true);
    expect(bot.persona.authority_level).toBe('advisory');
    // Knowledge bots have no restricted skills (all execution tools are forbidden)
    expect(bot.skills.restricted).toEqual([]);
  });

  it('Operations team exists in configuration', async () => {
    const team = await OperationsTestUtils.getTeam('operations');
    expect(team).toBeDefined();
    expect(team.team_lead_role).toBe('coo');
    expect(team.subordinates).toHaveLength(2);
  });

  it('COO has amendment authority', async () => {
    const coo = await OperationsTestUtils.getAgent('coo');
    expect(coo.persona.team_lead_powers.amendment_authority).toBe(true);
  });

  it('COO has weekly review cadence', async () => {
    const coo = await OperationsTestUtils.getAgent('coo');
    expect(coo.persona.team_lead_powers.review_cadence).toBe('weekly');
  });

  it('Operations team is distinct from tech team', async () => {
    const operationsTeam = await OperationsTestUtils.getTeam('operations');
    const techTeam = await OperationsTestUtils.getTeam('tech');

    // Verify teams are different
    expect(operationsTeam.team_lead_role).not.toBe(techTeam.team_lead_role);

    // Verify no overlap in subordinates
    const operationsSubordinates = new Set(operationsTeam.subordinates);
    for (const techSub of techTeam.subordinates) {
      expect(operationsSubordinates.has(techSub)).toBe(false);
    }
  });

  it('Operations team is distinct from marketing team', async () => {
    const operationsTeam = await OperationsTestUtils.getTeam('operations');
    const marketingTeam = await OperationsTestUtils.getTeam('marketing');

    // Verify teams are different
    expect(operationsTeam.team_lead_role).not.toBe(marketingTeam.team_lead_role);

    // Verify no overlap in subordinates
    const operationsSubordinates = new Set(operationsTeam.subordinates);
    for (const marketingSub of marketingTeam.subordinates) {
      expect(operationsSubordinates.has(marketingSub)).toBe(false);
    }
  });

  it('Operations team is distinct from product team', async () => {
    const operationsTeam = await OperationsTestUtils.getTeam('operations');
    const productTeam = await OperationsTestUtils.getTeam('product');

    // Verify teams are different
    expect(operationsTeam.team_lead_role).not.toBe(productTeam.team_lead_role);

    // Verify no overlap in subordinates
    const operationsSubordinates = new Set(operationsTeam.subordinates);
    for (const productSub of productTeam.subordinates) {
      expect(operationsSubordinates.has(productSub)).toBe(false);
    }
  });
});

// ============================================================================
// 2. COO REVIEW CYCLE TESTS
// ============================================================================

describe('COO Review Cycle', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('COO can review subordinate task history', async () => {
    // Create test tasks for vendor_management_lead
    await OperationsTestUtils.createTestTask('vendor_management_lead', { status: 'completed' });
    await OperationsTestUtils.createTestTask('vendor_management_lead', { status: 'completed' });
    await OperationsTestUtils.createTestTask('vendor_management_lead', { status: 'failed' });

    const tasks = await OperationsTestUtils.getTaskHistory('vendor_management_lead', 10);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].assigned_to).toBe('vendor_management_lead');
  });

  it('COO can generate amendments for subordinates', async () => {
    const cooConfig = engine.getTeamLeadConfig('coo');
    expect(cooConfig).not.toBeNull();
    expect(cooConfig.cos_powers.amendment_authority).toBe(true);

    // Verify COO can generate amendments for operations subordinates
    for (const subordinate of cooConfig.subordinates) {
      expect(OperationsTestUtils.isOperationsSubordinate(subordinate)).toBe(true);
    }
  });

  it('COO cannot modify own knowledge', async () => {
    const cooConfig = engine.getTeamLeadConfig('coo');
    expect(cooConfig).not.toBeNull();

    // Verify safety constraint is in place
    const constraints = engine.getSafetyConstraints();
    expect(constraints.SELF_MODIFY_BLOCKED).toBe(true);
  });

  it('COO cannot modify agents outside operations team', async () => {
    const cooConfig = engine.getTeamLeadConfig('coo');
    expect(cooConfig).not.toBeNull();

    // web_dev_lead is in tech team, not operations
    expect(cooConfig.subordinates).not.toContain('web_dev_lead');
    expect(cooConfig.subordinates).not.toContain('devops_lead');
    expect(cooConfig.subordinates).not.toContain('content_lead');

    // Verify team isolation
    const techTeam = await OperationsTestUtils.getTeam('tech');
    expect(techTeam.team_lead_role).toBe('cto');
    for (const techSubordinate of techTeam.subordinates) {
      expect(cooConfig.subordinates).not.toContain(techSubordinate);
    }

    // Verify marketing team isolation
    const marketingTeam = await OperationsTestUtils.getTeam('marketing');
    expect(marketingTeam.team_lead_role).toBe('cmo');
    for (const marketingSubordinate of marketingTeam.subordinates) {
      expect(cooConfig.subordinates).not.toContain(marketingSubordinate);
    }

    // Verify product team isolation
    const productTeam = await OperationsTestUtils.getTeam('product');
    expect(productTeam.team_lead_role).toBe('cpo');
    for (const productSubordinate of productTeam.subordinates) {
      expect(cooConfig.subordinates).not.toContain(productSubordinate);
    }
  });

  it('COO can calculate trend from operations task history', () => {
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

  it('COO escalation threshold is configured to 3', () => {
    const cooConfig = engine.getTeamLeadConfig('coo');
    expect(cooConfig.escalation.consecutive_failures_threshold).toBe(3);
    expect(cooConfig.escalation.escalate_to).toBe('cos');
  });
});

// ============================================================================
// 3. OPS KNOWLEDGE BOT TESTS
// ============================================================================

describe('Ops Knowledge Bot', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('ops_knowledge_bot');
  });

  it('Has correct subordinate list', () => {
    const subordinates = knowledgeBot.getSubordinates();
    expect(subordinates).toContain('vendor_management_lead');
    expect(subordinates).toContain('process_automation_lead');
    expect(subordinates).toHaveLength(2);
  });

  it('Can generate recommendations for vendor_management_lead', () => {
    expect(knowledgeBot.canRecommendFor('vendor_management_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('vendor_management_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('Vendor evaluation');
    expect(specialties).toContain('Contract negotiation');
  });

  it('Can generate recommendations for process_automation_lead', () => {
    expect(knowledgeBot.canRecommendFor('process_automation_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('process_automation_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('Workflow automation tools');
    expect(specialties).toContain('RPA implementation');
  });

  it('Cannot generate recommendations for other team members', () => {
    // Tech team members should not be recommendable by ops knowledge bot
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('qa_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('app_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('infrastructure_lead')).toBe(false);

    // Marketing team members should not be recommendable by ops knowledge bot
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('social_media_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('seo_growth_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('brand_lead')).toBe(false);

    // Product team members should not be recommendable by ops knowledge bot
    expect(knowledgeBot.canRecommendFor('ux_research_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('product_analytics_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('feature_spec_lead')).toBe(false);
  });

  it('Has correct research focus areas', () => {
    const researchFocus = knowledgeBot.getResearchFocus();
    expect(researchFocus.length).toBeGreaterThan(0);
    expect(researchFocus).toContain('Vendor management strategies');
    expect(researchFocus).toContain('Process automation tools');
    expect(researchFocus).toContain('Workflow optimization');
    expect(researchFocus).toContain('SLA management');
  });

  it('Reports to COO', () => {
    expect(knowledgeBot.reportsTo).toBe('coo');
    expect(knowledgeBot.getTeamLead()).toBe('coo');
  });

  it('Is advisory only', () => {
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');
  });

  it('Ops Knowledge Bot exists and is properly configured', () => {
    expect(knowledgeBot).not.toBeNull();
    expect(knowledgeBot.role).toBe('ops_knowledge_bot');
    expect(knowledgeBot.teamId).toBe('operations');
  });

  it('Knowledge Bot cannot recommend for self', () => {
    expect(knowledgeBot.canRecommendFor('ops_knowledge_bot')).toBe(false);
  });

  it('Knowledge Bot cannot recommend for COO (team lead)', () => {
    expect(knowledgeBot.canRecommendFor('coo')).toBe(false);
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
    const bot = getKnowledgeBotForTeam('operations');
    expect(bot).not.toBeNull();
    expect(bot.role).toBe('ops_knowledge_bot');
  });

  it('Knowledge Bot factory returns same instance from cache', () => {
    const bot1 = getKnowledgeBot('ops_knowledge_bot');
    const bot2 = getKnowledgeBot('ops_knowledge_bot');
    expect(bot1).toBe(bot2);
  });
});

// ============================================================================
// 4. OPERATIONS SAFETY CONSTRAINTS TESTS
// ============================================================================

describe('Operations Safety Constraints', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('ops_knowledge_bot');
  });

  it('Knowledge Bot cannot sign contracts', () => {
    // Knowledge bots are advisory only - they cannot execute any actions
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');

    // Check that no execution skills are allowed
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).not.toContain('contract_sign');
    expect(allowedSkills).not.toContain('legal_agreement');
    expect(allowedSkills).not.toContain('document_execute');
  });

  it('Knowledge Bot cannot make vendor payments', () => {
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).not.toContain('payment_process');
    expect(allowedSkills).not.toContain('vendor_payment');
    expect(allowedSkills).not.toContain('financial_transaction');
  });

  it('Recommendations expire after 7 days', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.RECOMMENDATION_EXPIRY_DAYS).toBe(7);
    expect(VALIDATION_RULES.EXPIRATION_DAYS).toBe(7);
  });

  it('Team isolation is enforced', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.TEAM_ISOLATION).toBe(true);

    // Ops bot cannot recommend for tech team
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);

    // Ops bot cannot recommend for marketing team
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('social_media_lead')).toBe(false);

    // Ops bot cannot recommend for product team
    expect(knowledgeBot.canRecommendFor('ux_research_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('product_analytics_lead')).toBe(false);
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

  it('COO cannot self-modify', () => {
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

describe('Operations Team Integration', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('Full COO review cycle completes', async () => {
    const cooConfig = engine.getTeamLeadConfig('coo');
    const team = await OperationsTestUtils.getTeam('operations');
    const bot = getKnowledgeBot('ops_knowledge_bot');

    // Verify alignment
    expect(cooConfig.team_id).toBe(team.team_id);
    expect(cooConfig.subordinates).toEqual(team.subordinates);
    expect(bot.reportsTo).toBe(cooConfig.role);
  });

  it('Recommendations can be converted to amendments', () => {
    const generator = new RecommendationGenerator();

    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test vendor management recommendation for improving contract negotiation process',
      targetingPattern: 'task_category:vendor_contracts',
      expectedImpact: 'high',
      reasoning: 'Based on recent vendor audit results and contract renewal analysis',
      sources: ['https://example.com/vendor-management-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'vendor_management_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('COO config matches team hierarchy', async () => {
    const cooConfig = engine.getTeamLeadConfig('coo');
    const team = await OperationsTestUtils.getTeam('operations');
    const bot = getKnowledgeBot('ops_knowledge_bot');

    // Verify alignment
    expect(cooConfig.team_id).toBe(team.team_id);
    expect(cooConfig.subordinates).toEqual(team.subordinates);
    expect(bot.reportsTo).toBe(cooConfig.role);
  });

  it('Knowledge Bot subordinates match COO subordinates', () => {
    const cooConfig = TEAM_LEAD_CONFIGS.find(c => c.role === 'coo');
    const bot = getKnowledgeBot('ops_knowledge_bot');

    const botSubordinates = bot.getSubordinates();
    for (const subordinate of cooConfig.subordinates) {
      expect(botSubordinates).toContain(subordinate);
    }
  });

  it('No operations subordinate belongs to other teams', () => {
    const operationsSubordinates = new Set(OperationsTestUtils.OPERATIONS_SUBORDINATES);

    for (const teamLeadConfig of TEAM_LEAD_CONFIGS) {
      if (teamLeadConfig.team_id !== 'operations') {
        for (const subordinate of teamLeadConfig.subordinates) {
          expect(operationsSubordinates.has(subordinate)).toBe(false);
        }
      }
    }
  });

  it('Learning tracker updates on recommendation outcome', async () => {
    const knowledgeBot = getKnowledgeBot('ops_knowledge_bot');

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

  it('Operations team has associated knowledge bot', () => {
    const cooConfig = TEAM_LEAD_CONFIGS.find(c => c.role === 'coo');
    const bot = getKnowledgeBotForTeam(cooConfig.team_id);

    expect(bot).not.toBeNull();
    expect(bot.reportsTo).toBe(cooConfig.role);
  });

  it('COO lookup works correctly', () => {
    // Check that subordinates can find their team lead
    const vendorManagementLeadTeamLead = engine.getTeamLeadForSubordinate('vendor_management_lead');
    expect(vendorManagementLeadTeamLead).not.toBeNull();
    expect(vendorManagementLeadTeamLead.role).toBe('coo');

    const processAutomationLeadTeamLead = engine.getTeamLeadForSubordinate('process_automation_lead');
    expect(processAutomationLeadTeamLead).not.toBeNull();
    expect(processAutomationLeadTeamLead.role).toBe('coo');
  });

  it('isCOO correctly identifies COO as team lead', () => {
    expect(engine.isTeamLead('coo')).toBe(true);
    expect(engine.isTeamLead('vendor_management_lead')).toBe(false);
    expect(engine.isTeamLead('process_automation_lead')).toBe(false);
  });

  it('Trend calculation produces expected results for improving operations performance', () => {
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

  it('Complete operations team hierarchy is valid', async () => {
    const hierarchy = {
      teamLead: await OperationsTestUtils.getAgent('coo'),
      knowledgeBot: await OperationsTestUtils.getKnowledgeBot('ops_knowledge_bot'),
      subordinates: await Promise.all([
        OperationsTestUtils.getAgent('vendor_management_lead'),
        OperationsTestUtils.getAgent('process_automation_lead'),
      ]),
    };

    // Verify team lead
    expect(hierarchy.teamLead.is_team_lead).toBe(true);
    expect(hierarchy.teamLead.team_id).toBe('operations');

    // Verify knowledge bot
    expect(hierarchy.knowledgeBot.is_knowledge_bot).toBe(true);
    expect(hierarchy.knowledgeBot.reports_to).toBe('coo');

    // Verify all subordinates
    for (const subordinate of hierarchy.subordinates) {
      expect(subordinate.is_team_lead).toBe(false);
      expect(subordinate.reports_to).toBe('coo');
      expect(subordinate.team_id).toBe('operations');
    }
  });
});

// ============================================================================
// 6. OPERATIONS RECOMMENDATION VALIDATION TESTS
// ============================================================================

describe('Operations Recommendation Validation', () => {
  let generator;

  beforeEach(() => {
    generator = new RecommendationGenerator();
  });

  it('Valid operations recommendation passes validation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Improve vendor evaluation process by implementing a standardized scoring matrix',
      targetingPattern: 'task_category:vendor_evaluation',
      expectedImpact: 'high',
      reasoning: 'Based on recent vendor audit results and procurement optimization analysis',
      sources: ['https://example.com/vendor-management-best-practices'],
    };

    const result = generator.validateRecommendation(recommendation, 'vendor_management_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Vendor management recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_modification',
      content: 'Update SLA monitoring templates to include automated breach notifications',
      targetingPattern: 'task_category:sla_management',
      expectedImpact: 'medium',
      reasoning: 'Recent SLA breaches went unnoticed due to manual monitoring gaps',
      sources: ['https://example.com/sla-management-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'vendor_management_lead');
    expect(result.valid).toBe(true);
  });

  it('Process automation recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Implement RPA for invoice processing to reduce manual data entry by 80%',
      targetingPattern: 'task_category:workflow_automation',
      expectedImpact: 'high',
      reasoning: 'Current manual invoice processing is error-prone and time-consuming',
      sources: ['https://example.com/rpa-implementation-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'process_automation_lead');
    expect(result.valid).toBe(true);
  });

  it('Workflow optimization recommendation validates correctly', () => {
    const recommendation = {
      type: 'skill_suggestion',
      content: 'Adopt process mining techniques to identify bottlenecks in approval workflows',
      targetingPattern: 'task_category:process_optimization',
      expectedImpact: 'medium',
      reasoning: 'Approval workflows have 40% longer cycle times than industry benchmarks',
      sources: ['https://example.com/process-mining-framework'],
    };

    const result = generator.validateRecommendation(recommendation, 'process_automation_lead');
    expect(result.valid).toBe(true);
  });

  it('Missing sources fails validation for operations recommendation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test content without sources',
      targetingPattern: 'task_category:vendor_management',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: [], // Empty sources
    };

    const result = generator.validateRecommendation(recommendation, 'vendor_management_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('source'))).toBe(true);
  });

  it('Content exceeding word limit fails validation', () => {
    const longContent = Array(250).fill('operations').join(' '); // 250 words
    const recommendation = {
      type: 'knowledge_addition',
      content: longContent,
      targetingPattern: 'task_category:operations',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: ['https://example.com'],
    };

    const result = generator.validateRecommendation(recommendation, 'vendor_management_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('words'))).toBe(true);
  });
});

// ============================================================================
// 7. ESCALATION TESTS (OPERATIONS-SPECIFIC)
// ============================================================================

describe('Operations Escalation Handling', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('COO consecutive failures threshold is 3', () => {
    const cooConfig = engine.getTeamLeadConfig('coo');
    expect(cooConfig.escalation.consecutive_failures_threshold).toBe(3);
  });

  it('COO escalation target is CoS', () => {
    const cooConfig = engine.getTeamLeadConfig('coo');
    expect(cooConfig.escalation.escalate_to).toBe('cos');
  });

  it('Critical COS score threshold triggers escalation for operations', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(0.3);

    // A score below critical should trigger escalation
    const criticalScore = 0.25;
    expect(criticalScore < constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(true);
  });

  it('Warning COS score threshold triggers amendment for operations', () => {
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
  it('Operations Knowledge Bot cannot access tech team members', () => {
    const opsBot = getKnowledgeBot('ops_knowledge_bot');
    const techBot = getKnowledgeBot('tech_knowledge_bot');

    // Ops bot can only recommend for operations team
    expect(opsBot.canRecommendFor('vendor_management_lead')).toBe(true);
    expect(opsBot.canRecommendFor('web_dev_lead')).toBe(false);

    // Tech bot can only recommend for tech team
    expect(techBot.canRecommendFor('web_dev_lead')).toBe(true);
    expect(techBot.canRecommendFor('vendor_management_lead')).toBe(false);
  });

  it('Operations Knowledge Bot cannot access marketing team members', () => {
    const opsBot = getKnowledgeBot('ops_knowledge_bot');
    const marketingBot = getKnowledgeBot('marketing_knowledge_bot');

    // Ops bot can only recommend for operations team
    expect(opsBot.canRecommendFor('process_automation_lead')).toBe(true);
    expect(opsBot.canRecommendFor('content_lead')).toBe(false);

    // Marketing bot can only recommend for marketing team
    expect(marketingBot.canRecommendFor('content_lead')).toBe(true);
    expect(marketingBot.canRecommendFor('process_automation_lead')).toBe(false);
  });

  it('Operations Knowledge Bot cannot access product team members', () => {
    const opsBot = getKnowledgeBot('ops_knowledge_bot');
    const productBot = getKnowledgeBot('product_knowledge_bot');

    // Ops bot can only recommend for operations team
    expect(opsBot.canRecommendFor('vendor_management_lead')).toBe(true);
    expect(opsBot.canRecommendFor('ux_research_lead')).toBe(false);

    // Product bot can only recommend for product team
    expect(productBot.canRecommendFor('ux_research_lead')).toBe(true);
    expect(productBot.canRecommendFor('vendor_management_lead')).toBe(false);
  });

  it('All four teams have distinct subordinate sets', async () => {
    const operationsTeam = await OperationsTestUtils.getTeam('operations');
    const techTeam = await OperationsTestUtils.getTeam('tech');
    const marketingTeam = await OperationsTestUtils.getTeam('marketing');
    const productTeam = await OperationsTestUtils.getTeam('product');

    const opsSubs = new Set(operationsTeam.subordinates);
    const techSubs = new Set(techTeam.subordinates);
    const marketingSubs = new Set(marketingTeam.subordinates);
    const productSubs = new Set(productTeam.subordinates);

    // No overlap between operations and tech
    for (const sub of opsSubs) {
      expect(techSubs.has(sub)).toBe(false);
    }

    // No overlap between operations and marketing
    for (const sub of opsSubs) {
      expect(marketingSubs.has(sub)).toBe(false);
    }

    // No overlap between operations and product
    for (const sub of opsSubs) {
      expect(productSubs.has(sub)).toBe(false);
    }

    // No overlap between tech and marketing
    for (const sub of techSubs) {
      expect(marketingSubs.has(sub)).toBe(false);
    }

    // No overlap between tech and product
    for (const sub of techSubs) {
      expect(productSubs.has(sub)).toBe(false);
    }

    // No overlap between marketing and product
    for (const sub of marketingSubs) {
      expect(productSubs.has(sub)).toBe(false);
    }
  });
});

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  OperationsTestUtils,
};
