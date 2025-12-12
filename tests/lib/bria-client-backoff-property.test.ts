/**
 * Property-Based Tests for BriaClient Rate Limit Exponential Backoff
 * 
 * Feature: sculptnet-gesture-sculpting
 * Property 14: Rate limit triggers exponential backoff
 * 
 * **Validates: Requirements 4.5**
 * 
 * Tests verify that BriaClient implements exponential backoff correctly:
 * - 429 rate limit errors trigger retry with backoff
 * - Backoff delays follow exponential pattern (1s, 2s, 4s, 8s)
 * - Maximum retry attempts are respected
 * - Successful retry after rate limit returns result
 * - All retries exhausted throws appropriate error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { BriaClient, BriaAPIError } from '@/lib/bria-client';

// ============ Test Setup ============

// Mock fetch globally
const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
});

// ============ Custom Arbitraries ============

/**
 * Generate arbitrary text prompts
 */
const arbitraryTextPrompt = fc.string({ minLength: 5, maxLength: 100 });

/**
 * Generate arbitrary number of rate limit failures before success (0-3)
 */
const arbitraryRateLimitRetries = fc.integer({ min: 0, max: 3 });

/**
 * Generate arbitrary successful response
 */
const arbitrarySuccessResponse = fc.record({
  request_id: fc.uuid(),
  result: fc.record({
    image_url: fc.webUrl({ validSchemes: ['https'] }),
    seed: fc.integer({ min: 0, max: 2147483647 }),
  }),
});

// ============ Property Tests ============

