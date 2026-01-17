/**
 * MARKETING TEAM PANEL - Phase 6D
 * Cognalith Inc. | Monolith System
 *
 * Specialized panel for the Marketing Team.
 * Features:
 * - Team header with CMO info
 * - 4 subordinate cards (Content, Social Media, SEO/Growth, Brand)
 * - Knowledge Bot status
 * - Marketing-specific recommendation queue
 * - Recent activity feed
 * - Marketing metrics (optional)
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
  healthy: { color: 'var(--neon-magenta)', bg: 'rgba(200, 50, 200, 0.15)' },
  attention: { color: 'var(--neon-amber)', bg: 'rgba(255, 184, 0, 0.15)' },
  critical: { color: 'var(--neon-crimson)', bg: 'rgba(255, 0, 60, 0.15)' },
};

const SPECIALTY_CONFIG = {
  content: { label: 'Content', icon: '\u{1F4DD}' },
  social: { label: 'Social', icon: '\u{1F517}' },
  seo: { label: 'SEO/Growth', icon: '\u{1F4C8}' },
  brand: { label: 'Brand', icon: '\u{1F3A8}' },
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

function MarketingTeamHeader({ cmo, teamHealth, lastReview, onTriggerReview, isReviewing }) {
  const healthStatus = getHealthStatus(teamHealth);
  const healthConfig = HEALTH_STATUS[healthStatus];

  return (
    <div className="marketing-team-header">
      <div className="marketing-team-title-row">
        <div className="marketing-team-title">
          <span className="marketing-team-icon">{'\u{1F4E3}'}</span>
          <span className="marketing-team-name">Marketing Team</span>
        </div>
        <div className="marketing-team-health-indicator" style={{ color: healthConfig.color }}>
          <span className="health-dot" style={{ background: healthConfig.color }} />
          <span>Team Health: {teamHealth}%</span>
        </div>
      </div>

      <div className="marketing-team-cmo-card">
        <div className="cmo-avatar marketing">
          <span>M</span>
        </div>
        <div className="cmo-info">
          <div className="cmo-role">CMO</div>
          <div className="cmo-name">{cmo?.name || 'Chief Marketing Officer'}</div>
        </div>
        <div className="cmo-stats">
          <div className="cmo-stat">
            <span className="stat-value marketing">{cmo?.healthScore || 0}%</span>
            <span className="stat-label">Health</span>
          </div>
          <div className="cmo-stat">
            <span className="stat-value">{cmo?.activeAmendments || 0}</span>
            <span className="stat-label">Amendments</span>
          </div>
        </div>
        <div className="cmo-review-section">
          <div className="last-review">
            Last Review: {formatRelativeTime(lastReview)}
          </div>
          <button
            className="trigger-review-btn marketing"
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

function MarketingSubordinateCard({ subordinate }) {
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
      className="marketing-subordinate-card"
      style={{ borderLeft: `3px solid ${healthConfig.color}` }}
    >
      <div className="subordinate-card-header">
        <div className="subordinate-role-section">
          <span className="subordinate-role">{role?.toUpperCase()}</span>
          <span className="subordinate-specialty marketing">
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
          <MiniSparkline data={varianceHistory} color="var(--neon-magenta)" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MINI SPARKLINE COMPONENT
// ============================================================================

function MiniSparkline({ data, color = 'var(--neon-magenta)' }) {
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

function MarketingKnowledgeBotStatus({ bot, onRunResearch, isRunning }) {
  const {
    lastResearchCycle,
    recommendationsToday,
    pendingRecommendations,
    successRate,
  } = bot;

  return (
    <div className="marketing-knowledge-bot">
      <div className="kb-header">
        <div className="kb-title">
          <span className="kb-icon">{'\u{1F916}'}</span>
          <span>marketing_knowledge_bot</span>
        </div>
        <span className="kb-status-badge active marketing">Active</span>
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
        className="kb-run-research-btn marketing"
        onClick={onRunResearch}
        disabled={isRunning}
      >
        {isRunning ? 'Running Research...' : 'Run Research'}
      </button>
    </div>
  );
}

// ============================================================================
// MARKETING RECOMMENDATION QUEUE COMPONENT
// ============================================================================

function MarketingRecommendationQueue({ recommendations, onApply }) {
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
      <div className="marketing-recommendation-queue">
        <div className="marketing-rec-header">
          <span className="marketing-rec-icon">{'\u{1F4CB}'}</span>
          <span className="marketing-rec-title">Recommendation Queue</span>
        </div>
        <div className="marketing-rec-empty">
          No pending recommendations for Marketing Team
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-recommendation-queue">
      <div className="marketing-rec-header">
        <span className="marketing-rec-icon">{'\u{1F4CB}'}</span>
        <span className="marketing-rec-title">Recommendation Queue</span>
        <span className="marketing-rec-count">{recommendations.length}</span>
      </div>

      <div className="marketing-rec-list">
        {Object.keys(groupedRecs).sort().map(subordinate => (
          <div key={subordinate} className="marketing-rec-group">
            <div className="marketing-rec-group-header">
              {subordinate.toUpperCase()}
              <span className="group-count">{groupedRecs[subordinate].length}</span>
            </div>
            {groupedRecs[subordinate].map((rec, idx) => (
              <MarketingRecommendationItem
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

function MarketingRecommendationItem({ recommendation, onApply }) {
  const { id, type, content, impact } = recommendation;
  const impactConfig = IMPACT_CONFIG[impact] || IMPACT_CONFIG.medium;

  return (
    <div className="marketing-rec-item">
      <div className="marketing-rec-item-header">
        <span className={`marketing-rec-type ${type}`}>{type}</span>
        <span className={`marketing-rec-impact ${impactConfig.className}`}>
          {impactConfig.label}
        </span>
      </div>
      <div className="marketing-rec-content">
        {truncateText(content, 120)}
      </div>
      <button
        className="marketing-rec-apply-btn"
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

function MarketingRecentActivityFeed({ activities, filter, onFilterChange }) {
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
    <div className="marketing-activity-feed">
      <div className="marketing-activity-header">
        <div className="marketing-activity-title">
          <span className="activity-icon">{'\u{1F4CA}'}</span>
          <span>Recent Activity</span>
        </div>
        <select
          className="activity-filter-select marketing"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">All Subordinates</option>
          {uniqueSubordinates.map(sub => (
            <option key={sub} value={sub}>{sub.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="marketing-activity-list">
        {filteredActivities.length === 0 ? (
          <div className="marketing-activity-empty">No recent activity</div>
        ) : (
          filteredActivities.slice(0, 10).map((activity, idx) => (
            <MarketingActivityItem key={activity.id || idx} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}

function MarketingActivityItem({ activity }) {
  const { type, subordinateRole, description, timestamp, outcome } = activity;
  const typeConfig = ACTIVITY_TYPE_CONFIG[type] || { label: type, className: '' };

  return (
    <div className="marketing-activity-item">
      <div className="activity-item-row">
        <span className={`activity-type-badge ${typeConfig.className}`}>
          {typeConfig.label}
        </span>
        <span className="activity-subordinate marketing">{subordinateRole?.toUpperCase()}</span>
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
// MARKETING METRICS COMPONENT (OPTIONAL)
// ============================================================================

function MarketingMetrics({ metrics }) {
  const {
    contentPublished,
    socialEngagementRate,
    seoRankingChange,
    brandSentiment,
  } = metrics || {};

  return (
    <div className="marketing-metrics">
      <div className="marketing-metrics-header">
        <span className="metrics-icon">{'\u{1F4CA}'}</span>
        <span className="metrics-title">Marketing Metrics (This Week)</span>
      </div>
      <div className="marketing-metrics-grid">
        <div className="marketing-metric-card">
          <div className="metric-icon">{'\u{1F4DD}'}</div>
          <div className="metric-value">{contentPublished || 0}</div>
          <div className="metric-label">Content Published</div>
        </div>
        <div className="marketing-metric-card">
          <div className="metric-icon">{'\u{1F4F1}'}</div>
          <div className={`metric-value ${socialEngagementRate >= 5 ? 'positive' : socialEngagementRate >= 2 ? 'warning' : 'negative'}`}>
            {socialEngagementRate?.toFixed(1) || 0}%
          </div>
          <div className="metric-label">Social Engagement</div>
        </div>
        <div className="marketing-metric-card">
          <div className="metric-icon">{'\u{1F4C8}'}</div>
          <div className={`metric-value ${seoRankingChange > 0 ? 'positive' : seoRankingChange < 0 ? 'negative' : ''}`}>
            {seoRankingChange > 0 ? '+' : ''}{seoRankingChange || 0}
          </div>
          <div className="metric-label">SEO Ranking Change</div>
        </div>
        <div className="marketing-metric-card">
          <div className="metric-icon">{'\u{1F3AF}'}</div>
          <div className={`metric-value ${brandSentiment >= 70 ? 'positive' : brandSentiment >= 50 ? 'warning' : 'negative'}`}>
            {brandSentiment || 0}%
          </div>
          <div className="metric-label">Brand Sentiment</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

function MarketingTeamHeaderSkeleton() {
  return (
    <div className="marketing-team-header">
      <div className="marketing-team-title-row">
        <div className="skeleton" style={{ width: '200px', height: '24px' }} />
        <div className="skeleton" style={{ width: '150px', height: '20px' }} />
      </div>
      <div className="marketing-team-cmo-card">
        <div className="skeleton" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
        <div className="cmo-info">
          <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '4px' }} />
          <div className="skeleton" style={{ width: '150px', height: '14px' }} />
        </div>
      </div>
    </div>
  );
}

function MarketingSubordinateCardSkeleton() {
  return (
    <div className="marketing-subordinate-card">
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
// MAIN MARKETING TEAM PANEL COMPONENT
// ============================================================================

export function MarketingTeamPanel({ showRefresh = true }) {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams/marketing`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTeamData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Use mock data as fallback
      setTeamData(getMockMarketingTeamData());
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerReview = useCallback(async () => {
    try {
      setIsReviewing(true);
      await fetch(`${API_BASE_URL}/api/neural-stack/teams/marketing/review`, {
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
      await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots/kb-marketing/trigger-research`, {
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
      <div className="marketing-team-panel">
        <MarketingTeamHeaderSkeleton />
        <div className="marketing-subordinate-grid">
          {[1, 2, 3, 4].map(i => (
            <MarketingSubordinateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="marketing-team-panel">
      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <MarketingTeamHeader
        cmo={teamData?.cmo}
        teamHealth={teamData?.teamHealth || 0}
        lastReview={teamData?.lastReview}
        onTriggerReview={triggerReview}
        isReviewing={isReviewing}
      />

      <div className="marketing-subordinate-grid">
        {teamData?.subordinates?.map((sub, idx) => (
          <MarketingSubordinateCard key={sub.role || idx} subordinate={sub} />
        ))}
      </div>

      <div className="marketing-bottom-row">
        <MarketingKnowledgeBotStatus
          bot={teamData?.knowledgeBot || {}}
          onRunResearch={runResearch}
          isRunning={isResearching}
        />

        <MarketingRecommendationQueue
          recommendations={teamData?.recommendations || []}
          onApply={applyRecommendation}
        />
      </div>

      <MarketingRecentActivityFeed
        activities={teamData?.recentActivity || []}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
      />

      {teamData?.marketingMetrics && (
        <MarketingMetrics metrics={teamData.marketingMetrics} />
      )}

      {showRefresh && (
        <div className="marketing-panel-footer">
          <button
            className="refresh-btn-small marketing"
            onClick={fetchTeamData}
            title="Refresh Marketing Team data"
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

function getMockMarketingTeamData() {
  return {
    teamHealth: 76,
    lastReview: new Date(Date.now() - 2400000).toISOString(),
    cmo: {
      name: 'Chief Marketing Officer',
      healthScore: 82,
      activeAmendments: 3,
    },
    subordinates: [
      {
        role: 'content_lead',
        specialty: 'content',
        trend: 'IMPROVING',
        variancePercent: 7.2,
        recentTasks: 19,
        activeAmendments: 1,
        lastReviewed: new Date(Date.now() - 4200000).toISOString(),
        healthScore: 86,
        varianceHistory: [12, 11, 10, 9, 8, 7.2],
      },
      {
        role: 'social_media_lead',
        specialty: 'social',
        trend: 'STABLE',
        variancePercent: 11.5,
        recentTasks: 28,
        activeAmendments: 2,
        lastReviewed: new Date(Date.now() - 5400000).toISOString(),
        healthScore: 74,
        varianceHistory: [10, 11, 12, 11, 11, 11.5],
      },
      {
        role: 'seo_growth_lead',
        specialty: 'seo',
        trend: 'IMPROVING',
        variancePercent: 5.8,
        recentTasks: 15,
        activeAmendments: 0,
        lastReviewed: new Date(Date.now() - 2700000).toISOString(),
        healthScore: 91,
        varianceHistory: [14, 12, 10, 8, 6, 5.8],
      },
      {
        role: 'brand_lead',
        specialty: 'brand',
        trend: 'DECLINING',
        variancePercent: 16.3,
        recentTasks: 12,
        activeAmendments: 4,
        lastReviewed: new Date(Date.now() - 10800000).toISOString(),
        healthScore: 62,
        varianceHistory: [8, 10, 12, 14, 15, 16.3],
      },
    ],
    knowledgeBot: {
      lastResearchCycle: new Date(Date.now() - 3600000).toISOString(),
      recommendationsToday: 5,
      pendingRecommendations: 3,
      successRate: 78,
    },
    recommendations: [
      {
        id: 'rec-mkt-1',
        type: 'content_strategy',
        subordinateRole: 'content_lead',
        content: 'Implement AI-assisted content outline generation for blog posts to improve consistency and reduce drafting time.',
        impact: 'high',
      },
      {
        id: 'rec-mkt-2',
        type: 'engagement_boost',
        subordinateRole: 'social_media_lead',
        content: 'Consider scheduling posts during peak engagement hours (2-4pm EST) based on recent analytics.',
        impact: 'medium',
      },
      {
        id: 'rec-mkt-3',
        type: 'brand_refresh',
        subordinateRole: 'brand_lead',
        content: 'Update brand guidelines to include accessibility standards for all visual content.',
        impact: 'high',
      },
    ],
    recentActivity: [
      {
        id: 'act-mkt-1',
        type: 'review',
        subordinateRole: 'seo_growth_lead',
        description: 'CMO reviewed Q1 organic traffic growth strategy',
        timestamp: new Date(Date.now() - 2700000).toISOString(),
        outcome: 'APPROVED',
      },
      {
        id: 'act-mkt-2',
        type: 'amendment',
        subordinateRole: 'content_lead',
        description: 'Knowledge update applied: content calendar optimization',
        timestamp: new Date(Date.now() - 4200000).toISOString(),
        outcome: 'ACTIVE',
      },
      {
        id: 'act-mkt-3',
        type: 'recommendation',
        subordinateRole: 'social_media_lead',
        description: 'New recommendation generated: engagement timing optimization',
        timestamp: new Date(Date.now() - 6300000).toISOString(),
      },
      {
        id: 'act-mkt-4',
        type: 'escalation',
        subordinateRole: 'brand_lead',
        description: 'High variance escalated to CMO: brand consistency issues',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        outcome: 'ACKNOWLEDGED',
      },
      {
        id: 'act-mkt-5',
        type: 'review',
        subordinateRole: 'social_media_lead',
        description: 'CMO reviewed influencer partnership proposals',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        outcome: 'NEEDS_IMPROVEMENT',
      },
    ],
    marketingMetrics: {
      contentPublished: 12,
      socialEngagementRate: 4.7,
      seoRankingChange: 3,
      brandSentiment: 72,
    },
  };
}

export default MarketingTeamPanel;
