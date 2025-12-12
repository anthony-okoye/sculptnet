/**
 * Unit tests for HapticController
 * 
 * Tests haptic feedback functionality:
 * - Vibration support detection
 * - Enable/disable toggle
 * - Balanced composition detection
 * - Debouncing behavior
 * - Visual fallback
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  HapticController,
  createHapticController,
  BALANCED_COMPOSITIONS,
  BALANCED_COMPOSITION_PATTERN,
  DEBOUNCE_INTERVAL_MS,
  calculatePatternDuration,
} from '../../src/lib/haptic-controller';

// Mock navigator.vibrate
const mockVibrate = vi.fn().mockReturnValue(true);

describe('HapticController', () => {
  let controller: HapticController;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup navigator.vibrate mock
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true,
    });
    
    controller = createHapticController();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    test('detects vibration support when available', () => {
      expect(controller.isSupported()).toBe(true);
    });

    test('detects no vibration support when unavailable', () => {
      // Create controller and force unsupported state
      const unsupportedController = createHapticController();
      unsupportedController._setSupported(false);
      expect(unsupportedController.isSupported()).toBe(false);
    });

    test('starts with haptics disabled', () => {
      expect(controller.isEnabled()).toBe(false);
    });
  });

  describe('enable/disable', () => {
    test('enable() enables haptic feedback', () => {
      controller.enable();
      expect(controller.isEnabled()).toBe(true);
    });

    test('disable() disables haptic feedback', () => {
      controller.enable();
      controller.disable();
      expect(controller.isEnabled()).toBe(false);
    });

    test('toggle() switches enabled state', () => {
      expect(controller.toggle()).toBe(true);
      expect(controller.isEnabled()).toBe(true);
      
      expect(controller.toggle()).toBe(false);
      expect(controller.isEnabled()).toBe(false);
    });
  });

  describe('vibrate()', () => {
    test('does not vibrate when disabled', () => {
      const result = controller.vibrate();
      expect(result).toBe(false);
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    test('vibrates with default pattern when enabled', () => {
      controller.enable();
      const result = controller.vibrate();
      
      expect(result).toBe(true);
      expect(mockVibrate).toHaveBeenCalledWith(BALANCED_COMPOSITION_PATTERN);
    });

    test('vibrates with custom pattern', () => {
      controller.enable();
      const customPattern = [100, 50, 100];
      controller.vibrate(customPattern);
      
      expect(mockVibrate).toHaveBeenCalledWith(customPattern);
    });

    test('vibrates with single duration', () => {
      controller.enable();
      controller.vibrate(100);
      
      expect(mockVibrate).toHaveBeenCalledWith(100);
    });
  });

  describe('debouncing (Requirement 7.3)', () => {
    test('allows first vibration', () => {
      controller.enable();
      expect(controller.vibrate()).toBe(true);
    });

    test('blocks vibration within debounce period', () => {
      vi.useFakeTimers();
      controller.enable();
      
      // First vibration succeeds
      expect(controller.vibrate()).toBe(true);
      
      // Second vibration within 2 seconds is blocked
      vi.advanceTimersByTime(1000);
      expect(controller.vibrate()).toBe(false);
    });

    test('allows vibration after debounce period', () => {
      vi.useFakeTimers();
      controller.enable();
      
      // First vibration
      expect(controller.vibrate()).toBe(true);
      
      // Wait for debounce period
      vi.advanceTimersByTime(DEBOUNCE_INTERVAL_MS + 1);
      
      // Second vibration should succeed
      expect(controller.vibrate()).toBe(true);
    });

    test('isInDebouncePeriod() returns correct state', () => {
      vi.useFakeTimers();
      controller.enable();
      
      expect(controller.isInDebouncePeriod()).toBe(false);
      
      controller.vibrate();
      expect(controller.isInDebouncePeriod()).toBe(true);
      
      vi.advanceTimersByTime(DEBOUNCE_INTERVAL_MS + 1);
      expect(controller.isInDebouncePeriod()).toBe(false);
    });

    test('reset() clears debounce timer', () => {
      vi.useFakeTimers();
      controller.enable();
      
      controller.vibrate();
      expect(controller.isInDebouncePeriod()).toBe(true);
      
      controller.reset();
      expect(controller.isInDebouncePeriod()).toBe(false);
      expect(controller.vibrate()).toBe(true);
    });
  });

  describe('isBalancedComposition() (Requirement 7.1)', () => {
    test('recognizes "subject centered" as balanced', () => {
      expect(controller.isBalancedComposition('subject centered')).toBe(true);
    });

    test('recognizes "rule of thirds" as balanced', () => {
      expect(controller.isBalancedComposition('rule of thirds')).toBe(true);
    });

    test('recognizes "centered" as balanced', () => {
      expect(controller.isBalancedComposition('centered')).toBe(true);
    });

    test('recognizes "symmetrical" as balanced', () => {
      expect(controller.isBalancedComposition('symmetrical')).toBe(true);
    });

    test('recognizes "golden ratio" as balanced', () => {
      expect(controller.isBalancedComposition('golden ratio')).toBe(true);
    });

    test('is case-insensitive', () => {
      expect(controller.isBalancedComposition('RULE OF THIRDS')).toBe(true);
      expect(controller.isBalancedComposition('Subject Centered')).toBe(true);
    });

    test('handles partial matches', () => {
      expect(controller.isBalancedComposition('using rule of thirds composition')).toBe(true);
      expect(controller.isBalancedComposition('perfectly centered subject')).toBe(true);
    });

    test('returns false for non-balanced compositions', () => {
      expect(controller.isBalancedComposition('panoramic')).toBe(false);
      expect(controller.isBalancedComposition('off-center')).toBe(false);
      expect(controller.isBalancedComposition('random')).toBe(false);
    });

    test('returns false for empty or null input', () => {
      expect(controller.isBalancedComposition('')).toBe(false);
      expect(controller.isBalancedComposition(null as unknown as string)).toBe(false);
      expect(controller.isBalancedComposition(undefined as unknown as string)).toBe(false);
    });
  });

  describe('checkCompositionAndVibrate()', () => {
    test('vibrates for balanced composition when enabled', () => {
      controller.enable();
      const result = controller.checkCompositionAndVibrate('rule of thirds');
      
      expect(result).toBe(true);
      expect(mockVibrate).toHaveBeenCalled();
    });

    test('does not vibrate for non-balanced composition', () => {
      controller.enable();
      const result = controller.checkCompositionAndVibrate('panoramic');
      
      expect(result).toBe(false);
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    test('does not vibrate when disabled', () => {
      const result = controller.checkCompositionAndVibrate('rule of thirds');
      
      expect(result).toBe(false);
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    test('respects debounce for multiple balanced compositions', () => {
      vi.useFakeTimers();
      controller.enable();
      
      // First balanced composition triggers
      expect(controller.checkCompositionAndVibrate('rule of thirds')).toBe(true);
      
      // Second balanced composition within debounce is blocked
      expect(controller.checkCompositionAndVibrate('centered')).toBe(false);
      
      // After debounce, triggers again
      vi.advanceTimersByTime(DEBOUNCE_INTERVAL_MS + 1);
      expect(controller.checkCompositionAndVibrate('symmetrical')).toBe(true);
    });
  });

  describe('visual fallback (Requirement 7.2)', () => {
    test('calls visual pulse callback when vibration unsupported', () => {
      // Remove vibrate support
      Object.defineProperty(navigator, 'vibrate', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      
      const unsupportedController = createHapticController();
      const visualCallback = vi.fn();
      
      unsupportedController.setVisualPulseCallback(visualCallback);
      unsupportedController.enable();
      unsupportedController.vibrate();
      
      expect(visualCallback).toHaveBeenCalled();
    });

    test('returns true when visual fallback is triggered', () => {
      const unsupportedController = createHapticController();
      unsupportedController._setSupported(false);
      
      const visualCallback = vi.fn();
      unsupportedController.setVisualPulseCallback(visualCallback);
      unsupportedController.enable();
      
      expect(unsupportedController.vibrate()).toBe(true);
    });

    test('returns false when no fallback available', () => {
      const unsupportedController = createHapticController();
      unsupportedController._setSupported(false);
      unsupportedController.enable();
      
      expect(unsupportedController.vibrate()).toBe(false);
    });

    test('can clear visual pulse callback', () => {
      const visualCallback = vi.fn();
      controller.setVisualPulseCallback(visualCallback);
      controller.setVisualPulseCallback(null);
      controller._setSupported(false);
      controller.enable();
      
      controller.vibrate();
      expect(visualCallback).not.toHaveBeenCalled();
    });
  });

  describe('event listeners', () => {
    test('emits event on successful vibration', () => {
      const eventCallback = vi.fn();
      controller.addEventListener(eventCallback);
      controller.enable();
      
      controller.checkCompositionAndVibrate('rule of thirds');
      
      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'vibration',
          composition: 'rule of thirds',
        })
      );
    });

    test('emits visual_fallback event type when using fallback', () => {
      const unsupportedController = createHapticController();
      unsupportedController._setSupported(false);
      unsupportedController.setVisualPulseCallback(() => {});
      unsupportedController.enable();
      
      const eventCallback = vi.fn();
      unsupportedController.addEventListener(eventCallback);
      
      unsupportedController.checkCompositionAndVibrate('centered');
      
      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'visual_fallback',
        })
      );
    });

    test('can remove event listener', () => {
      const eventCallback = vi.fn();
      controller.addEventListener(eventCallback);
      controller.removeEventListener(eventCallback);
      controller.enable();
      
      controller.checkCompositionAndVibrate('rule of thirds');
      
      expect(eventCallback).not.toHaveBeenCalled();
    });

    test('does not emit event when vibration blocked', () => {
      const eventCallback = vi.fn();
      controller.addEventListener(eventCallback);
      // Not enabled, so vibration should be blocked
      
      controller.checkCompositionAndVibrate('rule of thirds');
      
      expect(eventCallback).not.toHaveBeenCalled();
    });
  });

  describe('vibration duration (Requirement 7.5)', () => {
    test('default pattern duration is between 50 and 200ms', () => {
      const duration = calculatePatternDuration(BALANCED_COMPOSITION_PATTERN);
      expect(duration).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThanOrEqual(200);
    });

    test('default pattern is [50, 30, 50]', () => {
      expect(BALANCED_COMPOSITION_PATTERN).toEqual([50, 30, 50]);
    });

    test('calculatePatternDuration sums all values', () => {
      expect(calculatePatternDuration([50, 30, 50])).toBe(130);
      expect(calculatePatternDuration([100])).toBe(100);
      expect(calculatePatternDuration([50, 50, 50, 50])).toBe(200);
    });
  });

  describe('constants', () => {
    test('DEBOUNCE_INTERVAL_MS is 2000ms', () => {
      expect(DEBOUNCE_INTERVAL_MS).toBe(2000);
    });

    test('BALANCED_COMPOSITIONS contains expected values', () => {
      expect(BALANCED_COMPOSITIONS).toContain('subject centered');
      expect(BALANCED_COMPOSITIONS).toContain('rule of thirds');
      expect(BALANCED_COMPOSITIONS).toContain('centered');
      expect(BALANCED_COMPOSITIONS).toContain('symmetrical');
      expect(BALANCED_COMPOSITIONS).toContain('golden ratio');
    });
  });
});
