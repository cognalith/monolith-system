/**
 * RoleButton Component
 * Displays a role button with abbreviation and optional notification badge
 * showing pending task count for that role.
 */

const RoleButton = ({ role, isSelected, taskCount = 0, onClick }) => {
  // Determine badge color based on urgency
  const getBadgeColor = () => {
    if (taskCount >= 10) return 'bg-red-500';
    if (taskCount >= 5) return 'bg-monolith-amber';
    return 'bg-red-500';
  };

  // Tier-based styling for visual hierarchy
  const getTierStyle = () => {
    switch (role.tier) {
      case 1: // C-Suite - most prominent
        return 'font-bold';
      case 2: // Chiefs
        return 'font-semibold';
      case 3: // VPs
        return 'font-medium';
      default: // Directors, Managers
        return 'font-normal';
    }
  };

  return (
    <button
      onClick={() => onClick(role)}
      className={`
        relative px-3 py-2 rounded text-sm transition-all duration-200
        ${getTierStyle()}
        ${isSelected
          ? 'bg-monolith-green text-monolith-dark shadow-lg shadow-monolith-green/20'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
        }
      `}
      title={role.fullName}
    >
      {/* Role Abbreviation */}
      <span>{role.abbr}</span>

      {/* Notification Badge - only show if taskCount > 0 */}
      {taskCount > 0 && (
        <span
          className={`
            absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px]
            flex items-center justify-center
            ${getBadgeColor()} text-white text-xs font-bold
            rounded-full px-1
            animate-pulse
          `}
        >
          {taskCount > 99 ? '99+' : taskCount}
        </span>
      )}
    </button>
  );
};

export default RoleButton;
