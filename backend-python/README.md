# Compliant4 Python Backend

This is the Python/FastAPI version of the Compliant4 backend, migrated from Node.js/Express.js.

## ⚠️ Security Update (January 29, 2026)

**Critical security vulnerabilities fixed:**
- ✅ FastAPI updated from 0.109.0 → 0.115.6 (ReDoS fix)
- ✅ python-multipart updated from 0.0.6 → 0.0.22 (fixes 3 vulnerabilities)

See [SECURITY_FIXES_PYTHON.md](../SECURITY_FIXES_PYTHON.md) for details.

## Migration Status

✅ **Core Features Migrated:**
- FastAPI application setup with async support
- JWT authentication and authorization
- Entity CRUD operations (19+ entity types)
- Rate limiting middleware
- Security headers and middleware
- Health check endpoints (Kubernetes-ready)
- Prometheus metrics
- Request logging and correlation IDs
- Error handling
- CORS configuration
- In-memory database with file persistence

## Quick Start

### Prerequisites
- Python 3.10 or higher
- pip (Python package manager)

### Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

### Run the Server

```bash
# Development mode (with auto-reload)
uvicorn main:app --reload --host 0.0.0.0 --port 3001

# Production mode
python main.py
```

The server will start on `http://localhost:3001`

### API Documentation

Once running, visit:
- Swagger UI: http://localhost:3001/api-docs
- ReDoc: http://localhost:3001/api-redoc

## Architecture

### Framework
- **FastAPI**: Modern Python web framework (equivalent to Express.js)
- **Uvicorn**: ASGI server for running FastAPI
- **Pydantic**: Data validation and settings management

### Authentication
- **python-jose**: JWT token generation and verification (equivalent to jsonwebtoken)
- **passlib**: Password hashing (equivalent to bcryptjs)

### Key Differences from Node.js Backend

1. **Async/Await**: Python's `async`/`await` syntax instead of Promise-based
2. **Type Hints**: Python type hints for better IDE support
3. **Pydantic Models**: Data validation using Pydantic instead of express-validator
4. **Dependency Injection**: FastAPI's dependency injection system
5. **Auto-generated Docs**: Built-in Swagger/ReDoc documentation

## Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=.
```

## Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_coi_pdf.py -v

# Run with coverage
pytest --cov=.
```

## New Features ✨

### 1. COI PDF Generation (ReportLab)

Generate ACORD 25 Certificate of Insurance PDFs:

```python
from services.coi_pdf_service import COIPDFService

service = COIPDFService()
filename = service.generate_coi_pdf({
    "subcontractorName": "ABC Plumbing",
    "projectName": "Downtown Project",
    "gcName": "Main Contractors",
    # ... additional fields
})
```

**API Endpoint:**
```bash
POST /integrations/generate-sample-coi
Authorization: Bearer <token>
```

### 2. AI-Powered Analysis (OpenAI)

Analyze COI compliance and extract policy data using LLM:

```python
from integrations.ai_analysis_service import AIAnalysisService

service = AIAnalysisService()
result = await service.analyze_coi_compliance(coi_data, requirements)
```

**API Endpoints:**
- `POST /ai/analyze-coi-compliance` - Analyze COI for compliance
- `POST /ai/extract-policy-data` - Extract structured data from policies
- `POST /ai/generate-recommendations` - Generate review recommendations
- `GET /ai/status` - Check AI service status

**Configuration:**
```bash
AI_API_KEY=your-openai-api-key
AI_MODEL=gpt-4-turbo-preview
```

### 3. Adobe PDF Services

Extract text, fields, sign, and merge PDFs:

```python
from integrations.adobe_pdf_service import AdobePDFService

service = AdobePDFService()
text_data = await service.extract_text(file_url)
coi_fields = await service.extract_coi_fields(file_url)
```

**API Endpoints:**
- `POST /adobe/extract-text` - Extract text from PDF
- `POST /adobe/extract-coi-fields` - Extract structured COI fields
- `POST /adobe/sign-pdf` - Apply digital signature
- `POST /adobe/merge-pdfs` - Merge multiple PDFs
- `GET /adobe/status` - Check Adobe service status

**Configuration:**
```bash
ADOBE_API_KEY=your-adobe-api-key
ADOBE_CLIENT_ID=your-adobe-client-id
```

