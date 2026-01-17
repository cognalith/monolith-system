/**
 * People Team Validation Test Suite - Phase 6H
 * Cognalith Inc. | Monolith System
 *
 * Comprehensive test suite for validating People Team structure, CHRO review cycles,
 * People Knowledge Bot functionality, and integration scenarios.
 *
 * Tests cover:
 * - Team hierarchy and structure validation
 * - CHRO CoS (Chief of Staff) review powers
 * - People Knowledge Bot advisory functionality
 * - People-specific safety constraints
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
  CHRO_CONFIG,
  HIRING_LEAD_CONFIG,
  COMPLIANCE_LEAD_CONFIG,
  PEOPLE_KNOWLEDGE_BOT_CONFIG,
  PEOPLE_TEAM_CONFIGS,
  PEOPLE_TEAM_BY_ROLE,
  getPeopleTeamSubordinates,
  getPeopleTeamLead,
  getPeopleTeamConfig,
} = await import('./people-team-configs.js');

// ============================================================================
// TEST UTILITIES FOR PEOPLE TEAM
// ============================================================================

/**
 * Test helper utilities for People Team tests
 */
const PeopleTestUtils = {
  /**
   * People team subordinate roles
   */
  PEOPLE_SUBORDINATES: ['hiring_lead', 'compliance_lead'],

  /**
   * People Knowledge Bot subordinate specialties
   */
  PEOPLE_SPECIALTIES: {
    hiring_lead: ['Sourcing strategies', 'Interview techniques', 'Candidate experience', 'Offer management', 'Onboarding optimization'],
    compliance_lead: ['Labor law updates', 'Policy documentation', 'Audit preparation', 'Training requirements', 'Workplace safety'],
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
      category: options.category || 'people',
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
      content: options.content || 'Test people team recommendation for improving hiring processes',
      targeting_pattern: options.targeting_pattern || 'task_category:hiring',
      expected_impact: options.expected_impact || 'medium',
      reasoning: options.reasoning || 'Test reasoning for the people team recommendation',
      sources: options.sources || ['https://example.com/hr-best-practices'],
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
      content: 'Expired people team recommendation',
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
   * Verify people team subordinate belongs to people team
   * @param {string} role - Role to verify
   * @returns {boolean}
   */
  isPeopleSubordinate(role) {
    return this.PEOPLE_SUBORDINATES.includes(role);
  },

  /**
   * Get expected specialties for a people subordinate
   * @param {string} role - Subordinate role
   * @returns {string[]}
   */
  getExpectedSpecialties(role) {
    return this.PEOPLE_SPECIALTIES[role] || [];
  },
};

// Export test utilities for reuse
export { PeopleTestUtils };

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

beforeEach(() => {
  jest.clearAllMocks();
  PeopleTestUtils.clearTestData();
});

afterEach(() => {
  PeopleTestUtils.clearTestData();
});

// ============================================================================
// 1. PEOPLE TEAM CONFIG STRUCTURE TESTS
// ============================================================================

describe('People Team Config Structure', () => {
  describe('CHRO_CONFIG', () => {
    it('has correct role', () => {
      expect(CHRO_CONFIG.role).toBe('chro');
    });

    it('has correct team_id', () => {
      expect(CHRO_CONFIG.team_id).toBe('people');
    });

    it('is marked as team lead', () => {
      expect(CHRO_CONFIG.is_team_lead).toBe(true);
    });

    it('reports to CoS', () => {
      expect(CHRO_CONFIG.reports_to).toBe('cos');
    });

    it('has correct subordinates', () => {
      expect(CHRO_CONFIG.persona.team_lead_powers.subordinates).toContain('hiring_lead');
      expect(CHRO_CONFIG.persona.team_lead_powers.subordinates).toContain('compliance_lead');
      expect(CHRO_CONFIG.persona.team_lead_powers.subordinates).toHaveLength(2);
    });

    it('has amendment authority', () => {
      expect(CHRO_CONFIG.persona.team_lead_powers.amendment_authority).toBe(true);
    });

    it('has daily review cadence', () => {
      expect(CHRO_CONFIG.persona.team_lead_powers.review_cadence).toBe('daily');
    });

    it('has knowledge bot reference', () => {
      expect(CHRO_CONFIG.persona.team_lead_powers.knowledge_bot).toBe('people_knowledge_bot');
    });

    it('has c_suite authority level', () => {
      expect(CHRO_CONFIG.persona.authority_level).toBe('c_suite');
    });

    it('has required skills', () => {
      expect(CHRO_CONFIG.skills.core).toContain('browser');
      expect(CHRO_CONFIG.skills.core).toContain('notion');
    });

    it('has model configuration', () => {
      expect(CHRO_CONFIG.model.provider).toBe('anthropic');
      expect(CHRO_CONFIG.model.model_id).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('HIRING_LEAD_CONFIG', () => {
    it('has correct role', () => {
      expect(HIRING_LEAD_CONFIG.role).toBe('hiring_lead');
    });

    it('has correct team_id', () => {
      expect(HIRING_LEAD_CONFIG.team_id).toBe('people');
    });

    it('is not team lead', () => {
      expect(HIRING_LEAD_CONFIG.is_team_lead).toBe(false);
    });

    it('reports to CHRO', () => {
      expect(HIRING_LEAD_CONFIG.reports_to).toBe('chro');
    });

    it('has specialist authority level', () => {
      expect(HIRING_LEAD_CONFIG.persona.authority_level).toBe('specialist');
    });

    it('has recruiting-related skills', () => {
      expect(HIRING_LEAD_CONFIG.skills.core).toContain('greenhouse');
      expect(HIRING_LEAD_CONFIG.skills.core).toContain('linkedin_recruiter');
    });

    it('has restricted skills', () => {
      expect(HIRING_LEAD_CONFIG.skills.restricted).toBeDefined();
      expect(HIRING_LEAD_CONFIG.skills.restricted.length).toBeGreaterThan(0);
    });

    it('escalates to CHRO', () => {
      expect(HIRING_LEAD_CONFIG.persona.escalation.escalates_to).toBe('chro');
    });

    it('has knowledge base', () => {
      expect(HIRING_LEAD_CONFIG.knowledge.base).toBeDefined();
      expect(HIRING_LEAD_CONFIG.knowledge.base.length).toBeGreaterThan(0);
    });
  });

  describe('COMPLIANCE_LEAD_CONFIG', () => {
    it('has correct role', () => {
      expect(COMPLIANCE_LEAD_CONFIG.role).toBe('compliance_lead');
    });

    it('has correct team_id', () => {
      expect(COMPLIANCE_LEAD_CONFIG.team_id).toBe('people');
    });

    it('is not team lead', () => {
      expect(COMPLIANCE_LEAD_CONFIG.is_team_lead).toBe(false);
    });

    it('reports to CHRO', () => {
      expect(COMPLIANCE_LEAD_CONFIG.reports_to).toBe('chro');
    });

    it('has specialist authority level', () => {
      expect(COMPLIANCE_LEAD_CONFIG.persona.authority_level).toBe('specialist');
    });

    it('has compliance-related skills', () => {
      expect(COMPLIANCE_LEAD_CONFIG.skills.core).toContain('docusign');
      expect(COMPLIANCE_LEAD_CONFIG.skills.core).toContain('bamboohr');
    });

    it('has restricted skills', () => {
      expect(COMPLIANCE_LEAD_CONFIG.skills.restricted).toBeDefined();
      expect(COMPLIANCE_LEAD_CONFIG.skills.restricted.length).toBeGreaterThan(0);
    });

    it('escalates to CHRO', () => {
      expect(COMPLIANCE_LEAD_CONFIG.persona.escalation.escalates_to).toBe('chro');
    });
  });

  describe('PEOPLE_KNOWLEDGE_BOT_CONFIG', () => {
    it('has correct role', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.role).toBe('people_knowledge_bot');
    });

    it('has correct team_id', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.team_id).toBe('people');
    });

    it('is marked as knowledge bot', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.is_knowledge_bot).toBe(true);
    });

    it('reports to CHRO', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.reports_to).toBe('chro');
    });

    it('has advisory authority level', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.persona.authority_level).toBe('advisory');
    });

    it('has empty restricted skills (advisory only)', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.skills.restricted).toEqual([]);
    });

    it('has subordinate_specialties at root level', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.subordinate_specialties).toBeDefined();
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.subordinate_specialties.hiring_lead).toBeDefined();
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.subordinate_specialties.compliance_lead).toBeDefined();
    });

    it('has research_focus at root level', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.research_focus).toBeDefined();
      expect(Array.isArray(PEOPLE_KNOWLEDGE_BOT_CONFIG.research_focus)).toBe(true);
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.research_focus.length).toBeGreaterThan(0);
    });

    it('has research config', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.research_config.cadence).toBe('daily');
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.research_config.recommendations_per_subordinate).toBe(2);
    });

    it('has correct subordinates in knowledge_bot_config', () => {
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.persona.knowledge_bot_config.subordinates).toContain('hiring_lead');
      expect(PEOPLE_KNOWLEDGE_BOT_CONFIG.persona.knowledge_bot_config.subordinates).toContain('compliance_lead');
    });
  });
});

