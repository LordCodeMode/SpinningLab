const FALLBACK_ROUTES = [
  { id: 'route-valley', name: 'Valley Circuit', distanceMeters: 15200, climbMeters: 210 },
  { id: 'route-crosswind', name: 'Crosswind Circuit', distanceMeters: 12400, climbMeters: 300 },
  { id: 'route-alpine', name: 'Alpine Circuit', distanceMeters: 22700, climbMeters: 770 }
];

const ROUTE_ALIASES = {
  'hilly-route': 'route-alpine',
  'alpine-pass': 'route-alpine',
  'crosswind-route': 'route-crosswind',
  'valley-route': 'route-valley',
  'flat-loop': 'route-valley'
};

const TWO_PI = Math.PI * 2;
const LOOP_CLOSURE_STEP_METERS = 2;
const LOOP_CLOSURE_MIN_GAP_METERS = 1.5;
const LOOP_CLOSURE_MAX_GAP_METERS = 120;
const LOOP_CLOSURE_MAX_RATIO = 0.12;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const finiteOr = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeRouteId = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return ROUTE_ALIASES[raw] || raw;
};

const normalizeDistance = (distanceMeters, totalDistanceMeters, closedLoop = true) => {
  const total = Math.max(1, finiteOr(totalDistanceMeters, 1));
  const raw = finiteOr(distanceMeters, 0);
  if (!closedLoop) return clamp(raw, 0, total);
  return ((raw % total) + total) % total;
};

const normalizePoint = (point, fallbackDistanceMeters = 0) => {
  if (!point || typeof point !== 'object') return null;
  const x = finiteOr(point.x, 0);
  const y = finiteOr(point.y, finiteOr(point.elevationMeters, 0));
  const z = finiteOr(point.z, 0);
  const elevationMeters = finiteOr(point.elevationMeters, y);
  const distanceMeters = finiteOr(point.distanceMeters, fallbackDistanceMeters);
  return { x, y, z, elevationMeters, distanceMeters };
};

const normalizeProfilePoints = (points, totalDistanceMeters = null) => {
  if (!Array.isArray(points) || points.length < 2) return null;

  const normalized = [];
  let runningDistance = 0;
  let prev = null;

  for (let i = 0; i < points.length; i += 1) {
    const point = normalizePoint(points[i], runningDistance);
    if (!point) continue;

    if (prev) {
      const hasDistance = Number.isFinite(Number(points[i]?.distanceMeters));
      if (!hasDistance) {
        const dx = point.x - prev.x;
        const dy = point.y - prev.y;
        const dz = point.z - prev.z;
        runningDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
        point.distanceMeters = runningDistance;
      } else {
        runningDistance = Math.max(runningDistance, point.distanceMeters);
      }
    } else {
      runningDistance = finiteOr(point.distanceMeters, 0);
      point.distanceMeters = runningDistance;
    }

    normalized.push(point);
    prev = point;
  }

  if (normalized.length < 2) return null;

  normalized.sort((a, b) => a.distanceMeters - b.distanceMeters);

  let maxDistance = finiteOr(totalDistanceMeters, normalized[normalized.length - 1].distanceMeters);
  if (maxDistance < 1 && normalized.length >= 2) {
    maxDistance = normalized[normalized.length - 1].distanceMeters;
  }

  if (maxDistance < 1) return null;

  const clampedPoints = normalized.map((point) => ({
    ...point,
    distanceMeters: clamp(point.distanceMeters, 0, maxDistance)
  }));

  const first = clampedPoints[0];
  const last = clampedPoints[clampedPoints.length - 1];
  const dx = first.x - last.x;
  const dy = first.y - last.y;
  const dz = first.z - last.z;
  const loopGapMeters = Math.sqrt((dx ** 2) + (dy ** 2) + (dz ** 2));
  const shouldCloseLoop = loopGapMeters >= LOOP_CLOSURE_MIN_GAP_METERS
    && loopGapMeters <= LOOP_CLOSURE_MAX_GAP_METERS
    && loopGapMeters <= (maxDistance * LOOP_CLOSURE_MAX_RATIO);

  if (!shouldCloseLoop) {
    return clampedPoints;
  }

  const closureSegments = Math.max(2, Math.ceil(loopGapMeters / LOOP_CLOSURE_STEP_METERS));
  const closedPoints = [...clampedPoints];

  for (let i = 1; i <= closureSegments; i += 1) {
    const t = i / closureSegments;
    closedPoints.push({
      x: last.x + (dx * t),
      y: last.y + (dy * t),
      z: last.z + (dz * t),
      elevationMeters: last.elevationMeters + ((first.elevationMeters - last.elevationMeters) * t),
      distanceMeters: maxDistance + (loopGapMeters * t)
    });
  }

  return closedPoints;
};

