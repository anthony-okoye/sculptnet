'use client';

/**
 * Gesture Overlay Component
 * 
 * Displays gesture detection status and loading spinner during generation.
 * Shows current gesture, parameter updates, and generation progress.
 * Integrates pose capture indicator for freeze frame feature.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.5, 4.1
 */

import { Badge } from '@/components/ui/badge';
import type { GestureUpdate } from '@/lib/gesture-mapper';
import type { GenerationStatus } from '@/lib/bria-client';
import { ConnectedPoseCaptureIndicator } from '@/components/pose-capture-indicator';
import { ConnectedCompactPoseIndicator } from '@/components/pose-status-badge';

export interface GestureOverlayProps {
  /** Whether gesture detection is active */
  isDetecting: boolean;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Current generation status */
  generationStatus: GenerationStatus;
  /** Current detected gesture description */
  currentGesture: string | null;
  /** Last parameter update */
  lastUpdate: GestureUpdate | null;
  /** Error message if any */
  error: string | null;
  /** Custom class name */
  className?: string;
  /** Whether pose is currently stable (for pose capture indicator) */
  isPoseStable?: boolean;
  /** Hold duration for pose capture (default 2 seconds) */
  poseHoldDuration?: number;
  /** Callback when pose is cleared */
  onPoseCleared?: () => void;
}

/**
 * Loading Spinner Component
 */
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };

  return (
    <div
      className={`${sizeClasses[size]} border-white border-t-transparent rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}

/**
 * Generation Progress Overlay
 */
function GenerationProgress({ status }: { status: GenerationStatus }) {
  const statusMessages: Record<GenerationStatus, string> = {
    idle: '',
    generating: 'Sending request...',
    polling: 'Generating image...',
    error: 'Generation failed',
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
      <div className="flex flex-col items-center gap-4 text-white">
        <LoadingSpinner size="lg" />
        <div className="text-center">
          <p className="text-lg font-medium">Generating Image</p>
          <p className="text-sm text-zinc-300">{statusMessages[status]}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Gesture Status Badge
 */
function GestureStatusBadge({ 
  gesture, 
  isDetecting 
}: { 
  gesture: string | null; 
  isDetecting: boolean;
}) {
  if (!isDetecting) {
    return (
      <Badge variant="secondary" className="bg-zinc-700/80 text-zinc-300">
        Detection paused
      </Badge>
    );
  }

  if (!gesture || gesture === 'No hands detected') {
    return (
      <Badge variant="outline" className="bg-zinc-800/80 text-zinc-400 border-zinc-600">
        Waiting for hands...
      </Badge>
    );
  }

  // Check for generation trigger
  if (gesture.includes('triggered')) {
    return (
      <Badge className="bg-green-600/90 text-white animate-pulse">
        🎨 {gesture}
      </Badge>
    );
  }

  // Regular gesture
  return (
    <Badge className="bg-blue-600/90 text-white">
      ✋ {gesture}
    </Badge>
  );
}

/**
 * Parameter Update Display - Responsive
 */
function ParameterUpdateDisplay({ update }: { update: GestureUpdate | null }) {
  if (!update) return null;

  // Format the path for display
  const pathParts = update.path.split('.');
  const displayPath = pathParts[pathParts.length - 1]
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="bg-zinc-800/80 backdrop-blur-sm rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
      <div className="text-zinc-400 text-xs">{displayPath}</div>
      <div className="text-white font-medium truncate max-w-[120px] sm:max-w-[200px]">
        {String(update.value)}
      </div>
      <div className="text-zinc-500 text-xs hidden sm:block">
        Confidence: {Math.round(update.confidence * 100)}%
      </div>
    </div>
  );
}

/**
 * Error Display - Responsive
 */
function ErrorDisplay({ error }: { error: string }) {
  return (
    <div className="bg-red-500/90 backdrop-blur-sm rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 text-white text-xs sm:text-sm max-w-[200px] sm:max-w-[300px]">
      <div className="font-medium">Error</div>
      <div className="text-red-100 truncate">{error}</div>
    </div>
  );
}

/**
 * Gesture Overlay Component
 * 
 * Displays gesture detection status, loading spinner during generation,
 * current parameter updates, and pose capture indicator.
 * 
 * Requirements: 3.1, 3.5
 */
export function GestureOverlay({
  isDetecting,
  isGenerating,
  generationStatus,
  currentGesture,
  lastUpdate,
  error,
  className = '',
  isPoseStable = false,
  poseHoldDuration = 2,
  onPoseCleared,
}: GestureOverlayProps) {
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      {/* Generation Progress Overlay */}
      {isGenerating && generationStatus !== 'idle' && (
        <GenerationProgress status={generationStatus} />
      )}

      {/* Pose Capture Indicator - Center of screen (Requirements: 3.1) */}
      <ConnectedPoseCaptureIndicator
        isStable={isPoseStable}
        holdDuration={poseHoldDuration}
      />

      {/* Top-left: Gesture Status - Responsive positioning */}
      <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-10">
        <div className="flex items-center gap-2">
          <GestureStatusBadge gesture={currentGesture} isDetecting={isDetecting} />
          {/* Pose Status Badge (Requirements: 3.5) */}
          <ConnectedCompactPoseIndicator onCleared={onPoseCleared} />
        </div>
      </div>

      {/* Top-right: Parameter Update - Responsive positioning */}
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10">
        <ParameterUpdateDisplay update={lastUpdate} />
      </div>

      {/* Bottom-left: Error Display - Responsive positioning */}
      {error && (
        <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 z-10">
          <ErrorDisplay error={error} />
        </div>
      )}

      {/* Bottom-center: Detection Status Indicator - Responsive */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-10">
        {isDetecting && (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-800/80 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1 sm:py-1.5">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-zinc-300 hidden sm:inline">Detecting gestures</span>
            <span className="text-xs text-zinc-300 sm:hidden">Detecting</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GestureOverlay;
