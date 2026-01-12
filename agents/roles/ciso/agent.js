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
}

export default CISOAgent;
export { CISO_CONFIG };
