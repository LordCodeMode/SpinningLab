import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import APP_CONFIG from '../../../static/js/core/config.js';
import CONFIG from '../../../static/js/pages/comparisons/config.js';

const PRESETS = [30, 60, 180, 365];

const toISODate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatRangeLabel = (start, end) => (
  `${formatDateLabel(toISODate(start))} - ${formatDateLabel(toISODate(end))}`
);

const getDefaultRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: toISODate(start),
    end: toISODate(now)
  };
};

const getRangeDays = (range) => {
  if (!range.start || !range.end) return null;
  const start = new Date(range.start);
  const end = new Date(range.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
};

const getActivePreset = (range) => {
  const rangeDays = getRangeDays(range);
  if (!rangeDays) return null;
  return PRESETS.find((days) => Math.abs(rangeDays - days) <= 1) || null;
};

const shiftYear = (date, delta) => {
  const shifted = new Date(date);
  const year = shifted.getFullYear() + delta;
  try {
    shifted.setFullYear(year);
    return shifted;
  } catch (error) {
    return new Date(year, 1, 28);
  }
};

const getComparisonPeriods = (range, compareMode) => {
  if (!range.start || !range.end) return null;
  const currentStart = new Date(range.start);
  const currentEnd = new Date(range.end);

  if (Number.isNaN(currentStart.getTime()) || Number.isNaN(currentEnd.getTime())) return null;

  const startDay = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate());
  const endDay = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), currentEnd.getDate());
  const durationDays = Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);

  let previousStart;
  let previousEnd;

  if (compareMode === 'year') {
    previousStart = shiftYear(startDay, -1);
    previousEnd = shiftYear(endDay, -1);
  } else {
    previousEnd = new Date(startDay);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - durationDays + 1);
  }

  return {
    currentStart: startDay,
    currentEnd: endDay,
    previousStart,
    previousEnd
  };
};

const sampleCurve = (curve) => {
  const durations = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600];
  const labels = durations.map((sec) => (sec >= 60 ? `${sec / 60}m` : `${sec}s`));
  const values = durations.map((sec) => getCurveValue(curve, sec));
  return { labels, values };
};

const getCurveValue = (curve, duration) => {
  if (Array.isArray(curve)) {
    const idx = Math.min(curve.length, duration) - 1;
    return idx >= 0 ? curve[idx] || 0 : 0;
  }

  if (curve && Array.isArray(curve.durations) && Array.isArray(curve.powers)) {
    const pairs = curve.durations.map((dur, index) => ({
      duration: Number(dur),
      power: Number(curve.powers[index])
    })).filter((item) => Number.isFinite(item.duration) && Number.isFinite(item.power));

    if (!pairs.length) return 0;

    let closest = pairs[0];
    let bestDiff = Math.abs(pairs[0].duration - duration);

    pairs.forEach((item) => {
      const diff = Math.abs(item.duration - duration);
      if (diff < bestDiff) {
        bestDiff = diff;
        closest = item;
      }
    });

    return closest?.power || 0;
  }

  return 0;
};

const hasNonZeroValues = (values = []) => (
  Array.isArray(values) && values.some((value) => Number(value) > 0)
);

const padSeries = (values = [], length = 0) => {
  const padded = values.slice(0, length);
  while (padded.length < length) {
    padded.push(null);
  }
  return padded;
};

