/**
 * MONOLITH OS - Audit Trail Viewer
 * Phase 7.3.2.6 - Audit Trail Interface
 * 
 * Comprehensive audit log viewing with search, filtering, and export
 * WCAG 2.1 compliant with responsive design
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// Audit event type configurations
const EVENT_TYPES = {
  authentication: { icon: '🔐', label: 'Authentication', color: 'text-blue-400' },
  authorization: { icon: '🛡️', label: 'Authorization', color: 'text-purple-400' },
  data_access: { icon: '📄', label: 'Data Access', color: 'text-green-400' },
  data_modification: { icon: '✏️', label: 'Data Modification', color: 'text-yellow-400' },
  system_config: { icon: '⚙️', label: 'System Config', color: 'text-orange-400' },
  user_management: { icon: '👤', label: 'User Management', color: 'text-cyan-400' },
  security_event: { icon: '🚨', label: 'Security Event', color: 'text-red-400' },
  compliance: { icon: '📋', label: 'Compliance', color: 'text-indigo-400' }
};

// Result status configurations
const RESULT_STATUS = {
  success: { icon: '✓', label: 'Success', color: 'text-monolith-green' },
  failure: { icon: '✗', label: 'Failure', color: 'text-red-400' },
  warning: { icon: '⚠', label: 'Warning', color: 'text-monolith-amber' },
  info: { icon: 'ℹ', label: 'Info', color: 'text-blue-400' }
};

// CSRF Token handler
const getCSRFToken = () => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
};

// Individual audit log entry component
const AuditLogEntry = ({ entry, isExpanded, onToggle }) => {
  const eventType = EVENT_TYPES[entry.eventType] || EVENT_TYPES.security_event;
  const resultStatus = RESULT_STATUS[entry.result] || RESULT_STATUS.info;

  return (
    <div
      className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg mb-2 hover:border-monolith-gray/50 transition-colors"
      role="article"
      aria-label={\`Audit entry: \${entry.action} at \${new Date(entry.timestamp).toLocaleString()}\`}
    >
      <button
        onClick={() => onToggle(entry.id)}
        className="w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-monolith-green/50 rounded-lg"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl" role="img" aria-hidden="true">{eventType.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className={\`font-medium \${eventType.color}\`}>{eventType.label}</span>
                <span className={\`text-sm \${resultStatus.color}\`}>
                  {resultStatus.icon} {resultStatus.label}
                </span>
              </div>
              <p className="text-white text-sm mt-1">{entry.action}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-gray-400 text-xs">{new Date(entry.timestamp).toLocaleDateString()}</div>
              <div className="text-gray-500 text-xs">{new Date(entry.timestamp).toLocaleTimeString()}</div>
            </div>
            <svg
              className={\`w-5 h-5 text-gray-400 transform transition-transform \${isExpanded ? 'rotate-180' : ''}\`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-monolith-gray/30 mt-2 pt-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">User</dt>
              <dd className="text-white font-mono">{entry.userId}</dd>
            </div>
            <div>
              <dt className="text-gray-500">IP Address</dt>
              <dd className="text-white font-mono">{entry.ipAddress}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Session ID</dt>
              <dd className="text-white font-mono text-xs">{entry.sessionId}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Resource</dt>
              <dd className="text-white">{entry.resource}</dd>
            </div>
            {entry.details && (
              <div className="md:col-span-2">
                <dt className="text-gray-500 mb-1">Details</dt>
                <dd className="text-gray-300 bg-monolith-dark/50 p-3 rounded font-mono text-xs whitespace-pre-wrap">
                  {JSON.stringify(entry.details, null, 2)}
                </dd>
              </div>
            )}
            {entry.userAgent && (
              <div className="md:col-span-2">
                <dt className="text-gray-500">User Agent</dt>
                <dd className="text-gray-400 text-xs font-mono truncate">{entry.userAgent}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
};

// Pagination controls
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const pages = useMemo(() => {
    const range = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }, [currentPage, totalPages]);

  return (
    <nav className="flex items-center justify-center gap-2 mt-6" aria-label="Pagination">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-2 rounded bg-monolith-gray/30 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-monolith-gray/50 transition-colors"
        aria-label="Previous page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {pages[0] > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="px-3 py-2 rounded bg-monolith-gray/30 text-gray-300 hover:bg-monolith-gray/50 transition-colors"
          >
            1
          </button>
          {pages[0] > 2 && <span className="text-gray-500">...</span>}
        </>
      )}

      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={\`px-3 py-2 rounded transition-colors \${
            page === currentPage
              ? 'bg-monolith-green text-monolith-dark font-semibold'
              : 'bg-monolith-gray/30 text-gray-300 hover:bg-monolith-gray/50'
          }\`}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}

      {pages[pages.length - 1] < totalPages && (
        <>
          {pages[pages.length - 1] < totalPages - 1 && <span className="text-gray-500">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="px-3 py-2 rounded bg-monolith-gray/30 text-gray-300 hover:bg-monolith-gray/50 transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-2 rounded bg-monolith-gray/30 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-monolith-gray/50 transition-colors"
        aria-label="Next page"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
};

// Export dialog component
const ExportDialog = ({ isOpen, onClose, onExport, totalRecords }) => {
  const [format, setFormat] = useState('csv');
  const [dateRange, setDateRange] = useState('all');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="bg-monolith-gray rounded-lg p-6 w-full max-w-md">
        <h2 id="export-dialog-title" className="text-xl font-bold text-white mb-4">
          Export Audit Logs
        </h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="export-format" className="block text-gray-400 text-sm mb-1">
              Export Format
            </label>
            <select
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full bg-monolith-dark border border-monolith-gray rounded px-3 py-2 text-white"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="pdf">PDF Report</option>
            </select>
          </div>

          <div>
            <label htmlFor="export-range" className="block text-gray-400 text-sm mb-1">
              Date Range
            </label>
            <select
              id="export-range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full bg-monolith-dark border border-monolith-gray rounded px-3 py-2 text-white"
            >
              <option value="all">All Records ({totalRecords})</option>
              <option value="filtered">Current Filter Results</option>
              <option value="today">Today Only</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>

          <p className="text-gray-500 text-sm">
            Note: Exported data may contain sensitive information. Handle according to data protection policies.
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-monolith-gray/50 text-gray-300 rounded hover:bg-monolith-gray/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onExport(format, dateRange)}
            className="px-4 py-2 bg-monolith-green text-monolith-dark font-semibold rounded hover:bg-monolith-green/80 transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Audit Trail Viewer component
const AuditTrailViewer = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [filters, setFilters] = useState({
    eventType: 'all',
    result: 'all',
    userId: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });

  const entriesPerPage = 20;

  // Fetch audit entries
  const fetchAuditEntries = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: entriesPerPage.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v && v !== 'all')
        )
      });

      const response = await fetch(\`/api/audit/logs?\${queryParams}\`, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin'
      });

      if (!response.ok) throw new Error('Failed to fetch audit logs');

      const data = await response.json();
      setEntries(data.entries || []);
      setTotalPages(data.totalPages || 1);
      setError(null);
    } catch (err) {
      setError(err.message);
      setEntries(getMockAuditEntries());
      setTotalPages(5);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  // Handle entry expand/collapse
  const handleToggleEntry = (entryId) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  // Handle export
  const handleExport = async (format, dateRange) => {
    try {
      const response = await fetch('/api/audit/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        credentials: 'same-origin',
        body: JSON.stringify({ format, dateRange, filters })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`audit-logs-\${new Date().toISOString().split('T')[0]}.\${format}\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setShowExportDialog(false);
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed. Please try again.');
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      eventType: 'all',
      result: 'all',
      userId: '',
      dateFrom: '',
      dateTo: '',
      search: ''
    });
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchAuditEntries();
  }, [fetchAuditEntries]);

  if (loading && entries.length === 0) {
    return (
      <div className="p-6 bg-monolith-dark min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-monolith-gray/30 rounded w-48"></div>
          <div className="h-16 bg-monolith-gray/30 rounded"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-monolith-gray/30 rounded"></div>
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Audit Trail Viewer
          </h1>
          <p className="text-gray-400 mt-1">System activity logs and compliance audit trail</p>
        </div>
        <button
          onClick={() => setShowExportDialog(true)}
          className="px-4 py-2 bg-monolith-green text-monolith-dark font-semibold rounded-lg hover:bg-monolith-green/80 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400" role="alert">
          <strong>Error:</strong> {error}. Showing sample data.
        </div>
      )}

      {/* Filters */}
      <div className="bg-monolith-gray/20 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label htmlFor="filter-type" className="block text-gray-400 text-sm mb-1">
              Event Type
            </label>
            <select
              id="filter-type"
              value={filters.eventType}
              onChange={(e) => setFilters(f => ({ ...f, eventType: e.target.value }))}
              className="w-full bg-monolith-dark border border-monolith-gray rounded px-3 py-2 text-white text-sm"
            >
              <option value="all">All Types</option>
              {Object.entries(EVENT_TYPES).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-result" className="block text-gray-400 text-sm mb-1">
              Result
            </label>
            <select
              id="filter-result"
              value={filters.result}
              onChange={(e) => setFilters(f => ({ ...f, result: e.target.value }))}
              className="w-full bg-monolith-dark border border-monolith-gray rounded px-3 py-2 text-white text-sm"
            >
              <option value="all">All Results</option>
              {Object.entries(RESULT_STATUS).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-user" className="block text-gray-400 text-sm mb-1">
              User ID
            </label>
            <input
              id="filter-user"
              type="text"
              value={filters.userId}
              onChange={(e) => setFilters(f => ({ ...f, userId: e.target.value }))}
              placeholder="Filter by user..."
              className="w-full bg-monolith-dark border border-monolith-gray rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label htmlFor="filter-from" className="block text-gray-400 text-sm mb-1">
              From Date
            </label>
            <input
              id="filter-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
              className="w-full bg-monolith-dark border border-monolith-gray rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label htmlFor="filter-to" className="block text-gray-400 text-sm mb-1">
              To Date
            </label>
            <input
              id="filter-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
              className="w-full bg-monolith-dark border border-monolith-gray rounded px-3 py-2 text-white text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full px-3 py-2 bg-monolith-gray/50 text-gray-300 rounded hover:bg-monolith-gray/70 transition-colors text-sm"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="relative">
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search audit logs..."
              className="w-full bg-monolith-dark border border-monolith-gray rounded px-3 py-2 pl-10 text-white text-sm"
              aria-label="Search audit logs"
            />
            <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Audit entries */}
      <div className="space-y-2" role="log" aria-label="Audit trail entries">
        {entries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg">No audit entries found</p>
            <p className="text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          entries.map(entry => (
            <AuditLogEntry
              key={entry.id}
              entry={entry}
              isExpanded={expandedEntries.has(entry.id)}
              onToggle={handleToggleEntry}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        totalRecords={entries.length * totalPages}
      />
    </div>
  );
};

