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
import { toast } from 'sonner';
import { Settings, Eye, EyeOff, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { z } from 'zod';

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

  /**
   * Load API key from localStorage when dialog opens
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
   * Save the API key to localStorage
   * Requirements: 4.1, 4.2
   */
  const handleSave = useCallback(() => {
    // Validate before saving
    const result = apiKeySchema.safeParse(apiKey);
    
    if (!result.success) {
      setIsValidKey(false);
      toast.error('Cannot save invalid API key', {
        description: result.error.issues[0]?.message || 'Please fix the validation errors.',
      });
      return;
    }
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_API_KEY, apiKey);
    
    // Update connection status to unknown (will be tested on next API call)
    setConnectionStatus('unknown');
    localStorage.setItem(STORAGE_KEY_CONNECTION_STATUS, 'unknown');
    
    toast.success('API key saved', {
      description: 'Your API key has been saved. It will be used for image generation.',
    });
    
    setOpen(false);
    onSettingsUpdated?.();
  }, [apiKey, onSettingsUpdated]);

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your Bria API key and application settings.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
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
        </div>
        
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

export default SettingsDialog;
