/**
 * NEURAL STACK DASHBOARD - Phase 6H
 * Cognalith Inc. | Monolith System
 *
 * Master component integrating all Neural Stack dashboard widgets.
 * Designed for CEO (Frank) oversight of Monolith agents.
 *
 * PHASE 5E: Added autonomy widgets
 * - AutonomyStatusPanel
 * - ExceptionQueueWidget
 * - CoSHealthIndicator
 * - BakingActivityWidget
 *
 * PHASE 6A: Added team hierarchy visualization
 * - TeamOverviewPanel
 * - TeamDrillDown
 * - TeamLeadActivityLog
 * - TeamHeatmap
 *
 * PHASE 6B: Added Knowledge Bot components
 * - KnowledgeBotPanel
 * - RecommendationQueue
 * - LearningInsightsPanel
 * - ResearchLogPanel
 *
 * PHASE 6C: Added Tech Team specialized panel
 * - TechTeamPanel (first deployed team)
 *
 * PHASE 6D: Added Marketing Team specialized panel
 * - MarketingTeamPanel
 *
 * PHASE 6E: Added Product Team specialized panel
 * - ProductTeamPanel
 *
 * PHASE 6F: Added Operations Team specialized panel
 * - OperationsTeamPanel
 *
 * PHASE 6G: Added Finance Team specialized panel
 * - FinanceTeamPanel
 *
 * PHASE 6H: Added People Team specialized panel
 * - PeopleTeamPanel
 */

