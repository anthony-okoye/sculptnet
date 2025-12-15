/**
 * Property-Based Tests for BriaClient Error Handling
 * 
 * Feature: sculptnet-gesture-sculpting
 * Property 13: API errors are handled gracefully
 * 
 * **Validates: Requirements 4.4**
 * 
 * Tests verify that BriaClient handles various API error scenarios correctly:
 * - 401 Unauthorized errors
 * - 500 Server errors
 * - Network timeouts
 * - Invalid responses
 * - Malformed JSON
 * - Generation failures during polling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { BriaClient, BriaAPIError } from '@/lib/bria-client';
import type { FIBOStructuredPrompt } from '@/types/fibo';

// ============ Test Setup ============

// Store original fetch
const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset fetch to original before each test
  global.fetch = originalFetch;
});

afterEach(() => {
  // Restore original fetch after each test
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ============ Custom Arbitraries ============

/**
 * Generate arbitrary HTTP error status codes
 */
const arbitraryErrorStatus = fc.oneof(
  fc.constant(400), // Bad Request
  fc.constant(401), // Unauthorized
  fc.constant(403), // Forbidden
  fc.constant(404), // Not Found
  fc.constant(500), // Internal Server Error
  fc.constant(502), // Bad Gateway
  fc.constant(503), // Service Unavailable
);

/**
 * Generate arbitrary error codes
 */
const arbitraryErrorCode = fc.oneof(
  fc.constant('INVALID_API_KEY'),
  fc.constant('INVALID_PROMPT'),
  fc.constant('SERVER_ERROR'),
  fc.constant('RATE_LIMIT'),
  fc.constant('TIMEOUT'),
  fc.constant('NETWORK_ERROR'),
);

/**
 * Generate arbitrary error messages
 */
const arbitraryErrorMessage = fc.oneof(
  fc.constant('Invalid API key'),
  fc.constant('Prompt validation failed'),
  fc.constant('Internal server error'),
  fc.constant('Rate limit exceeded'),
  fc.constant('Request timeout'),
  fc.constant('Network connection failed'),
);

/**
 * Generate arbitrary API error responses
 */
const arbitraryErrorResponse = fc.record({
  error: arbitraryErrorMessage,
  code: arbitraryErrorCode,
  details: fc.option(fc.object(), { nil: undefined }),
});

/**
 * Generate arbitrary text prompts (non-empty, non-whitespace)
 */
