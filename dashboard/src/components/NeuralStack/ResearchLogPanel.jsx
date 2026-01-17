/**
 * RESEARCH LOG PANEL - Phase 6B
 * Cognalith Inc. | Monolith System
 *
 * Recent research activity showing:
 * - Table with Date, Knowledge Bot, Subordinate researched, Topics, Recommendations generated, Sources used
 * - Expandable rows to see full research details
 * - Filter by date range
 * - Filter by Knowledge Bot
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.js';

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
 * Research log row with expandable details
 */
function ResearchLogRow({ entry, isExpanded, onToggle }) {
  const {
    id,
    research_date,
    knowledge_bot,
    subordinate,
    topics,
    recommendations_count,
    sources_count,
    duration_ms,
    success,
    details,
  } = entry;

  return (
    <>
      <tr
        className={`research-log-row ${isExpanded ? 'expanded' : ''}`}
        onClick={() => onToggle(id)}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === 'Enter' && onToggle(id)}
      >
        <td className="research-log-date">
          <span className="date-full">{formatDate(research_date)}</span>
          <span className="date-relative">{formatRelativeTime(research_date)}</span>
        </td>
        <td className="research-log-bot">{knowledge_bot}</td>
        <td className="research-log-subordinate">{subordinate?.toUpperCase()}</td>
        <td className="research-log-topics">
          <div className="topics-preview">
            {topics && topics.length > 0 ? (
              <>
                <span className="topic-tag">{topics[0]}</span>
                {topics.length > 1 && (
                  <span className="topics-more">+{topics.length - 1} more</span>
                )}
              </>
            ) : (
              <span className="no-topics">No topics</span>
            )}
          </div>
        </td>
        <td className="research-log-recs">
          <span className={`rec-count ${recommendations_count > 0 ? 'has-recs' : ''}`}>
            {recommendations_count || 0}
          </span>
        </td>
        <td className="research-log-sources">{sources_count || 0}</td>
        <td className="research-log-status">
          <span className={`status-badge ${success ? 'success' : 'failed'}`}>
            {success ? 'Success' : 'Failed'}
          </span>
        </td>
        <td className="research-log-expand">
          <span className="expand-icon">{isExpanded ? '\u25BC' : '\u25B6'}</span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="research-log-details-row">
          <td colSpan={8}>
            <div className="research-details">
              <div className="details-section">
                <h5>Research Topics</h5>
                <div className="topics-list">
                  {topics && topics.length > 0 ? (
                    topics.map((topic, i) => (
                      <span key={i} className="topic-tag">{topic}</span>
                    ))
                  ) : (
                    <span className="no-data">No topics recorded</span>
                  )}
                </div>
              </div>

              {details?.sources && details.sources.length > 0 && (
                <div className="details-section">
                  <h5>Sources Used ({details.sources.length})</h5>
                  <ul className="sources-list">
                    {details.sources.map((source, i) => (
                      <li key={i}>
                        <span className="source-type">{source.type}</span>
                        <span className="source-name">{source.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {details?.recommendations && details.recommendations.length > 0 && (
                <div className="details-section">
                  <h5>Recommendations Generated ({details.recommendations.length})</h5>
                  <div className="recommendations-preview">
                    {details.recommendations.slice(0, 3).map((rec, i) => (
                      <div key={i} className="rec-preview-item">
                        <span className={`rec-type-badge type-${rec.type?.replace('_', '-')}`}>
                          {formatRecType(rec.type)}
                        </span>
                        <span className="rec-preview-text">{rec.preview}</span>
                      </div>
                    ))}
                    {details.recommendations.length > 3 && (
                      <div className="more-recs">
                        +{details.recommendations.length - 3} more recommendations
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="details-footer">
                <span className="detail-stat">
                  <span className="label">Duration:</span>
                  <span className="value">{formatDuration(duration_ms)}</span>
                </span>
                {details?.confidence && (
                  <span className="detail-stat">
                    <span className="label">Confidence:</span>
                    <span className="value">{(details.confidence * 100).toFixed(1)}%</span>
                  </span>
                )}
                {details?.error && (
                  <span className="detail-error">
                    <span className="label">Error:</span>
                    <span className="value">{details.error}</span>
                  </span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Format recommendation type
 */
function formatRecType(type) {
  if (!type) return 'Unknown';
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Format duration in ms
 */
function formatDuration(ms) {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Loading skeleton
 */
function ResearchLogSkeleton() {
  return (
    <div className="research-log-table-container">
      <table className="research-log-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Knowledge Bot</th>
            <th>Subordinate</th>
            <th>Topics</th>
            <th>Recs</th>
            <th>Sources</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i}>
              <td><div className="skeleton" style={{ width: '100px', height: '14px' }} /></td>
              <td><div className="skeleton" style={{ width: '80px', height: '14px' }} /></td>
              <td><div className="skeleton" style={{ width: '50px', height: '14px' }} /></td>
              <td><div className="skeleton" style={{ width: '120px', height: '20px' }} /></td>
              <td><div className="skeleton" style={{ width: '30px', height: '14px' }} /></td>
              <td><div className="skeleton" style={{ width: '30px', height: '14px' }} /></td>
              <td><div className="skeleton" style={{ width: '60px', height: '20px' }} /></td>
              <td><div className="skeleton" style={{ width: '16px', height: '14px' }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Main Research Log Panel component
 */
export function ResearchLogPanel({ showRefresh = true }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [knowledgeBots, setKnowledgeBots] = useState([]);

  // Filters
  const [dateRange, setDateRange] = useState('7d');
  const [botFilter, setBotFilter] = useState('all');

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ date_range: dateRange });
      if (botFilter !== 'all') params.append('bot_id', botFilter);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/research-log?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setEntries(data.entries || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Fallback mock data
      setEntries(getMockResearchLog());
    } finally {
      setLoading(false);
    }
  }, [dateRange, botFilter]);

  const fetchKnowledgeBots = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setKnowledgeBots(data.bots || []);
    } catch (err) {
      // Fallback mock data
      setKnowledgeBots([
        { bot_id: 'kb-executive', bot_name: 'Executive KB' },
        { bot_id: 'kb-operations', bot_name: 'Operations KB' },
        { bot_id: 'kb-technology', bot_name: 'Technology KB' },
        { bot_id: 'kb-finance', bot_name: 'Finance KB' },
      ]);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBots();
  }, [fetchKnowledgeBots]);

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, 60000);
    return () => clearInterval(interval);
  }, [fetchEntries]);

  const handleToggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const total = entries.length;
    const successful = entries.filter(e => e.success).length;
    const totalRecs = entries.reduce((sum, e) => sum + (e.recommendations_count || 0), 0);
    return { total, successful, totalRecs };
  }, [entries]);

  if (loading && entries.length === 0) {
    return (
      <div className="research-log-panel">
        <div className="panel-header">
          <div className="header-left">
            <span className="panel-icon">&#128209;</span>
            <span className="panel-title">Research Log</span>
          </div>
        </div>
        <ResearchLogSkeleton />
      </div>
    );
  }

  return (
    <div className="research-log-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">&#128209;</span>
          <span className="panel-title">Research Log</span>
          <div className="research-log-stats">
            <span className="log-stat">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">cycles</span>
            </span>
            <span className="log-stat">
              <span className="stat-value">{stats.successful}</span>
              <span className="stat-label">successful</span>
            </span>
            <span className="log-stat">
              <span className="stat-value">{stats.totalRecs}</span>
              <span className="stat-label">recs</span>
            </span>
          </div>
        </div>
        {showRefresh && (
          <button
            className="refresh-btn-small"
            onClick={fetchEntries}
            title="Refresh"
            aria-label="Refresh research log"
          >
            &#8635;
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <div className="research-log-filters">
        <div className="filter-group">
          <label>Date Range:</label>
          <select
            className="filter-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Knowledge Bot:</label>
          <select
            className="filter-select"
            value={botFilter}
            onChange={(e) => setBotFilter(e.target.value)}
          >
            <option value="all">All Bots</option>
            {knowledgeBots.map(bot => (
              <option key={bot.bot_id} value={bot.bot_id}>{bot.bot_name}</option>
            ))}
          </select>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="neural-stack-empty">
          <div className="neural-stack-empty-icon">&#128209;</div>
          <div>No research activity recorded</div>
          {(dateRange !== 'all' || botFilter !== 'all') && (
            <div className="empty-hint">Try adjusting your filters</div>
          )}
        </div>
      ) : (
        <div className="research-log-table-container">
          <table className="research-log-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Knowledge Bot</th>
                <th>Subordinate</th>
                <th>Topics</th>
                <th>Recs</th>
                <th>Sources</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <ResearchLogRow
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedId === entry.id}
                  onToggle={handleToggleExpand}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Mock data for development/fallback
 */
function getMockResearchLog() {
  return [
    {
      id: 'rl-1',
      research_date: new Date(Date.now() - 3600000).toISOString(),
      knowledge_bot: 'Technology KB',
      subordinate: 'devops',
      topics: ['CI/CD pipelines', 'container orchestration', 'monitoring'],
      recommendations_count: 3,
      sources_count: 8,
      duration_ms: 4500,
      success: true,
      details: {
        confidence: 0.87,
        sources: [
          { type: 'task_history', name: 'Recent deployments' },
          { type: 'amendment_log', name: 'DevOps amendments' },
          { type: 'performance_metrics', name: 'Build times' },
        ],
        recommendations: [
          { type: 'knowledge_addition', preview: 'Add understanding of blue-green deployment patterns...' },
          { type: 'skill_suggestion', preview: 'Consider capability for automated rollback...' },
          { type: 'knowledge_modification', preview: 'Update container registry selection criteria...' },
        ],
      },
    },
    {
      id: 'rl-2',
      research_date: new Date(Date.now() - 7200000).toISOString(),
      knowledge_bot: 'Executive KB',
      subordinate: 'ceo',
      topics: ['strategic planning', 'market analysis'],
      recommendations_count: 2,
      sources_count: 5,
      duration_ms: 3200,
      success: true,
      details: {
        confidence: 0.82,
        sources: [
          { type: 'task_history', name: 'Strategic decisions' },
          { type: 'external_data', name: 'Market reports' },
        ],
        recommendations: [
          { type: 'knowledge_addition', preview: 'Add framework for competitive analysis...' },
          { type: 'knowledge_modification', preview: 'Update market segmentation approach...' },
        ],
      },
    },
    {
      id: 'rl-3',
      research_date: new Date(Date.now() - 14400000).toISOString(),
      knowledge_bot: 'Finance KB',
      subordinate: 'cfo',
      topics: ['budget forecasting', 'variance analysis'],
      recommendations_count: 0,
      sources_count: 3,
      duration_ms: 8500,
      success: false,
      details: {
        confidence: 0.45,
        error: 'Insufficient historical data for pattern detection',
        sources: [
          { type: 'task_history', name: 'Budget reviews' },
        ],
        recommendations: [],
      },
    },
    {
      id: 'rl-4',
      research_date: new Date(Date.now() - 21600000).toISOString(),
      knowledge_bot: 'Operations KB',
      subordinate: 'coo',
      topics: ['process optimization', 'resource allocation', 'vendor management'],
      recommendations_count: 4,
      sources_count: 12,
      duration_ms: 6100,
      success: true,
      details: {
        confidence: 0.91,
        sources: [
          { type: 'task_history', name: 'Operations tasks' },
          { type: 'amendment_log', name: 'COO amendments' },
          { type: 'performance_metrics', name: 'Process efficiency' },
          { type: 'external_data', name: 'Industry benchmarks' },
        ],
        recommendations: [
          { type: 'knowledge_addition', preview: 'Add vendor evaluation scoring matrix...' },
          { type: 'knowledge_addition', preview: 'Add cross-department handoff protocols...' },
          { type: 'skill_suggestion', preview: 'Develop capacity planning capability...' },
          { type: 'knowledge_modification', preview: 'Update resource allocation thresholds...' },
        ],
      },
    },
    {
      id: 'rl-5',
      research_date: new Date(Date.now() - 43200000).toISOString(),
      knowledge_bot: 'Technology KB',
      subordinate: 'ciso',
      topics: ['security protocols', 'incident response', 'compliance'],
      recommendations_count: 2,
      sources_count: 7,
      duration_ms: 5400,
      success: true,
      details: {
        confidence: 0.88,
        sources: [
          { type: 'task_history', name: 'Security incidents' },
          { type: 'amendment_log', name: 'CISO amendments' },
          { type: 'external_data', name: 'CVE database' },
        ],
        recommendations: [
          { type: 'knowledge_modification', preview: 'Update incident response SLA targets...' },
          { type: 'knowledge_addition', preview: 'Add zero-trust network verification steps...' },
        ],
      },
    },
  ];
}

export default ResearchLogPanel;
