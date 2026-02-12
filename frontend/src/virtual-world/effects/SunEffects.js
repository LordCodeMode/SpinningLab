/**
 * SunEffects - Sun glare and light rays
 */

import * as THREE from 'three';
import { TextureFactory } from '../utils/TextureFactory.js';

export class SunEffects {
  constructor(scene) {
    this.scene = scene;
    this.sunGlare = null;
    this.lightRays = [];
    this.time = 0;
  }

  create() {
    this.createSunGlare();
    this.createLightRays();
  }

  createSunGlare() {
    const textureFactory = new TextureFactory();
    const sunGlareTexture = textureFactory.createSunGlareTexture();

    const sunGlareMat = new THREE.SpriteMaterial({
      map: sunGlareTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.4
    });

    this.sunGlare = new THREE.Sprite(sunGlareMat);
    this.sunGlare.scale.set(150, 150, 1);
    this.sunGlare.position.set(200, 250, 800);
    this.scene.add(this.sunGlare);
  }

  createLightRays() {
    const rayCount = 5;

    for (let i = 0; i < rayCount; i++) {
      const rayGeo = new THREE.PlaneGeometry(8, 400);
      const rayMat = new THREE.MeshBasicMaterial({
        color: 0xfffae0,
        transparent: true,
        opacity: 0.03 + Math.random() * 0.02,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(
        150 + (i - rayCount / 2) * 30,
        100,
        500
      );
      ray.rotation.z = (Math.random() - 0.5) * 0.3;
      ray.rotation.y = -0.3;
      ray.userData.phase = Math.random() * Math.PI * 2;
      ray.userData.baseOpacity = ray.material.opacity;

      this.lightRays.push(ray);
      this.scene.add(ray);
    }
  }

  update(deltaTime, worldState) {
    this.time += deltaTime;

    // Animate light rays - subtle pulsing
    this.lightRays.forEach(ray => {
      const pulse = Math.sin(this.time * 0.5 + ray.userData.phase) * 0.5 + 0.5;
      ray.material.opacity = ray.userData.baseOpacity * (0.7 + pulse * 0.3);
    });
  }

  destroy() {
    if (this.sunGlare) {
      this.scene.remove(this.sunGlare);
      this.sunGlare.material.map?.dispose();
      this.sunGlare.material.dispose();
    }

    this.lightRays.forEach(ray => {
      this.scene.remove(ray);
      ray.geometry.dispose();
      ray.material.dispose();
    });
    this.lightRays = [];
  }
}