const normalizeRoute = (route, fallback = null) => {
  const fallbackRoute = fallback || {};
  const id = normalizeRouteId(route?.id || fallbackRoute.id);
  if (!id) return null;

  const profilePoints = normalizeProfilePoints(route?.points, route?.totalDistanceMeters);
  const totalDistanceMeters = profilePoints
    ? Math.max(1, finiteOr(route?.totalDistanceMeters, profilePoints[profilePoints.length - 1].distanceMeters))
    : Math.max(1, finiteOr(route?.distanceMeters, fallbackRoute.distanceMeters || 10000));

  let climbMeters = finiteOr(route?.climbMeters, fallbackRoute.climbMeters || 0);
  if (profilePoints) {
    let minElevation = Number.POSITIVE_INFINITY;
    let maxElevation = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < profilePoints.length; i += 1) {
      const elevation = finiteOr(profilePoints[i].elevationMeters, 0);
      minElevation = Math.min(minElevation, elevation);
      maxElevation = Math.max(maxElevation, elevation);
    }
    if (Number.isFinite(minElevation) && Number.isFinite(maxElevation)) {
      climbMeters = Math.max(0, maxElevation - minElevation);
    }
  }

  return {
    id,
    name: String(route?.name || fallbackRoute.name || id),
    distanceMeters: totalDistanceMeters,
    totalDistanceMeters,
    climbMeters,
    points: profilePoints
  };
};

const sampleProfileAtDistance = (route, distanceMeters = 0) => {
  const points = Array.isArray(route?.points) ? route.points : null;
  if (!points || points.length < 2) return null;

  const totalDistanceMeters = Math.max(1, finiteOr(route.totalDistanceMeters, points[points.length - 1].distanceMeters));
  const distance = normalizeDistance(distanceMeters, totalDistanceMeters, true);
  let segmentIndex = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    if (distance <= points[i + 1].distanceMeters) {
      segmentIndex = i;
      break;
    }
    segmentIndex = i;
  }

  const a = points[segmentIndex];
  const b = points[Math.min(segmentIndex + 1, points.length - 1)];
  const segmentStart = finiteOr(a.distanceMeters, 0);
  const segmentEnd = Math.max(segmentStart + 0.0001, finiteOr(b.distanceMeters, segmentStart + 0.0001));
  const t = clamp((distance - segmentStart) / (segmentEnd - segmentStart), 0, 1);

  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const z = a.z + (b.z - a.z) * t;
  const elevationMeters = a.elevationMeters + (b.elevationMeters - a.elevationMeters) * t;

  const forwardX = b.x - a.x;
  const forwardY = b.y - a.y;
  const forwardZ = b.z - a.z;
  const forwardLength = Math.sqrt(forwardX ** 2 + forwardY ** 2 + forwardZ ** 2) || 1;

  return {
    distanceMeters: distance,
    totalDistanceMeters,
    progress: distance / totalDistanceMeters,
    x,
    y,
    z,
    elevationMeters,
    tangent: {
      x: forwardX / forwardLength,
      y: forwardY / forwardLength,
      z: forwardZ / forwardLength
    }
  };
};

const resolveUrlAgainstBase = (urlValue, baseUrl) => {
  if (!urlValue) return '';
  try {
    return new URL(urlValue, baseUrl).toString();
  } catch {
    return String(urlValue || '').trim();
  }
};

export class RouteManager {
  constructor(routes = FALLBACK_ROUTES) {
    this.routes = (Array.isArray(routes) && routes.length ? routes : FALLBACK_ROUTES)
      .map((route, index) => normalizeRoute(route, FALLBACK_ROUTES[index] || FALLBACK_ROUTES[0]))
      .filter(Boolean);
    if (!this.routes.length) {
      this.routes = FALLBACK_ROUTES.map((route) => normalizeRoute(route)).filter(Boolean);
    }

    this.activeRouteId = this.routes[0]?.id || 'route-valley';
    this.routeProfileUrl = '';
  }

  getRoutes() {
    return this.routes.map((route) => ({
      id: route.id,
      name: route.name,
      distanceMeters: route.distanceMeters,
      climbMeters: route.climbMeters
    }));
  }

