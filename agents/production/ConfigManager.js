/**
 * MONOLITH OS - Configuration Manager
 * Environment-based configuration with validation
 *
 * Features:
 * - Environment variable loading
 * - Configuration validation
 * - Defaults with overrides
 * - Secret management
 */

class ConfigManager {
  constructor() {
    this.config = {};
    this.secrets = new Set();
    this.validators = new Map();
    this.loaded = false;
  }

  /**
   * Load configuration from environment
   */
  load() {
    if (this.loaded) return this.config;

    // API Keys (secrets)
    this.config.api = {
      anthropicApiKey: this.getSecret('ANTHROPIC_API_KEY'),
      openaiApiKey: this.getSecret('OPENAI_API_KEY'),
      googleApiKey: this.getSecret('GOOGLE_API_KEY'),
    };

    // Email configuration
    this.config.email = {
      provider: this.get('EMAIL_PROVIDER', 'console'),
      sendgridApiKey: this.getSecret('SENDGRID_API_KEY'),
      resendApiKey: this.getSecret('RESEND_API_KEY'),
      fromEmail: this.get('FROM_EMAIL', 'notifications@monolith-os.local'),
      ceoEmail: this.get('CEO_EMAIL'),
    };

    // LLM Configuration
    this.config.llm = {
      defaultModel: this.get('DEFAULT_LLM_MODEL', 'claude-sonnet-4'),
      maxTokens: this.getInt('MAX_TOKENS', 4096),
      temperature: this.getFloat('LLM_TEMPERATURE', 0.7),
      timeout: this.getInt('LLM_TIMEOUT_MS', 120000),
    };

    // Cost configuration
    this.config.cost = {
      dailyBudget: this.getFloat('DAILY_BUDGET', 100),
      monthlyBudget: this.getFloat('MONTHLY_BUDGET', 2000),
      alertThreshold: this.getFloat('COST_ALERT_THRESHOLD', 0.8),
    };

    // Rate limiting
    this.config.rateLimiting = {
      enabled: this.getBool('RATE_LIMITING_ENABLED', true),
      tokensPerSecond: this.getInt('RATE_LIMIT_TPS', 10),
      bucketSize: this.getInt('RATE_LIMIT_BUCKET', 20),
      maxQueueSize: this.getInt('RATE_LIMIT_QUEUE', 100),
    };

    // Retry configuration
    this.config.retry = {
      maxRetries: this.getInt('MAX_RETRIES', 3),
      baseDelay: this.getInt('RETRY_BASE_DELAY_MS', 1000),
      maxDelay: this.getInt('RETRY_MAX_DELAY_MS', 30000),
      circuitBreakerEnabled: this.getBool('CIRCUIT_BREAKER_ENABLED', true),
      circuitBreakerThreshold: this.getInt('CIRCUIT_BREAKER_THRESHOLD', 5),
    };

    // Logging configuration
    this.config.logging = {
      level: this.get('LOG_LEVEL', 'info'),
      format: this.get('LOG_FORMAT', 'json'),
      destination: this.get('LOG_DESTINATION', 'console'),
      decisionLogPath: this.get('DECISION_LOG_PATH', './logs/decisions'),
    };

    // Feature flags
    this.config.features = {
      enableLearning: this.getBool('ENABLE_LEARNING', true),
      enableCaching: this.getBool('ENABLE_CACHING', true),
      enableCostOptimization: this.getBool('ENABLE_COST_OPTIMIZATION', true),
      enableSmartRouting: this.getBool('ENABLE_SMART_ROUTING', true),
      enableEmailNotifications: this.getBool('ENABLE_EMAIL_NOTIFICATIONS', true),
    };

    // Server configuration
    this.config.server = {
      port: this.getInt('PORT', 3000),
      host: this.get('HOST', '0.0.0.0'),
      corsOrigins: this.getArray('CORS_ORIGINS', ['http://localhost:3000']),
    };

    // Environment
    this.config.env = {
      nodeEnv: this.get('NODE_ENV', 'development'),
      isProduction: this.get('NODE_ENV') === 'production',
      isDevelopment: this.get('NODE_ENV') !== 'production',
    };

    // Document management
    this.config.documents = {
      rootPath: this.get('DOCUMENT_ROOT', '/mnt/h/My Drive/MONOLITH_OS'),
      enabled: this.getBool('ENABLE_DOCUMENT_MANAGEMENT', true),
      autoTriage: this.getBool('AUTO_TRIAGE_INBOX', false),
      indexUpdateInterval: this.getInt('DOCUMENT_INDEX_INTERVAL_MS', 3600000), // 1 hour
    };

    this.loaded = true;
    return this.config;
  }

