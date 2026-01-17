/**
 * USE NEURAL STACK HOOK - Phase 5E
 * Cognalith Inc. | Monolith System
 *
 * Data fetching hook for Neural Stack dashboard components.
 * Provides real-time data with auto-refresh.
 *
 * PHASE 5E: Added autonomy hooks
 * - useExceptionEscalations
 * - useCoSHealth
 * - useBakedAmendments
 * - useAutonomyStats
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config/api.js';

const REFRESH_INTERVAL = 30000; // 30 seconds

/**
 * Fetch wrapper with error handling
 */
async function fetchNeuralStack(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/neural-stack${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[useNeuralStack] Error fetching ${endpoint}:`, error);
    throw error;
  }
}

/**
 * POST request wrapper
 */
async function postNeuralStack(endpoint, data) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/neural-stack${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[useNeuralStack] Error posting to ${endpoint}:`, error);
    throw error;
  }
}

// ============================================================================
// AGENT HEALTH HOOK
// ============================================================================

export function useAgentHealth(autoRefresh = true) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await fetchNeuralStack('/agent-health');
      setAgents(data.agents || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Use mock data on error
      setAgents(getMockAgentHealth());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchHealth, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchHealth, autoRefresh]);

  return { agents, loading, error, refresh: fetchHealth };
}

// ============================================================================
// VARIANCE TREND HOOK
// ============================================================================

export function useVarianceTrend(agentRole, limit = 50) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrend = useCallback(async () => {
    if (!agentRole) return;

    setLoading(true);
    try {
      const result = await fetchNeuralStack(`/variance-trend/${agentRole}?limit=${limit}`);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
      setData(getMockVarianceTrend(agentRole));
    } finally {
      setLoading(false);
    }
  }, [agentRole, limit]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  return { data, loading, error, refresh: fetchTrend };
}

// ============================================================================
// PENDING ESCALATIONS HOOK
// ============================================================================

