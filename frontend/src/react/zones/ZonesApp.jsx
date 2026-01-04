import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Services from '../../../static/js/services/index.js';
import { LoadingSkeleton } from '../../../static/js/components/ui/index.js';
import CONFIG from '../../../static/js/pages/zones/config.js';

const POWER_ZONES = [
  { num: 1, id: 'Z1', name: 'Recovery', range: '<55% FTP', color: '#c7d2fe', description: 'Flush fatigue with very easy spinning and active recovery rides.' },
  { num: 2, id: 'Z2', name: 'Endurance', range: '55-75% FTP', color: '#a5bdfd', description: 'Build aerobic base and increase fat utilisation on long steady rides.' },
  { num: 3, id: 'Z3', name: 'Tempo', range: '75-90% FTP', color: '#7fa6fa', description: 'Improve muscular endurance and prepare for sustained race efforts.' },
  { num: 4, id: 'Z4', name: 'Threshold', range: '90-105% FTP', color: '#5c8cf3', description: 'Push your lactate threshold and ability to hold race-winning power.' },
  { num: 5, id: 'Z5', name: 'VO2 Max', range: '105-120% FTP', color: '#3f73e6', description: 'Boost aerobic ceiling with high-intensity intervals and hill repeats.' },
  { num: 6, id: 'Z6', name: 'Anaerobic', range: '120-150% FTP', color: '#2b5bd6', description: 'Sharpen short attacks and surges for breakaways and punchy finales.' },
  { num: 7, id: 'Z7', name: 'Neuromuscular', range: '>150% FTP', color: '#1e3a8a', description: 'All-out sprints to develop top-end power and explosive acceleration.' }
];

const RANGE_OPTIONS = [60, 180, 365, 'all'];

const formatNumber = (value, decimals = 0) => Number(value || 0).toFixed(decimals);

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0h';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
};

