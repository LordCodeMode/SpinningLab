/**
 * Virtual Ride - Main Entry Point
 *
 * Creates a Zwift-style 3D virtual cycling world that receives live training data
 * via BroadcastChannel from the main training app.
 */

import { VirtualWorld } from './VirtualWorld.js';
import { HUD } from './hud.js';
import { DataBridge } from './bridge.js';

class VirtualRideApp {
  constructor() {
    this.world = null;
    this.hud = null;
    this.bridge = null;
    this.isRunning = false;
    this.lastFrameTime = 0;
    this.lastDataAt = 0;
    this.lastElapsed = 0;
    this.lastDistance = 0;
    this.lastStepElapsed = 0;
    this.hasLiveDistance = false;
    this.hasLiveElapsed = false;
    this.hasLiveStepElapsed = false;
    this.hasReceivedData = false;
    this.routeEventState = null;
    this.routeEventExpiresAt = 0;
    this.demoSpeedKph = 24;
    this.visualTuning = {
      exposure: 1.25,
      lighting: 1.28,
      saturation: 1.18,
      haze: 0.72
    };

    // Current state
    this.state = {
      power: 0,
      cadence: 0,
      heartRate: 0,
      speed: 0,
      distance: 0,
      elapsed: 0,
      gradient: 0,
      altitude: 0,
      sceneryZone: 'flat',
      routeEvent: null,
      // Workout state
      sessionState: 'idle',
      currentStep: null,
      stepElapsed: 0,
      stepRemaining: 0,
      totalProgress: 0,
      workoutSteps: [],
      workoutSelected: false,
      workoutName: '',
      mode: 'erg' // 'erg' or 'sim'
    };
  }

  async init() {
    const container = document.getElementById('canvas-container');
    const hudContainer = document.getElementById('hud');
    const loadingEl = document.getElementById('loading');
    const statusEl = document.getElementById('connection-status');

    try {
      // Initialize 3D world
      this.world = new VirtualWorld(container);
      await this.world.init();
      this.world.setVisualTuning(this.visualTuning);

      // Initialize HUD
      this.hud = new HUD(hudContainer);
      this.hud.init();

      // Setup HUD control callbacks
      this.hud.onControl = (action) => this.handleControl(action);
      this.hud.onOptionChange = (option, value) => this.handleOption(option, value);
      this.hud.setLayout('standard');
      this.hud.setRouteOptions(this.world.getRoutes(), this.world.getCurrentRoute().id);
      this.hud.setElevationProfile(this.world.getElevationProfile());
      this.hud.setRouteMap(this.world.getRouteMap());

      // Initialize data bridge
      this.bridge = new DataBridge();
      this.bridge.onData = (data) => this.handleLiveData(data);
      this.bridge.onRouteChange = (data) => {
        if (data?.routeId) {
          this.handleOption('route', data.routeId);
        }
      };
      this.bridge.onConnect = () => {
        statusEl.textContent = 'Connected';
        statusEl.className = 'connected';
        setTimeout(() => {
          statusEl.style.opacity = '0';
        }, 2000);
      };
      this.bridge.onDisconnect = () => {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'disconnected';
        statusEl.style.opacity = '1';
      };
      this.bridge.connect();

      // Hide loading screen
      setTimeout(() => {
        loadingEl.classList.add('hidden');
      }, 500);

      // Start render loop
      this.isRunning = true;
      this.lastFrameTime = window.performance.now();
      this.animate();

      // Handle window resize
      window.addEventListener('resize', () => this.handleResize());

      // Handle keyboard shortcuts
      document.addEventListener('keydown', (e) => this.handleKeyboard(e));

      console.log('Virtual Ride initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Virtual Ride:', error);
      loadingEl.innerHTML = `
        <div style="color: #f87171; text-align: center;">
          <div style="font-size: 24px; margin-bottom: 16px;">Failed to Initialize</div>
          <div style="font-size: 14px; opacity: 0.7; max-width: 400px;">${error.message}</div>
          <div style="margin-top: 24px; font-size: 12px; opacity: 0.5;">
            Make sure Three.js is installed: npm install three
          </div>
        </div>
      `;
    }
  }

