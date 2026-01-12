/**
 * MONOLITH OS - Chief Human Resources Officer Agent
 * People operations, talent management, and culture
 *
 * Responsibilities:
 * - Talent acquisition and retention
 * - Performance management
 * - Compensation and benefits
 * - Employee relations
 * - Organizational development
 */

import RoleAgent from '../../core/RoleAgent.js';

const CHRO_CONFIG = {
  roleId: 'chro',
  roleName: 'Chief Human Resources Officer',
  roleAbbr: 'CHRO',
  tier: 2,

  responsibilities: [
    'Lead talent acquisition and retention',
    'Manage performance review processes',
    'Oversee compensation and benefits',
    'Handle employee relations',
    'Drive organizational development',
    'Ensure HR compliance',
    'Build company culture',
  ],

  authorityLimits: {
    maxApprovalAmount: 10000,
    canApproveHiring: false, // Final hire requires CEO
    canApproveBenefits: true,
    canApproveTraining: true,
    requiresCEOFor: ['hiring decisions', 'terminations', 'compensation changes'],
  },

  reportsTo: 'ceo',
  directReports: ['hr-team', 'recruiting'],

  roleDescription: `You are the Chief Human Resources Officer, responsible for all people matters.

Your core competencies:
1. Talent Acquisition - Recruit and hire top talent
2. Performance Management - Drive performance culture
3. Compensation & Benefits - Competitive packages
4. Employee Relations - Handle workplace issues
5. Culture Building - Shape company culture

Decision Framework:
- Approve HR-related expenses up to $10,000
- Manage recruiting pipeline
- Handle employee relations issues
- Escalate hiring/termination decisions to CEO
- Coordinate with CLO on employment law
- Work with CFO on compensation budgets`,
};

class CHROAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CHRO_CONFIG, ...config });

    // CHRO-specific state
    this.openPositions = [];
    this.performanceReviews = [];
    this.employeeRelationsIssues = [];
  }

  /**
   * Create job description
   */
  async createJobDescription(role) {
    const jobPrompt = `Create a job description for this role.

## Role Details:
${JSON.stringify(role, null, 2)}

## Job Description Format:
1. **About the Company**
   - Company overview
   - Mission/values

2. **Role Overview**
   - Position summary
   - Impact and scope

3. **Responsibilities**
   - Key duties (5-8 bullets)
   - Collaboration points

4. **Requirements**
   - Must-have qualifications
   - Nice-to-have qualifications
   - Experience level

5. **What We Offer**
   - Compensation range
   - Benefits highlights
   - Growth opportunities

6. **How to Apply**
   - Application process
   - Equal opportunity statement

Create an engaging, inclusive job description.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: jobPrompt,
      temperature: 0.6,
    });

    return {
      jobDescription: response.content,
      role,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Review candidate
   */
  async reviewCandidate(candidate) {
    const reviewPrompt = `Review this candidate for the position.

## Candidate Information:
${JSON.stringify(candidate, null, 2)}

## Evaluation Criteria:
1. **Skills Match**
   - Technical skills
   - Soft skills
   - Experience relevance

2. **Culture Fit**
   - Values alignment
   - Team dynamics
   - Communication style

3. **Growth Potential**
   - Learning agility
   - Career trajectory
   - Leadership potential

4. **Concerns**
   - Gaps in experience
   - Red flags
   - Risk factors

## Output:
1. Overall assessment
2. Strengths
3. Concerns
4. Interview focus areas
5. Recommendation: ADVANCE, HOLD, PASS
6. Compensation recommendation`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.5,
    });

    return {
      review: response.content,
      candidate,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Handle employee relations issue
   */
  async handleEmployeeRelations(issue) {
    const relationsPrompt = `Handle this employee relations issue.

## Issue Details:
${JSON.stringify(issue, null, 2)}

## Response Framework:
1. **Issue Classification**
   - Type (performance, conduct, conflict, etc.)
   - Severity level
   - Legal implications

2. **Investigation**
   - Information gathered
   - Parties involved
   - Documentation needed

3. **Resolution Options**
   - Possible outcomes
   - Pros and cons of each

4. **Recommended Action**
   - Specific recommendation
   - Timeline
   - Follow-up required

5. **Prevention**
   - How to prevent recurrence
   - Policy updates needed

## Output:
1. Issue summary
2. Recommended resolution
3. Communication plan
4. Escalation needs (CEO/CLO)
5. Documentation requirements`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: relationsPrompt,
      temperature: 0.4,
    });

    const handled = {
      response: response.content,
      issue,
      handledAt: new Date().toISOString(),
    };

    this.employeeRelationsIssues.push(handled);
    return handled;
  }

  /**
   * Create performance review framework
   */
  async createPerformanceFramework(context) {
    const frameworkPrompt = `Create a performance review framework.

## Context:
${JSON.stringify(context, null, 2)}

## Framework Elements:
1. **Review Cycle**
   - Frequency
   - Timeline
   - Participants

2. **Evaluation Criteria**
   - Core competencies
   - Role-specific goals
   - Values alignment

3. **Rating Scale**
   - Performance levels
   - Definitions
   - Distribution guidance

4. **Process**
   - Self-assessment
   - Manager assessment
   - Peer feedback
   - Calibration

5. **Outcomes**
   - Development planning
   - Compensation impact
   - Promotion criteria

## Output:
1. Review process overview
2. Evaluation criteria
3. Rating definitions
4. Timeline and milestones
5. Manager guide
6. Employee guide`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: frameworkPrompt,
      temperature: 0.5,
    });

    return {
      framework: response.content,
      context,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze compensation
   */
  async analyzeCompensation(request) {
    const compPrompt = `Analyze this compensation request.

## Request:
${JSON.stringify(request, null, 2)}

## Analysis Areas:
1. **Market Data**
   - Industry benchmarks
   - Geographic factors
   - Company stage

2. **Internal Equity**
   - Similar role comparison
   - Team parity
   - Experience level

3. **Budget Impact**
   - Department budget
   - Total compensation cost

4. **Retention Risk**
   - Flight risk if not approved
   - Market alternatives

## Output:
1. Compensation analysis
2. Market positioning
3. Recommendation
4. Budget implications
5. CEO approval needed?`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: compPrompt,
      temperature: 0.4,
    });

    return {
      analysis: response.content,
      request,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for CHRO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const chroKeywords = [
      'hiring', 'recruit', 'talent', 'hr', 'human resources',
      'performance', 'review', 'compensation', 'salary', 'benefits',
      'employee', 'onboarding', 'training', 'culture', 'team',
      'termination', 'pto', 'leave', 'workplace'
    ];

    if (chroKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default CHROAgent;
export { CHRO_CONFIG };
