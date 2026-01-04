import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  notify,
  setLoading,
  formatDuration,
  formatDate,
  formatDateTime,
  formatPower,
  formatDistance,
  formatSpeed,
  formatHeartRate,
  formatCadence,
  formatPercentage,
  formatNumber,
  debounce,
  throttle,
  sleep,
  deepClone,
  isEmpty,
  getRelativeTime,
  getTSBStatus
} from '../static/js/core/utils.js';
import { eventBus, EVENTS } from '../static/js/core/eventBus.js';
import CONFIG from '../static/js/core/config.js';

describe('core utils', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="notification"></div>
      <div id="loading-overlay"></div>
    `;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders notifications and emits events', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    notify('Hello', 'success', 250);

    const el = document.getElementById('notification');
    expect(el.className).toContain('success');
    expect(el.innerHTML).toContain('Hello');
    expect(emitSpy).toHaveBeenCalledWith(
      EVENTS.NOTIFICATION,
      expect.objectContaining({ message: 'Hello', type: 'success' })
    );

    vi.advanceTimersByTime(250);
    expect(el.classList.contains('show')).toBe(false);
  });

  it('toggles loading overlay and emits events', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    const overlay = document.getElementById('loading-overlay');

    setLoading(true);
    expect(overlay.style.display).toBe('flex');
    expect(emitSpy).toHaveBeenCalledWith(EVENTS.LOADING_START);

    setLoading(false);
    expect(overlay.style.display).toBe('none');
    expect(emitSpy).toHaveBeenCalledWith(EVENTS.LOADING_END);
  });

  it('formats values consistently', () => {
    expect(formatDuration(0)).toBe('--');
    expect(formatDuration(3661)).toBe('1h 01m');
    expect(formatDate('2025-01-10')).toMatch('Jan');
    expect(formatDateTime('2025-01-10T08:15:00Z')).toMatch('2025');
    expect(formatPower(250.4)).toBe('250 W');
    expect(formatDistance(12500)).toBe('12.5 km');
    expect(formatSpeed(10)).toBe('36.0 km/h');
    expect(formatHeartRate(123.6)).toBe('124 bpm');
    expect(formatCadence(87.9)).toBe('88 rpm');
    expect(formatPercentage(12.345, 1)).toBe('12.3%');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('debounces and throttles functions', () => {
    const debouncedFn = vi.fn();
    const throttledFn = vi.fn();

    const debounced = debounce(debouncedFn, 200);
    const throttled = throttle(throttledFn, 200);

    debounced('a');
    debounced('b');
    throttled('first');
    throttled('second');

    expect(debouncedFn).not.toHaveBeenCalled();
    expect(throttledFn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(200);
    expect(debouncedFn).toHaveBeenCalledWith('b');

    throttled('third');
    vi.advanceTimersByTime(200);
    throttled('fourth');
    expect(throttledFn).toHaveBeenCalledTimes(3);
  });

  it('supports sleep, clone, and empty checks', async () => {
    const sample = { a: 1, b: { c: 2 } };
    const cloned = deepClone(sample);
    expect(cloned).toEqual(sample);
    expect(cloned).not.toBe(sample);

    expect(isEmpty('')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
    expect(isEmpty('ok')).toBe(false);

    const sleeper = sleep(200);
    vi.advanceTimersByTime(200);
    await sleeper;
  });

  it('formats relative time and TSB status', () => {
    vi.setSystemTime(new Date('2025-01-10T00:00:00Z'));

    expect(getRelativeTime('2025-01-09T23:59:30Z')).toBe('just now');
    expect(getRelativeTime('2025-01-09T23:00:00Z')).toContain('hour');

    const status = getTSBStatus(CONFIG.TSB_THRESHOLDS.veryFresh + 1);
    expect(status.status).toBe('Very Fresh');
    expect(status.color).toBe(CONFIG.CHART_COLORS.success);
  });
});
