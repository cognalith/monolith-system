/**
 * MONOLITH OS - Chief of Staff Agent
 * Primary coordinator between CEO and other C-suite roles
 * Responsibilities:
 * - Daily briefing synthesis
 * - Cross-department coordination
 * - CEO calendar and priority management
 * - Risk and issue escalation
 *
 * PHASE 6A UPDATES:
 * - Review scope narrowed to 6 Team Leads only (CTO, CMO, CPO, COO, CFO, CHRO)
 * - Team Lead Evaluation based on aggregate team metrics
 * - Cross-Team Pattern Detection
 * - Systemic Escalation Handling from Team Leads
 */

import RoleAgent from '../../core/RoleAgent.js';
import documentService from '../../services/DocumentService.js';

// PHASE 6A: Team Lead definitions (CoS only reviews these 6 roles)
const TEAM_LEADS = Object.freeze({
  CTO: {
    role: 'cto',
    name: 'Chief Technology Officer',
    subordinates: ['software-engineer', 'devops', 'qa', 'data'],
  },
  CMO: {
    role: 'cmo',
    name: 'Chief Marketing Officer',
    subordinates: [],
  },
  CPO: {
    role: 'cpo',
    name: 'Chief Product Officer',
    subordinates: [],
  },
  COO: {
    role: 'coo',
    name: 'Chief Operating Officer',
    subordinates: [],
  },
  CFO: {
    role: 'cfo',
    name: 'Chief Financial Officer',
    subordinates: [],
  },
  CHRO: {
    role: 'chro',
    name: 'Chief Human Resources Officer',
    subordinates: [],
  },
});

