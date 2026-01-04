import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService } from '../static/js/services/CacheService.js';

describe('CacheService', () => {
  let cache;

  beforeEach(() => {
    cache = new CacheService();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values with stats', () => {
    cache.set('key', { a: 1 });
    expect(cache.get('key')).toEqual({ a: 1 });

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.sets).toBe(1);
  });

  it('expires values based on TTL', () => {
    cache.set('temp', 'value', 100);
    expect(cache.get('temp')).toBe('value');

    vi.advanceTimersByTime(150);
    expect(cache.get('temp')).toBeNull();
  });

  it('clears values by pattern', () => {
    cache.set('training_load_30', 1);
    cache.set('training_load_90', 2);
    cache.set('power_curve_30', 3);

    const cleared = cache.clearPattern('training_load*');
    expect(cleared).toBe(2);
    expect(cache.get('training_load_30')).toBeNull();
    expect(cache.get('power_curve_30')).toBe(3);
  });

  it('clears expired items', () => {
    cache.set('short', 1, 50);
    cache.set('long', 2, 5000);

    vi.advanceTimersByTime(100);
    const cleared = cache.clearExpired();

    expect(cleared).toBe(1);
    expect(cache.has('short')).toBe(false);
    expect(cache.has('long')).toBe(true);
  });
});
