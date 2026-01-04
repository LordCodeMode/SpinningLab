import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';

const HR_ZONES = [
  { num: 1, id: 'Z1', name: 'Recovery', range: '<60% HRmax', color: '#fee2e2', description: 'Very light spin that promotes circulation and active recovery.' },
  { num: 2, id: 'Z2', name: 'Endurance', range: '60–70% HRmax', color: '#fecaca', description: 'Comfortable aerobic riding to build capillary density and durability.' },
  { num: 3, id: 'Z3', name: 'Tempo', range: '70–80% HRmax', color: '#fca5a5', description: 'Controlled pressure to raise steady-state fitness and muscular endurance.' },
  { num: 4, id: 'Z4', name: 'Threshold', range: '80–90% HRmax', color: '#f87171', description: 'Race-pace efforts that develop lactate clearance and resilience.' },
  { num: 5, id: 'Z5', name: 'Redline', range: '90–100% HRmax', color: '#ef4444', description: 'Maximal intensity for decisive attacks and finishing kick.' }
];

const RANGE_OPTIONS = [60, 180, 365, 'all'];

const formatNumber = (value, decimals = 0) => Number(value || 0).toFixed(decimals);

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
};

const extractZoneNumber = (label = '') => {
  const match = String(label).match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

const calculateBpmRange = (rangeStr, maxHR) => {
  if (!maxHR || !rangeStr) return '—';

  if (rangeStr.includes('<')) {
    const match = rangeStr.match(/<(\d+)%/);
    if (match) {
      const maxPercent = parseInt(match[1], 10);
      const maxBpm = Math.round(maxHR * (maxPercent / 100));
      return `<${maxBpm} bpm`;
    }
  }

  if (rangeStr.includes('>')) {
    const match = rangeStr.match(/>(\d+)%/);
    if (match) {
      const minPercent = parseInt(match[1], 10);
      const minBpm = Math.round(maxHR * (minPercent / 100));
      return `${minBpm}+ bpm`;
    }
  }

  const rangeMatch = rangeStr.match(/(\d+)–(\d+)%/);
  if (rangeMatch) {
    const minPercent = parseInt(rangeMatch[1], 10);
    const maxPercent = parseInt(rangeMatch[2], 10);
    const minBpm = Math.round(maxHR * (minPercent / 100));
    const maxBpm = Math.round(maxHR * (maxPercent / 100));
    return `${minBpm}–${maxBpm} bpm`;
  }

  return '—';
};

const HrZonesApp = () => {
  const [currentDays, setCurrentDays] = useState(60);
  const [raw, setRaw] = useState({});
  const [settings, setSettings] = useState({});
  const [zones, setZones] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const normaliseZones = useCallback((rawData) => {
    const map = new Map();

    if (Array.isArray(rawData?.zone_data)) {
      rawData.zone_data.forEach((zone) => {
        const num = extractZoneNumber(zone.zone_label);
        if (!num) return;
        const seconds = Math.max(0, Number(zone.seconds_in_zone) || 0);
        map.set(num, seconds);
      });
    } else if (Array.isArray(rawData?.zones)) {
      rawData.zones.forEach((zone) => {
        const num = extractZoneNumber(zone.name ?? zone.zone);
        if (!num) return;
        const seconds = Math.max(0, Number(zone.seconds ?? zone.minutes * 60) || 0);
        map.set(num, seconds);
      });
    }

    return HR_ZONES.map((meta) => ({
      ...meta,
      seconds: map.get(meta.num) || 0
    }));
  }, []);

  const getPeriodDays = useCallback((rawData) => {
    if (Number.isFinite(currentDays)) return currentDays;
    return Number(rawData?.period_days) || 365;
  }, [currentDays]);

  const computeMetrics = useCallback((zoneList, rawData, userSettings) => {
    const totalSeconds = zoneList.reduce((sum, zone) => sum + zone.seconds, 0);
    const safeTotal = totalSeconds || 1;
    const safeDays = Math.max(1, getPeriodDays(rawData));

    const zoneDetails = zoneList.map((zone) => ({
      ...zone,
      percent: (zone.seconds / safeTotal) * 100,
      displayName: `Z${zone.num} · ${zone.name}`,
      formattedTime: formatDuration(zone.seconds)
    }));

    const sorted = [...zoneDetails].sort((a, b) => b.seconds - a.seconds);
    const topZone = sorted[0] || zoneDetails[0];

    const lowSeconds = zoneDetails.filter((zone) => zone.num <= 2).reduce((sum, zone) => sum + zone.seconds, 0);
    const aerobicSeconds = zoneDetails.filter((zone) => zone.num === 2 || zone.num === 3).reduce((sum, zone) => sum + zone.seconds, 0);
    const tempoSeconds = zoneDetails.find((zone) => zone.num === 3)?.seconds || 0;
    const recoverySeconds = zoneDetails.find((zone) => zone.num === 1)?.seconds || 0;
    const thresholdSeconds = zoneDetails.find((zone) => zone.num === 4)?.seconds || 0;
    const redlineSeconds = zoneDetails.find((zone) => zone.num === 5)?.seconds || 0;
    const highSeconds = thresholdSeconds + redlineSeconds;

    const averageZoneNumber = zoneDetails.reduce((sum, zone) => sum + zone.num * zone.seconds, 0) / safeTotal;
    const polarizationRatio = tempoSeconds > 0 ? (lowSeconds + highSeconds) / tempoSeconds : 4;
    const polarizationScore = Math.round(Math.max(0, Math.min(4, polarizationRatio)) * 25);

    const totalHours = totalSeconds / 3600;
    const averageWeeklyHours = totalHours / (safeDays / 7);

    const maxHR = Number(userSettings?.hr_max ?? rawData?.max_hr ?? 180);
    const averageHR = rawData?.avg_hr || null;

    return {
      totalSeconds,
      totalHours,
      averageWeeklyHours,
      zoneDetails,
      topZone,
      maxHR,
      averageHR,
      recoveryPercent: (recoverySeconds / safeTotal) * 100,
      aerobicPercent: (aerobicSeconds / safeTotal) * 100,
      tempoPercent: (tempoSeconds / safeTotal) * 100,
      thresholdPercent: (thresholdSeconds / safeTotal) * 100,
      redlinePercent: (redlineSeconds / safeTotal) * 100,
      cardioLoadPercent: (highSeconds / safeTotal) * 100,
      redlineMinutes: redlineSeconds / 60,
      avgZoneLabel: `Z${averageZoneNumber.toFixed(1)}`,
      polarizationRatio,
      polarizationScore
    };
  }, [getPeriodDays]);

  const getRangeLabel = useCallback(() => {
    if (currentDays === 'all') return 'All time';
    if (currentDays === 365) return 'Last year';
    return `Last ${currentDays} days`;
  }, [currentDays]);

  const loadData = useCallback(async ({ days = currentDays, forceRefresh = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      Services.analytics.trackPageView('hr-zones');
      const [response, userSettings] = await Promise.all([
        Services.data.getHRZones({ days, forceRefresh }),
        Services.data.getSettings({ forceRefresh: true }).catch(() => ({}))
      ]);

      const normalized = normaliseZones(response);
      setRaw(response || {});
      setSettings(userSettings || {});
      setZones(normalized);
      setMetrics(computeMetrics(normalized, response, userSettings));
    } catch (err) {
      setError(err?.message || 'Failed to load heart rate zone data');
    } finally {
      setLoading(false);
    }
  }, [computeMetrics, currentDays, normaliseZones]);

  useEffect(() => {
    loadData({ days: currentDays });
  }, [currentDays, loadData]);

  useEffect(() => {
    if (!metrics || !metrics.zoneDetails?.length) return;
    const canvas = chartRef.current;
    const Chart = window.Chart;
    if (!canvas || !Chart) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const data = {
      labels: metrics.zoneDetails.map((zone) => zone.displayName),
      datasets: [
        {
          data: metrics.zoneDetails.map((zone) => zone.seconds),
          backgroundColor: metrics.zoneDetails.map((zone) => zone.color),
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverBorderWidth: 4,
          hoverBorderColor: '#dc2626'
        }
      ]
    };

    canvas.width = 240;
    canvas.height = 240;

    chartInstanceRef.current = new Chart(canvas, {
      type: 'doughnut',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(185, 28, 28, 0.95)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => {
                const zone = metrics.zoneDetails[context.dataIndex];
                return `${zone.formattedTime} (${formatNumber(zone.percent, 1)}%)`;
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [metrics]);

  useEffect(() => {
    if (typeof feather !== 'undefined') feather.replace();
  }, [metrics, loading]);

  const handleRangeChange = (range) => {
    if (range === currentDays) return;
    setCurrentDays(range);
  };

  const insights = useMemo(() => {
    if (!metrics) return [];
    const out = [];
    const {
      topZone,
      recoveryPercent,
      aerobicPercent,
      cardioLoadPercent,
      redlineMinutes,
      averageWeeklyHours,
      polarizationScore
    } = metrics;

    out.push({
      title: `${topZone.displayName} leads`,
      body: `You spend ${formatNumber(topZone.percent, 1)}% in ${topZone.name}. Ensure those sessions have intent—recovery, aerobic conditioning, or purposeful intensity.`,
      badge: 'Focus',
      badgeClass: 'hrz-pill--primary'
    });

    if (recoveryPercent < 18) {
      out.push({
        title: 'Add recovery cadence',
        body: `Only ${formatNumber(recoveryPercent, 1)}% in Zone 1. Building in easy spins or rest days protects against cumulative fatigue.`,
        badge: 'Recovery',
        badgeClass: 'hrz-pill--warning'
      });
    } else if (recoveryPercent > 35) {
      out.push({
        title: 'Plenty of recovery',
        body: `Recovery time at ${formatNumber(recoveryPercent, 1)}% keeps freshness high—maintain consistency and layer intensity strategically.`,
        badge: 'Fresh',
        badgeClass: 'hrz-pill--success'
      });
    }

    if (aerobicPercent < 45) {
      out.push({
        title: 'Boost aerobic base',
        body: `Aerobic share is ${formatNumber(aerobicPercent, 1)}%. Most plans target 45–60% to deepen base fitness—consider longer steady rides.`,
        badge: 'Base',
        badgeClass: 'hrz-pill--muted'
      });
    } else if (aerobicPercent > 60) {
      out.push({
        title: 'Strong aerobic engine',
        body: `With ${formatNumber(aerobicPercent, 1)}% in Zones 2–3 you are reinforcing endurance. Balance with strategic higher intensity to stay race sharp.`,
        badge: 'Endurance',
        badgeClass: 'hrz-pill--success'
      });
    }

    if (cardioLoadPercent > 30) {
      out.push({
        title: 'Monitor intensity load',
        body: `Zone 4–5 time sits at ${formatNumber(cardioLoadPercent, 1)}%. Ensure recovery metrics and RPE stay stable to avoid overload.`,
        badge: 'Caution',
        badgeClass: 'hrz-pill--warning'
      });
    } else if (cardioLoadPercent < 18) {
      out.push({
        title: 'Consider threshold work',
        body: `Only ${formatNumber(cardioLoadPercent, 1)}% in Zones 4–5. A weekly threshold or redline session maintains high-end responsiveness.`,
        badge: 'Opportunity',
        badgeClass: 'hrz-pill--muted'
      });
    }

    if (redlineMinutes > 25) {
      out.push({
        title: 'High redline exposure',
        body: `${formatNumber(redlineMinutes, 0)} minutes recorded in Zone 5—watch for signs of fatigue or dial back to maintain freshness.`,
        badge: 'Redline',
        badgeClass: 'hrz-pill--warning'
      });
    } else if (redlineMinutes < 8) {
      out.push({
        title: 'Top-end tune',
        body: `Just ${formatNumber(redlineMinutes, 0)} minutes in Zone 5. Short neuromuscular bursts can keep finishing kick sharp.`,
        badge: 'Top-end',
        badgeClass: 'hrz-pill--muted'
      });
    }

    out.push({
      title: 'Weekly volume',
      body: `Average workload over this window is ${formatNumber(averageWeeklyHours, 1)} h per week. Track how intensity mix shifts when volume changes.`,
      badge: 'Volume',
      badgeClass: 'hrz-pill--primary'
    });

    if (polarizationScore < 60) {
      out.push({
        title: 'Rebalance polarisation',
        body: `Polarisation score ${formatNumber(polarizationScore, 0)} indicates tempo-heavy mix. Tilt time toward Zone 2 or high-intensity to improve contrast.`,
        badge: 'Adjust',
        badgeClass: 'hrz-pill--warning'
      });
    }

    return out;
  }, [metrics]);

  if (loading) {
    return (
      <div className="hrz-dashboard">
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'chart', count: 2 }) }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="hrz-empty">
        <i data-feather="alert-triangle"></i>
        <h3>Heart Rate Zones Unavailable</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!metrics || !metrics.totalSeconds) {
    return (
      <div className="hrz-empty">
        <i data-feather="slash"></i>
        <h3>No Heart Rate Data</h3>
        <p>Upload rides with heart rate data to unlock zone analysis and personalised guidance.</p>
      </div>
    );
  }

  const maxPercent = Math.max(...metrics.zoneDetails.map((zone) => zone.percent));

  const polarizationDescriptor = metrics.polarizationScore >= 85
    ? 'Excellent easy-hard split—maintain the strong contrast between low and high intensity.'
    : metrics.polarizationScore >= 60
      ? 'Balanced distribution with a healthy mix of recovery and decisive work.'
      : 'Tempo loading dominates—add easier spins or sharper intensity to improve contrast.';

  const aerobicDescriptor = metrics.aerobicPercent >= 45 && metrics.aerobicPercent <= 60
    ? 'Aerobic time sits in the productive range for sustainable fitness gains.'
    : metrics.aerobicPercent < 45
      ? 'Consider extending steady Zone 2 rides to reinforce aerobic base more deeply.'
      : 'Plenty of aerobic development—protect freshness by trimming steady mileage if fatigue builds.';

  const recoveryDescriptor = metrics.recoveryPercent < 20
    ? 'Recovery share is light; schedule relaxed spins or rest to absorb hard work.'
    : metrics.recoveryPercent > 35
      ? 'Generous recovery time supports consistent intensity weeks—monitor for detrainment signs.'
      : 'Recovery dosage keeps strain manageable—continue pairing easy days with quality sessions.';

  return (
    <div className="hrz-dashboard">
      <div className="hrz-topbar">
        <div className="hrz-topbar-left">
          <h1 className="hrz-page-title">Heart Rate Zones Analysis</h1>
          <div className="hrz-breadcrumb">
            <span className="hrz-badge hrz-badge-primary">Max HR {metrics.maxHR} bpm</span>
            <span className="hrz-badge hrz-badge-info">Primary: {metrics.topZone.displayName}</span>
            <span className="hrz-badge hrz-badge-muted">{getRangeLabel()}</span>
          </div>
        </div>
        <div className="hrz-topbar-controls">
          {RANGE_OPTIONS.map((range) => (
            <button
              key={range}
              className={`hrz-range-pill ${currentDays === range ? 'active' : ''}`}
              type="button"
              onClick={() => handleRangeChange(range)}
            >
              {range === 'all' ? 'All time' : range === 365 ? '1y' : `${range}d`}
            </button>
          ))}
        </div>
      </div>

      <div className="hrz-main-grid">
        <div className="hrz-left-column">
          <div className="hrz-chart-widget">
            <div className="hrz-widget-header">
              <h3>Zone Distribution</h3>
            </div>
            <div className="hrz-chart-wrapper">
              <canvas ref={chartRef} id="hrz-distribution-chart" aria-label="Heart rate zones doughnut chart"></canvas>
            </div>
            <ul className="hrz-chart-legend">
              {metrics.zoneDetails.map((zone) => (
                <li key={zone.id}>
                  <span className="hrz-legend-dot" style={{ background: zone.color }}></span>
                  <span>{zone.displayName} · {formatNumber(zone.percent, 1)}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="hrz-quick-grid">
            <div className="hrz-stat-mini">
              <div className="hrz-stat-mini-label">Total Riding</div>
              <div className="hrz-stat-mini-value">{formatNumber(metrics.totalHours, 1)}</div>
              <div className="hrz-stat-mini-unit">hours</div>
            </div>
            <div className="hrz-stat-mini">
              <div className="hrz-stat-mini-label">Weekly Volume</div>
              <div className="hrz-stat-mini-value">{formatNumber(metrics.averageWeeklyHours, 1)}</div>
              <div className="hrz-stat-mini-unit">hrs/week</div>
            </div>
            <div className="hrz-stat-mini">
              <div className="hrz-stat-mini-label">Aerobic %</div>
              <div className="hrz-stat-mini-value">{formatNumber(metrics.aerobicPercent, 1)}</div>
              <div className="hrz-stat-mini-unit">Z2-Z3</div>
            </div>
            <div className="hrz-stat-mini">
              <div className="hrz-stat-mini-label">High Intensity</div>
              <div className="hrz-stat-mini-value">{formatNumber(metrics.cardioLoadPercent, 1)}</div>
              <div className="hrz-stat-mini-unit">Z4-Z5 %</div>
            </div>
          </div>
        </div>

        <div className="hrz-right-column">
          <div className="hrz-breakdown-widget">
            <div className="hrz-breakdown-header">
              <h3>Zone-by-Zone Breakdown</h3>
              <div className="hrz-breakdown-meta">
                <span>Total: {formatNumber(metrics.totalHours, 1)}h</span>
                {metrics.averageHR ? <span>Avg HR: {formatNumber(metrics.averageHR, 0)} bpm</span> : null}
              </div>
            </div>
            <div className="hrz-zone-cards">
              {metrics.zoneDetails.map((zone) => {
                const barWidth = maxPercent > 0 ? (zone.percent / maxPercent) * 100 : 0;
                return (
                  <article key={zone.id} className="hrz-zone-card" style={{ '--zone-color': zone.color }}>
                    <div className="hrz-zone-card-header">
                      <span className="hrz-zone-num">Zone {zone.num}</span>
                      <span className="hrz-zone-percent">{formatNumber(zone.percent, 1)}%</span>
                    </div>
                    <div className="hrz-zone-name">{zone.name}</div>
                    <div className="hrz-zone-range">{zone.range}</div>
                    <div className="hrz-zone-bpm">{calculateBpmRange(zone.range, metrics.maxHR)}</div>
                    <div className="hrz-zone-bar">
                      <div className="hrz-zone-bar-fill" style={{ width: `${barWidth}%`, background: zone.color }}></div>
                    </div>
                    <div className="hrz-zone-time">{zone.formattedTime}</div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <section className="hrz-highlights">
        <header className="hrz-highlights-header">
          <h3>Focus Highlights</h3>
          <span className="hrz-pill hrz-pill--muted">{getRangeLabel()}</span>
        </header>
        <div className="hrz-highlights-grid">
          <article className="hrz-highlight-card">
            <div className="hrz-highlight-top">
              <span className="hrz-highlight-label">Polarisation Score</span>
              <span className="hrz-highlight-value">{formatNumber(metrics.polarizationScore, 0)}</span>
            </div>
            <div className="hrz-highlight-bar">
              <div className="hrz-highlight-fill" style={{ width: `${Math.max(0, Math.min(100, metrics.polarizationScore))}%` }}></div>
              <span className="hrz-highlight-marker" style={{ left: '70%' }}></span>
              <span className="hrz-highlight-marker" style={{ left: '85%' }}></span>
            </div>
            <p className="hrz-highlight-footer">{polarizationDescriptor}</p>
            <footer className="hrz-highlight-footer">(Low + High) ÷ Tempo ratio: {formatNumber(metrics.polarizationRatio, 2)}</footer>
          </article>
          <article className="hrz-highlight-card">
            <div className="hrz-highlight-top">
              <span className="hrz-highlight-label">Aerobic Base</span>
              <span className="hrz-highlight-value">{formatNumber(metrics.aerobicPercent, 1)}%</span>
            </div>
            <div className="hrz-highlight-bar">
              <div className="hrz-highlight-fill" style={{ width: `${Math.max(0, Math.min(100, metrics.aerobicPercent))}%` }}></div>
              <span className="hrz-highlight-marker" style={{ left: '45%' }}></span>
              <span className="hrz-highlight-marker" style={{ left: '60%' }}></span>
            </div>
            <p className="hrz-highlight-footer">{aerobicDescriptor}</p>
          </article>
          <article className="hrz-highlight-card">
            <div className="hrz-highlight-top">
              <span className="hrz-highlight-label">Recovery Share</span>
              <span className="hrz-highlight-value">{formatNumber(metrics.recoveryPercent, 1)}%</span>
            </div>
            <div className="hrz-highlight-bar">
              <div className="hrz-highlight-fill" style={{ width: `${Math.max(0, Math.min(100, metrics.recoveryPercent))}%` }}></div>
              <span className="hrz-highlight-marker" style={{ left: '20%' }}></span>
            </div>
            <p className="hrz-highlight-footer">{recoveryDescriptor}</p>
            <footer className="hrz-highlight-footer">Redline minutes this block: {formatNumber(metrics.redlineMinutes, 0)} min</footer>
          </article>
        </div>
      </section>

      <section className="hrz-insights">
        <header className="hrz-insights-header">
          <h3>Coaching Insights</h3>
          <span className="hrz-pill hrz-pill--muted">{getRangeLabel()}</span>
        </header>
        <div className="hrz-insights-grid">
          {insights.map((insight) => (
            <article key={insight.title} className="hrz-insight-card">
              <header className="hrz-insight-header">
                <span className={`hrz-pill ${insight.badgeClass}`}>{insight.badge}</span>
              </header>
              <div className="hrz-insight-body">
                <h4>{insight.title}</h4>
                <p>{insight.body}</p>
              </div>
              {insight.footer ? <footer className="hrz-insight-footer">{insight.footer}</footer> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HrZonesApp;
