/**
 * MONOLITH OS - Base Role Agent
 * Abstract base class for all role-specific agents
 * Provides common functionality for task processing, decision making, and handoffs
 */

import LLMRouter from './LLMRouter.js';
import DecisionLogger from './DecisionLogger.js';
import { EventEmitter } from 'events';

class RoleAgent extends EventEmitter {
  constructor(config) {
    super();

    // Role identity
    this.roleId = config.roleId;
    this.roleName = config.roleName;
    this.roleAbbr = config.roleAbbr;
    this.tier = config.tier;

    // Role context
    this.responsibilities = config.responsibilities || [];
    this.authorityLimits = config.authorityLimits || {};
    this.reportsTo = config.reportsTo || 'ceo';
    this.directReports = config.directReports || [];

    // System prompt for this role
    this.systemPrompt = this.buildSystemPrompt(config);

    // Dependencies
    this.llm = config.llmRouter || new LLMRouter();
    this.logger = config.decisionLogger || new DecisionLogger();

    // State
    this.isActive = false;
    this.currentTask = null;
    this.taskHistory = [];

    console.log(`[AGENT] ${this.roleAbbr} agent initialized`);
  }

  buildSystemPrompt(config) {
    return `You are the ${this.roleName} (${this.roleAbbr}) for MONOLITH OS, an AI-powered business operations system.

## Your Role
${config.roleDescription || `You are responsible for ${this.responsibilities.join(', ')}.`}

## Responsibilities
${this.responsibilities.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Authority Limits
${Object.entries(this.authorityLimits).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'Standard operational authority within your domain.'}

## Reporting Structure
- You report to: ${this.reportsTo.toUpperCase()}
- Direct reports: ${this.directReports.length > 0 ? this.directReports.join(', ') : 'None'}

## Decision Guidelines
1. Act within your authority limits
2. Escalate to CEO when:
   - Financial decisions exceed your threshold
   - Strategic direction changes required
   - Legal or compliance risks identified
   - Cross-functional conflicts arise
3. Document all decisions with clear rationale
4. Coordinate with other roles when their input is needed

## Output Format
When completing tasks, provide:
1. ANALYSIS: Your understanding of the task
2. ACTION: What you did or recommend
3. DECISION: Clear decision with rationale
4. HANDOFF: Any required handoffs to other roles (if applicable)
5. ESCALATE: Whether CEO input is needed (YES/NO with reason)

Be concise, professional, and decisive.`;
  }

  /**
   * Process a task assigned to this role
   */
  async processTask(task) {
    this.currentTask = task;
    this.isActive = true;

    console.log(`[${this.roleAbbr}] Processing task: ${task.id} - ${task.content.substring(0, 50)}...`);

    try {
      // Determine task type for LLM selection
      const taskType = this.classifyTask(task);

      // Build task-specific prompt
      const taskPrompt = this.buildTaskPrompt(task);

      // Get LLM response
      const response = await this.llm.complete({
        modelId: this.selectModelForTask(taskType),
        systemPrompt: this.systemPrompt,
        userMessage: taskPrompt,
        temperature: 0.7,
      });

      // Parse the response
      const result = this.parseResponse(response.content, task);

      // Log the decision
      await this.logDecision(task, result, response);

      // Handle any handoffs
      if (result.handoff) {
        this.emit('handoff', {
          fromRole: this.roleId,
          toRole: result.handoff.targetRole,
          task,
          context: result.handoff.context,
          deliverables: result.handoff.deliverables,
        });
      }

      // Check if escalation needed
      if (result.escalate) {
        this.emit('escalate', {
          role: this.roleId,
          task,
          reason: result.escalateReason,
          recommendation: result.action,
        });
      }

      // Add to history
      this.taskHistory.push({
        taskId: task.id,
        completedAt: new Date().toISOString(),
        result,
        tokens: response.inputTokens + response.outputTokens,
      });

      this.currentTask = null;
      this.isActive = false;

      return result;

    } catch (error) {
      console.error(`[${this.roleAbbr}] Error processing task:`, error.message);
      this.currentTask = null;
      this.isActive = false;

      // Emit error for handling
      this.emit('error', { role: this.roleId, task, error });
      throw error;
    }
  }

  /**
   * Classify the task type for LLM routing
   */
  classifyTask(task) {
    const content = task.content.toLowerCase();

    if (content.includes('draft') || content.includes('write') || content.includes('create document')) {
      return 'document_draft';
    }
    if (content.includes('analyze') || content.includes('review') || content.includes('evaluate')) {
      return 'analysis';
    }
    if (content.includes('decide') || content.includes('approve') || content.includes('strategic')) {
      return 'strategic_decision';
    }
    if (content.includes('code') || content.includes('technical') || content.includes('architecture')) {
      return 'code_review';
    }
    if (content.includes('summarize') || content.includes('brief') || content.includes('report')) {
      return 'summarization';
    }

    return 'general';
  }

