import polyline from '@mapbox/polyline';

export const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const normalizeDistanceKm = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num > 1000 ? num / 1000 : num;
};

export const decodeRoutePolyline = (polylineString) => {
  if (!polylineString) return [];
  try {
    return polyline.decode(polylineString).map(([lat, lng]) => [lng, lat]);
  } catch (err) {
    return [];
  }
};

export const buildRoutePreviewPath = (polylineString, width = 120, height = 48, padding = 6) => {
  const points = decodeRoutePolyline(polylineString);
  if (points.length < 2) return null;

  let minX = points[0][0];
  let maxX = points[0][0];
  let minY = points[0][1];
  let maxY = points[0][1];

  points.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (!Number.isFinite(spanX) || !Number.isFinite(spanY)) return null;

  const safeSpanX = spanX || 1;
  const safeSpanY = spanY || 1;
  const scaleX = (width - padding * 2) / safeSpanX;
  const scaleY = (height - padding * 2) / safeSpanY;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = padding + (width - padding * 2 - spanX * scale) / 2;
  const offsetY = padding + (height - padding * 2 - spanY * scale) / 2;

  return points
    .map(([x, y], index) => {
      const scaledX = offsetX + (x - minX) * scale;
      const scaledY = offsetY + (maxY - y) * scale;
      const command = index === 0 ? 'M' : 'L';
      return `${command}${scaledX.toFixed(1)} ${scaledY.toFixed(1)}`;
    })
    .join(' ');
};

export const toISODate = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) return null;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDateBounds = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Math.max(0, days - 1));
  return {
    start: toISODate(start),
    end: `${toISODate(end)}T23:59:59`
  };
};

export const formatRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const buildSparkPath = (series, width, height) => {
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

export const formatDateShort = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatDateLong = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const hasTrainingLoadData = (daily) => {
  if (!Array.isArray(daily) || daily.length === 0) return false;
  return daily.some((day) => {
    const ctl = safeNumber(day.ctl);
    const atl = safeNumber(day.atl);
    const tsb = safeNumber(day.tsb);
    const tss = safeNumber(day.tss);
    const distance = safeNumber(day.distance);
    return Math.max(ctl, atl, Math.abs(tsb), tss, distance) > 0.01;
  });
};

export const aggregateActivitiesByDate = (activities = []) => {
  const map = new Map();
  activities.forEach((activity) => {
    if (!activity?.start_time) return;
    const dateKey = toISODate(activity.start_time);
    if (!dateKey) return;
    if (!map.has(dateKey)) {
      map.set(dateKey, { distance: 0, tss: 0, duration: 0, count: 0 });
    }
    const bucket = map.get(dateKey);
    const distanceRaw = activity.distance ?? activity.total_distance ?? activity.totalDistance ?? activity.distance_km;
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

export const mergeTrainingLoadWithActivities = (daily = [], activitiesByDate = new Map()) => (
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

export const getDailyForRange = (dailyAll, range) => {
  if (!Array.isArray(dailyAll) || dailyAll.length === 0) return [];
  const sliceCount = Math.max(1, Math.min(range, dailyAll.length));
  return dailyAll.slice(-sliceCount);
};

export const downsampleDailySeries = (series, range) => {
  if (!Array.isArray(series) || series.length <= 1) return series || [];
  const maxPoints = range <= 30 ? 30 : range <= 90 ? 45 : 60;
  if (series.length <= maxPoints) return series;
  const step = Math.ceil(series.length / maxPoints);
  const downsampled = [];
  for (let i = 0; i < series.length; i += step) downsampled.push(series[i]);
  if (downsampled[downsampled.length - 1] !== series[series.length - 1]) downsampled.push(series[series.length - 1]);
  return downsampled;
};

export const startOfWeek = (date) => {
  const result = new Date(date.getTime());
  const day = result.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const formatWeekLabel = (start, end, includeYear = false) => {
  const options = includeYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
};

export const buildTrainingChartSeries = (dailyAll, range) => {
  const daily = getDailyForRange(dailyAll, range)
    .filter((item) => item.date instanceof Date && !Number.isNaN(item.date.getTime()))
    .map((item) => ({ ...item, date: new Date(item.date.getTime()) }));
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
    return { mode, points, hasTss: points.some((p) => Math.abs(p.tss) > 0.01), hasDistance: points.some((p) => Math.abs(p.distance) > 0.01) };
  }
  const buckets = new Map();
  daily.forEach((entry) => {
    const start = startOfWeek(entry.date);
    const key = start.toISOString();
    if (!buckets.has(key)) {
      buckets.set(key, { startDate: start, endDate: entry.date, ctl: entry.ctl, tss: entry.tss, distance: entry.distance, activityCount: entry.activityCount, duration: entry.duration });
    } else {
      const bucket = buckets.get(key);
      bucket.tss += entry.tss;
      bucket.distance += entry.distance;
      bucket.activityCount += entry.activityCount;
      bucket.duration += entry.duration;
      if (entry.date > bucket.endDate) { bucket.endDate = entry.date; bucket.ctl = entry.ctl; }
    }
  });
  const points = Array.from(buckets.values()).sort((a, b) => a.startDate - b.startDate).map((bucket) => ({
    date: bucket.startDate,
    endDate: bucket.endDate,
    label: formatWeekLabel(bucket.startDate, bucket.endDate, false),
    tooltip: formatWeekLabel(bucket.startDate, bucket.endDate, true),
    ctl: bucket.ctl,
    tss: bucket.tss,
    distance: bucket.distance,
    activityCount: bucket.activityCount
  }));
  return { mode, points, hasTss: points.some((p) => Math.abs(p.tss) > 0.01), hasDistance: points.some((p) => Math.abs(p.distance) > 0.01) };
};

export const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
};

export const getUserDisplayName = (currentUser, DISPLAY_NAME_STORAGE_KEY) => {
  const apiName = currentUser?.name?.trim();
  if (apiName) return apiName;
  const stored = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
  if (stored && stored.trim()) return stored.trim();
  if (currentUser?.username) return currentUser.username;
  return currentUser?.email?.split('@')[0] || 'Athlete';
};

export const normalizeBackendInsights = (insights = []) => (
  insights.map((insight, index) => {
    const severity = insight.severity || 'info';
    const typeMap = { high: 'danger', moderate: 'warning', warning: 'warning', positive: 'success', info: 'info' };
    const priorityMap = { high: 1, moderate: 2, warning: 2, positive: 3, info: 4 };
    return {
      id: `backend-insight-${index}`,
      type: typeMap[severity] || 'info',
      title: insight.title || 'Insight',
      description: insight.description || insight.message || '',
      icon: insight.icon || 'info',
      priority: priorityMap[severity] || 4
    };
  })
);
