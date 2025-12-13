'use client';

/**
 * SculptNet Main Page
 * 
 * Main application page that integrates gesture detection with AR scene
 * and image generation. Wires together all components for the gesture
 * sculpting experience.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 4.1, 4.3, 10.3
 */

import { useCallback, useEffect, useState, useMemo } from 'react';
import { ARScene } from '@/components/ar-scene';
import { GestureOverlay } from '@/components/gesture-overlay';
import { ControlPanel } from '@/components/control-panel';
import { StatusBar } from '@/components/status-bar';
import { CompatibilityBanner } from '@/components/compatibility-banner';
import { HelpDialog, useFirstTimeHelp } from '@/components/help-dialog';
import { ParameterHUD } from '@/components/parameter-hud';
import { CompareView } from '@/components/compare-view';
import { HistoryTimeline } from '@/components/history-timeline';
import { useGestureController } from '@/hooks/use-gesture-controller';
import { useARScene } from '@/hooks/use-ar-scene';
import { useHapticFeedback } from '@/hooks/use-haptic-feedback';
import { useCollaboration } from '@/hooks/use-collaboration';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGenerationStore, MAX_HISTORY_SIZE } from '@/lib/stores/generation-store';
import { ExportManager } from '@/lib/export-manager';
import type { GenerationResult } from '@/lib/bria-client';
import type { GenerationHistoryEntry } from '@/lib/stores/generation-store';
import { toast } from 'sonner';
import { checkBrowserCompatibility, shouldUseFallbackMode } from '@/lib/browser-compatibility';
import { isMobileViewport, getOptimalDetectionFPS, ensureMobileViewportMeta } from '@/lib/mobile-utils';

