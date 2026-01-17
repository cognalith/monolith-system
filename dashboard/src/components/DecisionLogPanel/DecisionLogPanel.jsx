/**
 * DecisionLogPanel Component
 * Displays a modal panel showing decision history with context, role, and timestamps.
 */
import { useState, useEffect, useCallback } from 'react';
import { getAbbrFromId } from '../../config/roleHierarchy';

// Decision type colors - Cyber-noir palette
const DECISION_TYPE_COLORS = {
  approval: '#00f0ff',   // neon-cyan
  rejection: '#ff003c',  // neon-crimson
  delegation: '#ffb800', // neon-amber
  escalation: '#ff6b6b',
  deferral: '#666666',
};

// Decision type labels
const DECISION_TYPES = {
  approval: 'Approved',
  rejection: 'Rejected',
  delegation: 'Delegated',
  escalation: 'Escalated',
  deferral: 'Deferred',
};

// Mock data for development (until backend API is ready)
const MOCK_DECISIONS = [
  {
    id: 'dec-001',
    type: 'approval',
    subject: 'Q4 Budget Allocation',
    context: 'Approved $2.5M budget for Q4 marketing initiatives',
    decision_maker_role: 'ceo',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    workflow_name: 'Q4 Budget Approval',
    impact: 'high',
  },
  {
    id: 'dec-002',
    type: 'approval',
    subject: 'Security Policy Update',
    context: 'Approved new password policy requiring 2FA for all users',
    decision_maker_role: 'ciso',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Security Audit 2026',
    impact: 'high',
  },
  {
    id: 'dec-003',
    type: 'delegation',
    subject: 'Vendor Contract Review',
    context: 'Delegated contract review to Legal for compliance check',
    decision_maker_role: 'chief-procurement-officer',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Vendor Management',
    impact: 'medium',
  },
  {
    id: 'dec-004',
    type: 'rejection',
    subject: 'Early Product Launch',
    context: 'Rejected request to launch product ahead of schedule due to QA concerns',
    decision_maker_role: 'cto',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Product Launch Sprint',
    impact: 'high',
  },
  {
    id: 'dec-005',
    type: 'approval',
    subject: 'New Hire Salary Band',
    context: 'Approved senior engineer offer at Band 4',
    decision_maker_role: 'chro',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'New Hire Onboarding',
    impact: 'low',
  },
  {
    id: 'dec-006',
    type: 'escalation',
    subject: 'Data Breach Investigation',
    context: 'Escalated potential data breach to executive team for immediate review',
    decision_maker_role: 'chief-data-officer',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Incident Response',
    impact: 'critical',
  },
  {
    id: 'dec-007',
    type: 'deferral',
    subject: 'Office Expansion',
    context: 'Deferred decision on new office location to Q2',
    decision_maker_role: 'coo',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Facilities Planning',
    impact: 'medium',
  },
  {
    id: 'dec-008',
    type: 'approval',
    subject: 'Marketing Campaign Launch',
    context: 'Approved "Spring Forward" campaign with $500K budget',
    decision_maker_role: 'cmo',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Q1 Marketing',
    impact: 'medium',
  },
];

// Impact colors - Cyber-noir palette
const IMPACT_COLORS = {
  critical: '#ff003c',   // neon-crimson
  high: '#ffb800',       // neon-amber
  medium: '#00f0ff',     // neon-cyan
  low: '#666666',
};

