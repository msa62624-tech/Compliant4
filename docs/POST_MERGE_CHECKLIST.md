# Post-Merge Checklist: Security Cleanup

## Overview

This PR stops tracking the `backend/.env` file going forward, but **DOES NOT remove it from git history**. The file contained sensitive credentials that were accidentally committed to the repository and remains in git history across 10 commits. **Manual cleanup with git-filter-repo and force push is still required**.

## ✅ What This PR Completes

1. **Stops Tracking File**: The `backend/.env` file has been removed from git tracking (git rm --cached)
2. **Security Documentation Created**: Comprehensive credential rotation guide added at `docs/SECURITY_CREDENTIAL_ROTATION.md`
3. **README Updated**: Added prominent security notice alerting users to required actions
4. **File Protection**: Verified `.gitignore` includes `.env` pattern to prevent future accidental commits
5. **Development File Preserved**: The `backend/.env` file still exists locally for development and is now properly ignored by git

## ❌ What Still Needs To Be Done

1. **Git History NOT Cleaned**: The `backend/.env` file still exists in 10 commits in the repository history
2. **Manual Cleanup Required**: A repository administrator must use `git-filter-repo` to remove the file from all history
3. **Force Push Required**: After running git-filter-repo, a force push is needed to update the remote repository
4. **Credentials Still Exposed**: Until the history cleanup is complete, exposed credentials remain accessible via git history

## 🚨 CRITICAL: Immediate Actions Required After Merge

After this PR is merged, the following actions **MUST be completed immediately**:

### 1. Rotate JWT Secret (5 minutes)
```bash
# Generate a new secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update backend/.env
JWT_SECRET=<new-generated-secret>

# Deploy to all environments
```

### 2. Change SMTP Password (10 minutes)
- Log into Microsoft 365 admin panel
- Change password for: `miriamsabel@insuretrack.onmicrosoft.com`
- Update `SMTP_PASS` in `backend/.env` with new password
- Test email functionality

### 3. Update All Environments (15 minutes)
- [ ] Update development environment variables
- [ ] Update staging environment variables
- [ ] Update production environment variables
- [ ] Update CI/CD secrets (if applicable)
- [ ] Restart all services with new credentials

### 4. Verify Deployment (10 minutes)
- [ ] Test JWT authentication with new secret
- [ ] Test email sending with new SMTP credentials
- [ ] Check application logs for any authentication errors
- [ ] Verify no old credentials are cached anywhere

### 5. Team Communication (5 minutes)
- [ ] Notify all team members of the credential rotation
- [ ] Inform team that git history has been rewritten
- [ ] Instruct team to re-clone or update their local repositories

## 📋 Complete Post-Merge Workflow

### Step 0: CRITICAL - Clean Git History (REQUIRED BEFORE OTHER STEPS)
**This must be done by a repository administrator IMMEDIATELY after merging:**

```bash
# Install git-filter-repo if not already installed
pip install git-filter-repo

# Create a secure temporary directory for cleanup
mkdir -p /tmp/secure-git-cleanup
chmod 700 /tmp/secure-git-cleanup
cd /tmp/secure-git-cleanup

# Clone a fresh copy of the repository
git clone https://github.com/miriamsabel1-lang/INsuretrack1234.git temp-cleanup
cd temp-cleanup

# Remove backend/.env from ALL git history
git filter-repo --path backend/.env --invert-paths --force

# Verify the cleanup before pushing
git log --all --full-history -- backend/.env  # Should be empty
git show HEAD:backend/.env  # Should fail

# Force push the cleaned history (REQUIRES ADMIN ACCESS)
# Use --force-with-lease for safer force push
git push origin --force-with-lease --all
git push origin --force-with-lease --tags

# If you're certain no one else is working on the branch:
# git push origin --force --all
# git push origin --force --tags

# Clean up securely
cd /tmp
rm -rf /tmp/secure-git-cleanup
```

⚠️ **WARNING**: Until this step is completed, the exposed credentials remain in git history!

### Step 1: Merge This PR
```bash
# On GitHub, merge the PR
# ⚠️ Note: This PR does NOT include the force push - that must be done manually in Step 0
```

