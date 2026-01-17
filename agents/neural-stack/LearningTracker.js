/**
 * LEARNING TRACKER - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Tracks recommendation outcomes and adjusts Knowledge Bot learning.
 * Knowledge Bots provide recommendations to Team Leads about their subordinates.
 * This module tracks how those recommendations perform when implemented as amendments.
 *
 * LEARNING CYCLE:
 * 1. Knowledge Bot generates recommendation
 * 2. Team Lead approves and creates amendment from recommendation
 * 3. Amendment goes through 5-task evaluation
 * 4. Outcome recorded via recordRecommendationOutcome
 * 5. Knowledge Bot learning updated via updateKnowledgeBotLearning
 * 6. Future recommendations adjusted via adjustRecommendationPriority
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {Object} Recommendation
 * @property {string} id - Recommendation ID
 * @property {string} knowledge_bot_role - e.g., 'tech_kb', 'marketing_kb'
 * @property {string} subordinate_role - Target subordinate
 * @property {string} targeting_pattern - Pattern being targeted
 * @property {string} recommendation_text - The recommendation content
 * @property {string} expectedImpact - 'high', 'medium', 'low'
 * @property {string} [learningNote] - Added by adjustRecommendationPriority
 * @property {string} [amendment_id] - Set when recommendation becomes amendment
 */

/**
 * @typedef {Object} OutcomeData
 * @property {string} recommendation_id
 * @property {string} subordinate_role
 * @property {string} targeting_pattern
 * @property {boolean} succeeded
 * @property {number} impact - varianceBefore - varianceAfter
 */

/**
 * @typedef {Object} KnowledgeBotMetrics
 * @property {string} role
 * @property {number} total_recommendations_generated
 * @property {number} recommendations_selected
 * @property {number} recommendations_succeeded
 * @property {number} recommendations_failed
 * @property {number} selection_rate
 * @property {number} success_rate
 * @property {number} avg_research_depth
 * @property {number} cross_subordinate_insights
 * @property {string} confidence_trend - 'improving', 'stable', 'declining'
 * @property {string} highest_impact_pattern
 * @property {string} lowest_success_pattern
 */

/**
 * @typedef {Object} LearningData
 * @property {string} subordinate_role
 * @property {string} targeting_pattern
 * @property {number} total_recommendations
 * @property {number} successful_recommendations
 * @property {number} failed_recommendations
 * @property {number} avg_impact
 * @property {number} confidence_score
 */

/**
 * @typedef {Object} CrossSubordinateInsight
 * @property {string} targeting_pattern
 * @property {string[]} subordinates_helped
 * @property {number} total_success_count
 * @property {number} avg_impact
 * @property {number} confidence_score
 */

// ============================================================================
// LEARNING TRACKER CLASS
// ============================================================================

/**
 * Learning Tracker
 * Manages Knowledge Bot learning from recommendation outcomes
 */
