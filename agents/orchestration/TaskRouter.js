/**
 * MONOLITH OS - Task Router
 * Phase 7: Task Orchestration Engine
 *
 * Routes incoming tasks to appropriate agents based on keywords, tags, and team.
 * Provides capacity checking and team lead fallback routing.
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_ACTIVE_PER_AGENT = 1;
const MAX_QUEUED_PER_AGENT = 10;

// ============================================================================
// DEFAULT ROUTING RULES
// ============================================================================

const DEFAULT_ROUTING_RULES = [
  // Tech Team
  { match: { keywords: ['frontend', 'react', 'css', 'landing page', 'website'] }, assign_to: 'web_dev_lead' },
  { match: { keywords: ['mobile', 'ios', 'android', 'app'] }, assign_to: 'app_dev_lead' },
  { match: { keywords: ['deploy', 'ci/cd', 'pipeline', 'docker', 'railway', 'vercel'] }, assign_to: 'devops' },
  { match: { keywords: ['test', 'qa', 'bug', 'regression'] }, assign_to: 'qa' },
  { match: { team: 'technology' }, assign_to: 'cto' },

  // Marketing Team
  { match: { keywords: ['content', 'blog', 'article', 'copy'] }, assign_to: 'content_strategy_lead' },
  { match: { keywords: ['social', 'twitter', 'instagram', 'linkedin'] }, assign_to: 'growth_analytics_lead' },
  { match: { team: 'marketing' }, assign_to: 'cmo' },

  // Product Team
  { match: { keywords: ['ux', 'user research', 'usability', 'wireframe'] }, assign_to: 'ux_research_lead' },
  { match: { keywords: ['metrics', 'analytics', 'dashboard', 'kpi'] }, assign_to: 'product_analytics_lead' },
  { match: { keywords: ['feature', 'spec', 'requirements', 'prd'] }, assign_to: 'feature_spec_lead' },
  { match: { team: 'product' }, assign_to: 'cpo' },

  // Operations Team
  { match: { keywords: ['vendor', 'contract', 'subscription'] }, assign_to: 'vendor_management_lead' },
  { match: { keywords: ['process', 'automation', 'workflow', 'sop'] }, assign_to: 'process_automation_lead' },
  { match: { team: 'operations' }, assign_to: 'coo' },

  // Finance Team
  { match: { keywords: ['expense', 'receipt', 'cost'] }, assign_to: 'expense_tracking_lead' },
  { match: { keywords: ['revenue', 'forecast', 'budget'] }, assign_to: 'revenue_analytics_lead' },
  { match: { team: 'finance' }, assign_to: 'cfo' },

  // People Team
  { match: { keywords: ['hire', 'job', 'candidate', 'recruit'] }, assign_to: 'hiring_lead' },
  { match: { keywords: ['compliance', 'policy', 'legal'] }, assign_to: 'compliance_lead' },
  { match: { team: 'people' }, assign_to: 'chro' },
];

// ============================================================================
// TEAM LEAD MAPPING
// ============================================================================

const TEAM_LEADS = {
  technology: 'cto',
  tech: 'cto',
  marketing: 'cmo',
  product: 'cpo',
  operations: 'coo',
  finance: 'cfo',
  people: 'chro',
};

// ============================================================================
// AGENT TEAM MAPPING
// ============================================================================

const AGENT_TO_TEAM = {
  // Tech Team
  web_dev_lead: 'technology',
  app_dev_lead: 'technology',
  devops: 'technology',
  devops_lead: 'technology',
  qa: 'technology',
  qa_lead: 'technology',
  infrastructure_lead: 'technology',
  cto: 'technology',

  // Marketing Team
  content_strategy_lead: 'marketing',
  growth_analytics_lead: 'marketing',
  cmo: 'marketing',

  // Product Team
  ux_research_lead: 'product',
  product_analytics_lead: 'product',
  feature_spec_lead: 'product',
  cpo: 'product',

  // Operations Team
  vendor_management_lead: 'operations',
  process_automation_lead: 'operations',
  coo: 'operations',

  // Finance Team
  expense_tracking_lead: 'finance',
  revenue_analytics_lead: 'finance',
  cfo: 'finance',

  // People Team
  hiring_lead: 'people',
  compliance_lead: 'people',
  chro: 'people',
};

// ============================================================================
// TASK ROUTER CLASS
// ============================================================================

class TaskRouter {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.routingRules = config.routingRules || DEFAULT_ROUTING_RULES;
    this.tablePrefix = config.tablePrefix || process.env.SUPABASE_TABLE_PREFIX || '';
    this.taskIdCounter = 0;
    this.lastTaskDate = null;

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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
          },
        });
        this.isConnected = true;
        console.log('[TASK-ROUTER] Connected to Supabase');
      } catch (error) {
        console.error('[TASK-ROUTER] Failed to connect to Supabase:', error.message);
        this.isConnected = false;
      }
    } else {
      console.warn('[TASK-ROUTER] No Supabase credentials found, running in offline mode');
      this.isConnected = false;
    }
  }

  /**
   * Check if database is available
   */
  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ==========================================================================
  // MAIN ROUTING FUNCTION
  // ==========================================================================

  /**
   * Route a task to the appropriate agent
   * @param {Object} task - The task to route
   * @returns {Object} - Routing result with assigned agent and task ID
   */
  async routeTask(task) {
    console.log(`[TASK-ROUTER] Routing task: ${task.title || task.content || 'Untitled'}`);

    // Generate task ID if not present
    if (!task.id) {
      task.id = this.generateTaskId();
    }

    // Find matching routing rule
    let assignedAgent = null;
    let matchedRule = null;

    for (const rule of this.routingRules) {
      if (this.matchesRule(task, rule)) {
        assignedAgent = rule.assign_to;
        matchedRule = rule;
        console.log(`[TASK-ROUTER] Matched rule: ${JSON.stringify(rule.match)} -> ${assignedAgent}`);
        break;
      }
    }

    // No rule matched - use default based on team or escalate to CoS
    if (!assignedAgent) {
      if (task.team) {
        assignedAgent = this.getTeamLead(task.team);
        console.log(`[TASK-ROUTER] No keyword match, using team lead: ${assignedAgent}`);
      } else {
        assignedAgent = 'cos'; // Chief of Staff handles unroutable tasks
        console.log('[TASK-ROUTER] No match found, routing to Chief of Staff');
      }
    }

    // Check agent capacity
    const capacity = await this.getAgentCapacity(assignedAgent);
    const isOverloaded = capacity.active >= MAX_ACTIVE_PER_AGENT &&
                         capacity.queued >= MAX_QUEUED_PER_AGENT;

    // Fall back to team lead if agent is overloaded
    if (isOverloaded && !this.isTeamLead(assignedAgent)) {
      const teamId = AGENT_TO_TEAM[assignedAgent];
      const teamLead = this.getTeamLead(teamId);

      if (teamLead && teamLead !== assignedAgent) {
        const teamLeadCapacity = await this.getAgentCapacity(teamLead);
        const teamLeadOverloaded = teamLeadCapacity.active >= MAX_ACTIVE_PER_AGENT &&
                                   teamLeadCapacity.queued >= MAX_QUEUED_PER_AGENT;

        if (!teamLeadOverloaded) {
          console.log(`[TASK-ROUTER] Agent ${assignedAgent} overloaded, falling back to team lead: ${teamLead}`);
          assignedAgent = teamLead;
        } else {
          console.log(`[TASK-ROUTER] Team lead ${teamLead} also overloaded, queueing with original agent`);
        }
      }
    }

    // Build routing result
    const result = {
      success: true,
      task_id: task.id,
      assigned_to: assignedAgent,
      original_assignment: matchedRule?.assign_to || null,
      matched_rule: matchedRule ? matchedRule.match : null,
      capacity: {
        active: capacity.active,
        queued: capacity.queued,
        was_overloaded: isOverloaded,
      },
      timestamp: new Date().toISOString(),
    };

    // Persist routing decision to database
    if (this.isAvailable()) {
      await this.persistRoutingDecision(task, result);
    }

    console.log(`[TASK-ROUTER] Routed task ${task.id} to ${assignedAgent}`);
    return result;
  }

  // ==========================================================================
  // RULE MATCHING
  // ==========================================================================

  /**
   * Check if a task matches a routing rule
   * @param {Object} task - The task to check
   * @param {Object} rule - The routing rule
   * @returns {boolean} - True if task matches the rule
   */
  matchesRule(task, rule) {
    const match = rule.match;

    // Match by keywords
    if (match.keywords && match.keywords.length > 0) {
      const taskText = this.getTaskSearchText(task).toLowerCase();
      const keywordMatch = match.keywords.some(keyword =>
        taskText.includes(keyword.toLowerCase())
      );
      if (keywordMatch) {
        return true;
      }
    }

    // Match by tags
    if (match.tags && match.tags.length > 0) {
      const taskTags = task.tags || [];
      const tagMatch = match.tags.some(tag =>
        taskTags.some(taskTag => taskTag.toLowerCase() === tag.toLowerCase())
      );
      if (tagMatch) {
        return true;
      }
    }

    // Match by team
    if (match.team) {
      const taskTeam = task.team || task.team_id;
      if (taskTeam && taskTeam.toLowerCase() === match.team.toLowerCase()) {
        return true;
      }
    }

    // Match by priority
    if (match.priority) {
      if (task.priority && task.priority.toUpperCase() === match.priority.toUpperCase()) {
        return true;
      }
    }

    // Match by explicit agent assignment
    if (match.assigned_to) {
      if (task.assigned_to === match.assigned_to || task.assigned_role === match.assigned_to) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get searchable text from a task
   * @param {Object} task - The task object
   * @returns {string} - Combined searchable text
   */
  getTaskSearchText(task) {
    const parts = [
      task.title || '',
      task.content || '',
      task.description || '',
      ...(task.keywords || []),
      ...(task.tags || []),
    ];
    return parts.join(' ');
  }

  // ==========================================================================
  // CAPACITY MANAGEMENT
  // ==========================================================================

  /**
   * Get agent's current queue depth
   * @param {string} agentRole - The agent role to check
   * @returns {Object} - Capacity info with active and queued counts
   */
  async getAgentCapacity(agentRole) {
    if (!this.isAvailable()) {
      console.warn('[TASK-ROUTER] Database unavailable, returning default capacity');
      return { active: 0, queued: 0, total: 0 };
    }

    try {
      // Try to query monolith_task_queue first (Phase 7 table)
      let result = await this.supabase
        .from(this.table('monolith_task_queue'))
        .select('status', { count: 'exact' })
        .eq('assigned_to', agentRole)
        .in('status', ['pending', 'in_progress', 'queued']);

      // If monolith_task_queue doesn't exist, fall back to tasks table
      if (result.error && result.error.code === '42P01') {
        console.log('[TASK-ROUTER] monolith_task_queue not found, falling back to tasks table');
        result = await this.supabase
          .from(this.table('tasks'))
          .select('status', { count: 'exact' })
          .eq('assigned_to', agentRole)
          .in('status', ['pending', 'in_progress']);
      }

      if (result.error) {
        console.error('[TASK-ROUTER] Error fetching capacity:', result.error.message);
        return { active: 0, queued: 0, total: 0 };
      }

      const tasks = result.data || [];
      const active = tasks.filter(t => t.status === 'in_progress').length;
      const queued = tasks.filter(t => t.status === 'pending' || t.status === 'queued').length;

      return {
        active,
        queued,
        total: active + queued,
      };
    } catch (error) {
      console.error('[TASK-ROUTER] Error checking capacity:', error.message);
      return { active: 0, queued: 0, total: 0 };
    }
  }

  /**
   * Check if agent has capacity for new tasks
   * @param {string} agentRole - The agent role to check
   * @returns {boolean} - True if agent has capacity
   */
  async hasCapacity(agentRole) {
    const capacity = await this.getAgentCapacity(agentRole);
    return capacity.active < MAX_ACTIVE_PER_AGENT || capacity.queued < MAX_QUEUED_PER_AGENT;
  }

  // ==========================================================================
  // TEAM LEAD MANAGEMENT
  // ==========================================================================

  /**
   * Get the team lead for a given team
   * @param {string} teamId - The team identifier
   * @returns {string|null} - The team lead role or null
   */
  getTeamLead(teamId) {
    if (!teamId) return null;
    const normalizedTeamId = teamId.toLowerCase();
    return TEAM_LEADS[normalizedTeamId] || null;
  }

  /**
   * Check if an agent is a team lead
   * @param {string} agentRole - The agent role to check
   * @returns {boolean} - True if agent is a team lead
   */
  isTeamLead(agentRole) {
    return Object.values(TEAM_LEADS).includes(agentRole);
  }

  /**
   * Get the team for an agent
   * @param {string} agentRole - The agent role
   * @returns {string|null} - The team identifier or null
   */
  getAgentTeam(agentRole) {
    return AGENT_TO_TEAM[agentRole] || null;
  }

  // ==========================================================================
  // TASK ID GENERATION
  // ==========================================================================

  /**
   * Generate a human-readable task ID
   * Format: TASK-YYYY-MMDD-NNN
   * @returns {string} - Generated task ID
   */
  generateTaskId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}${day}`;

    // Reset counter if date changed
    const currentDate = `${year}${month}${day}`;
    if (this.lastTaskDate !== currentDate) {
      this.lastTaskDate = currentDate;
      this.taskIdCounter = 0;
    }

    // Increment counter
    this.taskIdCounter++;
    const counter = String(this.taskIdCounter).padStart(3, '0');

    return `TASK-${dateStr}-${counter}`;
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Persist routing decision to database
   * @param {Object} task - The routed task
   * @param {Object} routingResult - The routing result
   */
  async persistRoutingDecision(task, routingResult) {
    if (!this.isAvailable()) return;

    try {
      // Try to update monolith_task_queue first
      let result = await this.supabase
        .from(this.table('monolith_task_queue'))
        .upsert({
          external_id: task.id,
          title: task.title || task.content || 'Untitled Task',
          description: task.description || '',
          assigned_to: routingResult.assigned_to,
          status: 'pending',
          priority: task.priority || 'MEDIUM',
          team_id: AGENT_TO_TEAM[routingResult.assigned_to] || null,
          routing_metadata: {
            matched_rule: routingResult.matched_rule,
            original_assignment: routingResult.original_assignment,
            capacity_at_routing: routingResult.capacity,
            routed_at: routingResult.timestamp,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'external_id',
        });

      // If monolith_task_queue doesn't exist, fall back to tasks table
      if (result.error && result.error.code === '42P01') {
        result = await this.supabase
          .from(this.table('tasks'))
          .upsert({
            external_id: task.id,
            title: task.title || task.content || 'Untitled Task',
            description: task.description || '',
            assigned_to: routingResult.assigned_to,
            status: 'pending',
            priority: task.priority || 'MEDIUM',
            metadata: {
              routing: {
                matched_rule: routingResult.matched_rule,
                original_assignment: routingResult.original_assignment,
                capacity_at_routing: routingResult.capacity,
                routed_at: routingResult.timestamp,
              },
            },
          }, {
            onConflict: 'external_id',
          });
      }

      if (result.error) {
        console.error('[TASK-ROUTER] Error persisting routing decision:', result.error.message);
      }
    } catch (error) {
      console.error('[TASK-ROUTER] Error persisting routing decision:', error.message);
    }
  }

  // ==========================================================================
  // ROUTING RULE MANAGEMENT
  // ==========================================================================

  /**
   * Add a new routing rule
   * @param {Object} rule - The routing rule to add
   * @param {number} priority - Optional priority (lower = higher priority)
   */
  addRoutingRule(rule, priority = null) {
    if (priority !== null && priority >= 0 && priority < this.routingRules.length) {
      this.routingRules.splice(priority, 0, rule);
    } else {
      this.routingRules.push(rule);
    }
    console.log(`[TASK-ROUTER] Added routing rule: ${JSON.stringify(rule.match)} -> ${rule.assign_to}`);
  }

  /**
   * Remove a routing rule by index
   * @param {number} index - The index of the rule to remove
   */
  removeRoutingRule(index) {
    if (index >= 0 && index < this.routingRules.length) {
      const removed = this.routingRules.splice(index, 1)[0];
      console.log(`[TASK-ROUTER] Removed routing rule: ${JSON.stringify(removed.match)} -> ${removed.assign_to}`);
    }
  }

  /**
   * Get all routing rules
   * @returns {Array} - Current routing rules
   */
  getRoutingRules() {
    return [...this.routingRules];
  }

  // ==========================================================================
  // BULK OPERATIONS
  // ==========================================================================

  /**
   * Route multiple tasks in batch
   * @param {Array} tasks - Array of tasks to route
   * @returns {Array} - Array of routing results
   */
  async routeTasks(tasks) {
    const results = [];
    for (const task of tasks) {
      const result = await this.routeTask(task);
      results.push(result);
    }
    return results;
  }

  /**
   * Get suggested agent for a task without actually routing
   * @param {Object} task - The task to analyze
   * @returns {Object} - Suggested routing without persistence
   */
  async suggestRouting(task) {
    // Find matching rule
    for (const rule of this.routingRules) {
      if (this.matchesRule(task, rule)) {
        const capacity = await this.getAgentCapacity(rule.assign_to);
        return {
          suggested_agent: rule.assign_to,
          matched_rule: rule.match,
          capacity: capacity,
          confidence: 'high',
        };
      }
    }

    // No direct match - suggest team lead if team is known
    if (task.team) {
      const teamLead = this.getTeamLead(task.team);
      if (teamLead) {
        const capacity = await this.getAgentCapacity(teamLead);
        return {
          suggested_agent: teamLead,
          matched_rule: { team: task.team },
          capacity: capacity,
          confidence: 'medium',
        };
      }
    }

    // Default to CoS
    const cosCapacity = await this.getAgentCapacity('cos');
    return {
      suggested_agent: 'cos',
      matched_rule: null,
      capacity: cosCapacity,
      confidence: 'low',
    };
  }

  // ==========================================================================
  // STATUS AND DIAGNOSTICS
  // ==========================================================================

  /**
   * Get router status and statistics
   * @returns {Object} - Router status info
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      rulesCount: this.routingRules.length,
      lastTaskDate: this.lastTaskDate,
      taskIdCounter: this.taskIdCounter,
      tablePrefix: this.tablePrefix,
    };
  }

  /**
   * Get capacity summary for all known agents
   * @returns {Object} - Capacity summary by agent
   */
  async getAllAgentCapacities() {
    const capacities = {};
    const agents = new Set([
      ...Object.keys(AGENT_TO_TEAM),
      ...Object.values(TEAM_LEADS),
    ]);

    for (const agent of agents) {
      capacities[agent] = await this.getAgentCapacity(agent);
    }

    return capacities;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  TaskRouter,
  DEFAULT_ROUTING_RULES,
  TEAM_LEADS,
  AGENT_TO_TEAM,
  MAX_ACTIVE_PER_AGENT,
  MAX_QUEUED_PER_AGENT,
};

export default TaskRouter;
