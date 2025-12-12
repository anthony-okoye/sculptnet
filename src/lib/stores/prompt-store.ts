/**
 * JSON State Manager with Zustand
 * 
 * Manages FIBO structured prompt state with:
 * - Deep merge for nested parameter updates
 * - Zod schema validation
 * - Revert-on-validation-failure logic
 * - Export/import functionality
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { create } from 'zustand';
import { 
  type FIBOStructuredPrompt,
  type ValidationResult,
  DEFAULT_FIBO_PROMPT,
  validateFIBOPrompt,
} from '@/types/fibo';

// ============ Types ============

/**
 * Update result type
 */
export interface UpdateResult {
  success: boolean;
  previousValue?: unknown;
  error?: string;
}

/**
 * Prompt store state
 */
export interface PromptState {
  /** Current FIBO structured prompt */
  prompt: FIBOStructuredPrompt;
  /** Last valid prompt (for revert on failure) */
  lastValidPrompt: FIBOStructuredPrompt;
  /** Whether the store has been initialized */
  initialized: boolean;
  /** Last validation result */
  lastValidation: ValidationResult | null;
}

/**
 * Prompt store actions
 */
export interface PromptActions {
  /** Initialize the store with a base prompt */
  initialize: (basePrompt?: Partial<FIBOStructuredPrompt>) => void;
  /** Update a specific path in the prompt */
  update: (path: string, value: unknown) => UpdateResult;
  /** Get the current prompt */
  getPrompt: () => FIBOStructuredPrompt;
  /** Validate the current prompt */
  validate: () => ValidationResult;
  /** Reset to default prompt */
  reset: () => void;
  /** Export prompt as JSON string */
  export: () => string;
  /** Import prompt from JSON string */
  import: (json: string) => UpdateResult;
}

export type PromptStore = PromptState & PromptActions;

// ============ Utility Functions ============

/**
 * Deep merge two objects
 * @param target - Target object
 * @param source - Source object to merge
 * @returns Merged object
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];
      
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge nested objects
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        // Direct assignment for primitives and arrays
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }
  
  return result;
}


/**
 * Get a value at a nested path in an object
 * @param obj - Object to get value from
 * @param path - Dot-separated path (e.g., "camera.fov")
 * @returns Value at path or undefined
 */
function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  
  return current;
}

/**
 * Set a value at a nested path in an object (immutably)
 * @param obj - Object to update
 * @param path - Dot-separated path (e.g., "camera.fov")
 * @param value - Value to set
 * @returns New object with updated value
 */
function setAtPath<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): T {
  const keys = path.split('.');
  
  if (keys.length === 0) {
    return obj;
  }
  
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value };
  }
  
  const [firstKey, ...restKeys] = keys;
  const currentValue = obj[firstKey];
  
  // If current value is not an object, create one
  const nestedObj = (
    currentValue !== null && 
    typeof currentValue === 'object' && 
    !Array.isArray(currentValue)
  ) ? currentValue as Record<string, unknown> : {};
  
  return {
    ...obj,
    [firstKey]: setAtPath(nestedObj, restKeys.join('.'), value),
  };
}

// ============ Zustand Store ============

/**
 * Create the prompt store
 */
