// ============================================
// 5. EFFICIENCY PAGE
// ============================================

// FILE: pages/efficiency/index.js
import Services from '../../services/index.js';
import { LoadingSkeleton, InsightCard } from '../../components/ui/index.js';
import CONFIG from './config.js';

class EfficiencyPage {
  constructor() {
    this.config = CONFIG;
    this.chart = null;
    this.currentDays = CONFIG.DEFAULT_DAYS?.efficiency || 120;
    this.currentFilter = 'ga1';
    this.data = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('efficiency');
      this.renderLoading();
      
      this.data = await Services.data.getEfficiency({ days: this.currentDays });
      this.insights = Services.insight.generateEfficiencyInsights(this.data.metrics);

      this.render();
      this.initChart();
      this.setupEventListeners();
    } catch (error) {
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent');
    const metrics = this.data?.metrics || {};
    const timeseries = this.data?.timeseries || [];
    const activeSeries = this.getActiveTimeseries();
    const filterLabel = this.currentFilter === 'ga1'
      ? (metrics.ga1Sessions ? 'GA1 focus (<0.75 IF)' : 'GA1 focus unavailable • showing all sessions')
      : 'All sessions';

    container.innerHTML = `
      <div class="eff-page">
        <div class="eff-header">
          <div>
            <h1>Efficiency Analysis</h1>
            <p>Track aerobic efficiency (NP ÷ HR) across your endurance training</p>
          </div>
          <div class="eff-range-controls">
            ${[60, 120, 180, 240].map(days => `
              <button class="eff-range-btn ${this.currentDays === days ? 'active' : ''}" data-days="${days}">${days}d</button>
            `).join('')}
          </div>
        </div>

        ${this.renderMetricSummary(metrics)}

        <div class="eff-chart-card">
          <div class="eff-chart-header">
            <div>
              <h3>Efficiency Trend</h3>
              <p>${activeSeries.length} session${activeSeries.length === 1 ? '' : 's'} plotted • ${filterLabel}</p>
            </div>
            <div class="eff-chart-filters">
              <button class="eff-filter-btn ${this.currentFilter === 'ga1' ? 'active' : ''}" data-filter="ga1">GA1 Sessions</button>
              <button class="eff-filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All Sessions</button>
            </div>
          </div>
          <div class="eff-chart-container">
            <canvas id="efficiencyChart"></canvas>
          </div>
        </div>

        ${this.renderSessionsTable(timeseries)}

        ${this.renderInsightsSection()}
      </div>
    `;

    if (typeof feather !== 'undefined') feather.replace();
  }

  initChart() {
    const canvas = document.getElementById('efficiencyChart');
    if (!canvas || !Array.isArray(this.data?.timeseries)) return;

    const series = this.getActiveTimeseries();
    const chartPacket = Services.chart.prepareEfficiencyChart(series, { includeRolling: true, rollingWindow: 5 });
    const chartData = {
      labels: chartPacket.labels,
      datasets: chartPacket.datasets
    };
    const chartOptions = Services.chart.getEfficiencyChartOptions(chartPacket.meta);

    this.chart = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
  }

