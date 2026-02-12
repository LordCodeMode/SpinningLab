/**
 * BoneMapper - Avatar bone discovery and mapping
 */

export class BoneMapper {
  mapAvatarBones(avatar) {
    const bones = {};
    avatar.traverse(child => {
      if (!child.isBone) return;
      const name = child.name.toLowerCase();

      if (!bones.hips && name.includes('hips')) bones.hips = child;
      if (!bones.spine && name === 'spine') bones.spine = child;
      if (!bones.spine1 && (name.includes('spine1') || name.includes('spine_1'))) bones.spine1 = child;
      if (!bones.spine2 && (name.includes('spine2') || name.includes('spine_2'))) bones.spine2 = child;

      if (!bones.leftUpLeg && (name.includes('leftupleg') || name.includes('leftthigh'))) bones.leftUpLeg = child;
      if (!bones.leftLeg && (name.includes('leftleg') || name.includes('leftlowerleg'))) bones.leftLeg = child;
      if (!bones.leftFoot && name.includes('leftfoot')) bones.leftFoot = child;

      if (!bones.rightUpLeg && (name.includes('rightupleg') || name.includes('rightthigh'))) bones.rightUpLeg = child;
      if (!bones.rightLeg && (name.includes('rightleg') || name.includes('rightlowerleg'))) bones.rightLeg = child;
      if (!bones.rightFoot && name.includes('rightfoot')) bones.rightFoot = child;

      if (!bones.leftArm && name.includes('leftarm')) bones.leftArm = child;
      if (!bones.leftForeArm && (name.includes('leftforearm') || name.includes('leftlowerarm'))) bones.leftForeArm = child;
      if (!bones.rightArm && name.includes('rightarm')) bones.rightArm = child;
      if (!bones.rightForeArm && (name.includes('rightforearm') || name.includes('rightlowerarm'))) bones.rightForeArm = child;
      if (!bones.leftHand && name.includes('lefthand')) bones.leftHand = child;
      if (!bones.rightHand && name.includes('righthand')) bones.rightHand = child;
    });

    return bones;
  }

  findHipBone(fbx) {
    let hipBone = fbx.getObjectByName('Hips')
      || fbx.getObjectByName('mixamorigHips')
      || fbx.getObjectByName('pelvis')
      || fbx.getObjectByName('Pelvis');

    if (!hipBone) {
      fbx.traverse(child => {
        if (!child.isBone || hipBone) return;
        const name = child.name.toLowerCase();
        if (name.includes('hips') || name.includes('pelvis')) {
          hipBone = child;
        }
      });
    }

    return hipBone;
  }
}
