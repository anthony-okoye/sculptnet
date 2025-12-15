/**
 * Pose Capture Store - Zustand store for managing captured pose state
 * 
 * Stores captured pose data including landmarks, timestamp, and descriptor.
 * Provides actions for capturing, clearing, and retrieving pose information.
 * 
 * Requirements: 1.5, 2.5, 4.1
 */

import { create } from 'zustand';
import { type HandLandmark } from '../hand-tracker';

// ============ Types ============

/**
 * Captured pose data structure
 */
export interface CapturedPose {
  /** Unique identifier for the pose */
  id: string;
  /** Hand landmarks at time of capture */
  landmarks: HandLandmark[];
  /** Timestamp when pose was captured */
  timestamp: number;
  /** Natural language descriptor of the pose */
  descriptor: string;
  /** Optional base64 webcam snapshot */
  thumbnail?: string;
}

/**
 * Pose capture store state
 */
export interface PoseCaptureState {
  /** Currently captured pose, or null if none */
  capturedPose: CapturedPose | null;
  /** Whether a capture is in progress */
  isCapturing: boolean;
  /** Current hold progress (0-1) */
  holdProgress: number;
}

/**
 * Pose capture store actions
 */
export interface PoseCaptureActions {
  /** Capture a new pose from landmarks */
  capture: (landmarks: HandLandmark[], descriptor: string, thumbnail?: string) => void;
  /** Clear the captured pose */
  clear: () => void;
  /** Get the current pose descriptor, or null if no pose */
  getDescriptor: () => string | null;
  /** Update the hold progress during capture */
  setHoldProgress: (progress: number) => void;
  /** Set capturing state */
  setIsCapturing: (isCapturing: boolean) => void;
  /** Check if a pose is currently captured */
  hasPose: () => boolean;
  /** Get the captured pose */
  getPose: () => CapturedPose | null;
}

export type PoseCaptureStore = PoseCaptureState & PoseCaptureActions;

// ============ Utility Functions ============

/**
 * Generate a unique ID for a captured pose
 */
function generatePoseId(): string {
  return `pose_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============ Zustand Store ============

/**
 * Create the pose capture store
 */
export const usePoseCaptureStore = create<PoseCaptureStore>((set, get) => ({
  // Initial state
  capturedPose: null,
  isCapturing: false,
  holdProgress: 0,

  /**
   * Capture a new pose from landmarks
   * Replaces any existing captured pose (Requirements: 2.5)
   */
  capture: (landmarks: HandLandmark[], descriptor: string, thumbnail?: string) => {
    const pose: CapturedPose = {
      id: generatePoseId(),
      landmarks: [...landmarks], // Copy to avoid mutation
      timestamp: Date.now(),
      descriptor,
      thumbnail,
    };

    set({
      capturedPose: pose,
      isCapturing: false,
      holdProgress: 0,
    });
  },

  /**
   * Clear the captured pose (Requirements: 4.1)
   */
  clear: () => {
    set({
      capturedPose: null,
      isCapturing: false,
      holdProgress: 0,
    });
  },

  /**
   * Get the current pose descriptor, or null if no pose
   */
  getDescriptor: (): string | null => {
    const { capturedPose } = get();
    return capturedPose?.descriptor ?? null;
  },

  /**
   * Update the hold progress during capture
   */
  setHoldProgress: (progress: number) => {
    set({ holdProgress: Math.max(0, Math.min(1, progress)) });
  },

  /**
   * Set capturing state
   */
  setIsCapturing: (isCapturing: boolean) => {
    set({ isCapturing });
  },

  /**
   * Check if a pose is currently captured
   */
  hasPose: (): boolean => {
    return get().capturedPose !== null;
  },

  /**
   * Get the captured pose
   */
  getPose: (): CapturedPose | null => {
    return get().capturedPose;
  },
}));

// ============ Standalone Class (for non-React usage) ============

/**
 * Standalone Pose Capture Manager
 * Useful for testing or non-React contexts
 */
export class PoseCaptureManager {
  private capturedPose: CapturedPose | null = null;
  private isCapturing: boolean = false;
  private holdProgress: number = 0;

  capture(landmarks: HandLandmark[], descriptor: string, thumbnail?: string): void {
    this.capturedPose = {
      id: generatePoseId(),
      landmarks: [...landmarks],
      timestamp: Date.now(),
      descriptor,
      thumbnail,
    };
    this.isCapturing = false;
    this.holdProgress = 0;
  }

  clear(): void {
    this.capturedPose = null;
    this.isCapturing = false;
    this.holdProgress = 0;
  }

  getDescriptor(): string | null {
    return this.capturedPose?.descriptor ?? null;
  }

  setHoldProgress(progress: number): void {
    this.holdProgress = Math.max(0, Math.min(1, progress));
  }

  setIsCapturing(isCapturing: boolean): void {
    this.isCapturing = isCapturing;
  }

  hasPose(): boolean {
    return this.capturedPose !== null;
  }

  getPose(): CapturedPose | null {
    return this.capturedPose;
  }

  getState(): PoseCaptureState {
    return {
      capturedPose: this.capturedPose,
      isCapturing: this.isCapturing,
      holdProgress: this.holdProgress,
    };
  }
}

/**
 * Create a new PoseCaptureManager instance
 */
export function createPoseCaptureManager(): PoseCaptureManager {
  return new PoseCaptureManager();
}
