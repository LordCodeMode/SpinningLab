/**
 * RoadManager - Road segments, markings, and shoulders
 */

import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, VISIBLE_SEGMENTS, ALT_SCALE, COLORS } from '../scene-config.js';

export class RoadManager {
  constructor(scene, textureFactory) {
    this.scene = scene;
    this.textureFactory = textureFactory;
    this.roadSegments = [];
    this.currentSegment = 0;
    this.textures = null;

    this.roadMaterial = null;
    this.shoulderMaterial = null;
    this.centerLineMaterial = null;
    this.edgeLineMaterial = null;
    this.roadShader = null;
    this.shoulderShader = null;
    this.patchMaterial = null;
    this.edgeBreakupMaterial = null;
    this.retainingWallMaterial = null;
    this.retainingWallCapMaterial = null;
    this.overhangMaterial = null;
    this.segmentSurfaceOverlap = 1.4;
    this.routeStyle = {};
    this.roadLift = 0;
  }

  create() {
    this.textures = this.textureFactory.getTextures();
    this.createMaterials();

    for (let i = 0; i < VISIBLE_SEGMENTS; i++) {
      const segment = this.createRoadSegment(i);
      this.roadSegments.push(segment);
      this.scene.add(segment);
    }
  }

  createMaterials() {
    this.roadMaterial = new THREE.MeshPhysicalMaterial({
      color: COLORS.asphalt,
      map: this.textures?.road || null,
      normalMap: this.textures?.roadNormal || null,
      roughnessMap: this.textures?.roadRoughness || null,
      aoMap: this.textures?.roadAo || null,
      aoMapIntensity: 0.8,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.92,
      metalness: 0,
      clearcoat: 0.05,
      clearcoatRoughness: 0.72,
      side: THREE.DoubleSide
    });

    this.roadMaterial.onBeforeCompile = (shader) => {
      this.roadShader = shader;
      shader.uniforms.detailNoiseMap = { value: this.textures?.blendNoise || null };
      shader.uniforms.cloudShadowTime = { value: 0 };
      shader.uniforms.cloudShadowStrength = { value: 0.06 };
      shader.uniforms.worldScroll = { value: 0 };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPos;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vWorldPos = worldPosition.xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D detailNoiseMap;
          uniform float cloudShadowTime;
          uniform float cloudShadowStrength;
          uniform float worldScroll;
          varying vec3 vWorldPos;`
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec2 uvRoad = vMapUv * vec2(1.0, 1.0);
            vec4 base = mapTexelToLinear(texture2D(map, uvRoad));

            // Tire-wear in the lane center + darker micro patching on the edges.
            float centerWear = exp(-pow((vMapUv.x - 0.5) * 3.4, 2.0));
            float edgeMask = smoothstep(0.35, 0.49, abs(vMapUv.x - 0.5));
            float crackNoise = texture2D(detailNoiseMap, vMapUv * 0.8 + vWorldPos.xz * 0.0012).r;
            float crackMask = smoothstep(0.52, 0.83, crackNoise + edgeMask * 0.24);

            base.rgb *= (0.9 + centerWear * 0.08);
            base.rgb = mix(base.rgb, base.rgb * 0.76, crackMask * 0.3);

            vec2 worldXZ = vec2(vWorldPos.x, vWorldPos.z + worldScroll);
            float cloudA = texture2D(detailNoiseMap, worldXZ * 0.00062 + vec2(cloudShadowTime * 0.008, cloudShadowTime * 0.003)).r;
            float cloudB = texture2D(detailNoiseMap, worldXZ * 0.00041 - vec2(cloudShadowTime * 0.006, cloudShadowTime * 0.005)).g;
            float cloudMask = smoothstep(0.48, 0.86, cloudA * 0.6 + cloudB * 0.4);
            float cloudShade = 1.0 - cloudMask * cloudShadowStrength;
            base.rgb *= cloudShade;

            diffuseColor *= base;
          #endif`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          #ifdef USE_ROUGHNESSMAP
            float centerWear = exp(-pow((vMapUv.x - 0.5) * 3.1, 2.0));
            float patchNoise = texture2D(detailNoiseMap, vMapUv * 0.9 + vWorldPos.xz * 0.0018).g;
            float patchMask = smoothstep(0.5, 0.86, patchNoise);
            roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.82, centerWear * 0.26);
            roughnessFactor = mix(roughnessFactor, roughnessFactor * 1.12, patchMask * 0.18);
          #endif`
        );
    };

    this.shoulderMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.asphaltLight,
      map: this.textures?.dirt || null,
      normalMap: this.textures?.dirtNormal || null,
      roughnessMap: this.textures?.dirtRoughness || null,
      aoMap: this.textures?.dirtAo || null,
      aoMapIntensity: 0.78,
      roughness: 0.97,
      metalness: 0,
      normalScale: new THREE.Vector2(0.45, 0.45)
    });
    this.shoulderMaterial.onBeforeCompile = (shader) => {
      this.shoulderShader = shader;
      shader.uniforms.gravelMap = { value: this.textures?.gravel || null };
      shader.uniforms.gravelRoughnessMap = { value: this.textures?.gravelRoughness || null };
      shader.uniforms.detailNoiseMap = { value: this.textures?.blendNoise || null };
      shader.uniforms.worldScroll = { value: 0 };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPos;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vWorldPos = worldPosition.xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D gravelMap;
          uniform sampler2D gravelRoughnessMap;
          uniform sampler2D detailNoiseMap;
          uniform float worldScroll;
          varying vec3 vWorldPos;`
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec2 worldXZ = vec2(vWorldPos.x, vWorldPos.z + worldScroll);
            vec4 dirtSample = mapTexelToLinear(texture2D(map, vMapUv * 2.25));
            vec4 gravelSample = mapTexelToLinear(texture2D(gravelMap, vMapUv * 3.6 + worldXZ * 0.0011));
            float edge = smoothstep(0.26, 0.96, abs(vMapUv.x - 0.5) * 2.0);
            float breakup = texture2D(detailNoiseMap, vMapUv * 1.65 + worldXZ * 0.0022).r;
            float gravelMask = clamp(edge * 0.65 + breakup * 0.42, 0.0, 1.0);
            vec4 shoulderSample = mix(dirtSample, gravelSample, gravelMask * 0.72);
            diffuseColor *= shoulderSample;
          #endif`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          #ifdef USE_ROUGHNESSMAP
            float edge = smoothstep(0.26, 0.96, abs(vMapUv.x - 0.5) * 2.0);
            float gravelR = texture2D(gravelRoughnessMap, vMapUv * 2.95).g;
            roughnessFactor = mix(roughnessFactor, gravelR, edge * 0.62);
          #endif`
        );
    };

    this.centerLineMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.roadLineYellow,
      roughness: 0.5,
      metalness: 0.05
    });

    this.edgeLineMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.roadLine,
      roughness: 0.55,
      metalness: 0.05
    });

    this.patchMaterial = new THREE.MeshStandardMaterial({
      color: 0x242424,
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: 0.32,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    this.edgeBreakupMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f4638,
      map: this.textures?.dirt || null,
      alphaMap: this.textures?.blendNoise || null,
      roughnessMap: this.textures?.gravelRoughness || null,
      aoMap: this.textures?.gravelAo || null,
      aoMapIntensity: 0.74,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    this.retainingWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x8f8c85,
      map: this.textures?.rock || null,
      normalMap: this.textures?.rockNormal || null,
      roughnessMap: this.textures?.rockRoughness || null,
      roughness: 0.9,
      metalness: 0,
      normalScale: new THREE.Vector2(0.35, 0.35)
    });

    this.retainingWallCapMaterial = new THREE.MeshStandardMaterial({
      color: 0xb0a99d,
      roughness: 0.82,
      metalness: 0
    });

    this.overhangMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a8476,
      map: this.textures?.rock || null,
      normalMap: this.textures?.rockNormal || null,
      roughnessMap: this.textures?.rockRoughness || null,
      roughness: 0.94,
      metalness: 0,
      normalScale: new THREE.Vector2(0.5, 0.5)
    });
  }

  createRoadSegment(index) {
    const group = new THREE.Group();

    const segmentLength = ROAD_SEGMENT_LENGTH;
    const segmentSurfaceLength = segmentLength + this.segmentSurfaceOverlap;
    const fullRoadWidth = ROAD_WIDTH + 4;

    // Road surface
    const roadGeo = new THREE.BoxGeometry(fullRoadWidth, 0.15, segmentSurfaceLength);
    this.shapeRoadGeometry(roadGeo, fullRoadWidth, segmentSurfaceLength);
    if (roadGeo.attributes.uv && !roadGeo.attributes.uv2) {
      roadGeo.setAttribute('uv2', new THREE.BufferAttribute(roadGeo.attributes.uv.array, 2));
    }
    const road = new THREE.Mesh(roadGeo, this.roadMaterial);
    road.position.set(0, 0.2, 0);
    road.receiveShadow = true;
    road.castShadow = false;
    group.add(road);

    // Shoulder strips
    const shoulderGeo = new THREE.BoxGeometry(1.5, 0.16, segmentSurfaceLength);
    this.shapeShoulderGeometry(shoulderGeo, segmentSurfaceLength);
    if (shoulderGeo.attributes.uv && !shoulderGeo.attributes.uv2) {
      shoulderGeo.setAttribute('uv2', new THREE.BufferAttribute(shoulderGeo.attributes.uv.array, 2));
    }

    const leftShoulder = new THREE.Mesh(shoulderGeo, this.shoulderMaterial);
    leftShoulder.position.set(-fullRoadWidth / 2 + 0.75, 0.18, 0);
    leftShoulder.receiveShadow = true;
    group.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeo, this.shoulderMaterial);
    rightShoulder.position.set(fullRoadWidth / 2 - 0.75, 0.18, 0);
    rightShoulder.receiveShadow = true;
    group.add(rightShoulder);

    // Center dashed line
    const dashLength = 3;
    const gapLength = 5;
    const lineY = 0.31;
    const dashGeo = new THREE.BoxGeometry(0.15, 0.02, dashLength);

    for (let d = -segmentLength / 2; d < segmentLength / 2; d += dashLength + gapLength) {
      if (d + dashLength <= segmentLength / 2) {
        const dash = new THREE.Mesh(dashGeo, this.centerLineMaterial);
        dash.position.set(0, lineY, d + dashLength / 2);
        group.add(dash);
      }
    }

    // Edge lines
    const edgeGeo = new THREE.BoxGeometry(0.18, 0.02, segmentSurfaceLength);

    const leftEdge = new THREE.Mesh(edgeGeo, this.edgeLineMaterial);
    leftEdge.position.set(-ROAD_WIDTH / 2 + 0.5, lineY, 0);
    group.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeGeo, this.edgeLineMaterial);
    rightEdge.position.set(ROAD_WIDTH / 2 - 0.5, lineY, 0);
    group.add(rightEdge);

    group.userData.guardRailGroup = this.addGuardRails(segmentLength);
    if (group.userData.guardRailGroup) {
      group.add(group.userData.guardRailGroup);
    }
    group.userData.retainingWallGroup = this.addRetainingWalls(segmentLength, (index % 2 === 0) ? 1 : -1);
    if (group.userData.retainingWallGroup) {
      group.add(group.userData.retainingWallGroup);
    }
    group.userData.cliffOverhangGroup = this.addCliffOverhangs(segmentLength, (index % 3 === 0) ? -1 : 1);
    if (group.userData.cliffOverhangGroup) {
      group.add(group.userData.cliffOverhangGroup);
    }

    this.addRoadPatchDecals(group, segmentLength, ROAD_WIDTH);
    this.addRoadEdgeBreakupDecals(group, segmentLength, ROAD_WIDTH);

    const z = index * ROAD_SEGMENT_LENGTH;
    group.userData.index = index;
    group.userData.baseZ = z;

    return group;
  }

  addGuardRails(segmentLength) {
    const group = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x8d8d8d,
      roughness: 0.64,
      metalness: 0.26
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xa8a8a8,
      roughness: 0.52,
      metalness: 0.34
    });
    const postGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.92, 6);
    const railGeo = new THREE.BoxGeometry(0.08, 0.12, segmentLength);
    const curbGeo = new THREE.BoxGeometry(0.22, 0.15, segmentLength);
    const guardOffset = ROAD_WIDTH / 2 + 1.55;

    [-1, 1].forEach((side) => {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(side * guardOffset, 0.8, 0);
      rail.castShadow = true;
      rail.receiveShadow = true;
      group.add(rail);

      const curb = new THREE.Mesh(curbGeo, postMat);
      curb.position.set(side * (guardOffset - 0.08), 0.26, 0);
      curb.castShadow = false;
      curb.receiveShadow = true;
      group.add(curb);

      for (let z = -segmentLength / 2; z < segmentLength / 2; z += 3.5) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(side * guardOffset, 0.42, z + 1.6);
        post.castShadow = true;
        post.receiveShadow = true;
        group.add(post);
      }
    });

    group.visible = false;
    return group;
  }

  addRetainingWalls(segmentLength, preferredSide = 1) {
    const group = new THREE.Group();
    const wallGeo = new THREE.BoxGeometry(0.86, 2.25, segmentLength * 0.9);
    const capGeo = new THREE.BoxGeometry(1.04, 0.2, segmentLength * 0.9);
    const buttressGeo = new THREE.BoxGeometry(1.15, 1.85, 2.05);
    const edgeOffset = ROAD_WIDTH / 2 + 2.15;

    const createWallSide = (side) => {
      const sideGroup = new THREE.Group();

      const wall = new THREE.Mesh(wallGeo, this.retainingWallMaterial);
      wall.position.set(side * edgeOffset, 1.16, 0);
      wall.castShadow = true;
      wall.receiveShadow = true;
      sideGroup.add(wall);

      const cap = new THREE.Mesh(capGeo, this.retainingWallCapMaterial);
      cap.position.set(side * edgeOffset, 2.34, 0);
      cap.castShadow = false;
      cap.receiveShadow = true;
      sideGroup.add(cap);

      for (let z = -segmentLength * 0.43; z <= segmentLength * 0.43; z += 4.6) {
        const buttress = new THREE.Mesh(buttressGeo, this.retainingWallMaterial);
        buttress.position.set(side * (edgeOffset + 0.2), 0.94, z);
        buttress.castShadow = true;
        buttress.receiveShadow = true;
        sideGroup.add(buttress);
      }

      return sideGroup;
    };

    const leftWall = createWallSide(-1);
    const rightWall = createWallSide(1);
    group.userData.leftFeature = leftWall;
    group.userData.rightFeature = rightWall;

    leftWall.visible = preferredSide < 0;
    rightWall.visible = preferredSide > 0;

    group.add(leftWall);
    group.add(rightWall);
    group.visible = false;
    return group;
  }

  addCliffOverhangs(segmentLength, preferredSide = -1) {
    const group = new THREE.Group();
    const edgeOffset = ROAD_WIDTH / 2 + 6.4;

    const createOverhangSide = (side) => {
      const sideGroup = new THREE.Group();
      for (let i = 0; i < 4; i += 1) {
        const rockGeo = new THREE.DodecahedronGeometry(1.35 + Math.random() * 0.8, 1);
        const overhang = new THREE.Mesh(rockGeo, this.overhangMaterial);
        overhang.scale.set(
          2.2 + Math.random() * 2.8,
          1.3 + Math.random() * 1.5,
          1.8 + Math.random() * 2.6
        );
        overhang.position.set(
          side * edgeOffset - side * (2 + Math.random() * 2.8),
          5.2 + Math.random() * 3.8,
          -segmentLength * 0.42 + i * (segmentLength * 0.3) + (Math.random() - 0.5) * 6
        );
        overhang.rotation.set(
          (Math.random() - 0.5) * 0.5,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.4
        );
        overhang.castShadow = true;
        overhang.receiveShadow = true;
        sideGroup.add(overhang);
      }
      return sideGroup;
    };

    const leftOverhangs = createOverhangSide(-1);
    const rightOverhangs = createOverhangSide(1);
    group.userData.leftFeature = leftOverhangs;
    group.userData.rightFeature = rightOverhangs;

    leftOverhangs.visible = preferredSide < 0;
    rightOverhangs.visible = preferredSide > 0;

    group.add(leftOverhangs);
    group.add(rightOverhangs);
    group.visible = false;
    return group;
  }

  setFeatureSide(featureGroup, side = 1) {
    if (!featureGroup?.userData) return;
    const left = featureGroup.userData.leftFeature;
    const right = featureGroup.userData.rightFeature;
    if (left) left.visible = side < 0;
    if (right) right.visible = side > 0;
  }

  shapeRoadGeometry(geometry, width, length) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Shape only top vertices to create a slight crown and subtle waviness.
      if (y <= 0) continue;

      const normalizedX = (x / (width * 0.5));
      const crown = (1 - Math.abs(normalizedX)) * 0.022;
      const edgeDrop = Math.abs(normalizedX) * 0.012;
      const breakup = Math.sin((z / length) * Math.PI * 6 + x * 0.9) * 0.003;
      pos.setY(i, y + crown - edgeDrop + breakup);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  shapeShoulderGeometry(geometry, length) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y <= 0) continue;

      const slopeOut = 0.008;
      const breakup = Math.sin((z / length) * Math.PI * 4) * 0.0016;
      pos.setY(i, y - slopeOut + breakup);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  addRoadPatchDecals(group, segmentLength, roadWidth) {
    const patchCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < patchCount; i++) {
      if (Math.random() < 0.45) continue;

      const patchW = 0.8 + Math.random() * 1.8;
      const patchL = 1.6 + Math.random() * 4.2;
      const patchGeo = new THREE.PlaneGeometry(patchW, patchL, 1, 1);
      const patch = new THREE.Mesh(patchGeo, this.patchMaterial);
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = (Math.random() - 0.5) * 0.4;
      patch.position.set(
        (Math.random() - 0.5) * (roadWidth * 0.7),
        0.286,
        (Math.random() - 0.5) * segmentLength
      );
      group.add(patch);
    }
  }

  addRoadEdgeBreakupDecals(group, segmentLength, roadWidth) {
    const decalsPerSide = 2 + Math.floor(Math.random() * 3);
    const baseY = 0.288;

    [-1, 1].forEach((side) => {
      for (let i = 0; i < decalsPerSide; i++) {
        if (Math.random() < 0.25) continue;

        const width = 0.5 + Math.random() * 1.1;
        const length = 1.2 + Math.random() * 3.9;
        const geo = new THREE.PlaneGeometry(width, length, 1, 1);
        const decal = new THREE.Mesh(geo, this.edgeBreakupMaterial);
        decal.rotation.x = -Math.PI / 2;
        decal.rotation.z = (Math.random() - 0.5) * 0.7;
        decal.position.set(
          side * (roadWidth / 2 + 0.55 + Math.random() * 0.95),
          baseY,
          (Math.random() - 0.5) * segmentLength
        );
        group.add(decal);
      }
    });
  }

  update(deltaTime, worldState) {
    const { totalDistance, currentAltitude, getElevationAt, routeManager } = worldState;

    const segmentsPassed = Math.floor(totalDistance / ROAD_SEGMENT_LENGTH);

    if (segmentsPassed > this.currentSegment) {
      const diff = segmentsPassed - this.currentSegment;

      for (let i = 0; i < diff && i < this.roadSegments.length; i++) {
        const segment = this.roadSegments.shift();
        const newZ = (segmentsPassed + VISIBLE_SEGMENTS - 1) * ROAD_SEGMENT_LENGTH;
        segment.userData.baseZ = newZ;
        this.roadSegments.push(segment);
      }

      this.currentSegment = segmentsPassed;
    }

    this.roadSegments.forEach((segment) => {
      const segmentDistance = segment.userData.baseZ;
      const relativeZ = segmentDistance - totalDistance;

      const curve = routeManager.getCurveInfo(segmentDistance);
      const sceneryProfile = routeManager.getSceneryProfile(segmentDistance);
      const switchbackInfo = routeManager.getSwitchbackInfo(segmentDistance);
      const centerInfo = getElevationAt(segmentDistance + ROAD_SEGMENT_LENGTH * 0.5);
      const pitchSampleStart = getElevationAt(segmentDistance - ROAD_SEGMENT_LENGTH * 0.3);
      const pitchSampleEnd = getElevationAt(segmentDistance + ROAD_SEGMENT_LENGTH * 0.7);
      const midAltitude = centerInfo.altitude;
      const rise = (pitchSampleEnd.altitude - pitchSampleStart.altitude) * ALT_SCALE;
      const pitch = Math.atan(rise / ROAD_SEGMENT_LENGTH);

      const elevationOffset = (midAltitude - currentAltitude) * ALT_SCALE;
      const mountainness = sceneryProfile?.mountainness || 0;
      const extraRoadLift = this.roadLift * (0.66 + mountainness * 0.34);
      segment.position.set(
        curve.lateral,
        0.205 + extraRoadLift + elevationOffset,
        relativeZ
      );

      segment.rotation.set(-pitch, curve.heading, 0);
      if (segment.userData.guardRailGroup) {
        segment.userData.guardRailGroup.visible = (sceneryProfile?.mountainness || 0) > 0.52;
      }
      if (segment.userData.retainingWallGroup) {
        const retainingActive = (sceneryProfile?.mountainness || 0) > 0.58 && switchbackInfo.active;
        segment.userData.retainingWallGroup.visible = retainingActive;
        if (retainingActive) {
          this.setFeatureSide(segment.userData.retainingWallGroup, switchbackInfo.direction >= 0 ? 1 : -1);
        }
      }
      if (segment.userData.cliffOverhangGroup) {
        const overhangActive = (sceneryProfile?.mountainness || 0) > 0.72
          && ((sceneryProfile?.alpineFactor || 0) > 0.24 || switchbackInfo.intensity > 0.45);
        segment.userData.cliffOverhangGroup.visible = overhangActive;
        if (overhangActive) {
          this.setFeatureSide(segment.userData.cliffOverhangGroup, switchbackInfo.direction >= 0 ? -1 : 1);
        }
      }
    });

    if (this.roadShader?.uniforms?.cloudShadowTime) {
      this.roadShader.uniforms.cloudShadowTime.value = worldState.time || 0;
    }
    if (this.roadShader?.uniforms?.worldScroll) {
      this.roadShader.uniforms.worldScroll.value = totalDistance || 0;
    }
    if (this.shoulderShader?.uniforms?.worldScroll) {
      this.shoulderShader.uniforms.worldScroll.value = totalDistance || 0;
    }
  }

  setRouteStyle(style = {}) {
    this.routeStyle = {
      ...this.routeStyle,
      ...(style || {})
    };
    this.roadLift = THREE.MathUtils.clamp(this.routeStyle.roadLift || 0, 0, 0.28);
  }

  destroy() {
    const disposedMaterials = new Set();
    this.roadSegments.forEach(segment => {
      this.scene.remove(segment);
      segment.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (!mat || disposedMaterials.has(mat)) return;
            disposedMaterials.add(mat);
            mat.dispose();
          });
        }
      });
    });

    this.roadSegments = [];
  }
}
