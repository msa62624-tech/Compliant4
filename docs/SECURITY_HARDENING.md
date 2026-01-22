# Security Hardening Implementation

This document outlines the security enhancements implemented in the INsuretrack backend.

## 1. Security Headers (Helmet)

### Implementation
- **Content Security Policy (CSP)**: Restricts which resources can be loaded
  - `default-src`: `'self'` - Only allow same-origin resources by default
  - `script-src`: `'self'`, `'unsafe-inline'` - Scripts from same origin only
  - `style-src`: `'self'`, `'unsafe-inline'` - Styles from same origin only
  - `img-src`: `'self'`, `data:`, `https:` - Images from same origin, data URLs, and HTTPS
  - `object-src`: `'none'` - Disallow plugins and embeds
  - `frame-src`: `'none'` - No embedded iframes

- **HSTS** (HTTP Strict Transport Security)
  - Max age: 1 year
  - Include subdomains
  - Preload enabled
  - Forces HTTPS connections

- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Enables browser XSS filters
- **Referrer-Policy**: `strict-origin-when-cross-origin`

## 2. Rate Limiting

Three different rate limiters implemented:

### API Limiter
- **Window**: 15 minutes
- **Max Requests**: 100 per IP
- **Applied to**: `/api/` and `/entities/` routes
- **Skipped in**: Development mode

### Auth Limiter
- **Window**: 15 minutes
- **Max Attempts**: 5 login attempts per IP
- **Skip Successful**: Successful logins don't count towards limit
- **Applied to**: `/auth/login` endpoint

### Upload Limiter
- **Window**: 1 hour
- **Max Uploads**: 50 files per IP
- **Applied to**: `/public/upload-file` endpoint

## 3. CORS Configuration

### Whitelist
Allowed origins:
- `http://localhost:5173`
- `http://localhost:5175`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5175`
- GitHub Codespaces domains (`.app.github.dev`)
- Environment-configured `FRONTEND_URL`

### Configuration
- **Credentials**: Allowed (`true`)
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization
- **Max Age**: 3600 seconds (1 hour)

## 4. File Upload Validation

### Allowed File Types
- **PDFs**: `application/pdf`
- **Images**: `image/png`, `image/jpeg`, `image/jpg`

### Validation Checks
1. **Extension Validation**: Only `.pdf`, `.png`, `.jpeg`, `.jpg`
2. **MIME Type Validation**: Matches allowed MIME types
3. **File Size Limit**: 10MB maximum
4. **Filename Sanitization**: Rejects filenames with invalid characters
5. **File Existence Check**: Verifies file is persisted before returning URL

### Error Messages
Detailed validation errors returned in consistent format:
```json
{
  "success": false,
  "error": "Validation error message",
  "details": "Additional context",
  "timestamp": "ISO-8601 timestamp"
}
```

## 5. Input Validation

### Libraries Used
- `express-validator`: Robust input validation middleware

### Validated Endpoints
- **Login**: `POST /auth/login`
  - `username`: Required, non-empty
  - `password`: Required, non-empty

- **Token Refresh**: `POST /auth/refresh`
  - `refreshToken`: Required, non-empty

### Middleware
Custom `handleValidationErrors` middleware returns validation failures in standard format with HTTP 400 status.

## 6. Error Response Standardization

### Format
All API errors use consistent response format:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional context (optional)",
  "timestamp": "ISO-8601 timestamp"
}
```

### HTTP Status Codes
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication failures)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## 7. Environment Configuration

### Required Environment Variables
```bash
# JWT secret (change in production)
JWT_SECRET=your-secret-key

# Database URL
DATABASE_URL=your-database-url

# Email configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ADMIN_EMAILS=admin1@example.com,admin2@example.com

# Frontend URL
FRONTEND_URL=https://your-frontend-url.com

# Environment
NODE_ENV=production
```

### Development vs Production
- Rate limiting is **skipped in development** for easier testing
- CSP allows `unsafe-inline` in development
- CORS allows all origins in development mode

## 8. Best Practices Implemented

✅ **Security Headers**: Complete helmet configuration
✅ **Rate Limiting**: Multi-level rate limiting strategy
✅ **CORS**: Environment-aware origin whitelist
✅ **Input Validation**: Express-validator on all inputs
✅ **File Validation**: Comprehensive file type and size checks
✅ **Error Handling**: Consistent, non-revealing error messages
✅ **Token Management**: JWT with expiration and refresh tokens
✅ **HTTPS Enforcement**: HSTS enabled for production
✅ **No Sensitive Data**: Error messages don't expose system details
✅ **Password Security**: Strong 12-character minimum policy with complexity requirements
✅ **Password Hashing**: bcrypt with 10 salt rounds
✅ **Password Reset**: Self-service password recovery with email verification
✅ **Password Change**: Authenticated password change with current password verification

## 9. Monitoring and Logging

All security-related events are logged:
- CORS requests (allowed/blocked)
- Rate limit violations
- File upload attempts and validations
- Authentication attempts
- Validation errors

