/**
 * MONOLITH OS - Security Settings Page
 * Task 7.5.1 - User security preferences
 * 
 * Password change, 2FA setup, session management
 * Security notification preferences
 */

import { useState, useCallback } from 'react';

// Mock session data
const getMockSessions = () => [
  { id: 1, device: 'Chrome on Windows', location: 'New York, US', ip: '192.168.1.1', lastActive: new Date(Date.now() - 300000).toISOString(), current: true },
  { id: 2, device: 'Safari on macOS', location: 'San Francisco, US', ip: '192.168.1.2', lastActive: new Date(Date.now() - 3600000).toISOString(), current: false },
  { id: 3, device: 'Firefox on Linux', location: 'London, UK', ip: '192.168.1.3', lastActive: new Date(Date.now() - 86400000).toISOString(), current: false },
  ];

// Mock login history
const getMockLoginHistory = () => [
  { id: 1, date: new Date(Date.now() - 300000).toISOString(), device: 'Chrome on Windows', location: 'New York, US', ip: '192.168.1.1', status: 'success' },
  { id: 2, date: new Date(Date.now() - 86400000).toISOString(), device: 'Chrome on Windows', location: 'New York, US', ip: '192.168.1.1', status: 'success' },
  { id: 3, date: new Date(Date.now() - 172800000).toISOString(), device: 'Unknown Device', location: 'Moscow, RU', ip: '45.67.89.10', status: 'failed' },
  { id: 4, date: new Date(Date.now() - 259200000).toISOString(), device: 'Safari on macOS', location: 'San Francisco, US', ip: '192.168.1.2', status: 'success' },
  { id: 5, date: new Date(Date.now() - 345600000).toISOString(), device: 'Chrome on Windows', location: 'New York, US', ip: '192.168.1.1', status: 'success' },
  { id: 6, date: new Date(Date.now() - 432000000).toISOString(), device: 'Mobile App on iOS', location: 'New York, US', ip: '192.168.1.5', status: 'success' },
  { id: 7, date: new Date(Date.now() - 518400000).toISOString(), device: 'Chrome on Windows', location: 'Boston, US', ip: '192.168.2.1', status: 'success' },
  ];

