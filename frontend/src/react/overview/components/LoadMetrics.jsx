import React from 'react';

const ProgressBarSvg = ({ value, className = '', label }) => {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <svg
      className={className}
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <rect className="ov-progress-svg__track" x="0" y="0" width="100" height="8" rx="4" />
      <rect className="ov-progress-svg__fill" x="0" y="0" width={width} height="8" rx="4" />
    </svg>
  );
};

const LoadMetrics = ({ ctl, atl, tsb }) => {
  return (
    <div className="ov-metrics-panel">
      <h3 className="ov-panel-title section-title">Current Load</h3>

      <div className="ov-metric-large">
        <div className="ov-metric-large-label">Fitness (CTL)</div>
        <div className="ov-metric-large-value ov-metric-large-value--blue">
          {ctl.toFixed(1)}
        </div>
        <div className="ov-metric-large-bar">
          <ProgressBarSvg
            value={Math.min(100, ctl)}
            className="ov-metric-large-fill ov-metric-large-fill--blue"
            label="Fitness load progress"
          />
        </div>
      </div>

      <div className="ov-metric-large">
        <div className="ov-metric-large-label">Fatigue (ATL)</div>
        <div className="ov-metric-large-value ov-metric-large-value--amber">
          {atl.toFixed(1)}
        </div>
        <div className="ov-metric-large-bar">
          <ProgressBarSvg
            value={Math.min(100, atl)}
            className="ov-metric-large-fill ov-metric-large-fill--amber"
            label="Fatigue load progress"
          />
        </div>
      </div>

      <div className="ov-metric-large">
        <div className="ov-metric-large-label">Form (TSB)</div>
        <div className={`ov-metric-large-value ${tsb >= 0 ? 'ov-metric-large-value--green' : 'ov-metric-large-value--red'}`}>
          {tsb > 0 ? '+' : ''}{tsb.toFixed(1)}
        </div>
        <div className="ov-metric-large-bar">
          <ProgressBarSvg
            value={Math.min(100, Math.abs(tsb) * 2)}
            className={`ov-metric-large-fill ${tsb >= 0 ? 'ov-metric-large-fill--green' : 'ov-metric-large-fill--red'}`}
            label="Form balance"
          />
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
