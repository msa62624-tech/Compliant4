# Workflow Management Guide

## Overview

This guide provides best practices and troubleshooting steps for managing GitHub Actions workflows in the Compliant4 repository.

## Preventing Stuck Workflows

### 1. Workflow Timeout Configuration

To prevent workflows from running indefinitely, always add timeout settings:

```yaml
jobs:
  your-job:
    timeout-minutes: 30  # Maximum time for the entire job
    steps:
      - name: Your Step
        timeout-minutes: 15  # Maximum time for individual step
```

### 2. Recommended Timeout Values

| Workflow Type | Job Timeout | Step Timeout |
|--------------|-------------|--------------|
| Tests | 15 minutes | 10 minutes |
| Build | 20 minutes | 15 minutes |
| Deploy | 30 minutes | 20 minutes |
| Code Analysis | 30 minutes | 20 minutes |
| Copilot Agent | 45 minutes | 30 minutes |

## Troubleshooting Stuck Workflows

### Identifying Stuck Workflows

1. Go to Actions tab: https://github.com/msa62624-tech/Compliant4/actions
2. Look for workflows with status "in progress" for >30 minutes
3. Check the workflow run details to see which step is stuck

### Cancelling Stuck Workflows

**Manual Cancellation:**
1. Navigate to the workflow run page
2. Click "Cancel workflow" button (top right)
3. Confirm cancellation

**Via GitHub CLI:**
```bash
# Install GitHub CLI if not already installed
gh auth login

# Cancel a specific workflow run
gh run cancel <run-id> --repo msa62624-tech/Compliant4

# Example: Cancel run 21447181990
gh run cancel 21447181990 --repo msa62624-tech/Compliant4
```

**Via API (requires token):**
```bash
curl -X POST \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/msa62624-tech/Compliant4/actions/runs/<run-id>/cancel
```

### Common Causes of Stuck Workflows

1. **Long-Running Operations**
   - Large codebases being analyzed
   - Complex refactoring tasks
   - Extensive test suites

2. **Resource Exhaustion**
   - Out of memory errors
   - CPU throttling
   - Disk space issues

3. **Network Issues**
   - API timeouts
   - External service unavailability
   - DNS resolution failures

4. **Configuration Issues**
   - Missing required secrets/variables
   - Invalid workflow syntax
   - Circular dependencies

## Best Practices for Large Changes

### Breaking Down Large PRs

Instead of one massive PR (like PR #78 with 500+ line changes), create multiple smaller PRs:

**Example: Enterprise-Grade Refactoring**
- PR 1: Backend logging (server.js only)
- PR 2: Backend services logging
- PR 3: Backend integrations logging
- PR 4: Frontend authentication logging
- PR 5: Frontend API client logging
- PR 6: Frontend component logging
- PR 7: Security improvements
- PR 8: Documentation updates

**Benefits:**
- ✅ Faster code reviews
- ✅ Easier to test and validate
- ✅ Less likely to cause workflow timeouts
- ✅ Easier to rollback if issues occur
- ✅ Parallel development possible

### Progress Reporting Strategy

For long-running tasks:
1. Commit frequently (every 15-30 minutes)
2. Update PR description with progress checklist
3. Use draft PRs for work-in-progress
4. Add comments explaining complex changes
5. Run tests locally before pushing

## Workflow Monitoring

### Check Workflow Status

**Command Line:**
```bash
# List recent workflow runs
gh run list --repo msa62624-tech/Compliant4 --limit 10

# View specific run
gh run view <run-id> --repo msa62624-tech/Compliant4

# Watch a running workflow
gh run watch <run-id> --repo msa62624-tech/Compliant4
```

**Via Web:**
- Actions Dashboard: https://github.com/msa62624-tech/Compliant4/actions
- PR Checks: Each PR page shows associated workflow runs

### Set Up Notifications

Configure GitHub notifications for workflow failures:
1. Go to Settings → Notifications
2. Enable "Actions" notifications
3. Choose notification method (email, web, mobile)

## Emergency Procedures

### If a Workflow is Stuck

1. **Document the Issue**
   - Note the workflow run ID
   - Record which step is stuck
   - Check how long it's been running

2. **Cancel Immediately**
   - Use manual cancellation (fastest)
   - Or use GitHub CLI for automation

3. **Investigate Logs**
   - Download workflow logs
   - Look for last logged message
   - Identify where execution stopped

4. **Prevent Recurrence**
   - Add timeout configurations
   - Break down the task
   - Optimize resource usage

### If Multiple Workflows are Stuck

```bash
# List all in-progress runs
gh run list --status in_progress --repo msa62624-tech/Compliant4

# Cancel all stuck runs (careful!)
gh run list --status in_progress --json databaseId -q '.[].databaseId' | \
  xargs -I {} gh run cancel {} --repo msa62624-tech/Compliant4
```

## Current Known Issues

### Issue: PR #78 Workflow Stuck (2026-01-28)

**Status**: Identified and documented
**Workflow Run**: 21447181990
**Details**: See STUCK_WORKFLOW_ANALYSIS.md
**Action Required**: Manual cancellation by repository admin

## Resource Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Troubleshooting Workflows](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows)
- [GitHub CLI Manual](https://cli.github.com/manual/)

## Contact

For workflow issues or questions:
1. Create an issue in this repository
2. Tag it with `workflow` or `ci/cd` label
3. Include workflow run ID and relevant logs

---

**Last Updated**: 2026-01-28
**Maintainer**: Development Team
