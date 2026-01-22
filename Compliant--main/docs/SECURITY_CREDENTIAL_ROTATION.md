# Security: Credential Rotation Required

## ⚠️ CRITICAL: GIT HISTORY CLEANUP STILL REQUIRED

The `backend/.env` file containing sensitive credentials was previously committed to the repository and **MUST be removed from git history** using `git-filter-repo`. This PR stops tracking the file going forward, but **manual cleanup with force push is still required**.

## 🔐 Credentials That Must Be Rotated

The following credentials were exposed in the git history and **MUST be rotated immediately**:

### 1. JWT Secret
**Location:** `backend/.env`
**Variable:** `JWT_SECRET`
**Exposed Value:** `your-secret-key-change-in-production`

**Action Required:**
```bash
# Generate a new strong JWT secret (minimum 32 characters)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Update backend/.env with the new value:
JWT_SECRET=<new-generated-secret>
```

### 2. SMTP Credentials
**Location:** `backend/.env`
**Variables:** 
- `SMTP_USER=miriamsabel@insuretrack.onmicrosoft.com`
- `SMTP_PASS=260Hooper`
- `SMTP_FROM=miriamsabel@insuretrack.onmicrosoft.com`

**Action Required:**
1. **Change the Microsoft 365/Outlook password immediately** for the account `miriamsabel@insuretrack.onmicrosoft.com`
2. Update `backend/.env` with the new password:
   ```bash
   SMTP_PASS=<new-password>
   ```
3. Alternatively, create a dedicated service account with limited permissions for SMTP operations

### 3. Admin Email
**Location:** `backend/.env`
**Variable:** `ADMIN_EMAILS=miriamsabel@insuretrack.onmicrosoft.com`

**Action Required:**
- Review if this email should remain as the admin contact
- No immediate action required unless the email account is compromised

## 📋 Post-Merge Checklist

After this PR is merged, complete the following tasks:

- [ ] **Rotate JWT_SECRET** - Generate and deploy new secret
- [ ] **Change SMTP password** - Update Microsoft 365 password for the exposed account
- [ ] **Update production environment** - Deploy new credentials to all production environments
- [ ] **Update staging environment** - Deploy new credentials to staging
- [ ] **Verify deployment** - Test authentication and email functionality with new credentials
- [ ] **Document rotation** - Record the credential rotation in your security log
- [ ] **Review access logs** - Check if exposed credentials were accessed or used maliciously

## 🛡️ What This PR Does

1. 🔄 **Stops Tracking File**: Removes `backend/.env` from git tracking (git rm --cached)
2. ✅ **File Ignored**: The `.env` file will be ignored by git (via `.gitignore`)
3. ✅ **Example File Available**: `backend/.env.example` provides template without sensitive data
4. ✅ **Future Prevention**: `.gitignore` includes `.env` pattern to prevent future commits

## ⚠️ What Still Needs To Be Done

1. ❌ **Git History NOT Yet Cleaned**: The `backend/.env` file still exists in 10 commits in git history
2. ❌ **Force Push Required**: Manual `git-filter-repo` cleanup and force push is required to remove the file from history
3. ❌ **Credentials Still Exposed**: Until history is cleaned, the exposed credentials remain accessible in git history

## 🔍 Verification

To verify the current state:

```bash
# ❌ FAILS - File still exists in git history (should be empty after cleanup)
git log --all --full-history -- backend/.env

# ✅ PASSES - File is now ignored by git
git check-ignore backend/.env
# Output: backend/.env

# ✅ PASSES - File is no longer tracked (only .env.example should show)
git ls-files | grep "backend/.env"
# Expected: Only backend/.env.example
```

After the manual git-filter-repo cleanup and force push:

```bash
# ✅ Should return no results
git log --all --full-history -- backend/.env

# ❌ Should fail - file cannot be shown from history
git show HEAD:backend/.env
```

## ⚠️ Important Notes

1. **Force Push STILL Required**: This PR stops tracking the file, but manual `git-filter-repo` cleanup and force push is REQUIRED to remove from history
2. **History NOT Yet Rewritten**: Git history still contains the exposed credentials in 10 commits
3. **Team Coordination**: After the force push, inform all team members to re-clone or reset their local repositories
4. **CI/CD Updates**: Update any CI/CD pipelines with new credentials after rotation
5. **Backups**: If you have backups of the repository, ensure they are also updated or secured after cleanup
6. **Historical Access**: Anyone with access to the repository has the old credentials until history is cleaned

## 🔧 Manual Cleanup Steps Required

After this PR is merged, a repository administrator must:

1. **Install git-filter-repo**:
   ```bash
   pip install git-filter-repo
   ```

2. **Backup the repository** (optional but recommended):
   ```bash
   # Create a secure backup in a protected location
   git clone --bare https://github.com/miriamsabel1-lang/INsuretrack1234.git /secure/backup/location/INsuretrack1234.git
   # Ensure backup location has restricted permissions
   chmod 700 /secure/backup/location/INsuretrack1234.git
   ```

3. **Run git-filter-repo to remove backend/.env from all history**:
   ```bash
   git filter-repo --path backend/.env --invert-paths --force
   ```

4. **Force push the cleaned history**:
   ```bash
   # Verify the cleanup before pushing
   git log --all --full-history -- backend/.env  # Should be empty
   
   # Use --force-with-lease for safer force push (prevents overwriting others' work)
   git push origin --force-with-lease --all
   git push origin --force-with-lease --tags
   
   # If you're the only one working on the branch, you can use --force:
   # git push origin --force --all
   # git push origin --force --tags
   ```

5. **Verify the cleanup**:
   ```bash
   # Should return no results
   git log --all --full-history -- backend/.env
   
   # Should fail with error
   git show HEAD:backend/.env
   ```

## 📞 Questions or Issues?

If you have questions about credential rotation or need assistance:
1. Contact your security team
2. Review your organization's security incident response procedures
3. Consider this a security incident requiring proper documentation and response

## 🔐 Best Practices Going Forward

1. **Never commit `.env` files** - Always use `.env.example` as templates
2. **Use secrets management** - Consider using tools like:
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault
   - GitHub Secrets (for CI/CD)
3. **Regular rotation** - Rotate credentials regularly, not just when exposed
4. **Principle of least privilege** - Use dedicated service accounts with minimal permissions
5. **Pre-commit hooks** - Consider adding git hooks to prevent committing sensitive files
