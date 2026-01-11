/**
 * MONOLITH OS - Permission Matrix UI
 * Task 7.3.2.7 - Admin role-permission management
 * 
 * Matrix grid for managing role-permission assignments
 * Filter/search capabilities with save confirmation
 */

import { useState, useCallback, useMemo } from 'react';

// Mock data for roles and permissions
const MOCK_ROLES = [
  { id: 'admin', name: 'Administrator', description: 'Full system access' },
  { id: 'manager', name: 'Manager', description: 'Team and resource management' },
  { id: 'analyst', name: 'Analyst', description: 'Data analysis and reporting' },
  { id: 'user', name: 'User', description: 'Standard user access' },
  { id: 'viewer', name: 'Viewer', description: 'Read-only access' },
  ];

const MOCK_PERMISSIONS = [
  { id: 'users.read', name: 'View Users', category: 'Users' },
  { id: 'users.create', name: 'Create Users', category: 'Users' },
  { id: 'users.update', name: 'Update Users', category: 'Users' },
  { id: 'users.delete', name: 'Delete Users', category: 'Users' },
  { id: 'reports.read', name: 'View Reports', category: 'Reports' },
  { id: 'reports.create', name: 'Create Reports', category: 'Reports' },
  { id: 'reports.export', name: 'Export Reports', category: 'Reports' },
  { id: 'settings.read', name: 'View Settings', category: 'Settings' },
  { id: 'settings.update', name: 'Update Settings', category: 'Settings' },
  { id: 'audit.read', name: 'View Audit Logs', category: 'Audit' },
  { id: 'audit.export', name: 'Export Audit Logs', category: 'Audit' },
  { id: 'data.read', name: 'View Data', category: 'Data' },
  { id: 'data.export', name: 'Export Data', category: 'Data' },
  { id: 'data.delete', name: 'Delete Data', category: 'Data' },
  ];

const INITIAL_MATRIX = {
    admin: ['users.read', 'users.create', 'users.update', 'users.delete', 'reports.read', 'reports.create', 'reports.export', 'settings.read', 'settings.update', 'audit.read', 'audit.export', 'data.read', 'data.export', 'data.delete'],
    manager: ['users.read', 'users.create', 'users.update', 'reports.read', 'reports.create', 'reports.export', 'settings.read', 'audit.read', 'data.read', 'data.export'],
    analyst: ['users.read', 'reports.read', 'reports.create', 'reports.export', 'audit.read', 'data.read', 'data.export'],
    user: ['users.read', 'reports.read', 'data.read'],
    viewer: ['users.read', 'reports.read'],
};

