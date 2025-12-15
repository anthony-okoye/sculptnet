/**
 * Sculpt History Timeline Component
 * 
 * Displays a horizontal scrollable timeline of generation history with:
 * - Thumbnails with gesture icons overlaid
 * - Click to restore prompt state
 * - Hover tooltip showing parameter diff from previous generation
 * - Persists to localStorage (last 20 generations)
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useGenerationStore } from '@/lib/stores/generation-store';
import { usePromptStore } from '@/lib/stores/prompt-store';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Hand, 
  RotateCw, 
  MoveVertical, 
  Frame, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColorDepthIndicator } from '@/components/color-depth-indicator';
import type { GenerationHistoryEntry } from '@/lib/stores/generation-store';
import type { FIBOStructuredPrompt } from '@/types/fibo';

// ============ Types ============

interface ParameterDiff {
  path: string;
  label: string;
  oldValue: string;
  newValue: string;
}

// ============ Constants ============

const GESTURE_ICONS: Record<string, typeof Hand> = {
  pinch: Hand,
  rotation: RotateCw,
  vertical: MoveVertical,
  frame: Frame,
  fist: Sparkles,
  default: Hand,
};

const GESTURE_LABELS: Record<string, string> = {
  pinch: 'Pinch (FOV)',
  rotation: 'Wrist Rotation',
  vertical: 'Vertical Movement',
  frame: 'Two-Hand Frame',
  fist: 'Fist-to-Open',
  default: 'Gesture',
};

// ============ Utility Functions ============

/**
 * Get value at nested path
 */
function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return 'N/A';
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return typeof current === 'string' ? current : String(current ?? 'N/A');
}

/**
 * Calculate parameter differences between two prompts
 */
function calculateDiff(current: FIBOStructuredPrompt, previous: FIBOStructuredPrompt): ParameterDiff[] {
  const diffs: ParameterDiff[] = [];
  
  const paths = [
    { path: 'photographic_characteristics.lens_focal_length', label: 'Lens Focal Length' },
    { path: 'photographic_characteristics.camera_angle', label: 'Camera Angle' },
    { path: 'lighting.conditions', label: 'Lighting' },
    { path: 'aesthetics.composition', label: 'Composition' },
    { path: 'aesthetics.mood_atmosphere', label: 'Mood' },
    { path: 'aesthetics.color_scheme', label: 'Color Scheme' },
    { path: 'photographic_characteristics.depth_of_field', label: 'Depth of Field' },
  ];
  
  for (const { path, label } of paths) {
    const oldValue = getNestedValue(previous, path);
    const newValue = getNestedValue(current, path);
    
    if (oldValue !== newValue) {
      diffs.push({ path, label, oldValue, newValue });
    }
  }
  
  return diffs;
}

// ============ Component ============

