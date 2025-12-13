/**
 * History Timeline Component Tests
 * 
 * Tests for the Sculpt History Timeline component
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryTimeline } from '@/components/history-timeline';
import { useGenerationStore } from '@/lib/stores/generation-store';
import { usePromptStore } from '@/lib/stores/prompt-store';
import type { GenerationHistoryEntry } from '@/lib/stores/generation-store';
import { DEFAULT_FIBO_PROMPT } from '@/types/fibo';

// Mock the stores
vi.mock('@/lib/stores/generation-store');
vi.mock('@/lib/stores/prompt-store');

describe('HistoryTimeline', () => {
  const mockLoadTimeline = vi.fn();
  const mockRestorePrompt = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    (useGenerationStore as any).mockImplementation((selector: any) => {
      const state = {
        timeline: [],
        loadTimeline: mockLoadTimeline,
      };
      return selector ? selector(state) : state.timeline;
    });
    
    (usePromptStore as any).mockImplementation((selector: any) => {
      const state = {
        restorePrompt: mockRestorePrompt,
      };
      return selector ? selector(state) : state.restorePrompt;
    });
  });

  it('should render nothing when timeline is empty', () => {
    const { container } = render(<HistoryTimeline />);
    expect(container.firstChild).toBeNull();
  });

  it('should load timeline from localStorage on mount', () => {
    render(<HistoryTimeline />);
    expect(mockLoadTimeline).toHaveBeenCalledTimes(1);
  });

  it('should render timeline items when history exists', () => {
    const mockTimeline: GenerationHistoryEntry[] = [
      {
        id: 'gen-1',
        imageUrl: 'https://example.com/image1.jpg',
        thumbnail: 'https://example.com/image1.jpg',
        prompt: DEFAULT_FIBO_PROMPT,
        timestamp: Date.now(),
        seed: 12345,
        requestId: 'req-1',
        inARScene: false,
        gesture: 'pinch',
      },
      {
        id: 'gen-2',
        imageUrl: 'https://example.com/image2.jpg',
        thumbnail: 'https://example.com/image2.jpg',
        prompt: DEFAULT_FIBO_PROMPT,
        timestamp: Date.now(),
        seed: 67890,
        requestId: 'req-2',
        inARScene: false,
        gesture: 'fist',
      },
    ];

    (useGenerationStore as any).mockImplementation((selector: any) => {
      const state = {
        timeline: mockTimeline,
        loadTimeline: mockLoadTimeline,
      };
      return selector ? selector(state) : state.timeline;
    });

    render(<HistoryTimeline />);
    
    // Should render timeline items (2 thumbnails + 2 scroll buttons = 4 buttons)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(mockTimeline.length);
  });

  it('should restore prompt when thumbnail is clicked', () => {
    const mockPrompt = {
      ...DEFAULT_FIBO_PROMPT,
      short_description: 'test sculpture',
    };

    const mockTimeline: GenerationHistoryEntry[] = [
      {
        id: 'gen-1',
        imageUrl: 'https://example.com/image1.jpg',
        thumbnail: 'https://example.com/image1.jpg',
        prompt: mockPrompt,
        timestamp: Date.now(),
        seed: 12345,
        requestId: 'req-1',
        inARScene: false,
        gesture: 'pinch',
      },
    ];

    (useGenerationStore as any).mockImplementation((selector: any) => {
      const state = {
        timeline: mockTimeline,
        loadTimeline: mockLoadTimeline,
      };
      return selector ? selector(state) : state.timeline;
    });

    render(<HistoryTimeline />);
    
    // Click the thumbnail (not the scroll buttons)
    const buttons = screen.getAllByRole('button');
    const thumbnail = buttons.find(btn => btn.getAttribute('aria-label')?.includes('Restore'));
    fireEvent.click(thumbnail!);
    
    // Should call restorePrompt with the entry's prompt
    expect(mockRestorePrompt).toHaveBeenCalledWith(mockPrompt);
  });

  it('should not restore prompt if prompt is a string', () => {
    const mockTimeline: GenerationHistoryEntry[] = [
      {
        id: 'gen-1',
        imageUrl: 'https://example.com/image1.jpg',
        thumbnail: 'https://example.com/image1.jpg',
        prompt: 'string prompt', // String instead of object
        timestamp: Date.now(),
        seed: 12345,
        requestId: 'req-1',
        inARScene: false,
        gesture: 'pinch',
      },
    ];

    (useGenerationStore as any).mockImplementation((selector: any) => {
      const state = {
        timeline: mockTimeline,
        loadTimeline: mockLoadTimeline,
      };
      return selector ? selector(state) : state.timeline;
    });

    render(<HistoryTimeline />);
    
    // Click the thumbnail (not the scroll buttons)
    const buttons = screen.getAllByRole('button');
    const thumbnail = buttons.find(btn => btn.getAttribute('aria-label')?.includes('Restore'));
    fireEvent.click(thumbnail!);
    
    // Should NOT call restorePrompt for string prompts
    expect(mockRestorePrompt).not.toHaveBeenCalled();
  });

  it('should render scroll buttons', () => {
    const mockTimeline: GenerationHistoryEntry[] = [
      {
        id: 'gen-1',
        imageUrl: 'https://example.com/image1.jpg',
        thumbnail: 'https://example.com/image1.jpg',
        prompt: DEFAULT_FIBO_PROMPT,
        timestamp: Date.now(),
        seed: 12345,
        requestId: 'req-1',
        inARScene: false,
        gesture: 'pinch',
      },
    ];

    (useGenerationStore as any).mockImplementation((selector: any) => {
      const state = {
        timeline: mockTimeline,
        loadTimeline: mockLoadTimeline,
      };
      return selector ? selector(state) : state.timeline;
    });

    render(<HistoryTimeline />);
    
    // Should have scroll left and right buttons
    const scrollButtons = screen.getAllByRole('button', { name: /scroll/i });
    expect(scrollButtons).toHaveLength(2);
  });

  it('should display gesture icons for different gesture types', () => {
    const gestures = ['pinch', 'rotation', 'vertical', 'frame', 'fist'];
    
    gestures.forEach((gesture) => {
      const mockTimeline: GenerationHistoryEntry[] = [
        {
          id: `gen-${gesture}`,
          imageUrl: 'https://example.com/image.jpg',
          thumbnail: 'https://example.com/image.jpg',
          prompt: DEFAULT_FIBO_PROMPT,
          timestamp: Date.now(),
          seed: 12345,
          requestId: 'req-1',
          inARScene: false,
          gesture,
        },
      ];

      (useGenerationStore as any).mockImplementation((selector: any) => {
        const state = {
          timeline: mockTimeline,
          loadTimeline: mockLoadTimeline,
        };
        return selector ? selector(state) : state.timeline;
      });

      const { unmount } = render(<HistoryTimeline />);
      
      // Should render without errors
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      unmount();
    });
  });
});
