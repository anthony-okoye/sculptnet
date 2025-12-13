/**
 * Split-Screen Compare Mode Component
 * 
 * Displays two images side-by-side with:
 * - Slider to reveal/hide portions of each image (before/after style)
 * - Diff panel showing changed parameters
 * - Selection of any two timeline items for comparison
 * - Keyboard shortcut (C) to toggle compare mode
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { X, ArrowLeftRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenerationHistoryEntry } from '@/lib/stores/generation-store';
import type { FIBOStructuredPrompt } from '@/types/fibo';

// ============ Types ============

interface ParameterDiff {
  path: string;
  label: string;
  oldValue: string;
  newValue: string;
  category: 'camera' | 'lighting' | 'aesthetics' | 'style' | 'other';
}

interface CompareViewProps {
  /** First image to compare */
  imageA: GenerationHistoryEntry;
  /** Second image to compare */
  imageB: GenerationHistoryEntry;
  /** Callback when compare mode is closed */
  onClose: () => void;
  /** Optional className for styling */
  className?: string;
}

// ============ Constants ============

const PARAMETER_PATHS = [
  { 
    path: 'photographic_characteristics.lens_focal_length', 
    label: 'Lens Focal Length',
    category: 'camera' as const,
  },
  { 
    path: 'photographic_characteristics.camera_angle', 
    label: 'Camera Angle',
    category: 'camera' as const,
  },
  { 
    path: 'photographic_characteristics.depth_of_field', 
    label: 'Depth of Field',
    category: 'camera' as const,
  },
  { 
    path: 'photographic_characteristics.focus', 
    label: 'Focus',
    category: 'camera' as const,
  },
  { 
    path: 'lighting.conditions', 
    label: 'Lighting Conditions',
    category: 'lighting' as const,
  },
  { 
    path: 'lighting.direction', 
    label: 'Lighting Direction',
    category: 'lighting' as const,
  },
  { 
    path: 'lighting.shadows', 
    label: 'Shadows',
    category: 'lighting' as const,
  },
  { 
    path: 'aesthetics.composition', 
    label: 'Composition',
    category: 'aesthetics' as const,
  },
  { 
    path: 'aesthetics.mood_atmosphere', 
    label: 'Mood & Atmosphere',
    category: 'aesthetics' as const,
  },
  { 
    path: 'aesthetics.color_scheme', 
    label: 'Color Scheme',
    category: 'aesthetics' as const,
  },
  { 
    path: 'style_medium', 
    label: 'Style Medium',
    category: 'style' as const,
  },
  { 
    path: 'artistic_style', 
    label: 'Artistic Style',
    category: 'style' as const,
  },
  { 
    path: 'short_description', 
    label: 'Description',
    category: 'other' as const,
  },
  { 
    path: 'background_setting', 
    label: 'Background',
    category: 'other' as const,
  },
];

