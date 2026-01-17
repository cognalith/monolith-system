/**
 * EXCEPTION QUEUE WIDGET - Phase 5E
 * Cognalith Inc. | Monolith System
 *
 * Displays pending exception escalations requiring CEO action.
 * Exception types: Skills/Persona mods, consecutive failures, cross-agent patterns.
 */

import React, { useState } from 'react';
import { useExceptionEscalations } from '../../hooks/useNeuralStack.js';

/**
 * Reason Badge - displays escalation reason with appropriate styling
 */
function ReasonBadge({ reason }) {
  const reasonConfig = {
    skills_layer_mod: { label: 'SKILLS', color: '#f97316' },
    persona_layer_mod: { label: 'PERSONA', color: '#ef4444' },
    consecutive_failures: { label: 'FAILURES', color: '#eab308' },
    cross_agent_pattern: { label: 'CROSS-AGENT', color: '#8b5cf6' },
  };

  const config = reasonConfig[reason] || { label: reason?.toUpperCase() || 'UNKNOWN', color: '#6b7280' };

  return (
    <span
      className="exception-reason-badge"
      style={{ backgroundColor: config.color }}
    >
      {config.label}
    </span>
  );
}

/**
 * Individual exception item
 */
function ExceptionItem({ exception, onResolve }) {
  const [resolving, setResolving] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const { id, reason, analysis, created_at, amendment } = exception;

  const handleResolve = async (resolution) => {
    setResolving(true);
    try {
      await onResolve(id, resolution, notes);
      setNotes('');
      setShowNotes(false);
    } catch (err) {
      console.error('Resolution failed:', err);
    } finally {
      setResolving(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="exception-item">
      <div className="exception-header-row">
        <ReasonBadge reason={reason} />
        <span className="exception-time">{formatTime(created_at)}</span>
      </div>

      {amendment && (
        <div className="exception-amendment">
          <div className="amendment-agent">{amendment.agent_role?.toUpperCase()}</div>
          <div className="amendment-type">{amendment.amendment_type}</div>
          <div className="amendment-trigger">{amendment.trigger_pattern}</div>
          {amendment.instruction_delta && (
            <div className="amendment-instruction">
              {amendment.instruction_delta.length > 100
                ? `${amendment.instruction_delta.substring(0, 100)}...`
                : amendment.instruction_delta}
            </div>
          )}
        </div>
      )}

      {analysis && (
        <div className="exception-analysis">
          {typeof analysis === 'object' ? JSON.stringify(analysis) : analysis}
        </div>
      )}

      {showNotes && (
        <div className="exception-notes-input">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add resolution notes (optional)..."
            rows={2}
          />
        </div>
      )}

      <div className="exception-buttons">
        <button
          className="exception-btn approve"
          onClick={() => handleResolve('approved')}
          disabled={resolving}
        >
          {resolving ? '...' : 'Approve'}
        </button>
        <button
          className="exception-btn reject"
          onClick={() => handleResolve('rejected')}
          disabled={resolving}
        >
          {resolving ? '...' : 'Reject'}
        </button>
        <button
          className="exception-btn notes-toggle"
          onClick={() => setShowNotes(!showNotes)}
          title="Add notes"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Empty state
 */
function EmptyExceptions() {
  return (
    <div className="neural-stack-empty">
      <div className="neural-stack-empty-icon">&#10003;</div>
      <div>No pending exceptions</div>
      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
        CoS is operating autonomously
      </div>
    </div>
  );
}

/**
 * Main Exception Queue Widget
 */
export function ExceptionQueueWidget() {
  const {
    escalations,
    loading,
    error,
    refresh,
    resolve,
    count,
  } = useExceptionEscalations();

  return (
    <div className="exception-queue-widget">
      <div className="exception-queue-header">
        <div className="header-left">
          <span className="header-icon">&#9888;</span>
          <span>Exception Queue</span>
        </div>
        <div className="header-right">
          {count > 0 && (
            <span className="exception-count">{count}</span>
          )}
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

      <div className="exception-list">
        {loading && escalations.length === 0 ? (
          <div className="neural-stack-loading">Loading...</div>
        ) : escalations.length === 0 ? (
          <EmptyExceptions />
        ) : (
          escalations.map((exc) => (
            <ExceptionItem
              key={exc.id}
              exception={exc}
              onResolve={resolve}
            />
          ))
        )}
      </div>

      <div className="exception-queue-footer">
        <span className="footer-note">
          Exceptions require CEO approval before processing
        </span>
      </div>
    </div>
  );
}

export default ExceptionQueueWidget;
