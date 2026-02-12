/**
 * PostProcessing - SSAO, bloom, color grading, and anti-aliasing
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

export class PostProcessing {
  constructor(renderer, scene, camera, container) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.container = container;

    this.composer = null;
    this.ssaoPass = null;
    this.bloomPass = null;
    this.colorGradingPass = null;
    this.smaaPass = null;
    this.fxaaPass = null;

    this.enabled = false;
    this.quality = 'high';
    this.timeOfDay = 'day';
    this.effectTime = 0;
    this.visualTuning = {
      exposure: 1,
      saturation: 1
    };
    this.baseGradePreset = null;
  }

  init() {
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.ssaoPass = new SSAOPass(
      this.scene,
      this.camera,
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.ssaoPass.kernelRadius = 8;
    this.ssaoPass.minDistance = 0.002;
    this.ssaoPass.maxDistance = 0.018;
    this.ssaoPass.enabled = true;
    this.composer.addPass(this.ssaoPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.container.clientWidth, this.container.clientHeight),
      0.12,
      0.7,
      0.93
    );
    this.composer.addPass(this.bloomPass);

    const ColorGradingShader = {
      uniforms: {
        tDiffuse: { value: null },
        exposure: { value: 1.16 },
        contrast: { value: 1.02 },
        saturation: { value: 1.18 },
        warmth: { value: 0.08 },
        shadowLift: { value: 0.04 },
        vignetteAmount: { value: 0.05 },
        vignetteSize: { value: 0.96 },
        grainAmount: { value: 0.01 },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float exposure;
        uniform float contrast;
        uniform float saturation;
        uniform float warmth;
        uniform float shadowLift;
        uniform float vignetteAmount;
        uniform float vignetteSize;
        uniform float grainAmount;
        uniform float time;
        varying vec2 vUv;

        vec3 applySaturation(vec3 color, float sat) {
          float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
          return mix(vec3(luma), color, sat);
        }

        float grain(vec2 uv) {
          return fract(sin(dot(uv + vec2(time * 0.02), vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec4 texel = texture2D(tDiffuse, vUv);
          vec3 color = texel.rgb;

          color *= exposure;
          color = (color - 0.5) * contrast + 0.5;
          color = max(color, vec3(shadowLift));

          color = applySaturation(color, saturation);

          // Controlled warm cinematic lift.
          color.r += warmth * 0.045;
          color.g += warmth * 0.022;
          color.b -= warmth * 0.03;

          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          float vig = smoothstep(vignetteSize, vignetteSize - 0.45, dist);
          color *= mix(1.0 - vignetteAmount, 1.0, vig);

          float noise = (grain(vUv) - 0.5) * grainAmount;
          color += noise;

          gl_FragColor = vec4(clamp(color, 0.0, 1.0), texel.a);
        }
      `
    };

    this.colorGradingPass = new ShaderPass(ColorGradingShader);
    this.composer.addPass(this.colorGradingPass);

    this.smaaPass = new SMAAPass(
      this.container.clientWidth * this.renderer.getPixelRatio(),
      this.container.clientHeight * this.renderer.getPixelRatio()
    );
    this.composer.addPass(this.smaaPass);

    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.uniforms.resolution.value.set(
      1 / (this.container.clientWidth * this.renderer.getPixelRatio()),
      1 / (this.container.clientHeight * this.renderer.getPixelRatio())
    );
    this.fxaaPass.enabled = false;
    this.composer.addPass(this.fxaaPass);

    this.enabled = true;
    this.setQuality(this.quality);
    this.setTimeOfDay(this.timeOfDay);
  }

  render(deltaTime = 1 / 60) {
    if (this.enabled && this.composer) {
      this.effectTime += deltaTime;
      if (this.colorGradingPass?.uniforms?.time) {
        this.colorGradingPass.uniforms.time.value = this.effectTime;
      }
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  resize() {
    if (!this.enabled) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const pixelRatio = this.renderer.getPixelRatio();

    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.ssaoPass) {
      this.ssaoPass.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.setSize(width, height);
    }
    if (this.smaaPass) {
      this.smaaPass.setSize(width * pixelRatio, height * pixelRatio);
    }
    if (this.fxaaPass) {
      this.fxaaPass.uniforms.resolution.value.set(
        1 / (width * pixelRatio),
        1 / (height * pixelRatio)
      );
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setQuality(level = 'high') {
    this.quality = level;

    if (!this.ssaoPass || !this.bloomPass || !this.smaaPass || !this.fxaaPass) return;

    if (level === 'low') {
      this.ssaoPass.enabled = false;
      this.bloomPass.enabled = false;
      this.smaaPass.enabled = false;
      this.fxaaPass.enabled = true;
      if (this.colorGradingPass?.uniforms) {
        this.colorGradingPass.uniforms.grainAmount.value = 0.008;
        this.colorGradingPass.uniforms.vignetteAmount.value = 0.05;
      }
      return;
    }

    if (level === 'medium') {
      this.ssaoPass.enabled = true;
      this.ssaoPass.kernelRadius = 9;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.1;
      this.smaaPass.enabled = true;
      this.fxaaPass.enabled = false;
      if (this.colorGradingPass?.uniforms) {
        this.colorGradingPass.uniforms.grainAmount.value = 0.01;
        this.colorGradingPass.uniforms.vignetteAmount.value = 0.05;
      }
      return;
    }

    this.ssaoPass.enabled = true;
    this.ssaoPass.kernelRadius = 8;
    this.bloomPass.enabled = true;
    this.bloomPass.strength = 0.12;
    this.smaaPass.enabled = true;
    this.fxaaPass.enabled = false;
    if (this.colorGradingPass?.uniforms) {
      this.colorGradingPass.uniforms.grainAmount.value = 0.01;
      this.colorGradingPass.uniforms.vignetteAmount.value = 0.05;
    }
  }

  setTimeOfDay(mode = 'day') {
    this.timeOfDay = mode;
    if (!this.colorGradingPass?.uniforms) return;

    const presets = {
      day: {
        exposure: 1.34,
        contrast: 1.01,
        saturation: 1.22,
        warmth: 0.06,
        shadowLift: 0.045
      },
      sunset: {
        exposure: 1.06,
        contrast: 1.1,
        saturation: 1.16,
        warmth: 0.2,
        shadowLift: 0.018
      },
      night: {
        exposure: 0.95,
        contrast: 1.04,
        saturation: 0.92,
        warmth: -0.05,
        shadowLift: 0.03
      }
    };

    const preset = presets[mode] || presets.day;
    this.baseGradePreset = preset;
    this.applyVisualTuning();
  }

  applyVisualTuning() {
    if (!this.colorGradingPass?.uniforms || !this.baseGradePreset) return;
    const preset = this.baseGradePreset;
    this.colorGradingPass.uniforms.exposure.value = preset.exposure * (this.visualTuning.exposure || 1);
    this.colorGradingPass.uniforms.contrast.value = preset.contrast;
    this.colorGradingPass.uniforms.saturation.value = preset.saturation * (this.visualTuning.saturation || 1);
    this.colorGradingPass.uniforms.warmth.value = preset.warmth;
    this.colorGradingPass.uniforms.shadowLift.value = preset.shadowLift;
  }

  setVisualTuning(tuning = {}) {
    this.visualTuning = {
      ...this.visualTuning,
      ...tuning
    };
    this.applyVisualTuning();
  }

  destroy() {
    // Passes are disposed with renderer/composer lifecycle.
  }
}
