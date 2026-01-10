/**
 * MONOLITH OS - Phase 7: API Key Rotation System
 * Task 7.0.3.5 - Implement API key rotation system
 */

import crypto from 'crypto';
import { createAuditLog, AuditCategory, AuditSeverity } from './auditLogger.js';

// API Key store (use database in production)
const apiKeyStore = new Map();
const KEY_LENGTH = 32;
const KEY_PREFIX = 'mk_'; // monolith key

// Key configuration
const keyConfig = {
  rotationPeriodDays: 90,
  warningPeriodDays: 14,
  maxKeysPerClient: 3,
  gracePeriodHours: 24
};

/**
 * Generate a secure API key
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(KEY_LENGTH);
  return KEY_PREFIX + randomBytes.toString('base64url');
}

/**
 * Hash API key for storage
 */
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Create a new API key for a client
 */
export async function createApiKey(clientId, keyName, permissions = []) {
  const existingKeys = Array.from(apiKeyStore.values())
    .filter(k => k.clientId === clientId && k.status === 'ACTIVE');
  
  if (existingKeys.length >= keyConfig.maxKeysPerClient) {
    throw new Error(\`Maximum keys (\${keyConfig.maxKeysPerClient}) reached for client\`);
  }
  
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyId = \`key_\${Date.now()}_\${crypto.randomBytes(4).toString('hex')}\`;
  
  const keyData = {
    keyId,
    clientId,
    keyName,
    keyHash,
    keyPrefix: rawKey.substring(0, 10), // Store prefix for identification
    permissions,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + keyConfig.rotationPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
    lastUsedAt: null,
    usageCount: 0
  };
  
  apiKeyStore.set(keyId, keyData);
  
  // Log key creation
  await createAuditLog({
    action: 'API_KEY_CREATED',
    category: AuditCategory.SECURITY_EVENT,
    severity: AuditSeverity.INFO,
    userId: clientId,
    details: {
      keyId,
      keyName,
      keyPrefix: keyData.keyPrefix,
      expiresAt: keyData.expiresAt
    }
  });
  
  // Return the raw key only once (never stored)
  return {
    keyId,
    apiKey: rawKey,
    expiresAt: keyData.expiresAt,
    warning: 'Store this key securely. It will not be shown again.'
  };
}

/**
 * Validate an API key
 */
export async function validateApiKey(rawKey) {
  const keyHash = hashApiKey(rawKey);
  
  for (const [keyId, keyData] of apiKeyStore.entries()) {
    if (keyData.keyHash === keyHash) {
      // Check if key is active
      if (keyData.status !== 'ACTIVE') {
        return { valid: false, reason: 'Key is not active', keyId };
      }
      
      // Check expiration
      if (new Date() > new Date(keyData.expiresAt)) {
        // Check grace period
        const gracePeriodEnd = new Date(keyData.expiresAt);
        gracePeriodEnd.setHours(gracePeriodEnd.getHours() + keyConfig.gracePeriodHours);
        
        if (new Date() > gracePeriodEnd) {
          keyData.status = 'EXPIRED';
          apiKeyStore.set(keyId, keyData);
          return { valid: false, reason: 'Key has expired', keyId };
        }
        
        return { 
          valid: true, 
          keyId, 
          clientId: keyData.clientId,
          permissions: keyData.permissions,
          warning: 'Key is in grace period. Please rotate immediately.'
        };
      }
      
      // Update usage stats
      keyData.lastUsedAt = new Date().toISOString();
      keyData.usageCount++;
      apiKeyStore.set(keyId, keyData);
      
      return {
        valid: true,
        keyId,
        clientId: keyData.clientId,
        permissions: keyData.permissions,
        expiresAt: keyData.expiresAt
      };
    }
  }
  
  return { valid: false, reason: 'Key not found' };
}

/**
 * Rotate an API key
 */
export async function rotateApiKey(keyId) {
  const oldKeyData = apiKeyStore.get(keyId);
  
  if (!oldKeyData) {
    throw new Error('Key not found');
  }
  
  // Generate new key
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const newKeyId = \`key_\${Date.now()}_\${crypto.randomBytes(4).toString('hex')}\`;
  
  const newKeyData = {
    ...oldKeyData,
    keyId: newKeyId,
    keyHash,
    keyPrefix: rawKey.substring(0, 10),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + keyConfig.rotationPeriodDays * 24 * 60 * 60 * 1000).toISOString(),
    lastUsedAt: null,
    usageCount: 0,
    previousKeyId: keyId
  };
  
  // Mark old key as rotated (with grace period)
  oldKeyData.status = 'ROTATED';
  oldKeyData.rotatedAt = new Date().toISOString();
  oldKeyData.replacedBy = newKeyId;
  apiKeyStore.set(keyId, oldKeyData);
  
  // Store new key
  apiKeyStore.set(newKeyId, newKeyData);
  
  // Log rotation
  await createAuditLog({
    action: 'API_KEY_ROTATED',
    category: AuditCategory.SECURITY_EVENT,
    severity: AuditSeverity.INFO,
    userId: oldKeyData.clientId,
    details: {
      oldKeyId: keyId,
      newKeyId,
      keyName: oldKeyData.keyName
    }
  });
  
  return {
    newKeyId,
    apiKey: rawKey,
    expiresAt: newKeyData.expiresAt,
    oldKeyId: keyId,
    gracePeriodEnds: new Date(Date.now() + keyConfig.gracePeriodHours * 60 * 60 * 1000).toISOString()
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId, reason = 'Manual revocation') {
  const keyData = apiKeyStore.get(keyId);
  
  if (!keyData) {
    throw new Error('Key not found');
  }
  
  keyData.status = 'REVOKED';
  keyData.revokedAt = new Date().toISOString();
  keyData.revocationReason = reason;
  apiKeyStore.set(keyId, keyData);
  
  // Log revocation
  await createAuditLog({
    action: 'API_KEY_REVOKED',
    category: AuditCategory.SECURITY_EVENT,
    severity: AuditSeverity.WARNING,
    userId: keyData.clientId,
    details: {
      keyId,
      keyName: keyData.keyName,
      reason
    }
  });
  
  return { success: true, keyId, revokedAt: keyData.revokedAt };
}

/**
 * List API keys for a client
 */
export function listApiKeys(clientId) {
  const keys = Array.from(apiKeyStore.values())
    .filter(k => k.clientId === clientId)
    .map(k => ({
      keyId: k.keyId,
      keyName: k.keyName,
      keyPrefix: k.keyPrefix,
      status: k.status,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      usageCount: k.usageCount,
      needsRotation: isKeyNearExpiration(k)
    }));
  
  return keys;
}

/**
 * Check if key is near expiration
 */
function isKeyNearExpiration(keyData) {
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + keyConfig.warningPeriodDays);
  return new Date(keyData.expiresAt) < warningDate;
}

/**
 * Get keys needing rotation
 */
export function getKeysNeedingRotation() {
  return Array.from(apiKeyStore.values())
    .filter(k => k.status === 'ACTIVE' && isKeyNearExpiration(k))
    .map(k => ({
      keyId: k.keyId,
      clientId: k.clientId,
      keyName: k.keyName,
      expiresAt: k.expiresAt,
      daysUntilExpiration: Math.ceil((new Date(k.expiresAt) - new Date()) / (24 * 60 * 60 * 1000))
    }));
}

/**
 * API Key Authentication Middleware
 */
export function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication Required',
      message: 'API key is required. Provide it via X-API-Key header.'
    });
  }
  
  validateApiKey(apiKey).then(result => {
    if (!result.valid) {
      return res.status(401).json({
        error: 'Invalid API Key',
        message: result.reason
      });
    }
    
    // Attach client info to request
    req.apiKeyInfo = result;
    
    // Add warning header if key is expiring
    if (result.warning) {
      res.setHeader('X-API-Key-Warning', result.warning);
    }
    
    next();
  }).catch(error => {
    console.error('[API_KEY] Validation error:', error);
    res.status(500).json({
      error: 'Authentication Error',
      message: 'Failed to validate API key'
    });
  });
}

export default {
  createApiKey,
  validateApiKey,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
  getKeysNeedingRotation,
  apiKeyAuth
};
