/**
 * MONOLITH OS - API Version Router
 * Routes requests to appropriate API versions
 *
 * Features:
 * - Routes /v1/* to v1 API routes
 * - Routes / to latest version (v1)
 * - /versions endpoint listing available versions
 * - Version deprecation warnings
 */

import express from 'express';
import v1Router, { VERSION as V1_VERSION, RELEASE_DATE as V1_RELEASE } from './v1/index.js';

const router = express.Router();

/**
 * API Version Registry
 * Tracks all available API versions and their status
 */
const API_VERSIONS = {
  v1: {
    version: V1_VERSION,
    releaseDate: V1_RELEASE,
    status: 'stable',
    deprecated: false,
    deprecationDate: null,
    sunsetDate: null,
    router: v1Router
  }
};

/**
 * Current/Latest API version
 */
const LATEST_VERSION = 'v1';

/**
 * GET /api/versions
 * List all available API versions
 */
router.get('/versions', (req, res) => {
  const versions = Object.entries(API_VERSIONS).map(([key, config]) => ({
    version: key,
    semver: config.version,
    releaseDate: config.releaseDate,
    status: config.status,
    deprecated: config.deprecated,
    deprecationDate: config.deprecationDate,
    sunsetDate: config.sunsetDate,
    current: key === LATEST_VERSION
  }));

  res.json({
    success: true,
    data: {
      latest: LATEST_VERSION,
      versions,
      documentation: '/api/docs'
    }
  });
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: API_VERSIONS[LATEST_VERSION].version,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

/**
 * Middleware to add API version headers
 */
function addVersionHeaders(version) {
  return (req, res, next) => {
    const config = API_VERSIONS[version];
    if (config) {
      res.setHeader('X-API-Version', version);
      res.setHeader('X-API-Semver', config.version);

      // Add deprecation warning if applicable
      if (config.deprecated) {
        res.setHeader('X-API-Deprecated', 'true');
        res.setHeader('Deprecation', config.deprecationDate);
        if (config.sunsetDate) {
          res.setHeader('Sunset', config.sunsetDate);
        }
        // Add warning header
        res.setHeader(
          'Warning',
          `299 - "API ${version} is deprecated. Please migrate to ${LATEST_VERSION}. Sunset date: ${config.sunsetDate || 'TBD'}"`
        );
      }
    }
    next();
  };
}

/**
 * Mount v1 API routes
 */
router.use('/v1', addVersionHeaders('v1'), API_VERSIONS.v1.router);

/**
 * GET /api
 * Root endpoint - returns API information
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'MONOLITH OS API',
      description: 'RESTful API for MONOLITH OS system management',
      currentVersion: LATEST_VERSION,
      version: API_VERSIONS[LATEST_VERSION].version,
      documentation: '/api/docs',
      endpoints: {
        versions: '/api/versions',
        health: '/api/health',
        v1: '/api/v1'
      },
      links: {
        tasks: '/api/v1/tasks',
        decisions: '/api/v1/decisions',
        workflows: '/api/v1/workflows',
        agents: '/api/v1/agents'
      }
    }
  });
});

/**
 * Redirect unversioned endpoints to latest version
 * This allows clients to use /api/tasks instead of /api/v1/tasks
 */
router.use('/tasks', addVersionHeaders(LATEST_VERSION), (req, res, next) => {
  req.url = req.url || '/';
  API_VERSIONS[LATEST_VERSION].router(req, res, next);
});

router.use('/decisions', addVersionHeaders(LATEST_VERSION), (req, res, next) => {
  req.url = `/decisions${req.url}`;
  API_VERSIONS[LATEST_VERSION].router(req, res, next);
});

router.use('/workflows', addVersionHeaders(LATEST_VERSION), (req, res, next) => {
  req.url = `/workflows${req.url}`;
  API_VERSIONS[LATEST_VERSION].router(req, res, next);
});

router.use('/agents', addVersionHeaders(LATEST_VERSION), (req, res, next) => {
  req.url = `/agents${req.url}`;
  API_VERSIONS[LATEST_VERSION].router(req, res, next);
});

/**
 * API documentation endpoint placeholder
 * In production, this would serve OpenAPI/Swagger UI
 */
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'API documentation',
      openapi: '/api/docs/openapi.yaml',
      swagger: '/api/docs/swagger',
      redoc: '/api/docs/redoc',
      postman: '/api/docs/postman.json'
    }
  });
});

/**
 * Serve OpenAPI spec
 */
router.get('/docs/openapi.yaml', (req, res) => {
  res.setHeader('Content-Type', 'text/yaml');
  res.sendFile('openapi.yaml', { root: __dirname });
});

/**
 * Global error handler for versioned API
 */
router.use((err, req, res, next) => {
  console.error('[API-VERSION-ROUTER] Error:', err.message);

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
});

/**
 * Export utilities for version management
 */
export const getLatestVersion = () => LATEST_VERSION;
export const getVersionInfo = (version) => API_VERSIONS[version];
export const isVersionDeprecated = (version) => API_VERSIONS[version]?.deprecated || false;

export default router;