## 10. Future Enhancements

- [ ] Implement Web Application Firewall (WAF)
- [ ] Add SQL injection prevention
- [ ] Implement request signing
- [ ] Add API key authentication
- [ ] Implement OAuth 2.0 support
- [ ] Add comprehensive audit logging
- [ ] Implement DDoS protection
- [ ] Add two-factor authentication (2FA)

## 11. Password Security Policy

### Password Requirements (Enhanced)
- **Minimum Length**: 12 characters (increased from 8)
- **Complexity Requirements**:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - At least one special character (!@#$%^&*)

### Password Hashing
- **Algorithm**: bcrypt with 10 salt rounds
- **Storage**: All passwords are hashed before storage
- **Validation**: Password complexity validated on both client and server
- **Broker Password Storage**: Centralized in Broker table (not duplicated across COI records)

### Password Reset/Recovery Flow
- **Self-Service Reset**: Users can reset passwords via email verification
- **Token Security**:
  - Cryptographically secure 32-byte random tokens
  - 1-hour expiration time
  - Single-use tokens (invalidated after successful reset)
  - **Timing-safe comparison**: Token validation uses `timingSafeEqual()` to prevent timing attacks
- **Email Notification**: Reset link sent to verified email address
- **Endpoints**:
  - `POST /auth/request-password-reset` - Request password reset email
  - `POST /auth/reset-password` - Reset password with token
- **User Types Supported**: Admin, GC, Broker (all user types can reset passwords)

### Password Change
- **Authenticated Users**: Can change password via user profile
- **Endpoint**: `POST /auth/change-password`
- **Requirements**: Must provide current password for verification
- **Validation**: New password must meet all complexity requirements

## 12. Token Security Enhancements

### Timing Attack Prevention
- **Token Comparison**: All token comparisons use `crypto.timingSafeEqual()` to prevent timing attacks
- **Affected Endpoints**:
  - `GET /public/coi-by-token` - COI lookup by token
  - `PATCH /public/coi-by-token` - COI update by token
  - `POST /public/broker-sign-coi` - Broker signature by token
- **Implementation**: Custom `timingSafeEqual()` helper function ensures constant-time string comparison

### Benefits
- Prevents information leakage about token validity through response timing
- Protects against brute-force token guessing attacks
- Complies with security best practices for sensitive token handling

## 13. Broker Authentication Architecture

### Centralized Password Storage
- **Broker Table**: Passwords stored in centralized `Broker` entity (not duplicated across COI records)
- **Benefits**:
  - Consistent password management across all COI records
  - Better performance (single password lookup vs. multiple COI scans)
  - Reduced data redundancy and storage overhead
  - Simplified password reset and update operations

### Data Migration
- **Automatic Migration**: On server startup, existing broker passwords from COI records are migrated to Broker table
- **Cleanup**: After migration, `broker_password` fields are removed from COI records
- **Helper Function**: `getOrCreateBroker()` ensures broker records exist before password operations

### Broker Authentication Flow
1. User enters email and password at broker login
2. System looks up broker in centralized Broker table
3. Password verified using bcrypt comparison (constant-time)
4. Authentication token issued on successful login

### Account Enumeration Prevention (Added Jan 2026)
- **Generic Error Messages**: Broker and GC login endpoints return generic "Invalid email or password" error
- **Constant-time Validation**: Always perform bcrypt comparison even for non-existent accounts
- **Prevents Information Leakage**: Attackers cannot determine if an email address is registered
- **Applied to Endpoints**:
  - `POST /public/broker-login` - Broker authentication
  - `POST /public/gc-login` - General contractor authentication
- **Security Benefit**: Prevents account enumeration attacks that could be used for phishing or targeted attacks

## 14. Path Traversal Protection

### File Access Validation (Added Jan 2026)
- **Filename Sanitization**: Use `path.basename()` to strip any directory components
- **Pattern Detection**: Reject filenames containing `..`, `/`, or `\` characters
- **Path Resolution Verification**: Verify resolved file path stays within UPLOADS_DIR
- **Affected Function**: `performExtraction()` - Handles PDF/document extraction
- **Security Benefit**: Prevents attackers from accessing files outside the uploads directory

### Implementation Details
```javascript
// Security: Prevent path traversal attacks
const sanitizedFilename = path.basename(filename);
if (sanitizedFilename !== filename || filename.includes('..') || 
    filename.includes('/') || filename.includes('\\')) {
  throw new Error('Invalid filename: path traversal detected');
}

// Additional security: Verify resolved path is within UPLOADS_DIR
const resolvedPath = path.resolve(filePath);
const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
if (!resolvedPath.startsWith(resolvedUploadsDir)) {
  throw new Error('Invalid file path: access denied');
}
```

### Protected Scenarios
- Prevents access to system files (e.g., `/etc/passwd`)
- Blocks directory traversal attempts (e.g., `../../sensitive-file`)
- Ensures all file access remains within designated upload directory
