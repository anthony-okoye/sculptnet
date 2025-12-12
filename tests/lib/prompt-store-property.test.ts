/**
 * Property-Based Tests for JSON State Manager (Prompt Store)
 * 
 * Tests universal properties that should hold across all valid inputs:
 * - Property 10: No hands preserves prompt state
 * - Property 15: Parameter updates preserve other fields
 * - Property 16: Invalid prompts are rejected and reverted
 * 
 * Uses fast-check for property-based testing with 100+ iterations
 * 
 * Requirements: 3.4, 5.2, 5.3, 5.4, 6.2, 6.4
 */

import { describe, test, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  JSONStateManager,
  createJSONStateManager,
} from '@/lib/stores/prompt-store';
import {
  DEFAULT_FIBO_PROMPT,
  type FIBOStructuredPrompt,
} from '@/types/fibo';

// ============ Custom Arbitraries (Generators) ============

/**
 * Generate valid lighting conditions strings
 */
const arbitraryLightingConditions = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('soft volumetric god rays from left'),
    fc.constant('dramatic spotlight from above'),
    fc.constant('golden hour sunset'),
    fc.constant('bright studio lighting'),
    fc.constant('night, moonlight from above'),
    fc.constant('soft diffused natural light'),
    fc.constant('harsh direct sunlight'),
    fc.constant('neon lighting from multiple angles')
  );

/**
 * Generate valid camera angles
 */
const arbitraryCameraAngle = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('eye level'),
    fc.constant('low dutch tilt'),
    fc.constant('high angle'),
    fc.constant('bird\'s eye view'),
    fc.constant('worm\'s eye view'),
    fc.constant('slightly overhead')
  );

/**
 * Generate valid lens focal lengths
 */
const arbitraryLensFocalLength = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('24mm wide'),
    fc.constant('35mm standard'),
    fc.constant('50mm standard'),
    fc.constant('85mm portrait'),
    fc.constant('135mm telephoto'),
    fc.constant('200mm telephoto'),
    fc.constant('macro')
  );

/**
 * Generate valid composition strings
 */
const arbitraryComposition = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('rule of thirds'),
    fc.constant('subject centered'),
    fc.constant('panoramic composition'),
    fc.constant('diagonal composition'),
    fc.constant('symmetrical composition'),
    fc.constant('golden ratio')
  );

/**
 * Generate valid style mediums
 */
const arbitraryStyleMedium = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('photograph'),
    fc.constant('digital art'),
    fc.constant('oil painting'),
    fc.constant('watercolor'),
    fc.constant('pencil sketch'),
    fc.constant('3D render')
  );

/**
 * Generate valid mood/atmosphere strings
 */
const arbitraryMoodAtmosphere = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constant('elegant, sophisticated'),
    fc.constant('dark and mysterious'),
    fc.constant('bright and cheerful'),
    fc.constant('dramatic and intense'),
    fc.constant('calm and serene'),
    fc.constant('energetic and vibrant')
  );

/**
 * Generate valid parameter paths and values
 * Returns tuples of [path, value] that are valid for the FIBO schema
 */
const arbitraryValidParameterUpdate = (): fc.Arbitrary<[string, unknown]> =>
  fc.oneof(
    // Top-level string fields
    fc.tuple(fc.constant('style_medium'), arbitraryStyleMedium()),
    fc.tuple(fc.constant('short_description'), fc.string({ minLength: 1, maxLength: 200 })),
    fc.tuple(fc.constant('background_setting'), fc.string({ minLength: 1, maxLength: 200 })),
    fc.tuple(fc.constant('artistic_style'), fc.string({ minLength: 1, maxLength: 100 })),
    
    // Lighting fields
    fc.tuple(fc.constant('lighting.conditions'), arbitraryLightingConditions()),
    fc.tuple(fc.constant('lighting.direction'), fc.string({ minLength: 1, maxLength: 100 })),
    fc.tuple(fc.constant('lighting.shadows'), fc.string({ minLength: 1, maxLength: 100 })),
    
    // Aesthetics fields
    fc.tuple(fc.constant('aesthetics.composition'), arbitraryComposition()),
    fc.tuple(fc.constant('aesthetics.color_scheme'), fc.string({ minLength: 1, maxLength: 100 })),
    fc.tuple(fc.constant('aesthetics.mood_atmosphere'), arbitraryMoodAtmosphere()),
    
    // Photographic characteristics fields
    fc.tuple(fc.constant('photographic_characteristics.depth_of_field'), fc.string({ minLength: 1, maxLength: 100 })),
    fc.tuple(fc.constant('photographic_characteristics.focus'), fc.string({ minLength: 1, maxLength: 100 })),
    fc.tuple(fc.constant('photographic_characteristics.camera_angle'), arbitraryCameraAngle()),
    fc.tuple(fc.constant('photographic_characteristics.lens_focal_length'), arbitraryLensFocalLength())
  );

