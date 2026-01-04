import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import CONFIG from '../../../static/js/pages/training-load/config.js';

const RANGE_OPTIONS = [30, 60, 90, 180, 365];

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatNumber = (value, decimals = 0) => {
  if (!Number.isFinite(value)) return '—';
  return Number(value).toFixed(decimals);
};

const formatDelta = (value, decimals = 1) => {
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return '±0.0';
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(decimals)}`;
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatWeekLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const start = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 6);
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${start} – ${endLabel}`;
};

const getWeekStart = (date) => {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  result.setUTCDate(result.getUTCDate() + diff);
  result.setUTCHours(0, 0, 0, 0);
  return result;
};

const getTsbStatus = (tsb) => {
  if (tsb >= 15) {
    return { label: 'Peak Freshness', description: 'You are primed for breakthrough performances.', badgeClass: 'tl-pill--success' };
  }
  if (tsb >= 5) {
    return { label: 'Fresh & Ready', description: 'Ideal window for quality sessions or race efforts.', badgeClass: 'tl-pill--success' };
  }
  if (tsb >= -5) {
    return { label: 'Productive Load', description: 'You are balancing stress and recovery well.', badgeClass: 'tl-pill--primary' };
  }
  if (tsb >= -15) {
    return { label: 'Accumulating Fatigue', description: 'Plan lighter days soon to consolidate gains.', badgeClass: 'tl-pill--warning' };
  }
  return { label: 'Critical Fatigue', description: 'Immediate recovery focus advised before hard training.', badgeClass: 'tl-pill--danger' };
};

const normaliseResponse = (source) => {
  if (!source) return [];
  const collected = [];

  const pushEntry = (entry) => {
    if (!entry) return;
    const rawDate = entry.date || entry.day || entry.timestamp;
    const parsedDate = rawDate ? new Date(rawDate) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) return;

    collected.push({
      date: parsedDate.toISOString(),
      ctl: toNumber(entry.ctl ?? entry.CTL),
      atl: toNumber(entry.atl ?? entry.ATL),
      tsb: toNumber(entry.tsb ?? entry.TSB),
      tss: toNumber(entry.tss ?? entry.TSS ?? entry.load),
      distance: toNumber(entry.distance ?? 0)
    });
  };

  const handleArray = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(pushEntry);
  };

  if (Array.isArray(source)) {
    handleArray(source);
  } else if (typeof source === 'object') {
    handleArray(source.history);
    handleArray(source.daily);
    handleArray(source.timeseries);
    handleArray(source.data);
    if (source.current) {
      pushEntry({ ...source.current, date: new Date().toISOString() });
    }
  }

  collected.sort((a, b) => new Date(a.date) - new Date(b.date));
  return collected.filter((entry, index, array) => {
    if (!entry.date) return false;
    const prev = array[index - 1];
    return !prev || prev.date !== entry.date;
  });
};

const findEntryDaysAgo = (data, days) => {
  if (!data.length) return null;
  const target = Date.now() - (days * 24 * 60 * 60 * 1000);
  let closest = null;
  let smallestDiff = Infinity;

  data.forEach((entry) => {
    const diff = Math.abs(new Date(entry.date).getTime() - target);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closest = entry;
    }
  });

  return closest;
};

const calculateRollingSum = (data, days, field) => {
  const recent = data.slice(-days);
  return recent.reduce((sum, entry) => sum + (entry[field] || 0), 0);
};

const calculateDistribution = (data) => {
  const distribution = {
    easy: 0,
    steady: 0,
    intense: 0,
    easyCount: 0,
    steadyCount: 0,
    intenseCount: 0,
    total: 0
  };

  data.forEach((entry) => {
    const tss = Number(entry.tss) || 0;
    distribution.total += tss;

    if (tss >= 100) {
      distribution.intense += tss;
      distribution.intenseCount += 1;
    } else if (tss >= 50) {
      distribution.steady += tss;
      distribution.steadyCount += 1;
    } else {
      distribution.easy += tss;
      distribution.easyCount += 1;
    }
  });

  const total = distribution.easy + distribution.steady + distribution.intense || 1;
  return {
    ...distribution,
    easyPct: (distribution.easy / total) * 100,
    steadyPct: (distribution.steady / total) * 100,
    intensePct: (distribution.intense / total) * 100
  };
};

