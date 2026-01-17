/**
 * MONOLITH OS - Database Service
 * Centralized database operations using Supabase
 * Provides CRUD for all tables with fallback support
 */

import { createClient } from '@supabase/supabase-js';

class DatabaseService {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.config = config;
    this.tablePrefix = '';

    this.initialize();
  }

  /**
   * Get table name with prefix
   */
  table(name) {
    return `${this.tablePrefix}${name}`;
  }

  /**
   * Initialize Supabase connection
   */
  initialize() {
    const supabaseUrl = this.config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = this.config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    this.tablePrefix = this.config.tablePrefix || process.env.SUPABASE_TABLE_PREFIX || '';

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
          },
        });
        this.isConnected = true;
        const prefixInfo = this.tablePrefix ? ` (table prefix: ${this.tablePrefix})` : '';
        console.log(`[DATABASE-SERVICE] Connected to Supabase${prefixInfo}`);
      } catch (error) {
        console.error('[DATABASE-SERVICE] Failed to connect to Supabase:', error.message);
        this.isConnected = false;
      }
    } else {
      console.warn('[DATABASE-SERVICE] No Supabase credentials found, running in offline mode');
      console.warn('[DATABASE-SERVICE] Expected: SUPABASE_URL and SUPABASE_ANON_KEY');
      this.isConnected = false;
    }
  }

  /**
   * Check if database is available
   */
  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ============================================================================
  // TASKS OPERATIONS
  // ============================================================================

  /**
   * Create a new task
   */
  async createTask(task) {
    if (!this.isAvailable()) {
      console.warn('[DATABASE-SERVICE] Database unavailable, task not persisted');
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('tasks'))
      .insert([{
        external_id: task.external_id || task.id,
        title: task.title || task.content,
        description: task.description,
        assigned_to: task.assigned_to || task.assigned_role,
        status: task.status || 'pending',
        priority: task.priority || 'MEDIUM',
        financial_amount: task.financial_amount,
        due_date: task.due_date,
        blocked_by: task.blocked_by || task.blockedBy,
        workflow_id: task.workflow_id,
        parent_task_id: task.parent_task_id || task.parentTaskId,
        metadata: task.metadata || {},
        retry_count: task.retry_count || task.retryCount || 0,
        priority_score: task.priority_score || task.priorityScore || 50,
      }])
      .select()
      .single();

    if (error) {
      console.error('[DATABASE-SERVICE] createTask error:', error.message);
    }

    return { data, error };
  }

  /**
   * Get a task by ID
   */
  async getTask(id) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Use external_id for string IDs, only use UUID id column for actual UUIDs
    const idColumn = this.isUUID(id) ? 'id' : 'external_id';

    const { data, error } = await this.supabase
      .from(this.table('tasks'))
      .select('*')
      .eq(idColumn, id)
      .single();

    return { data, error };
  }

  /**
   * Check if a string is a valid UUID
   */
  isUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return typeof str === 'string' && uuidRegex.test(str);
  }

  /**
   * Update a task
   */
  async updateTask(id, updates) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Convert camelCase to snake_case for common fields
    const dbUpdates = {};
    const fieldMap = {
      assignedTo: 'assigned_to',
      assignedRole: 'assigned_to',
      dueDate: 'due_date',
      blockedBy: 'blocked_by',
      workflowId: 'workflow_id',
      parentTaskId: 'parent_task_id',
      retryCount: 'retry_count',
      priorityScore: 'priority_score',
      financialAmount: 'financial_amount',
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = fieldMap[key] || key;
      dbUpdates[dbKey] = value;
    }

    // Use external_id for string IDs, only use UUID id column for actual UUIDs
    const idColumn = this.isUUID(id) ? 'id' : 'external_id';

    const result = await this.supabase
      .from(this.table('tasks'))
      .update(dbUpdates)
      .eq(idColumn, id)
      .select()
      .single();

    return result;
  }

  /**
   * Get tasks by role
   */
  async getTasksByRole(roleId, status = null) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from(this.table('tasks'))
      .select('*')
      .eq('assigned_to', roleId)
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks(limit = 100) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('tasks'))
      .select('*')
      .in('status', ['pending', 'in_progress'])
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    return { data: data || [], error };
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status, limit = 100) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('tasks'))
      .select('*')
      .eq('status', status)
      .order('priority_score', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  /**
   * Delete a task
   */
  async deleteTask(id) {
    if (!this.isAvailable()) {
      return { error: { message: 'Database unavailable' } };
    }

    const { error } = await this.supabase
      .from(this.table('tasks'))
      .delete()
      .or(`id.eq.${id},external_id.eq.${id}`);

    return { error };
  }

  // ============================================================================
  // DECISIONS OPERATIONS
  // ============================================================================

  /**
   * Log a decision
   */
  async logDecision(decision) {
    if (!this.isAvailable()) {
      console.warn('[DATABASE-SERVICE] Database unavailable, decision not persisted');
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('decisions'))
      .insert([{
        task_id: decision.task_id || decision.taskId,
        role_id: decision.role_id || decision.role,
        role_name: decision.role_name || decision.roleName,
        decision: decision.decision,
        action: decision.action,
        reasoning: decision.reasoning,
        escalated: decision.escalated || false,
        escalate_reason: decision.escalate_reason || decision.escalateReason,
        handoff: decision.handoff,
        model_used: decision.model_used || decision.model,
        tokens: decision.tokens || 0,
        latency_ms: decision.latency_ms || decision.latencyMs || 0,
        cost: decision.cost || 0,
        confidence: decision.confidence,
        metadata: decision.metadata || {},
        timestamp: decision.timestamp || new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[DATABASE-SERVICE] logDecision error:', error.message);
    }

    return { data, error };
  }

  /**
   * Get decisions by role
   */
  async getDecisionsByRole(roleId, limit = 50) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('decisions'))
      .select('*')
      .eq('role_id', roleId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  /**
   * Get recent decisions
   */
  async getRecentDecisions(limit = 50, filters = {}) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from(this.table('decisions'))
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (filters.role_id || filters.role) {
      query = query.eq('role_id', filters.role_id || filters.role);
    }
    if (filters.task_id || filters.taskId) {
      query = query.eq('task_id', filters.task_id || filters.taskId);
    }
    if (filters.escalated !== undefined) {
      query = query.eq('escalated', filters.escalated);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  }

  /**
   * Get decisions by task
   */
  async getDecisionsByTask(taskId) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('decisions'))
      .select('*')
      .eq('task_id', taskId)
      .order('timestamp', { ascending: false });

    return { data: data || [], error };
  }

  // ============================================================================
  // ESCALATIONS OPERATIONS
  // ============================================================================

  /**
   * Create an escalation
   */
  async createEscalation(escalation) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('escalations'))
      .insert([{
        task_id: escalation.task_id || escalation.taskId,
        decision_id: escalation.decision_id || escalation.decisionId,
        from_role: escalation.from_role || escalation.fromRole || escalation.role,
        reason: escalation.reason,
        recommendation: escalation.recommendation,
        priority: escalation.priority || 'HIGH',
        status: 'pending',
        context: escalation.context || {},
      }])
      .select()
      .single();

    if (error) {
      console.error('[DATABASE-SERVICE] createEscalation error:', error.message);
    }

    return { data, error };
  }

  /**
   * Get pending escalations
   */
  async getPendingEscalations(limit = 50) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('escalations'))
      .select(`
        *,
        tasks (id, title, description, priority)
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    return { data: data || [], error };
  }

  /**
   * Resolve an escalation
   */
  async resolveEscalation(id, resolution, resolvedBy = 'CEO') {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('escalations'))
      .update({
        status: 'resolved',
        resolution,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get escalations by role
   */
  async getEscalationsByRole(roleId, limit = 50) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('escalations'))
      .select('*')
      .eq('from_role', roleId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  // ============================================================================
  // AGENT LEARNINGS OPERATIONS
  // ============================================================================

  /**
   * Save a learning
   */
  async saveLearning(learning) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('agent_learnings'))
      .insert([{
        role_id: learning.role_id || learning.roleId,
        task_type: learning.task_type || learning.taskType,
        context: learning.context || {},
        outcome: learning.outcome || {},
        feedback: learning.feedback,
        success: learning.success,
        success_rate: learning.success_rate || learning.successRate,
        total_count: learning.total_count || learning.totalCount || 1,
        success_count: learning.success_count || learning.successCount || 0,
        model_used: learning.model_used || learning.modelUsed,
        metadata: learning.metadata || {},
      }])
      .select()
      .single();

    if (error) {
      console.error('[DATABASE-SERVICE] saveLearning error:', error.message);
    }

    return { data, error };
  }

  /**
   * Get learnings by role
   */
  async getLearningsByRole(roleId, taskType = null, limit = 100) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from(this.table('agent_learnings'))
      .select('*')
      .eq('role_id', roleId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (taskType) {
      query = query.eq('task_type', taskType);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  }

  /**
   * Update learning stats (upsert pattern)
   */
  async updateLearningStats(roleId, taskType, success) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // First, try to get existing learning
    const { data: existing } = await this.supabase
      .from(this.table('agent_learnings'))
      .select('*')
      .eq('role_id', roleId)
      .eq('task_type', taskType)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      // Update existing
      const newTotal = (existing.total_count || 0) + 1;
      const newSuccessCount = (existing.success_count || 0) + (success ? 1 : 0);
      const newSuccessRate = newSuccessCount / newTotal;

      return await this.supabase
        .from(this.table('agent_learnings'))
        .update({
          total_count: newTotal,
          success_count: newSuccessCount,
          success_rate: newSuccessRate,
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Create new
      return await this.saveLearning({
        role_id: roleId,
        task_type: taskType,
        context: {},
        outcome: { success },
        success,
        success_rate: success ? 1 : 0,
        total_count: 1,
        success_count: success ? 1 : 0,
      });
    }
  }

  /**
   * Get aggregated learning stats
   */
  async getLearningStats(roleId = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from(this.table('agent_learnings'))
      .select('role_id, task_type, success_rate, total_count, success_count');

    if (roleId) {
      query = query.eq('role_id', roleId);
    }

    const { data, error } = await query;

    // Aggregate by role and task type
    const stats = {};
    if (data) {
      for (const row of data) {
        const key = `${row.role_id}_${row.task_type}`;
        if (!stats[key]) {
          stats[key] = {
            role_id: row.role_id,
            task_type: row.task_type,
            total: 0,
            success: 0,
          };
        }
        stats[key].total += row.total_count || 0;
        stats[key].success += row.success_count || 0;
      }

      // Calculate success rates
      for (const key of Object.keys(stats)) {
        stats[key].successRate = stats[key].total > 0
          ? stats[key].success / stats[key].total
          : 0;
      }
    }

    return { data: stats, error };
  }

  // ============================================================================
  // WORKFLOWS OPERATIONS
  // ============================================================================

  /**
   * Create a workflow
   */
  async createWorkflow(workflow) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('workflows'))
      .insert([{
        workflow_type: workflow.workflow_type || workflow.workflowType || workflow.type,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status || 'pending',
        context: workflow.context || {},
        current_step: workflow.current_step || workflow.currentStep || 0,
        total_steps: workflow.total_steps || workflow.totalSteps,
        trigger_type: workflow.trigger_type || workflow.triggerType,
        triggered_by: workflow.triggered_by || workflow.triggeredBy,
        metadata: workflow.metadata || {},
      }])
      .select()
      .single();

    if (error) {
      console.error('[DATABASE-SERVICE] createWorkflow error:', error.message);
    }

    return { data, error };
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(id, updates) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Convert camelCase to snake_case
    const dbUpdates = {};
    const fieldMap = {
      workflowType: 'workflow_type',
      currentStep: 'current_step',
      totalSteps: 'total_steps',
      triggerType: 'trigger_type',
      triggeredBy: 'triggered_by',
      completedAt: 'completed_at',
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = fieldMap[key] || key;
      dbUpdates[dbKey] = value;
    }

    const { data, error } = await this.supabase
      .from(this.table('workflows'))
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get active workflows
   */
  async getActiveWorkflows(limit = 50) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('workflows'))
      .select(`
        *,
        workflow_steps (*)
      `)
      .in('status', ['pending', 'active', 'paused'])
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(id) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('workflows'))
      .select(`
        *,
        workflow_steps (*)
      `)
      .eq('id', id)
      .single();

    return { data, error };
  }

  /**
   * Create a workflow step
   */
  async createWorkflowStep(step) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('workflow_steps'))
      .insert([{
        workflow_id: step.workflow_id || step.workflowId,
        step_number: step.step_number || step.stepNumber,
        role_id: step.role_id || step.roleId,
        task_description: step.task_description || step.taskDescription || step.description,
        status: step.status || 'pending',
        depends_on: step.depends_on || step.dependsOn,
        metadata: step.metadata || {},
      }])
      .select()
      .single();

    return { data, error };
  }

  /**
   * Update a workflow step
   */
  async updateWorkflowStep(id, updates) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const dbUpdates = {};
    const fieldMap = {
      stepNumber: 'step_number',
      roleId: 'role_id',
      taskDescription: 'task_description',
      dependsOn: 'depends_on',
      startedAt: 'started_at',
      completedAt: 'completed_at',
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = fieldMap[key] || key;
      dbUpdates[dbKey] = value;
    }

    const { data, error } = await this.supabase
      .from(this.table('workflow_steps'))
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  }

  // ============================================================================
  // API KEYS OPERATIONS
  // ============================================================================

  /**
   * Create an API key (stores hash only)
   */
  async createApiKey(apiKey) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('api_keys'))
      .insert([{
        key_hash: apiKey.key_hash || apiKey.keyHash,
        key_prefix: apiKey.key_prefix || apiKey.keyPrefix,
        name: apiKey.name,
        description: apiKey.description,
        permissions: apiKey.permissions || ['read'],
        rate_limit: apiKey.rate_limit || apiKey.rateLimit || 1000,
        rate_limit_window: apiKey.rate_limit_window || apiKey.rateLimitWindow || 3600,
        is_active: apiKey.is_active !== false,
        expires_at: apiKey.expires_at || apiKey.expiresAt,
        created_by: apiKey.created_by || apiKey.createdBy,
      }])
      .select()
      .single();

    return { data, error };
  }

  /**
   * Validate an API key
   */
  async validateApiKey(keyHash) {
    if (!this.isAvailable()) {
      return { valid: false, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('api_keys'))
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return { valid: false, apiKey: null, error };
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { valid: false, apiKey: null, error: { message: 'API key expired' } };
    }

    // Update last used
    await this.supabase
      .from(this.table('api_keys'))
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);

    return { valid: true, apiKey: data, error: null };
  }

  // ============================================================================
  // RATE LIMITS OPERATIONS
  // ============================================================================

  /**
   * Check and consume rate limit
   */
  async checkRateLimit(identifier, endpoint, tokensRequired = 1) {
    if (!this.isAvailable()) {
      return { allowed: true, remaining: Infinity, error: { message: 'Database unavailable' } };
    }

    // Get or create rate limit entry
    let { data: limit } = await this.supabase
      .from(this.table('rate_limits'))
      .select('*')
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
      .single();

    const now = new Date();

    if (!limit) {
      // Create new rate limit entry
      const { data: newLimit, error } = await this.supabase
        .from(this.table('rate_limits'))
        .insert([{
          identifier,
          endpoint,
          tokens: 100 - tokensRequired,
          max_tokens: 100,
          refill_rate: 10,
          last_refill: now.toISOString(),
        }])
        .select()
        .single();

      if (error) {
        return { allowed: true, remaining: 99, error };
      }

      return { allowed: true, remaining: newLimit.tokens, error: null };
    }

    // Calculate token refill
    const lastRefill = new Date(limit.last_refill);
    const secondsElapsed = (now.getTime() - lastRefill.getTime()) / 1000;
    const tokensToAdd = Math.floor(secondsElapsed * limit.refill_rate);
    let currentTokens = Math.min(limit.max_tokens, limit.tokens + tokensToAdd);

    // Check if allowed
    if (currentTokens < tokensRequired) {
      return {
        allowed: false,
        remaining: currentTokens,
        retryAfter: Math.ceil((tokensRequired - currentTokens) / limit.refill_rate),
        error: null
      };
    }

    // Consume tokens
    currentTokens -= tokensRequired;

    await this.supabase
      .from(this.table('rate_limits'))
      .update({
        tokens: currentTokens,
        last_refill: now.toISOString(),
      })
      .eq('id', limit.id);

    return { allowed: true, remaining: currentTokens, error: null };
  }

  // ============================================================================
  // SESSIONS OPERATIONS
  // ============================================================================

  /**
   * Create a session
   */
  async createSession(session) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const expiresAt = session.expires_at || session.expiresAt ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours default

    const { data, error } = await this.supabase
      .from(this.table('sessions'))
      .insert([{
        session_token: session.session_token || session.sessionToken || session.token,
        user_id: session.user_id || session.userId,
        data: session.data || {},
        ip_address: session.ip_address || session.ipAddress,
        user_agent: session.user_agent || session.userAgent,
        expires_at: expiresAt,
      }])
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get session by token
   */
  async getSession(token) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('sessions'))
      .select('*')
      .eq('session_token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    return { data, error };
  }

  /**
   * Update session
   */
  async updateSession(token, updates) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('sessions'))
      .update(updates)
      .eq('session_token', token)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Delete session
   */
  async deleteSession(token) {
    if (!this.isAvailable()) {
      return { error: { message: 'Database unavailable' } };
    }

    const { error } = await this.supabase
      .from(this.table('sessions'))
      .delete()
      .eq('session_token', token);

    return { error };
  }

  /**
   * Clean expired sessions
   */
  async cleanExpiredSessions() {
    if (!this.isAvailable()) {
      return { count: 0, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from(this.table('sessions'))
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    return { count: data?.length || 0, error };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.isAvailable()) {
      return { healthy: false, error: 'Not connected to database' };
    }

    try {
      const { data, error } = await this.supabase
        .from(this.table('tasks'))
        .select('count')
        .limit(1);

      if (error) {
        return { healthy: false, error: error.message };
      }

      return { healthy: true, error: null };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Get database stats
   */
  async getStats() {
    if (!this.isAvailable()) {
      return { error: { message: 'Database unavailable' } };
    }

    const tableNames = ['tasks', 'decisions', 'escalations', 'agent_learnings', 'workflows'];
    const stats = {};

    for (const tableName of tableNames) {
      const { count, error } = await this.supabase
        .from(this.table(tableName))
        .select('*', { count: 'exact', head: true });

      stats[tableName] = error ? 'error' : count;
    }

    return { data: stats, error: null };
  }
}

// Export singleton instance
const databaseService = new DatabaseService();

export { DatabaseService };
export default databaseService;
