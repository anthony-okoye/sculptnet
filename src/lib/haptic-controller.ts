/**
 * Haptic Feedback Controller
 * 
 * Provides tactile feedback when gestures create balanced compositions.
 * Uses the Web Vibration API with fallback to visual pulse animation.
 * 
 * Features:
 * - Vibration pattern [50, 30, 50] for balanced compositions
 * - Debouncing: max 1 vibration per 2 seconds
 * - User preference toggle for enabling/disabling haptics
 * - Visual fallback when vibration is unsupported
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

// ============ Types ============

/**
 * Balanced composition types that trigger haptic feedback
 */
export const BALANCED_COMPOSITIONS = [
  'subject centered',
  'rule of thirds',
  'centered',
  'symmetrical',
  'golden ratio',
] as const;

export type BalancedComposition = typeof BALANCED_COMPOSITIONS[number];

/**
 * Haptic feedback event callback
 */
export type HapticEventCallback = (event: HapticEvent) => void;

/**
 * Haptic event types
 */
export interface HapticEvent {
  type: 'vibration' | 'visual_fallback';
  composition: string;
  timestamp: number;
}

/**
 * Visual pulse callback for fallback animation
 */
export type VisualPulseCallback = () => void;

// ============ Constants ============

/**
 * Default vibration pattern for balanced compositions
 * Pattern: vibrate 50ms, pause 30ms, vibrate 50ms
 * Total duration: 130ms (within 50-200ms bounds per Requirement 7.5)
 */
export const BALANCED_COMPOSITION_PATTERN: number[] = [50, 30, 50];

/**
 * Debounce interval in milliseconds (2 seconds)
 * Requirement 7.3: max 1 vibration per 2 seconds
 */
export const DEBOUNCE_INTERVAL_MS = 2000;

/**
 * Calculate total vibration duration from pattern
 */
export function calculatePatternDuration(pattern: number[]): number {
  return pattern.reduce((sum, val) => sum + val, 0);
}

// ============ HapticController Class ============

/**
 * HapticController manages tactile feedback for balanced compositions
 * 
 * Usage:
 * ```typescript
 * const haptic = new HapticController();
 * haptic.enable();
 * 
 * // Set visual fallback for unsupported devices
 * haptic.setVisualPulseCallback(() => {
 *   // Trigger CSS animation or visual effect
 * });
 * 
 * // Check composition and trigger feedback
 * haptic.checkCompositionAndVibrate('rule of thirds');
 * ```
 */
export class HapticController {
  private enabled: boolean = false;
  private supported: boolean = false;
  private lastVibrationTime: number = 0;
  private visualPulseCallback: VisualPulseCallback | null = null;
  private eventCallbacks: HapticEventCallback[] = [];

  constructor() {
    this.checkSupport();
  }

