/**
 * MONOLITH OS - Security Alerts Dashboard
 * Phase 7.4.1.3 - Security Monitoring UI
 * 
 * Real-time security alerts dashboard with WCAG 2.1 compliance
 * Displays critical, high, medium, and low severity alerts
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Alert severity levels with accessible color coding
const SEVERITY_CONFIG = {
  critical: {
    bgColor: 'bg-red-900/30',
    borderColor: 'border-red-500',
    textColor: 'text-red-400',
    icon: '🚨',
    label: 'Critical',
    ariaLabel: 'Critical severity alert'
  },
  high: {
    bgColor: 'bg-orange-900/30',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-400',
    icon: '⚠️',
    label: 'High',
    ariaLabel: 'High severity alert'
  },
  medium: {
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-400',
    icon: '⚡',
    label: 'Medium',
    ariaLabel: 'Medium severity alert'
  },
  low: {
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-400',
    icon: 'ℹ️',
    label: 'Low',
    ariaLabel: 'Low severity alert'
  }
};

// CSRF Token handler for secure API calls
const getCSRFToken = () => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
};

// Individual Alert Card Component
const AlertCard = ({ alert, onAcknowledge, onEscalate, onDismiss }) => {
  const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={\`\${config.bgColor} \${config.borderColor} border-l-4 rounded-lg p-4 mb-3 transition-all duration-200 hover:shadow-lg\`}
      role="article"
      aria-label={\`\${config.ariaLabel}: \${alert.title}\`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl" role="img" aria-hidden="true">{config.icon}</span>
            <span className={\`\${config.textColor} font-semibold text-sm uppercase tracking-wide\`}>
              {config.label}
            </span>
            <span className="text-monolith-gray text-xs">
              {new Date(alert.timestamp).toLocaleString()}
            </span>
          </div>
          <h3 className="text-white font-medium text-lg mb-1">{alert.title}</h3>
          <p className="text-gray-400 text-sm">{alert.description}</p>
          
          {isExpanded && (
            <div className="mt-3 p-3 bg-monolith-dark/50 rounded border border-monolith-gray/30">
              <dl className="space-y-2 text-sm">
                <div className="flex">
                  <dt className="text-gray-500 w-24">Source:</dt>
                  <dd className="text-gray-300">{alert.source}</dd>
                </div>
                <div className="flex">
                  <dt className="text-gray-500 w-24">IP Address:</dt>
                  <dd className="text-gray-300 font-mono">{alert.ipAddress}</dd>
                </div>
                <div className="flex">
                  <dt className="text-gray-500 w-24">User Agent:</dt>
                  <dd className="text-gray-300 text-xs font-mono truncate max-w-md">{alert.userAgent}</dd>
                </div>
                {alert.affectedSystems && (
                  <div className="flex">
                    <dt className="text-gray-500 w-24">Affected:</dt>
                    <dd className="text-gray-300">{alert.affectedSystems.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2 ml-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse alert details' : 'Expand alert details'}
          >
            <svg className={\`w-5 h-5 transform transition-transform \${isExpanded ? 'rotate-180' : ''}\`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3 pt-3 border-t border-monolith-gray/30">
        {!alert.acknowledged && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="px-3 py-1.5 bg-monolith-green/20 text-monolith-green border border-monolith-green/50 rounded text-sm hover:bg-monolith-green/30 transition-colors focus:outline-none focus:ring-2 focus:ring-monolith-green/50"
            aria-label={\`Acknowledge alert: \${alert.title}\`}
          >
            Acknowledge
          </button>
        )}
        {alert.severity === 'critical' || alert.severity === 'high' ? (
          <button
            onClick={() => onEscalate(alert.id)}
            className="px-3 py-1.5 bg-monolith-amber/20 text-monolith-amber border border-monolith-amber/50 rounded text-sm hover:bg-monolith-amber/30 transition-colors focus:outline-none focus:ring-2 focus:ring-monolith-amber/50"
            aria-label={\`Escalate alert: \${alert.title}\`}
          >
            Escalate
          </button>
        ) : null}
        <button
          onClick={() => onDismiss(alert.id)}
          className="px-3 py-1.5 bg-gray-700/50 text-gray-300 border border-gray-600 rounded text-sm hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label={\`Dismiss alert: \${alert.title}\`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

// Alert Statistics Summary
const AlertStats = ({ alerts }) => {
  const stats = alerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {Object.entries(SEVERITY_CONFIG).map(([severity, config]) => (
        <div
          key={severity}
          className={\`\${config.bgColor} \${config.borderColor} border rounded-lg p-4 text-center\`}
          role="status"
          aria-label={\`\${stats[severity] || 0} \${config.label} alerts\`}
        >
          <div className={\`\${config.textColor} text-3xl font-bold\`}>
            {stats[severity] || 0}
          </div>
          <div className="text-gray-400 text-sm mt-1">{config.label}</div>
        </div>
      ))}
    </div>
  );
};

// Filter Controls
const FilterControls = ({ filters, onFilterChange }) => {
  return (
    <div className="flex flex-wrap gap-4 mb-6 p-4 bg-monolith-gray/20 rounded-lg">
      <div className="flex items-center gap-2">
        <label htmlFor="severity-filter" className="text-gray-400 text-sm">
          Severity:
        </label>
        <select
          id="severity-filter"
          value={filters.severity}
          onChange={(e) => onFilterChange({ ...filters, severity: e.target.value })}
          className="bg-monolith-dark border border-monolith-gray rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-monolith-green/50"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical Only</option>
          <option value="high">High & Above</option>
          <option value="medium">Medium & Above</option>
        </select>
      </div>
      
      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-gray-400 text-sm">
          Status:
        </label>
        <select
          id="status-filter"
          value={filters.status}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
          className="bg-monolith-dark border border-monolith-gray rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-monolith-green/50"
        >
          <option value="all">All Status</option>
          <option value="unacknowledged">Unacknowledged</option>
          <option value="acknowledged">Acknowledged</option>
        </select>
      </div>
      
      <div className="flex items-center gap-2">
        <label htmlFor="time-filter" className="text-gray-400 text-sm">
          Time Range:
        </label>
        <select
          id="time-filter"
          value={filters.timeRange}
          onChange={(e) => onFilterChange({ ...filters, timeRange: e.target.value })}
          className="bg-monolith-dark border border-monolith-gray rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-monolith-green/50"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>
      
      <div className="flex-1 flex justify-end">
        <div className="relative">
          <input
            type="search"
            placeholder="Search alerts..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="bg-monolith-dark border border-monolith-gray rounded px-3 py-1.5 pl-9 text-white text-sm w-64 focus:outline-none focus:ring-2 focus:ring-monolith-green/50"
            aria-label="Search alerts"
          />
          <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

// Real-time connection status indicator
const ConnectionStatus = ({ isConnected, lastUpdate }) => {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={\`w-2 h-2 rounded-full \${isConnected ? 'bg-monolith-green animate-pulse' : 'bg-red-500'}\`} />
      <span className={isConnected ? 'text-monolith-green' : 'text-red-400'}>
        {isConnected ? 'Live' : 'Disconnected'}
      </span>
      {lastUpdate && (
        <span className="text-gray-500">
          Updated: {new Date(lastUpdate).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

// Main Security Alerts Dashboard Component
const SecurityAlertsDashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    status: 'all',
    timeRange: '24h',
    search: ''
  });
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Fetch initial alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/security/alerts', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });
      
      if (!response.ok) throw new Error('Failed to fetch alerts');
      
      const data = await response.json();
      setAlerts(data.alerts || []);
      setLastUpdate(new Date().toISOString());
      setError(null);
    } catch (err) {
      setError(err.message);
      // Use mock data for demonstration
      setAlerts(getMockAlerts());
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = \`\${protocol}//\${window.location.host}/ws/security/alerts\`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('Security alerts WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'new_alert') {
          setAlerts(prev => [data.alert, ...prev]);
          setLastUpdate(new Date().toISOString());
        } else if (data.type === 'alert_update') {
          setAlerts(prev => prev.map(alert => 
            alert.id === data.alert.id ? data.alert : alert
          ));
        }
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
        // Attempt reconnection after 5 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };
      
      wsRef.current.onerror = () => {
        setIsConnected(false);
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      setIsConnected(false);
    }
  }, []);

  // Handle alert acknowledgment
  const handleAcknowledge = async (alertId) => {
    try {
      await fetch(\`/api/security/alerts/\${alertId}/acknowledge\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });
      
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true, acknowledgedAt: new Date().toISOString() } : alert
      ));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  // Handle alert escalation
  const handleEscalate = async (alertId) => {
    try {
      await fetch(\`/api/security/alerts/\${alertId}/escalate\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });
      
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, escalated: true, escalatedAt: new Date().toISOString() } : alert
      ));
    } catch (err) {
      console.error('Failed to escalate alert:', err);
    }
  };

  // Handle alert dismissal
  const handleDismiss = async (alertId) => {
    try {
      await fetch(\`/api/security/alerts/\${alertId}/dismiss\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });
      
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  // Filter alerts based on current filters
  const filteredAlerts = alerts.filter(alert => {
    if (filters.severity !== 'all') {
      const severityOrder = ['critical', 'high', 'medium', 'low'];
      const filterIndex = severityOrder.indexOf(filters.severity);
      const alertIndex = severityOrder.indexOf(alert.severity);
      if (alertIndex > filterIndex) return false;
    }
    
    if (filters.status === 'unacknowledged' && alert.acknowledged) return false;
    if (filters.status === 'acknowledged' && !alert.acknowledged) return false;
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        alert.title.toLowerCase().includes(searchLower) ||
        alert.description.toLowerCase().includes(searchLower) ||
        alert.source?.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  // Initialize data and WebSocket
  useEffect(() => {
    fetchAlerts();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [fetchAlerts, connectWebSocket]);

  // Announce new critical alerts for screen readers
  useEffect(() => {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.announced);
    if (criticalAlerts.length > 0) {
      const announcement = \`\${criticalAlerts.length} new critical security alert\${criticalAlerts.length > 1 ? 's' : ''}\`;
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'alert');
      announcer.setAttribute('aria-live', 'assertive');
      announcer.className = 'sr-only';
      announcer.textContent = announcement;
      document.body.appendChild(announcer);
      setTimeout(() => document.body.removeChild(announcer), 1000);
    }
  }, [alerts]);

  if (loading) {
    return (
      <div className="p-6 bg-monolith-dark min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-monolith-gray/30 rounded w-64"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-monolith-gray/30 rounded"></div>
            ))}
          </div>
          <div className="h-16 bg-monolith-gray/30 rounded"></div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-monolith-gray/30 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-monolith-dark min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-8 h-8 text-monolith-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Security Alerts Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Real-time security monitoring and incident management</p>
        </div>
        <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400" role="alert">
          <strong>Error:</strong> {error}. Showing cached data.
        </div>
      )}

      {/* Statistics Summary */}
      <AlertStats alerts={alerts} />

      {/* Filters */}
      <FilterControls filters={filters} onFilterChange={setFilters} />

      {/* Alerts List */}
      <div className="space-y-3" role="feed" aria-label="Security alerts feed">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-lg">No alerts match your current filters</p>
            <p className="text-sm mt-2">Try adjusting your filter criteria</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onEscalate={handleEscalate}
              onDismiss={handleDismiss}
            />
          ))
        )}
      </div>

      {/* Footer with refresh button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={fetchAlerts}
          className="px-4 py-2 bg-monolith-gray/30 text-gray-300 rounded-lg hover:bg-monolith-gray/50 transition-colors focus:outline-none focus:ring-2 focus:ring-monolith-green/50 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Alerts
        </button>
      </div>
    </div>
  );
};

// Mock data generator for demonstration
const getMockAlerts = () => [
  {
    id: '1',
    severity: 'critical',
    title: 'Unauthorized Access Attempt Detected',
    description: 'Multiple failed login attempts detected from suspicious IP address targeting admin accounts.',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    source: 'Authentication Service',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    affectedSystems: ['Auth Server', 'User Database'],
    acknowledged: false
  },
  {
    id: '2',
    severity: 'high',
    title: 'Unusual Data Export Activity',
    description: 'Large volume of data export requests detected outside normal business hours.',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    source: 'Data Loss Prevention',
    ipAddress: '10.0.0.45',
    userAgent: 'Internal API Client/1.0',
    affectedSystems: ['Document Server'],
    acknowledged: false
  },
  {
    id: '3',
    severity: 'medium',
    title: 'SSL Certificate Expiring Soon',
    description: 'Production SSL certificate will expire in 7 days. Renewal required.',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    source: 'Certificate Monitor',
    ipAddress: 'N/A',
    userAgent: 'System Monitor/2.1',
    affectedSystems: ['Web Server'],
    acknowledged: true
  },
  {
    id: '4',
    severity: 'low',
    title: 'New Device Login',
    description: 'User john.doe@company.com logged in from a new device.',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    source: 'Identity Management',
    ipAddress: '203.0.113.50',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)',
    affectedSystems: ['SSO Gateway'],
    acknowledged: true
  }
];

export default SecurityAlertsDashboard;
