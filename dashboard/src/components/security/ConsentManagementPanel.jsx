/**
 * MONOLITH OS - Consent Management Panel
 * Phase 7.1.3.4 - GDPR Consent Management Interface
 * 
 * Allows users to manage their data processing consent preferences
 * Implements GDPR Article 7 requirements for consent management
 */

import { useState, useEffect, useCallback } from 'react';

// Consent category definitions
const CONSENT_CATEGORIES = {
  essential: {
    id: 'essential',
    title: 'Essential Services',
    description: 'Required for the basic functionality of the system. Cannot be disabled.',
    required: true,
    icon: '🔒'
  },
  functional: {
    id: 'functional',
    title: 'Functional Preferences',
    description: 'Enables personalization features like saved preferences, language settings, and accessibility options.',
    required: false,
    icon: '⚙️'
  },
  analytics: {
    id: 'analytics',
    title: 'Analytics & Performance',
    description: 'Helps us understand how you use our services to improve performance and user experience.',
    required: false,
    icon: '📊'
  },
  marketing: {
    id: 'marketing',
    title: 'Marketing Communications',
    description: 'Allows us to send you relevant updates, newsletters, and promotional content.',
    required: false,
    icon: '📧'
  },
  thirdParty: {
    id: 'thirdParty',
    title: 'Third-Party Integrations',
    description: 'Enables sharing data with trusted third-party services for enhanced functionality.',
    required: false,
    icon: '🔗'
  },
  research: {
    id: 'research',
    title: 'Research & Development',
    description: 'Allows anonymized data to be used for improving our products and services.',
    required: false,
    icon: '🔬'
  }
};

// CSRF Token handler
const getCSRFToken = () => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
};

