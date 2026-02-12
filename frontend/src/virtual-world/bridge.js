/**
 * Data Bridge
 *
 * Handles communication between the main Live Training app and
 * the Virtual World window using BroadcastChannel API.
 */

const CHANNEL_NAME = 'virtual-ride-data';

export class DataBridge {
  constructor() {
    this.channel = null;
    this.onData = null;
    this.onRouteChange = null;
    this.onConnect = null;
    this.onDisconnect = null;
    this.isConnected = false;
    this.lastHeartbeat = 0;
    this.heartbeatInterval = null;
  }

  connect() {
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);

      this.channel.onmessage = (event) => {
        const { type, data } = event.data || {};

        switch (type) {
          case 'heartbeat':
            this.lastHeartbeat = Date.now();
            if (!this.isConnected) {
              this.isConnected = true;
              if (this.onConnect) this.onConnect();
            }
            break;

          case 'live-data':
            if (this.onData) this.onData(data);
            break;

          case 'session-start':
            console.log('Session started');
            if (this.onData) this.onData({ sessionState: 'running', ...data });
            break;

          case 'session-pause':
            console.log('Session paused');
            if (this.onData) this.onData({ sessionState: 'paused', ...data });
            break;

          case 'session-stop':
            console.log('Session stopped');
            if (this.onData) this.onData({ sessionState: 'stopped', ...data });
            break;

          case 'workout-update':
            if (this.onData) this.onData(data);
            break;

          case 'route-change':
            console.log('Route changed:', data);
            if (this.onRouteChange) this.onRouteChange(data);
            break;

          default:
            console.log('Unknown message type:', type);
        }
      };

      this.channel.onmessageerror = (error) => {
        console.error('BroadcastChannel error:', error);
      };

      // Check for connection timeout
      this.heartbeatInterval = setInterval(() => {
        if (this.isConnected && Date.now() - this.lastHeartbeat > 5000) {
          this.isConnected = false;
          if (this.onDisconnect) this.onDisconnect();
        }
      }, 2000);

      // Send ready message
      this.channel.postMessage({ type: 'virtual-world-ready' });

      console.log('DataBridge connected to channel:', CHANNEL_NAME);
    } catch (error) {
      console.error('Failed to create BroadcastChannel:', error);
    }
  }

  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    this.isConnected = false;
  }

  // Send message back to main app (for future features like route selection)
  send(type, data = {}) {
    if (this.channel) {
      this.channel.postMessage({ type, data });
    }
  }
}

/**
 * DataBridgeSender - Used by the main Live Training app
 * to send data to the Virtual World window
 */
export class DataBridgeSender {
  constructor() {
    this.channel = null;
    this.heartbeatInterval = null;
    this.virtualWorldReady = false;
    this.onVirtualWorldReady = null;
  }

  connect() {
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);

      this.channel.onmessage = (event) => {
        const { type } = event.data || {};

        if (type === 'virtual-world-ready') {
          this.virtualWorldReady = true;
          console.log('Virtual World is ready');
          if (this.onVirtualWorldReady) this.onVirtualWorldReady();
        }
      };

      // Send heartbeat every 2 seconds
      this.heartbeatInterval = setInterval(() => {
        this.send('heartbeat', { timestamp: Date.now() });
      }, 2000);

      console.log('DataBridgeSender connected');
    } catch (error) {
      console.error('Failed to create BroadcastChannel:', error);
    }
  }

  disconnect() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  send(type, data = {}) {
    if (this.channel) {
      this.channel.postMessage({ type, data });
    }
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

  sendSessionStop(data = {}) {
    this.send('session-stop', data);
  }

  sendWorkoutUpdate(data) {
    this.send('workout-update', data);
  }

  sendRouteChange(routeId) {
    this.send('route-change', { routeId });
  }
}