  handleLiveData(data) {
    const now = window.performance.now();
    this.lastDataAt = now;
    this.hasReceivedData = true;

    // Update state from live data
    if (data.power !== undefined) this.state.power = data.power;
    if (data.cadence !== undefined) this.state.cadence = data.cadence;
    if (data.heartRate !== undefined) this.state.heartRate = data.heartRate;
    if (data.speed !== undefined) this.state.speed = data.speed;
    if (data.distance !== undefined) {
      this.state.distance = data.distance;
      this.lastDistance = data.distance;
      this.hasLiveDistance = true;
    }
    if (data.elapsed !== undefined) {
      this.state.elapsed = data.elapsed;
      this.lastElapsed = data.elapsed;
      this.hasLiveElapsed = true;
    }
    if (data.sessionState !== undefined) this.state.sessionState = data.sessionState;
    if (data.currentStep !== undefined) this.state.currentStep = data.currentStep;
    if (data.stepElapsed !== undefined) {
      this.state.stepElapsed = data.stepElapsed;
      this.lastStepElapsed = data.stepElapsed;
      this.hasLiveStepElapsed = true;
    }
    if (data.stepRemaining !== undefined) this.state.stepRemaining = data.stepRemaining;
    if (data.totalProgress !== undefined) this.state.totalProgress = data.totalProgress;
    if (data.workoutSteps !== undefined) this.state.workoutSteps = data.workoutSteps;
    if (data.workoutSelected !== undefined) this.state.workoutSelected = data.workoutSelected;
    if (data.workoutName !== undefined) this.state.workoutName = data.workoutName;
    if (data.mode !== undefined) this.state.mode = data.mode;
  }

  handleControl(action) {
    console.log('Control action:', action);

    // Send control action back to main app
    if (this.bridge) {
      this.bridge.send('control', { action });
    }
  }

