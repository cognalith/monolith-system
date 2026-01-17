/**
 * TEAM LEAD ACTIVITY LOG - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Table showing Team Lead activities:
 * - Recent reviews by Team Lead
 * - Amendments generated
 * - Escalations to CoS
 * - Filter by date range
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.js';

const ACTIVITY_TYPES = {
  REVIEW: { label: 'Review', color: 'var(--neon-cyan)' },
  AMENDMENT: { label: 'Amendment', color: 'var(--neon-amber)' },
  ESCALATION: { label: 'Escalation', color: 'var(--neon-crimson)' },
};

const DATE_RANGES = {
  '24h': { label: 'Last 24 Hours', hours: 24 },
  '7d': { label: 'Last 7 Days', hours: 168 },
  '30d': { label: 'Last 30 Days', hours: 720 },
  'all': { label: 'All Time', hours: null },
};

/**
 * Activity row component
 */
function ActivityRow({ activity }) {
  const typeConfig = ACTIVITY_TYPES[activity.activity_type] || ACTIVITY_TYPES.REVIEW;

  return (
    <tr className="activity-row">
      <td className="activity-time">
        {formatDateTime(activity.created_at)}
      </td>
      <td className="activity-lead">
        {activity.team_lead?.toUpperCase()}
      </td>
      <td className="activity-type">
        <span
          className="activity-type-badge"
          style={{ borderColor: typeConfig.color, color: typeConfig.color }}
        >
          {typeConfig.label}
        </span>
      </td>
      <td className="activity-target">
        {activity.target_agent?.toUpperCase() || '-'}
      </td>
      <td className="activity-description">
        {activity.description}
      </td>
      <td className="activity-outcome">
        <span className={`outcome-badge ${activity.outcome?.toLowerCase()}`}>
          {activity.outcome || '-'}
        </span>
      </td>
    </tr>
  );
}

/**
 * Format date/time for display
 */
function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / 60000);
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Loading skeleton
 */
function TableSkeleton() {
  return (
    <tbody>
      {[...Array(5)].map((_, i) => (
        <tr key={i} className="activity-row">
          <td><div className="skeleton" style={{ width: '80px', height: '14px' }} /></td>
          <td><div className="skeleton" style={{ width: '50px', height: '14px' }} /></td>
          <td><div className="skeleton" style={{ width: '70px', height: '20px' }} /></td>
          <td><div className="skeleton" style={{ width: '50px', height: '14px' }} /></td>
          <td><div className="skeleton" style={{ width: '150px', height: '14px' }} /></td>
          <td><div className="skeleton" style={{ width: '60px', height: '20px' }} /></td>
        </tr>
      ))}
    </tbody>
  );
}

/**
 * Main Team Lead Activity Log component
 */
export function TeamLeadActivityLog({ teamId = null, limit = 50 }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('7d');
  const [filterType, setFilterType] = useState('all');

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(limit) });
      if (teamId) params.append('team_id', teamId);
      if (DATE_RANGES[dateRange].hours) {
        params.append('hours', String(DATE_RANGES[dateRange].hours));
      }

      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams/activity-log?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setActivities(data.activities || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Fallback mock data
      setActivities(getMockActivities());
    } finally {
      setLoading(false);
    }
  }, [teamId, dateRange, limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Filter activities by type
  const filteredActivities = useMemo(() => {
    if (filterType === 'all') return activities;
    return activities.filter(a => a.activity_type === filterType);
  }, [activities, filterType]);

  // Calculate summary stats
  const stats = useMemo(() => {
    return {
      total: activities.length,
      reviews: activities.filter(a => a.activity_type === 'REVIEW').length,
      amendments: activities.filter(a => a.activity_type === 'AMENDMENT').length,
      escalations: activities.filter(a => a.activity_type === 'ESCALATION').length,
    };
  }, [activities]);

  return (
    <div className="team-lead-activity-log">
      <div className="activity-log-header">
        <div className="header-left">
          <span className="panel-icon">&#128203;</span>
          <span className="panel-title">Team Lead Activity Log</span>
        </div>
        <div className="header-right">
          <div className="activity-stats">
            <span className="stat-item">
              <span className="stat-count">{stats.reviews}</span> Reviews
            </span>
            <span className="stat-item">
              <span className="stat-count">{stats.amendments}</span> Amendments
            </span>
            <span className="stat-item">
              <span className="stat-count">{stats.escalations}</span> Escalations
            </span>
          </div>
        </div>
      </div>

      <div className="activity-log-filters">
        <div className="filter-group">
          <label>Date Range:</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="filter-select"
          >
            {Object.entries(DATE_RANGES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Type:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="REVIEW">Reviews</option>
            <option value="AMENDMENT">Amendments</option>
            <option value="ESCALATION">Escalations</option>
          </select>
        </div>

        <button
          className="refresh-btn-small"
          onClick={fetchActivities}
          title="Refresh"
        >
          &#8635;
        </button>
      </div>

      {error && (
        <div className="error-banner-small">{error}</div>
      )}

      <div className="activity-log-table-container">
        <table className="activity-log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Team Lead</th>
              <th>Type</th>
              <th>Target</th>
              <th>Description</th>
              <th>Outcome</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton />
          ) : filteredActivities.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={6} className="empty-row">
                  No activities found for the selected filters
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {filteredActivities.map((activity, idx) => (
                <ActivityRow key={activity.id || idx} activity={activity} />
              ))}
            </tbody>
          )}
        </table>
      </div>

      {filteredActivities.length > 0 && (
        <div className="activity-log-footer">
          <span className="footer-text">
            Showing {filteredActivities.length} of {stats.total} activities
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Mock data for development/fallback
 */
function getMockActivities() {
  const types = ['REVIEW', 'AMENDMENT', 'ESCALATION'];
  const leads = ['ceo', 'coo', 'cto', 'cfo'];
  const targets = ['cfo', 'cto', 'cmo', 'chro', 'devops', 'data'];
  const outcomes = ['APPROVED', 'REJECTED', 'PENDING', 'NEEDS_IMPROVEMENT'];
  const descriptions = [
    'Performance review completed',
    'Knowledge layer update approved',
    'Escalated constraint violation',
    'Task quality assessment',
    'Amendment for response pattern',
    'Escalated repeated failures',
    'Quarterly performance review',
    'Skill adjustment recommendation',
  ];

  return Array.from({ length: 20 }, (_, i) => ({
    id: `activity-${i}`,
    activity_type: types[Math.floor(Math.random() * types.length)],
    team_lead: leads[Math.floor(Math.random() * leads.length)],
    target_agent: targets[Math.floor(Math.random() * targets.length)],
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
    created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

export default TeamLeadActivityLog;
