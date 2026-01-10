/**
 * MONOLITH OS - Phase 7: API Security Hardening
 * CSRF Protection Middleware
 * Task 7.0.3.3 - Deploy CSRF protection tokens
 */

import crypto from 'crypto';

// CSRF token store (in production, use session store or Redis)
const csrfTokenStore = new Map();

// Token configuration
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY = 2 * 60 * 60 * 1000; // 2 hours

// State-changing HTTP methods that require CSRF protection
const PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Endpoints exempt from CSRF (e.g., public API endpoints with other auth)
const CSRF_EXEMPT_PATHS = [
  '/api/health',
  '/api/webhook', // Webhooks use their own authentication
  '/api/notifications/test'
];

/**
 * Generate a cryptographically secure CSRF token
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Create a new CSRF token for a session
 */
export function createCsrfToken(sessionId) {
  const token = generateToken();
  const expiresAt = Date.now() + TOKEN_EXPIRY;
  
  csrfTokenStore.set(sessionId, {
    token,
    expiresAt,
    createdAt: Date.now()
  });
  
  return token;
}

/**
 * Validate a CSRF token
 */
function validateToken(sessionId, providedToken) {
  const stored = csrfTokenStore.get(sessionId);
  
  if (!stored) {
    return { valid: false, reason: 'No token found for session' };
  }
  
  if (Date.now() > stored.expiresAt) {
    csrfTokenStore.delete(sessionId);
    return { valid: false, reason: 'Token expired' };
  }
  
  // Use timing-safe comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(providedToken || '');
  const storedBuffer = Buffer.from(stored.token);
  
  if (tokenBuffer.length !== storedBuffer.length) {
    return { valid: false, reason: 'Token length mismatch' };
  }
  
  if (!crypto.timingSafeEqual(tokenBuffer, storedBuffer)) {
    return { valid: false, reason: 'Token mismatch' };
  }
  
  return { valid: true };
}

/**
 * Clean up expired tokens
 */
function cleanupTokens() {
  const now = Date.now();
  for (const [sessionId, data] of csrfTokenStore.entries()) {
    if (now > data.expiresAt) {
      csrfTokenStore.delete(sessionId);
    }
  }
}

// Cleanup every 15 minutes
setInterval(cleanupTokens, 15 * 60 * 1000);

/**
 * CSRF Protection Middleware
 */
export function csrfProtection(req, res, next) {
  // Skip for non-state-changing methods
  if (!PROTECTED_METHODS.includes(req.method)) {
    return next();
  }
  
  // Skip for exempt paths
  const isExempt = CSRF_EXEMPT_PATHS.some(path => req.path.startsWith(path));
  if (isExempt) {
    return next();
  }
  
  // Get session ID (from cookie, header, or generate one)
  const sessionId = req.cookies?.sessionId || 
                    req.headers['x-session-id'] || 
                    req.ip;
  
  // Get CSRF token from request
  const providedToken = req.headers['x-csrf-token'] || 
                        req.body?._csrf || 
                        req.query?._csrf;
  
  // Validate the token
  const validation = validateToken(sessionId, providedToken);
  
  if (!validation.valid) {
    console.warn(\`[CSRF] Validation failed: \${validation.reason}, IP: \${req.ip}, Path: \${req.path}\`);
    return res.status(403).json({
      error: 'CSRF Validation Failed',
      message: 'Invalid or missing CSRF token. Please refresh and try again.',
      code: 'CSRF_ERROR'
    });
  }
  
  next();
}

/**
 * Middleware to generate and attach CSRF token to responses
 */
export function attachCsrfToken(req, res, next) {
  const sessionId = req.cookies?.sessionId || 
                    req.headers['x-session-id'] || 
                    req.ip;
  
  // Check if we need to create a new token
  const stored = csrfTokenStore.get(sessionId);
  let token;
  
  if (!stored || Date.now() > stored.expiresAt - (15 * 60 * 1000)) {
    // Create new token if none exists or about to expire
    token = createCsrfToken(sessionId);
  } else {
    token = stored.token;
  }
  
  // Attach token to response header
  res.setHeader('X-CSRF-Token', token);
  
  // Also attach to locals for template rendering
  res.locals.csrfToken = token;
  
  next();
}

/**
 * API endpoint to get a new CSRF token
 */
export function getCsrfTokenEndpoint(req, res) {
  const sessionId = req.cookies?.sessionId || 
                    req.headers['x-session-id'] || 
                    req.ip;
  
  const token = createCsrfToken(sessionId);
  
  res.json({
    csrfToken: token,
    expiresIn: TOKEN_EXPIRY / 1000, // in seconds
    message: 'Include this token in X-CSRF-Token header for state-changing requests'
  });
}

export { csrfTokenStore };
