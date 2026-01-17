/**
 * MONOLITH OS - Chief Executive Officer Agent
 * Strategic leadership, final decision authority, and human-in-the-loop oversight
 *
 * CRITICAL: This agent QUEUES decisions for human review.
 * It does NOT auto-approve. All escalations are analyzed and prepared
 * with recommendations for the human operator to review and approve.
 *
 * Responsibilities:
 * - Review escalated decisions from all C-suite agents
 * - Set strategic direction and company policy
 * - Resolve inter-department conflicts
 * - Final authority on financial, legal, and strategic matters
 * - Prepare recommendations for human review
 */

import RoleAgent from '../../core/RoleAgent.js';

const CEO_CONFIG = {
  roleId: 'ceo',
  roleName: 'Chief Executive Officer',
  roleAbbr: 'CEO',
  tier: 0, // Highest tier - ultimate authority

  responsibilities: [
    'Review and prepare recommendations for escalated decisions',
    'Set strategic direction and company vision',
    'Resolve conflicts between departments',
    'Oversee all C-suite executives',
    'Final review authority on major financial decisions',
    'Approve strategic partnerships and investments',
    'Guide organizational culture and values',
    'Prepare analysis and recommendations for human operator',
  ],

  authorityLimits: {
    maxApprovalAmount: Infinity, // Unlimited financial authority
    canApproveAll: true,
    canSetPolicy: true,
    canHire: true,
    canTerminate: true,
    canApproveContracts: true,
    canSetStrategy: true,
    // IMPORTANT: Even with unlimited authority, CEO queues for human review
    requiresHumanReview: true,
  },

  reportsTo: 'human', // CEO reports to human operator
  directReports: ['cfo', 'cto', 'coo', 'cmo', 'clo', 'chro', 'ciso', 'cpo', 'cro', 'cco'],

  roleDescription: `You are the Chief Executive Officer, the highest authority in the AI executive system.

CRITICAL OPERATING PRINCIPLE:
You DO NOT auto-approve or auto-execute decisions. Your role is to:
1. Analyze escalated matters thoroughly
2. Prepare clear recommendations with rationale
3. Queue decisions for human operator review
4. Provide context and risk assessment

Your core competencies:
1. Strategic Vision - See the big picture and long-term implications
2. Decision Analysis - Evaluate complex multi-factor decisions
3. Conflict Resolution - Mediate between competing priorities
4. Risk Assessment - Identify and articulate risks clearly
5. Recommendation Synthesis - Provide actionable, well-reasoned recommendations

Output Guidelines:
- Always structure output for human review
- Include clear RECOMMENDATION with rationale
- Provide RISK ASSESSMENT
- Suggest ALTERNATIVES when applicable
- Flag URGENCY level
- Note any DEPENDENCIES or BLOCKERS`,
};

class CEOAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CEO_CONFIG, ...config });

    // CEO-specific state
    this.escalationQueue = []; // Pending escalations for human review
    this.strategicDirectives = new Map(); // Active strategic directives
    this.resolvedConflicts = []; // History of resolved conflicts
    this.decisionHistory = []; // All decisions processed
  }

  /**
   * Process an escalation from another agent
   * Analyzes the escalation and prepares a recommendation for human review
   * Does NOT auto-approve - queues for human decision
   */
  async processEscalation(escalation) {
    const {
      role,
      task,
      reason,
      recommendation: agentRecommendation,
      priority = 'MEDIUM',
      context = {},
    } = escalation;

    console.log(`[CEO] Processing escalation from ${role}: ${reason}`);

    const analysisPrompt = `Analyze this escalated decision and prepare a recommendation for human review.

## Escalation Details
- **From Role**: ${role.toUpperCase()}
- **Reason**: ${reason}
- **Priority**: ${priority}

## Task Information
${JSON.stringify(task, null, 2)}

## Agent's Recommendation
${agentRecommendation || 'No specific recommendation provided'}

## Additional Context
${JSON.stringify(context, null, 2)}

## Your Analysis Should Include:

### 1. SITUATION ASSESSMENT
- What is the core decision that needs to be made?
- Why was this escalated? Is escalation appropriate?
- What are the key facts?

### 2. STAKEHOLDER IMPACT
- Who is affected by this decision?
- What are the implications for each stakeholder?

### 3. OPTIONS ANALYSIS
Provide 2-3 options with pros/cons:
- Option A: [Description]
  - Pros:
  - Cons:
  - Risk Level:
- Option B: [Description]
  - Pros:
  - Cons:
  - Risk Level:

### 4. RECOMMENDATION
- Your recommended course of action
- Clear rationale
- Confidence level (High/Medium/Low)

### 5. RISK ASSESSMENT
- What could go wrong?
- Mitigation strategies
- Reversibility of decision

### 6. URGENCY
- Time sensitivity
- Deadline if applicable
- Consequences of delay

### 7. INFORMATION GAPS
- What additional information would help?
- Who should be consulted?

Remember: You are preparing this for HUMAN REVIEW. Be thorough, clear, and objective.`;

    const response = await this.llm.complete({
      modelId: 'claude-opus-4', // Use most capable model for CEO decisions
      systemPrompt: this.systemPrompt,
      userMessage: analysisPrompt,
      temperature: 0.5,
    });

    const analysis = {
      id: `ESC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      escalation,
      ceoAnalysis: response.content,
      status: 'pending_human_review',
      analyzedAt: new Date().toISOString(),
      priority: this.determinePriority(reason, priority, response.content),
      tokens: response.inputTokens + response.outputTokens,
    };

    // Queue for human review - DO NOT auto-approve
    this.escalationQueue.push(analysis);

    // Emit event for the system to track
    this.emit('escalationAnalyzed', analysis);

    return analysis;
  }

  /**
   * Review a decision made by another agent
   * Provides analysis and recommendation for human operator
   */
  async reviewDecision(decision, context = {}) {
    const {
      role,
      action,
      rationale,
      amount,
      impact,
    } = decision;

    console.log(`[CEO] Reviewing decision from ${role}`);

    const reviewPrompt = `Review this agent decision and provide assessment for human oversight.

## Decision Under Review
- **Made By**: ${role.toUpperCase()}
- **Action Taken**: ${action}
- **Rationale Given**: ${rationale}
${amount ? `- **Financial Amount**: $${amount.toLocaleString()}` : ''}
${impact ? `- **Stated Impact**: ${impact}` : ''}

## Context
${JSON.stringify(context, null, 2)}

## Review Framework:

### 1. DECISION QUALITY ASSESSMENT
- Is the rationale sound?
- Were alternatives considered?
- Is this within the agent's authority?

### 2. ALIGNMENT CHECK
- Aligns with company strategy? (Yes/Partial/No)
- Aligns with company values? (Yes/Partial/No)
- Consistent with past decisions? (Yes/Partial/No)

### 3. RISK EVALUATION
- Identified risks
- Unidentified risks the agent may have missed
- Overall risk level (Low/Medium/High/Critical)

### 4. RECOMMENDATION
- APPROVE: Decision is sound, no action needed
- FLAG: Human should be aware, no immediate action
- ESCALATE: Requires human intervention
- REVERSE: Decision should be reconsidered

### 5. NOTES FOR HUMAN OPERATOR
- Key points to be aware of
- Suggested follow-up actions
- Learning opportunities for the agent

Provide a thorough but concise review.`;

    const response = await this.llm.complete({
      modelId: 'claude-opus-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.5,
    });

    const review = {
      id: `REV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      decision,
      context,
      ceoReview: response.content,
      reviewedAt: new Date().toISOString(),
      status: 'reviewed',
    };

    this.decisionHistory.push(review);
    this.emit('decisionReviewed', review);

    return review;
  }

  /**
   * Set strategic direction for an area of the business
   * Creates a directive that guides agent behavior
   */
  async setStrategicDirection(area, direction) {
    console.log(`[CEO] Setting strategic direction for: ${area}`);

    const directivePrompt = `Create a strategic directive for the following area.

## Area
${area}

## Desired Direction
${direction}

## Create a Strategic Directive:

### 1. DIRECTIVE STATEMENT
Clear, concise statement of the strategic direction

### 2. RATIONALE
- Why is this direction important?
- What problem does it solve?
- What opportunity does it capture?

### 3. SCOPE
- Which departments are affected?
- What decisions does this guide?
- What is explicitly OUT of scope?

### 4. IMPLEMENTATION GUIDANCE
- Key actions to take
- Key actions to avoid
- Decision criteria to apply

### 5. SUCCESS METRICS
- How will we know if this is working?
- Key indicators to track
- Timeline for evaluation

### 6. CONSTRAINTS
- Budget implications
- Resource requirements
- Dependencies on other initiatives

### 7. COMMUNICATION PLAN
- Who needs to know?
- How should this be communicated?
- FAQ for team members

Note: This directive will be queued for human approval before becoming active.`;

    const response = await this.llm.complete({
      modelId: 'claude-opus-4',
      systemPrompt: this.systemPrompt,
      userMessage: directivePrompt,
      temperature: 0.6,
    });

    const directive = {
      id: `DIR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      area,
      direction,
      content: response.content,
      status: 'pending_human_approval', // Must be approved by human
      createdAt: new Date().toISOString(),
      createdBy: 'ceo-agent',
    };

    // Queue for human approval - strategic directives require human sign-off
    this.escalationQueue.push({
      type: 'strategic_directive',
      directive,
      priority: 'HIGH',
    });

    this.emit('directiveCreated', directive);

    return directive;
  }

  /**
   * Resolve a conflict between two departments
   * Analyzes both sides and prepares resolution recommendation
   */
  async resolveDepartmentConflict(dept1, dept2, issue) {
    console.log(`[CEO] Mediating conflict between ${dept1} and ${dept2}`);

    const mediationPrompt = `Mediate this inter-department conflict and prepare a resolution recommendation.

## Conflict Details
- **Department 1**: ${dept1.toUpperCase()}
- **Department 2**: ${dept2.toUpperCase()}
- **Issue**: ${issue}

## Conflict Resolution Framework:

### 1. ISSUE ANALYSIS
- What is the core disagreement?
- What are the underlying interests of each party?
- Is this a resource conflict, priority conflict, or approach conflict?

### 2. DEPARTMENT 1 PERSPECTIVE (${dept1.toUpperCase()})
- Their stated position
- Their underlying needs
- Valid points in their argument
- Weaknesses in their position

### 3. DEPARTMENT 2 PERSPECTIVE (${dept2.toUpperCase()})
- Their stated position
- Their underlying needs
- Valid points in their argument
- Weaknesses in their position

### 4. COMMON GROUND
- Where do interests align?
- Shared goals
- Mutual benefits possible

### 5. RESOLUTION OPTIONS
Present 3 options:

**Option A: [Name]**
- Description
- Impact on ${dept1}
- Impact on ${dept2}
- Company-wide impact

**Option B: [Name]**
- Description
- Impact on ${dept1}
- Impact on ${dept2}
- Company-wide impact

**Option C: Compromise**
- Description
- What each side gives up
- What each side gains

### 6. RECOMMENDED RESOLUTION
- Recommended option
- Rationale
- Implementation steps
- Success criteria

### 7. PREVENTION
- How to prevent similar conflicts
- Process improvements
- Communication enhancements

### 8. FOLLOW-UP REQUIRED
- Who needs to do what
- Timeline
- Escalation path if resolution fails

This resolution will be queued for human approval.`;

    const response = await this.llm.complete({
      modelId: 'claude-opus-4',
      systemPrompt: this.systemPrompt,
      userMessage: mediationPrompt,
      temperature: 0.5,
    });

    const resolution = {
      id: `CNF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      departments: [dept1, dept2],
      issue,
      analysis: response.content,
      status: 'pending_human_approval',
      createdAt: new Date().toISOString(),
    };

    // Queue for human approval
    this.escalationQueue.push({
      type: 'conflict_resolution',
      resolution,
      priority: 'HIGH',
    });

    this.emit('conflictAnalyzed', resolution);

    return resolution;
  }

  /**
   * Get all pending items for human review
   */
  getPendingForReview() {
    return this.escalationQueue.filter(
      (item) => item.status === 'pending_human_review' ||
               item.status === 'pending_human_approval' ||
               (item.directive && item.directive.status === 'pending_human_approval') ||
               (item.resolution && item.resolution.status === 'pending_human_approval')
    );
  }

  /**
   * Mark an item as reviewed by human
   */
  markAsReviewed(itemId, humanDecision, notes = '') {
    const item = this.escalationQueue.find(
      (i) => i.id === itemId ||
            (i.directive && i.directive.id === itemId) ||
            (i.resolution && i.resolution.id === itemId)
    );

    if (item) {
      item.humanDecision = humanDecision;
      item.humanNotes = notes;
      item.reviewedAt = new Date().toISOString();
      item.status = 'human_reviewed';

      if (item.directive) {
        item.directive.status = humanDecision === 'approved' ? 'active' : 'rejected';
        if (humanDecision === 'approved') {
          this.strategicDirectives.set(item.directive.area, item.directive);
        }
      }

      if (item.resolution) {
        item.resolution.status = humanDecision === 'approved' ? 'resolved' : 'rejected';
        if (humanDecision === 'approved') {
          this.resolvedConflicts.push(item.resolution);
        }
      }

      this.emit('humanDecisionRecorded', { itemId, humanDecision, notes });
    }

    return item;
  }

  /**
   * Get escalation queue statistics
   */
  getQueueStats() {
    const pending = this.getPendingForReview();
    const reviewed = this.escalationQueue.filter((i) => i.status === 'human_reviewed');

    return {
      totalInQueue: this.escalationQueue.length,
      pendingReview: pending.length,
      humanReviewed: reviewed.length,
      byPriority: {
        critical: pending.filter((i) => i.priority === 'CRITICAL').length,
        high: pending.filter((i) => i.priority === 'HIGH').length,
        medium: pending.filter((i) => i.priority === 'MEDIUM').length,
        low: pending.filter((i) => i.priority === 'LOW').length,
      },
      oldestPending: pending.length > 0 ? pending[0].analyzedAt : null,
    };
  }

  /**
   * Determine priority based on content analysis
   */
  determinePriority(reason, originalPriority, analysis) {
    const criticalKeywords = [
      'security', 'breach', 'legal', 'lawsuit', 'compliance',
      'termination', 'urgent', 'immediate', 'critical', 'emergency',
    ];

    const highKeywords = [
      'financial', 'contract', 'deadline', 'customer', 'revenue',
      'partnership', 'investment', 'acquisition',
    ];

    const content = `${reason} ${analysis}`.toLowerCase();

    if (criticalKeywords.some((kw) => content.includes(kw))) {
      return 'CRITICAL';
    }

    if (highKeywords.some((kw) => content.includes(kw))) {
      return 'HIGH';
    }

    return originalPriority || 'MEDIUM';
  }

  /**
   * Generate executive summary of pending items
   */
  async generateExecutiveSummary() {
    const pending = this.getPendingForReview();

    if (pending.length === 0) {
      return {
        summary: 'No items pending human review.',
        generatedAt: new Date().toISOString(),
      };
    }

    const summaryPrompt = `Generate an executive summary of items pending human review.

## Pending Items (${pending.length} total)

${pending.map((item, idx) => `
### Item ${idx + 1}
- ID: ${item.id || item.directive?.id || item.resolution?.id}
- Type: ${item.type || 'escalation'}
- Priority: ${item.priority || 'MEDIUM'}
- From: ${item.escalation?.role || 'N/A'}
- Summary: ${item.escalation?.reason || item.directive?.area || item.resolution?.issue || 'N/A'}
`).join('\n')}

## Create Executive Summary:

1. **Overview**: Brief summary of pending decisions
2. **Critical Items**: Any items requiring immediate attention
3. **Recommended Review Order**: Prioritized list
4. **Time Estimate**: Approximate time to review all items
5. **Key Themes**: Common patterns or related decisions

Be concise - this is for busy executives.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4', // Use faster model for summaries
      systemPrompt: this.systemPrompt,
      userMessage: summaryPrompt,
      temperature: 0.5,
    });

    return {
      summary: response.content,
      itemCount: pending.length,
      stats: this.getQueueStats(),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle - CEO can handle any escalated task
   */
  canHandle(task) {
    // CEO handles escalated tasks and strategic decisions
    const content = task.content.toLowerCase();
    const ceoKeywords = [
      'strategic', 'vision', 'company-wide', 'executive', 'board',
      'investor', 'acquisition', 'merger', 'policy', 'culture',
      'escalate', 'ceo approval', 'ceo decision',
    ];

    if (ceoKeywords.some((kw) => content.includes(kw))) {
      return true;
    }

    // Handle if explicitly assigned or escalated
    return task.assigned_role === this.roleId || task.escalated_to === 'ceo';
  }

  /**
   * Get status including queue information
   */
  getStatus() {
    const baseStatus = super.getStatus();
    return {
      ...baseStatus,
      queueStats: this.getQueueStats(),
      activeDirectives: this.strategicDirectives.size,
      resolvedConflicts: this.resolvedConflicts.length,
    };
  }
}

export default CEOAgent;
export { CEO_CONFIG };
