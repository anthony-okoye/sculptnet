/**
 * Application Controller
 * 
 * Main orchestrator that wires together all SculptNet components:
 * - WebcamManager: Webcam stream access
 * - HandTracker: MediaPipe hand detection
 * - GestureMapper: Gesture to JSON parameter mapping
 * - JSONStateManager: FIBO prompt state management
 * - BriaClient: Image generation API
 * - ARSceneManager: AR scene rendering (managed externally via React hook)
 * 
 * Implements the complete event flow:
 * webcam → hand tracking → gesture mapping → JSON updates → image generation → AR rendering
 * 
 * Requirements: 2.1, 3.1, 10.4
 */

import { WebcamManager, type WebcamError, getWebcamErrorMessage } from './webcam-manager';
import { HandTracker, type HandDetectionResult, type HandTrackerError, getHandTrackerErrorMessage } from './hand-tracker';
import { GestureMapper, type GestureUpdate } from './gesture-mapper';
import { JSONStateManager } from './stores/prompt-store';
import { BriaClient, type GenerationResult, BriaAPIError } from './bria-client';
import type { FIBOStructuredPrompt } from '@/types/fibo';

// ============ Types ============

/**
 * Application lifecycle state
 */
export type AppState = 
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'error'
  | 'stopped';

/**
 * Application error types
 */
export type AppErrorType =
  | 'webcam_error'
  | 'hand_tracker_error'
  | 'generation_error'
  | 'initialization_error'
  | 'unknown_error';

/**
 * Application error
 */
export interface AppError {
  type: AppErrorType;
  message: string;
  originalError?: Error;
  userMessage: string;
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** Detection frame rate (10-30 FPS) */
  detectionFps?: number;
  /** Debounce delay for parameter updates (ms) */
  debounceDelay?: number;
  /** Minimum time between generations (ms) */
  generationCooldown?: number;
  /** Webcam resolution */
  webcamWidth?: number;
  webcamHeight?: number;
}

/**
 * Application event callbacks
 */
export interface AppCallbacks {
  /** Called when state changes */
  onStateChange?: (state: AppState) => void;
  /** Called when an error occurs */
  onError?: (error: AppError) => void;
  /** Called when gesture updates occur */
  onGestureUpdate?: (update: GestureUpdate) => void;
  /** Called when prompt state changes */
  onPromptUpdate?: (prompt: FIBOStructuredPrompt) => void;
  /** Called when image generation starts */
  onGenerationStart?: () => void;
  /** Called when image generation completes */
  onGenerationComplete?: (result: GenerationResult) => void;
  /** Called when generation trigger is detected */
  onGenerationTrigger?: () => void;
  /** Called when hands are detected/lost */
  onHandsDetected?: (count: number) => void;
}

// ============ Constants ============

const DEFAULT_CONFIG: Required<AppConfig> = {
  detectionFps: 20,
  debounceDelay: 100,
  generationCooldown: 5000,
  webcamWidth: 1280,
  webcamHeight: 720,
};

// ============ Application Controller ============

/**
 * Main Application Controller
 * 
 * Orchestrates all components and manages the application lifecycle.
 */
export class AppController {
  // Components
  private webcamManager: WebcamManager;
  private handTracker: HandTracker;
  private gestureMapper: GestureMapper;
  private jsonStateManager: JSONStateManager;
  private briaClient: BriaClient;

  // State
  private state: AppState = 'uninitialized';
  private config: Required<AppConfig>;
  private callbacks: AppCallbacks;
  private lastError: AppError | null = null;

  // Debouncing and cooldown
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastGenerationTime: number = 0;
  private isGenerating: boolean = false;

  // Hand tracking state
  private lastHandCount: number = 0;

  constructor(config: AppConfig = {}, callbacks: AppCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;

    // Initialize components
    this.webcamManager = new WebcamManager({
      width: this.config.webcamWidth,
      height: this.config.webcamHeight,
    });

    this.handTracker = new HandTracker();
    this.gestureMapper = new GestureMapper();
    this.jsonStateManager = new JSONStateManager();
    this.briaClient = new BriaClient();
  }