const buildWeeklyBuckets = (data) => {
  const buckets = new Map();

  data.forEach((entry) => {
    const date = new Date(entry.date);
    if (Number.isNaN(date.getTime())) return;

    const start = getWeekStart(date);
    const key = start.toISOString();

    if (!buckets.has(key)) {
      buckets.set(key, {
        start,
        tss: 0,
        ctl: 0,
        atl: 0,
        tsb: 0,
        count: 0
      });
    }

    const bucket = buckets.get(key);
    bucket.tss += entry.tss || 0;
    bucket.ctl += entry.ctl || 0;
    bucket.atl += entry.atl || 0;
    bucket.tsb += entry.tsb || 0;
    bucket.count += 1;
  });

  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      ctlAvg: bucket.count ? bucket.ctl / bucket.count : 0,
      atlAvg: bucket.count ? bucket.atl / bucket.count : 0,
      tsbAvg: bucket.count ? bucket.tsb / bucket.count : 0
    }))
    .sort((a, b) => a.start - b.start);
};

const calculateVolatility = (weeklyBuckets) => {
  if (!weeklyBuckets.length) {
    return { label: 'Insufficient data', changePct: 0 };
  }

  const values = weeklyBuckets.map((bucket) => bucket.tss);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length || 0;
  if (!mean) {
    return { label: 'Stable', changePct: 0 };
  }

  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const changePct = (stdDev / mean) * 100;

  let label = 'Stable progression';
  if (changePct > 25) label = 'Volatile load pattern';
  else if (changePct > 15) label = 'Moderate variability';

  return { label, changePct };
};

const calculateLongestBuildStreak = (data) => {
  let streak = 0;
  let longest = 0;

  data.forEach((entry) => {
    if ((entry.tss || 0) >= 50) {
      streak += 1;
      longest = Math.max(longest, streak);
    } else {
      streak = 0;
    }
  });

  return longest;
};

const calculateTrainingStreak = (data) => {
  let streak = 0;
  for (let i = data.length - 1; i >= 0; i -= 1) {
    if ((data[i].tss || 0) > 0) streak += 1;
    else break;
  }
  return streak;
};

const computeMetrics = (data, periodDays) => {
  if (!Array.isArray(data) || !data.length) {
    return { hasData: false };
  }

  const latest = data[data.length - 1];
  const previous = data[Math.max(0, data.length - 2)];
  const ctlChangeShort = latest.ctl - (findEntryDaysAgo(data, 14)?.ctl ?? previous.ctl);
  const atlChangeShort = latest.atl - (findEntryDaysAgo(data, 7)?.atl ?? previous.atl);

  const rollingTss7 = calculateRollingSum(data, 7, 'tss');
  const loadDistribution = calculateDistribution(data);
  const weeklyBuckets = buildWeeklyBuckets(data);

  const weeklyTrend = weeklyBuckets.map((bucket, index) => {
    const previousBucket = weeklyBuckets[index - 1];
    const delta = previousBucket ? bucket.tss - previousBucket.tss : 0;
    return {
      label: formatWeekLabel(bucket.start),
      load: Number(bucket.tss.toFixed(1)),
      delta: Number(delta.toFixed(1))
    };
  });

  const acuteChronicRatio = latest.ctl > 0 ? latest.atl / latest.ctl : 0;
  const tsbStatus = getTsbStatus(latest.tsb);
  const volatilityScore = calculateVolatility(weeklyBuckets);
  const longestBuildStreak = calculateLongestBuildStreak(data);
  const lightDaysUpcoming = loadDistribution.easyCount >= 1 ? 0 : 2;

  return {
    hasData: true,
    periodDays,
    current: { ctl: latest.ctl, atl: latest.atl, tsb: latest.tsb },
    latest,
    previous,
    ctlChangeShort,
    atlChangeShort,
    rollingTss7,
    loadDistribution,
    heavyDays: loadDistribution.intenseCount,
    moderateDays: loadDistribution.steadyCount,
    acuteChronicRatio,
    tsbStatus,
    weeklyTrend,
    volatilityScore,
    longestBuildStreak,
    lightDaysUpcoming,
    trainingStreak: calculateTrainingStreak(data)
  };
};