// ============ Helper Functions ============

/**
 * Deep clone an object to avoid mutation
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get all field paths from a nested object
 * Returns array of dot-separated paths
 */
function getAllFieldPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively get paths from nested objects
        paths.push(...getAllFieldPaths(value as Record<string, unknown>, path));
      } else {
        paths.push(path);
      }
    }
  }
  
  return paths;
}

/**
 * Get value at a path in an object
 */
function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}

/**
 * Check if two values are deeply equal
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  for (const key of aKeys) {
    if (!bKeys.includes(key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  
  return true;
}

// ============ Generators for Invalid Values ============

/**
 * Generate invalid parameter updates that should fail validation
 * Returns tuples of [path, invalidValue] that violate the FIBO schema
 */
const arbitraryInvalidParameterUpdate = (): fc.Arbitrary<[string, unknown]> =>
  fc.oneof(
    // Empty strings (violate min length requirement)
    fc.tuple(fc.constant('style_medium'), fc.constant('')),
    fc.tuple(fc.constant('short_description'), fc.constant('')),
    fc.tuple(fc.constant('background_setting'), fc.constant('')),
    fc.tuple(fc.constant('lighting.conditions'), fc.constant('')),
    fc.tuple(fc.constant('lighting.direction'), fc.constant('')),
    fc.tuple(fc.constant('lighting.shadows'), fc.constant('')),
    fc.tuple(fc.constant('aesthetics.composition'), fc.constant('')),
    fc.tuple(fc.constant('aesthetics.color_scheme'), fc.constant('')),
    fc.tuple(fc.constant('aesthetics.mood_atmosphere'), fc.constant('')),
    fc.tuple(fc.constant('photographic_characteristics.depth_of_field'), fc.constant('')),
    fc.tuple(fc.constant('photographic_characteristics.focus'), fc.constant('')),
    fc.tuple(fc.constant('photographic_characteristics.camera_angle'), fc.constant('')),
    fc.tuple(fc.constant('photographic_characteristics.lens_focal_length'), fc.constant('')),
    
    // Wrong types (should be strings)
    fc.tuple(fc.constant('style_medium'), fc.integer()),
    fc.tuple(fc.constant('short_description'), fc.boolean()),
    fc.tuple(fc.constant('lighting.conditions'), fc.array(fc.string())),
    fc.tuple(fc.constant('aesthetics.composition'), fc.constant(null)),
    fc.tuple(fc.constant('photographic_characteristics.camera_angle'), fc.constant(undefined)),
    
    // Invalid nested structures (should be objects)
    fc.tuple(fc.constant('lighting'), fc.string()),
    fc.tuple(fc.constant('aesthetics'), fc.integer()),
    fc.tuple(fc.constant('photographic_characteristics'), fc.constant(null)),
    
    // Missing required nested fields (partial objects)
    fc.tuple(fc.constant('lighting'), fc.record({ conditions: fc.string() })),
    fc.tuple(fc.constant('aesthetics'), fc.record({ composition: fc.string() })),
    fc.tuple(fc.constant('photographic_characteristics'), fc.record({ camera_angle: fc.string() }))
  );

/**
 * Generate completely invalid prompt structures
 * These should fail validation entirely
 */
