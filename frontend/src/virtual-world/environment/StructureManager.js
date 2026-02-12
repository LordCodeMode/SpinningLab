/**
 * StructureManager - Fences, rocks, farm buildings, power lines
 */

import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, VISIBLE_SEGMENTS, ALT_SCALE, TERRAIN_WIDTH } from '../scene-config.js';
import { InstancedGltfLod } from '../utils/index.js';

export class StructureManager {
  constructor(scene) {
    this.scene = scene;
    this.fences = [];
    this.hayBales = [];
    this.powerLines = [];

    this.fenceDescriptors = [];
    this.hayDescriptors = [];
    this.powerLineDescriptors = [];
    this.rockDescriptors = [];
    this.farRockDescriptors = [];
    this.deadTreeDescriptors = [];
    this.accentDescriptors = [];
    this.roadSignDescriptors = [];
    this.villageHouseDescriptors = [];
    this.barnDescriptors = [];
    this.summitVillageDescriptors = [];

    this.proceduralRocks = [];
    this.proceduralBarns = [];

    this.fenceLod = null;
    this.hayLod = null;
    this.powerLineLod = null;
    this.rockLod = null;
    this.farRockLod = null;
    this.deadTreeLod = null;
    this.accentLod = null;
    this.roadSignLod = null;
    this.barnLod = null;
    this.villageHouseLod = null;

    this.roadSigns = [];
    this.enableVillageHouses = false;

    this.detailLevel = 'high';
    this.time = 0;
    this.rockBiomeTints = {
      valley: new THREE.Color(0x9a9891),
      alpine: new THREE.Color(0x8c949d),
      dry: new THREE.Color(0xa8967b)
    };
    this.barnBiomeTints = {
      valley: new THREE.Color(0xb04b43),
      alpine: new THREE.Color(0x9d6358),
      dry: new THREE.Color(0xb86a4f)
    };
    this.fenceTints = [new THREE.Color(0x9c7451), new THREE.Color(0x8f6847), new THREE.Color(0xa37c57)];
    this.hayTints = [new THREE.Color(0xd7ae58), new THREE.Color(0xc99f4e), new THREE.Color(0xe0bc67)];
    this.powerLineTints = [new THREE.Color(0x7a5b43), new THREE.Color(0x6d513b), new THREE.Color(0x8b6a4f)];
    this.deadTreeTints = [new THREE.Color(0x6e5a46), new THREE.Color(0x5f4d3c), new THREE.Color(0x7a6753)];
    this.accentTints = [new THREE.Color(0x78995d), new THREE.Color(0x8aa865), new THREE.Color(0x9bb172)];
    this.villageHouseTints = [
      new THREE.Color(0xf0ebe3),
      new THREE.Color(0xe2ddd3),
      new THREE.Color(0xd6d0c4),
      new THREE.Color(0xcfc8b9)
    ];

    this.fenceDummy = new THREE.Object3D();
    this.hayDummy = new THREE.Object3D();
    this.powerLineDummy = new THREE.Object3D();
    this.rockDummy = new THREE.Object3D();
    this.farRockDummy = new THREE.Object3D();
    this.deadTreeDummy = new THREE.Object3D();
    this.accentDummy = new THREE.Object3D();
    this.roadSignDummy = new THREE.Object3D();
    this.barnDummy = new THREE.Object3D();
    this.villageHouseDummy = new THREE.Object3D();
    this.getSceneryProfileAt = null;
    this.routeStyle = {
      farmPropDensity: 1,
      rockDensity: 1,
      farPropDensity: 1
    };
  }

  async create(getElevationAt, currentAltitude, routeManager, getSceneryProfileAt = null) {
    this.getElevationAt = getElevationAt;
    this.currentAltitude = currentAltitude;
    this.routeManager = routeManager;
    this.getSceneryProfileAt = getSceneryProfileAt;

    await this.createAssetLods();

    this.createFences();

    this.seedRockDescriptors();
    this.seedFarRockDescriptors();
    this.seedDeadTreeDescriptors();
    this.seedAccentDescriptors();
    if (!this.rockLod?.ready) {
      this.createProceduralRocksFallback();
    }

    this.createHayBales();

    this.seedBarnDescriptors();
    this.seedSummitVillageDescriptors();
    if (this.enableVillageHouses) {
      this.seedVillageHouseDescriptors();
    } else {
      this.villageHouseDescriptors = [];
    }
    if (!this.barnLod?.ready) {
      this.createProceduralBarnFallbacks();
    }

    this.createPowerLines();
    if (this.enableVillageHouses) {
      this.createVillageHouses();
    }
    this.createRoadSigns();
  }

