/**
 * AR Scene Manager Hook
 * 
 * Manages A-Frame scene entities for displaying generated images in AR.
 * Handles image positioning, scene management, and entity lifecycle.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { useCallback, useRef, useState } from 'react';

// ============ Types ============

/**
 * 3D position coordinates
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D rotation coordinates (in degrees)
 */
export interface Rotation3D {
  x: number;
  y: number;
  z: number;
}

/**
 * 3D scale coordinates
 */
export interface Scale3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Scene entity representing an image in the AR scene
 */
export interface SceneEntity {
  id: string;
  imageUrl: string;
  position: Position3D;
  rotation: Rotation3D;
  scale: Scale3D;
  timestamp: number;
}

/**
 * AR Scene Manager state
 */
export interface ARSceneState {
  entities: SceneEntity[];
  isInitialized: boolean;
  error: string | null;
}

/**
 * AR Scene Manager return type
 */
export interface ARSceneManager {
  // State
  entities: SceneEntity[];
  isInitialized: boolean;
  error: string | null;
  
  // Methods
  initialize: (containerElement: HTMLElement | null) => void;
  addImage: (imageUrl: string, position?: Partial<Position3D>) => string;
  removeImage: (id: string) => void;
  updateImage: (id: string, imageUrl: string) => void;
  clearScene: () => void;
  getEntities: () => SceneEntity[];
}

// ============ Constants ============

/**
 * Maximum number of images allowed in the scene
 */
export const MAX_IMAGES = 5;

/**
 * Default position for the first image (eye level, 2m away)
 */
export const DEFAULT_POSITION: Position3D = {
  x: 0,
  y: 1.6,
  z: -2,
};

/**
 * Horizontal offset between images (in meters)
 */
export const HORIZONTAL_OFFSET = 0.5;

/**
 * Default rotation (facing the camera)
 */
export const DEFAULT_ROTATION: Rotation3D = {
  x: 0,
  y: 0,
  z: 0,
};

/**
 * Default scale for image planes
 */
export const DEFAULT_SCALE: Scale3D = {
  x: 1.5,
  y: 1.5,
  z: 1,
};

// ============ Utility Functions ============

/**
 * Generate a unique ID for scene entities
 */
function generateEntityId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate position for a new image based on existing entities
 * First image: center (0, 1.6, -2)
 * Subsequent images: offset horizontally ±0.5m alternating left/right
 */
export function calculateImagePosition(
  existingEntities: SceneEntity[],
  customPosition?: Partial<Position3D>
): Position3D {
  const count = existingEntities.length;
  
  // If custom position provided, merge with defaults
  if (customPosition) {
    return {
      x: customPosition.x ?? DEFAULT_POSITION.x,
      y: customPosition.y ?? DEFAULT_POSITION.y,
      z: customPosition.z ?? DEFAULT_POSITION.z,
    };
  }
  
  // First image goes to center
  if (count === 0) {
    return { ...DEFAULT_POSITION };
  }
  
  // Calculate horizontal offset: alternate left/right
  // Pattern: 0, +0.5, -0.5, +1.0, -1.0, etc.
  const offsetIndex = count;
  const direction = offsetIndex % 2 === 1 ? 1 : -1;
  const magnitude = Math.ceil(offsetIndex / 2) * HORIZONTAL_OFFSET;
  
  return {
    x: DEFAULT_POSITION.x + (direction * magnitude),
    y: DEFAULT_POSITION.y,
    z: DEFAULT_POSITION.z,
  };
}

/**
 * Create an A-Frame plane entity for an image
 */
function createAFrameEntity(entity: SceneEntity): HTMLElement | null {
  // Check if we're in browser environment
  if (typeof document === 'undefined') {
    return null;
  }
  
  const plane = document.createElement('a-plane');
  plane.setAttribute('id', entity.id);
  plane.setAttribute(
    'position',
    `${entity.position.x} ${entity.position.y} ${entity.position.z}`
  );
  plane.setAttribute(
    'rotation',
    `${entity.rotation.x} ${entity.rotation.y} ${entity.rotation.z}`
  );
  plane.setAttribute('width', entity.scale.x.toString());
  plane.setAttribute('height', entity.scale.y.toString());
  plane.setAttribute('material', `src: ${entity.imageUrl}; transparent: true; side: double`);
  plane.setAttribute('class', 'sculptnet-image');
  
  return plane;
}

/**
 * Remove an A-Frame entity from the DOM
 */
function removeAFrameEntity(id: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  
  const element = document.getElementById(id);
  if (element) {
    element.parentNode?.removeChild(element);
    return true;
  }
  return false;
}

/**
 * Update an A-Frame entity's image source
 */
