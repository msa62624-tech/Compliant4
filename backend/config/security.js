/**
 * Advanced Security Configuration
 * Enterprise-grade security settings for production environments
 */

/**
 * Content Security Policy Configuration
 * Prevents XSS, clickjacking, and other code injection attacks
 * 
 * NOTE: 'unsafe-inline' is used for Swagger UI compatibility.
 * In production, consider:
 * 1. Using nonces or hashes for inline scripts
 * 2. Serving Swagger UI from a separate subdomain
 * 3. Implementing a stricter CSP for main application routes
 */
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Required for Swagger UI - consider nonces in production
      "https://cdn.jsdelivr.net", // Swagger UI CDN
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for Swagger UI - consider nonces in production
      "https://cdn.jsdelivr.net",
    ],
    imgSrc: [
      "'self'",
      "data:", // Allow base64 encoded images
      "https:",
    ],
    fontSrc: [
      "'self'",
      "data:",
      "https://cdn.jsdelivr.net",
    ],
    connectSrc: [
      "'self'",
      "https://api.compliant.team", // Production API
    ],
    frameSrc: ["'none'"], // Prevent embedding
    objectSrc: ["'none'"], // Prevent plugins
    upgradeInsecureRequests: [], // Upgrade HTTP to HTTPS
  },
  reportOnly: false, // Set to true for testing, false for enforcement
};

/**
 * Helmet Security Headers Configuration
 * Additional security headers beyond defaults
 */
const helmetConfig = {
  // Content Security Policy
  contentSecurityPolicy: cspConfig,
  
  // DNS Prefetch Control - Disable DNS prefetching to prevent information leakage
  dnsPrefetchControl: {
    allow: false,
  },
  
  // Expect-CT Header - Certificate Transparency
  expectCt: {
    maxAge: 86400,
    enforce: true,
  },
  
  // Frameguard - Prevent clickjacking
  frameguard: {
    action: 'deny',
  },
  
  // Hide Powered By - Don't advertise Express
  hidePoweredBy: true,
  
  // HSTS - Force HTTPS
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // IE No Open - Prevent IE from executing downloads in site context
  ieNoOpen: true,
  
  // No Sniff - Prevent MIME type sniffing
  noSniff: true,
  
  // Referrer Policy - Control referrer information
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
  
  // XSS Filter - Enable XSS protection
  xssFilter: true,
};

/**
 * CORS Configuration
 * Restricts cross-origin requests to trusted domains
 * 
 * NOTE: Requests with no origin (e.g., mobile apps, Postman) are allowed.
 * In production environments with stricter requirements:
 * 1. Remove the no-origin check
 * 2. Require API keys for non-browser clients
 * 3. Use separate authentication for mobile apps
 */
const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5175',
      'http://localhost:3000',
      'https://compliant.team',
      'https://www.compliant.team',
      'https://app.compliant.team',
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    // For stricter security, remove this check and require API keys
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Idempotency-Key',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Idempotency-Hit',
    'X-Idempotency-Age',
    'X-Request-ID',
  ],
  maxAge: 86400, // 24 hours - how long browsers can cache preflight
};

/**
 * Rate Limiting Configuration
 * Advanced rate limiting with different tiers
 */
const rateLimitConfig = {
  // Standard API rate limit
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Strict rate limit for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
  },
  
  // File upload rate limit
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    message: 'Too many file uploads, please try again later.',
  },
  
  // Email sending rate limit
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 emails per hour
    message: 'Email rate limit exceeded, please try again later.',
  },
  
  // Admin operations rate limit
  admin: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // 100 operations per window
    message: 'Admin operation rate limit exceeded.',
  },
};

/**
 * Security Headers Middleware
 * Additional custom security headers
 */
const additionalSecurityHeaders = (req, res, next) => {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
  ].join(', '));
  
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

/**
 * Security Audit Log Configuration
 */
const auditConfig = {
  // Events that should always be audited
  criticalEvents: [
    'user.login',
    'user.login.failed',
    'user.logout',
    'user.password.reset',
    'user.created',
    'user.deleted',
    'role.changed',
    'permission.changed',
    'data.exported',
    'config.changed',
    'security.alert',
  ],
  
  // Audit log retention
  retention: {
    days: 90, // Keep audit logs for 90 days
    archive: true, // Archive old logs
  },
  
  // Sensitive data fields to redact in logs
  redactFields: [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'pin',
  ],
};

/**
 * Input Validation Configuration
 */
const validationConfig = {
  // Maximum request body size
  maxBodySize: '10mb',
  
  // Maximum file upload size
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Allowed file types for uploads
  allowedFileTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  
  // Sanitization rules
  sanitization: {
    stripScripts: true,
    stripTags: false, // Don't strip all tags, be selective
    escapeHtml: true,
  },
};

/**
 * Session Configuration
 */
const sessionConfig = {
  // JWT token configuration
  jwt: {
    accessTokenExpiry: '1h',
    refreshTokenExpiry: '7d',
    algorithm: 'HS256',
    issuer: 'compliant.team',
    audience: 'compliant.team',
  },
  
  // Session security
  security: {
    requireSecure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    httpOnly: true, // Prevent XSS
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

/**
 * Environment-specific security settings
 */
const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  return {
    development: {
      csp: { ...cspConfig, reportOnly: true },
      cors: { ...corsConfig, origin: true }, // Allow all origins in dev
      rateLimit: { ...rateLimitConfig.api, max: 10000 }, // Lenient in dev
    },
    production: {
      csp: cspConfig,
      cors: corsConfig,
      rateLimit: rateLimitConfig,
    },
    test: {
      csp: { ...cspConfig, reportOnly: true },
      cors: { ...corsConfig, origin: true },
      rateLimit: { ...rateLimitConfig.api, max: 100000 }, // No limits in test
    },
  }[env];
};

module.exports = {
  helmetConfig,
  cspConfig,
  corsConfig,
  rateLimitConfig,
  additionalSecurityHeaders,
  auditConfig,
  validationConfig,
  sessionConfig,
  getEnvironmentConfig,
};
