/**
 * Device Motion Hook
 * 
 * Provides access to device orientation and motion events for AR gallery walk mode.
 * Handles permission requests and provides normalized orientation data.
 * 
 * Requirements: 2.3 (enhanced) - Gallery Walk Mode
 */

import { useEffect, useState, useCallback } from 'react';

// ============ Types ============

/**
 * Normalized device orientation data
 */
export interface DeviceOrientation {
  /** Rotation around z-axis (0-360 degrees) */
  alpha: number | null;
  /** Rotation around x-axis (-180 to 180 degrees) */
  beta: number | null;
  /** Rotation around y-axis (-90 to 90 degrees) */
  gamma: number | null;
  /** Whether the device is in absolute orientation mode */
  absolute: boolean;
}

/**
 * Device motion data
 */
export interface DeviceMotion {
  /** Acceleration including gravity (m/s²) */
  acceleration: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
  /** Acceleration excluding gravity (m/s²) */
  accelerationIncludingGravity: {
    x: number | null;
    y: number | null;
    z: number | null;
  };
  /** Rotation rate (degrees/s) */
  rotationRate: {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  };
  /** Time interval (ms) */
  interval: number;
}

/**
 * Device motion hook state
 */
export interface DeviceMotionState {
  /** Current device orientation */
  orientation: DeviceOrientation | null;
  /** Current device motion */
  motion: DeviceMotion | null;
  /** Whether device motion is supported */
  isSupported: boolean;
  /** Whether permission has been granted */
  hasPermission: boolean;
  /** Whether currently listening for events */
  isListening: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Device motion hook return type
 */
export interface UseDeviceMotionReturn extends DeviceMotionState {
  /** Request permission for device motion (iOS 13+) */
  requestPermission: () => Promise<boolean>;
  /** Start listening to device motion events */
  startListening: () => void;
  /** Stop listening to device motion events */
  stopListening: () => void;
}

// ============ Utility Functions ============

/**
 * Check if device motion is supported
 */
function isDeviceMotionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'DeviceOrientationEvent' in window &&
    'DeviceMotionEvent' in window
  );
}

/**
 * Check if permission API is available (iOS 13+)
 */
function hasPermissionAPI(): boolean {
  return (
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as any).requestPermission === 'function'
  );
}

// ============ Hook Implementation ============

/**
 * Device Motion Hook
 * 
 * Provides access to device orientation and motion for AR gallery walk mode.
 * Handles iOS permission requests automatically.
 */
export function useDeviceMotion(): UseDeviceMotionReturn {
  const [state, setState] = useState<DeviceMotionState>({
    orientation: null,
    motion: null,
    isSupported: false,
    hasPermission: false,
    isListening: false,
    error: null,
  });

  /**
   * Handle device orientation event
   */
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    setState(prev => ({
      ...prev,
      orientation: {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute,
      },
    }));
  }, []);

  /**
   * Handle device motion event
   */
  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    setState(prev => ({
      ...prev,
      motion: {
        acceleration: {
          x: event.acceleration?.x ?? null,
          y: event.acceleration?.y ?? null,
          z: event.acceleration?.z ?? null,
        },
        accelerationIncludingGravity: {
          x: event.accelerationIncludingGravity?.x ?? null,
          y: event.accelerationIncludingGravity?.y ?? null,
          z: event.accelerationIncludingGravity?.z ?? null,
        },
        rotationRate: {
          alpha: event.rotationRate?.alpha ?? null,
          beta: event.rotationRate?.beta ?? null,
          gamma: event.rotationRate?.gamma ?? null,
        },
        interval: event.interval,
      },
    }));
  }, []);

  /**
   * Request permission for device motion (iOS 13+)
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!hasPermissionAPI()) {
      // Permission not required on this device
      setState(prev => ({ ...prev, hasPermission: true }));
      return true;
    }

    try {
      const orientationPermission = await (DeviceOrientationEvent as any).requestPermission();
      const motionPermission = await (DeviceMotionEvent as any).requestPermission();

      const granted = orientationPermission === 'granted' && motionPermission === 'granted';

      setState(prev => ({
        ...prev,
        hasPermission: granted,
        error: granted ? null : 'Permission denied for device motion',
      }));

      return granted;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permission';
      setState(prev => ({
        ...prev,
        hasPermission: false,
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  /**
   * Start listening to device motion events
   */
  const startListening = useCallback(() => {
    if (!isDeviceMotionSupported()) {
      setState(prev => ({
        ...prev,
        error: 'Device motion not supported on this device',
      }));
      return;
    }

    // Add event listeners
    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('devicemotion', handleMotion);

    setState(prev => ({
      ...prev,
      isListening: true,
      error: null,
    }));
  }, [handleOrientation, handleMotion]);

  /**
   * Stop listening to device motion events
   */
  const stopListening = useCallback(() => {
    window.removeEventListener('deviceorientation', handleOrientation);
    window.removeEventListener('devicemotion', handleMotion);

    setState(prev => ({
      ...prev,
      isListening: false,
      orientation: null,
      motion: null,
    }));
  }, [handleOrientation, handleMotion]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    const supported = isDeviceMotionSupported();
    const hasPermissionByDefault = !hasPermissionAPI();

    setState(prev => ({
      ...prev,
      isSupported: supported,
      hasPermission: hasPermissionByDefault,
    }));

    // Cleanup on unmount
    return () => {
      stopListening();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    requestPermission,
    startListening,
    stopListening,
  };
}

export default useDeviceMotion;
