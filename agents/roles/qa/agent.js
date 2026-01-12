/**
 * MONOLITH OS - QA Lead Agent
 * Quality assurance, testing strategy, and release quality
 *
 * Responsibilities:
 * - Testing strategy and planning
 * - Test automation
 * - Release quality gates
 * - Bug triage and prioritization
 * - Quality metrics and reporting
 */

import RoleAgent from '../../core/RoleAgent.js';

const QA_CONFIG = {
  roleId: 'qa',
  roleName: 'QA Lead',
  roleAbbr: 'QA',
  tier: 3,

  responsibilities: [
    'Define testing strategy and standards',
    'Manage test automation framework',
    'Ensure release quality gates',
    'Triage and prioritize bugs',
    'Track quality metrics',
    'Coordinate UAT processes',
    'Drive quality improvements',
  ],

  authorityLimits: {
    maxApprovalAmount: 3000,
    canBlockRelease: true,
    canApproveTesting: true,
    canPrioritizeBugs: true,
    requiresCTOFor: ['major test infrastructure', 'release exceptions'],
  },

  reportsTo: 'cto',
  directReports: ['qa-engineers', 'sdet'],

  roleDescription: `You are the QA Lead, responsible for quality assurance and testing.

Your core competencies:
1. Testing Strategy - Plan and execute test strategies
2. Automation - Build and maintain test automation
3. Quality Gates - Define and enforce release criteria
4. Bug Management - Triage, prioritize, and track defects
5. Metrics - Track and report quality metrics

Decision Framework:
- Approve QA-related expenses up to $3,000
- Block releases that don't meet quality criteria
- Prioritize bugs and testing efforts
- Escalate release exceptions to CTO
- Coordinate with DevOps on CI/CD testing
- Work with product on acceptance criteria`,
};

class QAAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...QA_CONFIG, ...config });

    // QA-specific state
    this.bugs = [];
    this.testPlans = [];
    this.qualityMetrics = [];
  }

  /**
   * Create test plan
   */
  async createTestPlan(feature) {
    const testPlanPrompt = `Create a test plan for this feature.

## Feature Details:
${JSON.stringify(feature, null, 2)}

## Test Plan Components:
1. **Scope**
   - What to test
   - What not to test
   - Assumptions

2. **Test Strategy**
   - Test levels (unit, integration, e2e)
   - Test types (functional, performance, security)
   - Automation vs manual

3. **Test Cases**
   - Happy path scenarios
   - Edge cases
   - Error scenarios
   - Boundary conditions

4. **Test Data**
   - Data requirements
   - Data generation
   - Data cleanup

5. **Environment**
   - Test environment needs
   - Dependencies

6. **Schedule**
   - Testing phases
   - Resource allocation

7. **Exit Criteria**
   - Quality gates
   - Coverage requirements

## Output:
1. Test plan summary
2. Detailed test cases
3. Automation recommendations
4. Resource needs
5. Risk areas`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: testPlanPrompt,
      temperature: 0.5,
    });

    const plan = {
      plan: response.content,
      feature,
      createdAt: new Date().toISOString(),
    };

    this.testPlans.push(plan);
    return plan;
  }

  /**
   * Triage bug
   */
  async triageBug(bug) {
    const triagePrompt = `Triage this bug report.

## Bug Details:
${JSON.stringify(bug, null, 2)}

## Triage Criteria:
1. **Severity**
   - Critical: System down, data loss
   - High: Major feature broken
   - Medium: Feature partially broken
   - Low: Minor issue, cosmetic

2. **Priority**
   - P1: Fix immediately
   - P2: Fix in current sprint
   - P3: Fix in next sprint
   - P4: Fix when time permits

3. **Reproducibility**
   - Steps to reproduce
   - Environment specifics
   - Frequency

4. **Impact**
   - Users affected
   - Business impact
   - Workaround available?

5. **Root Cause**
   - Initial analysis
   - Related issues

## Output:
1. Severity classification
2. Priority assignment
3. Impact assessment
4. Recommended action
5. Assignment suggestion`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: triagePrompt,
      temperature: 0.4,
    });

    const triaged = {
      triage: response.content,
      bug,
      triagedAt: new Date().toISOString(),
    };

    this.bugs.push(triaged);
    return triaged;
  }

  /**
   * Review release quality
   */
  async reviewReleaseQuality(release) {
    const releasePrompt = `Review release quality for go/no-go decision.

## Release Details:
${JSON.stringify(release, null, 2)}

## Quality Criteria:
1. **Test Coverage**
   - Code coverage
   - Feature coverage
   - Automation coverage

2. **Test Results**
   - Pass rate
   - Failed tests
   - Skipped tests

3. **Bug Status**
   - Open critical/high bugs
   - Regression bugs
   - Known issues

4. **Performance**
   - Performance test results
   - Benchmarks vs baseline

5. **Security**
   - Security scan results
   - Vulnerability status

6. **Documentation**
   - Release notes
   - Known issues documented

## Output:
1. Quality summary
2. Criteria status (pass/fail)
3. Risk assessment
4. Open issues list
5. Recommendation: GO, GO_WITH_RISKS, NO_GO`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: releasePrompt,
      temperature: 0.4,
    });

    return {
      review: response.content,
      release,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Design automation framework
   */
  async designAutomationFramework(requirements) {
    const automationPrompt = `Design test automation framework for these requirements.

## Requirements:
${JSON.stringify(requirements, null, 2)}

## Framework Components:
1. **Test Framework**
   - Framework selection
   - Language/tools
   - Architecture

2. **Test Organization**
   - Folder structure
   - Naming conventions
   - Tagging strategy

3. **Page Objects/Utilities**
   - Reusable components
   - Helper functions
   - Custom assertions

4. **Data Management**
   - Test data handling
   - Fixtures
   - Cleanup

5. **Reporting**
   - Test reports
   - Screenshots/videos
   - Failure analysis

6. **CI/CD Integration**
   - Pipeline integration
   - Parallel execution
   - Environment management

## Output:
1. Framework architecture
2. Technology stack
3. Implementation plan
4. Best practices
5. Maintenance guidelines`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: automationPrompt,
      temperature: 0.5,
    });

    return {
      framework: response.content,
      requirements,
      designedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for QA-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const qaKeywords = [
      'test', 'testing', 'qa', 'quality', 'bug', 'defect',
      'automation', 'regression', 'e2e', 'integration test',
      'unit test', 'coverage', 'release', 'uat', 'acceptance'
    ];

    if (qaKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default QAAgent;
export { QA_CONFIG };
