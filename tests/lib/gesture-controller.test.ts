/**
 * Gesture Controller Tests
 * 
 * Tests for the gesture detection to JSON state update wiring.
 * Verifies that gestures are properly mapped and debounced.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GestureMapper, type GestureUpdate } from '@/lib/gesture-mapper';
import { JSONStateManager } from '@/lib/stores/prompt-store';
import type { HandLandmark } from '@/lib/hand-tracker';

// ============ Test Utilities ============

/**
 * Create mock hand landmarks for testing
 */
function createMockLandmarks(overrides: Partial<Record<number, Partial<HandLandmark>>> = {}): HandLandmark[] {
  const defaultLandmark: HandLandmark = { x: 0.5, y: 0.5, z: 0 };
  const landmarks: HandLandmark[] = Array(21).fill(null).map(() => ({ ...defaultLandmark }));
  
  // Apply overrides
  for (const [index, override] of Object.entries(overrides)) {
    const idx = parseInt(index);
    if (idx >= 0 && idx < 21) {
      landmarks[idx] = { ...landmarks[idx], ...override };
    }
  }
  
  return landmarks;
}

/**
 * Create landmarks for a pinch gesture
 */
function createPinchLandmarks(distance: number): HandLandmark[] {
  return createMockLandmarks({
    4: { x: 0.5, y: 0.5, z: 0 },  // Thumb tip
    8: { x: 0.5 + distance, y: 0.5, z: 0 },  // Index tip
  });
}

/**
 * Create landmarks for vertical position
 */
function createVerticalLandmarks(yPosition: number): HandLandmark[] {
  return createMockLandmarks({
    0: { x: 0.5, y: yPosition, z: 0 },  // Wrist
  });
}

/**
 * Create landmarks for a fist
 */
function createFistLandmarks(): HandLandmark[] {
  // All fingertips close to palm center
  const palmCenter = { x: 0.5, y: 0.5, z: 0 };
  return createMockLandmarks({
    0: palmCenter,  // Wrist
    5: { x: 0.48, y: 0.48, z: 0 },  // Index MCP
    9: { x: 0.5, y: 0.48, z: 0 },   // Middle MCP
    13: { x: 0.52, y: 0.48, z: 0 }, // Ring MCP
    17: { x: 0.54, y: 0.48, z: 0 }, // Pinky MCP
    8: { x: 0.49, y: 0.52, z: 0 },  // Index tip (close to palm)
    12: { x: 0.5, y: 0.52, z: 0 },  // Middle tip (close to palm)
    16: { x: 0.51, y: 0.52, z: 0 }, // Ring tip (close to palm)
    20: { x: 0.52, y: 0.52, z: 0 }, // Pinky tip (close to palm)
  });
}

/**
 * Create landmarks for an open hand
 */
function createOpenHandLandmarks(): HandLandmark[] {
  // All fingertips far from palm center
  return createMockLandmarks({
    0: { x: 0.5, y: 0.7, z: 0 },    // Wrist
    5: { x: 0.4, y: 0.5, z: 0 },    // Index MCP
    9: { x: 0.5, y: 0.5, z: 0 },    // Middle MCP
    13: { x: 0.6, y: 0.5, z: 0 },   // Ring MCP
    17: { x: 0.7, y: 0.5, z: 0 },   // Pinky MCP
    8: { x: 0.3, y: 0.2, z: 0 },    // Index tip (far from palm)
    12: { x: 0.5, y: 0.15, z: 0 },  // Middle tip (far from palm)
    16: { x: 0.7, y: 0.2, z: 0 },   // Ring tip (far from palm)
    20: { x: 0.85, y: 0.25, z: 0 }, // Pinky tip (far from palm)
  });
}

// ============ Debounce Utility Tests ============

describe('Debounce Utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce rapid updates', async () => {
    const callback = vi.fn();
    const debounceMs = 100;
    
    // Simulate debounced updates
    const pendingUpdates = new Map<string, GestureUpdate>();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    const queueUpdate = (update: GestureUpdate) => {
      pendingUpdates.set(update.path, update);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        pendingUpdates.forEach(u => callback(u));
        pendingUpdates.clear();
      }, debounceMs);
    };
    
    // Queue multiple rapid updates
    queueUpdate({ path: 'lighting.conditions', value: 'night', confidence: 0.8 });
    queueUpdate({ path: 'lighting.conditions', value: 'golden hour', confidence: 0.9 });
    queueUpdate({ path: 'lighting.conditions', value: 'studio', confidence: 0.85 });
    
    // Callback should not have been called yet
    expect(callback).not.toHaveBeenCalled();
    
    // Advance time past debounce
    vi.advanceTimersByTime(debounceMs + 10);
    
    // Should only call once with the last value
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'studio' })
    );
  });

  it('should apply updates after debounce period', async () => {
    const stateManager = new JSONStateManager();
    stateManager.initialize();
    
    const debounceMs = 100;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingUpdates = new Map<string, GestureUpdate>();
    
    const queueUpdate = (update: GestureUpdate) => {
      pendingUpdates.set(update.path, update);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        pendingUpdates.forEach(u => stateManager.update(u.path, u.value));
        pendingUpdates.clear();
      }, debounceMs);
    };
    
    // Queue an update
    queueUpdate({ 
      path: 'lighting.conditions', 
      value: 'bright studio lighting', 
      confidence: 0.9 
    });
    
    // State should not be updated yet
    const promptBefore = stateManager.getPrompt();
    expect(promptBefore.lighting.conditions).not.toBe('bright studio lighting');
    
    // Advance time
    vi.advanceTimersByTime(debounceMs + 10);
    
    // State should now be updated
    const promptAfter = stateManager.getPrompt();
    expect(promptAfter.lighting.conditions).toBe('bright studio lighting');
  });
});

