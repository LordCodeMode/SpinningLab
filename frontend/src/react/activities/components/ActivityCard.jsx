import React from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';

const ActivityCard = ({ activity, onClick, onDelete, formatDate, formatDuration, getActivityId }) => {
  const activityId = getActivityId(activity);
  const displayName = activity.custom_name || activity.file_name || 'Untitled Ride';
  const tags = Array.isArray(activity.tags) ? activity.tags : [];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={`actx-card glass-card ${activityId ? 'actx-card--clickable' : ''}`}
      onClick={onClick}
    >
      <div className="actx-card-left">
        <div className="actx-card-title">{displayName}</div>
        <div className="actx-card-sub">
          {formatDate(activity.start_time)}
          <span className="actx-sep">|</span>
          {formatDuration(activity.duration)}
          <span className="actx-sep">|</span>
          {activity.distance ? `${activity.distance.toFixed(1)} km` : '-'}
        </div>
        <div className="actx-tags">
          {tags.length ? (
            tags.map((tag) => (
              <span key={tag} className="actx-tag">#{tag}</span>
            ))
          ) : (
            <span className="actx-tag actx-tag--muted">No tags</span>
          )}
        </div>
      </div>

      <div className="actx-card-metrics">
        <div className="actx-metric">
          <span>Avg</span>
          <strong>{activity.avg_power ? `${Math.round(activity.avg_power)}W` : '-'}</strong>
        </div>
        <div className="actx-metric">
          <span>NP</span>
          <strong>{activity.normalized_power ? `${Math.round(activity.normalized_power)}W` : '-'}</strong>
        </div>
        <div className="actx-metric">
          <span>TSS</span>
          <strong>{activity.tss ? Math.round(activity.tss) : '-'}</strong>
        </div>
      </div>

      <div className="actx-card-actions">
        <button
          type="button"
          className="actx-delete p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(activityId);
          }}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </motion.article>
  );
};

export default ActivityCard;
