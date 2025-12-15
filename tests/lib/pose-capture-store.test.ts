/**
 * Unit tests for PoseCaptureStore
 * 
 * Tests pose capture state management:
 * - Capturing poses with landmarks
 * - Clearing captured poses
 * - Getting pose descriptors
 * - Hold progress tracking
 * 
 * Requirements: 1.5, 2.5, 4.1
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  usePoseCaptureStore,
  PoseCaptureManager,
  createPoseCaptureManager,
  type CapturedPose,
} from '../../src/lib/stores/pose-capture-store';
import { type HandLandmark } from '../../src/lib/hand-tracker';

// Helper to create test landmarks
function createTestLandmarks(): HandLandmark[] {
  return Array.from({ length: 21 }, (_, i) => ({
    x: 0.5 + (i * 0.01),
    y: 0.5 + (i * 0.005),
    z: 0,
  }));
}

describe('PoseCaptureManager (standalone)', () => {
  let manager: PoseCaptureManager;

  beforeEach(() => {
    manager = new PoseCaptureManager();
  });

  describe('initial state', () => {
    test('starts with no captured pose', () => {
      expect(manager.hasPose()).toBe(false);
      expect(manager.getPose()).toBeNull();
      expect(manager.getDescriptor()).toBeNull();
    });

    test('starts with zero hold progress', () => {
      const state = manager.getState();
      expect(state.holdProgress).toBe(0);
      expect(state.isCapturing).toBe(false);
    });
  });

  describe('capture', () => {
    test('stores landmarks and descriptor', () => {
      const landmarks = createTestLandmarks();
      const descriptor = 'hands raised high';

      manager.capture(landmarks, descriptor);

      expect(manager.hasPose()).toBe(true);
      const pose = manager.getPose();
      expect(pose).not.toBeNull();
      expect(pose!.landmarks).toHaveLength(21);
      expect(pose!.descriptor).toBe(descriptor);
    });

    test('generates unique ID for each capture', () => {
      const landmarks = createTestLandmarks();

      manager.capture(landmarks, 'pose 1');
      const id1 = manager.getPose()!.id;

      manager.capture(landmarks, 'pose 2');
      const id2 = manager.getPose()!.id;

      expect(id1).not.toBe(id2);
    });

    test('stores timestamp', () => {
      const before = Date.now();
      manager.capture(createTestLandmarks(), 'test');
      const after = Date.now();

      const pose = manager.getPose();
      expect(pose!.timestamp).toBeGreaterThanOrEqual(before);
      expect(pose!.timestamp).toBeLessThanOrEqual(after);
    });

    test('stores optional thumbnail', () => {
      const thumbnail = 'data:image/png;base64,abc123';
      manager.capture(createTestLandmarks(), 'test', thumbnail);

      const pose = manager.getPose();
      expect(pose!.thumbnail).toBe(thumbnail);
    });

    test('replaces previous pose on new capture', () => {
      manager.capture(createTestLandmarks(), 'first pose');
      const firstId = manager.getPose()!.id;

      manager.capture(createTestLandmarks(), 'second pose');
      const secondPose = manager.getPose();

      expect(secondPose!.id).not.toBe(firstId);
      expect(secondPose!.descriptor).toBe('second pose');
    });

    test('resets hold progress and capturing state', () => {
      manager.setHoldProgress(0.8);
      manager.setIsCapturing(true);

      manager.capture(createTestLandmarks(), 'test');

      const state = manager.getState();
      expect(state.holdProgress).toBe(0);
      expect(state.isCapturing).toBe(false);
    });

    test('copies landmarks to avoid mutation', () => {
      const landmarks = createTestLandmarks();
      manager.capture(landmarks, 'test');

      // Mutate original
      landmarks[0].x = 999;

      // Stored landmarks should be unchanged
      const pose = manager.getPose();
      expect(pose!.landmarks[0].x).not.toBe(999);
    });
  });

  describe('clear', () => {
    test('removes captured pose', () => {
      manager.capture(createTestLandmarks(), 'test');
      expect(manager.hasPose()).toBe(true);

      manager.clear();

      expect(manager.hasPose()).toBe(false);
      expect(manager.getPose()).toBeNull();
    });

    test('resets hold progress', () => {
      manager.setHoldProgress(0.5);
      manager.clear();

      expect(manager.getState().holdProgress).toBe(0);
    });

    test('resets capturing state', () => {
      manager.setIsCapturing(true);
      manager.clear();

      expect(manager.getState().isCapturing).toBe(false);
    });
  });

  describe('getDescriptor', () => {
    test('returns null when no pose captured', () => {
      expect(manager.getDescriptor()).toBeNull();
    });

    test('returns descriptor when pose is captured', () => {
      manager.capture(createTestLandmarks(), 'arms spread wide');
      expect(manager.getDescriptor()).toBe('arms spread wide');
    });

    test('returns null after clear', () => {
      manager.capture(createTestLandmarks(), 'test');
      manager.clear();
      expect(manager.getDescriptor()).toBeNull();
    });
  });

  describe('setHoldProgress', () => {
    test('updates hold progress', () => {
      manager.setHoldProgress(0.5);
      expect(manager.getState().holdProgress).toBe(0.5);
    });

    test('clamps progress to 0-1 range', () => {
      manager.setHoldProgress(-0.5);
      expect(manager.getState().holdProgress).toBe(0);

      manager.setHoldProgress(1.5);
      expect(manager.getState().holdProgress).toBe(1);
    });
  });

  describe('setIsCapturing', () => {
    test('updates capturing state', () => {
      manager.setIsCapturing(true);
      expect(manager.getState().isCapturing).toBe(true);

      manager.setIsCapturing(false);
      expect(manager.getState().isCapturing).toBe(false);
    });
  });
});

describe('usePoseCaptureStore (Zustand)', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePoseCaptureStore.setState({
      capturedPose: null,
      isCapturing: false,
      holdProgress: 0,
    });
  });

  test('capture stores pose correctly', () => {
    const { capture, getPose, hasPose } = usePoseCaptureStore.getState();
    const landmarks = createTestLandmarks();

    capture(landmarks, 'test descriptor');

    expect(hasPose()).toBe(true);
    const pose = getPose();
    expect(pose!.descriptor).toBe('test descriptor');
    expect(pose!.landmarks).toHaveLength(21);
  });

  test('clear removes pose', () => {
    const { capture, clear, hasPose } = usePoseCaptureStore.getState();

    capture(createTestLandmarks(), 'test');
    expect(hasPose()).toBe(true);

    clear();
    expect(hasPose()).toBe(false);
  });

  test('getDescriptor returns correct value', () => {
    const { capture, getDescriptor, clear } = usePoseCaptureStore.getState();

    expect(getDescriptor()).toBeNull();

    capture(createTestLandmarks(), 'hands together');
    expect(getDescriptor()).toBe('hands together');

    clear();
    expect(getDescriptor()).toBeNull();
  });

  test('setHoldProgress updates state', () => {
    const { setHoldProgress } = usePoseCaptureStore.getState();

    setHoldProgress(0.75);
    expect(usePoseCaptureStore.getState().holdProgress).toBe(0.75);
  });

  test('new capture replaces previous', () => {
    const { capture, getPose } = usePoseCaptureStore.getState();

    capture(createTestLandmarks(), 'first');
    const firstId = getPose()!.id;

    capture(createTestLandmarks(), 'second');
    const secondPose = getPose();

    expect(secondPose!.id).not.toBe(firstId);
    expect(secondPose!.descriptor).toBe('second');
  });
});

describe('createPoseCaptureManager factory', () => {
  test('creates new manager instance', () => {
    const manager = createPoseCaptureManager();
    expect(manager).toBeInstanceOf(PoseCaptureManager);
    expect(manager.hasPose()).toBe(false);
  });
});