// Mock data generator
const getMockAuditEntries = () => [
  {
    id: '1',
    eventType: 'authentication',
    action: 'User login successful',
    result: 'success',
    userId: 'admin@company.com',
    ipAddress: '192.168.1.100',
    sessionId: 'sess_abc123def456',
    resource: '/auth/login',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    details: { method: 'SSO', provider: 'Azure AD' }
  },
  {
    id: '2',
    eventType: 'data_access',
    action: 'PHI record accessed',
    result: 'success',
    userId: 'doctor.smith@company.com',
    ipAddress: '10.0.0.45',
    sessionId: 'sess_xyz789ghi012',
    resource: '/patients/12345/records',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    userAgent: 'Internal API Client/1.0',
    details: { patientId: '12345', recordType: 'lab_results', purpose: 'treatment' }
  },
  {
    id: '3',
    eventType: 'authorization',
    action: 'Permission denied - insufficient privileges',
    result: 'failure',
    userId: 'intern@company.com',
    ipAddress: '192.168.1.155',
    sessionId: 'sess_fail_test',
    resource: '/admin/settings',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    details: { requiredRole: 'admin', userRole: 'intern', action: 'view_settings' }
  },
  {
    id: '4',
    eventType: 'security_event',
    action: 'Multiple failed login attempts detected',
    result: 'warning',
    userId: 'unknown',
    ipAddress: '203.0.113.50',
    sessionId: 'N/A',
    resource: '/auth/login',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    userAgent: 'curl/7.68.0',
    details: { attempts: 5, targetAccount: 'admin@company.com', blocked: true }
  },
  {
    id: '5',
    eventType: 'data_modification',
    action: 'User profile updated',
    result: 'success',
    userId: 'hr.manager@company.com',
    ipAddress: '10.0.0.22',
    sessionId: 'sess_hr_update',
    resource: '/users/john.doe/profile',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    details: { fieldsChanged: ['department', 'manager'], previousValues: { department: 'Engineering', manager: 'old.manager@company.com' } }
  }
];

export default AuditTrailViewer;
