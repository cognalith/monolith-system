/**
 * PEOPLE TEAM PANEL - Phase 6H
 * Cognalith Inc. | Monolith System
 *
 * Specialized panel for the People Team.
 * Features:
 * - Team header with CHRO info
 * - 2 subordinate cards (Hiring Lead, Compliance Lead)
 * - Knowledge Bot status
 * - People-specific recommendation queue
 * - Recent activity feed
 * - People metrics (optional)
 *
 * Color Scheme: Purple (#a855f7) - var(--neon-purple)
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
  hiring: { label: 'Talent Acquisition', icon: '\u{1F465}' },
  compliance: { label: 'HR Compliance', icon: '\u{1F4CB}' },
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

function PeopleTeamHeader({ chro, teamHealth, lastReview, onTriggerReview, isReviewing }) {
  const healthStatus = getHealthStatus(teamHealth);
  const healthConfig = HEALTH_STATUS[healthStatus];

  return (
    <div className="people-team-header">
      <div className="people-team-title-row">
        <div className="people-team-title">
          <span className="people-team-icon">{'\u{1F465}'}</span>
          <span className="people-team-name">People Team</span>
        </div>
        <div className="people-team-health-indicator" style={{ color: healthConfig.color }}>
          <span className="health-dot" style={{ background: healthConfig.color }} />
          <span>Team Health: {teamHealth}%</span>
        </div>
      </div>

      <div className="people-team-chro-card">
        <div className="chro-avatar people">
          <span>P</span>
        </div>
        <div className="chro-info">
          <div className="chro-role">CHRO</div>
          <div className="chro-name">{chro?.name || 'Chief Human Resources Officer'}</div>
        </div>
        <div className="chro-stats">
          <div className="chro-stat">
            <span className="stat-value people">{chro?.healthScore || 0}%</span>
            <span className="stat-label">Health</span>
          </div>
          <div className="chro-stat">
            <span className="stat-value">{chro?.activeAmendments || 0}</span>
            <span className="stat-label">Amendments</span>
          </div>
        </div>
        <div className="chro-review-section">
          <div className="last-review">
            Last Review: {formatRelativeTime(lastReview)}
          </div>
          <button
            className="trigger-review-btn people"
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

function PeopleSubordinateCard({ subordinate }) {
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
      className="people-subordinate-card"
      style={{ borderLeft: `3px solid var(--neon-purple)` }}
    >
      <div className="subordinate-card-header">
        <div className="subordinate-role-section">
          <span className="subordinate-role">{role?.toUpperCase()}</span>
          <span className="subordinate-specialty people">
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
          <MiniSparkline data={varianceHistory} color="var(--neon-purple)" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MINI SPARKLINE COMPONENT
// ============================================================================

function MiniSparkline({ data, color = 'var(--neon-purple)' }) {
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

function PeopleKnowledgeBotStatus({ bot, onRunResearch, isRunning }) {
  const {
    lastResearchCycle,
    recommendationsToday,
    pendingRecommendations,
    successRate,
  } = bot;

  return (
    <div className="people-knowledge-bot">
      <div className="kb-header">
        <div className="kb-title">
          <span className="kb-icon">{'\u{1F916}'}</span>
          <span>people_knowledge_bot</span>
        </div>
        <span className="kb-status-badge active people">Active</span>
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
        className="kb-run-research-btn people"
        onClick={onRunResearch}
        disabled={isRunning}
      >
        {isRunning ? 'Running Research...' : 'Run Research'}
      </button>
    </div>
  );
}

// ============================================================================
// PEOPLE RECOMMENDATION QUEUE COMPONENT
// ============================================================================

function PeopleRecommendationQueue({ recommendations, onApply }) {
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
      <div className="people-recommendation-queue">
        <div className="people-rec-header">
          <span className="people-rec-icon">{'\u{1F4CB}'}</span>
          <span className="people-rec-title">Recommendation Queue</span>
        </div>
        <div className="people-rec-empty">
          No pending recommendations for People Team
        </div>
      </div>
    );
  }

  return (
    <div className="people-recommendation-queue">
      <div className="people-rec-header">
        <span className="people-rec-icon">{'\u{1F4CB}'}</span>
        <span className="people-rec-title">Recommendation Queue</span>
        <span className="people-rec-count">{recommendations.length}</span>
      </div>

      <div className="people-rec-list">
        {Object.keys(groupedRecs).sort().map(subordinate => (
          <div key={subordinate} className="people-rec-group">
            <div className="people-rec-group-header">
              {subordinate.toUpperCase()}
              <span className="group-count">{groupedRecs[subordinate].length}</span>
            </div>
            {groupedRecs[subordinate].map((rec, idx) => (
              <PeopleRecommendationItem
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

function PeopleRecommendationItem({ recommendation, onApply }) {
  const { id, type, content, impact } = recommendation;
  const impactConfig = IMPACT_CONFIG[impact] || IMPACT_CONFIG.medium;

  return (
    <div className="people-rec-item">
      <div className="people-rec-item-header">
        <span className={`people-rec-type ${type}`}>{type}</span>
        <span className={`people-rec-impact ${impactConfig.className}`}>
          {impactConfig.label}
        </span>
      </div>
      <div className="people-rec-content">
        {truncateText(content, 120)}
      </div>
      <button
        className="people-rec-apply-btn"
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

function PeopleRecentActivityFeed({ activities, filter, onFilterChange }) {
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
    <div className="people-activity-feed">
      <div className="people-activity-header">
        <div className="people-activity-title">
          <span className="activity-icon">{'\u{1F4CA}'}</span>
          <span>Recent Activity</span>
        </div>
        <select
          className="activity-filter-select people"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">All Subordinates</option>
          {uniqueSubordinates.map(sub => (
            <option key={sub} value={sub}>{sub.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="people-activity-list">
        {filteredActivities.length === 0 ? (
          <div className="people-activity-empty">No recent activity</div>
        ) : (
          filteredActivities.slice(0, 10).map((activity, idx) => (
            <PeopleActivityItem key={activity.id || idx} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}

function PeopleActivityItem({ activity }) {
  const { type, subordinateRole, description, timestamp, outcome } = activity;
  const typeConfig = ACTIVITY_TYPE_CONFIG[type] || { label: type, className: '' };

  return (
    <div className="people-activity-item">
      <div className="activity-item-row">
        <span className={`activity-type-badge ${typeConfig.className}`}>
          {typeConfig.label}
        </span>
        <span className="activity-subordinate people">{subordinateRole?.toUpperCase()}</span>
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
// PEOPLE METRICS COMPONENT (OPTIONAL)
// ============================================================================

function PeopleMetrics({ metrics }) {
  const {
    openPositions,
    candidatesInPipeline,
    complianceScore,
    onboardingInProgress,
  } = metrics || {};

  return (
    <div className="people-metrics">
      <div className="people-metrics-header">
        <span className="metrics-icon">{'\u{1F4CA}'}</span>
        <span className="metrics-title">People Metrics (This Week)</span>
      </div>
      <div className="people-metrics-grid">
        <div className="people-metric-card">
          <div className="metric-icon">{'\u{1F4DD}'}</div>
          <div className="metric-value">{openPositions || 0}</div>
          <div className="metric-label">Open Positions</div>
        </div>
        <div className="people-metric-card">
          <div className="metric-icon">{'\u{1F465}'}</div>
          <div className={`metric-value ${candidatesInPipeline >= 20 ? 'positive' : candidatesInPipeline >= 10 ? '' : 'warning'}`}>
            {candidatesInPipeline || 0}
          </div>
          <div className="metric-label">Candidates in Pipeline</div>
        </div>
        <div className="people-metric-card">
          <div className="metric-icon">{'\u2705'}</div>
          <div className={`metric-value ${complianceScore >= 95 ? 'positive' : complianceScore >= 85 ? 'warning' : 'negative'}`}>
            {complianceScore || 0}%
          </div>
          <div className="metric-label">Compliance Score</div>
        </div>
        <div className="people-metric-card">
          <div className="metric-icon">{'\u{1F680}'}</div>
          <div className={`metric-value ${onboardingInProgress > 0 ? 'positive' : ''}`}>
            {onboardingInProgress || 0}
          </div>
          <div className="metric-label">Onboarding In Progress</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

function PeopleTeamHeaderSkeleton() {
  return (
    <div className="people-team-header">
      <div className="people-team-title-row">
        <div className="skeleton" style={{ width: '200px', height: '24px' }} />
        <div className="skeleton" style={{ width: '150px', height: '20px' }} />
      </div>
      <div className="people-team-chro-card">
        <div className="skeleton" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
        <div className="chro-info">
          <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '4px' }} />
          <div className="skeleton" style={{ width: '150px', height: '14px' }} />
        </div>
      </div>
    </div>
  );
}

function PeopleSubordinateCardSkeleton() {
  return (
    <div className="people-subordinate-card">
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
// MAIN PEOPLE TEAM PANEL COMPONENT
// ============================================================================

export function PeopleTeamPanel({ showRefresh = true }) {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams/people`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTeamData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Use mock data as fallback
      setTeamData(getMockPeopleTeamData());
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerReview = useCallback(async () => {
    try {
      setIsReviewing(true);
      await fetch(`${API_BASE_URL}/api/neural-stack/teams/people/review`, {
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
      await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots/people-kb/research`, {
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
      <div className="people-team-panel">
        <PeopleTeamHeaderSkeleton />
        <div className="people-subordinate-grid">
          {[1, 2].map(i => (
            <PeopleSubordinateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="people-team-panel">
      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <PeopleTeamHeader
        chro={teamData?.chro}
        teamHealth={teamData?.teamHealth || 0}
        lastReview={teamData?.lastReview}
        onTriggerReview={triggerReview}
        isReviewing={isReviewing}
      />

      <div className="people-subordinate-grid">
        {teamData?.subordinates?.map((sub, idx) => (
          <PeopleSubordinateCard key={sub.role || idx} subordinate={sub} />
        ))}
      </div>

      <div className="people-bottom-row">
        <PeopleKnowledgeBotStatus
          bot={teamData?.knowledgeBot || {}}
          onRunResearch={runResearch}
          isRunning={isResearching}
        />

        <PeopleRecommendationQueue
          recommendations={teamData?.recommendations || []}
          onApply={applyRecommendation}
        />
      </div>

      <PeopleRecentActivityFeed
        activities={teamData?.recentActivity || []}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
      />

      {teamData?.peopleMetrics && (
        <PeopleMetrics metrics={teamData.peopleMetrics} />
      )}

      {showRefresh && (
        <div className="people-panel-footer">
          <button
            className="refresh-btn-small people"
            onClick={fetchTeamData}
            title="Refresh People Team data"
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

function getMockPeopleTeamData() {
  return {
    teamHealth: 88,
    lastReview: new Date(Date.now() - 1800000).toISOString(),
    chro: {
      name: 'Chief Human Resources Officer',
      healthScore: 90,
      activeAmendments: 1,
    },
    subordinates: [
      {
        role: 'hiring_lead',
        specialty: 'hiring',
        trend: 'IMPROVING',
        variancePercent: 5.8,
        recentTasks: 24,
        activeAmendments: 0,
        lastReviewed: new Date(Date.now() - 1800000).toISOString(),
        healthScore: 92,
        varianceHistory: [9, 8.5, 7.5, 6.5, 6, 5.8],
      },
      {
        role: 'compliance_lead',
        specialty: 'compliance',
        trend: 'STABLE',
        variancePercent: 6.2,
        recentTasks: 18,
        activeAmendments: 1,
        lastReviewed: new Date(Date.now() - 3600000).toISOString(),
        healthScore: 85,
        varianceHistory: [6.5, 6.3, 6.4, 6.2, 6.2, 6.2],
      },
    ],
    knowledgeBot: {
      lastResearchCycle: new Date(Date.now() - 2700000).toISOString(),
      recommendationsToday: 4,
      pendingRecommendations: 2,
      successRate: 92,
    },
    recommendations: [
      {
        id: 'rec-ppl-1',
        type: 'hiring_improvement',
        subordinateRole: 'hiring_lead',
        content: 'Consider implementing structured interview scorecards to improve hiring consistency and reduce bias.',
        impact: 'high',
      },
      {
        id: 'rec-ppl-2',
        type: 'compliance_update',
        subordinateRole: 'compliance_lead',
        content: 'Update remote work policy to reflect new state-specific requirements for distributed employees.',
        impact: 'medium',
      },
    ],
    recentActivity: [
      {
        id: 'act-ppl-1',
        type: 'review',
        subordinateRole: 'hiring_lead',
        description: 'CHRO reviewed Q1 hiring pipeline and conversion metrics',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        outcome: 'APPROVED',
      },
      {
        id: 'act-ppl-2',
        type: 'amendment',
        subordinateRole: 'compliance_lead',
        description: 'Knowledge update applied: New OSHA guidelines for remote workers',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        outcome: 'ACTIVE',
      },
      {
        id: 'act-ppl-3',
        type: 'recommendation',
        subordinateRole: 'hiring_lead',
        description: 'New recommendation generated: Interview process optimization',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 'act-ppl-4',
        type: 'review',
        subordinateRole: 'compliance_lead',
        description: 'CHRO reviewed compliance audit readiness checklist',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        outcome: 'APPROVED',
      },
      {
        id: 'act-ppl-5',
        type: 'escalation',
        subordinateRole: 'hiring_lead',
        description: 'Executive candidate final interview requires CEO approval',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        outcome: 'ACKNOWLEDGED',
      },
    ],
    peopleMetrics: {
      openPositions: 5,
      candidatesInPipeline: 32,
      complianceScore: 96,
      onboardingInProgress: 3,
    },
  };
}

export default PeopleTeamPanel;
