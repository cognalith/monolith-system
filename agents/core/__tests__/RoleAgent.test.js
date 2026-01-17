/**
 * Unit tests for RoleAgent class
 * Tests core agent functionality including constructor, classification, and capabilities
 */

import { jest } from '@jest/globals';

// Mock dependencies before importing RoleAgent
jest.unstable_mockModule('../LLMRouter.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    complete: jest.fn().mockResolvedValue({
      content: 'ANALYSIS: Test analysis\nACTION: Test action\nDECISION: Test decision\nHANDOFF: None\nESCALATE: NO',
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 500
    })
  }))
}));

jest.unstable_mockModule('../DecisionLogger.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue({ success: true })
  }))
}));

const { default: RoleAgent } = await import('../RoleAgent.js');

describe('RoleAgent', () => {
  let agent;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      roleId: 'cfo',
      roleName: 'Chief Financial Officer',
      roleAbbr: 'CFO',
      tier: 2,
      responsibilities: ['Financial planning', 'Budget management', 'Risk assessment'],
      authorityLimits: { maxApprovalAmount: 25000 },
      reportsTo: 'ceo',
      directReports: ['accountant', 'treasurer']
    };
    agent = new RoleAgent(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config values', () => {
      expect(agent.roleId).toBe('cfo');
      expect(agent.roleName).toBe('Chief Financial Officer');
      expect(agent.roleAbbr).toBe('CFO');
      expect(agent.tier).toBe(2);
    });

    it('should set default values for optional config', () => {
      const minimalAgent = new RoleAgent({
        roleId: 'test',
        roleName: 'Test Role',
        roleAbbr: 'TST',
        tier: 3
      });
      expect(minimalAgent.responsibilities).toEqual([]);
      expect(minimalAgent.authorityLimits).toEqual({});
      expect(minimalAgent.reportsTo).toBe('ceo');
      expect(minimalAgent.directReports).toEqual([]);
    });

    it('should initialize with inactive state', () => {
      expect(agent.isActive).toBe(false);
      expect(agent.currentTask).toBeNull();
      expect(agent.taskHistory).toEqual([]);
    });

    it('should set responsibilities from config', () => {
      expect(agent.responsibilities).toEqual([
        'Financial planning',
        'Budget management',
        'Risk assessment'
      ]);
    });

    it('should set authority limits from config', () => {
      expect(agent.authorityLimits).toEqual({ maxApprovalAmount: 25000 });
    });

    it('should set reporting structure from config', () => {
      expect(agent.reportsTo).toBe('ceo');
      expect(agent.directReports).toEqual(['accountant', 'treasurer']);
    });

    it('should build system prompt', () => {
      expect(agent.systemPrompt).toContain('Chief Financial Officer');
      expect(agent.systemPrompt).toContain('CFO');
      expect(agent.systemPrompt).toContain('Financial planning');
    });
  });

  describe('classifyTask', () => {
    it('should classify document drafting tasks', () => {
      const task = { content: 'Draft a quarterly financial report' };
      expect(agent.classifyTask(task)).toBe('document_draft');
    });

    it('should classify writing tasks', () => {
      const task = { content: 'Write the budget proposal for Q4' };
      expect(agent.classifyTask(task)).toBe('document_draft');
    });

    it('should classify analysis tasks', () => {
      const task = { content: 'Analyze the Q3 revenue trends' };
      expect(agent.classifyTask(task)).toBe('analysis');
    });

    it('should classify review tasks as analysis', () => {
      const task = { content: 'Review the expense report' };
      expect(agent.classifyTask(task)).toBe('analysis');
    });

    it('should classify strategic decision tasks', () => {
      const task = { content: 'Decide on the investment allocation' };
      expect(agent.classifyTask(task)).toBe('strategic_decision');
    });

    it('should classify approval tasks as strategic', () => {
      const task = { content: 'Approve the vendor contract' };
      expect(agent.classifyTask(task)).toBe('strategic_decision');
    });

    it('should classify code-related tasks', () => {
      const task = { content: 'Review the code for the new API' };
      expect(agent.classifyTask(task)).toBe('code_review');
    });

    it('should classify technical tasks', () => {
      const task = { content: 'Evaluate the technical architecture' };
      expect(agent.classifyTask(task)).toBe('code_review');
    });

    it('should classify summarization tasks', () => {
      const task = { content: 'Summarize the meeting notes' };
      expect(agent.classifyTask(task)).toBe('summarization');
    });

    it('should classify brief requests as summarization', () => {
      const task = { content: 'Provide a brief on market conditions' };
      expect(agent.classifyTask(task)).toBe('summarization');
    });

    it('should return general for unclassified tasks', () => {
      const task = { content: 'Handle the incoming request' };
      expect(agent.classifyTask(task)).toBe('general');
    });

    it('should be case insensitive', () => {
      const task = { content: 'ANALYZE THE DATA' };
      expect(agent.classifyTask(task)).toBe('analysis');
    });
  });

  describe('isWithinAuthority', () => {
    it('should return true for amounts within limit', () => {
      expect(agent.isWithinAuthority('approve', 10000)).toBe(true);
    });

    it('should return true for amounts at exact limit', () => {
      expect(agent.isWithinAuthority('approve', 25000)).toBe(true);
    });

    it('should return false for amounts exceeding limit', () => {
      expect(agent.isWithinAuthority('approve', 30000)).toBe(false);
    });

    it('should return true when no limit is set', () => {
      const agentNoLimits = new RoleAgent({
        roleId: 'test',
        roleName: 'Test',
        roleAbbr: 'TST',
        tier: 3
      });
      expect(agentNoLimits.isWithinAuthority('approve', 1000000)).toBe(true);
    });

    it('should return true when amount is zero', () => {
      expect(agent.isWithinAuthority('approve', 0)).toBe(true);
    });
  });

  describe('capabilities', () => {
    it('should return empty array when no services configured', () => {
      expect(agent.capabilities).toEqual([]);
    });

    it('should include email capabilities when gmailService is configured', () => {
      const agentWithGmail = new RoleAgent({
        ...mockConfig,
        gmailService: { sendEmail: jest.fn() }
      });
      expect(agentWithGmail.capabilities).toContain('email:send');
      expect(agentWithGmail.capabilities).toContain('email:search');
      expect(agentWithGmail.capabilities).toContain('email:read');
    });

    it('should include browser capabilities when browserService is configured', () => {
      const agentWithBrowser = new RoleAgent({
        ...mockConfig,
        browserService: { navigate: jest.fn() }
      });
      expect(agentWithBrowser.capabilities).toContain('browser:navigate');
      expect(agentWithBrowser.capabilities).toContain('browser:screenshot');
      expect(agentWithBrowser.capabilities).toContain('browser:content');
      expect(agentWithBrowser.capabilities).toContain('browser:form');
    });

    it('should include all capabilities when both services are configured', () => {
      const agentWithBoth = new RoleAgent({
        ...mockConfig,
        gmailService: { sendEmail: jest.fn() },
        browserService: { navigate: jest.fn() }
      });
      expect(agentWithBoth.capabilities).toHaveLength(7);
    });
  });

  describe('hasCapability', () => {
    it('should return false for capabilities not available', () => {
      expect(agent.hasCapability('email:send')).toBe(false);
    });

    it('should return true for available capabilities', () => {
      const agentWithGmail = new RoleAgent({
        ...mockConfig,
        gmailService: { sendEmail: jest.fn() }
      });
      expect(agentWithGmail.hasCapability('email:send')).toBe(true);
    });
  });

  describe('canHandle', () => {
    it('should return true when task is assigned to this role', () => {
      const task = { assigned_role: 'cfo' };
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should return false when task is assigned to different role', () => {
      const task = { assigned_role: 'cto' };
      expect(agent.canHandle(task)).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return current agent status', () => {
      const status = agent.getStatus();
      expect(status.roleId).toBe('cfo');
      expect(status.roleName).toBe('Chief Financial Officer');
      expect(status.isActive).toBe(false);
      expect(status.currentTask).toBeNull();
      expect(status.tasksCompleted).toBe(0);
      expect(status.lastActive).toBeNull();
      expect(status.capabilities).toEqual([]);
    });

    it('should reflect task history count', () => {
      agent.taskHistory = [{ taskId: '1' }, { taskId: '2' }];
      const status = agent.getStatus();
      expect(status.tasksCompleted).toBe(2);
    });

    it('should include last active timestamp from task history', () => {
      const timestamp = '2025-01-14T12:00:00.000Z';
      agent.taskHistory = [{ taskId: '1', completedAt: timestamp }];
      const status = agent.getStatus();
      expect(status.lastActive).toBe(timestamp);
    });
  });

  describe('selectModelForTask', () => {
    it('should select claude-opus-4 for strategic decisions', () => {
      const model = agent.selectModelForTask('strategic_decision');
      expect(model).toBe('claude-opus-4');
    });

    it('should select claude-sonnet-4 for document drafts', () => {
      const model = agent.selectModelForTask('document_draft');
      expect(model).toBe('claude-sonnet-4');
    });

    it('should select claude-sonnet-4 for analysis', () => {
      const model = agent.selectModelForTask('analysis');
      expect(model).toBe('claude-sonnet-4');
    });

    it('should select claude-haiku for summarization', () => {
      const model = agent.selectModelForTask('summarization');
      expect(model).toBe('claude-haiku');
    });

    it('should select claude-sonnet-4 for unknown task types', () => {
      const model = agent.selectModelForTask('unknown_type');
      expect(model).toBe('claude-sonnet-4');
    });
  });

  describe('buildTaskPrompt', () => {
    it('should include task details in prompt', () => {
      const task = {
        id: 'task-123',
        priority: 'HIGH',
        workflow: 'budget-approval',
        due_date: '2025-01-15',
        status: 'pending',
        content: 'Review the budget proposal'
      };
      const prompt = agent.buildTaskPrompt(task);
      expect(prompt).toContain('task-123');
      expect(prompt).toContain('HIGH');
      expect(prompt).toContain('budget-approval');
      expect(prompt).toContain('2025-01-15');
      expect(prompt).toContain('Review the budget proposal');
    });

    it('should handle missing optional fields', () => {
      const task = {
        id: 'task-456',
        priority: 'LOW',
        status: 'pending',
        content: 'Simple task'
      };
      const prompt = agent.buildTaskPrompt(task);
      expect(prompt).toContain('task-456');
      expect(prompt).toContain('N/A');
      expect(prompt).toContain('Not specified');
    });

    it('should include notes when provided', () => {
      const task = {
        id: 'task-789',
        priority: 'MEDIUM',
        status: 'pending',
        content: 'Task with notes',
        notes: 'Important additional context'
      };
      const prompt = agent.buildTaskPrompt(task);
      expect(prompt).toContain('Important additional context');
    });
  });

  describe('parseResponse', () => {
    it('should parse structured response correctly', () => {
      const content = `ANALYSIS: The task requires financial review
ACTION: Reviewed all documents
DECISION: Approved the expense
HANDOFF: None
ESCALATE: NO`;
      const task = { id: 'task-123' };
      const result = agent.parseResponse(content, task);

      expect(result.analysis).toBe('The task requires financial review');
      expect(result.action).toBe('Reviewed all documents');
      expect(result.decision).toBe('Approved the expense');
      expect(result.escalate).toBe(false);
      expect(result.handoff).toBeNull();
    });

    it('should detect escalation requests', () => {
      const content = `ANALYSIS: Major decision required
ACTION: Prepared analysis
DECISION: Recommend approval
HANDOFF: None
ESCALATE: YES - Exceeds authority threshold`;
      const task = { id: 'task-123' };
      const result = agent.parseResponse(content, task);

      expect(result.escalate).toBe(true);
      expect(result.escalateReason).toContain('Exceeds authority threshold');
    });

    it('should parse handoff requests', () => {
      const content = `ANALYSIS: Legal review needed
ACTION: Prepared documents
DECISION: Pending legal review
HANDOFF: Forward to CLO for contract review
ESCALATE: NO`;
      const task = { id: 'task-123' };
      const result = agent.parseResponse(content, task);

      expect(result.handoff).not.toBeNull();
      expect(result.handoff.targetRole).toBe('clo');
    });

    it('should include metadata in result', () => {
      const content = 'ANALYSIS: Test\nACTION: Test\nDECISION: Test';
      const task = { id: 'task-123' };
      const result = agent.parseResponse(content, task);

      expect(result.taskId).toBe('task-123');
      expect(result.role).toBe('cfo');
      expect(result.timestamp).toBeDefined();
      expect(result.rawContent).toBe(content);
    });
  });

  describe('service method guards', () => {
    it('should throw error when sendEmail is called without gmailService', async () => {
      await expect(agent.sendEmail('test@example.com', 'Subject', 'Body'))
        .rejects.toThrow('Email capability not available');
    });

    it('should throw error when searchEmails is called without gmailService', async () => {
      await expect(agent.searchEmails('query'))
        .rejects.toThrow('Email capability not available');
    });

    it('should throw error when readEmail is called without gmailService', async () => {
      await expect(agent.readEmail('msg-id'))
        .rejects.toThrow('Email capability not available');
    });

    it('should throw error when browseUrl is called without browserService', async () => {
      await expect(agent.browseUrl('https://example.com'))
        .rejects.toThrow('Browser capability not available');
    });

    it('should throw error when takeScreenshot is called without browserService', async () => {
      await expect(agent.takeScreenshot('/tmp/screenshot.png'))
        .rejects.toThrow('Browser capability not available');
    });

    it('should throw error when getWebContent is called without browserService', async () => {
      await expect(agent.getWebContent('https://example.com'))
        .rejects.toThrow('Browser capability not available');
    });

    it('should throw error when fillWebForm is called without browserService', async () => {
      await expect(agent.fillWebForm('https://example.com', {}))
        .rejects.toThrow('Browser capability not available');
    });
  });
});
