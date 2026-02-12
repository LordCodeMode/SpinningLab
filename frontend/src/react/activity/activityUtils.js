import polyline from '@mapbox/polyline';
import CONFIG from '../../lib/pages/activity/config.js';
import AppConfig from '../../lib/core/config.js';

export const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDuration = (seconds) => {
  if (!seconds) return '-';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

export const formatDurationShort = (seconds) => {
  if (seconds == null) return '';
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  if (total < 3600) {
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return secs === 0 ? `${minutes}m` : `${minutes}m ${secs}s`;
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
};

export const POWER_CURVE_TICK_VALUES = [
  1, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200, 10800, 14400, 18000
];

export const formatTimelineTick = (seconds) => {
  if (seconds == null || Number.isNaN(seconds)) return '';
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
  return `${secs}s`;
};

export const getTimelineHoverIndex = (chart, event) => {
  if (!chart || !event) return null;
  const elements = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, true);
  return elements && elements.length ? elements[0].index : null;
};

export const clearLinkedTimelineHover = (chart) => {
  if (!chart) return;
  chart.setActiveElements([]);
  if (chart.tooltip) {
    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
  }
  chart.update('none');
};

export const syncLinkedTimelineHover = (chart, index) => {
  if (!chart || index == null) return;
  const meta = chart.getDatasetMeta(0);
  const element = meta?.data?.[index];
  if (!element) return;
  const position = element.getProps(['x', 'y'], true);
  chart.setActiveElements([{ datasetIndex: 0, index }]);
  if (chart.tooltip) {
    chart.tooltip.setActiveElements([{ datasetIndex: 0, index }], position);
  }
  chart.update('none');
};

export const parseTagsInput = (value) => (value || '')
  .split(',')
  .map((tag) => tag.trim().replace(/^#/, ''))
  .filter(Boolean);

export const getZoneColor = (label, palette) => {
  if (!label) return CONFIG.COLORS.gray;
  const trimmed = label.trim();
  const shorthand = trimmed.split(' ')[0];
  return palette[trimmed] || palette[shorthand] || CONFIG.COLORS.gray;
};

export const getOrCreateZoneTooltip = (chart) => {
  const parent = chart?.canvas?.parentNode;
  if (!parent) return null;
  let tooltipEl = parent.querySelector('.activity-chart-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'activity-chart-tooltip';
    tooltipEl.innerHTML = '<span class="activity-chart-tooltip__label"></span>';
    parent.appendChild(tooltipEl);
  }
  return tooltipEl;
};

export const renderZoneTooltip = (context) => {
  const { chart, tooltip } = context;
  const tooltipEl = getOrCreateZoneTooltip(chart);
  if (!tooltipEl) return;

  if (!tooltip || tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  const dataPoint = tooltip.dataPoints?.[0];
  if (!dataPoint) {
    tooltipEl.style.opacity = 0;
    return;
  }

  const label = dataPoint.label || '';
  const minutes = Number(dataPoint.parsed);
  const duration = formatDurationShort(Number.isFinite(minutes) ? minutes * 60 : 0);
  const labelEl = tooltipEl.querySelector('.activity-chart-tooltip__label');
  if (labelEl) {
    labelEl.textContent = `${label}: ${duration}`;
  }

  const meta = chart.getDatasetMeta(0);
  const arc = meta?.data?.[dataPoint.dataIndex];
  const angle = arc ? (arc.startAngle + arc.endAngle) / 2 : 0;
  const radius = arc?.outerRadius ?? 0;
  const centerX = arc?.x ?? (chart.chartArea.left + chart.chartArea.right) / 2;
  const centerY = arc?.y ?? (chart.chartArea.top + chart.chartArea.bottom) / 2;
  const offset = radius + 18;
  const posX = centerX + Math.cos(angle) * offset;
  const posY = centerY + Math.sin(angle) * offset;

  const parentRect = chart.canvas.parentNode.getBoundingClientRect();
  const canvasRect = chart.canvas.getBoundingClientRect();
  const left = posX + (canvasRect.left - parentRect.left);
  const top = posY + (canvasRect.top - parentRect.top);

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.opacity = 1;
};

export const normalizeNumericArray = (values, { clampMin = null } = {}) => {
  if (!Array.isArray(values)) return null;
  return values.map((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    if (clampMin !== null && numeric < clampMin) return clampMin;
    return numeric;
  });
};

export const normalizeLatLngStream = (values) => {
  if (!Array.isArray(values)) return null;
  return values.map((pair) => {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const lat = Number(pair[0]);
    const lng = Number(pair[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  });
};

export const normalizeStreams = (streams) => {
  if (!streams) return null;
  return {
    ...streams,
    time: normalizeNumericArray(streams.time, { clampMin: 0 }),
    power: normalizeNumericArray(streams.power),
    heart_rate: normalizeNumericArray(streams.heart_rate),
    latlng: normalizeLatLngStream(streams.latlng)
  };
};

export const decodePolyline = (polylineString) => {
  if (!polylineString) return [];
  try {
    return polyline.decode(polylineString).map(([lat, lng]) => [lng, lat]);
  } catch (err) {
    return [];
  }
};

export const calculateAverage = (values) => {
  if (!values.length) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
};

export const MAP_POWER_COLORS = [
  '#10b981', '#34d399', '#facc15', '#fb923c', '#f97316', '#ef4444', '#a855f7'
];

export const MAP_HR_COLORS = [
  '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48'
];

export const getPowerColorForValue = (value, ftp) => {
  if (!Number.isFinite(value) || !Number.isFinite(ftp) || ftp <= 0) {
    return '#9ca3af';
  }
  const ratio = value / ftp;
  const zones = AppConfig?.POWER_ZONES || [];
  const matchIndex = zones.findIndex((zone) => ratio >= zone.min && ratio < zone.max);
  if (matchIndex >= 0 && MAP_POWER_COLORS[matchIndex]) {
    return MAP_POWER_COLORS[matchIndex];
  }
  const match = zones[matchIndex] || zones[zones.length - 1];
  return match?.color || '#9ca3af';
};

export const getHeartRateColorForValue = (value, hrMax) => {
  if (!Number.isFinite(value) || !Number.isFinite(hrMax) || hrMax <= 0) {
    return '#9ca3af';
  }
  const ratio = value / hrMax;
  const zones = AppConfig?.HR_ZONES || [];
  const matchIndex = zones.findIndex((zone) => ratio >= zone.min && ratio < zone.max);
  if (matchIndex >= 0 && MAP_HR_COLORS[matchIndex]) {
    return MAP_HR_COLORS[matchIndex];
  }
  const match = zones[matchIndex] || zones[zones.length - 1];
  return match?.color || '#9ca3af';
};

export const buildPowerSegments = (latlng, power, timeSeries, ftp) => {
  if (!Array.isArray(latlng) || latlng.length < 2) return null;

  const powerValues = Array.isArray(power) ? power : [];
  const hasPower = powerValues.length > 0;
  const timeValues = Array.isArray(timeSeries) ? timeSeries : [];
  const validIndices = latlng.reduce((acc, point, idx) => {
    if (Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])) {
      acc.push(idx);
    }
    return acc;
  }, []);
  if (validIndices.length < 2) return null;

  const totalPoints = validIndices.length;
  const maxSegments = 1200;
  const stride = Math.max(1, Math.floor(totalPoints / maxSegments));
  const features = [];
  const useDirectIndex = hasPower && timeValues.length === powerValues.length;
  const firstValidIndex = validIndices[0];
  const lastValidIndex = validIndices[validIndices.length - 1];
  const alignedTimeMin = Number.isFinite(timeValues[firstValidIndex]) ? timeValues[firstValidIndex] : null;
  const alignedTimeMax = Number.isFinite(timeValues[lastValidIndex]) ? timeValues[lastValidIndex] : null;
  const timeMin = Number.isFinite(alignedTimeMin) ? alignedTimeMin : timeValues[0];
  const timeMax = Number.isFinite(alignedTimeMax) ? alignedTimeMax : timeValues[timeValues.length - 1];
  const hasTimeRange = timeValues.length >= 2
    && Number.isFinite(timeMin)
    && Number.isFinite(timeMax)
    && timeMax > timeMin;

  const getValueAtTime = (index, targetTime) => {
    if (!hasPower || !Number.isFinite(targetTime) || timeValues.length === 0) return null;
    if (useDirectIndex) {
      return powerValues[Math.min(powerValues.length - 1, Math.max(0, index))];
    }
    const minTime = timeMin;
    const maxTime = timeMax;
    if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || maxTime <= minTime) {
      const fallbackIndex = Math.floor(index * (powerValues.length - 1) / Math.max(1, totalPoints - 1));
      return powerValues[fallbackIndex];
    }
    const ratio = (targetTime - minTime) / (maxTime - minTime);
    const mappedIndex = Math.min(powerValues.length - 1, Math.max(0, Math.round(ratio * (powerValues.length - 1))));
    return powerValues[mappedIndex];
  };

  for (let i = 0; i < totalPoints - 1; i += stride) {
    const startIndex = validIndices[i];
    const endIndex = validIndices[Math.min(i + stride, totalPoints - 1)];
    const start = latlng[startIndex];
    const end = latlng[endIndex];
    const [lat1, lng1] = start;
    const [lat2, lng2] = end;
    if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
      continue;
    }
    let powerValue = null;
    if (hasPower) {
      if (useDirectIndex) {
        powerValue = powerValues[startIndex];
      } else if (hasTimeRange) {
        const ratio = i / Math.max(1, totalPoints - 1);
        const alignedTime = Number.isFinite(timeValues[startIndex])
          ? timeValues[startIndex]
          : timeMin + ratio * (timeMax - timeMin);
        powerValue = getValueAtTime(startIndex, alignedTime);
      } else {
        const fallbackIndex = Math.floor(startIndex * (powerValues.length - 1) / Math.max(1, totalPoints - 1));
        powerValue = powerValues[fallbackIndex];
      }
    }
    features.push({
      type: 'Feature',
      properties: {
        color: getPowerColorForValue(powerValue, ftp)
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lng1, lat1],
          [lng2, lat2]
        ]
      }
    });
  }

  if (!features.length) return null;
  return {
    type: 'FeatureCollection',
    features
  };
};

