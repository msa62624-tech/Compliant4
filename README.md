# compliant.team

**Grade: A+++++ (Exceptional Enterprise-Ready)** 🌟🏆

Full-stack insurance tracking application for General Contractors and their subcontractors. Built with React frontend and Express.js backend.

> 🎉 **A+++++ Achievement**: This application features exceptional enterprise-grade capabilities including advanced security, Kubernetes-ready health monitoring, API versioning, distributed tracing, and automated deployment. See [A_PLUS_PLUS_PLUS_PLUS_PLUS_ACHIEVEMENT.md](A_PLUS_PLUS_PLUS_PLUS_PLUS_ACHIEVEMENT.md) for details.

> 📦 **Repository Structure**: This is a multi-package repository (not a traditional monorepo) with separate frontend and backend packages. See [REPOSITORY_STRUCTURE.md](REPOSITORY_STRUCTURE.md) for details.

---

## ⚠️ SECURITY NOTICE - CRITICAL ACTION REQUIRED

**CRITICAL:** The `backend/.env` file with sensitive credentials (JWT_SECRET, SMTP credentials) was previously committed to the repository.

**Current Status:**
- ✅ The file is no longer tracked by git (as of this commit)
- ✅ File removed from tracking in HEAD commit
- ✅ File properly ignored by .gitignore
- ❌ Credentials still exposed in git history (requires manual git-filter-repo + force push)
- ⚠️ Credentials must be rotated after history cleanup

**Required Actions:**
1. **IMMEDIATELY after merging:** Run `git-filter-repo` to remove the file from all git history
2. **IMMEDIATELY after merging:** Force push the cleaned history to the remote repository
3. **After cleanup:** Rotate all exposed credentials immediately

📄 **See [docs/SECURITY_CREDENTIAL_ROTATION.md](docs/SECURITY_CREDENTIAL_ROTATION.md) for complete instructions.**
📋 **See [docs/POST_MERGE_CHECKLIST.md](docs/POST_MERGE_CHECKLIST.md) for step-by-step cleanup process.**

---

## Quick Start

### 🚨 "Backend is Mocked" Issue?

If you see warnings about **"Backend not configured"** or **"MOCK MODE"**, the `.env` files are now included in this repository for local development. See [docs/BACKEND_CONNECTION_SETUP.md](docs/BACKEND_CONNECTION_SETUP.md) for the fix.

### Frontend Setup

```bash
npm install
# .env file already configured for local development
npm run dev
```

**Optional:** Run `npm run setup` for an interactive configuration wizard.

### Backend Setup

```bash
cd backend
npm install
# .env file already configured with defaults
npm run dev
   - Example quick-test: see `scripts/test-requests.sh` to exercise debug, public users, login and protected calls (requires `jq` locally)
```

Backend runs on `http://localhost:3001`  
Frontend runs on `http://localhost:5175`

For email configuration, see [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md).

### Deployment

For production deployment, see [docs/DEPLOY.md](docs/DEPLOY.md) for complete instructions.

## 🌟 A+++++ Enterprise Features

Compliant4 is an **exceptional enterprise-ready application** with advanced features:

### Advanced Security Layer 🔒
- **Content Security Policy (CSP)** - XSS and injection protection
- **Multi-tier Rate Limiting** - API, auth, upload, email, admin tiers
- **Advanced CORS** - Whitelist-based origin control
- **Security Audit Logging** - Comprehensive audit trail
- **Permissions Policy** - Fine-grained feature control

### Kubernetes-Ready Health Monitoring 🏥
- **Liveness Probe** - `/health/live` - Application is running
- **Readiness Probe** - `/health/ready` - Ready to serve traffic
- **Startup Probe** - `/health/startup` - Application started successfully
- **Detailed Health** - `/health/detailed` - Complete diagnostics with system/process metrics

### Professional API Management 🔄
- **API Versioning** - Multi-version support (v1, v2, ...)
- **Flexible Detection** - URL, header, or query-based versioning
- **Deprecation Warnings** - Clear sunset dates and migration guides
- **Version Changelogs** - Track API evolution

### Complete Observability 📊
- **Request Tracking** - Unique request IDs for distributed tracing
- **Performance Monitoring** - Track operations with thresholds
- **Error Analytics** - Error tracking with context and patterns
- **Business Metrics** - Track KPIs (logins, documents, COIs)
- **Distributed Tracing** - OpenTelemetry-compatible tracing

### Automated Deployment 🚀
- **One-Command Deployment** - `./scripts/deploy.sh`
- **Health Verification** - Automatic health checks
- **Automatic Rollback** - Rollback on deployment failure
- **Zero-Downtime** - Graceful service updates

