/**
 * TerrainManager - Ground chunks and terrain generation
 */

import * as THREE from 'three';
import { ROAD_SEGMENT_LENGTH, ROAD_WIDTH, TERRAIN_WIDTH, ALT_SCALE, THEMES } from '../scene-config.js';

export class TerrainManager {
  constructor(scene, textureFactory) {
    this.scene = scene;
    this.textureFactory = textureFactory;
    this.groundChunks = [];
    this.groundMaterials = [];
    this.theme = 'classic';
    this.textures = null;
    this.chunkSize = ROAD_SEGMENT_LENGTH * 12;
    this.numChunks = 12;
    this.terrainHalfWidth = TERRAIN_WIDTH * 1.24;

    this.sharedGroundMaterial = null;
    this.groundShader = null;
    this.getSceneryProfileAt = null;
    this.routeStyle = {};
    this.roadClearanceLift = 0;
  }

  create(getElevationAt, currentAltitude = 100, getRoadCenterAt = null, getSceneryProfileAt = null) {
    this.getElevationAt = getElevationAt;
    this.currentAltitude = currentAltitude;
    this.getRoadCenterAt = getRoadCenterAt;
    this.getSceneryProfileAt = getSceneryProfileAt;
    this.textures = this.textureFactory.getTextures();

    const preset = THEMES[this.theme] || THEMES.classic;
    this.sharedGroundMaterial = this.createBlendedGroundMaterial(preset);

    for (let i = 0; i < this.numChunks; i++) {
      const chunk = this.createGroundChunk(this.chunkSize, i * this.chunkSize);
      this.groundChunks.push(chunk);
      this.scene.add(chunk);
    }
  }