  setupEventListeners() {
    document.querySelectorAll('.eff-range-btn[data-days]').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleTimeRangeChange(parseInt(e.currentTarget.dataset.days)));
    });

    document.querySelectorAll('.eff-filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleFilterChange(e.currentTarget.dataset.filter));
    });
  }

  async handleTimeRangeChange(days) {
    if (days === this.currentDays) return;
    
    this.currentDays = days;
    Services.analytics.trackTimeRangeChange('efficiency', `${days}d`);
    
    this.destroyChart();
    this.data = await Services.data.getEfficiency({ days, forceRefresh: true });
    this.insights = Services.insight.generateEfficiencyInsights(this.data.metrics);
    this.render();
    this.initChart();
    this.setupEventListeners();
  }

  handleFilterChange(filter) {
    if (filter === this.currentFilter) return;
    this.currentFilter = filter;
    this.destroyChart();
    this.render();
    this.initChart();
    this.setupEventListeners();
  }

  destroyChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  renderLoading() {
    document.getElementById('pageContent').innerHTML = LoadingSkeleton({ type: 'chart', count: 1 });
  }

  renderError(error) {
    document.getElementById('pageContent').innerHTML = `
      <div class="error-state">
        <h3>Failed to Load Efficiency</h3>
        <p>${error.message}</p>
      </div>
    `;
  }

  onUnload() {
    this.destroyChart();
  }

  getActiveTimeseries() {
    const base = this.data?.timeseries || [];
    if (this.currentFilter === 'ga1') {
      const filtered = base.filter(item => Number.isFinite(item.intensityFactor) && item.intensityFactor < 0.75);
      return filtered.length ? filtered : base;
    }
    return base;
  }

  renderMetricSummary(metrics = {}) {
    const trendArrow = metrics.trend === 'improving' ? '▲' : metrics.trend === 'declining' ? '▼' : '▬';
    const trendClass = metrics.trend === 'improving' ? 'positive' : metrics.trend === 'declining' ? 'negative' : 'neutral';
    const trendPct = Number.isFinite(metrics.trendPct) ? `${metrics.trendPct > 0 ? '+' : ''}${metrics.trendPct.toFixed(1)}%` : '—';
    const delta = Number.isFinite(metrics.currentEf) && Number.isFinite(metrics.averageEfGa1)
      ? metrics.currentEf - metrics.averageEfGa1
      : null;

    return `
      <div class="eff-metrics">
        <div class="eff-metric-card">
          <div class="eff-metric-label">Current EF</div>
          <div class="eff-metric-value">${metrics.currentEf ? metrics.currentEf.toFixed(2) : '—'}
            ${delta !== null ? `<span class="eff-delta ${delta >= 0 ? 'positive' : 'negative'}">${delta >= 0 ? '+' : ''}${delta.toFixed(3)}</span>` : ''}
          </div>
          <div class="eff-metric-sub">Latest GA1 session</div>
        </div>
        <div class="eff-metric-card">
          <div class="eff-metric-label">Average EF (${this.currentDays}d)</div>
          <div class="eff-metric-value">${metrics.averageEfGa1 ? metrics.averageEfGa1.toFixed(2) : '—'}</div>
          <div class="eff-metric-sub">GA1 sessions ● ${metrics.ga1Sessions || 0} of ${metrics.totalSessions || 0}</div>
        </div>
        <div class="eff-metric-card">
          <div class="eff-metric-label">All Sessions Avg</div>
          <div class="eff-metric-value">${metrics.averageEfAll ? metrics.averageEfAll.toFixed(2) : '—'}</div>
          <div class="eff-metric-sub">All rides across range</div>
        </div>
        <div class="eff-metric-card">
          <div class="eff-metric-label">Trend</div>
          <div class="eff-metric-value ${trendClass}">${trendArrow} ${trendPct}</div>
          <div class="eff-metric-sub">${this.formatTrendLabel(metrics.trend)}</div>
        </div>
      </div>
    `;
  }

  renderSessionsTable(timeseries = []) {
    if (!timeseries.length) {
      return `
        <div class="eff-session-card">
          <div class="eff-session-header">
            <h3>Recent Sessions</h3>
            <p>No sessions with efficiency data in the selected range.</p>
          </div>
          <div class="eff-empty">Upload training sessions with both power and heart rate to build your efficiency history.</div>
        </div>
      `;
    }

    const preview = [...timeseries]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8);

    return `
      <div class="eff-session-card">
        <div class="eff-session-header">
          <h3>Recent Sessions</h3>
          <p>Most recent ${preview.length} activities with efficiency data</p>
        </div>
        <div class="eff-session-grid">
          <div class="eff-session-row eff-session-row--head">
            <div>Date</div>
            <div>EF</div>
            <div>NP</div>
            <div>Avg HR</div>
            <div>IF</div>
          </div>
          <div class="eff-session-body">
            ${preview.map(item => `
              <div class="eff-session-row">
                <div>${this.formatDateLong(item.date)}</div>
                <div class="eff-session-ef">${item.ef.toFixed(2)}</div>
                <div>${Number.isFinite(item.np) ? `${item.np.toFixed(0)} W` : '—'}</div>
                <div>${Number.isFinite(item.hr) ? `${item.hr.toFixed(0)} bpm` : '—'}</div>
                <div>${Number.isFinite(item.intensityFactor) ? `${item.intensityFactor.toFixed(2)}${item.ga1 ? ' · GA1' : ''}` : '—'}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderInsightsSection() {
    if (!this.insights || this.insights.length === 0) return '';
    return `
      <div class="eff-insights">
        <h3>Insights & Recommendations</h3>
        <div class="insights-grid">
          ${this.insights.map(i => InsightCard(i)).join('')}
        </div>
      </div>
    `;
  }

  formatTrendLabel(trend) {
    switch (trend) {
      case 'improving':
        return 'Efficiency improving';
      case 'declining':
        return 'Efficiency declining';
      case 'stable':
        return 'Holding steady';
      case 'insufficient_data':
        return 'More GA1 data needed';
      default:
        return 'Not enough data yet';
    }
  }

  formatDateShort(date) {
    if (!(date instanceof Date)) {
      const parsed = new Date(date);
      if (!Number.isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
    if (date instanceof Date) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return String(date ?? '');
  }

  formatDateLong(date) {
    if (!(date instanceof Date)) {
      const parsed = new Date(date);
      if (!Number.isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
    if (date instanceof Date) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return String(date ?? '');
  }
}

const efficiencyPage = new EfficiencyPage();
export default efficiencyPage;
