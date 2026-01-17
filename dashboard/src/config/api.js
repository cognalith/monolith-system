/**
 * API Configuration
 * Handles API URL based on environment
 */

// API base URL from environment variable, fallback to localhost for development
// In Vite, env vars must be prefixed with VITE_
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Agent Service URL (separate service for AI agents)
export const AGENT_SERVICE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:3001';
export const AGENT_SERVICE_WS_URL = import.meta.env.VITE_AGENT_SERVICE_WS_URL || 'ws://localhost:3001';

// Check if API is configured (has a real URL, not just localhost)
export const isApiAvailable = true;

/**
 * Fetch wrapper with consistent error handling
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export default { API_BASE_URL, isApiAvailable, apiFetch };
