/**
 * CompletedTasksPanel Component
 * Displays a modal panel showing today's completed tasks with timestamps and role information.
 */
import { useState, useEffect, useCallback } from 'react';
import { getAbbrFromId } from '../../config/roleHierarchy';

// Priority color mapping - Cyber-noir palette
const PRIORITY_COLORS = {
  CRITICAL: '#ff003c',   // neon-crimson
  HIGH: '#ffb800',       // neon-amber
  MEDIUM: '#00f0ff',     // neon-cyan
  LOW: '#666666',
};

// Mock data for development (until backend API is ready)
const MOCK_COMPLETED_TASKS = [
  {
    id: 'ct-001',
    content: 'Reviewed Q4 budget proposal',
    completed_role: 'cfo',
    priority: 'HIGH',
    completed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    workflow_name: 'Q4 Budget Approval',
    duration_minutes: 45,
  },
  {
    id: 'ct-002',
    content: 'Approved security policy update',
    completed_role: 'ciso',
    priority: 'CRITICAL',
    completed_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    workflow_name: 'Security Audit 2026',
    duration_minutes: 120,
  },
  {
    id: 'ct-003',
    content: 'Signed vendor contract',
    completed_role: 'chief-procurement-officer',
    priority: 'MEDIUM',
    completed_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    workflow_name: 'Vendor Management',
    duration_minutes: 30,
  },
  {
    id: 'ct-004',
    content: 'Approved marketing campaign',
    completed_role: 'cmo',
    priority: 'MEDIUM',
    completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Q1 Marketing',
    duration_minutes: 60,
  },
  {
    id: 'ct-005',
    content: 'Reviewed compliance report',
    completed_role: 'chief-compliance-officer',
    priority: 'HIGH',
    completed_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Compliance Review',
    duration_minutes: 90,
  },
  {
    id: 'ct-006',
    content: 'Approved new hire offer letter',
    completed_role: 'chro',
    priority: 'LOW',
    completed_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'New Hire Onboarding',
    duration_minutes: 15,
  },
  {
    id: 'ct-007',
    content: 'Finalized sprint planning',
    completed_role: 'cto',
    priority: 'MEDIUM',
    completed_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Product Launch Sprint',
    duration_minutes: 60,
  },
  {
    id: 'ct-008',
    content: 'Approved strategic initiative',
    completed_role: 'ceo',
    priority: 'CRITICAL',
    completed_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    workflow_name: 'Strategic Planning',
    duration_minutes: 30,
  },
];

const CompletedTasksPanel = ({ isOpen, onClose, selectedRole = null }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterPriority, setFilterPriority] = useState(null);
  const [sortBy, setSortBy] = useState('time'); // 'time', 'priority', 'duration'

  // Fetch completed tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks/completed-today');
      if (!response.ok) throw new Error('Failed to fetch completed tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      console.warn('API failed, using mock data:', err.message);
      // Use mock data as fallback
      setTasks(MOCK_COMPLETED_TASKS);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (isOpen) {
      fetchTasks();
      const interval = setInterval(fetchTasks, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchTasks]);

  // Priority order for sorting
  const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  // Filter and sort tasks
  const getFilteredTasks = () => {
    let filtered = tasks;

    // Filter by selected role if provided
    if (selectedRole) {
      filtered = filtered.filter((task) => task.completed_role === selectedRole);
    }

    // Filter by priority
    if (filterPriority) {
      filtered = filtered.filter((task) => task.priority === filterPriority);
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        case 'duration':
          return b.duration_minutes - a.duration_minutes;
        case 'time':
        default:
          return new Date(b.completed_at) - new Date(a.completed_at);
      }
    });
  };

  // Format completed time
  const formatCompletedTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Format duration
  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Get priority counts
  const getPriorityCounts = () => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    tasks.forEach((task) => {
      if (counts[task.priority] !== undefined) {
        counts[task.priority]++;
      }
    });
    return counts;
  };

  const filteredTasks = getFilteredTasks();
  const priorityCounts = getPriorityCounts();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-tile w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-neon-cyan">
              COMPLETED TODAY ({filteredTasks.length})
            </h2>
            <div className="flex gap-4 mt-2 text-sm">
              {Object.entries(priorityCounts).map(([priority, count]) => {
                if (count === 0) return null;
                return (
                  <span key={priority} style={{ color: PRIORITY_COLORS[priority] }}>
                    {priority}: {count}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-black/30 text-gray-300 border border-white/10 rounded px-2 py-1 text-sm font-code"
            >
              <option value="time">Sort: Recent</option>
              <option value="priority">Sort: Priority</option>
              <option value="duration">Sort: Duration</option>
            </select>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
            >
              x
            </button>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="flex gap-2 p-4 border-b border-white/10 flex-wrap">
          <button
            onClick={() => setFilterPriority(null)}
            className={`px-3 py-1 rounded text-sm font-code ${
              !filterPriority
                ? 'bg-[var(--neon-cyan)] text-black'
                : 'bg-black/30 text-gray-300 hover:bg-white/10'
            }`}
          >
            All
          </button>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => (
            <button
              key={priority}
              onClick={() => setFilterPriority(priority)}
              className={`px-3 py-1 rounded text-sm font-code ${
                filterPriority === priority
                  ? 'bg-[var(--neon-cyan)] text-black'
                  : 'bg-black/30 text-gray-300 hover:bg-white/10'
              }`}
              style={{
                borderLeft: `3px solid ${PRIORITY_COLORS[priority]}`,
              }}
            >
              {priority}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--neon-cyan)]"></div>
              <span className="ml-3 text-gray-400">Loading completed tasks...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <span className="text-[var(--neon-crimson)] text-2xl">!</span>
              <p className="text-gray-400 mt-2">{error}</p>
              <button
                onClick={fetchTasks}
                className="mt-4 px-4 py-2 bg-[var(--neon-cyan)] text-black rounded hover:opacity-80 cyber-button"
              >
                Retry
              </button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No tasks completed today{selectedRole ? ` by ${getAbbrFromId(selectedRole)}` : ''}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-black/30 border border-white/10 rounded-lg p-4 hover:border-[var(--neon-cyan)]/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-bold"
                          style={{
                            backgroundColor: PRIORITY_COLORS[task.priority] + '20',
                            color: PRIORITY_COLORS[task.priority],
                          }}
                        >
                          {task.priority}
                        </span>
                        <h3 className="text-gray-100 font-medium">{task.content}</h3>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm font-code">
                        <span className="text-neon-amber font-medium">
                          {getAbbrFromId(task.completed_role)}
                        </span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400">{task.workflow_name || 'N/A'}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400">
                          Duration: {formatDuration(task.duration_minutes)}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-neon-cyan font-medium font-code">
                        {formatCompletedTime(task.completed_at)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Completed</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 text-sm text-gray-500 font-code">
          <span>Auto-refresh: 30s</span>
          <button
            onClick={fetchTasks}
            className="text-neon-cyan hover:text-[var(--neon-cyan)]/80"
          >
            Refresh Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompletedTasksPanel;
