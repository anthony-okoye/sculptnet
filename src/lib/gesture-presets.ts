/**
 * Gesture Presets - Preset gesture shortcuts for quick style application
 * 
 * Implements detection for:
 * - Peace sign (✌️): Cinematic, dramatic style
 * - Thumbs up (👍): Bright, optimistic style
 * - Rock sign (🤘): Edgy, bold style
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

import { type HandLandmark, LANDMARK_INDICES } from './hand-tracker';

// ============ Types ============

/**
 * Preset gesture types
 */
export type PresetGestureType = 'peace' | 'thumbsUp' | 'rock' | null;

/**
 * Preset configuration for FIBO parameters
 */
export interface PresetConfig {
  name: string;
  description: string;
  parameters: {
    'aesthetics.mood_atmosphere'?: string;
    'lighting.conditions'?: string;
    'aesthetics.color_scheme'?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Preset detection result
 */
export interface PresetDetectionResult {
  type: PresetGestureType;
  confidence: number;
  preset?: PresetConfig;
}

// ============ Default Preset Configurations ============

/**
 * Default preset configurations
 * Can be customized by users
 */
export const DEFAULT_PRESETS: Record<Exclude<PresetGestureType, null>, PresetConfig> = {
  peace: {
    name: 'Cinematic',
    description: 'Dramatic, cinematic lighting and mood',
    parameters: {
      'aesthetics.mood_atmosphere': 'cinematic, dramatic',
      'lighting.conditions': 'dramatic rim lighting',
    },
  },
  thumbsUp: {
    name: 'Optimistic',
    description: 'Bright, optimistic, warm colors',
    parameters: {
      'aesthetics.mood_atmosphere': 'bright, optimistic',
      'aesthetics.color_scheme': 'warm, vibrant',
    },
  },
  rock: {
    name: 'Edgy',
    description: 'Bold, high contrast, dramatic shadows',
    parameters: {
      'aesthetics.mood_atmosphere': 'edgy, bold',
      'lighting.shadows': 'high contrast, dramatic shadows',
    },
  },
};

// ============ Detection Thresholds ============

// Finger extension thresholds
const FINGER_EXTENDED_THRESHOLD = 0.15;  // Distance from palm to consider extended
const FINGER_CLOSED_THRESHOLD = 0.08;    // Distance from palm to consider closed

// Confidence thresholds
const MIN_CONFIDENCE = 0.6;  // Minimum confidence to report a preset gesture

// ============ Gesture Preset Detector ============

export class GesturePresetDetector {
  private customPresets: Record<Exclude<PresetGestureType, null>, PresetConfig>;

  constructor(customPresets?: Partial<Record<Exclude<PresetGestureType, null>, PresetConfig>>) {
    this.customPresets = {
      ...DEFAULT_PRESETS,
      ...customPresets,
    };
  }

  /**
   * Detect preset gesture from hand landmarks
   * 
   * @param landmarks - Array of 21 hand landmarks
   * @returns Detection result with gesture type and confidence
   */
  detectPresetGesture(landmarks: HandLandmark[]): PresetDetectionResult {
    if (!this.validateLandmarks(landmarks)) {
      return { type: null, confidence: 0 };
    }

    // Try each preset gesture detection in order of specificity
    const peaceResult = this.detectPeaceSign(landmarks);
    if (peaceResult.confidence >= MIN_CONFIDENCE) {
      return {
        type: 'peace',
        confidence: peaceResult.confidence,
        preset: this.customPresets.peace,
      };
    }

    const thumbsUpResult = this.detectThumbsUp(landmarks);
    if (thumbsUpResult.confidence >= MIN_CONFIDENCE) {
      return {
        type: 'thumbsUp',
        confidence: thumbsUpResult.confidence,
        preset: this.customPresets.thumbsUp,
      };
    }

    const rockResult = this.detectRockSign(landmarks);
    if (rockResult.confidence >= MIN_CONFIDENCE) {
      return {
        type: 'rock',
        confidence: rockResult.confidence,
        preset: this.customPresets.rock,
      };
    }

    return { type: null, confidence: 0 };
  }

  /**
   * Detect peace sign gesture (✌️)
   * Index and middle fingers extended, others closed
   * 
   * Requirements: 15.1
   */
  private detectPeaceSign(landmarks: HandLandmark[]): { confidence: number } {
    const palm = this.calculatePalmCenter(landmarks);
    
    // Check finger states
    const indexExtended = this.isFingerExtended(landmarks, LANDMARK_INDICES.INDEX_FINGER_TIP, palm);
    const middleExtended = this.isFingerExtended(landmarks, LANDMARK_INDICES.MIDDLE_FINGER_TIP, palm);
    const ringClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.RING_FINGER_TIP, palm);
    const pinkyClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.PINKY_TIP, palm);
    const thumbClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.THUMB_TIP, palm);

