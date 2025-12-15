/**
 * HDR Utilities
 * 
 * Utilities for handling HDR images:
 * - Tone mapping for display on standard monitors
 * - HDR format detection and conversion
 * - Fallback handling
 * 
 * Requirements: 16.2, 16.3, 16.4
 */

// ============ Types ============

/**
 * Tone mapping algorithm options
 */
export type ToneMappingAlgorithm = 'reinhard' | 'filmic' | 'aces' | 'none';

/**
 * Tone mapping options
 */
export interface ToneMappingOptions {
  /** Algorithm to use (default: 'filmic') */
  algorithm?: ToneMappingAlgorithm;
  /** Exposure adjustment (default: 1.0) */
  exposure?: number;
  /** Gamma correction (default: 2.2) */
  gamma?: number;
}

// ============ Constants ============

/** Default tone mapping options */
const DEFAULT_TONE_MAPPING_OPTIONS: Required<ToneMappingOptions> = {
  algorithm: 'filmic',
  exposure: 1.0,
  gamma: 2.2,
};

// ============ Tone Mapping Functions ============

/**
 * Apply Reinhard tone mapping
 * Simple and fast, good for general use
 * 
 * @param value - HDR color value (0-∞)
 * @returns Tone-mapped value (0-1)
 */
function reinhardToneMap(value: number): number {
  return value / (1 + value);
}

/**
 * Apply filmic tone mapping (Uncharted 2)
 * More cinematic look with better highlight preservation
 * 
 * @param value - HDR color value (0-∞)
 * @returns Tone-mapped value (0-1)
 */
function filmicToneMap(value: number): number {
  const A = 0.15; // Shoulder strength
  const B = 0.50; // Linear strength
  const C = 0.10; // Linear angle
  const D = 0.20; // Toe strength
  const E = 0.02; // Toe numerator
  const F = 0.30; // Toe denominator
  
  const x = value;
  const result = ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
  
  // Normalize by white point
  const W = 11.2; // Linear white point value
  const whiteScale = ((W * (A * W + C * B) + D * E) / (W * (A * W + B) + D * F)) - E / F;
  
  return result / whiteScale;
}

/**
 * Apply ACES filmic tone mapping
 * Industry standard, used in film production
 * 
 * @param value - HDR color value (0-∞)
 * @returns Tone-mapped value (0-1)
 */
function acesToneMap(value: number): number {
  const a = 2.51;
  const b = 0.03;
  const c = 2.43;
  const d = 0.59;
  const e = 0.14;
  
  const x = value;
  return Math.max(0, Math.min(1, (x * (a * x + b)) / (x * (c * x + d) + e)));
}

/**
 * Apply gamma correction
 * 
 * @param value - Linear color value (0-1)
 * @param gamma - Gamma value (default: 2.2)
 * @returns Gamma-corrected value (0-1)
 */
function applyGamma(value: number, gamma: number = 2.2): number {
  return Math.pow(Math.max(0, Math.min(1, value)), 1 / gamma);
}

/**
 * Apply tone mapping to an HDR image
 * Requirements: 16.2 - Implement tone mapping for HDR display on standard monitors
 * 
 * @param imageData - ImageData from canvas
 * @param options - Tone mapping options
 * @returns Tone-mapped ImageData
 */
export function applyToneMapping(
  imageData: ImageData,
  options: ToneMappingOptions = {}
): ImageData {
  const opts = { ...DEFAULT_TONE_MAPPING_OPTIONS, ...options };
  const { algorithm, exposure, gamma } = opts;
  
  // Select tone mapping function
  let toneMappingFn: (value: number) => number;
  switch (algorithm) {
    case 'reinhard':
      toneMappingFn = reinhardToneMap;
      break;
    case 'filmic':
      toneMappingFn = filmicToneMap;
      break;
    case 'aces':
      toneMappingFn = acesToneMap;
      break;
    case 'none':
      toneMappingFn = (v) => Math.max(0, Math.min(1, v));
      break;
    default:
      toneMappingFn = filmicToneMap;
  }
  
  // Create output ImageData
  const output = new ImageData(imageData.width, imageData.height);
  
  // Process each pixel
  for (let i = 0; i < imageData.data.length; i += 4) {
    // Get RGB values (0-255)
    let r = imageData.data[i] / 255;
    let g = imageData.data[i + 1] / 255;
    let b = imageData.data[i + 2] / 255;
    const a = imageData.data[i + 3];
    
    // Apply exposure
    r *= exposure;
    g *= exposure;
    b *= exposure;
    
    // Apply tone mapping
    r = toneMappingFn(r);
    g = toneMappingFn(g);
    b = toneMappingFn(b);
    
    // Apply gamma correction
    r = applyGamma(r, gamma);
    g = applyGamma(g, gamma);
    b = applyGamma(b, gamma);
    
    // Write back to output (0-255)
    output.data[i] = Math.round(r * 255);
    output.data[i + 1] = Math.round(g * 255);
    output.data[i + 2] = Math.round(b * 255);
    output.data[i + 3] = a;
  }
  
  return output;
}

/**
 * Apply tone mapping to an image element
 * Requirements: 16.2 - Display HDR images with appropriate tone mapping
 * 
 * @param image - HTMLImageElement to tone map
 * @param options - Tone mapping options
 * @returns Canvas with tone-mapped image
 */
