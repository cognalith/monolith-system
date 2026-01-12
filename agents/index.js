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

// Role Agents - Phase 4 (Specialists)
import DevOpsAgent from './roles/devops/agent.js';
import DataEngineeringAgent from './roles/data/agent.js';
import QAAgent from './roles/qa/agent.js';

// Workflows - Phase 4
import WorkflowEngine from './workflows/WorkflowEngine.js';
import { workflows } from './workflows/definitions.js';

// Intelligence - Phase 5
import IntelligenceHub from './intelligence/index.js';

// Production - Phase 6
import ProductionWrapper from './production/index.js';
import configManager from './production/ConfigManager.js';

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

  // Phase 4: Specialists
  agents.devops = new DevOpsAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.devops);

  agents.data = new DataEngineeringAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.data);

  agents.qa = new QAAgent({ llmRouter, decisionLogger });
  orchestrator.registerAgent(agents.qa);

  console.log(`[SYSTEM] Initialized ${Object.keys(agents).length} role agents`);

  // Initialize Workflow Engine
  const workflowEngine = new WorkflowEngine({
    orchestrator: { agents },
    decisionLogger,
  });

  // Register predefined workflows
  for (const workflow of workflows) {
    workflowEngine.registerWorkflow(workflow);
  }

  console.log(`[SYSTEM] Registered ${workflows.length} workflows`);

  // Initialize Intelligence Hub - Phase 5
  const intelligenceHub = new IntelligenceHub({
    knowledge: config.knowledge,
    performance: config.performance,
    cost: config.cost || { dailyBudget: 100, monthlyBudget: 2000 },
    routing: { agents },
    enableLearning: config.enableLearning !== false,
    enableCaching: config.enableCaching !== false,
    enableCostOptimization: config.enableCostOptimization !== false,
    enableSmartRouting: config.enableSmartRouting !== false,
  });

  console.log('[SYSTEM] Intelligence Hub initialized');

  // Initialize Production Wrapper - Phase 6
  const productionConfig = configManager.load();
  const production = new ProductionWrapper({
    retry: productionConfig.retry,
    rateLimit: productionConfig.rateLimiting,
    health: {},
    shutdown: { timeout: 30000 },
  });

  // Only initialize production features in production mode
  if (productionConfig.env?.isProduction || config.enableProduction) {
    production.initialize();
    console.log('[SYSTEM] Production features initialized');
  }

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
    workflowEngine,
    intelligenceHub,
    production,
    config: productionConfig,

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

    // Workflow methods
    async startWorkflow(workflowId, context) {
      return workflowEngine.startWorkflow(workflowId, context);
    },

    listWorkflows() {
      return workflowEngine.listWorkflows();
    },

    getWorkflowStatus(instanceId) {
      return workflowEngine.getWorkflowStatus(instanceId);
    },

    // Intelligence methods
    getIntelligenceDashboard() {
      return intelligenceHub.getDashboard();
    },

    getHealthReport() {
      return intelligenceHub.getHealthReport();
    },

    getCostSummary() {
      return intelligenceHub.costOptimizer.getSummary();
    },

    exportIntelligence() {
      return intelligenceHub.export();
    },

    // Production methods
    getProductionStatus() {
      return production.getStatus();
    },

    getConfig() {
      return configManager.getSafeConfig();
    },

    validateConfig() {
      return configManager.validate();
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
  // Phase 4 Agents
  DevOpsAgent,
  DataEngineeringAgent,
  QAAgent,
  // Workflows
  WorkflowEngine,
  workflows,
  // Intelligence
  IntelligenceHub,
  // Production
  ProductionWrapper,
  configManager,
};

export default initializeAgentSystem;
