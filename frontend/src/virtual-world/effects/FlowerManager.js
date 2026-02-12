/**
 * FlowerManager - Wildflowers with animation
 */

import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, VISIBLE_SEGMENTS } from '../scene-config.js';

export class FlowerManager {
  constructor(scene) {
    this.scene = scene;
    this.flowers = [];
    this.time = 0;
    this.sceneryLevel = 'standard';
  }

  create() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const flowerColors = [0xff4444, 0xffaa00, 0xff69b4, 0xff8c00, 0xffffff, 0xffff44];

    for (let z = 15; z < maxDistance; z += 12) {
      for (let side = -1; side <= 1; side += 2) {
        if (Math.random() > 0.5) continue;

        const x = side * (ROAD_WIDTH / 2 + 18 + Math.random() * 25);
        const flower = this.createFlowerCluster(flowerColors);
        flower.position.set(x, 0, z + Math.random() * 6);
        flower.userData.baseZ = flower.position.z;
        this.flowers.push(flower);
        this.scene.add(flower);
      }
    }
  }

  setSceneryLevel(level = 'standard') {
    this.sceneryLevel = level;
    const showFlowers = level !== 'low';
    this.flowers.forEach(flower => {
      flower.visible = showFlowers;
    });
  }

  createFlowerCluster(colors) {
    const group = new THREE.Group();
    const numFlowers = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < numFlowers; i++) {
      const flowerGroup = new THREE.Group();
      const color = colors[Math.floor(Math.random() * colors.length)];

      // Stem
      const stemHeight = 0.15 + Math.random() * 0.2;
      const stemGeo = new THREE.CylinderGeometry(0.005, 0.008, stemHeight, 6);
      const stemMat = new THREE.MeshBasicMaterial({ color: 0x3d7c3f });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = stemHeight / 2;
      flowerGroup.add(stem);

      // Flower petals
      const petalMat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide });
      const numPetals = 5 + Math.floor(Math.random() * 3);
      const petalSize = 0.02 + Math.random() * 0.015;

      for (let p = 0; p < numPetals; p++) {
        const petalGeo = new THREE.CircleGeometry(petalSize, 6);
        const petal = new THREE.Mesh(petalGeo, petalMat);
        const angle = (p / numPetals) * Math.PI * 2;
        petal.position.set(
          Math.cos(angle) * petalSize * 0.8,
          stemHeight + 0.01,
          Math.sin(angle) * petalSize * 0.8
        );
        petal.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
        flowerGroup.add(petal);
      }

      // Flower center
      const centerGeo = new THREE.SphereGeometry(petalSize * 0.4, 6, 6);
      const centerMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const center = new THREE.Mesh(centerGeo, centerMat);
      center.position.y = stemHeight + 0.015;
      flowerGroup.add(center);

      flowerGroup.position.set(
        (Math.random() - 0.5) * 0.3,
        0,
        (Math.random() - 0.5) * 0.3
      );
      flowerGroup.userData.phase = Math.random() * Math.PI * 2;
      group.add(flowerGroup);
    }

    return group;
  }

  update(deltaTime, worldState) {
    this.time += deltaTime;
    const { totalDistance } = worldState;
    const aheadDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    this.flowers.forEach(flower => {
      // Gentle swaying
      flower.children.forEach(child => {
        if (child.userData.phase !== undefined) {
          child.rotation.x = Math.sin(this.time * 2 + child.userData.phase) * 0.05;
          child.rotation.z = Math.cos(this.time * 1.5 + child.userData.phase) * 0.03;
        }
      });

      const relativeZ = flower.userData.baseZ - totalDistance;

      if (relativeZ < -50) {
        flower.userData.baseZ += aheadDistance;
      }

      flower.position.z = flower.userData.baseZ - totalDistance;
    });
  }

  destroy() {
    this.flowers.forEach(flower => {
      this.scene.remove(flower);
      flower.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    this.flowers = [];
  }
}
