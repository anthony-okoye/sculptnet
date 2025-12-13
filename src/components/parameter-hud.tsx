/**
 * Live Parameter HUD Component
 * 
 * Displays real-time JSON parameter values as gestures are performed.
 * Features:
 * - Semi-transparent overlay in top-right corner
 * - Color-coded value changes (green=increase, red=decrease)
 * - Draggable positioning
 * - Toggle visibility with localStorage persistence
 * - Parameter range indicators
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { usePromptStore } from '@/lib/stores/prompt-store';
import { cn } from '@/lib/utils';

// ============ Types ============

interface ParameterValue {
  path: string;
  label: string;
  value: string;
  previousValue?: string;
  changeDirection?: 'increase' | 'decrease' | 'none';
  range?: { min: string; max: string };
}

interface Position {
  x: number;
  y: number;
}

// ============ Constants ============

const STORAGE_KEY_VISIBLE = 'sculptnet-hud-visible';
const STORAGE_KEY_POSITION = 'sculptnet-hud-position';
const DEFAULT_POSITION: Position = { x: window.innerWidth - 420, y: 20 };

// Parameter configurations with ranges
const PARAMETER_CONFIGS: Array<{
  path: string;
  label: string;
  range?: { min: string; max: string };
}> = [
  {
    path: 'photographic_characteristics.lens_focal_length',
    label: 'Lens Focal Length',
    range: { min: '24mm wide', max: '200mm telephoto' },
  },
  {
    path: 'photographic_characteristics.camera_angle',
    label: 'Camera Angle',
    range: { min: 'low dutch tilt', max: "bird's eye view" },
  },
  {
    path: 'lighting.conditions',
    label: 'Lighting',
    range: { min: 'night, moonlight', max: 'bright studio' },
  },
  {
    path: 'aesthetics.composition',
    label: 'Composition',
  },
  {
    path: 'aesthetics.mood_atmosphere',
    label: 'Mood',
  },
  {
    path: 'aesthetics.color_scheme',
    label: 'Color Scheme',
  },
  {
    path: 'photographic_characteristics.depth_of_field',
    label: 'Depth of Field',
  },
];

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
 * Determine change direction
 */
function getChangeDirection(current: string, previous: string | undefined): 'increase' | 'decrease' | 'none' {
  if (!previous || current === previous) return 'none';
  
  // Try numeric comparison
  const currentNum = parseFloat(current);
  const previousNum = parseFloat(previous);
  
  if (!isNaN(currentNum) && !isNaN(previousNum)) {
    return currentNum > previousNum ? 'increase' : 'decrease';
  }
  
  // For strings, just mark as changed
  return 'increase'; // Default to green for any change
}

// ============ Component ============

