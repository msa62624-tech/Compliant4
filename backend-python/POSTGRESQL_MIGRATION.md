# PostgreSQL Migration Guide

This guide explains how to migrate from in-memory JSON storage to PostgreSQL.

## Prerequisites

1. **PostgreSQL Server**: Install PostgreSQL 12 or higher
2. **Python Dependencies**: Ensure SQLAlchemy and psycopg2 are installed
   ```bash
   pip install -r requirements.txt
   ```

## Setup PostgreSQL

### Option 1: Local PostgreSQL

1. Install PostgreSQL:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   
   # macOS
   brew install postgresql
   ```

2. Create database and user:
   ```bash
   sudo -u postgres psql
   ```
   
   ```sql
   CREATE DATABASE compliant4;
   CREATE USER compliant_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE compliant4 TO compliant_user;
   ```

### Option 2: Docker PostgreSQL

```bash
docker run --name compliant4-postgres \
  -e POSTGRES_DB=compliant4 \
  -e POSTGRES_USER=compliant_user \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -d postgres:14
```

### Option 3: Cloud PostgreSQL

Use a managed PostgreSQL service:
- **AWS RDS**: Amazon Relational Database Service
- **Google Cloud SQL**: Google Cloud SQL for PostgreSQL
- **Azure Database**: Azure Database for PostgreSQL
- **Heroku Postgres**: Heroku managed PostgreSQL
- **ElephantSQL**: Free PostgreSQL hosting (for testing)

## Configuration

1. Set the `DATABASE_URL` environment variable in `.env`:
   ```bash
   DATABASE_URL=postgresql://compliant_user:your_secure_password@localhost:5432/compliant4
   ```

   For cloud services, use their provided connection string:
   ```bash
   # Example for Heroku
   DATABASE_URL=postgresql://user:pass@host.compute-1.amazonaws.com:5432/dbname
   ```

2. The backend will automatically detect PostgreSQL and use it instead of in-memory storage.

## Migration Process

### Step 1: Backup Current Data

The in-memory data is stored in `data/entities.json`. Make a backup:
```bash
cp data/entities.json data/entities.json.backup
```

### Step 2: Run Migration Script

```bash
cd backend-python
export DATABASE_URL='postgresql://compliant_user:your_secure_password@localhost:5432/compliant4'
python scripts/migrate_to_postgres.py
```

The script will:
1. Create all database tables
2. Load data from `data/entities.json`
3. Migrate all entities to PostgreSQL
4. Display progress and summary

### Step 3: Update Environment Configuration

Update your `.env` file to use PostgreSQL permanently:
```bash
# In backend-python/.env
DATABASE_URL=postgresql://compliant_user:your_secure_password@localhost:5432/compliant4
```

### Step 4: Restart Backend

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 3001
```

The backend will now use PostgreSQL instead of in-memory storage.

## Verification

1. Check logs for PostgreSQL connection:
   ```
   PostgreSQL database configured
   Database tables created successfully
   ```

2. Test CRUD operations:
   ```bash
   # Login
   curl -X POST http://localhost:3001/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"INsure2026!"}'
   
   # Get entities (with token)
   curl http://localhost:3001/entities/Project \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Database Schema

The PostgreSQL schema includes these main tables:
- `users` - User accounts
- `contractors` - General contractors and subcontractors
- `projects` - Construction projects
- `project_subcontractors` - Subcontractor assignments
- `trades` - Trade classifications
- `insurance_documents` - Uploaded insurance documents
- `generated_cois` - Generated certificates of insurance
- `insurance_programs` - Insurance program definitions
- `sub_insurance_requirements` - Insurance requirements by trade
- `state_requirements` - State-specific requirements
- `brokers` - Insurance brokers
- `compliance_checks` - Compliance verification records

## Benefits of PostgreSQL

1. **Persistence**: Data survives server restarts
2. **Scalability**: Handle millions of records efficiently
3. **ACID Compliance**: Transactional integrity
4. **Advanced Queries**: Complex filtering and aggregation
5. **Concurrent Access**: Multiple users simultaneously
6. **Backup/Restore**: Standard database backup tools
7. **Production Ready**: Enterprise-grade reliability

## Rollback (If Needed)

To revert to in-memory storage:

1. Remove or comment out `DATABASE_URL` in `.env`:
   ```bash
   # DATABASE_URL=postgresql://...
   ```

2. Restart the backend - it will use in-memory storage with `data/entities.json`

## Troubleshooting

### Connection Failed
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify connection string format
- Check firewall/network access
- Verify username and password

### Migration Errors
- Ensure database is empty or use a new database
- Check data types in `entities.json` match model definitions
- Review error messages for specific field issues

### Performance Issues
- Add indexes to frequently queried fields
- Tune PostgreSQL configuration for your workload
- Use connection pooling (already configured)

## Next Steps

After successful migration:
1. Remove old `data/entities.json.backup` if not needed
2. Set up automated database backups
3. Configure PostgreSQL connection pooling if needed
4. Monitor database performance
5. Consider adding database migrations tool (Alembic)

## Support

For issues:
1. Check PostgreSQL logs: `tail -f /var/log/postgresql/postgresql-*.log`
2. Review backend logs for database errors
3. Verify SQLAlchemy model definitions match your data