const CATEGORY_COLORS = {
  camera: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  lighting: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  aesthetics: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  style: 'bg-green-500/10 text-green-500 border-green-500/20',
  other: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

// ============ Utility Functions ============

/**
 * Get value at nested path in object
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
function calculateDiffs(
  promptA: FIBOStructuredPrompt, 
  promptB: FIBOStructuredPrompt
): ParameterDiff[] {
  const diffs: ParameterDiff[] = [];
  
  for (const { path, label, category } of PARAMETER_PATHS) {
    const valueA = getNestedValue(promptA, path);
    const valueB = getNestedValue(promptB, path);
    
    if (valueA !== valueB) {
      diffs.push({ 
        path, 
        label, 
        oldValue: valueA, 
        newValue: valueB,
        category,
      });
    }
  }
  
  return diffs;
}

// ============ Component ============

export function CompareView({ imageA, imageB, onClose, className }: CompareViewProps) {
  // Slider position (0-100, controls reveal percentage)
  const [sliderPosition, setSliderPosition] = useState([50]);
  
  // Container ref for calculating dimensions
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate diffs
  const diffs = 
    imageA.prompt && typeof imageA.prompt !== 'string' &&
    imageB.prompt && typeof imageB.prompt !== 'string'
      ? calculateDiffs(imageA.prompt, imageB.prompt)
      : [];
  
  // Group diffs by category
  const diffsByCategory = diffs.reduce((acc, diff) => {
    if (!acc[diff.category]) {
      acc[diff.category] = [];
    }
    acc[diff.category].push(diff);
    return acc;
  }, {} as Record<string, ParameterDiff[]>);
  
  // Handle keyboard shortcuts (Escape to close)
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  return (
    <div 
      className={cn(
        'fixed inset-0 z-50 bg-black/90 backdrop-blur-sm',
        'flex flex-col',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-white">
            Compare Mode
          </h2>
          <Badge variant="outline" className="text-xs">
            {diffs.length} {diffs.length === 1 ? 'difference' : 'differences'}
          </Badge>
        </div>
        
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-white"
          aria-label="Close compare mode"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Image Comparison */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              {/* Image Labels */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Image A</Badge>
                  <span className="text-sm text-zinc-400">
                    {formatTime(imageA.timestamp)}
                  </span>
                  {imageA.gesture && (
                    <Badge variant="outline" className="text-xs">
                      {imageA.gesture}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Image B</Badge>
                  <span className="text-sm text-zinc-400">
                    {formatTime(imageB.timestamp)}
                  </span>
                  {imageB.gesture && (
                    <Badge variant="outline" className="text-xs">
                      {imageB.gesture}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Split-Screen Image Comparison */}
              <div 
                ref={containerRef}
                className="relative w-full aspect-video bg-zinc-950 rounded-lg overflow-hidden"
              >
                {/* Image B (Background - Right side) */}
                <div className="absolute inset-0">
                  <img
                    src={imageB.imageUrl}
                    alt="Image B"
                    className="w-full h-full object-contain"
                  />
                </div>
                
                {/* Image A (Foreground - Left side, clipped by slider) */}
                <div 
                  className="absolute inset-0 overflow-hidden"
                  style={{ 
                    clipPath: `inset(0 ${100 - sliderPosition[0]}% 0 0)` 
                  }}
                >
                  <img
                    src={imageA.imageUrl}
                    alt="Image A"
                    className="w-full h-full object-contain"
                  />
                </div>
                
                {/* Slider Line */}
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
                  style={{ left: `${sliderPosition[0]}%` }}
                >
                  {/* Slider Handle */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                    <ArrowLeftRight className="h-4 w-4 text-zinc-900" />
                  </div>
                </div>
              </div>
              
              {/* Slider Control */}
              <div className="mt-6 px-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-zinc-400 w-16">Image A</span>
                  <Slider
                    value={sliderPosition}
                    onValueChange={setSliderPosition}
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                    aria-label="Adjust comparison slider"
                  />
                  <span className="text-sm text-zinc-400 w-16 text-right">Image B</span>
                </div>
                <div className="text-center mt-2">
                  <span className="text-xs text-zinc-500">
                    {sliderPosition[0]}% / {100 - sliderPosition[0]}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Parameter Differences */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" />
                Parameter Differences
              </CardTitle>
            </CardHeader>
            <CardContent>
              {diffs.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <p>No parameter differences detected</p>
                  <p className="text-sm mt-1">
                    These images were generated with identical prompts
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(diffsByCategory).map(([category, categoryDiffs]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                        {category}
                      </h3>
                      <div className="space-y-3">
                        {categoryDiffs.map((diff) => (
                          <div
                            key={diff.path}
                            className={cn(
                              'p-3 rounded-lg border',
                              CATEGORY_COLORS[diff.category]
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium mb-2">
                                  {diff.label}
                                </p>
                                <div className="space-y-1.5">
                                  <div className="flex items-start gap-2">
                                    <Badge 
                                      variant="secondary" 
                                      className="shrink-0 text-xs"
                                    >
                                      A
                                    </Badge>
                                    <p className="text-sm text-zinc-300 wrap-break-word">
                                      {diff.oldValue}
                                    </p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <Badge 
                                      variant="secondary" 
                                      className="shrink-0 text-xs"
                                    >
                                      B
                                    </Badge>
                                    <p className="text-sm text-zinc-300 wrap-break-word">
                                      {diff.newValue}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Footer with keyboard hints */}
      <div className="border-t border-zinc-800 p-3 bg-zinc-950/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-zinc-500">
          <span>Drag the slider or use arrow keys to compare images</span>
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">Esc</kbd> Close
            </span>
            <span>
              <kbd className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">←</kbd>
              <kbd className="px-2 py-1 bg-zinc-800 rounded text-zinc-400 ml-1">→</kbd> Adjust
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
