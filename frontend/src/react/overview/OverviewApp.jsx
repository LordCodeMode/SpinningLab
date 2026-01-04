import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthAPI } from '../../../static/js/core/api.js';
import Services from '../../../static/js/services/index.js';
import { InsightCard, LoadingSkeleton, RecommendationList } from '../../../static/js/components/ui/index.js';
import CONFIG from '../../../static/js/pages/overview/config.js';

const DISPLAY_NAME_STORAGE_KEY = CONFIG.DISPLAY_NAME_STORAGE_KEY || 'training_dashboard_display_name';
const WIDGET_ORDER = ['hero', 'quick-stats', 'main-content', 'coach-summary', 'recent-activities', 'insights'];

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeDistanceKm = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num > 1000 ? num / 1000 : num;
};

const toISODate = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) return null;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateBounds = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Math.max(0, days - 1));
  return {
    start: toISODate(start),
    end: `${toISODate(end)}T23:59:59`
  };
};

const aggregateActivitiesByDate = (activities = []) => {
  const map = new Map();

  activities.forEach((activity) => {
    if (!activity?.start_time) return;
    const dateKey = toISODate(activity.start_time);
    if (!dateKey) return;
    if (!map.has(dateKey)) {
      map.set(dateKey, {
        distance: 0,
        tss: 0,
        duration: 0,
        count: 0
      });
    }

    const bucket = map.get(dateKey);
    const distanceRaw = activity.distance
      ?? activity.total_distance
      ?? activity.totalDistance
      ?? activity.distance_km;
    const distance = normalizeDistanceKm(distanceRaw);
    const tss = Number(activity.tss ?? activity.training_stress_score);
    const duration = Number(activity.duration);

    if (Number.isFinite(distance)) bucket.distance += distance;
    if (Number.isFinite(tss)) bucket.tss += tss;
    if (Number.isFinite(duration)) bucket.duration += duration;
    bucket.count += 1;
  });

  return map;
};

const mergeTrainingLoadWithActivities = (daily = [], activitiesByDate = new Map()) => (
  daily.map((entry) => {
    const dateObj = entry.date instanceof Date ? entry.date : new Date(entry.date);
    const dateKey = Number.isNaN(dateObj.getTime()) ? null : toISODate(dateObj);
    const activitySummary = dateKey ? activitiesByDate.get(dateKey) : null;
    const entryDistance = safeNumber(entry.distance);
    const entryTss = safeNumber(entry.tss);
    const distanceKm = activitySummary && entryDistance < 0.01 ? activitySummary.distance : entryDistance;
    const tss = activitySummary && entryTss < 0.01 ? activitySummary.tss : entryTss;
    const durationSeconds = activitySummary ? activitySummary.duration : safeNumber(entry.duration);

    return {
      ...entry,
      date: dateObj,
      dateKey,
      ctl: safeNumber(entry.ctl),
      atl: safeNumber(entry.atl),
      tsb: safeNumber(entry.tsb),
      tss,
      distance: distanceKm,
      duration: durationSeconds,
      activityCount: activitySummary ? activitySummary.count : 0
    };
  })
);

const getDailyForRange = (dailyAll, range) => {
  if (!Array.isArray(dailyAll) || dailyAll.length === 0) {
    return [];
  }
  const sliceCount = Math.max(1, Math.min(range, dailyAll.length));
  return dailyAll.slice(-sliceCount);
};

const downsampleDailySeries = (series, range) => {
  if (!Array.isArray(series) || series.length <= 1) {
    return series || [];
  }

  const maxPoints = range <= 30 ? 30 : range <= 90 ? 45 : 60;
  if (series.length <= maxPoints) {
    return series;
  }

  const step = Math.ceil(series.length / maxPoints);
  const downsampled = [];
  for (let i = 0; i < series.length; i += step) {
    downsampled.push(series[i]);
  }

  if (downsampled[downsampled.length - 1] !== series[series.length - 1]) {
    downsampled.push(series[series.length - 1]);
  }

  return downsampled;
};

