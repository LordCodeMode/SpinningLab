/**
 * VegetationManager - Trees, shrubs, and instanced grass
 */

import * as THREE from 'three';
import { ROAD_WIDTH, ROAD_SEGMENT_LENGTH, VISIBLE_SEGMENTS, ALT_SCALE, COLORS, TERRAIN_WIDTH } from '../scene-config.js';
import { InstancedGltfLod } from '../utils/index.js';

export class VegetationManager {
  constructor(scene) {
    this.scene = scene;
    this.trees = [];
    this.treeDescriptors = [];
    this.treeLods = new Map();
    this.shrubDescriptors = [];
    this.groundPlantDescriptors = [];
    this.shrubLods = new Map();
    this.groundPlantLods = new Map();
    this.shrubInstanced = null;
    this.grassInstanced = null;
    this.time = 0;
    this.getRoadCenterAt = null;
    this.getSceneryProfileAt = null;
    this.sceneryLevel = 'standard';
    this.detailLevel = 'high';
    this.foliageSeason = 'late_summer';
    this.currentSceneryZone = 'flat';
    this.routeStyle = {
      coniferWeight: 1,
      oakWeight: 1,
      cypressWeight: 1,
      treeSpreadScale: 1,
      shrubDensity: 1,
      groundPlantDensity: 1,
      farPropDensity: 1,
      foliageHueShift: 0,
      foliageSatMult: 1,
      foliageLumaMult: 1
    };
    this.treeAssetsReady = false;
    this.shrubAssetsReady = false;
    this.groundPlantAssetsReady = false;
    this.biomeTints = {
      lush: new THREE.Color(0x7fae66),
      temperate: new THREE.Color(0x739c5e),
      alpine: new THREE.Color(0x6d8e69),
      dry: new THREE.Color(0x98a36a)
    };
    this.foliagePalettePresets = {
      spring: {
        enabled: true,
        hueCenter: 0.31,
        hueRange: 0.085,
        satMin: 0.34,
        satMax: 0.82,
        lumaMin: 0.31,
        lumaMax: 0.9,
        seasonHueShift: 0.012,
        seasonSatMult: 1.1,
        seasonLumaMult: 1.12
      },
      summer: {
        enabled: true,
        hueCenter: 0.3,
        hueRange: 0.075,
        satMin: 0.32,
        satMax: 0.8,
        lumaMin: 0.3,
        lumaMax: 0.88,
        seasonHueShift: 0.006,
        seasonSatMult: 1.07,
        seasonLumaMult: 1.1
      },
      late_summer: {
        enabled: true,
        hueCenter: 0.288,
        hueRange: 0.068,
        satMin: 0.3,
        satMax: 0.78,
        lumaMin: 0.29,
        lumaMax: 0.86,
        seasonHueShift: 0,
        seasonSatMult: 1.04,
        seasonLumaMult: 1.08
      },
      autumn: {
        enabled: true,
        hueCenter: 0.22,
        hueRange: 0.1,
        satMin: 0.24,
        satMax: 0.72,
        lumaMin: 0.28,
        lumaMax: 0.82,
        seasonHueShift: -0.055,
        seasonSatMult: 0.95,
        seasonLumaMult: 1.04
      },
      alpine_cool: {
        enabled: true,
        hueCenter: 0.33,
        hueRange: 0.062,
        satMin: 0.22,
        satMax: 0.6,
        lumaMin: 0.3,
        lumaMax: 0.82,
        seasonHueShift: 0.014,
        seasonSatMult: 0.86,
        seasonLumaMult: 1.06
      }
    };
    this.foliagePalette = { ...this.foliagePalettePresets[this.foliageSeason] };
    this.treeSpecies = [
      {
        id: 'conifer',
        premiumLevels: [
          { id: 'high', path: '/models/environment/premium/trees/conifer_high.glb', maxDistance: 150 },
          { id: 'mid', path: '/models/environment/premium/trees/conifer_mid.glb', maxDistance: 310 },
          { id: 'low', path: '/models/environment/premium/trees/conifer_low.glb', maxDistance: 520 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/premium/trees/conifer_high.glb',
            atlasFrames: 2,
            width: 8.6,
            height: 14.2,
            textureSize: 512,
            alphaTest: 0.34,
            maxDistance: Infinity
          }
        ],
        levels: [
          { id: 'high', path: '/models/environment/quaternius/glTF/Pine_3.gltf', maxDistance: 150 },
          { id: 'mid', path: '/models/environment/quaternius/glTF/Pine_2.gltf', maxDistance: 310 },
          { id: 'low', path: '/models/environment/quaternius/glTF/Pine_5.gltf', maxDistance: 520 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/quaternius/glTF/Pine_3.gltf',
            atlasFrames: 2,
            width: 8.6,
            height: 14.2,
            textureSize: 512,
            alphaTest: 0.34,
            maxDistance: Infinity
          }
        ],
        fallbackLevels: [
          { id: 'high', path: '/models/environment/tree_conifer_high.glb', maxDistance: 150 },
          { id: 'mid', path: '/models/environment/tree_conifer_mid.glb', maxDistance: 310 },
          { id: 'low', path: '/models/environment/tree_conifer_low.glb', maxDistance: 520 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/tree_conifer_high.glb',
            atlasFrames: 2,
            width: 8.6,
            height: 14.2,
            textureSize: 512,
            alphaTest: 0.34,
            maxDistance: Infinity
          }
        ]
      },
      {
        id: 'oak',
        premiumLevels: [
          { id: 'high', path: '/models/environment/premium/trees/oak_high.glb', maxDistance: 150 },
          { id: 'mid', path: '/models/environment/premium/trees/oak_mid.glb', maxDistance: 310 },
          { id: 'low', path: '/models/environment/premium/trees/oak_low.glb', maxDistance: 520 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/premium/trees/oak_high.glb',
            atlasFrames: 2,
            width: 10.8,
            height: 12.6,
            textureSize: 512,
            alphaTest: 0.34,
            maxDistance: Infinity
          }
        ],
        levels: [
          { id: 'high', path: '/models/environment/quaternius/glTF/CommonTree_1.gltf', maxDistance: 150 },
          { id: 'mid', path: '/models/environment/quaternius/glTF/CommonTree_3.gltf', maxDistance: 310 },
          { id: 'low', path: '/models/environment/quaternius/glTF/CommonTree_5.gltf', maxDistance: 520 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/quaternius/glTF/CommonTree_1.gltf',
            atlasFrames: 2,
            width: 10.8,
            height: 12.6,
            textureSize: 512,
            alphaTest: 0.34,
            maxDistance: Infinity
          }
        ],
        fallbackLevels: [
          { id: 'high', path: '/models/environment/tree_oak_high.glb', maxDistance: 150 },
          { id: 'mid', path: '/models/environment/tree_oak_mid.glb', maxDistance: 310 },
          { id: 'low', path: '/models/environment/tree_oak_low.glb', maxDistance: 520 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/tree_oak_high.glb',
            atlasFrames: 2,
            width: 10.8,
            height: 12.6,
            textureSize: 512,
            alphaTest: 0.34,
            maxDistance: Infinity
          }
        ]
      },
      {
        id: 'cypress',
        premiumLevels: [
          { id: 'high', path: '/models/environment/premium/trees/cypress_high.glb', maxDistance: 150 },
          { id: 'mid', path: '/models/environment/premium/trees/cypress_mid.glb', maxDistance: 310 },
          { id: 'low', path: '/models/environment/premium/trees/cypress_low.glb', maxDistance: 520 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/premium/trees/cypress_high.glb',
            atlasFrames: 2,
            width: 5.8,
            height: 15,
            textureSize: 512,
            alphaTest: 0.34,
            maxDistance: Infinity
          }
        ],
        levels: [
          { id: 'high', path: '/models/environment/quaternius/glTF/Pine_4.gltf', maxDistance: 150 },
          { id: 'mid', path: '/models/environment/quaternius/glTF/Pine_1.gltf', maxDistance: 310 },
          { id: 'low', path: '/models/environment/quaternius/glTF/Pine_5.gltf', maxDistance: 520 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/quaternius/glTF/Pine_4.gltf',
            atlasFrames: 2,
            width: 5.8,
            height: 15,
            textureSize: 512,
            alphaTest: 0.34,
            maxDistance: Infinity
          }
        ],
        fallbackLevels: [
          { id: 'high', path: '/models/environment/tree_cypress_high.glb', maxDistance: 150 },
          { id: 'mid', path: '/models/environment/tree_cypress_mid.glb', maxDistance: 310 },
          { id: 'low', path: '/models/environment/tree_cypress_low.glb', maxDistance: 520 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/tree_cypress_high.glb',
            atlasFrames: 2,
            width: 5.8,
            height: 15,
            textureSize: 512,
            alphaTest: 0.34,
            maxDistance: Infinity
          }
        ]
      }
    ];

    this.treeDummy = new THREE.Object3D();
    this.shrubDummy = new THREE.Object3D();
    this.groundPlantDummy = new THREE.Object3D();
    this.instancedDummy = new THREE.Object3D();
  }

