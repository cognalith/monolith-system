/**
 * MONOLITH OS - Tasks API Routes
 * Provides endpoints for task CRUD operations, completion, and agent integration
 */

import express from 'express';
import {
  findTaskById,
  updateTask,
  updateTaskStatus,
  resolveDependencies,
  getBlockedTasks,
  addTaskSteps
} from './taskDataWriter.js';
import { queueTaskForAgent, getQueueStatus } from './agentIntegration.js';
import { generateStepsForTask } from './stepsGenerator.js';

const router = express.Router();

/**
 * GET /api/tasks/:taskId
 * Get a single task by ID
 */
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    const result = await findTaskById(taskId);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }

    // Get tasks blocked by this one
    const blockedTasks = await getBlockedTasks(taskId);

    res.json({
      success: true,
      task: {
        ...result.task,
        assigned_role: result.roleId,
        blockedTasksCount: blockedTasks.length
      }
    });
  } catch (error) {
    console.error('[TASKS-API] Error getting task:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve task',
      message: error.message
    });
  }
});

/**
 * PATCH /api/tasks/:taskId/status
 * Update task status
 */
router.patch('/:taskId/status', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, completedBy, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    // Validate status value
    const validStatuses = [
      'pending', 'in_progress', 'completed', 'blocked', 'at_risk',
      'ongoing', 'active', 'not_started', 'cancelled', 'on_hold'
    ];

    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const metadata = {};
    if (completedBy) metadata.completedBy = completedBy;
    if (notes) metadata.notes = notes;

    const result = await updateTaskStatus(taskId, status.toLowerCase(), metadata);

    res.json({
      success: true,
      task: result.task,
      message: `Task ${taskId} status updated to ${status}`
    });
  } catch (error) {
    console.error('[TASKS-API] Error updating status:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update task status',
      message: error.message
    });
  }
});

/**
 * POST /api/tasks/:taskId/complete
 * Complete a task and resolve dependencies
 */
router.post('/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { completedBy, notes, resolveDeps = true } = req.body;

    // Find the task first
    const taskResult = await findTaskById(taskId);
    if (!taskResult) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }

    // Update status to completed
    const metadata = {
      completedBy: completedBy || 'system',
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
      task: updateResult.task,
      dependencies: {
        resolved: resolveDeps,
        unblockedTasks: dependencyResult.unblocked
      },
      message: `Task ${taskId} completed successfully`
    });
  } catch (error) {
    console.error('[TASKS-API] Error completing task:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to complete task',
      message: error.message
    });
  }
});

/**
 * POST /api/tasks/:taskId/send-to-agent
 * Queue a task for agent processing
 */
router.post('/:taskId/send-to-agent', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { priority, context } = req.body;

    // Find the task
    const taskResult = await findTaskById(taskId);
    if (!taskResult) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }

    const task = {
      ...taskResult.task,
      assigned_role: taskResult.roleId,
      role_name: taskResult.roleData.role_name,
      role_abbr: taskResult.roleData.role_abbr
    };

    // Override priority if provided
    if (priority) {
      task.priority = priority.toUpperCase();
    }

    // Add context if provided
    if (context) {
      task.agentContext = context;
    }

    // Update task status to indicate it's being processed
    await updateTaskStatus(taskId, 'in_progress', {
      sentToAgent: true,
      sentToAgentAt: new Date().toISOString()
    });

    // Queue for agent processing
    const queueResult = await queueTaskForAgent(task);

    res.json({
      success: true,
      task: task,
      queue: queueResult,
      message: `Task ${taskId} queued for agent processing`
    });
  } catch (error) {
    console.error('[TASKS-API] Error sending to agent:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to queue task for agent',
      message: error.message
    });
  }
});

/**
 * GET /api/tasks/:taskId/steps
 * Get or generate steps for a task
 */
