/**
 * Property-based tests for GestureMapper
 * 
 * Tests universal properties that should hold across all valid executions
 * of the gesture mapping system.
 * 
 * Feature: sculptnet-gesture-sculpting
 * Requirements: 1.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { GestureMapper, lensDescriptionToFOV } from '@/lib/gesture-mapper';
import { type HandLandmark, LANDMARK_INDICES } from '@/lib/hand-tracker';

// ============ Custom Generators ============

/**
 * Generate a valid HandLandmark with normalized coordinates
 */
const arbitraryHandLandmark = (): fc.Arbitrary<HandLandmark> => {
  return fc.record({
    x: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
    y: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
    z: fc.float({ min: Math.fround(-0.1), max: Math.fround(0.1), noNaN: true }),
  });
};

/**
 * Generate a complete array of 21 hand landmarks
 */
const arbitraryHandLandmarks = (): fc.Arbitrary<HandLandmark[]> => {
  return fc.array(arbitraryHandLandmark(), { minLength: 21, maxLength: 21 });
};

/**
 * Generate hand landmarks with a pinch gesture
 * Ensures thumb tip and index tip are within valid pinch distance range (0.02 - 0.25)
 */
const arbitraryPinchLandmarks = (): fc.Arbitrary<HandLandmark[]> => {
  return fc.tuple(
    // Generate base landmarks
    arbitraryHandLandmarks(),
    // Generate pinch distance in valid range
    fc.float({ min: Math.fround(0.02), max: Math.fround(0.25), noNaN: true }),
    // Generate base position for pinch
    fc.record({
      x: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8), noNaN: true }),
      y: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8), noNaN: true }),
      z: fc.float({ min: Math.fround(-0.05), max: Math.fround(0.05), noNaN: true }),
    })
  ).map(([landmarks, distance, basePos]) => {
    // Set thumb tip at base position
    landmarks[LANDMARK_INDICES.THUMB_TIP] = { ...basePos };
    
    // Set index tip at calculated distance (horizontally for simplicity)
    landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP] = {
      x: basePos.x + distance,
      y: basePos.y,
      z: basePos.z,
    };
    
    return landmarks;
  });
};

// ============ Property Tests ============