const TrainingLoadApp = () => {
  const defaultRange = CONFIG?.charts?.trainingLoad?.defaultRange ?? 90;
  const initialRange = RANGE_OPTIONS.includes(defaultRange) ? defaultRange : 90;

  const [currentDays, setCurrentDays] = useState(initialRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState({ hasData: false });
  const [polarizedDistribution, setPolarizedDistribution] = useState(null);
  const forceRefreshRef = useRef(false);

  const mainChartRef = useRef(null);
  const gaugeChartRef = useRef(null);
  const sparklineCharts = useRef({});

  const mainCanvasRef = useRef(null);
  const gaugeCanvasRef = useRef(null);
  const ctlSparkRef = useRef(null);
  const atlSparkRef = useRef(null);
  const tsbSparkRef = useRef(null);

  const fetchData = useCallback(async (days, forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const [response, polarized] = await Promise.all([
        Services.data.getTrainingLoad({ days, forceRefresh }),
        Services.data.getPolarizedDistribution({ days: Math.min(30, days), forceRefresh }).catch(() => null)
      ]);

      const normalised = normaliseResponse(response);
      setData(normalised);
      setMetrics(computeMetrics(normalised, days));
      setPolarizedDistribution(polarized);
    } catch (err) {
      setError(err);
      Services.analytics.trackError('training_load_load', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Services.analytics.trackPageView('training-load');
  }, []);

  useEffect(() => {
    const forceRefresh = forceRefreshRef.current;
    forceRefreshRef.current = false;
    fetchData(currentDays, forceRefresh);
  }, [fetchData, currentDays]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.feather) {
      window.feather.replace();
    }
  }, [metrics, polarizedDistribution]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart || !metrics?.hasData) {
      if (mainChartRef.current) {
        mainChartRef.current.destroy();
        mainChartRef.current = null;
      }
      return;
    }

    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    if (mainChartRef.current) {
      mainChartRef.current.destroy();
      mainChartRef.current = null;
    }

    const labels = data.map((entry) => formatDate(entry.date));
    const ctlValues = data.map((entry) => entry.ctl || 0);
    const atlValues = data.map((entry) => entry.atl || 0);
    const tsbValues = data.map((entry) => entry.tsb || 0);

    mainChartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'CTL (Fitness)',
            data: ctlValues,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5
          },
          {
            label: 'ATL (Fatigue)',
            data: atlValues,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5
          },
          {
            label: 'TSB (Form)',
            data: tsbValues,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            fill: false,
            borderWidth: 2,
            borderDash: [5, 3],
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            padding: 12,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 11 }, color: '#6b7280' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, color: '#6b7280', maxRotation: 0 }
          }
        }
      }
    });
  }, [data, metrics?.hasData]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart || !metrics?.hasData) {
      if (gaugeChartRef.current) {
        gaugeChartRef.current.destroy();
        gaugeChartRef.current = null;
      }
      return;
    }

    const canvas = gaugeCanvasRef.current;
    if (!canvas) return;

    const tsb = metrics.current.tsb || 0;
    const gaugeValue = Math.max(0, Math.min(100, ((tsb + 30) / 55) * 100));

    let gaugeColor;
    if (tsb >= 15) gaugeColor = '#10b981';
    else if (tsb >= 5) gaugeColor = '#3b82f6';
    else if (tsb >= -5) gaugeColor = '#6366f1';
    else if (tsb >= -15) gaugeColor = '#f59e0b';
    else gaugeColor = '#ef4444';

    if (gaugeChartRef.current) {
      gaugeChartRef.current.destroy();
      gaugeChartRef.current = null;
    }

    gaugeChartRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [gaugeValue, 100 - gaugeValue],
          backgroundColor: [gaugeColor, '#e5e7eb'],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '75%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
  }, [metrics?.hasData, metrics?.current]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart || !data.length) return;

    const last30 = data.slice(-30);
    const createSparkline = (canvas, field, color, key) => {
      if (!canvas) return;
      const values = last30.map((d) => d[field] || 0);
      if (sparklineCharts.current[key]) {
        sparklineCharts.current[key].destroy();
      }
      sparklineCharts.current[key] = new Chart(canvas, {
        type: 'line',
        data: {
          labels: last30.map(() => ''),
          datasets: [{
            data: values,
            borderColor: color,
            backgroundColor: `${color}20`,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } }
        }
      });
    };

    createSparkline(ctlSparkRef.current, 'ctl', '#3b82f6', 'ctl');
    createSparkline(atlSparkRef.current, 'atl', '#f59e0b', 'atl');
    createSparkline(tsbSparkRef.current, 'tsb', '#10b981', 'tsb');
  }, [data]);

  useEffect(() => () => {
    if (mainChartRef.current) mainChartRef.current.destroy();
    if (gaugeChartRef.current) gaugeChartRef.current.destroy();
    Object.values(sparklineCharts.current).forEach((chart) => chart?.destroy());
    sparklineCharts.current = {};
  }, []);

  const handleRangeChange = (days) => {
    if (!Number.isFinite(days) || days === currentDays) return;
    forceRefreshRef.current = true;
    setCurrentDays(days);
  };

  if (loading) {
    return (
      <div className="tl-dashboard">
        <div
          dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'chart', count: 2 }) }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="tl-empty">
        <i data-feather="alert-triangle"></i>
        <h3>Training load unavailable</h3>
        <p>{error?.message || 'Failed to load training load data'}</p>
      </div>
    );
  }

  if (!metrics?.hasData) {
    return (
      <div className="tl-empty">
        <i data-feather="slash"></i>
        <h3>No training load data</h3>
        <p>Log rides or import workouts to unlock fitness, fatigue, and form analytics.</p>
      </div>
    );
  }

  const { current, ctlChangeShort, atlChangeShort, tsbStatus, loadDistribution, weeklyTrend, volatilityScore, longestBuildStreak, trainingStreak, acuteChronicRatio } = metrics;
  const weekly = data.slice(-7);
  const weeklyAvg = weekly.reduce((sum, d) => sum + (d.tss || 0), 0) / 7;
  const rampRate = weekly.length >= 7 ? (weekly[6].ctl - weekly[0].ctl) : 0;

  const weeklyCards = weeklyTrend && weeklyTrend.length >= 2
    ? weeklyTrend.slice(-4)
    : [];

  const polarized = polarizedDistribution;
  const low = polarized ? Number(polarized.zone_1_2_seconds || 0) : 0;
  const mid = polarized ? Number(polarized.zone_3_4_seconds || 0) : 0;
  const high = polarized ? Number(polarized.zone_5_plus_seconds || 0) : 0;
  const total = low + mid + high;
  const lowPct = total ? Math.round((low / total) * 100) : 0;
  const midPct = total ? Math.round((mid / total) * 100) : 0;
  const highPct = total ? Math.round((high / total) * 100) : 0;

  return (
    <div className="tl-dashboard">
      <div className="tl-topbar">
        <div className="tl-topbar-left">
          <h1 className="tl-page-title">Training Load</h1>
          <div className="tl-breadcrumb">
            <span className={`tl-badge ${tsbStatus.badgeClass}`}>{tsbStatus.label}</span>
            <span className="tl-badge tl-badge-muted">{trainingStreak}d streak</span>
            <span className="tl-badge tl-badge-muted">{currentDays}d view</span>
          </div>
        </div>
        <div className="tl-topbar-controls">
          {RANGE_OPTIONS.map((days) => (
            <button
              key={days}
              className={`tl-range-pill ${currentDays === days ? 'active' : ''}`}
              type="button"
              onClick={() => handleRangeChange(days)}
            >
              {days <= 360 ? `${days}d` : '1y'}
            </button>
          ))}
        </div>
      </div>

      <div className="tl-main-grid">
        <div className="tl-left-column">
          <div className="tl-gauge-widget">
            <div className="tl-widget-header">
              <h3>Current Form</h3>
              <span className={`tl-widget-badge ${tsbStatus.badgeClass}`}>{tsbStatus.label}</span>
            </div>
            <div className="tl-gauge-wrapper">
              <canvas id="tl-form-gauge" ref={gaugeCanvasRef}></canvas>
              <div className="tl-gauge-center">
                <div className="tl-gauge-value">{formatNumber(current.tsb, 1)}</div>
                <div className="tl-gauge-label">TSB</div>
              </div>
            </div>
            <p className="tl-gauge-desc">{tsbStatus.description}</p>
          </div>

          <div className="tl-quick-grid">
            <div className="tl-stat-mini">
              <div className="tl-stat-mini-label">7d TSS Avg</div>
              <div className="tl-stat-mini-value">{formatNumber(weeklyAvg, 0)}</div>
            </div>
            <div className="tl-stat-mini">
              <div className="tl-stat-mini-label">Ramp Rate</div>
              <div className="tl-stat-mini-value">{rampRate > 0 ? '+' : ''}{formatNumber(rampRate, 1)}</div>
            </div>
            <div className="tl-stat-mini">
              <div className="tl-stat-mini-label">ATL/CTL</div>
              <div className="tl-stat-mini-value">{formatNumber(acuteChronicRatio, 2)}</div>
            </div>
          </div>
        </div>

        <div className="tl-center-column">
          <div className="tl-chart-widget">
            <div className="tl-widget-header">
              <h3>Load Timeline</h3>
              <div className="tl-chart-legend">
                <span className="tl-legend-item"><i style={{ background: '#3b82f6' }}></i>CTL</span>
                <span className="tl-legend-item"><i style={{ background: '#f59e0b' }}></i>ATL</span>
                <span className="tl-legend-item"><i style={{ background: '#10b981' }}></i>TSB</span>
              </div>
            </div>
            <div className="tl-chart-canvas-wrapper">
              <canvas id="tl-main-chart" ref={mainCanvasRef}></canvas>
            </div>
          </div>
        </div>

        <div className="tl-right-column">
          <div className="tl-metric-tile" data-color="blue">
            <div className="tl-metric-tile-header">
              <span className="tl-metric-tile-label">Fitness</span>
              <span className="tl-metric-tile-change">{formatDelta(ctlChangeShort)}</span>
            </div>
            <div className="tl-metric-tile-value">{formatNumber(current.ctl, 1)}</div>
            <div className="tl-metric-tile-chart">
              <canvas ref={ctlSparkRef}></canvas>
            </div>
            <div className="tl-metric-tile-footer">Chronic Training Load</div>
          </div>

          <div className="tl-metric-tile" data-color="orange">
            <div className="tl-metric-tile-header">
              <span className="tl-metric-tile-label">Fatigue</span>
              <span className="tl-metric-tile-change">{formatDelta(atlChangeShort)}</span>
            </div>
            <div className="tl-metric-tile-value">{formatNumber(current.atl, 1)}</div>
            <div className="tl-metric-tile-chart">
              <canvas ref={atlSparkRef}></canvas>
            </div>
            <div className="tl-metric-tile-footer">Acute Training Load</div>
          </div>

          <div className="tl-metric-tile" data-color="green">
            <div className="tl-metric-tile-header">
              <span className="tl-metric-tile-label">Form</span>
              <span className="tl-metric-tile-change">TSB</span>
            </div>
            <div className="tl-metric-tile-value">{formatNumber(current.tsb, 1)}</div>
            <div className="tl-metric-tile-chart">
              <canvas ref={tsbSparkRef}></canvas>
            </div>
            <div className="tl-metric-tile-footer">Training Stress Balance</div>
          </div>
        </div>
      </div>

      <div className="tl-bottom-section">
        {weeklyCards.length ? (
          <div className="tl-weekly-strip">
            <h3 className="tl-section-title">Last 4 Weeks</h3>
            <div className="tl-week-grid">
              {weeklyCards.map((week) => (
                <div key={week.label} className="tl-week-card">
                  <div className="tl-week-label">{week.label}</div>
                  <div className="tl-week-value">{week.load}</div>
                  <div className={`tl-week-delta ${week.delta >= 0 ? 'positive' : 'negative'}`}>
                    {week.delta > 0 ? '+' : ''}{week.delta}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="tl-insights-grid">
          <div className="tl-insight-card">
            <div className="tl-insight-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <i data-feather="bar-chart-2"></i>
            </div>
            <div className="tl-insight-content">
              <h4>Load Distribution</h4>
              <p>
                Easy {formatNumber(loadDistribution.easyPct, 0)}% · Productive {formatNumber(loadDistribution.steadyPct, 0)}% · Heavy {formatNumber(loadDistribution.intensePct, 0)}%
              </p>
            </div>
          </div>

          <div className="tl-insight-card">
            <div className="tl-insight-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
              <i data-feather="trending-up"></i>
            </div>
            <div className="tl-insight-content">
              <h4>Consistency</h4>
              <p>{volatilityScore.label} – {formatNumber(volatilityScore.changePct, 1)}% week-to-week variability</p>
            </div>
          </div>

          <div className="tl-insight-card">
            <div className="tl-insight-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
              <i data-feather="zap"></i>
            </div>
            <div className="tl-insight-content">
              <h4>Build Streak</h4>
              <p>{longestBuildStreak} consecutive productive days detected in this period</p>
            </div>
          </div>

          {polarized ? (
            <div className="tl-insight-card">
              <div className="tl-insight-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)' }}>
                <i data-feather="layers"></i>
              </div>
              <div className="tl-insight-content">
                <h4>Polarized Distribution</h4>
                <p>{lowPct}% low · {midPct}% mid · {highPct}% high</p>
                <div className="tl-polarized-bar">
                  <span style={{ width: `${lowPct}%` }} className="tl-polarized-bar__low"></span>
                  <span style={{ width: `${midPct}%` }} className="tl-polarized-bar__mid"></span>
                  <span style={{ width: `${highPct}%` }} className="tl-polarized-bar__high"></span>
                </div>
                <div className="tl-polarized-score">Polarization score: {formatNumber(polarized.polarized_score, 1)}%</div>
              </div>
            </div>
          ) : (
            <div className="tl-insight-card">
              <div className="tl-insight-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)' }}>
                <i data-feather="layers"></i>
              </div>
              <div className="tl-insight-content">
                <h4>Polarized Distribution</h4>
                <p>Upload power zone data to unlock this metric.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainingLoadApp;
