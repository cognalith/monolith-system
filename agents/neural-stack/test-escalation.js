/**
 * ESCALATION CLIENT - Test Suite
 * Tests Authorization Escalation Framework and Agent Config
 */

import 'dotenv/config';
import { EscalationClient, FINANCIAL_TRIGGERS } from './EscalationClient.js';

const TEST_AGENT = 'cfo';
const TEST_TASK_ID = `test-escalation-${Date.now()}`;

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('       ESCALATION CLIENT - TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const client = new EscalationClient();
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
  // TRIGGER DETECTION TESTS (HARDCODED PATTERNS)
  // =========================================================================
  console.log('\nTrigger Detection Tests (Hardcoded Patterns):');

  await test('Detects checkout URL pattern', () => {
    const result = client.checkUrlTriggers('https://example.com/checkout/step-1');
    if (!result) throw new Error('Should detect checkout URL');
    if (result.type !== 'url') throw new Error('Wrong trigger type');
  });

  await test('Detects billing URL pattern', () => {
    const result = client.checkUrlTriggers('https://railway.app/billing/upgrade');
    if (!result) throw new Error('Should detect billing URL');
  });

  await test('Detects credit card form field', () => {
    const result = client.checkTextTriggers('Enter your credit card number');
    if (!result) throw new Error('Should detect credit card field');
    if (result.type !== 'form') throw new Error('Wrong trigger type');
  });

  await test('Detects purchase button', () => {
    const result = client.checkTextTriggers('Click Buy Now to complete');
    if (!result) throw new Error('Should detect purchase button');
    if (result.type !== 'action') throw new Error('Wrong trigger type');
  });

  await test('Detects cloud provisioning', () => {
    const result = client.checkTextTriggers('Create instance with 4 vCPU');
    if (!result) throw new Error('Should detect cloud provisioning');
    if (result.type !== 'cloud') throw new Error('Wrong trigger type');
  });

  await test('Detects cost keywords', () => {
    const result = client.checkTextTriggers('Plan costs $29/month');
    if (!result) throw new Error('Should detect cost keyword');
    if (result.type !== 'cost') throw new Error('Wrong trigger type');
  });

  await test('No false positive for safe URL', () => {
    const result = client.checkUrlTriggers('https://example.com/documentation');
    if (result !== null) throw new Error('Should not trigger on safe URL');
  });

  // =========================================================================
  // TIER DETERMINATION TESTS
  // =========================================================================
  console.log('\nTier Determination Tests:');

  await test('TIER_3 for >$100 cost', () => {
    const tier = client.determineTier('payment_form', 150);
    if (tier !== 'TIER_3_STRATEGIC') throw new Error(`Expected TIER_3, got ${tier}`);
  });

  await test('TIER_3 for annual commit', () => {
    const tier = client.determineTier('subscription', 50, false, true);
    if (tier !== 'TIER_3_STRATEGIC') throw new Error(`Expected TIER_3, got ${tier}`);
  });

  await test('TIER_3 for new vendor', () => {
    const tier = client.determineTier('payment_form', 20, true);
    if (tier !== 'TIER_3_STRATEGIC') throw new Error(`Expected TIER_3, got ${tier}`);
  });

  await test('TIER_2 for payment form under $100', () => {
    const tier = client.determineTier('payment_form', 50);
    if (tier !== 'TIER_2_FINANCIAL') throw new Error(`Expected TIER_2, got ${tier}`);
  });

  await test('TIER_1 for OAuth new service', () => {
    const tier = client.determineTier('oauth_new_service');
    if (tier !== 'TIER_1_SENSITIVE') throw new Error(`Expected TIER_1, got ${tier}`);
  });

  await test('TIER_0 for routine', () => {
    const tier = client.determineTier('strategic_decision');
    if (tier !== 'TIER_0_ROUTINE') throw new Error(`Expected TIER_0, got ${tier}`);
  });

  // =========================================================================
  // ESCALATION CHECK INTEGRATION
  // =========================================================================
  console.log('\nEscalation Check Integration:');

  await test('checkEscalationRequired for billing URL', () => {
    const result = client.checkEscalationRequired({
      url: 'https://railway.app/billing/upgrade',
      costEstimate: 20,
      vendor: 'Railway',
    });
    if (!result.required) throw new Error('Should require escalation');
    if (result.tier !== 'TIER_2_FINANCIAL') throw new Error(`Wrong tier: ${result.tier}`);
  });

  await test('checkEscalationRequired for safe URL', () => {
    const result = client.checkEscalationRequired({
      url: 'https://docs.railway.app/getting-started',
    });
    if (result.required) throw new Error('Should not require escalation');
  });

  // =========================================================================
  // AGENT CONFIG TESTS
  // =========================================================================
  console.log('\nAgent Config Tests:');

  await test('Get CFO agent config', async () => {
    const { data, error } = await client.getAgentConfig('cfo');
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No config returned');
    if (data.agent_role !== 'cfo') throw new Error('Wrong agent role');
    if (data.provider !== 'anthropic') throw new Error('Wrong provider');
  });

  await test('All 15 agent configs initialized', async () => {
    const { data, error } = await client.getAllAgentConfigs();
    if (error) throw new Error(error.message);
    if (data.length !== 15) throw new Error(`Expected 15 configs, got ${data.length}`);
  });

  await test('CFO has lower temperature (0.5)', async () => {
    const { data } = await client.getAgentConfig('cfo');
    if (parseFloat(data.temperature) !== 0.5) {
      throw new Error(`Expected 0.5, got ${data.temperature}`);
    }
  });

  await test('CMO has higher temperature (0.8)', async () => {
    const { data } = await client.getAgentConfig('cmo');
    if (parseFloat(data.temperature) !== 0.8) {
      throw new Error(`Expected 0.8, got ${data.temperature}`);
    }
  });

  await test('Update agent config', async () => {
    const { data, error } = await client.updateAgentConfig('cfo', {
      experiment_group: 'test-group',
    });
    if (error) throw new Error(error.message);
    if (data.experiment_group !== 'test-group') throw new Error('Update not applied');

    // Restore
    await client.updateAgentConfig('cfo', { experiment_group: null });
  });

  // =========================================================================
  // ESCALATION LOG TESTS
  // =========================================================================
  console.log('\nEscalation Log Tests:');

  let escalationId;
  await test('Create escalation request', async () => {
    const { data, error } = await client.createEscalation({
      task_id: TEST_TASK_ID,
      agent_role: TEST_AGENT,
      tier: 'TIER_2_FINANCIAL',
      trigger: {
        type: 'subscription',
        url: 'https://railway.app/billing',
        pattern_matched: '/billing/i',
      },
      request: {
        action: 'Upgrade to Railway Pro plan',
        vendor: 'Railway',
        cost_estimate: 20,
        cost_frequency: 'monthly',
      },
      mona_recommendation: {
        should_proceed: true,
        reasoning: 'Railway Pro provides necessary features for deployment at reasonable cost',
        alternatives: ['Render.com ($7/mo)', 'Fly.io ($5/mo)'],
      },
    });
    if (error) throw new Error(error.message);
    if (!data.id) throw new Error('No escalation ID returned');
    escalationId = data.id;
  });

  await test('Get pending escalations', async () => {
    const { data, error } = await client.getPendingEscalations();
    if (error) throw new Error(error.message);
    const testEscalation = data.find(e => e.task_id === TEST_TASK_ID);
    if (!testEscalation) throw new Error('Test escalation not found in pending');
  });

  await test('Record Frank decision', async () => {
    const { data, error } = await client.recordFrankDecision(escalationId, {
      decision: 'APPROVED',
      notes: 'Approved for testing purposes',
      resume_instructions: 'Complete the upgrade flow',
    });
    if (error) throw new Error(error.message);
    if (data.frank_decision !== 'APPROVED') throw new Error('Decision not recorded');
    if (!data.frank_decided_at) throw new Error('Decision timestamp not set');
  });

  await test('Escalation no longer in pending after decision', async () => {
    const { data } = await client.getPendingEscalations();
    const testEscalation = data.find(e => e.task_id === TEST_TASK_ID);
    if (testEscalation) throw new Error('Escalation should not be in pending after decision');
  });

  await test('Record escalation outcome', async () => {
    const { data, error } = await client.recordOutcome(escalationId, 'COMPLETED', 'Test completed successfully');
    if (error) throw new Error(error.message);
    if (data.outcome !== 'COMPLETED') throw new Error('Outcome not recorded');
    if (!data.completed_at) throw new Error('Completed timestamp not set');
  });

  await test('Get escalation history', async () => {
    const { data, error } = await client.getEscalationHistory(10);
    if (error) throw new Error(error.message);
    const testEscalation = data.find(e => e.task_id === TEST_TASK_ID);
    if (!testEscalation) throw new Error('Test escalation not found in history');
  });

  // =========================================================================
  // FORMAT ALERT TEST
  // =========================================================================
  console.log('\nFormat Alert Test:');

  await test('Format escalation alert for console', () => {
    const alert = client.formatEscalationAlert({
      tier: 'TIER_2_FINANCIAL',
      agent_role: 'cfo',
      trigger: { url: 'https://example.com/checkout' },
      request: {
        action: 'Subscribe to Pro plan',
        cost_estimate: 29,
        cost_frequency: 'monthly',
        vendor: 'TestService',
      },
      mona_recommendation: {
        should_proceed: true,
        reasoning: 'Good value for features needed',
        alternatives: ['Alternative A', 'Alternative B'],
      },
    });
    if (!alert.includes('TIER_2_FINANCIAL')) throw new Error('Missing tier');
    if (!alert.includes('Subscribe to Pro plan')) throw new Error('Missing action');
    if (!alert.includes('$29 CAD')) throw new Error('Missing cost');
  });

  // =========================================================================
  // CLEANUP
  // =========================================================================
  console.log('\nCleanup:');

  await test('Clean up test data', async () => {
    const { error } = await client.supabase
      .from('monolith_escalation_log')
      .delete()
      .eq('task_id', TEST_TASK_ID);
    if (error) console.log('  (cleanup warning:', error.message + ')');
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

  console.log('All tests passed! Escalation framework is working correctly.\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
