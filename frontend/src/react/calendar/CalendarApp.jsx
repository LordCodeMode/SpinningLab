import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import API from '../../../static/js/core/api.js';
import { notify } from '../../../static/js/utils/notifications.js';
import CONFIG from '../../../static/js/pages/calendar/config.js';
import { getIntervalColorClass, getIntervalPowerPercent } from '../../../static/js/utils/workout-colors.js';
import { POWER_ZONES } from '../../../static/js/pages/workout-builder/zones.js';

const getHashParams = () => {
  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return {};
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  return Object.fromEntries(params.entries());
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateParam = (value) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return new Date(value);
  const parts = value.split('-').map(Number);
  if (parts.length === 3 && parts.every((num) => Number.isFinite(num))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(value);
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getMonthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const getMonthEnd = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const formatDateDisplay = (date) => date.toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const formatMonthDisplay = (date) => date.toLocaleDateString('en-US', {
  month: 'long',
  year: 'numeric'
});

const getDayName = (date) => date.toLocaleDateString('en-US', { weekday: 'short' });

const normalizeDateKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.split('T')[0];
  }
  const dateObj = new Date(value);
  if (Number.isNaN(dateObj.getTime())) return '';
  return formatDate(dateObj);
};

const isToday = (date) => date.toDateString() === new Date().toDateString();

const getWorkoutTypeClass = (workoutType) => {
  const normalized = String(workoutType || '').toLowerCase();
  if (normalized.includes('vo2')) return 'vo2max';
  if (normalized.includes('threshold')) return 'threshold';
  if (normalized.includes('sweet')) return 'sweet-spot';
  if (normalized.includes('endurance')) return 'endurance';
  if (normalized.includes('recovery')) return 'recovery';
  if (normalized.includes('anaerobic') || normalized.includes('sprint')) return 'anaerobic';
  return 'default';
};

