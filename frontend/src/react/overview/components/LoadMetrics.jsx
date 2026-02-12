import React from 'react';

const LoadMetrics = ({ ctl, atl, tsb }) => {
  return (
    <div className="ov-metrics-panel">
      <h3 className="ov-panel-title section-title">Current Load</h3>

      <div className="ov-metric-large">
        <div className="ov-metric-large-label">Fitness (CTL)</div>
        <div className="ov-metric-large-value" style={{ color: '#3b82f6' }}>
          {ctl.toFixed(1)}
        </div>
        <div className="ov-metric-large-bar">
          <div className="ov-metric-large-fill" style={{ width: `${Math.min(100, (ctl / 100) * 100)}%`, background: '#3b82f6' }} />
        </div>
      </div>

      <div className="ov-metric-large">
        <div className="ov-metric-large-label">Fatigue (ATL)</div>
        <div className="ov-metric-large-value" style={{ color: '#f59e0b' }}>
          {atl.toFixed(1)}
        </div>
        <div className="ov-metric-large-bar">
          <div className="ov-metric-large-fill" style={{ width: `${Math.min(100, (atl / 100) * 100)}%`, background: '#f59e0b' }} />
        </div>
      </div>

      <div className="ov-metric-large">
        <div className="ov-metric-large-label">Form (TSB)</div>
        <div className="ov-metric-large-value" style={{ color: tsb >= 0 ? '#10b981' : '#ef4444' }}>
          {tsb > 0 ? '+' : ''}{tsb.toFixed(1)}
        </div>
        <div className="ov-metric-large-bar">
          <div className="ov-metric-large-fill" style={{ width: `${Math.abs(tsb) * 2}%`, background: tsb >= 0 ? '#10b981' : '#ef4444' }} />
        </div>
      </div>

      <div className="ov-form-status">
        <div className={`ov-form-badge ${tsb > 5 ? 'fresh' : tsb > -5 ? 'balanced' : 'fatigued'}`}>
          {tsb > 5 ? 'Fresh' : tsb > -5 ? 'Balanced' : 'Fatigued'}
        </div>
        <p className="ov-form-text">
          {tsb > 5
            ? 'Great time for high-intensity work'
            : tsb > -5
              ? 'Balanced training and recovery'
              : 'Consider adding recovery'}
        </p>
      </div>
    </div>
  );
};

export default LoadMetrics;
