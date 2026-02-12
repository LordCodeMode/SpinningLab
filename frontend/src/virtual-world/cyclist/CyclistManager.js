/**
 * CyclistManager - Main coordinator for bike + rider
 */

import * as THREE from 'three';
import { ALT_SCALE, ROAD_SEGMENT_LENGTH, gradientToPitch } from '../scene-config.js';
import { BikeFactory } from './BikeFactory.js';
import { RiderFactory } from './RiderFactory.js';
import { BikeModelLoader } from './BikeModelLoader.js';
import { AvatarLoader } from './AvatarLoader.js';
import { PedalingAnimation } from './PedalingAnimation.js';

export class CyclistManager {
  constructor(scene) {
    this.scene = scene;

    // Factories and loaders
    this.bikeFactory = new BikeFactory();
    this.riderFactory = new RiderFactory();
    this.bikeModelLoader = new BikeModelLoader();
    this.avatarLoader = new AvatarLoader();
    this.pedalingAnimation = new PedalingAnimation();

    // Components
    this.cyclist = null;
    this.bike = null;
    this.rider = null;
    this.bikeModel = null;
    this.avatar = null;
    this.cyclistFbx = null;

    // Animation components
    this.crankGroup = null;
    this.frontWheel = null;
    this.rearWheel = null;
    this.rightPedal = null;
    this.leftPedal = null;
    this.rightLegPivot = null;
    this.leftLegPivot = null;
    this.rightKneePivot = null;
    this.leftKneePivot = null;
    this.rightFoot = null;
    this.leftFoot = null;
    this.thighLength = 0.32;
    this.shinLength = 0.30;
    this.bottomBracket = null;
    this.crankLength = 0.16;

    // Avatar animation
    this.avatarBones = null;
    this.avatarMixer = null;
    this.cyclistFbxMixer = null;
    this.cyclistFbxAction = null;

    // External model components
    this.externalCrankNodes = [];
    this.externalPedalNodes = [];

    // Configuration
    this.useExternalBike = true;
    this.useCyclistFbx = true;
    this.useAvatarIK = true;

    // URLs
    this.bikeModelUrl = '/models/bikered.glb';
    const backendOrigin = (typeof window !== 'undefined' && window.location)
      ? window.location.origin.replace(/:\d+$/, ':8000')
      : 'http://localhost:8000';
    this.avatarUrl = `${backendOrigin}/api/assets/rpm-avatar`;
    this.avatarFallbackUrls = [
      'https://models.readyplayer.me/64f1b9e005b410c1b9f8a6b7.glb',
      'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/RiggedSimple/glTF-Binary/RiggedSimple.glb'
    ];
    this.cycleAnimationUrl = '/avatars/anim_Relaxed_Pedal_Seated_Loop.FBX';

    // State
    this.cyclistSway = 0;
    this.time = 0;
    this.lastRoadHeading = 0;
    this.smoothedPitch = 0;
    this.baseRiderY = 0.34;
    this.riderBasePose = {
      positionY: 0,
      rotationX: 0,
      rotationZ: 0
    };
    this.fbxBasePose = null;
    this.avatarBasePose = null;
  }

