/**
 * MONOLITH OS - Chief of Staff Agent
 * Primary coordinator between CEO and other C-suite roles
 * Responsibilities:
 * - Daily briefing synthesis
 * - Cross-department coordination
 * - CEO calendar and priority management
 * - Risk and issue escalation
 */

import RoleAgent from '../../core/RoleAgent.js';
import documentService from '../../services/DocumentService.js';

const COS_CONFIG = {
  roleId: 'cos',
  roleName: 'Chief of Staff',
  roleAbbr: 'CoS',
  tier: 2,

  responsibilities: [
    'Synthesize daily briefings from all department heads into 2-page executive summary',
    'Track critical initiatives and flag delays or risks',
    'Coordinate cross-functional meetings and decisions',
    'Manage CEO agenda and priorities',
    'Report critical risks and coordination failures to CEO',
    'Track key milestones (TeeMates MVP, GitHub Migration, etc.)',
    'Manage company document repository and filing system',
    'Triage incoming documents to appropriate department folders',
    'Maintain document index and ensure proper categorization',
  ],

  authorityLimits: {
    maxApprovalAmount: 5000,
    canScheduleMeetings: true,
    canRequestReports: true,
    canEscalateDirectly: true,
    canManageDocuments: true,
    canTriageInbox: true,
    canArchiveDocuments: true,
  },

  reportsTo: 'ceo',
  directReports: [],

  roleDescription: `You are the Chief of Staff, the CEO's right hand. Your primary role is to:
1. Be the information hub - gather updates from all departments
2. Synthesize complex information into clear, actionable briefings
3. Identify risks, blockers, and coordination failures before they become problems
4. Ensure the CEO's time is spent on the highest-priority decisions
5. Drive execution of CEO priorities across the organization

You have broad visibility across the organization but limited direct authority.
Your power comes from your access to the CEO and your role as coordinator.`,
};

class ChiefOfStaffAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...COS_CONFIG, ...config });

    // CoS-specific state
    this.departmentUpdates = new Map();
    this.trackedInitiatives = [];
    this.riskRegister = [];
  }

  /**
   * Generate daily briefing for CEO
   */
  async generateDailyBriefing(departmentReports) {
    const briefingPrompt = `Generate an executive daily briefing for the CEO.

## Department Reports Received:
${JSON.stringify(departmentReports, null, 2)}

## Instructions:
Create a 2-page executive briefing with:

1. **EXECUTIVE SUMMARY** (3-5 bullet points)
   - Top priorities for today
   - Critical decisions needed
   - Key wins from yesterday

2. **ATTENTION REQUIRED**
   - Items needing CEO decision (with recommendations)
   - Risks that need acknowledgment
   - Blocked items requiring intervention

3. **DEPARTMENT STATUS**
   - One-line status from each department
   - Use traffic light: 🟢 On Track | 🟡 At Risk | 🔴 Blocked

4. **KEY METRICS**
   - Critical numbers the CEO should know

5. **CALENDAR PRIORITIES**
   - Recommended focus areas for today

Be concise, direct, and actionable. No fluff.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: briefingPrompt,
      temperature: 0.5,
    });

    return {
      content: response.content,
      generatedAt: new Date().toISOString(),
      sourceDepartments: Object.keys(departmentReports),
      model: response.model,
    };
  }

  /**
   * Track an initiative and its status
   */
  trackInitiative(initiative) {
    const existing = this.trackedInitiatives.find((i) => i.id === initiative.id);
    if (existing) {
      Object.assign(existing, initiative, { updatedAt: new Date().toISOString() });
    } else {
      this.trackedInitiatives.push({
        ...initiative,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Check initiative status and flag risks
   */
  async reviewInitiatives() {
    const riskyInitiatives = [];

    for (const initiative of this.trackedInitiatives) {
      // Check if behind schedule
      if (initiative.targetDate) {
        const target = new Date(initiative.targetDate);
        const now = new Date();
        const daysUntil = (target - now) / (1000 * 60 * 60 * 24);

        if (daysUntil < 0) {
          initiative.status = 'OVERDUE';
          riskyInitiatives.push({
            ...initiative,
            risk: `Overdue by ${Math.abs(Math.floor(daysUntil))} days`,
          });
        } else if (daysUntil < 7 && initiative.progress < 80) {
          initiative.status = 'AT_RISK';
          riskyInitiatives.push({
            ...initiative,
            risk: `Only ${initiative.progress}% complete with ${Math.floor(daysUntil)} days remaining`,
          });
        }
      }
    }

    return riskyInitiatives;
  }

  /**
   * Register a risk in the risk register
   */
  registerRisk(risk) {
    this.riskRegister.push({
      id: `risk-${Date.now()}`,
      ...risk,
      registeredAt: new Date().toISOString(),
      status: 'open',
    });
  }

  /**
   * Get critical risks for CEO attention
   */
  getCriticalRisks() {
    return this.riskRegister.filter(
      (r) => r.status === 'open' && (r.severity === 'critical' || r.severity === 'high')
    );
  }

  /**
   * Coordinate between departments
   */
  async coordinateDepartments(issue) {
    const coordinationPrompt = `You need to coordinate between departments to resolve an issue.

## Issue Details:
${JSON.stringify(issue, null, 2)}

## Your Task:
1. Analyze which departments need to be involved
2. Determine the coordination sequence
3. Draft a coordination message/meeting agenda
4. Identify decision points and owners
5. Set follow-up checkpoints

Provide a clear coordination plan.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: coordinationPrompt,
      temperature: 0.6,
    });

    return {
      plan: response.content,
      involvedDepartments: this.extractDepartments(response.content),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Extract department mentions from text
   */
  extractDepartments(text) {
    const departments = [
      'cfo', 'cto', 'coo', 'clo', 'ciso', 'cmo', 'chro',
      'finance', 'technology', 'operations', 'legal', 'security', 'marketing', 'hr',
    ];

    const mentioned = [];
    const lowerText = text.toLowerCase();

    for (const dept of departments) {
      if (lowerText.includes(dept)) {
        mentioned.push(dept);
      }
    }

    return [...new Set(mentioned)];
  }

  /**
   * Process CEO request
   */
  async processCEORequest(request) {
    const requestPrompt = `The CEO has made a request that you need to handle.

## CEO Request:
${request.content}

## Context:
- Priority: ${request.priority || 'NORMAL'}
- Deadline: ${request.deadline || 'Not specified'}

## Your Task:
1. Understand what the CEO needs
2. Determine who needs to be involved
3. Create an action plan
4. Identify any information you need to gather
5. Draft any necessary communications

Provide your response.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: requestPrompt,
      temperature: 0.6,
    });

    return {
      response: response.content,
      request,
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for CoS-specific tasks
   */
  canHandle(task) {
    // CoS handles coordination tasks for any role
    const content = task.content.toLowerCase();
    const cosKeywords = [
      'briefing',
      'coordinate',
      'ceo',
      'cross-department',
      'status update',
      'risk',
      'escalate',
      'document',
      'file',
      'triage',
      'archive',
    ];

    if (cosKeywords.some((kw) => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }

  // ==========================================
  // DOCUMENT MANAGEMENT METHODS
  // ==========================================

  /**
   * Initialize document service
   */
  async initializeDocumentService() {
    const result = await documentService.initialize();
    if (result.success) {
      this.documentServiceReady = true;
    }
    return result;
  }

  /**
   * Get inbox items pending triage
   */
  async getDocumentInbox() {
    return documentService.getInbox();
  }

  /**
   * Triage a document from inbox to appropriate folder
   */
  async triageDocument(fileName, category, newName = null) {
    return documentService.triageInboxItem(fileName, category, newName);
  }

  /**
   * AI-assisted triage - analyze document and suggest category
   */
  async analyzeAndTriageDocument(fileName, fileContent = null) {
    const triagePrompt = `Analyze this document and determine the appropriate category.

## Document Name: ${fileName}
${fileContent ? `## Document Content Preview:\n${fileContent.substring(0, 2000)}` : ''}

## Available Categories:
- executive (01_EXECUTIVE) - CEO directives, board docs, strategic plans
- finance (02_FINANCE) - Budgets, reports, invoices, forecasts
- technology (03_TECHNOLOGY) - Architecture docs, tech specs, runbooks
- legal (04_LEGAL) - Contracts, compliance, policies
- operations (05_OPERATIONS) - SOPs, workflows, vendor agreements
- product (06_PRODUCT) - PRDs, roadmaps, research, user feedback
- people (07_PEOPLE) - HR policies, org charts, hiring docs
- marketing (08_MARKETING) - Brand assets, campaigns, analytics
- security (09_SECURITY) - Security policies, audits, incidents
- projects (10_PROJECTS) - Active project workspaces
- archive (99_ARCHIVE) - Completed/obsolete documents

## Instructions:
1. Analyze the document name and content
2. Determine the most appropriate category
3. Suggest a standardized file name following the format: YYYY-MM-DD_CategoryCode_Description.ext
4. Provide confidence level (high/medium/low)

Respond with JSON:
{
  "category": "category_key",
  "suggestedName": "standardized_file_name",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}`;

    const response = await this.llm.complete({
      modelId: 'claude-haiku-3',
      systemPrompt: this.systemPrompt,
      userMessage: triagePrompt,
      temperature: 0.3,
    });

    try {
      const analysis = JSON.parse(response.content);
      return {
        success: true,
        ...analysis,
        originalFileName: fileName,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to parse AI response',
        rawResponse: response.content,
      };
    }
  }

  /**
   * Archive a document
   */
  async archiveDocument(filePath) {
    return documentService.archiveDocument(filePath);
  }

  /**
   * List documents in a category
   */
  async listDocuments(category = null) {
    return documentService.listDocuments(category);
  }

  /**
   * Search for documents
   */
  async searchDocuments(pattern, options = {}) {
    return documentService.searchDocuments(pattern, options);
  }

  /**
   * Create a new document
   */
  async createDocument(category, fileName, content = '') {
    return documentService.createDocument(category, fileName, content);
  }

  /**
   * Get document repository statistics
   */
  async getDocumentStats() {
    return documentService.getFolderStats();
  }

  /**
   * Generate document repository report
   */
  async generateDocumentReport() {
    return documentService.generateReport();
  }

  /**
   * Process inbox - triage all pending documents
   */
  async processInbox() {
    const inbox = await documentService.getInbox();
    const results = [];

    for (const item of inbox) {
      const analysis = await this.analyzeAndTriageDocument(item.name);

      if (analysis.success && analysis.confidence !== 'low') {
        const triageResult = await this.triageDocument(
          item.name,
          analysis.category,
          analysis.suggestedName
        );

        results.push({
          original: item.name,
          analysis,
          triageResult,
        });
      } else {
        results.push({
          original: item.name,
          analysis,
          triageResult: { success: false, reason: 'Low confidence - manual review required' },
        });
      }
    }

    return {
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // EMAIL & BROWSER INTEGRATION METHODS
  // ==========================================

  /**
   * Send daily briefing email to specified recipients
   * @param {string[]} recipients - List of email addresses to send briefing to
   * @returns {Promise<Object>} Send result with briefing content
   */
  async sendDailyBriefing(recipients) {
    // First, gather department reports and generate briefing
    const departmentReports = {};
    for (const [dept, update] of this.departmentUpdates) {
      departmentReports[dept] = update;
    }

    const briefing = await this.generateDailyBriefing(departmentReports);

    const subject = `[DAILY BRIEFING] ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}`;

    const body = `
<html>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
  <h1 style="color: #1a365d; border-bottom: 2px solid #2c5282; padding-bottom: 10px;">
    Daily Executive Briefing
  </h1>
  <p style="color: #718096; font-size: 12px;">
    Generated by Chief of Staff at ${briefing.generatedAt}
  </p>
  <div style="white-space: pre-wrap; line-height: 1.6;">
${briefing.content}
  </div>
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #e2e8f0;">
  <p style="color: #a0aec0; font-size: 11px;">
    This briefing was automatically generated by MONOLITH OS CoS Agent.
    Source departments: ${briefing.sourceDepartments.join(', ') || 'None'}
  </p>
</body>
</html>`;

    const results = [];
    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, subject, body, { isHtml: true });
      results.push({ recipient, ...result });
    }

    return {
      success: results.every(r => r.success),
      briefing,
      emailResults: results,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Send coordination emails to multiple stakeholders
   * @param {string[]} emailList - List of stakeholder email addresses
   * @param {string} message - Coordination message content
   * @returns {Promise<Object>} Bulk send result
   */
  async coordinateWithStakeholders(emailList, message) {
    const subject = `[ACTION REQUIRED] Cross-Department Coordination - ${new Date().toLocaleDateString()}`;

    const body = `
<html>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
  <h2 style="color: #c53030; margin-bottom: 5px;">Action Required</h2>
  <p style="color: #718096; font-size: 12px; margin-top: 0;">
    From: Chief of Staff | ${new Date().toISOString()}
  </p>

  <div style="background-color: #f7fafc; border-left: 4px solid #4299e1; padding: 15px; margin: 20px 0;">
    <div style="white-space: pre-wrap;">
${message}
    </div>
  </div>

  <p style="font-weight: bold; color: #2d3748;">
    Please review and respond with your input by end of day.
  </p>

  <hr style="margin-top: 30px; border: none; border-top: 1px solid #e2e8f0;">
  <p style="color: #a0aec0; font-size: 11px;">
    This coordination request was sent by MONOLITH OS CoS Agent.
  </p>
</body>
</html>`;

    const results = [];
    for (const email of emailList) {
      const result = await this.sendEmail(email, subject, body, { isHtml: true });
      results.push({ email, ...result });
    }

    return {
      success: results.every(r => r.success),
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Check for urgent unread emails requiring immediate attention
   * @returns {Promise<Object>} Search result with urgent emails
   */
  async checkUrgentEmails() {
    // Search for urgent/important unread emails
    const searchResult = await this.searchEmails('is:unread is:important', 20);

    if (!searchResult.success) {
      return searchResult;
    }

    // Also search for emails with urgent keywords
    const urgentKeywords = await this.searchEmails('is:unread (subject:urgent OR subject:ASAP OR subject:critical OR subject:emergency)', 10);

    const allUrgent = [
      ...(searchResult.emails || []),
      ...(urgentKeywords.emails || []),
    ];

    // Deduplicate by email ID
    const uniqueEmails = allUrgent.filter((email, index, self) =>
      index === self.findIndex(e => e.id === email.id)
    );

    // Sort by date (most recent first)
    uniqueEmails.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      success: true,
      urgentCount: uniqueEmails.length,
      emails: uniqueEmails,
      checkedAt: new Date().toISOString(),
      requiresAttention: uniqueEmails.length > 0,
    };
  }
}

export default ChiefOfStaffAgent;
export { COS_CONFIG };
