# Changelog

All notable changes to the INsureTrack project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project follows semantic versioning.

---

## [Unreleased]

### In Progress
- Phase 2 component integration (see [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md))

---

## [2.0.0] - 2026-01-12

### 🎉 Major Update: Phase 2 Components Complete

This release includes all Phase 2 advanced features and comprehensive status documentation. **All Phase 2 components are built and ready for integration.**

### Added

#### New Components (7 files, 2,800+ lines)
- **TradeSelectionComponent.jsx** - Multi-trade selection with tier display and inline requirements preview
- **ProjectRequirementsManager.jsx** - Upload and manage insurance requirement PDFs by tier (1, 2, 3)
- **ProjectRequirementsViewer.jsx** - Filter and view tier-specific requirements by trade
- **AdminCOIApprovalDashboard.jsx** - Centralized COI approval interface with pending/approved/correction tabs
- **insuranceRequirements.js** - 3-tier trade system with automatic compliance validation
- **coiNotifications.js** - Comprehensive notification system for Admin, Sub, Broker, and GC
- **notificationLinkBuilder.js** - Centralized portal link generation with 20+ link methods

#### New Documentation (12 files)
- **STATUS.md** - Complete system status with what's complete and what's pending
- **INTEGRATION_STATUS.md** - Detailed Phase 2 integration checklist with 6 integration tasks
- **INSURANCE_REQUIREMENTS_SYSTEM.md** - Technical reference for insurance requirement matching (650 lines)
- **IMPLEMENTATION_SUMMARY.md** - Implementation overview and code examples (400 lines)
- **QUICK_REFERENCE.md** - Quick reference for developers (250 lines)
- **SYSTEM_ARCHITECTURE.md** - System architecture documentation (300 lines)
- **NEW_FILES_REFERENCE.md** - File-by-file breakdown of new components (350 lines)
- **PROJECT_COMPLETION.md** - Phase 2 delivery documentation
- **PHASE_2_COMPLETION.md** - Phase 2 completion details
- **PHASE_2_DELIVERY.md** - Delivery guide
- **PHASE_2_INDEX.md** - Index of Phase 2 documentation
- **PHASE_2_QUICK_START.md** - Quick start guide for Phase 2

### Updated
- **README.md** - Added links to STATUS.md and INTEGRATION_STATUS.md
- **All deployment documentation** - Updated dates from January 11 to January 12, 2026
- **All Phase 2 documentation** - Updated status fields to "Components Complete - Integration Pending"

### Status Summary
- ✅ **Phase 1:** 100% Complete and Production Ready
  - Backend API with 19 entities
  - Authentication system (JWT)
  - Frontend routing and pages
  - Core dashboards (Admin, GC, Broker, Subcontractor)
  - Document upload and management
  
- ✅ **Phase 2:** 100% Built, Ready for Integration
  - All 7 components compile without errors
  - 12 comprehensive documentation files
  - Integration checklist prepared
  - Estimated integration time: 2-3 weeks

---

## [1.5.0] - 2026-01-12

### Added
- Enhanced notification system with passwordless portal access
- Policy expiry monitoring and notifications
- Broker assignment notification workflows

### Fixed
- Deployment configuration for Netlify/Vercel
- CORS vulnerability in backend (replaced unsafe `includes()` with proper domain validation)
- Backend GET endpoint to support entity read by ID
- Hardcoded URLs removed from frontend

### Documentation
- DEPLOYMENT_TROUBLESHOOTING.md
- DEPLOYMENT_QUICKSTART.md
- Added troubleshooting section to README.md

---

## [1.0.0] - 2026-01-11

### Added
- Initial release with complete Phase 1 features
- Backend API with 19 entities
- Authentication system using JWT
- Admin dashboard with statistics
- General Contractor management and dashboard
- Subcontractor tracking and portal
- Broker dashboard and portal
- Document upload and management system
- Basic COI (Certificate of Insurance) review workflow
- Email notification system
- React frontend with Vite
- Express.js backend
- In-memory database for development

### Testing
- Test infrastructure for GitHub Actions
- Vitest with React Testing Library (frontend)
- Node.js built-in test runner (backend)
- Entity test scripts

---

## How to Check What's New

1. **Latest Status:** See [STATUS.md](STATUS.md) for current system state
2. **Integration Progress:** See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md) for Phase 2 integration checklist
3. **Recent PRs:** Check [GitHub Pull Requests](https://github.com/miriamsabel1-lang/INsuretrack1234/pulls?q=is%3Apr+is%3Aclosed)
4. **Commit History:** Run `git log --oneline` to see recent commits

---

## Links

- **Documentation:** See [README.md](README.md) for full documentation index
- **Quick Start:** See [QUICK_START_CHECKLIST.md](QUICK_START_CHECKLIST.md)
- **Deployment:** See [DEPLOY.md](DEPLOY.md)
- **API Reference:** See [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

---

## Need Help?

If you can't see the updates in your local repository:

1. **Pull latest changes:**
   ```bash
   git fetch origin
   git pull origin main
   ```

2. **Check current branch:**
   ```bash
   git branch
   git status
   ```

3. **View recent commits:**
   ```bash
   git log --oneline -10
   ```

4. **If you're on GitHub:** The updates are visible on the main branch. Make sure you're viewing the correct branch.

---

*For detailed commit history, run `git log` or check the [GitHub repository](https://github.com/miriamsabel1-lang/INsuretrack1234/commits).*
