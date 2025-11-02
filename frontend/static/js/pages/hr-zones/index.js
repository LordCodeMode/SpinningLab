// ============================================================
// HEART RATE ZONES PAGE – COHESIVE DASHBOARD EXPERIENCE
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
      this.renderChart();
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
      <div class="hrz-shell">
        ${this.renderHero()}
        ${this.renderDistributionSection()}
        ${this.renderSummarySection()}
        ${this.renderHighlightsSection()}
        ${this.renderInsightsSection()}
      </div>
    `;

    if (typeof feather !== 'undefined') feather.replace();
  }

  renderHero() {
    const {
      averageWeeklyHours,
      totalHours,
      aerobicPercent,
      cardioLoadPercent,
      topZone,
      recoveryPercent,
      redlineMinutes,
      avgZoneLabel,
      currentDaysLabel,
      polarizationScore
    } = this.metrics;

    return `
      <section class="hrz-hero">
        <div class="hrz-hero__content">
          <div class="hrz-hero__meta">
            <span class="hrz-pill"><i data-feather="heart"></i>Heart Rate Zones</span>
            <span class="hrz-pill hrz-pill--muted"><i data-feather="calendar"></i>${currentDaysLabel}</span>
            <span class="hrz-pill"><i data-feather="activity"></i>Polarisation ${this.formatNumber(polarizationScore, 0)}</span>
          </div>

          <h1>Cardio Intensity Profile</h1>
          <p class="hrz-hero__description">Review how training time spreads across heart-rate zones. Maintain generous low-intensity volume while layering threshold and redline efforts that support race demands.</p>

          <div class="hrz-hero__stats">
            <div class="hrz-stat-card">
              <span class="hrz-stat-label">Total Training</span>
              <span class="hrz-stat-value">${this.formatNumber(totalHours, 1)} h</span>
              <span class="hrz-stat-meta">${this.formatNumber(averageWeeklyHours, 1)} h per week</span>
            </div>
            <div class="hrz-stat-card">
              <span class="hrz-stat-label">Aerobic Share</span>
              <span class="hrz-stat-value">${this.formatNumber(aerobicPercent, 1)}%</span>
              <span class="hrz-stat-meta">Zone 2–3 endurance work</span>
            </div>
            <div class="hrz-stat-card">
              <span class="hrz-stat-label">Cardio Load</span>
              <span class="hrz-stat-value">${this.formatNumber(cardioLoadPercent, 1)}%</span>
              <span class="hrz-stat-meta">Zone 4–5 intensity</span>
            </div>
          </div>

          <div class="hrz-hero__quick-stats">
            <div class="hrz-quick-stat">
              <span class="hrz-quick-stat__label">Primary Zone</span>
              <span class="hrz-quick-stat__value">${this.escapeHtml(topZone.displayName)}</span>
              <span class="hrz-quick-stat__meta">${this.formatNumber(topZone.percent, 1)}% of time</span>
            </div>
            <div class="hrz-quick-stat">
              <span class="hrz-quick-stat__label">Average Intensity</span>
              <span class="hrz-quick-stat__value">${this.escapeHtml(avgZoneLabel)}</span>
              <span class="hrz-quick-stat__meta">Recovery share ${this.formatNumber(recoveryPercent, 1)}%</span>
            </div>
            <div class="hrz-quick-stat">
              <span class="hrz-quick-stat__label">Redline Minutes</span>
              <span class="hrz-quick-stat__value">${this.formatNumber(redlineMinutes, 0)} min</span>
              <span class="hrz-quick-stat__meta">Accumulated in Z5</span>
            </div>
          </div>

          <div class="hrz-hero__controls">
            ${[30, 60, 90, 180].map(days => `
              <button class="hrz-range-btn ${this.currentDays === days ? 'active' : ''}" data-range="${days}">${days}d</button>
            `).join('')}
            <button class="hrz-range-btn ${this.currentDays === 365 ? 'active' : ''}" data-range="365">1y</button>
          </div>
        </div>

        <div class="hrz-hero__chart">
          <div class="hrz-hero__chart-wrapper">
            <canvas id="hrz-distribution-chart" aria-label="Heart rate zone doughnut chart"></canvas>
          </div>
          <ul class="hrz-hero__legend">
            ${this.metrics.zoneDetails.map(zone => `
              <li>
                <span class="hrz-legend-dot" style="background:${zone.color}"></span>
                <span>${this.escapeHtml(zone.displayName)} · ${this.formatNumber(zone.percent, 1)}%</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </section>
    `;
  }

  renderDistributionSection() {
    return `
      <section class="hrz-section">
        <header class="hrz-section__header">
          <h2 class="hrz-section__title">Zone Breakdown</h2>
          <p class="hrz-section__subtitle">Detailed view of time spent across each heart rate zone.</p>
        </header>
        <div class="hrz-zone-list">
          ${this.metrics.zoneDetails.map(zone => this.renderZoneRow(zone)).join('')}
        </div>
      </section>
    `;
  }

  renderZoneRow(zone) {
    return `
      <article class="hrz-zone-row">
        <div class="hrz-zone-row__header">
          <div>
            <span class="hrz-zone-row__title">${this.escapeHtml(zone.displayName)}</span>
            <span class="hrz-zone-row__range">${this.escapeHtml(zone.range)}</span>
          </div>
          <div class="hrz-zone-row__stats">
            <span class="hrz-zone-row__time">${zone.formattedTime}</span>
            <span class="hrz-zone-row__percent">${this.formatNumber(zone.percent, 1)}%</span>
          </div>
        </div>
        <div class="hrz-zone-row__bar">
          <div class="hrz-zone-row__fill" style="width:${Math.max(0, Math.min(100, zone.percent))}%; background:${zone.color}"></div>
        </div>
        <p class="hrz-zone-row__description">${this.escapeHtml(zone.description)}</p>
      </article>
    `;
  }

  renderSummarySection() {
    const { recoveryPercent, aerobicPercent, tempoPercent, cardioLoadPercent, redlinePercent } = this.metrics;
    return `
      <section class="hrz-section">
        <header class="hrz-section__header">
          <h2 class="hrz-section__title">Intensity Mix Summary</h2>
          <p class="hrz-section__subtitle">Understand how recovery, aerobic volume, and high-intensity efforts balance across the training block.</p>
        </header>
        <div class="hrz-mix-grid">
          <div class="hrz-mix-card">
            <span class="hrz-mix-label">Recovery & Foundation</span>
            <span class="hrz-mix-value">${this.formatNumber(recoveryPercent, 1)}%</span>
            <p>Low-tension minutes in Zone 1 keep freshness high and maintain readiness for key workouts.</p>
          </div>
          <div class="hrz-mix-card">
            <span class="hrz-mix-label">Aerobic Engine</span>
            <span class="hrz-mix-value">${this.formatNumber(aerobicPercent, 1)}%</span>
            <p>Time in Zones 2–3 that drives oxidative adaptations and sustainable race pace.</p>
          </div>
          <div class="hrz-mix-card">
            <span class="hrz-mix-label">Tempo Load</span>
            <span class="hrz-mix-value">${this.formatNumber(tempoPercent, 1)}%</span>
            <p>Middle-intensity work in Zone 3 adds muscular endurance—watch the ratio so recovery stays on track.</p>
          </div>
          <div class="hrz-mix-card">
            <span class="hrz-mix-label">Redline Work</span>
            <span class="hrz-mix-value">${this.formatNumber(cardioLoadPercent, 1)}%</span>
            <p>Threshold and max-effort sessions (Zones 4–5) sharpen finishing power; balance with recovery.</p>
          </div>
          <div class="hrz-mix-card">
            <span class="hrz-mix-label">Z5 Exposure</span>
            <span class="hrz-mix-value">${this.formatNumber(redlinePercent, 1)}%</span>
            <p>All-out efforts in Zone 5 reinforce anaerobic capacity and neuromuscular snap.</p>
          </div>
        </div>
      </section>
    `;
  }

  renderHighlightsSection() {
    const {
      polarizationScore,
      aerobicPercent,
      tempoPercent,
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
      <section class="hrz-section">
        <header class="hrz-section__header">
          <h2 class="hrz-section__title">Focus Highlights</h2>
          <p class="hrz-section__subtitle">Quick-read metrics to benchmark how closely your HR distribution follows the team blueprint.</p>
        </header>
        <div class="hrz-highlight-grid">
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
            <p>${this.escapeHtml(polarisationDescriptor)}</p>
            <footer class="hrz-highlight-footer">(Low + High) ÷ Tempo ratio: ${this.formatNumber(polarizationRatio, 2)}</footer>
          </article>
          <article class="hrz-highlight-card">
            <div class="hrz-highlight-top">
              <span class="hrz-highlight-label">Aerobic Base</span>
              <span class="hrz-highlight-value">${this.formatNumber(aerobicPercent, 1)}%</span>
            </div>
            <div class="hrz-highlight-bar">
              <div class="hrz-highlight-fill hrz-highlight-fill--accent" style="width:${Math.max(0, Math.min(100, aerobicPercent))}%;"></div>
              <span class="hrz-highlight-marker" style="left:45%;"></span>
              <span class="hrz-highlight-marker" style="left:60%;"></span>
            </div>
            <p>${this.escapeHtml(aerobicDescriptor)}</p>
          </article>
          <article class="hrz-highlight-card">
            <div class="hrz-highlight-top">
              <span class="hrz-highlight-label">Recovery Share</span>
              <span class="hrz-highlight-value">${this.formatNumber(recoveryPercent, 1)}%</span>
            </div>
            <div class="hrz-highlight-bar">
              <div class="hrz-highlight-fill hrz-highlight-fill--muted" style="width:${Math.max(0, Math.min(100, recoveryPercent))}%;"></div>
              <span class="hrz-highlight-marker" style="left:20%;"></span>
            </div>
            <p>${this.escapeHtml(recoveryDescriptor)}</p>
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
      <section class="hrz-section">
        <header class="hrz-section__header">
          <h2 class="hrz-section__title">Coaching Insights</h2>
          <p class="hrz-section__subtitle">Actionable guidance extracted from your heart rate distribution.</p>
        </header>
        <div class="hrz-insight-grid">
          ${insights.map(insight => `
            <article class="hrz-insight-card">
              <header>
                <span class="hrz-pill ${insight.badgeClass}">${this.escapeHtml(insight.badge)}</span>
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
  }

  renderChart() {
    if (!this.metrics || !this.metrics.zoneDetails.length) return;

    const canvas = document.getElementById('hrz-distribution-chart');
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
          hoverBorderColor: '#b91c1c'
        }
      ]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(136, 19, 55, 0.92)',
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
    document.querySelectorAll('.hrz-range-btn').forEach(btn => {
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
      this.renderChart();
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

    return {
      totalSeconds,
      totalHours,
      averageWeeklyHours,
      zoneDetails,
      topZone,
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
      tempoPercent,
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
