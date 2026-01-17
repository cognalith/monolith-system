#!/usr/bin/env node
/**
 * MONOLITH OS - JSON Task Migration Script
 *
 * Migrates tasks from JSON files in dashboard/src/data/tasks/ to Supabase monolith_task_queue.
 *
 * Usage:
 *   node migrateJsonTasks.js           # Run migration
 *   node migrateJsonTasks.js --dry-run # Preview without inserting
 *
 * Environment variables required:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (or SUPABASE_ANON_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

// ============================================================================
// CONFIGURATION
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASKS_DIR = path.resolve(__dirname, '../../dashboard/src/data/tasks');
const BATCH_SIZE = 50;
const TABLE_NAME = 'monolith_task_queue';

// Check for dry-run mode
const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================================
// MAPPINGS
// ============================================================================

/**
 * Priority mapping: CRITICAL=100, HIGH=75, MEDIUM=50, LOW=25
 */
const PRIORITY_MAP = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
};

/**
 * Status mapping from JSON to Supabase format
 */
const STATUS_MAP = {
  // Queued statuses
  pending: 'queued',
  not_started: 'queued',
  not_specified: 'queued',
  queued: 'queued',
  upcoming: 'queued',
  not_yet_set_up: 'queued',
  not_yet_created: 'queued',
  not_yet_established: 'queued',

  // Active statuses
  in_progress: 'active',
  ongoing: 'active',
  active: 'active',
  active_ongoing: 'active',
  on_track: 'active',
  assigned: 'active',

  // Completed statuses
  completed: 'completed',
  deployed: 'completed',
  deliverable: 'completed',
  required_deliverable: 'completed',

  // Blocked/at-risk statuses
  blocked: 'blocked',
  at_risk: 'blocked',
};

/**
 * Role to team mapping
 * Executive roles map to 'executive', others to their functional team
 */
const ROLE_TO_TEAM = {
  // Executive team
  ceo: 'executive',
  cfo: 'executive',
  coo: 'executive',
  cto: 'executive',
  cmo: 'executive',
  chro: 'executive',
  ciso: 'executive',
  clo: 'executive',
  cos: 'executive',
  cpo: 'executive',
  cco: 'executive',
  cro: 'executive',

  // People team
  'vp-employer-branding': 'people',
  'dir-learning-dev': 'people',
  'hiring_lead': 'people',
  'compliance_lead': 'people',

  // Finance team
  'expense_tracking_lead': 'finance',
  'revenue_analytics_lead': 'finance',

  // Technology team
  'devops-lead': 'technology',
  devops: 'technology',
  'qa-lead': 'technology',
  qa: 'technology',
  data: 'technology',
  'web_dev_lead': 'technology',
  'app_dev_lead': 'technology',
  'infrastructure_lead': 'technology',

  // Marketing team
  'dir-communications': 'marketing',
  'content_strategy_lead': 'marketing',
  'growth_analytics_lead': 'marketing',
  'internal-creative-director': 'marketing',
  'lead-web-designer': 'marketing',

  // Product team
  'ux_research_lead': 'product',
  'product_analytics_lead': 'product',
  'feature_spec_lead': 'product',

  // Operations team
  'head-cs': 'operations',
  'change-mgmt-lead': 'operations',
  'vendor_management_lead': 'operations',
  'process_automation_lead': 'operations',
};

/**
 * Get team for a role, with fallback logic
 */
function getTeamForRole(roleId) {
  if (!roleId) return 'executive';

  const normalizedRole = roleId.toLowerCase().replace(/_/g, '-');

  // Direct lookup
  if (ROLE_TO_TEAM[normalizedRole]) {
    return ROLE_TO_TEAM[normalizedRole];
  }

  // Check with underscores
  const underscoreRole = normalizedRole.replace(/-/g, '_');
  if (ROLE_TO_TEAM[underscoreRole]) {
    return ROLE_TO_TEAM[underscoreRole];
  }

  // Infer from role name patterns
  if (normalizedRole.includes('hr') || normalizedRole.includes('people') || normalizedRole.includes('hiring')) {
    return 'people';
  }
  if (normalizedRole.includes('finance') || normalizedRole.includes('expense') || normalizedRole.includes('revenue')) {
    return 'finance';
  }
  if (normalizedRole.includes('dev') || normalizedRole.includes('qa') || normalizedRole.includes('tech') || normalizedRole.includes('data')) {
    return 'technology';
  }
  if (normalizedRole.includes('market') || normalizedRole.includes('content') || normalizedRole.includes('growth') || normalizedRole.includes('comm')) {
    return 'marketing';
  }
  if (normalizedRole.includes('product') || normalizedRole.includes('ux')) {
    return 'product';
  }
  if (normalizedRole.includes('ops') || normalizedRole.includes('vendor') || normalizedRole.includes('process')) {
    return 'operations';
  }

  // Default to executive for C-level roles
  if (normalizedRole.startsWith('c') && normalizedRole.length <= 4) {
    return 'executive';
  }

  return 'executive';
}

