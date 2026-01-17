/**
 * RESEARCH ENGINE - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Handles deep research for Knowledge Bots to improve subordinate Knowledge.
 * Analyzes failure patterns, builds research topics, and generates actionable insights.
 *
 * KEY RESPONSIBILITIES:
 * - Build research topics based on subordinate specialty and failure patterns
 * - Perform deep research on topics using web search
 * - Analyze failure and success patterns from task history
 * - Orchestrate full research cycles for Knowledge Bots
 *
 * ARCHITECTURE:
 * - Knowledge Bots use this engine to research improvements for their team
 * - Research results feed into RecommendationGenerator for Knowledge amendments
 * - Supports mock data for testing and real API integration when configured
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} ResearchResult
 * @property {string} topic - Research topic
 * @property {string} summary - Key findings summary
 * @property {string[]} keyInsights - Actionable insights
 * @property {Object[]} sources - Source references
 * @property {string} sources[].url - Source URL
 * @property {string} sources[].title - Source title
 * @property {'high'|'medium'|'low'} sources[].relevance - Relevance rating
 * @property {string} applicability - How this applies to the subordinate's work
 */

/**
 * @typedef {Object} FailurePattern
 * @property {string} type - Pattern type
 * @property {string} category - Task category
 * @property {number} frequency - How often this pattern occurs
 * @property {string[]} commonReasons - Common failure reasons
 * @property {number} confidence - Confidence score (0-1)
 */

/**
 * @typedef {Object} SuccessPattern
 * @property {string} type - Pattern type
 * @property {string} category - Task category
 * @property {number} frequency - Success frequency
 * @property {string[]} contributingFactors - What contributed to success
 * @property {number} confidence - Confidence score (0-1)
 */

/**
 * @typedef {Object} KnowledgeBotConfig
 * @property {string} bot_id - Knowledge Bot ID (e.g., 'tech_kb')
 * @property {string} team_lead_role - Associated Team Lead role
 * @property {string} team_id - Team identifier
 * @property {string[]} subordinates - List of subordinate roles
 * @property {Object} focus_areas - Focus areas per subordinate
 * @property {Object} research_config - Research configuration
 * @property {string} research_config.depth - 'quick', 'standard', 'deep'
 * @property {number} research_config.maxSources - Max sources per topic
 * @property {number} research_config.refreshIntervalHours - How often to refresh
 */

/**
 * @typedef {Object} WebSearchProvider
 * @property {string} name - Provider name
 * @property {function} search - Search function
 * @property {boolean} available - Whether provider is configured
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const RESEARCH_DEPTHS = {
  quick: { maxSources: 2, maxTopics: 3, timeout: 5000 },
  standard: { maxSources: 5, maxTopics: 5, timeout: 15000 },
  deep: { maxSources: 10, maxTopics: 10, timeout: 30000 },
};

const SPECIALTY_DOMAINS = {
  web_dev_lead: 'Web Development',
  app_dev_lead: 'Mobile/Desktop Application Development',
  devops_lead: 'DevOps and Infrastructure',
  qa_lead: 'Quality Assurance and Testing',
  infrastructure_lead: 'Cloud Infrastructure',
  content_lead: 'Content Marketing',
  social_media_lead: 'Social Media Marketing',
  seo_growth_lead: 'SEO and Growth',
  brand_lead: 'Brand Management',
  ux_research_lead: 'UX Research',
  product_analytics_lead: 'Product Analytics',
  feature_spec_lead: 'Product Feature Specification',
  vendor_management_lead: 'Vendor Management',
  process_automation_lead: 'Process Automation',
  expense_tracking_lead: 'Expense Tracking',
  revenue_analytics_lead: 'Revenue Analytics',
  hiring_lead: 'Recruitment and Hiring',
  compliance_lead: 'HR Compliance',
};

// ============================================================================
// RESEARCH TOPIC BUILDER
// ============================================================================

/**
 * Build research topics based on subordinate specialty and failure patterns
 * @param {string} subordinateSpecialty - e.g., 'Web Development'
 * @param {Object[]} failurePatterns - Recent failure analysis
 * @param {string} currentKnowledge - Current knowledge instructions
 * @param {string[]} focusAreas - Bot's focus areas for this subordinate
 * @returns {string[]} Research topics to investigate
 */
