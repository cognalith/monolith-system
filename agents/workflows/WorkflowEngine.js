/**
 * MONOLITH OS - Workflow Engine
 * Orchestrates multi-agent workflows with automatic handoffs
 *
 * Workflows define sequences of agent tasks that automatically
 * chain together, passing context and outputs between agents.
 */

import { EventEmitter } from 'events';

class WorkflowEngine extends EventEmitter {
  constructor(config = {}) {
    super();

    this.workflows = new Map();
    this.runningWorkflows = new Map();
    this.orchestrator = config.orchestrator;
    this.decisionLogger = config.decisionLogger;
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(workflow) {
    if (!workflow.id || !workflow.name || !workflow.steps) {
      throw new Error('Invalid workflow: must have id, name, and steps');
    }

    this.workflows.set(workflow.id, {
      ...workflow,
      registeredAt: new Date().toISOString(),
    });

    console.log(`[WORKFLOW] Registered workflow: ${workflow.name}`);
    return workflow;
  }

  /**
   * Start a workflow instance
   */
  async startWorkflow(workflowId, context = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const instance = {
      id: `${workflowId}-${Date.now()}`,
      workflowId,
      workflow,
      context,
      currentStep: 0,
      stepResults: [],
      status: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    this.runningWorkflows.set(instance.id, instance);
    this.emit('workflowStarted', { instance, workflow });

    console.log(`[WORKFLOW] Starting: ${workflow.name} (${instance.id})`);

    try {
      await this.executeWorkflow(instance);
      return instance;
    } catch (error) {
      instance.status = 'failed';
      instance.error = error.message;
      this.emit('workflowFailed', { instance, error });
      throw error;
    }
  }

  /**
   * Execute workflow steps sequentially
   */
  async executeWorkflow(instance) {
    const { workflow } = instance;

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      instance.currentStep = i;

      console.log(`[WORKFLOW] Step ${i + 1}/${workflow.steps.length}: ${step.name}`);

      // Check if step should be skipped based on condition
      if (step.condition && !this.evaluateCondition(step.condition, instance)) {
        console.log(`[WORKFLOW] Skipping step: ${step.name} (condition not met)`);
        instance.stepResults.push({
          step: step.name,
          skipped: true,
          reason: 'Condition not met',
        });
        continue;
      }

      // Build task from step definition
      const task = this.buildTask(step, instance);

      // Execute step
      const result = await this.executeStep(step, task, instance);

      // Store result
      instance.stepResults.push({
        step: step.name,
        role: step.role,
        result,
        completedAt: new Date().toISOString(),
      });

      // Check for escalation
      if (result.escalate) {
        console.log(`[WORKFLOW] Escalation triggered at step: ${step.name}`);
        instance.status = 'escalated';
        instance.escalationReason = result.escalateReason;
        this.emit('workflowEscalated', { instance, step, result });
        return instance;
      }

      // Update context with step output
      instance.context = {
        ...instance.context,
        [`step_${i}_output`]: result,
        lastStepOutput: result,
      };

      this.emit('stepCompleted', { instance, step, result });
    }

    // Workflow completed successfully
    instance.status = 'completed';
    instance.completedAt = new Date().toISOString();
    this.emit('workflowCompleted', { instance });

    console.log(`[WORKFLOW] Completed: ${workflow.name}`);
    return instance;
  }

  /**
   * Execute a single workflow step
   */
  async executeStep(step, task, instance) {
    const agent = this.orchestrator?.agents?.[step.role];

    if (!agent) {
      console.warn(`[WORKFLOW] Agent not found for role: ${step.role}`);
      return {
        error: `Agent not found: ${step.role}`,
        skipped: true,
      };
    }

    // Process task through agent
    const result = await agent.processTask(task);

    // Log the decision
    if (this.decisionLogger) {
      await this.decisionLogger.log({
        workflow: instance.workflowId,
        workflowInstance: instance.id,
        step: step.name,
        role: step.role,
        task,
        result,
      });
    }

    return result;
  }

  /**
   * Build a task from step definition and context
   */
  buildTask(step, instance) {
    // Replace template variables in content
    let content = step.taskTemplate || step.name;

    // Replace {{variable}} patterns with context values
    content = content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return instance.context[key] || match;
    });

    return {
      id: `${instance.id}-step-${instance.currentStep}`,
      content,
      priority: step.priority || 'MEDIUM',
      assigned_role: step.role,
      status: 'pending',
      workflow: instance.workflow.name,
      workflowInstanceId: instance.id,
      context: instance.context,
      previousStepOutput: instance.stepResults[instance.stepResults.length - 1]?.result,
    };
  }

  /**
   * Evaluate step condition
   */
  evaluateCondition(condition, instance) {
    if (typeof condition === 'function') {
      return condition(instance.context, instance.stepResults);
    }

    if (typeof condition === 'string') {
      // Simple condition evaluation
      const lastResult = instance.stepResults[instance.stepResults.length - 1];
      if (condition === 'previousStepSuccess') {
        return lastResult && !lastResult.error && !lastResult.escalate;
      }
      if (condition === 'previousStepFailed') {
        return lastResult && (lastResult.error || lastResult.escalate);
      }
    }

    return true;
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(instanceId) {
    return this.runningWorkflows.get(instanceId);
  }

  /**
   * List all workflow definitions
   */
  listWorkflows() {
    return Array.from(this.workflows.values());
  }

  /**
   * List running workflow instances
   */
  listRunningWorkflows() {
    return Array.from(this.runningWorkflows.values());
  }
}

export default WorkflowEngine;
