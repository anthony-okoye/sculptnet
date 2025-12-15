/**
 * Bria API Client
 * 
 * Client-side module for interacting with Bria FIBO API through Next.js API routes.
 * Implements async generation flow with polling, error handling, and exponential backoff.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import type { FIBOStructuredPrompt } from '@/types/fibo';
import { getStoredApiKey } from '@/components/settings-dialog';
import { logError, logInfo, logWarning } from './error-logger';
import { handleHDRFallback } from '@/lib/hdr-utils';

// ============ Types ============

/**
 * Generation options for API requests
 */
export interface GenerationOptions {
  /** Number of inference steps (35-50, default 50) */
  steps_num?: number;
  /** Guidance scale (3-5, default 5) */
  guidance_scale?: number;
  /** Aspect ratio (default "1:1") */
  aspect_ratio?: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9';
  /** Seed for reproducibility */
  seed?: number;
  /** Whether to wait for sync response (default false) */
  sync?: boolean;
  /** Enable HDR mode (16-bit color depth) - Requirements: 16.1 */
  hdr?: boolean;
  /** Color depth (8 or 16 bit) - Requirements: 16.1 */
  color_depth?: 8 | 16;
}

/**
 * Generation result returned after successful image generation
 */
export interface GenerationResult {
  /** URL to the generated image */
  imageUrl: string;
  /** The structured prompt used for generation */
  prompt: FIBOStructuredPrompt | string;
  /** Timestamp of generation */
  timestamp: number;
  /** Seed used for generation */
  seed: number;
  /** Request ID from Bria API */
  requestId: string;
  /** Whether this was generated in HDR mode - Requirements: 16.1 */
  isHDR?: boolean;
  /** Color depth (8 or 16 bit) - Requirements: 16.1, 16.5 */
  colorDepth?: 8 | 16;
}

/**
 * API error response structure
 */
export interface APIError {
  error: string;
  code: string;
  status?: number;
  details?: unknown;
  message?: string;
}

/**
 * Generation status from polling
 */
export type GenerationStatus = 'idle' | 'generating' | 'polling' | 'error';

/**
 * Status response from Bria API
 */
interface StatusResponse {
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ERROR';
  result?: {
    image_url: string;
    structured_prompt?: string;
    seed: number;
  };
  error?: {
    message: string;
  };
}

/**
 * Generate response from Bria API (async mode)
 */
interface GenerateResponse {
  request_id: string;
  status_url: string;
  result?: {
    image_url: string;
    structured_prompt?: string;
    seed: number;
  };
}

// ============ Constants ============

/** Maximum polling duration in milliseconds (60 seconds) */
const POLLING_TIMEOUT_MS = 60000;

/** Polling interval in milliseconds */
const POLLING_INTERVAL_MS = 1000;

/** Maximum retry attempts for rate limits */
const MAX_RETRY_ATTEMPTS = 4;

/** Base delay for exponential backoff (1 second) */
const BASE_RETRY_DELAY_MS = 1000;

// ============ Error Classes ============

/**
 * Custom error class for Bria API errors
 */
export class BriaAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'BriaAPIError';
  }
}

/**
 * Error for generation timeout
 */
export class GenerationTimeoutError extends Error {
  constructor(requestId: string) {
    super(`Generation timed out after ${POLLING_TIMEOUT_MS / 1000} seconds (request: ${requestId})`);
    this.name = 'GenerationTimeoutError';
  }
}

// ============ Bria Client Class ============

/**
 * Bria API Client
 * 
 * Handles image generation through Next.js API routes with:
 * - Async generation flow with polling
 * - Exponential backoff for rate limits
 * - Comprehensive error handling
 */
export class BriaClient {
  private status: GenerationStatus = 'idle';
  private abortController: AbortController | null = null;

  /**
   * Get current generation status
   */
  getStatus(): GenerationStatus {
    return this.status;
  }

