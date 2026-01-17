/**
 * MONOLITH OS - Task Orchestrator
 * Manages task queue, scheduling, and agent coordination
 * Persists task state to database with file fallback
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import databaseService from '../services/DatabaseService.js';

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

    // Database service
    this.dbService = config.dbService || databaseService;

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
   * Load tasks from database first, then JSON files
   */
  async loadTasks() {
    const tasks = [];

    // Try loading from database first
    if (this.dbService.isAvailable()) {
      console.log('[ORCHESTRATOR] Loading tasks from database...');
      const { data: dbTasks, error } = await this.dbService.getPendingTasks(500);

      if (!error && dbTasks && dbTasks.length > 0) {
        for (const task of dbTasks) {
          tasks.push({
            id: task.external_id || task.id,
            dbId: task.id,
            content: task.title,
            title: task.title,
            description: task.description,
            assigned_role: task.assigned_to,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            blockedBy: task.blocked_by || [],
            workflow_id: task.workflow_id,
            parentTaskId: task.parent_task_id,
            retryCount: task.retry_count || 0,
            priorityScore: task.priority_score || 50,
            metadata: task.metadata || {},
          });
        }
        console.log(`[ORCHESTRATOR] Loaded ${tasks.length} tasks from database`);
        return tasks;
      } else if (error) {
        console.warn('[ORCHESTRATOR] Database load error:', error.message);
      }
    }

    // Fall back to loading from JSON files
    console.log('[ORCHESTRATOR] Loading tasks from JSON files...');
    try {
      const files = fs.readdirSync(this.taskDataPath).filter((f) => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(this.taskDataPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const roleData = JSON.parse(content);

        if (roleData.tasks && Array.isArray(roleData.tasks)) {
          for (const task of roleData.tasks) {
            const enrichedTask = {
              ...task,
              assigned_role: roleData.role_id,
              role_name: roleData.role_name,
              role_abbr: roleData.role_abbr,
            };
            tasks.push(enrichedTask);

            // Persist to database if available
            if (this.dbService.isAvailable()) {
              await this.persistTask(enrichedTask);
            }
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
   * Persist a task to the database
   */
  async persistTask(task) {
    if (!this.dbService.isAvailable()) {
      return { success: false, error: 'Database unavailable' };
    }

    const { data, error } = await this.dbService.createTask({
      external_id: task.id,
      title: task.content || task.title,
      description: task.description,
      assigned_to: task.assigned_role,
      status: task.status || 'pending',
      priority: task.priority || 'MEDIUM',
      financial_amount: task.financial_amount,
      due_date: task.due_date,
      blocked_by: task.blockedBy || task.blocked_by,
      workflow_id: task.workflow_id,
      parent_task_id: task.parentTaskId,
      metadata: task.metadata || {},
      retry_count: task.retryCount || 0,
      priority_score: task.priorityScore || 50,
    });

    if (error) {
      // May be duplicate - try update instead
      if (error.code === '23505') { // Unique violation
        return this.updateTaskInDb(task.id, task);
      }
      console.warn('[ORCHESTRATOR] Task persist error:', error.message);
      return { success: false, error };
    }

    if (data) {
      task.dbId = data.id;
    }

    return { success: true, data };
  }

  /**
   * Update task in database
   */
  async updateTaskInDb(taskId, updates) {
    if (!this.dbService.isAvailable()) {
      return { success: false, error: 'Database unavailable' };
    }

    const { data, error } = await this.dbService.updateTask(taskId, {
      status: updates.status,
      priority: updates.priority,
      priority_score: updates.priorityScore,
      retry_count: updates.retryCount,
      assigned_to: updates.assigned_role,
      metadata: updates.metadata,
    });

    if (error) {
      console.warn('[ORCHESTRATOR] Task update error:', error.message);
    }

    return { success: !error, data, error };
  }

  /**
   * Queue a task for processing
   */
  async queueTask(task) {
    // Calculate priority score
    task.priorityScore = this.calculatePriorityScore(task);

    // Persist to database
    if (!task.dbId && this.dbService.isAvailable()) {
      await this.persistTask(task);
    }

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
  async start() {
    if (this.isRunning) {
      console.log('[ORCHESTRATOR] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[ORCHESTRATOR] Starting task processing...');

    // Load tasks from database on startup
    const tasks = await this.loadTasks();
    for (const task of tasks) {
      if (task.status === 'pending' || task.status === 'in_progress') {
        await this.queueTask(task);
      }
    }

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

    // Update task status in database
    if (this.dbService.isAvailable()) {
      await this.updateTaskInDb(task.dbId || task.id, {
        status: 'in_progress',
      });
    }

    try {
      const result = await agent.processTask(task);

      // Move to completed
      this.inProgress.delete(task.id);
      this.completed.push(result);

      // Update task status in database
      if (this.dbService.isAvailable()) {
        await this.updateTaskInDb(task.dbId || task.id, {
          status: result.escalate ? 'escalated' : 'completed',
          metadata: {
            ...task.metadata,
            result: result,
            completedAt: new Date().toISOString(),
          },
        });
      }

      this.emit('taskCompleted', { task, result });
      console.log(`[ORCHESTRATOR] Task ${task.id} completed by ${agent.roleAbbr}`);

    } catch (error) {
      this.inProgress.delete(task.id);
      console.error(`[ORCHESTRATOR] Task ${task.id} failed:`, error.message);

      // Requeue with lower priority
      task.priorityScore = Math.max(0, task.priorityScore - 20);
      task.retryCount = (task.retryCount || 0) + 1;

      // Update task in database
      if (this.dbService.isAvailable()) {
        await this.updateTaskInDb(task.dbId || task.id, {
          status: task.retryCount >= 3 ? 'failed' : 'pending',
          priority_score: task.priorityScore,
          retry_count: task.retryCount,
          metadata: {
            ...task.metadata,
            lastError: error.message,
            lastAttempt: new Date().toISOString(),
          },
        });
      }

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
  async handleHandoff(handoff) {
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

    await this.queueTask(newTask);
    this.emit('handoffCreated', { original: handoff.task, new: newTask });
  }

  /**
   * Handle escalation to CEO
   */
  async handleEscalation(escalation) {
    console.log(`[ORCHESTRATOR] Escalation from ${escalation.role}: ${escalation.reason}`);

    const escalationEntry = {
      id: `esc-${Date.now()}`,
      task: escalation.task,
      role: escalation.role,
      reason: escalation.reason,
      recommendation: escalation.recommendation,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    this.ceoQueue.push(escalationEntry);

    // Persist escalation to database
    if (this.dbService.isAvailable()) {
      const { data, error } = await this.dbService.createEscalation({
        task_id: escalation.task?.dbId || escalation.task?.id,
        from_role: escalation.role,
        reason: escalation.reason,
        recommendation: escalation.recommendation,
        priority: escalation.task?.priority || 'HIGH',
        context: {
          task: escalation.task,
        },
      });

      if (data) {
        escalationEntry.dbId = data.id;
      }
      if (error) {
        console.warn('[ORCHESTRATOR] Escalation persist error:', error.message);
      }
    }

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
  async getCEOQueue() {
    // Try to get from database first
    if (this.dbService.isAvailable()) {
      const { data, error } = await this.dbService.getPendingEscalations(50);
      if (!error && data) {
        return data;
      }
    }

    // Fall back to in-memory
    return this.ceoQueue.filter((item) => item.status === 'pending');
  }

  /**
   * CEO resolves an escalation
   */
  async resolveEscalation(escalationId, decision) {
    // Update in database
    if (this.dbService.isAvailable()) {
      const { data, error } = await this.dbService.resolveEscalation(
        escalationId,
        decision,
        'CEO'
      );

      if (error) {
        console.warn('[ORCHESTRATOR] Escalation resolve error:', error.message);
      }
    }

    // Update in-memory
    const escalation = this.ceoQueue.find((e) => e.id === escalationId || e.dbId === escalationId);
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
      databaseConnected: this.dbService.isAvailable(),
    };
  }

  /**
   * Get daily summary for CEO digest
   */
  async getDailySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try to get from database
    if (this.dbService.isAvailable()) {
      const { data: dbTasks, error } = await this.dbService.supabase
        .from('tasks')
        .select('*')
        .gte('updated_at', today.toISOString())
        .eq('status', 'completed');

      if (!error && dbTasks) {
        const summary = {
          date: today.toISOString().split('T')[0],
          tasksCompleted: dbTasks.length,
          tasksAutoResolved: 0,
          tasksEscalated: 0,
          pendingCEODecisions: 0,
          byRole: {},
        };

        // Get escalation count
        const { data: escalations } = await this.dbService.getPendingEscalations(100);
        summary.pendingCEODecisions = escalations?.length || 0;

        // Group by role
        for (const task of dbTasks) {
          const role = task.assigned_to;
          if (!summary.byRole[role]) {
            summary.byRole[role] = { completed: 0, escalated: 0 };
          }
          summary.byRole[role].completed++;
        }

        return summary;
      }
    }

    // Fall back to in-memory
    const todayCompleted = this.completed.filter(
      (c) => new Date(c.timestamp) >= today
    );

    const summary = {
      date: today.toISOString().split('T')[0],
      tasksCompleted: todayCompleted.length,
      tasksAutoResolved: todayCompleted.filter((c) => !c.escalate).length,
      tasksEscalated: todayCompleted.filter((c) => c.escalate).length,
      pendingCEODecisions: this.ceoQueue.filter((e) => e.status === 'pending').length,
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

  /**
   * Sync in-memory state to database
   */
  async syncToDatabase() {
    if (!this.dbService.isAvailable()) {
      console.warn('[ORCHESTRATOR] Database not available for sync');
      return { synced: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    // Sync queued tasks
    for (const task of this.taskQueue) {
      if (!task.dbId) {
        const result = await this.persistTask(task);
        if (result.success) {
          synced++;
        } else {
          errors++;
        }
      }
    }

    // Sync completed tasks
    for (const result of this.completed) {
      if (result.task && !result.task.synced) {
        const updateResult = await this.updateTaskInDb(result.task.id, {
          status: 'completed',
          metadata: { result },
        });
        if (updateResult.success) {
          result.task.synced = true;
          synced++;
        } else {
          errors++;
        }
      }
    }

    console.log(`[ORCHESTRATOR] Synced ${synced} items, ${errors} errors`);
    return { synced, errors };
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default TaskOrchestrator;
