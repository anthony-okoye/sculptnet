/**
 * Gesture Controller Hook
 * 
 * Wires together gesture detection to JSON state updates:
 * - Connects HandTracker detection callback to GestureMapper
 * - Passes gesture updates from GestureMapper to PromptStore
 * - Implements 100ms debounce on parameter updates to avoid jitter
 * - Triggers image generation on fist-to-open gesture
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { HandTracker, type HandDetectionResult } from '@/lib/hand-tracker';
import { GestureMapper, type GestureUpdate } from '@/lib/gesture-mapper';
import { usePromptStore } from '@/lib/stores/prompt-store';
import { getBriaClient, type GenerationResult, type GenerationStatus } from '@/lib/bria-client';
import { WebcamManager } from '@/lib/webcam-manager';

// ============ Types ============

export interface GestureControllerState {
  /** Whether the controller is initialized */
  isInitialized: boolean;
  /** Whether gesture detection is active */
  isDetecting: boolean;
  /** Current generation status */
  generationStatus: GenerationStatus;
  /** Last error message */
  error: string | null;
  /** Current detected gesture info */
  currentGesture: string | null;
  /** Last parameter update */
  lastUpdate: GestureUpdate | null;
  /** Whether generation is in progress */
  isGenerating: boolean;
}

export interface GestureControllerOptions {
  /** Debounce delay for parameter updates (default 100ms) */
  debounceMs?: number;
  /** Detection FPS (default 20) */
  detectionFps?: number;
  /** Callback when an image is generated */
  onImageGenerated?: (result: GenerationResult) => void;
  /** Callback when generation fails */
  onGenerationError?: (error: Error) => void;
  /** Callback when a gesture update is applied */
  onGestureUpdate?: (update: GestureUpdate) => void;
}

export interface GestureController {
  // State
  state: GestureControllerState;
  
  // Methods
  initialize: () => Promise<void>;
  startDetection: () => void;
  stopDetection: () => void;
  triggerGeneration: () => Promise<GenerationResult | null>;
  reset: () => void;
  dispose: () => void;
  
  // Getters
  getVideoElement: () => HTMLVideoElement | null;
}

// ============ Constants ============

const DEFAULT_DEBOUNCE_MS = 100;
const DEFAULT_DETECTION_FPS = 20;

// ============ Hook Implementation ============

/**
 * Gesture Controller Hook
 * 
 * Orchestrates the flow from hand detection to image generation:
 * 1. WebcamManager provides video feed
 * 2. HandTracker detects hand landmarks
 * 3. GestureMapper translates landmarks to parameter updates
 * 4. PromptStore receives debounced updates
 * 5. BriaClient generates images on trigger gesture
 */
