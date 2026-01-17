/**
 * AGENT HEALTH GRID - Phase 5D
 * Cognalith Inc. | Monolith System
 *
 * Displays health overview for all 15 Monolith agents.
 * Shows variance %, CoS score, success rate, and trend indicators.
 */

import React from 'react';
import { useAgentHealth } from '../../hooks/useNeuralStack.js';

const STATUS_ICONS = {
  healthy: '✓',
  attention: '⚠',
  declining: '✗',
};

const TREND_ARROWS = {
  improving: '↑',
  stable: '→',
  declining: '↓',
};

/**
 * Individual agent card component
 */
function AgentCard({ agent, onClick }) {
  const {
    agent_role,
    avg_variance_percent,
    avg_cos_score,
    success_rate,
    trend,
    status,
    active_amendments,
  } = agent;

  const getVarianceClass = (variance) => {
    if (variance <= 10) return 'positive';
    if (variance <= 20) return 'warning';
    return 'negative';
  };

  const getCosClass = (score) => {
    if (score >= 0.85) return 'positive';
    if (score >= 0.7) return 'warning';
    return 'negative';
  };

  const getSuccessClass = (rate) => {
    if (rate >= 85) return 'positive';
    if (rate >= 70) return 'warning';
    return 'negative';
  };

  return (
    <div
      className={`agent-card status-${status || 'healthy'}`}
      onClick={() => onClick && onClick(agent)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick && onClick(agent)}
    >
      <div className="agent-card-header">
        <span className="agent-role">{agent_role}</span>
        <span className="agent-status-indicator">
          {STATUS_ICONS[status] || STATUS_ICONS.healthy}
        </span>
      </div>

      <div className="agent-metrics">
        <div className="agent-metric">
          <span className="agent-metric-label">Variance</span>
          <span className={`agent-metric-value ${getVarianceClass(avg_variance_percent)}`}>
            {avg_variance_percent?.toFixed(1)}%
            <span className={`trend-arrow ${trend}`}>
              {TREND_ARROWS[trend] || TREND_ARROWS.stable}
            </span>
          </span>
        </div>

        <div className="agent-metric">
          <span className="agent-metric-label">CoS Score</span>
          <span className={`agent-metric-value ${getCosClass(avg_cos_score)}`}>
            {avg_cos_score?.toFixed(2)}
          </span>
        </div>

        <div className="agent-metric">
          <span className="agent-metric-label">Success</span>
          <span className={`agent-metric-value ${getSuccessClass(success_rate)}`}>
            {success_rate}%
          </span>
        </div>

        <div className="agent-metric">
          <span className="agent-metric-label">Amendments</span>
          <span className="agent-metric-value">
            {active_amendments || 0}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Agent skeleton loader
 */
function AgentCardSkeleton() {
  return (
    <div className="agent-card">
      <div className="agent-card-header">
        <div className="skeleton" style={{ width: '60px', height: '16px' }} />
        <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
      </div>
      <div className="agent-metrics">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="agent-metric">
            <div className="skeleton" style={{ width: '50px', height: '10px', marginBottom: '4px' }} />
            <div className="skeleton" style={{ width: '40px', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main Agent Health Grid component
 */
export function AgentHealthGrid({ onAgentSelect, showRefresh = true }) {
  const { agents, loading, error, refresh } = useAgentHealth();

  if (loading && agents.length === 0) {
    return (
      <div className="agent-health-section">
        <div className="section-header">
          <h3>Agent Health Overview</h3>
        </div>
        <div className="agent-health-grid">
          {[...Array(15)].map((_, i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Sort agents by status priority (declining > attention > healthy)
  const sortedAgents = [...agents].sort((a, b) => {
    const priority = { declining: 0, attention: 1, healthy: 2 };
    return (priority[a.status] || 2) - (priority[b.status] || 2);
  });

  // Calculate summary stats
  const healthyCount = agents.filter(a => a.status === 'healthy').length;
  const attentionCount = agents.filter(a => a.status === 'attention').length;
  const decliningCount = agents.filter(a => a.status === 'declining').length;

  return (
    <div className="agent-health-section">
      <div className="section-header">
        <div className="section-title-group">
          <h3>Agent Health Overview</h3>
          <div className="health-summary">
            <span className="health-badge healthy">{healthyCount} healthy</span>
            {attentionCount > 0 && (
              <span className="health-badge attention">{attentionCount} attention</span>
            )}
            {decliningCount > 0 && (
              <span className="health-badge declining">{decliningCount} declining</span>
            )}
          </div>
        </div>
        {showRefresh && (
          <button
            className="refresh-btn"
            onClick={refresh}
            title="Refresh data"
            aria-label="Refresh agent health data"
          >
            ↻
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          Data may be stale: {error}
        </div>
      )}

      <div className="agent-health-grid">
        {sortedAgents.map((agent) => (
          <AgentCard
            key={agent.agent_role}
            agent={agent}
            onClick={onAgentSelect}
          />
        ))}
      </div>
    </div>
  );
}

export default AgentHealthGrid;
