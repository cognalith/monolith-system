/**
 * AMENDMENT SYSTEM - Test Suite (Phase 5C)
 * Cognalith Inc. | Monolith System
 *
 * Tests Pattern Detection, Amendment Generation, Knowledge Computation,
 * Safety Constraints, and Approval Workflow.
 *
 * Focus: CFO agent as the primary test case
 */

import 'dotenv/config';
import { PatternDetector, PATTERN_TYPES } from './PatternDetector.js';
import { AmendmentEngine } from './AmendmentEngine.js';
import { KnowledgeComputer } from './KnowledgeComputer.js';
import { AmendmentSafety, PROTECTED_PATTERNS } from './AmendmentSafety.js';
import { ApprovalWorkflow } from './ApprovalWorkflow.js';
import { createClient } from '@supabase/supabase-js';

const TEST_AGENT = 'cfo';
const TEST_TASK_PREFIX = `test-amendment-${Date.now()}`;

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('       AMENDMENT SYSTEM - TEST SUITE (Phase 5C)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results = { passed: 0, failed: 0, tests: [] };

  const test = async (name, fn) => {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: '✓ PASS' });
      console.log(`  ✓ ${name}`);
    } catch (err) {
      results.failed++;
      results.tests.push({ name, status: '✗ FAIL', error: err.message });
      console.log(`  ✗ ${name}: ${err.message}`);
    }
  };

  // Initialize clients
  const patternDetector = new PatternDetector();
  const amendmentEngine = new AmendmentEngine();
  const knowledgeComputer = new KnowledgeComputer();
  const amendmentSafety = new AmendmentSafety();
  const approvalWorkflow = new ApprovalWorkflow();

  // Direct Supabase client for setup/cleanup
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  );

  // =========================================================================
  // SETUP: Create test task history for CFO
  // =========================================================================
  console.log('Setup: Creating test task history for CFO...');

  // Insert test tasks with some failures to trigger pattern detection
  const testTasks = [
    { task_id: `${TEST_TASK_PREFIX}-1`, agent_role: TEST_AGENT, title: 'Process Q4 expense reports', task_category: 'expense_report', success: true, time_taken_seconds: 120, quality_score: 0.85 },
    { task_id: `${TEST_TASK_PREFIX}-2`, agent_role: TEST_AGENT, title: 'Review vendor expenses', task_category: 'expense_report', success: false, failure_reason: 'Missing receipts', time_taken_seconds: 180 },
    { task_id: `${TEST_TASK_PREFIX}-3`, agent_role: TEST_AGENT, title: 'Analyze Q4 budget', task_category: 'budget_analysis', success: true, time_taken_seconds: 300, quality_score: 0.90 },
    { task_id: `${TEST_TASK_PREFIX}-4`, agent_role: TEST_AGENT, title: 'Categorize travel expenses', task_category: 'expense_report', success: false, failure_reason: 'Incorrect categorization', time_taken_seconds: 200 },
    { task_id: `${TEST_TASK_PREFIX}-5`, agent_role: TEST_AGENT, title: 'Budget variance analysis', task_category: 'budget_analysis', success: true, time_taken_seconds: 350, quality_score: 0.75 },
    { task_id: `${TEST_TASK_PREFIX}-6`, agent_role: TEST_AGENT, title: 'Process marketing expenses', task_category: 'expense_report', success: false, failure_reason: 'Missing receipts', time_taken_seconds: 190 },
    { task_id: `${TEST_TASK_PREFIX}-7`, agent_role: TEST_AGENT, title: 'Pay vendor invoice', task_category: 'vendor_payment', success: true, time_taken_seconds: 100, quality_score: 0.95 },
    { task_id: `${TEST_TASK_PREFIX}-8`, agent_role: TEST_AGENT, title: 'Process office supplies expense', task_category: 'expense_report', success: false, failure_reason: 'Missing approval', time_taken_seconds: 150 },
  ];

  for (const task of testTasks) {
    await supabase.from('monolith_task_history').insert([{
      ...task,
      completed_at: new Date().toISOString(),
    }]);
  }
  console.log(`  Created ${testTasks.length} test tasks\n`);

  // =========================================================================
  // PATTERN DETECTOR TESTS
  // =========================================================================
  console.log('Pattern Detector Tests:');

  await test('PatternDetector initializes', () => {
    if (!patternDetector.isAvailable()) {
      throw new Error('PatternDetector not connected');
    }
  });

  let detectedPatterns = [];
  await test('Detects repeated failure pattern', async () => {
    const { patterns, error } = await patternDetector.detectPatterns(TEST_AGENT);
    if (error) throw new Error(error.message);

    detectedPatterns = patterns;

    // Should detect repeated_failure pattern (4 out of 8 tasks failed = 50%)
    const failurePattern = patterns.find(p => p.type === PATTERN_TYPES.REPEATED_FAILURE);
    if (!failurePattern) throw new Error('Should detect repeated failure pattern');
    if (failurePattern.confidence < 0.6) throw new Error('Confidence too low');
  });

  await test('Detects category weakness pattern OR repeated failure captures it', async () => {
    // With high failure rate in expense_report, either category_weakness or repeated_failure will trigger
    const categoryPattern = detectedPatterns.find(p => p.type === PATTERN_TYPES.CATEGORY_WEAKNESS);
    const failurePattern = detectedPatterns.find(p => p.type === PATTERN_TYPES.REPEATED_FAILURE);

    if (!categoryPattern && !failurePattern) {
      throw new Error('Should detect either category weakness or repeated failure pattern');
    }

    // If category weakness detected, verify the weak category
    if (categoryPattern && categoryPattern.data.weak_category !== 'expense_report') {
      throw new Error(`Expected weak_category: expense_report, got: ${categoryPattern.data.weak_category}`);
    }

    // If repeated failure detected, verify it identifies expense_report as problematic
    if (failurePattern && failurePattern.data.primary_category !== 'expense_report') {
      throw new Error(`Expected primary_category: expense_report, got: ${failurePattern.data.primary_category}`);
    }
  });

  let loggedPatternId;
  await test('Logs pattern to database', async () => {
    const pattern = detectedPatterns[0];
    const { data, error } = await patternDetector.logPattern(TEST_AGENT, pattern);
    if (error) throw new Error(error.message);
    if (!data.id) throw new Error('No pattern ID returned');
    loggedPatternId = data.id;
  });

  // =========================================================================
  // AMENDMENT ENGINE TESTS
  // =========================================================================
  console.log('\nAmendment Engine Tests:');

  await test('AmendmentEngine initializes', () => {
    if (!amendmentEngine.isAvailable()) {
      throw new Error('AmendmentEngine not connected');
    }
  });

  let generatedAmendment;
  await test('Generates amendment from pattern', () => {
    const pattern = detectedPatterns.find(p => p.type === PATTERN_TYPES.REPEATED_FAILURE);
    const { error, amendment } = amendmentEngine.generateAmendment(pattern);
    if (error) throw new Error(error);
    if (!amendment.trigger_pattern) throw new Error('Missing trigger_pattern');
    if (!amendment.instruction_delta) throw new Error('Missing instruction_delta');
    generatedAmendment = amendment;
  });

  let createdAmendmentId;
  await test('Creates amendment in database (pending approval)', async () => {
    const { data, error } = await amendmentEngine.createAmendment(TEST_AGENT, generatedAmendment);
    if (error) throw new Error(error.message);
    if (data.approval_status !== 'pending') throw new Error('Should be pending approval');
    if (data.is_active !== false) throw new Error('Should not be active before approval');
    createdAmendmentId = data.id;
  });

  await test('Gets pending amendments', async () => {
    const { data, error } = await amendmentEngine.getPendingAmendments(TEST_AGENT);
    if (error) throw new Error(error.message);
    const testAmendment = data.find(a => a.id === createdAmendmentId);
    if (!testAmendment) throw new Error('Created amendment not in pending list');
  });

  // =========================================================================
  // APPROVAL WORKFLOW TESTS
  // =========================================================================
  console.log('\nApproval Workflow Tests:');

  await test('ApprovalWorkflow initializes', () => {
    if (!approvalWorkflow.isAvailable()) {
      throw new Error('ApprovalWorkflow not connected');
    }
  });

  await test('Strict mode requires approval for all', async () => {
    const result = await approvalWorkflow.requiresApproval(TEST_AGENT, 'behavioral');
    if (!result.required) throw new Error('Should require approval in strict mode');
  });

  await test('Gets pending approvals', async () => {
    const { data, error } = await approvalWorkflow.getPendingApprovals();
    if (error) throw new Error(error.message);
    const testAmendment = data.find(a => a.id === createdAmendmentId);
    if (!testAmendment) throw new Error('Amendment not in pending approvals');
  });

  await test('Formats pending amendments for CEO', () => {
    const formatted = approvalWorkflow.formatPendingAmendments([{
      id: 'test-id-123',
      agent_role: 'cfo',
      amendment_type: 'behavioral',
      trigger_pattern: 'task_category:expense_report',
      instruction_delta: 'Test instruction',
      pattern_confidence: 0.75,
      created_at: new Date().toISOString(),
    }]);
    if (!formatted.includes('CFO')) throw new Error('Missing agent role');
    if (!formatted.includes('PENDING AMENDMENTS')) throw new Error('Missing header');
  });

  await test('Approves amendment', async () => {
    const { data, error } = await approvalWorkflow.approve(createdAmendmentId, 'frank', 'Test approval');
    if (error) throw new Error(error.message);
    if (data.approval_status !== 'approved') throw new Error('Status should be approved');
    if (data.is_active !== true) throw new Error('Should be active after approval');
    if (data.approved_by !== 'frank') throw new Error('Wrong approver');
  });

  // =========================================================================
  // KNOWLEDGE COMPUTER TESTS
  // =========================================================================
  console.log('\nKnowledge Computer Tests:');

  await test('KnowledgeComputer initializes', () => {
    if (!knowledgeComputer.isAvailable()) {
      throw new Error('KnowledgeComputer not connected');
    }
  });

  await test('Initializes knowledge layer for CFO', async () => {
    await knowledgeComputer.initializeKnowledgeLayer(TEST_AGENT);
    const { data, error } = await knowledgeComputer.getEffectiveKnowledge(TEST_AGENT, true);
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No knowledge returned');
  });

  await test('Computes effective knowledge with amendments', async () => {
    const { data, error } = await knowledgeComputer.computeEffectiveKnowledge(TEST_AGENT);
    if (error) throw new Error(error.message);
    if (!data.amendments) throw new Error('Missing amendments in effective knowledge');
    if (data.amendments.instruction_deltas.length === 0) {
      throw new Error('Should have instruction deltas from approved amendment');
    }
  });

  await test('Gets applicable instructions for task context', async () => {
    const instructions = await knowledgeComputer.getApplicableInstructions(TEST_AGENT, {
      category: 'expense_report',
    });
    if (instructions.length === 0) throw new Error('Should have applicable instructions');
  });

  await test('Caches effective knowledge', async () => {
    // Clear cache first to ensure clean test
    knowledgeComputer.invalidateCache(TEST_AGENT);

    const { data: first, fromCache: fromCache1 } = await knowledgeComputer.getEffectiveKnowledge(TEST_AGENT);
    const { data: second, fromCache: fromCache2 } = await knowledgeComputer.getEffectiveKnowledge(TEST_AGENT);

    if (fromCache1) throw new Error('First call should not be from cache');
    if (!fromCache2) throw new Error('Second call should be from cache');
    if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Cached data mismatch');
  });

  // =========================================================================
  // AMENDMENT EVALUATION TESTS
  // =========================================================================
  console.log('\nAmendment Evaluation Tests:');

  await test('Records evaluation result', async () => {
    const { data, error } = await amendmentEngine.recordEvaluation(createdAmendmentId, `${TEST_TASK_PREFIX}-eval-1`, {
      success: true,
      time_seconds: 100,
      quality_score: 0.85,
      feedback: 'Good performance',
    });
    if (error) throw new Error(error.message);
    if (data.evaluation_position !== 1) throw new Error('Should be position 1');
  });

  await test('Gets evaluation progress', async () => {
    const { data, error } = await amendmentEngine.getEvaluationProgress(createdAmendmentId);
    if (error) throw new Error(error.message);
    if (data.completed !== 1) throw new Error('Should have 1 evaluation');
    if (data.successes !== 1) throw new Error('Should have 1 success');
  });

  // =========================================================================
  // AMENDMENT SAFETY TESTS
  // =========================================================================
  console.log('\nAmendment Safety Tests:');

  await test('AmendmentSafety initializes', () => {
    if (!amendmentSafety.isAvailable()) {
      throw new Error('AmendmentSafety not connected');
    }
  });

  await test('Rejects protected pattern modification', async () => {
    const badAmendment = {
      trigger_pattern: 'bypass_approval_gate',
      instruction_delta: 'Disable safety checks',
      knowledge_mutation: {},
    };
    const { valid, violations } = await amendmentSafety.validateAmendment(TEST_AGENT, badAmendment);
    if (valid) throw new Error('Should reject protected pattern');
    if (violations.length === 0) throw new Error('Should have violations');
  });

  await test('Validates safe amendment', async () => {
    const safeAmendment = {
      trigger_pattern: 'task_category:reports',
      instruction_delta: 'Double-check calculations',
      knowledge_mutation: { quality_standards: { verification: true } },
    };
    const { valid, violations } = await amendmentSafety.validateAmendment(TEST_AGENT, safeAmendment);
    if (!valid) throw new Error(`Should accept safe amendment: ${violations.join(', ')}`);
  });

  await test('Detects contradicting amendments', async () => {
    // First create another amendment
    const { data: secondAmendment } = await amendmentEngine.createAmendment(TEST_AGENT, {
      amendment_type: 'efficiency',
      trigger_pattern: 'task_category:expense_report',  // Same trigger as existing
      instruction_delta: 'Process faster',
      knowledge_mutation: {},
      pattern_confidence: 0.7,
    }, true);  // auto-approve for testing

    // Should detect conflict
    const thirdAmendment = {
      trigger_pattern: 'task_category:expense_report',  // Conflict!
      instruction_delta: 'Process slower',
      knowledge_mutation: {},
    };
    const { valid } = await amendmentSafety.validateAmendment(TEST_AGENT, thirdAmendment);
    if (valid) throw new Error('Should detect conflicting amendment');

    // Cleanup
    if (secondAmendment) {
      await supabase.from('monolith_amendments').delete().eq('id', secondAmendment.id);
    }
  });

  await test('Checks protected action', () => {
    if (!amendmentSafety.isProtectedAction('checkout process')) {
      throw new Error('checkout should be protected');
    }
    if (amendmentSafety.isProtectedAction('generate report')) {
      throw new Error('generate report should not be protected');
    }
  });

  // =========================================================================
  // VERSION MANAGEMENT TESTS
  // =========================================================================
  console.log('\nVersion Management Tests:');

  await test('Creates new version of amendment', async () => {
    const { data, error } = await amendmentEngine.createNewVersion(createdAmendmentId, {
      instruction_delta: 'Updated instruction for expense reports v2',
    });
    if (error) throw new Error(error.message);
    if (data.version !== 2) throw new Error(`Expected version 2, got ${data.version}`);
    if (data.parent_amendment_id !== createdAmendmentId) throw new Error('Wrong parent ID');

    // Cleanup: delete the new version
    await supabase.from('monolith_amendments').delete().eq('id', data.id);
  });

  // =========================================================================
  // CLEANUP
  // =========================================================================
  console.log('\nCleanup:');

  await test('Clean up test data', async () => {
    // Delete test tasks
    await supabase
      .from('monolith_task_history')
      .delete()
      .like('task_id', `${TEST_TASK_PREFIX}%`);

    // Delete test amendments
    await supabase
      .from('monolith_amendments')
      .delete()
      .eq('id', createdAmendmentId);

    // Delete test pattern log
    if (loggedPatternId) {
      await supabase
        .from('monolith_pattern_log')
        .delete()
        .eq('id', loggedPatternId);
    }

    // Delete test evaluations
    await supabase
      .from('monolith_amendment_evaluations')
      .delete()
      .eq('amendment_id', createdAmendmentId);
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total:  ${results.passed + results.failed}`);
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (results.failed > 0) {
    console.log('Failed Tests:');
    results.tests.filter(t => t.status.includes('FAIL')).forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
    process.exit(1);
  }

  console.log('All tests passed! Amendment System (Phase 5C) is working correctly.\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
