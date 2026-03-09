import React from 'react';
import { TrendingUp, Percent, BarChart2, Heart, Activity as ActivityIcon } from 'lucide-react';

const ActivityMetrics = ({ activity, heroSummary }) => {
  return (
    <div className="activity-metrics-panel">
      <h2 className="activity-section-title section-title">Training Metrics</h2>
      <div className="activity-metrics-list">
        <div className="activity-metric-row">
          <span className="activity-metric-label">
            <TrendingUp size={16} className="mr-2" />
            Training Stress Score
          </span>
          <span className="activity-metric-value">{heroSummary.tss}</span>
        </div>
        <div className="activity-metric-row">
          <span className="activity-metric-label">
            <Percent size={16} className="mr-2" />
            Intensity Factor
          </span>
          <span className="activity-metric-value">{heroSummary.intensityFactor}</span>
        </div>
        <div className="activity-metric-row">
          <span className="activity-metric-label">
            <BarChart2 size={16} className="mr-2" />
            Efficiency Factor
          </span>
          <span className="activity-metric-value">{heroSummary.efficiencyFactor}</span>
        </div>
      </div>

      <h2 className="activity-section-title section-title activity-section-title--spaced">Heart Rate</h2>
      <div className="activity-metrics-list">
        <div className="activity-metric-row">
          <span className="activity-metric-label">
            <Heart size={16} className="mr-2" />
            Average Heart Rate
          </span>
          <span className="activity-metric-value">
            {activity.avg_heart_rate ? Math.round(activity.avg_heart_rate) : '-'} bpm
          </span>
        </div>
        <div className="activity-metric-row">
          <span className="activity-metric-label">
            <ActivityIcon size={16} className="mr-2" />
            Maximum Heart Rate
          </span>
          <span className="activity-metric-value">
            {activity.max_heart_rate ? Math.round(activity.max_heart_rate) : '-'} bpm
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActivityMetrics;
