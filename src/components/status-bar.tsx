'use client';

/**
 * Status Bar Component
 * 
 * Displays current gesture and parameter updates using Badge components:
 * - Current gesture being detected
 * - Last parameter update with path and value
 * - Generation status (idle, generating, error)
 * - Uses Skeleton for loading states
 * - Shows Toast notifications for errors
 * 
 * Requirements: 6.1, 7.4, 8.1, 9.1, 10.4
 */

import { useEffect } from 'react';
import { 
  Activity, 
  Zap, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { GestureUpdate } from '@/lib/gesture-mapper';
import type { GenerationStatus } from '@/lib/bria-client';

// ============ Types ============

export interface StatusBarProps {
  // Gesture state
  isDetecting: boolean;
  currentGesture: string | null;
  lastUpdate: GestureUpdate | null;
  
  // Generation state
  generationStatus: GenerationStatus;
  isGenerating: boolean;
  error: string | null;
  
  // Hand detection
  handCount?: number;
  
  // Optional customization
  className?: string;
  showToasts?: boolean;
}

// ============ Component ============

/**
 * Status Bar Component
 * 
 * Real-time status display for gesture detection and generation
 */
export function StatusBar({
  isDetecting,
  currentGesture,
  lastUpdate,
  generationStatus,
  isGenerating,
  error,
  handCount = 0,
  className = '',
  showToasts = true,
}: StatusBarProps) {
  // Show toast notifications for errors
  useEffect(() => {
    if (showToasts && error) {
      toast.error('Generation Error', {
        description: error,
        duration: 5000,
      });
    }
  }, [error, showToasts]);

  // Show toast for successful generation
  useEffect(() => {
    if (showToasts && generationStatus === 'idle' && !error && !isGenerating) {
      // Only show if we just finished generating (status changed from generating to idle)
      // This is a simplified check - in production you'd track previous status
    }
  }, [generationStatus, error, isGenerating, showToasts]);

  return (
    <Card className={`bg-zinc-900/50 border-zinc-800 backdrop-blur-sm ${className}`}>
      <CardContent className="p-2 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
          {/* Detection Status Badge - Responsive */}
          <Badge 
            variant={isDetecting ? 'default' : 'secondary'}
            className={`flex items-center gap-1 sm:gap-1.5 text-xs ${
              isDetecting ? 'bg-green-600 hover:bg-green-700' : ''
            }`}
          >
            <Activity className="w-3 h-3" />
            <span className="hidden sm:inline">{isDetecting ? 'Detecting' : 'Paused'}</span>
            <span className="sm:hidden">{isDetecting ? 'On' : 'Off'}</span>
          </Badge>

          {/* Hand Count Badge - Responsive */}
          {isDetecting && (
            <Badge variant="outline" className="flex items-center gap-1 sm:gap-1.5 text-xs">
              👋 {handCount}
            </Badge>
          )}

          {/* Current Gesture Badge - Responsive */}
          {isDetecting && currentGesture && (
            <Badge variant="secondary" className="flex items-center gap-1 sm:gap-1.5 text-xs">
              <Zap className="w-3 h-3" />
              <span className="hidden sm:inline">{currentGesture}</span>
              <span className="sm:hidden truncate max-w-[80px]">{currentGesture}</span>
            </Badge>
          )}

          {/* Last Parameter Update - Hide on small mobile */}
          {lastUpdate && (
            <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 font-mono text-xs">
              {lastUpdate.path}: {formatValue(lastUpdate.value)}
            </Badge>
          )}

          {/* Generation Status */}
          {isGenerating && (
            <Badge 
              variant="default" 
              className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-700"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating...
            </Badge>
          )}

          {generationStatus === 'polling' && (
            <Badge 
              variant="default" 
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Polling status...
            </Badge>
          )}

          {error && (
            <Badge 
              variant="destructive" 
              className="flex items-center gap-1.5"
            >
              <AlertCircle className="w-3 h-3" />
              Error
            </Badge>
          )}

          {!isGenerating && !error && generationStatus === 'idle' && lastUpdate && (
            <Badge 
              variant="default" 
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-3 h-3" />
              Ready
            </Badge>
          )}

          {/* Loading Skeleton (shown during initialization) */}
          {!isDetecting && !currentGesture && !lastUpdate && (
            <Skeleton className="h-6 w-32" />
          )}
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="mt-3 text-xs text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ Utility Functions ============

/**
 * Format a parameter value for display
 */
function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  if (typeof value === 'string') {
    // Truncate long strings
    return value.length > 30 ? `${value.substring(0, 30)}...` : value;
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

export default StatusBar;