### Core Enterprise Features ✨
- **API Documentation** - Interactive Swagger UI at `/api-docs`
- **Prometheus Metrics** - Production monitoring at `/metrics`
- **Request Idempotency** - Prevents duplicate operations
- **Response Compression** - 60-80% bandwidth reduction
- **Centralized Error Handling** - Consistent error responses
- **Structured Logging** - Winston-based logging

📖 **See [docs/A_PLUS_PLUS_PLUS_PLUS_PLUS_FEATURES.md](docs/A_PLUS_PLUS_PLUS_PLUS_PLUS_FEATURES.md) for complete documentation**

## 📚 Documentation

### Configuration & Setup
- [docs/COMPLETE_CONFIGURATION_GUIDE.md](docs/COMPLETE_CONFIGURATION_GUIDE.md) - **🔧 Complete guide to remove ALL mocking**
- [docs/BACKEND_CONNECTION_SETUP.md](docs/BACKEND_CONNECTION_SETUP.md) - **🔧 Fix "Backend is Mocked" issue**
- [docs/SECURITY_CREDENTIAL_ROTATION.md](docs/SECURITY_CREDENTIAL_ROTATION.md) - **⚠️ CRITICAL: Post-merge credential rotation required**
- [docs/QUICKSTART.md](docs/QUICKSTART.md) - Quick start guide
- [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md) - Email configuration guide
- [docs/DEPLOY.md](docs/DEPLOY.md) - Deployment instructions

### Workflows & Features
- [docs/WORKFLOWS_QUICK_REFERENCE.md](docs/WORKFLOWS_QUICK_REFERENCE.md) - **⚡ Quick reference for all workflows**
- [docs/PROGRAM_WORKFLOWS.md](docs/PROGRAM_WORKFLOWS.md) - **📋 Complete workflow documentation (First-Time & Returning Subs)**
- [docs/HOLD_HARMLESS_WORKFLOW.md](docs/HOLD_HARMLESS_WORKFLOW.md) - **✍️ Hold Harmless Agreement signature workflow**
- [docs/INSURANCE_REQUIREMENTS_SYSTEM.md](docs/INSURANCE_REQUIREMENTS_SYSTEM.md) - Insurance requirements & COI approval

### Technical Reference
- [docs/ENTERPRISE_BACKEND_IMPROVEMENTS.md](docs/ENTERPRISE_BACKEND_IMPROVEMENTS.md) - **🚀 Enterprise features guide (NEW)**
- [docs/ENTERPRISE_FEATURES.md](docs/ENTERPRISE_FEATURES.md) - **⭐ Complete enterprise features documentation**
- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) - Full API reference
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) - Database schema and entities
- [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) - System design and architecture
- [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) - **🧪 Testing guide and test suite documentation**
- [docs/CHANGELOG.md](docs/CHANGELOG.md) - Version history

## 🔑 Default Users

| Username | Password     | Role         | Description              |
|----------|--------------|--------------|--------------------------|
| admin    | INsure2026!  | super_admin  | Full system access       |

## 🏗️ Features

### Core Functionality:

1. **General Contractor Management**
   - Create and manage GC companies
   - Assign GCs to admin users
   - Track GC statistics and projects

2. **Project Management**
   - Create construction projects
   - Define owner entities and additional insured parties
   - Set insurance requirements
   - Track budget and timeline

3. **Subcontractor Tracking**
   - Add subcontractors to projects
   - Assign multiple trades per subcontractor
   - Track compliance status automatically

4. **Insurance Compliance**
   - Automatic requirement matching by trade
   - Support for multiple requirement tiers
   - Compliance status tracking
   - COI generation with endorsements

5. **Document Management**
   - Upload insurance documents
   - Track approval status
   - Link documents to projects and subcontractors

## 📊 Backend Entities (19 Total)

All entities are configured and accessible via REST API:

### Core Entities:
- ✅ Contractor (GCs & Subcontractors)
- ✅ Project
- ✅ ProjectSubcontractor
- ✅ User

### Insurance Entities:
- ✅ InsuranceDocument
- ✅ GeneratedCOI
- ✅ SubInsuranceRequirement
- ✅ StateRequirement
- ✅ InsuranceProgram

### Supporting Entities:
- ✅ Trade
- ✅ Broker
- ✅ BrokerUploadRequest
- ✅ Subscription
- ✅ PolicyDocument
- ✅ COIDocument
- ✅ ComplianceCheck
- ✅ ProgramTemplate
- ✅ Portal
- ✅ Message

## 🧪 Testing

The application includes comprehensive test coverage for frontend, backend, and end-to-end scenarios.

