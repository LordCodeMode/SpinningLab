// ============================================
// FILE: pages/critical-power/index.js
// Critical Power Analysis Page - Enhanced
// ============================================

import Services from '../../services/index.js';
import { LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

class CriticalPowerPage {
  constructor() {
    this.config = CONFIG;
    this.chart = null;
    this.tooltipTimeout = null;
  }

  async load() {
    try {
      Services.analytics.trackPageView('critical-power');
      this.renderLoading();
      
      // Fetch CP model data (required)
      this.data = await Services.data.getCriticalPower();
      
      // Try to fetch power curve data (optional)
      try {
        this.powerCurve = await Services.data.getPowerCurve();
        // Ensure it's an array
        if (!Array.isArray(this.powerCurve)) {
          console.warn('[CP] Power curve data is not an array, using empty array');
          this.powerCurve = [];
        }
      } catch (error) {
        console.warn('[CP] Could not load power curve data:', error);
        this.powerCurve = [];
      }
      
      this.render();
      this.initChart();
      this.attachEventListeners();
    } catch (error) {
      console.error('[CP] Load error:', error);
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) {
      console.error('[CP] Page content container not found');
      return;
    }
    
    const { critical_power, w_prime, fit_quality } = this.data;
    
    // Calculate model quality metrics
    const cpPerKg = (critical_power / 75).toFixed(1); // Assuming 75kg
    const wPrimeKj = (w_prime / 1000).toFixed(1);
    const fitScore = fit_quality ? (fit_quality * 100).toFixed(1) : 95.0;
    
    container.innerHTML = `
      <div class="cp-section">
        <!-- Header -->
        <div class="cp-header">
          <h1>Critical Power Analysis</h1>
          <p>Advanced 2-parameter physiological model comparing your theoretical capacity with actual performance across all durations</p>
        </div>
        
        <!-- Key Metrics -->
        <div class="cp-metrics-grid">
          ${this.renderMetricCard({
            label: 'Critical Power (CP)',
            value: Math.round(critical_power),
            subtitle: `${cpPerKg} W/kg · Sustainable threshold`,
            variant: 'purple',
            icon: 'zap',
            tooltip: 'The highest power output you can theoretically sustain indefinitely. This represents your aerobic capacity ceiling.'
          })}
          
          ${this.renderMetricCard({
            label: "W' (W Prime)",
            value: Math.round(w_prime),
            subtitle: `${wPrimeKj} kJ · Anaerobic capacity`,
            variant: 'blue',
            icon: 'battery-charging',
            tooltip: 'Your anaerobic work capacity - the total energy available above CP before exhaustion. Think of it as your battery for efforts above threshold.'
          })}
          
          ${this.renderMetricCard({
            label: 'Model Fit Quality',
            value: fitScore,
            subtitle: 'R² · Prediction accuracy',
            variant: 'amber',
            icon: 'target',
            tooltip: 'How well the CP model fits your actual power data. Higher values (>90%) indicate the model accurately predicts your performance.'
          })}
        </div>
        
        <!-- Power Curve Comparison Chart -->
        <div class="cp-chart-card">
          <div class="cp-chart-header">
            <div class="cp-chart-title-group">
              <div class="cp-chart-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                </svg>
              </div>
              <div>
                <div class="cp-chart-title">Power Duration Model vs Actual</div>
                <div class="cp-chart-subtitle">
                  ${this.powerCurve && this.powerCurve.length > 0 
                    ? 'Compare theoretical CP model predictions with your best recorded powers' 
                    : 'Showing CP model prediction (upload activities to see actual power comparison)'}
                </div>
              </div>
            </div>
            <div class="cp-chart-legend">
              <div class="cp-legend-item">
                <div class="cp-legend-dot actual"></div>
                <span>Actual Best</span>
              </div>
              <div class="cp-legend-item">
                <div class="cp-legend-dot model"></div>
                <span>CP Model</span>
              </div>
              <div class="cp-legend-item">
                <div class="cp-legend-dot difference"></div>
                <span>Difference</span>
              </div>
            </div>
          </div>
          <div class="cp-chart-container">
            <canvas id="cpComparisonChart"></canvas>
          </div>
        </div>
        
        <!-- Two-column layout for info and insights -->
        <div class="cp-dual-column">
          <!-- Info Card -->
          <div class="cp-info-card">
            <div class="cp-info-header">
              <svg class="cp-info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <h3 class="cp-info-title">Understanding Critical Power</h3>
            </div>
            <div class="cp-info-content">
              <p>
                <strong>Critical Power (CP)</strong> is your maximum sustainable power output - the highest intensity you can maintain without accumulating fatigue. 
                Think of it as your aerobic threshold: efforts below CP can be sustained for very long periods, while efforts above CP deplete your W' reserves.
              </p>
              <p>
                <strong>W' (W Prime)</strong> represents your anaerobic work capacity - essentially a battery that drains when you exceed CP and recharges when you drop below it. 
                Larger W' values indicate better sprint and high-intensity capacity, while higher CP indicates better endurance.
              </p>
            </div>
            
            ${this.renderFormulaCard(critical_power, w_prime)}
          </div>
          
          <!-- Training Insights -->
          <div class="cp-insights-column">
            <h3 class="cp-insights-title">Model Applications & Training</h3>
            ${this.renderInsightCard({
              icon: 'trending-up',
              title: 'Improve CP',
              text: 'Focus on threshold intervals (95-105% CP) for 10-20 minutes. Sweet spot training (88-93% CP) also builds aerobic capacity effectively.'
            })}
            
            ${this.renderInsightCard({
              icon: 'zap',
              title: "Expand W'",
              text: 'Short, maximal efforts (30s-3min) above CP deplete W\' and force adaptations. Include 2-3 high-intensity sessions weekly.'
            })}
            
            ${this.renderInsightCard({
              icon: 'activity',
              title: 'Practical Uses',
              text: 'Use CP/W\' to predict time-to-exhaustion, plan race pacing, prescribe training zones, and track fitness changes over time.'
            })}
          </div>
        </div>
        
        <!-- Model vs Reality explanation -->
        <div class="cp-reality-card">
          <div class="cp-reality-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div class="cp-reality-content">
            <h4>The Model vs Reality</h4>
            <p>
              The chart above compares the theoretical CP model (blue line) with your actual best powers (purple line). 
              The orange area shows where your actual performance exceeds or falls short of the model prediction. Large deviations may indicate:
            </p>
            <ul>
              <li>Better short-duration performance (anaerobic strengths)</li>
              <li>Pacing strategy differences in longer efforts</li>
              <li>Opportunities for targeted training</li>
            </ul>
          </div>
        </div>
      </div>
    `;
    
    if (typeof feather !== 'undefined') feather.replace();
  }

  renderMetricCard({ label, value, subtitle, variant, icon, tooltip }) {
    return `
      <div class="cp-metric-card" data-tooltip="${tooltip}">
        <div class="cp-metric-header-row">
          <div class="cp-metric-icon ${variant}">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              ${this.getIconPath(icon)}
            </svg>
          </div>
          <svg class="cp-metric-info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <div class="cp-metric-label">${label}</div>
        <div class="cp-metric-value">${value}</div>
        <div class="cp-metric-subtitle">${subtitle}</div>
      </div>
    `;
  }

  renderInsightCard({ icon, title, text }) {
    return `
      <div class="cp-insight-card">
        <div class="cp-insight-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${this.getIconPath(icon)}
          </svg>
        </div>
        <div class="cp-insight-title">${title}</div>
        <div class="cp-insight-text">${text}</div>
      </div>
    `;
  }

  renderFormulaCard(cp, wPrime) {
    return `
      <div class="cp-formula-card">
        <div class="cp-formula-title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
          Mathematical Model
        </div>
        <div class="cp-formula-content">
          t = W' / (P - CP)
        </div>
        <div class="cp-formula-variables">
          <div><strong>t</strong> = Time to exhaustion (seconds)</div>
          <div><strong>P</strong> = Power output (watts)</div>
          <div><strong>CP</strong> = Critical Power (${Math.round(cp)} W)</div>
          <div><strong>W'</strong> = Anaerobic work capacity (${Math.round(wPrime)} J)</div>
        </div>
      </div>
    `;
  }

  getIconPath(icon) {
    const icons = {
      'zap': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>',
      'battery-charging': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>',
      'target': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
      'trending-up': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>',
      'activity': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'
    };
    return icons[icon] || icons['zap'];
  }

  initChart() {
    const canvas = document.getElementById('cpComparisonChart');
    if (!canvas) {
      console.warn('[CP] Chart canvas not found');
      return;
    }

    const { critical_power, w_prime } = this.data;
    
    // Generate time points (1 second to 1 hour in log scale)
    const durations = [
      1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 
      600, 900, 1200, 1800, 2400, 3000, 3600
    ];
    
    // Calculate CP model predictions
    const modelData = durations.map(t => ({
      x: t,
      y: t < 10 ? null : critical_power + (w_prime / t)
    }));
    
    // Get actual power curve data (matching durations)
    const actualData = durations.map(t => {
      // Safety check - ensure powerCurve is an array
      if (!Array.isArray(this.powerCurve) || this.powerCurve.length === 0) {
        return { x: t, y: null };
      }
      
      const power = this.powerCurve.find(p => Math.abs(p.duration - t) < 5);
      return {
        x: t,
        y: power ? power.power : null
      };
    });
    
    // Calculate difference for shading
    const differenceData = durations.map((t, i) => {
      const actual = actualData[i].y;
      const model = modelData[i].y;
      return {
        x: t,
        y: (actual && model) ? Math.abs(actual - model) : null
      };
    });

    const chartData = {
      datasets: [
        {
          label: 'Actual Best Powers',
          data: actualData,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          tension: 0.4,
          fill: false,
          order: 1
        },
        {
          label: 'CP Model Prediction',
          data: modelData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          borderDash: [8, 4],
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          tension: 0.4,
          fill: false,
          order: 2
        },
        {
          label: 'Difference',
          data: differenceData,
          borderColor: 'rgba(245, 158, 11, 0.5)',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          order: 3
        }
      ]
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#8b5cf6',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            title: (context) => {
              const seconds = context[0].parsed.x;
              return this.formatDuration(seconds);
            },
            label: (context) => {
              const value = context.parsed.y;
              if (value === null) return null;
              
              const label = context.dataset.label;
              if (label === 'Difference') {
                return `${label}: ${Math.round(value)} W gap`;
              }
              return `${label}: ${Math.round(value)} W`;
            },
            afterBody: (context) => {
              const seconds = context[0].parsed.x;
              const actual = actualData.find(d => d.x === seconds)?.y;
              const model = modelData.find(d => d.x === seconds)?.y;
              
              if (actual && model) {
                const diff = actual - model;
                const pct = ((diff / model) * 100).toFixed(1);
                return `\n${diff > 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs model`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          type: 'logarithmic',
          position: 'bottom',
          title: {
            display: true,
            text: 'Duration',
            font: {
              size: 13,
              weight: '600'
            },
            color: '#6b7280'
          },
          ticks: {
            callback: (value) => {
              // Only show clean durations
              if (value === 1) return '1s';
              if (value === 5) return '5s';
              if (value === 10) return '10s';
              if (value === 30) return '30s';
              if (value === 60) return '1m';
              if (value === 120) return '2m';
              if (value === 300) return '5m';
              if (value === 600) return '10m';
              if (value === 1200) return '20m';
              if (value === 1800) return '30m';
              if (value === 3600) return '1h';
              return null;
            },
            color: '#6b7280',
            font: {
              size: 11
            },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          min: 1,
          max: 3600
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: 'Power (watts)',
            font: {
              size: 13,
              weight: '600'
            },
            color: '#6b7280'
          },
          ticks: {
            color: '#6b7280',
            font: {
              size: 11
            },
            callback: (value) => Math.round(value) + ' W'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          }
        }
      }
    };

    this.chart = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
  }

  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  attachEventListeners() {
    // Add hover tooltips for metric cards
    const metricCards = document.querySelectorAll('.cp-metric-card[data-tooltip]');
    
    metricCards.forEach(card => {
      card.addEventListener('mouseenter', (e) => {
        this.showTooltip(e, card.dataset.tooltip);
      });
      
      card.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    });
  }

  showTooltip(event, text) {
    // Remove existing tooltip
    this.hideTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'cp-tooltip show';
    tooltip.innerHTML = text;
    document.body.appendChild(tooltip);
    
    const rect = event.currentTarget.getBoundingClientRect();
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 10}px`;
    tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
    
    this.currentTooltip = tooltip;
  }

  hideTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  }

  renderLoading() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="cp-section">
        <div class="cp-header">
          <h1>Critical Power Analysis</h1>
          <p>Loading your power data...</p>
        </div>
        <div class="cp-metrics-grid">
          ${LoadingSkeleton({ type: 'metric', count: 3 })}
        </div>
        ${LoadingSkeleton({ type: 'chart', count: 1 })}
      </div>
    `;
  }

  renderError(error) {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) {
      console.error('[CP] Cannot render error - container not found');
      return;
    }
    
    container.innerHTML = `
      <div class="cp-error-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        <h3>Failed to Load Critical Power Data</h3>
        <p>${error.message || 'Unable to calculate CP model. Please ensure you have sufficient power data.'}</p>
        <button class="btn btn--primary" onclick="window.router.refresh()" style="margin-top: 20px; padding: 12px 24px; background: #8b5cf6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Try Again
        </button>
      </div>
    `;
  }

  onUnload() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.hideTooltip();
  }
}

const criticalPowerPage = new CriticalPowerPage();
export default criticalPowerPage;