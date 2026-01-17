/**
 * MONOLITH OS - Agent Integration
 * Connects dashboard to the Agent Service via REST API
 * Falls back to mock mode if Agent Service is unavailable
 */

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3001';
const AGENT_SERVICE_TIMEOUT = 5000; // 5 second timeout

let serviceAvailable = false;
let lastHealthCheck = null;
const HEALTH_CHECK_INTERVAL = 30000; // Check every 30 seconds

// Mock queue for when Agent Service is unavailable
const mockQueue = {
  tasks: [],
  inProgress: new Map(),
  completed: []
};

/**
 * Check if Agent Service is available
 */
async function checkServiceHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_SERVICE_TIMEOUT);

    const response = await fetch(`${AGENT_SERVICE_URL}/health`, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      serviceAvailable = data.agentSystem === 'running';
      lastHealthCheck = new Date();
      console.log(`[AGENT-INTEGRATION] Service health: ${serviceAvailable ? 'available' : 'degraded'}`);
      return serviceAvailable;
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.warn('[AGENT-INTEGRATION] Service unavailable:', error.message);
    }
  }

  serviceAvailable = false;
  lastHealthCheck = new Date();
  return false;
}

// Initial health check
checkServiceHealth();

// Periodic health checks
setInterval(checkServiceHealth, HEALTH_CHECK_INTERVAL);

/**
 * Make a request to the Agent Service
 */
async function serviceRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_SERVICE_TIMEOUT);

  try {
    const response = await fetch(`${AGENT_SERVICE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * Queue a task for agent processing
 * @param {object} task - The task to queue
 * @returns {Promise<object>} Queue result with position and status
 */
export async function queueTaskForAgent(task) {
  // Try Agent Service first
  if (serviceAvailable) {
    try {
      const result = await serviceRequest('/api/tasks/queue', {
        method: 'POST',
        body: JSON.stringify({ task })
      });

      return {
        success: true,
        mode: 'live',
        position: result.position || 1,
        taskId: task.id,
        message: result.message || 'Task queued for agent processing',
        orchestratorStatus: {
          isRunning: true,
          serviceUrl: AGENT_SERVICE_URL
        }
      };
    } catch (error) {
      console.warn('[AGENT-INTEGRATION] Service request failed, falling back to mock:', error.message);
      // Mark service as unavailable and fallthrough to mock
      serviceAvailable = false;
    }
  }

  // Fallback to mock implementation
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
    message: 'Task queued in mock queue (Agent Service not available). Start the Agent Service with: cd agents && npm run server',
    orchestratorStatus: {
      isRunning: false,
      queuedTasks: mockQueue.tasks.length,
      inProgress: mockQueue.inProgress.size
    }
  };
}

/**
 * Get current queue status
 * @returns {Promise<object>} Queue status information
 */
export async function getQueueStatus() {
  // Try Agent Service first
  if (serviceAvailable) {
    try {
      const result = await serviceRequest('/api/status');

      return {
        mode: 'live',
        isRunning: result.isRunning,
        registeredAgents: result.registeredAgents,
        queuedTasks: result.queuedTasks,
        inProgress: result.inProgress,
        completed: result.completed,
        ceoQueue: result.ceoQueue,
        agents: result.agents || [],
        serviceUrl: AGENT_SERVICE_URL
      };
    } catch (error) {
      console.warn('[AGENT-INTEGRATION] Status request failed:', error.message);
      serviceAvailable = false;
    }
  }

  // Fallback to mock
  return {
    mode: 'mock',
    isRunning: false,
    registeredAgents: 0,
    queuedTasks: mockQueue.tasks.length,
    inProgress: mockQueue.inProgress.size,
    completed: mockQueue.completed.length,
    ceoQueue: 0,
    agents: [],
    message: 'Agent Service not available - using mock queue'
  };
}

/**
 * Start the orchestrator (requires Agent Service)
 * @returns {Promise<object>} Start result
 */
export async function startOrchestrator() {
  if (serviceAvailable) {
    // Agent Service manages its own orchestrator lifecycle
    return {
      success: true,
      mode: 'live',
      message: 'Orchestrator is managed by Agent Service'
    };
  }

  return {
    success: false,
    mode: 'mock',
    message: 'Agent Service not available. Start it with: cd agents && npm run server'
  };
}

/**
 * Stop the orchestrator (requires Agent Service)
 * @returns {Promise<object>} Stop result
 */
export async function stopOrchestrator() {
  if (serviceAvailable) {
    return {
      success: true,
      mode: 'live',
      message: 'Orchestrator is managed by Agent Service'
    };
  }

  return {
    success: false,
    mode: 'mock',
    message: 'Agent Service not available'
  };
}

/**
 * Get CEO queue (escalations requiring human decision)
 * @returns {Promise<Array>} Array of pending CEO decisions
 */
export async function getCEOQueue() {
  if (serviceAvailable) {
    try {
      const result = await serviceRequest('/api/ceo-queue');
      return result.queue || [];
    } catch (error) {
      console.warn('[AGENT-INTEGRATION] CEO queue request failed:', error.message);
    }
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
  if (serviceAvailable) {
    try {
      await serviceRequest('/api/escalations/resolve', {
        method: 'POST',
        body: JSON.stringify({ escalationId, decision })
      });

      return {
        success: true,
        mode: 'live',
        message: `Escalation ${escalationId} resolved`
      };
    } catch (error) {
      console.warn('[AGENT-INTEGRATION] Escalation resolve failed:', error.message);
    }
  }

  return {
    success: false,
    mode: 'mock',
    message: 'Agent Service not available'
  };
}

/**
 * Get daily summary for CEO digest
 * @returns {Promise<object>} Daily summary
 */
export async function getDailySummary() {
  if (serviceAvailable) {
    try {
      const result = await serviceRequest('/api/daily-summary');
      return {
        mode: 'live',
        ...result
      };
    } catch (error) {
      console.warn('[AGENT-INTEGRATION] Daily summary request failed:', error.message);
    }
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
    message: 'Agent Service not available - mock summary'
  };
}

/**
 * Check if Agent Service is available
 * @returns {boolean} True if Agent Service is available
 */
export function isAgentsAvailable() {
  return serviceAvailable;
}

/**
 * Get Agent Service URL
 * @returns {string} The Agent Service URL
 */
export function getAgentServiceUrl() {
  return AGENT_SERVICE_URL;
}

/**
 * Get WebSocket URL for Agent Service
 * @returns {string} The WebSocket URL
 */
export function getWebSocketUrl() {
  return AGENT_SERVICE_URL.replace(/^http/, 'ws');
}

/**
 * Force health check
 * @returns {Promise<boolean>} Service availability
 */
export async function forceHealthCheck() {
  return checkServiceHealth();
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
  getAgentServiceUrl,
  getWebSocketUrl,
  forceHealthCheck,
  clearMockQueue
};
