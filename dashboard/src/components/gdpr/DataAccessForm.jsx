/**
 * MONOLITH OS - Data Access Request Form
 * Phase 7.1.3.4 - Create data access request form
 * 
 * User-facing form for submitting Data Subject Requests (DSR)
 * Supports access, rectification, and erasure requests per GDPR
 */

import { useState, useCallback } from 'react';

// Request type configurations
const REQUEST_TYPES = {
    access: {
          name: 'Data Access',
          description: 'Request a copy of all personal data we hold about you',
          icon: '📋',
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/30'
    },
    rectification: {
          name: 'Data Rectification',
          description: 'Request correction of inaccurate personal data',
          icon: '✏️',
          color: 'text-amber-400',
          bgColor: 'bg-amber-900/30'
    },
    erasure: {
          name: 'Data Erasure',
          description: 'Request deletion of your personal data (Right to be Forgotten)',
          icon: '🗑️',
          color: 'text-red-400',
          bgColor: 'bg-red-900/30'
    }
};

// CSRF Token handler
const getCSRFToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
};

// Request type selection card
const RequestTypeCard = ({ type, config, isSelected, onSelect }) => (
    <button
          onClick={() => onSelect(type)}
          className={`p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? `${config.bgColor} border-current ${config.color}`
                    : 'bg-monolith-gray/20 border-monolith-gray/30 hover:border-monolith-gray/50'
          }`}
        >
        <div className="flex items-center gap-3">
              <span className="text-2xl">{config.icon}</span>span>
              <div>
                      <h3 className={`font-medium ${isSelected ? config.color : 'text-white'}`}>
                        {config.name}
                      </h3>h3>
                      <p className="text-gray-400 text-sm mt-1">{config.description}</p>p>
              </div>div>
        </div>div>
    </button>button>
  );

