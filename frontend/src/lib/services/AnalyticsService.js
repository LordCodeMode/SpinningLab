// ============================================
// FILE: static/js/services/AnalyticsService.js
// User behavior analytics and tracking
// ============================================

import { eventBus, EVENTS } from '../core/eventBus.js';
import CONFIG from '../core/config.js';

class AnalyticsService {
  constructor() {
    this.enabled = false; // Disabled by default, enable when needed
    this.events = [];
    this.maxEvents = 100; // Keep last 100 events in memory
    this.sessionStart = Date.now();
    this.sessionId = this.generateSessionId();
    
    this.setupEventListeners();
  }

  // ========== INITIALIZATION ==========

  /**
   * Enable analytics tracking
   */
  enable() {
    this.enabled = true;
    console.log('[Analytics] Tracking enabled');
  }

  /**
   * Disable analytics tracking
   */
  disable() {
    this.enabled = false;
    console.log('[Analytics] Tracking disabled');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Page navigation
    eventBus.on(EVENTS.PAGE_LOAD, (data) => {
      this.trackPageView(data.page);
    });

    // User interactions
    eventBus.on(EVENTS.UPLOAD_COMPLETE, () => {
      this.trackEvent('file_upload', { status: 'complete' });
    });

    eventBus.on(EVENTS.SETTINGS_UPDATED, (data) => {
      this.trackEvent('settings_updated', { settings: Object.keys(data) });
    });

    // Data refreshes
    eventBus.on(EVENTS.PAGE_REFRESH, (data) => {
      this.trackEvent('page_refresh', { page: data.page });
    });
  }

  // ========== EVENT TRACKING ==========

  /**
   * Track page view
   * @param {string} page - Page name
   * @param {Object} metadata - Additional metadata
   */
  trackPageView(page, metadata = {}) {
    this.trackEvent('page_view', {
      page,
      ...metadata,
      url: window.location.href,
      referrer: document.referrer
    });
  }