  /**
   * Get current application state
   */
  getState(): AppState {
    return this.state;
  }

  /**
   * Get last error
   */
  getLastError(): AppError | null {
    return this.lastError;
  }

  /**
   * Get current prompt
   */
  getCurrentPrompt(): FIBOStructuredPrompt {
    return this.jsonStateManager.getPrompt();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AppConfig>): void {
    this.config = { ...this.config, ...config };

    // Apply detection FPS if changed
    if (config.detectionFps !== undefined && this.handTracker.isInitialized()) {
      this.handTracker.setDetectionRate(config.detectionFps);
    }
  }

  /**
   * Initialize the application
   * Sets up webcam, hand tracker, and JSON state
   */
  async initialize(): Promise<void> {
    if (this.state !== 'uninitialized' && this.state !== 'stopped') {
      throw new Error(`Cannot initialize from state: ${this.state}`);
    }

    this.setState('initializing');

    try {
      // Initialize JSON state manager with default prompt
      this.jsonStateManager.initialize();

      // Initialize webcam
      await this.webcamManager.initialize();

      // Initialize hand tracker
      await this.handTracker.initialize();

      // Set detection rate
      this.handTracker.setDetectionRate(this.config.detectionFps);

      this.setState('ready');
    } catch (error) {
      const appError = this.handleInitializationError(error);
      this.lastError = appError;
      this.setState('error');
      this.callbacks.onError?.(appError);
      throw appError;
    }
  }

  /**
   * Start the application
   * Begins hand tracking and gesture detection
   */
  start(): void {
    if (this.state !== 'ready' && this.state !== 'paused') {
      throw new Error(`Cannot start from state: ${this.state}`);
    }

    const videoElement = this.webcamManager.getVideoElement();
    if (!videoElement) {
      const error = this.createError(
        'initialization_error',
        'Video element not available',
        'Camera is not ready. Please try again.'
      );
      this.lastError = error;
      this.setState('error');
      this.callbacks.onError?.(error);
      return;
    }

    try {
      // Start hand detection with callback
      this.handTracker.startDetection(videoElement, (results) => {
        this.handleHandDetection(results);
      });

      this.setState('running');
    } catch (error) {
      const appError = this.handleHandTrackerError(error);
      this.lastError = appError;
      this.setState('error');
      this.callbacks.onError?.(appError);
    }
  }

  /**
   * Pause the application
   * Stops hand tracking but keeps webcam active
   */
  pause(): void {
    if (this.state !== 'running') {
      return;
    }

    this.handTracker.stopDetection();
    this.setState('paused');
  }

  /**
   * Resume the application from paused state
   */
  resume(): void {
    if (this.state !== 'paused') {
      return;
    }

    this.start();
  }

  /**
   * Stop the application
   * Stops hand tracking and releases webcam
   */
  stop(): void {
    if (this.state === 'uninitialized' || this.state === 'stopped') {
      return;
    }

    // Stop hand tracking
    if (this.handTracker.isDetecting()) {
      this.handTracker.stopDetection();
    }

    // Stop webcam
    if (this.webcamManager.isActive()) {
      this.webcamManager.stop();
    }

    // Cancel any ongoing generation
    this.briaClient.cancel();

    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.setState('stopped');
  }

  /**
   * Reset the application
   * Stops everything and resets to uninitialized state
   */
  reset(): void {
    this.stop();

    // Reset components
    this.gestureMapper.reset();
    this.jsonStateManager.reset();
    this.lastError = null;
    this.lastGenerationTime = 0;
    this.isGenerating = false;
    this.lastHandCount = 0;

    this.setState('uninitialized');
  }

  /**
   * Manually trigger image generation
   * Useful for UI buttons
   */
  async generateImage(): Promise<GenerationResult> {
    if (this.isGenerating) {
      throw new Error('Generation already in progress');
    }

    // Check cooldown
    const timeSinceLastGeneration = Date.now() - this.lastGenerationTime;
    if (timeSinceLastGeneration < this.config.generationCooldown) {
      const remainingCooldown = Math.ceil(
        (this.config.generationCooldown - timeSinceLastGeneration) / 1000
      );
      throw new Error(`Please wait ${remainingCooldown} seconds before generating again`);
    }

    return this.triggerGeneration();
  }