const SecuritySettings = () => {
    // Password change state
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    // 2FA state
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [showSetup2FA, setShowSetup2FA] = useState(false);

    // Sessions state
    const [sessions, setSessions] = useState(getMockSessions());

    // Login history
    const [loginHistory] = useState(getMockLoginHistory());

    // Notification preferences
    const [notifications, setNotifications] = useState({
          loginAlerts: true,
          newDeviceAlerts: true,
          passwordChanges: true,
          weeklyReport: false
    });

    const handlePasswordChange = useCallback((e) => {
          const { name, value } = e.target;
          setPasswords(prev => ({ ...prev, [name]: value }));
          setPasswordError('');
          setPasswordSuccess(false);
    }, []);

    const handlePasswordSubmit = useCallback((e) => {
          e.preventDefault();
          if (passwords.new !== passwords.confirm) {
                  setPasswordError('New passwords do not match');
                  return;
          }
          if (passwords.new.length < 8) {
                  setPasswordError('Password must be at least 8 characters');
                  return;
          }
          // Simulate password change
                                                 setPasswordSuccess(true);
          setPasswords({ current: '', new: '', confirm: '' });
    }, [passwords]);

    const handleSignOutAll = useCallback(() => {
          setSessions(prev => prev.filter(s => s.current));
    }, []);

    const handleSignOutSession = useCallback((sessionId) => {
          setSessions(prev => prev.filter(s => s.id !== sessionId));
    }, []);

    const handleNotificationChange = useCallback((key) => {
          setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const formatDate = (dateString) => new Date(dateString).toLocaleString();

    return (
          <div className="p-6 bg-monolith-dark min-h-screen">
            {/* Header */}
                <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                  <svg className="w-8 h-8 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>svg>
                                  Security Settings
                        </h1>h1>
                        <p className="text-gray-400 mt-1">Manage your account security and preferences</p>p>
                </div>div>
          
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Password Change Section */}
                        <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                              <svg className="w-5 h-5 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                              </svg>svg>
                                              Change Password
                                  </h2>h2>
                                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                              <div>
                                                            <label className="block text-gray-400 text-sm mb-2">Current Password</label>label>
                                                            <input
                                                                              type="password"
                                                                              name="current"
                                                                              value={passwords.current}
                                                                              onChange={handlePasswordChange}
                                                                              className="w-full px-4 py-2 bg-monolith-dark border border-monolith-gray rounded-lg text-white focus:border-monolith-green focus:outline-none"
                                                                              placeholder="Enter current password"
                                                                            />
                                              </div>div>
                                              <div>
                                                            <label className="block text-gray-400 text-sm mb-2">New Password</label>label>
                                                            <input
                                                                              type="password"
                                                                              name="new"
                                                                              value={passwords.new}
                                                                              onChange={handlePasswordChange}
                                                                              className="w-full px-4 py-2 bg-monolith-dark border border-monolith-gray rounded-lg text-white focus:border-monolith-green focus:outline-none"
                                                                              placeholder="Enter new password"
                                                                            />
                                              </div>div>
                                              <div>
                                                            <label className="block text-gray-400 text-sm mb-2">Confirm New Password</label>label>
                                                            <input
                                                                              type="password"
                                                                              name="confirm"
                                                                              value={passwords.confirm}
                                                                              onChange={handlePasswordChange}
                                                                              className="w-full px-4 py-2 bg-monolith-dark border border-monolith-gray rounded-lg text-white focus:border-monolith-green focus:outline-none"
                                                                              placeholder="Confirm new password"
                                                                            />
                                              </div>div>
                                    {passwordError && (
                          <p className="text-red-400 text-sm">{passwordError}</p>p>
                                              )}
                                    {passwordSuccess && (
                          <p className="text-monolith-green text-sm">Password updated successfully!</p>p>
                                              )}
                                              <button
                                                              type="submit"
                                                              className="w-full px-4 py-2 bg-monolith-green text-monolith-dark rounded-lg hover:bg-monolith-green/90 transition-colors font-medium"
                                                            >
                                                            Update Password
                                              </button>button>
                                  </form>form>
                        </div>div>
                
                  {/* Two-Factor Authentication */}
                        <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                              <svg className="w-5 h-5 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                              </svg>svg>
                                              Two-Factor Authentication
                                  </h2>h2>
                                  <div className="flex items-center justify-between mb-4">
                                              <div>
                                                            <p className="text-white">Enable 2FA</p>p>
                                                            <p className="text-gray-500 text-sm">Add extra security to your account</p>p>
                                              </div>div>
                                              <button
                                                              onClick={() => {
                                                                                if (!twoFactorEnabled) {
                                                                                                    setShowSetup2FA(true);
                                                                                } else {
                                                                                                    setTwoFactorEnabled(false);
                                                                                }
                                                              }}
                                                              className={`relative w-14 h-7 rounded-full transition-colors ${twoFactorEnabled ? 'bg-monolith-green' : 'bg-monolith-gray'}`}
                                                            >
                                                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${twoFactorEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
                                              </button>button>
                                  </div>div>
                          {showSetup2FA && !twoFactorEnabled && (
                        <div className="mt-4 p-4 bg-monolith-dark/50 rounded-lg">
                                      <p className="text-gray-300 text-sm mb-4">
                                                      Scan the QR code with your authenticator app or enter the setup key manually.
                                      </p>p>
                                      <div className="flex justify-center mb-4">
                                                      <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center">
                                                                        <span className="text-monolith-dark text-xs">QR Code Placeholder</span>span>
                                                      </div>div>
                                      </div>div>
                                      <p className="text-gray-500 text-xs text-center mb-4">
                                                      Setup Key: XXXX-XXXX-XXXX-XXXX
                                      </p>p>
                                      <button
                                                        onClick={() => { setTwoFactorEnabled(true); setShowSetup2FA(false); }}
                                                        className="w-full px-4 py-2 bg-monolith-green text-monolith-dark rounded-lg hover:bg-monolith-green/90 transition-colors font-medium"
                                                      >
                                                      Complete Setup
                                      </button>button>
                        </div>div>
                                  )}
                          {twoFactorEnabled && (
                        <div className="flex items-center gap-2 text-monolith-green">
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>svg>
                                      <span className="text-sm">Two-factor authentication is enabled</span>span>
                        </div>div>
                                  )}
                        </div>div>
                
                  {/* Active Sessions */}
                        <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <div className="flex items-center justify-between mb-4">
                                              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                                            <svg className="w-5 h-5 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                            </svg>svg>
                                                            Active Sessions
                                              </h2>h2>
                                              <button
                                                              onClick={handleSignOutAll}
                                                              className="text-red-400 text-sm hover:underline"
                                                            >
                                                            Sign out all other sessions
                                              </button>button>
                                  </div>div>
                                  <div className="space-y-3">
                                    {sessions.map(session => (
                          <div key={session.id} className="flex items-center justify-between p-3 bg-monolith-dark/50 rounded-lg">
                                          <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${session.current ? 'bg-monolith-green' : 'bg-gray-400'}`} />
                                                            <div>
                                                                                <p className="text-white text-sm">{session.device}</p>p>
                                                                                <p className="text-gray-500 text-xs">{session.location} · {session.ip}</p>p>
                                                                                <p className="text-gray-500 text-xs">Last active: {formatDate(session.lastActive)}</p>p>
                                                            </div>div>
                                          </div>div>
                            {!session.current && (
                                              <button
                                                                    onClick={() => handleSignOutSession(session.id)}
                                                                    className="text-red-400 text-sm hover:underline"
                                                                  >
                                                                  Sign out
                                              </button>button>
                                          )}
                            {session.current && (
                                              <span className="text-monolith-green text-xs">Current</span>span>
                                          )}
                          </div>div>
                        ))}
                                  </div>div>
                        </div>div>
                
                  {/* Security Notifications */}
                        <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                              <svg className="w-5 h-5 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                              </svg>svg>
                                              Security Notifications
                                  </h2>h2>
                                  <div className="space-y-4">
                                    {[
            { key: 'loginAlerts', label: 'Login alerts', desc: 'Get notified of new logins' },
            { key: 'newDeviceAlerts', label: 'New device alerts', desc: 'Alert when a new device is used' },
            { key: 'passwordChanges', label: 'Password changes', desc: 'Notify on password updates' },
            { key: 'weeklyReport', label: 'Weekly security report', desc: 'Receive weekly security summary' }
                        ].map(item => (
                                        <div key={item.key} className="flex items-center justify-between">
                                                        <div>
                                                                          <p className="text-white text-sm">{item.label}</p>p>
                                                                          <p className="text-gray-500 text-xs">{item.desc}</p>p>
                                                        </div>div>
                                                        <button
                                                                            onClick={() => handleNotificationChange(item.key)}
                                                                            className={`relative w-12 h-6 rounded-full transition-colors ${notifications[item.key] ? 'bg-monolith-green' : 'bg-monolith-gray'}`}
                                                                          >
                                                                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${notifications[item.key] ? 'translate-x-7' : 'translate-x-1'}`} />
                                                        </button>button>
                                        </div>div>
                                      ))}
                                  </div>div>
                        </div>div>
                </div>div>
          
            {/* Login History */}
                <div className="mt-6 bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                  <svg className="w-5 h-5 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>svg>
                                  Login History
                        </h2>h2>
                        <div className="overflow-x-auto">
                                  <table className="w-full">
                                              <thead>
                                                            <tr className="text-left text-gray-500 text-sm border-b border-monolith-gray/30">
                                                                            <th className="pb-3 pr-4">Date & Time</th>th>
                                                                            <th className="pb-3 pr-4">Device</th>th>
                                                                            <th className="pb-3 pr-4">Location</th>th>
                                                                            <th className="pb-3 pr-4">IP Address</th>th>
                                                                            <th className="pb-3">Status</th>th>
                                                            </tr>tr>
                                              </thead>thead>
                                              <tbody>
                                                {loginHistory.map(entry => (
                            <tr key={entry.id} className="border-b border-monolith-gray/20 last:border-0">
                                              <td className="py-3 pr-4 text-gray-300 text-sm">{formatDate(entry.date)}</td>td>
                                              <td className="py-3 pr-4 text-gray-300 text-sm">{entry.device}</td>td>
                                              <td className="py-3 pr-4 text-gray-300 text-sm">{entry.location}</td>td>
                                              <td className="py-3 pr-4 text-gray-300 text-sm font-mono">{entry.ip}</td>td>
                                              <td className="py-3">
                                                                  <span className={`px-2 py-1 text-xs rounded ${entry.status === 'success' ? 'bg-monolith-green/20 text-monolith-green' : 'bg-red-900/20 text-red-400'}`}>
                                                                    {entry.status}
                                                                  </span>span>
                                              </td>td>
                            </tr>tr>
                          ))}
                                              </tbody>tbody>
                                  </table>table>
                        </div>div>
                </div>div>
          </div>div>
        );
};

export default SecuritySettings;</div>