const PermissionMatrix = () => {
    const [matrix, setMatrix] = useState(INITIAL_MATRIX);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [hasChanges, setHasChanges] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Get unique categories
    const categories = useMemo(() => {
    const cats = [...new Set(MOCK_PERMISSIONS.map(p => p.category))];
          return ['all', ...cats];
    }, []);

    // Filter permissions based on search and category
    const filteredPermissions = useMemo(() => {
          return MOCK_PERMISSIONS.filter(permission => {
                  const matchesSearch = permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                               permission.id.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesCategory = selectedCategory === 'all' || permission.category === selectedCategory;
                  return matchesSearch && matchesCategory;
          });
    }, [searchTerm, selectedCategory]);

    // Toggle permission for a role
    const togglePermission = useCallback((roleId, permissionId) => {
          setMatrix(prev => {
                  const rolePermissions = prev[roleId] || [];
                  const hasPermission = rolePermissions.includes(permissionId);
                  return {
                            ...prev,
                            [roleId]: hasPermission
                              ? rolePermissions.filter(p => p !== permissionId)
                                        : [...rolePermissions, permissionId]
                  };
          });
          setHasChanges(true);
          setSaveSuccess(false);
    }, []);

    // Check if role has permission
    const hasPermission = useCallback((roleId, permissionId) => {
          return (matrix[roleId] || []).includes(permissionId);
    }, [matrix]);

    // Handle save
    const handleSave = useCallback(() => {
          setShowSaveConfirm(true);
    }, []);

    const confirmSave = useCallback(() => {
          // Simulate API call
                                        setTimeout(() => {
                                                setShowSaveConfirm(false);
                                                setHasChanges(false);
                                                setSaveSuccess(true);
                                        }, 500);
    }, []);

    // Reset to initial state
    const handleReset = useCallback(() => {
          setMatrix(INITIAL_MATRIX);
          setHasChanges(false);
          setSaveSuccess(false);
    }, []);

    return (
          <div className="p-6 bg-monolith-dark min-h-screen">
            {/* Header */}
                <div className="flex items-center justify-between mb-6">
                        <div>
                                  <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                              <svg className="w-8 h-8 text-monolith-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                              </svg>svg>
                                              Permission Matrix
                                  </h1>h1>
                                  <p className="text-gray-400 mt-1">Manage role-based access control permissions</p>p>
                        </div>div>
                        <div className="flex items-center gap-3">
                          {hasChanges && (
                        <button
                                        onClick={handleReset}
                                        className="px-4 py-2 bg-monolith-gray/30 text-gray-300 rounded-lg hover:bg-monolith-gray/50 transition-colors"
                                      >
                                      Reset
                        </button>button>
                                  )}
                                  <button
                                                onClick={handleSave}
                                                disabled={!hasChanges}
                                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                                                hasChanges
                                                                  ? 'bg-monolith-green text-monolith-dark hover:bg-monolith-green/90'
                                                                  : 'bg-monolith-gray/30 text-gray-500 cursor-not-allowed'
                                                }`}
                                              >
                                              Save Changes
                                  </button>button>
                        </div>div>
                </div>div>
          
            {/* Success Message */}
            {saveSuccess && (
                    <div className="mb-4 p-4 bg-monolith-green/20 border border-monolith-green/50 rounded-lg flex items-center gap-2 text-monolith-green">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>svg>
                              Permissions saved successfully!
                    </div>div>
                )}
          
            {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1">
                                  <input
                                                type="text"
                                                placeholder="Search permissions..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full px-4 py-2 bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg text-white placeholder-gray-500 focus:border-monolith-green focus:outline-none"
                                              />
                        </div>div>
                        <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="px-4 py-2 bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg text-white focus:border-monolith-green focus:outline-none"
                                  >
                          {categories.map(cat => (
                                                <option key={cat} value={cat}>
                                                  {cat === 'all' ? 'All Categories' : cat}
                                                </option>option>
                                              ))}
                        </select>select>
                </div>div>
          
            {/* Matrix Table */}
                <div className="bg-monolith-gray/20 border border-monolith-gray/30 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                                  <table className="w-full">
                                              <thead>
                                                            <tr className="bg-monolith-gray/30">
                                                                            <th className="text-left p-4 text-gray-400 font-medium sticky left-0 bg-monolith-gray/30 min-w-[200px]">
                                                                                              Permission
                                                                            </th>th>
                                                              {MOCK_ROLES.map(role => (
                              <th key={role.id} className="p-4 text-center min-w-[120px]">
                                                  <div className="text-white font-medium">{role.name}</div>div>
                                                  <div className="text-gray-500 text-xs font-normal">{role.description}</div>div>
                              </th>th>
                            ))}
                                                            </tr>tr>
                                              </thead>thead>
                                              <tbody>
                                                {filteredPermissions.map((permission, index) => (
                            <tr 
                                                key={permission.id}
                                                className={`border-t border-monolith-gray/30 ${index % 2 === 0 ? 'bg-monolith-dark/30' : ''}`}
                                              >
                                              <td className="p-4 sticky left-0 bg-inherit">
                                                                  <div className="text-white">{permission.name}</div>div>
                                                                  <div className="text-gray-500 text-xs">{permission.category}</div>div>
                                              </td>td>
                              {MOCK_ROLES.map(role => (
                                                                    <td key={`${role.id}-${permission.id}`} className="p-4 text-center">
                                                                                          <button
                                                                                                                    onClick={() => togglePermission(role.id, permission.id)}
                                                                                                                    className={`w-6 h-6 rounded border-2 transition-colors ${
                                                                                                                                                hasPermission(role.id, permission.id)
                                                                                                                                                  ? 'bg-monolith-green border-monolith-green'
                                                                                                                                                  : 'bg-transparent border-monolith-gray hover:border-monolith-green/50'
                                                                                                                      }`}
                                                                                                                    aria-label={`Toggle ${permission.name} for ${role.name}`}
                                                                                                                  >
                                                                                            {hasPermission(role.id, permission.id) && (
                                                                                                                                              <svg className="w-4 h-4 text-monolith-dark mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                                                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                                                                                                </svg>svg>
                                                                                                                  )}
                                                                                            </button>button>
                                                                    </td>td>
                                                                  ))}
                            </tr>tr>
                          ))}
                                              </tbody>tbody>
                                  </table>table>
                        </div>div>
                </div>div>
          
            {/* Legend */}
                <div className="mt-4 flex items-center gap-6 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 bg-monolith-green rounded" />
                                  <span>Permission granted</span>span>
                        </div>div>
                        <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 border-2 border-monolith-gray rounded" />
                                  <span>Permission denied</span>span>
                        </div>div>
                </div>div>
          
            {/* Save Confirmation Modal */}
            {showSaveConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                              <div className="bg-monolith-dark border border-monolith-gray/30 rounded-lg p-6 max-w-md w-full mx-4">
                                          <h3 className="text-xl font-bold text-white mb-4">Confirm Changes</h3>h3>
                                          <p className="text-gray-400 mb-6">
                                                        Are you sure you want to save these permission changes? This will affect all users with the modified roles.
                                          </p>p>
                                          <div className="flex justify-end gap-3">
                                                        <button
                                                                          onClick={() => setShowSaveConfirm(false)}
                                                                          className="px-4 py-2 bg-monolith-gray/30 text-gray-300 rounded-lg hover:bg-monolith-gray/50 transition-colors"
                                                                        >
                                                                        Cancel
                                                        </button>button>
                                                        <button
                                                                          onClick={confirmSave}
                                                                          className="px-4 py-2 bg-monolith-green text-monolith-dark rounded-lg hover:bg-monolith-green/90 transition-colors font-medium"
                                                                        >
                                                                        Save Changes
                                                        </button>button>
                                          </div>div>
                              </div>div>
                    </div>div>
                )}
          </div>div>
        );
};

export default PermissionMatrix;</div>