  handleKeyboard(e) {
    // Fullscreen toggle
    if (e.key === 'f' || e.key === 'F') {
      this.toggleFullscreen();
    }

    // Escape to exit fullscreen
    if (e.key === 'Escape' && document.fullscreenElement) {
      document.exitFullscreen();
    }

    // Space to pause/resume
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (this.state.sessionState === 'running') {
        this.handleControl('pause');
      } else if (this.state.sessionState === 'paused') {
        this.handleControl('resume');
      }
    }
  }

  handleOption(option, value) {
    if (!this.world || !this.hud) return;

    switch (option) {
      case 'layout':
        this.hud.setLayout(value);
        break;
      case 'camera':
        this.world.setCameraMode(value);
        break;
      case 'detail':
        this.world.setDetailLevel(value);
        break;
      case 'time':
        this.world.setTimeOfDay(value);
        break;
      case 'theme':
        this.world.setTheme(value);
        break;
      case 'scenery':
        this.world.setSceneryLevel(value);
        break;
      case 'foliage_season':
        this.world.setFoliageSeason(value);
        break;
      case 'route': {
        const didChange = this.world.setRoute(value);
        if (didChange) {
          this.routeEventState = null;
          this.routeEventExpiresAt = 0;
          this.state.routeEvent = null;
          this.hud.setRouteOptions(this.world.getRoutes(), value);
          this.hud.setElevationProfile(this.world.getElevationProfile());
          this.hud.setRouteMap(this.world.getRouteMap());
        }
        break;
      }
      case 'viz_exposure':
        this.visualTuning.exposure = Number(value) || 1;
        this.world.setVisualTuning({ exposure: this.visualTuning.exposure });
        break;
      case 'viz_lighting':
        this.visualTuning.lighting = Number(value) || 1;
        this.world.setVisualTuning({ lighting: this.visualTuning.lighting });
        break;
      case 'viz_saturation':
        this.visualTuning.saturation = Number(value) || 1;
        this.world.setVisualTuning({ saturation: this.visualTuning.saturation });
        break;
      case 'viz_haze':
        this.visualTuning.haze = Number(value) || 1;
        this.world.setVisualTuning({ haze: this.visualTuning.haze });
        break;
      case 'viz_reset':
        this.visualTuning = { exposure: 1.25, lighting: 1.28, saturation: 1.18, haze: 0.72 };
        this.world.setVisualTuning(this.visualTuning);
        break;
      default:
        break;
    }
  }

  getDemoFallbackSpeedKph(deltaTime = 0.016) {
    const step = this.state.currentStep || {};
    const stepPower = Number(step.targetPower ?? step.power ?? 0);
    const stepCadence = Number(step.targetCadence ?? step.cadence ?? 0);
    const fallbackPower = this.state.power || 185;
    const fallbackCadence = this.state.cadence || 88;
    const targetPower = Number.isFinite(stepPower) && stepPower > 0 ? stepPower : fallbackPower;
    const targetCadence = Number.isFinite(stepCadence) && stepCadence > 0 ? stepCadence : fallbackCadence;

    const normalizedPower = Math.max(0, Math.min(1, (targetPower - 120) / 220));
    const cadenceFactor = Math.max(-1, Math.min(1, (targetCadence - 88) / 18));
    const baseSpeed = 24 + normalizedPower * 9 + cadenceFactor * 1.2;
    const gradientPercent = (this.state.gradient || 0) * 100;
    const climbPenalty = Math.max(0, gradientPercent) * 0.95;
    const descentBoost = Math.max(0, -gradientPercent) * 0.32;
    const targetSpeed = Math.max(10, Math.min(47, baseSpeed - climbPenalty + descentBoost));
    const blend = 1 - Math.exp(-Math.max(0.001, deltaTime) / 1.2);

    this.demoSpeedKph += (targetSpeed - this.demoSpeedKph) * blend;
    return this.demoSpeedKph;
  }

  animate() {
    if (!this.isRunning) return;

    window.requestAnimationFrame(() => this.animate());

    const now = window.performance.now();
    const rawDelta = Math.max(0, (now - this.lastFrameTime) / 1000);
    const deltaTime = Math.min(rawDelta, 0.1); // Cap delta for world stability
    this.lastFrameTime = now;
    const sinceData = this.lastDataAt ? Math.max(0, (now - this.lastDataAt) / 1000) : 0;

    // Keep demo sessions moving even without trainer/live stream.
    const isActive = this.state.sessionState === 'running';
    const hasEffort = (this.state.cadence || 0) > 1 || (this.state.power || 0) > 5;
    const hasRecentLiveData = this.hasReceivedData && sinceData < 2.5;
    const fallbackDemoMotion = isActive && (!this.bridge?.isConnected || !hasRecentLiveData);
    let speedKph = 0;

    if (fallbackDemoMotion) {
      speedKph = this.getDemoFallbackSpeedKph(rawDelta);
      this.state.speed = speedKph;
    } else if (isActive && hasEffort) {
      speedKph = this.state.speed || 0;
    }

    const speedMps = speedKph / 3.6; // km/h to m/s

    if (isActive && !hasEffort && !fallbackDemoMotion) {
      this.state.speed = 0;
    }

    if (!this.hasReceivedData && this.state.sessionState === 'idle') {
      this.state.sessionState = 'waiting';
    }

    if (isActive) {
      if (this.hasLiveElapsed) {
        this.state.elapsed = this.lastElapsed + sinceData;
      } else {
        this.state.elapsed += rawDelta;
      }

      if (this.hasLiveDistance) {
        this.state.distance = this.lastDistance + speedMps * sinceData;
      } else {
        this.state.distance += speedMps * rawDelta;
      }

      if (this.state.currentStep?.durationSec !== null && this.state.currentStep?.durationSec !== undefined) {
        const stepElapsed = this.hasLiveStepElapsed
          ? this.lastStepElapsed + sinceData
          : (this.state.stepElapsed || 0) + rawDelta;
        this.state.stepElapsed = stepElapsed;
        this.state.stepRemaining = Math.max(0, this.state.currentStep.durationSec - stepElapsed);
      }
    }

    // Update world and get current terrain info
    if (this.world) {
      const worldState = this.world.update(deltaTime, speedMps, this.state);

      // Update state with terrain data from world
      if (worldState) {
        this.state.gradient = worldState.displayGradient ?? worldState.gradient;
        this.state.altitude = worldState.altitude;
        this.state.sceneryZone = worldState.sceneryZone || this.state.sceneryZone || 'flat';
        if (worldState.routeEvent?.title) {
          this.routeEventState = {
            title: worldState.routeEvent.title,
            type: worldState.routeEvent.type || 'zone'
          };
          const durationMs = worldState.routeEvent.type === 'summit' ? 6200 : 4800;
          this.routeEventExpiresAt = now + durationMs;
        }
        // Use world's distance if we don't have live distance
        if (!this.state.distance && worldState.distance) {
          this.state.distance = worldState.distance;
        }
      }

      this.state.routeEvent = (this.routeEventState && now <= this.routeEventExpiresAt)
        ? this.routeEventState
        : null;

      const distance = this.state.distance || worldState?.distance || 0;
      this.state.turnPreview = this.world.getTurnPreview(distance);
    }

    // Update HUD with combined state
    if (this.hud) {
      this.hud.update(this.state);
    }
  }

  handleResize() {
    if (this.world) {
      this.world.resize();
    }
    if (this.hud) {
      this.hud.resize();
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  destroy() {
    this.isRunning = false;
    if (this.bridge) {
      this.bridge.disconnect();
    }
    if (this.world) {
      this.world.destroy();
    }
  }
}

// Initialize app when DOM is ready
const app = new VirtualRideApp();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.destroy();
});

// Export for potential external access
window.VirtualRideApp = app;