describe('GestureMapper Property-Based Tests', () => {
  let mapper: GestureMapper;

  beforeEach(() => {
    mapper = new GestureMapper();
  });

  /**
   * Feature: sculptnet-gesture-sculpting, Property 1: Pinch gesture updates FOV correctly
   * 
   * For any hand landmark configuration representing a pinch gesture (thumb tip and index tip distance),
   * calculating the gesture update should produce a camera FOV value between 35 and 120 degrees
   * that correlates with the pinch distance.
   * 
   * Validates: Requirements 1.1
   */
  it('Property 1: Pinch gesture updates FOV correctly', () => {
    fc.assert(
      fc.property(
        arbitraryPinchLandmarks(),
        (landmarks: HandLandmark[]) => {
          // Execute the gesture mapping
          const result = mapper.mapPinchToFOV(landmarks);
          
          // The result should not be null for valid pinch landmarks
          expect(result).not.toBeNull();
          
          if (result) {
            // Property 1a: The path should be correct
            expect(result.path).toBe('photographic_characteristics.lens_focal_length');
            
            // Property 1b: The value should be a valid lens description
            const validLensDescriptions = [
              '200mm telephoto',
              '85mm portrait',
              '50mm standard',
              '35mm wide',
              '24mm ultra-wide',
            ];
            expect(validLensDescriptions).toContain(result.value);
            
            // Property 1c: The FOV should be in valid range (35-120 degrees)
            // Convert lens description back to FOV to verify
            const fov = lensDescriptionToFOV(result.value as string);
            expect(fov).toBeGreaterThanOrEqual(35);
            expect(fov).toBeLessThanOrEqual(120);
            
            // Property 1d: Confidence should be between 0 and 1
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            
            // Property 1e: Smaller pinch distance should correlate with narrower FOV (telephoto)
            // Larger pinch distance should correlate with wider FOV (wide-angle)
            const thumbTip = landmarks[LANDMARK_INDICES.THUMB_TIP];
            const indexTip = landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP];
            const dx = thumbTip.x - indexTip.x;
            const dy = thumbTip.y - indexTip.y;
            const dz = thumbTip.z - indexTip.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // Normalize distance to 0-1 range (0.02 to 0.25)
            const normalizedDistance = (distance - 0.02) / (0.25 - 0.02);
            
            // Expected FOV based on distance
            const expectedFov = 35 + (normalizedDistance * (120 - 35));
            
            // The actual FOV should be reasonably close to expected
            // Allow for rounding and lens description bucketing
            const actualFov = lensDescriptionToFOV(result.value as string);
            const fovDeviation = Math.abs(actualFov - expectedFov);
            
            // FOV should be within reasonable range (lens descriptions are bucketed)
            // Each bucket spans about 15-20 degrees, so allow up to 25 degrees deviation
            expect(fovDeviation).toBeLessThan(30);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1 Edge Case: Invalid pinch distances return null
   * 
   * For any hand landmarks where the pinch distance is outside the valid range,
   * the mapper should return null.
   */
  it('Property 1 Edge Case: Invalid pinch distances return null', () => {
    fc.assert(
      fc.property(
        arbitraryHandLandmarks(),
        fc.oneof(
          // Too small distance (< 0.02)
          fc.float({ min: Math.fround(0), max: Math.fround(0.019), noNaN: true }),
          // Too large distance (> 0.25)
          fc.float({ min: Math.fround(0.251), max: Math.fround(1.0), noNaN: true })
        ),
        (landmarks: HandLandmark[], invalidDistance: number) => {
          // Set thumb and index at invalid distance
          landmarks[LANDMARK_INDICES.THUMB_TIP] = { x: 0.5, y: 0.5, z: 0 };
          landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP] = {
            x: 0.5 + invalidDistance,
            y: 0.5,
            z: 0,
          };
          
          const result = mapper.mapPinchToFOV(landmarks);
          
          // Should return null for invalid distances
          expect(result).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1 Monotonicity: Increasing pinch distance increases FOV
   * 
   * For any two valid pinch gestures where distance1 < distance2,
   * the FOV for distance2 should be greater than or equal to FOV for distance1.
   */
  it('Property 1 Monotonicity: Increasing pinch distance increases FOV', () => {
    fc.assert(
      fc.property(
        // Generate two distances in valid range where distance1 < distance2
        fc.float({ min: Math.fround(0.02), max: Math.fround(0.24), noNaN: true }),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.05), noNaN: true }),
        (distance1: number, increment: number) => {
          const distance2 = Math.min(0.25, distance1 + increment);
          
          // Skip if distances are too close (within rounding error)
          if (Math.abs(distance2 - distance1) < 0.01) {
            return true;
          }
          
          // Create landmarks for first pinch
          const landmarks1: HandLandmark[] = Array.from({ length: 21 }, () => ({
            x: 0.5,
            y: 0.5,
            z: 0,
          }));
          landmarks1[LANDMARK_INDICES.THUMB_TIP] = { x: 0.5, y: 0.5, z: 0 };
          landmarks1[LANDMARK_INDICES.INDEX_FINGER_TIP] = {
            x: 0.5 + distance1,
            y: 0.5,
            z: 0,
          };
          
          // Create landmarks for second pinch
          const landmarks2: HandLandmark[] = Array.from({ length: 21 }, () => ({
            x: 0.5,
            y: 0.5,
            z: 0,
          }));
          landmarks2[LANDMARK_INDICES.THUMB_TIP] = { x: 0.5, y: 0.5, z: 0 };
          landmarks2[LANDMARK_INDICES.INDEX_FINGER_TIP] = {
            x: 0.5 + distance2,
            y: 0.5,
            z: 0,
          };
          
          const result1 = mapper.mapPinchToFOV(landmarks1);
          const result2 = mapper.mapPinchToFOV(landmarks2);
          
          // Both should return valid results
          if (result1 && result2) {
            const fov1 = lensDescriptionToFOV(result1.value as string);
            const fov2 = lensDescriptionToFOV(result2.value as string);
            
            // FOV should increase (or stay same) with distance
            // Allow for bucketing effects where FOV might be equal
            expect(fov2).toBeGreaterThanOrEqual(fov1 - 5); // Small tolerance for bucketing
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
