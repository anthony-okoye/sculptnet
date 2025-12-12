/**
 * Tests for JSON State Manager (Prompt Store)
 * 
 * Tests the Zustand store and JSONStateManager class for:
 * - Initialization with defaults and custom values
 * - Deep merge for nested parameter updates
 * - Zod schema validation
 * - Revert-on-validation-failure logic
 * - Export/import functionality
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  JSONStateManager,
  createJSONStateManager,
  deepMerge,
  getAtPath,
  setAtPath,
} from '@/lib/stores/prompt-store';
import {
  DEFAULT_FIBO_PROMPT,
  validateFIBOPrompt,
  type FIBOStructuredPrompt,
} from '@/types/fibo';

describe('JSONStateManager', () => {
  let manager: JSONStateManager;

  beforeEach(() => {
    manager = createJSONStateManager();
  });

  describe('initialize()', () => {
    test('initializes with default FIBO prompt when no base provided', () => {
      manager.initialize();
      
      const prompt = manager.getPrompt();
      expect(prompt).toEqual(DEFAULT_FIBO_PROMPT);
      expect(manager.isInitialized()).toBe(true);
    });

    test('initializes with all required FIBO fields (Requirement 5.1)', () => {
      manager.initialize();
      
      const prompt = manager.getPrompt();
      
      // Check all required fields exist
      expect(prompt).toHaveProperty('style_medium');
      expect(prompt).toHaveProperty('short_description');
      expect(prompt).toHaveProperty('background_setting');
      expect(prompt).toHaveProperty('lighting');
      expect(prompt).toHaveProperty('lighting.conditions');
      expect(prompt).toHaveProperty('lighting.direction');
      expect(prompt).toHaveProperty('lighting.shadows');
      expect(prompt).toHaveProperty('aesthetics');
      expect(prompt).toHaveProperty('aesthetics.composition');
      expect(prompt).toHaveProperty('aesthetics.color_scheme');
      expect(prompt).toHaveProperty('aesthetics.mood_atmosphere');
      expect(prompt).toHaveProperty('photographic_characteristics');
      expect(prompt).toHaveProperty('photographic_characteristics.depth_of_field');
      expect(prompt).toHaveProperty('photographic_characteristics.camera_angle');
      expect(prompt).toHaveProperty('photographic_characteristics.lens_focal_length');
    });


    test('merges custom base prompt with defaults', () => {
      manager.initialize({
        short_description: 'custom sculpture',
        style_medium: 'digital art',
      });
      
      const prompt = manager.getPrompt();
      
      // Custom values should be applied
      expect(prompt.short_description).toBe('custom sculpture');
      expect(prompt.style_medium).toBe('digital art');
      
      // Default values should be preserved
      expect(prompt.lighting).toEqual(DEFAULT_FIBO_PROMPT.lighting);
      expect(prompt.aesthetics).toEqual(DEFAULT_FIBO_PROMPT.aesthetics);
    });

    test('deep merges nested custom values', () => {
      manager.initialize({
        lighting: {
          conditions: 'dramatic spotlight',
          direction: DEFAULT_FIBO_PROMPT.lighting.direction,
          shadows: DEFAULT_FIBO_PROMPT.lighting.shadows,
        },
      });
      
      const prompt = manager.getPrompt();
      
      expect(prompt.lighting.conditions).toBe('dramatic spotlight');
      expect(prompt.lighting.direction).toBe(DEFAULT_FIBO_PROMPT.lighting.direction);
    });

    test('falls back to defaults if invalid base prompt provided', () => {
      // Empty string is invalid for style_medium
      manager.initialize({ style_medium: '' });
      
      const prompt = manager.getPrompt();
      expect(prompt).toEqual(DEFAULT_FIBO_PROMPT);
    });
  });

  describe('update()', () => {
    beforeEach(() => {
      manager.initialize();
    });

    test('updates top-level field successfully', () => {
      const result = manager.update('style_medium', 'oil painting');
      
      expect(result.success).toBe(true);
      expect(manager.getPrompt().style_medium).toBe('oil painting');
    });

    test('updates nested field successfully (Requirement 5.2)', () => {
      const result = manager.update('lighting.conditions', 'golden hour sunset');
      
      expect(result.success).toBe(true);
      expect(manager.getPrompt().lighting.conditions).toBe('golden hour sunset');
    });

    test('preserves other fields when updating single parameter (Requirement 5.2)', () => {
      const originalPrompt = { ...manager.getPrompt() };
      
      manager.update('photographic_characteristics.camera_angle', 'bird\'s eye view');
      
      const updatedPrompt = manager.getPrompt();
      
      // Updated field should change
      expect(updatedPrompt.photographic_characteristics.camera_angle).toBe('bird\'s eye view');
      
      // Other fields should be preserved
      expect(updatedPrompt.style_medium).toBe(originalPrompt.style_medium);
      expect(updatedPrompt.lighting).toEqual(originalPrompt.lighting);
      expect(updatedPrompt.aesthetics).toEqual(originalPrompt.aesthetics);
      expect(updatedPrompt.photographic_characteristics.lens_focal_length)
        .toBe(originalPrompt.photographic_characteristics.lens_focal_length);
    });

    test('returns previous value on successful update', () => {
      const result = manager.update('style_medium', 'watercolor');
      
      expect(result.previousValue).toBe('photograph');
    });

    test('rejects invalid update and reverts (Requirement 5.3, 5.4)', () => {
      const originalPrompt = manager.getPrompt();
      
      // Empty string is invalid for required fields
      const result = manager.update('style_medium', '');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(manager.getPrompt()).toEqual(originalPrompt);
    });

    test('deeply nested update works correctly', () => {
      const result = manager.update('aesthetics.mood_atmosphere', 'dark and mysterious');
      
      expect(result.success).toBe(true);
      expect(manager.getPrompt().aesthetics.mood_atmosphere).toBe('dark and mysterious');
    });
  });

  describe('validate()', () => {
    test('returns success for valid prompt', () => {
      manager.initialize();
      
      const result = manager.validate();
      
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates against FIBO schema (Requirement 5.3)', () => {
      manager.initialize();
      
      const result = manager.validate();
      
      expect(result.success).toBe(true);
    });
  });

  describe('reset()', () => {
    test('resets to default prompt', () => {
      manager.initialize({ style_medium: 'custom style' });
      
      manager.reset();
      
      expect(manager.getPrompt()).toEqual(DEFAULT_FIBO_PROMPT);
    });
  });

  describe('export()', () => {
    test('exports prompt as valid JSON string', () => {
      manager.initialize();
      
      const exported = manager.export();
      
      expect(() => JSON.parse(exported)).not.toThrow();
      expect(JSON.parse(exported)).toEqual(DEFAULT_FIBO_PROMPT);
    });

    test('exported JSON is formatted with indentation', () => {
      manager.initialize();
      
      const exported = manager.export();
      
      expect(exported).toContain('\n');
      expect(exported).toContain('  ');
    });
  });

  describe('import()', () => {
    test('imports valid JSON successfully', () => {
      manager.initialize();
      
      const customPrompt: FIBOStructuredPrompt = {
        ...DEFAULT_FIBO_PROMPT,
        style_medium: 'imported style',
        short_description: 'imported description',
      };
      
      const result = manager.import(JSON.stringify(customPrompt));
      
      expect(result.success).toBe(true);
      expect(manager.getPrompt().style_medium).toBe('imported style');
    });

    test('rejects invalid JSON syntax', () => {
      manager.initialize();
      const originalPrompt = manager.getPrompt();
      
      const result = manager.import('{ invalid json }');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON parse error');
      expect(manager.getPrompt()).toEqual(originalPrompt);
    });

    test('rejects JSON that fails schema validation (Requirement 5.3)', () => {
      manager.initialize();
      const originalPrompt = manager.getPrompt();
      
      const invalidPrompt = { style_medium: '' }; // Missing required fields
      const result = manager.import(JSON.stringify(invalidPrompt));
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(manager.getPrompt()).toEqual(originalPrompt);
    });
  });
});


describe('Utility Functions', () => {
  describe('deepMerge()', () => {
    test('merges flat objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      
      const result = deepMerge(target, source);
      
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    test('deep merges nested objects', () => {
      const target = { a: { x: 1, y: 2 }, b: 3 };
      const source = { a: { x: 1, y: 5 } };
      
      const result = deepMerge(target, source);
      
      expect(result).toEqual({ a: { x: 1, y: 5 }, b: 3 });
    });

    test('does not mutate original objects', () => {
      const target = { a: { x: 1 } };
      const source = { a: { x: 2 } };
      
      deepMerge(target, source);
      
      expect(target).toEqual({ a: { x: 1 } });
      expect(source).toEqual({ a: { x: 2 } });
    });

    test('handles arrays by replacement', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };
      
      const result = deepMerge(target, source);
      
      expect(result.arr).toEqual([4, 5]);
    });
  });

  describe('getAtPath()', () => {
    test('gets top-level value', () => {
      const obj = { a: 1, b: 2 };
      
      expect(getAtPath(obj, 'a')).toBe(1);
    });

    test('gets nested value', () => {
      const obj = { a: { b: { c: 'deep' } } };
      
      expect(getAtPath(obj, 'a.b.c')).toBe('deep');
    });

    test('returns undefined for non-existent path', () => {
      const obj = { a: 1 };
      
      expect(getAtPath(obj, 'b.c.d')).toBeUndefined();
    });
  });

  describe('setAtPath()', () => {
    test('sets top-level value', () => {
      const obj = { a: 1 };
      
      const result = setAtPath(obj, 'a', 2);
      
      expect(result.a).toBe(2);
    });

    test('sets nested value', () => {
      const obj = { a: { b: 1 } };
      
      const result = setAtPath(obj, 'a.b', 2);
      
      expect(result.a.b).toBe(2);
    });

    test('creates nested structure if needed', () => {
      const obj: Record<string, unknown> = { a: 1 };
      
      const result = setAtPath(obj, 'b.c.d', 'new') as { b: { c: { d: string } } };
      
      expect(result.b.c.d).toBe('new');
    });

    test('does not mutate original object', () => {
      const obj = { a: { b: 1 } };
      
      setAtPath(obj, 'a.b', 2);
      
      expect(obj.a.b).toBe(1);
    });
  });
});

describe('validateFIBOPrompt()', () => {
  test('validates correct prompt', () => {
    const result = validateFIBOPrompt(DEFAULT_FIBO_PROMPT);
    
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects prompt with missing required fields', () => {
    const invalidPrompt = {
      style_medium: 'photograph',
      // Missing other required fields
    };
    
    const result = validateFIBOPrompt(invalidPrompt);
    
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('rejects prompt with empty required string', () => {
    const invalidPrompt = {
      ...DEFAULT_FIBO_PROMPT,
      style_medium: '', // Empty string is invalid
    };
    
    const result = validateFIBOPrompt(invalidPrompt);
    
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.path === 'style_medium')).toBe(true);
  });

  test('provides error path for nested validation failures', () => {
    const invalidPrompt = {
      ...DEFAULT_FIBO_PROMPT,
      lighting: {
        ...DEFAULT_FIBO_PROMPT.lighting,
        conditions: '', // Empty string is invalid
      },
    };
    
    const result = validateFIBOPrompt(invalidPrompt);
    
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.path.includes('lighting'))).toBe(true);
  });
});
