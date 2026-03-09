import React from 'react';
import { formatRelativeDate } from '../overviewUtils';

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

const FtpForecast = ({ prediction }) => {
  if (!prediction) {
    return (
      <div className="ov-ftp-forecast ov-ftp-forecast--empty">
        <h4>FTP Forecast</h4>
        <p>Upload power data to unlock predictions.</p>
      </div>
    );
  }

  const confidence = Math.round(Number(prediction.confidence || 0) * 100);
  const modelLabel = prediction.model_version === 'ml-v1' ? 'ML Model' : 'Heuristic';
  const predictionTime = prediction.prediction_time ? formatRelativeDate(prediction.prediction_time) : '';
  const predicted = Number(prediction.predicted_ftp || 0);
  const current = Number(prediction.current_ftp || 0);
  const delta = Number(prediction.delta || 0);
  const deltaClass = delta >= 0 ? 'positive' : 'negative';

  return (
    <div className="ov-ftp-forecast">
      <div className="ov-ftp-header">
        <div>
          <h4>FTP Forecast</h4>
          <span className="ov-ftp-subtitle">
            {modelLabel}{predictionTime ? ` - ${predictionTime}` : ''}
          </span>
        </div>
        <span className="ov-ftp-confidence">{confidence}%</span>
      </div>
      <div className="ov-ftp-values">
        <div className="ov-ftp-main">
          <div className="ov-ftp-value">{predicted ? `${Math.round(predicted)}W` : '-'}</div>
          <div className="ov-ftp-label">Predicted FTP</div>
        </div>
        <div className="ov-ftp-meta">
          <span className="ov-ftp-current">Current: {current ? `${Math.round(current)}W` : '-'}</span>
          <span className={`ov-ftp-delta ${deltaClass}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}W
          </span>
        </div>
      </div>
      <div className="ov-ftp-bar">
        <ProgressBarSvg
          value={Math.min(100, Math.max(0, confidence))}
          className="ov-ftp-bar-fill"
          label="FTP forecast confidence"
        />
      </div>
      {prediction.notification ? (
        <div className="ov-ftp-note">{prediction.notification}</div>
      ) : null}
    </div>
  );
};

export default FtpForecast;
