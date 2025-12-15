/**
 * Device Motion Hook Tests
 * 
 * Tests for the device motion and orientation hook
 * 
 * Requirements: 2.3 (enhanced) - Gallery Walk Mode
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDeviceMotion } from '@/hooks/use-device-motion';

describe('useDeviceMotion', () => {
  // Mock device orientation and motion events
  let orientationListeners: ((event: DeviceOrientationEvent) => void)[] = [];
  let motionListeners: ((event: DeviceMotionEvent) => void)[] = [];

  beforeEach(() => {
    orientationListeners = [];
    motionListeners = [];

    // Mock window.addEventListener
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'deviceorientation') {
        orientationListeners.push(handler as (event: DeviceOrientationEvent) => void);
      } else if (event === 'devicemotion') {
        motionListeners.push(handler as (event: DeviceMotionEvent) => void);
      }
    });

    // Mock window.removeEventListener
    vi.spyOn(window, 'removeEventListener').mockImplementation((event, handler) => {
      if (event === 'deviceorientation') {
        orientationListeners = orientationListeners.filter(l => l !== handler);
      } else if (event === 'devicemotion') {
        motionListeners = motionListeners.filter(l => l !== handler);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('initializes with correct default state', () => {
    const { result } = renderHook(() => useDeviceMotion());

    expect(result.current.orientation).toBeNull();
    expect(result.current.motion).toBeNull();
    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('detects device motion support', () => {
    const { result } = renderHook(() => useDeviceMotion());

    // In test environment, these should be available
    expect(result.current.isSupported).toBe(true);
  });

  test('starts listening to device events', () => {
    const { result } = renderHook(() => useDeviceMotion());

    act(() => {
      result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);
    expect(orientationListeners.length).toBeGreaterThan(0);
    expect(motionListeners.length).toBeGreaterThan(0);
  });

  test('stops listening to device events', () => {
    const { result } = renderHook(() => useDeviceMotion());

    act(() => {
      result.current.startListening();
    });

    act(() => {
      result.current.stopListening();
    });

    expect(result.current.isListening).toBe(false);
    expect(result.current.orientation).toBeNull();
    expect(result.current.motion).toBeNull();
  });

  test('handles device orientation events', async () => {
    const { result } = renderHook(() => useDeviceMotion());

    act(() => {
      result.current.startListening();
    });

    // Simulate device orientation event
    const mockOrientationEvent = {
      alpha: 45,
      beta: 30,
      gamma: 15,
      absolute: true,
    } as DeviceOrientationEvent;

    act(() => {
      orientationListeners.forEach(listener => listener(mockOrientationEvent));
    });

    await waitFor(() => {
      expect(result.current.orientation).not.toBeNull();
    });

    expect(result.current.orientation?.alpha).toBe(45);
    expect(result.current.orientation?.beta).toBe(30);
    expect(result.current.orientation?.gamma).toBe(15);
    expect(result.current.orientation?.absolute).toBe(true);
  });

  test('handles device motion events', async () => {
    const { result } = renderHook(() => useDeviceMotion());

    act(() => {
      result.current.startListening();
    });

    // Simulate device motion event
    const mockMotionEvent = {
      acceleration: { x: 1, y: 2, z: 3 },
      accelerationIncludingGravity: { x: 1.5, y: 2.5, z: 9.8 },
      rotationRate: { alpha: 10, beta: 20, gamma: 30 },
      interval: 16,
    } as DeviceMotionEvent;

    act(() => {
      motionListeners.forEach(listener => listener(mockMotionEvent));
    });

    await waitFor(() => {
      expect(result.current.motion).not.toBeNull();
    });

    expect(result.current.motion?.acceleration.x).toBe(1);
    expect(result.current.motion?.acceleration.y).toBe(2);
    expect(result.current.motion?.acceleration.z).toBe(3);
    expect(result.current.motion?.rotationRate.alpha).toBe(10);
  });

  test('handles null values in motion events', async () => {
    const { result } = renderHook(() => useDeviceMotion());

    act(() => {
      result.current.startListening();
    });

    // Simulate device motion event with null values
    const mockMotionEvent = {
      acceleration: null,
      accelerationIncludingGravity: { x: null, y: null, z: null },
      rotationRate: null,
      interval: 16,
    } as unknown as DeviceMotionEvent;

    act(() => {
      motionListeners.forEach(listener => listener(mockMotionEvent));
    });

    await waitFor(() => {
      expect(result.current.motion).not.toBeNull();
    });

    expect(result.current.motion?.acceleration.x).toBeNull();
    expect(result.current.motion?.acceleration.y).toBeNull();
    expect(result.current.motion?.acceleration.z).toBeNull();
  });

  test('cleans up listeners on unmount', () => {
    const { result, unmount } = renderHook(() => useDeviceMotion());

    act(() => {
      result.current.startListening();
    });

    const initialOrientationListeners = orientationListeners.length;
    const initialMotionListeners = motionListeners.length;

    expect(initialOrientationListeners).toBeGreaterThan(0);
    expect(initialMotionListeners).toBeGreaterThan(0);

    unmount();

    // Listeners should be removed
    expect(orientationListeners.length).toBe(0);
    expect(motionListeners.length).toBe(0);
  });

  test('requestPermission returns true when no permission API', async () => {
    const { result } = renderHook(() => useDeviceMotion());

    let permissionGranted = false;
    await act(async () => {
      permissionGranted = await result.current.requestPermission();
    });

    expect(permissionGranted).toBe(true);
    expect(result.current.hasPermission).toBe(true);
  });

  test('updates orientation multiple times', async () => {
    const { result } = renderHook(() => useDeviceMotion());

    act(() => {
      result.current.startListening();
    });

    // First orientation
    act(() => {
      orientationListeners.forEach(listener =>
        listener({ alpha: 10, beta: 20, gamma: 30, absolute: true } as DeviceOrientationEvent)
      );
    });

    await waitFor(() => {
      expect(result.current.orientation?.alpha).toBe(10);
    });

    // Second orientation
    act(() => {
      orientationListeners.forEach(listener =>
        listener({ alpha: 50, beta: 60, gamma: 70, absolute: true } as DeviceOrientationEvent)
      );
    });

    await waitFor(() => {
      expect(result.current.orientation?.alpha).toBe(50);
    });

    expect(result.current.orientation?.beta).toBe(60);
    expect(result.current.orientation?.gamma).toBe(70);
  });
});
