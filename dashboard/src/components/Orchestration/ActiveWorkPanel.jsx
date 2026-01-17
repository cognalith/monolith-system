/**
 * ACTIVE WORK PANEL - Phase 7
 * Cognalith Inc. | Monolith System
 *
 * Shows what each agent is currently working on.
 * Features:
 * - Grid of agent cards with role, team, status
 * - Active task title and progress
 * - Queue depth and blocked count badges
 * - Color coding: green=working, gray=idle, red=blocked
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../config/api.js';

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const STATUS_CONFIG = {
  working: {
    label: 'Working',
    color: 'var(--neon-cyan)',
    bg: 'rgba(0, 240, 255, 0.15)',
    borderColor: 'rgba(0, 240, 255, 0.4)',
    icon: '\u25B6',
  },
  idle: {
    label: 'Idle',
    color: '#888',
    bg: 'rgba(136, 136, 136, 0.15)',
    borderColor: 'rgba(136, 136, 136, 0.4)',
    icon: '\u25A0',
  },
  blocked: {
    label: 'Blocked',
    color: 'var(--neon-crimson)',
    bg: 'rgba(255, 0, 60, 0.15)',
    borderColor: 'rgba(255, 0, 60, 0.4)',
    icon: '\u26A0',
  },
};

const TEAM_COLORS = {
  technology: '#00f0ff',
  marketing: '#ff6b9d',
  product: '#a78bfa',
  operations: '#fbbf24',
  finance: '#34d399',
  people: '#f472b6',
  executive: '#f59e0b',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatProgress(progress) {
  if (progress === null || progress === undefined) return '--';
  return `${Math.round(progress)}%`;
}

function truncateText(text, maxLength = 40) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================================================
// AGENT CARD COMPONENT
// ============================================================================

function AgentCard({ agent }) {
  const {
    role,
    team,
    status,
    activeTask,
    queueDepth,
    blockedCount,
    progress,
  } = agent;

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const teamColor = TEAM_COLORS[team?.toLowerCase()] || '#888';

  return (
    <div
      className="orchestration-agent-card"
      style={{
        borderLeft: `3px solid ${statusConfig.borderColor}`,
        background: statusConfig.bg,
      }}
    >
      <div className="agent-card-header">
        <div className="agent-info">
          <span className="agent-role-name">{role?.toUpperCase()}</span>
          <span className="agent-team-badge" style={{ color: teamColor }}>
            {team}
          </span>
        </div>
        <div
          className="agent-status-badge"
          style={{ color: statusConfig.color, background: statusConfig.bg }}
        >
          <span className="status-icon">{statusConfig.icon}</span>
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {status === 'working' && activeTask && (
        <div className="agent-active-task">
          <div className="task-title">{truncateText(activeTask.title, 50)}</div>
          <div className="task-progress-bar">
            <div
              className="task-progress-fill"
              style={{ width: `${progress || 0}%` }}
            />
          </div>
          <div className="task-progress-text">{formatProgress(progress)}</div>
        </div>
      )}

      {status === 'blocked' && (
        <div className="agent-blocked-info">
          <span className="blocked-icon">{'\u26D4'}</span>
          <span className="blocked-text">
            {activeTask?.blockerType || 'Waiting on dependency'}
          </span>
        </div>
      )}

      {status === 'idle' && (
        <div className="agent-idle-info">
          <span className="idle-text">No active tasks</span>
        </div>
      )}

      <div className="agent-badges">
        <div className="badge queue-badge">
          <span className="badge-label">Queue</span>
          <span className={`badge-value ${queueDepth > 5 ? 'warning' : ''}`}>
            {queueDepth || 0}
          </span>
        </div>
        {blockedCount > 0 && (
          <div className="badge blocked-badge">
            <span className="badge-label">Blocked</span>
            <span className="badge-value error">{blockedCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADER
// ============================================================================

function AgentCardSkeleton() {
  return (
    <div className="orchestration-agent-card skeleton-card">
      <div className="agent-card-header">
        <div className="skeleton" style={{ width: '100px', height: '16px' }} />
        <div className="skeleton" style={{ width: '70px', height: '20px' }} />
      </div>
      <div className="skeleton" style={{ width: '100%', height: '40px', marginTop: '0.75rem' }} />
      <div className="agent-badges">
        <div className="skeleton" style={{ width: '60px', height: '24px' }} />
        <div className="skeleton" style={{ width: '60px', height: '24px' }} />
      </div>
    </div>
  );
}

// ============================================================================
// STATS SUMMARY
// ============================================================================

function StatsSummary({ stats }) {
  return (
    <div className="active-work-stats">
      <div className="stat-item working">
        <span className="stat-value">{stats.working || 0}</span>
        <span className="stat-label">Working</span>
      </div>
      <div className="stat-item idle">
        <span className="stat-value">{stats.idle || 0}</span>
        <span className="stat-label">Idle</span>
      </div>
      <div className="stat-item blocked">
        <span className="stat-value">{stats.blocked || 0}</span>
        <span className="stat-label">Blocked</span>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ActiveWorkPanel({ refreshInterval = 10000 }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orchestration/active-work`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAgents(data.agents || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Use mock data as fallback
      setAgents(getMockAgentData());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  // Calculate stats
  const stats = agents.reduce(
    (acc, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1;
      return acc;
    },
    { working: 0, idle: 0, blocked: 0 }
  );

  if (loading && agents.length === 0) {
    return (
      <div className="active-work-panel">
        <div className="panel-header">
          <div className="header-left">
            <span className="panel-icon">{'\u{1F4BC}'}</span>
            <span className="panel-title">Active Work</span>
          </div>
        </div>
        <div className="agent-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="active-work-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">{'\u{1F4BC}'}</span>
          <span className="panel-title">Active Work</span>
        </div>
        <div className="header-right">
          <StatsSummary stats={stats} />
          <button
            className="refresh-btn-small"
            onClick={fetchData}
            title="Refresh"
          >
            {'\u21BB'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <div className="agent-grid">
        {agents.map((agent) => (
          <AgentCard key={agent.role} agent={agent} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockAgentData() {
  return [
    {
      role: 'cto',
      team: 'Technology',
      status: 'working',
      activeTask: { title: 'Review architecture proposal for microservices migration' },
      progress: 65,
      queueDepth: 3,
      blockedCount: 0,
    },
    {
      role: 'web_dev',
      team: 'Technology',
      status: 'working',
      activeTask: { title: 'Implement new dashboard components' },
      progress: 45,
      queueDepth: 5,
      blockedCount: 1,
    },
    {
      role: 'cmo',
      team: 'Marketing',
      status: 'blocked',
      activeTask: { title: 'Q1 Campaign launch', blockerType: 'Awaiting CEO approval' },
      progress: 80,
      queueDepth: 7,
      blockedCount: 2,
    },
    {
      role: 'devops',
      team: 'Technology',
      status: 'working',
      activeTask: { title: 'Configure Kubernetes auto-scaling' },
      progress: 90,
      queueDepth: 2,
      blockedCount: 0,
    },
    {
      role: 'cfo',
      team: 'Finance',
      status: 'idle',
      activeTask: null,
      progress: null,
      queueDepth: 1,
      blockedCount: 0,
    },
    {
      role: 'product_manager',
      team: 'Product',
      status: 'working',
      activeTask: { title: 'Finalize feature roadmap for Q2' },
      progress: 30,
      queueDepth: 4,
      blockedCount: 1,
    },
    {
      role: 'qa',
      team: 'Technology',
      status: 'blocked',
      activeTask: { title: 'End-to-end test suite', blockerType: 'Waiting on API deployment' },
      progress: 55,
      queueDepth: 8,
      blockedCount: 3,
    },
    {
      role: 'hr_manager',
      team: 'People',
      status: 'idle',
      activeTask: null,
      progress: null,
      queueDepth: 0,
      blockedCount: 0,
    },
  ];
}

export default ActiveWorkPanel;
