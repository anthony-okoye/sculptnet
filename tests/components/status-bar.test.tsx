/**
 * Status Bar Component Tests
 * 
 * Tests for the StatusBar component UI and status display
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '@/components/status-bar';
import type { GestureUpdate } from '@/lib/gesture-mapper';

describe('StatusBar', () => {
  it('should render with default props', () => {
    render(
      <StatusBar
        isDetecting={false}
        currentGesture={null}
        lastUpdate={null}
        generationStatus="idle"
        isGenerating={false}
        error={null}
        showToasts={false}
      />
    );

    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('should show Detecting badge when detecting', () => {
    render(
      <StatusBar
        isDetecting={true}
        currentGesture={null}
        lastUpdate={null}
        generationStatus="idle"
        isGenerating={false}
        error={null}
        showToasts={false}
      />
    );

    expect(screen.getByText('Detecting')).toBeInTheDocument();
  });

  it('should display hand count', () => {
    render(
      <StatusBar
        isDetecting={true}
        currentGesture={null}
        lastUpdate={null}
        generationStatus="idle"
        isGenerating={false}
        error={null}
        handCount={2}
        showToasts={false}
      />
    );

    // Updated for responsive design - now just shows "👋 2"
    expect(screen.getByText(/👋/)).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('should display current gesture', () => {
    render(
      <StatusBar
        isDetecting={true}
        currentGesture="Pinch: 50"
        lastUpdate={null}
        generationStatus="idle"
        isGenerating={false}
        error={null}
        showToasts={false}
      />
    );

    // Updated for responsive design - text appears in both mobile and desktop versions
    expect(screen.getAllByText('Pinch: 50').length).toBeGreaterThan(0);
  });

  it('should display last parameter update', () => {
    const update: GestureUpdate = {
      path: 'camera.fov',
      value: 75,
      confidence: 0.9,
    };

    render(
      <StatusBar
        isDetecting={true}
        currentGesture={null}
        lastUpdate={update}
        generationStatus="idle"
        isGenerating={false}
        error={null}
        showToasts={false}
      />
    );

    expect(screen.getByText(/camera\.fov: 75/)).toBeInTheDocument();
  });

  it('should show generating badge when generating', () => {
    render(
      <StatusBar
        isDetecting={true}
        currentGesture={null}
        lastUpdate={null}
        generationStatus="generating"
        isGenerating={true}
        error={null}
        showToasts={false}
      />
    );

    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('should show polling badge when polling', () => {
    render(
      <StatusBar
        isDetecting={true}
        currentGesture={null}
        lastUpdate={null}
        generationStatus="polling"
        isGenerating={false}
        error={null}
        showToasts={false}
      />
    );

    expect(screen.getByText('Polling status...')).toBeInTheDocument();
  });

  it('should display error badge and message', () => {
    render(
      <StatusBar
        isDetecting={true}
        currentGesture={null}
        lastUpdate={null}
        generationStatus="error"
        isGenerating={false}
        error="Generation failed"
        showToasts={false}
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Generation failed')).toBeInTheDocument();
  });

  it('should show Ready badge when idle with updates', () => {
    const update: GestureUpdate = {
      path: 'camera.fov',
      value: 75,
      confidence: 0.9,
    };

    render(
      <StatusBar
        isDetecting={true}
        currentGesture={null}
        lastUpdate={update}
        generationStatus="idle"
        isGenerating={false}
        error={null}
        showToasts={false}
      />
    );

    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
});
