import { DataBridgeSender } from './bridge.js';

const RUNTIME_HOSTS = {
  three: '/virtual-ride.html',
  unity: '/virtual-ride-unity.html'
};

const THREE_READY_TIMEOUT_MS = 8000;
const DEFAULT_UNITY_READY_TIMEOUT_MS = 120000;
const DEFAULT_EMBED_CONTAINER_SELECTOR = '#lt-virtual-world-host';
const PRESENTATION_MODES = {
  popup: 'popup',
  embedded: 'embedded'
};

const normalizeRuntime = (value) => (value === 'unity' ? 'unity' : 'three');
const normalizePresentation = (value) => (value === PRESENTATION_MODES.embedded
  ? PRESENTATION_MODES.embedded
  : PRESENTATION_MODES.popup);

export const parseUnityRouteScope = (scopeValue) => {
  if (Array.isArray(scopeValue)) {
    return scopeValue
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }

  if (typeof scopeValue === 'string') {
    const trimmed = scopeValue.trim();
    if (!trimmed) return ['*'];
    if (trimmed.toLowerCase() === 'all') return ['*'];
    return [trimmed];
  }

  return ['*'];
};

export const resolveUnityManifestUrl = (env = (typeof import.meta !== 'undefined' ? import.meta.env : undefined)) => {
  const explicit = env?.VITE_UNITY_MANIFEST_URL;
  if (typeof explicit === 'string' && explicit.trim()) {
    return explicit.trim();
  }
  return '/unity/current.json';
};

export const resolveRuntimeCandidate = ({ requestedRuntime = 'unity', routeId = 'route-valley', flags = {} } = {}) => {
  const runtime = normalizeRuntime(requestedRuntime);

  if (flags.forceThreeRuntime === true) return 'three';

  const unityRuntimeEnabled = flags.unityRuntimeEnabled !== false;
  const unityMountainsEnabled = flags.unityMountainsEnabled !== false;
  const unityOnlyMode = flags.unityOnlyMode !== false;
  const unityRouteScope = parseUnityRouteScope(flags.unityRouteScope ?? ['*']);
  const routeAllowed = unityRouteScope.includes('*') || unityRouteScope.includes(routeId);

  if (!unityRuntimeEnabled || !unityMountainsEnabled) return 'three';
  if (unityOnlyMode) return 'unity';

  if (runtime === 'unity' && routeAllowed) return 'unity';
  return 'three';
};

export class VirtualWorldLauncher {
  constructor({ windowApi = window, bridgeFactory = () => new DataBridgeSender() } = {}) {
    this.windowApi = windowApi;
    this.bridgeFactory = bridgeFactory;

    this.window = null;
    this.iframe = null;
    this.iframeContainer = null;
    this.bridge = null;
    this.checkInterval = null;
    this.readyTimer = null;
    this.pendingReady = null;
    this.presentation = PRESENTATION_MODES.popup;

    this.activeRuntime = 'three';
    this.requestedRuntime = 'three';
    this.lastLaunchReason = 'idle';
    this.isLaunching = false;
  }

  getUnityBehaviorFlags() {
    const flags = this.windowApi?.__VW_FLAGS || {};
    const readyTimeoutMs = Number(flags.unityReadyTimeoutMs);
    const fallbackDelayMs = Number(flags.unityFallbackDelayMs);
    const unityOnlyMode = flags.unityOnlyMode !== false;

    return {
      autoFallback: unityOnlyMode ? false : (flags.unityAutoFallback !== false),
      readyTimeoutMs: Number.isFinite(readyTimeoutMs) && readyTimeoutMs > 0
        ? readyTimeoutMs
        : DEFAULT_UNITY_READY_TIMEOUT_MS,
      fallbackDelayMs: Number.isFinite(fallbackDelayMs) && fallbackDelayMs >= 0 ? fallbackDelayMs : 250,
      unityOnlyMode,
      ...flags
    };
  }

  isWindowOpen() {
    if (this.presentation === PRESENTATION_MODES.embedded) {
      return Boolean(this.iframe && this.iframe.isConnected);
    }
    return !!(this.window && !this.window.closed);
  }

  hasPopupOpen() {
    return Boolean(this.window && !this.window.closed);
  }

  hasEmbeddedOpen() {
    return Boolean(this.iframe && this.iframe.isConnected);
  }

  resolveDocument() {
    return this.windowApi?.document || (typeof document !== 'undefined' ? document : null);
  }

  resolveEmbedContainer(containerSelector) {
    const doc = this.resolveDocument();
    if (!doc) return null;

    if (containerSelector && typeof containerSelector === 'object' && containerSelector.nodeType === 1) {
      return containerSelector;
    }

    const selector = typeof containerSelector === 'string' && containerSelector.trim()
      ? containerSelector.trim()
      : DEFAULT_EMBED_CONTAINER_SELECTOR;
    return doc.querySelector(selector);
  }

  connectBridge() {
    if (this.bridge) return;

    this.bridge = this.bridgeFactory();
    this.bridge.connect();
    this.bridge.onRuntimeEvent = (event) => this.handleRuntimeEvent(event);
  }

