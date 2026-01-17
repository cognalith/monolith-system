/**
 * TEAM DRILL DOWN - Phase 6A
 * Cognalith Inc. | Monolith System
 *
 * Detailed team view showing:
 * - Team Lead info with performance metrics
 * - List of subordinates with their trends
 * - Knowledge Bot status
 * - Recent Team Lead reviews
 * - Amendment activity within team
 */

import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../config/api.js';

const TREND_ICONS = {
  IMPROVING: { icon: '\u2191', class: 'improving', label: 'Improving' },
  STABLE: { icon: '\u2192', class: 'stable', label: 'Stable' },
  DECLINING: { icon: '\u2193', class: 'declining', label: 'Declining' },
};

/**
 * Team Lead info card
 */
function TeamLeadCard({ lead }) {
  if (!lead) return null;

  return (
    <div className="team-lead-card">
      <div className="lead-header">
        <div className="lead-avatar">
          {lead.role?.charAt(0).toUpperCase()}
        </div>
        <div className="lead-info">
          <span className="lead-role">{lead.role?.toUpperCase()}</span>
          <span className="lead-title">Team Lead</span>
        </div>
        <div className="lead-health">
          <span className={`health-indicator ${getHealthClass(lead.health_score)}`}>
            {lead.health_score}%
          </span>
        </div>
      </div>

      <div className="lead-metrics">
        <div className="lead-metric">
          <span className="label">Tasks Completed</span>
          <span className="value">{lead.tasks_completed || 0}</span>
        </div>
        <div className="lead-metric">
          <span className="label">Reviews Performed</span>
          <span className="value">{lead.reviews_performed || 0}</span>
        </div>
        <div className="lead-metric">
          <span className="label">Success Rate</span>
          <span className={`value ${getSuccessClass(lead.success_rate)}`}>
            {lead.success_rate || 0}%
          </span>
        </div>
        <div className="lead-metric">
          <span className="label">Avg CoS Score</span>
          <span className={`value ${getCosClass(lead.avg_cos_score)}`}>
            {lead.avg_cos_score?.toFixed(2) || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Subordinate list
 */
function SubordinateList({ subordinates }) {
  if (!subordinates?.length) {
    return (
      <div className="subordinate-list-empty">
        No subordinates in this team
      </div>
    );
  }

  return (
    <div className="subordinate-list">
      <div className="subordinate-list-header">
        <span>Subordinates ({subordinates.length})</span>
      </div>
      <div className="subordinate-items">
        {subordinates.map((sub) => {
          const trend = TREND_ICONS[sub.trend] || TREND_ICONS.STABLE;
          return (
            <div key={sub.agent_role} className="subordinate-item">
              <div className="subordinate-info">
                <span className="subordinate-role">{sub.agent_role?.toUpperCase()}</span>
                <span className={`subordinate-trend ${trend.class}`}>
                  {trend.icon} {trend.label}
                </span>
              </div>
              <div className="subordinate-metrics">
                <span className={`metric ${getHealthClass(sub.health_score)}`}>
                  {sub.health_score}%
                </span>
                <span className="metric">
                  {sub.tasks_completed || 0} tasks
                </span>
                <span className={`metric ${sub.active_amendments > 2 ? 'warning' : ''}`}>
                  {sub.active_amendments || 0} amendments
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Knowledge Bot status panel
 */
function KnowledgeBotStatus({ botStatus }) {
  const isActive = botStatus?.active;

  return (
    <div className={`knowledge-bot-status ${isActive ? 'active' : 'inactive'}`}>
      <div className="bot-header">
        <span className="bot-icon">&#129302;</span>
        <span className="bot-title">Knowledge Bot</span>
        <span className={`bot-status-badge ${isActive ? 'active' : 'inactive'}`}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      {isActive && (
        <div className="bot-stats">
          <div className="bot-stat">
            <span className="label">Suggestions Made</span>
            <span className="value">{botStatus.suggestions_made || 0}</span>
          </div>
          <div className="bot-stat">
            <span className="label">Accepted</span>
            <span className="value positive">{botStatus.suggestions_accepted || 0}</span>
          </div>
          <div className="bot-stat">
            <span className="label">Last Active</span>
            <span className="value">
              {botStatus.last_active ? formatTime(botStatus.last_active) : 'N/A'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Recent reviews by Team Lead
 */
function RecentReviews({ reviews }) {
  if (!reviews?.length) {
    return (
      <div className="recent-reviews-empty">
        No recent reviews
      </div>
    );
  }

  return (
    <div className="recent-reviews">
      <div className="reviews-header">Recent Team Lead Reviews</div>
      <div className="reviews-list">
        {reviews.slice(0, 5).map((review, idx) => (
          <div key={idx} className="review-item">
            <div className="review-header">
              <span className="review-agent">{review.agent_reviewed?.toUpperCase()}</span>
              <span className={`review-outcome ${review.outcome?.toLowerCase()}`}>
                {review.outcome}
              </span>
            </div>
            <div className="review-details">
              <span className="review-type">{review.review_type}</span>
              <span className="review-time">{formatTime(review.reviewed_at)}</span>
            </div>
            {review.notes && (
              <div className="review-notes">{review.notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Amendment activity within team
 */
function TeamAmendments({ amendments }) {
  if (!amendments?.length) {
    return (
      <div className="team-amendments-empty">
        No recent amendments
      </div>
    );
  }

  return (
    <div className="team-amendments">
      <div className="amendments-header">Amendment Activity</div>
      <div className="amendments-list">
        {amendments.slice(0, 8).map((amendment, idx) => (
          <div key={idx} className="amendment-row">
            <span className={`amendment-status-dot ${amendment.status?.toLowerCase()}`} />
            <span className="amendment-agent">{amendment.agent_role?.toUpperCase()}</span>
            <span className="amendment-type">{amendment.amendment_type}</span>
            <span className="amendment-time">{formatTime(amendment.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Helper functions
 */
function getHealthClass(score) {
  if (score >= 80) return 'positive';
  if (score >= 60) return 'warning';
  return 'negative';
}

function getSuccessClass(rate) {
  if (rate >= 85) return 'positive';
  if (rate >= 70) return 'warning';
  return 'negative';
}

function getCosClass(score) {
  if (score >= 0.85) return 'positive';
  if (score >= 0.7) return 'warning';
  return 'negative';
}

function formatTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

/**
 * Loading skeleton
 */
function DrillDownSkeleton() {
  return (
    <div className="team-drill-down-content">
      <div className="team-lead-card">
        <div className="lead-header">
          <div className="skeleton" style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
          <div className="lead-info">
            <div className="skeleton" style={{ width: '80px', height: '16px', marginBottom: '4px' }} />
            <div className="skeleton" style={{ width: '60px', height: '12px' }} />
          </div>
        </div>
      </div>
      <div className="subordinate-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="subordinate-item">
            <div className="skeleton" style={{ width: '100%', height: '40px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Main Team Drill Down component
 */
export function TeamDrillDown({ team, onBack }) {
  const [teamDetails, setTeamDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTeamDetails = useCallback(async () => {
    if (!team?.team_id) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/neural-stack/teams/${team.team_id}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTeamDetails(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Fallback mock data
      setTeamDetails(getMockTeamDetails(team));
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    fetchTeamDetails();
  }, [fetchTeamDetails]);

  if (!team) {
    return (
      <div className="team-drill-down">
        <div className="neural-stack-empty">
          <div>Select a team to view details</div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-drill-down">
      <div className="drill-down-header">
        <button className="back-btn" onClick={onBack} title="Back to overview">
          &#8592; Back
        </button>
        <h3 className="drill-down-title">{team.team_name}</h3>
        <button
          className="refresh-btn-small"
          onClick={fetchTeamDetails}
          title="Refresh"
        >
          &#8635;
        </button>
      </div>

      {error && (
        <div className="error-banner-small">{error}</div>
      )}

      {loading ? (
        <DrillDownSkeleton />
      ) : (
        <div className="team-drill-down-content">
          <div className="drill-down-main">
            <TeamLeadCard lead={teamDetails?.team_lead} />
            <SubordinateList subordinates={teamDetails?.subordinates} />
          </div>

          <div className="drill-down-sidebar">
            <KnowledgeBotStatus botStatus={teamDetails?.knowledge_bot} />
            <RecentReviews reviews={teamDetails?.recent_reviews} />
            <TeamAmendments amendments={teamDetails?.amendments} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Mock data for development/fallback
 */
function getMockTeamDetails(team) {
  return {
    team_id: team.team_id,
    team_name: team.team_name,
    team_lead: {
      role: team.team_lead,
      health_score: 88,
      tasks_completed: 45,
      reviews_performed: 12,
      success_rate: 92,
      avg_cos_score: 0.87,
    },
    subordinates: [
      {
        agent_role: 'cfo',
        health_score: 82,
        trend: 'IMPROVING',
        tasks_completed: 38,
        active_amendments: 1,
      },
      {
        agent_role: 'cto',
        health_score: 75,
        trend: 'STABLE',
        tasks_completed: 42,
        active_amendments: 2,
      },
      {
        agent_role: 'coo',
        health_score: 68,
        trend: 'DECLINING',
        tasks_completed: 29,
        active_amendments: 4,
      },
    ],
    knowledge_bot: {
      active: true,
      suggestions_made: 23,
      suggestions_accepted: 18,
      last_active: new Date(Date.now() - 1800000).toISOString(),
    },
    recent_reviews: [
      {
        agent_reviewed: 'cfo',
        outcome: 'APPROVED',
        review_type: 'Performance Review',
        reviewed_at: new Date(Date.now() - 7200000).toISOString(),
        notes: 'Good progress on financial reporting accuracy',
      },
      {
        agent_reviewed: 'cto',
        outcome: 'NEEDS_IMPROVEMENT',
        review_type: 'Task Review',
        reviewed_at: new Date(Date.now() - 14400000).toISOString(),
        notes: 'Technical debt accumulating in infrastructure tasks',
      },
    ],
    amendments: [
      {
        agent_role: 'cfo',
        amendment_type: 'KNOWLEDGE_UPDATE',
        status: 'ACTIVE',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        agent_role: 'cto',
        amendment_type: 'CONSTRAINT_ADJUSTMENT',
        status: 'PENDING',
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
  };
}

export default TeamDrillDown;