  /**
   * Check if the Web Vibration API is supported
   */
  private checkSupport(): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      this.supported = true;
    } else {
      this.supported = false;
    }
  }

  /**
   * Check if vibration is supported on this device
   * @returns true if Web Vibration API is available
   */
  isSupported(): boolean {
    return this.supported;
  }

  /**
   * Check if haptic feedback is currently enabled
   * @returns true if haptics are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable haptic feedback
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable haptic feedback
   * Requirement 7.4: respect user preference
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Toggle haptic feedback on/off
   * @returns new enabled state
   */
  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * Set the visual pulse callback for fallback animation
   * Requirement 7.2: provide visual feedback when vibration unsupported
   * 
   * @param callback - Function to call for visual feedback
   */
  setVisualPulseCallback(callback: VisualPulseCallback | null): void {
    this.visualPulseCallback = callback;
  }

  /**
   * Add an event listener for haptic events
   * @param callback - Function to call when haptic event occurs
   */
  addEventListener(callback: HapticEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Remove an event listener
   * @param callback - Function to remove
   */
  removeEventListener(callback: HapticEventCallback): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index !== -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  /**
   * Emit a haptic event to all listeners
   */
  private emitEvent(event: HapticEvent): void {
    for (const callback of this.eventCallbacks) {
      callback(event);
    }
  }

  /**
   * Trigger vibration with the balanced composition pattern
   * Requirement 7.5: duration between 50 and 200 milliseconds
   * 
   * @param pattern - Vibration pattern (default: BALANCED_COMPOSITION_PATTERN)
   * @returns true if vibration was triggered, false otherwise
   */
  vibrate(pattern: number | number[] = BALANCED_COMPOSITION_PATTERN): boolean {
    // Check if haptics are enabled
    if (!this.enabled) {
      return false;
    }

    // Check debounce (Requirement 7.3)
    const now = Date.now();
    if (now - this.lastVibrationTime < DEBOUNCE_INTERVAL_MS) {
      return false;
    }

    // Update last vibration time
    this.lastVibrationTime = now;

    // Try to vibrate if supported
    if (this.supported) {
      try {
        navigator.vibrate(pattern);
        return true;
      } catch {
        // Vibration failed, fall through to visual fallback
      }
    }

    // Visual fallback (Requirement 7.2)
    if (this.visualPulseCallback) {
      this.visualPulseCallback();
      return true;
    }

    return false;
  }

  /**
   * Check if a composition is considered "balanced"
   * Requirement 7.1: trigger vibration for balanced layouts
   * 
   * @param composition - The composition string to check
   * @returns true if the composition is balanced
   */
  isBalancedComposition(composition: string): boolean {
    if (!composition) {
      return false;
    }
    
    const normalizedComposition = composition.toLowerCase().trim();
    
    return BALANCED_COMPOSITIONS.some(balanced => 
      normalizedComposition.includes(balanced.toLowerCase())
    );
  }

  /**
   * Check composition and trigger vibration if balanced
   * Main method for integration with gesture system
   * 
   * @param composition - The current composition parameter value
   * @returns true if vibration was triggered
   */
  checkCompositionAndVibrate(composition: string): boolean {
    if (!this.isBalancedComposition(composition)) {
      return false;
    }

    const triggered = this.vibrate();
    
    if (triggered) {
      const event: HapticEvent = {
        type: this.supported ? 'vibration' : 'visual_fallback',
        composition,
        timestamp: Date.now(),
      };
      this.emitEvent(event);
    }

    return triggered;
  }

  /**
   * Get the time since last vibration in milliseconds
   * Useful for testing debounce behavior
   */
  getTimeSinceLastVibration(): number {
    if (this.lastVibrationTime === 0) {
      return Infinity;
    }
    return Date.now() - this.lastVibrationTime;
  }

  /**
   * Check if currently in debounce period
   * @returns true if within debounce window
   */
  isInDebouncePeriod(): boolean {
    return this.getTimeSinceLastVibration() < DEBOUNCE_INTERVAL_MS;
  }

  /**
   * Reset the controller state
   * Clears debounce timer and resets to default state
   */
  reset(): void {
    this.lastVibrationTime = 0;
  }

  /**
   * Force set the last vibration time (for testing)
   * @internal
   */
  _setLastVibrationTime(time: number): void {
    this.lastVibrationTime = time;
  }

  /**
   * Force set supported state (for testing)
   * @internal
   */
  _setSupported(supported: boolean): void {
    this.supported = supported;
  }
}

// ============ Singleton Instance ============

let hapticControllerInstance: HapticController | null = null;

/**
 * Get the singleton HapticController instance
 */
export function getHapticController(): HapticController {
  if (!hapticControllerInstance) {
    hapticControllerInstance = new HapticController();
  }
  return hapticControllerInstance;
}

/**
 * Create a new HapticController instance (for testing)
 */
export function createHapticController(): HapticController {
  return new HapticController();
}

// ============ React Hook Integration ============

/**
 * Hook-compatible state interface for React integration
 */
export interface HapticState {
  enabled: boolean;
  supported: boolean;
  lastVibrationTime: number;
}

/**
 * Get current haptic state (for React hooks)
 */
export function getHapticState(controller: HapticController): HapticState {
  return {
    enabled: controller.isEnabled(),
    supported: controller.isSupported(),
    lastVibrationTime: controller.getTimeSinceLastVibration() === Infinity 
      ? 0 
      : Date.now() - controller.getTimeSinceLastVibration(),
  };
}
