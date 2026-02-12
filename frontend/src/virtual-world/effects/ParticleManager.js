/**
 * ParticleManager - Dust particles and floating leaves
 */

import * as THREE from 'three';

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.dustSystem = null;
    this.leaves = [];
    this.time = 0;
    this.sceneryLevel = 'standard';
  }

  create() {
    this.createDustParticles();
    this.createLeaves();
  }

  createDustParticles() {
    const dustGeo = new THREE.BufferGeometry();
    const dustCount = 200;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSizes = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 100;
      dustPositions[i * 3 + 1] = Math.random() * 15 + 1;
      dustPositions[i * 3 + 2] = Math.random() * 200;
      dustSizes[i] = Math.random() * 0.15 + 0.05;
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeo.setAttribute('size', new THREE.BufferAttribute(dustSizes, 1));

    const dustMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      transparent: true,
      opacity: 0.4,
      sizeAttenuation: true
    });

    this.dustSystem = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustSystem);
  }

  createLeaves() {
    const leafGeo = new THREE.PlaneGeometry(0.15, 0.1);
    const leafMat = new THREE.MeshBasicMaterial({
      color: 0x4a7c4e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });

    for (let i = 0; i < 30; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat.clone());
      leaf.material.color.setHex(Math.random() > 0.5 ? 0x4a7c4e : 0x6b8e23);
      leaf.position.set(
        (Math.random() - 0.5) * 60,
        Math.random() * 8 + 2,
        Math.random() * 150 + 20
      );
      leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      leaf.userData.baseZ = leaf.position.z;
      leaf.userData.phase = Math.random() * Math.PI * 2;
      leaf.userData.speed = 0.3 + Math.random() * 0.5;
      this.leaves.push(leaf);
      this.scene.add(leaf);
    }
  }

  setSceneryLevel(level = 'standard') {
    this.sceneryLevel = level;
    const showDust = level !== 'low';
    const showLeaves = level === 'high' || level === 'standard';
    if (this.dustSystem) this.dustSystem.visible = showDust;
    this.leaves.forEach(leaf => { leaf.visible = showLeaves; });
  }

  update(deltaTime, worldState) {
    this.time += deltaTime;
    const { totalDistance } = worldState;

    // Update dust particles - simple floating motion
    if (this.dustSystem) {
      const positions = this.dustSystem.geometry.attributes.position.array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] += Math.sin(this.time + i * 0.1) * 0.002;
      }
      this.dustSystem.geometry.attributes.position.needsUpdate = true;
    }

    // Update leaves
    this.leaves.forEach(leaf => {
      leaf.userData.phase += deltaTime * leaf.userData.speed;

      // Floating/tumbling motion
      leaf.rotation.x += deltaTime * 0.5;
      leaf.rotation.z += deltaTime * 0.3;
      leaf.position.x += Math.sin(leaf.userData.phase) * 0.02;
      leaf.position.y += Math.cos(leaf.userData.phase * 1.3) * 0.01;

      const relativeZ = leaf.userData.baseZ - totalDistance;

      if (relativeZ < -30) {
        leaf.userData.baseZ = totalDistance + 180 + Math.random() * 50;
        leaf.position.x = (Math.random() - 0.5) * 60;
        leaf.position.y = Math.random() * 8 + 2;
      }

      leaf.position.z = leaf.userData.baseZ - totalDistance;
    });
  }

  destroy() {
    if (this.dustSystem) {
      this.scene.remove(this.dustSystem);
      this.dustSystem.geometry.dispose();
      this.dustSystem.material.dispose();
    }

    this.leaves.forEach(leaf => {
      this.scene.remove(leaf);
      leaf.geometry.dispose();
      leaf.material.dispose();
    });
    this.leaves = [];
  }
}
