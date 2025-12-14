/**
 * Session Recorder
 * 
 * Captures gesture events and generation results with timestamps for playback:
 * - Records gesture sequences with hand landmarks
 * - Records generation results with prompts
 * - Supports playback as timelapse animation
 * - Exports recordings as MP4 video using MediaRecorder API
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type { HandLandmark } from './hand-tracker';
import type { GenerationResult } from './bria-client';
import type { FIBOStructuredPrompt } from '@/types/fibo';
import { logInfo, logError, logWarning } from './error-logger';

// ============ Types ============

/**
 * Gesture event types that can be recorded
 */
export type GestureType = 
  | 'pinch'
  | 'wrist_rotation'
  | 'vertical_movement'
  | 'two_hand_frame'
  | 'fist_to_open'
  | 'hand_detected'
  | 'hand_lost';

/**
 * Recorded gesture event
 */
export interface RecordedGesture {
  /** Type of gesture */
  type: GestureType;
  /** Hand landmarks at time of gesture */
  landmarks: HandLandmark[];
  /** Timestamp in milliseconds since recording started */
  timestamp: number;
  /** Absolute timestamp */
  absoluteTimestamp: number;
  /** Handedness (Left or Right) */
  handedness?: 'Left' | 'Right';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Recorded generation event
 */
export interface RecordedGeneration {
  /** Generated image URL */
  imageUrl: string;
  /** FIBO prompt used for generation */
  prompt: FIBOStructuredPrompt | string;
  /** Timestamp in milliseconds since recording started */
  timestamp: number;
  /** Absolute timestamp */
  absoluteTimestamp: number;
  /** Seed used for generation */
  seed?: number;
  /** Request ID */
  requestId?: string;
}

/**
 * Complete recording session data
 */
export interface RecordingSession {
  /** Unique session ID */
  id: string;
  /** Session start timestamp */
  startTime: number;
  /** Session end timestamp */
  endTime: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Recorded gestures */
  gestures: RecordedGesture[];
  /** Recorded generations */
  generations: RecordedGeneration[];
  /** Session metadata */
  metadata: {
    version: string;
    userAgent: string;
    recordedAt: string;
  };
}

/**
 * Playback state
 */
export interface PlaybackState {
  /** Whether playback is active */
  isPlaying: boolean;
  /** Current playback position in milliseconds */
  currentTime: number;
  /** Playback speed multiplier (1.0 = normal, 2.0 = 2x speed) */
  speed: number;
  /** Whether playback is paused */
  isPaused: boolean;
}

/**
 * Playback event callback types
 */
export type PlaybackEventType = 'gesture' | 'generation' | 'complete';

export interface PlaybackEvent {
  type: PlaybackEventType;
  data: RecordedGesture | RecordedGeneration;
  timestamp: number;
}

export type PlaybackCallback = (event: PlaybackEvent) => void;

/**
 * Video export options
 */
export interface VideoExportOptions {
  /** Video width in pixels */
  width?: number;
  /** Video height in pixels */
  height?: number;
  /** Video bitrate */
  videoBitsPerSecond?: number;
  /** MIME type for video */
  mimeType?: string;
  /** Playback speed for export */
  speed?: number;
}

// ============ Constants ============

/** Recording version for compatibility */
const RECORDING_VERSION = '1.0.0';

/** Default video export options */
const DEFAULT_VIDEO_OPTIONS: Required<VideoExportOptions> = {
  width: 1280,
  height: 720,
  videoBitsPerSecond: 2500000, // 2.5 Mbps
  mimeType: 'video/webm;codecs=vp9',
  speed: 2.0, // 2x speed for timelapse
};

// ============ Error Classes ============

export class RecorderError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'RecorderError';
  }
}

// ============ Session Recorder Class ============

/**
 * Session Recorder
 * 
 * Manages recording and playback of gesture sculpting sessions
 */
export class SessionRecorder {
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private currentSession: RecordingSession | null = null;
  private gestures: RecordedGesture[] = [];
  private generations: RecordedGeneration[] = [];
  
  // Playback state
  private playbackState: PlaybackState = {
    isPlaying: false,
    currentTime: 0,
    speed: 1.0,
    isPaused: false,
  };
  private playbackInterval: ReturnType<typeof setInterval> | null = null;
  private playbackCallback: PlaybackCallback | null = null;
  private playbackSession: RecordingSession | null = null;
  private playbackEventIndex: number = 0;

  /**
   * Start recording a new session
   */
  startRecording(): void {
    if (this.isRecording) {
      logWarning('Recording already in progress', {
        component: 'SessionRecorder',
        action: 'startRecording',
      });
      return;
    }

    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.gestures = [];
    this.generations = [];

    logInfo('Started recording session', {
      component: 'SessionRecorder',
      action: 'startRecording',
      metadata: {
        startTime: this.recordingStartTime,
      },
    });
  }

