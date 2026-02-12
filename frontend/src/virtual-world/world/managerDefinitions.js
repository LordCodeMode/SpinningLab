/**
 * Central manager definitions for the virtual world lifecycle.
 */

import {
  SkyManager,
  CloudManager,
  LightingManager,
  HorizonManager,
  TerrainManager,
  RoadManager,
  VegetationManager,
  MountainManager,
  StructureManager,
  DecorationManager,
  WildlifeManager
} from '../environment/index.js';

import {
  ParticleManager,
  WindEffects,
  FlowerManager,
  SunEffects
} from '../effects/index.js';

import { CyclistManager } from '../cyclist/index.js';

export function createManagerDefinitions({ scene, textureFactory }) {
  return [
    {
      name: 'sky',
      manager: new SkyManager(scene)
    },
    {
      name: 'lighting',
      manager: new LightingManager(scene)
    },
    {
      name: 'horizon',
      manager: new HorizonManager(scene)
    },
    {
      name: 'clouds',
      manager: new CloudManager(scene)
    },
    {
      name: 'terrain',
      manager: new TerrainManager(scene, textureFactory),
      getCreateArgs: ({ getElevationAt, currentAltitude, routeManager }) => [
        getElevationAt,
        currentAltitude,
        (distanceMeters) => routeManager.getCurveInfo(distanceMeters).lateral,
        (distanceMeters) => routeManager.getSceneryProfile(distanceMeters)
      ]
    },
    {
      name: 'road',
      manager: new RoadManager(scene, textureFactory)
    },
    {
      name: 'vegetation',
      manager: new VegetationManager(scene),
      getCreateArgs: ({ getElevationAt, currentAltitude, routeManager }) => [
        getElevationAt,
        currentAltitude,
        (distanceMeters) => routeManager.getCurveInfo(distanceMeters).lateral,
        (distanceMeters) => routeManager.getSceneryProfile(distanceMeters)
      ]
    },
    {
      name: 'mountains',
      manager: new MountainManager(scene, textureFactory)
    },
    {
      name: 'structures',
      manager: new StructureManager(scene),
      getCreateArgs: ({ getElevationAt, currentAltitude, routeManager }) => [
        getElevationAt,
        currentAltitude,
        routeManager,
        (distanceMeters) => routeManager.getSceneryProfile(distanceMeters)
      ]
    },
    {
      name: 'decorations',
      manager: new DecorationManager(scene),
      getCreateArgs: ({ routeLength }) => [routeLength]
    },
    {
      name: 'wildlife',
      manager: new WildlifeManager(scene)
    },
    {
      name: 'particles',
      manager: new ParticleManager(scene)
    },
    {
      name: 'wind',
      manager: new WindEffects(scene)
    },
    {
      name: 'flowers',
      manager: new FlowerManager(scene)
    },
    {
      name: 'sunEffects',
      manager: new SunEffects(scene)
    },
    {
      name: 'cyclist',
      manager: new CyclistManager(scene),
      createMethod: 'init'
    }
  ];
}
