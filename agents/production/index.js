/**
 * MONOLITH OS - Production Module
 * Production-ready components for resilience and reliability
 */

import RetryHandler from './RetryHandler.js';
import RateLimiter from './RateLimiter.js';
import configManager, { ConfigManager } from './ConfigManager.js';
import HealthChecker from './HealthChecker.js';
import GracefulShutdown from './GracefulShutdown.js';

/**
 * Production wrapper - applies production features to operations
 */
class ProductionWrapper {
  constructor(config = {}) {
    this.retryHandler = new RetryHandler(config.retry);
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.healthChecker = new HealthChecker(config.health);
    this.gracefulShutdown = new GracefulShutdown(config.shutdown);

    // Load configuration
    this.config = configManager.load();
  }

  /**
   * Initialize production features
   */
  initialize() {
    // Set up graceful shutdown
    this.gracefulShutdown.setup();

    // Start health checks
    this.healthChecker.startPeriodicChecks();

    // Register cleanup handlers
    this.gracefulShutdown.registerCleanup('Rate Limiter', () => {
      this.rateLimiter.stop();
    }, 60);

    this.gracefulShutdown.registerCleanup('Health Checker', () => {
      this.healthChecker.stopPeriodicChecks();
    }, 40);

    // Validate configuration
    const validation = this.config ? configManager.validate() : { valid: false };
    if (!validation.valid && this.config?.env?.isProduction) {
      console.error('[PRODUCTION] Configuration validation failed:', validation.errors);
    }

    console.log('[PRODUCTION] Production wrapper initialized');
  }

  /**
   * Wrap an async operation with production features
   */
  async wrap(operation, options = {}) {
    const operationId = options.id || 'default';

    // Check if shutting down
    if (this.gracefulShutdown.isShuttingDownNow()) {
      throw new Error('System is shutting down');
    }

    // Apply rate limiting
    if (options.rateLimit !== false) {
      await this.rateLimiter.acquire(operationId);
    }

    // Apply retry logic
    if (options.retry !== false) {
      return this.retryHandler.execute(operation, {
        id: operationId,
        maxRetries: options.maxRetries,
      });
    }

    return operation();
  }

  /**
   * Get production status
   */
  async getStatus() {
    return {
      health: await this.healthChecker.getStatus(),
      rateLimit: this.rateLimiter.getState(),
      retry: this.retryHandler.getStats(),
      config: configManager.getSafeConfig(),
    };
  }

  /**
   * Stop all production features
   */
  async stop() {
    this.rateLimiter.stop();
    this.healthChecker.stopPeriodicChecks();
  }
}

export {
  ProductionWrapper,
  RetryHandler,
  RateLimiter,
  ConfigManager,
  configManager,
  HealthChecker,
  GracefulShutdown,
};

export default ProductionWrapper;
