/**
 * Recording Controls Component
 * 
 * UI controls for session recording and playback:
 * - Record/Stop/Play buttons
 * - Recording indicator (red dot)
 * - Playback controls (pause, speed)
 * - Export options (JSON, video)
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import {
  Circle,
  Square,
  Play,
  Pause,
  Download,
  FileJson,
  Video,
} from 'lucide-react';
import {
  getSessionRecorder,
  type RecordingSession,
  type PlaybackState,
} from '@/lib/session-recorder';
import { toast } from 'sonner';

// ============ Types ============

export interface RecordingControlsProps {
  /** Callback when recording starts */
  onRecordingStart?: () => void;
  /** Callback when recording stops */
  onRecordingStop?: (session: RecordingSession) => void;
  /** Callback when playback starts */
  onPlaybackStart?: (session: RecordingSession) => void;
  /** Callback when playback stops */
  onPlaybackStop?: () => void;
  /** Canvas element for video export */
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  /** Whether to show in compact mode */
  compact?: boolean;
}

// ============ Component ============

/**
 * Recording Controls Component
 */
export function RecordingControls({
  onRecordingStart,
  onRecordingStop,
  onPlaybackStart,
  onPlaybackStop,
  canvasRef,
  compact = false,
}: RecordingControlsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    speed: 1.0,
    isPaused: false,
  });
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isExporting, setIsExporting] = useState(false);

  const recorder = getSessionRecorder();

  // Update playback state periodically
  useEffect(() => {
    if (!playbackState.isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      const state = recorder.getPlaybackState();
      setPlaybackState(state);

      if (!state.isPlaying) {
        // Playback completed
        if (onPlaybackStop) {
          onPlaybackStop();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [playbackState.isPlaying, recorder, onPlaybackStop]);

  /**
   * Start recording
   */
  const handleStartRecording = useCallback(() => {
    try {
      recorder.startRecording();
      setIsRecording(true);
      setCurrentSession(null);

      if (onRecordingStart) {
        onRecordingStart();
      }

      toast.success('Recording started', {
        description: 'Your gestures and generations are being recorded',
      });
    } catch (error) {
      toast.error('Failed to start recording', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [recorder, onRecordingStart]);

  /**
   * Stop recording
   */
  const handleStopRecording = useCallback(() => {
    try {
      const session = recorder.stopRecording();
      setIsRecording(false);
      setCurrentSession(session);

      if (onRecordingStop) {
        onRecordingStop(session);
      }

      toast.success('Recording stopped', {
        description: `Captured ${session.gestures.length} gestures and ${session.generations.length} generations`,
      });
    } catch (error) {
      toast.error('Failed to stop recording', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [recorder, onRecordingStop]);

  /**
   * Start playback
   */
  const handleStartPlayback = useCallback(() => {
    if (!currentSession) {
      toast.error('No session to play back');
      return;
    }

    try {
      recorder.startPlayback(
        currentSession,
        (event) => {
          // Playback events are handled by parent component
          // This is just for UI updates
        },
        playbackSpeed
      );

      setPlaybackState({
        isPlaying: true,
        currentTime: 0,
        speed: playbackSpeed,
        isPaused: false,
      });

      if (onPlaybackStart) {
        onPlaybackStart(currentSession);
      }

      toast.success('Playback started', {
        description: `Playing at ${playbackSpeed}x speed`,
      });
    } catch (error) {
      toast.error('Failed to start playback', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [currentSession, recorder, playbackSpeed, onPlaybackStart]);

  /**
   * Stop playback
   */
  const handleStopPlayback = useCallback(() => {
    recorder.stopPlayback();
    setPlaybackState({
      isPlaying: false,
      currentTime: 0,
      speed: playbackSpeed,
      isPaused: false,
    });

    if (onPlaybackStop) {
      onPlaybackStop();
    }
  }, [recorder, playbackSpeed, onPlaybackStop]);

  /**
   * Pause/Resume playback
   */
  const handleTogglePause = useCallback(() => {
    if (playbackState.isPaused) {
      recorder.resumePlayback();
    } else {
      recorder.pausePlayback();
    }

    setPlaybackState(prev => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
  }, [recorder, playbackState.isPaused]);

  /**
   * Export session as JSON
   */
  const handleExportJSON = useCallback(() => {
    if (!currentSession) {
      toast.error('No session to export');
      return;
    }

    try {
      recorder.downloadSessionJSON(currentSession);
      toast.success('Session exported', {
        description: 'JSON file downloaded',
      });
    } catch (error) {
      toast.error('Failed to export session', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [currentSession, recorder]);

  /**
   * Export session as video
   */
  const handleExportVideo = useCallback(async () => {
    if (!currentSession) {
      toast.error('No session to export');
      return;
    }

    if (!canvasRef?.current) {
      toast.error('Canvas not available for video export');
      return;
    }

    setIsExporting(true);

    try {
      toast.info('Exporting video...', {
        description: 'This may take a few moments',
      });

      const videoBlob = await recorder.exportSessionVideo(
        currentSession,
        canvasRef.current,
        {
          speed: 2.0, // 2x speed for timelapse
        }
      );

      recorder.downloadSessionVideo(videoBlob, currentSession);

      toast.success('Video exported', {
        description: 'Video file downloaded',
      });
    } catch (error) {
      toast.error('Failed to export video', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsExporting(false);
    }
  }, [currentSession, recorder, canvasRef]);

  /**
   * Format duration for display
   */
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Compact mode - minimal controls
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isRecording ? (
          <>
            <Badge variant="destructive" className="animate-pulse">
              <Circle className="w-2 h-2 fill-current mr-1" />
              REC
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStopRecording}
            >
              <Square className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartRecording}
            disabled={playbackState.isPlaying}
          >
            <Circle className="w-4 h-4 text-red-500" />
          </Button>
        )}

        {currentSession && !isRecording && (
          <>
            {playbackState.isPlaying ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTogglePause}
                >
                  {playbackState.isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStopPlayback}
                >
                  <Square className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartPlayback}
              >
                <Play className="w-4 h-4" />
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  // Full mode - complete controls
  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Recording Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isRecording ? (
              <>
                <Badge variant="destructive" className="animate-pulse">
                  <Circle className="w-3 h-3 fill-current mr-2" />
                  Recording
                </Badge>
                <Button
                  variant="outline"
                  onClick={handleStopRecording}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                onClick={handleStartRecording}
                disabled={playbackState.isPlaying}
              >
                <Circle className="w-4 h-4 mr-2 text-red-500" />
                Record
              </Button>
            )}
          </div>

          {/* Session Info */}
          {currentSession && !isRecording && (
            <div className="text-sm text-muted-foreground">
              {currentSession.gestures.length} gestures, {currentSession.generations.length} generations
              {' • '}
              {formatDuration(currentSession.duration)}
            </div>
          )}
        </div>

        {/* Playback Controls */}
        {currentSession && !isRecording && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {playbackState.isPlaying ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTogglePause}
                  >
                    {playbackState.isPaused ? (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStopPlayback}
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    {formatDuration(playbackState.currentTime)} / {formatDuration(currentSession.duration)}
                  </div>
                </>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartPlayback}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play
                </Button>
              )}

              {/* Playback Speed */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">Speed:</span>
                <div className="w-32">
                  <Slider
                    value={[playbackSpeed]}
                    onValueChange={([value]) => setPlaybackSpeed(value)}
                    min={0.5}
                    max={4.0}
                    step={0.5}
                    disabled={playbackState.isPlaying}
                  />
                </div>
                <span className="text-sm font-medium w-8">{playbackSpeed}x</span>
              </div>
            </div>

            {/* Progress Bar */}
            {playbackState.isPlaying && (
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{
                    width: `${(playbackState.currentTime / currentSession.duration) * 100}%`,
                  }}
                />
              </div>
            )}

            {/* Export Controls */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Export:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJSON}
                disabled={playbackState.isPlaying}
              >
                <FileJson className="w-4 h-4 mr-2" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportVideo}
                disabled={playbackState.isPlaying || isExporting || !canvasRef?.current}
              >
                <Video className="w-4 h-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Video'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