// Individual consent toggle component
const ConsentToggle = ({ category, isEnabled, onChange, disabled }) => {
  const config = CONSENT_CATEGORIES[category];
  
  return (
    <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-4 hover:border-monolith-gray/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl" role="img" aria-hidden="true">{config.icon}</span>
            <h3 className="text-white font-medium">{config.title}</h3>
            {config.required && (
              <span className="text-xs bg-monolith-amber/20 text-monolith-amber px-2 py-0.5 rounded">
                Required
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">{config.description}</p>
        </div>
        
        <div className="flex-shrink-0">
          <button
            onClick={() => onChange(category, !isEnabled)}
            disabled={disabled || config.required}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-monolith-green/50 ${
              isEnabled ? 'bg-monolith-green' : 'bg-monolith-gray'
            } ${(disabled || config.required) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            role="switch"
            aria-checked={isEnabled}
            aria-label={\`Toggle \${config.title} consent\`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

// Consent history entry
const ConsentHistoryEntry = ({ entry }) => {
  return (
    <div className="flex items-center justify-between py-3 border-b border-monolith-gray/20 last:border-0">
      <div>
        <p className="text-white text-sm">
          {entry.action === 'granted' ? '✓ Granted' : '✗ Withdrawn'} consent for{' '}
          <span className="font-medium">{CONSENT_CATEGORIES[entry.category]?.title || entry.category}</span>
        </p>
        <p className="text-gray-500 text-xs mt-1">
          {new Date(entry.timestamp).toLocaleString()}
          {entry.ipAddress && ` • IP: ${entry.ipAddress}`}
        </p>
      </div>
      {entry.verificationId && (
        <span className="text-xs text-gray-500 font-mono">
          {entry.verificationId.slice(0, 8)}...
        </span>
      )}
    </div>
  );
};

// Main Consent Management Panel component
const ConsentManagementPanel = () => {
  const [consents, setConsents] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});

  // Fetch current consent preferences
  const fetchConsents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gdpr/consents', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error('Failed to fetch consent preferences');

      const data = await response.json();
      setConsents(data.consents || getDefaultConsents());
      setHistory(data.history || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      setConsents(getDefaultConsents());
      setHistory(getMockHistory());
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle consent toggle
  const handleConsentChange = (category, enabled) => {
    setPendingChanges(prev => ({
      ...prev,
      [category]: enabled
    }));
    setConsents(prev => ({
      ...prev,
      [category]: enabled
    }));
  };

  // Save consent preferences
  const handleSaveConsents = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    try {
      setSaving(true);
      const response = await fetch('/api/gdpr/consents', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ consents: pendingChanges })
      });

      if (!response.ok) throw new Error('Failed to save consent preferences');

      const data = await response.json();
      setSuccessMessage('Your consent preferences have been updated successfully.');
      setPendingChanges({});
      
      // Update history with new entries
      if (data.newHistoryEntries) {
        setHistory(prev => [...data.newHistoryEntries, ...prev]);
      }

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError('Failed to save your preferences. Please try again.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  // Withdraw all optional consents
  const handleWithdrawAll = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to withdraw all optional consents? This will disable personalization, analytics, and marketing features.'
    );
    
    if (!confirmed) return;

    const withdrawals = {};
    Object.keys(CONSENT_CATEGORIES).forEach(category => {
      if (!CONSENT_CATEGORIES[category].required) {
        withdrawals[category] = false;
      }
    });

    setConsents(prev => ({
      ...prev,
      ...withdrawals
    }));
    setPendingChanges(withdrawals);
  };

  // Download consent record
  const handleDownloadRecord = async () => {
    try {
      const response = await fetch('/api/gdpr/consents/export', {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error('Failed to export consent record');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`consent-record-\${new Date().toISOString().split('T')[0]}.pdf\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download consent record. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  if (loading) {
    return (
      <div className="p-6 bg-monolith-dark min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-monolith-gray/30 rounded w-64"></div>
          <div className="h-4 bg-monolith-gray/30 rounded w-96"></div>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-24 bg-monolith-gray/30 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-monolith-dark min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg className="w-8 h-8 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Privacy & Consent Management
        </h1>
        <p className="text-gray-400 mt-1">
          Manage how your data is processed. You have the right to withdraw consent at any time under GDPR Article 7.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400" role="alert">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="mb-6 p-4 bg-green-900/30 border border-monolith-green rounded-lg text-monolith-green" role="status">
          {successMessage}
        </div>
      )}

      {/* Pending changes banner */}
      {Object.keys(pendingChanges).length > 0 && (
        <div className="mb-6 p-4 bg-monolith-amber/20 border border-monolith-amber rounded-lg flex items-center justify-between">
          <p className="text-monolith-amber">
            You have unsaved changes to your consent preferences.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPendingChanges({});
                fetchConsents();
              }}
              className="px-3 py-1.5 bg-monolith-gray/50 text-gray-300 rounded text-sm hover:bg-monolith-gray/70 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSaveConsents}
              disabled={saving}
              className="px-3 py-1.5 bg-monolith-green text-monolith-dark font-semibold rounded text-sm hover:bg-monolith-green/80 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Consent Categories */}
      <div className="space-y-4 mb-8">
        {Object.keys(CONSENT_CATEGORIES).map(category => (
          <ConsentToggle
            key={category}
            category={category}
            isEnabled={consents[category] ?? CONSENT_CATEGORIES[category].required}
            onChange={handleConsentChange}
            disabled={saving}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={handleWithdrawAll}
          disabled={saving}
          className="px-4 py-2 bg-red-900/30 text-red-400 border border-red-500 rounded-lg hover:bg-red-900/50 transition-colors disabled:opacity-50"
        >
          Withdraw All Optional Consents
        </button>
        <button
          onClick={handleDownloadRecord}
          className="px-4 py-2 bg-monolith-gray/30 text-gray-300 border border-monolith-gray rounded-lg hover:bg-monolith-gray/50 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Consent Record
        </button>
      </div>

      {/* Consent History */}
      <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={showHistory}
        >
          <h2 className="text-lg font-medium text-white">Consent History</h2>
          <svg
            className={\`w-5 h-5 text-gray-400 transform transition-transform \${showHistory ? 'rotate-180' : ''}\`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showHistory && (
          <div className="mt-4 max-h-64 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No consent history available</p>
            ) : (
              history.map((entry, index) => (
                <ConsentHistoryEntry key={entry.id || index} entry={entry} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Legal Information */}
      <div className="mt-8 p-4 bg-monolith-gray/10 rounded-lg border border-monolith-gray/20">
        <h3 className="text-white font-medium mb-2">Your Rights Under GDPR</h3>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>• You have the right to withdraw consent at any time (Article 7)</li>
          <li>• You can request access to your personal data (Article 15)</li>
          <li>• You can request rectification of inaccurate data (Article 16)</li>
          <li>• You can request erasure of your data (Article 17)</li>
          <li>• You can request restriction of processing (Article 18)</li>
          <li>• You have the right to data portability (Article 20)</li>
        </ul>
        <p className="text-gray-500 text-xs mt-3">
          For questions about your privacy rights, contact our Data Protection Officer at dpo@company.com
        </p>
      </div>
    </div>
  );
};

// Default consent values
const getDefaultConsents = () => ({
  essential: true,
  functional: true,
  analytics: false,
  marketing: false,
  thirdParty: false,
  research: false
});

// Mock consent history
const getMockHistory = () => [
  {
    id: '1',
    category: 'analytics',
    action: 'withdrawn',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    ipAddress: '192.168.1.100',
    verificationId: 'ver_abc123def456789'
  },
  {
    id: '2',
    category: 'functional',
    action: 'granted',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    ipAddress: '192.168.1.100',
    verificationId: 'ver_xyz789ghi012345'
  },
  {
    id: '3',
    category: 'marketing',
    action: 'withdrawn',
    timestamp: new Date(Date.now() - 604800000).toISOString(),
    ipAddress: '10.0.0.45',
    verificationId: 'ver_mno456pqr789012'
  }
];

export default ConsentManagementPanel;
