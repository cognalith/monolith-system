/**
 * MONOLITH OS - Chief Product Officer Agent
 * Product strategy, roadmap, and user experience
 *
 * Responsibilities:
 * - Product strategy and vision
 * - Product roadmap management
 * - User research and experience
 * - Feature prioritization
 * - Product-market fit
 */

import RoleAgent from '../../core/RoleAgent.js';

const CPO_CONFIG = {
  roleId: 'cpo',
  roleName: 'Chief Product Officer',
  roleAbbr: 'CPO',
  tier: 1,

  responsibilities: [
    'Define product strategy and vision',
    'Manage product roadmap',
    'Drive user research and insights',
    'Prioritize features and releases',
    'Ensure product-market fit',
    'Coordinate with engineering on delivery',
    'Work with marketing on positioning',
  ],

  authorityLimits: {
    maxApprovalAmount: 12000,
    canApproveFeatures: true,
    canApprovePrioritization: true,
    canApproveUserResearch: true,
    requiresCEOFor: ['major pivots', 'new product lines'],
  },

  reportsTo: 'ceo',
  directReports: ['product-team', 'ux-team'],

  roleDescription: `You are the Chief Product Officer, responsible for all product matters.

Your core competencies:
1. Product Strategy - Define and execute product vision
2. Roadmap Management - Plan and prioritize features
3. User Research - Understand user needs
4. Product Development - Ship valuable features
5. Market Analysis - Find product-market fit

Decision Framework:
- Approve product-related expenses up to $12,000
- Make feature prioritization decisions
- Approve user research initiatives
- Escalate major product pivots to CEO
- Coordinate with CTO on technical feasibility
- Work with CMO on product marketing`,
};

class CPOAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CPO_CONFIG, ...config });

    // CPO-specific state
    this.roadmap = [];
    this.features = [];
    this.userResearch = [];
  }

  /**
   * Create product strategy
   */
  async createProductStrategy(context) {
    const strategyPrompt = `Create a product strategy based on this context.

## Context:
${JSON.stringify(context, null, 2)}

## Strategy Components:
1. **Vision**
   - Long-term product vision
   - Mission alignment

2. **Market Analysis**
   - Target market
   - Competitive landscape
   - Market opportunities

3. **User Segments**
   - Primary personas
   - User needs and pain points

4. **Value Proposition**
   - Core value delivered
   - Differentiation

5. **Product Pillars**
   - Key capability areas
   - Strategic bets

6. **Success Metrics**
   - KPIs and targets
   - Measurement approach

## Output:
1. Vision statement
2. Market opportunity analysis
3. User personas
4. Product pillars
5. Success metrics
6. Strategic priorities`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: strategyPrompt,
      temperature: 0.6,
    });

    return {
      strategy: response.content,
      context,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Prioritize features
   */
  async prioritizeFeatures(features) {
    const prioritizePrompt = `Prioritize these features for the roadmap.

## Features to Prioritize:
${JSON.stringify(features, null, 2)}

## Prioritization Framework (RICE):
1. **Reach** - How many users will this impact?
2. **Impact** - How much will it improve user experience?
3. **Confidence** - How certain are we about estimates?
4. **Effort** - How much work is required?

## Additional Factors:
- Strategic alignment
- Technical dependencies
- Revenue potential
- Competitive pressure

## Output:
1. Prioritized feature list with RICE scores
2. Rationale for top priorities
3. Recommended release groupings
4. Dependencies and risks
5. Deferred items with reasoning`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: prioritizePrompt,
      temperature: 0.5,
    });

    return {
      prioritization: response.content,
      features,
      prioritizedAt: new Date().toISOString(),
    };
  }

  /**
   * Review feature specification
   */
  async reviewFeatureSpec(spec) {
    const reviewPrompt = `Review this feature specification.

## Feature Specification:
${JSON.stringify(spec, null, 2)}

## Review Criteria:
1. **Problem Statement**
   - Is the problem clear?
   - Is there user evidence?

2. **Solution**
   - Does it solve the problem?
   - Is it the right solution?

3. **User Experience**
   - Is the UX well-designed?
   - Is it intuitive?

4. **Scope**
   - Is scope appropriate?
   - Are edge cases handled?

5. **Success Criteria**
   - Are metrics defined?
   - How will we measure success?

6. **Technical Feasibility**
   - Can we build it?
   - Are there risks?

## Output:
1. Spec quality assessment
2. Strengths
3. Gaps and concerns
4. Questions for clarification
5. Approval: APPROVED, REVISE, REJECT`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.5,
    });

    return {
      review: response.content,
      spec,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze user feedback
   */
  async analyzeUserFeedback(feedback) {
    const analysisPrompt = `Analyze this user feedback.

## User Feedback:
${JSON.stringify(feedback, null, 2)}

## Analysis Framework:
1. **Sentiment Analysis**
   - Overall sentiment
   - Key themes

2. **Feature Requests**
   - Requested features
   - Frequency/demand

3. **Pain Points**
   - User frustrations
   - Friction areas

4. **Praise**
   - What users love
   - Strengths to maintain

5. **Churn Indicators**
   - At-risk signals
   - Retention concerns

## Output:
1. Feedback summary
2. Top themes
3. Feature request priority
4. Pain points to address
5. Product recommendations`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: analysisPrompt,
      temperature: 0.5,
    });

    const analysis = {
      analysis: response.content,
      feedback,
      analyzedAt: new Date().toISOString(),
    };

    this.userResearch.push(analysis);
    return analysis;
  }

  /**
   * Plan product roadmap
   */
  async planRoadmap(context) {
    const roadmapPrompt = `Create a product roadmap based on this context.

## Context:
${JSON.stringify(context, null, 2)}

## Roadmap Elements:
1. **Now (Current Quarter)**
   - In-progress work
   - Committed deliverables

2. **Next (Following Quarter)**
   - Planned initiatives
   - Dependencies

3. **Later (6+ Months)**
   - Future opportunities
   - Exploratory work

4. **Themes**
   - Strategic themes
   - How items align

5. **Dependencies**
   - Technical dependencies
   - Cross-functional needs

## Output:
1. Roadmap overview
2. Now/Next/Later breakdown
3. Key milestones
4. Resource requirements
5. Risks and mitigations`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: roadmapPrompt,
      temperature: 0.5,
    });

    return {
      roadmap: response.content,
      context,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for CPO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const cpoKeywords = [
      'product', 'feature', 'roadmap', 'user', 'ux', 'ui',
      'design', 'spec', 'requirement', 'prioritize', 'mvp',
      'feedback', 'research', 'persona', 'journey', 'experience'
    ];

    if (cpoKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default CPOAgent;
export { CPO_CONFIG };
