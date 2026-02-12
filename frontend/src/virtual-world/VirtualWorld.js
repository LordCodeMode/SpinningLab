/**
 * VirtualWorld - Main coordinator for the 3D cycling world
 */

import { RouteManager } from './routes.js';

// Core modules
import { SceneSetup, PostProcessing, CameraController } from './core/index.js';

// Utility modules
import { TextureFactory } from './utils/index.js';

// World lifecycle modules
import {
  WorldManagerRegistry,
  createManagerDefinitions,
  buildWorldState
} from './world/index.js';

export class VirtualWorld {
  constructor(container) {
    this.container = container;

    // Core
    this.sceneSetup = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.postProcessing = null;
    this.cameraController = null;

    // Route system
    this.routeManager = new RouteManager();
    this.routeLength = this.routeManager.getCurrentRoute().totalDistance;
    this.routeStyle = this.routeManager.getCurrentRouteStyle();

    // Utilities
    this.textureFactory = new TextureFactory();

    // Managers
    this.managerRegistry = new WorldManagerRegistry();
    this.managers = {};

    // State
    this.totalDistance = 0;
    this.currentSegment = 0;
    this.currentGradient = 0;
    this.currentDisplayGradient = 0;
    this.currentAltitude = 0;
    this.currentSceneryProfile = null;
    this.currentRouteEvent = null;
    this.roadOffset = 0;
    this.roadHeading = 0;
    this.previousRoadHeading = 0;
    this.time = 0;

    // Settings
    this.cameraMode = 'chase';
    this.detailLevel = 'high';
    this.timeOfDay = 'day';
    this.theme = 'classic';
    this.sceneryLevel = 'standard';
    this.foliageSeason = 'late_summer';
    this.visualTuning = {
      exposure: 1,
      lighting: 1,
      saturation: 1,
      haze: 1
    };
  }

  async init() {
    // Core setup
    this.sceneSetup = new SceneSetup(this.container);
    const { scene, camera, renderer } = this.sceneSetup.init();
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // Improve texture clarity by using renderer capabilities.
    this.textureFactory.configure(this.renderer);

    // Post-processing
    this.postProcessing = new PostProcessing(renderer, scene, camera, this.container);
    this.postProcessing.init();
    this.postProcessing.setEnabled(true);

    // Camera controller
    this.cameraController = new CameraController(camera);

    // Initialize route
    this.setRoute(this.routeManager.getCurrentRoute().id);

    // Build and initialize world managers
    const managerDefinitions = createManagerDefinitions({
      scene: this.scene,
      textureFactory: this.textureFactory
    });

    this.managerRegistry.registerMany(managerDefinitions);
    this.managers = this.managerRegistry.getMap();

    // Atmosphere controls scene fog/background and fallback horizon colors.
    this.managers.sky?.setAtmosphereCallback((atmosphere) => {
      this.sceneSetup?.setAtmosphere(atmosphere);
      this.managers.horizon?.setAtmosphere?.(atmosphere);
    });

    await this.managerRegistry.createAll({
      getElevationAt: (distanceMeters) => this.getElevationAt(distanceMeters),
      currentAltitude: this.currentAltitude,
      routeManager: this.routeManager,
      routeLength: this.routeLength
    });

    this.sceneSetup.refreshCascadedShadowMaterials();

    // Set camera target
    this.cameraController.setTarget(this.managers.cyclist?.getCyclist?.());

    // Apply initial settings
    this.setTimeOfDay(this.timeOfDay);
    this.setDetailLevel(this.detailLevel);
    this.setSceneryLevel(this.sceneryLevel);
    this.setFoliageSeason(this.foliageSeason);
    this.setVisualTuning(this.visualTuning);
    this.applyRouteStyle(this.routeStyle);

    // Position camera
    this.cameraController.update(0, 0);

    // Initial render
    this.renderer.render(this.scene, this.camera);
  }

  // Route methods
  getElevationAt(distance) {
    if (this.routeManager) {
      const info = this.routeManager.getPositionInfo(distance);
      return { altitude: info.altitude, gradient: info.gradient };
    }
    return { altitude: 100, gradient: 0 };
  }

  getRoutes() {
    return this.routeManager.getRoutes();
  }

  getCurrentRoute() {
    return this.routeManager.getCurrentRoute();
  }

  getElevationProfile() {
    return this.routeManager.getElevationProfile(120);
  }

  getRouteMap() {
    return this.routeManager.getRouteMap(160);
  }

  getTurnPreview(distanceMeters) {
    return this.routeManager.getTurnPreview(distanceMeters);
  }

  getRouteEvents() {
    return this.routeManager.getRouteEvents();
  }

  setRoute(routeId) {
    const changed = this.routeManager.setRoute(routeId);
    if (changed) {
      const current = this.routeManager.getCurrentRoute();
      this.routeLength = current.totalDistance;
      this.routeStyle = this.routeManager.getCurrentRouteStyle();
      this.currentGradient = 0;
      this.currentDisplayGradient = 0;
      if (this.managers.decorations) {
        this.managers.decorations.resetKmMarkers(this.routeLength);
      }
      this.applyRouteStyle(this.routeStyle);
    }
    return changed;
  }

