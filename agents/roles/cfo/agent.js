/**
 * MONOLITH OS - Chief Financial Officer Agent
 * Financial analysis, budget management, and cost control
 *
 * Responsibilities:
 * - Budget approval within thresholds
 * - Financial analysis and reporting
 * - Cost comparison and vendor evaluation
 * - Expense categorization and tracking
 * - Cash flow monitoring
 */

import RoleAgent from '../../core/RoleAgent.js';

const CFO_CONFIG = {
  roleId: 'cfo',
  roleName: 'Chief Financial Officer',
  roleAbbr: 'CFO',
  tier: 1,

  responsibilities: [
    'Manage company financial planning and analysis',
    'Approve expenses within authority limits',
    'Review and approve vendor contracts and pricing',
    'Monitor cash flow and runway',
    'Prepare financial reports and forecasts',
    'Evaluate cost-benefit of business decisions',
    'Ensure compliance with financial regulations',
  ],

  authorityLimits: {
    maxApprovalAmount: 25000,
    canApproveExpenses: true,
    canApproveVendors: true,
    canModifyBudget: false, // Requires CEO for budget changes
    requiresCEOAbove: 25000,
  },

  reportsTo: 'ceo',
  directReports: ['vp-fin', 'dir-fin'],

  roleDescription: `You are the Chief Financial Officer, responsible for all financial matters.

Your core competencies:
1. Financial Analysis - Evaluate ROI, NPV, payback periods
2. Budget Management - Track spending against budgets
3. Cost Optimization - Identify savings opportunities
4. Risk Assessment - Evaluate financial risks
5. Compliance - Ensure financial regulatory compliance

Decision Framework:
- Approve expenses up to $25,000 autonomously
- Escalate expenses over $25,000 to CEO
- Always document financial rationale
- Consider cash flow impact on all decisions
- Flag any compliance concerns immediately`,
};

class CFOAgent extends RoleAgent {
  constructor(config = {}) {
    super({ ...CFO_CONFIG, ...config });

    // CFO-specific state
    this.budgetTracking = new Map();
    this.pendingApprovals = [];
    this.expenseCategories = [
      'personnel', 'software', 'infrastructure', 'marketing',
      'legal', 'operations', 'travel', 'equipment', 'other'
    ];
  }

  /**
   * Analyze a financial request
   */
  async analyzeFinancialRequest(request) {
    const analysisPrompt = `Analyze this financial request and provide a recommendation.

## Request Details:
${JSON.stringify(request, null, 2)}

## Your Analysis Should Include:
1. **Amount Assessment**: Is this amount reasonable for the request?
2. **Budget Impact**: How does this affect the relevant budget?
3. **ROI Analysis**: What's the expected return (if applicable)?
4. **Risk Assessment**: Any financial risks?
5. **Cash Flow Impact**: Effect on cash position?
6. **Recommendation**: APPROVE, REJECT, or ESCALATE with rationale

## Authority Check:
- Your approval limit: $${this.authorityLimits.maxApprovalAmount.toLocaleString()}
- If amount exceeds limit, recommend ESCALATE to CEO

Provide your analysis in a structured format.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: analysisPrompt,
      temperature: 0.5,
    });

    return this.parseFinancialAnalysis(response.content, request);
  }

  /**
   * Parse financial analysis response
   */
  parseFinancialAnalysis(content, request) {
    const result = {
      request,
      analysis: content,
      recommendation: 'REVIEW',
      withinAuthority: true,
      amount: this.extractAmount(request),
      timestamp: new Date().toISOString(),
    };

    // Check authority limit
    if (result.amount > this.authorityLimits.maxApprovalAmount) {
      result.withinAuthority = false;
      result.recommendation = 'ESCALATE';
      result.escalateReason = `Amount $${result.amount.toLocaleString()} exceeds CFO authority limit of $${this.authorityLimits.maxApprovalAmount.toLocaleString()}`;
    } else {
      // Parse recommendation from content
      const lowerContent = content.toLowerCase();
      if (lowerContent.includes('approve') && !lowerContent.includes('not approve')) {
        result.recommendation = 'APPROVE';
      } else if (lowerContent.includes('reject') || lowerContent.includes('deny')) {
        result.recommendation = 'REJECT';
      } else if (lowerContent.includes('escalate')) {
        result.recommendation = 'ESCALATE';
      }
    }

    return result;
  }

  /**
   * Extract amount from request
   */
  extractAmount(request) {
    const content = JSON.stringify(request).toLowerCase();
    const matches = content.match(/\$[\d,]+(?:\.\d{2})?|(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|usd)/gi);

    if (matches) {
      const amounts = matches.map(m =>
        parseFloat(m.replace(/[$,\s]/g, '').replace(/dollars?|usd/i, ''))
      );
      return Math.max(...amounts);
    }

    return 0;
  }

  /**
   * Compare vendor costs
   */
  async compareVendorCosts(vendors) {
    const comparisonPrompt = `Compare these vendor options and provide a recommendation.

## Vendors to Compare:
${JSON.stringify(vendors, null, 2)}

## Evaluation Criteria:
1. **Total Cost of Ownership** (not just sticker price)
2. **Value for Money** - What do you get for the price?
3. **Risk Factors** - Vendor stability, lock-in risks
4. **Hidden Costs** - Implementation, training, support
5. **Scalability** - Cost at 2x, 5x, 10x scale

## Output Format:
1. Comparison table
2. Pros/cons for each option
3. Recommended choice with rationale
4. Financial impact summary`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: comparisonPrompt,
      temperature: 0.5,
    });

    return {
      comparison: response.content,
      vendors,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Review expense and categorize
   */
  async reviewExpense(expense) {
    const reviewPrompt = `Review and categorize this expense.

## Expense Details:
${JSON.stringify(expense, null, 2)}

## Tasks:
1. Categorize into: ${this.expenseCategories.join(', ')}
2. Verify it's a legitimate business expense
3. Check if it aligns with budget
4. Flag any concerns
5. Recommend: APPROVE, REJECT, or REQUEST_INFO

Provide structured output.`;

    const response = await this.llm.complete({
      modelId: 'claude-haiku', // Use faster model for routine categorization
      systemPrompt: this.systemPrompt,
      userMessage: reviewPrompt,
      temperature: 0.3,
    });

    return {
      expense,
      review: response.content,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate financial summary
   */
  async generateFinancialSummary(data) {
    const summaryPrompt = `Generate a financial summary for executive review.

## Financial Data:
${JSON.stringify(data, null, 2)}

## Summary Should Include:
1. **Key Metrics** - Revenue, expenses, runway
2. **Budget vs Actual** - Variances and explanations
3. **Cash Position** - Current and projected
4. **Alerts** - Any concerning trends
5. **Recommendations** - Actions to consider

Keep it concise and actionable for CEO review.`;

    const response = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: summaryPrompt,
      temperature: 0.5,
    });

    return {
      summary: response.content,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Override canHandle for CFO-specific tasks
   */
  canHandle(task) {
    const content = task.content.toLowerCase();
    const cfoKeywords = [
      'budget', 'expense', 'cost', 'financial', 'payment',
      'invoice', 'vendor', 'pricing', 'revenue', 'cash flow',
      'roi', 'investment', 'spend', 'approve'
    ];

    if (cfoKeywords.some(kw => content.includes(kw))) {
      return true;
    }

    return task.assigned_role === this.roleId;
  }
}

export default CFOAgent;
export { CFO_CONFIG };
