/**
 * Tests for error logger
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  ErrorLogger,
  logger,
  logInfo,
  logWarning,
  logError,
  logCritical,
  withErrorHandling,
  withErrorHandlingSync,
} from '@/lib/error-logger';

describe('ErrorLogger', () => {
  beforeEach(() => {
    // Clear logs before each test
    logger.clearLogs();
    // Clear localStorage
    localStorage.clear();
    // Clear console spies
    vi.clearAllMocks();
  });

  describe('Singleton pattern', () => {
    test('returns same instance', () => {
      const instance1 = ErrorLogger.getInstance();
      const instance2 = ErrorLogger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Logging', () => {
    test('logs info message', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      logInfo('Test info message', {
        component: 'TestComponent',
        action: 'testAction',
      });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].severity).toBe('info');
      expect(logs[0].message).toBe('Test info message');
      expect(logs[0].context.component).toBe('TestComponent');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('logs warning message', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      logWarning('Test warning', {
        component: 'TestComponent',
      });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].severity).toBe('warning');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('logs error with Error object', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      
      logError('Error occurred', error, {
        component: 'TestComponent',
        action: 'testAction',
      });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].severity).toBe('error');
      expect(logs[0].error).toBe(error);
      expect(logs[0].stack).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('logs critical error and persists to localStorage', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Critical error');
      
      logCritical('Critical failure', error, {
        component: 'TestComponent',
      });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].severity).toBe('critical');
      
      // Check localStorage
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith('sculptnet-error-')
      );
      expect(keys.length).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Log management', () => {
    test('maintains maximum log count', () => {
      // Log more than max (100)
      for (let i = 0; i < 150; i++) {
        logInfo(`Message ${i}`);
      }

      const logs = logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(100);
    });

    test('filters logs by severity', () => {
      logInfo('Info 1');
      logWarning('Warning 1');
      logError('Error 1');
      logInfo('Info 2');

      const errorLogs = logger.getLogsBySeverity('error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Error 1');
    });

    test('filters logs by component', () => {
      logInfo('Message 1', { component: 'ComponentA' });
      logInfo('Message 2', { component: 'ComponentB' });
      logInfo('Message 3', { component: 'ComponentA' });

      const componentALogs = logger.getLogsByComponent('ComponentA');
      expect(componentALogs).toHaveLength(2);
    });

    test('clears all logs', () => {
      logInfo('Message 1');
      logInfo('Message 2');
      expect(logger.getLogs()).toHaveLength(2);

      logger.clearLogs();
      expect(logger.getLogs()).toHaveLength(0);
    });

    test('exports logs as JSON', () => {
      logInfo('Test message', { component: 'Test' });
      
      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].message).toBe('Test message');
    });
  });

  describe('Error handling decorators', () => {
    test('withErrorHandling wraps async function', async () => {
      const asyncFn = async (value: number) => {
        if (value < 0) throw new Error('Negative value');
        return value * 2;
      };

      const wrapped = withErrorHandling(asyncFn as (...args: unknown[]) => Promise<unknown>, {
        component: 'TestComponent',
        action: 'asyncFn',
      }) as (value: number) => Promise<number>;

      // Should work normally
      const result = await wrapped(5);
      expect(result).toBe(10);

      // Should log error and rethrow
      await expect(wrapped(-1)).rejects.toThrow('Negative value');
      
      const errorLogs = logger.getLogsBySeverity('error');
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    test('withErrorHandlingSync wraps sync function', () => {
      const syncFn = (value: number) => {
        if (value < 0) throw new Error('Negative value');
        return value * 2;
      };

      const wrapped = withErrorHandlingSync(syncFn as (...args: unknown[]) => unknown, {
        component: 'TestComponent',
        action: 'syncFn',
      }) as (value: number) => number;

      // Should work normally
      const result = wrapped(5);
      expect(result).toBe(10);

      // Should log error and rethrow
      expect(() => wrapped(-1)).toThrow('Negative value');
      
      const errorLogs = logger.getLogsBySeverity('error');
      expect(errorLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Session tracking', () => {
    test('generates unique session ID', () => {
      const sessionId = logger.getSessionId();
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    test('includes session ID in log context', () => {
      logInfo('Test message');
      
      const logs = logger.getLogs();
      expect(logs[0].context.sessionId).toBeDefined();
      expect(logs[0].context.sessionId).toBe(logger.getSessionId());
    });
  });

  describe('localStorage cleanup', () => {
    test('cleans up old errors when limit exceeded', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create more than 10 critical errors
      for (let i = 0; i < 15; i++) {
        logCritical(`Error ${i}`, new Error(`Error ${i}`));
      }

      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith('sculptnet-error-')
      );
      
      // Should keep only last 10
      expect(keys.length).toBeLessThanOrEqual(10);
      
      consoleSpy.mockRestore();
    });
  });
});