const extractZoneNumber = (name = '') => {
  const match = String(name).match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

const calculateWattRange = (rangeStr, ftp) => {
  if (!ftp || !rangeStr) return '—';

  if (rangeStr.includes('>')) {
    const match = rangeStr.match(/>([\d]+)%/);
    if (match) {
      const minPercent = parseInt(match[1], 10);
      const minWatts = Math.round(ftp * (minPercent / 100));
      return `${minWatts}W+`;
    }
  } else if (rangeStr.includes('<')) {
    const match = rangeStr.match(/<([\d]+)%/);
    if (match) {
      const maxPercent = parseInt(match[1], 10);
      const maxWatts = Math.round(ftp * (maxPercent / 100));
      return `<${maxWatts}W`;
    }
  } else {
    const match = rangeStr.match(/([\d]+)-([\d]+)%/);
    if (match) {
      const minPercent = parseInt(match[1], 10);
      const maxPercent = parseInt(match[2], 10);
      const minWatts = Math.round(ftp * (minPercent / 100));
      const maxWatts = Math.round(ftp * (maxPercent / 100));
      return `${minWatts}-${maxWatts}W`;
    }
  }

  return '—';
};

const ZonesApp = () => {
  const [currentDays, setCurrentDays] = useState(60);
  const [zonesResponse, setZonesResponse] = useState({});
  const [settings, setSettings] = useState({});
  const [zones, setZones] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const normaliseZones = useCallback((raw) => {
    const map = new Map();

    const pushValue = (name, seconds) => {
      const zoneNum = extractZoneNumber(name);
      if (!zoneNum) return;
      const current = map.get(zoneNum) || 0;
      map.set(zoneNum, current + Math.max(0, Number(seconds) || 0));
    };

    if (raw?.zones && Array.isArray(raw.zones)) {
      raw.zones.forEach((zone) => pushValue(zone.name ?? zone.zone, zone.seconds ?? (zone.minutes ? zone.minutes * 60 : 0)));
    } else if (Array.isArray(raw)) {
      raw.forEach((zone) => pushValue(zone.name ?? zone.zone, zone.seconds ?? (zone.minutes ? zone.minutes * 60 : 0)));
    } else if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([name, value]) => pushValue(name, value));
    }

    return POWER_ZONES.map((meta) => ({
      ...meta,
      seconds: map.get(meta.num) || 0
    }));
  }, []);

  const computeMetrics = useCallback((zoneList, rawResponse, userSettings) => {
    const totalSeconds = zoneList.reduce((sum, zone) => sum + zone.seconds, 0);
    const safeTotal = totalSeconds || 1;
    const periodDays = Number.isFinite(currentDays)
      ? currentDays
      : Number(rawResponse?.period_days) || 365;
    const safeDays = Math.max(1, periodDays);

    const zoneDetails = zoneList.map((zone) => ({
      ...zone,
      displayName: `Z${zone.num} · ${zone.name}`,
      percent: (zone.seconds / safeTotal) * 100,
      formattedTime: formatDuration(zone.seconds)
    }));

    const sorted = [...zoneDetails].sort((a, b) => b.seconds - a.seconds);
    const topZone = sorted[0] || zoneDetails[0];

    const enduranceSeconds = zoneDetails.filter((zone) => zone.num <= 2).reduce((sum, zone) => sum + zone.seconds, 0);
    const highIntensitySeconds = zoneDetails.filter((zone) => zone.num >= 5).reduce((sum, zone) => sum + zone.seconds, 0);
    const tempoSeconds = zoneDetails.filter((zone) => zone.num === 3 || zone.num === 4).reduce((sum, zone) => sum + zone.seconds, 0);
    const sprintSeconds = zoneDetails.filter((zone) => zone.num >= 6).reduce((sum, zone) => sum + zone.seconds, 0);
    const recoveryPercent = zoneDetails.find((zone) => zone.num === 1)?.percent || 0;
    const tempoPercent = (tempoSeconds / safeTotal) * 100;
    const sprintMinutes = sprintSeconds / 60;

    const ftp = Number(rawResponse?.ftp ?? userSettings?.ftp ?? 250);
    const polarizationRatio = tempoPercent > 0
      ? ((enduranceSeconds + highIntensitySeconds) / tempoSeconds)
      : 4;
    const polarizationScore = Math.round(Math.max(0, Math.min(4, polarizationRatio)) * 25);

    return {
      totalSeconds,
      totalHours: totalSeconds / 3600,
      averageWeeklyHours: totalSeconds / 3600 / (safeDays / 7),
      zoneDetails,
      topZone,
      endurancePercent: (enduranceSeconds / safeTotal) * 100,
      highIntensityPercent: (highIntensitySeconds / safeTotal) * 100,
      tempoPercent,
      recoveryPercent,
      sprintMinutes,
      polarizationRatio,
      polarizationScore,
      ftp
    };
  }, [currentDays]);

  const getRangeLabel = useCallback(() => {
    if (currentDays === 'all') return 'All time';
    if (currentDays === 365) return 'Last year';
    return `Last ${currentDays} days`;
  }, [currentDays]);

  const loadData = useCallback(async ({ days = currentDays, forceRefresh = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      Services.analytics.trackPageView('power-zones');
      const [zonesData, userSettings] = await Promise.all([
        Services.data.getPowerZones({ days, forceRefresh }).catch(() => null),
        Services.data.getSettings().catch(() => ({}))
      ]);

      const normalized = normaliseZones(zonesData);
      setZonesResponse(zonesData || {});
      setSettings(userSettings || {});
      setZones(normalized);
      setMetrics(computeMetrics(normalized, zonesData, userSettings));
    } catch (err) {
      setError(err?.message || 'Failed to load power zone data');
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

    const chartData = {
      labels: metrics.zoneDetails.map((zone) => zone.displayName),
      datasets: [
        {
          data: metrics.zoneDetails.map((zone) => zone.seconds),
          backgroundColor: metrics.zoneDetails.map((zone) => zone.color),
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverBorderWidth: 4,
          hoverBorderColor: '#1d4ed8'
        }
      ]
    };

    canvas.width = 260;
    canvas.height = 260;

    chartInstanceRef.current = new Chart(canvas, {
      type: 'doughnut',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => {
                const zone = metrics.zoneDetails[context.dataIndex];
                return `${zone.displayName}: ${zone.formattedTime} (${formatNumber(zone.percent, 1)}%)`;
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

  const renderHighlights = () => {
    if (!metrics) return null;

    const polarizationDescriptor = metrics.polarizationScore >= 80
      ? 'Highly polarised split - maintain the easy-hard contrast.'
      : metrics.polarizationScore >= 60
        ? 'Healthy balance between endurance and high intensity.'
        : 'Distribution leans tempo heavy; consider adding easier volume.';

    const tempoDescriptor = metrics.tempoPercent > 35
      ? 'Tempo and threshold are elevated; weave in more low-intensity spins.'
      : metrics.tempoPercent < 20
        ? 'Sweet spot time is light; add blocks to raise sustained power.'
        : 'Tempo load sits in the productive 20-35% band.';

    const recoveryDescriptor = metrics.recoveryPercent < 20
      ? 'Recovery dose is slim; schedule easy spins after intense days.'
      : metrics.recoveryPercent > 35
        ? 'Plenty of restorative time supporting adaptations.'
        : 'Recovery share is on point - keep pairing it with key workouts.';

    return (
      <section className="pz-section">
        <header className="pz-section-header">
          <h2 className="pz-section-title">Focus Highlights</h2>
          <p className="pz-section-subtitle">Quick-read metrics to gauge how your intensity distribution supports performance goals.</p>
          <span className="pz-badge pz-badge-muted">{getRangeLabel()}</span>
        </header>
        <div className="pz-highlight-grid">
          <article className="pz-highlight-card">
            <span className="pz-highlight-label">Polarisation Score</span>
            <span className="pz-highlight-value">{formatNumber(metrics.polarizationScore, 0)}</span>
            <span className="pz-highlight-meta">{polarizationDescriptor}</span>
          </article>
          <article className="pz-highlight-card">
            <span className="pz-highlight-label">Tempo Load</span>
            <span className="pz-highlight-value">{formatNumber(metrics.tempoPercent, 1)}%</span>
            <span className="pz-highlight-meta">{tempoDescriptor}</span>
          </article>
          <article className="pz-highlight-card">
            <span className="pz-highlight-label">Recovery Share</span>
            <span className="pz-highlight-value">{formatNumber(metrics.recoveryPercent, 1)}%</span>
            <span className="pz-highlight-meta">{recoveryDescriptor}</span>
          </article>
          <article className="pz-highlight-card">
            <span className="pz-highlight-label">Polarization Ratio</span>
            <span className="pz-highlight-value">{formatNumber(metrics.polarizationRatio, 2)}</span>
            <span className="pz-highlight-meta">(low + high) / tempo</span>
          </article>
          <article className="pz-highlight-card">
            <span className="pz-highlight-label">Sprint Volume</span>
            <span className="pz-highlight-value">{formatNumber(metrics.sprintMinutes, 0)}</span>
            <span className="pz-highlight-meta">min in Z6-Z7</span>
          </article>
        </div>
      </section>
    );
  };

  const insights = useMemo(() => {
    if (!metrics) return [];
    const out = [];
    const endurance = metrics.endurancePercent;
    const hi = metrics.highIntensityPercent;
    const weekly = metrics.averageWeeklyHours;
    const polarizationScore = metrics.polarizationScore;
    const sprintMinutes = metrics.sprintMinutes;

    out.push({
      title: `${metrics.topZone.displayName} dominates`,
      body: `You spend ${formatNumber(metrics.topZone.percent, 1)}% of training in this zone. Ensure sessions in ${metrics.topZone.name} are serving a clear purpose.`,
      badge: 'Strength',
      badgeClass: 'pz-pill--primary'
    });

    if (polarizationScore >= 85) {
      out.push({
        title: 'Strong polarisation',
        body: `Low intensity and top-end work outweigh tempo time, yielding a polarisation score of ${formatNumber(polarizationScore, 0)}. Keep fuelling recovery so the quality stays high.`,
        badge: 'Balanced',
        badgeClass: 'pz-pill--success'
      });
    } else if (polarizationScore < 60) {
      out.push({
        title: 'Lean tempo block',
        body: `Polarisation score sits at ${formatNumber(polarizationScore, 0)}. Add recovery rides or short sprints so easy + high intensity eclipse tempo by design.`,
        badge: 'Adjust',
        badgeClass: 'pz-pill--warning'
      });
    }

    if (endurance < 55) {
      out.push({
        title: 'Add more aerobic volume',
        body: `Endurance work accounts for ${formatNumber(endurance, 1)}%. Most riders thrive with 55-70% of time in Z1-Z2. Consider adding steady endurance rides.`,
        badge: 'Suggestion',
        badgeClass: 'pz-pill--warning'
      });
    } else {
      out.push({
        title: 'Solid aerobic foundation',
        body: `Great job keeping ${formatNumber(endurance, 1)}% of time in Z1-Z2. Maintain this routine to keep aerobic gains trending upward.`,
        badge: 'Aerobic',
        badgeClass: 'pz-pill--success'
      });
    }

    if (hi > 18) {
      out.push({
        title: 'Monitor high intensity load',
        body: `${formatNumber(hi, 1)}% of training is in Z5+. Ensure you are recovering adequately between hard interval days.`,
        badge: 'Caution',
        badgeClass: 'pz-pill--warning'
      });
    } else if (hi < 8) {
      out.push({
        title: 'Sprinkle in intensity',
        body: `High-intensity exposure is ${formatNumber(hi, 1)}%. Incorporating one VO2 or anaerobic session per week keeps top-end power primed.`,
        badge: 'Opportunity',
        badgeClass: 'pz-pill--muted'
      });
    }

    if (sprintMinutes < 5) {
      out.push({
        title: 'Minimal sprint exposure',
        body: `Only ${formatNumber(sprintMinutes, 0)} minutes recorded in Z6-Z7. Short neuromuscular bursts maintain leg speed without heavy fatigue cost.`,
        badge: 'Top-end',
        badgeClass: 'pz-pill--muted'
      });
    } else if (sprintMinutes > 20) {
      out.push({
        title: 'High sprint density',
        body: `${formatNumber(sprintMinutes, 0)} minutes logged in Z6-Z7. Track fatigue; swap a sprint set for skill drills if legs feel heavy.`,
        badge: 'Monitor',
        badgeClass: 'pz-pill--warning'
      });
    }

    out.push({
      title: 'Weekly workload',
      body: `You're averaging ${formatNumber(weekly, 1)} h per week in this window. Track how zone distribution shifts when you increase or decrease volume.`,
      badge: 'Volume',
      badgeClass: 'pz-pill--primary'
    });

    return out;
  }, [metrics]);

  if (loading) {
    return (
      <div className="pz-dashboard">
        <div dangerouslySetInnerHTML={{ __html: LoadingSkeleton({ type: 'chart', count: 2 }) }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pz-empty">
        <i data-feather="alert-triangle"></i>
        <h3>Power Zones Unavailable</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!metrics || !metrics.totalSeconds) {
    return (
      <div className="pz-empty">
        <i data-feather="slash"></i>
        <h3>No Power Zone Data</h3>
        <p>Upload rides with power data to unlock distribution visualisations and personalised insights.</p>
      </div>
    );
  }

  const maxPercent = Math.max(...metrics.zoneDetails.map((zone) => zone.percent));

  return (
    <div className="pz-dashboard">
      <div className="pz-topbar">
        <div className="pz-topbar-left">
          <h1 className="pz-page-title">Power Zones Analysis</h1>
          <div className="pz-breadcrumb">
            <span className="pz-badge pz-badge-primary">FTP {metrics.ftp}W</span>
            <span className="pz-badge pz-badge-info">Primary: {metrics.topZone.displayName}</span>
            <span className="pz-badge pz-badge-muted">{getRangeLabel()}</span>
          </div>
        </div>
        <div className="pz-topbar-controls">
          {RANGE_OPTIONS.map((range) => (
            <button
              key={range}
              className={`pz-range-pill ${currentDays === range ? 'active' : ''}`}
              type="button"
              onClick={() => handleRangeChange(range)}
            >
              {range === 'all' ? 'All time' : range === 365 ? '1y' : `${range}d`}
            </button>
          ))}
        </div>
      </div>

      <div className="pz-main-grid">
        <div className="pz-left-column">
          <div className="pz-chart-widget">
            <div className="pz-widget-header">
              <h3>Zone Distribution</h3>
            </div>
            <div className="pz-chart-wrapper">
              <canvas ref={chartRef} id="pz-distribution-chart" aria-label="Power zones doughnut chart"></canvas>
            </div>
            <ul className="pz-chart-legend">
              {metrics.zoneDetails.map((zone) => (
                <li key={zone.id}>
                  <span className="pz-legend-dot" style={{ background: zone.color }}></span>
                  <span>{zone.displayName} · {formatNumber(zone.percent, 1)}%</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pz-quick-grid">
            <div className="pz-stat-mini">
              <div className="pz-stat-mini-label">Total Riding</div>
              <div className="pz-stat-mini-value">{formatNumber(metrics.totalHours, 1)}</div>
              <div className="pz-stat-mini-unit">hours</div>
            </div>
            <div className="pz-stat-mini">
              <div className="pz-stat-mini-label">Weekly Volume</div>
              <div className="pz-stat-mini-value">{formatNumber(metrics.averageWeeklyHours, 1)}</div>
              <div className="pz-stat-mini-unit">hrs/week</div>
            </div>
            <div className="pz-stat-mini">
              <div className="pz-stat-mini-label">Endurance %</div>
              <div className="pz-stat-mini-value">{formatNumber(metrics.endurancePercent, 1)}</div>
              <div className="pz-stat-mini-unit">Z1-Z2</div>
            </div>
            <div className="pz-stat-mini">
              <div className="pz-stat-mini-label">High Intensity</div>
              <div className="pz-stat-mini-value">{formatNumber(metrics.highIntensityPercent, 1)}</div>
              <div className="pz-stat-mini-unit">Z5+ %</div>
            </div>
          </div>
        </div>

        <div className="pz-right-column">
          <div className="pz-breakdown-widget">
            <div className="pz-breakdown-header">
              <h3>Zone-by-Zone Breakdown</h3>
              <div className="pz-breakdown-meta">
                <span>Total: {formatNumber(metrics.totalHours, 1)}h</span>
              </div>
            </div>
            <div className="pz-zone-cards">
              {metrics.zoneDetails.map((zone) => {
                const barWidth = maxPercent > 0 ? (zone.percent / maxPercent) * 100 : 0;
                return (
                  <article key={zone.id} className="pz-zone-card" style={{ '--zone-color': zone.color }}>
                    <div className="pz-zone-card-header">
                      <span className="pz-zone-num">Zone {zone.num}</span>
                      <span className="pz-zone-percent">{formatNumber(zone.percent, 1)}%</span>
                    </div>
                    <div className="pz-zone-name">{zone.name}</div>
                    <div className="pz-zone-range">{zone.range}</div>
                    <div className="pz-zone-watts">{calculateWattRange(zone.range, metrics.ftp)}</div>
                    <div className="pz-zone-bar">
                      <div className="pz-zone-bar-fill" style={{ width: `${barWidth}%`, background: zone.color }}></div>
                    </div>
                    <div className="pz-zone-time">{zone.formattedTime}</div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {renderHighlights()}

      <section className="pz-section">
        <header className="pz-section-header">
          <h2 className="pz-section-title">Coaching Insights</h2>
          <p className="pz-section-subtitle">Actionable observations extracted from your power-zone distribution.</p>
          <span className="pz-badge pz-badge-muted">{getRangeLabel()}</span>
        </header>
        <div className="pz-insight-grid">
          {insights.map((insight) => (
            <article key={insight.title} className="pz-insight-card">
              <header>
                <span className={`pz-badge ${insight.badgeClass}`}>{insight.badge}</span>
                <h3>{insight.title}</h3>
              </header>
              <p>{insight.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ZonesApp;
