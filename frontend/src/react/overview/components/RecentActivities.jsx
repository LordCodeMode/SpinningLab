import React from 'react';
import { Calendar, ChevronRight, Clock, MapPin, Zap } from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';

const ActivityItem = ({ activity }) => {
  const name = activity.custom_name || activity.file_name || activity.type || 'Activity';
  const date = new Date(activity.start_time).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  const distance = (activity.distance ?? activity.total_distance ?? activity.distance_km) || 0;
  const tss = (activity.tss ?? activity.training_stress_score) || 0;
  
  return (
    <div className="activity-item-compact">
      <div className="activity-icon-box">
        <Zap size={16} />
      </div>
      <div className="activity-info">
        <div className="activity-name-row">
          <span className="activity-name">{name}</span>
          <span className="activity-date">{date}</span>
        </div>
        <div className="activity-meta-row">
          <span className="meta-item"><Clock size={12} /> {(activity.duration / 3600).toFixed(1)}h</span>
          <span className="meta-item"><MapPin size={12} /> {distance.toFixed(1)} km</span>
          <span className="meta-item"><Zap size={12} /> {Math.round(tss)} TSS</span>
        </div>
      </div>
      <ChevronRight size={16} className="activity-chevron" />
    </div>
  );
};

const RecentActivities = ({ activities }) => {
  return (
    <GlassCard delay={0.5} className="recent-activities-glass">
      <div className="panel-header">
        <h3 className="section-title">Recent Activities</h3>
        <button className="text-button">View All</button>
      </div>
      <div className="activities-list-compact">
        {activities.map((activity, index) => (
          <ActivityItem key={activity.id || index} activity={activity} />
        ))}
      </div>
    </GlassCard>
  );
};

export default RecentActivities;