/**
 * Normalize role ID for consistency
 */
function normalizeRoleId(roleId) {
  if (!roleId) return 'unassigned';
  return roleId.toLowerCase().replace(/-/g, '_');
}

// ============================================================================
// TASK TRANSFORMATION
// ============================================================================

/**
 * Generate a unique task ID in the format TASK-YYYYMMDD-ROLE-NNN
 */
function generateTaskId(originalId, roleAbbr, createdAt) {
  const dateStr = createdAt ? createdAt.replace(/-/g, '').slice(0, 8) :
                  new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = originalId.split('-').pop() || '001';
  const role = (roleAbbr || 'UNK').toUpperCase().replace(/-/g, '');
  return `TASK-${dateStr}-${role}-${suffix.padStart(3, '0')}`;
}

/**
 * Build description from workflow and notes
 */
function buildDescription(task) {
  const parts = [];

  if (task.workflow) {
    parts.push(`Workflow: ${task.workflow}`);
  }

  if (task.notes) {
    parts.push(`Notes: ${task.notes}`);
  }

  if (task.steps && task.steps.length > 0) {
    const stepList = task.steps
      .sort((a, b) => a.order - b.order)
      .map(s => `  ${s.order}. ${s.description}${s.completed ? ' [DONE]' : ''}`)
      .join('\n');
    parts.push(`Steps:\n${stepList}`);
  }

  if (task.blockedBy && task.blockedBy.length > 0) {
    parts.push(`Blocked by: ${task.blockedBy.join(', ')}`);
  }

  return parts.join('\n\n') || null;
}

/**
 * Generate tags from task content
 */
function generateTags(task, roleId) {
  const tags = new Set();

  // Add role as tag
  if (roleId) {
    tags.add(roleId.toLowerCase().replace(/-/g, '_'));
  }

  // Add workflow as tag (normalized)
  if (task.workflow) {
    const workflowTag = task.workflow
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 30);
    tags.add(workflowTag);
  }

  // Add priority as tag
  if (task.priority) {
    tags.add(task.priority.toLowerCase());
  }

  // Add some keyword-based tags
  const content = (task.content || task.title || '').toLowerCase();

  if (content.includes('compliance') || content.includes('legal') || content.includes('cra') || content.includes('wcb')) {
    tags.add('compliance');
  }
  if (content.includes('setup') || content.includes('configure') || content.includes('install')) {
    tags.add('setup');
  }
  if (content.includes('document') || content.includes('create') || content.includes('draft')) {
    tags.add('documentation');
  }
  if (content.includes('migrate') || content.includes('migration')) {
    tags.add('migration');
  }
  if (content.includes('test') || content.includes('qa')) {
    tags.add('testing');
  }
  if (content.includes('deploy') || content.includes('release') || content.includes('launch')) {
    tags.add('deployment');
  }

  return Array.from(tags);
}

/**
 * Transform a single task from JSON format to Supabase format
 */
