/**
 * MONOLITH OS - Chief Marketing Officer Agent
 * Marketing strategy, brand management, and growth
 *
 * Responsibilities:
 * - Marketing strategy and planning
 * - Brand management and positioning
 * - Customer acquisition and retention
 * - Marketing analytics and ROI
 * - Content and creative direction
 */

import RoleAgent from '../../core/RoleAgent.js';

const CMO_CONFIG = {
  roleId: 'cmo',
  roleName: 'Chief Marketing Officer',
  roleAbbr: 'CMO',
  tier: 1,

  responsibilities: [
    'Develop and execute marketing strategy',
    'Manage brand identity and positioning',
    'Drive customer acquisition and retention',
    'Oversee marketing budget and ROI',
    'Lead content and creative direction',
    'Analyze market trends and competition',
    'Coordinate with sales on demand generation',
  ],

  authorityLimits: {
    maxApprovalAmount: 15000,
    canApproveCampaigns: true,
    canApproveContent: true,
    canApproveAgencySpend: true,
    requiresCEOAbove: 15000,
  },

  reportsTo: 'ceo',
  directReports: ['marketing-team', 'content-team'],

  roleDescription: `You are the Chief Marketing Officer, responsible for all marketing and brand matters.

Your core competencies:
1. Marketing Strategy - Plan and execute marketing initiatives
2. Brand Management - Build and protect brand identity
3. Growth Marketing - Drive user acquisition and retention
4. Analytics - Measure and optimize marketing ROI
5. Content Strategy - Direct content and creative

Decision Framework:
- Approve marketing spend up to $15,000
- Make campaign and content decisions
- Approve agency and vendor engagements
- Escalate major brand decisions to CEO
- Coordinate with CRO on revenue alignment
- Work with CPO on product marketing`,
};

class CMOAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CMO_CONFIG, ...config });

    // CMO-specific state
    this.campaigns = [];
    this.brandGuidelines = null;
    this.marketingMetrics = [];
  }

  /**
   * Create marketing strategy
   */
  async createMarketingStrategy(context) {
    const strategyPrompt = `Create a marketing strategy based on this context.

## Context:
${JSON.stringify(context, null, 2)}

## Strategy Components:
1. **Market Analysis**
   - Target audience
   - Competitive landscape
   - Market trends

2. **Brand Positioning**
   - Value proposition
   - Differentiation
   - Messaging framework

3. **Channel Strategy**
   - Digital channels
   - Content marketing
   - Paid acquisition
   - Partnerships

4. **Campaign Plan**
   - Key campaigns
   - Timeline
   - Budget allocation

5. **Metrics & KPIs**
   - Acquisition metrics
   - Engagement metrics
   - Revenue metrics

## Output:
1. Executive summary
2. Target audience profiles
3. Channel recommendations
4. Campaign concepts
5. Budget breakdown
6. Success metrics`;

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
   * Review campaign proposal
   */
  async reviewCampaign(campaign) {
    const reviewPrompt = `Review this marketing campaign proposal.

## Campaign Details:
${JSON.stringify(campaign, null, 2)}

## Review Criteria:
1. **Strategic Alignment**
   - Does it support business goals?
   - Is it on-brand?

2. **Target Audience**
   - Is the audience well-defined?
   - Will messaging resonate?

3. **Channel Selection**
   - Are channels appropriate?
   - Is the mix balanced?

4. **Budget & ROI**
   - Is budget reasonable?
   - What's expected ROI?

5. **Creative Direction**
   - Is creative compelling?
   - Does it differentiate?

6. **Measurement**
   - Are KPIs defined?
   - Can we track effectively?

## Output:
1. Campaign assessment
2. Strengths and weaknesses
3. Recommendations
4. Risk factors
5. Approval: APPROVED, REVISE, REJECT`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.5,
    });

    return {
      review: response.content,
      campaign,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze marketing performance
   */
  async analyzePerformance(metrics) {
    const analysisPrompt = `Analyze marketing performance based on these metrics.

## Metrics Data:
${JSON.stringify(metrics, null, 2)}

## Analysis Framework:
1. **Acquisition**
   - Traffic sources
   - Conversion rates
   - Cost per acquisition

2. **Engagement**
   - Content performance
   - Social engagement
   - Email metrics

3. **Revenue Impact**
   - Marketing attributed revenue
   - Customer lifetime value
   - Payback period

4. **Channel Performance**
   - Channel ROI comparison
   - Attribution analysis
   - Optimization opportunities

## Output:
1. Performance summary
2. Top performers
3. Underperformers
4. Optimization recommendations
5. Budget reallocation suggestions`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: analysisPrompt,
      temperature: 0.5,
    });

    return {
      analysis: response.content,
      metrics,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Create content strategy
   */
  async createContentStrategy(goals) {
    const contentPrompt = `Create a content strategy for these goals.

## Goals:
${JSON.stringify(goals, null, 2)}

## Content Strategy Elements:
1. **Content Pillars**
   - Core themes
   - Topic clusters
   - SEO strategy

2. **Content Types**
   - Blog posts
   - Videos
   - Social content
   - Email newsletters
   - Whitepapers/guides

3. **Distribution**
   - Owned channels
   - Earned media
   - Paid promotion

4. **Content Calendar**
   - Publishing frequency
   - Key dates/events
   - Resource allocation

5. **Measurement**
   - Content KPIs
   - Attribution model

## Output:
1. Content pillars and themes
2. Content type mix
3. Distribution plan
4. Sample content calendar
5. Resource requirements`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: contentPrompt,
      temperature: 0.6,
    });

    return {
      contentStrategy: response.content,
      goals,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze competitive positioning
   */
  async analyzeCompetition(competitors) {
    const competitivePrompt = `Analyze our competitive positioning.

## Competitors:
${JSON.stringify(competitors, null, 2)}

## Analysis Areas:
1. **Market Position**
   - Market share
   - Brand perception
   - Pricing position

2. **Marketing Tactics**
   - Channels used
   - Messaging themes
   - Content approach

3. **Strengths & Weaknesses**
   - Competitive advantages
   - Vulnerabilities

4. **Opportunities**
   - Market gaps
   - Differentiation options

## Output:
1. Competitive landscape map
2. Positioning analysis
3. Differentiation opportunities
4. Recommended actions`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: competitivePrompt,
      temperature: 0.5,
    });

    return {
      analysis: response.content,
      competitors,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for CMO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const cmoKeywords = [
      'marketing', 'brand', 'campaign', 'advertising', 'promotion',
      'content', 'social media', 'seo', 'email marketing', 'acquisition',
      'growth', 'leads', 'awareness', 'positioning', 'creative',
      'analytics', 'roi', 'conversion', 'funnel'
    ];

    if (cmoKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default CMOAgent;
export { CMO_CONFIG };