  async init() {
    // Create main cyclist group
    this.cyclist = new THREE.Group();
    this.cyclist.position.set(0, 0, 10);
    this.scene.add(this.cyclist);

    // Create procedural bike
    const bikeComponents = this.bikeFactory.createBike();
    this.bike = bikeComponents.bikeGroup;
    this.frontWheel = bikeComponents.frontWheel;
    this.rearWheel = bikeComponents.rearWheel;
    this.crankGroup = bikeComponents.crankGroup;
    this.bottomBracket = bikeComponents.bottomBracket;
    this.crankLength = bikeComponents.crankLength;
    this.rightPedal = this.crankGroup.getObjectByName('rightPedal');
    this.leftPedal = this.crankGroup.getObjectByName('leftPedal');
    this.cyclist.add(this.bike);

    // Create procedural rider
    const riderComponents = this.riderFactory.createRider();
    this.rider = riderComponents.riderGroup;
    this.rightLegPivot = riderComponents.rightLegPivot;
    this.rightKneePivot = riderComponents.rightKneePivot;
    this.leftLegPivot = riderComponents.leftLegPivot;
    this.leftKneePivot = riderComponents.leftKneePivot;
    this.rightFoot = riderComponents.rightFoot;
    this.leftFoot = riderComponents.leftFoot;
    this.thighLength = riderComponents.thighLength;
    this.shinLength = riderComponents.shinLength;
    this.cyclist.add(this.rider);
    this.riderBasePose = {
      positionY: this.rider.position.y,
      rotationX: this.rider.rotation.x,
      rotationZ: this.rider.rotation.z
    };

    // Load external bike model
    if (this.useExternalBike) {
      try {
        const result = await this.bikeModelLoader.load(
          this.bikeModelUrl,
          this.cyclist,
          this.bike,
          this.crankGroup,
          this.bottomBracket
        );
        this.bikeModel = result.bikeModel;
        this.externalCrankNodes = result.externalCrankNodes;
        this.externalPedalNodes = result.externalPedalNodes;
        if (result.externalCrankCenter) {
          this.bottomBracket = result.bottomBracket;
        }
      } catch (e) {
        console.warn('External bike model failed to load, using procedural bike', e);
      }
    }

    // Load cyclist model
    if (this.useCyclistFbx) {
      try {
        const result = await this.avatarLoader.loadFBXCyclist(
          this.cycleAnimationUrl,
          this.cyclist,
          this.rider,
          new THREE.Vector3(0, 0.98, -0.25)
        );
        if (result) {
          this.cyclistFbx = result.cyclistFbx;
          this.cyclistFbxMixer = result.cyclistFbxMixer;
          this.cyclistFbxAction = result.cyclistFbxAction;
          this.fbxBasePose = {
            positionY: this.cyclistFbx.position.y,
            rotationX: this.cyclistFbx.rotation.x,
            rotationZ: this.cyclistFbx.rotation.z
          };
        }
      } catch (e) {
        console.warn('FBX cyclist failed, falling back to RPM avatar', e);
        const result = await this.avatarLoader.loadRPMAvatar(
          this.avatarUrl,
          this.avatarFallbackUrls,
          this.cyclist,
          this.rider
        );
        if (result) {
          this.avatar = result.avatar;
          this.avatarBones = result.avatarBones;
          this.avatarMixer = result.avatarMixer;
          this.avatarBasePose = {
            positionY: this.avatar.position.y,
            rotationX: this.avatar.rotation.x,
            rotationZ: this.avatar.rotation.z
          };
        }
      }
    } else {
      const result = await this.avatarLoader.loadRPMAvatar(
        this.avatarUrl,
        this.avatarFallbackUrls,
        this.cyclist,
        this.rider
      );
      if (result) {
        this.avatar = result.avatar;
        this.avatarBones = result.avatarBones;
        this.avatarMixer = result.avatarMixer;
        this.avatarBasePose = {
          positionY: this.avatar.position.y,
          rotationX: this.avatar.rotation.x,
          rotationZ: this.avatar.rotation.z
        };
      }
    }

    this.applyMaterialUpgrades();
    this.lastRoadHeading = this.cyclist?.rotation?.y || 0;
  }

  getCyclist() {
    return this.cyclist;
  }

