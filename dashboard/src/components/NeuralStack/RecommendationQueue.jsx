/**
 * RECOMMENDATION QUEUE - Phase 6B
 * Cognalith Inc. | Monolith System
 *
 * Pending recommendations by subordinate showing:
 * - Grouped by subordinate role
 * - Type badge (knowledge_addition, knowledge_modification, skill_suggestion)
 * - Content preview (truncated)
 * - Expected impact (high/medium/low with color)
 * - Targeting pattern
 * - Created date
 * - "Select" button to apply as amendment
 * - Filter by subordinate
 * - Filter by impact level
 * - Sort by date or impact
 * - Empty state when no pending recommendations
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.js';

const TYPE_CONFIG = {
  knowledge_addition: { label: 'Addition', className: 'type-addition' },
  knowledge_modification: { label: 'Modification', className: 'type-modification' },
  skill_suggestion: { label: 'Skill', className: 'type-suggestion' },
};

const IMPACT_CONFIG = {
  high: { label: 'High', className: 'impact-high' },
  medium: { label: 'Medium', className: 'impact-medium' },
  low: { label: 'Low', className: 'impact-low' },
};

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
  if (!dateString) return 'Unknown';
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
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Individual recommendation card component
 */
function RecommendationCard({ recommendation, onSelect }) {
  const {
    id,
    recommendation_type,
    content_preview,
    expected_impact,
    targeting_pattern,
    created_at,
    subordinate_role,
    source_bot,
  } = recommendation;

  const typeConfig = TYPE_CONFIG[recommendation_type] || TYPE_CONFIG.knowledge_addition;
  const impactConfig = IMPACT_CONFIG[expected_impact] || IMPACT_CONFIG.medium;

  return (
    <div className="recommendation-card">
      <div className="rec-card-header">
        <div className="rec-badges">
          <span className={`rec-type-badge ${typeConfig.className}`}>
            {typeConfig.label}
          </span>
          <span className={`rec-impact-badge ${impactConfig.className}`}>
            {impactConfig.label} Impact
          </span>
        </div>
        <span className="rec-time">{formatRelativeTime(created_at)}</span>
      </div>

      <div className="rec-content">
        <p className="rec-preview">{truncateText(content_preview, 150)}</p>
      </div>

      {targeting_pattern && (
        <div className="rec-targeting">
          <span className="rec-targeting-label">Target:</span>
          <code className="rec-targeting-pattern">{targeting_pattern}</code>
        </div>
      )}

      <div className="rec-card-footer">
        <div className="rec-meta">
          <span className="rec-subordinate">For: {subordinate_role?.toUpperCase()}</span>
          {source_bot && <span className="rec-source">From: {source_bot}</span>}
        </div>
        <button
          className="rec-select-btn"
          onClick={() => onSelect && onSelect(recommendation)}
          title="Apply this recommendation as an amendment"
        >
          Select
        </button>
      </div>
    </div>
  );
}

/**
 * Recommendation card skeleton loader
 */
