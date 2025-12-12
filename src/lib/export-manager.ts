/**
 * Export Manager
 * 
 * Manages exporting generated images with metadata:
 * - Single image export with prompt and metadata
 * - Multiple image export in a single archive
 * - PSD-compatible export format
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import JSZip from 'jszip';
import type { GenerationResult } from '@/lib/bria-client';
import type { FIBOStructuredPrompt } from '@/types/fibo';

// ============ Types ============

/**
 * Export format options
 */
export type ExportFormat = 'zip' | 'psd';

/**
 * Export metadata structure
 */
export interface ExportMetadata {
  timestamp: string;
  seed: number;
  requestId: string;
  generationOptions?: {
    steps_num?: number;
    guidance_scale?: number;
    aspect_ratio?: string;
  };
  exportedAt: string;
  version: string;
}

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format (default: 'zip') */
  format?: ExportFormat;
  /** Include generation options in metadata */
  includeGenerationOptions?: boolean;
  /** Custom filename prefix (default: 'sculptnet-export') */
  filenamePrefix?: string;
}

// ============ Constants ============

/** Default filename prefix */
const DEFAULT_FILENAME_PREFIX = 'sculptnet-export';

/** Export version for compatibility tracking */
const EXPORT_VERSION = '1.0.0';

// ============ Error Classes ============

/**
 * Export error class
 */
export class ExportError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ExportError';
  }
}

// ============ Export Manager Class ============

/**
 * Export Manager
 * 
 * Handles packaging and downloading of generated images with metadata
 */
export class ExportManager {
  /**
   * Export a single generation result
   * 
   * @param result - Generation result to export
   * @param options - Export options
   */
  async exportSingle(
    result: GenerationResult,
    options: ExportOptions = {}
  ): Promise<void> {
    try {
      const format = options.format ?? 'zip';
      
      if (format === 'psd') {
        await this.exportAsPSD(result, options);
      } else {
        await this.exportAsZip([result], options);
      }
    } catch (error) {
      throw new ExportError(
        `Failed to export single image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXPORT_SINGLE_FAILED'
      );
    }
  }

  /**
   * Export multiple generation results in a single archive
   * 
   * @param results - Array of generation results to export
   * @param options - Export options
   */
  async exportMultiple(
    results: GenerationResult[],
    options: ExportOptions = {}
  ): Promise<void> {
    if (results.length === 0) {
      throw new ExportError('No images to export', 'NO_IMAGES');
    }

    try {
      await this.exportAsZip(results, options);
    } catch (error) {
      throw new ExportError(
        `Failed to export multiple images: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXPORT_MULTIPLE_FAILED'
      );
    }
  }

  /**
   * Export as ZIP archive
   * 
   * @param results - Generation results to export
   * @param options - Export options
   */
  private async exportAsZip(
    results: GenerationResult[],
    options: ExportOptions = {}
  ): Promise<void> {
    const zip = new JSZip();
    
    // Add each image with its metadata
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const prefix = results.length > 1 ? `image-${i + 1}` : 'image';
      
      // Fetch and add image
      const imageBlob = await this.fetchImageAsBlob(result.imageUrl);
      zip.file(`${prefix}.png`, imageBlob);
      
      // Add prompt JSON
      const promptJson = this.formatPromptJson(result.prompt);
      zip.file(`${prefix}-prompt.json`, promptJson);
      
      // Add metadata
      const metadata = this.createMetadata(result, options);
      zip.file(`${prefix}-metadata.txt`, metadata);
    }
    
