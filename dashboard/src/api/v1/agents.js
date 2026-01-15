/**
 * MONOLITH OS - API v1 Agents Routes
 * RESTful API for agent status and management
 *
 * Endpoints:
 * - GET /v1/agents - List all registered agents
 * - GET /v1/agents/status - Get overall agent system status
 * - GET /v1/agents/:agentId - Get specific agent details
 * - GET /v1/agents/:agentId/metrics - Get agent performance metrics
 * - POST /v1/agents/:agentId/enable - Enable an agent
 * - POST /v1/agents/:agentId/disable - Disable an agent
 */

import express from 'express';
import {
  getQueueStatus,
  isAgentsAvailable,
  startOrchestrator,
  stopOrchestrator,
  getCEOQueue,
  resolveEscalation,
  getDailySummary
} from '../agentIntegration.js';
import { ROLES_HIERARCHY } from '../rolesRoutes.js';

const router = express.Router();

/**
 * Agent registry - stores agent configurations
 * In production, this would be persisted in a database
 */
const agentRegistry = new Map();

/**
 * Initialize agent registry with role-based agents
 */
function initializeAgentRegistry() {
  const agentRoles = ['cto', 'clo', 'coo', 'chro', 'cco', 'cpo', 'cro', 'data', 'qa'];

  agentRoles.forEach(roleId => {
    const role = ROLES_HIERARCHY.find(r => r.id === roleId);
    agentRegistry.set(roleId, {
      id: roleId,
      name: role?.fullName || `${roleId.toUpperCase()} Agent`,
      role: roleId,
      status: 'active',
      enabled: true,
      capabilities: getAgentCapabilities(roleId),
      metrics: {
        tasksProcessed: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        averageProcessingTime: 0,
        lastActiveAt: null
      },
      config: {
        maxConcurrentTasks: 5,
        timeout: 300000, // 5 minutes
        retryAttempts: 3,
        priority: getPriorityForRole(roleId)
      },
      createdAt: new Date().toISOString()
    });
  });
}

/**
 * Get agent capabilities based on role
 */
function getAgentCapabilities(roleId) {
  const capabilities = {
    cto: ['code_review', 'architecture_analysis', 'technical_planning', 'system_design'],
    clo: ['legal_review', 'contract_analysis', 'compliance_check', 'risk_assessment'],
    coo: ['operations_planning', 'resource_allocation', 'process_optimization'],
    chro: ['hr_policy', 'talent_management', 'employee_relations', 'workforce_planning'],
    cco: ['compliance_audit', 'regulatory_analysis', 'policy_enforcement'],
    cpo: ['vendor_management', 'procurement_analysis', 'cost_optimization'],
    cro: ['risk_analysis', 'risk_mitigation', 'risk_reporting'],
    data: ['data_analysis', 'data_visualization', 'data_pipeline', 'ml_operations'],
    qa: ['quality_assurance', 'testing', 'bug_tracking', 'process_validation']
  };

  return capabilities[roleId] || ['general_processing'];
}

/**
 * Get priority level for role
 */
function getPriorityForRole(roleId) {
  const priorities = {
    cto: 1,
    clo: 2,
    coo: 2,
    chro: 3,
    cco: 2,
    cpo: 3,
    cro: 2,
    data: 3,
    qa: 3
  };

  return priorities[roleId] || 5;
}

// Initialize registry
initializeAgentRegistry();

/**
 * GET /v1/agents
 * List all registered agents
 *
 * Query Parameters:
 * - status: Filter by status (active, idle, disabled, error)
 * - enabled: Filter by enabled state (true/false)
 */
router.get('/', async (req, res) => {
  try {
    const { status, enabled } = req.query;

    let agents = Array.from(agentRegistry.values());

    // Apply filters
    if (status) {
      agents = agents.filter(a => a.status === status.toLowerCase());
    }

    if (enabled !== undefined) {
      const isEnabled = enabled === 'true';
      agents = agents.filter(a => a.enabled === isEnabled);
    }

    // Get live queue status
    const queueStatus = await getQueueStatus();

    res.json({
      success: true,
      data: agents,
      total: agents.length,
      systemStatus: {
        orchestratorRunning: queueStatus.isRunning,
        mode: queueStatus.mode,
        queuedTasks: queueStatus.queuedTasks,
        inProgress: queueStatus.inProgress
      }
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error listing agents:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve agents'
      }
    });
  }
});

/**
 * GET /v1/agents/status
 * Get overall agent system status
 */
router.get('/status', async (req, res) => {
  try {
    const queueStatus = await getQueueStatus();
    const ceoQueue = await getCEOQueue();
    const dailySummary = await getDailySummary();

    const agents = Array.from(agentRegistry.values());
    const activeAgents = agents.filter(a => a.enabled && a.status === 'active');
    const disabledAgents = agents.filter(a => !a.enabled);

    res.json({
      success: true,
      data: {
        system: {
          available: isAgentsAvailable(),
          mode: queueStatus.mode,
          orchestratorRunning: queueStatus.isRunning
        },
        agents: {
          total: agents.length,
          active: activeAgents.length,
          disabled: disabledAgents.length
        },
        queue: {
          pending: queueStatus.queuedTasks,
          inProgress: queueStatus.inProgress,
          completed: queueStatus.completed || 0
        },
        escalations: {
          pendingCEODecisions: ceoQueue.length
        },
        dailySummary: {
          date: dailySummary.date,
          tasksCompleted: dailySummary.tasksCompleted,
          tasksAutoResolved: dailySummary.tasksAutoResolved,
          tasksEscalated: dailySummary.tasksEscalated
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error getting status:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve agent system status'
      }
    });
  }
});

/**
 * GET /v1/agents/escalations
 * Get pending escalations (CEO queue)
 */
router.get('/escalations', async (req, res) => {
  try {
    const escalations = await getCEOQueue();

    res.json({
      success: true,
      data: escalations,
      total: escalations.length
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error getting escalations:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve escalations'
      }
    });
  }
});

