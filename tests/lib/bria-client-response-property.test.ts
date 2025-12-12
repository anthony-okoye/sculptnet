/**
 * Property-Based Tests for Bria API Response Extraction
 * 
 * Feature: sculptnet-gesture-sculpting, Property 12: Successful API responses are extracted correctly
 * **Validates: Requirements 4.3**
 * 
 * These tests verify that the BriaClient correctly extracts data from API responses:
 * - Image URLs are extracted from both sync and async responses
 * - Structured prompts are parsed correctly
 * - Seeds and request IDs are preserved
 * - Timestamps are generated
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { BriaClient, type GenerationResult, type GenerationOptions } from '@/lib/bria-client';
import type { FIBOStructuredPrompt } from '@/types/fibo';

// ============ Test Utilities ============

/**
 * Mock fetch globally
 */
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Create a mock FIBO structured prompt
 */
function createMockStructuredPrompt(): FIBOStructuredPrompt {
  return {
    style_medium: 'digital art',
    artistic_style: 'photorealistic',
    lighting: {
      conditions: 'natural daylight',
      elevation: 45,
    },
    composition: {
      rule: 'rule of thirds',
      subject_position: 'center',
    },
    camera: {
      fov: 50,
      angle: 0,
    },
    color_palette: 'vibrant',
    depth_of_field: 'medium',
  };
}

// ============ Arbitraries ============

/**
 * Generate arbitrary image URLs
 */
const arbitraryImageUrl = fc.webUrl({ validSchemes: ['https'] })
  .map(url => url.includes('.png') ? url : `${url}/image.png`);

/**
 * Generate arbitrary request IDs
 */
const arbitraryRequestId = fc.uuid();

/**
 * Generate arbitrary seeds
 */
const arbitrarySeed = fc.integer({ min: 0, max: 2147483647 });

/**
 * Generate arbitrary structured prompts as JSON strings
 */
const arbitraryStructuredPromptJson = fc.constant(JSON.stringify(createMockStructuredPrompt()));

/**
 * Generate arbitrary sync API responses
 */
const arbitrarySyncResponse = fc.record({
  request_id: arbitraryRequestId,
  result: fc.record({
    image_url: arbitraryImageUrl,
    seed: arbitrarySeed,
    structured_prompt: fc.option(arbitraryStructuredPromptJson, { nil: undefined }),
  }),
});

/**
 * Generate arbitrary async API responses (initial)
 */
const arbitraryAsyncResponse = fc.record({
  request_id: arbitraryRequestId,
  status_url: fc.webUrl({ validSchemes: ['https'] }),
});

/**
 * Generate arbitrary status responses (completed)
 */
const arbitraryCompletedStatusResponse = fc.record({
  status: fc.constant('COMPLETED' as const),
  result: fc.record({
    image_url: arbitraryImageUrl,
    seed: arbitrarySeed,
    structured_prompt: fc.option(arbitraryStructuredPromptJson, { nil: undefined }),
  }),
});

/**
 * Generate arbitrary text prompts
 */
const arbitraryTextPrompt = fc.string({ minLength: 5, maxLength: 100 });

/**
 * Generate arbitrary generation options with sync mode
 */
const arbitrarySyncOptions: fc.Arbitrary<GenerationOptions> = fc.record({
  sync: fc.constant(true),
  steps_num: fc.option(fc.integer({ min: 35, max: 50 }), { nil: undefined }),
  guidance_scale: fc.option(fc.integer({ min: 3, max: 5 }), { nil: undefined }),
  seed: fc.option(arbitrarySeed, { nil: undefined }),
});

// ============ Property Tests ============