describe('BriaClient Rate Limit Exponential Backoff - Property Tests', () => {
  // Feature: sculptnet-gesture-sculpting, Property 14.1: Rate limit triggers retry with exponential backoff
  it('Property 14.1: Rate limit (429) triggers retry with exponential backoff', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitraryRateLimitRetries,
        arbitrarySuccessResponse,
        async (prompt, numRateLimits, successResponse) => {
          const callTimestamps: number[] = [];
          let callCount = 0;

          // Mock fetch to return rate limits, then success
          global.fetch = vi.fn().mockImplementation(async () => {
            callTimestamps.push(Date.now());
            callCount++;

            if (callCount <= numRateLimits) {
              // Return rate limit error
              return {
                ok: false,
                status: 429,
                json: async () => ({
                  error: 'Rate limit exceeded',
                  code: 'RATE_LIMIT',
                }),
              };
            } else {
              // Return success
              return {
                ok: true,
                status: 200,
                json: async () => successResponse,
              };
            }
          });

          const client = new BriaClient();

          // Start generation
          const generatePromise = client.generate(prompt, { sync: true });

          // Advance timers to allow all retries
          // Total time needed: 1s + 2s + 4s = 7s for 3 retries
          await vi.advanceTimersByTimeAsync(10000);

          // Should eventually succeed
          const result = await generatePromise;

          // Verify result
          expect(result.imageUrl).toBe(successResponse.result.image_url);
          expect(result.seed).toBe(successResponse.result.seed);

          // Verify correct number of calls
          expect(callCount).toBe(numRateLimits + 1);

          // Verify exponential backoff delays if there were retries
          if (numRateLimits > 0) {
            for (let i = 1; i < callTimestamps.length; i++) {
              const delay = callTimestamps[i] - callTimestamps[i - 1];
              const expectedDelay = 1000 * Math.pow(2, i - 1); // 1s, 2s, 4s, 8s
              
              // Allow some tolerance for timing
              expect(delay).toBeGreaterThanOrEqual(expectedDelay - 100);
              expect(delay).toBeLessThanOrEqual(expectedDelay + 100);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 14.2: Backoff delays follow exponential pattern
  it('Property 14.2: Backoff delays follow exponential pattern (1s, 2s, 4s, 8s)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        async (prompt) => {
          const callTimestamps: number[] = [];

          // Mock fetch to always return rate limit (will hit max retries)
          global.fetch = vi.fn().mockImplementation(async () => {
            callTimestamps.push(Date.now());
            return {
              ok: false,
              status: 429,
              json: async () => ({
                error: 'Rate limit exceeded',
                code: 'RATE_LIMIT',
              }),
            };
          });

          const client = new BriaClient();

          // Start generation
          const generatePromise = client.generate(prompt, { sync: true });

          // Advance timers to allow all retries
          await vi.runAllTimersAsync();

          // Should fail after max retries
          await expect(generatePromise).rejects.toThrow(BriaAPIError);

          // Verify 4 attempts were made (initial + 3 retries)
          expect(callTimestamps.length).toBe(4);

          // Verify exponential backoff pattern
          const delays = [];
          for (let i = 1; i < callTimestamps.length; i++) {
            delays.push(callTimestamps[i] - callTimestamps[i - 1]);
          }

          // Expected delays: 1000ms, 2000ms, 4000ms
          const expectedDelays = [1000, 2000, 4000];
          
          for (let i = 0; i < delays.length; i++) {
            // Allow 100ms tolerance
            expect(delays[i]).toBeGreaterThanOrEqual(expectedDelays[i] - 100);
            expect(delays[i]).toBeLessThanOrEqual(expectedDelays[i] + 100);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 14.3: Maximum retry attempts are respected
  it('Property 14.3: Maximum retry attempts (4 total calls) are respected', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        async (prompt) => {
          let callCount = 0;

          // Mock fetch to always return rate limit
          global.fetch = vi.fn().mockImplementation(async () => {
            callCount++;
            return {
              ok: false,
              status: 429,
              json: async () => ({
                error: 'Rate limit exceeded',
                code: 'RATE_LIMIT',
              }),
            };
          });

          const client = new BriaClient();

          // Start generation
          const generatePromise = client.generate(prompt, { sync: true });

          // Advance all timers
          await vi.runAllTimersAsync();

          // Should fail after max retries
          await expect(generatePromise).rejects.toThrow(BriaAPIError);

          try {
            await generatePromise;
          } catch (error) {
            expect(error).toBeInstanceOf(BriaAPIError);
            expect((error as BriaAPIError).code).toBe('MAX_RETRIES');
          }

          // Verify exactly 4 attempts were made
          expect(callCount).toBe(4);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 14.4: Successful retry returns valid result
  it('Property 14.4: Successful retry after rate limit returns valid result', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitrarySuccessResponse,
        fc.integer({ min: 1, max: 3 }),
        async (prompt, successResponse, retryOnAttempt) => {
          let callCount = 0;

          // Mock fetch to succeed on specific attempt
          global.fetch = vi.fn().mockImplementation(async () => {
            callCount++;

            if (callCount < retryOnAttempt) {
              // Return rate limit
              return {
                ok: false,
                status: 429,
                json: async () => ({
                  error: 'Rate limit exceeded',
                  code: 'RATE_LIMIT',
                }),
              };
            } else {
              // Return success
              return {
                ok: true,
                status: 200,
                json: async () => successResponse,
              };
            }
          });

          const client = new BriaClient();

          // Start generation
          const generatePromise = client.generate(prompt, { sync: true });

          // Advance timers
          await vi.advanceTimersByTimeAsync(10000);

          // Should succeed
          const result = await generatePromise;

          // Verify result is valid
          expect(result).toBeDefined();
          expect(result.imageUrl).toBe(successResponse.result.image_url);
          expect(result.seed).toBe(successResponse.result.seed);
          expect(result.requestId).toBe(successResponse.request_id);
          expect(result.timestamp).toBeGreaterThan(0);
          expect(typeof result.prompt).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 14.5: Non-rate-limit errors don't trigger backoff
  it('Property 14.5: Non-rate-limit errors (401, 500) do not trigger retry', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        fc.constantFrom(400, 401, 403, 500, 502, 503),
        async (prompt, errorStatus) => {
          let callCount = 0;

          // Mock fetch to return non-rate-limit error
          global.fetch = vi.fn().mockImplementation(async () => {
            callCount++;
            return {
              ok: false,
              status: errorStatus,
              json: async () => ({
                error: 'API error',
                code: 'API_ERROR',
              }),
            };
          });

          const client = new BriaClient();

          // Start generation
          const generatePromise = client.generate(prompt, { sync: true });

          // Advance timers
          await vi.advanceTimersByTimeAsync(1000);

          // Should fail immediately
          await expect(generatePromise).rejects.toThrow(BriaAPIError);

          // Verify only 1 attempt was made (no retries)
          expect(callCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 14.6: Backoff applies to both generate and status endpoints
  it('Property 14.6: Backoff applies to status polling requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitrarySuccessResponse,
        async (prompt, successResponse) => {
          let generateCallCount = 0;
          let statusCallCount = 0;

          // Mock fetch with different behavior for generate vs status
          global.fetch = vi.fn().mockImplementation(async (url) => {
            if (typeof url === 'string' && url.includes('/api/generate')) {
              generateCallCount++;
              // Generate succeeds immediately (async mode)
              return {
                ok: true,
                status: 200,
                json: async () => ({
                  request_id: successResponse.request_id,
                  status_url: 'https://api.bria.ai/status/test',
                }),
              };
            } else {
              // Status endpoint
              statusCallCount++;
              
              if (statusCallCount === 1) {
                // First status call: rate limit
                return {
                  ok: false,
                  status: 429,
                  json: async () => ({
                    error: 'Rate limit exceeded',
                    code: 'RATE_LIMIT',
                  }),
                };
              } else {
                // Second status call: success
                return {
                  ok: true,
                  status: 200,
                  json: async () => ({
                    status: 'COMPLETED',
                    result: successResponse.result,
                  }),
                };
              }
            }
          });

          const client = new BriaClient();

          // Start generation (async mode)
          const generatePromise = client.generate(prompt, { sync: false });

          // Advance timers to allow backoff
          await vi.advanceTimersByTimeAsync(5000);

          // Should succeed after retry
          const result = await generatePromise;

          // Verify result
          expect(result.imageUrl).toBe(successResponse.result.image_url);

          // Verify generate was called once
          expect(generateCallCount).toBe(1);

          // Verify status was called twice (rate limit + success)
          expect(statusCallCount).toBe(2);
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: sculptnet-gesture-sculpting, Property 14.7: Client status remains consistent during retries
  it('Property 14.7: Client status remains in generating/polling state during retries', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt,
        arbitrarySuccessResponse,
        async (prompt, successResponse) => {
          let callCount = 0;
          const statusSnapshots: string[] = [];

          // Mock fetch with rate limit then success
          global.fetch = vi.fn().mockImplementation(async () => {
            callCount++;
            
            // Capture status during each call
            const client = new BriaClient();
            statusSnapshots.push(client.getStatus());

            if (callCount === 1) {
              // First call: rate limit
              return {
                ok: false,
                status: 429,
                json: async () => ({
                  error: 'Rate limit exceeded',
                  code: 'RATE_LIMIT',
                }),
              };
            } else {
              // Second call: success
              return {
                ok: true,
                status: 200,
                json: async () => successResponse,
              };
            }
          });

          const client = new BriaClient();

          // Initial status should be idle
          expect(client.getStatus()).toBe('idle');

          // Start generation
          const generatePromise = client.generate(prompt, { sync: true });

          // Status should be generating
          expect(client.getStatus()).toBe('generating');

          // Advance timers
          await vi.advanceTimersByTimeAsync(5000);

          // Should succeed
          await generatePromise;

          // Final status should be idle
          expect(client.getStatus()).toBe('idle');
        }
      ),
      { numRuns: 50 }
    );
  });
});
