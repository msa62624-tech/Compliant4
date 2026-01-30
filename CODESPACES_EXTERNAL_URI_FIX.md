# Codespaces External URI Fix

## Problem

When running the application in GitHub Codespaces, you may encounter the following error:

```
INFOvscs:web-client:...:dev-tunnel-external-uri-provider Getting external URI for https://...-5175.app.github.dev/
INFOvscs:web-client:...:dev-tunnel-external-uri-provider Unallowed host ...-5175.app.github.dev
```

This error occurs when VS Code's dev-tunnel-external-uri-provider tries to access forwarded ports but doesn't recognize GitHub Codespaces URLs as allowed hosts.

## Root Cause

The VS Code workbench in Codespaces validates external URIs through its dev-tunnel system. By default, it may not recognize dynamically generated GitHub Codespaces URLs (format: `*.app.github.dev`) as allowed hosts, causing the "Unallowed host" error.

## Solution

This repository now includes VS Code workspace settings that explicitly allow GitHub Codespaces port forwarding domains.

### Files Added/Modified

1. **`.vscode/settings.json`** (New)
   - Configures VS Code to allow GitHub Codespaces tunnels
   - Enables automatic port forwarding
   - Sets up hybrid port detection

2. **`.devcontainer/devcontainer.json`** (Modified)
   - Includes the same VS Code settings for consistency
   - Enhanced port attributes with HTTPS protocol and public visibility
   - Ensures settings apply when the devcontainer is created

3. **`.gitignore`** (Modified)
   - Now allows `.vscode/settings.json` to be version controlled
   - Previously, all `.vscode/*` files were ignored except `extensions.json`

4. **`.vscode/extensions.json`** (New)
   - Lists recommended VS Code extensions for this project

## What's Fixed

### Port Forwarding Configuration
- **Automatic Port Forwarding**: Ports are now automatically forwarded when you open the workspace
- **Hybrid Detection**: Uses both application and output detection for port forwarding
- **GitHub Codespaces Support**: Explicitly allows `*.app.github.dev` domains

### Settings Explained

```json
{
  "remote.autoForwardPorts": true,           // Automatically detect and forward ports
  "remote.autoForwardPortsSource": "hybrid", // Use hybrid port detection (app + output)
  "remote.forwardOnOpen": true,              // Forward ports when workspace opens
  "dev.tunnels.access.hostNameOverride": "*.app.github.dev", // Allow Codespaces domains
  "dev.tunnels.access.preventSleep": true    // Keep tunnels active
}
```

### Port Attributes

Both frontend (5175) and backend (3001) ports are configured with:
- **Protocol**: HTTPS (required for Codespaces)
- **Visibility**: Public (allows external access)
- **Auto-forward**: Notify when port is forwarded

## Usage

### For New Codespaces

1. Open the repository in GitHub Codespaces
2. The devcontainer configuration will automatically apply the settings
3. Ports will be forwarded automatically when the application starts
4. No "Unallowed host" errors should occur

### For Existing Codespaces

If you have an existing Codespace before this fix:

**Option 1: Rebuild Container (Recommended)**
1. Press `Ctrl/Cmd + Shift + P` (Command Palette)
2. Type "Codespaces: Rebuild Container"
3. Wait for the rebuild to complete
4. Your Codespace will now have the new settings

**Option 2: Reload Window**
1. Press `Ctrl/Cmd + Shift + P` (Command Palette)
2. Type "Developer: Reload Window"
3. The new settings will be loaded

### Verifying the Fix

1. Start the application:
   ```bash
   ./start.sh
   ```

2. Check the Ports tab in VS Code:
   - Port 5175 should show as forwarded (Frontend)
   - Port 3001 should show as forwarded (Backend API)

3. Click the globe icon next to port 5175 to open the application
   - The application should load without "Unallowed host" errors
   - Check browser console for any remaining errors

## Technical Details

### Why This Works

1. **Explicit Host Override**: By setting `dev.tunnels.access.hostNameOverride` to `*.app.github.dev`, we tell VS Code to trust all GitHub Codespaces domains.

2. **Automatic Port Forwarding**: With `remote.autoForwardPorts: true`, VS Code detects when the application listens on ports 3001 and 5175 and automatically forwards them.

3. **Hybrid Detection**: `remote.autoForwardPortsSource: "hybrid"` ensures ports are detected both from application listening and from console output.

4. **Consistent Configuration**: By including the same settings in both `.vscode/settings.json` and `.devcontainer/devcontainer.json`, we ensure they apply whether the user opens the repository in an existing workspace or creates a new devcontainer.

### VS Code Dev Tunnels

VS Code uses dev tunnels to enable secure port forwarding in remote development scenarios like Codespaces. The dev-tunnel-external-uri-provider is responsible for:
- Generating external URIs for forwarded ports
- Validating that requested URIs are allowed
- Managing tunnel connections

Without proper configuration, it may reject GitHub Codespaces URLs as "Unallowed hosts" for security reasons.

## Troubleshooting

### Error Still Occurs After Fix

1. **Ensure you've rebuilt the container** or reloaded the window
2. **Check VS Code version**: Make sure you're running a recent version of VS Code
3. **Verify port forwarding**: Check the Ports tab to see if ports are actually forwarded
4. **Check browser console**: Look for any CORS or network errors

### Ports Not Forwarding Automatically

1. **Manual port forwarding**:
   - Open the Ports tab in VS Code
   - Click "Forward a Port"
   - Enter port 5175 or 3001
   - Set visibility to "Public"

2. **Check if ports are in use**:
   ```bash
   lsof -i :5175
   lsof -i :3001
   ```

3. **Restart the application**:
   ```bash
   ./stop.sh
   ./start.sh
   ```

### CORS Errors Still Occurring

The backend already has CORS configuration that allows GitHub Codespaces origins. If you still see CORS errors:

1. **Check backend logs**:
   ```bash
   cat backend.log
   ```

2. **Verify environment variables** are set correctly:
   ```bash
   cat .env
   cat backend/.env
   ```

3. **Ensure backend is running**:
   ```bash
   curl http://localhost:3001/health
   ```

## Additional Resources

- [GitHub Codespaces Documentation](https://docs.github.com/en/codespaces)
- [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview)
- [VS Code Port Forwarding](https://code.visualstudio.com/docs/remote/ssh#_forwarding-a-port-creating-ssh-tunnel)

## Related Files

- `.vscode/settings.json` - VS Code workspace settings
- `.devcontainer/devcontainer.json` - Devcontainer configuration
- `vite.config.js` - Vite dev server configuration (already has `allowedHosts: true`)
- `backend-python/main.py` - Backend CORS configuration (already allows GitHub Codespaces)
- `CODESPACES_FIX_SUMMARY.md` - Previous Codespaces fixes

## Summary

This fix resolves the "Unallowed host" error by:
1. ✅ Explicitly allowing GitHub Codespaces domains (`*.app.github.dev`)
2. ✅ Enabling automatic port forwarding with hybrid detection
3. ✅ Configuring ports with HTTPS and public visibility
4. ✅ Ensuring settings are applied consistently in both workspace and devcontainer
5. ✅ Version controlling the settings for all team members

The application should now work seamlessly in GitHub Codespaces without any host validation errors.
