/**
 * Centralized error logging and handling system
 * Provides structured logging with context for debugging and monitoring
 */

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  severity: ErrorSeverity;
  message: string;
  error?: Error;
  context: ErrorContext;
  timestamp: number;
  stack?: string;
}

/**
 * Error logger class for centralized error handling
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory
  private sessionId: string;

  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log an error with context
   */
  log(
    severity: ErrorSeverity,
    message: string,
    error?: Error,
    context: ErrorContext = {}
  ): void {
    const entry: LogEntry = {
      severity,
      message,
      error,
      context: {
        ...context,
        sessionId: this.sessionId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
      stack: error?.stack,
    };

    // Add to in-memory logs
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }

    // Console logging with appropriate level
    this.logToConsole(entry);

    // Store critical errors in localStorage for debugging
    if (severity === 'critical') {
      this.persistCriticalError(entry);
    }
  }

  /**
   * Log to console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.severity.toUpperCase()}] [${entry.context.component || 'Unknown'}]`;
    const timestamp = new Date(entry.timestamp).toISOString();
    const contextStr = entry.context.action ? ` - ${entry.context.action}` : '';
    
    const logMessage = `${prefix}${contextStr} (${timestamp}): ${entry.message}`;

    switch (entry.severity) {
      case 'critical':
      case 'error':
        console.error(logMessage, entry.error || '', entry.context.metadata || '');
        if (entry.stack) {
          console.error('Stack trace:', entry.stack);
        }
        break;
      case 'warning':
        console.warn(logMessage, entry.context.metadata || '');
        break;
      case 'info':
        console.info(logMessage, entry.context.metadata || '');
        break;
    }
  }

  /**
   * Persist critical errors to localStorage
   */
  private persistCriticalError(entry: LogEntry): void {
    try {
      const key = `sculptnet-error-${entry.timestamp}`;
      const value = JSON.stringify({
        message: entry.message,
        component: entry.context.component,
        action: entry.context.action,
        timestamp: entry.timestamp,
        stack: entry.stack,
      });
      localStorage.setItem(key, value);

      // Clean up old errors (keep last 10)
      this.cleanupOldErrors();
    } catch (e) {
      // Silently fail if localStorage is unavailable
      console.error('Failed to persist error to localStorage:', e);
    }
  }

  /**
   * Clean up old persisted errors
   */
  private cleanupOldErrors(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith('sculptnet-error-')
      );
      
      if (keys.length > 10) {
        // Sort by timestamp and remove oldest
        keys.sort().slice(0, keys.length - 10).forEach(key => {
          localStorage.removeItem(key);
        });
      }
    } catch (e) {
      // Silently fail
    }
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by severity
   */
  getLogsBySeverity(severity: ErrorSeverity): LogEntry[] {
    return this.logs.filter(log => log.severity === severity);
  }

  /**
   * Get logs by component
   */
  getLogsByComponent(component: string): LogEntry[] {
    return this.logs.filter(log => log.context.component === component);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

/**
 * Convenience functions for logging
 */
export const logger = ErrorLogger.getInstance();

export function logInfo(message: string, context?: ErrorContext): void {
  logger.log('info', message, undefined, context);
}

export function logWarning(message: string, context?: ErrorContext): void {
  logger.log('warning', message, undefined, context);
}

export function logError(message: string, error?: Error, context?: ErrorContext): void {
  logger.log('error', message, error, context);
}

export function logCritical(message: string, error?: Error, context?: ErrorContext): void {
  logger.log('critical', message, error, context);
}

/**
 * Decorator for wrapping async functions with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context: ErrorContext
): T {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(
        `Error in ${context.component || 'unknown'}.${context.action || 'unknown'}`,
        error instanceof Error ? error : new Error(String(error)),
        context
      );
      throw error;
    }
  }) as T;
}

/**
 * Decorator for wrapping sync functions with error handling
 */
export function withErrorHandlingSync<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context: ErrorContext
): T {
  return ((...args: unknown[]) => {
    try {
      return fn(...args);
    } catch (error) {
      logError(
        `Error in ${context.component || 'unknown'}.${context.action || 'unknown'}`,
        error instanceof Error ? error : new Error(String(error)),
        context
      );
      throw error;
    }
  }) as T;
}
