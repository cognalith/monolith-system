/**
 * AGENT EXECUTOR - Phase 8 Task Execution
 * Cognalith Inc. | Monolith System
 *
 * Executes tasks using LLM calls with token tracking:
 * - Role-specific system prompts
 * - Task execution with OpenAI/Anthropic APIs
 * - Blocker detection and escalation
 * - Output parsing and validation
 */

import OpenAI from 'openai';
import TokenTracker from './TokenTracker.js';
import { BLOCKER_TYPES } from './ExecutionEngine.js';

// Role system prompts
const ROLE_SYSTEM_PROMPTS = {
  ceo: `You are Frank Tina, CEO of Cognalith Inc. You make strategic decisions, set company direction, and approve major initiatives. When executing tasks:
- Focus on high-level business outcomes
- Delegate operational details to appropriate executives
- Flag anything requiring board approval or significant financial commitment
- Be decisive but thoughtful`,

  cos: `You are the Chief of Staff at Cognalith Inc. You coordinate between departments, manage Frank's priorities, and ensure operational excellence. When executing tasks:
- Coordinate cross-functional initiatives
- Prepare executive summaries and briefings
- Track action items and follow up
- Escalate blockers to appropriate executives`,

  cto: `You are the Chief Technology Officer at Cognalith Inc. You lead technology strategy and engineering excellence. When executing tasks:
- Focus on technical architecture and implementation
- Ensure code quality and best practices
- Plan technical roadmaps and migrations
- Review and approve technical decisions`,

  cfo: `You are the Chief Financial Officer at Cognalith Inc. You manage financial operations and strategy. When executing tasks:
- Analyze financial implications
- Review budgets and spending
- Flag any costs requiring approval
- Ensure compliance with financial policies`,

  cmo: `You are the Chief Marketing Officer at Cognalith Inc. You lead marketing strategy and brand development. When executing tasks:
- Focus on brand messaging and positioning
- Plan marketing campaigns and content
- Analyze market trends and competitors
- Optimize marketing spend and ROI`,

  coo: `You are the Chief Operating Officer at Cognalith Inc. You oversee daily operations and execution. When executing tasks:
- Optimize operational processes
- Ensure smooth cross-team workflows
- Manage resources and capacity
- Track operational metrics`,

  cpo: `You are the Chief Product Officer at Cognalith Inc. You lead product strategy and development. When executing tasks:
- Define product vision and roadmap
- Prioritize features based on user needs
- Coordinate with engineering on delivery
- Analyze product metrics and feedback`,

  ciso: `You are the Chief Information Security Officer at Cognalith Inc. You ensure security and compliance. When executing tasks:
- Identify security risks and vulnerabilities
- Implement security best practices
- Ensure regulatory compliance
- Respond to security incidents`,

  clo: `You are the General Counsel at Cognalith Inc. You manage legal affairs and compliance. When executing tasks:
- Review legal documents and contracts
- Ensure regulatory compliance
- Manage intellectual property
- Flag legal risks and liabilities`,

  chro: `You are the Chief Human Resources Officer at Cognalith Inc. You lead people operations. When executing tasks:
- Manage hiring and onboarding
- Develop HR policies and culture
- Handle employee relations
- Plan organizational development`,

  devops: `You are the DevOps Lead at Cognalith Inc. You manage infrastructure and deployments. When executing tasks:
- Automate deployment pipelines
- Maintain cloud infrastructure
- Monitor system health and performance
- Implement reliability practices`,

  qa: `You are the QA Lead at Cognalith Inc. You ensure software quality. When executing tasks:
- Design and execute test plans
- Identify bugs and quality issues
- Automate testing processes
- Track quality metrics`,

  swe: `You are a Software Engineer at Cognalith Inc. You build and maintain software systems. When executing tasks:
- Write clean, maintainable code
- Follow coding standards and best practices
- Debug and fix issues
- Document code and APIs`,
};

// Blocker detection patterns
const BLOCKER_PATTERNS = {
  auth: [
    /requires?\s+(login|authentication|authorization)/i,
    /need\s+to\s+(sign\s+in|log\s+in|authenticate)/i,
    /access\s+denied|unauthorized/i,
    /password|credentials\s+required/i,
  ],
  payment: [
    /requires?\s+payment/i,
    /subscription|billing|invoice/i,
    /\$\d+|pay\s+for|purchase/i,
    /credit\s+card|payment\s+method/i,
    /cost|expense|budget\s+approval/i,
  ],
  decision: [
    /decision\s+(fork|needed|required)/i,
    /which\s+option|choose\s+between/i,
    /approval\s+(needed|required)/i,
    /confirm\s+before\s+proceeding/i,
    /multiple\s+approaches|alternatives/i,
  ],
  agent: [
    /waiting\s+(for|on)\s+\w+/i,
    /depends\s+on|blocked\s+by/i,
    /need\s+input\s+from/i,
    /prerequisite|dependency/i,
  ],
};

/**
 * AgentExecutor class for executing tasks via LLM
 */
