/**
 * TECH TEAM PANEL - Phase 6C
 * Cognalith Inc. | Monolith System
 *
 * Specialized panel for the Technology Team (first deployed team).
 * Features:
 * - Team header with CTO info
 * - 5 subordinate cards (Web Dev, App Dev, DevOps, QA, Infrastructure)
 * - Knowledge Bot status
 * - Tech-specific recommendation queue
 * - Recent activity feed
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
  healthy: { color: 'var(--neon-cyan)', bg: 'rgba(0, 240, 255, 0.15)' },
  attention: { color: 'var(--neon-amber)', bg: 'rgba(255, 184, 0, 0.15)' },
  critical: { color: 'var(--neon-crimson)', bg: 'rgba(255, 0, 60, 0.15)' },
};

const SPECIALTY_CONFIG = {
  frontend: { label: 'Frontend', icon: '\u{1F310}' },
  backend: { label: 'Backend', icon: '\u{2699}\uFE0F' },
  mobile: { label: 'Mobile', icon: '\u{1F4F1}' },
  infrastructure: { label: 'Infra', icon: '\u{1F5A5}\uFE0F' },
  qa: { label: 'QA', icon: '\u{1F50D}' },
  devops: { label: 'DevOps', icon: '\u{1F6E0}\uFE0F' },
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

function TeamHeader({ cto, teamHealth, lastReview, onTriggerReview, isReviewing }) {
  const healthStatus = getHealthStatus(teamHealth);
  const healthConfig = HEALTH_STATUS[healthStatus];

  return (
    <div className="tech-team-header">
      <div className="tech-team-title-row">
        <div className="tech-team-title">
          <span className="tech-team-icon">{'\u{1F4BB}'}</span>
          <span className="tech-team-name">Technology Team</span>
        </div>
        <div className="tech-team-health-indicator" style={{ color: healthConfig.color }}>
          <span className="health-dot" style={{ background: healthConfig.color }} />
          <span>Team Health: {teamHealth}%</span>
        </div>
      </div>

      <div className="tech-team-cto-card">
        <div className="cto-avatar">
          <span>C</span>
        </div>
        <div className="cto-info">
          <div className="cto-role">CTO</div>
          <div className="cto-name">{cto?.name || 'Chief Technology Officer'}</div>
        </div>
        <div className="cto-stats">
          <div className="cto-stat">
            <span className="stat-value">{cto?.healthScore || 0}%</span>
            <span className="stat-label">Health</span>
          </div>
          <div className="cto-stat">
            <span className="stat-value">{cto?.activeAmendments || 0}</span>
            <span className="stat-label">Amendments</span>
          </div>
        </div>
        <div className="cto-review-section">
          <div className="last-review">
            Last Review: {formatRelativeTime(lastReview)}
          </div>
          <button
            className="trigger-review-btn"
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

function SubordinateCard({ subordinate }) {
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
      className="tech-subordinate-card"
      style={{ borderLeft: `3px solid ${healthConfig.color}` }}
    >
      <div className="subordinate-card-header">
        <div className="subordinate-role-section">
          <span className="subordinate-role">{role?.toUpperCase()}</span>
          <span className="subordinate-specialty">
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
          <MiniSparkline data={varianceHistory} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MINI SPARKLINE COMPONENT
// ============================================================================

function MiniSparkline({ data }) {
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
  const strokeColor = isImproving ? 'var(--neon-cyan)' : 'var(--neon-crimson)';

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

function KnowledgeBotStatus({ bot, onRunResearch, isRunning }) {
  const {
    lastResearchCycle,
    recommendationsToday,
    pendingRecommendations,
    successRate,
  } = bot;

  return (
    <div className="tech-knowledge-bot">
      <div className="kb-header">
        <div className="kb-title">
          <span className="kb-icon">{'\u{1F916}'}</span>
          <span>tech_knowledge_bot</span>
        </div>
        <span className="kb-status-badge active">Active</span>
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
        className="kb-run-research-btn"
        onClick={onRunResearch}
        disabled={isRunning}
      >
        {isRunning ? 'Running Research...' : 'Run Research'}
      </button>
    </div>
  );
}

// ============================================================================
// TECH RECOMMENDATION QUEUE COMPONENT
// ============================================================================

function TechRecommendationQueue({ recommendations, onApply }) {
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
      <div className="tech-recommendation-queue">
        <div className="tech-rec-header">
          <span className="tech-rec-icon">{'\u{1F4CB}'}</span>
          <span className="tech-rec-title">Recommendation Queue</span>
        </div>
        <div className="tech-rec-empty">
          No pending recommendations for Tech Team
        </div>
      </div>
    );
  }

  return (
    <div className="tech-recommendation-queue">
      <div className="tech-rec-header">
        <span className="tech-rec-icon">{'\u{1F4CB}'}</span>
        <span className="tech-rec-title">Recommendation Queue</span>
        <span className="tech-rec-count">{recommendations.length}</span>
      </div>

      <div className="tech-rec-list">
        {Object.keys(groupedRecs).sort().map(subordinate => (
          <div key={subordinate} className="tech-rec-group">
            <div className="tech-rec-group-header">
              {subordinate.toUpperCase()}
              <span className="group-count">{groupedRecs[subordinate].length}</span>
            </div>
            {groupedRecs[subordinate].map((rec, idx) => (
              <TechRecommendationItem
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

function TechRecommendationItem({ recommendation, onApply }) {
  const { id, type, content, impact } = recommendation;
  const impactConfig = IMPACT_CONFIG[impact] || IMPACT_CONFIG.medium;

  return (
    <div className="tech-rec-item">
      <div className="tech-rec-item-header">
        <span className={`tech-rec-type ${type}`}>{type}</span>
        <span className={`tech-rec-impact ${impactConfig.className}`}>
          {impactConfig.label}
        </span>
      </div>
      <div className="tech-rec-content">
        {truncateText(content, 120)}
      </div>
      <button
        className="tech-rec-apply-btn"
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

function RecentActivityFeed({ activities, filter, onFilterChange }) {
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
    <div className="tech-activity-feed">
      <div className="tech-activity-header">
        <div className="tech-activity-title">
          <span className="activity-icon">{'\u{1F4CA}'}</span>
          <span>Recent Activity</span>
        </div>
        <select
          className="activity-filter-select"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">All Subordinates</option>
          {uniqueSubordinates.map(sub => (
            <option key={sub} value={sub}>{sub.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="tech-activity-list">
        {filteredActivities.length === 0 ? (
          <div className="tech-activity-empty">No recent activity</div>
        ) : (
          filteredActivities.slice(0, 10).map((activity, idx) => (
            <ActivityItem key={activity.id || idx} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}

function ActivityItem({ activity }) {
  const { type, subordinateRole, description, timestamp, outcome } = activity;
  const typeConfig = ACTIVITY_TYPE_CONFIG[type] || { label: type, className: '' };

  return (
    <div className="tech-activity-item">
      <div className="activity-item-row">
        <span className={`activity-type-badge ${typeConfig.className}`}>
          {typeConfig.label}
        </span>
        <span className="activity-subordinate">{subordinateRole?.toUpperCase()}</span>
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
// SKELETON LOADERS
// ============================================================================

function TeamHeaderSkeleton() {
  return (
    <div className="tech-team-header">
      <div className="tech-team-title-row">
        <div className="skeleton" style={{ width: '200px', height: '24px' }} />
        <div className="skeleton" style={{ width: '150px', height: '20px' }} />
      </div>
      <div className="tech-team-cto-card">
        <div className="skeleton" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
        <div className="cto-info">
          <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '4px' }} />
          <div className="skeleton" style={{ width: '150px', height: '14px' }} />
        </div>
      </div>
    </div>
  );
}

function SubordinateCardSkeleton() {
  return (
    <div className="tech-subordinate-card">
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
// MAIN TECH TEAM PANEL COMPONENT
// ============================================================================

export function TechTeamPanel({ showRefresh = true }) {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams/technology`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTeamData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Use mock data as fallback
      setTeamData(getMockTechTeamData());
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerReview = useCallback(async () => {
    try {
      setIsReviewing(true);
      await fetch(`${API_BASE_URL}/api/neural-stack/teams/technology/review`, {
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
      await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots/kb-technology/trigger-research`, {
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
      <div className="tech-team-panel">
        <TeamHeaderSkeleton />
        <div className="tech-subordinate-grid">
          {[1, 2, 3, 4, 5].map(i => (
            <SubordinateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="tech-team-panel">
      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <TeamHeader
        cto={teamData?.cto}
        teamHealth={teamData?.teamHealth || 0}
        lastReview={teamData?.lastReview}
        onTriggerReview={triggerReview}
        isReviewing={isReviewing}
      />

      <div className="tech-subordinate-grid">
        {teamData?.subordinates?.map((sub, idx) => (
          <SubordinateCard key={sub.role || idx} subordinate={sub} />
        ))}
      </div>

      <div className="tech-bottom-row">
        <KnowledgeBotStatus
          bot={teamData?.knowledgeBot || {}}
          onRunResearch={runResearch}
          isRunning={isResearching}
        />

        <TechRecommendationQueue
          recommendations={teamData?.recommendations || []}
          onApply={applyRecommendation}
        />
      </div>

      <RecentActivityFeed
        activities={teamData?.recentActivity || []}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
      />

      {showRefresh && (
        <div className="tech-panel-footer">
          <button
            className="refresh-btn-small"
            onClick={fetchTeamData}
            title="Refresh Tech Team data"
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

function getMockTechTeamData() {
  return {
    teamHealth: 82,
    lastReview: new Date(Date.now() - 1800000).toISOString(),
    cto: {
      name: 'Chief Technology Officer',
      healthScore: 88,
      activeAmendments: 2,
    },
    subordinates: [
      {
        role: 'web_dev',
        specialty: 'frontend',
        trend: 'IMPROVING',
        variancePercent: 8.5,
        recentTasks: 24,
        activeAmendments: 1,
        lastReviewed: new Date(Date.now() - 3600000).toISOString(),
        healthScore: 85,
        varianceHistory: [12, 14, 11, 10, 9, 8.5],
      },
      {
        role: 'app_dev',
        specialty: 'mobile',
        trend: 'STABLE',
        variancePercent: 12.3,
        recentTasks: 18,
        activeAmendments: 2,
        lastReviewed: new Date(Date.now() - 7200000).toISOString(),
        healthScore: 78,
        varianceHistory: [11, 13, 12, 11, 12, 12.3],
      },
      {
        role: 'devops',
        specialty: 'devops',
        trend: 'IMPROVING',
        variancePercent: 6.2,
        recentTasks: 31,
        activeAmendments: 0,
        lastReviewed: new Date(Date.now() - 1800000).toISOString(),
        healthScore: 92,
        varianceHistory: [15, 12, 10, 8, 7, 6.2],
      },
      {
        role: 'qa',
        specialty: 'qa',
        trend: 'DECLINING',
        variancePercent: 18.7,
        recentTasks: 15,
        activeAmendments: 3,
        lastReviewed: new Date(Date.now() - 14400000).toISOString(),
        healthScore: 65,
        varianceHistory: [10, 12, 14, 16, 17, 18.7],
      },
      {
        role: 'infrastructure',
        specialty: 'infrastructure',
        trend: 'STABLE',
        variancePercent: 9.8,
        recentTasks: 22,
        activeAmendments: 1,
        lastReviewed: new Date(Date.now() - 5400000).toISOString(),
        healthScore: 81,
        varianceHistory: [10, 11, 9, 10, 9.5, 9.8],
      },
    ],
    knowledgeBot: {
      lastResearchCycle: new Date(Date.now() - 2700000).toISOString(),
      recommendationsToday: 7,
      pendingRecommendations: 4,
      successRate: 85,
    },
    recommendations: [
      {
        id: 'rec-tech-1',
        type: 'knowledge_addition',
        subordinateRole: 'web_dev',
        content: 'Add knowledge about new React 19 concurrent features for improved server-side rendering patterns.',
        impact: 'high',
      },
      {
        id: 'rec-tech-2',
        type: 'skill_suggestion',
        subordinateRole: 'devops',
        content: 'Consider implementing automated canary deployment pipeline for zero-downtime releases.',
        impact: 'medium',
      },
      {
        id: 'rec-tech-3',
        type: 'knowledge_modification',
        subordinateRole: 'qa',
        content: 'Update testing thresholds for API response times based on recent performance benchmarks.',
        impact: 'high',
      },
      {
        id: 'rec-tech-4',
        type: 'knowledge_addition',
        subordinateRole: 'infrastructure',
        content: 'Add documentation for new Kubernetes auto-scaling configurations.',
        impact: 'low',
      },
    ],
    recentActivity: [
      {
        id: 'act-1',
        type: 'review',
        subordinateRole: 'devops',
        description: 'CTO reviewed deployment pipeline optimization task',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        outcome: 'APPROVED',
      },
      {
        id: 'act-2',
        type: 'amendment',
        subordinateRole: 'qa',
        description: 'Knowledge update applied: testing threshold adjustments',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        outcome: 'ACTIVE',
      },
      {
        id: 'act-3',
        type: 'recommendation',
        subordinateRole: 'web_dev',
        description: 'New recommendation generated: React 19 features',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 'act-4',
        type: 'review',
        subordinateRole: 'app_dev',
        description: 'CTO reviewed mobile app architecture changes',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        outcome: 'NEEDS_IMPROVEMENT',
      },
      {
        id: 'act-5',
        type: 'escalation',
        subordinateRole: 'qa',
        description: 'High variance escalated to CTO for review',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        outcome: 'ACKNOWLEDGED',
      },
    ],
  };
}

export default TechTeamPanel;
