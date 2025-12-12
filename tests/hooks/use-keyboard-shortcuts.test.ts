/**
 * Keyboard Shortcuts Hook Tests
 * 
 * Tests for the keyboard shortcuts hook that manages global keyboard shortcuts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    // Clear any existing event listeners
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register keyboard shortcuts', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 'g',
        handler,
        description: 'Test shortcut',
      },
    ];

    renderHook(() => useKeyboardShortcuts({ shortcuts, enabled: true }));

    // Simulate keydown event
    const event = new KeyboardEvent('keydown', { key: 'g' });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle shortcuts with modifiers', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 's',
        ctrlKey: true,
        handler,
        description: 'Save',
      },
    ];

    renderHook(() => useKeyboardShortcuts({ shortcuts, enabled: true }));

    // Simulate Ctrl+S
    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not trigger when disabled', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 'g',
        handler,
        description: 'Test shortcut',
      },
    ];

    renderHook(() => useKeyboardShortcuts({ shortcuts, enabled: false }));

    // Simulate keydown event
    const event = new KeyboardEvent('keydown', { key: 'g' });
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle multiple shortcuts', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const shortcuts = [
      {
        key: 'g',
        handler: handler1,
        description: 'Generate',
      },
      {
        key: 'h',
        handler: handler2,
        description: 'Help',
      },
    ];

    renderHook(() => useKeyboardShortcuts({ shortcuts, enabled: true }));

    // Trigger first shortcut
    const event1 = new KeyboardEvent('keydown', { key: 'g' });
    window.dispatchEvent(event1);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();

    // Trigger second shortcut
    const event2 = new KeyboardEvent('keydown', { key: 'h' });
    window.dispatchEvent(event2);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should cleanup event listeners on unmount', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 'g',
        handler,
        description: 'Test shortcut',
      },
    ];

    const { unmount } = renderHook(() => useKeyboardShortcuts({ shortcuts, enabled: true }));

    // Unmount the hook
    unmount();

    // Simulate keydown event after unmount
    const event = new KeyboardEvent('keydown', { key: 'g' });
    window.dispatchEvent(event);

    // Handler should not be called after unmount
    expect(handler).not.toHaveBeenCalled();
  });
});