// Main DataAccessForm component
const DataAccessForm = () => {
    const [formData, setFormData] = useState({
          requestType: '',
          email: '',
          fullName: '',
          description: '',
          additionalInfo: ''
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitResult, setSubmitResult] = useState(null);
  
    // Validate form fields
    const validateForm = useCallback(() => {
          const newErrors = {};
          
          if (!formData.requestType) {
                  newErrors.requestType = 'Please select a request type';
          }
          
          if (!formData.email) {
                  newErrors.email = 'Email is required';
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                  newErrors.email = 'Please enter a valid email address';
          }
          
                if (!formData.fullName) {
                        newErrors.fullName = 'Full name is required';
                }
          
          if (!formData.description) {
                  newErrors.description = 'Please describe your request';
          }
          
          setErrors(newErrors);
          return Object.keys(newErrors).length === 0;
    }, [formData]);
  
    // Handle form submission
    const handleSubmit = async (e) => {
          e.preventDefault();
          
          if (!validateForm()) return;
          
          setIsSubmitting(true);
          setSubmitResult(null);
          
          try {
                  const response = await fetch('/api/gdpr/requests', {
                            method: 'POST',
                            headers: {
                                        'Content-Type': 'application/json',
                                        'X-CSRF-Token': getCSRFToken()
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify(formData)
                  });
                  
                  if (!response.ok) throw new Error('Failed to submit request');
                  
                  const data = await response.json();
                  setSubmitResult({
                            success: true,
                            trackingNumber: data.trackingNumber || `DSR-${Date.now().toString(36).toUpperCase()}`
                  });
                  
                  // Reset form on success
                  setFormData({
                            requestType: '',
                            email: '',
                            fullName: '',
                            description: '',
                            additionalInfo: ''
                  });
          } catch (err) {
                  setSubmitResult({
                            success: false,
                            error: err.message
                  });
          } finally {
                  setIsSubmitting(false);
          }
    };
  
    // Handle input changes
    const handleChange = (field, value) => {
          setFormData(prev => ({ ...prev, [field]: value }));
          if (errors[field]) {
                  setErrors(prev => ({ ...prev, [field]: null }));
          }
    };
  
    return (
          <div className="p-6 bg-monolith-dark min-h-screen">
            {/* Header */}
                <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                  <svg className="w-8 h-8 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>svg>
                                  Data Subject Request
                        </h1>h1>
                        <p className="text-gray-400 mt-2">
                                  Submit a request to access, correct, or delete your personal data under GDPR
                        </p>p>
                </div>div>
          
            {/* Success Message */}
            {submitResult?.success && (
                    <div className="mb-6 p-6 bg-monolith-green/20 border border-monolith-green rounded-lg">
                              <div className="flex items-start gap-4">
                                          <span className="text-3xl">✅</span>span>
                                          <div>
                                                        <h3 className="text-monolith-green font-bold text-lg">Request Submitted Successfully</h3>h3>
                                                        <p className="text-gray-300 mt-2">
                                                                        Your request has been received. We will process it within 30 days as required by GDPR.
                                                        </p>p>
                                                        <div className="mt-4 p-4 bg-monolith-dark rounded-lg">
                                                                        <p className="text-gray-400 text-sm">Your tracking number:</p>p>
                                                                        <p className="text-white font-mono text-lg mt-1">{submitResult.trackingNumber}</p>p>
                                                        </div>div>
                                                        <p className="text-gray-400 text-sm mt-4">
                                                                        Please save this tracking number to check the status of your request.
                                                        </p>p>
                                          </div>div>
                              </div>div>
                    </div>div>
                )}
          
            {/* Error Message */}
            {submitResult?.success === false && (
                    <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400" role="alert">
                              Failed to submit request: {submitResult.error}. Please try again.
                    </div>div>
                )}
          
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Request Type Selection */}
                        <div>
                                  <label className="block text-white font-medium mb-4">
                                              Select Request Type <span className="text-red-400">*</span>span>
                                  </label>label>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {Object.entries(REQUEST_TYPES).map(([type, config]) => (
                          <RequestTypeCard
                                            key={type}
                                            type={type}
                                            config={config}
                                            isSelected={formData.requestType === type}
                                            onSelect={(t) => handleChange('requestType', t)}
                                          />
                        ))}
                                  </div>div>
                          {errors.requestType && (
                        <p className="text-red-400 text-sm mt-2">{errors.requestType}</p>p>
                                  )}
                        </div>div>
                
                  {/* Personal Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                              <label htmlFor="fullName" className="block text-white font-medium mb-2">
                                                            Full Name <span className="text-red-400">*</span>span>
                                              </label>label>
                                              <input
                                                              type="text"
                                                              id="fullName"
                                                              value={formData.fullName}
                                                              onChange={(e) => handleChange('fullName', e.target.value)}
                                                              className={`w-full px-4 py-3 bg-monolith-gray/30 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-monolith-green ${
                                                                                errors.fullName ? 'border-red-500' : 'border-monolith-gray'
                                                              }`}
                                                              placeholder="Enter your full legal name"
                                                            />
                                    {errors.fullName && (
                          <p className="text-red-400 text-sm mt-1">{errors.fullName}</p>p>
                                              )}
                                  </div>div>
                        
                                  <div>
                                              <label htmlFor="email" className="block text-white font-medium mb-2">
                                                            Email Address <span className="text-red-400">*</span>span>
                                              </label>label>
                                              <input
                                                              type="email"
                                                              id="email"
                                                              value={formData.email}
                                                              onChange={(e) => handleChange('email', e.target.value)}
                                                              className={`w-full px-4 py-3 bg-monolith-gray/30 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-monolith-green ${
                                                                                errors.email ? 'border-red-500' : 'border-monolith-gray'
                                                              }`}
                                                              placeholder="your.email@example.com"
                                                            />
                                    {errors.email && (
                          <p className="text-red-400 text-sm mt-1">{errors.email}</p>p>
                                              )}
                                  </div>div>
                        </div>div>
                
                  {/* Request Description */}
                        <div>
                                  <label htmlFor="description" className="block text-white font-medium mb-2">
                                              Request Description <span className="text-red-400">*</span>span>
                                  </label>label>
                                  <textarea
                                                id="description"
                                                value={formData.description}
                                                onChange={(e) => handleChange('description', e.target.value)}
                                                rows={4}
                                                className={`w-full px-4 py-3 bg-monolith-gray/30 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-monolith-green resize-none ${
                                                                errors.description ? 'border-red-500' : 'border-monolith-gray'
                                                }`}
                                                placeholder="Please describe your request in detail..."
                                              />
                          {errors.description && (
                        <p className="text-red-400 text-sm mt-1">{errors.description}</p>p>
                                  )}
                        </div>div>
                
                  {/* Additional Information */}
                        <div>
                                  <label htmlFor="additionalInfo" className="block text-white font-medium mb-2">
                                              Additional Information (Optional)
                                  </label>label>
                                  <textarea
                                                id="additionalInfo"
                                                value={formData.additionalInfo}
                                                onChange={(e) => handleChange('additionalInfo', e.target.value)}
                                                rows={3}
                                                className="w-full px-4 py-3 bg-monolith-gray/30 border border-monolith-gray rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-monolith-green resize-none"
                                                placeholder="Any additional details that may help us process your request..."
                                              />
                        </div>div>
                
                  {/* Privacy Notice */}
                        <div className="p-4 bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg">
                                  <h4 className="text-white font-medium mb-2">Privacy Notice</h4>h4>
                                  <p className="text-gray-400 text-sm">
                                              The information you provide will be used solely to verify your identity and process your request. 
                                              We will respond to your request within 30 days as required by GDPR. For complex requests, 
                                              we may extend this period by up to 60 additional days, in which case we will notify you.
                                  </p>p>
                        </div>div>
                
                  {/* Submit Button */}
                        <div className="flex justify-end">
                                  <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className={`px-8 py-3 rounded-lg font-medium transition-all ${
                                                                isSubmitting
                                                                  ? 'bg-monolith-gray text-gray-500 cursor-not-allowed'
                                                                  : 'bg-monolith-green text-monolith-dark hover:bg-monolith-green/90'
                                                }`}
                                              >
                                    {isSubmitting ? (
                                                              <span className="flex items-center gap-2">
                                                                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                              </svg>svg>
                                                                              Submitting...
                                                              </span>span>
                                                            ) : (
                                                              'Submit Request'
                                                            )}
                                  </button>button>
                        </div>div>
                </form>form>
          </div>div>
        );
};

export default DataAccessForm;</button>
