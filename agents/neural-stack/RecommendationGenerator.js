/**
 * RECOMMENDATION GENERATOR - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Generates targeted recommendations for subordinates based on:
 * - Current knowledge instructions
 * - Active amendments
 * - Recent failure patterns
 * - Recent success patterns
 * - Research findings
 *
 * ARCHITECTURE:
 * - Knowledge Bots generate exactly 2 recommendations per subordinate
 * - Recommendations must be specific, actionable, and research-backed
 * - Subordinates select recommendations to convert to amendments
 * - Unselected recommendations expire after 7 days
 */

import { createClient } from '@supabase/supabase-js';
import { AmendmentEngine } from './AmendmentEngine.js';

// ============================================================================
// PROMPT TEMPLATE
// ============================================================================

/**
 * Prompt template for generating recommendations
 * @param {string} team - Team name (e.g., 'tech', 'marketing')
 * @param {Object} subordinate - Subordinate info { role, specialty }
 * @param {string} currentKnowledge - Current knowledge instructions text
 * @param {string} activeAmendments - Active amendments text
 * @param {string} failurePatterns - Recent failure patterns text
 * @param {string} successPatterns - Recent success patterns text
 * @param {string} researchResults - Research findings text
 * @returns {string} Formatted prompt
 */
const RECOMMENDATION_GENERATION_PROMPT = (team, subordinate, currentKnowledge, activeAmendments, failurePatterns, successPatterns, researchResults) => `
You are the Knowledge Bot for the ${team} team at Cognalith Inc.

SUBORDINATE: ${subordinate.role}
SPECIALTY: ${subordinate.specialty}

CURRENT KNOWLEDGE INSTRUCTIONS:
${currentKnowledge}

ACTIVE AMENDMENTS:
${activeAmendments}

RECENT FAILURE PATTERNS:
${failurePatterns}

RECENT SUCCESS PATTERNS:
${successPatterns}

RESEARCH FINDINGS:
${researchResults}

Generate exactly 2 recommendations to improve this agent's performance.

For each recommendation:
1. Identify the specific pattern it addresses
2. Write the exact instruction/knowledge to add or modify
3. Estimate impact (high/medium/low) with reasoning
4. Cite the research sources that inform this recommendation

Format as JSON:
{
  "recommendations": [
    {
      "type": "knowledge_addition" | "knowledge_modification" | "skill_suggestion",
      "content": "The exact instruction text",
      "targetingPattern": "What failure pattern this addresses",
      "expectedImpact": "high" | "medium" | "low",
      "reasoning": "Why this will help",
      "sources": ["url1", "url2"]
    }
  ]
}

CONSTRAINTS:
- Recommendations must be specific and actionable
- Do not recommend what's already in active amendments
- Prioritize high-impact recommendations
- Content should be concise (under 200 words per recommendation)
`;

// ============================================================================
// VALIDATION RULES
// ============================================================================

const VALIDATION_RULES = Object.freeze({
  MAX_CONTENT_WORDS: 200,
  REQUIRED_FIELDS: ['type', 'content', 'targetingPattern', 'expectedImpact', 'reasoning', 'sources'],
  VALID_TYPES: ['knowledge_addition', 'knowledge_modification', 'skill_suggestion'],
  VALID_IMPACTS: ['high', 'medium', 'low'],
  EXPIRATION_DAYS: 7,
  RECOMMENDATIONS_PER_GENERATION: 2,
});

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} Recommendation
 * @property {string} id - UUID
 * @property {string} subordinateRole - Target subordinate role
 * @property {'knowledge_addition'|'knowledge_modification'|'skill_suggestion'} type
 * @property {string} content - The instruction/knowledge content
 * @property {string} targetingPattern - Pattern this addresses
 * @property {'high'|'medium'|'low'} expectedImpact
 * @property {string} reasoning - Why this helps
 * @property {string[]} sources - Research source URLs
 * @property {'pending'|'selected'|'expired'|'rejected'} status
 * @property {string|null} amendmentId - Linked amendment if selected
 * @property {string} createdAt
 * @property {string|null} expiresAt
 */

/**
 * @typedef {Object} ResearchResult
 * @property {string} url - Source URL
 * @property {string} title - Source title
 * @property {string} summary - Key finding summary
 * @property {string} relevance - Why it's relevant
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 */

// ============================================================================
// RECOMMENDATION GENERATOR CLASS
// ============================================================================

/**
 * Recommendation Generator
 * Generates targeted recommendations for subordinate performance improvement
 */