  async create(getElevationAt, currentAltitude, getRoadCenterAt = null, getSceneryProfileAt = null) {
    this.getElevationAt = getElevationAt;
    this.currentAltitude = currentAltitude;
    this.getRoadCenterAt = getRoadCenterAt;
    this.getSceneryProfileAt = getSceneryProfileAt;

    await this.createTreeAssets();
    await this.createPlantAssets();
    this.applyFoliagePaletteToAllLods();
    this.seedTreeDescriptors();

    if (!this.treeAssetsReady) {
      this.createProceduralTreesFallback();
    }

    this.createShrubs();
    this.createGrassPatches();
  }

  async createTreeAssets() {
    this.treeLods.clear();

    for (const species of this.treeSpecies) {
      const loaded = await this.loadVegetationLod({
        levels: species.premiumLevels || species.levels,
        fallbackLevels: species.levels,
        fallbackLevels2: species.fallbackLevels,
        capacity: 260,
        castShadow: true,
        receiveShadow: false,
        enableInstanceColor: false,
        paletteLock: this.foliagePalette
      }, `tree species "${species.id}"`);
      if (loaded) this.treeLods.set(species.id, loaded);
    }

    this.treeAssetsReady = this.treeLods.size > 0;
  }

  async loadVegetationLod(options, label = 'vegetation') {
    const candidates = [
      options.levels,
      options.fallbackLevels,
      options.fallbackLevels2
    ].filter((entry) => Array.isArray(entry) && entry.length > 0);

    const tryLoad = async (levels) => {
      if (!levels?.length) return null;
      const lod = new InstancedGltfLod(this.scene, {
        capacity: options.capacity || 256,
        levels,
        castShadow: options.castShadow ?? true,
        receiveShadow: options.receiveShadow ?? false,
        enableInstanceColor: options.enableInstanceColor ?? false,
        materialHook: options.materialHook || this.styleVegetationMaterial.bind(this),
        paletteLock: options.paletteLock || null,
        frustumCulled: false
      });
      await lod.load();
      return lod;
    };

    const errors = [];
    for (let i = 0; i < candidates.length; i++) {
      const levels = candidates[i];
      try {
        const loaded = await tryLoad(levels);
        if (i > 0) {
          console.warn(`Using fallback assets (tier ${i}) for ${label}`);
        }
        return loaded;
      } catch (error) {
        errors.push(error);
      }
    }

    console.warn(`Failed to load ${label} (all fallback tiers)`, errors);
    return null;
  }

  async createPlantAssets() {
    await this.createShrubAssets();
    await this.createGroundPlantAssets();
  }

  async createShrubAssets() {
    this.shrubLods.clear();
    const shrubSpecies = [
      {
        id: 'lush',
        premiumLevels: [
          { id: 'high', path: '/models/environment/premium/shrubs/lush_high.glb', maxDistance: 110 },
          { id: 'mid', path: '/models/environment/premium/shrubs/lush_mid.glb', maxDistance: 250 },
          { id: 'low', path: '/models/environment/premium/shrubs/lush_low.glb', maxDistance: 440 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/premium/shrubs/lush_high.glb',
            atlasFrames: 2,
            width: 3.4,
            height: 2.6,
            textureSize: 256,
            alphaTest: 0.3,
            maxDistance: Infinity
          }
        ],
        levels: [
          { id: 'high', path: '/models/environment/quaternius/glTF/Bush_Common_Flowers.gltf', maxDistance: 110 },
          { id: 'mid', path: '/models/environment/quaternius/glTF/Bush_Common.gltf', maxDistance: 250 },
          { id: 'low', path: '/models/environment/quaternius/glTF/Clover_2.gltf', maxDistance: 440 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/quaternius/glTF/Bush_Common_Flowers.gltf',
            atlasFrames: 2,
            width: 3.4,
            height: 2.6,
            textureSize: 256,
            alphaTest: 0.3,
            maxDistance: Infinity
          }
        ],
        fallbackLevels: [
          { id: 'high', path: '/models/environment/shrub_lush_high.glb', maxDistance: 110 },
          { id: 'mid', path: '/models/environment/shrub_lush_mid.glb', maxDistance: 250 },
          { id: 'low', path: '/models/environment/shrub_lush_low.glb', maxDistance: 440 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/shrub_lush_high.glb',
            atlasFrames: 2,
            width: 3.4,
            height: 2.6,
            textureSize: 256,
            alphaTest: 0.3,
            maxDistance: Infinity
          }
        ]
      },
      {
        id: 'dry',
        premiumLevels: [
          { id: 'high', path: '/models/environment/premium/shrubs/dry_high.glb', maxDistance: 110 },
          { id: 'mid', path: '/models/environment/premium/shrubs/dry_mid.glb', maxDistance: 250 },
          { id: 'low', path: '/models/environment/premium/shrubs/dry_low.glb', maxDistance: 440 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/premium/shrubs/dry_high.glb',
            atlasFrames: 2,
            width: 2.8,
            height: 2.2,
            textureSize: 256,
            alphaTest: 0.3,
            maxDistance: Infinity
          }
        ],
        levels: [
          { id: 'high', path: '/models/environment/quaternius/glTF/Bush_Common.gltf', maxDistance: 110 },
          { id: 'mid', path: '/models/environment/quaternius/glTF/Clover_1.gltf', maxDistance: 250 },
          { id: 'low', path: '/models/environment/quaternius/glTF/Clover_2.gltf', maxDistance: 440 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/quaternius/glTF/Bush_Common.gltf',
            atlasFrames: 2,
            width: 2.8,
            height: 2.2,
            textureSize: 256,
            alphaTest: 0.3,
            maxDistance: Infinity
          }
        ],
        fallbackLevels: [
          { id: 'high', path: '/models/environment/shrub_dry_high.glb', maxDistance: 110 },
          { id: 'mid', path: '/models/environment/shrub_dry_mid.glb', maxDistance: 250 },
          { id: 'low', path: '/models/environment/shrub_dry_low.glb', maxDistance: 440 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/shrub_dry_high.glb',
            atlasFrames: 2,
            width: 2.8,
            height: 2.2,
            textureSize: 256,
            alphaTest: 0.3,
            maxDistance: Infinity
          }
        ]
      }
    ];

    for (const species of shrubSpecies) {
      const loaded = await this.loadVegetationLod({
        levels: species.premiumLevels || species.levels,
        fallbackLevels: species.levels,
        fallbackLevels2: species.fallbackLevels,
        capacity: 360,
        castShadow: false,
        receiveShadow: false,
        enableInstanceColor: false,
        paletteLock: this.foliagePalette
      }, `shrub species "${species.id}"`);
      if (loaded) this.shrubLods.set(species.id, loaded);
    }

    this.shrubAssetsReady = this.shrubLods.size > 0;
  }

