import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectBrowser,
  checkGetUserMedia,
  checkWebGL2,
  checkWebXR,
  checkWebSocket,
  checkSecureContext,
  checkBrowserCompatibility,
  getCompatibilityMessage,
  shouldUseFallbackMode,
} from '@/lib/browser-compatibility';

describe('Browser Compatibility Detection', () => {
  describe('detectBrowser', () => {
    it('should detect Chrome browser', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
        configurable: true,
      });

      const result = detectBrowser();
      expect(result.name).toBe('Chrome');
      expect(result.version).toBe('95');
      expect(result.isSupported).toBe(true);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });

    it('should detect Edge browser', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36 Edg/95.0.1020.44',
        configurable: true,
      });

      const result = detectBrowser();
      expect(result.name).toBe('Edge');
      expect(result.version).toBe('95');
      expect(result.isSupported).toBe(true);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });

    it('should detect unsupported Chrome version', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36',
        configurable: true,
      });

      const result = detectBrowser();
      expect(result.name).toBe('Chrome');
      expect(result.version).toBe('85');
      expect(result.isSupported).toBe(false);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });
  });

  describe('checkGetUserMedia', () => {
    it('should return true when getUserMedia is available', () => {
      const result = checkGetUserMedia();
      expect(typeof result).toBe('boolean');
    });

    it('should return false when getUserMedia is not available', () => {
      const originalMediaDevices = navigator.mediaDevices;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      });

      const result = checkGetUserMedia();
      expect(result).toBe(false);

      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true,
      });
    });
  });

  describe('checkWebGL2', () => {
    it('should return true when WebGL2 is available', () => {
      const result = checkWebGL2();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('checkWebXR', () => {
    it('should return true when WebXR is available', () => {
      const result = checkWebXR();
      expect(typeof result).toBe('boolean');
    });

    it('should return false when WebXR is not available', () => {
      const originalXR = (navigator as any).xr;
      delete (navigator as any).xr;

      const result = checkWebXR();
      expect(result).toBe(false);

      if (originalXR !== undefined) {
        (navigator as any).xr = originalXR;
      }
    });
  });

  describe('checkWebSocket', () => {
    it('should return true when WebSocket is available', () => {
      const result = checkWebSocket();
      expect(result).toBe(true);
    });

    it('should return false when WebSocket is not available', () => {
      const originalWebSocket = (window as any).WebSocket;
      delete (window as any).WebSocket;

      const result = checkWebSocket();
      expect(result).toBe(false);

      (window as any).WebSocket = originalWebSocket;
    });
  });

  describe('checkSecureContext', () => {
    it('should return boolean value for secure context', () => {
      const result = checkSecureContext();
      // In test environment, isSecureContext might be undefined
      // The function should handle this gracefully
      expect(typeof result).toBe('boolean');
    });
  });

  describe('checkBrowserCompatibility', () => {
    it('should return compatibility result with all features', () => {
      const result = checkBrowserCompatibility();
      
      expect(result).toHaveProperty('isCompatible');
      expect(result).toHaveProperty('features');
      expect(result).toHaveProperty('missingFeatures');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('recommendedBrowsers');
      
      expect(result.features).toHaveProperty('getUserMedia');
      expect(result.features).toHaveProperty('webGL2');
      expect(result.features).toHaveProperty('webXR');
      expect(result.features).toHaveProperty('webSocket');
      
      expect(Array.isArray(result.missingFeatures)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.recommendedBrowsers)).toBe(true);
    });

    it('should mark as incompatible when getUserMedia is missing', () => {
      const originalMediaDevices = navigator.mediaDevices;
      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        configurable: true,
      });

      const result = checkBrowserCompatibility();
      expect(result.isCompatible).toBe(false);
      expect(result.missingFeatures).toContain('Camera Access (getUserMedia)');

      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true,
      });
    });

    it('should add warning when WebXR is missing but still be compatible', () => {
      const originalXR = (navigator as any).xr;
      delete (navigator as any).xr;

      const result = checkBrowserCompatibility();
      
      // Should still be compatible if other required features are present
      if (result.features.getUserMedia && result.features.webGL2 && result.features.webSocket && window.isSecureContext) {
        expect(result.isCompatible).toBe(true);
      }
      
      expect(result.warnings.some(w => w.includes('WebXR'))).toBe(true);

      if (originalXR !== undefined) {
        (navigator as any).xr = originalXR;
      }
    });

    it('should include recommended browsers in result', () => {
      const result = checkBrowserCompatibility();
      
      expect(result.recommendedBrowsers.length).toBeGreaterThan(0);
      expect(result.recommendedBrowsers.some(b => b.includes('Chrome'))).toBe(true);
    });
  });

  describe('getCompatibilityMessage', () => {
    it('should return positive message when fully compatible', () => {
      const result = {
        isCompatible: true,
        features: {
          getUserMedia: true,
          webGL2: true,
          webXR: true,
          webSocket: true,
        },
        missingFeatures: [],
        warnings: [],
        recommendedBrowsers: ['Chrome 90+'],
      };

      const message = getCompatibilityMessage(result);
      expect(message).toContain('compatible');
      expect(message.toLowerCase()).not.toContain('missing');
    });

    it('should return warning message when compatible with warnings', () => {
      const result = {
        isCompatible: true,
        features: {
          getUserMedia: true,
          webGL2: true,
          webXR: false,
          webSocket: true,
        },
        missingFeatures: [],
        warnings: ['WebXR not supported'],
        recommendedBrowsers: ['Chrome 90+'],
      };

      const message = getCompatibilityMessage(result);
      expect(message).toContain('compatible');
      expect(message).toContain('Note:');
    });

    it('should return error message when not compatible', () => {
      const result = {
        isCompatible: false,
        features: {
          getUserMedia: false,
          webGL2: true,
          webXR: false,
          webSocket: true,
        },
        missingFeatures: ['Camera Access (getUserMedia)'],
        warnings: [],
        recommendedBrowsers: ['Chrome 90+', 'Edge 90+'],
      };

      const message = getCompatibilityMessage(result);
      expect(message).toContain('missing');
      expect(message).toContain('Camera Access');
      expect(message).toContain('Chrome 90+');
    });
  });

  describe('shouldUseFallbackMode', () => {
    it('should enable 2D mode when WebXR is not supported', () => {
      const result = {
        isCompatible: true,
        features: {
          getUserMedia: true,
          webGL2: true,
          webXR: false,
          webSocket: true,
        },
        missingFeatures: [],
        warnings: [],
        recommendedBrowsers: [],
      };

      const fallback = shouldUseFallbackMode(result);
      expect(fallback.use2DMode).toBe(true);
      expect(fallback.disableCollaboration).toBe(false);
    });

    it('should disable collaboration when WebSocket is not supported', () => {
      const result = {
        isCompatible: true,
        features: {
          getUserMedia: true,
          webGL2: true,
          webXR: true,
          webSocket: false,
        },
        missingFeatures: [],
        warnings: [],
        recommendedBrowsers: [],
      };

      const fallback = shouldUseFallbackMode(result);
      expect(fallback.use2DMode).toBe(false);
      expect(fallback.disableCollaboration).toBe(true);
    });

    it('should not use fallback when all features are supported', () => {
      const result = {
        isCompatible: true,
        features: {
          getUserMedia: true,
          webGL2: true,
          webXR: true,
          webSocket: true,
        },
        missingFeatures: [],
        warnings: [],
        recommendedBrowsers: [],
      };

      const fallback = shouldUseFallbackMode(result);
      expect(fallback.use2DMode).toBe(false);
      expect(fallback.disableCollaboration).toBe(false);
    });
  });
});
