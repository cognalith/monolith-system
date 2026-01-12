/**
 * MONOLITH OS - Task Orchestrator
 * Manages task queue, scheduling, and agent coordination
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

// Priority weights for scoring
const PRIORITY_WEIGHTS = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
};

class TaskOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();

    this.agents = new Map(); // roleId -> RoleAgent
    this.taskQueue = []; // Pending tasks
    this.inProgress = new Map(); // taskId -> { agent, startTime }
    this.completed = []; // Completed task results
    this.ceoQueue = []; // Tasks requiring CEO decision

    this.isRunning = false;
    this.processingInterval = config.processingInterval || 5000; // 5 seconds
    this.maxConcurrent = config.maxConcurrent || 5;

    // Load task data
    this.taskDataPath = config.taskDataPath || './dashboard/src/data/tasks';

    console.log('[ORCHESTRATOR] Task Orchestrator initialized');
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent) {
    this.agents.set(agent.roleId, agent);

    // Listen for agent events
    agent.on('handoff', (handoff) => this.handleHandoff(handoff));
    agent.on('escalate', (escalation) => this.handleEscalation(escalation));
    agent.on('error', (error) => this.handleAgentError(error));

    console.log(`[ORCHESTRATOR] Registered agent: ${agent.roleAbbr}`);
  }

  /**
   * Load tasks from JSON files
   */
  async loadTasks() {
    const tasks = [];

    try {
      const files = fs.readdirSync(this.taskDataPath).filter((f) => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(this.taskDataPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const roleData = JSON.parse(content);

        if (roleData.tasks && Array.isArray(roleData.tasks)) {
          for (const task of roleData.tasks) {
            tasks.push({
              ...task,
              assigned_role: roleData.role_id,
              role_name: roleData.role_name,
              role_abbr: roleData.role_abbr,
            });
          }
        }
      }

      console.log(`[ORCHESTRATOR] Loaded ${tasks.length} tasks from ${files.length} role files`);
    } catch (error) {
      console.error('[ORCHESTRATOR] Error loading tasks:', error.message);
    }

    return tasks;
  }

  /**
   * Queue a task for processing
   */
  queueTask(task) {
    // Calculate priority score
    task.priorityScore = this.calculatePriorityScore(task);

    // Add to queue
    this.taskQueue.push(task);

    // Sort by priority score (highest first)
    this.taskQueue.sort((a, b) => b.priorityScore - a.priorityScore);

    this.emit('taskQueued', task);
    console.log(`[ORCHESTRATOR] Queued task: ${task.id} (score: ${task.priorityScore})`);
  }

  /**
   * Calculate priority score for scheduling
   */
  calculatePriorityScore(task) {
    let score = PRIORITY_WEIGHTS[task.priority] || 50;

    // Boost for overdue tasks
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      const now = new Date();
      const daysUntilDue = (dueDate - now) / (1000 * 60 * 60 * 24);

      if (daysUntilDue < 0) {
        score += 50; // Overdue
      } else if (daysUntilDue < 1) {
        score += 30; // Due today
      } else if (daysUntilDue < 3) {
        score += 15; // Due soon
      }
    }

    // Boost for tasks with dependencies waiting
    if (task.blockedBy && task.blockedBy.length === 0) {
      score += 10; // Unblocked
    }

    return score;
  }

  /**
   * Start processing tasks
   */
  start() {
    if (this.isRunning) {
      console.log('[ORCHESTRATOR] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[ORCHESTRATOR] Starting task processing...');

    this.processLoop();
  }

  /**
   * Stop processing tasks
   */
  stop() {
    this.isRunning = false;
    console.log('[ORCHESTRATOR] Stopping task processing...');
  }

  /**
   * Main processing loop
   */
  async processLoop() {
    while (this.isRunning) {
      await this.processTick();
      await this.sleep(this.processingInterval);
    }
  }

  /**
   * Process one tick - assign tasks to available agents
   */
  async processTick() {
    // Check for available agents
    const availableAgents = [];
    for (const [roleId, agent] of this.agents) {
      if (!agent.isActive) {
        availableAgents.push(agent);
      }
    }

    if (availableAgents.length === 0 || this.taskQueue.length === 0) {
      return;
    }

    // Limit concurrent tasks
    if (this.inProgress.size >= this.maxConcurrent) {
      return;
    }

    // Find tasks that match available agents
    for (const agent of availableAgents) {
      if (this.inProgress.size >= this.maxConcurrent) break;

      // Find a task for this agent
      const taskIndex = this.taskQueue.findIndex(
        (task) => task.assigned_role === agent.roleId && this.canProcess(task)
      );

      if (taskIndex >= 0) {
        const task = this.taskQueue.splice(taskIndex, 1)[0];
        await this.assignTask(agent, task);
      }
    }
  }

  /**
   * Check if a task can be processed (dependencies resolved)
   */
  canProcess(task) {
    // Check for blocking tasks
    if (task.blockedBy && task.blockedBy.length > 0) {
      const unresolvedBlocks = task.blockedBy.filter(
        (blockId) => !this.completed.find((c) => c.taskId === blockId)
      );
      if (unresolvedBlocks.length > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Assign a task to an agent
   */
  async assignTask(agent, task) {
    console.log(`[ORCHESTRATOR] Assigning task ${task.id} to ${agent.roleAbbr}`);

    this.inProgress.set(task.id, {
      agent: agent.roleId,
      startTime: Date.now(),
    });

    try {
      const result = await agent.processTask(task);

      // Move to completed
      this.inProgress.delete(task.id);
      this.completed.push(result);

      this.emit('taskCompleted', { task, result });
      console.log(`[ORCHESTRATOR] Task ${task.id} completed by ${agent.roleAbbr}`);

    } catch (error) {
      this.inProgress.delete(task.id);
      console.error(`[ORCHESTRATOR] Task ${task.id} failed:`, error.message);

      // Requeue with lower priority
      task.priorityScore = Math.max(0, task.priorityScore - 20);
      task.retryCount = (task.retryCount || 0) + 1;

      if (task.retryCount < 3) {
        this.taskQueue.push(task);
      } else {
        this.emit('taskFailed', { task, error });
      }
    }
  }

  /**
   * Handle handoff from one agent to another
   */
  handleHandoff(handoff) {
    console.log(`[ORCHESTRATOR] Handoff from ${handoff.fromRole} to ${handoff.toRole}`);

    // Create new task for target role
    const newTask = {
      id: `handoff-${Date.now()}`,
      content: `[Handoff from ${handoff.fromRole.toUpperCase()}] ${handoff.context}`,
      assigned_role: handoff.toRole,
      priority: handoff.task.priority,
      workflow: handoff.task.workflow,
      parentTaskId: handoff.task.id,
      deliverables: handoff.deliverables,
      status: 'pending',
    };

    this.queueTask(newTask);
    this.emit('handoffCreated', { original: handoff.task, new: newTask });
  }

  /**
   * Handle escalation to CEO
   */
  handleEscalation(escalation) {
    console.log(`[ORCHESTRATOR] Escalation from ${escalation.role}: ${escalation.reason}`);

    this.ceoQueue.push({
      id: `esc-${Date.now()}`,
      task: escalation.task,
      role: escalation.role,
      reason: escalation.reason,
      recommendation: escalation.recommendation,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    this.emit('escalation', escalation);
  }

  /**
   * Handle agent error
   */
  handleAgentError(error) {
    console.error(`[ORCHESTRATOR] Agent error from ${error.role}:`, error.error.message);
    this.emit('agentError', error);
  }

  /**
   * Get CEO queue (items needing human decision)
   */
  getCEOQueue() {
    return this.ceoQueue.filter((item) => item.status === 'pending');
  }

  /**
   * CEO resolves an escalation
   */
  resolveEscalation(escalationId, decision) {
    const escalation = this.ceoQueue.find((e) => e.id === escalationId);
    if (escalation) {
      escalation.status = 'resolved';
      escalation.ceoDecision = decision;
      escalation.resolvedAt = new Date().toISOString();

      this.emit('escalationResolved', escalation);
      console.log(`[ORCHESTRATOR] Escalation ${escalationId} resolved by CEO`);
    }
  }

  /**
   * Get orchestrator status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      registeredAgents: this.agents.size,
      queuedTasks: this.taskQueue.length,
      inProgress: this.inProgress.size,
      completed: this.completed.length,
      ceoQueue: this.ceoQueue.filter((e) => e.status === 'pending').length,
      agents: Array.from(this.agents.values()).map((a) => a.getStatus()),
    };
  }

  /**
   * Get daily summary for CEO digest
   */
  async getDailySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCompleted = this.completed.filter(
      (c) => new Date(c.timestamp) >= today
    );

    const summary = {
      date: today.toISOString().split('T')[0],
      tasksCompleted: todayCompleted.length,
      tasksAutoResolved: todayCompleted.filter((c) => !c.escalate).length,
      tasksEscalated: todayCompleted.filter((c) => c.escalate).length,
      pendingCEODecisions: this.getCEOQueue().length,
      byRole: {},
    };

    // Group by role
    for (const result of todayCompleted) {
      if (!summary.byRole[result.role]) {
        summary.byRole[result.role] = { completed: 0, escalated: 0 };
      }
      summary.byRole[result.role].completed++;
      if (result.escalate) {
        summary.byRole[result.role].escalated++;
      }
    }

    return summary;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default TaskOrchestrator;
