import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getVirtualWorldLauncher, normalizeRuntime } from './launcher.js';

const SEND_INTERVAL_MS = 100;

export const useVirtualWorld = ({
  liveMetrics = {},
  sessionState = 'idle',
  currentStep = null,
  workoutSteps = [],
  workoutSelected = false,
  workoutName = '',
  elapsed = 0,
  stepElapsed = 0,
  stepRemaining = 0,
  distance = 0,
  routeId = 'route-valley',
  runtime = 'unity',
  presentation = 'popup',
  containerSelector = null,
  mode = 'erg',
  onControl = null,
  onRouteChange = null
} = {}) => {
  const launcherRef = useRef(null);
  const lastSendRef = useRef(0);
  const previousSessionStateRef = useRef('idle');
  const onControlRef = useRef(onControl);
  const onRouteChangeRef = useRef(onRouteChange);

  const [isOpen, setIsOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [activeRuntime, setActiveRuntime] = useState('three');
  const [launchReason, setLaunchReason] = useState('idle');

  const syncLauncherState = useCallback(() => {
    const launcher = launcherRef.current;
    if (!launcher) return;

    setIsOpen(launcher.isWindowOpen());
    setActiveRuntime(launcher.activeRuntime || 'three');
    setLaunchReason(launcher.lastLaunchReason || 'idle');
  }, []);

  useEffect(() => {
    launcherRef.current = getVirtualWorldLauncher();
    syncLauncherState();
  }, [syncLauncherState]);

  useEffect(() => {
    onControlRef.current = onControl;
  }, [onControl]);

  useEffect(() => {
    onRouteChangeRef.current = onRouteChange;
  }, [onRouteChange]);

  useEffect(() => {
    const launcher = launcherRef.current;
    if (!launcher) return;

    launcher.setControlHandler((action, details) => {
      if (typeof onControlRef.current === 'function') {
        onControlRef.current(action, details);
      }
    });

    launcher.setRouteChangeHandler((nextRouteId) => {
      if (!nextRouteId || typeof nextRouteId !== 'string') return;
      if (typeof onRouteChangeRef.current === 'function') {
        onRouteChangeRef.current(nextRouteId);
      }
    });

    return () => {
      launcher.setControlHandler(null);
      launcher.setRouteChangeHandler(null);
    };
  }, []);

  const launch = useCallback(async () => {
    const launcher = launcherRef.current;
    if (!launcher || isLaunching) return false;

    setIsLaunching(true);
    try {
      const result = await launcher.open({
        runtime: normalizeRuntime(runtime),
        routeId,
        presentation,
        containerSelector,
        allowFallback: true
      });

      syncLauncherState();
      return Boolean(result?.opened);
    } finally {
      setIsLaunching(false);
    }
  }, [containerSelector, isLaunching, presentation, routeId, runtime, syncLauncherState]);

  const close = useCallback(() => {
    const launcher = launcherRef.current;
    if (!launcher) return;

    launcher.close();
    syncLauncherState();
  }, [syncLauncherState]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
      return;
    }
    void launch();
  }, [close, isOpen, launch]);

  useEffect(() => {
    const launcher = launcherRef.current;
    if (!launcher || !isOpen || !routeId) return;
    launcher.sendRouteChange(routeId);
  }, [isOpen, routeId]);

  useEffect(() => {
    if (!isOpen) return;
    const launcher = launcherRef.current;
    if (!launcher) return;

    const sendData = () => {
      const now = Date.now();
      if (now - lastSendRef.current < SEND_INTERVAL_MS) return;
      lastSendRef.current = now;

      launcher.sendLiveData({
        power: Number(liveMetrics.power) || 0,
        cadence: Number(liveMetrics.cadence) || 0,
        cadenceSmoothed: Number(liveMetrics.cadenceSmoothed) || 0,
        pedalingActive: Boolean(liveMetrics.pedalingActive),
        effortBand: String(liveMetrics.effortBand || 'idle'),
        heartRate: Number(liveMetrics.heartRate) || 0,
        speed: Number(liveMetrics.speed) || 0,
        virtualSpeedKph: Number(liveMetrics.virtualSpeedKph) || Number(liveMetrics.speed) || 0,
        trainerSpeedKph: Number(liveMetrics.trainerSpeedKph) || 0,
        routeGradePct: Number(liveMetrics.routeGradePct) || 0,
        routeAltitudeM: Number(liveMetrics.routeAltitudeM) || 0,
        distance: Number(distance) || 0,
        elapsed: Number(elapsed) || 0,
        stepElapsed: Number(stepElapsed) || 0,
        stepRemaining: Number(stepRemaining) || 0,
        sessionState,
        routeId
      });
    };

    sendData();
    const interval = setInterval(sendData, SEND_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [
    distance,
    elapsed,
    stepElapsed,
    stepRemaining,
    isOpen,
    liveMetrics,
    routeId,
    sessionState
  ]);

  useEffect(() => {
    if (!isOpen) {
      previousSessionStateRef.current = sessionState;
      return;
    }

    const launcher = launcherRef.current;
    if (!launcher) return;

    const previous = previousSessionStateRef.current;

    if (sessionState === 'running') {
      if (previous === 'paused') {
        launcher.sendSessionResume({ routeId });
      } else {
        launcher.sendSessionStart({
          routeId,
          mode,
          workoutSelected: Boolean(workoutSelected),
          workoutName: workoutName || '',
          currentStep,
          workoutSteps
        });
      }
    } else if (sessionState === 'paused') {
      launcher.sendSessionPause({ routeId });
    } else if (sessionState === 'idle' || sessionState === 'stopped') {
      launcher.sendSessionStop({ routeId });
    }

    previousSessionStateRef.current = sessionState;
  }, [
    currentStep,
    isOpen,
    mode,
    routeId,
    sessionState,
    workoutName,
    workoutSelected,
    workoutSteps
  ]);

  useEffect(() => {
    const launcher = launcherRef.current;
    if (!launcher || !isOpen) return;

    const interval = setInterval(() => {
      syncLauncherState();
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, syncLauncherState]);

  return useMemo(() => ({
    isOpen,
    isLaunching,
    activeRuntime,
    launchReason,
    launch,
    close,
    toggle
  }), [activeRuntime, close, isLaunching, isOpen, launch, launchReason, toggle]);
};

export default useVirtualWorld;
