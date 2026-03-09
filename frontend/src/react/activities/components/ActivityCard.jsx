import React from 'react';
import { motion } from 'framer-motion';
import { Trash2, Bike, CalendarDays, Clock3, Route, Zap, Gauge, Flame, ChevronRight } from 'lucide-react';

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
        <div className="actx-card-header">
          <span className="actx-card-badge">
            <Bike size={18} />
          </span>
          <div className="actx-card-heading">
            <span className="actx-card-kicker">Ride archive</span>
            <div className="actx-card-title-row">
              <div className="actx-card-title">{displayName}</div>
              <span className="actx-card-type">Cycling</span>
            </div>
          </div>
        </div>
        <div className="actx-card-meta">
          <span className="actx-card-meta__item">
            <CalendarDays size={14} />
            {formatDate(activity.start_time)}
          </span>
          <span className="actx-card-meta__item">
            <Clock3 size={14} />
            {formatDuration(activity.duration)}
          </span>
          <span className="actx-card-meta__item">
            <Route size={14} />
            {activity.distance ? `${activity.distance.toFixed(1)} km` : '-'}
          </span>
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
        <div className="actx-metric actx-metric--avg">
          <span>
            <Zap size={13} />
            Avg power
          </span>
          <strong>{activity.avg_power ? `${Math.round(activity.avg_power)}W` : '-'}</strong>
        </div>
        <div className="actx-metric actx-metric--np">
          <span>
            <Gauge size={13} />
            NP
          </span>
          <strong>{activity.normalized_power ? `${Math.round(activity.normalized_power)}W` : '-'}</strong>
        </div>
        <div className="actx-metric actx-metric--tss">
          <span>
            <Flame size={13} />
            TSS
          </span>
          <strong>{activity.tss ? Math.round(activity.tss) : '-'}</strong>
        </div>
      </div>

      <div className="actx-card-actions">
        <span className="actx-card-open" aria-hidden="true">
          <ChevronRight size={18} />
        </span>
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
