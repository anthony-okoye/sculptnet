'use client';

/**
 * AR Scene Component
 * 
 * Client-side component that renders an A-Frame scene with webcam background
 * for displaying generated images in AR. Uses dynamic import to load A-Frame
 * only on the client side (no SSR).
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading component shown while A-Frame loads
 */
function ARSceneLoading() {
  return (
    <div className="relative w-full h-full min-h-[400px] bg-zinc-900 rounded-lg overflow-hidden">
      <Skeleton className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-zinc-400">
          <div className="animate-pulse mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-sm">Loading AR Scene...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Dynamically imported AR Scene Inner component
 * Loaded only on client side with ssr: false
 */
const ARSceneInner = dynamic(
  () => import('./ar-scene-inner'),
  {
    ssr: false,
    loading: () => <ARSceneLoading />,
  }
);

/**
 * AR Scene Props
 */
export interface ARSceneProps {
  /** Callback when scene is initialized */
  onSceneReady?: (sceneElement: HTMLElement) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Whether to show the webcam background */
  showWebcam?: boolean;
  /** Custom class name for the container */
  className?: string;
}

/**
 * AR Scene Component
 * 
 * Renders an A-Frame scene with webcam background for AR image display.
 * Uses dynamic import to ensure A-Frame is only loaded client-side.
 */
export function ARScene({
  onSceneReady,
  onError,
  showWebcam = true,
  className,
}: ARSceneProps) {
  return (
    <ARSceneInner
      onSceneReady={onSceneReady}
      onError={onError}
      showWebcam={showWebcam}
      className={className}
    />
  );
}

export default ARScene;
