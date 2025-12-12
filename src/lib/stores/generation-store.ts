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
}

/**
 * Generation store state
 */
export interface GenerationState {
  /** Generation history (most recent last) */
  history: GenerationHistoryEntry[];
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
  addGeneration: (result: GenerationResult, arEntityId?: string) => GenerationHistoryEntry;
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
  status: 'idle',
  error: null,
  isGenerating: false,

  /**
   * Add a generation result to history
   * Keeps only the last MAX_HISTORY_SIZE entries
   */
  addGeneration: (result: GenerationResult, arEntityId?: string): GenerationHistoryEntry => {
    const entry: GenerationHistoryEntry = {
      ...result,
      id: generateEntryId(),
      inARScene: !!arEntityId,
      arEntityId,
    };

    set(state => {
      const newHistory = [...state.history, entry];
      // Keep only the last MAX_HISTORY_SIZE entries
      const trimmedHistory = newHistory.slice(-MAX_HISTORY_SIZE);
      
      return {
        history: trimmedHistory,
        status: 'idle',
        error: null,
        isGenerating: false,
      };
    });

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
    set({ history: [] });
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