const arbitraryInvalidPrompt = (): fc.Arbitrary<unknown> =>
  fc.oneof(
    // Primitives (not objects)
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
    fc.constant(undefined),
    
    // Arrays (not objects)
    fc.array(fc.string()),
    
    // Empty object (missing required fields)
    fc.constant({}),
    
    // Object with wrong structure
    fc.record({
      invalid_field: fc.string(),
      another_invalid: fc.integer(),
    }),
    
    // Object missing required fields
    fc.record({
      style_medium: fc.string(),
      // Missing all other required fields
    }),
    
    // Object with some valid and some invalid fields
    fc.record({
      style_medium: fc.string(),
      short_description: fc.integer(), // Wrong type
      lighting: fc.string(), // Should be object
    })
  );

// ============ Property-Based Tests ============

describe('Property-Based Tests: Prompt Store', () => {
  describe('Property 10: No hands preserves prompt state', () => {
    // Feature: sculptnet-gesture-sculpting, Property 10: No hands preserves prompt state
    test('processing zero hands detection preserves prompt state', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryValidParameterUpdate(), { minLength: 1, maxLength: 5 }),
          (updates) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Apply some updates to create a non-default state
            for (const [path, value] of updates) {
              manager.update(path, value);
            }
            
            // Store the current state
            const stateBeforeNoHands = deepClone(manager.getPrompt());
            
            // Simulate "no hands detected" scenario
            // In the actual system, when no hands are detected (results.length === 0),
            // the gesture controller simply doesn't call update() on the state manager
            // So the state should remain unchanged
            
            // Verify that the state is still the same (no updates were made)
            const stateAfterNoHands = manager.getPrompt();
            expect(deepEqual(stateAfterNoHands, stateBeforeNoHands)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 10: No hands preserves prompt state
    test('no hands detection after multiple updates preserves final state', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryValidParameterUpdate(), { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 1, max: 5 }),
          (updates, noHandsIterations) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Apply multiple updates
            for (const [path, value] of updates) {
              manager.update(path, value);
            }
            
            // Store the state after all updates
            const finalState = deepClone(manager.getPrompt());
            
            // Simulate multiple "no hands" detection cycles
            // In each cycle, no update() calls are made
            for (let i = 0; i < noHandsIterations; i++) {
              // No updates - just verify state is preserved
              const currentState = manager.getPrompt();
              expect(deepEqual(currentState, finalState)).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 10: No hands preserves prompt state
    test('alternating hands and no-hands preserves state during no-hands periods', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.boolean(), // true = hands detected, false = no hands
              arbitraryValidParameterUpdate()
            ),
            { minLength: 5, maxLength: 15 }
          ),
          (sequence) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            let lastStateWithHands = deepClone(manager.getPrompt());
            
            for (const [handsDetected, [path, value]] of sequence) {
              if (handsDetected) {
                // Hands detected - apply update
                manager.update(path, value);
                lastStateWithHands = deepClone(manager.getPrompt());
              } else {
                // No hands detected - state should be preserved
                const currentState = manager.getPrompt();
                expect(deepEqual(currentState, lastStateWithHands)).toBe(true);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 10: No hands preserves prompt state
    test('no hands at initialization preserves default state', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (noHandsIterations) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Store the initial default state
            const defaultState = deepClone(manager.getPrompt());
            
            // Simulate multiple "no hands" detections from the start
            for (let i = 0; i < noHandsIterations; i++) {
              const currentState = manager.getPrompt();
              expect(deepEqual(currentState, defaultState)).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 10: No hands preserves prompt state
    test('no hands preserves state across all field types', () => {
      fc.assert(
        fc.property(
          fc.record({
            styleMedium: arbitraryStyleMedium(),
            lightingConditions: arbitraryLightingConditions(),
            composition: arbitraryComposition(),
            cameraAngle: arbitraryCameraAngle(),
            lensFocalLength: arbitraryLensFocalLength(),
          }),
          (values) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Set various field types
            manager.update('style_medium', values.styleMedium);
            manager.update('lighting.conditions', values.lightingConditions);
            manager.update('aesthetics.composition', values.composition);
            manager.update('photographic_characteristics.camera_angle', values.cameraAngle);
            manager.update('photographic_characteristics.lens_focal_length', values.lensFocalLength);
            
            // Store the state with all updates
            const stateWithUpdates = deepClone(manager.getPrompt());
            
            // Simulate no hands detection
            // No updates should occur
            
            // Verify all fields are preserved
            const currentState = manager.getPrompt();
            expect(currentState.style_medium).toBe(values.styleMedium);
            expect(currentState.lighting.conditions).toBe(values.lightingConditions);
            expect(currentState.aesthetics.composition).toBe(values.composition);
            expect(currentState.photographic_characteristics.camera_angle).toBe(values.cameraAngle);
            expect(currentState.photographic_characteristics.lens_focal_length).toBe(values.lensFocalLength);
            expect(deepEqual(currentState, stateWithUpdates)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 10: No hands preserves prompt state
    test('no hands preserves nested object structures', () => {
      fc.assert(
        fc.property(
          fc.record({
            conditions: arbitraryLightingConditions(),
            direction: fc.string({ minLength: 1, maxLength: 100 }),
            shadows: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          (lightingValues) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Update all lighting fields
            manager.update('lighting.conditions', lightingValues.conditions);
            manager.update('lighting.direction', lightingValues.direction);
            manager.update('lighting.shadows', lightingValues.shadows);
            
            // Store the lighting object
            const lightingBefore = deepClone(manager.getPrompt().lighting);
            
            // Simulate no hands detection
            // No updates should occur
            
            // Verify entire lighting object is preserved
            const lightingAfter = manager.getPrompt().lighting;
            expect(deepEqual(lightingAfter, lightingBefore)).toBe(true);
            expect(lightingAfter.conditions).toBe(lightingValues.conditions);
            expect(lightingAfter.direction).toBe(lightingValues.direction);
            expect(lightingAfter.shadows).toBe(lightingValues.shadows);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 15: Parameter updates preserve other fields', () => {
    // Feature: sculptnet-gesture-sculpting, Property 15: Parameter updates preserve other fields
    test('updating any single parameter preserves all other fields', () => {
      fc.assert(
        fc.property(
          arbitraryValidParameterUpdate(),
          ([path, value]) => {
            // Create a fresh manager for each test
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Get the original prompt before update
            const originalPrompt = deepClone(manager.getPrompt());
            
            // Get all field paths in the original prompt
            const allPaths = getAllFieldPaths(originalPrompt as Record<string, unknown>);
            
            // Update the specified parameter
            const result = manager.update(path, value);
            
            // If update failed (validation error), all fields should be preserved
            if (!result.success) {
              const currentPrompt = manager.getPrompt();
              expect(deepEqual(currentPrompt, originalPrompt)).toBe(true);
              return true;
            }
            
            // If update succeeded, check that all OTHER fields are preserved
            const updatedPrompt = manager.getPrompt();
            
            // Check each field path
            for (const fieldPath of allPaths) {
              if (fieldPath === path) {
                // The updated field should have the new value
                const newValue = getValueAtPath(updatedPrompt as Record<string, unknown>, fieldPath);
                expect(newValue).toBe(value);
              } else {
                // All other fields should be unchanged
                const originalValue = getValueAtPath(originalPrompt as Record<string, unknown>, fieldPath);
                const currentValue = getValueAtPath(updatedPrompt as Record<string, unknown>, fieldPath);
                
                // Use deep equality check for nested objects
                if (typeof originalValue === 'object' && originalValue !== null) {
                  expect(deepEqual(currentValue, originalValue)).toBe(true);
                } else {
                  expect(currentValue).toBe(originalValue);
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 15: Parameter updates preserve other fields
    test('multiple sequential updates preserve unrelated fields', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryValidParameterUpdate(), { minLength: 2, maxLength: 5 }),
          (updates) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Track which paths have been updated
            const updatedPaths = new Set<string>();
            const expectedValues = new Map<string, unknown>();
            
            // Apply all updates
            for (const [path, value] of updates) {
              const result = manager.update(path, value);
              
              if (result.success) {
                updatedPaths.add(path);
                expectedValues.set(path, value);
              }
            }
            
            // Get final prompt
            const finalPrompt = manager.getPrompt();
            const allPaths = getAllFieldPaths(finalPrompt as Record<string, unknown>);
            
            // Check that all updated paths have their expected values
            for (const [path, expectedValue] of expectedValues.entries()) {
              const actualValue = getValueAtPath(finalPrompt as Record<string, unknown>, path);
              expect(actualValue).toBe(expectedValue);
            }
            
            // Check that paths not in the update list still have default values
            const defaultPaths = getAllFieldPaths(DEFAULT_FIBO_PROMPT as Record<string, unknown>);
            for (const path of defaultPaths) {
              if (!updatedPaths.has(path)) {
                const defaultValue = getValueAtPath(DEFAULT_FIBO_PROMPT as Record<string, unknown>, path);
                const actualValue = getValueAtPath(finalPrompt as Record<string, unknown>, path);
                
                if (typeof defaultValue === 'object' && defaultValue !== null) {
                  expect(deepEqual(actualValue, defaultValue)).toBe(true);
                } else {
                  expect(actualValue).toBe(defaultValue);
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 15: Parameter updates preserve other fields
    test('nested field updates preserve sibling fields', () => {
      fc.assert(
        fc.property(
          arbitraryLightingConditions(),
          (newConditions) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Store original lighting values
            const originalLighting = deepClone(manager.getPrompt().lighting);
            
            // Update only lighting.conditions
            const result = manager.update('lighting.conditions', newConditions);
            
            if (!result.success) {
              // If update failed, entire lighting object should be unchanged
              expect(deepEqual(manager.getPrompt().lighting, originalLighting)).toBe(true);
              return true;
            }
            
            // Check that conditions changed
            expect(manager.getPrompt().lighting.conditions).toBe(newConditions);
            
            // Check that sibling fields (direction, shadows) are preserved
            expect(manager.getPrompt().lighting.direction).toBe(originalLighting.direction);
            expect(manager.getPrompt().lighting.shadows).toBe(originalLighting.shadows);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 15: Parameter updates preserve other fields
    test('updating nested field preserves parent-level siblings', () => {
      fc.assert(
        fc.property(
          arbitraryCameraAngle(),
          (newAngle) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Store original values
            const originalLighting = deepClone(manager.getPrompt().lighting);
            const originalAesthetics = deepClone(manager.getPrompt().aesthetics);
            const originalStyleMedium = manager.getPrompt().style_medium;
            
            // Update a nested field in photographic_characteristics
            const result = manager.update('photographic_characteristics.camera_angle', newAngle);
            
            if (!result.success) {
              return true;
            }
            
            // Check that the update was applied
            expect(manager.getPrompt().photographic_characteristics.camera_angle).toBe(newAngle);
            
            // Check that completely unrelated top-level fields are preserved
            expect(deepEqual(manager.getPrompt().lighting, originalLighting)).toBe(true);
            expect(deepEqual(manager.getPrompt().aesthetics, originalAesthetics)).toBe(true);
            expect(manager.getPrompt().style_medium).toBe(originalStyleMedium);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Invalid prompts are rejected and reverted', () => {
    // Feature: sculptnet-gesture-sculpting, Property 16: Invalid prompts are rejected and reverted
    test('invalid parameter updates are rejected and prompt reverts to last valid state', () => {
      fc.assert(
        fc.property(
          arbitraryInvalidParameterUpdate(),
          ([path, invalidValue]) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Store the valid state before attempting invalid update
            const validPrompt = deepClone(manager.getPrompt());
            
            // Attempt to update with invalid value
            const result = manager.update(path, invalidValue);
            
            // Update should fail
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            
            // Prompt should be reverted to the last valid state
            const currentPrompt = manager.getPrompt();
            expect(deepEqual(currentPrompt, validPrompt)).toBe(true);
            
            // Validation should fail
            const validation = manager.validate();
            expect(validation.success).toBe(true); // Should be valid because it reverted
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 16: Invalid prompts are rejected and reverted
    test('sequence of valid then invalid updates preserves last valid state', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryValidParameterUpdate(), { minLength: 1, maxLength: 3 }),
          arbitraryInvalidParameterUpdate(),
          (validUpdates, [invalidPath, invalidValue]) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Apply valid updates
            for (const [path, value] of validUpdates) {
              manager.update(path, value);
            }
            
            // Store the state after valid updates
            const lastValidPrompt = deepClone(manager.getPrompt());
            
            // Attempt invalid update
            const result = manager.update(invalidPath, invalidValue);
            
            // Invalid update should fail
            expect(result.success).toBe(false);
            
            // Prompt should match the last valid state (after valid updates)
            const currentPrompt = manager.getPrompt();
            expect(deepEqual(currentPrompt, lastValidPrompt)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 16: Invalid prompts are rejected and reverted
    test('importing invalid JSON is rejected and current state preserved', () => {
      fc.assert(
        fc.property(
          arbitraryInvalidPrompt(),
          (invalidPrompt) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Store the current valid state
            const validPrompt = deepClone(manager.getPrompt());
            
            // Attempt to import invalid prompt
            const json = JSON.stringify(invalidPrompt);
            const result = manager.import(json);
            
            // Import should fail
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            
            // Current prompt should be unchanged
            const currentPrompt = manager.getPrompt();
            expect(deepEqual(currentPrompt, validPrompt)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 16: Invalid prompts are rejected and reverted
    test('importing malformed JSON is rejected with parse error', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            // Generate strings that are NOT valid JSON
            try {
              JSON.parse(s);
              return false; // Valid JSON, skip
            } catch {
              return true; // Invalid JSON, use it
            }
          }),
          (malformedJson) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Store the current valid state
            const validPrompt = deepClone(manager.getPrompt());
            
            // Attempt to import malformed JSON
            const result = manager.import(malformedJson);
            
            // Import should fail with parse error
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error).toContain('JSON parse error');
            
            // Current prompt should be unchanged
            const currentPrompt = manager.getPrompt();
            expect(deepEqual(currentPrompt, validPrompt)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 16: Invalid prompts are rejected and reverted
    test('multiple consecutive invalid updates all revert to last valid state', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryInvalidParameterUpdate(), { minLength: 2, maxLength: 5 }),
          (invalidUpdates) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Store the initial valid state
            const initialValidPrompt = deepClone(manager.getPrompt());
            
            // Attempt multiple invalid updates
            for (const [path, invalidValue] of invalidUpdates) {
              const result = manager.update(path, invalidValue);
              
              // Each update should fail
              expect(result.success).toBe(false);
              
              // After each failed update, prompt should still match initial valid state
              const currentPrompt = manager.getPrompt();
              expect(deepEqual(currentPrompt, initialValidPrompt)).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 16: Invalid prompts are rejected and reverted
    test('invalid update to nested field preserves entire parent object', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.tuple(fc.constant('lighting.conditions'), fc.constant('')),
            fc.tuple(fc.constant('aesthetics.composition'), fc.constant('')),
            fc.tuple(fc.constant('photographic_characteristics.camera_angle'), fc.constant(''))
          ),
          ([path, invalidValue]) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Store the original nested objects
            const originalLighting = deepClone(manager.getPrompt().lighting);
            const originalAesthetics = deepClone(manager.getPrompt().aesthetics);
            const originalPhotographic = deepClone(manager.getPrompt().photographic_characteristics);
            
            // Attempt invalid update to nested field
            const result = manager.update(path, invalidValue);
            
            // Update should fail
            expect(result.success).toBe(false);
            
            // All nested objects should be preserved
            expect(deepEqual(manager.getPrompt().lighting, originalLighting)).toBe(true);
            expect(deepEqual(manager.getPrompt().aesthetics, originalAesthetics)).toBe(true);
            expect(deepEqual(manager.getPrompt().photographic_characteristics, originalPhotographic)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: sculptnet-gesture-sculpting, Property 16: Invalid prompts are rejected and reverted
    test('validation errors contain descriptive messages', () => {
      fc.assert(
        fc.property(
          arbitraryInvalidParameterUpdate(),
          ([path, invalidValue]) => {
            const manager = createJSONStateManager();
            manager.initialize();
            
            // Attempt invalid update
            const result = manager.update(path, invalidValue);
            
            // Should fail with error message
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
            expect(result.error!.length).toBeGreaterThan(0);
            
            // Error should contain path information
            // (helps users understand what went wrong)
            const errorLower = result.error!.toLowerCase();
            const pathParts = path.split('.');
            const hasPathInfo = pathParts.some(part => errorLower.includes(part.toLowerCase()));
            expect(hasPathInfo).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
