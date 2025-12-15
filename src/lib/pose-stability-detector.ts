/**
 * PoseStabilityDetector - Detects when user holds a pose steady for capture
 * 
 * Tracks hand landmark movement over a sliding window and determines when
 * the pose is stable enough (low variance) for the configured duration
 * to trigger a freeze frame capture.
 * 
 * Requirements: 1.1, 1.2, 1.3
 */

import { type HandLandmark } from './hand-tracker';

export interface PoseStabilityConfig {
  /** Maximum movement variance to consider stable (default: 0.02) */
  stabilityThreshold: number;
  /** Seconds to hold pose for capture (default: 2) */
  holdDuration: number;
  /** Number of frames to analyze (default: 30) */
  windowSize: number;
}

export interface StabilityState {
  /** Whether the current pose is stable */
  isStable: boolean;
  /** Progress toward capture (0-1) */
  holdProgress: number;
  /** Current movement variance */
  variance: number;
}

const DEFAULT_CONFIG: PoseStabilityConfig = {
  stabilityThreshold: 0.02,
  holdDuration: 2,
  windowSize: 30,
};

export class PoseStabilityDetector {
  private config: PoseStabilityConfig;
  private landmarkHistory: HandLandmark[][] = [];
  private stabilityStartTime: number | null = null;
  private lastUpdateTime: number = 0;

  constructor(config: Partial<PoseStabilityConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update the detector with new landmarks and return stability state
   * @param landmarks - Array of hand landmarks (21 points per hand)
   * @returns Current stability state with progress
   */
  update(landmarks: HandLandmark[]): StabilityState {
    const now = performance.now();
    this.lastUpdateTime = now;

    // Add landmarks to history
    this.landmarkHistory.push([...landmarks]);

    // Trim history to window size
    while (this.landmarkHistory.length > this.config.windowSize) {
      this.landmarkHistory.shift();
    }

    // Need at least 2 frames to calculate variance
    if (this.landmarkHistory.length < 2) {
      return {
        isStable: false,
        holdProgress: 0,
        variance: 1,
      };
    }

    // Calculate movement variance
    const variance = this.calculateMovementVariance();
    const isStable = variance < this.config.stabilityThreshold;

    // Track stability duration
    if (isStable) {
      if (this.stabilityStartTime === null) {
        this.stabilityStartTime = now;
      }

      const stableDuration = (now - this.stabilityStartTime) / 1000; // Convert to seconds
      const holdProgress = Math.min(1, stableDuration / this.config.holdDuration);

      return {
        isStable: true,
        holdProgress,
        variance,
      };
    } else {
      // Movement detected - reset stability tracking
      this.stabilityStartTime = null;

      return {
        isStable: false,
        holdProgress: 0,
        variance,
      };
    }
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.landmarkHistory = [];
    this.stabilityStartTime = null;
  }

  /**
   * Get the current configuration
   */
  getConfig(): PoseStabilityConfig {
    return { ...this.config };
  }

  /**
   * Check if capture should be triggered (holdProgress reached 1.0)
   */
  shouldCapture(): boolean {
    if (this.stabilityStartTime === null) {
      return false;
    }

    const stableDuration = (this.lastUpdateTime - this.stabilityStartTime) / 1000;
    return stableDuration >= this.config.holdDuration;
  }

  /**
   * Get the current landmarks from history (most recent)
   */
  getCurrentLandmarks(): HandLandmark[] | null {
    if (this.landmarkHistory.length === 0) {
      return null;
    }
    return [...this.landmarkHistory[this.landmarkHistory.length - 1]];
  }

  /**
   * Calculate movement variance using Euclidean distance between consecutive frames
   * Returns average movement across all landmarks
   */
  private calculateMovementVariance(): number {
    if (this.landmarkHistory.length < 2) {
      return 1; // High variance when insufficient data
    }

    let totalMovement = 0;
    let frameCount = 0;

    // Calculate movement between consecutive frames
    for (let i = 1; i < this.landmarkHistory.length; i++) {
      const prevFrame = this.landmarkHistory[i - 1];
      const currFrame = this.landmarkHistory[i];

      // Skip if frames have different landmark counts
      if (prevFrame.length !== currFrame.length) {
        continue;
      }

      // Calculate average movement for this frame pair
      let frameMovement = 0;
      for (let j = 0; j < currFrame.length; j++) {
        frameMovement += this.calculateDistance(prevFrame[j], currFrame[j]);
      }
      frameMovement /= currFrame.length;

      totalMovement += frameMovement;
      frameCount++;
    }

    if (frameCount === 0) {
      return 1;
    }

    return totalMovement / frameCount;
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
}

/**
 * Create a PoseStabilityDetector with default configuration
 */
export function createPoseStabilityDetector(
  config?: Partial<PoseStabilityConfig>
): PoseStabilityDetector {
  return new PoseStabilityDetector(config);
}