export const buildHeartRateSegments = (latlng, heartRate, timeSeries, hrMax) => {
  if (!Array.isArray(latlng) || latlng.length < 2) return null;

  const hrValues = Array.isArray(heartRate) ? heartRate : [];
  const hasHR = hrValues.length > 0;
  const timeValues = Array.isArray(timeSeries) ? timeSeries : [];
  const validIndices = latlng.reduce((acc, point, idx) => {
    if (Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])) {
      acc.push(idx);
    }
    return acc;
  }, []);
  if (validIndices.length < 2) return null;

  const totalPoints = validIndices.length;
  const maxSegments = 1200;
  const stride = Math.max(1, Math.floor(totalPoints / maxSegments));
  const features = [];
  const useDirectIndex = hasHR && timeValues.length === hrValues.length;
  const firstValidIndex = validIndices[0];
  const lastValidIndex = validIndices[validIndices.length - 1];
  const alignedTimeMin = Number.isFinite(timeValues[firstValidIndex]) ? timeValues[firstValidIndex] : null;
  const alignedTimeMax = Number.isFinite(timeValues[lastValidIndex]) ? timeValues[lastValidIndex] : null;
  const timeMin = Number.isFinite(alignedTimeMin) ? alignedTimeMin : timeValues[0];
  const timeMax = Number.isFinite(alignedTimeMax) ? alignedTimeMax : timeValues[timeValues.length - 1];
  const hasTimeRange = timeValues.length >= 2
    && Number.isFinite(timeMin)
    && Number.isFinite(timeMax)
    && timeMax > timeMin;

  const getValueAtTime = (index, targetTime) => {
    if (!hasHR || !Number.isFinite(targetTime) || timeValues.length === 0) return null;
    if (useDirectIndex) {
      return hrValues[Math.min(hrValues.length - 1, Math.max(0, index))];
    }
    const minTime = timeMin;
    const maxTime = timeMax;
    if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || maxTime <= minTime) {
      const fallbackIndex = Math.floor(index * (hrValues.length - 1) / Math.max(1, totalPoints - 1));
      return hrValues[fallbackIndex];
    }
    const ratio = (targetTime - minTime) / (maxTime - minTime);
    const mappedIndex = Math.min(hrValues.length - 1, Math.max(0, Math.round(ratio * (hrValues.length - 1))));
    return hrValues[mappedIndex];
  };

  for (let i = 0; i < totalPoints - 1; i += stride) {
    const startIndex = validIndices[i];
    const endIndex = validIndices[Math.min(i + stride, totalPoints - 1)];
    const start = latlng[startIndex];
    const end = latlng[endIndex];
    const [lat1, lng1] = start;
    const [lat2, lng2] = end;
    if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
      continue;
    }
    let hrValue = null;
    if (hasHR) {
      if (useDirectIndex) {
        hrValue = hrValues[startIndex];
      } else if (hasTimeRange) {
        const ratio = i / Math.max(1, totalPoints - 1);
        const alignedTime = Number.isFinite(timeValues[startIndex])
          ? timeValues[startIndex]
          : timeMin + ratio * (timeMax - timeMin);
        hrValue = getValueAtTime(startIndex, alignedTime);
      } else {
        const fallbackIndex = Math.floor(startIndex * (hrValues.length - 1) / Math.max(1, totalPoints - 1));
        hrValue = hrValues[fallbackIndex];
      }
    }
    features.push({
      type: 'Feature',
      properties: {
        color: getHeartRateColorForValue(hrValue, hrMax)
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lng1, lat1],
          [lng2, lat2]
        ]
      }
    });
  }

  if (!features.length) return null;
  return {
    type: 'FeatureCollection',
    features
  };
};

