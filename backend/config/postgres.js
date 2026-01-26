import pg from 'pg';
import logger from './logger.js';

const { Pool } = pg;

// Database configuration with fallback to JSON file storage
const dbConfig = {
  enabled: process.env.DATABASE_URL || process.env.DB_ENABLED === 'true',
  connectionString: process.env.DATABASE_URL,
  // Individual connection parameters (used if DATABASE_URL not provided)
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'compliant',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
  // SSL configuration
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

let pool = null;

/**
 * Initialize PostgreSQL connection pool
 */
export async function initDatabase() {
  if (!dbConfig.enabled) {
    logger.info('📁 PostgreSQL disabled - using JSON file storage');
    return null;
  }

  try {
    // Create connection pool
    pool = new Pool(
      dbConfig.connectionString
        ? { connectionString: dbConfig.connectionString, ssl: dbConfig.ssl }
        : {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password,
            max: dbConfig.max,
            min: dbConfig.min,
            idleTimeoutMillis: dbConfig.idleTimeoutMillis,
            connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
            ssl: dbConfig.ssl,
          }
    );

    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();

    logger.info('✅ PostgreSQL connected successfully', {
      database: dbConfig.database,
      host: dbConfig.host,
      timestamp: result.rows[0].now,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', { error: err.message, stack: err.stack });
    });

    return pool;
  } catch (error) {
    logger.error('❌ Failed to connect to PostgreSQL', {
      error: error.message,
      stack: error.stack,
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        ssl: !!dbConfig.ssl,
      },
    });
    
    // In production, fail fast
    if (process.env.NODE_ENV === 'production' && dbConfig.enabled) {
      throw error;
    }
    
    logger.warn('⚠️ Falling back to JSON file storage');
    return null;
  }
}

/**
 * Get database pool instance
 */
export function getPool() {
  return pool;
}

/**
 * Execute a query with automatic error handling
 */
export async function query(text, params) {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error) {
    logger.error('Database query error', {
      text: text.substring(0, 100),
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return await pool.connect();
}

/**
 * Close the database pool
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    logger.info('🔒 PostgreSQL connection pool closed');
  }
}

/**
 * Health check for database
 */
export async function healthCheck() {
  if (!pool) {
    return { status: 'disabled', message: 'Using JSON file storage' };
  }

  try {
    const result = await pool.query('SELECT 1 as health');
    return {
      status: 'healthy',
      message: 'Database connection is active',
      poolSize: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingRequests: pool.waitingCount,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
    };
  }
}

export default { initDatabase, getPool, query, getClient, closeDatabase, healthCheck };
