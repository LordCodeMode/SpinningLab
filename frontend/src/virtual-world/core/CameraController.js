/**
 * CameraController - Camera modes and follow logic
 */

import * as THREE from 'three';
import { gradientToPitch } from '../scene-config.js';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase'; // chase | wide | low
    this.target = null;

    this.baseFov = camera.fov;
    this.roll = 0;
    this.vibeTime = 0;
    this.smoothedHeading = 0;
    this.hasHeading = false;

    this.worldUp = new THREE.Vector3(0, 1, 0);
    this.forward = new THREE.Vector3(0, 0, 1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.cameraTarget = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.forwardToTarget = new THREE.Vector3();
    this.rollQuat = new THREE.Quaternion();

    this.modes = {
      chase: { distance: 4, height: 1.8, lookHeight: 1.0, lag: 5.4 },
      wide: { distance: 7, height: 3.0, lookHeight: 0.9, lag: 4.2 },
      low: { distance: 3, height: 1.0, lookHeight: 0.8, lag: 6.4 }
    };
  }

  setTarget(target) {
    this.target = target;
  }

  setMode(mode) {
    this.mode = mode || 'chase';
  }

  getMode() {
    return this.mode;
  }

  lerpAngle(a, b, t) {
    const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
    return a + delta * t;
  }

  update(deltaTime, gradientOrState = 0, maybeState = null) {
    if (!this.target) return;

    const modeConfig = this.modes[this.mode] || this.modes.chase;
    const safeDelta = THREE.MathUtils.clamp(deltaTime || 1 / 60, 1 / 240, 1 / 20);

    const dynamics = typeof gradientOrState === 'number'
      ? {
          gradient: gradientOrState,
          speedMps: maybeState?.speedMps || 0,
          roadHeading: maybeState?.roadHeading || 0,
          cadence: maybeState?.cadence || 0,
          steeringRate: maybeState?.steeringRate || 0
        }
      : (gradientOrState || {});

    const gradient = dynamics.gradient || 0;
    const speedMps = dynamics.speedMps || 0;
    const roadHeading = dynamics.roadHeading || 0;
    const cadence = dynamics.cadence || 0;
    const steeringRate = dynamics.steeringRate || 0;

    const pitchOffset = THREE.MathUtils.clamp(gradientToPitch(gradient) * 1.08, -0.14, 0.18);
    const speedNorm = THREE.MathUtils.clamp(speedMps / 15, 0, 1);

    // Speed-based FOV: subtle but noticeable race feel.
    const targetFov = this.baseFov + speedNorm * 4.5;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, THREE.MathUtils.clamp(safeDelta * 2.8, 0.05, 0.24));
    this.camera.updateProjectionMatrix();

    // Rider vibration from cadence and speed.
    this.vibeTime += safeDelta * (0.7 + speedNorm * 1.5 + cadence / 95);
    const vibeAmplitude = 0.006 + speedNorm * 0.01;
    const vibeX = Math.sin(this.vibeTime * 7.2) * vibeAmplitude;
    const vibeY = Math.cos(this.vibeTime * 11.5) * vibeAmplitude * 0.56;

    // Turn anticipation + stable heading-following chase camera.
    const turnLead = THREE.MathUtils.clamp(steeringRate * 0.22, -0.34, 0.34);
    const headingTarget = roadHeading + turnLead * 0.22;
    if (!this.hasHeading) {
      this.smoothedHeading = headingTarget;
      this.hasHeading = true;
    } else {
      this.smoothedHeading = this.lerpAngle(
        this.smoothedHeading,
        headingTarget,
        THREE.MathUtils.clamp(safeDelta * 3.2, 0.04, 0.24)
      );
    }

    this.forward.set(
      Math.sin(this.smoothedHeading),
      -pitchOffset * 0.48,
      Math.cos(this.smoothedHeading)
    ).normalize();
    this.right.crossVectors(this.worldUp, this.forward).normalize();

    const lookAhead = 4 + speedNorm * 4.6;
    const lateralLook = turnLead * lookAhead * 0.7;
    const sideOffset = -turnLead * (0.7 + speedNorm * 0.45);

    this.cameraTarget.copy(this.target.position)
      .addScaledVector(this.worldUp, modeConfig.height + pitchOffset * 1.2 + vibeY)
      .addScaledVector(this.forward, -(modeConfig.distance + speedNorm * 0.7))
      .addScaledVector(this.right, sideOffset + vibeX);

    this.lookTarget.copy(this.target.position)
      .addScaledVector(this.worldUp, modeConfig.lookHeight + pitchOffset * 2.1)
      .addScaledVector(this.forward, lookAhead)
      .addScaledVector(this.right, lateralLook);

    const followLerp = THREE.MathUtils.clamp(safeDelta * modeConfig.lag, 0.05, 0.35);
    this.camera.position.lerp(this.cameraTarget, followLerp);

    if (this.camera.position.distanceToSquared(this.lookTarget) > 0.0001) {
      this.camera.up.lerp(this.worldUp, THREE.MathUtils.clamp(safeDelta * 5, 0.08, 0.35)).normalize();
      this.camera.lookAt(this.lookTarget);
    }

    // Apply subtle roll around view direction without forcing Euler angles.
    const targetRoll = THREE.MathUtils.clamp(-turnLead * 0.055, -0.035, 0.035);
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, THREE.MathUtils.clamp(safeDelta * 3.5, 0.06, 0.22));
    this.forwardToTarget.copy(this.lookTarget).sub(this.camera.position).normalize();
    this.rollQuat.setFromAxisAngle(this.forwardToTarget, this.roll);
    this.camera.quaternion.multiply(this.rollQuat);
  }
}
