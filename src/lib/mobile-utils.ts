/**
 * Mobile Utilities
 * 
 * Utilities for detecting mobile devices and optimizing performance
 * for mobile viewports.
 * 
 * Requirements: 10.5
 */

/**
 * Check if the current device is mobile based on user agent
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android',
    'webos',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'mobile',
  ];
  
  return mobileKeywords.some(keyword => userAgent.includes(keyword));
}

/**
 * Check if the current viewport is mobile-sized (< 768px)
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Get optimal detection FPS for current device
 * Mobile devices get lower FPS to conserve battery and improve performance
 */
export function getOptimalDetectionFPS(): number {
  const isMobile = isMobileDevice() || isMobileViewport();
  
  // Mobile: 15 FPS (66ms interval)
  // Desktop: 20 FPS (50ms interval)
  return isMobile ? 15 : 20;
}

/**
 * Check if device supports touch events
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - msMaxTouchPoints is IE-specific
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Get device pixel ratio for high-DPI displays
 */
export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;
  return window.devicePixelRatio || 1;
}

/**
 * Check if device is in landscape orientation
 */
export function isLandscape(): boolean {
  if (typeof window === 'undefined') return true;
  return window.innerWidth > window.innerHeight;
}

/**
 * Get recommended webcam resolution for device
 * Mobile devices use lower resolution to improve performance
 */
export function getRecommendedWebcamResolution(): { width: number; height: number } {
  const isMobile = isMobileDevice() || isMobileViewport();
  
  if (isMobile) {
    // Mobile: 640x480 for better performance
    return { width: 640, height: 480 };
  }
  
  // Desktop: 1280x720 for better quality
  return { width: 1280, height: 720 };
}

/**
 * Add viewport meta tag for mobile optimization (call once on app init)
 */
export function ensureMobileViewportMeta(): void {
  if (typeof document === 'undefined') return;
  
  let viewport = document.querySelector('meta[name="viewport"]');
  
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
  );
}
