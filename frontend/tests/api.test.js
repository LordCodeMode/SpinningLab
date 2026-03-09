import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { API, AuthAPI, AnalysisAPI } from '../src/lib/core/api.js';

const createResponse = ({
  status = 200,
  ok = true,
  jsonData = null,
  textData = '',
  contentType = 'application/json'
} = {}) => ({
  status,
  ok,
  statusText: ok ? 'OK' : 'Error',
  headers: {
    get: (key) => (key?.toLowerCase() === 'content-type' ? contentType : null)
  },
  json: async () => jsonData,
  text: async () => textData
});

describe('API client', () => {
  beforeEach(() => {
    fetch.mockReset();
    document.cookie = 'td_csrf=test-csrf-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps credentials and query params on API requests', async () => {
    fetch.mockResolvedValue(createResponse({ jsonData: { ok: true } }));

    await API.getActivities({ limit: 2, skip: 1 });

    const [url, config] = fetch.mock.calls[0];
    expect(url).toContain('/api/activities/');
    expect(url).toContain('limit=2');
    expect(config.credentials).toBe('include');
  });

  it('tries one refresh cycle after a 401', async () => {
    fetch
      .mockResolvedValueOnce(createResponse({
        status: 401,
        ok: false,
        jsonData: { detail: 'Session expired' }
      }))
      .mockResolvedValueOnce(createResponse({ jsonData: { message: 'Session refreshed' } }))
      .mockResolvedValueOnce(createResponse({ jsonData: { ok: true } }));

    const result = await API.getSettings();

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toContain('/api/auth/refresh');
  });

  it('handles JSON error responses', async () => {
    fetch.mockResolvedValue(createResponse({
      status: 400,
      ok: false,
      jsonData: { detail: 'Bad request' }
    }));

    await expect(API.getSettings()).rejects.toThrow('Bad request');
  });

  it('returns text responses when not JSON', async () => {
    fetch.mockResolvedValue(createResponse({
      contentType: 'text/plain',
      textData: 'pong'
    }));

    const res = await API.getCacheStatus();
    expect(res).toBe('pong');
  });

  it('submits login with FormData', async () => {
    fetch.mockResolvedValue(createResponse({ jsonData: { message: 'Authenticated successfully' } }));

    await AuthAPI.login('user', 'pass');

    const [, config] = fetch.mock.calls[0];
    expect(config.body).toBeInstanceOf(FormData);
    expect(config.headers['Content-Type']).toBeUndefined();
  });

  it('adds CSRF header to mutating JSON requests', async () => {
    fetch.mockResolvedValue(createResponse({ jsonData: { success: true } }));

    await API.rebuildCache();

    const [, config] = fetch.mock.calls[0];
    expect(config.headers['X-CSRF-Token']).toBe('test-csrf-token');
  });

  it('transforms training load responses', async () => {
    fetch.mockResolvedValue(createResponse({
      jsonData: [{ ctl: 10, atl: 12, tsb: -2 }]
    }));

    const data = await AnalysisAPI.getTrainingLoad({ days: 7 });
    expect(data.current.ctl).toBe(10);
    expect(data.daily.length).toBe(1);
  });

  it('normalizes efficiency responses', async () => {
    fetch.mockResolvedValue(createResponse({
      jsonData: {
        efficiency_data: [{
          start_time: '2025-01-01T00:00:00Z',
          ef: 1.5,
          normalized_power: 250,
          avg_heart_rate: 140,
          intensity_factor: 0.9
        }]
      }
    }));

    const data = await AnalysisAPI.getEfficiency({ days: 30 });
    expect(data.timeseries).toHaveLength(1);
    expect(data.avg_ef).toBeCloseTo(1.5);
  });
});
