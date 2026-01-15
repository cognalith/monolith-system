/**
 * MONOLITH OS - API v1 Tasks Routes
 * RESTful API for task management operations
 *
 * Endpoints:
 * - GET /v1/tasks - List all tasks with filtering/pagination
 * - POST /v1/tasks - Create a new task
 * - GET /v1/tasks/:taskId - Get task by ID
 * - PATCH /v1/tasks/:taskId - Update task
 * - DELETE /v1/tasks/:taskId - Delete task
 * - POST /v1/tasks/:taskId/complete - Complete a task
 * - POST /v1/tasks/:taskId/send-to-agent - Send task to agent for processing
 */

import express from 'express';
import {
  findTaskById,
  updateTask,
  updateTaskStatus,
  resolveDependencies,
  getBlockedTasks,
  addTaskSteps
} from '../taskDataWriter.js';
import { queueTaskForAgent, getQueueStatus } from '../agentIntegration.js';
import { generateStepsForTask } from '../stepsGenerator.js';
import { getPendingTasks, getCompletedTasks } from '../taskDataLoader.js';

const router = express.Router();

/**
 * GET /v1/tasks
 * List tasks with optional filtering and pagination
 *
 * Query Parameters:
 * - status: Filter by status (pending, in_progress, completed, blocked)
 * - priority: Filter by priority (CRITICAL, HIGH, MEDIUM, LOW)
 * - role: Filter by assigned role
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sort: Sort field (created_at, priority, status)
 * - order: Sort order (asc, desc)
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      priority,
      role,
      page = 1,
      limit = 20,
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Get all tasks
    let tasks = [];

    // Get both pending and completed tasks
    const pendingTasks = getPendingTasks(role);
    const completedTasks = getCompletedTasks(role);
    tasks = [...pendingTasks, ...completedTasks];

    // Apply filters
    if (status) {
      const normalizedStatus = status.toLowerCase();
      tasks = tasks.filter(t => t.status?.toLowerCase() === normalizedStatus);
    }

    if (priority) {
      const normalizedPriority = priority.toUpperCase();
      tasks = tasks.filter(t => t.priority === normalizedPriority);
    }

    if (role && !status) {
      const normalizedRole = role.toLowerCase();
      tasks = tasks.filter(t => t.assigned_role?.toLowerCase() === normalizedRole);
    }

    // Apply sorting
    const sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;
    tasks.sort((a, b) => {
      if (sort === 'priority') {
        const priorityOrder = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
        return (priorityOrder[a.priority] - priorityOrder[b.priority]) * sortOrder;
      }
      if (sort === 'status') {
        return (a.status || '').localeCompare(b.status || '') * sortOrder;
      }
      // Default: created_at
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return (dateA - dateB) * sortOrder;
    });

    const total = tasks.length;

    // Apply pagination
    tasks = tasks.slice(offset, offset + limitNum);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: offset + limitNum < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('[API-V1-TASKS] Error listing tasks:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve tasks'
      }
    });
  }
});

/**
 * POST /v1/tasks
 * Create a new task
 *
 * Body:
 * - content: Task description (required)
 * - priority: Priority level (default: MEDIUM)
 * - assigned_role: Role to assign (required)
 * - workflow: Associated workflow
 * - due_date: Due date (ISO string)
 * - dependencies: Array of task IDs this task depends on
 */
router.post('/', async (req, res) => {
  try {
    const {
      content,
      priority = 'MEDIUM',
      assigned_role,
      workflow,
      due_date,
      dependencies = []
    } = req.body;

    // Validate required fields
    if (!content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task content is required',
          field: 'content'
        }
      });
    }

    if (!assigned_role) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Assigned role is required',
          field: 'assigned_role'
        }
      });
    }

    // Validate priority
    const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    if (!validPriorities.includes(priority.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Priority must be one of: ${validPriorities.join(', ')}`,
          field: 'priority'
        }
      });
    }

    // Create task object
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: taskId,
      content,
      priority: priority.toUpperCase(),
      assigned_role: assigned_role.toLowerCase(),
      workflow: workflow || null,
      status: dependencies.length > 0 ? 'blocked' : 'pending',
      created_at: new Date().toISOString(),
      due_date: due_date || null,
      blockedBy: dependencies,
      steps: [],
      progress: 0
    };

    // Note: In a real implementation, this would persist to database
    // For now, we return the task as if it was created

    res.status(201).json({
      success: true,
      data: task,
      message: `Task ${taskId} created successfully`
    });
  } catch (error) {
    console.error('[API-V1-TASKS] Error creating task:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create task'
      }
    });
  }
});

/**
 * GET /v1/tasks/:taskId
 * Get a single task by ID
 */
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    const result = await findTaskById(taskId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task ${taskId} not found`
        }
      });
    }

    // Get related task data
    const blockedTasks = await getBlockedTasks(taskId);

    res.json({
      success: true,
      data: {
        ...result.task,
        assigned_role: result.roleId,
        role_name: result.roleData?.role_name,
        blockedTasksCount: blockedTasks.length
      }
    });
  } catch (error) {
    console.error('[API-V1-TASKS] Error getting task:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve task'
      }
    });
  }
});

/**
 * PATCH /v1/tasks/:taskId
 * Update a task
 *
 * Body (all optional):
 * - content: Updated task description
 * - priority: Updated priority
 * - status: Updated status
 * - due_date: Updated due date
 * - notes: Additional notes
 */
