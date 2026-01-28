# Enterprise Features Guide

This document describes the enterprise-ready features implemented in the Compliant4 application.

## Overview

The application has been enhanced with production-grade features for observability, security, reliability, and operational excellence.

## 🆕 Latest Enterprise Enhancements (2026-01)

### API Documentation (Swagger/OpenAPI)

**Interactive API documentation** with full OpenAPI 3.0 specification:

- **Swagger UI** at `/api-docs` - Browse and test API endpoints
- **OpenAPI Spec** at `/api-docs.json` - Machine-readable API documentation
- **Authentication Support** - Test authenticated endpoints directly in UI
- **Full Coverage** - All endpoints documented with schemas and examples

**Access Documentation**:
```bash
# Open in browser
http://localhost:3001/api-docs

# Get OpenAPI JSON spec
curl http://localhost:3001/api-docs.json
```

### Prometheus Metrics

**Production-grade metrics** for monitoring and alerting:

- **Endpoint**: `/metrics` (requires authentication)
- **Default Metrics**: CPU, memory, event loop, GC stats
- **Business Metrics**: 
  - HTTP request duration and totals
  - Active connections
  - Authentication attempts
  - Entity operations (create, update, delete)
  - COI generations
  - Document uploads
  - Compliance checks
  - Email sends
  - Error counts

**Usage**:
```bash
# Get metrics (requires auth token)
curl -H "Authorization: Bearer <token>" http://localhost:3001/metrics
```

### Centralized Error Handling

**Enterprise-grade error management**:

- **Custom Error Classes**: ValidationError, AuthenticationError, NotFoundError, etc.
- **Consistent Format**: All errors return same structure with correlation ID
- **Security**: Stack traces only in development
- **Logging**: All errors logged with full context

**Error Response Format**:
```json
{
  "error": "Resource not found",
  "correlationId": "abc123-uuid-456",
  "details": { "id": "entity-789" }
}
```

### Request Idempotency

**Prevents duplicate operations** from client retries:

- **Automatic Detection**: Generates idempotency key from request
- **Explicit Keys**: Support for `Idempotency-Key` header
- **15-Minute Cache**: Duplicate requests return cached response
- **Response Headers**: `X-Idempotency-Hit`, `X-Idempotency-Age`

**Example**:
```bash
# First request creates entity
curl -X POST /entities/Project \
  -H "Idempotency-Key: unique-key-123" \
  -d '{"name":"New Project"}'
# Returns: X-Idempotency-Hit: false

# Retry returns cached response
curl -X POST /entities/Project \
  -H "Idempotency-Key: unique-key-123" \
  -d '{"name":"New Project"}'
# Returns: X-Idempotency-Hit: true
```

### Response Compression

**Gzip compression** for bandwidth optimization:

- **Automatic**: All responses compressed if client supports it
- **60-80% Reduction**: Significant bandwidth savings
- **Configurable**: Compression level and filtering
- **Smart**: Skips small responses and already-compressed content

### Intelligent Cache Control

**HTTP caching** for performance:

- **Smart Caching**: Different strategies per endpoint type
  - Health checks: 30 seconds
  - API docs: 1 hour
  - Static assets: 1 year (immutable)
  - API data: No cache
- **CDN-Ready**: Proper cache headers for CDN integration
- **ETag Support**: Conditional requests with 304 Not Modified

## 🔍 Observability & Monitoring

### Structured Logging

**Winston logger** replaces console.log with structured, production-grade logging:

- **Log Levels**: error, warn, info, http, debug
- **Automatic Environment Detection**: Serverless-aware (Vercel, Render, AWS Lambda)
- **File Rotation**: Daily rotating log files (development/traditional deployments only)
- **Console Output**: Colored, timestamped logs for development
- **JSON Format**: Structured logs for easy parsing and analysis

**Log Files** (traditional deployments only):
- `backend/logs/error-YYYY-MM-DD.log` - Error logs only
- `backend/logs/combined-YYYY-MM-DD.log` - All logs
- `backend/logs/exceptions-YYYY-MM-DD.log` - Uncaught exceptions
- `backend/logs/rejections-YYYY-MM-DD.log` - Unhandled promise rejections

**Configuration**:
```javascript
import logger from './config/logger.js';

logger.info('Application started');
logger.error('Error occurred', { error: err.message, userId: user.id });
logger.debug('Debug information', { requestId: req.correlationId });
```

### Request Logging

**Morgan middleware** logs all HTTP requests:

- **Custom Format**: Includes correlation ID, user ID, method, URL, status, response time
- **Winston Integration**: Requests logged through Winston for consistent output
- **Health Check Filtering**: Skips /health endpoint to reduce noise

**Log Output Example**:
```
2026-01-26 00:38:52 http: abc123-correlation-id POST /auth/login 200 45 ms - 512 - user@example.com
```

### Correlation IDs

**Request tracing** across the entire request lifecycle:

- **Automatic Generation**: UUID assigned to each request
- **Header Support**: Respects X-Correlation-ID or X-Request-ID from upstream
- **Response Headers**: Correlation ID included in all responses
- **Log Integration**: All logs include correlationId for request tracing

