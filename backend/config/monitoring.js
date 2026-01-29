/**
 * Advanced Monitoring and Observability Configuration
 * Enterprise-grade monitoring, tracing, and performance tracking
 */

import crypto from 'crypto';

/**
 * Generate unique request ID
 */
const generateRequestId = () => {
  return `req_${crypto.randomBytes(16).toString('hex')}`;
};

/**
 * Request Tracking Middleware
 * Tracks all requests with unique IDs and timing
 */
const requestTracker = (req, res, next) => {
  // Generate or use existing request ID
  const requestId = req.get('X-Request-ID') || generateRequestId();
  
  // Store request metadata
  req.requestId = requestId;
  req.requestStartTime = Date.now();
  
  // Add request ID to response headers
  res.set('X-Request-ID', requestId);
  
  // Track response
  const originalSend = res.send;
  res.send = function (data) {
    res.responseTime = Date.now() - req.requestStartTime;
    res.set('X-Response-Time', `${res.responseTime}ms`);
    return originalSend.call(this, data);
  };
  
  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - req.requestStartTime;
    
    // Structured request log
    const requestLog = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    };
    
    // Log slow requests (> 1000ms)
    if (duration > 1000) {
      console.warn('⚠️ Slow request detected:', requestLog);
    }
  });
  
  next();
};

/**
 * Performance Monitoring
 * Tracks performance metrics for critical operations
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      database: 100, // ms
      api: 500, // ms
      render: 16, // ms (60fps)
      download: 3000, // ms
    };
  }
  
  /**
   * Start tracking an operation
   */
  start(operationName, metadata = {}) {
    const trackingId = generateRequestId();
    
    this.metrics.set(trackingId, {
      operation: operationName,
      startTime: Date.now(),
      metadata,
    });
    
    return trackingId;
  }
  
  /**
   * End tracking and record metrics
   */
  end(trackingId) {
    const metric = this.metrics.get(trackingId);
    
    if (!metric) {
      console.warn(`Performance tracking ID not found: ${trackingId}`);
      return null;
    }
    
    const duration = Date.now() - metric.startTime;
    const result = {
      operation: metric.operation,
      duration,
      metadata: metric.metadata,
      timestamp: new Date().toISOString(),
    };
    
    // Check against thresholds
    const threshold = this.thresholds[metric.operation] || 1000;
    if (duration > threshold) {
      result.warning = `Operation exceeded threshold (${duration}ms > ${threshold}ms)`;
      console.warn('⚠️ Performance warning:', result);
    }
    
    // Clean up
    this.metrics.delete(trackingId);
    
    return result;
  }
  
  /**
   * Record a complete operation
   */
  record(operationName, duration, metadata = {}) {
    return {
      operation: operationName,
      duration,
      metadata,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get active operations
   */
  getActiveOperations() {
    return Array.from(this.metrics.values()).map(metric => ({
      operation: metric.operation,
      duration: Date.now() - metric.startTime,
      metadata: metric.metadata,
    }));
  }
}

/**
 * Error Tracking
 * Advanced error tracking with context and stack traces
 */
class ErrorTracker {
  constructor() {
    this.errors = [];
    this.maxErrors = 1000; // Keep last 1000 errors in memory
  }
  
  /**
   * Track an error
   */
  track(error, context = {}) {
    const errorRecord = {
      id: generateRequestId(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      context,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };
    
    this.errors.push(errorRecord);
    
    // Trim old errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(errorRecord);
    }
    
    return errorRecord;
  }
  
  /**
   * Send error to external tracking service
   */
  sendToErrorService(errorRecord) {
    // Placeholder for Sentry, Rollbar, etc.
    // Example: Sentry.captureException(error, { extra: context });
    console.error('🔴 Error tracked:', errorRecord);
  }
  
  /**
   * Get recent errors
   */
  getRecentErrors(limit = 100) {
    return this.errors.slice(-limit);
  }
  
  /**
   * Get error statistics
   */
  getStatistics() {
    const errorsByType = {};
    const errorsByCode = {};
    
    this.errors.forEach(error => {
      errorsByType[error.name] = (errorsByType[error.name] || 0) + 1;
      if (error.code) {
        errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1;
      }
    });
    
    return {
      total: this.errors.length,
      byType: errorsByType,
      byCode: errorsByCode,
    };
  }
}

/**
 * Business Metrics Tracker
 * Track business-specific metrics
 */
class BusinessMetricsTracker {
  constructor() {
    this.metrics = {
      // Authentication metrics
      loginAttempts: 0,
      loginSuccesses: 0,
      loginFailures: 0,
      
      // Entity operations
      entityCreates: 0,
      entityReads: 0,
      entityUpdates: 0,
      entityDeletes: 0,
      
      // Document operations
      documentsUploaded: 0,
      documentsApproved: 0,
      documentsRejected: 0,
      
      // COI operations
      coiGenerated: 0,
      coiSigned: 0,
      
      // Email operations
      emailsSent: 0,
      emailsFailed: 0,
    };
  }
  
  /**
   * Increment a metric
   */
  increment(metric, value = 1) {
    if (Object.prototype.hasOwnProperty.call(this.metrics, metric)) {
      this.metrics[metric] += value;
    } else {
      this.metrics[metric] = value;
    }
  }
  
  /**
   * Get all metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
  
  /**
   * Reset metrics
   */
  reset() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = 0;
    });
  }
  
  /**
   * Get metrics summary
   */
  getSummary() {
    return {
      authentication: {
        attempts: this.metrics.loginAttempts,
        successes: this.metrics.loginSuccesses,
        failures: this.metrics.loginFailures,
        successRate: this.metrics.loginAttempts > 0
          ? (this.metrics.loginSuccesses / this.metrics.loginAttempts * 100).toFixed(2) + '%'
          : 'N/A',
      },
      entities: {
        creates: this.metrics.entityCreates,
        reads: this.metrics.entityReads,
        updates: this.metrics.entityUpdates,
        deletes: this.metrics.entityDeletes,
        total: this.metrics.entityCreates + this.metrics.entityReads +
               this.metrics.entityUpdates + this.metrics.entityDeletes,
      },
      documents: {
        uploaded: this.metrics.documentsUploaded,
        approved: this.metrics.documentsApproved,
        rejected: this.metrics.documentsRejected,
        approvalRate: this.metrics.documentsUploaded > 0
          ? ((this.metrics.documentsApproved / this.metrics.documentsUploaded) * 100).toFixed(2) + '%'
          : 'N/A',
      },
      coi: {
        generated: this.metrics.coiGenerated,
        signed: this.metrics.coiSigned,
        signRate: this.metrics.coiGenerated > 0
          ? ((this.metrics.coiSigned / this.metrics.coiGenerated) * 100).toFixed(2) + '%'
          : 'N/A',
      },
      email: {
        sent: this.metrics.emailsSent,
        failed: this.metrics.emailsFailed,
        successRate: this.metrics.emailsSent > 0
          ? ((this.metrics.emailsSent / (this.metrics.emailsSent + this.metrics.emailsFailed)) * 100).toFixed(2) + '%'
          : 'N/A',
      },
    };
  }
}

