#!/usr/bin/env node
/**
 * MONOLITH OS - Dependency Migration Script
 * Phase 7: Task Orchestration Engine
 *
 * Migrates task dependencies from various sources to monolith_task_dependencies table:
 * - Explicit blockedBy arrays in task metadata (remediation-tasks.json style)
 * - Implicit dependencies parsed from task descriptions/notes
 * - Cross-functional dependencies (CTO/COO references, etc.)
 *
 * Usage:
 *   node migrateDependencies.js           # Run migration
 *   node migrateDependencies.js --dry-run # Preview without inserting
 *
 * Environment variables required:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (or SUPABASE_ANON_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  parseDependencies,
  findMatchingTasks,
} from './DependencyParser.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ============================================================================
// CONFIGURATION
// ============================================================================

const TASK_TABLE = 'monolith_task_queue';
const DEPENDENCY_TABLE = 'monolith_task_dependencies';
const BATCH_SIZE = 50;

// Check for dry-run mode
const DRY_RUN = process.argv.includes('--dry-run');

// Dependency type mappings
const DEPENDENCY_TYPE_MAP = {
  blocked_by: 'blocks',
  depends_on: 'blocks',
  requires: 'blocks',
  after_completion: 'blocks',
  needs_first: 'blocks',
  waiting_for: 'blocks',
  when_complete: 'blocks',
  cannot_start_until: 'blocks',
  prerequisite: 'blocks',
  task_id_reference: 'blocks',
  workflow_reference: 'related',
  cross_functional: 'related',
};

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
 * Fetch all tasks from the task queue
 */
async function fetchAllTasks(supabase) {
  const tasks = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(TASK_TABLE)
      .select('id, task_id, title, description, assigned_agent, metadata')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`[ERROR] Failed to fetch tasks: ${error.message}`);
      return [];
    }

    if (data.length === 0) {
      hasMore = false;
    } else {
      tasks.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    }
  }

  return tasks;
}

/**
 * Fetch existing dependencies to avoid duplicates
 */
async function fetchExistingDependencies(supabase) {
  const { data, error } = await supabase
    .from(DEPENDENCY_TABLE)
    .select('task_id, depends_on_task_id');

  if (error) {
    console.error(`[ERROR] Failed to fetch existing dependencies: ${error.message}`);
    return new Set();
  }

  // Create a set of "taskId|dependsOnId" for quick lookup
  return new Set(data.map(d => `${d.task_id}|${d.depends_on_task_id}`));
}

/**
 * Insert dependencies in batches
 */
async function insertDependencyBatch(supabase, dependencies) {
  const { data, error } = await supabase
    .from(DEPENDENCY_TABLE)
    .insert(dependencies)
    .select();

  if (error) {
    return { success: false, error: error.message, count: 0 };
  }

  return { success: true, count: data.length };
}

// ============================================================================
// DEPENDENCY EXTRACTION
// ============================================================================

/**
 * Build a lookup map of original_id to task UUID and task_id
 */
function buildTaskLookups(tasks) {
  const byOriginalId = new Map();
  const byTaskId = new Map();
  const byUuid = new Map();

  for (const task of tasks) {
    const originalId = task.metadata?.original_id;
    if (originalId) {
      byOriginalId.set(originalId.toLowerCase(), task);
    }
    if (task.task_id) {
      byTaskId.set(task.task_id.toLowerCase(), task);
    }
    if (task.id) {
      byUuid.set(task.id, task);
    }
  }

  return { byOriginalId, byTaskId, byUuid };
}

/**
 * Find a task by various identifiers
 */
