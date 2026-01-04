import React, { useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import CONFIG from '../../../static/js/pages/activity/config.js';
import AppConfig from '../../../static/js/core/config.js';
import { notify } from '../../../static/js/core/utils.js';

const formatDate = (value) => {
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

const formatTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDuration = (seconds) => {
  if (!seconds) return '-';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

const formatDurationShort = (seconds) => {
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

const formatTimelineTick = (seconds) => {
  if (seconds == null || Number.isNaN(seconds)) return '';
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
  return `${secs}s`;
};

const parseTagsInput = (value) => (value || '')
  .split(',')
  .map((tag) => tag.trim().replace(/^#/, ''))
  .filter(Boolean);

const getZoneColor = (label, palette) => {
  if (!label) return CONFIG.COLORS.gray;
  const trimmed = label.trim();
  const shorthand = trimmed.split(' ')[0];
  return palette[trimmed] || palette[shorthand] || CONFIG.COLORS.gray;
};

const normalizeNumericArray = (values, { clampMin = null } = {}) => {
  if (!Array.isArray(values)) return null;
  return values.map((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    if (clampMin !== null && numeric < clampMin) return clampMin;
    return numeric;
  });
};

const normalizeStreams = (streams) => {
  if (!streams) return null;
  return {
    ...streams,
    time: normalizeNumericArray(streams.time, { clampMin: 0 }),
    power: normalizeNumericArray(streams.power),
    heart_rate: normalizeNumericArray(streams.heart_rate)
  };
};

const calculateAverage = (values) => {
  if (!values.length) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
};

const getSampleDuration = (timeSeries, index) => {
  if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
    return 1;
  }

  const current = timeSeries[index];
  const next = timeSeries[index + 1];
  if (Number.isFinite(current) && Number.isFinite(next) && next > current) {
    return next - current;
  }

  const prev = timeSeries[index - 1];
  if (Number.isFinite(current) && Number.isFinite(prev) && current > prev) {
    return current - prev;
  }

  return 1;
};

const computeHeartRateZonesFromStream = (values, timeSeries, settings) => {
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

const computePowerZonesFromStream = (values, timeSeries, settings) => {
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

const deriveMetricsFromStreams = (activity, streams, settings) => {
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

const hasStreamData = (stream) => Array.isArray(stream) && stream.some((value) => Number.isFinite(value));

const ActivityDetailApp = ({ activityId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activity, setActivity] = useState(null);
  const [settings, setSettings] = useState(null);
  const [bestPowers, setBestPowers] = useState(null);
  const [streams, setStreams] = useState(null);
  const [advancedMetrics, setAdvancedMetrics] = useState(null);
  const [tagsInput, setTagsInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [rpeInput, setRpeInput] = useState('');

  const powerZoneChartRef = useRef(null);
  const hrZoneChartRef = useRef(null);
  const powerTimelineChartRef = useRef(null);
  const hrTimelineChartRef = useRef(null);
  const activityPowerCurveRef = useRef(null);

  const powerZoneCanvasRef = useRef(null);
  const hrZoneCanvasRef = useRef(null);
  const powerTimelineCanvasRef = useRef(null);
  const hrTimelineCanvasRef = useRef(null);
  const activityPowerCurveCanvasRef = useRef(null);

  useEffect(() => {
    if (!activityId) {
      setError('No activity ID provided for activity detail view');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        Services.analytics.trackPageView('activity-detail', { activityId });
        const [activityData, settingsData, bestPowerData, streamData, advanced] = await Promise.all([
          Services.data.getActivity(activityId, { forceRefresh: true }),
          Services.data.getSettings(),
          Services.data.getBestPowerValues(),
          Services.data.getActivityStreams(activityId).catch(() => null),
          Services.data.getAdvancedMetrics(activityId).catch(() => null)
        ]);

        const normalizedActivity = {
          ...activityData,
          power_zones: Array.isArray(activityData?.power_zones) ? activityData.power_zones : [],
          hr_zones: Array.isArray(activityData?.hr_zones) ? activityData.hr_zones : [],
          tags: Array.isArray(activityData?.tags) ? activityData.tags : [],
          notes: activityData?.notes || '',
          rpe: activityData?.rpe ?? null
        };

        const normalizedStreams = normalizeStreams(streamData);
        const updatedActivity = deriveMetricsFromStreams(normalizedActivity, normalizedStreams, settingsData);

        setActivity(updatedActivity);
        setSettings(settingsData);
        setBestPowers(bestPowerData);
        setStreams(normalizedStreams);
        setAdvancedMetrics(advanced);
        setTagsInput(updatedActivity.tags.join(', '));
        setNotesInput(updatedActivity.notes || '');
        setRpeInput(updatedActivity.rpe ?? '');
      } catch (err) {
        Services.analytics.trackError('activity_detail_load', err?.message || 'unknown');
        setError(err?.message || 'Failed to load activity');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activityId]);

  useEffect(() => {
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }, [activity, streams, bestPowers, advancedMetrics]);

  const heroSummary = useMemo(() => {
    if (!activity) return { tss: '-', intensityFactor: '-', efficiencyFactor: '-' };
    return {
      tss: activity.tss ? Math.round(activity.tss) : '-',
      intensityFactor: activity.intensity_factor ? activity.intensity_factor.toFixed(2) : '-',
      efficiencyFactor: activity.efficiency_factor ? activity.efficiency_factor.toFixed(2) : '-'
    };
  }, [activity]);

  const effortCards = useMemo(() => {
    if (!activity) return [];
    const efforts = [
      { key: 'max_5sec_power', label: '5 seconds' },
      { key: 'max_1min_power', label: '1 minute' },
      { key: 'max_3min_power', label: '3 minutes' },
      { key: 'max_5min_power', label: '5 minutes' },
      { key: 'max_10min_power', label: '10 minutes' },
      { key: 'max_20min_power', label: '20 minutes' },
      { key: 'max_30min_power', label: '30 minutes' },
      { key: 'max_60min_power', label: '60 minutes' }
    ];

    return efforts
      .filter((effort) => activity[effort.key] && activity[effort.key] > 0)
      .map((effort) => {
        const activityPower = activity[effort.key];
        const bestPower = bestPowers?.[effort.key] || 0;
        return {
          ...effort,
          power: activityPower,
          isPR: bestPower > 0 && activityPower > bestPower
        };
      });
  }, [activity, bestPowers]);

  const handleSaveNotes = async () => {
    if (!activityId) return;
    const tags = parseTagsInput(tagsInput);
    const notes = notesInput || '';
    const rpeValue = rpeInput === '' ? null : Number(rpeInput);

    if (rpeValue !== null && (!Number.isFinite(rpeValue) || rpeValue < 1 || rpeValue > 10)) {
      notify('RPE must be between 1 and 10', 'warning');
      return;
    }

    try {
      const response = await Services.api.updateActivity(activityId, {
        tags,
        notes,
        rpe: rpeValue
      });
      const updated = response?.activity || {};
      setActivity((prev) => ({
        ...prev,
        notes: updated.notes ?? notes,
        rpe: updated.rpe ?? rpeValue,
        tags: updated.tags ?? tags
      }));
      notify('Activity notes updated', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to save notes', 'error');
    }
  };

  const handleRename = async () => {
    if (!activityId || !activity) return;
    const current = activity.custom_name || activity.file_name || '';
    const updated = window.prompt('Rename activity', current);
    if (updated === null) return;
    const trimmed = updated.trim();
    if (!trimmed) return;
    try {
      await Services.data.renameActivity(activityId, trimmed);
      setActivity((prev) => ({ ...prev, custom_name: trimmed }));
      notify('Activity renamed', 'success');
    } catch (err) {
      notify(err?.message || 'Failed to rename activity', 'error');
    }
  };

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart) return;

    if (powerZoneChartRef.current) {
      powerZoneChartRef.current.destroy();
      powerZoneChartRef.current = null;
    }

    const canvas = powerZoneCanvasRef.current;
    if (!canvas || !activity?.power_zones?.length) return;

    const labels = activity.power_zones.map((zone) => zone.zone_label);
    const data = activity.power_zones.map((zone) => zone.seconds_in_zone / 60);
    const colors = labels.map((label) => getZoneColor(label, CONFIG.POWER_ZONE_COLORS));

    powerZoneChartRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => {
                const minutes = Math.round(context.parsed);
                return `${context.label}: ${minutes} min`;
              }
            }
          }
        }
      }
    });
  }, [activity?.power_zones]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart) return;

    if (hrZoneChartRef.current) {
      hrZoneChartRef.current.destroy();
      hrZoneChartRef.current = null;
    }

    const canvas = hrZoneCanvasRef.current;
    if (!canvas || !activity?.hr_zones?.length) return;

    const labels = activity.hr_zones.map((zone) => zone.zone_label);
    const data = activity.hr_zones.map((zone) => zone.seconds_in_zone / 60);
    const colors = labels.map((label) => getZoneColor(label, CONFIG.HR_ZONE_COLORS));

    hrZoneChartRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => {
                const minutes = Math.round(context.parsed);
                return `${context.label}: ${minutes} min`;
              }
            }
          }
        }
      }
    });
  }, [activity?.hr_zones]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart) return;

    if (powerTimelineChartRef.current) {
      powerTimelineChartRef.current.destroy();
      powerTimelineChartRef.current = null;
    }

    const canvas = powerTimelineCanvasRef.current;
    if (!canvas || !Array.isArray(streams?.time) || !Array.isArray(streams?.power)) return;

    powerTimelineChartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: streams.time,
        datasets: [{
          label: 'Power (W)',
          data: streams.power.map((value, index) => ({ x: streams.time[index], y: value })),
          borderColor: CONFIG.COLORS.primary,
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          fill: true,
          tension: 0.25,
          spanGaps: true,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        elements: { point: { radius: 0 } },
        scales: {
          x: {
            type: 'linear',
            ticks: {
              callback: (value) => formatTimelineTick(value),
              color: '#94a3b8'
            },
            title: {
              display: true,
              text: 'Time',
              color: '#475569',
              font: { weight: '600' }
            },
            grid: { color: 'rgba(148, 163, 184, 0.2)' }
          },
          y: {
            title: {
              display: true,
              text: 'W',
              color: '#475569',
              font: { weight: '600' }
            },
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148, 163, 184, 0.15)' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            intersect: false,
            callbacks: {
              title: (context) => {
                if (!context.length) return '';
                const seconds = context[0].parsed.x ?? context[0].label;
                return `Time: ${formatTimelineTick(seconds)}`;
              },
              label: (context) => {
                const value = context.parsed.y;
                if (value == null) return 'No data';
                return `${Math.round(value)} W`;
              }
            }
          }
        }
      }
    });
  }, [streams?.time, streams?.power]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart) return;

    if (hrTimelineChartRef.current) {
      hrTimelineChartRef.current.destroy();
      hrTimelineChartRef.current = null;
    }

    const canvas = hrTimelineCanvasRef.current;
    if (!canvas || !Array.isArray(streams?.time) || !Array.isArray(streams?.heart_rate)) return;

    hrTimelineChartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: streams.time,
        datasets: [{
          label: 'Heart Rate (bpm)',
          data: streams.heart_rate.map((value, index) => ({ x: streams.time[index], y: value })),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          fill: true,
          tension: 0.25,
          spanGaps: true,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        elements: { point: { radius: 0 } },
        scales: {
          x: {
            type: 'linear',
            ticks: {
              callback: (value) => formatTimelineTick(value),
              color: '#94a3b8'
            },
            title: {
              display: true,
              text: 'Time',
              color: '#475569',
              font: { weight: '600' }
            },
            grid: { color: 'rgba(148, 163, 184, 0.2)' }
          },
          y: {
            title: {
              display: true,
              text: 'bpm',
              color: '#475569',
              font: { weight: '600' }
            },
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148, 163, 184, 0.15)' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            intersect: false,
            callbacks: {
              title: (context) => {
                if (!context.length) return '';
                const seconds = context[0].parsed.x ?? context[0].label;
                return `Time: ${formatTimelineTick(seconds)}`;
              },
              label: (context) => {
                const value = context.parsed.y;
                if (value == null) return 'No data';
                return `${Math.round(value)} bpm`;
              }
            }
          }
        }
      }
    });
  }, [streams?.time, streams?.heart_rate]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart) return;

    if (activityPowerCurveRef.current) {
      activityPowerCurveRef.current.destroy();
      activityPowerCurveRef.current = null;
    }

    const canvas = activityPowerCurveCanvasRef.current;
    const powerCurve = streams?.power_curve;
    if (!canvas || !powerCurve || !powerCurve.durations?.length) return;

    activityPowerCurveRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: powerCurve.durations,
        datasets: [{
          label: 'Best Power',
          data: powerCurve.durations.map((duration, index) => ({
            x: duration,
            y: powerCurve.powers[index]
          })),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.12)',
          fill: true,
          tension: 0.25,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            type: 'logarithmic',
            ticks: {
              callback: (value) => formatDurationShort(value),
              color: '#94a3b8'
            },
            title: {
              display: true,
              text: 'Duration',
              color: '#475569',
              font: { weight: '600' }
            },
            grid: { color: 'rgba(148, 163, 184, 0.2)' }
          },
          y: {
            title: {
              display: true,
              text: 'Power (W)',
              color: '#475569',
              font: { weight: '600' }
            },
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148, 163, 184, 0.15)' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (context) => {
                if (!context.length) return '';
                const seconds = context[0].parsed.x;
                return `Duration: ${formatDurationShort(seconds)}`;
              },
              label: (context) => `Power: ${Math.round(context.parsed.y)} W`
            }
          }
        }
      }
    });
  }, [streams?.power_curve]);

  useEffect(() => {
    return () => {
      if (powerZoneChartRef.current) {
        powerZoneChartRef.current.destroy();
        powerZoneChartRef.current = null;
      }
      if (hrZoneChartRef.current) {
        hrZoneChartRef.current.destroy();
        hrZoneChartRef.current = null;
      }
      if (powerTimelineChartRef.current) {
        powerTimelineChartRef.current.destroy();
        powerTimelineChartRef.current = null;
      }
      if (hrTimelineChartRef.current) {
        hrTimelineChartRef.current.destroy();
        hrTimelineChartRef.current = null;
      }
      if (activityPowerCurveRef.current) {
        activityPowerCurveRef.current.destroy();
        activityPowerCurveRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="activity-detail">
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'metric', count: 6 }) }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="activity-detail">
        <div className="error-state">
          <h3>Failed to Load Activity</h3>
          <p>{error}</p>
          <a href="#/activities" className="btn btn--primary">Back to Activities</a>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="activity-detail">
        <div className="error-state">
          <h3>Activity unavailable</h3>
          <a href="#/activities" className="btn btn--primary">Back to Activities</a>
        </div>
      </div>
    );
  }

  const displayName = activity.custom_name || activity.file_name || 'Untitled Ride';
  const distance = activity.distance ? `${activity.distance.toFixed(1)} km` : '-';

  const hasPowerZones = activity.power_zones && activity.power_zones.length > 0;
  const hasHRZones = activity.hr_zones && activity.hr_zones.length > 0;
  const hasPowerStream = hasStreamData(streams?.power);
  const hasHRStream = hasStreamData(streams?.heart_rate);
  const hasPowerCurve = Array.isArray(streams?.power_curve?.durations) && streams.power_curve.durations.length > 0;
  const hasTimelineData = hasPowerStream || hasHRStream;

  return (
    <div className="activity-detail activity-detail--react">
      <nav className="activity-breadcrumb">
        <a href="#/activities" className="activity-breadcrumb-link">
          <i data-feather="chevron-left"></i>
          Back to Activities
        </a>
      </nav>

      <div className="activity-header activity-header--enhanced">
        <div className="activity-header-top">
          <div className="activity-header-kicker">Session overview</div>
          <div className="activity-title-row">
            <div className="activity-title-block">
              <h1 className="activity-title" id="activityTitle">{displayName}</h1>
              <div className="activity-meta">
                <span className="activity-meta-item">
                  <i data-feather="calendar"></i>
                  {formatDate(activity.start_time)}
                </span>
                <span className="activity-meta-item">
                  <i data-feather="clock"></i>
                  {formatTime(activity.start_time)}
                </span>
              </div>
            </div>
            <div className="activity-header-actions">
              <button className="btn btn--ghost btn--sm" onClick={handleRename}>
                <i data-feather="edit-2"></i> Rename
              </button>
            </div>
          </div>

          <div className="activity-header-chips">
            <div className="activity-chip">
              <span>TSS</span>
              <strong>{heroSummary.tss}</strong>
            </div>
            <div className="activity-chip">
              <span>IF</span>
              <strong>{heroSummary.intensityFactor}</strong>
            </div>
            <div className="activity-chip">
              <span>EF</span>
              <strong>{heroSummary.efficiencyFactor}</strong>
            </div>
          </div>
        </div>

        <div className="activity-stats-grid">
          <div className="activity-stat-card activity-stat-card--primary">
            <div className="activity-stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}>
              <i data-feather="zap"></i>
            </div>
            <div className="activity-stat-content">
              <span className="activity-stat-label">Average Power</span>
              <span className="activity-stat-value">{activity.avg_power ? Math.round(activity.avg_power) : '-'}</span>
              <span className="activity-stat-unit">watts</span>
            </div>
          </div>

          <div className="activity-stat-card">
            <div className="activity-stat-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <i data-feather="activity"></i>
            </div>
            <div className="activity-stat-content">
              <span className="activity-stat-label">Normalized Power</span>
              <span className="activity-stat-value">{activity.normalized_power ? Math.round(activity.normalized_power) : '-'}</span>
              <span className="activity-stat-unit">watts</span>
            </div>
          </div>

          <div className="activity-stat-card">
            <div className="activity-stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
              <i data-feather="clock"></i>
            </div>
            <div className="activity-stat-content">
              <span className="activity-stat-label">Duration</span>
              <span className="activity-stat-value">{formatDuration(activity.duration)}</span>
              <span className="activity-stat-unit">&nbsp;</span>
            </div>
          </div>

          <div className="activity-stat-card">
            <div className="activity-stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
              <i data-feather="map"></i>
            </div>
            <div className="activity-stat-content">
              <span className="activity-stat-label">Distance</span>
              <span className="activity-stat-value">{distance}</span>
              <span className="activity-stat-unit">&nbsp;</span>
            </div>
          </div>
        </div>
      </div>

      <div className="activity-main-grid">
        <div className="activity-metrics-panel">
          <h2 className="activity-section-title">Training Metrics</h2>
          <div className="activity-metrics-list">
            <div className="activity-metric-row">
              <span className="activity-metric-label">
                <i data-feather="trending-up"></i>
                Training Stress Score
              </span>
              <span className="activity-metric-value">{heroSummary.tss}</span>
            </div>
            <div className="activity-metric-row">
              <span className="activity-metric-label">
                <i data-feather="percent"></i>
                Intensity Factor
              </span>
              <span className="activity-metric-value">{heroSummary.intensityFactor}</span>
            </div>
            <div className="activity-metric-row">
              <span className="activity-metric-label">
                <i data-feather="bar-chart-2"></i>
                Efficiency Factor
              </span>
              <span className="activity-metric-value">{heroSummary.efficiencyFactor}</span>
            </div>
          </div>

          <h2 className="activity-section-title" style={{ marginTop: 28 }}>Heart Rate</h2>
          <div className="activity-metrics-list">
            <div className="activity-metric-row">
              <span className="activity-metric-label">
                <i data-feather="heart"></i>
                Average Heart Rate
              </span>
              <span className="activity-metric-value">
                {activity.avg_heart_rate ? Math.round(activity.avg_heart_rate) : '-'} bpm
              </span>
            </div>
            <div className="activity-metric-row">
              <span className="activity-metric-label">
                <i data-feather="activity"></i>
                Maximum Heart Rate
              </span>
              <span className="activity-metric-value">
                {activity.max_heart_rate ? Math.round(activity.max_heart_rate) : '-'} bpm
              </span>
            </div>
          </div>
        </div>

        <div className="activity-annotations-panel">
          <div className="activity-annotations-header">
            <h2 className="activity-section-title">Notes & Tags</h2>
            <p className="activity-annotations-subtitle">Capture context, effort, and recovery notes.</p>
          </div>
          <div className="activity-annotation-field">
            <label htmlFor="activity-tags-input">Tags</label>
            <input
              type="text"
              id="activity-tags-input"
              className="activity-annotation-input"
              placeholder="#interval, #race"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
            />
            <div className="activity-tag-preview">
              {parseTagsInput(tagsInput).length ? (
                parseTagsInput(tagsInput).map((tag) => (
                  <span key={tag} className="activity-tag-pill">#{tag}</span>
                ))
              ) : (
                <span className="activity-tag-preview__empty">No tags yet</span>
              )}
            </div>
          </div>
          <div className="activity-annotation-field">
            <label htmlFor="activity-rpe-input">RPE (1-10)</label>
            <input
              type="number"
              id="activity-rpe-input"
              className="activity-annotation-input"
              min="1"
              max="10"
              step="1"
              value={rpeInput}
              onChange={(event) => setRpeInput(event.target.value)}
            />
          </div>
          <div className="activity-annotation-field">
            <label htmlFor="activity-notes-input">Notes</label>
            <textarea
              id="activity-notes-input"
              className="activity-annotation-textarea"
              rows="4"
              placeholder="How did this session feel? Any context to remember?"
              value={notesInput}
              onChange={(event) => setNotesInput(event.target.value)}
            />
          </div>
          <button className="btn btn--primary" onClick={handleSaveNotes}>
            <i data-feather="save"></i>
            Save Notes
          </button>
        </div>
      </div>

      <section className="activity-section activity-advanced-section">
        <div className="activity-section-header">
          <h2 className="activity-section-title">Advanced Metrics</h2>
          <p className="activity-section-subtitle">Fatigue resistance, W' balance, variability, and decoupling.</p>
        </div>
        <div className="activity-advanced-grid">
          <div className="activity-advanced-card">
            <div className="activity-advanced-title">Fatigue Resistance</div>
            <div className="activity-advanced-value">
              {advancedMetrics?.fatigueResistance ? Number(advancedMetrics.fatigueResistance.fatigue_ratio).toFixed(2) : '-'}
            </div>
            <div className="activity-advanced-sub">
              {advancedMetrics?.fatigueResistance
                ? `Decay ${advancedMetrics.fatigueResistance.decay_percent}% over ${advancedMetrics.fatigueResistance.segment_minutes} min`
                : 'Insufficient data'}
            </div>
          </div>
          <div className="activity-advanced-card">
            <div className="activity-advanced-title">W' Balance</div>
            <div className="activity-advanced-value">
              {advancedMetrics?.wPrimeBalance
                ? `${(advancedMetrics.wPrimeBalance.min_w_balance / 1000).toFixed(1)} kJ`
                : '-'}
            </div>
            <div className="activity-advanced-sub">
              {advancedMetrics?.wPrimeBalance
                ? `Depletion ${advancedMetrics.wPrimeBalance.depletion_percent}%`
                : 'Insufficient data'}
            </div>
            {advancedMetrics?.wPrimeBalance && (
              <div className="activity-advanced-meta">
                CP {advancedMetrics.wPrimeBalance.critical_power}W - W' {(advancedMetrics.wPrimeBalance.w_prime / 1000).toFixed(1)} kJ
              </div>
            )}
          </div>
          <div className="activity-advanced-card">
            <div className="activity-advanced-title">Variability Index</div>
            <div className="activity-advanced-value">
              {advancedMetrics?.variabilityIndex ? Number(advancedMetrics.variabilityIndex.variability_index).toFixed(2) : '-'}
            </div>
            <div className="activity-advanced-sub">
              {advancedMetrics?.variabilityIndex
                ? `NP ${advancedMetrics.variabilityIndex.normalized_power}W - Avg ${advancedMetrics.variabilityIndex.avg_power}W`
                : 'Insufficient data'}
            </div>
          </div>
          <div className="activity-advanced-card">
            <div className="activity-advanced-title">Decoupling</div>
            <div className="activity-advanced-value">
              {advancedMetrics?.decoupling ? `${Number(advancedMetrics.decoupling.decoupling_percent).toFixed(1)}%` : '-'}
            </div>
            <div className="activity-advanced-sub">
              {advancedMetrics?.decoupling ? 'Power/HR drift' : 'Insufficient data'}
            </div>
            {advancedMetrics?.decoupling && (
              <div className="activity-advanced-meta">
                P {advancedMetrics.decoupling.power_first} to {advancedMetrics.decoupling.power_last}W - HR {advancedMetrics.decoupling.hr_first} to {advancedMetrics.decoupling.hr_last}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="activity-section">
        <h2 className="activity-section-title">Effort Timeline</h2>
        {hasTimelineData ? (
          <div className="activity-timeline-grid">
            {hasPowerStream && (
              <div className="activity-chart-card">
                <div className="activity-chart-card-header">
                  <h3>Power Timeline</h3>
                  <p>Complete wattage trace across the ride</p>
                </div>
                <div className="activity-chart-wrapper">
                  <canvas ref={powerTimelineCanvasRef}></canvas>
                </div>
              </div>
            )}
            {hasHRStream && (
              <div className="activity-chart-card">
                <div className="activity-chart-card-header">
                  <h3>Heart Rate Timeline</h3>
                  <p>Cardiac response throughout the session</p>
                </div>
                <div className="activity-chart-wrapper">
                  <canvas ref={hrTimelineCanvasRef}></canvas>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="activity-empty-state">
            <i data-feather="activity"></i>
            <p>No timeline data found for this activity.</p>
          </div>
        )}
      </section>

      {hasPowerCurve && (
        <section className="activity-section">
          <h2 className="activity-section-title">Power Curve (This Activity)</h2>
          <p className="activity-section-subtitle">Peak interval outputs calculated exclusively from this ride</p>
          <div className="activity-chart-card">
            <div className="activity-chart-wrapper">
              <canvas ref={activityPowerCurveCanvasRef}></canvas>
            </div>
          </div>
        </section>
      )}

      <section className="activity-section">
        <h2 className="activity-section-title">Zone Distribution</h2>
        {!hasPowerZones && !hasHRZones ? (
          <div className="activity-empty-state">
            <i data-feather="pie-chart"></i>
            <p>No zone data available for this activity</p>
          </div>
        ) : (
          <div className="activity-zones-grid">
            {hasPowerZones && (
              <div className="activity-zone-card">
                <h3 className="activity-zone-card-title">Power Zones</h3>
                <div className="activity-chart-container">
                  <canvas ref={powerZoneCanvasRef}></canvas>
                </div>
                <div className="activity-zone-list">
                  {activity.power_zones.map((zone) => {
                    const totalSeconds = activity.power_zones.reduce((sum, z) => sum + z.seconds_in_zone, 0);
                    const percentage = totalSeconds > 0 ? (zone.seconds_in_zone / totalSeconds * 100).toFixed(1) : '0.0';
                    return (
                      <div key={zone.zone_label} className="activity-zone-row">
                        <div className="activity-zone-color" style={{ background: getZoneColor(zone.zone_label, CONFIG.POWER_ZONE_COLORS) }}></div>
                        <span className="activity-zone-label">{zone.zone_label}</span>
                        <span className="activity-zone-time">{formatDuration(zone.seconds_in_zone)}</span>
                        <span className="activity-zone-percent">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {hasHRZones && (
              <div className="activity-zone-card">
                <h3 className="activity-zone-card-title">Heart Rate Zones</h3>
                <div className="activity-chart-container">
                  <canvas ref={hrZoneCanvasRef}></canvas>
                </div>
                <div className="activity-zone-list">
                  {activity.hr_zones.map((zone) => {
                    const totalSeconds = activity.hr_zones.reduce((sum, z) => sum + z.seconds_in_zone, 0);
                    const percentage = totalSeconds > 0 ? (zone.seconds_in_zone / totalSeconds * 100).toFixed(1) : '0.0';
                    return (
                      <div key={zone.zone_label} className="activity-zone-row">
                        <div className="activity-zone-color" style={{ background: getZoneColor(zone.zone_label, CONFIG.HR_ZONE_COLORS) }}></div>
                        <span className="activity-zone-label">{zone.zone_label}</span>
                        <span className="activity-zone-time">{formatDuration(zone.seconds_in_zone)}</span>
                        <span className="activity-zone-percent">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="activity-section">
        <h2 className="activity-section-title">Best Efforts</h2>
        {effortCards.length === 0 ? (
          <div className="activity-empty-state">
            <i data-feather="award"></i>
            <p>No power data available for this activity</p>
          </div>
        ) : (
          <>
            <p className="activity-section-subtitle">Peak power outputs during this activity</p>
            <div className="activity-efforts-grid">
              {effortCards.map((effort) => (
                <div key={effort.key} className={`activity-effort-card ${effort.isPR ? 'activity-effort-card--pr' : ''}`}>
                  {effort.isPR && (
                    <div className="activity-pr-badge">
                      <i data-feather="award"></i> PR
                    </div>
                  )}
                  <div className="activity-effort-label">{effort.label}</div>
                  <div className="activity-effort-value">{Math.round(effort.power)}</div>
                  <div className="activity-effort-unit">watts</div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default ActivityDetailApp;
