/**
 * MONOLITH OS - Breach Notification Component
 * Task 7.4.3.2 - Breach alert display with acknowledgment
 * 
 * Critical security breach alert display
 * Shows breach details with required acknowledgment workflow
 */

import { useState, useCallback } from 'react';

// Severity configuration
const SEVERITY_CONFIG = {
    critical: { 
      label: 'Critical', 
          color: 'text-red-400', 
          bgColor: 'bg-red-900/30', 
          borderColor: 'border-red-500',
          icon: '🚨'
    },
    high: { 
      label: 'High', 
          color: 'text-orange-400', 
          bgColor: 'bg-orange-900/30', 
          borderColor: 'border-orange-500',
          icon: '⚠️'
    },
    medium: { 
      label: 'Medium', 
          color: 'text-monolith-amber', 
          bgColor: 'bg-monolith-amber/20', 
          borderColor: 'border-monolith-amber',
          icon: '⚡'
    },
    low: { 
      label: 'Low', 
          color: 'text-blue-400', 
          bgColor: 'bg-blue-900/30', 
          borderColor: 'border-blue-500',
          icon: 'ℹ️'
    }
};

// Mock breach data for demo
const getMockBreachData = () => ({
    id: 'BREACH-2026-001',
    title: 'Unauthorized Data Access Detected',
    severity: 'critical',
    detectedAt: new Date(Date.now() - 3600000).toISOString(),
    affectedSystems: ['User Database', 'Authentication Service', 'API Gateway'],
    affectedDataTypes: ['Personal Information', 'Email Addresses', 'Hashed Passwords'],
    estimatedRecordsAffected: 15420,
    status: 'investigating',
    description: 'Unusual database query patterns detected from an unauthorized IP address. Multiple tables containing user PII were accessed without proper authorization.',
    requiredActions: [
      { id: 1, action: 'Review affected user accounts', completed: false },
      { id: 2, action: 'Reset compromised credentials', completed: false },
      { id: 3, action: 'Enable additional monitoring', completed: false },
      { id: 4, action: 'Notify affected users within 72 hours', completed: false },
      { id: 5, action: 'Document incident for compliance reporting', completed: false }
        ],
    timeline: [
      { time: new Date(Date.now() - 3600000).toISOString(), event: 'Anomaly detected by security system' },
      { time: new Date(Date.now() - 3300000).toISOString(), event: 'Security team notified' },
      { time: new Date(Date.now() - 3000000).toISOString(), event: 'Initial investigation started' },
      { time: new Date(Date.now() - 1800000).toISOString(), event: 'Suspicious IP blocked' }
        ]
});

