import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus } from '../static/js/core/eventBus.js';

const TEST_EVENT = 'test:event';

describe('EventBus', () => {
  beforeEach(() => {
    eventBus.clear();
    eventBus.clearHistory();
    eventBus.disableDebug();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers listeners and emits data', () => {
    const handler = vi.fn();
    eventBus.on(TEST_EVENT, handler);

    const result = eventBus.emit(TEST_EVENT, { value: 42 });

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('supports one-time listeners', () => {
    const handler = vi.fn();
    eventBus.once(TEST_EVENT, handler);

    eventBus.emit(TEST_EVENT, { value: 1 });
    eventBus.emit(TEST_EVENT, { value: 2 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(eventBus.hasListeners(TEST_EVENT)).toBe(false);
  });

  it('respects listener priority order', () => {
    const calls = [];
    eventBus.on(TEST_EVENT, () => calls.push('low'), { priority: 1 });
    eventBus.on(TEST_EVENT, () => calls.push('high'), { priority: 10 });

    eventBus.emit(TEST_EVENT);

    expect(calls).toEqual(['high', 'low']);
  });

  it('unregisters listeners by callback or id', () => {
    const handler = vi.fn();
    const unsubscribe = eventBus.on(TEST_EVENT, handler);

    eventBus.off(TEST_EVENT, handler);
    expect(eventBus.listenerCount(TEST_EVENT)).toBe(0);

    const handler2 = vi.fn();
    const unsubscribe2 = eventBus.on(TEST_EVENT, handler2);
    unsubscribe2();

    expect(eventBus.listenerCount(TEST_EVENT)).toBe(0);
  });

  it('tracks event history', () => {
    eventBus.emit(TEST_EVENT, { value: 1 });
    eventBus.emit(TEST_EVENT, { value: 2 });

    const history = eventBus.getHistory(TEST_EVENT);
    expect(history.length).toBe(2);
    expect(history[0].data).toEqual({ value: 2 });
  });

  it('emits asynchronously', async () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    eventBus.on(TEST_EVENT, handler);

    const promise = eventBus.emitAsync(TEST_EVENT, { value: 3 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledWith({ value: 3 });
    vi.useRealTimers();
  });
});