  applyMaterialUpgrades() {
    if (!this.cyclist) return;

    this.cyclist.traverse((node) => {
      if (!node?.isMesh || !node.material) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];

      mats.forEach((mat) => {
        if (!mat || !('roughness' in mat)) return;

        const name = `${node.name || ''} ${mat.name || ''}`.toLowerCase();

        mat.envMapIntensity = 0.75;

        // Carbon/bike frame feel.
        if (name.includes('frame') || name.includes('bike') || name.includes('fork')) {
          mat.roughness = Math.min(mat.roughness ?? 0.45, 0.38);
          mat.metalness = Math.max(mat.metalness ?? 0.05, 0.12);
          if ('clearcoat' in mat) {
            mat.clearcoat = 0.6;
            mat.clearcoatRoughness = 0.28;
          }
        }

        // Tires should stay matte with depth.
        if (name.includes('tire') || name.includes('tyre')) {
          mat.roughness = 0.95;
          mat.metalness = 0.02;
        }

        // Spokes and metal bits.
        if (name.includes('spoke') || name.includes('chain') || name.includes('metal')) {
          mat.roughness = 0.24;
          mat.metalness = 0.68;
        }

        // Fabrics: jersey + shorts.
        if (name.includes('jersey') || name.includes('cloth') || name.includes('shirt')) {
          mat.roughness = 0.8;
          mat.metalness = 0.02;
        }
        if (name.includes('short') || name.includes('pant')) {
          mat.roughness = 0.88;
          mat.metalness = 0.02;
        }

        // Skin retains soft highlight.
        if (name.includes('skin') || name.includes('face') || name.includes('arm')) {
          mat.roughness = 0.58;
          mat.metalness = 0;
        }

        mat.needsUpdate = true;
      });
    });
  }

  update(deltaTime, worldState) {
    this.time += deltaTime;
    const {
      speedMps,
      state,
      roadOffset,
      roadHeading,
      currentGradient,
      totalDistance,
      currentAltitude,
      routeStyle,
      sceneryProfile,
      getElevationAt
    } = worldState;
    const cadence = state?.cadence || 0;
    const power = state?.power || 0;

    // Update animation mixers
    if (this.avatarMixer) {
      this.avatarMixer.update(deltaTime);
    }
    if (this.cyclistFbxMixer && !this.cyclistFbxAction) {
      const timeScale = Math.max(0.2, cadence / 70);
      this.cyclistFbxMixer.update(deltaTime * timeScale);
    }

    // Update cyclist position
    if (this.cyclist) {
      const riderAnchorZ = this.cyclist.position.z || 10;
      const roadSampleDistance = (totalDistance || 0) + riderAnchorZ + ROAD_SEGMENT_LENGTH * 0.5;
      const roadSample = getElevationAt?.(roadSampleDistance);
      const sampledAltitude = roadSample?.altitude ?? currentAltitude ?? 0;
      const sampledGradient = roadSample?.gradient ?? currentGradient ?? 0;
      const elevationOffset = (sampledAltitude - (currentAltitude || 0)) * ALT_SCALE;

      const mountainness = sceneryProfile?.mountainness || 0;
      const routeRoadLift = THREE.MathUtils.clamp(routeStyle?.roadLift || 0, 0, 0.28);
      const extraRoadLift = routeRoadLift * (0.66 + mountainness * 0.34);
      const roadBaseY = 0.205 + extraRoadLift;

      const pitchTarget = -gradientToPitch(sampledGradient);
      const pitchSmoothing = 1 - Math.exp(-deltaTime / 0.12);
      this.smoothedPitch += (pitchTarget - this.smoothedPitch) * pitchSmoothing;

      const pitchLift = Math.abs(this.smoothedPitch) * 0.17;
      const riderClearance = 0.13;
      const targetY = roadBaseY + elevationOffset + riderClearance + pitchLift;
      const ySmoothing = 1 - Math.exp(-deltaTime / 0.08);
      this.baseRiderY += (targetY - this.baseRiderY) * ySmoothing;

      const headingDelta = Math.atan2(
        Math.sin(roadHeading - this.lastRoadHeading),
        Math.cos(roadHeading - this.lastRoadHeading)
      );
      this.lastRoadHeading = roadHeading;
      const turnRate = headingDelta / Math.max(deltaTime, 0.0001);

      const pedalPhase = this.pedalingAnimation?.pedalAngle || 0;
      const cadenceRatio = THREE.MathUtils.clamp(cadence / 95, 0, 1.45);
      const effort = THREE.MathUtils.clamp(Math.max(0, sampledGradient) * 7.5 + Math.max(0, (power - 220) / 240), 0, 1);
      const standIntensity = THREE.MathUtils.clamp((effort - 0.32) * 1.4, 0, 1);

      this.cyclist.visible = true;
      this.cyclist.position.x = roadOffset;
      this.cyclist.position.y = this.baseRiderY;
      this.cyclist.rotation.y = roadHeading;

      const cadenceSway = cadence > 0
        ? Math.sin(pedalPhase + Math.PI / 2) * (0.006 + cadenceRatio * 0.006)
        : 0;
      const standingRock = standIntensity * Math.sin(pedalPhase) * 0.03;
      const turnLean = THREE.MathUtils.clamp(-turnRate * 0.012, -0.09, 0.09);
      this.cyclistSway = cadenceSway + standingRock;
      this.cyclist.rotation.z = this.cyclistSway + turnLean;

      // Align with road pitch
      this.cyclist.rotation.x = this.smoothedPitch;

      if (this.rider?.visible) {
        const riderBob = Math.sin(pedalPhase * 2) * (0.003 + standIntensity * 0.009);
        this.rider.position.y = this.riderBasePose.positionY + riderBob + standIntensity * 0.008;
        this.rider.rotation.x = this.riderBasePose.rotationX - standIntensity * 0.08 - Math.max(0, this.smoothedPitch) * 0.34;
        this.rider.rotation.z = this.riderBasePose.rotationZ + (this.cyclist.rotation.z * 0.5);
      }

      if (this.cyclistFbx?.visible && this.fbxBasePose) {
        this.cyclistFbx.position.y = this.fbxBasePose.positionY + Math.sin(pedalPhase * 2) * (0.002 + standIntensity * 0.007);
        this.cyclistFbx.rotation.x = this.fbxBasePose.rotationX - standIntensity * 0.06;
        this.cyclistFbx.rotation.z = this.fbxBasePose.rotationZ + this.cyclist.rotation.z * 0.38;
      }

      if (this.avatar?.visible && this.avatarBasePose) {
        this.avatar.position.y = this.avatarBasePose.positionY + Math.sin(pedalPhase * 2) * (0.0015 + standIntensity * 0.005);
        this.avatar.rotation.x = this.avatarBasePose.rotationX - standIntensity * 0.05;
        this.avatar.rotation.z = this.avatarBasePose.rotationZ + this.cyclist.rotation.z * 0.32;
      }
    }

    // Animate pedaling
    this.pedalingAnimation.animatePedaling(deltaTime, cadence, speedMps, {
      crankGroup: this.crankGroup,
      externalCrankNodes: this.externalCrankNodes,
      rightPedal: this.rightPedal,
      leftPedal: this.leftPedal,
      rightLegPivot: this.rightLegPivot,
      leftLegPivot: this.leftLegPivot,
      rightKneePivot: this.rightKneePivot,
      leftKneePivot: this.leftKneePivot,
      frontWheel: this.frontWheel,
      rearWheel: this.rearWheel,
      avatarBones: this.avatarBones,
      useAvatarIK: this.useAvatarIK,
      cyclistFbxAction: this.cyclistFbxAction,
      cyclistFbxMixer: this.cyclistFbxMixer
    });
  }

  destroy() {
    if (this.cyclist) {
      this.scene.remove(this.cyclist);
      this.cyclist.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    this.bikeFactory.destroy();
    this.riderFactory.destroy();
  }
}