  applyRouteProfile(profile) {
    const profileRoutes = Array.isArray(profile?.routes) ? profile.routes : [];
    if (!profileRoutes.length) return 0;

    const normalized = profileRoutes
      .map((route) => normalizeRoute(route))
      .filter((route) => route && route.distanceMeters > 0);

    if (!normalized.length) return 0;

    this.routes = normalized;
    this.activeRouteId = this.resolveRouteId(this.activeRouteId);
    return normalized.length;
  }

  async loadProfileFromRuntimeManifest(manifestUrl = '/unity/current.json', fetchImpl = globalThis.fetch) {
    if (typeof fetchImpl !== 'function') {
      return { loaded: false, reason: 'fetch-unavailable' };
    }

    const manifestBase = resolveUrlAgainstBase(manifestUrl, globalThis?.location?.href || 'http://localhost/');
    const manifestResp = await fetchImpl(manifestBase, { cache: 'no-store' });
    if (!manifestResp.ok) {
      return { loaded: false, reason: `manifest-${manifestResp.status}` };
    }

    const manifest = await manifestResp.json();
    const routeProfileUrlRaw = String(manifest?.routeProfileUrl || '').trim();
    if (!routeProfileUrlRaw) {
      return { loaded: false, reason: 'manifest-missing-route-profile-url' };
    }

    const cacheToken = String(manifest?.cacheToken || manifest?.version || '').trim();
    const resolvedRouteProfileUrl = resolveUrlAgainstBase(routeProfileUrlRaw, manifestBase);
    const routeProfileUrl = cacheToken
      ? `${resolvedRouteProfileUrl}${resolvedRouteProfileUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheToken)}`
      : resolvedRouteProfileUrl;

    const routeResp = await fetchImpl(routeProfileUrl, { cache: 'no-store' });
    if (!routeResp.ok) {
      return { loaded: false, reason: `route-profile-${routeResp.status}` };
    }

    const routeProfile = await routeResp.json();
    const routeCount = this.applyRouteProfile(routeProfile);
    if (!routeCount) {
      return { loaded: false, reason: 'route-profile-empty' };
    }

    this.routeProfileUrl = resolvedRouteProfileUrl;
    return {
      loaded: true,
      routeCount,
      routeProfileUrl: resolvedRouteProfileUrl
    };
  }

  resolveRouteId(routeId) {
    const normalized = normalizeRouteId(routeId);
    if (!normalized) return this.activeRouteId;
    return this.routes.find((route) => route.id === normalized)?.id || this.activeRouteId;
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
    const sample = sampleProfileAtDistance(route, distanceMeters);

    if (sample) {
      return {
        distanceMeters: finiteOr(distanceMeters, 0),
        sampledDistanceMeters: sample.distanceMeters,
        progress: sample.progress,
        altitude: sample.elevationMeters,
        routeId: route.id,
        position: { x: sample.x, y: sample.y, z: sample.z },
        tangent: sample.tangent
      };
    }

    const total = Math.max(1, finiteOr(route.distanceMeters, 10000));
    const progress = normalizeDistance(distanceMeters, total, true) / total;
    const wave = Math.sin(progress * TWO_PI);
    const altitude = Math.max(0, 200 + wave * (finiteOr(route.climbMeters, 0) / 2));

    return {
      distanceMeters,
      sampledDistanceMeters: normalizeDistance(distanceMeters, total, true),
      progress,
      altitude,
      routeId: route.id,
      position: { x: 0, y: altitude, z: 0 },
      tangent: { x: 1, y: 0, z: 0 }
    };
  }

  getEffectiveGrade(distanceMeters = 0) {
    const route = this.getActiveRoute();
    const sample = sampleProfileAtDistance(route, distanceMeters);
    if (sample) {
      const sampleAhead = sampleProfileAtDistance(route, distanceMeters + 3);
      if (!sampleAhead) return 0;
      const dy = finiteOr(sampleAhead.elevationMeters, sample.y) - finiteOr(sample.elevationMeters, sample.y);
      return clamp(dy / 3, -0.18, 0.18);
    }

    const total = Math.max(1, finiteOr(route.distanceMeters, 10000));
    const progress = normalizeDistance(distanceMeters, total, true) / total;
    const baseAmplitude = clamp(finiteOr(route.climbMeters, 0) / total, 0.005, 0.08);
    return Math.sin(progress * TWO_PI) * baseAmplitude;
  }
}

export default RouteManager;
