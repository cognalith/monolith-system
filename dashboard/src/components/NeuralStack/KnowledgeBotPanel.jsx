/**
 * KNOWLEDGE BOT PANEL - Phase 6B
 * Cognalith Inc. | Monolith System
 *
 * Overview of all Knowledge Bots showing:
 * - Bot name and team
 * - Last research cycle timestamp
 * - Recommendations generated (total)
 * - Success rate percentage
 * - Confidence trend (improving/stable/declining with arrow icons)
 * - Click to see bot detail
 * - "Trigger Research" button per bot
 * - Auto-refresh every 60 seconds
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../config/api.js';

const CONFIDENCE_TREND_CONFIG = {
  improving: { icon: '\u2191', label: 'Improving', className: 'trend-improving' },
  stable: { icon: '\u2192', label: 'Stable', className: 'trend-stable' },
  declining: { icon: '\u2193', label: 'Declining', className: 'trend-declining' },
};

/**
 * Format relative time
 */
function formatRelativeTime(dateString) {
  if (!dateString) return 'Never';
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
 * Individual Knowledge Bot card component
 */
function KnowledgeBotCard({ bot, onSelect, onTriggerResearch }) {
  const {
    bot_id,
    bot_name,
    team_name,
    team_lead,
    last_research_at,
    total_recommendations,
    success_rate,
    confidence_trend,
    is_active,
    subordinates_count,
  } = bot;

  const trendConfig = CONFIDENCE_TREND_CONFIG[confidence_trend] || CONFIDENCE_TREND_CONFIG.stable;

  const handleTriggerClick = (e) => {
    e.stopPropagation();
    onTriggerResearch && onTriggerResearch(bot);
  };

  return (
    <div
      className={`knowledge-bot-card ${is_active ? 'active' : 'inactive'}`}
      onClick={() => onSelect && onSelect(bot)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onSelect && onSelect(bot)}
    >
      <div className="kb-card-header">
        <div className="kb-info">
          <span className="kb-name">{bot_name}</span>
          <span className="kb-team">{team_name} ({team_lead?.toUpperCase()})</span>
        </div>
        <div className={`kb-status-badge ${is_active ? 'active' : 'inactive'}`}>
          {is_active ? 'Active' : 'Inactive'}
        </div>
      </div>

      <div className="kb-metrics">
        <div className="kb-metric">
          <span className="kb-metric-label">Last Research</span>
          <span className="kb-metric-value">{formatRelativeTime(last_research_at)}</span>
        </div>

        <div className="kb-metric">
          <span className="kb-metric-label">Recommendations</span>
          <span className="kb-metric-value">{total_recommendations || 0}</span>
        </div>

        <div className="kb-metric">
          <span className="kb-metric-label">Success Rate</span>
          <span className={`kb-metric-value ${success_rate >= 80 ? 'positive' : success_rate >= 60 ? 'warning' : 'negative'}`}>
            {success_rate || 0}%
          </span>
        </div>

        <div className="kb-metric">
          <span className="kb-metric-label">Confidence Trend</span>
          <span className={`kb-metric-value ${trendConfig.className}`}>
            {trendConfig.icon} {trendConfig.label}
          </span>
        </div>

        <div className="kb-metric">
          <span className="kb-metric-label">Subordinates</span>
          <span className="kb-metric-value">{subordinates_count || 0}</span>
        </div>
      </div>

      <div className="kb-card-footer">
        <button
          className="kb-trigger-btn"
          onClick={handleTriggerClick}
          title="Trigger a new research cycle"
        >
          Trigger Research
        </button>
        <span className="kb-detail-hint">Click for details</span>
      </div>
    </div>
  );
}

/**
 * Knowledge Bot card skeleton loader
 */
function KnowledgeBotCardSkeleton() {
  return (
    <div className="knowledge-bot-card">
      <div className="kb-card-header">
        <div className="kb-info">
          <div className="skeleton" style={{ width: '120px', height: '16px', marginBottom: '4px' }} />
          <div className="skeleton" style={{ width: '80px', height: '12px' }} />
        </div>
        <div className="skeleton" style={{ width: '50px', height: '20px', borderRadius: '4px' }} />
      </div>
      <div className="kb-metrics">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="kb-metric">
            <div className="skeleton" style={{ width: '70px', height: '10px', marginBottom: '4px' }} />
            <div className="skeleton" style={{ width: '50px', height: '14px' }} />
          </div>
        ))}
      </div>
      <div className="kb-card-footer">
        <div className="skeleton" style={{ width: '100px', height: '28px', borderRadius: '4px' }} />
      </div>
    </div>
  );
}

