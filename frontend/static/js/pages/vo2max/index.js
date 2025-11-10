// ============================================================
// VO₂ MAX PAGE – ENHANCED AEROBIC ENGINE DASHBOARD
// Complete visual redesign with circular gauges and modern UX
// ============================================================

import Services from '../../services/index.js';
import { LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

const VO2_CATEGORIES = [
  {
    min: 60,
    label: 'Elite',
    badgeClass: 'vo2-pill--elite',
    description: 'World-class aerobic capacity – continue sharpening high-intensity repeatability.',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)'
  },
  {
    min: 55,
    label: 'Excellent',
    badgeClass: 'vo2-pill--excellent',
    description: 'You are in the top percentile for your peer group – maintain VO₂ stimulus once per week.',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
  },
  {
    min: 50,
    label: 'Good',
    badgeClass: 'vo2-pill--good',
    description: 'Solid aerobic engine – alternate VO₂ blocks with tempo focus to keep gains rolling.',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
  },
  {
    min: 45,
    label: 'Above Average',
    badgeClass: 'vo2-pill--above',
    description: 'Fitness trending up – layer in progressive 3–5 minute intervals to keep building.',
    color: '#818cf8',
    gradient: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)'
  },
  {
    min: 40,
    label: 'Average',
    badgeClass: 'vo2-pill--average',
    description: 'Balanced conditioning – consistency plus a weekly intensity session moves the needle.',
    color: '#60a5fa',
    gradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
  },
  {
    min: 35,
    label: 'Below Average',
    badgeClass: 'vo2-pill--below',
    description: 'Time to prioritise aerobic development with longer steady rides and cadence drills.',
    color: '#f87171',
    gradient: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)'
  },
  {
    min: 0,
    label: 'Developing',
    badgeClass: 'vo2-pill--developing',
    description: 'Focus on frequency and progressive long rides to lift foundational aerobic capacity.',
    color: '#fb923c',
    gradient: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)'
  }
];

