import React from 'react';
import { getIntervalColorClass } from '../../../lib/utils/workout-colors.js';
import { Badge } from './Badge.jsx';

/**
 * Workout Card Component
 * Displays workout details including duration, TSS, and intervals
 */
export function WorkoutCard({
  id,
  name,
  description,
  workoutType,
  totalDuration = 0,
  estimatedTss = 0,
  intervals = [],
  isTemplate = false,
  clickable = true,
  onClick,
  onSchedule,
  onEdit,
  onDuplicate,
  onDelete,
  className = ''
}) {
  const clickableClass = clickable ? 'card--clickable' : '';
  const workoutTypeIcon = getWorkoutTypeIcon(workoutType);
  const workoutTypeClass = getWorkoutTypeClass(workoutType);

  const durationMinutes = Math.round(totalDuration / 60);
  const intervalCount = intervals.length;

  return (
    <div
      className={`card workout-card ${clickableClass} ${className}`}
      data-workout-id={id}
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
    >
      <div className="card__header">
        <div className={`workout-card__icon ${workoutTypeClass}`}>
          {workoutTypeIcon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 className="card__title">{name}</h3>
          <div className="workout-card__meta">
            {workoutType && <span className="workout-card__type">{workoutType}</span>}
            {isTemplate && <Badge variant="primary">Template</Badge>}
          </div>
        </div>
        {(onSchedule || onEdit || onDuplicate || onDelete) && (
          <div className="card__actions">
            <WorkoutActions
              id={id}
              onSchedule={onSchedule}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>

      <div className="card__body">
        {description && <p className="workout-card__description">{description}</p>}

        <div className="workout-card__stats">
          <div className="workout-card__stat">
            <svg className="workout-card__stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <div className="workout-card__stat-value">{durationMinutes} min</div>
              <div className="workout-card__stat-label">Duration</div>
            </div>
          </div>

          <div className="workout-card__stat">
            <svg className="workout-card__stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <div>
              <div className="workout-card__stat-value">{estimatedTss.toFixed(0)}</div>
              <div className="workout-card__stat-label">TSS</div>
            </div>
          </div>

          <div className="workout-card__stat">
            <svg className="workout-card__stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
            <div>
              <div className="workout-card__stat-value">{intervalCount}</div>
              <div className="workout-card__stat-label">Intervals</div>
            </div>
          </div>
        </div>

        {intervals.length > 0 && <IntervalPreview intervals={intervals} />}
      </div>
    </div>
  );
}

/**
 * Compact Workout Card
 * Minimal version for lists
 */
export function CompactWorkoutCard({
  id,
  name,
  workoutType,
  totalDuration = 0,
  estimatedTss = 0,
  onClick,
  className = ''
}) {
  const durationMinutes = Math.round(totalDuration / 60);
  const workoutTypeIcon = getWorkoutTypeIcon(workoutType);
  const workoutTypeClass = getWorkoutTypeClass(workoutType);

  return (
    <div
      className={`compact-workout-card ${className}`}
      data-workout-id={id}
      style={onClick ? { cursor: 'pointer' } : undefined}
      onClick={onClick}
    >
      <div className={`compact-workout-card__icon ${workoutTypeClass}`}>
        {workoutTypeIcon}
      </div>
      <div className="compact-workout-card__content">
        <div className="compact-workout-card__name">{name}</div>
        <div className="compact-workout-card__meta">
          {workoutType && <><span>{workoutType}</span> • </>}
          <span>{durationMinutes}min</span> •
          <span>{estimatedTss.toFixed(0)} TSS</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Workout Actions Component
 * Action buttons for workout card
 */
function WorkoutActions({
  id,
  onSchedule,
  onEdit,
  onDuplicate,
  onDelete
}) {
  if (!id) return null;

  return (
    <>
      {onSchedule && (
        <button
          className="btn btn--icon btn--sm"
          data-action="schedule"
          data-workout-id={id}
          title="Schedule workout"
          onClick={(e) => {
            e.stopPropagation();
            onSchedule(id);
          }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </button>
      )}
      {onEdit && (
        <button
          className="btn btn--icon btn--sm"
          data-action="edit"
          data-workout-id={id}
          title="Edit workout"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(id);
          }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 11l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 14.536a2 2 0 01-1.414.586H9V11z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4"/>
          </svg>
        </button>
      )}
      {onDuplicate && (
        <button
          className="btn btn--icon btn--sm"
          data-action="duplicate"
          data-workout-id={id}
          title="Duplicate workout"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(id);
          }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
        </button>
      )}
      {onDelete && (
        <button
          className="btn btn--icon btn--sm btn--danger"
          data-action="delete"
          data-workout-id={id}
          title="Delete workout"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      )}
    </>
  );
}

/**
 * Interval Preview Component
 * Visualization of workout intervals
 */
function IntervalPreview({ intervals }) {
  const maxIntervals = 12;
  const displayIntervals = intervals.slice(0, maxIntervals);
  const hasMore = intervals.length > maxIntervals;

  return (
    <div className="workout-card__intervals">
      <div className="workout-card__intervals-label">Workout Structure</div>
      <div className="workout-card__intervals-viz">
        {displayIntervals.map((interval, index) => {
          const duration = Math.max(1, interval.duration || 0);
          const avgPower = ((interval.target_power_low || 0) + (interval.target_power_high || 0)) / 2;
          const barClass = getIntervalColorClass(interval, avgPower);
          const relativeHeight = Math.min(100, Math.max(20, (avgPower / 120) * 100));

          return (
            <div
              key={index}
              className={`workout-card__interval-bar ${barClass}`}
              style={{
                height: `${relativeHeight}%`,
                flex: `${duration} 0 0`
              }}
            />
          );
        })}
        {hasMore && (
          <div className="workout-card__intervals-more">
            +{intervals.length - maxIntervals}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get icon for workout type
 */
function getWorkoutTypeIcon(type) {
  const icons = {
    'Sweet Spot': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    ),
    'VO2max': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    ),
    'Threshold': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
      </svg>
    ),
    'Endurance': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    'Tempo': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    ),
    'Recovery': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
      </svg>
    ),
    'Anaerobic': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    ),
    'Anaerobic Capacity': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    ),
    'Sprint': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    ),
    'Race Prep': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v18m0-18h10l-2 4 2 4H5"/>
      </svg>
    ),
    'Ramp Test': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 19h16M7 16l3-3 3 2 4-6"/>
      </svg>
    )
  };

  return icons[type] || (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
    </svg>
  );
}

/**
 * Get CSS class for workout type
 */
function getWorkoutTypeClass(type) {
  const classes = {
    'Sweet Spot': 'workout-card__icon--sweet-spot',
    'VO2max': 'workout-card__icon--vo2max',
    'Threshold': 'workout-card__icon--threshold',
    'Endurance': 'workout-card__icon--endurance',
    'Tempo': 'workout-card__icon--tempo',
    'Recovery': 'workout-card__icon--recovery',
    'Anaerobic': 'workout-card__icon--anaerobic',
    'Anaerobic Capacity': 'workout-card__icon--anaerobic',
    'Sprint': 'workout-card__icon--sprint',
    'Race Prep': 'workout-card__icon--race-prep',
    'Ramp Test': 'workout-card__icon--ramp-test'
  };

  return classes[type] || 'workout-card__icon--default';
}

export default WorkoutCard;
