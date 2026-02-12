/**
 * LightingManager - Ambient, directional, and hemisphere lights with time-of-day presets
 */

import * as THREE from 'three';
import { THEMES } from '../scene-config.js';

export class LightingManager {
  constructor(scene) {
    this.scene = scene;
    this.ambientLight = null;
    this.sunLight = null;
    this.hemiLight = null;
    this.fillLight = null;
    this.rimLight = null;
    this.timeOfDay = 'day';
    this.theme = 'classic';
    this.visualTuning = {
      brightness: 1
    };
  }

  create() {
    // Strong ambient light for bright Zwift-like feel
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.08);
    this.scene.add(this.ambientLight);

    // Main directional light (sun) - bright and warm
    this.sunLight = new THREE.DirectionalLight(0xfffef5, 2.95);
    this.sunLight.position.set(100, 200, 80);
    this.sunLight.castShadow = false;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -150;
    this.sunLight.shadow.camera.right = 150;
    this.sunLight.shadow.camera.top = 150;
    this.sunLight.shadow.camera.bottom = -150;
    this.sunLight.shadow.bias = -0.0001;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Hemisphere light - warm white from sky, green from ground (NO BLUE)
    this.hemiLight = new THREE.HemisphereLight(0xfffcf2, 0x7a7766, 0.84);
    this.scene.add(this.hemiLight);

    // Fill light - warm white (NO BLUE)
    this.fillLight = new THREE.DirectionalLight(0xfff8f0, 0.8);
    this.fillLight.position.set(-80, 80, -50);
    this.scene.add(this.fillLight);

    // Rim light from behind for depth and separation (Zwift cinematic look)
    this.rimLight = new THREE.DirectionalLight(0xffeedd, 0.62);
    this.rimLight.position.set(0, 100, -100);
    this.scene.add(this.rimLight);
  }

  setTimeOfDay(mode = 'day') {
    this.timeOfDay = mode;

    const themePreset = THEMES[this.theme] || THEMES.classic;
    const presets = {
      day: {
        sun: 0xfffef5,
        sunIntensity: 2.95,
        ambient: 1.08,
        hemi: { sky: 0xfffcf2, ground: 0x7a7766, intensity: 0.84 },
        fillIntensity: 0.8
      },
      sunset: {
        sun: 0xffb347,
        sunIntensity: 1.4,
        ambient: 0.5,
        hemi: { sky: 0xffb347, ground: 0x5b4f42, intensity: 0.41 },
        fillIntensity: 0.35
      },
      night: {
        sun: 0x445566,
        sunIntensity: 0.3,
        ambient: 0.25,
        hemi: { sky: 0x2f3a54, ground: 0x151c2a, intensity: 0.3 },
        fillIntensity: 0.15
      }
    };

    const preset = presets[mode] || presets.day;
    const brightness = this.visualTuning.brightness || 1;

    if (this.sunLight) {
      this.sunLight.color.setHex(preset.sun);
      this.sunLight.intensity = preset.sunIntensity * brightness;
    }

    if (this.ambientLight) {
      this.ambientLight.intensity = preset.ambient * brightness;
    }

    if (this.hemiLight) {
      this.hemiLight.color.setHex(preset.hemi.sky);
      this.hemiLight.groundColor.setHex(preset.hemi.ground);
      this.hemiLight.intensity = preset.hemi.intensity * brightness;
    }

    if (this.fillLight) {
      this.fillLight.intensity = preset.fillIntensity * brightness;
    }

    if (this.rimLight) {
      this.rimLight.intensity = (mode === 'night' ? 0.24 : mode === 'sunset' ? 0.46 : 0.62) * brightness;
    }
  }

  setTheme(themeId) {
    this.theme = themeId;
    this.setTimeOfDay(this.timeOfDay); // Reapply with new theme
  }

  setVisualTuning(tuning = {}) {
    this.visualTuning = {
      ...this.visualTuning,
      ...tuning
    };
    this.setTimeOfDay(this.timeOfDay);
  }

  update(deltaTime, worldState) {
    // Update sun light position to follow the world
    if (this.sunLight && worldState.totalDistance !== undefined) {
      this.sunLight.position.z = worldState.totalDistance + 100;
      this.sunLight.target.position.z = worldState.totalDistance;
    }
  }

  destroy() {
    if (this.ambientLight) this.scene.remove(this.ambientLight);
    if (this.sunLight) {
      this.scene.remove(this.sunLight);
      this.scene.remove(this.sunLight.target);
    }
    if (this.hemiLight) this.scene.remove(this.hemiLight);
    if (this.fillLight) this.scene.remove(this.fillLight);
    if (this.rimLight) this.scene.remove(this.rimLight);
  }
}