// ============================================================================
// 2. PEOPLE TEAM STRUCTURE TESTS
// ============================================================================

describe('People Team Structure', () => {
  it('CHRO has correct subordinates', async () => {
    const chro = await PeopleTestUtils.getAgent('chro');
    expect(chro).not.toBeNull();
    expect(chro.persona.team_lead_powers.subordinates).toContain('hiring_lead');
    expect(chro.persona.team_lead_powers.subordinates).toContain('compliance_lead');
    expect(chro.persona.team_lead_powers.subordinates).toHaveLength(2);
  });

  it('All subordinates report to CHRO', async () => {
    const subordinates = ['hiring_lead', 'compliance_lead'];
    for (const role of subordinates) {
      const agent = await PeopleTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.reports_to).toBe('chro');
      expect(agent.team_id).toBe('people');
    }
  });

  it('CHRO is marked as team lead', async () => {
    const chro = await PeopleTestUtils.getAgent('chro');
    expect(chro).not.toBeNull();
    expect(chro.is_team_lead).toBe(true);
  });

  it('Subordinates are not team leads', async () => {
    const subordinates = ['hiring_lead', 'compliance_lead'];
    for (const role of subordinates) {
      const agent = await PeopleTestUtils.getAgent(role);
      expect(agent).not.toBeNull();
      expect(agent.is_team_lead).toBe(false);
    }
  });

  it('People Knowledge Bot is advisory only', async () => {
    const bot = await PeopleTestUtils.getKnowledgeBot('people_knowledge_bot');
    expect(bot).not.toBeNull();
    expect(bot.is_knowledge_bot).toBe(true);
    expect(bot.persona.authority_level).toBe('advisory');
    // Knowledge bots have no restricted skills (all execution tools are forbidden)
    expect(bot.skills.restricted).toEqual([]);
  });

  it('People team exists in configuration', async () => {
    const team = await PeopleTestUtils.getTeam('people');
    expect(team).toBeDefined();
    expect(team.team_lead_role).toBe('chro');
    expect(team.subordinates).toHaveLength(2);
  });

  it('CHRO has amendment authority', async () => {
    const chro = await PeopleTestUtils.getAgent('chro');
    expect(chro.persona.team_lead_powers.amendment_authority).toBe(true);
  });

  it('People team is distinct from tech team', async () => {
    const peopleTeam = await PeopleTestUtils.getTeam('people');
    const techTeam = await PeopleTestUtils.getTeam('tech');

    // Verify teams are different
    expect(peopleTeam.team_lead_role).not.toBe(techTeam.team_lead_role);

    // Verify no overlap in subordinates
    const peopleSubordinates = new Set(peopleTeam.subordinates);
    for (const techSub of techTeam.subordinates) {
      expect(peopleSubordinates.has(techSub)).toBe(false);
    }
  });

  it('People team is distinct from operations team', async () => {
    const peopleTeam = await PeopleTestUtils.getTeam('people');
    const operationsTeam = await PeopleTestUtils.getTeam('operations');

    // Verify teams are different
    expect(peopleTeam.team_lead_role).not.toBe(operationsTeam.team_lead_role);

    // Verify no overlap in subordinates
    const peopleSubordinates = new Set(peopleTeam.subordinates);
    for (const opsSub of operationsTeam.subordinates) {
      expect(peopleSubordinates.has(opsSub)).toBe(false);
    }
  });

  it('People team is distinct from marketing team', async () => {
    const peopleTeam = await PeopleTestUtils.getTeam('people');
    const marketingTeam = await PeopleTestUtils.getTeam('marketing');

    // Verify teams are different
    expect(peopleTeam.team_lead_role).not.toBe(marketingTeam.team_lead_role);

    // Verify no overlap in subordinates
    const peopleSubordinates = new Set(peopleTeam.subordinates);
    for (const marketingSub of marketingTeam.subordinates) {
      expect(peopleSubordinates.has(marketingSub)).toBe(false);
    }
  });

  it('People team is distinct from product team', async () => {
    const peopleTeam = await PeopleTestUtils.getTeam('people');
    const productTeam = await PeopleTestUtils.getTeam('product');

    // Verify teams are different
    expect(peopleTeam.team_lead_role).not.toBe(productTeam.team_lead_role);

    // Verify no overlap in subordinates
    const peopleSubordinates = new Set(peopleTeam.subordinates);
    for (const productSub of productTeam.subordinates) {
      expect(peopleSubordinates.has(productSub)).toBe(false);
    }
  });
});

