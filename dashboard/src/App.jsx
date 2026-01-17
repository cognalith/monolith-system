/**
 * APP - Phase 5D Enhanced
 * Cognalith Inc. | Monolith System
 *
 * Main application with tab navigation for CEO Dashboard and Neural Stack.
 */

import { useState } from 'react';
import CEODashboard from './components/CEODashboard';
import NeuralStackDashboard from './components/NeuralStack';
import './App.css';

const VIEWS = {
  CEO: 'ceo',
  NEURAL: 'neural',
};

function App() {
  const [activeView, setActiveView] = useState(VIEWS.CEO);

  return (
    <div className="app-container">
      {/* Global Navigation */}
      <nav className="app-nav">
        <div className="nav-brand">
          <span className="nav-icon">◈</span>
          <span className="nav-title">MONOLITH</span>
        </div>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeView === VIEWS.CEO ? 'active' : ''}`}
            onClick={() => setActiveView(VIEWS.CEO)}
          >
            CEO Dashboard
          </button>
          <button
            className={`nav-tab ${activeView === VIEWS.NEURAL ? 'active' : ''}`}
            onClick={() => setActiveView(VIEWS.NEURAL)}
          >
            Neural Stack
          </button>
        </div>
        <div className="nav-user">
          <span className="user-name">Frank</span>
          <span className="user-role">CEO</span>
        </div>
      </nav>

      {/* View Content */}
      <main className="app-content">
        {activeView === VIEWS.CEO && <CEODashboard />}
        {activeView === VIEWS.NEURAL && <NeuralStackDashboard />}
      </main>
    </div>
  );
}

export default App;
