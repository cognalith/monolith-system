/**
 * LEARNING INSIGHTS PANEL - Phase 6B
 * Cognalith Inc. | Monolith System
 *
 * Knowledge Bot learning visualization showing:
 * - Top patterns by success rate (bar chart or list)
 * - Patterns needing improvement (low success rate)
 * - Cross-subordinate insights (patterns that helped multiple agents)
 * - Confidence trend over time
 * - Filter by Knowledge Bot
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.js';

/**
 * Simple SVG bar chart for pattern success rates
 */
function PatternBarChart({ patterns, maxValue = 100 }) {
  if (!patterns || patterns.length === 0) return null;

  const barHeight = 24;
  const barGap = 8;
  const chartHeight = patterns.length * (barHeight + barGap) - barGap;
  const labelWidth = 140;
  const valueWidth = 50;
  const barAreaWidth = 200;

  return (
    <svg
      className="pattern-bar-chart"
      width="100%"
      height={chartHeight}
      viewBox={`0 0 ${labelWidth + barAreaWidth + valueWidth + 20} ${chartHeight}`}
    >
      {patterns.map((pattern, index) => {
        const y = index * (barHeight + barGap);
        const barWidth = (pattern.success_rate / maxValue) * barAreaWidth;
        const barColor = pattern.success_rate >= 80
          ? 'var(--neon-cyan)'
          : pattern.success_rate >= 60
            ? 'var(--neon-amber)'
            : 'var(--neon-crimson)';

        return (
          <g key={pattern.pattern_name || index}>
            {/* Label */}
            <text
              x={0}
              y={y + barHeight / 2 + 4}
              fill="#888"
              fontSize="11"
              fontFamily="monospace"
            >
              {truncateText(pattern.pattern_name, 18)}
            </text>

            {/* Bar background */}
            <rect
              x={labelWidth}
              y={y}
              width={barAreaWidth}
              height={barHeight}
              fill="rgba(255,255,255,0.05)"
              rx="4"
            />

            {/* Bar fill */}
            <rect
              x={labelWidth}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={barColor}
              fillOpacity="0.7"
              rx="4"
            />

            {/* Value */}
            <text
              x={labelWidth + barAreaWidth + 8}
              y={y + barHeight / 2 + 4}
              fill="#fff"
              fontSize="12"
              fontWeight="600"
            >
              {pattern.success_rate}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Confidence trend mini chart
 */
function ConfidenceTrendChart({ trendData }) {
  if (!trendData || trendData.length < 2) {
    return (
      <div className="trend-chart-empty">
        Not enough data for trend visualization
      </div>
    );
  }

  const width = 300;
  const height = 80;
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const minValue = Math.min(...trendData.map(d => d.confidence)) * 0.9;
  const maxValue = Math.max(...trendData.map(d => d.confidence)) * 1.1;

  const xScale = (i) => padding.left + (i / (trendData.length - 1)) * chartWidth;
  const yScale = (v) => padding.top + chartHeight - ((v - minValue) / (maxValue - minValue)) * chartHeight;

  // Create path
  const pathD = trendData.map((d, i) => {
    const x = xScale(i);
    const y = yScale(d.confidence);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg className="confidence-trend-chart" width={width} height={height}>
      {/* Grid lines */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={height - padding.bottom}
        stroke="rgba(255,255,255,0.1)"
      />
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="rgba(255,255,255,0.1)"
      />

      {/* Trend line */}
      <path
        d={pathD}
        fill="none"
        stroke="var(--neon-cyan)"
        strokeWidth="2"
      />

      {/* Data points */}
      {trendData.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(d.confidence)}
          r="3"
          fill="var(--neon-cyan)"
        />
      ))}

      {/* Y-axis labels */}
      <text x={2} y={padding.top + 4} fill="#666" fontSize="9">
        {(maxValue * 100).toFixed(0)}%
      </text>
      <text x={2} y={height - padding.bottom} fill="#666" fontSize="9">
        {(minValue * 100).toFixed(0)}%
      </text>

      {/* X-axis label */}
      <text x={width / 2} y={height - 2} fill="#666" fontSize="9" textAnchor="middle">
        Last {trendData.length} cycles
      </text>
    </svg>
  );
}

/**
 * Pattern insight card
 */
function PatternInsightCard({ pattern, type }) {
  const {
    pattern_name,
    success_rate,
    application_count,
    agents_affected,
    last_applied,
    improvement_suggestion,
  } = pattern;

  const isTopPattern = type === 'top';
  const isNeedsImprovement = type === 'needs_improvement';
  const isCrossAgent = type === 'cross_agent';

  return (
    <div className={`learning-pattern-card ${type}`}>
      <div className="pattern-card-header">
        <span className="pattern-name">{pattern_name}</span>
        <span className={`pattern-success ${success_rate >= 80 ? 'high' : success_rate >= 60 ? 'medium' : 'low'}`}>
          {success_rate}%
        </span>
      </div>

      <div className="pattern-card-stats">
        <div className="pattern-stat">
          <span className="stat-label">Applications</span>
          <span className="stat-value">{application_count || 0}</span>
        </div>
        {agents_affected && agents_affected.length > 0 && (
          <div className="pattern-stat">
            <span className="stat-label">Agents</span>
            <span className="stat-value">{agents_affected.length}</span>
          </div>
        )}
        {last_applied && (
          <div className="pattern-stat">
            <span className="stat-label">Last Applied</span>
            <span className="stat-value">{formatRelativeTime(last_applied)}</span>
          </div>
        )}
      </div>

      {isCrossAgent && agents_affected && agents_affected.length > 0 && (
        <div className="pattern-agents">
          {agents_affected.map((agent, i) => (
            <span key={i} className="agent-chip">{agent.toUpperCase()}</span>
          ))}
        </div>
      )}

      {isNeedsImprovement && improvement_suggestion && (
        <div className="pattern-suggestion">
          <span className="suggestion-icon">&#128161;</span>
          {improvement_suggestion}
        </div>
      )}
    </div>
  );
}

/**
 * Truncate text helper
 */
function truncateText(text, maxLength = 20) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Loading skeleton
 */
function InsightsSkeleton() {
  return (
    <div className="learning-insights-content">
      <div className="insights-section">
        <div className="skeleton" style={{ width: '150px', height: '16px', marginBottom: '12px' }} />
        <div className="skeleton" style={{ width: '100%', height: '120px' }} />
      </div>
      <div className="insights-section">
        <div className="skeleton" style={{ width: '180px', height: '16px', marginBottom: '12px' }} />
        {[1, 2].map(i => (
          <div key={i} className="skeleton" style={{ width: '100%', height: '80px', marginBottom: '8px' }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Main Learning Insights Panel component
 */
export function LearningInsightsPanel({ showRefresh = true }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBot, setSelectedBot] = useState('all');
  const [knowledgeBots, setKnowledgeBots] = useState([]);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      const botParam = selectedBot !== 'all' ? `?bot_id=${selectedBot}` : '';
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/learning-insights${botParam}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setInsights(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Fallback mock data
      setInsights(getMockInsights());
    } finally {
      setLoading(false);
    }
  }, [selectedBot]);

  const fetchKnowledgeBots = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setKnowledgeBots(data.bots || []);
    } catch (err) {
      // Fallback mock data
      setKnowledgeBots([
        { bot_id: 'kb-executive', bot_name: 'Executive KB' },
        { bot_id: 'kb-operations', bot_name: 'Operations KB' },
        { bot_id: 'kb-technology', bot_name: 'Technology KB' },
        { bot_id: 'kb-finance', bot_name: 'Finance KB' },
      ]);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBots();
  }, [fetchKnowledgeBots]);

  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, 60000);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  if (loading && !insights) {
    return (
      <div className="learning-insights-panel">
        <div className="panel-header">
          <div className="header-left">
            <span className="panel-icon">&#128200;</span>
            <span className="panel-title">Learning Insights</span>
          </div>
        </div>
        <InsightsSkeleton />
      </div>
    );
  }

  return (
    <div className="learning-insights-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">&#128200;</span>
          <span className="panel-title">Learning Insights</span>
        </div>
        <div className="header-right">
          <div className="filter-group">
            <label>Bot:</label>
            <select
              className="filter-select"
              value={selectedBot}
              onChange={(e) => setSelectedBot(e.target.value)}
            >
              <option value="all">All Bots</option>
              {knowledgeBots.map(bot => (
                <option key={bot.bot_id} value={bot.bot_id}>{bot.bot_name}</option>
              ))}
            </select>
          </div>
          {showRefresh && (
            <button
              className="refresh-btn-small"
              onClick={fetchInsights}
              title="Refresh"
              aria-label="Refresh learning insights"
            >
              &#8635;
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <div className="learning-insights-content">
        {/* Top Patterns Section */}
        <div className="insights-section">
          <h4 className="section-title">Top Patterns by Success Rate</h4>
          {insights?.top_patterns && insights.top_patterns.length > 0 ? (
            <PatternBarChart patterns={insights.top_patterns.slice(0, 6)} />
          ) : (
            <div className="insights-empty">No patterns recorded yet</div>
          )}
        </div>

        {/* Patterns Needing Improvement */}
        <div className="insights-section">
          <h4 className="section-title">Patterns Needing Improvement</h4>
          {insights?.needs_improvement && insights.needs_improvement.length > 0 ? (
            <div className="pattern-cards-list">
              {insights.needs_improvement.slice(0, 4).map((pattern, i) => (
                <PatternInsightCard key={i} pattern={pattern} type="needs_improvement" />
              ))}
            </div>
          ) : (
            <div className="insights-empty success">
              &#10004; All patterns performing well
            </div>
          )}
        </div>

        {/* Cross-Subordinate Insights */}
        <div className="insights-section">
          <h4 className="section-title">Cross-Subordinate Insights</h4>
          <p className="section-description">Patterns that improved multiple agents</p>
          {insights?.cross_subordinate && insights.cross_subordinate.length > 0 ? (
            <div className="pattern-cards-list">
              {insights.cross_subordinate.slice(0, 4).map((pattern, i) => (
                <PatternInsightCard key={i} pattern={pattern} type="cross_agent" />
              ))}
            </div>
          ) : (
            <div className="insights-empty">No cross-agent patterns detected yet</div>
          )}
        </div>

        {/* Confidence Trend */}
        <div className="insights-section">
          <h4 className="section-title">Confidence Trend Over Time</h4>
          {insights?.confidence_trend && insights.confidence_trend.length > 0 ? (
            <ConfidenceTrendChart trendData={insights.confidence_trend} />
          ) : (
            <div className="insights-empty">Not enough data for trend analysis</div>
          )}
        </div>

        {/* Summary Stats */}
        {insights?.summary && (
          <div className="insights-summary">
            <div className="summary-stat">
              <span className="summary-value">{insights.summary.total_patterns || 0}</span>
              <span className="summary-label">Total Patterns</span>
            </div>
            <div className="summary-stat">
              <span className="summary-value">{insights.summary.avg_success_rate || 0}%</span>
              <span className="summary-label">Avg Success</span>
            </div>
            <div className="summary-stat">
              <span className="summary-value">{insights.summary.total_applications || 0}</span>
              <span className="summary-label">Applications</span>
            </div>
            <div className="summary-stat">
              <span className="summary-value">{insights.summary.agents_improved || 0}</span>
              <span className="summary-label">Agents Improved</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mock data for development/fallback
 */
function getMockInsights() {
  return {
    top_patterns: [
      { pattern_name: 'budget_variance_check', success_rate: 94, application_count: 28 },
      { pattern_name: 'security_scan_protocol', success_rate: 91, application_count: 45 },
      { pattern_name: 'code_review_checklist', success_rate: 88, application_count: 62 },
      { pattern_name: 'vendor_eval_matrix', success_rate: 85, application_count: 18 },
      { pattern_name: 'risk_assessment_flow', success_rate: 82, application_count: 34 },
      { pattern_name: 'compliance_validation', success_rate: 79, application_count: 22 },
    ],
    needs_improvement: [
      {
        pattern_name: 'cross_team_handoff',
        success_rate: 52,
        application_count: 15,
        agents_affected: ['coo', 'cto'],
        last_applied: new Date(Date.now() - 86400000).toISOString(),
        improvement_suggestion: 'Consider adding explicit state validation before handoff to reduce context loss.',
      },
      {
        pattern_name: 'escalation_timing',
        success_rate: 48,
        application_count: 8,
        agents_affected: ['cfo'],
        last_applied: new Date(Date.now() - 172800000).toISOString(),
        improvement_suggestion: 'Escalation threshold may be too sensitive. Review trigger conditions.',
      },
    ],
    cross_subordinate: [
      {
        pattern_name: 'strategic_alignment',
        success_rate: 87,
        application_count: 42,
        agents_affected: ['ceo', 'coo', 'cfo', 'cto'],
        last_applied: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        pattern_name: 'risk_communication',
        success_rate: 83,
        application_count: 31,
        agents_affected: ['ciso', 'clo', 'cro'],
        last_applied: new Date(Date.now() - 14400000).toISOString(),
      },
      {
        pattern_name: 'resource_optimization',
        success_rate: 79,
        application_count: 24,
        agents_affected: ['coo', 'cfo', 'devops'],
        last_applied: new Date(Date.now() - 21600000).toISOString(),
      },
    ],
    confidence_trend: [
      { cycle: 1, confidence: 0.72 },
      { cycle: 2, confidence: 0.74 },
      { cycle: 3, confidence: 0.71 },
      { cycle: 4, confidence: 0.76 },
      { cycle: 5, confidence: 0.78 },
      { cycle: 6, confidence: 0.77 },
      { cycle: 7, confidence: 0.81 },
      { cycle: 8, confidence: 0.83 },
      { cycle: 9, confidence: 0.85 },
      { cycle: 10, confidence: 0.84 },
    ],
    summary: {
      total_patterns: 47,
      avg_success_rate: 78,
      total_applications: 284,
      agents_improved: 12,
    },
  };
}

export default LearningInsightsPanel;
