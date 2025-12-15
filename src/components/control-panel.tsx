'use client';

/**
 * Control Panel Component
 * 
 * Main application controls using shadcn/ui components:
 * - Start/stop button for hand tracking
 * - Generate Now button for manual image generation
 * - JSON editor toggle button
 * - Export dropdown menu (single/multiple/PSD options)
 * - Collaboration toggle switch (if feature enabled)
 * - Haptic feedback toggle switch
 * - Tabs to switch between "Gesture Mode" and "Manual Mode"
 * 
 * Requirements: 6.1, 7.4, 8.1, 9.1, 10.4
 */

import { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Zap, 
  FileJson, 
  Download,
  Users,
  Vibrate,
  Hand,
  Sliders,
  HelpCircle,
  Settings,
  ArrowLeftRight,
  Grid3x3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PromptEditor } from '@/components/prompt-editor';
import { SettingsDialog } from '@/components/settings-dialog';
import { usePromptStore } from '@/lib/stores/prompt-store';

// ============ Types ============

export interface ControlPanelProps {
  // Gesture control state
  isInitialized: boolean;
  isDetecting: boolean;
  isGenerating: boolean;
  
  // Callbacks
  onStartDetection: () => void;
  onStopDetection: () => void;
  onGenerateNow: () => void;
  onExportSingle?: () => void;
  onExportMultiple?: () => void;
  onExportPSD?: () => void;
  onHelpClick?: () => void;
  onCompareClick?: () => void;
  onGalleryModeClick?: () => void;
  onSettingsUpdated?: () => void;
  
  // Feature toggles
  collaborationEnabled?: boolean;
  onCollaborationToggle?: (enabled: boolean) => void;
  isCollaborationActive?: boolean;
  
  hapticEnabled?: boolean;
  onHapticToggle?: (enabled: boolean) => void;
  
  galleryModeEnabled?: boolean;
  isGalleryModeActive?: boolean;
  
  // Optional customization
  className?: string;
}

// ============ Component ============

/**
 * Control Panel Component
 * 
 * Provides all application controls in a clean, organized interface
 */
