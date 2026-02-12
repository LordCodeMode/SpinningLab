/**
 * PedalingAnimation - Leg IK, crank sync, wheel rotation
 */

import * as THREE from 'three';

export class PedalingAnimation {
  constructor() {
    this.pedalAngle = 0;
    this.wheelAngle = 0;
    this.pedalSpeedScale = 1.0;
  }

  animatePedaling(deltaTime, cadence, speedMps, components) {
    if (cadence <= 0) return;

    const {
      crankGroup,
      externalCrankNodes,
      rightPedal,
      leftPedal,
      rightLegPivot,
      leftLegPivot,
      rightKneePivot,
      leftKneePivot,
      frontWheel,
      rearWheel,
      avatarBones,
      useAvatarIK,
      cyclistFbxAction,
      cyclistFbxMixer
    } = components;

    // Update pedal angle based on cadence
    const pedalSpeed = (cadence / 60) * Math.PI * 2 * this.pedalSpeedScale;
    this.pedalAngle += pedalSpeed * deltaTime;

    // Crank rotation
    const crankAngle = -this.pedalAngle;

    if (crankGroup) {
      crankGroup.rotation.x = crankAngle;
    }

    if (externalCrankNodes?.length) {
      externalCrankNodes.forEach(node => {
        node.rotation.x = crankAngle;
      });
    }

    // Keep pedals level
    if (rightPedal) {
      rightPedal.rotation.x = -crankAngle;
    }
    if (leftPedal) {
      leftPedal.rotation.x = -crankAngle;
    }

    // Leg animation
    const rightAngle = crankAngle;
    const leftAngle = crankAngle + Math.PI;

    if (rightLegPivot) {
      rightLegPivot.rotation.x = Math.sin(rightAngle) * 0.35 + 0.45;
    }
    if (leftLegPivot) {
      leftLegPivot.rotation.x = Math.sin(leftAngle) * 0.35 + 0.45;
    }

    if (rightKneePivot) {
      rightKneePivot.rotation.x = Math.cos(rightAngle) * 0.4 + 0.6;
    }
    if (leftKneePivot) {
      leftKneePivot.rotation.x = Math.cos(leftAngle) * 0.4 + 0.6;
    }

    // Animate avatar bones if loaded
    if (useAvatarIK && avatarBones) {
      this.animateAvatarPedaling(avatarBones, crankAngle);
    }

    // Sync FBX rider animation
    if (cyclistFbxAction && cyclistFbxMixer) {
      const duration = cyclistFbxAction.getClip().duration || 1;
      const phase = ((this.pedalAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      cyclistFbxAction.time = (phase / (Math.PI * 2)) * duration;
      cyclistFbxMixer.update(0);
    }

    // Rotate wheels
    const wheelSpeed = speedMps / 0.35;
    this.wheelAngle += wheelSpeed * deltaTime;

    if (frontWheel) {
      frontWheel.rotation.x = this.wheelAngle;
    }
    if (rearWheel) {
      rearWheel.rotation.x = this.wheelAngle;
    }
  }

  animateAvatarPedaling(bones, crankAngle) {
    if (!bones) return;

    const apply = (bone, rotX) => {
      if (!bone || !bone.userData.baseRot) return;
      bone.rotation.x = bone.userData.baseRot.x + rotX;
    };

    const rightAngle = crankAngle;
    const leftAngle = crankAngle + Math.PI;

    // Thigh motion
    apply(bones.rightUpLeg, Math.sin(rightAngle) * 0.70);
    apply(bones.leftUpLeg, Math.sin(leftAngle) * 0.70);

    // Shin motion
    apply(bones.rightLeg, Math.cos(rightAngle) * 0.60 + 0.25);
    apply(bones.leftLeg, Math.cos(leftAngle) * 0.60 + 0.25);

    // Foot angles
    apply(bones.rightFoot, -Math.sin(rightAngle) * 0.25);
    apply(bones.leftFoot, -Math.sin(leftAngle) * 0.25);

    // Subtle arm movement
    apply(bones.leftArm, Math.sin(leftAngle) * 0.03);
    apply(bones.rightArm, Math.sin(rightAngle) * 0.03);
    apply(bones.leftForeArm, 0);
    apply(bones.rightForeArm, 0);
  }

  computePedalPosition(angle, side, crankLength, bottomBracket, pedalOffsetX = 0.12) {
    const radius = crankLength || 0.17;
    const bb = bottomBracket || new THREE.Vector3(0, 0.35, -0.05);

    return new THREE.Vector3(
      pedalOffsetX * side,
      bb.y - Math.sin(angle) * radius,
      bb.z + Math.cos(angle) * radius
    );
  }

  solveLegIK(hipPivot, kneePivot, targetPos, footMesh, pedalAngle, thighLength, shinLength) {
    if (!hipPivot || !kneePivot || !targetPos) return;

    const L1 = thighLength || 0.34;
    const L2 = shinLength || 0.34;
    const maxReach = L1 + L2 - 0.01;

    const dy = targetPos.y - hipPivot.position.y;
    const dz = targetPos.z - hipPivot.position.z;
    const dist = Math.sqrt(dy * dy + dz * dz);
    const clampedDist = Math.max(0.01, Math.min(dist, maxReach));

    const cosKnee = THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - clampedDist * clampedDist) / (2 * L1 * L2), -1, 1);
    const kneeBend = Math.PI - Math.acos(cosKnee);

    const cosHip = THREE.MathUtils.clamp((L1 * L1 + clampedDist * clampedDist - L2 * L2) / (2 * L1 * clampedDist), -1, 1);
    const forwardPitch = Math.atan2(dz, -dy);
    const hipAngle = forwardPitch - Math.acos(cosHip);

    hipPivot.rotation.x = THREE.MathUtils.lerp(hipPivot.rotation.x, hipAngle, 0.4);
    kneePivot.rotation.x = THREE.MathUtils.lerp(kneePivot.rotation.x, kneeBend, 0.5);

    if (footMesh) {
      const localTarget = kneePivot.worldToLocal(targetPos.clone());
      footMesh.position.lerp(localTarget, 0.6);
      footMesh.rotation.x = THREE.MathUtils.lerp(footMesh.rotation.x, -Math.sin(pedalAngle) * 0.25, 0.35);
    }
  }

  reset() {
    this.pedalAngle = 0;
    this.wheelAngle = 0;
  }
}
