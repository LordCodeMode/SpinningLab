/**
 * Route System
 *
 * Manages routes with elevation profiles for virtual riding.
 * Routes can be used in SIM mode to send gradients to the trainer.
 */

import { REALISTIC_GRADIENT_LIMIT } from './scene-config.js';

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function gaussian(distance, center, spread) {
  const dx = distance - center;
  return Math.exp(-(dx * dx) / (2 * spread * spread));
}

function computeTotalElevationGain(points = []) {
  let gain = 0;
  for (let i = 1; i < points.length; i += 1) {
    const rise = points[i].altitude - points[i - 1].altitude;
    if (rise > 0) gain += rise;
  }
  return Math.round(gain);
}

function createRoute({
  id,
  name,
  description,
  totalDistance,
  difficulty,
  color,
  points,
  style
}) {
  return {
    id,
    name,
    description,
    totalDistance,
    totalElevation: computeTotalElevationGain(points),
    difficulty,
    color,
    style: style || {},
    points
  };
}

function generateFlatLoop(totalDistance) {
  const points = [];
  const numPoints = 240;
  const baseAltitude = 74;

  for (let i = 0; i <= numPoints; i += 1) {
    const distance = (i / numPoints) * totalDistance;
    const progress = distance / totalDistance;

    const undulationA = Math.sin((distance / 5600) * Math.PI * 2) * 2.3;
    const undulationB = Math.sin((distance / 2100) * Math.PI * 2 + 0.6) * 1.05;
    const undulationC = Math.cos((distance / 9800) * Math.PI * 2 - 0.4) * 1.45;

    const overpassRise = smoothstep(0.15, 0.27, progress) - smoothstep(0.35, 0.48, progress);
    const floodbankRise = smoothstep(0.63, 0.75, progress) - smoothstep(0.82, 0.93, progress);

    const altitude =
      baseAltitude +
      undulationA +
      undulationB +
      undulationC +
      overpassRise * 4.4 +
      floodbankRise * 3.2;

    points.push({ distance, altitude: Math.max(20, altitude) });
  }

  return points;
}

function generateHillyRoute(totalDistance) {
  const points = [];
  const numPoints = 320;
  const baseAltitude = 118;

  for (let i = 0; i <= numPoints; i += 1) {
    const distance = (i / numPoints) * totalDistance;
    const progress = distance / totalDistance;

    const rollingBase =
      Math.sin((distance / 3100) * Math.PI * 2 + 0.35) * 18 +
      Math.sin((distance / 1850) * Math.PI * 2 - 0.9) * 8.4;

    const climbA = gaussian(distance, totalDistance * 0.28, totalDistance * 0.12) * 110;
    const climbB = gaussian(distance, totalDistance * 0.56, totalDistance * 0.14) * 190;
    const climbC = gaussian(distance, totalDistance * 0.86, totalDistance * 0.09) * 90;
    const valleyCut = gaussian(distance, totalDistance * 0.72, totalDistance * 0.11) * 100;

    const summitShelf = (smoothstep(0.5, 0.63, progress) - smoothstep(0.66, 0.8, progress)) * 36;

    const altitude = baseAltitude + rollingBase + climbA + climbB + climbC + summitShelf - valleyCut;
    points.push({ distance, altitude: Math.max(35, altitude) });
  }

  return points;
}

