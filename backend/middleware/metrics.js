import promClient from 'prom-client';
import logger from '../config/logger.js';

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'compliant_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics for business logic
const httpRequestDuration = new promClient.Histogram({
  name: 'compliant_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register],
});

const httpRequestTotal = new promClient.Counter({
  name: 'compliant_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const activeConnections = new promClient.Gauge({
  name: 'compliant_active_connections',
  help: 'Number of active connections',
  registers: [register],
});

const authAttempts = new promClient.Counter({
  name: 'compliant_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status', 'type'],
  registers: [register],
});

const entityOperations = new promClient.Counter({
  name: 'compliant_entity_operations_total',
  help: 'Total number of entity operations',
  labelNames: ['entity', 'operation', 'status'],
  registers: [register],
});

const coiGenerated = new promClient.Counter({
  name: 'compliant_coi_generated_total',
  help: 'Total number of COIs generated',
  labelNames: ['status'],
  registers: [register],
});

const documentUploads = new promClient.Counter({
  name: 'compliant_document_uploads_total',
  help: 'Total number of document uploads',
  labelNames: ['type', 'status'],
  registers: [register],
});

const complianceChecks = new promClient.Counter({
  name: 'compliant_compliance_checks_total',
  help: 'Total number of compliance checks performed',
  labelNames: ['status'],
  registers: [register],
});

const emailsSent = new promClient.Counter({
  name: 'compliant_emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['type', 'status'],
  registers: [register],
});

const errorCounter = new promClient.Counter({
  name: 'compliant_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'endpoint'],
  registers: [register],
});

const databaseOperations = new promClient.Histogram({
  name: 'compliant_database_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'entity'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

/**
 * Middleware to collect HTTP request metrics
 */
export function metricsMiddleware(req, res, next) {
  // Skip metrics collection for /metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  const start = Date.now();
  
  // Track active connection
  activeConnections.inc();

  // Capture response finish event
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = (Date.now() - start) / 1000;
    const route = getRoutePath(req);
    const statusCode = res.statusCode;

    // Record metrics
    httpRequestDuration.labels(req.method, route, statusCode).observe(duration);
    httpRequestTotal.labels(req.method, route, statusCode).inc();
    activeConnections.dec();

    // Log slow requests
    if (duration > 5) {
      logger.warn('Slow request detected', {
        method: req.method,
        route,
        duration,
        correlationId: req.correlationId,
      });
    }

    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Get a normalized route path for metrics (avoid high cardinality)
 */
function getRoutePath(req) {
  const path = req.route?.path || req.path;
  
  // Normalize paths with IDs
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/[0-9]+/g, '/:id')
    .replace(/\/[a-f0-9]{24}/g, '/:id');
}

/**
 * Metrics endpoint handler
 * Returns Prometheus-formatted metrics
 */
export async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    logger.error('Failed to collect metrics', {
      error: err.message,
      correlationId: req.correlationId,
    });
    res.status(500).json({
      error: 'Failed to collect metrics',
      correlationId: req.correlationId,
    });
  }
}

/**
 * Helper functions to record business metrics
 */
export const recordMetrics = {
  authAttempt: (success, type = 'password') => {
    authAttempts.labels(success ? 'success' : 'failure', type).inc();
  },
  
  entityOperation: (entity, operation, success) => {
    entityOperations.labels(entity, operation, success ? 'success' : 'failure').inc();
  },
  
  coiGenerated: (success) => {
    coiGenerated.labels(success ? 'success' : 'failure').inc();
  },
  
  documentUpload: (type, success) => {
    documentUploads.labels(type, success ? 'success' : 'failure').inc();
  },
  
  complianceCheck: (status) => {
    complianceChecks.labels(status).inc();
  },
  
  emailSent: (type, success) => {
    emailsSent.labels(type, success ? 'success' : 'failure').inc();
  },
  
  error: (type, endpoint) => {
    errorCounter.labels(type, endpoint).inc();
  },
  
  databaseOperation: async (operation, entity, fn) => {
    const end = databaseOperations.startTimer({ operation, entity });
    try {
      const result = await fn();
      end();
      return result;
    } catch (error) {
      end();
      throw error;
    }
  },
};

export default register;
