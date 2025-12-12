/**
 * Collaboration Manager with Socket.io
 * 
 * Enables real-time collaboration by syncing JSON prompt state
 * across multiple users via WebSocket connections.
 * 
 * Features:
 * - WebSocket connection management
 * - Broadcast local updates to collaborators
 * - Receive and merge remote updates
 * - Last-write-wins conflict resolution based on timestamp
 * - Graceful connection loss handling with auto-retry
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { io, Socket } from 'socket.io-client';

// ============ Types ============

/**
 * Prompt update event payload
 */
export interface PromptUpdateEvent {
  /** JSON path of the updated field (e.g., "camera.fov") */
  path: string;
  /** New value for the field */
  value: unknown;
  /** Timestamp of the update (milliseconds since epoch) */
  timestamp: number;
  /** ID of the user who made the update */
  userId: string;
}

/**
 * Connected user information
 */
export interface ConnectedUser {
  userId: string;
  joinedAt: number;
}

/**
 * Collaboration state
 */
export interface CollaborationState {
  connected: boolean;
  roomId: string | null;
  userId: string;
  connectedUsers: ConnectedUser[];
  lastError: string | null;
}

/**
 * Callback for remote update events
 */
export type RemoteUpdateCallback = (
  path: string,
  value: unknown,
  userId: string,
  timestamp: number
) => void;

/**
 * Callback for connection state changes
 */
export type ConnectionStateCallback = (connected: boolean) => void;

/**
 * Callback for user list changes
 */
export type UsersChangedCallback = (users: ConnectedUser[]) => void;

// ============ Constants ============

/** Retry interval for reconnection attempts (30 seconds) */
const RETRY_INTERVAL_MS = 30000;

/** Event names for Socket.io */
const EVENTS = {
  PROMPT_UPDATE: 'prompt-update',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  USERS_LIST: 'users-list',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
} as const;

// ============ Collaboration Manager Class ============

/**
 * CollaborationManager handles real-time synchronization of prompt state
 * across multiple users using Socket.io WebSocket connections.
 */
