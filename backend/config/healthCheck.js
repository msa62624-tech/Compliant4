/**
 * Advanced Health Check System
 * Kubernetes-ready health checks with detailed diagnostics
 */

const os = require('os');
const process = require('process');

/**
 * Health check status enum
 */
const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
};

/**
 * Get system metrics
 */
const getSystemMetrics = () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;
  
  return {
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown',
      loadAverage: os.loadavg(),
    },
    memory: {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent: Math.round(memoryUsagePercent * 100) / 100,
    },
    uptime: {
      system: os.uptime(),
      process: process.uptime(),
    },
  };
};

/**
 * Get Node.js process metrics
 */
const getProcessMetrics = () => {
  const memUsage = process.memoryUsage();
  
  return {
    pid: process.pid,
    version: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: {
      rss: memUsage.rss, // Resident Set Size
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
    },
    uptime: process.uptime(),
    cpuUsage: process.cpuUsage(),
  };
};

/**
 * Check database health
 * @param {object} _db - Database connection (unused in current implementation)
 * @returns {object} Health status
 */
const checkDatabaseHealth = async (_db) => {
  try {
    // For in-memory storage, always healthy
    // In production with real DB, implement actual health check
    const startTime = Date.now();
    
    // Simulate DB ping
    await new Promise(resolve => setTimeout(resolve, 1));
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: HealthStatus.HEALTHY,
      responseTime,
      message: 'Database connection is healthy',
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      error: error.message,
      message: 'Database connection failed',
    };
  }
};

/**
 * Check external service health
 * @param {string} serviceName - Service name
 * @param {function} healthCheckFn - Health check function
 * @returns {object} Health status
 */
const checkExternalService = async (serviceName, healthCheckFn) => {
  try {
    const startTime = Date.now();
    const result = await healthCheckFn();
    const responseTime = Date.now() - startTime;
    
    return {
      service: serviceName,
      status: HealthStatus.HEALTHY,
      responseTime,
      ...result,
    };
  } catch (error) {
    return {
      service: serviceName,
      status: HealthStatus.UNHEALTHY,
      error: error.message,
    };
  }
};

/**
 * Basic liveness probe
 * Simple check that the application is running
 */
const livenessProbe = (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Readiness probe
 * Checks if application is ready to serve traffic
 */
const readinessProbe = async (req, res) => {
  try {
    const checks = {
      database: await checkDatabaseHealth(null),
      // Add more checks as needed
    };
    
    const allHealthy = Object.values(checks).every(
      check => check.status === HealthStatus.HEALTHY
    );
    
    if (allHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Detailed health check
 * Comprehensive health information
 */
const detailedHealthCheck = async (req, res) => {
  try {
    const startTime = Date.now();
    
    // System checks
    const systemMetrics = getSystemMetrics();
    const processMetrics = getProcessMetrics();
    const databaseHealth = await checkDatabaseHealth(null);
    
    // Determine overall status
    let overallStatus = HealthStatus.HEALTHY;
    
    // Check memory usage
    if (systemMetrics.memory.usagePercent > 90) {
      overallStatus = HealthStatus.DEGRADED;
    }
    
    // Check database
    if (databaseHealth.status === HealthStatus.UNHEALTHY) {
      overallStatus = HealthStatus.UNHEALTHY;
    }
    
    const responseTime = Date.now() - startTime;
    
    const healthReport = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      system: systemMetrics,
      process: processMetrics,
      checks: {
        database: databaseHealth,
      },
      dependencies: {
        node: process.version,
        npm: process.env.npm_package_version,
      },
    };
    
    // Return appropriate status code
    const statusCode = overallStatus === HealthStatus.HEALTHY ? 200 :
                       overallStatus === HealthStatus.DEGRADED ? 200 : 503;
    
    res.status(statusCode).json(healthReport);
  } catch (error) {
    res.status(503).json({
      status: HealthStatus.UNHEALTHY,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Startup probe
 * Checks if application has started successfully
 */
const startupProbe = (req, res) => {
  // Check if critical initialization is complete
  const isStarted = global.appStarted || false;
  
  if (isStarted) {
    res.status(200).json({
      status: 'started',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'starting',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Health check router
 */
const setupHealthChecks = (app) => {
  // Kubernetes liveness probe
  app.get('/health/live', livenessProbe);
  
  // Kubernetes readiness probe
  app.get('/health/ready', readinessProbe);
  
  // Kubernetes startup probe
  app.get('/health/startup', startupProbe);
  
  // Detailed health check (protected by auth in production)
  app.get('/health/detailed', detailedHealthCheck);
  
  // Legacy health endpoint (for backward compatibility)
  app.get('/health', async (req, res) => {
    // If detailed=true query param, return detailed health
    if (req.query.detailed === 'true') {
      return detailedHealthCheck(req, res);
    }
    
    // Otherwise return basic health
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  });
};

/**
 * Health check metrics for Prometheus
 */
const getHealthMetrics = () => {
  const systemMetrics = getSystemMetrics();
  const processMetrics = getProcessMetrics();
  
  return {
    system_memory_total_bytes: systemMetrics.memory.total,
    system_memory_used_bytes: systemMetrics.memory.used,
    system_memory_free_bytes: systemMetrics.memory.free,
    system_memory_usage_percent: systemMetrics.memory.usagePercent,
    process_memory_rss_bytes: processMetrics.memory.rss,
    process_memory_heap_total_bytes: processMetrics.memory.heapTotal,
    process_memory_heap_used_bytes: processMetrics.memory.heapUsed,
    process_uptime_seconds: processMetrics.uptime,
    system_uptime_seconds: systemMetrics.uptime.system,
    system_cpu_cores: systemMetrics.cpu.cores,
  };
};

module.exports = {
  HealthStatus,
  getSystemMetrics,
  getProcessMetrics,
  checkDatabaseHealth,
  checkExternalService,
  livenessProbe,
  readinessProbe,
  detailedHealthCheck,
  startupProbe,
  setupHealthChecks,
  getHealthMetrics,
};