const DecisionLogPanel = ({ isOpen, onClose, selectedRole = null }) => {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState(null);
  const [sortBy, setSortBy] = useState('time'); // 'time', 'impact', 'type'

  // Fetch decisions
  const fetchDecisions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/decisions');
      if (!response.ok) throw new Error('Failed to fetch decisions');
      const data = await response.json();
      setDecisions(data.decisions || []);
      setError(null);
    } catch (err) {
      console.warn('API failed, using mock data:', err.message);
      // Use mock data as fallback
      setDecisions(MOCK_DECISIONS);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (isOpen) {
      fetchDecisions();
      const interval = setInterval(fetchDecisions, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchDecisions]);

  // Impact order for sorting
  const IMPACT_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

  // Filter and sort decisions
  const getFilteredDecisions = () => {
    let filtered = decisions;

    // Filter by selected role if provided
    if (selectedRole) {
      filtered = filtered.filter((dec) => dec.decision_maker_role === selectedRole);
    }

    // Filter by type
    if (filterType) {
      filtered = filtered.filter((dec) => dec.type === filterType);
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'impact':
          return IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact];
        case 'type':
          return a.type.localeCompare(b.type);
        case 'time':
        default:
          return new Date(b.timestamp) - new Date(a.timestamp);
      }
    });
  };

  // Format timestamp
  const formatTimestamp = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get type counts
  const getTypeCounts = () => {
    const counts = {};
    decisions.forEach((dec) => {
      counts[dec.type] = (counts[dec.type] || 0) + 1;
    });
    return counts;
  };

  const filteredDecisions = getFilteredDecisions();
  const typeCounts = getTypeCounts();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[80vh] flex flex-col bg-[rgba(0,5,10,0.6)] backdrop-blur-xl border border-[rgba(0,240,255,0.4)] rounded-lg shadow-[0_0_30px_rgba(0,240,255,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-neon-cyan">
              DECISION LOG ({filteredDecisions.length})
            </h2>
            <div className="flex gap-4 mt-2 text-sm">
              {Object.entries(typeCounts).map(([type, count]) => (
                <span key={type} style={{ color: DECISION_TYPE_COLORS[type] }}>
                  {DECISION_TYPES[type]}: {count}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-black/30 text-gray-300 border border-white/10 rounded px-2 py-1 text-sm font-code"
            >
              <option value="time">Sort: Recent</option>
              <option value="impact">Sort: Impact</option>
              <option value="type">Sort: Type</option>
            </select>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
            >
              x
            </button>
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 p-4 border-b border-white/10 flex-wrap">
          <button
            onClick={() => setFilterType(null)}
            className={`px-3 py-1 rounded text-sm font-code ${
              !filterType
                ? 'bg-[var(--neon-cyan)] text-black'
                : 'bg-black/30 text-gray-300 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {Object.keys(DECISION_TYPES).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded text-sm capitalize font-code ${
                filterType === type
                  ? 'bg-[var(--neon-cyan)] text-black'
                  : 'bg-black/30 text-gray-300 hover:bg-white/10'
              }`}
              style={{
                borderLeft: `3px solid ${DECISION_TYPE_COLORS[type]}`,
              }}
            >
              {DECISION_TYPES[type]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--neon-cyan)]"></div>
              <span className="ml-3 text-gray-400">Loading decisions...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <span className="text-[var(--neon-crimson)] text-2xl">!</span>
              <p className="text-gray-400 mt-2">{error}</p>
              <button
                onClick={fetchDecisions}
                className="mt-4 px-4 py-2 bg-[var(--neon-cyan)] text-black rounded hover:opacity-80 cyber-button"
              >
                Retry
              </button>
            </div>
          ) : filteredDecisions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No decisions recorded{selectedRole ? ` by ${getAbbrFromId(selectedRole)}` : ''}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDecisions.map((decision) => (
                <div
                  key={decision.id}
                  className="bg-black/30 border border-white/10 rounded-lg p-4 hover:border-[var(--neon-cyan)]/50 transition-colors"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: DECISION_TYPE_COLORS[decision.type],
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                          style={{
                            backgroundColor: DECISION_TYPE_COLORS[decision.type] + '20',
                            color: DECISION_TYPE_COLORS[decision.type],
                          }}
                        >
                          {DECISION_TYPES[decision.type]}
                        </span>
                        <h3 className="text-lg font-medium text-gray-100">
                          {decision.subject}
                        </h3>
                        <span
                          className="px-2 py-0.5 rounded text-xs uppercase"
                          style={{
                            backgroundColor: IMPACT_COLORS[decision.impact] + '15',
                            color: IMPACT_COLORS[decision.impact],
                          }}
                        >
                          {decision.impact}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-2">{decision.context}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm font-code">
                        <span className="text-neon-amber font-medium">
                          {getAbbrFromId(decision.decision_maker_role)}
                        </span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400">
                          {decision.workflow_name || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-gray-300 font-medium">
                        {formatTimestamp(decision.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 text-sm text-gray-500 font-code">
          <span>Auto-refresh: 30s</span>
          <button
            onClick={fetchDecisions}
            className="text-neon-cyan hover:text-[var(--neon-cyan)]/80"
          >
            Refresh Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default DecisionLogPanel;