class VO2MaxPage {
  constructor() {
    this.config = CONFIG;
    this.currentDays = 180;
    this.data = null;
    this.metrics = null;
    this.trendChart = null;
    this.heroChart = null;
    this.additionalCharts = [];
    this.gaugeChart = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('vo2max');
      this.renderLoading();
      await this.fetchData(this.currentDays);
      this.render();
      this.renderAllCharts();
      this.setupEventListeners();
    } catch (error) {
      this.renderError(error);
    }
  }

  async fetchData(days, { forceRefresh = false } = {}) {
    const response = await Services.data.getVO2Max({ days, forceRefresh });
    const base = this.normaliseResponse(response);
    const estimates = this.normaliseEstimates(base.estimates);

    this.data = base;
    this.metrics = this.computeMetrics(estimates, base.period_days || days);
    this.currentDays = days;
  }

  render() {
    const container = document.getElementById('pageContent');
    if (!container) return;

    if (!this.metrics?.hasData) {
      container.innerHTML = this.renderEmptyState();
      if (typeof feather !== 'undefined') feather.replace();
      return;
    }

    // TRAINING LOAD STYLE LAYOUT
    container.innerHTML = `
      <div class="vo2-dashboard">
        ${this.renderTopBar()}
        ${this.renderMainGrid()}
        ${this.renderSummarySection()}
        ${this.renderVisualizationsSection()}
        ${this.renderHighlightsSection()}
        ${this.renderInsightsSection()}
        ${this.renderMethodologySection()}
      </div>
    `;

    if (typeof feather !== 'undefined') feather.replace();
    this.attachTooltips();
    this.renderGaugeChart();
  }

  // TRAINING LOAD STYLE TOP BAR
  renderTopBar() {
    const { category, change30, currentDaysLabel } = this.metrics;
    const change30Label = this.formatDelta(change30);
    const trendClass = change30 >= 0 ? 'vo2-badge-positive' : 'vo2-badge-negative';

    return `
      <div class="vo2-topbar">
        <div class="vo2-topbar-left">
          <h1 class="vo2-page-title">VO₂ Max Analysis</h1>
          <div class="vo2-breadcrumb">
            <span class="vo2-badge ${category.badgeClass}">${category.label}</span>
            <span class="vo2-badge ${trendClass}">30d: ${change30Label}</span>
            <span class="vo2-badge vo2-badge-muted">${currentDaysLabel}</span>
          </div>
        </div>
        <div class="vo2-topbar-controls">
          ${[30, 60, 90, 180, 365].map(days => `
            <button class="vo2-range-pill ${this.currentDays === days ? 'active' : ''}" data-range="${days}">
              ${days <= 360 ? days + 'd' : '1y'}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // TRAINING LOAD STYLE MAIN GRID
  renderMainGrid() {
    const {
      latestEntry,
      category,
      bestVO2,
      change30,
      consistencyScore,
      averageWeeklyHours,
      redlineMinutes
    } = this.metrics;

    const percentOfBest = bestVO2 > 0 ? (latestEntry.vo2max / bestVO2) * 100 : 0;

    return `
      <div class="vo2-main-grid">
        <!-- Left Column: Gauge + Quick Stats -->
        <div class="vo2-left-column">
          <!-- Performance Gauge -->
          <div class="vo2-gauge-widget">
            <div class="vo2-widget-header">
              <h3>Current VO₂ Max</h3>
              <span class="vo2-widget-badge ${category.badgeClass}">${category.label}</span>
            </div>
            <div class="vo2-gauge-wrapper">
              <canvas id="vo2-gauge-chart"></canvas>
              <div class="vo2-gauge-center">
                <div class="vo2-gauge-value">${this.formatNumber(latestEntry.vo2max, 1)}</div>
                <div class="vo2-gauge-label">ml/kg/min</div>
                <div class="vo2-gauge-sublabel">${Math.round(percentOfBest)}% of peak</div>
              </div>
            </div>
            <p class="vo2-gauge-desc">${category.description}</p>
          </div>

          <!-- Quick Stats Grid -->
          <div class="vo2-quick-grid">
            <div class="vo2-stat-mini">
              <div class="vo2-stat-mini-label">Current VO₂</div>
              <div class="vo2-stat-mini-value">${this.formatNumber(latestEntry.vo2max, 1)}</div>
              <div class="vo2-stat-mini-unit">ml/kg/min</div>
            </div>

            <div class="vo2-stat-mini">
              <div class="vo2-stat-mini-label">Season Peak</div>
              <div class="vo2-stat-mini-value">${this.formatNumber(bestVO2, 1)}</div>
              <div class="vo2-stat-mini-unit">ml/kg/min</div>
            </div>

            <div class="vo2-stat-mini">
              <div class="vo2-stat-mini-label">30-Day Change</div>
              <div class="vo2-stat-mini-value ${change30 >= 0 ? 'positive' : 'negative'}">${this.formatDelta(change30)}</div>
              <div class="vo2-stat-mini-unit">delta</div>
            </div>

            <div class="vo2-stat-mini">
              <div class="vo2-stat-mini-label">Consistency</div>
              <div class="vo2-stat-mini-value">${Math.round(consistencyScore)}</div>
              <div class="vo2-stat-mini-unit">/ 100</div>
            </div>

            <div class="vo2-stat-mini">
              <div class="vo2-stat-mini-label">Weekly Volume</div>
              <div class="vo2-stat-mini-value">${this.formatNumber(averageWeeklyHours, 1)}</div>
              <div class="vo2-stat-mini-unit">hours</div>
            </div>

            <div class="vo2-stat-mini">
              <div class="vo2-stat-mini-label">VO₂ Zone Time</div>
              <div class="vo2-stat-mini-value">${this.formatNumber(redlineMinutes, 0)}</div>
              <div class="vo2-stat-mini-unit">min/week</div>
            </div>
          </div>
        </div>

        <!-- Right Column: Main Chart (EMPHASIZED) -->
        <div class="vo2-right-column">
          <div class="vo2-chart-main">
            <div class="vo2-chart-header">
              <h3>VO₂ Max Progression</h3>
              <div class="vo2-chart-meta">
                <span>Current: ${this.formatNumber(latestEntry.vo2max, 1)}</span>
                <span>Peak: ${this.formatNumber(bestVO2, 1)}</span>
              </div>
            </div>
            <div class="vo2-chart-body">
              <canvas id="vo2maxChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderTrendSection() {
    const { latestEntry, bestVO2, change7, coefficients } = this.metrics;

    return `
      <section class="vo2-section">
        <header class="vo2-section__header">
          <h2 class="vo2-section__title">VO₂ Max Progression</h2>
          <p class="vo2-section__subtitle">Track your aerobic capacity evolution with raw estimates and smoothed rolling average for pattern recognition.</p>
        </header>
        <div class="vo2-chart-card">
          <div class="vo2-chart-card__header">
            <div>
              <h3>Trend Analysis</h3>
              <span class="vo2-chart-card__hint">Current: ${this.formatNumber(latestEntry.vo2max, 1)} · Peak: ${this.formatNumber(bestVO2, 1)}</span>
            </div>
            <div class="vo2-chart-card__meta">
              <span data-tooltip="7-day momentum indicator">Recent: ${this.formatDelta(change7)}</span>
              <span data-tooltip="Overall trend direction">${coefficients.trendLabel}</span>
            </div>
          </div>
          <div class="vo2-chart-card__body">
            <canvas id="vo2maxChart"></canvas>
          </div>
        </div>
      </section>
    `;
  }

  renderVisualizationsSection() {
    const { trainingDistribution, weeklyTrend } = this.metrics;
    const hasIntensityData = Object.values(trainingDistribution || {}).some(value => Number.isFinite(value) && value > 0);
    const hasWeeklyTrend = Array.isArray(weeklyTrend) && weeklyTrend.length > 0;

    if (!hasIntensityData && !hasWeeklyTrend) return '';

    const cards = [];

    if (hasIntensityData) {
      cards.push(`
          <article class="vo2-visual-card">
            <div class="vo2-visual-card__header">
              <h3>Training Intensity Mix</h3>
              <button class="vo2-info-icon" data-tooltip="Distribution across recovery, aerobic, tempo, threshold and VO₂ zones"><i data-feather="info"></i></button>
            </div>
            <div class="vo2-visual-card__body">
              <canvas id="vo2-intensity-chart"></canvas>
            </div>
          </article>
      `);
    }

    if (hasWeeklyTrend) {
      cards.push(`
          <article class="vo2-visual-card">
            <div class="vo2-visual-card__header">
              <h3>Weekly Progression</h3>
              <button class="vo2-info-icon" data-tooltip="Week-over-week average with delta indicators"><i data-feather="trending-up"></i></button>
            </div>
            <div class="vo2-visual-card__body">
              <canvas id="vo2-weekly-chart"></canvas>
            </div>
          </article>
      `);
    }

    if (!cards.length) return '';

    return `
      <section class="vo2-section">
        <header class="vo2-section-header">
          <h2 class="vo2-section-title">Training Analysis</h2>
          <p class="vo2-section-subtitle">Visualize how your training composition influences VO₂ Max development.</p>
        </header>
        <div class="vo2-visual-grid">
          ${cards.join('')}
        </div>
      </section>
    `;
  }

  renderSummarySection() {
    const {
      baseVO2,
      baseVO2Date,
      changeAll,
      change90,
      change7,
      trainingDistribution,
      readinessScore,
      weeklyTrend
    } = this.metrics;

    const baseDateLabel = baseVO2Date || 'Not recorded';
    const readinessLabel = Number.isFinite(Math.round(readinessScore))
      ? `${Math.round(readinessScore)} / 100`
      : '—';
    const aerobicLabel = this.formatNumber(trainingDistribution.aerobic, 1);
    const intensityMeta = aerobicLabel === '—'
      ? 'Distribution unavailable'
      : `${aerobicLabel}% Aerobic base`;
    const baselineNumber = this.formatNumber(baseVO2, 1);
    const baselineValue = baselineNumber === '—' ? '—' : `${baselineNumber} ml/kg/min`;
    const latestWeeklyDelta = Array.isArray(weeklyTrend) && weeklyTrend.length
      ? this.formatDelta(weeklyTrend[weeklyTrend.length - 1].delta)
      : '±0.0';

    const cards = [
      {
        label: 'Baseline Start',
        value: baselineValue,
        meta: baseDateLabel,
        tooltip: 'Starting value when this period began',
        accent: 'vo2-highlight-fill--muted'
      },
      {
        label: '90-Day Delta',
        value: this.formatDelta(change90),
        meta: 'Block-to-block improvement',
        tooltip: 'Change compared to 90 days ago',
        accent: 'vo2-highlight-fill'
      },
      {
        label: '7-Day Momentum',
        value: this.formatDelta(change7),
        meta: `Weekly Δ ${latestWeeklyDelta}`,
        tooltip: 'Short-term adaptation signal',
        accent: 'vo2-highlight-fill--accent'
      },
      {
        label: 'Readiness Score',
        value: readinessLabel,
        meta: 'Consistency + trend',
        tooltip: 'Based on stability and recent gains',
        accent: 'vo2-highlight-fill--neutral'
      },
      {
        label: 'Intensity Balance',
        value: `${this.formatNumber(trainingDistribution.vO2, 1)}% VO₂`,
        meta: intensityMeta,
        tooltip: 'High-intensity exposure percentage',
        accent: 'vo2-highlight-fill--dual'
      },
      {
        label: 'Total Progress',
        value: this.formatDelta(changeAll),
        meta: 'Since period start',
        tooltip: 'Overall improvement in this window',
        accent: 'vo2-highlight-fill--bright'
      }
    ];

    return `
      <section class="vo2-section">
        <header class="vo2-section-header">
          <h2 class="vo2-section-title">Key Metrics Snapshot</h2>
          <p class="vo2-section-subtitle">Critical deltas and training load distribution for informed decision-making.</p>
        </header>
        <div class="vo2-highlight-grid">
          ${cards.map(card => `
            <article class="vo2-highlight-card" data-tooltip="${this.escapeHtml(card.tooltip)}">
              <span class="vo2-highlight-label">${card.label}</span>
              <span class="vo2-highlight-value">${card.value}</span>
              <span class="vo2-highlight-meta">${card.meta}</span>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  renderHighlightsSection() {
    const { category, readinessScore, polarisationDescriptor, aerobicDescriptor, intensityDescriptor, weeklyTrend } = this.metrics;
    const latestWeeklyDelta = Array.isArray(weeklyTrend) && weeklyTrend.length
      ? this.formatDelta(weeklyTrend[weeklyTrend.length - 1].delta)
      : '±0.0';

    return `
      <section class="vo2-section">
        <header class="vo2-section-header">
          <h2 class="vo2-section-title">Coaching Insights</h2>
          <p class="vo2-section-subtitle">Actionable takeaways based on your intensity distribution and VO₂ classification.</p>
        </header>
        <div class="vo2-focus-grid">
          <article class="vo2-focus-card">
            <header>
              <span class="vo2-badge ${category.badgeClass}">${category.label}</span>
              <button class="vo2-info-icon" data-tooltip="${this.escapeHtml(category.description)}"><i data-feather="info"></i></button>
            </header>
            <p>${category.description}</p>
            <footer>Readiness: ${Math.round(readinessScore)}/100</footer>
          </article>

          <article class="vo2-focus-card">
            <header>
              <span class="vo2-badge vo2-badge-primary">Training Balance</span>
              <button class="vo2-info-icon" data-tooltip="Evaluates low vs high intensity ratio"><i data-feather="info"></i></button>
            </header>
            <p>${polarisationDescriptor}</p>
            <footer>${aerobicDescriptor}</footer>
          </article>

          <article class="vo2-focus-card">
            <header>
              <span class="vo2-badge vo2-badge-positive">Session Guidance</span>
              <button class="vo2-info-icon" data-tooltip="Recommendations based on recent trends"><i data-feather="info"></i></button>
            </header>
            <p>${intensityDescriptor}</p>
            <footer>Latest weekly Δ: ${latestWeeklyDelta}</footer>
          </article>
        </div>
      </section>
    `;
  }

  renderInsightsSection() {
    const insights = this.buildInsights();
    if (!insights.length) return '';

    return `
      <section class="vo2-section">
        <header class="vo2-section-header">
          <h2 class="vo2-section-title">Detailed Analysis</h2>
          <p class="vo2-section-subtitle">Contextual recommendations tailored to your specific training patterns.</p>
        </header>
        <div class="vo2-insight-grid">
          ${insights.map(insight => `
            <article class="vo2-insight-card">
              <header>
                <span class="vo2-badge ${insight.badgeClass}">${this.escapeHtml(insight.badge)}</span>
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

  renderMethodologySection() {
    return `
      <section class="vo2-section">
        <header class="vo2-section-header">
          <h2 class="vo2-section-title">Model Methodology</h2>
          <p class="vo2-section-subtitle">Understand how VO₂ Max is calculated and how to improve data quality.</p>
        </header>
        <div class="vo2-methodology-grid">
          <article class="vo2-method-card">
            <h3><i data-feather="database"></i>Data Requirements</h3>
            <ul>
              <li>Requires paired power + heart rate in maximal efforts</li>
              <li>Weights 3–8 minute intervals for accurate ceiling</li>
              <li>Environmental adjustments when data available</li>
            </ul>
          </article>

          <article class="vo2-method-card">
            <h3><i data-feather="activity"></i>Training Signals</h3>
            <ul>
              <li>Tracks VO₂-targeted minutes and Z4-5 efforts</li>
              <li>Evaluates aerobic foundation via Z2/Z3</li>
              <li>Identifies plateaus from missing high-end work</li>
            </ul>
          </article>

          <article class="vo2-method-card">
            <h3><i data-feather="target"></i>Action Steps</h3>
            <ul>
              <li>Schedule 4–6 × 3–5min VO₂ intervals every 10–14 days</li>
              <li>Pair high-intensity with recovery days</li>
              <li>Retest monthly with ramp or hill protocols</li>
            </ul>
          </article>
        </div>
      </section>
    `;
  }

  setupEventListeners() {
    document.querySelectorAll('.vo2-range-pill').forEach(btn => {
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
      this.renderAllCharts();
      this.setupEventListeners();
    } catch (error) {
      this.renderError(error);
    }
  }

  renderEmptyState() {
    return `
      <div class="vo2-empty">
        <i data-feather="slash"></i>
        <h3>No VO₂ Max Data</h3>
        <p>Upload maximal efforts with paired power and heart rate to unlock aerobic capacity insights.</p>
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
      <div class="vo2-empty">
        <i data-feather="alert-triangle"></i>
        <h3>VO₂ Max Unavailable</h3>
        <p>${this.escapeHtml(error?.message || 'Failed to load VO₂ Max data')}</p>
      </div>
    `;
  }

  renderAllCharts() {
    this.renderGaugeChart();
    this.renderTrendCharts();
    this.renderAdditionalCharts();
  }

  renderGaugeChart() {
    const canvas = document.getElementById('vo2-gauge-chart');
    if (!canvas || !this.metrics?.hasData || typeof Chart === 'undefined') return;

    const { latestEntry, bestVO2, category } = this.metrics;
    const percentOfBest = bestVO2 > 0 ? (latestEntry.vo2max / bestVO2) * 100 : 0;

    if (this.gaugeChart) {
      this.gaugeChart.destroy();
      this.gaugeChart = null;
    }

    // Set canvas size explicitly
    canvas.width = 220;
    canvas.height = 220;

    this.gaugeChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [percentOfBest, 100 - percentOfBest],
          backgroundColor: [category.color, 'rgba(226, 232, 240, 0.3)'],
          borderWidth: 0,
          circumference: 270,
          rotation: 225
        }]
      },
      options: {
        cutout: '75%',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
  }

  renderTrendCharts() {
    const chartCanvas = document.getElementById('vo2maxChart');
    if (!chartCanvas || !this.metrics?.hasData || typeof Chart === 'undefined') return;

    const chartData = Services.chart.prepareVO2MaxChart(this.data.estimates);
    const rollingSeriesValues = (this.metrics?.rollingSeries || []).map(point => point.value);

    if (chartData.datasets?.length && rollingSeriesValues.length === chartData.labels.length) {
      chartData.datasets.push({
        label: '7-day Average',
        data: rollingSeriesValues,
        borderColor: 'rgba(99, 102, 241, 0.9)',
        backgroundColor: 'rgba(129, 140, 248, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 3
      });
    }

    const baseOptions = Services.chart.getDefaultChartOptions();
    const options = {
      ...baseOptions,
      maintainAspectRatio: false,
      plugins: {
        ...baseOptions.plugins,
        legend: { display: false },
        tooltip: {
          ...baseOptions.plugins?.tooltip,
          callbacks: {
            label: context => `${context.parsed.y.toFixed(1)} ml/kg/min`
          }
        }
      },
      scales: {
        x: {
          ...baseOptions.scales?.x,
          grid: { display: false }
        },
        y: {
          ...baseOptions.scales?.y,
          beginAtZero: false,
          suggestedMin: Math.max(0, Math.floor(this.metrics.lowestVO2) - 3),
          suggestedMax: Math.ceil(this.metrics.bestVO2) + 3,
          ticks: { callback: value => `${value}` },
          title: {
            display: true,
            text: 'VO₂ Max (ml/kg/min)',
            font: { size: 12, weight: '600' }
          }
        }
      }
    };

    if (this.trendChart) {
      this.trendChart.destroy();
      this.trendChart = null;
    }

    this.trendChart = new Chart(chartCanvas, {
      type: 'line',
      data: chartData,
      options
    });
  }

  renderAdditionalCharts() {
    const intensityCanvas = document.getElementById('vo2-intensity-chart');
    const weeklyCanvas = document.getElementById('vo2-weekly-chart');

    this.additionalCharts.forEach(chart => chart.destroy());
    this.additionalCharts = [];

    // Intensity composition chart
    if (intensityCanvas) {
      const dist = this.metrics.trainingDistribution || {};
      const intensityChart = new Chart(intensityCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Recovery', 'Aerobic', 'Tempo', 'Threshold', 'VO₂'],
          datasets: [{
            data: [
              dist.recovery || 0,
              dist.aerobic || 0,
              dist.tempo || 0,
              dist.threshold || 0,
              dist.vO2 || 0
            ],
            backgroundColor: [
              'rgba(191, 219, 254, 0.95)',
              'rgba(125, 211, 252, 0.9)',
              'rgba(129, 140, 248, 0.8)',
              'rgba(59, 130, 246, 0.85)',
              'rgba(37, 99, 235, 0.9)'
            ],
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 12,
                font: { size: 13, weight: '600' },
                color: '#334155'
              }
            }
          }
        }
      });
      this.additionalCharts.push(intensityChart);
    }

    // Weekly trend chart
    if (weeklyCanvas && Array.isArray(this.metrics.weeklyTrend) && this.metrics.weeklyTrend.length) {
      const weeklyLabels = this.metrics.weeklyTrend.map(item => item.label);
      const weeklyValues = this.metrics.weeklyTrend.map(item => item.average);
      const weeklyDelta = this.metrics.weeklyTrend.map(item => item.delta);
      const maxDelta = weeklyDelta.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);
      const deltaRange = Math.max(0.2, Math.ceil(maxDelta * 10) / 10);

      const weeklyChart = new Chart(weeklyCanvas, {
        type: 'bar',
        data: {
          labels: weeklyLabels,
          datasets: [
            {
              type: 'bar',
              label: 'Weekly Average',
              data: weeklyValues,
              backgroundColor: 'rgba(99, 102, 241, 0.6)',
              borderColor: 'rgba(99, 102, 241, 0.9)',
              borderRadius: 14,
              maxBarThickness: 45
            },
            {
              type: 'line',
              label: 'Δ vs prior week',
              data: weeklyDelta,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.2)',
              yAxisID: 'y1',
              tension: 0.35,
              pointRadius: 5,
              pointHoverRadius: 7
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: false,
              title: {
                display: true,
                text: 'VO₂ Max (ml/kg/min)',
                font: { size: 12, weight: '600' }
              },
              grid: { color: 'rgba(148, 163, 184, 0.14)' }
            },
            y1: {
              position: 'right',
              beginAtZero: true,
              grid: { display: false },
              ticks: {
                callback: value => `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}`
              },
              title: {
                display: true,
                text: 'Weekly Δ',
                font: { size: 12, weight: '600' },
                color: '#2563eb'
              },
              suggestedMin: -deltaRange,
              suggestedMax: deltaRange
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11, weight: '600' } }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                usePointStyle: true,
                font: { size: 12, weight: '600' },
                color: '#334155',
                padding: 10
              }
            },
            tooltip: {
              callbacks: {
                label: context => {
                  if (context.dataset.type === 'line') {
                    const sign = context.parsed.y > 0 ? '+' : '';
                    return `${context.dataset.label}: ${sign}${context.parsed.y.toFixed(1)} ml/kg/min`;
                  }
                  return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} ml/kg/min`;
                }
              }
            }
          }
        }
      });
      this.additionalCharts.push(weeklyChart);
    }
  }

  computeMetrics(estimates, periodDays) {
    if (!Array.isArray(estimates) || !estimates.length) {
      return { hasData: false };
    }

    const sorted = [...estimates].sort((a, b) => new Date(a.date) - new Date(b.date));
    const totalEntries = sorted.length;
    const latestEntry = sorted[totalEntries - 1];
    const earliestEntry = sorted[0];

    const vo2Values = sorted.map(item => Number(item.vo2max) || 0);
    const bestVO2 = Math.max(...vo2Values);
    const lowestVO2 = Math.min(...vo2Values);
    const bestVO2Entry = sorted.find(item => item.vo2max === bestVO2) || latestEntry;

    const baseVO2 = earliestEntry.vo2max;
    const baseVO2Date = this.formatDate(earliestEntry.date);

    const changeAll = latestEntry.vo2max - baseVO2;
    const change90 = latestEntry.vo2max - (this.findValueByDate(sorted, 90) ?? baseVO2);
    const change30 = latestEntry.vo2max - (this.findValueByDate(sorted, 30) ?? baseVO2);
    const change7 = latestEntry.vo2max - (this.findValueByDate(sorted, 7) ?? baseVO2);

    const rollingSeries = this.buildRollingSeries(sorted, 7);
    const rollingAverage = rollingSeries.length
      ? rollingSeries[rollingSeries.length - 1].value
      : latestEntry.vo2max;

    const averageWeeklyHours = this.data?.average_weekly_hours ?? 0;
    const intensityMix = this.data?.intensity_mix || {};
    const recoveryPercent = Number.isFinite(Number(intensityMix.recovery))
      ? Number(intensityMix.recovery)
      : 0;
    const aerobicPercent = Number.isFinite(Number(intensityMix.aerobic))
      ? Number(intensityMix.aerobic)
      : 0;
    const tempoPercent = Number.isFinite(Number(intensityMix.tempo))
      ? Number(intensityMix.tempo)
      : 0;
    const thresholdPercent = Number.isFinite(Number(intensityMix.threshold))
      ? Number(intensityMix.threshold)
      : 0;
    const vO2Percent = Number.isFinite(Number(intensityMix.vo2))
      ? Number(intensityMix.vo2)
      : 0;
    const redlinePercent = Number.isFinite(Number(intensityMix.redline))
      ? Number(intensityMix.redline)
      : vO2Percent;
    const redlineMinutes = Number.isFinite(Number(this.data?.vo2_minutes))
      ? Number(this.data.vo2_minutes)
      : 0;

    const distributionSum = recoveryPercent + aerobicPercent + tempoPercent + thresholdPercent + vO2Percent;

    const trainingDistribution = distributionSum > 0
      ? {
          recovery: (recoveryPercent / distributionSum) * 100,
          aerobic: (aerobicPercent / distributionSum) * 100,
          tempo: (tempoPercent / distributionSum) * 100,
          threshold: (thresholdPercent / distributionSum) * 100,
          vO2: (vO2Percent / distributionSum) * 100,
          redline: (redlinePercent / distributionSum) * 100
        }
      : {
          recovery: 0,
          aerobic: 0,
          tempo: 0,
          threshold: 0,
          vO2: 0,
          redline: 0
        };

    const weeklyTrend = this.buildWeeklyTrend(sorted);
    const plateauDays = this.calculatePlateauDays(sorted);
    const consistencyScore = this.calculateConsistency(vo2Values);
    const readinessScore = this.calculateReadiness({
      change30,
      change7,
      consistencyScore,
      plateauDays
    });

    const category = this.getVO2Category(latestEntry.vo2max);
    const coefficients = this.computeTrendCoefficients(sorted);

    return {
      hasData: true,
      periodDays,
      totalEntries,
      latestEntry,
      earliestEntry,
      bestVO2,
      bestVO2Date: this.formatDate(bestVO2Entry.date),
      lowestVO2,
      baseVO2,
      baseVO2Date,
      changeAll,
      change90,
      change30,
      change7,
      rollingAverage,
      rollingSeries,
      averageWeeklyHours,
      recoveryPercent,
      aerobicPercent,
      tempoPercent,
      thresholdPercent,
      trainingDistribution,
      redlineMinutes,
      redlinePercent,
      weeklyTrend,
      plateauDays,
      consistencyScore,
      readinessScore,
      category,
      currentDaysLabel: `Last ${periodDays} days`,
      polarisationDescriptor: this.getPolarisationDescriptor(trainingDistribution),
      aerobicDescriptor: this.getAerobicDescriptor(aerobicPercent),
      intensityDescriptor: this.getIntensityGuidance(change30, redlinePercent, plateauDays, weeklyTrend),
      coefficients
    };
  }

  calculatePlateauDays(sortedEstimates) {
    const latest = sortedEstimates[sortedEstimates.length - 1];
    for (let i = sortedEstimates.length - 2; i >= 0; i -= 1) {
      if (sortedEstimates[i].vo2max < latest.vo2max - 0.2) {
        const delta = new Date(latest.date) - new Date(sortedEstimates[i].date);
        return Math.round(delta / (1000 * 60 * 60 * 24));
      }
    }
    return sortedEstimates.length > 1
      ? Math.round((new Date(latest.date) - new Date(sortedEstimates[0].date)) / (1000 * 60 * 60 * 24))
      : 0;
  }

  calculateConsistency(values) {
    if (!values.length) return 0;
    const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
    if (!mean) return 0;
    const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = stdDev / mean;
    const score = (1 - Math.min(coefficient, 0.4) / 0.4) * 100;
    return Math.max(0, Math.min(100, score));
  }

  calculateReadiness({ change30, change7, consistencyScore, plateauDays }) {
    const trendScore = this.clamp((change30 + change7 * 0.5) * 5 + 50, 0, 100);
    const plateauPenalty = plateauDays > 28 ? Math.min(plateauDays - 28, 30) : 0;
    const rawScore = (trendScore * 0.4) + (consistencyScore * 0.45) - plateauPenalty;
    return this.clamp(rawScore, 0, 100);
  }

  buildRollingSeries(sortedEstimates, windowSize = 7) {
    if (!Array.isArray(sortedEstimates) || !sortedEstimates.length) return [];
    return sortedEstimates.map((entry, index) => {
      const start = Math.max(0, index - (windowSize - 1));
      const slice = sortedEstimates.slice(start, index + 1);
      const sum = slice.reduce((acc, item) => acc + (item.vo2max || 0), 0);
      const avg = slice.length ? sum / slice.length : entry.vo2max;
      return {
        date: entry.date,
        value: Number(avg.toFixed(1))
      };
    });
  }

  buildWeeklyTrend(sortedEstimates) {
    if (!Array.isArray(sortedEstimates) || !sortedEstimates.length) return [];

    const weeks = new Map();

    sortedEstimates.forEach(entry => {
      const dateObj = new Date(entry.date);
      if (Number.isNaN(dateObj.getTime())) return;

      const weekStart = new Date(dateObj);
      const day = weekStart.getUTCDay();
      const diff = (day === 0 ? -6 : 1) - day;
      weekStart.setUTCDate(weekStart.getUTCDate() + diff);
      weekStart.setUTCHours(0, 0, 0, 0);
      const key = weekStart.toISOString();

      if (!weeks.has(key)) {
        weeks.set(key, { sum: 0, count: 0 });
      }
      const bucket = weeks.get(key);
      bucket.sum += entry.vo2max;
      bucket.count += 1;
    });

    const sortedKeys = Array.from(weeks.keys()).sort((a, b) => new Date(a) - new Date(b));
    const limitedKeys = sortedKeys.slice(-10);
    const trend = [];
    limitedKeys.forEach((key, index) => {
      const data = weeks.get(key);
      const average = data.count ? data.sum / data.count : 0;
      const previous = trend[index - 1]?.average ?? average;
      const delta = Number((average - previous).toFixed(1));
      trend.push({
        label: this.formatWeekLabel(key),
        average: Number(average.toFixed(1)),
        delta
      });
    });

    return trend;
  }

  computeTrendCoefficients(sortedEstimates) {
    if (sortedEstimates.length < 2) {
      return { slope: 0, trendLabel: 'Insufficient data' };
    }

    const xValues = sortedEstimates.map((_, index) => index);
    const yValues = sortedEstimates.map(item => item.vo2max);

    const n = xValues.length;
    const sumX = xValues.reduce((acc, x) => acc + x, 0);
    const sumY = yValues.reduce((acc, y) => acc + y, 0);
    const sumXY = xValues.reduce((acc, x, i) => acc + x * yValues[i], 0);
    const sumXX = xValues.reduce((acc, x) => acc + x * x, 0);

    const denominator = n * sumXX - sumX ** 2;
    if (denominator === 0) {
      return { slope: 0, trendLabel: 'Flat trend' };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    let trendLabel = 'Flat trend';
    if (slope > 0.02) trendLabel = 'Upward slope';
    else if (slope < -0.02) trendLabel = 'Downward slope';

    return { slope, trendLabel };
  }

  getPolarisationDescriptor(trainingDistribution) {
    const easy = trainingDistribution.recovery + trainingDistribution.aerobic;
    const hard = trainingDistribution.threshold + trainingDistribution.vO2;
    const tempo = trainingDistribution.tempo;
    const ratio = tempo > 0 ? (easy + hard) / tempo : 4;

    if (ratio >= 3.5) return 'Excellent polarisation – easy and hard sessions outweigh tempo work.';
    if (ratio >= 2.5) return 'Healthy polarisation with purposeful tempo loading.';
    if (ratio >= 1.5) return 'Moderate polarisation – consider more distinct easy days.';
    return 'Tempo-heavy mix detected – differentiate high vs. low intensity further.';
  }

  getAerobicDescriptor(aerobicPercent) {
    if (aerobicPercent >= 55) return 'Aerobic commitment is strong – keep long rides progressing.';
    if (aerobicPercent >= 40) return 'Aerobic base is balanced with intensity.';
    return 'Aerobic mileage is light – extend Zone 2 sessions to deepen adaptations.';
  }

  getIntensityGuidance(change30, redlinePercent, plateauDays, weeklyTrend = []) {
    const latestWeeklyDelta = weeklyTrend.length ? weeklyTrend[weeklyTrend.length - 1].delta : 0;
    if (change30 > 1.5) {
      return 'VO₂ is trending up nicely – maintain cadence of hard interval sets while protecting recovery.';
    }
    if (plateauDays > 35) {
      return 'Introduce a focused VO₂ block (2 sessions/week for 2 weeks) to break the plateau.';
    }
    if (redlinePercent < 6 || latestWeeklyDelta <= 0) {
      return 'Minimal high-intensity exposure detected – incorporate 3–5 minute VO₂ repeats to stimulate adaptation.';
    }
    return 'Balance stays productive – keep alternating VO₂ micro-intervals with steady aerobic days.';
  }

  buildInsights() {
    if (!this.metrics?.hasData) return [];

    const insights = [];
    const {
      change30,
      change90,
      rollingAverage,
      category,
      redlineMinutes,
      aerobicPercent,
      readinessScore,
      plateauDays
    } = this.metrics;

    insights.push({
      title: change30 >= 0 ? 'VO₂ trajectory improving' : 'VO₂ trajectory softening',
      body: change30 >= 0
        ? `VO₂ Max is up ${this.formatNumber(change30, 1)} ml/kg/min in the last 30 days. Keep stacking high-oxygen demand sessions but respect recovery to lock in gains.`
        : `VO₂ Max dipped ${this.formatNumber(Math.abs(change30), 1)} ml/kg/min over 30 days. Review intensity freshness and ensure weekly aerobic volume stays robust.`,
      badge: change30 >= 0 ? 'Positive Trend' : 'Trend Alert',
      badgeClass: change30 >= 0 ? 'vo2-pill--success' : 'vo2-pill--warning',
      tooltip: 'Compares current estimate to value 30 days prior.',
      footer: `Rolling avg now ${this.formatNumber(rollingAverage, 1)}`
    });

    insights.push({
      title: 'Intensity exposure',
      body: redlineMinutes >= 20
        ? `You banked ${this.formatNumber(redlineMinutes, 0)} minutes above threshold. Monitor HRV and sleep to ensure readiness stays high.`
        : `Only ${this.formatNumber(redlineMinutes, 0)} minutes logged above threshold. Add VO₂ or race-simulation sessions to keep top-end responsive.`,
      badge: 'Intensity Mix',
      badgeClass: 'vo2-pill--primary',
      tooltip: 'Calculated from high-intensity session tagging.',
      footer: `Readiness score ${Math.round(readinessScore)} / 100`
    });

    insights.push({
      title: 'Aerobic foundation check',
      body: aerobicPercent >= 50
        ? `Aerobic share at ${this.formatNumber(aerobicPercent, 1)}% keeps your base deep. Maintain a long ride and steady tempo each week.`
        : `Aerobic share is ${this.formatNumber(aerobicPercent, 1)}%. Expand Zone 2 sessions to support upcoming intensity blocks.`,
      badge: 'Aerobic Base',
      badgeClass: 'vo2-pill--muted',
      tooltip: 'Percentage of training time in Z1–Z3.',
      footer: plateauDays > 28 ? `Plateau for ${plateauDays}d – plan VO₂ injection.` : ''
    });

    insights.push({
      title: 'Category guidance',
      body: category.description,
      badge: category.label,
      badgeClass: category.badgeClass,
      tooltip: 'Based on current VO₂ Max classification.',
      footer: change90 > 0 ? `Up ${this.formatNumber(change90, 1)} since 90-day mark.` : ''
    });

    return insights;
  }

  normaliseEstimates(raw) {
    if (!raw) return [];
    const array = Array.isArray(raw) ? raw : Object.values(raw);
    return array
      .map(item => {
        if (!item) return null;
        const dateValue = item.date || item.timestamp || item.time || item.datetime;
        const vo2Value = Number(item.vo2max ?? item.value ?? item.vo2_max);
        if (!Number.isFinite(vo2Value) || !dateValue) return null;
        return {
          date: dateValue,
          vo2max: vo2Value,
          method: item.method || item.source || 'unknown'
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  normaliseResponse(response) {
    const baseObject = Array.isArray(response) ? { estimates: response } : (response || {});

    const meta = {
      average_weekly_hours: 0,
      intensity_mix: {},
      vo2_minutes: 0,
      period_days: this.currentDays
    };

    const estimates = this.extractEstimates(baseObject, new Set(), meta);

    return {
      average_weekly_hours: meta.average_weekly_hours || 0,
      intensity_mix: meta.intensity_mix || {},
      vo2_minutes: meta.vo2_minutes || 0,
      period_days: meta.period_days || this.currentDays,
      estimates
    };
  }

  extractEstimates(source, visited = new Set(), meta = {}) {
    if (!source) return [];

    if (Array.isArray(source)) {
      return source;
    }

    if (visited.has(source)) return [];
    visited.add(source);

    const knownKeys = ['estimates', 'trend', 'data', 'vo2max', 'vo2_max', 'values', 'points'];

    for (const key of knownKeys) {
      const value = source[key];
      if (Array.isArray(value) && value.length) {
        this.collectMeta(source, meta);
        return value;
      }
    }

    this.collectMeta(source, meta);

    for (const value of Object.values(source)) {
      if (value && typeof value === 'object') {
        const nested = this.extractEstimates(value, visited, meta);
        if (nested.length) return nested;
      }
    }

    return [];
  }

  collectMeta(obj, meta) {
    if (!obj || typeof obj !== 'object') return;

    if (typeof obj.average_weekly_hours === 'number' && obj.average_weekly_hours > 0) {
      meta.average_weekly_hours = obj.average_weekly_hours;
    }

    if (obj.intensity_mix && typeof obj.intensity_mix === 'object') {
      meta.intensity_mix = obj.intensity_mix;
    } else if (obj.training_mix && typeof obj.training_mix === 'object') {
      meta.intensity_mix = obj.training_mix;
    }

    if (typeof obj.vo2_minutes === 'number' && obj.vo2_minutes > 0) {
      meta.vo2_minutes = obj.vo2_minutes;
    } else if (typeof obj.high_intensity_minutes === 'number' && obj.high_intensity_minutes > 0) {
      meta.vo2_minutes = obj.high_intensity_minutes;
    }

    if (typeof obj.period_days === 'number' && obj.period_days > 0) {
      meta.period_days = obj.period_days;
    } else if (typeof obj.days === 'number' && obj.days > 0) {
      meta.period_days = obj.days;
    }
  }

  getVO2Category(vo2max) {
    const category = VO2_CATEGORIES.find(item => vo2max >= item.min) || VO2_CATEGORIES[VO2_CATEGORIES.length - 1];
    return category;
  }

  findValueByDate(sortedEstimates, daysAgo) {
    const targetTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    let closestValue = null;
    let smallestDiff = Infinity;

    sortedEstimates.forEach(entry => {
      const diff = Math.abs(new Date(entry.date).getTime() - targetTime);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestValue = entry.vo2max;
      }
    });

    return closestValue;
  }

  attachTooltips() {
    const elements = document.querySelectorAll('[data-tooltip]');
    elements.forEach(element => {
      element.addEventListener('mouseenter', () => element.classList.add('has-tooltip'));
      element.addEventListener('mouseleave', () => element.classList.remove('has-tooltip'));
    });
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  formatWeekLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const options = { month: 'short', day: 'numeric' };
    const weekStart = date.toLocaleDateString(undefined, options);
    const weekEnd = new Date(date);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const weekEndLabel = weekEnd.toLocaleDateString(undefined, options);
    return `${weekStart}–${weekEndLabel}`;
  }

  formatNumber(value, decimals = 0) {
    if (!Number.isFinite(value)) return '—';
    return Number(value).toFixed(decimals);
  }

  formatDelta(value, decimals = 1) {
    if (!Number.isFinite(value) || Math.abs(value) < 0.05) return '±0.0';
    const sign = value > 0 ? '+' : '';
    return `${sign}${this.formatNumber(value, decimals)}`;
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
    if (this.trendChart) {
      this.trendChart.destroy();
      this.trendChart = null;
    }
    if (this.gaugeChart) {
      this.gaugeChart.destroy();
      this.gaugeChart = null;
    }
    this.additionalCharts.forEach(chart => chart.destroy());
    this.additionalCharts = [];
  }
}

const vo2maxPage = new VO2MaxPage();
export default vo2maxPage;