  /**
   * Track user action
   * @param {string} action - Action name
   * @param {Object} properties - Action properties
   */
  trackEvent(action, properties = {}) {
    if (!this.enabled) return;

    const event = {
      id: this.generateEventId(),
      sessionId: this.sessionId,
      action,
      properties,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    this.events.push(event);

    // Keep only last N events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log in debug mode
    if (CONFIG.FEATURES.debugMode) {
      console.log('[Analytics]', action, properties);
    }
  }

  /**
   * Track chart interaction
   * @param {string} chartType - Type of chart
   * @param {string} interaction - Type of interaction
   */
  trackChartInteraction(chartType, interaction) {
    this.trackEvent('chart_interaction', {
      chartType,
      interaction
    });
  }

  /**
   * Track filter change
   * @param {string} filterName - Filter name
   * @param {any} value - Filter value
   */
  trackFilterChange(filterName, value) {
    this.trackEvent('filter_change', {
      filterName,
      value
    });
  }

  /**
   * Track time range selection
   * @param {string} page - Page name
   * @param {string} range - Time range
   */
  trackTimeRangeChange(page, range) {
    this.trackEvent('time_range_change', {
      page,
      range
    });
  }

  /**
   * Track error
   * @param {string} errorType - Type of error
   * @param {string} message - Error message
   * @param {Object} context - Error context
   */
  trackError(errorType, message, context = {}) {
    this.trackEvent('error', {
      errorType,
      message,
      ...context,
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  }

  /**
   * Track performance metric
   * @param {string} metric - Metric name
   * @param {number} value - Metric value
   * @param {string} unit - Unit of measurement
   */
  trackPerformance(metric, value, unit = 'ms') {
    this.trackEvent('performance', {
      metric,
      value,
      unit
    });
  }

  // ========== SESSION MANAGEMENT ==========

  /**
   * Get current session duration
   * @returns {number} Duration in milliseconds
   */
  getSessionDuration() {
    return Date.now() - this.sessionStart;
  }

  /**
   * Get session info
   * @returns {Object} Session information
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStart,
      duration: this.getSessionDuration(),
      eventCount: this.events.length
    };
  }

  /**
   * End current session and start new one
   */
  endSession() {
    const sessionData = {
      ...this.getSessionInfo(),
      events: [...this.events]
    };

    // Could send to backend here
    console.log('[Analytics] Session ended:', sessionData);

    // Start new session
    this.sessionStart = Date.now();
    this.sessionId = this.generateSessionId();
    this.events = [];
  }

  // ========== DATA RETRIEVAL ==========

  /**
   * Get all tracked events
   * @param {Object} filters - Optional filters
   * @returns {Array<Object>} Filtered events
   */
  getEvents(filters = {}) {
    let filtered = [...this.events];

    if (filters.action) {
      filtered = filtered.filter(e => e.action === filters.action);
    }

    if (filters.since) {
      filtered = filtered.filter(e => e.timestamp >= filters.since);
    }

    if (filters.page) {
      filtered = filtered.filter(e => e.properties?.page === filters.page);
    }

    return filtered;
  }

  /**
   * Get event counts by action
   * @returns {Object} Action counts
   */
  getEventCounts() {
    const counts = {};

    for (const event of this.events) {
      counts[event.action] = (counts[event.action] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get most viewed pages
   * @param {number} limit - Number of pages to return
   * @returns {Array<Object>} Page views sorted by count
   */
  getMostViewedPages(limit = 5) {
    const pageViews = this.getEvents({ action: 'page_view' });
    const counts = {};

    for (const event of pageViews) {
      const page = event.properties?.page || 'unknown';
      counts[page] = (counts[page] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get user activity timeline
   * @param {number} intervalMs - Interval for grouping (default: 5min)
   * @returns {Array<Object>} Activity timeline
   */
  getActivityTimeline(intervalMs = 5 * 60 * 1000) {
    const timeline = [];
    const now = Date.now();
    const startTime = this.sessionStart;

    for (let time = startTime; time <= now; time += intervalMs) {
      const intervalEvents = this.events.filter(e => 
        e.timestamp >= time && e.timestamp < time + intervalMs
      );

      timeline.push({
        time,
        timeISO: new Date(time).toISOString(),
        eventCount: intervalEvents.length,
        actions: intervalEvents.map(e => e.action)
      });
    }

    return timeline;
  }

  // ========== HELPER METHODS ==========

  /**
   * Generate unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   * @returns {string} Event ID
   */
  generateEventId() {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all events
   */
  clearEvents() {
    this.events = [];
    console.log('[Analytics] Events cleared');
  }

  /**
   * Export events as JSON
   * @returns {string} JSON string of events
   */
  exportEvents() {
    return JSON.stringify({
      session: this.getSessionInfo(),
      events: this.events
    }, null, 2);
  }

  /**
   * Get analytics summary
   * @returns {Object} Analytics summary
   */
  getSummary() {
    const eventCounts = this.getEventCounts();
    const mostViewedPages = this.getMostViewedPages();

    return {
      enabled: this.enabled,
      session: this.getSessionInfo(),
      totalEvents: this.events.length,
      eventTypes: Object.keys(eventCounts).length,
      eventCounts,
      mostViewedPages,
      errors: this.getEvents({ action: 'error' }).length
    };
  }

  /**
   * Debug: Print analytics info
   */
  debug() {
    console.log('[Analytics] Debug Info:');
    console.log('Summary:', this.getSummary());
    console.log('Recent Events:', this.events.slice(-10));
  }

  // ========== ADVANCED TRACKING ==========

  /**
   * Track user engagement score
   * @returns {number} Engagement score 0-100
   */
  calculateEngagementScore() {
    const duration = this.getSessionDuration();
    const eventCount = this.events.length;
    const pageViews = this.getEvents({ action: 'page_view' }).length;
    
    // Simple engagement formula
    const durationScore = Math.min(duration / (30 * 60 * 1000), 1) * 40; // Max 40 pts for 30min
    const eventScore = Math.min(eventCount / 50, 1) * 30; // Max 30 pts for 50 events
    const pageScore = Math.min(pageViews / 10, 1) * 30; // Max 30 pts for 10 pages
    
    return Math.round(durationScore + eventScore + pageScore);
  }

  /**
   * Track feature usage
   * @param {string} feature - Feature name
   * @param {string} action - Action performed
   */
  trackFeatureUsage(feature, action) {
    this.trackEvent('feature_usage', {
      feature,
      action
    });
  }

  /**
   * Get feature usage statistics
   * @returns {Object} Feature usage stats
   */
  getFeatureUsage() {
    const featureEvents = this.getEvents({ action: 'feature_usage' });
    const usage = {};

    for (const event of featureEvents) {
      const feature = event.properties?.feature || 'unknown';
      if (!usage[feature]) {
        usage[feature] = { count: 0, actions: {} };
      }
      usage[feature].count++;
      
      const action = event.properties?.action || 'unknown';
      usage[feature].actions[action] = (usage[feature].actions[action] || 0) + 1;
    }

    return usage;
  }

  /**
   * Track user journey
   * @returns {Array<string>} Page navigation sequence
   */
  getUserJourney() {
    const pageViews = this.getEvents({ action: 'page_view' });
    return pageViews.map(e => e.properties?.page || 'unknown');
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.analyticsService = analyticsService;
}

export { AnalyticsService };
export default analyticsService;