const arbitraryTextPrompt = fc.string({ minLength: 5, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generate arbitrary structured prompts
 */
const arbitraryStructuredPrompt: fc.Arbitrary<FIBOStructuredPrompt> = fc.record({
  short_description: fc.string({ minLength: 5, maxLength: 100 }),
  background_setting: fc.string({ minLength: 5, maxLength: 100 }),
  lighting: fc.record({
    conditions: fc.constant('natural daylight'),
    direction: fc.constant('overhead'),
    shadows: fc.constant('soft shadows'),
  }),
  aesthetics: fc.record({
    composition: fc.constant('rule of thirds'),
    color_scheme: fc.constant('warm colors'),
    mood_atmosphere: fc.constant('calm'),
  }),
  photographic_characteristics: fc.record({
    depth_of_field: fc.constant('shallow'),
    focus: fc.constant('subject'),
    camera_angle: fc.constant('eye level'),
    lens_focal_length: fc.constant('50mm'),
  }),
  style_medium: fc.constant('photography'),
  artistic_style: fc.constant('realistic'),
});

// ============ Property Tests ============

describe('BriaClient Error Handling - Property Tests', () => {
  // Feature: sculptnet-gesture-sculpting, Property 13.1: 401 errors throw BriaAPIError with UNAUTHORIZED code
  it('Property 13.1: 401 Unauthorized errors are handled correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(arbitraryTextPrompt, arbitraryStructuredPrompt),
        arbitraryErrorResponse,
        async (prompt, errorBody) => {
          // Mock fetch to return 401 immediately (no retries for non-429 errors)
          const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => errorBody,
          });
          global.fetch = mockFetch as unknown as typeof fetch;

          const client = new BriaClient();

          // Attempt generation should throw - only call once
          const error = await client.generate(prompt).catch(e => e);
          expect(error).toBeInstanceOf(BriaAPIError);
          expect(error.status).toBe(401);
          
          // Should only call fetch once (no retries for 401)
          expect(mockFetch).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 10 } // Reduced from 100 for faster tests
    );
  }, 10000);

  // Feature: sculptnet-gesture-sculpting, Property 13.2: 500 Server errors are handled correctly
  it('Property 13.2: 500 Server errors are handled correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(arbitraryTextPrompt, arbitraryStructuredPrompt),
        arbitraryErrorResponse,
        async (prompt, errorBody) => {
          // Mock fetch to return 500 immediately
          const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: vi.fn().mockResolvedValue(errorBody),
          });
          global.fetch = mockFetch as unknown as typeof fetch;

          const client = new BriaClient();

          // Attempt generation should throw
          const error = await client.generate(prompt).catch(e => e);
          expect(error).toBeInstanceOf(BriaAPIError);
          expect(error.status).toBe(500);
          
          // Should only call fetch once (no retries for 500)
          expect(mockFetch).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 10 } // Reduced for faster tests
    );
  }, 10000);

  // Feature: sculptnet-gesture-sculpting, Property 13.3: Various HTTP error codes are handled correctly
  it('Property 13.3: Various HTTP error codes are handled correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(arbitraryTextPrompt, arbitraryStructuredPrompt),
        arbitraryErrorStatus,
        arbitraryErrorResponse,
        async (prompt, status, errorBody) => {
          // Mock fetch to return error status immediately
          const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status,
            json: vi.fn().mockResolvedValue(errorBody),
          });
          global.fetch = mockFetch as unknown as typeof fetch;

          const client = new BriaClient();

          // Attempt generation should throw
          const error = await client.generate(prompt).catch(e => e);
          expect(error).toBeInstanceOf(BriaAPIError);
          expect(error.status).toBe(status);
          expect(error.code).toBeTruthy();
          
          // Should only call fetch once (no retries for non-429 errors)
          expect(mockFetch).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 10 } // Reduced for faster tests
    );
  }, 10000);

  // Feature: sculptnet-gesture-sculpting, Property 13.4: Network errors are handled gracefully
  it('Property 13.4: Network errors are handled gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(arbitraryTextPrompt, arbitraryStructuredPrompt),
        async (prompt) => {
          // Mock fetch to throw network error immediately
          const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
          global.fetch = mockFetch as unknown as typeof fetch;

          const client = new BriaClient();

          // Attempt generation should throw
          const error = await client.generate(prompt).catch(e => e);
          expect(error).toBeInstanceOf(Error);
          // Should be wrapped in BriaAPIError
          expect(error).toBeInstanceOf(BriaAPIError);
          expect((error as BriaAPIError).code).toBeTruthy();
        }
      ),
      { numRuns: 10 } // Reduced for faster tests
    );
  }, 10000);

  // Feature: sculptnet-gesture-sculpting, Property 13.5: Malformed JSON responses are handled
  it('Property 13.5: Malformed JSON responses are handled correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(arbitraryTextPrompt, arbitraryStructuredPrompt),
        async (prompt) => {
          // Mock fetch to return invalid JSON
          global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => {
              throw new Error('Invalid JSON');
            },
          });

          const client = new BriaClient();

          // Attempt generation
          await expect(client.generate(prompt)).rejects.toThrow(BriaAPIError);
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 13.6: Generation errors during polling are handled
  it('Property 13.6: Generation errors during polling are handled correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(arbitraryTextPrompt, arbitraryStructuredPrompt),
        arbitraryErrorMessage,
        async (prompt, errorMessage) => {
          // Mock initial generate call (async mode)
          const mockGenerateResponse = {
            request_id: 'test-request-id',
            status_url: 'https://api.bria.ai/status/test',
          };

          // Mock status call returning ERROR
          const mockStatusResponse = {
            status: 'ERROR',
            error: {
              message: errorMessage,
            },
          };

          let callCount = 0;
          global.fetch = vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              // First call: generate
              return {
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue(mockGenerateResponse),
              };
            } else {
              // Subsequent calls: status
              return {
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue(mockStatusResponse),
              };
            }
          }) as unknown as typeof fetch;

          const client = new BriaClient();

          // Attempt generation
          await expect(client.generate(prompt)).rejects.toThrow(BriaAPIError);
          
          try {
            await client.generate(prompt);
          } catch (error) {
            expect(error).toBeInstanceOf(BriaAPIError);
            expect((error as BriaAPIError).code).toBe('GENERATION_FAILED');
            expect((error as BriaAPIError).message).toContain(errorMessage);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 13.7: Client status reflects error state after failures
  it('Property 13.7: Client status reflects error state after failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(arbitraryTextPrompt, arbitraryStructuredPrompt),
        arbitraryErrorStatus,
        async (prompt, status) => {
          // Mock fetch to return error
          global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status,
            json: async () => ({ error: 'Test error', code: 'TEST_ERROR' }),
          });

          const client = new BriaClient();

          // Initial status should be idle
          expect(client.getStatus()).toBe('idle');

          // Attempt generation
          try {
            await client.generate(prompt);
          } catch {
            // Expected to throw
          }

          // Status should be error after failure
          expect(client.getStatus()).toBe('error');
        }
      ),
      { numRuns: 100 }
    );
  });
});
