/**
 * Property-based tests for BriaClient
 * 
 * Tests universal properties that should hold across all valid executions
 * of the Bria API client.
 * 
 * Feature: sculptnet-gesture-sculpting
 * Requirements: 4.1, 4.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { BriaClient, type GenerationOptions } from '@/lib/bria-client';
import type { FIBOStructuredPrompt } from '@/types/fibo';

// ============ Mock Setup ============

// Store original fetch
const originalFetch = global.fetch;

// Mock API responses
interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

// ============ Custom Generators ============

/**
 * Generate a valid text prompt
 */
const arbitraryTextPrompt = (): fc.Arbitrary<string> => {
  return fc.string({ minLength: 5, maxLength: 200 });
};

/**
 * Generate a valid FIBO structured prompt
 */
const arbitraryStructuredPrompt = (): fc.Arbitrary<FIBOStructuredPrompt> => {
  return fc.record({
    short_description: fc.string({ minLength: 10, maxLength: 100 }),
    background_setting: fc.string({ minLength: 10, maxLength: 100 }),
    lighting: fc.record({
      conditions: fc.constantFrom(
        'soft, diffused studio lighting',
        'bright sunlight',
        'night, moonlight from above',
        'golden hour from top'
      ),
      direction: fc.constantFrom(
        'overhead and slightly front-lit',
        'from the left',
        'from above'
      ),
      shadows: fc.constantFrom(
        'soft shadows',
        'hard shadows',
        'no shadows'
      ),
    }),
    aesthetics: fc.record({
      composition: fc.constantFrom(
        'subject centered',
        'rule of thirds',
        'panoramic composition'
      ),
      color_scheme: fc.string({ minLength: 10, maxLength: 50 }),
      mood_atmosphere: fc.string({ minLength: 10, maxLength: 50 }),
    }),
    photographic_characteristics: fc.record({
      depth_of_field: fc.constantFrom(
        'shallow, with subject in sharp focus',
        'deep focus',
        'bokeh background'
      ),
      focus: fc.constantFrom('sharp focus on subject', 'soft focus'),
      camera_angle: fc.constantFrom(
        'eye level',
        'low dutch tilt',
        'high angle',
        "bird's eye view"
      ),
      lens_focal_length: fc.constantFrom(
        '24mm ultra-wide',
        '35mm wide',
        '50mm standard',
        '85mm portrait',
        '200mm telephoto'
      ),
    }),
    style_medium: fc.constantFrom('photograph', 'digital art', 'oil painting'),
  });
};

/**
 * Generate valid generation options
 */
const arbitraryGenerationOptions = (): fc.Arbitrary<GenerationOptions> => {
  return fc.record({
    steps_num: fc.option(fc.integer({ min: 35, max: 50 }), { nil: undefined }),
    guidance_scale: fc.option(fc.integer({ min: 3, max: 5 }), { nil: undefined }),
    aspect_ratio: fc.option(
      fc.constantFrom('1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'),
      { nil: undefined }
    ),
    seed: fc.option(fc.integer({ min: 0, max: 2147483647 }), { nil: undefined }),
    sync: fc.option(fc.boolean(), { nil: undefined }),
  });
};

/**
 * Generate a valid API key
 */
const arbitraryApiKey = (): fc.Arbitrary<string> => {
  return fc.hexaString({ minLength: 32, maxLength: 64 });
};

// ============ Helper Functions ============

/**
 * Create a mock fetch function that captures requests
 */
function createMockFetch(
  capturedRequests: Array<{ url: string; options: RequestInit }>
): typeof fetch {
  return vi.fn(async (url: string | URL, options?: RequestInit) => {
    // Capture the request
    capturedRequests.push({
      url: url.toString(),
      options: options || {},
    });

    // Return a mock successful response
    const mockResponse: MockFetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        request_id: 'test-request-id',
        status_url: 'https://api.bria.ai/status/test',
        result: {
          image_url: 'https://example.com/image.png',
          structured_prompt: JSON.stringify({
            short_description: 'test',
            background_setting: 'test',
            lighting: { conditions: 'test', direction: 'test', shadows: 'test' },
            aesthetics: { composition: 'test', color_scheme: 'test', mood_atmosphere: 'test' },
            photographic_characteristics: {
              depth_of_field: 'test',
              focus: 'test',
              camera_angle: 'test',
              lens_focal_length: 'test',
            },
            style_medium: 'test',
          }),
          seed: 12345,
        },
      }),
    };

    return mockResponse as unknown as Response;
  }) as typeof fetch;
}

// ============ Property Tests ============

