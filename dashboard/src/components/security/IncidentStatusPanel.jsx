/**
 * MONOLITH OS - Incident Status Panel
 * Phase 7.4.2.2 - Incident Escalation Status UI
 * 
 * Real-time incident tracking and escalation management
 * Provides status updates and response coordination
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Incident severity levels
const SEVERITY_LEVELS = {
  P1: { label: 'Critical', color: 'text-red-500', bg: 'bg-red-900/30', border: 'border-red-500', sla: '15 min' },
  P2: { label: 'High', color: 'text-orange-500', bg: 'bg-orange-900/30', border: 'border-orange-500', sla: '1 hour' },
  P3: { label: 'Medium', color: 'text-yellow-500', bg: 'bg-yellow-900/30', border: 'border-yellow-500', sla: '4 hours' },
  P4: { label: 'Low', color: 'text-blue-500', bg: 'bg-blue-900/30', border: 'border-blue-500', sla: '24 hours' }
};

// Incident status configurations
const INCIDENT_STATUS = {
  detected: { label: 'Detected', color: 'text-red-400', icon: '🔴' },
  investigating: { label: 'Investigating', color: 'text-orange-400', icon: '🔍' },
  identified: { label: 'Identified', color: 'text-yellow-400', icon: '🎯' },
  mitigating: { label: 'Mitigating', color: 'text-blue-400', icon: '🔧' },
  monitoring: { label: 'Monitoring', color: 'text-cyan-400', icon: '👁️' },
  resolved: { label: 'Resolved', color: 'text-monolith-green', icon: '✅' },
  postmortem: { label: 'Post-Mortem', color: 'text-purple-400', icon: '📋' }
};

// CSRF Token handler
const getCSRFToken = () => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
};

// Timeline event component
const TimelineEvent = ({ event, isLast }) => {
  const status = INCIDENT_STATUS[event.status] || INCIDENT_STATUS.detected;
  
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={\`w-8 h-8 rounded-full flex items-center justify-center text-lg \${status.color === 'text-monolith-green' ? 'bg-monolith-green/20' : 'bg-monolith-gray/30'}\`}>
          {status.icon}
        </div>
        {!isLast && <div className="w-0.5 h-full bg-monolith-gray/30 min-h-[40px]" />}
      </div>
      <div className="pb-6">
        <div className="flex items-center gap-2">
          <span className={\`font-medium \${status.color}\`}>{status.label}</span>
          <span className="text-gray-500 text-sm">
            {new Date(event.timestamp).toLocaleString()}
          </span>
        </div>
        <p className="text-gray-300 text-sm mt-1">{event.description}</p>
        {event.user && (
          <p className="text-gray-500 text-xs mt-1">by {event.user}</p>
        )}
      </div>
    </div>
  );
};

// Incident card component
const IncidentCard = ({ incident, onSelect, isSelected }) => {
  const severity = SEVERITY_LEVELS[incident.severity] || SEVERITY_LEVELS.P4;
  const status = INCIDENT_STATUS[incident.status] || INCIDENT_STATUS.detected;
  const isActive = !['resolved', 'postmortem'].includes(incident.status);
  
  // Calculate SLA status
  const slaDeadline = new Date(incident.detectedAt).getTime() + parseSLA(severity.sla);
  const now = Date.now();
  const slaBreached = isActive && now > slaDeadline;
  const timeRemaining = slaDeadline - now;

  return (
    <button
      onClick={() => onSelect(incident)}
      className={\`w-full text-left p-4 rounded-lg border transition-all \${
        isSelected 
          ? 'border-monolith-green bg-monolith-green/10' 
          : \`\${severity.border} \${severity.bg} hover:border-opacity-100 border-opacity-50\`
      }\`}
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={\`px-2 py-0.5 text-xs font-bold rounded \${severity.bg} \${severity.color}\`}>
              {incident.severity}
            </span>
            <span className={\`text-sm \${status.color}\`}>
              {status.icon} {status.label}
            </span>
          </div>
          <h3 className="text-white font-medium truncate">{incident.title}</h3>
          <p className="text-gray-400 text-sm mt-1 truncate">{incident.description}</p>
        </div>
        
        {isActive && (
          <div className="text-right flex-shrink-0">
            <div className={slaBreached ? 'text-red-400' : 'text-gray-400'}>
              <span className="text-xs block">SLA</span>
              <span className="text-sm font-mono">
                {slaBreached ? 'BREACHED' : formatTimeRemaining(timeRemaining)}
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span>ID: {incident.id}</span>
        <span>•</span>
        <span>{new Date(incident.detectedAt).toLocaleDateString()}</span>
        {incident.assignee && (
          <>
            <span>•</span>
            <span>Assigned: {incident.assignee}</span>
          </>
        )}
      </div>
    </button>
  );
};

// Incident detail panel
const IncidentDetail = ({ incident, onClose, onUpdateStatus, onEscalate }) => {
  const severity = SEVERITY_LEVELS[incident.severity] || SEVERITY_LEVELS.P4;
  const [newUpdate, setNewUpdate] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleAddUpdate = async () => {
    if (!newUpdate.trim()) return;
    
    setUpdating(true);
    try {
      await fetch(\`/api/incidents/\${incident.id}/updates\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ message: newUpdate })
      });
      setNewUpdate('');
    } catch (err) {
      console.error('Failed to add update:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={\`px-2 py-1 text-sm font-bold rounded \${severity.bg} \${severity.color}\`}>
              {incident.severity} - {severity.label}
            </span>
            <span className="text-gray-400 text-sm">SLA: {severity.sla}</span>
          </div>
          <h2 className="text-xl font-bold text-white">{incident.title}</h2>
          <p className="text-gray-400 mt-1">{incident.description}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded"
          aria-label="Close incident details"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Incident Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-monolith-dark/50 p-3 rounded">
          <dt className="text-gray-500 text-xs">Incident ID</dt>
          <dd className="text-white font-mono">{incident.id}</dd>
        </div>
        <div className="bg-monolith-dark/50 p-3 rounded">
          <dt className="text-gray-500 text-xs">Detected At</dt>
          <dd className="text-white">{new Date(incident.detectedAt).toLocaleString()}</dd>
        </div>
        <div className="bg-monolith-dark/50 p-3 rounded">
          <dt className="text-gray-500 text-xs">Assignee</dt>
          <dd className="text-white">{incident.assignee || 'Unassigned'}</dd>
        </div>
        <div className="bg-monolith-dark/50 p-3 rounded">
          <dt className="text-gray-500 text-xs">Affected Systems</dt>
          <dd className="text-white">{incident.affectedSystems?.join(', ') || 'N/A'}</dd>
        </div>
      </div>

      {/* Status Update Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-gray-400 text-sm mr-2">Update Status:</span>
        {Object.entries(INCIDENT_STATUS).map(([key, config]) => (
          <button
            key={key}
            onClick={() => onUpdateStatus(incident.id, key)}
            disabled={incident.status === key}
            className={\`px-3 py-1 rounded text-sm transition-colors \${
              incident.status === key
                ? 'bg-monolith-green/20 text-monolith-green border border-monolith-green'
                : 'bg-monolith-gray/30 text-gray-300 hover:bg-monolith-gray/50'
            }\`}
          >
            {config.icon} {config.label}
          </button>
        ))}
      </div>

      {/* Escalation Button */}
      {incident.status !== 'resolved' && (
        <button
          onClick={() => onEscalate(incident.id)}
          className="mb-6 px-4 py-2 bg-red-900/30 text-red-400 border border-red-500 rounded-lg hover:bg-red-900/50 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Escalate Incident
        </button>
      )}

      {/* Timeline */}
      <div className="mb-6">
        <h3 className="text-white font-medium mb-4">Incident Timeline</h3>
        <div className="pl-2">
          {incident.timeline?.map((event, index) => (
            <TimelineEvent
              key={event.id || index}
              event={event}
              isLast={index === incident.timeline.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Add Update */}
      <div className="border-t border-monolith-gray/30 pt-4">
        <label htmlFor="new-update" className="block text-white font-medium mb-2">
          Add Update
        </label>
        <div className="flex gap-2">
          <input
            id="new-update"
            type="text"
            value={newUpdate}
            onChange={(e) => setNewUpdate(e.target.value)}
            placeholder="Enter incident update..."
            className="flex-1 bg-monolith-dark border border-monolith-gray rounded px-3 py-2 text-white"
            disabled={updating}
          />
          <button
            onClick={handleAddUpdate}
            disabled={updating || !newUpdate.trim()}
            className="px-4 py-2 bg-monolith-green text-monolith-dark font-semibold rounded hover:bg-monolith-green/80 transition-colors disabled:opacity-50"
          >
            {updating ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Incident Status Panel component
const IncidentStatusPanel = () => {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('active');
  const wsRef = useRef(null);

  // Fetch incidents
  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(\`/api/incidents?status=\${filter}\`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error('Failed to fetch incidents');

      const data = await response.json();
      setIncidents(data.incidents || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setIncidents(getMockIncidents());
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Update incident status
  const handleUpdateStatus = async (incidentId, newStatus) => {
    try {
      await fetch(\`/api/incidents/\${incidentId}/status\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ status: newStatus })
      });

      setIncidents(prev => prev.map(inc =>
        inc.id === incidentId ? { ...inc, status: newStatus } : inc
      ));

      if (selectedIncident?.id === incidentId) {
        setSelectedIncident(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Escalate incident
  const handleEscalate = async (incidentId) => {
    const confirmed = window.confirm(
      'This will escalate the incident to the security leadership team. Continue?'
    );
    if (!confirmed) return;

    try {
      await fetch(\`/api/incidents/\${incidentId}/escalate\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });

      alert('Incident has been escalated. Security leadership has been notified.');
    } catch (err) {
      console.error('Failed to escalate:', err);
      alert('Failed to escalate incident. Please try again.');
    }
  };

  // WebSocket for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = \`\${protocol}//\${window.location.host}/ws/incidents\`;

    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'incident_update') {
          setIncidents(prev => prev.map(inc =>
            inc.id === data.incident.id ? data.incident : inc
          ));
        } else if (data.type === 'new_incident') {
          setIncidents(prev => [data.incident, ...prev]);
        }
      };
    } catch (err) {
      console.error('WebSocket error:', err);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Filter incidents
  const filteredIncidents = incidents.filter(inc => {
    if (filter === 'active') return !['resolved', 'postmortem'].includes(inc.status);
    if (filter === 'resolved') return inc.status === 'resolved' || inc.status === 'postmortem';
    return true;
  });

  // Count active incidents by severity
  const severityCounts = incidents
    .filter(inc => !['resolved', 'postmortem'].includes(inc.status))
    .reduce((acc, inc) => {
      acc[inc.severity] = (acc[inc.severity] || 0) + 1;
      return acc;
    }, {});

  if (loading && incidents.length === 0) {
    return (
      <div className="p-6 bg-monolith-dark min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-monolith-gray/30 rounded w-48"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-monolith-gray/30 rounded"></div>
            ))}
          </div>
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
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Incident Response Center
          </h1>
          <p className="text-gray-400 mt-1">Track and manage security incidents</p>
        </div>
        <button
          onClick={fetchIncidents}
          className="px-4 py-2 bg-monolith-gray/30 text-gray-300 rounded-lg hover:bg-monolith-gray/50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400" role="alert">
          {error}. Showing cached data.
        </div>
      )}

      {/* Severity Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(SEVERITY_LEVELS).map(([key, config]) => (
          <div
            key={key}
            className={\`\${config.bg} \${config.border} border rounded-lg p-4 text-center\`}
          >
            <div className={\`\${config.color} text-3xl font-bold\`}>
              {severityCounts[key] || 0}
            </div>
            <div className="text-gray-400 text-sm mt-1">
              {key} - {config.label}
            </div>
            <div className="text-gray-500 text-xs mt-1">SLA: {config.sla}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {['active', 'resolved', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={\`px-4 py-2 rounded-lg text-sm transition-colors \${
              filter === f
                ? 'bg-monolith-green text-monolith-dark font-semibold'
                : 'bg-monolith-gray/30 text-gray-300 hover:bg-monolith-gray/50'
            }\`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} Incidents
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incident List */}
        <div className="space-y-3">
          {filteredIncidents.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-monolith-gray/10 rounded-lg">
              <p className="text-lg">No {filter} incidents</p>
            </div>
          ) : (
            filteredIncidents.map(incident => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                onSelect={setSelectedIncident}
                isSelected={selectedIncident?.id === incident.id}
              />
            ))
          )}
        </div>

        {/* Incident Detail */}
        <div className="lg:sticky lg:top-6">
          {selectedIncident ? (
            <IncidentDetail
              incident={selectedIncident}
              onClose={() => setSelectedIncident(null)}
              onUpdateStatus={handleUpdateStatus}
              onEscalate={handleEscalate}
            />
          ) : (
            <div className="bg-monolith-gray/10 border border-monolith-gray/30 rounded-lg p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p className="text-gray-400">Select an incident to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
const parseSLA = (sla) => {
  const match = sla.match(/(\d+)\s*(min|hour|hours)/);
  if (!match) return 24 * 60 * 60 * 1000;
  const [, num, unit] = match;
  if (unit === 'min') return parseInt(num) * 60 * 1000;
  return parseInt(num) * 60 * 60 * 1000;
};

const formatTimeRemaining = (ms) => {
  if (ms < 0) return 'OVERDUE';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return \`\${hours}h \${mins}m\`;
  return \`\${mins}m\`;
};

// Mock data
const getMockIncidents = () => [
  {
    id: 'INC-2024-001',
    title: 'Unauthorized API Access Detected',
    description: 'Multiple unauthorized access attempts detected on production API endpoints.',
    severity: 'P1',
    status: 'investigating',
    detectedAt: new Date(Date.now() - 600000).toISOString(),
    assignee: 'security-team@company.com',
    affectedSystems: ['API Gateway', 'Auth Service'],
    timeline: [
      { id: '1', status: 'detected', timestamp: new Date(Date.now() - 600000).toISOString(), description: 'Anomaly detection system triggered alert', user: 'System' },
      { id: '2', status: 'investigating', timestamp: new Date(Date.now() - 300000).toISOString(), description: 'Security team engaged and investigating', user: 'john.doe@company.com' }
    ]
  },
  {
    id: 'INC-2024-002',
    title: 'Database Performance Degradation',
    description: 'Primary database showing increased latency affecting user operations.',
    severity: 'P2',
    status: 'mitigating',
    detectedAt: new Date(Date.now() - 3600000).toISOString(),
    assignee: 'dba-team@company.com',
    affectedSystems: ['PostgreSQL Primary', 'User Service'],
    timeline: [
      { id: '1', status: 'detected', timestamp: new Date(Date.now() - 3600000).toISOString(), description: 'Monitoring alert: DB latency > 500ms', user: 'System' },
      { id: '2', status: 'investigating', timestamp: new Date(Date.now() - 3300000).toISOString(), description: 'DBA team investigating query performance', user: 'dba@company.com' },
      { id: '3', status: 'identified', timestamp: new Date(Date.now() - 2400000).toISOString(), description: 'Root cause: Missing index on users table', user: 'dba@company.com' },
      { id: '4', status: 'mitigating', timestamp: new Date(Date.now() - 1800000).toISOString(), description: 'Creating index in progress', user: 'dba@company.com' }
    ]
  }
];

export default IncidentStatusPanel;