  async createAssetLods() {
    this.fenceLod = await this.loadLodWithFallback({
      label: 'Fence',
      capacity: 320,
      primaryLevels: [
        { id: 'high', path: '/models/environment/premium/props/fence_high.glb', maxDistance: 140 },
        { id: 'mid', path: '/models/environment/premium/props/fence_mid.glb', maxDistance: 320 },
        { id: 'low', path: '/models/environment/premium/props/fence_low.glb', maxDistance: 520 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'fence',
          sourcePath: '/models/environment/premium/props/fence_high.glb',
          atlasFrames: 2,
          width: 3.6,
          height: 1.55,
          alphaTest: 0.22,
          textureSize: 256,
          maxDistance: Infinity
        }
      ],
      fallbackLevels: [
        { id: 'high', path: '/models/environment/fence_high.glb', maxDistance: 140 },
        { id: 'mid', path: '/models/environment/fence_mid.glb', maxDistance: 320 },
        { id: 'low', path: '/models/environment/fence_low.glb', maxDistance: 520 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'fence',
          sourcePath: '/models/environment/fence_high.glb',
          atlasFrames: 2,
          width: 3.6,
          height: 1.55,
          alphaTest: 0.22,
          textureSize: 256,
          maxDistance: Infinity
        }
      ]
    });

    this.hayLod = await this.loadLodWithFallback({
      label: 'Hay',
      capacity: 100,
      primaryLevels: [
        { id: 'high', path: '/models/environment/premium/props/hay_high.glb', maxDistance: 160 },
        { id: 'mid', path: '/models/environment/premium/props/hay_mid.glb', maxDistance: 340 },
        { id: 'low', path: '/models/environment/premium/props/hay_low.glb', maxDistance: 560 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'hay',
          sourcePath: '/models/environment/premium/props/hay_high.glb',
          atlasFrames: 2,
          width: 1.9,
          height: 1.5,
          alphaTest: 0.2,
          textureSize: 256,
          maxDistance: Infinity
        }
      ],
      fallbackLevels: [
        { id: 'high', path: '/models/environment/hay_high.glb', maxDistance: 160 },
        { id: 'mid', path: '/models/environment/hay_mid.glb', maxDistance: 340 },
        { id: 'low', path: '/models/environment/hay_low.glb', maxDistance: 560 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'hay',
          sourcePath: '/models/environment/hay_high.glb',
          atlasFrames: 2,
          width: 1.9,
          height: 1.5,
          alphaTest: 0.2,
          textureSize: 256,
          maxDistance: Infinity
        }
      ]
    });

    this.powerLineLod = await this.loadLodWithFallback({
      label: 'Powerline',
      capacity: 40,
      primaryLevels: [
        { id: 'high', path: '/models/environment/premium/props/powerline_high.glb', maxDistance: 220 },
        { id: 'mid', path: '/models/environment/premium/props/powerline_mid.glb', maxDistance: 420 },
        { id: 'low', path: '/models/environment/premium/props/powerline_low.glb', maxDistance: 640 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'powerline',
          sourcePath: '/models/environment/premium/props/powerline_high.glb',
          atlasFrames: 2,
          width: 3.8,
          height: 8.9,
          alphaTest: 0.22,
          textureSize: 256,
          maxDistance: Infinity
        }
      ],
      fallbackLevels: [
        { id: 'high', path: '/models/environment/powerline_high.glb', maxDistance: 220 },
        { id: 'mid', path: '/models/environment/powerline_mid.glb', maxDistance: 420 },
        { id: 'low', path: '/models/environment/powerline_low.glb', maxDistance: 640 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'powerline',
          sourcePath: '/models/environment/powerline_high.glb',
          atlasFrames: 2,
          width: 3.8,
          height: 8.9,
          alphaTest: 0.22,
          textureSize: 256,
          maxDistance: Infinity
        }
      ]
    });

    this.rockLod = await this.loadLodWithFallback({
      label: 'Rock',
      capacity: 180,
      primaryLevels: [
        { id: 'high', path: '/models/environment/premium/props/rock_high.glb', maxDistance: 120 },
        { id: 'mid', path: '/models/environment/premium/props/rock_mid.glb', maxDistance: 250 },
        { id: 'low', path: '/models/environment/premium/props/rock_low.glb', maxDistance: 420 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'rock',
          sourcePath: '/models/environment/premium/props/rock_high.glb',
          atlasFrames: 2,
          width: 3.1,
          height: 2.4,
          alphaTest: 0.3,
          textureSize: 256,
          maxDistance: Infinity
        }
      ],
      fallbackLevels: [
        { id: 'high', path: '/models/environment/rock_high.glb', maxDistance: 120 },
        { id: 'mid', path: '/models/environment/rock_mid.glb', maxDistance: 250 },
        { id: 'low', path: '/models/environment/rock_low.glb', maxDistance: 420 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'rock',
          sourcePath: '/models/environment/rock_high.glb',
          atlasFrames: 2,
          width: 3.1,
          height: 2.4,
          alphaTest: 0.3,
          textureSize: 256,
          maxDistance: Infinity
        }
      ]
    });

    this.farRockLod = await this.loadLodWithFallback({
      label: 'FarRock',
      capacity: 340,
      primaryLevels: [
        { id: 'high', path: '/models/environment/quaternius/glTF/Rock_Medium_3.gltf', maxDistance: 180 },
        { id: 'mid', path: '/models/environment/quaternius/glTF/RockPath_Round_Wide.gltf', maxDistance: 360 },
        { id: 'low', path: '/models/environment/quaternius/glTF/Pebble_Square_6.gltf', maxDistance: 620 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'rock',
          sourcePath: '/models/environment/quaternius/glTF/Rock_Medium_3.gltf',
          atlasFrames: 2,
          width: 5.8,
          height: 4.8,
          alphaTest: 0.28,
          textureSize: 512,
          maxDistance: Infinity
        }
      ],
      fallbackLevels: [
        { id: 'high', path: '/models/environment/rock_high.glb', maxDistance: 180 },
        { id: 'mid', path: '/models/environment/rock_mid.glb', maxDistance: 360 },
        { id: 'low', path: '/models/environment/rock_low.glb', maxDistance: 620 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'rock',
          sourcePath: '/models/environment/rock_high.glb',
          atlasFrames: 2,
          width: 5.8,
          height: 4.8,
          alphaTest: 0.28,
          textureSize: 512,
          maxDistance: Infinity
        }
      ]
    });

    this.deadTreeLod = await this.loadLodWithFallback({
      label: 'DeadTree',
      capacity: 160,
      materialHook: this.styleDeadTreeMaterial.bind(this),
      primaryLevels: [
        { id: 'stable', path: '/models/environment/quaternius/glTF/DeadTree_3.gltf', maxDistance: Infinity }
      ],
      fallbackLevels: [
        { id: 'stable', path: '/models/environment/tree_conifer_high.glb', maxDistance: Infinity }
      ]
    });

    this.accentLod = await this.loadLodWithFallback({
      label: 'RoadsideAccent',
      capacity: 260,
      primaryLevels: [
        { id: 'high', path: '/models/environment/quaternius/glTF/Mushroom_Common.gltf', maxDistance: 130 },
        { id: 'mid', path: '/models/environment/quaternius/glTF/Flower_4_Group.gltf', maxDistance: 260 },
        { id: 'low', path: '/models/environment/quaternius/glTF/Bush_Common_Flowers.gltf', maxDistance: Infinity }
      ],
      fallbackLevels: [
        { id: 'high', path: '/models/environment/plant_fern_high.glb', maxDistance: 130 },
        { id: 'mid', path: '/models/environment/plant_fern_mid.glb', maxDistance: 260 },
        { id: 'low', path: '/models/environment/plant_fern_low.glb', maxDistance: Infinity }
      ]
    });

    this.barnLod = await this.loadLodWithFallback({
      label: 'Barn',
      capacity: 84,
      primaryLevels: [
        { id: 'high', path: '/models/environment/premium/props/barn_high.glb', maxDistance: 200 },
        { id: 'mid', path: '/models/environment/premium/props/barn_mid.glb', maxDistance: 360 },
        { id: 'low', path: '/models/environment/premium/props/barn_low.glb', maxDistance: 560 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'barn',
          sourcePath: '/models/environment/premium/props/barn_high.glb',
          atlasFrames: 2,
          width: 13.5,
          height: 9.2,
          alphaTest: 0.28,
          textureSize: 256,
          maxDistance: Infinity
        }
      ],
      fallbackLevels: [
        { id: 'high', path: '/models/environment/barn_high.glb', maxDistance: 200 },
        { id: 'mid', path: '/models/environment/barn_mid.glb', maxDistance: 360 },
        { id: 'low', path: '/models/environment/barn_low.glb', maxDistance: 560 },
        {
          id: 'impostor',
          type: 'impostor',
          style: 'barn',
          sourcePath: '/models/environment/barn_high.glb',
          atlasFrames: 2,
          width: 13.5,
          height: 9.2,
          alphaTest: 0.28,
          textureSize: 256,
          maxDistance: Infinity
        }
      ]
    });

    if (this.enableVillageHouses) {
      this.villageHouseLod = await this.loadLodWithFallback({
        label: 'VillageHouse',
        capacity: 96,
        primaryLevels: [
          { id: 'high', path: '/models/environment/external/poly-pizza/house_town_quaternius.glb', maxDistance: 220 },
          { id: 'mid', path: '/models/environment/external/poly-pizza/house_fantasy_quaternius.glb', maxDistance: 420 },
          { id: 'low', path: '/models/environment/external/poly-pizza/house_small_kenney.glb', maxDistance: 640 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'barn',
            sourcePath: '/models/environment/external/poly-pizza/house_town_quaternius.glb',
            atlasFrames: 2,
            width: 15.5,
            height: 12.5,
            alphaTest: 0.24,
            textureSize: 512,
            maxDistance: Infinity
          }
        ],
        fallbackLevels: [
          { id: 'high', path: '/models/environment/barn_high.glb', maxDistance: 220 },
          { id: 'mid', path: '/models/environment/barn_mid.glb', maxDistance: 420 },
          { id: 'low', path: '/models/environment/barn_low.glb', maxDistance: 640 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'barn',
            sourcePath: '/models/environment/barn_high.glb',
            atlasFrames: 2,
            width: 13.5,
            height: 9.2,
            alphaTest: 0.28,
            textureSize: 256,
            maxDistance: Infinity
          }
        ]
      });
    } else {
      this.villageHouseLod = null;
    }

    this.roadSignLod = await this.loadLodWithFallback({
      label: 'RoadSign',
      capacity: 180,
      primaryLevels: [
        { id: 'high', path: '/models/environment/external/poly-pizza/signpost_kenney.glb', maxDistance: 170 },
        { id: 'mid', path: '/models/environment/external/poly-pizza/sign_arrow_quaternius.glb', maxDistance: 340 },
        { id: 'low', path: '/models/environment/external/poly-pizza/sign_quaternius_b.glb', maxDistance: Infinity }
      ],
      fallbackLevels: [
        { id: 'high', path: '/models/environment/external/poly-pizza/sign_hospital_kenney.glb', maxDistance: 170 },
        { id: 'mid', path: '/models/environment/external/poly-pizza/sign_quaternius_a.glb', maxDistance: 340 },
        { id: 'low', path: '/models/environment/external/poly-pizza/sign_quaternius_b.glb', maxDistance: Infinity }
      ]
    });
  }

  async loadLodWithFallback({ label, capacity, primaryLevels, fallbackLevels, materialHook = null }) {
    const candidates = [primaryLevels, fallbackLevels].filter((levels) => Array.isArray(levels) && levels.length > 0);
    const errors = [];

    for (let i = 0; i < candidates.length; i++) {
      const levels = candidates[i];
      try {
        const lod = new InstancedGltfLod(this.scene, {
          capacity,
          levels,
          castShadow: true,
          receiveShadow: true,
          enableInstanceColor: false,
          materialHook,
          frustumCulled: false
        });
        await lod.load();
        if (i > 0) {
          console.warn(`${label} GLTF LOD using fallback asset tier ${i}`);
        }
        return lod;
      } catch (error) {
        errors.push(error);
      }
    }

    console.warn(`${label} GLTF LOD assets failed to load, using procedural fallback`, errors);
    return null;
  }

