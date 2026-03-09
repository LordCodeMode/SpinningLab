const CHANNEL_NAME = 'virtual-ride-data';
const channel = new BroadcastChannel(CHANNEL_NAME);

const statusEl = document.getElementById('status');
const progressEl = document.getElementById('load-progress');
const hintEl = document.getElementById('load-hint');
const loadingOverlay = document.getElementById('loading-overlay');
const canvas = document.getElementById('unity-canvas');

const routeNameEl = document.getElementById('route-name');
const sessionStateEl = document.getElementById('session-state');
const workoutClockEl = document.getElementById('workout-clock');
const workoutNameEl = document.getElementById('workout-name');
const workoutCurrentLabelEl = document.getElementById('workout-current-label');
const workoutCurrentZoneEl = document.getElementById('workout-current-zone');
const workoutCurrentTargetEl = document.getElementById('workout-current-target');
const workoutCurrentRemainingEl = document.getElementById('workout-current-remaining');
const workoutCurrentCardEl = document.getElementById('workout-current-card');
const workoutNextLabelEl = document.getElementById('workout-next-label');
const workoutNextTargetEl = document.getElementById('workout-next-target');
const workoutNextEtaEl = document.getElementById('workout-next-eta');
const workoutNextCardEl = document.getElementById('workout-next-card');
const workoutListEl = document.getElementById('workout-list');
const mapRouteLabelEl = document.getElementById('map-route-label');
const mapStatusEl = document.getElementById('map-status');
const mapCanvas = document.getElementById('route-map');
const exportGpxButton = document.getElementById('export-gpx');

const metricEls = {
  power: document.getElementById('metric-power'),
  hr: document.getElementById('metric-hr'),
  cadence: document.getElementById('metric-cadence'),
  speed: document.getElementById('metric-speed'),
  grade: document.getElementById('metric-grade'),
  distance: document.getElementById('metric-distance'),
};

const ROUTE_ALIASES = {
  'hilly-route': 'route-alpine',
  'alpine-pass': 'route-alpine',
  'valley-route': 'route-valley',
  'flat-loop': 'route-valley',
  'crosswind-route': 'route-crosswind',
};

const ZONE_THEMES = {
  Z1: { key: 'z1' },
  Z2: { key: 'z2' },
  Z3: { key: 'z3' },
  Z4: { key: 'z4' },
  Z5: { key: 'z5' },
  Z6: { key: 'z6' },
  Z7: { key: 'z7' },
  default: { key: 'default' }
};
const LOOP_CLOSURE_STEP_METERS = 2;
const LOOP_CLOSURE_MIN_GAP_METERS = 1.5;
const LOOP_CLOSURE_MAX_GAP_METERS = 120;
const LOOP_CLOSURE_MAX_RATIO = 0.12;

const state = {
  liveData: {
    power: 0,
    cadence: 0,
    heartRate: 0,
    virtualSpeedKph: 0,
    routeGradePct: 0,
    distance: 0,
    sessionDistanceMeters: 0,
    elapsed: 0,
  },
  sessionState: 'idle',
  routeId: 'route-valley',
  workoutName: '',
  workoutSteps: [],
  routeProfile: null,
  activeRoute: null,
  routeMapProjection: null,
  runtimeVersion: '',
};
const mapBackgroundCache = new Map();

let unityInstanceRef = null;
const pendingMessages = [];

const normalizeRouteId = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  return ROUTE_ALIASES[raw] || raw;
};

const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const fmtInt = (value) => `${Math.round(Number(value) || 0)}`;
const fmt1 = (value) => `${(Number(value) || 0).toFixed(1)}`;
const formatTargetPower = (step) => {
  const target = Math.round(Number(step?.targetPower) || 0);
  return target > 0 ? `${target} W` : '--';
};

