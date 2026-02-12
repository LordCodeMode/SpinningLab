/**
 * Build the world-state object consumed by managers each frame.
 */

export function buildWorldState(world, speedMps, state) {
  return {
    totalDistance: world.totalDistance,
    currentAltitude: world.currentAltitude,
    currentGradient: world.currentGradient,
    sceneryProfile: world.currentSceneryProfile || null,
    roadOffset: world.roadOffset,
    roadHeading: world.roadHeading,
    time: world.time,
    speedMps,
    state,
    routeId: world.routeManager.getCurrentRoute()?.id || 'flat-loop',
    routeStyle: world.routeStyle || world.routeManager.getCurrentRouteStyle() || {},
    getElevationAt: (distanceMeters) => world.getElevationAt(distanceMeters),
    getSceneryProfile: (distanceMeters) => world.routeManager.getSceneryProfile(distanceMeters),
    getRoadCenterAt: (distanceMeters) => world.routeManager.getCurveInfo(distanceMeters).lateral,
    routeManager: world.routeManager
  };
}
