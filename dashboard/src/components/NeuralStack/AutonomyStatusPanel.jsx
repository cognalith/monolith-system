/**
 * AUTONOMY STATUS PANEL - Phase 5E
 * Cognalith Inc. | Monolith System
 *
 * Displays autonomy mode status and statistics.
 * Shows: autonomous vs escalated amendments, autonomy rate.
 */

import React from 'react';
import { useAutonomyStats } from '../../hooks/useNeuralStack.js';

/**
 * Status Badge component
 */
function StatusBadge({ status }) {
  const statusConfig = {
    active: { label: 'AUTONOMOUS', className: 'status-active' },
    suspended: { label: 'SUSPENDED', className: 'status-suspended' },
    strict: { label: 'STRICT MODE', className: 'status-strict' },
  };

  const config = statusConfig[status] || statusConfig.active;

  return (
    <span className={`autonomy-status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}

/**
 * Stats Card component
 */
function StatsCard({ label, value, subtext, icon }) {
  return (
    <div className="autonomy-stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {subtext && <div className="stat-subtext">{subtext}</div>}
      </div>
    </div>
  );
}

/**
 * Autonomy Rate Gauge
 */
function AutonomyGauge({ rate }) {
  const color = rate >= 80 ? '#4ade80' : rate >= 60 ? '#fbbf24' : '#ef4444';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <div className="autonomy-gauge">
      <svg viewBox="0 0 100 100" className="gauge-svg">
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="#333"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="18"
          fontWeight="bold"
        >
          {rate}%
        </text>
      </svg>
      <div className="gauge-label">Autonomy Rate</div>
    </div>
  );
}

/**
 * Exceptions List
 */
function ExceptionsList({ exceptions }) {
  if (!exceptions || exceptions.length === 0) return null;

  return (
    <div className="exceptions-list">
      <div className="exceptions-header">CEO Escalation Triggers:</div>
      <ul>
        {exceptions.map((exc, i) => (
          <li key={i}>{exc}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Main Autonomy Status Panel component
 */
export function AutonomyStatusPanel() {
  const { stats, loading, error, refresh } = useAutonomyStats();

  if (loading && !stats) {
    return (
      <div className="autonomy-status-panel">
        <div className="panel-header">
          <span className="panel-icon">&#9672;</span>
          <span>Autonomy Status</span>
        </div>
        <div className="neural-stack-loading">Loading...</div>
      </div>
    );
  }

  const overall = stats?.overall || {};
  const recent = stats?.recent_24h || {};
  const mode = stats?.autonomy_mode || {};

  return (
    <div className="autonomy-status-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">&#9672;</span>
          <span>Autonomy Status</span>
        </div>
        <div className="header-right">
          <StatusBadge status={mode.status} />
          <button
            className="refresh-btn-small"
            onClick={refresh}
            title="Refresh"
          >
            &#8635;
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner-small">{error}</div>
      )}

      <div className="autonomy-content">
        <div className="autonomy-main">
          <AutonomyGauge rate={overall.autonomy_rate || 100} />

          <div className="stats-grid">
            <StatsCard
              label="Autonomous"
              value={overall.autonomous || 0}
              subtext="auto-approved"
              icon="&#10003;"
            />
            <StatsCard
              label="Escalated"
              value={overall.escalated || 0}
              subtext="CEO review"
              icon="&#9888;"
            />
            <StatsCard
              label="Reversions"
              value={stats?.total_reversions || 0}
              subtext="auto-reverted"
              icon="&#8634;"
            />
            <StatsCard
              label="Pending"
              value={stats?.pending_escalations || 0}
              subtext="awaiting CEO"
              icon="&#9203;"
            />
          </div>
        </div>

        <div className="autonomy-recent">
          <div className="recent-header">Last 24 Hours</div>
          <div className="recent-stats">
            <div className="recent-stat">
              <span className="recent-value">{recent.total || 0}</span>
              <span className="recent-label">Total</span>
            </div>
            <div className="recent-stat">
              <span className="recent-value">{recent.autonomous || 0}</span>
              <span className="recent-label">Autonomous</span>
            </div>
            <div className="recent-stat">
              <span className="recent-value">{recent.escalated || 0}</span>
              <span className="recent-label">Escalated</span>
            </div>
          </div>
        </div>

        <ExceptionsList exceptions={mode.exceptions} />

        <div className="autonomy-mode-description">
          {mode.description || 'CoS operates autonomously for standard amendments'}
        </div>
      </div>
    </div>
  );
}

export default AutonomyStatusPanel;