/**
 * Distributed Tracing
 * OpenTelemetry-compatible tracing
 */
class DistributedTracer {
  constructor() {
    this.spans = new Map();
  }
  
  /**
   * Start a new span
   */
  startSpan(spanName, parentSpanId = null) {
    const spanId = generateRequestId();
    const traceId = parentSpanId ? this.spans.get(parentSpanId)?.traceId : generateRequestId();
    
    const span = {
      spanId,
      traceId,
      parentSpanId,
      name: spanName,
      startTime: Date.now(),
      attributes: {},
      events: [],
    };
    
    this.spans.set(spanId, span);
    return spanId;
  }
  
  /**
   * Add attribute to span
   */
  setAttribute(spanId, key, value) {
    const span = this.spans.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }
  
  /**
   * Add event to span
   */
  addEvent(spanId, eventName, attributes = {}) {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({
        name: eventName,
        timestamp: Date.now(),
        attributes,
      });
    }
  }
  
  /**
   * End a span
   */
  endSpan(spanId) {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      
      // In production, export to tracing backend
      if (process.env.NODE_ENV === 'production') {
        this.exportSpan(span);
      }
      
      return span;
    }
    return null;
  }
  
  /**
   * Export span to tracing backend
   */
  exportSpan(span) {
    // Placeholder for Jaeger, Zipkin, etc.
    console.log('📊 Trace span:', span);
  }
  
  /**
   * Get active spans
   */
  getActiveSpans() {
    return Array.from(this.spans.values()).filter(span => !span.endTime);
  }
}

/**
 * Create monitoring instances
 */
const performanceMonitor = new PerformanceMonitor();
const errorTracker = new ErrorTracker();
const businessMetrics = new BusinessMetricsTracker();
const tracer = new DistributedTracer();

/**
 * Monitoring dashboard endpoint
 */
const getMonitoringDashboard = () => {
  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    performance: {
      activeOperations: performanceMonitor.getActiveOperations(),
    },
    errors: {
      recent: errorTracker.getRecentErrors(10),
      statistics: errorTracker.getStatistics(),
    },
    business: businessMetrics.getSummary(),
    tracing: {
      activeSpans: tracer.getActiveSpans().length,
    },
  };
};

export {
  requestTracker,
  performanceMonitor,
  errorTracker,
  businessMetrics,
  tracer,
  getMonitoringDashboard,
  generateRequestId,
};
