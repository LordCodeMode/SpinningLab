import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bluetooth,
  HeartPulse,
  Zap,
  Gauge,
  Timer,
  Play,
  Pause,
  Square,
  RefreshCw,
  Globe
} from 'lucide-react';
import { useVirtualWorld } from '../../virtual-world/useVirtualWorld.js';
import { RouteManager } from '../../virtual-world/routes.js';
import { RidePhysicsEngine, ridePhysicsDefaults } from '../../virtual-world/physics/RidePhysicsEngine.js';
import Services from '../../lib/services/index.js';
import API from '../../lib/core/api.js';
import { eventBus, EVENTS } from '../../lib/core/eventBus.js';
import { notify } from '../../lib/core/utils.js';
import { buildFecMessage, parseFecMessage } from './fec.js';

const WORKOUT_STEPS = [
  { id: 'warmup', label: 'Warm up', durationSec: 600, targetPower: 150, zone: 'Z1' },
  { id: 'build', label: 'Build', durationSec: 480, targetPower: 190, zone: 'Z2' },
  { id: 'interval-1', label: 'Interval 1', durationSec: 240, targetPower: 240, zone: 'Z4' },
  { id: 'recover-1', label: 'Recover', durationSec: 180, targetPower: 160, zone: 'Z2' },
  { id: 'interval-2', label: 'Interval 2', durationSec: 240, targetPower: 240, zone: 'Z4' },
  { id: 'cooldown', label: 'Cool down', durationSec: 480, targetPower: 140, zone: 'Z1' }
];

const DEFAULT_FTP = 250;
const WORKOUT_LIBRARY_LIMIT = 200;
const MAX_CHART_POINTS = 360;
const PEDALING_CADENCE_THRESHOLD_RPM = 40;
const CADENCE_TRANSITION_CONFIRM_TICKS = 2;
const FEC_SERVICE_UUID = '6e40fec1-b5a3-f393-e0a9-e50e24dcca9e';
const FEC_NOTIFY_UUID = '6e40fec2-b5a3-f393-e0a9-e50e24dcca9e';
const FEC_WRITE_UUID = '6e40fec3-b5a3-f393-e0a9-e50e24dcca9e';
const DEFAULT_ROUTE_ID = 'hilly-route';
const UNITY_RUNTIME_STORAGE_KEY = 'liveTraining:virtualWorldRuntime';
const GRADE_DEADBAND = 0.0015;
const PHYSICS_V2_ENABLED = (typeof globalThis === 'undefined')
  ? true
  : globalThis?.__VW_FLAGS?.physicsV2Enabled !== false;
const UNITY_RUNTIME_ENABLED = (typeof globalThis === 'undefined')
  ? true
  : globalThis?.__VW_FLAGS?.unityRuntimeEnabled !== false;
const UNITY_MOUNTAINS_ENABLED = (typeof globalThis === 'undefined')
  ? true
  : globalThis?.__VW_FLAGS?.unityMountainsEnabled !== false;
const UNITY_ONLY_MODE = (typeof globalThis === 'undefined')
  ? true
  : globalThis?.__VW_FLAGS?.unityOnlyMode !== false;

const parseUnityRouteScope = (scopeValue) => {
  if (Array.isArray(scopeValue)) {
    return scopeValue
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }
  if (typeof scopeValue === 'string') {
    const trimmed = scopeValue.trim();
    if (!trimmed) return [];
    if (trimmed.toLowerCase() === 'all') return ['*'];
    return [trimmed];
  }
  return ['*'];
};

const UNITY_ROUTE_SCOPE = (typeof globalThis === 'undefined')
  ? ['*']
  : (UNITY_ONLY_MODE
    ? ['*']
    : parseUnityRouteScope(globalThis?.__VW_FLAGS?.unityRouteScope ?? ['*']));

const formatDuration = (seconds) => {
  const totalSeconds = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

const formatMetric = (value, options = {}) => {
  const { suffix = '', decimals = 0 } = options;
  if (!Number.isFinite(value)) return '--';
  return `${Number(value).toFixed(decimals)}${suffix}`;
};

const average = (values) => {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  const total = valid.reduce((sum, value) => sum + value, 0);
  return total / valid.length;
};

const fillForward = (values, fallback = 0) => {
  let last = fallback;
  let hasValue = false;
  const filled = values.map((value) => {
    if (Number.isFinite(value)) {
      last = value;
      hasValue = true;
      return value;
    }
    return last;
  });
  return { filled, hasValue };
};

const bestAverage = (values, windowSize) => {
  if (!values.length || values.length < windowSize) return null;
  let sum = 0;
  for (let i = 0; i < windowSize; i += 1) {
    sum += values[i];
  }
  let best = sum / windowSize;
  for (let i = windowSize; i < values.length; i += 1) {
    sum += values[i] - values[i - windowSize];
    best = Math.max(best, sum / windowSize);
  }
  return best;
};

const normalizedPower = (values, windowSize = 30) => {
  if (!values.length || values.length < windowSize) return null;
  let sum = 0;
  const rolling = [];
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= windowSize) {
      sum -= values[i - windowSize];
    }
    if (i >= windowSize - 1) {
      rolling.push(sum / windowSize);
    }
  }
  if (!rolling.length) return null;
  const fourth = rolling.reduce((acc, value) => acc + value ** 4, 0) / rolling.length;
  return fourth ** 0.25;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatIntervalLabel = (interval, index) => {
  const name = String(interval?.name || '').trim();
  if (name) return name;
  const type = String(interval?.interval_type || '').trim();
  if (type) return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  return `Block ${index + 1}`;
};

const resolveIntervalTargetWatts = (interval, ftp) => {
  const low = Number(interval?.target_power_low);
  const high = Number(interval?.target_power_high);
  const average = Number.isFinite(low) && Number.isFinite(high)
    ? (low + high) / 2
    : Number.isFinite(high)
      ? high
      : Number.isFinite(low)
        ? low
        : null;

  if (!Number.isFinite(average)) return 0;
  if (interval?.target_power_type === 'percent_ftp') {
    return Math.round((average / 100) * (ftp || DEFAULT_FTP));
  }
  return Math.round(average);
};

const resolveIntervalZoneLabel = (interval) => {
  if (interval?.zone_label) return interval.zone_label;
  if (interval?.zone) return interval.zone;

  if (interval?.target_power_type !== 'percent_ftp') return null;
  const low = Number(interval?.target_power_low);
  const high = Number(interval?.target_power_high);
  const avg = Number.isFinite(low) && Number.isFinite(high)
    ? (low + high) / 2
    : Number.isFinite(high)
      ? high
      : Number.isFinite(low)
        ? low
        : null;

  if (!Number.isFinite(avg)) return null;
  if (avg <= 55) return 'Recovery (Z1)';
  if (avg <= 75) return 'Endurance (Z2)';
  if (avg <= 87) return 'Tempo (Z3)';
  if (avg <= 94) return 'Sweet Spot';
  if (avg <= 105) return 'Threshold';
  if (avg <= 120) return 'VO2max';
  if (avg <= 150) return 'Anaerobic';
  return 'Sprint';
};

const buildWorkoutSteps = (workout, ftp) => {
  const intervals = Array.isArray(workout?.intervals) ? workout.intervals : [];
  if (!intervals.length) return [];

  return intervals
    .map((interval, index) => ({
      id: interval?.id || `${workout?.id || 'workout'}-${index}`,
      label: formatIntervalLabel(interval, index),
      durationSec: Number(interval?.duration) || 0,
      targetPower: resolveIntervalTargetWatts(interval, ftp),
      zone: resolveIntervalZoneLabel(interval)
    }))
    .filter((step) => step.durationSec > 0);
};

const parseIndoorBikeData = (dataView) => {
  if (!dataView) return {};
  let offset = 0;
  if (dataView.byteLength < 2) return {};
  const flags = dataView.getUint16(offset, true);
  offset += 2;

  const result = {};

  if (dataView.byteLength >= offset + 2) {
    result.speed = dataView.getUint16(offset, true) / 100;
    offset += 2;
  }

  if (flags & 0x02) offset += 2;
  if (flags & 0x04 && dataView.byteLength >= offset + 2) {
    result.cadence = dataView.getUint16(offset, true) / 2;
    offset += 2;
  }
  if (flags & 0x08) offset += 2;
  if (flags & 0x10) offset += 3;
  if (flags & 0x20) offset += 2;
  if (flags & 0x40 && dataView.byteLength >= offset + 2) {
    result.power = dataView.getInt16(offset, true);
    offset += 2;
  }
  if (flags & 0x80) offset += 2;
  if (flags & 0x100) offset += 5;
  if (flags & 0x200 && dataView.byteLength >= offset + 1) {
    result.heartRate = dataView.getUint8(offset);
    offset += 1;
  }

  return result;
};

const parseHeartRateMeasurement = (dataView) => {
  if (!dataView || dataView.byteLength < 2) return null;
  const flags = dataView.getUint8(0);
  const is16Bit = (flags & 0x01) === 0x01;
  if (is16Bit && dataView.byteLength >= 3) {
    return dataView.getUint16(1, true);
  }
  return dataView.getUint8(1);
};

const parseCyclingPowerMeasurement = (dataView, cadenceRef) => {
  if (!dataView || dataView.byteLength < 4) return {};
  let offset = 0;
  const flags = dataView.getUint16(offset, true);
  offset += 2;
  const power = dataView.getInt16(offset, true);
  offset += 2;

  if (flags & 0x01) offset += 1;
  if (flags & 0x04) offset += 2;
  if (flags & 0x10) offset += 6;

  let cadence;
  if (flags & 0x20 && dataView.byteLength >= offset + 4) {
    const crankRevs = dataView.getUint16(offset, true);
    const crankTime = dataView.getUint16(offset + 2, true);
    offset += 4;

    const prev = cadenceRef.current;
    if (prev && crankTime !== prev.time) {
      const deltaRevs = (crankRevs - prev.revs + 65536) % 65536;
      const deltaTime = (crankTime - prev.time + 65536) % 65536;
      if (deltaTime > 0) {
        cadence = (deltaRevs / (deltaTime / 1024)) * 60;
      }
    }

    cadenceRef.current = { revs: crankRevs, time: crankTime };
  }

  return { power, cadence };
};

const clampRealisticGrade = (grade) => {
  const maxGrade = ridePhysicsDefaults.maxGrade || 0.12;
  const clamped = Math.max(-maxGrade, Math.min(maxGrade, grade || 0));
  return Math.abs(clamped) < GRADE_DEADBAND ? 0 : clamped;
};

const buildControlCommand = (opcode, params = []) => new Uint8Array([opcode, ...params]);

const buildTargetPowerCommand = (watts) => {
  const power = Math.max(0, Math.round(Number(watts) || 0));
  return buildControlCommand(0x05, [power & 0xff, (power >> 8) & 0xff]);
};

const buildStopCommand = (pause = false) => buildControlCommand(0x08, [pause ? 0x02 : 0x01]);

