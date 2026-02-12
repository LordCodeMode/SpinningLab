/**
 * SkyManager - sky dome, sun mesh, and atmospheric controls
 */

import * as THREE from 'three';
import { COLORS, THEMES } from '../scene-config.js';

export class SkyManager {
  constructor(scene) {
    this.scene = scene;
    this.skyMesh = null;
    this.skyMaterial = null;
    this.sunMesh = null;
    this.sunGlow = null;
    this.theme = 'classic';
    this.timeOfDay = 'day';
    this.visualTuning = {
      haze: 1,
      fog: 1
    };
    this.atmosphereCallback = null;
    this.sunDirection = new THREE.Vector3(0.24, 0.72, 0.64).normalize();
  }

  create() {
    const skyGeo = new THREE.SphereGeometry(1600, 48, 36);
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(COLORS.skyTop) },
        bottomColor: { value: new THREE.Color(COLORS.skyHorizon) },
        horizonColor: { value: new THREE.Color(0xd4e0b2) },
        sunColor: { value: new THREE.Color(0xfff3c7) },
        sunDirection: { value: this.sunDirection.clone() },
        hazeStrength: { value: 0.34 },
        exponent: { value: 0.72 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDirection;
        uniform float hazeStrength;
        uniform float exponent;
        varying vec3 vWorldPosition;

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float heightMix = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 sky = mix(bottomColor, topColor, pow(heightMix, exponent));

          float horizonBand = smoothstep(0.03, 0.42, 1.0 - abs(dir.y));
          sky = mix(sky, horizonColor, horizonBand * hazeStrength);

          float sunDot = max(dot(dir, normalize(sunDirection)), 0.0);
          float sunDisc = pow(sunDot, 320.0);
          float sunHalo = pow(sunDot, 18.0);

          vec3 color = sky + sunColor * sunDisc * 1.4 + sunColor * sunHalo * 0.18;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
      fog: false
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.scene.add(this.skyMesh);

    // Sun sprite geometry to add bright focal point.
    const sunGeo = new THREE.CircleGeometry(78, 48);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffffee,
      fog: false,
      transparent: true,
      opacity: 0.92
    });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    const glowGeo = new THREE.CircleGeometry(170, 48);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffefc2,
      fog: false,
      transparent: true,
      opacity: 0.28
    });
    this.sunGlow = new THREE.Mesh(glowGeo, glowMat);
    this.scene.add(this.sunGlow);

    this.setTimeOfDay(this.timeOfDay);
  }

  setTimeOfDay(mode = 'day') {
    this.timeOfDay = mode;
    const preset = this.getAtmospherePreset(mode);
    const hazeMultiplier = this.visualTuning.haze || 1;
    const fogMultiplier = this.visualTuning.fog || 1;

    this.sunDirection.copy(preset.sunDirection).normalize();

    if (this.skyMaterial) {
      this.skyMaterial.uniforms.topColor.value.setHex(preset.top);
      this.skyMaterial.uniforms.bottomColor.value.setHex(preset.horizon);
      this.skyMaterial.uniforms.horizonColor.value.setHex(preset.horizonHaze);
      this.skyMaterial.uniforms.sunColor.value.setHex(preset.sunColor);
      this.skyMaterial.uniforms.sunDirection.value.copy(this.sunDirection);
      this.skyMaterial.uniforms.hazeStrength.value = preset.hazeStrength * hazeMultiplier;
      this.skyMaterial.uniforms.exponent.value = preset.gradientExponent;
    }

    if (this.sunMesh && this.sunGlow) {
      const sunPos = preset.sunDirection.clone().multiplyScalar(980);
      this.sunMesh.position.copy(sunPos);
      this.sunGlow.position.copy(sunPos.clone().multiplyScalar(0.985));
      this.sunMesh.lookAt(0, 0, 0);
      this.sunGlow.lookAt(0, 0, 0);

      this.sunMesh.material.color.setHex(preset.sunColor);
      this.sunGlow.material.color.setHex(preset.sunGlow);
      this.sunMesh.material.opacity = preset.sunOpacity;
      this.sunGlow.material.opacity = preset.sunGlowOpacity;
    }

    this.atmosphereCallback?.({
      backgroundColor: preset.horizon,
      fogColor: preset.fog,
      fogDensity: preset.fogDensity * fogMultiplier,
      horizonColor: preset.groundHaze,
      groundColor: preset.groundColor,
      hazeOpacity: preset.groundHazeOpacity * hazeMultiplier
    });
  }

  setTheme(themeId) {
    this.theme = themeId;
    this.setTimeOfDay(this.timeOfDay);
  }

  setVisualTuning(tuning = {}) {
    this.visualTuning = {
      ...this.visualTuning,
      ...tuning
    };
    this.setTimeOfDay(this.timeOfDay);
  }

  setAtmosphereCallback(callback) {
    this.atmosphereCallback = callback;
    this.setTimeOfDay(this.timeOfDay);
  }

  getAtmospherePreset(mode = 'day') {
    const themePreset = THEMES[this.theme] || THEMES.classic;

    const presets = {
      day: {
        top: themePreset.skyTop,
        horizon: themePreset.skyHorizon,
        horizonHaze: 0xeaf0e2,
        fog: 0xc8d2d6,
        fogDensity: 0.00072,
        groundHaze: 0xc5c3b3,
        groundColor: 0x49583f,
        groundHazeOpacity: 0.3,
        hazeStrength: 0.24,
        gradientExponent: 0.72,
        sunDirection: new THREE.Vector3(0.28, 0.66, 0.7),
        sunColor: 0xfff4c8,
        sunGlow: 0xffeab8,
        sunOpacity: 0.92,
        sunGlowOpacity: 0.28
      },
      sunset: {
        top: 0xff7d50,
        horizon: 0xffc892,
        horizonHaze: 0xf3b07c,
        fog: 0xbc9167,
        fogDensity: 0.0012,
        groundHaze: 0xc89e79,
        groundColor: 0x585246,
        groundHazeOpacity: 0.46,
        hazeStrength: 0.45,
        gradientExponent: 0.62,
        sunDirection: new THREE.Vector3(-0.22, 0.22, 0.95),
        sunColor: 0xffcf88,
        sunGlow: 0xffb068,
        sunOpacity: 0.88,
        sunGlowOpacity: 0.34
      },
      night: {
        top: 0x0b1026,
        horizon: 0x1a2342,
        horizonHaze: 0x2f3551,
        fog: 0x253043,
        fogDensity: 0.00134,
        groundHaze: 0x2b3344,
        groundColor: 0x293032,
        groundHazeOpacity: 0.28,
        hazeStrength: 0.22,
        gradientExponent: 0.86,
        sunDirection: new THREE.Vector3(0.05, 0.14, -0.98),
        sunColor: 0x8ea4d8,
        sunGlow: 0x6378a6,
        sunOpacity: 0.38,
        sunGlowOpacity: 0.12
      }
    };

    return presets[mode] || presets.day;
  }

  destroy() {
    if (this.skyMesh) {
      this.scene.remove(this.skyMesh);
      this.skyMesh.geometry.dispose();
      this.skyMaterial.dispose();
    }
    if (this.sunMesh) {
      this.scene.remove(this.sunMesh);
      this.sunMesh.geometry.dispose();
      this.sunMesh.material.dispose();
    }
    if (this.sunGlow) {
      this.scene.remove(this.sunGlow);
      this.sunGlow.geometry.dispose();
      this.sunGlow.material.dispose();
    }
  }
}
