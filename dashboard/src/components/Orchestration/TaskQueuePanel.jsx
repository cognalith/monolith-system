/**
 * TASK QUEUE PANEL - Phase 7
 * Cognalith Inc. | Monolith System
 *
 * Shows all queued and blocked tasks across agents.
 * Features:
 * - Tabs: Queued | Blocked | Active
 * - Task list with title, agent, priority, status, time in queue
 * - Blocked tasks show blocker type and waiting info
 * - Sorted by priority (highest first)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api.js';

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const TABS = [
  { id: 'queued', label: 'Queued', icon: '\u{1F4CB}' },
  { id: 'blocked', label: 'Blocked', icon: '\u26D4' },
  { id: 'active', label: 'Active', icon: '\u25B6' },
];

const PRIORITY_CONFIG = {
  critical: { label: 'CRITICAL', color: 'var(--neon-crimson)', bg: 'rgba(255, 0, 60, 0.2)' },
  high: { label: 'HIGH', color: 'var(--neon-amber)', bg: 'rgba(255, 184, 0, 0.2)' },
  medium: { label: 'MEDIUM', color: 'var(--neon-cyan)', bg: 'rgba(0, 240, 255, 0.2)' },
  low: { label: 'LOW', color: '#888', bg: 'rgba(136, 136, 136, 0.2)' },
};

const STATUS_CONFIG = {
  queued: { label: 'Queued', color: '#888' },
  active: { label: 'Active', color: 'var(--neon-cyan)' },
  blocked: { label: 'Blocked', color: 'var(--neon-crimson)' },
  pending: { label: 'Pending', color: 'var(--neon-amber)' },
};

const BLOCKER_TYPES = {
  agent: { label: 'Agent Dependency', icon: '\u{1F464}' },
  decision: { label: 'Awaiting Decision', icon: '\u{1F914}' },
  auth: { label: 'Auth Required', icon: '\u{1F512}' },
  payment: { label: 'Payment Pending', icon: '\u{1F4B3}' },
  external: { label: 'External Wait', icon: '\u{1F310}' },
  resource: { label: 'Resource Unavailable', icon: '\u{1F4E6}' },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTimeInQueue(createdAt) {
  if (!createdAt) return '--';
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
  return `${diffDays}d ${diffHours % 24}h`;
}

function truncateText(text, maxLength = 60) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function sortByPriority(tasks) {
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...tasks].sort((a, b) => {
    const aPriority = priorityOrder[a.priority] ?? 4;
    const bPriority = priorityOrder[b.priority] ?? 4;
    if (aPriority !== bPriority) return aPriority - bPriority;
    // Secondary sort by time in queue (oldest first)
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

// ============================================================================
// TAB BAR COMPONENT
// ============================================================================

function TabBar({ activeTab, onTabChange, counts }) {
  return (
    <div className="task-queue-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`task-queue-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
          <span className="tab-count">{counts[tab.id] || 0}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// TASK ITEM COMPONENT
// ============================================================================

function TaskItem({ task, showBlockerInfo = false }) {
  const {
    title,
    assignedAgent,
    priority,
    status,
    createdAt,
    blockerType,
    waitingOn,
  } = task;

  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const blockerConfig = BLOCKER_TYPES[blockerType] || { label: blockerType, icon: '\u2753' };

  return (
    <div className="task-queue-item">
      <div className="task-item-header">
        <span
          className="priority-badge"
          style={{ color: priorityConfig.color, background: priorityConfig.bg }}
        >
          {priorityConfig.label}
        </span>
        <span className="task-status" style={{ color: statusConfig.color }}>
          {statusConfig.label}
        </span>
        <span className="task-time">{formatTimeInQueue(createdAt)}</span>
      </div>

      <div className="task-item-body">
        <div className="task-title">{truncateText(title, 80)}</div>
        <div className="task-agent">
          <span className="agent-icon">{'\u{1F464}'}</span>
          <span className="agent-name">{assignedAgent?.toUpperCase() || 'Unassigned'}</span>
        </div>
      </div>

      {showBlockerInfo && blockerType && (
        <div className="task-blocker-info">
          <span className="blocker-icon">{blockerConfig.icon}</span>
          <span className="blocker-type">{blockerConfig.label}</span>
          {waitingOn && (
            <span className="blocker-waiting">
              {'\u2192'} {waitingOn}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SKELETON LOADER
// ============================================================================

function TaskItemSkeleton() {
  return (
    <div className="task-queue-item skeleton-item">
      <div className="task-item-header">
        <div className="skeleton" style={{ width: '60px', height: '18px' }} />
        <div className="skeleton" style={{ width: '50px', height: '16px' }} />
        <div className="skeleton" style={{ width: '40px', height: '14px' }} />
      </div>
      <div className="task-item-body">
        <div className="skeleton" style={{ width: '100%', height: '16px', marginBottom: '0.5rem' }} />
        <div className="skeleton" style={{ width: '80px', height: '14px' }} />
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ tabId }) {
  const messages = {
    queued: 'No tasks in queue',
    blocked: 'No blocked tasks',
    active: 'No active tasks',
  };

  return (
    <div className="task-queue-empty">
      <span className="empty-icon">{'\u2713'}</span>
      <span className="empty-text">{messages[tabId]}</span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TaskQueuePanel({ refreshInterval = 15000 }) {
  const [tasks, setTasks] = useState({ queued: [], blocked: [], active: [] });
  const [activeTab, setActiveTab] = useState('queued');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/orchestration/task-queue`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setTasks({
        queued: sortByPriority(data.queued || []),
        blocked: sortByPriority(data.blocked || []),
        active: sortByPriority(data.active || []),
      });
      setError(null);
    } catch (err) {
      setError(err.message);
      setTasks(getMockTaskData());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  const counts = useMemo(
    () => ({
      queued: tasks.queued.length,
      blocked: tasks.blocked.length,
      active: tasks.active.length,
    }),
    [tasks]
  );

  const currentTasks = tasks[activeTab] || [];

  if (loading && currentTasks.length === 0) {
    return (
      <div className="task-queue-panel">
        <div className="panel-header">
          <div className="header-left">
            <span className="panel-icon">{'\u{1F4CB}'}</span>
            <span className="panel-title">Task Queue</span>
          </div>
        </div>
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} counts={{ queued: 0, blocked: 0, active: 0 }} />
        <div className="task-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <TaskItemSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="task-queue-panel">
      <div className="panel-header">
        <div className="header-left">
          <span className="panel-icon">{'\u{1F4CB}'}</span>
          <span className="panel-title">Task Queue</span>
        </div>
        <div className="header-right">
          <span className="total-count">
            Total: {counts.queued + counts.blocked + counts.active}
          </span>
          <button
            className="refresh-btn-small"
            onClick={fetchData}
            title="Refresh"
          >
            {'\u21BB'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner-small">
          Data may be stale: {error}
        </div>
      )}

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

      <div className="task-list">
        {currentTasks.length === 0 ? (
          <EmptyState tabId={activeTab} />
        ) : (
          currentTasks.map((task, idx) => (
            <TaskItem
              key={task.id || idx}
              task={task}
              showBlockerInfo={activeTab === 'blocked'}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MOCK DATA
// ============================================================================

function getMockTaskData() {
  return {
    queued: sortByPriority([
      {
        id: 'task-q1',
        title: 'Update API documentation for v2.0 release',
        assignedAgent: 'tech_writer',
        priority: 'medium',
        status: 'queued',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'task-q2',
        title: 'Implement user authentication flow',
        assignedAgent: 'web_dev',
        priority: 'high',
        status: 'queued',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'task-q3',
        title: 'Review Q1 marketing metrics',
        assignedAgent: 'cmo',
        priority: 'low',
        status: 'queued',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: 'task-q4',
        title: 'Security audit for payment module',
        assignedAgent: 'security',
        priority: 'critical',
        status: 'queued',
        createdAt: new Date(Date.now() - 900000).toISOString(),
      },
    ]),
    blocked: sortByPriority([
      {
        id: 'task-b1',
        title: 'Deploy production build',
        assignedAgent: 'devops',
        priority: 'critical',
        status: 'blocked',
        createdAt: new Date(Date.now() - 5400000).toISOString(),
        blockerType: 'decision',
        waitingOn: 'CEO approval for release',
      },
      {
        id: 'task-b2',
        title: 'Process vendor payment',
        assignedAgent: 'cfo',
        priority: 'high',
        status: 'blocked',
        createdAt: new Date(Date.now() - 10800000).toISOString(),
        blockerType: 'payment',
        waitingOn: 'Bank transfer confirmation',
      },
      {
        id: 'task-b3',
        title: 'Run integration tests',
        assignedAgent: 'qa',
        priority: 'high',
        status: 'blocked',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        blockerType: 'agent',
        waitingOn: 'DevOps deployment task',
      },
    ]),
    active: sortByPriority([
      {
        id: 'task-a1',
        title: 'Review architecture proposal',
        assignedAgent: 'cto',
        priority: 'high',
        status: 'active',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: 'task-a2',
        title: 'Build dashboard components',
        assignedAgent: 'web_dev',
        priority: 'medium',
        status: 'active',
        createdAt: new Date(Date.now() - 2700000).toISOString(),
      },
      {
        id: 'task-a3',
        title: 'Configure auto-scaling',
        assignedAgent: 'devops',
        priority: 'medium',
        status: 'active',
        createdAt: new Date(Date.now() - 900000).toISOString(),
      },
    ]),
  };
}

export default TaskQueuePanel;
