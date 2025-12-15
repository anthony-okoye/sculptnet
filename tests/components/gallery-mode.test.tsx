/**
 * Gallery Mode Component Tests
 * 
 * Tests for the AR Gallery Walk Mode component
 * 
 * Requirements: 2.3 (enhanced)
 */

import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GalleryMode } from '@/components/gallery-mode';
import type { GenerationHistoryEntry } from '@/lib/stores/generation-store';

describe('GalleryMode', () => {
  const mockEntries: GenerationHistoryEntry[] = [
    {
      id: 'entry-1',
      imageUrl: 'https://example.com/image1.jpg',
      prompt: {
        short_description: 'Test image 1',
        background_setting: 'Studio',
        lighting: {
          conditions: 'soft lighting',
          direction: 'overhead',
          shadows: 'minimal',
        },
        aesthetics: {
          composition: 'centered',
          color_scheme: 'warm',
          mood_atmosphere: 'calm',
        },
        photographic_characteristics: {
          depth_of_field: 'shallow',
          focus: 'sharp',
          camera_angle: 'eye-level',
          lens_focal_length: '50mm',
        },
        style_medium: 'photograph',
      },
      timestamp: Date.now(),
      seed: 12345,
      requestId: 'req-1',
      inARScene: false,
    },
    {
      id: 'entry-2',
      imageUrl: 'https://example.com/image2.jpg',
      prompt: {
        short_description: 'Test image 2',
        background_setting: 'Outdoor',
        lighting: {
          conditions: 'bright sunlight',
          direction: 'side',
          shadows: 'dramatic',
        },
        aesthetics: {
          composition: 'rule of thirds',
          color_scheme: 'cool',
          mood_atmosphere: 'energetic',
        },
        photographic_characteristics: {
          depth_of_field: 'deep',
          focus: 'sharp',
          camera_angle: 'high angle',
          lens_focal_length: '24mm',
        },
        style_medium: 'photograph',
      },
      timestamp: Date.now(),
      seed: 67890,
      requestId: 'req-2',
      inARScene: false,
    },
  ];

  const mockOnToggle = vi.fn();
  const mockOnPlaceImage = vi.fn(() => 'ar-entity-1');
  const mockOnRemoveImage = vi.fn();
  const mockOnClearAll = vi.fn();

  test('renders when active', () => {
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={mockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    expect(screen.getByText('Gallery Mode')).toBeInTheDocument();
  });

  test('does not render when inactive', () => {
    const { container } = render(
      <GalleryMode
        isActive={false}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={mockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  test('displays layout options', () => {
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={mockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    expect(screen.getByText('Grid')).toBeInTheDocument();
    expect(screen.getByText('Circle')).toBeInTheDocument();
    expect(screen.getByText('Line')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  test('shows entry count badge', () => {
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={mockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    // Badge shows entry count (auto-applies layout, so shows "2 / 2")
    expect(screen.getByText('Gallery Mode')).toBeInTheDocument();
    // Check that there are badges with "2" in them (placement count and total)
    const badges = screen.getAllByText(/2/);
    expect(badges.length).toBeGreaterThan(0);
  });

  test('calls onToggle when close button clicked', () => {
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={mockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
    fireEvent.click(closeButton);

    expect(mockOnToggle).toHaveBeenCalledWith(false);
  });

  test('shows empty state when no entries', () => {
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={[]}
        onPlaceImage={mockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    expect(screen.getByText('Generate some images first to create a gallery')).toBeInTheDocument();
  });

  test('applies grid layout when button clicked', () => {
    const freshMockOnPlaceImage = vi.fn(() => 'ar-entity-1');
    
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={freshMockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    // Component auto-applies layout on mount, so reset the mock
    freshMockOnPlaceImage.mockClear();

    const gridButton = screen.getByText('Grid');
    fireEvent.click(gridButton);

    // Should call onPlaceImage for each entry
    expect(freshMockOnPlaceImage).toHaveBeenCalledTimes(2);
  });

  test('toggles label visibility', () => {
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={mockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    const toggleButton = screen.getByText(/Hide Labels/);
    fireEvent.click(toggleButton);

    expect(screen.getByText(/Show Labels/)).toBeInTheDocument();
  });

  test('calls onClearAll when clear button clicked', () => {
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={mockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    // First apply a layout to create placements
    const gridButton = screen.getByText('Grid');
    fireEvent.click(gridButton);

    // Then clear
    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);

    expect(mockOnClearAll).toHaveBeenCalled();
  });

  test('shows device motion status when available', () => {
    const mockOrientation: DeviceOrientationEvent = {
      alpha: 0,
      beta: 0,
      gamma: 0,
      absolute: true,
    } as DeviceOrientationEvent;

    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={mockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
        deviceOrientation={mockOrientation}
      />
    );

    expect(screen.getByText(/Device Motion:/)).toBeInTheDocument();
    expect(screen.getByText(/Active/)).toBeInTheDocument();
  });

  test('applies circle layout correctly', () => {
    const freshMockOnPlaceImage = vi.fn(() => 'ar-entity-1');
    
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={freshMockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    // Component auto-applies layout on mount, so reset the mock
    freshMockOnPlaceImage.mockClear();

    const circleButton = screen.getByText('Circle');
    fireEvent.click(circleButton);

    // Should call onPlaceImage for each entry with different positions
    expect(freshMockOnPlaceImage).toHaveBeenCalledTimes(2);
    
    // Verify positions are different (circle layout)
    const calls = freshMockOnPlaceImage.mock.calls;
    expect(calls[0][1]).not.toEqual(calls[1][1]);
  });

  test('applies line layout correctly', () => {
    const freshMockOnPlaceImage = vi.fn(() => 'ar-entity-1');
    
    render(
      <GalleryMode
        isActive={true}
        onToggle={mockOnToggle}
        entries={mockEntries}
        onPlaceImage={freshMockOnPlaceImage}
        onRemoveImage={mockOnRemoveImage}
        onClearAll={mockOnClearAll}
      />
    );

    // Component auto-applies layout on mount, so reset the mock
    freshMockOnPlaceImage.mockClear();

    const lineButton = screen.getByText('Line');
    fireEvent.click(lineButton);

    // Should call onPlaceImage for each entry
    expect(freshMockOnPlaceImage).toHaveBeenCalledTimes(2);
  });
});
