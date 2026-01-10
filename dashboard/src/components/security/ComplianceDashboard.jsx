/**
 * MONOLITH OS - Compliance Status Dashboard
 * Phase 7.5.2 - Compliance Status Dashboard
 * 
 * Overview of compliance status across GDPR, HIPAA, SOC2, and other frameworks
 * Real-time compliance monitoring with actionable insights
 */

import { useState, useEffect, useCallback } from 'react';

// Compliance framework configurations
const COMPLIANCE_FRAMEWORKS = {
  gdpr: {
    name: 'GDPR',
    fullName: 'General Data Protection Regulation',
    icon: '🇪🇺',
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/30',
    borderColor: 'border-blue-500'
  },
  hipaa: {
    name: 'HIPAA',
    fullName: 'Health Insurance Portability and Accountability Act',
    icon: '🏥',
    color: 'text-green-400',
    bgColor: 'bg-green-900/30',
    borderColor: 'border-green-500'
  },
  soc2: {
    name: 'SOC 2',
    fullName: 'Service Organization Control 2',
    icon: '🔒',
    color: 'text-purple-400',
    bgColor: 'bg-purple-900/30',
    borderColor: 'border-purple-500'
  },
  pci: {
    name: 'PCI DSS',
    fullName: 'Payment Card Industry Data Security Standard',
    icon: '💳',
    color: 'text-orange-400',
    bgColor: 'bg-orange-900/30',
    borderColor: 'border-orange-500'
  }
};

// Status configurations
const STATUS_CONFIG = {
  compliant: { label: 'Compliant', color: 'text-monolith-green', bgColor: 'bg-monolith-green/20' },
  partial: { label: 'Partial', color: 'text-monolith-amber', bgColor: 'bg-monolith-amber/20' },
  non_compliant: { label: 'Non-Compliant', color: 'text-red-400', bgColor: 'bg-red-900/20' },
  not_applicable: { label: 'N/A', color: 'text-gray-400', bgColor: 'bg-gray-700/20' }
};

// CSRF Token handler
const getCSRFToken = () => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
};

