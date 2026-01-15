/**
 * MONOLITH OS - Phase 3: Authentication & Security
 * Authentication Middleware
 * Task 3.1.2 - Create Auth Middleware
 */

import { verifyAccessToken, extractBearerToken } from '../auth/AuthService.js';

/**
 * Authentication middleware - validates JWT Bearer token
 * Extracts user info to req.user
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function requireAuth(req, res, next) {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No authorization header provided',
        code: 'MISSING_AUTH_HEADER'
      });
    }

    // Extract Bearer token
    const token = extractBearerToken(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization format. Expected: Bearer <token>',
        code: 'INVALID_AUTH_FORMAT'
      });
    }

    // Verify the token
    const decoded = verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      tokenExp: decoded.exp
    };

    // Add request tracking
    req.authTimestamp = Date.now();

    next();
  } catch (error) {
    console.warn(`[AUTH] Token verification failed: ${error.message}`, {
      path: req.path,
      ip: req.ip
    });

    // Differentiate between expired and invalid tokens
    if (error.message.includes('expired')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid access token',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Role-based authorization middleware factory
 * Checks if the authenticated user has one of the required roles
 *
 * @param {...string} allowedRoles - Roles that are allowed access
 * @returns {Function} Express middleware function
 *
 * @example
 * // Single role
 * app.get('/admin', requireAuth, requireRole('admin'), adminHandler);
 *
 * // Multiple roles
 * app.get('/reports', requireAuth, requireRole('admin', 'analyst'), reportsHandler);
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // Ensure requireAuth was called first
    if (!req.user) {
      console.error('[AUTH] requireRole called without prior requireAuth');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication middleware not properly configured',
        code: 'AUTH_CONFIG_ERROR'
      });
    }

    const userRole = req.user.role;

    // Check if user's role is in the allowed roles list
    // Case-insensitive comparison
    const hasRole = allowedRoles.some(
      role => role.toLowerCase() === userRole?.toLowerCase()
    );

    if (!hasRole) {
      console.warn(`[AUTH] Access denied for role '${userRole}' on ${req.method} ${req.path}`, {
        userId: req.user.id,
        requiredRoles: allowedRoles,
        userRole
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE'
      });
    }

    next();
  };
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present and valid, but doesn't require it
 * Useful for endpoints that have different behavior for authenticated vs anonymous users
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const token = extractBearerToken(authHeader);

    if (!token) {
      return next();
    }

    const decoded = verifyAccessToken(token);

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      tokenExp: decoded.exp
    };
  } catch {
    // Token invalid or expired - continue without user
    // Don't block the request, just don't attach user
  }

  next();
}

/**
 * API Key authentication middleware
 * For service-to-service communication
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    console.error('[AUTH] API_KEY environment variable not configured');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'API key authentication not configured',
      code: 'API_KEY_NOT_CONFIGURED'
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required',
      code: 'MISSING_API_KEY'
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(apiKey, validApiKey)) {
    console.warn(`[AUTH] Invalid API key attempt from ${req.ip}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }

  req.authType = 'api-key';
  next();
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    // Still perform comparison to prevent length-based timing
    const dummy = Buffer.alloc(aBuffer.length);
    return timingSafeEqual(aBuffer, dummy) && false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Timing-safe comparison (Node.js crypto.timingSafeEqual equivalent)
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Check if user has specific permission
 * For more granular permission control
 *
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware
 */
export function requirePermission(permission) {
  // Role to permissions mapping
  const rolePermissions = {
    admin: ['*'], // All permissions
    analyst: ['read', 'analyze', 'export'],
    operator: ['read', 'execute'],
    viewer: ['read']
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication middleware not properly configured',
        code: 'AUTH_CONFIG_ERROR'
      });
    }

    const userPermissions = rolePermissions[req.user.role?.toLowerCase()] || [];

    // Check for wildcard or specific permission
    const hasPermission = userPermissions.includes('*') ||
                          userPermissions.includes(permission);

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission denied: ${permission}`,
        code: 'INSUFFICIENT_PERMISSION'
      });
    }

    next();
  };
}

export default {
  requireAuth,
  requireRole,
  optionalAuth,
  requireApiKey,
  requirePermission
};
