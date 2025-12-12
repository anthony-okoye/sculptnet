/**
 * HandTracker - Manages hand landmark detection using MediaPipe
 * 
 * Handles initialization of MediaPipe HandLandmarker model, detection loop
 * management, and provides hand landmark data for gesture recognition.
 * 
 * Requirements: 3.1, 3.2, 3.5, 4.4
 */

import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { logError, logInfo, logWarning } from './error-logger';

export interface HandLandmark {
  x: number;  // Normalized 0-1 by image width
  y: number;  // Normalized 0-1 by image height
  z: number;  // Depth relative to wrist (smaller = closer to camera)
}

export interface HandDetectionResult {
  landmarks: HandLandmark[];  // 21 points per hand
  handedness: 'Left' | 'Right';
  worldLandmarks: HandLandmark[];  // Real-world 3D coordinates in meters
}

export type HandTrackerErrorType =
  | 'model_load_failed'
  | 'wasm_load_failed'
  | 'not_initialized'
  | 'already_running'
  | 'invalid_video'
  | 'unknown';

export interface HandTrackerError {
  type: HandTrackerErrorType;
  message: string;
  originalError?: Error;
}

export interface HandTrackerOptions {
  numHands?: number;
  minDetectionConfidence?: number;
  minPresenceConfidence?: number;
  minTrackingConfidence?: number;
  modelAssetPath?: string;
  wasmPath?: string;
}

export type DetectionCallback = (results: HandDetectionResult[]) => void;

const DEFAULT_OPTIONS: Required<HandTrackerOptions> = {
  numHands: 2,
  minDetectionConfidence: 0.5,
  minPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  wasmPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
};