export const getSampleDuration = (timeSeries, index) => {
  if (!Array.isArray(timeSeries) || timeSeries.length === 0) return 1;
  const current = timeSeries[index];
  const next = timeSeries[index + 1];
  if (Number.isFinite(current) && Number.isFinite(next) && next > current) return next - current;
  const prev = timeSeries[index - 1];
  if (Number.isFinite(current) && Number.isFinite(prev) && current > prev) return current - prev;
  return 1;
};

export const computeHeartRateZonesFromStream = (values, timeSeries, settings) => {
  const hrMax = settings?.hr_max || 190;
  const zoneDefs = AppConfig?.HR_ZONES || [];
  const zones = zoneDefs.map((zone, index) => ({
    zone_label: `Z${index + 1}`,
    seconds_in_zone: 0
  }));

  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    const seconds = getSampleDuration(timeSeries, index);
    zoneDefs.forEach((zone, zoneIndex) => {
      const lower = zone.min * hrMax;
      const upper = zone.max * hrMax;
      if (value >= lower && value < upper) {
        zones[zoneIndex].seconds_in_zone += seconds;
      }
    });
  });

  return zones
    .filter((zone) => zone.seconds_in_zone > 0)
    .map((zone) => ({
      ...zone,
      seconds_in_zone: Math.round(zone.seconds_in_zone)
    }));
};

