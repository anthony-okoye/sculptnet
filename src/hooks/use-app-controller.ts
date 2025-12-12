/**
 * React Hook for Application Controller
 * 
 * Provides a React-friendly interface to the AppController.
 * Manages lifecycle, state updates, and cleanup.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  AppController,
  type AppState,
  type AppConfig,
  type AppError,
  type AppCallbacks,
  createAppController,
} from '@/lib/app-controller';
import type { GestureUpdate } from '@/lib/gesture-mapper';
import type { GenerationResult } from '@/lib/bria-client';
import type { FIBOStructuredPrompt } from '@/types/fibo';

// ============ Types ============

/**
 * Hook state
 */
export interface AppControllerState {
  state: AppState;
  error: AppError | null;
  prompt: FIBOStructuredPrompt | null;
  isGenerating: boolean;
  handCount: number;
  lastGeneration: GenerationResult | null;
}

/**
 * Hook return type
 */
export interface UseAppControllerReturn {
  // State
  state: AppState;
  error: AppError | null;
  prompt: FIBOStructuredPrompt | null;
  isGenerating: boolean;
  handCount: number;
  lastGeneration: GenerationResult | null;

  // Methods
  initialize: () => Promise<void>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  generateImage: () => Promise<GenerationResult>;
  updatePrompt: (path: string, value: unknown) => boolean;
  importPrompt: (json: string) => boolean;
  exportPrompt: () => string;
  updateConfig: (config: Partial<AppConfig>) => void;

  // Controller instance (for advanced usage)
  controller: AppController | null;
}

// ============ Hook Implementation ============

/**
 * React hook for AppController
 * 
 * @param config - Application configuration
 * @param autoInitialize - Whether to automatically initialize on mount (default: false)
 * @returns AppController state and methods
 */
export function useAppController(
  config?: AppConfig,
  autoInitialize: boolean = false
): UseAppControllerReturn {
  const controllerRef = useRef<AppController | null>(null);
  
  const [state, setState] = useState<AppControllerState>({
    state: 'uninitialized',
    error: null,
    prompt: null,
    isGenerating: false,
    handCount: 0,
    lastGeneration: null,
  });

  // Initialize controller on mount
  useEffect(() => {
    const callbacks: AppCallbacks = {
      onStateChange: (newState) => {
        setState(prev => ({ ...prev, state: newState }));
      },
      onError: (error) => {
        setState(prev => ({ ...prev, error }));
      },
      onGestureUpdate: (update: GestureUpdate) => {
        // Gesture updates are handled internally, but we could log them
        console.debug('Gesture update:', update);
      },
      onPromptUpdate: (prompt) => {
        setState(prev => ({ ...prev, prompt }));
      },
      onGenerationStart: () => {
        setState(prev => ({ ...prev, isGenerating: true }));
      },
      onGenerationComplete: (result) => {
        setState(prev => ({
          ...prev,
          isGenerating: false,
          lastGeneration: result,
        }));
      },
      onGenerationTrigger: () => {
        console.debug('Generation triggered by gesture');
      },
      onHandsDetected: (count) => {
        setState(prev => ({ ...prev, handCount: count }));
      },
    };

    controllerRef.current = createAppController(config, callbacks);

    // Auto-initialize if requested
    if (autoInitialize) {
      controllerRef.current.initialize().catch(error => {
        console.error('Auto-initialization failed:', error);
      });
    }

    // Cleanup on unmount
    return () => {
      if (controllerRef.current) {
        controllerRef.current.dispose();
        controllerRef.current = null;
      }
    };
  }, []); // Empty deps - only run once on mount

  // Initialize method
  const initialize = useCallback(async () => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    await controllerRef.current.initialize();
    
    // Update prompt state after initialization
    const prompt = controllerRef.current.getCurrentPrompt();
    setState(prev => ({ ...prev, prompt }));
  }, []);

  // Start method
  const start = useCallback(() => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    controllerRef.current.start();
  }, []);

  // Pause method
  const pause = useCallback(() => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    controllerRef.current.pause();
  }, []);

  // Resume method
  const resume = useCallback(() => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    controllerRef.current.resume();
  }, []);

  // Stop method
  const stop = useCallback(() => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    controllerRef.current.stop();
  }, []);

  // Reset method
  const reset = useCallback(() => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    controllerRef.current.reset();
    setState({
      state: 'uninitialized',
      error: null,
      prompt: null,
      isGenerating: false,
      handCount: 0,
      lastGeneration: null,
    });
  }, []);

  // Generate image method
  const generateImage = useCallback(async (): Promise<GenerationResult> => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    return controllerRef.current.generateImage();
  }, []);

  // Update prompt method
  const updatePrompt = useCallback((path: string, value: unknown): boolean => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    return controllerRef.current.updatePrompt(path, value);
  }, []);

  // Import prompt method
  const importPrompt = useCallback((json: string): boolean => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    return controllerRef.current.importPrompt(json);
  }, []);

  // Export prompt method
  const exportPrompt = useCallback((): string => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    return controllerRef.current.exportPrompt();
  }, []);

  // Update config method
  const updateConfig = useCallback((newConfig: Partial<AppConfig>) => {
    if (!controllerRef.current) {
      throw new Error('Controller not initialized');
    }
    controllerRef.current.updateConfig(newConfig);
  }, []);

  return {
    // State
    state: state.state,
    error: state.error,
    prompt: state.prompt,
    isGenerating: state.isGenerating,
    handCount: state.handCount,
    lastGeneration: state.lastGeneration,

    // Methods
    initialize,
    start,
    pause,
    resume,
    stop,
    reset,
    generateImage,
    updatePrompt,
    importPrompt,
    exportPrompt,
    updateConfig,

    // Controller instance
    controller: controllerRef.current,
  };
}

export default useAppController;
