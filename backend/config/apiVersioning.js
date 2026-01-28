/**
 * API Versioning System
 * Enterprise-grade API version management with backward compatibility
 */

/**
 * API Version Configuration
 */
const API_VERSIONS = {
  v1: {
    version: '1.0.0',
    released: '2026-01-01',
    deprecated: false,
    sunsetDate: null,
    routes: [
      '/auth',
      '/entities',
      '/public',
      '/uploads',
      '/api-docs',
    ],
  },
  v2: {
    version: '2.0.0',
    released: null, // Not yet released
    deprecated: false,
    sunsetDate: null,
    routes: [],
    changes: [
      'Enhanced authentication with OAuth2',
      'Improved error responses',
      'New pagination format',
      'GraphQL endpoint',
    ],
  },
};

/**
 * Get current API version
 */
const getCurrentVersion = () => {
  return 'v1';
};

/**
 * Get supported versions
 */
const getSupportedVersions = () => {
  return Object.keys(API_VERSIONS).filter(
    version => !API_VERSIONS[version].deprecated
  );
};

/**
 * Check if version is supported
 */
const isVersionSupported = (version) => {
  return getSupportedVersions().includes(version);
};

/**
 * Extract version from request
 * Supports multiple version extraction methods:
 * 1. URL path: /api/v1/...
 * 2. Accept header: Accept: application/vnd.compliant.v1+json
 * 3. Custom header: X-API-Version: v1
 * 4. Query parameter: ?version=v1
 */
const extractVersionFromRequest = (req) => {
  // 1. Check URL path
  const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  // 2. Check Accept header
  const acceptHeader = req.get('Accept');
  if (acceptHeader) {
    const acceptMatch = acceptHeader.match(/application\/vnd\.compliant\.(v\d+)\+json/);
    if (acceptMatch) {
      return acceptMatch[1];
    }
  }
  
  // 3. Check custom header
  const versionHeader = req.get('X-API-Version');
  if (versionHeader) {
    return versionHeader.toLowerCase();
  }
  
  // 4. Check query parameter
  if (req.query.version) {
    return req.query.version.toLowerCase();
  }
  
  // Default to current version
  return getCurrentVersion();
};

/**
 * Version middleware
 * Validates and sets API version for request
 */
const versionMiddleware = (req, res, next) => {
  const version = extractVersionFromRequest(req);
  
  // Validate version
  if (!isVersionSupported(version)) {
    return res.status(400).json({
      error: 'Unsupported API version',
      message: `API version '${version}' is not supported`,
      supportedVersions: getSupportedVersions(),
      currentVersion: getCurrentVersion(),
    });
  }
  
  // Check if version is deprecated
  if (API_VERSIONS[version].deprecated) {
    res.set('X-API-Deprecation', 'true');
    res.set('X-API-Sunset-Date', API_VERSIONS[version].sunsetDate);
    res.set('Link', `</api-docs>; rel="deprecation"; type="text/html"`);
  }
  
  // Set version info in request and response
  req.apiVersion = version;
  res.set('X-API-Version', version);
  
  next();
};

/**
 * Version router
 * Creates versioned route handlers
 */
const createVersionedRouter = (express) => {
  const router = express.Router();
  
  // Version info endpoint
  router.get('/version', (req, res) => {
    const currentVersion = getCurrentVersion();
    const supportedVersions = getSupportedVersions();
    
    res.json({
      current: currentVersion,
      supported: supportedVersions,
      versions: API_VERSIONS,
    });
  });
  
  return router;
};

/**
 * Deprecate API version
 * Marks a version as deprecated with sunset date
 */
const deprecateVersion = (version, sunsetDate) => {
  if (API_VERSIONS[version]) {
    API_VERSIONS[version].deprecated = true;
    API_VERSIONS[version].sunsetDate = sunsetDate;
  }
};

/**
 * Version-specific feature flags
 * Allows gradual feature rollout across versions
 */
const FEATURE_FLAGS = {
  v1: {
    oauth2: false,
    graphql: false,
    webhooks: false,
    advancedFiltering: false,
  },
  // v2 feature flags will be added when v2 is released
};

/**
 * Check if feature is enabled for version
 */
const isFeatureEnabled = (version, feature) => {
  return FEATURE_FLAGS[version]?.[feature] || false;
};

/**
 * Version compatibility layer
 * Transforms responses to match version expectations
 */
const transformResponseForVersion = (version, data) => {
  if (version === 'v1') {
    // V1 response format
    return data;
  }
  
  // Future versions can add their own transformations
  return data;
};

/**
 * Version migration guide
 * Helps users migrate between versions
 */
const getMigrationGuide = (fromVersion, toVersion) => {
  const guides = {
    // Migration guides will be added as new versions are released
  };
  
  const key = `${fromVersion}-${toVersion}`;
  return guides[key] || null;
};

/**
 * API version changelog
 */
const getVersionChangelog = (version) => {
  const changelogs = {
    v1: {
      version: '1.0.0',
      released: '2026-01-01',
      changes: [
        'Initial API release',
        'JWT authentication',
        'RESTful endpoints for all entities',
        'File upload support',
        'OpenAPI documentation',
      ],
    },
  };
  
  return changelogs[version] || null;
};

/**
 * Version negotiation
 * Returns best matching version based on client requirements
 */
const negotiateVersion = (acceptedVersions) => {
  const supported = getSupportedVersions();
  
  // Find best match
  for (const version of acceptedVersions) {
    if (supported.includes(version)) {
      return version;
    }
  }
  
  // Return current if no match
  return getCurrentVersion();
};

/**
 * Setup API versioning
 */
const setupVersioning = (app, express, options = {}) => {
  const enableLogging = options.enableLogging || process.env.API_VERSION_LOGGING === 'true';
  
  // Apply version middleware globally
  app.use('/api', versionMiddleware);
  
  // Version info routes
  app.use('/api', createVersionedRouter(express));
  
  // Optional: Log version usage (disabled by default for performance)
  if (enableLogging) {
    app.use('/api', (req, res, next) => {
      // Could log to analytics service
      console.log(`API ${req.apiVersion} accessed: ${req.method} ${req.path}`);
      next();
    });
  }
};
export {
  API_VERSIONS,
  getCurrentVersion,
  getSupportedVersions,
  isVersionSupported,
  extractVersionFromRequest,
  versionMiddleware,
  createVersionedRouter,
  deprecateVersion,
  isFeatureEnabled,
  transformResponseForVersion,
  getMigrationGuide,
  getVersionChangelog,
  negotiateVersion,
  setupVersioning,
};