  /**
   * Update prompt manually
   * Useful for JSON editor
   */
  updatePrompt(path: string, value: unknown): boolean {
    const result = this.jsonStateManager.update(path, value);

    if (result.success) {
      this.callbacks.onPromptUpdate?.(this.jsonStateManager.getPrompt());
    }

    return result.success;
  }

  /**
   * Import prompt from JSON
   */
  importPrompt(json: string): boolean {
    const result = this.jsonStateManager.import(json);

    if (result.success) {
      this.callbacks.onPromptUpdate?.(this.jsonStateManager.getPrompt());
    }

    return result.success;
  }

  /**
   * Export current prompt as JSON
   */
  exportPrompt(): string {
    return this.jsonStateManager.export();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.handTracker.dispose();
  }

  // ============ Private Methods ============

  /**
   * Handle hand detection results
   */
  private handleHandDetection(results: HandDetectionResult[]): void {
    // Notify if hand count changed
    if (results.length !== this.lastHandCount) {
      this.lastHandCount = results.length;
      this.callbacks.onHandsDetected?.(results.length);
    }

    // No hands detected - preserve state (Requirement 3.4)
    if (results.length === 0) {
      return;
    }

    // Process gestures from detected hands
    this.processGestures(results);
  }

  /**
   * Process gestures and update prompt state
   */
  private processGestures(results: HandDetectionResult[]): void {
    const updates: GestureUpdate[] = [];

    // Single hand gestures
    if (results.length >= 1) {
      const hand = results[0];

      // Check for generation trigger (fist-to-open)
      const shouldGenerate = this.gestureMapper.detectGenerationTrigger(hand.landmarks);
      if (shouldGenerate) {
        this.callbacks.onGenerationTrigger?.();
        this.triggerGeneration().catch(error => {
          console.error('Generation failed:', error);
        });
        return; // Don't process other gestures during generation trigger
      }

      // Pinch gesture → FOV
      const pinchUpdate = this.gestureMapper.mapPinchToFOV(hand.landmarks);
      if (pinchUpdate) {
        updates.push(pinchUpdate);
      }

      // Wrist rotation → Camera angle
      const rotationUpdate = this.gestureMapper.mapWristRotationToAngle(hand.landmarks);
      if (rotationUpdate) {
        updates.push(rotationUpdate);
      }

      // Vertical movement → Lighting
      const lightingUpdate = this.gestureMapper.mapVerticalMovementToLighting(hand.landmarks);
      if (lightingUpdate) {
        updates.push(lightingUpdate);
      }
    }

    // Two-hand gestures
    if (results.length >= 2) {
      const leftHand = results.find(r => r.handedness === 'Left');
      const rightHand = results.find(r => r.handedness === 'Right');

      if (leftHand && rightHand) {
        // Two-hand frame → Composition
        const compositionUpdate = this.gestureMapper.mapTwoHandFrameToComposition(
          leftHand.landmarks,
          rightHand.landmarks
        );
        if (compositionUpdate) {
          updates.push(compositionUpdate);
        }
      }
    }

    // Apply updates with debouncing
    if (updates.length > 0) {
      this.applyGestureUpdates(updates);
    }
  }

