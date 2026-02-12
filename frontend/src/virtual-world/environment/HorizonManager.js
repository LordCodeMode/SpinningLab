/**
 * HorizonManager - large fallback ground/haze layers to prevent sky bleed at terrain limits
 */

import * as THREE from 'three';
import { THEMES } from '../scene-config.js';

const TIME_PRESETS = {
  day: {
    haze: 0xc9cabf,
    hazeOpacity: 0.2,
    groundLift: 0.08
  },
  sunset: {
    haze: 0xc59b73,
    hazeOpacity: 0.46,
    groundLift: -0.02
  },
  night: {
    haze: 0x1f2937,
    hazeOpacity: 0.3,
    groundLift: -0.08
  }
};

export class HorizonManager {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.groundDisk = null;
    this.hazeRing = null;
    this.groundMaterial = null;
    this.hazeMaterial = null;
    this.theme = 'classic';
    this.timeOfDay = 'day';
    this.visualTuning = {
      haze: 1
    };
    this.atmosphereOverrides = {};
    this.baseHazeOpacity = 0.42;
    this.fogLayers = [];
  }

  create() {
    this.group = new THREE.Group();

    const groundGeo = new THREE.CircleGeometry(2800, 96);
    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5e3f,
      roughness: 1,
      metalness: 0
    });
    this.groundDisk = new THREE.Mesh(groundGeo, this.groundMaterial);
    this.groundDisk.rotation.x = -Math.PI / 2;
    this.groundDisk.position.y = -18;
    this.groundDisk.receiveShadow = true;
    this.group.add(this.groundDisk);

    const hazeGeo = new THREE.RingGeometry(600, 2800, 96, 1);
    this.hazeMaterial = new THREE.MeshBasicMaterial({
      color: 0xb8b8ad,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false
    });
    this.hazeRing = new THREE.Mesh(hazeGeo, this.hazeMaterial);
    this.hazeRing.rotation.x = -Math.PI / 2;
    this.hazeRing.position.y = -17.95;
    this.group.add(this.hazeRing);

    this.createValleyFogLayers();

    this.group.position.set(0, 0, 460);
    this.scene.add(this.group);
    this.applyVisuals();
  }

  createValleyFogLayers() {
    this.fogLayers = [];

    const layerDefs = [
      { inner: 260, outer: 1500, y: -7.5, opacity: 0.12 },
      { inner: 340, outer: 1800, y: -5.6, opacity: 0.1 },
      { inner: 440, outer: 2100, y: -3.9, opacity: 0.08 }
    ];

    layerDefs.forEach((def, idx) => {
      const geo = new THREE.RingGeometry(def.inner, def.outer, 96, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xc1c1b8,
        transparent: true,
        opacity: def.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = def.y;
      mesh.userData.baseOpacity = def.opacity;
      mesh.userData.phase = idx * 0.9;
      this.group.add(mesh);
      this.fogLayers.push(mesh);
    });
  }

  setTheme(themeId) {
    this.theme = themeId;
    this.applyVisuals();
  }

  setTimeOfDay(mode = 'day') {
    this.timeOfDay = mode;
    this.applyVisuals();
  }

  setAtmosphere(atmosphere = {}) {
    this.atmosphereOverrides = {
      ...this.atmosphereOverrides,
      ...atmosphere
    };
    this.applyVisuals();
  }

  setVisualTuning(tuning = {}) {
    this.visualTuning = {
      ...this.visualTuning,
      ...tuning
    };
    this.applyVisuals();
  }

  applyVisuals() {
    const themePreset = THEMES[this.theme] || THEMES.classic;
    const timePreset = TIME_PRESETS[this.timeOfDay] || TIME_PRESETS.day;
    const hazeMultiplier = this.visualTuning.haze || 1;

    if (this.groundMaterial) {
      const groundColor = new THREE.Color(themePreset.grassDark).offsetHSL(0, -0.14, timePreset.groundLift);
      this.groundMaterial.color.copy(groundColor);
    }

    if (this.hazeMaterial) {
      this.hazeMaterial.color.setHex(timePreset.haze);
      this.hazeMaterial.opacity = timePreset.hazeOpacity * hazeMultiplier;
      this.baseHazeOpacity = timePreset.hazeOpacity * hazeMultiplier;
    }

    if (this.fogLayers.length) {
      this.fogLayers.forEach((layer, idx) => {
        layer.material.color.setHex(timePreset.haze);
        layer.material.opacity = layer.userData.baseOpacity * (1 + idx * 0.06) * hazeMultiplier;
      });
    }

    if (this.hazeMaterial && this.atmosphereOverrides.horizonColor != null) {
      this.hazeMaterial.color.setHex(this.atmosphereOverrides.horizonColor);
    }
    if (this.groundMaterial && this.atmosphereOverrides.groundColor != null) {
      this.groundMaterial.color.setHex(this.atmosphereOverrides.groundColor);
    }
    if (this.hazeMaterial && this.atmosphereOverrides.hazeOpacity != null) {
      this.hazeMaterial.opacity = this.atmosphereOverrides.hazeOpacity * hazeMultiplier;
      this.baseHazeOpacity = this.atmosphereOverrides.hazeOpacity * hazeMultiplier;
    }
    if (this.fogLayers.length && this.atmosphereOverrides.horizonColor != null) {
      this.fogLayers.forEach((layer) => {
        layer.material.color.setHex(this.atmosphereOverrides.horizonColor);
      });
    }
  }

  update(deltaTime, worldState) {
    if (!this.group) return;

    // Keep the fallback ground roughly centered around the playable corridor.
    this.group.position.x = (worldState.roadOffset || 0) * 0.2;

    // Slightly thin haze at high altitude, thicken at low speed valleys.
    const altitude = worldState.currentAltitude || 0;
    const speed = worldState.speedMps || 0;
    const altitudeNorm = THREE.MathUtils.clamp((altitude - 80) / 1200, 0, 1);
    const speedNorm = THREE.MathUtils.clamp(speed / 15, 0, 1);
    const targetOpacity = this.baseHazeOpacity * THREE.MathUtils.lerp(1.12, 0.74, altitudeNorm) * (1 - speedNorm * 0.05);
    if (this.hazeMaterial) {
      this.hazeMaterial.opacity = THREE.MathUtils.lerp(this.hazeMaterial.opacity, targetOpacity, THREE.MathUtils.clamp(deltaTime * 1.7, 0.03, 0.22));
    }

    if (this.fogLayers.length) {
      this.fogLayers.forEach((layer, idx) => {
        const layerPulse = 1 + Math.sin((worldState.time || 0) * (0.08 + idx * 0.03) + layer.userData.phase) * 0.08;
        const base = layer.userData.baseOpacity || 0.08;
        const valleyBoost = THREE.MathUtils.lerp(1.25, 0.76, altitudeNorm);
        const movingAir = 1 - speedNorm * 0.08;
        const targetLayerOpacity = base * valleyBoost * movingAir * layerPulse;
        layer.material.opacity = THREE.MathUtils.lerp(layer.material.opacity, targetLayerOpacity, THREE.MathUtils.clamp(deltaTime * 1.2, 0.03, 0.15));
        layer.rotation.z += deltaTime * (0.003 + idx * 0.0014);
      });
    }
  }

  destroy() {
    if (!this.group) return;

    this.scene.remove(this.group);

    if (this.groundDisk) {
      this.groundDisk.geometry.dispose();
    }
    if (this.hazeRing) {
      this.hazeRing.geometry.dispose();
    }
    this.fogLayers.forEach((layer) => {
      layer.geometry?.dispose?.();
      layer.material?.dispose?.();
    });

    this.groundMaterial?.dispose();
    this.hazeMaterial?.dispose();

    this.group = null;
    this.groundDisk = null;
    this.hazeRing = null;
    this.fogLayers = [];
  }
}