function findTaskByIdentifier(identifier, lookups, allTasks) {
  if (!identifier) return null;

  const normalizedId = identifier.toLowerCase().trim();

  // Try original_id lookup first
  if (lookups.byOriginalId.has(normalizedId)) {
    return lookups.byOriginalId.get(normalizedId);
  }

  // Try task_id lookup
  if (lookups.byTaskId.has(normalizedId)) {
    return lookups.byTaskId.get(normalizedId);
  }

  // Try UUID lookup
  if (lookups.byUuid.has(identifier)) {
    return lookups.byUuid.get(identifier);
  }

  // Try partial match on original_id (e.g., "rem-1.1" without prefix)
  for (const [key, task] of lookups.byOriginalId) {
    if (key.includes(normalizedId) || normalizedId.includes(key)) {
      return task;
    }
  }

  return null;
}

/**
 * Extract explicit dependencies from metadata.blocked_by array
 */
function extractExplicitDependencies(task, lookups, allTasks) {
  const dependencies = [];
  const blockedBy = task.metadata?.blocked_by;

  if (!blockedBy) return dependencies;

  // Handle array format (standard format from migration)
  let blockers = [];
  if (Array.isArray(blockedBy)) {
    blockers = blockedBy;
  } else if (typeof blockedBy === 'string') {
    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(blockedBy);
      if (Array.isArray(parsed)) {
        blockers = parsed;
      }
    } catch {
      // If not JSON, treat as single value
      blockers = [blockedBy];
    }
  }

  for (const blockerId of blockers) {
    if (!blockerId) continue;

    const dependsOnTask = findTaskByIdentifier(blockerId, lookups, allTasks);

    if (dependsOnTask) {
      dependencies.push({
        task_id: task.id,
        depends_on_task_id: dependsOnTask.id,
        dependency_type: 'blocks',
        source: 'explicit_blocked_by',
        raw_reference: blockerId,
      });
    } else {
      // Log unresolved dependency
      dependencies.push({
        task_id: task.id,
        depends_on_task_id: null,
        dependency_type: 'blocks',
        source: 'explicit_blocked_by',
        raw_reference: blockerId,
        unresolved: true,
      });
    }
  }

  return dependencies;
}

/**
 * Extract implicit dependencies from task description/notes using DependencyParser
 */
function extractImplicitDependencies(task, lookups, allTasks) {
  const dependencies = [];

  // Create a task object compatible with DependencyParser
  const parserTask = {
    id: task.task_id,
    title: task.title,
    description: task.description || '',
    notes: task.metadata?.notes || '',
    metadata: task.metadata || {},
  };

  // Parse dependencies using DependencyParser
  const hints = parseDependencies(parserTask);

  for (const hint of hints) {
    // Skip if confidence is too low
    if (hint.confidence < 0.4) continue;

    // Try to find matching tasks
    const matches = findMatchingTasks(hint, allTasks.map(t => ({
      id: t.task_id,
      uuid: t.id,
      title: t.title,
      description: t.description,
      assigned_to: t.assigned_agent,
      workflow: t.metadata?.workflow,
      tags: [],
      keywords: [],
    })), { minScore: 0.4, maxResults: 3 });

    if (matches.length > 0) {
      const bestMatch = matches[0];
      // Find the actual task by task_id
      const dependsOnTask = lookups.byTaskId.get(bestMatch.task.id?.toLowerCase()) ||
                            allTasks.find(t => t.task_id === bestMatch.task.id);

      if (dependsOnTask && dependsOnTask.id !== task.id) {
        const depType = DEPENDENCY_TYPE_MAP[hint.type] || 'related';
        dependencies.push({
          task_id: task.id,
          depends_on_task_id: dependsOnTask.id,
          dependency_type: depType,
          source: 'implicit_parsed',
          raw_reference: hint.rawMatch,
          confidence: hint.confidence * bestMatch.score,
          match_reasons: bestMatch.matchReasons,
        });
      }
    } else {
      // Log unresolved implicit dependency
      dependencies.push({
        task_id: task.id,
        depends_on_task_id: null,
        dependency_type: DEPENDENCY_TYPE_MAP[hint.type] || 'related',
        source: 'implicit_parsed',
        raw_reference: hint.rawMatch,
        confidence: hint.confidence,
        unresolved: true,
      });
    }
  }

  return dependencies;
}