  applyRouteStyle(style = {}) {
    if (!style || typeof style !== 'object') return;

    if (style.theme) this.setTheme(style.theme);
    if (style.sceneryLevel) this.setSceneryLevel(style.sceneryLevel);
    if (style.foliageSeason) this.setFoliageSeason(style.foliageSeason);
    if (style.visualTuning) this.setVisualTuning(style.visualTuning);

    this.managerRegistry.callSome(
      ['vegetation', 'structures', 'terrain', 'road', 'mountains'],
      'setRouteStyle',
      style
    );
  }

  // Settings methods
  setCameraMode(mode) {
    this.cameraMode = mode || 'chase';
    this.cameraController.setMode(this.cameraMode);
  }

  setDetailLevel(level) {
    this.detailLevel = level || 'high';

    this.sceneSetup.setDetailLevel(this.detailLevel);
    this.postProcessing?.setQuality?.(this.detailLevel);
    this.managerRegistry.callSome(
      ['vegetation', 'structures', 'decorations', 'clouds', 'wildlife'],
      'setDetailLevel',
      this.detailLevel
    );
  }

  setTimeOfDay(mode = 'day') {
    this.timeOfDay = mode;
    this.postProcessing?.setTimeOfDay?.(mode);
    this.managerRegistry.callSome(['sky', 'lighting', 'horizon'], 'setTimeOfDay', mode);
  }

  setTheme(themeId) {
    this.theme = themeId;
    this.managerRegistry.callSome(['sky', 'terrain', 'mountains', 'horizon'], 'setTheme', themeId);
    this.setTimeOfDay(this.timeOfDay);
  }

  setSceneryLevel(level = 'standard') {
    this.sceneryLevel = level;
    this.managerRegistry.callSome(
      ['vegetation', 'decorations', 'wildlife', 'particles', 'flowers'],
      'setSceneryLevel',
      level
    );
  }

  setFoliageSeason(season = 'late_summer') {
    this.foliageSeason = season || 'late_summer';
    this.managerRegistry.callSome(['vegetation'], 'setSeasonalPalette', this.foliageSeason);
  }

  setVisualTuning(tuning = {}) {
    this.visualTuning = {
      ...this.visualTuning,
      ...tuning
    };

    const exposure = this.visualTuning.exposure || 1;
    const lighting = this.visualTuning.lighting || 1;
    const saturation = this.visualTuning.saturation || 1;
    const haze = this.visualTuning.haze || 1;

    this.sceneSetup?.setVisualTuning?.({
      exposure,
      fog: haze
    });
    this.postProcessing?.setVisualTuning?.({
      exposure,
      saturation
    });
    this.managerRegistry.callSome(['lighting'], 'setVisualTuning', {
      brightness: lighting
    });
    this.managerRegistry.callSome(['sky', 'horizon'], 'setVisualTuning', {
      haze,
      fog: haze
    });
  }

  // Main update loop
  update(deltaTime, speedMps, state) {
    this.time += deltaTime;

    // Update distance
    this.totalDistance += speedMps * deltaTime;

    // Get elevation at current position
    const elevationInfo = this.getElevationAt(this.totalDistance);
    this.currentGradient = elevationInfo.gradient || 0;
    const targetDisplayGradient = this.routeManager.getDisplayGradient(this.totalDistance);
    const gradientBlend = 1 - Math.exp(-deltaTime / 0.32);
    this.currentDisplayGradient += (targetDisplayGradient - this.currentDisplayGradient) * gradientBlend;
    this.currentAltitude = elevationInfo.altitude;
    this.currentSceneryProfile = this.routeManager.getSceneryProfile(this.totalDistance);
    this.currentRouteEvent = this.routeManager.pollRouteEvent(this.totalDistance);

    // Get curve info
    const curveInfo = this.routeManager.getCurveInfo(this.totalDistance);
    this.roadOffset = curveInfo.lateral;
    this.roadHeading = curveInfo.heading;
    const headingDelta = Math.atan2(
      Math.sin(this.roadHeading - this.previousRoadHeading),
      Math.cos(this.roadHeading - this.previousRoadHeading)
    );
    const steeringRate = headingDelta / Math.max(deltaTime, 0.0001);
    this.previousRoadHeading = this.roadHeading;

    const worldState = buildWorldState(this, speedMps, state);

    // Update all managers in configured lifecycle order
    this.managerRegistry.updateAll(deltaTime, worldState);

    // Update camera
    this.cameraController.update(deltaTime, {
      gradient: this.currentGradient,
      speedMps,
      roadHeading: this.roadHeading,
      cadence: state?.cadence || 0,
      steeringRate
    });

    // Dynamic fog tuning based on altitude + speed.
    this.sceneSetup.updateAtmosphereDynamics({
      altitude: this.currentAltitude,
      speedMps,
      deltaTime,
      sceneryProfile: this.currentSceneryProfile
    });
    this.sceneSetup.updateShadows();

    // Render
    if (this.postProcessing?.enabled) {
      this.postProcessing.render(deltaTime);
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // Return current state for HUD
    return {
      gradient: this.currentGradient,
      altitude: this.currentAltitude,
      sceneryZone: this.currentSceneryProfile?.zone || 'flat',
      routeEvent: this.currentRouteEvent,
      displayGradient: this.currentDisplayGradient,
      distance: this.totalDistance
    };
  }

  resize() {
    this.sceneSetup.resize();
    this.postProcessing?.resize();
  }

  destroy() {
    // Destroy all managers
    this.managerRegistry.destroyAll();

    // Destroy utilities
    this.textureFactory?.destroy();

    // Destroy core
    this.sceneSetup?.destroy();
  }
}
