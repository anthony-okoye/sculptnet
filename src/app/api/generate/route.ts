/**
 * Next.js API Route: Image Generation Proxy
 * 
 * Proxies requests to Bria FIBO API for image generation.
 * Keeps API key server-side for security.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { NextRequest, NextResponse } from 'next/server';

// Bria API configuration
const BRIA_API_BASE_URL = 'https://engine.prod.bria-api.com/v2';
const BRIA_GENERATE_ENDPOINT = `${BRIA_API_BASE_URL}/image/generate`;

/**
 * Generation request body type
 */
interface GenerateRequestBody {
  prompt?: string;
  structured_prompt?: string;
  guidance_scale?: number;
  aspect_ratio?: string;
  steps_num?: number;
  seed?: number;
  sync?: boolean;
}

/**
 * POST /api/generate
 * 
 * Proxies image generation requests to Bria API.
 * Accepts either a text prompt or structured_prompt JSON.
 */
export async function POST(request: NextRequest) {
  try {
    // Get API key from environment or client-side override header
    // Client-side override is for demo/development purposes only
    const clientApiKey = request.headers.get('x-bria-api-key');
    const apiKey = clientApiKey || process.env.BRIA_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured', code: 'NO_API_KEY' },
        { status: 500 }
      );
    }

    // Parse request body
    const body: GenerateRequestBody = await request.json();

    // Validate that we have either prompt or structured_prompt
    if (!body.prompt && !body.structured_prompt) {
      return NextResponse.json(
        { error: 'Either prompt or structured_prompt is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Build request payload with defaults
    const payload = {
      guidance_scale: body.guidance_scale ?? 5,
      aspect_ratio: body.aspect_ratio ?? '1:1',
      steps_num: body.steps_num ?? 50,
      sync: body.sync ?? false,
      model_version: 'FIBO',
      ...(body.prompt && { prompt: body.prompt }),
      ...(body.structured_prompt && { structured_prompt: body.structured_prompt }),
      ...(body.seed !== undefined && { seed: body.seed }),
    };

    // Make request to Bria API
    const response = await fetch(BRIA_GENERATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'api_token': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Handle error responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Map Bria API errors to appropriate responses
      switch (response.status) {
        case 401:
          return NextResponse.json(
            { error: 'Invalid API key', code: 'INVALID_API_KEY', details: errorData },
            { status: 401 }
          );
        case 422:
          return NextResponse.json(
            { error: 'Content moderation failure', code: 'CONTENT_MODERATION', details: errorData },
            { status: 422 }
          );
        case 429:
          return NextResponse.json(
            { error: 'Rate limit exceeded', code: 'RATE_LIMIT', details: errorData },
            { status: 429 }
          );
        default:
          return NextResponse.json(
            { error: 'API error', code: 'API_ERROR', status: response.status, details: errorData },
            { status: response.status }
          );
      }
    }

    // Return successful response
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    // Handle network errors and other exceptions
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Failed to generate image', code: 'NETWORK_ERROR', message },
      { status: 500 }
    );
  }
}
