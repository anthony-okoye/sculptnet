/**
 * Generation Store Tests
 * 
 * Tests for the generation history store.
 * Verifies history management, status updates, and AR scene integration.
 * 
 * Requirements: 2.2, 2.3, 4.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  useGenerationStore, 
  MAX_HISTORY_SIZE,
  selectLatestGeneration,
  selectGenerationCount,
  selectHasGenerations,
} from '@/lib/stores/generation-store';
import type { GenerationResult } from '@/lib/bria-client';

// ============ Test Utilities ============

/**
 * Create a mock generation result
 */
function createMockGenerationResult(overrides: Partial<GenerationResult> = {}): GenerationResult {
  return {
    imageUrl: `https://example.com/image-${Date.now()}.png`,
    prompt: 'test prompt',
    timestamp: Date.now(),
    seed: Math.floor(Math.random() * 1000000),
    requestId: `req-${Date.now()}`,
    ...overrides,
  };
}

/**
 * Reset the store to initial state and return fresh state
 */
function resetStore() {
  // Reset to initial state
  useGenerationStore.setState({
    history: [],
    status: 'idle',
    error: null,
    isGenerating: false,
  });
}

/**
 * Get current store state
 */
function getStore() {
  return useGenerationStore.getState();
}

// ============ Tests ============

