'use client';

/**
 * Pose Status Badge Component
 * 
 * Displays a small indicator when a pose is active:
 * - Shows pose thumbnail if available
 * - Displays pose descriptor text
 * - Includes clear button to remove captured pose
 * 
 * Requirements: 3.5, 4.3
 */

import { X, Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePoseCaptureStore, type CapturedPose } from '@/lib/stores/pose-capture-store';

// ============ Types ============

export interface PoseStatusBadgeProps {
  /** The captured pose to display */
  pose: CapturedPose | null;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Whether to show the thumbnail */
  showThumbnail?: boolean;
  /** Custom class name */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

// ============ Sub-Components ============

/**
 * Pose Thumbnail Display
 */
function PoseThumbnail({ 
  thumbnail, 
  size 
}: { 
  thumbnail?: string; 
  size: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  if (!thumbnail) {
    return (
      <div className={`${sizeClasses[size]} rounded bg-zinc-700 flex items-center justify-center`}>
        <Camera className="w-3 h-3 text-zinc-400" />
      </div>
    );
  }

  return (
    <img
      src={thumbnail}
      alt="Captured pose"
      className={`${sizeClasses[size]} rounded object-cover`}
    />
  );
}

/**
 * Clear Button
 */
function ClearButton({ 
  onClick, 
  size 
}: { 
  onClick: () => void; 
  size: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      className={`${sizeClasses[size]} rounded-full hover:bg-zinc-600 p-0 pointer-events-auto`}
      aria-label="Clear captured pose"
    >
      <X className="w-3 h-3" />
    </Button>
  );
}

// ============ Main Component ============

/**
 * Pose Status Badge Component
 * 
 * Shows a compact indicator when a pose is captured and active.
 * Includes thumbnail preview and clear button.
 */
export function PoseStatusBadge({
  pose,
  onClear,
  showThumbnail = true,
  className = '',
  size = 'md',
}: PoseStatusBadgeProps) {
  // Don't render if no pose is captured
  if (!pose) {
    return null;
  }

  // Truncate descriptor for display
  const displayDescriptor = pose.descriptor.length > 30
    ? `${pose.descriptor.substring(0, 30)}...`
    : pose.descriptor;

  const containerClasses = {
    sm: 'gap-1.5 px-2 py-1',
    md: 'gap-2 px-3 py-1.5',
    lg: 'gap-2.5 px-4 py-2',
  };

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div
      className={`
        inline-flex items-center ${containerClasses[size]}
        bg-zinc-800/90 backdrop-blur-sm rounded-lg
        border border-zinc-700
        ${className}
      `}
    >
      {/* Thumbnail */}
      {showThumbnail && (
        <PoseThumbnail thumbnail={pose.thumbnail} size={size} />
      )}

      {/* Pose Info */}
      <div className="flex flex-col min-w-0">
        <Badge 
          variant="default" 
          className="bg-green-600/80 text-white text-xs px-1.5 py-0 h-auto"
        >
          Pose Active
        </Badge>
        <span className={`${textClasses[size]} text-zinc-300 truncate max-w-[150px]`}>
          {displayDescriptor}
        </span>
      </div>

      {/* Clear Button */}
      {onClear && (
        <ClearButton onClick={onClear} size={size} />
      )}
    </div>
  );
}

// ============ Connected Component ============

/**
 * Connected Pose Status Badge
 * 
 * Automatically connects to the pose capture store for state and actions
 */
export interface ConnectedPoseStatusBadgeProps {
  /** Whether to show the thumbnail */
  showThumbnail?: boolean;
  /** Custom class name */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Callback after pose is cleared */
  onCleared?: () => void;
}

export function ConnectedPoseStatusBadge({
  showThumbnail = true,
  className = '',
  size = 'md',
  onCleared,
}: ConnectedPoseStatusBadgeProps) {
  const { capturedPose, clear } = usePoseCaptureStore();

  const handleClear = () => {
    clear();
    onCleared?.();
  };

  return (
    <PoseStatusBadge
      pose={capturedPose}
      onClear={handleClear}
      showThumbnail={showThumbnail}
      className={className}
      size={size}
    />
  );
}

// ============ Compact Variant ============

/**
 * Compact Pose Indicator
 * 
 * A minimal indicator that just shows pose is active with a clear option
 */
export interface CompactPoseIndicatorProps {
  /** Whether a pose is active */
  isActive: boolean;
  /** Callback when clear is clicked */
  onClear?: () => void;
  /** Custom class name */
  className?: string;
}

export function CompactPoseIndicator({
  isActive,
  onClear,
  className = '',
}: CompactPoseIndicatorProps) {
  if (!isActive) {
    return null;
  }

  return (
    <Badge
      variant="default"
      className={`
        bg-green-600/90 text-white flex items-center gap-1.5
        ${className}
      `}
    >
      <Camera className="w-3 h-3" />
      <span>Pose</span>
      {onClear && (
        <button
          onClick={onClear}
          className="ml-1 hover:bg-green-700 rounded-full p-0.5 pointer-events-auto"
          aria-label="Clear pose"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </Badge>
  );
}

/**
 * Connected Compact Pose Indicator
 */
export function ConnectedCompactPoseIndicator({
  className = '',
  onCleared,
}: {
  className?: string;
  onCleared?: () => void;
}) {
  const { capturedPose, clear } = usePoseCaptureStore();

  const handleClear = () => {
    clear();
    onCleared?.();
  };

  return (
    <CompactPoseIndicator
      isActive={capturedPose !== null}
      onClear={handleClear}
      className={className}
    />
  );
}

export default PoseStatusBadge;