function updateAFrameEntityImage(id: string, imageUrl: string): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  
  const element = document.getElementById(id);
  if (element) {
    element.setAttribute('material', `src: ${imageUrl}; transparent: true; side: double`);
    return true;
  }
  return false;
}

// ============ Hook Implementation ============

/**
 * AR Scene Manager Hook
 * 
 * Provides methods to manage images in an A-Frame AR scene.
 * Handles positioning, lifecycle, and scene limits.
 */
export function useARScene(): ARSceneManager {
  const [state, setState] = useState<ARSceneState>({
    entities: [],
    isInitialized: false,
    error: null,
  });
  
  const containerRef = useRef<HTMLElement | null>(null);
  const imageContainerRef = useRef<HTMLElement | null>(null);

  /**
   * Initialize the AR scene with a container element
   */
  const initialize = useCallback((containerElement: HTMLElement | null) => {
    if (!containerElement) {
      setState(prev => ({
        ...prev,
        error: 'Container element is required for initialization',
      }));
      return;
    }
    
    containerRef.current = containerElement;
    
    // Find or create the image container within the A-Frame scene
    const existingContainer = containerElement.querySelector('#image-container');
    if (existingContainer) {
      imageContainerRef.current = existingContainer as HTMLElement;
    } else {
      // Create image container entity
      const imageContainer = document.createElement('a-entity');
      imageContainer.setAttribute('id', 'image-container');
      containerElement.appendChild(imageContainer);
      imageContainerRef.current = imageContainer;
    }
    
    setState(prev => ({
      ...prev,
      isInitialized: true,
      error: null,
    }));
  }, []);

  /**
   * Add an image to the AR scene
   * Returns the entity ID
   */
  const addImage = useCallback((
    imageUrl: string,
    customPosition?: Partial<Position3D>
  ): string => {
    const id = generateEntityId();
    
    setState(prev => {
      // Calculate position based on existing entities
      const position = calculateImagePosition(prev.entities, customPosition);
      
      // Create new entity
      const newEntity: SceneEntity = {
        id,
        imageUrl,
        position,
        rotation: { ...DEFAULT_ROTATION },
        scale: { ...DEFAULT_SCALE },
        timestamp: Date.now(),
      };
      
      // Check if we need to remove oldest image
      let updatedEntities = [...prev.entities];
      if (updatedEntities.length >= MAX_IMAGES) {
        // Remove oldest entity (first in array)
        const oldestEntity = updatedEntities[0];
        removeAFrameEntity(oldestEntity.id);
        updatedEntities = updatedEntities.slice(1);
      }
      
      // Add new entity to DOM if initialized
      if (imageContainerRef.current) {
        const aframeEntity = createAFrameEntity(newEntity);
        if (aframeEntity) {
          imageContainerRef.current.appendChild(aframeEntity);
        }
      }
      
      return {
        ...prev,
        entities: [...updatedEntities, newEntity],
      };
    });
    
    return id;
  }, []);

  /**
   * Remove an image from the AR scene by ID
   */
  const removeImage = useCallback((id: string) => {
    setState(prev => {
      const entityExists = prev.entities.some(e => e.id === id);
      if (!entityExists) {
        return prev;
      }
      
      // Remove from DOM
      removeAFrameEntity(id);
      
      return {
        ...prev,
        entities: prev.entities.filter(e => e.id !== id),
      };
    });
  }, []);

  /**
   * Update an existing image's URL
   */
  const updateImage = useCallback((id: string, imageUrl: string) => {
    setState(prev => {
      const entityIndex = prev.entities.findIndex(e => e.id === id);
      if (entityIndex === -1) {
        return prev;
      }
      
      // Update in DOM
      updateAFrameEntityImage(id, imageUrl);
      
      // Update in state
      const updatedEntities = [...prev.entities];
      updatedEntities[entityIndex] = {
        ...updatedEntities[entityIndex],
        imageUrl,
        timestamp: Date.now(),
      };
      
      return {
        ...prev,
        entities: updatedEntities,
      };
    });
  }, []);

  /**
   * Clear all images from the scene
   */
  const clearScene = useCallback(() => {
    setState(prev => {
      // Remove all entities from DOM
      prev.entities.forEach(entity => {
        removeAFrameEntity(entity.id);
      });
      
      return {
        ...prev,
        entities: [],
      };
    });
  }, []);

  /**
   * Get all current entities
   */
  const getEntities = useCallback((): SceneEntity[] => {
    return state.entities;
  }, [state.entities]);

  return {
    // State
    entities: state.entities,
    isInitialized: state.isInitialized,
    error: state.error,
    
    // Methods
    initialize,
    addImage,
    removeImage,
    updateImage,
    clearScene,
    getEntities,
  };
}

export default useARScene;
