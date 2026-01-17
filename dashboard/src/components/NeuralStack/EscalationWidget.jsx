/**
 * ESCALATION WIDGET - Phase 5D
 * Cognalith Inc. | Monolith System
 *
 * Displays pending Tier 2-3 escalations for CEO approval.
 * Allows Frank to approve/deny decisions with optional notes.
 */

import React, { useState } from 'react';
import { usePendingEscalations } from '../../hooks/useNeuralStack.js';

/**
 * Individual escalation item
 */
function EscalationItem({ escalation, onDecide }) {
  const [deciding, setDeciding] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  const {
    id,
    tier,
    action_type,
    vendor_name,
    estimated_cost,
    agent_role,
    context,
    created_at,
  } = escalation;

  const handleDecision = async (decision) => {
    setDeciding(true);
    try {
      await onDecide(id, decision, notes);
      setNotes('');
      setShowNotes(false);
    } catch (err) {
      console.error('Decision failed:', err);
    } finally {
      setDeciding(false);
    }
  };

  const formatCost = (cost) => {
    if (!cost) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cost);
  };

  const formatTime = (dateStr) => {
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
    <div className="escalation-item">
      <div className="escalation-tier-row">
        <span className={`escalation-tier tier-${tier}`}>
          TIER {tier}
        </span>
        <span className="escalation-time">{formatTime(created_at)}</span>
      </div>

      <div className="escalation-action">{action_type}</div>

      {vendor_name && (
        <div className="escalation-vendor">Vendor: {vendor_name}</div>
      )}

      {agent_role && (
        <div className="escalation-agent">From: {agent_role.toUpperCase()}</div>
      )}

      {context && (
        <div className="escalation-context">{context}</div>
      )}

      <div className="escalation-cost">{formatCost(estimated_cost)}</div>

      {showNotes && (
        <div className="escalation-notes-input">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes (optional)..."
            rows={2}
          />
        </div>
      )}

      <div className="escalation-buttons">
        <button
          className="escalation-btn approve"
          onClick={() => handleDecision('approved')}
          disabled={deciding}
        >
          {deciding ? '...' : 'Approve'}
        </button>
        <button
          className="escalation-btn deny"
          onClick={() => handleDecision('denied')}
          disabled={deciding}
        >
          {deciding ? '...' : 'Deny'}
        </button>
        <button
          className="escalation-btn notes-toggle"
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
 * Empty state component
 */
function EmptyEscalations() {
  return (
    <div className="neural-stack-empty">
      <div className="neural-stack-empty-icon">✓</div>
      <div>No pending escalations</div>
      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
        All decisions are up to date
      </div>
    </div>
  );
}

/**
 * Main Escalation Widget component
 */
export function EscalationWidget({ showMonthlySpend = true }) {
  const {
    escalations,
    monthlySpend,
    loading,
    error,
    refresh,
    decide,
    count,
  } = usePendingEscalations();

  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="escalation-widget">
      <div className="escalation-header">
        <div className="escalation-title">
          <span>⚠</span>
          <span>Pending Escalations</span>
        </div>
        <div className="escalation-header-right">
          {count > 0 && (
            <span className="escalation-count">{count}</span>
          )}
          <button
            className="refresh-btn-small"
            onClick={refresh}
            title="Refresh"
            aria-label="Refresh escalations"
          >
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner-small">
          {error}
        </div>
      )}

      <div className="escalation-list">
        {loading && escalations.length === 0 ? (
          <div className="neural-stack-loading">Loading...</div>
        ) : escalations.length === 0 ? (
          <EmptyEscalations />
        ) : (
          escalations.map((esc) => (
            <EscalationItem
              key={esc.id}
              escalation={esc}
              onDecide={decide}
            />
          ))
        )}
      </div>

      {showMonthlySpend && monthlySpend !== null && (
        <div className="monthly-spend">
          <div className="monthly-spend-label">Monthly Approved Spend</div>
          <div className="monthly-spend-value">
            {formatCurrency(monthlySpend)}
          </div>
        </div>
      )}
    </div>
  );
}

export default EscalationWidget;