  /**
   * Stop recording and finalize the session
   * 
   * @returns The completed recording session
   */
  stopRecording(): RecordingSession {
    if (!this.isRecording) {
      throw new RecorderError('No recording in progress', 'NOT_RECORDING');
    }

    const endTime = Date.now();
    const duration = endTime - this.recordingStartTime;

    this.currentSession = {
      id: this.generateSessionId(),
      startTime: this.recordingStartTime,
      endTime,
      duration,
      gestures: [...this.gestures],
      generations: [...this.generations],
      metadata: {
        version: RECORDING_VERSION,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        recordedAt: new Date(this.recordingStartTime).toISOString(),
      },
    };

    this.isRecording = false;

    logInfo('Stopped recording session', {
      component: 'SessionRecorder',
      action: 'stopRecording',
      metadata: {
        duration,
        gestureCount: this.gestures.length,
        generationCount: this.generations.length,
      },
    });

    return this.currentSession;
  }

  /**
   * Record a gesture event
   * 
   * @param type - Type of gesture
   * @param landmarks - Hand landmarks
   * @param handedness - Which hand (Left or Right)
   * @param metadata - Additional metadata
   */
  recordGesture(
    type: GestureType,
    landmarks: HandLandmark[],
    handedness?: 'Left' | 'Right',
    metadata?: Record<string, unknown>
  ): void {
    if (!this.isRecording) {
      return;
    }

    const now = Date.now();
    const relativeTimestamp = now - this.recordingStartTime;

    const gesture: RecordedGesture = {
      type,
      landmarks: [...landmarks], // Deep copy
      timestamp: relativeTimestamp,
      absoluteTimestamp: now,
      handedness,
      metadata,
    };

    this.gestures.push(gesture);
  }

  /**
   * Record a generation event
   * 
   * @param result - Generation result
   */
  recordGeneration(result: GenerationResult): void {
    if (!this.isRecording) {
      return;
    }

    const now = Date.now();
    const relativeTimestamp = now - this.recordingStartTime;

    const generation: RecordedGeneration = {
      imageUrl: result.imageUrl,
      prompt: result.prompt,
      timestamp: relativeTimestamp,
      absoluteTimestamp: now,
      seed: result.seed,
      requestId: result.requestId,
    };

    this.generations.push(generation);

    logInfo('Recorded generation', {
      component: 'SessionRecorder',
      action: 'recordGeneration',
      metadata: {
        timestamp: relativeTimestamp,
        requestId: result.requestId,
      },
    });
  }

  /**
   * Check if currently recording
   */
  isRecordingActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get the current session (if recording stopped)
   */
  getCurrentSession(): RecordingSession | null {
    return this.currentSession;
  }

  /**
   * Start playback of a recorded session
   * 
   * @param session - Session to play back
   * @param callback - Callback for playback events
   * @param speed - Playback speed multiplier (default: 1.0)
   */
  startPlayback(
    session: RecordingSession,
    callback: PlaybackCallback,
    speed: number = 1.0
  ): void {
    if (this.playbackState.isPlaying) {
      this.stopPlayback();
    }

    this.playbackSession = session;
    this.playbackCallback = callback;
    this.playbackState = {
      isPlaying: true,
      currentTime: 0,
      speed,
      isPaused: false,
    };
    this.playbackEventIndex = 0;

    // Merge and sort all events by timestamp
    const allEvents = this.mergeEvents(session);

    // Start playback loop
    const intervalMs = 16; // ~60 FPS update rate
    this.playbackInterval = setInterval(() => {
      if (this.playbackState.isPaused) {
        return;
      }

      // Advance playback time
      this.playbackState.currentTime += intervalMs * this.playbackState.speed;

      // Process events that should have occurred by now
      while (
        this.playbackEventIndex < allEvents.length &&
        allEvents[this.playbackEventIndex].timestamp <= this.playbackState.currentTime
      ) {
        const event = allEvents[this.playbackEventIndex];
        
        if (this.playbackCallback) {
          this.playbackCallback(event);
        }

        this.playbackEventIndex++;
      }

      // Check if playback is complete
      if (this.playbackState.currentTime >= session.duration) {
        this.stopPlayback();
        
        if (this.playbackCallback) {
          this.playbackCallback({
            type: 'complete',
            data: {} as RecordedGesture, // Placeholder
            timestamp: session.duration,
          });
        }
      }
    }, intervalMs);

    logInfo('Started playback', {
      component: 'SessionRecorder',
      action: 'startPlayback',
      metadata: {
        duration: session.duration,
        speed,
        eventCount: allEvents.length,
      },
    });
  }

  /**
   * Stop playback
   */
  stopPlayback(): void {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }

    this.playbackState.isPlaying = false;
    this.playbackCallback = null;
    this.playbackSession = null;

