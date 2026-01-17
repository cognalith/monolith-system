/**
 * CEO DECISION QUEUE - Phase 7
 * Cognalith Inc. | Monolith System
 *
 * Shows pending decisions for Frank (CEO).
 * Features:
 * - List of decision cards with title, requesting agent, decision type, priority
 * - Agent's recommendation displayed
 * - Options as clickable buttons
 * - Text input for decision notes
 * - "Decide" button to submit
 * - Visual urgency indicator based on waiting time
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../config/api.js';

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const DECISION_TYPES = {
  approval: { label: 'Approval', icon: '\u2713', color: 'var(--neon-cyan)' },
  budget: { label: 'Budget', icon: '\u{1F4B0}', color: 'var(--neon-amber)' },
  strategy: { label: 'Strategy', icon: '\u{1F3AF}', color: '#a78bfa' },
  resource: { label: 'Resource', icon: '\u{1F465}', color: '#34d399' },
  escalation: { label: 'Escalation', icon: '\u26A0', color: 'var(--neon-crimson)' },
  policy: { label: 'Policy', icon: '\u{1F4DC}', color: '#f472b6' },
};

const PRIORITY_CONFIG = {
  critical: { label: 'CRITICAL', color: 'var(--neon-crimson)', bg: 'rgba(255, 0, 60, 0.2)' },
  high: { label: 'HIGH', color: 'var(--neon-amber)', bg: 'rgba(255, 184, 0, 0.2)' },
  medium: { label: 'MEDIUM', color: 'var(--neon-cyan)', bg: 'rgba(0, 240, 255, 0.2)' },
  low: { label: 'LOW', color: '#888', bg: 'rgba(136, 136, 136, 0.2)' },
};

const URGENCY_THRESHOLDS = {
  critical: 2 * 60 * 60 * 1000, // 2 hours
  high: 8 * 60 * 60 * 1000, // 8 hours
  medium: 24 * 60 * 60 * 1000, // 24 hours
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getUrgencyLevel(createdAt) {
  if (!createdAt) return 'low';
  const waitTime = Date.now() - new Date(createdAt).getTime();
  if (waitTime > URGENCY_THRESHOLDS.critical) return 'critical';
  if (waitTime > URGENCY_THRESHOLDS.high) return 'high';
  if (waitTime > URGENCY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

function formatWaitTime(createdAt) {
  if (!createdAt) return '--';
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
  return `${diffDays}d ${diffHours % 24}h`;
}

function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================================================
// URGENCY INDICATOR COMPONENT
// ============================================================================

function UrgencyIndicator({ createdAt }) {
  const urgency = getUrgencyLevel(createdAt);
  const config = PRIORITY_CONFIG[urgency] || PRIORITY_CONFIG.low;
  const waitTime = formatWaitTime(createdAt);

  return (
    <div
      className="urgency-indicator"
      style={{ background: config.bg, borderLeft: `3px solid ${config.color}` }}
    >
      <span className="urgency-time" style={{ color: config.color }}>
        {'\u23F1'} {waitTime}
      </span>
      {urgency === 'critical' && (
        <span className="urgency-flash" style={{ color: config.color }}>
          URGENT
        </span>
      )}
    </div>
  );
}

// ============================================================================
// DECISION CARD COMPONENT
// ============================================================================

function DecisionCard({ decision, onDecide }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    id,
    title,
    description,
    requestingAgent,
    decisionType,
    priority,
    recommendation,
    options,
    createdAt,
    context,
  } = decision;

  const typeConfig = DECISION_TYPES[decisionType] || { label: decisionType, icon: '\u2753', color: '#888' };
  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const urgency = getUrgencyLevel(createdAt);

  const handleSubmit = async () => {
    if (!selectedOption) return;
    setSubmitting(true);
    try {
      await onDecide(id, selectedOption, notes);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`decision-card urgency-${urgency}`}
      style={{
        borderTop: `3px solid ${urgency === 'critical' ? 'var(--neon-crimson)' : urgency === 'high' ? 'var(--neon-amber)' : 'rgba(0, 240, 255, 0.3)'}`,
      }}
    >
      <UrgencyIndicator createdAt={createdAt} />

      <div className="decision-header">
        <div className="decision-meta">
          <span
            className="decision-type-badge"
            style={{ color: typeConfig.color, background: `${typeConfig.color}20` }}
          >
            {typeConfig.icon} {typeConfig.label}
          </span>
          <span
            className="decision-priority-badge"
            style={{ color: priorityConfig.color, background: priorityConfig.bg }}
          >
            {priorityConfig.label}
          </span>
        </div>
        <div className="decision-agent">
          <span className="agent-label">From:</span>
          <span className="agent-name">{requestingAgent?.toUpperCase()}</span>
        </div>
      </div>

      <div className="decision-body">
        <h4 className="decision-title">{title}</h4>
        {description && (
          <p className="decision-description">{truncateText(description, 200)}</p>
        )}

        {context && (
          <div className="decision-context">
            <span className="context-label">Context:</span>
            <span className="context-text">{truncateText(context, 150)}</span>
          </div>
        )}

        {recommendation && (
          <div className="decision-recommendation">
            <span className="recommendation-label">{'\u{1F4A1}'} Agent Recommendation:</span>
            <span className="recommendation-text">{recommendation}</span>
          </div>
        )}
      </div>

      <div className="decision-options">
        <span className="options-label">Options:</span>
        <div className="options-buttons">
          {(options || ['Approve', 'Deny', 'Defer']).map((option) => (
            <button
              key={option}
              className={`option-btn ${selectedOption === option ? 'selected' : ''}`}
              onClick={() => setSelectedOption(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="decision-notes">
        <textarea
          className="notes-input"
          placeholder="Add decision notes (optional)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      <div className="decision-actions">
        <button
          className="decide-btn"
          onClick={handleSubmit}
          disabled={!selectedOption || submitting}
        >
          {submitting ? 'Submitting...' : `Decide: ${selectedOption || 'Select an option'}`}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON LOADER
// ============================================================================

function DecisionCardSkeleton() {
  return (
    <div className="decision-card skeleton-card">
      <div className="decision-header">
        <div className="skeleton" style={{ width: '100px', height: '24px' }} />
        <div className="skeleton" style={{ width: '80px', height: '20px' }} />
      </div>
      <div className="decision-body">
        <div className="skeleton" style={{ width: '80%', height: '20px', marginBottom: '0.5rem' }} />
        <div className="skeleton" style={{ width: '100%', height: '40px' }} />
      </div>
      <div className="decision-options">
        <div className="skeleton" style={{ width: '60px', height: '32px' }} />
        <div className="skeleton" style={{ width: '60px', height: '32px' }} />
        <div className="skeleton" style={{ width: '60px', height: '32px' }} />
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  return (
    <div className="decision-queue-empty">
      <span className="empty-icon">{'\u2713'}</span>
      <span className="empty-title">No Pending Decisions</span>
      <span className="empty-subtitle">All decisions have been resolved</span>
    </div>
  );
}

// ============================================================================
// STATS SUMMARY
// ============================================================================

function StatsSummary({ decisions }) {
  const stats = decisions.reduce(
    (acc, d) => {
      const urgency = getUrgencyLevel(d.createdAt);
      acc[urgency] = (acc[urgency] || 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  return (
    <div className="decision-stats">
      {stats.critical > 0 && (
        <span className="stat-badge critical">{stats.critical} URGENT</span>
      )}
      {stats.high > 0 && (
        <span className="stat-badge high">{stats.high} HIGH</span>
      )}
      <span className="stat-total">{decisions.length} total</span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CEODecisionQueue({ refreshInterval = 15000 }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orchestration/ceo-decisions`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      // Sort by urgency (oldest first, within priority)
      const sorted = (data.decisions || []).sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return aTime - bTime;
      });
      setDecisions(sorted);
      setError(null);
    } catch (err) {
      setError(err.message);
      setDecisions(getMockDecisionData());
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDecide = useCallback(async (decisionId, choice, notes) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orchestration/ceo-decisions/${decisionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice, notes }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Remove the decided item from the list
      setDecisions((prev) => prev.filter((d) => d.id !== decisionId));
    } catch (err) {
      console.error('Failed to submit decision:', err);
      // Still remove from UI for demo purposes
      setDecisions((prev) => prev.filter((d) => d.id !== decisionId));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  if (loading && decisions.length === 0) {
    return (
      <div className="ceo-decision-queue">
        <div className="panel-header">
          <div className="header-left">
            <span className="panel-icon">{'\u{1F451}'}</span>
            <span className="panel-title">CEO Decision Queue</span>
          </div>
        </div>
        <div className="decision-list">
          {[1, 2, 3].map((i) => (
            <DecisionCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ceo-decision-queue">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">{'\u{1F451}'}</span>
          <span className="panel-title">CEO Decision Queue</span>
        </div>
        <div className="header-right">
          <StatsSummary decisions={decisions} />
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

      <div className="decision-list">
        {decisions.length === 0 ? (
          <EmptyState />
        ) : (
          decisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              onDecide={handleDecide}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockDecisionData() {
  return [
    {
      id: 'dec-1',
      title: 'Production Deployment Approval',
      description: 'Request to deploy v2.5.0 to production. All tests passing, security audit complete.',
      requestingAgent: 'devops',
      decisionType: 'approval',
      priority: 'critical',
      recommendation: 'Approve deployment - all criteria met, staging verified for 48 hours',
      options: ['Approve', 'Deny', 'Delay 24h'],
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      context: 'Contains critical security patches and customer-requested features',
    },
    {
      id: 'dec-2',
      title: 'Q2 Marketing Budget Increase',
      description: 'CMO requests additional $50,000 for digital advertising campaign targeting new market segment.',
      requestingAgent: 'cmo',
      decisionType: 'budget',
      priority: 'high',
      recommendation: 'Approve with conditions - tie to measurable ROI targets',
      options: ['Approve Full', 'Approve 50%', 'Deny', 'Request More Info'],
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      context: 'Projected ROI: 3.2x based on similar Q1 campaigns',
    },
    {
      id: 'dec-3',
      title: 'New Vendor Partnership',
      description: 'Proposal to partner with CloudScale for infrastructure services. 2-year contract, $120,000/year.',
      requestingAgent: 'cto',
      decisionType: 'strategy',
      priority: 'medium',
      recommendation: 'Approve - competitive pricing, excellent reliability track record',
      options: ['Approve', 'Negotiate Terms', 'Explore Alternatives', 'Deny'],
      createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
      context: 'Current vendor costs 40% more, 3 outages in past quarter',
    },
    {
      id: 'dec-4',
      title: 'Remote Work Policy Update',
      description: 'HR proposes updating remote work policy to allow 4 days/week remote for all eligible employees.',
      requestingAgent: 'hr_manager',
      decisionType: 'policy',
      priority: 'low',
      recommendation: 'Approve trial period - 3 months with productivity metrics review',
      options: ['Approve Permanent', 'Approve Trial', 'Modify to 3 Days', 'Deny'],
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

export default CEODecisionQueue;
