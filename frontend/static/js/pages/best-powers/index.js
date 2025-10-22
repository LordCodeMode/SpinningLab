// ============================================
// BEST POWERS PAGE
// ============================================

// FILE: pages/best-powers/index.js
import Services from '../../services/index.js';
import { MetricCard, LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

class BestPowersPage {
  constructor() {
    this.config = CONFIG;
    this.data = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('best-powers');
      this.renderLoading();
      
      const [data, settings] = await Promise.all([
        Services.data.getBestPowerValues(),
        Services.data.getSettings()
      ]);
      
      this.data = data;
      this.settings = settings;
      
      this.render();
    } catch (error) {
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent');
    const { weight } = this.settings;
    
    container.innerHTML = `
      <div class="bp-section">
        <div class="bp-header">
          <div class="bp-header__content">
            <h1>Best Power Values</h1>
            <p>Your lifetime personal records across decisive efforts.</p>
          </div>
          <div class="bp-header__meta">
            <span class="bp-meta-pill">Updated ${new Date().toLocaleDateString()}</span>
            ${weight ? `<span class="bp-meta-pill">Current weight: ${weight} kg</span>` : ''}
          </div>
        </div>

        <section class="bp-panel">
          <header class="bp-panel__header">
            <h3>Absolute Power Peaks</h3>
            <p>Highlight efforts that define your sprint, anaerobic, and threshold capabilities.</p>
          </header>
          <div class="bp-panel__content bp-panel__content--grid">
            ${MetricCard({
              label: '5 Seconds',
              value: this.data.max_5sec_power ? Math.round(this.data.max_5sec_power) : '-',
              subtitle: 'Sprint Power',
              variant: 'primary'
          })}
          ${MetricCard({
            label: '1 Minute',
            value: this.data.max_1min_power ? Math.round(this.data.max_1min_power) : '-',
            subtitle: 'Anaerobic',
            variant: 'danger'
          })}
          ${MetricCard({
            label: '5 Minutes',
            value: this.data.max_5min_power ? Math.round(this.data.max_5min_power) : '-',
            subtitle: 'VO2max',
            variant: 'warning'
          })}
          ${MetricCard({
            label: '20 Minutes',
            value: this.data.max_20min_power ? Math.round(this.data.max_20min_power) : '-',
            subtitle: 'FTP Proxy',
            variant: 'info'
          })}
            ${MetricCard({
              label: '1 Hour',
              value: this.data.max_60min_power ? Math.round(this.data.max_60min_power) : '-',
              subtitle: 'Endurance',
              variant: 'success'
            })}
          </div>
        </section>

        ${weight ? `
          <section class="bp-panel">
            <header class="bp-panel__header">
              <h3>Power to Weight (W/kg)</h3>
              <p>How your best efforts scale with body mass for climbs and long efforts.</p>
            </header>
            <div class="bp-panel__content bp-panel__content--grid">
            ${MetricCard({
              label: '5 Seconds',
              value: this.data.max_5sec_power ? (this.data.max_5sec_power / weight).toFixed(2) : '-',
              subtitle: 'W/kg',
              variant: 'primary'
            })}
            ${MetricCard({
              label: '1 Minute',
              value: this.data.max_1min_power ? (this.data.max_1min_power / weight).toFixed(2) : '-',
              subtitle: 'W/kg',
              variant: 'danger'
            })}
            ${MetricCard({
              label: '5 Minutes',
              value: this.data.max_5min_power ? (this.data.max_5min_power / weight).toFixed(2) : '-',
              subtitle: 'W/kg',
              variant: 'warning'
            })}
            ${MetricCard({
              label: '20 Minutes',
              value: this.data.max_20min_power ? (this.data.max_20min_power / weight).toFixed(2) : '-',
              subtitle: 'W/kg',
              variant: 'info'
            })}
            ${MetricCard({
              label: '1 Hour',
              value: this.data.max_60min_power ? (this.data.max_60min_power / weight).toFixed(2) : '-',
              subtitle: 'W/kg',
              variant: 'success'
            })}
            </div>
          </section>
        ` : ''}
      </div>
    `;
    
    if (typeof feather !== 'undefined') feather.replace();
  }

  renderLoading() {
    document.getElementById('pageContent').innerHTML = LoadingSkeleton({ type: 'metric', count: 5 });
  }

  renderError(error) {
    document.getElementById('pageContent').innerHTML = `
      <div class="error-state">
        <h3>Failed to Load Best Powers</h3>
        <p>${error.message}</p>
      </div>
    `;
  }

  onUnload() {
    this.data = null;
  }
}

const bestPowersPage = new BestPowersPage();
export default bestPowersPage;