  /**
   * Get environment variable with default
   */
  get(key, defaultValue = undefined) {
    return process.env[key] || defaultValue;
  }

  /**
   * Get secret (masked in logs)
   */
  getSecret(key) {
    this.secrets.add(key);
    return process.env[key] || undefined;
  }

  /**
   * Get integer value
   */
  getInt(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get float value
   */
  getFloat(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get boolean value
   */
  getBool(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Get array from comma-separated string
   */
  getArray(key, defaultValue) {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Check required secrets for production
    if (this.config.env.isProduction) {
      if (!this.config.api.anthropicApiKey) {
        errors.push('ANTHROPIC_API_KEY is required in production');
      }

      if (this.config.features.enableEmailNotifications) {
        if (!this.config.email.sendgridApiKey && !this.config.email.resendApiKey) {
          warnings.push('No email API key configured - notifications will be logged only');
        }
        if (!this.config.email.ceoEmail) {
          warnings.push('CEO_EMAIL not configured - escalations will be logged only');
        }
      }
    }

    // Run custom validators
    for (const [key, validator] of this.validators) {
      const value = this.getConfigValue(key);
      const result = validator(value);
      if (result !== true) {
        errors.push(`${key}: ${result}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Get nested config value
   */
  getConfigValue(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.config);
  }

  /**
   * Add custom validator
   */
  addValidator(configPath, validator) {
    this.validators.set(configPath, validator);
  }

  /**
   * Get safe config (secrets masked)
   */
  getSafeConfig() {
    const safe = JSON.parse(JSON.stringify(this.config));

    // Mask secrets
    for (const key of this.secrets) {
      const value = process.env[key];
      if (value) {
        // Find and mask the value in config
        this.maskSecretInObject(safe, value);
      }
    }

    return safe;
  }

  /**
   * Mask secret value in object
   */
  maskSecretInObject(obj, secret) {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string' && obj[key] === secret) {
        obj[key] = '***REDACTED***';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.maskSecretInObject(obj[key], secret);
      }
    }
  }

  /**
   * Print configuration summary
   */
  printSummary() {
    const validation = this.validate();
    const safe = this.getSafeConfig();

    console.log('\n=== Configuration Summary ===');
    console.log(`Environment: ${this.config.env.nodeEnv}`);
    console.log(`Production: ${this.config.env.isProduction}`);

    console.log('\nAPI Keys:');
    console.log(`  Anthropic: ${this.config.api.anthropicApiKey ? '✓ Set' : '✗ Not set'}`);
    console.log(`  OpenAI: ${this.config.api.openaiApiKey ? '✓ Set' : '✗ Not set'}`);

    console.log('\nFeatures:');
    for (const [key, value] of Object.entries(this.config.features)) {
      console.log(`  ${key}: ${value ? '✓ Enabled' : '✗ Disabled'}`);
    }

    console.log('\nBudget:');
    console.log(`  Daily: $${this.config.cost.dailyBudget}`);
    console.log(`  Monthly: $${this.config.cost.monthlyBudget}`);

    if (validation.errors.length > 0) {
      console.log('\n❌ Validation Errors:');
      for (const error of validation.errors) {
        console.log(`  - ${error}`);
      }
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      for (const warning of validation.warnings) {
        console.log(`  - ${warning}`);
      }
    }

    console.log('');
    return validation;
  }
}

// Singleton instance
const configManager = new ConfigManager();

export default configManager;
export { ConfigManager };
