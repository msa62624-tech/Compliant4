"""
Sample data for development
Equivalent to data/sampleData.js in Node.js backend
"""
from datetime import datetime, timedelta
import uuid


def get_sample_data():
    """Return sample data for all entities"""
    
    # Create timestamp
    now = datetime.utcnow()
    
    return {
        "Contractor": [
            {
                "id": "gc-1",
                "company_name": "Prime Construction Corp",
                "contractor_type": "general_contractor",
                "email": "admin@primeconstruction.com",
                "phone": "212-555-0100",
                "status": "active",
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
        ],
        "Project": [
            {
                "id": "proj-1",
                "name": "Downtown Office Tower",
                "gc_id": "gc-1",
                "status": "active",
                "budget": 5000000,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
        ],
        "ProjectSubcontractor": [],
        "User": [],
        "InsuranceDocument": [],
        "GeneratedCOI": [],
        "SubInsuranceRequirement": [],
        "StateRequirement": [],
        "InsuranceProgram": [],
        "Trade": [
            {
                "id": "trade-1",
                "name": "Electrical",
                "created_at": now.isoformat()
            },
            {
                "id": "trade-2",
                "name": "Plumbing",
                "created_at": now.isoformat()
            }
        ],
        "Broker": [],
        "BrokerUploadRequest": [],
        "Subscription": [],
        "PolicyDocument": [],
        "COIDocument": [],
        "ComplianceCheck": [],
        "ProgramTemplate": [],
        "Portal": [],
        "Message": []
    }