class LearningTracker {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
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
      console.log('[LEARNING-TRACKER] Connected to Supabase');
    } else {
      console.warn('[LEARNING-TRACKER] Running in offline mode - no Supabase credentials');
    }
  }

  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ============================================================================
  // 1. OUTCOME RECORDING
  // ============================================================================

  /**
   * Record outcome when an amendment (from recommendation) completes evaluation
   * @param {string} amendmentId
   * @param {boolean} succeeded
   * @param {number} varianceBefore
   * @param {number} varianceAfter
   * @returns {Promise<void>}
   */
  async recordRecommendationOutcome(amendmentId, succeeded, varianceBefore, varianceAfter) {
    if (!this.isAvailable()) {
      console.warn('[LEARNING-TRACKER] Database unavailable, skipping outcome recording');
      return;
    }

    // 1. Find linked recommendation by amendment_id
    const { data: recommendation, error: fetchError } = await this.supabase
      .from('monolith_recommendations')
      .select('*')
      .eq('amendment_id', amendmentId)
      .single();

    if (fetchError || !recommendation) {
      console.log(`[LEARNING-TRACKER] No recommendation found for amendment ${amendmentId}`);
      return;
    }

    const impact = varianceBefore - varianceAfter;

    // 2. Update recommendation with outcome data
    const { error: updateError } = await this.supabase
      .from('monolith_recommendations')
      .update({
        outcome_succeeded: succeeded,
        outcome_impact: impact,
        variance_before: varianceBefore,
        variance_after: varianceAfter,
        outcome_recorded_at: new Date().toISOString(),
      })
      .eq('id', recommendation.id);

    if (updateError) {
      console.error('[LEARNING-TRACKER] Error updating recommendation outcome:', updateError.message);
      return;
    }

    // 3. Update Knowledge Bot learning data
    const outcomeData = {
      recommendation_id: recommendation.id,
      subordinate_role: recommendation.subordinate_role,
      targeting_pattern: recommendation.targeting_pattern,
      succeeded,
      impact,
    };

    await this.updateKnowledgeBotLearning(recommendation.knowledge_bot_role, outcomeData);

    // 4. Recalculate confidence scores
    await this.recalculateConfidenceScores(
      recommendation.knowledge_bot_role,
      recommendation.subordinate_role,
      recommendation.targeting_pattern
    );

    console.log(
      `[LEARNING-TRACKER] Recorded outcome for recommendation ${recommendation.id}: ` +
      `${succeeded ? 'SUCCESS' : 'FAILURE'}, impact: ${impact.toFixed(3)}`
    );
  }

  // ============================================================================
  // 2. LEARNING DATA UPDATE
  // ============================================================================

  /**
   * Update Knowledge Bot's learning data based on outcome
   * @param {string} knowledgeBotRole
   * @param {OutcomeData} outcomeData
   * @returns {Promise<void>}
   */
  async updateKnowledgeBotLearning(knowledgeBotRole, outcomeData) {
    if (!this.isAvailable()) {
      console.warn('[LEARNING-TRACKER] Database unavailable, skipping learning update');
      return;
    }

    // Check if learning record exists for this bot + subordinate + pattern combination
    const { data: existing } = await this.supabase
      .from('monolith_knowledge_bot_learning')
      .select('*')
      .eq('knowledge_bot_role', knowledgeBotRole)
      .eq('subordinate_role', outcomeData.subordinate_role)
      .eq('targeting_pattern', outcomeData.targeting_pattern)
      .single();

    if (existing) {
      // Update existing learning record
      const newTotal = existing.total_recommendations + 1;
      const newSuccessful = existing.successful_recommendations + (outcomeData.succeeded ? 1 : 0);
      const newFailed = existing.failed_recommendations + (outcomeData.succeeded ? 0 : 1);

      // Calculate running average of impact
      const newAvgImpact = (existing.avg_impact * existing.total_recommendations + outcomeData.impact) / newTotal;

      // Recalculate confidence score
      const confidenceScore = calculateConfidenceScore(newTotal, newSuccessful, newAvgImpact);

      const { error } = await this.supabase
        .from('monolith_knowledge_bot_learning')
        .update({
          total_recommendations: newTotal,
          successful_recommendations: newSuccessful,
          failed_recommendations: newFailed,
          avg_impact: newAvgImpact,
          confidence_score: confidenceScore,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('[LEARNING-TRACKER] Error updating learning data:', error.message);
      }
    } else {
      // Create new learning record
      const confidenceScore = calculateConfidenceScore(1, outcomeData.succeeded ? 1 : 0, outcomeData.impact);

      const { error } = await this.supabase
        .from('monolith_knowledge_bot_learning')
        .insert([{
          knowledge_bot_role: knowledgeBotRole,
          subordinate_role: outcomeData.subordinate_role,
          targeting_pattern: outcomeData.targeting_pattern,
          total_recommendations: 1,
          successful_recommendations: outcomeData.succeeded ? 1 : 0,
          failed_recommendations: outcomeData.succeeded ? 0 : 1,
          avg_impact: outcomeData.impact,
          confidence_score: confidenceScore,
        }]);

      if (error) {
        console.error('[LEARNING-TRACKER] Error creating learning data:', error.message);
      }
    }

    // Also update aggregate metrics for the Knowledge Bot
    await this.updateKnowledgeBotAggregates(knowledgeBotRole, outcomeData);
  }

  /**
   * Update aggregate metrics for Knowledge Bot
   */
  async updateKnowledgeBotAggregates(knowledgeBotRole, outcomeData) {
    const { data: existing } = await this.supabase
      .from('monolith_knowledge_bot_metrics')
      .select('*')
      .eq('role', knowledgeBotRole)
      .single();

    if (existing) {
      const { error } = await this.supabase
        .from('monolith_knowledge_bot_metrics')
        .update({
          recommendations_succeeded: existing.recommendations_succeeded + (outcomeData.succeeded ? 1 : 0),
          recommendations_failed: existing.recommendations_failed + (outcomeData.succeeded ? 0 : 1),
          last_outcome_at: new Date().toISOString(),
        })
        .eq('role', knowledgeBotRole);

      if (error) {
        console.error('[LEARNING-TRACKER] Error updating bot aggregates:', error.message);
      }
    } else {
      // Create metrics record if doesn't exist
      const { error } = await this.supabase
        .from('monolith_knowledge_bot_metrics')
        .insert([{
          role: knowledgeBotRole,
          total_recommendations_generated: 0,
          recommendations_selected: 0,
          recommendations_succeeded: outcomeData.succeeded ? 1 : 0,
          recommendations_failed: outcomeData.succeeded ? 0 : 1,
        }]);

      if (error && error.code !== '23505') { // Ignore unique constraint violations
        console.error('[LEARNING-TRACKER] Error creating bot metrics:', error.message);
      }
    }
  }

  /**
   * Recalculate confidence scores after new outcome
   */
  async recalculateConfidenceScores(knowledgeBotRole, subordinateRole, targetingPattern) {
    const { data: learningRecord } = await this.supabase
      .from('monolith_knowledge_bot_learning')
      .select('*')
      .eq('knowledge_bot_role', knowledgeBotRole)
      .eq('subordinate_role', subordinateRole)
      .eq('targeting_pattern', targetingPattern)
      .single();

    if (!learningRecord) return;

    const newConfidence = calculateConfidenceScore(
      learningRecord.total_recommendations,
      learningRecord.successful_recommendations,
      learningRecord.avg_impact
    );

    await this.supabase
      .from('monolith_knowledge_bot_learning')
      .update({ confidence_score: newConfidence })
      .eq('id', learningRecord.id);
  }

  // ============================================================================
  // 3. CONFIDENCE SCORE CALCULATION (standalone function)
  // ============================================================================

  // See calculateConfidenceScore() below

  // ============================================================================
  // 4. LEARNING-ADJUSTED RECOMMENDATION PRIORITY
  // ============================================================================

  /**
   * Adjust recommendation priority based on historical outcomes
   * @param {string} botRole
   * @param {string} subordinateRole
   * @param {Recommendation[]} recommendations
   * @returns {Promise<Recommendation[]>} Sorted by adjusted priority
   */
  async adjustRecommendationPriority(botRole, subordinateRole, recommendations) {
    if (!this.isAvailable() || !recommendations || recommendations.length === 0) {
      return recommendations;
    }

    // 1. Get learning data for the bot + subordinate
    const { data: learningData } = await this.supabase
      .from('monolith_knowledge_bot_learning')
      .select('*')
      .eq('knowledge_bot_role', botRole)
      .eq('subordinate_role', subordinateRole);

    if (!learningData || learningData.length === 0) {
      // No historical data - return as-is
      return recommendations;
    }

    // Create lookup map for quick access
    const learningByPattern = new Map();
    for (const record of learningData) {
      learningByPattern.set(record.targeting_pattern, record);
    }

    // 2. Adjust each recommendation based on historical data
    const adjustedRecommendations = recommendations.map(rec => {
      const learning = learningByPattern.get(rec.targeting_pattern);

      if (!learning) {
        // No historical data for this pattern
        return { ...rec, learningNote: 'No historical data for this pattern' };
      }

      const successRate = learning.total_recommendations > 0
        ? learning.successful_recommendations / learning.total_recommendations
        : 0;

      let adjustedImpact = rec.expectedImpact;
      let learningNote = '';

      // 3. Adjust priority based on success rate thresholds
      if (successRate < 0.3) {
        // If success rate < 30%, deprioritize (set to 'low')
        adjustedImpact = 'low';
        learningNote = `Deprioritized: historical success rate ${(successRate * 100).toFixed(0)}% (${learning.successful_recommendations}/${learning.total_recommendations})`;
      } else if (successRate > 0.7) {
        // If success rate > 70%, boost (set to 'high')
        adjustedImpact = 'high';
        learningNote = `Boosted: historical success rate ${(successRate * 100).toFixed(0)}% (${learning.successful_recommendations}/${learning.total_recommendations})`;
      } else {
        learningNote = `Historical success rate ${(successRate * 100).toFixed(0)}% (${learning.successful_recommendations}/${learning.total_recommendations})`;
      }

      return {
        ...rec,
        expectedImpact: adjustedImpact,
        learningNote,
        historicalSuccessRate: successRate,
        historicalAvgImpact: learning.avg_impact,
        confidenceScore: learning.confidence_score,
      };
    });

    // 4. Sort by expectedImpact (high > medium > low), then by confidence score
    const impactOrder = { high: 3, medium: 2, low: 1 };

    return adjustedRecommendations.sort((a, b) => {
      const impactDiff = (impactOrder[b.expectedImpact] || 0) - (impactOrder[a.expectedImpact] || 0);
      if (impactDiff !== 0) return impactDiff;

      // Secondary sort by confidence score
      return (b.confidenceScore || 0) - (a.confidenceScore || 0);
    });
  }

  // ============================================================================
  // 5. KNOWLEDGE BOT METRICS
  // ============================================================================

  /**
   * Get metrics for a Knowledge Bot
   * @param {string} botRole
   * @returns {Promise<KnowledgeBotMetrics>}
   */
  async getKnowledgeBotMetrics(botRole) {
    if (!this.isAvailable()) {
      return createEmptyMetrics(botRole);
    }

    // Get base metrics
    const { data: metrics } = await this.supabase
      .from('monolith_knowledge_bot_metrics')
      .select('*')
      .eq('role', botRole)
      .single();

    // Get learning data for pattern analysis
    const { data: learningData } = await this.supabase
      .from('monolith_knowledge_bot_learning')
      .select('*')
      .eq('knowledge_bot_role', botRole);

    // Get historical metrics for trend calculation
    const { data: historicalMetrics } = await this.supabase
      .from('monolith_knowledge_bot_metrics_history')
      .select('success_rate, recorded_at')
      .eq('role', botRole)
      .order('recorded_at', { ascending: false })
      .limit(10);

    if (!metrics) {
      return createEmptyMetrics(botRole);
    }

    // Calculate derived metrics
    const totalGenerated = metrics.total_recommendations_generated || 0;
    const selected = metrics.recommendations_selected || 0;
    const succeeded = metrics.recommendations_succeeded || 0;
    const failed = metrics.recommendations_failed || 0;
    const evaluated = succeeded + failed;

    const selectionRate = totalGenerated > 0 ? selected / totalGenerated : 0;
    const successRate = evaluated > 0 ? succeeded / evaluated : 0;

    // Find highest impact and lowest success patterns
    let highestImpactPattern = null;
    let lowestSuccessPattern = null;
    let highestImpact = -Infinity;
    let lowestSuccess = Infinity;

    // Count cross-subordinate insights
    const patternSubordinates = new Map();

    if (learningData) {
      for (const record of learningData) {
        // Track pattern impact
        if (record.avg_impact > highestImpact && record.successful_recommendations > 0) {
          highestImpact = record.avg_impact;
          highestImpactPattern = record.targeting_pattern;
        }

        // Track lowest success rate (with minimum sample size)
        const recSuccessRate = record.total_recommendations > 2
          ? record.successful_recommendations / record.total_recommendations
          : 1;
        if (recSuccessRate < lowestSuccess && record.total_recommendations > 2) {
          lowestSuccess = recSuccessRate;
          lowestSuccessPattern = record.targeting_pattern;
        }

        // Track cross-subordinate patterns
        if (record.successful_recommendations > 0) {
          if (!patternSubordinates.has(record.targeting_pattern)) {
            patternSubordinates.set(record.targeting_pattern, new Set());
          }
          patternSubordinates.get(record.targeting_pattern).add(record.subordinate_role);
        }
      }
    }

    // Count patterns that helped multiple subordinates
    let crossSubordinateInsights = 0;
    for (const [_, subordinates] of patternSubordinates) {
      if (subordinates.size > 1) {
        crossSubordinateInsights++;
      }
    }

    // Calculate confidence trend
    const confidenceTrend = calculateTrend(historicalMetrics || []);

    return {
      role: botRole,
      total_recommendations_generated: totalGenerated,
      recommendations_selected: selected,
      recommendations_succeeded: succeeded,
      recommendations_failed: failed,
      selection_rate: selectionRate,
      success_rate: successRate,
      avg_research_depth: metrics.avg_research_depth || 0,
      cross_subordinate_insights: crossSubordinateInsights,
      confidence_trend: confidenceTrend,
      highest_impact_pattern: highestImpactPattern,
      lowest_success_pattern: lowestSuccessPattern,
    };
  }

  // ============================================================================
  // 6. CROSS-SUBORDINATE PATTERN DETECTION
  // ============================================================================

  /**
   * Find patterns that helped multiple subordinates
   * @param {string} botRole
   * @returns {Promise<CrossSubordinateInsight[]>} Patterns with cross-subordinate success
   */
  async findCrossSubordinateInsights(botRole) {
    if (!this.isAvailable()) {
      return [];
    }

    // Get all learning data for this Knowledge Bot
    const { data: learningData, error } = await this.supabase
      .from('monolith_knowledge_bot_learning')
      .select('*')
      .eq('knowledge_bot_role', botRole)
      .gt('successful_recommendations', 0);

    if (error || !learningData) {
      console.error('[LEARNING-TRACKER] Error fetching learning data:', error?.message);
      return [];
    }

    // Group by targeting_pattern
    const patternGroups = new Map();

    for (const record of learningData) {
      const pattern = record.targeting_pattern;

      if (!patternGroups.has(pattern)) {
        patternGroups.set(pattern, {
          targeting_pattern: pattern,
          subordinates: [],
          total_success_count: 0,
          total_impact: 0,
          total_recommendations: 0,
        });
      }

      const group = patternGroups.get(pattern);
      group.subordinates.push(record.subordinate_role);
      group.total_success_count += record.successful_recommendations;
      group.total_impact += record.avg_impact * record.total_recommendations;
      group.total_recommendations += record.total_recommendations;
    }

    // Filter to patterns that helped multiple subordinates
    const insights = [];

    for (const [pattern, group] of patternGroups) {
      const uniqueSubordinates = [...new Set(group.subordinates)];

      if (uniqueSubordinates.length > 1) {
        const avgImpact = group.total_recommendations > 0
          ? group.total_impact / group.total_recommendations
          : 0;

        const confidenceScore = calculateConfidenceScore(
          group.total_recommendations,
          group.total_success_count,
          avgImpact
        );

        insights.push({
          targeting_pattern: pattern,
          subordinates_helped: uniqueSubordinates,
          total_success_count: group.total_success_count,
          avg_impact: avgImpact,
          confidence_score: confidenceScore,
        });
      }
    }

    // Sort by number of subordinates helped, then by success count
    return insights.sort((a, b) => {
      const subDiff = b.subordinates_helped.length - a.subordinates_helped.length;
      if (subDiff !== 0) return subDiff;
      return b.total_success_count - a.total_success_count;
    });
  }

  // ============================================================================
  // ADDITIONAL HELPER METHODS
  // ============================================================================

  /**
   * Record a new recommendation being generated
   */
  async recordRecommendationGenerated(botRole, subordinateRole, targetingPattern, recommendationText) {
    if (!this.isAvailable()) return null;

    const { data, error } = await this.supabase
      .from('monolith_recommendations')
      .insert([{
        knowledge_bot_role: botRole,
        subordinate_role: subordinateRole,
        targeting_pattern: targetingPattern,
        recommendation_text: recommendationText,
        status: 'generated',
      }])
      .select()
      .single();

    if (error) {
      console.error('[LEARNING-TRACKER] Error recording recommendation:', error.message);
      return null;
    }

    // Update bot metrics
    await this.supabase
      .from('monolith_knowledge_bot_metrics')
      .upsert([{
        role: botRole,
        total_recommendations_generated: 1,
      }], {
        onConflict: 'role',
      })
      .then(async () => {
        await this.supabase.rpc('increment_recommendations_generated', { bot_role: botRole });
      });

    return data;
  }

  /**
   * Mark recommendation as selected (will become amendment)
   */
  async markRecommendationSelected(recommendationId, amendmentId) {
    if (!this.isAvailable()) return;

    const { data: rec } = await this.supabase
      .from('monolith_recommendations')
      .update({
        status: 'selected',
        amendment_id: amendmentId,
        selected_at: new Date().toISOString(),
      })
      .eq('id', recommendationId)
      .select()
      .single();

    if (rec) {
      // Update bot metrics
      const { data: existing } = await this.supabase
        .from('monolith_knowledge_bot_metrics')
        .select('recommendations_selected')
        .eq('role', rec.knowledge_bot_role)
        .single();

      if (existing) {
        await this.supabase
          .from('monolith_knowledge_bot_metrics')
          .update({
            recommendations_selected: (existing.recommendations_selected || 0) + 1,
          })
          .eq('role', rec.knowledge_bot_role);
      }
    }
  }

  /**
   * Get learning history for debugging
   */
  async getLearningHistory(botRole, limit = 50) {
    if (!this.isAvailable()) return [];

    const { data } = await this.supabase
      .from('monolith_recommendations')
      .select('*')
      .eq('knowledge_bot_role', botRole)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }
}

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