// Team Lead roles array for iteration
const TEAM_LEAD_ROLES = Object.values(TEAM_LEADS).map(tl => tl.role);

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
    // PHASE 6A: New responsibilities
    'Team Lead Evaluation - Monitor aggregate team metrics for 6 Team Leads',
    'Cross-Team Pattern Detection - Identify systemic issues spanning multiple teams',
    'Systemic Escalation Handling - Process escalations from Team Leads about subordinates',
  ],

  authorityLimits: {
    maxApprovalAmount: 5000,
    canScheduleMeetings: true,
    canRequestReports: true,
    canEscalateDirectly: true,
    canManageDocuments: true,
    canTriageInbox: true,
    canArchiveDocuments: true,
    // PHASE 6A: New authority limits
    canReviewTeamLeads: true,
    canGenerateTeamLeadAmendments: true,
    canHandleTeamLeadEscalations: true,
  },

  reportsTo: 'ceo',
  directReports: [],

  // PHASE 6A: Team Leads that CoS reviews
  reviewScope: TEAM_LEAD_ROLES,

  roleDescription: `You are the Chief of Staff, the CEO's right hand. Your primary role is to:
1. Be the information hub - gather updates from all departments
2. Synthesize complex information into clear, actionable briefings
3. Identify risks, blockers, and coordination failures before they become problems
4. Ensure the CEO's time is spent on the highest-priority decisions
5. Drive execution of CEO priorities across the organization

PHASE 6A - Team Lead Focus:
6. Review only the 6 Team Leads (CTO, CMO, CPO, COO, CFO, CHRO)
7. Evaluate Team Leads based on their team's aggregate performance metrics
8. Detect cross-team patterns and systemic issues
9. Handle escalations from Team Leads about their subordinates

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

  // ==========================================
  // PHASE 6A: TEAM LEAD REVIEW METHODS
  // ==========================================

  /**
   * Get the list of Team Lead roles that CoS reviews
   * PHASE 6A: Only 6 Team Leads, not all 15 agents
   */
  getReviewScope() {
    return TEAM_LEAD_ROLES;
  }

  /**
   * Get Team Lead configuration by role
   */
  getTeamLeadConfig(role) {
    return Object.values(TEAM_LEADS).find(tl => tl.role === role) || null;
  }

  /**
   * Run daily review for Team Leads only
   * PHASE 6A: Only pulls task history for the 6 Team Leads
   * Calculates Team Lead performance based on their team's aggregate metrics
   * Only generates amendments for Team Leads, not subordinates
   *
   * @param {Object} supabase - Supabase client for database access
   * @returns {Promise<Object>} Review results with Team Lead metrics and amendments
   */
  async runDailyReview(supabase) {
    if (!supabase) {
      return { success: false, error: 'Database client required for daily review' };
    }

    const reviewResults = {
      reviewedAt: new Date().toISOString(),
      teamLeadReviews: [],
      crossTeamPatterns: [],
      amendments: [],
      escalations: [],
    };

    // Review each Team Lead
    for (const teamLeadRole of TEAM_LEAD_ROLES) {
      const teamLeadConfig = this.getTeamLeadConfig(teamLeadRole);
      if (!teamLeadConfig) continue;

      try {
        const teamLeadReview = await this.reviewTeamLead(supabase, teamLeadConfig);
        reviewResults.teamLeadReviews.push(teamLeadReview);

        // Generate amendments if needed (only for Team Lead, not subordinates)
        if (teamLeadReview.needsAmendment) {
          const amendment = await this.generateTeamLeadAmendment(supabase, teamLeadConfig, teamLeadReview);
          if (amendment) {
            reviewResults.amendments.push(amendment);
          }
        }
      } catch (error) {
        reviewResults.teamLeadReviews.push({
          role: teamLeadRole,
          success: false,
          error: error.message,
        });
      }
    }

    // Detect cross-team patterns
    reviewResults.crossTeamPatterns = this.detectCrossTeamPatterns(reviewResults.teamLeadReviews);

    return {
      success: true,
      ...reviewResults,
    };
  }

  /**
   * Review a single Team Lead based on their team's aggregate metrics
   * PHASE 6A: Evaluates Team Lead performance via subordinate metrics
   *
   * @param {Object} supabase - Supabase client
   * @param {Object} teamLeadConfig - Team Lead configuration from TEAM_LEADS
   * @returns {Promise<Object>} Team Lead review with aggregate metrics
   */
  async reviewTeamLead(supabase, teamLeadConfig) {
    const { role, name, subordinates } = teamLeadConfig;

    // Get Team Lead's own task history
    const { data: leadTasks, error: leadError } = await supabase
      .from('monolith_task_history')
      .select('*')
      .eq('agent_role', role)
      .order('completed_at', { ascending: false })
      .limit(20);

    if (leadError) {
      throw new Error(`Failed to fetch ${role} tasks: ${leadError.message}`);
    }

    // Calculate Team Lead's own metrics
    const leadMetrics = this.calculateAgentMetrics(leadTasks || []);

    // Get aggregate metrics from subordinates (if any)
    let teamMetrics = { total: 0, successes: 0, failures: 0, avgQuality: 0 };

    if (subordinates.length > 0) {
      const { data: subTasks, error: subError } = await supabase
        .from('monolith_task_history')
        .select('*')
        .in('agent_role', subordinates)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (!subError && subTasks) {
        teamMetrics = this.calculateTeamMetrics(subTasks);
      }
    }

    // Determine if amendment is needed based on thresholds
    const needsAmendment = this.shouldGenerateTeamLeadAmendment(leadMetrics, teamMetrics);

    return {
      role,
      name,
      subordinates,
      reviewedAt: new Date().toISOString(),
      leadMetrics,
      teamMetrics,
      compositeScore: this.calculateCompositeScore(leadMetrics, teamMetrics),
      needsAmendment,
      issues: this.identifyTeamLeadIssues(leadMetrics, teamMetrics),
    };
  }

  /**
   * Calculate metrics for a single agent
   */
  calculateAgentMetrics(tasks) {
    if (!tasks || tasks.length === 0) {
      return { total: 0, successRate: 0, avgQuality: 0, avgTime: 0 };
    }

    const successes = tasks.filter(t => t.success).length;
    const qualities = tasks.filter(t => t.quality_score).map(t => parseFloat(t.quality_score));
    const times = tasks.filter(t => t.time_taken_seconds).map(t => t.time_taken_seconds);

    return {
      total: tasks.length,
      successRate: successes / tasks.length,
      avgQuality: qualities.length > 0
        ? qualities.reduce((a, b) => a + b, 0) / qualities.length
        : 0,
      avgTime: times.length > 0
        ? times.reduce((a, b) => a + b, 0) / times.length
        : 0,
    };
  }

  /**
   * Calculate aggregate metrics for a team
   */
  calculateTeamMetrics(tasks) {
    if (!tasks || tasks.length === 0) {
      return { total: 0, successes: 0, failures: 0, avgQuality: 0, successRate: 0 };
    }

    const successes = tasks.filter(t => t.success).length;
    const failures = tasks.filter(t => !t.success).length;
    const qualities = tasks.filter(t => t.quality_score).map(t => parseFloat(t.quality_score));

    return {
      total: tasks.length,
      successes,
      failures,
      successRate: successes / tasks.length,
      avgQuality: qualities.length > 0
        ? qualities.reduce((a, b) => a + b, 0) / qualities.length
        : 0,
    };
  }

  /**
   * Calculate composite score for Team Lead (own + team performance)
   */
  calculateCompositeScore(leadMetrics, teamMetrics) {
    // Weight: 40% own performance, 60% team performance (if team exists)
    const ownScore = (leadMetrics.successRate * 0.6) + (leadMetrics.avgQuality * 0.4);

    if (teamMetrics.total === 0) {
      return ownScore;
    }

    const teamScore = (teamMetrics.successRate * 0.6) + (teamMetrics.avgQuality * 0.4);
    return (ownScore * 0.4) + (teamScore * 0.6);
  }

  /**
   * Determine if Team Lead needs an amendment
   */
  shouldGenerateTeamLeadAmendment(leadMetrics, teamMetrics) {
    // Thresholds for amendment generation
    const THRESHOLDS = {
      MIN_TASKS: 5,
      LOW_SUCCESS_RATE: 0.6,
      LOW_QUALITY: 0.5,
      LOW_COMPOSITE: 0.55,
    };

    if (leadMetrics.total < THRESHOLDS.MIN_TASKS) {
      return false; // Not enough data
    }

    // Check individual metrics
    if (leadMetrics.successRate < THRESHOLDS.LOW_SUCCESS_RATE) return true;
    if (leadMetrics.avgQuality < THRESHOLDS.LOW_QUALITY) return true;

    // Check composite score
    const composite = this.calculateCompositeScore(leadMetrics, teamMetrics);
    if (composite < THRESHOLDS.LOW_COMPOSITE) return true;

    return false;
  }

  /**
   * Identify specific issues for Team Lead review
   */
  identifyTeamLeadIssues(leadMetrics, teamMetrics) {
    const issues = [];

    if (leadMetrics.successRate < 0.6) {
      issues.push({
        type: 'low_success_rate',
        severity: 'high',
        message: `Own success rate ${(leadMetrics.successRate * 100).toFixed(1)}% is below 60%`,
      });
    }

    if (leadMetrics.avgQuality < 0.5) {
      issues.push({
        type: 'low_quality',
        severity: 'medium',
        message: `Own quality score ${leadMetrics.avgQuality.toFixed(2)} is below 0.5`,
      });
    }

    if (teamMetrics.total > 0 && teamMetrics.successRate < 0.6) {
      issues.push({
        type: 'team_underperformance',
        severity: 'high',
        message: `Team success rate ${(teamMetrics.successRate * 100).toFixed(1)}% is below 60%`,
      });
    }

    return issues;
  }

  /**
   * Generate amendment for a Team Lead
   * PHASE 6A: Only generates amendments for Team Leads, not subordinates
   */
  async generateTeamLeadAmendment(supabase, teamLeadConfig, review) {
    const { role, name } = teamLeadConfig;
    const { leadMetrics, teamMetrics, issues } = review;

    // Build instruction delta based on issues
    const instructionParts = [];

    for (const issue of issues) {
      switch (issue.type) {
        case 'low_success_rate':
          instructionParts.push(`Focus on improving task completion reliability. Current success rate: ${(leadMetrics.successRate * 100).toFixed(1)}%.`);
          break;
        case 'low_quality':
          instructionParts.push(`Prioritize quality in deliverables. Current quality score: ${leadMetrics.avgQuality.toFixed(2)}.`);
          break;
        case 'team_underperformance':
          instructionParts.push(`Address team performance issues. Team success rate: ${(teamMetrics.successRate * 100).toFixed(1)}%. Consider reviewing subordinate workload and guidance.`);
          break;
      }
    }

    if (instructionParts.length === 0) {
      return null;
    }

    const amendment = {
      agent_role: role,
      amendment_type: 'team_lead_review',
      trigger_pattern: `team_lead:${role}:daily_review`,
      instruction_delta: instructionParts.join(' '),
      knowledge_mutation: {
        team_lead_guidance: {
          identified_issues: issues,
          lead_metrics: leadMetrics,
          team_metrics: teamMetrics,
          review_date: review.reviewedAt,
        },
      },
      source_pattern: {
        type: 'cos_daily_review',
        team_lead: role,
        composite_score: review.compositeScore,
      },
      pattern_confidence: Math.min(0.9, 0.5 + (issues.length * 0.15)),
    };

    // Insert amendment into database
    const { data, error } = await supabase
      .from('monolith_amendments')
      .insert([{
        ...amendment,
        approval_status: 'auto_approved',
        auto_approved: true,
        is_active: true,
        evaluation_status: 'evaluating',
      }])
      .select()
      .single();

    if (error) {
      console.error(`[COS] Failed to create amendment for ${role}: ${error.message}`);
      return null;
    }

    console.log(`[COS] Created Team Lead amendment for ${role}: ${amendment.trigger_pattern}`);
    return data;
  }

  /**
   * Detect patterns that span multiple teams
   * PHASE 6A: Cross-Team Pattern Detection
   */
  detectCrossTeamPatterns(teamLeadReviews) {
    const patterns = [];

    // Check for systemic low success rate
    const lowSuccessTeams = teamLeadReviews.filter(
      r => r.leadMetrics && r.leadMetrics.successRate < 0.6
    );

    if (lowSuccessTeams.length >= 3) {
      patterns.push({
        type: 'systemic_low_success',
        severity: 'critical',
        affectedTeams: lowSuccessTeams.map(r => r.role),
        message: `${lowSuccessTeams.length} Team Leads have success rate below 60%. This may indicate systemic issues.`,
        recommendedAction: 'Escalate to CEO for organization-wide review',
      });
    }

    // Check for systemic quality issues
    const lowQualityTeams = teamLeadReviews.filter(
      r => r.leadMetrics && r.leadMetrics.avgQuality < 0.5
    );

    if (lowQualityTeams.length >= 2) {
      patterns.push({
        type: 'systemic_low_quality',
        severity: 'high',
        affectedTeams: lowQualityTeams.map(r => r.role),
        message: `${lowQualityTeams.length} Team Leads have quality scores below 0.5. Quality standards may need reinforcement.`,
        recommendedAction: 'Review quality standards and training across teams',
      });
    }

    // Check for team underperformance affecting multiple leads
    const teamIssues = teamLeadReviews.filter(
      r => r.issues && r.issues.some(i => i.type === 'team_underperformance')
    );

    if (teamIssues.length >= 2) {
      patterns.push({
        type: 'widespread_team_issues',
        severity: 'high',
        affectedTeams: teamIssues.map(r => r.role),
        message: `${teamIssues.length} teams are underperforming. May indicate workload or resource issues.`,
        recommendedAction: 'Review resource allocation and task distribution',
      });
    }

    return patterns;
  }

  /**
   * Handle escalation from a Team Lead about a subordinate
   * PHASE 6A: Systemic Escalation Handling
   *
   * @param {string} teamLeadRole - The Team Lead escalating the issue
   * @param {string} subordinateRole - The subordinate with the issue
   * @param {string} reason - Reason for escalation
   * @param {Object} details - Additional details about the escalation
   * @returns {Promise<Object>} Escalation handling result
   */
  async handleTeamLeadEscalation(teamLeadRole, subordinateRole, reason, details = {}) {
    // Validate Team Lead role
    if (!TEAM_LEAD_ROLES.includes(teamLeadRole)) {
      return {
        success: false,
        error: `${teamLeadRole} is not a recognized Team Lead role`,
      };
    }

    // Get Team Lead config to verify subordinate relationship
    const teamLeadConfig = this.getTeamLeadConfig(teamLeadRole);
    if (!teamLeadConfig.subordinates.includes(subordinateRole)) {
      return {
        success: false,
        error: `${subordinateRole} is not a subordinate of ${teamLeadRole}`,
      };
    }

    const escalation = {
      id: `esc-${Date.now()}`,
      type: 'team_lead_subordinate_escalation',
      teamLead: teamLeadRole,
      subordinate: subordinateRole,
      reason,
      details,
      status: 'received',
      receivedAt: new Date().toISOString(),
    };

    // Analyze escalation to determine action
    const analysis = await this.analyzeTeamLeadEscalation(escalation);

    // Track in risk register
    this.registerRisk({
      id: escalation.id,
      type: 'team_lead_escalation',
      severity: analysis.severity,
      source: teamLeadRole,
      subject: subordinateRole,
      description: reason,
      analysis: analysis,
    });

    console.log(`[COS] Received escalation from ${teamLeadRole} about ${subordinateRole}: ${reason}`);

    return {
      success: true,
      escalation,
      analysis,
      recommendedActions: analysis.recommendedActions,
    };
  }

  /**
   * Analyze escalation to determine severity and recommended actions
   */
  async analyzeTeamLeadEscalation(escalation) {
    const { reason, details } = escalation;

    // Determine severity based on reason keywords
    let severity = 'medium';
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('critical') || lowerReason.includes('blocking') || lowerReason.includes('urgent')) {
      severity = 'critical';
    } else if (lowerReason.includes('repeated') || lowerReason.includes('persistent') || lowerReason.includes('multiple')) {
      severity = 'high';
    }

    // Build recommended actions
    const recommendedActions = [];

    if (severity === 'critical') {
      recommendedActions.push('Immediate attention required - consider escalating to CEO');
      recommendedActions.push('Temporarily reassign critical tasks from subordinate');
    }

    recommendedActions.push(`Review ${escalation.subordinate}'s recent task history`);
    recommendedActions.push('Schedule coordination meeting between Team Lead and subordinate');

    if (details.consecutiveFailures && details.consecutiveFailures >= 3) {
      recommendedActions.push('Consider generating performance amendment for subordinate');
    }

    return {
      severity,
      recommendedActions,
      requiresCEOAttention: severity === 'critical',
      analyzedAt: new Date().toISOString(),
    };
  }
}

export default ChiefOfStaffAgent;
export { COS_CONFIG, TEAM_LEADS, TEAM_LEAD_ROLES };
