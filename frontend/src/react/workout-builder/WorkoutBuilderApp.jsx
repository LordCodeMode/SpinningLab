import React, { useEffect, useMemo, useRef, useState } from 'react';
import API from '../../../static/js/core/api.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import { notify } from '../../../static/js/utils/notifications.js';
import CONFIG from '../../../static/js/pages/workout-builder/config.js';
import { POWER_ZONES } from '../../../static/js/pages/workout-builder/zones.js';
import { INTERVAL_TEMPLATES, getTemplate, formatDuration as formatTemplateDuration } from '../../../static/js/pages/workout-builder/templates.js';
import { getIntervalColorClass, getIntervalPowerPercent } from '../../../static/js/utils/workout-colors.js';

const MAX_POWER_PERCENT = 200;
const DEFAULT_FTP = 250;
const SNAP_PREF_KEY = 'workout-builder-snap-settings';
const MIN_DURATION_SECONDS = 15;
const PREVIEW_HEIGHT = 120;

const loadSnapPrefs = () => {
  try {
    const stored = localStorage.getItem(SNAP_PREF_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        enabled: parsed.enabled !== undefined ? parsed.enabled : true,
        timeInterval: Number(parsed.timeInterval) || 30,
        powerIncrement: Number(parsed.powerIncrement) || 5,
      };
    }
  } catch (error) {
    console.warn('Failed to load snap preferences:', error);
  }

  return {
    enabled: true,
    timeInterval: 30,
    powerIncrement: 5,
  };
};