export function ControlPanel({
  isInitialized,
  isDetecting,
  isGenerating,
  onStartDetection,
  onStopDetection,
  onGenerateNow,
  onExportSingle,
  onExportMultiple,
  onExportPSD,
  onHelpClick,
  onCompareClick,
  onGalleryModeClick,
  onSettingsUpdated,
  collaborationEnabled = false,
  onCollaborationToggle,
  isCollaborationActive = false,
  hapticEnabled = true,
  onHapticToggle,
  galleryModeEnabled = true,
  isGalleryModeActive = false,
  className = '',
}: ControlPanelProps) {
  const [activeTab, setActiveTab] = useState<'gesture' | 'manual'>('gesture');
  
  // Get prompt store for user input
  const prompt = usePromptStore(state => state.prompt);
  const updatePrompt = usePromptStore(state => state.update);
  
  // Local state for textarea
  const [userPrompt, setUserPrompt] = useState(prompt.short_description);
  
  // Sync local state with prompt store when it changes (e.g., from history restore)
  useEffect(() => {
    setUserPrompt(prompt.short_description);
  }, [prompt.short_description]);
  
  // Handle prompt input change
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setUserPrompt(value);
    updatePrompt('short_description', value);
  };
  
  // Prevent keyboard shortcuts when typing in textarea
  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Stop propagation to prevent keyboard shortcuts from firing
    e.stopPropagation();
  };

  // Wrap onGenerateNow with logging
  const handleGenerateClick = () => {
    console.log('[ControlPanel] 🖱️ Generate button clicked');
    console.log('[ControlPanel] 📊 State:', { isInitialized, isGenerating });
    onGenerateNow();
  };

  return (
    <Card className={`bg-zinc-900 border-zinc-800 ${className}`}>
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="text-base sm:text-lg text-white">Controls</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-zinc-400">
          Manage gesture detection and image generation
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
        {/* User Prompt Input - Always visible */}
        <div className="space-y-2">
          <Label htmlFor="user-prompt" className="text-xs sm:text-sm text-zinc-300">
            Base Prompt
          </Label>
          <Textarea
            id="user-prompt"
            value={userPrompt}
            onChange={handlePromptChange}
            onKeyDown={handlePromptKeyDown}
            placeholder="Enter your prompt (e.g., a beautiful landscape)"
            className="w-full min-h-[88px] bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-y"
            rows={3}
          />
          <p className="text-xs text-zinc-500">
            Gestures will modify this base prompt
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800 my-4" />

        {/* Mode Tabs - Touch-friendly */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'gesture' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2 h-11 sm:h-10">
            <TabsTrigger value="gesture" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-h-[44px] sm:min-h-0">
              <Hand className="w-4 h-4" />
              <span className="hidden sm:inline">Gesture Mode</span>
              <span className="sm:hidden">Gesture</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-h-[44px] sm:min-h-0">
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Manual Mode</span>
              <span className="sm:hidden">Manual</span>
            </TabsTrigger>
          </TabsList>

          {/* Gesture Mode Tab - Touch-friendly buttons (min 44px height) */}
          <TabsContent value="gesture" className="space-y-3 mt-3 sm:mt-4">
            {/* Start/Stop Hand Tracking */}
            {!isInitialized ? (
              <Button
                onClick={onStartDetection}
                className="w-full min-h-[44px] text-sm sm:text-base"
                variant="default"
                size="lg"
              >
                <Play className="w-4 h-4 mr-2" />
                Initialize & Start
              </Button>
            ) : isDetecting ? (
              <Button
                onClick={onStopDetection}
                className="w-full min-h-[44px] text-sm sm:text-base"
                variant="secondary"
                size="lg"
              >
                <Pause className="w-4 h-4 mr-2" />
                Stop Detection
              </Button>
            ) : (
              <Button
                onClick={onStartDetection}
                className="w-full min-h-[44px] text-sm sm:text-base"
                variant="default"
                size="lg"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Detection
              </Button>
            )}

            {/* Manual Generate Button */}
            <Button
              onClick={handleGenerateClick}
              className="w-full min-h-[44px] text-sm sm:text-base"
              variant="outline"
              size="lg"
              disabled={!isInitialized || isGenerating}
            >
              <Zap className="w-4 h-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Generate Now'}
            </Button>
          </TabsContent>

          {/* Manual Mode Tab - Touch-friendly */}
          <TabsContent value="manual" className="space-y-3 mt-3 sm:mt-4">
            <div className="text-xs sm:text-sm text-zinc-400 mb-2 sm:mb-3">
              Use the JSON editor to manually adjust parameters
            </div>
            
            {/* JSON Editor Toggle */}
            <PromptEditor
              trigger={
                <Button variant="outline" className="w-full min-h-[44px] text-sm sm:text-base" size="lg">
                  <FileJson className="w-4 h-4 mr-2" />
                  Edit JSON Prompt
                </Button>
              }
            />

            {/* Manual Generate Button */}
            <Button
              onClick={handleGenerateClick}
              className="w-full min-h-[44px] text-sm sm:text-base"
              variant="default"
              size="lg"
              disabled={!isInitialized || isGenerating}
            >
              <Zap className="w-4 h-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Generate Now'}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Divider */}
        <div className="border-t border-zinc-800 my-4" />

        {/* Export Dropdown Menu - Touch-friendly */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full min-h-[44px] text-sm sm:text-base" size="lg">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel className="text-sm">Export Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onExportSingle}
              disabled={!onExportSingle}
              className="min-h-[44px] text-sm cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Single Image
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onExportMultiple}
              disabled={!onExportMultiple}
              className="min-h-[44px] text-sm cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Multiple Images
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onExportPSD}
              disabled={!onExportPSD}
              className="min-h-[44px] text-sm cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2" />
              Export as PSD
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Divider */}
        <div className="border-t border-zinc-800 my-4" />

        {/* Settings Section - Touch-friendly */}
        <div className="space-y-3">
          <h3 className="text-xs sm:text-sm font-medium text-zinc-400">Settings</h3>
          
          {/* Haptic Feedback Toggle - Touch-friendly hit area */}
          <div className="flex items-center justify-between min-h-[44px] py-2">
            <div className="flex items-center gap-2">
              <Vibrate className="w-4 h-4 text-zinc-400" />
              <label htmlFor="haptic-toggle" className="text-xs sm:text-sm text-zinc-300 cursor-pointer">
                Haptic Feedback
              </label>
            </div>
            <Switch
              id="haptic-toggle"
              checked={hapticEnabled}
              onCheckedChange={onHapticToggle}
              className="data-[state=checked]:bg-green-600"
            />
          </div>

          {/* Collaboration Toggle (if enabled) - Touch-friendly */}
          {collaborationEnabled && onCollaborationToggle && (
            <div className="flex items-center justify-between min-h-[44px] py-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-400" />
                <label htmlFor="collaboration-toggle" className="text-xs sm:text-sm text-zinc-300 cursor-pointer">
                  Collaboration
                </label>
              </div>
              <Switch
                id="collaboration-toggle"
                checked={isCollaborationActive}
                onCheckedChange={onCollaborationToggle}
                className="data-[state=checked]:bg-green-600"
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800 my-4" />

        {/* View Mode Buttons - Touch-friendly */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onCompareClick}
            variant="outline"
            className="w-full min-h-[44px] text-sm sm:text-base"
            size="lg"
            disabled={!onCompareClick}
          >
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Compare</span>
            <span className="sm:hidden">Compare</span>
          </Button>
          
          {galleryModeEnabled && (
            <Button
              onClick={onGalleryModeClick}
              variant={isGalleryModeActive ? 'default' : 'outline'}
              className="w-full min-h-[44px] text-sm sm:text-base"
              size="lg"
              disabled={!onGalleryModeClick}
            >
              <Grid3x3 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Gallery</span>
              <span className="sm:hidden">Gallery</span>
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800 my-4" />

        {/* Settings and Help Buttons - Touch-friendly */}
        <div className="grid grid-cols-2 gap-2">
          <SettingsDialog
            trigger={
              <Button
                variant="outline"
                className="w-full min-h-[44px] text-sm sm:text-base"
                size="lg"
              >
                <Settings className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Settings</span>
                <span className="sm:hidden">Config</span>
              </Button>
            }
            onSettingsUpdated={onSettingsUpdated}
          />
          <Button
            onClick={onHelpClick}
            variant="outline"
            className="w-full min-h-[44px] text-sm sm:text-base"
            size="lg"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Help</span>
            <span className="sm:hidden">Help</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ControlPanel;
