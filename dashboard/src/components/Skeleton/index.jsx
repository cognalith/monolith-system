import './Skeleton.css';

// Reusable skeleton components for loading states
export const SkeletonText = ({ width = '100%', height = '16px' }) => (
  <div className="skeleton skeleton-text" style={{ width, height }} />
);

export const SkeletonBadge = () => (
  <div className="skeleton skeleton-badge" />
);

export const SkeletonCircle = ({ size = '40px' }) => (
  <div className="skeleton skeleton-circle" style={{ width: size, height: size }} />
);

export const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton skeleton-text" style={{ width: '60%', height: '12px' }} />
    <div className="skeleton skeleton-text" style={{ width: '40%', height: '24px', marginTop: '8px' }} />
  </div>
);

// Task row skeleton for PendingTasksPanel
export const SkeletonTaskRow = () => (
  <div className="skeleton-task-row">
    <SkeletonBadge />
    <div className="skeleton-task-content">
      <SkeletonText width="70%" height="14px" />
      <SkeletonText width="40%" height="12px" />
    </div>
    <SkeletonText width="80px" height="12px" />
  </div>
);

// Chart skeleton for AnalyticsCharts
export const SkeletonChart = ({ type = 'bar' }) => (
  <div className="skeleton-chart">
    {type === 'bar' && (
      <div className="skeleton-bars">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton-bar-wrapper">
            <div 
              className="skeleton skeleton-bar" 
              style={{ height: `${Math.random() * 60 + 40}%` }}
            />
          </div>
        ))}
      </div>
    )}
    {type === 'pie' && (
      <div className="skeleton-pie-container">
        <div className="skeleton skeleton-pie" />
        <div className="skeleton-legend">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-legend-item">
              <SkeletonCircle size="14px" />
              <SkeletonText width="80px" height="12px" />
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Summary cards skeleton
export const SkeletonSummaryCards = () => (
  <div className="skeleton-summary-cards">
    {[...Array(4)].map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

const Skeleton = {
  Text: SkeletonText,
  Badge: SkeletonBadge,
  Circle: SkeletonCircle,
  Card: SkeletonCard,
  TaskRow: SkeletonTaskRow,
  Chart: SkeletonChart,
  SummaryCards: SkeletonSummaryCards,
};

export default Skeleton;
