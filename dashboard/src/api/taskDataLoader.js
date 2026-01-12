/**
 * MONOLITH OS - Task Data Loader
 * Loads real task data from NotebookLM-extracted JSON files
 * Provides helper functions for API endpoints
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to task data directory
const TASKS_DIR = path.join(__dirname, '../data/tasks');

// Cache for loaded data
let taskDataCache = null;
let lastLoadTime = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Load all task JSON files from the data directory
 */
function loadAllTaskData() {
  const now = Date.now();

  // Return cached data if still valid
  if (taskDataCache && (now - lastLoadTime) < CACHE_TTL) {
    return taskDataCache;
  }

  const data = {
    roles: {},
    allTasks: [],
    tasksByRole: {},
    tasksByPriority: { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] },
    tasksByWorkflow: {},
    tasksByStatus: {},
    totalTasks: 0,
    priorityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  };

  try {
    // Check if directory exists
    if (!fs.existsSync(TASKS_DIR)) {
      console.warn('[TASK-LOADER] Tasks directory not found:', TASKS_DIR);
      return data;
    }

    const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const filePath = path.join(TASKS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const roleData = JSON.parse(content);

        const roleId = roleData.role_id;
        data.roles[roleId] = roleData;
        data.tasksByRole[roleId] = [];

        // Process each task
        if (roleData.tasks && Array.isArray(roleData.tasks)) {
          for (const task of roleData.tasks) {
            const normalizedTask = {
              id: task.id,
              content: task.content,
              priority: task.priority?.toUpperCase() || 'MEDIUM',
              status: task.status?.toLowerCase() || 'pending',
              due_date: task.due_date,
              workflow: task.workflow,
              notes: task.notes,
              created_at: task.created_at,
              assigned_role: roleId,
              role_name: roleData.role_name,
              role_abbr: roleData.role_abbr
            };

            data.allTasks.push(normalizedTask);
            data.tasksByRole[roleId].push(normalizedTask);

            // Index by priority
            const priority = normalizedTask.priority;
            if (data.tasksByPriority[priority]) {
              data.tasksByPriority[priority].push(normalizedTask);
              data.priorityCounts[priority]++;
            }

            // Index by workflow
            const workflow = normalizedTask.workflow || 'Unassigned';
            if (!data.tasksByWorkflow[workflow]) {
              data.tasksByWorkflow[workflow] = [];
            }
            data.tasksByWorkflow[workflow].push(normalizedTask);

            // Index by status
            const status = normalizedTask.status;
            if (!data.tasksByStatus[status]) {
              data.tasksByStatus[status] = [];
            }
            data.tasksByStatus[status].push(normalizedTask);

            data.totalTasks++;
          }
        }
      } catch (err) {
        console.error(`[TASK-LOADER] Error loading ${file}:`, err.message);
      }
    }

    // Sort all tasks by priority and date
    data.allTasks.sort((a, b) => {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (diff !== 0) return diff;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    taskDataCache = data;
    lastLoadTime = now;

    console.log(`[TASK-LOADER] Loaded ${data.totalTasks} tasks from ${Object.keys(data.roles).length} roles`);
  } catch (err) {
    console.error('[TASK-LOADER] Error loading task data:', err.message);
  }

  return data;
}

/**
 * Get pending tasks (status not completed)
 */
export function getPendingTasks(roleFilter = null) {
  const data = loadAllTaskData();
  const pendingStatuses = ['pending', 'in_progress', 'at_risk', 'blocked', 'ongoing', 'active', 'not_started', 'not_yet_set_up', 'not_yet_created', 'not_yet_established', 'deliverable', 'required_deliverable', 'active_ongoing', 'assigned', 'upcoming'];

  let tasks = data.allTasks.filter(t => pendingStatuses.includes(t.status));

  if (roleFilter) {
    tasks = tasks.filter(t => t.assigned_role === roleFilter.toLowerCase());
  }

  return tasks;
}

/**
 * Get completed tasks
 */
export function getCompletedTasks(roleFilter = null) {
  const data = loadAllTaskData();
  const completedStatuses = ['completed', 'deployed', 'done'];

  let tasks = data.allTasks.filter(t => completedStatuses.includes(t.status));

  if (roleFilter) {
    tasks = tasks.filter(t => t.assigned_role === roleFilter.toLowerCase());
  }

  return tasks;
}

