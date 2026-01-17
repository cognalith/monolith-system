/**
 * MONOLITH OS - Agent Service
 * Standalone server for the autonomous agent system
 * Exposes WebSocket for real-time updates and REST API for commands
 */

// Load environment variables FIRST - before any other imports
import 'dotenv/config';

import http from 'http';
import { WebSocketServer } from 'ws';
import initializeAgentSystem from './index.js';

const PORT = process.env.PORT || process.env.AGENT_SERVICE_PORT || 3001;
const WS_HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Store for connected clients
const clients = new Map(); // clientId -> { ws, subscriptions }

// Agent system instance
let agentSystem = null;

/**
 * Broadcast message to all connected clients
 */
function broadcast(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

  for (const [clientId, client] of clients) {
    if (client.ws.readyState === 1) { // WebSocket.OPEN
      try {
        client.ws.send(message);
      } catch (error) {
        console.error(`[WS] Error sending to client ${clientId}:`, error.message);
      }
    }
  }
}

/**
 * Send message to specific client
 */
function sendToClient(clientId, type, data) {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === 1) {
    try {
      client.ws.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    } catch (error) {
      console.error(`[WS] Error sending to client ${clientId}:`, error.message);
    }
  }
}

/**
 * Handle incoming WebSocket messages
 */