    logInfo('Stopped playback', {
      component: 'SessionRecorder',
      action: 'stopPlayback',
    });
  }

  /**
   * Pause playback
   */
  pausePlayback(): void {
    if (!this.playbackState.isPlaying) {
      return;
    }

    this.playbackState.isPaused = true;
  }

  /**
   * Resume playback
   */
  resumePlayback(): void {
    if (!this.playbackState.isPlaying) {
      return;
    }

    this.playbackState.isPaused = false;
  }

  /**
   * Get current playback state
   */
  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Export session as JSON
   * 
   * @param session - Session to export
   * @returns JSON string
   */
  exportSessionJSON(session: RecordingSession): string {
    return JSON.stringify(session, null, 2);
  }

  /**
   * Import session from JSON
   * 
   * @param json - JSON string
   * @returns Parsed session
   */
  importSessionJSON(json: string): RecordingSession {
    try {
      const session = JSON.parse(json) as RecordingSession;
      
      // Validate session structure
      if (!session.id || !session.gestures || !session.generations) {
        throw new Error('Invalid session structure');
      }

      return session;
    } catch (error) {
      throw new RecorderError(
        `Failed to import session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'IMPORT_FAILED'
      );
    }
  }

  /**
   * Export session as MP4 video using MediaRecorder API
   * 
   * @param session - Session to export
   * @param canvas - Canvas element to record from
   * @param options - Video export options
   * @returns Promise that resolves when export is complete
   */
  async exportSessionVideo(
    session: RecordingSession,
    canvas: HTMLCanvasElement,
    options: VideoExportOptions = {}
  ): Promise<Blob> {
    const opts = { ...DEFAULT_VIDEO_OPTIONS, ...options };

    // Check MediaRecorder support
    if (!MediaRecorder.isTypeSupported(opts.mimeType)) {
      // Fallback to webm with vp8
      opts.mimeType = 'video/webm;codecs=vp8';
      
      if (!MediaRecorder.isTypeSupported(opts.mimeType)) {
        throw new RecorderError(
          'MediaRecorder not supported in this browser',
          'MEDIARECORDER_NOT_SUPPORTED'
        );
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const stream = canvas.captureStream(30); // 30 FPS
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: opts.mimeType,
          videoBitsPerSecond: opts.videoBitsPerSecond,
        });

        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: opts.mimeType });
          resolve(blob);
        };

        mediaRecorder.onerror = (event) => {
          reject(new RecorderError(
            `MediaRecorder error: ${event}`,
            'MEDIARECORDER_ERROR'
          ));
        };

        // Start recording
        mediaRecorder.start();

        // Play back the session and stop recording when complete
        this.startPlayback(
          session,
          () => {
            // Playback callback - canvas should be updated externally
          },
          opts.speed
        );

        // Stop recording when playback completes
        const checkComplete = setInterval(() => {
          if (!this.playbackState.isPlaying) {
            clearInterval(checkComplete);
            mediaRecorder.stop();
          }
        }, 100);

      } catch (error) {
        reject(new RecorderError(
          `Failed to export video: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'VIDEO_EXPORT_FAILED'
        ));
      }
    });
  }

  /**
   * Download session as JSON file
   * 
   * @param session - Session to download
   * @param filename - Optional filename
   */
  downloadSessionJSON(session: RecordingSession, filename?: string): void {
    const json = this.exportSessionJSON(session);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || this.generateFilename(session, 'json');
    anchor.style.display = 'none';
    
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /**
   * Download session as video file
   * 
   * @param videoBlob - Video blob from exportSessionVideo
   * @param session - Session metadata for filename
   * @param filename - Optional filename
   */
  downloadSessionVideo(
    videoBlob: Blob,
    session: RecordingSession,
    filename?: string
  ): void {
    const url = URL.createObjectURL(videoBlob);
    
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || this.generateFilename(session, 'webm');
    anchor.style.display = 'none';
    
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  // ============ Private Helper Methods ============

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Merge gestures and generations into a single sorted event list
   */
  private mergeEvents(session: RecordingSession): PlaybackEvent[] {
    const events: PlaybackEvent[] = [];

    // Add gesture events
    for (const gesture of session.gestures) {
      events.push({
        type: 'gesture',
        data: gesture,
        timestamp: gesture.timestamp,
      });
    }

    // Add generation events
    for (const generation of session.generations) {
      events.push({
        type: 'generation',
        data: generation,
        timestamp: generation.timestamp,
      });
    }

    // Sort by timestamp
    events.sort((a, b) => a.timestamp - b.timestamp);

    return events;
  }

  /**
   * Generate filename for session export
   */
  private generateFilename(session: RecordingSession, extension: string): string {
    const date = new Date(session.startTime);
    const timestamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0'),
    ].join('-');
    
    return `sculptnet-session-${timestamp}.${extension}`;
  }
}

// ============ Singleton Instance ============

let defaultRecorder: SessionRecorder | null = null;

/**
 * Get the default session recorder instance
 */
export function getSessionRecorder(): SessionRecorder {
  if (!defaultRecorder) {
    defaultRecorder = new SessionRecorder();
  }
  return defaultRecorder;
}

/**
 * Create a new session recorder instance
 */
export function createSessionRecorder(): SessionRecorder {
  return new SessionRecorder();
}
