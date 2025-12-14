/**
 * Session Recorder Tests
 * 
 * Tests for the SessionRecorder class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SessionRecorder,
  createSessionRecorder,
  getSessionRecorder,
  type RecordedGesture,
  type RecordingSession,
} from '@/lib/session-recorder';
import type { HandLandmark } from '@/lib/hand-tracker';
import type { GenerationResult } from '@/lib/bria-client';

describe('SessionRecorder', () => {
  let recorder: SessionRecorder;

  beforeEach(() => {
    recorder = createSessionRecorder();
  });

  describe('Recording', () => {
    it('should start recording', () => {
      recorder.startRecording();
      expect(recorder.isRecordingActive()).toBe(true);
    });

    it('should not start recording if already recording', () => {
      recorder.startRecording();
      recorder.startRecording(); // Should not throw
      expect(recorder.isRecordingActive()).toBe(true);
    });

    it('should stop recording and return session', () => {
      recorder.startRecording();
      const session = recorder.stopRecording();

      expect(recorder.isRecordingActive()).toBe(false);
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.gestures).toEqual([]);
      expect(session.generations).toEqual([]);
    });

    it('should throw error when stopping without recording', () => {
      expect(() => recorder.stopRecording()).toThrow('No recording in progress');
    });

    it('should record gestures', () => {
      const landmarks: HandLandmark[] = Array(21).fill(null).map((_, i) => ({
        x: i * 0.05,
        y: i * 0.05,
        z: 0,
      }));

      recorder.startRecording();
      recorder.recordGesture('pinch', landmarks, 'Right', { confidence: 0.9 });
      const session = recorder.stopRecording();

      expect(session.gestures).toHaveLength(1);
      expect(session.gestures[0].type).toBe('pinch');
      expect(session.gestures[0].handedness).toBe('Right');
      expect(session.gestures[0].landmarks).toHaveLength(21);
    });

    it('should record generations', () => {
      const result: GenerationResult = {
        imageUrl: 'https://example.com/image.png',
        prompt: { short_description: 'test' } as any,
        timestamp: Date.now(),
        seed: 12345,
        requestId: 'req-123',
      };

      recorder.startRecording();
      recorder.recordGeneration(result);
      const session = recorder.stopRecording();

      expect(session.generations).toHaveLength(1);
      expect(session.generations[0].imageUrl).toBe(result.imageUrl);
      expect(session.generations[0].seed).toBe(12345);
    });

    it('should not record when not recording', () => {
      const landmarks: HandLandmark[] = Array(21).fill(null).map(() => ({
        x: 0,
        y: 0,
        z: 0,
      }));

      recorder.recordGesture('pinch', landmarks);
      
      // Should not throw, just ignore
      expect(recorder.isRecordingActive()).toBe(false);
    });

    it('should include session metadata', () => {
      recorder.startRecording();
      const session = recorder.stopRecording();

      expect(session.metadata.version).toBeDefined();
      expect(session.metadata.userAgent).toBeDefined();
      expect(session.metadata.recordedAt).toBeDefined();
    });

    it('should calculate session duration', () => {
      recorder.startRecording();
      
      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 50) {
        // Busy wait
      }
      
      const session = recorder.stopRecording();
      expect(session.duration).toBeGreaterThan(0);
      expect(session.duration).toBeLessThan(1000); // Should be less than 1 second
    });
  });

  describe('Playback', () => {
    let session: RecordingSession;

    beforeEach(() => {
      const landmarks: HandLandmark[] = Array(21).fill(null).map(() => ({
        x: 0.5,
        y: 0.5,
        z: 0,
      }));

      recorder.startRecording();
      recorder.recordGesture('pinch', landmarks);
      recorder.recordGesture('wrist_rotation', landmarks);
      session = recorder.stopRecording();
    });

    it('should start playback', () => {
      const callback = vi.fn();
      recorder.startPlayback(session, callback);

      const state = recorder.getPlaybackState();
      expect(state.isPlaying).toBe(true);
      expect(state.currentTime).toBe(0);
      expect(state.speed).toBe(1.0);
    });

    it('should stop playback', () => {
      const callback = vi.fn();
      recorder.startPlayback(session, callback);
      recorder.stopPlayback();

      const state = recorder.getPlaybackState();
      expect(state.isPlaying).toBe(false);
    });

    it('should pause and resume playback', () => {
      const callback = vi.fn();
      recorder.startPlayback(session, callback);
      
      recorder.pausePlayback();
      let state = recorder.getPlaybackState();
      expect(state.isPaused).toBe(true);

      recorder.resumePlayback();
      state = recorder.getPlaybackState();
      expect(state.isPaused).toBe(false);
    });

    it('should support custom playback speed', () => {
      const callback = vi.fn();
      recorder.startPlayback(session, callback, 2.0);

      const state = recorder.getPlaybackState();
      expect(state.speed).toBe(2.0);
    });
  });

  describe('Export/Import', () => {
    let session: RecordingSession;

    beforeEach(() => {
      const landmarks: HandLandmark[] = Array(21).fill(null).map(() => ({
        x: 0.5,
        y: 0.5,
        z: 0,
      }));

      recorder.startRecording();
      recorder.recordGesture('pinch', landmarks);
      session = recorder.stopRecording();
    });

    it('should export session as JSON', () => {
      const json = recorder.exportSessionJSON(session);
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(session.id);
      expect(parsed.gestures).toHaveLength(1);
    });

    it('should import session from JSON', () => {
      const json = recorder.exportSessionJSON(session);
      const imported = recorder.importSessionJSON(json);

      expect(imported.id).toBe(session.id);
      expect(imported.gestures).toHaveLength(session.gestures.length);
      expect(imported.generations).toHaveLength(session.generations.length);
    });

    it('should throw error on invalid JSON import', () => {
      expect(() => recorder.importSessionJSON('invalid json')).toThrow('Failed to import session');
    });

    it('should throw error on invalid session structure', () => {
      const invalidJson = JSON.stringify({ foo: 'bar' });
      expect(() => recorder.importSessionJSON(invalidJson)).toThrow('Failed to import session');
    });
  });

  describe('Singleton', () => {
    it('should return same instance from getSessionRecorder', () => {
      const instance1 = getSessionRecorder();
      const instance2 = getSessionRecorder();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance from createSessionRecorder', () => {
      const instance1 = createSessionRecorder();
      const instance2 = createSessionRecorder();
      expect(instance1).not.toBe(instance2);
    });
  });
});
