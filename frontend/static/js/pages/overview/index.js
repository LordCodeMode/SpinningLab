// ============================================
// FILE: pages/overview/index.js
// Dashboard Overview Page - UPDATED (Uses external CSS)
// ============================================

import Services from '../../services/index.js';
import { InsightCard, LoadingSkeleton } from '../../components/ui/index.js';
import CONFIG from './config.js';

const DISPLAY_NAME_STORAGE_KEY = CONFIG.DISPLAY_NAME_STORAGE_KEY || 'training_dashboard_display_name';

class OverviewPage {
  constructor() {
    this.config = CONFIG;
    this.charts = {};
    this.data = {};
    this.currentUser = null;
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

      // Get user info for welcome message
      const { AuthAPI } = await import('../../core/api.js');
      this.currentUser = await AuthAPI.me().catch(() => ({ username: 'Athlete' }));

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
    const userName = this.getUserDisplayName();
    const timeOfDay = this.getTimeOfDay();

    // UNIQUE DASHBOARD LAYOUT - Different from Training Load
    container.innerHTML = `
      <div class="ov-dashboard">
        ${this.renderWelcomeHero(userName, timeOfDay)}
        ${this.renderQuickStats()}
        ${this.renderMainContent()}
        ${this.renderRecentActivities(activities)}
        ${insights && insights.length > 0 ? this.renderInsightsSection(insights) : ''}
      </div>
    `;

    // Setup chart controls
    this.setupChartControls();

    // Initialize icons
    if (typeof feather !== 'undefined') {
      feather.replace();
    }
  }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  renderWelcomeHero(userName, timeOfDay) {
    const greeting = timeOfDay === 'morning' ? 'Good morning' :
                     timeOfDay === 'afternoon' ? 'Good afternoon' : 'Good evening';

    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    return `
      <div class="ov-welcome-hero">
        <div class="ov-welcome-content">
          <h1 class="ov-welcome-title">${greeting}, ${this.escapeHtml(userName)}!</h1>
          <p class="ov-welcome-subtitle">${date} • Here's your training overview</p>
        </div>
        <div class="ov-welcome-graphic">
          <svg viewBox="0 0 200 200" class="ov-hero-logo">
            <defs>
              <linearGradient id="heroLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                <stop offset="40%" style="stop-color:#764ba2;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#f093fb;stop-opacity:1" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            <!-- Animated background rings -->
            <circle cx="100" cy="100" r="85" fill="none" stroke="url(#heroLogoGradient)" stroke-width="1.5" opacity="0.15">
              <animate attributeName="r" values="85;90;85" dur="4s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.15;0.08;0.15" dur="4s" repeatCount="indefinite"/>
            </circle>

            <!-- Orbiting metric icons (counter-rotate to wheel) -->
            <g class="orbiting-icons" style="transform-origin: 100px 100px; animation: orbit-icons 40s linear infinite;">
              <!-- Icon 1: Home (top) -->
              <g transform="translate(100, 20)">
                <circle r="11" fill="rgba(102, 126, 234, 0.25)"/>
                <path d="M-4 1.5 L0 -2.5 L4 1.5 V5 H1.5 V2.5 H-1.5 V5 H-4 Z" fill="url(#heroLogoGradient)" stroke="none"/>
              </g>
              <!-- Icon 2: Trending Up (30°) -->
              <g transform="translate(143, 31)">
                <circle r="11" fill="rgba(118, 75, 162, 0.25)"/>
                <path d="M1.5 4 L4 1.5 M4 1.5 L4 4 M4 1.5 L1.5 1.5 M-4 4 L0 0" stroke="url(#heroLogoGradient)" stroke-width="2" fill="none" stroke-linecap="round"/>
              </g>
              <!-- Icon 3: Activity (60°) -->
              <g transform="translate(169, 69)">
                <circle r="11" fill="rgba(240, 147, 251, 0.25)"/>
                <path d="M-5 1.5 L-2.5 1.5 L0 -4 L2.5 4 L5 0" stroke="url(#heroLogoGradient)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </g>
              <!-- Icon 4: Target (90°) -->
              <g transform="translate(180, 100)">
                <circle r="11" fill="rgba(102, 126, 234, 0.25)"/>
                <circle cx="0" cy="0" r="4.5" fill="none" stroke="url(#heroLogoGradient)" stroke-width="2"/>
                <circle cx="0" cy="0" r="2" fill="url(#heroLogoGradient)"/>
              </g>
              <!-- Icon 5: Percent (120°) -->
              <g transform="translate(169, 131)">
                <circle r="11" fill="rgba(118, 75, 162, 0.25)"/>
                <path d="M-2.5 4 L2.5 -4 M-2.5 -2.5 a1.2 1.2 0 1 0 0.1 0 M2.5 2.5 a1.2 1.2 0 1 0 0.1 0" stroke="url(#heroLogoGradient)" stroke-width="2" fill="none" stroke-linecap="round"/>
              </g>
              <!-- Icon 6: Award (150°) -->
              <g transform="translate(143, 169)">
                <circle r="11" fill="rgba(240, 147, 251, 0.25)"/>
                <circle cx="0" cy="-0.5" r="3.5" fill="none" stroke="url(#heroLogoGradient)" stroke-width="2"/>
                <path d="M-2 2 L-1.5 4.5 L0 3.5 L1.5 4.5 L2 2" fill="url(#heroLogoGradient)" stroke="none"/>
              </g>
              <!-- Icon 7: Layers (180°) -->
              <g transform="translate(100, 180)">
                <circle r="11" fill="rgba(102, 126, 234, 0.25)"/>
                <path d="M0 -4 L4 -2 L0 0 L-4 -2 Z M0 0 L4 2 L0 4 L-4 2 Z" fill="url(#heroLogoGradient)" stroke="none"/>
              </g>
              <!-- Icon 8: Heart (210°) -->
              <g transform="translate(57, 169)">
                <circle r="11" fill="rgba(118, 75, 162, 0.25)"/>
                <path d="M0 4 L-3.5 1 Q-4 -0.5 -2.5 -2 Q-1.5 -3 0 -1.5 Q1.5 -3 2.5 -2 Q4 -0.5 3.5 1 Z" fill="url(#heroLogoGradient)" stroke="none"/>
              </g>
              <!-- Icon 9: Wind (240°) -->
              <g transform="translate(31, 131)">
                <circle r="11" fill="rgba(240, 147, 251, 0.25)"/>
                <path d="M-4 -2 L2.5 -2 Q4 -2 4 -0.5 Q4 1 2.5 1 M-4 2 L1.5 2 Q2.5 2 2.5 3.5" stroke="url(#heroLogoGradient)" stroke-width="2" fill="none" stroke-linecap="round"/>
              </g>
              <!-- Icon 10: Thermometer (270°) -->
              <g transform="translate(20, 100)">
                <circle r="11" fill="rgba(102, 126, 234, 0.25)"/>
                <path d="M0 -4 L0 1 M-2 2.5 Q0 4.5 2 2.5 Q2.5 1.5 2 0 L1 0 L1 -4 L-1 -4 L-1 0 L-2 0 Q-2.5 1.5 -2 2.5 Z" fill="url(#heroLogoGradient)" stroke="none"/>
              </g>
              <!-- Icon 11: List (300°) -->
              <g transform="translate(31, 69)">
                <circle r="11" fill="rgba(118, 75, 162, 0.25)"/>
                <path d="M-1.5 -3.5 L4 -3.5 M-1.5 0 L4 0 M-1.5 3.5 L4 3.5 M-4 -3.5 L-3.5 -3.5 M-4 0 L-3.5 0 M-4 3.5 L-3.5 3.5" stroke="url(#heroLogoGradient)" stroke-width="2" stroke-linecap="round"/>
              </g>
              <!-- Icon 12: Upload (330°) -->
              <g transform="translate(57, 31)">
                <circle r="11" fill="rgba(240, 147, 251, 0.25)"/>
                <path d="M0 -4 L0 4 M0 -4 L-2.5 -1.5 M0 -4 L2.5 -1.5" stroke="url(#heroLogoGradient)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </g>
            </g>

            <!-- Main spinning wheel structure -->
            <g class="spinning-element" style="transform-origin: 100px 100px; animation: spin-logo 20s linear infinite;">
              <!-- Outer wheel rim -->
              <circle cx="100" cy="100" r="55" fill="none" stroke="url(#heroLogoGradient)" stroke-width="4" filter="url(#glow)"/>

              <!-- 6 spokes radiating from center -->
              <line x1="100" y1="45" x2="100" y2="155" stroke="url(#heroLogoGradient)" stroke-width="3"/>
              <line x1="45" y1="100" x2="155" y2="100" stroke="url(#heroLogoGradient)" stroke-width="3"/>
              <line x1="61.1" y1="61.1" x2="138.9" y2="138.9" stroke="url(#heroLogoGradient)" stroke-width="3"/>
              <line x1="138.9" y1="61.1" x2="61.1" y2="138.9" stroke="url(#heroLogoGradient)" stroke-width="3"/>

              <!-- Inner hub circle -->
              <circle cx="100" cy="100" r="20" fill="url(#heroLogoGradient)" opacity="0.8"/>
              <circle cx="100" cy="100" r="12" fill="none" stroke="white" stroke-width="2" opacity="0.5"/>
            </g>
          </svg>

          <style>
            @keyframes spin-logo {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes orbit-icons {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(-360deg); }
            }
            .ov-hero-logo {
              width: 100%;
              height: 100%;
            }
          </style>
        </div>
      </div>
    `;
  }

