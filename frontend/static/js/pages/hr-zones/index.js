// ============================================================
// HEART RATE ZONES PAGE – MODERN DASHBOARD DESIGN
// ============================================================

import Services from '../../services/index.js';
import { LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

const HR_ZONES = [
  { num: 1, id: 'Z1', name: 'Recovery', range: '<60% HRmax', color: '#fee2e2', description: 'Very light spin that promotes circulation and active recovery.' },
  { num: 2, id: 'Z2', name: 'Endurance', range: '60–70% HRmax', color: '#fecaca', description: 'Comfortable aerobic riding to build capillary density and durability.' },
  { num: 3, id: 'Z3', name: 'Tempo', range: '70–80% HRmax', color: '#fca5a5', description: 'Controlled pressure to raise steady-state fitness and muscular endurance.' },
  { num: 4, id: 'Z4', name: 'Threshold', range: '80–90% HRmax', color: '#f87171', description: 'Race-pace efforts that develop lactate clearance and resilience.' },
  { num: 5, id: 'Z5', name: 'Redline', range: '90–100% HRmax', color: '#ef4444', description: 'Maximal intensity for decisive attacks and finishing kick.' }
];

class HRZonesPage {
  constructor() {
    this.config = CONFIG;
    this.currentDays = 90;
    this.raw = null;
    this.zones = [];
    this.metrics = null;
    this.distributionChart = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('hr-zones');
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
    const response = await Services.data.getHRZones({ days, forceRefresh });
    this.currentDays = days;
    this.raw = response || {};
    this.zones = this.normaliseZones(this.raw);
    this.metrics = this.computeMetrics(this.zones);
  }

  render() {
    const container = document.getElementById('pageContent');
    if (!container) return;

    if (!this.metrics || !this.metrics.totalSeconds) {
      container.innerHTML = this.renderEmptyState();
      if (typeof feather !== 'undefined') feather.replace();
      return;
    }

    container.innerHTML = `
      <div class="hrz-dashboard">
        ${this.renderTopBar()}
        ${this.renderMainGrid()}
        ${this.renderHighlightsSection()}
        ${this.renderInsightsSection()}
      </div>
    `;

    if (typeof feather !== 'undefined') feather.replace();
  }

  renderTopBar() {
    const { maxHR, topZone, averageHR } = this.metrics;
    const currentDaysLabel = `Last ${this.currentDays} days`;

    return `
      <div class="hrz-topbar">
        <div class="hrz-topbar-left">
          <h1 class="hrz-page-title">Heart Rate Zones Analysis</h1>
          <div class="hrz-breadcrumb">
            <span class="hrz-badge hrz-badge-primary">Max HR ${maxHR} bpm</span>
            <span class="hrz-badge hrz-badge-info">Primary: ${this.escapeHtml(topZone.displayName)}</span>
            <span class="hrz-badge hrz-badge-muted">${currentDaysLabel}</span>
          </div>
        </div>
        <div class="hrz-topbar-controls">
          ${[30, 60, 90, 180].map(days => `
            <button class="hrz-range-pill ${this.currentDays === days ? 'active' : ''}" data-range="${days}">
              ${days}d
            </button>
          `).join('')}
          <button class="hrz-range-pill ${this.currentDays === 365 ? 'active' : ''}" data-range="365">1y</button>
        </div>
      </div>
    `;
  }

  renderMainGrid() {
    return `
      <div class="hrz-main-grid">
        ${this.renderLeftColumn()}
        ${this.renderRightColumn()}
      </div>
    `;
  }

  renderLeftColumn() {
    return `
      <div class="hrz-left-column">
        ${this.renderDistributionChart()}
        ${this.renderQuickStats()}
      </div>
    `;
  }

  renderDistributionChart() {
    return `
      <div class="hrz-chart-widget">
        <div class="hrz-widget-header">
          <h3>Zone Distribution</h3>
        </div>
        <div class="hrz-chart-wrapper">
          <canvas id="hrz-distribution-chart" aria-label="Heart rate zones doughnut chart"></canvas>
        </div>
        <ul class="hrz-chart-legend">
          ${this.metrics.zoneDetails.map(zone => `
            <li>
              <span class="hrz-legend-dot" style="background:${zone.color}"></span>
              <span>${this.escapeHtml(zone.displayName)} · ${this.formatNumber(zone.percent, 1)}%</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  renderQuickStats() {
    const { averageWeeklyHours, aerobicPercent, cardioLoadPercent, totalHours, totalSeconds } = this.metrics;
    const avgDailyMinutes = this.formatNumber((totalSeconds / 60) / this.currentDays, 1);

    return `
      <div class="hrz-quick-grid">
        <div class="hrz-stat-mini">
          <div class="hrz-stat-mini-label">Total Riding</div>
          <div class="hrz-stat-mini-value">${this.formatNumber(totalHours, 1)}</div>
          <div class="hrz-stat-mini-unit">hours</div>
        </div>

        <div class="hrz-stat-mini">
          <div class="hrz-stat-mini-label">Weekly Volume</div>
          <div class="hrz-stat-mini-value">${this.formatNumber(averageWeeklyHours, 1)}</div>
          <div class="hrz-stat-mini-unit">hrs/week</div>
        </div>

        <div class="hrz-stat-mini">
          <div class="hrz-stat-mini-label">Aerobic %</div>
          <div class="hrz-stat-mini-value">${this.formatNumber(aerobicPercent, 1)}</div>
          <div class="hrz-stat-mini-unit">Z2-Z3</div>
        </div>

        <div class="hrz-stat-mini">
          <div class="hrz-stat-mini-label">High Intensity</div>
          <div class="hrz-stat-mini-value">${this.formatNumber(cardioLoadPercent, 1)}</div>
          <div class="hrz-stat-mini-unit">Z4-Z5 %</div>
        </div>
      </div>
    `;
  }

  renderRightColumn() {
    return `
      <div class="hrz-right-column">
        ${this.renderZoneBreakdown()}
      </div>
    `;
  }

  renderZoneBreakdown() {
    const { totalHours, averageHR } = this.metrics;

    return `
      <div class="hrz-breakdown-widget">
        <div class="hrz-breakdown-header">
          <h3>Zone-by-Zone Breakdown</h3>
          <div class="hrz-breakdown-meta">
            <span>Total: ${this.formatNumber(totalHours, 1)}h</span>
            ${averageHR ? `<span>Avg HR: ${this.formatNumber(averageHR, 0)} bpm</span>` : ''}
          </div>
        </div>
        <div class="hrz-zone-cards">
          ${this.metrics.zoneDetails.map(zone => this.renderZoneCard(zone)).join('')}
        </div>
      </div>
    `;
  }

  renderZoneCard(zone) {
    const maxHR = this.metrics.maxHR;
    const bpmRange = this.calculateBPMRange(zone.range, maxHR);
    const maxPercent = Math.max(...this.metrics.zoneDetails.map(z => z.percent));
    const barWidth = maxPercent > 0 ? (zone.percent / maxPercent) * 100 : 0;

    return `
      <article class="hrz-zone-card" style="--zone-color: ${zone.color}">
        <div class="hrz-zone-card-header">
          <span class="hrz-zone-num">Zone ${zone.num}</span>
          <span class="hrz-zone-percent">${this.formatNumber(zone.percent, 1)}%</span>
        </div>
        <div class="hrz-zone-name">${this.escapeHtml(zone.name)}</div>
        <div class="hrz-zone-range">${this.escapeHtml(zone.range)}</div>
        <div class="hrz-zone-bpm">${bpmRange}</div>
        <div class="hrz-zone-bar">
          <div class="hrz-zone-bar-fill" style="width: ${barWidth}%; background: ${zone.color}"></div>
        </div>
        <div class="hrz-zone-time">${zone.formattedTime}</div>
      </article>
    `;
  }

  calculateBPMRange(rangeStr, maxHR) {
    if (!maxHR || !rangeStr) return '—';

    // Handle "<60% HRmax" format
    if (rangeStr.includes('<')) {
      const match = rangeStr.match(/<(\d+)%/);
      if (match) {
        const maxPercent = parseInt(match[1]);
        const maxBPM = Math.round(maxHR * (maxPercent / 100));
        return `<${maxBPM} bpm`;
      }
    }

    // Handle ">90% HRmax" format
    if (rangeStr.includes('>')) {
      const match = rangeStr.match(/>(\d+)%/);
      if (match) {
        const minPercent = parseInt(match[1]);
        const minBPM = Math.round(maxHR * (minPercent / 100));
        return `${minBPM}+ bpm`;
      }
    }

    // Handle "60–70% HRmax" format
    const rangeMatch = rangeStr.match(/(\d+)–(\d+)%/);
    if (rangeMatch) {
      const minPercent = parseInt(rangeMatch[1]);
      const maxPercent = parseInt(rangeMatch[2]);
      const minBPM = Math.round(maxHR * (minPercent / 100));
      const maxBPM = Math.round(maxHR * (maxPercent / 100));
      return `${minBPM}–${maxBPM} bpm`;
    }

    return '—';
  }

  renderHighlightsSection() {
    const {
      polarizationScore,
      aerobicPercent,
      recoveryPercent,
      redlineMinutes,
      polarizationRatio
    } = this.metrics;

    const polarisationDescriptor = polarizationScore >= 85
      ? 'Excellent easy-hard split—maintain the strong contrast between low and high intensity.'
      : polarizationScore >= 60
        ? 'Balanced distribution with a healthy mix of recovery and decisive work.'
        : 'Tempo loading dominates—add easier spins or sharper intensity to improve contrast.';

    const aerobicDescriptor = aerobicPercent >= 45 && aerobicPercent <= 60
      ? 'Aerobic time sits in the productive range for sustainable fitness gains.'
      : aerobicPercent < 45
        ? 'Consider extending steady Zone 2 rides to reinforce aerobic base more deeply.'
        : 'Plenty of aerobic development—protect freshness by trimming steady mileage if fatigue builds.';

    const recoveryDescriptor = recoveryPercent < 20
      ? 'Recovery share is light; schedule relaxed spins or rest to absorb hard work.'
      : recoveryPercent > 35
        ? 'Generous recovery time supports consistent intensity weeks—monitor for detrainment signs.'
        : 'Recovery dosage keeps strain manageable—continue pairing easy days with quality sessions.';

    return `
      <section class="hrz-highlights">
        <header class="hrz-highlights-header">
          <h3>Focus Highlights</h3>
        </header>
        <div class="hrz-highlights-grid">
          <article class="hrz-highlight-card">
            <div class="hrz-highlight-top">
              <span class="hrz-highlight-label">Polarisation Score</span>
              <span class="hrz-highlight-value">${this.formatNumber(polarizationScore, 0)}</span>
            </div>
            <div class="hrz-highlight-bar">
              <div class="hrz-highlight-fill" style="width:${Math.max(0, Math.min(100, polarizationScore))}%;"></div>
              <span class="hrz-highlight-marker" style="left:70%;"></span>
              <span class="hrz-highlight-marker" style="left:85%;"></span>
            </div>
            <p class="hrz-highlight-footer">${this.escapeHtml(polarisationDescriptor)}</p>
            <footer class="hrz-highlight-footer">(Low + High) ÷ Tempo ratio: ${this.formatNumber(polarizationRatio, 2)}</footer>
          </article>
          <article class="hrz-highlight-card">
            <div class="hrz-highlight-top">
              <span class="hrz-highlight-label">Aerobic Base</span>
              <span class="hrz-highlight-value">${this.formatNumber(aerobicPercent, 1)}%</span>
            </div>
            <div class="hrz-highlight-bar">
              <div class="hrz-highlight-fill" style="width:${Math.max(0, Math.min(100, aerobicPercent))}%;"></div>
              <span class="hrz-highlight-marker" style="left:45%;"></span>
              <span class="hrz-highlight-marker" style="left:60%;"></span>
            </div>
            <p class="hrz-highlight-footer">${this.escapeHtml(aerobicDescriptor)}</p>
          </article>
          <article class="hrz-highlight-card">
            <div class="hrz-highlight-top">
              <span class="hrz-highlight-label">Recovery Share</span>
              <span class="hrz-highlight-value">${this.formatNumber(recoveryPercent, 1)}%</span>
            </div>
            <div class="hrz-highlight-bar">
              <div class="hrz-highlight-fill" style="width:${Math.max(0, Math.min(100, recoveryPercent))}%;"></div>
              <span class="hrz-highlight-marker" style="left:20%;"></span>
            </div>
            <p class="hrz-highlight-footer">${this.escapeHtml(recoveryDescriptor)}</p>
            <footer class="hrz-highlight-footer">Redline minutes this block: ${this.formatNumber(redlineMinutes, 0)} min</footer>
          </article>
        </div>
      </section>
    `;
  }

  renderInsightsSection() {
    const insights = this.buildInsights();
    if (!insights.length) return '';

    return `
      <section class="hrz-insights">
        <header class="hrz-insights-header">
          <h3>Coaching Insights</h3>
        </header>
        <div class="hrz-insights-grid">
          ${insights.map(insight => `
            <article class="hrz-insight-card">
              <header class="hrz-insight-header">
                <span class="hrz-pill ${insight.badgeClass}">${this.escapeHtml(insight.badge)}</span>
              </header>
              <div class="hrz-insight-body">
                <h4>${this.escapeHtml(insight.title)}</h4>
                <p>${this.escapeHtml(insight.body)}</p>
              </div>
              ${insight.footer ? `<footer class="hrz-insight-footer">${this.escapeHtml(insight.footer)}</footer>` : ''}
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderEmptyState() {
    return `
      <div class="hrz-empty">
        <i data-feather="slash"></i>
        <h3>No Heart Rate Data</h3>
        <p>Upload rides with heart rate data to unlock zone analysis and personalised guidance.</p>
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
      <div class="hrz-empty">
        <i data-feather="alert-triangle"></i>
        <h3>Heart Rate Zones Unavailable</h3>
        <p>${this.escapeHtml(error?.message || 'Failed to load heart rate zone data')}</p>
      </div>
    `;
    if (typeof feather !== 'undefined') feather.replace();
  }

  renderCharts() {
    if (!this.metrics || !this.metrics.zoneDetails.length) return;

    const canvas = document.getElementById('hrz-distribution-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.distributionChart) {
      this.distributionChart.destroy();
    }

    // Set explicit canvas dimensions for smaller chart
    canvas.width = 240;
    canvas.height = 240;

    const data = {
      labels: this.metrics.zoneDetails.map(zone => zone.displayName),
      datasets: [
        {
          data: this.metrics.zoneDetails.map(zone => zone.seconds),
          backgroundColor: this.metrics.zoneDetails.map(zone => zone.color),
          borderWidth: 3,
          borderColor: '#ffffff',
          hoverBorderWidth: 4,
          hoverBorderColor: '#dc2626'
        }
      ]
    };

    const options = {
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
            label: context => {
              const zone = this.metrics.zoneDetails[context.dataIndex];
              return `${zone.formattedTime} (${this.formatNumber(zone.percent, 1)}%)`;
            }
          }
        }
      }
    };

    this.distributionChart = new Chart(canvas, { type: 'doughnut', data, options });
  }

  setupEventListeners() {
    document.querySelectorAll('.hrz-range-pill').forEach(btn => {
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
    const zoneData = Array.isArray(raw?.zone_data) ? raw.zone_data : [];
    const map = new Map();

    zoneData.forEach(zone => {
      const num = this.extractZoneNumber(zone.zone_label);
      if (!num) return;
      const seconds = Math.max(0, Number(zone.seconds_in_zone) || 0);
      map.set(num, seconds);
    });

    return HR_ZONES.map(meta => ({
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
        percent,
        displayName: `Z${zone.num} · ${zone.name}`,
        formattedTime: this.formatDuration(zone.seconds)
      };
    });

    const sorted = [...zoneDetails].sort((a, b) => b.seconds - a.seconds);
    const topZone = sorted[0] || zoneDetails[0];

    const lowSeconds = zoneDetails.filter(z => z.num <= 2).reduce((sum, z) => sum + z.seconds, 0);
    const aerobicSeconds = zoneDetails.filter(z => z.num === 2 || z.num === 3).reduce((sum, z) => sum + z.seconds, 0);
    const tempoSeconds = zoneDetails.find(z => z.num === 3)?.seconds || 0;
    const recoverySeconds = zoneDetails.find(z => z.num === 1)?.seconds || 0;
    const thresholdSeconds = zoneDetails.find(z => z.num === 4)?.seconds || 0;
    const redlineSeconds = zoneDetails.find(z => z.num === 5)?.seconds || 0;

    const highSeconds = thresholdSeconds + redlineSeconds;

    const averageZoneNumber = zoneDetails.reduce((sum, zone) => sum + zone.num * zone.seconds, 0) / safeTotal;

    const polarizationRatio = tempoSeconds > 0 ? (lowSeconds + highSeconds) / tempoSeconds : 4;
    const polarizationScore = Math.round(Math.max(0, Math.min(4, polarizationRatio)) * 25);

    const totalHours = totalSeconds / 3600;
    const averageWeeklyHours = totalHours / (this.currentDays / 7);

    // Get max HR from raw data if available, otherwise use a default of 180
    const maxHR = this.raw?.max_hr || 180;

    // Calculate average HR if available
    const averageHR = this.raw?.avg_hr || null;

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
      polarizationScore,
      currentDaysLabel: `Last ${this.currentDays} days`
    };
  }

  buildInsights() {
    if (!this.metrics) return [];

    const insights = [];
    const {
      topZone,
      recoveryPercent,
      aerobicPercent,
      cardioLoadPercent,
      redlineMinutes,
      averageWeeklyHours,
      polarizationScore
    } = this.metrics;

    insights.push({
      title: `${topZone.displayName} leads`,
      body: `You spend ${this.formatNumber(topZone.percent, 1)}% in ${topZone.name}. Ensure those sessions have intent—recovery, aerobic conditioning, or purposeful intensity.`,
      badge: 'Focus',
      badgeClass: 'hrz-pill--primary'
    });

    if (recoveryPercent < 18) {
      insights.push({
        title: 'Add recovery cadence',
        body: `Only ${this.formatNumber(recoveryPercent, 1)}% in Zone 1. Building in easy spins or rest days protects against cumulative fatigue.`,
        badge: 'Recovery',
        badgeClass: 'hrz-pill--warning'
      });
    } else if (recoveryPercent > 35) {
      insights.push({
        title: 'Plenty of recovery',
        body: `Recovery time at ${this.formatNumber(recoveryPercent, 1)}% keeps freshness high—maintain consistency and layer intensity strategically.`,
        badge: 'Fresh',
        badgeClass: 'hrz-pill--success'
      });
    }

    if (aerobicPercent < 45) {
      insights.push({
        title: 'Boost aerobic base',
        body: `Aerobic share is ${this.formatNumber(aerobicPercent, 1)}%. Most plans target 45–60% to deepen base fitness—consider longer steady rides.`,
        badge: 'Base',
        badgeClass: 'hrz-pill--muted'
      });
    } else if (aerobicPercent > 60) {
      insights.push({
        title: 'Strong aerobic engine',
        body: `With ${this.formatNumber(aerobicPercent, 1)}% in Zones 2–3 you are reinforcing endurance. Balance with strategic higher intensity to stay race sharp.`,
        badge: 'Endurance',
        badgeClass: 'hrz-pill--success'
      });
    }

    if (cardioLoadPercent > 30) {
      insights.push({
        title: 'Monitor intensity load',
        body: `Zone 4–5 time sits at ${this.formatNumber(cardioLoadPercent, 1)}%. Ensure recovery metrics and RPE stay stable to avoid overload.`,
        badge: 'Caution',
        badgeClass: 'hrz-pill--warning'
      });
    } else if (cardioLoadPercent < 18) {
      insights.push({
        title: 'Consider threshold work',
        body: `Only ${this.formatNumber(cardioLoadPercent, 1)}% in Zones 4–5. A weekly threshold or redline session maintains high-end responsiveness.`,
        badge: 'Opportunity',
        badgeClass: 'hrz-pill--muted'
      });
    }

    if (redlineMinutes > 25) {
      insights.push({
        title: 'High redline exposure',
        body: `${this.formatNumber(redlineMinutes, 0)} minutes recorded in Zone 5—watch for signs of fatigue or dial back to maintain freshness.`,
        badge: 'Redline',
        badgeClass: 'hrz-pill--warning'
      });
    } else if (redlineMinutes < 8) {
      insights.push({
        title: 'Top-end tune',
        body: `Just ${this.formatNumber(redlineMinutes, 0)} minutes in Zone 5. Short neuromuscular bursts can keep finishing kick sharp.`,
        badge: 'Top-end',
        badgeClass: 'hrz-pill--muted'
      });
    }

    insights.push({
      title: 'Weekly volume',
      body: `Average workload over this window is ${this.formatNumber(averageWeeklyHours, 1)} h per week. Track how intensity mix shifts when volume changes.`,
      badge: 'Volume',
      badgeClass: 'hrz-pill--primary'
    });

    if (polarizationScore < 60) {
      insights.push({
        title: 'Rebalance polarisation',
        body: `Polarisation score ${this.formatNumber(polarizationScore, 0)} indicates tempo-heavy mix. Tilt time toward Zone 2 or high-intensity to improve contrast.`,
        badge: 'Adjust',
        badgeClass: 'hrz-pill--warning'
      });
    }

    return insights;
  }

  extractZoneNumber(label = '') {
    const match = String(label).match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
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

const hrZonesPage = new HRZonesPage();
export default hrZonesPage;
