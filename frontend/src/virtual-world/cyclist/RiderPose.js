/**
 * RiderPose - Bike pose application for avatars
 */

export class RiderPose {
  applyAvatarBikePose(bones) {
    if (!bones) return;

    const setBase = (bone, rot) => {
      if (!bone) return;
      bone.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
      bone.userData.baseRot = bone.rotation.clone();
    };

    // Tilted hips for seated position
    setBase(bones.hips, { x: -0.20, y: 0, z: 0 });
    // Forward leaning spine for aero position
    setBase(bones.spine, { x: 0.50, y: 0, z: 0 });
    setBase(bones.spine1, { x: 0.40, y: 0, z: 0 });
    setBase(bones.spine2, { x: 0.30, y: 0, z: 0 });

    // Arms reaching forward to handlebars
    setBase(bones.leftArm, { x: 1.10, y: 0, z: 0.25 });
    setBase(bones.rightArm, { x: 1.10, y: 0, z: -0.25 });
    setBase(bones.leftForeArm, { x: 0.65, y: 0, z: 0 });
    setBase(bones.rightForeArm, { x: 0.65, y: 0, z: 0 });
    setBase(bones.leftHand, { x: 0.15, y: 0, z: 0 });
    setBase(bones.rightHand, { x: 0.15, y: 0, z: 0 });

    // Legs ready for pedaling
    setBase(bones.leftUpLeg, { x: 0.25, y: 0, z: 0 });
    setBase(bones.rightUpLeg, { x: 0.25, y: 0, z: 0 });
    setBase(bones.leftLeg, { x: 0.85, y: 0, z: 0 });
    setBase(bones.rightLeg, { x: 0.85, y: 0, z: 0 });
    setBase(bones.leftFoot, { x: -0.15, y: 0, z: 0 });
    setBase(bones.rightFoot, { x: -0.15, y: 0, z: 0 });
  }

  applyAvatarBikeTransform(avatar) {
    if (!avatar) return;

    // Base seated transform tuned for the road bike
    const seatY = 0.98;
    avatar.position.set(0, seatY - 0.50, -0.22);

    // Face forward along +Z
    avatar.rotation.set(0, 0, 0);
    avatar.rotation.x = 0.12;
  }
}