const resolveZoneTheme = (zoneValue) => {
  const raw = String(zoneValue || '').trim().toUpperCase();
  if (!raw) return ZONE_THEMES.default;
  const explicit = raw.match(/Z[1-7]/)?.[0];
  if (explicit && ZONE_THEMES[explicit]) return ZONE_THEMES[explicit];
  if (raw.includes('RECOVERY')) return ZONE_THEMES.Z1;
  if (raw.includes('ENDURANCE')) return ZONE_THEMES.Z2;
  if (raw.includes('TEMPO') || raw.includes('SWEET')) return ZONE_THEMES.Z3;
  if (raw.includes('THRESHOLD')) return ZONE_THEMES.Z4;
  if (raw.includes('VO2')) return ZONE_THEMES.Z5;
  if (raw.includes('ANAEROBIC')) return ZONE_THEMES.Z6;
  if (raw.includes('SPRINT')) return ZONE_THEMES.Z7;
  return ZONE_THEMES.default;
};

const applyZoneTheme = (element, zoneValue) => {
  if (!element) return;
  const theme = resolveZoneTheme(zoneValue);
  element.dataset.zoneTheme = theme.key;
};

const setStatus = (text) => {
  statusEl.textContent = text;
};

const setHint = (text) => {
  hintEl.textContent = text;
};

const setMapStatus = (text) => {
  mapStatusEl.textContent = text;
};

const postRuntimeEvent = (type, data = {}) => {
  channel.postMessage({
    type,
    data: {
      runtime: 'unity',
      ...data,
    },
  });
};

const resolveManifestUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('manifest');
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();
  return '/unity/current.json';
};

