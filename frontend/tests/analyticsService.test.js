import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnalyticsService } from '../static/js/services/AnalyticsService.js';
import { eventBus, EVENTS } from '../static/js/core/eventBus.js';

describe('AnalyticsService', () => {
  beforeEach(() => {
    eventBus.clear();
    eventBus.clearHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not track events when disabled', () => {
    const analytics = new AnalyticsService();
    analytics.trackEvent('page_view');

    expect(analytics.events.length).toBe(0);
  });

  it('tracks events when enabled', () => {
    const analytics = new AnalyticsService();
    analytics.enable();
    analytics.trackEvent('custom_event', { value: 123 });

    expect(analytics.events.length).toBe(1);
    expect(analytics.events[0].action).toBe('custom_event');
  });

  it('tracks page views from event bus', () => {
    const analytics = new AnalyticsService();
    analytics.enable();

    eventBus.emit(EVENTS.PAGE_LOAD, { page: 'overview' });

    const pageViews = analytics.events.filter(event => event.action === 'page_view');
    expect(pageViews.length).toBe(1);
    expect(pageViews[0].properties.page).toBe('overview');
  });

  it('returns session info', () => {
    const analytics = new AnalyticsService();
    const info = analytics.getSessionInfo();

    expect(info.sessionId).toBeDefined();
    expect(info.duration).toBeGreaterThanOrEqual(0);
    expect(info.eventCount).toBe(0);
  });
});
