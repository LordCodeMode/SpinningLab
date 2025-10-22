// ============================================
// HR ZONES PAGE
// ============================================

// FILE: pages/hr-zones/index.js
import Services from '../../services/index.js';
import CONFIG from './config.js';

class HRZonesPage {
  constructor() {
    this.config = CONFIG;
    this.chart = null;
    this.currentDays = 90;
  }

  async load() {
    try {
      Services.analytics.trackPageView('hr-zones');
      this.renderLoading();
      
      this.data = await Services.data.getHRZones({ days: this.currentDays });
      this.render();
      this.initChart();
      this.setupEventListeners();
    } catch (error) {
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent');
    
    container.innerHTML = `
      <div class="page-section">
        <div class="page-header">
          <h1>Heart Rate Zones</h1>
          <p>Time spent in each HR zone</p>
        </div>

        <div class="chart-card">
          <div class="chart-card__header">
            <div class="chart-card__title-group">
              <h3>HR Zone Distribution</h3>
            </div>
            <div class="chart-controls">
              <button class="btn btn--sm ${this.currentDays === 30 ? 'active' : ''}" data-days="30">30d</button>
              <button class="btn btn--sm ${this.currentDays === 90 ? 'active' : ''}" data-days="90">90d</button>
              <button class="btn btn--sm ${this.currentDays === 180 ? 'active' : ''}" data-days="180">180d</button>
            </div>
          </div>
          <div class="chart-card__container">
            <canvas id="hrZonesChart"></canvas>
          </div>
        </div>

        <!-- HR Zone Reference -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          ${this.renderHRZoneInfo()}
        </div>
      </div>
    `;
    
    if (typeof feather !== 'undefined') feather.replace();
  }

  renderHRZoneInfo() {
    const zones = [
      { name: 'Z1 - Recovery', range: '< 60% HRmax', color: '#c7f6c1', desc: 'Very easy, recovery rides' },
      { name: 'Z2 - Aerobic', range: '60-70% HRmax', color: '#9ce4a5', desc: 'Comfortable, conversational pace' },
      { name: 'Z3 - Tempo', range: '70-80% HRmax', color: '#ffe285', desc: 'Moderate effort, steady state' },
      { name: 'Z4 - Threshold', range: '80-90% HRmax', color: '#fab57e', desc: 'Hard effort, sustainable' },
      { name: 'Z5 - Maximum', range: '90-100% HRmax', color: '#ef4444', desc: 'Very hard, max effort' }
    ];

    return zones.map(zone => `
      <div class="card p-4" style="border-left: 4px solid ${zone.color}">
        <h4 class="font-bold">${zone.name}</h4>
        <p class="text-sm text-secondary">${zone.range}</p>
        <p class="text-xs text-tertiary mt-1">${zone.desc}</p>
      </div>
    `).join('');
  }

  initChart() {
    const canvas = document.getElementById('hrZonesChart');
    if (!canvas || !this.data || !this.data.zone_data) return;
    
    // Transform data to match expected format
    const zones = this.data.zone_data.map(z => ({
      name: z.zone_label,
      seconds: z.seconds_in_zone
    }));
    
    const chartData = Services.chart.prepareZoneDistributionChart(zones);
    const chartOptions = Services.chart.getZoneDistributionChartOptions();
    
    this.chart = new Chart(canvas, {
      type: 'bar',
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
    this.data = await Services.data.getHRZones({ days, forceRefresh: true });
    this.updateChart();
  }

  updateChart() {
    if (!this.chart || !this.data) return;
    const zones = this.data.zone_data.map(z => ({
      name: z.zone_label,
      seconds: z.seconds_in_zone
    }));
    const chartData = Services.chart.prepareZoneDistributionChart(zones);
    this.chart.data = chartData;
    this.chart.update();
  }

  renderLoading() {
    document.getElementById('pageContent').innerHTML = LoadingSkeleton({ type: 'chart', count: 1 });
  }

  renderError(error) {
    document.getElementById('pageContent').innerHTML = `
      <div class="error-state">
        <h3>Failed to Load HR Zones</h3>
        <p>${error.message}</p>
      </div>
    `;
  }

  onUnload() {
    if (this.chart) this.chart.destroy();
  }
}

const hrZonesPage = new HRZonesPage();
export default hrZonesPage;