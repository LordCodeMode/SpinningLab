/**
 * useVirtualWorld React Hook
 *
 * Provides easy integration of the Virtual World with React components.
 * Automatically sends live data to the virtual world when it's open.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getVirtualWorldLauncher } from './launcher.js';

/**
 * Hook to manage the Virtual World window
 *
 * @param {Object} options
 * @param {Object} options.liveMetrics - Current live metrics { power, cadence, heartRate, speed }
 * @param {string} options.sessionState - Current session state ('idle', 'running', 'paused')
 * @param {Object} options.currentStep - Current workout step
 * @param {Array} options.workoutSteps - All workout steps
 * @param {boolean} options.workoutSelected - Whether a workout is selected
 * @param {string} options.workoutName - Selected workout name
 * @param {number} options.elapsed - Total elapsed time in seconds
 * @param {number} options.stepElapsed - Current step elapsed time
 * @param {number} options.stepRemaining - Current step remaining time
 * @param {number} options.distance - Total distance in meters
 * @param {string} options.mode - 'erg' or 'sim'
 * @param {Function} options.onControl - Callback for control actions from the virtual world
 */
export function useVirtualWorld({
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
  mode = 'erg',
  onControl = null
} = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const launcherRef = useRef(null);
  const lastSendRef = useRef(0);
  const controlRef = useRef(onControl);

  // Initialize launcher
  useEffect(() => {
    launcherRef.current = getVirtualWorldLauncher();

    return () => {
      // Don't destroy on unmount - window should persist
    };
  }, []);

  useEffect(() => {
    controlRef.current = onControl;
  }, [onControl]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const channel = new BroadcastChannel('virtual-ride-data');

    channel.onmessage = (event) => {
      const { type, data } = event.data || {};
      if (type === 'control' && controlRef.current) {
        controlRef.current(data?.action);
      }
    };

    return () => channel.close();
  }, []);

  // Send live data at ~10Hz when window is open and session is running
  useEffect(() => {
    if (!isOpen || sessionState !== 'running') return;

    const sendData = () => {
      const now = Date.now();
      if (now - lastSendRef.current < 100) return; // Throttle to 10Hz
      lastSendRef.current = now;

      launcherRef.current?.sendLiveData({
        power: liveMetrics.power || 0,
        cadence: liveMetrics.cadence || 0,
        heartRate: liveMetrics.heartRate || 0,
        speed: liveMetrics.speed || 0,
        distance,
        elapsed,
        sessionState,
        currentStep,
        workoutSteps,
        workoutSelected,
        workoutName,
        stepElapsed,
        stepRemaining,
        totalProgress: workoutSteps.length > 0
          ? elapsed / workoutSteps.reduce((sum, s) => sum + (s.durationSec || 0), 0)
          : 0,
        mode
      });
    };

    // Send immediately and then on interval
    sendData();
    const interval = setInterval(sendData, 100);

    return () => clearInterval(interval);
  }, [
    isOpen,
    sessionState,
    liveMetrics,
    currentStep,
    workoutSteps,
    workoutSelected,
    workoutName,
    elapsed,
    stepElapsed,
    stepRemaining,
    distance,
    mode
  ]);

  // Send session state changes
  useEffect(() => {
    if (!isOpen || !launcherRef.current) return;

    if (sessionState === 'running') {
      launcherRef.current.notifySessionStart({
        workoutSteps,
        currentStep,
        workoutSelected,
        workoutName,
        mode
      });
    } else if (sessionState === 'paused') {
      launcherRef.current.notifySessionPause();
    } else if (sessionState === 'stopped' || sessionState === 'idle') {
      launcherRef.current.notifySessionStop();
    }
  }, [isOpen, sessionState]);

  // Launch virtual world
  const launch = useCallback(async () => {
    if (isLaunching) return false;

    setIsLaunching(true);
    try {
      const success = await launcherRef.current?.open();
      setIsOpen(success);
      return success;
    } finally {
      setIsLaunching(false);
    }
  }, [isLaunching]);

  // Close virtual world
  const close = useCallback(() => {
    launcherRef.current?.close();
    setIsOpen(false);
  }, []);

  // Check if window is still open
  useEffect(() => {
    if (!isOpen) return;

    const checkInterval = setInterval(() => {
      const stillOpen = launcherRef.current?.isWindowOpen();
      if (!stillOpen) {
        setIsOpen(false);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [isOpen]);

  return {
    isOpen,
    isLaunching,
    launch,
    close,
    toggle: isOpen ? close : launch
  };
}
