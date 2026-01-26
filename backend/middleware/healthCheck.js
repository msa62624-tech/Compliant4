import os from 'os';
import process from 'process';
import { entities } from '../config/database.js';
import logger from '../config/logger.js';

// Track when server started
const startTime = Date.now();

/**
 * Get system health metrics
 */
export function getSystemMetrics() {
  const uptime = process.uptime();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);
  
  const processMemory = process.memoryUsage();
  
  return {
    uptime: {
      seconds: Math.floor(uptime),
      formatted: formatUptime(uptime),
    },
    memory: {
      total: formatBytes(totalMemory),
      free: formatBytes(freeMemory),
      used: formatBytes(usedMemory),
      usagePercent: `${memoryUsagePercent}%`,
      process: {
        rss: formatBytes(processMemory.rss),
        heapTotal: formatBytes(processMemory.heapTotal),
        heapUsed: formatBytes(processMemory.heapUsed),
        external: formatBytes(processMemory.external),
      },
    },
    cpu: {
      cores: os.cpus().length,
      loadAverage: os.loadavg(),
      model: os.cpus()[0]?.model || 'Unknown',
    },
    platform: {
      type: os.type(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
  };
}

/**
 * Get application health status
 */
export function getApplicationHealth() {
  const entityCounts = {};
  Object.keys(entities).forEach(key => {
    if (Array.isArray(entities[key])) {
      entityCounts[key] = entities[key].length;
    }
  });
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    startTime: new Date(startTime).toISOString(),
    storage: {
      type: 'json-file',
      entities: entityCounts,
      totalRecords: Object.values(entityCounts).reduce((a, b) => a + b, 0),
    },
  };
}

/**
 * Enhanced health check endpoint handler
 */
export async function healthCheckHandler(req, res) {
  try {
    const detailed = req.query.detailed === 'true';
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
    
    // Detailed metrics only for authenticated requests (security consideration)
    // Public endpoint shows basic health only
    if (detailed && req.user) {
      health.system = getSystemMetrics();
      health.application = getApplicationHealth();
    } else if (detailed) {
      health.message = 'Detailed metrics require authentication';
    }
    
    res.status(200).json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message, stack: error.stack });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
}

/**
 * Readiness check - indicates if the service is ready to accept traffic
 */
export function readinessCheckHandler(req, res) {
  // Check if application has completed initialization
  // Add any initialization checks here (e.g., database connection, required services)
  
  const isReady = true; // Add real checks when needed
  
  if (isReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Liveness check - indicates if the service is alive
 */
export function livenessCheckHandler(req, res) {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}

// Helper functions

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export default {
  healthCheckHandler,
  readinessCheckHandler,
  livenessCheckHandler,
  getSystemMetrics,
  getApplicationHealth,
};
