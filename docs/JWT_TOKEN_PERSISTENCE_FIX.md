# JWT Token Persistence Fix - Summary

## Problem Statement
Users were experiencing "Invalid or expired token" errors when creating contractors or submitting data:

```
ERROR❌ Error creating contractor: Error: {"success":false,"error":"Invalid or expired token","timestamp":"2026-01-22T22:58:49.773Z"}
ERROR❌ Submit error: Error: {"success":false,"error":"Invalid or expired token","timestamp":"2026-01-22T22:58:49.773Z"}
```

## Root Cause Analysis

### Primary Issue: JWT_SECRET Not Persisted
In development mode, when the backend server restarted:
1. The JWT_SECRET environment variable was not set
2. Server would use a hardcoded default value: `'compliant-dev-secret-change-in-production'`
3. However, the code did not guarantee the **same** secret across restarts
4. Tokens signed with the old secret became invalid after restart
5. Users received "Invalid or expired token" errors

### Secondary Issue: Double Login (Already Fixed)
The double login issue was previously fixed in PR #19 by implementing an in-memory storage fallback in `src/auth.js`. This fix continues to work correctly.

## Solution Implemented

### JWT_SECRET Persistence Mechanism
Modified `backend/server.js` to implement a three-tier JWT_SECRET loading strategy:

```javascript
const JWT_SECRET = (() => {
  // Priority 1: Use environment variable if set (production)
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  
  // Priority 2: Require JWT_SECRET in production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  
  // Priority 3: Load or generate persistent secret for development
  try {
    // Load existing secret from file
    if (fs.existsSync(JWT_SECRET_FILE)) {
      const secret = fs.readFileSync(JWT_SECRET_FILE, 'utf8').trim();
      if (secret) {
        return secret;
      }
    }
    
    // Generate new secure random secret and persist it
    const newSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(JWT_SECRET_FILE, newSecret, { mode: 0o600 });
    return newSecret;
  } catch (err) {
    // Fallback to hardcoded default
    return 'compliant-dev-secret-change-in-production';
  }
})();
```

### Key Features
1. **Production Safety**: Requires explicit JWT_SECRET environment variable in production
2. **Development Persistence**: Generates and persists a secure random secret for development
3. **Security**: Secret file has 0o600 permissions (owner read/write only)
4. **Gitignored**: The `.jwt-secret` file is excluded from version control
5. **Backward Compatible**: Falls back to hardcoded default if file operations fail

## Files Modified
1. `backend/server.js` - Added JWT_SECRET persistence logic
2. `.gitignore` - Added `backend/data/.jwt-secret` to prevent committing secrets

## Testing Results

### Test 1: Token Persistence Across Restarts
✅ **PASSED**
- Login generates valid token
- Contractor can be created with token
- Server restarts
- **Same token still works after restart**
- Contractor creation succeeds with old token

### Test 2: Double Login Issue
✅ **PASSED**
- Single login successful
- Contractor creation works immediately (no second login needed)
- Memory storage fallback confirmed working

### Test 3: Security Scan
✅ **PASSED**
- CodeQL analysis: 0 alerts
- No vulnerabilities introduced

## How It Works

### First Server Start
```
1. No JWT_SECRET environment variable found
2. Check for existing secret file: NOT FOUND
3. Generate new random secret (64 hex characters)
4. Save to backend/data/.jwt-secret with 0o600 permissions
5. Use this secret for token signing
```

### Subsequent Server Starts
```
1. No JWT_SECRET environment variable found
2. Check for existing secret file: FOUND
3. Load secret from file
4. Use this secret for token signing
→ All tokens signed with this secret remain valid!
```

### Production Deployment
```
1. JWT_SECRET environment variable is set
2. Use environment variable value
3. No file persistence needed
→ Cloud providers handle secret management
```

## Security Considerations

### Security Analysis ✅
- JWT secret file has restrictive permissions (0o600)
- File is gitignored to prevent accidental commits
- Production requires explicit environment variable
- Crypto.randomBytes provides cryptographically secure randomness
- CodeQL security scan passed with 0 alerts

### Best Practices
1. **Production**: Always set `JWT_SECRET` environment variable
2. **Development**: Let the system auto-generate and persist the secret
3. **Never commit**: The `.jwt-secret` file to version control
4. **Rotate secrets**: Periodically in production environments

## Deployment Guide

### Local Development
No action needed! The system will automatically:
1. Generate a secure random JWT_SECRET on first start
2. Persist it to `backend/data/.jwt-secret`
3. Reuse it on subsequent starts

### Production Deployment (Vercel/Render/Netlify)
Set the `JWT_SECRET` environment variable in your deployment dashboard:
```bash
JWT_SECRET=your-secure-random-secret-here
```

Generate a secure secret with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Migration Notes

### Existing Deployments
If you already have a deployed instance:
1. Users will need to log in again after this update
2. Their old tokens will be invalidated (one-time occurrence)
3. After login, tokens will persist across server restarts

### Fresh Deployments
No impact - everything will work seamlessly from the start.

## Verification Checklist
- [x] JWT_SECRET is persisted to file in development
- [x] Tokens remain valid across server restarts
- [x] Production requires explicit JWT_SECRET environment variable
- [x] Secret file is gitignored
- [x] File permissions are restrictive (0o600)
- [x] Double login fix continues to work
- [x] CodeQL security scan passed
- [x] Test suite passed

## Conclusion
This fix ensures that authentication tokens remain valid across server restarts in development environments, eliminating the "Invalid or expired token" errors. The solution is secure, production-ready, and maintains backward compatibility with the existing double login fix.

---

**Status**: ✅ Complete and verified  
**Security**: ✅ CodeQL passed (0 alerts)  
**Tests**: ✅ All tests passed  
**Double Login**: ✅ Verified working  