const formatMonthLabel = (value) => {
  if (!value) return '';
  const [year, month] = String(value).split('-');
  if (!year || !month) return value;
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const buildFtpComparisonSeries = (current = [], previous = []) => {
  const sortedCurrent = [...current].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const sortedPrevious = [...previous].sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const currentValues = sortedCurrent.map((item) => item.estimated_ftp ?? null);
  const previousValues = sortedPrevious.map((item) => item.estimated_ftp ?? null);
  const hasComparison = previousValues.some((value) => Number.isFinite(value) && value > 0);

  if (hasComparison) {
    const maxLen = Math.max(currentValues.length, previousValues.length, 1);
    const labels = Array.from({ length: maxLen }, (_, index) => `M${index + 1}`);
    return {
      labels,
      currentValues: padSeries(currentValues, maxLen),
      previousValues: padSeries(previousValues, maxLen)
    };
  }

  const labels = sortedCurrent.map((item) => formatMonthLabel(item.month));
  return {
    labels,
    currentValues,
    previousValues: []
  };
};

const ComparisonsApp = () => {
  const chartRefs = {
    powerCurve: useRef(null),
    ftp: useRef(null),
    seasonal: useRef(null)
  };
  const canvasRefs = {
    powerCurve: useRef(null),
    ftp: useRef(null),
    seasonal: useRef(null)
  };

  const [range, setRange] = useState(getDefaultRange);
  const [rangeInput, setRangeInput] = useState(getDefaultRange);
  const [compareMode, setCompareMode] = useState('previous');
  const [data, setData] = useState(null);
  const [powerCurveComparison, setPowerCurveComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Services.analytics.trackPageView('comparisons');
  }, []);

  const loadPowerCurveComparison = useCallback(async (nextRange, nextCompareMode) => {
    const periods = getComparisonPeriods(nextRange, nextCompareMode);
    if (!periods) {
      return null;
    }

    const { currentStart, currentEnd, previousStart, previousEnd } = periods;
    const [currentCurve, previousCurve] = await Promise.all([
      Services.data.getPowerCurve({
        start: toISODate(currentStart),
        end: toISODate(currentEnd)
      }),
      Services.data.getPowerCurve({
        start: toISODate(previousStart),
        end: toISODate(previousEnd)
      })
    ]);

    return {
      current: currentCurve,
      previous: previousCurve,
      currentLabel: formatRangeLabel(currentStart, currentEnd),
      previousLabel: formatRangeLabel(previousStart, previousEnd)
    };
  }, []);

  const fetchData = useCallback(async (nextRange, nextCompareMode) => {
    const params = {};
    const start = nextRange.start;
    const end = nextRange.end;
    if (start && end) {
      params.startDate = start;
      params.endDate = end;
    }
    params.compareMode = nextCompareMode;
    params.includeYearCurve = false;
    params.includePrTimeline = true;
    params.includeFtpProgression = true;
    params.includeSeasonalVolume = true;

    const rangeDays = getRangeDays(nextRange);
    if (rangeDays) {
      params.months = Math.min(60, Math.max(6, Math.ceil(rangeDays / 30)));
      params.years = Math.min(10, Math.max(2, Math.ceil(rangeDays / 365)));
      const endDate = new Date(end);
      params.yearCurrent = endDate.getFullYear();
      params.yearPrevious = endDate.getFullYear() - 1;
    }

    return Services.data.getComparisons(params);
  }, []);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setPowerCurveComparison(null);
        const nextData = await fetchData(range, compareMode);
        if (!isActive) return;
        setData(nextData);
        if (nextData?.power_curve_comparison) {
          const periods = getComparisonPeriods(range, compareMode);
          if (periods) {
            setPowerCurveComparison({
              current: nextData.power_curve_comparison.current || [],
              previous: nextData.power_curve_comparison.previous || [],
              currentLabel: formatRangeLabel(periods.currentStart, periods.currentEnd),
              previousLabel: formatRangeLabel(periods.previousStart, periods.previousEnd)
            });
          } else {
            setPowerCurveComparison({
              current: nextData.power_curve_comparison.current || [],
              previous: nextData.power_curve_comparison.previous || [],
              currentLabel: 'Current Range',
              previousLabel: 'Previous Range'
            });
          }
        } else {
          const comparison = await loadPowerCurveComparison(range, compareMode);
          if (!isActive) return;
          setPowerCurveComparison(comparison);
        }
      } catch (loadError) {
        if (!isActive) return;
        console.error('Error loading comparisons:', loadError);
        setError(loadError);
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
  }, [compareMode, fetchData, loadPowerCurveComparison, range]);

  const periodComparison = useMemo(() => {
    const period = data?.period_comparison || {};
    return {
      current: period.current || {},
      previous: period.previous || {}
    };
  }, [data]);

  const deltaCards = useMemo(() => {
    const current = periodComparison.current;
    const previous = periodComparison.previous;
    return [
      { label: 'Sessions', value: (current.sessions || 0) - (previous.sessions || 0), format: (v) => v },
      { label: 'Distance (km)', value: (current.distance_km || 0) - (previous.distance_km || 0), format: (v) => v.toFixed(1) },
      { label: 'Duration (h)', value: (current.duration_hours || 0) - (previous.duration_hours || 0), format: (v) => v.toFixed(1) },
      { label: 'Total TSS', value: (current.total_tss || 0) - (previous.total_tss || 0), format: (v) => v.toFixed(0) }
    ];
  }, [periodComparison]);

  const powerCurveData = useMemo(() => {
    const fallback = data?.year_over_year_power_curve || {};
    const currentSource = powerCurveComparison?.current || fallback.current || [];
    const previousSource = powerCurveComparison?.previous || fallback.previous || [];

    const current = sampleCurve(currentSource);
    const previous = sampleCurve(previousSource);
    const labels = current.labels.length ? current.labels : previous.labels;
    const hasData = hasNonZeroValues(current.values) || hasNonZeroValues(previous.values);

    const currentLabel = powerCurveComparison
      ? 'Current Range'
      : `${fallback.current_year || 'Current'} Year`;
    const previousLabel = powerCurveComparison
      ? 'Previous Range'
      : `${fallback.previous_year || 'Previous'} Year`;

    return {
      labels,
      current,
      previous,
      hasData,
      currentLabel,
      previousLabel
    };
  }, [data, powerCurveComparison]);

  const ftpSeries = useMemo(() => {
    const currentProgression = Array.isArray(data?.ftp_progression) ? data.ftp_progression : [];
    const previousProgression = Array.isArray(data?.ftp_progression_previous)
      ? data.ftp_progression_previous
      : [];
    const series = buildFtpComparisonSeries(currentProgression, previousProgression);
    return {
      ...series,
      hasData: hasNonZeroValues(series.currentValues) || hasNonZeroValues(series.previousValues)
    };
  }, [data]);

  const seasonalSeries = useMemo(() => {
    const seasonalCurrent = Array.isArray(data?.seasonal_volume) ? data.seasonal_volume : [];
    const seasonalPrevious = Array.isArray(data?.seasonal_volume_previous)
      ? data.seasonal_volume_previous
      : [];
    const labels = ['Winter', 'Spring', 'Summer', 'Fall'];
    const currentValues = labels.map((label) => {
      const match = seasonalCurrent.find((item) => item.label === label);
      return match?.duration_hours ?? 0;
    });
    const previousValues = labels.map((label) => {
      const match = seasonalPrevious.find((item) => item.label === label);
      return match?.duration_hours ?? 0;
    });
    return {
      labels,
      currentValues,
      previousValues,
      hasData: hasNonZeroValues(currentValues) || hasNonZeroValues(previousValues)
    };
  }, [data]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart) return;

    const colors = APP_CONFIG.CHART_COLORS;
    const ctx = canvasRefs.powerCurve.current?.getContext('2d');
    if (!ctx || !powerCurveData.hasData) {
      if (chartRefs.powerCurve.current) {
        chartRefs.powerCurve.current.destroy();
        chartRefs.powerCurve.current = null;
      }
      return;
    }

    if (chartRefs.powerCurve.current) {
      chartRefs.powerCurve.current.destroy();
    }

    chartRefs.powerCurve.current = new Chart(canvasRefs.powerCurve.current, {
      type: 'line',
      data: {
        labels: powerCurveData.labels,
        datasets: [
          {
            label: powerCurveData.currentLabel,
            data: powerCurveData.current.values,
            borderColor: colors.primary,
            backgroundColor: createGradient(ctx, colors.primary),
            tension: 0.35,
            fill: true,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: colors.primary,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2
          },
          {
            label: powerCurveData.previousLabel,
            data: powerCurveData.previous.values,
            borderColor: colors.warning,
            backgroundColor: createGradient(ctx, colors.warning),
            tension: 0.35,
            fill: true,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: colors.warning,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 16,
              font: { size: 12, weight: '600' }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: 12,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            borderColor: 'rgba(148, 163, 184, 0.3)',
            borderWidth: 1
          }
        },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            title: { display: true, text: 'Watts' },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
            ticks: { font: { size: 11 } }
          }
        }
      }
    });
  }, [powerCurveData]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart) return;

    const colors = APP_CONFIG.CHART_COLORS;
    const ctx = canvasRefs.ftp.current?.getContext('2d');
    if (!ctx || !ftpSeries.hasData) {
      if (chartRefs.ftp.current) {
        chartRefs.ftp.current.destroy();
        chartRefs.ftp.current = null;
      }
      return;
    }

    if (chartRefs.ftp.current) {
      chartRefs.ftp.current.destroy();
    }

    chartRefs.ftp.current = new Chart(canvasRefs.ftp.current, {
      type: 'line',
      data: {
        labels: ftpSeries.labels,
        datasets: [
          {
            label: 'Current Range',
            data: ftpSeries.currentValues,
            borderColor: colors.success,
            backgroundColor: createGradient(ctx, colors.success),
            tension: 0.3,
            fill: true,
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: colors.success,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            spanGaps: false
          },
          {
            label: 'Previous Range',
            data: ftpSeries.previousValues,
            borderColor: colors.warning,
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            tension: 0.3,
            fill: false,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: colors.warning,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            borderDash: [6, 6],
            spanGaps: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 12,
              font: { size: 11, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: 10,
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 12 },
            borderColor: 'rgba(148, 163, 184, 0.3)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              autoSkip: true,
              maxTicksLimit: 6,
              maxRotation: 0,
              minRotation: 0
            }
          },
          y: {
            title: { display: true, text: 'Watts' },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
            ticks: { font: { size: 11 } }
          }
        }
      }
    });
  }, [ftpSeries]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart) return;

    const colors = APP_CONFIG.CHART_COLORS;
    const ctx = canvasRefs.seasonal.current?.getContext('2d');
    if (!ctx || !seasonalSeries.hasData) {
      if (chartRefs.seasonal.current) {
        chartRefs.seasonal.current.destroy();
        chartRefs.seasonal.current = null;
      }
      return;
    }

    if (chartRefs.seasonal.current) {
      chartRefs.seasonal.current.destroy();
    }

    chartRefs.seasonal.current = new Chart(canvasRefs.seasonal.current, {
      type: 'bar',
      data: {
        labels: seasonalSeries.labels,
        datasets: [
          {
            label: 'Current Range',
            data: seasonalSeries.currentValues,
            backgroundColor: createGradient(ctx, colors.secondary),
            borderColor: colors.secondary,
            borderWidth: 1,
            borderRadius: 8,
            maxBarThickness: 30
          },
          {
            label: 'Previous Range',
            data: seasonalSeries.previousValues,
            backgroundColor: 'rgba(245, 158, 11, 0.25)',
            borderColor: colors.warning,
            borderWidth: 1,
            borderRadius: 8,
            maxBarThickness: 30
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 12,
              font: { size: 11, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: 10,
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 12 },
            borderColor: 'rgba(148, 163, 184, 0.3)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              autoSkip: true,
              maxTicksLimit: 4,
              maxRotation: 0,
              minRotation: 0
            }
          },
          y: {
            title: { display: true, text: 'Hours' },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
            ticks: { font: { size: 11 } }
          }
        }
      }
    });
  }, [seasonalSeries]);

  useEffect(() => {
    return () => {
      Object.values(chartRefs).forEach((ref) => {
        if (ref.current && typeof ref.current.destroy === 'function') {
          ref.current.destroy();
          ref.current = null;
        }
      });
    };
  }, []);

  const handleApply = useCallback(() => {
    setRange({
      start: rangeInput.start || range.start,
      end: rangeInput.end || range.end
    });
  }, [range, rangeInput]);

  const handleReset = useCallback(() => {
    const next = getDefaultRange();
    setRange(next);
    setRangeInput(next);
    setCompareMode('previous');
  }, []);

  const handlePreset = useCallback((days) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1);
    const next = {
      start: toISODate(startDate),
      end: toISODate(endDate)
    };
    setRange(next);
    setRangeInput(next);
  }, []);

  const comparisonLabel = useMemo(() => {
    if (!range.start || !range.end) {
      return 'This month vs last month';
    }
    return `${formatDateLabel(range.start)} - ${formatDateLabel(range.end)}`;
  }, [range]);

  const summaryStrip = useMemo(() => {
    const current = periodComparison.current;
    const previous = periodComparison.previous;
    const deltaTss = (current.total_tss || 0) - (previous.total_tss || 0);
    const deltaDistance = (current.distance_km || 0) - (previous.distance_km || 0);
    const rangeDays = getRangeDays(range);
    return [
      {
        label: 'Range Length',
        value: rangeDays ? `${rangeDays} days` : 'Custom',
        detail: comparisonLabel
      },
      {
        label: 'Delta TSS',
        value: `${deltaTss >= 0 ? '+' : ''}${deltaTss.toFixed(0)}`,
        detail: 'Current vs previous'
      },
      {
        label: 'Delta Distance',
        value: `${deltaDistance >= 0 ? '+' : ''}${deltaDistance.toFixed(1)} km`,
        detail: 'Current vs previous'
      }
    ];
  }, [comparisonLabel, periodComparison, range]);

  const bestPowerRows = useMemo(() => {
    const comparison = powerCurveComparison;
    if (!comparison?.current || !comparison?.previous) {
      return null;
    }
    const durations = [
      { label: '5s', seconds: 5 },
      { label: '30s', seconds: 30 },
      { label: '1m', seconds: 60 },
      { label: '5m', seconds: 300 },
      { label: '20m', seconds: 1200 },
      { label: '60m', seconds: 3600 }
    ];

    return durations.map((item) => {
      const current = getCurveValue(comparison.current, item.seconds);
      const previous = getCurveValue(comparison.previous, item.seconds);
      const delta = current - previous;
      const hasData = current > 0 || previous > 0;
      return {
        label: item.label,
        current: current || null,
        previous: previous || null,
        delta: hasData ? delta : null
      };
    });
  }, [powerCurveComparison]);

  const formatWatts = (value) => (Number.isFinite(value) && value > 0 ? `${Math.round(value)}W` : '-');
  const formatDelta = (value) => {
    if (!Number.isFinite(value)) return '-';
    const sign = value > 0 ? '+' : '';
    return `${sign}${Math.round(value)}W`;
  };

  if (loading) {
    return (
      <div className="page-header">
        <h1 className="page-title">{CONFIG.title}</h1>
        <p className="page-description">{CONFIG.subtitle}</p>
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ height: '420px' }) }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="comparisons-page">
        <div className="page-header">
          <h1 className="page-title">{CONFIG.title}</h1>
        </div>
        <div className="error-state">
          <h3>Comparisons unavailable</h3>
          <p>{error.message}</p>
          <button className="btn btn--primary btn--sm" type="button" onClick={() => setRange({ ...range })}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const current = periodComparison.current;
  const previous = periodComparison.previous;

  return (
    <div className="comparisons-page">
      <div className="comparisons-hero">
        <div>
          <h1 className="page-title">{CONFIG.title}</h1>
          <p className="page-description">{CONFIG.subtitle}</p>
        </div>
        <div className="comparisons-hero__line">
          <span></span>
        </div>
      </div>

      <section className="comparisons-controls">
        <div className="comparisons-controls__row">
          <div className="comparisons-control">
            <label htmlFor="comparisons-start">Start</label>
            <input
              type="date"
              id="comparisons-start"
              value={rangeInput.start || ''}
              onChange={(event) => setRangeInput((prev) => ({ ...prev, start: event.target.value }))}
            />
          </div>
          <div className="comparisons-control">
            <label htmlFor="comparisons-end">End</label>
            <input
              type="date"
              id="comparisons-end"
              value={rangeInput.end || ''}
              onChange={(event) => setRangeInput((prev) => ({ ...prev, end: event.target.value }))}
            />
          </div>
          <div className="comparisons-control">
            <label>Quick Range</label>
            <div className="eff-range-controls">
              {PRESETS.map((days) => {
                const isActive = getActivePreset(range) === days;
                return (
                  <button
                    type="button"
                    key={days}
                    className={`eff-range-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handlePreset(days)}
                  >
                    {days === 365 ? '1y' : `${days}d`}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="comparisons-control comparisons-control--actions">
            <button className="btn btn--primary btn--sm" type="button" onClick={handleApply}>
              Apply
            </button>
            <button className="btn btn--secondary btn--sm" type="button" onClick={handleReset}>
              This Month
            </button>
          </div>
        </div>
      </section>

      <section className="comparisons-strip">
        {summaryStrip.map((item) => (
          <div className="comparisons-strip-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </section>

      <section className="comparisons-section comparisons-section--summary">
        <div className="comparisons-section__header">
          <h2>Period Comparison</h2>
          <p>{comparisonLabel}</p>
        </div>
        <div className="comparisons-grid">
          <div className="comparisons-summary-card comparisons-summary-card--current">
            <h4>This Period</h4>
            <div className="comparisons-summary-card__meta">{current.start || ''} - {current.end || ''}</div>
            <div className="comparisons-summary-card__stats">
              <div><span>{current.sessions || 0}</span><small>Sessions</small></div>
              <div><span>{current.distance_km || 0}</span><small>km</small></div>
              <div><span>{current.duration_hours || 0}</span><small>hrs</small></div>
              <div><span>{current.total_tss || 0}</span><small>TSS</small></div>
            </div>
          </div>
          <div className="comparisons-summary-card comparisons-summary-card--previous">
            <h4>{compareMode === 'year' ? 'Last Year' : 'Previous Period'}</h4>
            <div className="comparisons-summary-card__meta">{previous.start || ''} - {previous.end || ''}</div>
            <div className="comparisons-summary-card__stats">
              <div><span>{previous.sessions || 0}</span><small>Sessions</small></div>
              <div><span>{previous.distance_km || 0}</span><small>km</small></div>
              <div><span>{previous.duration_hours || 0}</span><small>hrs</small></div>
              <div><span>{previous.total_tss || 0}</span><small>TSS</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="comparisons-section comparisons-section--delta">
        <div className="comparisons-section__header">
          <h2>Delta Highlights</h2>
          <p>How this period stacks up against the comparison range.</p>
        </div>
        <div className="comparisons-delta-grid">
          {deltaCards.map((card) => {
            const sign = card.value >= 0 ? '+' : '';
            const tone = card.value >= 0 ? 'positive' : 'negative';
            const barWidth = Math.min(100, Math.abs(card.value) * 8);
            return (
              <div className={`comparisons-delta-card ${tone}`} key={card.label}>
                <div className="comparisons-delta-label">{card.label}</div>
                <div className="comparisons-delta-value">{sign}{card.format(card.value)}</div>
                <div className="comparisons-delta-bar">
                  <span style={{ width: `${barWidth}%` }}></span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="comparisons-section">
        <div className="comparisons-section__header">
          <h2>Power Curve Comparison</h2>
          <p>Compare best sustainable power across ranges</p>
        </div>
        <div className="comparisons-card comparisons-card--chart comparisons-card--hero">
          <div className="comparisons-chart-body">
            {!powerCurveData.hasData ? (
              <div className="comparisons-empty">No power curve data for this range.</div>
            ) : null}
            <canvas ref={canvasRefs.powerCurve} id="comparisonPowerCurve"></canvas>
          </div>
        </div>
      </section>

      <section className="comparisons-section comparisons-section--split">
        <div className="comparisons-card comparisons-card--chart">
          <div className="comparisons-card__header">
            <h3>FTP Progression</h3>
            <p>Current vs previous period</p>
          </div>
          <div className="comparisons-chart-body">
            {!ftpSeries.hasData ? (
              <div className="comparisons-empty">No FTP progression data for this range.</div>
            ) : null}
            <canvas ref={canvasRefs.ftp} id="comparisonFtp"></canvas>
          </div>
        </div>

        <div className="comparisons-card comparisons-card--chart">
          <div className="comparisons-card__header">
            <h3>Seasonal Volume</h3>
            <p>Current vs previous period</p>
          </div>
          <div className="comparisons-chart-body">
            {!seasonalSeries.hasData ? (
              <div className="comparisons-empty">No seasonal volume data for this range.</div>
            ) : null}
            <canvas ref={canvasRefs.seasonal} id="comparisonSeasonal"></canvas>
          </div>
        </div>
      </section>

      <section className="comparisons-section">
        <div className="comparisons-section__header">
          <h2>Best Power Comparison</h2>
          <p>Current range vs comparison range</p>
        </div>
        <div className="comparisons-card">
          {powerCurveComparison && bestPowerRows ? (
            <>
              <div className="comparisons-best-meta">
                <span>Current: {powerCurveComparison.currentLabel || 'Selected Range'}</span>
                <span>Previous: {powerCurveComparison.previousLabel || 'Previous Range'}</span>
              </div>
              <div className="comparisons-best-table">
                <div className="comparisons-best-row comparisons-best-row--header">
                  <span>Duration</span>
                  <span>Current</span>
                  <span>Previous</span>
                  <span>Delta</span>
                </div>
                {bestPowerRows.map((row) => {
                  const deltaClass = Number.isFinite(row.delta) ? (row.delta >= 0 ? 'positive' : 'negative') : '';
                  return (
                    <div className="comparisons-best-row" key={row.label}>
                      <span>{row.label}</span>
                      <span>{formatWatts(row.current)}</span>
                      <span>{formatWatts(row.previous)}</span>
                      <span className={`comparisons-best-delta ${deltaClass}`}>{formatDelta(row.delta)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="comparisons-empty">Loading best power comparison...</div>
          )}
        </div>
      </section>
    </div>
  );
};

const createGradient = (ctx, hex) => {
  if (!ctx) return hexToRgba(hex, 0.15);
  const gradient = ctx.createLinearGradient(0, 0, 0, 320);
  gradient.addColorStop(0, hexToRgba(hex, 0.3));
  gradient.addColorStop(1, hexToRgba(hex, 0.02));
  return gradient;
};

const hexToRgba = (hex, alpha = 1) => {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default ComparisonsApp;
