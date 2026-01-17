/**
 * MONOLITH OS - Phase 3: Authentication & Security
 * Secrets Validation Module
 * Task 3.3.2 - Validate required secrets on startup
 */

/**
 * Configuration for required and optional secrets
 */
const secretsConfig = {
  // Critical secrets - application will not start without these
  critical: [
    {
      name: 'JWT_SECRET',
      description: 'JWT signing secret for authentication',
      minLength: 32,
      validate: (value) => {
        if (value.length < 32) {
          return 'JWT_SECRET must be at least 32 characters for security';
        }
        if (value === 'CHANGE_THIS_SECRET_IN_PRODUCTION' ||
            value === 'CHANGE_THIS_TO_A_SECURE_SECRET_AT_LEAST_32_CHARS') {
          return 'JWT_SECRET is using a placeholder value. Please set a secure secret';
        }
        // Check for weak patterns
        if (/^(.)\1+$/.test(value)) {
          return 'JWT_SECRET appears to be a weak repeating pattern';
        }
        return null; // Valid
      }
    },
    {
      name: 'NODE_ENV',
      description: 'Environment identifier',
      validate: (value) => {
        const validEnvs = ['development', 'staging', 'production', 'test'];
        if (!validEnvs.includes(value)) {
          return `NODE_ENV must be one of: ${validEnvs.join(', ')}`;
        }
        return null;
      }
    }
  ],

  // Required secrets - needed for core functionality
  required: [
    {
      name: 'SUPABASE_URL',
      description: 'Supabase project URL',
      validate: (value) => {
        if (!value.startsWith('https://')) {
          return 'SUPABASE_URL must be a valid HTTPS URL';
        }
        return null;
      }
    },
    {
      name: 'SUPABASE_ANON_KEY',
      description: 'Supabase anonymous/public key',
      minLength: 100, // Supabase keys are typically long
      validate: (value) => {
        if (value.length < 50) {
          return 'SUPABASE_ANON_KEY appears to be invalid (too short)';
        }
        return null;
      }
    }
  ],

  // Important secrets - application may work but with reduced functionality
  important: [
    {
      name: 'API_KEY',
      description: 'API key for service-to-service auth',
      minLength: 32,
      validate: (value) => {
        if (value.length < 32) {
          return 'API_KEY should be at least 32 characters';
        }
        if (value === 'CHANGE_THIS_TO_A_SECURE_API_KEY') {
          return 'API_KEY is using a placeholder value';
        }
        return null;
      }
    },
    {
      name: 'ANTHROPIC_API_KEY',
      description: 'Anthropic API key for AI agents',
      validate: (value) => {
        if (!value.startsWith('sk-ant-')) {
          return 'ANTHROPIC_API_KEY should start with sk-ant-';
        }
        return null;
      }
    }
  ],

  // Optional secrets - application works fine without these
  optional: [
    {
      name: 'SLACK_WEBHOOK_URL',
      description: 'Slack webhook for notifications',
      validate: (value) => {
        if (!value.startsWith('https://hooks.slack.com/')) {
          return 'SLACK_WEBHOOK_URL should be a valid Slack webhook URL';
        }
        return null;
      }
    },
    {
      name: 'EMAIL_API_KEY',
      description: 'Email service API key'
    },
    {
      name: 'NOTEBOOKLM_API_KEY',
      description: 'NotebookLM integration API key'
    },
    {
      name: 'REDIS_URL',
      description: 'Redis URL for distributed rate limiting'
    },
    {
      name: 'REFRESH_EXPIRY',
      description: 'JWT refresh token expiry duration'
    },
    {
      name: 'JWT_EXPIRY',
      description: 'JWT access token expiry duration'
    },
    {
      name: 'BCRYPT_ROUNDS',
      description: 'Bcrypt hashing rounds',
      validate: (value) => {
        const rounds = parseInt(value, 10);
        if (isNaN(rounds) || rounds < 10 || rounds > 16) {
          return 'BCRYPT_ROUNDS should be between 10 and 16';
        }
        return null;
      }
    }
  ]
};

/**
 * Validation result object
 */
class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.valid = true;
  }

  addError(message) {
    this.errors.push(message);
    this.valid = false;
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  addInfo(message) {
    this.info.push(message);
  }

  toSummary() {
    return {
      valid: this.valid,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info
    };
  }
}

/**
 * Validate a single secret
 * @param {Object} secretDef - Secret definition
 * @param {string|undefined} value - Environment variable value
 * @returns {Object} Validation result for this secret
 */
function validateSecret(secretDef, value) {
  const result = {
    name: secretDef.name,
    present: !!value,
    valid: false,
    error: null
  };

  if (!value) {
    result.error = `${secretDef.name} is not set`;
    return result;
  }

  // Check minimum length
  if (secretDef.minLength && value.length < secretDef.minLength) {
    result.error = `${secretDef.name} must be at least ${secretDef.minLength} characters`;
    return result;
  }

  // Run custom validation if provided
  if (secretDef.validate) {
    const validationError = secretDef.validate(value);
    if (validationError) {
      result.error = validationError;
      return result;
    }
  }

  result.valid = true;
  return result;
}