async function handleWebSocketMessage(clientId, message) {
  try {
    const { action, payload, requestId } = JSON.parse(message);

    const respond = (success, data, error = null) => {
      sendToClient(clientId, 'response', { requestId, success, data, error });
    };

    switch (action) {
      case 'ping':
        respond(true, { pong: true });
        break;

      case 'getStatus':
        if (agentSystem) {
          const status = await agentSystem.getStatus();
          respond(true, status);
        } else {
          respond(false, null, 'Agent system not initialized');
        }
        break;

      case 'queueTask':
        if (agentSystem) {
          await agentSystem.processTask(payload.task);
          respond(true, { queued: true, taskId: payload.task.id });
        } else {
          respond(false, null, 'Agent system not initialized');
        }
        break;

      case 'getCEOQueue':
        if (agentSystem) {
          const ceoQueue = await agentSystem.orchestrator.getCEOQueue();
          respond(true, { queue: ceoQueue });
        } else {
          respond(false, null, 'Agent system not initialized');
        }
        break;

      case 'resolveEscalation':
        if (agentSystem) {
          await agentSystem.orchestrator.resolveEscalation(
            payload.escalationId,
            payload.decision
          );
          respond(true, { resolved: true });
        } else {
          respond(false, null, 'Agent system not initialized');
        }
        break;

      case 'getDailySummary':
        if (agentSystem) {
          const summary = await agentSystem.orchestrator.getDailySummary();
          respond(true, summary);
        } else {
          respond(false, null, 'Agent system not initialized');
        }
        break;

      case 'startWorkflow':
        if (agentSystem) {
          const result = await agentSystem.startWorkflow(
            payload.workflowId,
            payload.context
          );
          respond(true, result);
        } else {
          respond(false, null, 'Agent system not initialized');
        }
        break;

      case 'getWorkflowStatus':
        if (agentSystem) {
          const status = agentSystem.getWorkflowStatus(payload.instanceId);
          respond(true, status);
        } else {
          respond(false, null, 'Agent system not initialized');
        }
        break;

      case 'subscribe':
        // Subscribe to specific event types
        const client = clients.get(clientId);
        if (client) {
          client.subscriptions = payload.events || ['all'];
          respond(true, { subscribed: client.subscriptions });
        }
        break;

      default:
        respond(false, null, `Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`[WS] Error handling message from ${clientId}:`, error.message);
    sendToClient(clientId, 'error', { message: error.message });
  }
}

/**
 * Create HTTP server with REST API
 */
function createHttpServer() {
  return http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Parse URL
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    // JSON response helper
    const json = (data, status = 200) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    // Parse JSON body
    const parseBody = () => {
      return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', reject);
      });
    };

    try {
      // Health check
      if (path === '/health' && req.method === 'GET') {
        json({
          status: 'healthy',
          agentSystem: agentSystem ? 'running' : 'not_initialized',
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Get agent system status
      if (path === '/api/status' && req.method === 'GET') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const status = await agentSystem.getStatus();
        json({ success: true, ...status });
        return;
      }

      // Queue a task
      if (path === '/api/tasks/queue' && req.method === 'POST') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const body = await parseBody();
        await agentSystem.processTask(body.task);

        // Broadcast task queued event
        broadcast('taskQueued', { task: body.task });

        json({
          success: true,
          queued: true,
          taskId: body.task.id,
          message: `Task ${body.task.id} queued for processing`
        });
        return;
      }

      // Get CEO queue
      if (path === '/api/ceo-queue' && req.method === 'GET') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const queue = await agentSystem.orchestrator.getCEOQueue();
        json({ success: true, queue });
        return;
      }

      // Resolve escalation
      if (path === '/api/escalations/resolve' && req.method === 'POST') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const body = await parseBody();
        await agentSystem.orchestrator.resolveEscalation(
          body.escalationId,
          body.decision
        );

        // Broadcast escalation resolved
        broadcast('escalationResolved', { escalationId: body.escalationId });

        json({ success: true, resolved: true });
        return;
      }

      // Get daily summary
      if (path === '/api/daily-summary' && req.method === 'GET') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const summary = await agentSystem.orchestrator.getDailySummary();
        json({ success: true, ...summary });
        return;
      }

      // Start a workflow
      if (path === '/api/workflows/start' && req.method === 'POST') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const body = await parseBody();
        const result = await agentSystem.startWorkflow(body.workflowId, body.context);
        json({ success: true, ...result });
        return;
      }

      // List workflows
      if (path === '/api/workflows' && req.method === 'GET') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const workflows = agentSystem.listWorkflows();
        json({ success: true, workflows });
        return;
      }

      // Get connected clients count
      if (path === '/api/clients' && req.method === 'GET') {
        json({
          success: true,
          connectedClients: clients.size,
          clients: Array.from(clients.keys())
        });
        return;
      }

      // Intelligence dashboard
      if (path === '/api/intelligence' && req.method === 'GET') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const dashboard = agentSystem.getIntelligenceDashboard();
        json({ success: true, ...dashboard });
        return;
      }

      // ==========================================
      // MEDIA GENERATION API ENDPOINTS (Phase 8)
      // ==========================================

      // Generate media (unified endpoint)
      if (path === '/api/media/generate' && req.method === 'POST') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const body = await parseBody();
        const { type, content, options = {} } = body;

        if (!type || !content) {
          return json({ error: 'Missing required fields: type, content' }, 400);
        }

        // Use CMO agent's media generation capability
        const cmo = agentSystem.agents.cmo;
        if (!cmo || !cmo.mediaGenerationService) {
          return json({ error: 'Media generation service not available' }, 503);
        }

        const result = await cmo.createMedia(type, content, options);
        json({ success: true, ...result });
        return;
      }

      // Get supported media types
      if (path === '/api/media/types' && req.method === 'GET') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }

        const cmo = agentSystem.agents.cmo;
        if (!cmo || !cmo.mediaGenerationService) {
          return json({ error: 'Media generation service not available' }, 503);
        }

        const types = cmo.mediaGenerationService.getSupportedTypes();
        json({ success: true, ...types });
        return;
      }

      // Create product media kit (batch generation)
      if (path === '/api/media/product-kit' && req.method === 'POST') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const body = await parseBody();
        const { product, options = {} } = body;

        if (!product || !product.name) {
          return json({ error: 'Missing required field: product with name' }, 400);
        }

        const cmo = agentSystem.agents.cmo;
        if (!cmo || !cmo.mediaGenerationService) {
          return json({ error: 'Media generation service not available' }, 503);
        }

        const result = await cmo.createProductMediaKit(product, options);
        json({ success: true, ...result });
        return;
      }

      // Create campaign assets
      if (path === '/api/media/campaign-assets' && req.method === 'POST') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const body = await parseBody();
        const { campaign, options = {} } = body;

        if (!campaign) {
          return json({ error: 'Missing required field: campaign' }, 400);
        }

        const cmo = agentSystem.agents.cmo;
        if (!cmo || !cmo.mediaGenerationService) {
          return json({ error: 'Media generation service not available' }, 503);
        }

        const result = await cmo.createCampaignAssets(campaign, options);
        json({ success: true, ...result });
        return;
      }

      // Create podcast
      if (path === '/api/media/podcast' && req.method === 'POST') {
        if (!agentSystem) {
          return json({ error: 'Agent system not initialized' }, 503);
        }
        const body = await parseBody();
        const { content, title, sources = [], options = {} } = body;

        if (!content && sources.length === 0) {
          return json({ error: 'Missing required: content or sources' }, 400);
        }

        const cmo = agentSystem.agents.cmo;
        if (!cmo || !cmo.mediaGenerationService) {
          return json({ error: 'Media generation service not available' }, 503);
        }

        const result = await cmo.createPodcast(content, { title, sources, ...options });
        json({ success: true, ...result });
        return;
      }

      // 404 for unknown routes
      json({ error: 'Not found', path }, 404);

    } catch (error) {
      console.error('[HTTP] Error:', error.message);
      json({ error: error.message }, 500);
    }
  });
}

/**
 * Setup WebSocket server
 */
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    clients.set(clientId, {
      ws,
      subscriptions: ['all'],
      connectedAt: new Date().toISOString(),
      ip: req.socket.remoteAddress
    });

    console.log(`[WS] Client connected: ${clientId} (total: ${clients.size})`);

    // Send welcome message
    sendToClient(clientId, 'connected', {
      clientId,
      message: 'Connected to MONOLITH Agent Service',
      agentSystemReady: !!agentSystem
    });

    // Handle messages
    ws.on('message', (data) => {
      handleWebSocketMessage(clientId, data.toString());
    });

    // Handle close
    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId} (total: ${clients.size})`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[WS] Client error ${clientId}:`, error.message);
      clients.delete(clientId);
    });

    // Heartbeat
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });

  // Heartbeat interval to detect dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, WS_HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  return wss;
}

/**
 * Setup agent system event handlers to broadcast updates
 */
function setupAgentEventHandlers() {
  if (!agentSystem) return;

  const { orchestrator } = agentSystem;

  // Task events
  orchestrator.on('taskQueued', (task) => {
    broadcast('taskQueued', { task });
  });

  orchestrator.on('taskCompleted', ({ task, result }) => {
    broadcast('taskCompleted', { task, result });
  });

  orchestrator.on('taskFailed', ({ task, error }) => {
    broadcast('taskFailed', { task, error: error.message });
  });

  // Escalation events
  orchestrator.on('escalation', (escalation) => {
    broadcast('escalation', { escalation });
  });

  orchestrator.on('escalationResolved', (escalation) => {
    broadcast('escalationResolved', { escalation });
  });

  // Handoff events
  orchestrator.on('handoffCreated', ({ original, new: newTask }) => {
    broadcast('handoffCreated', { originalTask: original, newTask });
  });

  // Agent errors
  orchestrator.on('agentError', (error) => {
    broadcast('agentError', { role: error.role, error: error.error?.message });
  });

  console.log('[AGENT-SERVICE] Event handlers configured');
}

/**
 * Main startup function
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          MONOLITH OS - Agent Service Starting              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Create HTTP server
  const server = createHttpServer();

  // Setup WebSocket
  const wss = setupWebSocket(server);

  // Initialize agent system
  console.log('[AGENT-SERVICE] Initializing agent system...');
  try {
    agentSystem = await initializeAgentSystem({
      llm: {},
      logging: { mode: 'memory' },
      email: { provider: process.env.EMAIL_PROVIDER || 'console' },
      orchestrator: {
        taskDataPath: process.env.TASK_DATA_PATH || '../dashboard/src/data/tasks',
        processingInterval: parseInt(process.env.PROCESSING_INTERVAL) || 5000,
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT_TASKS) || 5
      }
    });

    // Setup event handlers for broadcasting
    setupAgentEventHandlers();

    // Start the orchestrator
    console.log('[AGENT-SERVICE] Starting task orchestrator...');
    await agentSystem.start();

    // Broadcast system ready
    broadcast('systemReady', {
      status: await agentSystem.getStatus(),
      message: 'Agent system initialized and processing'
    });

  } catch (error) {
    console.error('[AGENT-SERVICE] Failed to initialize agent system:', error.message);
    console.log('[AGENT-SERVICE] Running in degraded mode (API only)');
  }

  // Start server
  server.listen(PORT, () => {
    console.log(`\n[AGENT-SERVICE] Server running on port ${PORT}`);
    console.log(`[AGENT-SERVICE] REST API: http://localhost:${PORT}/api`);
    console.log(`[AGENT-SERVICE] WebSocket: ws://localhost:${PORT}`);
    console.log(`[AGENT-SERVICE] Health check: http://localhost:${PORT}/health\n`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[AGENT-SERVICE] Received ${signal}, shutting down...`);

    // Stop agent system
    if (agentSystem) {
      await agentSystem.stop();
    }

    // Close WebSocket connections
    for (const [clientId, client] of clients) {
      client.ws.close(1000, 'Server shutting down');
    }
    clients.clear();

    // Close server
    server.close(() => {
      console.log('[AGENT-SERVICE] Server closed');
      process.exit(0);
    });

    // Force exit after timeout
    setTimeout(() => {
      console.log('[AGENT-SERVICE] Force exit');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Run
main().catch((error) => {
  console.error('[AGENT-SERVICE] Fatal error:', error);
  process.exit(1);
});

export { broadcast, sendToClient, clients };
