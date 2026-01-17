/**
 * Unit tests for EscalationEngine class
 * Tests escalation detection, priority calculation, and trigger detection
 */

import { jest } from '@jest/globals';

const { default: EscalationEngine, DEFAULT_THRESHOLDS } = await import('../EscalationEngine.js');

describe('EscalationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new EscalationEngine();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default thresholds', () => {
      expect(engine.thresholds).toBeDefined();
      expect(engine.thresholds.financial).toBeDefined();
      expect(engine.thresholds.riskKeywords).toBeDefined();
      expect(engine.thresholds.strategicKeywords).toBeDefined();
    });

    it('should allow custom thresholds', () => {
      const customEngine = new EscalationEngine({
        thresholds: {
          financial: { singleExpense: 5000 }
        }
      });
      expect(customEngine.thresholds.financial.singleExpense).toBe(5000);
    });

    it('should initialize with empty custom rules', () => {
      expect(engine.customRules).toEqual([]);
    });

    it('should accept custom rules in config', () => {
      const customRule = { condition: () => true, reason: 'Custom' };
      const customEngine = new EscalationEngine({
        customRules: [customRule]
      });
      expect(customEngine.customRules.length).toBe(1);
    });
  });

  describe('shouldEscalate', () => {
    it('should return object with shouldEscalate, reasons, and priority', () => {
      const task = { content: 'Simple task', notes: '' };
      const result = engine.shouldEscalate(task, {}, 'cfo');

      expect(result).toHaveProperty('shouldEscalate');
      expect(result).toHaveProperty('reasons');
      expect(result).toHaveProperty('priority');
      expect(Array.isArray(result.reasons)).toBe(true);
    });

    it('should not escalate simple tasks', () => {
      const task = { content: 'Review the monthly report' };
      const result = engine.shouldEscalate(task, {}, 'cfo');

      expect(result.shouldEscalate).toBe(false);
      expect(result.reasons.length).toBe(0);
    });

    it('should escalate tasks with explicit CEO markers', () => {
      const task = { content: 'This requires CEO approval before proceeding' };
      const result = engine.shouldEscalate(task, {}, 'cfo');

      expect(result.shouldEscalate).toBe(true);
      expect(result.reasons).toContain('Task explicitly marked for CEO approval');
    });

    it('should aggregate multiple reasons', () => {
      const task = {
        content: 'CEO approval needed for $50,000 legal liability matter'
      };
      const result = engine.shouldEscalate(task, {}, 'cfo');

      expect(result.shouldEscalate).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(1);
    });
  });

  describe('hasExplicitEscalation', () => {
    it('should detect "ceo approval" marker', () => {
      const task = { content: 'Need CEO approval for this' };
      expect(engine.hasExplicitEscalation(task)).toBe(true);
    });

    it('should detect "ceo decision" marker', () => {
      const task = { content: 'This needs a CEO decision' };
      expect(engine.hasExplicitEscalation(task)).toBe(true);
    });

    it('should detect "requires ceo" marker', () => {
      const task = { content: 'This item requires CEO review' };
      expect(engine.hasExplicitEscalation(task)).toBe(true);
    });

    it('should detect "escalate to ceo" marker', () => {
      const task = { content: 'Please escalate to CEO' };
      expect(engine.hasExplicitEscalation(task)).toBe(true);
    });

    it('should detect "executive decision" marker', () => {
      const task = { content: 'Needs an executive decision' };
      expect(engine.hasExplicitEscalation(task)).toBe(true);
    });

    it('should detect "board approval" marker', () => {
      const task = { content: 'Requires board approval' };
      expect(engine.hasExplicitEscalation(task)).toBe(true);
    });

    it('should check notes as well as content', () => {
      const task = { content: 'Regular task', notes: 'CEO approval required' };
      expect(engine.hasExplicitEscalation(task)).toBe(true);
    });

    it('should be case insensitive', () => {
      const task = { content: 'REQUIRES CEO APPROVAL' };
      expect(engine.hasExplicitEscalation(task)).toBe(true);
    });

    it('should return false for tasks without markers', () => {
      const task = { content: 'Regular task without escalation needs' };
      expect(engine.hasExplicitEscalation(task)).toBe(false);
    });
  });

  describe('checkFinancialThresholds', () => {
    it('should detect amounts exceeding single expense threshold', () => {
      const task = { content: 'Purchase equipment for $15,000' };
      const result = engine.checkFinancialThresholds(task, {}, 'cfo');

      expect(result).not.toBeNull();
      expect(result).toContain('$15,000');
    });

    it('should detect dollar amounts with various formats', () => {
      const formats = [
        '$15000',
        '$15,000',
        '$15,000.00',
        '15000 dollars',
        '15,000 USD'
      ];

      for (const format of formats) {
        const task = { content: `Expense of ${format}` };
        const result = engine.checkFinancialThresholds(task, {}, 'manager');
        expect(result).not.toBeNull();
      }
    });

    it('should not escalate amounts below threshold', () => {
      const task = { content: 'Purchase supplies for $500' };
      const result = engine.checkFinancialThresholds(task, {}, 'manager');

      expect(result).toBeNull();
    });

    it('should use role-specific thresholds when available', () => {
      const task = { content: 'Approve $20,000 expense' };

      // CFO has $25,000 threshold
      const cfoResult = engine.checkFinancialThresholds(task, {}, 'cfo');
      expect(cfoResult).toBeNull(); // 20k < 25k

      const task2 = { content: 'Approve $30,000 expense' };
      const cfoResult2 = engine.checkFinancialThresholds(task2, {}, 'cfo');
      expect(cfoResult2).not.toBeNull(); // 30k > 25k
    });

    it('should check result action for amounts', () => {
      const task = { content: 'Process the request' };
      const result = { action: 'Approved expense of $15,000' };
      const escalationResult = engine.checkFinancialThresholds(task, result, 'manager');

      expect(escalationResult).not.toBeNull();
    });

    it('should detect contract amounts', () => {
      const task = { content: 'Sign contract valued at $60,000' };
      const result = engine.checkFinancialThresholds(task, {}, 'cfo');

      expect(result).not.toBeNull();
      expect(result).toContain('Contract value');
    });
  });

  describe('checkRiskKeywords', () => {
    it('should detect "legal liability" keyword', () => {
      const task = { content: 'Potential legal liability issue' };
      const result = engine.checkRiskKeywords(task, {});

      expect(result).not.toBeNull();
      expect(result).toContain('legal liability');
    });

    it('should detect "compliance violation" keyword', () => {
      const task = { content: 'Possible compliance violation detected' };
      const result = engine.checkRiskKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should detect "security incident" keyword', () => {
      const task = { content: 'Security incident reported' };
      const result = engine.checkRiskKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should detect "data breach" keyword', () => {
      const task = { content: 'Suspected data breach in progress' };
      const result = engine.checkRiskKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should detect "lawsuit" keyword', () => {
      const task = { content: 'Facing potential lawsuit from vendor' };
      const result = engine.checkRiskKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should check task notes', () => {
      const task = { content: 'Review document', notes: 'Related to lawsuit' };
      const result = engine.checkRiskKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should check result analysis', () => {
      const task = { content: 'Check status' };
      const analysisResult = { analysis: 'Found regulatory concerns' };
      const result = engine.checkRiskKeywords(task, analysisResult);

      expect(result).not.toBeNull();
    });

    it('should check result decision', () => {
      const task = { content: 'Review' };
      const decisionResult = { decision: 'Identified data breach risk' };
      const result = engine.checkRiskKeywords(task, decisionResult);

      expect(result).not.toBeNull();
    });

    it('should return null for tasks without risk keywords', () => {
      const task = { content: 'Regular task without risk' };
      const result = engine.checkRiskKeywords(task, {});

      expect(result).toBeNull();
    });
  });

  describe('checkStrategicKeywords', () => {
    it('should detect "strategic direction" keyword', () => {
      const task = { content: 'Change in strategic direction needed' };
      const result = engine.checkStrategicKeywords(task, {});

      expect(result).not.toBeNull();
      expect(result).toContain('Strategic decision required');
    });

    it('should detect "company policy" keyword', () => {
      const task = { content: 'Update company policy on remote work' };
      const result = engine.checkStrategicKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should detect "organizational change" keyword', () => {
      const task = { content: 'Proposed organizational change' };
      const result = engine.checkStrategicKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should detect "new market" keyword', () => {
      const task = { content: 'Enter new market in Asia' };
      const result = engine.checkStrategicKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should detect "product pivot" keyword', () => {
      const task = { content: 'Consider product pivot to SaaS model' };
      const result = engine.checkStrategicKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should detect "partnership" keyword', () => {
      const task = { content: 'New partnership opportunity' };
      const result = engine.checkStrategicKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should detect "investment" keyword', () => {
      const task = { content: 'Investment decision for Q2' };
      const result = engine.checkStrategicKeywords(task, {});

      expect(result).not.toBeNull();
    });

    it('should return null for non-strategic tasks', () => {
      const task = { content: 'Update spreadsheet' };
      const result = engine.checkStrategicKeywords(task, {});

      expect(result).toBeNull();
    });
  });

  describe('checkRoleSpecificRules', () => {
    it('should escalate CFO for major investment', () => {
      const task = { content: 'Review major investment opportunity' };
      const result = engine.checkRoleSpecificRules(task, {}, 'cfo');

      expect(result).not.toBeNull();
      expect(result).toContain('CFO');
    });

    it('should escalate CFO for audit findings', () => {
      const task = { content: 'Respond to audit finding' };
      const result = engine.checkRoleSpecificRules(task, {}, 'cfo');

      expect(result).not.toBeNull();
    });

    it('should escalate CTO for architecture changes', () => {
      const task = { content: 'Propose architecture change' };
      const result = engine.checkRoleSpecificRules(task, {}, 'cto');

      expect(result).not.toBeNull();
    });

    it('should escalate CTO for vendor switches', () => {
      const task = { content: 'Evaluate vendor switch options' };
      const result = engine.checkRoleSpecificRules(task, {}, 'cto');

      expect(result).not.toBeNull();
    });

    it('should escalate CLO for contract signatures', () => {
      const task = { content: 'Review contract signature requirements' };
      const result = engine.checkRoleSpecificRules(task, {}, 'clo');

      expect(result).not.toBeNull();
    });

    it('should escalate CHRO for executive hiring', () => {
      const task = { content: 'Executive hiring process for VP' };
      const result = engine.checkRoleSpecificRules(task, {}, 'chro');

      expect(result).not.toBeNull();
    });

    it('should escalate CHRO for termination', () => {
      const task = { content: 'Process termination request' };
      const result = engine.checkRoleSpecificRules(task, {}, 'chro');

      expect(result).not.toBeNull();
    });

    it('should escalate CISO for security breaches', () => {
      const task = { content: 'Investigate security breach' };
      const result = engine.checkRoleSpecificRules(task, {}, 'ciso');

      expect(result).not.toBeNull();
    });

    it('should return null for unknown roles', () => {
      const task = { content: 'Task content' };
      const result = engine.checkRoleSpecificRules(task, {}, 'unknown');

      expect(result).toBeNull();
    });

    it('should check action in result', () => {
      const task = { content: 'Review request' };
      const actionResult = { action: 'Decided on architecture change' };
      const result = engine.checkRoleSpecificRules(task, actionResult, 'cto');

      expect(result).not.toBeNull();
    });
  });

  describe('checkCustomRules', () => {
    it('should execute custom rule conditions', () => {
      const customRule = {
        condition: jest.fn().mockReturnValue(true),
        reason: 'Custom escalation'
      };
      engine.customRules = [customRule];

      const task = { content: 'Test' };
      const result = engine.checkCustomRules(task, {}, 'cfo');

      expect(customRule.condition).toHaveBeenCalledWith(task, {}, 'cfo');
      expect(result).toBe('Custom escalation');
    });

    it('should return null when no rules match', () => {
      const customRule = {
        condition: jest.fn().mockReturnValue(false),
        reason: 'Custom'
      };
      engine.customRules = [customRule];

      const result = engine.checkCustomRules({}, {}, 'cfo');
      expect(result).toBeNull();
    });

    it('should use default reason when not provided', () => {
      const customRule = {
        condition: () => true
      };
      engine.customRules = [customRule];

      const result = engine.checkCustomRules({}, {}, 'cfo');
      expect(result).toBe('Custom escalation rule triggered');
    });

    it('should check multiple rules in order', () => {
      const rule1 = { condition: () => false, reason: 'Rule 1' };
      const rule2 = { condition: () => true, reason: 'Rule 2' };
      engine.customRules = [rule1, rule2];

      const result = engine.checkCustomRules({}, {}, 'cfo');
      expect(result).toBe('Rule 2');
    });
  });

  describe('calculateEscalationPriority', () => {
    it('should return MEDIUM as default', () => {
      const reasons = ['Some reason'];
      const task = { priority: 'LOW' };
      const priority = engine.calculateEscalationPriority(reasons, task);

      expect(priority).toBe('MEDIUM');
    });

    it('should return CRITICAL for security-related reasons', () => {
      const reasons = ['Security breach detected'];
      const task = { priority: 'LOW' };
      const priority = engine.calculateEscalationPriority(reasons, task);

      expect(priority).toBe('CRITICAL');
    });

    it('should return CRITICAL for breach-related reasons', () => {
      const reasons = ['Data breach risk identified'];
      const task = { priority: 'LOW' };
      const priority = engine.calculateEscalationPriority(reasons, task);

      expect(priority).toBe('CRITICAL');
    });

    it('should return CRITICAL for legal-related reasons', () => {
      const reasons = ['Legal liability detected'];
      const task = { priority: 'LOW' };
      const priority = engine.calculateEscalationPriority(reasons, task);

      expect(priority).toBe('CRITICAL');
    });

    it('should return CRITICAL for compliance-related reasons', () => {
      const reasons = ['Compliance violation found'];
      const task = { priority: 'LOW' };
      const priority = engine.calculateEscalationPriority(reasons, task);

      expect(priority).toBe('CRITICAL');
    });

    it('should inherit CRITICAL from task priority', () => {
      const reasons = ['Regular reason'];
      const task = { priority: 'CRITICAL' };
      const priority = engine.calculateEscalationPriority(reasons, task);

      expect(priority).toBe('CRITICAL');
    });

    it('should inherit HIGH from task priority when escalation is MEDIUM', () => {
      const reasons = ['Regular reason'];
      const task = { priority: 'HIGH' };
      const priority = engine.calculateEscalationPriority(reasons, task);

      expect(priority).toBe('HIGH');
    });

    it('should not downgrade CRITICAL to HIGH', () => {
      const reasons = ['Security issue'];
      const task = { priority: 'HIGH' };
      const priority = engine.calculateEscalationPriority(reasons, task);

      expect(priority).toBe('CRITICAL');
    });
  });

  describe('addRule', () => {
    it('should add custom rule to the list', () => {
      const rule = { condition: () => true, reason: 'Test' };
      engine.addRule(rule);

      expect(engine.customRules.length).toBe(1);
      expect(engine.customRules[0]).toBe(rule);
    });

    it('should allow adding multiple rules', () => {
      engine.addRule({ condition: () => true, reason: 'Rule 1' });
      engine.addRule({ condition: () => true, reason: 'Rule 2' });

      expect(engine.customRules.length).toBe(2);
    });
  });

  describe('updateThresholds', () => {
    it('should update financial thresholds', () => {
      engine.updateThresholds({
        financial: { singleExpense: 5000 }
      });

      expect(engine.thresholds.financial.singleExpense).toBe(5000);
    });

    it('should preserve existing thresholds not being updated', () => {
      const originalContract = engine.thresholds.financial.contractValue;
      engine.updateThresholds({
        financial: { singleExpense: 5000 }
      });

      expect(engine.thresholds.financial.contractValue).toBe(originalContract);
    });

    it('should update role-specific rules', () => {
      engine.updateThresholds({
        roleSpecificRules: {
          cfo: { escalateAbove: 50000 }
        }
      });

      expect(engine.thresholds.roleSpecificRules.cfo.escalateAbove).toBe(50000);
    });

    it('should merge with existing thresholds', () => {
      const originalKeywords = engine.thresholds.riskKeywords;
      engine.updateThresholds({ financial: { singleExpense: 20000 } });

      expect(engine.thresholds.riskKeywords).toEqual(originalKeywords);
    });
  });

  describe('getThresholds', () => {
    it('should return current thresholds', () => {
      const thresholds = engine.getThresholds();

      expect(thresholds).toBe(engine.thresholds);
      expect(thresholds.financial).toBeDefined();
      expect(thresholds.riskKeywords).toBeDefined();
    });
  });

  describe('DEFAULT_THRESHOLDS export', () => {
    it('should export DEFAULT_THRESHOLDS', () => {
      expect(DEFAULT_THRESHOLDS).toBeDefined();
      expect(DEFAULT_THRESHOLDS.financial).toBeDefined();
      expect(DEFAULT_THRESHOLDS.financial.singleExpense).toBe(10000);
    });

    it('should have expected role-specific rules', () => {
      expect(DEFAULT_THRESHOLDS.roleSpecificRules.cfo).toBeDefined();
      expect(DEFAULT_THRESHOLDS.roleSpecificRules.cto).toBeDefined();
      expect(DEFAULT_THRESHOLDS.roleSpecificRules.clo).toBeDefined();
      expect(DEFAULT_THRESHOLDS.roleSpecificRules.chro).toBeDefined();
      expect(DEFAULT_THRESHOLDS.roleSpecificRules.ciso).toBeDefined();
    });
  });
});