/**
 * Get task counts per role (for notification badges)
 */
export function getTaskCountsByRole() {
  const data = loadAllTaskData();
  const counts = {};
  const pendingStatuses = ['pending', 'in_progress', 'at_risk', 'blocked', 'ongoing', 'active', 'not_started', 'not_yet_set_up', 'not_yet_created', 'not_yet_established', 'deliverable', 'required_deliverable', 'active_ongoing', 'assigned', 'upcoming'];

  for (const [roleId, tasks] of Object.entries(data.tasksByRole)) {
    counts[roleId] = tasks.filter(t => pendingStatuses.includes(t.status)).length;
  }

  return counts;
}

/**
 * Get priority summary counts
 */
export function getPrioritySummary() {
  const data = loadAllTaskData();
  const pendingStatuses = ['pending', 'in_progress', 'at_risk', 'blocked', 'ongoing', 'active', 'not_started', 'not_yet_set_up', 'not_yet_created', 'not_yet_established', 'deliverable', 'required_deliverable', 'active_ongoing', 'assigned', 'upcoming'];

  const summary = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  for (const task of data.allTasks) {
    if (pendingStatuses.includes(task.status) && summary.hasOwnProperty(task.priority)) {
      summary[task.priority]++;
    }
  }

  return summary;
}

/**
 * Get active workflows (unique workflows with in_progress tasks)
 */
export function getActiveWorkflows(roleFilter = null) {
  const data = loadAllTaskData();
  const activeStatuses = ['in_progress', 'at_risk', 'ongoing', 'active', 'deliverable', 'active_ongoing'];

  const workflowMap = {};

  for (const task of data.allTasks) {
    if (!activeStatuses.includes(task.status)) continue;
    if (roleFilter && task.assigned_role !== roleFilter.toLowerCase()) continue;

    const workflowName = task.workflow || 'Unassigned';

    if (!workflowMap[workflowName]) {
      workflowMap[workflowName] = {
        id: `wf-${workflowName.toLowerCase().replace(/\s+/g, '-')}`,
        name: workflowName,
        status: 'in_progress',
        owner_role: task.assigned_role,
        owner_name: task.role_name,
        tasks: [],
        started_at: task.created_at
      };
    }

    workflowMap[workflowName].tasks.push(task);
  }

  // Calculate progress for each workflow
  const workflows = Object.values(workflowMap).map(wf => {
    const allWorkflowTasks = data.tasksByWorkflow[wf.name] || [];
    const completedCount = allWorkflowTasks.filter(t =>
      ['completed', 'deployed', 'done'].includes(t.status)
    ).length;
    const totalCount = allWorkflowTasks.length;

    return {
      ...wf,
      progress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      total_tasks: totalCount,
      completed_tasks: completedCount,
      estimated_completion: calculateEstimatedCompletion(wf.started_at)
    };
  });

  return workflows.sort((a, b) => b.progress - a.progress);
}

/**
 * Calculate estimated completion date (based on start date and progress)
 */
function calculateEstimatedCompletion(startDate) {
  if (!startDate) return null;
  const start = new Date(startDate);
  start.setDate(start.getDate() + 14); // Default 2 weeks estimate
  return start.toISOString();
}

/**
 * Get all role data
 */
export function getAllRoles() {
  const data = loadAllTaskData();
  return data.roles;
}

/**
 * Get role by ID
 */
export function getRoleData(roleId) {
  const data = loadAllTaskData();
  return data.roles[roleId?.toLowerCase()];
}

/**
 * Get total task count
 */
export function getTotalTaskCount() {
  const data = loadAllTaskData();
  return data.totalTasks;
}

/**
 * Force cache refresh
 */
export function refreshCache() {
  taskDataCache = null;
  lastLoadTime = 0;
  return loadAllTaskData();
}

export default {
  getPendingTasks,
  getCompletedTasks,
  getTaskCountsByRole,
  getPrioritySummary,
  getActiveWorkflows,
  getAllRoles,
  getRoleData,
  getTotalTaskCount,
  refreshCache
};
