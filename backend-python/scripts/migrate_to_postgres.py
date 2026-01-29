"""
Database migration script
Migrates data from in-memory JSON storage to PostgreSQL
"""
import sys
import os
import json
import asyncio

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from config.postgres import engine, SessionLocal, USE_POSTGRES, init_postgres_db
from models.entities import (
    User, Contractor, Project, ProjectSubcontractor, Trade,
    InsuranceDocument, GeneratedCOI, InsuranceProgram,
    SubInsuranceRequirement, StateRequirement, Broker, ComplianceCheck
)


# Entity mapping: JSON entity name -> SQLAlchemy model
ENTITY_MODELS = {
    "User": User,
    "Contractor": Contractor,
    "Project": Project,
    "ProjectSubcontractor": ProjectSubcontractor,
    "Trade": Trade,
    "InsuranceDocument": InsuranceDocument,
    "GeneratedCOI": GeneratedCOI,
    "InsuranceProgram": InsuranceProgram,
    "SubInsuranceRequirement": SubInsuranceRequirement,
    "StateRequirement": StateRequirement,
    "Broker": Broker,
    "ComplianceCheck": ComplianceCheck,
}


def load_json_data(json_file: str = "data/entities.json"):
    """Load data from JSON file"""
    if not os.path.exists(json_file):
        print(f"❌ JSON file not found: {json_file}")
        return None
    
    with open(json_file, "r") as f:
        return json.load(f)


def migrate_entity(db: Session, entity_type: str, records: list):
    """Migrate entities of a specific type"""
    model = ENTITY_MODELS.get(entity_type)
    if not model:
        print(f"⚠️  Skipping unknown entity type: {entity_type}")
        return 0
    
    count = 0
    for record in records:
        try:
            # Create model instance
            obj = model(**record)
            db.add(obj)
            count += 1
        except Exception as e:
            print(f"⚠️  Failed to migrate {entity_type} record {record.get('id')}: {str(e)}")
    
    return count


def run_migration():
    """Run the migration"""
    if not USE_POSTGRES:
        print("❌ PostgreSQL not configured. Set DATABASE_URL environment variable.")
        print("Example: postgresql://user:password@localhost:5432/compliant4")
        sys.exit(1)
    
    print("🔄 Starting migration from JSON to PostgreSQL...")
    print(f"Database URL: {os.environ.get('DATABASE_URL', '').split('@')[-1]}")  # Hide credentials
    
    # Initialize database tables
    print("\n📋 Creating database tables...")
    init_postgres_db()
    
    # Load JSON data
    print("\n📂 Loading JSON data...")
    data = load_json_data()
    if not data:
        sys.exit(1)
    
    # Migrate data
    print("\n🔄 Migrating data...\n")
    db = SessionLocal()
    
    try:
        total_migrated = 0
        
        for entity_type, records in data.items():
            if entity_type in ENTITY_MODELS:
                count = migrate_entity(db, entity_type, records)
                print(f"✅ Migrated {count} {entity_type} records")
                total_migrated += count
            else:
                print(f"⚠️  Skipped {entity_type} ({len(records)} records)")
        
        # Commit all changes
        db.commit()
        print(f"\n✅ Migration complete! Migrated {total_migrated} total records")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Database Migration Tool")
    print("Migrates from JSON (in-memory) to PostgreSQL")
    print("=" * 60)
    
    # Check if PostgreSQL is configured
    if not os.environ.get("DATABASE_URL"):
        print("\n⚠️  DATABASE_URL not set!")
        print("\nUsage:")
        print("  export DATABASE_URL='postgresql://user:password@localhost:5432/compliant4'")
        print("  python scripts/migrate_to_postgres.py")
        sys.exit(1)
    
    # Confirm with user
    print("\n⚠️  WARNING: This will import data into PostgreSQL.")
    print("Make sure the database is empty or you may have duplicate data.")
    response = input("\nContinue? (yes/no): ")
    
    if response.lower() != "yes":
        print("Migration cancelled.")
        sys.exit(0)
    
    run_migration()
