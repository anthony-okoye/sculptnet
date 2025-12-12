/**
 * WebcamManager - Manages webcam stream access for MediaPipe processing
 * 
 * Handles initialization, stream management, and error handling for webcam access.
 * Creates a hidden video element suitable for MediaPipe hand tracking.
 * Automatically optimizes resolution for mobile devices.
 * 
 * Requirements: 2.1, 3.1, 10.5, 4.4
 */

import { getRecommendedWebcamResolution } from './mobile-utils';
import { logError, logInfo, logWarning } from './error-logger';

export type WebcamErrorType = 
  | 'permission_denied'
  | 'camera_not_found'
  | 'https_required'
  | 'overconstrained'
  | 'unknown';

export interface WebcamError {
  type: WebcamErrorType;
  message: string;
  originalError?: Error;
}

export interface WebcamManagerOptions {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
  autoOptimizeForMobile?: boolean;
}

const DEFAULT_OPTIONS: Required<WebcamManagerOptions> = {
  width: 1280,
  height: 720,
  facingMode: 'user',
  autoOptimizeForMobile: true,
};

export class WebcamManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private active: boolean = false;
  private options: Required<WebcamManagerOptions>;

  constructor(options: WebcamManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    // Auto-optimize resolution for mobile if enabled
    if (this.options.autoOptimizeForMobile) {
      const recommended = getRecommendedWebcamResolution();
      this.options.width = options.width || recommended.width;
      this.options.height = options.height || recommended.height;
    }
  }

  /**
   * Initialize the webcam stream and create a hidden video element
   * @returns Promise resolving to the MediaStream
   * @throws WebcamError if initialization fails
   */
  async initialize(): Promise<MediaStream> {
    // Check for HTTPS requirement (getUserMedia requires secure context)
    if (!this.isSecureContext()) {
      throw this.createError('https_required', 'Webcam access requires HTTPS or localhost');
    }

    // Check for getUserMedia support
    if (!navigator.mediaDevices?.getUserMedia) {
      throw this.createError('unknown', 'getUserMedia is not supported in this browser');
    }

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: this.options.width },
        height: { ideal: this.options.height },
        facingMode: this.options.facingMode,
      },
      audio: false,
    };
    
    logInfo('Initializing webcam', {
      component: 'WebcamManager',
      action: 'initialize',
      metadata: {
        width: this.options.width,
        height: this.options.height,
        facingMode: this.options.facingMode,
      },
    });

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement = this.createVideoElement();
      this.videoElement.srcObject = this.stream;
      
      // Wait for video to be ready
      await this.waitForVideoReady();
      
      this.active = true;
      logInfo('Webcam initialized successfully', {
        component: 'WebcamManager',
        action: 'initialize',
      });
      return this.stream;
    } catch (error) {
      const webcamError = this.handleGetUserMediaError(error);
      logError('Webcam initialization failed', webcamError.originalError, {
        component: 'WebcamManager',
        action: 'initialize',
        metadata: {
          errorType: webcamError.type,
          message: webcamError.message,
        },
      });
      throw webcamError;
    }
  }

  /**
   * Get the video element for MediaPipe processing
   * @returns The HTMLVideoElement or null if not initialized
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  /**
   * Stop the webcam stream and clean up resources
   */
  stop(): void {
    try {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      if (this.videoElement) {
        this.videoElement.srcObject = null;
        this.videoElement.remove();
        this.videoElement = null;
      }

      this.active = false;
      logInfo('Webcam stopped successfully', {
        component: 'WebcamManager',
        action: 'stop',
      });
    } catch (error) {
      logWarning('Error stopping webcam', {
        component: 'WebcamManager',
        action: 'stop',
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Check if the webcam is currently active
   * @returns true if webcam is active and streaming
   */
  isActive(): boolean {
    return this.active && this.stream !== null;
  }

  /**
   * Get the current MediaStream
   * @returns The MediaStream or null if not initialized
   */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Check if running in a secure context (HTTPS or localhost)
   */
  private isSecureContext(): boolean {
    // In browser environment
    if (typeof window !== 'undefined') {
      return window.isSecureContext;
    }
    // For SSR/testing, assume secure
    return true;
  }

  /**
   * Create a hidden video element for MediaPipe processing
   */
  private createVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.muted = true;
    
    // Hide the video element - it's only for MediaPipe processing
    video.style.position = 'absolute';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = `${this.options.width}px`;
    video.style.height = `${this.options.height}px`;
    
    document.body.appendChild(video);
    return video;
  }

  /**
   * Wait for the video element to be ready for processing
   */
  private waitForVideoReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.videoElement) {
        reject(new Error('Video element not created'));
        return;
      }

      const video = this.videoElement;

      // If already ready
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        video.play().then(resolve).catch(reject);
        return;
      }

      const onLoadedData = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('error', onError);
        video.play().then(resolve).catch(reject);
      };

      const onError = () => {
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('error', onError);
        reject(new Error('Video element failed to load'));
      };

      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('error', onError);
    });
  }

  /**
   * Handle getUserMedia errors and convert to WebcamError
   */
  private handleGetUserMediaError(error: unknown): WebcamError {
    if (!(error instanceof Error)) {
      return this.createError('unknown', 'An unknown error occurred', new Error(String(error)));
    }

    const errorName = error.name;
    const errorMessage = error.message;

    // Permission denied
    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      return this.createError(
        'permission_denied',
        'Camera access was denied. Please allow camera permissions and try again.',
        error
      );
    }

    // Camera not found
    if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      return this.createError(
        'camera_not_found',
        'No camera was found. Please connect a camera and try again.',
        error
      );
    }

    // Overconstrained (requested resolution not available)
    if (errorName === 'OverconstrainedError') {
      return this.createError(
        'overconstrained',
        `Camera does not support the requested settings: ${errorMessage}`,
        error
      );
    }

    // Security error (usually HTTPS related)
    if (errorName === 'SecurityError') {
      return this.createError(
        'https_required',
        'Webcam access requires a secure connection (HTTPS).',
        error
      );
    }

    // Unknown error
    return this.createError('unknown', errorMessage || 'Failed to access webcam', error);
  }

  /**
   * Create a WebcamError object
   */
  private createError(type: WebcamErrorType, message: string, originalError?: Error): WebcamError {
    return {
      type,
      message,
      originalError,
    };
  }
}

/**
 * Check if webcam is available in the current environment
 * @returns true if getUserMedia is supported
 */
export function isWebcamSupported(): boolean {
  return !!(navigator.mediaDevices?.getUserMedia);
}

/**
 * Get user-friendly error message for display
 */
export function getWebcamErrorMessage(error: WebcamError): string {
  switch (error.type) {
    case 'permission_denied':
      return 'Camera access denied. Please enable camera permissions in your browser settings.';
    case 'camera_not_found':
      return 'No camera detected. Please connect a camera and refresh the page.';
    case 'https_required':
      return 'Camera access requires a secure connection. Please use HTTPS.';
    case 'overconstrained':
      return 'Your camera does not support the required settings. Try a different camera.';
    default:
      return error.message || 'An error occurred while accessing the camera.';
  }
}
