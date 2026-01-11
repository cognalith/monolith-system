/**
 * WorkflowListPanel Component
 * Displays a modal panel showing active workflows with status, owner, and progress.
 */
import { useState, useEffect, useCallback } from 'react';
import { getAbbrFromId } from '../../config/roleHierarchy';

// Status color mapping
const STATUS_COLORS = {
  active: '#00ff88',
  paused: '#ffaa00',
  blocked: '#ff4444',
  completed: '#666666',
};

// Mock data for development (until backend API is ready)
const MOCK_WORKFLOWS = [
  {
    id: 'wf-001',
    name: 'Q4 Budget Approval',
    status: 'active',
    owner_role: 'cfo',
    progress: 75,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    description: 'Annual Q4 budget review and approval process',
  },
  {
    id: 'wf-002',
    name: 'Security Audit 2026',
    status: 'active',
    owner_role: 'ciso',
    progress: 45,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    description: 'Annual security compliance audit',
  },
  {
    id: 'wf-003',
    name: 'New Hire Onboarding',
    status: 'paused',
    owner_role: 'chro',
    progress: 30,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    description: 'Onboarding workflow for Q1 hires',
  },
  {
    id: 'wf-004',
    name: 'Product Launch Sprint',
    status: 'active',
    owner_role: 'cto',
    progress: 90,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    description: 'V2.0 product launch preparation',
  },
];

const WorkflowListPanel = ({ isOpen, onClose, selectedRole = null }) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [sortBy, setSortBy] = useState('updated'); // 'updated', 'progress', 'name'

  // Fetch workflows
  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workflows/active');
      if (!response.ok) throw new Error('Failed to fetch workflows');
      const data = await response.json();
      setWorkflows(data.workflows || []);
      setError(null);
    } catch (err) {
      console.warn('API failed, using mock data:', err.message);
      // Use mock data as fallback
      setWorkflows(MOCK_WORKFLOWS);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (isOpen) {
      fetchWorkflows();
      const interval = setInterval(fetchWorkflows, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchWorkflows]);

  // Filter and sort workflows
  const getFilteredWorkflows = () => {
    let filtered = workflows;

    // Filter by selected role if provided
    if (selectedRole) {
      filtered = filtered.filter((wf) => wf.owner_role === selectedRole);
    }

    // Filter by status
    if (filterStatus) {
      filtered = filtered.filter((wf) => wf.status === filterStatus);
    }

    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          return b.progress - a.progress;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'updated':
        default:
          return new Date(b.updated_at) - new Date(a.updated_at);
      }
    });
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const filteredWorkflows = getFilteredWorkflows();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-monolith-green">
              ACTIVE WORKFLOWS ({filteredWorkflows.length})
            </h2>
            <div className="flex gap-4 mt-2 text-sm">
              {Object.entries(STATUS_COLORS).map(([status, color]) => {
                const count = workflows.filter((w) => w.status === status).length;
                if (count === 0) return null;
                return (
                  <span key={status} style={{ color }}>
                    {status.toUpperCase()}: {count}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-800 text-gray-300 border border-gray-600 rounded px-2 py-1 text-sm"
            >
              <option value="updated">Sort: Recent</option>
              <option value="progress">Sort: Progress</option>
              <option value="name">Sort: Name</option>
            </select>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
            >
              x
            </button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 p-4 border-b border-gray-700 flex-wrap">
          <button
            onClick={() => setFilterStatus(null)}
            className={`px-3 py-1 rounded text-sm ${
              !filterStatus
                ? 'bg-monolith-green text-monolith-dark'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {['active', 'paused', 'blocked'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded text-sm capitalize ${
                filterStatus === status
                  ? 'bg-monolith-green text-monolith-dark'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-monolith-green"></div>
              <span className="ml-3 text-gray-400">Loading workflows...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <span className="text-red-400 text-2xl">!</span>
              <p className="text-gray-400 mt-2">{error}</p>
              <button
                onClick={fetchWorkflows}
                className="mt-4 px-4 py-2 bg-monolith-green text-monolith-dark rounded hover:bg-monolith-green/80"
              >
                Retry
              </button>
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No active workflows{selectedRole ? ` for ${getAbbrFromId(selectedRole)}` : ''}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWorkflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-monolith-green/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-100">
                          {workflow.name}
                        </h3>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                          style={{
                            backgroundColor: STATUS_COLORS[workflow.status] + '20',
                            color: STATUS_COLORS[workflow.status],
                          }}
                        >
                          {workflow.status}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        {workflow.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-monolith-amber font-medium">
                          Owner: {getAbbrFromId(workflow.owner_role)}
                        </span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400">
                          Updated: {formatTimeAgo(workflow.updated_at)}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-2xl font-bold text-monolith-green">
                        {workflow.progress}%
                      </div>
                      <div className="w-24 h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-monolith-green rounded-full transition-all duration-300"
                          style={{ width: `${workflow.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700 text-sm text-gray-500">
          <span>Auto-refresh: 30s</span>
          <button
            onClick={fetchWorkflows}
            className="text-monolith-green hover:text-monolith-green/80"
          >
            Refresh Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowListPanel;
