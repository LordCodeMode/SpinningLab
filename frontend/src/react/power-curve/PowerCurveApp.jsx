import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import { eventBus, EVENTS } from '../../../static/js/core/eventBus.js';

const QUICK_RANGES = [
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: '180', label: '180d' },
  { key: '365', label: '1 Year' },
  { key: 'all', label: 'All' }
];

const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 89);
  return { start, end };
};

const formatDateForApi = (date) => {
  if (!date) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const formatDurationDetailed = (seconds) => {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} minutes`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
};

const formatDurationCompact = (seconds) => {
  if (!Number.isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
};

const formatDateShort = (isoString) => {
  if (!isoString) return '--';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(decimals);
};

const formatActivityTitle = (activity) => {
  if (!activity) return 'Activity';
  if (activity.custom_name) return activity.custom_name;

  const filename = activity.file_name || '';
  if (filename.toLowerCase().startsWith('strava_')) {
    return 'Strava Ride';
  }
  if (filename.toLowerCase().includes('strava')) {
    return 'Strava Activity';
  }
  if (filename.toLowerCase().endsWith('.fit')) {
    return 'Imported FIT Activity';
  }
  return filename || 'Activity';
};

const getActivitySource = (activity) => {
  if (!activity) return 'Session';
  const filename = activity.file_name || '';
  if (filename.toLowerCase().startsWith('strava_') || filename.toLowerCase().includes('strava')) {
    return 'Strava';
  }
  if (filename.toLowerCase().endsWith('.fit')) {
    return 'FIT';
  }
  return 'Session';
};

const POWER_CURVE_TICKS = [
  1, 5, 10, 15, 30,
  60, 120, 300, 600, 1200, 1800,
  3600, 5400, 7200, 10800, 14400, 21600, 28800, 36000, 43200
];

const POWER_CURVE_TICK_LABELS = {
  1: '1s',
  5: '5s',
  10: '10s',
  15: '15s',
  30: '30s',
  60: '1m',
  120: '2m',
  300: '5m',
  600: '10m',
  1200: '20m',
  1800: '30m',
  3600: '1h',
  5400: '1.5h',
  7200: '2h',
  10800: '3h',
  14400: '4h',
  21600: '6h',
  28800: '8h',
  36000: '10h',
  43200: '12h'
};

const preparePowerCurvePoints = (data) => {
  if (!data || !Array.isArray(data.durations) || !Array.isArray(data.powers)) {
    return [];
  }

  const maxLength = Math.min(data.durations.length, data.powers.length);
  const dedup = new Map();

  for (let i = 0; i < maxLength; i += 1) {
    const duration = data.durations[i];
    const power = data.powers[i];

    if (duration == null || power == null) continue;

    const durationNumber = Number(duration);
    const powerNumber = Number(power);
    if (!Number.isFinite(durationNumber) || !Number.isFinite(powerNumber)) continue;

    const durationValue = Math.max(1, Math.round(durationNumber));
    const existing = dedup.get(durationValue);
    if (existing === undefined || powerNumber > existing) {
      dedup.set(durationValue, powerNumber);
    }
  }

  const sortedDurations = Array.from(dedup.keys()).sort((a, b) => a - b);
  return sortedDurations.map((duration) => ({
    duration,
    power: dedup.get(duration)
  }));
};

const buildDatasetFromPoints = (points, weightedFlag = false) => {
  if (!Array.isArray(points) || points.length === 0) {
    return { durations: [], powers: [], weighted: Boolean(weightedFlag) };
  }

  return {
    durations: points.map((point) => point.duration),
    powers: points.map((point) => point.power),
    weighted: Boolean(weightedFlag)
  };
};

const computeBestWindow = (streams, durationSeconds) => {
  if (!streams || !Array.isArray(streams.time) || !Array.isArray(streams.power)) return null;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  const times = [];
  const powers = [];

  for (let i = 0; i < streams.time.length; i += 1) {
    const timeValue = Number(streams.time[i]);
    if (!Number.isFinite(timeValue)) continue;
    const powerValue = Number(streams.power[i]);
    times.push(timeValue);
    powers.push(Number.isFinite(powerValue) ? powerValue : 0);
  }

  if (times.length < 2) return null;

  const energy = new Array(times.length).fill(0);
  for (let i = 1; i < times.length; i += 1) {
    const dt = times[i] - times[i - 1];
    const p0 = powers[i - 1] ?? 0;
    const p1 = powers[i] ?? 0;
    const area = dt > 0 ? ((p0 + p1) / 2) * dt : 0;
    energy[i] = energy[i - 1] + area;
  }

  const energyAt = (time) => {
    if (time <= times[0]) return 0;
    if (time >= times[times.length - 1]) return energy[energy.length - 1];
    let low = 0;
    let high = times.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (times[mid] === time) return energy[mid];
      if (times[mid] < time) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const idx = Math.max(1, low);
    const t0 = times[idx - 1];
    const t1 = times[idx];
    const p0 = powers[idx - 1] ?? 0;
    const p1 = powers[idx] ?? 0;
    const span = t1 - t0;
    if (span <= 0) return energy[idx - 1];
    const ratio = (time - t0) / span;
    const pEnd = p0 + (p1 - p0) * ratio;
    const area = ((p0 + pEnd) / 2) * (time - t0);
    return energy[idx - 1] + area;
  };

  let bestStart = times[0];
  let bestEnd = bestStart + durationSeconds;
  let bestAvg = 0;

  for (let i = 0; i < times.length; i += 1) {
    const startTime = times[i];
    const endTime = startTime + durationSeconds;
    if (endTime > times[times.length - 1]) break;
    const avgPower = (energyAt(endTime) - energyAt(startTime)) / durationSeconds;
    if (avgPower > bestAvg) {
      bestAvg = avgPower;
      bestStart = startTime;
      bestEnd = endTime;
    }
  }

  if (bestAvg <= 0) return null;
  return { start: bestStart, end: bestEnd, avgPower: bestAvg };
};

const computeNormalizedPowerWindow = (streams, windowStart, windowEnd) => {
  if (!streams || !Array.isArray(streams.time) || !Array.isArray(streams.power)) return null;
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) return null;

  const times = [];
  const powers = [];
  for (let i = 0; i < streams.time.length; i += 1) {
    const timeValue = Number(streams.time[i]);
    if (!Number.isFinite(timeValue)) continue;
    times.push(timeValue);
    const powerValue = Number(streams.power[i]);
    powers.push(Number.isFinite(powerValue) ? powerValue : 0);
  }

  if (times.length < 2) return null;

  const startSec = Math.max(0, Math.floor(windowStart));
  const endSec = Math.ceil(windowEnd);
  if (endSec <= startSec) return null;

  let idx = 0;
  const series = [];
  for (let sec = startSec; sec <= endSec; sec += 1) {
    while (idx < times.length - 1 && times[idx + 1] < sec) {
      idx += 1;
    }
    const t0 = times[idx];
    const t1 = times[idx + 1] ?? times[idx];
    const p0 = powers[idx] ?? 0;
    const p1 = powers[idx + 1] ?? p0;
    const span = t1 - t0;
    const interp = span > 0 ? p0 + (p1 - p0) * ((sec - t0) / span) : p0;
    series.push(interp);
  }

  if (!series.length) return null;

  if (series.length < 30) {
    const avg = series.reduce((sum, val) => sum + val, 0) / series.length;
    return avg;
  }

  let rollingSum = 0;
  const rolling = [];
  for (let i = 0; i < series.length; i += 1) {
    rollingSum += series[i];
    if (i >= 30) {
      rollingSum -= series[i - 30];
    }
    if (i >= 29) {
      rolling.push(rollingSum / 30);
    }
  }

  if (!rolling.length) return null;
  const meanFourth = rolling.reduce((sum, val) => sum + val ** 4, 0) / rolling.length;
  return meanFourth > 0 ? meanFourth ** 0.25 : null;
};

const buildTimelineChartData = (streams) => {
  if (!streams || !Array.isArray(streams.time)) return null;
  const timeSeries = streams.time;
  const powerSeries = Array.isArray(streams.power) ? streams.power : [];
  const hrSeries = Array.isArray(streams.heart_rate) ? streams.heart_rate : [];

  const powerPoints = [];
  const hrPoints = [];

  for (let i = 0; i < timeSeries.length; i += 1) {
    const timeValue = Number(timeSeries[i]);
    if (!Number.isFinite(timeValue)) continue;
    const timeMinutes = timeValue / 60;
    const powerValue = Number(powerSeries[i]);
    const hrValue = Number(hrSeries[i]);

    if (Number.isFinite(powerValue)) {
      powerPoints.push({ x: timeMinutes, y: powerValue });
    }
    if (Number.isFinite(hrValue)) {
      hrPoints.push({ x: timeMinutes, y: hrValue });
    }
  }

  if (!powerPoints.length) return null;

  return {
    datasets: [
      {
        label: 'Power',
        data: powerPoints,
        borderColor: '#2563eb',
        backgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'rgba(37, 99, 235, 0.12)';
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(37, 99, 235, 0.35)');
          gradient.addColorStop(1, 'rgba(37, 99, 235, 0.04)');
          return gradient;
        },
        borderWidth: 2.5,
        tension: 0.3,
        pointRadius: 0,
        fill: true
      },
      {
        label: 'Heart Rate',
        data: hrPoints,
        borderColor: '#f97316',
        backgroundColor: (context) => {
          const { chart } = context;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'rgba(249, 115, 22, 0.08)';
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(249, 115, 22, 0.25)');
          gradient.addColorStop(1, 'rgba(249, 115, 22, 0.02)');
          return gradient;
        },
        borderWidth: 2.5,
        tension: 0.3,
        pointRadius: 0,
        yAxisID: 'hr'
      }
    ]
  };
};

const PowerCurveApp = () => {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const effortChartRef = useRef(null);
  const effortCanvasRef = useRef(null);
  const activityChartRef = useRef(null);
  const activityCanvasRef = useRef(null);

  const [range, setRange] = useState('90');
  const [start, setStart] = useState(getDefaultDates().start);
  const [end, setEnd] = useState(getDefaultDates().end);
  const [weighted, setWeighted] = useState(false);
  const [data, setData] = useState(null);
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedInsights, setExpandedInsights] = useState([]);
  const [focusedInsight, setFocusedInsight] = useState(null);
  const [insightModal, setInsightModal] = useState({
    open: false,
    loading: false,
    error: null,
    title: '',
    metricKey: '',
    metricLabel: '',
    activities: []
  });
  const [activityModal, setActivityModal] = useState({
    open: false,
    loading: false,
    error: null,
    activity: null,
    streams: null
  });

  const maxDuration = useMemo(() => {
    if (!data || !Array.isArray(data.durations) || data.durations.length === 0) return 3600;
    return Math.max(...data.durations);
  }, [data]);

  const durationTicks = useMemo(() => {
    const ticks = POWER_CURVE_TICKS.filter((tick) => tick <= maxDuration);
    if (maxDuration && !ticks.includes(maxDuration)) {
      ticks.push(maxDuration);
    }
    return ticks;
  }, [maxDuration]);
  const [effortModal, setEffortModal] = useState({
    open: false,
    loading: false,
    error: null,
    record: null,
    activity: null,
    streams: null,
    highlight: null,
    windowNormalized: null,
    durationSeconds: null,
    durationLabel: ''
  });

  useEffect(() => {
    Services.analytics.trackPageView('power-curve');
  }, []);

  const applyRange = useCallback((nextRange) => {
    const endDate = new Date();
    let startDate = null;

    switch (nextRange) {
      case '30':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 29);
        break;
      case '90':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 89);
        break;
      case '180':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 179);
        break;
      case '365':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 364);
        break;
      case 'all':
      default:
        startDate = null;
        break;
    }

    setRange(nextRange);
    setStart(startDate);
    setEnd(endDate);
  }, []);

  const getRangeParams = useCallback(() => {
    if (range === 'all' || !start || !end) return {};
    return {
      start: formatDateForApi(start),
      end: formatDateForApi(end)
    };
  }, [end, range, start]);

  const toggleInsight = useCallback((title) => {
    setExpandedInsights((prev) => {
      if (prev.includes(title)) {
        return prev.filter((item) => item !== title);
      }
      return [...prev, title];
    });
  }, []);

  const closeInsightModal = useCallback(() => {
    setInsightModal({
      open: false,
      loading: false,
      error: null,
      title: '',
      metricKey: '',
      metricLabel: '',
      activities: []
    });
  }, []);

  const closeActivityModal = useCallback(() => {
    setActivityModal({
      open: false,
      loading: false,
      error: null,
      activity: null,
      streams: null
    });
  }, []);

  const openInsightModal = useCallback(async (insight) => {
    if (!insight || !insight.metricKey) return;
    const rangeParams = getRangeParams();

    setInsightModal({
      open: true,
      loading: true,
      error: null,
      title: insight.title,
      metricKey: insight.metricKey,
      metricLabel: insight.metricLabel,
      activities: []
    });

    try {
      const activitiesResponse = await Services.data.getActivities({
        limit: 200,
        skip: 0,
        start_date: rangeParams.start,
        end_date: rangeParams.end
      });

      const activities = Array.isArray(activitiesResponse) ? activitiesResponse : activitiesResponse?.activities || [];
      const sorted = activities
        .filter((activity) => Number(activity[insight.metricKey]) > 0)
        .sort((a, b) => Number(b[insight.metricKey]) - Number(a[insight.metricKey]))
        .slice(0, 6);

      setInsightModal((prev) => ({
        ...prev,
        loading: false,
        activities: sorted
      }));
    } catch (err) {
      setInsightModal((prev) => ({
        ...prev,
        loading: false,
        error: err
      }));
    }
  }, [getRangeParams]);

  const openActivityModal = useCallback(async (activityId) => {
    if (!activityId) return;

    setInsightModal({
      open: false,
      loading: false,
      error: null,
      title: '',
      metricKey: '',
      metricLabel: '',
      activities: []
    });

    setActivityModal({
      open: true,
      loading: true,
      error: null,
      activity: null,
      streams: null
    });

    try {
      const [activity, streams] = await Promise.all([
        Services.data.getActivity(activityId),
        Services.data.getActivityStreams(activityId)
      ]);

      setActivityModal({
        open: true,
        loading: false,
        error: null,
        activity,
        streams
      });
    } catch (err) {
      setActivityModal({
        open: true,
        loading: false,
        error: err,
        activity: null,
        streams: null
      });
    }
  }, []);

  const loadData = useCallback(async (opts = {}) => {
    const { forceRefresh = false } = opts;
    setLoading(true);
    setError(null);

    try {
      const params = { weighted };
      if (range !== 'all' && start && end) {
        params.start = formatDateForApi(start);
        params.end = formatDateForApi(end);
      }

      const rawData = await Services.data.getPowerCurve({ ...params, forceRefresh });
      const curvePoints = preparePowerCurvePoints(rawData);

      if (!curvePoints || curvePoints.length === 0) {
        setData(null);
        setPoints([]);
        setLoading(false);
        return;
      }

      const normalizedData = buildDatasetFromPoints(curvePoints, rawData?.weighted ?? weighted);
      setPoints(curvePoints);
      setData(normalizedData);
    } catch (err) {
      console.error('[PowerCurvePage] loadData failed:', err);
      Services.analytics.trackError('power_curve_load_data', err.message);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [end, range, start, weighted]);

  const closeEffortModal = useCallback(() => {
    setEffortModal({
      open: false,
      loading: false,
      error: null,
      record: null,
      activity: null,
      streams: null,
      highlight: null,
      windowNormalized: null,
      durationSeconds: null,
      durationLabel: ''
    });
  }, []);

  const openEffortModal = useCallback(async (effort) => {
    if (!effort || !effort.durationSeconds) return;
    const rangeParams = getRangeParams();

    setEffortModal((prev) => ({
      ...prev,
      open: true,
      loading: true,
      error: null,
      record: null,
      activity: null,
      streams: null,
      highlight: null,
      durationSeconds: effort.durationSeconds,
      durationLabel: effort.durationLabel
    }));

    try {
      const record = await Services.data.getBestPowerRecord({
        duration: effort.durationSeconds,
        ...rangeParams
      });

      if (!record || !record.activity_id) {
        setEffortModal((prev) => ({
          ...prev,
          loading: false,
          error: new Error('No activity found for this effort in the selected range.')
        }));
        return;
      }

      const [activity, streams] = await Promise.all([
        Services.data.getActivity(record.activity_id),
        Services.data.getActivityStreams(record.activity_id)
      ]);

      const highlight = computeBestWindow(streams, effort.durationSeconds);
      const windowNormalized = highlight
        ? computeNormalizedPowerWindow(streams, highlight.start, highlight.end)
        : null;

      setEffortModal((prev) => ({
        ...prev,
        loading: false,
        record,
        activity,
        streams,
        highlight,
        windowNormalized
      }));
    } catch (err) {
      setEffortModal((prev) => ({
        ...prev,
        loading: false,
        error: err
      }));
    }
  }, [getRangeParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = eventBus.on(EVENTS.DATA_IMPORTED, () => {
      loadData({ forceRefresh: true });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadData]);

  const metaText = useMemo(() => {
    const rangeLabel = range === 'custom'
      ? `${formatDateForApi(start) || '...'} - ${formatDateForApi(end) || '...'}`
      : ({ '30': 'Last 30 days', '90': 'Last 90 days', '180': 'Last 180 days', '365': 'Last 365 days', 'all': 'All time' }[range] || 'Range');
    const unit = weighted ? 'W/kg' : 'W';
    return `${rangeLabel} - ${data?.durations?.length || 0} data points - ${unit}`;
  }, [data, end, range, start, weighted]);

  const findPowerAt = useCallback((targetDuration, payload) => {
    if (!payload || !payload.durations || !payload.powers) return null;
    const idx = payload.durations.findIndex((d) => d >= targetDuration);
    if (idx === -1) return null;
    if (idx === 0) return payload.powers[0];

    const x0 = payload.durations[idx - 1];
    const x1 = payload.durations[idx];
    const y0 = payload.powers[idx - 1];
    const y1 = payload.powers[idx];
    const t = (targetDuration - x0) / (x1 - x0);
    return y0 + t * (y1 - y0);
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const power5s = findPowerAt(5, data);
    const power1m = findPowerAt(60, data);
    const power5m = findPowerAt(300, data);
    const power20m = findPowerAt(1200, data);
    const unit = weighted ? ' W/kg' : ' W';
    return {
      power5s: power5s ? Math.round(power5s) + unit : '-',
      power1m: power1m ? Math.round(power1m) + unit : '-',
      power5m: power5m ? Math.round(power5m) + unit : '-',
      power20m: power20m ? Math.round(power20m) + unit : '-'
    };
  }, [data, findPowerAt, weighted]);

  const profile = useMemo(() => {
    if (!data) return null;
    const power5s = findPowerAt(5, data);
    const power1m = findPowerAt(60, data);
    const power20m = findPowerAt(1200, data);
    if (!power5s || !power1m || !power20m) return null;
    const sprinterScore = Math.round((power5s / power20m) * 10) / 10;
    const pursuitScore = Math.round((power1m / power20m) * 10) / 10;
    return {
      sprinterScore: sprinterScore.toFixed(1),
      pursuitScore: pursuitScore.toFixed(1),
      enduranceScore: '10.0'
    };
  }, [data, findPowerAt]);

  const bestEfforts = useMemo(() => {
    if (!data) return [];
    const keyDurations = [5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600];
    const unit = weighted ? ' W/kg' : ' W';
    return keyDurations.map((duration) => {
      const power = findPowerAt(duration, data);
      if (!power) return null;
      return {
        durationSeconds: duration,
        durationLabel: formatDurationDetailed(duration),
        powerLabel: Math.round(power) + unit
      };
    }).filter(Boolean);
  }, [data, findPowerAt, weighted]);

  const insights = useMemo(() => {
    if (!data) return [];
    const list = [];
    const power5s = findPowerAt(5, data);
    const power1m = findPowerAt(60, data);
    const power5m = findPowerAt(300, data);
    const power20m = findPowerAt(1200, data);

    if (power5s) {
      const unit = weighted ? 'W/kg' : 'W';
      list.push({
        title: 'Sprint Power',
        text: `Your peak 5-second power of ${Math.round(power5s)} ${unit} indicates ${power5s > (weighted ? 12 : 800) ? 'excellent' : power5s > (weighted ? 8 : 600) ? 'good' : 'developing'} neuromuscular capacity. This is crucial for sprints and explosive efforts.`,
        icon: 'M13 10V3L4 14h7v7l9-11h-7z',
        metricKey: 'max_5sec_power',
        metricLabel: 'Max 5s Power'
      });
    }

    if (power5m && power20m) {
      const ratio = power5m / power20m;
      list.push({
        title: 'VO2max Capacity',
        text: `Your 5-minute to 20-minute power ratio is ${ratio.toFixed(2)}. ${ratio > 1.15 ? 'Strong aerobic capacity with good VO2max development.' : 'Consider adding more high-intensity intervals to boost VO2max power.'}`,
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
        metricKey: 'max_5min_power',
        metricLabel: 'Max 5m Power'
      });
    }

    if (power20m) {
      const unit = weighted ? 'W/kg' : 'W';
      const ftpEstimate = Math.round(power20m * 0.95);
      list.push({
        title: 'Threshold Power',
        text: `Based on your 20-minute power of ${Math.round(power20m)} ${unit}, your estimated FTP is approximately ${ftpEstimate} ${unit}. This is your sustainable power for ~1 hour efforts.`,
        icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
        metricKey: 'max_20min_power',
        metricLabel: 'Max 20m Power'
      });
    }

    if (power5s && power1m && power20m) {
      const sprintRatio = power5s / power20m;
      const anaerobicRatio = power1m / power20m;
      let profileText = '';
      if (sprintRatio > 3.5) {
        profileText = 'Your power profile shows strong sprint capabilities. Focus on maintaining this strength while building endurance.';
      } else if (anaerobicRatio > 2.0) {
        profileText = 'You have a pursuit-oriented power profile with strong 1-5 minute efforts. Excellent for criteriums and short climbs.';
      } else {
        profileText = 'Your power profile leans toward time trial/endurance strengths. Your sustained power is your greatest asset.';
      }

      list.push({
        title: 'Power Profile Analysis',
        text: profileText,
        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
        metricKey: 'normalized_power',
        metricLabel: 'Normalized Power'
      });
    }

    return list;
  }, [data, findPowerAt, weighted]);

  const chartData = useMemo(() => {
    if (!data || !data.durations || !data.powers) return null;
    const xValues = data.durations;
    const yValues = data.powers;
    const keyDurations = [5, 60, 300, 1200];
    const keyPoints = keyDurations.map((duration) => {
      const idx = xValues.findIndex((d) => d >= duration);
      if (idx === -1) return null;
      if (idx === 0) return { x: duration, y: yValues[0] };
      const x0 = xValues[idx - 1];
      const x1 = xValues[idx];
      const y0 = yValues[idx - 1];
      const y1 = yValues[idx];
      const t = (duration - x0) / (x1 - x0);
      const interpolatedY = y0 + t * (y1 - y0);
      return { x: duration, y: interpolatedY };
    }).filter(Boolean);

    return {
      datasets: [
        {
          label: 'Power Curve',
          data: xValues.map((x, i) => ({ x, y: yValues[i] })),
          borderColor: '#3b82f6',
          backgroundColor: (context) => {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(59, 130, 246, 0.15)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.04)');
            return gradient;
          },
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 8,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: '#3b82f6',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3,
          order: 2
        },
        {
          label: 'Key Durations',
          data: keyPoints,
          borderColor: 'transparent',
          backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
          pointRadius: 8,
          pointHoverRadius: 12,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 3,
          pointStyle: 'circle',
          showLine: false,
          order: 1
        }
      ]
    };
  }, [data]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: { size: 12, weight: '600', family: 'Inter' },
          color: '#475569',
          generateLabels: () => ([
            { text: '5s Sprint', fillStyle: '#3b82f6', strokeStyle: '#ffffff', lineWidth: 2, pointStyle: 'circle' },
            { text: '1m Anaerobic', fillStyle: '#8b5cf6', strokeStyle: '#ffffff', lineWidth: 2, pointStyle: 'circle' },
            { text: '5m VO2max', fillStyle: '#10b981', strokeStyle: '#ffffff', lineWidth: 2, pointStyle: 'circle' },
            { text: '20m Threshold', fillStyle: '#f59e0b', strokeStyle: '#ffffff', lineWidth: 2, pointStyle: 'circle' }
          ])
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: '#3b82f6',
        borderWidth: 2,
        padding: 16,
        displayColors: true,
        boxWidth: 12,
        boxHeight: 12,
        usePointStyle: true,
        callbacks: {
          title: (context) => {
            const duration = context[0].parsed.x;
            const formatted = formatDurationDetailed(duration);
            let system = '';
            if (duration <= 10) system = 'Neuromuscular';
            else if (duration <= 60) system = 'Anaerobic';
            else if (duration <= 360) system = 'VO2max';
            else if (duration <= 1800) system = 'Threshold';
            else system = 'Endurance';
            return [formatted, system];
          },
          label: (context) => {
            const power = context.parsed.y;
            const unit = weighted ? 'W/kg' : 'W';
            const rounded = Math.round(power);
            if (context.datasetIndex === 1) {
              const labels = ['Peak 5s', 'Peak 1m', 'Peak 5m', 'Peak 20m'];
              return `${labels[context.dataIndex]}: ${rounded} ${unit}`;
            }
            return `Power: ${rounded} ${unit}`;
          },
          afterLabel: (context) => {
            if (context.datasetIndex === 0) {
              const power = context.parsed.y;
              const duration = context.parsed.x;
              const work = Math.round(power * duration / 1000);
              return `Energy: ~${work} kJ`;
            }
            return '';
          }
        },
        titleFont: { size: 14, weight: 'bold', family: 'Inter' },
        bodyFont: { size: 13, family: 'Inter' },
        titleSpacing: 8,
        bodySpacing: 6
      }
    },
    scales: {
      x: {
        type: 'logarithmic',
        position: 'bottom',
        min: 1,
        max: maxDuration || undefined,
        title: {
          display: true,
          text: 'Duration (Energy Systems ->)',
          font: { size: 13, weight: '700', family: 'Inter' },
          color: '#1e293b',
          padding: { top: 10 }
        },
        ticks: {
          callback: (value) => {
            if (POWER_CURVE_TICK_LABELS[value]) return POWER_CURVE_TICK_LABELS[value];
            if (value >= 3600) {
              const hours = value / 3600;
              return hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
            }
            if (value >= 60) {
              const minutes = value / 60;
              return minutes % 1 === 0 ? `${minutes}m` : `${minutes.toFixed(1)}m`;
            }
            return `${value}s`;
          },
          font: { size: 11, weight: '600', family: 'Inter' },
          color: '#475569',
          padding: 8
        },
        afterBuildTicks: (scale) => {
          if (!durationTicks.length) return;
          scale.ticks = durationTicks.map((value) => ({ value }));
        },
        grid: {
          color: (context) => {
            const value = context.tick.value;
            if ([5, 60, 300, 1200, 3600, 7200, 14400].includes(value)) {
              return 'rgba(59, 130, 246, 0.25)';
            }
            return 'rgba(148, 163, 184, 0.1)';
          },
          lineWidth: (context) => {
            const value = context.tick.value;
            return [5, 60, 300, 1200, 3600, 7200, 14400].includes(value) ? 2 : 1;
          },
          drawBorder: false
        }
      },
      y: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: `Power Output (${weighted ? 'W/kg' : 'Watts'})`,
          font: { size: 13, weight: '700', family: 'Inter' },
          color: '#1e293b',
          padding: { bottom: 10 }
        },
        beginAtZero: false,
        ticks: {
          font: { size: 11, weight: '600', family: 'Inter' },
          color: '#475569',
          padding: 8,
          callback: (value) => Math.round(value)
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)',
          lineWidth: 1,
          drawBorder: false
        }
      }
    },
    onClick: () => {
      Services.analytics.trackChartInteraction('power-curve', 'click');
    }
  }), [durationTicks, maxDuration, weighted]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    const canvas = canvasRef.current;
    if (!Chart || !canvas || !chartData) {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartData, chartOptions]);

  const effortChartData = useMemo(() => buildTimelineChartData(effortModal.streams), [effortModal.streams]);

  const effortHighlightPlugin = useMemo(() => ({
    id: 'effortHighlight',
    beforeDatasetsDraw: (chart) => {
      const range = chart.$highlightRange;
      if (!range) return;
      const { ctx, chartArea, scales } = chart;
      const xStart = scales.x.getPixelForValue(range.start / 60);
      const xEnd = scales.x.getPixelForValue(range.end / 60);

      ctx.save();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.14)';
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(xStart, chartArea.top, Math.max(xEnd - xStart, 2), chartArea.bottom - chartArea.top);
      ctx.strokeRect(xStart, chartArea.top, Math.max(xEnd - xStart, 2), chartArea.bottom - chartArea.top);
      ctx.restore();
    }
  }), []);

  const timelineChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          padding: 14,
          font: { size: 12, weight: '600', family: 'Inter' },
          color: '#475569'
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: '#2563eb',
        borderWidth: 2,
        padding: 12,
        callbacks: {
          title: (context) => {
            const minutes = context[0].parsed.x;
            return `Time ${minutes.toFixed(1)} min`;
          }
        },
        titleFont: { size: 13, weight: '700', family: 'Inter' },
        bodyFont: { size: 12, family: 'Inter' }
      }
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Time (minutes)',
          font: { size: 12, weight: '700', family: 'Inter' },
          color: '#1e293b'
        },
        ticks: {
          font: { size: 11, weight: '600', family: 'Inter' },
          color: '#475569'
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)',
          drawBorder: false
        }
      },
      y: {
        title: {
          display: true,
          text: 'Power (W)',
          font: { size: 12, weight: '700', family: 'Inter' },
          color: '#1e293b'
        },
        ticks: {
          font: { size: 11, weight: '600', family: 'Inter' },
          color: '#475569'
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)',
          drawBorder: false
        }
      },
      hr: {
        position: 'right',
        title: {
          display: true,
          text: 'Heart Rate',
          font: { size: 12, weight: '700', family: 'Inter' },
          color: '#1e293b'
        },
        ticks: {
          font: { size: 11, weight: '600', family: 'Inter' },
          color: '#475569'
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  }), []);

  const activityChartData = useMemo(
    () => buildTimelineChartData(activityModal.streams),
    [activityModal.streams]
  );

  const insightSummary = useMemo(() => {
    if (!insightModal.activities || !insightModal.activities.length || !insightModal.metricKey) {
      return null;
    }
    const values = insightModal.activities
      .map((activity) => Number(activity[insightModal.metricKey]))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!values.length) return null;

    const maxValue = Math.max(...values);
    const avgValue = values.reduce((sum, value) => sum + value, 0) / values.length;
    const bestActivity = insightModal.activities.find(
      (activity) => Number(activity[insightModal.metricKey]) === maxValue
    );

    const deltaPercent = avgValue > 0 ? ((maxValue - avgValue) / avgValue) * 100 : 0;
    const takeawayTone = deltaPercent >= 15 ? 'high' : deltaPercent >= 5 ? 'steady' : 'consistent';

    const takeawayText = takeawayTone === 'high'
      ? 'Takeaway: Your top session is well above your average. Keep prioritizing that stimulus and add recovery between hard blocks.'
      : takeawayTone === 'steady'
        ? 'Takeaway: Strong consistency across sessions. A short overload block could push this metric higher.'
        : 'Takeaway: Very even outputs across rides. Consider a sharp workout to stretch your ceiling.';

    return {
      maxValue,
      avgValue,
      bestActivity,
      deltaPercent,
      takeawayText
    };
  }, [insightModal.activities, insightModal.metricKey]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    const canvas = effortCanvasRef.current;

    if (!effortModal.open || !Chart || !canvas || !effortChartData) {
      if (effortChartRef.current) {
        effortChartRef.current.destroy();
        effortChartRef.current = null;
      }
      return;
    }

    if (effortChartRef.current) {
      effortChartRef.current.destroy();
      effortChartRef.current = null;
    }

    effortChartRef.current = new Chart(canvas, {
      type: 'line',
      data: effortChartData,
      options: timelineChartOptions,
      plugins: [effortHighlightPlugin]
    });

    effortChartRef.current.$highlightRange = effortModal.highlight;

    return () => {
      if (effortChartRef.current) {
        effortChartRef.current.destroy();
        effortChartRef.current = null;
      }
    };
  }, [effortChartData, timelineChartOptions, effortHighlightPlugin, effortModal.highlight, effortModal.open]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    const canvas = activityCanvasRef.current;

    if (!activityModal.open || !Chart || !canvas || !activityChartData) {
      if (activityChartRef.current) {
        activityChartRef.current.destroy();
        activityChartRef.current = null;
      }
      return;
    }

    if (activityChartRef.current) {
      activityChartRef.current.destroy();
      activityChartRef.current = null;
    }

    activityChartRef.current = new Chart(canvas, {
      type: 'line',
      data: activityChartData,
      options: timelineChartOptions
    });

    return () => {
      if (activityChartRef.current) {
        activityChartRef.current.destroy();
        activityChartRef.current = null;
      }
    };
  }, [activityChartData, activityModal.open, timelineChartOptions]);

  if (loading) {
    return (
      <div className="pc-section">
        <div className="metrics-grid" dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'metric', count: 4 }) }} />
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'chart', count: 1 }) }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="no-data">
        <svg style={{ width: 64, height: 64, marginBottom: 16, color: 'var(--text-tertiary)', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>Failed to Load Power Curve</h3>
        <p style={{ marginBottom: 16 }}>{error.message}</p>
        <button className="btn btn--primary" type="button" onClick={() => window.router?.refresh()}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="pc-section">
      <div className="pc-header">
        <h1>Power Curve</h1>
        <p>Analyze your best power outputs across all durations</p>
      </div>

      <div className="pc-toolbar">
        <div className="pc-segmented" id="pc-quick-range">
          {QUICK_RANGES.map((item) => (
            <button
              key={item.key}
              className={`pc-seg-btn ${range === item.key ? 'active' : ''}`}
              type="button"
              onClick={() => applyRange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="pc-switch">
          <input
            type="checkbox"
            checked={weighted}
            onChange={(event) => setWeighted(event.target.checked)}
          />
          <span>Show W/kg</span>
        </label>

        <div className="pc-toolbar-actions">
          <button className="pc-btn-outline" type="button" onClick={() => loadData({ forceRefresh: true })}>
            Refresh
          </button>
        </div>
      </div>

      <div className="metrics-grid" id="pc-stats-cards" style={{ display: data ? 'grid' : 'none' }}>
        <div className="metric-card">
          <div className="metric-header-row">
            <div className="metric-icon primary">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="metric-label">Peak 5s</div>
          </div>
          <div className="metric-value">{stats?.power5s || '-'}</div>
          <div className="metric-subtitle">Sprint power</div>
        </div>

        <div className="metric-card">
          <div className="metric-header-row">
            <div className="metric-icon purple">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="metric-label">Peak 1m</div>
          </div>
          <div className="metric-value">{stats?.power1m || '-'}</div>
          <div className="metric-subtitle">Anaerobic capacity</div>
        </div>

        <div className="metric-card">
          <div className="metric-header-row">
            <div className="metric-icon green">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="metric-label">Peak 5m</div>
          </div>
          <div className="metric-value">{stats?.power5m || '-'}</div>
          <div className="metric-subtitle">VO2max power</div>
        </div>

        <div className="metric-card">
          <div className="metric-header-row">
            <div className="metric-icon amber">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="metric-label">Peak 20m</div>
          </div>
          <div className="metric-value">{stats?.power20m || '-'}</div>
          <div className="metric-subtitle">FTP estimate</div>
        </div>
      </div>

      <div className="pc-main-content">
        <div className="pc-chart-card">
          <div className="pc-chart-header">
            <div className="pc-chart-header-content">
              <div>
                <h3 className="pc-chart-title">Power Duration Curve</h3>
                <p className="pc-chart-subtitle" id="pc-meta">{metaText}</p>
              </div>
            </div>
          </div>
          <div className="pc-chart-with-legend">
            <div className="pc-chart-container" id="power-curve-chart">
              {data ? (
                <canvas ref={canvasRef} id="powerCurveChart" aria-label="Power curve chart" role="img"></canvas>
              ) : (
                <div className="pc-empty-state">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3>No Power Data Available</h3>
                  <p>Upload some FIT files with power data to see your power duration curve.</p>
                </div>
              )}
            </div>
            <div className="pc-energy-legend">
              <div className="pc-legend-title">Energy Systems</div>
              <div className="pc-legend-items">
                <div className="pc-legend-item">
                  <div className="pc-legend-marker" style={{ background: '#3b82f6' }}></div>
                  <div className="pc-legend-content">
                    <div className="pc-legend-label">Neuromuscular</div>
                    <div className="pc-legend-range">1-10 seconds</div>
                    <div className="pc-legend-desc">Maximum sprint power</div>
                  </div>
                </div>
                <div className="pc-legend-item">
                  <div className="pc-legend-marker" style={{ background: '#8b5cf6' }}></div>
                  <div className="pc-legend-content">
                    <div className="pc-legend-label">Anaerobic</div>
                    <div className="pc-legend-range">10-60 seconds</div>
                    <div className="pc-legend-desc">Short max efforts</div>
                  </div>
                </div>
                <div className="pc-legend-item">
                  <div className="pc-legend-marker" style={{ background: '#10b981' }}></div>
                  <div className="pc-legend-content">
                    <div className="pc-legend-label">VO2max</div>
                    <div className="pc-legend-range">1-6 minutes</div>
                    <div className="pc-legend-desc">Aerobic capacity</div>
                  </div>
                </div>
                <div className="pc-legend-item">
                  <div className="pc-legend-marker" style={{ background: '#f59e0b' }}></div>
                  <div className="pc-legend-content">
                    <div className="pc-legend-label">Threshold</div>
                    <div className="pc-legend-range">6-30 minutes</div>
                    <div className="pc-legend-desc">Sustainable power</div>
                  </div>
                </div>
                <div className="pc-legend-item">
                  <div className="pc-legend-marker" style={{ background: '#6366f1' }}></div>
                  <div className="pc-legend-content">
                    <div className="pc-legend-label">Endurance</div>
                    <div className="pc-legend-range">30+ minutes</div>
                    <div className="pc-legend-desc">Long duration efforts</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {profile ? (
        <div className="pc-profile-section" id="pc-profile-section">
          <h3 className="pc-section-title">Power Profile</h3>
          <div className="pc-profile-grid" id="pc-profile-grid">
            <div className="pc-profile-card" data-type="sprinter">
              <div className="pc-profile-card-label">Sprinter</div>
              <div className="pc-profile-card-value">{profile.sprinterScore}</div>
              <div className="pc-profile-card-desc">5-30 second power</div>
            </div>
            <div className="pc-profile-card" data-type="pursuit">
              <div className="pc-profile-card-label">Pursuit</div>
              <div className="pc-profile-card-value">{profile.pursuitScore}</div>
              <div className="pc-profile-card-desc">1-5 minute power</div>
            </div>
            <div className="pc-profile-card" data-type="endurance">
              <div className="pc-profile-card-label">Endurance</div>
              <div className="pc-profile-card-value">{profile.enduranceScore}</div>
              <div className="pc-profile-card-desc">20+ minute power</div>
            </div>
          </div>
        </div>
      ) : null}

      {bestEfforts.length ? (
        <div className="pc-efforts-section" id="pc-efforts-section">
          <h3 className="pc-section-title">Best Efforts</h3>
          <div className="pc-efforts-grid" id="pc-efforts-tbody">
            {bestEfforts.map((effort) => (
              <button
                className="pc-effort-card pc-effort-card--action"
                type="button"
                key={effort.durationLabel}
                onClick={() => openEffortModal(effort)}
              >
                <div className="pc-effort-duration">{effort.durationLabel}</div>
                <div className="pc-effort-power">{effort.powerLabel}</div>
                <div className="pc-effort-action">Click to inspect workout</div>
                <div className="pc-effort-badge-container">
                  <span className="pc-effort-badge recent">Best</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {insights.length ? (
        <div className="pc-ai-insights" id="pc-ai-insights">
          <h3 className="pc-section-title">Insights</h3>
          {focusedInsight ? (
            <div className="pc-ai-focus-banner">
              <div>
                <strong>Focus set:</strong> {focusedInsight.title}
              </div>
              <button
                className="pc-ai-focus-action"
                type="button"
                onClick={() => openInsightModal(focusedInsight)}
              >
                View sessions
              </button>
            </div>
          ) : null}
          <div className="pc-ai-insights-grid" id="pc-ai-insights-grid">
            {insights.map((insight) => (
              <div
                className={`pc-ai-insight-item ${expandedInsights.includes(insight.title) ? 'is-expanded' : ''}`}
                key={insight.title}
              >
                <div className="pc-ai-insight-header">
                  <div className="pc-ai-insight-title-wrap">
                    <div className="pc-ai-insight-icon">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={insight.icon} />
                      </svg>
                    </div>
                    <div>
                      <h4 className="pc-ai-insight-title">{insight.title}</h4>
                    </div>
                  </div>
                  <button
                    className="pc-ai-insight-toggle"
                    type="button"
                    onClick={() => toggleInsight(insight.title)}
                  >
                    {expandedInsights.includes(insight.title) ? 'Hide' : 'Details'}
                  </button>
                </div>
                <p className="pc-ai-insight-text">{insight.text}</p>
                {expandedInsights.includes(insight.title) ? (
                  <div className="pc-ai-insight-actions">
                    <button
                      className="pc-ai-insight-chip"
                      type="button"
                      onClick={() => setFocusedInsight(insight)}
                    >
                      Set focus
                    </button>
                    <button
                      className="pc-ai-insight-chip is-ghost"
                      type="button"
                      onClick={() => openInsightModal(insight)}
                    >
                      See workouts
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="pc-info-grid">
        <div className="pc-info-card">
          <div className="pc-info-card-header">
            <div className="pc-info-card-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="pc-info-card-title">Understanding Power Curve</div>
          </div>
          <div className="pc-factor-list">
            <div className="pc-factor-item">
              <div className="pc-factor-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="pc-factor-content">
                <div className="pc-factor-title">Maximum Mean Power</div>
                <div className="pc-factor-text">Shows your best average power for any given duration from seconds to hours</div>
              </div>
            </div>
            <div className="pc-factor-item">
              <div className="pc-factor-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="pc-factor-content">
                <div className="pc-factor-title">Power Profile</div>
                <div className="pc-factor-text">Identifies your strengths - sprinter, time trialist, or all-rounder</div>
              </div>
            </div>
            <div className="pc-factor-item">
              <div className="pc-factor-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="pc-factor-content">
                <div className="pc-factor-title">Track Progress</div>
                <div className="pc-factor-text">Monitor improvements across different energy systems over time</div>
              </div>
            </div>
          </div>

          <div className="pc-insight">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="pc-insight-content">
              <div className="pc-insight-title">Power Curve Analysis</div>
              <div className="pc-insight-text">
                Your power curve reveals physiological capabilities across all durations. Short efforts (5-30s) indicate neuromuscular power, mid-range (1-5m) shows VO2max capacity, and longer durations (20-60m) reflect threshold and endurance.
              </div>
            </div>
          </div>
        </div>

        <div className="pc-info-card">
          <div className="pc-info-card-header">
            <div className="pc-info-card-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div className="pc-info-card-title">Training Applications</div>
          </div>
          <div className="pc-factor-list">
            <div className="pc-factor-item">
              <div className="pc-factor-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="pc-factor-content">
                <div className="pc-factor-title">Identify Weaknesses</div>
                <div className="pc-factor-text">Dips in your curve reveal areas needing focused training attention</div>
              </div>
            </div>
            <div className="pc-factor-item">
              <div className="pc-factor-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="pc-factor-content">
                <div className="pc-factor-title">Set Training Zones</div>
                <div className="pc-factor-text">Use curve data to establish accurate power zones for structured workouts</div>
              </div>
            </div>
            <div className="pc-factor-item">
              <div className="pc-factor-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="pc-factor-content">
                <div className="pc-factor-title">Race Pacing</div>
                <div className="pc-factor-text">Inform pacing strategies based on sustainable power for event durations</div>
              </div>
            </div>
            <div className="pc-factor-item">
              <div className="pc-factor-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="pc-factor-content">
                <div className="pc-factor-title">Monitor Fitness</div>
                <div className="pc-factor-text">Track how your curve shifts upward as fitness improves over training blocks</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {effortModal.open ? (
        <div className="pc-effort-modal">
          <div className="pc-effort-modal__overlay" onClick={closeEffortModal}></div>
          <div className="pc-effort-modal__dialog" role="dialog" aria-modal="true">
            <div className="pc-effort-modal__header">
              <div>
                <h3>Best {effortModal.durationLabel || 'effort'} workout</h3>
                <p>
                  {effortModal.activity?.custom_name || effortModal.record?.custom_name || 'Activity'}
                  {' '}
                  &bull;
                  {' '}
                  {formatDateShort(effortModal.record?.start_time)}
                </p>
              </div>
              <button className="pc-effort-modal__close" type="button" onClick={closeEffortModal}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {effortModal.loading ? (
              <div className="pc-effort-modal__loading">
                <div className="pc-spinner"></div>
                <p>Loading workout details...</p>
              </div>
            ) : effortModal.error ? (
              <div className="pc-effort-modal__error">
                <h4>Unable to load effort details</h4>
                <p>{effortModal.error.message}</p>
              </div>
            ) : (
              <>
                <div className="pc-effort-modal__stats">
                  <div className="pc-effort-modal__stat">
                    <span>Peak Avg</span>
                    <strong>{formatNumber(effortModal.record?.power_value)} W</strong>
                  </div>
                  <div className="pc-effort-modal__stat">
                    <span>Duration</span>
                    <strong>{formatDurationCompact(effortModal.durationSeconds || 0)}</strong>
                  </div>
                  <div className="pc-effort-modal__stat">
                    <span>Avg Power</span>
                    <strong>{formatNumber(effortModal.activity?.avg_power)} W</strong>
                  </div>
                  <div className="pc-effort-modal__stat">
                    <span>Avg HR</span>
                    <strong>{formatNumber(effortModal.activity?.avg_heart_rate)} bpm</strong>
                  </div>
                  <div className="pc-effort-modal__stat">
                    <span>Window NP</span>
                    <strong>{formatNumber(effortModal.windowNormalized)} W</strong>
                  </div>
                </div>

                <div className="pc-effort-modal__chart">
                  <div className="pc-effort-modal__chart-header">
                    <div>
                      <h4>Power Timeline</h4>
                      <p>Highlighted segment shows your best {effortModal.durationLabel} window.</p>
                    </div>
                  </div>
                  <div className="pc-effort-modal__chart-canvas">
                    {effortChartData ? (
                      <canvas ref={effortCanvasRef} aria-label="Best effort power timeline" role="img"></canvas>
                    ) : (
                      <div className="pc-effort-modal__chart-empty">No timeline data available.</div>
                    )}
                  </div>
                </div>

                <div className="pc-effort-modal__metrics">
                  <div className="pc-effort-modal__metric">
                    <span>Normalized Power</span>
                    <strong>{formatNumber(effortModal.activity?.normalized_power)} W</strong>
                  </div>
                  <div className="pc-effort-modal__metric">
                    <span>Max HR</span>
                    <strong>{formatNumber(effortModal.activity?.max_heart_rate)} bpm</strong>
                  </div>
                  <div className="pc-effort-modal__metric">
                    <span>TSS</span>
                    <strong>{formatNumber(effortModal.activity?.tss)}</strong>
                  </div>
                  <div className="pc-effort-modal__metric">
                    <span>IF</span>
                    <strong>{formatNumber(effortModal.activity?.intensity_factor, 2)}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {insightModal.open ? (
        <div className="pc-insight-modal">
          <div className="pc-insight-modal__overlay" onClick={closeInsightModal}></div>
          <div className="pc-insight-modal__dialog" role="dialog" aria-modal="true">
            <div className="pc-insight-modal__header">
              <div>
                <h3>{insightModal.title}</h3>
                <p>Top sessions ranked by {insightModal.metricLabel}</p>
              </div>
              <button className="pc-insight-modal__close" type="button" onClick={closeInsightModal}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {insightModal.loading ? (
              <div className="pc-effort-modal__loading">
                <div className="pc-spinner"></div>
                <p>Loading matching sessions...</p>
              </div>
            ) : insightModal.error ? (
              <div className="pc-effort-modal__error">
                <h4>Unable to load sessions</h4>
                <p>{insightModal.error.message}</p>
              </div>
            ) : (
              <div className="pc-insight-modal__list">
                {insightSummary ? (
                  <div className="pc-insight-modal__summary">
                    <div className="pc-insight-modal__summary-card">
                      <span>Best Session</span>
                      <strong>{formatNumber(insightSummary.maxValue)} W</strong>
                      <small>{insightSummary.bestActivity?.custom_name || insightSummary.bestActivity?.file_name || 'Top ride'}</small>
                    </div>
                    <div className="pc-insight-modal__summary-card">
                      <span>Average</span>
                      <strong>{formatNumber(insightSummary.avgValue)} W</strong>
                      <small>{formatNumber(insightSummary.deltaPercent, 1)}% above avg</small>
                    </div>
                    <div className="pc-insight-modal__summary-card">
                      <span>Range</span>
                      <strong>{formatNumber(insightSummary.maxValue - insightSummary.avgValue)} W</strong>
                      <small>Peak minus mean</small>
                    </div>
                    <div className="pc-insight-modal__takeaway">{insightSummary.takeawayText}</div>
                  </div>
                ) : null}

                {insightModal.activities.length ? (
                  insightModal.activities.map((activity) => {
                    const metricValue = Number(activity[insightModal.metricKey]) || 0;
                    const maxValue = insightSummary?.maxValue || metricValue || 1;
                    const percent = Math.min(100, Math.round((metricValue / maxValue) * 100));
                    return (
                      <div className="pc-insight-modal__row" key={activity.id}>
                        <div>
                          <div className="pc-insight-modal__name">{activity.custom_name || activity.file_name || 'Activity'}</div>
                          <div className="pc-insight-modal__meta">
                            {formatDateShort(activity.start_time)} &bull; {formatDurationCompact(activity.duration || 0)} &bull; Avg {formatNumber(activity.avg_power)} W
                          </div>
                          <div className="pc-insight-modal__bar">
                            <span style={{ width: `${percent}%` }}></span>
                          </div>
                        </div>
                        <div className="pc-insight-modal__value">
                          {formatNumber(metricValue)} W
                        </div>
                        <button
                          className="pc-insight-modal__action"
                          type="button"
                          onClick={() => openActivityModal(activity.id)}
                        >
                          View
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="pc-insight-modal__empty">No matching sessions found in this range.</div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {activityModal.open ? (
        <div className="pc-activity-modal">
          <div className="pc-activity-modal__overlay" onClick={closeActivityModal}></div>
          <div className="pc-activity-modal__dialog" role="dialog" aria-modal="true">
            <div className="pc-activity-modal__header">
              <div>
                <div className="pc-activity-modal__title-row">
                  <h3>{formatActivityTitle(activityModal.activity)}</h3>
                  <span className="pc-activity-modal__pill">{getActivitySource(activityModal.activity)}</span>
                </div>
                <p>{formatDateShort(activityModal.activity?.start_time)}</p>
              </div>
              <button className="pc-activity-modal__close" type="button" onClick={closeActivityModal}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {activityModal.loading ? (
              <div className="pc-effort-modal__loading">
                <div className="pc-spinner"></div>
                <p>Loading activity details...</p>
              </div>
            ) : activityModal.error ? (
              <div className="pc-effort-modal__error">
                <h4>Unable to load activity</h4>
                <p>{activityModal.error.message}</p>
              </div>
            ) : (
              <>
                <div className="pc-activity-modal__stats">
                  <div>
                    <span>Duration</span>
                    <strong>{formatDurationCompact(activityModal.activity?.duration || 0)}</strong>
                  </div>
                  <div>
                    <span>Avg Power</span>
                    <strong>{formatNumber(activityModal.activity?.avg_power)} W</strong>
                  </div>
                  <div>
                    <span>Avg HR</span>
                    <strong>{formatNumber(activityModal.activity?.avg_heart_rate)} bpm</strong>
                  </div>
                  <div>
                    <span>TSS</span>
                    <strong>{formatNumber(activityModal.activity?.tss)}</strong>
                  </div>
                </div>

                <div className="pc-activity-modal__chart">
                  <div className="pc-activity-modal__chart-header">
                    <h4>Power & HR Timeline</h4>
                    <p>Explore pacing trends throughout the session.</p>
                  </div>
                  <div className="pc-activity-modal__chart-canvas">
                    {activityChartData ? (
                      <canvas ref={activityCanvasRef} aria-label="Activity power timeline" role="img"></canvas>
                    ) : (
                      <div className="pc-effort-modal__chart-empty">No timeline data available.</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PowerCurveApp;
