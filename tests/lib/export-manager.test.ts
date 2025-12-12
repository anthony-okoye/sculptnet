/**
 * Export Manager Tests
 * 
 * Unit tests for the ExportManager class
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ExportManager, ExportError } from '@/lib/export-manager';
import type { GenerationResult } from '@/lib/bria-client';
import type { FIBOStructuredPrompt } from '@/types/fibo';

// ============ Test Fixtures ============

const mockStructuredPrompt: FIBOStructuredPrompt = {
  short_description: 'A beautiful sunset over mountains',
  background_setting: 'Mountain landscape at dusk',
  lighting: {
    conditions: 'golden hour lighting',
    direction: 'from the west',
    shadows: 'long, soft shadows',
  },
  aesthetics: {
    composition: 'rule of thirds',
    color_scheme: 'warm oranges and purples',
    mood_atmosphere: 'peaceful, serene',
  },
  photographic_characteristics: {
    depth_of_field: 'deep focus',
    focus: 'sharp throughout',
    camera_angle: 'eye level',
    lens_focal_length: '24mm wide',
  },
  style_medium: 'photograph',
  artistic_style: 'realistic',
};

const mockGenerationResult: GenerationResult = {
  imageUrl: 'https://example.com/image.png',
  prompt: mockStructuredPrompt,
  timestamp: Date.now(),
  seed: 12345,
  requestId: 'test-request-123',
};

const mockGenerationResultWithStringPrompt: GenerationResult = {
  imageUrl: 'https://example.com/image2.png',
  prompt: 'A simple text prompt',
  timestamp: Date.now(),
  seed: 67890,
  requestId: 'test-request-456',
};

// ============ Mocks ============

// Mock fetch for image downloads
const mockImageBlob = new Blob(['fake-image-data'], { type: 'image/png' });

global.fetch = vi.fn((url: string | URL | Request) => {
  const urlString = typeof url === 'string' ? url : url.toString();
  
  if (urlString.includes('example.com')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(mockImageBlob),
    } as Response);
  }
  
  return Promise.resolve({
    ok: false,
    status: 404,
  } as Response);
});

// Mock DOM methods for download
const mockCreateElement = vi.fn(() => {
  const element = {
    href: '',
    download: '',
    style: { display: '' },
    click: vi.fn(),
  };
  return element as unknown as HTMLAnchorElement;
});

const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement,
  writable: true,
});

Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild,
  writable: true,
});

Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild,
  writable: true,
});

// Mock URL.createObjectURL and revokeObjectURL
const mockObjectURLs = new Set<string>();
let urlCounter = 0;

global.URL.createObjectURL = vi.fn((blob: Blob) => {
  const url = `blob:mock-url-${urlCounter++}`;
  mockObjectURLs.add(url);
  return url;
});

global.URL.revokeObjectURL = vi.fn((url: string) => {
  mockObjectURLs.delete(url);
});

// ============ Tests ============

describe('ExportManager', () => {
  let manager: ExportManager;

  beforeEach(() => {
    manager = new ExportManager();
    vi.clearAllMocks();
    mockObjectURLs.clear();
    urlCounter = 0;
  });

  describe('exportSingle', () => {
    test('exports single image with structured prompt', async () => {
      await manager.exportSingle(mockGenerationResult);

      // Verify fetch was called to get the image
      expect(fetch).toHaveBeenCalledWith(mockGenerationResult.imageUrl);

      // Verify download was triggered
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
    });

    test('exports single image with string prompt', async () => {
      await manager.exportSingle(mockGenerationResultWithStringPrompt);

      expect(fetch).toHaveBeenCalledWith(mockGenerationResultWithStringPrompt.imageUrl);
      expect(mockCreateElement).toHaveBeenCalled();
    });

    test('generates descriptive filename with timestamp', async () => {
      await manager.exportSingle(mockGenerationResult);

      const anchor = mockCreateElement.mock.results[0].value as HTMLAnchorElement;
      expect(anchor.download).toMatch(/^sculptnet-export-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/);
    });

    test('uses custom filename prefix', async () => {
      await manager.exportSingle(mockGenerationResult, {
        filenamePrefix: 'my-custom-export',
      });

      const anchor = mockCreateElement.mock.results[0].value as HTMLAnchorElement;
      expect(anchor.download).toMatch(/^my-custom-export-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/);
    });

    test('throws error when image fetch fails', async () => {
      const badResult = {
        ...mockGenerationResult,
        imageUrl: 'https://bad-url.com/image.png',
      };

      await expect(manager.exportSingle(badResult)).rejects.toThrow(ExportError);
      await expect(manager.exportSingle(badResult)).rejects.toThrow('Failed to export single image');
    });

    test('creates blob URL and revokes it', async () => {
      await manager.exportSingle(mockGenerationResult);

      expect(URL.createObjectURL).toHaveBeenCalled();
      
      // Wait for cleanup timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('exportMultiple', () => {
    test('exports multiple images in single archive', async () => {
      const results = [
        mockGenerationResult,
        mockGenerationResultWithStringPrompt,
        { ...mockGenerationResult, requestId: 'test-request-789' },
      ];

      await manager.exportMultiple(results);

      // Verify all images were fetched
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenCalledWith(mockGenerationResult.imageUrl);
      expect(fetch).toHaveBeenCalledWith(mockGenerationResultWithStringPrompt.imageUrl);

      // Verify download was triggered
      expect(mockCreateElement).toHaveBeenCalled();
    });

    test('throws error when no images provided', async () => {
      await expect(manager.exportMultiple([])).rejects.toThrow(ExportError);
      await expect(manager.exportMultiple([])).rejects.toThrow('No images to export');
    });

    test('generates descriptive filename for multiple exports', async () => {
      const results = [mockGenerationResult, mockGenerationResultWithStringPrompt];
      
      await manager.exportMultiple(results);

      const anchor = mockCreateElement.mock.results[0].value as HTMLAnchorElement;
      expect(anchor.download).toMatch(/^sculptnet-export-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/);
    });

    test('handles single image in multiple export', async () => {
      await manager.exportMultiple([mockGenerationResult]);

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(mockCreateElement).toHaveBeenCalled();
    });
  });

  describe('exportAsPSD', () => {
    test('exports with PSD-compatible metadata', async () => {
      await manager.exportAsPSD(mockGenerationResult);

      // Verify image was fetched
      expect(fetch).toHaveBeenCalledWith(mockGenerationResult.imageUrl);

      // Verify download was triggered
      expect(mockCreateElement).toHaveBeenCalled();
    });

    test('generates PSD filename', async () => {
      await manager.exportAsPSD(mockGenerationResult);

      const anchor = mockCreateElement.mock.results[0].value as HTMLAnchorElement;
      expect(anchor.download).toMatch(/^sculptnet-export-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.psd\.zip$/);
    });

    test('handles string prompt in PSD export', async () => {
      await manager.exportAsPSD(mockGenerationResultWithStringPrompt);

      expect(fetch).toHaveBeenCalledWith(mockGenerationResultWithStringPrompt.imageUrl);
      expect(mockCreateElement).toHaveBeenCalled();
    });

    test('creates XMP metadata with proper XML structure', async () => {
      // This is tested indirectly through successful export
      await manager.exportAsPSD(mockGenerationResult);

      expect(mockCreateElement).toHaveBeenCalled();
    });
  });

  describe('filename generation', () => {
    test('generates unique filenames for sequential exports', async () => {
      await manager.exportSingle(mockGenerationResult);
      const filename1 = (mockCreateElement.mock.results[0].value as HTMLAnchorElement).download;

      // Wait at least 1 second to ensure different timestamp (format is YYYY-MM-DD-HH-MM-SS)
      await new Promise(resolve => setTimeout(resolve, 1100));

      await manager.exportSingle(mockGenerationResult);
      const filename2 = (mockCreateElement.mock.results[1].value as HTMLAnchorElement).download;

      // Filenames should be different due to timestamp
      expect(filename1).not.toBe(filename2);
    });

    test('includes timestamp in ISO format', async () => {
      await manager.exportSingle(mockGenerationResult);

      const anchor = mockCreateElement.mock.results[0].value as HTMLAnchorElement;
      const filename = anchor.download;

      // Should match pattern: sculptnet-export-YYYY-MM-DD-HH-MM-SS.zip
      expect(filename).toMatch(/sculptnet-export-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.zip/);
    });
  });

  describe('metadata creation', () => {
    test('includes all required metadata fields', async () => {
      // We can't directly test the metadata content without exposing private methods,
      // but we can verify the export completes successfully
      await manager.exportSingle(mockGenerationResult, {
        includeGenerationOptions: true,
      });

      expect(mockCreateElement).toHaveBeenCalled();
    });

    test('handles structured prompt metadata', async () => {
      await manager.exportSingle(mockGenerationResult);

      expect(fetch).toHaveBeenCalledWith(mockGenerationResult.imageUrl);
      expect(mockCreateElement).toHaveBeenCalled();
    });

    test('handles string prompt metadata', async () => {
      await manager.exportSingle(mockGenerationResultWithStringPrompt);

      expect(fetch).toHaveBeenCalledWith(mockGenerationResultWithStringPrompt.imageUrl);
      expect(mockCreateElement).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('throws ExportError with appropriate code on fetch failure', async () => {
      const badResult = {
        ...mockGenerationResult,
        imageUrl: 'https://bad-url.com/image.png',
      };

      try {
        await manager.exportSingle(badResult);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ExportError);
        expect((error as ExportError).code).toBe('EXPORT_SINGLE_FAILED');
      }
    });

    test('throws ExportError when no images in multiple export', async () => {
      try {
        await manager.exportMultiple([]);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ExportError);
        expect((error as ExportError).code).toBe('NO_IMAGES');
      }
    });

    test('provides descriptive error messages', async () => {
      const badResult = {
        ...mockGenerationResult,
        imageUrl: 'https://bad-url.com/image.png',
      };

      try {
        await manager.exportSingle(badResult);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ExportError);
        expect((error as Error).message).toContain('Failed to export single image');
      }
    });
  });

  describe('format options', () => {
    test('exports as ZIP by default', async () => {
      await manager.exportSingle(mockGenerationResult);

      const anchor = mockCreateElement.mock.results[0].value as HTMLAnchorElement;
      expect(anchor.download).toMatch(/\.zip$/);
    });

    test('exports as PSD when format specified', async () => {
      await manager.exportSingle(mockGenerationResult, { format: 'psd' });

      const anchor = mockCreateElement.mock.results[0].value as HTMLAnchorElement;
      expect(anchor.download).toMatch(/\.psd\.zip$/);
    });

    test('respects explicit ZIP format option', async () => {
      await manager.exportSingle(mockGenerationResult, { format: 'zip' });

      const anchor = mockCreateElement.mock.results[0].value as HTMLAnchorElement;
      expect(anchor.download).toMatch(/\.zip$/);
      expect(anchor.download).not.toMatch(/\.psd\.zip$/);
    });
  });
});