/**
 * POST /v1/agents/escalations/:escalationId/resolve
 * Resolve an escalation
 *
 * Body:
 * - decision: The decision made
 * - notes: Additional notes
 */
router.post('/escalations/:escalationId/resolve', async (req, res) => {
  try {
    const { escalationId } = req.params;
    const { decision, notes } = req.body;

    if (!decision) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Decision is required',
          field: 'decision'
        }
      });
    }

    const result = await resolveEscalation(escalationId, {
      decision,
      notes,
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'api'
    });

    res.json({
      success: true,
      data: result,
      message: `Escalation ${escalationId} resolved`
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error resolving escalation:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to resolve escalation'
      }
    });
  }
});

/**
 * POST /v1/agents/orchestrator/start
 * Start the agent orchestrator
 */
router.post('/orchestrator/start', async (req, res) => {
  try {
    const result = await startOrchestrator();

    res.json({
      success: result.success,
      data: result,
      message: result.message
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error starting orchestrator:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to start orchestrator'
      }
    });
  }
});

/**
 * POST /v1/agents/orchestrator/stop
 * Stop the agent orchestrator
 */
router.post('/orchestrator/stop', async (req, res) => {
  try {
    const result = await stopOrchestrator();

    res.json({
      success: result.success,
      data: result,
      message: result.message
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error stopping orchestrator:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to stop orchestrator'
      }
    });
  }
});

/**
 * GET /v1/agents/:agentId
 * Get specific agent details
 */
router.get('/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = agentRegistry.get(agentId.toLowerCase());

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent ${agentId} not found`
        }
      });
    }

    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error getting agent:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve agent'
      }
    });
  }
});

/**
 * GET /v1/agents/:agentId/metrics
 * Get agent performance metrics
 */
router.get('/:agentId/metrics', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { period = '24h' } = req.query;

    const agent = agentRegistry.get(agentId.toLowerCase());

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent ${agentId} not found`
        }
      });
    }

    // Calculate metrics based on period
    // In production, this would query actual metrics from a time-series database
    const metrics = {
      agentId: agent.id,
      period,
      performance: {
        tasksProcessed: agent.metrics.tasksProcessed,
        tasksCompleted: agent.metrics.tasksCompleted,
        tasksFailed: agent.metrics.tasksFailed,
        successRate: agent.metrics.tasksProcessed > 0
          ? (agent.metrics.tasksCompleted / agent.metrics.tasksProcessed * 100).toFixed(2)
          : 0,
        averageProcessingTime: agent.metrics.averageProcessingTime
      },
      activity: {
        lastActiveAt: agent.metrics.lastActiveAt,
        uptime: '99.9%', // Mock value
        requestsPerMinute: 0
      },
      resources: {
        cpuUsage: '15%', // Mock value
        memoryUsage: '256MB', // Mock value
        activeConnections: 2
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error getting agent metrics:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve agent metrics'
      }
    });
  }
});

/**
 * POST /v1/agents/:agentId/enable
 * Enable an agent
 */
router.post('/:agentId/enable', async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = agentRegistry.get(agentId.toLowerCase());

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent ${agentId} not found`
        }
      });
    }

    agent.enabled = true;
    agent.status = 'active';
    agentRegistry.set(agentId.toLowerCase(), agent);

    res.json({
      success: true,
      data: agent,
      message: `Agent ${agentId} enabled successfully`
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error enabling agent:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to enable agent'
      }
    });
  }
});

/**
 * POST /v1/agents/:agentId/disable
 * Disable an agent
 */
router.post('/:agentId/disable', async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = agentRegistry.get(agentId.toLowerCase());

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent ${agentId} not found`
        }
      });
    }

    agent.enabled = false;
    agent.status = 'disabled';
    agentRegistry.set(agentId.toLowerCase(), agent);

    res.json({
      success: true,
      data: agent,
      message: `Agent ${agentId} disabled successfully`
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error disabling agent:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to disable agent'
      }
    });
  }
});

/**
 * PATCH /v1/agents/:agentId/config
 * Update agent configuration
 *
 * Body (all optional):
 * - maxConcurrentTasks: Maximum concurrent tasks
 * - timeout: Task timeout in milliseconds
 * - retryAttempts: Number of retry attempts
 * - priority: Agent priority level
 */
router.patch('/:agentId/config', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { maxConcurrentTasks, timeout, retryAttempts, priority } = req.body;

    const agent = agentRegistry.get(agentId.toLowerCase());

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Agent ${agentId} not found`
        }
      });
    }

    // Update configuration
    if (maxConcurrentTasks !== undefined) {
      agent.config.maxConcurrentTasks = Math.max(1, Math.min(20, parseInt(maxConcurrentTasks, 10)));
    }
    if (timeout !== undefined) {
      agent.config.timeout = Math.max(10000, Math.min(600000, parseInt(timeout, 10)));
    }
    if (retryAttempts !== undefined) {
      agent.config.retryAttempts = Math.max(0, Math.min(10, parseInt(retryAttempts, 10)));
    }
    if (priority !== undefined) {
      agent.config.priority = Math.max(1, Math.min(10, parseInt(priority, 10)));
    }

    agentRegistry.set(agentId.toLowerCase(), agent);

    res.json({
      success: true,
      data: agent,
      message: `Agent ${agentId} configuration updated`
    });
  } catch (error) {
    console.error('[API-V1-AGENTS] Error updating agent config:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update agent configuration'
      }
    });
  }
});

export default router;