  /**
   * Select appropriate model for task type
   */
  selectModelForTask(taskType) {
    // High-priority or strategic tasks use more capable models
    const modelPriority = {
      strategic_decision: 'claude-opus-4',
      document_draft: 'claude-sonnet-4',
      analysis: 'claude-sonnet-4',
      code_review: 'claude-sonnet-4',
      summarization: 'claude-haiku',
      general: 'claude-sonnet-4',
    };

    return modelPriority[taskType] || 'claude-sonnet-4';
  }

  /**
   * Build the task-specific prompt
   */
  buildTaskPrompt(task) {
    return `## Task Details
- Task ID: ${task.id}
- Priority: ${task.priority}
- Workflow: ${task.workflow || 'N/A'}
- Due Date: ${task.due_date || 'Not specified'}
- Status: ${task.status}

## Task Description
${task.content}

${task.notes ? `## Additional Notes\n${task.notes}` : ''}

## Your Assignment
Complete this task within your authority as ${this.roleName}.
If you need input from another role, specify the handoff.
If CEO decision is required, explain why and provide your recommendation.`;
  }

  /**
   * Parse the LLM response into structured result
   */
  parseResponse(content, task) {
    const result = {
      taskId: task.id,
      role: this.roleId,
      timestamp: new Date().toISOString(),
      analysis: '',
      action: '',
      decision: '',
      handoff: null,
      escalate: false,
      escalateReason: '',
      rawContent: content,
    };

    // Extract sections from response
    const analysisMatch = content.match(/ANALYSIS:?\s*([\s\S]*?)(?=ACTION:|DECISION:|HANDOFF:|ESCALATE:|$)/i);
    const actionMatch = content.match(/ACTION:?\s*([\s\S]*?)(?=DECISION:|HANDOFF:|ESCALATE:|$)/i);
    const decisionMatch = content.match(/DECISION:?\s*([\s\S]*?)(?=HANDOFF:|ESCALATE:|$)/i);
    const handoffMatch = content.match(/HANDOFF:?\s*([\s\S]*?)(?=ESCALATE:|$)/i);
    const escalateMatch = content.match(/ESCALATE:?\s*([\s\S]*?)$/i);

    if (analysisMatch) result.analysis = analysisMatch[1].trim();
    if (actionMatch) result.action = actionMatch[1].trim();
    if (decisionMatch) result.decision = decisionMatch[1].trim();

    // Parse handoff
    if (handoffMatch) {
      const handoffText = handoffMatch[1].trim();
      if (handoffText && !handoffText.toLowerCase().includes('none') && !handoffText.toLowerCase().includes('n/a')) {
        // Try to extract target role
        const roleMatch = handoffText.match(/(?:to|for)\s+(\w+)/i);
        result.handoff = {
          targetRole: roleMatch ? roleMatch[1].toLowerCase() : null,
          context: handoffText,
          deliverables: [],
        };
      }
    }

    // Parse escalation
    if (escalateMatch) {
      const escalateText = escalateMatch[1].trim();
      result.escalate = escalateText.toLowerCase().startsWith('yes');
      result.escalateReason = escalateText.replace(/^yes[:\s]*/i, '').replace(/^no[:\s]*/i, '').trim();
    }

    return result;
  }

  /**
   * Log the decision to the audit trail
   */
  async logDecision(task, result, response) {
    await this.logger.log({
      taskId: task.id,
      role: this.roleId,
      roleName: this.roleName,
      decision: result.decision,
      action: result.action,
      escalated: result.escalate,
      escalateReason: result.escalateReason,
      handoff: result.handoff,
      model: response.model,
      tokens: response.inputTokens + response.outputTokens,
      latencyMs: response.latencyMs,
      timestamp: result.timestamp,
    });
  }

  /**
   * Check if this role can handle a specific task type
   */
  canHandle(task) {
    // Override in subclasses for role-specific logic
    return task.assigned_role === this.roleId;
  }

  /**
   * Check if an action is within authority limits
   */
  isWithinAuthority(action, amount = 0) {
    if (this.authorityLimits.maxApprovalAmount && amount > this.authorityLimits.maxApprovalAmount) {
      return false;
    }
    return true;
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      roleId: this.roleId,
      roleName: this.roleName,
      isActive: this.isActive,
      currentTask: this.currentTask?.id || null,
      tasksCompleted: this.taskHistory.length,
      lastActive: this.taskHistory.length > 0
        ? this.taskHistory[this.taskHistory.length - 1].completedAt
        : null,
    };
  }
}

export default RoleAgent;
