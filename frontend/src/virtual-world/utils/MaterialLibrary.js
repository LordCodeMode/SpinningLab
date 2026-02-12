/**
 * MaterialLibrary - Centralized material creation and caching
 */

import * as THREE from 'three';
import { COLORS, THEMES } from '../scene-config.js';

export class MaterialLibrary {
  constructor() {
    this.materials = new Map();
    this.themedMaterials = []; // Materials that change with theme
  }

  get(name) {
    return this.materials.get(name);
  }

  // Cyclist materials
  createCyclistMaterials() {
    const mats = {
      frame: new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.5,
        roughness: 0.5
      }),
      accent: new THREE.MeshStandardMaterial({
        color: 0xff6600,
        metalness: 0.3,
        roughness: 0.5
      }),
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
      tire: new THREE.MeshStandardMaterial({
        color: COLORS.tire,
        roughness: 0.9
      }),
      spoke: new THREE.MeshBasicMaterial({
        color: COLORS.spoke
      }),
      crank: new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.5
      })
    };

    Object.entries(mats).forEach(([key, mat]) => {
      this.materials.set(`cyclist.${key}`, mat);
    });

    return mats;
  }

  // Road materials
  createRoadMaterials(textures) {
    const mats = {
      asphalt: new THREE.MeshStandardMaterial({
        color: COLORS.asphalt,
        map: textures?.road || null,
        roughness: 0.85,
        metalness: 0,
        side: THREE.DoubleSide
      }),
      shoulder: new THREE.MeshStandardMaterial({
        color: COLORS.asphaltLight,
        roughness: 0.9
      }),
      centerLine: new THREE.MeshBasicMaterial({
        color: COLORS.roadLineYellow
      }),
      edgeLine: new THREE.MeshBasicMaterial({
        color: COLORS.roadLine
      })
    };

    Object.entries(mats).forEach(([key, mat]) => {
      this.materials.set(`road.${key}`, mat);
    });

    return mats;
  }

  // Vegetation materials
  createVegetationMaterials() {
    const mats = {
      trunk: new THREE.MeshStandardMaterial({
        color: COLORS.trunk,
        roughness: 0.9
      }),
      pine: new THREE.MeshStandardMaterial({
        color: COLORS.pine,
        roughness: 0.8,
        flatShading: true
      }),
      oak: new THREE.MeshStandardMaterial({
        color: COLORS.oak,
        roughness: 0.8,
        flatShading: true
      }),
      shrub: new THREE.MeshStandardMaterial({
        color: COLORS.grass,
        roughness: 0.85,
        flatShading: true
      }),
      stem: new THREE.MeshStandardMaterial({
        color: 0x3b7a3b,
        roughness: 0.9
      }),
      flowerPink: new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        roughness: 0.6
      }),
      flowerYellow: new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.6
      }),
      flowerOrange: new THREE.MeshStandardMaterial({
        color: 0xff6b4a,
        roughness: 0.6
      }),
      leaf: new THREE.MeshBasicMaterial({
        color: 0x4a7c4e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      })
    };

    Object.entries(mats).forEach(([key, mat]) => {
      this.materials.set(`vegetation.${key}`, mat);
    });

    return mats;
  }

  // Structure materials
  createStructureMaterials() {
    const mats = {
      fencePost: new THREE.MeshStandardMaterial({
        color: 0x8b6b4f,
        roughness: 0.9
      }),
      rock: new THREE.MeshStandardMaterial({
        color: COLORS.rock,
        roughness: 1
      }),
      boulder: new THREE.MeshStandardMaterial({
        color: COLORS.mountainDark,
        roughness: 1
      }),
      signPole: new THREE.MeshStandardMaterial({
        color: 0x4b5563,
        roughness: 0.7
      }),
      signYellow: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.6
      }),
      signGreen: new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        roughness: 0.6
      }),
      signRed: new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.6
      }),
      kmPost: new THREE.MeshStandardMaterial({ color: 0xffffff }),
      kmSign: new THREE.MeshStandardMaterial({ color: 0x2255aa }),
      cone: new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.6
      }),
      coneBand: new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        roughness: 0.4
      }),
      bannerPole: new THREE.MeshStandardMaterial({
        color: 0x2f2f2f,
        roughness: 0.7
      }),
      banner: new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        roughness: 0.6,
        metalness: 0.1,
        side: THREE.DoubleSide
      }),
      hayBale: new THREE.MeshStandardMaterial({
        color: 0xd4a84b,
        roughness: 0.95,
        metalness: 0
      }),
      barnWall: new THREE.MeshStandardMaterial({
        color: 0x8b2020,
        roughness: 0.92,
        metalness: 0
      }),
      powerPole: new THREE.MeshStandardMaterial({
        color: 0x5c4033,
        roughness: 0.9
      }),
      powerWire: new THREE.LineBasicMaterial({
        color: 0x333333
      })
    };

    Object.entries(mats).forEach(([key, mat]) => {
      this.materials.set(`structure.${key}`, mat);
    });

    return mats;
  }

  // Mountain materials
  createMountainMaterials() {
    const mats = {
      far: new THREE.MeshStandardMaterial({
        color: 0x7a8fa3,
        roughness: 0.95,
        metalness: 0,
        flatShading: true,
        fog: true
      }),
      mid: new THREE.MeshStandardMaterial({
        color: 0x5a6b7a,
        roughness: 0.9,
        flatShading: true,
        fog: true
      }),
      foothill: new THREE.MeshStandardMaterial({
        color: 0x2d4a30,
        roughness: 0.95,
        flatShading: true,
        fog: true
      }),
      snow: new THREE.MeshStandardMaterial({
        color: 0xf5f5ff,
        roughness: 0.4,
        emissive: 0x334455,
        emissiveIntensity: 0.05
      })
    };

    // Track for theme updates
    this.themedMaterials.push({ material: mats.far, key: 'mountain' });

    Object.entries(mats).forEach(([key, mat]) => {
      this.materials.set(`mountain.${key}`, mat);
    });

    return mats;
  }

  // Ground materials (themed)
  createGroundMaterials(textures, theme = 'classic') {
    const preset = THEMES[theme] || THEMES.classic;

    const mats = {
      base: new THREE.MeshStandardMaterial({
        color: preset.grass,
        map: textures?.grass || null,
        roughness: 0.92,
        metalness: 0
      }),
      light: new THREE.MeshStandardMaterial({
        color: preset.grassLight,
        map: textures?.grass || null,
        roughness: 1
      }),
      dark: new THREE.MeshStandardMaterial({
        color: preset.grassDark,
        map: textures?.grass || null,
        roughness: 1
      })
    };

    // Track for theme updates
    this.themedMaterials.push(
      { material: mats.base, key: 'grass', tone: 'base' },
      { material: mats.light, key: 'grassLight', tone: 'light' },
      { material: mats.dark, key: 'grassDark', tone: 'dark' }
    );

    Object.entries(mats).forEach(([key, mat]) => {
      this.materials.set(`ground.${key}`, mat);
    });

    return mats;
  }

  // Cloud material
  createCloudMaterial() {
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75
    });
    this.materials.set('cloud', mat);
    return mat;
  }

  // Apply theme to all themed materials
  applyTheme(themeId) {
    const preset = THEMES[themeId] || THEMES.classic;

    this.themedMaterials.forEach(({ material, key, tone }) => {
      if (!material) return;

      if (key === 'grass' || key === 'grassLight' || key === 'grassDark') {
        if (tone === 'light') {
          material.color.setHex(preset.grassLight);
        } else if (tone === 'dark') {
          material.color.setHex(preset.grassDark);
        } else {
          material.color.setHex(preset.grass);
        }
      } else if (key === 'mountain') {
        material.color.setHex(preset.mountain);
      }
    });
  }

  destroy() {
    this.materials.forEach(mat => mat.dispose());
    this.materials.clear();
    this.themedMaterials = [];
  }
}
