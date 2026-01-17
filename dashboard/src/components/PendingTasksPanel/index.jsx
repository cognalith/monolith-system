/**
 * PendingTasksPanel Component
 * Displays a modal panel showing pending tasks with priority, role ownership, and workflow info.
 * Enhanced with prominent role badges per Phase 8 requirements.
 * Now with real-time updates via Agent Service WebSocket.
 */
import { useState, useEffect, useCallback } from 'react';
import { getAbbrFromId, getRoleById } from '../../config/roleHierarchy';
import { API_BASE_URL } from '../../config/api';
import { SkeletonTaskRow } from '../Skeleton';
import TaskExpandedDetails from './TaskExpandedDetails';
import { useAgentService } from '../../hooks/useAgentService';
import './PendingTasksPanel.css';

// Priority color mapping per spec
const PRIORITY_COLORS = {
  CRITICAL: '#ff4444',
  HIGH: '#ffaa00',
  MEDIUM: '#00ff88',
  LOW: '#666666',
};

// Priority order for sorting
const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Mock data for development (when API is unavailable)
const MOCK_TASKS = [
  {
    id: 'task-001',
    content: 'Review Q4 budget proposal',
    priority: 'CRITICAL',
    assigned_role: 'cfo',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    workflows: { name: 'Budget Approval' },
  },
  {
    id: 'task-002',
    content: 'Approve security audit findings',
    priority: 'HIGH',
    assigned_role: 'ciso',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    workflows: { name: 'Security Audit 2026' },
  },
  {
    id: 'task-003',
    content: 'Sign off on new vendor contract',
    priority: 'HIGH',
    assigned_role: 'cpo',
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    workflows: { name: 'Vendor Onboarding' },
  },
  {
    id: 'task-004',
    content: 'Review product roadmap changes',
    priority: 'MEDIUM',
    assigned_role: 'cto',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    workflows: { name: 'Product Launch Sprint' },
  },
  {
    id: 'task-005',
    content: 'Approve marketing campaign budget',
    priority: 'MEDIUM',
    assigned_role: 'cmo',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    workflows: { name: 'Q1 Marketing' },
  },
  {
    id: 'task-006',
    content: 'Review compliance training completion',
    priority: 'LOW',
    assigned_role: 'cco',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    workflows: { name: 'Compliance Review' },
  },
  {
    id: 'task-007',
    content: 'Finalize executive compensation review',
    priority: 'HIGH',
    assigned_role: 'chro',
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    workflows: { name: 'HR Annual Review' },
  },
  {
    id: 'task-008',
    content: 'Approve strategic partnership terms',
    priority: 'CRITICAL',
    assigned_role: 'ceo',
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    workflows: { name: 'Strategic Partnerships' },
  },
];

// Calculate priority counts from tasks
const calculateByPriority = (tasks) => {
  return tasks.reduce((acc, task) => {
    acc[task.priority] = (acc[task.priority] || 0) + 1;
    return acc;
  }, {});
};

// Tier colors for role badges
const TIER_BADGE_COLORS = {
  1: { bg: 'bg-monolith-green/20', text: 'text-monolith-green', border: 'border-monolith-green' },
  2: { bg: 'bg-monolith-amber/20', text: 'text-monolith-amber', border: 'border-monolith-amber' },
  3: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-400' },
  4: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-400' },
  5: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500' },
};

