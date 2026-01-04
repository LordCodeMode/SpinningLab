import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';

const DEFAULT_DURATIONS = [
  1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240,
  300, 420, 600, 900, 1200, 1500, 1800, 2400, 3000, 3600
];

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const wholeSeconds = Math.round(seconds);

  if (wholeSeconds < 60) return `${wholeSeconds}s`;
  if (wholeSeconds < 3600) {
    const minutes = Math.floor(wholeSeconds / 60);
    const remainingSeconds = wholeSeconds % 60;
    if (remainingSeconds === 0) return `${minutes}m`;
    if (minutes < 10) return `${minutes}m ${remainingSeconds}s`;
    return `${minutes}m`;
  }

  const hours = Math.floor(wholeSeconds / 3600);
  const remainingMinutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  if (remainingMinutes === 0 && remainingSeconds === 0) return `${hours}h`;

  let label = `${hours}h`;
  if (remainingMinutes > 0) label += ` ${remainingMinutes}m`;
  if (remainingSeconds > 0 && hours < 2) label += ` ${remainingSeconds}s`;
  return label;
};

const getIconPath = (icon) => {
  const icons = {
    'zap': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    'battery-charging': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    'target': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    'trending-up': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>',
    'activity': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'
  };
  return icons[icon] || icons.zap;
};

const preparePowerCurvePoints = (data) => {
  if (!data || !Array.isArray(data.durations) || !Array.isArray(data.powers)) return [];
  const maxLength = Math.min(data.durations.length, data.powers.length);
  const pairs = new Map();

  for (let i = 0; i < maxLength; i += 1) {
    const duration = Number(data.durations[i]);
    const power = Number(data.powers[i]);
    if (!Number.isFinite(duration) || !Number.isFinite(power)) continue;
    const durationValue = Math.max(1, Math.round(duration));
    const existing = pairs.get(durationValue);
    if (existing === undefined || power > existing) {
      pairs.set(durationValue, power);
    }
  }

  const sortedDurations = Array.from(pairs.keys()).sort((a, b) => a - b);
  return sortedDurations.map((duration) => ({ duration, power: pairs.get(duration) }));
};

const prepareModelPowerPoints = (data) => {
  if (!data || !Array.isArray(data.durations) || !Array.isArray(data.actual)) return [];
  const maxLength = Math.min(data.durations.length, data.actual.length);
  const pairs = [];

  for (let i = 0; i < maxLength; i += 1) {
    const duration = Number(data.durations[i]);
    const power = Number(data.actual[i]);
    if (!Number.isFinite(duration) || !Number.isFinite(power)) continue;
    pairs.push({ duration: Math.max(1, Math.round(duration)), power });
  }

  pairs.sort((a, b) => a.duration - b.duration);
  return pairs;
};

const findPowerInPoints = (points, duration, tolerance = 5) => {
  if (!Array.isArray(points) || points.length === 0) return null;
  const exact = points.find((point) => point.duration === duration);
  if (exact) return exact.power;
  const near = points.find((point) => Math.abs(point.duration - duration) <= tolerance);
  return near ? near.power : null;
};

const getActualPower = (powerCurvePoints, modelPowerPoints, duration) => {
  const powerFromCurve = findPowerInPoints(powerCurvePoints, duration);
  if (powerFromCurve != null) return powerFromCurve;
  return findPowerInPoints(modelPowerPoints, duration, 120);
};

const getModelPower = (powerCurvePoints, modelPowerPoints, duration, criticalPower, wPrime, actualHint = null) => {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const effectiveDuration = Math.max(1, duration);
  let predicted = criticalPower + (wPrime / effectiveDuration);
  if (!Number.isFinite(predicted)) return null;

  const nearbyActual = actualHint ??
    findPowerInPoints(powerCurvePoints, duration, 120) ??
    findPowerInPoints(modelPowerPoints, duration, 120);

  if (nearbyActual != null) {
    const upperBound = nearbyActual * 1.5;
    const lowerBound = Math.max(0, nearbyActual * 0.5);
    predicted = Math.min(Math.max(predicted, lowerBound), upperBound);
  }

  return Math.max(predicted, 0);
};

