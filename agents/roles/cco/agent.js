/**
 * MONOLITH OS - Chief Compliance Officer Agent
 * Regulatory compliance, ethics, and governance
 *
 * Responsibilities:
 * - Regulatory compliance oversight
 * - Ethics and governance
 * - Risk monitoring and reporting
 * - Compliance training
 * - Audit coordination
 */

import RoleAgent from '../../core/RoleAgent.js';

const CCO_CONFIG = {
  roleId: 'cco',
  roleName: 'Chief Compliance Officer',
  roleAbbr: 'CCO',
  tier: 2,

  responsibilities: [
    'Ensure regulatory compliance',
    'Maintain ethics and governance standards',
    'Monitor and report on compliance risks',
    'Coordinate compliance training',
    'Manage audit processes',
    'Develop compliance policies',
    'Work with CLO on legal compliance',
  ],

  authorityLimits: {
    maxApprovalAmount: 5000,
    canBlockNonCompliant: true,
    canMandateTraining: true,
    canInitiateAudit: true,
    requiresCEOFor: ['regulatory filings', 'major policy changes'],
  },

  reportsTo: 'ceo',
  directReports: ['compliance-team'],

  roleDescription: `You are the Chief Compliance Officer, responsible for all compliance matters.

Your core competencies:
1. Regulatory Compliance - Ensure adherence to laws and regulations
2. Ethics & Governance - Maintain ethical standards
3. Risk Monitoring - Identify and track compliance risks
4. Training - Build compliance awareness
5. Audit Management - Coordinate internal and external audits

Decision Framework:
- Approve compliance-related expenses up to $5,000
- Block non-compliant activities
- Mandate compliance training
- Escalate regulatory issues to CEO
- Coordinate with CLO on legal matters
- Work with CISO on security compliance`,
};

class CCOAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CCO_CONFIG, ...config });

    // CCO-specific state
    this.complianceIssues = [];
    this.audits = [];
    this.policies = new Map();
  }

  /**
   * Conduct compliance review
   */
  async conductComplianceReview(area) {
    const reviewPrompt = `Conduct a compliance review for this area.

## Area to Review:
${JSON.stringify(area, null, 2)}

## Compliance Domains:
1. **Regulatory**
   - Industry regulations
   - Government requirements
   - Licensing obligations

2. **Data Privacy**
   - GDPR, CCPA, PIPEDA
   - Data handling practices
   - Consent management

3. **Financial**
   - Financial reporting
   - Tax compliance
   - Anti-money laundering

4. **Employment**
   - Labor laws
   - Workplace safety
   - Equal opportunity

5. **Corporate Governance**
   - Board requirements
   - Shareholder obligations
   - Disclosure requirements

## Output:
1. Compliance status summary
2. Gaps identified
3. Risk level (Critical/High/Medium/Low)
4. Remediation requirements
5. Timeline and owners`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.4,
    });

    return {
      review: response.content,
      area,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Assess compliance risk
   */
  async assessComplianceRisk(activity) {
    const riskPrompt = `Assess compliance risk for this activity.

## Activity Details:
${JSON.stringify(activity, null, 2)}

## Risk Assessment:
1. **Regulatory Impact**
   - Which regulations apply?
   - Potential violations?

2. **Likelihood**
   - Probability of non-compliance
   - Contributing factors

3. **Consequences**
   - Fines and penalties
   - Reputational damage
   - Operational impact

4. **Controls**
   - Existing controls
   - Control effectiveness

5. **Residual Risk**
   - Risk after controls

## Output:
1. Risk rating (Critical/High/Medium/Low)
2. Applicable regulations
3. Risk factors
4. Recommended controls
5. Approval: PROCEED, MODIFY, BLOCK`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: riskPrompt,
      temperature: 0.4,
    });

    const assessment = {
      assessment: response.content,
      activity,
      assessedAt: new Date().toISOString(),
    };

    this.complianceIssues.push(assessment);
    return assessment;
  }

  /**
   * Create compliance policy
   */
  async createCompliancePolicy(topic) {
    const policyPrompt = `Create a compliance policy for this topic.

## Topic:
${JSON.stringify(topic, null, 2)}

## Policy Structure:
1. **Purpose**
   - Why this policy exists
   - Scope and applicability

2. **Policy Statement**
   - Core requirements
   - Prohibited actions

3. **Roles & Responsibilities**
   - Who is responsible for what
   - Oversight structure

4. **Procedures**
   - Step-by-step processes
   - Documentation requirements

5. **Monitoring & Reporting**
   - How compliance is monitored
   - Reporting requirements

6. **Violations**
   - Consequences
   - Reporting mechanisms

7. **Review**
   - Review frequency
   - Update process

## Output:
Complete policy document ready for review`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: policyPrompt,
      temperature: 0.4,
    });

    return {
      policy: response.content,
      topic,
      createdAt: new Date().toISOString(),
      status: 'draft',
      requiresCEOApproval: true,
    };
  }

  /**
   * Plan compliance audit
   */
  async planComplianceAudit(scope) {
    const auditPrompt = `Plan a compliance audit for this scope.

## Audit Scope:
${JSON.stringify(scope, null, 2)}

## Audit Plan Elements:
1. **Objectives**
   - What are we auditing?
   - Key questions to answer

2. **Scope Definition**
   - Areas included
   - Areas excluded
   - Time period

3. **Methodology**
   - Document review
   - Interviews
   - Testing/sampling

4. **Schedule**
   - Preparation phase
   - Fieldwork phase
   - Reporting phase

5. **Resources**
   - Audit team
   - External support needed

6. **Deliverables**
   - Audit report
   - Findings summary
   - Remediation plan

## Output:
Complete audit plan with timeline`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: auditPrompt,
      temperature: 0.5,
    });

    const audit = {
      plan: response.content,
      scope,
      plannedAt: new Date().toISOString(),
      status: 'planned',
    };

    this.audits.push(audit);
    return audit;
  }

  /**
   * Create compliance training
   */
  async createComplianceTraining(requirements) {
    const trainingPrompt = `Create compliance training for these requirements.

## Training Requirements:
${JSON.stringify(requirements, null, 2)}

## Training Components:
1. **Learning Objectives**
   - What will participants learn?
   - Expected outcomes

2. **Content Outline**
   - Module structure
   - Key topics
   - Case studies

3. **Delivery Method**
   - In-person vs online
   - Duration
   - Interactive elements

4. **Assessment**
   - Knowledge checks
   - Certification requirements

5. **Tracking**
   - Completion tracking
   - Reporting

## Output:
1. Training program outline
2. Content summary per module
3. Assessment plan
4. Completion requirements
5. Rollout schedule`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: trainingPrompt,
      temperature: 0.5,
    });

    return {
      training: response.content,
      requirements,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for CCO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const ccoKeywords = [
      'compliance', 'regulation', 'audit', 'governance', 'ethics',
      'policy', 'standards', 'certification', 'accreditation',
      'regulatory', 'violation', 'disclosure', 'reporting requirements'
    ];

    if (ccoKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default CCOAgent;
export { CCO_CONFIG };
