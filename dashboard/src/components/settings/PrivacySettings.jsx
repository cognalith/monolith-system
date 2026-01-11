/**
 * MONOLITH OS - Privacy Settings UI
 * Task 7.5.3 - Data sharing and privacy preferences
 * 
 * Data sharing toggles, communication preferences, profile visibility
 * Links to GDPR data management features
 */

import { useState, useCallback } from 'react';

const PrivacySettings = ({ onNavigateToAccountDeletion }) => {
    // Data sharing preferences
    const [dataSharing, setDataSharing] = useState({
          analytics: true,
          marketing: false,
          thirdParty: false,
          performanceData: true
    });

    // Communication preferences
    const [communications, setCommunications] = useState({
          productUpdates: true,
          newsletter: false,
          securityAlerts: true,
          promotions: false
    });

    // Profile visibility
    const [profileVisibility, setProfileVisibility] = useState('team');

    // Data export loading state
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);

    const handleDataSharingChange = useCallback((key) => {
          setDataSharing(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleCommunicationChange = useCallback((key) => {
          setCommunications(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleVisibilityChange = useCallback((e) => {
          setProfileVisibility(e.target.value);
    }, []);

    const handleDownloadData = useCallback(async () => {
          setIsExporting(true);
          setExportSuccess(false);
          // Simulate export process
                                               await new Promise(resolve => setTimeout(resolve, 2000));
          setIsExporting(false);
          setExportSuccess(true);
    }, []);

    const handleDeleteAccount = useCallback(() => {
          if (onNavigateToAccountDeletion) {
                  onNavigateToAccountDeletion();
          } else {
                  window.location.href = '/settings/account/delete';
          }
    }, [onNavigateToAccountDeletion]);

    const ToggleSwitch = ({ enabled, onChange, disabled = false }) => (
          <button
                  onClick={onChange}
                  disabled={disabled}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                            disabled ? 'opacity-50 cursor-not-allowed' : ''
                  } ${enabled ? 'bg-monolith-green' : 'bg-monolith-gray'}`}
                >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>button>
        );
  
    return (
          <div className="p-6 bg-monolith-dark min-h-screen">
            {/* Header */}
                <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                  <svg className="w-8 h-8 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>svg>
                                  Privacy Settings
                        </h1>
                        <p className="text-gray-400 mt-1">Control your data sharing and privacy preferences</p>p>
                </div>div>
          
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Data Sharing */}
                        <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                              <svg className="w-5 h-5 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                              </svg>svg>
                                              Data Sharing
                                  </h2>h2>
                                  <p className="text-gray-400 text-sm mb-4">
                                              Control how your data is used and shared
                                  </p>p>
                                  <div className="space-y-4">
                                              <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                            <p className="text-white">Analytics</p>p>
                                                                            <p className="text-gray-500 text-xs">Help us improve by sharing usage data</p>p>
                                                            </div>div>
                                                            <ToggleSwitch 
                                                                              enabled={dataSharing.analytics} 
                                                              onChange={() => handleDataSharingChange('analytics')} 
                                                            />
                                              </div>div>
                                              <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                            <p className="text-white">Marketing</p>p>
                                                                            <p className="text-gray-500 text-xs">Personalized marketing communications</p>p>
                                                            </div>div>
                                                            <ToggleSwitch 
                                                                              enabled={dataSharing.marketing} 
                                                              onChange={() => handleDataSharingChange('marketing')} 
                                                            />
                                              </div>div>
                                              <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                            <p className="text-white">Third-party sharing</p>p>
                                                                            <p className="text-gray-500 text-xs">Share data with trusted partners</p>p>
                                                            </div>div>
                                                            <ToggleSwitch 
                                                                              enabled={dataSharing.thirdParty} 
                                                              onChange={() => handleDataSharingChange('thirdParty')} 
                                                            />
                                              </div>div>
                                              <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                            <p className="text-white">Performance data</p>p>
                                                                            <p className="text-gray-500 text-xs">System performance metrics</p>p>
                                                            </div>div>
                                                            <ToggleSwitch 
                                                                              enabled={dataSharing.performanceData} 
                                                              onChange={() => handleDataSharingChange('performanceData')} 
                                                            />
                                              </div>div>
                                  </div>div>
                        </div>div>
                
                  {/* Communication Preferences */}
                        <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                              <svg className="w-5 h-5 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                              </svg>svg>
                                              Communication Preferences
                                  </h2>h2>
                                  <p className="text-gray-400 text-sm mb-4">
                                              Choose what emails you receive from us
                                  </p>p>
                                  <div className="space-y-4">
                                              <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                            <p className="text-white">Product updates</p>p>
                                                                            <p className="text-gray-500 text-xs">New features and improvements</p>p>
                                                            </div>div>
                                                            <ToggleSwitch 
                                                                              enabled={communications.productUpdates} 
                                                              onChange={() => handleCommunicationChange('productUpdates')} 
                                                            />
                                              </div>div>
                                              <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                            <p className="text-white">Newsletter</p>p>
                                                                            <p className="text-gray-500 text-xs">Monthly newsletter and tips</p>p>
                                                            </div>div>
                                                            <ToggleSwitch 
                                                                              enabled={communications.newsletter} 
                                                              onChange={() => handleCommunicationChange('newsletter')} 
                                                            />
                                              </div>div>
                                              <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                            <p className="text-white">Security alerts</p>p>
                                                                            <p className="text-gray-500 text-xs">Important security notifications</p>p>
                                                            </div>div>
                                                            <ToggleSwitch 
                                                                              enabled={communications.securityAlerts} 
                                                              onChange={() => handleCommunicationChange('securityAlerts')} 
                                                              disabled={true}
                                                                            />
                                              </div>div>
                                              <div className="flex items-center justify-between py-2">
                                                            <div>
                                                                            <p className="text-white">Promotions</p>p>
                                                                            <p className="text-gray-500 text-xs">Special offers and discounts</p>p>
                                                            </div>div>
                                                            <ToggleSwitch 
                                                                              enabled={communications.promotions} 
                                                              onChange={() => handleCommunicationChange('promotions')} 
                                                            />
                                              </div>div>
                                  </div>div>
                        </div>div>
                
                  {/* Profile Visibility */}
                        <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                              <svg className="w-5 h-5 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                              </svg>svg>
                                              Profile Visibility
                                  </h2>h2>
                                  <p className="text-gray-400 text-sm mb-4">
                                              Control who can see your profile information
                                  </p>p>
                                  <select
                                                value={profileVisibility}
                                                onChange={handleVisibilityChange}
                                                className="w-full px-4 py-3 bg-monolith-dark border border-monolith-gray rounded-lg text-white focus:border-monolith-green focus:outline-none"
                                              >
                                              <option value="public">Public - Anyone can view</option>option>
                                              <option value="team">Team Only - Only team members</option>option>
                                              <option value="private">Private - Only you</option>option>
                                  </select>select>
                                  <div className="mt-4 p-3 bg-monolith-dark/50 rounded-lg">
                                              <p className="text-gray-400 text-sm">
                                                            <span className="text-white font-medium">Current setting:</span>span>{' '}
                                                {profileVisibility === 'public' && 'Your profile is visible to anyone'}
                                                {profileVisibility === 'team' && 'Only team members can see your profile'}
                                                {profileVisibility === 'private' && 'Your profile is hidden from others'}
                                              </p>p>
                                  </div>div>
                        </div>div>
                
                  {/* Data Management */}
                        <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                              <svg className="w-5 h-5 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                              </svg>svg>
                                              Your Data
                                  </h2>h2>
                                  <p className="text-gray-400 text-sm mb-4">
                                              Download or delete your personal data
                                  </p>p>
                                  <div className="space-y-4">
                                    {/* Download Data */}
                                              <div className="p-4 bg-monolith-dark/50 rounded-lg">
                                                            <h3 className="text-white font-medium mb-2">Download my data</h3>h3>
                                                            <p className="text-gray-500 text-sm mb-4">
                                                                            Get a copy of all your data stored in our systems.
                                                            </p>p>
                                                            <button
                                                                              onClick={handleDownloadData}
                                                                              disabled={isExporting}
                                                                              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                                                                                  isExporting 
                                                                                                    ? 'bg-monolith-gray/50 text-gray-500 cursor-not-allowed' 
                                                                                                    : 'bg-monolith-green/20 text-monolith-green border border-monolith-green/50 hover:bg-monolith-green/30'
                                                                              }`}
                                                                            >
                                                              {isExporting ? (
                                                                                                <span className="flex items-center gap-2">
                                                                                                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                                                                                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                                                                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                                                                                      </svg>svg>
                                                                                                                    Preparing export...
                                                                                                  </span>span>
                                                                                              ) : 'Download my data'}
                                                            </button>button>
                                                {exportSuccess && (
                            <p className="text-monolith-green text-sm mt-2 flex items-center gap-1">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                              </svg>svg>
                                              Export ready! Check your email for download link.
                            </p>p>
                                                            )}
                                              </div>div>
                                  
                                    {/* Delete Account */}
                                              <div className="p-4 bg-red-900/10 border border-red-500/30 rounded-lg">
                                                            <h3 className="text-white font-medium mb-2">Delete my account</h3>h3>
                                                            <p className="text-gray-500 text-sm mb-4">
                                                                            Permanently delete your account and all associated data. This action cannot be undone.
                                                            </p>p>
                                                            <button
                                                                              onClick={handleDeleteAccount}
                                                                              className="px-4 py-2 bg-red-900/30 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-900/50 transition-colors font-medium"
                                                                            >
                                                                            Delete my account
                                                            </button>button>
                                              </div>div>
                                  </div>div>
                        </div>div>
                </div>div>
          
            {/* Privacy Policy Link */}
                <div className="mt-6 p-4 bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg">
                        <div className="flex items-center justify-between">
                                  <div>
                                              <h3 className="text-white font-medium">Privacy Policy</h3>h3>
                                              <p className="text-gray-500 text-sm">Read our full privacy policy to understand how we handle your data</p>p>
                                  </div>div>
                                  <a 
                                                href="/privacy-policy" 
                                    className="text-monolith-green hover:underline flex items-center gap-1"
                                              >
                                              View Policy
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                              </svg>svg>
                                  </a>a>
                        </div>div>
                </div>div>
          </div>div>
        );
};

export default PrivacySettings;</button>