  createBlendedGroundMaterial(preset) {
    const material = new THREE.MeshStandardMaterial({
      color: preset.grass,
      map: this.textures?.grass || null,
      normalMap: this.textures?.grassNormal || null,
      roughnessMap: this.textures?.grassRoughness || null,
      aoMap: this.textures?.grassAo || null,
      aoMapIntensity: 0.72,
      roughness: 0.95,
      metalness: 0,
      normalScale: new THREE.Vector2(0.46, 0.46)
    });

    material.onBeforeCompile = (shader) => {
      this.groundShader = shader;

      shader.uniforms.dirtMap = { value: this.textures?.dirt || null };
      shader.uniforms.rockMap = { value: this.textures?.rock || null };
      shader.uniforms.blendNoiseMap = { value: this.textures?.blendNoise || null };
      shader.uniforms.biomeMaskMap = { value: this.textures?.biomeMask || null };
      shader.uniforms.dirtRoughnessMap = { value: this.textures?.dirtRoughness || null };
      shader.uniforms.rockRoughnessMap = { value: this.textures?.rockRoughness || null };
      shader.uniforms.groundTint = { value: new THREE.Color(preset.grass) };
      shader.uniforms.cloudShadowTime = { value: 0 };
      shader.uniforms.cloudShadowStrength = { value: 0.09 };
      shader.uniforms.worldScroll = { value: 0 };
      shader.uniforms.mountainness = { value: 0 };
      shader.uniforms.alpineFactor = { value: 0 };

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;`
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
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
          uniform sampler2D dirtMap;
          uniform sampler2D rockMap;
          uniform sampler2D blendNoiseMap;
          uniform sampler2D biomeMaskMap;
          uniform sampler2D dirtRoughnessMap;
          uniform sampler2D rockRoughnessMap;
          uniform vec3 groundTint;
          uniform float cloudShadowTime;
          uniform float cloudShadowStrength;
          uniform float worldScroll;
          uniform float mountainness;
          uniform float alpineFactor;
          varying vec3 vWorldPos;
          varying vec3 vWorldNormal;

          vec3 biomeWeights(vec2 uv, vec2 worldXZ) {
            float slope = 1.0 - clamp(vWorldNormal.y, 0.0, 1.0);
            float altitude = clamp((vWorldPos.y + 14.0) / 98.0, 0.0, 1.0);
            vec3 biome = texture2D(biomeMaskMap, worldXZ * 0.00055 + vec2(0.5)).rgb;
            float moisture = biome.r;
            float drainage = biome.g;
            float scree = biome.b;
            float macroNoise = texture2D(blendNoiseMap, uv * 0.35 + worldXZ * 0.0014).r;

            float grassW = (1.0 - slope * 0.95) * (0.62 + moisture * 0.5) * (1.0 - altitude * 0.45);
            float dirtW = smoothstep(0.2, 0.95, drainage * 0.72 + slope * 0.46 + (1.0 - moisture) * 0.35 + macroNoise * 0.2);
            float rockW = smoothstep(0.34, 1.1, slope * 0.84 + altitude * 0.8 + scree * 0.52 - moisture * 0.24 + macroNoise * 0.18);

            grassW *= (1.0 - mountainness * 0.45 - alpineFactor * 0.2);
            dirtW *= (1.0 + mountainness * 0.08);
            rockW += mountainness * 0.22 + alpineFactor * 0.35;

            vec3 raw = vec3(max(0.05, grassW), max(0.03, dirtW), max(0.02, rockW));
            float sumW = raw.x + raw.y + raw.z + 1e-5;
            return raw / sumW;
          }`
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec2 worldXZ = vec2(vWorldPos.x, vWorldPos.z + worldScroll);
            vec3 weights = biomeWeights(vMapUv, worldXZ);

            vec2 uvDetail = vMapUv * 3.0;
            vec4 grassSample = mapTexelToLinear(texture2D(map, uvDetail));
            vec4 dirtSample = mapTexelToLinear(texture2D(dirtMap, uvDetail * 0.84));
            vec4 rockSample = mapTexelToLinear(texture2D(rockMap, uvDetail * 0.9));

            vec4 terrainSample = grassSample * weights.x + dirtSample * weights.y + rockSample * weights.z;

            // Large-scale moving cloud shadows add depth and motion across terrain.
            float cloudA = texture2D(
              blendNoiseMap,
              worldXZ * 0.00052 + vec2(cloudShadowTime * 0.007, cloudShadowTime * 0.004)
            ).r;
            float cloudB = texture2D(
              blendNoiseMap,
              worldXZ * 0.00037 - vec2(cloudShadowTime * 0.005, cloudShadowTime * 0.006)
            ).g;
            float cloudMask = smoothstep(0.46, 0.82, cloudA * 0.62 + cloudB * 0.38);
            float cloudShade = 1.0 - cloudMask * cloudShadowStrength;

            terrainSample.rgb = mix(terrainSample.rgb, rockSample.rgb, mountainness * 0.16 + alpineFactor * 0.24);
            terrainSample.rgb *= cloudShade;
            terrainSample.rgb *= groundTint;
            diffuseColor *= terrainSample;
          #endif`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          #ifdef USE_ROUGHNESSMAP
            vec2 worldXZ = vec2(vWorldPos.x, vWorldPos.z + worldScroll);
            vec3 weights = biomeWeights(vMapUv, worldXZ);

            float dirtR = texture2D(dirtRoughnessMap, vMapUv * 2.5).g;
            float rockR = texture2D(rockRoughnessMap, vMapUv * 2.2).g;
            float grassR = roughnessFactor;
            roughnessFactor = grassR * weights.x + dirtR * weights.y + rockR * weights.z;
          #endif`
        );
    };

    material.customProgramCacheKey = () => `terrain-pbr-blend-${this.theme}`;