function buildResearchTopics(subordinateSpecialty, failurePatterns, currentKnowledge, focusAreas) {
  const topics = [];
  const specialty = subordinateSpecialty || 'general';

  // 1. Generate topics from failure patterns
  if (failurePatterns && failurePatterns.length > 0) {
    for (const pattern of failurePatterns) {
      // Create topic based on pattern type
      switch (pattern.type) {
        case 'repeated_failure':
          topics.push(`Best practices for ${specialty}: avoiding ${pattern.data?.primary_category || 'common'} errors`);
          if (pattern.data?.common_reasons?.length > 0) {
            topics.push(`${specialty} troubleshooting: ${pattern.data.common_reasons[0]}`);
          }
          break;

        case 'time_regression':
          topics.push(`${specialty} performance optimization techniques`);
          topics.push(`Improving efficiency in ${pattern.data?.slowest_category || specialty} tasks`);
          break;

        case 'quality_decline':
          topics.push(`${specialty} quality assurance best practices`);
          topics.push(`Code review and quality metrics for ${specialty}`);
          break;

        case 'category_weakness':
          topics.push(`${specialty}: improving ${pattern.data?.weak_category || 'weak areas'}`);
          topics.push(`Training resources for ${pattern.data?.weak_category || specialty}`);
          break;

        case 'tool_inefficiency':
          if (pattern.data?.inefficient_tool) {
            topics.push(`Best practices for using ${pattern.data.inefficient_tool}`);
            topics.push(`Alternatives to ${pattern.data.inefficient_tool} in ${specialty}`);
          }
          break;
      }
    }
  }

  // 2. Add focus area topics
  if (focusAreas && focusAreas.length > 0) {
    for (const area of focusAreas) {
      topics.push(`Latest trends in ${specialty}: ${area}`);
      topics.push(`${area} best practices for ${specialty}`);
    }
  }

  // 3. Add general improvement topics if few specific patterns
  if (topics.length < 3) {
    topics.push(`${specialty} industry best practices ${new Date().getFullYear()}`);
    topics.push(`Common pitfalls in ${specialty} and how to avoid them`);
    topics.push(`${specialty} productivity tips and techniques`);
  }

  // 4. Check current knowledge for gaps (simple keyword analysis)
  if (currentKnowledge) {
    const knowledgeStr = typeof currentKnowledge === 'string'
      ? currentKnowledge
      : JSON.stringify(currentKnowledge);

    // Add topics for commonly needed areas not in current knowledge
    const commonKeywords = ['testing', 'documentation', 'error handling', 'performance', 'security'];
    for (const keyword of commonKeywords) {
      if (!knowledgeStr.toLowerCase().includes(keyword)) {
        topics.push(`${specialty}: ${keyword} strategies`);
      }
    }
  }

  // Deduplicate and limit topics
  const uniqueTopics = [...new Set(topics)];
  return uniqueTopics.slice(0, RESEARCH_DEPTHS.deep.maxTopics);
}

// ============================================================================
// WEB SEARCH ABSTRACTION
// ============================================================================

/**
 * Web Search Provider Interface
 * Supports mock data for testing and real API integration when configured
 */
class WebSearchProvider {
  constructor(config = {}) {
    this.providers = {
      mock: {
        name: 'mock',
        available: true,
        search: this.mockSearch.bind(this),
      },
      google: {
        name: 'google',
        available: !!(config.googleApiKey && config.googleSearchEngineId),
        apiKey: config.googleApiKey || process.env.GOOGLE_API_KEY,
        searchEngineId: config.googleSearchEngineId || process.env.GOOGLE_SEARCH_ENGINE_ID,
        search: this.googleSearch.bind(this),
      },
      brave: {
        name: 'brave',
        available: !!config.braveApiKey || !!process.env.BRAVE_API_KEY,
        apiKey: config.braveApiKey || process.env.BRAVE_API_KEY,
        search: this.braveSearch.bind(this),
      },
      serper: {
        name: 'serper',
        available: !!config.serperApiKey || !!process.env.SERPER_API_KEY,
        apiKey: config.serperApiKey || process.env.SERPER_API_KEY,
        search: this.serperSearch.bind(this),
      },
    };

    // Determine active provider (first available real API, or mock)
    this.activeProvider = this.determineActiveProvider(config.preferredProvider);
  }