router.patch('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { content, priority, status, due_date, notes } = req.body;

    const result = await findTaskById(taskId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task ${taskId} not found`
        }
      });
    }

    // Validate status if provided
    if (status) {
      const validStatuses = [
        'pending', 'in_progress', 'completed', 'blocked', 'at_risk',
        'ongoing', 'active', 'not_started', 'cancelled', 'on_hold'
      ];
      if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Status must be one of: ${validStatuses.join(', ')}`,
            field: 'status'
          }
        });
      }
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      if (!validPriorities.includes(priority.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Priority must be one of: ${validPriorities.join(', ')}`,
            field: 'priority'
          }
        });
      }
    }

    // Build updates object
    const updates = {};
    if (content) updates.content = content;
    if (priority) updates.priority = priority.toUpperCase();
    if (status) updates.status = status.toLowerCase();
    if (due_date) updates.due_date = due_date;
    if (notes) updates.notes = notes;
    updates.updated_at = new Date().toISOString();

    const updatedResult = await updateTask(result.roleId, taskId, updates);

    res.json({
      success: true,
      data: updatedResult.task,
      message: `Task ${taskId} updated successfully`
    });
  } catch (error) {
    console.error('[API-V1-TASKS] Error updating task:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update task'
      }
    });
  }
});

/**
 * DELETE /v1/tasks/:taskId
 * Delete a task (soft delete - marks as cancelled)
 */
router.delete('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    const result = await findTaskById(taskId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task ${taskId} not found`
        }
      });
    }

    // Soft delete - mark as cancelled
    await updateTaskStatus(taskId, 'cancelled', {
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'api'
    });

    res.json({
      success: true,
      message: `Task ${taskId} deleted successfully`
    });
  } catch (error) {
    console.error('[API-V1-TASKS] Error deleting task:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete task'
      }
    });
  }
});

/**
 * POST /v1/tasks/:taskId/complete
 * Complete a task and resolve dependencies
 *
 * Body:
 * - completedBy: Who completed the task
 * - notes: Completion notes
 * - resolveDeps: Whether to resolve dependencies (default: true)
 */
router.post('/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { completedBy, notes, resolveDeps = true } = req.body;

    const taskResult = await findTaskById(taskId);
    if (!taskResult) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task ${taskId} not found`
        }
      });
    }

    // Update status to completed
    const metadata = {
      completedBy: completedBy || 'api',
      completedAt: new Date().toISOString()
    };
    if (notes) metadata.notes = notes;

    const updateResult = await updateTaskStatus(taskId, 'completed', metadata);

    // Resolve dependencies if requested
    let dependencyResult = { unblocked: [] };
    if (resolveDeps) {
      dependencyResult = await resolveDependencies(taskId);
    }

    res.json({
      success: true,
      data: {
        task: updateResult.task,
        dependencies: {
          resolved: resolveDeps,
          unblockedTasks: dependencyResult.unblocked
        }
      },
      message: `Task ${taskId} completed successfully`
    });
  } catch (error) {
    console.error('[API-V1-TASKS] Error completing task:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete task'
      }
    });
  }
});

/**
 * POST /v1/tasks/:taskId/send-to-agent
 * Queue a task for agent processing
 *
 * Body:
 * - priority: Override priority for processing
 * - context: Additional context for the agent
 */
router.post('/:taskId/send-to-agent', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { priority, context } = req.body;

    const taskResult = await findTaskById(taskId);
    if (!taskResult) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task ${taskId} not found`
        }
      });
    }

    const task = {
      ...taskResult.task,
      assigned_role: taskResult.roleId,
      role_name: taskResult.roleData?.role_name,
      role_abbr: taskResult.roleData?.role_abbr
    };

    if (priority) {
      task.priority = priority.toUpperCase();
    }

    if (context) {
      task.agentContext = context;
    }

    // Update task status to indicate processing
    await updateTaskStatus(taskId, 'in_progress', {
      sentToAgent: true,
      sentToAgentAt: new Date().toISOString()
    });

    // Queue for agent processing
    const queueResult = await queueTaskForAgent(task);

    res.json({
      success: true,
      data: {
        task,
        queue: queueResult
      },
      message: `Task ${taskId} queued for agent processing`
    });
  } catch (error) {
    console.error('[API-V1-TASKS] Error sending to agent:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to queue task for agent'
      }
    });
  }
});

/**
 * GET /v1/tasks/:taskId/steps
 * Get or generate steps for a task
 */
router.get('/:taskId/steps', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { regenerate = false } = req.query;

    const taskResult = await findTaskById(taskId);
    if (!taskResult) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Task ${taskId} not found`
        }
      });
    }

    const task = taskResult.task;

    // Return existing steps if available and not regenerating
    if (task.steps && task.steps.length > 0 && regenerate !== 'true') {
      return res.json({
        success: true,
        data: {
          taskId,
          steps: task.steps,
          generated: false
        }
      });
    }

    // Generate new steps
    const steps = generateStepsForTask({
      ...task,
      assigned_role: taskResult.roleId,
      role_name: taskResult.roleData?.role_name
    });

    await addTaskSteps(taskId, steps);

    res.json({
      success: true,
      data: {
        taskId,
        steps,
        generated: true
      }
    });
  } catch (error) {
    console.error('[API-V1-TASKS] Error getting steps:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get task steps'
      }
    });
  }
});

/**
 * GET /v1/tasks/queue/status
 * Get agent queue status
 */
router.get('/queue/status', async (req, res) => {
  try {
    const status = await getQueueStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[API-V1-TASKS] Error getting queue status:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get queue status'
      }
    });
  }
});

export default router;
