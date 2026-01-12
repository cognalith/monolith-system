/**
 * MONOLITH OS - Predefined Workflow Definitions
 * Multi-agent workflows for common business processes
 */

/**
 * New Feature Development Workflow
 * Involves: CPO → CTO → DevOps → QA → COO
 */
export const newFeatureWorkflow = {
  id: 'new-feature',
  name: 'New Feature Development',
  description: 'End-to-end workflow for developing and shipping a new feature',
  trigger: 'manual',
  steps: [
    {
      name: 'Feature Specification Review',
      role: 'cpo',
      taskTemplate: 'Review and finalize feature specification for: {{featureName}}',
      priority: 'HIGH',
    },
    {
      name: 'Technical Feasibility Assessment',
      role: 'cto',
      taskTemplate: 'Assess technical feasibility and create architecture plan for: {{featureName}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Infrastructure Planning',
      role: 'devops',
      taskTemplate: 'Plan infrastructure and deployment pipeline for: {{featureName}}',
      priority: 'MEDIUM',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Test Plan Creation',
      role: 'qa',
      taskTemplate: 'Create comprehensive test plan for: {{featureName}}',
      priority: 'MEDIUM',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Operational Readiness',
      role: 'coo',
      taskTemplate: 'Ensure operational readiness and create launch plan for: {{featureName}}',
      priority: 'MEDIUM',
      condition: 'previousStepSuccess',
    },
  ],
};

/**
 * Vendor Evaluation Workflow
 * Involves: COO → CFO → CLO → CISO → CEO (if needed)
 */
