// ============================================
// FITNESS STATE PAGE
// ============================================

// FILE: pages/fitness-state/index.js
import Services from '../../services/index.js';
import { InsightCard, LoadingSkeleton, MetricCard } from '../../components/ui/index.js';
import CONFIG from './config.js';

class FitnessStatePage {
  constructor() {
    this.config = CONFIG;
  }

  async load() {
    try {
      Services.analytics.trackPageView('fitness-state');
      this.renderLoading();
      
      this.data = await Services.data.getFitnessState();
      this.insights = Services.insight.generateFitnessStateInsights(this.data);
      
      this.render();
    } catch (error) {
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent');
    if (!container) {
      console.error('[FitnessState] Container not found');
      return;
    }

    const { status, status_description, ctl, atl, tsb, ef_trend, recommendations } = this.data;

    container.innerHTML = `
      <div class="fs-section">
        <div class="fs-header">
          <h1>Fitness State Analysis</h1>
          <p>Comprehensive analysis of your current training state</p>
        </div>

        <!-- Status Banner -->
        <div class="fs-status-banner">
          <div class="fs-status-icon">
            ${this.getStatusIconSVG(status)}
          </div>
          <div class="fs-status-content">
            <div class="fs-status-label">Current Status</div>
            <div class="fs-status-title">${this.capitalizeFirst(status)}</div>
            <div class="fs-status-description">${status_description}</div>
          </div>
        </div>

        <!-- Metrics Grid -->
        <div class="fs-metrics-grid">
          <div class="fs-metric-card">
            <div class="fs-metric-header">
              <div class="fs-metric-icon blue">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </div>
              <span class="fs-metric-label">CTL (Fitness)</span>
            </div>
            <div class="fs-metric-value">${ctl.toFixed(1)}</div>
          </div>

          <div class="fs-metric-card">
            <div class="fs-metric-header">
              <div class="fs-metric-icon amber">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <span class="fs-metric-label">ATL (Fatigue)</span>
            </div>
            <div class="fs-metric-value">${atl.toFixed(1)}</div>
          </div>

          <div class="fs-metric-card">
            <div class="fs-metric-header">
              <div class="fs-metric-icon ${tsb >= 0 ? 'green' : 'amber'}">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <span class="fs-metric-label">TSB (Form)</span>
            </div>
            <div class="fs-metric-value">${tsb.toFixed(1)}</div>
          </div>

          <div class="fs-metric-card">
            <div class="fs-metric-header">
              <div class="fs-metric-icon blue">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <span class="fs-metric-label">Efficiency Trend</span>
            </div>
            <div class="fs-metric-value">${ef_trend ? ef_trend.toFixed(1) + '%' : '-'}</div>
          </div>
        </div>

        <!-- Recommendations -->
        ${recommendations && recommendations.length > 0 ? `
          <div class="fs-recommendations-card">
            <div class="fs-recommendations-header">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
              <span class="fs-recommendations-title">Recommendations</span>
            </div>
            ${recommendations.map(rec => `
              <div class="fs-recommendation-item">
                <div class="fs-recommendation-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
                <div class="fs-recommendation-text">${rec}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Insights -->
        ${this.insights && this.insights.length > 0 ? `
          <div class="insights-container">
            <h3 class="insights-title">Detailed Insights</h3>
            <div class="insights-grid">
              ${this.insights.map(i => InsightCard(i)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    if (typeof feather !== 'undefined') feather.replace();
  }

  getStatusColor(status) {
    const colors = {
      peak: '#10b981',
      optimal: '#10b981',
      good: '#3b82f6',
      overreaching: '#f59e0b',
      fatigued: '#ef4444',
      unknown: '#6b7280'
    };
    return colors[status] || colors.unknown;
  }

  getStatusIcon(status) {
    const icons = {
      peak: '🔥',
      optimal: '💪',
      good: '👍',
      overreaching: '⚠️',
      fatigued: '😴',
      unknown: '❓'
    };
    return icons[status] || icons.unknown;
  }

  getStatusIconSVG(status) {
    const icons = {
      peak: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
      optimal: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      good: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"/></svg>`,
      overreaching: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
      fatigued: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      unknown: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
    };
    return icons[status] || icons.unknown;
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  renderLoading() {
    document.getElementById('pageContent').innerHTML = LoadingSkeleton({ type: 'card', count: 3 });
  }

  renderError(error) {
    document.getElementById('pageContent').innerHTML = `
      <div class="error-state">
        <h3>Failed to Load Fitness State</h3>
        <p>${error.message}</p>
      </div>
    `;
  }

  onUnload() {
    this.data = null;
  }
}

const fitnessStatePage = new FitnessStatePage();
export default fitnessStatePage;