  async createGroundPlantAssets() {
    this.groundPlantLods.clear();
    const plantSpecies = [
      {
        id: 'fern',
        premiumLevels: [
          { id: 'high', path: '/models/environment/premium/plants/fern_high.glb', maxDistance: 80 },
          { id: 'mid', path: '/models/environment/premium/plants/fern_mid.glb', maxDistance: 180 },
          { id: 'low', path: '/models/environment/premium/plants/fern_low.glb', maxDistance: 320 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/premium/plants/fern_high.glb',
            atlasFrames: 2,
            width: 1.4,
            height: 1.2,
            textureSize: 256,
            alphaTest: 0.26,
            maxDistance: Infinity
          }
        ],
        levels: [
          { id: 'high', path: '/models/environment/quaternius/glTF/Fern_1.gltf', maxDistance: 80 },
          { id: 'mid', path: '/models/environment/quaternius/glTF/Plant_1_Big.gltf', maxDistance: 180 },
          { id: 'low', path: '/models/environment/quaternius/glTF/Plant_1.gltf', maxDistance: 320 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/quaternius/glTF/Fern_1.gltf',
            atlasFrames: 2,
            width: 1.4,
            height: 1.2,
            textureSize: 256,
            alphaTest: 0.26,
            maxDistance: Infinity
          }
        ],
        fallbackLevels: [
          { id: 'high', path: '/models/environment/plant_fern_high.glb', maxDistance: 80 },
          { id: 'mid', path: '/models/environment/plant_fern_mid.glb', maxDistance: 180 },
          { id: 'low', path: '/models/environment/plant_fern_low.glb', maxDistance: 320 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/plant_fern_high.glb',
            atlasFrames: 2,
            width: 1.4,
            height: 1.2,
            textureSize: 256,
            alphaTest: 0.26,
            maxDistance: Infinity
          }
        ]
      },
      {
        id: 'grass',
        premiumLevels: [
          { id: 'high', path: '/models/environment/premium/plants/grass_high.glb', maxDistance: 80 },
          { id: 'mid', path: '/models/environment/premium/plants/grass_mid.glb', maxDistance: 180 },
          { id: 'low', path: '/models/environment/premium/plants/grass_low.glb', maxDistance: 320 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/premium/plants/grass_high.glb',
            atlasFrames: 2,
            width: 1.2,
            height: 1,
            textureSize: 256,
            alphaTest: 0.26,
            maxDistance: Infinity
          }
        ],
        levels: [
          { id: 'high', path: '/models/environment/quaternius/glTF/Grass_Common_Tall.gltf', maxDistance: 80 },
          { id: 'mid', path: '/models/environment/quaternius/glTF/Grass_Wispy_Tall.gltf', maxDistance: 180 },
          { id: 'low', path: '/models/environment/quaternius/glTF/Grass_Common_Short.gltf', maxDistance: 320 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/quaternius/glTF/Grass_Common_Tall.gltf',
            atlasFrames: 2,
            width: 1.2,
            height: 1,
            textureSize: 256,
            alphaTest: 0.26,
            maxDistance: Infinity
          }
        ],
        fallbackLevels: [
          { id: 'high', path: '/models/environment/plant_grassclump_high.glb', maxDistance: 80 },
          { id: 'mid', path: '/models/environment/plant_grassclump_mid.glb', maxDistance: 180 },
          { id: 'low', path: '/models/environment/plant_grassclump_low.glb', maxDistance: 320 },
          {
            id: 'impostor',
            type: 'impostor',
            style: 'tree',
            sourcePath: '/models/environment/plant_grassclump_high.glb',
            atlasFrames: 2,
            width: 1.2,
            height: 1,
            textureSize: 256,
            alphaTest: 0.26,
            maxDistance: Infinity
          }
        ]
      }
    ];

    for (const species of plantSpecies) {
      const capacity = species.id === 'grass' ? 4200 : 2200;
      const loaded = await this.loadVegetationLod({
        levels: species.premiumLevels || species.levels,
        fallbackLevels: species.levels,
        fallbackLevels2: species.fallbackLevels,
        capacity,
        castShadow: false,
        receiveShadow: false,
        enableInstanceColor: false,
        paletteLock: this.foliagePalette
      }, `ground plant species "${species.id}"`);
      if (loaded) this.groundPlantLods.set(species.id, loaded);
    }

    this.groundPlantAssetsReady = this.groundPlantLods.size > 0;
  }

  applyFoliagePaletteToAllLods() {
    const lock = this.foliagePalette;
    this.treeLods.forEach((lod) => lod?.setPaletteLock?.(lock));
    this.shrubLods.forEach((lod) => lod?.setPaletteLock?.(lock));
    this.groundPlantLods.forEach((lod) => lod?.setPaletteLock?.(lock));
  }

  getSceneryProfile(distanceMeters = 0) {
    return this.getSceneryProfileAt ? this.getSceneryProfileAt(distanceMeters) : null;
  }

  getSceneryZone(distanceMeters = 0) {
    return this.getSceneryProfile(distanceMeters)?.zone || 'flat';
  }

  applySceneryZonePalette(zone = 'flat') {
    const base = this.foliagePalettePresets[this.foliageSeason] || this.foliagePalettePresets.late_summer;
    const modifiers = {
      flat: { hueShift: 0.008, satMult: 1.08, lumaMult: 1.09, satCeil: 1.02, lumaCeil: 1.04 },
      foothills: { hueShift: 0.004, satMult: 1.01, lumaMult: 1.03, satCeil: 1.0, lumaCeil: 1.02 },
      mountain: { hueShift: -0.006, satMult: 0.9, lumaMult: 0.96, satCeil: 0.95, lumaCeil: 0.97 },
      alpine: { hueShift: 0.012, satMult: 0.78, lumaMult: 0.92, satCeil: 0.88, lumaCeil: 0.93 }
    };
    const mod = modifiers[zone] || modifiers.flat;
    const routeHueShift = this.routeStyle?.foliageHueShift || 0;
    const routeSatMult = this.routeStyle?.foliageSatMult || 1;
    const routeLumaMult = this.routeStyle?.foliageLumaMult || 1;

    this.foliagePalette = {
      ...base,
      seasonHueShift: (base.seasonHueShift || 0) + mod.hueShift + routeHueShift,
      seasonSatMult: (base.seasonSatMult || 1) * mod.satMult * routeSatMult,
      seasonLumaMult: (base.seasonLumaMult || 1) * mod.lumaMult * routeLumaMult,
      satMax: THREE.MathUtils.clamp((base.satMax || 0.75) * mod.satCeil, 0.4, 0.95),
      lumaMax: THREE.MathUtils.clamp((base.lumaMax || 0.84) * mod.lumaCeil, 0.5, 0.92)
    };
    this.applyFoliagePaletteToAllLods();
  }

  setSeasonalPalette(season = 'late_summer') {
    const preset = this.foliagePalettePresets[season] || this.foliagePalettePresets.late_summer;
    this.foliageSeason = this.foliagePalettePresets[season] ? season : 'late_summer';
    this.foliagePalette = { ...preset };
    this.applySceneryZonePalette(this.currentSceneryZone || 'flat');
  }

  setRouteStyle(style = {}) {
    this.routeStyle = {
      ...this.routeStyle,
      ...(style || {})
    };

    this.applySceneryZonePalette(this.currentSceneryZone || 'flat');

    if (this.getElevationAt) {
      this.seedTreeDescriptors();
      this.seedShrubDescriptors();
      this.seedGroundPlantDescriptors();
    }
  }

