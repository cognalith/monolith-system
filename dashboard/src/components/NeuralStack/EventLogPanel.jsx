/**
 * EVENT LOG PANEL - Phase 11
 * Cognalith Inc. | Monolith System
 *
 * Unified event log for troubleshooting and debugging agent execution.
 * Shows real-time events from:
 * - Tasks (queued, active, completed, failed)
 * - Conversations (LLM interactions)
 * - State changes (task lifecycle)
 * - Audits (task grading)
 *
 * Features:
 * - Unified timeline view
 * - Filter by agent, event type, time range
 * - Expandable event details
 * - Agent memory summary
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.js';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Get event type icon
 */
function getEventIcon(type) {
  const icons = {
    task: '📋',           // clipboard
    conversation: '💬',   // speech bubble
    state_change: '🔄',   // cycle arrows
    audit: '🔍',          // magnifying glass
    artifact: '📦',       // package
  };
  return icons[type] || '❔'; // question mark
}

/**
 * Get status color class
 */
function getStatusColor(status) {
  const colors = {
    completed: 'status-success',
    active: 'status-active',
    queued: 'status-pending',
    pending: 'status-pending',
    blocked: 'status-warning',
    failed: 'status-error',
    escalated: 'status-warning',
  };
  return colors[status?.toLowerCase()] || 'status-default';
}

/**
 * Get priority color class
 */
