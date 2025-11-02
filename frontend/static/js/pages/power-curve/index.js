// ============================================
// FILE: pages/power-curve/index.js
// Power Curve Analysis Page - ENHANCED INTERACTIVE DESIGN
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
      userWeight: null,
      comparisonRange: null // For comparing multiple time periods
    };
    this.chart = null;
    this.powerCurvePoints = [];
    this.bestEfforts = [];
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

    container.innerHTML = `
      <div class="pc-section">
        <!-- Header -->
        <div class="pc-header">
          <h1>Power Curve</h1>
          <p>Analyze your best power outputs across all durations</p>
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

          <!-- W/kg Toggle -->
          <label class="pc-switch">
            <input type="checkbox" id="pc-weighted" />
            <span>Show W/kg</span>
          </label>

          <!-- Actions -->
          <div class="pc-toolbar-actions">
            <button id="pc-refresh" class="pc-btn-outline">Refresh</button>
          </div>
        </div>

        <!-- Metrics Grid (Key Powers) -->
        <div class="metrics-grid" id="pc-stats-cards" style="display:none;">
          ${this.renderStatsCards()}
        </div>

        <!-- Main Content - Similar to Overview Page -->
        <div class="pc-main-content">
          <!-- Chart Card with Energy Systems Legend -->
          <div class="pc-chart-card">
            <div class="pc-chart-header">
              <div class="pc-chart-header-content">
                <div>
                  <h3 class="pc-chart-title">Power Duration Curve</h3>
                  <p class="pc-chart-subtitle" id="pc-meta">Loading...</p>
                </div>
              </div>
            </div>
            <div class="pc-chart-with-legend">
              <div class="pc-chart-container" id="power-curve-chart">
                <div class="pc-loading">
                  <div class="pc-spinner"></div>
                  <p>Loading power curve...</p>
                </div>
              </div>
              <div class="pc-energy-legend">
                <div class="pc-legend-title">Energy Systems</div>
                <div class="pc-legend-items">
                  <div class="pc-legend-item">
                    <div class="pc-legend-marker" style="background: #3b82f6;"></div>
                    <div class="pc-legend-content">
                      <div class="pc-legend-label">Neuromuscular</div>
                      <div class="pc-legend-range">1-10 seconds</div>
                      <div class="pc-legend-desc">Maximum sprint power</div>
                    </div>
                  </div>
                  <div class="pc-legend-item">
                    <div class="pc-legend-marker" style="background: #8b5cf6;"></div>
                    <div class="pc-legend-content">
                      <div class="pc-legend-label">Anaerobic</div>
                      <div class="pc-legend-range">10-60 seconds</div>
                      <div class="pc-legend-desc">Short max efforts</div>
                    </div>
                  </div>
                  <div class="pc-legend-item">
                    <div class="pc-legend-marker" style="background: #10b981;"></div>
                    <div class="pc-legend-content">
                      <div class="pc-legend-label">VO2max</div>
                      <div class="pc-legend-range">1-6 minutes</div>
                      <div class="pc-legend-desc">Aerobic capacity</div>
                    </div>
                  </div>
                  <div class="pc-legend-item">
                    <div class="pc-legend-marker" style="background: #f59e0b;"></div>
                    <div class="pc-legend-content">
                      <div class="pc-legend-label">Threshold</div>
                      <div class="pc-legend-range">6-30 minutes</div>
                      <div class="pc-legend-desc">Sustainable power</div>
                    </div>
                  </div>
                  <div class="pc-legend-item">
                    <div class="pc-legend-marker" style="background: #6366f1;"></div>
                    <div class="pc-legend-content">
                      <div class="pc-legend-label">Endurance</div>
                      <div class="pc-legend-range">30+ minutes</div>
                      <div class="pc-legend-desc">Long duration efforts</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Power Profile Section -->
        <div class="pc-profile-section" id="pc-profile-section" style="display:none;">
          <h3 class="pc-section-title">Power Profile</h3>
          <div class="pc-profile-grid" id="pc-profile-grid">
            <!-- Filled dynamically -->
          </div>
        </div>

        <!-- Best Efforts Section -->
        <div class="pc-efforts-section" id="pc-efforts-section" style="display:none;">
          <h3 class="pc-section-title">Best Efforts</h3>
          <div class="pc-efforts-grid" id="pc-efforts-tbody">
            <!-- Filled dynamically -->
          </div>
        </div>

        <!-- AI Insights -->
        <div class="pc-ai-insights" id="pc-ai-insights" style="display:none;">
          <h3 class="pc-section-title">Insights</h3>
          <div class="pc-ai-insights-grid" id="pc-ai-insights-grid">
            <!-- Filled dynamically -->
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

      container.innerHTML = '<canvas id="powerCurveChart" aria-label="Power curve chart" role="img"></canvas>';

      this.initChart();
      this.updateMeta(normalizedData);
      this.updateStats(normalizedData);
      this.renderPowerProfile(normalizedData);
      this.renderBestEfforts(normalizedData);
      this.renderAIInsights(normalizedData);

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

    const profileSection = document.getElementById('pc-profile-section');
    if (profileSection) profileSection.style.display = 'none';

    const effortsSection = document.getElementById('pc-efforts-section');
    if (effortsSection) effortsSection.style.display = 'none';

    const aiInsights = document.getElementById('pc-ai-insights');
    if (aiInsights) aiInsights.style.display = 'none';
  }

  // ========== CHART.JS IMPLEMENTATION ==========

  initChart() {
    const canvas = document.getElementById('powerCurveChart');
    if (!canvas) return;

    if (this.chart) {
      this.chart.destroy();
    }

    const chartData = this.prepareEnhancedChartData(this.data);
    const chartOptions = this.getEnhancedChartOptions();

    this.chart = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
  }

  prepareEnhancedChartData(data) {
    // Simply use the raw durations as x-axis values for logarithmic scale
    const xValues = data.durations;
    const yValues = data.powers;

    console.log('[PowerCurvePage] Chart data prepared:', {
      dataPoints: xValues.length,
      firstDuration: xValues[0],
      lastDuration: xValues[xValues.length - 1],
      firstPower: yValues[0],
      lastPower: yValues[yValues.length - 1]
    });

    // Find key duration points for markers
    const keyDurations = [5, 60, 300, 1200];
    const keyPoints = keyDurations.map(duration => {
      const idx = xValues.findIndex(d => d >= duration);
      if (idx === -1) return null;
      if (idx === 0) return { x: duration, y: yValues[0] };

      const x0 = xValues[idx - 1];
      const x1 = xValues[idx];
      const y0 = yValues[idx - 1];
      const y1 = yValues[idx];
      const t = (duration - x0) / (x1 - x0);
      const interpolatedY = y0 + t * (y1 - y0);

      return { x: duration, y: interpolatedY };
    }).filter(p => p !== null);

    return {
      datasets: [
        // Main power curve
        {
          label: 'Power Curve',
          data: xValues.map((x, i) => ({ x, y: yValues[i] })),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 8,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverBackgroundColor: '#3b82f6',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3,
          order: 2
        },
        // Key duration markers
        {
          label: 'Key Durations',
          data: keyPoints,
          borderColor: 'transparent',
          backgroundColor: [
            '#3b82f6', // 5s - Blue
            '#8b5cf6', // 1m - Purple
            '#10b981', // 5m - Green
            '#f59e0b'  // 20m - Amber
          ],
          pointRadius: 8,
          pointHoverRadius: 12,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 3,
          pointStyle: 'circle',
          showLine: false,
          order: 1
        }
      ]
    };
  }

  getEnhancedChartOptions() {
    const self = this;
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12, weight: '600', family: 'Inter' },
            color: '#475569',
            generateLabels: (chart) => {
              return [
                {
                  text: '5s Sprint',
                  fillStyle: '#3b82f6',
                  strokeStyle: '#ffffff',
                  lineWidth: 2,
                  pointStyle: 'circle'
                },
                {
                  text: '1m Anaerobic',
                  fillStyle: '#8b5cf6',
                  strokeStyle: '#ffffff',
                  lineWidth: 2,
                  pointStyle: 'circle'
                },
                {
                  text: '5m VO2max',
                  fillStyle: '#10b981',
                  strokeStyle: '#ffffff',
                  lineWidth: 2,
                  pointStyle: 'circle'
                },
                {
                  text: '20m Threshold',
                  fillStyle: '#f59e0b',
                  strokeStyle: '#ffffff',
                  lineWidth: 2,
                  pointStyle: 'circle'
                }
              ];
            }
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          borderColor: '#3b82f6',
          borderWidth: 2,
          padding: 16,
          displayColors: true,
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          callbacks: {
            title: (context) => {
              const duration = context[0].parsed.x;
              const formatted = self.formatDurationDetailed(duration);

              // Determine energy system
              let system = '';
              if (duration <= 10) system = '⚡ Neuromuscular';
              else if (duration <= 60) system = '🔥 Anaerobic';
              else if (duration <= 360) system = '💨 VO2max';
              else if (duration <= 1800) system = '🎯 Threshold';
              else system = '🚴 Endurance';

              return [formatted, system];
            },
            label: (context) => {
              const power = context.parsed.y;
              const unit = self.state.weighted ? 'W/kg' : 'W';
              const rounded = Math.round(power);

              if (context.datasetIndex === 1) {
                // Key duration marker
                const labels = ['Peak 5s', 'Peak 1m', 'Peak 5m', 'Peak 20m'];
                return `${labels[context.dataIndex]}: ${rounded} ${unit}`;
              }

              return `Power: ${rounded} ${unit}`;
            },
            afterLabel: (context) => {
              if (context.datasetIndex === 0) {
                const power = context.parsed.y;
                const duration = context.parsed.x;

                // Calculate approximate work/energy
                const work = Math.round(power * duration / 1000);
                return `Energy: ~${work} kJ`;
              }
              return '';
            }
          },
          titleFont: { size: 14, weight: 'bold', family: 'Inter' },
          bodyFont: { size: 13, family: 'Inter' },
          titleSpacing: 8,
          bodySpacing: 6
        }
      },
      scales: {
        x: {
          type: 'logarithmic',
          position: 'bottom',
          title: {
            display: true,
            text: 'Duration (Energy Systems →)',
            font: { size: 13, weight: '700', family: 'Inter' },
            color: '#1e293b',
            padding: { top: 10 }
          },
          ticks: {
            callback: (value) => {
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
              return '';
            },
            font: { size: 11, weight: '600', family: 'Inter' },
            color: '#475569',
            padding: 8
          },
          grid: {
            color: (context) => {
              const value = context.tick.value;
              // Highlight key duration lines
              if ([5, 60, 300, 1200].includes(value)) {
                return 'rgba(59, 130, 246, 0.25)';
              }
              return 'rgba(148, 163, 184, 0.1)';
            },
            lineWidth: (context) => {
              const value = context.tick.value;
              return [5, 60, 300, 1200].includes(value) ? 2 : 1;
            },
            drawBorder: false
          }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: `Power Output (${this.state.weighted ? 'W/kg' : 'Watts'})`,
            font: { size: 13, weight: '700', family: 'Inter' },
            color: '#1e293b',
            padding: { bottom: 10 }
          },
          beginAtZero: false,
          ticks: {
            font: { size: 11, weight: '600', family: 'Inter' },
            color: '#475569',
            padding: 8,
            callback: (value) => {
              return Math.round(value);
            }
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.15)',
            lineWidth: 1,
            drawBorder: false
          }
        }
      },
      onClick: () => {
        Services.analytics.trackChartInteraction('power-curve', 'click');
      }
    };
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

  // ========== POWER PROFILE ANALYSIS ==========

  renderPowerProfile(data) {
    const profileSection = document.getElementById('pc-profile-section');
    const profileGrid = document.getElementById('pc-profile-grid');
    if (!profileSection || !profileGrid) return;

    const profile = this.analyzePowerProfile(data);
    if (!profile) {
      profileSection.style.display = 'none';
      return;
    }

    profileGrid.innerHTML = `
      <div class="pc-profile-card" data-type="sprinter">
        <div class="pc-profile-card-label">Sprinter</div>
        <div class="pc-profile-card-value">${profile.sprinterScore}</div>
        <div class="pc-profile-card-desc">5-30 second power</div>
      </div>
      <div class="pc-profile-card" data-type="pursuit">
        <div class="pc-profile-card-label">Pursuit</div>
        <div class="pc-profile-card-value">${profile.pursuitScore}</div>
        <div class="pc-profile-card-desc">1-5 minute power</div>
      </div>
      <div class="pc-profile-card" data-type="endurance">
        <div class="pc-profile-card-label">Endurance</div>
        <div class="pc-profile-card-value">${profile.enduranceScore}</div>
        <div class="pc-profile-card-desc">20+ minute power</div>
      </div>
    `;

    profileSection.style.display = 'block';
  }

  analyzePowerProfile(data) {
    if (!data || !data.durations || !data.powers) return null;

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
    const power15s = findPowerAt(15);
    const power1m = findPowerAt(60);
    const power5m = findPowerAt(300);
    const power20m = findPowerAt(1200);

    if (!power5s || !power1m || !power20m) return null;

    // Simple scoring based on relative strengths
    const sprinterScore = Math.round((power5s / power20m) * 10) / 10;
    const pursuitScore = Math.round((power1m / power20m) * 10) / 10;
    const enduranceScore = 10.0;  // Baseline

    return {
      sprinterScore: sprinterScore.toFixed(1),
      pursuitScore: pursuitScore.toFixed(1),
      enduranceScore: enduranceScore.toFixed(1),
      profileType: sprinterScore > 3.5 ? 'Sprinter' : pursuitScore > 2.0 ? 'Pursuit' : 'Time Trialist'
    };
  }

  // ========== BEST EFFORTS ==========

  renderBestEfforts(data) {
    const effortsSection = document.getElementById('pc-efforts-section');
    const effortsTbody = document.getElementById('pc-efforts-tbody');
    if (!effortsSection || !effortsTbody) return;

    const efforts = this.extractBestEfforts(data);
    if (!efforts || efforts.length === 0) {
      effortsSection.style.display = 'none';
      return;
    }

    effortsTbody.innerHTML = efforts.map(effort => `
      <div class="pc-effort-card">
        <div class="pc-effort-duration">${effort.durationLabel}</div>
        <div class="pc-effort-power">${effort.powerLabel}</div>
        <div class="pc-effort-badge-container">${effort.badge}</div>
      </div>
    `).join('');

    effortsSection.style.display = 'block';
  }

  extractBestEfforts(data) {
    const keyDurations = [5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600];
    const unit = this.state.weighted ? ' W/kg' : ' W';

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

    return keyDurations.map(duration => {
      const power = findPowerAt(duration);
      if (!power) return null;

      return {
        duration,
        power,
        durationLabel: this.formatDurationDetailed(duration),
        powerLabel: Math.round(power) + unit,
        dateLabel: 'Within selected range',
        badge: '<span class="pc-effort-badge recent">Best</span>'
      };
    }).filter(e => e !== null);
  }

  // ========== AI INSIGHTS ==========

  renderAIInsights(data) {
    const aiInsights = document.getElementById('pc-ai-insights');
    const aiInsightsGrid = document.getElementById('pc-ai-insights-grid');
    if (!aiInsights || !aiInsightsGrid) return;

    const insights = this.generateAIInsights(data);
    if (!insights || insights.length === 0) {
      aiInsights.style.display = 'none';
      return;
    }

    aiInsightsGrid.innerHTML = insights.map(insight => `
      <div class="pc-ai-insight-item">
        <div class="pc-ai-insight-header">
          <div class="pc-ai-insight-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="${insight.icon}"/>
            </svg>
          </div>
          <div>
            <h4 class="pc-ai-insight-title">${insight.title}</h4>
          </div>
        </div>
        <p class="pc-ai-insight-text">${insight.text}</p>
      </div>
    `).join('');

    aiInsights.style.display = 'block';
  }

  generateAIInsights(data) {
    if (!data || !data.durations || !data.powers) return [];

    const insights = [];

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

    // Sprint Power Insight
    if (power5s) {
      const unit = this.state.weighted ? 'W/kg' : 'W';
      insights.push({
        title: 'Sprint Power',
        text: `Your peak 5-second power of ${Math.round(power5s)} ${unit} indicates ${power5s > (this.state.weighted ? 12 : 800) ? 'excellent' : power5s > (this.state.weighted ? 8 : 600) ? 'good' : 'developing'} neuromuscular capacity. This is crucial for sprints and explosive efforts.`,
        icon: 'M13 10V3L4 14h7v7l9-11h-7z'
      });
    }

    // VO2max Insight
    if (power5m && power20m) {
      const ratio = power5m / power20m;
      insights.push({
        title: 'VO2max Capacity',
        text: `Your 5-minute to 20-minute power ratio is ${ratio.toFixed(2)}. ${ratio > 1.15 ? 'Strong aerobic capacity with good VO2max development.' : 'Consider adding more high-intensity intervals to boost VO2max power.'}`,
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
      });
    }

    // Threshold Power Insight
    if (power20m) {
      const unit = this.state.weighted ? 'W/kg' : 'W';
      const ftpEstimate = Math.round(power20m * 0.95);
      insights.push({
        title: 'Threshold Power',
        text: `Based on your 20-minute power of ${Math.round(power20m)} ${unit}, your estimated FTP is approximately ${ftpEstimate} ${unit}. This is your sustainable power for ~1 hour efforts.`,
        icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
      });
    }

    // Power Profile Insight
    if (power5s && power1m && power20m) {
      const sprintRatio = power5s / power20m;
      const anaerobicRatio = power1m / power20m;

      let profileText = '';
      if (sprintRatio > 3.5) {
        profileText = 'Your power profile shows strong sprint capabilities. Focus on maintaining this strength while building endurance.';
      } else if (anaerobicRatio > 2.0) {
        profileText = 'You have a pursuit-oriented power profile with strong 1-5 minute efforts. Excellent for criteriums and short climbs.';
      } else {
        profileText = 'Your power profile leans toward time trial/endurance strengths. Your sustained power is your greatest asset.';
      }

      insights.push({
        title: 'Power Profile Analysis',
        text: profileText,
        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
      });
    }

    return insights;
  }

  // ========== UPDATE FUNCTIONS ==========

  updateMeta(data) {
    const meta = document.getElementById('pc-meta');
    if (!meta) return;

    const rangeLabel = this.state.range === 'custom'
      ? `${this.el('pc-start')?.value || '…'} → ${this.el('pc-end')?.value || '…'}`
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
    const startEl = this.el('pc-start');
    const endEl = this.el('pc-end');
    if (startEl) startEl.value = toISO(this.state.start);
    if (endEl) endEl.value = toISO(this.state.end);
  }

  readDatesFromInputs() {
    const startEl = this.el('pc-start');
    const endEl = this.el('pc-end');
    const s = startEl?.value ? new Date(startEl.value) : null;
    const e = endEl?.value ? new Date(endEl.value) : null;
    this.state.start = s;
    this.state.end = e;
  }

  // ========== HELPERS ==========

  el(id) {
    return document.getElementById(id);
  }

  formatDurationForAxis(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  formatDurationDetailed(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}m ${secs}s` : `${mins} minutes`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
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
