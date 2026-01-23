# INsuretrack Backend API

Express.js backend API for the INsuretrack application.

## Quick Start

### Local Development

```bash
cd backend
npm install
npm run dev
```

Server runs on `http://localhost:3001`

### Production

```bash
cd backend
npm install
npm start
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` (or set env vars in your hosting provider) and configure values locally. DO NOT commit real credentials (SMTP passwords, JWT secrets) to source control.

Example values (development):

```bash
# in backend/.env
PORT=3001
JWT_SECRET=your-production-secret-key
FRONTEND_URL=http://localhost:5175
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-smtp-password
```

For Vite/frontend, set `VITE_API_BASE_URL` in the frontend environment (see `.env.example` at repo root).

To verify email transport is working (after setting SMTP env vars), call the protected verify endpoint (requires auth) or use the public verify endpoint during development:

```bash
# If running locally and authenticated, GET /integrations/email-verify
curl -i -H "Authorization: Bearer <token>" http://localhost:3001/integrations/email-verify

# For public send-email verification (POST /integrations/public/send-email) use the API
```

## Default Test Users

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | admin |
| demo     | demo      | user  |

## API Endpoints

### Authentication
- `POST /auth/login` - Login with username/password
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user (requires auth)

### Entities
- `GET /entities/:entityName` - List all entities
- `POST /entities/:entityName/query` - Query/filter entities
- `POST /entities/:entityName` - Create entity
- `PATCH /entities/:entityName/:id` - Update entity
- `DELETE /entities/:entityName/:id` - Delete entity

Supported entities: `InsuranceDocument`, `Project`, `Contractor`, `User`

### Integrations
- `POST /integrations/invoke-llm` - Call LLM
- `POST /integrations/send-email` - Send email
- `GET /integrations/email-verify` - Verify email transport configuration
- `POST /integrations/upload-file` - Upload file
- `POST /integrations/generate-image` - Generate image
- `POST /integrations/extract-file` - Extract data from file
- `POST /integrations/create-signed-url` - Create signed URL
- `POST /integrations/upload-private-file` - Upload private file

### Adobe Sign
- `POST /integrations/adobe/transientDocument` - Upload transient doc
- `POST /integrations/adobe/agreement` - Create agreement
- `GET /integrations/adobe/agreement/:id/url` - Get signing URL

## Deploy to Vercel

1. Install Vercel CLI (if needed)
   ```bash
   npm i -g vercel
   ```

2. Deploy from backend directory
   ```bash
   cd backend
   vercel --prod
   ```

3. Set environment variables in Vercel Dashboard:
   - `JWT_SECRET` (generate secure random string)
   - `FRONTEND_URL` (your Vercel frontend URL)
   - `NODE_ENV=production`

4. Redeploy to apply env vars:
   ```bash
   vercel --prod
   ```

Get the backend URL (e.g., `https://compliant-backend.vercel.app`) and set it as `VITE_API_BASE_URL` in your frontend deployment.

## Architecture

- **In-memory storage**: Data is stored in memory and resets on restart. Replace with a database (PostgreSQL, MongoDB) for production.
- **JWT authentication**: Access tokens expire in 1 hour, refresh tokens in 7 days.
- **CORS**: Configured to allow requests from your frontend URL.

## SMTP Email Configuration

Set the following environment variables to enable real email delivery:

- `SMTP_HOST` and `SMTP_PORT` or `SMTP_SERVICE` (e.g., `gmail`)
- `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM` (default From address)
- Optional: `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_TLS_REJECT_UNAUTHORIZED`

Development fallback:

- If SMTP is not configured, the backend uses Ethereal test accounts.
- Responses include a `previewUrl` to view the email in a browser.
- Use `GET /integrations/email-verify` to check transporter readiness.

## Next Steps

- [ ] Add database (PostgreSQL/MongoDB)
- [ ] Implement real file upload (S3, Cloudinary)
- [ ] Add email service integration (SendGrid, SES)
- [ ] Implement real LLM integration (OpenAI, Anthropic)
- [ ] Add Adobe Sign integration with real credentials
- [ ] Add rate limiting and security headers
- [ ] Add logging and monitoring