export function HistoryTimeline() {
  const timeline = useGenerationStore((state) => state.timeline);
  const loadTimeline = useGenerationStore((state) => state.loadTimeline);
  const restorePrompt = usePromptStore((state) => state.restorePrompt);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedEntry, setSelectedEntry] = useState<GenerationHistoryEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Load timeline from localStorage on mount
  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);
  
  // Auto-scroll to end when new items are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [timeline.length]);
  
  // Handle thumbnail click - open full view modal
  const handleThumbnailClick = (entry: GenerationHistoryEntry) => {
    setSelectedEntry(entry);
    setIsModalOpen(true);
  };
  
  // Handle restore prompt from modal
  const handleRestorePrompt = () => {
    if (selectedEntry?.prompt && typeof selectedEntry.prompt !== 'string') {
      restorePrompt(selectedEntry.prompt);
      setIsModalOpen(false);
    }
  };
  
  // Scroll controls
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };
  
  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };
  
  if (timeline.length === 0) {
    return null;
  }
  
  return (
    <>
      <Card className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90vw] max-w-4xl bg-background/95 backdrop-blur-md border-2 z-40">
        <div className="flex items-center gap-2 p-3">
          {/* Scroll Left Button */}
          <Button
            onClick={scrollLeft}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* Timeline Container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent py-2 px-1"
            style={{ scrollbarWidth: 'thin' }}
          >
            {timeline.map((entry, index) => {
              const previousEntry = index > 0 ? timeline[index - 1] : null;
              const diffs = previousEntry && 
                           entry.prompt && typeof entry.prompt !== 'string' && 
                           previousEntry.prompt && typeof previousEntry.prompt !== 'string'
                ? calculateDiff(entry.prompt, previousEntry.prompt)
                : [];
              
              return (
                <TimelineItem
                  key={entry.id}
                  entry={entry}
                  diffs={diffs}
                  onClick={() => handleThumbnailClick(entry)}
                />
              );
            })}
          </div>
          
          {/* Scroll Right Button */}
          <Button
            onClick={scrollRight}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Full View Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Image Details</DialogTitle>
            <DialogDescription>
              {selectedEntry && new Date(selectedEntry.timestamp).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-4">
              {/* Full-size Image */}
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
                {selectedEntry.thumbnail ? (
                  <img
                    src={selectedEntry.thumbnail}
                    alt="Full view"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Sparkles className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-muted-foreground">Gesture</p>
                  <p>{GESTURE_LABELS[selectedEntry.gesture || 'default'] || 'Unknown'}</p>
                </div>
                
                {selectedEntry.colorDepth && (
                  <div>
                    <p className="font-semibold text-muted-foreground">Color Depth</p>
                    <ColorDepthIndicator
                      colorDepth={selectedEntry.colorDepth}
                      isHDR={selectedEntry.isHDR}
                      variant="full"
                    />
                  </div>
                )}
              </div>

              {/* Prompt Parameters */}
              {selectedEntry.prompt && typeof selectedEntry.prompt !== 'string' && (
                <div className="space-y-2">
                  <p className="font-semibold text-sm text-muted-foreground">Parameters</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-medium">Camera:</span>{' '}
                      {selectedEntry.prompt.photographic_characteristics?.camera_angle || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Lens:</span>{' '}
                      {selectedEntry.prompt.photographic_characteristics?.lens_focal_length || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Lighting:</span>{' '}
                      {selectedEntry.prompt.lighting?.conditions || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Composition:</span>{' '}
                      {selectedEntry.prompt.aesthetics?.composition || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Mood:</span>{' '}
                      {selectedEntry.prompt.aesthetics?.mood_atmosphere || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Color Scheme:</span>{' '}
                      {selectedEntry.prompt.aesthetics?.color_scheme || 'N/A'}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  variant="outline"
                >
                  Close
                </Button>
                <Button
                  onClick={handleRestorePrompt}
                  variant="default"
                >
                  Restore Prompt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ Timeline Item Component ============

interface TimelineItemProps {
  entry: GenerationHistoryEntry;
  diffs: ParameterDiff[];
  onClick: () => void;
}

function TimelineItem({ entry, diffs, onClick }: TimelineItemProps) {
  const GestureIcon = GESTURE_ICONS[entry.gesture || 'default'] || GESTURE_ICONS.default;
  const gestureLabel = GESTURE_LABELS[entry.gesture || 'default'] || GESTURE_LABELS.default;
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'relative shrink-0 w-24 h-24 rounded-lg overflow-hidden',
              'border-2 border-muted hover:border-primary',
              'transition-all duration-200 hover:scale-105',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'group'
            )}
            aria-label={`Restore generation from ${new Date(entry.timestamp).toLocaleTimeString()}`}
          >
            {/* Thumbnail Image */}
            {entry.thumbnail ? (
              <img
                src={entry.thumbnail}
                alt="Generation thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            
            {/* Gesture Icon Overlay */}
            <div className="absolute top-1 right-1 bg-background/80 backdrop-blur-sm rounded-full p-1.5">
              <GestureIcon className="h-3 w-3 text-foreground" />
            </div>
            
            {/* Color Depth Indicator - Requirements: 16.5 */}
            {entry.colorDepth && (
              <div className="absolute bottom-1 left-1">
                <ColorDepthIndicator
                  colorDepth={entry.colorDepth}
                  isHDR={entry.isHDR}
                  variant="compact"
                  className="text-[10px] px-1 py-0.5 h-auto"
                />
              </div>
            )}
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Badge variant="secondary" className="text-xs">
                Restore
              </Badge>
            </div>
          </button>
        </TooltipTrigger>
        
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            {/* Timestamp and Gesture */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b">
              <span className="text-xs font-medium">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <Badge variant="outline" className="text-xs">
                {gestureLabel}
              </Badge>
            </div>
            
            {/* Parameter Diffs */}
            {diffs.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Changes from previous:
                </p>
                {diffs.slice(0, 3).map((diff) => (
                  <div key={diff.path} className="text-xs space-y-0.5">
                    <p className="font-medium">{diff.label}</p>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="line-through max-w-[120px] truncate">
                        {diff.oldValue}
                      </span>
                      <span>→</span>
                      <span className="text-foreground max-w-[120px] truncate">
                        {diff.newValue}
                      </span>
                    </div>
                  </div>
                ))}
                {diffs.length > 3 && (
                  <p className="text-xs text-muted-foreground italic">
                    +{diffs.length - 3} more changes
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                First generation or no changes
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}