export const computePowerZonesFromStream = (values, timeSeries, settings) => {
  const ftp = settings?.ftp || 250;
  const zoneDefs = AppConfig?.POWER_ZONES || [];
  const zones = zoneDefs.map((zone) => ({
    zone_label: zone.name.split(' ')[0],
    seconds_in_zone: 0,
    min: zone.min * ftp,
    max: (typeof zone.max === 'number' && Number.isFinite(zone.max) ? zone.max * ftp : Number.POSITIVE_INFINITY)
  }));

  values.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    const seconds = getSampleDuration(timeSeries, index);
    zones.forEach((zone) => {
      const upper = zone.max === Infinity ? Number.POSITIVE_INFINITY : zone.max;
      if (value >= zone.min && value < upper) {
        zone.seconds_in_zone += seconds;
      }
    });
  });

  return zones
    .filter((zone) => zone.seconds_in_zone > 0)
    .map(({ min, max, ...rest }) => ({
      ...rest,
      seconds_in_zone: Math.round(rest.seconds_in_zone)
    }));
};

export const deriveMetricsFromStreams = (activity, streams, settings) => {
  if (!streams) return activity;

  const powerValues = (streams.power || []).filter(Number.isFinite);
  const heartValues = (streams.heart_rate || []).filter(Number.isFinite);
  const timeSeries = Array.isArray(streams.time) ? streams.time : [];

  const updated = { ...activity };

  if (heartValues.length) {
    if (!updated.avg_heart_rate) {
      updated.avg_heart_rate = Math.round(calculateAverage(heartValues));
    }
    if (!updated.max_heart_rate) {
      updated.max_heart_rate = Math.round(Math.max(...heartValues));
    }
  }

  if (powerValues.length && !updated.avg_power) {
    updated.avg_power = Math.round(calculateAverage(powerValues));
  }

  if (!updated.efficiency_factor && powerValues.length && heartValues.length) {
    const avgPower = updated.avg_power || calculateAverage(powerValues);
    const avgHr = updated.avg_heart_rate || calculateAverage(heartValues);
    if (avgHr > 0) {
      updated.efficiency_factor = Number((avgPower / avgHr).toFixed(3));
    }
  }

  if ((!updated.hr_zones || !updated.hr_zones.length) && heartValues.length) {
    const hrZones = computeHeartRateZonesFromStream(heartValues, timeSeries, settings);
    if (hrZones.length) {
      updated.hr_zones = hrZones;
    }
  }

  if ((!updated.power_zones || !updated.power_zones.length) && powerValues.length) {
    const powerZones = computePowerZonesFromStream(powerValues, timeSeries, settings);
    if (powerZones.length) {
      updated.power_zones = powerZones;
    }
  }

  return updated;
};