### 4. PostgreSQL Support

Migrate from in-memory to PostgreSQL for production:

```bash
# Configure database
export DATABASE_URL='postgresql://user:pass@localhost:5432/compliant4'

# Run migration
python scripts/migrate_to_postgres.py
```

See [POSTGRESQL_MIGRATION.md](POSTGRESQL_MIGRATION.md) for detailed guide.

## Environment Variables

See `.env.example` for all available configuration options.

Required for production:
- `JWT_SECRET`: Must be changed from default
- `FRONTEND_URL`: Frontend URL for CORS

## Migration Notes

### Completed ✅
- Core FastAPI application structure
- Authentication (JWT, login, refresh)
- Entity CRUD operations (19+ entity types)
- Middleware (rate limiting, security, logging)
- Health checks and metrics
- Error handling and request logging
- **COI PDF generation (ReportLab)** ✨ NEW
- **AI Analysis integration (OpenAI)** ✨ NEW
- **Adobe PDF Services integration** ✨ NEW
- **PostgreSQL database support (SQLAlchemy)** ✨ NEW
- **Comprehensive test suite** ✨ NEW

### Optional Features (Configure via environment variables)
- Email service (aiosmtplib) - Set SMTP_* variables
- AI Analysis (OpenAI) - Set AI_API_KEY
- Adobe PDF Services - Set ADOBE_API_KEY and ADOBE_CLIENT_ID
- PostgreSQL database - Set DATABASE_URL

### Migration Complete! 🎉

The Python backend now has **feature parity** with the Node.js backend and includes:
1. ✅ ReportLab for ACORD 25 COI PDF generation
2. ✅ LLM integration for AI-powered compliance analysis
3. ✅ Adobe PDF Services for text extraction and signing
4. ✅ PostgreSQL support with migration tools
5. ✅ Comprehensive test coverage (12 tests passing)

## Directory Structure

```
backend-python/
├── main.py                    # Application entry point
├── requirements.txt           # Python dependencies
├── POSTGRESQL_MIGRATION.md   # PostgreSQL migration guide
├── config/                    # Configuration modules
│   ├── env.py                # Environment settings
│   ├── database.py           # In-memory database (default)
│   ├── postgres.py           # PostgreSQL configuration (optional)
│   ├── logger_config.py      # Logging setup
│   └── security.py           # Security middleware
├── middleware/               # Middleware modules
│   ├── auth.py              # Authentication
│   ├── rate_limiting.py     # Rate limiting
│   ├── request_logger.py    # Request logging
│   ├── error_handler.py     # Error handling
│   ├── health_check.py      # Health checks
│   └── metrics.py           # Prometheus metrics
├── routers/                 # API route handlers
│   ├── auth.py             # Auth endpoints
│   ├── entities.py         # Entity CRUD
│   ├── health.py           # Health endpoints
│   ├── metrics.py          # Metrics endpoint
│   ├── coi.py              # COI PDF generation ✨ NEW
│   ├── ai.py               # AI analysis ✨ NEW
│   └── adobe.py            # Adobe PDF services ✨ NEW
├── services/               # Business logic services
│   └── coi_pdf_service.py # COI PDF generation ✨ NEW
├── integrations/           # External service integrations
│   ├── ai_analysis_service.py  # AI/LLM integration ✨ NEW
│   └── adobe_pdf_service.py    # Adobe PDF services ✨ NEW
├── models/                # Data models
│   └── entities.py        # SQLAlchemy models ✨ NEW
├── scripts/               # Utility scripts
│   └── migrate_to_postgres.py # DB migration tool ✨ NEW
├── tests/                 # Test suite ✨ NEW
│   ├── test_coi_pdf.py   # COI PDF tests
│   ├── test_ai_service.py # AI service tests
│   └── test_adobe_service.py # Adobe service tests
├── utils/                # Utility functions
└── data/                 # Sample data and templates
```

## Deployment

### Docker (Recommended)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
```

### Traditional Deployment

```bash
# Install dependencies
pip install -r requirements.txt

# Run with gunicorn (production ASGI server)
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:3001
```

## Performance

FastAPI is one of the fastest Python frameworks, with performance comparable to Node.js:
- Built on Starlette (ASGI framework)
- Async/await support for high concurrency
- Efficient request handling
- Automatic validation and serialization
