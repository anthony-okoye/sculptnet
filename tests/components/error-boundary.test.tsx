/**
 * Tests for ErrorBoundary component
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary } from '@/components/error-boundary';
import React from 'react';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console errors in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  test('renders error UI when error occurs', () => {
    render(
      <ErrorBoundary componentName="TestComponent">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/Test error/i)).toBeInTheDocument();
  });

  test('displays component name in error message', () => {
    render(
      <ErrorBoundary componentName="MyComponent">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/MyComponent/i)).toBeInTheDocument();
  });

  test('shows Try Again button for first error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  test('shows Reload Page button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
  });

  test('shows Go Home button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /Go Home/i })).toBeInTheDocument();
  });

  test('calls custom error handler when provided', () => {
    const onError = vi.fn();
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  test('renders custom fallback when provided', () => {
    const fallback = <div>Custom error message</div>;
    
    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  test('Try Again button attempts to reset error state', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const tryAgainButton = screen.getByRole('button', { name: /Try Again/i });
    
    // Clicking Try Again should be possible
    expect(tryAgainButton).toBeInTheDocument();
    fireEvent.click(tryAgainButton);
    
    // After clicking, the component will try to re-render
    // Since our test component still throws, we'll see the error again
    // But the error count should increase
    expect(screen.getByText(/Error count:/i)).toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  test('wraps component with error boundary', () => {
    const TestComponent = () => <div>Test</div>;
    const WrappedComponent = withErrorBoundary(TestComponent, 'TestComponent');

    render(<WrappedComponent />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  test('catches errors in wrapped component', () => {
    const WrappedComponent = withErrorBoundary(ThrowError, 'ThrowError');

    render(<WrappedComponent shouldThrow={true} />);
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  test('sets display name correctly', () => {
    const TestComponent = () => <div>Test</div>;
    TestComponent.displayName = 'MyTestComponent';
    
    const WrappedComponent = withErrorBoundary(TestComponent);
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(MyTestComponent)');
  });
});
