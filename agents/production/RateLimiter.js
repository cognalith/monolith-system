/**
 * MONOLITH OS - Rate Limiter
 * Token bucket rate limiting for API calls
 *
 * Features:
 * - Token bucket algorithm
 * - Per-operation rate limits
 * - Queue with timeout
 * - Burst handling
 */

class RateLimiter {
  constructor(config = {}) {
    // Default limits
    this.limits = {
      default: {
        tokensPerSecond: config.tokensPerSecond || 10,
        bucketSize: config.bucketSize || 20,
        tokens: config.bucketSize || 20,
        lastRefill: Date.now(),
      },
    };

    // Per-operation limits
    this.operationLimits = config.operationLimits || {};

    // Queue for waiting requests
    this.queue = [];
    this.maxQueueSize = config.maxQueueSize || 100;
    this.queueTimeout = config.queueTimeout || 30000;

    // Statistics
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      throttledRequests: 0,
      queuedRequests: 0,
      timeouts: 0,
    };

    // Start token refill timer
    this.refillInterval = setInterval(() => this.refillAllBuckets(), 100);
  }

  /**
   * Acquire permission to proceed
   */
  async acquire(operationId = 'default') {
    this.stats.totalRequests++;

    // Initialize bucket if needed
    this.ensureBucket(operationId);

    const bucket = this.limits[operationId];

    // Try to acquire immediately
    if (bucket.tokens >= 1) {
      bucket.tokens--;
      this.stats.allowedRequests++;
      return true;
    }

    // Queue if possible
    if (this.queue.length >= this.maxQueueSize) {
      this.stats.throttledRequests++;
      throw new Error('Rate limit exceeded and queue full');
    }

    // Wait in queue
    return this.waitInQueue(operationId);
  }

  /**
   * Wait in queue for token
   */
  waitInQueue(operationId) {
    this.stats.queuedRequests++;

    return new Promise((resolve, reject) => {
      const entry = {
        operationId,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.queue.push(entry);

      // Set timeout
      const timeout = setTimeout(() => {
        const index = this.queue.indexOf(entry);
        if (index > -1) {
          this.queue.splice(index, 1);
          this.stats.timeouts++;
          reject(new Error('Rate limit queue timeout'));
        }
      }, this.queueTimeout);

      entry.timeout = timeout;
    });
  }

  /**
   * Process queue
   */
  processQueue() {
    const now = Date.now();

    // Process queued requests in order
    while (this.queue.length > 0) {
      const entry = this.queue[0];
      const bucket = this.limits[entry.operationId];

      if (!bucket || bucket.tokens < 1) {
        break;
      }

      // Remove from queue
      this.queue.shift();
      clearTimeout(entry.timeout);

      // Consume token and resolve
      bucket.tokens--;
      this.stats.allowedRequests++;
      entry.resolve(true);
    }
  }

  /**
   * Ensure bucket exists for operation
   */
  ensureBucket(operationId) {
    if (!this.limits[operationId]) {
      const config = this.operationLimits[operationId] || this.limits.default;
      this.limits[operationId] = {
        tokensPerSecond: config.tokensPerSecond || this.limits.default.tokensPerSecond,
        bucketSize: config.bucketSize || this.limits.default.bucketSize,
        tokens: config.bucketSize || this.limits.default.bucketSize,
        lastRefill: Date.now(),
      };
    }
  }

  /**
   * Refill all buckets
   */
  refillAllBuckets() {
    const now = Date.now();

    for (const [operationId, bucket] of Object.entries(this.limits)) {
      const elapsed = (now - bucket.lastRefill) / 1000;
      const tokensToAdd = elapsed * bucket.tokensPerSecond;

      bucket.tokens = Math.min(bucket.bucketSize, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Process queue after refill
    this.processQueue();
  }

  /**
   * Set custom rate limit for operation
   */
  setLimit(operationId, tokensPerSecond, bucketSize) {
    this.limits[operationId] = {
      tokensPerSecond,
      bucketSize,
      tokens: bucketSize,
      lastRefill: Date.now(),
    };
  }

  /**
   * Get current state
   */
  getState() {
    const bucketStates = {};
    for (const [id, bucket] of Object.entries(this.limits)) {
      bucketStates[id] = {
        tokens: Math.floor(bucket.tokens),
        bucketSize: bucket.bucketSize,
        tokensPerSecond: bucket.tokensPerSecond,
        percentFull: Math.round((bucket.tokens / bucket.bucketSize) * 100),
      };
    }

    return {
      buckets: bucketStates,
      queueLength: this.queue.length,
      stats: this.stats,
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      throttledRequests: 0,
      queuedRequests: 0,
      timeouts: 0,
    };
  }

  /**
   * Stop the rate limiter
   */
  stop() {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
      this.refillInterval = null;
    }

    // Reject all queued requests
    for (const entry of this.queue) {
      clearTimeout(entry.timeout);
      entry.reject(new Error('Rate limiter stopped'));
    }
    this.queue = [];
  }
}

export default RateLimiter;