    this.groundMaterials.push({ material, tone: 'base' });
    return material;
  }

  createGroundChunk(size, zOffset) {
    const group = new THREE.Group();

    // Main ground with high-frequency geometry to hold slope + micro undulation.
    const groundGeo = new THREE.PlaneGeometry(this.terrainHalfWidth * 2, size, 32, 28);
    if (groundGeo.attributes.uv && !groundGeo.attributes.uv2) {
      groundGeo.setAttribute('uv2', new THREE.BufferAttribute(groundGeo.attributes.uv.array, 2));
    }
    const ground = new THREE.Mesh(groundGeo, this.sharedGroundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 0;
    ground.position.y = -0.22;
    ground.receiveShadow = true;
    group.add(ground);
    group.userData.groundMesh = ground;

    group.userData.zOffset = zOffset;
    group.userData.size = size;
    group.userData.groundPatches = [];
    this.applyGroundChunkElevation(group);

    return group;
  }

  applyGroundChunkElevation(chunk) {
    if (!chunk?.userData?.groundMesh || !this.getElevationAt) return;

    const ground = chunk.userData.groundMesh;
    const geo = ground.geometry;
    const positions = geo.attributes.position;
    const size = chunk.userData.size || 1;

    const baseDistance = chunk.userData.zOffset + size / 2;
    const baseAltitude = this.getElevationAt(baseDistance).altitude;
    chunk.userData.baseAltitude = baseAltitude;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // Plane is rotated -90deg around X, so local +Y points toward negative world Z.
      // Convert local Y to forward route distance using reversed axis direction.
      const forwardDistance = (size * 0.5) - y;
      const distance = chunk.userData.zOffset + forwardDistance;
      const info = this.getElevationAt(distance);
      const slopeHeight = (info.altitude - baseAltitude) * ALT_SCALE;
      const scenery = this.getSceneryProfileAt ? this.getSceneryProfileAt(distance) : null;
      const mountainness = scenery?.mountainness || 0;
      const alpineFactor = scenery?.alpineFactor || 0;
      const hillyRouteBoost = scenery?.routeId === 'hilly-route' ? 1 : 0;
      const corridorHalfWidth = scenery?.corridorHalfWidth
        || ((1 - mountainness) * 48 + mountainness * 20 - alpineFactor * 2.2);

      const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(distance) : 0;
      const dx = x - roadCenter;
      const roadBuffer = Math.max(
        (ROAD_WIDTH / 2) + 6.4 + hillyRouteBoost * 1.2,
        Math.min((ROAD_WIDTH / 2) + 12.4, corridorHalfWidth * (0.38 + hillyRouteBoost * 0.04))
      );
      const roadClearanceWidth = roadBuffer + 7.4;
      const roadClearanceT = THREE.MathUtils.clamp(Math.abs(dx) / Math.max(1, roadClearanceWidth), 0, 1);
      const roadClearanceBlend = roadClearanceT * roadClearanceT * (3 - 2 * roadClearanceT);

      if (Math.abs(dx) < roadBuffer) {
        const taper = 1 - (Math.abs(dx) / roadBuffer);
        const clearanceBoost = this.roadClearanceLift || 0;
        const carve = -(0.46 + mountainness * 0.2 + alpineFactor * 0.08 + clearanceBoost * 0.18 + hillyRouteBoost * 0.12) * taper;
        positions.setZ(i, slopeHeight + carve);
        continue;
      }

      const primaryNoise =
        Math.sin((distance * 0.015) + dx * 0.08) * 0.4 +
        Math.cos((distance * 0.01) - dx * 0.06) * 0.3;
      const secondaryNoise =
        Math.sin((distance * 0.04) + dx * 0.19) * 0.14 +
        Math.cos((distance * 0.05) + dx * 0.13) * 0.11;
      let baseGround = slopeHeight + primaryNoise * 0.24 + secondaryNoise * 0.2;

      let corridorLift = 0;
      if (mountainness > 0.08) {
        const absDx = Math.abs(dx);
        const sideSign = Math.sign(dx) || 1;
        const shoulderStart = roadBuffer + THREE.MathUtils.lerp(7.5, 3.8, mountainness);
        const riseStart = shoulderStart + THREE.MathUtils.lerp(8.2, 4.4, mountainness);
        const valleySpan = Math.max(
          10,
          (corridorHalfWidth - riseStart + THREE.MathUtils.lerp(26, 12, mountainness))
          * (1 - alpineFactor * 0.28)
        );
        const wallSpan = THREE.MathUtils.lerp(42, 18, mountainness);
        const tValley = THREE.MathUtils.clamp((absDx - riseStart) / Math.max(1, valleySpan), 0, 1);
        const tWall = THREE.MathUtils.clamp(
          (absDx - (riseStart + valleySpan * 0.32)) / Math.max(1, wallSpan),
          0,
          1
        );
        const smoothValley = tValley * tValley * (3 - 2 * tValley);
        const cliffShape = Math.pow(tWall, 1.6);
        const sideVariation = 0.5 + 0.5 * Math.sin(distance * 0.0017 + sideSign * 0.8);
        const cliffNoise =
          Math.sin(distance * 0.011 + dx * 0.065) * 0.4 +
          Math.cos(distance * 0.006 - dx * 0.052) * 0.35;

        corridorLift += smoothValley * (1.2 + mountainness * 3.8 + alpineFactor * 2.5);
        corridorLift += cliffShape * (2.2 + mountainness * 9.5 + alpineFactor * 4.6);
        corridorLift += cliffNoise * (0.3 + mountainness * 0.45) * (0.4 + cliffShape);
        corridorLift *= (0.85 + sideVariation * 0.3);
      }

      // Keep terrain from clipping into road shoulders on steep sections.
      const shoulderSuppress = 1 - (1 - roadClearanceBlend) * (0.92 + mountainness * 0.08);
      corridorLift *= shoulderSuppress;
      baseGround = THREE.MathUtils.lerp(
        slopeHeight - (0.22 + mountainness * 0.1 + hillyRouteBoost * 0.06),
        baseGround,
        roadClearanceBlend
      );

      let groundHeight = baseGround + corridorLift;

      // Hard safety cap around the shoulder area prevents terrain poke-through on steep hilly sections.
      const hardSafetyWidth = roadBuffer + 2.6 + hillyRouteBoost * 0.6;
      if ((mountainness > 0.34 || hillyRouteBoost > 0) && Math.abs(dx) < hardSafetyWidth) {
        const edgeT = THREE.MathUtils.clamp(
          (Math.abs(dx) - roadBuffer) / Math.max(0.01, hardSafetyWidth - roadBuffer),
          0,
          1
        );
        const clearanceDepth = THREE.MathUtils.lerp(
          0.18 + mountainness * 0.08 + (this.roadClearanceLift || 0) * 0.05 + hillyRouteBoost * 0.07,
          0.075,
          edgeT
        );
        const maxGround = slopeHeight - clearanceDepth;
        groundHeight = Math.min(groundHeight, maxGround);
      }

      positions.setZ(i, groundHeight);
    }

    positions.needsUpdate = true;
    geo.computeVertexNormals();
  }

  setTheme(themeId) {
    this.theme = themeId;
    const preset = THEMES[themeId] || THEMES.classic;

    this.groundMaterials.forEach(entry => {
      if (!entry?.material) return;
      entry.material.color.setHex(preset.grass);
    });

    if (this.groundShader?.uniforms?.groundTint) {
      this.groundShader.uniforms.groundTint.value.setHex(preset.grass);
    }

    if (this.sharedGroundMaterial) {
      this.sharedGroundMaterial.needsUpdate = true;
    }
  }

  setRouteStyle(style = {}) {
    this.routeStyle = {
      ...this.routeStyle,
      ...(style || {})
    };
    this.roadClearanceLift = THREE.MathUtils.clamp(this.routeStyle.roadClearanceLift || 0, 0, 1);
    if (this.groundChunks.length && this.getElevationAt) {
      this.groundChunks.forEach((chunk) => this.applyGroundChunkElevation(chunk));
    }
  }

  update(deltaTime, worldState) {
    const {
      totalDistance,
      currentAltitude,
      getElevationAt,
      getRoadCenterAt,
      getSceneryProfile,
      routeManager,
      sceneryProfile
    } = worldState;
    this.currentAltitude = currentAltitude;
    this.getElevationAt = getElevationAt;
    this.getSceneryProfileAt = getSceneryProfile || this.getSceneryProfileAt;
    if (getRoadCenterAt) {
      this.getRoadCenterAt = getRoadCenterAt;
    } else if (routeManager) {
      this.getRoadCenterAt = (d) => routeManager.getCurveInfo(d).lateral;
    }

    const chunkSize = this.chunkSize;

    this.groundChunks.forEach(chunk => {
      const relativeZ = chunk.userData.zOffset - totalDistance;

      if (relativeZ < -chunkSize) {
        chunk.userData.zOffset += chunkSize * this.groundChunks.length;
        this.applyGroundChunkElevation(chunk);
      }

      chunk.position.z = (chunk.userData.zOffset - totalDistance) + chunkSize / 2;

      const chunkCenterDistance = chunk.userData.zOffset + chunkSize / 2;
      const baseAltitude = this.getElevationAt(chunkCenterDistance).altitude;
      chunk.position.y = (baseAltitude - this.currentAltitude) * ALT_SCALE;
    });

    if (this.groundShader?.uniforms?.cloudShadowTime) {
      this.groundShader.uniforms.cloudShadowTime.value = worldState.time || 0;
    }
    if (this.groundShader?.uniforms?.worldScroll) {
      this.groundShader.uniforms.worldScroll.value = totalDistance || 0;
    }
    if (this.groundShader?.uniforms?.mountainness) {
      this.groundShader.uniforms.mountainness.value = sceneryProfile?.mountainness || 0;
    }
    if (this.groundShader?.uniforms?.alpineFactor) {
      this.groundShader.uniforms.alpineFactor.value = sceneryProfile?.alpineFactor || 0;
    }
  }

  destroy() {
    this.groundChunks.forEach(chunk => {
      this.scene.remove(chunk);
      chunk.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material && child.material !== this.sharedGroundMaterial) {
          child.material.dispose();
        }
      });
    });

    this.sharedGroundMaterial?.dispose();

    this.groundChunks = [];
    this.groundMaterials = [];
    this.sharedGroundMaterial = null;
    this.groundShader = null;
  }
}
