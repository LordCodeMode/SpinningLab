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
    this.powerCurveData = null;
    this.powerCurvePoints = [];
    this.modelPowerPoints = [];
  }

  async load() {
    try {
      Services.analytics.trackPageView('critical-power');
      this.renderLoading();
      
      // Fetch CP model data (required)
      this.data = await Services.data.getCriticalPower();
      this.modelPowerPoints = this.prepareModelPowerPoints(this.data);
      if (this.modelPowerPoints.length > 0) {
        console.table(
          this.modelPowerPoints.slice(0, 10),
          ['duration', 'power']
        );
      }
      
      // Try to fetch power curve data (optional)
      try {
        this.powerCurveData = await Services.data.getPowerCurve();
        this.powerCurvePoints = this.preparePowerCurvePoints(this.powerCurveData);

        if (this.powerCurvePoints.length === 0) {
          console.warn('[CP] Power curve data has no valid points');
        } else {
          console.table(
            this.powerCurvePoints.slice(0, 10),
            ['duration', 'power']
          );
        }
      } catch (error) {
        console.warn('[CP] Could not load power curve data:', error);
        this.powerCurveData = null;
        this.powerCurvePoints = [];
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
                  ${this.hasActualPowerData() 
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
        
        ${this.renderDataOverview()}
        
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

  preparePowerCurvePoints(data) {
    if (!data || !Array.isArray(data.durations) || !Array.isArray(data.powers)) {
      return [];
    }

    const maxLength = Math.min(data.durations.length, data.powers.length);
    const pairs = new Map();

    for (let i = 0; i < maxLength; i += 1) {
      const duration = data.durations[i];
      const power = data.powers[i];

      if (duration == null || power == null) {
        continue;
      }

      const durationNumber = Number(duration);
      const powerNumber = Number(power);

      if (!Number.isFinite(durationNumber) || !Number.isFinite(powerNumber)) {
        continue;
      }

      const durationValue = Math.max(1, Math.round(durationNumber));
      const powerValue = powerNumber;

      const existing = pairs.get(durationValue);
      if (existing === undefined || powerValue > existing) {
        pairs.set(durationValue, powerValue);
      }
    }

    const sortedDurations = Array.from(pairs.keys()).sort((a, b) => a - b);

    return sortedDurations.map(duration => ({
      duration,
      power: pairs.get(duration)
    }));
  }

  prepareModelPowerPoints(data) {
    if (!data || !Array.isArray(data.durations) || !Array.isArray(data.actual)) {
      return [];
    }

    const maxLength = Math.min(data.durations.length, data.actual.length);
    const pairs = [];

    for (let i = 0; i < maxLength; i += 1) {
      const duration = Number(data.durations[i]);
      const power = Number(data.actual[i]);

      if (!Number.isFinite(duration) || !Number.isFinite(power)) {
        continue;
      }

      const durationValue = Math.max(1, Math.round(duration));
      pairs.push({
        duration: durationValue,
        power
      });
    }

    pairs.sort((a, b) => a.duration - b.duration);
    return pairs;
  }

  hasActualPowerData() {
    return (Array.isArray(this.powerCurvePoints) && this.powerCurvePoints.length > 0) ||
      (Array.isArray(this.modelPowerPoints) && this.modelPowerPoints.length > 0);
  }

  findPowerInPoints(points, duration, tolerance = 5) {
    if (!Array.isArray(points) || points.length === 0) {
      return null;
    }

    const exactMatch = points.find(point => point.duration === duration);
    if (exactMatch) {
      return exactMatch.power;
    }

    const nearMatch = points.find(point => Math.abs(point.duration - duration) <= tolerance);
    return nearMatch ? nearMatch.power : null;
  }

  getActualPower(duration) {
    const powerFromCurve = this.findPowerInPoints(this.powerCurvePoints, duration);
    if (powerFromCurve !== null && powerFromCurve !== undefined) {
      return powerFromCurve;
    }

    return this.findPowerInPoints(this.modelPowerPoints, duration, 120);
  }

  getModelPower(duration, criticalPower, wPrime, actualHint = null) {
    if (!Number.isFinite(duration) || duration <= 0) {
      return null;
    }

    const effectiveDuration = Math.max(1, duration);
    let predicted = criticalPower + (wPrime / effectiveDuration);

    if (!Number.isFinite(predicted)) {
      return null;
    }

    const nearbyActual = actualHint ??
      this.findPowerInPoints(this.powerCurvePoints, duration, 120) ??
      this.findPowerInPoints(this.modelPowerPoints, duration, 120);

    if (nearbyActual != null) {
      const upperBound = nearbyActual * 1.5;
      const lowerBound = Math.max(0, nearbyActual * 0.5);
      predicted = Math.min(Math.max(predicted, lowerBound), upperBound);
    }

    return Math.max(predicted, 0);
  }

  renderDataOverview() {
    if (!this.data) {
      return '';
    }

    const sampleDurations = [5, 60, 300, 1200];
    const rows = sampleDurations.map(duration => {
      const actual = this.getActualPower(duration);
      const model = this.getModelPower(duration, this.data?.critical_power || 0, this.data?.w_prime || 0, actual);
      const difference = actual != null && model != null ? actual - model : null;

      return `
        <tr>
          <td>${this.formatDuration(duration)}</td>
          <td>${actual != null ? `${Math.round(actual)} W` : '—'}</td>
          <td>${model != null ? `${Math.round(model)} W` : '—'}</td>
          <td>${difference != null ? `${difference > 0 ? '↑' : '↓'} ${Math.abs(Math.round(difference))} W` : '—'}</td>
        </tr>
      `;
    }).join('');

    const pointsCount = this.powerCurvePoints.length || this.modelPowerPoints.length || 0;
    const sourceLabel = this.powerCurvePoints.length > 0 ? 'Power Curve' : 'CP Model';

    return `
      <div class="cp-data-overview">
        <div class="cp-data-header">
          <h3>Data Overview</h3>
          <p>${pointsCount > 0
            ? `Showing ${pointsCount} data points (${sourceLabel})`
            : 'No actual power data available yet'}</p>
        </div>
        <div class="cp-data-grid">
          <div class="cp-data-card">
            <div class="cp-data-label">Critical Power</div>
            <div class="cp-data-value">${this.data?.critical_power ? `${Math.round(this.data.critical_power)} W` : '—'}</div>
          </div>
          <div class="cp-data-card">
            <div class="cp-data-label">W′ (Anaerobic)</div>
            <div class="cp-data-value">${this.data?.w_prime ? `${Math.round(this.data.w_prime)} J` : '—'}</div>
          </div>
          <div class="cp-data-card">
            <div class="cp-data-label">Data Source</div>
            <div class="cp-data-value">${pointsCount > 0 ? sourceLabel : 'None'}</div>
          </div>
        </div>
        <table class="cp-data-table">
          <thead>
            <tr>
              <th>Duration</th>
              <th>Actual</th>
              <th>Model</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  initChart() {
    const canvas = document.getElementById('cpComparisonChart');
    if (!canvas) {
      console.warn('[CP] Chart canvas not found');
      return;
    }

    const { critical_power, w_prime } = this.data;

    const DEFAULT_DURATIONS = [
      1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240,
      300, 420, 600, 900, 1200, 1500, 1800, 2400, 3000, 3600
    ];

    const durationSet = new Set(
      DEFAULT_DURATIONS
        .concat(this.powerCurvePoints.map(point => point.duration))
        .concat(this.modelPowerPoints.map(point => point.duration))
    );

    const earliestDuration = this.powerCurvePoints.length > 0
      ? this.powerCurvePoints[0].duration
      : (this.modelPowerPoints.length > 0 ? this.modelPowerPoints[0].duration : 1);

    const rawDurations = Array.from(durationSet)
      .filter(value => Number.isFinite(value) && value >= Math.max(1, earliestDuration))
      .sort((a, b) => a - b);

    const durations = [];
    rawDurations.forEach(duration => {
      if (durations.length === 0) {
        durations.push(duration);
        return;
      }
      const previous = durations[durations.length - 1];
      const ratio = duration / previous;
      if (ratio >= 1.08 || duration - previous >= 30) {
        durations.push(duration);
      }
    });

    if (durations.length === 0) {
      durations.push(1, 5, 60, 300, 1200);
    }

    const actualData = [];
    const modelData = [];
    const differenceData = [];

    let lastActual = null;
    let lastModel = null;

    durations.forEach(duration => {
      const actualRaw = this.getActualPower(duration);
      const model = this.getModelPower(duration, critical_power, w_prime, actualRaw) ?? lastModel;
      const actual = actualRaw ?? lastActual ?? model;

      if (actual != null) {
        lastActual = actual;
      }
      if (model != null) {
        lastModel = model;
      }

      actualData.push({
        x: duration,
        y: actual ?? null
      });

      modelData.push({
        x: duration,
        y: model ?? null
      });

      differenceData.push({
        x: duration,
        y: (actual != null && model != null) ? Math.max(Math.abs(actual - model), 0.5) : 0
      });
    });

    const minDuration = durations[0];
    const maxDuration = durations[durations.length - 1];

    const tickCandidates = [...DEFAULT_DURATIONS];
    while (tickCandidates[tickCandidates.length - 1] < maxDuration) {
      tickCandidates.push(tickCandidates[tickCandidates.length - 1] * 2);
    }

    const tickValues = Array.from(new Set(
      tickCandidates
        .filter(value => value >= minDuration && value <= maxDuration * 1.05)
        .concat([minDuration, maxDuration])
    )).sort((a, b) => a - b);

    const chartData = {
      datasets: [
        {
          label: 'Actual Best Powers',
          data: actualData,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHitRadius: 8,
          tension: 0.45,
          cubicInterpolationMode: 'monotone',
          fill: false,
          spanGaps: true,
          order: 1
        },
        {
          label: 'CP Model Prediction',
          data: modelData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          borderDash: [8, 4],
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHitRadius: 8,
          tension: 0.45,
          cubicInterpolationMode: 'monotone',
          borderCapStyle: 'round',
          fill: false,
          spanGaps: true,
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
          fill: 'origin',
          spanGaps: true,
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
              
              if (actual != null && model != null && model !== 0) {
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
            callback: (value) => this.formatDuration(value),
            color: '#6b7280',
            font: {
              size: 11
            },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: false
          },
          afterBuildTicks: (scale) => {
            scale.ticks = tickValues.map(value => ({ value }));
            return scale.ticks;
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: false
          },
          min: minDuration,
          max: maxDuration * 1.05
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
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '';
    }

    const wholeSeconds = Math.round(seconds);

    if (wholeSeconds < 60) {
      return `${wholeSeconds}s`;
    }

    if (wholeSeconds < 3600) {
      const minutes = Math.floor(wholeSeconds / 60);
      const remainingSeconds = wholeSeconds % 60;
      if (remainingSeconds === 0) return `${minutes}m`;
      if (minutes < 10) return `${minutes}m ${remainingSeconds}s`;
      return `${minutes}m`;
    }

    const hours = Math.floor(wholeSeconds / 3600);
    const remainingMinutes = Math.floor((wholeSeconds % 3600) / 60);
    const remainingSeconds = wholeSeconds % 60;

    if (remainingMinutes === 0 && remainingSeconds === 0) {
      return `${hours}h`;
    }

    let label = `${hours}h`;
    if (remainingMinutes > 0) label += ` ${remainingMinutes}m`;
    if (remainingSeconds > 0 && hours < 2) label += ` ${remainingSeconds}s`;
    return label;
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
