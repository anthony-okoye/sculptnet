'use client';

/**
 * Settings Dialog Component
 * 
 * A dialog for configuring application settings, primarily API key management.
 * Features:
 * - API key entry with password masking toggle
 * - Client-side key override stored in localStorage (for demo/development)
 * - Key format validation using Zod
 * - Connection status indicator using Badge
 * - Link to Bria signup for new users
 * 
 * Note: For production, API key is stored server-side in environment variables.
 * This component allows optional client-side override for demo purposes.
 * 
 * Requirements: 4.1, 4.2
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Settings, Eye, EyeOff, ExternalLink, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { z } from 'zod';
import {
  DEFAULT_PRESETS,
  type PresetConfig,
  type PresetGestureType,
  savePresetsToStorage,
  loadPresetsFromStorage,
  clearPresetsFromStorage,
} from '@/lib/gesture-presets';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// ============ Types & Validation ============

/**
 * Bria API key format validation
 * Keys should be non-empty strings (basic validation)
 */
const apiKeySchema = z.string().min(10, 'API key must be at least 10 characters').max(200, 'API key is too long');

interface SettingsDialogProps {
  /** Optional trigger element. If not provided, uses default button */
  trigger?: React.ReactNode;
  /** Callback when settings are updated */
  onSettingsUpdated?: () => void;
}

// ============ Local Storage Keys ============

const STORAGE_KEY_API_KEY = 'sculptnet_bria_api_key';
const STORAGE_KEY_CONNECTION_STATUS = 'sculptnet_connection_status';
const STORAGE_KEY_HDR_ENABLED = 'sculptnet_hdr_enabled';

// ============ Component ============

/**
 * SettingsDialog Component
 * 
 * Provides a dialog interface for managing application settings.
 */
