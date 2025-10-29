// ============================================================
// TRAINING LOAD PAGE – DASHBOARD-ALIGNED EXPERIENCE
// ============================================================

import Services from '../../services/index.js';
import { LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

class TrainingLoadPage {
  constructor() {
    this.config = CONFIG;
    this.currentDays = 90;
    this.data = [];
    this.metrics = null;
    this.insights = [];
    this.mainChart = null;
    this.weeklyChart = null;
    this.distributionChart = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('training-load');
      this.renderLoading();
      await this.fetchData(this.currentDays);
      this.render();
      this.renderCharts();
      this.setupEventListeners();
    } catch (error) {
      console.error('[TrainingLoadPage] load failed:', error);
      Services.analytics.trackError('training_load_load', error.message);
      this.renderError(error);
    }
  }

  async fetchData(days, { forceRefresh = false } = {}) {
    const response = await Services.data.getTrainingLoad({ days, forceRefresh });
    const normalised = this.normaliseResponse(response);
    this.data = normalised;
    this.metrics = this.computeMetrics(normalised, days);

    const structuredForInsights = {
      current: this.metrics?.current || null,
      daily: normalised.map(entry => ({
        date: entry.date,
        ctl: entry.ctl,
        atl: entry.atl,
        tsb: entry.tsb,
        tss: entry.tss
      }))
    };

    this.insights = Services.insight.generateTrainingLoadInsights(structuredForInsights);
    this.currentDays = days;
  }

  renderLoading() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    container.innerHTML = LoadingSkeleton({ type: 'chart', count: 2 });
  }

  render() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;

    if (!this.metrics?.hasData) {
      container.innerHTML = this.renderEmptyState();
      if (typeof feather !== 'undefined') feather.replace();
      return;
    }

    container.innerHTML = `
      <div class="tl-shell">
        ${this.renderHero()}
        ${this.renderTrendSection()}
        ${this.renderVisualisationsSection()}
        ${this.renderHighlightsSection()}
        ${this.renderInsightsSection()}
      </div>
    `;

    if (typeof feather !== 'undefined') {
      feather.replace();
    }

    this.attachTooltips();
  }

  renderHero() {
    const {
      current,
      ctlChangeShort,
      atlChangeShort,
      tsbStatus,
      rollingTss7,
      heavyDays,
      moderateDays,
      acuteChronicRatio,
      trainingStreak
    } = this.metrics;

    return `
      <section class="tl-hero">
        <div class="tl-hero__content">
          <div class="tl-hero__meta">
            <span class="tl-pill"><i data-feather="activity"></i>Training Load</span>
            <span class="tl-pill tl-pill--muted"><i data-feather="calendar"></i>Last ${this.currentDays} days</span>
            <span class="tl-pill tl-pill--muted">${trainingStreak}d load streak</span>
          </div>

          <h1>Training Load Overview</h1>
          <p class="tl-hero__description">
            Monitor chronic fitness (CTL), acute fatigue (ATL), and your training stress balance to keep progression and recovery in sync.
          </p>

          <div class="tl-hero__stats">
            <div class="tl-stat-card" data-tooltip="Chronic Training Load represents long-term fitness based on your recent workload.">
              <span class="tl-stat-label">Fitness (CTL)</span>
              <span class="tl-stat-value">${this.formatNumber(current.ctl, 1)}</span>
              <span class="tl-stat-meta">Δ 14d: ${this.formatDelta(ctlChangeShort)}</span>
            </div>
            <div class="tl-stat-card" data-tooltip="Acute Training Load captures how much stress you accumulated recently.">
              <span class="tl-stat-label">Fatigue (ATL)</span>
              <span class="tl-stat-value">${this.formatNumber(current.atl, 1)}</span>
              <span class="tl-stat-meta">Δ 7d: ${this.formatDelta(atlChangeShort)}</span>
            </div>
            <div class="tl-stat-card" data-tooltip="Training Stress Balance (TSB) reflects your freshness. Positive values indicate readiness, negative values signal fatigue.">
              <span class="tl-stat-label">Form (TSB)</span>
              <span class="tl-stat-value">${this.formatNumber(current.tsb, 1)}</span>
              <span class="tl-stat-meta">${tsbStatus.label}</span>
            </div>
          </div>

          <div class="tl-hero__quick-stats">
            <div class="tl-quick-stat">
              <span class="tl-quick-stat__label">7-day Load</span>
              <span class="tl-quick-stat__value">${this.formatNumber(rollingTss7, 0)} TSS</span>
              <span class="tl-quick-stat__meta">Rolling weekly stress</span>
            </div>
            <div class="tl-quick-stat">
              <span class="tl-quick-stat__label">High Load Days</span>
              <span class="tl-quick-stat__value">${heavyDays}</span>
              <span class="tl-quick-stat__meta">${moderateDays} productive days</span>
            </div>
            <div class="tl-quick-stat">
              <span class="tl-quick-stat__label">Acute : Chronic</span>
              <span class="tl-quick-stat__value">${this.formatNumber(acuteChronicRatio, 2)}</span>
              <span class="tl-quick-stat__meta">Balance between fatigue and fitness</span>
            </div>
          </div>

          <div class="tl-hero__controls">
            ${[30, 60, 90, 180, 365].map(days => `
              <button class="tl-range-btn ${this.currentDays === days ? 'active' : ''}" data-range="${days}">${days <= 360 ? `${days}d` : '1y'}</button>
            `).join('')}
          </div>
        </div>

        <div class="tl-hero__chart">
          <div class="tl-hero__chart-header">
            <h3>CTL · ATL · TSB Overview</h3>
            <button class="tl-info-icon" data-tooltip="Bars show daily training stress; lines track chronic and acute load while form reflects ATL minus CTL.">
              <i data-feather="info"></i>
            </button>
          </div>
          <div class="tl-hero__chart-wrapper">
            <canvas id="tl-trend-chart" aria-label="Training load trend chart"></canvas>
          </div>
        </div>
      </section>
    `;
  }

  renderTrendSection() {
    return `
      <section class="tl-section">
        <header class="tl-section__header">
          <h2 class="tl-section__title">Daily Load History</h2>
          <p class="tl-section__subtitle">Track how fitness, fatigue, and form evolve alongside daily training stress.</p>
        </header>
        <div class="tl-chart-card">
          <div class="tl-chart-card__header">
            <div>
              <h3>Training Load Timeline</h3>
              <span class="tl-chart-card__hint">CTL · ATL · TSB with daily TSS</span>
            </div>
          </div>
          <div class="tl-chart-card__body">
            <canvas id="tl-main-chart"></canvas>
          </div>
        </div>
      </section>
    `;
  }

  renderVisualisationsSection() {
    const hasDistribution = this.metrics?.loadDistribution?.total > 0;
    const hasWeekly = Array.isArray(this.metrics?.weeklyTrend) && this.metrics.weeklyTrend.length > 0;

    if (!hasDistribution && !hasWeekly) return '';

    const cards = [];

    if (hasDistribution) {
      cards.push(`
        <article class="tl-visual-card">
          <div class="tl-visual-card__header">
            <h3>Load Distribution</h3>
            <button class="tl-info-icon" data-tooltip="Split by daily training stress scores. Heavy > 100 TSS, productive 50-100 TSS, easy < 50 TSS.">
              <i data-feather="pie-chart"></i>
            </button>
          </div>
          <div class="tl-visual-card__body">
            <canvas id="tl-distribution-chart"></canvas>
          </div>
        </article>
      `);
    }

    if (hasWeekly) {
      cards.push(`
        <article class="tl-visual-card">
          <div class="tl-visual-card__header">
            <h3>Weekly Stress Trend</h3>
            <button class="tl-info-icon" data-tooltip="Weekly TSS (bars) with change from the previous week (line).">
              <i data-feather="trending-up"></i>
            </button>
          </div>
          <div class="tl-visual-card__body">
            <canvas id="tl-weekly-chart"></canvas>
          </div>
        </article>
      `);
    }

    return `
      <section class="tl-section">
        <header class="tl-section__header">
          <h2 class="tl-section__title">Adaptation Visualisations</h2>
          <p class="tl-section__subtitle">See how day-to-day stress combines into productive build phases and freshness windows.</p>
        </header>
        <div class="tl-visual-grid">
          ${cards.join('')}
        </div>
      </section>
    `;
  }

  renderHighlightsSection() {
    const { tsbStatus, loadDistribution, volatilityScore, longestBuildStreak, lightDaysUpcoming } = this.metrics;

    return `
      <section class="tl-section">
        <header class="tl-section__header">
          <h2 class="tl-section__title">Focus Highlights</h2>
          <p class="tl-section__subtitle">Quick-read coaching cues derived from your current training block.</p>
        </header>
        <div class="tl-highlight-grid">
          <article class="tl-highlight-card">
            <header>
              <span class="tl-pill ${tsbStatus.badgeClass}">${tsbStatus.label}</span>
              <button class="tl-info-icon" data-tooltip="TSB compares ATL and CTL to indicate freshness. Aim for small positives before goal events.">
                <i data-feather="info"></i>
              </button>
            </header>
            <p>${tsbStatus.description}</p>
            <footer>${lightDaysUpcoming > 0 ? `${lightDaysUpcoming} light days in next week recommended.` : 'Maintain current recovery rhythm.'}</footer>
          </article>
          <article class="tl-highlight-card">
            <header>
              <span class="tl-pill tl-pill--primary">Load Mix</span>
              <button class="tl-info-icon" data-tooltip="Breakdown of easy, productive, and heavy days based on daily TSS.">
                <i data-feather="bar-chart-2"></i>
              </button>
            </header>
            <p>Easy ${this.formatNumber(loadDistribution.easyPct, 0)}% · Productive ${this.formatNumber(loadDistribution.steadyPct, 0)}% · Heavy ${this.formatNumber(loadDistribution.intensePct, 0)}%.</p>
            <footer>${longestBuildStreak} day build streak detected.</footer>
          </article>
          <article class="tl-highlight-card">
            <header>
              <span class="tl-pill tl-pill--success">Consistency</span>
              <button class="tl-info-icon" data-tooltip="Week-to-week TSS volatility below 15% indicates a smooth progressive build.">
                <i data-feather="target"></i>
              </button>
            </header>
            <p>${volatilityScore.label}</p>
            <footer>Week-to-week change: ${this.formatNumber(volatilityScore.changePct, 1)}%</footer>
          </article>
        </div>
      </section>
    `;
  }

  renderInsightsSection() {
    if (!this.insights || !this.insights.length) {
      return '';
    }

    const cards = this.insights.map(insight => `
      <article class="tl-insight-card">
        <header>
          <span class="tl-pill ${this.getInsightBadgeClass(insight.type)}">${this.escapeHtml(insight.title)}</span>
          <button class="tl-info-icon" data-tooltip="${this.escapeHtml(insight.text)}"><i data-feather="help-circle"></i></button>
        </header>
        <p>${this.escapeHtml(insight.text)}</p>
        ${insight.recommendations && insight.recommendations.length ? `
          <footer>
            ${insight.recommendations.map(item => `<span>• ${this.escapeHtml(item)}</span>`).join('<br/>')}
          </footer>
        ` : ''}
      </article>
    `).join('');

    return `
      <section class="tl-section">
        <header class="tl-section__header">
          <h2 class="tl-section__title">Training Insights</h2>
          <p class="tl-section__subtitle">AI-generated guidance to balance your build and recovery phases.</p>
        </header>
        <div class="tl-insight-grid">
          ${cards}
        </div>
      </section>
    `;
  }

  renderEmptyState() {
    return `
      <div class="tl-empty">
        <i data-feather="slash"></i>
        <h3>No training load data</h3>
        <p>Log rides or import workouts to unlock fitness, fatigue, and form analytics.</p>
      </div>
    `;
  }

  renderError(error) {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    container.innerHTML = `
      <div class="tl-empty">
        <i data-feather="alert-triangle"></i>
        <h3>Training load unavailable</h3>
        <p>${this.escapeHtml(error?.message || 'Failed to load training load data')}</p>
      </div>
    `;
  }

  renderCharts() {
    const trendCanvas = document.getElementById('tl-main-chart');
    const heroCanvas = document.getElementById('tl-trend-chart');
    const distributionCanvas = document.getElementById('tl-distribution-chart');
    const weeklyCanvas = document.getElementById('tl-weekly-chart');

    if (!this.metrics?.hasData || typeof Chart === 'undefined') return;

    const labels = this.data.map(entry => this.formatDate(entry.date));
    const tssValues = this.data.map(entry => entry.tss || 0);
    const ctlValues = this.data.map(entry => entry.ctl || 0);
    const atlValues = this.data.map(entry => entry.atl || 0);
    const tsbValues = this.data.map(entry => entry.tsb || 0);

    const colors = CONFIG.CHART_COLORS || {
      primary: '#2563eb',
      secondary: '#7c3aed',
      info: '#0ea5e9',
      warning: '#f59e0b'
    };

    if (this.mainChart) {
      this.mainChart.destroy();
      this.mainChart = null;
    }
    if (this.weeklyChart) {
      this.weeklyChart.destroy();
      this.weeklyChart = null;
    }
    if (this.distributionChart) {
      this.distributionChart.destroy();
      this.distributionChart = null;
    }

    if (trendCanvas) {
      this.mainChart = new Chart(trendCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: 'Daily TSS',
              data: tssValues,
              backgroundColor: 'rgba(14, 165, 233, 0.25)',
              borderColor: 'rgba(14, 165, 233, 0.55)',
              borderWidth: 1,
              borderRadius: 6,
              yAxisID: 'tss'
            },
            {
              type: 'line',
              label: 'CTL',
              data: ctlValues,
              borderColor: colors.primary || '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              borderWidth: 2.5,
              fill: false,
              tension: 0.3,
              pointRadius: 0,
              yAxisID: 'load'
            },
            {
              type: 'line',
              label: 'ATL',
              data: atlValues,
              borderColor: colors.secondary || '#7c3aed',
              backgroundColor: 'rgba(124, 58, 237, 0.12)',
              borderWidth: 2.5,
              fill: false,
              tension: 0.3,
              pointRadius: 0,
              yAxisID: 'load'
            },
            {
              type: 'line',
              label: 'TSB',
              data: tsbValues,
              borderColor: '#0f172a',
              backgroundColor: 'rgba(15, 23, 42, 0.08)',
              borderWidth: 2,
              fill: false,
              borderDash: [6, 4],
              tension: 0.3,
              pointRadius: 0,
              yAxisID: 'tsb'
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            tss: {
              position: 'left',
              beginAtZero: true,
              grid: { color: 'rgba(148, 163, 184, 0.12)' },
              title: { display: true, text: 'TSS', font: { size: 12, weight: '600' } }
            },
            load: {
              position: 'right',
              grid: { display: false },
              title: { display: true, text: 'Load', font: { size: 12, weight: '600' } }
            },
            tsb: {
              position: 'right',
              grid: { display: false },
              suggestedMin: Math.min(...tsbValues, -20),
              suggestedMax: Math.max(...tsbValues, 20),
              ticks: { callback: value => `${value}` },
              title: { display: true, text: 'TSB', font: { size: 12, weight: '600' } }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { usePointStyle: true, color: '#334155' }
            },
            tooltip: {
              callbacks: {
                label: context => `${context.dataset.label}: ${this.formatNumber(context.parsed.y, 1)}`
              }
            }
          }
        }
      });
    }

    if (heroCanvas) {
      new Chart(heroCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'CTL',
              data: ctlValues,
              borderColor: colors.primary || '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.08)',
              fill: true,
              borderWidth: 2.5,
              tension: 0.35,
              pointRadius: 0
            },
            {
              label: 'ATL',
              data: atlValues,
              borderColor: colors.secondary || '#7c3aed',
              backgroundColor: 'rgba(124, 58, 237, 0.08)',
              fill: false,
              borderWidth: 2,
              tension: 0.35,
              pointRadius: 0
            },
            {
              label: 'TSB',
              data: tsbValues,
              borderColor: '#0f172a',
              backgroundColor: 'rgba(15, 23, 42, 0.05)',
              fill: false,
              borderWidth: 1.5,
              borderDash: [6, 4],
              tension: 0.35,
              pointRadius: 0
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: false,
              grid: { color: 'rgba(148, 163, 184, 0.12)' }
            },
            x: {
              grid: { display: false }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: context => `${context.dataset.label}: ${this.formatNumber(context.parsed.y, 1)}`
              }
            }
          }
        }
      });
    }

    if (distributionCanvas && this.metrics?.loadDistribution?.total > 0) {
      const { easyPct, steadyPct, intensePct } = this.metrics.loadDistribution;
      this.distributionChart = new Chart(distributionCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Easy', 'Productive', 'Heavy'],
          datasets: [{
            data: [easyPct, steadyPct, intensePct],
            backgroundColor: [
              'rgba(191, 219, 254, 0.85)',
              'rgba(125, 211, 252, 0.85)',
              'rgba(99, 102, 241, 0.85)'
            ],
            borderColor: '#fff',
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          plugins: {
            legend: {
              position: 'bottom',
              labels: { usePointStyle: true, color: '#334155' }
            }
          }
        }
      });
    }

    if (weeklyCanvas && this.metrics.weeklyTrend.length) {
      const weeklyLabels = this.metrics.weeklyTrend.map(item => item.label);
      const weeklyLoad = this.metrics.weeklyTrend.map(item => item.load);
      const weeklyDelta = this.metrics.weeklyTrend.map(item => item.delta);
      const maxDelta = weeklyDelta.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);
      const deltaRange = Math.max(25, Math.ceil(maxDelta / 10) * 10);

      this.weeklyChart = new Chart(weeklyCanvas, {
        type: 'bar',
        data: {
          labels: weeklyLabels,
          datasets: [
            {
              type: 'bar',
              label: 'Weekly TSS',
              data: weeklyLoad,
              backgroundColor: 'rgba(165, 180, 252, 0.65)',
              borderColor: 'rgba(99, 102, 241, 0.85)',
              borderWidth: 1,
              borderRadius: 10,
              yAxisID: 'load'
            },
            {
              type: 'line',
              label: 'Δ vs prior week',
              data: weeklyDelta,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.2)',
              yAxisID: 'delta',
              tension: 0.3,
              pointRadius: 4,
              pointHoverRadius: 6
            }
          ]
        },
        options: {
          maintainAspectRatio: false,
          scales: {
            load: {
              beginAtZero: true,
              grid: { color: 'rgba(148, 163, 184, 0.12)' },
              title: { display: true, text: 'Weekly TSS', font: { size: 12, weight: '600' } }
            },
            delta: {
              position: 'right',
              beginAtZero: true,
              suggestedMin: -deltaRange,
              suggestedMax: deltaRange,
              grid: { display: false },
              ticks: { callback: value => `${value > 0 ? '+' : ''}${Number(value).toFixed(0)}` },
              title: { display: true, text: 'Δ TSS', font: { size: 12, weight: '600' }, color: '#2563eb' }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 12, weight: '600' } }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: { usePointStyle: true, color: '#334155' }
            }
          }
        }
      });
    }
  }

  setupEventListeners() {
    document.querySelectorAll('.tl-range-btn').forEach(btn => {
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

  attachTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
      element.addEventListener('mouseenter', () => element.classList.add('has-tooltip'));
      element.addEventListener('mouseleave', () => element.classList.remove('has-tooltip'));
    });
  }

  normaliseResponse(source) {
    if (!source) return [];

    const collected = [];

    const pushEntry = entry => {
      if (!entry) return;

      const rawDate = entry.date || entry.day || entry.timestamp;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime())) return;

      const record = {
        date: parsedDate.toISOString(),
        ctl: this.toNumber(entry.ctl ?? entry.CTL),
        atl: this.toNumber(entry.atl ?? entry.ATL),
        tsb: this.toNumber(entry.tsb ?? entry.TSB),
        tss: this.toNumber(entry.tss ?? entry.TSS ?? entry.load),
        distance: this.toNumber(entry.distance ?? 0)
      };

      collected.push(record);
    };

    const handleArray = arr => {
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
  }

  computeMetrics(data, periodDays) {
    if (!Array.isArray(data) || !data.length) {
      return { hasData: false };
    }

    const latest = data[data.length - 1];
    const previous = data[Math.max(0, data.length - 2)];
    const ctlChangeShort = latest.ctl - (this.findEntryDaysAgo(data, 14)?.ctl ?? previous.ctl);
    const atlChangeShort = latest.atl - (this.findEntryDaysAgo(data, 7)?.atl ?? previous.atl);

    const rollingTss7 = this.calculateRollingSum(data, 7, 'tss');
    const loadDistribution = this.calculateDistribution(data);
    const weeklyBuckets = this.buildWeeklyBuckets(data);

    const weeklyTrend = weeklyBuckets.map((bucket, index) => {
      const previousBucket = weeklyBuckets[index - 1];
      const delta = previousBucket ? bucket.tss - previousBucket.tss : 0;
      return {
        label: this.formatWeekLabel(bucket.start),
        load: Number(bucket.tss.toFixed(1)),
        delta: Number(delta.toFixed(1))
      };
    });

    const acuteChronicRatio = latest.ctl > 0 ? latest.atl / latest.ctl : 0;
    const tsbStatus = this.getTsbStatus(latest.tsb);
    const volatilityScore = this.calculateVolatility(weeklyBuckets);
    const longestBuildStreak = this.calculateLongestBuildStreak(data);
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
      trainingStreak: this.calculateTrainingStreak(data)
    };
  }

  calculateDistribution(data) {
    const distribution = {
      easy: 0,
      steady: 0,
      intense: 0,
      easyCount: 0,
      steadyCount: 0,
      intenseCount: 0,
      total: 0
    };

    data.forEach(entry => {
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
  }

  buildWeeklyBuckets(data) {
    const buckets = new Map();

    data.forEach(entry => {
      const date = new Date(entry.date);
      if (Number.isNaN(date.getTime())) return;

      const start = this.getWeekStart(date);
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
      .map(bucket => ({
        ...bucket,
        ctlAvg: bucket.count ? bucket.ctl / bucket.count : 0,
        atlAvg: bucket.count ? bucket.atl / bucket.count : 0,
        tsbAvg: bucket.count ? bucket.tsb / bucket.count : 0
      }))
      .sort((a, b) => a.start - b.start);
  }

  calculateRollingSum(data, days, field) {
    const recent = data.slice(-days);
    return recent.reduce((sum, entry) => sum + (entry[field] || 0), 0);
  }

  calculateVolatility(weeklyBuckets) {
    if (!weeklyBuckets.length) {
      return { label: 'Insufficient data', changePct: 0 };
    }

    const values = weeklyBuckets.map(bucket => bucket.tss);
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
  }

  calculateLongestBuildStreak(data) {
    let streak = 0;
    let longest = 0;

    data.forEach(entry => {
      if ((entry.tss || 0) >= 50) {
        streak += 1;
        longest = Math.max(longest, streak);
      } else {
        streak = 0;
      }
    });

    return longest;
  }

  calculateTrainingStreak(data) {
    let streak = 0;
    for (let i = data.length - 1; i >= 0; i -= 1) {
      if ((data[i].tss || 0) > 0) streak += 1;
      else break;
    }
    return streak;
  }

  findEntryDaysAgo(data, days) {
    if (!data.length) return null;
    const target = Date.now() - (days * 24 * 60 * 60 * 1000);
    let closest = null;
    let smallestDiff = Infinity;

    data.forEach(entry => {
      const diff = Math.abs(new Date(entry.date).getTime() - target);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closest = entry;
      }
    });

    return closest;
  }

  getWeekStart(date) {
    const result = new Date(date);
    const day = result.getUTCDay();
    const diff = (day === 0 ? -6 : 1) - day;
    result.setUTCDate(result.getUTCDate() + diff);
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }

  getTsbStatus(tsb) {
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
  }

  toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  formatNumber(value, decimals = 0) {
    if (!Number.isFinite(value)) return '—';
    return Number(value).toFixed(decimals);
  }

  formatDelta(value, decimals = 1) {
    if (!Number.isFinite(value) || Math.abs(value) < 0.05) return '±0.0';
    const sign = value > 0 ? '+' : '';
    return `${sign}${Number(value).toFixed(decimals)}`;
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
    const start = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 6);
    const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${start} – ${endLabel}`;
  }

  getInsightBadgeClass(type) {
    switch (type) {
      case 'success': return 'tl-pill--success';
      case 'warning': return 'tl-pill--warning';
      case 'danger': return 'tl-pill--danger';
      case 'info': return 'tl-pill--primary';
      default: return 'tl-pill--muted';
    }
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
    if (this.mainChart) {
      this.mainChart.destroy();
      this.mainChart = null;
    }
    if (this.weeklyChart) {
      this.weeklyChart.destroy();
      this.weeklyChart = null;
    }
    if (this.distributionChart) {
      this.distributionChart.destroy();
      this.distributionChart = null;
    }
  }
}

const trainingLoadPage = new TrainingLoadPage();
export default trainingLoadPage;
