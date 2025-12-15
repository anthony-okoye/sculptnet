/**
 * Generation History Store
 * 
 * Manages generation results history with Zustand:
 * - Stores last 10 generation results
 * - Tracks current generation status
 * - Provides methods to add, remove, and clear history
 * 
 * Requirements: 2.2, 2.3, 4.3
 */

import { create } from 'zustand';
import type { GenerationResult, GenerationStatus } from '@/lib/bria-client';

// ============ Constants ============

/** Maximum number of generations to keep in history */
export const MAX_HISTORY_SIZE = 10;

/** Maximum number of generations to keep in timeline (for WOW feature) */
export const MAX_TIMELINE_SIZE = 20;

// ============ Types ============

/**
 * Generation history entry with additional metadata
 */
export interface GenerationHistoryEntry extends GenerationResult {
  /** Unique ID for the entry */
  id: string;
  /** Whether this image is currently displayed in AR scene */
  inARScene: boolean;
  /** AR scene entity ID if displayed */
  arEntityId?: string;
  /** Gesture type that triggered this generation (for timeline display) */
  gesture?: string;
  /** Thumbnail URL (same as imageUrl for now) */
  thumbnail?: string;
  /** Whether this was generated in HDR mode */
  isHDR?: boolean;
  /** Color depth (8 or 16 bit) */
  colorDepth?: 8 | 16;
}

/**
 * Generation store state
 */
export interface GenerationState {
  /** Generation history (most recent last) */
  history: GenerationHistoryEntry[];
  /** Timeline history (last 20 generations for WOW feature) */
  timeline: GenerationHistoryEntry[];
  /** Current generation status */
  status: GenerationStatus;
  /** Current error message if any */
  error: string | null;
  /** Whether a generation is in progress */
  isGenerating: boolean;
}

/**
 * Generation store actions
 */
export interface GenerationActions {
  /** Add a generation result to history */
  addGeneration: (result: GenerationResult, arEntityId?: string, gesture?: string, isHDR?: boolean, colorDepth?: 8 | 16) => GenerationHistoryEntry;
  /** Remove a generation from history by ID */
  removeGeneration: (id: string) => void;
  /** Clear all generation history */
  clearHistory: () => void;
  /** Update generation status */
  setStatus: (status: GenerationStatus) => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Set generating state */
  setGenerating: (isGenerating: boolean) => void;
  /** Update AR scene status for an entry */
  updateARStatus: (id: string, inARScene: boolean, arEntityId?: string) => void;
  /** Get entry by ID */
  getEntry: (id: string) => GenerationHistoryEntry | undefined;
  /** Get entries currently in AR scene */
  getARSceneEntries: () => GenerationHistoryEntry[];
  /** Load timeline from localStorage */
  loadTimeline: () => void;
  /** Save timeline to localStorage */
  saveTimeline: () => void;
}

export type GenerationStore = GenerationState & GenerationActions;

// ============ Utility Functions ============

/**
 * Generate a unique ID for history entries
 */
function generateEntryId(): string {
  return `gen-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============ Zustand Store ============

/**
 * Generation history store
 */
export const useGenerationStore = create<GenerationStore>((set, get) => ({
  // Initial state
  history: [],
  timeline: [],
  status: 'idle',
  error: null,
  isGenerating: false,

  /**
   * Add a generation result to history
   * Keeps only the last MAX_HISTORY_SIZE entries in history
   * Keeps only the last MAX_TIMELINE_SIZE entries in timeline
   */
  addGeneration: (result: GenerationResult, arEntityId?: string, gesture?: string, isHDR?: boolean, colorDepth?: 8 | 16): GenerationHistoryEntry => {
    const entry: GenerationHistoryEntry = {
      ...result,
      id: generateEntryId(),
      inARScene: !!arEntityId,
      arEntityId,
      gesture,
      thumbnail: result.imageUrl, // Use imageUrl as thumbnail
      isHDR,
      colorDepth,
    };

    set(state => {
      const newHistory = [...state.history, entry];
      const newTimeline = [...state.timeline, entry];
      
      // Keep only the last MAX_HISTORY_SIZE entries in history
      const trimmedHistory = newHistory.slice(-MAX_HISTORY_SIZE);
      
      // Keep only the last MAX_TIMELINE_SIZE entries in timeline
      const trimmedTimeline = newTimeline.slice(-MAX_TIMELINE_SIZE);
      
      return {
        history: trimmedHistory,
        timeline: trimmedTimeline,
        status: 'idle',
        error: null,
        isGenerating: false,
      };
    });

    // Save timeline to localStorage
    get().saveTimeline();

    return entry;
  },

  /**
   * Remove a generation from history by ID
   */
  removeGeneration: (id: string) => {
    set(state => ({
      history: state.history.filter(entry => entry.id !== id),
    }));
  },

  /**
   * Clear all generation history
   */
  clearHistory: () => {
    set({ history: [], timeline: [] });
    get().saveTimeline();
  },

  /**
   * Update generation status
   */
  setStatus: (status: GenerationStatus) => {
    set({ status });
  },

  /**
   * Set error message
   */
  setError: (error: string | null) => {
    set({ error, status: error ? 'error' : 'idle' });
  },

  /**
   * Set generating state
   */
  setGenerating: (isGenerating: boolean) => {
    set({ 
      isGenerating,
      status: isGenerating ? 'generating' : 'idle',
      error: isGenerating ? null : get().error,
    });
  },

  /**
   * Update AR scene status for an entry
   */
  updateARStatus: (id: string, inARScene: boolean, arEntityId?: string) => {
    set(state => ({
      history: state.history.map(entry =>
        entry.id === id
          ? { ...entry, inARScene, arEntityId }
          : entry
      ),
    }));
  },

  /**
   * Get entry by ID
   */
  getEntry: (id: string): GenerationHistoryEntry | undefined => {
    return get().history.find(entry => entry.id === id);
  },

  /**
   * Get entries currently in AR scene
   */
  getARSceneEntries: (): GenerationHistoryEntry[] => {
    return get().history.filter(entry => entry.inARScene);
  },

  /**
   * Load timeline from localStorage
   */
  loadTimeline: () => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('sculptnet-timeline');
      if (stored) {
        const timeline = JSON.parse(stored) as GenerationHistoryEntry[];
        set({ timeline });
      }
    } catch (error) {
      console.error('Failed to load timeline from localStorage:', error);
    }
  },

  /**
   * Save timeline to localStorage
   */
  saveTimeline: () => {
    if (typeof window === 'undefined') return;
    
    try {
      const { timeline } = get();
      localStorage.setItem('sculptnet-timeline', JSON.stringify(timeline));
    } catch (error) {
      console.error('Failed to save timeline to localStorage:', error);
    }
  },
}));

// ============ Selectors ============

/**
 * Select the most recent generation
 */
export const selectLatestGeneration = (state: GenerationStore): GenerationHistoryEntry | undefined => {
  return state.history[state.history.length - 1];
};

/**
 * Select generation count
 */
export const selectGenerationCount = (state: GenerationStore): number => {
  return state.history.length;
};

/**
 * Select whether there are any generations
 */
export const selectHasGenerations = (state: GenerationStore): boolean => {
  return state.history.length > 0;
};

export default useGenerationStore;
