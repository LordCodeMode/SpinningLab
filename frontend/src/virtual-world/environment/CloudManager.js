/**
 * CloudManager - Cloud puffs and animation
 */

import * as THREE from 'three';

export class CloudManager {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.cloudTopMaterial = null;
    this.cloudBottomMaterial = null;
  }

  create() {
    this.cloudTopMaterial = new THREE.MeshLambertMaterial({
      color: 0xf4f7fc,
      transparent: true,
      opacity: 0.72
    });
    this.cloudBottomMaterial = new THREE.MeshLambertMaterial({
      color: 0xd9dee8,
      transparent: true,
      opacity: 0.64
    });

    const cloudCount = 18;
    for (let i = 0; i < cloudCount; i++) {
      const cloud = this.createCloud();
      cloud.position.set(
        (Math.random() - 0.5) * 760,
        95 + Math.random() * 90,
        180 + Math.random() * 960
      );
      cloud.scale.set(
        0.9 + Math.random() * 1.6,
        0.65 + Math.random() * 0.6,
        0.9 + Math.random() * 1.5
      );
      cloud.userData.baseZ = cloud.position.z;
      cloud.userData.baseX = cloud.position.x;
      cloud.userData.phase = Math.random() * Math.PI * 2;
      cloud.userData.drift = 0.9 + Math.random() * 0.8;

      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  createCloud() {
    const cloud = new THREE.Group();
    const puffGeo = new THREE.SphereGeometry(8 + Math.random() * 8, 12, 10);
    const puffCount = 5 + Math.floor(Math.random() * 4);

    for (let j = 0; j < puffCount; j++) {
      const isBottom = j < 2 && Math.random() < 0.8;
      const puff = new THREE.Mesh(
        puffGeo,
        isBottom ? this.cloudBottomMaterial : this.cloudTopMaterial
      );
      puff.position.set(
        (Math.random() - 0.5) * 22,
        (isBottom ? -1.5 : 0) + Math.random() * 8,
        (Math.random() - 0.5) * 16
      );
      puff.scale.set(1.0 + Math.random() * 1.4, 0.72 + Math.random() * 0.65, 0.9 + Math.random() * 1.25);
      cloud.add(puff);
    }

    return cloud;
  }

  setDetailLevel(level) {
    const showClouds = level !== 'low';
    this.clouds.forEach(cloud => {
      cloud.visible = showClouds;
    });
  }

  update(deltaTime, worldState) {
    if (this.clouds.length === 0) return;

    const { totalDistance, time } = worldState;
    const aheadDistance = 1200;

    this.clouds.forEach(cloud => {
      // Initialize baseZ if not set
      if (cloud.userData.baseZ === undefined) {
        cloud.userData.baseZ = cloud.position.z + totalDistance;
      }

      const driftPhase = cloud.userData.phase || 0;
      const drift = cloud.userData.drift || 1;

      // Gentle crosswind drift + bobbing.
      cloud.position.x = (cloud.userData.baseX || 0) + Math.sin(time * 0.028 * drift + driftPhase) * (18 + drift * 8);
      cloud.position.y += Math.sin(time * 0.23 + driftPhase) * 0.006;

      const relativeZ = cloud.userData.baseZ - totalDistance;

      // Recycle if too far behind
      if (relativeZ < -260) {
        cloud.userData.baseZ = totalDistance + aheadDistance + Math.random() * 400;
        cloud.userData.baseX = (Math.random() - 0.5) * 760;
        cloud.position.y = 95 + Math.random() * 90;
      }

      // Update display position
      cloud.position.z = cloud.userData.baseZ - totalDistance;
    });
  }

  destroy() {
    this.clouds.forEach(cloud => {
      this.scene.remove(cloud);
      cloud.traverse(child => {
        if (child.geometry) child.geometry.dispose();
      });
    });
    this.clouds = [];
    if (this.cloudTopMaterial) this.cloudTopMaterial.dispose();
    if (this.cloudBottomMaterial) this.cloudBottomMaterial.dispose();
  }
}
