/**
 * Settings Dialog Component Tests
 * 
 * Tests for the API key configuration UI component.
 * 
 * Requirements: 4.1, 4.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsDialog, getStoredApiKey, updateConnectionStatus } from '@/components/settings-dialog';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('SettingsDialog', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('Rendering', () => {
    it('should render the settings trigger button', () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      expect(trigger).toBeDefined();
    });

    it('should open dialog when trigger is clicked', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByText(/configure your bria api key/i)).toBeDefined();
      });
    });

    it('should display connection status badge', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByText('Connection Status')).toBeDefined();
      });
    });

    it('should display Bria signup link', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /sign up for bria/i });
        expect(link).toBeDefined();
        expect(link.getAttribute('href')).toBe('https://bria.ai/signup');
      });
    });
  });

  describe('API Key Input', () => {
    it('should allow entering an API key', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/enter your bria api key/i) as HTMLInputElement;
        expect(input).toBeDefined();
        
        fireEvent.change(input, { target: { value: 'test-api-key-12345' } });
        expect(input.value).toBe('test-api-key-12345');
      });
    });

    it('should mask API key by default', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/enter your bria api key/i) as HTMLInputElement;
        expect(input.type).toBe('password');
      });
    });

    it('should toggle API key visibility', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/enter your bria api key/i) as HTMLInputElement;
        const toggleButton = screen.getByLabelText(/show api key/i);
        
        expect(input.type).toBe('password');
        
        fireEvent.click(toggleButton);
        expect(input.type).toBe('text');
        
        fireEvent.click(toggleButton);
        expect(input.type).toBe('password');
      });
    });
  });

  describe('API Key Validation', () => {
    it('should validate API key format', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(async () => {
        const input = screen.getByPlaceholderText(/enter your bria api key/i);
        const validateButton = screen.getByRole('button', { name: /validate/i });
        
        // Test invalid key (too short)
        fireEvent.change(input, { target: { value: 'short' } });
        fireEvent.click(validateButton);
        
        await waitFor(() => {
          expect(screen.getByText(/invalid key format/i)).toBeDefined();
        });
      });
    });

    it('should accept valid API key format', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(async () => {
        const input = screen.getByPlaceholderText(/enter your bria api key/i);
        const validateButton = screen.getByRole('button', { name: /validate/i });
        
        // Test valid key
        fireEvent.change(input, { target: { value: 'valid-api-key-12345' } });
        fireEvent.click(validateButton);
        
        await waitFor(() => {
          expect(screen.getByText(/valid key format/i)).toBeDefined();
        });
      });
    });
  });

  describe('API Key Storage', () => {
    it('should save API key to localStorage', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(async () => {
        const input = screen.getByPlaceholderText(/enter your bria api key/i);
        const saveButton = screen.getByRole('button', { name: /save settings/i });
        
        fireEvent.change(input, { target: { value: 'test-api-key-12345' } });
        fireEvent.click(saveButton);
        
        await waitFor(() => {
          expect(localStorageMock.getItem('sculptnet_bria_api_key')).toBe('test-api-key-12345');
        });
      });
    });

    it('should load API key from localStorage on open', async () => {
      localStorageMock.setItem('sculptnet_bria_api_key', 'stored-api-key');
      
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const input = screen.getByPlaceholderText(/enter your bria api key/i) as HTMLInputElement;
        expect(input.value).toBe('stored-api-key');
      });
    });

    it('should clear API key from localStorage', async () => {
      localStorageMock.setItem('sculptnet_bria_api_key', 'test-key');
      
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(async () => {
        const clearButton = screen.getByRole('button', { name: /clear/i });
        fireEvent.click(clearButton);
        
        await waitFor(() => {
          expect(localStorageMock.getItem('sculptnet_bria_api_key')).toBeNull();
        });
      });
    });
  });

  describe('Utility Functions', () => {
    it('getStoredApiKey should return stored key', () => {
      localStorageMock.setItem('sculptnet_bria_api_key', 'test-key');
      expect(getStoredApiKey()).toBe('test-key');
    });

    it('getStoredApiKey should return null when no key stored', () => {
      expect(getStoredApiKey()).toBeNull();
    });

    it('updateConnectionStatus should update status in localStorage', () => {
      updateConnectionStatus('connected');
      expect(localStorageMock.getItem('sculptnet_connection_status')).toBe('connected');
      
      updateConnectionStatus('disconnected');
      expect(localStorageMock.getItem('sculptnet_connection_status')).toBe('disconnected');
    });
  });

  describe('Connection Status Badge', () => {
    it('should show connected badge when status is connected', async () => {
      localStorageMock.setItem('sculptnet_connection_status', 'connected');
      
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByText('Connected')).toBeDefined();
      });
    });

    it('should show disconnected badge when status is disconnected', async () => {
      localStorageMock.setItem('sculptnet_connection_status', 'disconnected');
      
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeDefined();
      });
    });

    it('should show unknown badge when status is not set', async () => {
      render(<SettingsDialog />);
      
      const trigger = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(trigger);
      
      await waitFor(() => {
        expect(screen.getByText('Unknown')).toBeDefined();
      });
    });
  });
});
