import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../../../static/js/core/api.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import { notify } from '../../../static/js/utils/notifications.js';
import CONFIG from '../../../static/js/pages/workout-library/config.js';
import { getIntervalColorClass, getIntervalPowerPercent } from '../../../static/js/utils/workout-colors.js';
import { POWER_ZONES } from '../../../static/js/pages/workout-builder/zones.js';

const DEFAULT_FTP = 250;
const MAX_POWER_PERCENT = 200;
const PREVIEW_HEIGHT = 120;

const TYPE_OPTIONS = [
  'Sweet Spot',
  'VO2max',
  'Threshold',
  'Endurance',
  'Recovery',
  'Anaerobic'
];

const formatMinutes = (seconds) => Math.round((seconds || 0) / 60);

const normalizeFilter = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

const formatIntervalType = (type) => {
  const map = {
    warmup: 'Warm-up',
    work: 'Work',
    recovery: 'Recovery',
    cooldown: 'Cooldown'
  };
  if (!type) return 'Interval';
  return map[type] || `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
};

const getWorkoutTypeClass = (type) => {
  const classes = {
    'Sweet Spot': 'workout-card__icon--sweet-spot',
    'VO2max': 'workout-card__icon--vo2max',
    'Threshold': 'workout-card__icon--threshold',
    'Endurance': 'workout-card__icon--endurance',
    'Recovery': 'workout-card__icon--recovery',
    'Anaerobic': 'workout-card__icon--anaerobic'
  };

  return classes[type] || 'workout-card__icon--default';
};

const getWorkoutTypeIcon = (type) => {
  const icons = {
    'Sweet Spot': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    'VO2max': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    'Threshold': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    'Endurance': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    'Recovery': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    'Anaerobic': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  };

  return icons[type] || (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
};

const getIntervalSummary = (workout, ftp) => {
  const intervals = Array.isArray(workout?.intervals) ? workout.intervals : [];
  const workIntervals = intervals.filter((interval) => interval.interval_type === 'work' && interval.duration);

  if (!workIntervals.length) return '';

  const grouped = new Map();
  workIntervals.forEach((interval) => {
    const key = [
      interval.duration,
      interval.target_power_low,
      interval.target_power_high,
      interval.target_power_type
    ].join(':');
    if (!grouped.has(key)) {
      grouped.set(key, { interval, count: 0 });
    }
    grouped.get(key).count += 1;
  });

  const best = Array.from(grouped.values()).sort((a, b) => b.count - a.count)[0];
  if (!best) return '';

  const durationMinutes = Math.round(best.interval.duration / 60);
  const powerLabel = formatIntervalPower(best.interval, ftp);

  if (!durationMinutes || !powerLabel) return '';

  return `${best.count} x ${durationMinutes} min at ${powerLabel}`;
};

const formatIntervalPower = (interval, ftp) => {
  if (!interval?.target_power_low || !interval?.target_power_high) return '';

  const low = interval.target_power_low;
  const high = interval.target_power_high;

  if (interval.target_power_type === 'percent_ftp') {
    const ftpValue = ftp || DEFAULT_FTP;
    const lowW = Math.round((low / 100) * ftpValue);
    const highW = Math.round((high / 100) * ftpValue);
    if (Math.abs(highW - lowW) <= 5) {
      return `${lowW} W`;
    }
    return `${lowW}-${highW} W`;
  }

  if (Math.abs(high - low) <= 5) {
    return `${Math.round(low)} W`;
  }
  return `${Math.round(low)}-${Math.round(high)} W`;
};

const getIntervalPowerDetail = (interval, ftp) => {
  if (!interval) return '';
  const low = interval.target_power_low || 0;
  const high = interval.target_power_high || 0;
  if (interval.target_power_type === 'percent_ftp') {
    const percentLabel = Math.abs(high - low) <= 2
      ? `${Math.round(low)}%`
      : `${Math.round(low)}-${Math.round(high)}%`;
    const wattLabel = formatIntervalPower(interval, ftp);
    return `${percentLabel} (${wattLabel})`;
  }
  return formatIntervalPower(interval, ftp);
};

const hexToRgba = (hex, alpha) => {
  if (!hex || typeof hex !== 'string') return `rgba(148, 163, 184, ${alpha})`;
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const buildIntervalPreview = (intervals, ftp) => {
  if (!intervals.length) return null;

  const maxIntervals = 12;
  const displayIntervals = intervals.slice(0, maxIntervals);
  const hasMore = intervals.length > maxIntervals;

  return (
    <div className="workout-card__intervals">
      <div className="workout-card__intervals-label">Workout Structure</div>
      <div className="workout-card__intervals-viz">
        {displayIntervals.map((interval, index) => {
          const duration = Math.max(1, interval.duration || 0);
          const powerPercent = getIntervalPowerPercent(interval, ftp);
          const barClass = getIntervalColorClass(interval, powerPercent);
          const relativeHeight = Math.min(100, Math.max(20, (powerPercent / 120) * 100));
          return (
            <div
              key={`${interval.interval_type || 'interval'}-${index}`}
              className={`workout-card__interval-bar ${barClass}`}
              style={{ height: `${relativeHeight}%`, flex: `${duration} 0 0` }}
            ></div>
          );
        })}
        {hasMore && (
          <div className="workout-card__intervals-more">+{intervals.length - maxIntervals}</div>
        )}
      </div>
    </div>
  );
};

const buildStructurePreview = (intervals, ftp) => {
  if (!intervals.length) return null;

  const totalDuration = intervals.reduce((sum, interval) => sum + (interval.duration || 0), 0);
  if (!totalDuration) return null;

  let currentTime = 0;
  const blocks = intervals.map((interval, index) => {
    const duration = interval.duration || 0;
    if (!duration) return null;

    const widthPercent = (duration / totalDuration) * 100;
    const powerPercent = getIntervalPowerPercent(interval, ftp);
    const clampedPower = Math.min(MAX_POWER_PERCENT, Math.max(30, powerPercent));
    const height = Math.max(18, (clampedPower / MAX_POWER_PERCENT) * PREVIEW_HEIGHT);
    const colorClass = getIntervalColorClass(interval, clampedPower);
    const left = (currentTime / totalDuration) * 100;
    currentTime += duration;

    return (
      <div
        key={`chart-${index}`}
        className={`wb-preview__block ${colorClass}`}
        style={{
          left: `${left}%`,
          width: `${widthPercent}%`,
          height: `${height}px`
        }}
        title={`${formatIntervalType(interval.interval_type)} • ${getIntervalPowerDetail(interval, ftp)}`}
      ></div>
    );
  });

  return (
    <div className="wb-preview" style={{ height: `${PREVIEW_HEIGHT}px` }}>
      <div className="wb-preview__zones">
        {POWER_ZONES.map((zone) => {
          const topPercent = Math.min(zone.max, MAX_POWER_PERCENT);
          const bottomPercent = zone.min;
          const top = PREVIEW_HEIGHT - (topPercent / MAX_POWER_PERCENT) * PREVIEW_HEIGHT;
          const bandHeight = ((topPercent - bottomPercent) / MAX_POWER_PERCENT) * PREVIEW_HEIGHT;
          return (
            <div
              key={`preview-${zone.id}`}
              className="wb-preview__zone"
              style={{
                top: `${top}px`,
                height: `${bandHeight}px`,
                backgroundColor: hexToRgba(zone.color, 0.16)
              }}
            ></div>
          );
        })}
      </div>
      {blocks}
    </div>
  );
};

const WorkoutLibraryApp = () => {
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [userFtp, setUserFtp] = useState(DEFAULT_FTP);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalWorkout, setModalWorkout] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const hydrateWorkoutIntervals = useCallback(async (items = []) => {
    const requests = (items || []).map(async (workout) => {
      if (!workout?.id) return workout;
      if (Array.isArray(workout.intervals) && workout.intervals.length) {
        return workout;
      }

      try {
        const detail = await API.getWorkout(workout.id);
        return {
          ...workout,
          intervals: detail?.intervals || []
        };
      } catch (error) {
        console.error('Error fetching workout intervals:', error);
        return workout;
      }
    });

    return Promise.all(requests);
  }, []);

  const loadWorkouts = useCallback(async () => {
    try {
      setLoading(true);
      const [workoutsResponse, settings] = await Promise.all([
        API.getWorkouts({
          include_templates: true,
          limit: CONFIG.DEFAULT_LIMIT
        }),
        API.getSettings()
      ]);

      const ftpValue = parseFloat(settings?.ftp);
      setUserFtp(Number.isFinite(ftpValue) ? ftpValue : DEFAULT_FTP);

      const hydrated = await hydrateWorkoutIntervals(workoutsResponse || []);
      const sorted = CONFIG.SHOW_TEMPLATES_FIRST
        ? [...hydrated].sort((a, b) => Number(Boolean(b.is_template)) - Number(Boolean(a.is_template)))
        : hydrated;

      setWorkouts(sorted);
    } catch (error) {
      console.error('Error loading workout library:', error);
      notify(`Failed to load workouts: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [hydrateWorkoutIntervals]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  const filteredWorkouts = useMemo(() => {
    const normalizedType = normalizeFilter(selectedType);
    const searchLower = searchTerm.trim().toLowerCase();
    const searchNormalized = normalizeFilter(searchTerm);

    return workouts.filter((workout) => {
      const name = String(workout.name || '').toLowerCase();
      const description = String(workout.description || '').toLowerCase();
      const workoutTypeRaw = String(workout.workout_type || '').trim().toLowerCase();
      const workoutTypeNormalized = normalizeFilter(workout.workout_type);
      const workoutTags = Array.isArray(workout.tags) ? workout.tags : [];
      const normalizedHaystack = `${name}${description}${workoutTypeRaw}${workoutTags.join('')}`;

      const matchesSearch = !searchLower ||
        name.includes(searchLower) ||
        description.includes(searchLower) ||
        workoutTypeRaw.includes(searchLower) ||
        (searchNormalized && normalizedHaystack.includes(searchNormalized));

      const matchesType = !normalizedType ||
        workoutTypeNormalized === normalizedType ||
        workoutTags.some((tag) => normalizeFilter(tag) === normalizedType);

      return matchesSearch && matchesType;
    });
  }, [workouts, searchTerm, selectedType]);

  const openWorkoutModal = useCallback(async (workoutId) => {
    if (!workoutId) return;

    setModalOpen(true);
    setModalLoading(true);

    let workout = workouts.find((item) => String(item.id) === String(workoutId));
    try {
      if (!workout) {
        workout = await API.getWorkout(workoutId);
      } else if (!Array.isArray(workout.intervals) || !workout.intervals.length) {
        const detail = await API.getWorkout(workoutId);
        workout = { ...workout, intervals: detail?.intervals || [] };
      }
    } catch (error) {
      console.error('Error fetching workout details:', error);
      notify('Unable to load workout details', 'error');
      setModalOpen(false);
      setModalLoading(false);
      return;
    }

    const sortedIntervals = Array.isArray(workout?.intervals)
      ? [...workout.intervals].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [];

    setModalWorkout({ ...workout, intervals: sortedIntervals });
    setModalLoading(false);
  }, [workouts]);

  const closeWorkoutModal = () => {
    setModalOpen(false);
    setModalWorkout(null);
  };

  const handleSchedule = (id) => {
    window.location.hash = `#/calendar?workout=${id}`;
  };

  const handleEdit = (id) => {
    const target = `workout-builder?edit=${id}`;
    if (window.router?.navigateTo) {
      window.router.navigateTo(target);
      return;
    }
    window.location.hash = `#/${target}`;
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this workout?')) {
      return;
    }

    try {
      await API.deleteWorkout(id);
      notify('Workout deleted successfully', 'success');
      setWorkouts((prev) => prev.filter((item) => String(item.id) !== String(id)));
    } catch (error) {
      console.error('Error deleting workout:', error);
      notify(`Failed to delete workout: ${error.message}`, 'error');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="page-header workout-library-hero">
          <div>
            <h1 className="page-title">{CONFIG.PAGE_TITLE}</h1>
            <div className="workout-library-hero__underline"></div>
            <p className="page-description">{CONFIG.PAGE_DESCRIPTION}</p>
          </div>
        </div>
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ height: '400px' }) }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header workout-library-hero">
        <div>
          <h1 className="page-title">{CONFIG.PAGE_TITLE}</h1>
          <div className="workout-library-hero__underline"></div>
          <p className="page-description">{CONFIG.PAGE_DESCRIPTION}</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" type="button" onClick={() => (window.location.hash = '#/workout-builder')}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Create Workout
          </button>
        </div>
      </div>

      <div className="workout-library-filters">
        <input
          type="text"
          className="form-input"
          placeholder="Search workouts..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        <select
          className="form-select"
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value)}
        >
          <option value="">All Types</option>
          {TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="workout-library-grid">
        {filteredWorkouts.length === 0 ? (
          <div className="workout-library-empty">
            <h3>No Workouts Found</h3>
            <p>Create your first workout to get started!</p>
            <button className="btn btn--primary" onClick={() => (window.location.hash = '#/workout-builder')}>
              Create Workout
            </button>
          </div>
        ) : (
          filteredWorkouts.map((workout) => {
            const workoutType = workout.workout_type || '';
            const durationMinutes = formatMinutes(workout.total_duration || 0);
            const tssValue = Number(workout.estimated_tss || 0);
            const intervals = Array.isArray(workout.intervals) ? workout.intervals : [];
            const preview = buildIntervalPreview(intervals, userFtp);
            return (
              <div
                key={workout.id}
                className="card workout-card card--clickable"
                role="button"
                tabIndex={0}
                onClick={() => openWorkoutModal(workout.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    openWorkoutModal(workout.id);
                  }
                }}
              >
                <div className="card__header">
                  <div className={`workout-card__icon ${getWorkoutTypeClass(workoutType)}`}>
                    {getWorkoutTypeIcon(workoutType)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 className="card__title">{workout.name}</h3>
                    <div className="workout-card__meta">
                      {workoutType && <span className="workout-card__type">{workoutType}</span>}
                      {workout.is_template && <span className="badge badge--primary">Template</span>}
                    </div>
                  </div>
                  <div className="card__actions">
                    <button
                      className="btn btn--icon btn--sm"
                      type="button"
                      title="Schedule workout"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSchedule(workout.id);
                      }}
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {!workout.is_template && (
                      <button
                        className="btn btn--icon btn--sm"
                        type="button"
                        title="Edit workout"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEdit(workout.id);
                        }}
                      >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 11l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 14.536a2 2 0 01-1.414.586H9V11z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4" />
                        </svg>
                      </button>
                    )}
                    {!workout.is_template && (
                      <button
                        className="btn btn--icon btn--sm btn--danger"
                        type="button"
                        title="Delete workout"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(workout.id);
                        }}
                      >
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="card__body">
                  {workout.description && <p className="workout-card__description">{workout.description}</p>}

                  <div className="workout-card__stats">
                    <div className="workout-card__stat">
                      <svg className="workout-card__stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <div className="workout-card__stat-value">{durationMinutes} min</div>
                        <div className="workout-card__stat-label">Duration</div>
                      </div>
                    </div>
                    <div className="workout-card__stat">
                      <svg className="workout-card__stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <div>
                        <div className="workout-card__stat-value">{tssValue.toFixed(0)}</div>
                        <div className="workout-card__stat-label">TSS</div>
                      </div>
                    </div>
                    <div className="workout-card__stat">
                      <svg className="workout-card__stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      <div>
                        <div className="workout-card__stat-value">{intervals.length}</div>
                        <div className="workout-card__stat-label">Intervals</div>
                      </div>
                    </div>
                  </div>

                  {preview}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div
        className={`calendar-modal ${modalOpen ? 'is-visible' : ''}`}
        id="calendar-modal"
        onClick={(event) => {
          if (event.target?.id === 'calendar-modal') {
            closeWorkoutModal();
          }
        }}
      >
        <div className="calendar-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title">
          <div className="calendar-modal__header">
            <div>
              <h3 id="calendar-modal-title">{modalWorkout?.name || 'Workout Details'}</h3>
              <p id="calendar-modal-subtitle">{modalWorkout?.workout_type || ''}</p>
            </div>
            <button className="btn btn--icon btn--sm" type="button" onClick={closeWorkoutModal} aria-label="Close">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="calendar-modal__body">
            {modalLoading && (
              <div className="calendar-modal__empty">Loading workout details...</div>
            )}
            {!modalLoading && modalWorkout && (() => {
              const durationMinutes = Math.round((modalWorkout.total_duration || 0) / 60);
              const tssValue = Number(modalWorkout.estimated_tss);
              const tssDisplay = Number.isFinite(tssValue) && tssValue > 0 ? `${Math.round(tssValue)} TSS` : 'TSS —';
              const summary = getIntervalSummary(modalWorkout, userFtp) || modalWorkout.description;
              const intervals = modalWorkout.intervals || [];
              const chart = buildStructurePreview(intervals, userFtp);

              return (
                <>
                  <div className="calendar-modal__stats">
                    <div>
                      <span className="calendar-modal__label">Duration</span>
                      <span className="calendar-modal__value">{durationMinutes} min</span>
                    </div>
                    <div>
                      <span className="calendar-modal__label">Estimated TSS</span>
                      <span className="calendar-modal__value">{tssDisplay}</span>
                    </div>
                    <div>
                      <span className="calendar-modal__label">Workout Type</span>
                      <span className="calendar-modal__value">{modalWorkout.workout_type || 'Workout'}</span>
                    </div>
                  </div>
                  {summary && <div className="calendar-modal__summary">{summary}</div>}
                  {chart && <div className="calendar-modal__preview workout-preview__chart">{chart}</div>}
                  {intervals.length > 0 && (
                    <div className="calendar-modal__section">
                      <h4>Intervals</h4>
                      <div className="calendar-modal__intervals">
                        {intervals.map((interval, index) => (
                          <div key={`interval-${index}`} className="calendar-modal__interval">
                            <span className="calendar-modal__interval-type">{formatIntervalType(interval.interval_type)}</span>
                            <span>{Math.round(interval.duration / 60)} min</span>
                            <span>{getIntervalPowerDetail(interval, userFtp)}</span>
                            {interval.description && (
                              <span className="calendar-modal__interval-desc">{interval.description}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="calendar-modal__footer">
            <button className="btn btn--secondary" type="button" onClick={closeWorkoutModal}>Close</button>
            {modalWorkout && !modalWorkout.is_template && (
              <button className="btn btn--primary" type="button" onClick={() => handleEdit(modalWorkout.id)}>
                Edit Workout
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkoutLibraryApp;