  /**
   * Apply gesture updates to prompt state with debouncing
   */
  private applyGestureUpdates(updates: GestureUpdate[]): void {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      // Apply each update
      for (const update of updates) {
        const result = this.jsonStateManager.update(update.path, update.value);

        if (result.success) {
          this.callbacks.onGestureUpdate?.(update);
        }
      }

      // Notify of prompt update
      this.callbacks.onPromptUpdate?.(this.jsonStateManager.getPrompt());

      this.debounceTimer = null;
    }, this.config.debounceDelay);
  }

  /**
   * Trigger image generation
   */
  private async triggerGeneration(): Promise<GenerationResult> {
    // Check if already generating
    if (this.isGenerating) {
      throw new Error('Generation already in progress');
    }

    // Check cooldown
    const timeSinceLastGeneration = Date.now() - this.lastGenerationTime;
    if (timeSinceLastGeneration < this.config.generationCooldown) {
      throw new Error('Generation cooldown active');
    }

    this.isGenerating = true;
    this.callbacks.onGenerationStart?.();

    try {
      const prompt = this.jsonStateManager.getPrompt();
      
      // Get HDR setting from localStorage
      // Requirements: 16.1 - Add HDR-related parameters to API request
      const hdrEnabled = typeof window !== 'undefined' 
        ? localStorage.getItem('sculptnet_hdr_enabled') === 'true'
        : false;
      
      const result = await this.briaClient.generate(prompt, {
        hdr: hdrEnabled,
        color_depth: hdrEnabled ? 16 : 8,
      });

      this.lastGenerationTime = Date.now();
      this.isGenerating = false;

      this.callbacks.onGenerationComplete?.(result);

      return result;
    } catch (error) {
      this.isGenerating = false;

      const appError = this.handleGenerationError(error);
      this.lastError = appError;
      this.callbacks.onError?.(appError);

      throw appError;
    }
  }

  /**
   * Set application state and notify callback
   */
  private setState(newState: AppState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange?.(newState);
    }
  }

  /**
   * Create an application error
   */
  private createError(
    type: AppErrorType,
    message: string,
    userMessage: string,
    originalError?: Error
  ): AppError {
    return {
      type,
      message,
      userMessage,
      originalError,
    };
  }

  /**
   * Handle initialization errors
   */
  private handleInitializationError(error: unknown): AppError {
    // Webcam error
    if (this.isWebcamError(error)) {
      return this.createError(
        'webcam_error',
        error.message,
        getWebcamErrorMessage(error),
        error.originalError
      );
    }

    // Hand tracker error
    if (this.isHandTrackerError(error)) {
      return this.createError(
        'hand_tracker_error',
        error.message,
        getHandTrackerErrorMessage(error),
        error.originalError
      );
    }

    // Generic error
    const errorMessage = error instanceof Error ? error.message : String(error);
    return this.createError(
      'initialization_error',
      errorMessage,
      'Failed to initialize the application. Please refresh and try again.',
      error instanceof Error ? error : undefined
    );
  }

  /**
   * Handle hand tracker errors
   */
  private handleHandTrackerError(error: unknown): AppError {
    if (this.isHandTrackerError(error)) {
      return this.createError(
        'hand_tracker_error',
        error.message,
        getHandTrackerErrorMessage(error),
        error.originalError
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return this.createError(
      'hand_tracker_error',
      errorMessage,
      'Hand tracking failed. Please try again.',
      error instanceof Error ? error : undefined
    );
  }

  /**
   * Handle generation errors
   */
  private handleGenerationError(error: unknown): AppError {
    if (error instanceof BriaAPIError) {
      let userMessage = 'Image generation failed. Please try again.';

      if (error.status === 401) {
        userMessage = 'Invalid API key. Please check your settings.';
      } else if (error.status === 429) {
        userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (error.status && error.status >= 500) {
        userMessage = 'Server error. Please try again later.';
      }

      return this.createError(
        'generation_error',
        error.message,
        userMessage,
        error
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return this.createError(
      'generation_error',
      errorMessage,
      'Image generation failed. Please try again.',
      error instanceof Error ? error : undefined
    );
  }

  /**
   * Type guard for WebcamError
   */
  private isWebcamError(error: unknown): error is WebcamError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      'message' in error &&
      typeof (error as WebcamError).type === 'string'
    );
  }

  /**
   * Type guard for HandTrackerError
   */
  private isHandTrackerError(error: unknown): error is HandTrackerError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      'message' in error &&
      typeof (error as HandTrackerError).type === 'string'
    );
  }
}

/**
 * Create a new AppController instance
 */
export function createAppController(
  config?: AppConfig,
  callbacks?: AppCallbacks
): AppController {
  return new AppController(config, callbacks);
}

/**
 * Get user-friendly error message for display
 */
export function getAppErrorMessage(error: AppError): string {
  return error.userMessage;
}
