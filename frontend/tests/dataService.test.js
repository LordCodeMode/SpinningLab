import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventBus, EVENTS } from '../static/js/core/eventBus.js';

const apiMocks = vi.hoisted(() => ({
  API: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    rebuildCache: vi.fn(),
    deleteActivity: vi.fn(),
    renameActivity: vi.fn(),
    getActivityStreams: vi.fn()
  },
  AnalysisAPI: {
    getTrainingLoad: vi.fn(),
    getPowerCurve: vi.fn(),
    getEfficiency: vi.fn(),
    getFitnessState: vi.fn(),
    getInsights: vi.fn()
  }
}));

vi.mock('../static/js/core/api.js', () => apiMocks);

import { DataService } from '../static/js/services/DataService.js';

describe('DataService', () => {
  let service;

  beforeEach(() => {
    eventBus.clear();
    eventBus.clearHistory();
    Object.values(apiMocks.API).forEach(fn => fn.mockReset());
    Object.values(apiMocks.AnalysisAPI).forEach(fn => fn.mockReset());
    service = new DataService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clears all caches and emits event', () => {
    const clearSpy = vi.spyOn(service.cache, 'clearPattern');
    const emitSpy = vi.spyOn(eventBus, 'emit');

    service.clearAllCaches();

    expect(clearSpy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalledWith('training_load*');
    expect(emitSpy).toHaveBeenCalledWith(EVENTS.CACHE_CLEAR);
  });

  it('caches training load responses', async () => {
    apiMocks.AnalysisAPI.getTrainingLoad.mockResolvedValue({ current: { ctl: 1 }, daily: [] });

    const first = await service.getTrainingLoad({ days: 30 });
    const second = await service.getTrainingLoad({ days: 30 });

    expect(first.current.ctl).toBe(1);
    expect(apiMocks.AnalysisAPI.getTrainingLoad).toHaveBeenCalledTimes(1);
    expect(second.current.ctl).toBe(1);
  });

  it('updates settings and triggers cache rebuild', async () => {
    apiMocks.API.updateSettings.mockResolvedValue({ ftp: 250 });
    apiMocks.API.rebuildCache.mockResolvedValue({ ok: true });

    const clearSpy = vi.spyOn(service, 'clearAllCaches');
    const rebuildSpy = vi.spyOn(service, 'rebuildBackendCache');
    const emitSpy = vi.spyOn(eventBus, 'emit');

    const result = await service.updateSettings({ ftp: 250 });

    expect(result.ftp).toBe(250);
    expect(clearSpy).toHaveBeenCalled();
    expect(rebuildSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith(EVENTS.SETTINGS_UPDATED, { ftp: 250 });
  });

  it('deletes and renames activities while clearing cache', async () => {
    apiMocks.API.deleteActivity.mockResolvedValue({ ok: true });
    apiMocks.API.renameActivity.mockResolvedValue({ ok: true });

    const deleteSpy = vi.spyOn(service.cache, 'delete');

    await service.deleteActivity(42);
    expect(deleteSpy).toHaveBeenCalledWith('activity_42');

    await service.renameActivity(42, 'New Name');
    expect(deleteSpy).toHaveBeenCalledWith('activity_42');
  });

  it('prefetches common data without throwing', async () => {
    vi.spyOn(service, 'getSettings').mockResolvedValue({ weight: 75 });
    vi.spyOn(service, 'getTrainingLoad').mockResolvedValue({});
    vi.spyOn(service, 'getEfficiency').mockResolvedValue({});
    vi.spyOn(service, 'getPowerCurve').mockResolvedValue({});
    vi.spyOn(service, 'getFitnessState').mockResolvedValue({});
    vi.spyOn(service, 'getActivities').mockResolvedValue({});

    await service.prefetchCommonData({ forceRefresh: true });

    expect(service.getTrainingLoad).toHaveBeenCalled();
    expect(service.getPowerCurve).toHaveBeenCalled();
  });
});
