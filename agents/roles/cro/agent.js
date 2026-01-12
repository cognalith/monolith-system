/**
 * MONOLITH OS - Chief Revenue Officer Agent
 * Revenue strategy, sales, and customer success
 *
 * Responsibilities:
 * - Revenue strategy and growth
 * - Sales operations and process
 * - Customer success and retention
 * - Pricing strategy
 * - Partnership development
 */

import RoleAgent from '../../core/RoleAgent.js';

const CRO_CONFIG = {
  roleId: 'cro',
  roleName: 'Chief Revenue Officer',
  roleAbbr: 'CRO',
  tier: 1,

  responsibilities: [
    'Drive revenue growth strategy',
    'Manage sales operations',
    'Oversee customer success',
    'Define pricing strategy',
    'Develop strategic partnerships',
    'Forecast revenue and pipeline',
    'Align sales and marketing',
  ],

  authorityLimits: {
    maxApprovalAmount: 20000,
    canApproveDeals: true,
    canApprovePricing: false, // Pricing changes need CEO
    canApprovePartnership: true,
    requiresCEOFor: ['pricing changes', 'major partnerships', 'enterprise deals'],
  },

  reportsTo: 'ceo',
  directReports: ['sales-team', 'customer-success', 'partnerships'],

  roleDescription: `You are the Chief Revenue Officer, responsible for all revenue matters.

Your core competencies:
1. Revenue Strategy - Drive sustainable growth
2. Sales Operations - Build effective sales processes
3. Customer Success - Ensure customer value and retention
4. Pricing - Optimize pricing strategy
5. Partnerships - Develop revenue partnerships

Decision Framework:
- Approve revenue-related expenses up to $20,000
- Make deal approvals within guidelines
- Approve partnership agreements
- Escalate pricing changes to CEO
- Coordinate with CMO on demand generation
- Work with CPO on product-led growth`,
};

class CROAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CRO_CONFIG, ...config });

    // CRO-specific state
    this.pipeline = [];
    this.deals = [];
    this.partnerships = [];
  }

  /**
   * Create revenue strategy
   */
  async createRevenueStrategy(context) {
    const strategyPrompt = `Create a revenue strategy based on this context.

## Context:
${JSON.stringify(context, null, 2)}

## Strategy Components:
1. **Revenue Model**
   - Revenue streams
   - Pricing model
   - Unit economics

2. **Growth Levers**
   - Customer acquisition
   - Expansion revenue
   - Retention optimization

3. **Sales Strategy**
   - Go-to-market approach
   - Sales process
   - Territory/segment focus

4. **Customer Success**
   - Onboarding
   - Adoption
   - Expansion

5. **Partnerships**
   - Channel partners
   - Strategic alliances

6. **Metrics & Targets**
   - Revenue targets
   - Leading indicators
   - KPIs

## Output:
1. Revenue model overview
2. Growth strategy
3. Sales playbook summary
4. Customer success framework
5. Partnership opportunities
6. Financial targets`;

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
   * Review deal
   */
  async reviewDeal(deal) {
    const reviewPrompt = `Review this deal for approval.

## Deal Details:
${JSON.stringify(deal, null, 2)}

## Review Criteria:
1. **Deal Size**
   - Total contract value
   - Monthly/annual value

2. **Terms**
   - Payment terms
   - Contract length
   - Discounts applied

3. **Strategic Value**
   - Logo value
   - Expansion potential
   - Reference value

4. **Risk Assessment**
   - Customer creditworthiness
   - Implementation risk
   - Churn risk

5. **Profitability**
   - Gross margin
   - Customer acquisition cost
   - Payback period

## Output:
1. Deal summary
2. Value assessment
3. Risk factors
4. Negotiation recommendations
5. Approval: APPROVED, NEGOTIATE, ESCALATE, REJECT`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.4,
    });

    return {
      review: response.content,
      deal,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze pipeline
   */
  async analyzePipeline(pipeline) {
    const analysisPrompt = `Analyze this sales pipeline.

## Pipeline Data:
${JSON.stringify(pipeline, null, 2)}

## Analysis Areas:
1. **Pipeline Health**
   - Total value
   - Stage distribution
   - Velocity

2. **Forecast**
   - Expected close
   - Confidence level
   - Risk factors

3. **Conversion Rates**
   - Stage-to-stage conversion
   - Win rate
   - Cycle time

4. **Coverage**
   - Pipeline coverage ratio
   - Gaps to target

5. **Quality**
   - Deal quality indicators
   - At-risk deals

## Output:
1. Pipeline summary
2. Forecast with confidence
3. Risk areas
4. Recommended actions
5. Coaching opportunities`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: analysisPrompt,
      temperature: 0.5,
    });

    return {
      analysis: response.content,
      pipeline,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Review customer health
   */
  async reviewCustomerHealth(customers) {
    const healthPrompt = `Review customer health for these accounts.

## Customer Data:
${JSON.stringify(customers, null, 2)}

## Health Indicators:
1. **Usage**
   - Product adoption
   - Feature usage
   - Login frequency

2. **Engagement**
   - Support interactions
   - NPS/CSAT scores
   - Community participation

3. **Value Realization**
   - ROI achieved
   - Goals met

4. **Relationship**
   - Executive engagement
   - Renewal conversations

5. **Risk Signals**
   - Declining usage
   - Complaints
   - Champion departure

## Output:
1. Health score summary
2. At-risk accounts
3. Expansion opportunities
4. Required interventions
5. Renewal forecast`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: healthPrompt,
      temperature: 0.5,
    });

    return {
      healthReview: response.content,
      customers,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Evaluate partnership opportunity
   */
  async evaluatePartnership(partner) {
    const partnerPrompt = `Evaluate this partnership opportunity.

## Partner Information:
${JSON.stringify(partner, null, 2)}

## Evaluation Criteria:
1. **Strategic Fit**
   - Market alignment
   - Product synergy
   - Value proposition

2. **Revenue Potential**
   - Direct revenue
   - Indirect benefits
   - Market access

3. **Partner Capability**
   - Sales capacity
   - Technical expertise
   - Customer base

4. **Investment Required**
   - Resources needed
   - Time to revenue

5. **Risks**
   - Competitive concerns
   - Reputation risk
   - Dependency risk

## Output:
1. Partnership assessment
2. Opportunity sizing
3. Recommended structure
4. Terms to negotiate
5. Approval: PROCEED, NEGOTIATE, PASS`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: partnerPrompt,
      temperature: 0.5,
    });

    return {
      evaluation: response.content,
      partner,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for CRO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const croKeywords = [
      'revenue', 'sales', 'deal', 'pipeline', 'customer',
      'pricing', 'partnership', 'renewal', 'churn', 'retention',
      'quota', 'forecast', 'commission', 'territory', 'enterprise'
    ];

    if (croKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default CROAgent;
export { CRO_CONFIG };
