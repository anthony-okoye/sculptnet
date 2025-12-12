/**
 * Next.js API Route: Generation Status Polling
 * 
 * Proxies status polling requests to Bria API.
 * Used for async generation flow to check completion status.
 * 
 * Requirements: 4.3, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/status
 * 
 * Polls the status of an async generation request.
 * Requires status_url query parameter.
 */
export async function GET(request: NextRequest) {
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

    // Get status URL from query params
    const statusUrl = request.nextUrl.searchParams.get('status_url');
    
    if (!statusUrl) {
      return NextResponse.json(
        { error: 'status_url query parameter is required', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Validate that the URL is from Bria API (security check)
    if (!statusUrl.startsWith('https://engine.prod.bria-api.com/')) {
      return NextResponse.json(
        { error: 'Invalid status URL', code: 'INVALID_URL' },
        { status: 400 }
      );
    }

    // Make request to Bria API status endpoint
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'api_token': apiKey,
      },
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
        case 404:
          return NextResponse.json(
            { error: 'Generation request not found', code: 'NOT_FOUND', details: errorData },
            { status: 404 }
          );
        default:
          return NextResponse.json(
            { error: 'Status check failed', code: 'API_ERROR', status: response.status, details: errorData },
            { status: response.status }
          );
      }
    }

    // Return status response
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    // Handle network errors and other exceptions
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Failed to check status', code: 'NETWORK_ERROR', message },
      { status: 500 }
    );
  }
}
