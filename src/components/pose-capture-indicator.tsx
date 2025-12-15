'use client';

/**
 * Pose Capture Indicator Component
 * 
 * Displays visual feedback during pose capture:
 * - Circular progress ring around hands during stability
 * - Countdown timer text
 * - "Pose Captured!" success animation
 * - "Hold Still" message on movement reset
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { useEffect, useState, useCallback } from 'react';
import { usePoseCaptureStore } from '@/lib/stores/pose-capture-store';

// ============ Types ============

export interface PoseCaptureIndicatorProps {
  /** Current hold progress (0-1) */
  holdProgress: number;
  /** Whether pose is currently stable */
  isStable: boolean;
  /** Whether a capture just succeeded */
  captureSuccess: boolean;
  /** Whether capture was just reset due to movement */
  wasReset: boolean;
  /** Hold duration in seconds for countdown display */
  holdDuration?: number;
  /** Custom class name */
  className?: string;
  /** Position for the indicator (center of detected hands) */
  position?: { x: number; y: number };
}

// ============ Sub-Components ============

/**
 * Circular Progress Ring
 * SVG-based progress indicator
 */
function ProgressRing({ 
  progress, 
  size = 120, 
  strokeWidth = 4 
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <svg
      width={size}
      height={size}
      className="transform -rotate-90"
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.2)"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgb(34, 197, 94)" // green-500
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="transition-all duration-100 ease-linear"
      />
    </svg>
  );
}

/**
 * Countdown Timer Display
 */
function CountdownTimer({ 
  progress, 
  holdDuration 
}: { 
  progress: number; 
  holdDuration: number;
}) {
  const remainingTime = Math.max(0, holdDuration * (1 - progress));
  const displayTime = remainingTime.toFixed(1);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-bold text-white tabular-nums">
          {displayTime}s
        </div>
        <div className="text-xs text-zinc-400">Hold still</div>
      </div>
    </div>
  );
}

/**
 * Success Message Animation
 */
function SuccessMessage() {
  return (
    <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in duration-300">
      <div className="bg-green-500/90 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-center shadow-lg">
        <div className="text-lg font-semibold">✓ Pose Captured!</div>
      </div>
    </div>
  );
}

/**
 * Reset Warning Message
 */
function ResetMessage() {
  return (
    <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-yellow-500/90 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-center shadow-lg">
        <div className="text-sm font-medium">Hold Still</div>
      </div>
    </div>
  );
}

// ============ Main Component ============

/**
 * Pose Capture Indicator Component
 * 
 * Shows visual feedback during the pose capture process including
 * progress ring, countdown, and status messages.
 */
export function PoseCaptureIndicator({
  holdProgress,
  isStable,
  captureSuccess,
  wasReset,
  holdDuration = 2,
  className = '',
  position,
}: PoseCaptureIndicatorProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // Handle capture success animation
  useEffect(() => {
    if (captureSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [captureSuccess]);

  // Handle reset warning animation
  useEffect(() => {
    if (wasReset) {
      setShowReset(true);
      const timer = setTimeout(() => setShowReset(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [wasReset]);

  // Don't render if not stable and no messages to show
  if (!isStable && !showSuccess && !showReset) {
    return null;
  }

  // Calculate position styles if provided
  const positionStyles = position
    ? {
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
      }
    : {};

  return (
    <div
      className={`absolute z-30 pointer-events-none ${className}`}
      style={position ? positionStyles : { inset: 0 }}
    >
      {/* Centered container when no position specified */}
      <div className={position ? '' : 'absolute inset-0 flex items-center justify-center'}>
        {/* Progress Ring with Countdown */}
        {isStable && !showSuccess && (
          <div className="relative">
            <ProgressRing progress={holdProgress} size={120} strokeWidth={4} />
            <CountdownTimer progress={holdProgress} holdDuration={holdDuration} />
          </div>
        )}

        {/* Success Message */}
        {showSuccess && <SuccessMessage />}

        {/* Reset Warning */}
        {showReset && !showSuccess && <ResetMessage />}
      </div>
    </div>
  );
}

// ============ Connected Component ============

/**
 * Connected Pose Capture Indicator
 * 
 * Automatically connects to the pose capture store for state
 */
export interface ConnectedPoseCaptureIndicatorProps {
  /** Whether pose is currently stable */
  isStable: boolean;
  /** Hold duration in seconds */
  holdDuration?: number;
  /** Custom class name */
  className?: string;
  /** Position for the indicator */
  position?: { x: number; y: number };
}

export function ConnectedPoseCaptureIndicator({
  isStable,
  holdDuration = 2,
  className = '',
  position,
}: ConnectedPoseCaptureIndicatorProps) {
  const { holdProgress, capturedPose, isCapturing } = usePoseCaptureStore();
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [wasReset, setWasReset] = useState(false);
  const [prevIsStable, setPrevIsStable] = useState(false);
  const [prevCapturedPose, setPrevCapturedPose] = useState(capturedPose);

  // Detect capture success (new pose captured)
  useEffect(() => {
    if (capturedPose && capturedPose !== prevCapturedPose) {
      setCaptureSuccess(true);
      const timer = setTimeout(() => setCaptureSuccess(false), 2000);
      setPrevCapturedPose(capturedPose);
      return () => clearTimeout(timer);
    }
    setPrevCapturedPose(capturedPose);
  }, [capturedPose, prevCapturedPose]);

  // Detect reset (was stable, now not stable, and progress was > 0)
  useEffect(() => {
    if (prevIsStable && !isStable && holdProgress === 0) {
      setWasReset(true);
      const timer = setTimeout(() => setWasReset(false), 1000);
      return () => clearTimeout(timer);
    }
    setPrevIsStable(isStable);
  }, [isStable, prevIsStable, holdProgress]);

  return (
    <PoseCaptureIndicator
      holdProgress={holdProgress}
      isStable={isStable}
      captureSuccess={captureSuccess}
      wasReset={wasReset}
      holdDuration={holdDuration}
      className={className}
      position={position}
    />
  );
}

export default PoseCaptureIndicator;
