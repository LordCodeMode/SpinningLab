/**
 * SceneSetup - Core Three.js scene, camera, and renderer initialization
 */

import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { COLORS } from '../scene-config.js';

export class SceneSetup {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.groundPlane = null;
    this.atmosphere = {
      backgroundColor: COLORS.skyHorizon,
      fogColor: 0x9ea8ae,
      fogDensity: 0.0011
    };
    this.visualTuning = {
      exposure: 1,
      fog: 1
    };
    this.baseToneMappingExposure = 1.45;
    this.sourceFogDensity = this.atmosphere.fogDensity;
    this.baseFogColor = new THREE.Color(this.atmosphere.fogColor);
    this.baseFogDensity = this.atmosphere.fogDensity;
    this.dynamicFogColor = new THREE.Color(this.atmosphere.fogColor);
    this.dynamicFogDensity = this.atmosphere.fogDensity;
    this.csm = null;
    this.csmEnabled = true;
    this.pmremGenerator = null;
    this.environmentTexture = null;
  }

  init() {
    // Base atmosphere is later refined by SkyManager.
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.atmosphere.backgroundColor);
    this.scene.fog = new THREE.FogExp2(this.atmosphere.fogColor, this.atmosphere.fogDensity);

    // Create camera (third-person chase cam)
    this.camera = new THREE.PerspectiveCamera(
      55,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      2000
    );

    // Create renderer with better settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.useLegacyLights = false;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.baseToneMappingExposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(this.atmosphere.backgroundColor, 1);
    this.container.appendChild(this.renderer.domElement);

    // Provide neutral image-based lighting so PBR assets don't look flat/dark.
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const envRT = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.03);
    this.environmentTexture = envRT.texture;
    this.scene.environment = this.environmentTexture;
    if ('environmentIntensity' in this.scene) {
      this.scene.environmentIntensity = 1.08;
    }

    this.initCascadedShadows();

    return {
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer
    };
  }

  initCascadedShadows() {
    if (!this.csmEnabled || !this.scene || !this.camera) return;

    this.csm = new CSM({
      maxFar: this.camera.far * 0.86,
      cascades: 3,
      mode: 'practical',
      parent: this.scene,
      shadowMapSize: 2048,
      lightDirection: new THREE.Vector3(-0.45, -1, -0.35).normalize(),
      lightIntensity: 1.2,
      camera: this.camera,
      fade: true
    });
    this.csm.fade = true;
  }

  refreshCascadedShadowMaterials() {
    if (!this.csm || !this.scene) return;

    this.scene.traverse((obj) => {
      if (!obj?.isMesh || !obj.material) return;
      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => {
          if (!mat) return;
          this.csm.setupMaterial(mat);
        });
        return;
      }
      this.csm.setupMaterial(obj.material);
    });
  }

  setDetailLevel(level) {
    if (!this.renderer) return;

    if (level === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.renderer.setPixelRatio(1);
    } else if (level === 'medium') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  setAtmosphere(atmosphere = {}) {
    this.atmosphere = {
      ...this.atmosphere,
      ...atmosphere
    };

    if (this.scene?.background && this.atmosphere.backgroundColor != null) {
      this.scene.background = new THREE.Color(this.atmosphere.backgroundColor);
    }

    if (this.atmosphere.fogColor != null) {
      this.baseFogColor.setHex(this.atmosphere.fogColor);
      this.dynamicFogColor.copy(this.baseFogColor);
    }

    if (this.scene?.fog && this.atmosphere.fogColor != null) {
      this.scene.fog.color.copy(this.dynamicFogColor);
    }

    if (this.scene?.fog && this.atmosphere.fogDensity != null) {
      this.sourceFogDensity = this.atmosphere.fogDensity;
      this.baseFogDensity = this.sourceFogDensity * (this.visualTuning.fog || 1);
      this.dynamicFogDensity = this.baseFogDensity;
      this.scene.fog.density = this.dynamicFogDensity;
    }

    if (this.renderer && this.atmosphere.backgroundColor != null) {
      this.renderer.setClearColor(this.atmosphere.backgroundColor, 1);
    }
  }

  setVisualTuning(tuning = {}) {
    this.visualTuning = {
      ...this.visualTuning,
      ...tuning
    };

    if (this.renderer) {
      this.renderer.toneMappingExposure = this.baseToneMappingExposure * (this.visualTuning.exposure || 1);
    }

    if (this.scene?.fog) {
      this.baseFogDensity = this.sourceFogDensity * (this.visualTuning.fog || 1);
      this.dynamicFogDensity = this.baseFogDensity;
      this.scene.fog.density = this.dynamicFogDensity;
    }
  }

  updateAtmosphereDynamics(context = {}) {
    if (!this.scene?.fog) return;

    const altitude = context.altitude ?? 0;
    const speedMps = context.speedMps ?? 0;
    const deltaTime = context.deltaTime ?? (1 / 60);
    const mountainness = context.sceneryProfile?.mountainness ?? 0;
    const alpineFactor = context.sceneryProfile?.alpineFactor ?? 0;

    const altitudeNorm = THREE.MathUtils.clamp((altitude - 80) / 1300, 0, 1);
    const speedNorm = THREE.MathUtils.clamp(speedMps / 18, 0, 1);

    const densityMultiplier = THREE.MathUtils.lerp(0.98, 0.68, altitudeNorm) * (1 - mountainness * 0.08);
    const speedBoost = 1 + speedNorm * 0.06;
    const targetDensity = this.baseFogDensity * densityMultiplier * speedBoost;

    const crispAirColor = this.baseFogColor.clone().offsetHSL(0, -0.03, 0.07);
    const humidAirColor = this.baseFogColor.clone().offsetHSL(0, 0.02, -0.04);
    const alpineAirColor = crispAirColor.clone().offsetHSL(0.01, -0.06, 0.06);
    const targetColor = humidAirColor
      .clone()
      .lerp(crispAirColor, altitudeNorm)
      .lerp(alpineAirColor, alpineFactor);

    const densityLerp = THREE.MathUtils.clamp(deltaTime * 2.8, 0.01, 0.22);
    const colorLerp = THREE.MathUtils.clamp(deltaTime * 1.8, 0.01, 0.18);

    this.dynamicFogDensity = THREE.MathUtils.lerp(this.dynamicFogDensity, targetDensity, densityLerp);
    this.dynamicFogColor.lerp(targetColor, colorLerp);

    this.scene.fog.density = this.dynamicFogDensity;
    this.scene.fog.color.copy(this.dynamicFogColor);
  }

  updateShadows() {
    if (!this.csm) return;
    this.csm.update();
  }

  resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.csm?.updateFrustums();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (!this.renderer) return;
    this.csm?.dispose?.();
    this.csm = null;
    if (this.environmentTexture) {
      this.environmentTexture.dispose?.();
      this.environmentTexture = null;
    }
    this.pmremGenerator?.dispose?.();
    this.pmremGenerator = null;
    this.renderer.dispose();
    if (this.renderer.domElement?.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
