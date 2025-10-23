// ============================================
// FILE: pages/overview/index.js
// Dashboard Overview Page - UPDATED (Uses external CSS)
// ============================================

import Services from '../../services/index.js';
import { MetricCard, InsightCard, LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

class OverviewPage {
  constructor() {
    this.config = CONFIG;
    this.charts = {};
    this.data = {};
  }

  // ========== LIFECYCLE METHODS ==========

  async load() {
    try {
      Services.analytics.trackPageView('overview');
      
      // Show loading state
      this.renderLoading();
      
      // Fetch all data in parallel
      const [trainingLoad, activities, settings, fitnessState] = await Promise.all([
        Services.data.getTrainingLoad({ days: 30 }),
        Services.data.getActivities({ limit: 5 }),
        Services.data.getSettings(),
        Services.data.getFitnessState().catch(() => null)
      ]);
      
      // Store data
      this.data = {
        trainingLoad,
        activities,
        settings,
        fitnessState
      };
      
      // Generate insights
      const tlInsights = Services.insight.generateTrainingLoadInsights(trainingLoad);
      const fsInsights = fitnessState ? 
        Services.insight.generateFitnessStateInsights(fitnessState) : [];
      
      const allInsights = Services.insight.sortByPriority([...tlInsights, ...fsInsights]);
      this.data.insights = Services.insight.getTopInsights(allInsights, 3);
      
      // Render page
      this.render();
      
      // Initialize charts
      this.initCharts();
      
    } catch (error) {
      console.error('[OverviewPage] Load error:', error);
      Services.analytics.trackError('overview_load', error.message);
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    const { trainingLoad, activities, settings, insights, fitnessState } = this.data;
    
    // ✅ Using classes from overview.css - NO inline styles
    container.innerHTML = `
      <div class="ov-section">
        <!-- Header -->
        <div class="ov-header">
          <h1>Dashboard Overview</h1>
          <p>Your training metrics and recent performance</p>
        </div>

        <!-- KPI Metrics Grid -->
        <div class="metrics-grid">
          ${this.renderMetrics()}
        </div>

        <!-- Training Load Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-header-content">
              <div class="chart-title-row">
                <div class="chart-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                </div>
                <div>
                  <div class="chart-title">Training Load (30 days)</div>
                  <div class="chart-subtitle">CTL, ATL, and TSB progression</div>
                </div>
              </div>
            </div>
            <div class="chart-controls">
              <button class="chart-control" data-range="30">30d</button>
              <button class="chart-control active" data-range="90">90d</button>
              <button class="chart-control" data-range="180">180d</button>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="trainingLoadChart"></canvas>
          </div>
        </div>

        <!-- AI Insights -->
        ${insights && insights.length > 0 ? `
          <div class="insights-section">
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem;">AI Insights</h3>
            <div class="insights-grid">
              ${insights.map(insight => InsightCard(insight)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Recent Activities -->
        ${this.renderActivities(activities)}
      </div>
    `;
    
    // Setup chart controls
    this.setupChartControls();
    
    // Initialize icons
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  renderMetrics() {
    const { trainingLoad, fitnessState } = this.data;
    
    if (!trainingLoad || !trainingLoad.current) {
      return LoadingSkeleton({ type: 'metric', count: 4 });
    }
    
    const { ctl, atl, tsb } = trainingLoad.current;
    
    // Calculate fitness charge (0-100)
    const fitnessCharge = this.calculateFitnessCharge(ctl, atl, tsb);
    
    // ✅ Using metric-card classes from overview.css
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
          <div class="metric-icon purple">
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
          <div class="metric-icon green">
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
      
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon amber">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="metric-label">Fitness Charge</div>
        </div>
        <div class="metric-value">${fitnessCharge}%</div>
        <div class="metric-subtitle">${this.getFitnessChargeStatus(fitnessCharge)}</div>
      </div>
    `;
  }

  renderActivities(activities) {
    if (!activities || activities.length === 0) {
      return `
        <div class="activities-card">
          <div class="activities-card-header">
            <div class="activities-card-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div class="activities-card-title">Recent Activities</div>
          </div>
          <div class="no-data">
            No recent activities found
          </div>
        </div>
      `;
    }
    
    return `
      <div class="activities-card">
        <div class="activities-card-header">
          <div class="activities-card-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div class="activities-card-title">Recent Activities</div>
        </div>
        <table class="activities-table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Date</th>
              <th>Power</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            ${activities.slice(0, 5).map(activity => `
              <tr onclick="window.router.navigateTo('activities')" style="cursor: pointer;">
                <td class="activity-name">${this.escapeHtml(activity.file_name || 'Ride')}</td>
                <td>${this.formatDate(activity.start_time)}</td>
                <td class="power-value">${activity.avg_power ? Math.round(activity.avg_power) + 'W' : '-'}</td>
                <td>${this.formatDuration(activity.duration)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderLoading() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="ov-section">
        <div class="metrics-grid">
          ${LoadingSkeleton({ type: 'metric', count: 4 })}
        </div>
        ${LoadingSkeleton({ type: 'chart', count: 1 })}
      </div>
    `;
  }

  renderError(error) {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="no-data">
        <svg style="width: 64px; height: 64px; margin-bottom: 16px; color: var(--text-tertiary); opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">Failed to Load Overview</h3>
        <p style="margin-bottom: 16px;">${this.escapeHtml(error.message)}</p>
        <button class="btn btn--primary" onclick="window.router.refresh()">
          Try Again
        </button>
      </div>
    `;
  }

  // ========== CHART INITIALIZATION ==========

  initCharts() {
    this.initTrainingLoadChart();
  }

  initTrainingLoadChart() {
    const canvas = document.getElementById('trainingLoadChart');
    if (!canvas || !this.data.trainingLoad) return;
    
    const { daily } = this.data.trainingLoad;
    
    // Prepare chart data
    const chartData = Services.chart.prepareTrainingLoadChart(daily);
    const chartOptions = Services.chart.getTrainingLoadChartOptions();
    
    // Add click tracking
    chartOptions.onClick = () => {
      Services.analytics.trackChartInteraction('training-load', 'click');
    };
    
    // Create chart
    this.charts.trainingLoad = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
  }

  setupChartControls() {
    document.querySelectorAll('.chart-control').forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active from all
        btn.parentElement.querySelectorAll('.chart-control').forEach(b => 
          b.classList.remove('active')
        );
        
        // Add active to clicked
        btn.classList.add('active');
        
        // Get range and reload chart
        const days = parseInt(btn.dataset.range) || 30;
        this.reloadChartWithRange(days);
      });
    });
  }

  async reloadChartWithRange(days) {
    try {
      const trainingLoad = await Services.data.getTrainingLoad({ days, forceRefresh: true });
      this.data.trainingLoad = trainingLoad;
      
      // Destroy existing chart
      if (this.charts.trainingLoad) {
        this.charts.trainingLoad.destroy();
      }
      
      // Reinitialize
      this.initTrainingLoadChart();
      
    } catch (error) {
      console.error('[OverviewPage] Error reloading chart:', error);
    }
  }

  // ========== HELPER METHODS ==========

  calculateFitnessCharge(ctl, atl, tsb) {
    if (ctl === 0 && atl === 0) return 50;
    
    const ctlComponent = Math.min(70, (ctl / 100) * 70);
    const tsbNormalized = Math.max(-30, Math.min(30, tsb));
    const tsbComponent = (tsbNormalized / 30) * 30;
    
    let charge = ctlComponent + 50 + (tsbComponent * 0.5);
    return Math.round(Math.max(0, Math.min(100, charge)));
  }

  getFitnessChargeStatus(charge) {
    if (charge >= 80) return 'Peak Performance';
    if (charge >= 60) return 'Good Shape';
    if (charge >= 40) return 'Building';
    return 'Recovery Needed';
  }

  getTSBStatus(tsb) {
    if (tsb >= 25) return 'Very Fresh';
    if (tsb >= 10) return 'Fresh';
    if (tsb >= -10) return 'Neutral';
    if (tsb >= -20) return 'Fatigued';
    return 'Very Fatigued';
  }

  getTrend(dailyData, metric) {
    if (!dailyData || dailyData.length < 7) return null;
    
    const recent = dailyData.slice(-3).reduce((sum, d) => sum + d[metric], 0) / 3;
    const older = dailyData.slice(-7, -3).reduce((sum, d) => sum + d[metric], 0) / 4;
    
    const change = ((recent - older) / older) * 100;
    
    if (Math.abs(change) < 2) return null;
    return change > 0 ? 'up' : 'down';
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatDuration(seconds) {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== LIFECYCLE HOOKS ==========

  onShow() {
    console.log('[OverviewPage] Page shown');
  }

  onHide() {
    console.log('[OverviewPage] Page hidden');
  }

  onUnload() {
    // Clean up charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts = {};
    
    console.log('[OverviewPage] Page unloaded');
  }
}

// Create singleton instance
const overviewPage = new OverviewPage();

// Export for router
export default overviewPage;
export { overviewPage };