/**
 * MONOLITH OS - Chief Technology Officer Agent
 * Technical leadership, architecture, and engineering decisions
 *
 * Responsibilities:
 * - Technical architecture decisions
 * - Technology stack evaluation
 * - Engineering process and standards
 * - Technical debt management
 * - Security and infrastructure oversight
 */

import RoleAgent from '../../core/RoleAgent.js';

const CTO_CONFIG = {
  roleId: 'cto',
  roleName: 'Chief Technology Officer',
  roleAbbr: 'CTO',
  tier: 1,

  responsibilities: [
    'Define and maintain technical architecture',
    'Evaluate and select technology stack',
    'Oversee engineering processes and standards',
    'Manage technical debt and refactoring priorities',
    'Ensure system security and reliability',
    'Lead technical hiring and team structure',
    'Drive innovation and R&D initiatives',
  ],

  authorityLimits: {
    maxApprovalAmount: 15000,
    canApproveTooling: true,
    canApproveArchitecture: true,
    canHire: false, // Requires CEO
    requiresCEOAbove: 15000,
  },

  reportsTo: 'ceo',
  directReports: ['vp-eng', 'dir-eng', 'devops-lead', 'qa-lead'],

  roleDescription: `You are the Chief Technology Officer, responsible for all technical decisions.

Your core competencies:
1. Architecture - Design scalable, maintainable systems
2. Technology Selection - Evaluate tools, frameworks, services
3. Engineering Excellence - Set standards and best practices
4. Security - Ensure systems are secure by design
5. Innovation - Drive technical innovation

Decision Framework:
- Approve technology purchases up to $15,000
- Make architecture decisions that don't require major rewrites
- Escalate infrastructure changes over $15,000
- Always consider security implications
- Document technical decisions in ADRs
- Coordinate with CISO on security-related decisions`,
};

class CTOAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CTO_CONFIG, ...config });

    // CTO-specific state
    this.architectureDecisions = [];
    this.techStack = new Map();
    this.technicalDebt = [];
  }

  /**
   * Evaluate a technology or tool
   */
  async evaluateTechnology(tech) {
    const evalPrompt = `Evaluate this technology for potential adoption.

## Technology Details:
${JSON.stringify(tech, null, 2)}

## Evaluation Criteria:
1. **Technical Fit** - Does it solve our problem well?
2. **Scalability** - Will it scale with our growth?
3. **Maintainability** - Is it easy to maintain and debug?
4. **Security** - Any security concerns?
5. **Community/Support** - Active community? Good documentation?
6. **Cost** - Total cost including implementation
7. **Integration** - How well does it integrate with our stack?
8. **Learning Curve** - Team ramp-up time

## Output:
1. Score each criterion (1-10)
2. Overall recommendation: ADOPT, TRIAL, ASSESS, or HOLD
3. Risk assessment
4. Implementation considerations`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: evalPrompt,
      temperature: 0.5,
    });

    return {
      technology: tech,
      evaluation: response.content,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Create Architecture Decision Record
   */
  async createADR(decision) {
    const adrPrompt = `Create an Architecture Decision Record (ADR) for this decision.

## Decision Context:
${JSON.stringify(decision, null, 2)}

## ADR Format:
# ADR-XXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult because of this change?

## Alternatives Considered
What other options were evaluated?

Generate a complete ADR.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: adrPrompt,
      temperature: 0.5,
    });

    const adr = {
      id: `ADR-${Date.now()}`,
      content: response.content,
      decision,
      createdAt: new Date().toISOString(),
      status: 'proposed',
    };

    this.architectureDecisions.push(adr);
    return adr;
  }

  /**
   * Assess technical debt
   */
  async assessTechnicalDebt(codebase) {
    const debtPrompt = `Assess technical debt in this codebase area.

## Codebase Information:
${JSON.stringify(codebase, null, 2)}

## Assessment Criteria:
1. **Code Quality** - Complexity, duplication, clarity
2. **Test Coverage** - Unit, integration, e2e tests
3. **Documentation** - Code comments, READMEs, API docs
4. **Dependencies** - Outdated, vulnerable, unused
5. **Architecture** - Coupling, cohesion, patterns
6. **Performance** - Known bottlenecks
7. **Security** - Vulnerabilities, best practices

## Output:
1. Debt items categorized by severity (Critical, High, Medium, Low)
2. Estimated effort to address each
3. Prioritized remediation plan
4. Quick wins vs long-term improvements`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: debtPrompt,
      temperature: 0.5,
    });

    return {
      assessment: response.content,
      codebase,
      assessedAt: new Date().toISOString(),
    };
  }

  /**
   * Review code or technical document
   */
  async reviewTechnical(item) {
    const reviewPrompt = `Review this technical artifact.

## Item to Review:
${JSON.stringify(item, null, 2)}

## Review Checklist:
1. **Correctness** - Does it work as intended?
2. **Security** - Any vulnerabilities?
3. **Performance** - Any performance issues?
4. **Maintainability** - Is it easy to understand and modify?
5. **Best Practices** - Follows standards?
6. **Edge Cases** - Are they handled?

## Output:
1. Summary of findings
2. Critical issues (must fix)
3. Suggestions (nice to have)
4. Approval status: APPROVED, NEEDS_CHANGES, REJECTED`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.5,
    });

    return {
      review: response.content,
      item,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Plan migration or major technical change
   */
  async planMigration(migration) {
    const planPrompt = `Create a migration plan for this technical change.

## Migration Details:
${JSON.stringify(migration, null, 2)}

## Plan Should Include:
1. **Pre-Migration**
   - Prerequisites
   - Backup strategy
   - Rollback plan

2. **Migration Steps**
   - Detailed step-by-step process
   - Estimated duration per step
   - Dependencies between steps

3. **Validation**
   - How to verify success
   - Smoke tests
   - Performance benchmarks

4. **Post-Migration**
   - Cleanup tasks
   - Documentation updates
   - Team communication

5. **Risks**
   - What could go wrong
   - Mitigation strategies
   - Decision points for rollback`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: planPrompt,
      temperature: 0.5,
    });

    return {
      plan: response.content,
      migration,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluate hosting/infrastructure options
   */
  async evaluateHosting(requirements) {
    const evalPrompt = `Evaluate hosting options for these requirements.

## Requirements:
${JSON.stringify(requirements, null, 2)}

## Providers to Consider:
- Railway
- Render
- Vercel
- Fly.io
- DigitalOcean
- AWS
- Google Cloud
- Azure

## Evaluation Criteria:
1. **Cost** - Monthly/annual pricing at our scale
2. **Performance** - Speed, latency, uptime SLA
3. **Scalability** - Auto-scaling, limits
4. **Developer Experience** - Ease of deployment
5. **Features** - Databases, caching, CDN, etc.
6. **Support** - Documentation, community, paid support
7. **Security** - Compliance, certifications
8. **Vendor Lock-in** - Portability concerns

Provide a comparison matrix and recommendation.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: evalPrompt,
      temperature: 0.5,
    });

    return {
      evaluation: response.content,
      requirements,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for CTO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const ctoKeywords = [
      'technical', 'architecture', 'code', 'engineering', 'developer',
      'infrastructure', 'hosting', 'deploy', 'migration', 'stack',
      'database', 'api', 'security', 'performance', 'scalability',
      'github', 'replit', 'railway', 'vercel'
    ];

    if (ctoKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default CTOAgent;
export { CTO_CONFIG };
