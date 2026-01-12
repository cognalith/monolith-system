/**
 * MONOLITH OS - Autonomous Agent System
 * Main entry point for the agent framework
 */

import LLMRouter from './core/LLMRouter.js';
import RoleAgent from './core/RoleAgent.js';
import TaskOrchestrator from './core/TaskOrchestrator.js';
import DecisionLogger from './core/DecisionLogger.js';
import EscalationEngine from './core/EscalationEngine.js';
import EmailNotifier from './notifications/email/EmailNotifier.js';

// Role Agents - Phase 1
import ChiefOfStaffAgent from './roles/cos/agent.js';

// Role Agents - Phase 2 (Core C-Suite)
import CFOAgent from './roles/cfo/agent.js';
import CTOAgent from './roles/cto/agent.js';
import CLOAgent from './roles/clo/agent.js';
import COOAgent from './roles/coo/agent.js';

// Role Agents - Phase 3 (Extended Leadership)
import CISOAgent from './roles/ciso/agent.js';
import CMOAgent from './roles/cmo/agent.js';
import CHROAgent from './roles/chro/agent.js';
import CCOAgent from './roles/cco/agent.js';
import CPOAgent from './roles/cpo/agent.js';
import CROAgent from './roles/cro/agent.js';

/**
 * Initialize and run the autonomous agent system
 */
async function initializeAgentSystem(config = {}) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           MONOLITH OS - Autonomous Agent System            ║');
  console.log('║                    Phase 1: Foundation                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Initialize core components
  const llmRouter = new LLMRouter(config.llm);
  const decisionLogger = new DecisionLogger(config.logging);
  const escalationEngine = new EscalationEngine(config.escalation);
  const emailNotifier = new EmailNotifier(config.email);
  const orchestrator = new TaskOrchestrator(config.orchestrator);

  // Initialize all agents
  const agents = {};

  // Phase 1: Chief of Staff
  agents.cos = new ChiefOfStaffAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.cos);

  // Phase 2: Core C-Suite
  agents.cfo = new CFOAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.cfo);

  agents.cto = new CTOAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.cto);

  agents.clo = new CLOAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.clo);

  agents.coo = new COOAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.coo);

  // Phase 3: Extended Leadership
  agents.ciso = new CISOAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.ciso);

  agents.cmo = new CMOAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.cmo);

  agents.chro = new CHROAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.chro);

  agents.cco = new CCOAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.cco);

  agents.cpo = new CPOAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.cpo);

  agents.cro = new CROAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.cro);

  console.log(`[SYSTEM] Initialized ${Object.keys(agents).length} role agents`);

  // Set up event handlers
  orchestrator.on('escalation', async (escalation) => {
    console.log(`[SYSTEM] Escalation received: ${escalation.reason}`);

    // Check if critical - send immediate alert
    const escCheck = escalationEngine.shouldEscalate(
      escalation.task,
      { action: escalation.recommendation },
      escalation.role
    );

    if (escCheck.priority === 'CRITICAL') {
      await emailNotifier.sendCriticalAlert(escalation);
    }
  });

  orchestrator.on('taskCompleted', ({ task, result }) => {
    console.log(`[SYSTEM] Task completed: ${task.id}`);
  });

  // Load initial tasks
  const tasks = await orchestrator.loadTasks();
  console.log(`[SYSTEM] Loaded ${tasks.length} tasks from data files`);

  // Queue pending tasks for all registered agents
  const registeredRoles = Object.keys(agents);
  const pendingStatuses = ['pending', 'in_progress', 'active', 'ongoing', 'at_risk'];

  let queuedCount = 0;
  for (const task of tasks) {
    if (
      registeredRoles.includes(task.assigned_role) &&
      pendingStatuses.includes(task.status?.toLowerCase())
    ) {
      orchestrator.queueTask(task);
      queuedCount++;
    }
  }

  console.log(`[SYSTEM] Queued ${queuedCount} tasks for ${registeredRoles.length} agents`);

  return {
    orchestrator,
    llmRouter,
    decisionLogger,
    escalationEngine,
    emailNotifier,
    agents,

    // Helper methods
    async start() {
      orchestrator.start();
    },

    async stop() {
      orchestrator.stop();
    },

    async getStatus() {
      return orchestrator.getStatus();
    },

    async sendDailyDigest() {
      const summary = await orchestrator.getDailySummary();
      const ceoQueue = orchestrator.getCEOQueue();
      return emailNotifier.sendDailyDigest(summary, ceoQueue, []);
    },

    async processTask(task) {
      orchestrator.queueTask(task);
    },
  };
}

/**
 * Run a demo of the agent system
 */
async function runDemo() {
  console.log('[DEMO] Starting agent system demo...\n');

  const system = await initializeAgentSystem({
    llm: {},
    logging: { mode: 'memory' },
    email: { provider: 'console' },
  });

  // Get status
  console.log('\n[DEMO] System Status:');
  console.log(JSON.stringify(await system.getStatus(), null, 2));

  // Generate a sample daily digest (console mode)
  console.log('\n[DEMO] Generating sample daily digest...');
  await system.sendDailyDigest();

  console.log('\n[DEMO] Demo complete. Agent system ready.');
  console.log('[DEMO] Call system.start() to begin processing tasks.\n');

  return system;
}

export {
  initializeAgentSystem,
  runDemo,
  // Core
  LLMRouter,
  RoleAgent,
  TaskOrchestrator,
  DecisionLogger,
  EscalationEngine,
  EmailNotifier,
  // Phase 1 Agents
  ChiefOfStaffAgent,
  // Phase 2 Agents
  CFOAgent,
  CTOAgent,
  CLOAgent,
  COOAgent,
  // Phase 3 Agents
  CISOAgent,
  CMOAgent,
  CHROAgent,
  CCOAgent,
  CPOAgent,
  CROAgent,
};

export default initializeAgentSystem;
