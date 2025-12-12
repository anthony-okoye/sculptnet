/**
 * Help Dialog Component Tests
 * 
 * Tests for the help dialog component that displays usage instructions
 * and gesture guides.
 * 
 * Requirements: 10.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpDialog, useFirstTimeHelp } from '@/components/help-dialog';
import { renderHook, act } from '@testing-library/react';

describe('HelpDialog', () => {
  it('should render when open is true', () => {
    const onOpenChange = vi.fn();
    
    render(<HelpDialog open={true} onOpenChange={onOpenChange} />);
    
    // Check for dialog title
    expect(screen.getByText('SculptNet Guide')).toBeDefined();
    expect(screen.getByText('Learn how to sculpt AI-generated images with hand gestures')).toBeDefined();
  });

  it('should display gesture cards', () => {
    const onOpenChange = vi.fn();
    
    render(<HelpDialog open={true} onOpenChange={onOpenChange} />);
    
    // Check for gesture titles
    expect(screen.getByText('Pinch Gesture')).toBeDefined();
    expect(screen.getByText('Wrist Rotation')).toBeDefined();
    expect(screen.getByText('Vertical Movement')).toBeDefined();
    expect(screen.getByText('Two-Hand Frame')).toBeDefined();
    expect(screen.getByText('Fist to Open')).toBeDefined();
  });

  it('should display keyboard shortcuts tab', () => {
    const onOpenChange = vi.fn();
    
    render(<HelpDialog open={true} onOpenChange={onOpenChange} />);
    
    // Check for keyboard shortcuts tab
    expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
  });

  it('should display tips tab', () => {
    const onOpenChange = vi.fn();
    
    render(<HelpDialog open={true} onOpenChange={onOpenChange} />);
    
    // Check for tips tab
    expect(screen.getByText('Tips')).toBeDefined();
  });

  it('should call onOpenChange when Got it button is clicked', () => {
    const onOpenChange = vi.fn();
    
    const { container } = render(<HelpDialog open={true} onOpenChange={onOpenChange} />);
    
    // Find and click the "Got it!" button
    const button = screen.getByText('Got it!');
    expect(button).toBeDefined();
  });
});

describe('useFirstTimeHelp', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should show help on first load', () => {
    const { result } = renderHook(() => useFirstTimeHelp());
    
    // On first load, showHelp should be true
    expect(result.current.showHelp).toBe(true);
    
    // localStorage should be set
    expect(localStorage.getItem('hasSeenGuide')).toBe('true');
  });

  it('should not show help on subsequent loads', () => {
    // Set localStorage to indicate guide has been seen
    localStorage.setItem('hasSeenGuide', 'true');
    
    const { result } = renderHook(() => useFirstTimeHelp());
    
    // On subsequent loads, showHelp should be false
    expect(result.current.showHelp).toBe(false);
  });

  it('should allow manually setting showHelp', () => {
    const { result } = renderHook(() => useFirstTimeHelp());
    
    // Initially true
    expect(result.current.showHelp).toBe(true);
    
    // Set to false
    act(() => {
      result.current.setShowHelp(false);
    });
    
    expect(result.current.showHelp).toBe(false);
  });
});