const ROUTES = {
  'flat-loop': createRoute({
    id: 'flat-loop',
    name: 'Flat Loop',
    description: 'Fast valley loop with realistic subtle rollers',
    totalDistance: 12000,
    difficulty: 'easy',
    color: '#38bdf8',
    style: {
      theme: 'coastal',
      sceneryLevel: 'standard',
      foliageSeason: 'summer',
      visualTuning: {
        exposure: 1.25,
        lighting: 1.28,
        saturation: 1.03,
        haze: 0.76
      },
      mountainnessBias: -0.12,
      alpineBias: -0.12,
      vegetationDensityScale: 1.18,
      corridorWidthScale: 1.15,
      rockDensity: 0.58,
      farmPropDensity: 1.42,
      coniferWeight: 0.7,
      oakWeight: 1.38,
      cypressWeight: 1.1,
      treeSpreadScale: 1.12,
      shrubDensity: 1.2,
      groundPlantDensity: 1.2,
      farPropDensity: 1.24,
      foliageHueShift: 0.008,
      foliageSatMult: 1.08,
      foliageLumaMult: 1.06,
      roadLift: 0.01,
      roadClearanceLift: 0.08,
      mountainNearHills: 0.36,
      mountainDetailBoost: 0.2,
      mountainBackdropDensity: 0.96,
      snowLineBias: 10,
      mountainParallax: 0.7
    },
    points: generateFlatLoop(12000)
  }),
  'hilly-route': createRoute({
    id: 'hilly-route',
    name: 'Hilly Route',
    description: 'Progressive climbs, realistic descents, and alpine transitions',
    totalDistance: 17600,
    difficulty: 'medium',
    color: '#f59e0b',
    style: {
      theme: 'alpine',
      sceneryLevel: 'high',
      foliageSeason: 'alpine_cool',
      visualTuning: {
        exposure: 1.24,
        lighting: 1.3,
        saturation: 1,
        haze: 0.82
      },
      mountainnessBias: 0.14,
      alpineBias: 0.16,
      vegetationDensityScale: 0.92,
      corridorWidthScale: 0.86,
      rockDensity: 1.34,
      farmPropDensity: 0.62,
      coniferWeight: 1.52,
      oakWeight: 0.7,
      cypressWeight: 0.94,
      treeSpreadScale: 0.9,
      shrubDensity: 0.9,
      groundPlantDensity: 0.82,
      farPropDensity: 1.46,
      foliageHueShift: -0.008,
      foliageSatMult: 0.9,
      foliageLumaMult: 0.95,
      roadLift: 0.07,
      roadClearanceLift: 0.65,
      mountainNearHills: 1,
      mountainDetailBoost: 0.5,
      mountainBackdropDensity: 1.34,
      snowLineBias: -34,
      mountainParallax: 1.25
    },
    points: generateHillyRoute(17600)
  })
};

const ROUTE_ALIASES = {
  'rolling-hills': 'hilly-route',
  'interval-hills': 'hilly-route',
  'mountain-climb': 'hilly-route',
  'alpine-challenge': 'hilly-route'
};

export class RouteManager {
  constructor() {
    this.routes = ROUTES;
    this.currentRoute = ROUTES['flat-loop'];
    this.distanceOffset = 0;
    this.routeSceneryStats = this.computeRouteSceneryStats(this.currentRoute);
    this.routeEvents = this.buildRouteEvents(this.currentRoute);
    this.lastEventScanDistance = null;
    this.firedEventKeys = new Set();
  }

  getRoutes() {
    return Object.values(this.routes);
  }

  resolveRouteId(routeId) {
    if (this.routes[routeId]) return routeId;
    if (ROUTE_ALIASES[routeId] && this.routes[ROUTE_ALIASES[routeId]]) {
      return ROUTE_ALIASES[routeId];
    }
    return null;
  }

  setRoute(routeId) {
    const resolvedRouteId = this.resolveRouteId(routeId);
    if (resolvedRouteId) {
      this.currentRoute = this.routes[resolvedRouteId];
      this.distanceOffset = 0;
      this.routeSceneryStats = this.computeRouteSceneryStats(this.currentRoute);
      this.routeEvents = this.buildRouteEvents(this.currentRoute);
      this.lastEventScanDistance = null;
      this.firedEventKeys.clear();
      return true;
    }
    return false;
  }

  getCurrentRoute() {
    return this.currentRoute;
  }

  getCurrentRouteStyle() {
    return this.currentRoute?.style || {};
  }

