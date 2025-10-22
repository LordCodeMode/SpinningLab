// ============================================
// FITNESS STATE PAGE
// ============================================

// FILE: pages/fitness-state/index.js
import Services from '../../services/index.js';
import { InsightCard } from '../../components/ui/index.js';
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
    const { status, status_description, ctl, atl, tsb, ef_trend, recommendations } = this.data;
    
    container.innerHTML = `
      <div class="page-section">
        <div class="page-header">
          <h1>Fitness State Analysis</h1>
          <p>Comprehensive analysis of your current training state</p>
        </div>

        <!-- Status Card -->
        <div class="card p-6 mb-6" style="border-left: 4px solid ${this.getStatusColor(status)}">
          <div class="flex items-center gap-4">
            <div class="text-6xl">${this.getStatusIcon(status)}</div>
            <div class="flex-1">
              <h2 class="text-2xl font-bold mb-2">${this.capitalizeFirst(status)}</h2>
              <p class="text-secondary">${status_description}</p>
            </div>
          </div>
        </div>

        <!-- Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          ${MetricCard({ label: 'CTL (Fitness)', value: ctl.toFixed(1), variant: 'primary' })}
          ${MetricCard({ label: 'ATL (Fatigue)', value: atl.toFixed(1), variant: 'danger' })}
          ${MetricCard({ label: 'TSB (Form)', value: tsb.toFixed(1), variant: tsb >= 0 ? 'success' : 'warning' })}
          ${MetricCard({ label: 'Efficiency Trend', value: ef_trend ? ef_trend.toFixed(1) + '%' : '-', variant: 'info' })}
        </div>

        <!-- Recommendations -->
        ${recommendations && recommendations.length > 0 ? `
          <div class="card p-6">
            <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
              <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
              Recommendations
            </h3>
            <ul class="space-y-2">
              ${recommendations.map(rec => `
                <li class="flex items-start gap-3">
                  <svg class="w-5 h-5 text-success mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                  <span>${rec}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- Insights -->
        ${this.insights && this.insights.length > 0 ? `
          <div class="mt-6">
            <h3 class="text-xl font-bold mb-4">Detailed Insights</h3>
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
