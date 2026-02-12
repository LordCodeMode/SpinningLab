/**
 * WildlifeManager - Birds, butterflies, farm animals
 */

import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, VISIBLE_SEGMENTS } from '../scene-config.js';

export class WildlifeManager {
  constructor(scene) {
    this.scene = scene;
    this.birds = [];
    this.butterflies = [];
    this.farmAnimals = [];
    this.time = 0;
    this.sceneryLevel = 'standard';
  }

  create() {
    this.createBirds();
    this.createButterflies();
    this.createFarmAnimals();
  }

  createBirds() {
    const bodyGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const wingGeo = new THREE.BoxGeometry(0.18, 0.02, 0.06);
    const birdMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

    for (let i = 0; i < 6; i++) {
      const bird = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, birdMat);
      const leftWing = new THREE.Mesh(wingGeo, birdMat);
      const rightWing = new THREE.Mesh(wingGeo, birdMat);
      leftWing.position.set(-0.12, 0, 0);
      rightWing.position.set(0.12, 0, 0);
      bird.add(body, leftWing, rightWing);
      bird.position.set((Math.random() - 0.5) * 140, 30 + Math.random() * 15, 100 + Math.random() * 300);
      bird.userData = {
        speed: 6 + Math.random() * 4,
        wingPhase: Math.random() * Math.PI * 2
      };
      this.scene.add(bird);
      this.birds.push(bird);
    }
  }

  createButterflies() {
    const butterflyColors = [0xff6b9d, 0xffa500, 0xffff00, 0xff4444, 0xffffff];

    for (let i = 0; i < 15; i++) {
      const butterfly = new THREE.Group();

      const color = butterflyColors[Math.floor(Math.random() * butterflyColors.length)];
      const wingMat = new THREE.MeshBasicMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });

      const wingGeo = new THREE.PlaneGeometry(0.08, 0.06);
      const leftWing = new THREE.Mesh(wingGeo, wingMat);
      leftWing.position.x = -0.03;
      leftWing.rotation.y = 0.3;
      butterfly.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeo, wingMat);
      rightWing.position.x = 0.03;
      rightWing.rotation.y = -0.3;
      butterfly.add(rightWing);

      const bodyGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.04, 6);
      const bodyMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.x = Math.PI / 2;
      butterfly.add(body);

      butterfly.position.set(
        (Math.random() - 0.5) * 40,
        Math.random() * 4 + 1,
        Math.random() * 150 + 30
      );

      butterfly.userData = {
        baseZ: butterfly.position.z,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.0,
        orbitRadius: 1 + Math.random() * 3,
        wingPhase: Math.random() * Math.PI * 2,
        leftWing,
        rightWing
      };

      this.butterflies.push(butterfly);
      this.scene.add(butterfly);
    }
  }

  createFarmAnimals() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const cowMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
    const sheepMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.95 });

    // Create cows
    for (let i = 0; i < 15; i++) {
      const cow = this.createCow(cowMat);
      const side = Math.random() > 0.5 ? 1 : -1;
      cow.position.set(
        side * (ROAD_WIDTH / 2 + 22 + Math.random() * 28),
        0,
        Math.random() * maxDistance
      );
      cow.rotation.y = Math.random() * Math.PI * 2;
      cow.userData.baseZ = cow.position.z;
      this.farmAnimals.push(cow);
      this.scene.add(cow);
    }

    // Create sheep
    for (let i = 0; i < 20; i++) {
      const sheep = this.createSheep(sheepMat);
      const side = Math.random() > 0.5 ? 1 : -1;
      sheep.position.set(
        side * (ROAD_WIDTH / 2 + 24 + Math.random() * 24),
        0,
        Math.random() * maxDistance
      );
      sheep.rotation.y = Math.random() * Math.PI * 2;
      sheep.userData.baseZ = sheep.position.z;
      this.farmAnimals.push(sheep);
      this.scene.add(sheep);
    }
  }

  createCow(cowMat) {
    const cow = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(1.2, 0.8, 0.6);
    const body = new THREE.Mesh(bodyGeo, cowMat);
    body.position.y = 0.7;
    cow.add(body);

    const headGeo = new THREE.BoxGeometry(0.4, 0.35, 0.35);
    const head = new THREE.Mesh(headGeo, cowMat);
    head.position.set(0.65, 0.85, 0);
    cow.add(head);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6);
    const legPositions = [[-0.4, 0.25, 0.2], [-0.4, 0.25, -0.2], [0.4, 0.25, 0.2], [0.4, 0.25, -0.2]];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, cowMat);
      leg.position.set(...pos);
      cow.add(leg);
    });

    cow.scale.setScalar(0.5);
    return cow;
  }

  createSheep(sheepMat) {
    const sheep = new THREE.Group();

    const bodyGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const body = new THREE.Mesh(bodyGeo, sheepMat);
    body.position.y = 0.45;
    body.scale.set(1.2, 0.9, 0.9);
    sheep.add(body);

    const headGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0.35, 0.5, 0);
    sheep.add(head);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
    const legPositions = [[-0.15, 0.17, 0.12], [-0.15, 0.17, -0.12], [0.15, 0.17, 0.12], [0.15, 0.17, -0.12]];
    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(...pos);
      sheep.add(leg);
    });

    sheep.scale.setScalar(0.6);
    return sheep;
  }

  setDetailLevel(level) {
    const showClouds = level !== 'low';
    this.birds.forEach(bird => { bird.visible = showClouds; });
  }

  setSceneryLevel(level = 'standard') {
    this.sceneryLevel = level;
    const showBirds = level !== 'low';
    const showButterflies = level === 'high' || level === 'standard';
    const showAnimals = level === 'high' || level === 'standard';
    this.birds.forEach(bird => { bird.visible = showBirds; });
    this.butterflies.forEach(butterfly => { butterfly.visible = showButterflies; });
    this.farmAnimals.forEach(animal => { animal.visible = showAnimals; });
  }

  update(deltaTime, worldState) {
    this.time += deltaTime;
    const { totalDistance } = worldState;
    const aheadDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    // Update birds
    this.birds.forEach(bird => {
      if (bird.userData.baseZ === undefined) {
        bird.userData.baseZ = bird.position.z + totalDistance;
      }

      bird.userData.wingPhase += 0.12;
      const flap = Math.sin(bird.userData.wingPhase) * 0.4;
      if (bird.children[1]) bird.children[1].rotation.z = flap;
      if (bird.children[2]) bird.children[2].rotation.z = -flap;

      // Birds fly independently
      bird.userData.baseZ -= bird.userData.speed * 0.4;
      bird.position.x += Math.sin(this.time * 0.2) * 0.02;

      const relativeZ = bird.userData.baseZ - totalDistance;

      if (relativeZ < -120) {
        bird.userData.baseZ = totalDistance + 420 + Math.random() * 200;
        bird.position.x = (Math.random() - 0.5) * 140;
        bird.position.y = 28 + Math.random() * 18;
      }

      bird.position.z = bird.userData.baseZ - totalDistance;
    });

    // Update butterflies
    this.butterflies.forEach(butterfly => {
      const data = butterfly.userData;

      // Wing flapping
      data.wingPhase += 0.25;
      const wingAngle = Math.sin(data.wingPhase) * 0.8;
      if (data.leftWing) data.leftWing.rotation.y = 0.3 + wingAngle;
      if (data.rightWing) data.rightWing.rotation.y = -0.3 - wingAngle;

      // Floating movement
      data.phase += deltaTime * data.speed;
      butterfly.position.x += Math.sin(data.phase) * 0.02;
      butterfly.position.y += Math.cos(data.phase * 1.5) * 0.01;

      const relativeZ = data.baseZ - totalDistance;

      if (relativeZ < -50) {
        data.baseZ = totalDistance + 200 + Math.random() * 150;
        butterfly.position.x = (Math.random() - 0.5) * 40;
        butterfly.position.y = Math.random() * 4 + 1;
      }

      butterfly.position.z = data.baseZ - totalDistance;
    });

    // Update farm animals
    this.farmAnimals.forEach(animal => {
      if (animal.userData.baseZ === undefined) {
        animal.userData.baseZ = animal.position.z;
      }

      const relativeZ = animal.userData.baseZ - totalDistance;

      if (relativeZ < -150) {
        animal.userData.baseZ += aheadDistance;
      }

      animal.position.z = animal.userData.baseZ - totalDistance;
    });
  }

  destroy() {
    const allObjects = [...this.birds, ...this.butterflies, ...this.farmAnimals];
    allObjects.forEach(obj => {
      this.scene.remove(obj);
      obj.traverse?.(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });

    this.birds = [];
    this.butterflies = [];
    this.farmAnimals = [];
  }
}