  determineActiveProvider(preferred) {
    if (preferred && this.providers[preferred]?.available) {
      return this.providers[preferred];
    }

    // Try real providers in order of preference
    const preferenceOrder = ['serper', 'brave', 'google'];
    for (const name of preferenceOrder) {
      if (this.providers[name].available) {
        console.log(`[RESEARCH] Using ${name} search provider`);
        return this.providers[name];
      }
    }

    console.log('[RESEARCH] No real search API configured, using mock data');
    return this.providers.mock;
  }

  /**
   * Perform a web search
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results to return
   * @returns {Promise<Object[]>} Search results
   */
  async search(query, maxResults = 5) {
    return this.activeProvider.search(query, maxResults);
  }

  /**
   * Mock search for testing (returns realistic-looking data)
   */
  async mockSearch(query, maxResults) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    const mockResults = this.generateMockResults(query, maxResults);
    return mockResults;
  }

  /**
   * Generate mock search results based on query
   */
  generateMockResults(query, maxResults) {
    const queryLower = query.toLowerCase();
    const results = [];

    // Generate contextual mock results
    const templates = [
      {
        condition: q => q.includes('best practices'),
        results: [
          { title: 'Industry Best Practices Guide', domain: 'docs.example.com', relevance: 'high' },
          { title: 'Professional Standards Handbook', domain: 'standards.io', relevance: 'high' },
          { title: 'Expert Tips and Techniques', domain: 'expertguide.com', relevance: 'medium' },
        ],
      },
      {
        condition: q => q.includes('performance') || q.includes('optimization'),
        results: [
          { title: 'Performance Optimization Techniques', domain: 'perf.dev', relevance: 'high' },
          { title: 'Speed and Efficiency Guide', domain: 'fastcode.io', relevance: 'high' },
          { title: 'Benchmarking and Profiling', domain: 'benchmark.tools', relevance: 'medium' },
        ],
      },
      {
        condition: q => q.includes('error') || q.includes('troubleshooting'),
        results: [
          { title: 'Common Errors and Solutions', domain: 'troubleshoot.dev', relevance: 'high' },
          { title: 'Debugging Guide', domain: 'debug.io', relevance: 'high' },
          { title: 'Error Handling Patterns', domain: 'patterns.dev', relevance: 'medium' },
        ],
      },
      {
        condition: q => q.includes('testing') || q.includes('quality'),
        results: [
          { title: 'Testing Best Practices', domain: 'testing.guide', relevance: 'high' },
          { title: 'Quality Assurance Handbook', domain: 'qa.expert', relevance: 'high' },
          { title: 'Automated Testing Strategies', domain: 'autotest.io', relevance: 'medium' },
        ],
      },
    ];

    // Find matching template or use generic
    const matchedTemplate = templates.find(t => t.condition(queryLower));
    const templateResults = matchedTemplate?.results || [
      { title: `Guide to ${query}`, domain: 'docs.example.com', relevance: 'high' },
      { title: `${query} - Expert Insights`, domain: 'insights.io', relevance: 'medium' },
      { title: `Understanding ${query}`, domain: 'learn.dev', relevance: 'medium' },
    ];

    for (let i = 0; i < Math.min(maxResults, templateResults.length); i++) {
      const template = templateResults[i];
      results.push({
        title: template.title,
        url: `https://${template.domain}/${query.replace(/\s+/g, '-').toLowerCase()}`,
        snippet: `Comprehensive guide covering ${query}. Learn the key concepts, best practices, and practical techniques for success.`,
        relevance: template.relevance,
        source: 'mock',
      });
    }

    return results;
  }

  /**
   * Google Custom Search API
   */
  async googleSearch(query, maxResults) {
    const provider = this.providers.google;
    if (!provider.available) {
      throw new Error('Google Search API not configured');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?key=${provider.apiKey}&cx=${provider.searchEngineId}&q=${encodeURIComponent(query)}&num=${maxResults}`
      );

      if (!response.ok) {
        throw new Error(`Google Search API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.items || []).map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        relevance: 'medium', // Could be enhanced with relevance scoring
        source: 'google',
      }));
    } catch (error) {
      console.error('[RESEARCH] Google Search error:', error.message);
      return this.mockSearch(query, maxResults); // Fallback to mock
    }
  }

  /**
   * Brave Search API
   */
  async braveSearch(query, maxResults) {
    const provider = this.providers.brave;
    if (!provider.available) {
      throw new Error('Brave Search API not configured');
    }

    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
        {
          headers: {
            'X-Subscription-Token': provider.apiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.web?.results || []).map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.description,
        relevance: 'medium',
        source: 'brave',
      }));
    } catch (error) {
      console.error('[RESEARCH] Brave Search error:', error.message);
      return this.mockSearch(query, maxResults);
    }
  }

  /**
   * Serper.dev Search API
   */
  async serperSearch(query, maxResults) {
    const provider = this.providers.serper;
    if (!provider.available) {
      throw new Error('Serper API not configured');
    }

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': provider.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: maxResults,
        }),
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.organic || []).map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        relevance: item.position <= 3 ? 'high' : 'medium',
        source: 'serper',
      }));
    } catch (error) {
      console.error('[RESEARCH] Serper Search error:', error.message);
      return this.mockSearch(query, maxResults);
    }
  }

  /**
   * Get current provider info
   */
  getProviderInfo() {
    return {
      active: this.activeProvider.name,
      available: Object.entries(this.providers)
        .filter(([, p]) => p.available)
        .map(([name]) => name),
    };
  }
}

