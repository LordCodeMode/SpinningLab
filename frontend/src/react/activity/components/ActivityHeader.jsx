import React from 'react';
import { Calendar, Clock, Edit2 } from 'lucide-react';
import { formatDate, formatTime } from '../activityUtils';

const ActivityHeader = ({ activity, heroSummary, onRename }) => {
  const displayName = activity.custom_name
    || activity.name
    || activity.file_name
    || 'Cycling Session';

  return (
    <div className="activity-header activity-header--enhanced">
      <div className="activity-header-top">
        <div className="activity-header-kicker">Session overview</div>
        <div className="activity-title-row">
          <div className="activity-title-block">
            <h1 className="activity-title page-title" id="activityTitle">{displayName}</h1>
            <div className="activity-meta">
              <span className="activity-meta-item">
                <Calendar size={14} className="mr-1" />
                {formatDate(activity.start_time)}
              </span>
              <span className="activity-meta-item">
                <Clock size={14} className="mr-1" />
                {formatTime(activity.start_time)}
              </span>
            </div>
            <p className="activity-header-description page-description">
              Detailed ride analysis, route context, and training distribution.
            </p>
          </div>
          <div className="activity-header-actions">
            <button className="btn btn--ghost btn--sm" onClick={onRename}>
              <Edit2 size={14} className="mr-1" /> Rename
            </button>
          </div>
        </div>

        <div className="activity-header-chips">
          <div className="activity-chip">
            <span>TSS</span>
            <strong>{heroSummary.tss}</strong>
          </div>
          <div className="activity-chip">
            <span>IF</span>
            <strong>{heroSummary.intensityFactor}</strong>
          </div>
          <div className="activity-chip">
            <span>EF</span>
            <strong>{heroSummary.efficiencyFactor}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityHeader;
