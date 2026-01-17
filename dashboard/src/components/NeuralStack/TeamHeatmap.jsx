/**
 * TEAM HEATMAP - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Cross-team comparison grid:
 * - Grid showing all teams
 * - Color-coded by health metrics
 * - Click cells to drill down
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.js';

const METRIC_CONFIG = {
  health_score: {
    label: 'Health %',
    format: (v) => `${v?.toFixed(0)}%`,
    thresholds: { good: 80, medium: 60 },
    invert: false,
  },
  success_rate: {
    label: 'Success %',
    format: (v) => `${v?.toFixed(0)}%`,
    thresholds: { good: 85, medium: 70 },
    invert: false,
  },
  avg_cos_score: {
    label: 'CoS Score',
    format: (v) => v?.toFixed(2),
    thresholds: { good: 0.85, medium: 0.7 },
    invert: false,
  },
  subordinate_count: {
    label: 'Members',
    format: (v) => v?.toString(),
    thresholds: { good: 1, medium: 1 },
    invert: false,
    noColor: true,
  },
  active_amendments: {
    label: 'Amendments',
    format: (v) => v?.toString(),
    thresholds: { good: 2, medium: 4 },
    invert: true,
  },
  pending_reviews: {
    label: 'Pending',
    format: (v) => v?.toString(),
    thresholds: { good: 2, medium: 5 },
    invert: true,
  },
  escalations: {
    label: 'Escalations',
    format: (v) => v?.toString(),
    thresholds: { good: 1, medium: 3 },
    invert: true,
  },
};

/**
 * Get cell class based on value and thresholds
 */
function getCellClass(value, config) {
  if (value === null || value === undefined) return '';
  if (config.noColor) return '';

  const { thresholds, invert } = config;

  if (invert) {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.medium) return 'medium';
    return 'bad';
  } else {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.medium) return 'medium';
    return 'bad';
  }
}

/**
 * Heatmap cell component
 */
function HeatmapCell({ value, metricKey, onClick }) {
  const config = METRIC_CONFIG[metricKey];
  if (!config) return <td>-</td>;

  const cellClass = getCellClass(value, config);
  const displayValue = config.format(value);

  return (
    <td onClick={onClick} className={onClick ? 'clickable' : ''}>
      <span className={`heatmap-cell ${cellClass}`}>
        {displayValue}
      </span>
    </td>
  );
}

/**
 * Loading skeleton
 */
