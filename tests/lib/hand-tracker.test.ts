/**
 * Unit tests for HandTracker
 * 
 * Tests the HandTracker class functionality including initialization,
 * detection loop management, and error handling.
 * 
 * Requirements: 3.1, 3.2, 3.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  HandTracker,
  LANDMARK_INDICES,
  getHandTrackerErrorMessage,
  type HandTrackerError,
} from '@/lib/hand-tracker';

// Mock the MediaPipe tasks-vision module
// Note: vi.mock is hoisted, so we can't reference external variables
vi.mock('@mediapipe/tasks-vision', () => {
  const mockDetectForVideo = vi.fn();
  const mockClose = vi.fn();
  
  return {
    FilesetResolver: {
      forVisionTasks: vi.fn().mockResolvedValue({}),
    },
    HandLandmarker: {
      createFromOptions: vi.fn().mockResolvedValue({
        detectForVideo: mockDetectForVideo,
        close: mockClose,
        setOptions: vi.fn(),
        detect: vi.fn(),
      }),
    },
    // Export mocks for test access
    __mocks__: {
      mockDetectForVideo,
      mockClose,
    },
  };
});

// Get access to the mocks
let mockDetectForVideo: ReturnType<typeof vi.fn>;
let mockClose: ReturnType<typeof vi.fn>;

describe('HandTracker', () => {
  let handTracker: HandTracker;
  let mockVideoElement: HTMLVideoElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    
    // Get the mocks from the module
    const mediapipe = await import('@mediapipe/tasks-vision');
    const mocks = (mediapipe as unknown as { __mocks__: { mockDetectForVideo: ReturnType<typeof vi.fn>; mockClose: ReturnType<typeof vi.fn> } }).__mocks__;
    mockDetectForVideo = mocks.mockDetectForVideo;
    mockClose = mocks.mockClose;
    
    // Reset mocks
    mockDetectForVideo.mockReset();
    mockClose.mockReset();
    
    // Create mock video element
    // HAVE_ENOUGH_DATA = 4, HAVE_CURRENT_DATA = 2
    mockVideoElement = {
      readyState: 4,  // HTMLMediaElement.HAVE_ENOUGH_DATA
      currentTime: 0,
    } as unknown as HTMLVideoElement;

    handTracker = new HandTracker();
  });

  afterEach(() => {
    handTracker.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const tracker = new HandTracker();
      expect(tracker).toBeInstanceOf(HandTracker);
      expect(tracker.isInitialized()).toBe(false);
      expect(tracker.isDetecting()).toBe(false);
    });

    it('should create instance with custom options', () => {
      const tracker = new HandTracker({
        numHands: 1,
        minDetectionConfidence: 0.7,
        minPresenceConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });
      expect(tracker).toBeInstanceOf(HandTracker);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with MediaPipe', async () => {
      await handTracker.initialize();
      expect(handTracker.isInitialized()).toBe(true);
    });

    it('should throw error when WASM loading fails', async () => {
      const { FilesetResolver } = await import('@mediapipe/tasks-vision');
      vi.mocked(FilesetResolver.forVisionTasks).mockRejectedValueOnce(
        new Error('Failed to load WASM fileset')
      );

      const tracker = new HandTracker();
      await expect(tracker.initialize()).rejects.toMatchObject({
        type: 'wasm_load_failed',
        message: expect.stringContaining('WASM'),
      });
    });

    it('should throw error when model loading fails', async () => {
      const { HandLandmarker } = await import('@mediapipe/tasks-vision');
      vi.mocked(HandLandmarker.createFromOptions).mockRejectedValueOnce(
        new Error('Failed to load model asset')
      );

      const tracker = new HandTracker();
      await expect(tracker.initialize()).rejects.toMatchObject({
        type: 'model_load_failed',
        message: expect.stringContaining('model'),
      });
    });
  });

  describe('startDetection', () => {
    it('should throw error when not initialized', () => {
      const callback = vi.fn();
      expect(() => handTracker.startDetection(mockVideoElement, callback)).toThrow();
    });

    it('should start detection after initialization', async () => {
      await handTracker.initialize();
      const callback = vi.fn();
      
      handTracker.startDetection(mockVideoElement, callback);
      expect(handTracker.isDetecting()).toBe(true);
    });

    it('should throw error when already running', async () => {
      await handTracker.initialize();
      const callback = vi.fn();
      
      handTracker.startDetection(mockVideoElement, callback);
      
      expect(() => handTracker.startDetection(mockVideoElement, callback)).toThrow();
    });

    it('should throw error with invalid video element', async () => {
      await handTracker.initialize();
      const callback = vi.fn();
      
      expect(() => handTracker.startDetection(null as unknown as HTMLVideoElement, callback)).toThrow();
    });
  });

  describe('stopDetection', () => {
    it('should stop detection when running', async () => {
      await handTracker.initialize();
      const callback = vi.fn();
      
      handTracker.startDetection(mockVideoElement, callback);
      expect(handTracker.isDetecting()).toBe(true);
      
      handTracker.stopDetection();
      expect(handTracker.isDetecting()).toBe(false);
    });

    it('should handle stop when not running', () => {
      expect(() => handTracker.stopDetection()).not.toThrow();
      expect(handTracker.isDetecting()).toBe(false);
    });
  });

  describe('setDetectionRate', () => {
    it('should set detection rate within valid range', () => {
      handTracker.setDetectionRate(15);
      expect(handTracker.getDetectionRate()).toBe(15);
    });

    it('should clamp detection rate to minimum (10 FPS)', () => {
      handTracker.setDetectionRate(5);
      expect(handTracker.getDetectionRate()).toBe(10);
    });

    it('should clamp detection rate to maximum (30 FPS)', () => {
      handTracker.setDetectionRate(60);
      expect(handTracker.getDetectionRate()).toBe(30);
    });

    it('should restart detection with new rate when running', async () => {
      await handTracker.initialize();
      const callback = vi.fn();
      
      handTracker.startDetection(mockVideoElement, callback);
      handTracker.setDetectionRate(25);
      
      expect(handTracker.isDetecting()).toBe(true);
      expect(handTracker.getDetectionRate()).toBe(25);
    });
  });

  describe('getDetectionRate', () => {
    it('should return default rate (20 FPS)', () => {
      expect(handTracker.getDetectionRate()).toBe(20);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', async () => {
      await handTracker.initialize();
      const callback = vi.fn();
      
      handTracker.startDetection(mockVideoElement, callback);
      handTracker.dispose();
      
      expect(handTracker.isDetecting()).toBe(false);
      expect(handTracker.isInitialized()).toBe(false);
    });

    it('should handle dispose when not initialized', () => {
      expect(() => handTracker.dispose()).not.toThrow();
    });
  });

  describe('detection callback', () => {
    it('should call callback with detection results', async () => {
      mockDetectForVideo.mockReturnValue({
        landmarks: [[
          { x: 0.5, y: 0.5, z: 0 },
          { x: 0.6, y: 0.4, z: 0.1 },
        ]],
        worldLandmarks: [[
          { x: 0.05, y: 0.05, z: 0 },
          { x: 0.06, y: 0.04, z: 0.01 },
        ]],
        handednesses: [[{ categoryName: 'Right', score: 0.95 }]],
      });

      await handTracker.initialize();
      
      const callback = vi.fn();
      handTracker.startDetection(mockVideoElement, callback);
      
      // Advance time to trigger detection
      mockVideoElement.currentTime = 0.1;
      vi.advanceTimersByTime(50);
      
      expect(callback).toHaveBeenCalled();
    });

    it('should return empty array when no hands detected', async () => {
      mockDetectForVideo.mockReturnValue({
        landmarks: [],
        worldLandmarks: [],
        handednesses: [],
      });

      await handTracker.initialize();
      
      const callback = vi.fn();
      handTracker.startDetection(mockVideoElement, callback);
      
      // Advance time to trigger detection
      mockVideoElement.currentTime = 0.1;
      vi.advanceTimersByTime(50);
      
      expect(callback).toHaveBeenCalledWith([]);
    });

    it('should skip processing when video frame has not changed', async () => {
      mockDetectForVideo.mockReturnValue({
        landmarks: [],
        worldLandmarks: [],
        handednesses: [],
      });

      await handTracker.initialize();
      
      const callback = vi.fn();
      handTracker.startDetection(mockVideoElement, callback);
      
      // First frame
      mockVideoElement.currentTime = 0.1;
      vi.advanceTimersByTime(50);
      
      // Same frame (currentTime unchanged)
      vi.advanceTimersByTime(50);
      
      // Should only be called once since frame didn't change
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});

describe('LANDMARK_INDICES', () => {
  it('should have correct wrist index', () => {
    expect(LANDMARK_INDICES.WRIST).toBe(0);
  });

  it('should have correct thumb tip index', () => {
    expect(LANDMARK_INDICES.THUMB_TIP).toBe(4);
  });

  it('should have correct index finger tip index', () => {
    expect(LANDMARK_INDICES.INDEX_FINGER_TIP).toBe(8);
  });

  it('should have correct middle finger MCP index', () => {
    expect(LANDMARK_INDICES.MIDDLE_FINGER_MCP).toBe(9);
  });

  it('should have correct pinky tip index', () => {
    expect(LANDMARK_INDICES.PINKY_TIP).toBe(20);
  });
});

describe('getHandTrackerErrorMessage', () => {
  it('should return appropriate message for model_load_failed', () => {
    const error: HandTrackerError = {
      type: 'model_load_failed',
      message: 'Model failed',
    };
    expect(getHandTrackerErrorMessage(error)).toContain('model');
  });

  it('should return appropriate message for wasm_load_failed', () => {
    const error: HandTrackerError = {
      type: 'wasm_load_failed',
      message: 'WASM failed',
    };
    expect(getHandTrackerErrorMessage(error)).toContain('components');
  });

  it('should return appropriate message for not_initialized', () => {
    const error: HandTrackerError = {
      type: 'not_initialized',
      message: 'Not initialized',
    };
    expect(getHandTrackerErrorMessage(error)).toContain('not ready');
  });

  it('should return appropriate message for already_running', () => {
    const error: HandTrackerError = {
      type: 'already_running',
      message: 'Already running',
    };
    expect(getHandTrackerErrorMessage(error)).toContain('already active');
  });

  it('should return appropriate message for invalid_video', () => {
    const error: HandTrackerError = {
      type: 'invalid_video',
      message: 'Invalid video',
    };
    expect(getHandTrackerErrorMessage(error)).toContain('video');
  });

  it('should return error message for unknown type', () => {
    const error: HandTrackerError = {
      type: 'unknown',
      message: 'Something went wrong',
    };
    expect(getHandTrackerErrorMessage(error)).toBe('Something went wrong');
  });
});