/**
 * Validate all secrets
 * @param {Object} options - Validation options
 * @param {boolean} options.throwOnCritical - Throw error if critical secrets missing (default: true)
 * @param {boolean} options.silent - Don't log to console (default: false)
 * @returns {Object} Validation result
 */
export function validateSecrets(options = {}) {
  const { throwOnCritical = true, silent = false } = options;
  const result = new ValidationResult();

  const log = silent ? () => {} : console.log;
  const warn = silent ? () => {} : console.warn;
  const error = silent ? () => {} : console.error;

  log('\n[SECRETS] Validating environment secrets...\n');

  // Validate critical secrets
  log('[SECRETS] Checking critical secrets...');
  for (const secret of secretsConfig.critical) {
    const value = process.env[secret.name];
    const validation = validateSecret(secret, value);

    if (!validation.valid) {
      result.addError(`CRITICAL: ${validation.error}`);
      error(`  [X] ${secret.name}: ${validation.error}`);
    } else {
      log(`  [OK] ${secret.name}`);
    }
  }

  // Validate required secrets
  log('\n[SECRETS] Checking required secrets...');
  for (const secret of secretsConfig.required) {
    const value = process.env[secret.name];
    const validation = validateSecret(secret, value);

    if (!validation.valid) {
      result.addError(`REQUIRED: ${validation.error}`);
      error(`  [X] ${secret.name}: ${validation.error}`);
    } else {
      log(`  [OK] ${secret.name}`);
    }
  }

  // Validate important secrets
  log('\n[SECRETS] Checking important secrets...');
  for (const secret of secretsConfig.important) {
    const value = process.env[secret.name];
    const validation = validateSecret(secret, value);

    if (!validation.present) {
      result.addWarning(`IMPORTANT: ${secret.name} is not set - ${secret.description}`);
      warn(`  [!] ${secret.name}: Not configured (${secret.description})`);
    } else if (!validation.valid) {
      result.addWarning(`IMPORTANT: ${validation.error}`);
      warn(`  [!] ${secret.name}: ${validation.error}`);
    } else {
      log(`  [OK] ${secret.name}`);
    }
  }

  // Validate optional secrets
  log('\n[SECRETS] Checking optional secrets...');
  for (const secret of secretsConfig.optional) {
    const value = process.env[secret.name];

    if (!value) {
      result.addInfo(`OPTIONAL: ${secret.name} not configured - ${secret.description}`);
      log(`  [-] ${secret.name}: Not configured`);
    } else {
      const validation = validateSecret(secret, value);
      if (!validation.valid) {
        result.addWarning(`OPTIONAL: ${validation.error}`);
        warn(`  [!] ${secret.name}: ${validation.error}`);
      } else {
        log(`  [OK] ${secret.name}`);
      }
    }
  }

  // Summary
  log('\n[SECRETS] Validation Summary:');
  log(`  Errors: ${result.errors.length}`);
  log(`  Warnings: ${result.warnings.length}`);
  log(`  Valid: ${result.valid ? 'Yes' : 'No'}\n`);

  // Throw on critical errors if configured
  if (throwOnCritical && !result.valid) {
    const criticalErrors = result.errors.filter(e => e.startsWith('CRITICAL:'));
    if (criticalErrors.length > 0) {
      throw new Error(
        `Critical secrets validation failed:\n${criticalErrors.join('\n')}\n` +
        'Please configure the required secrets before starting the application.'
      );
    }
  }

  return result.toSummary();
}

/**
 * Check if running in production without proper secrets
 * @returns {boolean} True if secrets are properly configured for production
 */
export function isProductionReady() {
  if (process.env.NODE_ENV !== 'production') {
    return true; // Not production, so always "ready"
  }

  try {
    const result = validateSecrets({ throwOnCritical: false, silent: true });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Get a masked version of a secret for logging
 * @param {string} secretName - Environment variable name
 * @returns {string} Masked secret value
 */
export function getMaskedSecret(secretName) {
  const value = process.env[secretName];
  if (!value) return '[NOT SET]';
  if (value.length <= 8) return '****';
  return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
}

/**
 * Print secrets status (for debugging, with masking)
 */
export function printSecretsStatus() {
  console.log('\n[SECRETS] Current Configuration Status:');
  console.log('=========================================\n');

  const allSecrets = [
    ...secretsConfig.critical,
    ...secretsConfig.required,
    ...secretsConfig.important,
    ...secretsConfig.optional
  ];

  for (const secret of allSecrets) {
    const masked = getMaskedSecret(secret.name);
    const status = process.env[secret.name] ? 'SET' : 'NOT SET';
    console.log(`  ${secret.name}: ${status} (${masked})`);
  }

  console.log('\n=========================================\n');
}

export default {
  validateSecrets,
  isProductionReady,
  getMaskedSecret,
  printSecretsStatus,
  secretsConfig
};