/**
 * Calculate confidence score based on historical success
 * @param {number} totalRecommendations
 * @param {number} successfulRecommendations
 * @param {number} avgImpact
 * @returns {number} Confidence score 0-1
 */
function calculateConfidenceScore(totalRecommendations, successfulRecommendations, avgImpact) {
  if (totalRecommendations === 0) {
    return 0;
  }

  // Base: successRate = successful / total
  const successRate = successfulRecommendations / totalRecommendations;

  // Adjust by sample size: confidence = successRate * (1 - 1/(total + 5))
  // This gives more weight to larger sample sizes
  // With 0 samples: factor = 0
  // With 5 samples: factor = 0.5
  // With 15 samples: factor = 0.75
  // With 45 samples: factor = 0.9
  const sampleSizeFactor = 1 - 1 / (totalRecommendations + 5);
  let confidence = successRate * sampleSizeFactor;

  // Boost by impact: if avgImpact > 0.1, boost by 10%
  // Impact represents variance reduction, so higher is better
  if (avgImpact > 0.1) {
    confidence = Math.min(1, confidence * 1.1);
  }

  // Ensure result is in [0, 1] range
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Calculate trend from historical metrics
 * @param {Object[]} historicalMetrics - Metrics with success_rate and recorded_at
 * @returns {'improving' | 'stable' | 'declining'}
 */
function calculateTrend(historicalMetrics) {
  if (!historicalMetrics || historicalMetrics.length < 3) {
    return 'stable';
  }

  // Compare recent half vs older half
  const midpoint = Math.floor(historicalMetrics.length / 2);
  const recent = historicalMetrics.slice(0, midpoint);
  const older = historicalMetrics.slice(midpoint);

  const recentAvg = recent.reduce((sum, m) => sum + (m.success_rate || 0), 0) / recent.length;
  const olderAvg = older.reduce((sum, m) => sum + (m.success_rate || 0), 0) / older.length;

  const diff = recentAvg - olderAvg;

  if (diff > 0.05) return 'improving';
  if (diff < -0.05) return 'declining';
  return 'stable';
}

/**
 * Create empty metrics object for a bot
 */
function createEmptyMetrics(botRole) {
  return {
    role: botRole,
    total_recommendations_generated: 0,
    recommendations_selected: 0,
    recommendations_succeeded: 0,
    recommendations_failed: 0,
    selection_rate: 0,
    success_rate: 0,
    avg_research_depth: 0,
    cross_subordinate_insights: 0,
    confidence_trend: 'stable',
    highest_impact_pattern: null,
    lowest_success_pattern: null,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export class
export { LearningTracker };

// Export standalone functions
export {
  calculateConfidenceScore,
  calculateTrend,
  createEmptyMetrics,
};

// Export types for JSDoc consumers
export {
  // Types are documented via JSDoc above
};

// Default export
export default LearningTracker;
