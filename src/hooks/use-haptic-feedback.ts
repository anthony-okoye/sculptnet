/**
 * React Hook for Haptic Feedback
 * 
 * Provides a React-friendly interface to the HapticController.
 * Manages haptic preferences and integrates with the prompt store.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  HapticController,
  createHapticController,
  type HapticEvent,
} from '@/lib/haptic-controller';

// ============ Haptic Preferences Store ============

/**
 * Haptic preferences state
 */
interface HapticPreferencesState {
  /** Whether haptic feedback is enabled */
  enabled: boolean;
  /** Enable haptic feedback */
  enable: () => void;
  /** Disable haptic feedback */
  disable: () => void;
  /** Toggle haptic feedback */
  toggle: () => void;
}

/**
 * Zustand store for haptic preferences
 * Persisted to localStorage for user preference retention
 */
export const useHapticPreferences = create<HapticPreferencesState>()(
  persist(
    (set) => ({
      enabled: true, // Default to enabled
      enable: () => set({ enabled: true }),
      disable: () => set({ enabled: false }),
      toggle: () => set((state) => ({ enabled: !state.enabled })),
    }),
    {
      name: 'sculptnet-haptic-preferences',
    }
  )
);

// ============ Haptic Feedback Hook ============

/**
 * Hook return type
 */
export interface UseHapticFeedbackReturn {
  /** Whether haptic feedback is enabled */
  enabled: boolean;
  /** Whether vibration is supported on this device */
  supported: boolean;
  /** Whether currently in debounce period */
  inDebouncePeriod: boolean;
  /** Enable haptic feedback */
  enable: () => void;
  /** Disable haptic feedback */
  disable: () => void;
  /** Toggle haptic feedback */
  toggle: () => void;
  /** Check composition and trigger vibration if balanced */
  checkComposition: (composition: string) => boolean;
  /** Manually trigger vibration */
  vibrate: () => boolean;
  /** Last haptic event */
  lastEvent: HapticEvent | null;
  /** Set visual pulse callback for fallback */
  setVisualPulseCallback: (callback: (() => void) | null) => void;
}

/**
 * React hook for haptic feedback
 * 
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { enabled, toggle, checkComposition } = useHapticFeedback();
 *   
 *   // Toggle haptics
 *   <Switch checked={enabled} onCheckedChange={toggle} />
 *   
 *   // Check composition on update
 *   useEffect(() => {
 *     checkComposition(currentComposition);
 *   }, [currentComposition]);
 * }
 * ```
 */
export function useHapticFeedback(): UseHapticFeedbackReturn {
  // Get preferences from store
  const { enabled: prefEnabled, enable: prefEnable, disable: prefDisable, toggle: prefToggle } = 
    useHapticPreferences();
  
  // Controller ref (singleton per component instance)
  const controllerRef = useRef<HapticController | null>(null);
  
  // State
  const [supported, setSupported] = useState(false);
  const [inDebouncePeriod, setInDebouncePeriod] = useState(false);
  const [lastEvent, setLastEvent] = useState<HapticEvent | null>(null);
  
  // Initialize controller
  useEffect(() => {
    if (!controllerRef.current) {
      controllerRef.current = createHapticController();
    }
    
    const controller = controllerRef.current;
    setSupported(controller.isSupported());
    
    // Sync enabled state with preferences
    if (prefEnabled) {
      controller.enable();
    } else {
      controller.disable();
    }
    
    // Add event listener
    const handleEvent = (event: HapticEvent) => {
      setLastEvent(event);
      setInDebouncePeriod(true);
      
      // Clear debounce indicator after period
      setTimeout(() => {
        setInDebouncePeriod(controller.isInDebouncePeriod());
      }, 2100); // Slightly longer than debounce period
    };
    
    controller.addEventListener(handleEvent);
    
    return () => {
      controller.removeEventListener(handleEvent);
    };
  }, [prefEnabled]);
  
  // Sync enabled state when preferences change
  useEffect(() => {
    if (controllerRef.current) {
      if (prefEnabled) {
        controllerRef.current.enable();
      } else {
        controllerRef.current.disable();
      }
    }
  }, [prefEnabled]);
  
  // Check composition and vibrate
  const checkComposition = useCallback((composition: string): boolean => {
    if (!controllerRef.current) return false;
    const result = controllerRef.current.checkCompositionAndVibrate(composition);
    if (result) {
      setInDebouncePeriod(true);
    }
    return result;
  }, []);
  
  // Manual vibrate
  const vibrate = useCallback((): boolean => {
    if (!controllerRef.current) return false;
    const result = controllerRef.current.vibrate();
    if (result) {
      setInDebouncePeriod(true);
    }
    return result;
  }, []);
  
  // Set visual pulse callback
  const setVisualPulseCallback = useCallback((callback: (() => void) | null) => {
    if (controllerRef.current) {
      controllerRef.current.setVisualPulseCallback(callback);
    }
  }, []);
  
  return {
    enabled: prefEnabled,
    supported,
    inDebouncePeriod,
    enable: prefEnable,
    disable: prefDisable,
    toggle: prefToggle,
    checkComposition,
    vibrate,
    lastEvent,
    setVisualPulseCallback,
  };
}

// ============ Integration with Prompt Store ============

/**
 * Hook that automatically triggers haptic feedback when composition changes
 * 
 * Usage:
 * ```tsx
 * function GestureHandler() {
 *   useHapticOnCompositionChange();
 *   // Haptics will automatically trigger when aesthetics.composition changes
 * }
 * ```
 */
export function useHapticOnCompositionChange(): void {
  const { checkComposition, enabled } = useHapticFeedback();
  const lastCompositionRef = useRef<string | null>(null);
  
  // Import prompt store dynamically to avoid circular dependencies
  useEffect(() => {
    if (!enabled) return;
    
    // Subscribe to prompt store changes
    const unsubscribe = (async () => {
      const { usePromptStore } = await import('@/lib/stores/prompt-store');
      
      return usePromptStore.subscribe((state) => {
        const currentComposition = state.prompt.aesthetics?.composition;
        
        // Only trigger if composition actually changed
        if (currentComposition && currentComposition !== lastCompositionRef.current) {
          lastCompositionRef.current = currentComposition;
          checkComposition(currentComposition);
        }
      });
    })();
    
    return () => {
      unsubscribe.then((unsub) => unsub());
    };
  }, [checkComposition, enabled]);
}

export default useHapticFeedback;
