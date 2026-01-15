/**
 * MONOLITH OS - Phase 7: API Security Hardening
 * CORS Configuration Middleware
 * Task 7.0.3.2 - Configure CORS policies
 */

// Approved origins whitelist
const approvedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://monolith-os.cognalith.com',
  'https://dashboard.monolith-os.com',
  'https://monolith-system.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

// Methods allowed for CORS
const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

// Headers allowed in requests
const allowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-CSRF-Token',
  'X-API-Key',
  'Accept',
  'Origin'
];

// Headers exposed to the client
const exposedHeaders = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'X-Request-ID',
  'X-Content-Type-Options',
  'X-Frame-Options'
];

/**
 * CORS Configuration Object
 */
export const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    // In production, you may want to restrict this
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in approved list
    if (approvedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  methods: allowedMethods,
  allowedHeaders: allowedHeaders,
  exposedHeaders: exposedHeaders,
  credentials: true, // Allow cookies and authorization headers
  maxAge: 86400, // Cache preflight requests for 24 hours
  optionsSuccessStatus: 204 // For legacy browser support
};

/**
 * Custom CORS middleware with logging
 */
export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  
  // Set CORS headers
  if (origin && approvedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
  res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
}

/**
 * Add origin to approved list dynamically (for admin use)
 */
export function addApprovedOrigin(origin) {
  if (!approvedOrigins.includes(origin)) {
    approvedOrigins.push(origin);
    console.log(`[CORS] Added approved origin: ${origin}`);
  }
}

/**
 * Get current approved origins (for admin monitoring)
 */
export function getApprovedOrigins() {
  return [...approvedOrigins];
}

export { approvedOrigins };