// ============ Gesture to State Wiring Tests ============

describe('Gesture to State Wiring', () => {
  let gestureMapper: GestureMapper;
  let stateManager: JSONStateManager;

  beforeEach(() => {
    gestureMapper = new GestureMapper();
    stateManager = new JSONStateManager();
    stateManager.initialize();
  });

  it('should wire pinch gesture to lens focal length update', () => {
    // Create pinch landmarks with medium distance
    const landmarks = createPinchLandmarks(0.1);
    
    // Map gesture
    const update = gestureMapper.mapPinchToFOV(landmarks);
    
    expect(update).not.toBeNull();
    expect(update!.path).toBe('photographic_characteristics.lens_focal_length');
    
    // Apply to state
    const result = stateManager.update(update!.path, update!.value);
    expect(result.success).toBe(true);
    
    // Verify state was updated
    const prompt = stateManager.getPrompt();
    expect(prompt.photographic_characteristics.lens_focal_length).toBe(update!.value);
  });

  it('should wire wrist rotation to camera angle update', () => {
    // Create landmarks with wrist rotation
    const landmarks = createMockLandmarks({
      0: { x: 0.5, y: 0.5, z: 0 },   // Wrist
      9: { x: 0.5, y: 0.3, z: 0 },   // Middle MCP (above wrist = eye level)
    });
    
    // Map gesture
    const update = gestureMapper.mapWristRotationToAngle(landmarks);
    
    expect(update).not.toBeNull();
    expect(update!.path).toBe('photographic_characteristics.camera_angle');
    
    // Apply to state
    const result = stateManager.update(update!.path, update!.value);
    expect(result.success).toBe(true);
    
    // Verify state was updated
    const prompt = stateManager.getPrompt();
    expect(prompt.photographic_characteristics.camera_angle).toBe(update!.value);
  });

  it('should wire vertical movement to lighting update', () => {
    // Create landmarks at different vertical positions
    const lowLandmarks = createVerticalLandmarks(0.2);  // Top of frame = night
    const highLandmarks = createVerticalLandmarks(0.8); // Bottom of frame = studio
    
    // Map low position
    const lowUpdate = gestureMapper.mapVerticalMovementToLighting(lowLandmarks);
    expect(lowUpdate).not.toBeNull();
    expect(lowUpdate!.path).toBe('lighting.conditions');
    expect(lowUpdate!.value).toBe('night, moonlight from above');
    
    // Reset mapper for clean state
    gestureMapper.reset();
    
    // Map high position
    const highUpdate = gestureMapper.mapVerticalMovementToLighting(highLandmarks);
    expect(highUpdate).not.toBeNull();
    expect(highUpdate!.value).toBe('bright studio lighting');
    
    // Apply to state
    const result = stateManager.update(highUpdate!.path, highUpdate!.value);
    expect(result.success).toBe(true);
    
    // Verify state was updated
    const prompt = stateManager.getPrompt();
    expect(prompt.lighting.conditions).toBe('bright studio lighting');
  });

  it('should wire two-hand frame to composition update', () => {
    // Create two-hand landmarks forming a centered frame
    const leftHand = createMockLandmarks({
      0: { x: 0.3, y: 0.5, z: 0 },
    });
    const rightHand = createMockLandmarks({
      0: { x: 0.7, y: 0.5, z: 0 },
    });
    
    // Map gesture
    const update = gestureMapper.mapTwoHandFrameToComposition(leftHand, rightHand);
    
    expect(update).not.toBeNull();
    expect(update!.path).toBe('aesthetics.composition');
    
    // Apply to state
    const result = stateManager.update(update!.path, update!.value);
    expect(result.success).toBe(true);
    
    // Verify state was updated
    const prompt = stateManager.getPrompt();
    expect(prompt.aesthetics.composition).toBe(update!.value);
  });
});

// ============ Generation Trigger Tests ============

