import { describe, it, expect, beforeEach, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  API: {
    uploadFitFiles: vi.fn(),
    getCacheStatus: vi.fn()
  }
}));

const eventBusMocks = vi.hoisted(() => ({
  eventBus: {
    on: vi.fn(),
    emit: vi.fn()
  },
  EVENTS: {
    UPLOAD_START: 'upload:start',
    UPLOAD_COMPLETE: 'upload:complete',
    UPLOAD_ERROR: 'upload:error',
    DATA_IMPORTED: 'data:imported'
  }
}));

const notifyMocks = vi.hoisted(() => ({
  notify: vi.fn()
}));

const stateMocks = vi.hoisted(() => ({
  default: {
    updateUploadProgress: vi.fn(),
    resetUploadProgress: vi.fn()
  }
}));

const configMocks = vi.hoisted(() => ({
  default: {
    UPLOAD_MAX_FILES: 2,
    UPLOAD_MAX_SIZE: 1024
  }
}));

vi.mock('../static/js/core/api.js', () => apiMocks);
vi.mock('../static/js/core/eventBus.js', () => eventBusMocks);
vi.mock('../static/js/utils/notifications.js', () => notifyMocks);
vi.mock('../static/js/core/state.js', () => stateMocks);
vi.mock('../static/js/core/config.js', () => configMocks);

import { UploadService } from '../static/js/services/UploadService.js';

describe('UploadService', () => {
  beforeEach(() => {
    apiMocks.API.uploadFitFiles.mockReset();
    apiMocks.API.getCacheStatus.mockReset();
    eventBusMocks.eventBus.emit.mockReset();
    eventBusMocks.eventBus.on.mockReset();
    notifyMocks.notify.mockReset();
    stateMocks.default.updateUploadProgress.mockReset();
    stateMocks.default.resetUploadProgress.mockReset();
  });

  it('validates files and reports errors', () => {
    const service = new UploadService();
    const result = service.validateFiles([
      { name: 'ride.fit', size: 100 },
      { name: 'bad.txt', size: 100 }
    ]);

    expect(result.valid).toBe(false);
    expect(result.validFiles.length).toBe(1);
    expect(result.invalidCount).toBe(1);
  });

  it('rejects too many files and oversize files', () => {
    const service = new UploadService();
    const tooMany = service.validateFiles([
      { name: 'a.fit', size: 100 },
      { name: 'b.fit', size: 100 },
      { name: 'c.fit', size: 100 }
    ]);
    expect(tooMany.valid).toBe(false);

    const oversize = service.validateFile({ name: 'big.fit', size: 2048 });
    expect(oversize.valid).toBe(false);
  });

  it('uploads valid files and emits events', async () => {
    apiMocks.API.uploadFitFiles.mockResolvedValue({
      results: [{ success: true }],
      cache_rebuild_triggered: false
    });
    const service = new UploadService();
    const result = await service.uploadFiles([{ name: 'ride.fit', size: 100 }]);

    expect(result.results.length).toBe(1);
    expect(eventBusMocks.eventBus.emit).toHaveBeenCalledWith('upload:start', { fileCount: 1 });
    expect(eventBusMocks.eventBus.emit).toHaveBeenCalledWith('upload:complete', expect.any(Object));
    expect(stateMocks.default.resetUploadProgress).toHaveBeenCalled();
    expect(service.isUploading).toBe(false);
  });

  it('handles upload failures and notifies errors', async () => {
    apiMocks.API.uploadFitFiles.mockRejectedValue(new Error('Network'));
    const service = new UploadService();

    await expect(service.uploadFiles([{ name: 'ride.fit', size: 100 }])).rejects.toThrow('Upload failed');
    expect(eventBusMocks.eventBus.emit).toHaveBeenCalledWith('upload:error', expect.any(Error));
    expect(notifyMocks.notify).toHaveBeenCalled();
  });

  it('waits for cache rebuild status', async () => {
    const target = Date.now();
    apiMocks.API.getCacheStatus.mockResolvedValue({
      cache_built_after_import: new Date(target + 1000).toISOString()
    });

    const service = new UploadService();
    const rebuilt = await service.waitForCacheRebuild(target, { timeoutMs: 10, intervalMs: 1 });
    expect(rebuilt).toBe(true);

    const timeoutResult = await service.waitForCacheRebuild(target, { timeoutMs: 0, intervalMs: 1 });
    expect(timeoutResult).toBe(false);
  });

  it('triggers post import refresh on completion', async () => {
    const service = new UploadService();
    const spy = vi.spyOn(service, 'postImportRefresh').mockResolvedValue();

    service.handleUploadComplete({
      results: [{ success: true }],
      cache_rebuild_triggered: true
    });

    expect(spy).toHaveBeenCalledWith(1);
  });
});
