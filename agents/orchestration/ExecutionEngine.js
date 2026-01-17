/**
 * EXECUTION ENGINE - Phase 7 Task Orchestration
 * Cognalith Inc. | Monolith System
 *
 * Manages task execution lifecycle for AI agents:
 * - Execution loop for continuous task processing
 * - Task state management (queued, active, blocked, completed, failed)
 * - Blocker detection and handling (agent dependencies, decisions, auth, payment)
 * - Error handling with retry logic
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

// Constants
const POLL_INTERVAL = 5000; // 5 seconds between execution loop iterations
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_BASE = 1000; // Base delay for exponential backoff

// Task states
const TASK_STATES = {
  QUEUED: 'queued',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BLOCKED_AGENT: 'blocked_agent',
  BLOCKED_DECISION: 'blocked_decision',
  BLOCKED_AUTH: 'blocked_auth',
  BLOCKED_PAYMENT: 'blocked_payment',
};

// Blocker types
const BLOCKER_TYPES = {
  AGENT: 'agent',
  DECISION: 'decision',
  AUTH: 'auth',
  PAYMENT: 'payment',
};

// Table name
const TASK_QUEUE_TABLE = 'monolith_task_queue';

/**
 * Execution Engine
 * Manages agent task execution with blocker detection and state management
 */
class ExecutionEngine extends EventEmitter {
  constructor(config = {}) {
    super();

    this.supabase = null;
    this.isConnected = false;
    this.config = config;

    // Execution state
    this.runningLoops = new Map(); // agentRole -> { running: boolean, intervalId: number }
    this.agentExecutors = new Map(); // agentRole -> executor function

    // Initialize database connection
    this.initialize();
  }

