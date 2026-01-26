import logger from '../config/logger.js';

/**
 * Validate environment variables at startup
 */
export function validateEnvironment() {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Required in production
  const requiredInProduction = [
    'JWT_SECRET',
    'FRONTEND_URL',
  ];
  
  // Recommended for all environments
  const recommended = [
    'ADMIN_EMAILS',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
  ];
  
  // Check required variables in production
  if (isProduction) {
    for (const varName of requiredInProduction) {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }
    
    // Check JWT_SECRET strength in production
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long in production');
    }
    
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.includes('change-me')) {
      errors.push('JWT_SECRET must be changed from default value in production');
    }
  }
  
  // Check recommended variables
  for (const varName of recommended) {
    if (!process.env[varName]) {
      warnings.push(`Recommended environment variable not set: ${varName}`);
    }
  }
  
  // Validate PORT
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('PORT must be a valid port number (1-65535)');
    }
  }
  
  // Validate SMTP_PORT
  if (process.env.SMTP_PORT) {
    const smtpPort = parseInt(process.env.SMTP_PORT, 10);
    if (isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      errors.push('SMTP_PORT must be a valid port number (1-65535)');
    }
  }
  
  // Validate FRONTEND_URL format
  if (process.env.FRONTEND_URL) {
    try {
      new URL(process.env.FRONTEND_URL);
    } catch (e) {
      errors.push('FRONTEND_URL must be a valid URL');
    }
  }
  
  // Validate boolean environment variables
  const booleanVars = ['SMTP_SECURE', 'SMTP_REQUIRE_TLS', 'SMTP_TLS_REJECT_UNAUTHORIZED'];
  for (const varName of booleanVars) {
    if (process.env[varName] && !['true', 'false'].includes(process.env[varName].toLowerCase())) {
      warnings.push(`${varName} should be 'true' or 'false'`);
    }
  }
  
  // Log results
  if (errors.length > 0) {
    logger.error('Environment validation failed', { errors });
    if (isProduction) {
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }
  }
  
  if (warnings.length > 0) {
    logger.warn('Environment validation warnings', { warnings });
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    logger.info('✅ Environment validation passed');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get environment info (safe to expose)
 */
export function getEnvironmentInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV || 'development',
    features: {
      smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
      adminEmails: !!process.env.ADMIN_EMAILS,
    },
  };
}

export default {
  validateEnvironment,
  getEnvironmentInfo,
};
