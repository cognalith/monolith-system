/**
 * MONOLITH OS - Logging Service
 * Centralized logging with winston for production infrastructure
 */

import winston from 'winston';
import path from 'path';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

/**
 * Custom format for console output in development
 */
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

/**
 * Logging Service for production infrastructure
 * Provides structured logging with specialized methods for agent operations
 */
class LoggingService {
  constructor() {
    this.logger = null;
    this.initialized = false;
  }

  /**
   * Initialize the logging service
   * @param {Object} config - Configuration options
   * @param {string} config.level - Log level (default: LOG_LEVEL env or 'info')
   * @param {string} config.logsDir - Directory for log files (default: './logs')
   * @param {boolean} config.enableConsole - Enable console output (default: true)
   * @param {boolean} config.enableFiles - Enable file output (default: production only)
   */
  initialize(config = {}) {
    if (this.initialized) {
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const level = config.level || process.env.LOG_LEVEL || 'info';
    const logsDir = config.logsDir || process.env.LOGS_DIR || './logs';
    const enableConsole = config.enableConsole !== false;
    const enableFiles = config.enableFiles !== undefined ? config.enableFiles : isProduction;

    const transports = [];

    // Console transport (always enabled in dev, optional in prod)
    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: combine(
            colorize({ all: true }),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            errors({ stack: true }),
            isProduction ? json() : devFormat
          ),
        })
      );
    }

    // File transports (production)
    if (enableFiles) {
      // Error log - errors only
      transports.push(
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
          format: combine(timestamp(), errors({ stack: true }), json()),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true,
        })
      );

      // Combined log - all levels
      transports.push(
        new winston.transports.File({
          filename: path.join(logsDir, 'combined.log'),
          format: combine(timestamp(), errors({ stack: true }), json()),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 10,
          tailable: true,
        })
      );
    }

    this.logger = winston.createLogger({
      level,
      defaultMeta: { service: 'monolith-os' },
      transports,
    });

    this.initialized = true;
    this.info('LoggingService initialized', { level, isProduction, enableFiles });
  }

  /**
   * Ensure logger is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized) {
      this.initialize();
    }
  }

  // ============================================
  // Standard Logging Methods
  // ============================================

  /**
   * Log info level message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this._ensureInitialized();
    this.logger.info(message, meta);
  }

  /**
   * Log warning level message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this._ensureInitialized();
    this.logger.warn(message, meta);
  }

  /**
   * Log error level message
   * @param {string} message - Log message
   * @param {Object|Error} meta - Additional metadata or Error object
   */
  error(message, meta = {}) {
    this._ensureInitialized();

    if (meta instanceof Error) {
      this.logger.error(message, {
        error: meta.message,
        stack: meta.stack,
        name: meta.name,
      });
    } else {
      this.logger.error(message, meta);
    }
  }

  /**
   * Log debug level message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this._ensureInitialized();
    this.logger.debug(message, meta);
  }

  // ============================================
  // Specialized Agent Logging Methods
  // ============================================

  /**
   * Log agent decision
   * @param {string} roleId - Role identifier (e.g., 'cos', 'cfo')
   * @param {Object} task - Task being processed
   * @param {Object} decision - Decision made by the agent
   * @param {Object} meta - Additional metadata
   */
  logAgentDecision(roleId, task, decision, meta = {}) {
    this._ensureInitialized();

    this.logger.info('Agent decision', {
      type: 'agent_decision',
      roleId,
      taskId: task?.id || 'unknown',
      taskContent: task?.content?.substring(0, 100) || 'N/A',
      taskPriority: task?.priority || 'N/A',
      decision: {
        action: decision?.action || 'unknown',
        confidence: decision?.confidence || null,
        rationale: decision?.rationale?.substring(0, 200) || null,
      },
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  /**
   * Log escalation event
   * @param {string} fromRole - Role that initiated escalation
   * @param {Object} task - Task being escalated
   * @param {string} reason - Reason for escalation
   * @param {Object} meta - Additional metadata
   */
  logEscalation(fromRole, task, reason, meta = {}) {
    this._ensureInitialized();

    this.logger.warn('Task escalation', {
      type: 'escalation',
      fromRole,
      taskId: task?.id || 'unknown',
      taskContent: task?.content?.substring(0, 100) || 'N/A',
      taskPriority: task?.priority || 'N/A',
      reason,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  /**
   * Log API request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration in ms
   * @param {Object} meta - Additional metadata
   */
  logApiRequest(req, res, duration, meta = {}) {
    this._ensureInitialized();

    const logData = {
      type: 'api_request',
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent') || 'unknown',
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      timestamp: new Date().toISOString(),
      ...meta,
    };

    // Log level based on status code
    if (res.statusCode >= 500) {
      this.logger.error('API request error', logData);
    } else if (res.statusCode >= 400) {
      this.logger.warn('API request client error', logData);
    } else {
      this.logger.info('API request', logData);
    }
  }

  /**
   * Log LLM API call
   * @param {string} provider - LLM provider (e.g., 'anthropic', 'openai')
   * @param {string} model - Model used
   * @param {Object} tokens - Token usage {input, output, total}
   * @param {number} latency - Request latency in ms
   * @param {number} cost - Estimated cost in USD
   * @param {Object} meta - Additional metadata
   */
  logLLMCall(provider, model, tokens, latency, cost, meta = {}) {
    this._ensureInitialized();

    this.logger.info('LLM API call', {
      type: 'llm_call',
      provider,
      model,
      tokens: {
        input: tokens?.input || 0,
        output: tokens?.output || 0,
        total: tokens?.total || (tokens?.input || 0) + (tokens?.output || 0),
      },
      latency: `${latency}ms`,
      cost: cost ? `$${cost.toFixed(6)}` : 'N/A',
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  /**
   * Log workflow event
   * @param {string} workflowId - Workflow identifier
   * @param {string} event - Event type (started, step_completed, completed, failed)
   * @param {Object} meta - Additional metadata
   */
  logWorkflowEvent(workflowId, event, meta = {}) {
    this._ensureInitialized();

    const level = event === 'failed' ? 'error' : 'info';
    this.logger[level](`Workflow ${event}`, {
      type: 'workflow_event',
      workflowId,
      event,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  /**
   * Log security event
   * @param {string} event - Security event type
   * @param {Object} meta - Event metadata
   */
  logSecurityEvent(event, meta = {}) {
    this._ensureInitialized();

    this.logger.warn('Security event', {
      type: 'security_event',
      event,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  /**
   * Log performance metric
   * @param {string} metric - Metric name
   * @param {number} value - Metric value
   * @param {string} unit - Unit of measurement
   * @param {Object} meta - Additional metadata
   */
  logMetric(metric, value, unit, meta = {}) {
    this._ensureInitialized();

    this.logger.info('Performance metric', {
      type: 'metric',
      metric,
      value,
      unit,
      timestamp: new Date().toISOString(),
      ...meta,
    });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Create a child logger with additional default metadata
   * @param {Object} meta - Default metadata for child logger
   * @returns {Object} Child logger instance
   */
  child(meta) {
    this._ensureInitialized();
    return this.logger.child(meta);
  }

  /**
   * Create Express middleware for request logging
   * @returns {Function} Express middleware
   */
  requestMiddleware() {
    return (req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logApiRequest(req, res, duration);
      });

      next();
    };
  }

  /**
   * Get current log level
   * @returns {string}
   */
  getLevel() {
    this._ensureInitialized();
    return this.logger.level;
  }

  /**
   * Set log level dynamically
   * @param {string} level - New log level
   */
  setLevel(level) {
    this._ensureInitialized();
    this.logger.level = level;
    this.info(`Log level changed to ${level}`);
  }
}

// Export singleton instance
const loggingService = new LoggingService();

export { LoggingService };
export default loggingService;