  /**
   * Cancel any ongoing generation
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.status = 'idle';
  }

  /**
   * Generate an image using Bria FIBO API
   * 
   * @param prompt - Text prompt or structured FIBO prompt
   * @param options - Generation options
   * @returns Generation result with image URL
   * @throws BriaAPIError on API errors
   * @throws GenerationTimeoutError on polling timeout
   */
  async generate(
    prompt: string | FIBOStructuredPrompt,
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    // Cancel any existing generation
    this.cancel();
    
    this.status = 'generating';
    this.abortController = new AbortController();

    logInfo('Starting image generation', {
      component: 'BriaClient',
      action: 'generate',
      metadata: {
        promptType: typeof prompt,
        options,
      },
    });

    console.log('[SculptNet] 🎨 Starting image generation...');
    console.log('[SculptNet] 📝 Prompt type:', typeof prompt);
    console.log('[SculptNet] ⚙️ Options:', options);

    try {
      // Build request body
      const body: Record<string, unknown> = {
        guidance_scale: options.guidance_scale ?? 5,
        aspect_ratio: options.aspect_ratio ?? '1:1',
        steps_num: options.steps_num ?? 50,
        sync: options.sync ?? false,
      };

      // Add prompt (text or structured)
      if (typeof prompt === 'string') {
        body.prompt = prompt;
      } else {
        body.structured_prompt = JSON.stringify(prompt);
      }

      // Add optional seed
      if (options.seed !== undefined) {
        body.seed = options.seed;
      }

      // Add HDR parameters if enabled
      // Requirements: 16.1 - Request 16-bit color depth from Bria API
      if (options.hdr || options.color_depth === 16) {
        body.color_depth = 16;
        body.hdr = true;
        console.log('[SculptNet] 🎨 HDR mode enabled - requesting 16-bit color depth');
      } else if (options.color_depth === 8) {
        body.color_depth = 8;
      }

      // Get client-side API key if available
      const clientApiKey = getStoredApiKey();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (clientApiKey) {
        headers['x-bria-api-key'] = clientApiKey;
      }

      // Make request with retry logic for rate limits
      const response = await this.fetchWithRetry('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      const data = await response.json() as GenerateResponse;

      console.log('[SculptNet] 📬 Received response from Bria API');
      console.log('[SculptNet] 🆔 Request ID:', data.request_id);
      console.log('[SculptNet] 🔗 Status URL:', data.status_url);

      // If sync mode, result is immediate
      if (options.sync && data.result) {
        this.status = 'idle';
        console.log('[SculptNet] ✅ Sync generation completed immediately');
        logInfo('Image generation completed (sync)', {
          component: 'BriaClient',
          action: 'generate',
          metadata: { requestId: data.request_id },
        });
        
        // Requirements: 16.4 - Handle HDR fallback gracefully
        const hdrFallback = handleHDRFallback(
          options.hdr || options.color_depth === 16,
          data
        );
        
        if (hdrFallback.fellBack) {
          console.warn('[SculptNet] ⚠️ HDR fallback:', hdrFallback.message);
          logWarning(hdrFallback.message || 'HDR not supported, fell back to 8-bit', {
            component: 'BriaClient',
            action: 'generate',
          });
        }
        
        return {
          imageUrl: data.result.image_url,
          prompt: data.result.structured_prompt 
            ? JSON.parse(data.result.structured_prompt) 
            : prompt,
          timestamp: Date.now(),
          seed: data.result.seed,
          requestId: data.request_id,
          isHDR: hdrFallback.isHDR,
          colorDepth: hdrFallback.colorDepth,
        };
      }

      // Async mode - poll for completion
      this.status = 'polling';
      logInfo('Starting async polling', {
        component: 'BriaClient',
        action: 'generate',
        metadata: { requestId: data.request_id },
      });
      return await this.pollStatus(data.status_url, data.request_id, prompt, options);

    } catch (error) {
      this.status = 'error';
      
      if (error instanceof BriaAPIError || error instanceof GenerationTimeoutError) {
        logError('Image generation failed', error, {
          component: 'BriaClient',
          action: 'generate',
          metadata: {
            errorCode: error instanceof BriaAPIError ? error.code : 'TIMEOUT',
          },
        });
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        logWarning('Image generation cancelled', {
          component: 'BriaClient',
          action: 'generate',
        });
        throw new BriaAPIError('Generation cancelled', 'CANCELLED');
      }
      
      const apiError = new BriaAPIError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN_ERROR'
      );
      logError('Image generation failed with unknown error', error instanceof Error ? error : undefined, {
        component: 'BriaClient',
        action: 'generate',
      });
      throw apiError;
    }
  }

