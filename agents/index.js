/**
 * MONOLITH OS - Autonomous Agent System
 * Main entry point for the agent framework
 */

import LLMRouter from './core/LLMRouter.js';
import RoleAgent from './core/RoleAgent.js';
import TaskOrchestrator from './core/TaskOrchestrator.js';
import DecisionLogger from './core/DecisionLogger.js';
import EscalationEngine from './core/EscalationEngine.js';
import ChiefOfStaffAgent from './roles/cos/agent.js';
import EmailNotifier from './notifications/email/EmailNotifier.js';

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

  // Initialize Chief of Staff agent (Phase 1 agent)
  const cosAgent = new ChiefOfStaffAgent({
    llmRouter,
    decisionLogger,
  });

  // Register agent with orchestrator
  orchestrator.registerAgent(cosAgent);

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

  // Queue pending tasks for the CoS agent
  const cosTasks = tasks.filter(
    (t) =>
      t.assigned_role === 'cos' &&
      ['pending', 'in_progress', 'active'].includes(t.status?.toLowerCase())
  );

  console.log(`[SYSTEM] Found ${cosTasks.length} tasks for CoS agent`);

  for (const task of cosTasks) {
    orchestrator.queueTask(task);
  }

  return {
    orchestrator,
    llmRouter,
    decisionLogger,
    escalationEngine,
    emailNotifier,
    agents: {
      cos: cosAgent,
    },

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
  LLMRouter,
  RoleAgent,
  TaskOrchestrator,
  DecisionLogger,
  EscalationEngine,
  ChiefOfStaffAgent,
  EmailNotifier,
};

export default initializeAgentSystem;
