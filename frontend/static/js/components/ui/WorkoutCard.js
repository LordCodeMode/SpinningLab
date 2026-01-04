// =========================
// WORKOUT CARD COMPONENT
// Displays workout information in card format
// =========================

import { getIntervalColorClass } from '../../utils/workout-colors.js';

/**
 * Workout Card Component
 * Displays workout details including duration, TSS, and intervals
 *
 * @param {Object} options - Workout card configuration
 * @param {number} options.id - Workout ID
 * @param {string} options.name - Workout name
 * @param {string} options.description - Workout description
 * @param {string} options.workoutType - Type of workout (e.g., "Sweet Spot", "VO2max")
 * @param {number} options.totalDuration - Total duration in seconds
 * @param {number} options.estimatedTss - Estimated TSS
 * @param {Array} options.intervals - Array of intervals
 * @param {boolean} options.isTemplate - Whether this is a template workout
 * @param {boolean} options.clickable - Make card clickable
 * @param {Function} options.onClick - Click handler
 * @param {Function} options.onSchedule - Schedule button handler
 * @param {Function} options.onEdit - Edit button handler
 * @param {Function} options.onDuplicate - Duplicate button handler
 * @param {Function} options.onDelete - Delete button handler
 * @param {string} options.customClass - Additional CSS classes
 */
export function WorkoutCard({
  id = null,
  name = '',
  description = '',
  workoutType = '',
  totalDuration = 0,
  estimatedTss = 0,
  intervals = [],
  isTemplate = false,
  clickable = true,
  onClick = null,
  onSchedule = null,
  onEdit = null,
  onDuplicate = null,
  onDelete = null,
  customClass = ''
}) {
  const clickableClass = clickable ? 'card--clickable' : '';
  const workoutTypeIcon = getWorkoutTypeIcon(workoutType);
  const workoutTypeClass = getWorkoutTypeClass(workoutType);

  const durationMinutes = Math.round(totalDuration / 60);
  const intervalCount = intervals.length;

  const actions = generateActions(id, onSchedule, onEdit, onDuplicate, onDelete);

  return `
    <div class="card workout-card ${clickableClass} ${customClass}"
         data-workout-id="${id}"
         ${onClick ? 'style="cursor: pointer;"' : ''}>

      <div class="card__header">
        <div class="workout-card__icon ${workoutTypeClass}">
          ${workoutTypeIcon}
        </div>
        <div style="flex: 1;">
          <h3 class="card__title">${escapeHtml(name)}</h3>
          <div class="workout-card__meta">
            ${workoutType ? `<span class="workout-card__type">${escapeHtml(workoutType)}</span>` : ''}
            ${isTemplate ? `<span class="badge badge--primary">Template</span>` : ''}
          </div>
        </div>
        ${actions ? `<div class="card__actions">${actions}</div>` : ''}
      </div>

      <div class="card__body">
        ${description ? `<p class="workout-card__description">${escapeHtml(description)}</p>` : ''}

        <div class="workout-card__stats">
          <div class="workout-card__stat">
            <svg class="workout-card__stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <div class="workout-card__stat-value">${durationMinutes} min</div>
              <div class="workout-card__stat-label">Duration</div>
            </div>
          </div>

          <div class="workout-card__stat">
            <svg class="workout-card__stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <div>
              <div class="workout-card__stat-value">${estimatedTss.toFixed(0)}</div>
              <div class="workout-card__stat-label">TSS</div>
            </div>
          </div>

          <div class="workout-card__stat">
            <svg class="workout-card__stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
            <div>
              <div class="workout-card__stat-value">${intervalCount}</div>
              <div class="workout-card__stat-label">Intervals</div>
            </div>
          </div>
        </div>

        ${intervals.length > 0 ? generateIntervalPreview(intervals) : ''}
      </div>
    </div>
  `;
}

/**
 * Compact Workout Card
 * Minimal version for lists
 */
