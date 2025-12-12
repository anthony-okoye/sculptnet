/**
 * GestureMapper - Translates hand landmarks into JSON parameter updates
 * 
 * Maps hand gestures detected by MediaPipe to FIBO structured prompt parameters:
 * - Pinch gesture → Camera FOV (35-120 degrees)
 * - Wrist rotation → Camera angle (low dutch tilt, eye level, high angle, bird's eye)
 * - Vertical movement → Lighting presets
 * - Two-hand frame → Composition rules
 * - Fist-to-open → Generation trigger
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { type HandLandmark, LANDMARK_INDICES } from './hand-tracker';

export interface GestureUpdate {
  path: string;  // JSON path like "camera.fov"
  value: string | number;
  confidence: number;  // 0-1
}

// FOV mapping constants
const FOV_MIN = 35;
const FOV_MAX = 120;
const PINCH_DISTANCE_MIN = 0.02;  // Minimum distance for active pinch
const PINCH_DISTANCE_MAX = 0.25;  // Maximum distance for FOV mapping

// Camera angle thresholds (in degrees)
const ANGLE_LOW_DUTCH_MAX = -15;
const ANGLE_EYE_LEVEL_MAX = 15;
const ANGLE_HIGH_ANGLE_MAX = 45;

// Vertical position thresholds for lighting
const LIGHTING_NIGHT_MAX = 0.3;
const LIGHTING_GOLDEN_MAX = 0.5;
const LIGHTING_VOLUMETRIC_MAX = 0.7;

// Fist detection thresholds
const FIST_THRESHOLD = 0.15;  // Fingertips within this distance of palm = fist
const OPEN_THRESHOLD = 0.25;  // Fingertips beyond this distance = open

// Camera angle presets
export const CAMERA_ANGLES = {
  LOW_DUTCH_TILT: 'low dutch tilt',
  EYE_LEVEL: 'eye level',
  HIGH_ANGLE: 'high angle',
  BIRDS_EYE_VIEW: "bird's eye view",
} as const;

// Lighting presets
export const LIGHTING_PRESETS = {
  NIGHT: 'night, moonlight from above',
  GOLDEN_HOUR: 'golden hour from top',
  VOLUMETRIC: 'soft volumetric god rays from left',
  STUDIO: 'bright studio lighting',
} as const;

// Composition presets
export const COMPOSITION_PRESETS = {
  CENTERED: 'subject centered',
  RULE_OF_THIRDS: 'rule of thirds',
  PANORAMIC: 'panoramic composition',
} as const;

export type CameraAngle = typeof CAMERA_ANGLES[keyof typeof CAMERA_ANGLES];
export type LightingPreset = typeof LIGHTING_PRESETS[keyof typeof LIGHTING_PRESETS];
export type CompositionPreset = typeof COMPOSITION_PRESETS[keyof typeof COMPOSITION_PRESETS];

export type HandState = 'fist' | 'open' | 'partial';

export class GestureMapper {
  private previousHandState: HandState = 'partial';
  private previousWristY: number | null = null;
  private wristYHistory: number[] = [];
  private readonly WRIST_HISTORY_SIZE = 5;  // For smoothing

  /**
   * Map pinch gesture to camera FOV
   * Calculates distance between thumb tip (landmark 4) and index tip (landmark 8)
   * Maps distance to FOV range 35-120 degrees
   * 
   * @param landmarks - Array of 21 hand landmarks
   * @returns GestureUpdate for camera FOV or null if no valid pinch detected
   */
  mapPinchToFOV(landmarks: HandLandmark[]): GestureUpdate | null {
    if (!this.validateLandmarks(landmarks)) {
      return null;
    }

    const thumbTip = landmarks[LANDMARK_INDICES.THUMB_TIP];
    const indexTip = landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP];

    // Calculate Euclidean distance between thumb and index fingertips
    const distance = this.calculateDistance(thumbTip, indexTip);

    // Only process if within valid pinch range
    if (distance < PINCH_DISTANCE_MIN || distance > PINCH_DISTANCE_MAX) {
      return null;
    }

    // Normalize distance to 0-1 range
    const normalizedDistance = (distance - PINCH_DISTANCE_MIN) / (PINCH_DISTANCE_MAX - PINCH_DISTANCE_MIN);
    
    // Map to FOV range (closer pinch = narrower FOV, wider pinch = wider FOV)
    const fov = Math.round(FOV_MIN + (normalizedDistance * (FOV_MAX - FOV_MIN)));

    // Calculate confidence based on how centered the pinch is
    const confidence = this.calculatePinchConfidence(thumbTip, indexTip, distance);

    return {
      path: 'photographic_characteristics.lens_focal_length',
      value: this.fovToLensDescription(fov),
      confidence,
    };
  }

  /**
   * Map wrist rotation to camera angle
   * Calculates rotation angle from wrist (landmark 0) and middle finger base (landmark 9)
   * Maps angle ranges to camera angle presets
   * 
   * @param landmarks - Array of 21 hand landmarks
   * @returns GestureUpdate for camera angle or null if no valid rotation detected
   */
  mapWristRotationToAngle(landmarks: HandLandmark[]): GestureUpdate | null {
    if (!this.validateLandmarks(landmarks)) {
      return null;
    }

    const wrist = landmarks[LANDMARK_INDICES.WRIST];
    const middleBase = landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP];

    // Calculate rotation angle using atan2
    const dx = middleBase.x - wrist.x;
    const dy = middleBase.y - wrist.y;
    const angleRadians = Math.atan2(dy, dx);
    const angleDegrees = angleRadians * (180 / Math.PI);

    // Map angle to camera preset
    // Note: In screen coordinates, y increases downward
    // Adjust angle interpretation: -90 is hand pointing up, 90 is pointing down
    const adjustedAngle = angleDegrees - 90;  // Normalize so 0 = hand pointing up

    let cameraAngle: CameraAngle;
    if (adjustedAngle < ANGLE_LOW_DUTCH_MAX) {
      cameraAngle = CAMERA_ANGLES.LOW_DUTCH_TILT;
    } else if (adjustedAngle < ANGLE_EYE_LEVEL_MAX) {
      cameraAngle = CAMERA_ANGLES.EYE_LEVEL;
    } else if (adjustedAngle < ANGLE_HIGH_ANGLE_MAX) {
      cameraAngle = CAMERA_ANGLES.HIGH_ANGLE;
    } else {
      cameraAngle = CAMERA_ANGLES.BIRDS_EYE_VIEW;
    }

    // Calculate confidence based on how stable the angle is
    const confidence = Math.min(1, Math.abs(Math.cos(angleRadians)) + 0.5);

    return {
      path: 'photographic_characteristics.camera_angle',
      value: cameraAngle,
      confidence,
    };
  }

  /**
   * Map vertical hand movement to lighting presets
   * Tracks wrist y-coordinate and maps to lighting presets
   * Uses moving average to smooth jitter
   * 
   * @param landmarks - Array of 21 hand landmarks
   * @returns GestureUpdate for lighting or null if no valid movement detected
   */
  mapVerticalMovementToLighting(landmarks: HandLandmark[]): GestureUpdate | null {
    if (!this.validateLandmarks(landmarks)) {
      return null;
    }

    const wrist = landmarks[LANDMARK_INDICES.WRIST];
    const currentY = wrist.y;

    // Add to history for smoothing
    this.wristYHistory.push(currentY);
    if (this.wristYHistory.length > this.WRIST_HISTORY_SIZE) {
      this.wristYHistory.shift();
    }

    // Calculate smoothed y position (moving average)
    const smoothedY = this.wristYHistory.reduce((sum, y) => sum + y, 0) / this.wristYHistory.length;

    // Map y position to lighting preset
    // Note: y=0 is top of frame, y=1 is bottom
    let lightingPreset: LightingPreset;
    if (smoothedY < LIGHTING_NIGHT_MAX) {
      lightingPreset = LIGHTING_PRESETS.NIGHT;
    } else if (smoothedY < LIGHTING_GOLDEN_MAX) {
      lightingPreset = LIGHTING_PRESETS.GOLDEN_HOUR;
    } else if (smoothedY < LIGHTING_VOLUMETRIC_MAX) {
      lightingPreset = LIGHTING_PRESETS.VOLUMETRIC;
    } else {
      lightingPreset = LIGHTING_PRESETS.STUDIO;
    }

    // Calculate confidence based on stability of y position
    const confidence = this.calculateVerticalConfidence();

    this.previousWristY = smoothedY;

    return {
      path: 'lighting.conditions',
      value: lightingPreset,
      confidence,
    };
  }

  /**
   * Map two-hand frame gesture to composition
   * Calculates bounding box from both hands and maps to composition rules
   * 
   * @param leftHand - Landmarks for left hand
   * @param rightHand - Landmarks for right hand
   * @returns GestureUpdate for composition or null if invalid hands
   */
  mapTwoHandFrameToComposition(
    leftHand: HandLandmark[],
    rightHand: HandLandmark[]
  ): GestureUpdate | null {
    if (!this.validateLandmarks(leftHand) || !this.validateLandmarks(rightHand)) {
      return null;
    }

    // Calculate bounding box from all landmarks of both hands
    const allLandmarks = [...leftHand, ...rightHand];
    const bbox = this.calculateBoundingBox(allLandmarks);

    // Analyze frame characteristics
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const aspectRatio = width / height;

    // Determine composition based on frame characteristics
    let composition: CompositionPreset;
    let confidence: number;

    // Check if frame is centered (center within 0.4-0.6 range)
    const isCentered = centerX >= 0.4 && centerX <= 0.6 && centerY >= 0.4 && centerY <= 0.6;
    
    // Check if frame is panoramic (wide aspect ratio > 1.5)
    const isPanoramic = aspectRatio > 1.5;

    if (isPanoramic) {
      composition = COMPOSITION_PRESETS.PANORAMIC;
      confidence = Math.min(1, (aspectRatio - 1.5) / 0.5 + 0.7);
    } else if (isCentered) {
      composition = COMPOSITION_PRESETS.CENTERED;
      // Higher confidence when more centered
      const centerDeviation = Math.abs(centerX - 0.5) + Math.abs(centerY - 0.5);
      confidence = Math.max(0.5, 1 - centerDeviation);
    } else {
      composition = COMPOSITION_PRESETS.RULE_OF_THIRDS;
      // Confidence based on how close to rule of thirds positions
      confidence = this.calculateRuleOfThirdsConfidence(centerX, centerY);
    }

    return {
      path: 'aesthetics.composition',
      value: composition,
      confidence,
    };
  }

  /**
   * Detect generation trigger (fist-to-open transition)
   * Tracks finger extension states and detects transition from closed fist to open hand
   * 
   * @param landmarks - Current hand landmarks
   * @param previousLandmarks - Previous frame's hand landmarks (optional)
   * @returns true if generation should be triggered
   */
  detectGenerationTrigger(
    landmarks: HandLandmark[],
    previousLandmarks?: HandLandmark[]
  ): boolean {
    if (!this.validateLandmarks(landmarks)) {
      return false;
    }

    const currentState = this.detectHandState(landmarks);
    
    // Detect transition from fist to open
    const shouldTrigger = this.previousHandState === 'fist' && currentState === 'open';
    
    // Update previous state
    this.previousHandState = currentState;

    return shouldTrigger;
  }

  /**
   * Get the current hand state (fist, open, or partial)
   * Useful for external state tracking
   */
  getCurrentHandState(): HandState {
    return this.previousHandState;
  }

  /**
   * Reset the gesture mapper state
   * Call this when hand tracking is stopped/restarted
   */
  reset(): void {
    this.previousHandState = 'partial';
    this.previousWristY = null;
    this.wristYHistory = [];
  }

  // ============ Private Helper Methods ============

  /**
   * Validate that landmarks array has expected 21 points
   */
  private validateLandmarks(landmarks: HandLandmark[]): boolean {
    return landmarks && landmarks.length === 21;
  }

  /**
   * Calculate Euclidean distance between two landmarks
   */
  private calculateDistance(a: HandLandmark, b: HandLandmark): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
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
   * Calculate confidence for pinch gesture
   */
  private calculatePinchConfidence(
    thumbTip: HandLandmark,
    indexTip: HandLandmark,
    distance: number
  ): number {
    // Higher confidence when pinch is more pronounced (smaller distance)
    const distanceConfidence = 1 - (distance / PINCH_DISTANCE_MAX);
    
    // Higher confidence when both fingers are at similar depth
    const depthDiff = Math.abs(thumbTip.z - indexTip.z);
    const depthConfidence = Math.max(0, 1 - depthDiff * 10);

    return Math.min(1, (distanceConfidence + depthConfidence) / 2);
  }

  /**
   * Calculate confidence for vertical movement based on stability
   */
  private calculateVerticalConfidence(): number {
    if (this.wristYHistory.length < 2) {
      return 0.5;
    }

    // Calculate variance in y positions
    const mean = this.wristYHistory.reduce((sum, y) => sum + y, 0) / this.wristYHistory.length;
    const variance = this.wristYHistory.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0) / this.wristYHistory.length;
    
    // Lower variance = higher confidence (more stable)
    return Math.max(0.3, Math.min(1, 1 - variance * 10));
  }

  /**
   * Calculate bounding box from landmarks
   */
  private calculateBoundingBox(landmarks: HandLandmark[]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    let minX = 1, maxX = 0, minY = 1, maxY = 0;

    for (const lm of landmarks) {
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }

    return { minX, maxX, minY, maxY };
  }

  /**
   * Calculate confidence for rule of thirds composition
   */
  private calculateRuleOfThirdsConfidence(centerX: number, centerY: number): number {
    // Rule of thirds positions: 1/3 and 2/3 of frame
    const thirdPositions = [1/3, 2/3];
    
    // Find closest third position for x and y
    const closestXThird = thirdPositions.reduce((closest, pos) => 
      Math.abs(centerX - pos) < Math.abs(centerX - closest) ? pos : closest
    );
    const closestYThird = thirdPositions.reduce((closest, pos) => 
      Math.abs(centerY - pos) < Math.abs(centerY - closest) ? pos : closest
    );

    // Calculate deviation from ideal third positions
    const xDeviation = Math.abs(centerX - closestXThird);
    const yDeviation = Math.abs(centerY - closestYThird);
    const totalDeviation = (xDeviation + yDeviation) / 2;

    return Math.max(0.4, 1 - totalDeviation * 3);
  }

  /**
   * Detect current hand state (fist, open, or partial)
   */
  private detectHandState(landmarks: HandLandmark[]): HandState {
    const palm = this.calculatePalmCenter(landmarks);
    
    // Check distance of each fingertip from palm center
    const fingertipIndices = [
      LANDMARK_INDICES.INDEX_FINGER_TIP,
      LANDMARK_INDICES.MIDDLE_FINGER_TIP,
      LANDMARK_INDICES.RING_FINGER_TIP,
      LANDMARK_INDICES.PINKY_TIP,
    ];

    let closedFingers = 0;
    let openFingers = 0;

    for (const tipIndex of fingertipIndices) {
      const distance = this.calculateDistance2D(landmarks[tipIndex], palm);
      
      if (distance < FIST_THRESHOLD) {
        closedFingers++;
      } else if (distance > OPEN_THRESHOLD) {
        openFingers++;
      }
    }

    // Fist: all 4 fingers closed
    if (closedFingers >= 4) {
      return 'fist';
    }
    
    // Open: all 4 fingers extended
    if (openFingers >= 4) {
      return 'open';
    }

    return 'partial';
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
   * Convert FOV value to lens description string
   */
  private fovToLensDescription(fov: number): string {
    if (fov <= 45) {
      return '200mm telephoto';
    } else if (fov <= 55) {
      return '85mm portrait';
    } else if (fov <= 70) {
      return '50mm standard';
    } else if (fov <= 90) {
      return '35mm wide';
    } else {
      return '24mm ultra-wide';
    }
  }
}

/**
 * Utility function to get FOV value from lens description
 * Useful for testing and reverse mapping
 */
export function lensDescriptionToFOV(lens: string): number {
  const lensMap: Record<string, number> = {
    '200mm telephoto': 40,
    '85mm portrait': 50,
    '50mm standard': 60,
    '35mm wide': 80,
    '24mm ultra-wide': 110,
  };
  return lensMap[lens] || 60;
}

/**
 * Create a default GestureMapper instance
 */
export function createGestureMapper(): GestureMapper {
  return new GestureMapper();
}