  handleRuntimeEvent(event) {
    if (!this.pendingReady) return;

    const type = event?.type;
    const data = event?.data || {};
    const runtime = normalizeRuntime(data?.runtime === 'unity' ? 'unity' : 'three');

    if (runtime !== this.activeRuntime) return;

    if (type === 'virtual-world-ready') {
      this.resolvePendingReady({ ready: true, reason: 'ready' });
      return;
    }

    if (type === 'virtual-world-failed') {
      const detail = typeof data?.reason === 'string' && data.reason.trim()
        ? data.reason.trim()
        : 'runtime-failed';
      this.resolvePendingReady({ ready: false, reason: `unity-failed:${detail}` });
    }
  }

  resolvePendingReady(result) {
    if (!this.pendingReady) return;

    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }

    const { resolve } = this.pendingReady;
    this.pendingReady = null;
    resolve(result);
  }

  waitForReady(timeoutMs, timeoutReason) {
    if (this.pendingReady) {
      this.resolvePendingReady({ ready: false, reason: 'launch-interrupted' });
    }

    return new Promise((resolve) => {
      this.pendingReady = { resolve };
      this.readyTimer = setTimeout(() => {
        this.resolvePendingReady({ ready: false, reason: timeoutReason });
      }, timeoutMs);
    });
  }

  buildRuntimeUrl(runtime) {
    if (runtime === 'unity') {
      const manifestUrl = resolveUnityManifestUrl();
      const search = new URLSearchParams({ manifest: manifestUrl });
      return `${RUNTIME_HOSTS.unity}?${search.toString()}`;
    }

    return RUNTIME_HOSTS.three;
  }

  openPopup(runtime) {
    const width = Math.min(1920, this.windowApi.screen.availWidth - 80);
    const height = Math.min(1080, this.windowApi.screen.availHeight - 80);
    const left = Math.max(0, Math.round((this.windowApi.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((this.windowApi.screen.availHeight - height) / 2));

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
      'resizable=yes'
    ].join(',');

    const runtimeUrl = this.buildRuntimeUrl(runtime);
    this.window = this.windowApi.open(runtimeUrl, 'VirtualRide', features);

    if (this.window) {
      try {
        this.window.focus();
      } catch (error) {
        // Ignore browser-specific focus errors.
      }
    }

    return this.window;
  }

  openEmbedded(runtime, containerSelector) {
    const container = this.resolveEmbedContainer(containerSelector);
    if (!container) return null;

    const doc = this.resolveDocument();
    if (!doc) return null;

    const iframe = doc.createElement('iframe');
    iframe.setAttribute('title', 'Virtual World Runtime');
    iframe.setAttribute('allow', 'fullscreen; autoplay');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('loading', 'eager');
    iframe.src = this.buildRuntimeUrl(runtime);
    iframe.className = 'lt-virtual-world-host__frame';

    container.replaceChildren(iframe);
    this.iframe = iframe;
    this.iframeContainer = container;

    return iframe;
  }

  redirectCurrentTargetTo(runtime, containerSelector) {
    if (this.presentation === PRESENTATION_MODES.embedded) {
      if (!this.iframe || !this.iframe.isConnected) {
        const iframe = this.openEmbedded(runtime, containerSelector);
        if (!iframe) return false;
        this.activeRuntime = runtime;
        return true;
      }

      this.iframe.src = this.buildRuntimeUrl(runtime);
      this.activeRuntime = runtime;
      return true;
    }

    if (!this.window || this.window.closed) return false;

    try {
      this.window.location.replace(this.buildRuntimeUrl(runtime));
      this.activeRuntime = runtime;
      return true;
    } catch (error) {
      return false;
    }
  }

  async open(options = {}) {
    if (this.isLaunching) {
      return {
        opened: false,
        runtime: this.activeRuntime,
        reason: 'launch-in-progress'
      };
    }

    this.connectBridge();

    const requestedRuntime = normalizeRuntime(options.runtime || 'unity');
    const routeId = options.routeId || 'route-valley';
    const flags = this.getUnityBehaviorFlags();
    const allowFallback = options.allowFallback !== false && flags.autoFallback;
    const requestedPresentation = normalizePresentation(
      options.presentation ?? flags.virtualWorldPresentation ?? PRESENTATION_MODES.popup
    );
    const containerSelector = options.containerSelector || DEFAULT_EMBED_CONTAINER_SELECTOR;

    this.requestedRuntime = requestedRuntime;
    this.activeRuntime = resolveRuntimeCandidate({
      requestedRuntime,
      routeId,
      flags
    });

    const popupOpen = this.hasPopupOpen();
    const embeddedOpen = this.hasEmbeddedOpen();
    const requestedAlreadyOpen = requestedPresentation === PRESENTATION_MODES.popup
      ? popupOpen
      : embeddedOpen;

    if (requestedAlreadyOpen) {
      this.presentation = requestedPresentation;
      if (requestedPresentation === PRESENTATION_MODES.popup) {
        try {
          this.window.focus();
        } catch (error) {
          // noop
        }
      }

      return {
        opened: true,
        runtime: this.activeRuntime,
        reason: this.lastLaunchReason
      };
    }

    if (popupOpen || embeddedOpen) {
      this.close();
    }

    this.presentation = requestedPresentation;
    this.isLaunching = true;

    try {
      if (this.presentation === PRESENTATION_MODES.embedded) {
        const iframe = this.openEmbedded(this.activeRuntime, containerSelector);
        if (!iframe) {
          this.lastLaunchReason = 'embed-target-missing';
          return {
            opened: false,
            runtime: this.activeRuntime,
            reason: this.lastLaunchReason
          };
        }
      } else {
        const popup = this.openPopup(this.activeRuntime);
        if (!popup) {
          this.lastLaunchReason = 'popup-blocked';
          return {
            opened: false,
            runtime: this.activeRuntime,
            reason: this.lastLaunchReason
          };
        }
        this.startWindowMonitor();
      }

      const timeoutMs = this.activeRuntime === 'unity'
        ? flags.readyTimeoutMs
        : THREE_READY_TIMEOUT_MS;

      let readyResult = await this.waitForReady(
        timeoutMs,
        this.activeRuntime === 'unity' ? 'unity-timeout' : 'ready-timeout'
      );

      if (!readyResult.ready && this.activeRuntime === 'unity' && allowFallback) {
        this.lastLaunchReason = readyResult.reason;

        await new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(flags.fallbackDelayMs) || 0)));

        const redirected = this.redirectCurrentTargetTo('three', containerSelector);
        if (!redirected) {
          if (this.presentation === PRESENTATION_MODES.embedded) {
            const iframe = this.openEmbedded('three', containerSelector);
            if (!iframe) {
              this.lastLaunchReason = 'embed-target-missing';
              return {
                opened: false,
                runtime: this.activeRuntime,
                reason: this.lastLaunchReason
              };
            }
          } else {
            this.openPopup('three');
          }
        }

        readyResult = await this.waitForReady(THREE_READY_TIMEOUT_MS, 'three-timeout');

        if (!readyResult.ready) {
          this.lastLaunchReason = readyResult.reason;
          return {
            opened: false,
            runtime: this.activeRuntime,
            reason: this.lastLaunchReason
          };
        }
      }

      if (!readyResult.ready) {
        this.lastLaunchReason = readyResult.reason;
        return {
          opened: false,
          runtime: this.activeRuntime,
          reason: this.lastLaunchReason
        };
      }

      this.lastLaunchReason = 'ready';
      this.sendRouteChange(routeId);

      return {
        opened: true,
        runtime: this.activeRuntime,
        reason: this.lastLaunchReason
      };
    } finally {
      this.isLaunching = false;
    }
  }

  close() {
    if (this.iframeContainer) {
      this.iframeContainer.replaceChildren();
    }
    this.iframe = null;
    this.iframeContainer = null;

    if (this.window && !this.window.closed) {
      try {
        this.window.close();
      } catch (error) {
        // noop
      }
    }

    this.window = null;
    this.stopWindowMonitor();

    if (this.pendingReady) {
      this.resolvePendingReady({ ready: false, reason: 'window-closed' });
    }
  }

  destroy() {
    this.close();
    if (this.bridge) {
      this.bridge.disconnect();
      this.bridge = null;
    }
  }

  startWindowMonitor() {
    this.stopWindowMonitor();

    this.checkInterval = setInterval(() => {
      if (this.window && this.window.closed) {
        this.window = null;
        this.stopWindowMonitor();
      }
    }, 1000);
  }

  stopWindowMonitor() {
    if (!this.checkInterval) return;
    clearInterval(this.checkInterval);
    this.checkInterval = null;
  }

  sendLiveData(data) {
    this.bridge?.sendLiveData(data);
  }

  sendSessionStart(data = {}) {
    this.bridge?.sendSessionStart(data);
  }

  sendSessionPause(data = {}) {
    this.bridge?.sendSessionPause(data);
  }

  sendSessionResume(data = {}) {
    this.bridge?.sendSessionResume(data);
  }

  sendSessionStop(data = {}) {
    this.bridge?.sendSessionStop(data);
  }

  sendRouteChange(routeId) {
    if (!routeId) return;
    this.bridge?.sendRouteChange(routeId);
  }

  setControlHandler(handler) {
    if (!this.bridge) this.connectBridge();
    this.bridge.onControl = typeof handler === 'function' ? handler : null;
  }

  setRouteChangeHandler(handler) {
    if (!this.bridge) this.connectBridge();
    this.bridge.onRouteChange = typeof handler === 'function' ? handler : null;
  }
}

let launcherInstance = null;

export const getVirtualWorldLauncher = () => {
  if (!launcherInstance) {
    launcherInstance = new VirtualWorldLauncher();
  }
  return launcherInstance;
};

export { normalizeRuntime };