const resolveUrl = (value, base, cacheToken = '') => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const cleanedBase = String(base || '').replace(/\/+$/, '');
  const cleanedValue = String(value).replace(/^\/+/, '');
  const url = `${cleanedBase}/${cleanedValue}`;
  if (!cacheToken) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(cacheToken)}`;
};

const resolveAgainstManifest = (value, manifestUrl, cacheToken = '') => {
  if (!value) return '';
  let resolved = '';
  try {
    resolved = new URL(value, new URL(manifestUrl, window.location.href)).toString();
  } catch (error) {
    resolved = value;
  }
  if (!cacheToken) return resolved;
  return `${resolved}${resolved.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheToken)}`;
};

const loadScript = (src) => new Promise((resolve, reject) => {
  const tag = document.createElement('script');
  tag.src = src;
  tag.async = true;
  tag.onload = () => resolve();
  tag.onerror = () => reject(new Error(`Failed loading script: ${src}`));
  document.head.appendChild(tag);
});

const envelopeForUnity = (message) => {
  const payload = {
    type: String(message?.type || ''),
    dataJson: JSON.stringify(message?.data || {}),
  };
  return JSON.stringify(payload);
};

const flushPending = () => {
  if (!unityInstanceRef) return;

  while (pendingMessages.length > 0) {
    const next = pendingMessages.shift();
    try {
      unityInstanceRef.SendMessage('DashboardBridge', 'OnBridgeMessage', envelopeForUnity(next));
    } catch (error) {
      postRuntimeEvent('virtual-world-failed', { reason: `send-message:${error?.message || error}` });
      break;
    }
  }
};

const normalizeProfileRoute = (route) => {
  if (!route || typeof route !== 'object') return null;
  const id = normalizeRouteId(route.id || route.routeId || 'route-valley');
  const name = String(route.name || id || 'Route');
  const points = Array.isArray(route.points) ? route.points : [];
  if (points.length < 2) return null;

  const normalizedPoints = [];
  let runningDistance = 0;
  for (let i = 0; i < points.length; i += 1) {
    const source = points[i] || {};
    const x = Number(source.x) || 0;
    const y = Number(source.y) || Number(source.elevationMeters) || 0;
    const z = Number(source.z) || 0;
    const explicitDistance = Number(source.distanceMeters);

    if (Number.isFinite(explicitDistance)) {
      runningDistance = Math.max(runningDistance, explicitDistance);
    } else if (normalizedPoints.length > 0) {
      const prev = normalizedPoints[normalizedPoints.length - 1];
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dz = z - prev.z;
      runningDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    normalizedPoints.push({
      x,
      y,
      z,
      distanceMeters: runningDistance,
      elevationMeters: Number(source.elevationMeters) || y,
    });
  }

  if (normalizedPoints.length < 2) return null;
  const totalDistanceMeters = Math.max(
    Number(route.totalDistanceMeters) || 0,
    normalizedPoints[normalizedPoints.length - 1].distanceMeters,
    1
  );

  const first = normalizedPoints[0];
  const last = normalizedPoints[normalizedPoints.length - 1];
  const dx = first.x - last.x;
  const dy = first.y - last.y;
  const dz = first.z - last.z;
  const loopGapMeters = Math.sqrt((dx ** 2) + (dy ** 2) + (dz ** 2));
  const shouldCloseLoop = loopGapMeters >= LOOP_CLOSURE_MIN_GAP_METERS
    && loopGapMeters <= LOOP_CLOSURE_MAX_GAP_METERS
    && loopGapMeters <= (totalDistanceMeters * LOOP_CLOSURE_MAX_RATIO);

  if (shouldCloseLoop) {
    const closureSegments = Math.max(2, Math.ceil(loopGapMeters / LOOP_CLOSURE_STEP_METERS));
    for (let i = 1; i <= closureSegments; i += 1) {
      const t = i / closureSegments;
      normalizedPoints.push({
        x: last.x + (dx * t),
        y: last.y + (dy * t),
        z: last.z + (dz * t),
        elevationMeters: last.elevationMeters + ((first.elevationMeters - last.elevationMeters) * t),
        distanceMeters: totalDistanceMeters + (loopGapMeters * t),
      });
    }
  }

  return {
    id,
    name,
    points: normalizedPoints,
    totalDistanceMeters: Math.max(totalDistanceMeters, normalizedPoints[normalizedPoints.length - 1].distanceMeters),
  };
};

const pickActiveRoute = () => {
  const routes = Array.isArray(state.routeProfile?.routes) ? state.routeProfile.routes : [];
  if (!routes.length) {
    state.activeRoute = null;
    mapRouteLabelEl.textContent = '--';
    routeNameEl.textContent = `Route: ${state.routeId || '--'}`;
    exportGpxButton.disabled = true;
    return;
  }

  const wanted = normalizeRouteId(state.routeId);
  const found = routes.find((route) => route.id === wanted) || routes[0];
  state.activeRoute = found;
  mapRouteLabelEl.textContent = found.name;
  routeNameEl.textContent = `Route: ${found.name}`;
  exportGpxButton.disabled = false;
};

const getPointAtDistance = (route, distanceMeters) => {
  if (!route || !Array.isArray(route.points) || route.points.length < 2) return null;
  const total = Math.max(1, Number(route.totalDistanceMeters) || 1);
  const wrappedDistance = ((Number(distanceMeters) || 0) % total + total) % total;

  let idx = 0;
  for (let i = 0; i < route.points.length - 1; i += 1) {
    if (wrappedDistance <= route.points[i + 1].distanceMeters) {
      idx = i;
      break;
    }
    idx = i;
  }

  const a = route.points[idx];
  const b = route.points[Math.min(idx + 1, route.points.length - 1)];
  const span = Math.max(0.0001, (b.distanceMeters - a.distanceMeters) || 0.0001);
  const t = Math.max(0, Math.min(1, (wrappedDistance - a.distanceMeters) / span));

  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
};

const buildProjection = (route, width, height) => {
  const points = route.points;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < points.length; i += 1) {
    minX = Math.min(minX, points[i].x);
    maxX = Math.max(maxX, points[i].x);
    minZ = Math.min(minZ, points[i].z);
    maxZ = Math.max(maxZ, points[i].z);
  }

  const pad = 14;
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanZ);

  const mapWidth = spanX * scale;
  const mapHeight = spanZ * scale;
  const offsetX = (width - mapWidth) / 2;
  const offsetY = (height - mapHeight) / 2;

  return (point) => ({
    x: offsetX + (point.x - minX) * scale,
    y: height - (offsetY + (point.z - minZ) * scale),
  });
};

const hashString = (value) => {
  const text = String(value || '');
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const noise2d = (x, y, seed) => {
  const n = Math.sin((x * 12.9898) + (y * 78.233) + (seed * 0.017)) * 43758.5453;
  return n - Math.floor(n);
};

const createMapBackground = (route, width, height, project) => {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const ctx = layer.getContext('2d');
  if (!ctx) return layer;

  const seed = hashString(route.id || route.name || 'route');
  const points = Array.isArray(route.points) ? route.points : [];
  const elevations = points.map((point) => Number(point.elevationMeters ?? point.y ?? 0)).filter(Number.isFinite);
  const minElevation = elevations.length ? Math.min(...elevations) : 0;
  const maxElevation = elevations.length ? Math.max(...elevations) : minElevation + 1;
  const elevationSpan = Math.max(1, maxElevation - minElevation);

  const baseGradient = ctx.createLinearGradient(0, 0, 0, height);
  baseGradient.addColorStop(0, 'rgba(38, 78, 66, 0.34)');
  baseGradient.addColorStop(0.55, 'rgba(33, 64, 51, 0.3)');
  baseGradient.addColorStop(1, 'rgba(17, 32, 28, 0.4)');
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const elev = Number(a.elevationMeters ?? a.y ?? 0);
    const elev01 = Math.max(0, Math.min(1, (elev - minElevation) / elevationSpan));
    const a2 = project(a);
    const b2 = project(b);
    const hue = 126 - (elev01 * 48);
    const light = 22 + (elev01 * 16);
    const alpha = 0.11 + (elev01 * 0.07);

    ctx.beginPath();
    ctx.moveTo(a2.x, a2.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineWidth = 18 - (elev01 * 5);
    ctx.strokeStyle = `hsla(${hue}, 34%, ${light}%, ${alpha})`;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  for (let line = 0; line < 10; line += 1) {
    const yBase = ((line + 1) / 11) * height;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 5) {
      const waviness = (noise2d(x * 0.065, yBase * 0.08 + line, seed) - 0.5) * 7;
      const wave2 = (noise2d(x * 0.023, line * 0.7, seed + 19) - 0.5) * 5;
      const y = yBase + waviness + wave2;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = 'rgba(210, 244, 215, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const speckleCount = 420;
  for (let i = 0; i < speckleCount; i += 1) {
    const px = noise2d(i * 1.17, seed * 0.13, seed + 7) * width;
    const py = noise2d(i * 0.73, seed * 0.27, seed + 31) * height;
    const r = 0.35 + (noise2d(i * 0.29, i * 0.61, seed + 53) * 0.95);
    const alpha = 0.05 + (noise2d(i * 0.51, i * 0.41, seed + 71) * 0.08);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(84, 156, 96, ${alpha.toFixed(3)})`;
    ctx.fill();
  }

  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.25, width * 0.5, height * 0.5, Math.max(width, height) * 0.8);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  return layer;
};

