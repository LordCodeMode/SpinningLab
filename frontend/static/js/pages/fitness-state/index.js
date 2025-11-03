// ============================================
// FITNESS STATE PAGE - REDESIGNED UX
// Modern health dashboard with visual storytelling
// ============================================

import Services from '../../services/index.js';
import { InsightCard, LoadingSkeleton } from '../../components/ui/index.js';
import { eventBus, EVENTS } from '../../core/eventBus.js';
import CONFIG from './config.js';

class FitnessStatePage {
  constructor() {
    this.config = CONFIG;
    this.handleDataImported = this.handleDataImported.bind(this);
    this.historicalData = [];
    this.triangleChart = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('fitness-state');
      this.renderLoading();

      // Fetch both current state and training load for trend
      const [fitnessState, trainingLoad] = await Promise.all([
        Services.data.getFitnessState({ forceRefresh: true }),
        Services.data.getTrainingLoad({ days: 90, forceRefresh: false }).catch(() => ({ daily: [] }))
      ]);

      this.data = fitnessState;
      this.historicalData = trainingLoad?.daily || [];
      this.insights = Services.insight.generateFitnessStateInsights(this.data);

      this.render();
      this.initVisualizations();
      eventBus.on(EVENTS.DATA_IMPORTED, this.handleDataImported);
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

    const {
      status = 'unknown',
      status_description = 'No data available yet. Upload more activities to analyse your fitness state.',
      ctl = null,
      atl = null,
      tsb = null,
      ef_trend = null,
      recommendations = []
    } = this.data || {};

    container.innerHTML = `
      <div class="fs-redesign">
        <!-- Animated Header with Status Weather -->
        <div class="fs-hero">
          <div class="fs-hero-content">
            <div class="fs-hero-meta">
              <span class="fs-badge">
                <i data-feather="activity"></i>
                Fitness Analysis
              </span>
              <span class="fs-badge fs-badge-outline">
                <i data-feather="calendar"></i>
                Last 90 days
              </span>
            </div>
            <h1 class="fs-hero-title">Your Training State</h1>
            <p class="fs-hero-subtitle">Real-time insights into your current fitness and fatigue balance</p>
          </div>

          <!-- Large Visual Status Indicator -->
          ${this.renderStatusWeather(status, status_description)}
        </div>

        <!-- Primary Metrics with Trends -->
        <div class="fs-metrics-showcase">
          ${this.renderMetricShowcase('ctl', 'Chronic Training Load', ctl, 'Fitness', 'trending-up', 'blue')}
          ${this.renderMetricShowcase('atl', 'Acute Training Load', atl, 'Fatigue', 'zap', 'amber')}
          ${this.renderMetricShowcase('tsb', 'Training Stress Balance', tsb, 'Form', 'target', tsb >= 0 ? 'green' : 'orange')}
        </div>

        <!-- Interactive Triangle Visualization -->
        <div class="fs-triangle-section">
          <div class="fs-triangle-header">
            <h3>The Fitness Triangle</h3>
            <p>Visual relationship between fitness, fatigue, and form</p>
          </div>
          <div class="fs-triangle-container">
            <canvas id="fs-triangle-chart"></canvas>
            <div class="fs-triangle-legend">
              <div class="fs-triangle-legend-item">
                <div class="fs-legend-dot" style="background: var(--color-blue-500)"></div>
                <span>CTL (Fitness)</span>
              </div>
              <div class="fs-triangle-legend-item">
                <div class="fs-legend-dot" style="background: var(--color-amber-500)"></div>
                <span>ATL (Fatigue)</span>
              </div>
              <div class="fs-triangle-legend-item">
                <div class="fs-legend-dot" style="background: var(--color-green-500)"></div>
                <span>TSB (Form)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Cards Based on Status -->
        ${recommendations && recommendations.length > 0 ? `
          <div class="fs-actions-grid">
            <div class="fs-actions-header">
              <h3>Recommended Actions</h3>
              <p>Personalized guidance based on your current state</p>
            </div>
            <div class="fs-action-cards">
              ${recommendations.slice(0, 3).map((rec, index) => this.renderActionCard(rec, index, status)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Additional Metrics -->
        ${ef_trend !== null ? `
          <div class="fs-secondary-metrics">
            <div class="fs-secondary-card">
              <div class="fs-secondary-icon">
                <i data-feather="trending-${ef_trend > 0 ? 'up' : 'down'}"></i>
              </div>
              <div class="fs-secondary-content">
                <div class="fs-secondary-label">Efficiency Trend</div>
                <div class="fs-secondary-value">${this.formatMetric(ef_trend, 2)}%</div>
                <div class="fs-secondary-desc">
                  ${ef_trend > 0 ? 'Improving aerobic efficiency' : ef_trend < 0 ? 'Declining efficiency - consider recovery' : 'Stable efficiency'}
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Insights Section -->
        ${this.insights && this.insights.length > 0 ? `
          <div class="fs-insights-section">
            <div class="fs-insights-header">
              <h3>Detailed Analysis</h3>
              <p>Data-driven insights about your training patterns</p>
            </div>
            <div class="insights-grid">
              ${this.insights.map(i => InsightCard(i)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    if (typeof feather !== 'undefined') feather.replace();
  }

  renderStatusWeather(status, description) {
    const statusConfig = this.getStatusConfig(status);

    return `
      <div class="fs-weather-card fs-weather-${status}">
        <div class="fs-weather-visual">
          <div class="fs-weather-icon-container">
            ${statusConfig.weatherIcon}
          </div>
          <div class="fs-weather-particles"></div>
        </div>
        <div class="fs-weather-content">
          <div class="fs-weather-status">${statusConfig.label}</div>
          <div class="fs-weather-description">${description}</div>
          <div class="fs-weather-badge ${statusConfig.badgeClass}">
            ${statusConfig.badge}
          </div>
        </div>
      </div>
    `;
  }

  renderMetricShowcase(key, label, value, shortLabel, icon, color) {
    const trend = this.calculateTrend(key);
    const trendIcon = trend > 0 ? 'trending-up' : trend < 0 ? 'trending-down' : 'minus';
    const trendClass = trend > 0 ? 'positive' : trend < 0 ? 'negative' : 'neutral';

    return `
      <div class="fs-metric-showcase">
        <div class="fs-metric-showcase-header">
          <div class="fs-metric-icon fs-metric-icon-${color}">
            <i data-feather="${icon}"></i>
          </div>
          <div class="fs-metric-label-group">
            <div class="fs-metric-label">${label}</div>
            <div class="fs-metric-short">${shortLabel}</div>
          </div>
        </div>
        <div class="fs-metric-value-large">${this.formatMetric(value, 1)}</div>
        <div class="fs-metric-trend">
          <i data-feather="${trendIcon}" class="trend-${trendClass}"></i>
          <span class="trend-${trendClass}">${Math.abs(trend).toFixed(1)}% vs last week</span>
        </div>
        <div class="fs-metric-sparkline" data-metric="${key}">
          <canvas id="fs-sparkline-${key}"></canvas>
        </div>
      </div>
    `;
  }

  renderActionCard(recommendation, index, status) {
    const icons = ['check-circle', 'alert-circle', 'info'];
    const priorities = ['high', 'medium', 'low'];

    return `
      <div class="fs-action-card fs-action-${priorities[index] || 'low'}">
        <div class="fs-action-icon">
          <i data-feather="${icons[index] || 'info'}"></i>
        </div>
        <div class="fs-action-content">
          <div class="fs-action-text">${recommendation}</div>
        </div>
        <div class="fs-action-arrow">
          <i data-feather="arrow-right"></i>
        </div>
      </div>
    `;
  }

  getStatusConfig(status) {
    const configs = {
      peak: {
        label: 'Peak Performance',
        badge: 'Race Ready',
        badgeClass: 'badge-peak',
        weatherIcon: `
          <svg class="fs-weather-svg" viewBox="0 0 100 100">
            <circle class="sun-core" cx="50" cy="50" r="20" fill="url(#sunGradient)"/>
            <g class="sun-rays">
              ${[0, 45, 90, 135, 180, 225, 270, 315].map(angle => `
                <line x1="50" y1="10" x2="50" y2="20"
                      transform="rotate(${angle} 50 50)"
                      stroke="url(#rayGradient)" stroke-width="3" stroke-linecap="round"/>
              `).join('')}
            </g>
            <defs>
              <linearGradient id="sunGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fbbf24"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
              <linearGradient id="rayGradient">
                <stop offset="0%" stop-color="#fbbf24" stop-opacity="1"/>
                <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.5"/>
              </linearGradient>
            </defs>
          </svg>
        `
      },
      optimal: {
        label: 'Optimal State',
        badge: 'Well Balanced',
        badgeClass: 'badge-optimal',
        weatherIcon: `
          <svg class="fs-weather-svg" viewBox="0 0 100 100">
            <circle cx="50" cy="40" r="18" fill="url(#sunOptimal)"/>
            <path d="M 20 60 Q 30 55, 40 60 T 60 60 T 80 60" fill="none" stroke="#94a3b8" stroke-width="2.5" opacity="0.6"/>
            <defs>
              <linearGradient id="sunOptimal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#10b981"/>
                <stop offset="100%" stop-color="#059669"/>
              </linearGradient>
            </defs>
          </svg>
        `
      },
      good: {
        label: 'Good Condition',
        badge: 'Progressing',
        badgeClass: 'badge-good',
        weatherIcon: `
          <svg class="fs-weather-svg" viewBox="0 0 100 100">
            <circle cx="50" cy="45" r="16" fill="url(#cloudSunGradient)"/>
            <ellipse cx="45" cy="60" rx="18" ry="12" fill="#cbd5e1" opacity="0.7"/>
            <ellipse cx="55" cy="62" rx="15" ry="10" fill="#e2e8f0" opacity="0.8"/>
            <defs>
              <linearGradient id="cloudSunGradient">
                <stop offset="0%" stop-color="#3b82f6"/>
                <stop offset="100%" stop-color="#2563eb"/>
              </linearGradient>
            </defs>
          </svg>
        `
      },
      overreaching: {
        label: 'Overreaching',
        badge: 'Caution',
        badgeClass: 'badge-warning',
        weatherIcon: `
          <svg class="fs-weather-svg" viewBox="0 0 100 100">
            <path d="M 30 50 Q 40 40, 50 50 T 70 50" fill="#cbd5e1"/>
            <path d="M 35 55 Q 42 48, 48 55 T 58 55" fill="#94a3b8"/>
            <path d="M 45 60 L 47 75 M 55 60 L 53 75 M 50 62 L 50 78" stroke="#f59e0b" stroke-width="2" opacity="0.7"/>
            <circle cx="48" cy="40" r="2" fill="#fbbf24" opacity="0.5"/>
          </svg>
        `
      },
      fatigued: {
        label: 'Fatigued',
        badge: 'Recovery Needed',
        badgeClass: 'badge-danger',
        weatherIcon: `
          <svg class="fs-weather-svg" viewBox="0 0 100 100">
            <path d="M 25 45 Q 35 35, 45 45 T 65 45 T 85 45" fill="#94a3b8"/>
            <path d="M 30 52 Q 38 44, 46 52 T 60 52 T 74 52" fill="#64748b"/>
            <path d="M 35 70 L 37 85 M 48 68 L 50 82 M 63 70 L 61 84" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="40" cy="65" r="1.5" fill="#ef4444" opacity="0.4"/>
            <circle cx="55" cy="62" r="1.5" fill="#ef4444" opacity="0.4"/>
          </svg>
        `
      },
      unknown: {
        label: 'Analyzing',
        badge: 'Need More Data',
        badgeClass: 'badge-neutral',
        weatherIcon: `
          <svg class="fs-weather-svg" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="18" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-dasharray="4 4"/>
            <text x="50" y="58" text-anchor="middle" fill="#64748b" font-size="24" font-weight="bold">?</text>
          </svg>
        `
      }
    };

    return configs[status] || configs.unknown;
  }

  calculateTrend(metric) {
    if (!this.historicalData || this.historicalData.length < 14) return 0;

    const recent = this.historicalData.slice(-7);
    const previous = this.historicalData.slice(-14, -7);

    const metricMap = { ctl: 'ctl', atl: 'atl', tsb: 'tsb' };
    const key = metricMap[metric];
    if (!key) return 0;

    const recentAvg = recent.reduce((sum, d) => sum + (d[key] || 0), 0) / recent.length;
    const previousAvg = previous.reduce((sum, d) => sum + (d[key] || 0), 0) / previous.length;

    if (previousAvg === 0) return 0;
    return ((recentAvg - previousAvg) / previousAvg) * 100;
  }

  initVisualizations() {
    this.renderTriangleChart();
    this.renderSparklines();
    this.addWeatherAnimation();

    if (typeof feather !== 'undefined') feather.replace();
  }

  renderTriangleChart() {
    const canvas = document.getElementById('fs-triangle-chart');
    if (!canvas) return;

    const { ctl = 50, atl = 40, tsb = 0 } = this.data || {};

    const ctx = canvas.getContext('2d');
    const maxValue = Math.max(ctl, atl, Math.abs(tsb)) * 1.2;

    if (this.triangleChart) {
      this.triangleChart.destroy();
    }

    this.triangleChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Fitness (CTL)', 'Fatigue (ATL)', 'Form (TSB)'],
        datasets: [{
          label: 'Current State',
          data: [ctl, atl, tsb + maxValue/2], // Offset TSB to always positive
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          borderColor: 'rgba(59, 130, 246, 0.8)',
          borderWidth: 3,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            min: 0,
            max: maxValue,
            ticks: {
              stepSize: maxValue / 5,
              font: { size: 11 },
              color: '#64748b'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)'
            },
            angleLines: {
              color: 'rgba(148, 163, 184, 0.2)'
            },
            pointLabels: {
              font: { size: 13, weight: '600' },
              color: '#1e293b'
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: 12,
            titleFont: { size: 13, weight: '600' },
            bodyFont: { size: 12 },
            cornerRadius: 8
          }
        }
      }
    });
  }

  renderSparklines() {
    ['ctl', 'atl', 'tsb'].forEach(metric => {
      const canvas = document.getElementById(`fs-sparkline-${metric}`);
      if (!canvas) return;

      const data = this.historicalData.slice(-30).map(d => d[metric] || 0);
      const ctx = canvas.getContext('2d');

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map((_, i) => i),
          datasets: [{
            data: data,
            borderColor: metric === 'ctl' ? '#3b82f6' : metric === 'atl' ? '#f59e0b' : '#10b981',
            borderWidth: 2,
            fill: true,
            backgroundColor: metric === 'ctl'
              ? 'rgba(59, 130, 246, 0.1)'
              : metric === 'atl'
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { display: false },
            y: { display: false }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          }
        }
      });
    });
  }

