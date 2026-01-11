/**
 * MONOLITH OS - Account Deletion Flow
 * Phase 7.1.3.6 - Implement account deletion flow
 * 
 * Multi-step account deletion with confirmation
 * GDPR compliant right to erasure implementation
 */

import { useState, useCallback } from 'react';

// Deletion steps
const STEPS = {
    WARNING: 0,
    DATA_REVIEW: 1,
    CONFIRMATION: 2,
    FINAL: 3
};

// CSRF Token handler
const getCSRFToken = () => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
};

// Step indicator component
const StepIndicator = ({ currentStep }) => {
    const steps = ['Warning', 'Data Review', 'Confirmation', 'Final'];

    return (
          <div className="flex items-center justify-center mb-8">
            {steps.map((step, index) => (
                    <div key={step} className="flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
                                  index < currentStep ? 'bg-monolith-green text-monolith-dark' :
                                  index === currentStep ? 'bg-red-500 text-white' :
                                  'bg-monolith-gray/30 text-gray-500'
                    }`}>
                                {index < currentStep ? '✓' : index + 1}
                              </div>div>
                      {index < steps.length - 1 && (
                                  <div className={`w-16 h-1 mx-2 ${
                                                  index < currentStep ? 'bg-monolith-green' : 'bg-monolith-gray/30'
                                  }`} />
                                )}
                    </div>div>
                  ))}
          </div>div>
        );
};

// Main AccountDeletion component
const AccountDeletion = () => {
    const [currentStep, setCurrentStep] = useState(STEPS.WARNING);
    const [confirmText, setConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState(null);
    const [deletionComplete, setDeletionComplete] = useState(false);
  
    // Mock user data for review
    const userData = {
          profile: { count: 1, description: 'Profile information, settings' },
          activity: { count: 156, description: 'Login history, actions' },
          files: { count: 23, description: 'Uploaded documents, images' },
          messages: { count: 47, description: 'Support tickets, communications' },
          transactions: { count: 12, description: 'Billing history, invoices' }
    };
  
    const CONFIRMATION_TEXT = 'DELETE MY ACCOUNT';
  
    // Handle account deletion
    const handleDelete = async () => {
          if (confirmText !== CONFIRMATION_TEXT) return;
          
          setIsDeleting(true);
          setError(null);
          
          try {
                  const response = await fetch('/api/gdpr/account', {
                            method: 'DELETE',
                            headers: {
                                        'Content-Type': 'application/json',
                                        'X-CSRF-Token': getCSRFToken()
                            },
                            credentials: 'same-origin'
                  });
                  
                  if (!response.ok) throw new Error('Failed to delete account');
                  
                  setDeletionComplete(true);
                  setCurrentStep(STEPS.FINAL);
          } catch (err) {
                  setError(err.message);
          } finally {
                  setIsDeleting(false);
          }
    };
  
    // Navigate between steps
    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.FINAL));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, STEPS.WARNING));
  
    return (
          <div className="p-6 bg-monolith-dark min-h-screen">
            {/* Header */}
                <div className="mb-8 text-center">
                        <h1 className="text-2xl font-bold text-red-400 flex items-center justify-center gap-3">
                                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>svg>
                                  Delete Your Account
                        </h1>h1>
                        <p className="text-gray-400 mt-2">
                                  This action is permanent and cannot be undone
                        </p>p>
                </div>div>
          
            {!deletionComplete && <StepIndicator currentStep={currentStep} />}
          
            {/* Error Message */}
            {error && (
                    <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400" role="alert">
                      {error}
                    </div>div>
                )}
          
            {/* Step Content */}
                <div className="max-w-2xl mx-auto">
                  {/* Step 1: Warning */}
                  {currentStep === STEPS.WARNING && (
                      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
                                  <div className="text-center mb-6">
                                                <span className="text-6xl">⚠️</span>span>
                                                <h2 className="text-xl font-bold text-red-400 mt-4">Are you sure you want to delete your account?</h2>h2>
                                  </div>div>
                                  
                                  <div className="space-y-4 text-gray-300">
                                                <p>Deleting your account will:</p>p>
                                                <ul className="list-disc list-inside space-y-2 text-gray-400">
                                                                <li>Permanently delete all your personal data</li>li>
                                                                <li>Remove access to all services</li>li>
                                                                <li>Cancel any active subscriptions</li>li>
                                                                <li>Delete all uploaded files and documents</li>li>
                                                                <li>Remove your communication history</li>li>
                                                </ul>ul>
                                                
                                                <div className="mt-6 p-4 bg-monolith-gray/30 rounded-lg">
                                                                <h3 className="text-monolith-amber font-medium mb-2">30-Day Grace Period</h3>h3>
                                                                <p className="text-sm text-gray-400">
                                                                                  After deletion, you have 30 days to recover your account by contacting support. 
                                                                                  After this period, all data will be permanently erased.
                                                                </p>p>
                                                </div>div>
                                  </div>div>
                                  
                                  <div className="flex justify-between mt-8">
                                                <button
                                                                  onClick={() => window.history.back()}
                                                                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                                                                >
                                                                Cancel
                                                </button>button>
                                                <button
                                                                  onClick={nextStep}
                                                                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                                >
                                                                I Understand, Continue
                                                </button>button>
                                  </div>div>
                      </div>div>
                        )}
                
                  {/* Step 2: Data Review */}
                  {currentStep === STEPS.DATA_REVIEW && (
                      <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <h2 className="text-xl font-bold text-white mb-6">Data That Will Be Deleted</h2>h2>
                                  
                                  <div className="space-y-4">
                                    {Object.entries(userData).map(([key, data]) => (
                                        <div key={key} className="flex items-center justify-between p-4 bg-monolith-dark rounded-lg">
                                                          <div>
                                                                              <h3 className="text-white font-medium capitalize">{key}</h3>h3>
                                                                              <p className="text-gray-400 text-sm">{data.description}</p>p>
                                                          </div>div>
                                                          <span className="text-red-400 font-mono">{data.count} items</span>span>
                                        </div>div>
                                      ))}
                                  </div>div>
                                  
                                  <div className="flex justify-between mt-8">
                                                <button
                                                                  onClick={prevStep}
                                                                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                                                                >
                                                                Back
                                                </button>button>
                                                <button
                                                                  onClick={nextStep}
                                                                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                                >
                                                                Continue to Confirmation
                                                </button>button>
                                  </div>div>
                      </div>div>
                        )}
                
                  {/* Step 3: Confirmation */}
                  {currentStep === STEPS.CONFIRMATION && (
                      <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <h2 className="text-xl font-bold text-white mb-6">Final Confirmation</h2>h2>
                                  
                                  <p className="text-gray-300 mb-6">
                                                To confirm account deletion, please type <span className="font-mono text-red-400 bg-red-900/30 px-2 py-1 rounded">{CONFIRMATION_TEXT}</span>span> below:
                                  </p>p>
                                  
                                  <input
                                                  type="text"
                                                  value={confirmText}
                                                  onChange={(e) => setConfirmText(e.target.value)}
                                                  className={`w-full px-4 py-3 bg-monolith-dark border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${
                                                                    confirmText === CONFIRMATION_TEXT ? 'border-red-500 focus:ring-red-500' : 'border-monolith-gray focus:ring-monolith-green'
                                                  }`}
                                                  placeholder="Type confirmation text here"
                                                />
                                  
                                  <div className="flex justify-between mt-8">
                                                <button
                                                                  onClick={prevStep}
                                                                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                                                                >
                                                                Back
                                                </button>button>
                                                <button
                                                                  onClick={handleDelete}
                                                                  disabled={confirmText !== CONFIRMATION_TEXT || isDeleting}
                                                                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                                                                                      confirmText !== CONFIRMATION_TEXT || isDeleting
                                                                                        ? 'bg-monolith-gray text-gray-500 cursor-not-allowed'
                                                                                        : 'bg-red-500 text-white hover:bg-red-600'
                                                                  }`}
                                                                >
                                                  {isDeleting ? 'Deleting...' : 'Delete My Account Permanently'}
                                                </button>button>
                                  </div>div>
                      </div>div>
                        )}
                
                  {/* Step 4: Completion */}
                  {currentStep === STEPS.FINAL && deletionComplete && (
                      <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6 text-center">
                                  <span className="text-6xl">👋</span>span>
                                  <h2 className="text-xl font-bold text-white mt-4">Account Deletion Initiated</h2>h2>
                                  <p className="text-gray-400 mt-4">
                                                Your account has been scheduled for deletion. You will receive a confirmation email shortly.
                                  </p>p>
                                  <div className="mt-6 p-4 bg-monolith-amber/20 border border-monolith-amber/50 rounded-lg">
                                                <p className="text-monolith-amber text-sm">
                                                                You have 30 days to recover your account by contacting support at support@monolith.com
                                                </p>p>
                                  </div>div>
                                  <button
                                                  onClick={() => window.location.href = '/'}
                                                  className="mt-8 px-6 py-2 bg-monolith-gray text-white rounded-lg hover:bg-monolith-gray/80 transition-colors"
                                                >
                                                Return to Homepage
                                  </button>button>
                      </div>div>
                        )}
                </div>div>
          </div>div>
        );
};

export default AccountDeletion;</div>
