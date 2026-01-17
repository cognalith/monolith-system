/**
 * FINANCE TEAM PANEL - Phase 6G
 * Cognalith Inc. | Monolith System
 *
 * Specialized panel for the Finance Team.
 * Features:
 * - Team header with CFO info
 * - 2 subordinate cards (Expense Tracking, Revenue Analytics)
 * - Knowledge Bot status
 * - Finance-specific recommendation queue
 * - Recent activity feed
 * - Finance metrics (optional)
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
  healthy: { color: 'var(--neon-green)', bg: 'rgba(34, 197, 94, 0.15)' },
  attention: { color: 'var(--neon-amber)', bg: 'rgba(255, 184, 0, 0.15)' },
  critical: { color: 'var(--neon-crimson)', bg: 'rgba(255, 0, 60, 0.15)' },
};

const SPECIALTY_CONFIG = {
  expense_tracking: { label: 'Expense Tracking', icon: '\u{1F4B8}' },
  revenue_analytics: { label: 'Revenue Analytics', icon: '\u{1F4C8}' },
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

function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================================================
// TEAM HEADER COMPONENT
// ============================================================================

function FinanceTeamHeader({ cfo, teamHealth, lastReview, onTriggerReview, isReviewing }) {
  const healthStatus = getHealthStatus(teamHealth);
  const healthConfig = HEALTH_STATUS[healthStatus];

  return (
    <div className="finance-team-header">
      <div className="finance-team-title-row">
        <div className="finance-team-title">
          <span className="finance-team-icon">{'\u{1F4B0}'}</span>
          <span className="finance-team-name">Finance Team</span>
        </div>
        <div className="finance-team-health-indicator" style={{ color: healthConfig.color }}>
          <span className="health-dot" style={{ background: healthConfig.color }} />
          <span>Team Health: {teamHealth}%</span>
        </div>
      </div>

      <div className="finance-team-cfo-card">
        <div className="cfo-avatar finance">
          <span>F</span>
        </div>
        <div className="cfo-info">
          <div className="cfo-role">CFO</div>
          <div className="cfo-name">{cfo?.name || 'Chief Financial Officer'}</div>
        </div>
        <div className="cfo-stats">
          <div className="cfo-stat">
            <span className="stat-value finance">{cfo?.healthScore || 0}%</span>
            <span className="stat-label">Health</span>
          </div>
          <div className="cfo-stat">
            <span className="stat-value">{cfo?.activeAmendments || 0}</span>
            <span className="stat-label">Amendments</span>
          </div>
        </div>
        <div className="cfo-review-section">
          <div className="last-review">
            Last Review: {formatRelativeTime(lastReview)}
          </div>
          <button
            className="trigger-review-btn finance"
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

function FinanceSubordinateCard({ subordinate }) {
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
      className="finance-subordinate-card"
      style={{ borderLeft: `3px solid ${healthConfig.color}` }}
    >
      <div className="subordinate-card-header">
        <div className="subordinate-role-section">
          <span className="subordinate-role">{role?.toUpperCase()}</span>
          <span className="subordinate-specialty finance">
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
          <MiniSparkline data={varianceHistory} color="var(--neon-green)" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MINI SPARKLINE COMPONENT
// ============================================================================

function MiniSparkline({ data, color = 'var(--neon-green)' }) {
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

function FinanceKnowledgeBotStatus({ bot, onRunResearch, isRunning }) {
  const {
    lastResearchCycle,
    recommendationsToday,
    pendingRecommendations,
    successRate,
  } = bot;

  return (
    <div className="finance-knowledge-bot">
      <div className="kb-header">
        <div className="kb-title">
          <span className="kb-icon">{'\u{1F916}'}</span>
          <span>finance_knowledge_bot</span>
        </div>
        <span className="kb-status-badge active finance">Active</span>
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
        className="kb-run-research-btn finance"
        onClick={onRunResearch}
        disabled={isRunning}
      >
        {isRunning ? 'Running Research...' : 'Run Research'}
      </button>
    </div>
  );
}

// ============================================================================
// FINANCE RECOMMENDATION QUEUE COMPONENT
// ============================================================================

function FinanceRecommendationQueue({ recommendations, onApply }) {
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
      <div className="finance-recommendation-queue">
        <div className="finance-rec-header">
          <span className="finance-rec-icon">{'\u{1F4CB}'}</span>
          <span className="finance-rec-title">Recommendation Queue</span>
        </div>
        <div className="finance-rec-empty">
          No pending recommendations for Finance Team
        </div>
      </div>
    );
  }

  return (
    <div className="finance-recommendation-queue">
      <div className="finance-rec-header">
        <span className="finance-rec-icon">{'\u{1F4CB}'}</span>
        <span className="finance-rec-title">Recommendation Queue</span>
        <span className="finance-rec-count">{recommendations.length}</span>
      </div>

      <div className="finance-rec-list">
        {Object.keys(groupedRecs).sort().map(subordinate => (
          <div key={subordinate} className="finance-rec-group">
            <div className="finance-rec-group-header">
              {subordinate.toUpperCase()}
              <span className="group-count">{groupedRecs[subordinate].length}</span>
            </div>
            {groupedRecs[subordinate].map((rec, idx) => (
              <FinanceRecommendationItem
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

function FinanceRecommendationItem({ recommendation, onApply }) {
  const { id, type, content, impact } = recommendation;
  const impactConfig = IMPACT_CONFIG[impact] || IMPACT_CONFIG.medium;

  return (
    <div className="finance-rec-item">
      <div className="finance-rec-item-header">
        <span className={`finance-rec-type ${type}`}>{type}</span>
        <span className={`finance-rec-impact ${impactConfig.className}`}>
          {impactConfig.label}
        </span>
      </div>
      <div className="finance-rec-content">
        {truncateText(content, 120)}
      </div>
      <button
        className="finance-rec-apply-btn"
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

function FinanceRecentActivityFeed({ activities, filter, onFilterChange }) {
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
    <div className="finance-activity-feed">
      <div className="finance-activity-header">
        <div className="finance-activity-title">
          <span className="activity-icon">{'\u{1F4CA}'}</span>
          <span>Recent Activity</span>
        </div>
        <select
          className="activity-filter-select finance"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="all">All Subordinates</option>
          {uniqueSubordinates.map(sub => (
            <option key={sub} value={sub}>{sub.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className="finance-activity-list">
        {filteredActivities.length === 0 ? (
          <div className="finance-activity-empty">No recent activity</div>
        ) : (
          filteredActivities.slice(0, 10).map((activity, idx) => (
            <FinanceActivityItem key={activity.id || idx} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}

function FinanceActivityItem({ activity }) {
  const { type, subordinateRole, description, timestamp, outcome } = activity;
  const typeConfig = ACTIVITY_TYPE_CONFIG[type] || { label: type, className: '' };

  return (
    <div className="finance-activity-item">
      <div className="activity-item-row">
        <span className={`activity-type-badge ${typeConfig.className}`}>
          {typeConfig.label}
        </span>
        <span className="activity-subordinate finance">{subordinateRole?.toUpperCase()}</span>
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
// FINANCE METRICS COMPONENT (OPTIONAL)
// ============================================================================

function FinanceMetrics({ metrics }) {
  const {
    monthlyRevenue,
    monthlyExpenses,
    netMargin,
    budgetVariance,
  } = metrics || {};

  return (
    <div className="finance-metrics">
      <div className="finance-metrics-header">
        <span className="metrics-icon">{'\u{1F4CA}'}</span>
        <span className="metrics-title">Finance Metrics (This Month)</span>
      </div>
      <div className="finance-metrics-grid">
        <div className="finance-metric-card">
          <div className="metric-icon">{'\u{1F4B5}'}</div>
          <div className={`metric-value ${monthlyRevenue >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(monthlyRevenue)}
          </div>
          <div className="metric-label">Monthly Revenue</div>
        </div>
        <div className="finance-metric-card">
          <div className="metric-icon">{'\u{1F4B8}'}</div>
          <div className="metric-value">
            {formatCurrency(monthlyExpenses)}
          </div>
          <div className="metric-label">Monthly Expenses</div>
        </div>
        <div className="finance-metric-card">
          <div className="metric-icon">{'\u{1F4C8}'}</div>
          <div className={`metric-value ${netMargin >= 20 ? 'positive' : netMargin >= 10 ? 'warning' : 'negative'}`}>
            {netMargin || 0}%
          </div>
          <div className="metric-label">Net Margin</div>
        </div>
        <div className="finance-metric-card">
          <div className="metric-icon">{'\u{1F3AF}'}</div>
          <div className={`metric-value ${Math.abs(budgetVariance) <= 5 ? 'positive' : Math.abs(budgetVariance) <= 10 ? 'warning' : 'negative'}`}>
            {budgetVariance >= 0 ? '+' : ''}{budgetVariance || 0}%
          </div>
          <div className="metric-label">Budget Variance</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

function FinanceTeamHeaderSkeleton() {
  return (
    <div className="finance-team-header">
      <div className="finance-team-title-row">
        <div className="skeleton" style={{ width: '200px', height: '24px' }} />
        <div className="skeleton" style={{ width: '150px', height: '20px' }} />
      </div>
      <div className="finance-team-cfo-card">
        <div className="skeleton" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
        <div className="cfo-info">
          <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '4px' }} />
          <div className="skeleton" style={{ width: '150px', height: '14px' }} />
        </div>
      </div>
    </div>
  );
}

function FinanceSubordinateCardSkeleton() {
  return (
    <div className="finance-subordinate-card">
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
// MAIN FINANCE TEAM PANEL COMPONENT
// ============================================================================

export function FinanceTeamPanel({ showRefresh = true }) {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [activityFilter, setActivityFilter] = useState('all');

  const fetchTeamData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams/finance`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTeamData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Use mock data as fallback
      setTeamData(getMockFinanceTeamData());
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerReview = useCallback(async () => {
    try {
      setIsReviewing(true);
      await fetch(`${API_BASE_URL}/api/neural-stack/teams/finance/review`, {
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
      await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots/finance-kb/research`, {
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
      <div className="finance-team-panel">
        <FinanceTeamHeaderSkeleton />
        <div className="finance-subordinate-grid">
          {[1, 2].map(i => (
            <FinanceSubordinateCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="finance-team-panel">
      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <FinanceTeamHeader
        cfo={teamData?.cfo}
        teamHealth={teamData?.teamHealth || 0}
        lastReview={teamData?.lastReview}
        onTriggerReview={triggerReview}
        isReviewing={isReviewing}
      />

      <div className="finance-subordinate-grid">
        {teamData?.subordinates?.map((sub, idx) => (
          <FinanceSubordinateCard key={sub.role || idx} subordinate={sub} />
        ))}
      </div>

      <div className="finance-bottom-row">
        <FinanceKnowledgeBotStatus
          bot={teamData?.knowledgeBot || {}}
          onRunResearch={runResearch}
          isRunning={isResearching}
        />

        <FinanceRecommendationQueue
          recommendations={teamData?.recommendations || []}
          onApply={applyRecommendation}
        />
      </div>

      <FinanceRecentActivityFeed
        activities={teamData?.recentActivity || []}
        filter={activityFilter}
        onFilterChange={setActivityFilter}
      />

      {teamData?.financeMetrics && (
        <FinanceMetrics metrics={teamData.financeMetrics} />
      )}

      {showRefresh && (
        <div className="finance-panel-footer">
          <button
            className="refresh-btn-small finance"
            onClick={fetchTeamData}
            title="Refresh Finance Team data"
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

function getMockFinanceTeamData() {
  return {
    teamHealth: 85,
    lastReview: new Date(Date.now() - 1800000).toISOString(),
    cfo: {
      name: 'Chief Financial Officer',
      healthScore: 88,
      activeAmendments: 1,
    },
    subordinates: [
      {
        role: 'expense_tracking_lead',
        specialty: 'expense_tracking',
        trend: 'STABLE',
        variancePercent: 6.2,
        recentTasks: 22,
        activeAmendments: 1,
        lastReviewed: new Date(Date.now() - 1800000).toISOString(),
        healthScore: 86,
        varianceHistory: [7, 6.8, 6.5, 6.3, 6.2, 6.2],
      },
      {
        role: 'revenue_analytics_lead',
        specialty: 'revenue_analytics',
        trend: 'IMPROVING',
        variancePercent: 4.8,
        recentTasks: 31,
        activeAmendments: 0,
        lastReviewed: new Date(Date.now() - 3600000).toISOString(),
        healthScore: 92,
        varianceHistory: [8, 7, 6, 5.5, 5, 4.8],
      },
    ],
    knowledgeBot: {
      lastResearchCycle: new Date(Date.now() - 2700000).toISOString(),
      recommendationsToday: 4,
      pendingRecommendations: 2,
      successRate: 91,
    },
    recommendations: [
      {
        id: 'rec-fin-1',
        type: 'expense_optimization',
        subordinateRole: 'expense_tracking_lead',
        content: 'Implement automated expense categorization using ML to reduce manual classification time by 60%.',
        impact: 'high',
      },
      {
        id: 'rec-fin-2',
        type: 'analytics_improvement',
        subordinateRole: 'revenue_analytics_lead',
        content: 'Add cohort-based revenue retention analysis to identify churn patterns earlier.',
        impact: 'medium',
      },
    ],
    recentActivity: [
      {
        id: 'act-fin-1',
        type: 'review',
        subordinateRole: 'expense_tracking_lead',
        description: 'CFO reviewed monthly expense variance report',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        outcome: 'APPROVED',
      },
      {
        id: 'act-fin-2',
        type: 'amendment',
        subordinateRole: 'revenue_analytics_lead',
        description: 'Knowledge update applied: SaaS metrics best practices',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        outcome: 'ACTIVE',
      },
      {
        id: 'act-fin-3',
        type: 'recommendation',
        subordinateRole: 'expense_tracking_lead',
        description: 'New recommendation generated: expense automation strategy',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: 'act-fin-4',
        type: 'review',
        subordinateRole: 'revenue_analytics_lead',
        description: 'CFO reviewed Q1 revenue forecast model',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        outcome: 'APPROVED',
      },
      {
        id: 'act-fin-5',
        type: 'escalation',
        subordinateRole: 'expense_tracking_lead',
        description: 'Budget variance exceeds 10% threshold in marketing category',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        outcome: 'ACKNOWLEDGED',
      },
    ],
    financeMetrics: {
      monthlyRevenue: 125000,
      monthlyExpenses: 98000,
      netMargin: 21.6,
      budgetVariance: -3.2,
    },
  };
}

export default FinanceTeamPanel;
