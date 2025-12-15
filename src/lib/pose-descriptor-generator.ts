/**
 * Pose Descriptor Generator - Converts hand landmarks to natural language descriptors
 * 
 * Analyzes hand landmark positions to determine orientation, hand height, hand spread,
 * and gesture patterns. Generates natural language descriptors for FIBO prompt injection.
 * 
 * Requirements: 2.1, 2.3
 */

import { type HandLandmark, LANDMARK_INDICES } from './hand-tracker';

// ============ Types ============

/**
 * Pose descriptor components
 */
export interface PoseDescriptor {
  /** Body/hand orientation: "facing forward", "turned left", "turned right" */
  orientation: string;
  /** Hand position: "hands raised", "hands lowered", "hands at neutral" */
  handPosition: string;
  /** Hand spread: "wide", "narrow", "together" */
  composition: string;
  /** Detected gesture: "open palms", "pointing", "closed fists", etc. */
  gesture: string;
}

/**
 * Thresholds for pose analysis
 */
export interface PoseAnalysisConfig {
  /** Y threshold for raised hands (0-1, lower = higher on screen) */
  raisedThreshold: number;
  /** Y threshold for lowered hands (0-1, higher = lower on screen) */
  loweredThreshold: number;
  /** X distance threshold for wide spread (0-1) */
  wideSpreadThreshold: number;
  /** X distance threshold for hands together (0-1) */
  togetherThreshold: number;
  /** X threshold for left/right orientation bias (0-1, relative to center 0.5) */
  orientationBias: number;
}

// ============ Constants ============

/**
 * Default configuration for pose analysis
 */
export const DEFAULT_POSE_CONFIG: PoseAnalysisConfig = {
  raisedThreshold: 0.35,      // Hands above 35% from top = raised
  loweredThreshold: 0.65,     // Hands below 65% from top = lowered
  wideSpreadThreshold: 0.5,   // Hands more than 50% apart = wide
  togetherThreshold: 0.15,    // Hands less than 15% apart = together
  orientationBias: 0.15,      // 15% off center = directional bias
};

/**
 * Pose-to-text mapping for FIBO descriptors
 */
const POSE_TEXT_MAPPINGS = {
  // Orientation mappings
  orientation: {
    left: 'turned slightly left',
    right: 'turned slightly right',
    center: 'facing forward',
  },
  // Hand position mappings
  handPosition: {
    raised: 'with arms raised',
    lowered: 'with arms lowered',
    neutral: 'in a natural stance',
  },
  // Composition/spread mappings
  composition: {
    wide: 'in an expansive, welcoming pose',
    narrow: 'in a contained, focused pose',
    together: 'in a contemplative, centered pose',
  },
  // Gesture mappings
  gesture: {
    openPalms: 'with open palms',
    pointing: 'gesturing directionally',
    closedFists: 'with determined expression',
    relaxed: 'in a relaxed position',
  },
} as const;

// ============ Analysis Functions ============

/**
 * Calculate the average position of wrist landmarks
 * @param landmarks - Array of hand landmarks (can be from one or two hands)
 * @returns Average x, y position of wrists
 */
function getWristPositions(landmarks: HandLandmark[]): { x: number; y: number }[] {
  const wrists: { x: number; y: number }[] = [];
  
  // Each hand has 21 landmarks, wrist is at index 0
  const landmarksPerHand = 21;
  const numHands = Math.floor(landmarks.length / landmarksPerHand);
  
  for (let i = 0; i < numHands; i++) {
    const wristIndex = i * landmarksPerHand + LANDMARK_INDICES.WRIST;
    if (wristIndex < landmarks.length) {
      wrists.push({
        x: landmarks[wristIndex].x,
        y: landmarks[wristIndex].y,
      });
    }
  }
  
  // If landmarks aren't in multi-hand format, just use the first wrist
  if (wrists.length === 0 && landmarks.length > 0) {
    wrists.push({
      x: landmarks[LANDMARK_INDICES.WRIST].x,
      y: landmarks[LANDMARK_INDICES.WRIST].y,
    });
  }
  
  return wrists;
}

