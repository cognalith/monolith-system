/**
 * MONOLITH OS - Phase 7: API Security Hardening
 * Audit Logging Service
 * Tasks 7.1.1.5, 7.1.1.6, 7.1.1.7 - Audit logging, encryption, search
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Encryption key for audit logs (should be in secure vault in production)
const ENCRYPTION_KEY = process.env.AUDIT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// Audit log categories
export const AuditCategory = {
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  DATA_ACCESS: 'DATA_ACCESS',
  DATA_MODIFICATION: 'DATA_MODIFICATION',
  SECURITY_EVENT: 'SECURITY_EVENT',
  SYSTEM_EVENT: 'SYSTEM_EVENT',
  COMPLIANCE: 'COMPLIANCE',
  GDPR: 'GDPR'
};

// Audit log severity levels
export const AuditSeverity = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

/**
 * Encrypt sensitive data in audit logs
 */
function encryptData(data) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt audit log data
 */
function decryptData(encryptedData, iv, authTag) {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('[AUDIT] Decryption failed:', error.message);
    return null;
  }
}

/**
 * Create an audit log entry
 */
export async function createAuditLog({
  action,
  category,
  severity = AuditSeverity.INFO,
  userId = null,
  targetResource = null,
  resourceId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
  requestId = null,
  sensitiveData = null
}) {
  try {
    // Encrypt sensitive data if provided
    let encryptedSensitive = null;
    if (sensitiveData) {
      encryptedSensitive = encryptData(sensitiveData);
    }
    
    const auditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      category,
      severity,
      user_id: userId,
      target_resource: targetResource,
      resource_id: resourceId,
      details: JSON.stringify(details),
      ip_address: ipAddress,
      user_agent: userAgent,
      request_id: requestId,
      encrypted_data: encryptedSensitive ? JSON.stringify(encryptedSensitive) : null,
      created_at: new Date().toISOString()
    };
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([auditEntry])
      .select();
    
    if (error) {
      console.error('[AUDIT] Failed to create log:', error);
      // Fallback: log to console
      console.log('[AUDIT_FALLBACK]', JSON.stringify(auditEntry));
      return null;
    }
    
    return data[0];
  } catch (error) {
    console.error('[AUDIT] Error creating audit log:', error);
    return null;
  }
}

/**
 * Search audit logs
 */
export async function searchAuditLogs({
  startDate = null,
  endDate = null,
  category = null,
  severity = null,
  userId = null,
  action = null,
  ipAddress = null,
  searchTerm = null,
  limit = 100,
  offset = 0
}) {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (startDate) {
      query = query.gte('timestamp', startDate);
    }
    if (endDate) {
      query = query.lte('timestamp', endDate);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (action) {
      query = query.ilike('action', \`%\${action}%\`);
    }
    if (ipAddress) {
      query = query.eq('ip_address', ipAddress);
    }
    if (searchTerm) {
      query = query.or(\`action.ilike.%\${searchTerm}%,details.ilike.%\${searchTerm}%\`);
    }
    
    // Order and pagination
    query = query
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('[AUDIT] Search error:', error);
      throw error;
    }
    
    return {
      logs: data,
      total: count,
      limit,
      offset
    };
  } catch (error) {
    console.error('[AUDIT] Search failed:', error);
    throw error;
  }
}

/**
 * Get audit log by ID with decrypted sensitive data
 */
export async function getAuditLogById(id, decryptSensitive = false) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw error;
    }
    
    // Decrypt sensitive data if requested
    if (decryptSensitive && data.encrypted_data) {
      const encrypted = JSON.parse(data.encrypted_data);
      data.sensitive_data = decryptData(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.authTag
      );
    }
    
    return data;
  } catch (error) {
    console.error('[AUDIT] Get by ID failed:', error);
    throw error;
  }
}

/**
 * Express middleware for access event logging
 * Task 7.3.2.4 - Access event logging middleware
 */
export function accessEventLogging(req, res, next) {
  const startTime = Date.now();
  
  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    
    // Log the access event
    createAuditLog({
      action: \`\${req.method} \${req.path}\`,
      category: AuditCategory.DATA_ACCESS,
      severity: res.statusCode >= 400 ? AuditSeverity.WARNING : AuditSeverity.INFO,
      userId: req.user?.id || null,
      targetResource: req.path,
      resourceId: req.params?.id || null,
      details: {
        method: req.method,
        path: req.path,
        query: req.query,
        statusCode: res.statusCode,
        responseTime: \`\${responseTime}ms\`,
        contentLength: body?.length || 0
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId
    }).catch(err => console.error('[AUDIT] Access logging error:', err));
    
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Log security events
 */
export async function logSecurityEvent(eventType, details, req = null) {
  return createAuditLog({
    action: eventType,
    category: AuditCategory.SECURITY_EVENT,
    severity: AuditSeverity.WARNING,
    details,
    ipAddress: req?.ip || null,
    userAgent: req?.headers?.['user-agent'] || null,
    requestId: req?.requestId || null
  });
}

/**
 * Log GDPR-related events
 */
export async function logGdprEvent(eventType, userId, details, req = null) {
  return createAuditLog({
    action: eventType,
    category: AuditCategory.GDPR,
    severity: AuditSeverity.INFO,
    userId,
    details,
    ipAddress: req?.ip || null,
    userAgent: req?.headers?.['user-agent'] || null,
    requestId: req?.requestId || null
  });
}

export default {
  createAuditLog,
  searchAuditLogs,
  getAuditLogById,
  accessEventLogging,
  logSecurityEvent,
  logGdprEvent,
  AuditCategory,
  AuditSeverity
};
