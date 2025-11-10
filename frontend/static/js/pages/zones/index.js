// ============================================================
// POWER ZONES PAGE – INSIGHT-RICH EXPERIENCE
// ============================================================

import Services from '../../services/index.js';
import { LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

const POWER_ZONES = [
  { num: 1, id: 'Z1', name: 'Recovery', range: '<55% FTP', color: '#c7d2fe', description: 'Flush fatigue with very easy spinning and active recovery rides.' },
  { num: 2, id: 'Z2', name: 'Endurance', range: '55–75% FTP', color: '#a5bdfd', description: 'Build aerobic base and increase fat utilisation on long steady rides.' },
  { num: 3, id: 'Z3', name: 'Tempo', range: '75–90% FTP', color: '#7fa6fa', description: 'Improve muscular endurance and prepare for sustained race efforts.' },
  { num: 4, id: 'Z4', name: 'Threshold', range: '90–105% FTP', color: '#5c8cf3', description: 'Push your lactate threshold and ability to hold race-winning power.' },
  { num: 5, id: 'Z5', name: 'VO₂ Max', range: '105–120% FTP', color: '#3f73e6', description: 'Boost aerobic ceiling with high-intensity intervals and hill repeats.' },
  { num: 6, id: 'Z6', name: 'Anaerobic', range: '120–150% FTP', color: '#2b5bd6', description: 'Sharpen short attacks and surges for breakaways and punchy finales.' },
  { num: 7, id: 'Z7', name: 'Neuromuscular', range: '>150% FTP', color: '#1e3a8a', description: 'All-out sprints to develop top-end power and explosive acceleration.' }
];

class ZonesPage {
  constructor() {
    this.config = CONFIG;
    this.currentDays = 90;
    this.zones = [];
    this.metrics = null;
    this.settings = {};
    this.distributionChart = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('power-zones');
      this.renderLoading();
      await this.fetchData(this.currentDays);
      this.render();
      this.renderCharts();
      this.setupEventListeners();
    } catch (error) {
      this.renderError(error);
    }
  }

  async fetchData(days, { forceRefresh = false } = {}) {
    const [zonesResponse, userSettings] = await Promise.all([
      Services.data.getPowerZones({ days, forceRefresh }).catch(() => null),
      Services.data.getSettings().catch(() => ({}))
    ]);

    this.currentDays = days;
    this.settings = userSettings || {};
    this.zonesResponse = zonesResponse || {};
    this.zones = this.normaliseZones(zonesResponse);
    this.metrics = this.computeMetrics(this.zones);
  }

  render() {
    const container = document.getElementById('pageContent');
    if (!container) return;

    if (!this.metrics || !this.metrics.totalSeconds) {
      container.innerHTML = this.renderEmptyState();
      return;
    }

    container.innerHTML = `
      <div class="pz-dashboard">
        ${this.renderTopBar()}
        ${this.renderMainGrid()}
        ${this.renderHighlightsSection()}
        ${this.renderInsightsSection()}
      </div>
    `;

    if (typeof feather !== 'undefined') feather.replace();
  }

  renderTopBar() {
    const { ftp, topZone, totalHours } = this.metrics;
    const currentDaysLabel = `Last ${this.currentDays} days`;

    return `
      <div class="pz-topbar">
        <div class="pz-topbar-left">
          <h1 class="pz-page-title">Power Zones Analysis</h1>
          <div class="pz-breadcrumb">
            <span class="pz-badge pz-badge-primary">FTP ${ftp}W</span>
            <span class="pz-badge pz-badge-info">Primary: ${this.escapeHtml(topZone.displayName)}</span>
            <span class="pz-badge pz-badge-muted">${currentDaysLabel}</span>
          </div>
        </div>
        <div class="pz-topbar-controls">
          ${[30, 60, 90, 180].map(days => `
            <button class="pz-range-pill ${this.currentDays === days ? 'active' : ''}" data-range="${days}">
              ${days}d
            </button>
          `).join('')}
          <button class="pz-range-pill ${this.currentDays === 365 ? 'active' : ''}" data-range="365">1y</button>
        </div>
      </div>
    `;
  }

  renderMainGrid() {
    return `
      <div class="pz-main-grid">
        ${this.renderLeftColumn()}
        ${this.renderRightColumn()}
      </div>
    `;
  }

  renderLeftColumn() {
    return `
      <div class="pz-left-column">
        ${this.renderDistributionChart()}
        ${this.renderQuickStats()}
      </div>
    `;
  }

  renderDistributionChart() {
    return `
      <div class="pz-chart-widget">
        <div class="pz-widget-header">
          <h3>Zone Distribution</h3>
        </div>
        <div class="pz-chart-wrapper">
          <canvas id="pz-distribution-chart" aria-label="Power zones doughnut chart"></canvas>
        </div>
        <ul class="pz-chart-legend">
          ${this.metrics.zoneDetails.map(zone => `
            <li>
              <span class="pz-legend-dot" style="background:${zone.color}"></span>
              <span>${this.escapeHtml(zone.displayName)} · ${this.formatNumber(zone.percent, 1)}%</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  renderQuickStats() {
    const { averageWeeklyHours, endurancePercent, highIntensityPercent, totalHours, totalSeconds } = this.metrics;
    const avgDailyMinutes = this.formatNumber((totalSeconds / 60) / this.currentDays, 1);

    return `
      <div class="pz-quick-grid">
        <div class="pz-stat-mini">
          <div class="pz-stat-mini-label">Total Riding</div>
          <div class="pz-stat-mini-value">${this.formatNumber(totalHours, 1)}</div>
          <div class="pz-stat-mini-unit">hours</div>
        </div>

        <div class="pz-stat-mini">
          <div class="pz-stat-mini-label">Weekly Volume</div>
          <div class="pz-stat-mini-value">${this.formatNumber(averageWeeklyHours, 1)}</div>
          <div class="pz-stat-mini-unit">hrs/week</div>
        </div>

        <div class="pz-stat-mini">
          <div class="pz-stat-mini-label">Endurance %</div>
          <div class="pz-stat-mini-value">${this.formatNumber(endurancePercent, 1)}</div>
          <div class="pz-stat-mini-unit">Z1-Z2</div>
        </div>

        <div class="pz-stat-mini">
          <div class="pz-stat-mini-label">High Intensity</div>
          <div class="pz-stat-mini-value">${this.formatNumber(highIntensityPercent, 1)}</div>
          <div class="pz-stat-mini-unit">Z5+ %</div>
        </div>
      </div>
    `;
  }

  renderRightColumn() {
    return `
      <div class="pz-right-column">
        ${this.renderZoneBreakdown()}
      </div>
    `;
  }

  renderZoneBreakdown() {
    const { totalHours } = this.metrics;

    return `
      <div class="pz-breakdown-widget">
        <div class="pz-breakdown-header">
          <h3>Zone-by-Zone Breakdown</h3>
          <div class="pz-breakdown-meta">
            <span>Total: ${this.formatNumber(totalHours, 1)}h</span>
          </div>
        </div>
        <div class="pz-zone-cards">
          ${this.metrics.zoneDetails.map(zone => this.renderZoneCard(zone)).join('')}
        </div>
      </div>
    `;
  }

  renderZoneCard(zone) {
    const ftp = this.metrics.ftp;
    const wattRange = this.calculateWattRange(zone.range, ftp);
    const maxPercent = Math.max(...this.metrics.zoneDetails.map(z => z.percent));
    const barWidth = maxPercent > 0 ? (zone.percent / maxPercent) * 100 : 0;

    return `
      <article class="pz-zone-card" style="--zone-color: ${zone.color}">
        <div class="pz-zone-card-header">
          <span class="pz-zone-num">Zone ${zone.num}</span>
          <span class="pz-zone-percent">${this.formatNumber(zone.percent, 1)}%</span>
        </div>
        <div class="pz-zone-name">${this.escapeHtml(zone.name)}</div>
        <div class="pz-zone-range">${this.escapeHtml(zone.range)}</div>
        <div class="pz-zone-watts">${wattRange}</div>
        <div class="pz-zone-bar">
          <div class="pz-zone-bar-fill" style="width: ${barWidth}%; background: ${zone.color}"></div>
        </div>
        <div class="pz-zone-time">${zone.formattedTime}</div>
      </article>
    `;
  }

  calculateWattRange(rangeStr, ftp) {
    if (!ftp || !rangeStr) return '—';

    // Parse range like "55–75% FTP" or ">150% FTP" or "<55% FTP"
    if (rangeStr.includes('>')) {
      const match = rangeStr.match(/>([\d]+)%/);
      if (match) {
        const minPercent = parseInt(match[1]);
        const minWatts = Math.round(ftp * (minPercent / 100));
        return `${minWatts}W+`;
      }
    } else if (rangeStr.includes('<')) {
      const match = rangeStr.match(/<([\d]+)%/);
      if (match) {
        const maxPercent = parseInt(match[1]);
        const maxWatts = Math.round(ftp * (maxPercent / 100));
        return `<${maxWatts}W`;
      }
    } else {
      const match = rangeStr.match(/([\d]+)–([\d]+)%/);
      if (match) {
        const minPercent = parseInt(match[1]);
        const maxPercent = parseInt(match[2]);
        const minWatts = Math.round(ftp * (minPercent / 100));
        const maxWatts = Math.round(ftp * (maxPercent / 100));
        return `${minWatts}–${maxWatts}W`;
      }
    }

    return '—';
  }

  renderDistributionSection() {
    return `
      <section class="pz-section">
        <header class="pz-section__header">
          <h2 class="pz-section__title">Zone Breakdown</h2>
          <p class="pz-section__subtitle">Detailed view of time spent across each training zone.</p>
        </header>
        <div class="pz-zone-list">
          ${this.metrics.zoneDetails.map(zone => this.renderZoneRow(zone)).join('')}
        </div>
      </section>
    `;
  }

  renderZoneRow(zone) {
    return `
      <article class="pz-zone-row">
        <div class="pz-zone-row__header">
          <div>
            <span class="pz-zone-row__title">${this.escapeHtml(zone.displayName)}</span>
            <span class="pz-zone-row__range">${this.escapeHtml(zone.range)}</span>
          </div>
          <div class="pz-zone-row__stats">
            <span class="pz-zone-row__time">${zone.formattedTime}</span>
            <span class="pz-zone-row__percent">${this.formatNumber(zone.percent, 1)}%</span>
          </div>
        </div>
        <div class="pz-zone-row__bar">
          <div class="pz-zone-row__fill" style="width:${zone.percent}%; background:${zone.color}"></div>
        </div>
        <p class="pz-zone-row__description">${this.escapeHtml(zone.description)}</p>
      </article>
    `;
  }

  renderBreakdownSection() {
    const endurance = this.metrics.zoneDetails.filter(z => z.num <= 2).reduce((acc, z) => acc + z.percent, 0);
    const tempo = this.metrics.zoneDetails.filter(z => z.num === 3 || z.num === 4).reduce((acc, z) => acc + z.percent, 0);
    const intensity = this.metrics.zoneDetails.filter(z => z.num >= 5).reduce((acc, z) => acc + z.percent, 0);

    return `
      <section class="pz-section">
        <header class="pz-section__header">
          <h2 class="pz-section__title">Intensity Mix Summary</h2>
          <p class="pz-section__subtitle">Understand how your training blocks balance aerobic base with race-ready intensity.</p>
        </header>
        <div class="pz-mix-grid">
          <div class="pz-mix-card">
            <span class="pz-mix-label">Aerobic Foundation</span>
            <span class="pz-mix-value">${this.formatNumber(endurance, 1)}%</span>
            <p>Time spent in Z1–Z2 supporting aerobic base, fat metabolism and recovery capacity.</p>
          </div>
          <div class="pz-mix-card">
            <span class="pz-mix-label">Tempo & Threshold</span>
            <span class="pz-mix-value">${this.formatNumber(tempo, 1)}%</span>
            <p>Steady pressure in Z3–Z4 develops muscular endurance and race pacing resilience.</p>
          </div>
          <div class="pz-mix-card">
            <span class="pz-mix-label">High Intensity</span>
            <span class="pz-mix-value">${this.formatNumber(intensity, 1)}%</span>
            <p>Z5+ efforts sharpen VO₂ max, anaerobic power and neuromuscular punch for racing.</p>
          </div>
        </div>
      </section>
    `;
  }

  renderHighlightsSection() {
    const {
      polarizationScore,
      tempoPercent,
      recoveryPercent,
      sprintMinutes,
      polarizationRatio
    } = this.metrics;

    const polarizationDescriptor = polarizationScore >= 80
      ? 'Highly polarised split—maintain the easy-hard contrast.'
      : polarizationScore >= 60
        ? 'Healthy balance between endurance and high intensity.'
        : 'Distribution leans tempo heavy; consider adding easier volume.';

    const tempoDescriptor = tempoPercent > 35
      ? 'Tempo and threshold are elevated; weave in more low-intensity spins.'
      : tempoPercent < 20
        ? 'Sweet spot time is light; add blocks to raise sustained power.'
        : 'Tempo load sits in the productive 20–35% band.';

    const recoveryDescriptor = recoveryPercent < 20
      ? 'Recovery dose is slim; schedule easy spins after intense days.'
      : recoveryPercent > 35
        ? 'Plenty of restorative time supporting adaptations.'
        : 'Recovery share is on point—keep pairing it with key workouts.';

    return `
      <section class="pz-section">
        <header class="pz-section-header">
          <h2 class="pz-section-title">Focus Highlights</h2>
          <p class="pz-section-subtitle">Quick-read metrics to gauge how your intensity distribution supports performance goals.</p>
        </header>
        <div class="pz-highlight-grid">
          <article class="pz-highlight-card">
            <span class="pz-highlight-label">Polarisation Score</span>
            <span class="pz-highlight-value">${this.formatNumber(polarizationScore, 0)}</span>
            <span class="pz-highlight-meta">${this.escapeHtml(polarizationDescriptor)}</span>
          </article>
          <article class="pz-highlight-card">
            <span class="pz-highlight-label">Tempo Load</span>
            <span class="pz-highlight-value">${this.formatNumber(tempoPercent, 1)}%</span>
            <span class="pz-highlight-meta">${this.escapeHtml(tempoDescriptor)}</span>
          </article>
          <article class="pz-highlight-card">
            <span class="pz-highlight-label">Recovery Share</span>
            <span class="pz-highlight-value">${this.formatNumber(recoveryPercent, 1)}%</span>
            <span class="pz-highlight-meta">${this.escapeHtml(recoveryDescriptor)}</span>
          </article>
          <article class="pz-highlight-card">
            <span class="pz-highlight-label">Polarization Ratio</span>
            <span class="pz-highlight-value">${this.formatNumber(polarizationRatio, 2)}</span>
            <span class="pz-highlight-meta">(low + high) ÷ tempo</span>
          </article>
          <article class="pz-highlight-card">
            <span class="pz-highlight-label">Sprint Volume</span>
            <span class="pz-highlight-value">${this.formatNumber(sprintMinutes, 0)}</span>
            <span class="pz-highlight-meta">min in Z6–Z7</span>
          </article>
        </div>
      </section>
    `;
  }

  renderInsightsSection() {
    const insights = this.buildInsights();
    return `
      <section class="pz-section">
        <header class="pz-section-header">
          <h2 class="pz-section-title">Coaching Insights</h2>
          <p class="pz-section-subtitle">Actionable observations extracted from your power-zone distribution.</p>
        </header>
        <div class="pz-insight-grid">
          ${insights.map(insight => `
            <article class="pz-insight-card">
              <header>
                <span class="pz-badge ${insight.badgeClass}">${this.escapeHtml(insight.badge)}</span>
                <h3>${this.escapeHtml(insight.title)}</h3>
              </header>
              <p>${this.escapeHtml(insight.body)}</p>
              ${insight.footer ? `<footer>${this.escapeHtml(insight.footer)}</footer>` : ''}
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderEmptyState() {
    return `
      <div class="pz-empty">
        <i data-feather="slash"></i>
        <h3>No Power Zone Data</h3>
        <p>Upload rides with power data to unlock distribution visualisations and personalised insights.</p>
      </div>
    `;
  }

  renderLoading() {
    const container = document.getElementById('pageContent');
    if (!container) return;
    container.innerHTML = LoadingSkeleton({ type: 'chart', count: 2 });
  }

  renderError(error) {
    const container = document.getElementById('pageContent');
    if (!container) return;
    container.innerHTML = `
      <div class="pz-empty">
        <i data-feather="alert-triangle"></i>
        <h3>Power Zones Unavailable</h3>
        <p>${this.escapeHtml(error?.message || 'Failed to load power zone data')}</p>
      </div>
    `;
  }

  renderCharts() {
    if (!this.metrics || !this.metrics.zoneDetails.length) return;

    const canvas = document.getElementById('pz-distribution-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.distributionChart) {
      this.distributionChart.destroy();
    }

    const data = {
      labels: this.metrics.zoneDetails.map(zone => zone.displayName),
      datasets: [
        {
          data: this.metrics.zoneDetails.map(zone => zone.seconds),
          backgroundColor: this.metrics.zoneDetails.map(zone => zone.color),
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverBorderWidth: 4,
          hoverBorderColor: '#1d4ed8'
        }
      ]
    };

    // Set canvas size explicitly
    canvas.width = 260;
    canvas.height = 260;

    const options = {
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
            label: context => {
              const zone = this.metrics.zoneDetails[context.dataIndex];
              return `${zone.displayName}: ${zone.formattedTime} (${this.formatNumber(zone.percent, 1)}%)`;
            }
          }
        }
      }
    };

    this.distributionChart = new Chart(canvas, { type: 'doughnut', data, options });
  }

  setupEventListeners() {
    document.querySelectorAll('.pz-range-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const range = Number(btn.dataset.range);
        this.handleRangeChange(range);
      });
    });
  }

  async handleRangeChange(days) {
    if (!Number.isFinite(days) || days === this.currentDays) return;
    try {
      this.renderLoading();
      await this.fetchData(days, { forceRefresh: true });
      this.render();
      this.renderCharts();
      this.setupEventListeners();
    } catch (error) {
      this.renderError(error);
    }
  }

  normaliseZones(raw) {
    const map = new Map();

    const pushValue = (name, seconds) => {
      const zoneNum = this.extractZoneNumber(name);
      if (!zoneNum) return;
      const key = zoneNum;
      const current = map.get(key) || 0;
      map.set(key, current + Math.max(0, Number(seconds) || 0));
    };

    if (raw?.zones && Array.isArray(raw.zones)) {
      raw.zones.forEach(z => pushValue(z.name ?? z.zone, z.seconds ?? (z.minutes ? z.minutes * 60 : 0)));
    } else if (Array.isArray(raw)) {
      raw.forEach(z => pushValue(z.name ?? z.zone, z.seconds ?? (z.minutes ? z.minutes * 60 : 0)));
    } else if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([name, value]) => pushValue(name, value));
    }

    return POWER_ZONES.map(meta => ({
      ...meta,
      seconds: map.get(meta.num) || 0
    }));
  }

  computeMetrics(zones) {
    const totalSeconds = zones.reduce((sum, zone) => sum + zone.seconds, 0);
    const safeTotal = totalSeconds || 1;

    const zoneDetails = zones.map(zone => {
      const percent = (zone.seconds / safeTotal) * 100;
      return {
        ...zone,
        displayName: `Z${zone.num} · ${zone.name}`,
        percent,
        formattedTime: this.formatDuration(zone.seconds)
      };
    });

    const sorted = [...zoneDetails].sort((a, b) => b.seconds - a.seconds);
    const topZone = sorted[0] || zoneDetails[0];

    const enduranceSeconds = zoneDetails.filter(z => z.num <= 2).reduce((sum, z) => sum + z.seconds, 0);
    const highIntensitySeconds = zoneDetails.filter(z => z.num >= 5).reduce((sum, z) => sum + z.seconds, 0);
    const tempoSeconds = zoneDetails.filter(z => z.num === 3 || z.num === 4).reduce((sum, z) => sum + z.seconds, 0);
    const sprintSeconds = zoneDetails.filter(z => z.num >= 6).reduce((sum, z) => sum + z.seconds, 0);
    const recoveryPercent = zoneDetails.find(z => z.num === 1)?.percent || 0;
    const tempoPercent = (tempoSeconds / safeTotal) * 100;
    const sprintMinutes = sprintSeconds / 60;

    const ftp = Number(this.zonesResponse?.ftp ?? this.settings?.ftp ?? 250);
    const polarizationRatio = tempoPercent > 0
      ? ( (enduranceSeconds + highIntensitySeconds) / tempoSeconds )
      : 4;
    const polarizationScore = Math.round(Math.max(0, Math.min(4, polarizationRatio)) * 25);

    return {
      totalSeconds,
      totalHours: totalSeconds / 3600,
      averageWeeklyHours: totalSeconds / 3600 / (this.currentDays / 7),
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
  }

  buildInsights() {
    const insights = [];
    const endurance = this.metrics.endurancePercent;
    const hi = this.metrics.highIntensityPercent;
    const weekly = this.metrics.averageWeeklyHours;
    const polarizationScore = this.metrics.polarizationScore;
    const sprintMinutes = this.metrics.sprintMinutes;

    insights.push({
      title: `${this.metrics.topZone.displayName} dominates`,
      body: `You spend ${this.formatNumber(this.metrics.topZone.percent, 1)}% of training in this zone. Ensure sessions in ${this.metrics.topZone.name} are serving a clear purpose.`,
      badge: 'Strength',
      badgeClass: 'pz-pill--primary'
    });

    if (polarizationScore >= 85) {
      insights.push({
        title: 'Strong polarisation',
        body: `Low intensity and top-end work outweigh tempo time, yielding a polarisation score of ${this.formatNumber(polarizationScore, 0)}. Keep fuelling recovery so the quality stays high.`,
        badge: 'Balanced',
        badgeClass: 'pz-pill--success'
      });
    } else if (polarizationScore < 60) {
      insights.push({
        title: 'Lean tempo block',
        body: `Polarisation score sits at ${this.formatNumber(polarizationScore, 0)}. Add recovery rides or short sprints so easy + high intensity eclipse tempo by design.`,
        badge: 'Adjust',
        badgeClass: 'pz-pill--warning'
      });
    }

    if (endurance < 55) {
      insights.push({
        title: 'Add more aerobic volume',
        body: `Endurance work accounts for ${this.formatNumber(endurance, 1)}%. Most riders thrive with 55–70% of time in Z1–Z2. Consider adding steady endurance rides.`,
        badge: 'Suggestion',
        badgeClass: 'pz-pill--warning'
      });
    } else {
      insights.push({
        title: 'Solid aerobic foundation',
        body: `Great job keeping ${this.formatNumber(endurance, 1)}% of time in Z1–Z2. Maintain this routine to keep aerobic gains trending upward.`,
        badge: 'Aerobic',
        badgeClass: 'pz-pill--success'
      });
    }

    if (hi > 18) {
      insights.push({
        title: 'Monitor high intensity load',
        body: `${this.formatNumber(hi, 1)}% of training is in Z5+. Ensure you are recovering adequately between hard interval days.`,
        badge: 'Caution',
        badgeClass: 'pz-pill--warning'
      });
    } else if (hi < 8) {
      insights.push({
        title: 'Sprinkle in intensity',
        body: `High-intensity exposure is ${this.formatNumber(hi, 1)}%. Incorporating one VO₂ or anaerobic session per week keeps top-end power primed.`,
        badge: 'Opportunity',
        badgeClass: 'pz-pill--muted'
      });
    }

    if (sprintMinutes < 5) {
      insights.push({
        title: 'Minimal sprint exposure',
        body: `Only ${this.formatNumber(sprintMinutes, 0)} minutes recorded in Z6–Z7. Short neuromuscular bursts maintain leg speed without heavy fatigue cost.`,
        badge: 'Top-end',
        badgeClass: 'pz-pill--muted'
      });
    } else if (sprintMinutes > 20) {
      insights.push({
        title: 'High sprint density',
        body: `${this.formatNumber(sprintMinutes, 0)} minutes logged in Z6–Z7. Track fatigue; swap a sprint set for skill drills if legs feel heavy.`,
        badge: 'Monitor',
        badgeClass: 'pz-pill--warning'
      });
    }

    insights.push({
      title: 'Weekly workload',
      body: `You’re averaging ${this.formatNumber(weekly, 1)} h per week in this window. Track how zone distribution shifts when you increase or decrease volume.`,
      badge: 'Volume',
      badgeClass: 'pz-pill--primary'
    });

    return insights;
  }

  extractZoneNumber(name = '') {
    const match = String(name).match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0h';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hrs && mins) return `${hrs}h ${mins}m`;
    if (hrs) return `${hrs}h`;
    return `${mins}m`;
  }

  formatNumber(value, decimals = 0) {
    return Number(value || 0).toFixed(decimals);
  }

  escapeHtml(value) {
    if (typeof value !== 'string') return value;
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  onUnload() {
    if (this.distributionChart) {
      this.distributionChart.destroy();
      this.distributionChart = null;
    }
  }
}

const zonesPage = new ZonesPage();
export default zonesPage;