  createFences() {
    if (this.fenceLod?.ready) {
      this.seedFenceDescriptors();
      return;
    }

    const fenceSpacing = 12;
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const postGeo = new THREE.BoxGeometry(0.12, 1.0, 0.12);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8b6b4f, roughness: 0.9 });
    const fenceOffset = ROAD_WIDTH / 2 + 2.6;

    for (let z = 40; z < maxDistance; z += fenceSpacing) {
      const leftPost = new THREE.Mesh(postGeo, postMat);
      leftPost.position.set(-fenceOffset, 0.5, z);
      leftPost.userData.side = -1;
      leftPost.userData.baseX = -fenceOffset;
      leftPost.userData.baseZ = z;
      leftPost.castShadow = true;
      this.scene.add(leftPost);
      this.fences.push(leftPost);

      const rightPost = new THREE.Mesh(postGeo, postMat);
      rightPost.position.set(fenceOffset, 0.5, z + fenceSpacing * 0.5);
      rightPost.userData.side = 1;
      rightPost.userData.baseX = fenceOffset;
      rightPost.userData.baseZ = z + fenceSpacing * 0.5;
      rightPost.castShadow = true;
      this.scene.add(rightPost);
      this.fences.push(rightPost);
    }
  }

  seedFenceDescriptors() {
    const farmDensity = this.getFarmDensity();
    const fenceSpacing = Math.round(THREE.MathUtils.clamp(10 / farmDensity, 6, 14));
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const fenceOffset = ROAD_WIDTH / 2 + 2.7;

    this.fenceDescriptors = [];

    for (let z = 40; z < maxDistance; z += fenceSpacing) {
      this.fenceDescriptors.push({
        side: -1,
        baseZ: z,
        baseX: -fenceOffset,
        baseY: 0,
        scale: 1,
        tint: this.fenceTints[Math.floor(Math.random() * this.fenceTints.length)].clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.04)
      });
      this.fenceDescriptors.push({
        side: 1,
        baseZ: z + fenceSpacing * 0.5,
        baseX: fenceOffset,
        baseY: 0,
        scale: 1,
        tint: this.fenceTints[Math.floor(Math.random() * this.fenceTints.length)].clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.04)
      });
    }
  }

  seedRockDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const routeRockDensity = this.getRockDensity();
    const targetCount = Math.round(180 * routeRockDensity);
    this.rockDescriptors = [];

    for (let i = 0; i < targetCount; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const baseZ = Math.random() * maxDistance;
      const scenery = this.getSceneryProfile(baseZ);
      const rockDensity = this.getRockDensity(scenery);
      const mountainness = scenery?.mountainness || 0;
      const spawnChance = THREE.MathUtils.clamp((0.32 + mountainness * 0.66) * rockDensity, 0.2, 0.96);
      if (Math.random() > spawnChance) continue;
      const altitude = this.getElevationAt ? this.getElevationAt(baseZ).altitude : 120;
      const biome = this.classifyRockBiome(baseZ, altitude);
      const nearOffset = ROAD_WIDTH / 2 + THREE.MathUtils.lerp(14, 6, mountainness);
      const spread = THREE.MathUtils.lerp(40, 16, mountainness);
      const lateralOffset = side * (nearOffset + Math.random() * spread);
      const scale = 0.7 + Math.random() * (0.9 + mountainness * 1.2 + (rockDensity - 1) * 0.35);

      this.rockDescriptors.push({
        side,
        baseZ,
        lateralOffset,
        baseY: 0.2,
        yaw: Math.random() * Math.PI * 2,
        pitch: (Math.random() - 0.5) * 0.18,
        roll: (Math.random() - 0.5) * 0.18,
        scale,
        mountainness,
        biome,
        visibilityRoll: Math.random(),
        tint: this.makeBiomeTint(this.rockBiomeTints[biome] || this.rockBiomeTints.valley, 0.05)
      });

      if (mountainness > 0.64 && Math.random() < (0.36 * rockDensity)) {
        this.rockDescriptors.push({
          side,
          baseZ: baseZ + (Math.random() - 0.5) * 22,
          lateralOffset: side * (nearOffset + Math.random() * (spread * 0.45)),
          baseY: 0.25,
          yaw: Math.random() * Math.PI * 2,
          pitch: (Math.random() - 0.5) * 0.22,
          roll: (Math.random() - 0.5) * 0.22,
          scale: scale * (0.65 + Math.random() * 0.55),
          mountainness,
          biome,
          visibilityRoll: Math.random(),
          tint: this.makeBiomeTint(this.rockBiomeTints[biome] || this.rockBiomeTints.valley, 0.06)
        });
      }
    }
  }

  seedFarRockDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const routeRockDensity = this.getRockDensity();
    const farPropDensity = this.getFarPropDensity();
    const targetCount = Math.round(190 * routeRockDensity * farPropDensity);
    this.farRockDescriptors = [];

    for (let i = 0; i < targetCount; i += 1) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const baseZ = Math.random() * maxDistance;
      const scenery = this.getSceneryProfile(baseZ);
      const mountainness = scenery?.mountainness || 0;
      const rockDensity = this.getRockDensity(scenery);
      const localFarDensity = this.getFarPropDensity(scenery);
      const spawnChance = THREE.MathUtils.clamp((0.24 + mountainness * 0.84) * localFarDensity, 0.18, 0.98);
      if (Math.random() > spawnChance) continue;

      const altitude = this.getElevationAt ? this.getElevationAt(baseZ).altitude : 120;
      const biome = this.classifyRockBiome(baseZ, altitude);
      const baseOffset = ROAD_WIDTH / 2 + THREE.MathUtils.lerp(72, 46, mountainness);
      const spread = THREE.MathUtils.lerp(170, 96, mountainness);
      const lateralOffset = this.clampLateralOffset(
        side * (baseOffset + Math.random() * spread),
        ROAD_WIDTH / 2 + 8
      );
      const scale = 1.2 + Math.random() * (1.6 + mountainness * 2.1 + (rockDensity - 1) * 0.7);

      this.farRockDescriptors.push({
        side,
        baseZ,
        lateralOffset,
        baseY: 0.04 + Math.random() * 0.18,
        yaw: Math.random() * Math.PI * 2,
        pitch: (Math.random() - 0.5) * 0.22,
        roll: (Math.random() - 0.5) * 0.22,
        scale,
        mountainness,
        biome,
        visibilityRoll: Math.random(),
        tint: this.makeBiomeTint(this.rockBiomeTints[biome] || this.rockBiomeTints.valley, 0.08)
      });

      if (mountainness > 0.56 && Math.random() < (0.34 * localFarDensity)) {
        this.farRockDescriptors.push({
          side,
          baseZ: baseZ + (Math.random() - 0.5) * 54,
          lateralOffset: this.clampLateralOffset(
            side * (baseOffset + Math.random() * (spread * 0.65)),
            ROAD_WIDTH / 2 + 8
          ),
          baseY: 0.02 + Math.random() * 0.2,
          yaw: Math.random() * Math.PI * 2,
          pitch: (Math.random() - 0.5) * 0.26,
          roll: (Math.random() - 0.5) * 0.26,
          scale: scale * (0.64 + Math.random() * 0.68),
          mountainness,
          biome,
          visibilityRoll: Math.random(),
          tint: this.makeBiomeTint(this.rockBiomeTints[biome] || this.rockBiomeTints.valley, 0.09)
        });
      }
    }
  }

  seedDeadTreeDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const farPropDensity = this.getFarPropDensity();
    const targetCount = Math.round(72 * farPropDensity);
    this.deadTreeDescriptors = [];

    for (let i = 0; i < targetCount; i += 1) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const baseZ = Math.random() * maxDistance;
      const scenery = this.getSceneryProfile(baseZ);
      const mountainness = scenery?.mountainness || 0;
      const zone = scenery?.zone || 'flat';
      const spawnChance = THREE.MathUtils.clamp(
        zone === 'alpine'
          ? 0.72
          : zone === 'mountain'
            ? 0.58
            : zone === 'foothills'
              ? 0.34
              : 0.16,
        0.14,
        0.82
      ) * THREE.MathUtils.clamp(0.72 + farPropDensity * 0.36, 0.6, 1.4);
      if (Math.random() > spawnChance) continue;

      const lateralOffset = this.clampLateralOffset(
        side * (ROAD_WIDTH / 2 + 56 + Math.random() * 140),
        ROAD_WIDTH / 2 + 10
      );
      const tilt = (Math.random() - 0.5) * 0.1;
      const tint = this.deadTreeTints[Math.floor(Math.random() * this.deadTreeTints.length)]
        .clone()
        .offsetHSL(0, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.08);

      this.deadTreeDescriptors.push({
        side,
        baseZ,
        lateralOffset,
        baseY: -0.04,
        yaw: Math.random() * Math.PI * 2,
        pitch: tilt,
        roll: tilt * (0.4 + Math.random() * 0.7),
        scale: 0.78 + Math.random() * (0.94 + mountainness * 0.82),
        zone,
        visibilityRoll: Math.random(),
        tint
      });
    }

    this.deadTreeDescriptors.sort((a, b) => a.baseZ - b.baseZ);
    const minSpacing = 38;
    const lastBySide = { '-1': -Infinity, '1': -Infinity };
    this.deadTreeDescriptors = this.deadTreeDescriptors.filter((treeData) => {
      const key = String(treeData.side);
      if ((treeData.baseZ - lastBySide[key]) < minSpacing) {
        return false;
      }
      lastBySide[key] = treeData.baseZ;
      return true;
    });
  }

  seedAccentDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const farPropDensity = this.getFarPropDensity();
    const count = Math.round(96 * farPropDensity);
    this.accentDescriptors = [];

    for (let i = 0; i < count; i += 1) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const baseZ = Math.random() * maxDistance;
      const scenery = this.getSceneryProfile(baseZ);
      const zone = scenery?.zone || 'flat';
      const zoneWeight = zone === 'flat'
        ? 1
        : zone === 'foothills'
          ? 0.92
          : zone === 'mountain'
            ? 0.56
            : 0.26;
      const spawnGate = zoneWeight * THREE.MathUtils.clamp(0.78 + farPropDensity * 0.26, 0.65, 1.35);
      if (Math.random() > spawnGate) continue;

      const lateralOffset = this.clampLateralOffset(
        side * (ROAD_WIDTH / 2 + 10 + Math.random() * 30),
        ROAD_WIDTH / 2 + 5.2
      );

      this.accentDescriptors.push({
        side,
        baseZ,
        lateralOffset,
        baseY: 0,
        yaw: Math.random() * Math.PI * 2,
        scale: 1.8 + Math.random() * 3.8,
        zone,
        visibilityRoll: Math.random(),
        tint: this.accentTints[Math.floor(Math.random() * this.accentTints.length)]
          .clone()
          .offsetHSL(0, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.08)
      });
    }
  }

  classifyRockBiome(distanceMeters, altitude) {
    const aridWave = 0.5 + Math.sin(distanceMeters * 0.006) * 0.3 + Math.cos(distanceMeters * 0.003) * 0.2;
    if (altitude > 600) return 'alpine';
    if (aridWave > 0.72) return 'dry';
    return 'valley';
  }

  classifyBarnBiome(distanceMeters, altitude) {
    if (altitude > 560) return 'alpine';
    if (Math.sin(distanceMeters * 0.0035) > 0.65) return 'dry';
    return 'valley';
  }

  makeBiomeTint(baseColor, variance = 0.04) {
    const tint = baseColor.clone();
    tint.offsetHSL(
      (Math.random() - 0.5) * variance * 0.6,
      (Math.random() - 0.5) * variance,
      (Math.random() - 0.5) * variance
    );
    return tint;
  }

  styleDeadTreeMaterial(material) {
    if (!material || material.userData?.__deadTreeStyled) return;
    material.userData = material.userData || {};
    material.userData.__deadTreeStyled = true;

    material.transparent = false;
    material.alphaTest = material.alphaTest > 0
      ? THREE.MathUtils.clamp(material.alphaTest, 0.16, 0.3)
      : 0;
    material.depthWrite = true;
    material.side = THREE.DoubleSide;
    if ('alphaToCoverage' in material) {
      material.alphaToCoverage = material.alphaTest > 0;
    }

    if ('roughness' in material) {
      material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.88, 0.62, 1);
    }
    if ('metalness' in material) {
      material.metalness = Math.min(material.metalness ?? 0, 0.05);
    }
    material.needsUpdate = true;
  }

  setRouteStyle(style = {}) {
    this.routeStyle = {
      ...this.routeStyle,
      ...(style || {})
    };

    this.seedFenceDescriptors();
    this.seedRockDescriptors();
    this.seedFarRockDescriptors();
    this.seedDeadTreeDescriptors();
    this.seedAccentDescriptors();
    this.seedRoadSignDescriptors();
    this.seedHayDescriptors();
    this.seedBarnDescriptors();
    if (this.enableVillageHouses) {
      this.seedVillageHouseDescriptors();
    } else {
      this.villageHouseDescriptors = [];
    }
    this.seedSummitVillageDescriptors();
    this.seedPowerLineDescriptors();

    if (this.roadSigns.length || this.roadSignLod?.ready) {
      this.createRoadSigns();
    }
  }

  getFarmDensity(scenery = null) {
    return THREE.MathUtils.clamp(
      scenery?.farmPropDensity || this.routeStyle?.farmPropDensity || 1,
      0.5,
      1.9
    );
  }

  getRockDensity(scenery = null) {
    return THREE.MathUtils.clamp(
      scenery?.rockDensity || this.routeStyle?.rockDensity || 1,
      0.5,
      1.7
    );
  }

  getFarPropDensity(scenery = null) {
    return THREE.MathUtils.clamp(
      scenery?.farPropDensity || this.routeStyle?.farPropDensity || 1,
      0.6,
      1.8
    );
  }

  clampLateralOffset(offset, minAbs = ROAD_WIDTH / 2 + 5) {
    const maxAbs = Math.max(minAbs + 1, TERRAIN_WIDTH * 0.47);
    const sign = offset < 0 ? -1 : 1;
    const abs = THREE.MathUtils.clamp(Math.abs(offset), minAbs, maxAbs);
    return sign * abs;
  }

  getSceneryProfile(distanceMeters = 0) {
    if (this.getSceneryProfileAt) {
      return this.getSceneryProfileAt(distanceMeters);
    }
    return this.routeManager?.getSceneryProfile?.(distanceMeters) || null;
  }

  createProceduralRocksFallback() {
    const rockGeo = new THREE.DodecahedronGeometry(0.7, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 1, flatShading: true });

    this.rockDescriptors.forEach((rockData) => {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.castShadow = true;
      rock.userData = { ...rockData };
      this.scene.add(rock);
      this.proceduralRocks.push(rock);
    });
  }

  createHayBales() {
    if (this.hayLod?.ready) {
      this.seedHayDescriptors();
      return;
    }

    const baleGeo = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 16);
    const baleMat = new THREE.MeshStandardMaterial({
      color: 0xd4a84b,
      roughness: 0.95,
      metalness: 0
    });

    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    for (let i = 0; i < 40; i++) {
      const bale = new THREE.Mesh(baleGeo, baleMat);
      bale.rotation.z = Math.PI / 2;
      bale.rotation.y = Math.random() * Math.PI;

      const side = Math.random() > 0.5 ? 1 : -1;
      bale.position.set(
        side * (ROAD_WIDTH / 2 + 18 + Math.random() * 24),
        0.6,
        Math.random() * maxDistance
      );
      bale.userData.baseZ = bale.position.z;
      bale.userData.baseX = bale.position.x;
      bale.userData.baseY = 0.6;
      bale.userData.baseYaw = bale.rotation.y;
      bale.castShadow = true;
      bale.receiveShadow = true;

      this.hayBales.push(bale);
      this.scene.add(bale);
    }
  }

  seedHayDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const farmDensity = this.getFarmDensity();
    const count = Math.round(44 * farmDensity);
    this.hayDescriptors = [];

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const baseZ = Math.random() * maxDistance;
      const scenery = this.getSceneryProfile(baseZ);
      const localFarmDensity = this.getFarmDensity(scenery);
      const mountainThreshold = THREE.MathUtils.clamp(0.5 + (localFarmDensity - 1) * 0.2, 0.4, 0.72);
      if ((scenery?.mountainness || 0) > mountainThreshold) continue;
      this.hayDescriptors.push({
        side,
        baseZ,
        baseX: side * (ROAD_WIDTH / 2 + 18 + Math.random() * 24),
        baseY: 0,
        yaw: Math.random() * Math.PI,
        scale: 0.9 + Math.random() * 0.35,
        tint: this.hayTints[Math.floor(Math.random() * this.hayTints.length)].clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.08)
      });
    }
  }

  seedBarnDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const farmDensity = this.getFarmDensity();
    const spacing = Math.round(THREE.MathUtils.clamp(780 / farmDensity, 420, 880));
    this.barnDescriptors = [];

    for (let z = 400; z < maxDistance; z += spacing) {
      if (Math.random() < (0.35 / farmDensity)) continue;

      const side = Math.random() > 0.5 ? 1 : -1;
      const baseZ = z + Math.random() * 220;
      const scenery = this.getSceneryProfile(baseZ);
      const localFarmDensity = this.getFarmDensity(scenery);
      const mountainThreshold = THREE.MathUtils.clamp(0.42 + (localFarmDensity - 1) * 0.14, 0.34, 0.62);
      if ((scenery?.mountainness || 0) > mountainThreshold) continue;
      this.barnDescriptors.push({
        side,
        baseZ,
        lateralOffset: side * (ROAD_WIDTH / 2 + 42 + Math.random() * 22),
        baseY: 0,
        yaw: Math.random() * Math.PI * 0.3 - 0.15,
        scale: 0.72 + Math.random() * 0.5
      });
    }

    this.barnDescriptors.forEach((barnData) => {
      const altitude = this.getElevationAt ? this.getElevationAt(barnData.baseZ).altitude : 120;
      barnData.biome = this.classifyBarnBiome(barnData.baseZ, altitude);
      barnData.tint = this.makeBiomeTint(this.barnBiomeTints[barnData.biome] || this.barnBiomeTints.valley, 0.08);
    });
  }

  pickVillageHouseScale(variant) {
    if (variant === 'house_town_quaternius') return 0.5 + Math.random() * 0.24;
    if (variant === 'building_big_quaternius') return 0.58 + Math.random() * 0.28;
    if (variant === 'house_compact_quaternius') return 0.82 + Math.random() * 0.3;
    if (variant === 'house_fantasy_quaternius') return 0.66 + Math.random() * 0.28;
    return 0.86 + Math.random() * 0.36;
  }

  pickVillageHouseVariant(zone = 'flat') {
    const flatWeights = [
      ['house_small_kenney', 0.34],
      ['house_two_story_kenney', 0.26],
      ['house_compact_quaternius', 0.24],
      ['house_fantasy_quaternius', 0.16]
    ];
    const foothillWeights = [
      ['house_two_story_kenney', 0.18],
      ['house_compact_quaternius', 0.32],
      ['house_fantasy_quaternius', 0.24],
      ['house_town_quaternius', 0.2],
      ['building_big_quaternius', 0.06]
    ];
    const mountainWeights = [
      ['house_compact_quaternius', 0.46],
      ['house_fantasy_quaternius', 0.34],
      ['house_town_quaternius', 0.2]
    ];

    const weights = zone === 'mountain' || zone === 'alpine'
      ? mountainWeights
      : zone === 'foothills'
        ? foothillWeights
        : flatWeights;

    const threshold = Math.random();
    let accum = 0;
    for (let i = 0; i < weights.length; i += 1) {
      accum += weights[i][1];
      if (threshold <= accum) {
        return weights[i][0];
      }
    }
    return weights[weights.length - 1][0];
  }

  seedVillageHouseDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const routeId = this.routeManager?.getCurrentRoute?.()?.id || 'flat-loop';
    const farmDensity = this.getFarmDensity();
    const farDensity = this.getFarPropDensity();
    const routeMultiplier = routeId === 'flat-loop' ? 1.24 : 0.86;
    const targetCount = Math.round(34 * routeMultiplier * farmDensity * farDensity);

    this.villageHouseDescriptors = [];

    for (let i = 0; i < targetCount; i += 1) {
      const baseZ = Math.random() * maxDistance;
      const scenery = this.getSceneryProfile(baseZ);
      const mountainness = scenery?.mountainness || 0;
      const zone = scenery?.zone || 'flat';
      const zoneGate = zone === 'flat' ? 1 : zone === 'foothills' ? 0.72 : zone === 'mountain' ? 0.3 : 0.08;
      if (Math.random() > zoneGate) continue;

      const side = Math.random() > 0.5 ? 1 : -1;
      const variant = this.pickVillageHouseVariant(zone);
      const lateralOffset = this.clampLateralOffset(
        side * (ROAD_WIDTH / 2 + 30 + Math.random() * (42 - mountainness * 14)),
        ROAD_WIDTH / 2 + 16
      );

      this.villageHouseDescriptors.push({
        side,
        baseZ,
        lateralOffset,
        baseY: 0,
        yaw: Math.random() * Math.PI * 2,
        roll: (Math.random() - 0.5) * 0.04,
        pitch: (Math.random() - 0.5) * 0.04,
        zone,
        variant,
        scale: this.pickVillageHouseScale(variant),
        visibilityRoll: Math.random(),
        tint: this.villageHouseTints[Math.floor(Math.random() * this.villageHouseTints.length)]
          .clone()
          .offsetHSL(0, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.08)
      });
    }
  }

  seedSummitVillageDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    this.summitVillageDescriptors = [];
    const anchors = [];

    for (let z = 900; z < maxDistance - 500; z += 440) {
      const scenery = this.getSceneryProfile(z);
      if ((scenery?.mountainness || 0) > 0.72 && (scenery?.alpineFactor || 0) > 0.3) {
        anchors.push(z + (Math.random() - 0.5) * 80);
      }
    }

    if (!anchors.length) {
      return;
    }

    anchors.slice(0, 3).forEach((anchor) => {
      const clusterSize = 3 + Math.floor(Math.random() * 3);
      const villageSide = Math.random() > 0.5 ? 1 : -1;

      for (let i = 0; i < clusterSize; i += 1) {
        const side = Math.random() < 0.7 ? villageSide : -villageSide;
        const spread = (i - (clusterSize - 1) * 0.5) * 30;
        const baseZ = anchor + spread + (Math.random() - 0.5) * 14;
        const altitude = this.getElevationAt ? this.getElevationAt(baseZ).altitude : 120;
        this.summitVillageDescriptors.push({
          type: 'summit-village',
          side,
          baseZ,
          lateralOffset: side * (ROAD_WIDTH / 2 + 24 + Math.random() * 18),
          baseY: 0,
          yaw: Math.random() * Math.PI * 2,
          scale: 0.46 + Math.random() * 0.26,
          biome: 'alpine',
          tint: this.makeBiomeTint(this.barnBiomeTints.alpine, 0.05),
          altitude
        });
      }
    });
  }

  getAllBarnDescriptors() {
    return [...this.barnDescriptors, ...this.summitVillageDescriptors];
  }

  isBarnDescriptorVisible(barnData, scenery) {
    const mountainness = scenery?.mountainness || 0;
    const farmDensity = this.getFarmDensity(scenery);
    if (barnData.type === 'summit-village') {
      return mountainness > 0.62;
    }
    const mountainThreshold = THREE.MathUtils.clamp(0.42 + (farmDensity - 1) * 0.14, 0.34, 0.62);
    return mountainness <= mountainThreshold;
  }

  recycleBarnDescriptor(barnData, totalDistance, aheadDistance) {
    if (barnData.type === 'summit-village') {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidateZ = totalDistance + 280 + Math.random() * (aheadDistance - 320);
        const candidateScenery = this.getSceneryProfile(candidateZ);
        if ((candidateScenery?.mountainness || 0) > 0.62) {
          barnData.baseZ = candidateZ;
          barnData.side = Math.random() > 0.5 ? 1 : -1;
          barnData.lateralOffset = barnData.side * (ROAD_WIDTH / 2 + 24 + Math.random() * 18);
          barnData.yaw = Math.random() * Math.PI * 2;
          barnData.scale = 0.46 + Math.random() * 0.26;
          barnData.tint = this.makeBiomeTint(this.barnBiomeTints.alpine, 0.05);
          return;
        }
      }
      barnData.baseZ += aheadDistance;
      return;
    }

    barnData.baseZ += aheadDistance;
    barnData.lateralOffset = barnData.side * (ROAD_WIDTH / 2 + 42 + Math.random() * 22);
    barnData.scale = 0.72 + Math.random() * 0.5;
    const altitude = this.getElevationAt ? this.getElevationAt(barnData.baseZ).altitude : 120;
    barnData.biome = this.classifyBarnBiome(barnData.baseZ, altitude);
    barnData.tint = this.makeBiomeTint(this.barnBiomeTints[barnData.biome] || this.barnBiomeTints.valley, 0.08);
  }

  createProceduralBarnFallbacks() {
    this.getAllBarnDescriptors().forEach((barnData) => {
      const barn = this.createBarn();
      barn.userData = { ...barnData };
      this.scene.add(barn);
      this.proceduralBarns.push(barn);
    });
  }

  createBarn() {
    const barn = new THREE.Group();

    const barnColors = [0x8b2020, 0x7a2828, 0x6b3030, 0x8b3535, 0x5c2828];
    const barnColor = barnColors[Math.floor(Math.random() * barnColors.length)];

    const wallMat = new THREE.MeshStandardMaterial({
      color: barnColor,
      roughness: 0.92,
      metalness: 0
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.85
    });

    // Main structure
    const bodyGeo = new THREE.BoxGeometry(8, 5, 12);
    const body = new THREE.Mesh(bodyGeo, wallMat);
    body.position.y = 2.5;
    body.castShadow = true;
    body.receiveShadow = true;
    barn.add(body);

    // Roof
    const roofGeo = new THREE.ConeGeometry(7, 3, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 6.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    barn.add(roof);

    // Door
    const doorGeo = new THREE.BoxGeometry(2.5, 3.5, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3d2a1a });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.75, 6.1);
    barn.add(door);

    return barn;
  }

  createPowerLines() {
    if (this.powerLineLod?.ready) {
      this.seedPowerLineDescriptors();
      return;
    }

    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, 8, 8);
    const crossbarGeo = new THREE.BoxGeometry(3, 0.1, 0.1);

    for (let z = 200; z < maxDistance; z += 180) {
      if (Math.random() < 0.3) continue;

      const pole = new THREE.Group();

      const post = new THREE.Mesh(poleGeo, poleMat);
      post.position.y = 4;
      post.castShadow = true;
      pole.add(post);

      const crossbar = new THREE.Mesh(crossbarGeo, poleMat);
      crossbar.position.y = 7.5;
      pole.add(crossbar);

      const side = Math.random() > 0.5 ? 1 : -1;
      pole.position.set(
        side * (ROAD_WIDTH / 2 + 9.5),
        0,
        z + Math.random() * 60
      );
      pole.userData.baseZ = pole.position.z;
      pole.userData.side = side;
      pole.userData.baseX = pole.position.x;
      pole.userData.baseY = 0;
      pole.userData.baseYaw = 0;

      this.powerLines.push(pole);
      this.scene.add(pole);
    }
  }

  createVillageHouses() {
    if (!this.enableVillageHouses) {
      this.villageHouseDescriptors = [];
      return;
    }
    this.seedVillageHouseDescriptors();
  }

  createRoadSigns() {
    this.seedRoadSignDescriptors();
    if (this.roadSignLod?.ready) {
      this.roadSigns.forEach((sign) => {
        this.scene.remove(sign);
        sign.traverse((child) => {
          child.geometry?.dispose?.();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat?.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        });
      });
      this.roadSigns = [];
      return;
    }

    this.roadSigns.forEach((sign) => {
      this.scene.remove(sign);
      sign.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat?.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      });
    });
    this.roadSigns = this.roadSignDescriptors.map(() => {
      const sign = this.createRoadSign();
      this.scene.add(sign);
      return sign;
    });
  }

  seedRoadSignDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const routeId = this.routeManager?.getCurrentRoute?.()?.id || 'flat-loop';
    const spacing = routeId === 'flat-loop' ? 240 : 176;
    this.roadSignDescriptors = [];

    for (let z = 180; z < maxDistance; z += spacing) {
      if (Math.random() < (routeId === 'flat-loop' ? 0.25 : 0.18)) continue;

      const baseZ = z + (Math.random() - 0.5) * 54;
      const scenery = this.getSceneryProfile(baseZ);
      const mountainness = scenery?.mountainness || 0;
      const zone = scenery?.zone || 'flat';
      const zoneGate = zone === 'flat' ? 1 : zone === 'foothills' ? 0.9 : zone === 'mountain' ? 0.5 : 0.2;
      if (mountainness > 0.9 || Math.random() > zoneGate) continue;

      const side = Math.random() > 0.5 ? 1 : -1;
      const colorRoll = Math.random();
      const signColor = colorRoll < 0.34
        ? 0xf6f7fb
        : colorRoll < 0.68
          ? 0x2f72d6
          : 0x27a05c;

      this.roadSignDescriptors.push({
        side,
        baseZ,
        baseX: side * (ROAD_WIDTH / 2 + 4.6 + Math.random() * 2.1),
        baseY: 0,
        yaw: side > 0 ? Math.PI * 1.5 : Math.PI * 0.5,
        scale: 0.9 + Math.random() * 0.35,
        signColor
      });
    }
  }

  createRoadSign() {
    const sign = new THREE.Group();

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 2.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x646d74, roughness: 0.82, metalness: 0.22 })
    );
    pole.position.y = 1.22;
    pole.castShadow = true;
    pole.receiveShadow = true;
    sign.add(pole);

    const boardMat = new THREE.MeshStandardMaterial({ color: 0xf6f7fb, roughness: 0.62, metalness: 0.05 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.44, 0.08), boardMat);
    board.position.set(0, 2.03, 0);
    board.castShadow = true;
    board.receiveShadow = true;
    sign.add(board);

    const chevron = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x1b1f27, side: THREE.DoubleSide })
    );
    chevron.position.set(0, 2.03, 0.05);
    sign.add(chevron);

    sign.userData.board = board;
    return sign;
  }

  seedPowerLineDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const farmDensity = this.getFarmDensity();
    const spacing = Math.round(THREE.MathUtils.clamp(170 / farmDensity, 95, 220));
    this.powerLineDescriptors = [];

    for (let z = 200; z < maxDistance; z += spacing) {
      if (Math.random() < (0.28 / farmDensity)) continue;

      const side = Math.random() > 0.5 ? 1 : -1;
      const baseZ = z + Math.random() * 60;
      const scenery = this.getSceneryProfile(baseZ);
      const localFarmDensity = this.getFarmDensity(scenery);
      const mountainThreshold = THREE.MathUtils.clamp(0.62 + (localFarmDensity - 1) * 0.1, 0.52, 0.76);
      if ((scenery?.mountainness || 0) > mountainThreshold) continue;
      this.powerLineDescriptors.push({
        side,
        baseZ,
        baseX: side * (ROAD_WIDTH / 2 + 9.5),
        baseY: 0,
        yaw: 0,
        scale: 1,
        tint: this.powerLineTints[Math.floor(Math.random() * this.powerLineTints.length)].clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.04)
      });
    }
  }

  setDetailLevel(level) {
    this.detailLevel = level;

    const showMajor = level !== 'low';
    const showMinor = level === 'high';

    this.fenceLod?.setVisible(showMinor);
    this.hayLod?.setVisible(showMajor);
    this.powerLineLod?.setVisible(showMinor);
    this.rockLod?.setVisible(showMajor);
    this.farRockLod?.setVisible(showMajor);
    this.deadTreeLod?.setVisible(showMajor);
    this.accentLod?.setVisible(showMajor);
    this.roadSignLod?.setVisible(showMajor);
    this.barnLod?.setVisible(showMajor);
    this.villageHouseLod?.setVisible(showMajor);

    this.proceduralRocks.forEach((rock) => { rock.visible = showMajor; });
    this.proceduralBarns.forEach((barn) => { barn.visible = showMajor; });

    this.fences.forEach(post => { post.visible = showMinor; });
    this.hayBales.forEach(bale => { bale.visible = showMajor; });
    this.powerLines.forEach(pole => { pole.visible = showMinor; });
    this.roadSigns.forEach((sign) => { sign.visible = showMajor; });
  }

  getRelativeElevation(distanceMeters, baseOffset = 0) {
    const info = this.getElevationAt(distanceMeters);
    return (info.altitude - this.currentAltitude) * ALT_SCALE + baseOffset;
  }

  update(deltaTime, worldState) {
    this.time += deltaTime;

    const { totalDistance, currentAltitude, getElevationAt, getSceneryProfile, routeManager } = worldState;
    this.currentAltitude = currentAltitude;
    this.getElevationAt = getElevationAt;
    this.routeManager = routeManager;
    this.getSceneryProfileAt = getSceneryProfile || this.getSceneryProfileAt;

    const aheadDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    this.updateFences(totalDistance, aheadDistance);
    this.updateRocks(totalDistance, aheadDistance);
    this.updateFarRocks(totalDistance, aheadDistance);
    this.updateDeadTrees(totalDistance, aheadDistance);
    this.updateAccents(totalDistance, aheadDistance);
    this.updateRoadSigns(totalDistance, aheadDistance);
    if (this.enableVillageHouses) {
      this.updateVillageHouses(totalDistance, aheadDistance);
    }
    this.updateHayBales(totalDistance, aheadDistance);
    this.updateBarns(totalDistance, aheadDistance);
    this.updatePowerLines(totalDistance, aheadDistance);
  }

  updateFences(totalDistance, aheadDistance) {
    if (this.fenceLod?.ready) {
      this.fenceLod.beginFrame();

      this.fenceDescriptors.forEach((fenceData) => {
        if ((fenceData.baseZ - totalDistance) < -60) {
          fenceData.baseZ += aheadDistance;
        }
        const scenery = this.getSceneryProfile(fenceData.baseZ);
        const farmDensity = this.getFarmDensity(scenery);
        const mountainThreshold = THREE.MathUtils.clamp(0.58 + (farmDensity - 1) * 0.16, 0.46, 0.76);
        if ((scenery?.mountainness || 0) > mountainThreshold) {
          return;
        }

        const curve = this.routeManager.getCurveInfo(fenceData.baseZ);
        this.fenceDummy.position.set(
          curve.lateral + fenceData.baseX,
          this.getRelativeElevation(fenceData.baseZ, fenceData.baseY || 0),
          fenceData.baseZ - totalDistance
        );
        this.fenceDummy.rotation.set(0, curve.heading, 0);
        this.fenceDummy.scale.setScalar(fenceData.scale || 1);
        this.fenceDummy.updateMatrix();

        this.fenceLod.addInstance(this.fenceDummy.matrix, fenceData.baseZ - totalDistance, {
          color: fenceData.tint || this.fenceTints[0]
        });
      });

      this.fenceLod.endFrame();
      return;
    }

    this.fences.forEach(post => {
      if (post.userData.baseZ === undefined) {
        post.userData.baseZ = post.position.z;
      }

      const relativeZ = post.userData.baseZ - totalDistance;

      if (relativeZ < -60) {
        post.userData.baseZ += aheadDistance;
      }
      const scenery = this.getSceneryProfile(post.userData.baseZ);
      const farmDensity = this.getFarmDensity(scenery);
      const mountainThreshold = THREE.MathUtils.clamp(0.58 + (farmDensity - 1) * 0.16, 0.46, 0.76);
      if ((scenery?.mountainness || 0) > mountainThreshold) {
        post.visible = false;
        return;
      }
      post.visible = true;

      const curve = this.routeManager.getCurveInfo(post.userData.baseZ);
      post.position.z = post.userData.baseZ - totalDistance;
      post.position.x = curve.lateral + post.userData.baseX;
      post.position.y = this.getRelativeElevation(post.userData.baseZ, 0.5);
      post.rotation.y = curve.heading;
    });
  }

  updateRocks(totalDistance, aheadDistance) {
    if (this.rockLod?.ready) {
      this.rockLod.beginFrame();

      this.rockDescriptors.forEach((rockData) => {
        if ((rockData.baseZ - totalDistance) < -70) {
          rockData.baseZ += aheadDistance;
          const scenery = this.getSceneryProfile(rockData.baseZ);
          const rockDensity = this.getRockDensity(scenery);
          const mountainness = scenery?.mountainness || 0;
          const nearOffset = ROAD_WIDTH / 2 + THREE.MathUtils.lerp(14, 6, mountainness);
          const spread = THREE.MathUtils.lerp(40, 16, mountainness);
          rockData.lateralOffset = rockData.side * (nearOffset + Math.random() * spread);
          rockData.scale = 0.7 + Math.random() * (0.9 + mountainness * 1.2 + (rockDensity - 1) * 0.35);
          rockData.mountainness = mountainness;
          rockData.yaw = Math.random() * Math.PI * 2;
          rockData.visibilityRoll = Math.random();
          const altitude = this.getElevationAt ? this.getElevationAt(rockData.baseZ).altitude : 120;
          rockData.biome = this.classifyRockBiome(rockData.baseZ, altitude);
          rockData.tint = this.makeBiomeTint(this.rockBiomeTints[rockData.biome] || this.rockBiomeTints.valley, 0.05);
        }
        const scenery = this.getSceneryProfile(rockData.baseZ);
        const rockDensity = this.getRockDensity(scenery);
        const minMountain = THREE.MathUtils.clamp(0.22 + (1 - rockDensity) * 0.2, 0.08, 0.38);
        const skipChance = THREE.MathUtils.clamp(0.45 + (1 - rockDensity) * 0.35, 0.18, 0.84);
        if ((scenery?.mountainness || 0) < minMountain && (rockData.visibilityRoll ?? 0.5) < skipChance) {
          return;
        }

        const curve = this.routeManager.getCurveInfo(rockData.baseZ);
        this.rockDummy.position.set(
          curve.lateral + rockData.lateralOffset,
          this.getRelativeElevation(rockData.baseZ, rockData.baseY),
          rockData.baseZ - totalDistance
        );
        this.rockDummy.rotation.set(
          rockData.pitch,
          rockData.yaw + curve.heading * 0.25,
          rockData.roll
        );
        this.rockDummy.scale.setScalar(rockData.scale);
        this.rockDummy.updateMatrix();

        this.rockLod.addInstance(this.rockDummy.matrix, rockData.baseZ - totalDistance, {
          color: rockData.tint || this.rockBiomeTints.valley
        });
      });

      this.rockLod.endFrame();
      return;
    }

    this.proceduralRocks.forEach((rock) => {
      const rockData = rock.userData;
      if ((rockData.baseZ - totalDistance) < -70) {
        rockData.baseZ += aheadDistance;
        const scenery = this.getSceneryProfile(rockData.baseZ);
        const rockDensity = this.getRockDensity(scenery);
        const mountainness = scenery?.mountainness || 0;
        const nearOffset = ROAD_WIDTH / 2 + THREE.MathUtils.lerp(14, 6, mountainness);
        const spread = THREE.MathUtils.lerp(40, 16, mountainness);
        rockData.lateralOffset = rockData.side * (nearOffset + Math.random() * spread);
        rockData.scale = 0.7 + Math.random() * (0.9 + mountainness * 1.2 + (rockDensity - 1) * 0.35);
        rockData.visibilityRoll = Math.random();
      }
      const scenery = this.getSceneryProfile(rockData.baseZ);
      const rockDensity = this.getRockDensity(scenery);
      const minMountain = THREE.MathUtils.clamp(0.22 + (1 - rockDensity) * 0.2, 0.08, 0.38);
      const skipChance = THREE.MathUtils.clamp(0.45 + (1 - rockDensity) * 0.35, 0.18, 0.84);
      if ((scenery?.mountainness || 0) < minMountain && (rockData.visibilityRoll ?? 0.5) < skipChance) {
        rock.visible = false;
        return;
      }
      rock.visible = true;

      const curve = this.routeManager.getCurveInfo(rockData.baseZ);
      rock.position.set(
        curve.lateral + rockData.lateralOffset,
        this.getRelativeElevation(rockData.baseZ, rockData.baseY),
        rockData.baseZ - totalDistance
      );
      rock.rotation.set(rockData.pitch, rockData.yaw + curve.heading * 0.25, rockData.roll);
      rock.scale.setScalar(rockData.scale);
    });
  }

  updateFarRocks(totalDistance, aheadDistance) {
    if (!this.farRockLod?.ready || !this.farRockDescriptors.length) return;

    this.farRockLod.beginFrame();

    this.farRockDescriptors.forEach((rockData) => {
      if ((rockData.baseZ - totalDistance) < -140) {
        rockData.baseZ += aheadDistance;
        const scenery = this.getSceneryProfile(rockData.baseZ);
        const rockDensity = this.getRockDensity(scenery);
        const mountainness = scenery?.mountainness || 0;
        const baseOffset = ROAD_WIDTH / 2 + THREE.MathUtils.lerp(72, 46, mountainness);
        const spread = THREE.MathUtils.lerp(170, 96, mountainness);
        rockData.lateralOffset = this.clampLateralOffset(
          rockData.side * (baseOffset + Math.random() * spread),
          ROAD_WIDTH / 2 + 8
        );
        rockData.scale = 1.2 + Math.random() * (1.6 + mountainness * 2.1 + (rockDensity - 1) * 0.7);
        rockData.yaw = Math.random() * Math.PI * 2;
        rockData.pitch = (Math.random() - 0.5) * 0.22;
        rockData.roll = (Math.random() - 0.5) * 0.22;
        rockData.baseY = 0.04 + Math.random() * 0.18;
        rockData.visibilityRoll = Math.random();
        const altitude = this.getElevationAt ? this.getElevationAt(rockData.baseZ).altitude : 120;
        rockData.biome = this.classifyRockBiome(rockData.baseZ, altitude);
        rockData.tint = this.makeBiomeTint(this.rockBiomeTints[rockData.biome] || this.rockBiomeTints.valley, 0.08);
      }

      const scenery = this.getSceneryProfile(rockData.baseZ);
      const rockDensity = this.getRockDensity(scenery);
      const farPropDensity = this.getFarPropDensity(scenery);
      const mountainness = scenery?.mountainness || 0;
      const minMountain = THREE.MathUtils.clamp(0.12 + (1 - farPropDensity) * 0.18, 0.05, 0.3);
      const skipChance = THREE.MathUtils.clamp(0.36 + (1 - rockDensity) * 0.34, 0.12, 0.78);
      if (mountainness < minMountain && (rockData.visibilityRoll ?? 0.5) < skipChance) return;

      const curve = this.routeManager.getCurveInfo(rockData.baseZ);
      this.farRockDummy.position.set(
        curve.lateral + rockData.lateralOffset,
        this.getRelativeElevation(rockData.baseZ, rockData.baseY),
        rockData.baseZ - totalDistance
      );
      this.farRockDummy.rotation.set(
        rockData.pitch,
        rockData.yaw + curve.heading * 0.12,
        rockData.roll
      );
      this.farRockDummy.scale.setScalar(rockData.scale);
      this.farRockDummy.updateMatrix();

      this.farRockLod.addInstance(this.farRockDummy.matrix, rockData.baseZ - totalDistance, {
        color: rockData.tint || this.rockBiomeTints.valley
      });
    });

    this.farRockLod.endFrame();
  }

  updateDeadTrees(totalDistance, aheadDistance) {
    if (!this.deadTreeLod?.ready || !this.deadTreeDescriptors.length) return;

    this.deadTreeLod.beginFrame();

    this.deadTreeDescriptors.forEach((treeData) => {
      if ((treeData.baseZ - totalDistance) < -140) {
        treeData.baseZ += aheadDistance;
        const scenery = this.getSceneryProfile(treeData.baseZ);
        const mountainness = scenery?.mountainness || 0;
        treeData.zone = scenery?.zone || 'flat';
        treeData.lateralOffset = this.clampLateralOffset(
          treeData.side * (ROAD_WIDTH / 2 + 56 + Math.random() * 140),
          ROAD_WIDTH / 2 + 10
        );
        treeData.scale = 0.78 + Math.random() * (0.94 + mountainness * 0.82);
        treeData.yaw = Math.random() * Math.PI * 2;
        treeData.pitch = (Math.random() - 0.5) * 0.1;
        treeData.roll = treeData.pitch * (0.4 + Math.random() * 0.7);
        treeData.visibilityRoll = Math.random();
        treeData.tint = this.deadTreeTints[Math.floor(Math.random() * this.deadTreeTints.length)]
          .clone()
          .offsetHSL(0, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.08);
      }

      const scenery = this.getSceneryProfile(treeData.baseZ);
      const zone = scenery?.zone || treeData.zone || 'flat';
      const farDensity = this.getFarPropDensity(scenery);
      const zoneWeight = zone === 'alpine'
        ? 1
        : zone === 'mountain'
          ? 0.84
          : zone === 'foothills'
            ? 0.52
            : 0.24;
      if ((treeData.visibilityRoll ?? 0.5) > zoneWeight * THREE.MathUtils.clamp(0.7 + farDensity * 0.34, 0.62, 1.28)) {
        return;
      }

      const curve = this.routeManager.getCurveInfo(treeData.baseZ);
      this.deadTreeDummy.position.set(
        curve.lateral + treeData.lateralOffset,
        this.getRelativeElevation(treeData.baseZ, treeData.baseY),
        treeData.baseZ - totalDistance
      );
      this.deadTreeDummy.rotation.set(
        treeData.pitch,
        treeData.yaw + curve.heading * 0.16,
        treeData.roll
      );
      this.deadTreeDummy.scale.setScalar(treeData.scale);
      this.deadTreeDummy.updateMatrix();

      const lodDistance = Math.hypot(
        treeData.baseZ - totalDistance,
        treeData.lateralOffset || 0
      );

      this.deadTreeLod.addInstance(this.deadTreeDummy.matrix, lodDistance, {
        color: treeData.tint || this.deadTreeTints[0]
      });
    });

    this.deadTreeLod.endFrame();
  }

  updateAccents(totalDistance, aheadDistance) {
    if (!this.accentLod?.ready || !this.accentDescriptors.length) return;

    this.accentLod.beginFrame();

    this.accentDescriptors.forEach((accentData) => {
      if ((accentData.baseZ - totalDistance) < -120) {
        accentData.baseZ += aheadDistance;
        const scenery = this.getSceneryProfile(accentData.baseZ);
        const zone = scenery?.zone || 'flat';
        accentData.zone = zone;
        accentData.lateralOffset = this.clampLateralOffset(
          accentData.side * (ROAD_WIDTH / 2 + 10 + Math.random() * 30),
          ROAD_WIDTH / 2 + 5.2
        );
        accentData.scale = 1.8 + Math.random() * 3.8;
        accentData.yaw = Math.random() * Math.PI * 2;
        accentData.visibilityRoll = Math.random();
        accentData.tint = this.accentTints[Math.floor(Math.random() * this.accentTints.length)]
          .clone()
          .offsetHSL(0, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.08);
      }

      const scenery = this.getSceneryProfile(accentData.baseZ);
      const farDensity = this.getFarPropDensity(scenery);
      const zone = scenery?.zone || accentData.zone || 'flat';
      const zoneWeight = zone === 'flat'
        ? 1
        : zone === 'foothills'
          ? 0.92
          : zone === 'mountain'
            ? 0.56
            : 0.26;
      const threshold = zoneWeight * THREE.MathUtils.clamp(0.78 + farDensity * 0.26, 0.65, 1.35);
      if ((accentData.visibilityRoll ?? 0.5) > threshold) return;

      const curve = this.routeManager.getCurveInfo(accentData.baseZ);
      this.accentDummy.position.set(
        curve.lateral + accentData.lateralOffset,
        this.getRelativeElevation(accentData.baseZ, accentData.baseY),
        accentData.baseZ - totalDistance
      );
      this.accentDummy.rotation.set(0, accentData.yaw + curve.heading * 0.25, 0);
      this.accentDummy.scale.setScalar(accentData.scale);
      this.accentDummy.updateMatrix();

      this.accentLod.addInstance(this.accentDummy.matrix, accentData.baseZ - totalDistance, {
        color: accentData.tint || this.accentTints[0]
      });
    });

    this.accentLod.endFrame();
  }

  updateRoadSigns(totalDistance, aheadDistance) {
    if (!this.roadSignDescriptors.length) return;

    if (this.roadSignLod?.ready) {
      this.roadSignLod.beginFrame();

      this.roadSignDescriptors.forEach((signData) => {
        if ((signData.baseZ - totalDistance) < -80) {
          signData.baseZ += aheadDistance;
          signData.side = Math.random() > 0.5 ? 1 : -1;
          signData.baseX = signData.side * (ROAD_WIDTH / 2 + 4.6 + Math.random() * 2.1);
          signData.yaw = signData.side > 0 ? Math.PI * 1.5 : Math.PI * 0.5;
          signData.scale = 0.9 + Math.random() * 0.35;
        }

        const scenery = this.getSceneryProfile(signData.baseZ);
        const farmDensity = this.getFarmDensity(scenery);
        const mountainThreshold = THREE.MathUtils.clamp(0.84 + (farmDensity - 1) * 0.06, 0.78, 0.92);
        if ((scenery?.mountainness || 0) > mountainThreshold) {
          return;
        }

        const curve = this.routeManager.getCurveInfo(signData.baseZ);
        this.roadSignDummy.position.set(
          curve.lateral + signData.baseX,
          this.getRelativeElevation(signData.baseZ, signData.baseY),
          signData.baseZ - totalDistance
        );
        this.roadSignDummy.rotation.set(0, signData.yaw + curve.heading * 0.65, 0);
        this.roadSignDummy.scale.setScalar(signData.scale || 1);
        this.roadSignDummy.updateMatrix();

        this.roadSignLod.addInstance(this.roadSignDummy.matrix, signData.baseZ - totalDistance);
      });

      this.roadSignLod.endFrame();
      return;
    }

    if (!this.roadSigns.length) return;

    this.roadSigns.forEach((sign, index) => {
      const signData = this.roadSignDescriptors[index];
      if (!signData) return;

      if ((signData.baseZ - totalDistance) < -80) {
        signData.baseZ += aheadDistance;
        signData.side = Math.random() > 0.5 ? 1 : -1;
        signData.baseX = signData.side * (ROAD_WIDTH / 2 + 4.6 + Math.random() * 2.1);
        signData.yaw = signData.side > 0 ? Math.PI * 1.5 : Math.PI * 0.5;
      }

      const scenery = this.getSceneryProfile(signData.baseZ);
      const farmDensity = this.getFarmDensity(scenery);
      const mountainThreshold = THREE.MathUtils.clamp(0.84 + (farmDensity - 1) * 0.06, 0.78, 0.92);
      if ((scenery?.mountainness || 0) > mountainThreshold) {
        sign.visible = false;
        return;
      }
      sign.visible = true;

      const curve = this.routeManager.getCurveInfo(signData.baseZ);
      sign.position.set(
        curve.lateral + signData.baseX,
        this.getRelativeElevation(signData.baseZ, signData.baseY),
        signData.baseZ - totalDistance
      );
      sign.rotation.set(0, signData.yaw + curve.heading * 0.65, 0);
      sign.scale.setScalar(signData.scale || 1);

      const board = sign.userData?.board;
      if (board?.material?.color?.isColor) {
        board.material.color.setHex(signData.signColor || 0xf6f7fb);
      }
    });
  }

  updateVillageHouses(totalDistance, aheadDistance) {
    if (!this.villageHouseLod?.ready || !this.villageHouseDescriptors.length) return;

    const routeId = this.routeManager?.getCurrentRoute?.()?.id || 'flat-loop';
    this.villageHouseLod.beginFrame();

    this.villageHouseDescriptors.forEach((houseData) => {
      if ((houseData.baseZ - totalDistance) < -130) {
        houseData.baseZ += aheadDistance;
        const scenery = this.getSceneryProfile(houseData.baseZ);
        const mountainness = scenery?.mountainness || 0;
        houseData.zone = scenery?.zone || 'flat';
        houseData.variant = this.pickVillageHouseVariant(houseData.zone);
        houseData.scale = this.pickVillageHouseScale(houseData.variant);
        houseData.side = Math.random() > 0.5 ? 1 : -1;
        houseData.lateralOffset = this.clampLateralOffset(
          houseData.side * (ROAD_WIDTH / 2 + 30 + Math.random() * (42 - mountainness * 14)),
          ROAD_WIDTH / 2 + 16
        );
        houseData.yaw = Math.random() * Math.PI * 2;
        houseData.pitch = (Math.random() - 0.5) * 0.04;
        houseData.roll = (Math.random() - 0.5) * 0.04;
        houseData.visibilityRoll = Math.random();
      }

      const scenery = this.getSceneryProfile(houseData.baseZ);
      const zone = scenery?.zone || houseData.zone || 'flat';
      const mountainness = scenery?.mountainness || 0;
      if (mountainness > 0.9) return;

      const zoneWeight = zone === 'flat'
        ? 1
        : zone === 'foothills'
          ? 0.78
          : zone === 'mountain'
            ? 0.44
            : 0.22;
      const routeWeight = routeId === 'flat-loop' ? 1 : 0.82;
      if ((houseData.visibilityRoll ?? 0.5) > zoneWeight * routeWeight) return;

      const curve = this.routeManager.getCurveInfo(houseData.baseZ);
      this.villageHouseDummy.position.set(
        curve.lateral + houseData.lateralOffset,
        this.getRelativeElevation(houseData.baseZ, houseData.baseY),
        houseData.baseZ - totalDistance
      );
      this.villageHouseDummy.rotation.set(
        houseData.pitch,
        houseData.yaw + curve.heading * 0.3,
        houseData.roll
      );
      this.villageHouseDummy.scale.setScalar(houseData.scale);
      this.villageHouseDummy.updateMatrix();

      this.villageHouseLod.addInstance(this.villageHouseDummy.matrix, houseData.baseZ - totalDistance, {
        color: houseData.tint || this.villageHouseTints[0]
      });
    });

    this.villageHouseLod.endFrame();
  }

  updateHayBales(totalDistance, aheadDistance) {
    if (this.hayLod?.ready) {
      this.hayLod.beginFrame();

      this.hayDescriptors.forEach((hayData) => {
        if ((hayData.baseZ - totalDistance) < -70) {
          hayData.baseZ += aheadDistance;
        }
        const scenery = this.getSceneryProfile(hayData.baseZ);
        const farmDensity = this.getFarmDensity(scenery);
        const mountainThreshold = THREE.MathUtils.clamp(0.5 + (farmDensity - 1) * 0.2, 0.4, 0.72);
        if ((scenery?.mountainness || 0) > mountainThreshold) {
          return;
        }

        const curve = this.routeManager.getCurveInfo(hayData.baseZ);
        this.hayDummy.position.set(
          curve.lateral + hayData.baseX,
          this.getRelativeElevation(hayData.baseZ, hayData.baseY || 0.6),
          hayData.baseZ - totalDistance
        );
        this.hayDummy.rotation.set(Math.PI * 0.5, hayData.yaw + curve.heading, 0);
        this.hayDummy.scale.setScalar(hayData.scale || 1);
        this.hayDummy.updateMatrix();

        this.hayLod.addInstance(this.hayDummy.matrix, hayData.baseZ - totalDistance, {
          color: hayData.tint || this.hayTints[0]
        });
      });

      this.hayLod.endFrame();
      return;
    }

    this.hayBales.forEach((bale) => {
      if (bale.userData.baseZ === undefined) {
        bale.userData.baseZ = bale.position.z;
      }

      if ((bale.userData.baseZ - totalDistance) < -70) {
        bale.userData.baseZ += aheadDistance;
      }
      const scenery = this.getSceneryProfile(bale.userData.baseZ);
      const farmDensity = this.getFarmDensity(scenery);
      const mountainThreshold = THREE.MathUtils.clamp(0.5 + (farmDensity - 1) * 0.2, 0.4, 0.72);
      if ((scenery?.mountainness || 0) > mountainThreshold) {
        bale.visible = false;
        return;
      }
      bale.visible = true;

      const curve = this.routeManager.getCurveInfo(bale.userData.baseZ);
      bale.position.z = bale.userData.baseZ - totalDistance;
      bale.position.x = curve.lateral + bale.userData.baseX;
      bale.position.y = this.getRelativeElevation(bale.userData.baseZ, bale.userData.baseY);
      bale.rotation.y = bale.userData.baseYaw + curve.heading;
    });
  }

  updateBarns(totalDistance, aheadDistance) {
    if (this.barnLod?.ready) {
      this.barnLod.beginFrame();

      this.getAllBarnDescriptors().forEach((barnData) => {
        if ((barnData.baseZ - totalDistance) < -130) {
          this.recycleBarnDescriptor(barnData, totalDistance, aheadDistance);
        }
        const scenery = this.getSceneryProfile(barnData.baseZ);
        if (!this.isBarnDescriptorVisible(barnData, scenery)) {
          return;
        }

        const curve = this.routeManager.getCurveInfo(barnData.baseZ);
        this.barnDummy.position.set(
          curve.lateral + barnData.lateralOffset,
          this.getRelativeElevation(barnData.baseZ, barnData.baseY),
          barnData.baseZ - totalDistance
        );
        this.barnDummy.rotation.set(0, barnData.yaw + curve.heading * 0.3, 0);
        this.barnDummy.scale.setScalar(barnData.scale);
        this.barnDummy.updateMatrix();

        this.barnLod.addInstance(this.barnDummy.matrix, barnData.baseZ - totalDistance, {
          color: barnData.tint || this.barnBiomeTints.valley
        });
      });

      this.barnLod.endFrame();
      return;
    }

    this.proceduralBarns.forEach((barn) => {
      const barnData = barn.userData;
      if ((barnData.baseZ - totalDistance) < -130) {
        this.recycleBarnDescriptor(barnData, totalDistance, aheadDistance);
      }
      const scenery = this.getSceneryProfile(barnData.baseZ);
      if (!this.isBarnDescriptorVisible(barnData, scenery)) {
        barn.visible = false;
        return;
      }
      barn.visible = true;

      const curve = this.routeManager.getCurveInfo(barnData.baseZ);
      barn.position.set(
        curve.lateral + barnData.lateralOffset,
        this.getRelativeElevation(barnData.baseZ, barnData.baseY),
        barnData.baseZ - totalDistance
      );
      barn.rotation.y = barnData.yaw + curve.heading * 0.3;
      barn.scale.setScalar(barnData.scale);
    });
  }

  updatePowerLines(totalDistance, aheadDistance) {
    if (this.powerLineLod?.ready) {
      this.powerLineLod.beginFrame();

      this.powerLineDescriptors.forEach((poleData) => {
        if ((poleData.baseZ - totalDistance) < -90) {
          poleData.baseZ += aheadDistance;
        }
        const scenery = this.getSceneryProfile(poleData.baseZ);
        const farmDensity = this.getFarmDensity(scenery);
        const mountainThreshold = THREE.MathUtils.clamp(0.62 + (farmDensity - 1) * 0.1, 0.52, 0.76);
        if ((scenery?.mountainness || 0) > mountainThreshold) {
          return;
        }

        const curve = this.routeManager.getCurveInfo(poleData.baseZ);
        this.powerLineDummy.position.set(
          curve.lateral + poleData.baseX,
          this.getRelativeElevation(poleData.baseZ, poleData.baseY || 0),
          poleData.baseZ - totalDistance
        );
        this.powerLineDummy.rotation.set(0, (poleData.yaw || 0) + curve.heading, 0);
        this.powerLineDummy.scale.setScalar(poleData.scale || 1);
        this.powerLineDummy.updateMatrix();

        this.powerLineLod.addInstance(this.powerLineDummy.matrix, poleData.baseZ - totalDistance, {
          color: poleData.tint || this.powerLineTints[0]
        });
      });

      this.powerLineLod.endFrame();
      return;
    }

    this.powerLines.forEach((pole) => {
      if (pole.userData.baseZ === undefined) {
        pole.userData.baseZ = pole.position.z;
      }

      if ((pole.userData.baseZ - totalDistance) < -90) {
        pole.userData.baseZ += aheadDistance;
      }
      const scenery = this.getSceneryProfile(pole.userData.baseZ);
      const farmDensity = this.getFarmDensity(scenery);
      const mountainThreshold = THREE.MathUtils.clamp(0.62 + (farmDensity - 1) * 0.1, 0.52, 0.76);
      if ((scenery?.mountainness || 0) > mountainThreshold) {
        pole.visible = false;
        return;
      }
      pole.visible = true;

      const curve = this.routeManager.getCurveInfo(pole.userData.baseZ);
      pole.position.z = pole.userData.baseZ - totalDistance;
      pole.position.x = curve.lateral + pole.userData.baseX;
      pole.position.y = this.getRelativeElevation(pole.userData.baseZ, pole.userData.baseY);
      pole.rotation.y = (pole.userData.baseYaw || 0) + curve.heading;
    });
  }

  destroy() {
    this.fenceLod?.destroy();
    this.fenceLod = null;

    this.hayLod?.destroy();
    this.hayLod = null;

    this.powerLineLod?.destroy();
    this.powerLineLod = null;

    this.rockLod?.destroy();
    this.rockLod = null;

    this.farRockLod?.destroy();
    this.farRockLod = null;

    this.deadTreeLod?.destroy();
    this.deadTreeLod = null;

    this.accentLod?.destroy();
    this.accentLod = null;

    this.roadSignLod?.destroy();
    this.roadSignLod = null;

    this.barnLod?.destroy();
    this.barnLod = null;

    this.villageHouseLod?.destroy();
    this.villageHouseLod = null;

    this.fences.forEach(post => {
      this.scene.remove(post);
      post.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });

    this.proceduralRocks.forEach((rock) => {
      this.scene.remove(rock);
      rock.geometry?.dispose?.();
      if (Array.isArray(rock.material)) {
        rock.material.forEach((mat) => mat?.dispose?.());
      } else {
        rock.material?.dispose?.();
      }
    });

    this.hayBales.forEach((bale) => {
      this.scene.remove(bale);
      bale.geometry?.dispose?.();
      if (Array.isArray(bale.material)) {
        bale.material.forEach((mat) => mat?.dispose?.());
      } else {
        bale.material?.dispose?.();
      }
    });

    this.proceduralBarns.forEach((barn) => {
      this.scene.remove(barn);
      barn.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat?.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      });
    });

    this.powerLines.forEach((pole) => {
      this.scene.remove(pole);
      pole.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat?.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      });
    });

    this.roadSigns.forEach((sign) => {
      this.scene.remove(sign);
      sign.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat?.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      });
    });

    this.fences = [];
    this.fenceDescriptors = [];
    this.hayDescriptors = [];
    this.powerLineDescriptors = [];
    this.proceduralRocks = [];
    this.hayBales = [];
    this.proceduralBarns = [];
    this.powerLines = [];
    this.roadSigns = [];
    this.rockDescriptors = [];
    this.farRockDescriptors = [];
    this.deadTreeDescriptors = [];
    this.accentDescriptors = [];
    this.roadSignDescriptors = [];
    this.villageHouseDescriptors = [];
    this.barnDescriptors = [];
    this.summitVillageDescriptors = [];
  }
}
