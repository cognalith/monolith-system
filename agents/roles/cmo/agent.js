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

  // ==========================================
  // EMAIL & BROWSER INTEGRATION METHODS
  // ==========================================

  /**
   * Send marketing outreach emails for a campaign
   * @param {Object} campaign - Campaign details including recipients, content, etc.
   * @returns {Promise<Object>} Send result with campaign tracking
   */
  async sendMarketingOutreach(campaign) {
    const {
      recipients = [],
      subject,
      templateId,
      content,
      campaignName,
      trackingId = `campaign-${Date.now()}`,
    } = campaign;

    // Generate personalized marketing email
    const emailPrompt = `Create a compelling marketing email for this campaign.

## Campaign: ${campaignName || 'Marketing Outreach'}
## Subject Line: ${subject || 'Generate an engaging subject'}
## Content Guidelines:
${content || 'Professional B2B marketing email'}

Create an HTML email that:
1. Has a compelling headline
2. Clear value proposition
3. Strong call-to-action
4. Professional design
5. Mobile-friendly layout

Return only the HTML email body.`;

    const emailContent = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: emailPrompt,
      temperature: 0.7,
    });

    const finalSubject = subject || `[${campaignName}] Exclusive Opportunity`;

    const htmlBody = `
<html>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${emailContent.content}
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
    <p style="color: #a0aec0; font-size: 10px; text-align: center;">
      Campaign: ${campaignName} | Tracking: ${trackingId}
      <br>
      If you no longer wish to receive marketing emails, click here to unsubscribe.
    </p>
  </div>
</body>
</html>`;

    const results = [];
    for (const recipient of recipients) {
      const result = await this.sendEmail(recipient, finalSubject, htmlBody, { isHtml: true });
      results.push({
        recipient,
        ...result,
        trackingId,
      });
    }

    // Track campaign
    this.campaigns.push({
      id: trackingId,
      name: campaignName,
      recipients: recipients.length,
      sentAt: new Date().toISOString(),
      results,
    });

    return {
      success: results.every(r => r.success),
      campaignId: trackingId,
      campaignName,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      sentAt: new Date().toISOString(),
    };
  }

  /**
   * Research a competitor by browsing their website
   * @param {string} url - Competitor website URL
   * @returns {Promise<Object>} Competitive analysis based on website content
   */
  async researchCompetitor(url) {
    console.log(`[CMO] Researching competitor: ${url}`);

    // Browse the competitor website
    const browseResult = await this.browseUrl(url);

    if (!browseResult.success) {
      return {
        success: false,
        error: browseResult.error,
        url,
      };
    }

    // Get page content for analysis
    const contentResult = await this.getWebContent(url);

    // Take a screenshot for reference
    const screenshotPath = `screenshots/competitor-${Date.now()}.png`;
    const screenshot = await this.takeScreenshot(screenshotPath);

    // Analyze the competitor content using LLM
    const analysisPrompt = `Analyze this competitor website content from a marketing perspective.

## URL: ${url}
## Page Title: ${browseResult.title || contentResult.title}
## Page Content:
${(contentResult.content || '').substring(0, 5000)}

## Analysis Required:
1. **Value Proposition**: What's their main offering and messaging?
2. **Target Audience**: Who are they targeting?
3. **Brand Positioning**: How do they position themselves?
4. **Key Features/Benefits**: What do they highlight?
5. **CTAs**: What actions do they want visitors to take?
6. **Design/UX**: Professional assessment
7. **SEO Observations**: Meta tags, keywords, structure
8. **Competitive Threats**: What should we be concerned about?
9. **Opportunities**: Gaps we can exploit

Provide actionable insights for our marketing strategy.`;

    const analysis = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: analysisPrompt,
      temperature: 0.5,
    });

    return {
      success: true,
      url,
      title: browseResult.title || contentResult.title,
      analysis: analysis.content,
      screenshot: screenshot.success ? screenshot.path : null,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Check social media metrics by accessing analytics dashboard
   * @param {string} dashboardUrl - URL of social media analytics dashboard
   * @returns {Promise<Object>} Dashboard metrics and screenshot
   */
  async checkSocialMetrics(dashboardUrl) {
    console.log(`[CMO] Checking social metrics at: ${dashboardUrl}`);

    // Navigate to the dashboard
    const browseResult = await this.browseUrl(dashboardUrl);

    if (!browseResult.success) {
      return {
        success: false,
        error: browseResult.error,
        url: dashboardUrl,
      };
    }

    // Take a screenshot of the dashboard for records
    const screenshotPath = `screenshots/social-metrics-${new Date().toISOString().split('T')[0]}.png`;
    const screenshot = await this.takeScreenshot(screenshotPath);

    // Get the page content
    const contentResult = await this.getWebContent(dashboardUrl);

    // Analyze the metrics from the dashboard
    const metricsPrompt = `Extract and analyze social media metrics from this dashboard content.

## Dashboard URL: ${dashboardUrl}
## Page Content:
${(contentResult.content || '').substring(0, 4000)}

## Extract and Analyze:
1. **Key Metrics**: Followers, engagement rate, reach, impressions
2. **Trend Analysis**: Are metrics improving or declining?
3. **Top Performing Content**: What's working?
4. **Engagement Breakdown**: Likes, comments, shares distribution
5. **Audience Insights**: Demographics, best posting times
6. **Recommendations**: What actions should we take?

Provide a structured metrics report with actionable insights.`;

    const analysis = await this.llm.complete({
      modelId: 'claude-sonnet-4',
      systemPrompt: this.systemPrompt,
      userMessage: metricsPrompt,
      temperature: 0.4,
    });

    // Store metrics for tracking
    this.marketingMetrics.push({
      type: 'social',
      url: dashboardUrl,
      checkedAt: new Date().toISOString(),
      analysis: analysis.content,
    });

    return {
      success: true,
      url: dashboardUrl,
      screenshot: screenshot.success ? screenshot.path : null,
      metrics: analysis.content,
      checkedAt: new Date().toISOString(),
    };
  }

  // ==========================================
  // MEDIA GENERATION INTEGRATION METHODS
  // ==========================================

  /**
   * Generate marketing campaign assets (infographics, slides, social graphics)
   * @param {Object} campaign - Campaign details
   * @param {Object} options - Generation options including brandKitId
   * @returns {Promise<Object>} Generated asset requests ready for Canva MCP
   */
  async createCampaignAssets(campaign, options = {}) {
    const {
      name = 'Marketing Campaign',
      brief,
      targetAudience,
      keyMessages = [],
      assetTypes = ['infographic', 'slides', 'social'],
    } = campaign;

    console.log(`[CMO] Creating campaign assets for: ${name}`);

    // Generate enhanced content brief for each asset type
    const contentBrief = `
Campaign: ${name}
Brief: ${brief || 'Marketing campaign assets'}
Target Audience: ${targetAudience || 'General audience'}
Key Messages:
${keyMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}
    `.trim();

    const results = {};

    for (const assetType of assetTypes) {
      try {
        const result = await this.createMedia(assetType, contentBrief, {
          brandKitId: options.brandKitId,
          title: `${name} - ${assetType}`,
        });
        results[assetType] = result;
      } catch (error) {
        results[assetType] = {
          success: false,
          error: error.message,
        };
      }
    }

    // Track campaign assets
    const campaignRecord = {
      id: `campaign-assets-${Date.now()}`,
      campaignName: name,
      assets: results,
      createdAt: new Date().toISOString(),
    };
    this.campaigns.push(campaignRecord);

    return {
      success: Object.values(results).some(r => r.success),
      campaignId: campaignRecord.id,
      campaignName: name,
      assets: results,
      createdAt: campaignRecord.createdAt,
      message: `Campaign assets created. Use Canva MCP tools to generate designs.`,
    };
  }

  /**
   * Generate a product podcast via NotebookLM
   * @param {Object} product - Product details
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Podcast generation result
   */
  async createProductPodcast(product, options = {}) {
    const {
      name = 'Product',
      description,
      features = [],
      benefits = [],
      documentUrls = [],
    } = product;

    console.log(`[CMO] Creating podcast for product: ${name}`);

    // Build comprehensive product content
    const content = `
# ${name} Deep Dive

## Overview
${description || 'An innovative product designed to solve key challenges.'}

## Key Features
${features.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## Benefits
${benefits.map((b, i) => `${i + 1}. ${b}`).join('\n')}

## Why It Matters
This product represents a significant advancement in its category, offering users unique value through its innovative approach.
    `.trim();

    const sources = [];

    // Add document URLs as sources
    if (documentUrls && documentUrls.length > 0) {
      documentUrls.forEach(url => {
        sources.push({ type: 'url', content: url });
      });
    }

    try {
      const result = await this.createPodcast(content, {
        title: `${name} - Product Deep Dive`,
        sources,
        ...options,
      });

      return {
        success: result.success,
        productName: name,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        productName: name,
      };
    }
  }

  /**
   * Generate a full brand media kit
   * @param {Object} brandInfo - Brand information
   * @param {Object} options - Generation options including brandKitId
   * @returns {Promise<Object>} Complete brand media kit
   */
  async createBrandMediaKit(brandInfo, options = {}) {
    const {
      brandName,
      tagline,
      description,
      values = [],
      voiceTone,
    } = brandInfo;

    console.log(`[CMO] Creating brand media kit for: ${brandName}`);

    const brandContent = `
Brand: ${brandName}
Tagline: ${tagline || ''}
Description: ${description || ''}
Brand Values: ${values.join(', ')}
Voice & Tone: ${voiceTone || 'Professional and approachable'}
    `.trim();

    // Create multiple brand assets
    const assetTypes = [
      { type: 'logo', content: `Create a logo concept for ${brandName}. ${tagline}` },
      { type: 'infographic', content: `Brand identity infographic for ${brandName}. ${brandContent}` },
      { type: 'slides', content: `Brand guidelines presentation for ${brandName}. ${brandContent}` },
      { type: 'social', content: `Social media brand announcement for ${brandName}. ${tagline}` },
    ];

    const results = {};

    for (const asset of assetTypes) {
      try {
        const result = await this.createMedia(asset.type, asset.content, {
          brandKitId: options.brandKitId,
          title: `${brandName} - ${asset.type}`,
        });
        results[asset.type] = result;
      } catch (error) {
        results[asset.type] = {
          success: false,
          error: error.message,
        };
      }
    }

    return {
      success: Object.values(results).some(r => r.success),
      brandName,
      assets: results,
      createdAt: new Date().toISOString(),
      message: 'Brand media kit prepared. Use Canva MCP tools to generate designs.',
    };
  }

  /**
   * Generate social media content pack
   * @param {Object} contentPlan - Content plan details
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Social media content pack
   */
  async createSocialContentPack(contentPlan, options = {}) {
    const {
      theme,
      platforms = ['instagram', 'twitter', 'facebook'],
      postCount = 3,
      style = 'professional',
    } = contentPlan;

    console.log(`[CMO] Creating social content pack for: ${theme}`);

    const results = {
      posts: [],
    };

    for (let i = 0; i < postCount; i++) {
      for (const platform of platforms) {
        try {
          const content = `Social media post ${i + 1} for ${platform}. Theme: ${theme}. Style: ${style}.`;
          const result = await this.createSocialGraphic(content, {
            platform,
            brandKitId: options.brandKitId,
          });
          results.posts.push({
            platform,
            postNumber: i + 1,
            ...result,
          });
        } catch (error) {
          results.posts.push({
            platform,
            postNumber: i + 1,
            success: false,
            error: error.message,
          });
        }
      }
    }

    return {
      success: results.posts.some(p => p.success),
      theme,
      platforms,
      totalPosts: results.posts.length,
      successfulPosts: results.posts.filter(p => p.success).length,
      posts: results.posts,
      createdAt: new Date().toISOString(),
      message: 'Social content pack prepared. Use Canva MCP tools to generate graphics.',
    };
  }
}

export default CMOAgent;
export { CMO_CONFIG };
