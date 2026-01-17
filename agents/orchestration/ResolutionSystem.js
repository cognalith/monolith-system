/**
 * RESOLUTION SYSTEM - Phase 7 Task Orchestration
 * Cognalith Inc. | Monolith System
 *
 * Handles unblocking tasks through multiple resolution mechanisms:
 * - DependencyResolver: Monitors blocked tasks and unblocks when dependencies complete
 * - CEODecisionHandler: Processes Frank's decisions on blocked_decision tasks
 * - AutoEscalation: Escalates tasks blocked longer than threshold
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_ESCALATE_AFTER_HOURS = 24;
const DEPENDENCY_RESOLVER_INTERVAL = 30000; // 30 seconds
const AUTO_ESCALATION_INTERVAL = 3600000; // 1 hour

// Task states (from ExecutionEngine)
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

// Escalation types
const ESCALATION_TYPES = {
  STALE_BLOCKER: 'stale_blocker',
  DEPENDENCY_FAILED: 'dependency_failed',
  CEO_DECISION_TIMEOUT: 'ceo_decision_timeout',
  REPEATED_FAILURES: 'repeated_failures',
};

// Table names
const TASK_QUEUE_TABLE = 'monolith_task_queue';
const TASK_DEPENDENCIES_TABLE = 'monolith_task_dependencies';
const CEO_DECISIONS_TABLE = 'monolith_ceo_decisions';

// ============================================================================
// RESOLUTION SYSTEM CLASS
// ============================================================================

class ResolutionSystem extends EventEmitter {
  constructor(config = {}) {
    super();

    this.supabase = null;
    this.isConnected = false;
    this.config = config;

    // Interval handles
    this.dependencyResolverInterval = null;
    this.autoEscalationInterval = null;

    // Running state
    this.isRunning = false;

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
      console.log('[RESOLUTION-SYSTEM] Connected to Supabase');
    } else {
      console.warn('[RESOLUTION-SYSTEM] No Supabase credentials found');
    }
  }

  /**
   * Check if database is available
   */
  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ============================================================================
  // START/STOP METHODS
  // ============================================================================

  /**
   * Start all resolution jobs
   */
  start() {
    if (this.isRunning) {
      console.warn('[RESOLUTION-SYSTEM] Already running');
      return;
    }

    if (!this.isAvailable()) {
      console.error('[RESOLUTION-SYSTEM] Cannot start: Database unavailable');
      return;
    }

    console.log('[RESOLUTION-SYSTEM] Starting resolution jobs');
    this.isRunning = true;

    // Start dependency resolver
    this.dependencyResolverInterval = setInterval(
      () => this.runDependencyResolver(),
      DEPENDENCY_RESOLVER_INTERVAL
    );

    // Start auto-escalation
    this.autoEscalationInterval = setInterval(
      () => this.runAutoEscalation(),
      AUTO_ESCALATION_INTERVAL
    );

    // Run immediately on start
    this.runDependencyResolver();
    this.runAutoEscalation();

    this.emit('started');
    console.log('[RESOLUTION-SYSTEM] Resolution jobs started');
  }

  /**
   * Stop all resolution jobs
   */
  stop() {
    if (!this.isRunning) {
      console.warn('[RESOLUTION-SYSTEM] Not running');
      return;
    }

    console.log('[RESOLUTION-SYSTEM] Stopping resolution jobs');

    if (this.dependencyResolverInterval) {
      clearInterval(this.dependencyResolverInterval);
      this.dependencyResolverInterval = null;
    }

    if (this.autoEscalationInterval) {
      clearInterval(this.autoEscalationInterval);
      this.autoEscalationInterval = null;
    }

    this.isRunning = false;
    this.emit('stopped');
    console.log('[RESOLUTION-SYSTEM] Resolution jobs stopped');
  }

  // ============================================================================
  // DEPENDENCY RESOLVER
  // ============================================================================

  /**
   * Main dependency resolver function
   * Checks blocked tasks and unblocks them if their dependencies are resolved
   */
  async runDependencyResolver() {
    if (!this.isAvailable()) {
      return;
    }

    try {
      console.log('[RESOLUTION-SYSTEM] Running dependency resolver...');

      // Get all tasks blocked by agent dependencies
      const { data: blockedTasks, error } = await this.supabase
        .from(TASK_QUEUE_TABLE)
        .select('*')
        .eq('status', TASK_STATES.BLOCKED_AGENT);

      if (error) {
        console.error('[RESOLUTION-SYSTEM] Error fetching blocked tasks:', error.message);
        return;
      }

      if (!blockedTasks || blockedTasks.length === 0) {
        return;
      }

      console.log(`[RESOLUTION-SYSTEM] Found ${blockedTasks.length} blocked tasks to check`);

      let unblocked = 0;
      let escalated = 0;

      for (const task of blockedTasks) {
        const result = await this.checkAndResolveBlocker(task);
        if (result.unblocked) unblocked++;
        if (result.escalated) escalated++;
      }

      if (unblocked > 0 || escalated > 0) {
        console.log(`[RESOLUTION-SYSTEM] Dependency resolver: ${unblocked} unblocked, ${escalated} escalated`);
        this.emit('dependencyResolverComplete', { unblocked, escalated });
      }

    } catch (error) {
      console.error('[RESOLUTION-SYSTEM] Dependency resolver error:', error.message);
      this.emit('dependencyResolverError', { error });
    }
  }

  /**
   * Check a single blocked task and resolve if possible
   * @param {Object} task - The blocked task
   * @returns {Object} Result { unblocked: boolean, escalated: boolean }
   */
  async checkAndResolveBlocker(task) {
    const result = { unblocked: false, escalated: false };
    const blockerInfo = task.blocker_info;

    if (!blockerInfo || !blockerInfo.blocked_by_task_id) {
      // No valid blocker info, just unblock it
      await this.unblockTask(task.id, {
        resolution_type: 'auto_resolved',
        reason: 'No valid blocker information found',
      });
      result.unblocked = true;
      return result;
    }

    // Get the blocking task status
    const { data: blockerTask, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('id, status, outputs, failed_at')
      .eq('id', blockerInfo.blocked_by_task_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`[RESOLUTION-SYSTEM] Error fetching blocker task:`, error.message);
      return result;
    }

    if (!blockerTask) {
      // Blocker task not found - unblock with warning
      await this.unblockTask(task.id, {
        resolution_type: 'blocker_not_found',
        reason: `Blocking task ${blockerInfo.blocked_by_task_id} no longer exists`,
      });
      result.unblocked = true;
      return result;
    }

    if (blockerTask.status === TASK_STATES.COMPLETED) {
      // Blocker completed - unblock the task
      await this.unblockTask(task.id, {
        resolution_type: 'dependency_completed',
        reason: `Blocking task ${blockerInfo.blocked_by_task_id} completed`,
        blocker_outputs: blockerTask.outputs,
      });
      result.unblocked = true;
      return result;
    }

    if (blockerTask.status === TASK_STATES.FAILED) {
      // Blocker failed - escalate or retry based on configuration
      const shouldRetry = task.metadata?.retry_on_dependency_failure;

      if (shouldRetry) {
        // Retry the blocked task anyway
        await this.unblockTask(task.id, {
          resolution_type: 'dependency_failed_retry',
          reason: `Blocking task failed, proceeding with retry flag`,
          blocker_failed_at: blockerTask.failed_at,
        });
        result.unblocked = true;
      } else {
        // Escalate the blocked task
        await this.escalateTask(task.id, {
          escalation_type: ESCALATION_TYPES.DEPENDENCY_FAILED,
          reason: `Blocking task ${blockerInfo.blocked_by_task_id} failed`,
          blocker_task_id: blockerInfo.blocked_by_task_id,
        });
        result.escalated = true;
      }
      return result;
    }

    // Blocker still in progress - no action
    return result;
  }

  // ============================================================================
  // CEO DECISION HANDLER
  // ============================================================================

  /**
   * Handle a CEO decision on a blocked task
   * @param {string} decisionId - The decision ID from monolith_ceo_decisions
   * @param {string} choice - The CEO's choice (e.g., 'approve', 'reject', 'modify')
   * @param {string} notes - Optional notes from the CEO
   * @returns {Promise<Object>} Result of processing the decision
   */
  async handleCEODecision(decisionId, choice, notes = null) {
    if (!this.isAvailable()) {
      return { success: false, error: 'Database unavailable' };
    }

    try {
      console.log(`[RESOLUTION-SYSTEM] Processing CEO decision: ${decisionId}`);

      // Get the decision record
      const { data: decision, error: fetchError } = await this.supabase
        .from(CEO_DECISIONS_TABLE)
        .select('*')
        .eq('id', decisionId)
        .single();

      if (fetchError || !decision) {
        console.error('[RESOLUTION-SYSTEM] Decision not found:', fetchError?.message);
        return { success: false, error: 'Decision not found' };
      }

      if (decision.status !== 'pending') {
        console.warn(`[RESOLUTION-SYSTEM] Decision ${decisionId} already processed: ${decision.status}`);
        return { success: false, error: `Decision already processed: ${decision.status}` };
      }

      // Update the decision record
      const { error: updateError } = await this.supabase
        .from(CEO_DECISIONS_TABLE)
        .update({
          choice,
          notes,
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: 'ceo', // Frank
        })
        .eq('id', decisionId);

      if (updateError) {
        console.error('[RESOLUTION-SYSTEM] Error updating decision:', updateError.message);
        return { success: false, error: updateError.message };
      }

      // Get the associated task
      const taskId = decision.task_id;
      if (!taskId) {
        console.warn('[RESOLUTION-SYSTEM] No task associated with decision');
        return { success: true, message: 'Decision recorded but no associated task' };
      }

      // Unblock and re-queue the task with decision context
      const resolution = {
        resolution_type: 'ceo_decision',
        decision_id: decisionId,
        choice,
        notes,
        resolved_at: new Date().toISOString(),
      };

      await this.unblockTask(taskId, resolution);
      await this.requeueTask(taskId);

      this.emit('ceoDecisionProcessed', {
        decisionId,
        taskId,
        choice,
        notes,
      });

      console.log(`[RESOLUTION-SYSTEM] CEO decision ${decisionId} processed, task ${taskId} re-queued`);

      return {
        success: true,
        decisionId,
        taskId,
        choice,
        message: 'Decision processed and task re-queued',
      };

    } catch (error) {
      console.error('[RESOLUTION-SYSTEM] Error handling CEO decision:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a CEO decision request for a blocked task
   * @param {Object} options - Decision request options
   * @returns {Promise<Object>} The created decision record
   */
  async createCEODecisionRequest(options) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const {
      taskId,
      title,
      description,
      options: decisionOptions,
      recommendation,
      reasoning,
      urgency = 'medium',
      metadata = {},
    } = options;

    const { data, error } = await this.supabase
      .from(CEO_DECISIONS_TABLE)
      .insert([{
        task_id: taskId,
        title,
        description,
        options: decisionOptions,
        recommendation,
        reasoning,
        urgency,
        status: 'pending',
        metadata,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[RESOLUTION-SYSTEM] Error creating CEO decision request:', error.message);
      return { data: null, error };
    }

    console.log(`[RESOLUTION-SYSTEM] Created CEO decision request: ${data.id}`);
    this.emit('ceoDecisionRequested', { decision: data, taskId });

    return { data, error: null };
  }

  /**
   * Get pending CEO decisions
   * @param {number} limit - Max decisions to return
   * @returns {Promise<Array>} Pending decisions
   */
  async getPendingCEODecisions(limit = 50) {
    if (!this.isAvailable()) {
      return [];
    }

    const { data, error } = await this.supabase
      .from(CEO_DECISIONS_TABLE)
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[RESOLUTION-SYSTEM] Error fetching pending decisions:', error.message);
      return [];
    }

    return data || [];
  }

  // ============================================================================
  // AUTO ESCALATION
  // ============================================================================

  /**
   * Run auto-escalation for stale blocked tasks
   * Checks tasks blocked longer than AUTO_ESCALATE_AFTER_HOURS
   */
  async runAutoEscalation() {
    if (!this.isAvailable()) {
      return;
    }

    try {
      console.log('[RESOLUTION-SYSTEM] Running auto-escalation check...');

      const staleTasks = await this.getTasksBlockedLongerThan(AUTO_ESCALATE_AFTER_HOURS);

      if (!staleTasks || staleTasks.length === 0) {
        return;
      }

      console.log(`[RESOLUTION-SYSTEM] Found ${staleTasks.length} stale blocked tasks`);

      let escalated = 0;

      for (const task of staleTasks) {
        // Skip if already escalated
        if (task.escalation_type) {
          continue;
        }

        const blockedHours = this.getBlockedHours(task);

        await this.escalateTask(task.id, {
          escalation_type: ESCALATION_TYPES.STALE_BLOCKER,
          reason: `Task blocked for ${Math.round(blockedHours)} hours (threshold: ${AUTO_ESCALATE_AFTER_HOURS} hours)`,
          blocked_since: task.blocked_at,
          blocked_status: task.status,
        });

        escalated++;
      }

      if (escalated > 0) {
        console.log(`[RESOLUTION-SYSTEM] Auto-escalated ${escalated} stale tasks`);
        this.emit('autoEscalationComplete', { escalated });
      }

    } catch (error) {
      console.error('[RESOLUTION-SYSTEM] Auto-escalation error:', error.message);
      this.emit('autoEscalationError', { error });
    }
  }

  /**
   * Calculate hours a task has been blocked
   * @param {Object} task - The task object
   * @returns {number} Hours blocked
   */
  getBlockedHours(task) {
    const blockedAt = task.blocked_at ? new Date(task.blocked_at) : new Date(task.updated_at);
    const now = new Date();
    return (now - blockedAt) / (1000 * 60 * 60);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Unblock a task with resolution context
   * @param {string} taskId - The task ID
   * @param {Object} resolution - Resolution context object
   */
  async unblockTask(taskId, resolution = {}) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get current task to preserve metadata
    const { data: task, error: fetchError } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('metadata, blocker_info')
      .eq('id', taskId)
      .single();

    if (fetchError) {
      console.error(`[RESOLUTION-SYSTEM] Error fetching task for unblock:`, fetchError.message);
      return { data: null, error: fetchError };
    }

    // Merge resolution into metadata
    const metadata = task?.metadata || {};
    metadata.resolution_history = metadata.resolution_history || [];
    metadata.resolution_history.push({
      ...resolution,
      unblocked_at: new Date().toISOString(),
      previous_blocker: task?.blocker_info,
    });

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .update({
        status: TASK_STATES.QUEUED,
        unblocked_at: new Date().toISOString(),
        blocker_info: null,
        metadata,
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error(`[RESOLUTION-SYSTEM] Error unblocking task ${taskId}:`, error.message);
      return { data: null, error };
    }

    console.log(`[RESOLUTION-SYSTEM] Task ${taskId} unblocked: ${resolution.resolution_type || 'manual'}`);
    this.emit('taskUnblocked', { taskId, resolution });

    return { data, error: null };
  }

  /**
   * Re-queue a task for execution
   * @param {string} taskId - The task ID
   */
  async requeueTask(taskId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .update({
        status: TASK_STATES.QUEUED,
        requeued_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error(`[RESOLUTION-SYSTEM] Error requeuing task ${taskId}:`, error.message);
      return { data: null, error };
    }

    console.log(`[RESOLUTION-SYSTEM] Task ${taskId} requeued`);
    this.emit('taskRequeued', { taskId });

    return { data, error: null };
  }

  /**
   * Get tasks blocked longer than specified hours
   * @param {number} hours - Hours threshold
   * @returns {Promise<Array>} Blocked tasks older than threshold
   */
  async getTasksBlockedLongerThan(hours) {
    if (!this.isAvailable()) {
      return [];
    }

    const thresholdTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('*')
      .in('status', [
        TASK_STATES.BLOCKED_AGENT,
        TASK_STATES.BLOCKED_DECISION,
        TASK_STATES.BLOCKED_AUTH,
        TASK_STATES.BLOCKED_PAYMENT,
      ])
      .lt('blocked_at', thresholdTime)
      .is('escalation_type', null); // Not already escalated

    if (error) {
      console.error('[RESOLUTION-SYSTEM] Error fetching stale tasks:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * Escalate a task
   * @param {string} taskId - The task ID
   * @param {Object} escalationInfo - Escalation information
   */
  async escalateTask(taskId, escalationInfo) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .update({
        escalation_type: escalationInfo.escalation_type,
        escalation_reason: escalationInfo.reason,
        escalated_at: new Date().toISOString(),
        metadata: {
          ...(await this.getTaskMetadata(taskId)),
          escalation_info: escalationInfo,
        },
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error(`[RESOLUTION-SYSTEM] Error escalating task ${taskId}:`, error.message);
      return { data: null, error };
    }

    console.log(`[RESOLUTION-SYSTEM] Task ${taskId} escalated: ${escalationInfo.escalation_type}`);
    this.emit('taskEscalated', { taskId, escalationInfo });

    return { data, error: null };
  }

  /**
   * Get task metadata helper
   * @param {string} taskId - The task ID
   * @returns {Promise<Object>} Task metadata or empty object
   */
  async getTaskMetadata(taskId) {
    const { data } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('metadata')
      .eq('id', taskId)
      .single();

    return data?.metadata || {};
  }

  // ============================================================================
  // DEPENDENCY MANAGEMENT
  // ============================================================================

  /**
   * Add a dependency between tasks
   * @param {string} taskId - The dependent task ID
   * @param {string} dependsOnTaskId - The task ID this depends on
   * @param {string} dependencyType - Type of dependency (e.g., 'completion', 'data')
   */
  async addDependency(taskId, dependsOnTaskId, dependencyType = 'completion') {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TASK_DEPENDENCIES_TABLE)
      .insert([{
        task_id: taskId,
        depends_on_task_id: dependsOnTaskId,
        dependency_type: dependencyType,
        status: 'active',
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[RESOLUTION-SYSTEM] Error adding dependency:', error.message);
      return { data: null, error };
    }

    console.log(`[RESOLUTION-SYSTEM] Added dependency: ${taskId} depends on ${dependsOnTaskId}`);
    return { data, error: null };
  }

  /**
   * Get all dependencies for a task
   * @param {string} taskId - The task ID
   * @returns {Promise<Array>} Task dependencies
   */
  async getTaskDependencies(taskId) {
    if (!this.isAvailable()) {
      return [];
    }

    const { data, error } = await this.supabase
      .from(TASK_DEPENDENCIES_TABLE)
      .select('*')
      .eq('task_id', taskId)
      .eq('status', 'active');

    if (error) {
      console.error('[RESOLUTION-SYSTEM] Error fetching dependencies:', error.message);
      return [];
    }

    return data || [];
  }

  /**
   * Mark a dependency as resolved
   * @param {string} dependencyId - The dependency record ID
   */
  async resolveDependency(dependencyId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TASK_DEPENDENCIES_TABLE)
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', dependencyId)
      .select()
      .single();

    if (error) {
      console.error('[RESOLUTION-SYSTEM] Error resolving dependency:', error.message);
      return { data: null, error };
    }

    return { data, error: null };
  }

  // ============================================================================
  // STATUS AND DIAGNOSTICS
  // ============================================================================

  /**
   * Get resolution system status
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isRunning: this.isRunning,
      intervals: {
        dependencyResolver: DEPENDENCY_RESOLVER_INTERVAL,
        autoEscalation: AUTO_ESCALATION_INTERVAL,
      },
      thresholds: {
        autoEscalateAfterHours: AUTO_ESCALATE_AFTER_HOURS,
      },
    };
  }

  /**
   * Get resolution statistics
   * @param {string} since - ISO timestamp to filter from
   * @returns {Promise<Object>} Resolution stats
   */
  async getStats(since = null) {
    if (!this.isAvailable()) {
      return { error: 'Database unavailable' };
    }

    const sinceTime = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get blocked task counts by status
    const { data: blockedTasks, error: blockedError } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('status, escalation_type')
      .in('status', [
        TASK_STATES.BLOCKED_AGENT,
        TASK_STATES.BLOCKED_DECISION,
        TASK_STATES.BLOCKED_AUTH,
        TASK_STATES.BLOCKED_PAYMENT,
      ]);

    // Get recently unblocked tasks
    const { data: unblockedTasks, error: unblockedError } = await this.supabase
      .from(TASK_QUEUE_TABLE)
      .select('id, unblocked_at')
      .not('unblocked_at', 'is', null)
      .gte('unblocked_at', sinceTime);

    // Get pending CEO decisions
    const { data: pendingDecisions } = await this.supabase
      .from(CEO_DECISIONS_TABLE)
      .select('id')
      .eq('status', 'pending');

    const stats = {
      blocked: {
        total: blockedTasks?.length || 0,
        by_agent: blockedTasks?.filter(t => t.status === TASK_STATES.BLOCKED_AGENT).length || 0,
        by_decision: blockedTasks?.filter(t => t.status === TASK_STATES.BLOCKED_DECISION).length || 0,
        by_auth: blockedTasks?.filter(t => t.status === TASK_STATES.BLOCKED_AUTH).length || 0,
        by_payment: blockedTasks?.filter(t => t.status === TASK_STATES.BLOCKED_PAYMENT).length || 0,
        escalated: blockedTasks?.filter(t => t.escalation_type).length || 0,
      },
      unblocked_since: unblockedTasks?.length || 0,
      pending_ceo_decisions: pendingDecisions?.length || 0,
      since: sinceTime,
    };

    return stats;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  ResolutionSystem,
  TASK_STATES,
  ESCALATION_TYPES,
  AUTO_ESCALATE_AFTER_HOURS,
  DEPENDENCY_RESOLVER_INTERVAL,
  AUTO_ESCALATION_INTERVAL,
  TASK_QUEUE_TABLE,
  TASK_DEPENDENCIES_TABLE,
  CEO_DECISIONS_TABLE,
};

export default ResolutionSystem;
