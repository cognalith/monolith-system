/**
 * Phase 6F: Operations Team Deployment Script
 * Cognalith Inc. | Monolith System
 *
 * Deploys the complete Operations Team programmatically:
 * - COO (Team Lead with enhanced powers)
 * - 2 Subordinates (Vendor Management Lead, Process Automation Lead)
 * - Ops Knowledge Bot (advisory research bot)
 *
 * DEPLOYMENT SEQUENCE:
 * 1. Create team record in monolith_teams table
 * 2. Update COO with Team Lead powers
 * 3. Create subordinate agents
 * 4. Create Ops Knowledge Bot in knowledge_bots table
 * 5. Initialize empty task history for each agent
 * 6. Trigger initial Knowledge Bot research cycle
 *
 * USAGE:
 *   node deploy-operations-team.js           # Deploy Operations Team
 *   node deploy-operations-team.js --rollback # Rollback Operations Team deployment
 *   node deploy-operations-team.js --status   # Check deployment status
 */

import { createClient } from '@supabase/supabase-js';
import {
  COO_CONFIG,
  VENDOR_MANAGEMENT_LEAD_CONFIG,
  PROCESS_AUTOMATION_LEAD_CONFIG,
  OPS_KNOWLEDGE_BOT_CONFIG,
  OPERATIONS_TEAM_CONFIGS,
} from './operations-team-configs.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const OPERATIONS_TEAM_ID = 'operations';
const OPERATIONS_TEAM_NAME = 'Operations Team';

// Table names (with optional prefix support)
const TABLE_PREFIX = process.env.SUPABASE_TABLE_PREFIX || '';

// ============================================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================================

/**
 * Initialize Supabase client with error handling
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is required');
  }

  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY environment variable is required');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });
}

/**
 * Get table name with optional prefix
 * @param {string} name - Base table name
 * @returns {string} Full table name with prefix
 */
