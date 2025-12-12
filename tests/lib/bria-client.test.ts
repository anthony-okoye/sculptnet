/**
 * Tests for Bria API Client
 * 
 * Tests the client-side Bria API client functionality including:
 * - Generation flow
 * - Error handling
 * - Exponential backoff
 * - Status polling
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BriaClient,
  BriaAPIError,
  GenerationTimeoutError,
  createBriaClient,
  getBriaClient,
  type GenerationOptions,
  type GenerationResult,
} from '@/lib/bria-client';
import { DEFAULT_FIBO_PROMPT } from '@/types/fibo';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BriaClient', () => {
  let client: BriaClient;

  beforeEach(() => {
    client = createBriaClient();
    mockFetch.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getStatus', () => {
    it('should return idle initially', () => {
      expect(client.getStatus()).toBe('idle');
    });
  });

  describe('cancel', () => {
    it('should reset status to idle', () => {
      client.cancel();
      expect(client.getStatus()).toBe('idle');
    });
  });

  describe('generate', () => {
    it('should send text prompt to API', async () => {
      // Mock successful async response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-123',
          status_url: 'https://engine.prod.bria-api.com/v2/status/req-123',
        }),
      });

      // Mock completed status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'COMPLETED',
          result: {
            image_url: 'https://example.com/image.png',
            seed: 12345,
          },
        }),
      });

      const result = await client.generate('a beautiful sunset');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Check generate call
      const generateCall = mockFetch.mock.calls[0];
      expect(generateCall[0]).toBe('/api/generate');
      const body = JSON.parse(generateCall[1].body);
      expect(body.prompt).toBe('a beautiful sunset');
      expect(body.guidance_scale).toBe(5);
      expect(body.aspect_ratio).toBe('1:1');
      expect(body.steps_num).toBe(50);
      expect(body.sync).toBe(false);

      expect(result.imageUrl).toBe('https://example.com/image.png');
      expect(result.seed).toBe(12345);
      expect(result.requestId).toBe('req-123');
    });

    it('should send structured prompt as JSON string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-456',
          status_url: 'https://engine.prod.bria-api.com/v2/status/req-456',
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'COMPLETED',
          result: {
            image_url: 'https://example.com/image2.png',
            seed: 67890,
          },
        }),
      });

      await client.generate(DEFAULT_FIBO_PROMPT);

      const generateCall = mockFetch.mock.calls[0];
      const body = JSON.parse(generateCall[1].body);
      expect(body.structured_prompt).toBe(JSON.stringify(DEFAULT_FIBO_PROMPT));
      expect(body.prompt).toBeUndefined();
    });

    it('should use custom generation options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-789',
          status_url: 'https://engine.prod.bria-api.com/v2/status/req-789',
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'COMPLETED',
          result: {
            image_url: 'https://example.com/image3.png',
            seed: 42,
          },
        }),
      });

      const options: GenerationOptions = {
        steps_num: 40,
        guidance_scale: 4,
        aspect_ratio: '16:9',
        seed: 42,
      };

      await client.generate('test prompt', options);

      const generateCall = mockFetch.mock.calls[0];
      const body = JSON.parse(generateCall[1].body);
      expect(body.steps_num).toBe(40);
      expect(body.guidance_scale).toBe(4);
      expect(body.aspect_ratio).toBe('16:9');
      expect(body.seed).toBe(42);
    });

    it('should handle sync mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-sync',
          result: {
            image_url: 'https://example.com/sync-image.png',
            seed: 11111,
          },
        }),
      });

      const result = await client.generate('sync test', { sync: true });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.imageUrl).toBe('https://example.com/sync-image.png');
    });
  });

  describe('error handling', () => {
    it('should throw BriaAPIError on 401 (invalid key)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          error: 'Invalid API key',
          code: 'INVALID_API_KEY',
        }),
      });

      try {
        await client.generate('test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BriaAPIError);
        expect((error as BriaAPIError).code).toBe('INVALID_API_KEY');
        expect((error as BriaAPIError).status).toBe(401);
      }
    });

    it('should throw BriaAPIError on 500 (server error)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: 'Internal server error',
          code: 'API_ERROR',
        }),
      });

      await expect(client.generate('test')).rejects.toThrow(BriaAPIError);
    });

    it('should throw BriaAPIError on generation failure during polling', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-fail',
          status_url: 'https://engine.prod.bria-api.com/v2/status/req-fail',
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'ERROR',
          error: { message: 'Generation failed' },
        }),
      });

      try {
        await client.generate('test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BriaAPIError);
        expect((error as BriaAPIError).code).toBe('GENERATION_FAILED');
      }
    });
  });

  describe('exponential backoff', () => {
    it('should retry with exponential backoff on 429 (rate limit)', async () => {
      // First call: rate limit
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
        }),
      });

      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-retry',
          status_url: 'https://engine.prod.bria-api.com/v2/status/req-retry',
        }),
      });

      // Status: completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'COMPLETED',
          result: {
            image_url: 'https://example.com/retry-image.png',
            seed: 99999,
          },
        }),
      });

      const generatePromise = client.generate('retry test');
      
      // Advance timers to allow backoff
      await vi.advanceTimersByTimeAsync(1000);
      
      const result = await generatePromise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.imageUrl).toBe('https://example.com/retry-image.png');
    });

    it('should fail after max retry attempts', async () => {
      // All calls return rate limit
      for (let i = 0; i < 4; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: () => Promise.resolve({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT',
          }),
        });
      }

      // Create a promise that we'll track
      const generatePromise = client.generate('max retry test');
      
      // Flush all pending timers and microtasks
      await vi.runAllTimersAsync();
      
      // The promise should now be rejected
      try {
        await generatePromise;
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BriaAPIError);
        expect((error as BriaAPIError).code).toBe('MAX_RETRIES');
      }
      
      // Verify all 4 retry attempts were made
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('polling', () => {
    it('should poll until completion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-poll',
          status_url: 'https://engine.prod.bria-api.com/v2/status/req-poll',
        }),
      });

      // First poll: in progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'IN_PROGRESS',
        }),
      });

      // Second poll: in progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'IN_PROGRESS',
        }),
      });

      // Third poll: completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'COMPLETED',
          result: {
            image_url: 'https://example.com/polled-image.png',
            seed: 55555,
          },
        }),
      });

      const generatePromise = client.generate('poll test');
      
      // Advance timers for polling intervals
      await vi.advanceTimersByTimeAsync(3000);
      
      const result = await generatePromise;

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(result.imageUrl).toBe('https://example.com/polled-image.png');
    });

    it('should include status_url in polling request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          request_id: 'req-url',
          status_url: 'https://engine.prod.bria-api.com/v2/status/req-url',
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'COMPLETED',
          result: {
            image_url: 'https://example.com/url-image.png',
            seed: 77777,
          },
        }),
      });

      await client.generate('url test');

      const statusCall = mockFetch.mock.calls[1];
      expect(statusCall[0]).toContain('/api/status?status_url=');
      expect(statusCall[0]).toContain(encodeURIComponent('https://engine.prod.bria-api.com/v2/status/req-url'));
    });
  });

  describe('singleton and factory functions', () => {
    it('getBriaClient should return same instance', () => {
      const client1 = getBriaClient();
      const client2 = getBriaClient();
      expect(client1).toBe(client2);
    });

    it('createBriaClient should return new instance', () => {
      const client1 = createBriaClient();
      const client2 = createBriaClient();
      expect(client1).not.toBe(client2);
    });
  });
});

describe('BriaAPIError', () => {
  it('should have correct properties', () => {
    const error = new BriaAPIError('Test error', 'TEST_CODE', 400, { detail: 'info' });
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.status).toBe(400);
    expect(error.details).toEqual({ detail: 'info' });
    expect(error.name).toBe('BriaAPIError');
  });
});

describe('GenerationTimeoutError', () => {
  it('should have correct message', () => {
    const error = new GenerationTimeoutError('req-timeout');
    
    expect(error.message).toContain('timed out');
    expect(error.message).toContain('60 seconds');
    expect(error.message).toContain('req-timeout');
    expect(error.name).toBe('GenerationTimeoutError');
  });
});