export const vendorEvaluationWorkflow = {
  id: 'vendor-evaluation',
  name: 'Vendor Evaluation',
  description: 'Comprehensive vendor evaluation involving operations, finance, legal, and security',
  trigger: 'manual',
  steps: [
    {
      name: 'Operational Assessment',
      role: 'coo',
      taskTemplate: 'Evaluate vendor capabilities and operational fit for: {{vendorName}}',
      priority: 'HIGH',
    },
    {
      name: 'Financial Analysis',
      role: 'cfo',
      taskTemplate: 'Analyze vendor pricing and financial impact for: {{vendorName}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Security Review',
      role: 'ciso',
      taskTemplate: 'Conduct security assessment of vendor: {{vendorName}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Contract Review',
      role: 'clo',
      taskTemplate: 'Review and draft contract terms for vendor: {{vendorName}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
  ],
};

/**
 * New Hire Onboarding Workflow
 * Involves: CHRO → CTO → DevOps → CISO
 */
export const onboardingWorkflow = {
  id: 'new-hire-onboarding',
  name: 'New Hire Onboarding',
  description: 'End-to-end onboarding workflow for new technical hires',
  trigger: 'manual',
  steps: [
    {
      name: 'HR Onboarding',
      role: 'chro',
      taskTemplate: 'Complete HR onboarding checklist for: {{employeeName}} - {{role}}',
      priority: 'HIGH',
    },
    {
      name: 'Technical Setup',
      role: 'cto',
      taskTemplate: 'Define technical onboarding requirements for: {{employeeName}} - {{role}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Access Provisioning',
      role: 'devops',
      taskTemplate: 'Provision system access and development environment for: {{employeeName}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Security Training',
      role: 'ciso',
      taskTemplate: 'Assign security training and access review for: {{employeeName}}',
      priority: 'MEDIUM',
      condition: 'previousStepSuccess',
    },
  ],
};

/**
 * Product Launch Workflow
 * Involves: CPO → CMO → CRO → CLO → COO
 */
export const productLaunchWorkflow = {
  id: 'product-launch',
  name: 'Product Launch',
  description: 'Comprehensive product launch coordination across all departments',
  trigger: 'manual',
  steps: [
    {
      name: 'Product Readiness',
      role: 'cpo',
      taskTemplate: 'Verify product readiness and finalize launch scope for: {{productName}}',
      priority: 'CRITICAL',
    },
    {
      name: 'Marketing Launch Plan',
      role: 'cmo',
      taskTemplate: 'Create and execute marketing launch plan for: {{productName}}',
      priority: 'CRITICAL',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Sales Enablement',
      role: 'cro',
      taskTemplate: 'Prepare sales team and enablement materials for: {{productName}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Legal Compliance',
      role: 'clo',
      taskTemplate: 'Ensure legal compliance and documentation for: {{productName}} launch',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Operational Launch',
      role: 'coo',
      taskTemplate: 'Execute operational launch plan for: {{productName}}',
      priority: 'CRITICAL',
      condition: 'previousStepSuccess',
    },
  ],
};

/**
 * Security Incident Response Workflow
 * Involves: CISO → CTO → CLO → CMO → CEO
 */
export const securityIncidentWorkflow = {
  id: 'security-incident',
  name: 'Security Incident Response',
  description: 'Coordinated response to security incidents',
  trigger: 'automatic',
  triggerConditions: ['security_alert', 'breach_detected'],
  steps: [
    {
      name: 'Incident Assessment',
      role: 'ciso',
      taskTemplate: 'Assess and contain security incident: {{incidentDescription}}',
      priority: 'CRITICAL',
    },
    {
      name: 'Technical Remediation',
      role: 'cto',
      taskTemplate: 'Implement technical remediation for: {{incidentDescription}}',
      priority: 'CRITICAL',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Legal Assessment',
      role: 'clo',
      taskTemplate: 'Assess legal and regulatory implications of: {{incidentDescription}}',
      priority: 'CRITICAL',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Communication Plan',
      role: 'cmo',
      taskTemplate: 'Prepare external communication plan for: {{incidentDescription}}',
      priority: 'HIGH',
      condition: (context, results) => {
        // Only if incident is customer-facing
        return context.customerImpact === true;
      },
    },
  ],
};

/**
 * Quarterly Business Review Workflow
 * Involves: CFO → CRO → CMO → CPO → COO → CoS
 */
export const quarterlyReviewWorkflow = {
  id: 'quarterly-review',
  name: 'Quarterly Business Review',
  description: 'Comprehensive quarterly business review across all functions',
  trigger: 'scheduled',
  schedule: 'quarterly',
  steps: [
    {
      name: 'Financial Review',
      role: 'cfo',
      taskTemplate: 'Prepare Q{{quarter}} financial review and analysis',
      priority: 'HIGH',
    },
    {
      name: 'Revenue Analysis',
      role: 'cro',
      taskTemplate: 'Analyze Q{{quarter}} revenue performance and pipeline',
      priority: 'HIGH',
    },
    {
      name: 'Marketing Performance',
      role: 'cmo',
      taskTemplate: 'Review Q{{quarter}} marketing performance and ROI',
      priority: 'MEDIUM',
    },
    {
      name: 'Product Progress',
      role: 'cpo',
      taskTemplate: 'Report on Q{{quarter}} product progress and roadmap status',
      priority: 'MEDIUM',
    },
    {
      name: 'Operational Metrics',
      role: 'coo',
      taskTemplate: 'Compile Q{{quarter}} operational metrics and efficiency analysis',
      priority: 'MEDIUM',
    },
    {
      name: 'Executive Summary',
      role: 'cos',
      taskTemplate: 'Synthesize Q{{quarter}} review into executive briefing for CEO',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
  ],
};

/**
 * Compliance Audit Workflow
 * Involves: CCO → CLO → CISO → CFO → CoS
 */
export const complianceAuditWorkflow = {
  id: 'compliance-audit',
  name: 'Compliance Audit',
  description: 'Annual compliance audit coordination',
  trigger: 'scheduled',
  schedule: 'annual',
  steps: [
    {
      name: 'Audit Planning',
      role: 'cco',
      taskTemplate: 'Plan and scope {{auditType}} compliance audit',
      priority: 'HIGH',
    },
    {
      name: 'Legal Review',
      role: 'clo',
      taskTemplate: 'Review legal compliance status for {{auditType}} audit',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Security Compliance',
      role: 'ciso',
      taskTemplate: 'Prepare security compliance documentation for {{auditType}} audit',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Financial Compliance',
      role: 'cfo',
      taskTemplate: 'Prepare financial compliance documentation for {{auditType}} audit',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Audit Coordination',
      role: 'cos',
      taskTemplate: 'Coordinate final {{auditType}} audit preparation and CEO briefing',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
  ],
};

/**
 * Platform Migration Workflow
 * Involves: CTO → DevOps → CISO → QA → COO → Data
 */
export const platformMigrationWorkflow = {
  id: 'platform-migration',
  name: 'Platform Migration',
  description: 'End-to-end platform or infrastructure migration',
  trigger: 'manual',
  steps: [
    {
      name: 'Migration Architecture',
      role: 'cto',
      taskTemplate: 'Design migration architecture from {{sourceSystem}} to {{targetSystem}}',
      priority: 'HIGH',
    },
    {
      name: 'Infrastructure Setup',
      role: 'devops',
      taskTemplate: 'Set up infrastructure for migration to {{targetSystem}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Security Assessment',
      role: 'ciso',
      taskTemplate: 'Security assessment of {{targetSystem}} migration plan',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Data Migration Plan',
      role: 'data',
      taskTemplate: 'Create data migration plan from {{sourceSystem}} to {{targetSystem}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Migration Testing',
      role: 'qa',
      taskTemplate: 'Create and execute migration test plan for {{targetSystem}}',
      priority: 'HIGH',
      condition: 'previousStepSuccess',
    },
    {
      name: 'Migration Execution',
      role: 'coo',
      taskTemplate: 'Coordinate and execute migration cutover to {{targetSystem}}',
      priority: 'CRITICAL',
      condition: 'previousStepSuccess',
    },
  ],
};

// Export all workflows
export const workflows = [
  newFeatureWorkflow,
  vendorEvaluationWorkflow,
  onboardingWorkflow,
  productLaunchWorkflow,
  securityIncidentWorkflow,
  quarterlyReviewWorkflow,
  complianceAuditWorkflow,
  platformMigrationWorkflow,
];

export default workflows;