**Usage**:
```javascript
// Automatically available in all route handlers
logger.info('Processing request', { correlationId: req.correlationId });
```

### Health Check Endpoints

**Enhanced health checks** with detailed system metrics:

1. **`GET /health`** - Basic health check
   ```json
   {
     "status": "ok",
     "timestamp": "2026-01-26T00:38:51.000Z",
     "uptime": 120.5
   }
   ```

2. **`GET /health?detailed=true`** - Detailed system metrics
   ```json
   {
     "status": "ok",
     "timestamp": "2026-01-26T00:38:51.000Z",
     "uptime": 120.5,
     "system": {
       "uptime": { "seconds": 120, "formatted": "2m 0s" },
       "memory": { "total": "8 GB", "used": "2.5 GB", "usagePercent": "31.25%" },
       "cpu": { "cores": 4, "loadAverage": [1.2, 0.9, 0.8] }
     },
     "application": {
       "status": "healthy",
       "environment": "production",
       "nodeVersion": "v20.20.0",
       "storage": { "type": "json-file", "totalRecords": 1523 }
     }
   }
   ```

3. **`GET /health/readiness`** - Kubernetes readiness probe
4. **`GET /health/liveness`** - Kubernetes liveness probe

## 🔒 Security Enhancements

### Audit Logging

**Comprehensive audit trail** for all sensitive operations:

**Event Types**:
- Authentication: LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, PASSWORD_CHANGE
- User Management: USER_CREATED, USER_UPDATED, USER_DELETED
- Contractor Management: CONTRACTOR_CREATED, CONTRACTOR_UPDATED
- Documents: DOCUMENT_UPLOADED, DOCUMENT_APPROVED, DOCUMENT_DELETED
- Compliance: COI_GENERATED, COMPLIANCE_STATUS_CHANGED

**Usage**:
```javascript
import { logAudit, AuditEventType } from './middleware/auditLogger.js';

logAudit(AuditEventType.DOCUMENT_APPROVED, {
  documentId: doc.id,
  userId: req.user.id,
  correlationId: req.correlationId
});
```

**Audit Middleware** (automatic logging):
```javascript
app.post('/entities/User', 
  auditMiddleware(AuditEventType.USER_CREATED),
  (req, res) => { /* handler */ }
);
```

### Input Sanitization

**Automatic sanitization** of all user input:

- **Null Byte Removal**: Prevents directory traversal
- **Whitespace Trimming**: Normalizes input
- **HTML Escaping**: Optional XSS prevention
- **Recursive Sanitization**: Handles nested objects and arrays

**Applied To**:
- Request body
- Query parameters
- URL parameters

**Configuration**:
```javascript
// Basic sanitization (default)
app.use(sanitizeInput());

// With HTML escaping
app.use(sanitizeInput({ escapeHtml: true }));
```

**Validation Helpers**:
```javascript
import { validateRequired, validateEmail, validateEnum } from './middleware/inputSanitization.js';

app.post('/api/user',
  validateRequired(['email', 'name']),
  validateEmail('email'),
  validateEnum('role', ['user', 'admin']),
  (req, res) => { /* handler */ }
);
```

### Environment Validation

**Startup validation** ensures required configuration:

**Production Requirements**:
- JWT_SECRET (min 32 characters, cannot contain "change-me")
- FRONTEND_URL (valid URL format)
- PORT (valid port number 1-65535)

**Warnings**:
- Missing recommended variables (ADMIN_EMAILS, SMTP_HOST, etc.)
- Invalid boolean values
- Weak security settings

**Automatic Validation**:
- Runs before server accepts traffic
- Fails fast in production if requirements not met
- Logs warnings for missing recommended config

## 🎯 Operational Excellence

### Graceful Shutdown

**Zero-downtime deployments** with proper cleanup:

**Features**:
- **Connection Tracking**: Monitors active requests
- **Graceful Timeout**: Waits for requests to complete (default: 30s)
- **Data Persistence**: Saves all pending data before exit
- **Signal Handling**: SIGTERM, SIGINT, uncaughtException, unhandledRejection

**Configuration**:
```bash
# Set shutdown timeout (milliseconds)
SHUTDOWN_TIMEOUT=30000
```

**Behavior**:
1. Receives shutdown signal
2. Stops accepting new connections (returns 503)
3. Waits for active requests to complete
4. Saves data to disk
5. Exits cleanly

### Active Connection Tracking

**Middleware tracks** all in-flight requests:

- Prevents premature shutdown
- Returns 503 when shutting down
- Monitors connection count for health checks

## 📊 Metrics & Monitoring

### System Metrics

Available via `/health?detailed=true`:

**Memory Metrics**:
- Total system memory
- Free/used memory
- Process memory (RSS, heap used, heap total)
- Memory usage percentage

**CPU Metrics**:
- CPU core count
- Load average (1, 5, 15 minutes)
- CPU model

**Application Metrics**:
- Uptime (seconds and formatted)
- Node.js version
- Environment (development/production)
- Storage type and record counts

## 🚀 Deployment Considerations

### Serverless Platforms (Vercel, Render, AWS Lambda)

