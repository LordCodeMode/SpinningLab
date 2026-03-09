import React from 'react';
import { Zap, Activity, Clock, Map } from 'lucide-react';
import { formatDuration } from '../activityUtils';

const ActivityStats = ({ activity, distance }) => {
  return (
    <div className="activity-stats-grid">
      <div className="activity-stat-card activity-stat-card--primary">
        <div className="activity-stat-icon activity-stat-icon--power">
          <Zap size={20} color="white" />
        </div>
        <div className="activity-stat-content">
          <span className="activity-stat-label">Average Power</span>
          <span className="activity-stat-value">{activity.avg_power ? Math.round(activity.avg_power) : '-'}</span>
          <span className="activity-stat-unit">watts</span>
        </div>
      </div>

      <div className="activity-stat-card">
        <div className="activity-stat-icon activity-stat-icon--normalized">
          <Activity size={20} color="white" />
        </div>
        <div className="activity-stat-content">
          <span className="activity-stat-label">Normalized Power</span>
          <span className="activity-stat-value">{activity.normalized_power ? Math.round(activity.normalized_power) : '-'}</span>
          <span className="activity-stat-unit">watts</span>
        </div>
      </div>

      <div className="activity-stat-card">
        <div className="activity-stat-icon activity-stat-icon--duration">
          <Clock size={20} color="white" />
        </div>
        <div className="activity-stat-content">
          <span className="activity-stat-label">Duration</span>
          <span className="activity-stat-value">{formatDuration(activity.duration)}</span>
          <span className="activity-stat-unit">&nbsp;</span>
        </div>
      </div>

      <div className="activity-stat-card">
        <div className="activity-stat-icon activity-stat-icon--distance">
          <Map size={20} color="white" />
        </div>
        <div className="activity-stat-content">
          <span className="activity-stat-label">Distance</span>
          <span className="activity-stat-value">{distance}</span>
          <span className="activity-stat-unit">&nbsp;</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityStats;
