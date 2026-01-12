/**
 * MONOLITH OS - Graceful Shutdown Handler
 * Proper shutdown handling for production
 *
 * Features:
 * - Signal handling (SIGTERM, SIGINT)
 * - Cleanup callbacks
 * - Drain connections
 * - Timeout enforcement
 */

class GracefulShutdown {
  constructor(config = {}) {
    this.timeout = config.timeout || 30000;
    this.cleanupHandlers = [];
    this.isShuttingDown = false;
    this.exitCode = 0;

    // Bind methods
    this.shutdown = this.shutdown.bind(this);
  }

  /**
   * Register cleanup handler
   */
  registerCleanup(name, handler, priority = 0) {
    this.cleanupHandlers.push({
      name,
      handler,
      priority,
    });

    // Sort by priority (higher first)
    this.cleanupHandlers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Set up signal handlers
   */
  setup() {
    // Handle SIGTERM (Kubernetes, Docker)
    process.on('SIGTERM', () => {
      console.log('[SHUTDOWN] Received SIGTERM signal');
      this.shutdown();
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('[SHUTDOWN] Received SIGINT signal');
      this.shutdown();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('[SHUTDOWN] Uncaught exception:', error);
      this.exitCode = 1;
      this.shutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[SHUTDOWN] Unhandled rejection at:', promise, 'reason:', reason);
      this.exitCode = 1;
      this.shutdown();
    });

    console.log('[SHUTDOWN] Graceful shutdown handlers registered');
  }

  /**
   * Initiate graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) {
      console.log('[SHUTDOWN] Already shutting down, ignoring...');
      return;
    }

    this.isShuttingDown = true;
    console.log('[SHUTDOWN] Starting graceful shutdown...');

    // Set timeout for forced exit
    const forceExitTimeout = setTimeout(() => {
      console.error('[SHUTDOWN] Timeout exceeded, forcing exit');
      process.exit(this.exitCode || 1);
    }, this.timeout);

    try {
      // Run cleanup handlers in order
      for (const handler of this.cleanupHandlers) {
        console.log(`[SHUTDOWN] Running cleanup: ${handler.name}`);
        try {
          await Promise.race([
            handler.handler(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Handler timeout')), this.timeout / 2)
            ),
          ]);
          console.log(`[SHUTDOWN] Completed: ${handler.name}`);
        } catch (error) {
          console.error(`[SHUTDOWN] Error in ${handler.name}:`, error.message);
        }
      }

      clearTimeout(forceExitTimeout);
      console.log('[SHUTDOWN] Graceful shutdown complete');
      process.exit(this.exitCode);
    } catch (error) {
      console.error('[SHUTDOWN] Error during shutdown:', error);
      clearTimeout(forceExitTimeout);
      process.exit(this.exitCode || 1);
    }
  }

  /**
   * Check if shutting down
   */
  isShuttingDownNow() {
    return this.isShuttingDown;
  }

  /**
   * Create common cleanup handlers
   */
  static createCommonHandlers() {
    return {
      // Stop accepting new connections
      stopServer: (server) => ({
        name: 'HTTP Server',
        priority: 100,
        handler: () => new Promise((resolve) => {
          if (server?.close) {
            server.close(resolve);
          } else {
            resolve();
          }
        }),
      }),

      // Stop task orchestrator
      stopOrchestrator: (orchestrator) => ({
        name: 'Task Orchestrator',
        priority: 80,
        handler: async () => {
          if (orchestrator?.stop) {
            await orchestrator.stop();
          }
        },
      }),

      // Stop rate limiter
      stopRateLimiter: (rateLimiter) => ({
        name: 'Rate Limiter',
        priority: 60,
        handler: () => {
          if (rateLimiter?.stop) {
            rateLimiter.stop();
          }
        },
      }),

      // Stop health checker
      stopHealthChecker: (healthChecker) => ({
        name: 'Health Checker',
        priority: 40,
        handler: () => {
          if (healthChecker?.stopPeriodicChecks) {
            healthChecker.stopPeriodicChecks();
          }
        },
      }),

      // Flush logs
      flushLogs: (logger) => ({
        name: 'Logger Flush',
        priority: 20,
        handler: async () => {
          if (logger?.flush) {
            await logger.flush();
          }
        },
      }),

      // Close database connections
      closeDatabase: (db) => ({
        name: 'Database',
        priority: 10,
        handler: async () => {
          if (db?.close) {
            await db.close();
          }
        },
      }),
    };
  }
}

export default GracefulShutdown;
