const CHANNEL_NAME = 'virtual-ride-data';

const safeClone = (value) => {
  try {
    return structuredClone(value);
  } catch (error) {
    return value;
  }
};

export const createBridgeEnvelope = (type, data = {}) => {
  let dataJson = '{}';
  try {
    dataJson = JSON.stringify(data ?? {});
  } catch (error) {
    dataJson = '{}';
  }

  return {
    type: String(type || ''),
    dataJson
  };
};

/**
 * BroadcastChannel sender/receiver used by LiveTraining and runtime windows.
 */
export class DataBridgeSender {
  constructor(channelName = CHANNEL_NAME) {
    this.channelName = channelName;
    this.channel = null;
    this.onRuntimeEvent = null;
    this.onControl = null;
    this.onRouteChange = null;
  }

  connect() {
    if (this.channel) return;

    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (event) => {
      const payload = event?.data || {};
      const type = payload?.type;
      const data = payload?.data ?? {};

      if (type === 'virtual-world-ready' || type === 'virtual-world-failed') {
        if (typeof this.onRuntimeEvent === 'function') {
          this.onRuntimeEvent({ type, data: safeClone(data) });
        }
        return;
      }

      if (type === 'control' && typeof this.onControl === 'function') {
        this.onControl(data?.action || null, safeClone(data));
        return;
      }

      if ((type === 'route-change' || type === 'route-change-request') && typeof this.onRouteChange === 'function') {
        this.onRouteChange(data?.routeId || null, safeClone(data));
      }
    };
  }

  disconnect() {
    if (!this.channel) return;
    this.channel.close();
    this.channel = null;
  }

  send(type, data = {}) {
    if (!this.channel) return;
    this.channel.postMessage({ type, data: safeClone(data) });
  }

  sendLiveData(data) {
    this.send('live-data', data);
  }

  sendSessionStart(data = {}) {
    this.send('session-start', data);
  }

  sendSessionPause(data = {}) {
    this.send('session-pause', data);
  }

  sendSessionResume(data = {}) {
    this.send('session-resume', data);
  }

  sendSessionStop(data = {}) {
    this.send('session-stop', data);
  }

  sendRouteChange(routeId) {
    this.send('route-change', { routeId });
  }
}

export { CHANNEL_NAME };
