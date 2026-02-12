/**
 * WindEffects - Wind particles for speed effect
 */

import * as THREE from 'three';

export class WindEffects {
  constructor(scene) {
    this.scene = scene;
    this.windStreaks = null;
  }

  create() {
    const windGeo = new THREE.BufferGeometry();
    const windCount = 100;
    const positions = new Float32Array(windCount * 6); // 2 points per line

    for (let i = 0; i < windCount; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = Math.random() * 8 + 0.5;
      const z = Math.random() * 150;
      const length = 0.5 + Math.random() * 1.5;

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y;
      positions[i * 6 + 5] = z - length;
    }

    windGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const windMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15
    });

    this.windStreaks = new THREE.LineSegments(windGeo, windMat);
    this.scene.add(this.windStreaks);
  }

  update(deltaTime, worldState) {
    if (!this.windStreaks) return;

    const { speedMps = 0 } = worldState;

    // Adjust opacity based on speed
    const opacity = Math.min(0.3, speedMps * 0.02);
    this.windStreaks.material.opacity = opacity;

    // Animate wind streaks
    const positions = this.windStreaks.geometry.attributes.position.array;
    const moveSpeed = speedMps * deltaTime * 2;

    for (let i = 0; i < positions.length / 6; i++) {
      // Move both points of each line
      positions[i * 6 + 2] -= moveSpeed;
      positions[i * 6 + 5] -= moveSpeed;

      // Reset if behind camera
      if (positions[i * 6 + 2] < -20) {
        const x = (Math.random() - 0.5) * 60;
        const y = Math.random() * 8 + 0.5;
        const z = 150 + Math.random() * 50;
        const length = 0.5 + Math.random() * 1.5;

        positions[i * 6] = x;
        positions[i * 6 + 1] = y;
        positions[i * 6 + 2] = z;
        positions[i * 6 + 3] = x;
        positions[i * 6 + 4] = y;
        positions[i * 6 + 5] = z - length;
      }
    }

    this.windStreaks.geometry.attributes.position.needsUpdate = true;
  }

  destroy() {
    if (this.windStreaks) {
      this.scene.remove(this.windStreaks);
      this.windStreaks.geometry.dispose();
      this.windStreaks.material.dispose();
    }
  }
}
