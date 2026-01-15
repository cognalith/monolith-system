/**
 * MONOLITH OS - Phase 3: Authentication & Security
 * Auth Routes - Login, Register, Refresh Token
 * Task 3.2 - Create auth routes
 */

import express from 'express';
import {
  generateTokenPair,
  hashPassword,
  comparePassword,
  verifyRefreshToken
} from '../auth/AuthService.js';

const router = express.Router();

// In-memory user store (replace with database in production)
// This is a simple implementation for demonstration
const users = new Map();

// Refresh token blacklist for revocation
const revokedTokens = new Set();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, role = 'viewer' } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // Check if user already exists
    if (users.has(email.toLowerCase())) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists',
        code: 'USER_EXISTS'
      });
    }

    // Validate role
    const allowedRoles = ['admin', 'analyst', 'operator', 'viewer'];
    const normalizedRole = role.toLowerCase();
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}`,
        code: 'INVALID_ROLE'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const user = {
      id: userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: normalizedRole,
      createdAt: new Date().toISOString()
    };

    users.set(email.toLowerCase(), user);

    console.log(`[AUTH] User registered: ${email} with role: ${normalizedRole}`);

    // Generate tokens
    const tokens = generateTokenPair(user);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      ...tokens
    });
  } catch (error) {
    console.error('[AUTH] Registration error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register user',
      code: 'REGISTRATION_FAILED'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user
    const user = users.get(email.toLowerCase());

    if (!user) {
      // Use same error message to prevent user enumeration
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      console.warn(`[AUTH] Failed login attempt for: ${email}`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    console.log(`[AUTH] User logged in: ${email}`);

    // Generate tokens
    const tokens = generateTokenPair(user);

    // Update last login
    user.lastLogin = new Date().toISOString();

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      ...tokens
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to authenticate',
      code: 'AUTH_FAILED'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Exchange refresh token for new access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    // Check if token is revoked
    if (revokedTokens.has(refreshToken)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user by ID from token
    let user = null;
    for (const u of users.values()) {
      if (u.id === decoded.sub) {
        user = u;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    console.log(`[AUTH] Token refreshed for: ${user.email}`);

    // Generate new token pair
    const tokens = generateTokenPair(user);

    // Optionally revoke the old refresh token (rotation strategy)
    // revokedTokens.add(refreshToken);

    res.json({
      message: 'Token refreshed successfully',
      ...tokens
    });
  } catch (error) {
    console.error('[AUTH] Token refresh error:', error.message);

    if (error.message.includes('expired')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token has expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

/**
 * POST /api/auth/logout
 * Revoke refresh token
 */
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    revokedTokens.add(refreshToken);
    console.log('[AUTH] Token revoked via logout');
  }

  res.json({
    message: 'Logged out successfully'
  });
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', (req, res) => {
  // This route should be protected by requireAuth middleware
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Find full user info
  let user = null;
  for (const u of users.values()) {
    if (u.id === req.user.id) {
      user = u;
      break;
    }
  }

  if (!user) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }

  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin
  });
});

/**
 * POST /api/auth/change-password
 * Change user password (requires authentication)
 */
router.post('/change-password', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Current password and new password are required',
        code: 'MISSING_PASSWORDS'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'New password must be at least 8 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // Find user
    let user = null;
    for (const u of users.values()) {
      if (u.id === req.user.id) {
        user = u;
        break;
      }
    }

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Hash and update password
    user.password = await hashPassword(newPassword);
    user.passwordChangedAt = new Date().toISOString();

    console.log(`[AUTH] Password changed for: ${user.email}`);

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('[AUTH] Password change error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to change password',
      code: 'PASSWORD_CHANGE_FAILED'
    });
  }
});

// Cleanup revoked tokens periodically (every hour)
setInterval(() => {
  // In production, this would check token expiration
  // For now, just limit the set size
  if (revokedTokens.size > 10000) {
    const tokensArray = Array.from(revokedTokens);
    const toRemove = tokensArray.slice(0, tokensArray.length - 5000);
    toRemove.forEach(token => revokedTokens.delete(token));
    console.log(`[AUTH] Cleaned up ${toRemove.length} revoked tokens`);
  }
}, 60 * 60 * 1000);

export default router;