### Step 2: Update Local Repositories (AFTER Step 0 is complete)
All team members must update their local repositories after the force push:
```bash
# Option A: Re-clone (recommended)
rm -rf INsuretrack1234
git clone https://github.com/miriamsabel1-lang/INsuretrack1234.git

# Option B: Reset existing repository
git fetch origin
git reset --hard origin/main  # or your default branch
```

### Step 3: Rotate Credentials
Follow the instructions in `docs/SECURITY_CREDENTIAL_ROTATION.md`:
```bash
# Read the full guide
cat docs/SECURITY_CREDENTIAL_ROTATION.md
```

### Step 4: Deploy New Credentials
```bash
# For each environment (dev, staging, prod):
# 1. Update environment variables
# 2. Restart services
# 3. Verify functionality
```

### Step 5: Verify Security (CRITICAL - Verify Step 0 was successful)
```bash
# ✅ MUST PASS - Verify .env is not in history (after git-filter-repo cleanup)
git log --all --full-history -- backend/.env
# Expected: No output (if this shows commits, Step 0 was not completed!)

# ✅ MUST PASS - Verify file cannot be retrieved from history
git show HEAD:backend/.env
# Expected: fatal: path 'backend/.env' does not exist

# ✅ Should pass - Verify .env is ignored
git check-ignore backend/.env
# Expected: backend/.env

# ✅ Should pass - Verify .env is not tracked
git ls-files | grep "backend/.env"
# Expected: Only backend/.env.example
```

⚠️ **If any of these verifications fail, the git-filter-repo cleanup was not completed properly!**

## 🔍 Exposed Credentials Summary

The following credentials ARE CURRENTLY EXPOSED in git history (across 10 commits):

| Credential | Value | Status | Action Required |
|------------|-------|--------|-----------------|
| JWT_SECRET | `your-secret-key-change-in-production` | ⚠️ EXPOSED | ✅ ROTATE - Generate new 64-byte hex string |
| SMTP_USER | `miriamsabel@insuretrack.onmicrosoft.com` | ⚠️ EXPOSED | ℹ️ INFO - Known email, no rotation needed |
| SMTP_PASS | `260Hooper` | ⚠️ EXPOSED | ✅ ROTATE - Change Microsoft 365 password IMMEDIATELY |
| SMTP_HOST | `smtp.office365.com` | ⚠️ EXPOSED | ℹ️ INFO - Public host, no rotation needed |
| ADMIN_EMAILS | `miriamsabel@insuretrack.onmicrosoft.com` | ⚠️ EXPOSED | ℹ️ INFO - Review if compromised |

## ⏰ Timeline

**IMMEDIATELY After Merging PR:**
- [ ] **CRITICAL**: Run git-filter-repo cleanup to remove backend/.env from history
- [ ] **CRITICAL**: Force push cleaned history to remote repository
- [ ] **CRITICAL**: Verify cleanup with verification commands

**After Force Push (Immediate 0-1 hour):**
- **Immediate (0-1 hour)**: Rotate JWT_SECRET and SMTP_PASS
- **Within 24 hours**: Update all environments and verify
- **Within 48 hours**: Complete team communication and verification
- **Within 1 week**: Review security logs and document incident

## 📞 Questions?

For questions or issues:
1. Review `docs/SECURITY_CREDENTIAL_ROTATION.md` for detailed instructions
2. Contact your security team or repository administrator
3. Treat this as a security incident if there are any concerns

## 🎯 Success Criteria

This security cleanup is complete when:
- [ ] **Git history cleaned**: `git log --all --full-history -- backend/.env` returns no results
- [ ] **Force push completed**: Cleaned history pushed to remote repository
- [ ] All exposed credentials have been rotated
- [ ] New credentials deployed to all environments
- [ ] All services verified working with new credentials
- [ ] All team members have updated their local repositories after force push
- [ ] Security incident documented (if required by your org)
- [ ] No exposed credentials remain in active use

## 📝 Notes

- **Force Push REQUIRED**: This PR stops tracking the file, but manual git-filter-repo cleanup and force push is REQUIRED
- **History NOT Yet Rewritten**: Until git-filter-repo is run, commit hashes remain unchanged and credentials remain exposed
- **No Data Loss Expected**: All code and functionality will remain intact; only `.env` file will be removed from history
- **Future Prevention**: `.gitignore` ensures `.env` files won't be committed again
- **Development Impact**: Developers will need to recreate their `backend/.env` from `backend/.env.example`
