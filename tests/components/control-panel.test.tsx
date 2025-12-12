/**
 * Control Panel Component Tests
 * 
 * Tests for the ControlPanel component UI and interactions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControlPanel } from '@/components/control-panel';

describe('ControlPanel', () => {
  const mockCallbacks = {
    onStartDetection: vi.fn(),
    onStopDetection: vi.fn(),
    onGenerateNow: vi.fn(),
    onExportSingle: vi.fn(),
    onExportMultiple: vi.fn(),
    onExportPSD: vi.fn(),
    onCollaborationToggle: vi.fn(),
    onHapticToggle: vi.fn(),
  };

  it('should render with default props', () => {
    render(
      <ControlPanel
        isInitialized={false}
        isDetecting={false}
        isGenerating={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Controls')).toBeInTheDocument();
  });

  it('should show Initialize & Start button when not initialized', () => {
    render(
      <ControlPanel
        isInitialized={false}
        isDetecting={false}
        isGenerating={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Initialize & Start')).toBeInTheDocument();
  });

  it('should show Stop Detection button when detecting', () => {
    render(
      <ControlPanel
        isInitialized={true}
        isDetecting={true}
        isGenerating={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Stop Detection')).toBeInTheDocument();
  });

  it('should show Start Detection button when initialized but not detecting', () => {
    render(
      <ControlPanel
        isInitialized={true}
        isDetecting={false}
        isGenerating={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Start Detection')).toBeInTheDocument();
  });

  it('should call onStartDetection when start button is clicked', () => {
    render(
      <ControlPanel
        isInitialized={false}
        isDetecting={false}
        isGenerating={false}
        {...mockCallbacks}
      />
    );

    fireEvent.click(screen.getByText('Initialize & Start'));
    expect(mockCallbacks.onStartDetection).toHaveBeenCalled();
  });

  it('should call onStopDetection when stop button is clicked', () => {
    render(
      <ControlPanel
        isInitialized={true}
        isDetecting={true}
        isGenerating={false}
        {...mockCallbacks}
      />
    );

    fireEvent.click(screen.getByText('Stop Detection'));
    expect(mockCallbacks.onStopDetection).toHaveBeenCalled();
  });

  it('should disable Generate Now button when generating', () => {
    render(
      <ControlPanel
        isInitialized={true}
        isDetecting={false}
        isGenerating={true}
        {...mockCallbacks}
      />
    );

    const generateButton = screen.getByText('Generating...');
    expect(generateButton).toBeDisabled();
  });

  it('should show haptic toggle when provided', () => {
    render(
      <ControlPanel
        isInitialized={true}
        isDetecting={false}
        isGenerating={false}
        hapticEnabled={true}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Haptic Feedback')).toBeInTheDocument();
  });

  it('should show collaboration toggle when enabled', () => {
    render(
      <ControlPanel
        isInitialized={true}
        isDetecting={false}
        isGenerating={false}
        collaborationEnabled={true}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Collaboration')).toBeInTheDocument();
  });

  it('should have Gesture Mode and Manual Mode tabs', () => {
    render(
      <ControlPanel
        isInitialized={true}
        isDetecting={false}
        isGenerating={false}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText('Gesture Mode')).toBeInTheDocument();
    expect(screen.getByText('Manual Mode')).toBeInTheDocument();
  });
});