  renderQuickStats() {
    const { trainingLoad, activities } = this.data;

    // Get activities from the last 7 calendar days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentActivities = (this.activitiesAll || activities || []).filter(a => {
      if (!a.start_time) return false;
      const activityDate = new Date(a.start_time);
      return activityDate >= sevenDaysAgo;
    });

    const totalDistance = recentActivities.reduce((sum, a) => sum + (Number(a.distance) || 0), 0);
    const totalTSS = recentActivities.reduce((sum, a) => sum + (Number(a.tss) || 0), 0);
    const totalDuration = recentActivities.reduce((sum, a) => sum + (Number(a.duration) || 0), 0);

    return `
      <div class="ov-quick-stats">
        <div class="ov-stat-card" data-color="blue">
          <div class="ov-stat-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <div class="ov-stat-content">
            <div class="ov-stat-label">Last 7 Days</div>
            <div class="ov-stat-value">${recentActivities.length}</div>
            <div class="ov-stat-subtitle">Activities</div>
          </div>
        </div>

        <div class="ov-stat-card" data-color="purple">
          <div class="ov-stat-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
          </div>
          <div class="ov-stat-content">
            <div class="ov-stat-label">Total Distance</div>
            <div class="ov-stat-value">${totalDistance.toFixed(0)}</div>
            <div class="ov-stat-subtitle">Kilometers</div>
          </div>
        </div>

        <div class="ov-stat-card" data-color="orange">
          <div class="ov-stat-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="ov-stat-content">
            <div class="ov-stat-label">Training Stress</div>
            <div class="ov-stat-value">${totalTSS.toFixed(0)}</div>
            <div class="ov-stat-subtitle">TSS Points</div>
          </div>
        </div>

        <div class="ov-stat-card" data-color="green">
          <div class="ov-stat-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="ov-stat-content">
            <div class="ov-stat-label">Training Time</div>
            <div class="ov-stat-value">${(totalDuration / 3600).toFixed(1)}</div>
            <div class="ov-stat-subtitle">Hours</div>
          </div>
        </div>
      </div>
    `;
  }

  renderMainContent() {
    const { trainingLoad } = this.data;

    return `
      <div class="ov-main-content">
        <!-- Left: Metrics -->
        <div class="ov-left-panel">
          ${this.renderMetricsPanel()}
        </div>

        <!-- Right: Chart -->
        <div class="ov-right-panel">
          <div class="ov-chart-widget">
            <div class="ov-chart-header">
              <div>
                <h3 class="ov-chart-title">Training Load Trend</h3>
                <p class="ov-chart-subtitle">CTL, ATL, and TSB progression</p>
              </div>
              <div class="ov-chart-controls">
                ${this.availableRanges.map(days => `
                  <button class="ov-chart-btn ${this.trainingLoadRange === days ? 'active' : ''}" data-range="${days}">${days}d</button>
                `).join('')}
              </div>
            </div>
            <div class="ov-chart-canvas">
              <canvas id="trainingLoadChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderMetricsPanel() {
    const { trainingLoad } = this.data;
    const ctl = trainingLoad?.current?.ctl || 0;
    const atl = trainingLoad?.current?.atl || 0;
    const tsb = trainingLoad?.current?.tsb || 0;

    return `
      <div class="ov-metrics-panel">
        <h3 class="ov-panel-title">Current Load</h3>

        <div class="ov-metric-large">
          <div class="ov-metric-large-label">Fitness (CTL)</div>
          <div class="ov-metric-large-value" style="color: #3b82f6;">${ctl.toFixed(1)}</div>
          <div class="ov-metric-large-bar">
            <div class="ov-metric-large-fill" style="width: ${Math.min(100, (ctl / 100) * 100)}%; background: #3b82f6;"></div>
          </div>
        </div>

        <div class="ov-metric-large">
          <div class="ov-metric-large-label">Fatigue (ATL)</div>
          <div class="ov-metric-large-value" style="color: #f59e0b;">${atl.toFixed(1)}</div>
          <div class="ov-metric-large-bar">
            <div class="ov-metric-large-fill" style="width: ${Math.min(100, (atl / 100) * 100)}%; background: #f59e0b;"></div>
          </div>
        </div>

        <div class="ov-metric-large">
          <div class="ov-metric-large-label">Form (TSB)</div>
          <div class="ov-metric-large-value" style="color: ${tsb >= 0 ? '#10b981' : '#ef4444'};">${tsb > 0 ? '+' : ''}${tsb.toFixed(1)}</div>
          <div class="ov-metric-large-bar">
            <div class="ov-metric-large-fill" style="width: ${Math.abs(tsb) * 2}%; background: ${tsb >= 0 ? '#10b981' : '#ef4444'};"></div>
          </div>
        </div>

        <div class="ov-form-status">
          <div class="ov-form-badge ${tsb > 5 ? 'fresh' : tsb > -5 ? 'balanced' : 'fatigued'}">
            ${tsb > 5 ? 'Fresh' : tsb > -5 ? 'Balanced' : 'Fatigued'}
          </div>
          <p class="ov-form-text">
            ${tsb > 5 ? 'Great time for high-intensity work' :
              tsb > -5 ? 'Balanced training and recovery' :
              'Consider adding recovery'}
          </p>
        </div>
      </div>
    `;
  }

  renderRecentActivities(activities) {
    if (!activities || activities.length === 0) return '';

    const activityCards = activities.slice(0, 6).map(activity => {
      // Distance is already in kilometers in the database, no need to divide
      const distance = Number(activity.distance) || Number(activity.total_distance) || 0;
      const distanceKm = distance > 0 ? distance.toFixed(1) : '0.0';
      const tss = Math.round(Number(activity.tss) || 0);
      const avgPower = Math.round(Number(activity.avg_power) || 0);
      const normalizedPower = Math.round(Number(activity.normalized_power) || 0);
      const intensityFactor = Number(activity.intensity_factor) || 0;
      const ifDisplay = intensityFactor > 0 ? intensityFactor.toFixed(2) : '-';
      const activityId = this.getActivityId(activity);
      const route = activityId ? `activity/${activityId}` : 'activities';

      return `
        <div class="ov-activity-card" data-activity-id="${activityId ?? ''}"
             onclick="window.router ? window.router.navigateTo('${route}') : (window.location.hash='#/${route}')">
          <div class="ov-activity-header">
            <div class="ov-activity-type">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
              ${this.escapeHtml(activity.type || activity.file_name || 'Ride')}
            </div>
            <div class="ov-activity-date">${this.formatDate(activity.start_time)}</div>
          </div>
          <div class="ov-activity-primary-stats">
            <div class="ov-activity-stat">
              <span class="ov-activity-stat-value">${distanceKm}</span>
              <span class="ov-activity-stat-unit">km</span>
            </div>
            <div class="ov-activity-stat">
              <span class="ov-activity-stat-value">${tss}</span>
              <span class="ov-activity-stat-unit">TSS</span>
            </div>
            <div class="ov-activity-stat">
              <span class="ov-activity-stat-value">${avgPower}</span>
              <span class="ov-activity-stat-unit">W avg</span>
            </div>
          </div>
          <div class="ov-activity-secondary-stats">
            <div class="ov-activity-badge">
              <span class="ov-activity-badge-label">NP:</span>
              <span class="ov-activity-badge-value">${normalizedPower}W</span>
            </div>
            <div class="ov-activity-badge">
              <span class="ov-activity-badge-label">IF:</span>
              <span class="ov-activity-badge-value">${ifDisplay}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="ov-activities-section">
        <h3 class="ov-section-title">Recent Activities</h3>
        <div class="ov-activities-grid">
          ${activityCards}
        </div>
      </div>
    `;
  }

  renderInsightsSection(insights) {
    return `
      <div class="ov-insights-section">
        <h3 class="ov-section-title">AI Insights</h3>
        <div class="ov-insights-grid">
          ${insights.map(insight => InsightCard(insight)).join('')}
        </div>
      </div>
    `;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getActivityId(activity) {
    if (!activity) return null;
    return (
      activity.id ??
      activity.activity_id ??
      activity.activityId ??
      activity._id ??
      null
    );
  }

  getDateBounds(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Math.max(0, days - 1));
    const toISO = (date) => this.toISODate(date);
    return {
      start: toISO(start),
      end: toISO(end)
    };
  }

  aggregateActivitiesByDate(activities = []) {
    const map = new Map();

    activities.forEach(activity => {
      if (!activity?.start_time) return;
      const dateKey = this.toISODate(activity.start_time);
      if (!dateKey) return;
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
    const daily = this.getDailyForRange(range)
      .filter(item => item.date instanceof Date && !Number.isNaN(item.date.getTime()))
      .map(item => ({
        ...item,
        date: new Date(item.date.getTime())
      }));

    const mode = range > 120 ? 'weekly' : 'daily';

    if (mode === 'daily') {
      const reduced = this.downsampleDailySeries(daily, range);
      const points = reduced.map(entry => ({
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
    const controls = document.querySelectorAll('.ov-chart-btn');
    controls.forEach(btn => {
      const value = Number.parseInt(btn.dataset.range, 10);
      btn.classList.toggle('active', value === this.trainingLoadRange);
    });
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
    const canvas = document.querySelector('#trainingLoadChart');
    if (!canvas || !this.data.trainingLoad) return;

    const chartSeries = this.buildTrainingChartSeries(this.trainingLoadRange);
    const daily = chartSeries.points;

    if (!this.hasTrainingLoadData(daily)) {
      this.destroyChart('trainingLoad');
      const container = canvas.parentElement;
      if (container) container.innerHTML = this.renderChartEmptyState();
      return;
    }

    this.destroyChart('trainingLoad');

    // Build labels
    const labels = daily.map(point => point.label);

    // Build datasets: TSS (bars), Distance (line), CTL (line)
    const datasets = [];

    // 1. TSS as bars
    if (chartSeries.hasTss) {
      datasets.push({
        label: 'TSS',
        data: daily.map(point => point.tss || 0),
        type: 'bar',
        backgroundColor: 'rgba(245, 158, 11, 0.6)',
        borderColor: 'rgba(245, 158, 11, 1)',
        borderWidth: 2,
        yAxisID: 'y',
        order: 3
      });
    }

    // 2. Distance as line (already in km, no conversion needed)
    if (chartSeries.hasDistance) {
      datasets.push({
        label: 'Distance (km)',
        data: daily.map(point => point.distance || 0),
        type: 'line',
        borderColor: 'rgba(139, 92, 246, 1)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        yAxisID: 'y1',
        order: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    // 3. CTL as line
    datasets.push({
      label: 'Fitness (CTL)',
      data: daily.map(point => point.ctl || 0),
      type: 'line',
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 3,
      fill: false,
      tension: 0.4,
      yAxisID: 'y',
      order: 1,
      pointRadius: 4,
      pointHoverRadius: 6
    });

    const chartData = { labels, datasets };

    // Build options with dual y-axes
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 12, weight: '600' }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#111827',
          bodyColor: '#6b7280',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                if (context.dataset.label === 'Distance (km)') {
                  label += context.parsed.y.toFixed(1) + ' km';
                } else if (context.dataset.label === 'TSS') {
                  label += Math.round(context.parsed.y);
                } else {
                  label += context.parsed.y.toFixed(1);
                }
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#6b7280' }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'TSS / CTL', font: { size: 12, weight: '600' }, color: '#111827' },
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { font: { size: 11 }, color: '#6b7280' }
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Distance (km)', font: { size: 12, weight: '600' }, color: '#111827' },
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#6b7280' }
        }
      },
      onClick: () => {
        Services.analytics.trackChartInteraction('overview-training-load', 'click');
      }
    };

    this.charts.trainingLoad = new Chart(canvas, {
      type: 'bar',
      data: chartData,
      options: chartOptions
    });
  }

  setupChartControls() {
    document.querySelectorAll('.ov-chart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove active from all
        btn.parentElement.querySelectorAll('.ov-chart-btn').forEach(b =>
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
    const metricsPanel = document.querySelector('.ov-metrics-panel');
    if (!metricsPanel) return;
    metricsPanel.innerHTML = this.renderMetricsPanel();
  }

  destroyChart(key) {
    const chart = this.charts[key];
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
    this.charts[key] = null;
  }

  downsampleDailySeries(series, range) {
    if (!Array.isArray(series) || series.length <= 1) {
      return series || [];
    }

    const maxPoints = range <= 30 ? 30 : range <= 90 ? 45 : 60;
    if (series.length <= maxPoints) {
      return series;
    }

    const step = Math.ceil(series.length / maxPoints);
    const downsampled = [];
    for (let i = 0; i < series.length; i += step) {
      downsampled.push(series[i]);
    }

    if (downsampled[downsampled.length - 1] !== series[series.length - 1]) {
      downsampled.push(series[series.length - 1]);
    }

    return downsampled;
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
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getUserDisplayName() {
    const apiName = this.currentUser?.name?.trim();
    if (apiName) return apiName;

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
      if (stored && stored.trim()) {
        return stored.trim();
      }
    }

    if (this.currentUser?.username) {
      return this.currentUser.username;
    }

    const emailLocal = this.currentUser?.email?.split('@')[0];
    return emailLocal || 'Athlete';
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
