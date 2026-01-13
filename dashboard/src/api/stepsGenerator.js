/**
 * MONOLITH OS - Steps Generator
 * Rule-based generation of task steps
 * Analyzes task content keywords to generate appropriate steps
 */

// Generate simple IDs without external dependencies
function generateId() {
  try {
    return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  } catch {
    return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Step templates based on task type keywords
const STEP_TEMPLATES = {
  // Setup/Configuration tasks
  setup: [
    { description: 'Review requirements and prerequisites' },
    { description: 'Prepare necessary resources and access' },
    { description: 'Execute setup procedure' },
    { description: 'Verify configuration and test functionality' },
    { description: 'Document setup for future reference' }
  ],

  // Migration tasks
  migration: [
    { description: 'Audit current state and dependencies' },
    { description: 'Create backup of existing data/resources' },
    { description: 'Execute migration steps' },
    { description: 'Validate migrated data/resources' },
    { description: 'Update documentation and notify stakeholders' }
  ],

  // Development/Implementation tasks
  development: [
    { description: 'Review specifications and acceptance criteria' },
    { description: 'Design and plan implementation approach' },
    { description: 'Implement core functionality' },
    { description: 'Write tests and validate implementation' },
    { description: 'Code review and merge to main branch' }
  ],

  // Documentation tasks
  documentation: [
    { description: 'Gather information from relevant sources' },
    { description: 'Create document outline/structure' },
    { description: 'Draft initial content' },
    { description: 'Review and revise for clarity' },
    { description: 'Finalize and publish document' }
  ],

  // Review/Audit tasks
  review: [
    { description: 'Define review scope and criteria' },
    { description: 'Conduct thorough review/audit' },
    { description: 'Document findings and issues' },
    { description: 'Prioritize action items' },
    { description: 'Create summary report with recommendations' }
  ],

  // Meeting/Communication tasks
  meeting: [
    { description: 'Prepare agenda and talking points' },
    { description: 'Schedule and send invitations' },
    { description: 'Conduct meeting and take notes' },
    { description: 'Distribute meeting notes/action items' }
  ],

  // Financial tasks
  financial: [
    { description: 'Gather financial data and documents' },
    { description: 'Review and verify numbers' },
    { description: 'Perform calculations/analysis' },
    { description: 'Document findings and recommendations' },
    { description: 'Submit for approval if required' }
  ],

  // Legal/Compliance tasks
  legal: [
    { description: 'Review legal requirements and implications' },
    { description: 'Consult with relevant stakeholders' },
    { description: 'Draft necessary documents/agreements' },
    { description: 'Review and revise based on feedback' },
    { description: 'Finalize and execute documents' }
  ],

  // Hiring/HR tasks
  hiring: [
    { description: 'Define role requirements and job description' },
    { description: 'Post job listing and source candidates' },
    { description: 'Screen and interview candidates' },
    { description: 'Evaluate and select top candidate' },
    { description: 'Extend offer and complete onboarding' }
  ],

  // Launch/Deployment tasks
  launch: [
    { description: 'Complete pre-launch checklist' },
    { description: 'Prepare marketing/communication materials' },
    { description: 'Execute deployment procedure' },
    { description: 'Monitor for issues and address any problems' },
    { description: 'Announce launch and gather initial feedback' }
  ],

  // Default generic steps
  default: [
    { description: 'Understand requirements and context' },
    { description: 'Plan approach and identify resources needed' },
    { description: 'Execute primary action items' },
    { description: 'Verify completion and quality' },
    { description: 'Document and close out task' }
  ]
};

// Keywords that map to step templates
const KEYWORD_MAPPINGS = {
  setup: ['setup', 'set up', 'configure', 'install', 'initialize', 'create', 'establish'],
  migration: ['migrate', 'migration', 'move', 'transfer', 'archive', 'exit', 'transition'],
  development: ['develop', 'implement', 'build', 'code', 'fix', 'bug', 'feature', 'integrate'],
  documentation: ['document', 'documentation', 'write', 'draft', 'formalize', 'record'],
  review: ['review', 'audit', 'evaluate', 'assess', 'analyze', 'inspect', 'check'],
  meeting: ['meet', 'meeting', 'discuss', 'schedule', 'call', 'sync'],
  financial: ['financial', 'budget', 'cost', 'expense', 'payment', 'invoice', 'accounting', 'loan'],
  legal: ['legal', 'contract', 'agreement', 'compliance', 'policy', 'register', 'license'],
  hiring: ['hire', 'hiring', 'recruit', 'onboard', 'personnel', 'team', 'staff'],
  launch: ['launch', 'deploy', 'release', 'publish', 'go live', 'production', 'app store']
};

/**
 * Detect task type based on content keywords
 * @param {string} content - The task content
 * @returns {string} The detected task type
 */
function detectTaskType(content) {
  const lowerContent = content.toLowerCase();

  for (const [type, keywords] of Object.entries(KEYWORD_MAPPINGS)) {
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        return type;
      }
    }
  }

  return 'default';
}

