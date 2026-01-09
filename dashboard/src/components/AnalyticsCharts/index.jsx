import { useState, useEffect } from 'react';
import { SkeletonSummaryCards, SkeletonChart } from '../Skeleton';
import './AnalyticsCharts.css';

const AnalyticsCharts = ({ isOpen, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeChart, setActiveChart] = useState('roi');

  useEffect(() => {
    if (isOpen) {
      fetchAnalyticsData();
    }
  }, [isOpen]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call to /api/analytics
      const mockData = {
        roiOverTime: [
          { month: 'Jul', estimated: 120000, actual: 145000 },
          { month: 'Aug', estimated: 150000, actual: 162000 },
          { month: 'Sep', estimated: 180000, actual: 195000 },
          { month: 'Oct', estimated: 200000, actual: 218000 },
          { month: 'Nov', estimated: 220000, actual: 245000 },
          { month: 'Dec', estimated: 250000, actual: 280000 },
        ],
        decisionsByCategory: [
          { category: 'Operations', count: 45, color: '#00ff88' },
          { category: 'Finance', count: 32, color: '#ffaa00' },
          { category: 'HR', count: 28, color: '#ff4444' },
          { category: 'Marketing', count: 22, color: '#4488ff' },
          { category: 'IT', count: 18, color: '#aa44ff' },
        ],
        valueGenerated: [
          { period: 'Q1', value: 450000 },
          { period: 'Q2', value: 620000 },
          { period: 'Q3', value: 780000 },
          { period: 'Q4', value: 920000 },
        ],
        summary: {
          totalROI: '+18.5%',
          totalDecisions: 145,
          avgValue: '$42,500',
          successRate: '94%'
        }
      };
      
      await new Promise(r => setTimeout(r, 500)); // Simulate API delay
      setData(mockData);
      setError(null);
    } catch (err) {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const maxValue = data?.roiOverTime ? Math.max(...data.roiOverTime.map(d => Math.max(d.estimated, d.actual))) : 0;
  const maxBarValue = data?.valueGenerated ? Math.max(...data.valueGenerated.map(d => d.value)) : 0;
  const totalDecisions = data?.decisionsByCategory?.reduce((sum, d) => sum + d.count, 0) || 0;

  return (
    <div className="analytics-overlay" onClick={onClose}>
      <div className="analytics-panel" onClick={e => e.stopPropagation()}>
        <div className="analytics-header">
          <div className="header-left">
            <h2>📊 ANALYTICS DASHBOARD</h2>
            <span className="subtitle">Decision ROI & Performance Metrics</span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="loading-container">
            <SkeletonSummaryCards />
            <SkeletonChart type="bar" />
            <p>Loading analytics data...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p>{error}</p>
            <button onClick={fetchAnalyticsData}>Retry</button>
          </div>
        ) : (
          <>
            <div className="summary-cards">
              <div className="summary-card">
                <span className="label">Total ROI</span>
                <span className="value green">{data.summary.totalROI}</span>
              </div>
              <div className="summary-card">
                <span className="label">Decisions</span>
                <span className="value">{data.summary.totalDecisions}</span>
              </div>
              <div className="summary-card">
                <span className="label">Avg Value</span>
                <span className="value">{data.summary.avgValue}</span>
              </div>
              <div className="summary-card">
                <span className="label">Success Rate</span>
                <span className="value green">{data.summary.successRate}</span>
              </div>
            </div>

            <div className="chart-tabs">
              <button 
                className={`tab ${activeChart === 'roi' ? 'active' : ''}`}
                onClick={() => setActiveChart('roi')}
              >
                ROI Over Time
              </button>
              <button 
                className={`tab ${activeChart === 'category' ? 'active' : ''}`}
                onClick={() => setActiveChart('category')}
              >
                By Category
              </button>
              <button 
                className={`tab ${activeChart === 'value' ? 'active' : ''}`}
                onClick={() => setActiveChart('value')}
              >
                Value Generated
              </button>
            </div>

            <div className="chart-container">
              {activeChart === 'roi' && (
                <div className="roi-chart">
                  <div className="chart-title">Estimated vs Actual Value (Last 6 Months)</div>
                  <div className="line-chart">
                    <div className="y-axis">
                      <span>${(maxValue / 1000).toFixed(0)}K</span>
                      <span>${(maxValue / 2000).toFixed(0)}K</span>
                      <span>$0</span>
                    </div>
                    <div className="chart-area">
                      {data.roiOverTime.map((item, idx) => (
                        <div key={idx} className="data-column">
                          <div className="bars">
                            <div 
                              className="bar estimated" 
                              style={{ height: `${(item.estimated / maxValue) * 100}%` }}
                              title={`Estimated: $${item.estimated.toLocaleString()}`}
                            />
                            <div 
                              className="bar actual" 
                              style={{ height: `${(item.actual / maxValue) * 100}%` }}
                              title={`Actual: $${item.actual.toLocaleString()}`}
                            />
                          </div>
                          <span className="x-label">{item.month}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="chart-legend">
                    <span><span className="dot estimated"></span> Estimated</span>
                    <span><span className="dot actual"></span> Actual</span>
                  </div>
                </div>
              )}

              {activeChart === 'category' && (
                <div className="category-chart">
                  <div className="chart-title">Decisions by Category</div>
                  <div className="pie-chart-container">
                    <div className="pie-chart">
                      {data.decisionsByCategory.map((item, idx) => {
                        const percentage = (item.count / totalDecisions) * 100;
                        const rotation = data.decisionsByCategory
                          .slice(0, idx)
                          .reduce((sum, d) => sum + (d.count / totalDecisions) * 360, 0);
                        return (
                          <div 
                            key={idx}
                            className="pie-segment"
                            style={{
                              '--color': item.color,
                              '--rotation': `${rotation}deg`,
                              '--percentage': percentage
                            }}
                          />
                        );
                      })}
                      <div className="pie-center">
                        <span className="total">{totalDecisions}</span>
                        <span className="label">Total</span>
                      </div>
                    </div>
                    <div className="category-legend">
                      {data.decisionsByCategory.map((item, idx) => (
                        <div key={idx} className="legend-item">
                          <span className="color-dot" style={{ background: item.color }}></span>
                          <span className="name">{item.category}</span>
                          <span className="count">{item.count}</span>
                          <span className="percent">({((item.count / totalDecisions) * 100).toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeChart === 'value' && (
                <div className="value-chart">
                  <div className="chart-title">Value Generated by Quarter</div>
                  <div className="bar-chart">
                    {data.valueGenerated.map((item, idx) => (
                      <div key={idx} className="bar-item">
                        <div className="bar-wrapper">
                          <div 
                            className="bar-fill"
                            style={{ height: `${(item.value / maxBarValue) * 100}%` }}
                          >
                            <span className="bar-value">${(item.value / 1000).toFixed(0)}K</span>
                          </div>
                        </div>
                        <span className="bar-label">{item.period}</span>
                      </div>
                    ))}
                  </div>
                  <div className="value-summary">
                    <span>Total: ${data.valueGenerated.reduce((sum, d) => sum + d.value, 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsCharts;
