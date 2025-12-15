/**
 * HDR Display Hook
 * 
 * React hook for displaying HDR images with tone mapping on standard displays.
 * 
 * Requirements: 16.2 - Display HDR images with appropriate tone mapping
 */

import { useState, useEffect, useCallback } from 'react';
import {
  toneMappedImageUrl,
  supportsHDRDisplay,
  getRecommendedToneMappingAlgorithm,
  type ToneMappingOptions,
} from '@/lib/hdr-utils';

// ============ Types ============

interface UseHDRDisplayOptions {
  /** Whether to enable tone mapping (default: auto-detect) */
  enableToneMapping?: boolean;
  /** Tone mapping options */
  toneMappingOptions?: ToneMappingOptions;
}

interface UseHDRDisplayResult {
  /** Display URL (tone-mapped if needed) */
  displayUrl: string | null;
  /** Whether tone mapping is active */
  isToneMapped: boolean;
  /** Whether HDR display is supported */
  supportsHDR: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh the tone mapping */
  refresh: () => void;
}

// ============ Hook ============

/**
 * Hook for displaying HDR images with automatic tone mapping
 * Requirements: 16.2 - Display HDR images with appropriate tone mapping
 * 
 * @param imageUrl - URL of the image to display
 * @param isHDR - Whether the image is HDR
 * @param options - Display options
 * @returns Display state and controls
 */
export function useHDRDisplay(
  imageUrl: string | null,
  isHDR: boolean = false,
  options: UseHDRDisplayOptions = {}
): UseHDRDisplayResult {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [supportsHDR, setSupportsHDR] = useState(false);
  const [isToneMapped, setIsToneMapped] = useState(false);

  // Check HDR support on mount
  useEffect(() => {
    setSupportsHDR(supportsHDRDisplay());
  }, []);

  // Process image when URL or options change
  const processImage = useCallback(async () => {
    if (!imageUrl) {
      setDisplayUrl(null);
      setIsToneMapped(false);
      return;
    }

    // If not HDR, use original URL
    if (!isHDR) {
      setDisplayUrl(imageUrl);
      setIsToneMapped(false);
      return;
    }

    // Determine if tone mapping is needed
    const shouldToneMap = options.enableToneMapping !== false && !supportsHDR;

    if (!shouldToneMap) {
      // HDR display supported or tone mapping disabled
      setDisplayUrl(imageUrl);
      setIsToneMapped(false);
      return;
    }

    // Apply tone mapping
    setIsLoading(true);
    setError(null);

    try {
      const toneMappingOptions: ToneMappingOptions = {
        algorithm: getRecommendedToneMappingAlgorithm(),
        ...options.toneMappingOptions,
      };

      const toneMappedUrl = await toneMappedImageUrl(imageUrl, toneMappingOptions);
      setDisplayUrl(toneMappedUrl);
      setIsToneMapped(true);
    } catch (err) {
      console.error('[useHDRDisplay] Tone mapping failed:', err);
      setError(err instanceof Error ? err : new Error('Tone mapping failed'));
      // Fallback to original URL
      setDisplayUrl(imageUrl);
      setIsToneMapped(false);
    } finally {
      setIsLoading(false);
    }
  }, [imageUrl, isHDR, supportsHDR, options.enableToneMapping, options.toneMappingOptions]);

  // Process image when dependencies change
  useEffect(() => {
    processImage();
  }, [processImage]);

  // Refresh function
  const refresh = useCallback(() => {
    processImage();
  }, [processImage]);

  return {
    displayUrl,
    isToneMapped,
    supportsHDR,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook for checking if HDR display is supported
 * 
 * @returns Whether HDR display is supported
 */
export function useHDRSupport(): boolean {
  const [supportsHDR, setSupportsHDR] = useState(false);

  useEffect(() => {
    setSupportsHDR(supportsHDRDisplay());
  }, []);

  return supportsHDR;
}

export default useHDRDisplay;
