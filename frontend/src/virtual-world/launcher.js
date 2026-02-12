/**
 * Virtual World Launcher
 *
 * Helper to launch and communicate with the Virtual World window
 * from the Live Training App.
 */

import { DataBridgeSender } from './bridge.js';

class VirtualWorldLauncher {
  constructor() {
    this.window = null;
    this.bridge = null;
    this.isOpen = false;
    this.checkInterval = null;
  }

  /**
   * Open the virtual world in a new window
   * @param {Object} options - Launch options
   * @param {boolean} options.fullscreen - Whether to request fullscreen
   * @returns {Promise<boolean>} - Whether the window opened successfully
   */
  open(options = {}) {
    return new Promise((resolve) => {
      // Close existing window if open
      if (this.window && !this.window.closed) {
        this.window.focus();
        resolve(true);
        return;
      }

      // Calculate window size (16:9 layout, near full screen)
      const maxWidth = window.screen.availWidth - 80;
      const maxHeight = window.screen.availHeight - 80;
      const targetAspect = 16 / 9;
      let width = Math.min(1920, maxWidth);
      let height = Math.round(width / targetAspect);
      if (height > maxHeight) {
        height = Math.min(1080, maxHeight);
        width = Math.round(height * targetAspect);
      }
      const left = (window.screen.availWidth - width) / 2;
      const top = (window.screen.availHeight - height) / 2;

      // Open new window
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

      this.window = window.open('/virtual-ride.html', 'VirtualRide', features);

      if (!this.window) {
        console.error('Failed to open Virtual World window (popup blocked?)');
        resolve(false);
        return;
      }

      // Try to maximize to the computed bounds
      try {
        this.window.moveTo(Math.max(0, left), Math.max(0, top));
        this.window.resizeTo(width, height);
      } catch (error) {
        console.warn('Unable to resize Virtual World window:', error);
      }

      // Initialize bridge
      if (!this.bridge) {
        this.bridge = new DataBridgeSender();
        this.bridge.connect();
      }

      this.isOpen = true;

      // Monitor window state
      this.checkInterval = setInterval(() => {
        if (this.window && this.window.closed) {
          this.handleWindowClosed();
        }
      }, 1000);

      // Wait for window to be ready
      this.bridge.onVirtualWorldReady = () => {
        console.log('Virtual World window is ready');
        resolve(true);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.bridge.virtualWorldReady) {
          console.warn('Virtual World did not signal ready in time');
          resolve(true); // Still consider it open
        }
      }, 10000);
    });
  }

  /**
   * Close the virtual world window
   */
  close() {
    if (this.window && !this.window.closed) {
      this.window.close();
    }
    this.handleWindowClosed();
  }

  handleWindowClosed() {
    this.isOpen = false;
    this.window = null;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Send live training data to the virtual world
   */
  sendLiveData(data) {
    if (this.bridge && this.isOpen) {
      this.bridge.sendLiveData(data);
    }
  }

  /**
   * Notify session start
   */
  notifySessionStart(data = {}) {
    if (this.bridge && this.isOpen) {
      this.bridge.sendSessionStart(data);
    }
  }

  /**
   * Notify session pause
   */
  notifySessionPause(data = {}) {
    if (this.bridge && this.isOpen) {
      this.bridge.sendSessionPause(data);
    }
  }

  /**
   * Notify session stop
   */
  notifySessionStop(data = {}) {
    if (this.bridge && this.isOpen) {
      this.bridge.sendSessionStop(data);
    }
  }

  /**
   * Send workout update (steps, current step, etc.)
   */
  sendWorkoutUpdate(data) {
    if (this.bridge && this.isOpen) {
      this.bridge.sendWorkoutUpdate(data);
    }
  }

  /**
   * Change the route
   */
  changeRoute(routeId) {
    if (this.bridge && this.isOpen) {
      this.bridge.sendRouteChange(routeId);
    }
  }

  /**
   * Check if virtual world is currently open
   */
  isWindowOpen() {
    return this.isOpen && this.window && !this.window.closed;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.close();
    if (this.bridge) {
      this.bridge.disconnect();
      this.bridge = null;
    }
  }
}

// Singleton instance
let launcherInstance = null;

export const getVirtualWorldLauncher = () => {
  if (!launcherInstance) {
    launcherInstance = new VirtualWorldLauncher();
  }
  return launcherInstance;
};

export { VirtualWorldLauncher };