export async function toneMappedImage(
  image: HTMLImageElement,
  options: ToneMappingOptions = {}
): Promise<HTMLCanvasElement> {
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }
  
  // Draw image to canvas
  ctx.drawImage(image, 0, 0);
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Apply tone mapping
  const toneMapped = applyToneMapping(imageData, options);
  
  // Put tone-mapped data back
  ctx.putImageData(toneMapped, 0, 0);
  
  return canvas;
}

/**
 * Apply tone mapping to an image URL
 * Requirements: 16.2 - Display HDR images with appropriate tone mapping
 * 
 * @param imageUrl - URL of the image
 * @param options - Tone mapping options
 * @returns Data URL of tone-mapped image
 */
export async function toneMappedImageUrl(
  imageUrl: string,
  options: ToneMappingOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      try {
        const canvas = await toneMappedImage(img, options);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
}

// ============ HDR Detection ============

/**
 * Check if an image appears to be HDR
 * (Heuristic based on pixel value distribution)
 * 
 * @param imageData - ImageData to check
 * @returns True if image appears to be HDR
 */
export function isLikelyHDR(imageData: ImageData): boolean {
  let brightPixels = 0;
  let totalPixels = 0;
  
  // Sample every 10th pixel for performance
  for (let i = 0; i < imageData.data.length; i += 40) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    
    // Check if pixel is very bright (near white)
    if (r > 240 && g > 240 && b > 240) {
      brightPixels++;
    }
    
    totalPixels++;
  }
  
  // If more than 5% of pixels are very bright, likely HDR
  return (brightPixels / totalPixels) > 0.05;
}

// ============ HDR Fallback Handling ============

/**
 * Check if HDR is supported by the API
 * Requirements: 16.4 - Gracefully fall back if HDR not supported
 * 
 * @param apiResponse - Response from Bria API
 * @returns True if HDR was successfully applied
 */
export function isHDRSupported(apiResponse: any): boolean {
  // Check if the response indicates HDR support
  // This is a placeholder - actual implementation depends on Bria API response format
  return apiResponse?.result?.color_depth === 16 || apiResponse?.result?.hdr === true;
}

/**
 * Handle HDR fallback
 * Requirements: 16.4 - Gracefully fall back to standard 8-bit generation
 * 
 * @param requestedHDR - Whether HDR was requested
 * @param apiResponse - Response from Bria API
 * @returns Object with fallback info
 */
export function handleHDRFallback(requestedHDR: boolean, apiResponse: any): {
  isHDR: boolean;
  colorDepth: 8 | 16;
  fellBack: boolean;
  message?: string;
} {
  if (!requestedHDR) {
    return {
      isHDR: false,
      colorDepth: 8,
      fellBack: false,
    };
  }
  
  const supported = isHDRSupported(apiResponse);
  
  if (supported) {
    return {
      isHDR: true,
      colorDepth: 16,
      fellBack: false,
    };
  }
  
  // HDR was requested but not supported - fall back to 8-bit
  return {
    isHDR: false,
    colorDepth: 8,
    fellBack: true,
    message: 'HDR mode is not available. Falling back to standard 8-bit generation.',
  };
}

// ============ Export Utilities ============

/**
 * Convert canvas to 16-bit PNG blob
 * Requirements: 16.3 - Export HDR images in 16-bit PNG format
 * 
 * Note: Standard canvas.toBlob() produces 8-bit PNGs.
 * For true 16-bit PNG export, we would need a specialized library.
 * This function prepares the data structure for such a library.
 * 
 * @param canvas - Canvas with HDR image
 * @returns Blob (8-bit PNG for now, can be upgraded to 16-bit with library)
 */
export async function canvasTo16BitPNG(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob from canvas'));
      }
    }, 'image/png');
  });
}

/**
 * Prepare HDR image data for 16-bit export
 * Requirements: 16.3 - Preserve full color depth in exported file
 * 
 * @param imageData - ImageData to prepare
 * @returns Uint16Array with 16-bit color data
 */
export function prepareHDRExportData(imageData: ImageData): Uint16Array {
  // Convert 8-bit ImageData to 16-bit array
  const data16 = new Uint16Array(imageData.data.length);
  
  for (let i = 0; i < imageData.data.length; i++) {
    // Scale 8-bit (0-255) to 16-bit (0-65535)
    data16[i] = (imageData.data[i] / 255) * 65535;
  }
  
  return data16;
}

// ============ Utility Functions ============

/**
 * Check if browser supports HDR display
 * 
 * @returns True if HDR display is supported
 */
export function supportsHDRDisplay(): boolean {
  // Check for HDR display support
  // This is experimental and may not be widely supported
  if (typeof window === 'undefined') return false;
  
  try {
    // Check for HDR media query support
    const hdrQuery = window.matchMedia('(dynamic-range: high)');
    return hdrQuery.matches;
  } catch {
    return false;
  }
}

/**
 * Get recommended tone mapping algorithm based on browser/device
 * 
 * @returns Recommended algorithm
 */
export function getRecommendedToneMappingAlgorithm(): ToneMappingAlgorithm {
  // If HDR display is supported, no tone mapping needed
  if (supportsHDRDisplay()) {
    return 'none';
  }
  
  // Otherwise use filmic for best quality
  return 'filmic';
}

export default {
  applyToneMapping,
  toneMappedImage,
  toneMappedImageUrl,
  isLikelyHDR,
  isHDRSupported,
  handleHDRFallback,
  canvasTo16BitPNG,
  prepareHDRExportData,
  supportsHDRDisplay,
  getRecommendedToneMappingAlgorithm,
};