export function usePendingEscalations(autoRefresh = true) {
  const [escalations, setEscalations] = useState([]);
  const [monthlySpend, setMonthlySpend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchEscalations = useCallback(async () => {
    try {
      const data = await fetchNeuralStack('/escalations/pending');
      setEscalations(data.pending || []);
      setMonthlySpend(data.monthly_spend);
      setError(null);
    } catch (err) {
      setError(err.message);
      setEscalations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const decideEscalation = useCallback(async (id, decision, notes = '', modifiedAction = '', resumeInstructions = '') => {
    try {
      const result = await postNeuralStack(`/escalations/${id}/decide`, {
        decision,
        notes,
        modified_action: modifiedAction,
        resume_instructions: resumeInstructions,
      });
      // Refresh list after decision
      await fetchEscalations();
      return result;
    } catch (err) {
      throw err;
    }
  }, [fetchEscalations]);

  useEffect(() => {
    fetchEscalations();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchEscalations, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchEscalations, autoRefresh]);

  return {
    escalations,
    monthlySpend,
    loading,
    error,
    refresh: fetchEscalations,
    decide: decideEscalation,
    count: escalations.length,
  };
}

// ============================================================================
// AMENDMENT ACTIVITY HOOK
// ============================================================================

export function useAmendmentActivity(limit = 30, autoRefresh = true) {
  const [amendments, setAmendments] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchActivity = useCallback(async () => {
    try {
      const data = await fetchNeuralStack(`/amendments/recent?limit=${limit}`);
      setAmendments(data.amendments || []);
      setPatterns(data.patterns || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setAmendments([]);
      setPatterns([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const approveAmendment = useCallback(async (id, notes = '') => {
    try {
      const result = await postNeuralStack(`/amendments/${id}/approve`, { notes });
      await fetchActivity();
      return result;
    } catch (err) {
      throw err;
    }
  }, [fetchActivity]);

  const rejectAmendment = useCallback(async (id, reason = '') => {
    try {
      const result = await postNeuralStack(`/amendments/${id}/reject`, { reason });
      await fetchActivity();
      return result;
    } catch (err) {
      throw err;
    }
  }, [fetchActivity]);

  useEffect(() => {
    fetchActivity();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchActivity, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchActivity, autoRefresh]);

  return {
    amendments,
    patterns,
    loading,
    error,
    refresh: fetchActivity,
    approve: approveAmendment,
    reject: rejectAmendment,
  };
}

// ============================================================================
// HEATMAP DATA HOOK
// ============================================================================

export function useHeatmapData(autoRefresh = false) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHeatmap = useCallback(async () => {
    try {
      const result = await fetchNeuralStack('/heatmap');
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
      setData(getMockHeatmapData());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  return { data, loading, error, refresh: fetchHeatmap };
}

// ============================================================================
// PHASE 5E: EXCEPTION ESCALATIONS HOOK
// ============================================================================

export function useExceptionEscalations(autoRefresh = true) {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchEscalations = useCallback(async () => {
    try {
      const data = await fetchNeuralStack('/exception-escalations');
      setEscalations(data.escalations || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setEscalations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveEscalation = useCallback(async (id, resolution, notes = '') => {
    try {
      const result = await postNeuralStack(`/exception-escalations/${id}/resolve`, {
        resolution,
        notes,
      });
      await fetchEscalations();
      return result;
    } catch (err) {
      throw err;
    }
  }, [fetchEscalations]);

  useEffect(() => {
    fetchEscalations();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchEscalations, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchEscalations, autoRefresh]);

  return {
    escalations,
    loading,
    error,
    refresh: fetchEscalations,
    resolve: resolveEscalation,
    count: escalations.length,
  };
}

// ============================================================================
// PHASE 5E: COS HEALTH HOOK
// ============================================================================

export function useCoSHealth(autoRefresh = true) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await fetchNeuralStack('/cos-health');
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Fallback mock data
      setHealth({
        current: { success_rate: 75, sample_size: 0, successes: 0, failures: 0 },
        alert: { triggered: false, threshold: 50, min_sample_size: 10 },
        active_alerts: [],
        trend: [],
        hardcoded_constraints: {
          alert_threshold: '50%',
          window_size: 20,
          min_for_alert: 10,
          note: 'These values are hardcoded and cannot be modified by CoS',
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const acknowledgeAlert = useCallback(async (id, notes = '') => {
    try {
      const result = await postNeuralStack(`/cos-health/acknowledge-alert/${id}`, { notes });
      await fetchHealth();
      return result;
    } catch (err) {
      throw err;
    }
  }, [fetchHealth]);

  useEffect(() => {
    fetchHealth();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchHealth, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchHealth, autoRefresh]);

  return {
    health,
    loading,
    error,
    refresh: fetchHealth,
    acknowledgeAlert,
    alertTriggered: health?.alert?.triggered || false,
  };
}

// ============================================================================
// PHASE 5E: BAKED AMENDMENTS HOOK
// ============================================================================

export function useBakedAmendments(agentRole = null, limit = 50) {
  const [baked, setBaked] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBaked = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (agentRole) params.append('agent', agentRole);
      const data = await fetchNeuralStack(`/baked-amendments?${params}`);
      setBaked(data.baked || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err.message);
      setBaked([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [agentRole, limit]);

  useEffect(() => {
    fetchBaked();
  }, [fetchBaked]);

  return {
    baked,
    stats,
    loading,
    error,
    refresh: fetchBaked,
  };
}

// ============================================================================
// PHASE 5E: AUTONOMY STATS HOOK
// ============================================================================

export function useAutonomyStats(autoRefresh = true) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await fetchNeuralStack('/autonomy-stats');
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Fallback mock data
      setStats({
        overall: {
          total_amendments: 0,
          autonomous: 0,
          escalated: 0,
          pending_approval: 0,
          approved: 0,
          rejected: 0,
          autonomy_rate: 100,
        },
        recent_24h: { total: 0, autonomous: 0, escalated: 0 },
        by_agent: {},
        escalation_reasons: {},
        total_escalations: 0,
        pending_escalations: 0,
        total_reversions: 0,
        autonomy_mode: {
          status: 'active',
          description: 'CoS operates autonomously for standard Knowledge layer amendments',
          exceptions: [
            'Skills layer modifications',
            'Persona layer modifications',
            '3+ consecutive failures',
            'Cross-agent decline patterns',
          ],
        },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchStats, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStats, autoRefresh]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}

// ============================================================================
// PHASE 5E: REVERT LOG HOOK
// ============================================================================

export function useRevertLog(limit = 50) {
  const [reversions, setReversions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReversions = useCallback(async () => {
    try {
      const data = await fetchNeuralStack(`/revert-log?limit=${limit}`);
      setReversions(data.reversions || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setReversions([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchReversions();
  }, [fetchReversions]);

  return {
    reversions,
    loading,
    error,
    refresh: fetchReversions,
  };
}

// ============================================================================
// MOCK DATA (for development/fallback)
// ============================================================================

function getMockAgentHealth() {
  const roles = ['ceo', 'cfo', 'cto', 'coo', 'cmo', 'chro', 'clo', 'ciso', 'cos', 'cco', 'cpo', 'cro', 'devops', 'data', 'qa'];
  return roles.map(role => ({
    agent_role: role,
    avg_variance_percent: Math.round(Math.random() * 30 * 10) / 10,
    avg_cos_score: Math.round((0.6 + Math.random() * 0.35) * 100) / 100,
    success_rate: Math.round(70 + Math.random() * 30),
    trend: ['improving', 'stable', 'declining'][Math.floor(Math.random() * 3)],
    status: ['healthy', 'attention', 'declining'][Math.floor(Math.random() * 3)],
    active_amendments: Math.floor(Math.random() * 5),
    tasks_completed: Math.floor(Math.random() * 100) + 10,
    last_active: new Date().toISOString(),
  }));
}

function getMockVarianceTrend(agentRole) {
  const tasks = [];
  let variance = 15;
  for (let i = 0; i < 30; i++) {
    variance = Math.max(0, Math.min(50, variance + (Math.random() - 0.5) * 10));
    tasks.push({
      task_id: `task-${i}`,
      title: `Task ${i + 1}`,
      variance_percent: variance,
      cos_score: 0.7 + Math.random() * 0.25,
      completed_at: new Date(Date.now() - (30 - i) * 86400000).toISOString(),
      success: Math.random() > 0.2,
    });
  }
  return {
    agent_role: agentRole,
    tasks,
    amendments: [],
    trend_line: { slope: -0.3, intercept: 20, direction: 'improving' },
    data_points: tasks.length,
  };
}

function getMockHeatmapData() {
  const roles = ['CEO', 'CFO', 'CTO', 'COO', 'CMO', 'CHRO', 'CLO', 'CISO', 'COS', 'CCO', 'CPO', 'CRO', 'DEVOPS', 'DATA', 'QA'];
  return {
    agents: roles.map(agent => ({
      agent,
      variance: Math.round(Math.random() * 30 * 10) / 10,
      cos_score: Math.round((0.6 + Math.random() * 0.35) * 100) / 100,
      success_rate: Math.round(70 + Math.random() * 30),
      avg_time_min: Math.round(Math.random() * 60),
      amendments: Math.floor(Math.random() * 5),
      tasks: Math.floor(Math.random() * 50) + 5,
    })),
    metrics: ['variance', 'cos_score', 'success_rate', 'avg_time_min', 'amendments'],
  };
}

// Default export with all hooks
export default {
  useAgentHealth,
  useVarianceTrend,
  usePendingEscalations,
  useAmendmentActivity,
  useHeatmapData,
  // Phase 5E hooks
  useExceptionEscalations,
  useCoSHealth,
  useBakedAmendments,
  useAutonomyStats,
  useRevertLog,
};
