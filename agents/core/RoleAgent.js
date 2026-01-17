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

    // Optional service integrations
    this.gmailService = config.gmailService || null;
    this.browserService = config.browserService || null;
    this.mediaGenerationService = config.mediaGenerationService || null;

    // State
    this.isActive = false;
    this.currentTask = null;
    this.taskHistory = [];

    console.log(`[AGENT] ${this.roleAbbr} agent initialized`);
  }

  /**
   * Get available capabilities based on injected services
   */
  get capabilities() {
    const caps = [];
    if (this.gmailService) {
      caps.push('email:send', 'email:search', 'email:read');
    }
    if (this.browserService) {
      caps.push('browser:navigate', 'browser:screenshot', 'browser:content', 'browser:form');
    }
    if (this.mediaGenerationService) {
      caps.push('media:infographic', 'media:slides', 'media:video', 'media:podcast', 'media:social');
    }
    return caps;
  }

  /**
   * Check if a specific capability is available
   */
  hasCapability(capability) {
    return this.capabilities.includes(capability);
  }

  buildSystemPrompt(config) {
    // Build capabilities section if any services are available
    const capabilitiesSection = this.capabilities.length > 0
      ? `\n## Available Capabilities\nYou have access to the following service capabilities:\n${this.capabilities.map(c => `- ${c}`).join('\n')}\n\nYou can use these capabilities to:\n${this.gmailService ? '- Send, search, and read emails\n' : ''}${this.browserService ? '- Browse websites, take screenshots, extract web content, and fill web forms\n' : ''}${this.mediaGenerationService ? '- Generate infographics, presentations, videos, podcasts, and social media graphics\n' : ''}`
      : '';

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
${capabilitiesSection}
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
      capabilities: this.capabilities,
    };
  }

  // ============================================================
  // Email Service Methods (require GmailService injection)
  // ============================================================

  /**
   * Send an email via the Gmail service
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} body - Email body content
   * @param {Object} options - Optional settings (cc, bcc, attachments, etc.)
   * @returns {Promise<Object>} Send result with message ID
   */
  async sendEmail(to, subject, body, options = {}) {
    if (!this.gmailService) {
      throw new Error(`[${this.roleAbbr}] Email capability not available - GmailService not configured`);
    }
    console.log(`[${this.roleAbbr}] Sending email to: ${to}`);
    return this.gmailService.sendEmail({ to, subject, body, ...options });
  }

  /**
   * Search emails via the Gmail service
   * @param {string} query - Gmail search query
   * @param {number} maxResults - Maximum number of results to return
   * @returns {Promise<Array>} Array of matching email messages
   */
  async searchEmails(query, maxResults = 10) {
    if (!this.gmailService) {
      throw new Error(`[${this.roleAbbr}] Email capability not available - GmailService not configured`);
    }
    console.log(`[${this.roleAbbr}] Searching emails: ${query}`);
    return this.gmailService.searchEmails(query, maxResults);
  }

  /**
   * Read a specific email by message ID
   * @param {string} messageId - The Gmail message ID
   * @returns {Promise<Object>} Email content and metadata
   */
  async readEmail(messageId) {
    if (!this.gmailService) {
      throw new Error(`[${this.roleAbbr}] Email capability not available - GmailService not configured`);
    }
    console.log(`[${this.roleAbbr}] Reading email: ${messageId}`);
    return this.gmailService.getEmail(messageId);
  }

  // ============================================================
  // Browser Service Methods (require BrowserService injection)
  // ============================================================

  /**
   * Navigate to a URL and return the page
   * @param {string} url - The URL to navigate to
   * @returns {Promise<Object>} Browser page object or navigation result
   */
  async browseUrl(url) {
    if (!this.browserService) {
      throw new Error(`[${this.roleAbbr}] Browser capability not available - BrowserService not configured`);
    }
    console.log(`[${this.roleAbbr}] Browsing URL: ${url}`);
    return this.browserService.navigate(url);
  }

  /**
   * Take a screenshot of the current page or specified URL
   * @param {string} path - File path to save the screenshot
   * @returns {Promise<string>} Path to the saved screenshot
   */
  async takeScreenshot(path) {
    if (!this.browserService) {
      throw new Error(`[${this.roleAbbr}] Browser capability not available - BrowserService not configured`);
    }
    console.log(`[${this.roleAbbr}] Taking screenshot: ${path}`);
    return this.browserService.screenshot(path);
  }

  /**
   * Navigate to a URL and extract its content in one call
   * @param {string} url - The URL to fetch content from
   * @returns {Promise<Object>} Page content including text, title, and metadata
   */
  async getWebContent(url) {
    if (!this.browserService) {
      throw new Error(`[${this.roleAbbr}] Browser capability not available - BrowserService not configured`);
    }
    console.log(`[${this.roleAbbr}] Getting web content: ${url}`);
    await this.browserService.navigate(url);
    return this.browserService.getContent();
  }

  /**
   * Navigate to a URL and fill a form with provided field values
   * @param {string} url - The URL containing the form
   * @param {Object} fields - Key-value pairs of form field selectors and values
   * @returns {Promise<Object>} Form submission result
   */
  async fillWebForm(url, fields) {
    if (!this.browserService) {
      throw new Error(`[${this.roleAbbr}] Browser capability not available - BrowserService not configured`);
    }
    console.log(`[${this.roleAbbr}] Filling web form at: ${url}`);
    await this.browserService.navigate(url);
    return this.browserService.fillForm(fields);
  }

  // ============================================================
  // Media Generation Service Methods (require MediaGenerationService injection)
  // ============================================================

  /**
   * Create any supported media type
   * @param {string} type - Media type: 'infographic', 'slides', 'video', 'podcast', 'social'
   * @param {string} content - Content/description for the media
   * @param {Object} options - Options including brandKitId, title, sources
   * @returns {Promise<Object>} Media generation result
   */
  async createMedia(type, content, options = {}) {
    if (!this.mediaGenerationService) {
      throw new Error(`[${this.roleAbbr}] Media generation not available - MediaGenerationService not configured`);
    }
    console.log(`[${this.roleAbbr}] Creating ${type}: ${content.substring(0, 50)}...`);
    return this.mediaGenerationService.createMedia(type, content, options);
  }

  /**
   * Create an infographic
   * @param {string} content - Content/topic for the infographic
   * @param {Object} options - Options including brandKitId
   * @returns {Promise<Object>} Canva design request
   */
  async createInfographic(content, options = {}) {
    if (!this.mediaGenerationService) {
      throw new Error(`[${this.roleAbbr}] Media generation not available - MediaGenerationService not configured`);
    }
    console.log(`[${this.roleAbbr}] Creating infographic: ${content.substring(0, 50)}...`);
    return this.mediaGenerationService.createInfographic(content, options);
  }

  /**
   * Create a presentation/slide deck
   * @param {string} content - Content/topic for the presentation
   * @param {Object} options - Options including brandKitId, slideStructure
   * @returns {Promise<Object>} Canva design request
   */
  async createSlides(content, options = {}) {
    if (!this.mediaGenerationService) {
      throw new Error(`[${this.roleAbbr}] Media generation not available - MediaGenerationService not configured`);
    }
    console.log(`[${this.roleAbbr}] Creating slides: ${content.substring(0, 50)}...`);
    return this.mediaGenerationService.createSlides(content, options);
  }

  /**
   * Create a video
   * @param {string} content - Content/topic for the video
   * @param {Object} options - Options including brandKitId
   * @returns {Promise<Object>} Canva design request
   */
  async createVideo(content, options = {}) {
    if (!this.mediaGenerationService) {
      throw new Error(`[${this.roleAbbr}] Media generation not available - MediaGenerationService not configured`);
    }
    console.log(`[${this.roleAbbr}] Creating video: ${content.substring(0, 50)}...`);
    return this.mediaGenerationService.createVideo(content, options);
  }

  /**
   * Create a podcast via NotebookLM
   * @param {string} content - Main content for the podcast
   * @param {Object} options - Options including title, sources (URLs/text)
   * @returns {Promise<Object>} Podcast generation result with share link
   */
  async createPodcast(content, options = {}) {
    if (!this.mediaGenerationService) {
      throw new Error(`[${this.roleAbbr}] Media generation not available - MediaGenerationService not configured`);
    }
    console.log(`[${this.roleAbbr}] Creating podcast: ${options.title || content.substring(0, 50)}...`);
    return this.mediaGenerationService.createPodcast(content, options);
  }

  /**
   * Create a social media graphic
   * @param {string} content - Content/message for the graphic
   * @param {Object} options - Options including brandKitId, platform
   * @returns {Promise<Object>} Canva design request
   */
  async createSocialGraphic(content, options = {}) {
    if (!this.mediaGenerationService) {
      throw new Error(`[${this.roleAbbr}] Media generation not available - MediaGenerationService not configured`);
    }
    console.log(`[${this.roleAbbr}] Creating social graphic: ${content.substring(0, 50)}...`);
    return this.mediaGenerationService.createSocialGraphic(content, options);
  }

  /**
   * Create a full media kit for a product
   * @param {Object} product - Product info with name, brief, features, benefits
   * @param {Object} options - Options including brandKitId, types
   * @returns {Promise<Object>} Batch media generation results
   */
  async createProductMediaKit(product, options = {}) {
    if (!this.mediaGenerationService) {
      throw new Error(`[${this.roleAbbr}] Media generation not available - MediaGenerationService not configured`);
    }
    console.log(`[${this.roleAbbr}] Creating media kit for: ${product.name}`);
    return this.mediaGenerationService.batchCreateProductKit(product, options);
  }
}

export default RoleAgent;