const saveSnapPrefs = (prefs) => {
  try {
    localStorage.setItem(SNAP_PREF_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('Failed to save snap preferences:', error);
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const capitalize = (value) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatDuration = (seconds) => {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0 && secs > 0) {
    return `${minutes}m ${secs}s`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${secs}s`;
};

const formatMinuteLabel = (minutes) => {
  if (minutes <= 0) return '0m';
  return formatDuration(minutes * 60);
};

const formatIntervalPowerLabel = (interval, ftp) => {
  const low = Number(interval.target_power_low) || 0;
  const high = Number(interval.target_power_high) || 0;
  const avg = (low + high) / 2;

  if (interval.target_power_type === 'percent_ftp') {
    const watts = Math.round((avg / 100) * (ftp || DEFAULT_FTP));
    return `${Math.round(avg)}% (${watts}W)`;
  }

  if (!ftp) {
    return `${Math.round(avg)}W`;
  }

  const percent = Math.round((avg / ftp) * 100);
  return `${Math.round(avg)}W (${percent}%)`;
};

const calculateIntervalsTss = (intervals, ftpValue) => {
  const ftp = Number.isFinite(ftpValue) && ftpValue > 0 ? ftpValue : DEFAULT_FTP;
  let totalTss = 0;

  intervals.forEach((interval) => {
    const durationSeconds = Number(interval.duration) || 0;
    if (!durationSeconds) return;

    const low = Number(interval.target_power_low) || 0;
    const high = Number(interval.target_power_high) || 0;
    if (!low && !high) return;

    const durationHours = durationSeconds / 3600;
    const avgPower = (low + high) / 2;

    let powerWatts = avgPower;
    if (interval.target_power_type === 'percent_ftp') {
      powerWatts = (avgPower / 100) * ftp;
    }

    const intensityFactor = powerWatts / ftp;
    if (!Number.isFinite(intensityFactor)) return;

    totalTss += durationHours * intensityFactor * intensityFactor * 100;
  });

  return Number.isFinite(totalTss) ? totalTss : 0;
};

const INTERVAL_ICON_MAP = {
  warmup: 'WU',
  work: 'INT',
  recovery: 'REC',
  cooldown: 'CD',
};

const getTimelineDimensions = (intervals, containerWidth) => {
  const height = 520;
  const minWidth = 960;
  const totalMinutesRaw = intervals.reduce((sum, interval) => (
    sum + Math.max(0.25, (interval.duration || 0) / 60)
  ), 0);
  const baselineMinutes = Math.max(totalMinutesRaw || 0, 60);
  const availableWidth = Math.max(320, containerWidth && containerWidth > 0 ? containerWidth : minWidth);
  const scale = availableWidth / baselineMinutes;

  return {
    width: availableWidth,
    height,
    scale,
    totalMinutes: baselineMinutes,
  };
};

const getInsertIndexFromX = (x, intervals, scale) => {
  let current = 0;

  for (let i = 0; i < intervals.length; i += 1) {
    const intervalMinutes = Math.max(0.25, (intervals[i].duration || 0) / 60);
    const midpoint = current + (intervalMinutes * scale) / 2;
    if (x < midpoint) {
      return i;
    }
    current += intervalMinutes * scale;
  }

  return intervals.length;
};

const withOrder = (intervals) => intervals.map((interval, idx) => ({
  ...interval,
  order: idx,
}));

const hexToRgba = (hex, alpha) => {
  if (!hex || typeof hex !== 'string') return `rgba(148, 163, 184, ${alpha})`;
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const WorkoutBuilderApp = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userFtp, setUserFtp] = useState(DEFAULT_FTP);
  const [workout, setWorkout] = useState({
    name: '',
    description: '',
    workout_type: '',
  });
  const [intervals, setIntervals] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [snapPrefs, setSnapPrefs] = useState(loadSnapPrefs());
  const [isEditing, setIsEditing] = useState(false);
  const [workoutId, setWorkoutId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(0);

  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const dragRef = useRef(null);
  const intervalsRef = useRef(intervals);
  const timelineRef = useRef(getTimelineDimensions([]));

  useEffect(() => {
    intervalsRef.current = intervals;
  }, [intervals]);

  useEffect(() => {
    saveSnapPrefs(snapPrefs);
  }, [snapPrefs]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const editId = params.get('edit');

        if (editId) {
          setIsEditing(true);
          setWorkoutId(Number(editId));
        }

        const [settings, workoutResponse] = await Promise.all([
          API.getSettings().catch(() => null),
          editId ? API.getWorkout(editId).catch(() => null) : null,
        ]);

        if (!isMounted) return;

        const ftpValue = Number(settings?.ftp);
        setUserFtp(Number.isFinite(ftpValue) && ftpValue > 0 ? ftpValue : DEFAULT_FTP);

        if (workoutResponse) {
          setWorkout({
            name: workoutResponse.name || '',
            description: workoutResponse.description || '',
            workout_type: workoutResponse.workout_type || '',
          });
          const sortedIntervals = [...(workoutResponse.intervals || [])]
            .sort((a, b) => a.order - b.order)
            .map((interval) => ({
              ...interval,
              target_power_type: interval.target_power_type || 'percent_ftp',
              target_power_low: interval.target_power_low ?? 0,
              target_power_high: interval.target_power_high ?? 0,
            }));
          setIntervals(withOrder(sortedIntervals));
        }
      } catch (error) {
        console.error('Error loading workout builder:', error);
        notify(`Failed to load workout builder: ${error.message}`, 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;

    const updateWidth = () => {
      if (!scrollRef.current) return;
      const styles = window.getComputedStyle(scrollRef.current);
      const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
      const width = scrollRef.current.clientWidth - paddingLeft - paddingRight;
      if (width > 0) {
        setCanvasWidth(width);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(scrollRef.current);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const timeline = useMemo(() => getTimelineDimensions(intervals, canvasWidth), [intervals, canvasWidth]);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  const totals = useMemo(() => {
    const totalDuration = intervals.reduce((sum, interval) => sum + (interval.duration || 0), 0);
    const estimatedTss = calculateIntervalsTss(intervals, userFtp);
    return {
      totalDuration,
      estimatedTss: Math.round(estimatedTss || 0),
      count: intervals.length,
    };
  }, [intervals, userFtp]);

  const previewBlocks = useMemo(() => {
    const totalMinutes = Math.max(totals.totalDuration / 60, 1);
    let offset = 0;

    return intervals.map((interval, index) => {
      const durationMinutes = Math.max(0.25, (interval.duration || 0) / 60);
      const widthPercent = (durationMinutes / totalMinutes) * 100;
      const powerPercentRaw = getIntervalPowerPercent(interval, userFtp);
      const powerPercent = clamp(powerPercentRaw || 0, 30, MAX_POWER_PERCENT);
      const height = Math.max(18, (powerPercent / MAX_POWER_PERCENT) * PREVIEW_HEIGHT);
      const colorClass = getIntervalColorClass(interval, powerPercent);
      const label = capitalize(interval.interval_type) || 'Block';
      const meta = `${formatDuration(interval.duration || 0)} | ${formatIntervalPowerLabel(interval, userFtp)}`;
      const left = offset;
      offset += widthPercent;

      return {
        index,
        left,
        width: widthPercent,
        height,
        colorClass,
        label,
        meta,
      };
    });
  }, [intervals, totals.totalDuration, userFtp]);

  const timeMarks = useMemo(() => {
    const marks = [];
    const totalMinutes = timeline.totalMinutes;
    const step = totalMinutes > 120 ? 30 : totalMinutes > 60 ? 20 : 15;

    for (let minute = 0; minute <= totalMinutes; minute += step) {
      marks.push(Number(minute.toFixed(2)));
    }

    const last = marks[marks.length - 1];
    if (last !== totalMinutes) {
      marks.push(Number(totalMinutes.toFixed(2)));
    }

    return marks;
  }, [timeline.totalMinutes]);

  const blocks = useMemo(() => {
    let offset = 0;

    return intervals.map((interval, index) => {
      const durationMinutes = Math.max(0.25, (interval.duration || 0) / 60);
      const width = durationMinutes * timeline.scale;
      const left = offset;
      offset += width;

      const powerPercentRaw = getIntervalPowerPercent(interval, userFtp);
      const powerPercent = clamp(powerPercentRaw || 0, 30, MAX_POWER_PERCENT);
      const barHeight = Math.max(24, Math.min(timeline.height, (powerPercent / MAX_POWER_PERCENT) * timeline.height));

      const colorClass = getIntervalColorClass(interval, powerPercent);
      const label = interval.description || capitalize(interval.interval_type) || 'Block';
      const meta = `${formatDuration(interval.duration || 0)} | ${formatIntervalPowerLabel(interval, userFtp)}`;
      const tooltip = `${label} | ${meta}`;

      return {
        index,
        left,
        width,
        height: barHeight,
        label,
        meta,
        tooltip,
        colorClass,
        isCompact: width < 140,
        isTiny: width < 80,
      };
    });
  }, [intervals, timeline.scale, timeline.height, userFtp]);

  const selectedInterval = selectedIndex !== null ? intervals[selectedIndex] : null;

  const snapTime = (seconds) => {
    if (!snapPrefs.enabled) return seconds;
    return Math.round(seconds / snapPrefs.timeInterval) * snapPrefs.timeInterval;
  };

  const snapPower = (percent) => {
    if (!snapPrefs.enabled) return percent;
    return Math.round(percent / snapPrefs.powerIncrement) * snapPrefs.powerIncrement;
  };

  const getLeftForIndex = (index, items = intervalsRef.current) => {
    let left = 0;
    for (let i = 0; i < index; i += 1) {
      left += Math.max(0.25, (items[i].duration || 0) / 60) * timelineRef.current.scale;
    }
    return left;
  };

  const updateInterval = (index, patch) => {
    setIntervals((prev) => withOrder(prev.map((item, idx) => {
      if (idx !== index) return item;
      return {
        ...item,
        ...patch,
      };
    })));
  };

  const moveInterval = (fromIndex, toIndex) => {
    setIntervals((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return withOrder(next);
    });
    setSelectedIndex(toIndex);
  };

  const addInterval = (type, dropX = null) => {
    const defaults = {
      warmup: { duration: 600, target_power_low: 55, target_power_high: 65 },
      work: { duration: 480, target_power_low: 95, target_power_high: 105 },
      recovery: { duration: 300, target_power_low: 50, target_power_high: 60 },
      cooldown: { duration: 600, target_power_low: 50, target_power_high: 60 },
    };

    const preset = defaults[type] || defaults.work;
    const interval = {
      interval_type: type,
      duration: preset.duration,
      target_power_type: 'percent_ftp',
      target_power_low: preset.target_power_low,
      target_power_high: preset.target_power_high,
      order: intervalsRef.current.length,
    };

    const baseIntervals = intervalsRef.current;
    const insertIndex = dropX !== null ? getInsertIndexFromX(dropX, baseIntervals, timelineRef.current.scale) : baseIntervals.length;
    setIntervals((prev) => {
      const next = [...prev];
      next.splice(insertIndex, 0, interval);
      return withOrder(next);
    });
    setSelectedIndex(insertIndex);
  };

  const insertTemplate = (templateId) => {
    const template = getTemplate(templateId);
    if (!template) {
      notify('Template not found', 'error');
      return;
    }

    const insertIndex = intervalsRef.current.length;
    const newIntervals = template.intervals.map((interval, idx) => ({
      interval_type: interval.type,
      duration: interval.duration,
      target_power_type: 'percent_ftp',
      target_power_low: interval.power_low,
      target_power_high: interval.power_high,
      order: insertIndex + idx,
    }));

    setIntervals((prev) => {
      const next = [...prev];
      next.splice(insertIndex, 0, ...newIntervals);
      return withOrder(next);
    });
    setSelectedIndex(insertIndex);

    notify(`Template "${template.name}" added`, 'success');
  };

  const deleteInterval = (index) => {
    setIntervals((prev) => withOrder(prev.filter((_, idx) => idx !== index)));
    setSelectedIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
    notify('Block deleted', 'success');
  };

  const handleCancel = () => {
    if (confirm('Discard changes and return to workout library?')) {
      window.location.hash = '#/workout-library';
    }
  };

  const handleSave = () => {
    if (!workout.name.trim()) {
      notify('Please enter a workout name', 'error');
      return;
    }

    if (!intervals.length) {
      notify('Please add at least one interval', 'error');
      return;
    }

    setConfirmOpen(true);
  };

  const performSave = async () => {
    const workoutData = {
      name: workout.name.trim(),
      description: workout.description.trim(),
      workout_type: workout.workout_type || null,
      total_duration: totals.totalDuration,
      estimated_tss: calculateIntervalsTss(intervals, userFtp),
      is_template: false,
      intervals: intervals.map((interval, idx) => ({
        ...interval,
        order: idx,
      })),
    };

    try {
      setSaving(true);
      if (isEditing && workoutId) {
        await API.updateWorkout(workoutId, workoutData);
        notify('Workout updated successfully', 'success');
      } else {
        await API.createWorkout(workoutData);
        notify('Workout created successfully', 'success');
      }

      setConfirmOpen(false);
      setTimeout(() => {
        window.location.hash = '#/workout-library';
      }, 400);
    } catch (error) {
      console.error('Error saving workout:', error);
      notify(`Failed to save workout: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCanvasDrop = (event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('interval-type');
    if (!type) return;

    const canvas = canvasRef.current;
    const scroller = scrollRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scrollLeft = scroller ? scroller.scrollLeft : 0;
    const dropX = event.clientX - rect.left + scrollLeft;
    addInterval(type, dropX);
  };

  const handleCanvasClick = (event) => {
    if (event.target.closest('.wb-block')) return;
    setSelectedIndex(null);
  };

  const applyPowerFromPercent = (interval, percent, range) => {
    const safePercent = clamp(percent, 30, MAX_POWER_PERCENT);
    const safeRange = Number.isFinite(range) && range > 0 ? range : 10;

    if (interval.target_power_type === 'percent_ftp') {
      const halfRange = safeRange / 2;
      return {
        ...interval,
        target_power_low: clamp(safePercent - halfRange, 30, MAX_POWER_PERCENT),
        target_power_high: clamp(safePercent + halfRange, 30, MAX_POWER_PERCENT),
      };
    }

    const ftp = Number.isFinite(userFtp) && userFtp > 0 ? userFtp : DEFAULT_FTP;
    const watts = (safePercent / 100) * ftp;
    const halfRangeWatts = ((safeRange / 100) * ftp) / 2;
    const low = Math.max(0, watts - halfRangeWatts);
    const high = Math.max(low, watts + halfRangeWatts);
    return {
      ...interval,
      target_power_low: Math.round(low),
      target_power_high: Math.round(high),
    };
  };

  const handlePointerMove = (event) => {
    const dragState = dragRef.current;
    if (!dragState) return;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    const timelineData = timelineRef.current;

    if (dragState.action === 'move') {
      if (!dragState.moved && Math.abs(dx) < 6) return;
      dragState.moved = true;
      const x = dragState.startLeft + dx + dragState.startWidth / 2;
      const targetIndex = getInsertIndexFromX(x, intervalsRef.current, timelineData.scale);
      dragState.dropIndex = targetIndex;
      setDropIndex(targetIndex);
      return;
    }

    if (dragState.action === 'left' || dragState.action === 'right') {
      const direction = dragState.action === 'left' ? -1 : 1;
      const rawWidth = Math.max(timelineData.scale * 0.25, dragState.startWidth + dx * direction);
      const rawSeconds = (rawWidth / timelineData.scale) * 60;
      const minSeconds = snapPrefs.enabled ? snapPrefs.timeInterval : MIN_DURATION_SECONDS;
      const snappedSeconds = Math.max(minSeconds, snapTime(rawSeconds));

      updateInterval(dragState.index, {
        duration: snappedSeconds,
      });
      return;
    }

    if (dragState.action === 'power') {
      const rawHeight = clamp(dragState.startHeight - dy, 24, timelineData.height);
      let percent = (rawHeight / timelineData.height) * MAX_POWER_PERCENT;
      percent = clamp(snapPower(percent), 30, MAX_POWER_PERCENT);

      setIntervals((prev) => {
        const next = [...prev];
        const interval = next[dragState.index];
        if (!interval) return prev;
        const range = (Number(interval.target_power_high) || 0) - (Number(interval.target_power_low) || 0);
        next[dragState.index] = applyPowerFromPercent(interval, percent, range);
        return withOrder(next);
      });
    }
  };

  const handlePointerUp = () => {
    const dragState = dragRef.current;
    if (!dragState) return;

    if (dragState.action === 'move' && dragState.moved) {
      const targetIndex = dragState.dropIndex;
      if (Number.isFinite(targetIndex) && targetIndex !== dragState.index) {
        moveInterval(dragState.index, targetIndex);
      }
    }

    dragRef.current = null;
    setDropIndex(null);
    setDraggingIndex(null);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };

  const startBlockDrag = (event, index) => {
    if (event.button !== 0) return;
    if (event.target.closest('[data-action="delete"]')) return;
    event.preventDefault();

    const interval = intervalsRef.current[index];
    if (!interval) return;

    const handle = event.target.closest('[data-handle]')?.dataset.handle || 'move';

    const durationMinutes = Math.max(0.25, (interval.duration || 0) / 60);
    const startWidth = durationMinutes * timelineRef.current.scale;
    const powerPercent = clamp(getIntervalPowerPercent(interval, userFtp) || 0, 30, MAX_POWER_PERCENT);
    const startHeight = Math.max(24, (powerPercent / MAX_POWER_PERCENT) * timelineRef.current.height);

    dragRef.current = {
      action: handle,
      index,
      startX: event.clientX,
      startY: event.clientY,
      startWidth,
      startHeight,
      startLeft: getLeftForIndex(index),
      moved: false,
      dropIndex: index,
    };

    setSelectedIndex(index);
    setDraggingIndex(index);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handlePowerTypeChange = (value) => {
    if (selectedIndex === null) return;

    setIntervals((prev) => {
      const next = [...prev];
      const interval = next[selectedIndex];
      if (!interval) return prev;

      const low = Number(interval.target_power_low) || 0;
      const high = Number(interval.target_power_high) || 0;
      const ftp = Number.isFinite(userFtp) && userFtp > 0 ? userFtp : DEFAULT_FTP;

      if (value === 'watts' && interval.target_power_type === 'percent_ftp') {
        const lowWatts = Math.round((low / 100) * ftp);
        const highWatts = Math.round((high / 100) * ftp);
        next[selectedIndex] = {
          ...interval,
          target_power_type: value,
          target_power_low: lowWatts,
          target_power_high: highWatts,
        };
      } else if (value === 'percent_ftp' && interval.target_power_type === 'watts') {
        const lowPercent = Math.round((low / ftp) * 100);
        const highPercent = Math.round((high / ftp) * 100);
        next[selectedIndex] = {
          ...interval,
          target_power_type: value,
          target_power_low: lowPercent,
          target_power_high: highPercent,
        };
      } else {
        next[selectedIndex] = {
          ...interval,
          target_power_type: value,
        };
      }

      return withOrder(next);
    });
  };

  if (loading) {
    return (
      <div className="wb-react">
        <div className="page-header">
          <h1 className="page-title">Loading Workout Builder...</h1>
        </div>
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'chart', count: 1, customClass: 'wb-skeleton' }) }} />
      </div>
    );
  }

  return (
    <div className="wb-react">
      <div className="wb-hero">
        <div>
          <div className="wb-hero-eyebrow">Workout Builder</div>
          <h1 className="wb-hero-title">{isEditing ? 'Edit Workout' : 'Create Workout'}</h1>
          <div className="wb-hero-underline"></div>
          <p className="wb-hero-subtitle">
            Drag blocks into the timeline to craft a complete session. Resize for duration, then pull the top handle
            to dial in power targets.
          </p>
        </div>
        <div className="wb-hero-actions">
          <button className="btn btn--secondary" type="button" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn--primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update Workout' : 'Save Workout'}
          </button>
        </div>
      </div>

      <div className="wb-layout wb-layout--focus">
        <section className="wb-builder">
          <div className="wb-canvas-card wb-canvas-card--focus">
            <div className="wb-builder-top">
              <div className="wb-builder-section">
                <div className="wb-card__header">
                  <h2 className="wb-card__title">Quick Templates</h2>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => setShowTemplates((prev) => !prev)}
                  >
                    {showTemplates ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showTemplates && (
                  <div className="wb-card__content">
                    <div className="wb-template-grid">
                      {INTERVAL_TEMPLATES.slice(0, 6).map((template) => {
                        const templateTss = Math.round(calculateIntervalsTss(template.intervals.map((interval) => ({
                          duration: interval.duration,
                          target_power_type: 'percent_ftp',
                          target_power_low: interval.power_low,
                          target_power_high: interval.power_high,
                        })), userFtp));

                        return (
                          <button
                            key={template.id}
                            type="button"
                            className="wb-template-card wb-template-card--compact"
                            onClick={() => insertTemplate(template.id)}
                            title={template.description}
                          >
                            <div className="wb-template-name">{template.name}</div>
                            <div className="wb-template-meta">
                              <span>{formatTemplateDuration(template.totalDuration)}</span>
                              <span>|</span>
                              <span>TSS {templateTss}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="wb-canvas-header">
              <div>
                <h2 className="wb-card__title">Timeline Studio</h2>
                <p className="wb-card__subtitle">Build the workout sequence and dial in intensities.</p>
              </div>
              <div className="wb-canvas-toolbar">
                <label className="wb-toggle">
                  <input
                    type="checkbox"
                    checked={snapPrefs.enabled}
                    onChange={(event) => setSnapPrefs((prev) => ({ ...prev, enabled: event.target.checked }))}
                  />
                  Snap
                </label>
                <select
                  value={snapPrefs.timeInterval}
                  onChange={(event) => setSnapPrefs((prev) => ({ ...prev, timeInterval: Number(event.target.value) }))}
                >
                  <option value={15}>15s</option>
                  <option value={30}>30s</option>
                  <option value={60}>1m</option>
                </select>
                <select
                  value={snapPrefs.powerIncrement}
                  onChange={(event) => setSnapPrefs((prev) => ({ ...prev, powerIncrement: Number(event.target.value) }))}
                >
                  <option value={1}>1%</option>
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                </select>
                <div className="wb-zoom">
                  <span>Auto-fit enabled</span>
                </div>
              </div>
            </div>

            <div className="wb-canvas-grid">
              <div className="wb-canvas-shell">
                <div className="wb-axis">
                  {[MAX_POWER_PERCENT, 150, 120, 90, 60, 30]
                    .filter((value, index, arr) => value <= MAX_POWER_PERCENT && arr.indexOf(value) === index)
                    .map((value) => (
                      <span key={value}>{value}%</span>
                    ))}
                </div>

                <div
                  className="wb-timeline-scroll"
                  ref={scrollRef}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={handleCanvasDrop}
                >
                  <div
                    className="wb-timeline"
                    ref={canvasRef}
                    style={{ width: `${timeline.width}px`, height: `${timeline.height}px` }}
                    onClick={handleCanvasClick}
                  >
                    <div className="wb-zone-layer">
                      {POWER_ZONES.map((zone) => {
                        const topPercent = Math.min(zone.max, MAX_POWER_PERCENT);
                        const bottomPercent = zone.min;
                        const top = timeline.height - (topPercent / MAX_POWER_PERCENT) * timeline.height;
                        const bandHeight = ((topPercent - bottomPercent) / MAX_POWER_PERCENT) * timeline.height;
                        return (
                          <div
                            key={zone.id}
                            className="wb-zone-band"
                            style={{
                              top: `${top}px`,
                              height: `${bandHeight}px`,
                              backgroundColor: hexToRgba(zone.color, 0.16),
                            }}
                            title={`${zone.name}: ${zone.min}-${zone.max}% FTP`}
                          >
                            <span>{zone.id}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="wb-grid">
                      {timeMarks.map((minute, index) => {
                        const left = Math.min(minute * timeline.scale, Math.max(0, timeline.width - 1));
                        const isFirst = index === 0;
                        const isLast = index === timeMarks.length - 1;
                        const labelStyle = isFirst ? { transform: 'translateX(0)' } : isLast ? { transform: 'translateX(-100%)' } : undefined;
                        return (
                          <div key={`line-${minute}`} className="wb-grid__line" style={{ left: `${left}px` }}>
                            <span className="wb-grid__label" style={labelStyle}>{formatMinuteLabel(minute)}</span>
                          </div>
                        );
                      })}
                      {[30, 60, 90, 120, 150, MAX_POWER_PERCENT]
                        .filter((value, index, arr) => value <= MAX_POWER_PERCENT && arr.indexOf(value) === index)
                        .map((value) => {
                          const top = timeline.height - (value / MAX_POWER_PERCENT) * timeline.height;
                          return (
                            <div
                              key={`hline-${value}`}
                              className="wb-grid__line wb-grid__line--horizontal"
                              style={{ top: `${top}px` }}
                            ></div>
                          );
                        })}
                    </div>

                    {dropIndex !== null && (
                      <div
                        className="wb-drop-indicator"
                        style={{ left: `${getLeftForIndex(dropIndex)}px` }}
                      ></div>
                    )}

                    {intervals.length === 0 && (
                      <div className="wb-empty">Drag blocks here or click a block to start building.</div>
                    )}

                    {blocks.map((block) => (
                      <div
                        key={block.index}
                        className={`wb-block ${block.colorClass} ${selectedIndex === block.index ? 'is-selected' : ''} ${draggingIndex === block.index ? 'is-dragging' : ''} ${block.isCompact ? 'is-compact' : ''} ${block.isTiny ? 'is-tiny' : ''}`}
                        style={{
                          left: `${block.left}px`,
                          width: `${block.width}px`,
                          height: `${block.height}px`,
                        }}
                        data-tooltip={block.width < 120 ? block.tooltip : undefined}
                        onPointerDown={(event) => startBlockDrag(event, block.index)}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedIndex(block.index);
                        }}
                      >
                        <button
                          type="button"
                          className="wb-block__delete"
                          data-action="delete"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteInterval(block.index);
                          }}
                          aria-label="Delete block"
                        >
                          x
                        </button>
                        {block.width >= 80 && (
                          <div className="wb-block__label">{block.label}</div>
                        )}
                        {block.width >= 120 && (
                          <div className="wb-block__meta">{block.meta}</div>
                        )}
                        <div className="wb-block__handle wb-block__handle--left" data-handle="left"></div>
                        <div className="wb-block__handle wb-block__handle--right" data-handle="right"></div>
                        <div className="wb-block__handle wb-block__handle--power" data-handle="power"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="wb-palette-panel">
                <div className="wb-card__header">
                  <h3 className="wb-card__title">Blocks</h3>
                </div>
                <div className="wb-card__content">
                  <div className="wb-palette wb-palette--stack">
                    {CONFIG.INTERVAL_TYPES.map((type) => {
                      const icon = INTERVAL_ICON_MAP[type.value] || type.label.slice(0, 2).toUpperCase();
                      return (
                      <button
                        key={type.value}
                        className="wb-palette__item"
                        type="button"
                        title={type.label}
                        aria-label={type.label}
                        draggable
                        data-interval-type={type.value}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('interval-type', type.value);
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => addInterval(type.value)}
                      >
                        <span className={`wb-palette__dot wb-palette__dot--${type.value}`}></span>
                        <span className="wb-palette__icon">{icon}</span>
                      </button>
                      );
                    })}
                  </div>
                  <p className="wb-helper wb-helper--center">Drag blocks into the timeline</p>
                </div>
                <div className="wb-summary-card">
                  <div className="wb-summary-card__title">Workout Summary</div>
                  <div className="wb-summary-compact">
                    <div>
                      <span className="wb-summary-label">Duration</span>
                      <span className="wb-summary-value">{formatDuration(totals.totalDuration)}</span>
                    </div>
                    <div>
                      <span className="wb-summary-label">Est. TSS</span>
                      <span className="wb-summary-value">{totals.estimatedTss}</span>
                    </div>
                    <div>
                      <span className="wb-summary-label">Blocks</span>
                      <span className="wb-summary-value">{totals.count}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="wb-inspector">
          <div className="wb-inspector-grid">
            <div className="wb-card">
              <div className="wb-card__header">
                <h2 className="wb-card__title">Workout Details</h2>
                <span className="wb-card__meta">FTP: {Math.round(userFtp)}W</span>
              </div>
              <div className="wb-card__content">
                <div className="form-group">
                  <label className="form-label" htmlFor="workout-name">Name</label>
                  <input
                    id="workout-name"
                    className="form-input"
                    type="text"
                    placeholder="e.g., Sweet Spot 3x10"
                    value={workout.name}
                    onChange={(event) => setWorkout((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="workout-description">Description</label>
                  <textarea
                    id="workout-description"
                    className="form-textarea"
                    rows="3"
                    placeholder="Optional workout description"
                    value={workout.description}
                    onChange={(event) => setWorkout((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="workout-type">Workout Type</label>
                  <select
                    id="workout-type"
                    className="form-select"
                    value={workout.workout_type}
                    onChange={(event) => setWorkout((prev) => ({ ...prev, workout_type: event.target.value }))}
                  >
                    <option value="">Select Type</option>
                    {CONFIG.WORKOUT_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="wb-card wb-card--sticky">
              <div className="wb-card__header">
                <h2 className="wb-card__title">Block Settings</h2>
                {selectedInterval && (
                  <button
                    className="btn btn--sm btn--danger btn--ghost"
                    type="button"
                    onClick={() => deleteInterval(selectedIndex)}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="wb-card__content">
                {!selectedInterval && (
                  <p className="wb-muted">Select a block to adjust duration, power, and type.</p>
                )}
                {selectedInterval && (
                  <div className="wb-form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="block-type">Type</label>
                      <select
                        id="block-type"
                        className="form-select"
                        value={selectedInterval.interval_type}
                        onChange={(event) => updateInterval(selectedIndex, { interval_type: event.target.value })}
                      >
                        {CONFIG.INTERVAL_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="block-duration">Duration (minutes)</label>
                      <input
                        id="block-duration"
                        className="form-input"
                        type="number"
                        min="0.25"
                        step="0.25"
                        value={(selectedInterval.duration || 0) / 60}
                        onChange={(event) => {
                          const minutes = Number(event.target.value) || 0;
                          const rawSeconds = minutes * 60;
                          const minSeconds = snapPrefs.enabled ? snapPrefs.timeInterval : MIN_DURATION_SECONDS;
                          updateInterval(selectedIndex, {
                            duration: Math.max(minSeconds, snapTime(rawSeconds)),
                          });
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="block-power-type">Power Target</label>
                      <select
                        id="block-power-type"
                        className="form-select"
                        value={selectedInterval.target_power_type}
                        onChange={(event) => handlePowerTypeChange(event.target.value)}
                      >
                        <option value="percent_ftp">% FTP</option>
                        <option value="watts">Watts</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="block-power-low">Power Low</label>
                      <input
                        id="block-power-low"
                        className="form-input"
                        type="number"
                        min="0"
                        step="1"
                        value={selectedInterval.target_power_low || 0}
                        onChange={(event) => updateInterval(selectedIndex, {
                          target_power_low: Number(event.target.value) || 0,
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="block-power-high">Power High</label>
                      <input
                        id="block-power-high"
                        className="form-input"
                        type="number"
                        min="0"
                        step="1"
                        value={selectedInterval.target_power_high || 0}
                        onChange={(event) => updateInterval(selectedIndex, {
                          target_power_high: Number(event.target.value) || 0,
                        })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </section>
      </div>

      {confirmOpen && (
        <div className="wb-modal">
          <div className="wb-modal__overlay" onClick={() => setConfirmOpen(false)}></div>
          <div className="wb-modal__content">
            <div className="wb-modal__header">
              <h3>Review Workout</h3>
              <button
                type="button"
                className="wb-modal__close"
                onClick={() => setConfirmOpen(false)}
                aria-label="Close"
              >
                x
              </button>
            </div>
            <div className="wb-modal__body">
              <div className="wb-modal__summary">
                <div>
                  <span className="wb-summary-label">Duration</span>
                  <span className="wb-summary-value">{formatDuration(totals.totalDuration)}</span>
                </div>
                <div>
                  <span className="wb-summary-label">Est. TSS</span>
                  <span className="wb-summary-value">{totals.estimatedTss}</span>
                </div>
                <div>
                  <span className="wb-summary-label">Blocks</span>
                  <span className="wb-summary-value">{totals.count}</span>
                </div>
              </div>
              <div className="wb-modal__preview">
                <div className="wb-modal__header-block">
                  <div>
                    <div className="wb-modal__workout-name">{workout.name || 'Untitled Workout'}</div>
                    {workout.description && (
                      <div className="wb-modal__workout-description">{workout.description}</div>
                    )}
                  </div>
                </div>
                <div className="wb-modal__preview-title">Workout Preview</div>
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
                            backgroundColor: hexToRgba(zone.color, 0.16),
                          }}
                        ></div>
                      );
                    })}
                  </div>
                  {previewBlocks.map((block) => (
                    <div
                      key={`preview-${block.index}`}
                      className={`wb-preview__block ${block.colorClass}`}
                      style={{
                        left: `${block.left}%`,
                        width: `${block.width}%`,
                        height: `${block.height}px`,
                      }}
                      title={block.meta}
                    >
                      {block.width > 12 && <span>{block.label}</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="wb-modal__list">
                {intervals.map((interval, idx) => (
                  <div key={`confirm-${idx}`} className="wb-modal__row">
                    <span className="wb-modal__index">{idx + 1}</span>
                    <span className="wb-modal__name">{capitalize(interval.interval_type)}</span>
                    <span className="wb-modal__detail">{formatDuration(interval.duration || 0)}</span>
                    <span className="wb-modal__detail">{formatIntervalPowerLabel(interval, userFtp)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="wb-modal__actions">
              <button className="btn btn--secondary" type="button" onClick={() => setConfirmOpen(false)}>
                Back
              </button>
              <button className="btn btn--primary" type="button" onClick={performSave} disabled={saving}>
                {saving ? 'Saving...' : isEditing ? 'Update Workout' : 'Save Workout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutBuilderApp;
