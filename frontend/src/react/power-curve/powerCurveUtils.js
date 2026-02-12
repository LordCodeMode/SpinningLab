export const QUICK_RANGES = [
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: '180', label: '180d' },
  { key: '365', label: '1 Year' },
  { key: 'all', label: 'All' }
];

export const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 89);
  return { start, end };
};

export const formatDateForApi = (date) => {
  if (!date) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const formatDurationDetailed = (seconds) => {
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

export const formatDurationCompact = (seconds) => {
  if (!Number.isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
};

export const formatDateShort = (isoString) => {
  if (!isoString) return '--';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(decimals);
};

export const formatActivityTitle = (activity) => {
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

export const getActivitySource = (activity) => {
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

export const POWER_CURVE_TICKS = [
  1, 5, 10, 15, 30,
  60, 120, 300, 600, 1200, 1800,
  3600, 5400, 7200, 10800, 14400, 21600, 28800, 36000, 43200
];

export const POWER_CURVE_TICK_LABELS = {
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

export const preparePowerCurvePoints = (data) => {
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

export const buildDatasetFromPoints = (points, weightedFlag = false) => {
  if (!Array.isArray(points) || points.length === 0) {
    return { durations: [], powers: [], weighted: Boolean(weightedFlag) };
  }

  return {
    durations: points.map((point) => point.duration),
    powers: points.map((point) => point.power),
    weighted: Boolean(weightedFlag)
  };
};

export const computeBestWindow = (streams, durationSeconds) => {
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

export const computeNormalizedPowerWindow = (streams, windowStart, windowEnd) => {
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
  const meanFourth = rolling.reduce((sum, val) => sum + (val ** 4), 0) / rolling.length;
  return meanFourth > 0 ? (meanFourth ** 0.25) : null;
};

export const buildTimelineChartData = (streams) => {
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

export const findPowerAt = (targetDuration, payload) => {
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
};