export class CollaborationManager {
  private socket: Socket | null = null;
  private state: CollaborationState;
  private remoteUpdateCallbacks: Set<RemoteUpdateCallback> = new Set();
  private connectionStateCallbacks: Set<ConnectionStateCallback> = new Set();
  private usersChangedCallbacks: Set<UsersChangedCallback> = new Set();
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private serverUrl: string;
  private lastUpdateTimestamps: Map<string, number> = new Map();

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || process.env.NEXT_PUBLIC_SOCKET_URL || '';
    this.state = {
      connected: false,
      roomId: null,
      userId: this.generateUserId(),
      connectedUsers: [],
      lastError: null,
    };
  }

  /**
   * Generate a unique user ID
   */
  private generateUserId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Connect to the collaboration server and join a room
   * 
   * @param roomId - Room identifier to join
   * @returns Promise that resolves when connected
   * 
   * Requirements: 8.1
   */
  async connect(roomId: string): Promise<void> {
    // Clear any pending retry
    this.clearRetryTimeout();

    // If already connected to the same room, do nothing
    if (this.socket?.connected && this.state.roomId === roomId) {
      return;
    }

    // Disconnect from any existing connection
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Validate server URL
    if (!this.serverUrl) {
      this.state.lastError = 'No collaboration server URL configured';
      throw new Error(this.state.lastError);
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: false, // We handle reconnection manually
        });

        // Handle successful connection
        this.socket.on('connect', () => {
          this.state.connected = true;
          this.state.roomId = roomId;
          this.state.lastError = null;

          // Join the room
          this.socket?.emit(EVENTS.JOIN_ROOM, {
            roomId,
            userId: this.state.userId,
          });

          // Notify listeners
          this.notifyConnectionState(true);
          resolve();
        });

        // Handle connection error
        this.socket.on('connect_error', (error) => {
          this.state.lastError = error.message;
          this.handleDisconnect();
          reject(new Error(`Connection failed: ${error.message}`));
        });

        // Handle disconnection
        this.socket.on('disconnect', (reason) => {
          this.state.lastError = `Disconnected: ${reason}`;
          this.handleDisconnect();
        });

        // Handle prompt updates from other users
        this.socket.on(EVENTS.PROMPT_UPDATE, (event: PromptUpdateEvent) => {
          this.handleRemoteUpdate(event);
        });

        // Handle user joined events
        this.socket.on(EVENTS.USER_JOINED, (user: ConnectedUser) => {
          if (!this.state.connectedUsers.find(u => u.userId === user.userId)) {
            this.state.connectedUsers.push(user);
            this.notifyUsersChanged();
          }
        });

        // Handle user left events
        this.socket.on(EVENTS.USER_LEFT, (userId: string) => {
          this.state.connectedUsers = this.state.connectedUsers.filter(
            u => u.userId !== userId
          );
          this.notifyUsersChanged();
        });

        // Handle users list (received on join)
        this.socket.on(EVENTS.USERS_LIST, (users: ConnectedUser[]) => {
          this.state.connectedUsers = users;
          this.notifyUsersChanged();
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.state.lastError = errorMessage;
        reject(new Error(`Failed to initialize socket: ${errorMessage}`));
      }
    });
  }

  /**
   * Disconnect from the collaboration server
   * 
   * Requirements: 8.4
   */
  disconnect(): void {
    this.clearRetryTimeout();

    if (this.socket) {
      // Leave the room before disconnecting
      if (this.state.roomId) {
        this.socket.emit(EVENTS.LEAVE_ROOM, {
          roomId: this.state.roomId,
          userId: this.state.userId,
        });
      }

      this.socket.disconnect();
      this.socket = null;
    }

    this.state.connected = false;
    this.state.roomId = null;
    this.state.connectedUsers = [];
    this.lastUpdateTimestamps.clear();
    
    this.notifyConnectionState(false);
  }

  /**
   * Broadcast a prompt update to all collaborators
   * 
   * @param path - JSON path of the updated field
   * @param value - New value for the field
   * 
   * Requirements: 8.2
   */
  broadcastUpdate(path: string, value: unknown): void {
    if (!this.socket?.connected || !this.state.roomId) {
      // In local-only mode, just track the timestamp
      this.lastUpdateTimestamps.set(path, Date.now());
      return;
    }

    const event: PromptUpdateEvent = {
      path,
      value,
      timestamp: Date.now(),
      userId: this.state.userId,
    };

    // Track our own update timestamp
    this.lastUpdateTimestamps.set(path, event.timestamp);

    // Emit to all users in the room
    this.socket.emit(EVENTS.PROMPT_UPDATE, {
      ...event,
      roomId: this.state.roomId,
    });
  }

  /**
   * Register a callback for remote update events
   * 
   * @param callback - Function to call when remote updates are received
   * @returns Unsubscribe function
   * 
   * Requirements: 8.3
   */
  onRemoteUpdate(callback: RemoteUpdateCallback): () => void {
    this.remoteUpdateCallbacks.add(callback);
    return () => {
      this.remoteUpdateCallbacks.delete(callback);
    };
  }

  /**
   * Register a callback for connection state changes
   * 
   * @param callback - Function to call when connection state changes
   * @returns Unsubscribe function
   */
  onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    this.connectionStateCallbacks.add(callback);
    return () => {
      this.connectionStateCallbacks.delete(callback);
    };
  }

  /**
   * Register a callback for user list changes
   * 
   * @param callback - Function to call when user list changes
   * @returns Unsubscribe function
   */
  onUsersChanged(callback: UsersChangedCallback): () => void {
    this.usersChangedCallbacks.add(callback);
    return () => {
      this.usersChangedCallbacks.delete(callback);
    };
  }

  /**
   * Get list of connected users
   * 
   * @returns Array of user IDs
   */
  getConnectedUsers(): string[] {
    return this.state.connectedUsers.map(u => u.userId);
  }

  /**
   * Get the current collaboration state
   */
  getState(): Readonly<CollaborationState> {
    return { ...this.state };
  }

  /**
   * Check if connected to collaboration server
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * Get the current user's ID
   */
  getUserId(): string {
    return this.state.userId;
  }

  /**
   * Get the current room ID
   */
  getRoomId(): string | null {
    return this.state.roomId;
  }

  // ============ Private Methods ============

  /**
   * Handle remote update events with timestamp-based conflict resolution
   * 
   * Requirements: 8.3, 8.5
   */
  private handleRemoteUpdate(event: PromptUpdateEvent): void {
    // Ignore our own updates
    if (event.userId === this.state.userId) {
      return;
    }

    // Last-write-wins conflict resolution based on timestamp
    const lastLocalTimestamp = this.lastUpdateTimestamps.get(event.path) || 0;
    
    if (event.timestamp > lastLocalTimestamp) {
      // Remote update is newer, apply it
      this.lastUpdateTimestamps.set(event.path, event.timestamp);
      
      // Notify all registered callbacks
      this.remoteUpdateCallbacks.forEach(callback => {
        try {
          callback(event.path, event.value, event.userId, event.timestamp);
        } catch (error) {
          console.error('Error in remote update callback:', error);
        }
      });
    }
    // If local timestamp is newer or equal, ignore the remote update
  }

  /**
   * Handle disconnection and schedule retry
   * 
   * Requirements: 8.4
   */
  private handleDisconnect(): void {
    const wasConnected = this.state.connected;
    const roomId = this.state.roomId;

    this.state.connected = false;
    
    if (wasConnected) {
      this.notifyConnectionState(false);
    }

    // Schedule retry if we were in a room
    if (roomId) {
      this.scheduleRetry(roomId);
    }
  }

  /**
   * Schedule a reconnection attempt
   * 
   * Requirements: 8.4
   */
  private scheduleRetry(roomId: string): void {
    this.clearRetryTimeout();

    this.retryTimeoutId = setTimeout(async () => {
      try {
        await this.connect(roomId);
      } catch {
        // Retry failed, schedule another attempt
        this.scheduleRetry(roomId);
      }
    }, RETRY_INTERVAL_MS);
  }

  /**
   * Clear any pending retry timeout
   */
  private clearRetryTimeout(): void {
    if (this.retryTimeoutId !== null) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  /**
   * Notify connection state callbacks
   */
  private notifyConnectionState(connected: boolean): void {
    this.connectionStateCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in connection state callback:', error);
      }
    });
  }

  /**
   * Notify users changed callbacks
   */
  private notifyUsersChanged(): void {
    this.usersChangedCallbacks.forEach(callback => {
      try {
        callback([...this.state.connectedUsers]);
      } catch (error) {
        console.error('Error in users changed callback:', error);
      }
    });
  }
}

// ============ Singleton Instance ============

let collaborationManagerInstance: CollaborationManager | null = null;

/**
 * Get the singleton CollaborationManager instance
 */
export function getCollaborationManager(): CollaborationManager {
  if (!collaborationManagerInstance) {
    collaborationManagerInstance = new CollaborationManager();
  }
  return collaborationManagerInstance;
}

/**
 * Create a new CollaborationManager instance (for testing)
 */
export function createCollaborationManager(serverUrl?: string): CollaborationManager {
  return new CollaborationManager(serverUrl);
}
