'use client';

/**
 * AR Scene Inner Component
 * 
 * The actual A-Frame scene implementation. This component is dynamically
 * imported by ar-scene.tsx to ensure A-Frame is only loaded client-side.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ARSceneProps } from './ar-scene';

// Import A-Frame - this will only run on client side
// due to dynamic import in ar-scene.tsx
import 'aframe';

/**
 * AR Scene Inner Component
 * 
 * Renders the A-Frame scene with webcam background and image container.
 */
export function ARSceneInner({
  onSceneReady,
  onError,
  showWebcam = true,
  className,
}: ARSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isSceneLoaded, setIsSceneLoaded] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  /**
   * Initialize webcam stream for background
   */
  const initializeWebcam = useCallback(async () => {
    if (!showWebcam) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access webcam';
      setWebcamError(errorMessage);
      onError?.(errorMessage);
    }
  }, [showWebcam, onError]);

  /**
   * Clean up webcam stream
   */
  const cleanupWebcam = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Handle A-Frame scene loaded event
   */
  const handleSceneLoaded = useCallback(() => {
    setIsSceneLoaded(true);
    if (sceneRef.current) {
      onSceneReady?.(sceneRef.current);
    }
  }, [onSceneReady]);

  /**
   * Initialize the A-Frame scene
   */
  useEffect(() => {
    if (!containerRef.current) return;

    // Create A-Frame scene element
    const scene = document.createElement('a-scene');
    scene.setAttribute('embedded', '');
    scene.setAttribute('vr-mode-ui', 'enabled: false');
    scene.setAttribute('renderer', 'antialias: true; alpha: true');
    scene.setAttribute('background', 'color: transparent');
    
    // Add camera
    const camera = document.createElement('a-camera');
    camera.setAttribute('position', '0 1.6 0');
    camera.setAttribute('look-controls', 'enabled: false');
    camera.setAttribute('wasd-controls', 'enabled: false');
    scene.appendChild(camera);

    // Add ambient light
    const ambientLight = document.createElement('a-light');
    ambientLight.setAttribute('type', 'ambient');
    ambientLight.setAttribute('color', '#ffffff');
    ambientLight.setAttribute('intensity', '0.8');
    scene.appendChild(ambientLight);

    // Add directional light
    const directionalLight = document.createElement('a-light');
    directionalLight.setAttribute('type', 'directional');
    directionalLight.setAttribute('color', '#ffffff');
    directionalLight.setAttribute('intensity', '0.6');
    directionalLight.setAttribute('position', '1 2 1');
    scene.appendChild(directionalLight);

    // Add image container entity
    const imageContainer = document.createElement('a-entity');
    imageContainer.setAttribute('id', 'image-container');
    scene.appendChild(imageContainer);

    // Add scene loaded listener
    scene.addEventListener('loaded', handleSceneLoaded);

    // Append scene to container
    containerRef.current.appendChild(scene);
    sceneRef.current = scene;

    // Initialize webcam
    initializeWebcam();

    // Cleanup
    return () => {
      scene.removeEventListener('loaded', handleSceneLoaded);
      cleanupWebcam();
      if (containerRef.current && scene.parentNode === containerRef.current) {
        containerRef.current.removeChild(scene);
      }
      sceneRef.current = null;
    };
  }, [handleSceneLoaded, initializeWebcam, cleanupWebcam]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[400px] overflow-hidden rounded-lg ${className || ''}`}
      style={{ background: '#1a1a1a' }}
    >
      {/* Webcam video background */}
      {showWebcam && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          style={{ transform: 'scaleX(-1)' }} // Mirror for selfie view
        />
      )}

      {/* Webcam error message */}
      {webcamError && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm">
          <p className="font-medium">Webcam Error</p>
          <p className="text-red-100">{webcamError}</p>
        </div>
      )}

      {/* Loading indicator */}
      {!isSceneLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50">
          <div className="text-center text-white">
            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm">Initializing AR Scene...</p>
          </div>
        </div>
      )}

      {/* Scene ready indicator */}
      {isSceneLoaded && (
        <div className="absolute bottom-4 left-4 bg-green-500/80 text-white px-3 py-1 rounded-full text-xs font-medium">
          AR Ready
        </div>
      )}
    </div>
  );
}

export default ARSceneInner;
