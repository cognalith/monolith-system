/**
 * MONOLITH OS - Phase 3: Authentication & Security
 * AuthService - JWT Token Management and Password Hashing
 * Task 3.1.1 - Create AuthService
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Configuration from environment variables with secure defaults
const config = {
  jwtSecret: process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_PRODUCTION',
  jwtExpiry: process.env.JWT_EXPIRY || '15m',
  refreshExpiry: process.env.REFRESH_EXPIRY || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  issuer: 'monolith-os',
  audience: 'monolith-dashboard'
};

/**
 * Generate an access token for a user
 * @param {Object} user - User object with id, email, role
 * @returns {string} JWT access token
 */
export function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    type: 'access'
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry,
    issuer: config.issuer,
    audience: config.audience
  });
}

/**
 * Generate a refresh token for a user
 * @param {Object} user - User object with id
 * @returns {string} JWT refresh token
 */
export function generateRefreshToken(user) {
  const payload = {
    sub: user.id,
    type: 'refresh',
    // Include a random jti (JWT ID) for revocation purposes
    jti: `${user.id}_${Date.now()}_${Math.random().toString(36).substring(2)}`
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.refreshExpiry,
    issuer: config.issuer,
    audience: config.audience
  });
}

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Object containing accessToken and refreshToken
 */
export function generateTokenPair(user) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
    expiresIn: config.jwtExpiry,
    tokenType: 'Bearer'
  };
}

/**
 * Verify an access token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      issuer: config.issuer,
      audience: config.audience
    });

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type: expected access token');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid access token');
    }
    throw error;
  }
}

/**
 * Verify a refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      issuer: config.issuer,
      audience: config.audience
    });

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  return bcrypt.hash(password, config.bcryptRounds);
}

/**
 * Compare a password with its hash
 * @param {string} password - Plain text password
 * @param {string} hash - Bcrypt hash to compare against
 * @returns {Promise<boolean>} True if password matches
 */
export async function comparePassword(password, hash) {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

/**
 * Decode a token without verifying (useful for debugging)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token or null if invalid
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
export function extractBearerToken(authHeader) {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Check if a token is about to expire (within 5 minutes)
 * @param {string} token - JWT token
 * @returns {boolean} True if token expires within 5 minutes
 */
export function isTokenExpiringSoon(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true;
  }

  const expiresAt = decoded.exp * 1000;
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);

  return expiresAt < fiveMinutesFromNow;
}

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null if invalid
 */
export function getTokenExpiration(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return null;
  }
  return new Date(decoded.exp * 1000);
}

// Export configuration for testing purposes
export function getConfig() {
  return {
    jwtExpiry: config.jwtExpiry,
    refreshExpiry: config.refreshExpiry,
    bcryptRounds: config.bcryptRounds,
    issuer: config.issuer,
    audience: config.audience
  };
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  hashPassword,
  comparePassword,
  decodeToken,
  extractBearerToken,
  isTokenExpiringSoon,
  getTokenExpiration,
  getConfig
};