import React, { useState, useEffect } from 'react';
import { AgentHealthGrid } from './AgentHealthGrid.jsx';
import { EscalationWidget } from './EscalationWidget.jsx';
import { VarianceTrendChart } from './VarianceTrendChart.jsx';
import { AmendmentActivityLog } from './AmendmentActivityLog.jsx';
import { AgentHeatmap } from './AgentHeatmap.jsx';
// Phase 5E widgets
import { AutonomyStatusPanel } from './AutonomyStatusPanel.jsx';
import { ExceptionQueueWidget } from './ExceptionQueueWidget.jsx';
import { CoSHealthIndicator } from './CoSHealthIndicator.jsx';
import { BakingActivityWidget } from './BakingActivityWidget.jsx';
// Phase 6A widgets
import { TeamOverviewPanel } from './TeamOverviewPanel.jsx';
import { TeamDrillDown } from './TeamDrillDown.jsx';
import { TeamLeadActivityLog } from './TeamLeadActivityLog.jsx';
import { TeamHeatmap } from './TeamHeatmap.jsx';
// Phase 6B widgets
import { KnowledgeBotPanel } from './KnowledgeBotPanel.jsx';
import { RecommendationQueue } from './RecommendationQueue.jsx';
import { LearningInsightsPanel } from './LearningInsightsPanel.jsx';
import { ResearchLogPanel } from './ResearchLogPanel.jsx';
// Phase 6C widgets
import { TechTeamPanel } from './TechTeamPanel.jsx';
// Phase 6D widgets
import { MarketingTeamPanel } from './MarketingTeamPanel.jsx';
// Phase 6E widgets
import { ProductTeamPanel } from './ProductTeamPanel.jsx';
// Phase 6F widgets
import { OperationsTeamPanel } from './OperationsTeamPanel.jsx';
// Phase 6G widgets
import { FinanceTeamPanel } from './FinanceTeamPanel.jsx';
// Phase 6H widgets
import { PeopleTeamPanel } from './PeopleTeamPanel.jsx';
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
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedBot, setSelectedBot] = useState(null);
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

  const handleTeamSelect = (team) => {
    setSelectedTeam(team);
  };

  const handleTeamBack = () => {
    setSelectedTeam(null);
  };

  const handleBotSelect = (bot) => {
    setSelectedBot(bot);
  };

  const handleRecommendationSelect = (recommendation) => {
    // Handle recommendation selection - can be used to trigger amendment creation
    console.log('Selected recommendation:', recommendation);
  };

  return (
    <div className="neural-stack-container">
      <DashboardHeader
        selectedAgent={selectedAgent}
        onAgentClear={handleAgentClear}
        lastUpdated={lastUpdated}
      />

      <main className="neural-stack-main">
        {/* Phase 5E: Autonomy Status Row */}
        <section className="neural-stack-section autonomy-section">
          <div className="section-grid three-columns">
            <AutonomyStatusPanel />
            <CoSHealthIndicator />
            <ExceptionQueueWidget />
          </div>
        </section>

        {/* Phase 6C: Tech Team Panel (First Deployed Team) */}
        <section className="neural-stack-section tech-team-section">
          <TechTeamPanel />
        </section>

        {/* Phase 6D: Marketing Team Panel */}
        <section className="neural-stack-section marketing-team-section">
          <MarketingTeamPanel />
        </section>

        {/* Phase 6E: Product Team Panel */}
        <section className="neural-stack-section product-team-section">
          <ProductTeamPanel />
        </section>

        {/* Phase 6F: Operations Team Panel */}
        <section className="neural-stack-section operations-team-section">
          <OperationsTeamPanel />
        </section>

        {/* Phase 6G: Finance Team Panel */}
        <section className="neural-stack-section finance-team-section">
          <FinanceTeamPanel />
        </section>

        {/* Phase 6H: People Team Panel */}
        <section className="neural-stack-section people-team-section">
          <PeopleTeamPanel />
        </section>

        {/* Phase 6A: Team Hierarchy Section */}
        <section className="neural-stack-section team-section">
          {selectedTeam ? (
            <TeamDrillDown team={selectedTeam} onBack={handleTeamBack} />
          ) : (
            <TeamOverviewPanel onTeamSelect={handleTeamSelect} />
          )}
        </section>

        {/* Phase 6B: Knowledge Bots Section */}
        <section className="neural-stack-section knowledge-bots-section">
          <KnowledgeBotPanel onBotSelect={handleBotSelect} />
        </section>

        {/* Phase 6B: Recommendation Queue Section */}
        <section className="neural-stack-section recommendation-queue-section">
          <RecommendationQueue onSelectRecommendation={handleRecommendationSelect} />
        </section>

        {/* Top Row: Agent Health + Financial Escalations */}
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

        {/* Phase 6B: Learning Insights Section */}
        <section className="neural-stack-section learning-insights-section">
          <LearningInsightsPanel />
        </section>

        {/* Phase 5E: Baking Activity Row */}
        <section className="neural-stack-section baking-section">
          <div className="section-grid full-width">
            <BakingActivityWidget limit={10} />
          </div>
        </section>

        {/* Phase 6B: Research Log Section */}
        <section className="neural-stack-section research-log-section">
          <ResearchLogPanel />
        </section>

        {/* Phase 6A: Team Lead Activity Log */}
        <section className="neural-stack-section activity-log-section">
          <div className="section-grid full-width">
            <TeamLeadActivityLog limit={30} />
          </div>
        </section>

        {/* Phase 6A: Team Heatmap */}
        <section className="neural-stack-section team-heatmap-section">
          <TeamHeatmap onTeamSelect={handleTeamSelect} />
        </section>

        {/* Bottom Row: Agent Heatmap */}
        <section className="neural-stack-section bottom-section">
          <AgentHeatmap
            metrics={['variance', 'cos_score', 'success_rate', 'avg_time_min', 'amendments']}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="neural-stack-footer">
        <div className="footer-left">
          <span>Monolith System v6.5</span>
          <span className="separator">|</span>
          <span>Phase 6H All Teams Deployed</span>
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
  // Phase 5E widgets
  AutonomyStatusPanel,
  ExceptionQueueWidget,
  CoSHealthIndicator,
  BakingActivityWidget,
  // Phase 6A widgets
  TeamOverviewPanel,
  TeamDrillDown,
  TeamLeadActivityLog,
  TeamHeatmap,
  // Phase 6B widgets
  KnowledgeBotPanel,
  RecommendationQueue,
  LearningInsightsPanel,
  ResearchLogPanel,
  // Phase 6C widgets
  TechTeamPanel,
  // Phase 6D widgets
  MarketingTeamPanel,
  // Phase 6E widgets
  ProductTeamPanel,
  // Phase 6F widgets
  OperationsTeamPanel,
  // Phase 6G widgets
  FinanceTeamPanel,
  // Phase 6H widgets
  PeopleTeamPanel,
};

export default NeuralStackDashboard;
