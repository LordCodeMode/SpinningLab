import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const normalizeRuntime = (value) => (value === 'unity' ? 'unity' : 'three');

/**
 * Lightweight no-op hook kept so LiveTrainingApp can run without the heavy 3D world.
 */
export const useVirtualWorld = ({ runtime = 'three' } = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const launchTimerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (launchTimerRef.current) {
      clearTimeout(launchTimerRef.current);
      launchTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearTimer();
    setIsLaunching(false);
    setIsOpen(false);
  }, [clearTimer]);

  const open = useCallback(() => {
    clearTimer();
    setIsLaunching(true);

    // Simulate a short launch step, then stay closed because runtime is removed.
    launchTimerRef.current = setTimeout(() => {
      setIsLaunching(false);
      setIsOpen(false);
      launchTimerRef.current = null;
    }, 200);
  }, [clearTimer]);

  const toggle = useCallback(() => {
    if (isOpen || isLaunching) {
      close();
      return;
    }
    open();
  }, [close, isLaunching, isOpen, open]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return useMemo(() => ({
    isOpen,
    isLaunching,
    activeRuntime: normalizeRuntime(runtime),
    launchReason: 'disabled',
    toggle,
    close,
  }), [close, isLaunching, isOpen, runtime, toggle]);
};

export default useVirtualWorld;
