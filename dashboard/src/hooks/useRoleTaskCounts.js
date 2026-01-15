/**
 * useRoleTaskCounts Hook
 * Fetches and maintains task counts per role for notification badges.
 * Includes auto-refresh capability and mock data fallback.
 */
import { useState, useEffect, useCallback } from 'react';
import { ROLES } from '../config/roleHierarchy';
import { apiFetch, isApiAvailable } from '../config/api';

// Mock data for development (until backend API is ready)
const generateMockTaskCounts = () => {
  const counts = {};

  // Generate random task counts for some roles
  // C-Suite typically has fewer pending tasks (they delegate)
  // Lower tiers have more pending tasks
  ROLES.forEach((role) => {
    let baseCount = 0;

    switch (role.tier) {
      case 1: // C-Suite
        baseCount = Math.floor(Math.random() * 5); // 0-4 tasks
        break;
      case 2: // Chiefs
        baseCount = Math.floor(Math.random() * 8); // 0-7 tasks
        break;
      case 3: // VPs
        baseCount = Math.floor(Math.random() * 12); // 0-11 tasks
        break;
      case 4: // Directors
        baseCount = Math.floor(Math.random() * 15); // 0-14 tasks
        break;
      case 5: // Managers & Specialists
        baseCount = Math.floor(Math.random() * 10); // 0-9 tasks
        break;
      default:
        baseCount = 0;
    }

    counts[role.id] = baseCount;
  });

  // Ensure some specific roles have meaningful counts for demo
  counts['ceo'] = 2;
  counts['cfo'] = 5;
  counts['cto'] = 8;
  counts['ciso'] = 3;
  counts['chief-of-staff'] = 12;
  counts['chief-compliance-officer'] = 4;
  counts['vp-eng'] = 7;
  counts['vp-product'] = 6;

  return counts;
};

/**
 * Custom hook for fetching role task counts
 * @param {Object} options - Hook options
 * @param {number} options.refreshInterval - Auto-refresh interval in ms (default: 30000)
 * @param {boolean} options.enabled - Whether to enable fetching (default: true)
 * @returns {Object} - { taskCounts, loading, error, refetch }
 */
const useRoleTaskCounts = ({ refreshInterval = 30000, enabled = true } = {}) => {
  const [taskCounts, setTaskCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch task counts from API
  const fetchTaskCounts = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      const data = await apiFetch('/api/role-task-counts');
      setTaskCounts(data.counts || {});
      setError(null);
    } catch (err) {
      console.warn('API failed for role task counts:', err.message);
      setTaskCounts({});
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchTaskCounts();
    }
  }, [enabled, fetchTaskCounts]);

  // Auto-refresh
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;

    const interval = setInterval(fetchTaskCounts, refreshInterval);
    return () => clearInterval(interval);
  }, [enabled, refreshInterval, fetchTaskCounts]);

  // Get task count for a specific role
  const getTaskCount = useCallback(
    (roleId) => {
      return taskCounts[roleId] || 0;
    },
    [taskCounts]
  );

  // Get total pending tasks across all roles
  const getTotalPendingTasks = useCallback(() => {
    return Object.values(taskCounts).reduce((sum, count) => sum + count, 0);
  }, [taskCounts]);

  // Get roles with tasks, sorted by count (descending)
  const getRolesWithTasks = useCallback(() => {
    return Object.entries(taskCounts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([roleId, count]) => ({ roleId, count }));
  }, [taskCounts]);

  return {
    taskCounts,
    loading,
    error,
    refetch: fetchTaskCounts,
    getTaskCount,
    getTotalPendingTasks,
    getRolesWithTasks,
  };
};

export default useRoleTaskCounts;