  /**
   * Initialize Supabase connection
   */
  initialize() {
    const supabaseUrl = this.config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = this.config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: true, persistSession: false },
      });
      this.isConnected = true;
      console.log('[EXECUTION-ENGINE] Connected to Supabase');
    } else {
      console.warn('[EXECUTION-ENGINE] No Supabase credentials found');
    }
  }

  /**
   * Check if database is available
   */
  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  /**
   * Register an executor function for an agent role
   * @param {string} agentRole - The agent role
   * @param {Function} executor - Async function that executes tasks: (task) => Promise<result>
   */
  registerExecutor(agentRole, executor) {
    this.agentExecutors.set(agentRole, executor);
    console.log(`[EXECUTION-ENGINE] Registered executor for ${agentRole}`);
  }

  // ============================================================================
  // EXECUTION LOOP
  // ============================================================================

  /**
   * Start the execution loop for an agent
   * @param {string} agentRole - The agent role to start processing
   * @returns {Promise<void>}
   */
  async startExecutionLoop(agentRole) {
    if (!this.isAvailable()) {
      console.error(`[EXECUTION-ENGINE] Cannot start loop for ${agentRole}: Database unavailable`);
      return;
    }

    // Check if already running
    const existingLoop = this.runningLoops.get(agentRole);
    if (existingLoop?.running) {
      console.warn(`[EXECUTION-ENGINE] Loop already running for ${agentRole}`);
      return;
    }

    console.log(`[EXECUTION-ENGINE] Starting execution loop for ${agentRole}`);

    // Mark as running
    this.runningLoops.set(agentRole, { running: true, intervalId: null });
    this.emit('loopStarted', { agentRole });

    // Start the non-blocking loop
    const runLoop = async () => {
      const loopState = this.runningLoops.get(agentRole);
      if (!loopState?.running) {
        console.log(`[EXECUTION-ENGINE] Loop stopped for ${agentRole}`);
        return;
      }

      try {
        await this.processExecutionTick(agentRole);
      } catch (error) {
        console.error(`[EXECUTION-ENGINE] Error in execution loop for ${agentRole}:`, error.message);
        this.emit('loopError', { agentRole, error });
      }

      // Schedule next tick (non-blocking)
      if (loopState?.running) {
        const intervalId = setTimeout(runLoop, POLL_INTERVAL);
        loopState.intervalId = intervalId;
      }
    };

    // Start the first tick
    runLoop();
  }

  /**
   * Stop the execution loop for an agent
   * @param {string} agentRole - The agent role to stop
   */
  stopExecutionLoop(agentRole) {
    const loopState = this.runningLoops.get(agentRole);
    if (loopState) {
      loopState.running = false;
      if (loopState.intervalId) {
        clearTimeout(loopState.intervalId);
      }
      console.log(`[EXECUTION-ENGINE] Stopped execution loop for ${agentRole}`);
      this.emit('loopStopped', { agentRole });
    }
  }

  /**
   * Process a single execution tick
   * @param {string} agentRole - The agent role
   */
  async processExecutionTick(agentRole) {
    // 1. Check for active task (resume if interrupted)
    let task = await this.getActiveTask(agentRole);

    // 2. If no active task, check for unblocked tasks
    if (!task) {
      task = await this.getNextUnblockedTask(agentRole);
    }

    // 3. If still no task, get next queued task
    if (!task) {
      task = await this.getNextQueuedTask(agentRole);
    }

    // 4. If we have a task, execute it
    if (task) {
      await this.executeTask(agentRole, task);
    }
  }

  // ============================================================================
  // TASK RETRIEVAL
  // ============================================================================

  /**
   * Get currently active task for an agent
   * @param {string} agentRole - The agent role
   * @returns {Promise<Object|null>} The active task or null
   */
  async getActiveTask(agentRole) {
    if (!this.isAvailable()) {
      return null;
    }

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('*')
      .eq('assigned_to', agentRole)
      .eq('status', TASK_STATES.ACTIVE)
      .order('started_at', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error(`[EXECUTION-ENGINE] getActiveTask error:`, error.message);
    }

    return data || null;
  }

  /**
   * Get highest priority queued task for an agent
   * @param {string} agentRole - The agent role
   * @returns {Promise<Object|null>} The next queued task or null
   */
  async getNextQueuedTask(agentRole) {
    if (!this.isAvailable()) {
      return null;
    }

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('*')
      .eq('assigned_to', agentRole)
      .eq('status', TASK_STATES.QUEUED)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`[EXECUTION-ENGINE] getNextQueuedTask error:`, error.message);
    }

    return data || null;
  }

  /**
   * Get tasks that were blocked but are now unblocked
   * @param {string} agentRole - The agent role
   * @returns {Promise<Object|null>} The next unblocked task or null
   */
  async getNextUnblockedTask(agentRole) {
    if (!this.isAvailable()) {
      return null;
    }

    // Get all blocked tasks for this agent
    const { data: blockedTasks, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('*')
      .eq('assigned_to', agentRole)
      .in('status', [
        TASK_STATES.BLOCKED_AGENT,
        TASK_STATES.BLOCKED_DECISION,
        TASK_STATES.BLOCKED_AUTH,
        TASK_STATES.BLOCKED_PAYMENT,
      ])
      .order('priority_score', { ascending: false });

    if (error) {
      console.error(`[EXECUTION-ENGINE] getNextUnblockedTask error:`, error.message);
      return null;
    }

    if (!blockedTasks || blockedTasks.length === 0) {
      return null;
    }

    // Check each blocked task to see if it's now unblocked
    for (const task of blockedTasks) {
      const isUnblocked = await this.checkIfUnblocked(task);
      if (isUnblocked) {
        // Move back to queued status
        await this.unblockTask(task.id);
        return task;
      }
    }

    return null;
  }

  /**
   * Check if a blocked task is now unblocked
   * @param {Object} task - The blocked task
   * @returns {Promise<boolean>} True if unblocked
   */
  async checkIfUnblocked(task) {
    const blockerInfo = task.blocker_info;
    if (!blockerInfo) {
      return true; // No blocker info means unblocked
    }

    switch (blockerInfo.type) {
      case BLOCKER_TYPES.AGENT:
        // Check if blocking task is completed
        if (blockerInfo.blocked_by_task_id) {
          const { data: blockingTask } = await this.supabase
            .from(TASK_QUEUE_TABLE)
            .select('status')
            .eq('id', blockerInfo.blocked_by_task_id)
            .single();

          return blockingTask?.status === TASK_STATES.COMPLETED;
        }
        return false;

      case BLOCKER_TYPES.DECISION:
        // Check if decision has been made (stored in task metadata)
        if (blockerInfo.decision_needed?.resolved) {
          return true;
        }
        // Check external decision store if available
        return false;

      case BLOCKER_TYPES.AUTH:
        // Check if auth has been granted (typically requires external verification)
        if (blockerInfo.auth_context?.authorized) {
          return true;
        }
        return false;

      case BLOCKER_TYPES.PAYMENT:
        // Check if payment has been approved
        if (blockerInfo.auth_context?.payment_approved) {
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Move a task from blocked back to queued
   * @param {string} taskId - The task ID
   */
  async unblockTask(taskId) {
    const { error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .update({
        status: TASK_STATES.QUEUED,
        unblocked_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (error) {
      console.error(`[EXECUTION-ENGINE] unblockTask error:`, error.message);
    } else {
      console.log(`[EXECUTION-ENGINE] Task ${taskId} unblocked`);
      this.emit('taskUnblocked', { taskId });
    }
  }

  // ============================================================================
  // TASK EXECUTION
  // ============================================================================

  /**
   * Execute a single task
   * @param {string} agentRole - The agent role
   * @param {Object} task - The task to execute
   */
  async executeTask(agentRole, task) {
    console.log(`[EXECUTION-ENGINE] Executing task ${task.id} for ${agentRole}`);

    // Mark task as active
    if (task.status !== TASK_STATES.ACTIVE) {
      await this.startTask(task.id);
    }

    this.emit('taskStarted', { agentRole, task });

    try {
      // Get the executor for this agent
      const executor = this.agentExecutors.get(agentRole);

      if (!executor) {
        throw new Error(`No executor registered for agent role: ${agentRole}`);
      }

      // Execute the task
      const result = await executor(task);

      // Check for blockers in the result
      if (result?.blocked) {
        await this.blockTask(task.id, result.blockerInfo);
        this.emit('taskBlocked', { agentRole, task, blockerInfo: result.blockerInfo });
        return;
      }

      // Task completed successfully
      await this.completeTask(task.id, result?.outputs || {});
      this.emit('taskCompleted', { agentRole, task, outputs: result?.outputs });

    } catch (error) {
      console.error(`[EXECUTION-ENGINE] Task ${task.id} execution error:`, error.message);
      await this.handleTaskError(task.id, error);
      this.emit('taskError', { agentRole, task, error });
    }
  }

  /**
   * Mark task as active and set started_at
   * @param {string} taskId - The task ID
   */
  async startTask(taskId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .update({
        status: TASK_STATES.ACTIVE,
        started_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error(`[EXECUTION-ENGINE] startTask error:`, error.message);
    } else {
      console.log(`[EXECUTION-ENGINE] Task ${taskId} started`);
    }

    return { data, error };
  }

  /**
   * Mark task as complete with outputs
   * @param {string} taskId - The task ID
   * @param {Object} outputs - Task outputs/results
   */
  async completeTask(taskId, outputs = {}) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .update({
        status: TASK_STATES.COMPLETED,
        completed_at: new Date().toISOString(),
        outputs: outputs,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error(`[EXECUTION-ENGINE] completeTask error:`, error.message);
    } else {
      console.log(`[EXECUTION-ENGINE] Task ${taskId} completed`);
    }

    return { data, error };
  }

  /**
   * Block task with blocker information
   * @param {string} taskId - The task ID
   * @param {Object} blockerInfo - Blocker information
   */
  async blockTask(taskId, blockerInfo) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Determine the blocked status based on blocker type
    let status;
    switch (blockerInfo.type) {
      case BLOCKER_TYPES.AGENT:
        status = TASK_STATES.BLOCKED_AGENT;
        break;
      case BLOCKER_TYPES.DECISION:
        status = TASK_STATES.BLOCKED_DECISION;
        break;
      case BLOCKER_TYPES.AUTH:
        status = TASK_STATES.BLOCKED_AUTH;
        break;
      case BLOCKER_TYPES.PAYMENT:
        status = TASK_STATES.BLOCKED_PAYMENT;
        break;
      default:
        status = TASK_STATES.BLOCKED_AGENT;
    }

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .update({
        status,
        blocked_at: new Date().toISOString(),
        blocker_info: blockerInfo,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error(`[EXECUTION-ENGINE] blockTask error:`, error.message);
    } else {
      console.log(`[EXECUTION-ENGINE] Task ${taskId} blocked: ${blockerInfo.type}`);
    }

    return { data, error };
  }

  /**
   * Handle execution errors with retry logic
   * @param {string} taskId - The task ID
   * @param {Error} error - The error that occurred
   */
  async handleTaskError(taskId, error) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get current task state
    const { data: task } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('retry_count, metadata')
      .eq('id', taskId)
      .single();

    const currentRetryCount = task?.retry_count || 0;
    const newRetryCount = currentRetryCount + 1;

    // Update error history in metadata
    const metadata = task?.metadata || {};
    const errorHistory = metadata.error_history || [];
    errorHistory.push({
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack?.substring(0, 500), // Limit stack trace length
      attempt: newRetryCount,
    });
    metadata.error_history = errorHistory;
    metadata.last_error = error.message;
    metadata.last_error_at = new Date().toISOString();

    // Determine new status
    let newStatus;
    if (newRetryCount >= MAX_RETRY_COUNT) {
      newStatus = TASK_STATES.FAILED;
      console.log(`[EXECUTION-ENGINE] Task ${taskId} failed after ${newRetryCount} attempts`);
    } else {
      newStatus = TASK_STATES.QUEUED; // Re-queue for retry
      console.log(`[EXECUTION-ENGINE] Task ${taskId} queued for retry (attempt ${newRetryCount}/${MAX_RETRY_COUNT})`);

      // Calculate backoff delay and store next retry time
      const backoffDelay = RETRY_DELAY_BASE * Math.pow(2, newRetryCount - 1);
      metadata.next_retry_after = new Date(Date.now() + backoffDelay).toISOString();
    }

    const { data, error: updateError } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .update({
        status: newStatus,
        retry_count: newRetryCount,
        metadata,
        failed_at: newStatus === TASK_STATES.FAILED ? new Date().toISOString() : null,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (updateError) {
      console.error(`[EXECUTION-ENGINE] handleTaskError update error:`, updateError.message);
    }

    return { data, error: updateError };
  }

  // ============================================================================
  // BLOCKER DETECTION HELPERS
  // ============================================================================

  /**
   * Create blocker info for agent dependency
   * @param {string} blockedByAgent - Agent role that must complete first
   * @param {string} blockedByTaskId - Task ID that must complete first
   * @returns {Object} BlockerInfo object
   */
  static createAgentBlocker(blockedByAgent, blockedByTaskId) {
    return {
      type: BLOCKER_TYPES.AGENT,
      blocked_by_agent: blockedByAgent,
      blocked_by_task_id: blockedByTaskId,
    };
  }

  /**
   * Create blocker info for decision needed
   * @param {Object} decisionSpec - Decision specification
   * @returns {Object} BlockerInfo object
   */
  static createDecisionBlocker(decisionSpec) {
    return {
      type: BLOCKER_TYPES.DECISION,
      decision_needed: {
        type: decisionSpec.type,
        title: decisionSpec.title,
        description: decisionSpec.description,
        options: decisionSpec.options,
        recommendation: decisionSpec.recommendation,
        reasoning: decisionSpec.reasoning,
        resolved: false,
      },
    };
  }

  /**
   * Create blocker info for auth/payment required
   * @param {string} type - 'auth' or 'payment'
   * @param {Object} context - Authorization context
   * @returns {Object} BlockerInfo object
   */
  static createAuthBlocker(type, context) {
    return {
      type: type === 'payment' ? BLOCKER_TYPES.PAYMENT : BLOCKER_TYPES.AUTH,
      auth_context: {
        url: context.url,
        action: context.action,
        cost_estimate: context.cost_estimate,
        authorized: false,
        payment_approved: false,
      },
    };
  }

  // ============================================================================
  // TASK QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Add a new task to the queue
   * @param {Object} taskData - Task data
   * @returns {Promise<{data, error}>}
   */
  async queueTask(taskData) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .insert([{
        title: taskData.title,
        description: taskData.description,
        assigned_to: taskData.assigned_to,
        status: TASK_STATES.QUEUED,
        priority: taskData.priority || 'MEDIUM',
        priority_score: taskData.priority_score || 50,
        inputs: taskData.inputs || {},
        metadata: taskData.metadata || {},
        parent_task_id: taskData.parent_task_id,
        workflow_id: taskData.workflow_id,
        due_date: taskData.due_date,
      }])
      .select()
      .single();

    if (error) {
      console.error(`[EXECUTION-ENGINE] queueTask error:`, error.message);
    } else {
      console.log(`[EXECUTION-ENGINE] Task ${data.id} queued for ${taskData.assigned_to}`);
      this.emit('taskQueued', { task: data });
    }

    return { data, error };
  }

  /**
   * Get task queue statistics for an agent
   * @param {string} agentRole - The agent role
   * @returns {Promise<Object>} Queue statistics
   */
  async getQueueStats(agentRole) {
    if (!this.isAvailable()) {
      return { error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('status')
      .eq('assigned_to', agentRole);

    if (error) {
      return { error };
    }

    const stats = {
      total: data.length,
      queued: 0,
      active: 0,
      completed: 0,
      failed: 0,
      blocked_agent: 0,
      blocked_decision: 0,
      blocked_auth: 0,
      blocked_payment: 0,
    };

    for (const task of data) {
      if (stats[task.status] !== undefined) {
        stats[task.status]++;
      }
    }

    stats.blocked_total = stats.blocked_agent + stats.blocked_decision +
                          stats.blocked_auth + stats.blocked_payment;

    return { data: stats, error: null };
  }

  /**
   * Get engine status
   * @returns {Object} Engine status
   */
  getStatus() {
    const runningAgents = [];
    for (const [agentRole, state] of this.runningLoops) {
      if (state.running) {
        runningAgents.push(agentRole);
      }
    }

    return {
      isConnected: this.isConnected,
      runningAgents,
      registeredExecutors: Array.from(this.agentExecutors.keys()),
      pollInterval: POLL_INTERVAL,
      maxRetryCount: MAX_RETRY_COUNT,
    };
  }
}

// Export constants and class
export {
  ExecutionEngine,
  TASK_STATES,
  BLOCKER_TYPES,
  POLL_INTERVAL,
  MAX_RETRY_COUNT,
  TASK_QUEUE_TABLE,
};

export default ExecutionEngine;
