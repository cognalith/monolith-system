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
  ],

  authorityLimits: {
    maxApprovalAmount: 5000,
    canScheduleMeetings: true,
    canRequestReports: true,
    canEscalateDirectly: true,
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
    ];

    if (cosKeywords.some((kw) => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default ChiefOfStaffAgent;
export { COS_CONFIG };