function HeatmapSkeleton() {
  const rows = 4;
  const cols = 6;

  return (
    <table className="heatmap-table team-heatmap-table">
      <thead>
        <tr>
          <th>Team</th>
          {[...Array(cols)].map((_, i) => (
            <th key={i}>
              <div className="skeleton" style={{ width: '60px', height: '12px', margin: '0 auto' }} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...Array(rows)].map((_, rowIdx) => (
          <tr key={rowIdx}>
            <td className="heatmap-agent">
              <div className="skeleton" style={{ width: '80px', height: '14px' }} />
            </td>
            {[...Array(cols)].map((_, colIdx) => (
              <td key={colIdx}>
                <div className="skeleton" style={{ width: '40px', height: '20px', margin: '0 auto' }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Main Team Heatmap component
 */
export function TeamHeatmap({
  metrics = ['health_score', 'success_rate', 'avg_cos_score', 'subordinate_count', 'active_amendments', 'escalations'],
  onTeamSelect
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHeatmap = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams/heatmap`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
      setData(getMockHeatmapData());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  // Sort teams by health score
  const sortedTeams = useMemo(() => {
    if (!data?.teams) return [];
    return [...data.teams].sort((a, b) => b.health_score - a.health_score);
  }, [data]);

  // Calculate averages for comparison
  const averages = useMemo(() => {
    if (!sortedTeams.length) return {};

    return metrics.reduce((acc, metric) => {
      const values = sortedTeams.map(t => t[metric]).filter(v => v !== null && v !== undefined);
      acc[metric] = values.length > 0
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : null;
      return acc;
    }, {});
  }, [sortedTeams, metrics]);

  const handleCellClick = (team) => {
    if (onTeamSelect) {
      onTeamSelect(team);
    }
  };

  return (
    <div className="heatmap-container team-heatmap-container">
      <div className="heatmap-header">
        <h3 className="heatmap-title">Cross-Team Performance</h3>
        <button
          className="refresh-btn-small"
          onClick={fetchHeatmap}
          title="Refresh"
          aria-label="Refresh heatmap"
        >
          &#8635;
        </button>
      </div>

      {error && (
        <div className="error-banner-small">{error}</div>
      )}

      {loading && !data ? (
        <HeatmapSkeleton />
      ) : !sortedTeams.length ? (
        <div className="neural-stack-empty">
          <div>No team heatmap data available</div>
        </div>
      ) : (
        <>
          <table className="heatmap-table team-heatmap-table">
            <thead>
              <tr>
                <th>Team</th>
                {metrics.map(metric => (
                  <th key={metric}>{METRIC_CONFIG[metric]?.label || metric}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map(team => (
                <tr
                  key={team.team_id}
                  className="team-row"
                  onClick={() => handleCellClick(team)}
                >
                  <td className="heatmap-agent team-name-cell">
                    <div className="team-name-wrapper">
                      <span className="team-name">{team.team_name}</span>
                      <span className="team-lead-hint">Lead: {team.team_lead?.toUpperCase()}</span>
                    </div>
                  </td>
                  {metrics.map(metric => (
                    <HeatmapCell
                      key={metric}
                      value={team[metric]}
                      metricKey={metric}
                    />
                  ))}
                </tr>
              ))}
              {/* Averages row */}
              <tr className="heatmap-averages-row">
                <td className="heatmap-agent">AVERAGE</td>
                {metrics.map(metric => (
                  <td key={metric}>
                    <span className="heatmap-cell average">
                      {METRIC_CONFIG[metric]?.format(averages[metric]) || '-'}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* Legend */}
          <div className="heatmap-legend">
            <div className="legend-item">
              <span className="heatmap-cell good" style={{ padding: '2px 8px' }}>Good</span>
            </div>
            <div className="legend-item">
              <span className="heatmap-cell medium" style={{ padding: '2px 8px' }}>Attention</span>
            </div>
            <div className="legend-item">
              <span className="heatmap-cell bad" style={{ padding: '2px 8px' }}>Poor</span>
            </div>
            {onTeamSelect && (
              <div className="legend-item legend-hint">
                Click row to drill down
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Mock data for development/fallback
 */
function getMockHeatmapData() {
  return {
    teams: [
      {
        team_id: 'executive',
        team_name: 'Executive Team',
        team_lead: 'ceo',
        health_score: 92,
        success_rate: 94,
        avg_cos_score: 0.91,
        subordinate_count: 4,
        active_amendments: 1,
        pending_reviews: 2,
        escalations: 0,
      },
      {
        team_id: 'technology',
        team_name: 'Technology Team',
        team_lead: 'cto',
        health_score: 85,
        success_rate: 88,
        avg_cos_score: 0.84,
        subordinate_count: 4,
        active_amendments: 2,
        pending_reviews: 3,
        escalations: 1,
      },
      {
        team_id: 'operations',
        team_name: 'Operations Team',
        team_lead: 'coo',
        health_score: 78,
        success_rate: 82,
        avg_cos_score: 0.77,
        subordinate_count: 3,
        active_amendments: 4,
        pending_reviews: 5,
        escalations: 2,
      },
      {
        team_id: 'finance',
        team_name: 'Finance Team',
        team_lead: 'cfo',
        health_score: 55,
        success_rate: 68,
        avg_cos_score: 0.62,
        subordinate_count: 2,
        active_amendments: 6,
        pending_reviews: 8,
        escalations: 4,
      },
    ],
    metrics: ['health_score', 'success_rate', 'avg_cos_score', 'subordinate_count', 'active_amendments', 'escalations'],
  };
}

export default TeamHeatmap;
