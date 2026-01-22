# Compliant System Reliance Analysis

**Date:** January 15, 2026  
**Question:** "Any reliance on the compliant system?"  
**Answer:** **NO** - There is no external reliance on any compliant system.

## Executive Summary

The INsuretrack application **does not depend on any external compliant system or service**. All references to "compliant" in the codebase are **internal naming conventions** that refer to a custom-built REST API client.

## Historical Context

Based on code comments and structure:

1. **Original State:** The application previously used an external `@compliant/sdk` package
2. **Migration:** The external dependency was removed and replaced with a custom implementation
3. **Current State:** All "compliant" references point to local code in `src/api/compliantClient.js`

Evidence from `src/compliantClient.js`:
```javascript
// Note: original dependency on @compliant/sdk removed. This file re-exports
// a lightweight local shim at `src/api/compliantClient.js` to avoid needing
// the external SDK in development or for CI where the service is unavailable.
```

## Dependency Analysis

### Package Dependencies
- ✅ **No @compliant/sdk** in `package.json` dependencies
- ✅ **No @compliant/sdk** in `package-lock.json`
- ✅ **No compliant-related packages** found via `npm list`

### Current Implementation

The "compliant" object is a **local API client adapter** located at:
- **Primary Implementation:** `src/api/compliantClient.js` (372 lines)
- **Re-export Wrapper:** `src/compliantClient.js` (6 lines)

### What "compliant" Actually Does

The `compliant` object in `src/api/compliantClient.js` is a custom REST API client that:

1. **Connects to the custom Express.js backend** at `backend/server.js`
2. **Provides entity CRUD operations** (list, filter, read, update, create, delete)
3. **Handles authentication** (login, token management, refresh tokens)
4. **Provides integration methods** (email, file upload, LLM, Adobe Sign)
5. **Falls back to mock mode** when backend is not configured

### Architecture

```
Frontend Components
       ↓
import { compliant } from '@/api/compliantClient'
       ↓
src/api/compliantClient.js (custom REST client)
       ↓
HTTP Requests (fetch)
       ↓
backend/server.js (custom Express.js API)
       ↓
In-memory data store (to be migrated to PostgreSQL/MongoDB)
```

## Code Usage Patterns

The `compliant` client is imported and used throughout the frontend in **48+ component files**:

### Authentication
```javascript
const user = await compliant.auth.me();
```

### Entity Operations
```javascript
const projects = await compliant.entities.Project.list();
const contractors = await compliant.entities.Contractor.filter({ status: 'active' });
const newProject = await compliant.entities.Project.create(data);
await compliant.entities.Project.update(id, updates);
```

### Integrations
```javascript
await compliant.integrations.Core.SendEmail(payload);
await compliant.integrations.Core.UploadFile({ file });
await compliant.integrations.Core.InvokeLLM(prompt);
```

## Files Using "compliant" (Sample)

Primary implementation:
- `src/api/compliantClient.js` - Custom REST API client implementation
- `src/compliantClient.js` - Re-export wrapper

Entity re-exports:
- `src/entities.js` - Re-exports entity adapters
- `src/integrations.js` - Re-exports integration methods

Component usage (48+ files):
- `src/components/GCProjects.jsx`
- `src/components/ProjectDetails.jsx`
- `src/components/SubcontractorPortal.jsx`
- `src/components/ComplianceReview.jsx`
- And many more...

## Backend Configuration

The compliant client connects to the backend via environment variable:
- **Environment Variable:** `VITE_API_BASE_URL`
- **Default (dev):** Auto-detected from window.location (Codespaces/localhost)
- **Production:** Set in deployment environment (Vercel/Netlify/Render)

Example configuration:
```bash
VITE_API_BASE_URL=https://your-backend.vercel.app
```

## Mock Mode Behavior

When `VITE_API_BASE_URL` is not configured, the client operates in **mock mode**:
- Read operations return empty arrays/objects
- Create operations throw errors with configuration instructions
- Console warnings alert developers to configuration issues

This is **intentional development fallback**, not an external service dependency.

## Conclusion

**There is ZERO reliance on any external compliant system.**

The "compliant" naming throughout the codebase is purely a **legacy naming convention** that refers to the internal REST API client. The application has full control over this code and has no external dependencies on compliant services, SDKs, or platforms.

### Recommendations

1. ✅ **No action required** - The current implementation is self-contained
2. 💡 **Optional:** Consider renaming `compliant` to `apiClient` or `insuretrackClient` to avoid confusion
3. 💡 **Optional:** Update documentation to clarify the naming is legacy/internal

### Related Documentation

- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Details on the REST API
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - System design overview
- [DEPLOY.md](./DEPLOY.md) - Deployment and environment configuration