  /**
   * Poll generation status until completion or timeout
   * 
   * @param statusUrl - URL to poll for status
   * @param requestId - Request ID for tracking
   * @param originalPrompt - Original prompt for result
   * @param options - Original generation options (for HDR tracking)
   * @returns Generation result
   */
  async pollStatus(
    statusUrl: string,
    requestId: string,
    originalPrompt: string | FIBOStructuredPrompt,
    options: GenerationOptions = {}
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    let pollCount = 0;
    
    console.log(`[SculptNet] 🔄 Starting status polling for request: ${requestId}`);
    
    while (Date.now() - startTime < POLLING_TIMEOUT_MS) {
      // Check if cancelled
      if (this.abortController?.signal.aborted) {
        console.log(`[SculptNet] ❌ Polling cancelled for request: ${requestId}`);
        throw new BriaAPIError('Generation cancelled', 'CANCELLED');
      }

      try {
        pollCount++;
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        // Get client-side API key if available
        const clientApiKey = getStoredApiKey();
        const headers: Record<string, string> = {};
        if (clientApiKey) {
          headers['x-bria-api-key'] = clientApiKey;
        }

        const response = await this.fetchWithRetry(
          `/api/status?status_url=${encodeURIComponent(statusUrl)}`,
          {
            method: 'GET',
            headers,
            signal: this.abortController?.signal,
          }
        );

        const data = await response.json() as StatusResponse;

        console.log(`[SculptNet] 📊 Poll #${pollCount} (${elapsedSeconds}s): Status = ${data.status}`);

        if (data.status === 'COMPLETED' && data.result) {
          this.status = 'idle';
          
          // Requirements: 16.4 - Handle HDR fallback gracefully
          const hdrFallback = handleHDRFallback(
            options.hdr || options.color_depth === 16,
            data
          );
          
          if (hdrFallback.fellBack) {
            console.warn('[SculptNet] ⚠️ HDR fallback:', hdrFallback.message);
            logWarning(hdrFallback.message || 'HDR not supported, fell back to 8-bit', {
              component: 'BriaClient',
              action: 'pollStatus',
            });
          }
          
          console.log(`[SculptNet] ✅ Generation completed! Request: ${requestId}`);
          console.log(`[SculptNet] 🖼️ Image URL: ${data.result.image_url}`);
          if (hdrFallback.isHDR) {
            console.log(`[SculptNet] 🎨 HDR mode: ${hdrFallback.colorDepth}-bit color depth`);
          }
          return {
            imageUrl: data.result.image_url,
            prompt: data.result.structured_prompt 
              ? JSON.parse(data.result.structured_prompt) 
              : originalPrompt,
            timestamp: Date.now(),
            seed: data.result.seed,
            requestId,
            isHDR: hdrFallback.isHDR,
            colorDepth: hdrFallback.colorDepth,
          };
        }

        if (data.status === 'ERROR') {
          this.status = 'error';
          console.error(`[SculptNet] ❌ Generation failed: ${data.error?.message || 'Unknown error'}`);
          throw new BriaAPIError(
            data.error?.message || 'Generation failed',
            'GENERATION_FAILED',
            undefined,
            data.error
          );
        }

        // Still in progress - wait and retry
        await this.sleep(POLLING_INTERVAL_MS);

      } catch (error) {
        // Re-throw BriaAPIError and abort errors
        if (error instanceof BriaAPIError) {
          throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`[SculptNet] ❌ Polling aborted for request: ${requestId}`);
          throw new BriaAPIError('Generation cancelled', 'CANCELLED');
        }
        
        console.warn(`[SculptNet] ⚠️ Polling error (will retry): ${error instanceof Error ? error.message : 'Unknown'}`);
        // For other errors, continue polling (might be transient)
        await this.sleep(POLLING_INTERVAL_MS);
      }
    }