  getCurveInfo(distanceMeters = 0) {
    const totalDistance = this.currentRoute.totalDistance || 1;
    const distance = ((distanceMeters % totalDistance) + totalDistance) % totalDistance;
    const lateral = this.getLateralOffset(distance);

    const delta = 6;
    const lateralAhead = this.getLateralOffset(distance + delta);
    const lateralBehind = this.getLateralOffset(distance - delta);
    const slope = (lateralAhead - lateralBehind) / (2 * delta);
    const heading = Math.atan(slope);

    return { lateral, heading };
  }

  getRouteMap(numPoints = 140) {
    const totalDistance = this.currentRoute.totalDistance || 1;
    const points = this.buildRouteTrackPoints(numPoints, totalDistance);
    const turns = this.extractTurnsFromTrack(points, totalDistance);

    return {
      routeName: this.currentRoute.name,
      totalDistance,
      totalElevation: this.currentRoute.totalElevation || 0,
      difficulty: this.currentRoute.difficulty || 'unknown',
      description: this.currentRoute.description || '',
      color: this.currentRoute.color || '#94a3b8',
      points,
      turns,
      events: this.routeEvents
    };
  }

  buildRouteTrackPoints(numPoints, totalDistance) {
    const gpxLikeTrack = this.currentRoute?.track || this.currentRoute?.gpxTrack || this.currentRoute?.routeTrack;
    if (Array.isArray(gpxLikeTrack) && gpxLikeTrack.length > 1) {
      const converted = this.convertTrackToMapPoints(gpxLikeTrack, totalDistance);
      if (converted.length > 1) {
        return this.alignTrackOrientation(this.resampleTrackPoints(converted, numPoints, totalDistance));
      }
    }

    const generated = this.generateTrackFromRouteCurvature(numPoints, totalDistance);
    return this.alignTrackOrientation(generated);
  }

