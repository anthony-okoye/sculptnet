/**
 * Gesture Controller Hook
 * 
 * Wires together gesture detection to JSON state updates:
 * - Connects HandTracker detection callback to GestureMapper
 * - Passes gesture updates from GestureMapper to PromptStore
 * - Implements 100ms debounce on parameter updates to avoid jitter
 * - Triggers image generation on fist-to-open gesture
 * - Integrates PoseStabilityDetector for freeze frame pose capture
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { HandTracker, type HandDetectionResult } from '@/lib/hand-tracker';
import { GestureMapper, type GestureUpdate } from '@/lib/gesture-mapper';
import { usePromptStore } from '@/lib/stores/prompt-store';
import { getBriaClient, type GenerationResult, type GenerationStatus } from '@/lib/bria-client';
import { WebcamManager } from '@/lib/webcam-manager';
import { 
  GesturePresetDetector, 
  type PresetDetectionResult,
  type PresetGestureType,
  loadPresetsFromStorage,
} from '@/lib/gesture-presets';
import { PoseStabilityDetector, type StabilityState } from '@/lib/pose-stability-detector';
import { usePoseCaptureStore } from '@/lib/stores/pose-capture-store';
import { landmarksToDescriptor } from '@/lib/pose-descriptor-generator';
import { toast } from 'sonner';

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
  /** Currently detected preset gesture */
  currentPreset: PresetGestureType;
  /** Current pose stability state */
  poseStability: StabilityState | null;
  /** Whether pose is currently stable */
  isPoseStable: boolean;
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
  /** Callback when a preset gesture is detected */
  onPresetDetected?: (preset: PresetDetectionResult) => void;
  /** Enable preset gesture detection (default true) */
  enablePresets?: boolean;
  /** Enable pose capture detection (default true) */
  enablePoseCapture?: boolean;
  /** Callback when a pose is captured */
  onPoseCaptured?: (descriptor: string) => void;
  /** Callback when pose stability changes */
  onPoseStabilityChange?: (stability: StabilityState) => void;
}

export interface GestureController {
  // State
  state: GestureControllerState;
  