export function useGestureController(
  options: GestureControllerOptions = {}
): GestureController {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    detectionFps = DEFAULT_DETECTION_FPS,
    onImageGenerated,
    onGenerationError,
    onGestureUpdate,
  } = options;

  // State
  const [state, setState] = useState<GestureControllerState>({
    isInitialized: false,
    isDetecting: false,
    generationStatus: 'idle',
    error: null,
    currentGesture: null,
    lastUpdate: null,
    isGenerating: false,
  });

  // Refs for instances (persist across renders)
  const webcamManagerRef = useRef<WebcamManager | null>(null);
  const handTrackerRef = useRef<HandTracker | null>(null);
  const gestureMapperRef = useRef<GestureMapper | null>(null);
  const briaClientRef = useRef(getBriaClient());
  
  // Refs for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Map<string, GestureUpdate>>(new Map());
  
  // Refs for previous detection state
  const previousLandmarksRef = useRef<HandDetectionResult[] | null>(null);

  // Get prompt store actions
  const updatePrompt = usePromptStore(state => state.update);
  const getPrompt = usePromptStore(state => state.getPrompt);
  const initializePrompt = usePromptStore(state => state.initialize);

  /**
   * Apply debounced updates to the prompt store
   */
  const applyDebouncedUpdates = useCallback(() => {
    const updates = pendingUpdatesRef.current;
    if (updates.size === 0) return;

    // Apply all pending updates
    updates.forEach((update, path) => {
      const result = updatePrompt(path, update.value);
      if (result.success) {
        onGestureUpdate?.(update);
        setState(prev => ({ ...prev, lastUpdate: update }));
      }
    });

    // Clear pending updates
    pendingUpdatesRef.current = new Map();
  }, [updatePrompt, onGestureUpdate]);

  /**
   * Queue a gesture update with debouncing
   */
  const queueUpdate = useCallback((update: GestureUpdate) => {
    // Store update (overwrites previous update for same path)
    pendingUpdatesRef.current.set(update.path, update);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      applyDebouncedUpdates();
    }, debounceMs);
  }, [debounceMs, applyDebouncedUpdates]);

  /**
   * Handle hand detection results
   */
  const handleDetectionResults = useCallback((results: HandDetectionResult[]) => {
    if (!gestureMapperRef.current) return;

    const mapper = gestureMapperRef.current;
    let gestureDescription = 'No hands detected';

    if (results.length === 0) {
      // No hands detected - maintain current state (Requirement 3.4)
      setState(prev => ({ ...prev, currentGesture: gestureDescription }));
      previousLandmarksRef.current = null;
      return;
    }

    // Process single hand gestures
    const primaryHand = results[0];
    const landmarks = primaryHand.landmarks;

    // Check for generation trigger (fist-to-open)
    const previousLandmarks = previousLandmarksRef.current?.[0]?.landmarks;
    const shouldTrigger = mapper.detectGenerationTrigger(landmarks, previousLandmarks);
    
    if (shouldTrigger) {
      gestureDescription = 'Generation triggered!';
      setState(prev => ({ ...prev, currentGesture: gestureDescription }));
      // Trigger generation asynchronously
      triggerGenerationInternal();
    } else {
      // Map gestures to parameter updates
      const pinchUpdate = mapper.mapPinchToFOV(landmarks);
      const rotationUpdate = mapper.mapWristRotationToAngle(landmarks);
      const verticalUpdate = mapper.mapVerticalMovementToLighting(landmarks);

      // Queue updates with sufficient confidence
      if (pinchUpdate && pinchUpdate.confidence > 0.5) {
        queueUpdate(pinchUpdate);
        gestureDescription = `Pinch: ${pinchUpdate.value}`;
      }
      
      if (rotationUpdate && rotationUpdate.confidence > 0.5) {
        queueUpdate(rotationUpdate);
        gestureDescription = `Rotation: ${rotationUpdate.value}`;
      }
      
      if (verticalUpdate && verticalUpdate.confidence > 0.5) {
        queueUpdate(verticalUpdate);
        gestureDescription = `Vertical: ${verticalUpdate.value}`;
      }

      // Check for two-hand composition gesture
      if (results.length >= 2) {
        const leftHand = results.find(r => r.handedness === 'Left');
        const rightHand = results.find(r => r.handedness === 'Right');
        
        if (leftHand && rightHand) {
          const compositionUpdate = mapper.mapTwoHandFrameToComposition(
            leftHand.landmarks,
            rightHand.landmarks
          );
          
          if (compositionUpdate && compositionUpdate.confidence > 0.5) {
            queueUpdate(compositionUpdate);
            gestureDescription = `Frame: ${compositionUpdate.value}`;
          }
        }
      }

      setState(prev => ({ ...prev, currentGesture: gestureDescription }));
    }

    // Store current results for next frame comparison
    previousLandmarksRef.current = results;
  }, [queueUpdate]);

  /**
   * Internal trigger generation function
   */
  const triggerGenerationInternal = useCallback(async () => {
    // Prevent multiple simultaneous generations using setState callback
    let shouldGenerate = false;
    setState(prev => {
      if (prev.isGenerating) {
        return prev; // Already generating, don't update
      }
      shouldGenerate = true;
      return { 
        ...prev, 
        isGenerating: true, 
        generationStatus: 'generating',
        error: null,
      };
    });

    if (!shouldGenerate) return null;

    try {
      const prompt = getPrompt();
      const result = await briaClientRef.current.generate(prompt);
      
      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        generationStatus: 'idle',
      }));
      
      onImageGenerated?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      
      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        generationStatus: 'error',
        error: errorMessage,
      }));
      
      if (error instanceof Error) {
        onGenerationError?.(error);
      }
      return null;
    }
  }, [getPrompt, onImageGenerated, onGenerationError]);

  /**
   * Initialize all components
   */
  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Initialize prompt store if not already done
      initializePrompt();

      // Create instances
      webcamManagerRef.current = new WebcamManager();
      handTrackerRef.current = new HandTracker();
      gestureMapperRef.current = new GestureMapper();

      // Initialize webcam
      await webcamManagerRef.current.initialize();

      // Initialize hand tracker
      await handTrackerRef.current.initialize();
      handTrackerRef.current.setDetectionRate(detectionFps);

      setState(prev => ({ 
        ...prev, 
        isInitialized: true,
        error: null,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to initialize gesture controller';
      
      setState(prev => ({ 
        ...prev, 
        isInitialized: false,
        error: errorMessage,
      }));
      
      throw error;
    }
  }, [initializePrompt, detectionFps]);

  /**
   * Start gesture detection
   */
  const startDetection = useCallback(() => {
    // Check if initialized using ref to avoid stale closure
    if (!handTrackerRef.current || !webcamManagerRef.current) {
      setState(prev => ({ 
        ...prev, 
        error: 'Controller must be initialized before starting detection',
      }));
      return;
    }

    const videoElement = webcamManagerRef.current.getVideoElement();
    if (!videoElement) {
      setState(prev => ({ 
        ...prev, 
        error: 'Video element not available',
      }));
      return;
    }

    // Reset gesture mapper state
    gestureMapperRef.current?.reset();
    previousLandmarksRef.current = null;

    // Start detection
    handTrackerRef.current.startDetection(videoElement, handleDetectionResults);
    
    setState(prev => ({ 
      ...prev, 
      isDetecting: true,
      error: null,
    }));
  }, [handleDetectionResults]);

  /**
   * Stop gesture detection
   */
  const stopDetection = useCallback(() => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Clear pending updates
    pendingUpdatesRef.current = new Map();

    // Stop hand tracker
    handTrackerRef.current?.stopDetection();

    setState(prev => ({ 
      ...prev, 
      isDetecting: false,
      currentGesture: null,
    }));
  }, []);

  /**
   * Manually trigger image generation
   */
  const triggerGeneration = useCallback(async (): Promise<GenerationResult | null> => {
    return triggerGenerationInternal();
  }, [triggerGenerationInternal]);

  /**
   * Reset the controller state
   */
  const reset = useCallback(() => {
    stopDetection();
    gestureMapperRef.current?.reset();
    previousLandmarksRef.current = null;
    
    setState(prev => ({
      ...prev,
      error: null,
      currentGesture: null,
      lastUpdate: null,
      generationStatus: 'idle',
      isGenerating: false,
    }));
  }, [stopDetection]);

  /**
   * Dispose of all resources
   */
  const dispose = useCallback(() => {
    stopDetection();
    
    // Dispose hand tracker
    handTrackerRef.current?.dispose();
    handTrackerRef.current = null;

    // Stop webcam
    webcamManagerRef.current?.stop();
    webcamManagerRef.current = null;

    // Clear gesture mapper
    gestureMapperRef.current = null;

    // Cancel any ongoing generation
    briaClientRef.current.cancel();

    setState({
      isInitialized: false,
      isDetecting: false,
      generationStatus: 'idle',
      error: null,
      currentGesture: null,
      lastUpdate: null,
      isGenerating: false,
    });
  }, [stopDetection]);

  /**
   * Get the video element for external use (e.g., AR scene)
   */
  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    return webcamManagerRef.current?.getVideoElement() ?? null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    state,
    initialize,
    startDetection,
    stopDetection,
    triggerGeneration,
    reset,
    dispose,
    getVideoElement,
  };
}

export default useGestureController;
