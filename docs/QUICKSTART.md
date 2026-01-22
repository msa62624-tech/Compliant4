# Quick Start Guide - INsuretrack Application

This guide will help you get the INsuretrack application running locally with full functionality including data saving and email notifications.

## Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

## Setup Instructions

### 1. Clone and Navigate to Repository

```bash
git clone <repository-url>
cd INsuretrack1234
```

### 2. Set Up Backend

#### Install Backend Dependencies
```bash
cd backend
npm install
```

#### Create Backend Environment File
Create a file named `.env` in the `backend` directory with the following content:

```env
# Backend Environment Configuration

# Server
PORT=3001
NODE_ENV=development

# JWT - Use a strong secret in production (generate with: openssl rand -base64 32)
JWT_SECRET=insuretrack-dev-secret-change-in-production

# CORS - Set to your frontend URL (update if frontend uses different port)
# If frontend runs on 5175 instead of 5173, use http://localhost:5175
FRONTEND_URL=http://localhost:5173

# SMTP (Email) - Optional for development
# Leave these commented out to use mock email service
# Uncomment and configure for production email sending
# SMTP_SERVICE=gmail
# SMTP_USER=your.email@gmail.com
# SMTP_PASS=your-app-password
# SMTP_FROM=your.email@gmail.com
```

#### Start Backend Server
```bash
node server.js
```

The backend should start on http://localhost:3001

### 3. Set Up Frontend

#### Install Frontend Dependencies
```bash
cd ..  # Return to root directory
npm install
```

#### Create Frontend Environment File
Create a file named `.env` in the root directory with the following content:

```env
# Frontend Environment Variables

# Backend API URL
VITE_API_BASE_URL=http://localhost:3001
```

#### Start Frontend Development Server
```bash
npm run dev
```

The frontend will start on http://localhost:5173 (or the next available port like 5175)

**Important**: If the frontend starts on a different port (e.g., 5175), update the `FRONTEND_URL` in `backend/.env` to match that port.

### 4. Access the Application

1. Open your browser to http://localhost:5173 (or the port shown in the terminal)
2. Login with default credentials:
   - Username: `admin`
   - Password: `INsure2026!`

## Verification

### Test Backend is Running
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-01-12T22:56:47.734Z"}
```

### Test Authentication
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"INsure2026!"}'
```

Expected response: JSON with `accessToken` and user information

## Features Verification

### ✅ Data Saving
All forms in the application now properly save data:
- General Contractors
- Subcontractors
- Projects
- Insurance Documents
- Messages and Notifications

### ✅ Email Notifications
Email system is fully functional:
- **Development Mode**: Emails are logged to console (mock email service)
- **Production Mode**: Configure SMTP settings in backend/.env for real email sending

Email notifications are sent for:
- GC welcome emails with login credentials
- Subcontractor project assignments
- COI approvals and rejections
- Policy expiration reminders
- Compliance alerts

## Email Configuration for Production

To enable real email sending in production:

1. Edit `backend/.env` and uncomment the SMTP settings
2. Choose an email service:

### Option A: Microsoft 365 / Outlook (Recommended)
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your.email@yourdomain.onmicrosoft.com
SMTP_PASS=your-password
SMTP_FROM=your.email@yourdomain.onmicrosoft.com
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_TLS_REJECT_UNAUTHORIZED=true
```

### Option B: Gmail
```env
SMTP_SERVICE=gmail
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=your.email@gmail.com
SMTP_REQUIRE_TLS=true
```

**Note**: For Gmail, you must use an App Password:
1. Enable 2-Step Verification on your Google Account
2. Go to Google Account → Security → 2-Step Verification → App passwords
3. Create an App Password for "Mail"
4. Use the 16-character password in SMTP_PASS

### Option B: SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=verified-sender@yourdomain.com
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
```

### Option C: AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-user
SMTP_PASS=your-ses-smtp-password
SMTP_FROM=verified-sender@yourdomain.com
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
```

## Troubleshooting

### Backend Not Starting
- Ensure port 3001 is not in use: `lsof -ti:3001`
- Check backend/.env file exists and is properly formatted
- Verify Node.js is installed: `node --version`

### Frontend Not Connecting to Backend
- Ensure backend is running on port 3001
- Check .env file in root directory exists
- Verify VITE_API_BASE_URL is set correctly
- Check browser console for CORS errors

### Email Not Sending
- In development, emails are logged to console (this is normal)
- For production, verify SMTP credentials are correct
- Check backend logs for email errors
- Test email configuration with a simple test

### Data Not Saving
- Ensure backend is running and accessible
- Check browser console for API errors
- Verify authentication token is valid
- Check backend logs for error messages

## Default Login Credentials

### Super Admin
- Username: `admin`
- Password: `INsure2026!`
- Email: admin@insuretrack.com

### Demo User
- Username: `demo`
- Password: `demo`
- Email: demo@insuretrack.com

## Development vs Production

### Development Mode
- Backend uses in-memory storage (data resets on restart)
- Emails are logged to console (mock email service)
- CORS allows localhost
- JWT secret is default (change for production)

### Production Mode
- **Note**: Currently uses in-memory storage (data resets on restart). For persistent storage, you'll need to implement database integration (PostgreSQL, MongoDB, etc.)
- Configure real SMTP for email sending
- Update JWT_SECRET with secure random string
- Configure proper CORS with your frontend URL
- Use environment variables for all sensitive data
- Enable HTTPS
- Add rate limiting for API endpoints

## Next Steps

1. **Customize Settings**: Update environment variables for your deployment
2. **Configure Email**: Set up SMTP for real email sending (see Email Configuration section above)
3. **Consider Database**: Current implementation uses in-memory storage (suitable for development/testing). For production with persistent data, consider implementing database integration
4. **Deploy**: Follow deployment guide for your hosting platform
5. **Monitor**: Set up logging and error tracking

## Support

For issues or questions:
- Check the API_DOCUMENTATION.md for API details
- Check the EMAIL_CONFIGURATION.md for email setup details
- Review the FIX_SUMMARY.md for recent fixes
- Check backend logs for error messages

## Security Notes

⚠️ **Important Security Considerations**:
- Change default admin password immediately
- Use strong JWT_SECRET in production
- Never commit .env files to version control
- Use HTTPS in production
- Implement rate limiting for API endpoints
- Regular security audits recommended

---

**Status**: ✅ All features working - Application ready for development and testing
