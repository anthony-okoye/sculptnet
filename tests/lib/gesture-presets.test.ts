/**
 * Tests for Gesture Presets
 * 
 * Tests preset gesture detection:
 * - Peace sign (✌️)
 * - Thumbs up (👍)
 * - Rock sign (🤘)
 * - Preset customization
 * - Storage persistence
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GesturePresetDetector,
  createGesturePresetDetector,
  DEFAULT_PRESETS,
  type PresetConfig,
  type PresetGestureType,
  savePresetsToStorage,
  loadPresetsFromStorage,
  clearPresetsFromStorage,
} from '@/lib/gesture-presets';
import { type HandLandmark } from '@/lib/hand-tracker';

// ============ Test Helpers ============

/**
 * Create a hand landmark array with all fingers in specified states
 * Palm center will be approximately at (0.552, 0.484)
 */
function createHandLandmarks(config: {
  thumbExtended?: boolean;
  indexExtended?: boolean;
  middleExtended?: boolean;
  ringExtended?: boolean;
  pinkyExtended?: boolean;
  thumbUp?: boolean;
}): HandLandmark[] {
  const landmarks: HandLandmark[] = [];
  
  // Wrist (0)
  landmarks[0] = { x: 0.5, y: 0.5, z: 0 };
  
  // Palm center will be at approximately (0.552, 0.484)
  const palmX = 0.552;
  const palmY = 0.484;
  
  // Thumb (1-4)
  const thumbExtended = config.thumbExtended ?? false;
  const thumbUp = config.thumbUp ?? false;
  landmarks[1] = { x: 0.45, y: 0.48, z: 0 };
  landmarks[2] = { x: 0.42, y: 0.46, z: 0 };
  landmarks[3] = { x: 0.40, y: 0.44, z: 0 };
  if (thumbExtended && thumbUp) {
    // Thumb extended upward (for thumbs up)
    landmarks[4] = { x: palmX - 0.1, y: palmY - 0.2, z: 0 };
  } else if (thumbExtended) {
    // Thumb extended sideways
    landmarks[4] = { x: palmX - 0.2, y: palmY, z: 0 };
  } else {
    // Thumb closed (within 0.08 of palm)
    landmarks[4] = { x: palmX - 0.05, y: palmY, z: 0 };
  }
  
  // Index finger (5-8)
  const indexExtended = config.indexExtended ?? false;
  landmarks[5] = { x: 0.52, y: 0.48, z: 0 };
  landmarks[6] = { x: 0.53, y: 0.42, z: 0 };
  landmarks[7] = { x: 0.54, y: 0.36, z: 0 };
  landmarks[8] = indexExtended 
    ? { x: palmX, y: palmY - 0.2, z: 0 }  // Extended (distance > 0.15)
    : { x: palmX, y: palmY - 0.05, z: 0 }; // Closed (distance < 0.08)
  
  // Middle finger (9-12)
  const middleExtended = config.middleExtended ?? false;
  landmarks[9] = { x: 0.55, y: 0.48, z: 0 };
  landmarks[10] = { x: 0.56, y: 0.42, z: 0 };
  landmarks[11] = { x: 0.57, y: 0.36, z: 0 };
  landmarks[12] = middleExtended
    ? { x: palmX + 0.03, y: palmY - 0.2, z: 0 }  // Extended
    : { x: palmX + 0.03, y: palmY - 0.05, z: 0 }; // Closed
  
  // Ring finger (13-16)
  const ringExtended = config.ringExtended ?? false;
  landmarks[13] = { x: 0.58, y: 0.48, z: 0 };
  landmarks[14] = { x: 0.59, y: 0.42, z: 0 };
  landmarks[15] = { x: 0.60, y: 0.36, z: 0 };
  landmarks[16] = ringExtended
    ? { x: palmX + 0.06, y: palmY - 0.2, z: 0 }  // Extended
    : { x: palmX + 0.06, y: palmY - 0.04, z: 0 }; // Closed
  
  // Pinky (17-20)
  const pinkyExtended = config.pinkyExtended ?? false;
  landmarks[17] = { x: 0.61, y: 0.48, z: 0 };
  landmarks[18] = { x: 0.62, y: 0.42, z: 0 };
  landmarks[19] = { x: 0.63, y: 0.36, z: 0 };
  landmarks[20] = pinkyExtended
    ? { x: palmX + 0.09, y: palmY - 0.2, z: 0 }  // Extended
    : { x: palmX + 0.05, y: palmY, z: 0 }; // Closed (closer to palm)
  
  return landmarks;
}

