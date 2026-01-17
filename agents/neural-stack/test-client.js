/**
 * NEURAL STACK CLIENT - Test Suite
 * Tests all CRUD operations against the Supabase Neural Stack tables
 */

import 'dotenv/config';
import { NeuralStackClient } from './NeuralStackClient.js';

// Test data
const TEST_AGENT = 'cfo';
const TEST_TASK_ID = `test-task-${Date.now()}`;

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('       NEURAL STACK CLIENT - TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const client = new NeuralStackClient();
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

  // =========================================================================
  // CONNECTION TESTS
  // =========================================================================
  console.log('Connection Tests:');

  await test('Client initializes and connects', async () => {
    if (!client.isAvailable()) {
      throw new Error('Client not connected to Supabase');
    }
  });

  // =========================================================================
  // AGENT MEMORY TESTS
  // =========================================================================
  console.log('\nAgent Memory Tests:');

  let agentMemory;
  await test('Get agent memory for CFO', async () => {
    const { data, error } = await client.getAgentMemory(TEST_AGENT);
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No agent memory returned');
    if (data.agent_role !== TEST_AGENT) throw new Error('Wrong agent role');
    agentMemory = data;
  });

  await test('All 15 agent roles initialized', async () => {
    const { data, error } = await client.getAllAgentStatus();
    if (error) throw new Error(error.message);
    if (data.length !== 15) throw new Error(`Expected 15 agents, got ${data.length}`);
  });

  await test('Update agent memory', async () => {
    const { data, error } = await client.updateAgentMemory(TEST_AGENT, {
      knowledge_version: 'v1.0.1-test',
    });
    if (error) throw new Error(error.message);
    if (data.knowledge_version !== 'v1.0.1-test') throw new Error('Update not applied');

    // Restore original
    await client.updateAgentMemory(TEST_AGENT, {
      knowledge_version: agentMemory.knowledge_version || 'v1.0.0',
    });
  });

  // =========================================================================
  // TASK HISTORY TESTS
  // =========================================================================
  console.log('\nTask History Tests:');

  let taskHistoryId;
  await test('Log task start', async () => {
    const { data, error } = await client.logTaskStart({
      id: TEST_TASK_ID,
      agent_role: TEST_AGENT,
      title: 'Test Financial Report',
      description: 'Testing neural stack client',
      difficulty: 3,
      estimated_hours: 2.0,
      knowledge_version: 'v1.0.0',
      model_used: 'claude-3-opus',
    });
    if (error) throw new Error(error.message);
    if (!data.id) throw new Error('No task history ID returned');
    if (!data.started_at) throw new Error('started_at not set');
    taskHistoryId = data.id;
  });

  await test('Log task completion (triggers variance calculation)', async () => {
    // Wait a moment to simulate task duration
    await new Promise(resolve => setTimeout(resolve, 100));

    const { data, error } = await client.logTaskCompletion(TEST_TASK_ID, {
      model_used: 'claude-3-opus',
      tokens_used: 1500,
    });
    if (error) throw new Error(error.message);
    if (!data.completed_at) throw new Error('completed_at not set');
    // Check variance was calculated by trigger
    if (data.actual_hours === null) throw new Error('actual_hours not calculated');
  });

  await test('Record CoS score', async () => {
    const { data, error } = await client.recordCosScore(TEST_TASK_ID, 85, 'Good performance on test task');
    if (error) throw new Error(error.message);
    if (data.cos_score !== 85) throw new Error('CoS score not recorded');
    if (!data.cos_reviewed_at) throw new Error('cos_reviewed_at not set');
  });

  await test('Get task history for agent', async () => {
    const { data, error } = await client.getTaskHistory(TEST_AGENT, 10);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error('Expected array');
    const testTask = data.find(t => t.task_id === TEST_TASK_ID);
    if (!testTask) throw new Error('Test task not found in history');
  });

  // =========================================================================
  // DELIVERABLES TESTS
  // =========================================================================
  console.log('\nDeliverables Tests:');

  let deliverableId;
  await test('Create deliverable', async () => {
    const { data, error } = await client.createDeliverable({
      task_id: TEST_TASK_ID,
      title: 'Test Financial Report PDF',
      description: 'Monthly financial report for testing',
      acceptance_criteria: ['Contains revenue data', 'Includes projections', 'Formatted correctly'],
      due_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    });
    if (error) throw new Error(error.message);
    if (!data.id) throw new Error('No deliverable ID returned');
    deliverableId = data.id;
  });

  await test('Complete deliverable', async () => {
    const { data, error } = await client.completeDeliverable(deliverableId, [
      '/reports/financial-report-test.pdf',
    ]);
    if (error) throw new Error(error.message);
    if (!data.completed) throw new Error('Deliverable not marked complete');
    if (!data.completed_at) throw new Error('completed_at not set');
  });

  await test('Get deliverables by task', async () => {
    const { data, error } = await client.getDeliverablesByTask(TEST_TASK_ID);
    if (error) throw new Error(error.message);
    if (data.length === 0) throw new Error('No deliverables found');
    if (data[0].title !== 'Test Financial Report PDF') throw new Error('Wrong deliverable');
  });

  // =========================================================================
  // TREND ANALYSIS TESTS
  // =========================================================================
  console.log('\nTrend Analysis Tests:');

  await test('Linear regression calculation', () => {
    const x = [0, 1, 2, 3, 4];
    const y = [2, 4, 5, 4, 5];
    const { slope, intercept } = client.linearRegression(x, y);
    if (typeof slope !== 'number') throw new Error('Slope should be number');
    if (typeof intercept !== 'number') throw new Error('Intercept should be number');
  });

  await test('Calculate trend (may be INSUFFICIENT_DATA with < 3 tasks)', async () => {
    const trend = await client.calculateTrend(TEST_AGENT);
    if (!['IMPROVING', 'STABLE', 'DECLINING', 'INSUFFICIENT_DATA'].includes(trend.direction)) {
      throw new Error(`Invalid trend direction: ${trend.direction}`);
    }
    if (typeof trend.slope !== 'number') throw new Error('Slope should be number');
  });

  // =========================================================================
  // COS REVIEW TESTS
  // =========================================================================
  console.log('\nCoS Review Tests:');

  let cosReviewId;
  await test('Create CoS review', async () => {
    const { data, error } = await client.createCosReview({
      agent_role: TEST_AGENT,
      phase: 'collect',
      tasks_analyzed: 1,
      task_ids_analyzed: [TEST_TASK_ID],
    });
    if (error) throw new Error(error.message);
    if (!data.id) throw new Error('No review ID returned');
    cosReviewId = data.id;
  });

  await test('Complete CoS review', async () => {
    const { data, error } = await client.completeCosReview(cosReviewId, {
      trend: 'STABLE',
      slope: 0.01,
      avg_variance_percent: 5.0,
      on_time_score: 38,
      quality_score: 28,
      accuracy_score: 27,
      total_score: 93,
      intervention_required: false,
      decision_notes: 'Test review - performance acceptable',
    });
    if (error) throw new Error(error.message);
    if (data.phase !== 'log') throw new Error('Phase should be log');
    if (data.total_score !== 93) throw new Error('Score not recorded');
  });

  await test('Get CoS review history', async () => {
    const { data, error } = await client.getCosReviewHistory(TEST_AGENT, 5);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error('Expected array');
  });

  // =========================================================================
  // PERFORMANCE SNAPSHOT TESTS
  // =========================================================================
  console.log('\nPerformance Snapshot Tests:');

  await test('Create performance snapshot', async () => {
    const { data, error } = await client.createPerformanceSnapshot({
      agent_role: TEST_AGENT,
      snapshot_type: 'after_task',
      avg_variance_percent: 5.0,
      variance_trend_slope: 0.01,
      on_time_delivery_rate: 0.95,
      avg_cos_score: 85,
      total_tasks_completed: 1,
      tasks_since_last_snapshot: 1,
      active_amendments: 0,
      triggered_by: 'test_suite',
    });
    if (error) throw new Error(error.message);
    if (!data.id) throw new Error('No snapshot ID returned');
  });

  await test('Get performance snapshots', async () => {
    const { data, error } = await client.getPerformanceSnapshots(TEST_AGENT);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error('Expected array');
  });

  // =========================================================================
  // AMENDMENTS TESTS
  // =========================================================================
  console.log('\nAmendments Tests:');

  let amendmentId;
  await test('Create amendment', async () => {
    amendmentId = `amend-test-${Date.now()}`;
    const { data, error } = await client.createAmendment({
      amendment_id: amendmentId,
      agent_role: TEST_AGENT,
      trigger_reason: 'test_declining_trend',
      trigger_pattern: 'variance_percent > 0.10 for 5 tasks',
      amendment_type: 'append',
      target_area: 'time_estimation',
      content: 'Test amendment: Add 20% buffer to time estimates for complex financial tasks',
      performance_before: { avg_variance: 0.15, trend: -0.02, cos_score: 80 },
      evaluation_window_tasks: 5,
    });
    if (error) throw new Error(error.message);
    if (!data.id) throw new Error('No amendment ID returned');
  });

  await test('Get active amendments', async () => {
    const { data, error } = await client.getActiveAmendments(TEST_AGENT);
    if (error) throw new Error(error.message);
    const testAmendment = data.find(a => a.amendment_id === amendmentId);
    if (!testAmendment) throw new Error('Test amendment not found');
  });

  await test('Update amendment evaluation', async () => {
    const { data, error } = await client.updateAmendmentEvaluation(amendmentId, {
      performance_after: { avg_variance: 0.08, trend: -0.01, cos_score: 88 },
      tasks_evaluated: 5,
      status: 'success',
    });
    if (error) throw new Error(error.message);
    if (data.evaluation_status !== 'success') throw new Error('Status not updated');
  });

  await test('Revert amendment', async () => {
    const { data, error } = await client.revertAmendment(amendmentId, 'Test revert - cleanup');
    if (error) throw new Error(error.message);
    if (!data.reverted) throw new Error('Amendment not reverted');
    if (data.evaluation_status !== 'reverted') throw new Error('Status not set to reverted');
  });

  // =========================================================================
  // CLEANUP
  // =========================================================================
  console.log('\nCleanup:');

  await test('Clean up test data', async () => {
    // Delete test deliverables
    const { error: delError } = await client.supabase
      .from('monolith_deliverables')
      .delete()
      .eq('task_id', TEST_TASK_ID);
    if (delError) console.log('  (deliverables cleanup warning:', delError.message + ')');

    // Delete test task history
    const { error: taskError } = await client.supabase
      .from('monolith_task_history')
      .delete()
      .eq('task_id', TEST_TASK_ID);
    if (taskError) console.log('  (task history cleanup warning:', taskError.message + ')');

    // Delete test CoS review
    const { error: reviewError } = await client.supabase
      .from('monolith_cos_reviews')
      .delete()
      .eq('id', cosReviewId);
    if (reviewError) console.log('  (cos review cleanup warning:', reviewError.message + ')');

    // Delete test amendment
    const { error: amendError } = await client.supabase
      .from('monolith_amendments')
      .delete()
      .eq('amendment_id', amendmentId);
    if (amendError) console.log('  (amendment cleanup warning:', amendError.message + ')');

    // Delete test snapshots
    const { error: snapError } = await client.supabase
      .from('monolith_performance_snapshots')
      .delete()
      .eq('triggered_by', 'test_suite');
    if (snapError) console.log('  (snapshots cleanup warning:', snapError.message + ')');
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

  console.log('All tests passed! Neural Stack client is working correctly.\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
