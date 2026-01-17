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

  // ==========================================
  // EMAIL & BROWSER INTEGRATION METHODS
  // ==========================================

  /**
   * Check monitoring dashboard and capture current status
   * @param {string} url - Monitoring dashboard URL (e.g., Grafana, Datadog)
   * @returns {Promise<Object>} Dashboard status with metrics and screenshot
   */
  async checkMonitoringDashboard(url) {
    console.log(`[DevOps] Checking monitoring dashboard: ${url}`);

    // Navigate to the monitoring dashboard
    const browseResult = await this.browseUrl(url);

    if (!browseResult.success) {
      return {
        success: false,
        error: browseResult.error,
        url,
      };
    }

    // Take a screenshot for records/evidence
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `screenshots/monitoring-${timestamp}.png`;
    const screenshot = await this.takeScreenshot(screenshotPath);

    // Get page content to extract metrics
    const contentResult = await this.getWebContent(url);

    // Analyze the monitoring data
    const analysisPrompt = `Analyze this monitoring dashboard and provide a status report.

## Dashboard URL: ${url}
## Page Content:
${(contentResult.content || '').substring(0, 5000)}

## Analysis Required:
1. **System Health**: Overall system status (Healthy/Degraded/Critical)
2. **Key Metrics**:
   - CPU/Memory utilization
   - Response times
   - Error rates
   - Throughput
3. **Alerts**: Any active alerts or warnings
4. **Anomalies**: Unusual patterns or spikes
5. **Services Status**: Status of individual services
6. **Recommendations**: Any actions needed

Provide a structured status report suitable for operations review.`;

    const analysis = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: analysisPrompt,
      temperature: 0.3,
    });

    return {
      success: true,
      url,
      title: browseResult.title || contentResult.title,
      screenshot: screenshot.success ? screenshot.path : null,
      status: analysis.content,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Send incident alert emails to on-call team
   * @param {string[]} recipients - List of on-call team email addresses
   * @param {Object} incident - Incident details
   * @returns {Promise<Object>} Email send results
   */
  async alertOnIncident(recipients, incident) {
    const {
      id = `INC-${Date.now()}`,
      severity = 'P2',
      title,
      description,
      affectedServices = [],
      startTime = new Date().toISOString(),
      currentStatus = 'Investigating',
    } = incident;

    // Determine severity styling
    const severityColors = {
      P1: { bg: '#c53030', label: 'CRITICAL' },
      P2: { bg: '#dd6b20', label: 'HIGH' },
      P3: { bg: '#d69e2e', label: 'MEDIUM' },
      P4: { bg: '#3182ce', label: 'LOW' },
    };

    const sevStyle = severityColors[severity] || severityColors.P3;

    const subject = `[${sevStyle.label}] ${severity} Incident: ${title} - ${id}`;

    const htmlBody = `
<html>
<body style="font-family: 'Consolas', 'Monaco', monospace; max-width: 700px; margin: 0 auto; background: #1a202c; color: #e2e8f0; padding: 20px;">
  <div style="background: ${sevStyle.bg}; color: white; padding: 15px; border-radius: 4px 4px 0 0;">
    <h1 style="margin: 0; font-size: 18px;">
      ${sevStyle.label} INCIDENT ALERT
    </h1>
  </div>

  <div style="background: #2d3748; padding: 20px; border-radius: 0 0 4px 4px;">
    <table style="width: 100%; color: #e2e8f0; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #a0aec0;">Incident ID:</td>
        <td style="padding: 8px 0; font-weight: bold;">${id}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #a0aec0;">Severity:</td>
        <td style="padding: 8px 0;"><span style="background: ${sevStyle.bg}; color: white; padding: 2px 8px; border-radius: 3px;">${severity}</span></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #a0aec0;">Status:</td>
        <td style="padding: 8px 0;">${currentStatus}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #a0aec0;">Start Time:</td>
        <td style="padding: 8px 0;">${startTime}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #a0aec0;">Affected:</td>
        <td style="padding: 8px 0;">${affectedServices.join(', ') || 'TBD'}</td>
      </tr>
    </table>

    <div style="margin-top: 20px; padding: 15px; background: #1a202c; border-radius: 4px;">
      <h3 style="margin: 0 0 10px 0; color: #e2e8f0; font-size: 14px;">Description:</h3>
      <p style="margin: 0; color: #a0aec0; white-space: pre-wrap;">${description || 'Under investigation'}</p>
    </div>

    <div style="margin-top: 20px; padding: 15px; background: #744210; border-radius: 4px;">
      <p style="margin: 0; color: #fefcbf; font-size: 12px;">
        <strong>ACTION REQUIRED:</strong> Please acknowledge this incident and join the incident channel immediately.
      </p>
    </div>
  </div>

  <p style="color: #718096; font-size: 11px; margin-top: 20px; text-align: center;">
    Sent by MONOLITH OS DevOps Agent | ${new Date().toISOString()}
  </p>
</body>
</html>`;

    const results = [];
    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, subject, htmlBody, { isHtml: true });
      results.push({ recipient, ...result });
    }

    // Track incident internally
    this.incidents.push({
      id,
      severity,
      title,
      description,
      affectedServices,
      startTime,
      notifiedAt: new Date().toISOString(),
      recipients,
    });

    return {
      success: results.every(r => r.success),
      incidentId: id,
      severity,
      notified: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Verify a deployment by checking if the URL is live and responding
   * @param {string} url - Deployment URL to verify
   * @returns {Promise<Object>} Verification result with status and screenshot
   */
  async verifyDeployment(url) {
    console.log(`[DevOps] Verifying deployment at: ${url}`);

    const startTime = Date.now();

    // Navigate to the deployment URL
    const browseResult = await this.browseUrl(url);

    const responseTime = Date.now() - startTime;

    if (!browseResult.success) {
      return {
        success: false,
        isLive: false,
        url,
        error: browseResult.error,
        responseTime,
        verifiedAt: new Date().toISOString(),
      };
    }

    // Take a screenshot as evidence
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `screenshots/deployment-verify-${timestamp}.png`;
    const screenshot = await this.takeScreenshot(screenshotPath);

    // Get page content for validation
    const contentResult = await this.getWebContent(url);

    // Analyze if deployment looks healthy
    const healthCheckPrompt = `Analyze this deployed application to verify it's working correctly.

## URL: ${url}
## HTTP Status: ${browseResult.status || 200}
## Response Time: ${responseTime}ms
## Page Title: ${browseResult.title || contentResult.title}
## Page Content:
${(contentResult.content || '').substring(0, 3000)}

## Verification Checks:
1. Is the page loading correctly (not an error page)?
2. Are there any visible errors or warnings?
3. Does the content look like the expected application?
4. Is the response time acceptable (<3000ms)?
5. Any signs of deployment issues?

Provide a brief verification report with:
- Status: HEALTHY | DEGRADED | FAILED
- Issues found (if any)
- Recommendations`;

    const analysis = await this.llm.complete({
      modelId: 'claude-haiku',
      systemPrompt: this.systemPrompt,
      userMessage: healthCheckPrompt,
      temperature: 0.2,
    });

    // Determine overall status
    const isHealthy = analysis.content.toLowerCase().includes('status: healthy');
    const isDegraded = analysis.content.toLowerCase().includes('status: degraded');

    // Track deployment verification
    const verification = {
      url,
      isLive: true,
      status: isHealthy ? 'HEALTHY' : isDegraded ? 'DEGRADED' : 'FAILED',
      responseTime,
      screenshot: screenshot.success ? screenshot.path : null,
      analysis: analysis.content,
      verifiedAt: new Date().toISOString(),
    };

    this.deployments.push(verification);

    return {
      success: true,
      ...verification,
    };
  }
}

export default DevOpsAgent;
export { DEVOPS_CONFIG };
