# Email Configuration for INsuretrack

INsuretrack uses email to send notifications to contractors, brokers, and system users. To enable email functionality, you need to configure SMTP settings in the backend.

## Quick Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Copy the example environment file (if you haven't already):
   ```bash
   cp .env.example .env
   ```

3. Edit `backend/.env` and configure one of the following options:

## Option A: Microsoft 365 / Outlook (Recommended)

For Microsoft 365 or Outlook.com accounts:

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your.email@yourdomain.onmicrosoft.com
SMTP_PASS=your-password
SMTP_FROM=your.email@yourdomain.onmicrosoft.com
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_TLS_REJECT_UNAUTHORIZED=true
```

**Note**: For Microsoft 365:
1. Use your regular Microsoft 365 email address
2. Use your regular password (or app password if MFA is enabled)
3. Ensure SMTP is enabled in your Microsoft 365 admin console

## Option B: Gmail

Gmail is a good option for testing. You'll need to create an "App Password" rather than using your regular Gmail password.

### Steps to Create Gmail App Password:

1. **Enable 2-Step Verification** on your Google Account:
   - Visit https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. **Create an App Password**:
   - Visit https://myaccount.google.com/apppasswords
   - Select "Mail" as the app
   - Name it "INsuretrack"
   - Copy the 16-character password (without spaces)

3. **Configure in backend/.env**:
   ```bash
   SMTP_SERVICE=gmail
   SMTP_USER=your.email@gmail.com
   SMTP_PASS=your16characterapppassword
   SMTP_FROM=your.email@gmail.com
   SMTP_REQUIRE_TLS=true
   ```

## Option C: Custom SMTP Server

For other email providers (SendGrid, Mailgun, AWS SES, etc.):

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@yourdomain.com
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
```

## Testing Email Configuration

After configuring SMTP, restart your backend server:

```bash
npm run dev
```

The backend will log whether email is configured correctly on startup. You can test email by:

1. Logging into the application
2. Creating a contractor or project
3. Checking that notification emails are sent

## Troubleshooting

### Gmail: "Invalid credentials" error

- Make sure you're using an **App Password**, not your regular Gmail password
- Verify 2-Step Verification is enabled on your Google Account
- The app password should be 16 characters with no spaces

### "Connection refused" or "ECONNREFUSED" errors

- Check that SMTP_HOST and SMTP_PORT are correct
- Verify your firewall isn't blocking outbound SMTP connections
- For Gmail, ensure SMTP_SERVICE=gmail is set correctly

### Emails not being delivered

- Check spam/junk folders
- Verify SMTP_FROM email matches your authenticated account
- For Gmail, ensure "Less secure app access" is NOT enabled (use App Password instead)
- Check backend server logs for detailed error messages

## Development/Testing Mode

If SMTP is not configured, the backend automatically falls back to **test mode** using Ethereal Email. In test mode:

- Emails won't be delivered to real addresses
- A preview URL will be logged in the backend console
- You can view the email content at the preview URL
- This is useful for development and testing

## Security Notes

- **Never commit your `.env` file** - it contains sensitive credentials
- The `.env` file is already in `.gitignore` to prevent accidental commits
- Use strong passwords and enable 2-Factor Authentication on your email account
- For production, consider using a dedicated email service (SendGrid, Mailgun, etc.)
- Rotate your SMTP credentials periodically

## Production Deployment

For production environments:

1. **Use environment variables** instead of the `.env` file
2. Set environment variables in your hosting platform (Vercel, Render, etc.)
3. Use a dedicated email service for better deliverability
4. Configure SPF, DKIM, and DMARC records for your domain
5. Monitor email delivery logs and bounce rates

See [DEPLOY.md](DEPLOY.md) for detailed production deployment instructions.
