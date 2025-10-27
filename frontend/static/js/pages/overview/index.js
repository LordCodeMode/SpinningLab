// ============================================
// FILE: pages/overview/index.js
// Dashboard Overview Page - UPDATED (Uses external CSS)
// ============================================

import Services from '../../services/index.js';
import { InsightCard, LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

class OverviewPage {
  constructor() {
    this.config = CONFIG;
    this.charts = {};
    this.data = {};
    this.availableRanges = (this.config?.charts?.trainingLoad?.availableRanges || [30, 90, 180, 360]).sort((a, b) => a - b);
    const defaultTrainingRange = Number.parseInt(this.config?.charts?.trainingLoad?.defaultRange ?? CONFIG?.DEFAULT_DAYS?.trainingLoad, 10);
    const fallbackRange = this.availableRanges.includes(defaultTrainingRange) ? defaultTrainingRange : this.availableRanges[1] || this.availableRanges[0] || 90;
    this.trainingLoadRange = Number.isFinite(defaultTrainingRange) ? defaultTrainingRange : fallbackRange;
    this.activitiesLimit = this.config?.ui?.activitiesLimit || 8;
    this.activitiesForChartLimit = 600;
    this.trainingLoadDailyAll = [];
    this.activitiesAll = [];
    this.activitiesByDate = new Map();
  }

  // ========== LIFECYCLE METHODS ==========

  async load() {
    try {
      Services.analytics.trackPageView('overview');
      
      // Show loading state
      this.renderLoading();
      
      // Fetch all data in parallel
      const maxRange = Math.max(...this.availableRanges, this.trainingLoadRange);
      const dateBounds = this.getDateBounds(maxRange);

      const [trainingLoadFull, activitiesFull, settings, fitnessState] = await Promise.all([
        Services.data.getTrainingLoad({ days: maxRange, forceRefresh: true }),
        Services.data.getActivities({ 
          limit: this.activitiesForChartLimit,
          skip: 0,
          startDate: dateBounds.start,
          endDate: dateBounds.end,
          forceRefresh: true
        }),
        Services.data.getSettings(),
        Services.data.getFitnessState().catch(() => null)
      ]);
      
      this.activitiesAll = Array.isArray(activitiesFull) ? activitiesFull : [];
      this.activitiesByDate = this.aggregateActivitiesByDate(this.activitiesAll);
      this.trainingLoadDailyAll = this.mergeTrainingLoadWithActivities(
        trainingLoadFull?.daily || [],
        this.activitiesByDate
      );

      const trainingLoad = {
        ...trainingLoadFull,
        daily: this.getDailyForRange(this.trainingLoadRange)
      };

      const activities = this.activitiesAll.slice(0, this.activitiesLimit);

      // Store data
      this.data = {
        trainingLoad,
        activities,
        settings,
        fitnessState
      };
      
      // Generate insights
      const tlInsights = Services.insight.generateTrainingLoadInsights(trainingLoad);
      const fsInsights = fitnessState ? 
        Services.insight.generateFitnessStateInsights(fitnessState) : [];
      
      const allInsights = Services.insight.sortByPriority([...tlInsights, ...fsInsights]);
      this.data.insights = Services.insight.getTopInsights(allInsights, 3);
      
      // Render page
      this.render();
      
      // Initialize charts
      this.initCharts();
      this.highlightActiveRange();
      
    } catch (error) {
      console.error('[OverviewPage] Load error:', error);
      Services.analytics.trackError('overview_load', error.message);
      this.renderError(error);
    }
  }

  render() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    const { trainingLoad, activities, settings, insights, fitnessState } = this.data;
    
    // ✅ Using classes from overview.css - NO inline styles
    container.innerHTML = `
      <div class="ov-section">
        <!-- Header -->
        <div class="ov-header">
          <h1>Dashboard Overview</h1>
          <p>Your training metrics and recent performance</p>
        </div>

        <!-- KPI Metrics Grid -->
        <div class="metrics-grid">
          ${this.renderMetrics()}
        </div>

        <!-- Training Load Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-header-content">
              <div class="chart-title-row">
                <div class="chart-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                </div>
                <div>
                  <div class="chart-title">Training Load (30 days)</div>
                  <div class="chart-subtitle">CTL, ATL, and TSB progression</div>
                </div>
              </div>
            </div>
            <div class="chart-controls">
              ${this.availableRanges.map(days => `
                <button class="chart-control ${this.trainingLoadRange === days ? 'active' : ''}" data-range="${days}">${days}d</button>
              `).join('')}
            </div>
          </div>
          <div class="chart-container">
            <canvas id="trainingLoadChart"></canvas>
          </div>
        </div>

        <!-- AI Insights -->
        ${insights && insights.length > 0 ? `
          <div class="insights-section">
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem;">AI Insights</h3>
            <div class="insights-grid">
              ${insights.map(insight => InsightCard(insight)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Recent Activities -->
        ${this.renderActivities(activities)}
      </div>
    `;
    
    // Setup chart controls
    this.setupChartControls();
    
    // Initialize icons
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  getDateBounds(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(0, days - 1));
    const toISO = (date) => date.toISOString().split('T')[0];
    return {
      start: toISO(start),
      end: toISO(end)
    };
  }

  aggregateActivitiesByDate(activities = []) {
    const map = new Map();

    activities.forEach(activity => {
      if (!activity?.start_time) return;
      const dateKey = activity.start_time.split('T')[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          distance: 0,
          tss: 0,
          duration: 0,
          count: 0
        });
      }

      const bucket = map.get(dateKey);
      const distance = Number(activity.distance);
      const tss = Number(activity.tss);
      const duration = Number(activity.duration);

      if (Number.isFinite(distance)) bucket.distance += distance;
      if (Number.isFinite(tss)) bucket.tss += tss;
      if (Number.isFinite(duration)) bucket.duration += duration;
      bucket.count += 1;
    });

    return map;
  }

  mergeTrainingLoadWithActivities(daily = [], activitiesByDate = new Map()) {
    return daily.map(entry => {
      const dateObj = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const dateKey = Number.isNaN(dateObj.getTime()) ? null : this.toISODate(dateObj);
      const activitySummary = dateKey ? activitiesByDate.get(dateKey) : null;
      const distanceKm = activitySummary ? activitySummary.distance : 0;
      const durationSeconds = activitySummary ? activitySummary.duration : 0;

      return {
        ...entry,
        date: dateObj,
        dateKey,
        ctl: this.safeNumber(entry.ctl),
        atl: this.safeNumber(entry.atl),
        tsb: this.safeNumber(entry.tsb),
        tss: this.safeNumber(entry.tss),
        distance: distanceKm,
        duration: durationSeconds,
        activityCount: activitySummary ? activitySummary.count : 0
      };
    });
  }

  getDailyForRange(range) {
    if (!Array.isArray(this.trainingLoadDailyAll) || this.trainingLoadDailyAll.length === 0) {
      return [];
    }
    const sliceCount = Math.max(1, Math.min(range, this.trainingLoadDailyAll.length));
    return this.trainingLoadDailyAll.slice(-sliceCount);
  }

  buildTrainingChartSeries(range) {
    const daily = this.getDailyForRange(range).filter(item => item.date instanceof Date && !Number.isNaN(item.date.getTime()))
      .map(item => ({
        ...item,
        date: new Date(item.date.getTime())
      }));

    const mode = range > 120 ? 'weekly' : 'daily';

    if (mode === 'daily') {
      const points = daily.map(entry => ({
        date: entry.date,
        endDate: entry.date,
        label: this.formatDateShort(entry.date),
        tooltip: this.formatDateLong(entry.date),
        ctl: entry.ctl,
        tss: entry.tss,
        distance: entry.distance,
        activityCount: entry.activityCount
      }));

      return {
        mode,
        points,
        hasTss: points.some(p => Math.abs(p.tss) > 0.01),
        hasDistance: points.some(p => Math.abs(p.distance) > 0.01)
      };
    }

    const buckets = new Map();

    daily.forEach(entry => {
      const start = this.startOfWeek(entry.date);
      const key = start.toISOString();
      if (!buckets.has(key)) {
        buckets.set(key, {
          startDate: start,
          endDate: entry.date,
          ctl: entry.ctl,
          tss: entry.tss,
          distance: entry.distance,
          activityCount: entry.activityCount,
          duration: entry.duration
        });
      } else {
        const bucket = buckets.get(key);
        bucket.tss += entry.tss;
        bucket.distance += entry.distance;
        bucket.activityCount += entry.activityCount;
        bucket.duration += entry.duration;
        if (entry.date > bucket.endDate) {
          bucket.endDate = entry.date;
          bucket.ctl = entry.ctl;
        }
      }
    });

    const points = Array.from(buckets.values())
      .sort((a, b) => a.startDate - b.startDate)
      .map(bucket => ({
        date: bucket.startDate,
        endDate: bucket.endDate,
        label: this.formatWeekLabel(bucket.startDate, bucket.endDate, false),
        tooltip: this.formatWeekLabel(bucket.startDate, bucket.endDate, true),
        ctl: bucket.ctl,
        tss: bucket.tss,
        distance: bucket.distance,
        activityCount: bucket.activityCount
      }));

    return {
      mode,
      points,
      hasTss: points.some(p => Math.abs(p.tss) > 0.01),
      hasDistance: points.some(p => Math.abs(p.distance) > 0.01)
    };
  }

  highlightActiveRange() {
    const controls = document.querySelectorAll('.chart-control');
    controls.forEach(btn => {
      const value = Number.parseInt(btn.dataset.range, 10);
      btn.classList.toggle('active', value === this.trainingLoadRange);
    });
  }

  renderMetrics() {
    const { trainingLoad } = this.data;
    const daily = trainingLoad?.daily || [];
    const hasData = this.hasTrainingLoadData(daily);

    if (!trainingLoad || !trainingLoad.current || !hasData) {
      return this.renderMetricsPlaceholder();
    }

    const ctl = this.safeNumber(trainingLoad.current.ctl);
    const atl = this.safeNumber(trainingLoad.current.atl);
    const tsb = this.safeNumber(trainingLoad.current.tsb);
    const fitnessCharge = this.calculateFitnessCharge(ctl, atl, tsb);
    const { totalTss, averageTss, peakTss } = this.calculateTssSummary(daily);
    const rangeLabel = `${daily.length} day${daily.length === 1 ? '' : 's'}`;

    return `
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon primary">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <div class="metric-label">Fitness (CTL)</div>
        </div>
        <div class="metric-value">${ctl.toFixed(1)}</div>
        <div class="metric-subtitle">Chronic Training Load</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon purple">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="metric-label">Fatigue (ATL)</div>
        </div>
        <div class="metric-value">${atl.toFixed(1)}</div>
        <div class="metric-subtitle">Acute Training Load</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon green">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="metric-label">Form (TSB)</div>
        </div>
        <div class="metric-value">${tsb.toFixed(1)}</div>
        <div class="metric-subtitle">${this.getTSBStatus(tsb)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon amber">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2h-2m-4 0h4m-4 0l-4-8m0 0l-4 8m4-8V4"/>
            </svg>
          </div>
          <div class="metric-label">Training Stress</div>
        </div>
        <div class="metric-value">${Math.round(totalTss)}</div>
        <div class="metric-subtitle">Total TSS · ${rangeLabel}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header-row">
          <div class="metric-icon slate">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1m-5.198 6C8.881 14.598 9.85 14 11 14m1-10v2m0 12v2m7-9a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="metric-label">Fitness Charge</div>
        </div>
        <div class="metric-value">${fitnessCharge}%</div>
        <div class="metric-subtitle">Avg TSS ${averageTss.toFixed(1)} · Peak ${peakTss.toFixed(0)}</div>
      </div>
    `;
  }

  renderActivities(activities) {
    if (!activities || activities.length === 0) {
      return `
        <div class="activities-card">
          <div class="activities-card-header">
            <div class="activities-card-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div class="activities-card-title">Recent Activities</div>
            <div class="activities-card-subtitle">Last ${displayedActivities.length} session${displayedActivities.length === 1 ? '' : 's'}</div>
          </div>
          <div class="no-data">
            No recent activities found
          </div>
        </div>
      `;
    }
    
    const displayedActivities = activities.slice(0, Math.min(5, activities.length));

    return `
      <div class="activities-card">
        <div class="activities-card-header">
          <div class="activities-card-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div class="activities-card-title">Recent Activities</div>
          <div class="activities-card-subtitle">Last ${displayedActivities.length} session${displayedActivities.length === 1 ? '' : 's'}</div>
        </div>
        <div class="activities-grid">
          <div class="activities-grid__row activities-grid__row--head">
            <div>Activity</div>
            <div>Date</div>
            <div>Duration</div>
            <div>Power</div>
            <div>Stress</div>
          </div>
          <div class="activities-grid__body">
            ${displayedActivities.map(activity => {
              const name = this.escapeHtml(activity.file_name || `Ride #${activity.id}`);
              const distance = this.formatDistance(activity.distance);
              const metaSegments = [];
              if (distance && distance !== '—') metaSegments.push(distance);
              const normalized = this.formatPower(activity.normalized_power, null);
              if (normalized && normalized !== '—') metaSegments.push(`NP ${normalized.replace(' W', '')}`);
              const meta = metaSegments.length ? `<div class="activity-meta">${metaSegments.join(' · ')}</div>` : '';
              const avgPower = this.formatPower(activity.avg_power);
              const normalizedPower = this.formatPower(activity.normalized_power);
              const powerMeta = normalizedPower !== '—' ? `NP ${normalizedPower}` : '';
              const tssValue = this.formatTss(activity.tss);
              const ifValue = this.formatIntensity(activity.intensity_factor);
              const tssBadge = tssValue === '—' ? '' : `<span class="badge badge--tss">${tssValue}</span>`;
              const ifBadge = ifValue === '—' ? '' : `<span class="badge badge--if">${ifValue}</span>`;
              const badges = [tssBadge, ifBadge].filter(Boolean).join('') || '<span class="badge badge--empty">—</span>';

              return `
                <div class="activities-grid__row activities-grid__row--data" onclick="window.router.navigateTo('activities')">
                  <div class="activities-grid__cell activities-grid__cell--activity">
                    <div class="activity-title">${name}</div>
                    ${meta}
                  </div>
                  <div class="activities-grid__cell">${this.formatDate(activity.start_time)}</div>
                  <div class="activities-grid__cell">${this.formatDuration(activity.duration)}</div>
                  <div class="activities-grid__cell activities-grid__cell--power activity-power">
                    <div class="activity-power__value">${avgPower}</div>
                    ${powerMeta ? `<div class="activity-power__meta">${powerMeta}</div>` : ''}
                  </div>
                  <div class="activities-grid__cell activities-grid__cell--stress">${badges}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderLoading() {
    const container = document.getElementById('pageContent') || document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="ov-section">
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
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">Failed to Load Overview</h3>
        <p style="margin-bottom: 16px;">${this.escapeHtml(error.message)}</p>
        <button class="btn btn--primary" onclick="window.router.refresh()">
          Try Again
        </button>
      </div>
    `;
  }

  // ========== CHART INITIALIZATION ==========

  initCharts() {
    this.initTrainingLoadChart();
  }

  initTrainingLoadChart() {
    const container = document.querySelector('.chart-container');
    if (!container || !this.data.trainingLoad) return;

    const chartSeries = this.buildTrainingChartSeries(this.trainingLoadRange);
    const daily = chartSeries.points;

    if (!this.hasTrainingLoadData(daily)) {
      this.destroyChart('trainingLoad');
      container.innerHTML = this.renderChartEmptyState();
      return;
    }

    if (!container.querySelector('#trainingLoadChart')) {
      container.innerHTML = '<canvas id="trainingLoadChart"></canvas>';
    }

    const canvas = container.querySelector('#trainingLoadChart');
    if (!canvas) return;

    this.destroyChart('trainingLoad');

    const chartPacket = Services.chart.prepareTrainingLoadChart(daily, { mode: chartSeries.mode });
    const chartData = {
      labels: chartPacket.labels,
      datasets: chartPacket.datasets
    };
    const chartOptions = Services.chart.getTrainingLoadChartOptions(chartPacket.meta);

    chartOptions.onClick = () => {
      Services.analytics.trackChartInteraction('training-load', 'click');
    };

    this.charts.trainingLoad = new Chart(canvas, {
      type: 'line',
      data: chartData,
      options: chartOptions
    });
  }

  setupChartControls() {
    document.querySelectorAll('.chart-control').forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active from all
        btn.parentElement.querySelectorAll('.chart-control').forEach(b => 
          b.classList.remove('active')
        );
        
        // Add active to clicked
        btn.classList.add('active');
        
        // Get range and reload chart
        const days = parseInt(btn.dataset.range, 10) || this.trainingLoadRange;
        this.trainingLoadRange = days;
        this.reloadChartWithRange(days);
      });
    });
  }

  async reloadChartWithRange(days) {
    try {
      const trainingLoadFull = await Services.data.getTrainingLoad({ days, forceRefresh: true });
      this.trainingLoadDailyAll = this.mergeTrainingLoadWithActivities(
        trainingLoadFull?.daily || [],
        this.activitiesByDate
      );
      this.data.trainingLoad = {
        ...trainingLoadFull,
        daily: this.getDailyForRange(days)
      };
      this.data.activities = this.activitiesAll.slice(0, this.activitiesLimit);
      this.trainingLoadRange = days;
      this.updateMetricsUI();
      this.initTrainingLoadChart();
      this.highlightActiveRange();
      
    } catch (error) {
      console.error('[OverviewPage] Error reloading chart:', error);
    }
  }

  // ========== HELPER METHODS ==========

  updateMetricsUI() {
    const metricsRoot = document.querySelector('.metrics-grid');
    if (!metricsRoot) return;
    metricsRoot.innerHTML = this.renderMetrics();
  }

  destroyChart(key) {
    const chart = this.charts[key];
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
    this.charts[key] = null;
  }

  hasTrainingLoadData(daily) {
    if (!Array.isArray(daily) || daily.length === 0) {
      return false;
    }

    return daily.some(day => {
      const ctl = this.safeNumber(day.ctl);
      const atl = this.safeNumber(day.atl);
      const tsb = this.safeNumber(day.tsb);
      const tss = this.safeNumber(day.tss);
      const distance = this.safeNumber(day.distance);
      return Math.max(ctl, atl, Math.abs(tsb), tss, distance) > 0.01;
    });
  }

  calculateTssSummary(daily) {
    if (!Array.isArray(daily) || daily.length === 0) {
      return { totalTss: 0, averageTss: 0, peakTss: 0 };
    }

    const totals = daily.reduce((acc, day) => {
      const tss = this.safeNumber(day.tss);
      return acc + tss;
    }, 0);

    const peak = daily.reduce((max, day) => {
      const tss = this.safeNumber(day.tss);
      return tss > max ? tss : max;
    }, 0);

    return {
      totalTss: totals,
      averageTss: daily.length ? totals / daily.length : 0,
      peakTss: peak
    };
  }

  safeNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  renderMetricsPlaceholder() {
    return `
      <div class="metric-card metric-card--empty">
        <div class="metric-empty__icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
        </div>
        <div class="metric-empty__title">No Training Load Yet</div>
        <div class="metric-empty__text">
          Upload activities with power and TSS data to unlock CTL, ATL, and TSB insights.
        </div>
        <button class="metric-empty__action" onclick="window.router.navigateTo('activities')">
          Upload Activities
        </button>
      </div>
    `;
  }

  renderChartEmptyState() {
    return `
      <div class="chart-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h4>No Training Load Data</h4>
        <p>We couldn’t find any recent TSS data. Upload new workouts to see your load progression.</p>
      </div>
    `;
  }

  calculateFitnessCharge(ctl, atl, tsb) {
    if (ctl === 0 && atl === 0) return 50;
    
    const ctlComponent = Math.min(70, (ctl / 100) * 70);
    const tsbNormalized = Math.max(-30, Math.min(30, tsb));
    const tsbComponent = (tsbNormalized / 30) * 30;
    
    let charge = ctlComponent + 50 + (tsbComponent * 0.5);
    return Math.round(Math.max(0, Math.min(100, charge)));
  }

  getFitnessChargeStatus(charge) {
    if (charge >= 80) return 'Peak Performance';
    if (charge >= 60) return 'Good Shape';
    if (charge >= 40) return 'Building';
    return 'Recovery Needed';
  }

  getTSBStatus(tsb) {
    if (tsb >= 25) return 'Very Fresh';
    if (tsb >= 10) return 'Fresh';
    if (tsb >= -10) return 'Neutral';
    if (tsb >= -20) return 'Fatigued';
    return 'Very Fatigued';
  }

  getTrend(dailyData, metric) {
    if (!dailyData || dailyData.length < 7) return null;
    
    const recent = dailyData.slice(-3).reduce((sum, d) => sum + d[metric], 0) / 3;
    const older = dailyData.slice(-7, -3).reduce((sum, d) => sum + d[metric], 0) / 4;
    
    const change = ((recent - older) / older) * 100;
    
    if (Math.abs(change) < 2) return null;
    return change > 0 ? 'up' : 'down';
  }

  formatPower(value, fallback = '—') {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    return `${Math.round(num)} W`;
  }

  formatTss(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '—';
    return `${Math.round(num)} TSS`;
  }

  formatIntensity(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '—';
    return `IF ${num.toFixed(2)}`;
  }

  formatDistance(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (num >= 100) return `${Math.round(num)} km`;
    if (num >= 10) return `${num.toFixed(1)} km`;
    if (num >= 1) return `${num.toFixed(2)} km`;
    const meters = num * 1000;
    if (meters >= 100) return `${Math.round(meters)} m`;
    return `${meters.toFixed(1)} m`;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatDuration(seconds) {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  formatDateShort(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  formatDateLong(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatWeekLabel(start, end, includeYear = false) {
    const options = includeYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' };
    const startLabel = start.toLocaleDateString(undefined, options);
    const endLabel = end.toLocaleDateString(undefined, options);
    return `${startLabel} – ${endLabel}`;
  }

  startOfWeek(date) {
    const result = new Date(date.getTime());
    const day = result.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Monday as first day
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  toISODate(date) {
    return date.toISOString().split('T')[0];
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ========== LIFECYCLE HOOKS ==========

  onShow() {
    console.log('[OverviewPage] Page shown');
  }

  onHide() {
    console.log('[OverviewPage] Page hidden');
  }

  onUnload() {
    // Clean up charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts = {};
    
    console.log('[OverviewPage] Page unloaded');
  }
}

// Create singleton instance
const overviewPage = new OverviewPage();

// Export for router
export default overviewPage;
export { overviewPage };
