import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Router } from '../static/js/core/router.js';
import { eventBus, EVENTS } from '../static/js/core/eventBus.js';
import { state } from '../static/js/core/state.js';

describe('Router', () => {
  let router;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="page-title"></div>
      <div id="page-content"></div>
      <a class="nav-item" data-page="overview"></a>
      <a class="nav-item" data-page="settings"></a>
    `;
    state.reset();
    router = new Router();
  });

  afterEach(() => {
    eventBus.clear();
    vi.restoreAllMocks();
  });

  it('parses pages with ids and query strings', () => {
    const parsed = router.parsePage('activity/123?foo=bar');
    expect(parsed.pageName).toBe('activity');
    expect(parsed.params.id).toBe('123');
    expect(parsed.params.query.foo).toBe('bar');
  });

  it('loads registered page modules and updates UI', async () => {
    const loadSpy = vi.fn();
    const onShowSpy = vi.fn();

    router.registerPage('overview', { load: loadSpy, onShow: onShowSpy });

    await router.navigateTo('overview');

    expect(loadSpy).toHaveBeenCalled();
    expect(onShowSpy).toHaveBeenCalled();
    expect(state.getCurrentPage()).toBe('overview');
    expect(document.querySelector('[data-page="overview"]').classList.contains('active')).toBe(true);
    expect(document.getElementById('page-title').textContent).toBe('Dashboard');
  });

  it('calls onUnload when navigating away', async () => {
    const unloadSpy = vi.fn();
    router.registerPage('overview', { load: vi.fn(), onUnload: unloadSpy });
    router.registerPage('settings', { load: vi.fn() });

    await router.navigateTo('overview');
    await router.navigateTo('settings');

    expect(unloadSpy).toHaveBeenCalled();
  });

  it('prevents parallel navigations', async () => {
    const loadSpy = vi.fn(() => new Promise(resolve => setTimeout(resolve, 50)));
    router.registerPage('overview', { load: loadSpy });

    const first = router.navigateTo('overview');
    const second = router.navigateTo('overview');

    await Promise.all([first, second]);

    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('emits events when navigation succeeds', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit');
    router.registerPage('overview', { load: vi.fn() });

    await router.navigateTo('overview');

    expect(emitSpy).toHaveBeenCalledWith(EVENTS.PAGE_LOAD, 'overview');
  });
});
