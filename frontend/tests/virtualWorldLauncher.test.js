import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VirtualWorldLauncher,
  resolveRuntimeCandidate,
  resolveUnityManifestUrl,
} from '../src/virtual-world/launcher.js';

class BridgeStub {
  constructor() {
    this.onRuntimeEvent = null;
    this.onControl = null;
    this.onRouteChange = null;
    this.connect = vi.fn();
    this.disconnect = vi.fn();
    this.sendLiveData = vi.fn();
    this.sendSessionStart = vi.fn();
    this.sendSessionPause = vi.fn();
    this.sendSessionResume = vi.fn();
    this.sendSessionStop = vi.fn();
    this.sendRouteChange = vi.fn();
  }
}

const createWindowStub = (flags = {}) => {
  const popup = {
    closed: false,
    focus: vi.fn(),
    close: vi.fn(function closeWindow() {
      this.closed = true;
    }),
    location: {
      replace: vi.fn(),
    },
  };

  return {
    popup,
    api: {
      __VW_FLAGS: flags,
      document: globalThis.document,
      screen: {
        availWidth: 1920,
        availHeight: 1080,
      },
      open: vi.fn(() => popup),
    },
  };
};

describe('virtual world runtime resolution', () => {
  it('resolves to unity when enabled and route allowed', () => {
    const runtime = resolveRuntimeCandidate({
      requestedRuntime: 'unity',
      routeId: 'hilly-route',
      flags: {
        unityRuntimeEnabled: true,
        unityMountainsEnabled: true,
        unityOnlyMode: false,
        unityRouteScope: ['hilly-route'],
      },
    });

    expect(runtime).toBe('unity');
  });

  it('falls back to three when unity route is not allowed', () => {
    const runtime = resolveRuntimeCandidate({
      requestedRuntime: 'unity',
      routeId: 'hilly-route',
      flags: {
        unityRuntimeEnabled: true,
        unityMountainsEnabled: true,
        unityOnlyMode: false,
        unityRouteScope: ['flat-loop'],
      },
    });

    expect(runtime).toBe('three');
  });

  it('resolves manifest URL from env override', () => {
    const url = resolveUnityManifestUrl({
      VITE_UNITY_MANIFEST_URL: 'https://cdn.example.com/runtime/current.json'
    });

    expect(url).toBe('https://cdn.example.com/runtime/current.json');
  });
});

describe('VirtualWorldLauncher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens unity runtime and resolves on ready event', async () => {
    const { api } = createWindowStub({
      unityRuntimeEnabled: true,
      unityMountainsEnabled: true,
      unityOnlyMode: false,
      unityRouteScope: ['*'],
      unityReadyTimeoutMs: 1000,
      unityAutoFallback: true,
    });

    const bridge = new BridgeStub();
    const launcher = new VirtualWorldLauncher({
      windowApi: api,
      bridgeFactory: () => bridge,
    });

    const openPromise = launcher.open({ runtime: 'unity', routeId: 'hilly-route' });

    bridge.onRuntimeEvent({ type: 'virtual-world-ready', data: { runtime: 'unity' } });
    vi.runOnlyPendingTimers();

    const result = await openPromise;

    expect(result.opened).toBe(true);
    expect(result.runtime).toBe('unity');
    expect(api.open).toHaveBeenCalledTimes(1);
    expect(launcher.activeRuntime).toBe('unity');
    expect(bridge.sendRouteChange).toHaveBeenCalledWith('hilly-route');
  });

  it('falls back to three runtime when unity times out', async () => {
    const { api } = createWindowStub({
      unityRuntimeEnabled: true,
      unityMountainsEnabled: true,
      unityOnlyMode: false,
      unityRouteScope: ['*'],
      unityReadyTimeoutMs: 10,
      unityAutoFallback: true,
      unityFallbackDelayMs: 0,
    });

    const bridge = new BridgeStub();
    const launcher = new VirtualWorldLauncher({
      windowApi: api,
      bridgeFactory: () => bridge,
    });

    const openPromise = launcher.open({ runtime: 'unity', routeId: 'hilly-route' });

    await vi.advanceTimersByTimeAsync(12);
    await vi.advanceTimersByTimeAsync(0);
    expect(launcher.activeRuntime).toBe('three');
    bridge.onRuntimeEvent({ type: 'virtual-world-ready', data: { runtime: 'three' } });

    const result = await openPromise;

    expect(result.opened).toBe(true);
    expect(launcher.activeRuntime).toBe('three');
    expect(api.open).toHaveBeenCalledTimes(1);
    expect(api.open.mock.calls[0][0]).toContain('/virtual-ride-unity.html');
    expect(api.open.mock.calls[0][1]).toBe('VirtualRide');
    expect(api.open.mock.calls[0][2]).toContain('width=');
    expect(api.open.mock.calls[0][2]).toContain('height=');
    expect(launcher.window.location.replace).toHaveBeenCalledWith('/virtual-ride.html');
  });

  it('mounts runtime into embedded host without popup', async () => {
    const { api } = createWindowStub({
      unityRuntimeEnabled: true,
      unityMountainsEnabled: true,
      unityOnlyMode: false,
      unityRouteScope: ['*'],
      unityReadyTimeoutMs: 1000,
      unityAutoFallback: false,
    });

    const host = document.createElement('div');
    host.id = 'lt-virtual-world-host';
    document.body.appendChild(host);

    const bridge = new BridgeStub();
    const launcher = new VirtualWorldLauncher({
      windowApi: api,
      bridgeFactory: () => bridge,
    });

    const openPromise = launcher.open({
      runtime: 'unity',
      routeId: 'hilly-route',
      presentation: 'embedded',
      containerSelector: '#lt-virtual-world-host'
    });

    const iframe = host.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain('/virtual-ride-unity.html');
    expect(api.open).not.toHaveBeenCalled();

    bridge.onRuntimeEvent({ type: 'virtual-world-ready', data: { runtime: 'unity' } });
    vi.runOnlyPendingTimers();

    const result = await openPromise;
    expect(result.opened).toBe(true);
    expect(result.runtime).toBe('unity');

    launcher.close();
    expect(host.querySelector('iframe')).toBeNull();
    host.remove();
  });
});