function getPriorityColor(priority) {
  const colors = {
    CRITICAL: 'priority-critical',
    HIGH: 'priority-high',
    MEDIUM: 'priority-medium',
    LOW: 'priority-low',
  };
  return colors[priority] || 'priority-default';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Event card component
 */
function EventCard({ event, isExpanded, onToggle }) {
  const {
    id,
    type,
    subtype,
    agent_role,
    agent_name,
    task_id,
    title,
    status,
    priority,
    timestamp,
    time_ago,
    token_count,
    message_preview,
    change_type,
    old_value,
    new_value,
    overall_score,
    drift_detected,
    metadata,
  } = event;

  return (
    <div
      className={`event-card event-type-${type} ${isExpanded ? 'expanded' : ''}`}
      onClick={() => onToggle(id)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onToggle(id)}
    >
      <div className="event-card-header">
        <div className="event-icon">{getEventIcon(type)}</div>
        <div className="event-type-badge">{type.replace('_', ' ')}</div>
        <div className="event-time">
          <span className="time-relative">{time_ago || formatRelativeTime(timestamp)}</span>
          <span className="time-absolute">{formatDate(timestamp)}</span>
        </div>
        <div className="event-expand-icon">{isExpanded ? '\u25BC' : '\u25B6'}</div>
      </div>

      <div className="event-card-body">
        {/* Task Events */}
        {type === 'task' && (
          <>
            <div className="event-main-content">
              <span className="event-title">{title || task_id}</span>
              {priority && (
                <span className={`event-priority ${getPriorityColor(priority)}`}>
                  {priority}
                </span>
              )}
            </div>
            <div className="event-meta">
              {agent_role && (
                <span className="event-agent">
                  <span className="label">Agent:</span>
                  <span className="value">{agent_role?.toUpperCase()}</span>
                </span>
              )}
              {status && (
                <span className={`event-status ${getStatusColor(status)}`}>
                  {status}
                </span>
              )}
            </div>
          </>
        )}

        {/* Conversation Events */}
        {type === 'conversation' && (
          <>
            <div className="event-main-content">
              <span className="event-agent-name">{agent_name || agent_role?.toUpperCase()}</span>
              {token_count > 0 && (
                <span className="event-tokens">{token_count.toLocaleString()} tokens</span>
              )}
            </div>
            {message_preview && (
              <div className="event-preview">{message_preview}</div>
            )}
            {task_id && (
              <div className="event-meta">
                <span className="event-task-link">
                  <span className="label">Task:</span>
                  <span className="value">{task_id}</span>
                </span>
              </div>
            )}
          </>
        )}

        {/* State Change Events */}
        {type === 'state_change' && (
          <>
            <div className="event-main-content">
              <span className="change-type">{change_type?.replace('_', ' ')}</span>
              <span className="change-arrow">
                <span className={`old-value ${getStatusColor(old_value)}`}>{old_value}</span>
                <span className="arrow">\u2192</span>
                <span className={`new-value ${getStatusColor(new_value)}`}>{new_value}</span>
              </span>
            </div>
            <div className="event-meta">
              {agent_role && (
                <span className="event-agent">
                  <span className="label">By:</span>
                  <span className="value">{agent_role}</span>
                </span>
              )}
              {task_id && (
                <span className="event-task-link">
                  <span className="label">Task:</span>
                  <span className="value">{task_id}</span>
                </span>
              )}
            </div>
          </>
        )}

        {/* Audit Events */}
        {type === 'audit' && (
          <>
            <div className="event-main-content">
              <span className="event-agent-name">{agent_name || agent_role?.toUpperCase()}</span>
              {overall_score !== null && overall_score !== undefined && (
                <span className={`audit-score ${overall_score >= 80 ? 'score-high' : overall_score >= 60 ? 'score-medium' : 'score-low'}`}>
                  Score: {overall_score}%
                </span>
              )}
              {drift_detected && (
                <span className="drift-indicator">DRIFT DETECTED</span>
              )}
            </div>
            {task_id && (
              <div className="event-meta">
                <span className="event-task-link">
                  <span className="label">Task:</span>
                  <span className="value">{task_id}</span>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="event-card-details">
          {/* Task details */}
          {type === 'task' && metadata && (
            <div className="details-section">
              <h5>Task Timeline</h5>
              <div className="details-grid">
                {metadata.started_at && (
                  <div className="detail-item">
                    <span className="label">Started:</span>
                    <span className="value">{formatDate(metadata.started_at)}</span>
                  </div>
                )}
                {metadata.completed_at && (
                  <div className="detail-item">
                    <span className="label">Completed:</span>
                    <span className="value">{formatDate(metadata.completed_at)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conversation details */}
          {type === 'conversation' && metadata && (
            <div className="details-section">
              <h5>Conversation Info</h5>
              <div className="details-grid">
                <div className="detail-item">
                  <span className="label">Messages:</span>
                  <span className="value">{metadata.message_count || 0}</span>
                </div>
                {event.conversation_id && (
                  <div className="detail-item">
                    <span className="label">ID:</span>
                    <span className="value mono">{event.conversation_id.substring(0, 8)}...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audit details */}
          {type === 'audit' && metadata && (
            <div className="details-section">
              <h5>Audit Scores</h5>
              <div className="audit-scores-grid">
                {metadata.accuracy !== null && metadata.accuracy !== undefined && (
                  <div className="score-item">
                    <span className="score-label">Accuracy</span>
                    <span className="score-value">{metadata.accuracy}%</span>
                  </div>
                )}
                {metadata.completeness !== null && metadata.completeness !== undefined && (
                  <div className="score-item">
                    <span className="score-label">Completeness</span>
                    <span className="score-value">{metadata.completeness}%</span>
                  </div>
                )}
                {metadata.quality !== null && metadata.quality !== undefined && (
                  <div className="score-item">
                    <span className="score-label">Quality</span>
                    <span className="score-value">{metadata.quality}%</span>
                  </div>
                )}
                {metadata.efficiency !== null && metadata.efficiency !== undefined && (
                  <div className="score-item">
                    <span className="score-label">Efficiency</span>
                    <span className="score-value">{metadata.efficiency}%</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* State change details */}
          {type === 'state_change' && metadata && Object.keys(metadata).length > 0 && (
            <div className="details-section">
              <h5>Additional Info</h5>
              <pre className="metadata-json">{JSON.stringify(metadata, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Agent memory summary card
 */
function AgentMemorySummary({ agent, onSelect }) {
  const {
    role,
    name,
    conversations,
    tokens,
    active_tokens,
    needs_compression,
  } = agent;

  return (
    <div
      className={`memory-summary-card ${needs_compression ? 'needs-compression' : ''}`}
      onClick={() => onSelect(role)}
      role="button"
      tabIndex={0}
    >
      <div className="memory-agent-name">{role?.toUpperCase()}</div>
      <div className="memory-stats">
        <div className="memory-stat">
          <span className="stat-value">{conversations}</span>
          <span className="stat-label">convos</span>
        </div>
        <div className="memory-stat">
          <span className="stat-value">{(tokens / 1000).toFixed(1)}k</span>
          <span className="stat-label">tokens</span>
        </div>
      </div>
      {needs_compression && (
        <div className="compression-warning">Needs compression</div>
      )}
    </div>
  );
}

/**
 * Loading skeleton
 */
function EventLogSkeleton() {
  return (
    <div className="event-log-skeleton">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-header" style={{ width: '100%', height: '24px' }} />
          <div className="skeleton skeleton-body" style={{ width: '80%', height: '40px', marginTop: '8px' }} />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Main Event Log Panel component
 */
export function EventLogPanel({ showRefresh = true }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [agentFilter, setAgentFilter] = useState('all');
  const [typeFilters, setTypeFilters] = useState(['task', 'conversation', 'state_change', 'audit']);
  const [hoursFilter, setHoursFilter] = useState(24);

  // Memory view
  const [showMemory, setShowMemory] = useState(false);
  const [memoryStats, setMemoryStats] = useState(null);

  // Available agents for filter
  const agents = useMemo(() => [
    'ceo', 'cfo', 'cto', 'coo', 'cmo', 'chro', 'ciso', 'clo', 'cos',
    'cco', 'cpo', 'cro', 'devops', 'data', 'qa', 'swe'
  ], []);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        hours: hoursFilter.toString(),
        type: typeFilters.join(','),
        limit: '100',
      });
      if (agentFilter !== 'all') {
        params.append('agent', agentFilter);
      }

      const response = await fetch(`${API_BASE_URL}/api/event-log?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setEvents(data.events || []);
      setError(null);
    } catch (err) {
      console.error('[EVENT-LOG] Fetch error:', err);
      setError(err.message);
      // Set empty array on error - real data only
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [agentFilter, typeFilters, hoursFilter]);

  const fetchMemoryStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/event-log/compression-status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMemoryStats(data);
    } catch (err) {
      console.error('[EVENT-LOG] Memory stats error:', err);
      setMemoryStats(null);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchEvents]);

  useEffect(() => {
    if (showMemory) {
      fetchMemoryStats();
    }
  }, [showMemory, fetchMemoryStats]);

  const handleToggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleTypeToggle = (type) => {
    setTypeFilters(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleAgentSelect = (agent) => {
    setAgentFilter(agent);
    setShowMemory(false);
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const byType = {};
    const byAgent = {};
    events.forEach(e => {
      byType[e.type] = (byType[e.type] || 0) + 1;
      if (e.agent_role) {
        byAgent[e.agent_role] = (byAgent[e.agent_role] || 0) + 1;
      }
    });
    return { total: events.length, byType, byAgent };
  }, [events]);

  if (loading && events.length === 0) {
    return (
      <div className="event-log-panel">
        <div className="panel-header">
          <div className="header-left">
            <span className="panel-icon">📜</span>
            <span className="panel-title">Event Log</span>
          </div>
        </div>
        <EventLogSkeleton />
      </div>
    );
  }

  return (
    <div className="event-log-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">📜</span>
          <span className="panel-title">Event Log</span>
          <div className="event-log-stats">
            <span className="log-stat">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">events</span>
            </span>
            {stats.byType.task > 0 && (
              <span className="log-stat type-task">
                <span className="stat-value">{stats.byType.task}</span>
                <span className="stat-label">tasks</span>
              </span>
            )}
            {stats.byType.conversation > 0 && (
              <span className="log-stat type-conversation">
                <span className="stat-value">{stats.byType.conversation}</span>
                <span className="stat-label">convos</span>
              </span>
            )}
          </div>
        </div>
        <div className="header-right">
          <button
            className={`memory-toggle-btn ${showMemory ? 'active' : ''}`}
            onClick={() => setShowMemory(!showMemory)}
            title="Show agent memory"
          >
            🧠
          </button>
          {showRefresh && (
            <button
              className="refresh-btn-small"
              onClick={fetchEvents}
              title="Refresh"
              aria-label="Refresh event log"
            >
              &#8635;
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner-small">
          Unable to fetch events: {error}
        </div>
      )}

      {/* Memory Summary View */}
      {showMemory && memoryStats && (
        <div className="memory-summary-section">
          <h4>Agent Memory Status</h4>
          <div className="memory-summary-grid">
            {memoryStats.by_agent?.map(agent => (
              <AgentMemorySummary
                key={agent.role}
                agent={agent}
                onSelect={handleAgentSelect}
              />
            ))}
          </div>
          {memoryStats.agents_needing_compression?.length > 0 && (
            <div className="compression-alert">
              <span className="alert-icon">\u26A0</span>
              {memoryStats.agents_needing_compression.length} agent(s) need memory compression
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="event-log-filters">
        <div className="filter-group">
          <label>Agent:</label>
          <select
            className="filter-select"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <option value="all">All Agents</option>
            {agents.map(a => (
              <option key={a} value={a}>{a.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Time:</label>
          <select
            className="filter-select"
            value={hoursFilter}
            onChange={(e) => setHoursFilter(parseInt(e.target.value))}
          >
            <option value={1}>Last Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last 7 Days</option>
          </select>
        </div>

        <div className="filter-group type-filters">
          <label>Types:</label>
          <div className="type-checkboxes">
            {['task', 'conversation', 'state_change', 'audit'].map(type => (
              <label key={type} className={`type-checkbox ${typeFilters.includes(type) ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={typeFilters.includes(type)}
                  onChange={() => handleTypeToggle(type)}
                />
                <span className="type-label">{getEventIcon(type)} {type.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <div className="neural-stack-empty">
          <div className="neural-stack-empty-icon">📜</div>
          <div>No events recorded</div>
          <div className="empty-hint">
            Events will appear here as agents execute tasks.
            {(agentFilter !== 'all' || typeFilters.length < 4 || hoursFilter < 24) && (
              <> Try adjusting your filters.</>
            )}
          </div>
        </div>
      ) : (
        <div className="event-log-list">
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              isExpanded={expandedId === event.id}
              onToggle={handleToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default EventLogPanel;
