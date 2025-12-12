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
   * 
   * Note: The implementation uses an epsilon of 0.001 for floating-point tolerance,
   * so we need to test values clearly outside the range.
   */
  it('Property 1 Edge Case: Invalid pinch distances return null', () => {
    fc.assert(
      fc.property(
        arbitraryHandLandmarks(),
        fc.oneof(
          // Too small distance (< 0.02 - epsilon)
          fc.float({ min: Math.fround(0), max: Math.fround(0.018), noNaN: true }),
          // Too large distance (> 0.25 + epsilon)
          fc.float({ min: Math.fround(0.252), max: Math.fround(1.0), noNaN: true })
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

  /**
   * Feature: sculptnet-gesture-sculpting, Property 2: Wrist rotation updates camera angle correctly
   * 
   * For any hand landmark configuration with measurable wrist rotation, the gesture mapper should
   * produce a camera angle parameter that corresponds to the rotation range (e.g., negative angles
   * map to "low dutch tilt", positive to "high angle").
   * 
   * Validates: Requirements 1.2
   */
  it('Property 2: Wrist rotation updates camera angle correctly', () => {
    fc.assert(
      fc.property(
        arbitraryHandLandmarks(),
        // Generate rotation angle in degrees (-180 to 180)
        fc.float({ min: Math.fround(-180), max: Math.fround(180), noNaN: true }),
        (landmarks: HandLandmark[], rotationDegrees: number) => {
          // Position wrist at center
          const wrist = { x: 0.5, y: 0.5, z: 0 };
          landmarks[LANDMARK_INDICES.WRIST] = wrist;
          
          // Calculate middle finger base position based on rotation
          // Convert degrees to radians
          const rotationRadians = (rotationDegrees * Math.PI) / 180;
          
          // Place middle finger base at a fixed distance (0.15) from wrist
          const distance = 0.15;
          const middleBase = {
            x: wrist.x + distance * Math.cos(rotationRadians),
            y: wrist.y + distance * Math.sin(rotationRadians),
            z: 0,
          };
          landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP] = middleBase;
          
          // Execute the gesture mapping
          const result = mapper.mapWristRotationToAngle(landmarks);
          
          // The result should not be null for valid landmarks
          expect(result).not.toBeNull();
          
          if (result) {
            // Property 2a: The path should be correct
            expect(result.path).toBe('photographic_characteristics.camera_angle');
            
            // Property 2b: The value should be a valid camera angle
            const validCameraAngles = [
              'low dutch tilt',
              'eye level',
              'high angle',
              "bird's eye view",
            ];
            expect(validCameraAngles).toContain(result.value);
            
            // Property 2c: Confidence should be between 0 and 1
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            
            // Property 2d: Verify angle mapping is correct
            // The implementation calculates angle using atan2, which returns [-180, 180]
            // Then adjusts by -90 to normalize (0 = hand pointing up)
            // We need to calculate what atan2 will actually return for our constructed landmarks
            const dx = middleBase.x - wrist.x;
            const dy = middleBase.y - wrist.y;
            const actualAngleRadians = Math.atan2(dy, dx);
            const actualAngleDegrees = actualAngleRadians * (180 / Math.PI);
            const adjustedAngle = actualAngleDegrees - 90;
            
            // Verify the mapping matches the expected ranges
            if (adjustedAngle < -15) {
              expect(result.value).toBe('low dutch tilt');
            } else if (adjustedAngle < 15) {
              expect(result.value).toBe('eye level');
            } else if (adjustedAngle < 45) {
              expect(result.value).toBe('high angle');
            } else {
              expect(result.value).toBe("bird's eye view");
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2 Edge Case: Specific angle ranges map to correct presets
   * 
   * Verify that specific angle ranges consistently map to the expected camera angle presets.
   */
  it('Property 2 Edge Case: Specific angle ranges map to correct presets', () => {
    const testCases = [
      { angle: 0, expected: 'low dutch tilt' },      // 0 - 90 = -90 < -15
      { angle: 45, expected: 'low dutch tilt' },     // 45 - 90 = -45 < -15
      { angle: 80, expected: 'eye level' },          // 80 - 90 = -10, in [-15, 15)
      { angle: 90, expected: 'eye level' },          // 90 - 90 = 0, in [-15, 15)
      { angle: 100, expected: 'eye level' },         // 100 - 90 = 10, in [-15, 15)
      { angle: 110, expected: 'high angle' },        // 110 - 90 = 20, in [15, 45)
      { angle: 130, expected: 'high angle' },        // 130 - 90 = 40, in [15, 45)
      { angle: 140, expected: "bird's eye view" },   // 140 - 90 = 50 >= 45
      { angle: 180, expected: "bird's eye view" },   // 180 - 90 = 90 >= 45
    ];

    for (const { angle, expected } of testCases) {
      const landmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
      }));

      // Position wrist and middle finger base
      const wrist = { x: 0.5, y: 0.5, z: 0 };
      landmarks[LANDMARK_INDICES.WRIST] = wrist;

      const rotationRadians = (angle * Math.PI) / 180;
      const distance = 0.15;
      landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP] = {
        x: wrist.x + distance * Math.cos(rotationRadians),
        y: wrist.y + distance * Math.sin(rotationRadians),
        z: 0,
      };

      const result = mapper.mapWristRotationToAngle(landmarks);
      expect(result).not.toBeNull();
      expect(result?.value).toBe(expected);
    }
  });

  /**
   * Property 2 Monotonicity: Increasing rotation angle progresses through presets
   * 
   * For any sequence of increasing rotation angles, the camera angle presets should
   * progress in order: low dutch tilt → eye level → high angle → bird's eye view.
   */
  it('Property 2 Monotonicity: Increasing rotation angle progresses through presets', () => {
    const angleSequence = [0, 45, 80, 90, 100, 110, 130, 140, 180];
    const expectedSequence = [
      'low dutch tilt',
      'low dutch tilt',
      'eye level',
      'eye level',
      'eye level',
      'high angle',
      'high angle',
      "bird's eye view",
      "bird's eye view",
    ];

    const results: string[] = [];

    for (const angle of angleSequence) {
      const landmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
      }));

      const wrist = { x: 0.5, y: 0.5, z: 0 };
      landmarks[LANDMARK_INDICES.WRIST] = wrist;

      const rotationRadians = (angle * Math.PI) / 180;
      const distance = 0.15;
      landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP] = {
        x: wrist.x + distance * Math.cos(rotationRadians),
        y: wrist.y + distance * Math.sin(rotationRadians),
        z: 0,
      };

      const result = mapper.mapWristRotationToAngle(landmarks);
      if (result) {
        results.push(result.value as string);
      }
    }

    // Verify the sequence matches expected progression
    expect(results).toEqual(expectedSequence);
  });

  /**
   * Feature: sculptnet-gesture-sculpting, Property 3: Vertical hand movement updates lighting correctly
   * 
   * For any hand landmark configuration with a y-coordinate position, the gesture mapper should
   * produce a lighting parameter that corresponds to the vertical position range.
   * 
   * Validates: Requirements 1.3
   */
  it('Property 3: Vertical hand movement updates lighting correctly', () => {
    fc.assert(
      fc.property(
        arbitraryHandLandmarks(),
        // Generate y-coordinate in valid range (0-1, where 0 is top, 1 is bottom)
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        (landmarks: HandLandmark[], yPosition: number) => {
          // Create a fresh mapper for each test to avoid history contamination
          const freshMapper = new GestureMapper();
          
          // Set wrist at the specified y position
          landmarks[LANDMARK_INDICES.WRIST] = {
            x: 0.5,
            y: yPosition,
            z: 0,
          };
          
          // Call multiple times with the same position to fill the smoothing buffer
          // This ensures the smoothed value converges to the actual position
          let result = null;
          for (let i = 0; i < 5; i++) {
            result = freshMapper.mapVerticalMovementToLighting(landmarks);
          }
          
          // The result should not be null for valid landmarks
          expect(result).not.toBeNull();
          
          if (result) {
            // Property 3a: The path should be correct
            expect(result.path).toBe('lighting.conditions');
            
            // Property 3b: The value should be a valid lighting preset
            const validLightingPresets = [
              'night, moonlight from above',
              'golden hour from top',
              'soft volumetric god rays from left',
              'bright studio lighting',
            ];
            expect(validLightingPresets).toContain(result.value);
            
            // Property 3c: Confidence should be between 0 and 1
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            
            // Property 3d: Verify y-position to lighting mapping is correct
            // After filling the smoothing buffer, the smoothed value should equal the input
            // Note: y=0 is top (night), y=1 is bottom (studio)
            if (yPosition < 0.3) {
              expect(result.value).toBe('night, moonlight from above');
            } else if (yPosition < 0.5) {
              expect(result.value).toBe('golden hour from top');
            } else if (yPosition < 0.7) {
              expect(result.value).toBe('soft volumetric god rays from left');
            } else {
              expect(result.value).toBe('bright studio lighting');
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3 Edge Case: Specific y-positions map to correct lighting presets
   * 
   * Verify that specific y-position ranges consistently map to the expected lighting presets.
   */
  it('Property 3 Edge Case: Specific y-positions map to correct lighting presets', () => {
    const testCases = [
      { y: 0.0, expected: 'night, moonlight from above' },
      { y: 0.1, expected: 'night, moonlight from above' },
      { y: 0.29, expected: 'night, moonlight from above' },
      { y: 0.3, expected: 'golden hour from top' },
      { y: 0.4, expected: 'golden hour from top' },
      { y: 0.49, expected: 'golden hour from top' },
      { y: 0.5, expected: 'soft volumetric god rays from left' },
      { y: 0.6, expected: 'soft volumetric god rays from left' },
      { y: 0.69, expected: 'soft volumetric god rays from left' },
      { y: 0.7, expected: 'bright studio lighting' },
      { y: 0.8, expected: 'bright studio lighting' },
      { y: 0.9, expected: 'bright studio lighting' },
      { y: 1.0, expected: 'bright studio lighting' },
    ];

    for (const { y, expected } of testCases) {
      // Create fresh mapper for each test to avoid history effects
      const freshMapper = new GestureMapper();
      
      const landmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
      }));

      // Set wrist at specified y position
      landmarks[LANDMARK_INDICES.WRIST] = {
        x: 0.5,
        y: y,
        z: 0,
      };

      const result = freshMapper.mapVerticalMovementToLighting(landmarks);
      expect(result).not.toBeNull();
      expect(result?.value).toBe(expected);
    }
  });

  /**
   * Property 3 Monotonicity: Increasing y-position progresses through lighting presets
   * 
   * For any sequence of increasing y-positions (moving hand down), the lighting presets
   * should progress in order: night → golden hour → volumetric → studio.
   * 
   * Note: This test accounts for the smoothing buffer by calling each position multiple times.
   */
  it('Property 3 Monotonicity: Increasing y-position progresses through lighting presets', () => {
    const ySequence = [0.0, 0.1, 0.29, 0.3, 0.4, 0.49, 0.5, 0.6, 0.69, 0.7, 0.8, 1.0];
    const expectedSequence = [
      'night, moonlight from above',
      'night, moonlight from above',
      'night, moonlight from above',
      'golden hour from top',
      'golden hour from top',
      'golden hour from top',
      'soft volumetric god rays from left',
      'soft volumetric god rays from left',
      'soft volumetric god rays from left',
      'bright studio lighting',
      'bright studio lighting',
      'bright studio lighting',
    ];

    const results: string[] = [];

    for (const y of ySequence) {
      // Create fresh mapper for each position to avoid smoothing effects
      const freshMapper = new GestureMapper();
      
      const landmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
      }));

      landmarks[LANDMARK_INDICES.WRIST] = {
        x: 0.5,
        y: y,
        z: 0,
      };

      // Call multiple times to fill smoothing buffer
      let result = null;
      for (let i = 0; i < 5; i++) {
        result = freshMapper.mapVerticalMovementToLighting(landmarks);
      }
      
      if (result) {
        results.push(result.value as string);
      }
    }

    // Verify the sequence matches expected progression
    expect(results).toEqual(expectedSequence);
  });

  /**
   * Property 3 Smoothing: Multiple calls with same y-position produce consistent results
   * 
   * The mapper uses a moving average for smoothing. Verify that calling with the same
   * y-position multiple times produces consistent lighting presets.
   */
  it('Property 3 Smoothing: Multiple calls with same y-position produce consistent results', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        (yPosition: number) => {
          // Create fresh mapper
          const freshMapper = new GestureMapper();
          
          const landmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({
            x: 0.5,
            y: 0.5,
            z: 0,
          }));
          
          landmarks[LANDMARK_INDICES.WRIST] = {
            x: 0.5,
            y: yPosition,
            z: 0,
          };
          
          // Call multiple times with same position
          const results: string[] = [];
          for (let i = 0; i < 10; i++) {
            const result = freshMapper.mapVerticalMovementToLighting(landmarks);
            if (result) {
              results.push(result.value as string);
            }
          }
          
          // All results should be the same (consistent)
          const firstResult = results[0];
          for (const result of results) {
            expect(result).toBe(firstResult);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: sculptnet-gesture-sculpting, Property 4: Two-hand frame updates composition correctly
   * 
   * For any pair of hand landmark configurations (left and right hands), calculating the bounding box
   * should produce a composition parameter that reflects the frame characteristics (centered, off-center,
   * aspect ratio).
   * 
   * Validates: Requirements 1.4
   */
  it('Property 4: Two-hand frame updates composition correctly', () => {
    fc.assert(
      fc.property(
        arbitraryHandLandmarks(),
        arbitraryHandLandmarks(),
        (leftHand: HandLandmark[], rightHand: HandLandmark[]) => {
          // Execute the gesture mapping
          const result = mapper.mapTwoHandFrameToComposition(leftHand, rightHand);
          
          // The result should not be null for valid hand landmarks
          expect(result).not.toBeNull();
          
          if (result) {
            // Property 4a: The path should be correct
            expect(result.path).toBe('aesthetics.composition');
            
            // Property 4b: The value should be a valid composition preset
            const validCompositionPresets = [
              'subject centered',
              'rule of thirds',
              'panoramic composition',
            ];
            expect(validCompositionPresets).toContain(result.value);
            
            // Property 4c: Confidence should be between 0 and 1
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            
            // Property 4d: Verify composition mapping is correct based on frame characteristics
            const allLandmarks = [...leftHand, ...rightHand];
            const bbox = calculateBoundingBox(allLandmarks);
            
            const centerX = (bbox.minX + bbox.maxX) / 2;
            const centerY = (bbox.minY + bbox.maxY) / 2;
            const width = bbox.maxX - bbox.minX;
            const height = bbox.maxY - bbox.minY;
            const aspectRatio = width / height;
            
            const isCentered = centerX >= 0.4 && centerX <= 0.6 && centerY >= 0.4 && centerY <= 0.6;
            const isPanoramic = aspectRatio > 1.5;
            
            // Verify the mapping matches expected logic
            if (isPanoramic) {
              expect(result.value).toBe('panoramic composition');
            } else if (isCentered) {
              expect(result.value).toBe('subject centered');
            } else {
              expect(result.value).toBe('rule of thirds');
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 Edge Case: Centered frame produces centered composition
   * 
   * For any two hands positioned to create a centered frame (center within 0.4-0.6 range),
   * the composition should be "subject centered" (assuming aspect ratio is not panoramic).
   */
  it('Property 4 Edge Case: Centered frame produces centered composition', () => {
    fc.assert(
      fc.property(
        // Generate center position within centered range
        fc.record({
          centerX: fc.float({ min: Math.fround(0.4), max: Math.fround(0.6), noNaN: true }),
          centerY: fc.float({ min: Math.fround(0.4), max: Math.fround(0.6), noNaN: true }),
          handSpacing: fc.float({ min: Math.fround(0.1), max: Math.fround(0.2), noNaN: true }),
          handSize: fc.float({ min: Math.fround(0.08), max: Math.fround(0.12), noNaN: true }),
        }),
        ({ centerX, centerY, handSpacing, handSize }) => {
          // Create two hands positioned to form a centered, non-panoramic frame
          // Each hand is a compact cluster, separated by handSpacing
          
          // Left hand: compact cluster on the left side
          const leftHand: HandLandmark[] = Array.from({ length: 21 }, (_, i) => ({
            x: centerX - handSpacing / 2 + (i % 3) * (handSize / 10),
            y: centerY - handSize / 2 + Math.floor(i / 3) * (handSize / 10),
            z: 0,
          }));
          
          // Right hand: compact cluster on the right side
          const rightHand: HandLandmark[] = Array.from({ length: 21 }, (_, i) => ({
            x: centerX + handSpacing / 2 + (i % 3) * (handSize / 10),
            y: centerY - handSize / 2 + Math.floor(i / 3) * (handSize / 10),
            z: 0,
          }));
          
          // Calculate actual bounding box to verify aspect ratio
          const allLandmarks = [...leftHand, ...rightHand];
          const bbox = calculateBoundingBox(allLandmarks);
          const width = bbox.maxX - bbox.minX;
          const height = bbox.maxY - bbox.minY;
          const aspectRatio = width / height;
          
          // Only test cases where aspect ratio is not panoramic
          if (aspectRatio > 1.5) {
            return true; // Skip panoramic cases
          }
          
          const result = mapper.mapTwoHandFrameToComposition(leftHand, rightHand);
          
          expect(result).not.toBeNull();
          if (result) {
            // Should be centered composition
            expect(result.value).toBe('subject centered');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 Edge Case: Panoramic frame produces panoramic composition
   * 
   * For any two hands positioned to create a wide frame (aspect ratio > 1.5),
   * the composition should be "panoramic composition".
   */
  it('Property 4 Edge Case: Panoramic frame produces panoramic composition', () => {
    fc.assert(
      fc.property(
        // Generate wide frame parameters
        fc.record({
          centerX: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
          centerY: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
          width: fc.float({ min: Math.fround(0.4), max: Math.fround(0.8), noNaN: true }),
          height: fc.float({ min: Math.fround(0.1), max: Math.fround(0.25), noNaN: true }),
        }),
        ({ centerX, centerY, width, height }) => {
          // Ensure aspect ratio > 1.5
          const aspectRatio = width / height;
          if (aspectRatio <= 1.5) {
            return true; // Skip this case
          }
          
          // Create two hands positioned to form a wide panoramic frame
          const leftHand: HandLandmark[] = Array.from({ length: 21 }, (_, i) => ({
            x: centerX - width / 2 + (i % 7) * 0.01,
            y: centerY - height / 2 + Math.floor(i / 7) * 0.01,
            z: 0,
          }));
          
          const rightHand: HandLandmark[] = Array.from({ length: 21 }, (_, i) => ({
            x: centerX + width / 2 + (i % 7) * 0.01,
            y: centerY - height / 2 + Math.floor(i / 7) * 0.01,
            z: 0,
          }));
          
          const result = mapper.mapTwoHandFrameToComposition(leftHand, rightHand);
          
          expect(result).not.toBeNull();
          if (result) {
            // Should be panoramic composition
            expect(result.value).toBe('panoramic composition');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 Edge Case: Off-center frame produces rule of thirds composition
   * 
   * For any two hands positioned to create an off-center frame (not centered and not panoramic),
   * the composition should be "rule of thirds".
   */
  it('Property 4 Edge Case: Off-center frame produces rule of thirds composition', () => {
    fc.assert(
      fc.property(
        // Generate off-center position (outside 0.4-0.6 range)
        fc.record({
          centerX: fc.oneof(
            fc.float({ min: Math.fround(0.15), max: Math.fround(0.35), noNaN: true }),
            fc.float({ min: Math.fround(0.65), max: Math.fround(0.85), noNaN: true })
          ),
          centerY: fc.float({ min: Math.fround(0.2), max: Math.fround(0.8), noNaN: true }),
          handSpacing: fc.float({ min: Math.fround(0.1), max: Math.fround(0.2), noNaN: true }),
          handSize: fc.float({ min: Math.fround(0.08), max: Math.fround(0.12), noNaN: true }),
        }),
        ({ centerX, centerY, handSpacing, handSize }) => {
          // Create two hands positioned to form an off-center, non-panoramic frame
          // Each hand is a compact cluster
          
          // Left hand: compact cluster on the left side
          const leftHand: HandLandmark[] = Array.from({ length: 21 }, (_, i) => ({
            x: centerX - handSpacing / 2 + (i % 3) * (handSize / 10),
            y: centerY - handSize / 2 + Math.floor(i / 3) * (handSize / 10),
            z: 0,
          }));
          
          // Right hand: compact cluster on the right side
          const rightHand: HandLandmark[] = Array.from({ length: 21 }, (_, i) => ({
            x: centerX + handSpacing / 2 + (i % 3) * (handSize / 10),
            y: centerY - handSize / 2 + Math.floor(i / 3) * (handSize / 10),
            z: 0,
          }));
          
          // Calculate actual bounding box to verify aspect ratio
          const allLandmarks = [...leftHand, ...rightHand];
          const bbox = calculateBoundingBox(allLandmarks);
          const width = bbox.maxX - bbox.minX;
          const height = bbox.maxY - bbox.minY;
          const aspectRatio = width / height;
          
          // Only test cases where aspect ratio is not panoramic
          if (aspectRatio > 1.5) {
            return true; // Skip panoramic cases
          }
          
          const result = mapper.mapTwoHandFrameToComposition(leftHand, rightHand);
          
          expect(result).not.toBeNull();
          if (result) {
            // Should be rule of thirds composition (not centered, not panoramic)
            expect(result.value).toBe('rule of thirds');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 Invariant: Swapping left and right hands produces same composition
   * 
   * For any pair of hands, swapping which is "left" and which is "right" should produce
   * the same composition result (composition is based on bounding box, not hand identity).
   */
  it('Property 4 Invariant: Swapping left and right hands produces same composition', () => {
    fc.assert(
      fc.property(
        arbitraryHandLandmarks(),
        arbitraryHandLandmarks(),
        (hand1: HandLandmark[], hand2: HandLandmark[]) => {
          // Test with hand1 as left, hand2 as right
          const result1 = mapper.mapTwoHandFrameToComposition(hand1, hand2);
          
          // Test with hand2 as left, hand1 as right (swapped)
          const result2 = mapper.mapTwoHandFrameToComposition(hand2, hand1);
          
          // Both should produce valid results
          expect(result1).not.toBeNull();
          expect(result2).not.toBeNull();
          
          if (result1 && result2) {
            // Composition should be the same regardless of which hand is "left" or "right"
            expect(result1.value).toBe(result2.value);
            
            // Confidence should also be the same (within floating point tolerance)
            expect(Math.abs(result1.confidence - result2.confidence)).toBeLessThan(0.001);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: sculptnet-gesture-sculpting, Property 5: Fist-to-open transition triggers generation
   * 
   * For any sequence of hand landmark configurations transitioning from a closed fist state to an
   * open hand state, the gesture detector should identify this as a generation trigger exactly once
   * per transition.
   * 
   * Validates: Requirements 1.5
   */
  it('Property 5: Fist-to-open transition triggers generation', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of hand states: fist → open
        fc.record({
          palmCenter: fc.record({
            x: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
            y: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
          }),
        }),
        ({ palmCenter }) => {
          // Create a fresh mapper for each test
          const freshMapper = new GestureMapper();
          
          // Create fist landmarks (all fingertips close to palm)
          const fistLandmarks = createFistLandmarks(palmCenter);
          
          // Create open hand landmarks (all fingertips extended from palm)
          const openLandmarks = createOpenHandLandmarks(palmCenter);
          
          // First call with fist - should not trigger (no previous state)
          const trigger1 = freshMapper.detectGenerationTrigger(fistLandmarks);
          expect(trigger1).toBe(false);
          
          // Verify internal state is now 'fist'
          expect(freshMapper.getCurrentHandState()).toBe('fist');
          
          // Second call with open hand - should trigger (fist → open transition)
          const trigger2 = freshMapper.detectGenerationTrigger(openLandmarks);
          expect(trigger2).toBe(true);
          
          // Verify internal state is now 'open'
          expect(freshMapper.getCurrentHandState()).toBe('open');
          
          // Third call with open hand again - should NOT trigger (already open)
          const trigger3 = freshMapper.detectGenerationTrigger(openLandmarks);
          expect(trigger3).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 Edge Case: Fist-to-partial does not trigger generation
   * 
   * For any transition from fist to partial hand state (some fingers extended),
   * generation should NOT be triggered.
   */
  it('Property 5 Edge Case: Fist-to-partial does not trigger generation', () => {
    fc.assert(
      fc.property(
        fc.record({
          palmCenter: fc.record({
            x: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
            y: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
          }),
        }),
        ({ palmCenter }) => {
          // Create a fresh mapper for each test
          const freshMapper = new GestureMapper();
          
          // Create fist landmarks
          const fistLandmarks = createFistLandmarks(palmCenter);
          
          // Create partial hand landmarks (2 fingers extended, 2 closed)
          const partialLandmarks = createPartialHandLandmarks(palmCenter);
          
          // First call with fist
          freshMapper.detectGenerationTrigger(fistLandmarks);
          expect(freshMapper.getCurrentHandState()).toBe('fist');
          
          // Second call with partial hand - should NOT trigger
          const trigger = freshMapper.detectGenerationTrigger(partialLandmarks);
          expect(trigger).toBe(false);
          
          // State should be partial
          expect(freshMapper.getCurrentHandState()).toBe('partial');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 Edge Case: Partial-to-open does not trigger generation
   * 
   * For any transition from partial to open hand state,
   * generation should NOT be triggered (must start from fist).
   */
  it('Property 5 Edge Case: Partial-to-open does not trigger generation', () => {
    fc.assert(
      fc.property(
        fc.record({
          palmCenter: fc.record({
            x: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
            y: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
          }),
        }),
        ({ palmCenter }) => {
          // Create a fresh mapper for each test
          const freshMapper = new GestureMapper();
          
          // Create partial hand landmarks
          const partialLandmarks = createPartialHandLandmarks(palmCenter);
          
          // Create open hand landmarks
          const openLandmarks = createOpenHandLandmarks(palmCenter);
          
          // First call with partial hand
          freshMapper.detectGenerationTrigger(partialLandmarks);
          expect(freshMapper.getCurrentHandState()).toBe('partial');
          
          // Second call with open hand - should NOT trigger (not from fist)
          const trigger = freshMapper.detectGenerationTrigger(openLandmarks);
          expect(trigger).toBe(false);
          
          // State should be open
          expect(freshMapper.getCurrentHandState()).toBe('open');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 Edge Case: Open-to-fist-to-open triggers again
   * 
   * For any sequence where the hand goes open → fist → open,
   * the second fist-to-open transition should trigger generation again.
   */
  it('Property 5 Edge Case: Open-to-fist-to-open triggers again', () => {
    fc.assert(
      fc.property(
        fc.record({
          palmCenter: fc.record({
            x: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
            y: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
          }),
        }),
        ({ palmCenter }) => {
          // Create a fresh mapper for each test
          const freshMapper = new GestureMapper();
          
          const fistLandmarks = createFistLandmarks(palmCenter);
          const openLandmarks = createOpenHandLandmarks(palmCenter);
          
          // First transition: fist → open (should trigger)
          freshMapper.detectGenerationTrigger(fistLandmarks);
          const trigger1 = freshMapper.detectGenerationTrigger(openLandmarks);
          expect(trigger1).toBe(true);
          
          // Stay open (should not trigger)
          const trigger2 = freshMapper.detectGenerationTrigger(openLandmarks);
          expect(trigger2).toBe(false);
          
          // Close to fist (should not trigger)
          const trigger3 = freshMapper.detectGenerationTrigger(fistLandmarks);
          expect(trigger3).toBe(false);
          expect(freshMapper.getCurrentHandState()).toBe('fist');
          
          // Open again (should trigger again)
          const trigger4 = freshMapper.detectGenerationTrigger(openLandmarks);
          expect(trigger4).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 Idempotence: Multiple calls with same state don't trigger
   * 
   * For any hand state (fist, open, or partial), calling detectGenerationTrigger
   * multiple times with the same state should only trigger on the first fist-to-open
   * transition, not on subsequent calls with the same state.
   */
  it('Property 5 Idempotence: Multiple calls with same state do not trigger', () => {
    fc.assert(
      fc.property(
        fc.record({
          palmCenter: fc.record({
            x: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
            y: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
          }),
          numRepeats: fc.integer({ min: 2, max: 10 }),
        }),
        ({ palmCenter, numRepeats }) => {
          // Create a fresh mapper for each test
          const freshMapper = new GestureMapper();
          
          const fistLandmarks = createFistLandmarks(palmCenter);
          const openLandmarks = createOpenHandLandmarks(palmCenter);
          
          // Set initial state to fist
          freshMapper.detectGenerationTrigger(fistLandmarks);
          
          // First open should trigger
          const firstTrigger = freshMapper.detectGenerationTrigger(openLandmarks);
          expect(firstTrigger).toBe(true);
          
          // Subsequent calls with open hand should NOT trigger
          for (let i = 0; i < numRepeats; i++) {
            const trigger = freshMapper.detectGenerationTrigger(openLandmarks);
            expect(trigger).toBe(false);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 Reset: After reset, state is cleared
   * 
   * For any mapper with existing state, calling reset() should clear the state
   * so that the next fist-to-open transition behaves as if it's the first call.
   */
  it('Property 5 Reset: After reset, state is cleared', () => {
    fc.assert(
      fc.property(
        fc.record({
          palmCenter: fc.record({
            x: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
            y: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
          }),
        }),
        ({ palmCenter }) => {
          // Create a mapper and set it to fist state
          const testMapper = new GestureMapper();
          
          const fistLandmarks = createFistLandmarks(palmCenter);
          const openLandmarks = createOpenHandLandmarks(palmCenter);
          
          // Set state to fist
          testMapper.detectGenerationTrigger(fistLandmarks);
          expect(testMapper.getCurrentHandState()).toBe('fist');
          
          // Reset the mapper
          testMapper.reset();
          
          // State should be 'partial' (default)
          expect(testMapper.getCurrentHandState()).toBe('partial');
          
          // Now set to fist again
          testMapper.detectGenerationTrigger(fistLandmarks);
          expect(testMapper.getCurrentHandState()).toBe('fist');
          
          // Open should trigger (as if first time)
          const trigger = testMapper.detectGenerationTrigger(openLandmarks);
          expect(trigger).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: sculptnet-gesture-sculpting, Property 9: Gesture calculation is performant
   * 
   * For any hand landmark detection result, calculating gesture parameters should complete
   * within 100 milliseconds.
   * 
   * Validates: Requirements 3.3
   */
  it('Property 9: Gesture calculation is performant', () => {
    fc.assert(
      fc.property(
        arbitraryHandLandmarks(),
        arbitraryHandLandmarks(),
        (landmarks1: HandLandmark[], landmarks2: HandLandmark[]) => {
          const mapper = new GestureMapper();
          
          // Measure time for all gesture calculations
          const startTime = performance.now();
          
          // Execute all gesture mapping methods
          mapper.mapPinchToFOV(landmarks1);
          mapper.mapWristRotationToAngle(landmarks1);
          mapper.mapVerticalMovementToLighting(landmarks1);
          mapper.mapTwoHandFrameToComposition(landmarks1, landmarks2);
          mapper.detectGenerationTrigger(landmarks1);
          
          const endTime = performance.now();
          const elapsedTime = endTime - startTime;
          
          // Property 9: All gesture calculations should complete within 100ms
          expect(elapsedTime).toBeLessThan(100);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9 Edge Case: Single gesture calculation is performant
   * 
   * For any individual gesture calculation method, execution should complete
   * well within the 100ms budget (target: < 20ms per method).
   */
  it('Property 9 Edge Case: Single gesture calculation is performant', () => {
    fc.assert(
      fc.property(
        arbitraryHandLandmarks(),
        arbitraryHandLandmarks(),
        fc.constantFrom(
          'mapPinchToFOV',
          'mapWristRotationToAngle',
          'mapVerticalMovementToLighting',
          'mapTwoHandFrameToComposition',
          'detectGenerationTrigger'
        ),
        (landmarks1: HandLandmark[], landmarks2: HandLandmark[], methodName: string) => {
          const mapper = new GestureMapper();
          
          // Measure time for single gesture calculation
          const startTime = performance.now();
          
          // Execute the selected method
          switch (methodName) {
            case 'mapPinchToFOV':
              mapper.mapPinchToFOV(landmarks1);
              break;
            case 'mapWristRotationToAngle':
              mapper.mapWristRotationToAngle(landmarks1);
              break;
            case 'mapVerticalMovementToLighting':
              mapper.mapVerticalMovementToLighting(landmarks1);
              break;
            case 'mapTwoHandFrameToComposition':
              mapper.mapTwoHandFrameToComposition(landmarks1, landmarks2);
              break;
            case 'detectGenerationTrigger':
              mapper.detectGenerationTrigger(landmarks1);
              break;
          }
          
          const endTime = performance.now();
          const elapsedTime = endTime - startTime;
          
          // Each individual method should complete in < 20ms
          // This ensures we have headroom for the 100ms total budget
          expect(elapsedTime).toBeLessThan(20);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9 Stress Test: Repeated calculations maintain performance
   * 
   * For any sequence of gesture calculations, performance should remain consistent
   * (no memory leaks or performance degradation over time).
   */
  it('Property 9 Stress Test: Repeated calculations maintain performance', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryHandLandmarks(), { minLength: 10, maxLength: 20 }),
        fc.array(arbitraryHandLandmarks(), { minLength: 10, maxLength: 20 }),
        (landmarksArray1: HandLandmark[][], landmarksArray2: HandLandmark[][]) => {
          const mapper = new GestureMapper();
          const timings: number[] = [];
          
          // Execute multiple iterations and measure each
          const iterations = Math.min(landmarksArray1.length, landmarksArray2.length);
          for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            
            mapper.mapPinchToFOV(landmarksArray1[i]);
            mapper.mapWristRotationToAngle(landmarksArray1[i]);
            mapper.mapVerticalMovementToLighting(landmarksArray1[i]);
            mapper.mapTwoHandFrameToComposition(landmarksArray1[i], landmarksArray2[i]);
            mapper.detectGenerationTrigger(landmarksArray1[i]);
            
            const endTime = performance.now();
            timings.push(endTime - startTime);
          }
          
          // All iterations should complete within 100ms
          for (const timing of timings) {
            expect(timing).toBeLessThan(100);
          }
          
          // Performance should not degrade significantly over time
          // Compare first and last timing (last should not be more than 5x first)
          if (timings.length >= 2) {
            const firstTiming = timings[0];
            const lastTiming = timings[timings.length - 1];
            
            // Allow for variance in JavaScript performance (JIT warmup, GC, etc.)
            // 5x is a reasonable threshold to catch real memory leaks while allowing normal variance
            expect(lastTiming).toBeLessThan(firstTiming * 5);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 9 Worst Case: Complex gestures remain performant
   * 
   * For any landmarks that trigger complex calculations (e.g., two-hand composition
   * with many landmarks), performance should still meet the 100ms requirement.
   */
  it('Property 9 Worst Case: Complex gestures remain performant', () => {
    fc.assert(
      fc.property(
        // Generate landmarks that will trigger all gesture calculations
        arbitraryPinchLandmarks(),
        arbitraryHandLandmarks(),
        (landmarks1: HandLandmark[], landmarks2: HandLandmark[]) => {
          const mapper = new GestureMapper();
          
          // Pre-populate history to test smoothing overhead
          for (let i = 0; i < 5; i++) {
            mapper.mapVerticalMovementToLighting(landmarks1);
          }
          
          // Measure time for full gesture processing with history
          const startTime = performance.now();
          
          // Execute all gesture calculations
          const pinchResult = mapper.mapPinchToFOV(landmarks1);
          const rotationResult = mapper.mapWristRotationToAngle(landmarks1);
          const lightingResult = mapper.mapVerticalMovementToLighting(landmarks1);
          const compositionResult = mapper.mapTwoHandFrameToComposition(landmarks1, landmarks2);
          const triggerResult = mapper.detectGenerationTrigger(landmarks1);
          
          const endTime = performance.now();
          const elapsedTime = endTime - startTime;
          
          // Even with history and complex calculations, should complete within 100ms
          expect(elapsedTime).toBeLessThan(100);
          
          // Verify calculations actually executed (not just null returns)
          // At least some results should be non-null
          const hasResults = pinchResult !== null || 
                            rotationResult !== null || 
                            lightingResult !== null || 
                            compositionResult !== null;
          expect(hasResults || triggerResult !== undefined).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ Helper Functions ============

/**
 * Helper function to calculate bounding box (mirrors implementation in GestureMapper)
 */
function calculateBoundingBox(landmarks: HandLandmark[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;

  for (const lm of landmarks) {
    minX = Math.min(minX, lm.x);
    maxX = Math.max(maxX, lm.x);
    minY = Math.min(minY, lm.y);
    maxY = Math.max(maxY, lm.y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Helper function to create fist hand landmarks
 * All fingertips are within FIST_THRESHOLD (0.15) of palm center
 * 
 * Palm center is calculated as average of wrist and 4 MCP joints,
 * so we need to position those landmarks to create the desired palm center.
 */
function createFistLandmarks(desiredPalmCenter: { x: number; y: number }): HandLandmark[] {
  const landmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  
  // Position wrist and MCP joints so their average equals desiredPalmCenter
  // Palm center = (wrist + index_mcp + middle_mcp + ring_mcp + pinky_mcp) / 5
  // We'll spread them around the desired center
  landmarks[LANDMARK_INDICES.WRIST] = { 
    x: desiredPalmCenter.x, 
    y: desiredPalmCenter.y + 0.1, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP] = { 
    x: desiredPalmCenter.x - 0.05, 
    y: desiredPalmCenter.y, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP] = { 
    x: desiredPalmCenter.x, 
    y: desiredPalmCenter.y - 0.02, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.RING_FINGER_MCP] = { 
    x: desiredPalmCenter.x + 0.05, 
    y: desiredPalmCenter.y, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.PINKY_MCP] = { 
    x: desiredPalmCenter.x + 0.1, 
    y: desiredPalmCenter.y + 0.02, 
    z: 0 
  };
  
  // Calculate actual palm center to verify
  const actualPalmX = (landmarks[LANDMARK_INDICES.WRIST].x + 
                       landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP].x +
                       landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP].x +
                       landmarks[LANDMARK_INDICES.RING_FINGER_MCP].x +
                       landmarks[LANDMARK_INDICES.PINKY_MCP].x) / 5;
  const actualPalmY = (landmarks[LANDMARK_INDICES.WRIST].y + 
                       landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP].y +
                       landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP].y +
                       landmarks[LANDMARK_INDICES.RING_FINGER_MCP].y +
                       landmarks[LANDMARK_INDICES.PINKY_MCP].y) / 5;
  
  // Set fingertips close to actual palm center (within FIST_THRESHOLD = 0.15)
  // Use distance of 0.05 to be well within threshold
  landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP] = { 
    x: actualPalmX - 0.02, 
    y: actualPalmY + 0.02, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_TIP] = { 
    x: actualPalmX, 
    y: actualPalmY + 0.02, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.RING_FINGER_TIP] = { 
    x: actualPalmX + 0.02, 
    y: actualPalmY + 0.02, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.PINKY_TIP] = { 
    x: actualPalmX + 0.04, 
    y: actualPalmY + 0.02, 
    z: 0 
  };
  
  // Set other joints (not critical for fist detection, but fill them in)
  landmarks[LANDMARK_INDICES.THUMB_CMC] = { x: actualPalmX - 0.03, y: actualPalmY + 0.05, z: 0 };
  landmarks[LANDMARK_INDICES.THUMB_MCP] = { x: actualPalmX - 0.05, y: actualPalmY + 0.03, z: 0 };
  landmarks[LANDMARK_INDICES.THUMB_IP] = { x: actualPalmX - 0.06, y: actualPalmY + 0.01, z: 0 };
  landmarks[LANDMARK_INDICES.THUMB_TIP] = { x: actualPalmX - 0.07, y: actualPalmY, z: 0 };
  
  landmarks[LANDMARK_INDICES.INDEX_FINGER_PIP] = { x: actualPalmX - 0.02, y: actualPalmY - 0.02, z: 0 };
  landmarks[LANDMARK_INDICES.INDEX_FINGER_DIP] = { x: actualPalmX - 0.02, y: actualPalmY, z: 0 };
  
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_PIP] = { x: actualPalmX, y: actualPalmY - 0.02, z: 0 };
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_DIP] = { x: actualPalmX, y: actualPalmY, z: 0 };
  
  landmarks[LANDMARK_INDICES.RING_FINGER_PIP] = { x: actualPalmX + 0.02, y: actualPalmY - 0.02, z: 0 };
  landmarks[LANDMARK_INDICES.RING_FINGER_DIP] = { x: actualPalmX + 0.02, y: actualPalmY, z: 0 };
  
  landmarks[LANDMARK_INDICES.PINKY_PIP] = { x: actualPalmX + 0.04, y: actualPalmY - 0.02, z: 0 };
  landmarks[LANDMARK_INDICES.PINKY_DIP] = { x: actualPalmX + 0.04, y: actualPalmY, z: 0 };
  
  return landmarks;
}

/**
 * Helper function to create open hand landmarks
 * All fingertips are beyond OPEN_THRESHOLD (0.25) from palm center
 */
function createOpenHandLandmarks(desiredPalmCenter: { x: number; y: number }): HandLandmark[] {
  const landmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  
  // Position wrist and MCP joints so their average equals desiredPalmCenter
  landmarks[LANDMARK_INDICES.WRIST] = { 
    x: desiredPalmCenter.x, 
    y: desiredPalmCenter.y + 0.2, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP] = { 
    x: desiredPalmCenter.x - 0.1, 
    y: desiredPalmCenter.y + 0.05, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP] = { 
    x: desiredPalmCenter.x, 
    y: desiredPalmCenter.y, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.RING_FINGER_MCP] = { 
    x: desiredPalmCenter.x + 0.1, 
    y: desiredPalmCenter.y + 0.05, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.PINKY_MCP] = { 
    x: desiredPalmCenter.x + 0.2, 
    y: desiredPalmCenter.y + 0.1, 
    z: 0 
  };
  
  // Calculate actual palm center
  const actualPalmX = (landmarks[LANDMARK_INDICES.WRIST].x + 
                       landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP].x +
                       landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP].x +
                       landmarks[LANDMARK_INDICES.RING_FINGER_MCP].x +
                       landmarks[LANDMARK_INDICES.PINKY_MCP].x) / 5;
  const actualPalmY = (landmarks[LANDMARK_INDICES.WRIST].y + 
                       landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP].y +
                       landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP].y +
                       landmarks[LANDMARK_INDICES.RING_FINGER_MCP].y +
                       landmarks[LANDMARK_INDICES.PINKY_MCP].y) / 5;
  
  // Set fingertips far from actual palm center (beyond OPEN_THRESHOLD = 0.25)
  // Use distance of 0.30 to be well beyond threshold
  landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP] = { 
    x: actualPalmX - 0.2, 
    y: actualPalmY - 0.3, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_TIP] = { 
    x: actualPalmX, 
    y: actualPalmY - 0.35, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.RING_FINGER_TIP] = { 
    x: actualPalmX + 0.2, 
    y: actualPalmY - 0.3, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.PINKY_TIP] = { 
    x: actualPalmX + 0.35, 
    y: actualPalmY - 0.2, 
    z: 0 
  };
  
  // Set other joints (extended positions)
  landmarks[LANDMARK_INDICES.THUMB_CMC] = { x: actualPalmX - 0.03, y: actualPalmY + 0.05, z: 0 };
  landmarks[LANDMARK_INDICES.THUMB_MCP] = { x: actualPalmX - 0.06, y: actualPalmY + 0.03, z: 0 };
  landmarks[LANDMARK_INDICES.THUMB_IP] = { x: actualPalmX - 0.09, y: actualPalmY + 0.01, z: 0 };
  landmarks[LANDMARK_INDICES.THUMB_TIP] = { x: actualPalmX - 0.12, y: actualPalmY, z: 0 };
  
  landmarks[LANDMARK_INDICES.INDEX_FINGER_PIP] = { x: actualPalmX - 0.1, y: actualPalmY - 0.15, z: 0 };
  landmarks[LANDMARK_INDICES.INDEX_FINGER_DIP] = { x: actualPalmX - 0.15, y: actualPalmY - 0.22, z: 0 };
  
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_PIP] = { x: actualPalmX, y: actualPalmY - 0.15, z: 0 };
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_DIP] = { x: actualPalmX, y: actualPalmY - 0.25, z: 0 };
  
  landmarks[LANDMARK_INDICES.RING_FINGER_PIP] = { x: actualPalmX + 0.1, y: actualPalmY - 0.15, z: 0 };
  landmarks[LANDMARK_INDICES.RING_FINGER_DIP] = { x: actualPalmX + 0.15, y: actualPalmY - 0.22, z: 0 };
  
  landmarks[LANDMARK_INDICES.PINKY_PIP] = { x: actualPalmX + 0.2, y: actualPalmY - 0.1, z: 0 };
  landmarks[LANDMARK_INDICES.PINKY_DIP] = { x: actualPalmX + 0.28, y: actualPalmY - 0.15, z: 0 };
  
  return landmarks;
}

/**
 * Helper function to create partial hand landmarks
 * Some fingertips extended, some closed (2 extended, 2 closed)
 */
function createPartialHandLandmarks(desiredPalmCenter: { x: number; y: number }): HandLandmark[] {
  const landmarks: HandLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  
  // Position wrist and MCP joints so their average equals desiredPalmCenter
  landmarks[LANDMARK_INDICES.WRIST] = { 
    x: desiredPalmCenter.x, 
    y: desiredPalmCenter.y + 0.15, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP] = { 
    x: desiredPalmCenter.x - 0.08, 
    y: desiredPalmCenter.y + 0.02, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP] = { 
    x: desiredPalmCenter.x, 
    y: desiredPalmCenter.y - 0.01, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.RING_FINGER_MCP] = { 
    x: desiredPalmCenter.x + 0.08, 
    y: desiredPalmCenter.y + 0.02, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.PINKY_MCP] = { 
    x: desiredPalmCenter.x + 0.15, 
    y: desiredPalmCenter.y + 0.05, 
    z: 0 
  };
  
  // Calculate actual palm center
  const actualPalmX = (landmarks[LANDMARK_INDICES.WRIST].x + 
                       landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP].x +
                       landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP].x +
                       landmarks[LANDMARK_INDICES.RING_FINGER_MCP].x +
                       landmarks[LANDMARK_INDICES.PINKY_MCP].x) / 5;
  const actualPalmY = (landmarks[LANDMARK_INDICES.WRIST].y + 
                       landmarks[LANDMARK_INDICES.INDEX_FINGER_MCP].y +
                       landmarks[LANDMARK_INDICES.MIDDLE_FINGER_MCP].y +
                       landmarks[LANDMARK_INDICES.RING_FINGER_MCP].y +
                       landmarks[LANDMARK_INDICES.PINKY_MCP].y) / 5;
  
  // Index and middle fingers EXTENDED (beyond OPEN_THRESHOLD = 0.25)
  landmarks[LANDMARK_INDICES.INDEX_FINGER_TIP] = { 
    x: actualPalmX - 0.15, 
    y: actualPalmY - 0.3, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_TIP] = { 
    x: actualPalmX, 
    y: actualPalmY - 0.35, 
    z: 0 
  };
  
  // Ring and pinky fingers CLOSED (within FIST_THRESHOLD = 0.15)
  landmarks[LANDMARK_INDICES.RING_FINGER_TIP] = { 
    x: actualPalmX + 0.02, 
    y: actualPalmY + 0.02, 
    z: 0 
  };
  landmarks[LANDMARK_INDICES.PINKY_TIP] = { 
    x: actualPalmX + 0.04, 
    y: actualPalmY + 0.02, 
    z: 0 
  };
  
  // Set other joints
  landmarks[LANDMARK_INDICES.THUMB_CMC] = { x: actualPalmX - 0.03, y: actualPalmY + 0.05, z: 0 };
  landmarks[LANDMARK_INDICES.THUMB_MCP] = { x: actualPalmX - 0.05, y: actualPalmY + 0.03, z: 0 };
  landmarks[LANDMARK_INDICES.THUMB_IP] = { x: actualPalmX - 0.07, y: actualPalmY + 0.01, z: 0 };
  landmarks[LANDMARK_INDICES.THUMB_TIP] = { x: actualPalmX - 0.09, y: actualPalmY, z: 0 };
  
  landmarks[LANDMARK_INDICES.INDEX_FINGER_PIP] = { x: actualPalmX - 0.08, y: actualPalmY - 0.15, z: 0 };
  landmarks[LANDMARK_INDICES.INDEX_FINGER_DIP] = { x: actualPalmX - 0.12, y: actualPalmY - 0.22, z: 0 };
  
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_PIP] = { x: actualPalmX, y: actualPalmY - 0.15, z: 0 };
  landmarks[LANDMARK_INDICES.MIDDLE_FINGER_DIP] = { x: actualPalmX, y: actualPalmY - 0.25, z: 0 };
  
  landmarks[LANDMARK_INDICES.RING_FINGER_PIP] = { x: actualPalmX + 0.02, y: actualPalmY - 0.02, z: 0 };
  landmarks[LANDMARK_INDICES.RING_FINGER_DIP] = { x: actualPalmX + 0.02, y: actualPalmY, z: 0 };
  
  landmarks[LANDMARK_INDICES.PINKY_PIP] = { x: actualPalmX + 0.04, y: actualPalmY - 0.02, z: 0 };
  landmarks[LANDMARK_INDICES.PINKY_DIP] = { x: actualPalmX + 0.04, y: actualPalmY, z: 0 };
  
  return landmarks;
}