// ============================================================================
// 3. CHRO REVIEW CYCLE TESTS
// ============================================================================

describe('CHRO Review Cycle', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('CHRO can review subordinate task history', async () => {
    // Create test tasks for hiring_lead
    await PeopleTestUtils.createTestTask('hiring_lead', { status: 'completed' });
    await PeopleTestUtils.createTestTask('hiring_lead', { status: 'completed' });
    await PeopleTestUtils.createTestTask('hiring_lead', { status: 'failed' });

    const tasks = await PeopleTestUtils.getTaskHistory('hiring_lead', 10);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].assigned_to).toBe('hiring_lead');
  });

  it('CHRO can generate amendments for subordinates', async () => {
    const chroConfig = engine.getTeamLeadConfig('chro');
    expect(chroConfig).not.toBeNull();
    expect(chroConfig.cos_powers.amendment_authority).toBe(true);

    // Verify CHRO can generate amendments for people subordinates
    for (const subordinate of chroConfig.subordinates) {
      expect(PeopleTestUtils.isPeopleSubordinate(subordinate)).toBe(true);
    }
  });

  it('CHRO cannot modify own knowledge', async () => {
    const chroConfig = engine.getTeamLeadConfig('chro');
    expect(chroConfig).not.toBeNull();

    // Verify safety constraint is in place
    const constraints = engine.getSafetyConstraints();
    expect(constraints.SELF_MODIFY_BLOCKED).toBe(true);
  });

  it('CHRO cannot modify agents outside people team', async () => {
    const chroConfig = engine.getTeamLeadConfig('chro');
    expect(chroConfig).not.toBeNull();

    // web_dev_lead is in tech team, not people
    expect(chroConfig.subordinates).not.toContain('web_dev_lead');
    expect(chroConfig.subordinates).not.toContain('devops_lead');
    expect(chroConfig.subordinates).not.toContain('content_lead');

    // Verify tech team isolation
    const techTeam = await PeopleTestUtils.getTeam('tech');
    expect(techTeam.team_lead_role).toBe('cto');
    for (const techSubordinate of techTeam.subordinates) {
      expect(chroConfig.subordinates).not.toContain(techSubordinate);
    }
  });

  it('CHRO can calculate trend from people task history', () => {
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

  it('CHRO escalation threshold is configured to 3', () => {
    const chroConfig = engine.getTeamLeadConfig('chro');
    expect(chroConfig.escalation.consecutive_failures_threshold).toBe(3);
    expect(chroConfig.escalation.escalate_to).toBe('cos');
  });
});

