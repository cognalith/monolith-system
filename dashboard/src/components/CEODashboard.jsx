/**
 * CEO Dashboard - Cognalith Cyber-Noir Edition
 * Unified Command & Control Center with neural network background,
 * glass-tile panels, and real-time agent monitoring.
 */
import { useState, useEffect } from 'react';
import { ROLES, getRolesSorted, getAbbrFromId } from '../config/roleHierarchy';
import useRoleTaskCounts from '../hooks/useRoleTaskCounts';
import { apiFetch } from '../config/api';
import NeuralBackground from './NeuralBackground';
import PendingTasksPanel from './PendingTasksPanel';
import WorkflowListPanel from './WorkflowListPanel';
import CompletedTasksPanel from './CompletedTasksPanel';
import DecisionLogPanel from './DecisionLogPanel';
import ErrorBoundary from './ErrorBoundary';
import './CEODashboard.css';

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

  // Role task counts for badges
  const { taskCounts, getTaskCount } = useRoleTaskCounts({ refreshInterval: 30000 });

  // Get sorted roles by tier
  const sortedRoles = getRolesSorted();
  const tier1Roles = sortedRoles.filter((r) => r.tier === 1);
  const tier2Roles = sortedRoles.filter((r) => r.tier === 2);
  const tier3Roles = sortedRoles.filter((r) => r.tier === 3);

  // API Integration
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [statsData, activityData] = await Promise.all([
          apiFetch('/api/dashboard/stats'),
          apiFetch('/api/recent-activity'),
        ]);

        setStats(statsData);
        setActivity(activityData.activities || activityData || []);
      } catch (err) {
        setError(err.message);
        setStats({
          activeWorkflows: 0,
          pendingTasks: 0,
          completedToday: 0,
          totalDecisions: 0,
        });
        setActivity([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRoleClick = (role) => {
    setSelectedRole(selectedRole?.id === role.id ? null : role);
  };

  const getStatusColor = (status) => {
    if (status === 'OPTIMAL') return 'var(--neon-green)';
    if (status === 'STABLE') return 'var(--neon-cyan)';
    if (status === 'ATTENTION') return 'var(--neon-amber)';
    return 'var(--neon-crimson)';
  };

  const getAgentStatus = (taskCount) => {
    if (taskCount === 0) return 'OPTIMAL';
    if (taskCount < 5) return 'STABLE';
    if (taskCount < 10) return 'ATTENTION';
    return 'CRITICAL';
  };

  return (
    <ErrorBoundary>
      <NeuralBackground />

      <div className="hud-container">
        {/* HEADER */}
        <header className="top-bar glass-tile">
          <div className="logo-area">
            MONOLITH
            <span className="logo-subtitle">// CEO DASHBOARD</span>
          </div>
          <div className="system-stats">
            <span>
              ACTIVE_AGENTS: <span className="stat-val">{tier1Roles.length + tier2Roles.length}</span>
            </span>
            <span>
              SYSTEM_STATUS:{' '}
              <span className="stat-val" style={{ color: 'var(--neon-green)' }}>
                {loading ? 'SYNC' : 'PHASE_5'}
              </span>
            </span>
            <span>
              TASKS: <span className="stat-val" style={{ color: 'var(--neon-amber)' }}>{stats?.pendingTasks || 0}</span>
            </span>
          </div>
        </header>

        {/* SIDEBAR - Organization Hierarchy */}
        <aside className="glass-tile sidebar">
          <h3 className="glass-tile-header">Organization Hierarchy</h3>
          <div className="tree-container">
            {/* Tier 1: C-Suite */}
            <div className="tree-group-title">Tier 1: Core C-Suite</div>
            {tier1Roles.map((role) => (
              <div key={role.id} className="tree-node">
                <div
                  className={`tree-label ${selectedRole?.id === role.id ? 'active' : ''}`}
                  onClick={() => handleRoleClick(role)}
                >
                  <span style={{ color: getStatusColor(getAgentStatus(getTaskCount(role.id))) }}>●</span>
                  {role.fullName}
                  {getTaskCount(role.id) > 0 && (
                    <span className="tree-badge">{getTaskCount(role.id)}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Tier 2: Extended Leadership */}
            <div className="tree-group-title">Tier 2: Extended Leadership</div>
            {tier2Roles.map((role) => (
              <div key={role.id} className="tree-node">
                <div
                  className={`tree-label ${selectedRole?.id === role.id ? 'active' : ''}`}
                  onClick={() => handleRoleClick(role)}
                >
                  <span style={{ color: getStatusColor(getAgentStatus(getTaskCount(role.id))) }}>●</span>
                  {role.fullName}
                  {getTaskCount(role.id) > 0 && (
                    <span className="tree-badge">{getTaskCount(role.id)}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Tier 3: Specialists */}
            <div className="tree-group-title">Tier 3: Specialists</div>
            {tier3Roles.slice(0, 8).map((role) => (
              <div key={role.id} className="tree-node">
                <div
                  className={`tree-label ${selectedRole?.id === role.id ? 'active' : ''}`}
                  onClick={() => handleRoleClick(role)}
                >
                  <span style={{ color: getStatusColor(getAgentStatus(getTaskCount(role.id))) }}>●</span>
                  {role.fullName}
                  {getTaskCount(role.id) > 0 && (
                    <span className="tree-badge">{getTaskCount(role.id)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* MAIN STAGE */}
        <main className="main-stage">
          {/* TOP DECK */}
          <div className="top-deck">
            {/* Workflow Monitor */}
            <div className="glass-tile workflow-panel">
              <h3 className="glass-tile-header">Active Workflow Monitor</h3>
              <div className="workflow-scroll">
                <table className="workflow-table">
                  <thead>
                    <tr>
                      <th>TASK ID</th>
                      <th>CONTEXT</th>
                      <th>ASSIGNED</th>
                      <th>STATUS</th>
                      <th>PROGRESS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.activeWorkflows > 0 ? (
                      <>
                        <tr>
                          <td style={{ color: 'var(--neon-cyan)' }}>TSK-901</td>
                          <td>SYSTEM_INTEGRATION</td>
                          <td style={{ color: '#aaa' }}>CTO</td>
                          <td><span className="status-badge status-progress pulse">IN PROGRESS</span></td>
                          <td>
                            <div className="progress-bar-container">
                              <div className="progress-bar-fill" style={{ width: '65%' }} />
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: 'var(--neon-cyan)' }}>TSK-902</td>
                          <td>FINANCIAL_REVIEW</td>
                          <td style={{ color: '#aaa' }}>CFO</td>
                          <td><span className="status-badge status-progress pulse">IN PROGRESS</span></td>
                          <td>
                            <div className="progress-bar-container">
                              <div className="progress-bar-fill" style={{ width: '40%' }} />
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: 'var(--neon-cyan)' }}>TSK-899</td>
                          <td>COMPLIANCE_AUDIT</td>
                          <td style={{ color: '#aaa' }}>CLO</td>
                          <td><span className="status-badge status-pending">PENDING</span></td>
                          <td>
                            <div className="progress-bar-container">
                              <div className="progress-bar-fill" style={{ width: '10%' }} />
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: 'var(--neon-cyan)' }}>TSK-898</td>
                          <td>MARKETING_STRATEGY</td>
                          <td style={{ color: '#aaa' }}>CMO</td>
                          <td><span className="status-badge status-complete">COMPLETE</span></td>
                          <td>
                            <div className="progress-bar-container">
                              <div className="progress-bar-fill" style={{ width: '100%' }} />
                            </div>
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                          No active workflows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="panel-footer">
                <button className="cyber-button" onClick={() => setShowWorkflowPanel(true)}>
                  View All Workflows ({stats?.activeWorkflows || 0})
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="glass-tile stats-panel">
              <h3 className="glass-tile-header">System Metrics</h3>
              <div className="stats-grid">
                <div className="stat-card" onClick={() => setShowWorkflowPanel(true)}>
                  <div className="metric-sub">Active Workflows</div>
                  <div className="metric-big text-neon-cyan">{stats?.activeWorkflows || 0}</div>
                </div>
                <div className="stat-card" onClick={() => setShowTasksPanel(true)}>
                  <div className="metric-sub">Pending Tasks</div>
                  <div className="metric-big text-neon-amber">{stats?.pendingTasks || 0}</div>
                </div>
                <div className="stat-card" onClick={() => setShowCompletedPanel(true)}>
                  <div className="metric-sub">Completed Today</div>
                  <div className="metric-big text-neon-green">{stats?.completedToday || 0}</div>
                </div>
                <div className="stat-card" onClick={() => setShowDecisionPanel(true)}>
                  <div className="metric-sub">Decisions Made</div>
                  <div className="metric-big">{stats?.totalDecisions || 0}</div>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM DECK */}
          <div className="bottom-deck">
            {/* Department Status */}
            <div className="glass-tile dept-panel">
              <h3 className="glass-tile-header">Department Status</h3>
              <div className="dept-grid">
                {tier1Roles.concat(tier2Roles.slice(0, 4)).map((role) => {
                  const taskCount = getTaskCount(role.id);
                  const status = getAgentStatus(taskCount);
                  return (
                    <div
                      key={role.id}
                      className="dept-card"
                      onClick={() => handleRoleClick(role)}
                    >
                      <div className="dept-header">
                        <span className="dept-abbr">{role.abbr}</span>
                        <div
                          className="dept-dot"
                          style={{ background: getStatusColor(status), color: getStatusColor(status) }}
                        />
                      </div>
                      <div className="dept-domain">{role.fullName.split(' ').slice(-1)[0].toUpperCase()}</div>
                      {taskCount > 0 && <div className="dept-tasks">{taskCount} tasks</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agent Detail Panel */}
            <div className="glass-tile agent-panel">
              <div className="agent-header-row">
                <div>
                  <div className="agent-title">
                    {selectedRole ? `AGENT: ${selectedRole.fullName.toUpperCase()}` : 'SELECT AGENT'}
                  </div>
                  <div className="agent-meta">
                    ID: {selectedRole?.id?.toUpperCase() || 'NULL'} | TIER: {selectedRole?.tier || 'N/A'}
                  </div>
                </div>
                {selectedRole && (
                  <span
                    className={`status-badge ${
                      getAgentStatus(getTaskCount(selectedRole.id)) === 'OPTIMAL'
                        ? 'status-complete'
                        : getAgentStatus(getTaskCount(selectedRole.id)) === 'STABLE'
                        ? 'status-progress'
                        : 'status-pending'
                    }`}
                  >
                    {getAgentStatus(getTaskCount(selectedRole.id))}
                  </span>
                )}
              </div>

              <div className="agent-ctx">
                {'>'} CURRENT_CTX: <span className="ctx-value">{selectedRole ? 'ACTIVE_MONITORING' : 'IDLE'}</span>
              </div>

              <div className="stack-viz">
                <div className={`stack-layer ${selectedRole ? 'active' : ''}`}>
                  <span>L4: CHIEF OF STAFF</span>
                  <span style={{ color: 'var(--neon-cyan)' }}>EVALUATOR</span>
                </div>
                <div className="stack-layer know">
                  <span>L3: KNOWLEDGE</span>
                  <span>{selectedRole ? 'RAG_ENABLED' : 'STANDBY'}</span>
                </div>
                <div className="stack-layer skill">
                  <span>L2: SKILLS</span>
                  <span>{selectedRole ? 'API_ACCESS' : 'STANDBY'}</span>
                </div>
                <div className="stack-layer base">
                  <span>L1: PERSONA (BASE)</span>
                  <span>{selectedRole ? `${selectedRole.abbr}_CORE` : 'IMMUTABLE'}</span>
                </div>
              </div>

              <div className="agent-actions">
                {selectedRole && (
                  <>
                    <button className="cyber-button" onClick={() => setShowTasksPanel(true)}>
                      View Tasks ({getTaskCount(selectedRole.id)})
                    </button>
                    <button className="cyber-button" onClick={() => setShowWorkflowPanel(true)}>
                      Workflows
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Risk Heatmap */}
            <div className="glass-tile risk-panel">
              <h3 className="glass-tile-header">Operational Risk Map</h3>
              <div className="risk-grid">
                {Array.from({ length: 20 }).map((_, i) => {
                  const levels = ['low', 'low', 'low', 'med', 'high'];
                  const level = levels[Math.floor(Math.random() * 5)];
                  return (
                    <div
                      key={i}
                      className="risk-cell"
                      data-level={level}
                      title={`Sector ${i + 1}: ${level.toUpperCase()} RISK`}
                    />
                  );
                })}
              </div>
              <div className="risk-legend">
                <span><span className="legend-dot" style={{ background: 'var(--neon-green)' }} /> Low</span>
                <span><span className="legend-dot" style={{ background: 'var(--neon-amber)' }} /> Medium</span>
                <span><span className="legend-dot" style={{ background: 'var(--neon-crimson)' }} /> High</span>
              </div>
            </div>
          </div>
        </main>

        {/* FOOTER */}
        <footer className="footer">
          COGNALITH INC. | ONE FOUNDER. INFINITE LEVERAGE. | Last Updated: {new Date().toLocaleTimeString()}
        </footer>
      </div>

      {/* Modal Panels */}
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
    </ErrorBoundary>
  );
};

export default CEODashboard;
