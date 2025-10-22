// ============================================
// VO2MAX PAGE
// ============================================

// FILE: pages/vo2max/index.js
import Services from '../../services/index.js';
import { MetricCard } from '../../components/ui/index.js';
import CONFIG from './config.js';

class VO2MaxPage {
  constructor() {
    this.config = CONFIG;
    this.chart = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('vo2max');
      this.renderLoading();
      
      this.data = await Services.data.getVO2Max({ days: 180 });
      this.render();
      this.initChart();
    } catch (error) {
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent');
    
    // Get latest estimate
    const latestVO2Max = this.data.estimates && this.data.estimates.length > 0 
      ? this.data.estimates[this.data.estimates.length - 1].vo2max 
      : null;
    
    container.innerHTML = `
      <div class="page-section">
        <div class="page-header">
          <h1>VO2 Max Estimation</h1>
          <p>Estimated maximal oxygen uptake based on power and heart rate</p>
        </div>

        ${latestVO2Max ? `
          <div class="metrics-grid mb-6">
            ${MetricCard({
              label: 'Current VO2 Max',
              value: latestVO2Max.toFixed(1),
              subtitle: 'ml/kg/min',
              variant: 'primary',
              icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/></svg>'
            })}
            ${MetricCard({
              label: 'Fitness Level',
              value: this.getVO2MaxCategory(latestVO2Max),
              subtitle: 'Classification',
              variant: 'info'
            })}
          </div>
        ` : ''}

        <div class="chart-card">
          <div class="chart-card__header">
            <h3>VO2 Max Trend (6 months)</h3>
          </div>
          <div class="chart-card__container">
            <canvas id="vo2maxChart"></canvas>
          </div>
        </div>

        <div class="card mt-6 p-6">
          <h4 class="font-bold mb-3">About VO2 Max</h4>
          <p class="text-sm text-secondary mb-3">
            VO2 Max (maximal oxygen uptake) is the maximum rate at which your body can use oxygen 
            during intense exercise. It's one of the best indicators of cardiovascular fitness and 
            endurance capacity.
          </p>
          <p class="text-sm text-secondary">
            These estimates are calculated from your power output and heart rate data during maximal efforts. 
            For most accurate results, ensure you have recent hard efforts with both power and HR data.
          </p>
        </div>
      </div>
    `;
    
    if (typeof feather !== 'undefined') feather.replace();
  }

  initChart() {
    const canvas = document.getElementById('vo2maxChart');
    if (!canvas || !this.data || !this.data.estimates) return;
    
    const chartData = Services.chart.prepareVO2MaxChart(this.data.estimates);
    const chartOptions = Services.chart.getDefaultChartOptions();
    
    this.chart = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
  }

  getVO2MaxCategory(vo2max) {
    // Simplified categories (male, age 20-40)
    if (vo2max >= 55) return 'Excellent';
    if (vo2max >= 50) return 'Good';
    if (vo2max >= 45) return 'Above Average';
    if (vo2max >= 40) return 'Average';
    if (vo2max >= 35) return 'Below Average';
    return 'Poor';
  }

  renderLoading() {
    document.getElementById('pageContent').innerHTML = LoadingSkeleton({ type: 'chart', count: 1 });
  }

  renderError(error) {
    document.getElementById('pageContent').innerHTML = `
      <div class="error-state">
        <h3>Failed to Load VO2 Max</h3>
        <p>${error.message}</p>
      </div>
    `;
  }

  onUnload() {
    if (this.chart) this.chart.destroy();
  }
}

const vo2maxPage = new VO2MaxPage();
export default vo2maxPage;