"""
Tests for COI PDF generation service
"""
import pytest
import os
import sys

# Add backend-python to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.coi_pdf_service import COIPDFService


@pytest.fixture
def coi_service():
    """Create COI PDF service instance"""
    return COIPDFService(uploads_dir="/tmp/test_uploads")


@pytest.fixture
def sample_coi_data():
    """Sample COI data for testing"""
    return {
        "coiId": "test-001",
        "subcontractorName": "ABC Plumbing Corp",
        "projectName": "Downtown Construction Project",
        "gcName": "Main Street Contractors",
        "producerInfo": {
            "name": "XYZ Insurance Brokers",
            "contactName": "John Smith",
            "address": "123 Insurance Plaza",
            "city": "New York",
            "state": "NY",
            "zipCode": "10005",
            "phone": "(212) 555-1234",
            "email": "john@xyzbrokers.com"
        },
        "insuredInfo": {
            "address": "456 Plumbing Ave",
            "city": "Brooklyn",
            "state": "NY",
            "zipCode": "11201"
        },
        "insurers": [
            {"letter": "A", "name": "National Liability Insurance Co.", "naic": "10001"},
            {"letter": "B", "name": "Workers Comp Fund", "naic": "10002"}
        ],
        "coverages": [
            {
                "type": "GENERAL LIABILITY",
                "insurer": "A",
                "policyNumber": "GL-2026-123456",
                "effectiveDate": "01/01/2026",
                "expirationDate": "01/01/2027",
                "limits": {
                    "eachOccurrence": "$1,000,000",
                    "aggregate": "$2,000,000"
                }
            }
        ],
        "description": "Plumbing work for Downtown Construction Project"
    }


def test_generate_coi_pdf_success(coi_service, sample_coi_data):
    """Test successful COI PDF generation"""
    filename = coi_service.generate_coi_pdf(sample_coi_data)
    
    # Verify filename format
    assert filename.startswith("coi-test-001-")
    assert filename.endswith(".pdf")
    
    # Verify file exists
    filepath = os.path.join(coi_service.uploads_dir, filename)
    assert os.path.exists(filepath)
    
    # Verify file size (should be non-zero)
    assert os.path.getsize(filepath) > 0
    
    # Cleanup
    os.remove(filepath)


def test_generate_coi_pdf_minimal_data(coi_service):
    """Test COI PDF generation with minimal data"""
    minimal_data = {
        "coiId": "test-002",
        "subcontractorName": "Test Sub",
        "projectName": "Test Project",
        "gcName": "Test GC"
    }
    
    filename = coi_service.generate_coi_pdf(minimal_data)
    
    # Verify file was created
    filepath = os.path.join(coi_service.uploads_dir, filename)
    assert os.path.exists(filepath)
    
    # Cleanup
    os.remove(filepath)


def test_generate_coi_pdf_missing_required_fields(coi_service):
    """Test COI PDF generation with missing required fields"""
    invalid_data = {
        "coiId": "test-003"
        # Missing required fields
    }
    
    # Should handle gracefully and generate PDF with defaults
    filename = coi_service.generate_coi_pdf(invalid_data)
    filepath = os.path.join(coi_service.uploads_dir, filename)
    assert os.path.exists(filepath)
    
    # Cleanup
    os.remove(filepath)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
