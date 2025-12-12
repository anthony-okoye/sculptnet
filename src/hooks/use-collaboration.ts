/**
 * React hook for Collaboration Manager
 * 
 * Provides a React-friendly interface for real-time collaboration
 * with automatic cleanup and state synchronization.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CollaborationManager,
  createCollaborationManager,
  type CollaborationState,
  type ConnectedUser,
} from '@/lib/collaboration-manager';
import { usePromptStore } from '@/lib/stores/prompt-store';

// ============ Types ============

export interface UseCollaborationOptions {
  /** Server URL (defaults to NEXT_PUBLIC_SOCKET_URL) */
  serverUrl?: string;
  /** Auto-apply remote updates to prompt store */
  autoApplyUpdates?: boolean;
}

export interface UseCollaborationReturn {
  /** Whether connected to collaboration server */
  isConnected: boolean;
  /** Current room ID */
  roomId: string | null;
  /** Current user ID */
  userId: string;
  /** List of connected user IDs */
  connectedUsers: string[];
  /** Last error message */
  lastError: string | null;
  /** Connect to a room */
  connect: (roomId: string) => Promise<void>;
  /** Disconnect from collaboration */
  disconnect: () => void;
  /** Broadcast a prompt update */
  broadcastUpdate: (path: string, value: unknown) => void;
  /** Full collaboration state */
  state: CollaborationState;
}

// ============ Hook Implementation ============

/**
 * Hook for managing collaboration state and actions
 * 
 * @param options - Configuration options
 * @returns Collaboration state and actions
 */
export function useCollaboration(
  options: UseCollaborationOptions = {}
): UseCollaborationReturn {
  const { serverUrl, autoApplyUpdates = true } = options;
  
  const managerRef = useRef<CollaborationManager | null>(null);
  const [state, setState] = useState<CollaborationState>({
    connected: false,
    roomId: null,
    userId: '',
    connectedUsers: [],
    lastError: null,
  });

  // Get prompt store update function
  const updatePrompt = usePromptStore(state => state.update);

  // Initialize manager on mount
  useEffect(() => {
    managerRef.current = createCollaborationManager(serverUrl);
    setState(managerRef.current.getState());

    return () => {
      managerRef.current?.disconnect();
      managerRef.current = null;
    };
  }, [serverUrl]);

  // Subscribe to connection state changes
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    const unsubscribe = manager.onConnectionStateChange((connected) => {
      setState(manager.getState());
    });

    return unsubscribe;
  }, []);

  // Subscribe to users changed events
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    const unsubscribe = manager.onUsersChanged(() => {
      setState(manager.getState());
    });

    return unsubscribe;
  }, []);

  // Subscribe to remote updates and apply to prompt store
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager || !autoApplyUpdates) return;

    const unsubscribe = manager.onRemoteUpdate((path, value) => {
      // Apply remote update to prompt store
      updatePrompt(path, value);
    });

    return unsubscribe;
  }, [autoApplyUpdates, updatePrompt]);

  // Connect to a room
  const connect = useCallback(async (roomId: string) => {
    const manager = managerRef.current;
    if (!manager) {
      throw new Error('Collaboration manager not initialized');
    }

    await manager.connect(roomId);
    setState(manager.getState());
  }, []);

  // Disconnect from collaboration
  const disconnect = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) return;

    manager.disconnect();
    setState(manager.getState());
  }, []);

  // Broadcast a prompt update
  const broadcastUpdate = useCallback((path: string, value: unknown) => {
    const manager = managerRef.current;
    if (!manager) return;

    manager.broadcastUpdate(path, value);
  }, []);

  return {
    isConnected: state.connected,
    roomId: state.roomId,
    userId: state.userId,
    connectedUsers: state.connectedUsers.map(u => u.userId),
    lastError: state.lastError,
    connect,
    disconnect,
    broadcastUpdate,
    state,
  };
}

// ============ Integration with Prompt Store ============

/**
 * Hook that integrates collaboration with prompt store updates
 * 
 * Automatically broadcasts local prompt changes to collaborators
 * and applies remote changes to the local store.
 */
export function useCollaborativePrompt(
  options: UseCollaborationOptions = {}
): UseCollaborationReturn & {
  /** Update prompt and broadcast to collaborators */
  updateAndBroadcast: (path: string, value: unknown) => void;
} {
  const collaboration = useCollaboration(options);
  const updatePrompt = usePromptStore(state => state.update);

  // Update prompt locally and broadcast to collaborators
  const updateAndBroadcast = useCallback((path: string, value: unknown) => {
    // Update local prompt store
    const result = updatePrompt(path, value);
    
    // If update succeeded, broadcast to collaborators
    if (result.success) {
      collaboration.broadcastUpdate(path, value);
    }
  }, [updatePrompt, collaboration]);

  return {
    ...collaboration,
    updateAndBroadcast,
  };
}
