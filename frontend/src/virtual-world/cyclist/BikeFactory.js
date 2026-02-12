/**
 * BikeFactory - Procedural bike frame, wheels, and cranks
 */

import * as THREE from 'three';
import { COLORS } from '../scene-config.js';

export class BikeFactory {
  constructor() {
    this.materials = this.createMaterials();
  }

  createMaterials() {
    return {
      frame: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.5, roughness: 0.5 }),
      accent: new THREE.MeshStandardMaterial({ color: 0xff6600, metalness: 0.3, roughness: 0.5 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }),
      hub: new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5 }),
      crank: new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 })
    };
  }

  createBike() {
    const bikeGroup = new THREE.Group();
    const mats = this.materials;

    // Key frame points - bike faces +Z
    const rearAxle = new THREE.Vector3(0, 0.35, -0.42);
    const frontAxle = new THREE.Vector3(0, 0.35, 0.42);
    const bottomBracket = new THREE.Vector3(0, 0.32, 0);
    const seatTop = new THREE.Vector3(0, 0.92, -0.15);
    const headTube = new THREE.Vector3(0, 0.78, 0.32);

    // Simple tube helper
    const makeTube = (start, end, radius = 0.02) => {
      const dir = new THREE.Vector3().subVectors(end, start);
      const len = dir.length();
      const geo = new THREE.CylinderGeometry(radius, radius, len, 8);
      const mesh = new THREE.Mesh(geo, mats.frame);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      mesh.castShadow = true;
      mesh.userData.proceduralBike = true;
      return mesh;
    };

    // Frame tubes
    bikeGroup.add(makeTube(seatTop, headTube, 0.018));
    bikeGroup.add(makeTube(seatTop, bottomBracket, 0.02));
    bikeGroup.add(makeTube(bottomBracket, headTube, 0.02));
    bikeGroup.add(makeTube(bottomBracket, rearAxle, 0.015));
    bikeGroup.add(makeTube(headTube, frontAxle, 0.015));
    bikeGroup.add(makeTube(seatTop, rearAxle, 0.012));

    // Saddle
    const saddleGeo = new THREE.BoxGeometry(0.12, 0.03, 0.2);
    const saddle = new THREE.Mesh(saddleGeo, mats.frame);
    saddle.position.set(0, 0.94, -0.15);
    saddle.castShadow = true;
    saddle.userData.proceduralBike = true;
    bikeGroup.add(saddle);

    // Handlebar
    const handlebarGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.38, 8);
    const handlebar = new THREE.Mesh(handlebarGeo, mats.accent);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.85, 0.38);
    handlebar.castShadow = true;
    handlebar.userData.proceduralBike = true;
    bikeGroup.add(handlebar);

    // Create wheels
    const frontWheel = this.createWheel();
    frontWheel.position.copy(frontAxle);
    frontWheel.userData.proceduralBike = true;
    bikeGroup.add(frontWheel);

    const rearWheel = this.createWheel();
    rearWheel.position.copy(rearAxle);
    rearWheel.userData.proceduralBike = true;
    bikeGroup.add(rearWheel);

    // Cranks and pedals
    const crankGroup = this.createCranks();
    crankGroup.position.copy(bottomBracket);
    crankGroup.userData.keepWhenExternalBike = true;
    bikeGroup.add(crankGroup);

    return {
      bikeGroup,
      frontWheel,
      rearWheel,
      crankGroup,
      bottomBracket: bottomBracket.clone(),
      crankLength: 0.16
    };
  }

  createWheel() {
    const wheelGroup = new THREE.Group();
    const mats = this.materials;

    const tireGeo = new THREE.TorusGeometry(0.32, 0.025, 12, 32);
    const tire = new THREE.Mesh(tireGeo, mats.tire);
    tire.rotation.y = Math.PI / 2;
    wheelGroup.add(tire);

    // Hub
    const hubGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8);
    const hub = new THREE.Mesh(hubGeo, mats.frame);
    hub.rotation.z = Math.PI / 2;
    wheelGroup.add(hub);

    return wheelGroup;
  }

  createCranks() {
    const crankGroup = new THREE.Group();
    const mats = this.materials;
    const crankLen = 0.16;

    const crankArmGeo = new THREE.BoxGeometry(0.02, 0.01, crankLen);

    const rightCrank = new THREE.Mesh(crankArmGeo, mats.crank);
    rightCrank.position.set(0.07, 0, crankLen / 2);
    crankGroup.add(rightCrank);

    const leftCrank = new THREE.Mesh(crankArmGeo, mats.crank);
    leftCrank.position.set(-0.07, 0, -crankLen / 2);
    crankGroup.add(leftCrank);

    const pedalGeo = new THREE.BoxGeometry(0.08, 0.015, 0.04);
    const rightPedal = new THREE.Mesh(pedalGeo, mats.accent);
    rightPedal.position.set(0.07, 0, crankLen);
    rightPedal.name = 'rightPedal';
    crankGroup.add(rightPedal);

    const leftPedal = new THREE.Mesh(pedalGeo, mats.accent);
    leftPedal.position.set(-0.07, 0, -crankLen);
    leftPedal.name = 'leftPedal';
    crankGroup.add(leftPedal);

    return crankGroup;
  }

  destroy() {
    Object.values(this.materials).forEach(mat => mat.dispose());
  }
}
