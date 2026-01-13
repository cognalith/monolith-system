/**
 * MONOLITH OS - Agent Integration
 * Provides integration layer between dashboard API and agent system
 * Falls back to mock/stub if agents system is not available
 */

let TaskOrchestrator = null;
let orchestratorInstance = null;
let agentsAvailable = false;

// Try to import TaskOrchestrator from agents system
async function initializeAgentSystem() {
  try {
    const module = await import('../../../agents/core/TaskOrchestrator.js');
    TaskOrchestrator = module.default;
    agentsAvailable = true;
    console.log('[AGENT-INTEGRATION] TaskOrchestrator loaded successfully');
  } catch (error) {
    console.warn('[AGENT-INTEGRATION] Agents system not available:', error.message);
    console.log('[AGENT-INTEGRATION] Using mock/stub implementation');
    agentsAvailable = false;
  }
}

// Initialize on module load
initializeAgentSystem();

// Mock task queue for when agents system is not available
const mockQueue = {
  tasks: [],
  inProgress: new Map(),
  completed: []
};

/**
 * Get or create the orchestrator instance
 * @returns {object|null} The orchestrator instance or null if not available
 */
function getOrchestrator() {
  if (!agentsAvailable || !TaskOrchestrator) {
    return null;
  }

  if (!orchestratorInstance) {
    orchestratorInstance = new TaskOrchestrator({
      taskDataPath: './dashboard/src/data/tasks',
      processingInterval: 5000,
      maxConcurrent: 5
    });
  }

  return orchestratorInstance;
}

/**
 * Queue a task for agent processing
 * @param {object} task - The task to queue
 * @returns {Promise<object>} Queue result with position and status
 */
export async function queueTaskForAgent(task) {
  const orchestrator = getOrchestrator();

  if (orchestrator) {
    // Use real orchestrator
    try {
      orchestrator.queueTask({
        ...task,
        queuedAt: new Date().toISOString(),
        source: 'dashboard-api'
      });

      const status = orchestrator.getStatus();

      return {
        success: true,
        mode: 'live',
        position: status.queuedTasks,
        taskId: task.id,
        orchestratorStatus: {
          isRunning: status.isRunning,
          queuedTasks: status.queuedTasks,
          inProgress: status.inProgress
        }
      };
    } catch (error) {
      console.error('[AGENT-INTEGRATION] Error queueing task:', error.message);
      throw error;
    }
  } else {
    // Use mock implementation
    const queuedTask = {
      ...task,
      queuedAt: new Date().toISOString(),
      source: 'dashboard-api',
      mockId: `mock-${Date.now()}`
    };

    mockQueue.tasks.push(queuedTask);

    console.log(`[AGENT-INTEGRATION] Mock: Queued task ${task.id} (position: ${mockQueue.tasks.length})`);

    return {
      success: true,
      mode: 'mock',
      position: mockQueue.tasks.length,
      taskId: task.id,
      message: 'Task queued in mock queue (agents system not available)',
      orchestratorStatus: {
        isRunning: false,
        queuedTasks: mockQueue.tasks.length,
        inProgress: mockQueue.inProgress.size
      }
    };
  }
}

/**
 * Get current queue status
 * @returns {Promise<object>} Queue status information
 */
export async function getQueueStatus() {
  const orchestrator = getOrchestrator();

  if (orchestrator) {
    const status = orchestrator.getStatus();

    return {
      mode: 'live',
      isRunning: status.isRunning,
      registeredAgents: status.registeredAgents,
      queuedTasks: status.queuedTasks,
      inProgress: status.inProgress,
      completed: status.completed,
      ceoQueue: status.ceoQueue,
      agents: status.agents || []
    };
  } else {
    return {
      mode: 'mock',
      isRunning: false,
      registeredAgents: 0,
      queuedTasks: mockQueue.tasks.length,
      inProgress: mockQueue.inProgress.size,
      completed: mockQueue.completed.length,
      ceoQueue: 0,
      agents: [],
      message: 'Agents system not available - using mock queue'
    };
  }
}

/**
 * Start the orchestrator (if available)
 * @returns {Promise<object>} Start result
 */
export async function startOrchestrator() {
  const orchestrator = getOrchestrator();

  if (orchestrator) {
    orchestrator.start();
    return {
      success: true,
      mode: 'live',
      message: 'Orchestrator started'
    };
  }

  return {
    success: false,
    mode: 'mock',
    message: 'Agents system not available'
  };
}

/**
 * Stop the orchestrator (if available)
 * @returns {Promise<object>} Stop result
 */
export async function stopOrchestrator() {
  const orchestrator = getOrchestrator();

  if (orchestrator) {
    orchestrator.stop();
    return {
      success: true,
      mode: 'live',
      message: 'Orchestrator stopped'
    };
  }

  return {
    success: false,
    mode: 'mock',
    message: 'Agents system not available'
  };
}

/**
 * Get CEO queue (escalations requiring human decision)
 * @returns {Promise<Array>} Array of pending CEO decisions
 */
export async function getCEOQueue() {
  const orchestrator = getOrchestrator();

  if (orchestrator) {
    return orchestrator.getCEOQueue();
  }

  return [];
}

/**
 * Resolve an escalation
 * @param {string} escalationId - The escalation ID
 * @param {object} decision - The CEO decision
 * @returns {Promise<object>} Resolution result
 */
export async function resolveEscalation(escalationId, decision) {
  const orchestrator = getOrchestrator();

  if (orchestrator) {
    orchestrator.resolveEscalation(escalationId, decision);
    return {
      success: true,
      mode: 'live',
      message: `Escalation ${escalationId} resolved`
    };
  }

  return {
    success: false,
    mode: 'mock',
    message: 'Agents system not available'
  };
}

/**
 * Get daily summary for CEO digest
 * @returns {Promise<object>} Daily summary
 */
export async function getDailySummary() {
  const orchestrator = getOrchestrator();

  if (orchestrator) {
    return await orchestrator.getDailySummary();
  }

  // Return mock summary
  const today = new Date();
  return {
    mode: 'mock',
    date: today.toISOString().split('T')[0],
    tasksCompleted: mockQueue.completed.length,
    tasksAutoResolved: 0,
    tasksEscalated: 0,
    pendingCEODecisions: 0,
    byRole: {},
    message: 'Agents system not available - mock summary'
  };
}

/**
 * Check if agents system is available
 * @returns {boolean} True if agents system is available
 */
export function isAgentsAvailable() {
  return agentsAvailable;
}

/**
 * Clear mock queue (for testing)
 */
export function clearMockQueue() {
  mockQueue.tasks = [];
  mockQueue.inProgress.clear();
  mockQueue.completed = [];
}

export default {
  queueTaskForAgent,
  getQueueStatus,
  startOrchestrator,
  stopOrchestrator,
  getCEOQueue,
  resolveEscalation,
  getDailySummary,
  isAgentsAvailable,
  clearMockQueue
};