    // Peace sign: index and middle extended, others closed
    if (indexExtended && middleExtended && ringClosed && pinkyClosed) {
      // Calculate confidence based on how clear the gesture is
      const indexDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP], palm);
      const middleDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.MIDDLE_FINGER_TIP], palm);
      const ringDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.RING_FINGER_TIP], palm);
      const pinkyDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.PINKY_TIP], palm);
      
      // Higher confidence when extended fingers are far and closed fingers are close
      const extendedScore = Math.min(1, (indexDist + middleDist) / 0.4);
      const closedScore = Math.min(1, (1 - ringDist) + (1 - pinkyDist)) / 2;
      
      const confidence = (extendedScore + closedScore) / 2;
      return { confidence: Math.min(1, confidence) };
    }

    return { confidence: 0 };
  }

  /**
   * Detect thumbs up gesture (👍)
   * Thumb extended upward, other fingers closed
   * 
   * Requirements: 15.2
   */
  private detectThumbsUp(landmarks: HandLandmark[]): { confidence: number } {
    const palm = this.calculatePalmCenter(landmarks);
    const wrist = landmarks[LANDMARK_INDICES.WRIST];
    const thumbTip = landmarks[LANDMARK_INDICES.THUMB_TIP];
    
    // Check if thumb is extended upward (y-coordinate less than wrist)
    const thumbExtendedUp = thumbTip.y < wrist.y - 0.05;  // Thumb above wrist
    
    // Check other fingers are closed
    const indexClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.INDEX_FINGER_TIP, palm);
    const middleClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.MIDDLE_FINGER_TIP, palm);
    const ringClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.RING_FINGER_TIP, palm);
    const pinkyClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.PINKY_TIP, palm);

    // Thumbs up: thumb extended upward, others closed
    if (thumbExtendedUp && indexClosed && middleClosed && ringClosed && pinkyClosed) {
      // Calculate confidence based on thumb extension and finger closure
      const thumbHeight = wrist.y - thumbTip.y;
      const thumbScore = Math.min(1, thumbHeight / 0.15);
      
      const indexDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP], palm);
      const middleDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.MIDDLE_FINGER_TIP], palm);
      const closedScore = Math.min(1, (1 - indexDist) + (1 - middleDist)) / 2;
      
      const confidence = (thumbScore + closedScore) / 2;
      return { confidence: Math.min(1, confidence) };
    }

    return { confidence: 0 };
  }

  /**
   * Detect rock sign gesture (🤘)
   * Index and pinky extended, others closed
   * 
   * Requirements: 15.3
   */
  private detectRockSign(landmarks: HandLandmark[]): { confidence: number } {
    const palm = this.calculatePalmCenter(landmarks);
    
    // Check finger states
    const indexExtended = this.isFingerExtended(landmarks, LANDMARK_INDICES.INDEX_FINGER_TIP, palm);
    const pinkyExtended = this.isFingerExtended(landmarks, LANDMARK_INDICES.PINKY_TIP, palm);
    const middleClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.MIDDLE_FINGER_TIP, palm);
    const ringClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.RING_FINGER_TIP, palm);
    const thumbClosed = this.isFingerClosed(landmarks, LANDMARK_INDICES.THUMB_TIP, palm);

    // Rock sign: index and pinky extended, others closed
    if (indexExtended && pinkyExtended && middleClosed && ringClosed) {
      // Calculate confidence based on how clear the gesture is
      const indexDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP], palm);
      const pinkyDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.PINKY_TIP], palm);
      const middleDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.MIDDLE_FINGER_TIP], palm);
      const ringDist = this.calculateDistance2D(landmarks[LANDMARK_INDICES.RING_FINGER_TIP], palm);
      
      // Higher confidence when extended fingers are far and closed fingers are close
      const extendedScore = Math.min(1, (indexDist + pinkyDist) / 0.4);
      const closedScore = Math.min(1, (1 - middleDist) + (1 - ringDist)) / 2;
      
      const confidence = (extendedScore + closedScore) / 2;
      return { confidence: Math.min(1, confidence) };
    }

    return { confidence: 0 };
  }

  /**
   * Update custom preset configuration
   * 
   * Requirements: 15.5
   */
  updatePreset(type: Exclude<PresetGestureType, null>, config: PresetConfig): void {
    this.customPresets[type] = config;
  }

  /**
   * Get current preset configuration
   */
  getPreset(type: Exclude<PresetGestureType, null>): PresetConfig {
    return this.customPresets[type];
  }

  /**
   * Get all preset configurations
   */
  getAllPresets(): Record<Exclude<PresetGestureType, null>, PresetConfig> {
    return { ...this.customPresets };
  }

  /**
   * Reset presets to defaults
   */
  resetPresets(): void {
    this.customPresets = { ...DEFAULT_PRESETS };
  }

  // ============ Private Helper Methods ============

  /**
   * Validate that landmarks array has expected 21 points
   */
  private validateLandmarks(landmarks: HandLandmark[]): boolean {
    return landmarks && landmarks.length === 21;
  }

  /**
   * Calculate 2D Euclidean distance (ignoring z)
   */
  private calculateDistance2D(a: HandLandmark, b: HandLandmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate approximate palm center from landmarks
   */
  private calculatePalmCenter(landmarks: HandLandmark[]): HandLandmark {
    // Use wrist and MCP joints to estimate palm center
    const palmLandmarks = [
      landmarks[LANDMARK_INDICES.WRIST],
      landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP],
      landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP],
      landmarks[LANDMARK_INDICES.RING_FINGER_MCP],
      landmarks[LANDMARK_INDICES.PINKY_MCP],
    ];

    const sumX = palmLandmarks.reduce((sum, lm) => sum + lm.x, 0);
    const sumY = palmLandmarks.reduce((sum, lm) => sum + lm.y, 0);
    const sumZ = palmLandmarks.reduce((sum, lm) => sum + lm.z, 0);
    const count = palmLandmarks.length;

    return {
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count,
    };
  }

  /**
   * Check if a finger is extended (far from palm)
   */
  private isFingerExtended(
    landmarks: HandLandmark[],
    tipIndex: number,
    palm: HandLandmark
  ): boolean {
    const distance = this.calculateDistance2D(landmarks[tipIndex], palm);
    return distance > FINGER_EXTENDED_THRESHOLD;
  }

  /**
   * Check if a finger is closed (close to palm)
   */
  private isFingerClosed(
    landmarks: HandLandmark[],
    tipIndex: number,
    palm: HandLandmark
  ): boolean {
    const distance = this.calculateDistance2D(landmarks[tipIndex], palm);
    return distance < FINGER_CLOSED_THRESHOLD;
  }
}

/**
 * Create a default GesturePresetDetector instance
 */
export function createGesturePresetDetector(
  customPresets?: Partial<Record<Exclude<PresetGestureType, null>, PresetConfig>>
): GesturePresetDetector {
  return new GesturePresetDetector(customPresets);
}

// ============ Preset Storage (LocalStorage) ============

const PRESET_STORAGE_KEY = 'sculptnet-gesture-presets';

/**
 * Save custom presets to localStorage
 * 
 * Requirements: 15.5
 */
export function savePresetsToStorage(
  presets: Record<Exclude<PresetGestureType, null>, PresetConfig>
): void {
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save presets to localStorage:', error);
  }
}

/**
 * Load custom presets from localStorage
 * 
 * Requirements: 15.5
 */
export function loadPresetsFromStorage(): Record<Exclude<PresetGestureType, null>, PresetConfig> | null {
  try {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load presets from localStorage:', error);
  }
  return null;
}

/**
 * Clear custom presets from localStorage
 */
export function clearPresetsFromStorage(): void {
  try {
    localStorage.removeItem(PRESET_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear presets from localStorage:', error);
  }
}
