import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../static/js/core/state.js';
import { eventBus } from '../static/js/core/eventBus.js';

describe('AppState', () => {
  beforeEach(() => {
    state.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets and gets nested values', () => {
    state.set('settings.ftp', 280);
    expect(state.get('settings.ftp')).toBe(280);
  });

  it('updates authentication state with user', () => {
    state.setUser({ id: 1, name: 'Max' });
    expect(state.isAuthenticated()).toBe(true);

    state.setUser(null);
    expect(state.isAuthenticated()).toBe(false);
  });

  it('notifies subscribers on changes', () => {
    const handler = vi.fn();
    const unsubscribe = state.subscribe('settings', handler);

    state.updateSettings({ ftp: 260 });
    expect(handler).toHaveBeenCalled();

    unsubscribe();
    state.updateSettings({ ftp: 270 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('tracks cache refresh logic', () => {
    vi.useFakeTimers();
    state.set('trainingLoadLastFetch', Date.now());
    expect(state.needsRefresh('trainingLoad')).toBe(false);

    vi.advanceTimersByTime(state.cacheTimeout + 1);
    expect(state.needsRefresh('trainingLoad')).toBe(true);
    vi.useRealTimers();
  });

  it('clears cached data and emits event', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    state.setTrainingLoad({ current: { ctl: 1 } });
    state.setPowerCurve({ durations: [1], powers: [100] });

    state.clearCache();

    expect(state.getTrainingLoad()).toBeNull();
    expect(state.getPowerCurve()).toBeNull();
    expect(emitSpy).toHaveBeenCalledWith('state:cache:cleared');
  });
});
