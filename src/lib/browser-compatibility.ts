/**
 * Browser Compatibility Detection
 * Checks for required features and provides fallback strategies
 */

export interface CompatibilityResult {
  isCompatible: boolean;
  features: {
    getUserMedia: boolean;
    webGL2: boolean;
    webXR: boolean;
    webSocket: boolean;
  };
  missingFeatures: string[];
  warnings: string[];
  recommendedBrowsers: string[];
}

export interface BrowserInfo {
  name: string;
  version: string;
  isSupported: boolean;
}

/**
 * Detects the current browser and version
 */
export function detectBrowser(): BrowserInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { name: 'Unknown', version: 'Unknown', isSupported: false };
  }
  
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';
  let isSupported = false;

  // Chrome
  if (ua.includes('Chrome') && !ua.includes('Edg')) {
    const match = ua.match(/Chrome\/(\d+)/);
    name = 'Chrome';
    version = match ? match[1] : 'Unknown';
    isSupported = match ? parseInt(match[1]) >= 90 : false;
  }
  // Edge
  else if (ua.includes('Edg')) {
    const match = ua.match(/Edg\/(\d+)/);
    name = 'Edge';
    version = match ? match[1] : 'Unknown';
    isSupported = match ? parseInt(match[1]) >= 90 : false;
  }
  // Safari
  else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    name = 'Safari';
    version = match ? match[1] : 'Unknown';
    isSupported = match ? parseInt(match[1]) >= 15 : false;
  }
  // Firefox
  else if (ua.includes('Firefox')) {
    const match = ua.match(/Firefox\/(\d+)/);
    name = 'Firefox';
    version = match ? match[1] : 'Unknown';
    isSupported = match ? parseInt(match[1]) >= 90 : false;
  }

  return { name, version, isSupported };
}

/**
 * Checks if getUserMedia is available
 */
export function checkGetUserMedia(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
}

/**
 * Checks if WebGL 2.0 is available
 */
export function checkWebGL2(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return !!gl;
  } catch (e) {
    return false;
  }
}

/**
 * Checks if WebXR is available (optional feature)
 */
export function checkWebXR(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  return 'xr' in navigator;
}

/**
 * Checks if WebSocket is available
 */
export function checkWebSocket(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  return 'WebSocket' in window;
}

/**
 * Checks if the current context is secure (HTTPS or localhost)
 */
export function checkSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

/**
 * Performs comprehensive browser compatibility check
 */
export function checkBrowserCompatibility(): CompatibilityResult {
  const features = {
    getUserMedia: checkGetUserMedia(),
    webGL2: checkWebGL2(),
    webXR: checkWebXR(),
    webSocket: checkWebSocket(),
  };

  const missingFeatures: string[] = [];
  const warnings: string[] = [];

  // Check required features
  if (!features.getUserMedia) {
    missingFeatures.push('Camera Access (getUserMedia)');
  }

  if (!features.webGL2) {
    missingFeatures.push('WebGL 2.0');
  }

  if (!features.webSocket) {
    missingFeatures.push('WebSocket');
  }

  // Check optional features
  if (!features.webXR) {
    warnings.push('WebXR not supported - will use 2D image display mode');
  }

  // Check secure context
  if (!checkSecureContext()) {
    missingFeatures.push('HTTPS (Secure Context)');
    warnings.push('Webcam access requires HTTPS or localhost');
  }

  const isCompatible = missingFeatures.length === 0;

  const recommendedBrowsers = [
    'Chrome 90+ (recommended)',
    'Edge 90+',
    'Safari 15+',
    'Firefox 90+',
  ];

  return {
    isCompatible,
    features,
    missingFeatures,
    warnings,
    recommendedBrowsers,
  };
}

/**
 * Gets a user-friendly compatibility message
 */
export function getCompatibilityMessage(result: CompatibilityResult): string {
  if (result.isCompatible) {
    if (result.warnings.length > 0) {
      return `Your browser is compatible! Note: ${result.warnings.join(', ')}`;
    }
    return 'Your browser is fully compatible!';
  }

  const missing = result.missingFeatures.join(', ');
  return `Your browser is missing required features: ${missing}. Please use one of the recommended browsers: ${result.recommendedBrowsers.join(', ')}.`;
}

/**
 * Determines if the app should use fallback mode
 */
export function shouldUseFallbackMode(result: CompatibilityResult): {
  use2DMode: boolean;
  disableCollaboration: boolean;
} {
  return {
    use2DMode: !result.features.webXR,
    disableCollaboration: !result.features.webSocket,
  };
}
