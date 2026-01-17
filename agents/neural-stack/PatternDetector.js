/**
 * PATTERN DETECTOR - Phase 5C
 * Cognalith Inc. | Monolith System
 *
 * Detects failure patterns from task history to trigger amendment generation.
 * Only detects patterns when performance trends DECLINE - not proactively.
 */

import { createClient } from '@supabase/supabase-js';

// Pattern detection thresholds
const THRESHOLDS = {
  MIN_TASKS_FOR_ANALYSIS: 5,      // Minimum tasks needed before pattern detection
  FAILURE_RATE_TRIGGER: 0.4,      // 40%+ failure rate triggers analysis
  TIME_REGRESSION_FACTOR: 1.5,    // 50% slower than baseline triggers
  QUALITY_DECLINE_THRESHOLD: 0.15, // 15% quality drop triggers
  CONFIDENCE_MIN: 0.6,            // Minimum confidence to report pattern
  LOOKBACK_WINDOW: 20,            // Number of recent tasks to analyze
};

// Pattern types
const PATTERN_TYPES = {
  REPEATED_FAILURE: 'repeated_failure',
  TIME_REGRESSION: 'time_regression',
  QUALITY_DECLINE: 'quality_decline',
  CATEGORY_WEAKNESS: 'category_weakness',
  TOOL_INEFFICIENCY: 'tool_inefficiency',
};

/**
 * Pattern Detector
 * Analyzes task history to detect actionable failure patterns
 */
