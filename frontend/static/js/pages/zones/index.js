// ============================================
// ZONES PAGE (Power Zones)
// ============================================

// FILE: pages/zones/index.js
import Services from '../../services/index.js';
import CONFIG from './config.js';

class ZonesPage {
  constructor() {
    this.config = CONFIG;
    this.chart = null;
    this.currentDays = 90;
  }

  async load() {
    try {
      Services.analytics.trackPageView('zones');
      this.renderLoading();
      
      this.data = await Services.data.getPowerZones({ days: this.currentDays });
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
          <h1>Power Zones Distribution</h1>
          <p>Time spent in each power zone</p>
        </div>

        <div class="chart-card">
          <div class="chart-card__header">
            <div class="chart-card__title-group">
              <h3>Zone Distribution</h3>
            </div>
            <div class="chart-controls">
              <button class="btn btn--sm ${this.currentDays === 30 ? 'active' : ''}" data-days="30">30d</button>
              <button class="btn btn--sm ${this.currentDays === 90 ? 'active' : ''}" data-days="90">90d</button>
              <button class="btn btn--sm ${this.currentDays === 180 ? 'active' : ''}" data-days="180">180d</button>
            </div>
          </div>
          <div class="chart-card__container">
            <canvas id="zonesChart"></canvas>
          </div>
        </div>

        <!-- Zone Reference -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          ${this.renderZoneInfo()}
        </div>
      </div>
    `;
    
    if (typeof feather !== 'undefined') feather.replace();
  }

  renderZoneInfo() {
    const zones = [
      { name: 'Z1 - Recovery', range: '< 55% FTP', color: '#c7f6c1' },
      { name: 'Z2 - Endurance', range: '55-75% FTP', color: '#9ce4a5' },
      { name: 'Z3 - Tempo', range: '75-90% FTP', color: '#ffe285' },
      { name: 'Z4 - Threshold', range: '90-105% FTP', color: '#fab57e' },
      { name: 'Z5 - VO2max', range: '105-120% FTP', color: '#f1998e' },
      { name: 'Z6 - Anaerobic', range: '120-150% FTP', color: '#d67777' },
      { name: 'Z7 - Neuromuscular', range: '> 150% FTP', color: '#c9a0db' }
    ];

    return zones.map(zone => `
      <div class="card p-4" style="border-left: 4px solid ${zone.color}">
        <h4 class="font-bold">${zone.name}</h4>
        <p class="text-sm text-secondary">${zone.range}</p>
      </div>
    `).join('');
  }

  initChart() {
    const canvas = document.getElementById('zonesChart');
    if (!canvas || !this.data || !this.data.zones) return;
    
    const chartData = Services.chart.prepareZoneDistributionChart(this.data.zones);
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
    this.data = await Services.data.getPowerZones({ days, forceRefresh: true });
    this.updateChart();
  }

  updateChart() {
    if (!this.chart || !this.data) return;
    const chartData = Services.chart.prepareZoneDistributionChart(this.data.zones);
    this.chart.data = chartData;
    this.chart.update();
  }

  renderLoading() {
    document.getElementById('pageContent').innerHTML = LoadingSkeleton({ type: 'chart', count: 1 });
  }

  renderError(error) {
    document.getElementById('pageContent').innerHTML = `
      <div class="error-state">
        <h3>Failed to Load Power Zones</h3>
        <p>${error.message}</p>
      </div>
    `;
  }

  onUnload() {
    if (this.chart) this.chart.destroy();
  }
}

const zonesPage = new ZonesPage();
export default zonesPage;