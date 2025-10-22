// ============================================
// 5. EFFICIENCY PAGE
// ============================================

// FILE: pages/efficiency/index.js
import Services from '../../services/index.js';
import { MetricCard, LoadingSkeleton, InsightCard } from '../../components/ui/index.js';
import CONFIG from './config.js';

class EfficiencyPage {
  constructor() {
    this.config = CONFIG;
    this.chart = null;
    this.currentDays = 120;
  }

  async load() {
    try {
      Services.analytics.trackPageView('efficiency');
      this.renderLoading();
      
      this.data = await Services.data.getEfficiency({ days: this.currentDays });
      this.insights = Services.insight.generateEfficiencyInsights(this.data);
      
      this.render();
      this.initChart();
      this.setupEventListeners();
    } catch (error) {
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent');
    const { current_ef, avg_ef, trend } = this.data;
    
    container.innerHTML = `
      <div class="page-section">
        <div class="page-header">
          <h1>Efficiency Analysis</h1>
          <p>Power to heart rate efficiency factor over time</p>
        </div>
        
        <div class="metrics-grid">
          ${MetricCard({
            label: 'Current EF',
            value: current_ef ? current_ef.toFixed(2) : '-',
            subtitle: 'Efficiency Factor',
            variant: 'primary'
          })}
          ${MetricCard({
            label: 'Average EF',
            value: avg_ef ? avg_ef.toFixed(2) : '-',
            subtitle: `${this.currentDays} day average`,
            variant: 'info'
          })}
          ${MetricCard({
            label: 'Trend',
            value: trend || 'Stable',
            subtitle: 'Recent change',
            variant: trend === 'improving' ? 'success' : trend === 'declining' ? 'warning' : 'info'
          })}
        </div>
        
        <div class="chart-card mt-6">
          <div class="chart-card__header">
            <h3>Efficiency Trend</h3>
            <div class="chart-controls">
              <button class="btn btn--sm ${this.currentDays === 60 ? 'active' : ''}" data-days="60">60 Days</button>
              <button class="btn btn--sm ${this.currentDays === 120 ? 'active' : ''}" data-days="120">120 Days</button>
              <button class="btn btn--sm ${this.currentDays === 180 ? 'active' : ''}" data-days="180">180 Days</button>
            </div>
          </div>
          <div class="chart-card__container">
            <canvas id="efficiencyChart"></canvas>
          </div>
        </div>
        
        ${this.insights && this.insights.length > 0 ? `
          <div class="mt-6">
            <h3 class="text-xl font-bold mb-4">Insights</h3>
            <div class="insights-grid">
              ${this.insights.map(i => InsightCard(i)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
    
    if (typeof feather !== 'undefined') feather.replace();
  }

  initChart() {
    const canvas = document.getElementById('efficiencyChart');
    if (!canvas || !this.data.timeseries) return;
    
    const chartData = Services.chart.prepareEfficiencyChart(this.data.timeseries);
    const chartOptions = Services.chart.getDefaultChartOptions();
    
    this.chart = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
  }

  setupEventListeners() {
    document.querySelectorAll('[data-days]').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleTimeRangeChange(parseInt(e.target.dataset.days)));
    });
  }

  async handleTimeRangeChange(days) {
    if (days === this.currentDays) return;
    
    this.currentDays = days;
    Services.analytics.trackTimeRangeChange('efficiency', `${days}d`);
    
    this.data = await Services.data.getEfficiency({ days, forceRefresh: true });
    this.updateChart();
  }

  updateChart() {
    if (!this.chart) return;
    const chartData = Services.chart.prepareEfficiencyChart(this.data.timeseries);
    this.chart.data = chartData;
    this.chart.update();
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
    if (this.chart) this.chart.destroy();
  }
}

const efficiencyPage = new EfficiencyPage();
export default efficiencyPage;