export function ParameterHUD() {
  const prompt = usePromptStore((state) => state.prompt);
  
  // State
  const [visible, setVisible] = useState(true);
  const [position, setPosition] = useState<Position>(DEFAULT_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [parameters, setParameters] = useState<ParameterValue[]>([]);
  const [previousPrompt, setPreviousPrompt] = useState(prompt);
  
  const hudRef = useRef<HTMLDivElement>(null);
  
  // Load preferences from localStorage
  useEffect(() => {
    const savedVisible = localStorage.getItem(STORAGE_KEY_VISIBLE);
    const savedPosition = localStorage.getItem(STORAGE_KEY_POSITION);
    
    if (savedVisible !== null) {
      setVisible(savedVisible === 'true');
    }
    
    if (savedPosition) {
      try {
        const pos = JSON.parse(savedPosition) as Position;
        setPosition(pos);
      } catch {
        // Use default position
      }
    }
  }, []);
  
  // Update parameters when prompt changes
  useEffect(() => {
    const newParameters: ParameterValue[] = PARAMETER_CONFIGS.map((config) => {
      const currentValue = getNestedValue(prompt, config.path);
      const previousValue = getNestedValue(previousPrompt, config.path);
      const changeDirection = getChangeDirection(currentValue, previousValue);
      
      return {
        path: config.path,
        label: config.label,
        value: currentValue,
        previousValue: previousValue !== currentValue ? previousValue : undefined,
        changeDirection,
        range: config.range,
      };
    });
    
    setParameters(newParameters);
    setPreviousPrompt(prompt);
  }, [prompt, previousPrompt]);
  
  // Toggle visibility
  const toggleVisibility = () => {
    const newVisible = !visible;
    setVisible(newVisible);
    localStorage.setItem(STORAGE_KEY_VISIBLE, String(newVisible));
  };
  
  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.hud-drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newPosition = {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        };
        
        // Constrain to viewport
        newPosition.x = Math.max(0, Math.min(window.innerWidth - 400, newPosition.x));
        newPosition.y = Math.max(0, Math.min(window.innerHeight - 400, newPosition.y));
        
        setPosition(newPosition);
      }
    };
    
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(position));
      }
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position]);
  
  // Render toggle button when hidden
  if (!visible) {
    return (
      <Button
        onClick={toggleVisibility}
        variant="outline"
        size="sm"
        className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur-sm"
        aria-label="Show parameter HUD"
      >
        <Eye className="h-4 w-4 mr-2" />
        Show HUD
      </Button>
    );
  }
  
  return (
    <Card
      ref={hudRef}
      className={cn(
        'fixed z-50 w-96 bg-background/80 backdrop-blur-md border-2',
        isDragging && 'cursor-grabbing shadow-2xl'
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50">
        <div className="flex items-center gap-2">
          <GripVertical className="h-5 w-5 text-muted-foreground hud-drag-handle cursor-grab" />
          <h3 className="font-semibold text-sm">Live Parameters</h3>
        </div>
        <Button
          onClick={toggleVisibility}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Hide parameter HUD"
        >
          <EyeOff className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Parameters List */}
      <div className="p-3 space-y-3 max-h-[500px] overflow-y-auto">
        {parameters.map((param) => (
          <ParameterItem key={param.path} parameter={param} />
        ))}
      </div>
    </Card>
  );
}

// ============ Parameter Item Component ============

interface ParameterItemProps {
  parameter: ParameterValue;
}

function ParameterItem({ parameter }: ParameterItemProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Trigger animation on value change
  useEffect(() => {
    if (parameter.changeDirection !== 'none') {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [parameter.value, parameter.changeDirection]);
  
  const changeColor = 
    parameter.changeDirection === 'increase' ? 'text-green-500' :
    parameter.changeDirection === 'decrease' ? 'text-red-500' :
    'text-foreground';
  
  return (
    <div className="space-y-1.5">
      {/* Label and Badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {parameter.label}
        </span>
        {parameter.changeDirection !== 'none' && (
          <Badge
            variant="outline"
            className={cn(
              'text-xs transition-opacity',
              isAnimating ? 'opacity-100' : 'opacity-0',
              parameter.changeDirection === 'increase' && 'border-green-500 text-green-500',
              parameter.changeDirection === 'decrease' && 'border-red-500 text-red-500'
            )}
          >
            {parameter.changeDirection === 'increase' ? '↑' : '↓'}
          </Badge>
        )}
      </div>
      
      {/* Value */}
      <div
        className={cn(
          'text-sm font-mono p-2 rounded bg-muted/50 transition-all duration-300',
          isAnimating && 'ring-2',
          parameter.changeDirection === 'increase' && isAnimating && 'ring-green-500/50',
          parameter.changeDirection === 'decrease' && isAnimating && 'ring-red-500/50'
        )}
      >
        <span className={cn('transition-colors duration-300', changeColor)}>
          {parameter.value}
        </span>
      </div>
      
      {/* Range Indicator */}
      {parameter.range && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span className="truncate max-w-[45%]">{parameter.range.min}</span>
          <span className="text-muted-foreground/50">↔</span>
          <span className="truncate max-w-[45%] text-right">{parameter.range.max}</span>
        </div>
      )}
    </div>
  );
}