const getMapBackground = (route, width, height, project) => {
  const routeToken = `${route.id || 'route'}:${route.points?.length || 0}:${Math.round(Number(route.totalDistanceMeters) || 0)}`;
  const cacheKey = `${routeToken}:${width}x${height}`;
  const cached = mapBackgroundCache.get(cacheKey);
  if (cached) return cached;
  const next = createMapBackground(route, width, height, project);
  mapBackgroundCache.set(cacheKey, next);
  return next;
};

const drawMap = () => {
  const ctx = mapCanvas.getContext('2d');
  if (!ctx) return;

  const width = mapCanvas.width;
  const height = mapCanvas.height;
  ctx.clearRect(0, 0, width, height);

  const route = state.activeRoute;
  if (!route || !Array.isArray(route.points) || route.points.length < 2) {
    ctx.fillStyle = 'rgba(230, 244, 255, 0.8)';
    ctx.font = '12px "IBM Plex Sans", sans-serif';
    ctx.fillText('No route profile available', 14, 24);
    setMapStatus('No route profile loaded');
    return;
  }

  const project = buildProjection(route, width, height);
  state.routeMapProjection = project;

  const background = getMapBackground(route, width, height, project);
  if (background) {
    ctx.drawImage(background, 0, 0, width, height);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  ctx.beginPath();
  const first = project(route.points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < route.points.length; i += 1) {
    const p = project(route.points[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = 'rgba(123, 208, 255, 0.9)';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  const markerPoint = getPointAtDistance(route, state.liveData.distance || 0);
  if (markerPoint) {
    const marker = project(markerPoint);
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = '#56f4a9';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();
  }

  const distanceKm = ((Number(state.liveData.distance) || 0) / 1000).toFixed(2);
  setMapStatus(`${route.name} | ${distanceKm} km`);
};

const renderMetrics = () => {
  metricEls.power.textContent = `${fmtInt(state.liveData.power)} W`;
  metricEls.hr.textContent = `${fmtInt(state.liveData.heartRate)} bpm`;
  metricEls.cadence.textContent = `${fmtInt(state.liveData.cadence)} rpm`;
  metricEls.speed.textContent = `${fmt1(state.liveData.virtualSpeedKph || state.liveData.speed)} km/h`;
  metricEls.grade.textContent = `${fmt1(state.liveData.routeGradePct)} %`;
  const displayDistanceMeters = Number.isFinite(Number(state.liveData.sessionDistanceMeters))
    ? Number(state.liveData.sessionDistanceMeters)
    : Number(state.liveData.distance) || 0;
  metricEls.distance.textContent = `${(displayDistanceMeters / 1000).toFixed(2)} km`;
  workoutClockEl.textContent = formatDuration(state.liveData.elapsed || 0);
  sessionStateEl.textContent = `Session: ${state.sessionState || 'idle'}`;
};

const renderWorkout = () => {
  const steps = Array.isArray(state.workoutSteps) ? state.workoutSteps : [];
  const elapsed = Number(state.liveData.elapsed) || 0;
  workoutNameEl.textContent = state.workoutName || (steps.length ? 'Workout' : 'No workout selected');

  workoutListEl.innerHTML = '';
  if (!steps.length) {
    applyZoneTheme(workoutCurrentCardEl, null);
    applyZoneTheme(workoutNextCardEl, null);
    workoutCurrentLabelEl.textContent = '--';
    workoutCurrentZoneEl.textContent = '--';
    workoutCurrentTargetEl.textContent = '--';
    workoutCurrentRemainingEl.textContent = '--';
    workoutNextLabelEl.textContent = '--';
    workoutNextTargetEl.textContent = '--';
    workoutNextEtaEl.textContent = '--';

    const empty = document.createElement('div');
    empty.className = 'workout-item';
    empty.textContent = 'No structured blocks available';
    workoutListEl.appendChild(empty);
    return;
  }

  let activeIndex = Math.max(0, steps.length - 1);
  let elapsedCursor = 0;
  let elapsedInStep = 0;
  for (let i = 0; i < steps.length; i += 1) {
    const duration = Math.max(0, Number(steps[i]?.durationSec) || 0);
    const end = elapsedCursor + duration;
    if (elapsed < end || i === steps.length - 1) {
      activeIndex = i;
      elapsedInStep = Math.max(0, elapsed - elapsedCursor);
      break;
    }
    elapsedCursor = end;
  }

  const activeStep = steps[activeIndex] || {};
  const activeDuration = Math.max(0, Number(activeStep.durationSec) || 0);
  const remainingInStep = Math.max(0, activeDuration - elapsedInStep);
  applyZoneTheme(workoutCurrentCardEl, activeStep.zone);

  workoutCurrentLabelEl.textContent = String(activeStep.label || `Block ${activeIndex + 1}`);
  workoutCurrentZoneEl.textContent = String(activeStep.zone || 'No zone');
  workoutCurrentTargetEl.textContent = formatTargetPower(activeStep);
  workoutCurrentRemainingEl.textContent = formatDuration(remainingInStep);

  const nextStep = steps[activeIndex + 1];
  if (nextStep) {
    applyZoneTheme(workoutNextCardEl, nextStep.zone);
    workoutNextLabelEl.textContent = String(nextStep.label || `Block ${activeIndex + 2}`);
    workoutNextTargetEl.textContent = formatTargetPower(nextStep);
    workoutNextEtaEl.textContent = `Starts in ${formatDuration(remainingInStep)} - ${formatDuration(Number(nextStep.durationSec) || 0)} duration`;
  } else {
    applyZoneTheme(workoutNextCardEl, activeStep.zone);
    workoutNextLabelEl.textContent = 'Last block';
    workoutNextTargetEl.textContent = '--';
    workoutNextEtaEl.textContent = 'No further blocks';
  }

  const previewStart = activeIndex + 1;
  const previewEnd = Math.min(steps.length, previewStart + 3);
  for (let i = previewStart; i < previewEnd; i += 1) {
    const step = steps[i] || {};
    const item = document.createElement('div');
    item.className = 'workout-item';
    applyZoneTheme(item, step.zone);

    item.innerHTML = `
      <span><span class="workout-item__title">+${i - activeIndex} ${String(step.label || `Block ${i + 1}`)}</span><small>${String(step.zone || 'No zone')}</small></span>
      <span class="workout-item__target">${formatTargetPower(step)}<br><small>${formatDuration(Number(step.durationSec) || 0)}</small></span>
    `;
    workoutListEl.appendChild(item);
  }

  if (previewStart >= steps.length) {
    const empty = document.createElement('div');
    empty.className = 'workout-item';
    empty.textContent = 'No further blocks';
    workoutListEl.appendChild(empty);
  }
};

const renderHud = () => {
  pickActiveRoute();
  renderMetrics();
  renderWorkout();
  drawMap();
};

const handleHudMessage = (message) => {
  const type = message?.type;
  const data = message?.data || {};
  if (!type) return;

  if (type === 'live-data') {
    const normalizedData = {
      ...data,
      cadence: Number.isFinite(Number(data.cadence)) ? Number(data.cadence) : Number(data.cadenceRpm),
      cadenceSmoothed: Number.isFinite(Number(data.cadenceSmoothed)) ? Number(data.cadenceSmoothed) : Number(data.smoothedCadenceRpm),
      virtualSpeedKph: Number.isFinite(Number(data.virtualSpeedKph)) ? Number(data.virtualSpeedKph) : Number(data.speedKph),
      routeGradePct: Number.isFinite(Number(data.routeGradePct)) ? Number(data.routeGradePct) : Number(data.gradePct),
      routeAltitudeM: Number.isFinite(Number(data.routeAltitudeM)) ? Number(data.routeAltitudeM) : Number(data.altitudeMeters),
      distance: Number.isFinite(Number(data.distance)) ? Number(data.distance) : Number(data.distanceMeters),
      sessionDistanceMeters: Number.isFinite(Number(data.sessionDistanceMeters))
        ? Number(data.sessionDistanceMeters)
        : Number.isFinite(Number(data.distance))
          ? Number(data.distance)
          : Number(data.distanceMeters),
    };
    state.liveData = {
      ...state.liveData,
      ...normalizedData,
      routeId: normalizedData.routeId || state.liveData.routeId,
    };
    if (normalizedData.routeId) state.routeId = normalizedData.routeId;
    if (normalizedData.sessionState) state.sessionState = String(normalizedData.sessionState || 'idle');
    renderHud();
    return;
  }

  if (type === 'session-start') {
    state.sessionState = 'running';
    state.workoutName = String(data.workoutName || state.workoutName || 'Workout');
    state.workoutSteps = Array.isArray(data.workoutSteps) ? data.workoutSteps : [];
    if (data.routeId) state.routeId = data.routeId;
    state.liveData = {
      ...state.liveData,
      cadence: Number.isFinite(Number(data.cadence)) ? Number(data.cadence) : state.liveData.cadence,
      cadenceSmoothed: Number.isFinite(Number(data.cadenceSmoothed)) ? Number(data.cadenceSmoothed) : state.liveData.cadenceSmoothed,
      power: Number.isFinite(Number(data.power)) ? Number(data.power) : state.liveData.power,
      virtualSpeedKph: Number.isFinite(Number(data.virtualSpeedKph)) ? Number(data.virtualSpeedKph) : state.liveData.virtualSpeedKph,
      routeGradePct: Number.isFinite(Number(data.routeGradePct)) ? Number(data.routeGradePct) : state.liveData.routeGradePct,
      routeAltitudeM: Number.isFinite(Number(data.routeAltitudeM)) ? Number(data.routeAltitudeM) : state.liveData.routeAltitudeM,
      distance: Number.isFinite(Number(data.distance)) ? Number(data.distance) : state.liveData.distance,
      sessionDistanceMeters: Number.isFinite(Number(data.sessionDistanceMeters))
        ? Number(data.sessionDistanceMeters)
        : state.liveData.sessionDistanceMeters,
    };
    renderHud();
    return;
  }

  if (type === 'session-pause') {
    state.sessionState = 'paused';
    renderHud();
    return;
  }

  if (type === 'session-resume') {
    state.sessionState = 'running';
    renderHud();
    return;
  }

  if (type === 'session-stop') {
    state.sessionState = 'idle';
    renderHud();
    return;
  }

  if ((type === 'route-change' || type === 'route-change-request') && data.routeId) {
    state.routeId = data.routeId;
    renderHud();
  }
};

const handleIncomingMessage = (message) => {
  const type = message?.type;
  if (!type) return;

  if (type === 'heartbeat' || type === 'virtual-world-ready' || type === 'virtual-world-failed') {
    return;
  }

  if (!unityInstanceRef) {
    pendingMessages.push(message);
    return;
  }

  try {
    unityInstanceRef.SendMessage('DashboardBridge', 'OnBridgeMessage', envelopeForUnity(message));
  } catch (error) {
    postRuntimeEvent('virtual-world-failed', { reason: `send-message:${error?.message || error}` });
  }
};

channel.onmessage = (event) => {
  const message = event?.data || {};
  handleHudMessage(message);
  handleIncomingMessage(message);
};

window.addEventListener('beforeunload', () => {
  channel.close();
});

window.addEventListener('resize', () => {
  drawMap();
});

const toPseudoGpx = (route) => {
  const baseLat = 48.2082;
  const baseLon = 16.3738;
  const latMeters = 111320;
  const lonMeters = 111320 * Math.cos((baseLat * Math.PI) / 180);
  const now = Date.now();

  const trkpts = route.points.map((point, index) => {
    const lat = baseLat + (point.z / latMeters);
    const lon = baseLon + (point.x / lonMeters);
    const ele = Number(point.elevationMeters || point.y || 0).toFixed(2);
    const time = new Date(now + index * 1000).toISOString();
    return `    <trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><ele>${ele}</ele><time>${time}</time></trkpt>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="training-dashboard" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${route.name}</name></metadata>\n  <trk>\n    <name>${route.name}</name>\n    <type>cycling</type>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n</gpx>\n`;
};

exportGpxButton.addEventListener('click', () => {
  if (!state.activeRoute) return;
  const gpx = toPseudoGpx(state.activeRoute);
  const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeRouteId = String(state.activeRoute.id || 'route').replace(/[^a-z0-9-_]+/gi, '-');
  link.href = url;
  link.download = `${safeRouteId}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

const loadRouteProfile = async (manifest, manifestUrl, cacheToken) => {
  const routeProfileUrlRaw = String(manifest?.routeProfileUrl || '').trim();
  if (!routeProfileUrlRaw) {
    setMapStatus('Manifest has no routeProfileUrl');
    drawMap();
    return;
  }

  const routeProfileUrl = resolveAgainstManifest(routeProfileUrlRaw, manifestUrl, cacheToken);
  const response = await fetch(routeProfileUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Route profile missing (${response.status})`);
  }

  const payload = await response.json();
  const routesRaw = Array.isArray(payload?.routes) ? payload.routes : [];
  const routes = routesRaw.map(normalizeProfileRoute).filter(Boolean);
  if (!routes.length) {
    throw new Error('Route profile has no usable routes');
  }

  state.routeProfile = { routes };
  setMapStatus(`Route profile loaded (${routes.length} routes)`);
  renderHud();
};

const boot = async () => {
  try {
    const manifestUrl = resolveManifestUrl();
    setHint('Fetching runtime manifest');

    const manifestResp = await fetch(manifestUrl, { cache: 'no-store' });
    if (!manifestResp.ok) {
      throw new Error(`Manifest missing (${manifestResp.status}) at ${manifestUrl}`);
    }

    const manifest = await manifestResp.json();
    const version = String(manifest?.version || '').trim();
    const cacheToken = String(manifest?.cacheToken || version || '').trim();
    const buildBase = String(manifest?.buildBaseUrl || '').trim();

    if (!version || !buildBase) {
      throw new Error('Manifest must include version and buildBaseUrl');
    }

    state.runtimeVersion = version;

    try {
      await loadRouteProfile(manifest, manifestUrl, cacheToken);
    } catch (routeError) {
      setMapStatus(`Route profile unavailable: ${routeError?.message || routeError}`);
      drawMap();
    }

    const loaderUrl = resolveUrl(manifest.loaderUrl || 'WebGL.loader.js', buildBase, cacheToken);
    setHint('Loading Unity loader');
    await loadScript(loaderUrl);

    if (typeof window.createUnityInstance !== 'function') {
      throw new Error('createUnityInstance is not available after loading Unity loader');
    }

    const config = {
      dataUrl: resolveUrl(manifest.dataUrl || 'WebGL.data', buildBase, cacheToken),
      frameworkUrl: resolveUrl(manifest.frameworkUrl || 'WebGL.framework.js', buildBase, cacheToken),
      codeUrl: resolveUrl(manifest.codeUrl || 'WebGL.wasm', buildBase, cacheToken),
      streamingAssetsUrl: resolveUrl(manifest.streamingAssetsUrl || 'StreamingAssets', buildBase, cacheToken),
      companyName: 'Training Dashboard',
      productName: 'Virtual Ride',
      productVersion: version,
      webglContextAttributes: {
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
      }
    };

    setHint('Initializing Unity WebGL');

    const unityInstance = await window.createUnityInstance(canvas, config, (progress) => {
      const ratio = Math.max(0, Math.min(1, Number(progress) || 0));
      progressEl.value = ratio;
      setHint(`Loading ${Math.round(ratio * 100)}%`);
    });

    unityInstanceRef = unityInstance;
    loadingOverlay.classList.add('hidden');
    setStatus('Unity WebGL connected. Waiting for ride data...');

    postRuntimeEvent('virtual-world-ready', { runtimeVersion: version });
    flushPending();
  } catch (error) {
    const detail = error?.message || String(error);
    setStatus(`Unity startup failed: ${detail}`);
    setHint('Runtime could not be started');
    postRuntimeEvent('virtual-world-failed', { reason: detail });
  }
};

renderHud();
boot();