  addWeatherAnimation() {
    // Add subtle floating animation to weather particles
    const particles = document.querySelector('.fs-weather-particles');
    if (particles) {
      for (let i = 0; i < 5; i++) {
        const particle = document.createElement('div');
        particle.className = 'fs-particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 2}s`;
        particles.appendChild(particle);
      }
    }
  }

  formatMetric(value, digits = 1, fallback = '—') {
    if (value == null || Number.isNaN(value)) return fallback;
    return Number(value).toFixed(digits);
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
    if (this.triangleChart) this.triangleChart.destroy();
    this.data = null;
    eventBus.off(EVENTS.DATA_IMPORTED, this.handleDataImported);
  }

  async handleDataImported() {
    try {
      const [fitnessState, trainingLoad] = await Promise.all([
        Services.data.getFitnessState({ forceRefresh: true }),
        Services.data.getTrainingLoad({ days: 90, forceRefresh: false }).catch(() => ({ daily: [] }))
      ]);

      this.data = fitnessState;
      this.historicalData = trainingLoad?.daily || [];
      this.insights = Services.insight.generateFitnessStateInsights(this.data);
      this.render();
      this.initVisualizations();
    } catch (error) {
      console.error('[FitnessState] Refresh failed:', error);
    }
  }
}

const fitnessStatePage = new FitnessStatePage();
export default fitnessStatePage;