class PatternDetector {
  constructor(config = {}) {
    this.supabase = null;
    this.isConnected = false;
    this.thresholds = { ...THRESHOLDS, ...config.thresholds };
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
    }
  }

  isAvailable() {
    return this.isConnected && this.supabase !== null;
  }

  // ============================================================================
  // MAIN DETECTION INTERFACE
  // ============================================================================

  /**
   * Analyze agent's recent task history for failure patterns
   * Returns array of detected patterns with confidence scores
   */
  async detectPatterns(agentRole) {
    if (!this.isAvailable()) {
      return { patterns: [], error: { message: 'Database unavailable' } };
    }

    // Fetch recent task history
    const { data: tasks, error } = await this.supabase
      .from('monolith_task_history')
      .select('*')
      .eq('agent_role', agentRole)
      .order('completed_at', { ascending: false })
      .limit(this.thresholds.LOOKBACK_WINDOW);

    if (error) {
      return { patterns: [], error };
    }

    if (!tasks || tasks.length < this.thresholds.MIN_TASKS_FOR_ANALYSIS) {
      return { patterns: [], error: null, message: 'Insufficient data for pattern detection' };
    }

    // Run all pattern detectors
    const patterns = [];

    const repeatedFailure = this.detectRepeatedFailure(tasks);
    if (repeatedFailure) patterns.push(repeatedFailure);

    const timeRegression = this.detectTimeRegression(tasks);
    if (timeRegression) patterns.push(timeRegression);

    const qualityDecline = this.detectQualityDecline(tasks);
    if (qualityDecline) patterns.push(qualityDecline);

    const categoryWeakness = this.detectCategoryWeakness(tasks);
    if (categoryWeakness) patterns.push(categoryWeakness);

    const toolInefficiency = this.detectToolInefficiency(tasks);
    if (toolInefficiency) patterns.push(toolInefficiency);

    // Filter by confidence threshold
    const significantPatterns = patterns.filter(
      p => p.confidence >= this.thresholds.CONFIDENCE_MIN
    );

    return { patterns: significantPatterns, error: null };
  }

  // ============================================================================
  // PATTERN DETECTION ALGORITHMS
  // ============================================================================

  /**
   * Detect repeated failures on similar tasks
   */
  detectRepeatedFailure(tasks) {
    const failures = tasks.filter(t => !t.success);
    const failureRate = failures.length / tasks.length;

    if (failureRate < this.thresholds.FAILURE_RATE_TRIGGER) {
      return null;
    }

    // Group failures by category to find patterns
    const categoryFailures = {};
    failures.forEach(task => {
      const cat = task.task_category || 'uncategorized';
      if (!categoryFailures[cat]) {
        categoryFailures[cat] = [];
      }
      categoryFailures[cat].push(task);
    });

    // Find the most problematic category
    let maxCategory = null;
    let maxCount = 0;
    for (const [cat, catTasks] of Object.entries(categoryFailures)) {
      if (catTasks.length > maxCount) {
        maxCount = catTasks.length;
        maxCategory = cat;
      }
    }

    // Extract common failure reasons
    const failureReasons = failures
      .map(t => t.failure_reason)
      .filter(Boolean);

    const confidence = Math.min(0.95, failureRate + (maxCount / tasks.length) * 0.3);

    return {
      type: PATTERN_TYPES.REPEATED_FAILURE,
      confidence,
      data: {
        failure_rate: failureRate,
        total_failures: failures.length,
        total_tasks: tasks.length,
        primary_category: maxCategory,
        category_failure_count: maxCount,
        common_reasons: [...new Set(failureReasons)].slice(0, 5),
      },
      suggested_action: `Improve handling of ${maxCategory} tasks. Common issues: ${failureReasons.slice(0, 2).join(', ')}`,
    };
  }

  /**
   * Detect time regression (tasks taking longer than baseline)
   */
  detectTimeRegression(tasks) {
    const tasksWithTime = tasks.filter(t => t.time_taken_seconds);
    if (tasksWithTime.length < 6) return null;

    // Split into recent vs older
    const midpoint = Math.floor(tasksWithTime.length / 2);
    const recent = tasksWithTime.slice(0, midpoint);
    const older = tasksWithTime.slice(midpoint);

    const recentAvg = recent.reduce((sum, t) => sum + t.time_taken_seconds, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.time_taken_seconds, 0) / older.length;

    const regressionFactor = recentAvg / olderAvg;

    if (regressionFactor < this.thresholds.TIME_REGRESSION_FACTOR) {
      return null;
    }

    // Find which task types are slowest
    const byCategory = {};
    recent.forEach(t => {
      const cat = t.task_category || 'uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t.time_taken_seconds);
    });

    let slowestCategory = null;
    let slowestAvg = 0;
    for (const [cat, times] of Object.entries(byCategory)) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      if (avg > slowestAvg) {
        slowestAvg = avg;
        slowestCategory = cat;
      }
    }

    const confidence = Math.min(0.9, (regressionFactor - 1) * 0.5 + 0.4);

    return {
      type: PATTERN_TYPES.TIME_REGRESSION,
      confidence,
      data: {
        recent_avg_seconds: Math.round(recentAvg),
        baseline_avg_seconds: Math.round(olderAvg),
        regression_factor: regressionFactor.toFixed(2),
        slowest_category: slowestCategory,
        slowest_avg_seconds: Math.round(slowestAvg),
      },
      suggested_action: `Optimize ${slowestCategory} task execution. Recent tasks taking ${regressionFactor.toFixed(1)}x longer than baseline.`,
    };
  }

  /**
   * Detect quality decline in deliverables
   */
  detectQualityDecline(tasks) {
    const tasksWithQuality = tasks.filter(t => t.quality_score !== null);
    if (tasksWithQuality.length < 6) return null;

    // Split into recent vs older
    const midpoint = Math.floor(tasksWithQuality.length / 2);
    const recent = tasksWithQuality.slice(0, midpoint);
    const older = tasksWithQuality.slice(midpoint);

    const recentAvg = recent.reduce((sum, t) => sum + parseFloat(t.quality_score), 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + parseFloat(t.quality_score), 0) / older.length;

    const decline = olderAvg - recentAvg;

    if (decline < this.thresholds.QUALITY_DECLINE_THRESHOLD) {
      return null;
    }

    // Find tasks with lowest quality
    const lowestQuality = [...recent]
      .sort((a, b) => a.quality_score - b.quality_score)
      .slice(0, 3);

    const confidence = Math.min(0.9, decline * 2 + 0.4);

    return {
      type: PATTERN_TYPES.QUALITY_DECLINE,
      confidence,
      data: {
        recent_avg_quality: recentAvg.toFixed(2),
        baseline_avg_quality: olderAvg.toFixed(2),
        decline_amount: decline.toFixed(2),
        lowest_quality_tasks: lowestQuality.map(t => ({
          task_id: t.task_id,
          quality: t.quality_score,
          category: t.task_category,
        })),
      },
      suggested_action: `Improve quality focus. Recent work averaging ${recentAvg.toFixed(2)} vs baseline ${olderAvg.toFixed(2)}.`,
    };
  }

  /**
   * Detect weakness in specific task categories
   */
  detectCategoryWeakness(tasks) {
    // Group by category
    const byCategory = {};
    tasks.forEach(task => {
      const cat = task.task_category || 'uncategorized';
      if (!byCategory[cat]) {
        byCategory[cat] = { success: 0, total: 0, times: [], qualities: [] };
      }
      byCategory[cat].total++;
      if (task.success) byCategory[cat].success++;
      if (task.time_taken_seconds) byCategory[cat].times.push(task.time_taken_seconds);
      if (task.quality_score) byCategory[cat].qualities.push(parseFloat(task.quality_score));
    });

    // Find weakest category
    let weakestCategory = null;
    let lowestScore = Infinity;
    const categoryScores = {};

    for (const [cat, stats] of Object.entries(byCategory)) {
      if (stats.total < 3) continue; // Need minimum sample

      const successRate = stats.success / stats.total;
      const avgQuality = stats.qualities.length > 0
        ? stats.qualities.reduce((a, b) => a + b, 0) / stats.qualities.length
        : 0.5;

      // Composite score (success rate + quality)
      const score = (successRate * 0.6) + (avgQuality * 0.4);
      categoryScores[cat] = { successRate, avgQuality, score, total: stats.total };

      if (score < lowestScore) {
        lowestScore = score;
        weakestCategory = cat;
      }
    }

    // Only report if there's a significant weakness
    const avgScore = Object.values(categoryScores).reduce((a, b) => a + b.score, 0) / Object.keys(categoryScores).length;
    if (!weakestCategory || lowestScore > avgScore - 0.15) {
      return null;
    }

    const weakness = categoryScores[weakestCategory];
    const confidence = Math.min(0.85, (avgScore - lowestScore) * 2 + 0.5);

    return {
      type: PATTERN_TYPES.CATEGORY_WEAKNESS,
      confidence,
      data: {
        weak_category: weakestCategory,
        category_success_rate: weakness.successRate.toFixed(2),
        category_avg_quality: weakness.avgQuality.toFixed(2),
        category_tasks: weakness.total,
        overall_avg_score: avgScore.toFixed(2),
        category_score: lowestScore.toFixed(2),
      },
      suggested_action: `Focus improvement on ${weakestCategory} tasks. Success rate: ${(weakness.successRate * 100).toFixed(0)}%, Quality: ${weakness.avgQuality.toFixed(2)}`,
    };
  }

  /**
   * Detect inefficient tool usage patterns
   */
  detectToolInefficiency(tasks) {
    // Extract tool usage from task context
    const toolUsage = {};
    let totalWithTools = 0;

    tasks.forEach(task => {
      if (task.tools_used && Array.isArray(task.tools_used)) {
        totalWithTools++;
        task.tools_used.forEach(tool => {
          if (!toolUsage[tool]) {
            toolUsage[tool] = { success: 0, failure: 0, totalTime: 0, count: 0 };
          }
          toolUsage[tool].count++;
          if (task.success) {
            toolUsage[tool].success++;
          } else {
            toolUsage[tool].failure++;
          }
          if (task.time_taken_seconds) {
            toolUsage[tool].totalTime += task.time_taken_seconds;
          }
        });
      }
    });

    if (totalWithTools < 5) return null;

    // Find least effective tool
    let leastEffectiveTool = null;
    let lowestEffectiveness = Infinity;

    for (const [tool, stats] of Object.entries(toolUsage)) {
      if (stats.count < 3) continue;
      const effectiveness = stats.success / stats.count;
      if (effectiveness < lowestEffectiveness) {
        lowestEffectiveness = effectiveness;
        leastEffectiveTool = tool;
      }
    }

    if (!leastEffectiveTool || lowestEffectiveness > 0.6) {
      return null;
    }

    const toolStats = toolUsage[leastEffectiveTool];
    const confidence = Math.min(0.8, (0.6 - lowestEffectiveness) * 2 + 0.5);

    return {
      type: PATTERN_TYPES.TOOL_INEFFICIENCY,
      confidence,
      data: {
        inefficient_tool: leastEffectiveTool,
        tool_success_rate: lowestEffectiveness.toFixed(2),
        tool_usage_count: toolStats.count,
        tool_failures: toolStats.failure,
        avg_time_with_tool: toolStats.totalTime > 0
          ? Math.round(toolStats.totalTime / toolStats.count)
          : null,
      },
      suggested_action: `Reconsider use of ${leastEffectiveTool}. Only ${(lowestEffectiveness * 100).toFixed(0)}% success rate when used.`,
    };
  }

  // ============================================================================
  // PATTERN LOGGING
  // ============================================================================

  /**
   * Log detected pattern to database
   */
  async logPattern(agentRole, pattern, taskWindow = null) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_pattern_log')
      .insert([{
        agent_role: agentRole,
        pattern_type: pattern.type,
        pattern_data: pattern.data,
        confidence: pattern.confidence,
        task_window: taskWindow,
      }])
      .select()
      .single();

    return { data, error };
  }

  /**
   * Mark pattern as resolved by amendment
   */
  async linkPatternToAmendment(patternId, amendmentId) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_pattern_log')
      .update({ amendment_generated: amendmentId })
      .eq('id', patternId)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Dismiss a pattern (no amendment needed)
   */
  async dismissPattern(patternId, reason) {
    if (!this.isAvailable()) {
      return { data: null, error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_pattern_log')
      .update({ dismissed: true, dismissed_reason: reason })
      .eq('id', patternId)
      .select()
      .single();

    return { data, error };
  }

  /**
   * Get recent patterns for an agent
   */
  async getRecentPatterns(agentRole, limit = 10) {
    if (!this.isAvailable()) {
      return { data: [], error: { message: 'Database unavailable' } };
    }

    const { data, error } = await this.supabase
      .from('monolith_pattern_log')
      .select('*')
      .eq('agent_role', agentRole)
      .order('created_at', { ascending: false })
      .limit(limit);

    return { data: data || [], error };
  }
}

// Export
export { PatternDetector, PATTERN_TYPES, THRESHOLDS };
export default PatternDetector;
