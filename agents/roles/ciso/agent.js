/**
 * MONOLITH OS - Chief Information Security Officer Agent
 * Security architecture, threat assessment, and compliance
 *
 * Responsibilities:
 * - Security strategy and architecture
 * - Threat assessment and incident response
 * - Security compliance (SOC2, GDPR, etc.)
 * - Vulnerability management
 * - Security awareness and training
 */

import RoleAgent from '../../core/RoleAgent.js';

const CISO_CONFIG = {
  roleId: 'ciso',
  roleName: 'Chief Information Security Officer',
  roleAbbr: 'CISO',
  tier: 2,

  responsibilities: [
    'Define and implement security strategy',
    'Conduct threat assessments and risk analysis',
    'Manage security incidents and response',
    'Ensure security compliance',
    'Oversee vulnerability management',
    'Lead security awareness programs',
    'Coordinate with CTO on secure architecture',
  ],

  authorityLimits: {
    maxApprovalAmount: 10000,
    canApproveSecurityTools: true,
    canBlockDeployments: true,
    canDeclareIncident: true,
    requiresCEOFor: ['major security investment', 'breach disclosure'],
  },

  reportsTo: 'cto',
  directReports: ['security-team'],

  roleDescription: `You are the Chief Information Security Officer, responsible for all security matters.

Your core competencies:
1. Security Architecture - Design secure systems
2. Threat Assessment - Identify and evaluate threats
3. Incident Response - Handle security incidents
4. Compliance - SOC2, GDPR, HIPAA, PCI-DSS
5. Risk Management - Security risk assessment

Decision Framework:
- Approve security tool purchases up to $10,000
- Block deployments with critical vulnerabilities
- Declare and manage security incidents
- Escalate breaches and major investments to CEO
- Coordinate with CTO on security architecture
- Work with CLO on compliance matters`,
};

class CISOAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CISO_CONFIG, ...config });

    // CISO-specific state
    this.incidents = [];
    this.vulnerabilities = [];
    this.complianceStatus = new Map();
  }

  /**
   * Conduct security assessment
   */
  async conductSecurityAssessment(target) {
    const assessPrompt = `Conduct a security assessment for this target.

## Target Information:
${JSON.stringify(target, null, 2)}

## Assessment Areas:
1. **Authentication & Access Control**
   - Authentication mechanisms
   - Authorization models
   - Session management
   - Password policies

2. **Data Protection**
   - Encryption at rest
   - Encryption in transit
   - Data classification
   - Backup security

3. **Network Security**
   - Firewall rules
   - Network segmentation
   - DDoS protection
   - VPN/secure access

4. **Application Security**
   - Input validation
   - Output encoding
   - OWASP Top 10
   - API security

5. **Infrastructure Security**
   - Patch management
   - Configuration hardening
   - Container security
   - Cloud security

6. **Monitoring & Logging**
   - Security logging
   - Alerting
   - SIEM integration

## Output:
1. Executive summary
2. Risk rating (Critical/High/Medium/Low)
3. Findings by category
4. Recommendations prioritized by risk
5. Compliance gaps`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: assessPrompt,
      temperature: 0.4,
    });

    return {
      assessment: response.content,
      target,
      assessedAt: new Date().toISOString(),
    };
  }

  /**
   * Handle security incident
   */
  async handleIncident(incident) {
    const incidentPrompt = `Handle this security incident.

## Incident Details:
${JSON.stringify(incident, null, 2)}

## Incident Response Framework:
1. **Identification**
   - What happened?
   - When was it detected?
   - What systems are affected?
   - What data may be compromised?

2. **Containment**
   - Immediate actions to stop the spread
   - Short-term containment
   - Long-term containment

3. **Eradication**
   - Root cause analysis
   - Remove threat actors/malware
   - Patch vulnerabilities

4. **Recovery**
   - System restoration
   - Validation of system integrity
   - Return to normal operations

5. **Lessons Learned**
   - What went wrong?
   - What can be improved?
   - Update procedures

## Output:
1. Incident severity classification
2. Immediate actions required
3. Communication plan (internal/external)
4. Recovery timeline
5. Escalation recommendation (CEO notification for breaches)`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: incidentPrompt,
      temperature: 0.3, // Lower for incident response precision
    });

    const processedIncident = {
      response: response.content,
      incident,
      handledAt: new Date().toISOString(),
    };

    this.incidents.push(processedIncident);
    return processedIncident;
  }

  /**
   * Review security compliance
   */
  async reviewCompliance(framework) {
    const compliancePrompt = `Review compliance status for this framework.

## Framework:
${JSON.stringify(framework, null, 2)}

## Common Frameworks:
- SOC 2 Type II
- GDPR
- HIPAA
- PCI-DSS
- ISO 27001
- NIST Cybersecurity Framework

## Review Areas:
1. **Policies & Procedures**
   - Documentation completeness
   - Policy enforcement

2. **Technical Controls**
   - Access controls
   - Encryption
   - Logging
   - Monitoring

3. **Administrative Controls**
   - Training
   - Background checks
   - Incident response

4. **Physical Controls**
   - Facility security
   - Asset management

## Output:
1. Compliance score/status
2. Gaps identified
3. Remediation recommendations
4. Evidence required
5. Timeline to compliance`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: compliancePrompt,
      temperature: 0.4,
    });

    return {
      review: response.content,
      framework,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Assess vulnerability
   */
  async assessVulnerability(vulnerability) {
    const vulnPrompt = `Assess this vulnerability and recommend action.

## Vulnerability Details:
${JSON.stringify(vulnerability, null, 2)}

## Assessment Criteria:
1. **CVSS Score** - If known
2. **Exploitability** - How easy to exploit?
3. **Impact** - What's the damage potential?
4. **Affected Systems** - Scope of impact
5. **Existing Mitigations** - Current protections

## Risk Rating:
- Critical: Immediate action, potential breach
- High: Fix within 24-48 hours
- Medium: Fix within 1-2 weeks
- Low: Fix in next patch cycle

## Output:
1. Risk rating with justification
2. Immediate mitigations
3. Long-term fix
4. Should deployment be blocked?
5. Escalation needed?`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: vulnPrompt,
      temperature: 0.4,
    });

    const assessment = {
      assessment: response.content,
      vulnerability,
      assessedAt: new Date().toISOString(),
    };

    this.vulnerabilities.push(assessment);
    return assessment;
  }

  /**
   * Review security architecture
   */
  async reviewSecurityArchitecture(architecture) {
    const archPrompt = `Review this architecture from a security perspective.

## Architecture:
${JSON.stringify(architecture, null, 2)}

## Security Review Checklist:
1. **Defense in Depth**
   - Multiple layers of security
   - No single point of failure

2. **Least Privilege**
   - Minimal access rights
   - Role-based access

3. **Zero Trust**
   - Never trust, always verify
   - Micro-segmentation

4. **Secure by Default**
   - Secure configurations
   - Disabled unnecessary features

5. **Data Flow Security**
   - Encryption requirements
   - Sensitive data handling

## Output:
1. Security posture assessment
2. Critical concerns
3. Recommendations
4. Approval status: APPROVED, NEEDS_CHANGES, BLOCKED`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: archPrompt,
      temperature: 0.4,
    });

    return {
      review: response.content,
      architecture,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for CISO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const cisoKeywords = [
      'security', 'vulnerability', 'threat', 'incident', 'breach',
      'compliance', 'soc2', 'gdpr', 'hipaa', 'pci', 'audit',
      'penetration', 'pentest', 'authentication', 'authorization',
      'encryption', 'firewall', 'intrusion', 'malware', 'phishing'
    ];

    if (cisoKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }

  // ==========================================
  // EMAIL & BROWSER INTEGRATION METHODS
  // ==========================================

  /**
   * Send security alert notification to stakeholders
   * @param {string[]} recipients - List of email addresses
   * @param {Object} alert - Security alert details
   * @returns {Promise<Object>} Send result
   */
  async sendSecurityAlert(recipients, alert) {
    const {
      id = `SEC-${Date.now()}`,
      type = 'security_alert',
      severity = 'medium', // low, medium, high, critical
      title,
      description,
      affectedSystems = [],
      indicators = [],
      recommendedActions = [],
      detectedAt = new Date().toISOString(),
    } = alert;

    const severityConfig = {
      critical: { bg: '#9b2c2c', label: 'CRITICAL', priority: 'P1' },
      high: { bg: '#c53030', label: 'HIGH', priority: 'P2' },
      medium: { bg: '#dd6b20', label: 'MEDIUM', priority: 'P3' },
      low: { bg: '#3182ce', label: 'LOW', priority: 'P4' },
    };

    const sev = severityConfig[severity] || severityConfig.medium;

    const subject = `[SECURITY ${sev.label}] ${sev.priority}: ${title} - ${id}`;

    const htmlBody = `
<html>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #1a1a2e; color: #edf2f7; padding: 0;">
  <div style="background: ${sev.bg}; padding: 20px; border-radius: 4px 4px 0 0;">
    <div style="display: flex; align-items: center;">
      <span style="font-size: 24px; margin-right: 10px;">&#128274;</span>
      <div>
        <h1 style="margin: 0; font-size: 18px; color: white;">
          Security Alert - ${sev.label}
        </h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 13px; color: white;">
          Alert ID: ${id} | Priority: ${sev.priority}
        </p>
      </div>
    </div>
  </div>

  <div style="background: #16213e; padding: 25px; border: 1px solid #0f3460; border-top: none;">
    <h2 style="margin: 0 0 15px 0; font-size: 16px; color: #e2e8f0;">
      ${title}
    </h2>

    <div style="background: #0f3460; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
      <p style="margin: 0; color: #a0aec0; white-space: pre-wrap; font-size: 14px;">
${description || 'Security event detected. Investigation in progress.'}
      </p>
    </div>

    <table style="width: 100%; color: #e2e8f0; font-size: 14px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; color: #718096;">Detected:</td>
        <td style="padding: 8px 0;">${detectedAt}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #718096;">Affected Systems:</td>
        <td style="padding: 8px 0;">${affectedSystems.length > 0 ? affectedSystems.join(', ') : 'Under investigation'}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #718096;">Alert Type:</td>
        <td style="padding: 8px 0;">${type.replace(/_/g, ' ').toUpperCase()}</td>
      </tr>
    </table>

    ${indicators.length > 0 ? `
    <div style="margin-bottom: 20px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #e2e8f0;">Indicators of Compromise (IoC):</h3>
      <div style="background: #0f3460; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
        ${indicators.map(i => `<div style="padding: 3px 0; color: #f6ad55;">${i}</div>`).join('')}
      </div>
    </div>
    ` : ''}

    ${recommendedActions.length > 0 ? `
    <div style="background: #744210; padding: 15px; border-radius: 4px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #fefcbf;">Recommended Actions:</h3>
      <ol style="margin: 0; padding-left: 20px; color: #fefcbf; font-size: 13px;">
        ${recommendedActions.map(a => `<li style="margin-bottom: 5px;">${a}</li>`).join('')}
      </ol>
    </div>
    ` : ''}
  </div>

  <div style="background: #0f3460; padding: 15px 25px; border: 1px solid #0f3460; border-top: none; border-radius: 0 0 4px 4px;">
    <p style="margin: 0; color: #718096; font-size: 11px;">
      <strong style="color: #e53e3e;">CONFIDENTIAL:</strong> This security alert is confidential and intended only for authorized personnel.
      <br>
      Sent by MONOLITH OS CISO Agent | ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;

    const results = [];
    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, subject, htmlBody, { isHtml: true });
      results.push({ recipient, ...result });
    }

    // Track alert
    this.incidents.push({
      id,
      type,
      severity,
      title,
      notifiedAt: new Date().toISOString(),
      recipients,
    });

    return {
      success: results.every(r => r.success),
      alertId: id,
      severity,
      notified: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Check security dashboard and monitor security tools
   * @param {string} url - Security dashboard URL (SIEM, Security tool, etc.)
   * @returns {Promise<Object>} Security status with metrics and screenshot
   */
  async checkSecurityDashboard(url) {
    console.log(`[CISO] Checking security dashboard: ${url}`);

    // Navigate to the security dashboard
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
    const screenshotPath = `screenshots/security-dashboard-${timestamp}.png`;
    const screenshot = await this.takeScreenshot(screenshotPath);

    // Get page content for analysis
    const contentResult = await this.getWebContent(url);

    // Analyze the security dashboard
    const analysisPrompt = `Analyze this security dashboard and provide a security status report.

## Dashboard URL: ${url}
## Page Content:
${(contentResult.content || '').substring(0, 5000)}

## Security Analysis:
1. **Threat Level**: Overall threat assessment (Low/Medium/High/Critical)
2. **Active Threats**: Any active security threats or attacks
3. **Security Events**:
   - Failed login attempts
   - Blocked attacks
   - Malware detections
   - Suspicious activities
4. **Compliance Status**: SOC2, GDPR, HIPAA status if visible
5. **Vulnerability Status**: Open vulnerabilities and their severity
6. **System Health**: Security tool/agent status
7. **Recent Incidents**: Any recent security incidents
8. **Alerts**: Active alerts that need attention
9. **Recommendations**: Immediate actions needed

Provide a structured security status report for executive review.`;

    const analysis = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: analysisPrompt,
      temperature: 0.3,
    });

    // Update compliance status based on dashboard
    this.complianceStatus.set(url, {
      checkedAt: new Date().toISOString(),
      analysis: analysis.content,
    });

    return {
      success: true,
      url,
      title: browseResult.title || contentResult.title,
      screenshot: screenshot.success ? screenshot.path : null,
      securityStatus: analysis.content,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Send formal security incident report to stakeholders
   * @param {string[]} recipients - List of email addresses (executives, legal, etc.)
   * @param {Object} incident - Incident details
   * @returns {Promise<Object>} Send result
   */
  async reportIncident(recipients, incident) {
    const {
      id = `INC-SEC-${Date.now()}`,
      classification = 'CONFIDENTIAL',
      severity = 'P2',
      type = 'security_incident',
      title,
      description,
      timeline = [],
      affectedSystems = [],
      dataImpact = null,
      containmentStatus = 'In Progress',
      rootCause = 'Under Investigation',
      remediation = [],
      lessonLearned = [],
      requiresDisclosure = false,
    } = incident;

    const severityLabels = {
      P1: { label: 'CRITICAL', bg: '#9b2c2c' },
      P2: { label: 'HIGH', bg: '#c53030' },
      P3: { label: 'MEDIUM', bg: '#dd6b20' },
      P4: { label: 'LOW', bg: '#3182ce' },
    };

    const sev = severityLabels[severity] || severityLabels.P2;

    const subject = `[${classification}] Security Incident Report: ${title} - ${id}`;

    const htmlBody = `
<html>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #2d3748; background: #f7fafc;">
  <div style="background: #1a202c; color: white; padding: 20px 25px; border-radius: 4px 4px 0 0;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h1 style="margin: 0; font-size: 20px;">
        Security Incident Report
      </h1>
      <span style="background: ${sev.bg}; padding: 4px 12px; border-radius: 3px; font-size: 12px; font-weight: bold;">
        ${sev.label}
      </span>
    </div>
    <p style="margin: 8px 0 0 0; opacity: 0.8; font-size: 13px;">
      Incident ID: ${id} | Classification: ${classification} | Status: ${containmentStatus}
    </p>
  </div>

  <div style="background: white; padding: 25px; border: 1px solid #e2e8f0; border-top: none;">
    <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1a202c; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
      ${title}
    </h2>

    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #4a5568; text-transform: uppercase;">Executive Summary</h3>
      <p style="margin: 0; color: #4a5568; line-height: 1.6;">
${description || 'A security incident has been identified and is being actively investigated.'}
      </p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
      <div style="background: #f7fafc; padding: 15px; border-radius: 4px;">
        <h4 style="margin: 0 0 10px 0; font-size: 12px; color: #718096; text-transform: uppercase;">Affected Systems</h4>
        <p style="margin: 0; color: #2d3748; font-size: 14px;">
          ${affectedSystems.length > 0 ? affectedSystems.join('<br>') : 'Under investigation'}
        </p>
      </div>
      <div style="background: #f7fafc; padding: 15px; border-radius: 4px;">
        <h4 style="margin: 0 0 10px 0; font-size: 12px; color: #718096; text-transform: uppercase;">Data Impact</h4>
        <p style="margin: 0; color: #2d3748; font-size: 14px;">
          ${dataImpact || 'Assessment in progress'}
        </p>
      </div>
    </div>

    ${timeline.length > 0 ? `
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #4a5568; text-transform: uppercase;">Incident Timeline</h3>
      <div style="border-left: 2px solid #e2e8f0; padding-left: 20px;">
        ${timeline.map(t => `
          <div style="margin-bottom: 10px;">
            <span style="color: #718096; font-size: 12px;">${t.time}</span>
            <p style="margin: 5px 0 0 0; color: #2d3748; font-size: 14px;">${t.event}</p>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #4a5568; text-transform: uppercase;">Root Cause</h3>
      <p style="margin: 0; color: #4a5568; font-size: 14px;">${rootCause}</p>
    </div>

    ${remediation.length > 0 ? `
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #4a5568; text-transform: uppercase;">Remediation Actions</h3>
      <ol style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px;">
        ${remediation.map(r => `<li style="margin-bottom: 5px;">${r}</li>`).join('')}
      </ol>
    </div>
    ` : ''}

    ${requiresDisclosure ? `
    <div style="background: #fff5f5; border: 1px solid #fc8181; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
      <h4 style="margin: 0 0 5px 0; color: #c53030; font-size: 14px;">Disclosure Required</h4>
      <p style="margin: 0; color: #742a2a; font-size: 13px;">
        This incident may require notification to regulatory bodies and/or affected parties. Legal review is recommended.
      </p>
    </div>
    ` : ''}
  </div>

  <div style="background: #edf2f7; padding: 15px 25px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 4px 4px;">
    <p style="margin: 0; color: #718096; font-size: 11px;">
      <strong style="color: #c53030;">CONFIDENTIAL:</strong> This incident report contains sensitive security information.
      Distribution is limited to authorized personnel only.
      <br>
      Generated by MONOLITH OS CISO Agent | ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;

    const results = [];
    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, subject, htmlBody, { isHtml: true });
      results.push({ recipient, ...result });
    }

    // Track incident report
    this.incidents.push({
      id,
      type: 'incident_report',
      severity,
      title,
      classification,
      reportedAt: new Date().toISOString(),
      recipients,
      requiresDisclosure,
    });

    return {
      success: results.every(r => r.success),
      incidentId: id,
      severity,
      classification,
      requiresDisclosure,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      sentAt: new Date().toISOString(),
    };
  }
}

export default CISOAgent;
export { CISO_CONFIG };
