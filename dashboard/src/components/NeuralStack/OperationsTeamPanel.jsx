/**
 * OPERATIONS TEAM PANEL - Phase 6F
 * Cognalith Inc. | Monolith System
 *
 * Specialized panel for the Operations Team.
 * Features:
 * - Team header with COO info
 * - 2 subordinate cards (Vendor Management, Process Automation)
 * - Knowledge Bot status
 * - Operations-specific recommendation queue
 * - Recent activity feed
 * - Operations metrics (optional)
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
  vendor_management: { label: 'Vendor Management', icon: '\u{1F91D}' },
  process_automation: { label: 'Process Automation', icon: '\u26A1' },
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

function OperationsTeamHeader({ coo, teamHealth, lastReview, onTriggerReview, isReviewing }) {
  const healthStatus = getHealthStatus(teamHealth);
  const healthConfig = HEALTH_STATUS[healthStatus];

  return (
    <div className="operations-team-header">
      <div className="operations-team-title-row">
        <div className="operations-team-title">
          <span className="operations-team-icon">{'\u2699\uFE0F'}</span>
          <span className="operations-team-name">Operations Team</span>
        </div>
        <div className="operations-team-health-indicator" style={{ color: healthConfig.color }}>
          <span className="health-dot" style={{ background: healthConfig.color }} />
          <span>Team Health: {teamHealth}%</span>
        </div>
      </div>

      <div className="operations-team-coo-card">
        <div className="coo-avatar operations">
          <span>O</span>
        </div>
        <div className="coo-info">
          <div className="coo-role">COO</div>
          <div className="coo-name">{coo?.name || 'Chief Operating Officer'}</div>
        </div>
        <div className="coo-stats">
          <div className="coo-stat">
            <span className="stat-value operations">{coo?.healthScore || 0}%</span>
            <span className="stat-label">Health</span>
          </div>
          <div className="coo-stat">
            <span className="stat-value">{coo?.activeAmendments || 0}</span>
            <span className="stat-label">Amendments</span>
          </div>
        </div>
        <div className="coo-review-section">
          <div className="last-review">
            Last Review: {formatRelativeTime(lastReview)}
          </div>
          <button
            className="trigger-review-btn operations"
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

function OperationsSubordinateCard({ subordinate }) {
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
      className="operations-subordinate-card"
      style={{ borderLeft: `3px solid ${healthConfig.color}` }}
    >
      <div className="subordinate-card-header">
        <div className="subordinate-role-section">
          <span className="subordinate-role">{role?.toUpperCase()}</span>
          <span className="subordinate-specialty operations">
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
          <MiniSparkline data={varianceHistory} color="var(--neon-orange)" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MINI SPARKLINE COMPONENT
// ============================================================================

function MiniSparkline({ data, color = 'var(--neon-orange)' }) {
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

function OperationsKnowledgeBotStatus({ bot, onRunResearch, isRunning }) {
  const {
    lastResearchCycle,
    recommendationsToday,
    pendingRecommendations,
    successRate,
  } = bot;

  return (
    <div className="operations-knowledge-bot">
      <div className="kb-header">
        <div className="kb-title">
          <span className="kb-icon">{'\u{1F916}'}</span>
          <span>ops_knowledge_bot</span>
        </div>
        <span className="kb-status-badge active operations">Active</span>
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
        className="kb-run-research-btn operations"
        onClick={onRunResearch}
        disabled={isRunning}
      >
        {isRunning ? 'Running Research...' : 'Run Research'}
      </button>
    </div>
  );
}

// ============================================================================
// OPERATIONS RECOMMENDATION QUEUE COMPONENT
// ============================================================================

function OperationsRecommendationQueue({ recommendations, onApply }) {
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
      <div className="operations-recommendation-queue">
        <div className="operations-rec-header">
          <span className="operations-rec-icon">{'\u{1F4CB}'}</span>
          <span className="operations-rec-title">Recommendation Queue</span>
        </div>
        <div className="operations-rec-empty">
          No pending recommendations for Operations Team
        </div>
      </div>
    );
  }

  return (
    <div className="operations-recommendation-queue">
      <div className="operations-rec-header">
        <span className="operations-rec-icon">{'\u{1F4CB}'}</span>
        <span className="operations-rec-title">Recommendation Queue</span>
        <span className="operations-rec-count">{recommendations.length}</span>
      </div>

      <div className="operations-rec-list">
        {Object.keys(groupedRecs).sort().map(subordinate => (
          <div key={subordinate} className="operations-rec-group">
            <div className="operations-rec-group-header">
              {subordinate.toUpperCase()}
              <span className="group-count">{groupedRecs[subordinate].length}</span>
            </div>
            {groupedRecs[subordinate].map((rec, idx) => (
              <OperationsRecommendationItem
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

function OperationsRecommendationItem({ recommendation, onApply }) {
  const { id, type, content, impact } = recommendation;
  const impactConfig = IMPACT_CONFIG[impact] || IMPACT_CONFIG.medium;

  return (
    <div className="operations-rec-item">
      <div className="operations-rec-item-header">
        <span className={`operations-rec-type ${type}`}>{type}</span>
        <span className={`operations-rec-impact ${impactConfig.className}`}>
          {impactConfig.label}
        </span>
      </div>
      <div className="operations-rec-content">
        {truncateText(content, 120)}
      </div>
      <button
        className="operations-rec-apply-btn"
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

function OperationsRecentActivityFeed({ activities, filter, onFilterChange }) {
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
    <div className="operations-activity-feed">
      <div className="operations-activity-header">
        <div className="operations-activity-title">
          <span className="activity-icon">{'\u{1F4CA}'}</span>
          <span>Recent Activity</span>
        </div>
        <select
          className="activity-filter-select operations"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">All Subordinates</option>
          {uniqueSubordinates.map(sub => (
            <option key={sub} value={sub}>{sub.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="operations-activity-list">
        {filteredActivities.length === 0 ? (
          <div className="operations-activity-empty">No recent activity</div>
        ) : (
          filteredActivities.slice(0, 10).map((activity, idx) => (
            <OperationsActivityItem key={activity.id || idx} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}

function OperationsActivityItem({ activity }) {
  const { type, subordinateRole, description, timestamp, outcome } = activity;
  const typeConfig = ACTIVITY_TYPE_CONFIG[type] || { label: type, className: '' };

  return (
    <div className="operations-activity-item">
      <div className="activity-item-row">
        <span className={`activity-type-badge ${typeConfig.className}`}>
          {typeConfig.label}
        </span>
        <span className="activity-subordinate operations">{subordinateRole?.toUpperCase()}</span>
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
// OPERATIONS METRICS COMPONENT (OPTIONAL)
// ============================================================================

function OperationsMetrics({ metrics }) {
  const {
    activeVendors,
    contractsUpForRenewal,
    automationsRunning,
    processEfficiencyScore,
  } = metrics || {};

  return (
    <div className="operations-metrics">
      <div className="operations-metrics-header">
        <span className="metrics-icon">{'\u{1F4CA}'}</span>
        <span className="metrics-title">Operations Metrics (This Week)</span>
      </div>
      <div className="operations-metrics-grid">
        <div className="operations-metric-card">
          <div className="metric-icon">{'\u{1F91D}'}</div>
          <div className="metric-value">{activeVendors || 0}</div>
          <div className="metric-label">Active Vendors</div>
        </div>
        <div className="operations-metric-card">
          <div className="metric-icon">{'\u{1F4C4}'}</div>
          <div className={`metric-value ${contractsUpForRenewal > 5 ? 'warning' : contractsUpForRenewal > 0 ? '' : 'positive'}`}>
            {contractsUpForRenewal || 0}
          </div>
          <div className="metric-label">Contracts Up for Renewal</div>
        </div>
        <div className="operations-metric-card">
          <div className="metric-icon">{'\u26A1'}</div>
          <div className={`metric-value ${automationsRunning >= 10 ? 'positive' : automationsRunning >= 5 ? '' : 'negative'}`}>
            {automationsRunning || 0}
          </div>
          <div className="metric-label">Automations Running</div>
        </div>
        <div className="operations-metric-card">
          <div className="metric-icon">{'\u{1F3AF}'}</div>
          <div className={`metric-value ${processEfficiencyScore >= 85 ? 'positive' : processEfficiencyScore >= 70 ? 'warning' : 'negative'}`}>
            {processEfficiencyScore || 0}%
          </div>
          <div className="metric-label">Process Efficiency</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

function OperationsTeamHeaderSkeleton() {
  return (
    <div className="operations-team-header">
      <div className="operations-team-title-row">
        <div className="skeleton" style={{ width: '200px', height: '24px' }} />
        <div className="skeleton" style={{ width: '150px', height: '20px' }} />
      </div>
      <div className="operations-team-coo-card">
        <div className="skeleton" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
        <div className="coo-info">
          <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '4px' }} />
          <div className="skeleton" style={{ width: '150px', height: '14px' }} />
        </div>
      </div>
    </div>
  );
}

function OperationsSubordinateCardSkeleton() {
  return (
    <div className="operations-subordinate-card">
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
// MAIN OPERATIONS TEAM PANEL COMPONENT
// ============================================================================

export function OperationsTeamPanel({ showRefresh = true }) {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams/operations`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTeamData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Use mock data as fallback
      setTeamData(getMockOperationsTeamData());
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerReview = useCallback(async () => {
    try {
      setIsReviewing(true);
      await fetch(`${API_BASE_URL}/api/neural-stack/teams/operations/review`, {
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
      await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots/ops-kb/research`, {
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
      <div className="operations-team-panel">
        <OperationsTeamHeaderSkeleton />
        <div className="operations-subordinate-grid">
          {[1, 2].map(i => (
            <OperationsSubordinateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="operations-team-panel">
      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <OperationsTeamHeader
        coo={teamData?.coo}
        teamHealth={teamData?.teamHealth || 0}
        lastReview={teamData?.lastReview}
        onTriggerReview={triggerReview}
        isReviewing={isReviewing}
      />

      <div className="operations-subordinate-grid">
        {teamData?.subordinates?.map((sub, idx) => (
          <OperationsSubordinateCard key={sub.role || idx} subordinate={sub} />
        ))}
      </div>

      <div className="operations-bottom-row">
        <OperationsKnowledgeBotStatus
          bot={teamData?.knowledgeBot || {}}
          onRunResearch={runResearch}
          isRunning={isResearching}
        />

        <OperationsRecommendationQueue
          recommendations={teamData?.recommendations || []}
          onApply={applyRecommendation}
        />
      </div>

      <OperationsRecentActivityFeed
        activities={teamData?.recentActivity || []}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
      />

      {teamData?.operationsMetrics && (
        <OperationsMetrics metrics={teamData.operationsMetrics} />
      )}

      {showRefresh && (
        <div className="operations-panel-footer">
          <button
            className="refresh-btn-small operations"
            onClick={fetchTeamData}
            title="Refresh Operations Team data"
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

function getMockOperationsTeamData() {
  return {
    teamHealth: 82,
    lastReview: new Date(Date.now() - 2700000).toISOString(),
    coo: {
      name: 'Chief Operating Officer',
      healthScore: 86,
      activeAmendments: 1,
    },
    subordinates: [
      {
        role: 'vendor_management_lead',
        specialty: 'vendor_management',
        trend: 'STABLE',
        variancePercent: 7.5,
        recentTasks: 19,
        activeAmendments: 1,
        lastReviewed: new Date(Date.now() - 2700000).toISOString(),
        healthScore: 84,
        varianceHistory: [8, 7.8, 7.6, 7.5, 7.5, 7.5],
      },
      {
        role: 'process_automation_lead',
        specialty: 'process_automation',
        trend: 'IMPROVING',
        variancePercent: 5.2,
        recentTasks: 28,
        activeAmendments: 0,
        lastReviewed: new Date(Date.now() - 4500000).toISOString(),
        healthScore: 91,
        varianceHistory: [9, 8, 7, 6, 5.5, 5.2],
      },
    ],
    knowledgeBot: {
      lastResearchCycle: new Date(Date.now() - 3600000).toISOString(),
      recommendationsToday: 3,
      pendingRecommendations: 2,
      successRate: 88,
    },
    recommendations: [
      {
        id: 'rec-ops-1',
        type: 'vendor_optimization',
        subordinateRole: 'vendor_management_lead',
        content: 'Consider consolidating cloud service vendors to reduce overhead and improve negotiation leverage.',
        impact: 'high',
      },
      {
        id: 'rec-ops-2',
        type: 'process_improvement',
        subordinateRole: 'process_automation_lead',
        content: 'Implement automated error handling for data pipeline failures to reduce manual intervention.',
        impact: 'medium',
      },
    ],
    recentActivity: [
      {
        id: 'act-ops-1',
        type: 'review',
        subordinateRole: 'vendor_management_lead',
        description: 'COO reviewed vendor performance metrics for Q1 contracts',
        timestamp: new Date(Date.now() - 2700000).toISOString(),
        outcome: 'APPROVED',
      },
      {
        id: 'act-ops-2',
        type: 'amendment',
        subordinateRole: 'process_automation_lead',
        description: 'Knowledge update applied: workflow automation best practices',
        timestamp: new Date(Date.now() - 4500000).toISOString(),
        outcome: 'ACTIVE',
      },
      {
        id: 'act-ops-3',
        type: 'recommendation',
        subordinateRole: 'vendor_management_lead',
        description: 'New recommendation generated: vendor consolidation strategy',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 'act-ops-4',
        type: 'review',
        subordinateRole: 'process_automation_lead',
        description: 'COO reviewed automation deployment schedule',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        outcome: 'APPROVED',
      },
      {
        id: 'act-ops-5',
        type: 'escalation',
        subordinateRole: 'vendor_management_lead',
        description: 'Contract renewal deadline approaching for key vendor',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        outcome: 'ACKNOWLEDGED',
      },
    ],
    operationsMetrics: {
      activeVendors: 24,
      contractsUpForRenewal: 3,
      automationsRunning: 15,
      processEfficiencyScore: 87,
    },
  };
}

export default OperationsTeamPanel;
