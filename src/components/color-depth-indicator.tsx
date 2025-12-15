'use client';

/**
 * Color Depth Indicator Component
 * 
 * Displays the color depth (8-bit or 16-bit) of generated images.
 * Shows HDR badge for 16-bit images.
 * 
 * Requirements: 16.5
 */

import { Badge } from '@/components/ui/badge';
import { Palette } from 'lucide-react';

interface ColorDepthIndicatorProps {
  /** Color depth (8 or 16 bit) */
  colorDepth: 8 | 16;
  /** Whether this is an HDR image */
  isHDR?: boolean;
  /** Optional className for styling */
  className?: string;
  /** Show full label or compact badge */
  variant?: 'full' | 'compact';
}

/**
 * ColorDepthIndicator Component
 * 
 * Displays color depth information for generated images.
 * Requirements: 16.5 - Show color depth indicator in image metadata overlay
 */
export function ColorDepthIndicator({
  colorDepth,
  isHDR = false,
  className = '',
  variant = 'compact',
}: ColorDepthIndicatorProps) {
  const is16Bit = colorDepth === 16 || isHDR;

  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Palette className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {is16Bit ? '16-bit' : '8-bit'} color depth
        </span>
        {is16Bit && (
          <Badge variant="default" className="bg-purple-600 text-white">
            HDR
          </Badge>
        )}
      </div>
    );
  }

  // Compact variant
  return (
    <Badge
      variant={is16Bit ? 'default' : 'secondary'}
      className={`${is16Bit ? 'bg-purple-600 text-white' : ''} ${className}`}
    >
      {is16Bit ? (
        <>
          <Palette className="mr-1 h-3 w-3" />
          16-bit HDR
        </>
      ) : (
        <>
          <Palette className="mr-1 h-3 w-3" />
          8-bit
        </>
      )}
    </Badge>
  );
}

export default ColorDepthIndicator;
