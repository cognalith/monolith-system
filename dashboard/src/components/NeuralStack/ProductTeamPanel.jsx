/**
 * PRODUCT TEAM PANEL - Phase 6E
 * Cognalith Inc. | Monolith System
 *
 * Specialized panel for the Product Team.
 * Features:
 * - Team header with CPO info
 * - 3 subordinate cards (UX Research, Product Analytics, Feature Spec)
 * - Knowledge Bot status
 * - Product-specific recommendation queue
 * - Recent activity feed
 * - Product metrics (optional)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.js';

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const TREND_CONFIG = {
  IMPROVING: { icon: '\u2191', label: 'Improving', className: 'trend-improving' },
  STABLE: { icon: '\u2192', label: 'Stable', className: 'trend-stable' },
  DECLINING: { icon: '\u2193', label: 'Declining', className: 'trend-declining' },
};

const HEALTH_STATUS = {
  healthy: { color: 'var(--neon-teal)', bg: 'rgba(0, 201, 167, 0.15)' },
  attention: { color: 'var(--neon-amber)', bg: 'rgba(255, 184, 0, 0.15)' },
  critical: { color: 'var(--neon-crimson)', bg: 'rgba(255, 0, 60, 0.15)' },
};

const SPECIALTY_CONFIG = {
  ux_research: { label: 'UX Research', icon: '\u{1F464}' },
  analytics: { label: 'Analytics', icon: '\u{1F4CA}' },
  feature_spec: { label: 'Feature Spec', icon: '\u{1F4DD}' },
};

const ACTIVITY_TYPE_CONFIG = {
  review: { label: 'Review', className: 'activity-review' },
  amendment: { label: 'Amendment', className: 'activity-amendment' },
  escalation: { label: 'Escalation', className: 'activity-escalation' },
  recommendation: { label: 'Recommendation', className: 'activity-recommendation' },
};

const IMPACT_CONFIG = {
  high: { label: 'High', className: 'impact-high' },
  medium: { label: 'Medium', className: 'impact-medium' },
  low: { label: 'Low', className: 'impact-low' },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getHealthStatus(score) {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'attention';
  return 'critical';
}

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

function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================================================
// TEAM HEADER COMPONENT
// ============================================================================

function ProductTeamHeader({ cpo, teamHealth, lastReview, onTriggerReview, isReviewing }) {
  const healthStatus = getHealthStatus(teamHealth);
  const healthConfig = HEALTH_STATUS[healthStatus];

  return (
    <div className="product-team-header">
      <div className="product-team-title-row">
        <div className="product-team-title">
          <span className="product-team-icon">{'\u{1F4E6}'}</span>
          <span className="product-team-name">Product Team</span>
        </div>
        <div className="product-team-health-indicator" style={{ color: healthConfig.color }}>
          <span className="health-dot" style={{ background: healthConfig.color }} />
          <span>Team Health: {teamHealth}%</span>
        </div>
      </div>

      <div className="product-team-cpo-card">
        <div className="cpo-avatar product">
          <span>P</span>
        </div>
        <div className="cpo-info">
          <div className="cpo-role">CPO</div>
          <div className="cpo-name">{cpo?.name || 'Chief Product Officer'}</div>
        </div>
        <div className="cpo-stats">
          <div className="cpo-stat">
            <span className="stat-value product">{cpo?.healthScore || 0}%</span>
            <span className="stat-label">Health</span>
          </div>
          <div className="cpo-stat">
            <span className="stat-value">{cpo?.activeAmendments || 0}</span>
            <span className="stat-label">Amendments</span>
          </div>
        </div>
        <div className="cpo-review-section">
          <div className="last-review">
            Last Review: {formatRelativeTime(lastReview)}
          </div>
          <button
            className="trigger-review-btn product"
            onClick={onTriggerReview}
            disabled={isReviewing}
          >
            {isReviewing ? 'Reviewing...' : 'Trigger Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUBORDINATE CARD COMPONENT
// ============================================================================

function ProductSubordinateCard({ subordinate }) {
  const {
    role,
    specialty,
    trend,
    variancePercent,
    recentTasks,
    activeAmendments,
    lastReviewed,
    healthScore,
    varianceHistory,
  } = subordinate;

  const trendConfig = TREND_CONFIG[trend] || TREND_CONFIG.STABLE;
  const healthStatus = getHealthStatus(healthScore);
  const healthConfig = HEALTH_STATUS[healthStatus];
  const specialtyConfig = SPECIALTY_CONFIG[specialty] || { label: specialty, icon: '' };

  return (
    <div
      className="product-subordinate-card"
      style={{ borderLeft: `3px solid ${healthConfig.color}` }}
    >
      <div className="subordinate-card-header">
        <div className="subordinate-role-section">
          <span className="subordinate-role">{role?.toUpperCase()}</span>
          <span className="subordinate-specialty product">
            {specialtyConfig.icon} {specialtyConfig.label}
          </span>
        </div>
        <div className={`subordinate-trend ${trendConfig.className}`}>
          <span className="trend-icon">{trendConfig.icon}</span>
          <span className="trend-label">{trendConfig.label}</span>
        </div>
      </div>

      <div className="subordinate-metrics">
        <div className="subordinate-metric">
          <span className="metric-label">Variance</span>
          <span className={`metric-value variance-badge ${variancePercent > 15 ? 'high' : variancePercent > 8 ? 'medium' : 'low'}`}>
            {variancePercent?.toFixed(1) || 0}%
          </span>
        </div>
        <div className="subordinate-metric">
          <span className="metric-label">Tasks (7d)</span>
          <span className="metric-value">{recentTasks || 0}</span>
        </div>
        <div className="subordinate-metric">
          <span className="metric-label">Amendments</span>
          <span className={`metric-value ${activeAmendments > 2 ? 'warning' : ''}`}>
            {activeAmendments || 0}
          </span>
        </div>
        <div className="subordinate-metric">
          <span className="metric-label">Last Review</span>
          <span className="metric-value">{formatRelativeTime(lastReviewed)}</span>
        </div>
      </div>

      {varianceHistory && varianceHistory.length > 0 && (
        <div className="subordinate-sparkline">
          <MiniSparkline data={varianceHistory} color="var(--neon-teal)" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MINI SPARKLINE COMPONENT
// ============================================================================

function MiniSparkline({ data, color = 'var(--neon-teal)' }) {
  if (!data || data.length < 2) return null;

  const width = 80;
  const height = 20;
  const padding = 2;

  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((value - minVal) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const isImproving = data[data.length - 1] < data[0];
  const strokeColor = isImproving ? color : 'var(--neon-crimson)';

  return (
    <svg width={width} height={height} className="sparkline-svg">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        points={points}
      />
      <circle
        cx={padding + ((data.length - 1) / (data.length - 1)) * (width - 2 * padding)}
        cy={height - padding - ((data[data.length - 1] - minVal) / range) * (height - 2 * padding)}
        r="2"
        fill={strokeColor}
      />
    </svg>
  );
}

// ============================================================================
// KNOWLEDGE BOT STATUS COMPONENT
// ============================================================================

function ProductKnowledgeBotStatus({ bot, onRunResearch, isRunning }) {
  const {
    lastResearchCycle,
    recommendationsToday,
    pendingRecommendations,
    successRate,
  } = bot;

  return (
    <div className="product-knowledge-bot">
      <div className="kb-header">
        <div className="kb-title">
          <span className="kb-icon">{'\u{1F916}'}</span>
          <span>product_knowledge_bot</span>
        </div>
        <span className="kb-status-badge active product">Active</span>
      </div>

      <div className="kb-stats-grid">
        <div className="kb-stat">
          <span className="stat-value">{formatRelativeTime(lastResearchCycle)}</span>
          <span className="stat-label">Last Research</span>
        </div>
        <div className="kb-stat">
          <span className="stat-value">{recommendationsToday || 0}</span>
          <span className="stat-label">Today's Recs</span>
        </div>
        <div className="kb-stat">
          <span className="stat-value">{pendingRecommendations || 0}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="kb-stat">
          <span className={`stat-value ${successRate >= 80 ? 'positive' : successRate >= 60 ? 'warning' : 'negative'}`}>
            {successRate || 0}%
          </span>
          <span className="stat-label">Success Rate</span>
        </div>
      </div>

      <button
        className="kb-run-research-btn product"
        onClick={onRunResearch}
        disabled={isRunning}
      >
        {isRunning ? 'Running Research...' : 'Run Research'}
      </button>
    </div>
  );
}

// ============================================================================
// PRODUCT RECOMMENDATION QUEUE COMPONENT
// ============================================================================

function ProductRecommendationQueue({ recommendations, onApply }) {
  // Group recommendations by subordinate
  const groupedRecs = useMemo(() => {
    const groups = {};
    recommendations.forEach(rec => {
      const sub = rec.subordinateRole;
      if (!groups[sub]) groups[sub] = [];
      groups[sub].push(rec);
    });
    return groups;
  }, [recommendations]);

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="product-recommendation-queue">
        <div className="product-rec-header">
          <span className="product-rec-icon">{'\u{1F4CB}'}</span>
          <span className="product-rec-title">Recommendation Queue</span>
        </div>
        <div className="product-rec-empty">
          No pending recommendations for Product Team
        </div>
      </div>
    );
  }

  return (
    <div className="product-recommendation-queue">
      <div className="product-rec-header">
        <span className="product-rec-icon">{'\u{1F4CB}'}</span>
        <span className="product-rec-title">Recommendation Queue</span>
        <span className="product-rec-count">{recommendations.length}</span>
      </div>

      <div className="product-rec-list">
        {Object.keys(groupedRecs).sort().map(subordinate => (
          <div key={subordinate} className="product-rec-group">
            <div className="product-rec-group-header">
              {subordinate.toUpperCase()}
              <span className="group-count">{groupedRecs[subordinate].length}</span>
            </div>
            {groupedRecs[subordinate].map((rec, idx) => (
              <ProductRecommendationItem
                key={rec.id || idx}
                recommendation={rec}
                onApply={onApply}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductRecommendationItem({ recommendation, onApply }) {
  const { id, type, content, impact } = recommendation;
  const impactConfig = IMPACT_CONFIG[impact] || IMPACT_CONFIG.medium;

  return (
    <div className="product-rec-item">
      <div className="product-rec-item-header">
        <span className={`product-rec-type ${type}`}>{type}</span>
        <span className={`product-rec-impact ${impactConfig.className}`}>
          {impactConfig.label}
        </span>
      </div>
      <div className="product-rec-content">
        {truncateText(content, 120)}
      </div>
      <button
        className="product-rec-apply-btn"
        onClick={() => onApply(recommendation)}
      >
        Apply
      </button>
    </div>
  );
}

// ============================================================================
// RECENT ACTIVITY FEED COMPONENT
// ============================================================================

function ProductRecentActivityFeed({ activities, filter, onFilterChange }) {
  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (filter === 'all') return activities;
    return activities.filter(a => a.subordinateRole === filter);
  }, [activities, filter]);

  const uniqueSubordinates = useMemo(() => {
    if (!activities) return [];
    return [...new Set(activities.map(a => a.subordinateRole))].sort();
  }, [activities]);

  return (
    <div className="product-activity-feed">
      <div className="product-activity-header">
        <div className="product-activity-title">
          <span className="activity-icon">{'\u{1F4CA}'}</span>
          <span>Recent Activity</span>
        </div>
        <select
          className="activity-filter-select product"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">All Subordinates</option>
          {uniqueSubordinates.map(sub => (
            <option key={sub} value={sub}>{sub.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="product-activity-list">
        {filteredActivities.length === 0 ? (
          <div className="product-activity-empty">No recent activity</div>
        ) : (
          filteredActivities.slice(0, 10).map((activity, idx) => (
            <ProductActivityItem key={activity.id || idx} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}

function ProductActivityItem({ activity }) {
  const { type, subordinateRole, description, timestamp, outcome } = activity;
  const typeConfig = ACTIVITY_TYPE_CONFIG[type] || { label: type, className: '' };

  return (
    <div className="product-activity-item">
      <div className="activity-item-row">
        <span className={`activity-type-badge ${typeConfig.className}`}>
          {typeConfig.label}
        </span>
        <span className="activity-subordinate product">{subordinateRole?.toUpperCase()}</span>
        <span className="activity-time">{formatRelativeTime(timestamp)}</span>
      </div>
      <div className="activity-description">{truncateText(description, 100)}</div>
      {outcome && (
        <span className={`activity-outcome ${outcome.toLowerCase()}`}>{outcome}</span>
      )}
    </div>
  );
}

// ============================================================================
// PRODUCT METRICS COMPONENT (OPTIONAL)
// ============================================================================

function ProductMetrics({ metrics }) {
  const {
    userStudiesCompleted,
    abTestsRunning,
    featuresInSpec,
    prdsPendingReview,
  } = metrics || {};

  return (
    <div className="product-metrics">
      <div className="product-metrics-header">
        <span className="metrics-icon">{'\u{1F4CA}'}</span>
        <span className="metrics-title">Product Metrics (This Week)</span>
      </div>
      <div className="product-metrics-grid">
        <div className="product-metric-card">
          <div className="metric-icon">{'\u{1F464}'}</div>
          <div className="metric-value">{userStudiesCompleted || 0}</div>
          <div className="metric-label">User Studies</div>
        </div>
        <div className="product-metric-card">
          <div className="metric-icon">{'\u{1F9EA}'}</div>
          <div className={`metric-value ${abTestsRunning >= 3 ? 'positive' : abTestsRunning >= 1 ? 'warning' : 'negative'}`}>
            {abTestsRunning || 0}
          </div>
          <div className="metric-label">A/B Tests Running</div>
        </div>
        <div className="product-metric-card">
          <div className="metric-icon">{'\u{1F4DD}'}</div>
          <div className={`metric-value ${featuresInSpec >= 5 ? 'positive' : featuresInSpec >= 2 ? '' : 'negative'}`}>
            {featuresInSpec || 0}
          </div>
          <div className="metric-label">Features in Spec</div>
        </div>
        <div className="product-metric-card">
          <div className="metric-icon">{'\u{1F4C4}'}</div>
          <div className={`metric-value ${prdsPendingReview > 5 ? 'warning' : prdsPendingReview > 0 ? '' : 'positive'}`}>
            {prdsPendingReview || 0}
          </div>
          <div className="metric-label">PRDs Pending</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

function ProductTeamHeaderSkeleton() {
  return (
    <div className="product-team-header">
      <div className="product-team-title-row">
        <div className="skeleton" style={{ width: '200px', height: '24px' }} />
        <div className="skeleton" style={{ width: '150px', height: '20px' }} />
      </div>
      <div className="product-team-cpo-card">
        <div className="skeleton" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
        <div className="cpo-info">
          <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '4px' }} />
          <div className="skeleton" style={{ width: '150px', height: '14px' }} />
        </div>
      </div>
    </div>
  );
}

function ProductSubordinateCardSkeleton() {
  return (
    <div className="product-subordinate-card">
      <div className="subordinate-card-header">
        <div className="skeleton" style={{ width: '100px', height: '16px' }} />
        <div className="skeleton" style={{ width: '80px', height: '16px' }} />
      </div>
      <div className="subordinate-metrics">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="subordinate-metric">
            <div className="skeleton" style={{ width: '50px', height: '10px', marginBottom: '4px' }} />
            <div className="skeleton" style={{ width: '40px', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PRODUCT TEAM PANEL COMPONENT
// ============================================================================

export function ProductTeamPanel({ showRefresh = true }) {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams/product`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTeamData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Use mock data as fallback
      setTeamData(getMockProductTeamData());
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerReview = useCallback(async () => {
    try {
      setIsReviewing(true);
      await fetch(`${API_BASE_URL}/api/neural-stack/teams/product/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      await fetchTeamData();
    } catch (err) {
      console.error('Failed to trigger review:', err);
    } finally {
      setIsReviewing(false);
    }
  }, [fetchTeamData]);

  const runResearch = useCallback(async () => {
    try {
      setIsResearching(true);
      await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots/kb-product/trigger-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      await fetchTeamData();
    } catch (err) {
      console.error('Failed to run research:', err);
    } finally {
      setIsResearching(false);
    }
  }, [fetchTeamData]);

  const applyRecommendation = useCallback(async (recommendation) => {
    try {
      await fetch(`${API_BASE_URL}/api/neural-stack/recommendations/${recommendation.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      await fetchTeamData();
    } catch (err) {
      console.error('Failed to apply recommendation:', err);
    }
  }, [fetchTeamData]);

  useEffect(() => {
    fetchTeamData();
    const interval = setInterval(fetchTeamData, 30000);
    return () => clearInterval(interval);
  }, [fetchTeamData]);

  if (loading && !teamData) {
    return (
      <div className="product-team-panel">
        <ProductTeamHeaderSkeleton />
        <div className="product-subordinate-grid">
          {[1, 2, 3].map(i => (
            <ProductSubordinateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="product-team-panel">
      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <ProductTeamHeader
        cpo={teamData?.cpo}
        teamHealth={teamData?.teamHealth || 0}
        lastReview={teamData?.lastReview}
        onTriggerReview={triggerReview}
        isReviewing={isReviewing}
      />

      <div className="product-subordinate-grid">
        {teamData?.subordinates?.map((sub, idx) => (
          <ProductSubordinateCard key={sub.role || idx} subordinate={sub} />
        ))}
      </div>

      <div className="product-bottom-row">
        <ProductKnowledgeBotStatus
          bot={teamData?.knowledgeBot || {}}
          onRunResearch={runResearch}
          isRunning={isResearching}
        />

        <ProductRecommendationQueue
          recommendations={teamData?.recommendations || []}
          onApply={applyRecommendation}
        />
      </div>

      <ProductRecentActivityFeed
        activities={teamData?.recentActivity || []}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
      />

      {teamData?.productMetrics && (
        <ProductMetrics metrics={teamData.productMetrics} />
      )}

      {showRefresh && (
        <div className="product-panel-footer">
          <button
            className="refresh-btn-small product"
            onClick={fetchTeamData}
            title="Refresh Product Team data"
          >
            {'\u21BB'} Refresh
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockProductTeamData() {
  return {
    teamHealth: 79,
    lastReview: new Date(Date.now() - 3000000).toISOString(),
    cpo: {
      name: 'Chief Product Officer',
      healthScore: 84,
      activeAmendments: 2,
    },
    subordinates: [
      {
        role: 'ux_research_lead',
        specialty: 'ux_research',
        trend: 'IMPROVING',
        variancePercent: 6.8,
        recentTasks: 14,
        activeAmendments: 1,
        lastReviewed: new Date(Date.now() - 3600000).toISOString(),
        healthScore: 88,
        varianceHistory: [11, 10, 9, 8, 7, 6.8],
      },
      {
        role: 'product_analytics_lead',
        specialty: 'analytics',
        trend: 'STABLE',
        variancePercent: 10.2,
        recentTasks: 22,
        activeAmendments: 1,
        lastReviewed: new Date(Date.now() - 5400000).toISOString(),
        healthScore: 76,
        varianceHistory: [9, 10, 11, 10, 10, 10.2],
      },
      {
        role: 'feature_spec_lead',
        specialty: 'feature_spec',
        trend: 'DECLINING',
        variancePercent: 14.5,
        recentTasks: 18,
        activeAmendments: 3,
        lastReviewed: new Date(Date.now() - 9000000).toISOString(),
        healthScore: 68,
        varianceHistory: [8, 10, 11, 12, 13, 14.5],
      },
    ],
    knowledgeBot: {
      lastResearchCycle: new Date(Date.now() - 4200000).toISOString(),
      recommendationsToday: 4,
      pendingRecommendations: 2,
      successRate: 81,
    },
    recommendations: [
      {
        id: 'rec-prod-1',
        type: 'ux_insight',
        subordinateRole: 'ux_research_lead',
        content: 'Consider adding usability testing protocol for mobile checkout flow based on recent drop-off data.',
        impact: 'high',
      },
      {
        id: 'rec-prod-2',
        type: 'analytics_enhancement',
        subordinateRole: 'product_analytics_lead',
        content: 'Implement cohort analysis for new user onboarding to identify retention bottlenecks.',
        impact: 'medium',
      },
      {
        id: 'rec-prod-3',
        type: 'spec_improvement',
        subordinateRole: 'feature_spec_lead',
        content: 'Update PRD template to include edge case scenarios and rollback procedures.',
        impact: 'high',
      },
    ],
    recentActivity: [
      {
        id: 'act-prod-1',
        type: 'review',
        subordinateRole: 'ux_research_lead',
        description: 'CPO reviewed user interview findings for Q1 feature roadmap',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        outcome: 'APPROVED',
      },
      {
        id: 'act-prod-2',
        type: 'amendment',
        subordinateRole: 'product_analytics_lead',
        description: 'Knowledge update applied: funnel tracking methodology',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
        outcome: 'ACTIVE',
      },
      {
        id: 'act-prod-3',
        type: 'recommendation',
        subordinateRole: 'feature_spec_lead',
        description: 'New recommendation generated: PRD template improvements',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'act-prod-4',
        type: 'escalation',
        subordinateRole: 'feature_spec_lead',
        description: 'Rising variance escalated to CPO: spec completeness concerns',
        timestamp: new Date(Date.now() - 9000000).toISOString(),
        outcome: 'ACKNOWLEDGED',
      },
      {
        id: 'act-prod-5',
        type: 'review',
        subordinateRole: 'product_analytics_lead',
        description: 'CPO reviewed A/B test results for pricing page redesign',
        timestamp: new Date(Date.now() - 12600000).toISOString(),
        outcome: 'NEEDS_IMPROVEMENT',
      },
    ],
    productMetrics: {
      userStudiesCompleted: 6,
      abTestsRunning: 3,
      featuresInSpec: 8,
      prdsPendingReview: 4,
    },
  };
}

export default ProductTeamPanel;
