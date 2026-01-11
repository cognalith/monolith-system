/**
 * MONOLITH OS - Data Export UI
 * Phase 7.1.3.5 - Build data export UI
 * 
 * Allow users to download their personal data in JSON format
 * GDPR compliant data portability feature
 */

import { useState, useCallback } from 'react';

// Data categories that can be exported
const DATA_CATEGORIES = [
  { id: 'profile', name: 'Profile Information', icon: '👤', description: 'Name, email, contact details' },
  { id: 'activity', name: 'Activity History', icon: '📊', description: 'Login history, actions taken' },
  { id: 'preferences', name: 'Preferences & Settings', icon: '⚙️', description: 'UI preferences, notification settings' },
  { id: 'communications', name: 'Communications', icon: '💬', description: 'Messages, support tickets' },
  { id: 'transactions', name: 'Transaction History', icon: '💳', description: 'Purchases, billing records' },
  { id: 'uploads', name: 'Uploaded Content', icon: '📁', description: 'Files and documents you uploaded' }
  ];

// CSRF Token handler
const getCSRFToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
};

// Category selection card
const CategoryCard = ({ category, isSelected, onToggle }) => (
    <button
          onClick={() => onToggle(category.id)}
          className={`p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-monolith-green/20 border-monolith-green'
                    : 'bg-monolith-gray/20 border-monolith-gray/30 hover:border-monolith-gray/50'
          }`}
        >
        <div className="flex items-center gap-3">
              <span className="text-2xl">{category.icon}</span>span>
              <div className="flex-1">
                      <div className="flex items-center justify-between">
                                <h3 className={`font-medium ${isSelected ? 'text-monolith-green' : 'text-white'}`}>
                                  {category.name}
                                </h3>h3>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'bg-monolith-green border-monolith-green' : 'border-gray-500'
        }`}>
                                  {isSelected && <span className="text-white text-xs">✓</span>span>}
                                </div>div>
                      </div>div>
                      <p className="text-gray-400 text-sm mt-1">{category.description}</p>p>
              </div>div>
        </div>div>
    </button>button>
  );

// Main DataExport component
const DataExport = () => {
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [exportFormat, setExportFormat] = useState('json');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportResult, setExportResult] = useState(null);
  
    // Toggle category selection
    const toggleCategory = useCallback((categoryId) => {
          setSelectedCategories(prev => 
                  prev.includes(categoryId)
                    ? prev.filter(id => id !== categoryId)
                    : [...prev, categoryId]
                );
    }, []);
  
    // Select all categories
    const selectAll = useCallback(() => {
          setSelectedCategories(DATA_CATEGORIES.map(c => c.id));
    }, []);
  
    // Clear selection
    const clearSelection = useCallback(() => {
          setSelectedCategories([]);
    }, []);
  
    // Handle export request
    const handleExport = async () => {
          if (selectedCategories.length === 0) return;
          
          setIsExporting(true);
          setExportProgress(0);
          setExportResult(null);
          
          try {
                  // Simulate progress
                  const progressInterval = setInterval(() => {
                            setExportProgress(prev => Math.min(prev + 10, 90));
                  }, 200);
                  
                  const response = await fetch('/api/gdpr/export', {
                            method: 'POST',
                            headers: {
                                        'Content-Type': 'application/json',
                                        'X-CSRF-Token': getCSRFToken()
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify({
                                        categories: selectedCategories,
                                        format: exportFormat
                            })
                  });
                  
                  clearInterval(progressInterval);
                  setExportProgress(100);
                  
                  if (!response.ok) throw new Error('Export failed');
                  
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `my-data-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  a.remove();
                  
                  setExportResult({ success: true });
          } catch (err) {
                  setExportResult({ success: false, error: err.message });
          } finally {
                  setIsExporting(false);
                  setExportProgress(0);
          }
    };
  
    return (
          <div className="p-6 bg-monolith-dark min-h-screen">
            {/* Header */}
                <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                  <svg className="w-8 h-8 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>svg>
                                  Export Your Data
                        </h1>h1>
                        <p className="text-gray-400 mt-2">
                                  Download a copy of your personal data as required by GDPR Article 20 (Right to Data Portability)
                        </p>p>
                </div>div>
          
            {/* Success Message */}
            {exportResult?.success && (
                    <div className="mb-6 p-4 bg-monolith-green/20 border border-monolith-green rounded-lg">
                              <div className="flex items-center gap-3">
                                          <span className="text-2xl">✅</span>span>
                                          <div>
                                                        <h3 className="text-monolith-green font-medium">Export Complete!</h3>h3>
                                                        <p className="text-gray-300 text-sm">Your data has been downloaded successfully.</p>p>
                                          </div>div>
                              </div>div>
                    </div>div>
                )}
          
            {/* Error Message */}
            {exportResult?.success === false && (
                    <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400" role="alert">
                              Export failed: {exportResult.error}. Please try again.
                    </div>div>
                )}
          
            {/* Category Selection */}
                <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                                  <h2 className="text-lg font-medium text-white">Select Data to Export</h2>h2>
                                  <div className="flex gap-2">
                                              <button
                                                              onClick={selectAll}
                                                              className="px-3 py-1 text-sm text-monolith-green hover:bg-monolith-green/10 rounded transition-colors"
                                                            >
                                                            Select All
                                              </button>button>
                                              <button
                                                              onClick={clearSelection}
                                                              className="px-3 py-1 text-sm text-gray-400 hover:bg-monolith-gray/30 rounded transition-colors"
                                                            >
                                                            Clear
                                              </button>button>
                                  </div>div>
                        </div>div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {DATA_CATEGORIES.map(category => (
                        <CategoryCard
                                        key={category.id}
                                        category={category}
                                        isSelected={selectedCategories.includes(category.id)}
                                        onToggle={toggleCategory}
                                      />
                      ))}
                        </div>div>
                        
                  {selectedCategories.length === 0 && (
                      <p className="text-amber-400 text-sm mt-4">
                                  Please select at least one category to export
                      </p>p>
                        )}
                </div>div>
          
            {/* Export Format */}
                <div className="mb-8">
                        <h2 className="text-lg font-medium text-white mb-4">Export Format</h2>h2>
                        <div className="flex gap-4">
                          {['json', 'csv', 'xml'].map(format => (
                        <button
                                        key={format}
                                        onClick={() => setExportFormat(format)}
                                        className={`px-6 py-3 rounded-lg border font-medium uppercase transition-all ${
                                                          exportFormat === format
                                                            ? 'bg-monolith-green/20 border-monolith-green text-monolith-green'
                                                            : 'bg-monolith-gray/20 border-monolith-gray/30 text-gray-400 hover:border-monolith-gray/50'
                                        }`}
                                      >
                          {format}
                        </button>button>
                      ))}
                        </div>div>
                </div>div>
          
            {/* Export Progress */}
            {isExporting && (
                    <div className="mb-8">
                              <div className="flex items-center justify-between mb-2">
                                          <span className="text-white">Preparing your export...</span>span>
                                          <span className="text-monolith-green">{exportProgress}%</span>span>
                              </div>div>
                              <div className="w-full h-2 bg-monolith-gray/30 rounded-full overflow-hidden">
                                          <div 
                                                          className="h-full bg-monolith-green transition-all duration-200"
                                                          style={{ width: `${exportProgress}%` }}
                                                        />
                              </div>div>
                    </div>div>
                )}
          
            {/* Privacy Info */}
                <div className="mb-8 p-4 bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg">
                        <h3 className="text-white font-medium mb-2">What's Included</h3>h3>
                        <p className="text-gray-400 text-sm mb-4">
                                  Your export will include all personal data we hold about you in the selected categories. 
                                  The data is provided in a machine-readable format that you can import into other services.
                        </p>p>
                        <h3 className="text-white font-medium mb-2">Processing Time</h3>h3>
                        <p className="text-gray-400 text-sm">
                                  Most exports complete within a few seconds. Large exports may take longer to process.
                        </p>p>
                </div>div>
          
            {/* Export Button */}
                <div className="flex justify-end">
                        <button
                                    onClick={handleExport}
                                    disabled={isExporting || selectedCategories.length === 0}
                                    className={`px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                                                  isExporting || selectedCategories.length === 0
                                                    ? 'bg-monolith-gray text-gray-500 cursor-not-allowed'
                                                    : 'bg-monolith-green text-monolith-dark hover:bg-monolith-green/90'
                                    }`}
                                  >
                          {isExporting ? (
                                                <>
                                                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                              </svg>svg>
                                                              Exporting...
                                                </>>
                                              ) : (
                                                <>
                                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                              </svg>svg>
                                                              Download My Data
                                                </>>
                                              )}
                        </button>button>
                </div>div>
          </div>div>
        );
};

export default DataExport;</></></button>
