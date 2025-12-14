/**
 * Recording Controls Component Tests
 * 
 * Tests for the RecordingControls component UI and interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecordingControls } from '@/components/recording-controls';
import * as sessionRecorderModule from '@/lib/session-recorder';

// Mock the session recorder
vi.mock('@/lib/session-recorder', () => {
  const mockRecorder = {
    startRecording: vi.fn(),
    stopRecording: vi.fn(() => ({
      id: 'test-session',
      startTime: Date.now(),
      endTime: Date.now() + 1000,
      duration: 1000,
      gestures: [{ type: 'pinch', landmarks: [], timestamp: 0, absoluteTimestamp: Date.now() }],
      generations: [],
      metadata: {
        version: '1.0.0',
        userAgent: 'test',
        recordedAt: new Date().toISOString(),
      },
    })),
    isRecordingActive: vi.fn(() => false),
    getCurrentSession: vi.fn(() => null),
    startPlayback: vi.fn(),
    stopPlayback: vi.fn(),
    pausePlayback: vi.fn(),
    resumePlayback: vi.fn(),
    getPlaybackState: vi.fn(() => ({
      isPlaying: false,
      currentTime: 0,
      speed: 1.0,
      isPaused: false,
    })),
    downloadSessionJSON: vi.fn(),
    exportSessionVideo: vi.fn(() => Promise.resolve(new Blob())),
    downloadSessionVideo: vi.fn(),
  };

  return {
    getSessionRecorder: vi.fn(() => mockRecorder),
    createSessionRecorder: vi.fn(() => mockRecorder),
  };
});

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('RecordingControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Compact Mode', () => {
    it('should render in compact mode', () => {
      render(<RecordingControls compact />);
      
      // Should have minimal UI
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should show record button when not recording', () => {
      render(<RecordingControls compact />);
      
      const recordButton = screen.getByRole('button');
      expect(recordButton).toBeInTheDocument();
    });
  });

  describe('Full Mode', () => {
    it('should render with full controls', () => {
      render(<RecordingControls />);
      
      expect(screen.getByText('Record')).toBeInTheDocument();
    });

    it('should start recording when record button is clicked', () => {
      const onRecordingStart = vi.fn();
      render(<RecordingControls onRecordingStart={onRecordingStart} />);
      
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      expect(onRecordingStart).toHaveBeenCalled();
    });

    it('should show stop button when recording', async () => {
      const mockRecorder = sessionRecorderModule.getSessionRecorder();
      vi.mocked(mockRecorder.isRecordingActive).mockReturnValue(true);
      
      render(<RecordingControls />);
      
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        expect(screen.getByText('Stop')).toBeInTheDocument();
      });
    });

    it('should stop recording when stop button is clicked', async () => {
      const onRecordingStop = vi.fn();
      render(<RecordingControls onRecordingStop={onRecordingStop} />);
      
      // Start recording
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      // Stop recording
      await waitFor(() => {
        const stopButton = screen.getByText('Stop');
        fireEvent.click(stopButton);
      });
      
      await waitFor(() => {
        expect(onRecordingStop).toHaveBeenCalled();
      });
    });

    it('should show playback controls after recording', async () => {
      render(<RecordingControls />);
      
      // Start and stop recording
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        const stopButton = screen.getByText('Stop');
        fireEvent.click(stopButton);
      });
      
      // Should show play button
      await waitFor(() => {
        expect(screen.getByText('Play')).toBeInTheDocument();
      });
    });

    it('should start playback when play button is clicked', async () => {
      const onPlaybackStart = vi.fn();
      render(<RecordingControls onPlaybackStart={onPlaybackStart} />);
      
      // Record a session first
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        const stopButton = screen.getByText('Stop');
        fireEvent.click(stopButton);
      });
      
      // Play the session
      await waitFor(() => {
        const playButton = screen.getByText('Play');
        fireEvent.click(playButton);
      });
      
      await waitFor(() => {
        expect(onPlaybackStart).toHaveBeenCalled();
      });
    });

    it('should show export options after recording', async () => {
      render(<RecordingControls />);
      
      // Record a session
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        const stopButton = screen.getByText('Stop');
        fireEvent.click(stopButton);
      });
      
      // Should show export buttons
      await waitFor(() => {
        expect(screen.getByText('JSON')).toBeInTheDocument();
        expect(screen.getByText('Video')).toBeInTheDocument();
      });
    });

    it('should export JSON when JSON button is clicked', async () => {
      const mockRecorder = sessionRecorderModule.getSessionRecorder();
      render(<RecordingControls />);
      
      // Record a session
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        const stopButton = screen.getByText('Stop');
        fireEvent.click(stopButton);
      });
      
      // Export JSON
      await waitFor(() => {
        const jsonButton = screen.getByText('JSON');
        fireEvent.click(jsonButton);
      });
      
      await waitFor(() => {
        expect(mockRecorder.downloadSessionJSON).toHaveBeenCalled();
      });
    });

    it('should show playback speed slider', async () => {
      render(<RecordingControls />);
      
      // Record a session
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        const stopButton = screen.getByText('Stop');
        fireEvent.click(stopButton);
      });
      
      // Should show speed control
      await waitFor(() => {
        expect(screen.getByText('Speed:')).toBeInTheDocument();
      });
    });

    it('should disable record button during playback', async () => {
      const mockRecorder = sessionRecorderModule.getSessionRecorder();
      vi.mocked(mockRecorder.getPlaybackState).mockReturnValue({
        isPlaying: true,
        currentTime: 500,
        speed: 1.0,
        isPaused: false,
      });
      
      render(<RecordingControls />);
      
      // Record a session first
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        const stopButton = screen.getByText('Stop');
        fireEvent.click(stopButton);
      });
      
      // Start playback
      await waitFor(() => {
        const playButton = screen.getByText('Play');
        fireEvent.click(playButton);
      });
      
      // Record button should be disabled
      await waitFor(() => {
        const recordBtn = screen.getByText('Record').closest('button');
        expect(recordBtn).toBeDisabled();
      });
    });
  });

  describe('Callbacks', () => {
    it('should call onRecordingStart callback', () => {
      const onRecordingStart = vi.fn();
      render(<RecordingControls onRecordingStart={onRecordingStart} />);
      
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      expect(onRecordingStart).toHaveBeenCalled();
    });

    it('should call onRecordingStop callback with session', async () => {
      const onRecordingStop = vi.fn();
      render(<RecordingControls onRecordingStop={onRecordingStop} />);
      
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        const stopButton = screen.getByText('Stop');
        fireEvent.click(stopButton);
      });
      
      await waitFor(() => {
        expect(onRecordingStop).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'test-session',
            gestures: expect.any(Array),
            generations: expect.any(Array),
          })
        );
      });
    });

    it('should call onPlaybackStart callback', async () => {
      const onPlaybackStart = vi.fn();
      render(<RecordingControls onPlaybackStart={onPlaybackStart} />);
      
      // Record a session
      const recordButton = screen.getByText('Record');
      fireEvent.click(recordButton);
      
      await waitFor(() => {
        const stopButton = screen.getByText('Stop');
        fireEvent.click(stopButton);
      });
      
      // Start playback
      await waitFor(() => {
        const playButton = screen.getByText('Play');
        fireEvent.click(playButton);
      });
      
      await waitFor(() => {
        expect(onPlaybackStart).toHaveBeenCalled();
      });
    });
  });
});
