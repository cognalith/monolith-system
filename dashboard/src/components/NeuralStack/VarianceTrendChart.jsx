/**
 * VARIANCE TREND CHART - Phase 5D
 * Cognalith Inc. | Monolith System
 *
 * SVG-based line chart showing variance trends over time.
 * Includes trend line (linear regression) and amendment markers.
 */

import React, { useMemo, useState } from 'react';
import { useVarianceTrend } from '../../hooks/useNeuralStack.js';

// Chart dimensions
const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const PADDING = { top: 20, right: 20, bottom: 30, left: 50 };
const PLOT_WIDTH = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING.top - PADDING.bottom;

/**
 * Calculate linear regression for trend line
 */
function calculateTrendLine(points) {
  if (!points || points.length < 2) return null;

  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  points.forEach((p, i) => {
    sumX += i;
    sumY += p.variance_percent;
    sumXY += i * p.variance_percent;
    sumX2 += i * i;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Tooltip component
 */
function Tooltip({ point, x, y }) {
  if (!point) return null;

  const date = new Date(point.completed_at).toLocaleDateString();

  return (
    <g transform={`translate(${x}, ${y - 40})`}>
      <rect
        x={-60}
        y={-30}
        width={120}
        height={55}
        fill="rgba(10, 10, 15, 0.95)"
        stroke="rgba(0, 255, 136, 0.3)"
        strokeWidth={1}
        rx={4}
      />
      <text x={0} y={-12} textAnchor="middle" fill="#00ff88" fontSize="10">
        {date}
      </text>
      <text x={0} y={2} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
        {point.variance_percent?.toFixed(1)}% variance
      </text>
      <text x={0} y={16} textAnchor="middle" fill="#888" fontSize="10">
        CoS: {point.cos_score?.toFixed(2)}
      </text>
    </g>
  );
}

/**
 * Main Variance Trend Chart component
 */
export function VarianceTrendChart({ agentRole, title }) {
  const { data, loading, error, refresh } = useVarianceTrend(agentRole);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  // Process chart data
  const chartData = useMemo(() => {
    if (!data?.tasks || data.tasks.length === 0) return null;

    const tasks = data.tasks;
    const maxVariance = Math.max(...tasks.map(t => t.variance_percent), 30);
    const minVariance = 0;
    const yRange = maxVariance - minVariance;

    // Scale functions
    const scaleX = (index) => PADDING.left + (index / (tasks.length - 1)) * PLOT_WIDTH;
    const scaleY = (value) => PADDING.top + PLOT_HEIGHT - ((value - minVariance) / yRange) * PLOT_HEIGHT;

    // Generate path for data line
    const linePath = tasks.map((t, i) => {
      const x = scaleX(i);
      const y = scaleY(t.variance_percent);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');

    // Generate trend line
    const trendLine = calculateTrendLine(tasks);
    let trendPath = null;
    if (trendLine) {
      const startY = trendLine.intercept;
      const endY = trendLine.slope * (tasks.length - 1) + trendLine.intercept;
      trendPath = `M ${scaleX(0)} ${scaleY(startY)} L ${scaleX(tasks.length - 1)} ${scaleY(endY)}`;
    }

    // Determine trend direction
    let trendDirection = 'stable';
    if (trendLine) {
      if (trendLine.slope < -0.5) trendDirection = 'improving';
      else if (trendLine.slope > 0.5) trendDirection = 'declining';
    }

    // Grid lines
    const gridLines = [0, 10, 20, 30].filter(v => v <= maxVariance).map(value => ({
      y: scaleY(value),
      label: `${value}%`,
    }));

    // Data points
    const points = tasks.map((t, i) => ({
      x: scaleX(i),
      y: scaleY(t.variance_percent),
      data: t,
      isFailure: !t.success,
    }));

    // Amendment markers
    const amendments = data.amendments || [];
    const amendmentMarkers = amendments.map(a => {
      // Find closest task
      const taskIndex = tasks.findIndex(t =>
        new Date(t.completed_at) >= new Date(a.created_at)
      );
      if (taskIndex === -1) return null;
      return {
        x: scaleX(taskIndex),
        y: PADDING.top + 5,
        data: a,
      };
    }).filter(Boolean);

    return {
      linePath,
      trendPath,
      trendDirection,
      gridLines,
      points,
      amendmentMarkers,
      maxVariance,
    };
  }, [data]);

  // Trend badge text
  const getTrendText = (direction) => {
    switch (direction) {
      case 'improving': return '↓ Improving';
      case 'declining': return '↑ Declining';
      default: return '→ Stable';
    }
  };

  if (!agentRole) {
    return (
      <div className="variance-chart-container">
        <div className="neural-stack-empty">
          <div>Select an agent to view variance trends</div>
        </div>
      </div>
    );
  }

  return (
    <div className="variance-chart-container">
      <div className="variance-chart-header">
        <div className="variance-chart-title">
          {title || `Variance Trend: ${agentRole.toUpperCase()}`}
        </div>
        <div className="variance-chart-header-right">
          {chartData && (
            <span className={`variance-chart-trend ${chartData.trendDirection}`}>
              {getTrendText(chartData.trendDirection)}
            </span>
          )}
          <button
            className="refresh-btn-small"
            onClick={refresh}
            title="Refresh"
            aria-label="Refresh variance data"
          >
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner-small">{error}</div>
      )}

      {loading && !chartData ? (
        <div className="neural-stack-loading" style={{ height: CHART_HEIGHT }}>
          Loading chart data...
        </div>
      ) : !chartData ? (
        <div className="neural-stack-empty" style={{ height: CHART_HEIGHT }}>
          <div>No variance data available</div>
        </div>
      ) : (
        <svg
          className="variance-chart-svg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          {chartData.gridLines.map((line, i) => (
            <g key={i}>
              <line
                className="chart-grid-line"
                x1={PADDING.left}
                y1={line.y}
                x2={CHART_WIDTH - PADDING.right}
                y2={line.y}
              />
              <text
                className="chart-axis-label"
                x={PADDING.left - 8}
                y={line.y + 3}
                textAnchor="end"
              >
                {line.label}
              </text>
            </g>
          ))}

          {/* Trend line (behind data line) */}
          {chartData.trendPath && (
            <path
              className="chart-trend-line"
              d={chartData.trendPath}
            />
          )}

          {/* Data line */}
          <path
            className="chart-data-line"
            d={chartData.linePath}
          />

          {/* Data points */}
          {chartData.points.map((point, i) => (
            <circle
              key={i}
              className={`chart-data-point ${point.isFailure ? 'failure' : ''}`}
              cx={point.x}
              cy={point.y}
              r={4}
              onMouseEnter={() => {
                setHoveredPoint(point.data);
                setHoverPosition({ x: point.x, y: point.y });
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* Amendment markers */}
          {chartData.amendmentMarkers.map((marker, i) => (
            <g key={`amendment-${i}`}>
              <polygon
                className="chart-amendment-marker"
                points={`${marker.x},${marker.y} ${marker.x - 5},${marker.y + 10} ${marker.x + 5},${marker.y + 10}`}
              />
            </g>
          ))}

          {/* Tooltip */}
          {hoveredPoint && (
            <Tooltip
              point={hoveredPoint}
              x={hoverPosition.x}
              y={hoverPosition.y}
            />
          )}

          {/* X-axis label */}
          <text
            className="chart-axis-label"
            x={CHART_WIDTH / 2}
            y={CHART_HEIGHT - 5}
            textAnchor="middle"
          >
            Recent Tasks →
          </text>
        </svg>
      )}

      {/* Legend */}
      <div className="variance-chart-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#00ff88' }} />
          <span>Variance %</span>
        </div>
        <div className="legend-item">
          <span className="legend-line" style={{ borderColor: 'rgba(255, 170, 0, 0.6)', borderStyle: 'dashed' }} />
          <span>Trend</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: '#ff4444' }} />
          <span>Failed Task</span>
        </div>
        <div className="legend-item">
          <span className="legend-triangle" />
          <span>Amendment</span>
        </div>
      </div>
    </div>
  );
}

export default VarianceTrendChart;