const getWorkoutTypeIcon = (type) => {
  const icons = {
    'Sweet Spot': (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    VO2max: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    Threshold: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    Endurance: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    Recovery: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    Anaerobic: (
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

const formatIntervalType = (type) => {
  const map = {
    warmup: 'Warm-up',
    work: 'Work',
    recovery: 'Recovery',
    cooldown: 'Cooldown'
  };
  return map[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Interval');
};

const normalizeWorkoutFilter = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '');

const MAX_POWER_PERCENT = 200;
const PREVIEW_HEIGHT = 120;

const hexToRgba = (hex, alpha) => {
  if (!hex || typeof hex !== 'string') return `rgba(148, 163, 184, ${alpha})`;
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CalendarApp = () => {
  const [currentView, setCurrentView] = useState(CONFIG.DEFAULT_VIEW || 'week');
  const [currentWeekStart, setCurrentWeekStart] = useState(null);
  const [currentMonthStart, setCurrentMonthStart] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [monthData, setMonthData] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [workoutMap, setWorkoutMap] = useState(new Map());
  const workoutMapRef = useRef(new Map());
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null);
  const [lastAddedPlannedWorkoutId, setLastAddedPlannedWorkoutId] = useState(null);
  const [userFtp, setUserFtp] = useState(250);
  const [workoutSearchTerm, setWorkoutSearchTerm] = useState('');
  const [workoutTypeFilter, setWorkoutTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const initialLoadRef = useRef(true);
  const [modalState, setModalState] = useState({
    open: false,
    title: '',
    subtitle: '',
    durationMinutes: 0,
    tssDisplay: 'TSS —',
    workoutType: 'Workout',
    summary: '',
    intervals: [],
    structure: null
  });
  const dragWorkoutIdRef = useRef(null);
  const dragPlannedIdRef = useRef(null);
  const dragPlannedDateRef = useRef('');
  const dropHandledRef = useRef(false);
  const [dragOverDate, setDragOverDate] = useState('');
  const [dragPreview, setDragPreview] = useState({
    sourceId: null,
    sourceDate: '',
    targetId: null,
    targetDate: ''
  });
  const plannedRefMap = useRef(new Map());
  const plannedPositionsRef = useRef(new Map());

  useEffect(() => {
    workoutMapRef.current = workoutMap;
  }, [workoutMap]);

  const registerPlannedRef = useCallback((plannedId) => (node) => {
    const key = String(plannedId);
    if (node) {
      plannedRefMap.current.set(key, node);
      return;
    }
    plannedRefMap.current.delete(key);
  }, []);

  useLayoutEffect(() => {
    const elements = Array.from(plannedRefMap.current.values());
    const nextPositions = new Map();

    elements.forEach((el) => {
      const workoutId = el.dataset.workoutId;
      if (!workoutId) return;
      nextPositions.set(workoutId, el.getBoundingClientRect());
    });

    const prevPositions = plannedPositionsRef.current;
    elements.forEach((el) => {
      const workoutId = el.dataset.workoutId;
      if (!workoutId) return;
      const prev = prevPositions.get(workoutId);
      const next = nextPositions.get(workoutId);
      if (!prev || !next) return;
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 5) return;
      if (el.animate) {
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 180, easing: 'ease-out' }
        );
      } else {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        el.style.transition = 'transform 0s';
        requestAnimationFrame(() => {
          el.style.transform = '';
          el.style.transition = 'transform 180ms ease-out';
        });
      }
    });

    plannedPositionsRef.current = nextPositions;
  }, [dragPreview, currentView, calendarData, monthData, refreshToken]);

  const resetDragPreview = useCallback(() => {
    dragPlannedIdRef.current = null;
    dragPlannedDateRef.current = '';
    setDragPreview({
      sourceId: null,
      sourceDate: '',
      targetId: null,
      targetDate: ''
    });
  }, []);

  const sortPlannedWorkouts = useCallback((items = []) => {
    return [...items].sort((a, b) => {
      const aOrder = a?.sort_order ?? 0;
      const bOrder = b?.sort_order ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aTime = new Date(a?.created_at || 0).getTime();
      const bTime = new Date(b?.created_at || 0).getTime();
      return aTime - bTime;
    });
  }, []);

  const initializeFromHash = useCallback(() => {
    const params = getHashParams();
    const view = params.view;
    const startParam = params.start;
    const storedPlanStart = localStorage.getItem('training_plan_start_date');

    const nextView = view === 'week' || view === 'month' ? view : (CONFIG.DEFAULT_VIEW || 'week');

    let baseDate = new Date();
    if (startParam) {
      const parsed = parseDateParam(startParam);
      if (!Number.isNaN(parsed.getTime())) baseDate = parsed;
    } else if (storedPlanStart) {
      const parsed = parseDateParam(storedPlanStart);
      if (!Number.isNaN(parsed.getTime())) baseDate = parsed;
    }

    const weekStart = getWeekStart(baseDate);
    const monthStart = getMonthStart(baseDate);

    setCurrentView(nextView);
    setCurrentWeekStart(weekStart);
    setCurrentMonthStart(monthStart);
  }, []);

  const fetchUserSettings = useCallback(async () => {
    try {
      const settings = await API.getSettings();
      setUserFtp(settings?.ftp || 250);
    } catch (err) {
      console.error('Error fetching user settings:', err);
      setUserFtp(250);
    }
  }, []);

  const fetchWorkouts = useCallback(async () => {
    try {
      const response = await API.getWorkouts({ include_templates: true });
      const list = Array.isArray(response) ? response : [];
      setWorkouts(list);
      setWorkoutMap(new Map(list.map((workout) => [workout.id, workout])));
    } catch (err) {
      console.error('Error fetching workouts:', err);
      setWorkouts([]);
      setWorkoutMap(new Map());
    }
  }, []);

  const fetchMonthData = useCallback(async (monthStart) => {
    const monthBase = monthStart ? getMonthStart(monthStart) : getMonthStart(new Date());
    const monthEnd = getMonthEnd(monthBase);
    const gridStart = getWeekStart(monthBase);
    const gridEnd = new Date(getWeekStart(monthEnd));
    gridEnd.setDate(gridEnd.getDate() + 6);

    const startStr = formatDate(gridStart);
    const endStr = formatDate(gridEnd);

    const [plannedWorkouts, activitiesResponse] = await Promise.all([
      API.getPlannedWorkouts({ start_date: startStr, end_date: endStr }),
      API.getActivities({ start_date: startStr, end_date: `${endStr}T23:59:59`, limit: 1000 })
    ]);

    const plannedByDate = new Map();
    (plannedWorkouts || []).forEach((planned) => {
      const dateKey = normalizeDateKey(planned.scheduled_date);
      if (!plannedByDate.has(dateKey)) plannedByDate.set(dateKey, []);
      plannedByDate.get(dateKey).push(planned);
    });

    const activitiesByDate = new Map();
    const activities = activitiesResponse?.activities || [];
    activities.forEach((activity) => {
      if (!activity.start_time) return;
      const dateKey = normalizeDateKey(activity.start_time);
      if (!activitiesByDate.has(dateKey)) activitiesByDate.set(dateKey, []);
      activitiesByDate.get(dateKey).push(activity);
    });

    const days = [];
    let totalPlannedTss = 0;
    let totalActualTss = 0;
    const current = new Date(gridStart);

    while (current <= gridEnd) {
      const dateKey = formatDate(current);
      const planned = plannedByDate.get(dateKey) || [];
      const completed = activitiesByDate.get(dateKey) || [];
      const plannedTss = planned.reduce((sum, pw) => sum + (pw.workout?.estimated_tss || 0), 0);
      const actualTss = completed.reduce((sum, activity) => sum + (activity.tss || 0), 0);
      const isOutsideMonth = current.getMonth() !== monthBase.getMonth();

      if (!isOutsideMonth) {
        totalPlannedTss += plannedTss;
        totalActualTss += actualTss;
      }

      days.push({
        date: dateKey,
        planned_workouts: planned,
        completed_activities: completed,
        planned_tss: plannedTss,
        actual_tss: actualTss,
        isOutsideMonth
      });

      current.setDate(current.getDate() + 1);
    }

    return {
      month_start: monthBase,
      month_end: monthEnd,
      grid_start: gridStart,
      grid_end: gridEnd,
      days,
      total_planned_tss: totalPlannedTss,
      total_actual_tss: totalActualTss
    };
  }, []);

  const hydrateIntervalDetails = useCallback(async (plannedWorkouts) => {
    if (!plannedWorkouts.length) return;

    const idsToFetch = new Set();
    plannedWorkouts.forEach((item) => {
      const workout = item.workout;
      if (!workout?.id) return;
      const cached = workoutMapRef.current.get(workout.id);
      if (!cached || !Array.isArray(cached.intervals)) {
        idsToFetch.add(workout.id);
      }
    });

    if (!idsToFetch.size) return;

    const updates = new Map(workoutMapRef.current);
    await Promise.all(Array.from(idsToFetch).map(async (workoutId) => {
      try {
        const workout = await API.getWorkout(workoutId);
        updates.set(workoutId, workout);
      } catch (err) {
        console.error('Error fetching workout details:', err);
      }
    }));
    setWorkoutMap(updates);
  }, []);

  useEffect(() => {
    initializeFromHash();
  }, [initializeFromHash]);

  useEffect(() => {
    fetchWorkouts();
    fetchUserSettings();
  }, [fetchWorkouts, fetchUserSettings]);

  useEffect(() => {
    if (!currentWeekStart || !currentMonthStart) return;
    let active = true;

    const load = async () => {
      if (initialLoadRef.current) {
        setLoading(true);
      }
      setError('');
      try {
        let data;
        if (currentView === 'month') {
          setCalendarData(null);
          data = await fetchMonthData(currentMonthStart);
          if (!active) return;
          setMonthData(data);
        } else {
          setMonthData(null);
          const weekStartStr = formatDate(currentWeekStart);
          data = await API.getCalendarWeek({ week_start: weekStartStr });
          if (!active) return;
          setCalendarData(data);
        }

        const planned = data?.days?.flatMap((day) => day.planned_workouts || []) || [];
        await hydrateIntervalDetails(planned);
      } catch (err) {
        if (!active) return;
        console.error('Error loading calendar:', err);
        setError(err.message || 'Unable to load calendar');
      } finally {
        if (active && initialLoadRef.current) {
          setLoading(false);
          initialLoadRef.current = false;
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [
    currentView,
    currentWeekStart,
    currentMonthStart,
    fetchMonthData,
    hydrateIntervalDetails,
    refreshToken
  ]);

  const resolvePlannedTss = useCallback((dayData) => {
    if (Number.isFinite(dayData?.planned_tss)) return dayData.planned_tss;
    return (dayData?.planned_workouts || []).reduce(
      (sum, pw) => sum + (pw.workout?.estimated_tss || 0),
      0
    );
  }, []);

  const resolveActualTss = useCallback((dayData) => {
    if (Number.isFinite(dayData?.actual_tss)) return dayData.actual_tss;
    return (dayData?.completed_activities || []).reduce(
      (sum, activity) => sum + (activity.tss || 0),
      0
    );
  }, []);

  const totals = useMemo(() => {
    const data = currentView === 'month' ? monthData : calendarData;
    if (!data) return { planned: 0, actual: 0 };
    const planned = Number.isFinite(data.total_planned_tss)
      ? data.total_planned_tss
      : (data.days || []).reduce((total, day) => total + resolvePlannedTss(day), 0);
    const actual = Number.isFinite(data.total_actual_tss)
      ? data.total_actual_tss
      : (data.days || []).reduce((total, day) => total + resolveActualTss(day), 0);
    return { planned, actual };
  }, [calendarData, currentView, monthData, resolveActualTss, resolvePlannedTss]);

  const progressPercent = useMemo(() => {
    if (totals.planned <= 0) return 0;
    return Math.min(100, Math.round((totals.actual / totals.planned) * 100));
  }, [totals.actual, totals.planned]);

  const viewLabel = useMemo(() => {
    if (currentView === 'month') {
      return currentMonthStart ? formatMonthDisplay(currentMonthStart) : 'Month View';
    }
    const weekStart = currentWeekStart || new Date();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return `${formatDateDisplay(weekStart)} - ${formatDateDisplay(weekEnd)}`;
  }, [currentMonthStart, currentView, currentWeekStart]);

  const filteredWorkouts = useMemo(() => {
    if (!Array.isArray(workouts) || !workouts.length) return [];
    const searchTerm = workoutSearchTerm.trim().toLowerCase();
    const searchNormalized = normalizeWorkoutFilter(workoutSearchTerm);
    const typeFilter = normalizeWorkoutFilter(workoutTypeFilter);

    return workouts.filter((workout) => {
      const workoutTypeRaw = String(workout.workout_type || '').trim().toLowerCase();
      const workoutTypeNormalized = normalizeWorkoutFilter(workout.workout_type);
      const workoutTags = Array.isArray(workout.tags) ? workout.tags : [];
      const tagMatches = workoutTags.some((tag) => normalizeWorkoutFilter(tag) === typeFilter);

      if (typeFilter && workoutTypeNormalized !== typeFilter && !tagMatches) {
        return false;
      }

      if (!searchTerm) return true;

      const name = String(workout.name || '').toLowerCase();
      const description = String(workout.description || '').toLowerCase();
      const haystack = `${name}${description}${workoutTypeRaw}${workoutTags.join('')}`;
      return (
        name.includes(searchTerm) ||
        description.includes(searchTerm) ||
        workoutTypeRaw.includes(searchTerm) ||
        (searchNormalized && haystack.includes(searchNormalized))
      );
    });
  }, [workoutSearchTerm, workoutTypeFilter, workouts]);

  const handleViewChange = async (view) => {
    if (!['week', 'month'].includes(view) || view === currentView) return;
    setCurrentView(view);
    if (view === 'month') {
      const base = currentWeekStart || new Date();
      setCurrentMonthStart(getMonthStart(base));
    } else {
      const base = currentMonthStart || new Date();
      setCurrentWeekStart(getWeekStart(base));
    }
  };

  const handleToday = () => {
    const today = new Date();
    if (currentView === 'month') {
      setCurrentMonthStart(getMonthStart(today));
    } else {
      setCurrentWeekStart(getWeekStart(today));
    }
  };

  const handlePrevious = () => {
    if (currentView === 'month') {
      const monthBase = currentMonthStart || new Date();
      const monthStart = new Date(monthBase);
      monthStart.setMonth(monthStart.getMonth() - 1);
      setCurrentMonthStart(getMonthStart(monthStart));
      return;
    }
    const weekStart = currentWeekStart || getWeekStart(new Date());
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const handleNext = () => {
    if (currentView === 'month') {
      const monthBase = currentMonthStart || new Date();
      const monthStart = new Date(monthBase);
      monthStart.setMonth(monthStart.getMonth() + 1);
      setCurrentMonthStart(getMonthStart(monthStart));
      return;
    }
    const weekStart = currentWeekStart || getWeekStart(new Date());
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const handleSelectWorkout = (workoutId) => {
    setSelectedWorkoutId(workoutId);
  };

  const handleScheduleWorkout = async (workoutId, date) => {
    try {
      const plannedWorkout = await API.scheduleWorkout({
        workout_id: workoutId,
        scheduled_date: date
      });
      if (plannedWorkout?.id) {
        setLastAddedPlannedWorkoutId(plannedWorkout.id);
      }
      notify('Workout scheduled successfully', 'success');
      setRefreshToken((token) => token + 1);
    } catch (err) {
      console.error('Error scheduling workout:', err);
      notify(`Failed to schedule workout: ${err.message}`, 'error');
    }
  };

  const handleDeletePlanned = async (plannedWorkoutId) => {
    if (!window.confirm('Remove this workout from the calendar?')) return;
    try {
      await API.deletePlannedWorkout(plannedWorkoutId);
      notify('Workout removed from calendar', 'success');
      setRefreshToken((token) => token + 1);
    } catch (err) {
      console.error('Error deleting planned workout:', err);
      notify(`Failed to remove workout: ${err.message}`, 'error');
    }
  };

  const handleMovePlanned = async (plannedWorkoutId, newDate) => {
    try {
      await API.updatePlannedWorkout(plannedWorkoutId, { scheduled_date: newDate });
      notify('Workout moved', 'success');
      setRefreshToken((token) => token + 1);
    } catch (err) {
      console.error('Error moving planned workout:', err);
      notify(`Failed to move workout: ${err.message}`, 'error');
    }
  };

  const handleReorderWithinDay = async (dayDate, sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const data = currentView === 'month' ? monthData : calendarData;
    const dayKey = normalizeDateKey(dayDate);
    const dayData = data?.days?.find((day) => normalizeDateKey(day.date) === dayKey);
    if (!dayData) return;

    const planned = sortPlannedWorkouts(dayData.planned_workouts || []);
    const sourceIndex = planned.findIndex((item) => String(item.id) === String(sourceId));
    const targetIndex = planned.findIndex((item) => String(item.id) === String(targetId));
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const reordered = planned.slice();
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      await Promise.all(
        reordered.map((item, index) => API.updatePlannedWorkout(item.id, { sort_order: index }))
      );
      notify('Workout order updated', 'success');
      setRefreshToken((token) => token + 1);
    } catch (err) {
      console.error('Error reordering planned workouts:', err);
      notify(`Failed to reorder workouts: ${err.message}`, 'error');
    }
  };

  const findPlannedById = useCallback((plannedId) => {
    const data = currentView === 'month' ? monthData : calendarData;
    if (!data?.days?.length) return null;
    for (const day of data.days) {
      const match = (day.planned_workouts || []).find((item) => String(item.id) === String(plannedId));
      if (match) {
        return {
          planned: match,
          dayDate: normalizeDateKey(day.date),
          sortOrder: match.sort_order ?? 0
        };
      }
    }
    return null;
  }, [calendarData, currentView, monthData]);

  const handleSwapAcrossDays = async (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceEntry = findPlannedById(sourceId);
    const targetEntry = findPlannedById(targetId);
    if (!sourceEntry || !targetEntry) return;
    if (sourceEntry.dayDate === targetEntry.dayDate) {
      await handleReorderWithinDay(sourceEntry.dayDate, sourceId, targetId);
      return;
    }

    try {
      await API.swapPlannedWorkouts(sourceId, targetId);
      notify('Workouts swapped', 'success');
      setRefreshToken((token) => token + 1);
    } catch (err) {
      console.error('Error swapping planned workouts:', err);
      notify(`Failed to swap workouts: ${err.message}`, 'error');
    }
  };

  const getPreviewPlannedWorkouts = useCallback((dayDate, plannedWorkouts = []) => {
    const sorted = sortPlannedWorkouts(plannedWorkouts).map((item) => ({
      ...item,
      __slotId: item.id
    }));
    const { sourceId, sourceDate, targetId, targetDate } = dragPreview;
    if (!sourceId || !targetId) return sorted;

    const dayKey = normalizeDateKey(dayDate);
    const sourceKey = normalizeDateKey(sourceDate);
    const targetKey = normalizeDateKey(targetDate);

    if (!sourceKey || !targetKey) return sorted;

    if (sourceKey === targetKey) {
      if (dayKey !== sourceKey) return sorted;
      const sourceIndex = sorted.findIndex((item) => String(item.id) === String(sourceId));
      const targetIndex = sorted.findIndex((item) => String(item.id) === String(targetId));
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return sorted;
      const preview = sorted.slice();
      const [moved] = preview.splice(sourceIndex, 1);
      preview.splice(targetIndex, 0, moved);
      return preview;
    }

    if (dayKey === sourceKey) {
      const sourceIndex = sorted.findIndex((item) => String(item.id) === String(sourceId));
      if (sourceIndex < 0) return sorted;
      const targetEntry = findPlannedById(targetId);
      if (!targetEntry) return sorted;
      const preview = sorted.slice();
      preview[sourceIndex] = { ...targetEntry.planned, __slotId: sourceId };
      return preview;
    }

    if (dayKey === targetKey) {
      const targetIndex = sorted.findIndex((item) => String(item.id) === String(targetId));
      if (targetIndex < 0) return sorted;
      const sourceEntry = findPlannedById(sourceId);
      if (!sourceEntry) return sorted;
      const preview = sorted.slice();
      preview[targetIndex] = { ...sourceEntry.planned, __slotId: targetId };
      return preview;
    }

    return sorted;
  }, [dragPreview, findPlannedById, sortPlannedWorkouts]);

  const handleAddWorkout = (date) => {
    if (!selectedWorkoutId) {
      notify('Please select a workout from the library first', 'info');
      return;
    }
    handleScheduleWorkout(selectedWorkoutId, date);
  };

  const handleDragStart = (event, workoutId) => {
    dragWorkoutIdRef.current = workoutId;
    event.dataTransfer.setData('workout-id', String(workoutId));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handlePlannedDragStart = (event, plannedId, scheduledDate) => {
    console.log('handlePlannedDragStart', { plannedId, scheduledDate });
    dragPlannedIdRef.current = plannedId;
    dragPlannedDateRef.current = scheduledDate || '';
    dropHandledRef.current = false;
    event.dataTransfer.setData('planned-workout-id', String(plannedId));
    if (scheduledDate) {
      event.dataTransfer.setData('planned-date', scheduledDate);
    }
    event.dataTransfer.effectAllowed = 'move';

    // Delay preview state update to let drag establish first
    requestAnimationFrame(() => {
      setDragPreview({
        sourceId: plannedId,
        sourceDate: normalizeDateKey(scheduledDate),
        targetId: null,
        targetDate: ''
      });
    });
  };

  const handlePlannedDragOver = (event, plannedId, dayDate) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    const targetDate = normalizeDateKey(dayDate);
    setDragPreview((prev) => {
      if (plannedId === prev.sourceId) {
        console.log('DragOver: skipping, hovering over source');
        return prev;
      }
      if (prev.targetId === plannedId && prev.targetDate === targetDate) {
        return prev;
      }
      console.log('DragOver: setting target', { plannedId, targetDate });
      return {
        ...prev,
        targetId: plannedId,
        targetDate
      };
    });
  };

  const handlePlannedDragEnd = () => {
    console.log('handlePlannedDragEnd called', { dropHandled: dropHandledRef.current });
    setTimeout(() => {
      if (!dropHandledRef.current) {
        resetDragPreview();
      }
      dropHandledRef.current = false;
    }, 0);
  };

  const handlePlannedDrop = async (event, targetId, dayDate) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverDate('');

    console.log('handlePlannedDrop called', { targetId, dayDate, dropHandled: dropHandledRef.current });

    if (dropHandledRef.current) {
      console.log('Drop already handled, skipping');
      return;
    }

    dropHandledRef.current = true;
    const sourceId = Number(event.dataTransfer.getData('planned-workout-id') || dragPlannedIdRef.current);
    const sourceDate = event.dataTransfer.getData('planned-date') || dragPlannedDateRef.current;

    console.log('Drop data', { sourceId, targetId, sourceDate, dayDate });

    if (!sourceId || !targetId) {
      console.log('Missing source or target ID');
      resetDragPreview();
      return;
    }
    const sourceEntry = findPlannedById(sourceId);
    if (!sourceEntry) {
      console.log('Source entry not found');
      resetDragPreview();
      setRefreshToken((token) => token + 1);
      return;
    }
    const sourceKey = normalizeDateKey(sourceDate);
    const targetKey = normalizeDateKey(dayDate);

    console.log('Executing swap/reorder', { sourceKey, targetKey, sourceId, targetId });

    resetDragPreview();

    if (sourceKey !== targetKey) {
      await handleSwapAcrossDays(sourceId, targetId);
      return;
    }

    await handleReorderWithinDay(dayDate, sourceId, targetId);
  };

  const handleDragOver = (event, date) => {
    console.log('handleDragOver (day container)', { date, target: event.target.className });
    event.preventDefault();
    const types = Array.from(event.dataTransfer?.types || []);
    const isPlanned = types.includes('planned-workout-id');
    event.dataTransfer.dropEffect = isPlanned ? 'move' : 'copy';
    setDragOverDate(date);
  };

  const handleDrop = async (event, date) => {
    event.preventDefault();
    setDragOverDate('');
    const plannedIdRaw = event.dataTransfer.getData('planned-workout-id') || dragPlannedIdRef.current;
    if (plannedIdRaw) {
      if (dropHandledRef.current) {
        return;
      }
      dropHandledRef.current = true;
      const plannedId = Number(plannedIdRaw);
      const sourceDate = event.dataTransfer.getData('planned-date') || dragPlannedDateRef.current;
      const sourceKey = normalizeDateKey(sourceDate);
      const targetKey = normalizeDateKey(date);
      const sourceEntry = findPlannedById(plannedId);
      if (!sourceEntry) {
        resetDragPreview();
        setRefreshToken((token) => token + 1);
        return;
      }
      let dropTargetEl = event.target?.closest?.('.calendar-workout');
      if (!dropTargetEl && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        const elementAtPoint = document.elementFromPoint(event.clientX, event.clientY);
        dropTargetEl = elementAtPoint?.closest?.('.calendar-workout') || null;
      }
      const resolvedTargetId = dropTargetEl?.dataset?.slotId
        ? Number(dropTargetEl.dataset.slotId)
        : (dragPreview.targetId && dragPreview.targetDate === targetKey ? dragPreview.targetId : null);
      const targetEntry = resolvedTargetId ? findPlannedById(resolvedTargetId) : null;

      resetDragPreview();

      if (targetEntry && resolvedTargetId && String(targetEntry.dayDate) === String(targetKey)) {
        if (sourceKey !== targetKey) {
          await handleSwapAcrossDays(plannedId, resolvedTargetId);
        } else if (plannedId !== resolvedTargetId) {
          await handleReorderWithinDay(date, plannedId, resolvedTargetId);
        }
      } else if (plannedId && date && sourceKey !== targetKey) {
        await handleMovePlanned(plannedId, date);
      }
      return;
    }

    const workoutId = Number(event.dataTransfer.getData('workout-id') || dragWorkoutIdRef.current);
    if (workoutId && date) {
      await handleScheduleWorkout(workoutId, date);
    }
  };

  const closeModal = () => setModalState((prev) => ({ ...prev, open: false }));

  const formatIntervalPower = useCallback((interval) => {
    if (!interval?.target_power_low || !interval?.target_power_high) return '';
    const low = interval.target_power_low;
    const high = interval.target_power_high;

    if (interval.target_power_type === 'percent_ftp') {
      const ftp = userFtp || 250;
      const lowW = Math.round((low / 100) * ftp);
      const highW = Math.round((high / 100) * ftp);
      if (Math.abs(highW - lowW) <= 5) return `${lowW} W`;
      return `${lowW}-${highW} W`;
    }

    if (Math.abs(high - low) <= 5) return `${Math.round(low)} W`;
    return `${Math.round(low)}-${Math.round(high)} W`;
  }, [userFtp]);

  const getIntervalPowerDetail = useCallback((interval) => {
    if (!interval) return '';
    const low = interval.target_power_low || 0;
    const high = interval.target_power_high || 0;
    if (interval.target_power_type === 'percent_ftp') {
      const percentLabel = Math.abs(high - low) <= 2
        ? `${Math.round(low)}%`
        : `${Math.round(low)}-${Math.round(high)}%`;
      const wattLabel = formatIntervalPower(interval);
      return `${percentLabel} (${wattLabel})`;
    }
    return formatIntervalPower(interval);
  }, [formatIntervalPower]);

  const renderWorkoutStructure = useCallback((intervals) => {
    if (!intervals.length) return null;
    const totalDuration = intervals.reduce((sum, interval) => sum + (interval.duration || 0), 0);
    if (!totalDuration) return null;

    let currentTime = 0;
    const blocks = intervals.map((interval, index) => {
      const duration = interval.duration || 0;
      if (!duration) return null;

      const widthPercent = (duration / totalDuration) * 100;
      const powerPercent = getIntervalPowerPercent(interval, userFtp);
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
          title={`${formatIntervalType(interval.interval_type)} • ${getIntervalPowerDetail(interval)}`}
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
  }, [getIntervalPowerDetail, userFtp]);

  const getIntervalSummary = useCallback((workout) => {
    if (!workout) return '';
    const intervals = Array.isArray(workout.intervals) ? workout.intervals : [];
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
    const powerLabel = formatIntervalPower(best.interval);
    if (!durationMinutes || !powerLabel) return '';
    return `${best.count} x ${durationMinutes} min at ${powerLabel}`;
  }, [formatIntervalPower]);

  const getWorkoutSummary = useCallback((workout) => {
    const summary = workout?.description?.trim();
    if (!summary) return '';
    if (summary.length <= 90) return summary;
    return `${summary.slice(0, 87)}...`;
  }, []);

  const openPlannedWorkoutModal = async (plannedWorkoutId) => {
    if (!plannedWorkoutId) return;
    const data = currentView === 'month' ? monthData : calendarData;
    let plannedWorkout = null;
    data?.days?.some((day) => {
      const match = (day.planned_workouts || []).find((item) => String(item.id) === String(plannedWorkoutId));
      if (match) plannedWorkout = match;
      return Boolean(match);
    });

    if (!plannedWorkout) {
      try {
        plannedWorkout = await API.getPlannedWorkout(plannedWorkoutId);
      } catch (err) {
        console.error('Error fetching planned workout:', err);
        notify('Unable to load workout details', 'error');
        return;
      }
    }

    const workout = plannedWorkout?.workout;
    if (!workout) return;

    let workoutDetails = workoutMap.get(workout.id) || workout;
    if (!Array.isArray(workoutDetails.intervals)) {
      try {
        workoutDetails = await API.getWorkout(workout.id);
        const updated = new Map(workoutMap);
        updated.set(workout.id, workoutDetails);
        setWorkoutMap(updated);
      } catch (err) {
        console.error('Error fetching workout details:', err);
      }
    }

    const scheduledDate = plannedWorkout.scheduled_date
      ? formatDateDisplay(parseDateParam(plannedWorkout.scheduled_date))
      : '';
    const workoutType = workoutDetails.workout_type || workout.workout_type || 'Workout';
    const durationMinutes = Math.round((workoutDetails.total_duration || 0) / 60);
    const tssValue = Number(workoutDetails.estimated_tss);
    const tssDisplay = Number.isFinite(tssValue) && tssValue > 0 ? `${Math.round(tssValue)} TSS` : 'TSS —';
    const summary = getIntervalSummary(workoutDetails) || getWorkoutSummary(workoutDetails);
    const intervals = Array.isArray(workoutDetails.intervals)
      ? [...workoutDetails.intervals].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [];

    setModalState({
      open: true,
      title: workoutDetails.name || workout.name || 'Workout Details',
      subtitle: scheduledDate ? `${scheduledDate} • ${workoutType}` : workoutType,
      durationMinutes,
      tssDisplay,
      workoutType,
      summary,
      intervals,
      structure: renderWorkoutStructure(intervals)
    });
  };

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">{CONFIG.PAGE_TITLE}</h1>
        <p className="page-description">{CONFIG.PAGE_DESCRIPTION}</p>
        <div className="calendar-container">
          <div className="calendar-main">
            <div className="calendar-view">
              <div className="calendar-empty">Loading calendar...</div>
            </div>
          </div>
          <div className="calendar-sidebar">
            <div className="calendar-sidebar__header">
              <h3>Workout Library</h3>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-header">
        <h1 className="page-title">{CONFIG.PAGE_TITLE}</h1>
        <div className="error-state">
          <h3>Error Loading Calendar</h3>
          <p>{error}</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      </div>
    );
  }

  const viewData = currentView === 'month' ? monthData : calendarData;
  const days = viewData?.days || [];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{CONFIG.PAGE_TITLE}</h1>
        <div className="page-header__actions calendar-controls">
          <div className="calendar-view-toggle">
            <button
              className={`btn btn--secondary ${currentView === 'week' ? 'is-active' : ''}`}
              type="button"
              onClick={() => handleViewChange('week')}
            >
              Week
            </button>
            <button
              className={`btn btn--secondary ${currentView === 'month' ? 'is-active' : ''}`}
              type="button"
              onClick={() => handleViewChange('month')}
            >
              Month
            </button>
          </div>
          <div className="calendar-nav">
            <button className="btn btn--secondary calendar-nav__today" type="button" onClick={handleToday}>Today</button>
            <div className="calendar-nav__arrows">
              <button className="btn btn--secondary calendar-nav__arrow" type="button" onClick={handlePrevious}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button className="btn btn--secondary calendar-nav__arrow" type="button" onClick={handleNext}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="calendar-container">
        <div className="calendar-main">
          <div className="calendar-header">
            <div className="calendar-header__range">
              <span className="calendar-header__label">Date Range</span>
              <h2 className="calendar-week-label">{viewLabel}</h2>
              <span className="calendar-header__chip">
                {currentView === 'month' ? 'Monthly planning' : 'Weekly planning'}
              </span>
            </div>
            <div className="calendar-week-stats">
              <div className="calendar-stat calendar-stat--planned">
                <span className="calendar-stat__label">Planned TSS</span>
                <span className="calendar-stat__value">{totals.planned.toFixed(0)}</span>
                <span className="calendar-stat__meta">Target load</span>
              </div>
              <div className="calendar-stat calendar-stat--actual">
                <span className="calendar-stat__label">Actual TSS</span>
                <span className="calendar-stat__value">{totals.actual.toFixed(0)}</span>
                <span className="calendar-stat__meta">Completed load</span>
                <div className="calendar-stat__progress" aria-hidden="true">
                  <div className="calendar-stat__progress-bar" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <span className="calendar-stat__progress-label">{progressPercent}% of plan</span>
              </div>
            </div>
          </div>

          <div className="calendar-view">
            {currentView === 'month' ? (
              <div className="calendar-month">
                <div className="calendar-month__weekdays">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                    <div key={label} className="calendar-month__weekday">{label}</div>
                  ))}
                </div>
                <div className="calendar-month__grid">
                  {days.map((day) => {
                    const date = parseDateParam(day.date);
                    const plannedWorkouts = getPreviewPlannedWorkouts(day.date, day.planned_workouts || []);
                    const completedActivities = day.completed_activities || [];
                    const plannedTss = resolvePlannedTss(day);
                    const actualTss = resolveActualTss(day);
                    const showEmpty = plannedWorkouts.length === 0 && completedActivities.length === 0 && !day.isOutsideMonth;
                    const isPast = date < new Date() && !isToday(date);

                    return (
                      <div
                        key={day.date}
                        className={`calendar-day ${isToday(date) ? 'calendar-day--today' : ''} ${isPast ? 'calendar-day--past' : ''} ${day.isOutsideMonth ? 'calendar-day--outside' : ''} ${dragOverDate === day.date ? 'calendar-day--drag-over' : ''}`}
                        data-date={day.date}
                        onDragOver={(event) => handleDragOver(event, day.date)}
                        onDragLeave={() => setDragOverDate('')}
                        onDrop={(event) => handleDrop(event, day.date)}
                      >
                        <div className="calendar-day__header">
                          <div className="calendar-day__date">
                            <div className="calendar-day__number">{date.getDate()}</div>
                          </div>
                          <button className="btn btn--icon btn--sm calendar-day__add" type="button" onClick={() => handleAddWorkout(day.date)}>
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>

                        <div
                          className="calendar-day__content"
                        >
                          {plannedWorkouts.map((planned) => {
                            const slotId = planned.__slotId ?? planned.id;
                            const workout = planned.workout;
                            if (!workout) return null;
                            const workoutDetails = workoutMap.get(workout.id) || workout;
                            const workoutType = workoutDetails.workout_type || workout.workout_type || 'Workout';
                            const workoutTypeClass = getWorkoutTypeClass(workoutType);
                            const isNew = lastAddedPlannedWorkoutId === planned.id;
                            const workoutFocus = getIntervalSummary(workoutDetails)
                              || workoutDetails.name
                              || workout.name
                              || workoutType;
                            return (
                              <div
                                key={slotId}
                                className={`calendar-workout calendar-workout--${workoutTypeClass} ${planned.completed ? 'calendar-workout--completed' : ''} ${planned.skipped ? 'calendar-workout--skipped' : ''} ${isNew ? 'calendar-workout--new' : ''} ${dragPreview.sourceId === slotId ? 'calendar-workout--preview-source' : ''} ${dragPreview.targetId === slotId ? 'calendar-workout--preview-target' : ''}`}
                                data-planned-id={slotId}
                                data-slot-id={slotId}
                                data-workout-id={planned.id}
                                ref={registerPlannedRef(slotId)}
                                draggable
                                onDragStart={(event) => handlePlannedDragStart(event, slotId, day.date)}
                                onDragOver={(event) => handlePlannedDragOver(event, slotId, day.date)}
                                onDrop={(event) => handlePlannedDrop(event, slotId, day.date)}
                                onDragEnd={handlePlannedDragEnd}
                                onClick={(event) => {
                                  if (event.target.closest('.calendar-workout__delete')) return;
                                  openPlannedWorkoutModal(planned.id);
                                }}
                              >
                                <div className="calendar-workout__content">
                                  <span className={`calendar-workout__badge calendar-workout__badge--${workoutTypeClass}`}>{workoutType}</span>
                                  <div className="calendar-workout__focus">{workoutFocus}</div>
                                </div>
                                <div className="calendar-workout__actions">
                                  <button
                                    className="btn btn--ghost btn--icon-only btn--sm calendar-workout__delete"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeletePlanned(slotId);
                                    }}
                                  >
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {completedActivities.map((activity) => {
                            const name = activity.custom_name || activity.file_name || 'Activity';
                            const durationMinutes = Math.round((activity.duration || 0) / 60);
                            return (
                              <div key={activity.id || name} className="calendar-activity">
                                <div className="calendar-activity__indicator"></div>
                                <div className="calendar-activity__content">
                                  <div className="calendar-activity__name">{name}</div>
                                  <div className="calendar-activity__meta">
                                    {durationMinutes}min{activity.tss ? ` • ${activity.tss.toFixed(0)} TSS` : ''}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {showEmpty ? <div className="calendar-day__empty">No workouts</div> : null}
                        </div>

                        <div className="calendar-day__footer">
                          <div className="calendar-day__tss">
                            {plannedTss > 0 ? <span className="calendar-day__tss-planned">{plannedTss.toFixed(0)} TSS</span> : null}
                            {actualTss > 0 ? <span className="calendar-day__tss-actual">{actualTss.toFixed(0)} actual</span> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="calendar-week">
                {days.map((day) => {
                  const date = parseDateParam(day.date);
                  const plannedWorkouts = getPreviewPlannedWorkouts(day.date, day.planned_workouts || []);
                  const completedActivities = day.completed_activities || [];
                  const plannedTss = resolvePlannedTss(day);
                  const actualTss = resolveActualTss(day);
                  const showEmpty = plannedWorkouts.length === 0 && completedActivities.length === 0 && !day.isOutsideMonth;
                  const isPast = date < new Date() && !isToday(date);

                  return (
                    <div
                      key={day.date}
                      className={`calendar-day ${isToday(date) ? 'calendar-day--today' : ''} ${isPast ? 'calendar-day--past' : ''} ${day.isOutsideMonth ? 'calendar-day--outside' : ''} ${dragOverDate === day.date ? 'calendar-day--drag-over' : ''}`}
                      data-date={day.date}
                      onDragOver={(event) => handleDragOver(event, day.date)}
                      onDragLeave={() => setDragOverDate('')}
                      onDrop={(event) => handleDrop(event, day.date)}
                    >
                      <div className="calendar-day__header">
                        <div className="calendar-day__date">
                          <div className="calendar-day__day">{getDayName(date)}</div>
                          <div className="calendar-day__number">{date.getDate()}</div>
                        </div>
                        <button className="btn btn--icon btn--sm calendar-day__add" type="button" onClick={() => handleAddWorkout(day.date)}>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>

                      <div
                        className="calendar-day__content"
                      >
                        {plannedWorkouts.map((planned) => {
                          const slotId = planned.__slotId ?? planned.id;
                          const workout = planned.workout;
                          if (!workout) return null;
                          const workoutDetails = workoutMap.get(workout.id) || workout;
                          const workoutType = workoutDetails.workout_type || workout.workout_type || 'Workout';
                          const workoutTypeClass = getWorkoutTypeClass(workoutType);
                          const isNew = lastAddedPlannedWorkoutId === planned.id;
                          const workoutFocus = getIntervalSummary(workoutDetails)
                            || workoutDetails.name
                            || workout.name
                            || workoutType;
                          return (
                            <div
                              key={slotId}
                              className={`calendar-workout calendar-workout--${workoutTypeClass} ${planned.completed ? 'calendar-workout--completed' : ''} ${planned.skipped ? 'calendar-workout--skipped' : ''} ${isNew ? 'calendar-workout--new' : ''} ${dragPreview.sourceId === slotId ? 'calendar-workout--preview-source' : ''} ${dragPreview.targetId === slotId ? 'calendar-workout--preview-target' : ''}`}
                              data-planned-id={slotId}
                              data-slot-id={slotId}
                              data-workout-id={planned.id}
                              ref={registerPlannedRef(slotId)}
                              draggable
                              onDragStart={(event) => handlePlannedDragStart(event, slotId, day.date)}
                              onDragOver={(event) => handlePlannedDragOver(event, slotId, day.date)}
                              onDrop={(event) => handlePlannedDrop(event, slotId, day.date)}
                              onDragEnd={handlePlannedDragEnd}
                              onClick={(event) => {
                                if (event.target.closest('.calendar-workout__delete')) return;
                                openPlannedWorkoutModal(planned.id);
                              }}
                            >
                              <div className="calendar-workout__content">
                                <span className={`calendar-workout__badge calendar-workout__badge--${workoutTypeClass}`}>{workoutType}</span>
                                <div className="calendar-workout__focus">{workoutFocus}</div>
                              </div>
                              <div className="calendar-workout__actions">
                                <button
                                  className="btn btn--ghost btn--icon-only btn--sm calendar-workout__delete"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeletePlanned(slotId);
                                  }}
                                >
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {completedActivities.map((activity) => {
                          const name = activity.custom_name || activity.file_name || 'Activity';
                          const durationMinutes = Math.round((activity.duration || 0) / 60);
                          return (
                            <div key={activity.id || name} className="calendar-activity">
                              <div className="calendar-activity__indicator"></div>
                              <div className="calendar-activity__content">
                                <div className="calendar-activity__name">{name}</div>
                                <div className="calendar-activity__meta">
                                  {durationMinutes}min{activity.tss ? ` • ${activity.tss.toFixed(0)} TSS` : ''}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {showEmpty ? <div className="calendar-day__empty">No workouts</div> : null}
                      </div>

                      <div className="calendar-day__footer">
                        <div className="calendar-day__tss">
                          {plannedTss > 0 ? <span className="calendar-day__tss-planned">{plannedTss.toFixed(0)} TSS</span> : null}
                          {actualTss > 0 ? <span className="calendar-day__tss-actual">{actualTss.toFixed(0)} actual</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="calendar-sidebar" id="calendar-sidebar">
          <div className="calendar-sidebar__header">
            <h3>Workout Library</h3>
            <button className="btn btn--primary btn--sm" type="button" onClick={() => { window.location.hash = '#/workout-builder'; }}>
              Create Workout
            </button>
          </div>

          <div className="calendar-sidebar__search">
            <input
              type="text"
              className="form-input"
              placeholder="Search workouts..."
              value={workoutSearchTerm}
              onChange={(event) => setWorkoutSearchTerm(event.target.value)}
            />
          </div>

          <div className="calendar-sidebar__filters">
            <select
              className="form-select"
              value={workoutTypeFilter}
              onChange={(event) => setWorkoutTypeFilter(event.target.value)}
            >
              <option value="">All Types</option>
              <option value="Sweet Spot">Sweet Spot</option>
              <option value="VO2max">VO2max</option>
              <option value="Threshold">Threshold</option>
              <option value="Endurance">Endurance</option>
              <option value="Recovery">Recovery</option>
              <option value="Anaerobic">Anaerobic</option>
            </select>
          </div>

          <div className="calendar-sidebar__workouts">
            {filteredWorkouts.length ? (
              filteredWorkouts.map((workout) => {
                const durationMinutes = Math.round((workout.total_duration || 0) / 60);
                const workoutTypeClass = getWorkoutTypeClass(workout.workout_type);
                const isSelected = selectedWorkoutId === workout.id;
                return (
                  <div
                    key={workout.id}
                    className={`compact-workout-card ${isSelected ? 'compact-workout-card--selected' : ''}`}
                    draggable
                    onClick={() => handleSelectWorkout(workout.id)}
                    onDragStart={(event) => handleDragStart(event, workout.id)}
                  >
                    <div className={`compact-workout-card__icon workout-card__icon--${workoutTypeClass}`}>
                      {getWorkoutTypeIcon(workout.workout_type)}
                    </div>
                    <div className="compact-workout-card__content">
                      <div className="compact-workout-card__name">{workout.name}</div>
                      <div className="compact-workout-card__meta">
                        {workout.workout_type ? <span>{workout.workout_type}</span> : null} •
                        <span>{durationMinutes}min</span> •
                        <span>{Number(workout.estimated_tss || 0).toFixed(0)} TSS</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="calendar-sidebar__empty">No workouts available</div>
            )}
          </div>
        </div>
      </div>

      <div className={`calendar-modal ${modalState.open ? 'is-visible' : ''}`} onClick={(event) => {
        if (event.target?.classList.contains('calendar-modal')) closeModal();
      }}>
        <div className="calendar-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title">
          <div className="calendar-modal__header">
            <div>
              <h3 id="calendar-modal-title">{modalState.title}</h3>
              <p id="calendar-modal-subtitle">{modalState.subtitle}</p>
            </div>
            <button className="btn btn--icon btn--sm" type="button" onClick={closeModal} aria-label="Close">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="calendar-modal__body">
            {modalState.open ? (
              <>
                <div className="calendar-modal__stats">
                  <div>
                    <span className="calendar-modal__label">Duration</span>
                    <span className="calendar-modal__value">{modalState.durationMinutes} min</span>
                  </div>
                  <div>
                    <span className="calendar-modal__label">Estimated TSS</span>
                    <span className="calendar-modal__value">{modalState.tssDisplay}</span>
                  </div>
                  <div>
                    <span className="calendar-modal__label">Workout Type</span>
                    <span className="calendar-modal__value">{modalState.workoutType}</span>
                  </div>
                </div>
                {modalState.summary ? <div className="calendar-modal__summary">{modalState.summary}</div> : null}
                {modalState.structure ? <div className="calendar-modal__preview workout-preview__chart">{modalState.structure}</div> : null}
                {modalState.intervals.length ? (
                  <div className="calendar-modal__section">
                    <h4>Intervals</h4>
                    <div className="calendar-modal__intervals">
                      {modalState.intervals.map((interval, index) => (
                        <div key={`${interval.interval_type}-${index}`} className="calendar-modal__interval">
                          <span className="calendar-modal__interval-type">{formatIntervalType(interval.interval_type)}</span>
                          <span>{Math.round(interval.duration / 60)} min</span>
                          <span>{getIntervalPowerDetail(interval)}</span>
                          {interval.description ? <span className="calendar-modal__interval-desc">{interval.description}</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="calendar-modal__empty">Select a workout to see details.</div>
            )}
          </div>
          <div className="calendar-modal__footer">
            <button className="btn btn--secondary" type="button" onClick={closeModal}>Close</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CalendarApp;
