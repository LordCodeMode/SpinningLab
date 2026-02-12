/**
 * RiderFactory - Procedural rider (torso, arms, legs)
 */

import * as THREE from 'three';

export class RiderFactory {
  constructor() {
    this.materials = this.createMaterials();
  }

  createMaterials() {
    return {
      jersey: new THREE.MeshStandardMaterial({
        color: 0xff2222,
        emissive: 0x440000,
        emissiveIntensity: 0.3,
        roughness: 0.5,
        metalness: 0.05
      }),
      shorts: new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.7,
        metalness: 0.05
      }),
      skin: new THREE.MeshStandardMaterial({
        color: 0xffd4b8,
        emissive: 0x331100,
        emissiveIntensity: 0.15,
        roughness: 0.65,
        metalness: 0
      }),
      helmet: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x222222,
        emissiveIntensity: 0.2,
        roughness: 0.25,
        metalness: 0.15
      }),
      shoe: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x111111,
        emissiveIntensity: 0.1,
        roughness: 0.4,
        metalness: 0.1
      }),
      glove: new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.8
      }),
      vent: new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9
      }),
      sole: new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.9
      })
    };
  }

  createRider() {
    const riderGroup = new THREE.Group();
    const mats = this.materials;

    // Torso - leaning forward
    const torsoGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.35, 12);
    const torso = new THREE.Mesh(torsoGeo, mats.jersey);
    torso.rotation.x = 0.7;
    torso.position.set(0, 0.98, 0.08);
    torso.castShadow = true;
    riderGroup.add(torso);

    // Back detail
    const backGeo = new THREE.BoxGeometry(0.24, 0.26, 0.1);
    const back = new THREE.Mesh(backGeo, mats.jersey);
    back.position.set(0, 1.0, -0.02);
    back.rotation.x = 0.5;
    back.castShadow = true;
    riderGroup.add(back);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.08, 10);
    const neck = new THREE.Mesh(neckGeo, mats.skin);
    neck.position.set(0, 1.02, 0.15);
    neck.rotation.x = 0.4;
    neck.castShadow = true;
    riderGroup.add(neck);

    // Head
    const headGeo = new THREE.SphereGeometry(0.09, 14, 14);
    const head = new THREE.Mesh(headGeo, mats.skin);
    head.position.set(0, 1.08, 0.2);
    head.castShadow = true;
    riderGroup.add(head);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const leftEar = new THREE.Mesh(earGeo, mats.skin);
    leftEar.position.set(-0.085, 1.07, 0.18);
    leftEar.scale.set(0.6, 1, 0.8);
    riderGroup.add(leftEar);
    const rightEar = new THREE.Mesh(earGeo, mats.skin);
    rightEar.position.set(0.085, 1.07, 0.18);
    rightEar.scale.set(0.6, 1, 0.8);
    riderGroup.add(rightEar);

    // Helmet
    const helmetGeo = new THREE.SphereGeometry(0.11, 14, 14);
    const helmet = new THREE.Mesh(helmetGeo, mats.helmet);
    helmet.position.set(0, 1.12, 0.2);
    helmet.scale.set(1.0, 0.85, 1.25);
    helmet.castShadow = true;
    riderGroup.add(helmet);

    // Helmet vents
    for (let i = -1; i <= 1; i++) {
      const ventGeo = new THREE.BoxGeometry(0.015, 0.04, 0.08);
      const vent = new THREE.Mesh(ventGeo, mats.vent);
      vent.position.set(i * 0.04, 1.16, 0.12);
      vent.rotation.x = 0.3;
      riderGroup.add(vent);
    }

    // Shoulders
    const shoulderGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const leftShoulder = new THREE.Mesh(shoulderGeo, mats.jersey);
    leftShoulder.position.set(-0.13, 1.0, 0.06);
    leftShoulder.castShadow = true;
    riderGroup.add(leftShoulder);
    const rightShoulder = new THREE.Mesh(shoulderGeo, mats.jersey);
    rightShoulder.position.set(0.13, 1.0, 0.06);
    rightShoulder.castShadow = true;
    riderGroup.add(rightShoulder);

    // Upper arms
    const upperArmGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.15, 10);
    const leftUpperArm = new THREE.Mesh(upperArmGeo, mats.jersey);
    leftUpperArm.rotation.x = 0.7;
    leftUpperArm.rotation.z = 0.2;
    leftUpperArm.position.set(-0.14, 0.96, 0.12);
    leftUpperArm.castShadow = true;
    riderGroup.add(leftUpperArm);

    const rightUpperArm = new THREE.Mesh(upperArmGeo, mats.jersey);
    rightUpperArm.rotation.x = 0.7;
    rightUpperArm.rotation.z = -0.2;
    rightUpperArm.position.set(0.14, 0.96, 0.12);
    rightUpperArm.castShadow = true;
    riderGroup.add(rightUpperArm);

    // Lower arms (skin)
    const lowerArmGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.18, 10);
    const leftLowerArm = new THREE.Mesh(lowerArmGeo, mats.skin);
    leftLowerArm.rotation.x = 1.0;
    leftLowerArm.rotation.z = 0.15;
    leftLowerArm.position.set(-0.16, 0.88, 0.26);
    leftLowerArm.castShadow = true;
    riderGroup.add(leftLowerArm);

    const rightLowerArm = new THREE.Mesh(lowerArmGeo, mats.skin);
    rightLowerArm.rotation.x = 1.0;
    rightLowerArm.rotation.z = -0.15;
    rightLowerArm.position.set(0.16, 0.88, 0.26);
    rightLowerArm.castShadow = true;
    riderGroup.add(rightLowerArm);

    // Hands
    const handGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const leftHand = new THREE.Mesh(handGeo, mats.skin);
    leftHand.position.set(-0.17, 0.84, 0.36);
    leftHand.scale.set(1, 0.7, 1.2);
    riderGroup.add(leftHand);
    const rightHand = new THREE.Mesh(handGeo, mats.skin);
    rightHand.position.set(0.17, 0.84, 0.36);
    rightHand.scale.set(1, 0.7, 1.2);
    riderGroup.add(rightHand);

    // Gloves
    const gloveGeo = new THREE.BoxGeometry(0.04, 0.02, 0.05);
    const leftGlove = new THREE.Mesh(gloveGeo, mats.glove);
    leftGlove.position.set(-0.17, 0.835, 0.36);
    riderGroup.add(leftGlove);
    const rightGlove = new THREE.Mesh(gloveGeo, mats.glove);
    rightGlove.position.set(0.17, 0.835, 0.36);
    riderGroup.add(rightGlove);

    // Hips
    const hipsGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const hips = new THREE.Mesh(hipsGeo, mats.shorts);
    hips.position.set(0, 0.88, -0.12);
    hips.scale.set(1.2, 0.65, 0.9);
    hips.castShadow = true;
    riderGroup.add(hips);

    // Create animated legs
    const legs = this.createAnimatedLegs(riderGroup);

    return {
      riderGroup,
      ...legs
    };
  }

  createAnimatedLegs(riderGroup) {
    const mats = this.materials;

    const thighGeo = new THREE.CylinderGeometry(0.058, 0.052, 0.32, 10);
    const kneeGeo = new THREE.SphereGeometry(0.045, 10, 10);
    const calfGeo = new THREE.CylinderGeometry(0.048, 0.038, 0.30, 10);
    const ankleGeo = new THREE.SphereGeometry(0.032, 8, 8);
    const shoeGeo = new THREE.BoxGeometry(0.08, 0.05, 0.16);
    const soleGeo = new THREE.BoxGeometry(0.08, 0.015, 0.16);

    const thighLength = 0.32;
    const shinLength = 0.30;

    const makeLeg = (side) => {
      const hipPivot = new THREE.Group();
      hipPivot.position.set(side * 0.095, 0.8, -0.08);

      // Hip joint
      const hipJointGeo = new THREE.SphereGeometry(0.05, 10, 10);
      const hipJoint = new THREE.Mesh(hipJointGeo, mats.shorts);
      hipJoint.castShadow = true;
      hipPivot.add(hipJoint);

      // Thigh
      const thigh = new THREE.Mesh(thighGeo, mats.shorts);
      thigh.position.y = -0.16;
      thigh.castShadow = true;
      hipPivot.add(thigh);

      // Knee pivot
      const kneePivot = new THREE.Group();
      kneePivot.position.y = -0.32;
      hipPivot.add(kneePivot);

      // Knee cap (skin)
      const knee = new THREE.Mesh(kneeGeo, mats.skin);
      knee.scale.set(1, 0.8, 1);
      knee.castShadow = true;
      kneePivot.add(knee);

      // Calf (skin)
      const calf = new THREE.Mesh(calfGeo, mats.skin);
      calf.position.y = -0.15;
      calf.castShadow = true;
      kneePivot.add(calf);

      // Ankle
      const ankle = new THREE.Mesh(ankleGeo, mats.skin);
      ankle.position.set(0, -0.30, 0);
      kneePivot.add(ankle);

      // Shoe
      const shoe = new THREE.Mesh(shoeGeo, mats.shoe);
      shoe.position.set(0, -0.33, 0.04);
      shoe.castShadow = true;
      kneePivot.add(shoe);

      // Sole
      const sole = new THREE.Mesh(soleGeo, mats.sole);
      sole.position.set(0, -0.355, 0.04);
      kneePivot.add(sole);

      riderGroup.add(hipPivot);
      return { hipPivot, kneePivot, shoe };
    };

    const rightLeg = makeLeg(1);
    const leftLeg = makeLeg(-1);

    return {
      rightLegPivot: rightLeg.hipPivot,
      rightKneePivot: rightLeg.kneePivot,
      leftLegPivot: leftLeg.hipPivot,
      leftKneePivot: leftLeg.kneePivot,
      rightFoot: rightLeg.shoe,
      leftFoot: leftLeg.shoe,
      thighLength,
      shinLength
    };
  }

  destroy() {
    Object.values(this.materials).forEach(mat => mat.dispose());
  }
}
