/**
 * Tests for Collaboration Manager
 * 
 * Tests the CollaborationManager class for:
 * - WebSocket connection management
 * - Broadcasting local updates
 * - Receiving and merging remote updates
 * - Last-write-wins conflict resolution
 * - Graceful connection loss handling
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CollaborationManager,
  createCollaborationManager,
  type PromptUpdateEvent,
  type ConnectedUser,
} from '@/lib/collaboration-manager';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    connected: false,
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  
  return {
    io: vi.fn(() => mockSocket),
  };
});

import { io } from 'socket.io-client';

describe('CollaborationManager', () => {
  let manager: CollaborationManager;
  let mockSocket: ReturnType<typeof io>;
  const testServerUrl = 'http://localhost:3001';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Get the mock socket
    mockSocket = io() as unknown as ReturnType<typeof io>;
    (mockSocket as unknown as { connected: boolean }).connected = false;
    
    manager = createCollaborationManager(testServerUrl);
  });

  afterEach(() => {
    vi.useRealTimers();
    manager.disconnect();
  });

  describe('constructor', () => {
    test('initializes with disconnected state', () => {
      const state = manager.getState();
      
      expect(state.connected).toBe(false);
      expect(state.roomId).toBeNull();
      expect(state.connectedUsers).toEqual([]);
      expect(state.lastError).toBeNull();
    });

    test('generates unique user ID', () => {
      const manager1 = createCollaborationManager(testServerUrl);
      const manager2 = createCollaborationManager(testServerUrl);
      
      expect(manager1.getUserId()).not.toBe(manager2.getUserId());
      expect(manager1.getUserId()).toMatch(/^user-\d+-[a-z0-9]+$/);
    });
  });

  describe('connect()', () => {
    test('throws error when no server URL configured', async () => {
      const managerNoUrl = createCollaborationManager('');
      
      await expect(managerNoUrl.connect('test-room')).rejects.toThrow(
        'No collaboration server URL configured'
      );
    });

    test('creates socket connection with correct options (Requirement 8.1)', async () => {
      // Simulate successful connection
      const connectPromise = manager.connect('test-room');
      
      // Get the 'connect' callback and call it
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      expect(io).toHaveBeenCalledWith(testServerUrl, expect.objectContaining({
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: false,
      }));
    });

    test('emits join-room event on successful connection', async () => {
      const connectPromise = manager.connect('test-room');
      
      // Simulate successful connection
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      expect(mockSocket.emit).toHaveBeenCalledWith('join-room', {
        roomId: 'test-room',
        userId: manager.getUserId(),
      });
    });

    test('updates state on successful connection', async () => {
      const connectPromise = manager.connect('test-room');
      
      // Simulate successful connection
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      expect(manager.isConnected()).toBe(true);
      expect(manager.getRoomId()).toBe('test-room');
    });

    test('rejects on connection error', async () => {
      const connectPromise = manager.connect('test-room');
      
      // Simulate connection error
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const errorCallback = onCalls.find(call => call[0] === 'connect_error')?.[1];
      
      if (errorCallback) {
        errorCallback(new Error('Connection refused'));
      }
      
      await expect(connectPromise).rejects.toThrow('Connection failed: Connection refused');
    });
  });

  describe('disconnect()', () => {
    test('emits leave-room event before disconnecting', async () => {
      // First connect
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Then disconnect
      manager.disconnect();
      
      expect(mockSocket.emit).toHaveBeenCalledWith('leave-room', {
        roomId: 'test-room',
        userId: manager.getUserId(),
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    test('updates state on disconnect', async () => {
      // First connect
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Then disconnect
      manager.disconnect();
      
      expect(manager.isConnected()).toBe(false);
      expect(manager.getRoomId()).toBeNull();
      expect(manager.getConnectedUsers()).toEqual([]);
    });
  });

  describe('broadcastUpdate()', () => {
    test('emits prompt-update event when connected (Requirement 8.2)', async () => {
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Broadcast update
      manager.broadcastUpdate('camera.fov', 85);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('prompt-update', expect.objectContaining({
        path: 'camera.fov',
        value: 85,
        userId: manager.getUserId(),
        roomId: 'test-room',
        timestamp: expect.any(Number),
      }));
    });

    test('includes timestamp in broadcast event', async () => {
      const now = Date.now();
      vi.setSystemTime(now);
      
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Broadcast update
      manager.broadcastUpdate('lighting.conditions', 'golden hour');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('prompt-update', expect.objectContaining({
        timestamp: now,
      }));
    });

    test('does not emit when disconnected (local-only mode)', () => {
      // Don't connect, just broadcast
      manager.broadcastUpdate('camera.fov', 85);
      
      // Should not emit prompt-update (only io() was called in setup)
      const emitCalls = (mockSocket.emit as ReturnType<typeof vi.fn>).mock.calls;
      const promptUpdateCalls = emitCalls.filter(call => call[0] === 'prompt-update');
      
      expect(promptUpdateCalls).toHaveLength(0);
    });
  });

  describe('onRemoteUpdate()', () => {
    test('registers callback for remote updates (Requirement 8.3)', async () => {
      const callback = vi.fn();
      
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Register callback
      manager.onRemoteUpdate(callback);
      
      // Simulate receiving remote update
      const promptUpdateCallback = onCalls.find(call => call[0] === 'prompt-update')?.[1];
      
      if (promptUpdateCallback) {
        const remoteEvent: PromptUpdateEvent = {
          path: 'camera.fov',
          value: 100,
          timestamp: Date.now() + 1000, // Future timestamp
          userId: 'other-user',
        };
        
        promptUpdateCallback(remoteEvent);
      }
      
      expect(callback).toHaveBeenCalledWith(
        'camera.fov',
        100,
        'other-user',
        expect.any(Number)
      );
    });

    test('returns unsubscribe function', async () => {
      const callback = vi.fn();
      
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Register and then unsubscribe
      const unsubscribe = manager.onRemoteUpdate(callback);
      unsubscribe();
      
      // Simulate receiving remote update
      const promptUpdateCallback = onCalls.find(call => call[0] === 'prompt-update')?.[1];
      
      if (promptUpdateCallback) {
        const remoteEvent: PromptUpdateEvent = {
          path: 'camera.fov',
          value: 100,
          timestamp: Date.now() + 1000,
          userId: 'other-user',
        };
        
        promptUpdateCallback(remoteEvent);
      }
      
      // Callback should not be called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });

    test('ignores updates from self', async () => {
      const callback = vi.fn();
      
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Register callback
      manager.onRemoteUpdate(callback);
      
      // Simulate receiving update from self
      const promptUpdateCallback = onCalls.find(call => call[0] === 'prompt-update')?.[1];
      
      if (promptUpdateCallback) {
        const selfEvent: PromptUpdateEvent = {
          path: 'camera.fov',
          value: 100,
          timestamp: Date.now() + 1000,
          userId: manager.getUserId(), // Same as self
        };
        
        promptUpdateCallback(selfEvent);
      }
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('timestamp conflict resolution (Requirement 8.5)', () => {
    test('applies remote update with newer timestamp', async () => {
      const callback = vi.fn();
      const now = Date.now();
      vi.setSystemTime(now);
      
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Register callback
      manager.onRemoteUpdate(callback);
      
      // Make a local update first
      manager.broadcastUpdate('camera.fov', 50);
      
      // Simulate receiving remote update with newer timestamp
      const promptUpdateCallback = onCalls.find(call => call[0] === 'prompt-update')?.[1];
      
      if (promptUpdateCallback) {
        const remoteEvent: PromptUpdateEvent = {
          path: 'camera.fov',
          value: 100,
          timestamp: now + 1000, // Newer than local
          userId: 'other-user',
        };
        
        promptUpdateCallback(remoteEvent);
      }
      
      expect(callback).toHaveBeenCalledWith('camera.fov', 100, 'other-user', now + 1000);
    });

    test('ignores remote update with older timestamp', async () => {
      const callback = vi.fn();
      const now = Date.now();
      vi.setSystemTime(now);
      
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Register callback
      manager.onRemoteUpdate(callback);
      
      // Make a local update first
      manager.broadcastUpdate('camera.fov', 50);
      
      // Simulate receiving remote update with older timestamp
      const promptUpdateCallback = onCalls.find(call => call[0] === 'prompt-update')?.[1];
      
      if (promptUpdateCallback) {
        const remoteEvent: PromptUpdateEvent = {
          path: 'camera.fov',
          value: 100,
          timestamp: now - 1000, // Older than local
          userId: 'other-user',
        };
        
        promptUpdateCallback(remoteEvent);
      }
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('connection loss handling (Requirement 8.4)', () => {
    test('continues in local-only mode on disconnect', async () => {
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Simulate disconnect
      const disconnectCallback = onCalls.find(call => call[0] === 'disconnect')?.[1];
      
      if (disconnectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = false;
        disconnectCallback('transport close');
      }
      
      expect(manager.isConnected()).toBe(false);
      
      // Should still be able to broadcast (locally tracked)
      expect(() => manager.broadcastUpdate('camera.fov', 85)).not.toThrow();
    });

    test('notifies connection state callbacks on disconnect', async () => {
      const connectionCallback = vi.fn();
      
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Register connection state callback
      manager.onConnectionStateChange(connectionCallback);
      
      // Simulate disconnect
      const disconnectCallback = onCalls.find(call => call[0] === 'disconnect')?.[1];
      
      if (disconnectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = false;
        disconnectCallback('transport close');
      }
      
      expect(connectionCallback).toHaveBeenCalledWith(false);
    });

    test('schedules retry after 30 seconds on disconnect', async () => {
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Clear previous io() calls
      vi.clearAllMocks();
      
      // Simulate disconnect
      const disconnectCallback = onCalls.find(call => call[0] === 'disconnect')?.[1];
      
      if (disconnectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = false;
        disconnectCallback('transport close');
      }
      
      // Fast-forward 30 seconds
      await vi.advanceTimersByTimeAsync(30000);
      
      // Should attempt to reconnect
      expect(io).toHaveBeenCalledWith(testServerUrl, expect.any(Object));
    });
  });

  describe('getConnectedUsers()', () => {
    test('returns empty array when not connected', () => {
      expect(manager.getConnectedUsers()).toEqual([]);
    });

    test('returns user IDs from connected users', async () => {
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Simulate receiving users list
      const usersListCallback = onCalls.find(call => call[0] === 'users-list')?.[1];
      
      if (usersListCallback) {
        const users: ConnectedUser[] = [
          { userId: 'user-1', joinedAt: Date.now() },
          { userId: 'user-2', joinedAt: Date.now() },
        ];
        
        usersListCallback(users);
      }
      
      expect(manager.getConnectedUsers()).toEqual(['user-1', 'user-2']);
    });

    test('updates on user-joined event', async () => {
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // Simulate user joining
      const userJoinedCallback = onCalls.find(call => call[0] === 'user-joined')?.[1];
      
      if (userJoinedCallback) {
        const newUser: ConnectedUser = { userId: 'new-user', joinedAt: Date.now() };
        userJoinedCallback(newUser);
      }
      
      expect(manager.getConnectedUsers()).toContain('new-user');
    });

    test('updates on user-left event', async () => {
      // Connect first
      const connectPromise = manager.connect('test-room');
      const onCalls = (mockSocket.on as ReturnType<typeof vi.fn>).mock.calls;
      const connectCallback = onCalls.find(call => call[0] === 'connect')?.[1];
      
      if (connectCallback) {
        (mockSocket as unknown as { connected: boolean }).connected = true;
        connectCallback();
      }
      
      await connectPromise;
      
      // First add some users
      const usersListCallback = onCalls.find(call => call[0] === 'users-list')?.[1];
      
      if (usersListCallback) {
        const users: ConnectedUser[] = [
          { userId: 'user-1', joinedAt: Date.now() },
          { userId: 'user-2', joinedAt: Date.now() },
        ];
        
        usersListCallback(users);
      }
      
      // Simulate user leaving
      const userLeftCallback = onCalls.find(call => call[0] === 'user-left')?.[1];
      
      if (userLeftCallback) {
        userLeftCallback('user-1');
      }
      
      expect(manager.getConnectedUsers()).not.toContain('user-1');
      expect(manager.getConnectedUsers()).toContain('user-2');
    });
  });
});
