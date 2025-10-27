// ============================================
// FILE: pages/training-load/index.js
// Training Load Analysis Page - PREMIUM DESIGN
// ============================================

import Services from '../../services/index.js';
import { MetricCard, InsightCard, LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

class TrainingLoadPage {
  constructor() {
    this.config = CONFIG;
    this.chart = null;
    this.currentDays = 90;
    this.data = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('training-load');
      
      this.renderLoading();
      
      // Fetch data
      const [data, settings] = await Promise.all([
        Services.data.getTrainingLoad({ days: this.currentDays }),
        Services.data.getSettings()
      ]);
      
      this.data = data;
      this.settings = settings;
      
      // Generate insights
      this.insights = Services.insight.generateTrainingLoadInsights(data);
      
      // Render
      this.render();
      this.initChart();
      this.setupEventListeners();
      
    } catch (error) {
      console.error('[TrainingLoadPage] Load error:', error);
      Services.analytics.trackError('training_load_page_load', error.message);
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('page-content') || document.getElementById('pageContent');
    if (!container) return;
    
    const { current, daily } = this.data;
    
    // ✅ Using PREMIUM CSS classes from training-load.css
    container.innerHTML = `
      <div class="tl-section">
        <!-- Header -->
        <div class="tl-header">
          <h1>Training Load Analysis</h1>
          <p>Track your chronic training load (CTL), acute training load (ATL), and training stress balance (TSB)</p>
        </div>

        <!-- Metrics Grid - Reuses metric-card from overview.css -->
        <div class="metrics-grid">
          ${this.renderMetrics()}
        </div>

        <!-- Chart Card -->
        <div class="tl-chart-card">
          <div class="tl-chart-header">
            <div class="tl-chart-header-content">
              <div class="tl-chart-title-row">
                <div class="tl-chart-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                </div>
                <div>
                  <div class="tl-chart-title">Training Load Progression</div>
                  <div class="tl-chart-subtitle">CTL, ATL, and TSB over time</div>
                </div>
              </div>
            </div>
            <div class="tl-chart-controls">
              <button class="tl-chart-control ${this.currentDays === 30 ? 'active' : ''}" 
                      data-days="30">30d</button>
              <button class="tl-chart-control ${this.currentDays === 90 ? 'active' : ''}" 
                      data-days="90">90d</button>
              <button class="tl-chart-control ${this.currentDays === 180 ? 'active' : ''}" 
                      data-days="180">180d</button>
              <button class="tl-chart-control ${this.currentDays === 365 ? 'active' : ''}" 
                      data-days="365">1 Year</button>
            </div>
          </div>
          <div class="tl-chart-container">
            <canvas id="trainingLoadChart"></canvas>
          </div>
        </div>

        <!-- Training Load Info Cards -->
        <div class="tl-info-grid">
          ${this.renderInfoCards()}
        </div>

        <!-- AI Insights -->
        ${this.insights && this.insights.length > 0 ? `
          <div class="tl-insights-section">
            <h3 class="tl-insights-title">Training Insights & Recommendations</h3>
            <div class="insights-grid">
              ${this.insights.map(insight => InsightCard(insight)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    // Initialize Feather icons
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  renderMetrics() {
    if (!this.data || !this.data.current) {
      return LoadingSkeleton({ type: 'metric', count: 3 });
    }
    
    const { ctl, atl, tsb } = this.data.current;
    
    // ✅ Using metric-card component with premium styling
    return `
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon primary">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <div class="metric-label">Fitness (CTL)</div>
        </div>
        <div class="metric-value">${ctl.toFixed(1)}</div>
        <div class="metric-subtitle">Chronic Training Load</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon red">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="metric-label">Fatigue (ATL)</div>
        </div>
        <div class="metric-value">${atl.toFixed(1)}</div>
        <div class="metric-subtitle">Acute Training Load</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon ${this.getTSBIconVariant(tsb)}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="metric-label">Form (TSB)</div>
        </div>
        <div class="metric-value">${tsb.toFixed(1)}</div>
        <div class="metric-subtitle">${this.getTSBStatus(tsb)}</div>
      </div>
    `;
  }

  renderInfoCards() {
    return `
      <div class="tl-info-card">
        <div class="tl-info-header">
          <div class="tl-info-icon primary">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <h4 class="tl-info-title">CTL (Fitness)</h4>
        </div>
        <p class="tl-info-text">
          Chronic Training Load represents your long-term fitness. A higher CTL means you're more fit. 
          It's calculated as a 42-day exponentially weighted average of your daily training stress.
        </p>
      </div>
      
      <div class="tl-info-card">
        <div class="tl-info-header">
          <div class="tl-info-icon danger">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h4 class="tl-info-title">ATL (Fatigue)</h4>
        </div>
        <p class="tl-info-text">
          Acute Training Load represents your short-term fatigue. High ATL means you need recovery. 
          It's calculated as a 7-day exponentially weighted average of recent training stress.
        </p>
      </div>
      
      <div class="tl-info-card">
        <div class="tl-info-header">
          <div class="tl-info-icon warning">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h4 class="tl-info-title">TSB (Form)</h4>
        </div>
        <p class="tl-info-text">
          Training Stress Balance (CTL - ATL) indicates your form. Positive values mean you're fresh, 
          negative means fatigued. Aim for slight positive TSB before important events.
        </p>
      </div>
    `;
  }

  renderLoading() {
    const container = document.getElementById('page-content') || document.getElementById('pageContent');
    if (!container) return;
    
    container.innerHTML = `
      <div class="tl-section">
        <div class="metrics-grid">
          ${LoadingSkeleton({ type: 'metric', count: 3 })}
        </div>
        ${LoadingSkeleton({ type: 'chart', count: 1 })}
      </div>
    `;
  }

  renderError(error) {
    const container = document.getElementById('page-content') || document.getElementById('pageContent');
    if (!container) return;
    
    container.innerHTML = `
      <div class="no-data">
        <svg style="width: 64px; height: 64px; margin-bottom: 16px; color: var(--text-tertiary); opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">Failed to Load Training Load</h3>
        <p style="margin-bottom: 16px;">${this.escapeHtml(error.message)}</p>
        <button class="btn btn--primary" onclick="window.router.refresh()">
          Try Again
        </button>
      </div>
    `;
  }

  // ========== CHART ==========

  initChart() {
    const canvas = document.getElementById('trainingLoadChart');
    if (!canvas || !this.data) return;
    
    const { daily } = this.data;
    
    const chartPacket = Services.chart.prepareTrainingLoadChart(daily);
    const chartData = {
      labels: chartPacket.labels,
      datasets: chartPacket.datasets
    };
    const chartOptions = Services.chart.getTrainingLoadChartOptions(chartPacket.meta);
    
    chartOptions.onClick = () => {
      Services.analytics.trackChartInteraction('training-load', 'click');
    };
    
    this.chart = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
  }

  updateChart() {
    if (!this.chart || !this.data) return;
    
    const chartPacket = Services.chart.prepareTrainingLoadChart(this.data.daily);
    this.chart.options = Services.chart.getTrainingLoadChartOptions(chartPacket.meta);
    this.chart.data = {
      labels: chartPacket.labels,
      datasets: chartPacket.datasets
    };
    this.chart.update();
  }

  // ========== EVENT LISTENERS ==========

  setupEventListeners() {
    // Time range buttons
    document.querySelectorAll('.tl-chart-control').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleTimeRangeChange(e));
    });
  }

  async handleTimeRangeChange(event) {
    const days = parseInt(event.target.dataset.days);
    if (!days || days === this.currentDays) return;
    
    this.currentDays = days;
    
    Services.analytics.trackTimeRangeChange('training-load', `${days}d`);
    
    try {
      // Update button states
      document.querySelectorAll('.tl-chart-control').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
      });
      
      // Fetch new data
      this.data = await Services.data.getTrainingLoad({ 
        days, 
        forceRefresh: true 
      });
      
      // Regenerate insights
      this.insights = Services.insight.generateTrainingLoadInsights(this.data);
      
      // Update chart
      this.updateChart();
      
    } catch (error) {
      console.error('[TrainingLoadPage] Time range change error:', error);
      Services.analytics.trackError('training_load_range_change', error.message);
    }
  }

  // ========== HELPERS ==========

  getTrend(metric) {
    if (!this.data || !this.data.daily || this.data.daily.length < 7) return null;
    
    const data = this.data.daily;
    const recent = data.slice(-3).reduce((sum, d) => sum + d[metric], 0) / 3;
    const older = data.slice(-7, -3).reduce((sum, d) => sum + d[metric], 0) / 4;
    
    const change = ((recent - older) / older) * 100;
    
    if (Math.abs(change) < 2) return null;
    return change > 0 ? 'up' : 'down';
  }

  getTSBIconVariant(tsb) {
    if (tsb >= 10) return 'green';
    if (tsb >= -10) return 'amber';
    return 'red';
  }

  getTSBStatus(tsb) {
    if (tsb >= 25) return 'Very Fresh';
    if (tsb >= 10) return 'Fresh';
    if (tsb >= -10) return 'Neutral';
    if (tsb >= -20) return 'Fatigued';
    if (tsb >= -30) return 'Very Fatigued';
    return 'Critical Fatigue';
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== LIFECYCLE ==========

  onShow() {
    console.log('[TrainingLoadPage] Page shown');
  }

  onHide() {
    console.log('[TrainingLoadPage] Page hidden');
  }

  onUnload() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    console.log('[TrainingLoadPage] Page unloaded');
  }
}

// Create singleton instance
const trainingLoadPage = new TrainingLoadPage();

// Export for router
export default trainingLoadPage;
export { trainingLoadPage };
