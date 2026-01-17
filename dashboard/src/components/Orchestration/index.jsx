/**
 * ORCHESTRATION DASHBOARD - Phase 7
 * Cognalith Inc. | Monolith System
 *
 * Master component integrating all Phase 7 Orchestration dashboard widgets.
 * Designed for CEO (Frank) oversight of task orchestration and agent work.
 *
 * Components:
 * - ActiveWorkPanel: Shows what each agent is working on
 * - TaskQueuePanel: Shows all queued and blocked tasks
 * - CEODecisionQueue: Shows pending decisions for Frank
 * - SystemHealthPanel: Overall orchestration health
 */

import React, { useState, useEffect } from 'react';
import { ActiveWorkPanel } from './ActiveWorkPanel.jsx';
import { TaskQueuePanel } from './TaskQueuePanel.jsx';
import { CEODecisionQueue } from './CEODecisionQueue.jsx';
import { SystemHealthPanel } from './SystemHealthPanel.jsx';
import './Orchestration.css';

/**
 * Dashboard layout configurations
 */
const LAYOUTS = {
  default: 'default',
  compact: 'compact',
  expanded: 'expanded',
};

/**
 * Orchestration Dashboard Header
 */
function DashboardHeader({ lastUpdated }) {
  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString();
  };

  return (
    <header className="orchestration-header">
      <div className="orchestration-title">
        <span className="title-icon">{'\u2699\uFE0F'}</span>
        <span>Orchestration Dashboard</span>
      </div>
      <div className="header-right">
        {lastUpdated && (
          <span className="last-updated">
            Updated: {formatTime(lastUpdated)}
          </span>
        )}
        <div className="status-indicator online">
          <span className="status-dot" />
          <span>Live</span>
        </div>
      </div>
    </header>
  );
}

/**
 * Main Orchestration Dashboard component
 */
export function OrchestrationDashboard({ layout = LAYOUTS.default }) {
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Update timestamp periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="orchestration-container">
      <DashboardHeader lastUpdated={lastUpdated} />

      <main className="orchestration-main">
        {/* Top Row: System Health */}
        <section className="orchestration-section system-health-section">
          <SystemHealthPanel />
        </section>

        {/* Middle Row: CEO Decisions */}
        <section className="orchestration-section decisions-section">
          <CEODecisionQueue />
        </section>

        {/* Active Work Section */}
        <section className="orchestration-section active-work-section">
          <ActiveWorkPanel />
        </section>

        {/* Task Queue Section */}
        <section className="orchestration-section task-queue-section">
          <TaskQueuePanel />
        </section>
      </main>

      {/* Footer */}
      <footer className="orchestration-footer">
        <div className="footer-left">
          <span>Monolith System v7.0</span>
          <span className="separator">|</span>
          <span>Phase 7 Orchestration</span>
        </div>
        <div className="footer-right">
          <span>Cognalith Inc.</span>
        </div>
      </footer>
    </div>
  );
}

// Export individual components for flexible use
export {
  ActiveWorkPanel,
  TaskQueuePanel,
  CEODecisionQueue,
  SystemHealthPanel,
};

export default OrchestrationDashboard;
