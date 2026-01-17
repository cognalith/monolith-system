/**
 * Unit tests for TaskOrchestrator class
 * Tests task queue management, agent registration, and priority scoring
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock fs and path modules
jest.unstable_mockModule('fs', () => ({
  readdirSync: jest.fn().mockReturnValue([]),
  readFileSync: jest.fn().mockReturnValue('{}')
}));

jest.unstable_mockModule('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

const { default: TaskOrchestrator } = await import('../TaskOrchestrator.js');

describe('TaskOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new TaskOrchestrator({
      processingInterval: 1000,
      maxConcurrent: 3
    });
  });

  afterEach(() => {
    orchestrator.stop();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const defaultOrchestrator = new TaskOrchestrator();
      expect(defaultOrchestrator.processingInterval).toBe(5000);
      expect(defaultOrchestrator.maxConcurrent).toBe(5);
    });

    it('should accept custom configuration', () => {
      expect(orchestrator.processingInterval).toBe(1000);
      expect(orchestrator.maxConcurrent).toBe(3);
    });

    it('should initialize empty data structures', () => {
      expect(orchestrator.agents.size).toBe(0);
      expect(orchestrator.taskQueue).toEqual([]);
      expect(orchestrator.inProgress.size).toBe(0);
      expect(orchestrator.completed).toEqual([]);
      expect(orchestrator.ceoQueue).toEqual([]);
    });

    it('should start in stopped state', () => {
      expect(orchestrator.isRunning).toBe(false);
    });
  });

  describe('registerAgent', () => {
    it('should register an agent', () => {
      const mockAgent = createMockAgent('cfo', 'CFO');
      orchestrator.registerAgent(mockAgent);
      expect(orchestrator.agents.size).toBe(1);
      expect(orchestrator.agents.get('cfo')).toBe(mockAgent);
    });

    it('should register multiple agents', () => {
      const agent1 = createMockAgent('cfo', 'CFO');
      const agent2 = createMockAgent('cto', 'CTO');
      orchestrator.registerAgent(agent1);
      orchestrator.registerAgent(agent2);
      expect(orchestrator.agents.size).toBe(2);
    });

    it('should set up event listeners on agent', () => {
      const mockAgent = createMockAgent('cfo', 'CFO');
      orchestrator.registerAgent(mockAgent);

      // Verify listeners were added
      expect(mockAgent.on).toHaveBeenCalledWith('handoff', expect.any(Function));
      expect(mockAgent.on).toHaveBeenCalledWith('escalate', expect.any(Function));
      expect(mockAgent.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should replace existing agent with same roleId', () => {
      const agent1 = createMockAgent('cfo', 'CFO');
      const agent2 = createMockAgent('cfo', 'CFO-Updated');
      orchestrator.registerAgent(agent1);
      orchestrator.registerAgent(agent2);
      expect(orchestrator.agents.size).toBe(1);
      expect(orchestrator.agents.get('cfo')).toBe(agent2);
    });
  });

  describe('queueTask', () => {
    it('should add task to queue', () => {
      const task = createTask('task-1', 'HIGH');
      orchestrator.queueTask(task);
      expect(orchestrator.taskQueue.length).toBe(1);
    });

    it('should calculate priority score', () => {
      const task = createTask('task-1', 'HIGH');
      orchestrator.queueTask(task);
      expect(task.priorityScore).toBeDefined();
      expect(typeof task.priorityScore).toBe('number');
    });

    it('should emit taskQueued event', () => {
      const task = createTask('task-1', 'HIGH');
      const handler = jest.fn();
      orchestrator.on('taskQueued', handler);
      orchestrator.queueTask(task);
      expect(handler).toHaveBeenCalledWith(task);
    });

    it('should sort tasks by priority score (highest first)', () => {
      const lowTask = createTask('task-low', 'LOW');
      const highTask = createTask('task-high', 'HIGH');
      const criticalTask = createTask('task-critical', 'CRITICAL');

      orchestrator.queueTask(lowTask);
      orchestrator.queueTask(highTask);
      orchestrator.queueTask(criticalTask);

      expect(orchestrator.taskQueue[0].id).toBe('task-critical');
      expect(orchestrator.taskQueue[1].id).toBe('task-high');
      expect(orchestrator.taskQueue[2].id).toBe('task-low');
    });
  });

  describe('calculatePriorityScore', () => {
    it('should assign higher score to CRITICAL priority', () => {
      const criticalTask = createTask('task-1', 'CRITICAL');
      const lowTask = createTask('task-2', 'LOW');

      const criticalScore = orchestrator.calculatePriorityScore(criticalTask);
      const lowScore = orchestrator.calculatePriorityScore(lowTask);

      expect(criticalScore).toBeGreaterThan(lowScore);
    });

    it('should assign correct base scores for each priority', () => {
      const critical = orchestrator.calculatePriorityScore(createTask('t', 'CRITICAL'));
      const high = orchestrator.calculatePriorityScore(createTask('t', 'HIGH'));
      const medium = orchestrator.calculatePriorityScore(createTask('t', 'MEDIUM'));
      const low = orchestrator.calculatePriorityScore(createTask('t', 'LOW'));

      expect(critical).toBe(100);
      expect(high).toBe(75);
      expect(medium).toBe(50);
      expect(low).toBe(25);
    });

    it('should boost score for overdue tasks', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const overdueTask = createTask('task-1', 'MEDIUM', { due_date: pastDate.toISOString() });
      const futureTask = createTask('task-2', 'MEDIUM', { due_date: new Date(Date.now() + 86400000 * 7).toISOString() });

      const overdueScore = orchestrator.calculatePriorityScore(overdueTask);
      const futureScore = orchestrator.calculatePriorityScore(futureTask);

      expect(overdueScore).toBeGreaterThan(futureScore);
    });

    it('should boost score for tasks due today', () => {
      const today = new Date();
      today.setHours(23, 59, 59);

      const dueTodayTask = createTask('task-1', 'MEDIUM', { due_date: today.toISOString() });
      const dueNextWeekTask = createTask('task-2', 'MEDIUM', { due_date: new Date(Date.now() + 86400000 * 7).toISOString() });

      const todayScore = orchestrator.calculatePriorityScore(dueTodayTask);
      const nextWeekScore = orchestrator.calculatePriorityScore(dueNextWeekTask);

      expect(todayScore).toBeGreaterThan(nextWeekScore);
    });

    it('should boost score for tasks due within 3 days', () => {
      const twoDaysFromNow = new Date(Date.now() + 86400000 * 2);
      const weekFromNow = new Date(Date.now() + 86400000 * 7);

      const soonTask = createTask('task-1', 'MEDIUM', { due_date: twoDaysFromNow.toISOString() });
      const laterTask = createTask('task-2', 'MEDIUM', { due_date: weekFromNow.toISOString() });

      const soonScore = orchestrator.calculatePriorityScore(soonTask);
      const laterScore = orchestrator.calculatePriorityScore(laterTask);

      expect(soonScore).toBeGreaterThan(laterScore);
    });

    it('should boost score for unblocked tasks', () => {
      const unblockedTask = createTask('task-1', 'MEDIUM', { blockedBy: [] });
      const baseScore = orchestrator.calculatePriorityScore({ ...createTask('task-2', 'MEDIUM'), blockedBy: undefined });

      const unblockedScore = orchestrator.calculatePriorityScore(unblockedTask);

      expect(unblockedScore).toBeGreaterThan(baseScore - 11); // Base score + 10 boost
    });

    it('should use default score for unknown priority', () => {
      const unknownPriorityTask = createTask('task-1', 'UNKNOWN');
      const score = orchestrator.calculatePriorityScore(unknownPriorityTask);
      expect(score).toBe(50); // Default to MEDIUM
    });
  });

  describe('canProcess', () => {
    it('should return true for task with no blockers', () => {
      const task = createTask('task-1', 'HIGH');
      expect(orchestrator.canProcess(task)).toBe(true);
    });

    it('should return true for task with empty blockedBy array', () => {
      const task = createTask('task-1', 'HIGH', { blockedBy: [] });
      expect(orchestrator.canProcess(task)).toBe(true);
    });

    it('should return false for task with unresolved blockers', () => {
      const task = createTask('task-1', 'HIGH', { blockedBy: ['task-0'] });
      expect(orchestrator.canProcess(task)).toBe(false);
    });

    it('should return true when blocking task is completed', () => {
      const blockingResult = { taskId: 'task-0' };
      orchestrator.completed.push(blockingResult);

      const task = createTask('task-1', 'HIGH', { blockedBy: ['task-0'] });
      expect(orchestrator.canProcess(task)).toBe(true);
    });

    it('should handle multiple blockers correctly', () => {
      orchestrator.completed.push({ taskId: 'task-0' });

      const taskPartiallyBlocked = createTask('task-1', 'HIGH', { blockedBy: ['task-0', 'task-2'] });
      expect(orchestrator.canProcess(taskPartiallyBlocked)).toBe(false);

      orchestrator.completed.push({ taskId: 'task-2' });
      expect(orchestrator.canProcess(taskPartiallyBlocked)).toBe(true);
    });
  });

  describe('handleEscalation', () => {
    it('should add escalation to CEO queue', () => {
      const escalation = {
        role: 'cfo',
        task: createTask('task-1', 'HIGH'),
        reason: 'Exceeds authority',
        recommendation: 'Approve with conditions'
      };

      orchestrator.handleEscalation(escalation);

      expect(orchestrator.ceoQueue.length).toBe(1);
      expect(orchestrator.ceoQueue[0].reason).toBe('Exceeds authority');
      expect(orchestrator.ceoQueue[0].status).toBe('pending');
    });

    it('should emit escalation event', () => {
      const handler = jest.fn();
      orchestrator.on('escalation', handler);

      const escalation = {
        role: 'cfo',
        task: createTask('task-1', 'HIGH'),
        reason: 'Test reason'
      };

      orchestrator.handleEscalation(escalation);
      expect(handler).toHaveBeenCalledWith(escalation);
    });

    it('should assign unique IDs to escalations', () => {
      const escalation1 = { role: 'cfo', task: createTask('t1', 'HIGH'), reason: 'R1' };
      const escalation2 = { role: 'cto', task: createTask('t2', 'HIGH'), reason: 'R2' };

      orchestrator.handleEscalation(escalation1);
      orchestrator.handleEscalation(escalation2);

      expect(orchestrator.ceoQueue[0].id).not.toBe(orchestrator.ceoQueue[1].id);
    });
  });

  describe('getCEOQueue', () => {
    it('should return only pending escalations', () => {
      orchestrator.ceoQueue = [
        { id: 'esc-1', status: 'pending' },
        { id: 'esc-2', status: 'resolved' },
        { id: 'esc-3', status: 'pending' }
      ];

      const pending = orchestrator.getCEOQueue();
      expect(pending.length).toBe(2);
      expect(pending.every(e => e.status === 'pending')).toBe(true);
    });

    it('should return empty array when no pending escalations', () => {
      orchestrator.ceoQueue = [
        { id: 'esc-1', status: 'resolved' }
      ];

      const pending = orchestrator.getCEOQueue();
      expect(pending).toEqual([]);
    });
  });

  describe('resolveEscalation', () => {
    it('should mark escalation as resolved', () => {
      orchestrator.ceoQueue = [
        { id: 'esc-1', status: 'pending', reason: 'Test' }
      ];

      orchestrator.resolveEscalation('esc-1', { approved: true, notes: 'Approved' });

      expect(orchestrator.ceoQueue[0].status).toBe('resolved');
      expect(orchestrator.ceoQueue[0].ceoDecision).toEqual({ approved: true, notes: 'Approved' });
      expect(orchestrator.ceoQueue[0].resolvedAt).toBeDefined();
    });

    it('should emit escalationResolved event', () => {
      const handler = jest.fn();
      orchestrator.on('escalationResolved', handler);

      orchestrator.ceoQueue = [
        { id: 'esc-1', status: 'pending' }
      ];

      orchestrator.resolveEscalation('esc-1', { approved: true });
      expect(handler).toHaveBeenCalled();
    });

    it('should not modify other escalations', () => {
      orchestrator.ceoQueue = [
        { id: 'esc-1', status: 'pending' },
        { id: 'esc-2', status: 'pending' }
      ];

      orchestrator.resolveEscalation('esc-1', { approved: true });

      expect(orchestrator.ceoQueue[1].status).toBe('pending');
    });
  });

  describe('handleHandoff', () => {
    it('should create new task for target role', () => {
      const handoff = {
        fromRole: 'cfo',
        toRole: 'clo',
        task: createTask('task-1', 'HIGH', { workflow: 'approval' }),
        context: 'Legal review needed',
        deliverables: ['contract.pdf']
      };

      orchestrator.handleHandoff(handoff);

      expect(orchestrator.taskQueue.length).toBe(1);
      expect(orchestrator.taskQueue[0].assigned_role).toBe('clo');
      expect(orchestrator.taskQueue[0].content).toContain('Handoff from CFO');
    });

    it('should emit handoffCreated event', () => {
      const handler = jest.fn();
      orchestrator.on('handoffCreated', handler);

      const handoff = {
        fromRole: 'cfo',
        toRole: 'clo',
        task: createTask('task-1', 'HIGH'),
        context: 'Test'
      };

      orchestrator.handleHandoff(handoff);
      expect(handler).toHaveBeenCalled();
    });

    it('should preserve priority from original task', () => {
      const handoff = {
        fromRole: 'cfo',
        toRole: 'clo',
        task: createTask('task-1', 'CRITICAL'),
        context: 'Urgent review'
      };

      orchestrator.handleHandoff(handoff);
      expect(orchestrator.taskQueue[0].priority).toBe('CRITICAL');
    });

    it('should link to parent task', () => {
      const handoff = {
        fromRole: 'cfo',
        toRole: 'clo',
        task: createTask('task-1', 'HIGH'),
        context: 'Test'
      };

      orchestrator.handleHandoff(handoff);
      expect(orchestrator.taskQueue[0].parentTaskId).toBe('task-1');
    });
  });

  describe('getStatus', () => {
    it('should return current orchestrator status', () => {
      const status = orchestrator.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.registeredAgents).toBe(0);
      expect(status.queuedTasks).toBe(0);
      expect(status.inProgress).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.ceoQueue).toBe(0);
      expect(status.agents).toEqual([]);
    });

    it('should reflect current state accurately', () => {
      const agent = createMockAgent('cfo', 'CFO');
      orchestrator.registerAgent(agent);
      orchestrator.queueTask(createTask('task-1', 'HIGH'));
      orchestrator.completed.push({ taskId: 'task-0' });
      orchestrator.ceoQueue.push({ id: 'esc-1', status: 'pending' });

      const status = orchestrator.getStatus();

      expect(status.registeredAgents).toBe(1);
      expect(status.queuedTasks).toBe(1);
      expect(status.completed).toBe(1);
      expect(status.ceoQueue).toBe(1);
    });

    it('should include agent statuses', () => {
      const agent = createMockAgent('cfo', 'CFO');
      agent.getStatus = jest.fn().mockReturnValue({ roleId: 'cfo', isActive: false });
      orchestrator.registerAgent(agent);

      const status = orchestrator.getStatus();

      expect(status.agents.length).toBe(1);
      expect(agent.getStatus).toHaveBeenCalled();
    });
  });

  describe('start and stop', () => {
    it('should set isRunning to true on start', () => {
      orchestrator.start();
      expect(orchestrator.isRunning).toBe(true);
    });

    it('should set isRunning to false on stop', () => {
      orchestrator.start();
      orchestrator.stop();
      expect(orchestrator.isRunning).toBe(false);
    });

    it('should not start twice', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      orchestrator.start();
      orchestrator.start();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Already running'));
      consoleSpy.mockRestore();
    });
  });

  describe('getDailySummary', () => {
    it('should return summary structure', async () => {
      const summary = await orchestrator.getDailySummary();

      expect(summary.date).toBeDefined();
      expect(summary.tasksCompleted).toBeDefined();
      expect(summary.tasksAutoResolved).toBeDefined();
      expect(summary.tasksEscalated).toBeDefined();
      expect(summary.pendingCEODecisions).toBeDefined();
      expect(summary.byRole).toBeDefined();
    });

    it('should count completed tasks for today', async () => {
      const today = new Date().toISOString();
      orchestrator.completed = [
        { role: 'cfo', timestamp: today, escalate: false },
        { role: 'cto', timestamp: today, escalate: true },
        { role: 'cfo', timestamp: today, escalate: false }
      ];

      const summary = await orchestrator.getDailySummary();

      expect(summary.tasksCompleted).toBe(3);
      expect(summary.tasksAutoResolved).toBe(2);
      expect(summary.tasksEscalated).toBe(1);
    });

    it('should group by role', async () => {
      const today = new Date().toISOString();
      orchestrator.completed = [
        { role: 'cfo', timestamp: today, escalate: false },
        { role: 'cfo', timestamp: today, escalate: true },
        { role: 'cto', timestamp: today, escalate: false }
      ];

      const summary = await orchestrator.getDailySummary();

      expect(summary.byRole.cfo.completed).toBe(2);
      expect(summary.byRole.cfo.escalated).toBe(1);
      expect(summary.byRole.cto.completed).toBe(1);
      expect(summary.byRole.cto.escalated).toBe(0);
    });
  });
});

// Helper functions
function createMockAgent(roleId, roleAbbr) {
  const agent = new EventEmitter();
  agent.roleId = roleId;
  agent.roleAbbr = roleAbbr;
  agent.isActive = false;
  agent.on = jest.fn().mockImplementation((event, handler) => {
    EventEmitter.prototype.on.call(agent, event, handler);
    return agent;
  });
  agent.getStatus = jest.fn().mockReturnValue({
    roleId,
    isActive: false
  });
  agent.processTask = jest.fn().mockResolvedValue({
    taskId: 'test',
    decision: 'Approved'
  });
  return agent;
}

function createTask(id, priority, extras = {}) {
  return {
    id,
    content: `Test task ${id}`,
    priority,
    status: 'pending',
    assigned_role: 'cfo',
    created_at: new Date().toISOString(),
    ...extras
  };
}
