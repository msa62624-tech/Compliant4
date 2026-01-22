# compliant.team

Full-stack insurance tracking application for General Contractors and their subcontractors. Built with React frontend and Express.js backend.

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
```

Backend runs on `http://localhost:3001`  
Frontend runs on `http://localhost:5173`

For email configuration, see [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md).

### Deployment

For production deployment, see [docs/DEPLOY.md](docs/DEPLOY.md) for complete instructions.

## 📚 Documentation

- [docs/COMPLETE_CONFIGURATION_GUIDE.md](docs/COMPLETE_CONFIGURATION_GUIDE.md) - **🔧 Complete guide to remove ALL mocking**
- [docs/BACKEND_CONNECTION_SETUP.md](docs/BACKEND_CONNECTION_SETUP.md) - **🔧 Fix "Backend is Mocked" issue**
- [docs/SECURITY_CREDENTIAL_ROTATION.md](docs/SECURITY_CREDENTIAL_ROTATION.md) - **⚠️ CRITICAL: Post-merge credential rotation required**
- [docs/QUICKSTART.md](docs/QUICKSTART.md) - Quick start guide
- [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md) - Email configuration guide
- [docs/DEPLOY.md](docs/DEPLOY.md) - Deployment instructions
- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) - Full API reference
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) - Database schema and entities
- [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) - System design and architecture
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

## 🧪 Test Backend

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
FRONTEND_URL=https://organic-system-wrpwv4xxwvxv3v4pw-5174.app.github.dev
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