/**
 * Extract cross-functional dependencies mentioned in notes
 * E.g., "Cross-functional dependency with CTO/COO"
 */
function extractCrossFunctionalDependencies(task, lookups, allTasks) {
  const dependencies = [];
  const description = task.description || '';
  const notes = task.metadata?.notes || '';
  const fullText = `${description} ${notes}`.toLowerCase();

  // Pattern: "Cross-functional dependency with ROLE"
  const crossFuncPattern = /cross[- ]?functional\s+(?:dependency\s+)?(?:with|involving)\s+([a-z/,\s]+)/gi;
  let match;

  while ((match = crossFuncPattern.exec(fullText)) !== null) {
    const rolesText = match[1];
    // Extract individual roles (e.g., "CTO/COO" or "cto, coo")
    const roles = rolesText.split(/[/,]/).map(r => r.trim().toLowerCase()).filter(r => r.length > 1);

    for (const role of roles) {
      // Find tasks assigned to this role that might be related
      const relatedTasks = allTasks.filter(t =>
        t.assigned_agent?.toLowerCase() === role &&
        t.id !== task.id &&
        // Same workflow if available
        (task.metadata?.workflow && t.metadata?.workflow === task.metadata.workflow)
      );

      for (const relatedTask of relatedTasks.slice(0, 2)) { // Limit to 2 per role
        dependencies.push({
          task_id: task.id,
          depends_on_task_id: relatedTask.id,
          dependency_type: 'related',
          source: 'cross_functional',
          raw_reference: `Cross-functional with ${role}`,
        });
      }
    }
  }

  // Pattern: "Awaiting ROLE recommendation/approval/input"
  const awaitingPattern = /awaiting\s+([a-z]+)\s+(recommendation|approval|input|decision)/gi;

  while ((match = awaitingPattern.exec(fullText)) !== null) {
    const role = match[1].toLowerCase();
    const actionType = match[2];

    // Find tasks by this role that might provide the needed output
    const relatedTasks = allTasks.filter(t =>
      t.assigned_agent?.toLowerCase() === role &&
      t.id !== task.id
    );

    // Try to find the most relevant task
    const relevantTask = relatedTasks.find(t => {
      const taskText = (t.title + ' ' + (t.description || '')).toLowerCase();
      return taskText.includes(actionType) ||
             taskText.includes('recommend') ||
             taskText.includes('select') ||
             taskText.includes('decide');
    }) || relatedTasks[0];

    if (relevantTask) {
      dependencies.push({
        task_id: task.id,
        depends_on_task_id: relevantTask.id,
        dependency_type: 'blocks',
        source: 'awaiting_reference',
        raw_reference: `Awaiting ${role} ${actionType}`,
      });
    }
  }

  return dependencies;
}

/**
 * Extract "Dependent on X" patterns from notes
 * E.g., "Dependent on Business Number receipt"
 */
function extractDependentOnPatterns(task, lookups, allTasks) {
  const dependencies = [];
  const description = task.description || '';
  const notes = task.metadata?.notes || '';
  const fullText = `${description} ${notes}`;

  // Pattern: "Dependent on X"
  const dependentPattern = /dependent\s+on\s+([^.]+?)(?:\.|$)/gi;
  let match;

  while ((match = dependentPattern.exec(fullText)) !== null) {
    const dependencyText = match[1].trim();

    // Skip if this is a generic statement
    if (dependencyText.length < 5) continue;

    // Try to find matching task
    const lowerDep = dependencyText.toLowerCase();

    // Look for tasks that match this description
    const matchingTask = allTasks.find(t => {
      const taskText = (t.title + ' ' + (t.description || '')).toLowerCase();
      // Check if key terms match
      const depTerms = lowerDep.split(/\s+/).filter(w => w.length > 3);
      const matchCount = depTerms.filter(term => taskText.includes(term)).length;
      return matchCount >= 2 && t.id !== task.id;
    });

    if (matchingTask) {
      dependencies.push({
        task_id: task.id,
        depends_on_task_id: matchingTask.id,
        dependency_type: 'blocks',
        source: 'dependent_on_pattern',
        raw_reference: dependencyText,
      });
    } else {
      dependencies.push({
        task_id: task.id,
        depends_on_task_id: null,
        dependency_type: 'blocks',
        source: 'dependent_on_pattern',
        raw_reference: dependencyText,
        unresolved: true,
      });
    }
  }

  return dependencies;
}