// ============ Tests ============

describe('GesturePresetDetector', () => {
  let detector: GesturePresetDetector;

  beforeEach(() => {
    detector = createGesturePresetDetector();
  });

  describe('Peace Sign Detection', () => {
    it('should detect peace sign with index and middle extended', () => {
      // Requirements: 15.1
      const landmarks = createHandLandmarks({
        indexExtended: true,
        middleExtended: true,
        thumbExtended: false,
        ringExtended: false,
        pinkyExtended: false,
      });

      const result = detector.detectPresetGesture(landmarks);

      expect(result.type).toBe('peace');
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.preset).toBeDefined();
      expect(result.preset?.name).toBe('Cinematic');
    });

    it('should not detect peace sign when all fingers extended', () => {
      const landmarks = createHandLandmarks({
        indexExtended: true,
        middleExtended: true,
        thumbExtended: true,
        ringExtended: true,
        pinkyExtended: true,
      });

      const result = detector.detectPresetGesture(landmarks);

      expect(result.type).not.toBe('peace');
    });

    it('should not detect peace sign when only index extended', () => {
      const landmarks = createHandLandmarks({
        indexExtended: true,
        middleExtended: false,
        thumbExtended: false,
        ringExtended: false,
        pinkyExtended: false,
      });

      const result = detector.detectPresetGesture(landmarks);

      expect(result.type).not.toBe('peace');
    });
  });

  describe('Thumbs Up Detection', () => {
    it('should detect thumbs up with thumb extended upward', () => {
      // Requirements: 15.2
      const landmarks = createHandLandmarks({
        thumbExtended: true,
        thumbUp: true,
        indexExtended: false,
        middleExtended: false,
        ringExtended: false,
        pinkyExtended: false,
      });

      const result = detector.detectPresetGesture(landmarks);

      expect(result.type).toBe('thumbsUp');
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.preset).toBeDefined();
      expect(result.preset?.name).toBe('Optimistic');
    });

    it('should not detect thumbs up when thumb not extended upward', () => {
      const landmarks = createHandLandmarks({
        thumbExtended: true,
        thumbUp: false, // Thumb not pointing up
        indexExtended: false,
        middleExtended: false,
        ringExtended: false,
        pinkyExtended: false,
      });

      const result = detector.detectPresetGesture(landmarks);

      expect(result.type).not.toBe('thumbsUp');
    });
  });

  describe('Rock Sign Detection', () => {
    it('should detect rock sign with index and pinky extended', () => {
      // Requirements: 15.3
      const landmarks = createHandLandmarks({
        indexExtended: true,
        pinkyExtended: true,
        thumbExtended: false,
        middleExtended: false,
        ringExtended: false,
      });

      const result = detector.detectPresetGesture(landmarks);

      expect(result.type).toBe('rock');
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.preset).toBeDefined();
      expect(result.preset?.name).toBe('Edgy');
    });

    it('should not detect rock sign when all fingers extended', () => {
      const landmarks = createHandLandmarks({
        indexExtended: true,
        middleExtended: true,
        ringExtended: true,
        pinkyExtended: true,
        thumbExtended: true,
      });

      const result = detector.detectPresetGesture(landmarks);

      expect(result.type).not.toBe('rock');
    });
  });

  describe('No Gesture Detection', () => {
    it('should return null when no preset gesture detected', () => {
      const landmarks = createHandLandmarks({
        indexExtended: false,
        middleExtended: false,
        ringExtended: false,
        pinkyExtended: false,
        thumbExtended: false,
      });

      const result = detector.detectPresetGesture(landmarks);

      expect(result.type).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.preset).toBeUndefined();
    });

    it('should return null for invalid landmarks', () => {
      const result = detector.detectPresetGesture([]);

      expect(result.type).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('Preset Customization', () => {
    it('should allow updating preset configuration', () => {
      // Requirements: 15.5
      const customConfig: PresetConfig = {
        name: 'Custom Peace',
        description: 'My custom peace preset',
        parameters: {
          'aesthetics.mood_atmosphere': 'custom mood',
          'lighting.conditions': 'custom lighting',
        },
      };

      detector.updatePreset('peace', customConfig);
      const retrieved = detector.getPreset('peace');

      expect(retrieved.name).toBe('Custom Peace');
      expect(retrieved.description).toBe('My custom peace preset');
      expect(retrieved.parameters['aesthetics.mood_atmosphere']).toBe('custom mood');
    });

    it('should return all presets', () => {
      const allPresets = detector.getAllPresets();

      expect(allPresets).toHaveProperty('peace');
      expect(allPresets).toHaveProperty('thumbsUp');
      expect(allPresets).toHaveProperty('rock');
    });

    it('should reset presets to defaults', () => {
      // Modify a preset
      detector.updatePreset('peace', {
        name: 'Modified',
        description: 'Modified',
        parameters: {},
      });

      // Reset
      detector.resetPresets();
      const retrieved = detector.getPreset('peace');

      expect(retrieved.name).toBe(DEFAULT_PRESETS.peace.name);
      expect(retrieved.description).toBe(DEFAULT_PRESETS.peace.description);
    });
  });

  describe('Preset Parameters', () => {
    it('should have correct default parameters for peace preset', () => {
      // Requirements: 15.1
      const preset = DEFAULT_PRESETS.peace;

      expect(preset.parameters['aesthetics.mood_atmosphere']).toBe('cinematic, dramatic');
      expect(preset.parameters['lighting.conditions']).toBe('dramatic rim lighting');
    });

    it('should have correct default parameters for thumbsUp preset', () => {
      // Requirements: 15.2
      const preset = DEFAULT_PRESETS.thumbsUp;

      expect(preset.parameters['aesthetics.mood_atmosphere']).toBe('bright, optimistic');
      expect(preset.parameters['aesthetics.color_scheme']).toBe('warm, vibrant');
    });

    it('should have correct default parameters for rock preset', () => {
      // Requirements: 15.3
      const preset = DEFAULT_PRESETS.rock;

      expect(preset.parameters['aesthetics.mood_atmosphere']).toBe('edgy, bold');
      expect(preset.parameters['lighting.shadows']).toBe('high contrast, dramatic shadows');
    });
  });
});

describe('Preset Storage', () => {
  afterEach(() => {
    // Clean up localStorage after each test
    clearPresetsFromStorage();
  });

  it('should save presets to localStorage', () => {
    // Requirements: 15.5
    const customPresets = {
      peace: { ...DEFAULT_PRESETS.peace, name: 'Custom Peace' },
      thumbsUp: { ...DEFAULT_PRESETS.thumbsUp, name: 'Custom Thumbs' },
      rock: { ...DEFAULT_PRESETS.rock, name: 'Custom Rock' },
    };

    savePresetsToStorage(customPresets);
    const loaded = loadPresetsFromStorage();

    expect(loaded).not.toBeNull();
    expect(loaded?.peace.name).toBe('Custom Peace');
    expect(loaded?.thumbsUp.name).toBe('Custom Thumbs');
    expect(loaded?.rock.name).toBe('Custom Rock');
  });

  it('should return null when no presets stored', () => {
    clearPresetsFromStorage();
    const loaded = loadPresetsFromStorage();

    expect(loaded).toBeNull();
  });

  it('should clear presets from localStorage', () => {
    savePresetsToStorage(DEFAULT_PRESETS);
    clearPresetsFromStorage();
    const loaded = loadPresetsFromStorage();

    expect(loaded).toBeNull();
  });
});

describe('GesturePresetDetector with Custom Presets', () => {
  it('should initialize with custom presets from storage', () => {
    // Requirements: 15.5
    const customPresets = {
      peace: { ...DEFAULT_PRESETS.peace, name: 'Stored Peace' },
      thumbsUp: DEFAULT_PRESETS.thumbsUp,
      rock: DEFAULT_PRESETS.rock,
    };

    const detector = createGesturePresetDetector(customPresets);
    const retrieved = detector.getPreset('peace');

    expect(retrieved.name).toBe('Stored Peace');
  });
});
