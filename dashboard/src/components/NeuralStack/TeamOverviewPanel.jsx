/**
 * TEAM OVERVIEW PANEL - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Card-based overview of all teams showing:
 * - Team name and lead role
 * - Health score (green/yellow/red)
 * - Subordinate count
 * - Recent amendments count
 * - Click to drill down
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../config/api.js';

const HEALTH_COLORS = {
  healthy: { bg: 'rgba(0, 240, 255, 0.15)', border: 'var(--neon-cyan)', label: 'Healthy' },
  attention: { bg: 'rgba(255, 184, 0, 0.15)', border: 'var(--neon-amber)', label: 'Attention' },
  critical: { bg: 'rgba(255, 0, 60, 0.15)', border: 'var(--neon-crimson)', label: 'Critical' },
};

/**
 * Get health status based on score
 */
function getHealthStatus(score) {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'attention';
  return 'critical';
}

/**
 * Individual team card component
 */
function TeamCard({ team, onClick }) {
  const {
    team_id,
    team_name,
    team_lead,
    health_score,
    subordinate_count,
    recent_amendments,
    knowledge_bot_active,
    last_review_at,
  } = team;

  const healthStatus = getHealthStatus(health_score);
  const healthConfig = HEALTH_COLORS[healthStatus];

  return (
    <div
      className="team-card"
      onClick={() => onClick && onClick(team)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick && onClick(team)}
      style={{
        background: healthConfig.bg,
        borderLeft: `3px solid ${healthConfig.border}`,
      }}
    >
      <div className="team-card-header">
        <div className="team-info">
          <span className="team-name">{team_name}</span>
          <span className="team-lead-label">Lead: {team_lead?.toUpperCase()}</span>
        </div>
        <div className="team-health-badge" data-status={healthStatus}>
          <span className="health-score">{health_score}%</span>
        </div>
      </div>

      <div className="team-metrics">
        <div className="team-metric">
          <span className="team-metric-label">Subordinates</span>
          <span className="team-metric-value">{subordinate_count}</span>
        </div>

        <div className="team-metric">
          <span className="team-metric-label">Amendments</span>
          <span className="team-metric-value">{recent_amendments || 0}</span>
        </div>

        <div className="team-metric">
          <span className="team-metric-label">Knowledge Bot</span>
          <span className={`team-metric-value ${knowledge_bot_active ? 'positive' : 'warning'}`}>
            {knowledge_bot_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="team-metric">
          <span className="team-metric-label">Last Review</span>
          <span className="team-metric-value">
            {last_review_at ? formatRelativeTime(last_review_at) : 'Never'}
          </span>
        </div>
      </div>

      <div className="team-card-footer">
        <span className="drill-down-hint">Click to view details</span>
      </div>
    </div>
  );
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
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
 * Team card skeleton loader
 */
function TeamCardSkeleton() {
  return (
    <div className="team-card">
      <div className="team-card-header">
        <div className="team-info">
          <div className="skeleton" style={{ width: '100px', height: '16px', marginBottom: '4px' }} />
          <div className="skeleton" style={{ width: '70px', height: '12px' }} />
        </div>
        <div className="skeleton" style={{ width: '50px', height: '24px', borderRadius: '12px' }} />
      </div>
      <div className="team-metrics">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="team-metric">
            <div className="skeleton" style={{ width: '60px', height: '10px', marginBottom: '4px' }} />
            <div className="skeleton" style={{ width: '40px', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main Team Overview Panel component
 */
export function TeamOverviewPanel({ onTeamSelect, showRefresh = true }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTeams(data.teams || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Fallback mock data
      setTeams(getMockTeams());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    const interval = setInterval(fetchTeams, 30000);
    return () => clearInterval(interval);
  }, [fetchTeams]);

  // Calculate summary stats
  const healthyCount = teams.filter(t => getHealthStatus(t.health_score) === 'healthy').length;
  const attentionCount = teams.filter(t => getHealthStatus(t.health_score) === 'attention').length;
  const criticalCount = teams.filter(t => getHealthStatus(t.health_score) === 'critical').length;

  // Sort teams by health score (lowest first to highlight issues)
  const sortedTeams = [...teams].sort((a, b) => a.health_score - b.health_score);

  if (loading && teams.length === 0) {
    return (
      <div className="team-overview-panel">
        <div className="panel-header">
          <div className="header-left">
            <span className="panel-icon">&#9670;</span>
            <span className="panel-title">Team Hierarchy</span>
          </div>
        </div>
        <div className="team-grid">
          {[...Array(4)].map((_, i) => (
            <TeamCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="team-overview-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">&#9670;</span>
          <span className="panel-title">Team Hierarchy</span>
          <div className="health-summary">
            <span className="health-badge healthy">{healthyCount} healthy</span>
            {attentionCount > 0 && (
              <span className="health-badge attention">{attentionCount} attention</span>
            )}
            {criticalCount > 0 && (
              <span className="health-badge declining">{criticalCount} critical</span>
            )}
          </div>
        </div>
        {showRefresh && (
          <button
            className="refresh-btn-small"
            onClick={fetchTeams}
            title="Refresh"
            aria-label="Refresh team data"
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

      <div className="team-grid">
        {sortedTeams.map((team) => (
          <TeamCard
            key={team.team_id}
            team={team}
            onClick={onTeamSelect}
          />
        ))}
      </div>

      {teams.length === 0 && !loading && (
        <div className="neural-stack-empty">
          <div className="neural-stack-empty-icon">&#128101;</div>
          <div>No team data available</div>
        </div>
      )}
    </div>
  );
}

/**
 * Mock data for development/fallback
 */
function getMockTeams() {
  return [
    {
      team_id: 'executive',
      team_name: 'Executive Team',
      team_lead: 'ceo',
      health_score: 92,
      subordinate_count: 4,
      recent_amendments: 2,
      knowledge_bot_active: true,
      last_review_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      team_id: 'operations',
      team_name: 'Operations Team',
      team_lead: 'coo',
      health_score: 78,
      subordinate_count: 3,
      recent_amendments: 5,
      knowledge_bot_active: true,
      last_review_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      team_id: 'technology',
      team_name: 'Technology Team',
      team_lead: 'cto',
      health_score: 85,
      subordinate_count: 4,
      recent_amendments: 3,
      knowledge_bot_active: true,
      last_review_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      team_id: 'finance',
      team_name: 'Finance Team',
      team_lead: 'cfo',
      health_score: 55,
      subordinate_count: 2,
      recent_amendments: 8,
      knowledge_bot_active: false,
      last_review_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
}

export default TeamOverviewPanel;
