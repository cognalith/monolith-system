/**
 * MONOLITH OS - API v1 Index
 * Combines all v1 API routes into a single router
 *
 * This module exports the complete v1 API with the following routes:
 * - /tasks - Task management operations
 * - /decisions - Decision log operations
 * - /workflows - Workflow management operations
 * - /agents - Agent status and management
 */

import express from 'express';
import tasksRouter from './tasks.js';
import decisionsRouter from './decisions.js';
import workflowsRouter from './workflows.js';
import agentsRouter from './agents.js';

const router = express.Router();

/**
 * API v1 Version Info
 */
export const VERSION = '1.0.0';
export const RELEASE_DATE = '2026-01-14';

/**
 * GET /v1
 * Returns API v1 information and available endpoints
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      version: VERSION,
      releaseDate: RELEASE_DATE,
      description: 'MONOLITH OS API v1 - RESTful API for system management',
      endpoints: {
        tasks: {
          base: '/v1/tasks',
          methods: ['GET', 'POST'],
          description: 'Task management operations'
        },
        decisions: {
          base: '/v1/decisions',
          methods: ['GET', 'POST'],
          description: 'Decision log operations'
        },
        workflows: {
          base: '/v1/workflows',
          methods: ['GET', 'POST', 'PATCH'],
          description: 'Workflow management operations'
        },
        agents: {
          base: '/v1/agents',
          methods: ['GET', 'POST', 'PATCH'],
          description: 'Agent status and management'
        }
      },
      documentation: '/api/docs',
      deprecation: null
    }
  });
});

/**
 * Mount route modules
 */
router.use('/tasks', tasksRouter);
router.use('/decisions', decisionsRouter);
router.use('/workflows', workflowsRouter);
router.use('/agents', agentsRouter);

/**
 * 404 handler for v1 routes
 */
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found in API v1`,
      availableEndpoints: ['/v1/tasks', '/v1/decisions', '/v1/workflows', '/v1/agents']
    }
  });
});

export default router;