  // Methods
  initialize: () => Promise<void>;
  startDetection: () => void;
  stopDetection: () => void;
  triggerGeneration: () => Promise<GenerationResult | null>;
  capturePoseNow: () => void;
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
    onPresetDetected,
    enablePresets = true,
    enablePoseCapture = true,
    onPoseCaptured,
    onPoseStabilityChange,
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
    currentPreset: null,
    poseStability: null,
    isPoseStable: false,
  });

  // Refs for instances (persist across renders)
  const webcamManagerRef = useRef<WebcamManager | null>(null);
  const handTrackerRef = useRef<HandTracker | null>(null);
  const gestureMapperRef = useRef<GestureMapper | null>(null);
  const presetDetectorRef = useRef<GesturePresetDetector | null>(null);
  const poseStabilityDetectorRef = useRef<PoseStabilityDetector | null>(null);
  const briaClientRef = useRef(getBriaClient());
  
  // Ref to prevent duplicate generation calls (React Strict Mode double-render)
  const isGeneratingRef = useRef(false);
  
  // Ref to track last detected preset to avoid duplicate toasts
  const lastPresetRef = useRef<PresetGestureType>(null);
  const presetCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Refs for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Map<string, GestureUpdate>>(new Map());
  
  // Refs for previous detection state
  const previousLandmarksRef = useRef<HandDetectionResult[] | null>(null);
  
  // Ref to track if pose was just captured (to avoid re-triggering)
  const poseCapturedRef = useRef(false);

  // Get prompt store actions
  const updatePrompt = usePromptStore(state => state.update);
  const getPrompt = usePromptStore(state => state.getPrompt);
  const initializePrompt = usePromptStore(state => state.initialize);
  
  // Get pose capture store actions
  const capturePose = usePoseCaptureStore(state => state.capture);
  const setHoldProgress = usePoseCaptureStore(state => state.setHoldProgress);
  const setIsCapturing = usePoseCaptureStore(state => state.setIsCapturing);

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
   * Apply preset gesture parameters to prompt
   */
  const applyPreset = useCallback((preset: PresetDetectionResult) => {
    if (!preset.preset) return;

    // Apply all preset parameters
    Object.entries(preset.preset.parameters).forEach(([path, value]) => {
      if (value !== undefined) {
        updatePrompt(path, value);
      }
    });

    // Show toast notification (Requirement 15.4)
    toast.success(`${preset.preset.name} preset applied`, {
      description: preset.preset.description,
      duration: 2000,
    });

    // Callback
    onPresetDetected?.(preset);
  }, [updatePrompt, onPresetDetected]);

  /**
   * Handle pose capture when stability threshold is reached
   * Requirements: 1.1, 1.4
   */
  const handlePoseCapture = useCallback((landmarks: HandDetectionResult[]) => {
    if (poseCapturedRef.current) return; // Prevent duplicate captures
    
    const allLandmarks = landmarks.flatMap(r => r.landmarks);
    const descriptor = landmarksToDescriptor(allLandmarks);
    
    // Capture the pose
    capturePose(allLandmarks, descriptor);
    poseCapturedRef.current = true;
    
    // Provide haptic feedback (Requirement 1.4)
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]); // Double pulse for capture confirmation
    }
    
    // Show toast notification
    toast.success('Pose Captured!', {
      description: descriptor,
      duration: 2000,
    });
    
    // Callback
    onPoseCaptured?.(descriptor);
    
    // Reset capture flag after cooldown
    setTimeout(() => {
      poseCapturedRef.current = false;
      poseStabilityDetectorRef.current?.reset();
    }, 2000);
  }, [capturePose, onPoseCaptured]);

  /**
   * Handle hand detection results
   */
  const handleDetectionResults = useCallback((results: HandDetectionResult[]) => {
    if (!gestureMapperRef.current) return;

    const mapper = gestureMapperRef.current;
    let gestureDescription = 'No hands detected';

    if (results.length === 0) {
      // No hands detected - maintain current state (Requirement 3.4)
      setState(prev => ({ 
        ...prev, 
        currentGesture: gestureDescription, 
        currentPreset: null,
        poseStability: null,
        isPoseStable: false,
      }));
      previousLandmarksRef.current = null;
      lastPresetRef.current = null;
      
      // Reset pose stability detector when no hands
      if (enablePoseCapture && poseStabilityDetectorRef.current) {
        poseStabilityDetectorRef.current.reset();
        setHoldProgress(0);
        setIsCapturing(false);
      }
      return;
    }

    // Process single hand gestures
    const primaryHand = results[0];
    const landmarks = primaryHand.landmarks;

    // Check for preset gestures first (if enabled)
    if (enablePresets && presetDetectorRef.current) {
      const presetResult = presetDetectorRef.current.detectPresetGesture(landmarks);
      
      if (presetResult.type !== null) {
        // Preset gesture detected
        gestureDescription = `Preset: ${presetResult.preset?.name || presetResult.type}`;
        
        // Apply preset if it's different from the last one (avoid repeated applications)
        if (presetResult.type !== lastPresetRef.current) {
          lastPresetRef.current = presetResult.type;
          
          // Clear cooldown timer
          if (presetCooldownRef.current) {
            clearTimeout(presetCooldownRef.current);
          }
          
          // Apply preset
          applyPreset(presetResult);
          
          // Set cooldown to prevent rapid re-application (2 seconds)
          presetCooldownRef.current = setTimeout(() => {
            lastPresetRef.current = null;
          }, 2000);
        }
        
        setState(prev => ({ 
          ...prev, 
          currentGesture: gestureDescription,
          currentPreset: presetResult.type,
        }));
        
        // Store current results for next frame comparison
        previousLandmarksRef.current = results;
        return;
      } else {
        // No preset detected, clear preset state
        setState(prev => ({ ...prev, currentPreset: null }));
      }
    }

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

    // Pose stability detection (Requirements: 1.1, 1.2, 1.3)
    if (enablePoseCapture && poseStabilityDetectorRef.current && !poseCapturedRef.current) {
      // Combine all landmarks from all detected hands
      const allLandmarks = results.flatMap(r => r.landmarks);
      
      // Update pose stability detector
      const stabilityState = poseStabilityDetectorRef.current.update(allLandmarks);
      
      // Update pose capture store with progress
      setHoldProgress(stabilityState.holdProgress);
      setIsCapturing(stabilityState.isStable);
      
      // Update state with stability info
      setState(prev => ({
        ...prev,
        poseStability: stabilityState,
        isPoseStable: stabilityState.isStable,
      }));
      
      // Callback for stability changes
      onPoseStabilityChange?.(stabilityState);
      
      // Check if capture should be triggered (holdProgress reached 1.0)
      if (poseStabilityDetectorRef.current.shouldCapture()) {
        handlePoseCapture(results);
      }
    }

    // Store current results for next frame comparison
    previousLandmarksRef.current = results;
  }, [queueUpdate, enablePresets, applyPreset, enablePoseCapture, setHoldProgress, setIsCapturing, onPoseStabilityChange, handlePoseCapture]);

  /**
   * Internal trigger generation function
   */
  const triggerGenerationInternal = useCallback(async () => {
    console.log('[SculptNet] 🎯 triggerGenerationInternal called');
    
    // Use ref to prevent race condition from React double-render
    if (isGeneratingRef.current) {
      console.log('[SculptNet] ⚠️ Already generating (ref check), skipping');
      return null;
    }
    
    isGeneratingRef.current = true;
    console.log('[SculptNet] ✅ Setting isGeneratingRef to true');
    
    setState(prev => {
      console.log('[SculptNet] 📊 Current state:', prev);
      console.log('[SculptNet] ✅ Setting state to generating');
      return { 
        ...prev, 
        isGenerating: true, 
        generationStatus: 'generating',
        error: null,
      };
    });

    try {
      console.log('[SculptNet] 📋 Getting prompt from store...');
      const prompt = getPrompt();
      console.log('[SculptNet] 📋 Prompt retrieved:', prompt);
      
      console.log('[SculptNet] 🚀 Calling briaClient.generate()...');
      const result = await briaClientRef.current.generate(prompt);
      console.log('[SculptNet] ✅ Generation result received:', result);
      
      isGeneratingRef.current = false;
      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        generationStatus: 'idle',
      }));
      
      console.log('[SculptNet] 📢 Calling onImageGenerated callback...');
      onImageGenerated?.(result);
      return result;
    } catch (error) {
      console.error('[SculptNet] ❌ Generation error caught:', error);
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      
      isGeneratingRef.current = false;
      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        generationStatus: 'error',
        error: errorMessage,
      }));
      
      if (error instanceof Error) {
        console.log('[SculptNet] 📢 Calling onGenerationError callback...');
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
      
      // Create preset detector with custom presets from storage (if available)
      const customPresets = loadPresetsFromStorage();
      presetDetectorRef.current = new GesturePresetDetector(customPresets || undefined);
      
      // Create pose stability detector for freeze frame capture (Requirements: 1.1, 1.2, 1.3)
      if (enablePoseCapture) {
        poseStabilityDetectorRef.current = new PoseStabilityDetector({
          stabilityThreshold: 0.02,  // Max movement variance
          holdDuration: 2,           // 2 seconds to capture
          windowSize: 30,            // 30 frames sliding window
        });
      }

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
   * Manually capture the current pose immediately
   * Uses the most recent hand landmarks from detection
   */
  const capturePoseNow = useCallback(() => {
    if (!previousLandmarksRef.current || previousLandmarksRef.current.length === 0) {
      toast.error('No hands detected', {
        description: 'Please ensure your hands are visible to the camera',
        duration: 2000,
      });
      return;
    }

    // Use the current landmarks to capture pose
    handlePoseCapture(previousLandmarksRef.current);
  }, [handlePoseCapture]);

  /**
   * Reset the controller state
   */
  const reset = useCallback(() => {
    stopDetection();
    gestureMapperRef.current?.reset();
    poseStabilityDetectorRef.current?.reset();
    previousLandmarksRef.current = null;
    poseCapturedRef.current = false;
    
    // Reset pose capture store
    setHoldProgress(0);
    setIsCapturing(false);
    
    setState(prev => ({
      ...prev,
      error: null,
      currentGesture: null,
      lastUpdate: null,
      generationStatus: 'idle',
      isGenerating: false,
      poseStability: null,
      isPoseStable: false,
    }));
  }, [stopDetection, setHoldProgress, setIsCapturing]);

  /**
   * Dispose of all resources
   */
  const dispose = useCallback(() => {
    stopDetection();
    
    // Clear preset cooldown timer
    if (presetCooldownRef.current) {
      clearTimeout(presetCooldownRef.current);
      presetCooldownRef.current = null;
    }
    
    // Dispose hand tracker
    handTrackerRef.current?.dispose();
    handTrackerRef.current = null;

    // Stop webcam
    webcamManagerRef.current?.stop();
    webcamManagerRef.current = null;

    // Clear gesture mapper
    gestureMapperRef.current = null;
    
    // Clear preset detector
    presetDetectorRef.current = null;
    lastPresetRef.current = null;
    
    // Clear pose stability detector
    poseStabilityDetectorRef.current = null;
    poseCapturedRef.current = false;

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
      currentPreset: null,
      poseStability: null,
      isPoseStable: false,
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
    capturePoseNow,
    reset,
    dispose,
    getVideoElement,
  };
}

export default useGestureController;