    // Generate and download ZIP
    const blob = await zip.generateAsync({ type: 'blob' });
    const filename = this.generateFilename(options.filenamePrefix, 'zip');
    this.triggerDownload(blob, filename);
  }

  /**
   * Export as PSD-compatible format
   * 
   * @param result - Generation result to export
   * @param options - Export options
   */
  async exportAsPSD(
    result: GenerationResult,
    options: ExportOptions = {}
  ): Promise<void> {
    // For MVP, create a ZIP with PSD-compatible metadata structure
    // Full PSD binary format would require a dedicated library
    const zip = new JSZip();
    
    // Fetch image
    const imageBlob = await this.fetchImageAsBlob(result.imageUrl);
    zip.file('image.png', imageBlob);
    
    // Create XMP metadata for Photoshop compatibility
    const xmpMetadata = this.createXMPMetadata(result);
    zip.file('metadata.xmp', xmpMetadata);
    
    // Add prompt JSON
    const promptJson = this.formatPromptJson(result.prompt);
    zip.file('prompt.json', promptJson);
    
    // Add standard metadata
    const metadata = this.createMetadata(result, options);
    zip.file('metadata.txt', metadata);
    
    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' });
    const filename = this.generateFilename(options.filenamePrefix, 'psd.zip');
    this.triggerDownload(blob, filename);
  }

  /**
   * Fetch image from URL as Blob
   * 
   * @param imageUrl - URL of the image
   * @returns Image blob
   */
  private async fetchImageAsBlob(imageUrl: string): Promise<Blob> {
    try {
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: HTTP ${response.status}`);
      }
      
      return await response.blob();
    } catch (error) {
      throw new ExportError(
        `Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'IMAGE_FETCH_FAILED'
      );
    }
  }

  /**
   * Format prompt as JSON string
   * 
   * @param prompt - FIBO prompt or string
   * @returns Formatted JSON string
   */
  private formatPromptJson(prompt: FIBOStructuredPrompt | string): string {
    if (typeof prompt === 'string') {
      return JSON.stringify({ prompt }, null, 2);
    }
    return JSON.stringify(prompt, null, 2);
  }

  /**
   * Create metadata text file content
   * 
   * @param result - Generation result
   * @param options - Export options
   * @returns Metadata text content
   */
  private createMetadata(
    result: GenerationResult,
    options: ExportOptions
  ): string {
    const lines: string[] = [
      'SculptNet Export Metadata',
      '=========================',
      '',
      `Export Version: ${EXPORT_VERSION}`,
      `Exported At: ${new Date().toISOString()}`,
      '',
      'Generation Information:',
      `- Timestamp: ${new Date(result.timestamp).toISOString()}`,
      `- Seed: ${result.seed}`,
      `- Request ID: ${result.requestId}`,
      '',
    ];
    
    // Add generation options if available and requested
    if (options.includeGenerationOptions) {
      lines.push('Generation Options:');
      lines.push('- (Options would be included if passed to export)');
      lines.push('');
    }
    
    // Add prompt summary
    if (typeof result.prompt !== 'string') {
      lines.push('Prompt Summary:');
      lines.push(`- Description: ${result.prompt.short_description}`);
      lines.push(`- Style: ${result.prompt.style_medium}`);
      lines.push(`- Camera Angle: ${result.prompt.photographic_characteristics.camera_angle}`);
      lines.push(`- Lens: ${result.prompt.photographic_characteristics.lens_focal_length}`);
      lines.push(`- Lighting: ${result.prompt.lighting.conditions}`);
      lines.push(`- Composition: ${result.prompt.aesthetics.composition}`);
      lines.push('');
    }
    
    lines.push('For full prompt details, see the accompanying prompt.json file.');
    
    return lines.join('\n');
  }

  /**
   * Create XMP metadata for Photoshop compatibility
   * 
   * @param result - Generation result
   * @returns XMP metadata XML string
   */
  private createXMPMetadata(result: GenerationResult): string {
    const prompt = typeof result.prompt === 'string' 
      ? result.prompt 
      : result.prompt.short_description;
    
    const timestamp = new Date(result.timestamp).toISOString();
    
    // Basic XMP structure for Photoshop compatibility
    return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:sculptnet="http://sculptnet.ai/ns/1.0/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">SculptNet Generated Image</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${this.escapeXml(prompt)}</rdf:li>
        </rdf:Alt>
      </dc:description>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>SculptNet AI</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <xmp:CreateDate>${timestamp}</xmp:CreateDate>
      <xmp:CreatorTool>SculptNet v${EXPORT_VERSION}</xmp:CreatorTool>
      <sculptnet:seed>${result.seed}</sculptnet:seed>
      <sculptnet:requestId>${result.requestId}</sculptnet:requestId>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
  }

  /**
   * Escape XML special characters
   * 
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generate descriptive filename with timestamp
   * 
   * @param prefix - Filename prefix
   * @param extension - File extension
   * @returns Generated filename
   */
  private generateFilename(
    prefix: string | undefined,
    extension: string
  ): string {
    const filenamePrefix = prefix ?? DEFAULT_FILENAME_PREFIX;
    const now = new Date();
    
    // Format: YYYY-MM-DD-HH-MM-SS
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('-');
    
    return `${filenamePrefix}-${timestamp}.${extension}`;
  }

  /**
   * Trigger browser download of blob
   * 
   * @param blob - Blob to download
   * @param filename - Download filename
   */
  private triggerDownload(blob: Blob, filename: string): void {
    try {
      // Create blob URL
      const url = URL.createObjectURL(blob);
      
      // Create temporary anchor element
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(anchor);
      anchor.click();
      
      // Cleanup
      document.body.removeChild(anchor);
      
      // Revoke blob URL after a delay to ensure download starts
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      throw new ExportError(
        `Failed to trigger download: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DOWNLOAD_FAILED'
      );
    }
  }
}

// ============ Singleton Instance ============

/** Default export manager instance */
let defaultManager: ExportManager | null = null;

/**
 * Get the default export manager instance
 */
export function getExportManager(): ExportManager {
  if (!defaultManager) {
    defaultManager = new ExportManager();
  }
  return defaultManager;
}

/**
 * Create a new export manager instance
 */
export function createExportManager(): ExportManager {
  return new ExportManager();
}

// ============ Convenience Functions ============

/**
 * Export a single generation result
 * 
 * @param result - Generation result to export
 * @param options - Export options
 */
export async function exportSingle(
  result: GenerationResult,
  options: ExportOptions = {}
): Promise<void> {
  return getExportManager().exportSingle(result, options);
}

/**
 * Export multiple generation results
 * 
 * @param results - Generation results to export
 * @param options - Export options
 */
export async function exportMultiple(
  results: GenerationResult[],
  options: ExportOptions = {}
): Promise<void> {
  return getExportManager().exportMultiple(results, options);
}

/**
 * Export as PSD-compatible format
 * 
 * @param result - Generation result to export
 * @param options - Export options
 */
export async function exportAsPSD(
  result: GenerationResult,
  options: ExportOptions = {}
): Promise<void> {
  return getExportManager().exportAsPSD(result, options);
}