describe('BriaClient Property-Based Tests', () => {
  let client: BriaClient;
  let capturedRequests: Array<{ url: string; options: RequestInit }>;

  beforeEach(() => {
    client = new BriaClient();
    capturedRequests = [];
    
    // Mock fetch to capture requests
    global.fetch = createMockFetch(capturedRequests);
    
    // Mock getStoredApiKey to return a test key
    vi.mock('@/components/settings-dialog', () => ({
      getStoredApiKey: () => 'test-api-key-12345',
    }));
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  /**
   * Feature: sculptnet-gesture-sculpting, Property 11: API calls include correct authentication and prompt
   * 
   * For any structured prompt and generation trigger, the resulting API request should include
   * a Bearer token in the Authorization header and the prompt in the request body.
   * 
   * Validates: Requirements 4.1, 4.2
   */
  it('Property 11: API calls include correct authentication and prompt (text prompt)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt(),
        arbitraryGenerationOptions(),
        async (prompt: string, options: GenerationOptions) => {
          // Clear captured requests
          capturedRequests.length = 0;

          // Make the API call
          try {
            await client.generate(prompt, { ...options, sync: true });
          } catch (error) {
            // Ignore errors for this test - we're only checking the request format
          }

          // Property 11a: At least one request should have been made
          expect(capturedRequests.length).toBeGreaterThan(0);

          // Find the generate request (not status polling)
          const generateRequest = capturedRequests.find((req) =>
            req.url.includes('/api/generate')
          );

          expect(generateRequest).toBeDefined();

          if (generateRequest) {
            // Property 11b: Request should include authentication header
            const headers = generateRequest.options.headers as Record<string, string>;
            expect(headers).toBeDefined();
            
            // Check for either x-bria-api-key (client-side) or api_token (server-side)
            const hasAuth =
              headers['x-bria-api-key'] !== undefined ||
              headers['api_token'] !== undefined ||
              headers['Authorization'] !== undefined;
            
            expect(hasAuth).toBe(true);

            // Property 11c: Request body should include the prompt
            const body = generateRequest.options.body;
            expect(body).toBeDefined();

            if (body) {
              const parsedBody = JSON.parse(body as string);
              
              // Should have either prompt or structured_prompt
              const hasPrompt = parsedBody.prompt !== undefined;
              expect(hasPrompt).toBe(true);
              
              // If text prompt, should match the input
              if (hasPrompt) {
                expect(parsedBody.prompt).toBe(prompt);
              }
            }

            // Property 11d: Request should include generation options
            if (body) {
              const parsedBody = JSON.parse(body as string);
              
              // Should have default or specified values
              expect(parsedBody.guidance_scale).toBeDefined();
              expect(parsedBody.aspect_ratio).toBeDefined();
              expect(parsedBody.steps_num).toBeDefined();
              
              // If options were specified, they should be included
              if (options.guidance_scale !== undefined) {
                expect(parsedBody.guidance_scale).toBe(options.guidance_scale);
              }
              if (options.aspect_ratio !== undefined) {
                expect(parsedBody.aspect_ratio).toBe(options.aspect_ratio);
              }
              if (options.steps_num !== undefined) {
                expect(parsedBody.steps_num).toBe(options.steps_num);
              }
              if (options.seed !== undefined) {
                expect(parsedBody.seed).toBe(options.seed);
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: sculptnet-gesture-sculpting, Property 11: API calls include correct authentication and prompt
   * 
   * For any structured prompt and generation trigger, the resulting API request should include
   * a Bearer token in the Authorization header and the prompt in the request body.
   * 
   * Validates: Requirements 4.1, 4.2
   */
  it('Property 11: API calls include correct authentication and prompt (structured prompt)', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryStructuredPrompt(),
        arbitraryGenerationOptions(),
        async (prompt: FIBOStructuredPrompt, options: GenerationOptions) => {
          // Clear captured requests
          capturedRequests.length = 0;

          // Make the API call
          try {
            await client.generate(prompt, { ...options, sync: true });
          } catch (error) {
            // Ignore errors for this test - we're only checking the request format
          }

          // Property 11a: At least one request should have been made
          expect(capturedRequests.length).toBeGreaterThan(0);

          // Find the generate request (not status polling)
          const generateRequest = capturedRequests.find((req) =>
            req.url.includes('/api/generate')
          );

          expect(generateRequest).toBeDefined();

          if (generateRequest) {
            // Property 11b: Request should include authentication header
            const headers = generateRequest.options.headers as Record<string, string>;
            expect(headers).toBeDefined();
            
            // Check for either x-bria-api-key (client-side) or api_token (server-side)
            const hasAuth =
              headers['x-bria-api-key'] !== undefined ||
              headers['api_token'] !== undefined ||
              headers['Authorization'] !== undefined;
            
            expect(hasAuth).toBe(true);

            // Property 11c: Request body should include the structured prompt
            const body = generateRequest.options.body;
            expect(body).toBeDefined();

            if (body) {
              const parsedBody = JSON.parse(body as string);
              
              // Should have structured_prompt
              const hasStructuredPrompt = parsedBody.structured_prompt !== undefined;
              expect(hasStructuredPrompt).toBe(true);
              
              // If structured prompt, should be valid JSON string
              if (hasStructuredPrompt) {
                const parsedPrompt = JSON.parse(parsedBody.structured_prompt);
                
                // Verify it has the required FIBO fields
                expect(parsedPrompt).toHaveProperty('short_description');
                expect(parsedPrompt).toHaveProperty('background_setting');
                expect(parsedPrompt).toHaveProperty('lighting');
                expect(parsedPrompt).toHaveProperty('aesthetics');
                expect(parsedPrompt).toHaveProperty('photographic_characteristics');
                expect(parsedPrompt).toHaveProperty('style_medium');
              }
            }

            // Property 11d: Request should include generation options
            if (body) {
              const parsedBody = JSON.parse(body as string);
              
              // Should have default or specified values
              expect(parsedBody.guidance_scale).toBeDefined();
              expect(parsedBody.aspect_ratio).toBeDefined();
              expect(parsedBody.steps_num).toBeDefined();
              
              // If options were specified, they should be included
              if (options.guidance_scale !== undefined) {
                expect(parsedBody.guidance_scale).toBe(options.guidance_scale);
              }
              if (options.aspect_ratio !== undefined) {
                expect(parsedBody.aspect_ratio).toBe(options.aspect_ratio);
              }
              if (options.steps_num !== undefined) {
                expect(parsedBody.steps_num).toBe(options.steps_num);
              }
              if (options.seed !== undefined) {
                expect(parsedBody.seed).toBe(options.seed);
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11 Edge Case: API key is always included in requests
   * 
   * For any API call, the authentication header should always be present,
   * either from client-side override or server-side environment variable.
   */
  it('Property 11 Edge Case: API key is always included in requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(arbitraryTextPrompt(), arbitraryStructuredPrompt()),
        async (prompt: string | FIBOStructuredPrompt) => {
          // Clear captured requests
          capturedRequests.length = 0;

          // Make the API call
          try {
            await client.generate(prompt, { sync: true });
          } catch (error) {
            // Ignore errors
          }

          // Find the generate request
          const generateRequest = capturedRequests.find((req) =>
            req.url.includes('/api/generate')
          );

          if (generateRequest) {
            const headers = generateRequest.options.headers as Record<string, string>;
            
            // At least one authentication method should be present
            const hasAuth =
              headers['x-bria-api-key'] !== undefined ||
              headers['api_token'] !== undefined ||
              headers['Authorization'] !== undefined;
            
            expect(hasAuth).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11 Edge Case: Content-Type header is always application/json
   * 
   * For any API call, the Content-Type header should always be application/json.
   */
  it('Property 11 Edge Case: Content-Type header is always application/json', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(arbitraryTextPrompt(), arbitraryStructuredPrompt()),
        async (prompt: string | FIBOStructuredPrompt) => {
          // Clear captured requests
          capturedRequests.length = 0;

          // Make the API call
          try {
            await client.generate(prompt, { sync: true });
          } catch (error) {
            // Ignore errors
          }

          // Find the generate request
          const generateRequest = capturedRequests.find((req) =>
            req.url.includes('/api/generate')
          );

          if (generateRequest) {
            const headers = generateRequest.options.headers as Record<string, string>;
            expect(headers['Content-Type']).toBe('application/json');
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11 Consistency: Multiple calls with same prompt produce same request structure
   * 
   * For any prompt, making multiple API calls should produce requests with the same structure.
   */
  it('Property 11 Consistency: Multiple calls with same prompt produce same request structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryTextPrompt(),
        async (prompt: string) => {
          // Clear captured requests
          capturedRequests.length = 0;

          // Make multiple calls with the same prompt
          for (let i = 0; i < 3; i++) {
            try {
              await client.generate(prompt, { sync: true });
            } catch (error) {
              // Ignore errors
            }
          }

          // Get all generate requests
          const generateRequests = capturedRequests.filter((req) =>
            req.url.includes('/api/generate')
          );

          // Should have made 3 requests
          expect(generateRequests.length).toBe(3);

          // All requests should have the same structure
          const firstBody = JSON.parse(generateRequests[0].options.body as string);
          
          for (let i = 1; i < generateRequests.length; i++) {
            const body = JSON.parse(generateRequests[i].options.body as string);
            
            // Same prompt
            expect(body.prompt).toBe(firstBody.prompt);
            
            // Same options (defaults)
            expect(body.guidance_scale).toBe(firstBody.guidance_scale);
            expect(body.aspect_ratio).toBe(firstBody.aspect_ratio);
            expect(body.steps_num).toBe(firstBody.steps_num);
          }

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ============ Helper Function ============

/**
 * Helper to calculate bounding box (used in other tests)
 */
function calculateBoundingBox(landmarks: Array<{ x: number; y: number; z: number }>) {
  const xs = landmarks.map((l) => l.x);
  const ys = landmarks.map((l) => l.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