describe('BriaClient Response Extraction Property Tests', () => {
  let client: BriaClient;

  beforeEach(() => {
    client = new BriaClient();
    mockFetch.mockClear();
  });

  afterEach(() => {
    client.cancel();
  });

  // Feature: sculptnet-gesture-sculpting, Property 12: Successful API responses are extracted correctly
  it('Property 12.1: Sync responses extract all fields correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitrarySyncResponse,
        arbitrarySyncOptions,
        async (prompt, apiResponse, options) => {
          // Setup mock
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => apiResponse,
          });

          // Execute
          const result = await client.generate(prompt, options);

          // Verify all fields are extracted correctly
          expect(result.imageUrl).toBe(apiResponse.result.image_url);
          expect(result.seed).toBe(apiResponse.result.seed);
          expect(result.requestId).toBe(apiResponse.request_id);
          expect(result.timestamp).toBeGreaterThan(0);
          expect(result.timestamp).toBeLessThanOrEqual(Date.now());

          // Verify prompt is preserved or parsed
          if (apiResponse.result.structured_prompt) {
            expect(result.prompt).toEqual(JSON.parse(apiResponse.result.structured_prompt));
          } else {
            expect(result.prompt).toBe(prompt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 12: Successful API responses are extracted correctly
  it('Property 12.2: Async responses extract all fields correctly after polling', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitraryAsyncResponse,
        arbitraryCompletedStatusResponse,
        async (prompt, initialResponse, statusResponse) => {
          // Setup mocks - initial request returns async response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => initialResponse,
          });

          // Status polling returns completed response
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => statusResponse,
          });

          // Execute
          const result = await client.generate(prompt, { sync: false });

          // Verify all fields are extracted correctly
          expect(result.imageUrl).toBe(statusResponse.result.image_url);
          expect(result.seed).toBe(statusResponse.result.seed);
          expect(result.requestId).toBe(initialResponse.request_id);
          expect(result.timestamp).toBeGreaterThan(0);
          expect(result.timestamp).toBeLessThanOrEqual(Date.now());

          // Verify prompt is preserved or parsed
          if (statusResponse.result.structured_prompt) {
            expect(result.prompt).toEqual(JSON.parse(statusResponse.result.structured_prompt));
          } else {
            expect(result.prompt).toBe(prompt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 12: Successful API responses are extracted correctly
  it('Property 12.3: Structured prompts are correctly parsed from JSON strings', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitrarySyncResponse,
        async (prompt, apiResponse) => {
          // Ensure response has structured prompt
          const responseWithPrompt = {
            ...apiResponse,
            result: {
              ...apiResponse.result,
              structured_prompt: JSON.stringify(createMockStructuredPrompt()),
            },
          };

          // Setup mock
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => responseWithPrompt,
          });

          // Execute
          const result = await client.generate(prompt, { sync: true });

          // Verify structured prompt is parsed correctly
          expect(result.prompt).toEqual(createMockStructuredPrompt());
          expect(typeof result.prompt).toBe('object');
          expect(result.prompt).toHaveProperty('style_medium');
          expect(result.prompt).toHaveProperty('artistic_style');
          expect(result.prompt).toHaveProperty('lighting');
          expect(result.prompt).toHaveProperty('camera');
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 12: Successful API responses are extracted correctly
  it('Property 12.4: Image URLs are always valid strings', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitrarySyncResponse,
        async (prompt, apiResponse) => {
          // Setup mock
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => apiResponse,
          });

          // Execute
          const result = await client.generate(prompt, { sync: true });

          // Verify image URL is valid
          expect(typeof result.imageUrl).toBe('string');
          expect(result.imageUrl.length).toBeGreaterThan(0);
          expect(result.imageUrl).toBe(apiResponse.result.image_url);
          
          // Should be a valid URL format
          expect(() => new URL(result.imageUrl)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 12: Successful API responses are extracted correctly
  it('Property 12.5: Seeds are always non-negative integers', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitrarySyncResponse,
        async (prompt, apiResponse) => {
          // Setup mock
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => apiResponse,
          });

          // Execute
          const result = await client.generate(prompt, { sync: true });

          // Verify seed is valid
          expect(typeof result.seed).toBe('number');
          expect(result.seed).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(result.seed)).toBe(true);
          expect(result.seed).toBe(apiResponse.result.seed);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 12: Successful API responses are extracted correctly
  it('Property 12.6: Request IDs are always preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitrarySyncResponse,
        async (prompt, apiResponse) => {
          // Setup mock
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => apiResponse,
          });

          // Execute
          const result = await client.generate(prompt, { sync: true });

          // Verify request ID is preserved
          expect(typeof result.requestId).toBe('string');
          expect(result.requestId.length).toBeGreaterThan(0);
          expect(result.requestId).toBe(apiResponse.request_id);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 12: Successful API responses are extracted correctly
  it('Property 12.7: Timestamps are always recent and valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitrarySyncResponse,
        async (prompt, apiResponse) => {
          // Setup mock
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => apiResponse,
          });

          const beforeTime = Date.now();
          
          // Execute
          const result = await client.generate(prompt, { sync: true });
          
          const afterTime = Date.now();

          // Verify timestamp is recent and valid
          expect(typeof result.timestamp).toBe('number');
          expect(result.timestamp).toBeGreaterThanOrEqual(beforeTime);
          expect(result.timestamp).toBeLessThanOrEqual(afterTime);
          expect(Number.isInteger(result.timestamp)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