export default function Home() {
  // Mobile detection and optimization
  const [isMobile, setIsMobile] = useState(false);
  const [optimalFPS] = useState(() => getOptimalDetectionFPS());
  
  // Browser compatibility check
  const [compatibility] = useState(() => checkBrowserCompatibility());
  const [fallbackMode] = useState(() => shouldUseFallbackMode(compatibility));
  
  // Detect mobile viewport on mount and window resize
  useEffect(() => {
    ensureMobileViewportMeta();
    
    const checkMobile = () => {
      setIsMobile(isMobileViewport());
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // AR Scene manager
  const arScene = useARScene();
  
  // Generation store for history and status
  const generationStore = useGenerationStore();
  const { history: generationHistory, status: generationStatus, error: generationError } = generationStore;
  
  // Haptic feedback
  const haptic = useHapticFeedback();
  
  // Collaboration (optional feature) - disabled if WebSocket not supported
  const collaboration = useCollaboration({ autoApplyUpdates: true });
  const [collaborationEnabled] = useState(false); // Can be toggled via settings
  
  // Export manager
  const [exportManager] = useState(() => new ExportManager());
  
  // Help dialog - show on first load
  const { showHelp, setShowHelp } = useFirstTimeHelp();
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  
  // Compare mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareImages, setCompareImages] = useState<{
    imageA: GenerationHistoryEntry | null;
    imageB: GenerationHistoryEntry | null;
  }>({ imageA: null, imageB: null });
  
  // Show help dialog on first load
  useEffect(() => {
    if (showHelp) {
      setHelpDialogOpen(true);
    }
  }, [showHelp]);
  
  // Show compatibility warning on mount if not compatible
  useEffect(() => {
    if (!compatibility.isCompatible) {
      toast.error('Browser Compatibility Issue', {
        description: 'Some features may not work properly. Please check the banner above.',
        duration: 10000,
      });
    } else if (fallbackMode.use2DMode) {
      toast.info('Using 2D Display Mode', {
        description: 'WebXR not supported - images will display in 2D mode.',
        duration: 5000,
      });
    }
  }, [compatibility.isCompatible, fallbackMode.use2DMode]);
  
  /**
   * Handle successful image generation
   * - Adds image to AR scene
   * - Stores result in generation history (last 10 images)
   * - Updates UI status
   * - Shows success notification
   * 
   * Requirements: 2.2, 2.3, 4.3
   */
  const handleImageGenerated = useCallback((result: GenerationResult) => {
    // Add image to AR scene and get the entity ID
    const arEntityId = arScene.addImage(result.imageUrl);
    
    // Add to generation history store with AR entity reference
    generationStore.addGeneration(result, arEntityId);
    
    console.log('Image generated and added to AR scene:', {
      imageUrl: result.imageUrl,
      arEntityId,
      historySize: generationStore.history.length + 1,
    });
    
    // Show success toast
    toast.success('Image Generated!', {
      description: 'Your image has been added to the AR scene',
      duration: 3000,
    });
  }, [arScene, generationStore]);

  /**
   * Handle generation error
   * - Updates error state in store
   * - Logs error for debugging
   * - Shows toast notification
   * 
   * Requirements: 4.4
   */
  const handleGenerationError = useCallback((error: Error) => {
    console.error('Generation error:', error);
    generationStore.setError(error.message);
    
    // Show error toast
    toast.error('Generation Failed', {
      description: error.message,
      duration: 5000,
    });
  }, [generationStore]);

  /**
   * Handle gesture update
   * - Logs gesture updates for debugging
   */
  const handleGestureUpdate = useCallback((update: { path: string; value: string | number; confidence: number }) => {
    console.log('Gesture update:', update.path, update.value);
  }, []);

  // Gesture controller with callbacks - use optimal FPS for mobile
  const gestureController = useGestureController({
    debounceMs: 100,
    detectionFps: optimalFPS,
    onImageGenerated: handleImageGenerated,
    onGenerationError: handleGenerationError,
    onGestureUpdate: handleGestureUpdate,
  });

  const { state } = gestureController;

  // Handle AR scene ready
  const handleSceneReady = useCallback((sceneElement: HTMLElement) => {
    arScene.initialize(sceneElement);
  }, [arScene]);

  // Handle AR scene error
  const handleSceneError = useCallback((error: string) => {
    console.error('AR Scene error:', error);
  }, []);

  // Initialize gesture controller
  const handleStartGestures = useCallback(async () => {
    try {
      if (!state.isInitialized) {
        await gestureController.initialize();
      }
      gestureController.startDetection();
    } catch (error) {
      console.error('Failed to start gestures:', error);
    }
  }, [gestureController, state.isInitialized]);

  // Stop gesture detection
  const handleStopGestures = useCallback(() => {
    gestureController.stopDetection();
  }, [gestureController]);

  // Manual generation trigger
  const handleManualGenerate = useCallback(async () => {
    await gestureController.triggerGeneration();
  }, [gestureController]);

  // Export handlers
  const handleExportSingle = useCallback(async () => {
    const latest = generationHistory[generationHistory.length - 1];
    if (!latest) {
      toast.error('No images to export');
      return;
    }
    
    try {
      await exportManager.exportSingle(latest);
      toast.success('Image exported successfully');
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [generationHistory, exportManager]);

  const handleExportMultiple = useCallback(async () => {
    if (generationHistory.length === 0) {
      toast.error('No images to export');
      return;
    }
    
    try {
      await exportManager.exportMultiple(generationHistory);
      toast.success(`Exported ${generationHistory.length} images`);
    } catch (error) {
      toast.error('Export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [generationHistory, exportManager]);

  const handleExportPSD = useCallback(async () => {
    const latest = generationHistory[generationHistory.length - 1];
    if (!latest) {
      toast.error('No images to export');
      return;
    }
    
    try {
      await exportManager.exportAsPSD(latest);
      toast.success('PSD exported successfully');
    } catch (error) {
      toast.error('PSD export failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [generationHistory, exportManager]);

  // Collaboration handlers
  const handleCollaborationToggle = useCallback(async (enabled: boolean) => {
    // Check if WebSocket is supported
    if (fallbackMode.disableCollaboration) {
      toast.error('Collaboration Not Supported', {
        description: 'Your browser does not support WebSocket connections.',
      });
      return;
    }
    
    if (enabled) {
      try {
        // Generate a random room ID or use a stored one
        const roomId = `sculptnet-${Math.random().toString(36).substring(7)}`;
        await collaboration.connect(roomId);
        toast.success('Collaboration enabled', {
          description: `Room ID: ${roomId}`,
        });
      } catch (error) {
        toast.error('Failed to enable collaboration', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else {
      collaboration.disconnect();
      toast.info('Collaboration disabled');
    }
  }, [collaboration, fallbackMode.disableCollaboration]);

  // Help button handler
  const handleHelpClick = useCallback(() => {
    setHelpDialogOpen(true);
  }, []);

  // Compare mode handlers
  const handleToggleCompareMode = useCallback(() => {
    // Need at least 2 images to compare
    if (generationHistory.length < 2) {
      toast.error('Need at least 2 images to compare');
      return;
    }
    
    if (!compareMode) {
      // Enter compare mode - compare the two most recent images
      const imageB = generationHistory[generationHistory.length - 1];
      const imageA = generationHistory[generationHistory.length - 2];
      
      setCompareImages({ imageA, imageB });
      setCompareMode(true);
    } else {
      // Exit compare mode
      setCompareMode(false);
    }
  }, [compareMode, generationHistory]);

  const handleCloseCompareMode = useCallback(() => {
    setCompareMode(false);
  }, []);

  // Keyboard shortcuts
  const keyboardShortcuts = useMemo(() => [
    {
      key: ' ',
      handler: () => {
        if (state.isDetecting) {
          handleStopGestures();
        } else {
          handleStartGestures();
        }
      },
      description: 'Start/Stop hand tracking',
    },
    {
      key: 'g',
      handler: handleManualGenerate,
      description: 'Generate image manually',
    },
    {
      key: 'c',
      handler: handleToggleCompareMode,
      description: 'Toggle compare mode',
    },
    {
      key: '?',
      handler: handleHelpClick,
      description: 'Show help dialog',
    },
    {
      key: 'Escape',
      handler: () => {
        if (compareMode) {
          handleCloseCompareMode();
        } else if (helpDialogOpen) {
          setHelpDialogOpen(false);
        }
      },
      description: 'Close dialogs',
    },
    {
      key: 's',
      ctrlKey: true,
      handler: (e?: KeyboardEvent) => {
        e?.preventDefault();
        handleExportSingle();
      },
      description: 'Export current image',
    },
    {
      key: 's',
      metaKey: true,
      handler: (e?: KeyboardEvent) => {
        e?.preventDefault();
        handleExportSingle();
      },
      description: 'Export current image (Mac)',
    },
  ], [
    state.isDetecting,
    handleStopGestures,
    handleStartGestures,
    handleManualGenerate,
    handleToggleCompareMode,
    handleHelpClick,
    compareMode,
    handleCloseCompareMode,
    helpDialogOpen,
    handleExportSingle,
  ]);

  useKeyboardShortcuts({
    shortcuts: keyboardShortcuts,
    enabled: true,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gestureController.dispose();
      collaboration.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* Compatibility Banner */}
      <CompatibilityBanner />
      
      {/* Header - Responsive */}
      <header className="border-b border-zinc-800 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-lg sm:text-xl font-semibold text-white">SculptNet</h1>
            <Badge variant="outline" className="text-xs hidden sm:inline-flex">
              Gesture Sculpting
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {state.isInitialized && (
              <Badge 
                variant={state.isDetecting ? 'default' : 'secondary'}
                className={`text-xs ${state.isDetecting ? 'bg-green-600' : ''}`}
              >
                {state.isDetecting ? 'Detecting' : 'Paused'}
              </Badge>
            )}
            {isMobile && (
              <Badge variant="outline" className="text-xs">
                📱 Mobile
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Responsive Grid */}
      <main className="flex-1 p-3 sm:p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-6">
          {/* AR Scene - Main Area - Responsive */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <Card className="overflow-hidden bg-zinc-900 border-zinc-800">
              <div className="relative aspect-video">
                <ARScene
                  onSceneReady={handleSceneReady}
                  onError={handleSceneError}
                  showWebcam={true}
                  className="w-full h-full"
                />
                
                {/* Gesture Overlay */}
                <GestureOverlay
                  isDetecting={state.isDetecting}
                  isGenerating={state.isGenerating}
                  generationStatus={state.generationStatus}
                  currentGesture={state.currentGesture}
                  lastUpdate={state.lastUpdate}
                  error={state.error}
                />
              </div>
            </Card>
          </div>

          {/* Control Panel - Sidebar - Responsive (shows first on mobile) */}
          <div className="lg:col-span-1 space-y-3 sm:space-y-4 order-1 lg:order-2">
            {/* Status Bar */}
            <StatusBar
              isDetecting={state.isDetecting}
              currentGesture={state.currentGesture}
              lastUpdate={state.lastUpdate}
              generationStatus={state.generationStatus}
              isGenerating={state.isGenerating}
              error={state.error}
              handCount={0} // TODO: Add hand count from gesture controller
              showToasts={true}
            />

            {/* Control Panel */}
            <ControlPanel
              isInitialized={state.isInitialized}
              isDetecting={state.isDetecting}
              isGenerating={state.isGenerating}
              onStartDetection={handleStartGestures}
              onStopDetection={handleStopGestures}
              onGenerateNow={handleManualGenerate}
              onExportSingle={handleExportSingle}
              onExportMultiple={handleExportMultiple}
              onExportPSD={handleExportPSD}
              onHelpClick={handleHelpClick}
              onCompareClick={handleToggleCompareMode}
              collaborationEnabled={collaborationEnabled}
              onCollaborationToggle={handleCollaborationToggle}
              isCollaborationActive={collaboration.isConnected}
              hapticEnabled={haptic.enabled}
              onHapticToggle={haptic.toggle}
            />

            {/* Gesture Guide - Collapsible on mobile */}
            <Card className="p-3 sm:p-4 bg-zinc-900 border-zinc-800 hidden sm:block">
              <h2 className="text-sm font-medium text-zinc-400 mb-3">
                Gesture Guide
              </h2>
              <div className="space-y-2 sm:space-y-3 text-xs text-zinc-500">
                <div className="flex items-start gap-2">
                  <span className="text-base sm:text-lg">🤏</span>
                  <div>
                    <div className="text-zinc-300 font-medium">Pinch</div>
                    <div>Adjust camera FOV / lens</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-base sm:text-lg">🔄</span>
                  <div>
                    <div className="text-zinc-300 font-medium">Wrist Rotation</div>
                    <div>Change camera angle</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-base sm:text-lg">↕️</span>
                  <div>
                    <div className="text-zinc-300 font-medium">Vertical Move</div>
                    <div>Adjust lighting</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-base sm:text-lg">🖼️</span>
                  <div>
                    <div className="text-zinc-300 font-medium">Two-Hand Frame</div>
                    <div>Set composition</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-base sm:text-lg">✊→✋</span>
                  <div>
                    <div className="text-zinc-300 font-medium">Fist to Open</div>
                    <div>Trigger generation</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Generation History - Responsive grid */}
            {generationHistory.length > 0 && (
              <Card className="p-3 sm:p-4 bg-zinc-900 border-zinc-800">
                <h2 className="text-sm font-medium text-zinc-400 mb-2 sm:mb-3">
                  Recent ({generationHistory.length}/{MAX_HISTORY_SIZE})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {generationHistory.slice(-6).map((entry, index) => (
                    <div
                      key={entry.id || entry.requestId || index}
                      className={`aspect-square rounded overflow-hidden bg-zinc-800 relative ${
                        entry.inARScene ? 'ring-2 ring-green-500' : ''
                      }`}
                      title={entry.inARScene ? 'Displayed in AR scene' : 'Not in AR scene'}
                    >
                      <img
                        src={entry.imageUrl}
                        alt={`Generation ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {entry.inARScene && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
                {generationError && (
                  <div className="mt-2 text-xs text-red-400">
                    Last error: {generationError}
                  </div>
                )}
              </Card>
            )}

            {/* Status - Compact on mobile */}
            <Card className="p-3 sm:p-4 bg-zinc-900 border-zinc-800">
              <h2 className="text-sm font-medium text-zinc-400 mb-2 sm:mb-3">
                Status
              </h2>
              <div className="space-y-1.5 sm:space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Initialized</span>
                  <span className={state.isInitialized ? 'text-green-500' : 'text-zinc-600'}>
                    {state.isInitialized ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Detecting</span>
                  <span className={state.isDetecting ? 'text-green-500' : 'text-zinc-600'}>
                    {state.isDetecting ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Generation</span>
                  <span className={`capitalize ${
                    generationStatus === 'generating' || generationStatus === 'polling' 
                      ? 'text-yellow-500' 
                      : generationStatus === 'error' 
                        ? 'text-red-500' 
                        : 'text-zinc-300'
                  }`}>
                    {generationStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">AR Images</span>
                  <span className="text-zinc-300">
                    {arScene.entities.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">History</span>
                  <span className="text-zinc-300">
                    {generationHistory.length}/{MAX_HISTORY_SIZE}
                  </span>
                </div>
                {isMobile && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">FPS</span>
                    <span className="text-zinc-300">
                      {optimalFPS}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer - Responsive */}
      <footer className="border-t border-zinc-800 px-3 sm:px-6 py-2 sm:py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-0 text-xs text-zinc-500">
          <span className="text-center sm:text-left">SculptNet - Gesture-based AI Image Sculpting</span>
          <span className="text-center sm:text-right">Powered by Bria FIBO</span>
        </div>
      </footer>

      {/* Help Dialog */}
      <HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />
      
      {/* Parameter HUD - Live parameter display */}
      <ParameterHUD />
      
      {/* History Timeline */}
      <HistoryTimeline />
      
      {/* Compare Mode */}
      {compareMode && compareImages.imageA && compareImages.imageB && (
        <CompareView
          imageA={compareImages.imageA}
          imageB={compareImages.imageB}
          onClose={handleCloseCompareMode}
        />
      )}
    </div>
  );
}