// ============================================================================
// 4. PEOPLE KNOWLEDGE BOT TESTS
// ============================================================================

describe('People Knowledge Bot', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('people_knowledge_bot');
  });

  it('Has correct subordinate list', () => {
    const subordinates = knowledgeBot.getSubordinates();
    expect(subordinates).toContain('hiring_lead');
    expect(subordinates).toContain('compliance_lead');
    expect(subordinates).toHaveLength(2);
  });

  it('Can generate recommendations for hiring_lead', () => {
    expect(knowledgeBot.canRecommendFor('hiring_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('hiring_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('Sourcing strategies');
    expect(specialties).toContain('Interview techniques');
  });

  it('Can generate recommendations for compliance_lead', () => {
    expect(knowledgeBot.canRecommendFor('compliance_lead')).toBe(true);

    const specialties = knowledgeBot.getSubordinateSpecialties('compliance_lead');
    expect(specialties.length).toBeGreaterThan(0);
    expect(specialties).toContain('Labor law updates');
    expect(specialties).toContain('Audit preparation');
  });

  it('Cannot generate recommendations for other team members', () => {
    // Tech team members should not be recommendable by people knowledge bot
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('qa_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('app_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('infrastructure_lead')).toBe(false);

    // Marketing team members should not be recommendable by people knowledge bot
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('social_media_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('seo_growth_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('brand_lead')).toBe(false);

    // Operations team members should not be recommendable by people knowledge bot
    expect(knowledgeBot.canRecommendFor('vendor_management_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('process_automation_lead')).toBe(false);
  });

  it('Has correct research focus areas', () => {
    const researchFocus = knowledgeBot.getResearchFocus();
    expect(researchFocus.length).toBeGreaterThan(0);
    expect(researchFocus).toContain('Hiring best practices');
    expect(researchFocus).toContain('Compliance requirements');
    expect(researchFocus).toContain('Employee engagement');
  });

  it('Reports to CHRO', () => {
    expect(knowledgeBot.reportsTo).toBe('chro');
    expect(knowledgeBot.getTeamLead()).toBe('chro');
  });

  it('Is advisory only', () => {
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');
  });

  it('People Knowledge Bot exists and is properly configured', () => {
    expect(knowledgeBot).not.toBeNull();
    expect(knowledgeBot.role).toBe('people_knowledge_bot');
    expect(knowledgeBot.teamId).toBe('people');
  });

  it('Knowledge Bot cannot recommend for self', () => {
    expect(knowledgeBot.canRecommendFor('people_knowledge_bot')).toBe(false);
  });

  it('Knowledge Bot cannot recommend for CHRO (team lead)', () => {
    expect(knowledgeBot.canRecommendFor('chro')).toBe(false);
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
    const bot = getKnowledgeBotForTeam('people');
    expect(bot).not.toBeNull();
    expect(bot.role).toBe('people_knowledge_bot');
  });

  it('Knowledge Bot factory returns same instance from cache', () => {
    const bot1 = getKnowledgeBot('people_knowledge_bot');
    const bot2 = getKnowledgeBot('people_knowledge_bot');
    expect(bot1).toBe(bot2);
  });
});

// ============================================================================
// 5. PEOPLE SAFETY CONSTRAINTS TESTS
// ============================================================================

describe('People Safety Constraints', () => {
  let knowledgeBot;

  beforeEach(() => {
    clearBotCache();
    knowledgeBot = getKnowledgeBot('people_knowledge_bot');
  });

  it('Knowledge Bot cannot make hiring decisions', () => {
    // Knowledge bots are advisory only - they cannot execute any actions
    expect(knowledgeBot.config.persona.authority_level).toBe('advisory');

    // Check that no execution skills are allowed
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).not.toContain('hiring_decision');
    expect(allowedSkills).not.toContain('offer_extend');
    expect(allowedSkills).not.toContain('termination');
  });

  it('Knowledge Bot cannot modify compensation', () => {
    const allowedSkills = KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.ALLOWED_SKILLS;
    expect(allowedSkills).not.toContain('compensation_change');
    expect(allowedSkills).not.toContain('salary_adjustment');
    expect(allowedSkills).not.toContain('benefits_modification');
  });

  it('Recommendations expire after 7 days', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.RECOMMENDATION_EXPIRY_DAYS).toBe(7);
    expect(VALIDATION_RULES.EXPIRATION_DAYS).toBe(7);
  });

  it('Team isolation is enforced', () => {
    expect(KNOWLEDGE_BOT_SAFETY_CONSTRAINTS.TEAM_ISOLATION).toBe(true);

    // People bot cannot recommend for tech team
    expect(knowledgeBot.canRecommendFor('web_dev_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('devops_lead')).toBe(false);

    // People bot cannot recommend for marketing team
    expect(knowledgeBot.canRecommendFor('content_lead')).toBe(false);
    expect(knowledgeBot.canRecommendFor('social_media_lead')).toBe(false);

    // People bot cannot recommend for operations team
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

  it('CHRO cannot self-modify', () => {
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
// 6. INTEGRATION TESTS
// ============================================================================

describe('People Team Integration', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('Full CHRO review cycle completes', async () => {
    const chroConfig = engine.getTeamLeadConfig('chro');
    const team = await PeopleTestUtils.getTeam('people');
    const bot = getKnowledgeBot('people_knowledge_bot');

    // Verify alignment
    expect(chroConfig.team_id).toBe(team.team_id);
    expect(chroConfig.subordinates).toEqual(team.subordinates);
    expect(bot.reportsTo).toBe(chroConfig.role);
  });

  it('Recommendations can be converted to amendments', () => {
    const generator = new RecommendationGenerator();

    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test hiring recommendation for improving candidate screening process',
      targetingPattern: 'task_category:candidate_screening',
      expectedImpact: 'high',
      reasoning: 'Based on recent hiring metrics analysis and time-to-fill improvements',
      sources: ['https://example.com/hiring-best-practices'],
    };

    const result = generator.validateRecommendation(recommendation, 'hiring_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('CHRO config matches team hierarchy', async () => {
    const chroConfig = engine.getTeamLeadConfig('chro');
    const team = await PeopleTestUtils.getTeam('people');
    const bot = getKnowledgeBot('people_knowledge_bot');

    // Verify alignment
    expect(chroConfig.team_id).toBe(team.team_id);
    expect(chroConfig.subordinates).toEqual(team.subordinates);
    expect(bot.reportsTo).toBe(chroConfig.role);
  });

  it('Knowledge Bot subordinates match CHRO subordinates', () => {
    const chroConfig = TEAM_LEAD_CONFIGS.find(c => c.role === 'chro');
    const bot = getKnowledgeBot('people_knowledge_bot');

    const botSubordinates = bot.getSubordinates();
    for (const subordinate of chroConfig.subordinates) {
      expect(botSubordinates).toContain(subordinate);
    }
  });

  it('No people subordinate belongs to other teams', () => {
    const peopleSubordinates = new Set(PeopleTestUtils.PEOPLE_SUBORDINATES);

    for (const teamLeadConfig of TEAM_LEAD_CONFIGS) {
      if (teamLeadConfig.team_id !== 'people') {
        for (const subordinate of teamLeadConfig.subordinates) {
          expect(peopleSubordinates.has(subordinate)).toBe(false);
        }
      }
    }
  });

  it('Learning tracker updates on recommendation outcome', async () => {
    const knowledgeBot = getKnowledgeBot('people_knowledge_bot');

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

  it('People team has associated knowledge bot', () => {
    const chroConfig = TEAM_LEAD_CONFIGS.find(c => c.role === 'chro');
    const bot = getKnowledgeBotForTeam(chroConfig.team_id);

    expect(bot).not.toBeNull();
    expect(bot.reportsTo).toBe(chroConfig.role);
  });

  it('CHRO lookup works correctly', () => {
    // Check that subordinates can find their team lead
    const hiringLeadTeamLead = engine.getTeamLeadForSubordinate('hiring_lead');
    expect(hiringLeadTeamLead).not.toBeNull();
    expect(hiringLeadTeamLead.role).toBe('chro');

    const complianceLeadTeamLead = engine.getTeamLeadForSubordinate('compliance_lead');
    expect(complianceLeadTeamLead).not.toBeNull();
    expect(complianceLeadTeamLead.role).toBe('chro');
  });

  it('isCHRO correctly identifies CHRO as team lead', () => {
    expect(engine.isTeamLead('chro')).toBe(true);
    expect(engine.isTeamLead('hiring_lead')).toBe(false);
    expect(engine.isTeamLead('compliance_lead')).toBe(false);
  });

  it('Trend calculation produces expected results for improving people performance', () => {
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

  it('Complete people team hierarchy is valid', async () => {
    const hierarchy = {
      teamLead: await PeopleTestUtils.getAgent('chro'),
      knowledgeBot: await PeopleTestUtils.getKnowledgeBot('people_knowledge_bot'),
      subordinates: await Promise.all([
        PeopleTestUtils.getAgent('hiring_lead'),
        PeopleTestUtils.getAgent('compliance_lead'),
      ]),
    };

    // Verify team lead
    expect(hierarchy.teamLead.is_team_lead).toBe(true);
    expect(hierarchy.teamLead.team_id).toBe('people');

    // Verify knowledge bot
    expect(hierarchy.knowledgeBot.is_knowledge_bot).toBe(true);
    expect(hierarchy.knowledgeBot.reports_to).toBe('chro');

    // Verify all subordinates
    for (const subordinate of hierarchy.subordinates) {
      expect(subordinate.is_team_lead).toBe(false);
      expect(subordinate.reports_to).toBe('chro');
      expect(subordinate.team_id).toBe('people');
    }
  });
});

// ============================================================================
// 7. PEOPLE RECOMMENDATION VALIDATION TESTS
// ============================================================================

describe('People Recommendation Validation', () => {
  let generator;

  beforeEach(() => {
    generator = new RecommendationGenerator();
  });

  it('Valid people recommendation passes validation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Improve candidate sourcing by implementing structured boolean search strategies',
      targetingPattern: 'task_category:talent_sourcing',
      expectedImpact: 'high',
      reasoning: 'Based on recent hiring pipeline analysis and time-to-fill metrics',
      sources: ['https://example.com/recruiting-best-practices'],
    };

    const result = generator.validateRecommendation(recommendation, 'hiring_lead');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('Hiring recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_modification',
      content: 'Update interview scorecards to include behavioral assessment criteria for cultural fit',
      targetingPattern: 'task_category:interviews',
      expectedImpact: 'medium',
      reasoning: 'Recent quality of hire scores indicate cultural fit issues',
      sources: ['https://example.com/interview-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'hiring_lead');
    expect(result.valid).toBe(true);
  });

  it('Compliance recommendation validates correctly', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Implement quarterly compliance training tracking to ensure OSHA certification remains current',
      targetingPattern: 'task_category:compliance_training',
      expectedImpact: 'high',
      reasoning: 'Recent audit identified training gaps in safety compliance',
      sources: ['https://example.com/osha-compliance-guide'],
    };

    const result = generator.validateRecommendation(recommendation, 'compliance_lead');
    expect(result.valid).toBe(true);
  });

  it('Labor law recommendation validates correctly', () => {
    const recommendation = {
      type: 'skill_suggestion',
      content: 'Adopt automated labor law monitoring service for real-time regulatory updates',
      targetingPattern: 'task_category:labor_law',
      expectedImpact: 'medium',
      reasoning: 'Manual tracking of multi-state labor laws is prone to missed updates',
      sources: ['https://example.com/labor-law-monitoring'],
    };

    const result = generator.validateRecommendation(recommendation, 'compliance_lead');
    expect(result.valid).toBe(true);
  });

  it('Missing sources fails validation for people recommendation', () => {
    const recommendation = {
      type: 'knowledge_addition',
      content: 'Test content without sources',
      targetingPattern: 'task_category:hiring',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: [], // Empty sources
    };

    const result = generator.validateRecommendation(recommendation, 'hiring_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('source'))).toBe(true);
  });

  it('Content exceeding word limit fails validation', () => {
    const longContent = Array(250).fill('hiring').join(' '); // 250 words
    const recommendation = {
      type: 'knowledge_addition',
      content: longContent,
      targetingPattern: 'task_category:people',
      expectedImpact: 'medium',
      reasoning: 'Test reasoning',
      sources: ['https://example.com'],
    };

    const result = generator.validateRecommendation(recommendation, 'hiring_lead');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('words'))).toBe(true);
  });
});

// ============================================================================
// 8. ESCALATION TESTS (PEOPLE-SPECIFIC)
// ============================================================================

describe('People Escalation Handling', () => {
  let engine;

  beforeEach(() => {
    engine = new TeamLeadReviewEngine();
  });

  it('CHRO consecutive failures threshold is 3', () => {
    const chroConfig = engine.getTeamLeadConfig('chro');
    expect(chroConfig.escalation.consecutive_failures_threshold).toBe(3);
  });

  it('CHRO escalation target is CoS', () => {
    const chroConfig = engine.getTeamLeadConfig('chro');
    expect(chroConfig.escalation.escalate_to).toBe('cos');
  });

  it('Critical COS score threshold triggers escalation for people', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(0.3);

    // A score below critical should trigger escalation
    const criticalScore = 0.25;
    expect(criticalScore < constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(true);
  });

  it('Warning COS score threshold triggers amendment for people', () => {
    const constraints = engine.getSafetyConstraints();
    expect(constraints.COS_SCORE_THRESHOLDS.WARNING).toBe(0.5);

    // A score below warning but above critical should trigger amendment
    const warningScore = 0.45;
    expect(warningScore < constraints.COS_SCORE_THRESHOLDS.WARNING).toBe(true);
    expect(warningScore >= constraints.COS_SCORE_THRESHOLDS.CRITICAL).toBe(true);
  });
});

// ============================================================================
// 9. CROSS-TEAM ISOLATION TESTS
// ============================================================================

describe('Cross-Team Isolation', () => {
  it('People Knowledge Bot cannot access tech team members', () => {
    const peopleBot = getKnowledgeBot('people_knowledge_bot');
    const techBot = getKnowledgeBot('tech_knowledge_bot');

    // People bot can only recommend for people team
    expect(peopleBot.canRecommendFor('hiring_lead')).toBe(true);
    expect(peopleBot.canRecommendFor('web_dev_lead')).toBe(false);

    // Tech bot can only recommend for tech team
    expect(techBot.canRecommendFor('web_dev_lead')).toBe(true);
    expect(techBot.canRecommendFor('hiring_lead')).toBe(false);
  });

  it('People Knowledge Bot cannot access marketing team members', () => {
    const peopleBot = getKnowledgeBot('people_knowledge_bot');
    const marketingBot = getKnowledgeBot('marketing_knowledge_bot');

    // People bot can only recommend for people team
    expect(peopleBot.canRecommendFor('compliance_lead')).toBe(true);
    expect(peopleBot.canRecommendFor('content_lead')).toBe(false);

    // Marketing bot can only recommend for marketing team
    expect(marketingBot.canRecommendFor('content_lead')).toBe(true);
    expect(marketingBot.canRecommendFor('compliance_lead')).toBe(false);
  });

  it('People Knowledge Bot cannot access operations team members', () => {
    const peopleBot = getKnowledgeBot('people_knowledge_bot');
    const opsBot = getKnowledgeBot('ops_knowledge_bot');

    // People bot can only recommend for people team
    expect(peopleBot.canRecommendFor('hiring_lead')).toBe(true);
    expect(peopleBot.canRecommendFor('vendor_management_lead')).toBe(false);

    // Ops bot can only recommend for operations team
    expect(opsBot.canRecommendFor('vendor_management_lead')).toBe(true);
    expect(opsBot.canRecommendFor('hiring_lead')).toBe(false);
  });

  it('All five teams have distinct subordinate sets', async () => {
    const peopleTeam = await PeopleTestUtils.getTeam('people');
    const techTeam = await PeopleTestUtils.getTeam('tech');
    const marketingTeam = await PeopleTestUtils.getTeam('marketing');
    const productTeam = await PeopleTestUtils.getTeam('product');
    const operationsTeam = await PeopleTestUtils.getTeam('operations');

    const peopleSubs = new Set(peopleTeam.subordinates);
    const techSubs = new Set(techTeam.subordinates);
    const marketingSubs = new Set(marketingTeam.subordinates);
    const productSubs = new Set(productTeam.subordinates);
    const opsSubs = new Set(operationsTeam.subordinates);

    // No overlap between people and tech
    for (const sub of peopleSubs) {
      expect(techSubs.has(sub)).toBe(false);
    }

    // No overlap between people and marketing
    for (const sub of peopleSubs) {
      expect(marketingSubs.has(sub)).toBe(false);
    }

    // No overlap between people and product
    for (const sub of peopleSubs) {
      expect(productSubs.has(sub)).toBe(false);
    }

    // No overlap between people and operations
    for (const sub of peopleSubs) {
      expect(opsSubs.has(sub)).toBe(false);
    }

    // No overlap between tech and marketing
    for (const sub of techSubs) {
      expect(marketingSubs.has(sub)).toBe(false);
    }

    // No overlap between tech and product
    for (const sub of techSubs) {
      expect(productSubs.has(sub)).toBe(false);
    }

    // No overlap between tech and operations
    for (const sub of techSubs) {
      expect(opsSubs.has(sub)).toBe(false);
    }
  });
});

// ============================================================================
// 10. HELPER FUNCTION TESTS
// ============================================================================

describe('People Team Helper Functions', () => {
  it('getPeopleTeamSubordinates returns non-team-lead configs', () => {
    const subordinates = getPeopleTeamSubordinates();
    expect(subordinates).toHaveLength(2);
    expect(subordinates.every(s => !s.is_team_lead)).toBe(true);
    expect(subordinates.map(s => s.role)).toContain('hiring_lead');
    expect(subordinates.map(s => s.role)).toContain('compliance_lead');
  });

  it('getPeopleTeamLead returns CHRO config', () => {
    const teamLead = getPeopleTeamLead();
    expect(teamLead.role).toBe('chro');
    expect(teamLead.is_team_lead).toBe(true);
  });

  it('getPeopleTeamConfig returns correct config for role', () => {
    const chroConfig = getPeopleTeamConfig('chro');
    expect(chroConfig.role).toBe('chro');

    const hiringConfig = getPeopleTeamConfig('hiring_lead');
    expect(hiringConfig.role).toBe('hiring_lead');

    const complianceConfig = getPeopleTeamConfig('compliance_lead');
    expect(complianceConfig.role).toBe('compliance_lead');

    const kbConfig = getPeopleTeamConfig('people_knowledge_bot');
    expect(kbConfig.role).toBe('people_knowledge_bot');
  });

  it('getPeopleTeamConfig returns null for invalid role', () => {
    const invalidConfig = getPeopleTeamConfig('invalid_role');
    expect(invalidConfig).toBeNull();
  });

  it('PEOPLE_TEAM_CONFIGS array has correct order', () => {
    expect(PEOPLE_TEAM_CONFIGS[0].role).toBe('chro');
    // Subordinates are alphabetically ordered
    expect(PEOPLE_TEAM_CONFIGS.map(c => c.role)).toContain('compliance_lead');
    expect(PEOPLE_TEAM_CONFIGS.map(c => c.role)).toContain('hiring_lead');
  });

  it('PEOPLE_TEAM_BY_ROLE has all team members', () => {
    expect(Object.keys(PEOPLE_TEAM_BY_ROLE)).toHaveLength(4);
    expect(PEOPLE_TEAM_BY_ROLE.chro).toBeDefined();
    expect(PEOPLE_TEAM_BY_ROLE.hiring_lead).toBeDefined();
    expect(PEOPLE_TEAM_BY_ROLE.compliance_lead).toBeDefined();
    expect(PEOPLE_TEAM_BY_ROLE.people_knowledge_bot).toBeDefined();
  });
});

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  PeopleTestUtils,
};