  resampleTrackPoints(points, targetCount, totalDistance) {
    if (!Array.isArray(points) || points.length <= 2 || points.length <= targetCount) {
      return points || [];
    }

    const count = Math.max(2, targetCount);
    const sorted = [...points].sort((a, b) => (a.distance || 0) - (b.distance || 0));
    const sampled = [];
    const step = totalDistance / Math.max(1, count - 1);
    let cursor = 0;

    for (let i = 0; i < count; i += 1) {
      const targetDistance = i * step;
      while (
        cursor < sorted.length - 2
        && (sorted[cursor + 1].distance || 0) < targetDistance
      ) {
        cursor += 1;
      }

      const a = sorted[cursor];
      const b = sorted[Math.min(sorted.length - 1, cursor + 1)];
      const da = a.distance || 0;
      const db = b.distance || da + 1;
      const t = db > da ? Math.max(0, Math.min(1, (targetDistance - da) / (db - da))) : 0;

      sampled.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        altitude: (a.altitude || 0) + ((b.altitude || 0) - (a.altitude || 0)) * t,
        distance: targetDistance
      });
    }

    return sampled;
  }

  convertTrackToMapPoints(track, totalDistance) {
    const points = [];
    const hasLatLon = track.some(
      (point) => (point?.lat !== undefined && point?.lat !== null)
        || (point?.latitude !== undefined && point?.latitude !== null)
    );
    const origin = track[0] || {};
    const originLat = Number(origin.lat ?? origin.latitude ?? 0);
    const originLon = Number(origin.lon ?? origin.lng ?? origin.longitude ?? 0);
    const latScale = 111320;
    const lonScale = Math.cos(originLat * (Math.PI / 180)) * 111320;

    let previous = null;
    let accumulatedDistance = 0;

    track.forEach((point, index) => {
      let x = 0;
      let y = 0;
      if (hasLatLon) {
        const lat = Number(point.lat ?? point.latitude ?? originLat);
        const lon = Number(point.lon ?? point.lng ?? point.longitude ?? originLon);
        x = (lon - originLon) * lonScale;
        y = (lat - originLat) * latScale;
      } else {
        x = Number(point.x ?? point.easting ?? 0);
        y = Number(point.y ?? point.northing ?? 0);
      }

      if (previous) {
        const dx = x - previous.x;
        const dy = y - previous.y;
        accumulatedDistance += Math.hypot(dx, dy);
      }

      const fallbackDistance = (index / Math.max(1, track.length - 1)) * totalDistance;
      const distance = Number.isFinite(point.distance) ? Number(point.distance) : fallbackDistance;
      const altitude = Number.isFinite(point.altitude)
        ? Number(point.altitude)
        : this.getPositionInfo(distance).altitude;

      const normalizedDistance = Math.max(0, Math.min(totalDistance, distance || accumulatedDistance));
      const safeDistance = Number.isFinite(normalizedDistance) ? normalizedDistance : fallbackDistance;

      points.push({
        x,
        y,
        distance: safeDistance,
        altitude
      });

      previous = { x, y };
    });

    return points;
  }

  generateTrackFromRouteCurvature(numPoints, totalDistance) {
    const step = totalDistance / Math.max(1, numPoints - 1);
    const points = [];

    let x = 0;
    let y = 0;
    let worldHeading = 0;
    let turnVelocity = 0;
    let prevLocalHeading = this.getCurveInfo(0).heading;

    for (let i = 0; i < numPoints; i += 1) {
      const distance = i * step;
      const localHeading = this.getCurveInfo(distance).heading;
      const switchback = this.getSwitchbackInfo(distance);
      const deltaLocal = this.normalizeAngle(localHeading - prevLocalHeading);
      prevLocalHeading = localHeading;

      const switchbackBend = switchback.active
        ? switchback.direction * (0.16 + switchback.intensity * 0.22)
        : 0;
      const targetTurn = localHeading * 0.34 + deltaLocal * 1.7 + switchbackBend;
      turnVelocity = turnVelocity * 0.74 + targetTurn * 0.26;
      worldHeading += turnVelocity * (step / 85);
      worldHeading = this.normalizeAngle(worldHeading);

      if (i > 0) {
        x += Math.sin(worldHeading) * step;
        y += Math.cos(worldHeading) * step;
      }

      points.push({
        x,
        y,
        distance,
        altitude: this.getPositionInfo(distance).altitude,
        heading: worldHeading
      });
    }

    return points;
  }

  alignTrackOrientation(points) {
    if (!Array.isArray(points) || points.length < 2) return points || [];

    const first = points[0];
    const last = points[points.length - 1];
    const direction = Math.atan2(last.y - first.y, last.x - first.x);
    const rotate = (Math.PI / 2) - direction;
    const cos = Math.cos(rotate);
    const sin = Math.sin(rotate);

    return points.map((point) => {
      const dx = point.x - first.x;
      const dy = point.y - first.y;
      return {
        ...point,
        x: dx * cos - dy * sin,
        y: dx * sin + dy * cos
      };
    });
  }

  extractTurnsFromTrack(points, totalDistance) {
    const turns = [];
    if (!Array.isArray(points) || points.length < 4) return turns;

    const minSpacingMeters = Math.max(260, totalDistance * 0.025);
    let lastTurnDistance = -Infinity;
    let previousHeading = null;

    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const curr = points[i];
      const heading = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      if (previousHeading !== null) {
        const delta = this.normalizeAngle(heading - previousHeading);
        const distance = curr.distance ?? ((i / (points.length - 1)) * totalDistance);
        if (Math.abs(delta) > 0.18 && (distance - lastTurnDistance) > minSpacingMeters) {
          turns.push({
            distance,
            direction: delta > 0 ? 'right' : 'left'
          });
          lastTurnDistance = distance;
        }
      }
      previousHeading = heading;
    }

    return turns;
  }

  normalizeAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  getTurnPreview(distanceMeters = 0, lookAheadMeters = 1400) {
    const totalDistance = this.currentRoute.totalDistance || 1;
    const maxLookAhead = Math.min(lookAheadMeters, totalDistance);
    const step = 80;

    for (let offset = step; offset <= maxLookAhead; offset += step) {
      const checkDistance = distanceMeters + offset;
      const { heading } = this.getCurveInfo(checkDistance);
      const headingDeg = heading * (180 / Math.PI);
      if (Math.abs(headingDeg) > 10) {
        return {
          distanceMeters: offset,
          direction: headingDeg > 0 ? 'right' : 'left'
        };
      }
    }

    return null;
  }

  getSmoothedGradient(distanceMeters = 0, windowMeters = 60) {
    const window = Math.max(20, windowMeters);
    const behind = this.getPositionInfo(distanceMeters - window).altitude;
    const ahead = this.getPositionInfo(distanceMeters + window).altitude;
    return (ahead - behind) / (window * 2);
  }

  getDisplayGradient(distanceMeters = 0) {
    const routeId = this.currentRoute?.id || 'flat-loop';
    const windowMeters = routeId === 'flat-loop' ? 140 : 64;

    const smoothed = this.getSmoothedGradient(distanceMeters, windowMeters);
    const local = this.getPositionInfo(distanceMeters).gradient;
    const smoothWeight = routeId === 'flat-loop' ? 0.86 : 0.72;
    let gradient = smoothed * smoothWeight + local * (1 - smoothWeight);

    if (Math.abs(gradient) < 0.0015) {
      gradient = 0;
    }

    return Math.max(-REALISTIC_GRADIENT_LIMIT, Math.min(REALISTIC_GRADIENT_LIMIT, gradient));
  }

  computeRouteSceneryStats(route) {
    const points = route?.points || [];
    if (!points.length) {
      return {
        minAltitude: 0,
        maxAltitude: 1,
        altitudeRange: 1
      };
    }

    let minAltitude = Number.POSITIVE_INFINITY;
    let maxAltitude = Number.NEGATIVE_INFINITY;
    points.forEach((point) => {
      minAltitude = Math.min(minAltitude, point.altitude);
      maxAltitude = Math.max(maxAltitude, point.altitude);
    });

    return {
      minAltitude,
      maxAltitude,
      altitudeRange: Math.max(1, maxAltitude - minAltitude)
    };
  }

  getRouteMountainPhase(routeId, progress) {
    const p = Math.max(0, Math.min(1, progress));

    if (routeId === 'flat-loop') {
      return 0.08 + Math.sin(p * Math.PI * 2) * 0.03;
    }

    if (routeId === 'hilly-route') {
      if (p < 0.14) return 0.2 + (p / 0.14) * 0.12;
      if (p < 0.36) return 0.32 + ((p - 0.14) / 0.22) * 0.28;
      if (p < 0.53) return 0.6 - ((p - 0.36) / 0.17) * 0.18;
      if (p < 0.72) return 0.42 + ((p - 0.53) / 0.19) * 0.4;
      if (p < 0.86) return 0.82 - ((p - 0.72) / 0.14) * 0.2;
      return 0.62 + ((p - 0.86) / 0.14) * 0.24;
    }

    return 0.22;
  }

  /**
   * Returns scenery profile used by environment managers to create
   * believable zone transitions (flat -> foothills -> mountain -> alpine).
   */
  getSceneryProfile(distanceMeters = 0) {
    const info = this.getPositionInfo(distanceMeters);
    const stats = this.routeSceneryStats || this.computeRouteSceneryStats(this.currentRoute);
    const routeId = this.currentRoute?.id || 'flat-loop';
    const routeStyle = this.getCurrentRouteStyle();

    const altitudeNorm = Math.max(0, Math.min(1, (info.altitude - stats.minAltitude) / stats.altitudeRange));
    const gradeNorm = Math.max(0, Math.min(1, Math.abs(info.gradientPercent || 0) / 12));
    const routePhase = this.getRouteMountainPhase(routeId, info.progress || 0);

    let mountainness = Math.max(
      0,
      Math.min(1, routePhase * 0.62 + altitudeNorm * 0.24 + gradeNorm * 0.2)
    );
    mountainness = Math.max(0, Math.min(1, mountainness + (routeStyle.mountainnessBias || 0)));

    const alpineBase = Math.max(0, (altitudeNorm - 0.68) * 2.4);
    const alpineByPhase = Math.max(0, (mountainness - 0.72) * 2.2);
    let alpineFactor = Math.max(0, Math.min(1, alpineBase * 0.62 + alpineByPhase * 0.38));
    if (routeId !== 'hilly-route') {
      alpineFactor *= 0.68;
    }
    alpineFactor = Math.max(0, Math.min(1, alpineFactor + (routeStyle.alpineBias || 0)));

    let zone = 'flat';
    if (alpineFactor > 0.52) {
      zone = 'alpine';
    } else if (mountainness > 0.62) {
      zone = 'mountain';
    } else if (mountainness > 0.28) {
      zone = 'foothills';
    }

    const corridorScale = routeStyle.corridorWidthScale || 1;
    let hillVista = 0;
    if (routeId === 'hilly-route') {
      const p = info.progress || 0;
      const crestA = Math.exp(-((p - 0.34) ** 2) / (2 * 0.06 * 0.06));
      const crestB = Math.exp(-((p - 0.79) ** 2) / (2 * 0.07 * 0.07));
      hillVista = Math.max(0, Math.min(1, (crestA + crestB) * 0.92 + altitudeNorm * 0.34));
    }

    const corridorHalfWidth = (((1 - mountainness) * 48 + mountainness * 20 - alpineFactor * 2.2) + hillVista * 13.5) * corridorScale;
    const rockiness = Math.max(
      0,
      Math.min(1, (0.18 + mountainness * 0.72 + alpineFactor * 0.2) * (routeStyle.rockDensity || 1))
    );
    const vegetationDensity = Math.max(
      0.2,
      Math.min(1, (1 - mountainness * 0.42 - alpineFactor * 0.34) * (routeStyle.vegetationDensityScale || 1))
    );

    return {
      routeId,
      zone,
      progress: info.progress || 0,
      altitudeNorm,
      mountainness,
      alpineFactor,
      hillVista,
      rockiness,
      vegetationDensity,
      corridorHalfWidth,
      farmPropDensity: routeStyle.farmPropDensity || 1,
      rockDensity: routeStyle.rockDensity || 1,
      coniferWeight: routeStyle.coniferWeight || 1,
      oakWeight: routeStyle.oakWeight || 1,
      cypressWeight: routeStyle.cypressWeight || 1,
      treeSpreadScale: routeStyle.treeSpreadScale || 1,
      shrubDensity: routeStyle.shrubDensity || 1,
      groundPlantDensity: routeStyle.groundPlantDensity || 1,
      farPropDensity: routeStyle.farPropDensity || 1
    };
  }

  buildRouteEvents(route) {
    if (!route?.points?.length) return [];

    const events = [];
    const totalDistance = route.totalDistance || 1;
    const sampleStep = Math.max(90, Math.min(220, totalDistance / 170));
    const minZoneSpacing = 360;

    let previousZone = this.getSceneryProfile(0).zone;
    for (let distance = sampleStep; distance < totalDistance; distance += sampleStep) {
      const profile = this.getSceneryProfile(distance);
      if (profile.zone !== previousZone) {
        const lastEvent = events[events.length - 1];
        if (!lastEvent || Math.abs(distance - lastEvent.distance) > minZoneSpacing) {
          events.push({
            id: `zone-${previousZone}-to-${profile.zone}-${Math.round(distance)}`,
            type: 'zone',
            distance,
            priority: 4,
            title: this.getZoneTransitionTitle(previousZone, profile.zone)
          });
        }
        previousZone = profile.zone;
      }
    }

    const points = route.points;
    let summitPoint = points[0];
    points.forEach((point) => {
      if (point.altitude > summitPoint.altitude) {
        summitPoint = point;
      }
    });
    if (summitPoint.altitude - this.routeSceneryStats.minAltitude > 180) {
      events.push({
        id: `summit-${Math.round(summitPoint.distance)}`,
        type: 'summit',
        distance: summitPoint.distance,
        priority: 5,
        title: 'Summit Reached'
      });
    }

    const params = this.getCurveParams(route.id);
    if (params.switchback) {
      let inSwitchbackPass = false;
      let passStart = 0;
      const step = Math.max(50, params.switchbackLength / 9);
      for (let distance = 0; distance < totalDistance; distance += step) {
        const switchback = this.getSwitchbackInfo(distance);
        const mountainness = this.getSceneryProfile(distance).mountainness;
        const active = switchback.active && mountainness > 0.56;
        if (active && !inSwitchbackPass) {
          passStart = distance;
          inSwitchbackPass = true;
        } else if (!active && inSwitchbackPass) {
          if (distance - passStart > 260) {
            events.push({
              id: `switchback-${Math.round(passStart)}`,
              type: 'switchback',
              distance: passStart + 50,
              priority: 4,
              title: 'Entering Switchbacks'
            });
          }
          inSwitchbackPass = false;
        }
      }
      if (inSwitchbackPass) {
        events.push({
          id: `switchback-${Math.round(passStart)}`,
          type: 'switchback',
          distance: passStart + 50,
          priority: 4,
          title: 'Entering Switchbacks'
        });
      }
    }

    return events
      .filter((event) => event.distance >= 0 && event.distance < totalDistance)
      .sort((a, b) => a.distance - b.distance);
  }

  getZoneTransitionTitle(fromZone, toZone) {
    if (toZone === 'foothills') return 'Entering Foothills';
    if (toZone === 'mountain') return 'Entering Mountain Pass';
    if (toZone === 'alpine') return 'Entering Alpine Pass';
    if (fromZone === 'alpine' && toZone === 'mountain') return 'Leaving Summit Zone';
    if (toZone === 'flat') return 'Back To Valley Roads';
    return 'Scenery Transition';
  }

  getRouteEvents() {
    return this.routeEvents || [];
  }

  pollRouteEvent(distanceMeters = 0) {
    const events = this.routeEvents || [];
    if (!events.length) {
      this.lastEventScanDistance = distanceMeters;
      return null;
    }

    if (this.lastEventScanDistance === null) {
      this.lastEventScanDistance = distanceMeters;
      return null;
    }

    const previousDistance = this.lastEventScanDistance;
    this.lastEventScanDistance = distanceMeters;
    if (distanceMeters <= previousDistance) {
      return null;
    }

    const totalDistance = this.currentRoute?.totalDistance || 1;
    const startLap = Math.floor(previousDistance / totalDistance);
    const endLap = Math.floor(distanceMeters / totalDistance);
    const toleranceMeters = 8;

    for (let lap = startLap; lap <= endLap; lap++) {
      for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        const absoluteDistance = lap * totalDistance + event.distance;
        if (absoluteDistance > previousDistance - toleranceMeters && absoluteDistance <= distanceMeters + toleranceMeters) {
          const key = `${lap}:${event.id}`;
          if (this.firedEventKeys.has(key)) continue;
          this.firedEventKeys.add(key);
          this.pruneFiredEvents(lap - 2);
          return {
            ...event,
            lap: lap + 1,
            absoluteDistance
          };
        }
      }
    }

    return null;
  }

  pruneFiredEvents(minLapToKeep) {
    this.firedEventKeys.forEach((key) => {
      const [lapString] = key.split(':');
      const lap = Number(lapString);
      if (Number.isFinite(lap) && lap < minLapToKeep) {
        this.firedEventKeys.delete(key);
      }
    });
  }

  getCurveParams(routeId = this.currentRoute?.id) {
    const params = {
      amplitude: 8,
      wavelength: 980,
      switchback: false,
      switchbackLength: 640,
      switchbackAmplitude: 10
    };

    if (routeId === 'flat-loop') {
      params.amplitude = 3.2;
      params.wavelength = 1680;
      params.switchback = false;
    } else if (routeId === 'hilly-route') {
      params.amplitude = 9.4;
      params.wavelength = 910;
      params.switchback = true;
      params.switchbackLength = 560;
      params.switchbackAmplitude = 12.5;
    }

    return params;
  }

  getSwitchbackInfo(distanceMeters = 0) {
    const params = this.getCurveParams();
    if (!params.switchback) {
      return {
        active: false,
        intensity: 0,
        direction: 0,
        segment: -1,
        localProgress: 0
      };
    }

    const totalDistance = this.currentRoute?.totalDistance || 1;
    const effectiveDistance = ((distanceMeters % totalDistance) + totalDistance) % totalDistance;
    const segment = Math.floor(effectiveDistance / params.switchbackLength);
    const direction = segment % 2 === 0 ? 1 : -1;
    const localProgress = (effectiveDistance % params.switchbackLength) / params.switchbackLength;
    const intensity = Math.sin(localProgress * Math.PI);

    return {
      active: intensity > 0.56,
      intensity,
      direction,
      segment,
      localProgress
    };
  }

  getLateralOffset(distanceMeters) {
    const params = this.getCurveParams(this.currentRoute?.id);

    const wave = Math.sin((distanceMeters / params.wavelength) * Math.PI * 2) * params.amplitude;
    let lateral = wave;

    if (params.switchback) {
      const segment = Math.floor(distanceMeters / params.switchbackLength);
      const direction = segment % 2 === 0 ? 1 : -1;
      const local = (distanceMeters % params.switchbackLength) / params.switchbackLength;
      const turn = Math.sin(local * Math.PI) * params.switchbackAmplitude * direction;
      lateral += turn;
    }

    return lateral;
  }

  /**
   * Get position info at a given distance
   * Returns altitude, gradient, and progress
   */
  getPositionInfo(distanceMeters) {
    if (!this.currentRoute || !this.currentRoute.points.length) {
      return { altitude: 0, gradient: 0, progress: 0 };
    }

    const points = this.currentRoute.points;
    const totalDistance = this.currentRoute.totalDistance;

    // Handle looping routes
    const effectiveDistance = distanceMeters % totalDistance;

    // Find surrounding points
    let lowerIndex = 0;
    let upperIndex = 1;

    for (let i = 0; i < points.length - 1; i++) {
      if (points[i].distance <= effectiveDistance && points[i + 1].distance > effectiveDistance) {
        lowerIndex = i;
        upperIndex = i + 1;
        break;
      }
    }

    const lower = points[lowerIndex];
    const upper = points[upperIndex];

    // Interpolate
    const segmentLength = upper.distance - lower.distance;
    const segmentProgress = segmentLength > 0
      ? (effectiveDistance - lower.distance) / segmentLength
      : 0;

    const altitude = lower.altitude + (upper.altitude - lower.altitude) * segmentProgress;

    // Calculate gradient (rise / run)
    const rise = upper.altitude - lower.altitude;
    const run = segmentLength || 1;
    const gradient = rise / run; // As decimal (0.05 = 5%)

    const progress = effectiveDistance / totalDistance;

    return {
      altitude,
      gradient,
      gradientPercent: gradient * 100,
      progress,
      distanceRemaining: totalDistance - effectiveDistance,
      lap: Math.floor(distanceMeters / totalDistance) + 1
    };
  }

  /**
   * Get elevation profile data for chart display
   */
  getElevationProfile(numPoints = 100) {
    if (!this.currentRoute) return [];

    const totalDistance = this.currentRoute.totalDistance;
    const profile = [];

    for (let i = 0; i < numPoints; i++) {
      const distance = (i / (numPoints - 1)) * totalDistance;
      const info = this.getPositionInfo(distance);
      profile.push({
        distance: distance / 1000, // km
        altitude: info.altitude
      });
    }

    return profile;
  }

  /**
   * Get gradient command for smart trainer
   * Returns value between -20 and +20 (percent)
   */
  getTrainerGradient(distanceMeters) {
    const info = this.getPositionInfo(distanceMeters);
    // Clamp to trainer limits
    return Math.max(-20, Math.min(20, info.gradientPercent));
  }
}
