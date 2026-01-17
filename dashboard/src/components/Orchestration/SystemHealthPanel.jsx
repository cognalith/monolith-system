/**
 * SYSTEM HEALTH PANEL - Phase 7
 * Cognalith Inc. | Monolith System
 *
 * Overall orchestration health dashboard.
 * Features:
 * - Stats: total queued, active, blocked, completed today
 * - Blocked breakdown by type (agent/decision/auth/payment)
 * - Avg completion time, throughput/hour
 * - Lists of idle agents and overloaded agents (queue > 10)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.js';

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const BLOCKER_TYPES = {
  agent: { label: 'Agent Dependency', icon: '\u{1F464}', color: 'var(--neon-cyan)' },
  decision: { label: 'Awaiting Decision', icon: '\u{1F914}', color: 'var(--neon-amber)' },
  auth: { label: 'Auth Required', icon: '\u{1F512}', color: '#a78bfa' },
  payment: { label: 'Payment Pending', icon: '\u{1F4B3}', color: '#34d399' },
  external: { label: 'External Wait', icon: '\u{1F310}', color: '#f472b6' },
  resource: { label: 'Resource Unavailable', icon: '\u{1F4E6}', color: '#60a5fa' },
};

const STAT_ICONS = {
  queued: '\u{1F4CB}',
  active: '\u25B6',
  blocked: '\u26D4',
  completed: '\u2713',
  throughput: '\u{1F4C8}',
  avgTime: '\u23F1',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return '--';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

// ============================================================================
// STAT CARD COMPONENT
// ============================================================================

function StatCard({ icon, label, value, subtext, color = 'var(--neon-cyan)', size = 'normal' }) {
  return (
    <div className={`system-stat-card ${size}`}>
      <div className="stat-icon" style={{ color }}>
        {icon}
      </div>
      <div className="stat-content">
        <div className="stat-value" style={{ color }}>
          {value}
        </div>
        <div className="stat-label">{label}</div>
        {subtext && <div className="stat-subtext">{subtext}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// BLOCKED BREAKDOWN COMPONENT
// ============================================================================

function BlockedBreakdown({ breakdown }) {
  const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return (
      <div className="blocked-breakdown">
        <div className="breakdown-header">
          <span className="breakdown-title">Blocked Tasks Breakdown</span>
        </div>
        <div className="breakdown-empty">
          <span className="empty-icon">{'\u2713'}</span>
          <span>No blocked tasks</span>
        </div>
      </div>
    );
  }

  return (
    <div className="blocked-breakdown">
      <div className="breakdown-header">
        <span className="breakdown-title">Blocked Tasks Breakdown</span>
        <span className="breakdown-total">{total} total</span>
      </div>
      <div className="breakdown-bars">
        {Object.entries(breakdown).map(([type, count]) => {
          if (count === 0) return null;
          const config = BLOCKER_TYPES[type] || { label: type, icon: '\u2753', color: '#888' };
          const percentage = (count / total) * 100;

          return (
            <div key={type} className="breakdown-item">
              <div className="breakdown-label">
                <span className="breakdown-icon">{config.icon}</span>
                <span className="breakdown-name">{config.label}</span>
                <span className="breakdown-count">{count}</span>
              </div>
              <div className="breakdown-bar-container">
                <div
                  className="breakdown-bar"
                  style={{
                    width: `${percentage}%`,
                    background: config.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// AGENT LIST COMPONENT
// ============================================================================

function AgentList({ title, icon, agents, emptyText, type }) {
  const isWarning = type === 'overloaded';

  return (
    <div className={`agent-list-section ${type}`}>
      <div className="agent-list-header">
        <span className="agent-list-icon">{icon}</span>
        <span className="agent-list-title">{title}</span>
        <span className={`agent-list-count ${isWarning ? 'warning' : ''}`}>
          {agents.length}
        </span>
      </div>
      <div className="agent-list-content">
        {agents.length === 0 ? (
          <div className="agent-list-empty">{emptyText}</div>
        ) : (
          <div className="agent-list-items">
            {agents.map((agent) => (
              <div key={agent.role} className="agent-list-item">
                <span className="agent-role">{agent.role?.toUpperCase()}</span>
                <span className="agent-team">{agent.team}</span>
                {type === 'overloaded' && (
                  <span className="agent-queue-size">{agent.queueSize} queued</span>
                )}
                {type === 'idle' && agent.idleSince && (
                  <span className="agent-idle-time">
                    {formatIdleTime(agent.idleSince)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatIdleTime(since) {
  if (!since) return '';
  const now = new Date();
  const idleStart = new Date(since);
  const diffMs = now - idleStart;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m idle`;
  const diffHours = Math.floor(diffMs / 3600000);
  return `${diffHours}h idle`;
}

// ============================================================================
// THROUGHPUT CHART (Simple Bar)
// ============================================================================

function ThroughputChart({ hourlyData }) {
  if (!hourlyData || hourlyData.length === 0) {
    return null;
  }

  const maxValue = Math.max(...hourlyData.map((h) => h.completed));

  return (
    <div className="throughput-chart">
      <div className="throughput-header">
        <span className="throughput-title">Hourly Throughput (Last 8h)</span>
      </div>
      <div className="throughput-bars">
        {hourlyData.slice(-8).map((hour, idx) => (
          <div key={idx} className="throughput-bar-wrapper">
            <div
              className="throughput-bar"
              style={{
                height: `${maxValue > 0 ? (hour.completed / maxValue) * 100 : 0}%`,
              }}
            />
            <span className="throughput-value">{hour.completed}</span>
            <span className="throughput-hour">{hour.hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADER
// ============================================================================

function SystemHealthSkeleton() {
  return (
    <div className="system-health-panel">
      <div className="panel-header">
        <div className="skeleton" style={{ width: '200px', height: '24px' }} />
      </div>
      <div className="stats-row">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ width: '120px', height: '80px' }} />
        ))}
      </div>
      <div className="health-grid">
        <div className="skeleton" style={{ width: '100%', height: '150px' }} />
        <div className="skeleton" style={{ width: '100%', height: '150px' }} />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SystemHealthPanel({ refreshInterval = 15000 }) {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orchestration/system-health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setHealthData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setHealthData(getMockHealthData());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  const overallHealth = useMemo(() => {
    if (!healthData) return 'unknown';
    const { blocked, active, queued } = healthData.stats || {};
    const total = (blocked || 0) + (active || 0) + (queued || 0);
    if (total === 0) return 'healthy';
    const blockedRatio = (blocked || 0) / total;
    if (blockedRatio > 0.3) return 'critical';
    if (blockedRatio > 0.15) return 'warning';
    return 'healthy';
  }, [healthData]);

  if (loading && !healthData) {
    return <SystemHealthSkeleton />;
  }

  const { stats, blockedBreakdown, idleAgents, overloadedAgents, hourlyThroughput } =
    healthData || {};

  return (
    <div className="system-health-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">{'\u{1F4CA}'}</span>
          <span className="panel-title">System Health</span>
          <span className={`health-status-badge ${overallHealth}`}>
            {overallHealth === 'healthy' && '\u2713 Healthy'}
            {overallHealth === 'warning' && '\u26A0 Warning'}
            {overallHealth === 'critical' && '\u26D4 Critical'}
          </span>
        </div>
        <div className="header-right">
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

      <div className="stats-row">
        <StatCard
          icon={STAT_ICONS.queued}
          label="Queued"
          value={stats?.queued || 0}
          color="#888"
        />
        <StatCard
          icon={STAT_ICONS.active}
          label="Active"
          value={stats?.active || 0}
          color="var(--neon-cyan)"
        />
        <StatCard
          icon={STAT_ICONS.blocked}
          label="Blocked"
          value={stats?.blocked || 0}
          color="var(--neon-crimson)"
        />
        <StatCard
          icon={STAT_ICONS.completed}
          label="Completed Today"
          value={stats?.completedToday || 0}
          color="var(--neon-cyan)"
        />
      </div>

      <div className="metrics-row">
        <StatCard
          icon={STAT_ICONS.throughput}
          label="Throughput"
          value={`${stats?.throughputPerHour || 0}/hr`}
          subtext="tasks completed"
          color="var(--neon-cyan)"
          size="small"
        />
        <StatCard
          icon={STAT_ICONS.avgTime}
          label="Avg Completion"
          value={formatDuration(stats?.avgCompletionTime)}
          subtext="per task"
          color="var(--neon-amber)"
          size="small"
        />
      </div>

      <div className="health-grid">
        <BlockedBreakdown breakdown={blockedBreakdown || {}} />

        <ThroughputChart hourlyData={hourlyThroughput} />
      </div>

      <div className="agents-row">
        <AgentList
          title="Idle Agents"
          icon="\u23F8"
          agents={idleAgents || []}
          emptyText="All agents are active"
          type="idle"
        />
        <AgentList
          title="Overloaded Agents"
          icon="\u26A0"
          agents={overloadedAgents || []}
          emptyText="No overloaded agents"
          type="overloaded"
        />
      </div>
    </div>
  );
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockHealthData() {
  return {
    stats: {
      queued: 23,
      active: 8,
      blocked: 5,
      completedToday: 47,
      throughputPerHour: 6.2,
      avgCompletionTime: 42, // minutes
    },
    blockedBreakdown: {
      agent: 2,
      decision: 2,
      auth: 0,
      payment: 1,
      external: 0,
      resource: 0,
    },
    idleAgents: [
      { role: 'cfo', team: 'Finance', idleSince: new Date(Date.now() - 45 * 60000).toISOString() },
      { role: 'hr_manager', team: 'People', idleSince: new Date(Date.now() - 90 * 60000).toISOString() },
    ],
    overloadedAgents: [
      { role: 'web_dev', team: 'Technology', queueSize: 12 },
      { role: 'qa', team: 'Technology', queueSize: 11 },
    ],
    hourlyThroughput: [
      { hour: '09:00', completed: 4 },
      { hour: '10:00', completed: 7 },
      { hour: '11:00', completed: 5 },
      { hour: '12:00', completed: 3 },
      { hour: '13:00', completed: 6 },
      { hour: '14:00', completed: 8 },
      { hour: '15:00', completed: 9 },
      { hour: '16:00', completed: 5 },
    ],
  };
}

export default SystemHealthPanel;