function RecommendationCardSkeleton() {
  return (
    <div className="recommendation-card">
      <div className="rec-card-header">
        <div className="rec-badges">
          <div className="skeleton" style={{ width: '70px', height: '20px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ width: '80px', height: '20px', borderRadius: '4px' }} />
        </div>
        <div className="skeleton" style={{ width: '50px', height: '12px' }} />
      </div>
      <div className="rec-content">
        <div className="skeleton" style={{ width: '100%', height: '14px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '80%', height: '14px' }} />
      </div>
      <div className="rec-card-footer">
        <div className="skeleton" style={{ width: '80px', height: '12px' }} />
        <div className="skeleton" style={{ width: '60px', height: '28px', borderRadius: '4px' }} />
      </div>
    </div>
  );
}

/**
 * Grouped recommendations by subordinate
 */
function SubordinateGroup({ subordinate, recommendations, onSelect }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rec-subordinate-group">
      <div
        className="rec-group-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        <span className="rec-group-expand">{expanded ? '\u25BC' : '\u25B6'}</span>
        <span className="rec-group-name">{subordinate.toUpperCase()}</span>
        <span className="rec-group-count">{recommendations.length} recommendations</span>
      </div>

      {expanded && (
        <div className="rec-group-items">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Main Recommendation Queue component
 */
export function RecommendationQueue({ onSelectRecommendation, showRefresh = true }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [subordinateFilter, setSubordinateFilter] = useState('all');
  const [impactFilter, setImpactFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date_desc');

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/recommendation-queue`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setRecommendations(data.recommendations || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Fallback mock data
      setRecommendations(getMockRecommendations());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
    const interval = setInterval(fetchRecommendations, 30000);
    return () => clearInterval(interval);
  }, [fetchRecommendations]);

  // Get unique subordinates for filter dropdown
  const uniqueSubordinates = useMemo(() => {
    const subs = [...new Set(recommendations.map(r => r.subordinate_role))];
    return subs.sort();
  }, [recommendations]);

  // Filter and sort recommendations
  const filteredRecommendations = useMemo(() => {
    let filtered = [...recommendations];

    // Apply subordinate filter
    if (subordinateFilter !== 'all') {
      filtered = filtered.filter(r => r.subordinate_role === subordinateFilter);
    }

    // Apply impact filter
    if (impactFilter !== 'all') {
      filtered = filtered.filter(r => r.expected_impact === impactFilter);
    }

    // Apply sorting
    switch (sortBy) {
      case 'date_asc':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'date_desc':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'impact_high':
        const impactOrder = { high: 0, medium: 1, low: 2 };
        filtered.sort((a, b) => impactOrder[a.expected_impact] - impactOrder[b.expected_impact]);
        break;
      case 'impact_low':
        const impactOrderRev = { low: 0, medium: 1, high: 2 };
        filtered.sort((a, b) => impactOrderRev[a.expected_impact] - impactOrderRev[b.expected_impact]);
        break;
      default:
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return filtered;
  }, [recommendations, subordinateFilter, impactFilter, sortBy]);

  // Group recommendations by subordinate
  const groupedRecommendations = useMemo(() => {
    const groups = {};
    filteredRecommendations.forEach(rec => {
      const sub = rec.subordinate_role;
      if (!groups[sub]) groups[sub] = [];
      groups[sub].push(rec);
    });
    return groups;
  }, [filteredRecommendations]);

  // Impact counts
  const impactCounts = useMemo(() => {
    return {
      high: recommendations.filter(r => r.expected_impact === 'high').length,
      medium: recommendations.filter(r => r.expected_impact === 'medium').length,
      low: recommendations.filter(r => r.expected_impact === 'low').length,
    };
  }, [recommendations]);

  const handleSelect = (recommendation) => {
    onSelectRecommendation && onSelectRecommendation(recommendation);
  };

  if (loading && recommendations.length === 0) {
    return (
      <div className="recommendation-queue">
        <div className="panel-header">
          <div className="header-left">
            <span className="panel-icon">&#128203;</span>
            <span className="panel-title">Recommendation Queue</span>
          </div>
        </div>
        <div className="rec-queue-list">
          {[...Array(3)].map((_, i) => (
            <RecommendationCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="recommendation-queue">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">&#128203;</span>
          <span className="panel-title">Recommendation Queue</span>
          <div className="rec-queue-summary">
            <span className="rec-count-badge">{recommendations.length} pending</span>
            {impactCounts.high > 0 && (
              <span className="rec-impact-count impact-high">{impactCounts.high} high</span>
            )}
          </div>
        </div>
        {showRefresh && (
          <button
            className="refresh-btn-small"
            onClick={fetchRecommendations}
            title="Refresh"
            aria-label="Refresh recommendations"
          >
            &#8635;
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <div className="rec-queue-filters">
        <div className="filter-group">
          <label>Subordinate:</label>
          <select
            className="filter-select"
            value={subordinateFilter}
            onChange={(e) => setSubordinateFilter(e.target.value)}
          >
            <option value="all">All</option>
            {uniqueSubordinates.map(sub => (
              <option key={sub} value={sub}>{sub.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Impact:</label>
          <select
            className="filter-select"
            value={impactFilter}
            onChange={(e) => setImpactFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sort:</label>
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="impact_high">Highest Impact</option>
            <option value="impact_low">Lowest Impact</option>
          </select>
        </div>
      </div>

      <div className="rec-queue-content">
        {filteredRecommendations.length === 0 ? (
          <div className="neural-stack-empty">
            <div className="neural-stack-empty-icon">&#128203;</div>
            <div>No pending recommendations</div>
            {(subordinateFilter !== 'all' || impactFilter !== 'all') && (
              <div className="empty-hint">Try adjusting your filters</div>
            )}
          </div>
        ) : (
          Object.keys(groupedRecommendations).sort().map(subordinate => (
            <SubordinateGroup
              key={subordinate}
              subordinate={subordinate}
              recommendations={groupedRecommendations[subordinate]}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Mock data for development/fallback
 */
function getMockRecommendations() {
  return [
    {
      id: 'rec-1',
      recommendation_type: 'knowledge_addition',
      content_preview: 'Add understanding of quarterly budget review processes including variance analysis thresholds and escalation procedures for budget overruns exceeding 10%.',
      expected_impact: 'high',
      targeting_pattern: 'budget_review:quarterly',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      subordinate_role: 'cfo',
      source_bot: 'Finance Knowledge Bot',
    },
    {
      id: 'rec-2',
      recommendation_type: 'knowledge_modification',
      content_preview: 'Update security incident response procedures to include new compliance requirements for data breach notification within 72 hours.',
      expected_impact: 'high',
      targeting_pattern: 'security:incident_response',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      subordinate_role: 'ciso',
      source_bot: 'Technology Knowledge Bot',
    },
    {
      id: 'rec-3',
      recommendation_type: 'skill_suggestion',
      content_preview: 'Consider developing capability for automated code review analysis with focus on security vulnerabilities and performance bottlenecks.',
      expected_impact: 'medium',
      targeting_pattern: 'code_review:automation',
      created_at: new Date(Date.now() - 14400000).toISOString(),
      subordinate_role: 'devops',
      source_bot: 'Technology Knowledge Bot',
    },
    {
      id: 'rec-4',
      recommendation_type: 'knowledge_addition',
      content_preview: 'Add knowledge about vendor contract renewal negotiation strategies based on recent successful renegotiations.',
      expected_impact: 'medium',
      targeting_pattern: 'vendor:contract_negotiation',
      created_at: new Date(Date.now() - 21600000).toISOString(),
      subordinate_role: 'coo',
      source_bot: 'Operations Knowledge Bot',
    },
    {
      id: 'rec-5',
      recommendation_type: 'knowledge_modification',
      content_preview: 'Adjust marketing campaign performance thresholds based on updated industry benchmarks for B2B SaaS conversion rates.',
      expected_impact: 'low',
      targeting_pattern: 'marketing:performance_metrics',
      created_at: new Date(Date.now() - 43200000).toISOString(),
      subordinate_role: 'cmo',
      source_bot: 'Executive Knowledge Bot',
    },
    {
      id: 'rec-6',
      recommendation_type: 'skill_suggestion',
      content_preview: 'Enhance capability for predictive analytics in financial forecasting using historical trend data.',
      expected_impact: 'high',
      targeting_pattern: 'forecasting:predictive',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      subordinate_role: 'cfo',
      source_bot: 'Finance Knowledge Bot',
    },
  ];
}

export default RecommendationQueue;
