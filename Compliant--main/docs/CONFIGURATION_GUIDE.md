# Backend API and Email Configuration Guide

This document explains how the INsuretrack system has been configured for backend API connectivity and email functionality.

## Configuration Overview

The system has been configured with:
1. **Frontend Backend Connection**: `.env` file with `VITE_API_BASE_URL` set to `http://localhost:3001`
2. **Backend SMTP Email**: `.env` file with Microsoft 365 SMTP configuration

## Files Created

### Frontend Configuration
- **File**: `/.env`
- **Purpose**: Configures the frontend to connect to the backend API
- **Key Setting**: `VITE_API_BASE_URL=http://localhost:3001`
- **Note**: This file is git-ignored and contains environment-specific settings

### Backend Configuration
- **File**: `/backend/.env`
- **Purpose**: Configures the backend server with SMTP email settings
- **Key Settings**:
  - `SMTP_HOST=smtp.office365.com`
  - `SMTP_PORT=587`
  - `SMTP_USER=miriamsabel@insuretrack.onmicrosoft.com`
  - `SMTP_FROM=miriamsabel@insuretrack.onmicrosoft.com`
- **Note**: This file is git-ignored and contains sensitive credentials

## What Changed in the UI

### Before Configuration
The login page displayed a warning banner:
```
⚠️ Backend API not configured
Running in demo mode with local data only.

To connect to a backend:
- Run npm run setup in your terminal
- Follow the prompts to configure your backend URL
- Restart the development server
Or manually set VITE_API_BASE_URL in a .env file
```

### After Configuration
The warning banner is removed, and the login page shows a clean interface with:
- INsuretrack branding
- Username and password fields
- Demo credentials hint: "Demo: admin / INsure2026!"

## How to Use

### Starting the Application

1. **Start the Backend** (in one terminal):
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   Backend runs on: `http://localhost:3001`

2. **Start the Frontend** (in another terminal):
   ```bash
   npm install
   npm run dev
   ```
   Frontend runs on: `http://localhost:5173` (or next available port)

3. **Login**:
   - Username: `admin`
   - Password: `INsure2026!`

### Email Functionality

The system is configured to send emails through Microsoft 365 SMTP:
- **SMTP Server**: smtp.office365.com
- **Port**: 587 (STARTTLS)
- **From Address**: Configured in backend/.env (your Microsoft 365 email)

**Note**: In sandboxed/restricted environments without full internet access, email delivery may fail. However, in production environments with proper network access, emails will be sent successfully.

## Environment-Specific Configuration

The `.env` files are not committed to the repository for security reasons. When deploying to different environments:

### Local Development
- Use the existing `.env` files as configured
- Backend URL: `http://localhost:3001`

### Production Deployment (Vercel/Render)
1. Set `VITE_API_BASE_URL` to your production backend URL in Vercel dashboard
2. Set all SMTP environment variables in your backend hosting service
3. Update `FRONTEND_URL` in backend environment to match your frontend domain

## Alternative Setup Methods

Instead of manually creating `.env` files, you can use the interactive setup script:

```bash
npm run setup
```

This will guide you through:
1. Choosing backend connection mode (local/custom/demo)
2. Configuring email settings (Gmail/Microsoft 365/Custom SMTP)
3. Creating both frontend and backend `.env` files

## Troubleshooting

### Warning Still Shows
- Ensure `.env` file exists in the root directory
- Verify `VITE_API_BASE_URL` is set correctly
- Restart the development server (`npm run dev`)

### Email Not Sending
- Check backend logs for SMTP errors
- Verify SMTP credentials are correct
- Ensure SMTP authentication is enabled in Microsoft 365 admin portal
- Test email configuration: `GET /integrations/email-verify` (with auth token)

### Backend Connection Fails
- Ensure backend server is running on port 3001
- Check that frontend `.env` has correct `VITE_API_BASE_URL`
- Verify no firewall/network restrictions

## Security Notes

⚠️ **Important Security Information**:
- `.env` files are git-ignored and should NEVER be committed
- Keep SMTP passwords secure and rotate them regularly
- Use environment variables in production, not hardcoded values
- For production, consider using app-specific passwords or OAuth2
- The JWT secret should be changed from the default in production

## Documentation References

- [SMTP Setup Guide](./SMTP_SETUP.md) - Detailed SMTP configuration instructions
- [Setup Backend Guide](./SETUP_BACKEND.md) - Backend setup instructions
- [Main README](./README.md) - General application documentation
