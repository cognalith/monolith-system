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

  // ==========================================
  // EMAIL & BROWSER INTEGRATION METHODS
  // ==========================================

  /**
   * Send financial report email to stakeholders
   * @param {string[]} recipients - List of email addresses
   * @param {Object} report - Financial report data
   * @returns {Promise<Object>} Send result
   */
  async sendFinancialReport(recipients, report) {
    const {
      type = 'Monthly Financial Summary',
      period = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      data = {},
    } = report;

    // Generate formatted report using LLM
    const reportPrompt = `Create a professional financial report email.

## Report Type: ${type}
## Period: ${period}
## Financial Data:
${JSON.stringify(data, null, 2)}

Create a well-formatted HTML email with:
1. Executive summary (3-5 key points)
2. Key financial metrics in a clean table
3. Budget vs actual comparison
4. Notable variances with explanations
5. Outlook and recommendations

Keep it professional and concise for executive audience.`;

    const reportContent = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: reportPrompt,
      temperature: 0.5,
    });

    const subject = `[FINANCIAL REPORT] ${type} - ${period}`;

    const htmlBody = `
<html>
<body style="font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; color: #2d3748;">
  <div style="background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); color: white; padding: 25px; border-radius: 4px 4px 0 0;">
    <h1 style="margin: 0; font-size: 22px; font-weight: normal;">
      Financial Report
    </h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">
      ${type} | ${period}
    </p>
  </div>

  <div style="background: #f7fafc; padding: 25px; border: 1px solid #e2e8f0; border-top: none;">
    ${reportContent.content}
  </div>

  <div style="background: #edf2f7; padding: 15px 25px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 4px 4px;">
    <p style="margin: 0; color: #718096; font-size: 12px;">
      <strong>Confidential:</strong> This financial report is intended only for authorized recipients.
      <br>
      Generated by MONOLITH OS CFO Agent | ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;

    const results = [];
    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, subject, htmlBody, { isHtml: true });
      results.push({ recipient, ...result });
    }

    return {
      success: results.every(r => r.success),
      reportType: type,
      period,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Check financial dashboard and capture current metrics
   * @param {string} url - Financial dashboard URL
   * @returns {Promise<Object>} Dashboard metrics and screenshot
   */
  async checkFinancialDashboard(url) {
    console.log(`[CFO] Checking financial dashboard: ${url}`);

    // Navigate to the dashboard
    const browseResult = await this.browseUrl(url);

    if (!browseResult.success) {
      return {
        success: false,
        error: browseResult.error,
        url,
      };
    }

    // Take a screenshot for records
    const timestamp = new Date().toISOString().split('T')[0];
    const screenshotPath = `screenshots/financial-dashboard-${timestamp}.png`;
    const screenshot = await this.takeScreenshot(screenshotPath);

    // Get page content
    const contentResult = await this.getWebContent(url);

    // Extract and analyze financial metrics
    const analysisPrompt = `Extract and analyze financial metrics from this dashboard.

## Dashboard URL: ${url}
## Page Content:
${(contentResult.content || '').substring(0, 5000)}

## Extract and Analyze:
1. **Revenue Metrics**: MRR, ARR, revenue trends
2. **Expense Metrics**: Total expenses, burn rate, cost breakdown
3. **Profitability**: Gross margin, net margin, EBITDA
4. **Cash Position**: Cash on hand, runway, cash flow
5. **Budget Status**: Budget vs actual, variance analysis
6. **Key Ratios**: CAC, LTV, LTV/CAC, payback period
7. **Alerts**: Any metrics outside acceptable ranges
8. **Recommendations**: Actions needed based on data

Provide a structured financial analysis report.`;

    const analysis = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: analysisPrompt,
      temperature: 0.4,
    });

    return {
      success: true,
      url,
      title: browseResult.title || contentResult.title,
      screenshot: screenshot.success ? screenshot.path : null,
      metrics: analysis.content,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Send budget alert notification to stakeholders
   * @param {string[]} recipients - List of email addresses
   * @param {Object} alert - Budget alert details
   * @returns {Promise<Object>} Send result
   */
  async notifyBudgetAlert(recipients, alert) {
    const {
      type = 'budget_exceeded',
      department,
      category,
      budgeted,
      actual,
      variance,
      severity = 'warning', // warning, critical
      recommendations = [],
    } = alert;

    const variancePercent = budgeted > 0 ? ((actual - budgeted) / budgeted * 100).toFixed(1) : 0;
    const isOverBudget = actual > budgeted;

    const severityStyles = {
      warning: { bg: '#d69e2e', label: 'WARNING' },
      critical: { bg: '#c53030', label: 'CRITICAL' },
    };

    const style = severityStyles[severity] || severityStyles.warning;

    const subject = `[BUDGET ${style.label}] ${department || category}: ${isOverBudget ? 'Over' : 'Under'} Budget by ${Math.abs(variancePercent)}%`;

    const htmlBody = `
<html>
<body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #2d3748;">
  <div style="background: ${style.bg}; color: white; padding: 20px; border-radius: 4px 4px 0 0;">
    <h1 style="margin: 0; font-size: 18px;">
      Budget ${style.label}
    </h1>
    <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">
      ${department ? `Department: ${department}` : ''} ${category ? `| Category: ${category}` : ''}
    </p>
  </div>

  <div style="background: white; padding: 25px; border: 1px solid #e2e8f0; border-top: none;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 0; color: #718096;">Budgeted Amount:</td>
        <td style="padding: 12px 0; text-align: right; font-weight: bold;">
          $${budgeted?.toLocaleString() || '0'}
        </td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 0; color: #718096;">Actual Spend:</td>
        <td style="padding: 12px 0; text-align: right; font-weight: bold; color: ${isOverBudget ? '#c53030' : '#38a169'};">
          $${actual?.toLocaleString() || '0'}
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0; color: #718096;">Variance:</td>
        <td style="padding: 12px 0; text-align: right; font-weight: bold; color: ${isOverBudget ? '#c53030' : '#38a169'};">
          ${isOverBudget ? '+' : ''}$${variance?.toLocaleString() || (actual - budgeted).toLocaleString()} (${isOverBudget ? '+' : ''}${variancePercent}%)
        </td>
      </tr>
    </table>

    ${recommendations.length > 0 ? `
    <div style="background: #f7fafc; padding: 15px; border-radius: 4px; margin-top: 20px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #2d3748;">Recommended Actions:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #4a5568;">
        ${recommendations.map(r => `<li style="margin-bottom: 5px;">${r}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <div style="margin-top: 20px; padding: 15px; background: #fffbeb; border: 1px solid #d69e2e; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #744210;">
        <strong>Action Required:</strong> Please review the spending in this category and take appropriate action to bring expenses back in line with budget.
      </p>
    </div>
  </div>

  <div style="background: #edf2f7; padding: 15px 25px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 4px 4px;">
    <p style="margin: 0; color: #718096; font-size: 11px;">
      Sent by MONOLITH OS CFO Agent | ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>`;

    const results = [];
    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, subject, htmlBody, { isHtml: true });
      results.push({ recipient, ...result });
    }

    // Track the alert
    this.pendingApprovals.push({
      type: 'budget_alert',
      alert,
      notifiedAt: new Date().toISOString(),
      recipients,
    });

    return {
      success: results.every(r => r.success),
      alertType: type,
      severity,
      department,
      category,
      notified: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      sentAt: new Date().toISOString(),
    };
  }
}

export default CFOAgent;
export { CFO_CONFIG };
