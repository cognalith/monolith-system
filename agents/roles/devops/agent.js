/**
 * MONOLITH OS - DevOps Lead Agent
 * CI/CD, infrastructure, and deployment automation
 *
 * Responsibilities:
 * - CI/CD pipeline management
 * - Infrastructure as code
 * - Deployment automation
 * - Monitoring and observability
 * - Incident response
 */

import RoleAgent from '../../core/RoleAgent.js';

const DEVOPS_CONFIG = {
  roleId: 'devops',
  roleName: 'DevOps Lead',
  roleAbbr: 'DevOps',
  tier: 3,

  responsibilities: [
    'Manage CI/CD pipelines',
    'Maintain infrastructure as code',
    'Automate deployments',
    'Set up monitoring and alerting',
    'Respond to production incidents',
    'Optimize build and deploy times',
    'Ensure system reliability',
  ],

  authorityLimits: {
    maxApprovalAmount: 5000,
    canDeployToProduction: true,
    canModifyInfrastructure: true,
    canRollback: true,
    requiresCTOFor: ['major infrastructure changes', 'new cloud services'],
  },

  reportsTo: 'cto',
  directReports: ['devops-engineers'],

  roleDescription: `You are the DevOps Lead, responsible for infrastructure and deployment automation.

Your core competencies:
1. CI/CD - Build and maintain deployment pipelines
2. Infrastructure - Manage cloud infrastructure as code
3. Monitoring - Set up observability and alerting
4. Reliability - Ensure system uptime and performance
5. Automation - Automate repetitive operations tasks

Decision Framework:
- Approve infrastructure expenses up to $5,000
- Deploy to production with proper approvals
- Make infrastructure changes within guidelines
- Escalate major changes to CTO
- Coordinate with CISO on security requirements
- Work with engineering on deployment needs`,
};

class DevOpsAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...DEVOPS_CONFIG, ...config });

    // DevOps-specific state
    this.deployments = [];
    this.incidents = [];
    this.pipelines = new Map();
  }

  /**
   * Review deployment request
   */
  async reviewDeployment(deployment) {
    const reviewPrompt = `Review this deployment request.

## Deployment Details:
${JSON.stringify(deployment, null, 2)}

## Review Checklist:
1. **Code Changes**
   - What's being deployed?
   - Risk level of changes

2. **Testing**
   - Test coverage
   - QA sign-off

3. **Rollback Plan**
   - How to rollback?
   - Rollback trigger criteria

4. **Dependencies**
   - Database migrations?
   - External service changes?

5. **Timing**
   - Deployment window
   - User impact

6. **Monitoring**
   - Key metrics to watch
   - Alert thresholds

## Output:
1. Deployment risk assessment
2. Pre-deployment checklist
3. Deployment steps
4. Rollback procedure
5. Approval: APPROVED, NEEDS_REVIEW, BLOCKED`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.4,
    });

    return {
      review: response.content,
      deployment,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Design CI/CD pipeline
   */
  async designPipeline(requirements) {
    const pipelinePrompt = `Design a CI/CD pipeline for these requirements.

## Requirements:
${JSON.stringify(requirements, null, 2)}

## Pipeline Components:
1. **Source**
   - Repository setup
   - Branch strategy

2. **Build**
   - Build steps
   - Dependencies
   - Caching strategy

3. **Test**
   - Unit tests
   - Integration tests
   - E2E tests

4. **Security**
   - SAST/DAST
   - Dependency scanning
   - Secret scanning

5. **Deploy**
   - Staging deployment
   - Production deployment
   - Canary/blue-green

6. **Verify**
   - Smoke tests
   - Health checks
   - Monitoring

## Output:
1. Pipeline architecture
2. Stage definitions
3. Environment configuration
4. Approval gates
5. Implementation steps`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: pipelinePrompt,
      temperature: 0.5,
    });

    return {
      pipeline: response.content,
      requirements,
      designedAt: new Date().toISOString(),
    };
  }

  /**
   * Handle production incident
   */
  async handleIncident(incident) {
    const incidentPrompt = `Handle this production incident.

## Incident Details:
${JSON.stringify(incident, null, 2)}

## Incident Response:
1. **Assess**
   - Severity classification
   - Impact scope
   - Affected systems

2. **Mitigate**
   - Immediate actions
   - Traffic management
   - Communication

3. **Resolve**
   - Root cause investigation
   - Fix implementation
   - Verification

4. **Recover**
   - Service restoration
   - Data recovery if needed
   - Monitoring enhancement

5. **Review**
   - Post-mortem scheduling
   - Documentation

## Output:
1. Severity assessment
2. Immediate mitigation steps
3. Resolution plan
4. Communication template
5. Follow-up actions`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: incidentPrompt,
      temperature: 0.3,
    });

    const handled = {
      response: response.content,
      incident,
      handledAt: new Date().toISOString(),
    };

    this.incidents.push(handled);
    return handled;
  }

  /**
   * Design infrastructure
   */
  async designInfrastructure(requirements) {
    const infraPrompt = `Design infrastructure for these requirements.

## Requirements:
${JSON.stringify(requirements, null, 2)}

## Infrastructure Components:
1. **Compute**
   - Server/container sizing
   - Auto-scaling rules

2. **Networking**
   - VPC/network design
   - Load balancing
   - CDN

3. **Storage**
   - Database selection
   - Object storage
   - Caching

4. **Security**
   - WAF/firewall
   - Encryption
   - Access control

5. **Monitoring**
   - Metrics collection
   - Log aggregation
   - Alerting

## Output:
1. Architecture diagram description
2. Resource specifications
3. Cost estimate
4. Security considerations
5. IaC approach (Terraform/Pulumi)`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: infraPrompt,
      temperature: 0.5,
    });

    return {
      infrastructure: response.content,
      requirements,
      designedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for DevOps-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const devopsKeywords = [
      'deploy', 'deployment', 'ci/cd', 'pipeline', 'infrastructure',
      'kubernetes', 'docker', 'container', 'monitoring', 'incident',
      'terraform', 'aws', 'gcp', 'azure', 'cloudflare', 'nginx',
      'jenkins', 'github actions', 'gitlab', 'build', 'release'
    ];

    if (devopsKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default DevOpsAgent;
export { DEVOPS_CONFIG };
