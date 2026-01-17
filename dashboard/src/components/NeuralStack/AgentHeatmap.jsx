/**
 * AGENT HEATMAP - Phase 5D
 * Cognalith Inc. | Monolith System
 *
 * Cross-agent comparison matrix showing key metrics.
 * Color-coded cells indicate performance levels.
 */

import React, { useMemo } from 'react';
import { useHeatmapData } from '../../hooks/useNeuralStack.js';

const METRIC_CONFIG = {
  variance: {
    label: 'Variance %',
    format: (v) => `${v?.toFixed(1)}%`,
    thresholds: { good: 10, medium: 20 }, // lower is better
    invert: true,
  },
  cos_score: {
    label: 'CoS Score',
    format: (v) => v?.toFixed(2),
    thresholds: { good: 0.85, medium: 0.7 }, // higher is better
    invert: false,
  },
  success_rate: {
    label: 'Success %',
    format: (v) => `${v}%`,
    thresholds: { good: 85, medium: 70 }, // higher is better
    invert: false,
  },
  avg_time_min: {
    label: 'Avg Time',
    format: (v) => `${v}m`,
    thresholds: { good: 15, medium: 30 }, // lower is better
    invert: true,
  },
  amendments: {
    label: 'Amendments',
    format: (v) => v?.toString(),
    thresholds: { good: 1, medium: 3 }, // lower is better (fewer needed)
    invert: true,
  },
  tasks: {
    label: 'Tasks',
    format: (v) => v?.toString(),
    thresholds: { good: 20, medium: 10 }, // higher is better
    invert: false,
  },
};

/**
 * Get cell class based on value and thresholds
 */
function getCellClass(value, config) {
  if (value === null || value === undefined) return '';

  const { thresholds, invert } = config;

  if (invert) {
    // Lower is better
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.medium) return 'medium';
    return 'bad';
  } else {
    // Higher is better
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.medium) return 'medium';
    return 'bad';
  }
}

/**
 * Heatmap cell component
 */
function HeatmapCell({ value, metricKey }) {
  const config = METRIC_CONFIG[metricKey];
  if (!config) return <td>-</td>;

  const cellClass = getCellClass(value, config);
  const displayValue = config.format(value);

  return (
    <td>
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
  const rows = 8;
  const cols = 6;

  return (
    <table className="heatmap-table">
      <thead>
        <tr>
          <th>Agent</th>
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
              <div className="skeleton" style={{ width: '50px', height: '14px' }} />
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
 * Main Agent Heatmap component
 */
export function AgentHeatmap({ metrics = ['variance', 'cos_score', 'success_rate', 'avg_time_min', 'amendments'] }) {
  const { data, loading, error, refresh } = useHeatmapData();

  // Sort agents by name
  const sortedAgents = useMemo(() => {
    if (!data?.agents) return [];
    return [...data.agents].sort((a, b) => a.agent.localeCompare(b.agent));
  }, [data]);

  // Calculate averages for comparison
  const averages = useMemo(() => {
    if (!sortedAgents.length) return {};

    return metrics.reduce((acc, metric) => {
      const values = sortedAgents.map(a => a[metric]).filter(v => v !== null && v !== undefined);
      acc[metric] = values.length > 0
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : null;
      return acc;
    }, {});
  }, [sortedAgents, metrics]);

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <h3 className="heatmap-title">Cross-Agent Performance</h3>
        <button
          className="refresh-btn-small"
          onClick={refresh}
          title="Refresh"
          aria-label="Refresh heatmap"
        >
          ↻
        </button>
      </div>

      {error && (
        <div className="error-banner-small">{error}</div>
      )}

      {loading && !data ? (
        <HeatmapSkeleton />
      ) : !sortedAgents.length ? (
        <div className="neural-stack-empty">
          <div>No heatmap data available</div>
        </div>
      ) : (
        <>
          <table className="heatmap-table">
            <thead>
              <tr>
                <th>Agent</th>
                {metrics.map(metric => (
                  <th key={metric}>{METRIC_CONFIG[metric]?.label || metric}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAgents.map(agent => (
                <tr key={agent.agent}>
                  <td className="heatmap-agent">{agent.agent}</td>
                  {metrics.map(metric => (
                    <HeatmapCell
                      key={metric}
                      value={agent[metric]}
                      metricKey={metric}
                    />
                  ))}
                </tr>
              ))}
              {/* Averages row */}
              <tr className="heatmap-averages-row">
                <td className="heatmap-agent">AVG</td>
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
          </div>
        </>
      )}
    </div>
  );
}

export default AgentHeatmap;