/**
 * Analyze hand orientation based on wrist positions
 * @param wrists - Array of wrist positions
 * @param config - Analysis configuration
 * @returns Orientation string
 */
function analyzeOrientation(
  wrists: { x: number; y: number }[],
  config: PoseAnalysisConfig
): string {
  if (wrists.length === 0) {
    return POSE_TEXT_MAPPINGS.orientation.center;
  }
  
  // Calculate average X position
  const avgX = wrists.reduce((sum, w) => sum + w.x, 0) / wrists.length;
  const centerX = 0.5;
  
  if (avgX < centerX - config.orientationBias) {
    return POSE_TEXT_MAPPINGS.orientation.left;
  } else if (avgX > centerX + config.orientationBias) {
    return POSE_TEXT_MAPPINGS.orientation.right;
  }
  
  return POSE_TEXT_MAPPINGS.orientation.center;
}

/**
 * Analyze hand height based on wrist Y positions
 * @param wrists - Array of wrist positions
 * @param config - Analysis configuration
 * @returns Hand position string
 */
function analyzeHandHeight(
  wrists: { x: number; y: number }[],
  config: PoseAnalysisConfig
): string {
  if (wrists.length === 0) {
    return POSE_TEXT_MAPPINGS.handPosition.neutral;
  }
  
  // Calculate average Y position (lower Y = higher on screen)
  const avgY = wrists.reduce((sum, w) => sum + w.y, 0) / wrists.length;
  
  if (avgY < config.raisedThreshold) {
    return POSE_TEXT_MAPPINGS.handPosition.raised;
  } else if (avgY > config.loweredThreshold) {
    return POSE_TEXT_MAPPINGS.handPosition.lowered;
  }
  
  return POSE_TEXT_MAPPINGS.handPosition.neutral;
}

/**
 * Analyze hand spread based on distance between wrists
 * @param wrists - Array of wrist positions
 * @param config - Analysis configuration
 * @returns Composition string
 */
function analyzeHandSpread(
  wrists: { x: number; y: number }[],
  config: PoseAnalysisConfig
): string {
  if (wrists.length < 2) {
    // Single hand - use position relative to center
    if (wrists.length === 1) {
      const distFromCenter = Math.abs(wrists[0].x - 0.5);
      if (distFromCenter > config.wideSpreadThreshold / 2) {
        return POSE_TEXT_MAPPINGS.composition.wide;
      }
    }
    return POSE_TEXT_MAPPINGS.composition.narrow;
  }
  
  // Calculate horizontal distance between hands
  const xDistance = Math.abs(wrists[0].x - wrists[1].x);
  
  if (xDistance > config.wideSpreadThreshold) {
    return POSE_TEXT_MAPPINGS.composition.wide;
  } else if (xDistance < config.togetherThreshold) {
    return POSE_TEXT_MAPPINGS.composition.together;
  }
  
  return POSE_TEXT_MAPPINGS.composition.narrow;
}

/**
 * Analyze gesture based on finger positions
 * @param landmarks - Hand landmarks
 * @returns Gesture string
 */