router.get('/:taskId/steps', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { regenerate = false } = req.query;

    // Find the task
    const taskResult = await findTaskById(taskId);
    if (!taskResult) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }

    const task = taskResult.task;

    // Return existing steps if available and not regenerating
    if (task.steps && task.steps.length > 0 && !regenerate) {
      return res.json({
        success: true,
        taskId: taskId,
        steps: task.steps,
        generated: false
      });
    }

    // Generate new steps
    const steps = generateStepsForTask({
      ...task,
      assigned_role: taskResult.roleId,
      role_name: taskResult.roleData.role_name
    });

    // Save steps to task
    await addTaskSteps(taskId, steps);

    res.json({
      success: true,
      taskId: taskId,
      steps: steps,
      generated: true
    });
  } catch (error) {
    console.error('[TASKS-API] Error getting steps:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get task steps',
      message: error.message
    });
  }
});

/**
 * POST /api/tasks/:taskId/steps/:stepId/complete
 * Mark a step as completed
 */
router.post('/:taskId/steps/:stepId/complete', async (req, res) => {
  try {
    const { taskId, stepId } = req.params;

    // Find the task
    const taskResult = await findTaskById(taskId);
    if (!taskResult) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }

    const task = taskResult.task;
    const steps = task.steps || [];

    // Find and update the step
    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Step ${stepId} not found in task ${taskId}`
      });
    }

    steps[stepIndex] = {
      ...steps[stepIndex],
      completed: true,
      completedAt: new Date().toISOString()
    };

    // Calculate progress
    const completedCount = steps.filter(s => s.completed).length;
    const progress = Math.round((completedCount / steps.length) * 100);

    // Update task with new steps
    await updateTask(taskResult.roleId, taskId, {
      steps,
      progress
    });

    res.json({
      success: true,
      taskId: taskId,
      step: steps[stepIndex],
      progress: progress,
      allStepsCompleted: completedCount === steps.length
    });
  } catch (error) {
    console.error('[TASKS-API] Error completing step:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to complete step',
      message: error.message
    });
  }
});

/**
 * GET /api/tasks/:taskId/blocked-by
 * Get tasks that are blocking this task
 */
router.get('/:taskId/blocked-by', async (req, res) => {
  try {
    const { taskId } = req.params;

    const taskResult = await findTaskById(taskId);
    if (!taskResult) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }

    const blockedBy = taskResult.task.blockedBy || [];

    // Fetch details of blocking tasks
    const blockingTasks = [];
    for (const blockingId of blockedBy) {
      const blocking = await findTaskById(blockingId);
      if (blocking) {
        blockingTasks.push({
          id: blocking.task.id,
          content: blocking.task.content,
          status: blocking.task.status,
          assigned_role: blocking.roleId
        });
      }
    }

    res.json({
      success: true,
      taskId: taskId,
      blockedBy: blockingTasks
    });
  } catch (error) {
    console.error('[TASKS-API] Error getting blocked-by:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get blocking tasks',
      message: error.message
    });
  }
});

/**
 * GET /api/tasks/:taskId/blocking
 * Get tasks that this task is blocking
 */
router.get('/:taskId/blocking', async (req, res) => {
  try {
    const { taskId } = req.params;

    const taskResult = await findTaskById(taskId);
    if (!taskResult) {
      return res.status(404).json({
        success: false,
        error: `Task ${taskId} not found`
      });
    }

    const blockedTasks = await getBlockedTasks(taskId);

    res.json({
      success: true,
      taskId: taskId,
      blocking: blockedTasks.map(bt => ({
        id: bt.task.id,
        content: bt.task.content,
        status: bt.task.status,
        assigned_role: bt.roleId
      }))
    });
  } catch (error) {
    console.error('[TASKS-API] Error getting blocking:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get blocked tasks',
      message: error.message
    });
  }
});

/**
 * GET /api/tasks/queue/status
 * Get agent queue status
 */
router.get('/queue/status', async (req, res) => {
  try {
    const status = await getQueueStatus();
    res.json({
      success: true,
      queue: status
    });
  } catch (error) {
    console.error('[TASKS-API] Error getting queue status:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue status',
      message: error.message
    });
  }
});

export default router;
