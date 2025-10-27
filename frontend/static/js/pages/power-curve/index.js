// ============================================
// FILE: pages/power-curve/index.js
// Power Curve Analysis Page - PREMIUM DESIGN
// ============================================

import Services from '../../services/index.js';
import { MetricCard, LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

class PowerCurvePage {
  constructor() {
    this.config = CONFIG;
    this.state = {
      range: '90',
      start: null,
      end: null,
      weighted: false,
      data: null,
      userWeight: null
    };
    this.chart = null;
    this.powerCurvePoints = [];
  }

  async load() {
    try {
      Services.analytics.trackPageView('power-curve');
      
      this.renderLayout();
      await this.hydrateWeight();
      this.applyDefaultRange();
      this.setupEventListeners();
      await this.loadData();
      
    } catch (error) {
      console.error('[PowerCurvePage] Load error:', error);
      Services.analytics.trackError('power_curve_load', error.message);
      this.renderError(error);
    }
  }

  renderLayout() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    // ✅ Using PREMIUM CSS classes from power-curve.css
    container.innerHTML = `
      <div class="pc-section">
        <!-- Header -->
        <div class="pc-header">
          <h1>Power Curve Analysis</h1>
          <p>Your best power outputs across all durations</p>
        </div>

        <!-- Toolbar (Filters) -->
        <div class="pc-toolbar">
          <!-- Quick Range Segmented Control -->
          <div class="pc-segmented" id="pc-quick-range">
            <button class="pc-seg-btn" data-range="30">30d</button>
            <button class="pc-seg-btn active" data-range="90">90d</button>
            <button class="pc-seg-btn" data-range="180">180d</button>
            <button class="pc-seg-btn" data-range="365">1 Year</button>
            <button class="pc-seg-btn" data-range="all">All</button>
          </div>

          <!-- Date Range -->
          <div class="pc-field">
            <label for="pc-start">From</label>
            <input type="date" id="pc-start" autocomplete="off" />
          </div>
          <div class="pc-field">
            <label for="pc-end">To</label>
            <input type="date" id="pc-end" autocomplete="off" />
          </div>

          <!-- W/kg Toggle -->
          <label class="pc-switch">
            <input type="checkbox" id="pc-weighted" />
            <span>Show W/kg</span>
          </label>

          <!-- Actions -->
          <div class="pc-toolbar-actions">
            <button id="pc-apply" class="pc-btn-primary">Apply</button>
            <button id="pc-clear" class="pc-btn-outline">Clear</button>
            <button id="pc-refresh" class="pc-btn-outline">Refresh</button>
          </div>
        </div>

        <!-- Metrics Grid (Key Powers) -->
        <div class="metrics-grid" id="pc-stats-cards" style="display:none;">
          ${this.renderStatsCards()}
        </div>

        <!-- Chart Card -->
        <div class="pc-chart-card">
          <div class="pc-chart-header">
            <div class="pc-chart-header-content">
              <div class="pc-chart-title-row">
                <div class="pc-chart-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                  </svg>
                </div>
                <div>
                  <div class="pc-chart-title">Power Duration Curve</div>
                  <div class="pc-chart-subtitle" id="pc-meta">Loading...</div>
                </div>
              </div>
            </div>
          </div>
          <div class="pc-chart-container" id="power-curve-chart">
            <div class="pc-loading">
              <div class="pc-spinner"></div>
              <p>Loading power curve...</p>
            </div>
          </div>
        </div>

        <!-- Info Cards -->
        <div class="pc-info-grid">
          ${this.renderInfoCards()}
        </div>
      </div>
    `;
    
    // Initialize Feather icons
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  renderStatsCards() {
    return `
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon primary">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="metric-label">Peak 5s</div>
        </div>
        <div class="metric-value" id="stat-5s">—</div>
        <div class="metric-subtitle">Sprint power</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon purple">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="metric-label">Peak 1m</div>
        </div>
        <div class="metric-value" id="stat-1m">—</div>
        <div class="metric-subtitle">Anaerobic capacity</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon green">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div class="metric-label">Peak 5m</div>
        </div>
        <div class="metric-value" id="stat-5m">—</div>
        <div class="metric-subtitle">VO2max power</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon amber">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div class="metric-label">Peak 20m</div>
        </div>
        <div class="metric-value" id="stat-20m">—</div>
        <div class="metric-subtitle">FTP estimate</div>
      </div>
    `;
  }

  renderInfoCards() {
    return `
      <div class="pc-info-card">
        <div class="pc-info-card-header">
          <div class="pc-info-card-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div class="pc-info-card-title">Understanding Power Curve</div>
        </div>
        <div class="pc-factor-list">
          <div class="pc-factor-item">
            <div class="pc-factor-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div class="pc-factor-content">
              <div class="pc-factor-title">Maximum Mean Power</div>
              <div class="pc-factor-text">Shows your best average power for any given duration from seconds to hours</div>
            </div>
          </div>
          <div class="pc-factor-item">
            <div class="pc-factor-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div class="pc-factor-content">
              <div class="pc-factor-title">Power Profile</div>
              <div class="pc-factor-text">Identifies your strengths - sprinter, time trialist, or all-rounder</div>
            </div>
          </div>
          <div class="pc-factor-item">
            <div class="pc-factor-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <div class="pc-factor-content">
              <div class="pc-factor-title">Track Progress</div>
              <div class="pc-factor-text">Monitor improvements across different energy systems over time</div>
            </div>
          </div>
        </div>
        
        <div class="pc-insight">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div class="pc-insight-content">
            <div class="pc-insight-title">Power Curve Analysis</div>
            <div class="pc-insight-text">
              Your power curve reveals physiological capabilities across all durations. Short efforts (5-30s) indicate neuromuscular power, mid-range (1-5m) shows VO2max capacity, and longer durations (20-60m) reflect threshold and endurance.
            </div>
          </div>
        </div>
      </div>

      <div class="pc-info-card">
        <div class="pc-info-card-header">
          <div class="pc-info-card-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          <div class="pc-info-card-title">Training Applications</div>
        </div>
        <div class="pc-factor-list">
          <div class="pc-factor-item">
            <div class="pc-factor-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div class="pc-factor-content">
              <div class="pc-factor-title">Identify Weaknesses</div>
              <div class="pc-factor-text">Dips in your curve reveal areas needing focused training attention</div>
            </div>
          </div>
          <div class="pc-factor-item">
            <div class="pc-factor-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div class="pc-factor-content">
              <div class="pc-factor-title">Set Training Zones</div>
              <div class="pc-factor-text">Use curve data to establish accurate power zones for structured workouts</div>
            </div>
          </div>
          <div class="pc-factor-item">
            <div class="pc-factor-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div class="pc-factor-content">
              <div class="pc-factor-title">Race Pacing</div>
              <div class="pc-factor-text">Inform pacing strategies based on sustainable power for event durations</div>
            </div>
          </div>
          <div class="pc-factor-item">
            <div class="pc-factor-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <div class="pc-factor-content">
              <div class="pc-factor-title">Monitor Fitness</div>
              <div class="pc-factor-text">Track how your curve shifts upward as fitness improves over training blocks</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ========== EVENT LISTENERS ==========

  setupEventListeners() {
    // Quick range buttons
    const rangeRoot = document.getElementById('pc-quick-range');
    rangeRoot?.querySelectorAll('button[data-range]').forEach(btn => {
      btn.addEventListener('click', async () => {
        rangeRoot.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.range = btn.dataset.range || '90';
        this.applyRangeFromState();
        await this.loadData();
      });
    });

    // Apply button
    document.getElementById('pc-apply')?.addEventListener('click', async () => {
      this.state.range = 'custom';
      this.readDatesFromInputs();
      await this.loadData();
    });

    // Clear button
    document.getElementById('pc-clear')?.addEventListener('click', async () => {
      this.applyDefaultRange(true);
      await this.loadData();
    });

    // Refresh button
    document.getElementById('pc-refresh')?.addEventListener('click', () => this.loadData());

    // Weighted toggle
    document.getElementById('pc-weighted')?.addEventListener('change', async (e) => {
      this.state.weighted = !!e.target.checked;
      Services.analytics.trackEvent('power_curve_toggle', { weighted: this.state.weighted });
      await this.loadData();
    });

    // Date validation
    document.getElementById('pc-start')?.addEventListener('change', () => {
      const s = this.el('pc-start').value;
      const e = this.el('pc-end').value;
      if (e && s && e < s) this.el('pc-end').value = s;
    });
    
    document.getElementById('pc-end')?.addEventListener('change', () => {
      const s = this.el('pc-start').value;
      const e = this.el('pc-end').value;
      if (e && s && e < s) this.el('pc-start').value = e;
    });
  }

  // ========== DATA LOADING ==========

  async hydrateWeight() {
    try {
      const settings = await Services.data.getSettings().catch(() => ({}));
      if (settings && settings.weight) {
        this.state.userWeight = Number(settings.weight);
      }
    } catch (error) {
      console.error('[PowerCurvePage] Error loading weight:', error);
    }
  }

  async loadData() {
    const container = document.getElementById('power-curve-chart');
    if (!container) return;
    
    container.innerHTML = '<div class="pc-loading"><div class="pc-spinner"></div><p>Loading power curve...</p></div>';

    try {
      const params = { weighted: this.state.weighted };
      
      if (this.state.range !== 'all' && this.state.start && this.state.end) {
        params.start = this.state.start.toISOString().slice(0, 10);
        params.end = this.state.end.toISOString().slice(0, 10);
      }

      const rawData = await Services.data.getPowerCurve({ ...params, forceRefresh: true });
      this.powerCurvePoints = this.preparePowerCurvePoints(rawData);

      if (!this.powerCurvePoints || this.powerCurvePoints.length === 0) {
        this.showEmptyState(container);
        return;
      }

      const normalizedData = this.buildDatasetFromPoints(this.powerCurvePoints, rawData?.weighted ?? this.state.weighted);

      this.state.data = normalizedData;
      this.data = normalizedData; // Keep for compatibility

      console.log('[PowerCurvePage] Loaded power curve points:', this.powerCurvePoints.length);
      if (typeof console.table === 'function') {
        console.table(this.powerCurvePoints.slice(0, 15), ['duration', 'power']);
      } else {
        console.log('[PowerCurvePage] Sample points:', this.powerCurvePoints.slice(0, 5));
      }

      container.innerHTML = '<canvas id="powerCurveChart" aria-label="Power curve chart" role="img"></canvas>';
      
      // Use Chart.js if available, otherwise Plotly
      if (typeof Chart !== 'undefined') {
        this.initChart();
      } else if (window.Plotly?.newPlot) {
        this.drawPlotlyChart(normalizedData);
      } else {
        container.innerHTML = '<div class="pc-empty-state"><h3>Chart library not loaded</h3></div>';
      }
      
      this.updateMeta(normalizedData);
      this.updateStats(normalizedData);

    } catch (err) {
      console.error('[PowerCurvePage] loadData failed:', err);
      Services.analytics.trackError('power_curve_load_data', err.message);
      container.innerHTML = `
        <div class="pc-empty-state">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3>Error Loading Data</h3>
          <p>${this.escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  showEmptyState(container) {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.powerCurvePoints = [];
    this.state.data = null;
    
    container.innerHTML = `
      <div class="pc-empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
        <h3>No Power Data Available</h3>
        <p>Upload some FIT files with power data to see your power duration curve.</p>
      </div>
    `;
    
    const meta = document.getElementById('pc-meta');
    if (meta) meta.textContent = 'No data';
    
    const statsCards = document.getElementById('pc-stats-cards');
    if (statsCards) statsCards.style.display = 'none';
  }

  // ========== CHART.JS IMPLEMENTATION ==========

  initChart() {
    const canvas = document.getElementById('powerCurveChart');
    if (!canvas) return;
    
    if (this.chart) {
      this.chart.destroy();
    }
    
    const chartPacket = Services.chart.preparePowerCurveChart(this.data);
    const chartOptions = { ...Services.chart.getPowerCurveChartOptions(this.state.weighted) };
    const chartData = { datasets: chartPacket.datasets };

    chartOptions.onClick = () => {
      Services.analytics.trackChartInteraction('power-curve', 'click');
    };
    
    this.chart = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
  }

  updateChart() {
    if (!this.chart) return;
    const chartPacket = Services.chart.preparePowerCurveChart(this.data);
    this.chart.data.datasets = chartPacket.datasets;
    this.chart.update();
  }

  preparePowerCurvePoints(data) {
    if (!data || !Array.isArray(data.durations) || !Array.isArray(data.powers)) {
      return [];
    }

    const maxLength = Math.min(data.durations.length, data.powers.length);
    const dedup = new Map();

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
      const existing = dedup.get(durationValue);

      if (existing === undefined || powerNumber > existing) {
        dedup.set(durationValue, powerNumber);
      }
    }

    const sortedDurations = Array.from(dedup.keys()).sort((a, b) => a - b);
    return sortedDurations.map(duration => ({
      duration,
      power: dedup.get(duration)
    }));
  }

  buildDatasetFromPoints(points, weightedFlag = false) {
    if (!Array.isArray(points) || points.length === 0) {
      return { durations: [], powers: [], weighted: Boolean(weightedFlag) };
    }

    return {
      durations: points.map(point => point.duration),
      powers: points.map(point => point.power),
      weighted: Boolean(weightedFlag)
    };
  }

  // ========== PLOTLY IMPLEMENTATION (FALLBACK) ==========

  drawPlotlyChart(data) {
    const container = document.getElementById('power-curve-chart');
    if (!container) return;

    container.innerHTML = '';
    
    const x = data.durations;
    const y = data.powers;

    // Helper to find power at specific duration (interpolation)
    const findPowerAt = (targetDuration) => {
      const idx = data.durations.findIndex(d => d >= targetDuration);
      if (idx === -1) return null;
      if (idx === 0) return data.powers[0];
      
      const x0 = data.durations[idx - 1];
      const x1 = data.durations[idx];
      const y0 = data.powers[idx - 1];
      const y1 = data.powers[idx];
      const t = (targetDuration - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    };

    // Main power curve trace
    const trace = {
      x, y,
      type: 'scatter',
      mode: 'lines',
      line: { 
        shape: 'spline', 
        smoothing: 0.6,
        color: '#3b82f6',
        width: 4
      },
      fill: 'tozeroy',
      fillcolor: 'rgba(59,130,246,0.15)',
      hovertemplate: '<b>Duration: %{x:.0f}s</b><br>Power: <b>%{y:.1f} ' + 
                     (this.state.weighted ? 'W/kg' : 'W') + '</b><extra></extra>',
      name: 'Power Curve',
      hoverlabel: {
        bgcolor: '#1e293b',
        bordercolor: '#3b82f6',
        font: { size: 13, color: '#fff', family: 'Inter' }
      }
    };

    const traces = [trace];
    
    // Add key duration markers
    const keyDurations = [
      { duration: 5, label: '5s', color: '#3b82f6' },
      { duration: 60, label: '1m', color: '#8b5cf6' },
      { duration: 300, label: '5m', color: '#10b981' },
      { duration: 1200, label: '20m', color: '#f59e0b' }
    ];

    const annotations = [];
    keyDurations.forEach(kd => {
      const power = findPowerAt(kd.duration);
      if (power) {
        // Marker
        traces.push({
          x: [kd.duration],
          y: [power],
          type: 'scatter',
          mode: 'markers',
          marker: {
            size: 12,
            color: kd.color,
            line: { color: '#fff', width: 3 },
            symbol: 'circle'
          },
          showlegend: false,
          hovertemplate: `<b>${kd.label}</b><br>${Math.round(power)} ${this.state.weighted ? 'W/kg' : 'W'}<extra></extra>`,
          hoverlabel: {
            bgcolor: '#1e293b',
            bordercolor: kd.color,
            font: { size: 13, color: '#fff', family: 'Inter' }
          }
        });

        // Annotation
        annotations.push({
          x: Math.log10(kd.duration),
          y: power,
          xref: 'x',
          yref: 'y',
          text: `<b>${kd.label}</b><br>${Math.round(power)}${this.state.weighted ? ' W/kg' : 'W'}`,
          showarrow: true,
          arrowhead: 2,
          arrowsize: 1,
          arrowwidth: 2,
          arrowcolor: kd.color,
          ax: 0,
          ay: -40,
          bgcolor: 'rgba(255,255,255,0.95)',
          bordercolor: kd.color,
          borderwidth: 2,
          borderpad: 6,
          font: { size: 11, color: '#1e293b', family: 'Inter' }
        });
      }
    });
    
    const unitLabel = this.state.weighted ? 'Power (W/kg)' : 'Power (W)';
    const layout = {
      margin: { l: 70, r: 30, t: 30, b: 60 },
      xaxis: {
        title: { 
          text: 'Duration', 
          font: { size: 14, color: '#475569', family: 'Inter', weight: 600 },
          standoff: 15
        },
        type: 'log',
        tickvals: [1, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600],
        ticktext: ['1s','5s','10s','20s','30s','1m','2m','5m','10m','20m','30m','1h'],
        tickfont: { size: 12, color: '#64748b', family: 'Inter' },
        gridcolor: 'rgba(148,163,184,0.15)',
        gridwidth: 1,
        showline: true,
        linecolor: '#cbd5e1',
        linewidth: 2,
        zeroline: false
      },
      yaxis: {
        title: { 
          text: unitLabel, 
          font: { size: 14, color: '#475569', family: 'Inter', weight: 600 },
          standoff: 15
        },
        rangemode: 'tozero',
        tickfont: { size: 12, color: '#64748b', family: 'Inter' },
        gridcolor: 'rgba(148,163,184,0.15)',
        gridwidth: 1,
        showline: true,
        linecolor: '#cbd5e1',
        linewidth: 2,
        zeroline: true,
        zerolinecolor: '#cbd5e1',
        zerolinewidth: 2
      },
      hovermode: 'closest',
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'rgba(248,250,252,0.5)',
      font: { family: 'Inter, sans-serif', size: 12, color: '#64748b' },
      annotations: annotations,
      showlegend: false
    };

    const config = { 
      displayModeBar: false, 
      responsive: true,
      doubleClick: false
    };
    
    window.Plotly.newPlot(container, traces, layout, config);
  }

  // ========== UPDATE FUNCTIONS ==========

  updateMeta(data) {
    const meta = document.getElementById('pc-meta');
    if (!meta) return;
    
    const rangeLabel = this.state.range === 'custom'
      ? `${this.el('pc-start').value || '…'} → ${this.el('pc-end').value || '…'}`
      : ({'30':'Last 30 days','90':'Last 90 days','180':'Last 180 days','365':'Year to date','all':'All time'}[this.state.range] || 'Range');

    const unit = this.state.weighted ? 'W/kg' : 'W';
    meta.textContent = `${rangeLabel} • ${data?.durations?.length || 0} data points • ${unit}`;
  }

  updateStats(data) {
    const statsCards = document.getElementById('pc-stats-cards');
    if (!statsCards) return;

    const findPowerAt = (targetDuration) => {
      const idx = data.durations.findIndex(d => d >= targetDuration);
      if (idx === -1) return null;
      if (idx === 0) return data.powers[0];
      
      const x0 = data.durations[idx - 1];
      const x1 = data.durations[idx];
      const y0 = data.powers[idx - 1];
      const y1 = data.powers[idx];
      const t = (targetDuration - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    };

    const power5s = findPowerAt(5);
    const power1m = findPowerAt(60);
    const power5m = findPowerAt(300);
    const power20m = findPowerAt(1200);

    const unit = this.state.weighted ? ' W/kg' : ' W';
    
    this.el('stat-5s').textContent = power5s ? Math.round(power5s) + unit : '—';
    this.el('stat-1m').textContent = power1m ? Math.round(power1m) + unit : '—';
    this.el('stat-5m').textContent = power5m ? Math.round(power5m) + unit : '—';
    this.el('stat-20m').textContent = power20m ? Math.round(power20m) + unit : '—';

    statsCards.style.display = 'grid';
  }

  // ========== RANGE HELPERS ==========

  applyDefaultRange(resetToggle = false) {
    if (resetToggle) this.state.range = '90';
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 89);

    this.state.start = start;
    this.state.end = end;

    this.syncInputsFromState();
    const root = document.getElementById('pc-quick-range');
    root?.querySelectorAll('button').forEach(b => 
      b.classList.toggle('active', b.dataset.range === this.state.range)
    );
  }

  applyRangeFromState() {
    const end = new Date();
    let start = null;

    switch (this.state.range) {
      case '30':  start = new Date(end); start.setDate(end.getDate() - 29); break;
      case '90':  start = new Date(end); start.setDate(end.getDate() - 89); break;
      case '180': start = new Date(end); start.setDate(end.getDate() - 179); break;
      case '365': start = new Date(end.getFullYear(), 0, 1); break;
      case 'all': start = null; break;
      default:    return;
    }
    this.state.start = start;
    this.state.end = end;
    this.syncInputsFromState();
  }

  syncInputsFromState() {
    const toISO = d => d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '';
    this.el('pc-start').value = toISO(this.state.start);
    this.el('pc-end').value = toISO(this.state.end);
  }

  readDatesFromInputs() {
    const s = this.el('pc-start').value ? new Date(this.el('pc-start').value) : null;
    const e = this.el('pc-end').value ? new Date(this.el('pc-end').value) : null;
    this.state.start = s;
    this.state.end = e;
  }

  // ========== HELPERS ==========

  el(id) { 
    return document.getElementById(id); 
  }

  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
    return `${Math.round(seconds / 3600)}h`;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderLoading() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="pc-section">
        <div class="metrics-grid">
          ${LoadingSkeleton({ type: 'metric', count: 4 })}
        </div>
        ${LoadingSkeleton({ type: 'chart', count: 1 })}
      </div>
    `;
  }

  renderError(error) {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="no-data">
        <svg style="width: 64px; height: 64px; margin-bottom: 16px; color: var(--text-tertiary); opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">Failed to Load Power Curve</h3>
        <p style="margin-bottom: 16px;">${this.escapeHtml(error.message)}</p>
        <button class="btn btn--primary" onclick="window.router.refresh()">
          Try Again
        </button>
      </div>
    `;
  }

  // ========== LIFECYCLE ==========

  onShow() {
    console.log('[PowerCurvePage] Page shown');
  }

  onHide() {
    console.log('[PowerCurvePage] Page hidden');
  }

  onUnload() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    console.log('[PowerCurvePage] Page unloaded');
  }
}

// Create singleton instance
const powerCurvePage = new PowerCurvePage();

// Export for router
export default powerCurvePage;
export { powerCurvePage };
