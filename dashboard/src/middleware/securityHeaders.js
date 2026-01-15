/**
 * MONOLITH OS - Phase 7: API Security Hardening
 * Security Headers Middleware
 * Tasks 7.0.2.1 - Enforce HTTPS, 7.0.2.2 - Configure TLS 1.3
 */

/**
 * HTTPS Enforcement Middleware
 */
export function enforceHttps(req, res, next) {
  // Check if we're behind a proxy (common in production)
  const isSecure = req.secure || 
                   req.headers['x-forwarded-proto'] === 'https' ||
                   req.headers['x-forwarded-ssl'] === 'on';
  
  // Allow non-HTTPS in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isSecure && !isDevelopment) {
    // Redirect to HTTPS
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    console.log(`[HTTPS] Redirecting ${req.url} to HTTPS`);
    return res.redirect(301, httpsUrl);
  }
  
  // Set HSTS header (HTTP Strict Transport Security)
  // max-age: 1 year, include subdomains, preload for browser lists
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  
  next();
}

/**
 * Security Headers Middleware
 * Implements various HTTP security headers
 */
export function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS Protection (legacy, but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.monolith-os.com wss://realtime.monolith-os.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy', [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()'
  ].join(', '));
  
  // Cache Control for sensitive API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Remove server identification headers
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'MONOLITH-OS');
  
  // Add request ID for tracking
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', requestId);
  req.requestId = requestId;
  
  next();
}

/**
 * TLS Configuration for HTTPS server
 * Note: TLS 1.3 is enforced at the server level
 */
export const tlsOptions = {
  // Minimum TLS version
  minVersion: 'TLSv1.3',
  
  // Preferred ciphers (TLS 1.3 has its own cipher selection)
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256'
  ].join(':'),
  
  // Enable session resumption
  sessionTimeout: 86400,
  
  // ECDH curve for key exchange
  ecdhCurve: 'X25519:P-256:P-384',
  
  // Honor cipher order
  honorCipherOrder: true
};

/**
 * Certificate pinning information (for client-side implementation)
 * Task 7.0.2.3 - Certificate pinning logic
 */
export const certificatePins = {
  // SHA-256 hashes of public keys
  pins: [
    // Primary certificate pin
    'sha256/base64EncodedHash1==',
    // Backup certificate pin
    'sha256/base64EncodedHash2=='
  ],
  // Maximum age for pins (30 days)
  maxAge: 2592000,
  // Include subdomains
  includeSubdomains: true,
  // Report URI for pin violations
  reportUri: '/api/security/pin-violation'
};

/**
 * Public Key Pinning Header (deprecated but included for completeness)
 * Modern browsers use Certificate Transparency instead
 */
export function certificatePinning(req, res, next) {
  // Report-Only mode for testing
  res.setHeader('Public-Key-Pins-Report-Only', [
    `pin-sha256="${certificatePins.pins[0]}"`,
    `pin-sha256="${certificatePins.pins[1]}"`,
    `max-age=${certificatePins.maxAge}`,
    certificatePins.includeSubdomains ? 'includeSubDomains' : '',
    `report-uri="${certificatePins.reportUri}"`
  ].filter(Boolean).join('; '));
  
  next();
}

/**
 * Combined security middleware stack
 */
export function applySecurity(app) {
  app.use(enforceHttps);
  app.use(securityHeaders);
  // Certificate pinning is optional and should be used carefully
  // app.use(certificatePinning);
}

export default {
  enforceHttps,
  securityHeaders,
  tlsOptions,
  certificatePins,
  certificatePinning,
  applySecurity
};
