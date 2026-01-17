/**
 * MONOLITH OS - Redis Service
 * Provides caching, rate limiting, sessions, and queue management
 */

import { createClient } from 'redis';

/**
 * Redis Service for production infrastructure
 * Handles caching, rate limiting, session management, and message queues
 */
class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionPromise = null;
  }

  /**
   * Initialize Redis connection
   * @param {Object} config - Redis configuration
   * @param {string} config.url - Redis URL (default: REDIS_URL env or localhost)
   * @returns {Promise<void>}
   */
  async initialize(config = {}) {
    if (this.isConnected) {
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect(config);
    return this.connectionPromise;
  }

  async _connect(config) {
    const url = config.url || process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = createClient({
        url,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('[RedisService] Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('[RedisService] Redis error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[RedisService] Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('[RedisService] Disconnected from Redis');
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('[RedisService] Redis initialization complete');
    } catch (error) {
      console.error('[RedisService] Failed to connect:', error.message);
      this.isConnected = false;
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Close Redis connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
      console.log('[RedisService] Connection closed');
    }
  }

  /**
   * Ensure client is connected
   * @private
   */
  _ensureConnected() {
    if (!this.isConnected || !this.client) {
      throw new Error('Redis client not connected. Call initialize() first.');
    }
  }

  // ============================================
  // Rate Limiting
  // ============================================

  /**
   * Check if request is within rate limit
   * Uses sliding window counter algorithm
   * @param {string} key - Rate limit key (e.g., 'api:user:123')
   * @param {number} limit - Maximum requests allowed
   * @param {number} windowSeconds - Time window in seconds
   * @returns {Promise<{allowed: boolean, remaining: number, resetIn: number}>}
   */
  async checkRateLimit(key, limit, windowSeconds) {
    this._ensureConnected();

    const rateLimitKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    // Use transaction to ensure atomicity
    const multi = this.client.multi();

    // Remove old entries outside the window
    multi.zRemRangeByScore(rateLimitKey, 0, windowStart);

    // Count current entries in window
    multi.zCard(rateLimitKey);

    // Add current request timestamp
    multi.zAdd(rateLimitKey, { score: now, value: `${now}:${Math.random()}` });

    // Set expiry on the key
    multi.expire(rateLimitKey, windowSeconds);

    const results = await multi.exec();
    const currentCount = results[1];

    const allowed = currentCount < limit;
    const remaining = Math.max(0, limit - currentCount - 1);

    // Get oldest entry to calculate reset time
    const oldestEntries = await this.client.zRange(rateLimitKey, 0, 0, { BY_SCORE: true });
    let resetIn = windowSeconds;

    if (oldestEntries.length > 0) {
      const oldestScore = await this.client.zScore(rateLimitKey, oldestEntries[0]);
      if (oldestScore) {
        resetIn = Math.max(0, Math.ceil((oldestScore + windowMs - now) / 1000));
      }
    }

    return {
      allowed,
      remaining: allowed ? remaining : 0,
      resetIn,
      limit,
      current: currentCount + 1,
    };
  }

  // ============================================
  // Caching
  // ============================================

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Parsed value or null if not found
   */
  async get(key) {
    this._ensureConnected();

    const value = await this.client.get(`cache:${key}`);
    if (value === null) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /**
   * Set cached value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttlSeconds - Time to live in seconds (default: 3600)
   * @returns {Promise<void>}
   */
  async set(key, value, ttlSeconds = 3600) {
    this._ensureConnected();

    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.client.setEx(`cache:${key}`, ttlSeconds, serialized);
  }

  /**
   * Delete cached value
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key was deleted
   */
  async del(key) {
    this._ensureConnected();

    const result = await this.client.del(`cache:${key}`);
    return result > 0;
  }

  /**
   * Get or set cached value (cache-aside pattern)
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch value if not cached
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {Promise<any>}
   */
  async getOrSet(key, fetchFn, ttlSeconds = 3600) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Set session data
   * @param {string} sessionId - Session identifier
   * @param {Object} data - Session data
   * @param {number} ttlSeconds - Session TTL (default: 24 hours)
   * @returns {Promise<void>}
   */
  async setSession(sessionId, data, ttlSeconds = 86400) {
    this._ensureConnected();

    const key = `session:${sessionId}`;
    await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
  }

  /**
   * Get session data
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>}
   */
  async getSession(sessionId) {
    this._ensureConnected();

    const key = `session:${sessionId}`;
    const data = await this.client.get(key);

    if (data === null) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Delete session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>}
   */
  async deleteSession(sessionId) {
    this._ensureConnected();

    const result = await this.client.del(`session:${sessionId}`);
    return result > 0;
  }

  /**
   * Refresh session TTL
   * @param {string} sessionId - Session identifier
   * @param {number} ttlSeconds - New TTL in seconds
   * @returns {Promise<boolean>}
   */
  async refreshSession(sessionId, ttlSeconds = 86400) {
    this._ensureConnected();

    const key = `session:${sessionId}`;
    const result = await this.client.expire(key, ttlSeconds);
    return result;
  }

  // ============================================
  // Queue Management
  // ============================================

  /**
   * Push item to queue (FIFO)
   * @param {string} queueName - Queue name
   * @param {any} item - Item to push (will be JSON stringified)
   * @returns {Promise<number>} Queue length after push
   */
  async pushToQueue(queueName, item) {
    this._ensureConnected();

    const key = `queue:${queueName}`;
    const serialized = typeof item === 'string' ? item : JSON.stringify(item);
    return await this.client.rPush(key, serialized);
  }

  /**
   * Pop item from queue (FIFO)
   * @param {string} queueName - Queue name
   * @param {number} timeoutSeconds - Blocking timeout (0 for non-blocking)
   * @returns {Promise<any|null>} Parsed item or null if empty
   */
  async popFromQueue(queueName, timeoutSeconds = 0) {
    this._ensureConnected();

    const key = `queue:${queueName}`;
    let result;

    if (timeoutSeconds > 0) {
      // Blocking pop
      result = await this.client.blPop(key, timeoutSeconds);
      if (result) {
        try {
          return JSON.parse(result.element);
        } catch {
          return result.element;
        }
      }
      return null;
    }

    // Non-blocking pop
    result = await this.client.lPop(key);
    if (result === null) {
      return null;
    }

    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  }

  /**
   * Get queue length
   * @param {string} queueName - Queue name
   * @returns {Promise<number>}
   */
  async getQueueLength(queueName) {
    this._ensureConnected();

    const key = `queue:${queueName}`;
    return await this.client.lLen(key);
  }

  /**
   * Peek at queue items without removing them
   * @param {string} queueName - Queue name
   * @param {number} start - Start index
   * @param {number} end - End index (-1 for all)
   * @returns {Promise<any[]>}
   */
  async peekQueue(queueName, start = 0, end = -1) {
    this._ensureConnected();

    const key = `queue:${queueName}`;
    const items = await this.client.lRange(key, start, end);

    return items.map((item) => {
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Check if Redis is connected
   * @returns {boolean}
   */
  isReady() {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get Redis info
   * @returns {Promise<Object>}
   */
  async getInfo() {
    this._ensureConnected();

    const info = await this.client.info();
    return info;
  }

  /**
   * Flush all keys (use with caution)
   * @returns {Promise<void>}
   */
  async flushAll() {
    this._ensureConnected();

    await this.client.flushAll();
    console.log('[RedisService] All keys flushed');
  }

  /**
   * Get keys matching pattern
   * @param {string} pattern - Key pattern (e.g., 'cache:*')
   * @returns {Promise<string[]>}
   */
  async keys(pattern) {
    this._ensureConnected();

    return await this.client.keys(pattern);
  }
}

// Export singleton instance
const redisService = new RedisService();

export { RedisService };
export default redisService;