/**
 * Knowledge Bot detail modal/panel
 */
function KnowledgeBotDetail({ bot, onClose }) {
  if (!bot) return null;

  const trendConfig = CONFIDENCE_TREND_CONFIG[bot.confidence_trend] || CONFIDENCE_TREND_CONFIG.stable;

  return (
    <div className="kb-detail-panel">
      <div className="kb-detail-header">
        <div className="kb-detail-title">
          <span className="kb-detail-name">{bot.bot_name}</span>
          <span className={`kb-status-badge ${bot.is_active ? 'active' : 'inactive'}`}>
            {bot.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <button className="kb-detail-close" onClick={onClose} title="Close">
          &times;
        </button>
      </div>

      <div className="kb-detail-content">
        <div className="kb-detail-section">
          <h4>Team Information</h4>
          <div className="kb-detail-grid">
            <div className="kb-detail-item">
              <span className="label">Team</span>
              <span className="value">{bot.team_name}</span>
            </div>
            <div className="kb-detail-item">
              <span className="label">Team Lead</span>
              <span className="value">{bot.team_lead?.toUpperCase()}</span>
            </div>
            <div className="kb-detail-item">
              <span className="label">Subordinates</span>
              <span className="value">{bot.subordinates_count || 0}</span>
            </div>
          </div>
        </div>

        <div className="kb-detail-section">
          <h4>Research Statistics</h4>
          <div className="kb-detail-grid">
            <div className="kb-detail-item">
              <span className="label">Total Research Cycles</span>
              <span className="value">{bot.total_research_cycles || 0}</span>
            </div>
            <div className="kb-detail-item">
              <span className="label">Total Recommendations</span>
              <span className="value">{bot.total_recommendations || 0}</span>
            </div>
            <div className="kb-detail-item">
              <span className="label">Applied Recommendations</span>
              <span className="value">{bot.applied_recommendations || 0}</span>
            </div>
            <div className="kb-detail-item">
              <span className="label">Success Rate</span>
              <span className={`value ${bot.success_rate >= 80 ? 'positive' : bot.success_rate >= 60 ? 'warning' : 'negative'}`}>
                {bot.success_rate || 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="kb-detail-section">
          <h4>Confidence Metrics</h4>
          <div className="kb-detail-grid">
            <div className="kb-detail-item">
              <span className="label">Current Confidence</span>
              <span className="value">{(bot.current_confidence * 100)?.toFixed(1) || 0}%</span>
            </div>
            <div className="kb-detail-item">
              <span className="label">Trend</span>
              <span className={`value ${trendConfig.className}`}>
                {trendConfig.icon} {trendConfig.label}
              </span>
            </div>
            <div className="kb-detail-item">
              <span className="label">Last Research</span>
              <span className="value">{formatRelativeTime(bot.last_research_at)}</span>
            </div>
          </div>
        </div>

        {bot.recent_topics && bot.recent_topics.length > 0 && (
          <div className="kb-detail-section">
            <h4>Recent Research Topics</h4>
            <div className="kb-topics-list">
              {bot.recent_topics.map((topic, i) => (
                <span key={i} className="kb-topic-tag">{topic}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main Knowledge Bot Panel component
 */
export function KnowledgeBotPanel({ onBotSelect, showRefresh = true }) {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBot, setSelectedBot] = useState(null);
  const [triggeringBot, setTriggeringBot] = useState(null);

  const fetchBots = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setBots(data.bots || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Fallback mock data
      setBots(getMockKnowledgeBots());
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerResearch = useCallback(async (bot) => {
    try {
      setTriggeringBot(bot.bot_id);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/knowledge-bots/${bot.bot_id}/trigger-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Refresh after triggering
      await fetchBots();
    } catch (err) {
      console.error('Failed to trigger research:', err);
    } finally {
      setTriggeringBot(null);
    }
  }, [fetchBots]);

  useEffect(() => {
    fetchBots();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchBots, 60000);
    return () => clearInterval(interval);
  }, [fetchBots]);

  const handleBotSelect = (bot) => {
    setSelectedBot(bot);
    onBotSelect && onBotSelect(bot);
  };

  const handleCloseDetail = () => {
    setSelectedBot(null);
  };

  // Calculate summary stats
  const activeCount = bots.filter(b => b.is_active).length;
  const avgSuccessRate = bots.length > 0
    ? Math.round(bots.reduce((sum, b) => sum + (b.success_rate || 0), 0) / bots.length)
    : 0;
  const totalRecommendations = bots.reduce((sum, b) => sum + (b.total_recommendations || 0), 0);

  if (loading && bots.length === 0) {
    return (
      <div className="knowledge-bot-panel">
        <div className="panel-header">
          <div className="header-left">
            <span className="panel-icon">&#129302;</span>
            <span className="panel-title">Knowledge Bots</span>
          </div>
        </div>
        <div className="kb-grid">
          {[...Array(4)].map((_, i) => (
            <KnowledgeBotCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="knowledge-bot-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">&#129302;</span>
          <span className="panel-title">Knowledge Bots</span>
          <div className="kb-summary">
            <span className="kb-summary-stat">
              <span className="stat-value">{activeCount}</span>
              <span className="stat-label">Active</span>
            </span>
            <span className="kb-summary-stat">
              <span className="stat-value">{avgSuccessRate}%</span>
              <span className="stat-label">Avg Success</span>
            </span>
            <span className="kb-summary-stat">
              <span className="stat-value">{totalRecommendations}</span>
              <span className="stat-label">Recommendations</span>
            </span>
          </div>
        </div>
        {showRefresh && (
          <button
            className="refresh-btn-small"
            onClick={fetchBots}
            title="Refresh"
            aria-label="Refresh knowledge bots"
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

      <div className="kb-grid">
        {bots.map((bot) => (
          <KnowledgeBotCard
            key={bot.bot_id}
            bot={bot}
            onSelect={handleBotSelect}
            onTriggerResearch={triggerResearch}
          />
        ))}
      </div>

      {bots.length === 0 && !loading && (
        <div className="neural-stack-empty">
          <div className="neural-stack-empty-icon">&#129302;</div>
          <div>No Knowledge Bots configured</div>
        </div>
      )}

      {/* Bot Detail Panel */}
      {selectedBot && (
        <KnowledgeBotDetail bot={selectedBot} onClose={handleCloseDetail} />
      )}
    </div>
  );
}

/**
 * Mock data for development/fallback
 */
function getMockKnowledgeBots() {
  return [
    {
      bot_id: 'kb-executive',
      bot_name: 'Executive Knowledge Bot',
      team_name: 'Executive Team',
      team_lead: 'ceo',
      last_research_at: new Date(Date.now() - 3600000).toISOString(),
      total_recommendations: 45,
      applied_recommendations: 38,
      success_rate: 84,
      confidence_trend: 'improving',
      is_active: true,
      subordinates_count: 4,
      total_research_cycles: 12,
      current_confidence: 0.87,
      recent_topics: ['strategic planning', 'market analysis', 'risk assessment'],
    },
    {
      bot_id: 'kb-operations',
      bot_name: 'Operations Knowledge Bot',
      team_name: 'Operations Team',
      team_lead: 'coo',
      last_research_at: new Date(Date.now() - 7200000).toISOString(),
      total_recommendations: 62,
      applied_recommendations: 48,
      success_rate: 77,
      confidence_trend: 'stable',
      is_active: true,
      subordinates_count: 3,
      total_research_cycles: 18,
      current_confidence: 0.79,
      recent_topics: ['process optimization', 'resource allocation', 'workflow improvements'],
    },
    {
      bot_id: 'kb-technology',
      bot_name: 'Technology Knowledge Bot',
      team_name: 'Technology Team',
      team_lead: 'cto',
      last_research_at: new Date(Date.now() - 1800000).toISOString(),
      total_recommendations: 89,
      applied_recommendations: 76,
      success_rate: 85,
      confidence_trend: 'improving',
      is_active: true,
      subordinates_count: 4,
      total_research_cycles: 24,
      current_confidence: 0.88,
      recent_topics: ['architecture patterns', 'security practices', 'code quality'],
    },
    {
      bot_id: 'kb-finance',
      bot_name: 'Finance Knowledge Bot',
      team_name: 'Finance Team',
      team_lead: 'cfo',
      last_research_at: new Date(Date.now() - 86400000).toISOString(),
      total_recommendations: 28,
      applied_recommendations: 15,
      success_rate: 54,
      confidence_trend: 'declining',
      is_active: false,
      subordinates_count: 2,
      total_research_cycles: 8,
      current_confidence: 0.62,
      recent_topics: ['budget analysis', 'cost optimization', 'financial reporting'],
    },
  ];
}

export default KnowledgeBotPanel;
