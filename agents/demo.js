#!/usr/bin/env node
/**
 * MONOLITH OS - Agent System Demo
 * Run with: node agents/demo.js
 */

import 'dotenv/config';
import { runDemo, initializeAgentSystem } from './index.js';

async function main() {
  const args = process.argv.slice(2);
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
      console.log('Testing Chief of Staff agent...');
      const testSystem = await initializeAgentSystem();

      const testTask = {
        id: 'test-001',
        content: 'Generate a daily briefing synthesizing updates from all department heads',
        priority: 'HIGH',
        assigned_role: 'cos',
        status: 'pending',
        workflow: 'Daily Operations',
      };

      console.log('\nProcessing test task:');
      console.log(JSON.stringify(testTask, null, 2));

      try {
        const result = await testSystem.agents.cos.processTask(testTask);
        console.log('\nResult:');
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('Error:', error.message);
        if (!process.env.ANTHROPIC_API_KEY) {
          console.log('\nNote: Set ANTHROPIC_API_KEY environment variable to test with real LLM.');
        }
      }
      break;

    default:
      console.log(`
MONOLITH OS - Agent System

Usage: node agents/demo.js [command]

Commands:
  demo      Run demo with console output (default)
  start     Start the full agent system
  status    Show system status
  digest    Generate and send daily digest
  test-cos  Test the Chief of Staff agent

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
