/**
 * MONOLITH OS - Permission Denied Page
 * Task 7.3.1.5 - Create permission denied page
 * 
 * User-friendly 403 error component
 * Displays access denied message with helpful actions
 */

import { useCallback } from 'react';

// PermissionDenied component
const PermissionDenied = ({ reason, requiredPermission, onGoBack, onGoHome }) => {
    const handleGoBack = useCallback(() => {
          if (onGoBack) {
                  onGoBack();
          } else {
                  window.history.back();
          }
    }, [onGoBack]);

    const handleGoHome = useCallback(() => {
          if (onGoHome) {
                  onGoHome();
          } else {
                  window.location.href = '/';
          }
    }, [onGoHome]);

    return (
          <div className="min-h-screen bg-monolith-dark flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center">
                  {/* Error Icon */}
                        <div className="mb-8">
                                  <div className="w-24 h-24 mx-auto bg-red-900/30 rounded-full flex items-center justify-center">
                                              <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                              </svg>svg>
                                  </div>div>
                        </div>div>
                
                  {/* Error Message */}
                        <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>h1>
                        <p className="text-gray-400 mb-2">
                                  You don't have permission to access this resource.
                        </p>p>
                
                  {/* Reason (if provided) */}
                  {reason && (
                      <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-4 mb-6">
                                  <p className="text-gray-300 text-sm">{reason}</p>p>
                      </div>div>
                        )}
                
                  {/* Required Permission (if provided) */}
                  {requiredPermission && (
                      <div className="mb-6">
                                  <p className="text-gray-500 text-sm">Required permission:</p>p>
                                  <span className="inline-block mt-1 px-3 py-1 bg-monolith-amber/20 text-monolith-amber text-sm rounded-full">
                                    {requiredPermission}
                                  </span>span>
                      </div>div>
                        )}
                
                  {/* Error Code */}
                        <div className="mb-8">
                                  <span className="text-6xl font-bold text-monolith-gray/50">403</span>span>
                        </div>div>
                
                  {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                  <button
                                                onClick={handleGoBack}
                                                className="px-6 py-3 bg-monolith-gray/30 text-white rounded-lg hover:bg-monolith-gray/50 transition-colors"
                                              >
                                              Go Back
                                  </button>button>
                                  <button
                                                onClick={handleGoHome}
                                                className="px-6 py-3 bg-monolith-green text-monolith-dark rounded-lg hover:bg-monolith-green/90 transition-colors"
                                              >
                                              Go to Dashboard
                                  </button>button>
                        </div>div>
                
                  {/* Help Link */}
                        <div className="mt-8 pt-8 border-t border-monolith-gray/30">
                                  <p className="text-gray-500 text-sm">
                                              If you believe this is an error, please{' '}
                                              <a href="mailto:admin@monolith.com" className="text-monolith-green hover:underline">
                                                            contact your administrator
                                              </a>a>
                                  </p>p>
                        </div>div>
                </div>div>
          </div>div>
        );
};

export default PermissionDenied;</div>
