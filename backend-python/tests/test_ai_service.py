"""
Tests for AI analysis service
"""
import pytest
import os
import sys

# Add backend-python to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from integrations.ai_analysis_service import AIAnalysisService


@pytest.fixture
def ai_service():
    """Create AI analysis service instance"""
    # Ensure AI is disabled for tests (no API key)
    os.environ.pop("AI_API_KEY", None)
    os.environ.pop("OPENAI_API_KEY", None)
    return AIAnalysisService()


@pytest.fixture
def sample_coi_data():
    """Sample COI data for testing"""
    return {
        "subcontractor_name": "ABC Plumbing Corp",
        "project_name": "Downtown Construction Project",
        "policy_numbers": ["GL-2026-123456", "WC-2026-123456"],
        "coverage_limits": ["$1,000,000", "$2,000,000"],
        "effective_date": "2026-01-01",
        "expiration_date": "2027-01-01"
    }


@pytest.mark.asyncio
async def test_analyze_coi_compliance_mock(ai_service, sample_coi_data):
    """Test COI compliance analysis with mock data"""
    result = await ai_service.analyze_coi_compliance(sample_coi_data, {})
    
    # Verify response structure
    assert "analysis" in result
    assert "deficiencies" in result
    assert "recommendations" in result
    
    # Verify analysis fields
    analysis = result["analysis"]
    assert "compliant" in analysis
    assert "compliance_score" in analysis
    assert isinstance(analysis["compliance_score"], (int, float))
    assert 0 <= analysis["compliance_score"] <= 100


@pytest.mark.asyncio
async def test_extract_policy_data_mock(ai_service):
    """Test policy data extraction with mock data"""
    policy_text = "Policy GL-2026-123456 with $1,000,000 coverage"
    
    result = await ai_service.extract_policy_data(policy_text, "gl")
    
    # Verify response structure
    assert "policy_number" in result
    assert "coverage_type" in result
    assert "limits" in result
    
    # Verify coverage type
    assert result["coverage_type"] == "GL"


@pytest.mark.asyncio
async def test_generate_recommendations_mock(ai_service, sample_coi_data):
    """Test recommendation generation with mock data"""
    deficiencies = [
        {
            "title": "Test deficiency",
            "description": "Test description"
        }
    ]
    
    result = await ai_service.generate_recommendations(sample_coi_data, deficiencies)
    
    # Verify recommendations list
    assert isinstance(result, list)
    assert len(result) > 0
    
    # Verify recommendation structure
    for rec in result:
        assert "priority" in rec
        assert "action" in rec
        assert "reason" in rec


def test_ai_service_disabled_by_default(ai_service):
    """Test that AI service is disabled when no API key is set"""
    assert ai_service.enabled is False
    assert ai_service.api_key is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