/**
 * Generate context-aware steps based on task metadata
 * @param {object} task - The full task object
 * @returns {Array} Customized step template
 */
function customizeStepsForContext(task, baseSteps) {
  const customSteps = [...baseSteps];

  // Add priority-specific steps for CRITICAL tasks
  if (task.priority === 'CRITICAL') {
    customSteps.unshift({
      description: 'Assess urgency and notify relevant stakeholders'
    });
  }

  // Add workflow-specific context
  if (task.workflow) {
    const workflowLower = task.workflow.toLowerCase();

    // TeeMates specific
    if (workflowLower.includes('teemamtes') || workflowLower.includes('product launch')) {
      // Already covered by launch template
    }

    // Replit migration specific
    if (workflowLower.includes('replit') || workflowLower.includes('migration')) {
      // Ensure backup step is prominent
      const hasBackup = customSteps.some(s =>
        s.description.toLowerCase().includes('backup')
      );
      if (!hasBackup) {
        customSteps.splice(1, 0, {
          description: 'Create backup of existing resources before migration'
        });
      }
    }
  }

  // Add role-specific considerations
  if (task.assigned_role) {
    const role = task.assigned_role.toLowerCase();

    if (role === 'cfo' || role === 'finance') {
      // Ensure financial validation
      const hasValidation = customSteps.some(s =>
        s.description.toLowerCase().includes('verify') ||
        s.description.toLowerCase().includes('validate')
      );
      if (!hasValidation) {
        customSteps.push({
          description: 'Verify financial accuracy and compliance'
        });
      }
    }

    if (role === 'ceo') {
      // CEO tasks often need stakeholder communication
      const hasCommunication = customSteps.some(s =>
        s.description.toLowerCase().includes('stakeholder') ||
        s.description.toLowerCase().includes('communicate')
      );
      if (!hasCommunication) {
        customSteps.push({
          description: 'Communicate outcomes to relevant stakeholders'
        });
      }
    }
  }

  // Limit to 5 steps max
  return customSteps.slice(0, 5);
}

/**
 * Generate steps for a task based on its content and metadata
 * @param {object} task - The task object with content, priority, workflow, etc.
 * @returns {Array<{id: string, description: string, order: number, completed: boolean}>}
 */
export function generateStepsForTask(task) {
  if (!task || !task.content) {
    throw new Error('Task with content is required');
  }

  // Detect task type from content
  const taskType = detectTaskType(task.content);
  console.log(`[STEPS-GENERATOR] Detected task type: ${taskType} for "${task.content.substring(0, 50)}..."`);

  // Get base template
  const baseTemplate = STEP_TEMPLATES[taskType] || STEP_TEMPLATES.default;

  // Customize based on context
  const customizedSteps = customizeStepsForContext(task, baseTemplate);

  // Generate final steps with IDs and ordering
  const steps = customizedSteps.map((step, index) => ({
    id: generateId(),
    description: step.description,
    order: index + 1,
    completed: false,
    createdAt: new Date().toISOString()
  }));

  console.log(`[STEPS-GENERATOR] Generated ${steps.length} steps for task ${task.id}`);

  return steps;
}

/**
 * Regenerate steps for a task (clears existing completion status)
 * @param {object} task - The task object
 * @returns {Array} New steps array
 */
export function regenerateSteps(task) {
  return generateStepsForTask(task);
}

/**
 * Get available step templates
 * @returns {object} Map of template types to step arrays
 */
export function getStepTemplates() {
  return { ...STEP_TEMPLATES };
}

/**
 * Get keyword mappings for debugging
 * @returns {object} Map of types to keywords
 */
export function getKeywordMappings() {
  return { ...KEYWORD_MAPPINGS };
}

export default {
  generateStepsForTask,
  regenerateSteps,
  getStepTemplates,
  getKeywordMappings
};