export function SettingsDialog({ trigger, onSettingsUpdated }: SettingsDialogProps) {
  // Dialog open state
  const [open, setOpen] = useState(false);
  
  // API key state
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidKey, setIsValidKey] = useState<boolean | null>(null);
  
  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  
  // Preset customization state
  const [presets, setPresets] = useState<Record<Exclude<PresetGestureType, null>, PresetConfig>>(DEFAULT_PRESETS);
  const [hasPresetChanges, setHasPresetChanges] = useState(false);
  
  // HDR mode state
  const [hdrEnabled, setHdrEnabled] = useState(false);

  /**
   * Load API key and presets from localStorage when dialog opens
   */
  useEffect(() => {
    if (open) {
      const storedKey = localStorage.getItem(STORAGE_KEY_API_KEY);
      const storedStatus = localStorage.getItem(STORAGE_KEY_CONNECTION_STATUS) as 'connected' | 'disconnected' | null;
      
      if (storedKey) {
        setApiKey(storedKey);
        // Validate the stored key
        const result = apiKeySchema.safeParse(storedKey);
        setIsValidKey(result.success);
      } else {
        setApiKey('');
        setIsValidKey(null);
      }
      
      setConnectionStatus(storedStatus || 'unknown');
      
      // Load presets
      const storedPresets = loadPresetsFromStorage();
      if (storedPresets) {
        setPresets(storedPresets);
      } else {
        setPresets(DEFAULT_PRESETS);
      }
      setHasPresetChanges(false);
      
      // Load HDR setting
      const storedHdr = localStorage.getItem(STORAGE_KEY_HDR_ENABLED);
      setHdrEnabled(storedHdr === 'true');
    }
  }, [open]);

  /**
   * Handle API key input change
   */
  const handleApiKeyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApiKey(value);
    
    // Reset validation state when typing
    setIsValidKey(null);
  }, []);

  /**
   * Toggle API key visibility
   */
  const toggleShowApiKey = useCallback(() => {
    setShowApiKey(prev => !prev);
  }, []);

  /**
   * Validate the API key format
   */
  const handleValidate = useCallback(() => {
    const result = apiKeySchema.safeParse(apiKey);
    
    setIsValidKey(result.success);
    
    if (result.success) {
      toast.success('API key format is valid', {
        description: 'The key format looks correct.',
      });
    } else {
      toast.error('Invalid API key format', {
        description: result.error.issues[0]?.message || 'Please check the key format.',
      });
    }
  }, [apiKey]);

  /**
   * Update a preset parameter
   * Requirements: 15.5
   */
  const handlePresetParameterChange = useCallback((
    presetType: Exclude<PresetGestureType, null>,
    paramPath: string,
    value: string
  ) => {
    setPresets(prev => ({
      ...prev,
      [presetType]: {
        ...prev[presetType],
        parameters: {
          ...prev[presetType].parameters,
          [paramPath]: value,
        },
      },
    }));
    setHasPresetChanges(true);
  }, []);

  /**
   * Reset presets to defaults
   * Requirements: 15.5
   */
  const handleResetPresets = useCallback(() => {
    setPresets(DEFAULT_PRESETS);
    setHasPresetChanges(true);
    toast.info('Presets reset to defaults', {
      description: 'Click Save to apply the changes.',
    });
  }, []);

  /**
   * Save the API key and presets to localStorage
   * Requirements: 4.1, 4.2, 15.5
   */
  const handleSave = useCallback(() => {
    // Validate API key before saving
    if (apiKey) {
      const result = apiKeySchema.safeParse(apiKey);
      
      if (!result.success) {
        setIsValidKey(false);
        toast.error('Cannot save invalid API key', {
          description: result.error.issues[0]?.message || 'Please fix the validation errors.',
        });
        return;
      }
      
      // Save API key to localStorage
      localStorage.setItem(STORAGE_KEY_API_KEY, apiKey);
      
      // Update connection status to unknown (will be tested on next API call)
      setConnectionStatus('unknown');
      localStorage.setItem(STORAGE_KEY_CONNECTION_STATUS, 'unknown');
    }
    
    // Save presets if changed
    if (hasPresetChanges) {
      savePresetsToStorage(presets);
    }
    
    // Save HDR setting
    localStorage.setItem(STORAGE_KEY_HDR_ENABLED, String(hdrEnabled));
    
    toast.success('Settings saved', {
      description: 'Your settings have been saved successfully.',
    });
    
    setOpen(false);
    onSettingsUpdated?.();
  }, [apiKey, presets, hasPresetChanges, hdrEnabled, onSettingsUpdated]);

  /**
   * Clear the API key from localStorage
   */
  const handleClear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
    localStorage.removeItem(STORAGE_KEY_CONNECTION_STATUS);
    setApiKey('');
    setIsValidKey(null);
    setConnectionStatus('unknown');
    
    toast.info('API key cleared', {
      description: 'The stored API key has been removed.',
    });
  }, []);

  /**
   * Cancel and close dialog without changes
   */
  const handleCancel = useCallback(() => {
    setOpen(false);
  }, []);

  /**
   * Get connection status badge
   */
  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-green-600 text-white">
            <CheckCircle2 className="w-3 h-3" />
            Connected
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3" />
            Disconnected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Unknown
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your Bria API key, gesture presets, and application settings.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="api" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="api">API Key</TabsTrigger>
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          
          <TabsContent value="api" className="space-y-6 py-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection Status</span>
              {getConnectionBadge()}
            </div>

            {/* API Key Section */}
            <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="api-key" className="text-sm font-medium">
                Bria API Key
              </label>
              <p className="text-xs text-muted-foreground">
                For demo/development: Enter your API key to override the server-side key.
              </p>
            </div>
            
            {/* API Key Input with Toggle */}
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="Enter your Bria API key"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={toggleShowApiKey}
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>

            {/* Validation Status */}
            {isValidKey !== null && (
              <p className={`text-xs ${isValidKey ? 'text-green-600' : 'text-red-600'}`}>
                {isValidKey ? '✓ Valid key format' : '✗ Invalid key format'}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={!apiKey}
              >
                Validate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={!apiKey}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Bria Signup Link */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Don't have an API key?</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <a
                href="https://bria.ai/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center"
              >
                Sign up for Bria
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Create a free account to get your API key and start generating images.
            </p>
          </div>

            {/* Production Note */}
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> In production, the API key is stored securely server-side in environment variables. 
                This client-side override is for demo and development purposes only.
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="presets" className="space-y-6 py-4">
            {/* Preset Customization Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Customize Gesture Presets</h3>
                  <p className="text-xs text-muted-foreground">
                    Modify the parameters applied by each preset gesture
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetPresets}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>

              {/* Peace Sign Preset */}
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✌️</span>
                  <div>
                    <h4 className="text-sm font-medium">{presets.peace.name}</h4>
                    <p className="text-xs text-muted-foreground">{presets.peace.description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Mood & Atmosphere</label>
                    <Input
                      value={presets.peace.parameters['aesthetics.mood_atmosphere'] || ''}
                      onChange={(e) => handlePresetParameterChange('peace', 'aesthetics.mood_atmosphere', e.target.value)}
                      placeholder="e.g., cinematic, dramatic"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Lighting Conditions</label>
                    <Input
                      value={presets.peace.parameters['lighting.conditions'] || ''}
                      onChange={(e) => handlePresetParameterChange('peace', 'lighting.conditions', e.target.value)}
                      placeholder="e.g., dramatic rim lighting"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Thumbs Up Preset */}
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👍</span>
                  <div>
                    <h4 className="text-sm font-medium">{presets.thumbsUp.name}</h4>
                    <p className="text-xs text-muted-foreground">{presets.thumbsUp.description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Mood & Atmosphere</label>
                    <Input
                      value={presets.thumbsUp.parameters['aesthetics.mood_atmosphere'] || ''}
                      onChange={(e) => handlePresetParameterChange('thumbsUp', 'aesthetics.mood_atmosphere', e.target.value)}
                      placeholder="e.g., bright, optimistic"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Color Scheme</label>
                    <Input
                      value={presets.thumbsUp.parameters['aesthetics.color_scheme'] || ''}
                      onChange={(e) => handlePresetParameterChange('thumbsUp', 'aesthetics.color_scheme', e.target.value)}
                      placeholder="e.g., warm, vibrant"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Rock Sign Preset */}
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🤘</span>
                  <div>
                    <h4 className="text-sm font-medium">{presets.rock.name}</h4>
                    <p className="text-xs text-muted-foreground">{presets.rock.description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Mood & Atmosphere</label>
                    <Input
                      value={presets.rock.parameters['aesthetics.mood_atmosphere'] || ''}
                      onChange={(e) => handlePresetParameterChange('rock', 'aesthetics.mood_atmosphere', e.target.value)}
                      placeholder="e.g., edgy, bold"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Shadows</label>
                    <Input
                      value={presets.rock.parameters['lighting.shadows'] || ''}
                      onChange={(e) => handlePresetParameterChange('rock', 'lighting.shadows', e.target.value)}
                      placeholder="e.g., high contrast, dramatic shadows"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Info Note */}
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Tip:</strong> Preset gestures provide quick style shortcuts. Hold the gesture for 1-2 seconds to apply the preset parameters to your prompt.
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-6 py-4">
            {/* HDR Output Mode Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">HDR Output Mode</h3>
                <p className="text-xs text-muted-foreground">
                  Generate 16-bit color depth images for professional workflows
                </p>
              </div>

              {/* HDR Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="hdr-mode" className="text-sm font-medium">
                    Enable HDR Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Request 16-bit color depth from Bria API
                  </p>
                </div>
                <Switch
                  id="hdr-mode"
                  checked={hdrEnabled}
                  onCheckedChange={setHdrEnabled}
                />
              </div>

              {/* HDR Info */}
              <div className="rounded-md bg-muted p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  <strong>What is HDR Mode?</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  HDR (High Dynamic Range) mode generates images with 16-bit color depth instead of standard 8-bit. 
                  This provides a wider color gamut and more detail in highlights and shadows, ideal for professional 
                  color grading and post-production workflows.
                </p>
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> HDR support depends on the Bria API. If HDR is not available, 
                  the system will gracefully fall back to standard 8-bit generation.
                </p>
              </div>

              {/* Export Format Info */}
              {hdrEnabled && (
                <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 p-3">
                  <p className="text-xs text-blue-900 dark:text-blue-100">
                    <strong>Export Format:</strong> HDR images will be exported in 16-bit PNG format 
                    to preserve the full color depth. Standard displays will show tone-mapped versions.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!apiKey || isValidKey === false}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Utility function to get the stored API key
 * Used by other components to access the API key
 */
export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_API_KEY);
}

/**
 * Utility function to update connection status
 * Called after API requests to update the status badge
 */
export function updateConnectionStatus(status: 'connected' | 'disconnected'): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_CONNECTION_STATUS, status);
}

/**
 * Utility function to get HDR mode setting
 * Requirements: 16.1
 */
export function getHDREnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_HDR_ENABLED) === 'true';
}

/**
 * Utility function to set HDR mode setting
 * Requirements: 16.1
 */
export function setHDREnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_HDR_ENABLED, String(enabled));
}

export default SettingsDialog;
