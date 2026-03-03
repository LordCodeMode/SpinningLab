const BASE_ROUTES = [
  { id: 'hilly-route', name: 'Hilly Route', distanceMeters: 15000, climbMeters: 260 },
  { id: 'flat-loop', name: 'Flat Loop', distanceMeters: 10000, climbMeters: 35 },
  { id: 'alpine-pass', name: 'Alpine Pass', distanceMeters: 22000, climbMeters: 740 },
];

const TWO_PI = Math.PI * 2;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class RouteManager {
  constructor(routes = BASE_ROUTES) {
    this.routes = Array.isArray(routes) && routes.length ? routes : BASE_ROUTES;
    this.activeRouteId = this.routes[0].id;
  }

  getRoutes() {
    return this.routes;
  }

  resolveRouteId(routeId) {
    if (!routeId) return this.activeRouteId;
    return this.routes.find((route) => route.id === routeId)?.id || this.activeRouteId;
  }

  setRoute(routeId) {
    const resolved = this.resolveRouteId(routeId);
    const changed = resolved !== this.activeRouteId;
    this.activeRouteId = resolved;
    return changed;
  }

  getActiveRoute() {
    return this.routes.find((route) => route.id === this.activeRouteId) || this.routes[0];
  }

  getPositionInfo(distanceMeters = 0) {
    const route = this.getActiveRoute();
    const total = Math.max(1, Number(route.distanceMeters) || 10000);
    const progress = ((Number(distanceMeters) || 0) % total) / total;
    const wave = Math.sin(progress * TWO_PI);
    const altitude = Math.max(0, 200 + wave * ((Number(route.climbMeters) || 0) / 2));

    return {
      distanceMeters,
      progress,
      altitude,
      routeId: route.id,
    };
  }

  getEffectiveGrade(distanceMeters = 0) {
    const route = this.getActiveRoute();
    const total = Math.max(1, Number(route.distanceMeters) || 10000);
    const progress = ((Number(distanceMeters) || 0) % total) / total;
    const baseAmplitude = clamp((Number(route.climbMeters) || 0) / total, 0.005, 0.08);

    // Smooth pseudo-grade to keep trainer simulation stable.
    return Math.sin(progress * TWO_PI) * baseAmplitude;
  }
}

export default RouteManager;