export const hasStreamData = (stream) => Array.isArray(stream) && stream.some((value) => Number.isFinite(value));

export const getHashQueryParams = () => {
  if (typeof window === 'undefined') return new URLSearchParams();
  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return new URLSearchParams();
  return new URLSearchParams(hash.slice(queryIndex + 1));
};

export const extractZoneIndex = (zoneLabel) => {
  const match = String(zoneLabel).match(/Z(\d+)/i);
  if (match?.[1]) return Number.parseInt(match[1], 10);
  return Number.parseInt(String(zoneLabel).replace(/\D/g, ''), 10);
};

export const getZoneRangeLabel = (zoneLabel, metric, settings) => {
  const zoneDefs = metric === 'hr' ? AppConfig?.HR_ZONES : AppConfig?.POWER_ZONES;
  if (!Array.isArray(zoneDefs) || !zoneDefs.length) return '';
  const zoneIndex = extractZoneIndex(zoneLabel);
  const zone = zoneIndex ? zoneDefs[zoneIndex - 1] : null;
  if (!zone) return '';
  const base = metric === 'hr' ? (settings?.hr_max || 190) : (settings?.ftp || 250);
  const minPercent = Math.round(zone.min * 100);
  const maxPercent = Number.isFinite(zone.max) ? Math.round(zone.max * 100) : null;
  const minValue = Math.round(zone.min * base);
  const maxValue = Number.isFinite(zone.max) && zone.max !== Infinity ? Math.round(zone.max * base) : null;
  const unit = metric === 'hr' ? 'bpm' : 'W';
  const percentRange = maxPercent ? `${minPercent}-${maxPercent}%` : `${minPercent}%+`;
  const valueRange = maxValue ? `${minValue}-${maxValue}${unit}` : `${minValue}+${unit}`;
  return `${percentRange} · ${valueRange}`;
};

export const getZoneNameLabel = (zoneLabel, metric) => {
  const zoneDefs = metric === 'hr' ? AppConfig?.HR_ZONES : AppConfig?.POWER_ZONES;
  if (!Array.isArray(zoneDefs) || !zoneDefs.length) return '';
  const zoneIndex = extractZoneIndex(zoneLabel);
  const zone = zoneIndex ? zoneDefs[zoneIndex - 1] : null;
  if (!zone?.name) return '';
  const match = zone.name.match(/\(([^)]+)\)/);
  if (match?.[1]) return match[1];
  return zone.name.replace(/^Z\d+\s*/i, '').trim();
};

export const getZoneDisplayParts = (zoneLabel, metric) => {
  const labelMatch = String(zoneLabel).match(/Z\d+/i);
  const baseLabel = labelMatch ? labelMatch[0].toUpperCase() : String(zoneLabel);
  const bracketMatch = String(zoneLabel).match(/\(([^)]+)\)/);
  const overrideName = bracketMatch?.[1]?.trim();
  const zoneName = overrideName || getZoneNameLabel(baseLabel, metric);
  return { baseLabel, zoneName };
};
