/**
 * Unit tests for WebcamManager
 * 
 * Tests the WebcamManager class functionality including initialization,
 * error handling, and state management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  WebcamManager, 
  isWebcamSupported, 
  getWebcamErrorMessage,
  type WebcamError 
} from '@/lib/webcam-manager';

describe('WebcamManager', () => {
  let webcamManager: WebcamManager;
  let mockStream: MediaStream;
  let mockTrack: MediaStreamTrack;

  beforeEach(() => {
    // Create mock track
    mockTrack = {
      stop: vi.fn(),
      kind: 'video',
      enabled: true,
    } as unknown as MediaStreamTrack;

    // Create mock stream
    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    // Mock secure context
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
    });

    webcamManager = new WebcamManager();
  });

  afterEach(() => {
    webcamManager.stop();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const manager = new WebcamManager();
      expect(manager).toBeInstanceOf(WebcamManager);
      expect(manager.isActive()).toBe(false);
    });

    it('should create instance with custom options', () => {
      const manager = new WebcamManager({
        width: 640,
        height: 480,
        facingMode: 'environment',
      });
      expect(manager).toBeInstanceOf(WebcamManager);
    });
  });

  describe('isActive', () => {
    it('should return false before initialization', () => {
      expect(webcamManager.isActive()).toBe(false);
    });
  });

  describe('getVideoElement', () => {
    it('should return null before initialization', () => {
      expect(webcamManager.getVideoElement()).toBeNull();
    });
  });

  describe('getStream', () => {
    it('should return null before initialization', () => {
      expect(webcamManager.getStream()).toBeNull();
    });
  });

  describe('stop', () => {
    it('should handle stop when not initialized', () => {
      // Should not throw
      expect(() => webcamManager.stop()).not.toThrow();
      expect(webcamManager.isActive()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should throw error when getUserMedia is not supported', async () => {
      // Remove getUserMedia
      const originalMediaDevices = navigator.mediaDevices;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      });

      try {
        await expect(webcamManager.initialize()).rejects.toMatchObject({
          type: 'unknown',
          message: expect.stringContaining('not supported'),
        });
      } finally {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: originalMediaDevices,
          configurable: true,
        });
      }
    });

    it('should throw https_required error in insecure context', async () => {
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        writable: true,
      });

      await expect(webcamManager.initialize()).rejects.toMatchObject({
        type: 'https_required',
        message: expect.stringContaining('HTTPS'),
      });
    });

    it('should handle permission denied error', async () => {
      const permissionError = new Error('Permission denied');
      permissionError.name = 'NotAllowedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(permissionError),
        },
        configurable: true,
      });

      await expect(webcamManager.initialize()).rejects.toMatchObject({
        type: 'permission_denied',
        message: expect.stringContaining('denied'),
      });
    });

    it('should handle camera not found error', async () => {
      const notFoundError = new Error('No camera found');
      notFoundError.name = 'NotFoundError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(notFoundError),
        },
        configurable: true,
      });

      await expect(webcamManager.initialize()).rejects.toMatchObject({
        type: 'camera_not_found',
        message: expect.stringContaining('camera'),
      });
    });

    it('should handle overconstrained error', async () => {
      const overconstrainedError = new Error('Resolution not supported');
      overconstrainedError.name = 'OverconstrainedError';

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockRejectedValue(overconstrainedError),
        },
        configurable: true,
      });

      await expect(webcamManager.initialize()).rejects.toMatchObject({
        type: 'overconstrained',
      });
    });
  });
});

describe('isWebcamSupported', () => {
  it('should return true when getUserMedia is available', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(),
      },
      configurable: true,
    });

    expect(isWebcamSupported()).toBe(true);
  });

  it('should return false when mediaDevices is undefined', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });

    expect(isWebcamSupported()).toBe(false);
  });
});

describe('getWebcamErrorMessage', () => {
  it('should return appropriate message for permission_denied', () => {
    const error: WebcamError = {
      type: 'permission_denied',
      message: 'Permission denied',
    };
    expect(getWebcamErrorMessage(error)).toContain('permission');
  });

  it('should return appropriate message for camera_not_found', () => {
    const error: WebcamError = {
      type: 'camera_not_found',
      message: 'No camera',
    };
    expect(getWebcamErrorMessage(error)).toContain('camera');
  });

  it('should return appropriate message for https_required', () => {
    const error: WebcamError = {
      type: 'https_required',
      message: 'HTTPS required',
    };
    expect(getWebcamErrorMessage(error)).toContain('HTTPS');
  });

  it('should return appropriate message for overconstrained', () => {
    const error: WebcamError = {
      type: 'overconstrained',
      message: 'Overconstrained',
    };
    expect(getWebcamErrorMessage(error)).toContain('camera');
  });

  it('should return error message for unknown type', () => {
    const error: WebcamError = {
      type: 'unknown',
      message: 'Something went wrong',
    };
    expect(getWebcamErrorMessage(error)).toBe('Something went wrong');
  });
});