// ============================================================================
// DEEP RESEARCH FUNCTION
// ============================================================================

/**
 * Perform deep research on topics using web search
 * @param {string[]} topics - Topics to research
 * @param {Object} options - Research options
 * @param {'quick'|'standard'|'deep'} options.depth - Research depth
 * @param {number} options.maxSources - Max sources per topic
 * @param {WebSearchProvider} options.searchProvider - Search provider instance
 * @returns {Promise<ResearchResult[]>} Research findings
 */
async function deepResearch(topics, options = { depth: 'deep', maxSources: 5 }) {
  const depth = RESEARCH_DEPTHS[options.depth] || RESEARCH_DEPTHS.deep;
  const maxSources = options.maxSources || depth.maxSources;
  const searchProvider = options.searchProvider || new WebSearchProvider();

  const results = [];
  const limitedTopics = topics.slice(0, depth.maxTopics);

  console.log(`[RESEARCH] Starting ${options.depth || 'deep'} research on ${limitedTopics.length} topics`);

  for (const topic of limitedTopics) {
    try {
      // Search for the topic
      const searchResults = await searchProvider.search(topic, maxSources);

      // Process and synthesize results
      const result = synthesizeResearchResult(topic, searchResults);
      results.push(result);

      console.log(`[RESEARCH] Completed research on: ${topic.substring(0, 50)}...`);

    } catch (error) {
      console.error(`[RESEARCH] Error researching "${topic}":`, error.message);
      results.push({
        topic,
        summary: 'Research could not be completed due to an error',
        keyInsights: [],
        sources: [],
        applicability: 'Unable to determine applicability',
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Synthesize search results into a structured ResearchResult
 */
function synthesizeResearchResult(topic, searchResults) {
  // Extract key insights from snippets
  const keyInsights = [];
  const sources = [];

  for (const result of searchResults) {
    // Add source
    sources.push({
      url: result.url,
      title: result.title,
      relevance: result.relevance || 'medium',
    });

    // Extract potential insights from snippet
    if (result.snippet) {
      const insight = extractInsightFromSnippet(result.snippet, topic);
      if (insight && !keyInsights.includes(insight)) {
        keyInsights.push(insight);
      }
    }
  }

  // Generate summary
  const summary = generateResearchSummary(topic, searchResults, keyInsights);

  // Generate applicability guidance
  const applicability = generateApplicability(topic, keyInsights);

  return {
    topic,
    summary,
    keyInsights: keyInsights.slice(0, 5),
    sources,
    applicability,
    researchedAt: new Date().toISOString(),
  };
}

/**
 * Extract an insight from a search result snippet
 */
function extractInsightFromSnippet(snippet, topic) {
  // Simple extraction: take meaningful sentences
  const sentences = snippet.split(/[.!?]+/).filter(s => s.trim().length > 20);

  if (sentences.length === 0) return null;

  // Return the most relevant sentence
  return sentences[0].trim() + '.';
}

/**
 * Generate a summary from research results
 */
function generateResearchSummary(topic, searchResults, insights) {
  const sourceCount = searchResults.length;
  const highRelevance = searchResults.filter(r => r.relevance === 'high').length;

  let summary = `Research on "${topic}" yielded ${sourceCount} sources`;

  if (highRelevance > 0) {
    summary += ` (${highRelevance} highly relevant)`;
  }

  summary += '. ';

  if (insights.length > 0) {
    summary += `Key findings include: ${insights.slice(0, 2).join(' ')}`;
  } else {
    summary += 'Further investigation may be needed for actionable insights.';
  }

  return summary;
}

/**
 * Generate applicability guidance for the research
 */
function generateApplicability(topic, insights) {
  const topicLower = topic.toLowerCase();

  if (topicLower.includes('best practices')) {
    return 'Apply these best practices to improve consistency and quality in task execution.';
  }

  if (topicLower.includes('performance') || topicLower.includes('optimization')) {
    return 'Use these optimization techniques to reduce task completion time and improve efficiency.';
  }

  if (topicLower.includes('error') || topicLower.includes('troubleshooting')) {
    return 'Reference these solutions when encountering similar errors to reduce failure rate.';
  }

  if (topicLower.includes('testing') || topicLower.includes('quality')) {
    return 'Incorporate these quality practices to improve deliverable quality scores.';
  }

  return 'Integrate these insights into Knowledge instructions for improved task performance.';
}

// ============================================================================
// PATTERN ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze failure patterns from task history
 * @param {Object[]} taskHistory - Task history records
 * @returns {FailurePattern[]} Common failure patterns
 */
function analyzeFailurePatterns(taskHistory) {
  if (!taskHistory || taskHistory.length === 0) {
    return [];
  }

  const patterns = [];
  const failedTasks = taskHistory.filter(t =>
    t.status === 'failed' || t.status === 'rejected' || t.success === false
  );

  if (failedTasks.length === 0) {
    return [];
  }

  // Group failures by category
  const categoryFailures = {};
  const reasonCounts = {};

  for (const task of failedTasks) {
    const category = task.task_category || task.metadata?.category || 'general';
    const reason = task.failure_reason || task.metadata?.failure_reason || 'unspecified';

    if (!categoryFailures[category]) {
      categoryFailures[category] = { count: 0, tasks: [], reasons: [] };
    }
    categoryFailures[category].count++;
    categoryFailures[category].tasks.push(task);
    categoryFailures[category].reasons.push(reason);

    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }

  // Create patterns for categories with multiple failures
  for (const [category, data] of Object.entries(categoryFailures)) {
    if (data.count >= 2) {
      const uniqueReasons = [...new Set(data.reasons)].slice(0, 5);
      const frequency = data.count / taskHistory.length;
      const confidence = Math.min(0.9, 0.5 + (frequency * 0.5));

      patterns.push({
        type: 'category_failure',
        category,
        frequency: data.count,
        commonReasons: uniqueReasons,
        confidence,
        data: {
          total_category_failures: data.count,
          total_tasks: taskHistory.length,
          failure_rate: (data.count / taskHistory.length).toFixed(2),
        },
      });
    }
  }

  // Find most common failure reasons
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topReasons.length > 0 && topReasons[0][1] >= 2) {
    patterns.push({
      type: 'repeated_reason',
      category: 'cross_category',
      frequency: topReasons[0][1],
      commonReasons: topReasons.map(([reason]) => reason),
      confidence: Math.min(0.85, 0.4 + (topReasons[0][1] / failedTasks.length) * 0.5),
      data: {
        reason_counts: Object.fromEntries(topReasons),
      },
    });
  }

  return patterns;
}

/**
 * Analyze success patterns from task history
 * @param {Object[]} taskHistory - Task history records
 * @returns {SuccessPattern[]} Success patterns to reinforce
 */
function analyzeSuccessPatterns(taskHistory) {
  if (!taskHistory || taskHistory.length === 0) {
    return [];
  }

  const patterns = [];
  const successTasks = taskHistory.filter(t =>
    t.status === 'completed' || t.status === 'success' || t.success === true
  );

  if (successTasks.length === 0) {
    return [];
  }

  // Group successes by category
  const categorySuccesses = {};

  for (const task of successTasks) {
    const category = task.task_category || task.metadata?.category || 'general';

    if (!categorySuccesses[category]) {
      categorySuccesses[category] = {
        count: 0,
        tasks: [],
        avgTime: 0,
        avgQuality: 0,
        tools: [],
      };
    }

    const data = categorySuccesses[category];
    data.count++;
    data.tasks.push(task);

    if (task.time_taken_seconds) {
      data.avgTime = (data.avgTime * (data.count - 1) + task.time_taken_seconds) / data.count;
    }

    if (task.quality_score) {
      data.avgQuality = (data.avgQuality * (data.count - 1) + parseFloat(task.quality_score)) / data.count;
    }

    if (task.tools_used && Array.isArray(task.tools_used)) {
      data.tools.push(...task.tools_used);
    }
  }

  // Create patterns for high-performing categories
  const totalTasks = taskHistory.length;
  for (const [category, data] of Object.entries(categorySuccesses)) {
    const successRate = data.count / totalTasks;

    if (successRate >= 0.6 && data.count >= 3) {
      // Identify contributing factors
      const contributingFactors = [];

      if (data.avgQuality >= 0.8) {
        contributingFactors.push('high quality scores');
      }

      if (data.avgTime < 300) { // Under 5 minutes average
        contributingFactors.push('efficient completion time');
      }

      // Find common tools
      const toolCounts = {};
      for (const tool of data.tools) {
        toolCounts[tool] = (toolCounts[tool] || 0) + 1;
      }
      const commonTools = Object.entries(toolCounts)
        .filter(([, count]) => count >= 2)
        .map(([tool]) => tool);

      if (commonTools.length > 0) {
        contributingFactors.push(`effective use of ${commonTools.slice(0, 2).join(', ')}`);
      }

      patterns.push({
        type: 'category_success',
        category,
        frequency: data.count,
        contributingFactors,
        confidence: Math.min(0.9, successRate),
        data: {
          success_count: data.count,
          success_rate: successRate.toFixed(2),
          avg_quality: data.avgQuality.toFixed(2),
          avg_time_seconds: Math.round(data.avgTime),
          common_tools: commonTools,
        },
      });
    }
  }

  return patterns;
}

// ============================================================================
// RESEARCH CYCLE ORCHESTRATOR
// ============================================================================

/**
 * Run full research cycle for a Knowledge Bot
 * @param {KnowledgeBotConfig} bot - Knowledge Bot configuration
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Research cycle results
 */
async function runKnowledgeBotResearchCycle(bot, options = {}) {
  console.log(`[RESEARCH] Starting research cycle for Knowledge Bot: ${bot.bot_id}`);

  const supabase = options.supabase || initializeSupabase(options);
  const searchProvider = options.searchProvider || new WebSearchProvider(options);

  const cycleResult = {
    botId: bot.bot_id,
    teamLeadRole: bot.team_lead_role,
    teamId: bot.team_id,
    startedAt: new Date().toISOString(),
    subordinateResearch: [],
    errors: [],
  };

  // Get all subordinates in the team
  const subordinates = bot.subordinates || [];

  for (const subordinateRole of subordinates) {
    try {
      console.log(`[RESEARCH] Researching improvements for: ${subordinateRole}`);

      // 1. Get current Knowledge instructions
      const currentKnowledge = await getSubordinateKnowledge(supabase, subordinateRole);

      // 2. Get recent task history
      const taskHistory = await getSubordinateTaskHistory(supabase, subordinateRole, 30);

      if (taskHistory.length < 3) {
        console.log(`[RESEARCH] Insufficient task history for ${subordinateRole} (${taskHistory.length} tasks)`);
        cycleResult.subordinateResearch.push({
          subordinate: subordinateRole,
          status: 'insufficient_data',
          tasksFound: taskHistory.length,
        });
        continue;
      }

      // 3. Analyze patterns
      const failurePatterns = analyzeFailurePatterns(taskHistory);
      const successPatterns = analyzeSuccessPatterns(taskHistory);

      // 4. Build research topics
      const specialty = SPECIALTY_DOMAINS[subordinateRole] || subordinateRole;
      const focusAreas = bot.focus_areas?.[subordinateRole] || [];

      const topics = buildResearchTopics(
        specialty,
        failurePatterns,
        currentKnowledge,
        focusAreas
      );

      // 5. Run deep research
      const researchResults = await deepResearch(topics, {
        depth: bot.research_config?.depth || 'standard',
        maxSources: bot.research_config?.maxSources || 5,
        searchProvider,
      });

      // 6. Store research results
      await storeResearchResults(supabase, {
        botId: bot.bot_id,
        subordinateRole,
        researchResults,
        failurePatterns,
        successPatterns,
        topics,
      });

      cycleResult.subordinateResearch.push({
        subordinate: subordinateRole,
        specialty,
        status: 'completed',
        topicsResearched: topics.length,
        failurePatternsFound: failurePatterns.length,
        successPatternsFound: successPatterns.length,
        researchResults,
      });

      console.log(`[RESEARCH] Completed research for ${subordinateRole}: ${topics.length} topics, ${researchResults.length} results`);

    } catch (error) {
      console.error(`[RESEARCH] Error researching ${subordinateRole}:`, error.message);
      cycleResult.errors.push({
        subordinate: subordinateRole,
        error: error.message,
      });
      cycleResult.subordinateResearch.push({
        subordinate: subordinateRole,
        status: 'error',
        error: error.message,
      });
    }
  }

  cycleResult.completedAt = new Date().toISOString();
  cycleResult.success = cycleResult.errors.length === 0;

  console.log(`[RESEARCH] Research cycle completed for ${bot.bot_id}: ${cycleResult.subordinateResearch.length} subordinates processed`);

  return cycleResult;
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Initialize Supabase client
 */
function initializeSupabase(config = {}) {
  const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
  const supabaseKey = config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration required');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: true, persistSession: false },
  });
}

/**
 * Get subordinate's current knowledge
 */
async function getSubordinateKnowledge(supabase, subordinateRole) {
  try {
    const { data, error } = await supabase
      .from('monolith_knowledge_layer')
      .select('effective_knowledge')
      .eq('agent_role', subordinateRole)
      .single();

    if (error) return null;
    return data?.effective_knowledge || null;
  } catch {
    return null;
  }
}

/**
 * Get subordinate's task history
 */
async function getSubordinateTaskHistory(supabase, subordinateRole, days = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Try monolith_task_history first, fallback to tasks
    let { data, error } = await supabase
      .from('monolith_task_history')
      .select('*')
      .eq('agent_role', subordinateRole)
      .gte('completed_at', cutoffDate.toISOString())
      .order('completed_at', { ascending: false })
      .limit(100);

    if (error || !data || data.length === 0) {
      // Fallback to tasks table
      const tasksResult = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', subordinateRole)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      data = tasksResult.data || [];
    }

    return data;
  } catch {
    return [];
  }
}

/**
 * Store research results in database
 */
async function storeResearchResults(supabase, data) {
  try {
    const { error } = await supabase
      .from('knowledge_bot_research')
      .insert([{
        bot_id: data.botId,
        subordinate_role: data.subordinateRole,
        research_results: data.researchResults,
        failure_patterns: data.failurePatterns,
        success_patterns: data.successPatterns,
        topics_researched: data.topics,
        researched_at: new Date().toISOString(),
      }]);

    if (error) {
      // Table might not exist - log but don't fail
      if (error.code === '42P01') {
        console.log('[RESEARCH] knowledge_bot_research table not found, results stored in memory only');
        return { stored: false, reason: 'table_not_found' };
      }
      console.warn('[RESEARCH] Error storing research results:', error.message);
      return { stored: false, reason: error.message };
    }

    return { stored: true };
  } catch (error) {
    console.warn('[RESEARCH] Error storing research results:', error.message);
    return { stored: false, reason: error.message };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Research topic builder
  buildResearchTopics,

  // Deep research function
  deepResearch,

  // Pattern analysis
  analyzeFailurePatterns,
  analyzeSuccessPatterns,

  // Research cycle orchestrator
  runKnowledgeBotResearchCycle,

  // Web search provider class
  WebSearchProvider,

  // Constants
  RESEARCH_DEPTHS,
  SPECIALTY_DOMAINS,

  // Helper functions (for testing)
  synthesizeResearchResult,
  extractInsightFromSnippet,
  generateResearchSummary,
  generateApplicability,

  // Database helpers
  getSubordinateKnowledge,
  getSubordinateTaskHistory,
  storeResearchResults,
};

export default {
  buildResearchTopics,
  deepResearch,
  analyzeFailurePatterns,
  analyzeSuccessPatterns,
  runKnowledgeBotResearchCycle,
  WebSearchProvider,
  RESEARCH_DEPTHS,
  SPECIALTY_DOMAINS,
};
