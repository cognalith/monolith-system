/**
 * MONOLITH OS - Phase 7: API Security Hardening
 * Rate Limiting Middleware
 * Task 7.0.3.1 - Implement rate limiting middleware
 */

// In-memory store for rate limiting (production should use Redis)
const rateLimitStore = new Map();

// Configuration for different endpoint sensitivity levels
const rateLimitConfig = {
  // Critical endpoints - very strict limits
  critical: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    endpoints: ['/api/gdpr/delete', '/api/gdpr/export', '/api/incident']
  },
  // Sensitive endpoints - moderate limits
  sensitive: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    endpoints: ['/api/decision', '/api/audit', '/api/consent']
  },
  // Standard endpoints - normal limits
  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    endpoints: ['/api/dashboard', '/api/recent-activity', '/api/pending-tasks']
  },
  // Health check - very permissive
  health: {
    windowMs: 60 * 1000,
    maxRequests: 1000,
    endpoints: ['/api/health']
  }
};

/**
 * Get rate limit tier for an endpoint
 */
function getRateLimitTier(path) {
  for (const [tier, config] of Object.entries(rateLimitConfig)) {
    for (const endpoint of config.endpoints) {
      if (path.startsWith(endpoint)) {
        return { tier, ...config };
      }
    }
  }
  // Default to standard limits
  return { tier: 'standard', ...rateLimitConfig.standard };
}

/**
 * Clean up expired entries from the store
 */
function cleanupStore() {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.windowStart + data.windowMs) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every minute
setInterval(cleanupStore, 60 * 1000);

/**
 * Rate Limiting Middleware
 * Implements sliding window rate limiting per IP and endpoint
 */
export function rateLimiter(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const path = req.path;
  const { tier, windowMs, maxRequests } = getRateLimitTier(path);
  
  // Create unique key for this client and endpoint tier
  const key = `${clientIP}:${tier}`;
  const now = Date.now();
  
  let clientData = rateLimitStore.get(key);
  
  if (!clientData || now > clientData.windowStart + windowMs) {
    // New window
    clientData = {
      windowStart: now,
      windowMs,
      requestCount: 1
    };
    rateLimitStore.set(key, clientData);
  } else {
    // Existing window - increment counter
    clientData.requestCount++;
    rateLimitStore.set(key, clientData);
  }
  
  // Set rate limit headers
  const remaining = Math.max(0, maxRequests - clientData.requestCount);
  const resetTime = Math.ceil((clientData.windowStart + windowMs - now) / 1000);
  
  res.set({
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
    'X-RateLimit-Tier': tier
  });
  
  // Check if rate limit exceeded
  if (clientData.requestCount > maxRequests) {
    console.warn(`[RATE_LIMIT] IP: ${clientIP}, Tier: ${tier}, Path: ${path}`);
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${resetTime} seconds.`,
      retryAfter: resetTime,
      tier
    });
  }
  
  next();
}

/**
 * Export configuration for testing/monitoring
 */
export { rateLimitConfig, rateLimitStore };