  clampLateralOffset(offset, minAbs = ROAD_WIDTH / 2 + 3) {
    const maxAbs = Math.max(minAbs + 1, TERRAIN_WIDTH * 0.47);
    const sign = offset < 0 ? -1 : 1;
    const abs = THREE.MathUtils.clamp(Math.abs(offset), minAbs, maxAbs);
    return sign * abs;
  }

  styleVegetationMaterial(material) {
    if (!material || material.userData?.__foliageStyled) return;

    material.userData = material.userData || {};
    material.userData.__foliageStyled = true;

    if (material.color?.isColor) {
      const hsl = { h: 0, s: 0, l: 0 };
      material.color.getHSL(hsl);
      const hue = THREE.MathUtils.clamp(hsl.h, 0.18, 0.38);
      const sat = THREE.MathUtils.clamp(hsl.s * 1.08, 0.24, 0.86);
      const light = THREE.MathUtils.clamp(hsl.l * 1.1, 0.3, 0.86);
      material.color.setHSL(hue, sat, light);
    }

    if ('roughness' in material) {
      const source = typeof material.roughness === 'number' ? material.roughness : 0.8;
      material.roughness = THREE.MathUtils.clamp(source, 0.52, 0.9);
    }
    if ('metalness' in material) {
      material.metalness = Math.min(material.metalness ?? 0, 0.02);
    }
    if ('envMapIntensity' in material) {
      material.envMapIntensity = Math.max(material.envMapIntensity ?? 1, 1.18);
    }
    if ('aoMapIntensity' in material) {
      material.aoMapIntensity = Math.min(material.aoMapIntensity ?? 1, 0.58);
    }
    if ('emissive' in material && material.emissive?.isColor) {
      material.emissive.lerp(new THREE.Color(0x1a2d18), 0.28);
    }
    if ('emissiveIntensity' in material) {
      material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.03);
    }

