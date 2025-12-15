'use client';

/**
 * Gallery Mode Component
 * 
 * Multi-image AR placement mode that allows users to:
 * - Place generated images at different positions in 3D space
 * - Show prompt parameters as floating labels when looking at each image
 * - Support walking through the gallery using device motion
 * - Toggle gallery mode on/off
 * 
 * Requirements: 2.3 (enhanced)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Grid3x3, 
  X, 
  Move3d, 
  Eye,
  Info,
  RotateCcw,
} from 'lucide-react';
import type { GenerationHistoryEntry } from '@/lib/stores/generation-store';
import type { Position3D } from '@/hooks/use-ar-scene';

// ============ Types ============

/**
 * Gallery image placement configuration
 */
export interface GalleryPlacement {
  /** Generation entry ID */
  entryId: string;
  /** Position in 3D space */
  position: Position3D;
  /** Whether to show parameter label */
  showLabel: boolean;
  /** AR scene entity ID */
  arEntityId?: string;
}

/**
 * Gallery layout preset
 */
export type GalleryLayout = 'grid' | 'circle' | 'line' | 'custom';

/**
 * Gallery Mode Props
 */
export interface GalleryModeProps {
  /** Whether gallery mode is active */
  isActive: boolean;
  /** Callback to toggle gallery mode */
  onToggle: (active: boolean) => void;
  /** Available generation entries */
  entries: GenerationHistoryEntry[];
  /** Callback to place image in AR scene */
  onPlaceImage: (entryId: string, position: Position3D) => string;
  /** Callback to remove image from AR scene */
  onRemoveImage: (arEntityId: string) => void;
  /** Callback to clear all images */
  onClearAll: () => void;
  /** Current device orientation (if available) */
  deviceOrientation?: DeviceOrientationEvent;
  /** Custom class name */
  className?: string;
}

// ============ Constants ============

/** Default gallery layouts */
const GALLERY_LAYOUTS: Record<GalleryLayout, (count: number) => Position3D[]> = {
  /** Grid layout - images arranged in a grid */
  grid: (count: number) => {
    const positions: Position3D[] = [];
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 2.0; // 2 meters between images
    
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const offsetX = (col - (cols - 1) / 2) * spacing;
      const offsetZ = -3 - (row * spacing);
      
      positions.push({
        x: offsetX,
        y: 1.6,
        z: offsetZ,
      });
    }
    
    return positions;
  },
  
  /** Circle layout - images arranged in a circle around the user */
  circle: (count: number) => {
    const positions: Position3D[] = [];
    const radius = 3.0; // 3 meters radius
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      positions.push({
        x: Math.sin(angle) * radius,
        y: 1.6,
        z: Math.cos(angle) * radius,
      });
    }
    
    return positions;
  },
  
  /** Line layout - images arranged in a horizontal line */
  line: (count: number) => {
    const positions: Position3D[] = [];
    const spacing = 1.5; // 1.5 meters between images
    
    for (let i = 0; i < count; i++) {
      const offsetX = (i - (count - 1) / 2) * spacing;
      positions.push({
        x: offsetX,
        y: 1.6,
        z: -2.5,
      });
    }
    
    return positions;
  },
  
  /** Custom layout - user-defined positions */
  custom: (count: number) => {
    // Return default positions, user can adjust manually
    return GALLERY_LAYOUTS.grid(count);
  },
};

// ============ Component ============

/**
 * Gallery Mode Component
 * 
 * Provides controls and visualization for multi-image AR gallery placement
 */
