/**
 * FIBO Structured Prompt Types and Zod Schema
 * 
 * Defines TypeScript types and Zod validation schema for Bria AI's FIBO model
 * structured prompts. Used by the JSON State Manager for validation.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { z } from 'zod';

// ============ Zod Schemas ============

/**
 * Lighting configuration schema
 */
export const LightingSchema = z.object({
  conditions: z.string().min(1, 'Lighting conditions are required'),
  direction: z.string().min(1, 'Lighting direction is required'),
  shadows: z.string().min(1, 'Shadow description is required'),
});

/**
 * Aesthetics configuration schema
 */
export const AestheticsSchema = z.object({
  composition: z.string().min(1, 'Composition is required'),
  color_scheme: z.string().min(1, 'Color scheme is required'),
  mood_atmosphere: z.string().min(1, 'Mood/atmosphere is required'),
  preference_score: z.string().optional(),
  aesthetic_score: z.string().optional(),
});

/**
 * Photographic characteristics schema
 */
export const PhotographicCharacteristicsSchema = z.object({
  depth_of_field: z.string().min(1, 'Depth of field is required'),
  focus: z.string().min(1, 'Focus description is required'),
  camera_angle: z.string().min(1, 'Camera angle is required'),
  lens_focal_length: z.string().min(1, 'Lens focal length is required'),
});

/**
 * Object in scene schema
 */
export const SceneObjectSchema = z.object({
  description: z.string().min(1, 'Object description is required'),
  location: z.string().min(1, 'Object location is required'),
  relationship: z.string().optional(),
  relative_size: z.string().optional(),
  shape_and_color: z.string().optional(),
  texture: z.string().optional(),
  appearance_details: z.string().optional(),
  number_of_objects: z.number().int().positive().optional(),
  orientation: z.string().optional(),
  expression: z.string().optional(),
});

/**
 * Text render element schema
 */
export const TextRenderSchema = z.object({
  text: z.string().min(1, 'Text content is required'),
  location: z.string().min(1, 'Text location is required'),
  size: z.string().min(1, 'Text size is required'),
  color: z.string().min(1, 'Text color is required'),
  font: z.string().min(1, 'Font is required'),
  appearance_details: z.string().optional(),
});


/**
 * Full FIBO Structured Prompt Schema
 * Based on official Bria FIBO documentation
 */
export const FIBOStructuredPromptSchema = z.object({
  // Core description
  short_description: z.string().min(1, 'Short description is required'),
  
  // Objects in the scene (REQUIRED by Bria API)
  objects: z.array(SceneObjectSchema).min(1, 'At least one object is required'),
  
  // Environment
  background_setting: z.string().min(1, 'Background setting is required'),
  
  // Lighting configuration
  lighting: LightingSchema,
  
  // Visual aesthetics
  aesthetics: AestheticsSchema,
  
  // Camera/photography settings
  photographic_characteristics: PhotographicCharacteristicsSchema,
  
  // Style
  style_medium: z.string().min(1, 'Style medium is required'),
  artistic_style: z.string().optional(),
  
  // Optional text rendering
  text_render: z.array(TextRenderSchema).optional(),
  
  // Context (REQUIRED by Bria API)
  context: z.string().min(1, 'Context is required'),
});

/**
 * Simplified FIBO Schema for gesture mapping
 * Contains only the fields that can be modified via gestures
 */
export const SimplifiedFIBOPromptSchema = z.object({
  short_description: z.string().min(1),
  background_setting: z.string().min(1),
  lighting: LightingSchema,
  aesthetics: AestheticsSchema,
  photographic_characteristics: PhotographicCharacteristicsSchema,
  style_medium: z.string().min(1),
  artistic_style: z.string().optional(),
});

// ============ TypeScript Types (inferred from Zod schemas) ============

export type Lighting = z.infer<typeof LightingSchema>;
export type Aesthetics = z.infer<typeof AestheticsSchema>;
export type PhotographicCharacteristics = z.infer<typeof PhotographicCharacteristicsSchema>;
export type SceneObject = z.infer<typeof SceneObjectSchema>;
export type TextRender = z.infer<typeof TextRenderSchema>;
export type FIBOStructuredPrompt = z.infer<typeof FIBOStructuredPromptSchema>;
export type SimplifiedFIBOPrompt = z.infer<typeof SimplifiedFIBOPromptSchema>;

// ============ Default Values ============

/**
 * Default lighting configuration
 */
export const DEFAULT_LIGHTING: Lighting = {
  conditions: 'soft volumetric god rays from left',
  direction: 'overhead and slightly front-lit',
  shadows: 'soft, diffused shadows',
};

/**
 * Default aesthetics configuration
 */
export const DEFAULT_AESTHETICS: Aesthetics = {
  composition: 'rule of thirds',
  color_scheme: 'warm complementary colors',
  mood_atmosphere: 'elegant, sophisticated',
};

/**
 * Default photographic characteristics
 */
export const DEFAULT_PHOTOGRAPHIC_CHARACTERISTICS: PhotographicCharacteristics = {
  depth_of_field: 'shallow, with subject in sharp focus',
  focus: 'sharp focus on subject',
  camera_angle: 'eye level',
  lens_focal_length: '50mm standard',
};

/**
 * Default base FIBO prompt with all required fields
 * Used to initialize the JSON State Manager
 */
export const DEFAULT_FIBO_PROMPT: FIBOStructuredPrompt = {
  short_description: 'abstract sculpture in a studio setting',
  objects: [
    {
      description: 'an abstract sculptural form with smooth, flowing curves',
      location: 'center',
      relationship: 'primary subject of the composition',
      relative_size: 'large within frame',
      shape_and_color: 'organic, flowing shape with neutral tones',
      texture: 'smooth, polished surface',
      appearance_details: 'modern, minimalist aesthetic with clean lines',
      number_of_objects: 1,
      orientation: 'upright',
    },
  ],
  background_setting: 'clean studio environment with neutral backdrop',
  lighting: DEFAULT_LIGHTING,
  aesthetics: DEFAULT_AESTHETICS,
  photographic_characteristics: DEFAULT_PHOTOGRAPHIC_CHARACTERISTICS,
  style_medium: 'photograph',
  artistic_style: 'realistic, detailed',
  context: 'This is a professional product photograph for a gallery or portfolio, showcasing the sculptural form with attention to lighting and composition.',
};

// ============ Validation Utilities ============

/**
 * Validation result type
 */
export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
}

/**
 * Validation error type
 */
export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Validate a FIBO prompt against the schema
 * @param prompt - The prompt to validate
 * @returns ValidationResult with success status and any errors
 */
export function validateFIBOPrompt(prompt: unknown): ValidationResult {
  const result = FIBOStructuredPromptSchema.safeParse(prompt);
  
  if (result.success) {
    return { success: true, errors: [] };
  }
  
  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  
  return { success: false, errors };
}

/**
 * Validate a simplified FIBO prompt
 * @param prompt - The prompt to validate
 * @returns ValidationResult with success status and any errors
 */
export function validateSimplifiedPrompt(prompt: unknown): ValidationResult {
  const result = SimplifiedFIBOPromptSchema.safeParse(prompt);
  
  if (result.success) {
    return { success: true, errors: [] };
  }
  
  const errors: ValidationError[] = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  
  return { success: false, errors };
}

/**
 * Check if a value is a valid FIBOStructuredPrompt
 * Type guard function
 */
export function isFIBOStructuredPrompt(value: unknown): value is FIBOStructuredPrompt {
  return FIBOStructuredPromptSchema.safeParse(value).success;
}
