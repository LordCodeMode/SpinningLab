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
    this.gaugeChart = null;
    this.sparklineCharts = {};
    this.chartMode = 'area'; // area, line
  }

  async load() {
    try {
      Services.analytics.trackPageView('training-load');
      this.renderLoading();
      await this.fetchData(this.currentDays);
      this.render();
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

    // COMPLETELY NEW LAYOUT - Breaking from hero > charts > sections pattern
    container.innerHTML = `
      <div class="tl-dashboard">
        ${this.renderTopBar()}
        ${this.renderMainGrid()}
        ${this.renderBottomInsights()}
      </div>
    `;

    if (typeof feather !== 'undefined') {
      feather.replace();
    }

    this.attachTooltips();
    this.renderGaugeChart();
    this.renderSparklines();
    this.renderAllCharts();
  }

  // COMPLETELY NEW RENDER METHODS - UNIQUE LAYOUT

  renderTopBar() {
    const { tsbStatus, trainingStreak } = this.metrics;
    return `
      <div class="tl-topbar">
        <div class="tl-topbar-left">
          <h1 class="tl-page-title">Training Load</h1>
          <div class="tl-breadcrumb">
            <span class="tl-badge ${tsbStatus.badgeClass}">${tsbStatus.label}</span>
            <span class="tl-badge tl-badge-muted">${trainingStreak}d streak</span>
            <span class="tl-badge tl-badge-muted">${this.currentDays}d view</span>
          </div>
        </div>
        <div class="tl-topbar-controls">
          ${[30, 60, 90, 180, 365].map(days => `
            <button class="tl-range-pill ${this.currentDays === days ? 'active' : ''}" data-range="${days}">
              ${days <= 360 ? days + 'd' : '1y'}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderMainGrid() {
    const { current, ctlChangeShort, atlChangeShort, tsbStatus, rollingTss7, acuteChronicRatio } = this.metrics;
    const weekly = this.data.slice(-7);
    const weeklyAvg = weekly.reduce((sum, d) => sum + (d.tss || 0), 0) / 7;
    const rampRate = weekly.length >= 7 ? (weekly[6].ctl - weekly[0].ctl) : 0;

    return `
      <div class="tl-main-grid">
        <!-- Left Column: Gauge + Quick Stats -->
        <div class="tl-left-column">
          <!-- Form Gauge -->
          <div class="tl-gauge-widget">
            <div class="tl-widget-header">
              <h3>Current Form</h3>
              <span class="tl-widget-badge ${tsbStatus.badgeClass}">${tsbStatus.label}</span>
            </div>
            <div class="tl-gauge-wrapper">
              <canvas id="tl-form-gauge"></canvas>
              <div class="tl-gauge-center">
                <div class="tl-gauge-value">${this.formatNumber(current.tsb, 1)}</div>
                <div class="tl-gauge-label">TSB</div>
              </div>
            </div>
            <p class="tl-gauge-desc">${tsbStatus.description}</p>
          </div>

          <!-- Quick Stats Grid -->
          <div class="tl-quick-grid">
            <div class="tl-stat-mini">
              <div class="tl-stat-mini-label">7d TSS Avg</div>
              <div class="tl-stat-mini-value">${this.formatNumber(weeklyAvg, 0)}</div>
            </div>
            <div class="tl-stat-mini">
              <div class="tl-stat-mini-label">Ramp Rate</div>
              <div class="tl-stat-mini-value">${rampRate > 0 ? '+' : ''}${this.formatNumber(rampRate, 1)}</div>
            </div>
            <div class="tl-stat-mini">
              <div class="tl-stat-mini-label">ATL/CTL</div>
              <div class="tl-stat-mini-value">${this.formatNumber(acuteChronicRatio, 2)}</div>
            </div>
          </div>
        </div>

        <!-- Center Column: Main Chart -->
        <div class="tl-center-column">
          <div class="tl-chart-widget">
            <div class="tl-widget-header">
              <h3>Load Timeline</h3>
              <div class="tl-chart-legend">
                <span class="tl-legend-item"><i style="background:#3b82f6"></i>CTL</span>
                <span class="tl-legend-item"><i style="background:#f59e0b"></i>ATL</span>
                <span class="tl-legend-item"><i style="background:#10b981"></i>TSB</span>
              </div>
            </div>
            <div class="tl-chart-canvas-wrapper">
              <canvas id="tl-main-chart"></canvas>
            </div>
          </div>
        </div>

        <!-- Right Column: Metrics Stack -->
        <div class="tl-right-column">
          <div class="tl-metric-tile" data-color="blue">
            <div class="tl-metric-tile-header">
              <span class="tl-metric-tile-label">Fitness</span>
              <span class="tl-metric-tile-change">${this.formatDelta(ctlChangeShort)}</span>
            </div>
            <div class="tl-metric-tile-value">${this.formatNumber(current.ctl, 1)}</div>
            <div class="tl-metric-tile-chart">
              <canvas id="ctl-sparkline"></canvas>
            </div>
            <div class="tl-metric-tile-footer">Chronic Training Load</div>
          </div>

          <div class="tl-metric-tile" data-color="orange">
            <div class="tl-metric-tile-header">
              <span class="tl-metric-tile-label">Fatigue</span>
              <span class="tl-metric-tile-change">${this.formatDelta(atlChangeShort)}</span>
            </div>
            <div class="tl-metric-tile-value">${this.formatNumber(current.atl, 1)}</div>
            <div class="tl-metric-tile-chart">
              <canvas id="atl-sparkline"></canvas>
            </div>
            <div class="tl-metric-tile-footer">Acute Training Load</div>
          </div>

          <div class="tl-metric-tile" data-color="green">
            <div class="tl-metric-tile-header">
              <span class="tl-metric-tile-label">Form</span>
              <span class="tl-metric-tile-change">TSB</span>
            </div>
            <div class="tl-metric-tile-value">${this.formatNumber(current.tsb, 1)}</div>
            <div class="tl-metric-tile-chart">
              <canvas id="tsb-sparkline"></canvas>
            </div>
            <div class="tl-metric-tile-footer">Training Stress Balance</div>
          </div>
        </div>
      </div>
    `;
  }

  renderBottomInsights() {
    const { loadDistribution, weeklyTrend, volatilityScore, longestBuildStreak } = this.metrics;

    const weeklyCards = weeklyTrend && weeklyTrend.length >= 2 ? weeklyTrend.slice(-4).map(week => `
      <div class="tl-week-card">
        <div class="tl-week-label">${week.label}</div>
        <div class="tl-week-value">${week.load}</div>
        <div class="tl-week-delta ${week.delta >= 0 ? 'positive' : 'negative'}">
          ${week.delta > 0 ? '+' : ''}${week.delta}
        </div>
      </div>
    `).join('') : '';

    return `
      <div class="tl-bottom-section">
        <!-- Weekly Trend Cards -->
        ${weeklyCards ? `
          <div class="tl-weekly-strip">
            <h3 class="tl-section-title">Last 4 Weeks</h3>
            <div class="tl-week-grid">
              ${weeklyCards}
            </div>
          </div>
        ` : ''}

        <!-- Distribution & Insights -->
        <div class="tl-insights-grid">
          <div class="tl-insight-card">
            <div class="tl-insight-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <i data-feather="bar-chart-2"></i>
            </div>
            <div class="tl-insight-content">
              <h4>Load Distribution</h4>
              <p>Easy ${this.formatNumber(loadDistribution.easyPct, 0)}% · Productive ${this.formatNumber(loadDistribution.steadyPct, 0)}% · Heavy ${this.formatNumber(loadDistribution.intensePct, 0)}%</p>
            </div>
          </div>

          <div class="tl-insight-card">
            <div class="tl-insight-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <i data-feather="trending-up"></i>
            </div>
            <div class="tl-insight-content">
              <h4>Consistency</h4>
              <p>${volatilityScore.label} – ${this.formatNumber(volatilityScore.changePct, 1)}% week-to-week variability</p>
            </div>
          </div>

          <div class="tl-insight-card">
            <div class="tl-insight-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <i data-feather="zap"></i>
            </div>
            <div class="tl-insight-content">
              <h4>Build Streak</h4>
              <p>${longestBuildStreak} consecutive productive days detected in this period</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderAllCharts() {
    // Render main chart
    const mainCanvas = document.getElementById('tl-main-chart');
    if (mainCanvas && this.metrics?.hasData) {
      this.renderMainChart();
    }
  }

  renderMainChart() {
    const canvas = document.getElementById('tl-main-chart');
    if (!canvas || typeof Chart === 'undefined' || !this.data) return;

    if (this.mainChart) {
      this.mainChart.destroy();
    }

    const labels = this.data.map(entry => this.formatDate(entry.date));
    const ctlValues = this.data.map(entry => entry.ctl || 0);
    const atlValues = this.data.map(entry => entry.atl || 0);
    const tsbValues = this.data.map(entry => entry.tsb || 0);

    this.mainChart = new Chart(canvas, {
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

  setupEventListeners() {
    document.querySelectorAll('.tl-range-pill').forEach(btn => {
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

  renderGaugeChart() {
    const canvas = document.getElementById('tl-form-gauge');
    if (!canvas || typeof Chart === 'undefined' || !this.metrics) return;

    const tsb = this.metrics.current.tsb || 0;

    // Map TSB to gauge value (0-100 scale)
    const gaugeValue = Math.max(0, Math.min(100, ((tsb + 30) / 55) * 100));

    // Determine color based on TSB
    let gaugeColor;
    if (tsb >= 15) gaugeColor = '#10b981';
    else if (tsb >= 5) gaugeColor = '#3b82f6';
    else if (tsb >= -5) gaugeColor = '#6366f1';
    else if (tsb >= -15) gaugeColor = '#f59e0b';
    else gaugeColor = '#ef4444';

    if (this.gaugeChart) {
      this.gaugeChart.destroy();
    }

    this.gaugeChart = new Chart(canvas, {
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

    // Update status colors
    const statusEl = document.getElementById('tl-gauge-status');
    if (statusEl) {
      statusEl.style.backgroundColor = `${gaugeColor}15`;
      const titleEl = statusEl.querySelector('.tl-gauge-status-title');
      if (titleEl) titleEl.style.color = gaugeColor;
    }
  }

  renderSparklines() {
    if (!this.data || !this.data.length || typeof Chart === 'undefined') return;

    const last30 = this.data.slice(-30);

    this.createSparkline('ctl-sparkline', last30, 'ctl', '#3b82f6');
    this.createSparkline('atl-sparkline', last30, 'atl', '#f59e0b');
    this.createSparkline('tsb-sparkline', last30, 'tsb', '#10b981');
  }

  createSparkline(canvasId, data, field, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const values = data.map(d => d[field] || 0);

    if (this.sparklineCharts[canvasId]) {
      this.sparklineCharts[canvasId].destroy();
    }

    this.sparklineCharts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map(() => ''),
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
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    });
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
    if (this.gaugeChart) {
      this.gaugeChart.destroy();
      this.gaugeChart = null;
    }
    Object.values(this.sparklineCharts).forEach(chart => chart?.destroy());
    this.sparklineCharts = {};
  }
}

const trainingLoadPage = new TrainingLoadPage();
export default trainingLoadPage;