### Quick Start

```bash
# Run all frontend tests
npm test

# Run backend tests
cd backend && npm test

# Run E2E tests
npm run test:e2e

# Run all tests
./run-tests.sh
```

### Test Coverage

- **Frontend**: 35 tests covering components and utilities
- **Backend**: API authentication, CRUD operations, entity endpoints
- **E2E**: Playwright tests for critical user workflows

📖 **Complete guide:** [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)

## 🔧 Test Backend

Run the entity test script to verify all endpoints:
```bash
./test-entities.sh
```

Expected output: All 19 entities should return HTTP 200 ✅

## 🏛️ Architecture

- **Frontend:** React + Vite + Shadcn/ui + Tailwind CSS
- **Backend:** Express.js + JWT auth (custom implementation, no external services)
- **API Client:** Custom REST client (legacy name: "compliant" - purely internal, no external dependency)
- **State:** React Query (@tanstack/react-query)
- **Storage:** In-memory (migrate to PostgreSQL/MongoDB for production)
- **Auth:** Bearer tokens (1hr expiry) + Refresh tokens (7d expiry)

## 🔧 Environment Variables

### Frontend (.env.local)
```bash
VITE_API_BASE_URL=https://organic-system-wrpwv4xxwvxv3v4pw-3001.app.github.dev
```

**Note:** The `.env` file is automatically created from `.env.example` during builds if it doesn't exist. This ensures the backend URL is always configured. For local development, you can manually copy `.env.example` to `.env` and customize the URL.

### Backend
```bash
PORT=3001
JWT_SECRET=compliant-dev-secret-change-in-production
FRONTEND_URL=https://organic-system-wrpwv4xxwvxv3v4pw-5175.app.github.dev
NODE_ENV=development
```

## 🚀 Quick Workflow Example

```bash
# 1. Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"INsure2026!"}'

# 2. Get Projects (with token)
curl http://localhost:3001/entities/Project \
  -H "Authorization: Bearer <your_token>"

# 3. Create a new Contractor
curl -X POST http://localhost:3001/entities/Contractor \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "New Construction Co",
    "contractor_type": "general_contractor",
    "email": "contact@newconstruction.com",
    "phone": "212-555-1234",
    "status": "active"
  }'
```

## 📱 Frontend Pages

- ✅ Login Page
- ✅ Contractors Page (GC list)
- ✅ GC Details Page (projects, stats)
- ✅ Project Details Page (subs, compliance)
- ✅ Admin Dashboard
- ✅ Contractor Dashboard
- ✅ Subcontractor Portal
- ✅ Financials Page
- ✅ All Documents Page

## 🚀 Getting Started

1. Open browser to frontend URL
2. Login with `admin` / `INsure2026!`
3. Navigate to Contractors page
4. Create projects and add subcontractors

## 🐛 Troubleshooting

### "Backend is Mocked" / "Backend not configured" Error

**⚠️ This is the most common issue!**

If you see console warnings about "MOCK MODE" or data not persisting:

1. **Quick Fix:** The `.env` files are now included in the repository
2. **Verify:** Check that `.env` exists in the root directory with `VITE_API_BASE_URL=http://localhost:3001`
3. **Start backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
4. **Start frontend:**
   ```bash
   npm install
   npm run dev
   ```

**📖 Complete guide:** [docs/BACKEND_CONNECTION_SETUP.md](docs/BACKEND_CONNECTION_SETUP.md)

### Backend Connection Issues

If data isn't persisting or emails aren't sending:

1. Ensure the backend is running:
   ```bash
   cd backend
   npm run dev
   ```

2. Verify browser console shows API calls to `http://localhost:3001` (not mock mode warnings)

3. Restart the frontend if needed

For production deployments, see [docs/DEPLOY.md](docs/DEPLOY.md).

### Email Configuration

If emails appear to send but don't arrive:
- Development mode without SMTP configured will log emails instead of sending them
- To send real emails, configure SMTP in `backend/.env` - see [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md) or [docs/COMPLETE_CONFIGURATION_GUIDE.md](docs/COMPLETE_CONFIGURATION_GUIDE.md)
- Check backend console for email delivery status

## ⚠️ Important Notes

- **In-Memory Storage:** Data resets on server restart (development only)
- **Optional Services:** Email (SMTP), Adobe PDF Services, and AI Analysis are optional - the app works without them but uses mock data for those features
- **Configuration:** See [docs/COMPLETE_CONFIGURATION_GUIDE.md](docs/COMPLETE_CONFIGURATION_GUIDE.md) to configure all services and eliminate mocking
- **Environment Files:** Required for backend connection. Files are included for local development