describe('Generation Store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('addGeneration', () => {
    it('should add a generation to history', () => {
      const result = createMockGenerationResult();
      
      const entry = getStore().addGeneration(result);
      const state = getStore();
      
      expect(entry.imageUrl).toBe(result.imageUrl);
      expect(entry.id).toBeDefined();
      expect(state.history).toHaveLength(1);
      expect(state.history[0].imageUrl).toBe(result.imageUrl);
    });

    it('should set inARScene to true when arEntityId is provided', () => {
      const result = createMockGenerationResult();
      
      const entry = getStore().addGeneration(result, 'ar-entity-123');
      
      expect(entry.inARScene).toBe(true);
      expect(entry.arEntityId).toBe('ar-entity-123');
    });

    it('should set inARScene to false when arEntityId is not provided', () => {
      const result = createMockGenerationResult();
      
      const entry = getStore().addGeneration(result);
      
      expect(entry.inARScene).toBe(false);
      expect(entry.arEntityId).toBeUndefined();
    });

    it('should keep only the last MAX_HISTORY_SIZE entries', () => {
      // Add more than MAX_HISTORY_SIZE entries
      for (let i = 0; i < MAX_HISTORY_SIZE + 5; i++) {
        getStore().addGeneration(createMockGenerationResult({
          requestId: `req-${i}`,
        }));
      }
      
      const state = getStore();
      expect(state.history).toHaveLength(MAX_HISTORY_SIZE);
      // The oldest entries should be removed
      expect(state.history[0].requestId).toBe(`req-5`);
    });

    it('should reset status to idle after adding generation', () => {
      getStore().setGenerating(true);
      
      getStore().addGeneration(createMockGenerationResult());
      
      const state = getStore();
      expect(state.status).toBe('idle');
      expect(state.isGenerating).toBe(false);
    });
  });

  describe('removeGeneration', () => {
    it('should remove a generation by ID', () => {
      const entry = getStore().addGeneration(createMockGenerationResult());
      
      expect(getStore().history).toHaveLength(1);
      
      getStore().removeGeneration(entry.id);
      
      expect(getStore().history).toHaveLength(0);
    });

    it('should not affect other entries when removing', () => {
      const entry1 = getStore().addGeneration(createMockGenerationResult({ requestId: 'req-1' }));
      getStore().addGeneration(createMockGenerationResult({ requestId: 'req-2' }));
      
      getStore().removeGeneration(entry1.id);
      
      const state = getStore();
      expect(state.history).toHaveLength(1);
      expect(state.history[0].requestId).toBe('req-2');
    });
  });

  describe('clearHistory', () => {
    it('should clear all history entries', () => {
      // Add multiple entries
      for (let i = 0; i < 5; i++) {
        getStore().addGeneration(createMockGenerationResult());
      }
      
      expect(getStore().history).toHaveLength(5);
      
      getStore().clearHistory();
      
      expect(getStore().history).toHaveLength(0);
    });
  });

  describe('status management', () => {
    it('should update status correctly', () => {
      getStore().setStatus('generating');
      expect(getStore().status).toBe('generating');
      
      getStore().setStatus('polling');
      expect(getStore().status).toBe('polling');
      
      getStore().setStatus('idle');
      expect(getStore().status).toBe('idle');
    });

    it('should set error and update status to error', () => {
      getStore().setError('Test error message');
      
      const state = getStore();
      expect(state.error).toBe('Test error message');
      expect(state.status).toBe('error');
    });

    it('should clear error and set status to idle when error is null', () => {
      getStore().setError('Test error');
      
      getStore().setError(null);
      
      const state = getStore();
      expect(state.error).toBeNull();
      expect(state.status).toBe('idle');
    });

    it('should update isGenerating state', () => {
      getStore().setGenerating(true);
      expect(getStore().isGenerating).toBe(true);
      expect(getStore().status).toBe('generating');
      
      getStore().setGenerating(false);
      expect(getStore().isGenerating).toBe(false);
      expect(getStore().status).toBe('idle');
    });
  });

  describe('AR scene integration', () => {
    it('should update AR status for an entry', () => {
      const entry = getStore().addGeneration(createMockGenerationResult());
      
      expect(entry.inARScene).toBe(false);
      
      getStore().updateARStatus(entry.id, true, 'ar-entity-456');
      
      const updatedEntry = getStore().getEntry(entry.id);
      expect(updatedEntry?.inARScene).toBe(true);
      expect(updatedEntry?.arEntityId).toBe('ar-entity-456');
    });

    it('should get entries currently in AR scene', () => {
      getStore().addGeneration(createMockGenerationResult(), 'ar-1');
      getStore().addGeneration(createMockGenerationResult()); // Not in AR
      getStore().addGeneration(createMockGenerationResult(), 'ar-2');
      
      const arEntries = getStore().getARSceneEntries();
      
      expect(arEntries).toHaveLength(2);
      expect(arEntries.every(e => e.inARScene)).toBe(true);
    });
  });

  describe('getEntry', () => {
    it('should return entry by ID', () => {
      const entry = getStore().addGeneration(createMockGenerationResult({ requestId: 'test-req' }));
      
      const found = getStore().getEntry(entry.id);
      
      expect(found).toBeDefined();
      expect(found?.requestId).toBe('test-req');
    });

    it('should return undefined for non-existent ID', () => {
      const found = getStore().getEntry('non-existent-id');
      
      expect(found).toBeUndefined();
    });
  });

  describe('selectors', () => {
    it('selectLatestGeneration should return the most recent entry', () => {
      getStore().addGeneration(createMockGenerationResult({ requestId: 'req-1' }));
      getStore().addGeneration(createMockGenerationResult({ requestId: 'req-2' }));
      getStore().addGeneration(createMockGenerationResult({ requestId: 'req-3' }));
      
      const latest = selectLatestGeneration(getStore());
      
      expect(latest?.requestId).toBe('req-3');
    });

    it('selectGenerationCount should return the number of entries', () => {
      getStore().addGeneration(createMockGenerationResult());
      getStore().addGeneration(createMockGenerationResult());
      
      const count = selectGenerationCount(getStore());
      
      expect(count).toBe(2);
    });

    it('selectHasGenerations should return true when history is not empty', () => {
      expect(selectHasGenerations(getStore())).toBe(false);
      
      getStore().addGeneration(createMockGenerationResult());
      
      expect(selectHasGenerations(getStore())).toBe(true);
    });
  });
});

describe('MAX_HISTORY_SIZE constant', () => {
  it('should be 10', () => {
    expect(MAX_HISTORY_SIZE).toBe(10);
  });
});