export function GalleryMode({
  isActive,
  onToggle,
  entries,
  onPlaceImage,
  onRemoveImage,
  onClearAll,
  deviceOrientation,
  className = '',
}: GalleryModeProps) {
  const [layout, setLayout] = useState<GalleryLayout>('grid');
  const [placements, setPlacements] = useState<GalleryPlacement[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const orientationRef = useRef<DeviceOrientationEvent | null>(null);

  // Update orientation ref
  useEffect(() => {
    orientationRef.current = deviceOrientation || null;
  }, [deviceOrientation]);

  /**
   * Apply gallery layout to all entries
   */
  const applyLayout = useCallback((layoutType: GalleryLayout) => {
    if (entries.length === 0) return;

    // Clear existing placements
    placements.forEach(placement => {
      if (placement.arEntityId) {
        onRemoveImage(placement.arEntityId);
      }
    });

    // Calculate positions based on layout
    const positions = GALLERY_LAYOUTS[layoutType](entries.length);

    // Create new placements
    const newPlacements: GalleryPlacement[] = entries.map((entry, index) => {
      const position = positions[index] || positions[0];
      const arEntityId = onPlaceImage(entry.id, position);

      return {
        entryId: entry.id,
        position,
        showLabel: showLabels,
        arEntityId,
      };
    });

    setPlacements(newPlacements);
    setLayout(layoutType);
  }, [entries, placements, onPlaceImage, onRemoveImage, showLabels]);

  /**
   * Clear all placements
   */
  const handleClearAll = useCallback(() => {
    placements.forEach(placement => {
      if (placement.arEntityId) {
        onRemoveImage(placement.arEntityId);
      }
    });
    setPlacements([]);
    onClearAll();
  }, [placements, onRemoveImage, onClearAll]);

  /**
   * Toggle label visibility
   */
  const toggleLabels = useCallback(() => {
    setShowLabels(prev => !prev);
    setPlacements(prev =>
      prev.map(p => ({ ...p, showLabel: !showLabels }))
    );
  }, [showLabels]);

  /**
   * Handle entry selection
   */
  const handleSelectEntry = useCallback((entryId: string) => {
    setSelectedEntry(prev => prev === entryId ? null : entryId);
  }, []);

  /**
   * Get entry details for display
   */
  const getEntryDetails = useCallback((entryId: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return null;

    // Extract key parameters from prompt
    const prompt = entry.prompt;
    
    // Handle case where prompt might be a string
    if (typeof prompt === 'string') {
      return {
        camera: 'N/A',
        lighting: 'N/A',
        composition: 'N/A',
        mood: 'N/A',
      };
    }
    
    const details = {
      camera: prompt.photographic_characteristics?.camera_angle || 'N/A',
      lighting: prompt.lighting?.conditions || 'N/A',
      composition: prompt.aesthetics?.composition || 'N/A',
      mood: prompt.aesthetics?.mood_atmosphere || 'N/A',
    };

    return details;
  }, [entries]);

  // Auto-apply layout when entries change and gallery is active
  useEffect(() => {
    if (isActive && entries.length > 0 && placements.length === 0) {
      applyLayout(layout);
    }
  }, [isActive, entries, placements.length, layout, applyLayout]);

  // Cleanup on unmount or when gallery mode is deactivated
  useEffect(() => {
    if (!isActive) {
      handleClearAll();
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isActive) {
    return null;
  }

  return (
    <Card className={`bg-zinc-900/95 border-zinc-800 ${className}`}>
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-5 h-5 text-green-500" />
            <h3 className="text-sm font-medium text-white">Gallery Mode</h3>
            <Badge variant="outline" className="text-xs">
              {placements.length} / {entries.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(false)}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Layout Selection */}
        <div className="space-y-2">
          <label className="text-xs text-zinc-400">Layout</label>
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant={layout === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyLayout('grid')}
              className="text-xs"
            >
              Grid
            </Button>
            <Button
              variant={layout === 'circle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyLayout('circle')}
              className="text-xs"
            >
              Circle
            </Button>
            <Button
              variant={layout === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyLayout('line')}
              className="text-xs"
            >
              Line
            </Button>
            <Button
              variant={layout === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyLayout('custom')}
              className="text-xs"
            >
              Custom
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLabels}
            className="flex-1 text-xs"
          >
            <Eye className="w-3 h-3 mr-1" />
            {showLabels ? 'Hide' : 'Show'} Labels
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="flex-1 text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear All
          </Button>
        </div>

        {/* Placement List */}
        {placements.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Placed Images</label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {placements.map((placement, index) => {
                const entry = entries.find(e => e.id === placement.entryId);
                const isSelected = selectedEntry === placement.entryId;
                const details = getEntryDetails(placement.entryId);

                return (
                  <div
                    key={placement.entryId}
                    className={`p-2 rounded border ${
                      isSelected
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-zinc-700 bg-zinc-800/50'
                    } cursor-pointer transition-colors`}
                    onClick={() => handleSelectEntry(placement.entryId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <span className="text-xs text-zinc-300">
                          {entry?.gesture || 'Manual'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Move3d className="w-3 h-3 text-zinc-500" />
                        <span className="text-xs text-zinc-500">
                          ({placement.position.x.toFixed(1)}, {placement.position.y.toFixed(1)}, {placement.position.z.toFixed(1)})
                        </span>
                      </div>
                    </div>

                    {/* Show details when selected */}
                    {isSelected && details && (
                      <div className="mt-2 pt-2 border-t border-zinc-700 space-y-1">
                        <div className="flex items-start gap-2">
                          <Info className="w-3 h-3 text-zinc-400 mt-0.5 shrink-0" />
                          <div className="text-xs text-zinc-400 space-y-0.5">
                            <div><span className="text-zinc-500">Camera:</span> {details.camera}</div>
                            <div><span className="text-zinc-500">Lighting:</span> {details.lighting}</div>
                            <div><span className="text-zinc-500">Composition:</span> {details.composition}</div>
                            <div><span className="text-zinc-500">Mood:</span> {details.mood}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {placements.length === 0 && entries.length > 0 && (
          <div className="text-center py-6 text-zinc-500 text-xs">
            <Grid3x3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Select a layout to place images in the gallery</p>
          </div>
        )}

        {/* No Entries State */}
        {entries.length === 0 && (
          <div className="text-center py-6 text-zinc-500 text-xs">
            <Grid3x3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Generate some images first to create a gallery</p>
          </div>
        )}

        {/* Device Motion Info */}
        {deviceOrientation && (
          <div className="pt-2 border-t border-zinc-800">
            <div className="text-xs text-zinc-500">
              <span className="text-zinc-400">Device Motion:</span> Active
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GalleryMode;
