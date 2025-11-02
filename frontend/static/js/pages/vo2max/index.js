// ============================================================
// VO₂ MAX PAGE – CARDIO RESPIRATORY INSIGHT HUB
// ============================================================

import Services from '../../services/index.js';
import { LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

const VO2_CATEGORIES = [
  {
    min: 60,
    label: 'Elite',
    badgeClass: 'vo2-pill--elite',
    description: 'World-class aerobic capacity – continue sharpening high-intensity repeatability.'
  },
  {
    min: 55,
    label: 'Excellent',
    badgeClass: 'vo2-pill--excellent',
    description: 'You are in the top percentile for your peer group – maintain VO₂ stimulus once per week.'
  },
  {
    min: 50,
    label: 'Good',
    badgeClass: 'vo2-pill--good',
    description: 'Solid aerobic engine – alternate VO₂ blocks with tempo focus to keep gains rolling.'
  },
  {
    min: 45,
    label: 'Above Average',
    badgeClass: 'vo2-pill--above',
    description: 'Fitness trending up – layer in progressive 3–5 minute intervals to keep building.'
  },
  {
    min: 40,
    label: 'Average',
    badgeClass: 'vo2-pill--average',
    description: 'Balanced conditioning – consistency plus a weekly intensity session moves the needle.'
  },
  {
    min: 35,
    label: 'Below Average',
    badgeClass: 'vo2-pill--below',
    description: 'Time to prioritise aerobic development with longer steady rides and cadence drills.'
  },
  {
    min: 0,
    label: 'Developing',
    badgeClass: 'vo2-pill--developing',
    description: 'Focus on frequency and progressive long rides to lift foundational aerobic capacity.'
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
  }

  async load() {
    try {
      Services.analytics.trackPageView('vo2max');
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

    container.innerHTML = `
      <div class="vo2-shell">
        ${this.renderHero()}
        ${this.renderTrendSection()}
        ${this.renderVisualizationsSection()}
        ${this.renderSummarySection()}
        ${this.renderHighlightsSection()}
        ${this.renderInsightsSection()}
        ${this.renderMethodologySection()}
      </div>
    `;

    if (typeof feather !== 'undefined') feather.replace();
    this.attachTooltips();
  }

  renderHero() {
    const {
      latestEntry,
      category,
      averageWeeklyHours,
      bestVO2,
      bestVO2Date,
      change30,
      changeAll,
      recoveryPercent,
      redlineMinutes,
      currentDaysLabel,
      rollingAverage,
      plateauDays,
      consistencyScore
    } = this.metrics;

    const change30Label = this.formatDelta(change30);
    const changeAllLabel = this.formatDelta(changeAll);
    const plateauLabel = Number.isFinite(plateauDays) ? plateauDays : 0;
    const seasonHighMeta = bestVO2Date || 'Not recorded';

    return `
      <section class="vo2-hero">
        <div class="vo2-hero__content">
          <div class="vo2-hero__meta">
            <span class="vo2-pill"><i data-feather="activity"></i>VO₂ Max</span>
            <span class="vo2-pill vo2-pill--muted"><i data-feather="calendar"></i>${currentDaysLabel}</span>
            <span class="vo2-pill vo2-pill--muted" data-tooltip="Days since your last meaningful gain">${plateauLabel}d plateau</span>
          </div>

          <h1>Maximal Oxygen Uptake Trend</h1>
          <p class="vo2-hero__description">
            VO₂ Max reflects the ceiling of your aerobic engine. Monitor trend, training stimulus, and adaptation readiness to keep gains compounding.
          </p>

          <div class="vo2-hero__stats">
            <div class="vo2-stat-card" data-tooltip="Latest modelled VO₂ Max from recent maximal efforts">
              <span class="vo2-stat-label">Current VO₂ Max</span>
              <span class="vo2-stat-value">${this.formatNumber(latestEntry.vo2max, 1)}<small>ml/kg/min</small></span>
              <span class="vo2-stat-meta">Rolling 7-day avg: ${this.formatNumber(rollingAverage, 1)}</span>
            </div>
            <div class="vo2-stat-card" data-tooltip="Trend compared with 30 days ago and start of the selected period">
              <span class="vo2-stat-label">Trend</span>
              <span class="vo2-stat-value">${change30Label}</span>
              <span class="vo2-stat-meta">Since start: ${changeAllLabel}</span>
            </div>
            <div class="vo2-stat-card" data-tooltip="Top recorded VO₂ Max and when it occurred in this window">
              <span class="vo2-stat-label">Season High</span>
              <span class="vo2-stat-value">${this.formatNumber(bestVO2, 1)}<small>ml/kg/min</small></span>
              <span class="vo2-stat-meta">${seasonHighMeta}</span>
            </div>
          </div>

          <div class="vo2-hero__quick-stats">
            <div class="vo2-quick-stat">
              <span class="vo2-quick-stat__label">Classification</span>
              <span class="vo2-quick-stat__value">${category.label}</span>
              <span class="vo2-quick-stat__meta">Consistency score ${Math.round(consistencyScore)} / 100</span>
            </div>
            <div class="vo2-quick-stat">
              <span class="vo2-quick-stat__label">Weekly Volume</span>
              <span class="vo2-quick-stat__value">${this.formatNumber(averageWeeklyHours, 1)} h</span>
              <span class="vo2-quick-stat__meta">Recovery share ${this.formatNumber(recoveryPercent, 1)}%</span>
            </div>
            <div class="vo2-quick-stat">
              <span class="vo2-quick-stat__label">High-Intensity Minutes</span>
              <span class="vo2-quick-stat__value">${this.formatNumber(redlineMinutes, 0)} min</span>
              <span class="vo2-quick-stat__meta">Zones 4–5 recorded</span>
            </div>
          </div>
        </div>

        <div class="vo2-hero__chart">
          <div class="vo2-hero__chart-header">
            <h3>Trend Overview</h3>
            <button class="vo2-info-icon" data-tooltip="Confidence band highlights 14-day rolling range.">
              <i data-feather="info"></i>
            </button>
          </div>
          <div class="vo2-hero__chart-wrapper">
            <canvas id="vo2-trend-chart" aria-label="VO₂ Max trend chart"></canvas>
          </div>
          <ul class="vo2-hero__legend">
            <li><span class="vo2-legend-dot vo2-legend-dot--primary"></span>Modelled VO₂ Max</li>
            <li><span class="vo2-legend-dot vo2-legend-dot--secondary"></span>7-day rolling average</li>
          </ul>
        </div>
      </section>
    `;
  }

  renderTrendSection() {
    const { latestEntry, bestVO2, change7, coefficients } = this.metrics;

    return `
      <section class="vo2-section">
        <header class="vo2-section__header">
          <h2 class="vo2-section__title">Six-Month Progression</h2>
          <p class="vo2-section__subtitle">Line chart overlays raw estimates with the rolling average, highlighting peaks and dips for quick pattern recognition.</p>
        </header>
        <div class="vo2-chart-card">
          <div class="vo2-chart-card__header">
            <div>
              <h3>VO₂ Max Trend</h3>
              <span class="vo2-chart-card__hint">Latest: ${this.formatNumber(latestEntry.vo2max, 1)} · Best: ${this.formatNumber(bestVO2, 1)}</span>
            </div>
            <div class="vo2-chart-card__meta">
              <span data-tooltip="Slope of the last 7 days of data">7-day momentum: ${this.formatDelta(change7)}</span>
              <span data-tooltip="Line-of-best-fit slope across the window.">${coefficients.trendLabel}</span>
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
              <h3>Intensity Composition</h3>
              <button class="vo2-info-icon" data-tooltip="Distribution of training time across recovery, aerobic, tempo, threshold and VO₂ intensity zones."><i data-feather="info"></i></button>
            </div>
            <div class="vo2-visual-card__body">
              <canvas id="vo2-intensity-chart" aria-label="Training intensity composition"></canvas>
            </div>
          </article>
      `);
    }

    if (hasWeeklyTrend) {
      cards.push(`
          <article class="vo2-visual-card">
            <div class="vo2-visual-card__header">
              <h3>Weekly VO₂ Trend</h3>
              <button class="vo2-info-icon" data-tooltip="Weekly average VO₂ Max with delta vs prior week helps spot momentum shifts."><i data-feather="trending-up"></i></button>
            </div>
            <div class="vo2-visual-card__body">
              <canvas id="vo2-weekly-chart" aria-label="Weekly VO₂ Max progression"></canvas>
            </div>
          </article>
      `);
    }

    if (!cards.length) return '';

    return `
      <section class="vo2-section">
        <header class="vo2-section__header">
          <h2 class="vo2-section__title">Adaptation Visualisations</h2>
          <p class="vo2-section__subtitle">See how training composition and weekly averages influence VO₂ Max trajectory.</p>
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
    const totalProgressLabel = this.formatDelta(changeAll);
    const aerobicLabel = this.formatNumber(trainingDistribution.aerobic, 1);
    const intensityMeta = aerobicLabel === '—'
      ? 'Aerobic distribution unavailable'
      : `${aerobicLabel}% Aerobic`;
    const baselineNumber = this.formatNumber(baseVO2, 1);
    const baselineValue = baselineNumber === '—' ? '—' : `${baselineNumber} ml/kg/min`;
    const latestWeeklyDelta = Array.isArray(weeklyTrend) && weeklyTrend.length
      ? this.formatDelta(weeklyTrend[weeklyTrend.length - 1].delta)
      : '±0.0';

    const cards = [
      {
        label: 'Baseline (start)',
        value: baselineValue,
        meta: baseDateLabel,
        tooltip: 'Starting value when the selected window began.',
        accent: 'vo2-highlight-fill--muted'
      },
      {
        label: '90-Day Delta',
        value: this.formatDelta(change90),
        meta: 'Compared with value ~90 days ago',
        tooltip: 'Helps you see block-to-block improvement.',
        accent: 'vo2-highlight-fill'
      },
      {
        label: '7-Day Momentum',
        value: this.formatDelta(change7),
        meta: `Short-term signal · Weekly Δ ${latestWeeklyDelta}`,
        tooltip: 'Positive momentum shows ongoing adaptation.',
        accent: 'vo2-highlight-fill--accent'
      },
      {
        label: 'Readiness Score',
        value: readinessLabel,
        meta: 'Based on consistency + recent trend',
        tooltip: 'Higher scores reflect stable gains and minimal drop-offs.',
        accent: 'vo2-highlight-fill--neutral'
      },
      {
        label: 'Intensity Split',
        value: `${this.formatNumber(trainingDistribution.vO2, 1)}% VO₂ · ${this.formatNumber(trainingDistribution.threshold, 1)}% Threshold`,
        meta: intensityMeta,
        tooltip: 'Derived from recent HR + power intensity distribution.',
        accent: 'vo2-highlight-fill--dual'
      },
      {
        label: 'Total Progress',
        value: totalProgressLabel,
        meta: 'Since window start',
        tooltip: 'Overall improvement through this period.',
        accent: 'vo2-highlight-fill--bright'
      }
    ];

    return `
      <section class="vo2-section">
        <header class="vo2-section__header">
          <h2 class="vo2-section__title">Progress Snapshot</h2>
          <p class="vo2-section__subtitle">Key deltas and workload split so you can align training stimulus with aerobic adaptation.</p>
        </header>
        <div class="vo2-highlight-grid">
          ${cards.map(card => `
            <article class="vo2-highlight-card ${card.accent}" data-tooltip="${this.escapeHtml(card.tooltip)}">
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
        <header class="vo2-section__header">
          <h2 class="vo2-section__title">Coaching Highlights</h2>
          <p class="vo2-section__subtitle">Quick-read takeaways anchored on your intensity mix, readiness signal, and VO₂ classification.</p>
        </header>
        <div class="vo2-focus-grid">
          <article class="vo2-focus-card">
            <header>
              <span class="vo2-pill ${category.badgeClass}">${category.label}</span>
              <button class="vo2-info-icon" data-tooltip="${this.escapeHtml(category.description)}"><i data-feather="info"></i></button>
            </header>
            <p>${category.description}</p>
            <footer>Readiness score: ${Math.round(readinessScore)} / 100</footer>
          </article>
          <article class="vo2-focus-card">
            <header>
              <span class="vo2-pill vo2-pill--primary">Intensity Balance</span>
              <button class="vo2-info-icon" data-tooltip="Evaluates the ratio of low vs. high intensity across the period."><i data-feather="info"></i></button>
            </header>
            <p>${polarisationDescriptor}</p>
            <footer>${aerobicDescriptor}</footer>
          </article>
          <article class="vo2-focus-card">
            <header>
              <span class="vo2-pill vo2-pill--success">Session Guidance</span>
              <button class="vo2-info-icon" data-tooltip="Suggestions draw on recent VO₂ trend, intensity mix, and plateau duration."><i data-feather="info"></i></button>
            </header>
            <p>${intensityDescriptor}</p>
            <footer>Latest weekly Δ: ${latestWeeklyDelta} · Blend 2–3 VO₂ focused sessions every 10–14 days.</footer>
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
        <header class="vo2-section__header">
          <h2 class="vo2-section__title">Detailed Insights</h2>
          <p class="vo2-section__subtitle">Contextual recommendations based on your VO₂ trend, intensity balance, and session density.</p>
        </header>
        <div class="vo2-insight-grid">
          ${insights.map(insight => `
            <article class="vo2-insight-card">
              <header>
                <span class="vo2-pill ${insight.badgeClass}">${this.escapeHtml(insight.badge)}</span>
                <h3>${this.escapeHtml(insight.title)}</h3>
                <button class="vo2-info-icon" data-tooltip="${this.escapeHtml(insight.tooltip)}"><i data-feather="help-circle"></i></button>
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
        <header class="vo2-section__header">
          <h2 class="vo2-section__title">Model Notes & Tips</h2>
          <p class="vo2-section__subtitle">Understand how the VO₂ model is derived and how to collect higher-quality data for sharper estimates.</p>
        </header>
        <div class="vo2-methodology-grid">
          <article class="vo2-method-card" data-tooltip="Power-only efforts lack HR – add chest strap data for better accuracy.">
            <h3><i data-feather="loader"></i>Model Inputs</h3>
            <ul>
              <li>Requires paired power + heart rate recordings in maximal efforts.</li>
              <li>Weights 3–8 minute intervals to capture true aerobic ceiling.</li>
              <li>Adjusts for environmental factors when data is available.</li>
            </ul>
          </article>
          <article class="vo2-method-card" data-tooltip="Clusters workouts into VO₂, threshold, tempo, aerobic, or recovery buckets.">
            <h3><i data-feather="sliders"></i>Training Signals</h3>
            <ul>
              <li>Tracks VO₂-targeted minutes and zones 4–5 race efforts.</li>
              <li>Evaluates aerobic foundation via Z2/Z3 commitment.</li>
              <li>Highlights plateaus when high-end work is absent.</li>
            </ul>
          </article>
          <article class="vo2-method-card" data-tooltip="Trending downward? Increase recovery, manage intensity, and tighten session focus.">
            <h3><i data-feather="target"></i>Actionable Tips</h3>
            <ul>
              <li>Schedule 4–6 × 3–5 minute VO₂ intervals every 10–14 days.</li>
              <li>Pair high-intensity days with low-intensity or rest following.</li>
              <li>Retest monthly with maximal hill repeats or ramp protocols.</li>
            </ul>
          </article>
        </div>
      </section>
    `;
  }

  setupEventListeners() {
    document.querySelectorAll('.vo2-range-btn').forEach(btn => {
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

  renderEmptyState() {
    return `
      <div class="vo2-empty">
        <i data-feather="slash"></i>
        <h3>No VO₂ Max Data</h3>
        <p>Upload maximal efforts with both power and heart rate to unlock VO₂ insights and progression tracking.</p>
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

  renderChart() {
    const chartCanvasTrend = document.getElementById('vo2-trend-chart');
    const chartCanvas = document.getElementById('vo2maxChart');
    const intensityCanvas = document.getElementById('vo2-intensity-chart');
    const weeklyCanvas = document.getElementById('vo2-weekly-chart');

    if (!this.metrics?.hasData || typeof Chart === 'undefined') return;

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
          ticks: {
            callback: value => `${value}`
          },
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

    if (this.heroChart) {
      this.heroChart.destroy();
      this.heroChart = null;
    }

    this.additionalCharts.forEach(chart => chart.destroy());
    this.additionalCharts = [];

    // Main chart in section
    if (chartCanvas) {
      this.trendChart = new Chart(chartCanvas, {
        type: 'line',
        data: chartData,
        options
      });
    }

    // Small summary chart inside hero
    if (chartCanvasTrend) {
      const heroData = {
        labels: chartData.labels,
        datasets: chartData.datasets.map((dataset, index) => ({
          ...dataset,
          borderWidth: index === 0 ? 2.5 : 2,
          backgroundColor: index === 0
            ? 'rgba(59, 130, 246, 0.18)'
            : 'rgba(129, 140, 248, 0.18)',
          borderColor: index === 0 ? '#2563eb' : 'rgba(79, 70, 229, 0.7)',
          pointRadius: 0,
          pointHoverRadius: 2
        }))
      };
      this.heroChart = new Chart(chartCanvasTrend, {
        type: 'line',
        data: heroData,
        options: {
          ...options,
          scales: {
            ...options.scales,
            y: {
              ...options.scales.y,
              grid: { color: 'rgba(148, 163, 184, 0.12)', lineWidth: 1 }
            }
          }
        }
      });
    }

    // Intensity composition chart
    if (intensityCanvas) {
      const dist = this.metrics.trainingDistribution || {};
      const intensityChart = new Chart(intensityCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Recovery', 'Aerobic', 'Tempo', 'Threshold', 'VO₂'],
          datasets: [
            {
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
              borderWidth: 2,
              hoverOffset: 6
            }
          ]
        },
        options: {
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 14,
                font: { size: 12, weight: '600' },
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
              backgroundColor: 'rgba(99, 102, 241, 0.55)',
              borderColor: 'rgba(99, 102, 241, 0.85)',
              borderRadius: 12,
              maxBarThickness: 42
            },
            {
              type: 'line',
              label: 'Δ vs prior week',
              data: weeklyDelta,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.2)',
              yAxisID: 'y1',
              tension: 0.35,
              pointRadius: 4,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
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
              ticks: { font: { size: 12, weight: '600' } }
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                usePointStyle: true,
                font: { size: 12, weight: '600' },
                color: '#334155'
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
      const diff = (day === 0 ? -6 : 1) - day; // align to Monday
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
    if (this.heroChart) {
      this.heroChart.destroy();
      this.heroChart = null;
    }
    this.additionalCharts.forEach(chart => chart.destroy());
    this.additionalCharts = [];
  }
}

const vo2maxPage = new VO2MaxPage();
export default vo2maxPage;