// Compliance score gauge component
const ComplianceGauge = ({ score, framework }) => {
  const config = COMPLIANCE_FRAMEWORKS[framework];
  const circumference = 2 * Math.PI * 40;
  const progress = (score / 100) * circumference;

  return (
    <div className={\`\${config.bgColor} \${config.borderColor} border rounded-lg p-6\`}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-monolith-gray/30"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className={score >= 80 ? 'text-monolith-green' : score >= 60 ? 'text-monolith-amber' : 'text-red-400'}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">{score}%</span>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{config.icon}</span>
            <h3 className={\`text-lg font-bold \${config.color}\`}>{config.name}</h3>
          </div>
          <p className="text-gray-400 text-sm mt-1">{config.fullName}</p>
        </div>
      </div>
    </div>
  );
};

// Compliance requirement item
const RequirementItem = ({ requirement }) => {
  const statusConfig = STATUS_CONFIG[requirement.status] || STATUS_CONFIG.not_applicable;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-monolith-gray/30 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <span className={\`px-2 py-1 text-xs rounded \${statusConfig.bgColor} \${statusConfig.color}\`}>
            {statusConfig.label}
          </span>
          <div>
            <h4 className="text-white font-medium">{requirement.title}</h4>
            <p className="text-gray-500 text-sm">{requirement.code}</p>
          </div>
        </div>
        <svg
          className={\`w-5 h-5 text-gray-400 transform transition-transform \${isExpanded ? 'rotate-180' : ''}\`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-monolith-gray/30">
          <p className="text-gray-300 text-sm mt-4">{requirement.description}</p>
          
          {requirement.controls && (
            <div className="mt-4">
              <h5 className="text-gray-400 text-sm font-medium mb-2">Controls</h5>
              <ul className="space-y-2">
                {requirement.controls.map((control, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <span className={control.implemented ? 'text-monolith-green' : 'text-red-400'}>
                      {control.implemented ? '✓' : '✗'}
                    </span>
                    <span className="text-gray-300">{control.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {requirement.dueDate && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-gray-500">Due Date:</span>
              <span className={new Date(requirement.dueDate) < new Date() ? 'text-red-400' : 'text-gray-300'}>
                {new Date(requirement.dueDate).toLocaleDateString()}
              </span>
            </div>
          )}

          {requirement.assignee && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-gray-500">Assignee:</span>
              <span className="text-gray-300">{requirement.assignee}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Recent compliance activity
const ActivityItem = ({ activity }) => {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-monolith-gray/20 last:border-0">
      <div className={\`w-2 h-2 mt-2 rounded-full \${
        activity.type === 'success' ? 'bg-monolith-green' :
        activity.type === 'warning' ? 'bg-monolith-amber' :
        activity.type === 'error' ? 'bg-red-400' : 'bg-gray-400'
      }\`} />
      <div className="flex-1 min-w-0">
        <p className="text-gray-300 text-sm">{activity.message}</p>
        <p className="text-gray-500 text-xs mt-1">
          {new Date(activity.timestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

// Main Compliance Dashboard component
const ComplianceDashboard = () => {
  const [complianceData, setComplianceData] = useState(null);
  const [selectedFramework, setSelectedFramework] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch compliance data
  const fetchComplianceData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/compliance/status', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error('Failed to fetch compliance data');

      const data = await response.json();
      setComplianceData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setComplianceData(getMockComplianceData());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  // Filter requirements by framework
  const filteredRequirements = complianceData?.requirements?.filter(req =>
    selectedFramework === 'all' || req.framework === selectedFramework
  ) || [];

  // Calculate overall compliance score
  const overallScore = complianceData?.scores
    ? Math.round(Object.values(complianceData.scores).reduce((a, b) => a + b, 0) / Object.keys(complianceData.scores).length)
    : 0;

  if (loading && !complianceData) {
    return (
      <div className="p-6 bg-monolith-dark min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-monolith-gray/30 rounded w-64"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-monolith-gray/30 rounded"></div>
            ))}
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-monolith-gray/30 rounded"></div>
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
            <svg className="w-8 h-8 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Compliance Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor compliance status across regulatory frameworks
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Overall Score:</span>
          <span className={\`text-2xl font-bold \${
            overallScore >= 80 ? 'text-monolith-green' :
            overallScore >= 60 ? 'text-monolith-amber' : 'text-red-400'
          }\`}>
            {overallScore}%
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400" role="alert">
          {error}. Showing sample data.
        </div>
      )}

      {/* Framework Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Object.entries(COMPLIANCE_FRAMEWORKS).map(([key, config]) => (
          <ComplianceGauge
            key={key}
            framework={key}
            score={complianceData?.scores?.[key] || 0}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requirements Section */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Requirements Status</h2>
            <select
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value)}
              className="bg-monolith-dark border border-monolith-gray rounded px-3 py-2 text-white text-sm"
            >
              <option value="all">All Frameworks</option>
              {Object.entries(COMPLIANCE_FRAMEWORKS).map(([key, config]) => (
                <option key={key} value={key}>{config.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {filteredRequirements.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bg-monolith-gray/10 rounded-lg">
                No requirements found for the selected framework
              </div>
            ) : (
              filteredRequirements.map(requirement => (
                <RequirementItem key={requirement.id} requirement={requirement} />
              ))
            )}
          </div>
        </div>

        {/* Activity & Alerts Section */}
        <div className="space-y-6">
          {/* Upcoming Audits */}
          <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-4">
            <h3 className="text-white font-medium mb-4">Upcoming Audits</h3>
            <div className="space-y-3">
              {complianceData?.upcomingAudits?.map((audit, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-monolith-gray/20 last:border-0">
                  <div>
                    <p className="text-white text-sm">{audit.name}</p>
                    <p className="text-gray-500 text-xs">{audit.type}</p>
                  </div>
                  <span className={`text-sm ${
                    new Date(audit.date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                      ? 'text-monolith-amber'
                      : 'text-gray-400'
                  }`}>
                    {new Date(audit.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-4">
            <h3 className="text-white font-medium mb-4">Recent Activity</h3>
            <div className="max-h-64 overflow-y-auto">
              {complianceData?.recentActivity?.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-4">
            <h3 className="text-white font-medium mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 bg-monolith-green/20 text-monolith-green border border-monolith-green/50 rounded-lg hover:bg-monolith-green/30 transition-colors text-sm text-left">
                📊 Generate Compliance Report
              </button>
              <button className="w-full px-4 py-2 bg-monolith-gray/30 text-gray-300 border border-monolith-gray rounded-lg hover:bg-monolith-gray/50 transition-colors text-sm text-left">
                📋 Run Self-Assessment
              </button>
              <button className="w-full px-4 py-2 bg-monolith-gray/30 text-gray-300 border border-monolith-gray rounded-lg hover:bg-monolith-gray/50 transition-colors text-sm text-left">
                📧 Schedule Audit Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock compliance data
const getMockComplianceData = () => ({
  scores: {
    gdpr: 85,
    hipaa: 78,
    soc2: 92,
    pci: 71
  },
  requirements: [
    {
      id: '1',
      framework: 'gdpr',
      code: 'GDPR Art. 17',
      title: 'Right to Erasure',
      description: 'Data subjects have the right to request deletion of their personal data.',
      status: 'compliant',
      controls: [
        { name: 'Data deletion API endpoint', implemented: true },
        { name: 'Automated deletion workflow', implemented: true },
        { name: 'Deletion audit logging', implemented: true }
      ]
    },
    {
      id: '2',
      framework: 'gdpr',
      code: 'GDPR Art. 32',
      title: 'Security of Processing',
      description: 'Implement appropriate technical and organizational measures to ensure security.',
      status: 'partial',
      controls: [
        { name: 'Encryption at rest', implemented: true },
        { name: 'Encryption in transit', implemented: true },
        { name: 'Regular security testing', implemented: false }
      ],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      assignee: 'security-team@company.com'
    },
    {
      id: '3',
      framework: 'hipaa',
      code: 'HIPAA 164.312(a)',
      title: 'Access Control',
      description: 'Implement technical policies and procedures for electronic information systems.',
      status: 'compliant',
      controls: [
        { name: 'Unique user identification', implemented: true },
        { name: 'Automatic logoff', implemented: true },
        { name: 'Encryption and decryption', implemented: true }
      ]
    },
    {
      id: '4',
      framework: 'soc2',
      code: 'CC6.1',
      title: 'Logical and Physical Access Controls',
      description: 'Restrict logical and physical access to authorized personnel only.',
      status: 'compliant',
      controls: [
        { name: 'Role-based access control', implemented: true },
        { name: 'Multi-factor authentication', implemented: true },
        { name: 'Access reviews', implemented: true }
      ]
    },
    {
      id: '5',
      framework: 'pci',
      code: 'PCI DSS 3.4',
      title: 'Render PAN Unreadable',
      description: 'Render PAN unreadable anywhere it is stored using encryption.',
      status: 'non_compliant',
      controls: [
        { name: 'Strong cryptography', implemented: true },
        { name: 'Key management', implemented: false },
        { name: 'Masking when displayed', implemented: false }
      ],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      assignee: 'compliance@company.com'
    }
  ],
  upcomingAudits: [
    { name: 'SOC 2 Type II Audit', type: 'External', date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
    { name: 'HIPAA Self-Assessment', type: 'Internal', date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() },
    { name: 'PCI DSS Quarterly Review', type: 'External', date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString() }
  ],
  recentActivity: [
    { type: 'success', message: 'GDPR consent management update completed', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { type: 'warning', message: 'PCI DSS key rotation due in 7 days', timestamp: new Date(Date.now() - 7200000).toISOString() },
    { type: 'info', message: 'New compliance policy published', timestamp: new Date(Date.now() - 86400000).toISOString() },
    { type: 'success', message: 'SOC 2 evidence collection completed', timestamp: new Date(Date.now() - 172800000).toISOString() }
  ]
});

export default ComplianceDashboard;
