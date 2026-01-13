/**
 * MONOLITH OS - Task Data Writer
 * Provides atomic write operations for task JSON files
 * Uses temp file + rename pattern for data safety
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { refreshCache } from './taskDataLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to task data directory
const TASKS_DIR = path.join(__dirname, '../data/tasks');

/**
 * Find a task by its ID across all role JSON files
 * @param {string} taskId - The task ID to find
 * @returns {Promise<{task: object, roleId: string, filePath: string, roleData: object}|null>}
 */
export async function findTaskById(taskId) {
  try {
    const files = await fs.readdir(TASKS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = path.join(TASKS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const roleData = JSON.parse(content);

      if (roleData.tasks && Array.isArray(roleData.tasks)) {
        const task = roleData.tasks.find(t => t.id === taskId);
        if (task) {
          return {
            task,
            roleId: roleData.role_id,
            filePath,
            roleData
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[TASK-WRITER] Error finding task:', error.message);
    throw error;
  }
}

/**
 * Atomically write role data to JSON file
 * Uses temp file + rename pattern to prevent data corruption
 * @param {string} filePath - Path to the JSON file
 * @param {object} roleData - The role data object to write
 */
async function atomicWriteJson(filePath, roleData) {
  const tempPath = `${filePath}.tmp.${Date.now()}`;

  try {
    // Write to temp file first
    const content = JSON.stringify(roleData, null, 2);
    await fs.writeFile(tempPath, content, 'utf-8');

    // Atomic rename
    await fs.rename(tempPath, filePath);

    console.log(`[TASK-WRITER] Atomic write successful: ${path.basename(filePath)}`);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Update a task with new data
 * @param {string} roleId - The role ID (e.g., 'ceo', 'cto')
 * @param {string} taskId - The task ID to update
 * @param {object} updates - Object containing fields to update
 * @returns {Promise<{success: boolean, task: object}>}
 */
export async function updateTask(roleId, taskId, updates) {
  const filePath = path.join(TASKS_DIR, `${roleId}.json`);

  try {
    // Read current data
    const content = await fs.readFile(filePath, 'utf-8');
    const roleData = JSON.parse(content);

    // Find and update the task
    const taskIndex = roleData.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error(`Task ${taskId} not found in ${roleId}.json`);
    }

    // Merge updates
    const originalTask = roleData.tasks[taskIndex];
    const updatedTask = {
      ...originalTask,
      ...updates,
      updated_at: new Date().toISOString()
    };

    roleData.tasks[taskIndex] = updatedTask;

    // Atomic write
    await atomicWriteJson(filePath, roleData);

    // Refresh cache
    refreshCache();

    console.log(`[TASK-WRITER] Updated task ${taskId} in ${roleId}.json`);

    return {
      success: true,
      task: updatedTask
    };
  } catch (error) {
    console.error(`[TASK-WRITER] Error updating task ${taskId}:`, error.message);
    throw error;
  }
}

/**
 * Convenience wrapper to update task status with metadata
 * @param {string} taskId - The task ID to update
 * @param {string} newStatus - The new status value
 * @param {object} metadata - Optional metadata (completedBy, completedAt, etc.)
 * @returns {Promise<{success: boolean, task: object}>}
 */
export async function updateTaskStatus(taskId, newStatus, metadata = {}) {
  // Find the task first
  const result = await findTaskById(taskId);
  if (!result) {
    throw new Error(`Task ${taskId} not found`);
  }

  const { roleId } = result;

  const updates = {
    status: newStatus,
    ...metadata
  };

  // Add completion timestamp if status is completed
  if (newStatus === 'completed' && !updates.completedAt) {
    updates.completedAt = new Date().toISOString();
  }

  return updateTask(roleId, taskId, updates);
}

/**
 * Get all tasks that are blocked by a specific task
 * @param {string} taskId - The blocking task ID
 * @returns {Promise<Array<{task: object, roleId: string, filePath: string}>>}
 */
export async function getBlockedTasks(taskId) {
  const blockedTasks = [];

  try {
    const files = await fs.readdir(TASKS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = path.join(TASKS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const roleData = JSON.parse(content);

      if (roleData.tasks && Array.isArray(roleData.tasks)) {
        for (const task of roleData.tasks) {
          if (task.blockedBy && Array.isArray(task.blockedBy) && task.blockedBy.includes(taskId)) {
            blockedTasks.push({
              task,
              roleId: roleData.role_id,
              filePath
            });
          }
        }
      }
    }

    return blockedTasks;
  } catch (error) {
    console.error('[TASK-WRITER] Error getting blocked tasks:', error.message);
    throw error;
  }
}

/**
 * Resolve dependencies when a task is completed
 * Removes the completed task ID from blockedBy arrays of dependent tasks
 * @param {string} completedTaskId - The ID of the completed task
 * @returns {Promise<{success: boolean, unblocked: Array<string>}>}
 */
export async function resolveDependencies(completedTaskId) {
  const unblockedTasks = [];

  try {
    // Get all tasks blocked by this one
    const blockedTasks = await getBlockedTasks(completedTaskId);

    if (blockedTasks.length === 0) {
      console.log(`[TASK-WRITER] No tasks blocked by ${completedTaskId}`);
      return { success: true, unblocked: [] };
    }

    // Group by file to minimize writes
    const tasksByFile = new Map();
    for (const blocked of blockedTasks) {
      if (!tasksByFile.has(blocked.filePath)) {
        tasksByFile.set(blocked.filePath, []);
      }
      tasksByFile.get(blocked.filePath).push(blocked.task);
    }

    // Update each file
    for (const [filePath, tasks] of tasksByFile) {
      const content = await fs.readFile(filePath, 'utf-8');
      const roleData = JSON.parse(content);

      for (const task of tasks) {
        const taskIndex = roleData.tasks.findIndex(t => t.id === task.id);
        if (taskIndex !== -1) {
          // Remove completedTaskId from blockedBy
          const blockedBy = roleData.tasks[taskIndex].blockedBy || [];
          roleData.tasks[taskIndex].blockedBy = blockedBy.filter(id => id !== completedTaskId);
          roleData.tasks[taskIndex].updated_at = new Date().toISOString();

          unblockedTasks.push(task.id);

          // If fully unblocked, update status from 'blocked' to 'pending'
          if (roleData.tasks[taskIndex].blockedBy.length === 0 &&
              roleData.tasks[taskIndex].status === 'blocked') {
            roleData.tasks[taskIndex].status = 'pending';
            console.log(`[TASK-WRITER] Task ${task.id} is now unblocked`);
          }
        }
      }

      // Atomic write
      await atomicWriteJson(filePath, roleData);
    }

    // Refresh cache after all updates
    refreshCache();

    console.log(`[TASK-WRITER] Resolved dependencies: ${unblockedTasks.length} tasks updated`);

    return {
      success: true,
      unblocked: unblockedTasks
    };
  } catch (error) {
    console.error('[TASK-WRITER] Error resolving dependencies:', error.message);
    throw error;
  }
}

/**
 * Add steps to a task
 * @param {string} taskId - The task ID
 * @param {Array<{id: string, description: string, order: number}>} steps - Array of steps
 * @returns {Promise<{success: boolean, task: object}>}
 */
export async function addTaskSteps(taskId, steps) {
  const result = await findTaskById(taskId);
  if (!result) {
    throw new Error(`Task ${taskId} not found`);
  }

  return updateTask(result.roleId, taskId, { steps });
}

/**
 * Mark a single step as completed
 * @param {string} taskId - The task ID
 * @param {string} stepId - The step ID to mark complete
 * @returns {Promise<{success: boolean, task: object}>}
 */
export async function completeTaskStep(taskId, stepId) {
  const result = await findTaskById(taskId);
  if (!result) {
    throw new Error(`Task ${taskId} not found`);
  }

  const { task, roleId } = result;
  const steps = task.steps || [];

  const updatedSteps = steps.map(step => {
    if (step.id === stepId) {
      return { ...step, completed: true, completedAt: new Date().toISOString() };
    }
    return step;
  });

  return updateTask(roleId, taskId, { steps: updatedSteps });
}

export default {
  findTaskById,
  updateTask,
  updateTaskStatus,
  getBlockedTasks,
  resolveDependencies,
  addTaskSteps,
  completeTaskStep
};