**Automatic Detection**: Logger detects serverless environments and adjusts:
- ✅ Console logging enabled
- ❌ File logging disabled (ephemeral filesystem)
- ✅ All other features work normally

**Environment Variables**:
- `VERCEL` - Detected automatically
- `RENDER` - Detected automatically  
- `LAMBDA_TASK_ROOT` - Detected automatically

### Traditional Deployments (Docker, VM, Bare Metal)

**Full Feature Set**:
- ✅ Console logging
- ✅ File logging with rotation
- ✅ Log files in `backend/logs/`
- ✅ All features enabled

**Log Management**:
- Logs rotate daily
- Maximum 14 days retention
- Maximum 20MB per file
- Automatic cleanup of old logs

### Docker Deployment

**Dockerfile included** with security best practices:
- Non-root user (nodejs:nodejs)
- Multi-stage builds
- Health check configured
- Security updates applied

**Docker Compose**:
```bash
cd backend
docker-compose up
```

## 🔧 Configuration

### Required Environment Variables (Production)

```bash
NODE_ENV=production
JWT_SECRET=<32+ character random string>
FRONTEND_URL=https://your-domain.com
```

### Recommended Environment Variables

```bash
ADMIN_EMAILS=admin@company.com,security@company.com
SHUTDOWN_TIMEOUT=30000
SMTP_HOST=smtp.example.com
SMTP_USER=noreply@company.com
SMTP_PASS=<secure password>
```

### Optional Configuration

```bash
# Logging (development only)
LOG_LEVEL=debug

# Renewal scheduler
RENEWAL_LOOKAHEAD_DAYS=30
RENEWAL_POLL_INTERVAL_MS=86400000
```

## 📈 Monitoring Integration (Ready for)

The application is prepared for integration with:

### Error Tracking
- **Sentry**: Structured error logs with correlation IDs
- **Rollbar**: Exception tracking with user context
- **Bugsnag**: Automatic error grouping

### APM (Application Performance Monitoring)
- **New Relic**: HTTP request timing included
- **DataDog**: Structured metrics ready
- **AppDynamics**: Transaction tracing support

### Log Aggregation
- **Elasticsearch**: JSON structured logs
- **Splunk**: Correlation ID for request tracing
- **CloudWatch**: Compatible log format

## 🎓 Best Practices

### For Developers

1. **Use the logger**, not console.log:
   ```javascript
   // ❌ Don't
   console.log('User logged in:', userId);
   
   // ✅ Do
   logger.info('User logged in', { userId, correlationId: req.correlationId });
   ```

2. **Include correlation IDs** in all logs:
   ```javascript
   logger.error('Database error', { 
     error: err.message,
     correlationId: req.correlationId,
     userId: req.user?.id 
   });
   ```

3. **Use audit logging** for sensitive operations:
   ```javascript
   logAudit(AuditEventType.DOCUMENT_DELETED, {
     documentId, userId, reason
   });
   ```

### For Operations

1. **Monitor health endpoints** for service status
2. **Set up log aggregation** to collect logs centrally
3. **Configure alerts** on error rates
4. **Review audit logs** regularly for security
5. **Test graceful shutdown** before production deployment

## 🔐 Security Considerations

1. **JWT_SECRET**: Must be strong (32+ characters) in production
2. **Audit Logs**: Contain sensitive information - secure access
3. **Log Files**: May contain PII - implement log retention policy
4. **Environment Variables**: Never commit real credentials
5. **Rate Limiting**: Already configured, monitor for attacks

## 📝 Changelog

### Enterprise Features Added

- ✅ Structured logging (Winston)
- ✅ Request logging (Morgan)
- ✅ Correlation IDs for request tracing
- ✅ Enhanced health checks with system metrics
- ✅ Audit logging for sensitive operations
- ✅ Input sanitization middleware
- ✅ Environment validation
- ✅ Graceful shutdown
- ✅ Active connection tracking
- ✅ Error tracking preparation
- ✅ Serverless platform support

### Not Included (Future Enhancements)

- ❌ PostgreSQL database (JSON file storage maintained for Codespace compatibility)
- ❌ Redis caching
- ❌ API versioning (can be added as needed)
- ❌ CSRF protection (consider for form-based auth)
- ❌ Rate limit headers in responses
- ❌ OpenAPI/Swagger documentation (can be generated)

## 🆘 Troubleshooting

### Logs not appearing
- **Serverless**: Check console output (file logging disabled)
- **Traditional**: Check `backend/logs/` directory exists
- **Permissions**: Ensure write permissions on logs directory

### Health check returns 503
- **Shutting down**: Server is in graceful shutdown mode
- **Not ready**: Application hasn't completed initialization

### Audit logs not recording
- Check logger configuration
- Verify audit middleware is applied to route
- Check log level (should be 'info' or lower)

### High memory usage
- Check log rotation settings
- Review application entity counts in /health?detailed=true
- Consider implementing data archival

## 📞 Support

For issues or questions about enterprise features:
1. Check this documentation
2. Review application logs
3. Test with `/health?detailed=true` endpoint
4. Check environment variable validation warnings