function analyzeGesture(landmarks: HandLandmark[]): string {
  if (landmarks.length < 21) {
    return POSE_TEXT_MAPPINGS.gesture.relaxed;
  }
  
  // Check finger extension by comparing tip Y to MCP Y
  // Lower Y = higher on screen = extended
  const fingerTips = [
    LANDMARK_INDICES.INDEX_FINGER_TIP,
    LANDMARK_INDICES.MIDDLE_FINGER_TIP,
    LANDMARK_INDICES.RING_FINGER_TIP,
    LANDMARK_INDICES.PINKY_TIP,
  ];
  
  const fingerMCPs = [
    LANDMARK_INDICES.INDEX_FINGER_MCP,
    LANDMARK_INDICES.MIDDLE_FINGER_MCP,
    LANDMARK_INDICES.RING_FINGER_MCP,
    LANDMARK_INDICES.PINKY_MCP,
  ];
  
  let extendedFingers = 0;
  
  for (let i = 0; i < fingerTips.length; i++) {
    const tipY = landmarks[fingerTips[i]]?.y ?? 0;
    const mcpY = landmarks[fingerMCPs[i]]?.y ?? 0;
    
    // Finger is extended if tip is above (lower Y) than MCP
    if (tipY < mcpY - 0.05) {
      extendedFingers++;
    }
  }
  
  // Check if index finger is pointing (only index extended)
  const indexExtended = (landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP]?.y ?? 0) < 
                        (landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP]?.y ?? 0) - 0.05;
  
  if (extendedFingers >= 3) {
    return POSE_TEXT_MAPPINGS.gesture.openPalms;
  } else if (extendedFingers === 1 && indexExtended) {
    return POSE_TEXT_MAPPINGS.gesture.pointing;
  } else if (extendedFingers === 0) {
    return POSE_TEXT_MAPPINGS.gesture.closedFists;
  }
  
  return POSE_TEXT_MAPPINGS.gesture.relaxed;
}

// ============ Main Functions ============

/**
 * Generate a pose descriptor from hand landmarks
 * @param landmarks - Array of hand landmarks
 * @param config - Optional analysis configuration
 * @returns PoseDescriptor object
 * 
 * Requirements: 2.1
 */
export function generatePoseDescriptor(
  landmarks: HandLandmark[],
  config: PoseAnalysisConfig = DEFAULT_POSE_CONFIG
): PoseDescriptor {
  const wrists = getWristPositions(landmarks);
  
  return {
    orientation: analyzeOrientation(wrists, config),
    handPosition: analyzeHandHeight(wrists, config),
    composition: analyzeHandSpread(wrists, config),
    gesture: analyzeGesture(landmarks),
  };
}

/**
 * Convert a pose descriptor to natural language text for FIBO prompt injection
 * @param descriptor - PoseDescriptor object
 * @returns Natural language string describing the pose
 * 
 * Requirements: 2.3
 */
export function poseToPromptText(descriptor: PoseDescriptor): string {
  const parts: string[] = [];
  
  // Build the descriptor string from components
  // Format: "subject [orientation] [handPosition] [composition] [gesture]"
  
  if (descriptor.orientation !== POSE_TEXT_MAPPINGS.orientation.center) {
    parts.push(descriptor.orientation);
  }
  
  if (descriptor.handPosition !== POSE_TEXT_MAPPINGS.handPosition.neutral) {
    parts.push(descriptor.handPosition);
  }
  
  if (descriptor.composition) {
    parts.push(descriptor.composition);
  }
  
  if (descriptor.gesture !== POSE_TEXT_MAPPINGS.gesture.relaxed) {
    parts.push(descriptor.gesture);
  }
  
  // If no distinctive features, return a default
  if (parts.length === 0) {
    return 'in a relaxed, natural stance';
  }
  
  return parts.join(', ');
}

/**
 * Generate a complete pose descriptor string from landmarks
 * Combines generatePoseDescriptor and poseToPromptText
 * @param landmarks - Array of hand landmarks
 * @param config - Optional analysis configuration
 * @returns Natural language string describing the pose
 * 
 * Requirements: 2.1, 2.3
 */
export function landmarksToDescriptor(
  landmarks: HandLandmark[],
  config: PoseAnalysisConfig = DEFAULT_POSE_CONFIG
): string {
  if (!landmarks || landmarks.length === 0) {
    return 'in a relaxed, natural stance';
  }
  
  const descriptor = generatePoseDescriptor(landmarks, config);
  return poseToPromptText(descriptor);
}

// ============ Exports ============

export {
  POSE_TEXT_MAPPINGS,
  getWristPositions,
  analyzeOrientation,
  analyzeHandHeight,
  analyzeHandSpread,
  analyzeGesture,
};