class AgentExecutor {
  constructor(config = {}) {
    this.config = {
      model: config.model || 'gpt-4o-mini',
      maxTokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.7,
      ...config,
    };

    // Initialize OpenAI client
    this.openai = null;
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log('[AGENT-EXECUTOR] OpenAI client initialized');
    } else {
      console.warn('[AGENT-EXECUTOR] No OPENAI_API_KEY found');
    }

    // Initialize token tracker
    this.tokenTracker = new TokenTracker(config);

    // Execution stats
    this.stats = {
      tasksExecuted: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksBlocked: 0,
    };
  }

  /**
   * Create an executor function for a specific agent role
   * @param {string} agentRole - The agent role
   * @returns {Function} Executor function
   */
  createExecutor(agentRole) {
    return async (task) => {
      return this.executeTask(agentRole, task);
    };
  }

  /**
   * Execute a task for a specific agent
   * @param {string} agentRole - The agent role
   * @param {Object} task - The task to execute
   * @returns {Promise<Object>} Execution result
   */
  async executeTask(agentRole, task) {
    console.log(`[AGENT-EXECUTOR] ${agentRole} executing task: ${task.title}`);
    this.stats.tasksExecuted++;

    // Estimate tokens before execution
    const estimation = this.tokenTracker.estimateTaskTokens(task);
    await this.tokenTracker.setEstimatedTokens(task.id, estimation.totalTokens);

    console.log(`[AGENT-EXECUTOR] Estimated ${estimation.totalTokens} tokens for task`);

    // Build the prompt
    const systemPrompt = this.buildSystemPrompt(agentRole);
    const userPrompt = this.buildUserPrompt(task);

    // Execute via LLM
    const startTime = Date.now();
    let result;

    try {
      if (!this.openai) {
        // Simulate execution if no API key
        result = await this.simulateExecution(agentRole, task);
      } else {
        result = await this.callLLM(systemPrompt, userPrompt, task);
      }

      const latencyMs = Date.now() - startTime;

      // Record actual token usage
      await this.tokenTracker.recordUsage({
        taskId: task.id,
        agentRole,
        model: this.config.model,
        inputTokens: result.usage?.prompt_tokens || estimation.inputTokens,
        outputTokens: result.usage?.completion_tokens || estimation.outputTokens,
        latencyMs,
        callType: 'task_execution',
      });

      // Update agent daily stats
      await this.tokenTracker.updateAgentStats(agentRole, {
        executed: 1,
        completed: result.blocked ? 0 : 1,
        tokensEstimated: estimation.totalTokens,
        tokensInput: result.usage?.prompt_tokens || estimation.inputTokens,
        tokensOutput: result.usage?.completion_tokens || estimation.outputTokens,
        tokensUsed: (result.usage?.prompt_tokens || estimation.inputTokens) +
                    (result.usage?.completion_tokens || estimation.outputTokens),
        llmCalls: 1,
        cost: this.tokenTracker.calculateCost(
          result.usage?.prompt_tokens || estimation.inputTokens,
          result.usage?.completion_tokens || estimation.outputTokens,
          this.config.model
        ),
      });

      // Check for blockers
      const blockerInfo = this.detectBlockers(result.content);
      if (blockerInfo) {
        this.stats.tasksBlocked++;
        return {
          blocked: true,
          blockerInfo,
          partialOutput: result.content,
        };
      }

      this.stats.tasksCompleted++;
      return {
        outputs: {
          response: result.content,
          model: this.config.model,
          tokensUsed: result.usage?.total_tokens,
          executedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.stats.tasksFailed++;
      throw error;
    }
  }

  /**
   * Build system prompt for an agent role
   * @param {string} agentRole - The agent role
   * @returns {string} System prompt
   */
  buildSystemPrompt(agentRole) {
    const basePrompt = ROLE_SYSTEM_PROMPTS[agentRole] || ROLE_SYSTEM_PROMPTS.swe;

    return `${basePrompt}

IMPORTANT INSTRUCTIONS:
1. Execute the task to the best of your ability
2. If you encounter a BLOCKER, clearly state:
   - "BLOCKED: [reason]" at the start of your response
   - What type: AUTH (needs login), PAYMENT (needs payment/approval), DECISION (needs human choice), AGENT (needs another team's work)
   - What specifically is needed to unblock
3. Provide concrete, actionable outputs
4. Be concise but thorough
5. If task is documentation, provide the actual document content
6. If task is code, provide the actual code
7. If task is analysis, provide specific findings and recommendations`;
  }

  /**
   * Build user prompt from task
   * @param {Object} task - The task object
   * @returns {string} User prompt
   */
  buildUserPrompt(task) {
    let prompt = `TASK: ${task.title}\n`;

    if (task.description) {
      prompt += `\nDESCRIPTION:\n${task.description}\n`;
    }

    if (task.metadata?.steps) {
      prompt += `\nSTEPS:\n${task.metadata.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`;
    }

    if (task.metadata?.context) {
      prompt += `\nCONTEXT:\n${task.metadata.context}\n`;
    }

    if (task.deliverables?.length) {
      prompt += `\nEXPECTED DELIVERABLES:\n${task.deliverables.map(d => `- ${d}`).join('\n')}\n`;
    }

    prompt += `\nPRIORITY: ${task.priority >= 75 ? 'HIGH' : task.priority >= 50 ? 'MEDIUM' : 'LOW'}`;

    if (task.due_date) {
      prompt += `\nDUE DATE: ${task.due_date}`;
    }

    prompt += `\n\nPlease execute this task and provide your output:`;

    return prompt;
  }

  /**
   * Call LLM API
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {Object} task - Task for context
   * @returns {Promise<Object>} LLM response
   */
  async callLLM(systemPrompt, userPrompt, task) {
    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      usage: response.usage,
    };
  }

  /**
   * Simulate execution when no API key is available
   * @param {string} agentRole - Agent role
   * @param {Object} task - Task object
   * @returns {Promise<Object>} Simulated response
   */
  async simulateExecution(agentRole, task) {
    console.log(`[AGENT-EXECUTOR] Simulating execution (no API key)`);

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate a simulated response based on task type
    let content = `[SIMULATED RESPONSE from ${agentRole.toUpperCase()}]\n\n`;
    content += `Task "${task.title}" has been analyzed.\n\n`;

    if (task.title.toLowerCase().includes('review')) {
      content += `Review completed. Key findings:\n`;
      content += `- Item 1: Reviewed and approved\n`;
      content += `- Item 2: Requires minor updates\n`;
      content += `- Recommendation: Proceed with implementation\n`;
    } else if (task.title.toLowerCase().includes('create') || task.title.toLowerCase().includes('write')) {
      content += `Document/Asset created:\n`;
      content += `- Draft version ready for review\n`;
      content += `- Follows organizational standards\n`;
      content += `- Ready for next phase\n`;
    } else if (task.title.toLowerCase().includes('implement') || task.title.toLowerCase().includes('deploy')) {
      content += `Implementation plan:\n`;
      content += `- Step 1: Prepare environment\n`;
      content += `- Step 2: Execute changes\n`;
      content += `- Step 3: Validate results\n`;
      content += `- Status: Ready to execute\n`;
    } else {
      content += `Analysis completed:\n`;
      content += `- Task scope identified\n`;
      content += `- Resources assessed\n`;
      content += `- Next steps defined\n`;
    }

    content += `\nCompleted at: ${new Date().toISOString()}`;

    return {
      content,
      usage: {
        prompt_tokens: 500,
        completion_tokens: 200,
        total_tokens: 700,
      },
    };
  }

  /**
   * Detect blockers in LLM response
   * @param {string} content - LLM response content
   * @returns {Object|null} Blocker info if detected
   */
  detectBlockers(content) {
    if (!content) return null;

    const lowerContent = content.toLowerCase();

    // Check for explicit BLOCKED marker
    if (lowerContent.includes('blocked:')) {
      // Try to determine blocker type
      for (const [type, patterns] of Object.entries(BLOCKER_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            return {
              type: type === 'auth' ? BLOCKER_TYPES.AUTH :
                    type === 'payment' ? BLOCKER_TYPES.PAYMENT :
                    type === 'decision' ? BLOCKER_TYPES.DECISION :
                    BLOCKER_TYPES.AGENT,
              reason: content.match(/blocked:\s*(.+)/i)?.[1] || 'Unknown blocker',
              detected_at: new Date().toISOString(),
            };
          }
        }
      }

      // Default to decision blocker if no specific type detected
      return {
        type: BLOCKER_TYPES.DECISION,
        reason: content.match(/blocked:\s*(.+)/i)?.[1] || 'Manual intervention required',
        detected_at: new Date().toISOString(),
      };
    }

    // Check for implicit blockers
    for (const [type, patterns] of Object.entries(BLOCKER_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          // Only flag as blocker if it seems like a definite block, not just mentioning
          if (
            lowerContent.includes('cannot proceed') ||
            lowerContent.includes('unable to') ||
            lowerContent.includes('need') ||
            lowerContent.includes('require')
          ) {
            return {
              type: type === 'auth' ? BLOCKER_TYPES.AUTH :
                    type === 'payment' ? BLOCKER_TYPES.PAYMENT :
                    type === 'decision' ? BLOCKER_TYPES.DECISION :
                    BLOCKER_TYPES.AGENT,
              reason: `Detected ${type} blocker`,
              detected_at: new Date().toISOString(),
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Get execution stats
   * @returns {Object} Stats
   */
  getStats() {
    return {
      ...this.stats,
      tokenSession: this.tokenTracker.getSessionStats(),
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      tasksExecuted: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksBlocked: 0,
    };
    this.tokenTracker.resetSession();
  }
}

// Export
export {
  AgentExecutor,
  ROLE_SYSTEM_PROMPTS,
  BLOCKER_PATTERNS,
};

export default AgentExecutor;
