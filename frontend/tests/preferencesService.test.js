import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDashboardPreferences,
  saveDashboardPreferences,
  getDashboardPresets,
  applyDashboardPreset
} from '../static/js/services/preferences-service.js';

describe('preferences-service', () => {
  beforeEach(() => {
    localStorage.getItem.mockReset();
    localStorage.setItem.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns defaults when storage is empty', () => {
    localStorage.getItem.mockReturnValue(null);

    const prefs = getDashboardPreferences(['hero', 'quick-stats']);

    expect(prefs.preset).toBe('athlete');
    expect(prefs.order).toEqual(expect.arrayContaining(['hero', 'quick-stats']));
  });

  it('saves preferences to storage', () => {
    localStorage.getItem.mockReturnValue('{}');

    saveDashboardPreferences({
      preset: 'coach',
      order: ['hero'],
      hidden: ['insights']
    });

    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it('applies presets', () => {
    const preset = applyDashboardPreset('data-geek', ['hero']);

    expect(preset.preset).toBe('data-geek');
    expect(preset.order).toContain('hero');
  });

  it('returns presets map', () => {
    const presets = getDashboardPresets();
    expect(presets.athlete).toBeDefined();
  });
});
