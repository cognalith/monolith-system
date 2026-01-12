/**
 * CEO Dashboard - Phase 8: Dashboard UX Enhancement
 * Unified Command & Control Center with role-based filtering,
 * clickable stat cards, and enhanced notification badges.
 */
import { useState, useEffect } from 'react';
import { ROLES, getRolesSorted, getAbbrFromId } from '../config/roleHierarchy';
import useRoleTaskCounts from '../hooks/useRoleTaskCounts';
import RoleButton from './RoleButton';
import StatCard from './StatCard';
import PendingTasksPanel from './PendingTasksPanel';
import WorkflowListPanel from './WorkflowListPanel';
import CompletedTasksPanel from './CompletedTasksPanel';
import DecisionLogPanel from './DecisionLogPanel';
import ErrorBoundary from './ErrorBoundary';

const CEODashboard = () => {
  // Dashboard data state
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Role selection state
  const [selectedRole, setSelectedRole] = useState(null);

  // Panel visibility states
  const [showTasksPanel, setShowTasksPanel] = useState(false);
  const [showWorkflowPanel, setShowWorkflowPanel] = useState(false);
  const [showCompletedPanel, setShowCompletedPanel] = useState(false);
  const [showDecisionPanel, setShowDecisionPanel] = useState(false);

  // Role task counts for notification badges
  const { taskCounts, getTaskCount } = useRoleTaskCounts({ refreshInterval: 30000 });

  // Get sorted roles by hierarchy
  const sortedRoles = getRolesSorted();

  // API Integration with auto-refresh
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch from backend API (port 3000)
        const statsRes = await fetch('http://localhost:3000/api/dashboard/stats', {
          headers: { 'Content-Type': 'application/json' },
        });
        const activityRes = await fetch('http://localhost:3000/api/recent-activity', {
          headers: { 'Content-Type': 'application/json' },
        });

        if (!statsRes.ok || !activityRes.ok) throw new Error('API unavailable');

        const statsData = await statsRes.json();
        const activityData = await activityRes.json();

        setStats(statsData);
        // API returns { activities: [...] }, extract the array
        setActivity(activityData.activities || activityData || []);
      } catch (err) {
        setError(err.message);
        console.warn('API failed, using fallback data:', err.message);

        // Fallback to minimal placeholder data with visual delay for UX
        setTimeout(() => {
          setStats({
            activeWorkflows: 0,
            pendingTasks: 0,
            completedToday: 0,
            totalDecisions: 0,
          });
          setActivity([
            {
              id: 1,
              action: 'API unavailable - Start backend server to see real data',
              timestamp: new Date(),
              role: 'system',
            },
          ]);
          // Keep error visible so user knows API is down
        }, 500);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle role selection
  const handleRoleClick = (role) => {
    if (selectedRole?.id === role.id) {
      // Deselect if clicking the same role
      setSelectedRole(null);
    } else {
      setSelectedRole(role);
    }
  };

  // Filter activity by selected role
  const filteredActivity = selectedRole
    ? activity.filter((item) => item.role === selectedRole.id)
    : activity;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-monolith-dark text-gray-100 p-6">
        {/* Header */}
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-4xl font-bold text-monolith-green mb-2">CEO Dashboard</h1>
          <p className="text-gray-400">Unified Command & Control Center</p>
          {loading && (
            <p className="text-sm text-monolith-amber mt-2 animate-pulse">Loading...</p>
          )}
          {error && <p className="text-sm text-red-500 mt-2">Using cached data</p>}
        </div>

        {/* Role Selector with Hierarchy */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Filter by Role
            </h2>
            {selectedRole && (
              <button
                onClick={() => setSelectedRole(null)}
                className="text-xs text-monolith-amber hover:text-monolith-green transition-colors"
              >
                (Clear Filter)
              </button>
            )}
          </div>

          {/* Role Buttons Grid - Organized by Tier */}
          <div className="space-y-3">
            {/* Tier 1: C-Suite */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-monolith-green font-medium w-16">C-Suite</span>
              {sortedRoles
                .filter((r) => r.tier === 1)
                .map((role) => (
                  <RoleButton
                    key={role.id}
                    role={role}
                    isSelected={selectedRole?.id === role.id}
                    taskCount={getTaskCount(role.id)}
                    onClick={handleRoleClick}
                  />
                ))}
            </div>

            {/* Tier 2: Chiefs */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-monolith-amber font-medium w-16">Chiefs</span>
              {sortedRoles
                .filter((r) => r.tier === 2)
                .map((role) => (
                  <RoleButton
                    key={role.id}
                    role={role}
                    isSelected={selectedRole?.id === role.id}
                    taskCount={getTaskCount(role.id)}
                    onClick={handleRoleClick}
                  />
                ))}
            </div>

            {/* Tier 3: VPs */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-blue-400 font-medium w-16">VPs</span>
              {sortedRoles
                .filter((r) => r.tier === 3)
                .map((role) => (
                  <RoleButton
                    key={role.id}
                    role={role}
                    isSelected={selectedRole?.id === role.id}
                    taskCount={getTaskCount(role.id)}
                    onClick={handleRoleClick}
                  />
                ))}
            </div>

            {/* Tier 4: Directors */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-purple-400 font-medium w-16">Directors</span>
              {sortedRoles
                .filter((r) => r.tier === 4)
                .map((role) => (
                  <RoleButton
                    key={role.id}
                    role={role}
                    isSelected={selectedRole?.id === role.id}
                    taskCount={getTaskCount(role.id)}
                    onClick={handleRoleClick}
                  />
                ))}
            </div>

            {/* Tier 5: Managers & Specialists */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-gray-400 font-medium w-16">Other</span>
              {sortedRoles
                .filter((r) => r.tier === 5)
                .map((role) => (
                  <RoleButton
                    key={role.id}
                    role={role}
                    isSelected={selectedRole?.id === role.id}
                    taskCount={getTaskCount(role.id)}
                    onClick={handleRoleClick}
                  />
                ))}
            </div>
          </div>
        </div>

        {/* Stats Grid - All Clickable */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Active Workflows"
              value={stats.activeWorkflows}
              color="green"
              onClick={() => setShowWorkflowPanel(true)}
            />
            <StatCard
              label="Pending Tasks"
              value={stats.pendingTasks}
              color="amber"
              onClick={() => setShowTasksPanel(true)}
            />
            <StatCard
              label="Completed Today"
              value={stats.completedToday}
              color="green"
              onClick={() => setShowCompletedPanel(true)}
            />
            <StatCard
              label="Total Decisions"
              value={stats.totalDecisions}
              color="gray"
              onClick={() => setShowDecisionPanel(true)}
            />
          </div>
        )}

        {/* Activity Feed */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-monolith-amber">
            Recent Activity
            {selectedRole && (
              <span className="text-sm font-normal text-gray-400 ml-2">
                (Filtered by {selectedRole.abbr})
              </span>
            )}
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredActivity.length > 0 ? (
              filteredActivity.map((item, idx) => (
                <div
                  key={item.id}
                  className="animate-fadeIn p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-monolith-green transition-colors cursor-pointer group"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-gray-100 group-hover:text-monolith-green transition-colors">
                        {item.action}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Role:{' '}
                        <span className="text-monolith-amber font-medium">
                          {getAbbrFromId(item.role)}
                        </span>
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {item.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-center py-8">
                {selectedRole
                  ? `No recent activity for ${selectedRole.abbr}`
                  : 'No recent activity'}
              </p>
            )}
          </div>
        </div>

        {/* Role Context Panel */}
        {selectedRole && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-8 animate-fadeIn">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-monolith-green">
                {selectedRole.fullName} Context
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTasksPanel(true)}
                  className="px-3 py-1.5 bg-monolith-amber/20 border border-monolith-amber text-monolith-amber text-sm font-medium rounded hover:bg-monolith-amber/30 transition-colors"
                >
                  View Pending Tasks ({getTaskCount(selectedRole.id)})
                </button>
                <button
                  onClick={() => setShowWorkflowPanel(true)}
                  className="px-3 py-1.5 bg-monolith-green/20 border border-monolith-green text-monolith-green text-sm font-medium rounded hover:bg-monolith-green/30 transition-colors"
                >
                  View Workflows
                </button>
              </div>
            </div>
            <div className="text-gray-300 text-sm space-y-2">
              <p>
                Role: <span className="text-monolith-amber">{selectedRole.abbr}</span>
              </p>
              <p>
                Tier:{' '}
                <span className="text-monolith-green">
                  {selectedRole.tier === 1
                    ? 'C-Suite'
                    : selectedRole.tier === 2
                    ? 'Chiefs'
                    : selectedRole.tier === 3
                    ? 'Vice Presidents'
                    : selectedRole.tier === 4
                    ? 'Directors'
                    : 'Managers & Specialists'}
                </span>
              </p>
              <p>
                Pending Tasks:{' '}
                <button
                  onClick={() => setShowTasksPanel(true)}
                  className="text-monolith-amber font-bold hover:underline cursor-pointer"
                >
                  {getTaskCount(selectedRole.id)}
                </button>
              </p>
              <p>
                Status: <span className="text-monolith-green animate-pulse">Active</span>
              </p>
              <p className="mt-4 text-gray-400">
                This role has access to critical business functions and decision-making
                authority within the {selectedRole.tier === 1 ? 'executive' : 'organizational'}{' '}
                hierarchy.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-xs">
          <p>
            Last updated: {new Date().toLocaleTimeString()} | Auto-refresh every 30 seconds
          </p>
        </div>

        {/* Panels - Rendered conditionally */}
        <WorkflowListPanel
          isOpen={showWorkflowPanel}
          onClose={() => setShowWorkflowPanel(false)}
          selectedRole={selectedRole?.id}
        />

        <PendingTasksPanel
          isOpen={showTasksPanel}
          onClose={() => setShowTasksPanel(false)}
          selectedRole={selectedRole?.id}
        />

        <CompletedTasksPanel
          isOpen={showCompletedPanel}
          onClose={() => setShowCompletedPanel(false)}
          selectedRole={selectedRole?.id}
        />

        <DecisionLogPanel
          isOpen={showDecisionPanel}
          onClose={() => setShowDecisionPanel(false)}
          selectedRole={selectedRole?.id}
        />
      </div>
    </ErrorBoundary>
  );
};

export default CEODashboard;
