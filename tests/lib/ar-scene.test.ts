/**
 * AR Scene Manager Tests
 * 
 * Tests for the useARScene hook and AR scene utilities.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateImagePosition,
  DEFAULT_POSITION,
  HORIZONTAL_OFFSET,
  MAX_IMAGES,
  type SceneEntity,
  type Position3D,
} from '../../src/hooks/use-ar-scene';

describe('AR Scene Manager', () => {
  describe('calculateImagePosition', () => {
    it('should return default position for first image', () => {
      const position = calculateImagePosition([]);
      
      expect(position).toEqual(DEFAULT_POSITION);
      expect(position.x).toBe(0);
      expect(position.y).toBe(1.6);
      expect(position.z).toBe(-2);
    });

    it('should offset second image to the right', () => {
      const existingEntities: SceneEntity[] = [
        createMockEntity('img-1', { x: 0, y: 1.6, z: -2 }),
      ];
      
      const position = calculateImagePosition(existingEntities);
      
      expect(position.x).toBe(HORIZONTAL_OFFSET); // +0.5
      expect(position.y).toBe(DEFAULT_POSITION.y);
      expect(position.z).toBe(DEFAULT_POSITION.z);
    });

    it('should offset third image to the left', () => {
      const existingEntities: SceneEntity[] = [
        createMockEntity('img-1', { x: 0, y: 1.6, z: -2 }),
        createMockEntity('img-2', { x: 0.5, y: 1.6, z: -2 }),
      ];
      
      const position = calculateImagePosition(existingEntities);
      
      expect(position.x).toBe(-HORIZONTAL_OFFSET); // -0.5
      expect(position.y).toBe(DEFAULT_POSITION.y);
      expect(position.z).toBe(DEFAULT_POSITION.z);
    });

    it('should continue alternating pattern for subsequent images', () => {
      const existingEntities: SceneEntity[] = [
        createMockEntity('img-1', { x: 0, y: 1.6, z: -2 }),
        createMockEntity('img-2', { x: 0.5, y: 1.6, z: -2 }),
        createMockEntity('img-3', { x: -0.5, y: 1.6, z: -2 }),
      ];
      
      const position = calculateImagePosition(existingEntities);
      
      // 4th image should be at +1.0 (2 * HORIZONTAL_OFFSET)
      expect(position.x).toBe(2 * HORIZONTAL_OFFSET);
      expect(position.y).toBe(DEFAULT_POSITION.y);
      expect(position.z).toBe(DEFAULT_POSITION.z);
    });

    it('should use custom position when provided', () => {
      const customPosition: Partial<Position3D> = { x: 1, y: 2, z: -3 };
      const existingEntities: SceneEntity[] = [
        createMockEntity('img-1', { x: 0, y: 1.6, z: -2 }),
      ];
      
      const position = calculateImagePosition(existingEntities, customPosition);
      
      expect(position.x).toBe(1);
      expect(position.y).toBe(2);
      expect(position.z).toBe(-3);
    });

    it('should merge partial custom position with defaults', () => {
      const customPosition: Partial<Position3D> = { x: 5 };
      
      const position = calculateImagePosition([], customPosition);
      
      expect(position.x).toBe(5);
      expect(position.y).toBe(DEFAULT_POSITION.y);
      expect(position.z).toBe(DEFAULT_POSITION.z);
    });
  });

  describe('Constants', () => {
    it('should have MAX_IMAGES set to 5', () => {
      expect(MAX_IMAGES).toBe(5);
    });

    it('should have correct default position', () => {
      expect(DEFAULT_POSITION.x).toBe(0);
      expect(DEFAULT_POSITION.y).toBe(1.6);
      expect(DEFAULT_POSITION.z).toBe(-2);
    });

    it('should have HORIZONTAL_OFFSET set to 0.5', () => {
      expect(HORIZONTAL_OFFSET).toBe(0.5);
    });
  });

  describe('Position calculation pattern', () => {
    it('should generate correct positions for up to MAX_IMAGES', () => {
      const expectedXPositions = [
        0,      // 1st: center
        0.5,    // 2nd: right
        -0.5,   // 3rd: left
        1.0,    // 4th: far right
        -1.0,   // 5th: far left
      ];

      let entities: SceneEntity[] = [];
      
      for (let i = 0; i < MAX_IMAGES; i++) {
        const position = calculateImagePosition(entities);
        expect(position.x).toBeCloseTo(expectedXPositions[i], 5);
        expect(position.y).toBe(DEFAULT_POSITION.y);
        expect(position.z).toBe(DEFAULT_POSITION.z);
        
        // Add entity for next iteration
        entities.push(createMockEntity(`img-${i}`, position));
      }
    });
  });
});

// ============ Helper Functions ============

/**
 * Create a mock SceneEntity for testing
 */
function createMockEntity(id: string, position: Position3D): SceneEntity {
  return {
    id,
    imageUrl: `https://example.com/${id}.png`,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1.5, y: 1.5, z: 1 },
    timestamp: Date.now(),
  };
}
