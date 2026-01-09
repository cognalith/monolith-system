import { useState, useEffect } from 'react';

const CEODashboard = () => {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('chief-of-staff');

  const roles = [
    'chief-of-staff', 'ceo', 'cfo', 'cto', 'cmo', 'chro', 'ciso',
    'general-counsel', 'chief-compliance-officer', 'chief-data-officer',
    'chief-strategy-officer', 'chief-procurement-officer', 'chief-sustainability-officer'
  ];

  useEffect(() => {
    // TODO: Replace with real API calls
    // fetch('/api/dashboard/stats').then(r => r.json()).then(setStats);
    // fetch('/api/recent-activity').then(r => r.json()).then(setActivity);
    
    // Mock data for now
    setTimeout(() => {
      setStats({
        activeWorkflows: 3,
        pendingTasks: 12,
        completedToday: 8,
        totalDecisions: 156
      });
      setActivity([
        { id: 1, role: 'CFO', action: 'Approved Q4 budget allocation', time: '2 min ago', impact: '$2.4M' },
        { id: 2, role: 'CTO', action: 'Deployed infrastructure update', time: '15 min ago', impact: 'Critical' },
        { id: 3, role: 'CHRO', action: 'Finalized hiring plan', time: '1 hour ago', impact: '24 positions' },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-monolith-dark flex items-center justify-center">
        <div className="text-monolith-green text-2xl font-mono animate-pulse">
          INITIALIZING MONOLITH OS...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-monolith-dark text-gray-200 font-mono">
      {/* Header */}
      <header className="border-b border-monolith-green/30 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-monolith-green">MONOLITH OS</h1>
            <span className="text-monolith-amber text-sm">v5.0 | GOD MODE</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-monolith-green">● SYSTEM ONLINE</span>
            <span className="text-gray-500">{new Date().toLocaleString()}</span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Role Navigation */}
        <aside className="w-64 border-r border-monolith-gray min-h-screen p-4">
          <h2 className="text-monolith-amber text-sm mb-4 uppercase tracking-wider">Executive Roles</h2>
          <nav className="space-y-1">
            {roles.map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                  selectedRole === role
                    ? 'bg-monolith-green/20 text-monolith-green border-l-2 border-monolith-green'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-monolith-gray/50'
                }`}
              >
                {role.toUpperCase().replace(/-/g, ' ')}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard label="Active Workflows" value={stats.activeWorkflows} color="green" />
            <StatCard label="Pending Tasks" value={stats.pendingTasks} color="amber" />
            <StatCard label="Completed Today" value={stats.completedToday} color="green" />
            <StatCard label="Total Decisions" value={stats.totalDecisions} color="gray" />
          </div>

          {/* Activity Feed */}
          <div className="bg-monolith-gray/30 border border-monolith-gray rounded-lg p-4">
            <h3 className="text-monolith-amber text-sm uppercase tracking-wider mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {activity.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-monolith-dark/50 rounded border border-monolith-gray/50">
                  <div className="flex items-center gap-4">
                    <span className="text-monolith-green font-bold">{item.role}</span>
                    <span className="text-gray-300">{item.action}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-monolith-amber">{item.impact}</span>
                    <span className="text-gray-500">{item.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Role Context */}
          <div className="mt-8 bg-monolith-gray/30 border border-monolith-gray rounded-lg p-4">
            <h3 className="text-monolith-amber text-sm uppercase tracking-wider mb-4">
              Active Role: {selectedRole.toUpperCase().replace(/-/g, ' ')}
            </h3>
            <p className="text-gray-400 text-sm">
              Role context loaded from /roles/{selectedRole}.md
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color }) => {
  const colorClasses = {
    green: 'text-monolith-green border-monolith-green/30',
    amber: 'text-monolith-amber border-monolith-amber/30',
    gray: 'text-gray-400 border-gray-600'
  };

  return (
    <div className={`bg-monolith-gray/30 border ${colorClasses[color]} rounded-lg p-4`}>
      <div className={`text-3xl font-bold ${colorClasses[color].split(' ')[0]}`}>{value}</div>
      <div className="text-gray-500 text-sm uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
};

export default CEODashboard;