    material.needsUpdate = true;
  }

  seedTreeDescriptors() {
    const nearClusterSpacing = 95;
    const farClusterSpacing = 155;
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    this.treeDescriptors = [];

    for (let z = 30; z < maxDistance; z += nearClusterSpacing) {
      const scenery = this.getSceneryProfile(z);
      const moisture = 0.5 + Math.sin(z * 0.008) * 0.24 + Math.cos(z * 0.005) * 0.12;
      const altitudeBias = this.getElevationAt ? this.getElevationAt(z).altitude : 120;
      const densityScale = scenery?.vegetationDensity ?? 1;
      const density = THREE.MathUtils.clamp(
        (0.55 + moisture * 0.35 - (altitudeBias > 360 ? 0.18 : 0)) * densityScale,
        0.22,
        0.9
      );

      [-1, 1].forEach((side) => {
        const clusterCount = 4 + Math.floor(Math.random() * 6);
        for (let i = 0; i < clusterCount; i++) {
          const descriptor = this.createTreeDescriptor({
            baseZ: z + Math.random() * nearClusterSpacing,
            side,
            density,
            moisture,
            altitude: altitudeBias,
            sceneryZone: scenery?.zone || 'flat',
            sceneryProfile: scenery,
            distanceBand: 'near'
          });
          if (descriptor) this.treeDescriptors.push(descriptor);
        }
      });
    }

    for (let z = 60; z < maxDistance; z += farClusterSpacing) {
      const scenery = this.getSceneryProfile(z);
      const moisture = 0.5 + Math.sin(z * 0.008) * 0.24 + Math.cos(z * 0.005) * 0.12;
      const altitudeBias = this.getElevationAt ? this.getElevationAt(z).altitude : 120;
      const densityScale = scenery?.vegetationDensity ?? 1;
      const farDensityScale = scenery?.farPropDensity || this.routeStyle?.farPropDensity || 1;
      const density = THREE.MathUtils.clamp(
        (0.28 + moisture * 0.18) * densityScale * farDensityScale,
        0.1,
        0.62
      );

      [-1, 1].forEach((side) => {
        const clusterCount = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < clusterCount; i++) {
          const descriptor = this.createTreeDescriptor({
            baseZ: z + Math.random() * farClusterSpacing,
            side,
            density,
            moisture,
            altitude: altitudeBias,
            sceneryZone: scenery?.zone || 'flat',
            sceneryProfile: scenery,
            distanceBand: 'far'
          });
          if (descriptor) this.treeDescriptors.push(descriptor);
        }
      });
    }
  }

  classifyBiome(distanceMeters, altitude, moisture, sceneryZone = 'flat') {
    if (sceneryZone === 'alpine') return 'alpine';
    if (sceneryZone === 'mountain') {
      if (altitude > 540 || moisture > 0.58) return 'alpine';
      if (moisture < 0.36) return 'dry';
      return 'temperate';
    }
    if (sceneryZone === 'foothills') {
      if (moisture < 0.32) return 'dry';
      if (moisture > 0.7) return 'lush';
      return 'temperate';
    }

    if (altitude > 620) return 'alpine';
    if (moisture < 0.35) return 'dry';
    if (moisture > 0.72 && altitude < 360) return 'lush';
    return 'temperate';
  }

  makeTreeTint(biome, moisture = 0.5) {
    const base = (this.biomeTints[biome] || this.biomeTints.temperate).clone();
    const satShift = THREE.MathUtils.clamp((moisture - 0.5) * 0.05, -0.015, 0.025);
    const lightShift = biome === 'alpine' ? -0.008 : biome === 'lush' ? 0.012 : 0.004;
    base.offsetHSL(0, satShift, lightShift + (Math.random() - 0.5) * 0.01);
    return base;
  }

  pickTreeSpecies(biome, moisture = 0.5, scenery = null) {
    let weights;
    if (biome === 'alpine') {
      weights = { conifer: 0.72, cypress: 0.2, oak: 0.08 };
    } else if (biome === 'lush') {
      weights = { conifer: 0.24, cypress: 0.16, oak: 0.6 };
    } else if (biome === 'dry') {
      weights = { conifer: 0.26, cypress: 0.58, oak: 0.16 };
    } else if (moisture > 0.62) {
      weights = { conifer: 0.34, cypress: 0.16, oak: 0.5 };
    } else {
      weights = { conifer: 0.52, cypress: 0.16, oak: 0.32 };
    }

    const coniferWeight = scenery?.coniferWeight || this.routeStyle?.coniferWeight || 1;
    const oakWeight = scenery?.oakWeight || this.routeStyle?.oakWeight || 1;
    const cypressWeight = scenery?.cypressWeight || this.routeStyle?.cypressWeight || 1;

    weights.conifer *= coniferWeight;
    weights.oak *= oakWeight;
    weights.cypress *= cypressWeight;

    const total = weights.conifer + weights.oak + weights.cypress;
    const r = Math.random() * total;
    if (r < weights.conifer) return 'conifer';
    if (r < weights.conifer + weights.oak) return 'oak';
    return 'cypress';
  }

  getSpeciesScaleRange(species = 'conifer') {
    if (species === 'oak') return { min: 0.9, max: 1.3 };
    if (species === 'cypress') return { min: 0.95, max: 1.4 };
    return { min: 0.82, max: 1.25 };
  }

  pickShrubSpecies(biome, moisture = 0.5) {
    if (biome === 'dry') return 'dry';
    if (biome === 'lush') return Math.random() < 0.8 ? 'lush' : 'dry';
    if (biome === 'alpine') return Math.random() < 0.35 ? 'lush' : 'dry';
    return moisture > 0.52 ? 'lush' : 'dry';
  }

  makeShrubTint(biome, moisture = 0.5) {
    const base = (this.biomeTints[biome] || this.biomeTints.temperate).clone();
    const satShift = THREE.MathUtils.clamp((moisture - 0.5) * 0.08, -0.03, 0.04);
    const lightShift = biome === 'dry' ? -0.02 : 0.006;
    base.offsetHSL(0.01, satShift, lightShift + (Math.random() - 0.5) * 0.016);
    return base;
  }

  pickGroundPlantSpecies(biome, moisture = 0.5) {
    if (biome === 'lush') return Math.random() < 0.58 ? 'fern' : 'grass';
    if (biome === 'dry') return 'grass';
    if (biome === 'alpine') return Math.random() < 0.24 ? 'fern' : 'grass';
    return moisture > 0.56 ? (Math.random() < 0.42 ? 'fern' : 'grass') : 'grass';
  }

  makeGroundPlantTint(biome, moisture = 0.5) {
    const base = (this.biomeTints[biome] || this.biomeTints.temperate).clone();
    const satShift = THREE.MathUtils.clamp((moisture - 0.5) * 0.07, -0.03, 0.035);
    const lightShift = biome === 'dry' ? -0.016 : 0.01;
    base.offsetHSL(0.008, satShift, lightShift + (Math.random() - 0.5) * 0.012);
    return base;
  }

  createTreeDescriptor({
    baseZ,
    side,
    density,
    moisture,
    altitude = 120,
    sceneryZone = 'flat',
    sceneryProfile = null,
    distanceBand = 'near'
  }) {
    if (Math.random() >= density) return null;

    const mountainness = sceneryProfile?.mountainness || 0;
    const isFarBand = distanceBand === 'far';
    const closeBand = isFarBand
      ? ROAD_WIDTH / 2 + THREE.MathUtils.lerp(56, 34, mountainness)
      : ROAD_WIDTH / 2 + (sceneryZone === 'mountain' || sceneryZone === 'alpine' ? 4.6 : 5.6);
    const spreadScale = sceneryProfile?.treeSpreadScale || this.routeStyle?.treeSpreadScale || 1;
    const farBand = isFarBand
      ? THREE.MathUtils.lerp(26, 120, Math.random()) * (0.84 + (1 - mountainness) * 0.46)
      : sceneryZone === 'alpine'
        ? (5 + Math.random() * 14)
        : sceneryZone === 'mountain'
          ? (7 + Math.random() * 18)
          : (10 + Math.random() * 22);
    const biome = this.classifyBiome(baseZ, altitude, moisture, sceneryZone);
    const biomeScaleBias = biome === 'alpine' ? -0.1 : biome === 'lush' ? 0.06 : biome === 'dry' ? -0.04 : 0;
    const ageFactor = THREE.MathUtils.clamp(0.65 + moisture * 0.55 + (Math.random() - 0.5) * 0.45, 0.45, 1.55);
    const species = this.pickTreeSpecies(biome, moisture, sceneryProfile);
    const speciesScale = this.getSpeciesScaleRange(species);
    const scale = THREE.MathUtils.clamp(
      speciesScale.min + ageFactor * (0.42 + biomeScaleBias),
      speciesScale.min,
      speciesScale.max
    );

    return {
      species,
      side,
      baseZ,
      lateralOffset: this.clampLateralOffset(
        side * (closeBand + farBand * spreadScale),
        isFarBand ? (ROAD_WIDTH / 2 + 9) : (ROAD_WIDTH / 2 + 4.6)
      ),
      baseY: isFarBand ? -0.1 : 0,
      yaw: Math.random() * Math.PI * 2,
      scale: isFarBand ? scale * 0.9 : scale,
      windPhase: Math.random() * Math.PI * 2,
      distanceBand,
      moisture,
      biome,
      tint: this.makeTreeTint(biome, moisture)
    };
  }

  createProceduralTreesFallback() {
    this.treeDescriptors.forEach((treeData) => {
      const tree = this.createTree(Math.random());
      const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(treeData.baseZ) : 0;
      tree.position.set(roadCenter + treeData.lateralOffset, 0, treeData.baseZ);
      tree.scale.setScalar(treeData.scale);
      tree.userData = {
        ...treeData
      };
      this.scene.add(tree);
      this.trees.push(tree);
    });
  }

  createTree(typeRandom) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 0.9 });

    if (typeRandom < 0.6) {
      // Pine tree
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 3, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      group.add(trunk);

      const foliageMat = new THREE.MeshStandardMaterial({
        color: COLORS.pine,
        roughness: 0.8,
        flatShading: true
      });

      const layers = [
        { y: 3.5, radius: 2.5, height: 3.5 },
        { y: 5.5, radius: 2, height: 3 },
        { y: 7, radius: 1.5, height: 2.5 },
        { y: 8.2, radius: 0.8, height: 2 }
      ];

      layers.forEach(layer => {
        const coneGeo = new THREE.ConeGeometry(layer.radius, layer.height, 8);
        const cone = new THREE.Mesh(coneGeo, foliageMat);
        cone.position.y = layer.y;
        cone.castShadow = true;
        group.add(cone);
      });
    } else {
      // Deciduous tree (oak-like)
      const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2;
      trunk.castShadow = true;
      group.add(trunk);

      const foliageGeo = new THREE.IcosahedronGeometry(3, 1);
      const foliageMat = new THREE.MeshStandardMaterial({
        color: COLORS.oak,
        roughness: 0.8,
        flatShading: true
      });
      const foliage = new THREE.Mesh(foliageGeo, foliageMat);
      foliage.position.y = 6;
      foliage.scale.set(1, 0.8, 1);
      foliage.castShadow = true;
      group.add(foliage);
    }

    group.rotation.y = Math.random() * Math.PI * 2;
    return group;
  }

  createShrubs() {
    if (this.shrubAssetsReady && this.shrubLods.size > 0) {
      this.seedShrubDescriptors();
      return;
    }

    const shrubGeo = new THREE.IcosahedronGeometry(0.68, 1);
    const shrubMat = new THREE.MeshStandardMaterial({
      color: 0x5a7f4a,
      roughness: 0.9,
      flatShading: true
    });

    const shrubCount = 400;
    this.shrubInstanced = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCount);
    this.shrubInstanced.castShadow = true;
    this.shrubInstanced.receiveShadow = true;

    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const dummy = new THREE.Object3D();
    const shrubBasePositions = [];
    const shrubLateralOffsets = [];
    const colors = new Float32Array(shrubCount * 3);

    for (let i = 0; i < shrubCount; i++) {
      const lateralOffset = (Math.random() > 0.5 ? 1 : -1) * (ROAD_WIDTH / 2 + 10 + Math.random() * 34);
      const z = Math.random() * maxDistance;
      const scale = 0.44 + Math.random() * 0.56;

      const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(z) : 0;
      dummy.position.set(roadCenter + lateralOffset, 0.25 * scale, z);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.16,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.16
      );
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.shrubInstanced.setMatrixAt(i, dummy.matrix);

      shrubBasePositions.push(z);
      shrubLateralOffsets.push(lateralOffset);

      const hue = 0.27 + (Math.random() - 0.5) * 0.05;
      const sat = 0.3 + Math.random() * 0.22;
      const light = 0.24 + Math.random() * 0.12;
      const color = new THREE.Color().setHSL(hue, sat, light);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    shrubGeo.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
    this.shrubInstanced.userData.basePositions = shrubBasePositions;
    this.shrubInstanced.userData.lateralOffsets = shrubLateralOffsets;
    this.scene.add(this.shrubInstanced);
  }

  seedShrubDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const nearClusterSpacing = 88;
    const farClusterSpacing = 170;
    this.shrubDescriptors = [];

    for (let z = 20; z < maxDistance; z += nearClusterSpacing) {
      const scenery = this.getSceneryProfile(z);
      const moisture = 0.5 + Math.sin(z * 0.008) * 0.24 + Math.cos(z * 0.005) * 0.12;
      const altitude = this.getElevationAt ? this.getElevationAt(z).altitude : 120;
      const biome = this.classifyBiome(z, altitude, moisture, scenery?.zone || 'flat');
      const density = THREE.MathUtils.clamp(
        (0.55 + moisture * 0.25 - (altitude > 500 ? 0.14 : 0))
          * (scenery?.vegetationDensity ?? 1)
          * (scenery?.shrubDensity || this.routeStyle?.shrubDensity || 1),
        0.2,
        0.82
      );

      [-1, 1].forEach((side) => {
        const count = 4 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
          if (Math.random() > density) continue;
          const species = this.pickShrubSpecies(biome, moisture);
          this.shrubDescriptors.push({
            species,
            side,
            baseZ: z + Math.random() * nearClusterSpacing,
            lateralOffset: this.clampLateralOffset(
              side * (ROAD_WIDTH / 2 + 8.5 + Math.random() * 30),
              ROAD_WIDTH / 2 + 4.6
            ),
            baseY: 0,
            yaw: Math.random() * Math.PI * 2,
            scale: species === 'lush'
              ? (0.72 + Math.random() * 0.58)
              : (0.62 + Math.random() * 0.48),
            moisture,
            biome,
            distanceBand: 'near',
            tint: this.makeShrubTint(biome, moisture)
          });
        }
      });
    }

    for (let z = 80; z < maxDistance; z += farClusterSpacing) {
      const scenery = this.getSceneryProfile(z);
      const moisture = 0.5 + Math.sin(z * 0.008) * 0.24 + Math.cos(z * 0.005) * 0.12;
      const altitude = this.getElevationAt ? this.getElevationAt(z).altitude : 120;
      const biome = this.classifyBiome(z, altitude, moisture, scenery?.zone || 'flat');
      const farDensityScale = scenery?.farPropDensity || this.routeStyle?.farPropDensity || 1;
      const density = THREE.MathUtils.clamp(
        (0.32 + moisture * 0.18) * (scenery?.vegetationDensity ?? 1) * farDensityScale,
        0.08,
        0.5
      );

      [-1, 1].forEach((side) => {
        const count = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
          if (Math.random() > density) continue;
          const species = this.pickShrubSpecies(biome, moisture);
          this.shrubDescriptors.push({
            species,
            side,
            baseZ: z + Math.random() * farClusterSpacing,
            lateralOffset: this.clampLateralOffset(
              side * (ROAD_WIDTH / 2 + 34 + Math.random() * 110),
              ROAD_WIDTH / 2 + 9
            ),
            baseY: -0.1,
            yaw: Math.random() * Math.PI * 2,
            scale: species === 'lush'
              ? (0.78 + Math.random() * 0.66)
              : (0.68 + Math.random() * 0.56),
            moisture,
            biome,
            distanceBand: 'far',
            tint: this.makeShrubTint(biome, moisture)
          });
        }
      });
    }
  }

  createGrassPatches() {
    if (this.groundPlantAssetsReady && this.groundPlantLods.size > 0) {
      this.seedGroundPlantDescriptors();
      return;
    }

    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const grassCount = 8000;

    // Create grass blade geometry
    const grassGeo = new THREE.PlaneGeometry(0.04, 0.25, 1, 3);
    const posAttr = grassGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const bendAmount = (y / 0.25) * (y / 0.25) * 0.03;
      posAttr.setZ(i, posAttr.getZ(i) + bendAmount);
    }
    grassGeo.computeVertexNormals();

    // Custom shader material for wind animation
    const grassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        windStrength: { value: 0.15 }
      },
      vertexShader: `
        uniform float time;
        uniform float windStrength;
        attribute vec3 instanceColor;
        attribute float phase;
        varying vec3 vColor;
        varying float vHeight;

        void main() {
          vColor = instanceColor;
          vHeight = position.y / 0.25;

          vec3 pos = position;

          // Wind sway - more at the top of the blade
          float wind = sin(time * 2.0 + phase + instanceMatrix[3][0] * 0.5) * windStrength;
          pos.x += wind * vHeight * vHeight;
          pos.z += wind * 0.5 * vHeight * vHeight;

          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vHeight;

        void main() {
          vec3 color = vColor * (0.6 + vHeight * 0.4);
          color.r += vHeight * 0.05;
          color.g += vHeight * 0.03;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide
    });

    this.grassInstanced = new THREE.InstancedMesh(grassGeo, grassMaterial, grassCount);
    this.grassInstanced.frustumCulled = false;

    const colors = new Float32Array(grassCount * 3);
    const phases = new Float32Array(grassCount);
    const dummy = new THREE.Object3D();
    const basePositions = [];
    const lateralOffsets = [];

    for (let i = 0; i < grassCount; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const distFromRoad = ROAD_WIDTH / 2 + 2 + Math.random() * 32;
      const lateralOffset = side * distFromRoad;
      const z = Math.random() * maxDistance;

      const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(z) : 0;
      dummy.position.set(roadCenter + lateralOffset, 0, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.setScalar(0.8 + Math.random() * 0.4);
      dummy.updateMatrix();
      this.grassInstanced.setMatrixAt(i, dummy.matrix);

      basePositions.push(z);
      lateralOffsets.push(lateralOffset);

      const hue = 0.28 + (Math.random() - 0.5) * 0.05;
      const sat = 0.32 + Math.random() * 0.24;
      const light = 0.24 + Math.random() * 0.14;
      const color = new THREE.Color().setHSL(hue, sat, light);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      phases[i] = Math.random() * Math.PI * 2;
    }

    grassGeo.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
    grassGeo.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1));

    this.grassInstanced.userData.basePositions = basePositions;
    this.grassInstanced.userData.lateralOffsets = lateralOffsets;
    this.scene.add(this.grassInstanced);
  }

  seedGroundPlantDescriptors() {
    const maxDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;
    const count = 3600;
    this.groundPlantDescriptors = [];

    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const baseZ = Math.random() * maxDistance;
      const scenery = this.getSceneryProfile(baseZ);
      const vegetationDensity = (scenery?.vegetationDensity ?? 1)
        * (scenery?.groundPlantDensity || this.routeStyle?.groundPlantDensity || 1);
      if (Math.random() > vegetationDensity) continue;
      const altitude = this.getElevationAt ? this.getElevationAt(baseZ).altitude : 120;
      const moisture = 0.5 + Math.sin(baseZ * 0.008) * 0.24 + Math.cos(baseZ * 0.005) * 0.12;
      const biome = this.classifyBiome(baseZ, altitude, moisture, scenery?.zone || 'flat');
      const species = this.pickGroundPlantSpecies(biome, moisture);

      this.groundPlantDescriptors.push({
        species,
        side,
        baseZ,
        lateralOffset: side * (ROAD_WIDTH / 2 + 2.2 + Math.random() * 32),
        baseY: 0,
        yaw: Math.random() * Math.PI * 2,
        scale: species === 'fern'
          ? (0.72 + Math.random() * 0.58)
          : (0.58 + Math.random() * 0.48),
        moisture,
        biome,
        windPhase: Math.random() * Math.PI * 2,
        tint: this.makeGroundPlantTint(biome, moisture)
      });
    }
  }

  setDetailLevel(level) {
    this.detailLevel = level;
    const showTrees = level !== 'low';
    const showPlants = level !== 'low';

    this.treeLods.forEach((lod) => lod.setVisible(showTrees));
    this.shrubLods.forEach((lod) => lod.setVisible(showPlants));
    this.groundPlantLods.forEach((lod) => lod.setVisible(showPlants));

    this.trees.forEach(tree => {
      tree.visible = showTrees;
    });

    if (this.shrubInstanced) {
      this.shrubInstanced.visible = showPlants;
    }
    if (this.grassInstanced) {
      this.grassInstanced.visible = showPlants;
    }
  }

  setSceneryLevel(level = 'standard') {
    this.sceneryLevel = level;
    const showTrees = level !== 'low';
    const showShrubs = level !== 'low';
    const showGrass = level !== 'low';

    this.treeLods.forEach((lod) => lod.setVisible(showTrees));
    this.shrubLods.forEach((lod) => lod.setVisible(showShrubs));
    this.groundPlantLods.forEach((lod) => lod.setVisible(showGrass));

    this.trees.forEach(tree => {
      tree.visible = showTrees;
    });

    if (this.shrubInstanced) {
      this.shrubInstanced.visible = showShrubs;
    }

    if (this.grassInstanced) {
      this.grassInstanced.visible = showGrass;
    }
  }

  getRelativeElevation(distanceMeters, baseOffset = 0) {
    const info = this.getElevationAt(distanceMeters);
    return (info.altitude - this.currentAltitude) * ALT_SCALE + baseOffset;
  }

  update(deltaTime, worldState) {
    this.time += deltaTime;
    const { totalDistance, currentAltitude, getElevationAt, getSceneryProfile, sceneryProfile } = worldState;
    this.currentAltitude = currentAltitude;
    this.getElevationAt = getElevationAt;
    this.getSceneryProfileAt = getSceneryProfile || this.getSceneryProfileAt;

    const activeZone = sceneryProfile?.zone || this.getSceneryZone(totalDistance) || 'flat';
    if (activeZone !== this.currentSceneryZone) {
      this.currentSceneryZone = activeZone;
      this.applySceneryZonePalette(activeZone);
    }

    const aheadDistance = VISIBLE_SEGMENTS * ROAD_SEGMENT_LENGTH;

    this.updateTrees(totalDistance, aheadDistance);
    this.updateShrubs(totalDistance, aheadDistance);
    this.updateGroundPlants(totalDistance, aheadDistance);

    // Update instanced shrubs
    if (this.shrubInstanced?.userData.basePositions) {
      const basePositions = this.shrubInstanced.userData.basePositions;
      const lateralOffsets = this.shrubInstanced.userData.lateralOffsets || [];

      for (let i = 0; i < basePositions.length; i++) {
        let relZ = basePositions[i] - totalDistance;

        if (relZ < -50) {
          basePositions[i] += aheadDistance;
          relZ = basePositions[i] - totalDistance;
        }

        const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(basePositions[i]) : 0;
        this.shrubInstanced.getMatrixAt(i, this.instancedDummy.matrix);
        this.instancedDummy.matrix.decompose(this.instancedDummy.position, this.instancedDummy.quaternion, this.instancedDummy.scale);
        this.instancedDummy.position.x = roadCenter + (lateralOffsets[i] || 0);
        this.instancedDummy.position.z = relZ;
        this.instancedDummy.updateMatrix();
        this.shrubInstanced.setMatrixAt(i, this.instancedDummy.matrix);
      }
      this.shrubInstanced.instanceMatrix.needsUpdate = true;
    }

    if (this.grassInstanced?.userData.basePositions) {
      const basePositions = this.grassInstanced.userData.basePositions;
      const lateralOffsets = this.grassInstanced.userData.lateralOffsets || [];

      for (let i = 0; i < basePositions.length; i++) {
        let relZ = basePositions[i] - totalDistance;
        if (relZ < -60) {
          basePositions[i] += aheadDistance;
          relZ = basePositions[i] - totalDistance;
        }
        const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(basePositions[i]) : 0;
        this.grassInstanced.getMatrixAt(i, this.instancedDummy.matrix);
        this.instancedDummy.matrix.decompose(this.instancedDummy.position, this.instancedDummy.quaternion, this.instancedDummy.scale);
        this.instancedDummy.position.x = roadCenter + (lateralOffsets[i] || 0);
        this.instancedDummy.position.z = relZ;
        this.instancedDummy.updateMatrix();
        this.grassInstanced.setMatrixAt(i, this.instancedDummy.matrix);
      }
      this.grassInstanced.instanceMatrix.needsUpdate = true;
    }

    // Update grass time uniform
    if (this.grassInstanced?.material?.uniforms) {
      this.grassInstanced.material.uniforms.time.value = this.time;
    }
  }

  updateShrubs(totalDistance, aheadDistance) {
    if (!this.shrubAssetsReady || this.shrubLods.size === 0) return;

    this.shrubLods.forEach((lod) => lod.beginFrame());
    const fallbackLod = this.shrubLods.values().next().value || null;

    this.shrubDescriptors.forEach((shrubData) => {
      const relativeZ = shrubData.baseZ - totalDistance;

      if (relativeZ < -80) {
        shrubData.baseZ += aheadDistance;
        const scenery = this.getSceneryProfile(shrubData.baseZ);
        const spreadScale = scenery?.treeSpreadScale || this.routeStyle?.treeSpreadScale || 1;
        if (shrubData.distanceBand === 'far') {
          const farSpread = THREE.MathUtils.lerp(120, 56, scenery?.mountainness || 0) * spreadScale;
          shrubData.lateralOffset = this.clampLateralOffset(
            shrubData.side * (ROAD_WIDTH / 2 + 34 + Math.random() * farSpread),
            ROAD_WIDTH / 2 + 9
          );
          shrubData.baseY = -0.1;
        } else {
          const spread = THREE.MathUtils.lerp(30, 16, scenery?.mountainness || 0) * spreadScale;
          shrubData.lateralOffset = this.clampLateralOffset(
            shrubData.side * (ROAD_WIDTH / 2 + 7.2 + Math.random() * spread),
            ROAD_WIDTH / 2 + 4.6
          );
          shrubData.baseY = 0;
        }
        shrubData.yaw = Math.random() * Math.PI * 2;
        const altitude = this.getElevationAt ? this.getElevationAt(shrubData.baseZ).altitude : 120;
        shrubData.moisture = 0.5 + Math.sin(shrubData.baseZ * 0.008) * 0.24 + Math.cos(shrubData.baseZ * 0.005) * 0.12;
        shrubData.biome = this.classifyBiome(shrubData.baseZ, altitude, shrubData.moisture, scenery?.zone || 'flat');
        shrubData.species = this.pickShrubSpecies(shrubData.biome, shrubData.moisture);
        shrubData.scale = shrubData.species === 'lush'
          ? (0.72 + Math.random() * 0.58)
          : (0.62 + Math.random() * 0.48);
        shrubData.tint = this.makeShrubTint(shrubData.biome, shrubData.moisture);
      }

      const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(shrubData.baseZ) : 0;
      this.shrubDummy.position.set(
        roadCenter + shrubData.lateralOffset,
        this.getRelativeElevation(shrubData.baseZ, shrubData.baseY || 0),
        shrubData.baseZ - totalDistance
      );
      this.shrubDummy.rotation.set(0, shrubData.yaw, 0);
      this.shrubDummy.scale.setScalar(shrubData.scale);
      this.shrubDummy.updateMatrix();

      const lod = this.shrubLods.get(shrubData.species) || fallbackLod;
      if (!lod) return;
      lod.addInstance(this.shrubDummy.matrix, shrubData.baseZ - totalDistance);
    });

    this.shrubLods.forEach((lod) => lod.endFrame());
  }

  updateGroundPlants(totalDistance, aheadDistance) {
    if (!this.groundPlantAssetsReady || this.groundPlantLods.size === 0) return;

    this.groundPlantLods.forEach((lod) => lod.beginFrame());
    const fallbackLod = this.groundPlantLods.values().next().value || null;

    this.groundPlantDescriptors.forEach((plantData) => {
      const relativeZ = plantData.baseZ - totalDistance;

      if (relativeZ < -80) {
        plantData.baseZ += aheadDistance;
        const scenery = this.getSceneryProfile(plantData.baseZ);
        const spreadScale = scenery?.treeSpreadScale || this.routeStyle?.treeSpreadScale || 1;
        const spread = THREE.MathUtils.lerp(32, 17, scenery?.mountainness || 0) * spreadScale;
        plantData.lateralOffset = plantData.side * (ROAD_WIDTH / 2 + 2 + Math.random() * spread);
        plantData.yaw = Math.random() * Math.PI * 2;
        plantData.windPhase = Math.random() * Math.PI * 2;
        const altitude = this.getElevationAt ? this.getElevationAt(plantData.baseZ).altitude : 120;
        plantData.moisture = 0.5 + Math.sin(plantData.baseZ * 0.008) * 0.24 + Math.cos(plantData.baseZ * 0.005) * 0.12;
        plantData.biome = this.classifyBiome(plantData.baseZ, altitude, plantData.moisture, scenery?.zone || 'flat');
        plantData.species = this.pickGroundPlantSpecies(plantData.biome, plantData.moisture);
        plantData.scale = plantData.species === 'fern'
          ? (0.72 + Math.random() * 0.58)
          : (0.58 + Math.random() * 0.48);
        plantData.tint = this.makeGroundPlantTint(plantData.biome, plantData.moisture);
      }

      const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(plantData.baseZ) : 0;
      const sway = Math.sin(this.time * 0.9 + plantData.windPhase) * 0.09;
      this.groundPlantDummy.position.set(
        roadCenter + plantData.lateralOffset,
        this.getRelativeElevation(plantData.baseZ, plantData.baseY || 0),
        plantData.baseZ - totalDistance
      );
      this.groundPlantDummy.rotation.set(0, plantData.yaw + sway * 0.18, sway * 0.04);
      this.groundPlantDummy.scale.setScalar(plantData.scale);
      this.groundPlantDummy.updateMatrix();

      const lod = this.groundPlantLods.get(plantData.species) || fallbackLod;
      if (!lod) return;
      lod.addInstance(this.groundPlantDummy.matrix, plantData.baseZ - totalDistance);
    });

    this.groundPlantLods.forEach((lod) => lod.endFrame());
  }

  updateTrees(totalDistance, aheadDistance) {
    if (this.treeAssetsReady && this.treeLods.size > 0) {
      this.treeLods.forEach((lod) => lod.beginFrame());
      const fallbackLod = this.treeLods.values().next().value || null;

      this.treeDescriptors.forEach((treeData) => {
        const relativeZ = treeData.baseZ - totalDistance;

        if (relativeZ < -100) {
          treeData.baseZ += aheadDistance;
          const scenery = this.getSceneryProfile(treeData.baseZ);
          const spreadScale = scenery?.treeSpreadScale || this.routeStyle?.treeSpreadScale || 1;
          if (treeData.distanceBand === 'far') {
            const farSpread = scenery?.zone === 'alpine'
              ? (44 + Math.random() * 86)
              : scenery?.zone === 'mountain'
                ? (38 + Math.random() * 96)
                : (52 + Math.random() * 118);
            treeData.lateralOffset = this.clampLateralOffset(
              treeData.side * (ROAD_WIDTH / 2 + 34 + farSpread * spreadScale),
              ROAD_WIDTH / 2 + 9
            );
            treeData.baseY = -0.1;
          } else {
            const spread = scenery?.zone === 'alpine'
              ? (5 + Math.random() * 14)
              : scenery?.zone === 'mountain'
                ? (7 + Math.random() * 18)
                : (10 + Math.random() * 22);
            treeData.lateralOffset = this.clampLateralOffset(
              treeData.side * (ROAD_WIDTH / 2 + 5 + spread * spreadScale),
              ROAD_WIDTH / 2 + 4.6
            );
            treeData.baseY = 0;
          }
          treeData.yaw = Math.random() * Math.PI * 2;
          treeData.moisture = 0.5 + Math.sin(treeData.baseZ * 0.008) * 0.24 + Math.cos(treeData.baseZ * 0.005) * 0.12;
          const altitude = this.getElevationAt ? this.getElevationAt(treeData.baseZ).altitude : 120;
          treeData.biome = this.classifyBiome(treeData.baseZ, altitude, treeData.moisture, scenery?.zone || 'flat');
          treeData.species = this.pickTreeSpecies(treeData.biome, treeData.moisture, scenery);
          const speciesScale = this.getSpeciesScaleRange(treeData.species);
          treeData.scale = THREE.MathUtils.clamp(
            speciesScale.min + Math.random() * (speciesScale.max - speciesScale.min),
            speciesScale.min,
            speciesScale.max
          );
          if (treeData.distanceBand === 'far') {
            treeData.scale *= 0.86;
          }
          treeData.tint = this.makeTreeTint(treeData.biome, treeData.moisture);
        }

        const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(treeData.baseZ) : 0;
        const swayX = Math.sin(this.time * 0.8 + treeData.windPhase) * 0.02;
        const swayZ = Math.cos(this.time * 0.6 + treeData.windPhase) * 0.012;

        this.treeDummy.position.set(
          roadCenter + treeData.lateralOffset,
          this.getRelativeElevation(treeData.baseZ, treeData.baseY || 0),
          treeData.baseZ - totalDistance
        );
        this.treeDummy.rotation.set(swayX, treeData.yaw, swayZ);
        this.treeDummy.scale.setScalar(treeData.scale);
        this.treeDummy.updateMatrix();

        const speciesLod = this.treeLods.get(treeData.species) || fallbackLod;
        if (!speciesLod) return;
        speciesLod.addInstance(this.treeDummy.matrix, treeData.baseZ - totalDistance);
      });

      this.treeLods.forEach((lod) => lod.endFrame());
      return;
    }

    // Procedural fallback tree updates
    this.trees.forEach(tree => {
      if (tree.userData.baseZ === undefined) {
        tree.userData.baseZ = tree.position.z;
        tree.userData.baseY = tree.position.y || 0;
        if (tree.userData.lateralOffset === undefined) {
          const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(tree.userData.baseZ) : 0;
          tree.userData.lateralOffset = tree.position.x - roadCenter;
        }
      }

      const relativeZ = tree.userData.baseZ - totalDistance;

      if (relativeZ < -100) {
        tree.userData.baseZ += aheadDistance;
        const spreadScale = this.routeStyle?.treeSpreadScale || 1;
        tree.userData.lateralOffset =
          (Math.random() > 0.5 ? 1 : -1) * (ROAD_WIDTH / 2 + 5.6 + 14 + Math.random() * 18 * spreadScale);
        tree.scale.setScalar(0.7 + Math.random() * 0.5);
      }

      const roadCenter = this.getRoadCenterAt ? this.getRoadCenterAt(tree.userData.baseZ) : 0;
      tree.position.x = roadCenter + tree.userData.lateralOffset;
      tree.position.z = tree.userData.baseZ - totalDistance;
      tree.position.y = this.getRelativeElevation(tree.userData.baseZ, tree.userData.baseY || 0);

      // Wind sway
      const sway = Math.sin(this.time * 0.8 + tree.userData.windPhase) * 0.015;
      tree.rotation.x = sway;
      tree.rotation.z = Math.cos(this.time * 0.6 + tree.userData.windPhase) * 0.01;
    });
  }

  destroy() {
    this.treeLods.forEach((lod) => lod?.destroy?.());
    this.treeLods.clear();
    this.shrubLods.forEach((lod) => lod?.destroy?.());
    this.shrubLods.clear();
    this.groundPlantLods.forEach((lod) => lod?.destroy?.());
    this.groundPlantLods.clear();

    this.trees.forEach(tree => {
      this.scene.remove(tree);
      tree.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    this.trees = [];
    this.treeDescriptors = [];
    this.shrubDescriptors = [];
    this.groundPlantDescriptors = [];

    if (this.shrubInstanced) {
      this.scene.remove(this.shrubInstanced);
      this.shrubInstanced.geometry.dispose();
      this.shrubInstanced.material.dispose();
    }

    if (this.grassInstanced) {
      this.scene.remove(this.grassInstanced);
      this.grassInstanced.geometry.dispose();
      this.grassInstanced.material.dispose();
      this.grassInstanced = null;
    }

    this.shrubInstanced = null;
  }
}
