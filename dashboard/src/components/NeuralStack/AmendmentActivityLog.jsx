/**
 * AMENDMENT ACTIVITY LOG - Phase 5D
 * Cognalith Inc. | Monolith System
 *
 * Displays recent amendment activity with status indicators.
 * Shows pending, active, and reverted amendments.
 */

import React from 'react';
import { useAmendmentActivity } from '../../hooks/useNeuralStack.js';

const STATUS_CONFIG = {
  pending: {
    icon: '○',
    label: 'Pending',
    color: '#ffaa00',
  },
  evaluating: {
    icon: '◐',
    label: 'Evaluating',
    color: '#6464ff',
  },
  active: {
    icon: '●',
    label: 'Active',
    color: '#00ff88',
  },
  proven: {
    icon: '✓',
    label: 'Proven',
    color: '#00ff88',
  },
  reverted: {
    icon: '✗',
    label: 'Reverted',
    color: '#ff4444',
  },
  rejected: {
    icon: '✗',
    label: 'Rejected',
    color: '#ff4444',
  },
};

/**
 * Format relative time
 */
function formatRelativeTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Individual amendment item
 */
function AmendmentItem({ amendment }) {
  const {
    agent_role,
    amendment_type,
    trigger_pattern,
    evaluation_status,
    approval_status,
    created_at,
    pattern_confidence,
  } = amendment;

  // Determine display status
  const status = approval_status === 'rejected'
    ? 'rejected'
    : evaluation_status || 'pending';

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  // Format amendment type for display
  const formatType = (type) => {
    if (!type) return 'Unknown';
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="amendment-item">
      <div
        className={`amendment-status-icon ${status}`}
        style={{ background: `${statusConfig.color}20`, color: statusConfig.color }}
        title={statusConfig.label}
      >
        {statusConfig.icon}
      </div>

      <div className="amendment-content">
        <div className="amendment-header-row">
          <span className="amendment-agent">{agent_role}</span>
          {pattern_confidence && (
            <span className="amendment-confidence">
              {Math.round(pattern_confidence * 100)}% confidence
            </span>
          )}
        </div>
        <div className="amendment-type">{formatType(amendment_type)}</div>
        {trigger_pattern && (
          <div className="amendment-trigger">{trigger_pattern}</div>
        )}
      </div>

      <div className="amendment-time">{formatRelativeTime(created_at)}</div>
    </div>
  );
}

/**
 * Pattern insight card
 */
function PatternInsight({ pattern }) {
  const {
    pattern_type,
    frequency,
    agents_affected,
    recommendation,
  } = pattern;

  return (
    <div className="pattern-insight">
      <div className="pattern-type">{pattern_type}</div>
      <div className="pattern-details">
        <span>{frequency}x detected</span>
        {agents_affected && agents_affected.length > 0 && (
          <span>• {agents_affected.join(', ')}</span>
        )}
      </div>
      {recommendation && (
        <div className="pattern-recommendation">{recommendation}</div>
      )}
    </div>
  );
}

/**
 * Main Amendment Activity Log component
 */
export function AmendmentActivityLog({ limit = 20, showPatterns = true }) {
  const {
    amendments,
    patterns,
    loading,
    error,
    refresh,
  } = useAmendmentActivity(limit);

  // Count by status
  const statusCounts = amendments.reduce((acc, a) => {
    const status = a.approval_status === 'rejected'
      ? 'rejected'
      : a.evaluation_status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="amendment-log">
      <div className="amendment-log-header">
        <div className="amendment-log-title">
          <span>Amendment Activity</span>
          {amendments.length > 0 && (
            <span className="amendment-count">{amendments.length}</span>
          )}
        </div>
        <div className="amendment-log-header-right">
          <div className="status-summary">
            {statusCounts.evaluating > 0 && (
              <span className="status-badge evaluating" title="Evaluating">
                {statusCounts.evaluating} eval
              </span>
            )}
            {statusCounts.active > 0 && (
              <span className="status-badge active" title="Active">
                {statusCounts.active} active
              </span>
            )}
          </div>
          <button
            className="refresh-btn-small"
            onClick={refresh}
            title="Refresh"
            aria-label="Refresh amendments"
          >
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner-small">{error}</div>
      )}

      <div className="amendment-log-list">
        {loading && amendments.length === 0 ? (
          <div className="neural-stack-loading">Loading amendments...</div>
        ) : amendments.length === 0 ? (
          <div className="neural-stack-empty">
            <div className="neural-stack-empty-icon">📋</div>
            <div>No amendment activity yet</div>
          </div>
        ) : (
          amendments.map((amendment) => (
            <AmendmentItem
              key={amendment.id}
              amendment={amendment}
            />
          ))
        )}
      </div>

      {/* Pattern insights section */}
      {showPatterns && patterns && patterns.length > 0 && (
        <div className="patterns-section">
          <div className="patterns-header">Detected Patterns</div>
          <div className="patterns-list">
            {patterns.map((pattern, i) => (
              <PatternInsight key={i} pattern={pattern} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AmendmentActivityLog;
