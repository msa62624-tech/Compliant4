"""
Database configuration and entity storage
Equivalent to config/database.js in Node.js backend
In-memory storage for development (can be migrated to PostgreSQL)
"""
import json
import os
from typing import Dict, List, Any
import asyncio
from utils.timestamps import get_timestamp


# In-memory database storage
entities: Dict[str, List[Dict[str, Any]]] = {
    "Contractor": [],
    "Project": [],
    "ProjectSubcontractor": [],
    "User": [],
    "InsuranceDocument": [],
    "GeneratedCOI": [],
    "SubInsuranceRequirement": [],
    "StateRequirement": [],
    "InsuranceProgram": [],
    "Trade": [],
    "Broker": [],
    "BrokerUploadRequest": [],
    "Subscription": [],
    "PolicyDocument": [],
    "COIDocument": [],
    "ComplianceCheck": [],
    "ProgramTemplate": [],
    "Portal": [],
    "Message": [],
}

# Uploads directory
UPLOADS_DIR = "uploads"
DATA_FILE = "data/entities.json"


async def init_db():
    """Initialize database - load entities from file"""
    global entities
    
    # Create uploads directory
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    os.makedirs("data", exist_ok=True)
    
    # Load existing data if available
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                loaded_data = json.load(f)
                entities.update(loaded_data)
                print(f"Loaded entities from {DATA_FILE}")
        except Exception as e:
            print(f"Error loading entities: {e}")
            # Initialize with sample data if load fails
            from data.sample_data import get_sample_data
            entities.update(get_sample_data())
    else:
        # Initialize with sample data
        from data.sample_data import get_sample_data
        entities.update(get_sample_data())
        await save_entities()


async def save_entities():
    """Save entities to file (debounced in production)"""
    try:
        with open(DATA_FILE, "w") as f:
            json.dump(entities, f, indent=2, default=str)
        print(f"Saved entities to {DATA_FILE}")
    except Exception as e:
        print(f"Error saving entities: {e}")


async def close_db():
    """Close database connection and save data"""
    await save_entities()


def _schedule_async_save():
    """
    Schedule an async save operation if event loop is running
    Helper to reduce duplication across create/update/delete operations
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(save_entities())
    except RuntimeError:
        # No event loop running, skip async save
        # Data will be saved on next successful operation or shutdown
        pass


def get_entity(entity_type: str, entity_id: str) -> Dict[str, Any] | None:
    """Get a single entity by ID"""
    if entity_type not in entities:
        return None
    
    for entity in entities[entity_type]:
        if str(entity.get("id")) == str(entity_id):
            return entity
    
    return None


def create_entity(entity_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new entity"""
    if entity_type not in entities:
        raise ValueError(f"Unknown entity type: {entity_type}")
    
    # Generate ID if not provided
    if "id" not in data:
        import uuid
        data["id"] = str(uuid.uuid4())
    
    # Add timestamps using utility function
    timestamp = get_timestamp()
    data["created_at"] = timestamp
    data["updated_at"] = timestamp
    
    entities[entity_type].append(data)
    
    # Schedule async save
    _schedule_async_save()
    
    return data


def update_entity(entity_type: str, entity_id: str, data: Dict[str, Any]) -> Dict[str, Any] | None:
    """Update an existing entity"""
    if entity_type not in entities:
        return None
    
    for i, entity in enumerate(entities[entity_type]):
        if str(entity.get("id")) == str(entity_id):
            # Update fields
            entity.update(data)
            entity["updated_at"] = get_timestamp()
            entities[entity_type][i] = entity
            
            # Schedule async save
            _schedule_async_save()
            
            return entity
    
    return None


def delete_entity(entity_type: str, entity_id: str) -> bool:
    """Delete an entity"""
    if entity_type not in entities:
        return False
    
    original_length = len(entities[entity_type])
    entities[entity_type] = [
        e for e in entities[entity_type] 
        if str(e.get("id")) != str(entity_id)
    ]
    
    if len(entities[entity_type]) < original_length:
        # Schedule async save
        _schedule_async_save()
        return True
    
    return False


def find_valid_coi_for_sub(sub_id: str) -> Dict[str, Any] | None:
    """Find a valid COI for a subcontractor"""
    cois = entities.get("GeneratedCOI", [])
    
    for coi in cois:
        if coi.get("subcontractor_id") == sub_id:
            # Check if COI is still valid
            expiry = coi.get("expiration_date")
            if expiry:
                from datetime import datetime, timezone
                try:
                    expiry_date = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
                    if expiry_date > datetime.now(timezone.utc):
                        return coi
                except:
                    pass
    
    return None
