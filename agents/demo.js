#!/usr/bin/env node
/**
 * MONOLITH OS - Agent System Demo
 * Run with: node agents/demo.js
 */

import 'dotenv/config';
import { runDemo, initializeAgentSystem } from './index.js';

// Helper function to test an agent
async function testAgent(roleId, task) {
  console.log(`Testing ${roleId.toUpperCase()} agent...`);
  const testSystem = await initializeAgentSystem();

  console.log('\nProcessing test task:');
  console.log(JSON.stringify(task, null, 2));

  try {
    const agent = testSystem.agents[roleId];
    if (!agent) {
      console.error(`Agent ${roleId} not found`);
      return;
    }

    const result = await agent.processTask(task);
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('\nNote: Set ANTHROPIC_API_KEY environment variable to test with real LLM.');
    }
  }
}

// Helper to run a command
async function runCommand(cmd) {
  const args = [cmd];
  await main(args);
}

async function main(argsOverride = null) {
  const args = argsOverride || process.argv.slice(2);
  const mode = args[0] || 'demo';

  switch (mode) {
    case 'demo':
      // Run demo (console output only)
      await runDemo();
      break;

    case 'start':
      // Start the full agent system
      console.log('Starting MONOLITH Agent System...');
      const system = await initializeAgentSystem();
      await system.start();

      // Keep running
      process.on('SIGINT', async () => {
        console.log('\nShutting down...');
        await system.stop();
        process.exit(0);
      });
      break;

    case 'status':
      // Show system status
      const statusSystem = await initializeAgentSystem();
      console.log(JSON.stringify(await statusSystem.getStatus(), null, 2));
      break;

    case 'digest':
      // Send daily digest
      console.log('Generating daily digest...');
      const digestSystem = await initializeAgentSystem();
      await digestSystem.sendDailyDigest();
      break;

    case 'test-cos':
      // Test CoS agent with a sample task
      await testAgent('cos', {
        id: 'test-cos-001',
        content: 'Generate a daily briefing synthesizing updates from all department heads',
        priority: 'HIGH',
        assigned_role: 'cos',
        status: 'pending',
        workflow: 'Daily Operations',
      });
      break;

    case 'test-cfo':
      // Test CFO agent
      await testAgent('cfo', {
        id: 'test-cfo-001',
        content: 'Review and approve the $8,500 expense request for new development laptops',
        priority: 'MEDIUM',
        assigned_role: 'cfo',
        status: 'pending',
        workflow: 'Expense Approval',
      });
      break;

    case 'test-cto':
      // Test CTO agent
      await testAgent('cto', {
        id: 'test-cto-001',
        content: 'Evaluate Railway vs Render vs Vercel for hosting the TeeMates application',
        priority: 'HIGH',
        assigned_role: 'cto',
        status: 'pending',
        workflow: 'Infrastructure Migration',
      });
      break;

    case 'test-clo':
      // Test CLO agent
      await testAgent('clo', {
        id: 'test-clo-001',
        content: 'Draft Terms of Service for TeeMates golf league management platform',
        priority: 'HIGH',
        assigned_role: 'clo',
        status: 'pending',
        workflow: 'Legal Documentation',
      });
      break;

    case 'test-coo':
      // Test COO agent
      await testAgent('coo', {
        id: 'test-coo-001',
        content: 'Create operational plan for migrating all projects from Replit to GitHub',
        priority: 'CRITICAL',
        assigned_role: 'coo',
        status: 'pending',
        workflow: 'Platform Migration',
      });
      break;

    case 'test-ciso':
      // Test CISO agent
      await testAgent('ciso', {
        id: 'test-ciso-001',
        content: 'Conduct security assessment of our cloud infrastructure and identify vulnerabilities',
        priority: 'HIGH',
        assigned_role: 'ciso',
        status: 'pending',
        workflow: 'Security Assessment',
      });
      break;

    case 'test-cmo':
      // Test CMO agent
      await testAgent('cmo', {
        id: 'test-cmo-001',
        content: 'Create marketing strategy for TeeMates app launch targeting golf enthusiasts',
        priority: 'HIGH',
        assigned_role: 'cmo',
        status: 'pending',
        workflow: 'Marketing Campaign',
      });
      break;

    case 'test-chro':
      // Test CHRO agent
      await testAgent('chro', {
        id: 'test-chro-001',
        content: 'Create job description for Senior Full Stack Developer position',
        priority: 'MEDIUM',
        assigned_role: 'chro',
        status: 'pending',
        workflow: 'Recruiting',
      });
      break;

    case 'test-cco':
      // Test CCO agent
      await testAgent('cco', {
        id: 'test-cco-001',
        content: 'Review GDPR compliance requirements for our user data handling practices',
        priority: 'HIGH',
        assigned_role: 'cco',
        status: 'pending',
        workflow: 'Compliance Review',
      });
      break;

    case 'test-cpo':
      // Test CPO agent
      await testAgent('cpo', {
        id: 'test-cpo-001',
        content: 'Prioritize features for Q1 release including handicap tracking and league management',
        priority: 'HIGH',
        assigned_role: 'cpo',
        status: 'pending',
        workflow: 'Product Roadmap',
      });
      break;

    case 'test-cro':
      // Test CRO agent
      await testAgent('cro', {
        id: 'test-cro-001',
        content: 'Create revenue strategy for SaaS subscription model with B2B and B2C tiers',
        priority: 'HIGH',
        assigned_role: 'cro',
        status: 'pending',
        workflow: 'Revenue Strategy',
      });
      break;

    case 'test-devops':
      // Test DevOps agent
      await testAgent('devops', {
        id: 'test-devops-001',
        content: 'Design CI/CD pipeline for React application with GitHub Actions',
        priority: 'HIGH',
        assigned_role: 'devops',
        status: 'pending',
        workflow: 'Infrastructure Setup',
      });
      break;

    case 'test-data':
      // Test Data Engineering agent
      await testAgent('data', {
        id: 'test-data-001',
        content: 'Design data pipeline for user analytics from PostgreSQL to BigQuery',
        priority: 'MEDIUM',
        assigned_role: 'data',
        status: 'pending',
        workflow: 'Analytics Pipeline',
      });
      break;

    case 'test-qa':
      // Test QA agent
      await testAgent('qa', {
        id: 'test-qa-001',
        content: 'Create test plan for new user authentication feature with 2FA',
        priority: 'HIGH',
        assigned_role: 'qa',
        status: 'pending',
        workflow: 'Quality Assurance',
      });
      break;

    case 'test-all':
      // Test all agents
      console.log('Testing all agents...\n');
      const agents = ['cos', 'cfo', 'cto', 'clo', 'coo', 'ciso', 'cmo', 'chro', 'cco', 'cpo', 'cro', 'devops', 'data', 'qa'];
      for (const agent of agents) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing ${agent.toUpperCase()} Agent`);
        console.log('='.repeat(60));
        await runCommand(`test-${agent}`);
      }
      break;

    case 'workflows':
      // List available workflows
      console.log('Listing available workflows...');
      const wfSystem = await initializeAgentSystem();
      const availableWorkflows = wfSystem.listWorkflows();
      console.log('\nAvailable Workflows:');
      console.log('='.repeat(60));
      for (const wf of availableWorkflows) {
        console.log(`\n📋 ${wf.name} (${wf.id})`);
        console.log(`   ${wf.description}`);
        console.log(`   Steps: ${wf.steps.length}`);
        console.log(`   Roles: ${wf.steps.map(s => s.role).join(' → ')}`);
      }
      break;

    case 'run-workflow':
      // Run a workflow
      const workflowId = args[1];
      if (!workflowId) {
        console.log('Usage: node agents/demo.js run-workflow <workflow-id> [context-json]');
        console.log('\nExample: node agents/demo.js run-workflow new-feature \'{"featureName": "Dark Mode"}\'');
        break;
      }
      const contextArg = args[2] ? JSON.parse(args[2]) : {};
      console.log(`Running workflow: ${workflowId}`);
      const runSystem = await initializeAgentSystem();
      const instance = await runSystem.startWorkflow(workflowId, contextArg);
      console.log('\nWorkflow Result:');
      console.log(JSON.stringify(instance, null, 2));
      break;

    case 'intelligence':
      // Show intelligence dashboard
      console.log('Loading Intelligence Dashboard...');
      const intSystem = await initializeAgentSystem();
      const dashboard = intSystem.getIntelligenceDashboard();
      console.log('\n📊 Intelligence Dashboard');
      console.log('='.repeat(60));
      console.log('\nSystem Overview:');
      console.log(JSON.stringify(dashboard.system, null, 2));
      console.log('\nAgent Performance:');
      for (const agent of dashboard.agents.slice(0, 5)) {
        console.log(`  ${agent.role}: ${agent.totalTasks} tasks, ${Math.round(agent.successRate * 100)}% success`);
      }
      console.log('\nCost Summary:');
      console.log(`  Today: $${dashboard.costs.budget.spentToday.toFixed(2)} / $${dashboard.costs.budget.daily}`);
      console.log(`  This Month: $${dashboard.costs.budget.spentThisMonth.toFixed(2)} / $${dashboard.costs.budget.monthly}`);
      break;

    case 'health':
      // Show health report
      console.log('Generating Health Report...');
      const healthSystem = await initializeAgentSystem();
      const health = healthSystem.getHealthReport();
      console.log('\n🏥 Health Report');
      console.log('='.repeat(60));
      console.log(`\nStatus: ${health.status.toUpperCase()}`);
      console.log(`\nMetrics:`);
      console.log(`  Tasks Processed: ${health.metrics.tasksProcessed}`);
      console.log(`  Escalation Rate: ${Math.round(health.metrics.escalationRate * 100)}%`);
      console.log(`  Uptime: ${health.metrics.uptime}`);
      console.log(`  Daily Cost: $${health.metrics.dailyCost.toFixed(2)}`);
      if (health.alerts.length > 0) {
        console.log(`\nAlerts (${health.alerts.length}):`);
        for (const alert of health.alerts) {
          const icon = alert.severity === 'critical' ? '🔴' : '🟡';
          console.log(`  ${icon} ${alert.message}`);
        }
      } else {
        console.log('\n✅ No alerts');
      }
      break;

    case 'costs':
      // Show cost details
      console.log('Loading Cost Summary...');
      const costSystem = await initializeAgentSystem();
      const costs = costSystem.getCostSummary();
      console.log('\n💰 Cost Summary');
      console.log('='.repeat(60));
      console.log('\nBudget:');
      console.log(`  Daily: $${costs.budget.spentToday.toFixed(2)} / $${costs.budget.daily} (${Math.round(costs.budget.spentToday / costs.budget.daily * 100)}%)`);
      console.log(`  Monthly: $${costs.budget.spentThisMonth.toFixed(2)} / $${costs.budget.monthly} (${Math.round(costs.budget.spentThisMonth / costs.budget.monthly * 100)}%)`);
      console.log('\nLast 24h:');
      console.log(`  Calls: ${costs.last24h.calls}`);
      console.log(`  Cost: $${costs.last24h.cost.toFixed(2)}`);
      console.log(`  Tokens: ${costs.last24h.tokens.toLocaleString()}`);
      if (costs.recommendations.length > 0) {
        console.log('\nRecommendations:');
        for (const rec of costs.recommendations) {
          console.log(`  • ${rec.message}`);
        }
      }
      break;

    case 'config':
      // Show configuration
      console.log('Loading Configuration...');
      const confSystem = await initializeAgentSystem();
      const config = confSystem.getConfig();
      const validation = confSystem.validateConfig();
      console.log('\n⚙️ Configuration');
      console.log('='.repeat(60));
      console.log(`\nEnvironment: ${config.env?.nodeEnv || 'development'}`);
      console.log('\nAPI Keys:');
      console.log(`  Anthropic: ${config.api?.anthropicApiKey ? '✓ Set' : '✗ Not set'}`);
      console.log(`  OpenAI: ${config.api?.openaiApiKey ? '✓ Set' : '✗ Not set'}`);
      console.log('\nFeatures:');
      for (const [key, value] of Object.entries(config.features || {})) {
        console.log(`  ${key}: ${value ? '✓' : '✗'}`);
      }
      console.log('\nRate Limiting:');
      console.log(`  Enabled: ${config.rateLimiting?.enabled ? '✓' : '✗'}`);
      console.log(`  Tokens/sec: ${config.rateLimiting?.tokensPerSecond}`);
      if (!validation.valid) {
        console.log('\n❌ Validation Errors:');
        for (const error of validation.errors) {
          console.log(`  - ${error}`);
        }
      }
      if (validation.warnings?.length > 0) {
        console.log('\n⚠️ Warnings:');
        for (const warning of validation.warnings) {
          console.log(`  - ${warning}`);
        }
      }
      break;

    default:
      console.log(`
MONOLITH OS - Agent System

Usage: node agents/demo.js [command]

Commands:
  demo       Run demo with console output (default)
  start      Start the full agent system
  status     Show system status
  digest     Generate and send daily digest

Agent Testing (Phase 1-2):
  test-cos   Test Chief of Staff agent
  test-cfo   Test CFO agent (financial analysis)
  test-cto   Test CTO agent (technical evaluation)
  test-clo   Test CLO agent (legal drafting)
  test-coo   Test COO agent (operations planning)

Agent Testing (Phase 3):
  test-ciso  Test CISO agent (security assessment)
  test-cmo   Test CMO agent (marketing strategy)
  test-chro  Test CHRO agent (HR/recruiting)
  test-cco   Test CCO agent (compliance)
  test-cpo   Test CPO agent (product roadmap)
  test-cro   Test CRO agent (revenue strategy)

Agent Testing (Phase 4 - Specialists):
  test-devops  Test DevOps agent (CI/CD, infrastructure)
  test-data    Test Data Engineering agent (pipelines)
  test-qa      Test QA agent (testing strategy)

  test-all     Test all 14 agents sequentially

Workflows:
  workflows      List all available multi-agent workflows
  run-workflow   Run a workflow (e.g., run-workflow new-feature '{"featureName":"Dark Mode"}')

Intelligence (Phase 5):
  intelligence   Show intelligence dashboard with system metrics
  health         Generate system health report with alerts
  costs          Show detailed cost summary and recommendations

Production (Phase 6):
  config         Show current configuration and validation status

Environment Variables:
  ANTHROPIC_API_KEY  - Required for Claude LLM
  OPENAI_API_KEY     - Optional for GPT-4 fallback
  SENDGRID_API_KEY   - For email notifications
  RESEND_API_KEY     - Alternative email provider
  CEO_EMAIL          - CEO email for notifications
`);
  }
}

main().catch(console.error);