// Default detection rate: 20 FPS (50ms interval)
const DEFAULT_FPS = 20;
const MIN_FPS = 10;
const MAX_FPS = 30;

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private options: Required<HandTrackerOptions>;
  private detectionInterval: ReturnType<typeof setInterval> | null = null;
  private lastVideoTime: number = -1;
  private detectionFps: number = DEFAULT_FPS;
  private isRunning: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  private callback: DetectionCallback | null = null;

  constructor(options: HandTrackerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize the MediaPipe HandLandmarker model
   * @throws HandTrackerError if initialization fails
   */
  async initialize(): Promise<void> {
    logInfo('Initializing hand tracker', {
      component: 'HandTracker',
      action: 'initialize',
      metadata: {
        numHands: this.options.numHands,
        fps: this.options.fps,
      },
    });

    try {
      // Load the vision WASM module
      const vision = await FilesetResolver.forVisionTasks(this.options.wasmPath);

      // Create the HandLandmarker instance
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.options.modelAssetPath,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: this.options.numHands,
        minHandDetectionConfidence: this.options.minDetectionConfidence,
        minHandPresenceConfidence: this.options.minPresenceConfidence,
        minTrackingConfidence: this.options.minTrackingConfidence,
      });

      logInfo('Hand tracker initialized successfully', {
        component: 'HandTracker',
        action: 'initialize',
      });
    } catch (error) {
      const handTrackerError = this.handleInitializationError(error);
      logError('Hand tracker initialization failed', handTrackerError.originalError, {
        component: 'HandTracker',
        action: 'initialize',
        metadata: {
          errorType: handTrackerError.type,
          message: handTrackerError.message,
        },
      });
      throw handTrackerError;
    }
  }


  /**
   * Start hand detection on the provided video element
   * @param videoElement - The HTMLVideoElement to process
   * @param callback - Function called with detection results
   * @throws HandTrackerError if not initialized or already running
   */
  startDetection(videoElement: HTMLVideoElement, callback: DetectionCallback): void {
    if (!this.handLandmarker) {
      throw this.createError('not_initialized', 'HandTracker must be initialized before starting detection');
    }

    if (this.isRunning) {
      throw this.createError('already_running', 'Detection is already running. Call stopDetection() first.');
    }

    if (!videoElement || !this.isVideoElement(videoElement)) {
      throw this.createError('invalid_video', 'A valid HTMLVideoElement is required');
    }

    this.videoElement = videoElement;
    this.callback = callback;
    this.lastVideoTime = -1;
    this.isRunning = true;

    // Calculate interval from FPS
    const intervalMs = Math.round(1000 / this.detectionFps);

    // Start the detection loop using setInterval
    this.detectionInterval = setInterval(() => {
      this.processFrame();
    }, intervalMs);
  }

  /**
   * Stop the detection loop
   */
  stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    this.isRunning = false;
    this.videoElement = null;
    this.callback = null;
    this.lastVideoTime = -1;
  }

  /**
   * Set the detection frame rate
   * @param fps - Target frames per second (clamped to 10-30 range)
   */
  setDetectionRate(fps: number): void {
    // Clamp FPS to valid range
    this.detectionFps = Math.max(MIN_FPS, Math.min(MAX_FPS, fps));

    // If currently running, restart with new rate
    if (this.isRunning && this.videoElement && this.callback) {
      const videoElement = this.videoElement;
      const callback = this.callback;
      
      this.stopDetection();
      this.startDetection(videoElement, callback);
    }
  }

  /**
   * Get the current detection rate
   * @returns Current FPS setting
   */
  getDetectionRate(): number {
    return this.detectionFps;
  }

  /**
   * Check if detection is currently running
   * @returns true if detection loop is active
   */
  isDetecting(): boolean {
    return this.isRunning;
  }

  /**
   * Check if the tracker has been initialized
   * @returns true if HandLandmarker is ready
   */
  isInitialized(): boolean {
    return this.handLandmarker !== null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopDetection();
    
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
  }

  /**
   * Process a single video frame for hand detection
   */
  private processFrame(): void {
    if (!this.handLandmarker || !this.videoElement || !this.callback) {
      return;
    }

    const video = this.videoElement;

    // Skip if video is not ready or frame hasn't changed
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    // Only process if we have a new frame
    if (video.currentTime === this.lastVideoTime) {
      return;
    }

    this.lastVideoTime = video.currentTime;

    try {
      // Use detectForVideo with current timestamp for real-time processing
      const result = this.handLandmarker.detectForVideo(video, performance.now());
      const detectionResults = this.convertResults(result);
      this.callback(detectionResults);
    } catch (error) {
      // Log error but don't stop detection - allow recovery
      logWarning('Hand detection error (continuing)', {
        component: 'HandTracker',
        action: 'detectHands',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  /**
   * Convert MediaPipe results to our HandDetectionResult format
   */
  private convertResults(result: HandLandmarkerResult): HandDetectionResult[] {
    const detectionResults: HandDetectionResult[] = [];

    if (!result.landmarks || result.landmarks.length === 0) {
      return detectionResults;
    }

    for (let i = 0; i < result.landmarks.length; i++) {
      const landmarks = result.landmarks[i];
      const worldLandmarks = result.worldLandmarks?.[i] || [];
      const handedness = result.handednesses?.[i]?.[0]?.categoryName as 'Left' | 'Right' || 'Right';

      detectionResults.push({
        landmarks: landmarks.map(lm => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
        })),
        handedness,
        worldLandmarks: worldLandmarks.map(lm => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
        })),
      });
    }

    return detectionResults;
  }

  /**
   * Check if an object is a valid video element (duck typing for test compatibility)
   */
  private isVideoElement(obj: unknown): obj is HTMLVideoElement {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    // Check for essential video element properties
    const video = obj as Record<string, unknown>;
    return (
      'readyState' in video &&
      'currentTime' in video &&
      typeof video.readyState === 'number' &&
      typeof video.currentTime === 'number'
    );
  }

  /**
   * Handle initialization errors
   */
  private handleInitializationError(error: unknown): HandTrackerError {
    if (!(error instanceof Error)) {
      return this.createError('unknown', 'An unknown error occurred during initialization', new Error(String(error)));
    }

    const errorMessage = error.message.toLowerCase();

    // Check for WASM loading errors
    if (errorMessage.includes('wasm') || errorMessage.includes('fileset')) {
      return this.createError(
        'wasm_load_failed',
        'Failed to load MediaPipe WASM module. Check your internet connection.',
        error
      );
    }

    // Check for model loading errors
    if (errorMessage.includes('model') || errorMessage.includes('asset')) {
      return this.createError(
        'model_load_failed',
        'Failed to load hand tracking model. Check your internet connection.',
        error
      );
    }

    return this.createError('unknown', error.message || 'Failed to initialize hand tracker', error);
  }

  /**
   * Create a HandTrackerError object
   */
  private createError(type: HandTrackerErrorType, message: string, originalError?: Error): HandTrackerError {
    return {
      type,
      message,
      originalError,
    };
  }
}

/**
 * Landmark indices for easy reference
 */
export const LANDMARK_INDICES = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

/**
 * Get user-friendly error message for display
 */
export function getHandTrackerErrorMessage(error: HandTrackerError): string {
  switch (error.type) {
    case 'model_load_failed':
      return 'Failed to load hand tracking model. Please check your internet connection and try again.';
    case 'wasm_load_failed':
      return 'Failed to load required components. Please check your internet connection and try again.';
    case 'not_initialized':
      return 'Hand tracker is not ready. Please wait for initialization to complete.';
    case 'already_running':
      return 'Hand tracking is already active.';
    case 'invalid_video':
      return 'Invalid video source provided for hand tracking.';
    default:
      return error.message || 'An error occurred with hand tracking.';
  }
}
