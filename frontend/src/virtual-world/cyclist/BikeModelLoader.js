/**
 * BikeModelLoader - External GLB bike loading
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COLORS } from '../scene-config.js';

export class BikeModelLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.loader.setCrossOrigin('anonymous');
  }

  async load(url, cyclist, existingBike, crankGroup, bottomBracket) {
    const gltf = await new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });

    const model = gltf.scene;
    const externalCrankNodes = [];
    const externalPedalNodes = [];

    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (!mat) return;
          mat.color?.set?.(COLORS.bike);
          mat.transparent = false;
          mat.opacity = 1;
          mat.depthWrite = true;
          mat.needsUpdate = true;
        });
      }

      const name = child.name?.toLowerCase?.() || '';
      if (name.includes('crank') || name.includes('chainring') || name.includes('pedal')) {
        externalCrankNodes.push(child);
      }
      if (name.includes('pedal')) {
        externalPedalNodes.push(child);
      }
    });

    // Fix orientation if necessary
    let box = new THREE.Box3().setFromObject(model);
    let size = new THREE.Vector3();
    box.getSize(size);
    if (size.x > size.z * 1.2) {
      model.rotation.y = Math.PI / 2;
      model.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(model);
      box.getSize(size);
    }
    model.rotation.y += Math.PI;

    // Scale to a visible real-world size
    const targetLength = 0.9; // wheelbase
    const targetHeight = 1.0; // overall bike height
    const scaleZ = size.z > 0 ? targetLength / size.z : 1;
    const scaleY = size.y > 0 ? targetHeight / size.y : 1;
    const scale = Math.max(scaleZ, scaleY);
    model.scale.setScalar(scale);

    // Center on origin and drop to ground
    box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.sub(center);
    model.position.y -= box.min.y;
    model.position.y += 0.02;
    model.position.z += 0.06;

    cyclist.add(model);

    // Update crank position from external model
    let externalCrankCenter = null;
    if (externalCrankNodes.length && crankGroup) {
      const crankWorld = new THREE.Vector3();
      externalCrankNodes[0].getWorldPosition(crankWorld);
      const crankLocal = cyclist.worldToLocal(crankWorld.clone());
      externalCrankCenter = crankLocal;
      crankGroup.position.copy(crankLocal);

      // Hide procedural crank meshes
      crankGroup.traverse(child => {
        if (child.isMesh) child.visible = false;
      });
    }

    // Hide procedural bike frame/wheels
    if (existingBike) {
      existingBike.traverse(child => {
        if (child.userData.proceduralBike && !child.userData.keepWhenExternalBike) {
          child.visible = false;
        }
      });
    }

    return {
      bikeModel: model,
      externalCrankNodes,
      externalPedalNodes,
      externalCrankCenter,
      bottomBracket: externalCrankCenter || bottomBracket
    };
  }
}
