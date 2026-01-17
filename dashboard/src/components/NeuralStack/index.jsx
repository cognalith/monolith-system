/**
 * NEURAL STACK DASHBOARD - Phase 5D
 * Cognalith Inc. | Monolith System
 *
 * Master component integrating all Neural Stack dashboard widgets.
 * Designed for CEO (Frank) oversight of Monolith agents.
 */

import React, { useState, useEffect } from 'react';
import { AgentHealthGrid } from './AgentHealthGrid.jsx';
import { EscalationWidget } from './EscalationWidget.jsx';
import { VarianceTrendChart } from './VarianceTrendChart.jsx';
import { AmendmentActivityLog } from './AmendmentActivityLog.jsx';
import { AgentHeatmap } from './AgentHeatmap.jsx';
import './NeuralStack.css';

/**
 * Dashboard layout configurations
 */
const LAYOUTS = {
  default: 'default',
  compact: 'compact',
  expanded: 'expanded',
};

/**
 * Neural Stack Dashboard Header
 */
function DashboardHeader({ selectedAgent, onAgentClear, lastUpdated }) {
  const formatTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString();
  };

  return (
    <header className="neural-stack-header">
      <div className="neural-stack-title">
        <span className="title-icon">◈</span>
        <span>Neural Stack Monitor</span>
        {selectedAgent && (
          <span className="selected-agent-badge">
            {selectedAgent.toUpperCase()}
            <button
              className="clear-agent-btn"
              onClick={onAgentClear}
              title="Clear selection"
            >
              ×
            </button>
          </span>
        )}
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
 * Main Neural Stack Dashboard component
 */
export function NeuralStackDashboard({ layout = LAYOUTS.default }) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Update timestamp periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAgentSelect = (agent) => {
    setSelectedAgent(agent.agent_role);
  };

  const handleAgentClear = () => {
    setSelectedAgent(null);
  };

  return (
    <div className="neural-stack-container">
      <DashboardHeader
        selectedAgent={selectedAgent}
        onAgentClear={handleAgentClear}
        lastUpdated={lastUpdated}
      />

      <main className="neural-stack-main">
        {/* Top Row: Agent Health + Escalations */}
        <section className="neural-stack-section top-section">
          <div className="section-grid two-thirds-one-third">
            <AgentHealthGrid onAgentSelect={handleAgentSelect} />
            <EscalationWidget />
          </div>
        </section>

        {/* Middle Row: Variance Chart + Amendment Log */}
        <section className="neural-stack-section middle-section">
          <div className="section-grid half-half">
            <VarianceTrendChart
              agentRole={selectedAgent}
              title={selectedAgent ? `Variance Trend: ${selectedAgent.toUpperCase()}` : 'Select an agent'}
            />
            <AmendmentActivityLog limit={15} showPatterns={true} />
          </div>
        </section>

        {/* Bottom Row: Heatmap */}
        <section className="neural-stack-section bottom-section">
          <AgentHeatmap
            metrics={['variance', 'cos_score', 'success_rate', 'avg_time_min', 'amendments']}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="neural-stack-footer">
        <div className="footer-left">
          <span>Monolith System v5.0</span>
          <span className="separator">|</span>
          <span>Phase 5D Neural Stack</span>
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
  AgentHealthGrid,
  EscalationWidget,
  VarianceTrendChart,
  AmendmentActivityLog,
  AgentHeatmap,
};

export default NeuralStackDashboard;
