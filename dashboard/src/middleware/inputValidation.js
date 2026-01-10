/**
 * MONOLITH OS - Phase 7: API Security Hardening
 * Input Validation and Sanitization Middleware
 * Task 7.0.3.4 - Add input validation/sanitization
 */

// Dangerous patterns to detect XSS and SQL injection
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /expression\s*\(/gi,
  /vbscript:/gi
];

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
  /(--|;|\/\*|\*\/|@@|@)/g,
  /('|")\s*(OR|AND)\s*('|")/gi,
  /\b(OR|AND)\b\s+\d+\s*=\s*\d+/gi
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\.\\/g,
  /%2e%2e%2f/gi,
  /%2e%2e\//gi,
  /\.\.%2f/gi,
  /%2e%2e%5c/gi
];

/**
 * Sanitize a string value
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Deep sanitize an object
 */
function sanitizeObject(obj, depth = 0) {
  if (depth > 10) return obj; // Prevent infinite recursion
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys too
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value, depth + 1);
    }
    return sanitized;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  return obj;
}

/**
 * Check for dangerous patterns
 */
function detectMaliciousInput(value, path = '') {
  const threats = [];
  
  if (typeof value !== 'string') return threats;
  
  // Check XSS patterns
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(value)) {
      threats.push({
        type: 'XSS',
        field: path,
        pattern: pattern.toString()
      });
    }
  }
  
  // Check SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      threats.push({
        type: 'SQL_INJECTION',
        field: path,
        pattern: pattern.toString()
      });
    }
  }
  
  // Check path traversal patterns
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(value)) {
      threats.push({
        type: 'PATH_TRAVERSAL',
        field: path,
        pattern: pattern.toString()
      });
    }
  }
  
  return threats;
}

/**
 * Recursively check object for malicious input
 */
function scanObject(obj, path = '', depth = 0) {
  if (depth > 10) return [];
  
  let threats = [];
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      threats = threats.concat(scanObject(item, \`\${path}[\${index}]\`, depth + 1));
    });
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? \`\${path}.\${key}\` : key;
      threats = threats.concat(scanObject(value, fieldPath, depth + 1));
    }
  } else if (typeof obj === 'string') {
    threats = threats.concat(detectMaliciousInput(obj, path));
  }
  
  return threats;
}

/**
 * Validate request body size
 */
function validateBodySize(req, maxSizeKB = 1024) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const maxBytes = maxSizeKB * 1024;
  
  if (contentLength > maxBytes) {
    return {
      valid: false,
      error: \`Request body too large. Maximum size: \${maxSizeKB}KB\`
    };
  }
  
  return { valid: true };
}

/**
 * Input Validation Middleware
 */
export function inputValidation(req, res, next) {
  const threats = [];
  
  // Validate body size
  const sizeCheck = validateBodySize(req);
  if (!sizeCheck.valid) {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: sizeCheck.error
    });
  }
  
  // Scan request body
  if (req.body) {
    threats.push(...scanObject(req.body, 'body'));
  }
  
  // Scan query parameters
  if (req.query) {
    threats.push(...scanObject(req.query, 'query'));
  }
  
  // Scan URL parameters
  if (req.params) {
    threats.push(...scanObject(req.params, 'params'));
  }
  
  // If threats detected, log and block
  if (threats.length > 0) {
    console.warn(\`[SECURITY] Malicious input detected from IP: \${req.ip}\`, {
      path: req.path,
      method: req.method,
      threats
    });
    
    return res.status(400).json({
      error: 'Invalid Input',
      message: 'Request contains potentially malicious content',
      code: 'MALICIOUS_INPUT'
    });
  }
  
  next();
}

/**
 * Sanitization middleware - sanitizes input without blocking
 */
export function inputSanitization(req, res, next) {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
}

/**
 * Combined validation and sanitization middleware
 */
export function validateAndSanitize(req, res, next) {
  // First validate
  const threats = [];
  
  if (req.body) {
    threats.push(...scanObject(req.body, 'body'));
  }
  if (req.query) {
    threats.push(...scanObject(req.query, 'query'));
  }
  
  // Log threats but don't block (just sanitize)
  if (threats.length > 0) {
    console.warn(\`[SECURITY] Suspicious input sanitized from IP: \${req.ip}\`, {
      path: req.path,
      threatCount: threats.length
    });
  }
  
  // Sanitize everything
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  
  next();
}

export { sanitizeString, sanitizeObject, detectMaliciousInput };