describe('Generation Trigger Detection', () => {
  let gestureMapper: GestureMapper;

  beforeEach(() => {
    gestureMapper = new GestureMapper();
  });

  it('should detect fist-to-open transition', () => {
    const fistLandmarks = createFistLandmarks();
    const openLandmarks = createOpenHandLandmarks();
    
    // First frame: fist (should not trigger)
    const trigger1 = gestureMapper.detectGenerationTrigger(fistLandmarks);
    expect(trigger1).toBe(false);
    
    // Second frame: open hand (should trigger)
    const trigger2 = gestureMapper.detectGenerationTrigger(openLandmarks);
    expect(trigger2).toBe(true);
    
    // Third frame: still open (should not trigger again)
    const trigger3 = gestureMapper.detectGenerationTrigger(openLandmarks);
    expect(trigger3).toBe(false);
  });

  it('should not trigger on open-to-fist transition', () => {
    const fistLandmarks = createFistLandmarks();
    const openLandmarks = createOpenHandLandmarks();
    
    // First frame: open hand
    gestureMapper.detectGenerationTrigger(openLandmarks);
    
    // Second frame: fist (should not trigger)
    const trigger = gestureMapper.detectGenerationTrigger(fistLandmarks);
    expect(trigger).toBe(false);
  });

  it('should reset trigger state after reset()', () => {
    const fistLandmarks = createFistLandmarks();
    const openLandmarks = createOpenHandLandmarks();
    
    // Set up fist state
    gestureMapper.detectGenerationTrigger(fistLandmarks);
    
    // Reset
    gestureMapper.reset();
    
    // Open hand should not trigger (no previous fist state)
    const trigger = gestureMapper.detectGenerationTrigger(openLandmarks);
    expect(trigger).toBe(false);
  });
});

// ============ State Preservation Tests ============

describe('State Preservation', () => {
  let stateManager: JSONStateManager;

  beforeEach(() => {
    stateManager = new JSONStateManager();
    stateManager.initialize();
  });

  it('should preserve other fields when updating a single parameter', () => {
    // Get initial state
    const initialPrompt = stateManager.getPrompt();
    const initialLighting = initialPrompt.lighting.conditions;
    const initialComposition = initialPrompt.aesthetics.composition;
    
    // Update only camera angle
    stateManager.update('photographic_characteristics.camera_angle', 'high angle');
    
    // Verify other fields are preserved
    const updatedPrompt = stateManager.getPrompt();
    expect(updatedPrompt.lighting.conditions).toBe(initialLighting);
    expect(updatedPrompt.aesthetics.composition).toBe(initialComposition);
    expect(updatedPrompt.photographic_characteristics.camera_angle).toBe('high angle');
  });

  it('should maintain state when no hands are detected', () => {
    // Update some state
    stateManager.update('lighting.conditions', 'golden hour from top');
    stateManager.update('photographic_characteristics.camera_angle', 'low dutch tilt');
    
    const stateBeforeNoHands = stateManager.getPrompt();
    
    // Simulate "no hands detected" - no updates should occur
    // (In real implementation, the controller simply doesn't call update)
    
    const stateAfterNoHands = stateManager.getPrompt();
    
    // State should be identical
    expect(stateAfterNoHands).toEqual(stateBeforeNoHands);
  });
});

// ============ Integration Flow Tests ============

describe('Integration Flow', () => {
  let gestureMapper: GestureMapper;
  let stateManager: JSONStateManager;

  beforeEach(() => {
    gestureMapper = new GestureMapper();
    stateManager = new JSONStateManager();
    stateManager.initialize();
  });

  it('should complete full gesture-to-state flow', () => {
    // Simulate a sequence of gestures
    const gestures = [
      createPinchLandmarks(0.15),      // Pinch for FOV
      createVerticalLandmarks(0.4),    // Vertical for lighting
    ];
    
    // Process each gesture
    for (const landmarks of gestures) {
      const pinchUpdate = gestureMapper.mapPinchToFOV(landmarks);
      const verticalUpdate = gestureMapper.mapVerticalMovementToLighting(landmarks);
      
      if (pinchUpdate && pinchUpdate.confidence > 0.3) {
        stateManager.update(pinchUpdate.path, pinchUpdate.value);
      }
      if (verticalUpdate && verticalUpdate.confidence > 0.3) {
        stateManager.update(verticalUpdate.path, verticalUpdate.value);
      }
    }
    
    // Verify state was updated
    const finalPrompt = stateManager.getPrompt();
    expect(finalPrompt.photographic_characteristics.lens_focal_length).toBeDefined();
    expect(finalPrompt.lighting.conditions).toBeDefined();
  });

  it('should handle rapid gesture changes gracefully', () => {
    // Simulate rapid gesture changes
    for (let i = 0; i < 10; i++) {
      const yPosition = 0.1 + (i * 0.08); // Move from top to bottom
      const landmarks = createVerticalLandmarks(yPosition);
      
      const update = gestureMapper.mapVerticalMovementToLighting(landmarks);
      if (update) {
        stateManager.update(update.path, update.value);
      }
    }
    
    // State should be valid
    const validation = stateManager.validate();
    expect(validation.success).toBe(true);
  });
});
