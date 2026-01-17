/**
 * BAKING ACTIVITY WIDGET - Phase 5E
 * Cognalith Inc. | Monolith System
 *
 * Displays history of baked amendments and version changes.
 * Shows when proven amendments are merged into standard_knowledge.
 */

import React, { useState } from 'react';
import { useBakedAmendments } from '../../hooks/useNeuralStack.js';

/**
 * Version Hash Display - shows abbreviated hash with full on hover
 */
function VersionHash({ hash, label }) {
  if (!hash) return <span className="version-hash empty">N/A</span>;

  const short = hash.substring(0, 8);

  return (
    <span className="version-hash" title={hash}>
      {label && <span className="hash-label">{label}: </span>}
      <code>{short}...</code>
    </span>
  );
}

/**
 * Individual baked amendment item
 */
function BakedItem({ baked }) {
  const [expanded, setExpanded] = useState(false);

  const {
    agent_role,
    amendment_type,
    trigger_pattern,
    previous_version_hash,
    new_version_hash,
    baked_at,
    total_successes,
    total_evaluations,
    evaluation_history,
  } = baked;

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const successRate = total_evaluations > 0
    ? Math.round((total_successes / total_evaluations) * 100)
    : 0;

  return (
    <div className={`baked-item ${expanded ? 'expanded' : ''}`}>
      <div
        className="baked-item-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="baked-agent">{agent_role?.toUpperCase()}</div>
        <div className="baked-type">{amendment_type}</div>
        <div className="baked-time">{formatTime(baked_at)}</div>
        <div className="baked-expand-icon">{expanded ? '&#9660;' : '&#9654;'}</div>
      </div>

      <div className="baked-trigger">{trigger_pattern}</div>

      {expanded && (
        <div className="baked-details">
          <div className="baked-versions">
            <div className="version-row">
              <VersionHash hash={previous_version_hash} label="Before" />
              <span className="version-arrow">&#8594;</span>
              <VersionHash hash={new_version_hash} label="After" />
            </div>
          </div>

          <div className="baked-stats">
            <div className="stat-item">
              <span className="stat-label">Success Rate:</span>
              <span className={`stat-value ${successRate >= 60 ? 'success' : 'warning'}`}>
                {successRate}%
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Evaluations:</span>
              <span className="stat-value">{total_evaluations}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Successes:</span>
              <span className="stat-value success">{total_successes}</span>
            </div>
          </div>

          {evaluation_history && evaluation_history.length > 0 && (
            <div className="baked-eval-history">
              <div className="eval-history-label">Evaluation History:</div>
              <div className="eval-dots">
                {evaluation_history.slice(-10).map((eval_, i) => (
                  <span
                    key={i}
                    className={`eval-dot ${eval_.success ? 'success' : 'failure'}`}
                    title={eval_.task_id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Baking Stats Summary
 */
function BakingStats({ stats }) {
  if (!stats) return null;

  return (
    <div className="baking-stats">
      <div className="stat-card">
        <div className="stat-value">{stats.total_baked || 0}</div>
        <div className="stat-label">Total Baked</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.recent_week || 0}</div>
        <div className="stat-label">This Week</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{Object.keys(stats.by_agent || {}).length}</div>
        <div className="stat-label">Agents</div>
      </div>
    </div>
  );
}

/**
 * Empty state
 */
function EmptyBaked() {
  return (
    <div className="neural-stack-empty">
      <div className="neural-stack-empty-icon">&#9881;</div>
      <div>No baked amendments yet</div>
      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
        Amendments bake when an agent reaches 10 active amendments
      </div>
    </div>
  );
}

/**
 * Baking Config Info
 */
function BakingConfigInfo() {
  return (
    <div className="baking-config-info">
      <div className="config-header">Baking Criteria</div>
      <div className="config-items">
        <div className="config-item">
          <span className="config-bullet">&#8226;</span>
          <span>Agent must have 10+ active amendments</span>
        </div>
        <div className="config-item">
          <span className="config-bullet">&#8226;</span>
          <span>Amendment must be proven with 5+ successful evaluations</span>
        </div>
        <div className="config-item">
          <span className="config-bullet">&#8226;</span>
          <span>Minimum 60% success rate required</span>
        </div>
        <div className="config-item">
          <span className="config-bullet">&#8226;</span>
          <span>Oldest qualifying amendment is selected</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Baking Activity Widget
 */
export function BakingActivityWidget({ limit = 20 }) {
  const { baked, stats, loading, error, refresh } = useBakedAmendments(null, limit);

  return (
    <div className="baking-activity-widget">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">&#9881;</span>
          <span>Baking Activity</span>
        </div>
        <div className="header-right">
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

      <BakingStats stats={stats} />

      <div className="baked-list">
        {loading && baked.length === 0 ? (
          <div className="neural-stack-loading">Loading...</div>
        ) : baked.length === 0 ? (
          <EmptyBaked />
        ) : (
          baked.map((b) => (
            <BakedItem key={b.id} baked={b} />
          ))
        )}
      </div>

      <BakingConfigInfo />
    </div>
  );
}

export default BakingActivityWidget;