function transformTask(task, roleInfo) {
  const roleId = roleInfo.role_id || 'unknown';
  const roleAbbr = roleInfo.role_abbr || roleId.toUpperCase();
  const createdAt = task.created_at || new Date().toISOString().slice(0, 10);

  const taskId = generateTaskId(task.id, roleAbbr, createdAt);
  const normalizedRole = normalizeRoleId(roleId);
  const team = getTeamForRole(roleId);

  const priority = PRIORITY_MAP[task.priority?.toUpperCase()] || PRIORITY_MAP.MEDIUM;
  const status = STATUS_MAP[task.status?.toLowerCase()] || 'queued';

  return {
    task_id: taskId,
    title: task.content || task.title || 'Untitled Task',
    description: buildDescription(task),
    assigned_agent: normalizedRole,
    assigned_team: team,
    priority: priority,
    status: status,
    due_date: task.due_date || null,
    tags: generateTags(task, roleId),
    metadata: {
      original_id: task.id,
      workflow: task.workflow || null,
      source: 'notebooklm_migration',
      migrated_at: new Date().toISOString(),
      original_status: task.status,
      original_priority: task.priority,
      role_name: roleInfo.role_name || null,
      role_abbr: roleAbbr,
      completed_at: task.completedAt || null,
      completed_by: task.completedBy || null,
      steps: task.steps || null,
      blocked_by: task.blockedBy || null,
    },
    created_at: task.created_at ? new Date(task.created_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Transform remediation tasks (different format)
 */
function transformRemediationTask(task, phaseInfo, projectInfo) {
  const taskId = `TASK-${projectInfo.createdAt?.replace(/-/g, '') || '20260114'}-REM-${task.id.replace('rem-', '').replace('.', '')}`;
  const assignedTo = normalizeRoleId(task.assignedTo);
  const team = getTeamForRole(task.assignedTo);

  const priority = PRIORITY_MAP[task.priority?.toUpperCase()] || PRIORITY_MAP.MEDIUM;
  const status = STATUS_MAP[task.status?.toLowerCase()] || 'queued';

  return {
    task_id: taskId,
    title: task.title,
    description: `Phase: ${phaseInfo.name}\nProject: ${projectInfo.projectName}\n\nEstimated Hours: ${task.estimatedHours || 'N/A'}${task.blockedBy ? `\n\nBlocked by: ${task.blockedBy.join(', ')}` : ''}`,
    assigned_agent: assignedTo,
    assigned_team: team,
    priority: priority,
    status: status,
    due_date: null,
    tags: ['remediation', phaseInfo.name.toLowerCase().replace(/\s+/g, '_'), task.priority?.toLowerCase() || 'medium'],
    metadata: {
      original_id: task.id,
      workflow: phaseInfo.name,
      source: 'notebooklm_migration',
      migrated_at: new Date().toISOString(),
      original_status: task.status,
      original_priority: task.priority,
      phase_id: phaseInfo.id,
      project_id: projectInfo.projectId,
      estimated_hours: task.estimatedHours,
      blocked_by: task.blockedBy || null,
    },
    created_at: projectInfo.createdAt ? new Date(projectInfo.createdAt).toISOString() : new Date().toISOString(),
  };
}

// ============================================================================
// FILE PROCESSING
// ============================================================================

/**
 * Read and parse a JSON file
 */
function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[ERROR] Failed to read ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Process a standard role task file
 */
function processRoleFile(filePath) {
  const data = readJsonFile(filePath);
  if (!data || !data.tasks) {
    return [];
  }

  const roleInfo = {
    role_id: data.role_id,
    role_name: data.role_name,
    role_abbr: data.role_abbr,
  };

  return data.tasks.map(task => transformTask(task, roleInfo));
}

/**
 * Process remediation tasks file
 */
function processRemediationFile(filePath) {
  const data = readJsonFile(filePath);
  if (!data || !data.phases) {
    return [];
  }

  const tasks = [];
  const projectInfo = {
    projectId: data.projectId,
    projectName: data.projectName,
    createdAt: data.createdAt,
  };

  for (const phase of data.phases) {
    for (const task of phase.tasks) {
      tasks.push(transformRemediationTask(task, phase, projectInfo));
    }
  }

  return tasks;
}

/**
 * Files to skip (not task files)
 */
const SKIP_FILES = [
  'migration-analysis.json',
];

/**
 * Get all JSON files from the tasks directory
 */
function getTaskFiles() {
  try {
    const files = fs.readdirSync(TASKS_DIR)
      .filter(f => f.endsWith('.json'))
      .filter(f => !SKIP_FILES.includes(f))
      .map(f => path.join(TASKS_DIR, f));
    return files;
  } catch (error) {
    console.error(`[ERROR] Failed to read tasks directory: ${error.message}`);
    return [];
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Initialize Supabase client
 */
function initSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[ERROR] Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}

/**
 * Check if a task already exists by task_id
 */
async function getExistingTaskIds(supabase, taskIds) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('task_id')
    .in('task_id', taskIds);

  if (error) {
    console.error(`[ERROR] Failed to check existing tasks: ${error.message}`);
    return new Set();
  }

  return new Set(data.map(t => t.task_id));
}

/**
 * Insert tasks in batches
 */
async function insertTaskBatch(supabase, tasks) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(tasks)
    .select();

  if (error) {
    return { success: false, error: error.message, count: 0 };
  }

  return { success: true, count: data.length };
}

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

async function migrate() {
  console.log('='.repeat(70));
  console.log('MONOLITH OS - JSON Task Migration');
  console.log('='.repeat(70));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no database changes)' : 'LIVE MIGRATION'}`);
  console.log(`Tasks directory: ${TASKS_DIR}`);
  console.log(`Target table: ${TABLE_NAME}`);
  console.log('='.repeat(70));
  console.log('');

  // Get all task files
  const taskFiles = getTaskFiles();
  if (taskFiles.length === 0) {
    console.error('[ERROR] No task files found');
    process.exit(1);
  }

  console.log(`[INFO] Found ${taskFiles.length} task files`);

  // Process all files
  const allTasks = [];
  const fileResults = {};

  for (const filePath of taskFiles) {
    const fileName = path.basename(filePath);
    console.log(`[PROCESSING] ${fileName}`);

    let tasks;
    if (fileName === 'remediation-tasks.json') {
      tasks = processRemediationFile(filePath);
    } else {
      tasks = processRoleFile(filePath);
    }

    fileResults[fileName] = tasks.length;
    allTasks.push(...tasks);
    console.log(`  -> ${tasks.length} tasks extracted`);
  }

  console.log('');
  console.log(`[INFO] Total tasks to migrate: ${allTasks.length}`);
  console.log('');

  // Summary by team
  const byTeam = {};
  const byAgent = {};
  const byPriority = {};

  for (const task of allTasks) {
    byTeam[task.assigned_team] = (byTeam[task.assigned_team] || 0) + 1;
    byAgent[task.assigned_agent] = (byAgent[task.assigned_agent] || 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
  }

  console.log('[SUMMARY] Tasks by Team:');
  for (const [team, count] of Object.entries(byTeam).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${team}: ${count}`);
  }
  console.log('');

  console.log('[SUMMARY] Tasks by Priority:');
  for (const priority of [100, 75, 50, 25]) {
    const count = byPriority[priority] || 0;
    const label = { 100: 'CRITICAL', 75: 'HIGH', 50: 'MEDIUM', 25: 'LOW' }[priority];
    console.log(`  ${label} (${priority}): ${count}`);
  }
  console.log('');

  // Dry run - just show sample tasks
  if (DRY_RUN) {
    console.log('[DRY RUN] Sample transformed tasks:');
    console.log('-'.repeat(70));

    // Show 3 sample tasks
    for (let i = 0; i < Math.min(3, allTasks.length); i++) {
      const task = allTasks[i];
      console.log(`\nTask ${i + 1}:`);
      console.log(JSON.stringify(task, null, 2));
    }

    console.log('');
    console.log('-'.repeat(70));
    console.log('[DRY RUN] No database changes made');
    console.log(`[DRY RUN] Would have inserted ${allTasks.length} tasks`);
    console.log('');
    console.log('Run without --dry-run to execute the migration');
    return;
  }

  // Initialize Supabase
  const supabase = initSupabase();
  if (!supabase) {
    process.exit(1);
  }

  console.log('[INFO] Connected to Supabase');

  // Check for existing tasks to skip duplicates
  const allTaskIds = allTasks.map(t => t.task_id);
  const existingIds = await getExistingTaskIds(supabase, allTaskIds);

  if (existingIds.size > 0) {
    console.log(`[INFO] Found ${existingIds.size} existing tasks (will be skipped)`);
  }

  // Filter out existing tasks
  const newTasks = allTasks.filter(t => !existingIds.has(t.task_id));
  console.log(`[INFO] New tasks to insert: ${newTasks.length}`);

  if (newTasks.length === 0) {
    console.log('[INFO] No new tasks to migrate');
    return;
  }

  // Insert in batches
  console.log('');
  console.log('[MIGRATION] Starting batch insert...');

  let totalInserted = 0;
  let totalFailed = 0;
  const batchCount = Math.ceil(newTasks.length / BATCH_SIZE);

  for (let i = 0; i < newTasks.length; i += BATCH_SIZE) {
    const batch = newTasks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    process.stdout.write(`  Batch ${batchNum}/${batchCount} (${batch.length} tasks)... `);

    const result = await insertTaskBatch(supabase, batch);

    if (result.success) {
      totalInserted += result.count;
      console.log(`OK (${result.count} inserted)`);
    } else {
      totalFailed += batch.length;
      console.log(`FAILED: ${result.error}`);
    }
  }

  // Final summary
  console.log('');
  console.log('='.repeat(70));
  console.log('MIGRATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total files processed: ${taskFiles.length}`);
  console.log(`Total tasks found: ${allTasks.length}`);
  console.log(`Already existing (skipped): ${existingIds.size}`);
  console.log(`Successfully inserted: ${totalInserted}`);
  console.log(`Failed: ${totalFailed}`);
  console.log('='.repeat(70));
}

// ============================================================================
// RUN MIGRATION
// ============================================================================

migrate().catch(error => {
  console.error(`[FATAL] Migration failed: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
