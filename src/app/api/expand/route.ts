/**
 * Next.js API Route: VLM Prompt Expansion
 * 
 * Proxies requests to Bria's structured_prompt/generate endpoint.
 * Expands short prompts into full FIBO structured prompts using VLM.
 * 
 * Requirements: 5.5
 */

import { NextRequest, NextResponse } from 'next/server';

// Bria API configuration
const BRIA_API_BASE_URL = 'https://engine.prod.bria-api.com/v2';
const BRIA_EXPAND_ENDPOINT = `${BRIA_API_BASE_URL}/structured_prompt/generate`;

/**
 * Expand request body type
 */
interface ExpandRequestBody {
  prompt: string;
  sync?: boolean;
}

/**
 * POST /api/expand
 * 
 * Expands a short prompt into a full FIBO structured prompt.
 * Uses Bria's VLM (Gemini 2.5 Flash bridge) for expansion.
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
    const body: ExpandRequestBody = await request.json();

    // Validate that we have a prompt
    if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'A non-empty prompt string is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Build request payload
    const payload = {
      prompt: body.prompt.trim(),
      sync: body.sync ?? true, // Default to sync for immediate response
    };

    // Make request to Bria API
    const response = await fetch(BRIA_EXPAND_ENDPOINT, {
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
      
      switch (response.status) {
        case 401:
          return NextResponse.json(
            { error: 'Invalid API key', code: 'INVALID_API_KEY', details: errorData },
            { status: 401 }
          );
        case 422:
          return NextResponse.json(
            { error: 'Content moderation failure or invalid prompt', code: 'CONTENT_MODERATION', details: errorData },
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
      { error: 'Failed to expand prompt', code: 'NETWORK_ERROR', message },
      { status: 500 }
    );
  }
}
