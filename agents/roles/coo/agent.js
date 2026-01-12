/**
 * MONOLITH OS - Chief Operating Officer Agent
 * Operations management, process optimization, and execution
 *
 * Responsibilities:
 * - Day-to-day operations oversight
 * - Process optimization and automation
 * - Vendor and partner management
 * - Resource allocation
 * - Operational efficiency
 */

import RoleAgent from '../../core/RoleAgent.js';

const COO_CONFIG = {
  roleId: 'coo',
  roleName: 'Chief Operating Officer',
  roleAbbr: 'COO',
  tier: 1,

  responsibilities: [
    'Oversee day-to-day business operations',
    'Optimize processes and workflows',
    'Manage vendor and partner relationships',
    'Ensure operational efficiency',
    'Coordinate cross-functional execution',
    'Monitor operational metrics and KPIs',
    'Drive operational excellence initiatives',
  ],

  authorityLimits: {
    maxApprovalAmount: 20000,
    canApproveVendors: true,
    canApproveProcessChanges: true,
    canAllocateResources: true,
    requiresCEOAbove: 20000,
  },

  reportsTo: 'ceo',
  directReports: ['vp-ops', 'dir-ops'],

  roleDescription: `You are the Chief Operating Officer, responsible for execution excellence.

Your core competencies:
1. Operations Management - Keep the business running smoothly
2. Process Optimization - Identify and eliminate inefficiencies
3. Vendor Management - Select, manage, and evaluate vendors
4. Resource Allocation - Optimize resource utilization
5. Execution - Turn strategy into results

Decision Framework:
- Approve operational expenses up to $20,000
- Make process changes that improve efficiency
- Manage vendor relationships day-to-day
- Escalate strategic operations decisions to CEO
- Coordinate with all departments for execution
- Track and report operational KPIs`,
};

class COOAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...COO_CONFIG, ...config });

    // COO-specific state
    this.vendors = new Map();
    this.processes = new Map();
    this.operationalMetrics = [];
  }

  /**
   * Evaluate a vendor
   */
  async evaluateVendor(vendor) {
    const evalPrompt = `Evaluate this vendor for our operations.

## Vendor Information:
${JSON.stringify(vendor, null, 2)}

## Evaluation Criteria:
1. **Capability** - Can they deliver what we need?
2. **Reliability** - Track record, uptime, SLAs
3. **Cost** - Pricing, total cost of ownership
4. **Scalability** - Can they grow with us?
5. **Support** - Response time, quality of support
6. **Security** - Data handling, compliance
7. **Contract Terms** - Flexibility, exit clauses
8. **References** - Customer feedback

## Output:
1. Vendor scorecard (1-10 per criterion)
2. Overall recommendation: APPROVE, CONDITIONAL, REJECT
3. Key risks and mitigations
4. Contract negotiation points
5. Onboarding considerations`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: evalPrompt,
      temperature: 0.5,
    });

    return {
      evaluation: response.content,
      vendor,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Optimize a process
   */
  async optimizeProcess(process) {
    const optimizePrompt = `Analyze and optimize this business process.

## Current Process:
${JSON.stringify(process, null, 2)}

## Optimization Framework:
1. **Value Stream Mapping**
   - Identify value-adding steps
   - Identify waste (TIMWOOD: Transport, Inventory, Motion, Waiting, Overprocessing, Overproduction, Defects)

2. **Bottleneck Analysis**
   - Where do delays occur?
   - What limits throughput?

3. **Automation Opportunities**
   - What can be automated?
   - ROI of automation

4. **Simplification**
   - Can steps be eliminated?
   - Can steps be combined?

## Output:
1. Current state assessment
2. Identified inefficiencies
3. Recommended improvements
4. Priority ranking (impact vs effort)
5. Implementation plan
6. Expected metrics improvement`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: optimizePrompt,
      temperature: 0.5,
    });

    return {
      optimization: response.content,
      process,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Create operational plan
   */
  async createOperationalPlan(initiative) {
    const planPrompt = `Create an operational execution plan for this initiative.

## Initiative:
${JSON.stringify(initiative, null, 2)}

## Plan Elements:
1. **Objectives**
   - Clear, measurable goals
   - Success criteria

2. **Resources Required**
   - People
   - Budget
   - Tools/Systems

3. **Timeline**
   - Milestones
   - Dependencies
   - Critical path

4. **Responsibilities**
   - RACI matrix
   - Decision points

5. **Risks**
   - Operational risks
   - Mitigation strategies

6. **Metrics**
   - KPIs to track
   - Reporting cadence

7. **Communication**
   - Stakeholder updates
   - Escalation paths`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: planPrompt,
      temperature: 0.5,
    });

    return {
      plan: response.content,
      initiative,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Allocate resources
   */
  async allocateResources(request) {
    const allocatePrompt = `Recommend resource allocation for this request.

## Resource Request:
${JSON.stringify(request, null, 2)}

## Considerations:
1. **Current Utilization** - What's available?
2. **Priority** - How important is this vs other needs?
3. **Dependencies** - What else is affected?
4. **Alternatives** - Other ways to meet the need?
5. **Trade-offs** - What do we give up?

## Output:
1. Recommended allocation
2. Impact on other initiatives
3. Alternative options
4. Risk assessment
5. Approval/escalation recommendation`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: allocatePrompt,
      temperature: 0.5,
    });

    return {
      allocation: response.content,
      request,
      recommendedAt: new Date().toISOString(),
    };
  }

  /**
   * Monitor operational health
   */
  async assessOperationalHealth(metrics) {
    const healthPrompt = `Assess operational health based on these metrics.

## Current Metrics:
${JSON.stringify(metrics, null, 2)}

## Health Assessment:
1. **Overall Status**: 🟢 Healthy | 🟡 Warning | 🔴 Critical

2. **By Area**:
   - System uptime and reliability
   - Process efficiency
   - Resource utilization
   - Vendor performance
   - Team productivity

3. **Trends**:
   - Improving
   - Stable
   - Declining

4. **Actions Needed**:
   - Immediate actions
   - Short-term improvements
   - Long-term initiatives

Provide a concise operational health report.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: healthPrompt,
      temperature: 0.5,
    });

    return {
      healthReport: response.content,
      metrics,
      assessedAt: new Date().toISOString(),
    };
  }

  /**
   * Plan migration project
   */
  async planMigrationProject(migration) {
    const migrationPrompt = `Create a detailed migration project plan.

## Migration Details:
${JSON.stringify(migration, null, 2)}

## Project Plan Elements:

### Phase 1: Planning
- Requirements gathering
- Risk assessment
- Resource planning
- Timeline development

### Phase 2: Preparation
- Environment setup
- Data backup
- Team training
- Communication plan

### Phase 3: Execution
- Step-by-step migration
- Validation checkpoints
- Rollback triggers

### Phase 4: Validation
- Testing and verification
- Performance validation
- User acceptance

### Phase 5: Cutover
- Final migration
- DNS/routing changes
- Monitoring activation

### Phase 6: Post-Migration
- Cleanup
- Documentation
- Lessons learned

Include specific dates, owners, and success criteria.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: migrationPrompt,
      temperature: 0.5,
    });

    return {
      projectPlan: response.content,
      migration,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for COO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const cooKeywords = [
      'operations', 'process', 'vendor', 'supplier', 'efficiency',
      'workflow', 'resource', 'allocation', 'migrate', 'hosting',
      'infrastructure', 'deployment', 'project', 'timeline',
      'milestone', 'execution', 'operational'
    ];

    if (cooKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default COOAgent;
export { COO_CONFIG };