export function CompactWorkoutCard({
  id = null,
  name = '',
  workoutType = '',
  totalDuration = 0,
  estimatedTss = 0,
  onClick = null,
  customClass = ''
}) {
  const durationMinutes = Math.round(totalDuration / 60);
  const workoutTypeIcon = getWorkoutTypeIcon(workoutType);
  const workoutTypeClass = getWorkoutTypeClass(workoutType);

  return `
    <div class="compact-workout-card ${customClass}"
         data-workout-id="${id}"
         ${onClick ? 'style="cursor: pointer;"' : ''}>
      <div class="compact-workout-card__icon ${workoutTypeClass}">
        ${workoutTypeIcon}
      </div>
      <div class="compact-workout-card__content">
        <div class="compact-workout-card__name">${escapeHtml(name)}</div>
        <div class="compact-workout-card__meta">
          ${workoutType ? `<span>${escapeHtml(workoutType)}</span> • ` : ''}
          <span>${durationMinutes}min</span> •
          <span>${estimatedTss.toFixed(0)} TSS</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get icon for workout type
 */
function getWorkoutTypeIcon(type) {
  const icons = {
    'Sweet Spot': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
    </svg>`,
    'VO2max': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>`,
    'Threshold': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
    </svg>`,
    'Endurance': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>`,
    'Recovery': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
    </svg>`,
    'Anaerobic': `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>`
  };

  return icons[type] || `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
  </svg>`;
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
    'Recovery': 'workout-card__icon--recovery',
    'Anaerobic': 'workout-card__icon--anaerobic'
  };

  return classes[type] || 'workout-card__icon--default';
}

/**
 * Generate action buttons
 */
function generateActions(id, onSchedule, onEdit, onDuplicate, onDelete) {
  if (!id) return '';

  const buttons = [];

  if (onSchedule) {
    buttons.push(`
      <button class="btn btn--icon btn--sm"
              data-action="schedule"
              data-workout-id="${id}"
              title="Schedule workout">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
      </button>
    `);
  }

  if (onEdit) {
    buttons.push(`
      <button class="btn btn--icon btn--sm"
              data-action="edit"
              data-workout-id="${id}"
              title="Edit workout">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M9 11l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 14.536a2 2 0 01-1.414.586H9V11z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4"/>
        </svg>
      </button>
    `);
  }

  if (onDuplicate) {
    buttons.push(`
      <button class="btn btn--icon btn--sm"
              data-action="duplicate"
              data-workout-id="${id}"
              title="Duplicate workout">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      </button>
    `);
  }

  if (onDelete) {
    buttons.push(`
      <button class="btn btn--icon btn--sm btn--danger"
              data-action="delete"
              data-workout-id="${id}"
              title="Delete workout">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    `);
  }

  return buttons.join('');
}

/**
 * Generate interval preview visualization
 */
export function generateIntervalPreview(intervals) {
  const maxIntervals = 12;
  const displayIntervals = intervals.slice(0, maxIntervals);
  const hasMore = intervals.length > maxIntervals;

  const bars = displayIntervals.map(interval => {
    const duration = Math.max(1, interval.duration || 0);
    const type = interval.interval_type || interval.intervalType;
    const avgPower = ((interval.target_power_low || 0) + (interval.target_power_high || 0)) / 2;

    const barClass = getIntervalColorClass(interval, avgPower);

    const relativeHeight = Math.min(100, Math.max(20, (avgPower / 120) * 100));

    return `<div class="workout-card__interval-bar ${barClass}" style="height: ${relativeHeight}%; flex: ${duration} 0 0;"></div>`;
  }).join('');

  return `
    <div class="workout-card__intervals">
      <div class="workout-card__intervals-label">Workout Structure</div>
      <div class="workout-card__intervals-viz">
        ${bars}
        ${hasMore ? `<div class="workout-card__intervals-more">+${intervals.length - maxIntervals}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}

export default {
  WorkoutCard,
  CompactWorkoutCard,
  generateIntervalPreview
};
