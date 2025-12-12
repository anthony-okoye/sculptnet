/**
 * Tests for ErrorDisplay component and utilities
 */

import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import {
  ErrorDisplay,
  getUserFriendlyErrorMessage,
  useErrorState,
} from '@/components/error-display';

describe('ErrorDisplay', () => {
  test('renders error message from string', () => {
    render(<ErrorDisplay error="Test error message" />);
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  test('renders error message from Error object', () => {
    const error = new Error('Test error');
    render(<ErrorDisplay error={error} />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  test('renders custom title', () => {
    render(<ErrorDisplay error="Test" title="Custom Error Title" />);
    expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
  });

  test('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay error="Test" onRetry={onRetry} />);
    
    const retryButton = screen.getByRole('button', { name: /Try Again/i });
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test('shows custom retry label', () => {
    const onRetry = vi.fn();
    render(<ErrorDisplay error="Test" onRetry={onRetry} retryLabel="Retry Now" />);
    expect(screen.getByRole('button', { name: /Retry Now/i })).toBeInTheDocument();
  });

  test('shows dismiss button when enabled', () => {
    const onDismiss = vi.fn();
    render(<ErrorDisplay error="Test" onDismiss={onDismiss} showDismiss={true} />);
    
    const dismissButton = screen.getByRole('button');
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  test('hides dismiss button when disabled', () => {
    const onDismiss = vi.fn();
    render(<ErrorDisplay error="Test" onDismiss={onDismiss} showDismiss={false} />);
    
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });
});

describe('getUserFriendlyErrorMessage', () => {
  test('returns string as-is', () => {
    const message = getUserFriendlyErrorMessage('Test error');
    expect(message).toBe('Test error');
  });

  test('maps camera permission denied error', () => {
    const error = new Error('Permission denied');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('Camera access was denied');
  });

  test('maps camera not found error', () => {
    const error = new Error('Camera not found');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('No camera found');
  });

  test('maps HTTPS required error', () => {
    const error = new Error('HTTPS required for camera access');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('secure connection');
  });

  test('maps 401 unauthorized error', () => {
    const error = new Error('401 Unauthorized');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('Invalid API key');
  });

  test('maps 429 rate limit error', () => {
    const error = new Error('429 Too Many Requests');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('Too many requests');
  });

  test('maps 500 server error', () => {
    const error = new Error('500 Internal Server Error');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('Server error');
  });

  test('maps network error', () => {
    const error = new Error('Network request failed');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('Network error');
  });

  test('maps timeout error', () => {
    const error = new Error('Request timeout');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('timed out');
  });

  test('maps MediaPipe error', () => {
    const error = new Error('MediaPipe initialization failed');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('Hand tracking initialization failed');
  });

  test('maps WebGL error', () => {
    const error = new Error('WebGL not supported');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('WebGL is not available');
  });

  test('maps validation error', () => {
    const error = new Error('Validation failed');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('Invalid input');
  });

  test('maps export error', () => {
    const error = new Error('Export failed');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('Failed to export');
  });

  test('maps WebSocket error', () => {
    const error = new Error('WebSocket connection failed');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toContain('Connection failed');
  });

  test('returns original message for unknown error', () => {
    const error = new Error('Some unknown error');
    const message = getUserFriendlyErrorMessage(error);
    expect(message).toBe('Some unknown error');
  });

  test('handles non-Error objects', () => {
    const message = getUserFriendlyErrorMessage({ foo: 'bar' });
    expect(message).toBe('An unexpected error occurred. Please try again.');
  });
});

describe('useErrorState', () => {
  test('initializes with no error', () => {
    const { result } = renderHook(() => useErrorState());
    expect(result.current.error).toBeNull();
    expect(result.current.hasError).toBe(false);
  });

  test('shows error when showError called', () => {
    const { result } = renderHook(() => useErrorState());
    
    act(() => {
      result.current.showError('Test error');
    });

    expect(result.current.error).toBe('Test error');
    expect(result.current.hasError).toBe(true);
  });

  test('clears error when clearError called', () => {
    const { result } = renderHook(() => useErrorState());
    
    act(() => {
      result.current.showError('Test error');
    });
    expect(result.current.hasError).toBe(true);

    act(() => {
      result.current.clearError();
    });
    expect(result.current.hasError).toBe(false);
  });

  test('auto-dismisses error after timeout', async () => {
    const { result } = renderHook(() => useErrorState(100)); // 100ms timeout
    
    act(() => {
      result.current.showError('Test error');
    });
    expect(result.current.hasError).toBe(true);

    await waitFor(() => {
      expect(result.current.hasError).toBe(false);
    }, { timeout: 200 });
  });

  test('resets timeout on new error', async () => {
    const { result } = renderHook(() => useErrorState(100));
    
    act(() => {
      result.current.showError('Error 1');
    });

    // Show new error before timeout
    await new Promise(resolve => setTimeout(resolve, 50));
    act(() => {
      result.current.showError('Error 2');
    });

    expect(result.current.error).toBe('Error 2');
    
    // Should still be showing after original timeout
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(result.current.hasError).toBe(true);
  });

  test('accepts Error objects', () => {
    const { result } = renderHook(() => useErrorState());
    const error = new Error('Test error');
    
    act(() => {
      result.current.showError(error);
    });

    expect(result.current.error).toBe(error);
  });
});