class RecommendationGenerator {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.amendmentEngine = null;
    this.initialize(config);
  }

  initialize(config) {
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: true, persistSession: false },
      });
      this.isConnected = true;
      this.amendmentEngine = new AmendmentEngine(config);
      console.log('[RECOMMENDATION-GEN] Connected to Supabase');
    } else {
      console.warn('[RECOMMENDATION-GEN] Running in offline mode - no Supabase credentials');
    }
  }

  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ============================================================================
  // CORE GENERATION FUNCTION
  // ============================================================================

  /**
   * Generate recommendations for a subordinate
   * @param {string} subordinateRole - Target subordinate role
   * @param {string} currentKnowledge - Current knowledge instructions
   * @param {ResearchResult[]} researchResults - Research findings
   * @param {Object[]} failurePatterns - Recent failure patterns
   * @param {Object[]} successPatterns - Recent success patterns
   * @param {number} count - Number of recommendations (always 2)
   * @returns {Promise<Recommendation[]>}
   */
  async generateRecommendations(
    subordinateRole,
    currentKnowledge,
    researchResults,
    failurePatterns,
    successPatterns,
    count = 2
  ) {
    if (!this.isAvailable()) {
      return {
        data: [],
        error: { message: 'Database unavailable' },
      };
    }

    // Get subordinate info
    const subordinateInfo = await this.getSubordinateInfo(subordinateRole);
    if (!subordinateInfo) {
      return {
        data: [],
        error: { message: `Unknown subordinate role: ${subordinateRole}` },
      };
    }

    // Get active amendments to avoid duplication
    const { data: activeAmendments } = await this.getActiveAmendments(subordinateRole);
    const activeAmendmentsText = this.formatActiveAmendments(activeAmendments || []);

    // Format inputs for prompt
    const failurePatternsText = this.formatPatterns(failurePatterns, 'failure');
    const successPatternsText = this.formatPatterns(successPatterns, 'success');
    const researchText = this.formatResearchResults(researchResults);

    // Build prompt
    const prompt = RECOMMENDATION_GENERATION_PROMPT(
      subordinateInfo.team,
      { role: subordinateRole, specialty: subordinateInfo.specialty },
      currentKnowledge || 'No specific knowledge instructions.',
      activeAmendmentsText,
      failurePatternsText,
      successPatternsText,
      researchText
    );

    // Generate recommendations (simulated - in production this would call an LLM)
    const generatedRecs = await this.callLLMForRecommendations(prompt, count);

    // Validate and store each recommendation
    const validatedRecommendations = [];
    const validationErrors = [];

    for (const rec of generatedRecs) {
      const validation = this.validateRecommendation(rec, subordinateRole, activeAmendments);

      if (validation.valid) {
        const { data: stored, error } = await this.storeRecommendation({
          ...rec,
          subordinateRole,
          team: subordinateInfo.team,
        });

        if (error) {
          validationErrors.push(`Storage error: ${error.message}`);
        } else {
          validatedRecommendations.push(stored);
        }
      } else {
        validationErrors.push(...validation.errors);
      }
    }

    console.log(`[RECOMMENDATION-GEN] Generated ${validatedRecommendations.length} recommendations for ${subordinateRole}`);

    return {
      data: validatedRecommendations,
      errors: validationErrors.length > 0 ? validationErrors : null,
    };
  }

  /**
   * Call LLM to generate recommendations (placeholder - integrate with actual LLM)
   * @param {string} prompt - The generation prompt
   * @param {number} count - Number of recommendations
   * @returns {Promise<Object[]>} Generated recommendations
   */
  async callLLMForRecommendations(prompt, count) {
    // In production, this would call Claude API or another LLM
    // For now, return a structured placeholder that can be filled by the caller
    console.log('[RECOMMENDATION-GEN] LLM call would be made with prompt length:', prompt.length);

    // Return empty array - actual LLM integration should be added
    // The caller can override this method or provide pre-generated recommendations
    return [];
  }

  // ============================================================================
  // RECOMMENDATION STORAGE
  // ============================================================================

  /**
   * Store recommendation in database
   * @param {Object} recommendation - Recommendation to store
   * @returns {Promise<{data: Recommendation|null, error: Object|null}>}
   */
  async storeRecommendation(recommendation) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + VALIDATION_RULES.EXPIRATION_DAYS);

    const { data, error } = await this.supabase
      .from('recommendations')
      .insert([{
        subordinate_role: recommendation.subordinateRole,
        team: recommendation.team,
        type: recommendation.type,
        content: recommendation.content,
        targeting_pattern: recommendation.targetingPattern,
        expected_impact: recommendation.expectedImpact,
        reasoning: recommendation.reasoning,
        sources: recommendation.sources,
        status: 'pending',
        amendment_id: null,
        expires_at: expiresAt.toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('[RECOMMENDATION-GEN] Error storing recommendation:', error.message);
      return { data: null, error };
    }

    console.log(`[RECOMMENDATION-GEN] Stored recommendation ${data.id} for ${recommendation.subordinateRole}`);

    return {
      data: this.mapDbToRecommendation(data),
      error: null,
    };
  }

  // ============================================================================
  // RECOMMENDATION VALIDATION
  // ============================================================================

  /**
   * Validate recommendation meets constraints
   * @param {Object} rec - Recommendation to validate
   * @param {string} subordinateRole - Target subordinate
   * @param {Object[]} activeAmendments - Currently active amendments (optional)
   * @returns {ValidationResult}
   */
  validateRecommendation(rec, subordinateRole, activeAmendments = []) {
    const errors = [];

    // Check required fields
    for (const field of VALIDATION_RULES.REQUIRED_FIELDS) {
      if (!rec[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate type
    if (rec.type && !VALIDATION_RULES.VALID_TYPES.includes(rec.type)) {
      errors.push(`Invalid type: ${rec.type}. Must be one of: ${VALIDATION_RULES.VALID_TYPES.join(', ')}`);
    }

    // Validate expectedImpact
    if (rec.expectedImpact && !VALIDATION_RULES.VALID_IMPACTS.includes(rec.expectedImpact)) {
      errors.push(`Invalid expectedImpact: ${rec.expectedImpact}. Must be one of: ${VALIDATION_RULES.VALID_IMPACTS.join(', ')}`);
    }

    // Check content word count
    if (rec.content) {
      const wordCount = rec.content.split(/\s+/).filter(Boolean).length;
      if (wordCount > VALIDATION_RULES.MAX_CONTENT_WORDS) {
        errors.push(`Content exceeds ${VALIDATION_RULES.MAX_CONTENT_WORDS} words (has ${wordCount})`);
      }
    }

    // Check for duplication with active amendments
    if (activeAmendments && activeAmendments.length > 0) {
      const isDuplicate = activeAmendments.some(amendment => {
        // Check if targeting the same pattern
        if (amendment.trigger_pattern && rec.targetingPattern) {
          const amendmentPattern = amendment.trigger_pattern.toLowerCase();
          const recPattern = rec.targetingPattern.toLowerCase();
          return amendmentPattern.includes(recPattern) || recPattern.includes(amendmentPattern);
        }
        return false;
      });

      if (isDuplicate) {
        errors.push('Recommendation duplicates an active amendment');
      }
    }

    // Check that targetingPattern references a documented failure pattern
    // (This would require access to pattern data - for now, check it's not empty)
    if (rec.targetingPattern && rec.targetingPattern.trim().length < 3) {
      errors.push('targetingPattern must be a meaningful pattern description');
    }

    // Check that sources are provided
    if (!rec.sources || !Array.isArray(rec.sources) || rec.sources.length === 0) {
      errors.push('At least one research source must be cited');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================================
  // RECOMMENDATION SELECTION
  // ============================================================================

  /**
   * Select recommendation and convert to amendment
   * @param {string} subordinateRole - Role of the subordinate selecting
   * @param {string} recommendationId - ID of the recommendation
   * @returns {Promise<{data: Object|null, error: Object|null}>}
   */
  async selectRecommendationForAmendment(subordinateRole, recommendationId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    // Get the recommendation
    const { data: recommendation, error: fetchError } = await this.supabase
      .from('recommendations')
      .select('*')
      .eq('id', recommendationId)
      .single();

    if (fetchError || !recommendation) {
      return { data: null, error: { message: 'Recommendation not found' } };
    }

    // Verify status is 'pending'
    if (recommendation.status !== 'pending') {
      return {
        data: null,
        error: { message: `Cannot select recommendation with status: ${recommendation.status}` },
      };
    }

    // Verify recommendation is for this subordinate
    if (recommendation.subordinate_role !== subordinateRole) {
      return {
        data: null,
        error: { message: 'Recommendation is not for this subordinate' },
      };
    }

    // Check if not expired
    if (recommendation.expires_at && new Date(recommendation.expires_at) < new Date()) {
      // Mark as expired
      await this.supabase
        .from('recommendations')
        .update({ status: 'expired' })
        .eq('id', recommendationId);

      return { data: null, error: { message: 'Recommendation has expired' } };
    }

    // Convert to amendment via AmendmentEngine
    const amendment = {
      amendment_type: this.mapRecommendationTypeToAmendmentType(recommendation.type),
      trigger_pattern: `recommendation:${recommendation.targeting_pattern}`,
      instruction_delta: recommendation.content,
      knowledge_mutation: {
        recommendation_source: {
          recommendation_id: recommendationId,
          type: recommendation.type,
          expected_impact: recommendation.expected_impact,
          sources: recommendation.sources,
        },
        category_guidance: {
          [recommendation.targeting_pattern]: {
            instruction: recommendation.content,
            reasoning: recommendation.reasoning,
          },
        },
      },
      source_pattern: {
        type: 'recommendation',
        recommendation_id: recommendationId,
        targeting_pattern: recommendation.targeting_pattern,
      },
      pattern_confidence: this.getConfidenceFromImpact(recommendation.expected_impact),
    };

    // Create amendment (will be auto-approved or pending based on AmendmentEngine config)
    const { data: createdAmendment, error: amendmentError } = await this.amendmentEngine.createAmendment(
      subordinateRole,
      amendment,
      null // Let AmendmentEngine decide on auto-approval
    );

    if (amendmentError) {
      return { data: null, error: amendmentError };
    }

    // Mark recommendation as 'selected' and link to amendment
    const { error: updateError } = await this.supabase
      .from('recommendations')
      .update({
        status: 'selected',
        amendment_id: createdAmendment.id,
        selected_at: new Date().toISOString(),
      })
      .eq('id', recommendationId);

    if (updateError) {
      console.error('[RECOMMENDATION-GEN] Error updating recommendation status:', updateError.message);
    }

    console.log(`[RECOMMENDATION-GEN] Recommendation ${recommendationId} selected, created amendment ${createdAmendment.id}`);

    return {
      data: {
        recommendation: this.mapDbToRecommendation({ ...recommendation, status: 'selected', amendment_id: createdAmendment.id }),
        amendment: createdAmendment,
      },
      error: null,
    };
  }

  // ============================================================================
  // EXPIRATION HANDLING
  // ============================================================================

  /**
   * Mark expired recommendations (older than 7 days, still pending)
   * @returns {Promise<{count: number, error: Object|null}>}
   */
  async expireOldRecommendations() {
    if (!this.isAvailable()) {
      return { count: 0, error: { message: 'Database unavailable' } };
    }

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('recommendations')
      .update({
        status: 'expired',
        expired_at: now,
      })
      .eq('status', 'pending')
      .lt('expires_at', now)
      .select('id');

    if (error) {
      console.error('[RECOMMENDATION-GEN] Error expiring recommendations:', error.message);
      return { count: 0, error };
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[RECOMMENDATION-GEN] Expired ${count} old recommendations`);
    }

    return { count, error: null };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get subordinate information
   * @param {string} role - Subordinate role
   * @returns {Promise<{team: string, specialty: string}|null>}
   */
  async getSubordinateInfo(role) {
    // Check team lead configurations for subordinate mapping
    const TEAM_MAPPING = {
      // Tech team
      web_dev_lead: { team: 'tech', specialty: 'Web Development' },
      app_dev_lead: { team: 'tech', specialty: 'Application Development' },
      devops_lead: { team: 'tech', specialty: 'DevOps & Infrastructure' },
      qa_lead: { team: 'tech', specialty: 'Quality Assurance' },
      infrastructure_lead: { team: 'tech', specialty: 'Infrastructure Management' },
      // Marketing team
      content_lead: { team: 'marketing', specialty: 'Content Creation' },
      social_media_lead: { team: 'marketing', specialty: 'Social Media Management' },
      seo_growth_lead: { team: 'marketing', specialty: 'SEO & Growth' },
      brand_lead: { team: 'marketing', specialty: 'Brand Management' },
      // Product team
      ux_research_lead: { team: 'product', specialty: 'UX Research' },
      product_analytics_lead: { team: 'product', specialty: 'Product Analytics' },
      feature_spec_lead: { team: 'product', specialty: 'Feature Specification' },
      // Operations team
      vendor_management_lead: { team: 'operations', specialty: 'Vendor Management' },
      process_automation_lead: { team: 'operations', specialty: 'Process Automation' },
      // Finance team
      expense_tracking_lead: { team: 'finance', specialty: 'Expense Tracking' },
      revenue_analytics_lead: { team: 'finance', specialty: 'Revenue Analytics' },
      // People team
      hiring_lead: { team: 'people', specialty: 'Recruitment' },
      compliance_lead: { team: 'people', specialty: 'HR Compliance' },
    };

    return TEAM_MAPPING[role] || null;
  }

  /**
   * Get active amendments for a subordinate
   * @param {string} subordinateRole - Subordinate role
   * @returns {Promise<{data: Object[], error: Object|null}>}
   */
  async getActiveAmendments(subordinateRole) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_amendments')
      .select('*')
      .eq('agent_role', subordinateRole)
      .eq('is_active', true);

    return { data: data || [], error };
  }

  /**
   * Get pending recommendations for a subordinate
   * @param {string} subordinateRole - Subordinate role
   * @returns {Promise<{data: Recommendation[], error: Object|null}>}
   */
  async getPendingRecommendations(subordinateRole) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('recommendations')
      .select('*')
      .eq('subordinate_role', subordinateRole)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error };
    }

    return {
      data: (data || []).map(this.mapDbToRecommendation),
      error: null,
    };
  }

  /**
   * Format active amendments for prompt
   * @param {Object[]} amendments - Active amendments
   * @returns {string}
   */
  formatActiveAmendments(amendments) {
    if (!amendments || amendments.length === 0) {
      return 'No active amendments.';
    }

    return amendments.map((a, i) =>
      `${i + 1}. [${a.amendment_type}] ${a.trigger_pattern}: ${a.instruction_delta}`
    ).join('\n');
  }

  /**
   * Format patterns for prompt
   * @param {Object[]} patterns - Patterns array
   * @param {string} type - 'failure' or 'success'
   * @returns {string}
   */
  formatPatterns(patterns, type) {
    if (!patterns || patterns.length === 0) {
      return `No recent ${type} patterns detected.`;
    }

    return patterns.map((p, i) => {
      const confidence = p.confidence ? ` (confidence: ${(p.confidence * 100).toFixed(0)}%)` : '';
      return `${i + 1}. ${p.type || p.pattern_type}${confidence}: ${p.suggested_action || p.description || JSON.stringify(p.data)}`;
    }).join('\n');
  }

  /**
   * Format research results for prompt
   * @param {ResearchResult[]} results - Research results
   * @returns {string}
   */
  formatResearchResults(results) {
    if (!results || results.length === 0) {
      return 'No research findings available.';
    }

    return results.map((r, i) =>
      `${i + 1}. [${r.title}](${r.url})\n   Summary: ${r.summary}\n   Relevance: ${r.relevance}`
    ).join('\n\n');
  }

  /**
   * Map recommendation type to amendment type
   * @param {string} recType - Recommendation type
   * @returns {string} Amendment type
   */
  mapRecommendationTypeToAmendmentType(recType) {
    const mapping = {
      knowledge_addition: 'knowledge_expansion',
      knowledge_modification: 'behavioral',
      skill_suggestion: 'skill_gap',
    };
    return mapping[recType] || 'behavioral';
  }

  /**
   * Get confidence score from impact level
   * @param {string} impact - Impact level
   * @returns {number} Confidence score (0-1)
   */
  getConfidenceFromImpact(impact) {
    const mapping = {
      high: 0.85,
      medium: 0.7,
      low: 0.55,
    };
    return mapping[impact] || 0.6;
  }

  /**
   * Map database record to Recommendation type
   * @param {Object} db - Database record
   * @returns {Recommendation}
   */
  mapDbToRecommendation(db) {
    return {
      id: db.id,
      subordinateRole: db.subordinate_role,
      team: db.team,
      type: db.type,
      content: db.content,
      targetingPattern: db.targeting_pattern,
      expectedImpact: db.expected_impact,
      reasoning: db.reasoning,
      sources: db.sources,
      status: db.status,
      amendmentId: db.amendment_id,
      createdAt: db.created_at,
      expiresAt: db.expires_at,
      selectedAt: db.selected_at,
      expiredAt: db.expired_at,
    };
  }

  /**
   * Reject a recommendation (mark as rejected)
   * @param {string} recommendationId - ID of the recommendation
   * @param {string} reason - Rejection reason
   * @returns {Promise<{data: Recommendation|null, error: Object|null}>}
   */
  async rejectRecommendation(recommendationId, reason = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('recommendations')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
      })
      .eq('id', recommendationId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    console.log(`[RECOMMENDATION-GEN] Recommendation ${recommendationId} rejected`);

    return {
      data: this.mapDbToRecommendation(data),
      error: null,
    };
  }

  /**
   * Get recommendation by ID
   * @param {string} recommendationId - Recommendation ID
   * @returns {Promise<{data: Recommendation|null, error: Object|null}>}
   */
  async getRecommendation(recommendationId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('recommendations')
      .select('*')
      .eq('id', recommendationId)
      .single();

    if (error) {
      return { data: null, error };
    }

    return {
      data: this.mapDbToRecommendation(data),
      error: null,
    };
  }

  /**
   * Get recommendations by team
   * @param {string} team - Team name
   * @param {string} status - Optional status filter
   * @returns {Promise<{data: Recommendation[], error: Object|null}>}
   */
  async getRecommendationsByTeam(team, status = null) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from('recommendations')
      .select('*')
      .eq('team', team)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error };
    }

    return {
      data: (data || []).map(this.mapDbToRecommendation),
      error: null,
    };
  }

  /**
   * Get recommendation statistics
   * @param {string} subordinateRole - Optional role filter
   * @returns {Promise<{data: Object, error: Object|null}>}
   */
  async getRecommendationStats(subordinateRole = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    let query = this.supabase
      .from('recommendations')
      .select('status, expected_impact');

    if (subordinateRole) {
      query = query.eq('subordinate_role', subordinateRole);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    const stats = {
      total: data?.length || 0,
      byStatus: {},
      byImpact: {},
    };

    for (const rec of (data || [])) {
      // Count by status
      stats.byStatus[rec.status] = (stats.byStatus[rec.status] || 0) + 1;
      // Count by impact
      stats.byImpact[rec.expected_impact] = (stats.byImpact[rec.expected_impact] || 0) + 1;
    }

    return { data: stats, error: null };
  }
}

// ============================================================================
// STANDALONE FUNCTIONS (for direct import)
// ============================================================================

/**
 * Generate recommendations for a subordinate
 * @param {string} subordinateRole
 * @param {string} currentKnowledge
 * @param {ResearchResult[]} researchResults
 * @param {Object[]} failurePatterns
 * @param {Object[]} successPatterns
 * @param {number} count
 * @returns {Promise<Recommendation[]>}
 */
async function generateRecommendations(
  subordinateRole,
  currentKnowledge,
  researchResults,
  failurePatterns,
  successPatterns,
  count = 2
) {
  const generator = new RecommendationGenerator();
  return generator.generateRecommendations(
    subordinateRole,
    currentKnowledge,
    researchResults,
    failurePatterns,
    successPatterns,
    count
  );
}

/**
 * Store recommendation in database
 * @param {Object} recommendation
 * @returns {Promise<UUID>} Recommendation ID
 */
async function storeRecommendation(recommendation) {
  const generator = new RecommendationGenerator();
  const { data, error } = await generator.storeRecommendation(recommendation);
  if (error) {
    throw new Error(error.message);
  }
  return data.id;
}

/**
 * Validate recommendation meets constraints
 * @param {Recommendation} rec
 * @param {string} subordinateRole
 * @returns {ValidationResult}
 */
function validateRecommendation(rec, subordinateRole) {
  const generator = new RecommendationGenerator();
  return generator.validateRecommendation(rec, subordinateRole);
}

/**
 * Select recommendation and convert to amendment
 * @param {string} subordinateRole
 * @param {string} recommendationId
 * @returns {Promise<Amendment>}
 */
async function selectRecommendationForAmendment(subordinateRole, recommendationId) {
  const generator = new RecommendationGenerator();
  const { data, error } = await generator.selectRecommendationForAmendment(
    subordinateRole,
    recommendationId
  );
  if (error) {
    throw new Error(error.message);
  }
  return data.amendment;
}

/**
 * Mark expired recommendations (older than 7 days, still pending)
 * @returns {Promise<number>} Count of expired recommendations
 */
async function expireOldRecommendations() {
  const generator = new RecommendationGenerator();
  const { count, error } = await generator.expireOldRecommendations();
  if (error) {
    throw new Error(error.message);
  }
  return count;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export class
export { RecommendationGenerator };

// Export prompt template
export { RECOMMENDATION_GENERATION_PROMPT };

// Export validation rules
export { VALIDATION_RULES };

// Export standalone functions
export {
  generateRecommendations,
  storeRecommendation,
  validateRecommendation,
  selectRecommendationForAmendment,
  expireOldRecommendations,
};

// Default export
export default RecommendationGenerator;