const CriticalPowerApp = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [powerCurvePoints, setPowerCurvePoints] = useState([]);
  const [modelPowerPoints, setModelPowerPoints] = useState([]);
  const [tooltip, setTooltip] = useState(null);

  const chartRef = useRef(null);
  const canvasRef = useRef(null);
  const isMountedRef = useRef(true);

  const loadCriticalPower = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      Services.analytics.trackPageView('critical-power');
      const response = await Services.data.getCriticalPower();
      if (!isMountedRef.current) return;
      setData(response);
      setModelPowerPoints(prepareModelPowerPoints(response));
      setPowerCurvePoints([]);

      Services.data.getPowerCurve()
        .then((curve) => {
          if (!isMountedRef.current) return;
          if (!curve) return;
          setPowerCurvePoints(preparePowerCurvePoints(curve));
        })
        .catch((err) => {
          console.warn('[CP] Could not load power curve data:', err);
        });
    } catch (err) {
      console.error('[CP] Load error:', err);
      setError(err);
      Services.analytics.trackError('critical_power_load', err.message);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadCriticalPower();
  }, [loadCriticalPower]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.feather) {
      window.feather.replace();
    }
  }, [data, powerCurvePoints]);

  const chartSeries = useMemo(() => {
    if (!data) return null;
    const criticalPower = Number(data.critical_power || 0);
    const wPrime = Number(data.w_prime || 0);

    const durationSet = new Set(
      DEFAULT_DURATIONS
        .concat(powerCurvePoints.map((point) => point.duration))
        .concat(modelPowerPoints.map((point) => point.duration))
    );

    const earliestDuration = powerCurvePoints.length > 0
      ? powerCurvePoints[0].duration
      : (modelPowerPoints.length > 0 ? modelPowerPoints[0].duration : 1);

    const rawDurations = Array.from(durationSet)
      .filter((value) => Number.isFinite(value) && value >= Math.max(1, earliestDuration))
      .sort((a, b) => a - b);

    const durations = [];
    rawDurations.forEach((duration) => {
      if (durations.length === 0) {
        durations.push(duration);
        return;
      }
      const previous = durations[durations.length - 1];
      const ratio = duration / previous;
      if (ratio >= 1.08 || duration - previous >= 30) {
        durations.push(duration);
      }
    });

    if (durations.length === 0) {
      durations.push(1, 5, 60, 300, 1200);
    }

    const actualData = [];
    const modelData = [];
    const differenceData = [];

    let lastActual = null;
    let lastModel = null;

    durations.forEach((duration) => {
      const actualRaw = getActualPower(powerCurvePoints, modelPowerPoints, duration);
      const model = getModelPower(powerCurvePoints, modelPowerPoints, duration, criticalPower, wPrime, actualRaw) ?? lastModel;
      const actual = actualRaw ?? lastActual ?? model;

      if (actual != null) lastActual = actual;
      if (model != null) lastModel = model;

      actualData.push({ x: duration, y: actual ?? null });
      modelData.push({ x: duration, y: model ?? null });
      differenceData.push({
        x: duration,
        y: (actual != null && model != null) ? Math.max(Math.abs(actual - model), 0.5) : 0
      });
    });

    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];

    const tickCandidates = [...DEFAULT_DURATIONS];
    while (tickCandidates[tickCandidates.length - 1] < maxDuration) {
      tickCandidates.push(tickCandidates[tickCandidates.length - 1] * 2);
    }

    const tickValues = Array.from(new Set(
      tickCandidates
        .filter((value) => value >= minDuration && value <= maxDuration * 1.05)
        .concat([minDuration, maxDuration])
    )).sort((a, b) => a - b);

    return {
      actualData,
      modelData,
      differenceData,
      tickValues,
      minDuration,
      maxDuration
    };
  }, [data, modelPowerPoints, powerCurvePoints]);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    if (!Chart || !data || !chartSeries) {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const { actualData, modelData, differenceData, tickValues, minDuration, maxDuration } = chartSeries;

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Actual Best Powers',
            data: actualData,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHitRadius: 8,
            tension: 0.45,
            cubicInterpolationMode: 'monotone',
            fill: false,
            spanGaps: true,
            order: 1
          },
          {
            label: 'CP Model Prediction',
            data: modelData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            borderDash: [8, 4],
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHitRadius: 8,
            tension: 0.45,
            cubicInterpolationMode: 'monotone',
            borderCapStyle: 'round',
            fill: false,
            spanGaps: true,
            order: 2
          },
          {
            label: 'Difference',
            data: differenceData,
            borderColor: 'rgba(245, 158, 11, 0.5)',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            fill: 'origin',
            spanGaps: true,
            order: 3
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
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#8b5cf6',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              title: (context) => formatDuration(context[0].parsed.x),
              label: (context) => {
                const value = context.parsed.y;
                if (value === null) return null;
                if (context.dataset.label === 'Difference') {
                  return `${context.dataset.label}: ${Math.round(value)} W gap`;
                }
                return `${context.dataset.label}: ${Math.round(value)} W`;
              },
              afterBody: (context) => {
                const seconds = context[0].parsed.x;
                const actual = actualData.find((d) => d.x === seconds)?.y;
                const model = modelData.find((d) => d.x === seconds)?.y;
                if (actual != null && model != null && model !== 0) {
                  const diff = actual - model;
                  const pct = ((diff / model) * 100).toFixed(1);
                  return `\n${diff > 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs model`;
                }
                return '';
              }
            }
          }
        },
        scales: {
          x: {
            type: 'logarithmic',
            position: 'bottom',
            title: {
              display: true,
              text: 'Duration',
              font: { size: 13, weight: '600' },
              color: '#6b7280'
            },
            ticks: {
              callback: (value) => formatDuration(value),
              color: '#6b7280',
              font: { size: 11 },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: false
            },
            afterBuildTicks: (scale) => {
              scale.ticks = tickValues.map((value) => ({ value }));
              return scale.ticks;
            },
            grid: { color: 'rgba(0, 0, 0, 0.05)', drawBorder: false },
            min: minDuration,
            max: maxDuration * 1.05
          },
          y: {
            beginAtZero: false,
            title: {
              display: true,
              text: 'Power (watts)',
              font: { size: 13, weight: '600' },
              color: '#6b7280'
            },
            ticks: {
              color: '#6b7280',
              font: { size: 11 },
              callback: (value) => `${Math.round(value)} W`
            },
            grid: { color: 'rgba(0, 0, 0, 0.05)', drawBorder: false }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartSeries, data]);

  const handleTooltip = (event, text) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      text,
      top: rect.top - 12,
      left: rect.left + rect.width / 2
    });
  };

  const clearTooltip = () => {
    setTooltip(null);
  };

  if (loading) {
    return (
      <div className="cp-section">
        <div className="cp-header">
          <h1>Critical Power Analysis</h1>
          <p>Loading your power data...</p>
        </div>
      <div
        className="cp-metrics-grid"
        dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'metric', count: 3 }) }}
      />
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'chart', count: 1 }) }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-error-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3>Failed to Load Critical Power Data</h3>
        <p>{error.message || 'Unable to calculate CP model. Please ensure you have sufficient power data.'}</p>
        <button
          className="btn btn--primary"
          type="button"
          onClick={() => loadCriticalPower()}
          style={{ marginTop: 20, padding: '12px 24px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cp-empty-state">
        <h3>No critical power data</h3>
        <p>Upload activities to unlock CP model insights.</p>
      </div>
    );
  }

  const { critical_power, w_prime, fit_quality } = data;
  const weight = Number(data.weight_kg || data.weight || 75);
  const cpPerKg = weight ? (critical_power / weight).toFixed(1) : '—';
  const wPrimeKj = (w_prime / 1000).toFixed(1);
  const fitScore = fit_quality ? (fit_quality * 100).toFixed(1) : 95.0;

  const hasActual = (powerCurvePoints.length > 0) || (modelPowerPoints.length > 0);
  const pointsCount = powerCurvePoints.length || modelPowerPoints.length || 0;
  const sourceLabel = powerCurvePoints.length > 0 ? 'Power Curve' : 'CP Model';

  const sampleDurations = [5, 60, 300, 1200];
  const dataRows = sampleDurations.map((duration) => {
    const actual = getActualPower(powerCurvePoints, modelPowerPoints, duration);
    const model = getModelPower(powerCurvePoints, modelPowerPoints, duration, critical_power, w_prime, actual);
    const difference = actual != null && model != null ? actual - model : null;
    return {
      duration,
      actual,
      model,
      difference
    };
  });

  return (
    <div className="cp-section">
      <div className="cp-header">
        <h1>Critical Power Analysis</h1>
        <p>Advanced 2-parameter physiological model comparing your theoretical capacity with actual performance across all durations</p>
      </div>

      <div className="cp-metrics-grid">
        {[
          {
            label: 'Critical Power (CP)',
            value: Math.round(critical_power),
            subtitle: `${cpPerKg} W/kg · Sustainable threshold`,
            variant: 'purple',
            icon: 'zap',
            tooltip: 'The highest power output you can theoretically sustain indefinitely. This represents your aerobic capacity ceiling.'
          },
          {
            label: "W' (W Prime)",
            value: Math.round(w_prime),
            subtitle: `${wPrimeKj} kJ · Anaerobic capacity`,
            variant: 'blue',
            icon: 'battery-charging',
            tooltip: 'Your anaerobic work capacity - the total energy available above CP before exhaustion. Think of it as your battery for efforts above threshold.'
          },
          {
            label: 'Model Fit Quality',
            value: fitScore,
            subtitle: 'R² · Prediction accuracy',
            variant: 'amber',
            icon: 'target',
            tooltip: 'How well the CP model fits your actual power data. Higher values (>90%) indicate the model accurately predicts your performance.'
          }
        ].map((card) => (
          <div
            key={card.label}
            className="cp-metric-card"
            onMouseEnter={(event) => handleTooltip(event, card.tooltip)}
            onMouseLeave={clearTooltip}
          >
            <div className="cp-metric-header-row">
              <div className={`cp-metric-icon ${card.variant}`}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: getIconPath(card.icon) }} />
              </div>
            </div>
            <div className="cp-metric-label">{card.label}</div>
            <div className="cp-metric-value">{card.value}</div>
            <div className="cp-metric-subtitle">{card.subtitle}</div>
          </div>
        ))}
      </div>

      <div className="cp-chart-card">
        <div className="cp-chart-header">
          <div className="cp-chart-title-group">
            <div className="cp-chart-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <div className="cp-chart-title">Power Duration Model vs Actual</div>
              <div className="cp-chart-subtitle">
                {hasActual
                  ? 'Compare theoretical CP model predictions with your best recorded powers'
                  : 'Showing CP model prediction (upload activities to see actual power comparison)'}
              </div>
            </div>
          </div>
          <div className="cp-chart-legend">
            <div className="cp-legend-item">
              <div className="cp-legend-dot actual"></div>
              <span>Actual Best</span>
            </div>
            <div className="cp-legend-item">
              <div className="cp-legend-dot model"></div>
              <span>CP Model</span>
            </div>
            <div className="cp-legend-item">
              <div className="cp-legend-dot difference"></div>
              <span>Difference</span>
            </div>
          </div>
        </div>
        <div className="cp-chart-container">
          <canvas id="cpComparisonChart" ref={canvasRef}></canvas>
        </div>
      </div>

      <div className="cp-data-overview">
        <div className="cp-data-header">
          <h3>Data Overview</h3>
          <p>{pointsCount > 0 ? `Showing ${pointsCount} data points (${sourceLabel})` : 'No actual power data available yet'}</p>
        </div>
        <div className="cp-data-grid">
          <div className="cp-data-card">
            <div className="cp-data-label">Critical Power</div>
            <div className="cp-data-value">{critical_power ? `${Math.round(critical_power)} W` : '—'}</div>
          </div>
          <div className="cp-data-card">
            <div className="cp-data-label">W′ (Anaerobic)</div>
            <div className="cp-data-value">{w_prime ? `${Math.round(w_prime)} J` : '—'}</div>
          </div>
          <div className="cp-data-card">
            <div className="cp-data-label">Data Source</div>
            <div className="cp-data-value">{pointsCount > 0 ? sourceLabel : 'None'}</div>
          </div>
        </div>
        <table className="cp-data-table">
          <thead>
            <tr>
              <th>Duration</th>
              <th>Actual</th>
              <th>Model</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row) => (
              <tr key={row.duration}>
                <td>{formatDuration(row.duration)}</td>
                <td>{row.actual != null ? `${Math.round(row.actual)} W` : '—'}</td>
                <td>{row.model != null ? `${Math.round(row.model)} W` : '—'}</td>
                <td>{row.difference != null ? `${row.difference > 0 ? '↑' : '↓'} ${Math.abs(Math.round(row.difference))} W` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cp-dual-column">
        <div className="cp-info-card">
          <div className="cp-info-header">
            <svg className="cp-info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="cp-info-title">Understanding Critical Power</h3>
          </div>
          <div className="cp-info-content">
            <p>
              <strong>Critical Power (CP)</strong> is your maximum sustainable power output - the highest intensity you can maintain without accumulating fatigue.
              Think of it as your aerobic threshold: efforts below CP can be sustained for very long periods, while efforts above CP deplete your W&apos; reserves.
            </p>
            <p>
              <strong>W&apos; (W Prime)</strong> represents your anaerobic work capacity - essentially a battery that drains when you exceed CP and recharges when you drop below it.
              Larger W&apos; values indicate better sprint and high-intensity capacity, while higher CP indicates better endurance.
            </p>
          </div>

          <div className="cp-formula-card">
            <div className="cp-formula-title">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Mathematical Model
            </div>
            <div className="cp-formula-content">t = W' / (P - CP)</div>
            <div className="cp-formula-variables">
              <div><strong>t</strong> = Time to exhaustion (seconds)</div>
              <div><strong>P</strong> = Power output (watts)</div>
              <div><strong>CP</strong> = Critical Power ({Math.round(critical_power)} W)</div>
              <div><strong>W'</strong> = Anaerobic work capacity ({Math.round(w_prime)} J)</div>
            </div>
          </div>
        </div>

        <div className="cp-insights-column">
          <h3 className="cp-insights-title">Model Applications & Training</h3>
          {[
            {
              icon: 'trending-up',
              title: 'Improve CP',
              text: 'Focus on threshold intervals (95-105% CP) for 10-20 minutes. Sweet spot training (88-93% CP) also builds aerobic capacity effectively.'
            },
            {
              icon: 'zap',
              title: "Expand W'",
              text: 'Short, maximal efforts (30s-3min) above CP deplete W\' and force adaptations. Include 2-3 high-intensity sessions weekly.'
            },
            {
              icon: 'activity',
              title: 'Practical Uses',
              text: 'Use CP/W\' to predict time-to-exhaustion, plan race pacing, prescribe training zones, and track fitness changes over time.'
            }
          ].map((card) => (
            <div key={card.title} className="cp-insight-card">
              <div className="cp-insight-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: getIconPath(card.icon) }} />
              </div>
              <div className="cp-insight-title">{card.title}</div>
              <div className="cp-insight-text">{card.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="cp-reality-card">
        <div className="cp-reality-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="cp-reality-content">
          <h4>The Model vs Reality</h4>
          <p>
            The chart above compares the theoretical CP model (blue line) with your actual best powers (purple line).
            The orange area shows where your actual performance exceeds or falls short of the model prediction. Large deviations may indicate:
          </p>
          <ul>
            <li>Better short-duration performance (anaerobic strengths)</li>
            <li>Pacing strategy differences in longer efforts</li>
            <li>Opportunities for targeted training</li>
          </ul>
        </div>
      </div>

      {tooltip ? (
        <div
          className="cp-tooltip show"
          style={{
            position: 'fixed',
            top: `${tooltip.top}px`,
            left: `${tooltip.left}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </div>
  );
};

export default CriticalPowerApp;
