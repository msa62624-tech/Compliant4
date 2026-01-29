# Compliant4 Python Backend

This is the Python/FastAPI version of the Compliant4 backend, migrated from Node.js/Express.js.

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

## Environment Variables

See `.env.example` for all available configuration options.

Required for production:
- `JWT_SECRET`: Must be changed from default
- `FRONTEND_URL`: Frontend URL for CORS

## Migration Notes

### Completed
- Core FastAPI application structure
- Authentication (JWT, login, refresh)
- Entity CRUD operations
- Middleware (rate limiting, security, logging)
- Health checks and metrics
- Basic error handling

### To Be Completed
- PDF generation service (PDFKit → ReportLab)
- Email service (Nodemailer → aiosmtp)
- File upload handling (Multer → FastAPI UploadFile)
- Adobe PDF integration
- AI Analysis integration
- Complex business logic endpoints
- Database migration to PostgreSQL
- Comprehensive testing

## Directory Structure

```
backend-python/
├── main.py                 # Application entry point
├── requirements.txt        # Python dependencies
├── config/                 # Configuration modules
│   ├── env.py             # Environment settings
│   ├── database.py        # Database configuration
│   ├── logger_config.py   # Logging setup
│   └── security.py        # Security middleware
├── middleware/            # Middleware modules
│   ├── auth.py           # Authentication
│   ├── rate_limiting.py  # Rate limiting
│   ├── request_logger.py # Request logging
│   ├── error_handler.py  # Error handling
│   ├── health_check.py   # Health checks
│   └── metrics.py        # Prometheus metrics
├── routers/              # API route handlers
│   ├── auth.py          # Auth endpoints
│   ├── entities.py      # Entity CRUD
│   ├── health.py        # Health endpoints
│   └── metrics.py       # Metrics endpoint
├── services/            # Business logic services
├── utils/              # Utility functions
├── integrations/       # External service integrations
├── models/            # Pydantic models
└── data/             # Sample data and templates
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