const startOfWeek = (date) => {
  const result = new Date(date.getTime());
  const day = result.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatDateShort = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatDateLong = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatWeekLabel = (start, end, includeYear = false) => {
  const options = includeYear
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' };
  const startLabel = start.toLocaleDateString(undefined, options);
  const endLabel = end.toLocaleDateString(undefined, options);
  return `${startLabel} - ${endLabel}`;
};

const buildTrainingChartSeries = (dailyAll, range) => {
  const daily = getDailyForRange(dailyAll, range)
    .filter((item) => item.date instanceof Date && !Number.isNaN(item.date.getTime()))
    .map((item) => ({
      ...item,
      date: new Date(item.date.getTime())
    }));

  const mode = range > 120 ? 'weekly' : 'daily';

  if (mode === 'daily') {
    const reduced = downsampleDailySeries(daily, range);
    const points = reduced.map((entry) => ({
      date: entry.date,
      endDate: entry.date,
      label: formatDateShort(entry.date),
      tooltip: formatDateLong(entry.date),
      ctl: entry.ctl,
      tss: entry.tss,
      distance: entry.distance,
      activityCount: entry.activityCount
    }));

    return {
      mode,
      points,
      hasTss: points.some((p) => Math.abs(p.tss) > 0.01),
      hasDistance: points.some((p) => Math.abs(p.distance) > 0.01)
    };
  }

  const buckets = new Map();

  daily.forEach((entry) => {
    const start = startOfWeek(entry.date);
    const key = start.toISOString();
    if (!buckets.has(key)) {
      buckets.set(key, {
        startDate: start,
        endDate: entry.date,
        ctl: entry.ctl,
        tss: entry.tss,
        distance: entry.distance,
        activityCount: entry.activityCount,
        duration: entry.duration
      });
    } else {
      const bucket = buckets.get(key);
      bucket.tss += entry.tss;
      bucket.distance += entry.distance;
      bucket.activityCount += entry.activityCount;
      bucket.duration += entry.duration;
      if (entry.date > bucket.endDate) {
        bucket.endDate = entry.date;
        bucket.ctl = entry.ctl;
      }
    }
  });

  const points = Array.from(buckets.values())
    .sort((a, b) => a.startDate - b.startDate)
    .map((bucket) => ({
      date: bucket.startDate,
      endDate: bucket.endDate,
      label: formatWeekLabel(bucket.startDate, bucket.endDate, false),
      tooltip: formatWeekLabel(bucket.startDate, bucket.endDate, true),
      ctl: bucket.ctl,
      tss: bucket.tss,
      distance: bucket.distance,
      activityCount: bucket.activityCount
    }));

  return {
    mode,
    points,
    hasTss: points.some((p) => Math.abs(p.tss) > 0.01),
    hasDistance: points.some((p) => Math.abs(p.distance) > 0.01)
  };
};

const hasTrainingLoadData = (daily) => {
  if (!Array.isArray(daily) || daily.length === 0) {
    return false;
  }

  return daily.some((day) => {
    const ctl = safeNumber(day.ctl);
    const atl = safeNumber(day.atl);
    const tsb = safeNumber(day.tsb);
    const tss = safeNumber(day.tss);
    const distance = safeNumber(day.distance);
    return Math.max(ctl, atl, Math.abs(tsb), tss, distance) > 0.01;
  });
};

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

const getUserDisplayName = (currentUser) => {
  const apiName = currentUser?.name?.trim();
  if (apiName) return apiName;

  const stored = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
  if (stored && stored.trim()) {
    return stored.trim();
  }

  if (currentUser?.username) {
    return currentUser.username;
  }

  const emailLocal = currentUser?.email?.split('@')[0];
  return emailLocal || 'Athlete';
};

const formatRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const normalizeBackendInsights = (insights = []) => (
  insights.map((insight, index) => {
    const severity = insight.severity || 'info';
    const typeMap = {
      high: 'danger',
      moderate: 'warning',
      warning: 'warning',
      positive: 'success',
      info: 'info'
    };
    const priorityMap = {
      high: 1,
      moderate: 2,
      warning: 2,
      positive: 3,
      info: 4
    };
    return {
      id: `backend-insight-${index}`,
      type: typeMap[severity] || 'info',
      title: insight.title || 'Insight',
      text: insight.message || '',
      priority: priorityMap[severity] || 4
    };
  })
);

const normalizeRecommendations = (recommendations = []) => (
  recommendations.map((rec, index) => ({
    id: `rec-${index}`,
    title: rec.title || 'Recommendation',
    text: rec.message || '',
    severity: rec.severity || 'info'
  }))
);

const buildSparkPath = (series, width, height) => {
  if (!Array.isArray(series) || series.length === 0) return '';
  const values = series.map((value) => (Number.isFinite(value) ? value : 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const step = series.length > 1 ? width / (series.length - 1) : width;

  return values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * height;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
};

const Sparkline = ({ series, stroke = '#2563eb', fill = 'rgba(37, 99, 235, 0.12)' }) => {
  const width = 84;
  const height = 28;
  const path = buildSparkPath(series, width, height);
  if (!path) return null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ov-stat-sparkline" aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" />
      <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill={fill} stroke="none" />
    </svg>
  );
};

const formatPresetLabel = (preset) => (
  preset.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
);

const OverviewApp = () => {
  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const hasSupplementalRef = useRef(false);

  const availableRanges = useMemo(() => (
    (CONFIG?.charts?.trainingLoad?.availableRanges || [30, 90, 180, 360])
      .slice()
      .sort((a, b) => a - b)
  ), []);

  const defaultTrainingRange = Number.parseInt(CONFIG?.charts?.trainingLoad?.defaultRange ?? 90, 10);
  const fallbackRange = availableRanges.includes(defaultTrainingRange)
    ? defaultTrainingRange
    : availableRanges[1] || availableRanges[0] || 90;

  const [trainingLoadRange, setTrainingLoadRange] = useState(
    Number.isFinite(defaultTrainingRange) ? defaultTrainingRange : fallbackRange
  );
  const [dashboardPrefs, setDashboardPrefs] = useState(() => (
    Services.preferences.getDashboardPreferences(WIDGET_ORDER)
  ));
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    trainingLoad: null,
    activities: [],
    settings: null,
    fitnessState: null,
    ftpPrediction: null,
    insights: [],
    recommendations: [],
    weeklySummary: null
  });

  const [activitiesAll, setActivitiesAll] = useState([]);
  const [activitiesByDate, setActivitiesByDate] = useState(new Map());
  const [trainingLoadDailyAll, setTrainingLoadDailyAll] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const activitiesLimit = CONFIG?.ui?.activitiesLimit || 8;
  const activitiesForChartLimit = 600;

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        Services.analytics.trackPageView('overview');
        const user = await AuthAPI.me().catch(() => ({ username: 'Athlete' }));
        if (!isActive) return;
        setCurrentUser(user);

        const maxRange = Math.max(...availableRanges, trainingLoadRange);
        const dateBounds = getDateBounds(maxRange);

        const [trainingLoadFull, activitiesFull, settings] = await Promise.all([
          Services.data.getTrainingLoad({ days: trainingLoadRange, forceRefresh: true }),
          Services.data.getActivities({
            limit: activitiesForChartLimit,
            skip: 0,
            startDate: dateBounds.start,
            endDate: dateBounds.end,
            forceRefresh: true
          }),
          Services.data.getSettings()
        ]);

        if (!isActive) return;
        const allActivities = Array.isArray(activitiesFull) ? activitiesFull : [];
        const sortedActivities = allActivities
          .slice()
          .sort((a, b) => new Date(b.start_time || 0) - new Date(a.start_time || 0));
        const activityMap = aggregateActivitiesByDate(sortedActivities);
        const mergedDaily = mergeTrainingLoadWithActivities(
          trainingLoadFull?.daily || [],
          activityMap
        );

        const trainingLoad = {
          ...trainingLoadFull,
          daily: getDailyForRange(mergedDaily, trainingLoadRange)
        };

        const activities = sortedActivities.slice(0, activitiesLimit);

        const tlInsights = Services.insight.generateTrainingLoadInsights(trainingLoad);
        const allInsights = Services.insight.sortByPriority([...tlInsights]);
        const insights = Services.insight.getTopInsights(
          allInsights,
          CONFIG?.ui?.insightsLimit || 6
        );

        setActivitiesAll(sortedActivities);
        setActivitiesByDate(activityMap);
        setTrainingLoadDailyAll(mergedDaily);
        setData({
          trainingLoad,
          activities,
          settings,
          fitnessState: null,
          ftpPrediction: null,
          insights,
          recommendations: [],
          weeklySummary: null
        });
      } catch (err) {
        if (!isActive) return;
        console.error('[OverviewPage] Load error:', err);
        Services.analytics.trackError('overview_load', err.message);
        setError(err);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [activitiesLimit, availableRanges]);

  useEffect(() => {
    if (loading || error || hasSupplementalRef.current) return;
    hasSupplementalRef.current = true;

    const loadSupplemental = async () => {
      try {
        const [fitnessState, ftpPrediction, insightBundle, weeklySummary] = await Promise.all([
          Services.data.getFitnessState().catch(() => null),
          Services.data.getFtpPrediction({ days: 90 }).catch(() => null),
          Services.data.getInsights({ days: 14 }).catch(() => ({ insights: [], recommendations: [] })),
          Services.data.getWeeklySummary({ days: 7 }).catch(() => null)
        ]);

        const tlInsights = Services.insight.generateTrainingLoadInsights(data.trainingLoad);
        const fsInsights = fitnessState
          ? Services.insight.generateFitnessStateInsights(fitnessState)
          : [];
        const backendInsights = normalizeBackendInsights(insightBundle?.insights || []);
        const allInsights = Services.insight.sortByPriority([...tlInsights, ...fsInsights, ...backendInsights]);
        const insights = Services.insight.getTopInsights(
          allInsights,
          CONFIG?.ui?.insightsLimit || 6
        );

        setData((prev) => ({
          ...prev,
          fitnessState,
          ftpPrediction,
          weeklySummary,
          insights,
          recommendations: normalizeRecommendations(insightBundle?.recommendations || [])
        }));
      } catch (supplementalError) {
        console.warn('[OverviewPage] Supplemental data failed:', supplementalError);
      }
    };

    loadSupplemental();
  }, [data.trainingLoad, error, loading]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.feather) {
      window.feather.replace();
    }
  }, [data, isCustomizeOpen, dashboardPrefs]);

  const chartSeries = useMemo(() => (
    buildTrainingChartSeries(trainingLoadDailyAll, trainingLoadRange)
  ), [trainingLoadDailyAll, trainingLoadRange]);

  const chartSummary = useMemo(() => {
    const points = chartSeries.points || [];
    if (!points.length) {
      return {
        avgCtl: 0,
        avgTss: 0,
        totalDistance: 0,
        totalSessions: 0
      };
    }

    const totals = points.reduce((acc, point) => {
      acc.ctl += safeNumber(point.ctl);
      acc.tss += safeNumber(point.tss);
      acc.distance += safeNumber(point.distance);
      acc.sessions += safeNumber(point.activityCount);
      return acc;
    }, { ctl: 0, tss: 0, distance: 0, sessions: 0 });

    return {
      avgCtl: totals.ctl / points.length,
      avgTss: totals.tss / points.length,
      totalDistance: totals.distance,
      totalSessions: totals.sessions
    };
  }, [chartSeries]);

  const weeklyStats = useMemo(() => {
    const recent = trainingLoadDailyAll.slice(-7);
    const recentTss = recent.reduce((sum, day) => sum + safeNumber(day.tss), 0);
    const recentDistance = recent.reduce((sum, day) => sum + safeNumber(day.distance), 0);
    const recentSessions = recent.reduce((sum, day) => sum + safeNumber(day.activityCount), 0);

    const last28 = trainingLoadDailyAll.slice(-28);
    const baseline = last28.length >= 7
      ? last28.reduce((sum, day) => sum + safeNumber(day.tss), 0) / (last28.length / 7)
      : 350;
    const target = Number.isFinite(baseline) && baseline > 0 ? baseline : 350;
    const percent = Math.min(130, Math.max(0, (recentTss / target) * 100));

    return {
      recentTss,
      recentDistance,
      recentSessions,
      target,
      percent
    };
  }, [trainingLoadDailyAll]);

  const sparkSeries = useMemo(() => {
    const recent = trainingLoadDailyAll.slice(-7);
    return {
      activities: recent.map((day) => safeNumber(day.activityCount)),
      distance: recent.map((day) => safeNumber(day.distance)),
      tss: recent.map((day) => safeNumber(day.tss)),
      duration: recent.map((day) => safeNumber(day.duration) / 3600)
    };
  }, [trainingLoadDailyAll]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!canvas || !Chart || !data.trainingLoad) return;

    if (!hasTrainingLoadData(chartSeries.points)) {
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

    const labels = chartSeries.points.map((point) => point.label);
    const datasets = [];

    if (chartSeries.hasTss) {
      datasets.push({
        label: 'TSS',
        data: chartSeries.points.map((point) => point.tss || 0),
        type: 'bar',
        backgroundColor: 'rgba(245, 158, 11, 0.6)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 2,
        yAxisID: 'y',
        order: 3
      });
    }

    if (chartSeries.hasDistance) {
      datasets.push({
        label: 'Distance (km)',
        data: chartSeries.points.map((point) => point.distance || 0),
        type: 'line',
        borderColor: 'rgba(139, 92, 246, 1)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        order: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    datasets.push({
      label: 'Fitness (CTL)',
      data: chartSeries.points.map((point) => point.ctl || 0),
      type: 'line',
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 3,
      fill: false,
      tension: 0.4,
      yAxisID: 'y',
      order: 1,
      pointRadius: 4,
      pointHoverRadius: 6
    });

    chartRef.current = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 12, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#111827',
            bodyColor: '#6b7280',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  if (context.dataset.label === 'Distance (km)') {
                    label += `${context.parsed.y.toFixed(1)} km`;
                  } else if (context.dataset.label === 'TSS') {
                    label += Math.round(context.parsed.y);
                  } else {
                    label += context.parsed.y.toFixed(1);
                  }
                }
                return label;
              },
              footer: (items) => {
                const index = items?.[0]?.dataIndex;
                const point = Number.isFinite(index) ? chartSeries.points[index] : null;
                if (!point) return '';
                const sessions = Number(point.activityCount) || 0;
                return sessions > 0 ? `Sessions: ${sessions}` : '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#6b7280' }
          },
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'TSS / CTL',
              font: { size: 12, weight: '600' },
              color: '#111827'
            },
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: { font: { size: 11 }, color: '#6b7280' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Distance (km)',
              font: { size: 12, weight: '600' },
              color: '#111827'
            },
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#6b7280' }
          }
        },
        onClick: () => {
          Services.analytics.trackChartInteraction('overview-training-load', 'click');
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartSeries, data.trainingLoad]);

  const handleRangeChange = useCallback(async (days) => {
    setTrainingLoadRange(days);
    try {
      const trainingLoadFull = await Services.data.getTrainingLoad({ days, forceRefresh: true });
      const mergedDaily = mergeTrainingLoadWithActivities(
        trainingLoadFull?.daily || [],
        activitiesByDate
      );
      setTrainingLoadDailyAll(mergedDaily);
      setData((prev) => ({
        ...prev,
        trainingLoad: {
          ...trainingLoadFull,
          daily: getDailyForRange(mergedDaily, days)
        },
        activities: activitiesAll.slice(0, activitiesLimit)
      }));
    } catch (reloadError) {
      console.error('[OverviewPage] Error reloading chart:', reloadError);
    }
  }, [activitiesAll, activitiesByDate, activitiesLimit]);

  const handleToggleCustomize = useCallback(() => {
    setIsCustomizeOpen((prev) => !prev);
  }, []);

  const handleToggleWidget = useCallback((widgetId, isEnabled) => {
    setDashboardPrefs((prev) => {
      const hidden = new Set(prev.hidden || []);
      if (isEnabled) {
        hidden.delete(widgetId);
      } else {
        hidden.add(widgetId);
      }
      const nextPrefs = {
        ...prev,
        hidden: Array.from(hidden)
      };
      Services.preferences.saveDashboardPreferences(nextPrefs);
      return nextPrefs;
    });
  }, []);

  const handlePresetChange = useCallback((preset) => {
    const nextPrefs = Services.preferences.applyDashboardPreset(preset, WIDGET_ORDER);
    setDashboardPrefs(nextPrefs);
    Services.preferences.saveDashboardPreferences(nextPrefs);
  }, []);

  const handleDragStart = useCallback((widgetId, event) => {
    setDraggingId(widgetId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', widgetId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback((widgetId, event) => {
    event.preventDefault();
    setDragOverId(widgetId);
  }, []);

  const handleDrop = useCallback((targetId, event) => {
    event.preventDefault();
    const fromId = draggingId || event.dataTransfer.getData('text/plain');
    if (!fromId || !targetId || fromId === targetId) return;

    setDashboardPrefs((prev) => {
      const order = Array.isArray(prev.order) ? [...prev.order] : [...WIDGET_ORDER];
      const fromIndex = order.indexOf(fromId);
      const toIndex = order.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, fromId);

      const nextPrefs = {
        ...prev,
        order,
        preset: 'custom'
      };
      Services.preferences.saveDashboardPreferences(nextPrefs);
      return nextPrefs;
    });

    setDragOverId(null);
    setDraggingId(null);
  }, [draggingId]);

  const timeOfDay = useMemo(() => getTimeOfDay(), []);
  const userName = useMemo(() => getUserDisplayName(currentUser), [currentUser]);

  const widgetRegistry = useMemo(() => ({
    hero: {
      id: 'hero',
      label: 'Welcome Hero',
      element: (
        <div className="ov-hero-stack">
          <div className="ov-welcome-hero">
            <div className="ov-welcome-content">
              <h1 className="ov-welcome-title">
                {timeOfDay === 'morning'
                  ? `Good morning, ${userName}!`
                  : timeOfDay === 'afternoon'
                    ? `Good afternoon, ${userName}!`
                    : `Good evening, ${userName}!`}
              </h1>
              <p className="ov-welcome-subtitle">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}{' '}
                - Here's your training overview
              </p>
              <div className="ov-hero-underline">
                <span></span>
              </div>
            </div>
            <div className="ov-welcome-graphic">
              <svg viewBox="0 0 200 200" className="ov-hero-logo" aria-hidden="true">
                <defs>
                  <linearGradient id="ovHeroRimGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{ stopColor: '#5b8cff', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#7c5cff', stopOpacity: 1 }} />
                  </linearGradient>
                  <linearGradient id="ovHeroHubGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#5b8cff', stopOpacity: 1 }} />
                    <stop offset="60%" style={{ stopColor: '#7c5cff', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#f08fdc', stopOpacity: 1 }} />
                  </linearGradient>
                  <filter id="ovHeroGlow">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <path id="ovHeroWordTop" d="M 30 100 A 70 70 0 0 0 170 100" />
                  <path id="ovHeroWordBottom" d="M 170 100 A 70 70 0 0 0 30 100" />
                </defs>

                <g className="ov-hero-rim" style={{ transformOrigin: '100px 100px' }}>
                  <circle cx="100" cy="100" r="70" fill="none" stroke="url(#ovHeroRimGradient)" strokeWidth="20" opacity="0.95" />
                  <text className="ov-hero-wordmark">
                    <textPath href="#ovHeroWordTop" startOffset="50%" textAnchor="middle">
                      SpinningLab
                    </textPath>
                  </text>
                  <text className="ov-hero-wordmark">
                    <textPath href="#ovHeroWordBottom" startOffset="50%" textAnchor="middle">
                      SpinningLab
                    </textPath>
                  </text>
                </g>

                <g className="ov-hero-chain" style={{ transformOrigin: '100px 100px' }}>
                  <circle cx="100" cy="100" r="30" fill="none" stroke="url(#ovHeroHubGradient)" strokeWidth="5" opacity="0.9" />
                  <circle cx="100" cy="100" r="34" fill="none" stroke="url(#ovHeroHubGradient)" strokeWidth="4.5" strokeDasharray="4 9" strokeLinecap="round" opacity="0.9" />
                  <circle cx="100" cy="100" r="18" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
                  <circle cx="100" cy="100" r="12" fill="url(#ovHeroHubGradient)" filter="url(#ovHeroGlow)" />
                  <circle cx="100" cy="100" r="7.5" fill="none" stroke="white" strokeWidth="2" opacity="0.65" />
                  <circle cx="100" cy="100" r="3.5" fill="white" opacity="0.45" />
                </g>
              </svg>
              <style>
                {`
                  @keyframes ov-hero-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  .ov-hero-rim {
                    animation: ov-hero-spin 10s linear infinite;
                    animation-direction: reverse;
                  }
                  .ov-hero-chain {
                    animation: ov-hero-spin 20s linear infinite;
                    animation-direction: reverse;
                  }
                  .ov-hero-wordmark {
                    fill: #ffffff;
                    font-size: 12px;
                    font-weight: 600;
                    letter-spacing: 0.35em;
                    text-transform: uppercase;
                    dominant-baseline: middle;
                  }
                `}
              </style>
            </div>
          </div>
          <div className="ov-signal-row">
            {(() => {
              const tsb = data.trainingLoad?.current?.tsb || 0;
              const readiness = tsb > 5
                ? { label: 'Fresh', className: 'fresh', detail: 'Ideal for intensity' }
                : tsb > -5
                  ? { label: 'Balanced', className: 'balanced', detail: 'Build with confidence' }
                  : { label: 'Fatigued', className: 'fatigued', detail: 'Focus on recovery' };

              const latestActivity = activitiesAll?.[0] || data.activities?.[0] || null;
              const latestName = latestActivity?.custom_name
                || latestActivity?.file_name
                || latestActivity?.type
                || 'No recent ride';
              const latestDate = latestActivity?.start_time
                ? formatRelativeDate(latestActivity.start_time)
                : 'Sync to update';

              return (
                <>
                  <div className="ov-signal-card">
                    <div className="ov-signal-label">Readiness</div>
                    <div className={`ov-signal-value ov-signal-value--${readiness.className}`}>{readiness.label}</div>
                    <div className="ov-signal-meta">{readiness.detail}</div>
                  </div>
                  <div className="ov-signal-card">
                    <div className="ov-signal-label">Last Activity</div>
                    <div className="ov-signal-value">{latestName}</div>
                    <div className="ov-signal-meta">{latestDate}</div>
                  </div>
                  <div className="ov-signal-card">
                    <div className="ov-signal-label">Weekly Load</div>
                    <div className="ov-signal-value">{Math.round(weeklyStats.recentTss)} TSS</div>
                    <div className="ov-signal-progress">
                      <div className="ov-signal-progress__bar" style={{ width: `${weeklyStats.percent}%` }}></div>
                    </div>
                    <div className="ov-signal-meta">
                      Target {Math.round(weeklyStats.target)} TSS - {Math.round(weeklyStats.recentDistance)} km
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )
    },
    'quick-stats': {
      id: 'quick-stats',
      label: 'Quick Stats',
      element: (() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const recentActivities = (activitiesAll || []).filter((activity) => {
          if (!activity.start_time) return false;
          const activityDate = new Date(activity.start_time);
          return activityDate >= sevenDaysAgo;
        });

        const totalDistance = recentActivities.reduce((sum, activity) => {
          const distanceRaw = activity.distance
            ?? activity.total_distance
            ?? activity.totalDistance
            ?? activity.distance_km;
          return sum + normalizeDistanceKm(distanceRaw);
        }, 0);
        const totalTSS = recentActivities.reduce((sum, activity) => sum + (Number(activity.tss) || 0), 0);
        const totalDuration = recentActivities.reduce((sum, activity) => sum + (Number(activity.duration) || 0), 0);

        return (
          <div className="ov-quick-stats">
            <div className="ov-stat-card" data-color="blue">
              <div className="ov-stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ov-stat-content">
                <div className="ov-stat-label">Last 7 Days</div>
                <div className="ov-stat-value">{recentActivities.length}</div>
                <div className="ov-stat-subtitle">Activities</div>
              </div>
              <Sparkline series={sparkSeries.activities} stroke="#2563eb" fill="rgba(37, 99, 235, 0.18)" />
            </div>

            <div className="ov-stat-card" data-color="purple">
              <div className="ov-stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div className="ov-stat-content">
                <div className="ov-stat-label">Total Distance</div>
                <div className="ov-stat-value">{totalDistance.toFixed(0)}</div>
                <div className="ov-stat-subtitle">Kilometers</div>
              </div>
              <Sparkline series={sparkSeries.distance} stroke="#8b5cf6" fill="rgba(139, 92, 246, 0.18)" />
            </div>

            <div className="ov-stat-card" data-color="orange">
              <div className="ov-stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ov-stat-content">
                <div className="ov-stat-label">Training Stress</div>
                <div className="ov-stat-value">{totalTSS.toFixed(0)}</div>
                <div className="ov-stat-subtitle">TSS Points</div>
              </div>
              <Sparkline series={sparkSeries.tss} stroke="#f59e0b" fill="rgba(245, 158, 11, 0.22)" />
            </div>

            <div className="ov-stat-card" data-color="green">
              <div className="ov-stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ov-stat-content">
                <div className="ov-stat-label">Training Time</div>
                <div className="ov-stat-value">{(totalDuration / 3600).toFixed(1)}</div>
                <div className="ov-stat-subtitle">Hours</div>
              </div>
              <Sparkline series={sparkSeries.duration} stroke="#10b981" fill="rgba(16, 185, 129, 0.2)" />
            </div>
          </div>
        );
      })()
    },
    'main-content': {
      id: 'main-content',
      label: 'Performance Snapshot',
      element: (() => {
        const ctl = data.trainingLoad?.current?.ctl || 0;
        const atl = data.trainingLoad?.current?.atl || 0;
        const tsb = data.trainingLoad?.current?.tsb || 0;
        const prediction = data.ftpPrediction;
        const confidence = prediction ? Math.round(Number(prediction.confidence || 0) * 100) : 0;
        const modelLabel = prediction?.model_version === 'ml-v1' ? 'ML Model' : 'Heuristic';
        const predictionTime = prediction?.prediction_time ? formatRelativeDate(prediction.prediction_time) : '';
        const predicted = prediction ? Number(prediction.predicted_ftp || 0) : 0;
        const current = prediction ? Number(prediction.current_ftp || 0) : 0;
        const delta = prediction ? Number(prediction.delta || 0) : 0;
        const deltaClass = delta >= 0 ? 'positive' : 'negative';

        return (
          <div className="ov-main-content">
            <div className="ov-left-panel">
              <div className="ov-metrics-panel">
                <h3 className="ov-panel-title">Current Load</h3>

                <div className="ov-metric-large">
                  <div className="ov-metric-large-label">Fitness (CTL)</div>
                  <div className="ov-metric-large-value" style={{ color: '#3b82f6' }}>
                    {ctl.toFixed(1)}
                  </div>
                  <div className="ov-metric-large-bar">
                    <div className="ov-metric-large-fill" style={{ width: `${Math.min(100, (ctl / 100) * 100)}%`, background: '#3b82f6' }} />
                  </div>
                </div>

                <div className="ov-metric-large">
                  <div className="ov-metric-large-label">Fatigue (ATL)</div>
                  <div className="ov-metric-large-value" style={{ color: '#f59e0b' }}>
                    {atl.toFixed(1)}
                  </div>
                  <div className="ov-metric-large-bar">
                    <div className="ov-metric-large-fill" style={{ width: `${Math.min(100, (atl / 100) * 100)}%`, background: '#f59e0b' }} />
                  </div>
                </div>

                <div className="ov-metric-large">
                  <div className="ov-metric-large-label">Form (TSB)</div>
                  <div className="ov-metric-large-value" style={{ color: tsb >= 0 ? '#10b981' : '#ef4444' }}>
                    {tsb > 0 ? '+' : ''}{tsb.toFixed(1)}
                  </div>
                  <div className="ov-metric-large-bar">
                    <div className="ov-metric-large-fill" style={{ width: `${Math.abs(tsb) * 2}%`, background: tsb >= 0 ? '#10b981' : '#ef4444' }} />
                  </div>
                </div>

                <div className="ov-form-status">
                  <div className={`ov-form-badge ${tsb > 5 ? 'fresh' : tsb > -5 ? 'balanced' : 'fatigued'}`}>
                    {tsb > 5 ? 'Fresh' : tsb > -5 ? 'Balanced' : 'Fatigued'}
                  </div>
                  <p className="ov-form-text">
                    {tsb > 5
                      ? 'Great time for high-intensity work'
                      : tsb > -5
                        ? 'Balanced training and recovery'
                        : 'Consider adding recovery'}
                  </p>
                </div>

                <div className={`ov-ftp-forecast ${prediction ? '' : 'ov-ftp-forecast--empty'}`}>
                  {prediction ? (
                    <>
                      <div className="ov-ftp-header">
                        <div>
                          <h4>FTP Forecast</h4>
                          <span className="ov-ftp-subtitle">
                            {modelLabel}{predictionTime ? ` - ${predictionTime}` : ''}
                          </span>
                        </div>
                        <span className="ov-ftp-confidence">{confidence}%</span>
                      </div>
                      <div className="ov-ftp-values">
                        <div className="ov-ftp-main">
                          <div className="ov-ftp-value">{predicted ? `${Math.round(predicted)}W` : '-'}</div>
                          <div className="ov-ftp-label">Predicted FTP</div>
                        </div>
                        <div className="ov-ftp-meta">
                          <span className="ov-ftp-current">Current: {current ? `${Math.round(current)}W` : '-'}</span>
                          <span className={`ov-ftp-delta ${deltaClass}`}>
                            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}W
                          </span>
                        </div>
                      </div>
                      <div className="ov-ftp-bar">
                        <div className="ov-ftp-bar-fill" style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }} />
                      </div>
                      {prediction.notification ? (
                        <div className="ov-ftp-note">{prediction.notification}</div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <h4>FTP Forecast</h4>
                      <p>Upload power data to unlock predictions.</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="ov-right-panel">
              <div className="ov-chart-widget">
                <div className="ov-chart-header">
                  <div>
                    <h3 className="ov-chart-title">Training Load Trend</h3>
                    <p className="ov-chart-subtitle">CTL, ATL, and TSB progression</p>
                  </div>
                  <div className="ov-chart-controls">
                    {availableRanges.map((days) => (
                      <button
                        key={days}
                        className={`ov-chart-btn ${trainingLoadRange === days ? 'active' : ''}`}
                        data-range={days}
                        type="button"
                        onClick={() => handleRangeChange(days)}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ov-chart-canvas">
                  {hasTrainingLoadData(chartSeries.points) ? (
                    <canvas ref={canvasRef} id="trainingLoadChart" />
                  ) : (
                    <div className="chart-empty-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h4>No Training Load Data</h4>
                      <p>We could not find any recent TSS data. Upload new workouts to see your load progression.</p>
                    </div>
                  )}
                </div>
                <div className="ov-chart-footer">
                  <div className="ov-chart-foot-card">
                    <span className="ov-chart-foot-label">Avg CTL</span>
                    <span className="ov-chart-foot-value">{chartSummary.avgCtl.toFixed(1)}</span>
                  </div>
                  <div className="ov-chart-foot-card">
                    <span className="ov-chart-foot-label">Avg TSS</span>
                    <span className="ov-chart-foot-value">{chartSummary.avgTss.toFixed(0)}</span>
                  </div>
                  <div className="ov-chart-foot-card">
                    <span className="ov-chart-foot-label">Total Distance</span>
                    <span className="ov-chart-foot-value">{chartSummary.totalDistance.toFixed(0)} km</span>
                  </div>
                  <div className="ov-chart-foot-card">
                    <span className="ov-chart-foot-label">Sessions</span>
                    <span className="ov-chart-foot-value">{Math.round(chartSummary.totalSessions)}</span>
                  </div>
                </div>
                <div className="ov-chart-notes">
                  <div className="ov-chart-note">
                    <strong>How to read</strong>
                    <p>CTL is your long-term fitness trend, TSS shows daily training stress, and distance adds volume context.</p>
                  </div>
                  <div className="ov-chart-note">
                    <strong>Quick tip</strong>
                    <p>Rising CTL with stable TSS usually means steady progression. Large spikes can signal fatigue.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()
    },
    'coach-summary': {
      id: 'coach-summary',
      label: 'Coach Summary',
      element: (() => {
        const summary = data.weeklySummary;
        const hasSummary = summary && Number.isFinite(summary.sessions);
        const recs = Array.isArray(data.recommendations) ? data.recommendations : [];

        return (
          <div className="ov-coach-card">
            <div className="ov-coach-header">
              <div>
                <h3 className="ov-section-title">Coach Summary</h3>
                <p>Weekly snapshot and training recommendations.</p>
              </div>
            </div>

            {hasSummary ? (
              <div className="ov-coach-stats">
                <div className="ov-coach-stat">
                  <span>Sessions</span>
                  <strong>{summary.sessions}</strong>
                </div>
                <div className="ov-coach-stat">
                  <span>Duration</span>
                  <strong>{summary.duration_hours.toFixed(1)}h</strong>
                </div>
                <div className="ov-coach-stat">
                  <span>Distance</span>
                  <strong>{summary.distance_km.toFixed(0)}km</strong>
                </div>
                <div className="ov-coach-stat">
                  <span>Total TSS</span>
                  <strong>{summary.total_tss.toFixed(0)}</strong>
                </div>
              </div>
            ) : (
              <div className="ov-coach-empty">
                No weekly summary available yet. Sync activities to unlock it.
              </div>
            )}

            {recs.length ? (
              <div
                className="ov-coach-recommendations"
                dangerouslySetInnerHTML={{
                  __html: RecommendationList({
                    title: 'Recommendations',
                    recommendations: recs
                  })
                }}
              />
            ) : (
              <div className="ov-coach-empty">No coaching recommendations at the moment.</div>
            )}
          </div>
        );
      })()
    },
    'recent-activities': {
      id: 'recent-activities',
      label: 'Recent Activities',
      element: data.activities && data.activities.length ? (
        <div className="ov-activities-section">
          <h3 className="ov-section-title">Recent Activities</h3>
          <div className="ov-activities-grid">
            {data.activities.slice(0, 6).map((activity) => {
              const distanceRaw = activity.distance
                ?? activity.total_distance
                ?? activity.totalDistance
                ?? activity.distance_km;
              const distanceKmValue = normalizeDistanceKm(distanceRaw);
              const distanceKm = distanceKmValue > 0 ? distanceKmValue.toFixed(1) : '0.0';
              const tss = Math.round(Number(activity.tss) || 0);
              const avgPower = Math.round(Number(activity.avg_power) || 0);
              const normalizedPower = Math.round(Number(activity.normalized_power) || 0);
              const intensityFactor = Number(activity.intensity_factor) || 0;
              const ifDisplay = intensityFactor > 0 ? intensityFactor.toFixed(2) : '-';
              const activityId = activity.id ?? activity.activity_id ?? activity.activityId ?? activity._id ?? null;
              const route = activityId ? `activity/${activityId}` : 'activities';
              const displayName = activity.custom_name || activity.file_name || activity.type || 'Ride';

              return (
                <div
                  key={activityId || `${displayName}-${activity.start_time}`}
                  className="ov-activity-card"
                  data-activity-id={activityId || ''}
                  onClick={() => {
                    if (window.router) {
                      window.router.navigateTo(route);
                    } else {
                      window.location.hash = `#/${route}`;
                    }
                  }}
                >
                  <div className="ov-activity-header">
                    <div className="ov-activity-type">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      {displayName}
                    </div>
                    <div className="ov-activity-date">{formatRelativeDate(activity.start_time)}</div>
                  </div>
                  <div className="ov-activity-primary-stats">
                    <div className="ov-activity-stat">
                      <span className="ov-activity-stat-value">{distanceKm}</span>
                      <span className="ov-activity-stat-unit">km</span>
                    </div>
                    <div className="ov-activity-stat">
                      <span className="ov-activity-stat-value">{tss}</span>
                      <span className="ov-activity-stat-unit">TSS</span>
                    </div>
                    <div className="ov-activity-stat">
                      <span className="ov-activity-stat-value">{avgPower}</span>
                      <span className="ov-activity-stat-unit">W avg</span>
                    </div>
                  </div>
                  <div className="ov-activity-secondary-stats">
                    <div className="ov-activity-badge">
                      <span className="ov-activity-badge-label">NP:</span>
                      <span className="ov-activity-badge-value">{normalizedPower}W</span>
                    </div>
                    <div className="ov-activity-badge">
                      <span className="ov-activity-badge-label">IF:</span>
                      <span className="ov-activity-badge-value">{ifDisplay}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null
    },
    insights: {
      id: 'insights',
      label: 'Insights',
      element: data.insights && data.insights.length ? (
        <div className="ov-insights-section">
          <h3 className="ov-section-title">AI Insights</h3>
          <div
            className="ov-insights-grid"
            dangerouslySetInnerHTML={{
              __html: data.insights.map((insight) => InsightCard(insight)).join('')
            }}
          />
        </div>
      ) : (
        <div className="ov-insights-empty">
          <h3>No insights yet</h3>
          <p>Complete a few rides to unlock personalized guidance.</p>
        </div>
      )
    }
  }), [activitiesAll, availableRanges, chartSeries, chartSummary, data, handleRangeChange, sparkSeries, timeOfDay, trainingLoadRange, userName, weeklyStats]);

  const orderedWidgets = useMemo(() => {
    const hidden = new Set(dashboardPrefs.hidden || []);
    const order = Array.isArray(dashboardPrefs.order) && dashboardPrefs.order.length
      ? dashboardPrefs.order
      : WIDGET_ORDER;

    return order
      .map((id) => widgetRegistry[id])
      .filter(Boolean)
      .filter((widget) => !hidden.has(widget.id));
  }, [dashboardPrefs, widgetRegistry]);

  const presetButtons = useMemo(() => {
    const presets = Services.preferences.getDashboardPresets();
    return Object.keys(presets).map((preset) => ({
      key: preset,
      label: formatPresetLabel(preset),
      active: dashboardPrefs.preset === preset
    }));
  }, [dashboardPrefs.preset]);

  if (loading) {
    return (
      <div className="ov-section">
        <div
          className="metrics-grid"
          dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'metric', count: 4 }) }}
        />
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
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>Failed to Load Overview</h3>
        <p style={{ marginBottom: 16 }}>{error.message}</p>
        <button
          className="btn btn--primary"
          type="button"
          onClick={() => window.router?.refresh()}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className={`ov-dashboard ${isCustomizeOpen ? 'ov-dashboard--customizing' : ''}`}>
      {orderedWidgets.map((widget) => (
        <section
          key={widget.id}
          className={`ov-widget ${draggingId === widget.id ? 'ov-widget--dragging' : ''} ${dragOverId === widget.id ? 'ov-widget--drag-over' : ''}`}
          data-widget-id={widget.id}
          onDragOver={(event) => handleDragOver(widget.id, event)}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(event) => handleDrop(widget.id, event)}
        >
          <button
            className="ov-widget__handle"
            draggable
            type="button"
            title="Drag to reorder"
            onDragStart={(event) => handleDragStart(widget.id, event)}
            onDragEnd={handleDragEnd}
          >
            <span></span><span></span><span></span>
          </button>
          {widget.element}
        </section>
      ))}

      <section className={`ov-customize ${isCustomizeOpen ? 'ov-customize--open' : ''}`}>
        <div className="ov-customize__header">
          <div>
            <h3>Dashboard Layout</h3>
            <p>Drag cards to reorder or hide sections.</p>
          </div>
          <button className="btn btn--secondary btn--sm" type="button" onClick={handleToggleCustomize}>
            {isCustomizeOpen ? 'Close' : 'Customize'}
          </button>
        </div>
        <div className="ov-customize__body">
          <div className="ov-customize__presets">
            {presetButtons.map((preset) => (
              <button
                key={preset.key}
                className={`btn btn--sm ${preset.active ? 'btn--primary' : 'btn--secondary'}`}
                type="button"
                onClick={() => handlePresetChange(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="ov-customize__toggles">
            {Object.values(widgetRegistry).map((widget) => {
              const isHidden = dashboardPrefs.hidden?.includes(widget.id);
              return (
                <label key={widget.id} className="ov-customize-toggle">
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    onChange={(event) => handleToggleWidget(widget.id, event.target.checked)}
                  />
                  <span>{widget.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default OverviewApp;
