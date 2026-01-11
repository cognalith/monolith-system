/**
 * StatCard Component
 * Displays a clickable stat card with label, value, and color styling.
 * Used in the dashboard to show metrics like Active Workflows, Pending Tasks, etc.
 */

const StatCard = ({ label, value, color = 'gray', onClick, isClickable = true }) => {
  const colorClasses = {
    green: 'text-monolith-green border-monolith-green/30 hover:border-monolith-green',
    amber: 'text-monolith-amber border-monolith-amber/30 hover:border-monolith-amber',
    gray: 'text-gray-400 border-gray-600/30 hover:border-gray-400',
    red: 'text-red-400 border-red-600/30 hover:border-red-400',
    blue: 'text-blue-400 border-blue-600/30 hover:border-blue-400',
  };

  const textColorClass = colorClasses[color]?.split(' ')[0] || 'text-gray-400';

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`
        bg-gray-900 border ${colorClasses[color] || colorClasses.gray}
        rounded-lg p-4 animate-fadeIn transition-all duration-200
        ${isClickable ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
      `}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="text-gray-500 text-sm uppercase tracking-wider mt-1">
        {label}
      </div>
      <div className={`text-3xl font-bold ${textColorClass} mt-4`}>
        {value ?? '-'}
      </div>
      {isClickable && (
        <div className="text-xs text-gray-600 mt-2 opacity-0 hover:opacity-100 transition-opacity">
          Click for details
        </div>
      )}
    </div>
  );
};

export default StatCard;
