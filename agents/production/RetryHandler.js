/**
 * MONOLITH OS - Retry Handler
 * Retry logic with exponential backoff for resilient operations
 *
 * Features:
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Circuit breaker pattern
 * - Retry statistics
 */

class RetryHandler {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.baseDelay = config.baseDelay || 1000;
    this.maxDelay = config.maxDelay || 30000;
    this.backoffMultiplier = config.backoffMultiplier || 2;
    this.jitterFactor = config.jitterFactor || 0.1;

    // Circuit breaker settings
    this.circuitBreaker = {
      enabled: config.circuitBreaker !== false,
      threshold: config.circuitBreakerThreshold || 5,
      resetTimeout: config.circuitBreakerResetTimeout || 60000,
      failures: new Map(),
      openCircuits: new Map(),
    };

    // Statistics
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedAfterRetries: 0,
      circuitBreakerTrips: 0,
    };

    // Retryable error patterns
    this.retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'rate_limit',
      'overloaded',
      '429',
      '500',
      '502',
      '503',
      '504',
    ];
  }

  /**
   * Execute with retry logic
   */
  async execute(operation, options = {}) {
    const operationId = options.id || 'default';
    const maxRetries = options.maxRetries ?? this.maxRetries;

    // Check circuit breaker
    if (this.isCircuitOpen(operationId)) {
      throw new Error(`Circuit breaker open for ${operationId}`);
    }

    let lastError;
    let attempt = 0;

    while (attempt <= maxRetries) {
      this.stats.totalAttempts++;

      try {
        const result = await operation();

        // Reset circuit breaker on success
        this.resetCircuit(operationId);

        if (attempt > 0) {
          this.stats.successfulRetries++;
        }

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        // Check if error is retryable
        if (!this.isRetryable(error) || attempt > maxRetries) {
          this.recordFailure(operationId);
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);

        console.log(
          `[RETRY] Attempt ${attempt}/${maxRetries} for ${operationId}, ` +
          `retrying in ${delay}ms: ${error.message}`
        );

        await this.sleep(delay);
      }
    }

    this.stats.failedAfterRetries++;
    throw lastError;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);

    // Add jitter
    const jitter = cappedDelay * this.jitterFactor * (Math.random() * 2 - 1);
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error) {
    const errorString = (error.message || '') + (error.code || '') + (error.status || '');

    return this.retryableErrors.some(pattern =>
      errorString.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if circuit breaker is open
   */
  isCircuitOpen(operationId) {
    if (!this.circuitBreaker.enabled) return false;

    const circuit = this.circuitBreaker.openCircuits.get(operationId);
    if (!circuit) return false;

    // Check if reset timeout has passed
    if (Date.now() - circuit.openedAt > this.circuitBreaker.resetTimeout) {
      // Allow half-open attempt
      circuit.halfOpen = true;
      return false;
    }

    return true;
  }

  /**
   * Record failure for circuit breaker
   */
  recordFailure(operationId) {
    if (!this.circuitBreaker.enabled) return;

    const failures = (this.circuitBreaker.failures.get(operationId) || 0) + 1;
    this.circuitBreaker.failures.set(operationId, failures);

    if (failures >= this.circuitBreaker.threshold) {
      this.openCircuit(operationId);
    }
  }

  /**
   * Open circuit breaker
   */
  openCircuit(operationId) {
    this.circuitBreaker.openCircuits.set(operationId, {
      openedAt: Date.now(),
      halfOpen: false,
    });

    this.circuitBreaker.failures.delete(operationId);
    this.stats.circuitBreakerTrips++;

    console.log(`[CIRCUIT] Circuit breaker opened for ${operationId}`);
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(operationId) {
    this.circuitBreaker.failures.delete(operationId);
    this.circuitBreaker.openCircuits.delete(operationId);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add custom retryable error pattern
   */
  addRetryableError(pattern) {
    if (!this.retryableErrors.includes(pattern)) {
      this.retryableErrors.push(pattern);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      openCircuits: Array.from(this.circuitBreaker.openCircuits.keys()),
      failureCounters: Object.fromEntries(this.circuitBreaker.failures),
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedAfterRetries: 0,
      circuitBreakerTrips: 0,
    };
  }
}

export default RetryHandler;
