'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

export interface ErrorDisplayProps {
  error: Error | string;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  showDismiss?: boolean;
}

/**
 * Component for displaying user-friendly error messages
 */
export function ErrorDisplay({
  error,
  title = 'Error',
  onRetry,
  onDismiss,
  retryLabel = 'Try Again',
  showDismiss = true,
}: ErrorDisplayProps): React.ReactElement {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <Alert variant="destructive" className="relative">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{errorMessage}</p>
        <div className="flex gap-2">
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="bg-background hover:bg-accent"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              {retryLabel}
            </Button>
          )}
          {showDismiss && onDismiss && (
            <Button
              onClick={onDismiss}
              variant="ghost"
              size="sm"
              className="ml-auto"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    // Map common error patterns to user-friendly messages
    const message = error.message.toLowerCase();

    // Webcam errors
    if (message.includes('permission denied') || message.includes('notallowederror')) {
      return 'Camera access was denied. Please enable camera permissions in your browser settings.';
    }
    if (message.includes('not found') || message.includes('notfounderror')) {
      return 'No camera found. Please check that your camera is connected and not in use by another application.';
    }
    if (message.includes('https') || message.includes('secure context')) {
      return 'Camera access requires a secure connection (HTTPS). Please access the application via HTTPS.';
    }

    // API errors
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'Invalid API key. Please check your Bria API key in settings.';
    }
    if (message.includes('429') || message.includes('rate limit')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (message.includes('500') || message.includes('server error')) {
      return 'Server error. Please try again in a few moments.';
    }
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }

    // MediaPipe errors
    if (message.includes('mediapipe') || message.includes('hand')) {
      return 'Hand tracking initialization failed. Please reload the page and try again.';
    }
    if (message.includes('webgl')) {
      return 'WebGL is not available. Please use a modern browser with WebGL support.';
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return 'Invalid input. Please check your data and try again.';
    }

    // Export errors
    if (message.includes('export') || message.includes('download')) {
      return 'Failed to export. Please try again.';
    }

    // Collaboration errors
    if (message.includes('websocket') || message.includes('connection')) {
      return 'Connection failed. Operating in local-only mode.';
    }

    // Return original message if no pattern matches
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Hook for managing error state with automatic dismissal
 */
export function useErrorState(autoDismissMs?: number) {
  const [error, setError] = React.useState<Error | string | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const showError = React.useCallback((err: Error | string) => {
    setError(err);

    if (autoDismissMs) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setError(null);
      }, autoDismissMs);
    }
  }, [autoDismissMs]);

  const clearError = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setError(null);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    error,
    showError,
    clearError,
    hasError: error !== null,
  };
}