const PendingTasksPanel = ({ isOpen, onClose, selectedRole = null }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterRole, setFilterRole] = useState(selectedRole);
  const [sortBy, setSortBy] = useState('priority'); // 'priority' or 'age'
  const [byPriority, setByPriority] = useState({});

  // Task expansion state
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [taskSteps, setTaskSteps] = useState({}); // { taskId: steps[] }
  const [stepsLoading, setStepsLoading] = useState({}); // { taskId: boolean }
  const [actionLoading, setActionLoading] = useState(null); // taskId
  const [actionType, setActionType] = useState(null); // 'complete' | 'agent'
  const [actionFeedback, setActionFeedback] = useState(null);

  // Agent Service WebSocket connection for real-time updates
  const {
    isConnected: agentServiceConnected,
    agentSystemReady,
    connectionError: agentConnectionError
  } = useAgentService({
    autoConnect: isOpen, // Only connect when panel is open
    onTaskQueued: (task) => {
      console.log('[REAL-TIME] Task queued:', task.id);
      // Add new task to list if not already present
      setTasks(prev => {
        if (prev.find(t => t.id === task.id)) return prev;
        const updated = [...prev, task];
        setByPriority(calculateByPriority(updated));
        return updated;
      });
    },
    onTaskCompleted: ({ task }) => {
      console.log('[REAL-TIME] Task completed:', task.id);
      // Remove completed task from list
      setTasks(prev => {
        const updated = prev.filter(t => t.id !== task.id);
        setByPriority(calculateByPriority(updated));
        return updated;
      });
      // Clear expansion if this task was expanded
      if (expandedTaskId === task.id) {
        setExpandedTaskId(null);
      }
    },
    onTaskFailed: ({ task, error: taskError }) => {
      console.log('[REAL-TIME] Task failed:', task.id, taskError);
      // Update task status in list
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: 'failed', error: taskError } : t
      ));
    },
    onEscalation: (escalation) => {
      console.log('[REAL-TIME] Escalation received:', escalation.reason);
      // Could show a notification here
    }
  });

  // Update filter when selectedRole prop changes
  useEffect(() => {
    setFilterRole(selectedRole);
  }, [selectedRole]);

  // Fetch pending tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/pending-tasks`);
      if (!response.ok) throw new Error('Failed to fetch pending tasks');
      const data = await response.json();

      // Handle both old format (Tasks/Summary) and new format (tasks/by_priority)
      const tasksArray = data.tasks || data.Tasks || [];
      const priorityData = data.by_priority || data.Summary || {};

      if (tasksArray.length > 0) {
        setTasks(tasksArray);
        setByPriority(priorityData);
        setError(null);
        console.log(`[PENDING-TASKS] Loaded ${tasksArray.length} tasks from ${data.source || 'api'}`);
      } else {
        // No tasks from API, use mock as fallback
        setTasks(MOCK_TASKS);
        setByPriority(calculateByPriority(MOCK_TASKS));
      }
    } catch (err) {
      console.warn('API failed, using mock data:', err.message);
      // Use mock data as fallback
      setTasks(MOCK_TASKS);
      setByPriority(calculateByPriority(MOCK_TASKS));
      setError(null); // Don't show error when using mock data
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh every 30 seconds
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // Calculate hours pending from created_at
  const getHoursPending = (createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    const hours = Math.round(((now - created) / (1000 * 60 * 60)) * 10) / 10;
    return hours;
  };

  // Get role badge styling based on tier
  const getRoleBadgeStyle = (roleId) => {
    const role = getRoleById(roleId);
    const tier = role?.tier || 5;
    return TIER_BADGE_COLORS[tier] || TIER_BADGE_COLORS[5];
  };

  // Filter and sort tasks
  const getFilteredAndSortedTasks = () => {
    let filtered = tasks;

    if (filterRole) {
      filtered = tasks.filter((task) => task.assigned_role === filterRole);
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === 'priority') {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      } else {
        // Sort by age (oldest first)
        return new Date(a.created_at) - new Date(b.created_at);
      }
    });
  };

  // Get unique roles from tasks
  const getActiveRoles = () => {
    const roles = [...new Set(tasks.map((t) => t.assigned_role))];
    return roles.sort();
  };

  // Handle task click to expand/collapse
  const handleTaskClick = (taskId) => {
    const newExpandedId = expandedTaskId === taskId ? null : taskId;
    setExpandedTaskId(newExpandedId);
    setActionFeedback(null); // Clear feedback when switching tasks

    // Fetch steps if expanding and not already loaded
    if (newExpandedId && !taskSteps[taskId]) {
      fetchTaskSteps(taskId);
    }
  };

  // Fetch steps for a specific task
  const fetchTaskSteps = async (taskId) => {
    setStepsLoading((prev) => ({ ...prev, [taskId]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/steps`);
      if (!response.ok) throw new Error('Failed to fetch task steps');
      const data = await response.json();
      setTaskSteps((prev) => ({ ...prev, [taskId]: data.steps || [] }));
    } catch (err) {
      console.warn('Failed to fetch task steps:', err.message);
      // Set empty steps on error so we don't keep retrying
      setTaskSteps((prev) => ({ ...prev, [taskId]: [] }));
    } finally {
      setStepsLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  // Handle task completion
  const handleCompleteTask = async (taskId) => {
    setActionLoading(taskId);
    setActionType('complete');
    setActionFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to complete task');

      // Remove task from list on success
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setByPriority(calculateByPriority(tasks.filter((t) => t.id !== taskId)));
      setExpandedTaskId(null);
      setActionFeedback({ type: 'success', message: 'Task completed successfully!' });

      // Clear feedback after 3 seconds
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to complete task:', err.message);
      setActionFeedback({ type: 'error', message: 'Failed to complete task. Please try again.' });
    } finally {
      setActionLoading(null);
      setActionType(null);
    }
  };

  // Handle send to agent
  const handleSendToAgent = async (taskId) => {
    setActionLoading(taskId);
    setActionType('agent');
    setActionFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/send-to-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to send task to agent');

      setActionFeedback({ type: 'success', message: 'Task sent to agent successfully!' });

      // Optionally refetch tasks to update status
      fetchTasks();

      // Clear feedback after 3 seconds
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to send task to agent:', err.message);
      setActionFeedback({ type: 'error', message: 'Failed to send task to agent. Please try again.' });
    } finally {
      setActionLoading(null);
      setActionType(null);
    }
  };

  const filteredTasks = getFilteredAndSortedTasks();

  if (!isOpen) return null;

  return (
    <div className="pending-tasks-overlay" onClick={onClose}>
      <div className="pending-tasks-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pending-tasks-header">
          <div className="header-left">
            <h2>PENDING TASKS ({tasks.length})</h2>
            <div className="priority-summary">
              {Object.entries(byPriority).map(([priority, count]) => (
                <span
                  key={priority}
                  className="priority-count"
                  style={{ color: PRIORITY_COLORS[priority] }}
                >
                  {priority}: {count}
                </span>
              ))}
            </div>
          </div>
          <div className="header-right">
            {/* Agent Service Connection Status */}
            <div className="agent-service-status" title={
              agentServiceConnected
                ? agentSystemReady
                  ? 'Agent Service connected and processing'
                  : 'Agent Service connected (initializing)'
                : agentConnectionError || 'Agent Service disconnected'
            }>
              <span className={`status-dot ${
                agentServiceConnected
                  ? agentSystemReady ? 'live' : 'connecting'
                  : 'offline'
              }`}></span>
              <span className="status-text">
                {agentServiceConnected
                  ? agentSystemReady ? 'LIVE' : 'INIT'
                  : 'OFFLINE'}
              </span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="priority">Sort: Priority</option>
              <option value="age">Sort: Age</option>
            </select>
            <button className="close-btn" onClick={onClose}>
              x
            </button>
          </div>
        </div>

        {/* Role Filter */}
        <div className="role-filter">
          <button
            className={`filter-btn ${!filterRole ? 'active' : ''}`}
            onClick={() => setFilterRole(null)}
          >
            All
          </button>
          {getActiveRoles().map((role) => {
            const badgeStyle = getRoleBadgeStyle(role);
            return (
              <button
                key={role}
                className={`filter-btn ${filterRole === role ? 'active' : ''}`}
                onClick={() => setFilterRole(role)}
              >
                {getAbbrFromId(role)}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="pending-tasks-content">
          {loading ? (
            <div className="loading-state">
              <div className="skeleton-loading">
                {[...Array(5)].map((_, i) => (
                  <SkeletonTaskRow key={i} />
                ))}
              </div>
              <span>Loading tasks...</span>
            </div>
          ) : error ? (
            <div className="error-state">
              <span className="error-icon">!</span>
              <span>{error}</span>
              <button onClick={fetchTasks}>Retry</button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              <span>
                No pending tasks{filterRole ? ` for ${getAbbrFromId(filterRole)}` : ''}
              </span>
            </div>
          ) : (
            <div className="tasks-list">
              {filteredTasks.map((task) => {
                const badgeStyle = getRoleBadgeStyle(task.assigned_role);
                const isExpanded = expandedTaskId === task.id;
                return (
                  <div
                    key={task.id}
                    className={`task-card ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => handleTaskClick(task.id)}
                  >
                    <div className="task-card-header">
                      <div className="task-priority">
                        <span
                          className="priority-badge"
                          style={{
                            backgroundColor: PRIORITY_COLORS[task.priority],
                            color: task.priority === 'LOW' ? '#fff' : '#000',
                          }}
                        >
                          {task.priority}
                        </span>
                      </div>
                      <div className="task-content">
                        <div className="task-title">{task.content}</div>
                        <div className="task-meta">
                          {/* Enhanced Role Badge - Phase 8 */}
                          <span
                            className={`
                              inline-flex items-center px-2 py-0.5 rounded-md text-sm font-bold
                              ${badgeStyle.bg} ${badgeStyle.text} border ${badgeStyle.border}
                            `}
                          >
                            {getAbbrFromId(task.assigned_role)}
                          </span>
                          <span className="task-separator">|</span>
                          <span className="task-workflow">
                            {task.workflows?.name || 'N/A'}
                          </span>
                          <span className="task-separator">|</span>
                          <span className="task-age">{getHoursPending(task.created_at)}h ago</span>
                        </div>
                      </div>
                      <div className="task-expand-indicator">
                        <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>
                          {isExpanded ? '\u25BC' : '\u25B6'}
                        </span>
                      </div>
                    </div>
                    {isExpanded && (
                      <TaskExpandedDetails
                        task={task}
                        steps={taskSteps[task.id]}
                        stepsLoading={stepsLoading[task.id]}
                        onComplete={handleCompleteTask}
                        onSendToAgent={handleSendToAgent}
                        actionLoading={actionLoading === task.id ? actionType : null}
                        actionFeedback={actionFeedback}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pending-tasks-footer">
          <span className="refresh-info">Auto-refresh: 30s</span>
          <button className="refresh-btn" onClick={fetchTasks}>
            Refresh Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingTasksPanel;
