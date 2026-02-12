/**
 * AvatarLoader - RPM avatar and FBX loading
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { BoneMapper } from './BoneMapper.js';
import { RiderPose } from './RiderPose.js';

export class AvatarLoader {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setCrossOrigin('anonymous');
    this.fbxLoader = new FBXLoader();
    this.fbxLoader.setCrossOrigin('anonymous');
    this.boneMapper = new BoneMapper();
    this.riderPose = new RiderPose();
  }

  async loadRPMAvatar(url, fallbackUrls, cyclist, rider) {
    const candidates = [url, ...(fallbackUrls || [])];

    try {
      const gltf = await new Promise((resolve, reject) => {
        const tryNext = (index) => {
          if (index >= candidates.length) return reject(new Error('All avatar URLs failed'));
          this.gltfLoader.load(candidates[index], resolve, undefined, () => tryNext(index + 1));
        };
        tryNext(0);
      });

      const avatar = gltf.scene;
      avatar.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Normalize scale
      const box = new THREE.Box3().setFromObject(avatar);
      const size = new THREE.Vector3();
      box.getSize(size);

      const targetHeight = 1.65;
      const scale = size.y > 0 ? targetHeight / size.y : 1;
      avatar.scale.setScalar(scale);

      const centeredBox = new THREE.Box3().setFromObject(avatar);
      const center = new THREE.Vector3();
      centeredBox.getCenter(center);
      avatar.position.sub(center);

      // Apply bike transform
      this.riderPose.applyAvatarBikeTransform(avatar);

      cyclist.add(avatar);

      // Hide procedural rider
      if (rider) rider.visible = false;

      // Map bones and apply pose
      const avatarBones = this.boneMapper.mapAvatarBones(avatar);
      this.riderPose.applyAvatarBikePose(avatarBones);

      let avatarMixer = null;
      let avatarAction = null;
      if (gltf.animations?.length) {
        avatarMixer = new THREE.AnimationMixer(avatar);
        avatarAction = avatarMixer.clipAction(gltf.animations[0]);
        avatarAction.play();
      }

      return {
        avatar,
        avatarBones,
        avatarMixer,
        avatarAction
      };
    } catch (error) {
      console.warn('Failed to load Ready Player Me avatar:', error);
      if (rider) rider.visible = true;
      return null;
    }
  }

  async loadFBXCyclist(url, cyclist, rider, seatPosition) {
    const fbx = await new Promise((resolve, reject) => {
      this.fbxLoader.load(url, resolve, undefined, reject);
    });

    // Create materials
    const jerseyMat = new THREE.MeshStandardMaterial({
      color: 0xff2222,
      emissive: 0x550000,
      emissiveIntensity: 0.25,
      roughness: 0.6,
      metalness: 0.05
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffccaa,
      emissive: 0x442211,
      emissiveIntensity: 0.2,
      roughness: 0.7,
      metalness: 0
    });
    const shortsMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.7,
      metalness: 0.05
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x333333,
      emissiveIntensity: 0.15,
      roughness: 0.3,
      metalness: 0.1
    });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      emissive: 0x111111,
      emissiveIntensity: 0.1,
      roughness: 0.5,
      metalness: 0.1
    });

    // Apply materials based on mesh position
    fbx.updateMatrixWorld(true);
    const overallBox = new THREE.Box3().setFromObject(fbx);
    const modelHeight = overallBox.max.y - overallBox.min.y;
    const modelMinY = overallBox.min.y;

    let meshCount = 0;
    fbx.traverse(child => { if (child.isMesh || child.isSkinnedMesh) meshCount++; });

    fbx.traverse(child => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const meshBox = new THREE.Box3().setFromObject(child);
        const meshCenter = new THREE.Vector3();
        meshBox.getCenter(meshCenter);
        const normalizedY = modelHeight > 0 ? (meshCenter.y - modelMinY) / modelHeight : 0.5;

        let newMaterial = jerseyMat;

        if (meshCount === 1) {
          newMaterial = jerseyMat;
        } else if (normalizedY > 0.80) {
          const meshWidth = meshBox.max.x - meshBox.min.x;
          newMaterial = (meshWidth > modelHeight * 0.06) ? helmetMat : skinMat;
        } else if (normalizedY > 0.62) {
          const meshWidth = meshBox.max.x - meshBox.min.x;
          newMaterial = (meshWidth < modelHeight * 0.04) ? skinMat : jerseyMat;
        } else if (normalizedY > 0.42) {
          newMaterial = jerseyMat;
        } else if (normalizedY > 0.15) {
          newMaterial = shortsMat;
        } else {
          newMaterial = shoeMat;
        }

        child.material = newMaterial;
      }
    });

    // Fix orientation
    let box = new THREE.Box3().setFromObject(fbx);
    let size = new THREE.Vector3();
    box.getSize(size);
    if (size.y > 0 && size.z > size.y * 1.2) {
      fbx.rotation.x = -Math.PI / 2;
      fbx.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(fbx);
      box.getSize(size);
    }

    // Scale to human height
    const targetHeight = 1.35;
    const scale = size.y > 0 ? targetHeight / size.y : 1;
    fbx.scale.setScalar(scale);

    // Position on bike
    const seat = (seatPosition || new THREE.Vector3(0, 0.98, -0.25)).clone();
    const hipBone = this.boneMapper.findHipBone(fbx);

    if (hipBone) {
      fbx.updateMatrixWorld(true);
      const hipWorld = new THREE.Vector3();
      hipBone.getWorldPosition(hipWorld);
      const hipLocal = fbx.worldToLocal(hipWorld.clone());

      const maxOffset = 2.5;
      const validHip = [hipLocal.x, hipLocal.y, hipLocal.z].every(Number.isFinite)
        && Math.abs(hipLocal.x) < maxOffset
        && Math.abs(hipLocal.y) < maxOffset
        && Math.abs(hipLocal.z) < maxOffset;

      if (validHip) {
        fbx.position.copy(seat).sub(hipLocal);
      } else {
        const centeredBox = new THREE.Box3().setFromObject(fbx);
        const center = new THREE.Vector3();
        centeredBox.getCenter(center);
        fbx.position.copy(seat).sub(center);
      }
    } else {
      const centeredBox = new THREE.Box3().setFromObject(fbx);
      const center = new THREE.Vector3();
      centeredBox.getCenter(center);
      fbx.position.copy(seat).sub(center);
    }

    fbx.position.y += 0.04;
    fbx.position.z += 0.03;
    fbx.rotation.y = 0;
    fbx.rotation.x += 0.08;

    cyclist.add(fbx);

    // Handle visibility
    if (meshCount < 5) {
      fbx.traverse(child => {
        if (child.isMesh || child.isSkinnedMesh) child.visible = false;
      });
      if (rider) rider.visible = true;
    } else {
      fbx.visible = true;
      if (rider) rider.visible = false;
    }

    let cyclistFbxMixer = null;
    let cyclistFbxAction = null;
    if (fbx.animations?.length) {
      cyclistFbxMixer = new THREE.AnimationMixer(fbx);
      cyclistFbxAction = cyclistFbxMixer.clipAction(fbx.animations[0]);
      cyclistFbxAction.play();
      cyclistFbxMixer.timeScale = 0;
    }

    return {
      cyclistFbx: fbx,
      cyclistFbxMixer,
      cyclistFbxAction
    };
  }
}
