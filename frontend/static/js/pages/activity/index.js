// ============================================
// ACTIVITY DETAIL PAGE - Comprehensive View
// ============================================

import Services from '../../services/index.js';
import { LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

class ActivityDetailPage {
  constructor() {
    this.config = CONFIG;
    this.activity = null;
    this.settings = null;
    this.activityId = null;
    this.bestPowers = null;
    this.powerZoneChart = null;
    this.hrZoneChart = null;
  }

  async load(params) {
    try {
      this.activityId = params?.id ?? null;

      if (!this.activityId) {
        throw new Error('No activity ID provided for activity detail view');
      }

      Services.analytics.trackPageView('activity-detail', { activityId: this.activityId });
      this.renderLoading();

      const [activity, settings, bestPowers] = await Promise.all([
        Services.data.getActivity(this.activityId),
        Services.data.getSettings(),
        Services.data.getBestPowerValues()
      ]);

      this.activity = this.normalizeActivity(activity);
      this.settings = settings;
      this.bestPowers = bestPowers;

      this.render();
      this.renderCharts();
    } catch (error) {
      console.error('[ActivityDetailPage] load failed:', error);
      Services.analytics.trackError('activity_detail_load', error.message);
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    if (!this.activity) {
      this.renderError(new Error('Activity data unavailable'));
      return;
    }

    container.innerHTML = `
      <div class="activity-detail">
        ${this.renderBreadcrumb()}
        ${this.renderHeader()}
        ${this.renderMainContent()}
        ${this.renderZonesSection()}
        ${this.renderBestEffortsSection()}
      </div>
    `;

    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  renderBreadcrumb() {
    return `
      <nav class="activity-breadcrumb">
        <a href="#/activities" class="activity-breadcrumb-link">
          <i data-feather="chevron-left"></i>
          Back to Activities
        </a>
      </nav>
    `;
  }

  renderHeader() {
    const date = this.formatDate(this.activity.start_time);
    const time = this.formatTime(this.activity.start_time);
    const duration = this.formatDuration(this.activity.duration);
    const distance = this.activity.distance ? `${this.activity.distance.toFixed(1)} km` : 'N/A';

    return `
      <div class="activity-header">
        <div class="activity-header-top">
          <div class="activity-title-section">
            <h1 class="activity-title">${this.escapeHtml(this.activity.file_name || 'Untitled Ride')}</h1>
            <div class="activity-meta">
              <span class="activity-meta-item">
                <i data-feather="calendar"></i>
                ${date}
              </span>
              <span class="activity-meta-item">
                <i data-feather="clock"></i>
                ${time}
              </span>
            </div>
          </div>
        </div>

        <div class="activity-stats-grid">
          <div class="activity-stat-card activity-stat-card--primary">
            <div class="activity-stat-icon" style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);">
              <i data-feather="zap"></i>
            </div>
            <div class="activity-stat-content">
              <span class="activity-stat-label">Average Power</span>
              <span class="activity-stat-value">${this.activity.avg_power ? Math.round(this.activity.avg_power) : '—'}</span>
              <span class="activity-stat-unit">watts</span>
            </div>
          </div>

          <div class="activity-stat-card">
            <div class="activity-stat-icon" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              <i data-feather="activity"></i>
            </div>
            <div class="activity-stat-content">
              <span class="activity-stat-label">Normalized Power</span>
              <span class="activity-stat-value">${this.activity.normalized_power ? Math.round(this.activity.normalized_power) : '—'}</span>
              <span class="activity-stat-unit">watts</span>
            </div>
          </div>

          <div class="activity-stat-card">
            <div class="activity-stat-icon" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
              <i data-feather="clock"></i>
            </div>
            <div class="activity-stat-content">
              <span class="activity-stat-label">Duration</span>
              <span class="activity-stat-value">${duration}</span>
              <span class="activity-stat-unit">&nbsp;</span>
            </div>
          </div>

          <div class="activity-stat-card">
            <div class="activity-stat-icon" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">
              <i data-feather="map"></i>
            </div>
            <div class="activity-stat-content">
              <span class="activity-stat-label">Distance</span>
              <span class="activity-stat-value">${distance}</span>
              <span class="activity-stat-unit">&nbsp;</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderMainContent() {
    const tss = this.activity.tss ? Math.round(this.activity.tss) : '—';
    const intensityFactor = this.activity.intensity_factor ? this.activity.intensity_factor.toFixed(2) : '—';
    const efficiencyFactor = this.activity.efficiency_factor ? this.activity.efficiency_factor.toFixed(2) : '—';
    const avgHR = this.activity.avg_heart_rate ? Math.round(this.activity.avg_heart_rate) : '—';
    const maxHR = this.activity.max_heart_rate ? Math.round(this.activity.max_heart_rate) : '—';

    return `
      <div class="activity-main-grid">
        <div class="activity-metrics-panel">
          <h2 class="activity-section-title">Training Metrics</h2>
          <div class="activity-metrics-list">
            <div class="activity-metric-row">
              <span class="activity-metric-label">
                <i data-feather="trending-up"></i>
                Training Stress Score
              </span>
              <span class="activity-metric-value">${tss}</span>
            </div>
            <div class="activity-metric-row">
              <span class="activity-metric-label">
                <i data-feather="percent"></i>
                Intensity Factor
              </span>
              <span class="activity-metric-value">${intensityFactor}</span>
            </div>
            <div class="activity-metric-row">
              <span class="activity-metric-label">
                <i data-feather="bar-chart-2"></i>
                Efficiency Factor
              </span>
              <span class="activity-metric-value">${efficiencyFactor}</span>
            </div>
          </div>

          <h2 class="activity-section-title" style="margin-top: 28px;">Heart Rate</h2>
          <div class="activity-metrics-list">
            <div class="activity-metric-row">
              <span class="activity-metric-label">
                <i data-feather="heart"></i>
                Average Heart Rate
              </span>
              <span class="activity-metric-value">${avgHR} bpm</span>
            </div>
            <div class="activity-metric-row">
              <span class="activity-metric-label">
                <i data-feather="activity"></i>
                Maximum Heart Rate
              </span>
              <span class="activity-metric-value">${maxHR} bpm</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderZonesSection() {
    const hasPowerZones = this.activity.power_zones && this.activity.power_zones.length > 0;
    const hasHRZones = this.activity.hr_zones && this.activity.hr_zones.length > 0;

    if (!hasPowerZones && !hasHRZones) {
      return `
        <div class="activity-section">
          <h2 class="activity-section-title">Zone Distribution</h2>
          <div class="activity-empty-state">
            <i data-feather="pie-chart"></i>
            <p>No zone data available for this activity</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="activity-section">
        <h2 class="activity-section-title">Zone Distribution</h2>
        <div class="activity-zones-grid">
          ${hasPowerZones ? this.renderPowerZones() : ''}
          ${hasHRZones ? this.renderHRZones() : ''}
        </div>
      </div>
    `;
  }

  renderPowerZones() {
    return `
      <div class="activity-zone-card">
        <h3 class="activity-zone-card-title">Power Zones</h3>
        <div class="activity-chart-container">
          <canvas id="power-zone-chart"></canvas>
        </div>
        ${this.renderPowerZonesList()}
      </div>
    `;
  }

  renderPowerZonesList() {
    const totalSeconds = this.activity.power_zones.reduce((sum, z) => sum + z.seconds_in_zone, 0);

    const zones = this.activity.power_zones.map(zone => {
      const percentage = totalSeconds > 0 ? (zone.seconds_in_zone / totalSeconds * 100).toFixed(1) : '0.0';
      const timeFormatted = this.formatDuration(zone.seconds_in_zone);
      const color = this.getZoneColor(zone.zone_label, this.config.POWER_ZONE_COLORS);

      return `
        <div class="activity-zone-row">
          <div class="activity-zone-color" style="background: ${color};"></div>
          <span class="activity-zone-label">${zone.zone_label}</span>
          <span class="activity-zone-time">${timeFormatted}</span>
          <span class="activity-zone-percent">${percentage}%</span>
        </div>
      `;
    }).join('');

    return `<div class="activity-zone-list">${zones}</div>`;
  }

  renderHRZones() {
    return `
      <div class="activity-zone-card">
        <h3 class="activity-zone-card-title">Heart Rate Zones</h3>
        <div class="activity-chart-container">
          <canvas id="hr-zone-chart"></canvas>
        </div>
        ${this.renderHRZonesList()}
      </div>
    `;
  }

  renderHRZonesList() {
    const totalSeconds = this.activity.hr_zones.reduce((sum, z) => sum + z.seconds_in_zone, 0);

    const zones = this.activity.hr_zones.map(zone => {
      const percentage = totalSeconds > 0 ? (zone.seconds_in_zone / totalSeconds * 100).toFixed(1) : '0.0';
      const timeFormatted = this.formatDuration(zone.seconds_in_zone);
      const color = this.getZoneColor(zone.zone_label, this.config.HR_ZONE_COLORS);

      return `
        <div class="activity-zone-row">
          <div class="activity-zone-color" style="background: ${color};"></div>
          <span class="activity-zone-label">${zone.zone_label}</span>
          <span class="activity-zone-time">${timeFormatted}</span>
          <span class="activity-zone-percent">${percentage}%</span>
        </div>
      `;
    }).join('');

    return `<div class="activity-zone-list">${zones}</div>`;
  }

  renderBestEffortsSection() {
    const bestEfforts = [
      { key: 'max_5sec_power', label: '5 seconds' },
      { key: 'max_1min_power', label: '1 minute' },
      { key: 'max_3min_power', label: '3 minutes' },
      { key: 'max_5min_power', label: '5 minutes' },
      { key: 'max_10min_power', label: '10 minutes' },
      { key: 'max_20min_power', label: '20 minutes' },
      { key: 'max_30min_power', label: '30 minutes' },
      { key: 'max_60min_power', label: '60 minutes' }
    ];

    const effortsWithPRs = bestEfforts
      .filter(effort => this.activity[effort.key] && this.activity[effort.key] > 0)
      .map(effort => {
        const activityPower = this.activity[effort.key];
        const bestPower = this.bestPowers?.[effort.key] || 0;
        const isPR = activityPower >= bestPower && bestPower > 0;

        return {
          ...effort,
          power: activityPower,
          isPR
        };
      });

    if (effortsWithPRs.length === 0) {
      return `
        <div class="activity-section">
          <h2 class="activity-section-title">Best Efforts</h2>
          <div class="activity-empty-state">
            <i data-feather="award"></i>
            <p>No power data available for this activity</p>
          </div>
        </div>
      `;
    }

    const effortsHTML = effortsWithPRs.map(effort => `
      <div class="activity-effort-card ${effort.isPR ? 'activity-effort-card--pr' : ''}">
        ${effort.isPR ? '<div class="activity-pr-badge"><i data-feather="award"></i> PR</div>' : ''}
        <div class="activity-effort-label">${effort.label}</div>
        <div class="activity-effort-value">${Math.round(effort.power)}</div>
        <div class="activity-effort-unit">watts</div>
      </div>
    `).join('');

    return `
      <div class="activity-section">
        <h2 class="activity-section-title">Best Efforts</h2>
        <p class="activity-section-subtitle">Peak power outputs during this activity</p>
        <div class="activity-efforts-grid">
          ${effortsHTML}
        </div>
      </div>
    `;
  }

  renderCharts() {
    if (this.activity.power_zones && this.activity.power_zones.length > 0) {
      this.renderPowerZoneChart();
    }
    if (this.activity.hr_zones && this.activity.hr_zones.length > 0) {
      this.renderHRZoneChart();
    }
  }

  renderPowerZoneChart() {
    const canvas = document.getElementById('power-zone-chart');
    if (!canvas) return;

    const labels = this.activity.power_zones.map(z => z.zone_label);
    const data = this.activity.power_zones.map(z => z.seconds_in_zone / 60); // Convert to minutes
    const colors = labels.map(label => this.getZoneColor(label, this.config.POWER_ZONE_COLORS));

    if (this.powerZoneChart) {
      this.powerZoneChart.destroy();
    }

    this.powerZoneChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => {
                const minutes = Math.round(context.parsed);
                return `${context.label}: ${minutes} min`;
              }
            }
          }
        }
      }
    });
  }

  renderHRZoneChart() {
    const canvas = document.getElementById('hr-zone-chart');
    if (!canvas) return;

    const labels = this.activity.hr_zones.map(z => z.zone_label);
    const data = this.activity.hr_zones.map(z => z.seconds_in_zone / 60); // Convert to minutes
    const colors = labels.map(label => this.getZoneColor(label, this.config.HR_ZONE_COLORS));

    if (this.hrZoneChart) {
      this.hrZoneChart.destroy();
    }

    this.hrZoneChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (context) => {
                const minutes = Math.round(context.parsed);
                return `${context.label}: ${minutes} min`;
              }
            }
          }
        }
      }
    });
  }

  formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatTime(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDuration(seconds) {
    if (!seconds) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  normalizeActivity(activity) {
    if (!activity) return null;
    return {
      ...activity,
      power_zones: Array.isArray(activity.power_zones) ? activity.power_zones : [],
      hr_zones: Array.isArray(activity.hr_zones) ? activity.hr_zones : [],
    };
  }

  getZoneColor(label, palette) {
    if (!label) return this.config.COLORS.gray;
    const trimmed = label.trim();
    const shorthand = trimmed.split(' ')[0];
    return palette[trimmed] || palette[shorthand] || this.config.COLORS.gray;
  }

  renderLoading() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    container.innerHTML = LoadingSkeleton({ type: 'metric', count: 6 });
  }

  renderError(error) {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    container.innerHTML = `
      <div class="error-state">
        <h3>Failed to Load Activity</h3>
        <p>${this.escapeHtml(error?.message || 'Unknown error')}</p>
        <a href="#/activities" class="btn btn--primary">Back to Activities</a>
      </div>
    `;
  }

  onUnload() {
    if (this.powerZoneChart) {
      this.powerZoneChart.destroy();
      this.powerZoneChart = null;
    }
    if (this.hrZoneChart) {
      this.hrZoneChart.destroy();
      this.hrZoneChart = null;
    }
    this.activity = null;
    this.settings = null;
    this.activityId = null;
  }
}

const activityDetailPage = new ActivityDetailPage();
export default activityDetailPage;