const parseLiveTrainingView = () => {
  if (typeof window === 'undefined') return 'setup';
  const raw = window.location.hash || '';
  const clean = raw.replace(/^#\/?/, '');
  const [path] = clean.split('?');
  const segments = (path || '').split('/').filter(Boolean);
  if (segments[0] === 'live-training' && segments[1] === 'session') {
    return 'session';
  }
  return 'setup';
};

const initialTrainerState = {
  status: 'idle',
  device: null,
  controlPoint: null,
  dataChar: null,
  name: '',
  error: '',
  capability: 'none',
  serviceType: null
};

const initialHrState = {
  status: 'idle',
  device: null,
  hrChar: null,
  name: '',
  error: ''
};

const LiveTrainingApp = () => {
  const [trainerState, setTrainerState] = useState(initialTrainerState);
  const [hrState, setHrState] = useState(initialHrState);
  const [liveMetrics, setLiveMetrics] = useState({
    power: null,
    cadence: null,
    speed: null,
    heartRate: null,
    trainerSpeedKph: null,
    virtualSpeedKph: null,
    routeGradePct: 0,
    routeAltitudeM: 0
  });
  const [externalHr, setExternalHr] = useState(null);
  const [sessionState, setSessionState] = useState('idle');
  const [sessionSummary, setSessionSummary] = useState(null);
  const [sessionName, setSessionName] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [pendingUpload, setPendingUpload] = useState(null);
  const [liveDistanceMeters, setLiveDistanceMeters] = useState(0);
  const [stravaStatus, setStravaStatus] = useState({ connected: false, loading: true });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepElapsed, setStepElapsed] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [workouts, setWorkouts] = useState([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [workoutsError, setWorkoutsError] = useState('');
  const [selectedWorkoutId, setSelectedWorkoutId] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [activeRouteId, setActiveRouteId] = useState(DEFAULT_ROUTE_ID);
  const [virtualWorldRuntimePreference, setVirtualWorldRuntimePreference] = useState(() => {
    if (UNITY_ONLY_MODE && UNITY_RUNTIME_ENABLED && UNITY_MOUNTAINS_ENABLED) return 'unity';
    if (UNITY_RUNTIME_ENABLED && UNITY_MOUNTAINS_ENABLED) return 'unity';
    if (typeof window === 'undefined') return 'three';
    try {
      return localStorage.getItem(UNITY_RUNTIME_STORAGE_KEY) === 'unity' ? 'unity' : 'three';
    } catch (error) {
      return 'three';
    }
  });
  const [userFtp, setUserFtp] = useState(DEFAULT_FTP);
  const [view, setView] = useState(() => parseLiveTrainingView());

  const chartCanvasRef = useRef(null);
  const chartRef = useRef(null);
  const chartDataRef = useRef({ labels: [], power: [], heartRate: [] });
  const chartStartRef = useRef(null);
  const lastSampleRef = useRef(0);
  const liveMetricsRef = useRef(liveMetrics);
  const physicsEngineRef = useRef(new RidePhysicsEngine());
  const physicsRouteManagerRef = useRef(new RouteManager());
  const physicsTickRef = useRef({
    timestampMs: Date.now(),
    speedKph: 0,
    grade: 0,
    altitude: 0
  });
  const sessionSamplesRef = useRef([]);
  const sessionStartRef = useRef(null);
  const sessionFinalizedRef = useRef(false);
  const cadenceRef = useRef(null);
  const distanceMetersRef = useRef(0);
  const physicsDistanceRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectResumeRef = useRef(false);
  const keepaliveTimerRef = useRef(null);
  const connectTrainerDeviceRef = useRef(null);
  const manualDisconnectRef = useRef(false);
  const sessionStateRef = useRef(sessionState);
  const targetPowerRef = useRef(WORKOUT_STEPS[0]?.targetPower || 0);
  const controlCapabilityRef = useRef(false);

  const externalHrRef = useRef(null);
  const trainerDeviceRef = useRef(null);
  const hrDeviceRef = useRef(null);

  const workoutSteps = useMemo(() => {
    const derived = buildWorkoutSteps(selectedWorkout, userFtp);
    return derived.length ? derived : WORKOUT_STEPS;
  }, [selectedWorkout, userFtp]);

  const totalDuration = useMemo(() => (
    workoutSteps.reduce((sum, step) => sum + step.durationSec, 0)
  ), [workoutSteps]);

  const currentStep = workoutSteps[currentStepIndex] || workoutSteps[0];
  const nextStep = workoutSteps[currentStepIndex + 1];
  const sortedWorkouts = useMemo(() => {
    return [...workouts].sort((a, b) => {
      const templateSort = Number(Boolean(b?.is_template)) - Number(Boolean(a?.is_template));
      if (templateSort !== 0) return templateSort;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  }, [workouts]);
  const routeOptions = useMemo(() => {
    return physicsRouteManagerRef.current
      .getRoutes()
      .map((route) => ({
        id: route?.id || '',
        name: route?.name || route?.id || 'Route'
      }))
      .filter((route) => route.id);
  }, []);
  const unityRuntimeAvailable = UNITY_RUNTIME_ENABLED && UNITY_MOUNTAINS_ENABLED;
  const unityRouteAllowed = useMemo(() => {
    if (!unityRuntimeAvailable) return false;
    if (UNITY_ONLY_MODE) return true;
    return UNITY_ROUTE_SCOPE.includes('*') || UNITY_ROUTE_SCOPE.includes(activeRouteId);
  }, [activeRouteId, unityRuntimeAvailable]);
  const resolvedVirtualWorldRuntime = (UNITY_ONLY_MODE && unityRuntimeAvailable)
    ? 'unity'
    : ((virtualWorldRuntimePreference === 'unity' && unityRouteAllowed) ? 'unity' : 'three');
  const runtimeScopeLabel = UNITY_ROUTE_SCOPE.includes('*')
    ? 'all routes'
    : UNITY_ROUTE_SCOPE.join(', ');
  const stepDuration = currentStep?.durationSec || 0;
  const remainingStep = Math.max(0, stepDuration - stepElapsed);
  const totalProgress = totalDuration ? Math.min(1, totalElapsed / totalDuration) : 0;
  const stepProgress = stepDuration ? Math.min(1, stepElapsed / stepDuration) : 0;
  const isSessionView = view === 'session';

  const isBluetoothSupported = typeof navigator !== 'undefined' && !!navigator.bluetooth;
  const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : true;
  const isChrome = typeof navigator !== 'undefined'
    ? /Chrome/.test(navigator.userAgent) && !/Edg|OPR/.test(navigator.userAgent)
    : true;

  const recordSessionSample = useCallback(() => {
    const metrics = liveMetricsRef.current || {};
    const hrValue = Number.isFinite(externalHrRef.current) ? externalHrRef.current : metrics.heartRate;
    const speedValue = Number.isFinite(metrics.virtualSpeedKph)
      ? metrics.virtualSpeedKph
      : Number.isFinite(metrics.speed)
        ? metrics.speed
        : null;
    const trainerSpeedValue = Number.isFinite(metrics.trainerSpeedKph) ? metrics.trainerSpeedKph : null;
    const speedMps = Number.isFinite(speedValue) ? speedValue * 1000 / 3600 : 0;
    if (Number.isFinite(physicsDistanceRef.current) && physicsDistanceRef.current >= 0) {
      distanceMetersRef.current = physicsDistanceRef.current;
    } else {
      distanceMetersRef.current += speedMps;
    }
    const elapsedSec = sessionSamplesRef.current.length + 1;
    const timestamp = sessionStartRef.current
      ? sessionStartRef.current + elapsedSec * 1000
      : Date.now();
    sessionSamplesRef.current.push({
      timestamp,
      elapsedSec,
      power: Number.isFinite(metrics.power) ? metrics.power : null,
      cadence: Number.isFinite(metrics.cadence) ? metrics.cadence : null,
      speed: speedValue,
      trainerSpeed: trainerSpeedValue,
      distanceMeters: distanceMetersRef.current,
      heartRate: Number.isFinite(hrValue) ? hrValue : null
    });
    setLiveDistanceMeters(distanceMetersRef.current);
  }, []);

  const buildSessionSummary = useCallback((samples) => {
    if (!samples.length) return null;
    const powerValues = samples.map((sample) => sample.power).filter(Number.isFinite);
    const hrValues = samples.map((sample) => sample.heartRate).filter(Number.isFinite);
    const cadenceValues = samples.map((sample) => sample.cadence).filter(Number.isFinite);
    const speedValues = samples.map((sample) => sample.speed).filter(Number.isFinite);
    const distanceMeters = Number.isFinite(samples[samples.length - 1]?.distanceMeters)
      ? samples[samples.length - 1].distanceMeters
      : null;
    const { filled: powerSeries, hasValue: hasPower } = fillForward(samples.map((sample) => sample.power), 0);

    const summary = {
      workoutName: selectedWorkout?.name || 'Live trainer session',
      startedAt: sessionStartRef.current ? new Date(sessionStartRef.current).toISOString() : null,
      endedAt: sessionStartRef.current
        ? new Date(sessionStartRef.current + samples.length * 1000).toISOString()
        : null,
      durationSec: samples.length,
      avgPower: average(powerValues),
      avgHeartRate: average(hrValues),
      avgCadence: average(cadenceValues),
      avgSpeed: average(speedValues),
      distanceMeters,
      maxPower: powerValues.length ? Math.max(...powerValues) : null,
      normalizedPower: hasPower ? normalizedPower(powerSeries) : null,
      bests: hasPower ? {
        best5s: bestAverage(powerSeries, 5),
        best1m: bestAverage(powerSeries, 60),
        best5m: bestAverage(powerSeries, 300),
        best20m: bestAverage(powerSeries, 1200)
      } : {
        best5s: null,
        best1m: null,
        best5m: null,
        best20m: null
      },
      samples
    };

    return summary;
  }, [selectedWorkout?.name]);

  const persistSession = useCallback((summary, nameOverride = null) => {
    if (!summary) return;
    const payload = {
      ...summary,
      name: nameOverride || summary.name || summary.workoutName
    };
    try {
      localStorage.setItem('liveTraining:lastSession', JSON.stringify(payload));
    } catch (error) {
      // Ignore localStorage errors.
    }
  }, []);

  const finalizeSession = useCallback(() => {
    if (sessionFinalizedRef.current) return;
    const summary = buildSessionSummary(sessionSamplesRef.current);
    if (!summary) return;
    sessionFinalizedRef.current = true;
    setSessionSummary(summary);
    setSaveStatus('idle');
    setSessionName((prev) => (prev ? prev : summary.workoutName));
    persistSession(summary);
  }, [buildSessionSummary, persistSession]);

  const clearSessionRecap = useCallback(() => {
    try {
      localStorage.removeItem('liveTraining:lastSession');
      localStorage.removeItem('liveTraining:pendingUpload');
    } catch (error) {
      // Ignore localStorage errors.
    }
    setPendingUpload(null);
    setSessionSummary(null);
    setSessionName('');
  }, []);

  const isAuthError = useCallback((error) => {
    const message = `${error?.message || ''}`.toLowerCase();
    return message.includes('could not validate credentials') || message.includes('http 401');
  }, []);

  useEffect(() => {
    if (sessionSummary) return;
    try {
      const stored = localStorage.getItem('liveTraining:lastSession');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.samples?.length) {
          setSessionSummary(parsed);
          setSessionName(parsed?.name || parsed?.workoutName || 'Live trainer session');
        }
      }
    } catch (error) {
      // Ignore malformed cache.
    }
  }, [sessionSummary]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('liveTraining:pendingUpload');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.samples?.length) {
          setPendingUpload(parsed);
        }
      }
    } catch (error) {
      // Ignore malformed cache.
    }
  }, []);

  const resetChartData = useCallback(() => {
    chartDataRef.current = { labels: [], power: [], heartRate: [] };
    chartStartRef.current = null;
    lastSampleRef.current = 0;
    cadenceRef.current = null;

    if (chartRef.current) {
      chartRef.current.data.labels = [];
      chartRef.current.data.datasets[0].data = [];
      chartRef.current.data.datasets[1].data = [];
      chartRef.current.update('none');
    }
  }, []);

  const syncViewFromHash = useCallback(() => {
    setView(parseLiveTrainingView());
  }, []);

  const navigateToSession = useCallback(() => {
    if (typeof window === 'undefined') return;
    const nextHash = '#live-training/session';
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      setView('session');
    }
  }, []);

  const navigateToSetup = useCallback(() => {
    if (typeof window === 'undefined') return;
    const nextHash = '#live-training';
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      setView('setup');
    }
  }, []);

  useEffect(() => {
    externalHrRef.current = externalHr;
  }, [externalHr]);

  useEffect(() => {
    liveMetricsRef.current = liveMetrics;
  }, [liveMetrics]);

  useEffect(() => {
    const routeManager = physicsRouteManagerRef.current;
    const changed = routeManager.setRoute(activeRouteId);
    if (changed) {
      const now = Date.now();
      distanceMetersRef.current = 0;
      physicsDistanceRef.current = 0;
      setLiveDistanceMeters(0);
      physicsEngineRef.current.reset(0);
      const routeInfo = routeManager.getPositionInfo(0);
      const grade = clampRealisticGrade(routeManager.getEffectiveGrade(0));
      const altitude = routeInfo.altitude || 0;
      physicsTickRef.current.timestampMs = now;
      physicsTickRef.current.speedKph = 0;
      physicsTickRef.current.grade = grade;
      physicsTickRef.current.altitude = altitude;
      setLiveMetrics((prev) => ({
        ...prev,
        speed: 0,
        virtualSpeedKph: 0,
        routeGradePct: grade * 100,
        routeAltitudeM: altitude
      }));
    }
  }, [activeRouteId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (UNITY_ONLY_MODE) return;
    try {
      localStorage.setItem(UNITY_RUNTIME_STORAGE_KEY, virtualWorldRuntimePreference);
    } catch (error) {
      // Ignore localStorage errors.
    }
  }, [virtualWorldRuntimePreference]);

  useEffect(() => {
    if (UNITY_ONLY_MODE) {
      const target = unityRuntimeAvailable ? 'unity' : 'three';
      if (virtualWorldRuntimePreference !== target) {
        setVirtualWorldRuntimePreference(target);
      }
      return;
    }
    if (!UNITY_RUNTIME_ENABLED && virtualWorldRuntimePreference !== 'three') {
      setVirtualWorldRuntimePreference('three');
    }
  }, [unityRuntimeAvailable, virtualWorldRuntimePreference]);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('hashchange', syncViewFromHash);
    syncViewFromHash();
    return () => window.removeEventListener('hashchange', syncViewFromHash);
  }, [syncViewFromHash]);

  useEffect(() => {
    if (sessionState === 'idle') return;
    if (!isSessionView) {
      navigateToSession();
    }
  }, [isSessionView, navigateToSession, sessionState]);

  useEffect(() => {
    if (!isSessionView) return;
    if (sessionState !== 'idle') return;
    if (!sessionSummary) return;
    navigateToSetup();
  }, [isSessionView, navigateToSetup, sessionState, sessionSummary]);

  useEffect(() => {
    targetPowerRef.current = currentStep?.targetPower || 0;
  }, [currentStep?.targetPower]);

  useEffect(() => {
    controlCapabilityRef.current = trainerState.capability === 'control';
  }, [trainerState.capability]);

  useEffect(() => {
    trainerDeviceRef.current = trainerState.device;
  }, [trainerState.device]);

  useEffect(() => {
    hrDeviceRef.current = hrState.device;
  }, [hrState.device]);

  const loadWorkouts = useCallback(async () => {
    setWorkoutsLoading(true);
    setWorkoutsError('');
    try {
      const [workoutsResponse, settings] = await Promise.all([
        API.getWorkouts({
          include_templates: true,
          limit: WORKOUT_LIBRARY_LIMIT
        }),
        API.getSettings()
      ]);

      const ftpValue = parseFloat(settings?.ftp);
      setUserFtp(Number.isFinite(ftpValue) ? ftpValue : DEFAULT_FTP);
      const riderWeightKg = Number(settings?.weight);
      const bikeWeightKg = Number(settings?.bike_weight);
      const cda = Number(settings?.cda);
      const crr = Number(settings?.crr);
      const airDensity = Number(settings?.air_density);
      const drivetrainEfficiency = Number(settings?.drivetrain_efficiency);
      physicsEngineRef.current.setParams({
        riderWeightKg: Number.isFinite(riderWeightKg) ? riderWeightKg : ridePhysicsDefaults.riderWeightKg,
        bikeWeightKg: Number.isFinite(bikeWeightKg) ? bikeWeightKg : ridePhysicsDefaults.bikeWeightKg,
        cda: Number.isFinite(cda) ? cda : ridePhysicsDefaults.cda,
        crr: Number.isFinite(crr) ? crr : ridePhysicsDefaults.crr,
        airDensity: Number.isFinite(airDensity) ? airDensity : ridePhysicsDefaults.airDensity,
        drivetrainEfficiency: Number.isFinite(drivetrainEfficiency)
          ? drivetrainEfficiency
          : ridePhysicsDefaults.drivetrainEfficiency
      });
      setWorkouts(Array.isArray(workoutsResponse) ? workoutsResponse : []);
    } catch (error) {
      setWorkoutsError(error?.message || 'Unable to load workouts.');
    } finally {
      setWorkoutsLoading(false);
    }
  }, []);

  const loadStravaStatus = useCallback(async () => {
    setStravaStatus((prev) => ({ ...prev, loading: true }));
    try {
      const response = await Services.api.getStravaStatus();
      setStravaStatus({ ...(response || {}), loading: false });
    } catch (error) {
      setStravaStatus({ connected: false, loading: false });
    }
  }, []);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  useEffect(() => {
    loadStravaStatus();
  }, [loadStravaStatus]);

  useEffect(() => {
    if (!selectedWorkoutId) {
      setSelectedWorkout(null);
      return;
    }

    let cancelled = false;
    const hydrate = async () => {
      const cached = workouts.find((item) => String(item.id) === String(selectedWorkoutId));
      if (cached && Array.isArray(cached.intervals) && cached.intervals.length) {
        if (!cancelled) {
          setSelectedWorkout(cached);
        }
        return;
      }

      try {
        const detail = await API.getWorkout(selectedWorkoutId);
        if (!cancelled) {
          setSelectedWorkout(detail || cached || null);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedWorkout(cached || null);
          setWorkoutsError(error?.message || 'Unable to load workout details.');
        }
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [selectedWorkoutId, workouts]);

  useEffect(() => {
    if (sessionStateRef.current !== 'idle') return;
    setCurrentStepIndex(0);
    setStepElapsed(0);
    setTotalElapsed(0);
    resetChartData();
  }, [resetChartData, selectedWorkoutId]);

  useEffect(() => {
    document.body.classList.add('page-live-training');
    if (isSessionView) {
      document.body.classList.add('page-live-training-session');
    }
    const mainContent = document.querySelector('.main-content');
    const pageContent = document.getElementById('pageContent');
    const prevBodyBg = document.body.style.backgroundColor;
    const prevMainBg = mainContent?.style.backgroundColor;
    const prevPageBg = pageContent?.style.backgroundColor;

    document.body.style.backgroundColor = 'var(--color-background)';
    if (mainContent) mainContent.style.backgroundColor = 'var(--color-surface)';
    if (pageContent) pageContent.style.backgroundColor = 'var(--color-surface)';

    return () => {
      document.body.classList.remove('page-live-training');
      document.body.classList.remove('page-live-training-session');
      document.body.style.backgroundColor = prevBodyBg || '';
      if (mainContent) mainContent.style.backgroundColor = prevMainBg || '';
      if (pageContent) pageContent.style.backgroundColor = prevPageBg || '';
    };
  }, [isSessionView]);

  useEffect(() => (
    () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (keepaliveTimerRef.current) {
        window.clearInterval(keepaliveTimerRef.current);
        keepaliveTimerRef.current = null;
      }
      if (trainerDeviceRef.current?.gatt?.connected) {
        trainerDeviceRef.current.gatt.disconnect();
      }
      if (hrDeviceRef.current?.gatt?.connected) {
        hrDeviceRef.current.gatt.disconnect();
      }
    }
  ), []);

  useEffect(() => {
    const Chart = typeof window !== 'undefined' ? window.Chart : null;
    const canvas = chartCanvasRef.current;
    if (!isSessionView) {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      return;
    }
    if (!Chart || !canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const theme = Services.chart?.getThemeTokens?.() || {};
    const chartColors = Services.chart?.colors || {
      primary: '#3b82f6',
      danger: '#ef4444',
      info: '#06b6d4'
    };

    const toRgba = (hex, alpha) => {
      if (Services.chart?.hexToRgba) return Services.chart.hexToRgba(hex, alpha);
      const value = (hex || '').replace('#', '');
      if (value.length !== 6) return `rgba(59, 130, 246, ${alpha})`;
      const r = parseInt(value.slice(0, 2), 16);
      const g = parseInt(value.slice(2, 4), 16);
      const b = parseInt(value.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: chartDataRef.current.labels,
        datasets: [
          {
            label: 'Power (W)',
            data: chartDataRef.current.power,
            borderColor: chartColors.primary || '#3b82f6',
            backgroundColor: toRgba(chartColors.primary || '#3b82f6', 0.12),
            borderWidth: 3,
            tension: 0.35,
            cubicInterpolationMode: 'monotone',
            pointRadius: 0,
            pointHitRadius: 12,
            fill: false,
            spanGaps: true,
            yAxisID: 'y'
          },
          {
            label: 'Heart Rate (bpm)',
            data: chartDataRef.current.heartRate,
            borderColor: chartColors.danger || '#ef4444',
            backgroundColor: toRgba(chartColors.danger || '#ef4444', 0.12),
            borderWidth: 3,
            tension: 0.35,
            cubicInterpolationMode: 'monotone',
            pointRadius: 0,
            pointHitRadius: 12,
            fill: false,
            spanGaps: true,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        layout: {
          padding: {
            left: 8,
            right: 12,
            top: 12,
            bottom: 8
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: theme.legend || '#475569',
              usePointStyle: true,
              padding: 12,
              font: { size: 12, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg || 'rgba(15, 23, 42, 0.9)',
            borderColor: theme.tooltipBorder || 'rgba(148, 163, 184, 0.35)',
            borderWidth: 1,
            titleColor: theme.tooltipTitle || '#f8fafc',
            bodyColor: theme.tooltipBody || '#e2e8f0',
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: theme.grid || 'rgba(148, 163, 184, 0.18)' },
            ticks: {
              color: theme.label || '#6b7280',
              maxTicksLimit: 6
            }
          },
          y: {
            position: 'left',
            grid: { color: theme.grid || 'rgba(148, 163, 184, 0.18)' },
            ticks: { color: theme.label || '#6b7280' },
            title: {
              display: true,
              text: 'Power (W)',
              color: theme.title || '#334155',
              font: { size: 12, weight: '600' }
            }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: theme.label || '#6b7280' },
            title: {
              display: true,
              text: 'Heart Rate (bpm)',
              color: theme.title || '#334155',
              font: { size: 12, weight: '600' }
            }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [isSessionView]);

  const sendTargetToControl = useCallback(async (controlPoint, serviceType, watts) => {
    if (!controlPoint) return;
    if (serviceType === 'fec_over_ble') {
      const message = buildFecMessage(49, { power: watts });
      await controlPoint.writeValue(message);
      return;
    }
    await controlPoint.writeValue(buildTargetPowerCommand(watts));
  }, []);

  const handleTrainerDisconnect = useCallback(() => {
    if (manualDisconnectRef.current) {
      reconnectAttemptsRef.current = 0;
      reconnectResumeRef.current = false;
      setTrainerState(initialTrainerState);
      setSessionState('idle');
      setLiveMetrics((prev) => ({
        ...prev,
        power: null,
        cadence: null,
        speed: null,
        trainerSpeedKph: null,
        virtualSpeedKph: null
      }));
      resetChartData();
      return;
    }

    if (reconnectTimerRef.current) {
      return;
    }

    const device = trainerDeviceRef.current;
    if (!device) {
      setTrainerState(initialTrainerState);
      setSessionState('idle');
      setLiveMetrics((prev) => ({
        ...prev,
        power: null,
        cadence: null,
        speed: null,
        trainerSpeedKph: null,
        virtualSpeedKph: null
      }));
      resetChartData();
      return;
    }

    const wasRunning = sessionStateRef.current === 'running';
    reconnectResumeRef.current = wasRunning;
    if (wasRunning) {
      setSessionState('paused');
    }

    setTrainerState((prev) => ({
      ...prev,
      status: 'reconnecting',
      error: 'Trainer disconnected. Attempting to reconnect...'
    }));

    const maxAttempts = 6;

    const attemptReconnect = () => {
      if (manualDisconnectRef.current) return;

      reconnectAttemptsRef.current += 1;
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 15000);

      reconnectTimerRef.current = window.setTimeout(async () => {
        reconnectTimerRef.current = null;
        if (manualDisconnectRef.current) return;

        try {
          const connectDevice = connectTrainerDeviceRef.current;
          if (!connectDevice) {
            throw new Error('Trainer reconnect unavailable.');
          }
          const { controlPoint, serviceType } = await connectDevice(device, {
            requireErg: controlCapabilityRef.current
          });
          reconnectAttemptsRef.current = 0;

          if (reconnectResumeRef.current && controlPoint) {
            if (serviceType === 'fitness_machine') {
              await controlPoint.writeValue(buildControlCommand(0x00));
              await controlPoint.writeValue(buildControlCommand(0x07));
            }
            await sendTargetToControl(controlPoint, serviceType, targetPowerRef.current);
            setSessionState('running');
          }
          reconnectResumeRef.current = false;
        } catch (error) {
          if (attempt >= maxAttempts) {
            setTrainerState((prev) => ({
              ...prev,
              status: 'error',
              error: 'Unable to reconnect. Close other apps using the trainer and try again.'
            }));
            reconnectAttemptsRef.current = 0;
            reconnectResumeRef.current = false;
            return;
          }

          setTrainerState((prev) => ({
            ...prev,
            status: 'reconnecting',
            error: `Reconnecting to trainer (${attempt}/${maxAttempts})...`
          }));
          attemptReconnect();
        }
      }, delay);
    };

    attemptReconnect();
  }, [resetChartData, sendTargetToControl]);

  const handleHrDisconnect = useCallback(() => {
    setHrState(initialHrState);
    setExternalHr(null);
    resetChartData();
  }, [resetChartData]);

  const computeVirtualMotion = useCallback((input = {}) => {
    const routeManager = physicsRouteManagerRef.current;
    const distanceMeters = Number(physicsDistanceRef.current || distanceMetersRef.current || 0);
    const positionInfo = routeManager.getPositionInfo(distanceMeters);
    const grade = clampRealisticGrade(routeManager.getEffectiveGrade(distanceMeters));
    const altitude = Number(positionInfo?.altitude) || 0;
    const now = Date.now();
    const dt = Math.max(0.04, Math.min(0.5, (now - (physicsTickRef.current?.timestampMs || now)) / 1000));

    if (!PHYSICS_V2_ENABLED) {
      const fallbackSpeedKph = Number.isFinite(input.trainerSpeedKph)
        ? input.trainerSpeedKph
        : (physicsTickRef.current?.speedKph || 0);
      physicsTickRef.current = {
        timestampMs: now,
        speedKph: Math.max(0, fallbackSpeedKph),
        grade,
        altitude
      };
      return {
        virtualSpeedKph: Math.max(0, fallbackSpeedKph),
        routeGradePct: grade * 100,
        routeAltitudeM: altitude
      };
    }

    const result = physicsEngineRef.current.step({
      dt,
      powerW: Number(input.power) || 0,
      cadenceRpm: Number(input.cadence) || 0,
      grade
    });
    if (sessionStateRef.current === 'running') {
      physicsDistanceRef.current = Math.max(0, physicsDistanceRef.current + result.speedMps * dt);
    }

    const virtualSpeedKph = Number.isFinite(result?.speedKph)
      ? Number(result.speedKph.toFixed(1))
      : 0;
    physicsTickRef.current = {
      timestampMs: now,
      speedKph: virtualSpeedKph,
      grade,
      altitude
    };

    return {
      virtualSpeedKph,
      routeGradePct: grade * 100,
      routeAltitudeM: altitude
    };
  }, []);

  const handleBikeData = useCallback((event) => {
    const data = parseIndoorBikeData(event.target.value);
    setLiveMetrics((prev) => {
      const power = Number.isFinite(data.power) ? data.power : prev.power;
      const cadence = Number.isFinite(data.cadence) ? data.cadence : prev.cadence;
      const trainerSpeedKph = Number.isFinite(data.speed) ? data.speed : prev.trainerSpeedKph;
      const motion = computeVirtualMotion({ power, cadence, trainerSpeedKph });
      return {
        power,
        cadence,
        speed: motion.virtualSpeedKph,
        heartRate: externalHrRef.current == null && Number.isFinite(data.heartRate)
          ? data.heartRate
          : prev.heartRate,
        trainerSpeedKph: Number.isFinite(trainerSpeedKph) ? trainerSpeedKph : null,
        virtualSpeedKph: motion.virtualSpeedKph,
        routeGradePct: motion.routeGradePct,
        routeAltitudeM: motion.routeAltitudeM
      };
    });
  }, [computeVirtualMotion]);

  const handlePowerData = useCallback((event) => {
    const data = parseCyclingPowerMeasurement(event.target.value, cadenceRef);
    setLiveMetrics((prev) => {
      const power = Number.isFinite(data.power) ? data.power : prev.power;
      const cadence = Number.isFinite(data.cadence) ? Math.round(data.cadence) : prev.cadence;
      const motion = computeVirtualMotion({ power, cadence, trainerSpeedKph: prev.trainerSpeedKph });
      return {
        ...prev,
        power,
        cadence,
        speed: motion.virtualSpeedKph,
        virtualSpeedKph: motion.virtualSpeedKph,
        routeGradePct: motion.routeGradePct,
        routeAltitudeM: motion.routeAltitudeM
      };
    });
  }, [computeVirtualMotion]);

  const handleFecData = useCallback((event) => {
    const message = parseFecMessage(event.target.value);
    if (!message?.decoded) return;
    const { power, cadence } = message.decoded;
    setLiveMetrics((prev) => {
      const resolvedPower = Number.isFinite(power) ? power : prev.power;
      const resolvedCadence = Number.isFinite(cadence) ? cadence : prev.cadence;
      const motion = computeVirtualMotion({
        power: resolvedPower,
        cadence: resolvedCadence,
        trainerSpeedKph: prev.trainerSpeedKph
      });
      return {
        ...prev,
        power: resolvedPower,
        cadence: resolvedCadence,
        speed: motion.virtualSpeedKph,
        virtualSpeedKph: motion.virtualSpeedKph,
        routeGradePct: motion.routeGradePct,
        routeAltitudeM: motion.routeAltitudeM
      };
    });
  }, [computeVirtualMotion]);

  const sendFecPage = useCallback(async (controlChar, dataPage, payload) => {
    const message = buildFecMessage(dataPage, payload);
    await controlChar.writeValue(message);
  }, []);

  const initializeFecControl = useCallback(async (controlChar) => {
    try {
      await sendFecPage(controlChar, 55, { userWeight: 75, bikeWeight: 8 });
      await sleep(200);
      await sendFecPage(controlChar, 50, { windResistance: 0.51, windSpeed: 0, draftingFactor: 1.0 });
    } catch (error) {
      // Non-fatal, trainer can still accept ERG commands.
    }
  }, [sendFecPage]);

  const handleHrData = useCallback((event) => {
    const hr = parseHeartRateMeasurement(event.target.value);
    if (Number.isFinite(hr)) {
      setExternalHr(hr);
    }
  }, []);

  const connectTrainerDevice = useCallback(async (device, options = {}) => {
    const { requireErg = false } = options;
    if (!device?.gatt) {
      throw new Error('No trainer device available.');
    }

    manualDisconnectRef.current = false;
    device.removeEventListener('gattserverdisconnected', handleTrainerDisconnect);
    device.addEventListener('gattserverdisconnected', handleTrainerDisconnect);

    const server = await device.gatt.connect();
    let controlPoint = null;
    let dataChar = null;
    let capability = 'data';
    let serviceType = null;

    const attachCyclingPower = async () => {
      try {
        const powerService = await server.getPrimaryService('cycling_power');
        const powerChar = await powerService.getCharacteristic('cycling_power_measurement');
        await powerChar.startNotifications();
        powerChar.addEventListener('characteristicvaluechanged', handlePowerData);
        dataChar = powerChar;
        return true;
      } catch (error) {
        return false;
      }
    };

    try {
      const service = await server.getPrimaryService('fitness_machine');
      controlPoint = await service.getCharacteristic('fitness_machine_control_point');
      dataChar = await service.getCharacteristic('indoor_bike_data');
      await dataChar.startNotifications();
      dataChar.addEventListener('characteristicvaluechanged', handleBikeData);
      capability = 'control';
      serviceType = 'fitness_machine';
    } catch (serviceError) {
      let fecWriteChar = null;
      let fecNotifyChar = null;

      try {
        const fecService = await server.getPrimaryService(FEC_SERVICE_UUID);
        fecWriteChar = await fecService.getCharacteristic(FEC_WRITE_UUID);
        fecNotifyChar = await fecService.getCharacteristic(FEC_NOTIFY_UUID);
      } catch (fecError) {
        fecWriteChar = null;
      }

      if (fecWriteChar) {
        controlPoint = fecWriteChar;
        capability = 'control';
        serviceType = 'fec_over_ble';

        const hasPower = await attachCyclingPower();
        if (!hasPower && fecNotifyChar) {
          await fecNotifyChar.startNotifications();
          fecNotifyChar.addEventListener('characteristicvaluechanged', handleFecData);
          dataChar = fecNotifyChar;
        }

        await initializeFecControl(controlPoint);
      } else {
        if (requireErg) {
          if (device.gatt.connected) device.gatt.disconnect();
          throw new Error('This device does not expose Fitness Machine or Tacx FEC control.');
        }

        const hasPower = await attachCyclingPower();
        if (!hasPower) {
          if (device.gatt.connected) device.gatt.disconnect();
          throw new Error('Selected device does not expose Fitness Machine, Tacx FEC, or Cycling Power services.');
        }
        capability = 'data';
        serviceType = 'cycling_power';
      }
    }

    setTrainerState({
      status: 'connected',
      device,
      controlPoint,
      dataChar,
      name: device.name || 'Smart Trainer',
      error: '',
      capability,
      serviceType
    });

    // Clear all metrics when trainer connects to prevent stale/simulated values
    // from affecting cadence-gated session timing.
    setLiveMetrics({
      power: null,
      cadence: null,
      speed: null,
      heartRate: externalHrRef.current != null ? externalHrRef.current : null,
      trainerSpeedKph: null,
      virtualSpeedKph: null,
      routeGradePct: 0,
      routeAltitudeM: 0
    });

    return { controlPoint, serviceType, capability };
  }, [handleBikeData, handleFecData, handlePowerData, handleTrainerDisconnect, initializeFecControl]);

  useEffect(() => {
    connectTrainerDeviceRef.current = connectTrainerDevice;
  }, [connectTrainerDevice]);

  const connectTrainer = useCallback(async (requireErg = false) => {
    if (!isBluetoothSupported) {
      setTrainerState((prev) => ({ ...prev, status: 'error', error: 'Web Bluetooth not supported in this browser.' }));
      return;
    }
    if (!isSecureContext) {
      setTrainerState((prev) => ({ ...prev, status: 'error', error: 'Bluetooth requires HTTPS or localhost.' }));
      return;
    }

    setTrainerState((prev) => ({ ...prev, status: 'connecting', error: '' }));
    manualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    reconnectResumeRef.current = false;

    try {
      const optionalServices = [
        'fitness_machine',
        'heart_rate',
        'cycling_power',
        'device_information',
        FEC_SERVICE_UUID
      ];
      const requestOptions = {
        acceptAllDevices: true,
        optionalServices
      };

      const device = await navigator.bluetooth.requestDevice(requestOptions);
      await connectTrainerDevice(device, { requireErg });
    } catch (error) {
      if (requireErg && error?.name === 'NotFoundError') {
        setTrainerState((prev) => ({
          ...prev,
          status: 'error',
          error: 'No ERG-capable trainers found. Ensure the trainer is in Bluetooth trainer-control mode and not connected elsewhere.'
        }));
        return;
      }
      setTrainerState((prev) => ({
        ...prev,
        status: 'error',
        error: error?.message || 'Unable to connect trainer.'
      }));
    }
  }, [
    connectTrainerDevice,
    isBluetoothSupported,
    isSecureContext
  ]);

  const disconnectTrainer = useCallback(() => {
    manualDisconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    reconnectResumeRef.current = false;
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (trainerState.device?.gatt?.connected) {
      trainerState.device.gatt.disconnect();
    } else {
      handleTrainerDisconnect();
    }
  }, [handleTrainerDisconnect, trainerState.device]);

  const connectHeartRate = useCallback(async () => {
    if (!isBluetoothSupported) {
      setHrState((prev) => ({ ...prev, status: 'error', error: 'Web Bluetooth not supported in this browser.' }));
      return;
    }
    if (!isSecureContext) {
      setHrState((prev) => ({ ...prev, status: 'error', error: 'Bluetooth requires HTTPS or localhost.' }));
      return;
    }

    setHrState((prev) => ({ ...prev, status: 'connecting', error: '' }));

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['heart_rate', 'device_information']
      });
      device.addEventListener('gattserverdisconnected', handleHrDisconnect);

      const server = await device.gatt.connect();
      let service;
      try {
        service = await server.getPrimaryService('heart_rate');
      } catch (serviceError) {
        if (device.gatt.connected) device.gatt.disconnect();
        setHrState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Selected device does not expose the Heart Rate service.'
        }));
        return;
      }

      const hrChar = await service.getCharacteristic('heart_rate_measurement');
      await hrChar.startNotifications();
      hrChar.addEventListener('characteristicvaluechanged', handleHrData);

      setHrState({
        status: 'connected',
        device,
        hrChar,
        name: device.name || 'Heart Rate Strap',
        error: ''
      });
    } catch (error) {
      setHrState((prev) => ({
        ...prev,
        status: 'error',
        error: error?.message || 'Unable to connect heart rate monitor.'
      }));
    }
  }, [handleHrData, handleHrDisconnect, isBluetoothSupported, isSecureContext]);

  const disconnectHeartRate = useCallback(() => {
    if (hrState.device?.gatt?.connected) {
      hrState.device.gatt.disconnect();
    } else {
      handleHrDisconnect();
    }
  }, [handleHrDisconnect, hrState.device]);

  const requestTrainerControl = useCallback(async () => {
    if (!trainerState.controlPoint || trainerState.serviceType !== 'fitness_machine') return;
    await trainerState.controlPoint.writeValue(buildControlCommand(0x00));
  }, [trainerState.controlPoint, trainerState.serviceType]);

  const startTrainer = useCallback(async () => {
    if (!trainerState.controlPoint || trainerState.serviceType !== 'fitness_machine') return;
    await trainerState.controlPoint.writeValue(buildControlCommand(0x07));
  }, [trainerState.controlPoint, trainerState.serviceType]);

  const stopTrainer = useCallback(async (pause = false) => {
    if (!trainerState.controlPoint || trainerState.serviceType !== 'fitness_machine') return;
    await trainerState.controlPoint.writeValue(buildStopCommand(pause));
  }, [trainerState.controlPoint, trainerState.serviceType]);

  const sendTargetPower = useCallback(async (watts) => {
    if (!trainerState.controlPoint) return;
    if (trainerState.serviceType === 'fec_over_ble') {
      const message = buildFecMessage(49, { power: watts });
      await trainerState.controlPoint.writeValue(message);
      return;
    }
    await trainerState.controlPoint.writeValue(buildTargetPowerCommand(watts));
  }, [trainerState.controlPoint, trainerState.serviceType]);

  const startSession = useCallback(async () => {
    sessionSamplesRef.current = [];
    sessionStartRef.current = Date.now();
    sessionFinalizedRef.current = false;
    autoPausedByCadenceRef.current = false;
    cadenceBelowThresholdTicksRef.current = 0;
    cadenceAboveThresholdTicksRef.current = 0;
    cadenceTransitionInFlightRef.current = false;
    setSessionSummary(null);
    setSessionName('');
    setSaveStatus('idle');
    setSessionState('running');
    setCurrentStepIndex(0);
    setStepElapsed(0);
    setTotalElapsed(0);
    distanceMetersRef.current = 0;
    physicsDistanceRef.current = 0;
    setLiveDistanceMeters(0);
    physicsEngineRef.current.reset(0);
    physicsTickRef.current = {
      timestampMs: Date.now(),
      speedKph: 0,
      grade: 0,
      altitude: 0
    };
    resetChartData();

    if (trainerState.status === 'connected' && trainerState.controlPoint) {
      try {
        await requestTrainerControl();
        await startTrainer();
        await sendTargetPower(workoutSteps[0]?.targetPower || 0);
      } catch (error) {
        setTrainerState((prev) => ({
          ...prev,
          error: 'Trainer control failed. Check FTMS or Tacx FEC support.'
        }));
      }
    }
  }, [
    requestTrainerControl,
    resetChartData,
    sendTargetPower,
    startTrainer,
    trainerState.controlPoint,
    trainerState.status,
    workoutSteps
  ]);

  const pauseSession = useCallback(async () => {
    setSessionState('paused');
    if (trainerState.status === 'connected' && trainerState.controlPoint) {
      try {
        if (trainerState.serviceType === 'fitness_machine') {
          await stopTrainer(true);
        } else if (trainerState.serviceType === 'fec_over_ble') {
          await sendTargetToControl(trainerState.controlPoint, trainerState.serviceType, 0);
        }
      } catch (error) {
        setTrainerState((prev) => ({ ...prev, error: 'Failed to pause trainer.' }));
      }
    }
  }, [
    sendTargetToControl,
    stopTrainer,
    trainerState.controlPoint,
    trainerState.serviceType,
    trainerState.status
  ]);

  const resumeSession = useCallback(async () => {
    setSessionState('running');
    if (trainerState.status === 'connected' && trainerState.controlPoint) {
      try {
        if (trainerState.serviceType === 'fitness_machine') {
          await requestTrainerControl();
          await startTrainer();
        } else if (trainerState.serviceType === 'fec_over_ble') {
          await sendTargetToControl(trainerState.controlPoint, trainerState.serviceType, currentStep?.targetPower || 0);
        }
      } catch (error) {
        setTrainerState((prev) => ({ ...prev, error: 'Failed to resume trainer.' }));
      }
    }
  }, [
    currentStep?.targetPower,
    requestTrainerControl,
    sendTargetToControl,
    startTrainer,
    trainerState.controlPoint,
    trainerState.serviceType,
    trainerState.status
  ]);

  const stopSession = useCallback(async () => {
    finalizeSession();
    autoPausedByCadenceRef.current = false;
    cadenceBelowThresholdTicksRef.current = 0;
    cadenceAboveThresholdTicksRef.current = 0;
    cadenceTransitionInFlightRef.current = false;
    setSessionState('idle');
    setCurrentStepIndex(0);
    setStepElapsed(0);
    setTotalElapsed(0);
    resetChartData();

    if (trainerState.status === 'connected' && trainerState.controlPoint) {
      try {
        if (trainerState.serviceType === 'fitness_machine') {
          await stopTrainer(false);
        } else if (trainerState.serviceType === 'fec_over_ble') {
          await sendTargetToControl(trainerState.controlPoint, trainerState.serviceType, 0);
        }
      } catch (error) {
        setTrainerState((prev) => ({ ...prev, error: 'Failed to stop trainer.' }));
      }
    }
  }, [
    resetChartData,
    sendTargetToControl,
    stopTrainer,
    trainerState.controlPoint,
    trainerState.serviceType,
    trainerState.status,
    finalizeSession
  ]);

  const virtualWorldCloseRef = useRef(null);
  const autoPausedByCadenceRef = useRef(false);
  const cadenceBelowThresholdTicksRef = useRef(0);
  const cadenceAboveThresholdTicksRef = useRef(0);
  const cadenceTransitionInFlightRef = useRef(false);
  const rampLowCadenceCountRef = useRef(0);
  const rampStopTriggeredRef = useRef(false);

  // Ramp-test safety rule: stop session when cadence stays below 40 rpm.
  useEffect(() => {
    const isRampTest = selectedWorkout?.workout_type === 'Ramp Test';
    if (sessionState !== 'running' || !isRampTest) {
      rampLowCadenceCountRef.current = 0;
      rampStopTriggeredRef.current = false;
      return;
    }

    const cadence = liveMetrics.cadence;
    if (!Number.isFinite(cadence) || cadence >= 40) {
      rampLowCadenceCountRef.current = 0;
      return;
    }

    rampLowCadenceCountRef.current += 1;
    if (rampLowCadenceCountRef.current < 3) {
      return;
    }

    if (rampStopTriggeredRef.current) {
      return;
    }
    rampStopTriggeredRef.current = true;
    notify('Ramp test stopped: cadence dropped below 40 rpm.', 'warning');
    stopSession();
  }, [liveMetrics.cadence, selectedWorkout?.workout_type, sessionState, stopSession]);

  useEffect(() => {
    const cadence = Number(liveMetrics.cadence);
    const isPedaling = Number.isFinite(cadence) && cadence > PEDALING_CADENCE_THRESHOLD_RPM;
    const isRampTest = selectedWorkout?.workout_type === 'Ramp Test';

    if (sessionState === 'running') {
      cadenceAboveThresholdTicksRef.current = 0;

      if (isRampTest) {
        cadenceBelowThresholdTicksRef.current = 0;
        autoPausedByCadenceRef.current = false;
        return;
      }

      if (isPedaling) {
        cadenceBelowThresholdTicksRef.current = 0;
        return;
      }

      cadenceBelowThresholdTicksRef.current += 1;
      if (
        cadenceBelowThresholdTicksRef.current < CADENCE_TRANSITION_CONFIRM_TICKS
        || cadenceTransitionInFlightRef.current
      ) {
        return;
      }

      cadenceTransitionInFlightRef.current = true;
      cadenceBelowThresholdTicksRef.current = 0;
      autoPausedByCadenceRef.current = true;
      notify(`Workout paused automatically: cadence below ${PEDALING_CADENCE_THRESHOLD_RPM} rpm.`, 'warning');
      pauseSession().finally(() => {
        cadenceTransitionInFlightRef.current = false;
      });
      return;
    }

    if (sessionState === 'paused' && autoPausedByCadenceRef.current) {
      cadenceBelowThresholdTicksRef.current = 0;
      if (!isPedaling) {
        cadenceAboveThresholdTicksRef.current = 0;
        return;
      }

      cadenceAboveThresholdTicksRef.current += 1;
      if (
        cadenceAboveThresholdTicksRef.current < CADENCE_TRANSITION_CONFIRM_TICKS
        || cadenceTransitionInFlightRef.current
      ) {
        return;
      }

      cadenceTransitionInFlightRef.current = true;
      cadenceAboveThresholdTicksRef.current = 0;
      autoPausedByCadenceRef.current = false;
      notify(`Workout resumed: cadence above ${PEDALING_CADENCE_THRESHOLD_RPM} rpm.`, 'success');
      resumeSession().finally(() => {
        cadenceTransitionInFlightRef.current = false;
      });
      return;
    }

    cadenceBelowThresholdTicksRef.current = 0;
    cadenceAboveThresholdTicksRef.current = 0;
    cadenceTransitionInFlightRef.current = false;
    if (sessionState === 'idle') {
      autoPausedByCadenceRef.current = false;
    }
  }, [liveMetrics.cadence, pauseSession, resumeSession, selectedWorkout?.workout_type, sessionState]);

  const handleVirtualWorldControl = useCallback(async (action) => {
    if (!action) return;
    switch (action) {
      case 'pause':
        if (sessionStateRef.current === 'running') {
          await pauseSession();
        }
        break;
      case 'resume':
        if (sessionStateRef.current === 'paused') {
          await resumeSession();
        }
        break;
      case 'stop':
        if (sessionStateRef.current !== 'idle') {
          await stopSession();
          virtualWorldCloseRef.current?.();
          navigateToSetup();
        }
        break;
      case 'setup':
        if (sessionStateRef.current !== 'idle') {
          await stopSession();
        }
        navigateToSetup();
        break;
      case 'start':
        if (sessionStateRef.current === 'idle') {
          await startSession();
          navigateToSession();
        }
        break;
      default:
        break;
    }
  }, [navigateToSession, navigateToSetup, pauseSession, resumeSession, startSession, stopSession]);

  const handleVirtualWorldRouteChange = useCallback((routeId) => {
    if (!routeId || typeof routeId !== 'string') return;
    const routeManager = physicsRouteManagerRef.current;
    const resolved = routeManager.resolveRouteId(routeId);
    if (resolved) {
      setActiveRouteId(resolved);
    }
  }, []);

  // Virtual World integration - use external HR when available
  const virtualWorldMetrics = useMemo(() => ({
    ...liveMetrics,
    speed: Number.isFinite(liveMetrics.virtualSpeedKph) ? liveMetrics.virtualSpeedKph : liveMetrics.speed,
    heartRate: Number.isFinite(externalHr) ? externalHr : liveMetrics.heartRate
  }), [liveMetrics, externalHr]);

  const virtualWorld = useVirtualWorld({
    liveMetrics: virtualWorldMetrics,
    sessionState,
    currentStep,
    workoutSteps,
    elapsed: totalElapsed,
    stepElapsed,
    stepRemaining: remainingStep,
    distance: liveDistanceMeters,
    routeId: activeRouteId,
    runtime: resolvedVirtualWorldRuntime,
    mode: 'erg',
    workoutSelected: Boolean(selectedWorkoutId),
    workoutName: selectedWorkout?.name || '',
    onControl: handleVirtualWorldControl,
    onRouteChange: handleVirtualWorldRouteChange
  });

  // Store close function in ref for use in handleVirtualWorldControl
  useEffect(() => {
    virtualWorldCloseRef.current = virtualWorld.close;
  }, [virtualWorld.close]);

  const notifyAnalyticsDataImported = useCallback(() => {
    try {
      eventBus.emit(EVENTS.DATA_IMPORTED, {
        source: 'live-training',
        at: new Date().toISOString()
      });
    } catch (error) {
      // Ignore event bus errors.
    }
  }, []);

  const handleSaveSession = useCallback(async () => {
    if (!sessionSummary) return;
    const trimmedName = sessionName.trim();
    if (!trimmedName) {
      notify('Please name the session before saving.', 'warning');
      return;
    }

    setSaveStatus('saving');
    try {
      let status = stravaStatus;
      if (stravaStatus?.loading) {
        status = await Services.api.getStravaStatus();
        setStravaStatus({ ...(status || {}), loading: false });
      }
      const payload = { ...sessionSummary, name: trimmedName };
      persistSession(payload, trimmedName);

      const savePayload = {
        name: trimmedName,
        startedAt: sessionSummary.startedAt,
        samples: sessionSummary.samples
      };

      let savedActivityId = null;
      let savedToDashboard = false;
      try {
        const saveResult = await Services.api.saveLiveSession(savePayload);
        savedActivityId = saveResult?.activity_id || null;
        savedToDashboard = true;
        if (savedActivityId) {
          payload.activityId = savedActivityId;
          persistSession(payload, trimmedName);
        }
      } catch (error) {
        if (isAuthError(error)) {
          try {
            localStorage.setItem('liveTraining:pendingUpload', JSON.stringify(payload));
            setPendingUpload(payload);
          } catch (storageError) {
            // Ignore localStorage errors.
          }
          setSaveStatus('auth');
          notify('You were logged out. Sign in again to finish saving and upload.', 'warning');
          return;
        }
        notify(error?.message || 'Failed to save to dashboard.', 'warning');
      }

      if (savedToDashboard) {
        notifyAnalyticsDataImported();
      }

      if (!status?.connected) {
        setSaveStatus('idle');
        notify('Session saved locally. Connect Strava in Settings to upload.', 'warning');
        return;
      }

      const uploadPayload = {
        name: trimmedName,
        startedAt: sessionSummary.startedAt,
        samples: sessionSummary.samples,
        activityId: savedActivityId || payload.activityId || null
      };
      try {
        await Services.api.uploadStravaSession(uploadPayload);
      } catch (error) {
        if (isAuthError(error)) {
          try {
            localStorage.setItem('liveTraining:pendingUpload', JSON.stringify(payload));
            setPendingUpload(payload);
          } catch (storageError) {
            // Ignore localStorage errors.
          }
          setSaveStatus('auth');
          notify('You were logged out. Sign in again to upload to Strava.', 'warning');
          return;
        }
        throw error;
      }
      try {
        localStorage.removeItem('liveTraining:pendingUpload');
      } catch (error) {
        // Ignore localStorage errors.
      }
      setPendingUpload(null);
      setSaveStatus('success');
      notify(
        savedActivityId
          ? `Session saved (activity #${savedActivityId}) and uploaded to Strava.`
          : 'Session saved and uploaded to Strava.',
        'success'
      );
      clearSessionRecap();
    } catch (error) {
      setSaveStatus('error');
      notify(error?.message || 'Failed to save session.', 'error');
    }
  }, [sessionName, sessionSummary, stravaStatus, isAuthError, persistSession, clearSessionRecap, notifyAnalyticsDataImported]);

  const retryPendingUpload = useCallback(async () => {
    if (!pendingUpload) return;
    setSaveStatus('saving');
    try {
      let status = await Services.api.getStravaStatus();
      setStravaStatus({ ...(status || {}), loading: false });

      const savePayload = {
        name: pendingUpload.name || pendingUpload.workoutName,
        startedAt: pendingUpload.startedAt,
        samples: pendingUpload.samples
      };

      let savedActivityId = pendingUpload.activityId || null;
      let savedToDashboard = Boolean(savedActivityId);
      if (!savedActivityId) {
        try {
          const saveResult = await Services.api.saveLiveSession(savePayload);
          savedActivityId = saveResult?.activity_id || null;
          savedToDashboard = true;
          if (savedActivityId) {
            const refreshedPayload = { ...pendingUpload, activityId: savedActivityId };
            try {
              localStorage.setItem('liveTraining:pendingUpload', JSON.stringify(refreshedPayload));
            } catch (storageError) {
              // Ignore localStorage errors.
            }
            setPendingUpload(refreshedPayload);
          }
        } catch (error) {
          if (isAuthError(error)) {
            setSaveStatus('auth');
            notify('Please sign in again to finish the upload.', 'warning');
            return;
          }
          notify(error?.message || 'Failed to save to dashboard.', 'warning');
        }
      }

      if (savedToDashboard) {
        notifyAnalyticsDataImported();
      }

      if (!status?.connected) {
        setSaveStatus('idle');
        notify('Session saved locally. Connect Strava in Settings to upload.', 'warning');
        return;
      }

      await Services.api.uploadStravaSession({
        ...savePayload,
        activityId: savedActivityId || null
      });
      try {
        localStorage.removeItem('liveTraining:pendingUpload');
      } catch (error) {
        // Ignore localStorage errors.
      }
      setPendingUpload(null);
      setSaveStatus('success');
      notify(
        savedActivityId
          ? `Session saved (activity #${savedActivityId}) and uploaded to Strava.`
          : 'Session saved and uploaded to Strava.',
        'success'
      );
      clearSessionRecap();
    } catch (error) {
      if (isAuthError(error)) {
        setSaveStatus('auth');
        notify('Please sign in again to finish the upload.', 'warning');
        return;
      }
      setSaveStatus('error');
      notify(error?.message || 'Failed to save session.', 'error');
    }
  }, [pendingUpload, isAuthError, clearSessionRecap, notifyAnalyticsDataImported]);

  useEffect(() => {
    if (sessionState !== 'running') return;

    const interval = setInterval(() => {
      const cadence = Number(liveMetricsRef.current?.cadence);
      const isCadenceActive = Number.isFinite(cadence) && cadence > PEDALING_CADENCE_THRESHOLD_RPM;
      if (!isCadenceActive) {
        return;
      }

      setStepElapsed((prev) => {
        const next = prev + 1;
        if (next >= stepDuration) {
          if (currentStepIndex < workoutSteps.length - 1) {
            setCurrentStepIndex((idx) => idx + 1);
            return 0;
          }
          setSessionState('idle');
          return stepDuration;
        }
        return next;
      });
      setTotalElapsed((prev) => prev + 1);

      recordSessionSample();
    }, 1000);

    return () => clearInterval(interval);
  }, [
    currentStepIndex,
    sessionState,
    stepDuration,
    trainerState.status,
    workoutSteps.length,
    recordSessionSample
  ]);

  useEffect(() => {
    if (sessionState !== 'running') return;
    if (trainerState.status !== 'connected' || !trainerState.controlPoint) return;

    const sendStepTarget = async () => {
      try {
        await requestTrainerControl();
        await sendTargetPower(currentStep?.targetPower || 0);
      } catch (error) {
        setTrainerState((prev) => ({ ...prev, error: 'Failed to update target power.' }));
      }
    };

    sendStepTarget();
  }, [currentStep?.targetPower, requestTrainerControl, sendTargetPower, sessionState, trainerState.controlPoint, trainerState.status]);

  useEffect(() => {
    if (sessionState !== 'running') return;
    if (trainerState.status !== 'connected' || !trainerState.controlPoint) return;
    if (trainerState.serviceType === 'cycling_power') return;

    const keepalive = async () => {
      try {
        await sendTargetToControl(
          trainerState.controlPoint,
          trainerState.serviceType,
          targetPowerRef.current
        );
      } catch (error) {
        // Ignore transient keepalive failures.
      }
    };

    keepaliveTimerRef.current = window.setInterval(keepalive, 5000);
    return () => {
      if (keepaliveTimerRef.current) {
        window.clearInterval(keepaliveTimerRef.current);
        keepaliveTimerRef.current = null;
      }
    };
  }, [
    sendTargetToControl,
    sessionState,
    trainerState.controlPoint,
    trainerState.serviceType,
    trainerState.status
  ]);

  useEffect(() => {
    const power = liveMetrics.power;
    const hrValue = Number.isFinite(externalHr) ? externalHr : liveMetrics.heartRate;
    const hasSignal = Number.isFinite(power) || Number.isFinite(hrValue);
    const hasDevice = trainerState.status === 'connected' || hrState.status === 'connected';
    if (!hasSignal || !hasDevice) return;

    const now = Date.now();
    if (now - lastSampleRef.current < 1000) return;
    lastSampleRef.current = now;

    if (!chartStartRef.current) {
      chartStartRef.current = now;
    }

    const elapsedSeconds = Math.max(0, Math.round((now - chartStartRef.current) / 1000));
    const label = formatDuration(elapsedSeconds);
    const chartData = chartDataRef.current;

    chartData.labels.push(label);
    chartData.power.push(Number.isFinite(power) ? power : null);
    chartData.heartRate.push(Number.isFinite(hrValue) ? hrValue : null);

    if (chartData.labels.length > MAX_CHART_POINTS) {
      chartData.labels.shift();
      chartData.power.shift();
      chartData.heartRate.shift();
    }

    if (chartRef.current) {
      chartRef.current.update('none');
    }
  }, [
    externalHr,
    hrState.status,
    liveMetrics.heartRate,
    liveMetrics.power,
    sessionState,
    trainerState.status
  ]);

  const previousSessionRef = useRef(sessionState);

  useEffect(() => {
    if (previousSessionRef.current !== 'idle' && sessionState === 'idle') {
      finalizeSession();
      navigateToSetup();
    }
    if (
      previousSessionRef.current === 'running'
      && sessionState === 'idle'
      && trainerState.status === 'connected'
      && trainerState.controlPoint
      && totalElapsed >= totalDuration
    ) {
      if (trainerState.serviceType === 'fitness_machine') {
        stopTrainer(false).catch(() => {});
      } else if (trainerState.serviceType === 'fec_over_ble') {
        sendTargetToControl(trainerState.controlPoint, trainerState.serviceType, 0).catch(() => {});
      }
    }
    previousSessionRef.current = sessionState;
  }, [
    finalizeSession,
    navigateToSetup,
    sendTargetToControl,
    sessionState,
    stopTrainer,
    totalElapsed,
    totalDuration,
    trainerState.controlPoint,
    trainerState.serviceType,
    trainerState.status
  ]);

  const trainerConnected = trainerState.status === 'connected';
  const trainerConnecting = trainerState.status === 'connecting' || trainerState.status === 'reconnecting';
  const trainerControlAvailable = trainerConnected && !!trainerState.controlPoint;
  const trainerControlLabel = trainerControlAvailable
    ? (trainerState.serviceType === 'fec_over_ble'
      ? 'Control (FEC)'
      : trainerState.serviceType === 'fitness_machine'
        ? 'Control (FTMS)'
        : 'Control')
    : 'Power data';
  const trainerStatusText = trainerConnected
    ? `Connected: ${trainerState.name} (${trainerControlLabel})`
    : trainerConnecting
      ? (trainerState.status === 'reconnecting' ? 'Reconnecting...' : 'Connecting...')
      : 'Not connected';
  const trainerShowDisconnect = trainerConnected || trainerConnecting;
  const hrConnected = hrState.status === 'connected';
  const displayedHr = Number.isFinite(externalHr) ? externalHr : liveMetrics.heartRate;
  const isDeviceActive = trainerConnected || hrConnected;
  const stravaConnected = Boolean(stravaStatus?.connected);
  const stravaLabel = stravaStatus?.loading
    ? 'checking'
    : stravaConnected
      ? 'connected'
      : 'not connected';
  const sessionLabel = sessionState === 'running'
    ? 'Running'
    : sessionState === 'paused'
      ? 'Paused'
      : 'Idle';
  const saveLabel = saveStatus === 'saving'
    ? 'Saving...'
    : saveStatus === 'auth'
      ? 'Sign in to finish'
    : saveStatus === 'success'
      ? 'Saved'
      : 'Save & upload to Strava';
  const powerDelta = Number.isFinite(liveMetrics.power) && Number.isFinite(currentStep?.targetPower)
    ? Math.round(liveMetrics.power - currentStep.targetPower)
    : null;
  const powerDeltaLabel = powerDelta === null
    ? null
    : `${powerDelta > 0 ? '+' : ''}${powerDelta} W`;

  const handleStartSession = async () => {
    await startSession();
    navigateToSession();
  };

  const handleExitSession = () => {
    navigateToSetup();
  };

  return (
    <div className={`live-training ${isSessionView ? 'live-training--session' : 'live-training--setup'}`}>
      {isSessionView ? (
        <header className="page-header lt-hero lt-hero--session">
          <div>
            <p className="lt-eyebrow">Live session</p>
            <h1 className="page-title">Workout in progress</h1>
            <p className="page-description">
              Keep your focus on the current block. Your trainer is being paced in ERG mode.
            </p>
            <div className="page-header__meta">
              <span className="page-pill page-pill--accent">{sessionLabel}</span>
              <span className="page-pill">Elapsed {formatDuration(totalElapsed)}</span>
              <span className="page-pill">Target {formatMetric(currentStep?.targetPower, { suffix: ' W' })}</span>
              <span className="page-pill page-pill--muted">{trainerStatusText}</span>
            </div>
          </div>
          <div className="page-header__actions lt-hero-actions">
            <button className="btn btn--secondary" type="button" onClick={handleExitSession}>
              Back to setup
            </button>
          </div>
        </header>
      ) : (
        <header className="page-header lt-hero">
          <div>
            <p className="lt-eyebrow">Live training studio</p>
            <h1 className="page-title">Live Training</h1>
            <p className="page-description">
              Connect your smart trainer and heart rate monitor, then run a guided workout with live power targets.
            </p>
            <div className="page-header__meta">
              <span className="page-pill page-pill--accent">Bluetooth FTMS / Tacx FEC</span>
              <span className="page-pill">Chrome Desktop</span>
              <span className="page-pill page-pill--muted">Workout library linked</span>
            </div>
          </div>
          <div className="page-header__actions lt-hero-actions">
            <button className="btn btn--secondary" type="button" onClick={stopSession} disabled={sessionState === 'idle'}>
              <RefreshCw size={16} />
              Reset
            </button>
          </div>
        </header>
      )}

      {!isChrome && (
        <div className="lt-alert lt-alert--warning">
          This prototype is tuned for Chrome Desktop. Other browsers may not support Web Bluetooth yet.
        </div>
      )}
      {!isBluetoothSupported && (
        <div className="lt-alert lt-alert--warning">
          Web Bluetooth is not available. Please use Chrome on desktop with HTTPS or localhost.
        </div>
      )}
      {isBluetoothSupported && !isSecureContext && (
        <div className="lt-alert lt-alert--warning">
          Bluetooth requires HTTPS (or localhost). Launch the dashboard from a secure origin.
        </div>
      )}

      {!isSessionView && (
        <>
          {sessionSummary && (
            <section className="lt-section lt-section--summary">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Session recap</h2>
                  <p className="section-subtitle">Review your averages, power bests, and upload the ride.</p>
                </div>
              </div>

              <div className="lt-session-summary">
                <div className="lt-session-summary__head">
                  <div>
                    <div className="lt-label">Session name</div>
                    <input
                      className="form-input"
                      type="text"
                      value={sessionName}
                      onChange={(event) => setSessionName(event.target.value)}
                      placeholder="Evening ERG session"
                    />
                  </div>
                  <div className="lt-session-summary__meta">
                    <div>
                      <div className="lt-label">Duration</div>
                      <div className="lt-value">{formatDuration(sessionSummary.durationSec)}</div>
                    </div>
                    <div>
                      <div className="lt-label">Workout</div>
                      <div className="lt-value">{sessionSummary.workoutName}</div>
                    </div>
                  </div>
                </div>

                <div className="lt-session-summary__grid">
                  <div className="lt-session-summary__metric">
                    <div className="lt-session-summary__label">Avg power</div>
                    <div className="lt-session-summary__value">
                      {formatMetric(sessionSummary.avgPower, { suffix: ' W' })}
                    </div>
                  </div>
                  <div className="lt-session-summary__metric">
                    <div className="lt-session-summary__label">Normalized power</div>
                    <div className="lt-session-summary__value">
                      {formatMetric(sessionSummary.normalizedPower, { suffix: ' W' })}
                    </div>
                  </div>
                  <div className="lt-session-summary__metric">
                    <div className="lt-session-summary__label">Avg heart rate</div>
                    <div className="lt-session-summary__value">
                      {formatMetric(sessionSummary.avgHeartRate, { suffix: ' bpm' })}
                    </div>
                  </div>
                  <div className="lt-session-summary__metric">
                    <div className="lt-session-summary__label">Avg cadence</div>
                    <div className="lt-session-summary__value">
                      {formatMetric(sessionSummary.avgCadence, { suffix: ' rpm' })}
                    </div>
                  </div>
                  <div className="lt-session-summary__metric">
                    <div className="lt-session-summary__label">Avg speed</div>
                    <div className="lt-session-summary__value">
                      {formatMetric(sessionSummary.avgSpeed, { suffix: ' kph', decimals: 1 })}
                    </div>
                  </div>
                  <div className="lt-session-summary__metric">
                    <div className="lt-session-summary__label">Distance</div>
                    <div className="lt-session-summary__value">
                      {formatMetric(
                        Number.isFinite(sessionSummary.distanceMeters)
                          ? sessionSummary.distanceMeters / 1000
                          : null,
                        { suffix: ' km', decimals: 2 }
                      )}
                    </div>
                  </div>
                  <div className="lt-session-summary__metric">
                    <div className="lt-session-summary__label">Max power</div>
                    <div className="lt-session-summary__value">
                      {formatMetric(sessionSummary.maxPower, { suffix: ' W' })}
                    </div>
                  </div>
                </div>

                <div className="lt-session-summary__bests">
                  <div className="lt-label">Power bests</div>
                  <div className="lt-session-summary__bests-grid">
                    <div>
                      <div className="lt-session-summary__label">5s</div>
                      <div className="lt-session-summary__value">
                        {formatMetric(sessionSummary.bests?.best5s, { suffix: ' W' })}
                      </div>
                    </div>
                    <div>
                      <div className="lt-session-summary__label">1m</div>
                      <div className="lt-session-summary__value">
                        {formatMetric(sessionSummary.bests?.best1m, { suffix: ' W' })}
                      </div>
                    </div>
                    <div>
                      <div className="lt-session-summary__label">5m</div>
                      <div className="lt-session-summary__value">
                        {formatMetric(sessionSummary.bests?.best5m, { suffix: ' W' })}
                      </div>
                    </div>
                    <div>
                      <div className="lt-session-summary__label">20m</div>
                      <div className="lt-session-summary__value">
                        {formatMetric(sessionSummary.bests?.best20m, { suffix: ' W' })}
                      </div>
                    </div>
                  </div>
                </div>

                  <div className="lt-session-summary__actions">
                    <button
                      className="btn btn--primary"
                      type="button"
                      onClick={handleSaveSession}
                      disabled={saveStatus === 'saving' || !sessionName.trim()}
                    >
                      {saveLabel}
                    </button>
                    {pendingUpload && (
                      <button
                        className="btn btn--secondary"
                        type="button"
                        onClick={retryPendingUpload}
                        disabled={saveStatus === 'saving'}
                      >
                        Resume upload
                      </button>
                    )}
                    <div className="lt-session-summary__status">
                      <span className={`lt-status lt-status--${stravaConnected ? 'on' : 'off'}`}>
                      Strava {stravaLabel}
                      </span>
                      {!stravaConnected && (
                        <span className="lt-hint">Connect Strava in Settings before uploading.</span>
                      )}
                    </div>
                </div>
              </div>
            </section>
          )}

          <section className="lt-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Connections</h2>
                <p className="section-subtitle">Pair devices and keep data streaming.</p>
              </div>
            </div>

            <div className="lt-device-grid">
              <div className="lt-device">
                <div className="lt-device__icon">
                  <Bluetooth size={22} />
                </div>
                <div className="lt-device__content">
                  <div className="lt-device__title">Smart Trainer</div>
                  <div className="lt-device__meta">ERG control via Fitness Machine (FTMS) or Tacx FEC over BLE.</div>
                  <div className={`lt-status lt-status--${trainerConnected ? 'on' : 'off'}`}>
                    {trainerStatusText}
                  </div>
                  {trainerState.error && <p className="lt-error">{trainerState.error}</p>}
                </div>
                <div className="lt-device__actions">
                  {trainerShowDisconnect ? (
                    <button className="btn btn--secondary" type="button" onClick={disconnectTrainer}>
                      {trainerConnecting ? 'Cancel' : 'Disconnect'}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn--primary"
                        type="button"
                        onClick={() => connectTrainer(true)}
                        disabled={!isBluetoothSupported || trainerConnecting}
                      >
                        Connect (ERG)
                      </button>
                      <button
                        className="btn btn--secondary"
                        type="button"
                        onClick={() => connectTrainer(false)}
                        disabled={!isBluetoothSupported || trainerConnecting}
                      >
                        Power only
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="lt-device">
                <div className="lt-device__icon">
                  <HeartPulse size={22} />
                </div>
                <div className="lt-device__content">
                  <div className="lt-device__title">Heart Rate</div>
                  <div className="lt-device__meta">Bluetooth HRM profile</div>
                  <div className={`lt-status lt-status--${hrConnected ? 'on' : 'off'}`}>
                    {hrConnected ? `Connected: ${hrState.name}` : 'Not connected'}
                  </div>
                  {hrState.error && <p className="lt-error">{hrState.error}</p>}
                </div>
                <div className="lt-device__actions">
                  {hrConnected ? (
                    <button className="btn btn--secondary" type="button" onClick={disconnectHeartRate}>
                      Disconnect
                    </button>
                  ) : (
                    <button className="btn btn--primary" type="button" onClick={connectHeartRate} disabled={!isBluetoothSupported}>
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="lt-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Workout Control</h2>
                <p className="section-subtitle">Select a workout from your library or run the starter session.</p>
              </div>
            </div>

            <div className="lt-workout">
              <div className="lt-workout__summary">
                <div className="lt-workout__selector">
                  <div className="lt-label">Workout library</div>
                  <select
                    className="form-select"
                    value={selectedWorkoutId}
                    onChange={(event) => setSelectedWorkoutId(event.target.value)}
                    disabled={sessionState !== 'idle' || workoutsLoading}
                  >
                    <option value="">Starter session (demo)</option>
                    {sortedWorkouts.map((workout) => (
                      <option key={workout.id} value={workout.id}>
                        {workout.name || `Workout ${workout.id}`}{workout.workout_type ? ` (${workout.workout_type})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="lt-workout__hint">
                    {workoutsLoading && <span>Loading workouts…</span>}
                    {!workoutsLoading && workoutsError && <span className="lt-error">{workoutsError}</span>}
                    {!workoutsLoading && !workoutsError && (
                      <span>FTP target: {formatMetric(userFtp, { suffix: ' W' })}</span>
                    )}
                  </div>
                </div>
                <div className="lt-workout__selector">
                  <div className="lt-label">Route</div>
                  <select
                    className="form-select"
                    value={activeRouteId}
                    onChange={(event) => setActiveRouteId(event.target.value)}
                    disabled={sessionState !== 'idle'}
                  >
                    {routeOptions.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name}
                      </option>
                    ))}
                  </select>
                  <div className="lt-workout__hint">
                    <span>Route drives gradient, altitude, and minimap profile.</span>
                  </div>
                </div>
                <div className="lt-workout__selector">
                  <div className="lt-label">World runtime</div>
                  <select
                    className="form-select"
                    value={virtualWorldRuntimePreference}
                    onChange={(event) => setVirtualWorldRuntimePreference(event.target.value === 'unity' ? 'unity' : 'three')}
                    disabled={sessionState !== 'idle' || !unityRuntimeAvailable || UNITY_ONLY_MODE}
                  >
                    {!UNITY_ONLY_MODE && <option value="three">Three.js (stable)</option>}
                    {unityRuntimeAvailable && (
                      <option value="unity">Unity WebGL (beta)</option>
                    )}
                  </select>
                  <div className="lt-workout__hint">
                    {!unityRuntimeAvailable && (
                      <span>Unity runtime is disabled. Set `__VW_FLAGS.unityRuntimeEnabled = true`.</span>
                    )}
                    {unityRuntimeAvailable && UNITY_ONLY_MODE && (
                      <span>Unity-only mode is enabled for Virtual World.</span>
                    )}
                    {unityRuntimeAvailable && !UNITY_ONLY_MODE && virtualWorldRuntimePreference === 'unity' && !unityRouteAllowed && (
                      <span>Unity is scoped to {runtimeScopeLabel}. Current route uses Three.js.</span>
                    )}
                    {unityRuntimeAvailable && (!UNITY_ONLY_MODE && (virtualWorldRuntimePreference !== 'unity' || unityRouteAllowed)) && (
                      <span>Active runtime: {virtualWorld.activeRuntime === 'unity' ? 'Unity WebGL' : 'Three.js'}.</span>
                    )}
                    {unityRuntimeAvailable && UNITY_ONLY_MODE && (
                      <span>Active runtime: Unity WebGL.</span>
                    )}
                  </div>
                </div>
                <div className="lt-workout__row">
                  <Zap size={18} />
                  <div>
                    <div className="lt-label">Target power</div>
                    <div className="lt-value">{formatMetric(currentStep?.targetPower, { suffix: ' W' })}</div>
                  </div>
                </div>
                <div className="lt-workout__row">
                  <Timer size={18} />
                  <div>
                    <div className="lt-label">Step time</div>
                    <div className="lt-value">{formatDuration(stepElapsed)} / {formatDuration(stepDuration)}</div>
                  </div>
                </div>
                <div className="lt-workout__row">
                  <Gauge size={18} />
                  <div>
                    <div className="lt-label">Next block</div>
                    <div className="lt-value">
                      {nextStep
                        ? `${nextStep.label} · ${formatMetric(nextStep.targetPower, { suffix: ' W' })}`
                        : 'Finish'}
                    </div>
                  </div>
                </div>
                <div className="lt-workout__row">
                  <Gauge size={18} />
                  <div>
                    <div className="lt-label">Session</div>
                    <div className="lt-value">{sessionLabel}</div>
                  </div>
                </div>
                <div className="lt-progress">
                  <div className="lt-progress__bar" style={{ width: `${stepProgress * 100}%` }}></div>
                </div>
                <div className="lt-progress lt-progress--total">
                  <div className="lt-progress__bar" style={{ width: `${totalProgress * 100}%` }}></div>
                </div>
                <div className="lt-workout__foot">
                  <span>
                    {selectedWorkout?.name ? `Workout: ${selectedWorkout.name}` : 'Starter session'}
                  </span>
                  <span>Total: {formatDuration(totalDuration)}</span>
                </div>
              </div>

              <div className="lt-workout__steps">
                {workoutSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`lt-step${index === currentStepIndex ? ' lt-step--active' : ''}`}
                  >
                    <div>
                      <div className="lt-step__title">{step.label}</div>
                      <div className="lt-step__meta">
                        {formatDuration(step.durationSec)} · {step.targetPower} W
                      </div>
                    </div>
                    <span className="lt-step__zone">{step.zone || '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lt-controls">
              {sessionState === 'idle' && (
                <button className="btn btn--primary" type="button" onClick={handleStartSession}>
                  <Play size={16} />
                  Start session
                </button>
              )}
              {sessionState === 'running' && (
                <button className="btn btn--secondary" type="button" onClick={pauseSession}>
                  <Pause size={16} />
                  Pause
                </button>
              )}
              {sessionState === 'paused' && (
                <button className="btn btn--primary" type="button" onClick={resumeSession}>
                  <Play size={16} />
                  Resume
                </button>
              )}
              {(sessionState === 'running' || sessionState === 'paused') && (
                <button className="btn btn--secondary" type="button" onClick={stopSession}>
                  <Square size={16} />
                  Stop
                </button>
              )}
              <button
                className={`btn ${virtualWorld.isOpen ? 'btn--accent' : 'btn--secondary'}`}
                type="button"
                onClick={virtualWorld.toggle}
                disabled={virtualWorld.isLaunching}
                title={virtualWorld.isOpen
                  ? `Virtual World is open (${virtualWorld.activeRuntime === 'unity' ? 'Unity WebGL' : 'Three.js'})`
                  : `Launch 3D Virtual World (${resolvedVirtualWorldRuntime === 'unity' ? 'Unity WebGL' : 'Three.js'})`}
              >
                <Globe size={16} />
                {virtualWorld.isLaunching
                  ? 'Opening...'
                  : `Virtual World (${(UNITY_ONLY_MODE || virtualWorld.activeRuntime === 'unity') ? 'Unity' : 'Three'})`}
              </button>
                <span className="lt-hint">
                  {trainerConnected
                    ? (trainerControlAvailable ? 'Trainer control active' : 'Trainer connected (power data only)')
                    : 'Demo mode until trainer connects'}
                  {virtualWorld.launchReason === 'unity-timeout'
                    && (UNITY_ONLY_MODE
                      ? ' · Unity startup timed out.'
                      : ' · Unity timed out, auto-fallback to Three.js.')}
                  {(typeof virtualWorld.launchReason === 'string' && virtualWorld.launchReason.startsWith('unity-failed:'))
                    && ` · Unity startup failed: ${virtualWorld.launchReason.slice('unity-failed:'.length)}`}
                </span>
              </div>
          </section>
        </>
      )}

      {isSessionView && (
        <>
          <div className="lt-session-stage">
            <div className="lt-session-stage__main">
              <div className="lt-chart lt-chart--session">
                <div className="lt-chart__header">
                  <div>
                    <h2 className="lt-chart__title">Live power + heart rate</h2>
                    <p className="lt-chart__subtitle">Stable 1 Hz stream for clean pacing feedback.</p>
                  </div>
                  <div className="lt-chart__meta">
                    <span className="lt-chart__pill">Target {formatMetric(currentStep?.targetPower, { suffix: ' W' })}</span>
                    <span className="lt-chart__pill">Block {currentStep?.label || 'Warm up'}</span>
                    <span className="lt-chart__pill">Elapsed {formatDuration(totalElapsed)}</span>
                    <span className="lt-chart__pill">
                      Remaining {formatDuration(Math.max(0, totalDuration - totalElapsed))}
                    </span>
                  </div>
                </div>
                <div className="lt-chart__body">
                  <canvas ref={chartCanvasRef} className="lt-chart__canvas"></canvas>
                  {!isDeviceActive && (
                    <div className="lt-chart__empty">
                      Connect your trainer or HRM to see live curves.
                    </div>
                  )}
                </div>
              </div>

              <div className="lt-session-metrics">
                <div className="lt-session-metrics__primary">
                  <div className="lt-session-metrics__label">Power</div>
                  <div className="lt-session-metrics__value">
                    {formatMetric(liveMetrics.power, { suffix: ' W' })}
                  </div>
                  <div className="lt-session-metrics__meta">
                    Target {formatMetric(currentStep?.targetPower, { suffix: ' W' })}
                    {powerDeltaLabel && <span className="lt-session-metrics__delta">Δ {powerDeltaLabel}</span>}
                  </div>
                </div>
                <div className="lt-session-metrics__grid">
                  <div className="lt-session-metrics__tile">
                    <div className="lt-session-metrics__label">Heart rate</div>
                    <div className="lt-session-metrics__value">{formatMetric(displayedHr, { suffix: ' bpm' })}</div>
                    <div className="lt-session-metrics__meta">{hrConnected ? 'HRM connected' : 'Trainer data'}</div>
                  </div>
                  <div className="lt-session-metrics__tile">
                    <div className="lt-session-metrics__label">Cadence</div>
                    <div className="lt-session-metrics__value">{formatMetric(liveMetrics.cadence, { suffix: ' rpm' })}</div>
                    <div className="lt-session-metrics__meta">Smooth rhythm</div>
                  </div>
                  <div className="lt-session-metrics__tile">
                    <div className="lt-session-metrics__label">Speed</div>
                    <div className="lt-session-metrics__value">
                      {formatMetric(liveMetrics.speed, { suffix: ' kph', decimals: 1 })}
                    </div>
                    <div className="lt-session-metrics__meta">Virtual wheel</div>
                  </div>
                  <div className="lt-session-metrics__tile">
                    <div className="lt-session-metrics__label">Distance</div>
                    <div className="lt-session-metrics__value">
                      {formatMetric(
                        Number.isFinite(liveDistanceMeters) ? liveDistanceMeters / 1000 : null,
                        { suffix: ' km', decimals: 2 }
                      )}
                    </div>
                    <div className="lt-session-metrics__meta">Virtual distance</div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="lt-session-stage__side">
              <div className="lt-session-card">
                <div className="lt-session-card__label">Current block</div>
                <div className="lt-session-card__value">{currentStep?.label || 'Warm up'}</div>
                <div className="lt-session-card__meta">
                  {formatDuration(remainingStep)} left · {formatDuration(stepDuration)}
                </div>
                <div className="lt-progress">
                  <div className="lt-progress__bar" style={{ width: `${stepProgress * 100}%` }}></div>
                </div>
              </div>

              <div className="lt-session-card">
                <div className="lt-session-card__label">Next block</div>
                <div className="lt-session-card__value">{nextStep ? nextStep.label : 'Finish'}</div>
                <div className="lt-session-card__meta">
                  {nextStep ? formatMetric(nextStep.targetPower, { suffix: ' W' }) : '—'}
                </div>
              </div>

              <div className="lt-session-card lt-session-card--compact">
                <div className="lt-session-card__label">Session status</div>
                <div className="lt-session-card__value">{sessionLabel}</div>
                <div className="lt-session-card__meta">
                  Elapsed {formatDuration(totalElapsed)} · Remaining {formatDuration(Math.max(0, totalDuration - totalElapsed))}
                </div>
                <div className="lt-progress lt-progress--total">
                  <div className="lt-progress__bar" style={{ width: `${totalProgress * 100}%` }}></div>
                </div>
              </div>

              <div className="lt-controls lt-controls--session">
                {sessionState === 'idle' && (
                  <button className="btn btn--primary" type="button" onClick={handleStartSession}>
                    <Play size={16} />
                    Start session
                  </button>
                )}
                {sessionState === 'running' && (
                  <button className="btn btn--secondary" type="button" onClick={pauseSession}>
                    <Pause size={16} />
                    Pause
                  </button>
                )}
                {sessionState === 'paused' && (
                  <button className="btn btn--primary" type="button" onClick={resumeSession}>
                    <Play size={16} />
                    Resume
                  </button>
                )}
                {(sessionState === 'running' || sessionState === 'paused') && (
                  <button className="btn btn--secondary" type="button" onClick={stopSession}>
                    <Square size={16} />
                    Stop
                  </button>
                )}
                <button
                  className={`btn ${virtualWorld.isOpen ? 'btn--accent' : 'btn--secondary'}`}
                  type="button"
                  onClick={virtualWorld.toggle}
                  disabled={virtualWorld.isLaunching}
                  title={virtualWorld.isOpen
                    ? `Virtual World is open (${virtualWorld.activeRuntime === 'unity' ? 'Unity WebGL' : 'Three.js'})`
                    : `Launch 3D Virtual World (${resolvedVirtualWorldRuntime === 'unity' ? 'Unity WebGL' : 'Three.js'})`}
                >
                  <Globe size={16} />
                  {virtualWorld.isLaunching
                    ? 'Opening...'
                    : `Virtual World (${(UNITY_ONLY_MODE || virtualWorld.activeRuntime === 'unity') ? 'Unity' : 'Three'})`}
                </button>
              </div>
              <div className="lt-session-hint">
                {trainerConnected
                  ? (trainerControlAvailable ? 'Trainer control active' : 'Trainer connected (power data only)')
                  : 'Demo mode until trainer connects'}
                {` · Runtime: ${(UNITY_ONLY_MODE || virtualWorld.activeRuntime === 'unity') ? 'Unity WebGL' : 'Three.js'}`}
                {virtualWorld.launchReason === 'unity-timeout'
                  && (UNITY_ONLY_MODE
                    ? ' · Unity startup timed out.'
                    : ' · Unity timed out, auto-fallback active.')}
                {(typeof virtualWorld.launchReason === 'string' && virtualWorld.launchReason.startsWith('unity-failed:'))
                  && ` · Unity startup failed: ${virtualWorld.launchReason.slice('unity-failed:'.length)}`}
              </div>
            </aside>
          </div>

          <section className="lt-session-timeline">
            <div className="lt-session-timeline__header">
              <div>
                <h2 className="section-title">Workout timeline</h2>
                <p className="section-subtitle">Upcoming blocks and pacing targets.</p>
              </div>
            </div>
            <div className="lt-workout__steps lt-workout__steps--session">
              {workoutSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`lt-step${index === currentStepIndex ? ' lt-step--active' : ''}`}
                >
                  <div>
                    <div className="lt-step__title">{step.label}</div>
                    <div className="lt-step__meta">
                      {formatDuration(step.durationSec)} · {step.targetPower} W
                    </div>
                  </div>
                  <span className="lt-step__zone">{step.zone || '—'}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default LiveTrainingApp;
