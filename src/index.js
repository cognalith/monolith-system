#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { queryDepartment } from './commands/query.js';
import { executeWorkflow } from './commands/workflow.js';
import { analyzeTopicCommand } from './commands/analyze.js';
import { logDecisionCommand } from './commands/decision.js';
import { generateReportCommand } from './commands/report.js';

dotenv.config();

// Validate API key
if (!process.env.ANTHROPIC_API_KEY) {
    console.error(chalk.red('❌ Error: ANTHROPIC_API_KEY environment variable is not set'));
    console.error(chalk.yellow('Please set ANTHROPIC_API_KEY in your .env file'));
    process.exit(1);
}

program
  .name('monolith')
  .description('The Monolith System: AI-powered business operations and workflow execution')
  .version('1.0.0');

// Query command - Ask a business role for guidance
program
  .command('query <role> [question]')
  .description('Query a business role (e.g., ceo, cfo, ciso) for guidance')
  .option('-v, --verbose', 'Show detailed response with metadata')
  .option('-j, --json', 'Output as JSON')
  .action(async (role, question, options) => {
        try {
                await queryDepartment(role, question, options);
        } catch (error) {
                console.error(chalk.red('Error during query:'), error.message);
                process.exit(1);
        }
  });

// Workflow command - Execute a business workflow
program
  .command('workflow <name>')
  .description('Execute a business workflow')
  .option('-d, --dry-run', 'Show what would happen without executing')
  .option('-v, --verbose', 'Show detailed execution steps')
  .action(async (name, options) => {
        try {
                await executeWorkflow(name, options);
        } catch (error) {
                console.error(chalk.red('Error during workflow:'), error.message);
                process.exit(1);
        }
  });

// Analyze command - Deep dive analysis of a business topic
program
  .command('analyze <topic>')
  .description('Analyze a business topic or scenario')
  .option('-d, --depth <level>', 'Analysis depth (basic|standard|deep)', 'standard')
  .action(async (topic, options) => {
        try {
                await analyzeTopicCommand(topic, options);
        } catch (error) {
                console.error(chalk.red('Error during analysis:'), error.message);
                process.exit(1);
        }
  });

// Decision log command - Record important business decisions
program
  .command('decision <action> [details]')
  .description('Manage decision logging (log, view, export)')
  .option('-m, --metadata <json>', 'Add JSON metadata to decision')
  .action(async (action, details, options) => {
        try {
                await logDecisionCommand(action, details, options);
        } catch (error) {
                console.error(chalk.red('Error managing decisions:'), error.message);
                process.exit(1);
        }
  });

// Report command - Generate business reports
program
  .command('report <type>')
  .description('Generate business reports')
  .option('-f, --format <format>', 'Output format (text|json|csv|html)', 'text')
  .option('-o, --output <file>', 'Output file path')
  .action(async (type, options) => {
        try {
                await generateReportCommand(type, options);
        } catch (error) {
                console.error(chalk.red('Error generating report:'), error.message);
                process.exit(1);
        }
  });

// Help for available departments
program
  .command('departments')
  .alias('depts')
  .description('List available business departments')
  .action(() => {
        console.log(chalk.bold('\n📊 Available Departments (MVP):\n'));
        const departments = [
          { name: 'ceo', title: 'Chief Executive Officer', focus: 'Strategic Leadership & Direction' },
          { name: 'cfo', title: 'Chief Financial Officer', focus: 'Financial Planning & Risk' },
          { name: 'ciso', title: 'Chief Information Security Officer', focus: 'Security & Risk Management' },
              ];
        departments.forEach(dept => {
                console.log(chalk.cyan(`  ${dept.name.padEnd(8)}`), `-`, chalk.white(dept.title));
                console.log(chalk.gray(`               ${dept.focus}\n`));
        });
        console.log(chalk.yellow('Phase 2 will add 15 additional departments\n'));
  });

// Help for available workflows
program
  .command('workflows')
  .alias('wfs')
  .description('List available workflows')
  .action(() => {
        console.log(chalk.bold('\n⚙️  Available Workflows (MVP):\n'));
        console.log(chalk.cyan('  ma-evaluation     '), '- M&A Evaluation & Integration');
        console.log(chalk.gray('  More workflows coming in Phase 2+\n'));
  });

program.parse(process.argv);

// Show help if no arguments provided
if (process.argv.length < 3) {
    program.outputHelp();
}
