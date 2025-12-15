/**
 * Unit tests for PoseStabilityDetector
 * 
 * Tests pose stability detection functionality:
 * - Movement variance calculation
 * - Stability threshold detection
 * - Hold progress tracking
 * - Reset functionality
 * 
 * Requirements: 1.1, 1.2, 1.3
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PoseStabilityDetector,
  createPoseStabilityDetector,
  type PoseStabilityConfig,
} from '../../src/lib/pose-stability-detector';
import { type HandLandmark } from '../../src/lib/hand-tracker';

// Helper to create a full 21-point landmark array with default values
function createDefaultLandmarks(): HandLandmark[] {
  return Array.from({ length: 21 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
}

// Helper to create landmarks with slight random variation
function createLandmarksWithVariation(baseX: number, baseY: number, variation: number): HandLandmark[] {
  return Array.from({ length: 21 }, () => ({
    x: baseX + (Math.random() - 0.5) * variation,
    y: baseY + (Math.random() - 0.5) * variation,
    z: 0,
  }));
}

// Helper to create stable landmarks (identical across calls)
function createStableLandmarks(): HandLandmark[] {
  return Array.from({ length: 21 }, (_, i) => ({
    x: 0.5 + (i * 0.01),
    y: 0.5 + (i * 0.005),
    z: 0,
  }));
}

// Helper to create moving landmarks (different each call)
function createMovingLandmarks(offset: number): HandLandmark[] {
  return Array.from({ length: 21 }, (_, i) => ({
    x: 0.5 + offset + (i * 0.01),
    y: 0.5 + offset + (i * 0.005),
    z: 0,
  }));
}

describe('PoseStabilityDetector', () => {
  let detector: PoseStabilityDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new PoseStabilityDetector();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    test('uses default config when none provided', () => {
      const config = detector.getConfig();
      expect(config.stabilityThreshold).toBe(0.02);
      expect(config.holdDuration).toBe(2);
      expect(config.windowSize).toBe(30);
    });

    test('accepts custom config', () => {
      const customConfig: Partial<PoseStabilityConfig> = {
        stabilityThreshold: 0.05,
        holdDuration: 3,
        windowSize: 20,
      };
      const customDetector = new PoseStabilityDetector(customConfig);
      const config = customDetector.getConfig();
      
      expect(config.stabilityThreshold).toBe(0.05);
      expect(config.holdDuration).toBe(3);
      expect(config.windowSize).toBe(20);
    });

    test('merges partial config with defaults', () => {
      const customDetector = new PoseStabilityDetector({ holdDuration: 5 });
      const config = customDetector.getConfig();
      
      expect(config.stabilityThreshold).toBe(0.02);
      expect(config.holdDuration).toBe(5);
      expect(config.windowSize).toBe(30);
    });
  });

  describe('update', () => {
    test('returns unstable state with single frame', () => {
      const landmarks = createDefaultLandmarks();
      const state = detector.update(landmarks);
      
      expect(state.isStable).toBe(false);
      expect(state.holdProgress).toBe(0);
      expect(state.variance).toBe(1);
    });

    test('detects stable pose with identical landmarks', () => {
      const landmarks = createStableLandmarks();
      
      // Feed identical landmarks multiple times
      detector.update(landmarks);
      const state = detector.update(landmarks);
      
      expect(state.isStable).toBe(true);
      expect(state.variance).toBeLessThan(0.02);
    });

    test('detects unstable pose with moving landmarks', () => {
      // Feed landmarks with significant movement
      detector.update(createMovingLandmarks(0));
      const state = detector.update(createMovingLandmarks(0.1));
      
      expect(state.isStable).toBe(false);
      expect(state.variance).toBeGreaterThan(0.02);
    });

    test('tracks hold progress during stability', () => {
      const landmarks = createStableLandmarks();
      
      // Initial frame
      detector.update(landmarks);
      
      // Advance time and update
      vi.advanceTimersByTime(500);
      let state = detector.update(landmarks);
      expect(state.holdProgress).toBeGreaterThan(0);
      expect(state.holdProgress).toBeLessThan(1);
      
      // Advance more time
      vi.advanceTimersByTime(500);
      state = detector.update(landmarks);
      expect(state.holdProgress).toBeGreaterThan(0.25);
    });

    test('resets progress when movement detected', () => {
      const stableLandmarks = createStableLandmarks();
      
      // Build up stability
      detector.update(stableLandmarks);
      vi.advanceTimersByTime(1000);
      let state = detector.update(stableLandmarks);
      expect(state.holdProgress).toBeGreaterThan(0);
      
      // Introduce movement
      vi.advanceTimersByTime(100);
      state = detector.update(createMovingLandmarks(0.2));
      
      expect(state.isStable).toBe(false);
      expect(state.holdProgress).toBe(0);
    });

    test('maintains window size limit', () => {
      const customDetector = new PoseStabilityDetector({ windowSize: 5 });
      const landmarks = createStableLandmarks();
      
      // Feed more frames than window size
      for (let i = 0; i < 10; i++) {
        customDetector.update(landmarks);
      }
      
      // Should still work correctly
      const state = customDetector.update(landmarks);
      expect(state.isStable).toBe(true);
    });
  });

  describe('shouldCapture', () => {
    test('returns false initially', () => {
      expect(detector.shouldCapture()).toBe(false);
    });

    test('returns false before hold duration reached', () => {
      const landmarks = createStableLandmarks();
      
      detector.update(landmarks);
      vi.advanceTimersByTime(1000);
      detector.update(landmarks);
      
      expect(detector.shouldCapture()).toBe(false);
    });

    test('returns true after hold duration reached', () => {
      const landmarks = createStableLandmarks();
      
      detector.update(landmarks);
      vi.advanceTimersByTime(2100); // Just over 2 seconds
      detector.update(landmarks);
      
      expect(detector.shouldCapture()).toBe(true);
    });

    test('returns false after movement resets stability', () => {
      const stableLandmarks = createStableLandmarks();
      
      // Build up to near capture
      detector.update(stableLandmarks);
      vi.advanceTimersByTime(1900);
      detector.update(stableLandmarks);
      
      // Movement resets
      vi.advanceTimersByTime(100);
      detector.update(createMovingLandmarks(0.2));
      
      expect(detector.shouldCapture()).toBe(false);
    });
  });

  describe('getCurrentLandmarks', () => {
    test('returns null when no landmarks recorded', () => {
      expect(detector.getCurrentLandmarks()).toBeNull();
    });

    test('returns most recent landmarks', () => {
      const landmarks1 = createMovingLandmarks(0);
      const landmarks2 = createMovingLandmarks(0.1);
      
      detector.update(landmarks1);
      detector.update(landmarks2);
      
      const current = detector.getCurrentLandmarks();
      expect(current).not.toBeNull();
      expect(current![0].x).toBeCloseTo(landmarks2[0].x, 5);
    });

    test('returns a copy, not the original', () => {
      const landmarks = createStableLandmarks();
      detector.update(landmarks);
      
      const current = detector.getCurrentLandmarks();
      current![0].x = 999;
      
      const currentAgain = detector.getCurrentLandmarks();
      expect(currentAgain![0].x).not.toBe(999);
    });
  });

  describe('reset', () => {
    test('clears landmark history', () => {
      const landmarks = createStableLandmarks();
      detector.update(landmarks);
      detector.update(landmarks);
      
      detector.reset();
      
      expect(detector.getCurrentLandmarks()).toBeNull();
    });

    test('resets stability tracking', () => {
      const landmarks = createStableLandmarks();
      
      // Build up stability
      detector.update(landmarks);
      vi.advanceTimersByTime(1500);
      detector.update(landmarks);
      
      detector.reset();
      
      // After reset, should start fresh
      const state = detector.update(landmarks);
      expect(state.holdProgress).toBe(0);
    });

    test('resets shouldCapture state', () => {
      const landmarks = createStableLandmarks();
      
      // Reach capture threshold
      detector.update(landmarks);
      vi.advanceTimersByTime(2100);
      detector.update(landmarks);
      expect(detector.shouldCapture()).toBe(true);
      
      detector.reset();
      
      expect(detector.shouldCapture()).toBe(false);
    });
  });

  describe('createPoseStabilityDetector factory', () => {
    test('creates detector with default config', () => {
      const detector = createPoseStabilityDetector();
      const config = detector.getConfig();
      
      expect(config.stabilityThreshold).toBe(0.02);
      expect(config.holdDuration).toBe(2);
    });

    test('creates detector with custom config', () => {
      const detector = createPoseStabilityDetector({ holdDuration: 5 });
      const config = detector.getConfig();
      
      expect(config.holdDuration).toBe(5);
    });
  });

  describe('variance calculation', () => {
    test('calculates low variance for stable poses', () => {
      const landmarks = createStableLandmarks();
      
      detector.update(landmarks);
      const state = detector.update(landmarks);
      
      expect(state.variance).toBe(0);
    });

    test('calculates higher variance for moving poses', () => {
      detector.update(createMovingLandmarks(0));
      const state = detector.update(createMovingLandmarks(0.05));
      
      expect(state.variance).toBeGreaterThan(0);
    });

    test('handles different landmark counts gracefully', () => {
      // First frame with 21 landmarks
      detector.update(createDefaultLandmarks());
      
      // Second frame with different count (edge case)
      const shortLandmarks = createDefaultLandmarks().slice(0, 10);
      const state = detector.update(shortLandmarks);
      
      // Should handle gracefully without crashing
      expect(state).toBeDefined();
    });
  });
});