const BreachNotification = ({ 
                              breach = getMockBreachData(), 
    onAcknowledge, 
    onDismiss,
    isDemo = true 
}) => {
    const [isAcknowledged, setIsAcknowledged] = useState(false);
    const [checkedActions, setCheckedActions] = useState({});
    const [isExpanded, setIsExpanded] = useState(true);

    const severityConfig = SEVERITY_CONFIG[breach.severity] || SEVERITY_CONFIG.medium;

    const handleActionToggle = useCallback((actionId) => {
          setCheckedActions(prev => ({
                  ...prev,
                  [actionId]: !prev[actionId]
          }));
    }, []);

    const allActionsChecked = breach.requiredActions?.every(
          action => checkedActions[action.id]
        );

    const handleAcknowledge = useCallback(() => {
          if (!allActionsChecked) return;
          setIsAcknowledged(true);
          if (onAcknowledge) {
                  onAcknowledge(breach.id);
          }
    }, [allActionsChecked, breach.id, onAcknowledge]);

    const handleDismiss = useCallback(() => {
          if (!isAcknowledged) return;
          if (onDismiss) {
                  onDismiss(breach.id);
          }
    }, [isAcknowledged, breach.id, onDismiss]);

    const formatDate = (dateString) => {
          return new Date(dateString).toLocaleString();
    };

    return (
          <div className={`${severityConfig.bgColor} ${severityConfig.borderColor} border-2 rounded-lg overflow-hidden`}>
            {/* Alert Banner */}
                  <div className={`p-4 ${severityConfig.bgColor} flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                                      <span className="text-2xl">{severityConfig.icon}</span>span>
                                      <div>
                                                  <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-1 text-xs font-bold rounded ${severityConfig.bgColor} ${severityConfig.color}`}>
                                                                  {severityConfig.label.toUpperCase()}
                                                                </span>span>
                                                                <span className="text-white font-bold">SECURITY BREACH</span>span>
                                                    {isDemo && (
                            <span className="px-2 py-0.5 text-xs bg-monolith-gray/50 text-gray-400 rounded">
                                              DEMO
                            </span>span>
                                                                )}
                                                  </div>div>
                                                  <p className="text-gray-300 text-sm mt-1">{breach.title}</p>p>
                                      </div>div>
                            </div>div>
                          <div className="flex items-center gap-2">
                                    <button
                                                  onClick={() => setIsExpanded(!isExpanded)}
                                                  className="p-2 text-gray-400 hover:text-white transition-colors"
                                                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                                >
                                                <svg 
                                                                className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                                  fill="none" 
                                                  stroke="currentColor" 
                                                  viewBox="0 0 24 24"
                                                              >
                                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>svg>
                                    </button>button>
                            {isAcknowledged && (
                        <button
                                        onClick={handleDismiss}
                                        className="p-2 text-gray-400 hover:text-white transition-colors"
                                        aria-label="Dismiss notification"
                                      >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>svg>
                        </button>button>
                                    )}
                          </div>div>
                  </div>div>
          
            {/* Expanded Content */}
            {isExpanded && (
                    <div className="p-6 bg-monolith-dark/50">
                      {/* Breach Details Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                          <div className="bg-monolith-gray/20 rounded-lg p-4">
                                                        <p className="text-gray-500 text-xs uppercase mb-1">Breach ID</p>p>
                                                        <p className="text-white font-mono">{breach.id}</p>p>
                                          </div>div>
                                          <div className="bg-monolith-gray/20 rounded-lg p-4">
                                                        <p className="text-gray-500 text-xs uppercase mb-1">Detected At</p>p>
                                                        <p className="text-white">{formatDate(breach.detectedAt)}</p>p>
                                          </div>div>
                                          <div className="bg-monolith-gray/20 rounded-lg p-4">
                                                        <p className="text-gray-500 text-xs uppercase mb-1">Records Affected</p>p>
                                                        <p className={`font-bold ${severityConfig.color}`}>
                                                                        ~{breach.estimatedRecordsAffected?.toLocaleString()}
                                                        </p>p>
                                          </div>div>
                                          <div className="bg-monolith-gray/20 rounded-lg p-4">
                                                        <p className="text-gray-500 text-xs uppercase mb-1">Status</p>p>
                                                        <span className="px-2 py-1 text-xs bg-monolith-amber/20 text-monolith-amber rounded">
                                                          {breach.status?.replace('_', ' ').toUpperCase()}
                                                        </span>span>
                                          </div>div>
                              </div>div>
                    
                      {/* Description */}
                              <div className="mb-6">
                                          <h4 className="text-white font-medium mb-2">Description</h4>h4>
                                          <p className="text-gray-300 text-sm bg-monolith-gray/20 rounded-lg p-4">
                                            {breach.description}
                                          </p>p>
                              </div>div>
                    
                      {/* Affected Systems & Data */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                          <div>
                                                        <h4 className="text-white font-medium mb-2">Affected Systems</h4>h4>
                                                        <ul className="space-y-2">
                                                          {breach.affectedSystems?.map((system, index) => (
                                        <li key={index} className="flex items-center gap-2 text-gray-300 text-sm">
                                                            <span className="w-2 h-2 bg-red-400 rounded-full"></span>span>
                                          {system}
                                        </li>li>
                                      ))}
                                                        </ul>ul>
                                          </div>div>
                                          <div>
                                                        <h4 className="text-white font-medium mb-2">Data Types Affected</h4>h4>
                                                        <ul className="space-y-2">
                                                          {breach.affectedDataTypes?.map((dataType, index) => (
                                        <li key={index} className="flex items-center gap-2 text-gray-300 text-sm">
                                                            <span className="w-2 h-2 bg-monolith-amber rounded-full"></span>span>
                                          {dataType}
                                        </li>li>
                                      ))}
                                                        </ul>ul>
                                          </div>div>
                              </div>div>
                    
                      {/* Timeline */}
                              <div className="mb-6">
                                          <h4 className="text-white font-medium mb-3">Incident Timeline</h4>h4>
                                          <div className="space-y-3">
                                            {breach.timeline?.map((entry, index) => (
                                      <div key={index} className="flex items-start gap-3">
                                                        <div className="flex flex-col items-center">
                                                                            <div className="w-3 h-3 bg-monolith-green rounded-full"></div>div>
                                                          {index < breach.timeline.length - 1 && (
                                                              <div className="w-0.5 h-8 bg-monolith-gray/50"></div>div>
                                                                            )}
                                                        </div>div>
                                                        <div className="flex-1 -mt-1">
                                                                            <p className="text-gray-500 text-xs">{formatDate(entry.time)}</p>p>
                                                                            <p className="text-gray-300 text-sm">{entry.event}</p>p>
                                                        </div>div>
                                      </div>div>
                                    ))}
                                          </div>div>
                              </div>div>
                    
                      {/* Required Actions Checklist */}
                              <div className={`border rounded-lg p-4 ${isAcknowledged ? 'border-monolith-green/50 bg-monolith-green/10' : 'border-red-500/50 bg-red-900/10'}`}>
                                          <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                                                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                                        </svg>svg>
                                                        Required Actions
                                            {!isAcknowledged && <span className="text-red-400 text-sm">(Complete all to acknowledge)</span>span>}
                                          </h4>h4>
                                          <ul className="space-y-3">
                                            {breach.requiredActions?.map((action) => (
                                      <li key={action.id} className="flex items-center gap-3">
                                                        <label className="flex items-center gap-3 cursor-pointer w-full">
                                                                            <input
                                                                                                    type="checkbox"
                                                                                                    checked={checkedActions[action.id] || false}
                                                                                                    onChange={() => handleActionToggle(action.id)}
                                                                                                    disabled={isAcknowledged}
                                                                                                    className="w-5 h-5 rounded border-monolith-gray bg-monolith-dark text-monolith-green focus:ring-monolith-green"
                                                                                                  />
                                                                            <span className={`text-sm ${checkedActions[action.id] ? 'text-monolith-green line-through' : 'text-gray-300'}`}>
                                                                              {action.action}
                                                                            </span>span>
                                                        </label>label>
                                      </li>li>
                                    ))}
                                          </ul>ul>
                              </div>div>
                    
                      {/* Acknowledgment Button */}
                              <div className="mt-6 flex justify-end">
                                {!isAcknowledged ? (
                                    <button
                                                      onClick={handleAcknowledge}
                                                      disabled={!allActionsChecked}
                                                      className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                                                                          allActionsChecked
                                                                            ? 'bg-red-500 text-white hover:bg-red-600'
                                                                            : 'bg-monolith-gray/30 text-gray-500 cursor-not-allowed'
                                                      }`}
                                                    >
                                                    I Acknowledge This Breach
                                    </button>button>
                                  ) : (
                                    <div className="flex items-center gap-2 text-monolith-green">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>svg>
                                                    <span className="font-medium">Acknowledged</span>span>
                                    </div>div>
                                          )}
                              </div>div>
                    </div>div>
                )}
          </div>div>
        );
};

export default BreachNotification;</div>