function table(name) {
  return `${TABLE_PREFIX}${name}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create team record in monolith_teams table
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} teamData
 */
async function createTeam(supabase, teamData) {
  console.log(`  Creating team: ${teamData.team_name}...`);

  // Check if team already exists
  const { data: existing, error: checkError } = await supabase
    .from(table('monolith_teams'))
    .select('team_id')
    .eq('team_id', teamData.team_id)
    .single();

  if (existing) {
    console.log(`  Team '${teamData.team_id}' already exists, updating...`);
    const { error: updateError } = await supabase
      .from(table('monolith_teams'))
      .update({
        team_name: teamData.team_name,
        team_lead_role: teamData.team_lead_role,
        subordinates: teamData.subordinates || [],
        knowledge_bot: teamData.knowledge_bot || null,
        updated_at: new Date().toISOString(),
      })
      .eq('team_id', teamData.team_id);

    if (updateError) {
      throw new Error(`Failed to update team: ${updateError.message}`);
    }
    return { action: 'updated' };
  }

  // Create new team
  const { error: insertError } = await supabase
    .from(table('monolith_teams'))
    .insert([{
      team_id: teamData.team_id,
      team_name: teamData.team_name,
      team_lead_role: teamData.team_lead_role,
      subordinates: teamData.subordinates || [],
      knowledge_bot: teamData.knowledge_bot || null,
      created_at: new Date().toISOString(),
    }]);

  // Handle table not existing
  if (insertError) {
    if (insertError.code === '42P01') {
      console.log(`  Warning: monolith_teams table does not exist, skipping team record creation`);
      return { action: 'skipped', reason: 'table_not_found' };
    }
    throw new Error(`Failed to create team: ${insertError.message}`);
  }

  return { action: 'created' };
}

/**
 * Update an existing agent with new configuration
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} role - Agent role ID
 * @param {Object} config - Agent configuration
 */
async function updateAgent(supabase, role, config) {
  console.log(`  Updating agent: ${role}...`);

  // Try to update in monolith_agents table
  const { error: updateError } = await supabase
    .from(table('monolith_agents'))
    .update({
      role_name: config.persona?.identity || config.role,
      team_id: config.team_id,
      is_team_lead: config.is_team_lead || false,
      reports_to: config.reports_to || config.persona?.escalation?.escalates_to || null,
      persona: config.persona || {},
      skills: config.skills || {},
      knowledge: config.knowledge || {},
      model_config: config.model || {},
      authority_limits: config.authority_limits || config.persona?.team_lead_powers || {},
      updated_at: new Date().toISOString(),
    })
    .eq('role', role);

  if (updateError) {
    if (updateError.code === '42P01') {
      console.log(`  Warning: monolith_agents table does not exist`);
      return { action: 'skipped', reason: 'table_not_found' };
    }
    // Agent might not exist, try to create it
    console.log(`  Agent '${role}' not found, creating...`);
    return await createAgent(supabase, config);
  }

  return { action: 'updated' };
}

/**
 * Create a new agent
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} config - Agent configuration
 */
async function createAgent(supabase, config) {
  const role = config.role;
  console.log(`  Creating agent: ${role}...`);

  // Check if agent already exists
  const { data: existing } = await supabase
    .from(table('monolith_agents'))
    .select('role')
    .eq('role', role)
    .single();

  if (existing) {
    console.log(`  Agent '${role}' already exists, updating...`);
    return await updateAgent(supabase, role, config);
  }

  // Create new agent
  const { error: insertError } = await supabase
    .from(table('monolith_agents'))
    .insert([{
      role: role,
      role_name: config.persona?.identity || role,
      team_id: config.team_id,
      is_team_lead: config.is_team_lead || false,
      is_knowledge_bot: config.is_knowledge_bot || false,
      reports_to: config.reports_to || config.persona?.escalation?.escalates_to || null,
      persona: config.persona || {},
      skills: config.skills || {},
      knowledge: config.knowledge || {},
      model_config: config.model || {},
      authority_limits: config.authority_limits || {},
      status: 'active',
      created_at: new Date().toISOString(),
    }]);

  if (insertError) {
    if (insertError.code === '42P01') {
      console.log(`  Warning: monolith_agents table does not exist, skipping agent creation`);
      return { action: 'skipped', reason: 'table_not_found' };
    }
    throw new Error(`Failed to create agent ${role}: ${insertError.message}`);
  }

  return { action: 'created' };
}

/**
 * Create Knowledge Bot record
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} config - Knowledge Bot configuration
 */
async function createKnowledgeBot(supabase, config) {
  const role = config.role;
  console.log(`  Creating Knowledge Bot: ${role}...`);

  // First create/update in monolith_agents
  const agentResult = await createAgent(supabase, config);

  // Then create/update in knowledge_bots table (specialized table)
  const kbConfig = config.persona?.knowledge_bot_config || config.research_config || {};

  // Check if knowledge bot already exists
  const { data: existing } = await supabase
    .from(table('knowledge_bots'))
    .select('bot_id')
    .eq('bot_id', role)
    .single();

  if (existing) {
    console.log(`  Knowledge Bot '${role}' already exists in knowledge_bots, updating...`);
    const { error: updateError } = await supabase
      .from(table('knowledge_bots'))
      .update({
        team_id: config.team_id,
        team_lead_role: kbConfig.team_lead_role || config.reports_to,
        subordinates: kbConfig.subordinates || [],
        research_config: config.research_config || {},
        focus_areas: config.knowledge?.subordinate_specialties || {},
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('bot_id', role);

    if (updateError && updateError.code !== '42P01') {
      console.log(`  Warning: Failed to update knowledge_bots record: ${updateError.message}`);
    }
    return { action: 'updated', agentResult };
  }

  // Create new knowledge bot record
  const { error: insertError } = await supabase
    .from(table('knowledge_bots'))
    .insert([{
      bot_id: role,
      team_id: config.team_id,
      team_lead_role: kbConfig.team_lead_role || config.reports_to,
      subordinates: kbConfig.subordinates || [],
      research_config: config.research_config || {},
      focus_areas: config.knowledge?.subordinate_specialties || {},
      status: 'active',
      total_recommendations: 0,
      successful_recommendations: 0,
      last_research_cycle: null,
      created_at: new Date().toISOString(),
    }]);

  if (insertError) {
    if (insertError.code === '42P01') {
      console.log(`  Warning: knowledge_bots table does not exist, Knowledge Bot created only in monolith_agents`);
      return { action: 'partial', agentResult, reason: 'knowledge_bots_table_not_found' };
    }
    console.log(`  Warning: Failed to create knowledge_bots record: ${insertError.message}`);
    return { action: 'partial', agentResult, reason: insertError.message };
  }

  return { action: 'created', agentResult };
}

/**
 * Initialize empty task history for an agent
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} role - Agent role ID
 */
async function initializeAgentMemory(supabase, role) {
  console.log(`  Initializing memory for: ${role}...`);

  // Initialize in monolith_agent_memory table
  const { data: existing } = await supabase
    .from(table('monolith_agent_memory'))
    .select('agent_role')
    .eq('agent_role', role)
    .single();

  if (existing) {
    console.log(`  Memory for '${role}' already exists, skipping...`);
    return { action: 'skipped', reason: 'already_exists' };
  }

  const { error: insertError } = await supabase
    .from(table('monolith_agent_memory'))
    .insert([{
      agent_role: role,
      task_history: [],
      decision_history: [],
      learning_stats: {
        total_tasks: 0,
        successful_tasks: 0,
        failed_tasks: 0,
        success_rate: 0,
      },
      last_active: null,
      created_at: new Date().toISOString(),
    }]);

  if (insertError) {
    if (insertError.code === '42P01') {
      console.log(`  Warning: monolith_agent_memory table does not exist`);
      return { action: 'skipped', reason: 'table_not_found' };
    }
    console.log(`  Warning: Failed to initialize memory for ${role}: ${insertError.message}`);
    return { action: 'skipped', reason: insertError.message };
  }

  return { action: 'created' };
}

/**
 * Trigger initial Knowledge Bot research cycle
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} botRole - Knowledge Bot role ID
 */
async function triggerKnowledgeBotResearch(supabase, botRole) {
  console.log(`  Scheduling initial research cycle for: ${botRole}...`);

  // Create a research task for the Knowledge Bot
  const { error: insertError } = await supabase
    .from(table('tasks'))
    .insert([{
      external_id: `kb-init-${botRole}-${Date.now()}`,
      title: `Initial Research Cycle - ${botRole}`,
      description: 'Perform initial research cycle to gather baseline recommendations for operations team subordinates',
      assigned_to: botRole,
      status: 'pending',
      priority: 'MEDIUM',
      metadata: {
        type: 'knowledge_bot_research',
        is_initial_cycle: true,
        scheduled_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    }]);

  if (insertError) {
    if (insertError.code === '42P01') {
      console.log(`  Warning: tasks table does not exist`);
      return { action: 'skipped', reason: 'table_not_found' };
    }
    console.log(`  Warning: Failed to schedule research cycle: ${insertError.message}`);
    return { action: 'skipped', reason: insertError.message };
  }

  return { action: 'scheduled' };
}

// ============================================================================
// MAIN DEPLOYMENT FUNCTION
// ============================================================================

/**
 * Deploy the complete Operations Team
 * @returns {Promise<Object>} Deployment result
 */
async function deployOperationsTeam() {
  console.log('\n========================================');
  console.log('  OPERATIONS TEAM DEPLOYMENT - Phase 6F');
  console.log('========================================\n');

  const startTime = Date.now();
  const results = {
    team: null,
    teamLead: null,
    subordinates: [],
    knowledgeBot: null,
    memoryInit: [],
    researchTrigger: null,
    errors: [],
  };

  try {
    // Initialize Supabase
    console.log('Initializing Supabase connection...');
    const supabase = initializeSupabase();
    console.log('  Connected to Supabase\n');

    // Step 1: Create team record
    console.log('Step 1: Creating team record...');
    try {
      results.team = await createTeam(supabase, {
        team_id: OPERATIONS_TEAM_ID,
        team_name: OPERATIONS_TEAM_NAME,
        team_lead_role: 'coo',
        subordinates: [
          'vendor_management_lead',
          'process_automation_lead',
        ],
        knowledge_bot: 'ops_knowledge_bot',
      });
      console.log(`  Team record: ${results.team.action}\n`);
    } catch (error) {
      console.log(`  Error creating team: ${error.message}\n`);
      results.errors.push({ step: 'create_team', error: error.message });
    }

    // Step 2: Update COO with Team Lead powers
    console.log('Step 2: Updating COO with Team Lead powers...');
    try {
      results.teamLead = await updateAgent(supabase, 'coo', COO_CONFIG);
      console.log(`  COO: ${results.teamLead.action}\n`);
    } catch (error) {
      console.log(`  Error updating COO: ${error.message}\n`);
      results.errors.push({ step: 'update_coo', error: error.message });
    }

    // Step 3: Create subordinates
    console.log('Step 3: Creating subordinate agents...');
    const subordinates = [
      VENDOR_MANAGEMENT_LEAD_CONFIG,
      PROCESS_AUTOMATION_LEAD_CONFIG,
    ];

    for (const config of subordinates) {
      try {
        const result = await createAgent(supabase, config);
        results.subordinates.push({ role: config.role, ...result });
        console.log(`    ${config.role}: ${result.action}`);
      } catch (error) {
        console.log(`    ${config.role}: ERROR - ${error.message}`);
        results.errors.push({ step: `create_${config.role}`, error: error.message });
        results.subordinates.push({ role: config.role, action: 'error', error: error.message });
      }
    }
    console.log('');

    // Step 4: Create Knowledge Bot
    console.log('Step 4: Creating Ops Knowledge Bot...');
    try {
      results.knowledgeBot = await createKnowledgeBot(supabase, OPS_KNOWLEDGE_BOT_CONFIG);
      console.log(`  ops_knowledge_bot: ${results.knowledgeBot.action}\n`);
    } catch (error) {
      console.log(`  Error creating Knowledge Bot: ${error.message}\n`);
      results.errors.push({ step: 'create_knowledge_bot', error: error.message });
    }

    // Step 5: Initialize agent memory
    console.log('Step 5: Initializing agent memory...');
    const allRoles = [
      'coo',
      'vendor_management_lead',
      'process_automation_lead',
      'ops_knowledge_bot',
    ];

    for (const role of allRoles) {
      try {
        const result = await initializeAgentMemory(supabase, role);
        results.memoryInit.push({ role, ...result });
        console.log(`    ${role}: ${result.action}`);
      } catch (error) {
        console.log(`    ${role}: ERROR - ${error.message}`);
        results.memoryInit.push({ role, action: 'error', error: error.message });
      }
    }
    console.log('');

    // Step 6: Trigger initial research cycle
    console.log('Step 6: Triggering initial Knowledge Bot research...');
    try {
      results.researchTrigger = await triggerKnowledgeBotResearch(supabase, 'ops_knowledge_bot');
      console.log(`  Research trigger: ${results.researchTrigger.action}\n`);
    } catch (error) {
      console.log(`  Error triggering research: ${error.message}\n`);
      results.errors.push({ step: 'trigger_research', error: error.message });
    }

  } catch (error) {
    console.error(`\nFatal error: ${error.message}`);
    results.errors.push({ step: 'initialization', error: error.message });
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const agentsCreated = results.subordinates.filter(s => s.action === 'created').length +
    (results.teamLead?.action === 'created' ? 1 : 0) +
    (results.knowledgeBot?.action === 'created' ? 1 : 0);
  const agentsUpdated = results.subordinates.filter(s => s.action === 'updated').length +
    (results.teamLead?.action === 'updated' ? 1 : 0) +
    (results.knowledgeBot?.action === 'updated' ? 1 : 0);

  console.log('========================================');
  console.log('  DEPLOYMENT SUMMARY');
  console.log('========================================');
  console.log(`  Time elapsed: ${elapsed}s`);
  console.log(`  Agents created: ${agentsCreated}`);
  console.log(`  Agents updated: ${agentsUpdated}`);
  console.log(`  Errors: ${results.errors.length}`);
  console.log(`  Success: ${results.errors.length === 0 ? 'YES' : 'PARTIAL'}`);
  console.log('========================================\n');

  return {
    success: results.errors.length === 0,
    agents_created: agentsCreated,
    agents_updated: agentsUpdated,
    elapsed_seconds: parseFloat(elapsed),
    results,
  };
}

// ============================================================================
// ROLLBACK FUNCTION
// ============================================================================

/**
 * Rollback Operations Team deployment
 * @returns {Promise<Object>} Rollback result
 */
async function rollbackOperationsTeam() {
  console.log('\n========================================');
  console.log('  OPERATIONS TEAM ROLLBACK - Phase 6F');
  console.log('========================================\n');

  const startTime = Date.now();
  const results = {
    agents_deleted: [],
    team_deleted: false,
    memory_deleted: [],
    errors: [],
  };

  try {
    const supabase = initializeSupabase();
    console.log('Connected to Supabase\n');

    const allRoles = [
      'ops_knowledge_bot',
      'process_automation_lead',
      'vendor_management_lead',
    ];

    // Delete agents (not COO - just remove team lead config)
    console.log('Deleting subordinate agents...');
    for (const role of allRoles) {
      try {
        const { error } = await supabase
          .from(table('monolith_agents'))
          .delete()
          .eq('role', role);

        if (error && error.code !== '42P01') {
          console.log(`  ${role}: ERROR - ${error.message}`);
          results.errors.push({ step: `delete_${role}`, error: error.message });
        } else {
          console.log(`  ${role}: deleted`);
          results.agents_deleted.push(role);
        }
      } catch (error) {
        console.log(`  ${role}: ERROR - ${error.message}`);
        results.errors.push({ step: `delete_${role}`, error: error.message });
      }
    }

    // Delete knowledge bot record
    console.log('\nDeleting knowledge bot record...');
    try {
      await supabase
        .from(table('knowledge_bots'))
        .delete()
        .eq('bot_id', 'ops_knowledge_bot');
      console.log('  ops_knowledge_bot: deleted from knowledge_bots');
    } catch (error) {
      console.log(`  Warning: ${error.message}`);
    }

    // Delete team record
    console.log('\nDeleting team record...');
    try {
      const { error } = await supabase
        .from(table('monolith_teams'))
        .delete()
        .eq('team_id', OPERATIONS_TEAM_ID);

      if (error && error.code !== '42P01') {
        console.log(`  ERROR: ${error.message}`);
      } else {
        console.log(`  Team 'operations': deleted`);
        results.team_deleted = true;
      }
    } catch (error) {
      console.log(`  Warning: ${error.message}`);
    }

    // Delete agent memory
    console.log('\nDeleting agent memory...');
    for (const role of allRoles) {
      try {
        await supabase
          .from(table('monolith_agent_memory'))
          .delete()
          .eq('agent_role', role);
        console.log(`  ${role}: memory deleted`);
        results.memory_deleted.push(role);
      } catch (error) {
        // Ignore errors
      }
    }

    // Update COO to remove team lead config
    console.log('\nResetting COO team lead config...');
    try {
      await supabase
        .from(table('monolith_agents'))
        .update({
          is_team_lead: false,
          updated_at: new Date().toISOString(),
        })
        .eq('role', 'coo');
      console.log('  COO: team lead config removed');
    } catch (error) {
      console.log(`  Warning: ${error.message}`);
    }

  } catch (error) {
    console.error(`\nFatal error: ${error.message}`);
    results.errors.push({ step: 'initialization', error: error.message });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n========================================');
  console.log('  ROLLBACK SUMMARY');
  console.log('========================================');
  console.log(`  Time elapsed: ${elapsed}s`);
  console.log(`  Agents deleted: ${results.agents_deleted.length}`);
  console.log(`  Team deleted: ${results.team_deleted ? 'YES' : 'NO'}`);
  console.log(`  Errors: ${results.errors.length}`);
  console.log('========================================\n');

  return {
    success: results.errors.length === 0,
    elapsed_seconds: parseFloat(elapsed),
    results,
  };
}

// ============================================================================
// STATUS CHECK FUNCTION
// ============================================================================

/**
 * Check Operations Team deployment status
 * @returns {Promise<Object>} Status result
 */
async function checkStatus() {
  console.log('\n========================================');
  console.log('  OPERATIONS TEAM STATUS CHECK');
  console.log('========================================\n');

  const status = {
    team_exists: false,
    agents: {},
    knowledge_bot: {},
    errors: [],
  };

  try {
    const supabase = initializeSupabase();

    // Check team
    const { data: team } = await supabase
      .from(table('monolith_teams'))
      .select('*')
      .eq('team_id', OPERATIONS_TEAM_ID)
      .single();

    status.team_exists = !!team;
    if (team) {
      console.log('Team record: EXISTS');
      console.log(`  Team Lead: ${team.team_lead_role}`);
      console.log(`  Subordinates: ${team.subordinates?.length || 0}`);
      console.log(`  Knowledge Bot: ${team.knowledge_bot || 'none'}`);
    } else {
      console.log('Team record: NOT FOUND');
    }

    // Check agents
    console.log('\nAgent Status:');
    const allRoles = [
      'coo',
      'vendor_management_lead',
      'process_automation_lead',
      'ops_knowledge_bot',
    ];

    for (const role of allRoles) {
      const { data: agent } = await supabase
        .from(table('monolith_agents'))
        .select('role, status, is_team_lead, is_knowledge_bot, created_at')
        .eq('role', role)
        .single();

      if (agent) {
        const flags = [];
        if (agent.is_team_lead) flags.push('TEAM_LEAD');
        if (agent.is_knowledge_bot) flags.push('KB');
        const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
        console.log(`  ${role}: EXISTS${flagStr}`);
        status.agents[role] = { exists: true, ...agent };
      } else {
        console.log(`  ${role}: NOT FOUND`);
        status.agents[role] = { exists: false };
      }
    }

    // Check knowledge bot
    console.log('\nKnowledge Bot Status:');
    const { data: kb } = await supabase
      .from(table('knowledge_bots'))
      .select('*')
      .eq('bot_id', 'ops_knowledge_bot')
      .single();

    if (kb) {
      console.log('  Record: EXISTS');
      console.log(`  Total Recommendations: ${kb.total_recommendations || 0}`);
      console.log(`  Successful: ${kb.successful_recommendations || 0}`);
      console.log(`  Last Research: ${kb.last_research_cycle || 'never'}`);
      status.knowledge_bot = { exists: true, ...kb };
    } else {
      console.log('  Record: NOT FOUND in knowledge_bots table');
      status.knowledge_bot = { exists: false };
    }

  } catch (error) {
    console.error(`\nError: ${error.message}`);
    status.errors.push(error.message);
  }

  console.log('\n========================================\n');
  return status;
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

// Check if running as main module
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const args = process.argv.slice(2);
  const command = args[0] || 'deploy';

  let result;

  switch (command) {
    case '--rollback':
    case 'rollback':
      result = await rollbackOperationsTeam();
      break;

    case '--status':
    case 'status':
      result = await checkStatus();
      break;

    case '--help':
    case 'help':
      console.log(`
Operations Team Deployment Script - Phase 6F

Usage:
  node deploy-operations-team.js           Deploy Operations Team
  node deploy-operations-team.js --rollback Rollback deployment
  node deploy-operations-team.js --status   Check deployment status
  node deploy-operations-team.js --help     Show this help

Environment Variables Required:
  SUPABASE_URL              Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY Supabase service role key (or SUPABASE_SERVICE_KEY)

Optional:
  SUPABASE_TABLE_PREFIX     Prefix for table names (e.g., 'monolith_')
`);
      process.exit(0);
      break;

    default:
      result = await deployOperationsTeam();
  }

  // Exit with appropriate code
  process.exit(result?.success === false || result?.errors?.length > 0 ? 1 : 0);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  deployOperationsTeam,
  rollbackOperationsTeam,
  checkStatus,
  createTeam,
  createAgent,
  updateAgent,
  createKnowledgeBot,
  initializeAgentMemory,
  triggerKnowledgeBotResearch,
};

export default deployOperationsTeam;
