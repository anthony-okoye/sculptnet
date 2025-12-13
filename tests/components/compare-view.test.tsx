/**
 * Compare View Component Tests
 * 
 * Tests for the split-screen compare mode component
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompareView } from '@/components/compare-view';
import type { GenerationHistoryEntry } from '@/lib/stores/generation-store';

// Mock generation history entries
const mockImageA: GenerationHistoryEntry = {
  id: 'test-1',
  imageUrl: 'data:image/png;base64,test1',
  prompt: {
    short_description: 'Test image A',
    background_setting: 'Studio',
    lighting: {
      conditions: 'soft studio lighting',
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
  timestamp: Date.now() - 10000,
  seed: 12345,
  requestId: 'req-1',
  inARScene: false,
  gesture: 'pinch',
};

const mockImageB: GenerationHistoryEntry = {
  id: 'test-2',
  imageUrl: 'data:image/png;base64,test2',
  prompt: {
    short_description: 'Test image B',
    background_setting: 'Outdoor',
    lighting: {
      conditions: 'golden hour',
      direction: 'side',
      shadows: 'dramatic',
    },
    aesthetics: {
      composition: 'rule of thirds',
      color_scheme: 'cool',
      mood_atmosphere: 'dramatic',
    },
    photographic_characteristics: {
      depth_of_field: 'deep',
      focus: 'sharp',
      camera_angle: 'low angle',
      lens_focal_length: '24mm',
    },
    style_medium: 'photograph',
  },
  timestamp: Date.now(),
  seed: 67890,
  requestId: 'req-2',
  inARScene: true,
  gesture: 'rotation',
};

describe('CompareView', () => {
  it('renders both images', () => {
    const onClose = vi.fn();
    render(<CompareView imageA={mockImageA} imageB={mockImageB} onClose={onClose} />);
    
    // Check for image labels (multiple instances expected)
    const imageALabels = screen.getAllByText('Image A');
    const imageBLabels = screen.getAllByText('Image B');
    expect(imageALabels.length).toBeGreaterThan(0);
    expect(imageBLabels.length).toBeGreaterThan(0);
  });

  it('displays parameter differences', () => {
    const onClose = vi.fn();
    render(<CompareView imageA={mockImageA} imageB={mockImageB} onClose={onClose} />);
    
    // Should show differences count (multiple instances expected)
    const differencesText = screen.getAllByText(/differences/i);
    expect(differencesText.length).toBeGreaterThan(0);
    
    // Should show some parameter labels
    expect(screen.getByText('Lighting Conditions')).toBeInTheDocument();
    expect(screen.getByText('Camera Angle')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<CompareView imageA={mockImageA} imageB={mockImageB} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText('Close compare mode');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<CompareView imageA={mockImageA} imageB={mockImageB} onClose={onClose} />);
    
    fireEvent.keyDown(window, { key: 'Escape' });
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays gesture badges when available', () => {
    const onClose = vi.fn();
    render(<CompareView imageA={mockImageA} imageB={mockImageB} onClose={onClose} />);
    
    expect(screen.getByText('pinch')).toBeInTheDocument();
    expect(screen.getByText('rotation')).toBeInTheDocument();
  });

  it('shows no differences message when prompts are identical', () => {
    const onClose = vi.fn();
    const identicalImageB = { ...mockImageB, prompt: mockImageA.prompt };
    
    render(<CompareView imageA={mockImageA} imageB={identicalImageB} onClose={onClose} />);
    
    expect(screen.getByText(/no parameter differences/i)).toBeInTheDocument();
  });

  it('groups differences by category', () => {
    const onClose = vi.fn();
    render(<CompareView imageA={mockImageA} imageB={mockImageB} onClose={onClose} />);
    
    // Should show category headers (multiple instances expected due to parameter labels)
    const cameraText = screen.getAllByText(/camera/i);
    const lightingText = screen.getAllByText(/lighting/i);
    const aestheticsText = screen.getAllByText(/aesthetics/i);
    expect(cameraText.length).toBeGreaterThan(0);
    expect(lightingText.length).toBeGreaterThan(0);
    expect(aestheticsText.length).toBeGreaterThan(0);
  });

  it('displays slider control', () => {
    const onClose = vi.fn();
    render(<CompareView imageA={mockImageA} imageB={mockImageB} onClose={onClose} />);
    
    // Should have slider with aria-label
    const slider = screen.getByLabelText('Adjust comparison slider');
    expect(slider).toBeInTheDocument();
  });

  it('shows keyboard hints in footer', () => {
    const onClose = vi.fn();
    render(<CompareView imageA={mockImageA} imageB={mockImageB} onClose={onClose} />);
    
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByText('Adjust')).toBeInTheDocument();
  });
});
