/**
 * COS HEALTH INDICATOR - Phase 5E
 * Cognalith Inc. | Monolith System
 *
 * Displays CoS success rate and alert status.
 * Shows rolling 20-amendment window with hardcoded 50% threshold.
 */

import React, { useState } from 'react';
import { useCoSHealth } from '../../hooks/useNeuralStack.js';

/**
 * Health Gauge - circular progress indicator
 */
function HealthGauge({ rate, threshold }) {
  const isHealthy = rate >= threshold;
  const color = isHealthy ? '#4ade80' : '#ef4444';
  const circumference = 2 * Math.PI * 35;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <div className="cos-health-gauge">
      <svg viewBox="0 0 100 100" className="gauge-svg">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="35"
          stroke="#333"
          strokeWidth="10"
          fill="none"
        />
        {/* Threshold marker */}
        <circle
          cx="50"
          cy="50"
          r="35"
          stroke="#ef4444"
          strokeWidth="10"
          fill="none"
          strokeDasharray={`${(threshold / 100) * circumference} ${circumference}`}
          strokeDashoffset={circumference * 0.25}
          transform="rotate(-90 50 50)"
          opacity="0.3"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="35"
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
        {/* Center text */}
        <text
          x="50"
          y="45"
          textAnchor="middle"
          fill="white"
          fontSize="20"
          fontWeight="bold"
        >
          {rate}%
        </text>
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fill="#888"
          fontSize="10"
        >
          success
        </text>
      </svg>
    </div>
  );
}

/**
 * Alert Banner
 */
function AlertBanner({ alert, onAcknowledge }) {
  const [acknowledging, setAcknowledging] = useState(false);
  const [notes, setNotes] = useState('');

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      await onAcknowledge(alert.id, notes);
      setNotes('');
    } catch (err) {
      console.error('Acknowledge failed:', err);
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className="cos-alert-banner">
      <div className="alert-icon">&#9888;</div>
      <div className="alert-content">
        <div className="alert-title">CoS Health Alert</div>
        <div className="alert-message">
          {alert.reason || 'Success rate below threshold'}
        </div>
        <div className="alert-metrics">
          Success Rate: {alert.current_success_rate || 0}%
        </div>
      </div>
      <div className="alert-actions">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes..."
          className="alert-notes-input"
        />
        <button
          className="alert-acknowledge-btn"
          onClick={handleAcknowledge}
          disabled={acknowledging}
        >
          {acknowledging ? '...' : 'Acknowledge'}
        </button>
      </div>
    </div>
  );
}

/**
 * Trend Mini Chart
 */
function TrendChart({ trend }) {
  if (!trend || trend.length === 0) {
    return (
      <div className="cos-trend-empty">
        No trend data available
      </div>
    );
  }

  const maxRate = Math.max(...trend.map(t => t.success_rate), 100);
  const chartHeight = 60;
  const chartWidth = 200;
  const barWidth = chartWidth / trend.length - 4;

  return (
    <div className="cos-trend-chart">
      <div className="trend-label">Success Rate Trend</div>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="trend-svg">
        {/* Threshold line */}
        <line
          x1="0"
          y1={chartHeight - (50 / maxRate) * chartHeight}
          x2={chartWidth}
          y2={chartHeight - (50 / maxRate) * chartHeight}
          stroke="#ef4444"
          strokeDasharray="4 2"
          opacity="0.5"
        />
        {/* Bars */}
        {trend.map((t, i) => {
          const barHeight = (t.success_rate / maxRate) * chartHeight;
          const x = i * (barWidth + 4) + 2;
          const y = chartHeight - barHeight;
          const color = t.success_rate >= 50 ? '#4ade80' : '#ef4444';

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={color}
              rx="2"
            />
          );
        })}
      </svg>
      <div className="trend-legend">
        <span>Older</span>
        <span>Recent</span>
      </div>
    </div>
  );
}

/**
 * Hardcoded Constraints Display
 */
function ConstraintsInfo({ constraints }) {
  if (!constraints) return null;

  return (
    <div className="cos-constraints">
      <div className="constraints-header">Hardcoded Constraints</div>
      <div className="constraints-list">
        <div className="constraint-item">
          <span className="constraint-label">Alert Threshold:</span>
          <span className="constraint-value">{constraints.alert_threshold}</span>
        </div>
        <div className="constraint-item">
          <span className="constraint-label">Window Size:</span>
          <span className="constraint-value">{constraints.window_size} amendments</span>
        </div>
        <div className="constraint-item">
          <span className="constraint-label">Min for Alert:</span>
          <span className="constraint-value">{constraints.min_for_alert} amendments</span>
        </div>
      </div>
      <div className="constraints-note">{constraints.note}</div>
    </div>
  );
}

/**
 * Main CoS Health Indicator component
 */
export function CoSHealthIndicator() {
  const {
    health,
    loading,
    error,
    refresh,
    acknowledgeAlert,
    alertTriggered,
  } = useCoSHealth();

  if (loading && !health) {
    return (
      <div className="cos-health-indicator">
        <div className="panel-header">
          <span className="panel-icon">&#9829;</span>
          <span>CoS Health</span>
        </div>
        <div className="neural-stack-loading">Loading...</div>
      </div>
    );
  }

  const current = health?.current || { success_rate: 100, sample_size: 0 };
  const threshold = health?.alert?.threshold || 50;
  const isHealthy = current.success_rate >= threshold;

  return (
    <div className={`cos-health-indicator ${alertTriggered ? 'alert-active' : ''}`}>
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">&#9829;</span>
          <span>CoS Health</span>
        </div>
        <div className="header-right">
          <span className={`health-status ${isHealthy ? 'healthy' : 'warning'}`}>
            {isHealthy ? 'HEALTHY' : 'WARNING'}
          </span>
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

      {/* Active Alerts */}
      {health?.active_alerts?.map((alert) => (
        <AlertBanner
          key={alert.id}
          alert={alert}
          onAcknowledge={acknowledgeAlert}
        />
      ))}

      <div className="cos-health-content">
        <div className="health-main">
          <HealthGauge rate={current.success_rate} threshold={threshold} />

          <div className="health-stats">
            <div className="stat-row">
              <span className="stat-label">Sample Size:</span>
              <span className="stat-value">{current.sample_size}/20</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Successes:</span>
              <span className="stat-value success">{current.successes}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Failures:</span>
              <span className="stat-value failure">{current.failures}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Threshold:</span>
              <span className="stat-value">{threshold}%</span>
            </div>
          </div>
        </div>

        <TrendChart trend={health?.trend} />

        <ConstraintsInfo constraints={health?.hardcoded_constraints} />
      </div>
    </div>
  );
}

export default CoSHealthIndicator;