    // Timeout reached
    this.status = 'error';
    console.error(`[SculptNet] ⏱️ Polling timeout after ${POLLING_TIMEOUT_MS / 1000}s for request: ${requestId}`);
    throw new GenerationTimeoutError(requestId);
  }

  /**
   * Fetch with exponential backoff retry for rate limits
   * 
   * @param url - URL to fetch
   * @param options - Fetch options
   * @returns Response
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // Check for rate limit
        if (response.status === 429) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
          continue;
        }
        
        // Check for other errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as APIError;
          throw new BriaAPIError(
            errorData.error || `HTTP ${response.status}`,
            errorData.code || 'HTTP_ERROR',
            response.status,
            errorData.details
          );
        }
        
        return response;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on abort or non-rate-limit errors
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        if (error instanceof BriaAPIError && error.code !== 'RATE_LIMIT') {
          throw error;
        }
        
        // Rate limit - apply backoff
        const delay = this.calculateBackoffDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    // All retries exhausted
    throw lastError || new BriaAPIError('Max retries exceeded', 'MAX_RETRIES');
  }

  /**
   * Calculate exponential backoff delay
   * 
   * @param attempt - Current attempt number (0-indexed)
   * @returns Delay in milliseconds (1s, 2s, 4s, 8s)
   */
  private calculateBackoffDelay(attempt: number): number {
    return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  }

  /**
   * Sleep for specified duration
   * 
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============ Singleton Instance ============

/** Default Bria client instance */
let defaultClient: BriaClient | null = null;

/**
 * Get the default Bria client instance
 */
export function getBriaClient(): BriaClient {
  if (!defaultClient) {
    defaultClient = new BriaClient();
  }
  return defaultClient;
}

/**
 * Create a new Bria client instance
 */
export function createBriaClient(): BriaClient {
  return new BriaClient();
}

// ============ Convenience Functions ============

/**
 * Generate an image using the default client
 * 
 * @param prompt - Text prompt or structured FIBO prompt
 * @param options - Generation options
 * @returns Generation result
 */
export async function generateImage(
  prompt: string | FIBOStructuredPrompt,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  return getBriaClient().generate(prompt, options);
}

/**
 * Get the current generation status
 */
export function getGenerationStatus(): GenerationStatus {
  return getBriaClient().getStatus();
}

/**
 * Cancel any ongoing generation
 */
export function cancelGeneration(): void {
  getBriaClient().cancel();
}

// ============ VLM Prompt Expansion ============

/**
 * VLM expansion response from Bria API
 */
interface ExpandResponse {
  result?: {
    structured_prompt: string;
  };
  request_id?: string;
  status_url?: string;
}

/**
 * Expand a short prompt into a full FIBO structured prompt using VLM
 * 
 * @param shortPrompt - Short text prompt to expand
 * @returns Expanded FIBO structured prompt
 * @throws BriaAPIError on API errors
 */
export async function expandPrompt(shortPrompt: string): Promise<FIBOStructuredPrompt> {
  const client = getBriaClient();
  
  try {
    // Get client-side API key if available
    const clientApiKey = getStoredApiKey();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (clientApiKey) {
      headers['x-bria-api-key'] = clientApiKey;
    }

    const response = await fetch('/api/expand', {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        prompt: shortPrompt,
        sync: true 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string; code?: string; details?: unknown };
      throw new BriaAPIError(
        errorData.error || `HTTP ${response.status}`,
        errorData.code || 'HTTP_ERROR',
        response.status,
        errorData.details
      );
    }

    const data = await response.json() as ExpandResponse;

    if (!data.result?.structured_prompt) {
      throw new BriaAPIError(
        'No structured prompt in response',
        'INVALID_RESPONSE'
      );
    }

    // Parse the structured prompt JSON
    const expandedPrompt = JSON.parse(data.result.structured_prompt) as FIBOStructuredPrompt;
    return expandedPrompt;

  } catch (error) {
    if (error instanceof BriaAPIError) {
      throw error;
    }
    
    throw new BriaAPIError(
      error instanceof Error ? error.message : 'Unknown error',
      'EXPAND_ERROR'
    );
  }
}