// ============================================================================
// MAIN MIGRATION FUNCTION
// ============================================================================

async function migrate() {
  console.log('='.repeat(70));
  console.log('MONOLITH OS - Dependency Migration');
  console.log('Phase 7: Task Orchestration Engine');
  console.log('='.repeat(70));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no database changes)' : 'LIVE MIGRATION'}`);
  console.log(`Target table: ${DEPENDENCY_TABLE}`);
  console.log('='.repeat(70));
  console.log('');

  // Initialize Supabase
  const supabase = initSupabase();
  if (!supabase) {
    process.exit(1);
  }
  console.log('[INFO] Connected to Supabase');

  // Fetch all tasks
  console.log('[INFO] Fetching all tasks from monolith_task_queue...');
  const allTasks = await fetchAllTasks(supabase);
  console.log(`[INFO] Found ${allTasks.length} tasks`);

  if (allTasks.length === 0) {
    console.log('[ERROR] No tasks found in database');
    process.exit(1);
  }

  // Build lookup maps
  console.log('[INFO] Building task lookup maps...');
  const lookups = buildTaskLookups(allTasks);
  console.log(`  - By original_id: ${lookups.byOriginalId.size} entries`);
  console.log(`  - By task_id: ${lookups.byTaskId.size} entries`);

  // Fetch existing dependencies
  console.log('[INFO] Checking for existing dependencies...');
  const existingDeps = await fetchExistingDependencies(supabase);
  console.log(`[INFO] Found ${existingDeps.size} existing dependencies`);

  // Extract all dependencies
  console.log('');
  console.log('[INFO] Extracting dependencies from tasks...');

  const allDependencies = [];
  const unresolvedDependencies = [];
  const stats = {
    explicit: 0,
    implicit: 0,
    crossFunctional: 0,
    dependentOn: 0,
    duplicates: 0,
    unresolved: 0,
  };

  for (const task of allTasks) {
    // Extract explicit dependencies (from metadata.blocked_by)
    const explicitDeps = extractExplicitDependencies(task, lookups, allTasks);
    stats.explicit += explicitDeps.filter(d => !d.unresolved).length;

    // Extract implicit dependencies (from description/notes text)
    const implicitDeps = extractImplicitDependencies(task, lookups, allTasks);
    stats.implicit += implicitDeps.filter(d => !d.unresolved).length;

    // Extract cross-functional dependencies
    const crossFuncDeps = extractCrossFunctionalDependencies(task, lookups, allTasks);
    stats.crossFunctional += crossFuncDeps.filter(d => !d.unresolved).length;

    // Extract "Dependent on X" patterns
    const dependentOnDeps = extractDependentOnPatterns(task, lookups, allTasks);
    stats.dependentOn += dependentOnDeps.filter(d => !d.unresolved).length;

    // Combine all dependencies
    const allTaskDeps = [...explicitDeps, ...implicitDeps, ...crossFuncDeps, ...dependentOnDeps];

    // Separate resolved and unresolved
    for (const dep of allTaskDeps) {
      if (dep.unresolved) {
        unresolvedDependencies.push(dep);
        stats.unresolved++;
      } else if (dep.depends_on_task_id) {
        // Check for duplicates
        const key = `${dep.task_id}|${dep.depends_on_task_id}`;
        if (existingDeps.has(key)) {
          stats.duplicates++;
        } else if (!allDependencies.some(d => d.task_id === dep.task_id && d.depends_on_task_id === dep.depends_on_task_id)) {
          allDependencies.push(dep);
          existingDeps.add(key); // Track to avoid duplicates within this run
        } else {
          stats.duplicates++;
        }
      }
    }
  }

  // Summary
  console.log('');
  console.log('[SUMMARY] Dependencies Found:');
  console.log(`  - Explicit (blocked_by): ${stats.explicit}`);
  console.log(`  - Implicit (parsed text): ${stats.implicit}`);
  console.log(`  - Cross-functional: ${stats.crossFunctional}`);
  console.log(`  - Dependent on patterns: ${stats.dependentOn}`);
  console.log(`  - Duplicates skipped: ${stats.duplicates}`);
  console.log(`  - Unresolved: ${stats.unresolved}`);
  console.log(`  - Total to insert: ${allDependencies.length}`);

  // Show unresolved dependencies
  if (unresolvedDependencies.length > 0) {
    console.log('');
    console.log('[WARN] Unresolved Dependencies (dependency target not found):');
    const shown = Math.min(unresolvedDependencies.length, 10);
    for (let i = 0; i < shown; i++) {
      const dep = unresolvedDependencies[i];
      const sourceTask = lookups.byUuid.get(dep.task_id);
      console.log(`  - "${dep.raw_reference}" (from ${sourceTask?.task_id || dep.task_id})`);
    }
    if (unresolvedDependencies.length > shown) {
      console.log(`  ... and ${unresolvedDependencies.length - shown} more`);
    }
  }

  // Dry run - show sample dependencies
  if (DRY_RUN) {
    console.log('');
    console.log('[DRY RUN] Sample dependencies to be created:');
    console.log('-'.repeat(70));

    const samples = allDependencies.slice(0, 10);
    for (const dep of samples) {
      const sourceTask = lookups.byUuid.get(dep.task_id);
      const dependsOnTask = lookups.byUuid.get(dep.depends_on_task_id);
      console.log(`\n  ${sourceTask?.task_id || dep.task_id}`);
      console.log(`    --> depends on: ${dependsOnTask?.task_id || dep.depends_on_task_id}`);
      console.log(`    type: ${dep.dependency_type}, source: ${dep.source}`);
      console.log(`    reason: ${dep.raw_reference}`);
    }

    if (allDependencies.length > 10) {
      console.log(`\n  ... and ${allDependencies.length - 10} more dependencies`);
    }

    console.log('');
    console.log('-'.repeat(70));
    console.log('[DRY RUN] No database changes made');
    console.log(`[DRY RUN] Would have inserted ${allDependencies.length} dependencies`);
    console.log('');
    console.log('Run without --dry-run to execute the migration');
    return;
  }

  // Insert dependencies
  if (allDependencies.length === 0) {
    console.log('[INFO] No new dependencies to insert');
    return;
  }

  console.log('');
  console.log('[MIGRATION] Starting batch insert...');

  // Prepare records for insertion (remove extra fields)
  const records = allDependencies.map(dep => ({
    task_id: dep.task_id,
    depends_on_task_id: dep.depends_on_task_id,
    dependency_type: dep.dependency_type,
  }));

  let totalInserted = 0;
  let totalFailed = 0;
  const batchCount = Math.ceil(records.length / BATCH_SIZE);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    process.stdout.write(`  Batch ${batchNum}/${batchCount} (${batch.length} deps)... `);

    const result = await insertDependencyBatch(supabase, batch);

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
  console.log(`Total tasks processed: ${allTasks.length}`);
  console.log(`Dependencies found: ${allDependencies.length + stats.duplicates}`);
  console.log(`Already existing (skipped): ${stats.duplicates}`);
  console.log(`Unresolved (skipped): ${stats.unresolved}`);
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
