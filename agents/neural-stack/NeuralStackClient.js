/**
 * NEURAL STACK CLIENT
 * Cognalith Inc. | Monolith System - Phase 5A
 *
 * CRUD operations for Neural Stack data foundation.
 * Provides interface for task history logging, CoS scoring,
 * amendment management, and trend analysis.
 */

import { createClient } from '@supabase/supabase-js';

// Table names with monolith prefix
const TABLES = {
  deliverables: 'monolith_deliverables',
  taskHistory: 'monolith_task_history',
  agentMemory: 'monolith_agent_memory',
  amendments: 'monolith_amendments',
  cosReviews: 'monolith_cos_reviews',
  performanceSnapshots: 'monolith_performance_snapshots',
};

/**
 * Neural Stack Client
 * Manages all data operations for the evolutionary optimization system
 */
class NeuralStackClient {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.config = config;
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
      console.log('[NEURAL-STACK] Connected to Supabase');
    } else {
      console.warn('[NEURAL-STACK] No Supabase credentials found');
    }
  }

  /**
   * Check if database is available
   */
  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ============================================================================
  // TASK HISTORY OPERATIONS
  // ============================================================================

  /**
   * Log task start
   * @param {Object} task - Task data
   * @returns {Promise<{data, error}>}
   */
  async logTaskStart(task) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.taskHistory)
      .insert([{
        task_id: task.id || task.task_id,
        agent_role: task.agent_role || task.role,
        title: task.title,
        description: task.description,
        deliverable_titles: task.deliverable_titles || [],
        difficulty: task.difficulty,
        estimated_hours: task.estimated_hours,
        started_at: new Date().toISOString(),
        knowledge_version: task.knowledge_version,
        model_used: task.model_used,
      }])
      .select()
      .single();

    if (error) {
      console.error('[NEURAL-STACK] logTaskStart error:', error.message);
    } else {
      console.log(`[NEURAL-STACK] Task started: ${task.id}`);
    }

    return { data, error };
  }

  /**
   * Log task completion with timestamps
   * @param {string} taskId - Task ID
   * @param {Object} completionData - Completion data
   * @returns {Promise<{data, error}>}
   */
  async logTaskCompletion(taskId, completionData = {}) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.taskHistory)
      .update({
        completed_at: new Date().toISOString(),
        model_used: completionData.model_used,
        tokens_used: completionData.tokens_used || 0,
      })
      .eq('task_id', taskId)
      .is('completed_at', null)  // Only update incomplete tasks
      .select()
      .single();

    if (error) {
      console.error('[NEURAL-STACK] logTaskCompletion error:', error.message);
    } else {
      console.log(`[NEURAL-STACK] Task completed: ${taskId}`);
    }

    return { data, error };
  }

  /**
   * Record CoS score and notes for a task
   * @param {string} taskId - Task ID
   * @param {number} score - CoS score (0-100)
   * @param {string} notes - CoS notes
   * @returns {Promise<{data, error}>}
   */
  async recordCosScore(taskId, score, notes = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    if (score < 0 || score > 100) {
      return { data: null, error: { message: 'Score must be between 0 and 100' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.taskHistory)
      .update({
        cos_score: score,
        cos_notes: notes,
        cos_reviewed_at: new Date().toISOString(),
      })
      .eq('task_id', taskId)
      .select()
      .single();

    if (error) {
      console.error('[NEURAL-STACK] recordCosScore error:', error.message);
    } else {
      console.log(`[NEURAL-STACK] CoS score recorded for ${taskId}: ${score}`);
    }

    return { data, error };
  }

  /**
   * Get task history for an agent (for trend analysis)
   * @param {string} agentRole - Agent role
   * @param {number} limit - Number of tasks to retrieve
   * @returns {Promise<{data, error}>}
   */
  async getTaskHistory(agentRole, limit = 50) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.taskHistory)
      .select('*')
      .eq('agent_role', agentRole)
      .not('completed_at', 'is', null)  // Only completed tasks
      .order('completed_at', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  /**
   * Get recent tasks for trend calculation (last N completed)
   * @param {string} agentRole - Agent role
   * @param {number} count - Number of tasks
   * @returns {Promise<{data, error}>}
   */
  async getRecentTasksForTrend(agentRole, count = 10) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.taskHistory)
      .select('task_id, title, difficulty, estimated_hours, actual_hours, variance, variance_percent, cos_score, completed_at')
      .eq('agent_role', agentRole)
      .not('completed_at', 'is', null)
      .not('variance_percent', 'is', null)
      .order('completed_at', { ascending: true })  // Chronological for trend
      .limit(count);

    return { data: data || [], error };
  }

  // ============================================================================
  // DELIVERABLES OPERATIONS
  // ============================================================================

  /**
   * Create a deliverable
   * @param {Object} deliverable - Deliverable data
   * @returns {Promise<{data, error}>}
   */
  async createDeliverable(deliverable) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.deliverables)
      .insert([{
        task_id: deliverable.task_id,
        title: deliverable.title,
        description: deliverable.description,
        acceptance_criteria: deliverable.acceptance_criteria || [],
        due_date: deliverable.due_date,
        artifacts: deliverable.artifacts || [],
      }])
      .select()
      .single();

    if (error) {
      console.error('[NEURAL-STACK] createDeliverable error:', error.message);
    }

    return { data, error };
  }

  /**
   * Mark deliverable as completed
   * @param {string} deliverableId - Deliverable ID
   * @param {string[]} artifacts - Completed artifacts
   * @returns {Promise<{data, error}>}
   */
  async completeDeliverable(deliverableId, artifacts = []) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.deliverables)
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        artifacts,
      })
      .eq('id', deliverableId)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get deliverables for a task
   * @param {string} taskId - Task ID
   * @returns {Promise<{data, error}>}
   */
  async getDeliverablesByTask(taskId) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.deliverables)
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    return { data: data || [], error };
  }

  // ============================================================================
  // AGENT MEMORY OPERATIONS
  // ============================================================================

  /**
   * Get agent memory
   * @param {string} agentRole - Agent role
   * @returns {Promise<{data, error}>}
   */
  async getAgentMemory(agentRole) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.agentMemory)
      .select('*')
      .eq('agent_role', agentRole)
      .single();

    return { data, error };
  }

  /**
   * Update agent memory
   * @param {string} agentRole - Agent role
   * @param {Object} updates - Fields to update
   * @returns {Promise<{data, error}>}
   */
  async updateAgentMemory(agentRole, updates) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.agentMemory)
      .update(updates)
      .eq('agent_role', agentRole)
      .select()
      .single();

    if (error) {
      console.error('[NEURAL-STACK] updateAgentMemory error:', error.message);
    }

    return { data, error };
  }

  /**
   * Update performance metrics for an agent
   * @param {string} agentRole - Agent role
   * @param {Object} metrics - Performance metrics
   * @returns {Promise<{data, error}>}
   */
  async updatePerformanceMetrics(agentRole, metrics) {
    return this.updateAgentMemory(agentRole, {
      avg_variance_percent: metrics.avg_variance_percent,
      variance_trend_slope: metrics.variance_trend_slope,
      on_time_delivery_rate: metrics.on_time_delivery_rate,
      avg_cos_score: metrics.avg_cos_score,
      deliverable_completion_rate: metrics.deliverable_completion_rate,
      metrics_by_difficulty: metrics.metrics_by_difficulty,
      current_trend: metrics.current_trend,
      trend_calculated_at: new Date().toISOString(),
    });
  }

  /**
   * Increment tasks since last review
   * @param {string} agentRole - Agent role
   * @returns {Promise<{data, error}>}
   */
  async incrementTasksSinceReview(agentRole) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get current count
    const { data: memory } = await this.getAgentMemory(agentRole);
    const currentCount = memory?.tasks_since_last_review || 0;

    return this.updateAgentMemory(agentRole, {
      tasks_since_last_review: currentCount + 1,
    });
  }

  // ============================================================================
  // AMENDMENTS OPERATIONS
  // ============================================================================

  /**
   * Create a new amendment
   * @param {Object} amendment - Amendment data
   * @returns {Promise<{data, error}>}
   */
  async createAmendment(amendment) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Generate amendment ID
    const timestamp = Date.now();
    const amendmentId = amendment.amendment_id || `amend-${timestamp}`;

    const { data, error } = await this.supabase
      .from(TABLES.amendments)
      .insert([{
        amendment_id: amendmentId,
        agent_role: amendment.agent_role,
        trigger_reason: amendment.trigger_reason,
        trigger_pattern: amendment.trigger_pattern,
        amendment_type: amendment.amendment_type,
        target_area: amendment.target_area,
        content: amendment.content,
        performance_before: amendment.performance_before,
        evaluation_window_tasks: amendment.evaluation_window_tasks || 5,
        approved_by: amendment.approved_by || 'cos_auto',
        approval_required: amendment.approval_required || false,
        previous_amendment_id: amendment.previous_amendment_id,
      }])
      .select()
      .single();

    if (error) {
      console.error('[NEURAL-STACK] createAmendment error:', error.message);
    } else {
      console.log(`[NEURAL-STACK] Amendment created: ${amendmentId} for ${amendment.agent_role}`);

      // Increment amendment count in agent memory
      await this.incrementAmendmentCount(amendment.agent_role);
    }

    return { data, error };
  }

  /**
   * Increment active amendment count
   */
  async incrementAmendmentCount(agentRole) {
    const { data: memory } = await this.getAgentMemory(agentRole);
    if (memory) {
      await this.updateAgentMemory(agentRole, {
        total_amendments: (memory.total_amendments || 0) + 1,
        active_amendment_count: (memory.active_amendment_count || 0) + 1,
      });
    }
  }

  /**
   * Update amendment evaluation
   * @param {string} amendmentId - Amendment ID
   * @param {Object} evaluation - Evaluation results
   * @returns {Promise<{data, error}>}
   */
  async updateAmendmentEvaluation(amendmentId, evaluation) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.amendments)
      .update({
        performance_after: evaluation.performance_after,
        tasks_evaluated: evaluation.tasks_evaluated,
        evaluation_status: evaluation.status,
        evaluated_at: new Date().toISOString(),
      })
      .eq('amendment_id', amendmentId)
      .select()
      .single();

    if (error) {
      console.error('[NEURAL-STACK] updateAmendmentEvaluation error:', error.message);
    }

    return { data, error };
  }

  /**
   * Revert an amendment
   * @param {string} amendmentId - Amendment ID
   * @param {string} reason - Revert reason
   * @returns {Promise<{data, error}>}
   */
  async revertAmendment(amendmentId, reason) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get amendment first
    const { data: amendment } = await this.supabase
      .from(TABLES.amendments)
      .select('agent_role')
      .eq('amendment_id', amendmentId)
      .single();

    const { data, error } = await this.supabase
      .from(TABLES.amendments)
      .update({
        is_active: false,
        reverted: true,
        reverted_at: new Date().toISOString(),
        revert_reason: reason,
        evaluation_status: 'reverted',
      })
      .eq('amendment_id', amendmentId)
      .select()
      .single();

    if (!error && amendment) {
      // Update agent memory
      const { data: memory } = await this.getAgentMemory(amendment.agent_role);
      if (memory) {
        await this.updateAgentMemory(amendment.agent_role, {
          reverted_amendments: (memory.reverted_amendments || 0) + 1,
          active_amendment_count: Math.max(0, (memory.active_amendment_count || 0) - 1),
        });
      }
    }

    return { data, error };
  }

  /**
   * Get active amendments for an agent
   * @param {string} agentRole - Agent role
   * @returns {Promise<{data, error}>}
   */
  async getActiveAmendments(agentRole) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.amendments)
      .select('*')
      .eq('agent_role', agentRole)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    return { data: data || [], error };
  }

  /**
   * Get amendment history for an agent
   * @param {string} agentRole - Agent role
   * @param {number} limit - Number of amendments
   * @returns {Promise<{data, error}>}
   */
  async getAmendmentHistory(agentRole, limit = 20) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.amendments)
      .select('*')
      .eq('agent_role', agentRole)
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  // ============================================================================
  // COS REVIEW OPERATIONS
  // ============================================================================

  /**
   * Create a new CoS review record
   * @param {Object} review - Review data
   * @returns {Promise<{data, error}>}
   */
  async createCosReview(review) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.cosReviews)
      .insert([{
        agent_role: review.agent_role,
        phase: review.phase || 'collect',
        tasks_analyzed: review.tasks_analyzed || 0,
        task_ids_analyzed: review.task_ids_analyzed || [],
        calculated_trend: review.calculated_trend,
        trend_slope: review.trend_slope,
        avg_variance_percent: review.avg_variance_percent,
        on_time_score: review.on_time_score,
        quality_score: review.quality_score,
        accuracy_score: review.accuracy_score,
        total_score: review.total_score,
        intervention_required: review.intervention_required || false,
        amendment_generated_id: review.amendment_generated_id,
        decision_notes: review.decision_notes,
        review_completed_at: review.review_completed_at,
      }])
      .select()
      .single();

    if (error) {
      console.error('[NEURAL-STACK] createCosReview error:', error.message);
    }

    return { data, error };
  }

  /**
   * Complete a CoS review
   * @param {string} reviewId - Review ID
   * @param {Object} results - Review results
   * @returns {Promise<{data, error}>}
   */
  async completeCosReview(reviewId, results) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.cosReviews)
      .update({
        phase: 'log',
        calculated_trend: results.trend,
        trend_slope: results.slope,
        avg_variance_percent: results.avg_variance_percent,
        on_time_score: results.on_time_score,
        quality_score: results.quality_score,
        accuracy_score: results.accuracy_score,
        total_score: results.total_score,
        intervention_required: results.intervention_required,
        amendment_generated_id: results.amendment_generated_id,
        decision_notes: results.decision_notes,
        review_completed_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get recent CoS reviews for an agent
   * @param {string} agentRole - Agent role
   * @param {number} limit - Number of reviews
   * @returns {Promise<{data, error}>}
   */
  async getCosReviewHistory(agentRole, limit = 10) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.cosReviews)
      .select('*')
      .eq('agent_role', agentRole)
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  // ============================================================================
  // PERFORMANCE SNAPSHOTS OPERATIONS
  // ============================================================================

  /**
   * Create a performance snapshot
   * @param {Object} snapshot - Snapshot data
   * @returns {Promise<{data, error}>}
   */
  async createPerformanceSnapshot(snapshot) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.performanceSnapshots)
      .insert([{
        agent_role: snapshot.agent_role,
        snapshot_type: snapshot.snapshot_type || 'after_task',
        avg_variance_percent: snapshot.avg_variance_percent,
        variance_trend_slope: snapshot.variance_trend_slope,
        on_time_delivery_rate: snapshot.on_time_delivery_rate,
        avg_cos_score: snapshot.avg_cos_score,
        deliverable_completion_rate: snapshot.deliverable_completion_rate,
        total_tasks_completed: snapshot.total_tasks_completed,
        tasks_since_last_snapshot: snapshot.tasks_since_last_snapshot,
        active_amendments: snapshot.active_amendments,
        triggered_by: snapshot.triggered_by,
      }])
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get performance snapshots for trend visualization
   * @param {string} agentRole - Agent role
   * @param {string} startDate - Start date (ISO string)
   * @param {string} endDate - End date (ISO string)
   * @returns {Promise<{data, error}>}
   */
  async getPerformanceSnapshots(agentRole, startDate = null, endDate = null) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from(TABLES.performanceSnapshots)
      .select('*')
      .eq('agent_role', agentRole)
      .order('snapshot_at', { ascending: true });

    if (startDate) {
      query = query.gte('snapshot_at', startDate);
    }
    if (endDate) {
      query = query.lte('snapshot_at', endDate);
    }

    const { data, error } = await query;

    return { data: data || [], error };
  }

  // ============================================================================
  // TREND ANALYSIS HELPERS
  // ============================================================================

  /**
   * Calculate linear regression slope
   * @param {number[]} x - X values
   * @param {number[]} y - Y values
   * @returns {{slope: number, intercept: number}}
   */
  linearRegression(x, y) {
    const n = x.length;
    if (n === 0) return { slope: 0, intercept: 0 };

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope: isNaN(slope) ? 0 : slope, intercept: isNaN(intercept) ? 0 : intercept };
  }

  /**
   * Calculate trend for an agent (Section 4.2)
   * @param {string} agentRole - Agent role
   * @returns {Promise<{direction: string, slope: number, tasksAnalyzed: number}>}
   */
  async calculateTrend(agentRole) {
    const { data: tasks } = await this.getRecentTasksForTrend(agentRole, 10);

    if (!tasks || tasks.length < 3) {
      return { direction: 'INSUFFICIENT_DATA', slope: 0, tasksAnalyzed: tasks?.length || 0 };
    }

    // Extract variance_percent values
    const x = tasks.map((_, i) => i);
    const y = tasks.map(t => t.variance_percent || 0);

    const { slope } = this.linearRegression(x, y);

    // Interpret slope (Section 4.2)
    let direction;
    if (slope < -0.05) {
      direction = 'IMPROVING';
    } else if (slope > 0.10) {
      direction = 'DECLINING';
    } else {
      direction = 'STABLE';
    }

    return { direction, slope, tasksAnalyzed: tasks.length };
  }

  /**
   * Get all agent memories with current status
   * @returns {Promise<{data, error}>}
   */
  async getAllAgentStatus() {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(TABLES.agentMemory)
      .select('agent_role, current_trend, avg_cos_score, avg_variance_percent, active_amendment_count, last_cos_review')
      .order('agent_role', { ascending: true });

    return { data: data || [], error };
  }
}

// Export singleton instance and class
const neuralStackClient = new NeuralStackClient();

export { NeuralStackClient, neuralStackClient, TABLES };
export default neuralStackClient;
