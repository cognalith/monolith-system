/**
 * MONOLITH OS - Workflows Module
 * Export workflow engine and predefined workflows
 */

import WorkflowEngine from './WorkflowEngine.js';
import workflows, {
  newFeatureWorkflow,
  vendorEvaluationWorkflow,
  onboardingWorkflow,
  productLaunchWorkflow,
  securityIncidentWorkflow,
  quarterlyReviewWorkflow,
  complianceAuditWorkflow,
  platformMigrationWorkflow,
} from './definitions.js';

export {
  WorkflowEngine,
  workflows,
  newFeatureWorkflow,
  vendorEvaluationWorkflow,
  onboardingWorkflow,
  productLaunchWorkflow,
  securityIncidentWorkflow,
  quarterlyReviewWorkflow,
  complianceAuditWorkflow,
  platformMigrationWorkflow,
};

export default WorkflowEngine;