export const usePromptStore = create<PromptStore>((set, get) => ({
  // Initial state
  prompt: DEFAULT_FIBO_PROMPT,
  lastValidPrompt: DEFAULT_FIBO_PROMPT,
  initialized: false,
  lastValidation: null,

  /**
   * Initialize the store with a base prompt
   * Merges provided values with defaults
   */
  initialize: (basePrompt?: Partial<FIBOStructuredPrompt>) => {
    const mergedPrompt = basePrompt 
      ? deepMerge(DEFAULT_FIBO_PROMPT, basePrompt)
      : DEFAULT_FIBO_PROMPT;
    
    // Validate the merged prompt
    const validation = validateFIBOPrompt(mergedPrompt);
    
    if (validation.success) {
      set({
        prompt: mergedPrompt,
        lastValidPrompt: mergedPrompt,
        initialized: true,
        lastValidation: validation,
      });
    } else {
      // If validation fails, use defaults
      set({
        prompt: DEFAULT_FIBO_PROMPT,
        lastValidPrompt: DEFAULT_FIBO_PROMPT,
        initialized: true,
        lastValidation: validation,
      });
    }
  },

  /**
   * Update a specific path in the prompt
   * Validates after update and reverts on failure
   */
  update: (path: string, value: unknown): UpdateResult => {
    const state = get();
    const previousValue = getAtPath(state.prompt as Record<string, unknown>, path);
    
    // Create updated prompt
    const updatedPrompt = setAtPath(
      state.prompt as Record<string, unknown>,
      path,
      value
    ) as FIBOStructuredPrompt;
    
    // Validate the updated prompt
    const validation = validateFIBOPrompt(updatedPrompt);
    
    if (validation.success) {
      // Update succeeded - save new state
      set({
        prompt: updatedPrompt,
        lastValidPrompt: updatedPrompt,
        lastValidation: validation,
      });
      
      return { success: true, previousValue };
    } else {
      // Validation failed - revert to last valid state
      set({
        prompt: state.lastValidPrompt,
        lastValidation: validation,
      });
      
      return {
        success: false,
        previousValue,
        error: validation.errors.map(e => `${e.path}: ${e.message}`).join('; '),
      };
    }
  },

  /**
   * Get the current prompt
   */
  getPrompt: (): FIBOStructuredPrompt => {
    return get().prompt;
  },

  /**
   * Validate the current prompt
   */
  validate: (): ValidationResult => {
    const validation = validateFIBOPrompt(get().prompt);
    set({ lastValidation: validation });
    return validation;
  },

  /**
   * Reset to default prompt
   */
  reset: () => {
    set({
      prompt: DEFAULT_FIBO_PROMPT,
      lastValidPrompt: DEFAULT_FIBO_PROMPT,
      initialized: true,
      lastValidation: { success: true, errors: [] },
    });
  },

  /**
   * Export prompt as JSON string
   */
  export: (): string => {
    return JSON.stringify(get().prompt, null, 2);
  },

  /**
   * Import prompt from JSON string
   * Validates and reverts on failure
   */
  import: (json: string): UpdateResult => {
    const state = get();
    
    try {
      const parsed = JSON.parse(json);
      const validation = validateFIBOPrompt(parsed);
      
      if (validation.success) {
        set({
          prompt: parsed as FIBOStructuredPrompt,
          lastValidPrompt: parsed as FIBOStructuredPrompt,
          lastValidation: validation,
        });
        
        return { success: true };
      } else {
        // Validation failed - keep current state
        set({ lastValidation: validation });
        
        return {
          success: false,
          error: validation.errors.map(e => `${e.path}: ${e.message}`).join('; '),
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Invalid JSON';
      
      return {
        success: false,
        error: `JSON parse error: ${error}`,
      };
    }
  },
}));

// ============ Standalone Functions (for non-React usage) ============

/**
 * Create a standalone JSON State Manager instance
 * Useful for testing or non-React contexts
 */
export class JSONStateManager {
  private prompt: FIBOStructuredPrompt;
  private lastValidPrompt: FIBOStructuredPrompt;
  private initialized: boolean = false;

  constructor() {
    this.prompt = DEFAULT_FIBO_PROMPT;
    this.lastValidPrompt = DEFAULT_FIBO_PROMPT;
  }

  initialize(basePrompt?: Partial<FIBOStructuredPrompt>): void {
    const mergedPrompt = basePrompt 
      ? deepMerge(DEFAULT_FIBO_PROMPT, basePrompt)
      : DEFAULT_FIBO_PROMPT;
    
    const validation = validateFIBOPrompt(mergedPrompt);
    
    if (validation.success) {
      this.prompt = mergedPrompt;
      this.lastValidPrompt = mergedPrompt;
    } else {
      this.prompt = DEFAULT_FIBO_PROMPT;
      this.lastValidPrompt = DEFAULT_FIBO_PROMPT;
    }
    
    this.initialized = true;
  }

  update(path: string, value: unknown): UpdateResult {
    const previousValue = getAtPath(this.prompt as Record<string, unknown>, path);
    
    const updatedPrompt = setAtPath(
      this.prompt as Record<string, unknown>,
      path,
      value
    ) as FIBOStructuredPrompt;
    
    const validation = validateFIBOPrompt(updatedPrompt);
    
    if (validation.success) {
      this.prompt = updatedPrompt;
      this.lastValidPrompt = updatedPrompt;
      return { success: true, previousValue };
    } else {
      this.prompt = this.lastValidPrompt;
      return {
        success: false,
        previousValue,
        error: validation.errors.map(e => `${e.path}: ${e.message}`).join('; '),
      };
    }
  }

  getPrompt(): FIBOStructuredPrompt {
    return this.prompt;
  }

  validate(): ValidationResult {
    return validateFIBOPrompt(this.prompt);
  }

  reset(): void {
    this.prompt = DEFAULT_FIBO_PROMPT;
    this.lastValidPrompt = DEFAULT_FIBO_PROMPT;
    this.initialized = true;
  }

  export(): string {
    return JSON.stringify(this.prompt, null, 2);
  }

  import(json: string): UpdateResult {
    try {
      const parsed = JSON.parse(json);
      const validation = validateFIBOPrompt(parsed);
      
      if (validation.success) {
        this.prompt = parsed as FIBOStructuredPrompt;
        this.lastValidPrompt = parsed as FIBOStructuredPrompt;
        return { success: true };
      } else {
        return {
          success: false,
          error: validation.errors.map(e => `${e.path}: ${e.message}`).join('; '),
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Invalid JSON';
      return {
        success: false,
        error: `JSON parse error: ${error}`,
      };
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Create a new JSONStateManager instance
 */
export function createJSONStateManager(): JSONStateManager {
  return new JSONStateManager();
}

// Export utility functions for testing
export { deepMerge, getAtPath, setAtPath };

// ============ VLM Expansion Integration ============

/**
 * Expand a short prompt using VLM and update the prompt store
 * 
 * @param shortPrompt - Short text prompt to expand
 * @returns UpdateResult indicating success or failure
 * 
 * Requirements: 5.5
 */
export async function expandAndUpdatePrompt(shortPrompt: string): Promise<UpdateResult> {
  // Import dynamically to avoid circular dependencies
  const { expandPrompt } = await import('@/lib/bria-client');
  
  try {
    // Call VLM expansion API
    const expandedPrompt = await expandPrompt(shortPrompt);
    
    // Import the expanded prompt into the store
    const store = usePromptStore.getState();
    const result = store.import(JSON.stringify(expandedPrompt));
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `VLM expansion failed: ${errorMessage}`,
    };
  }
}
