"""
Tests for Adobe PDF service
"""
import pytest
import os
import sys

# Add backend-python to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from integrations.adobe_pdf_service import AdobePDFService


@pytest.fixture
def adobe_service():
    """Create Adobe PDF service instance"""
    # Ensure Adobe is disabled for tests (no API key)
    os.environ.pop("ADOBE_API_KEY", None)
    os.environ.pop("ADOBE_CLIENT_ID", None)
    return AdobePDFService()


@pytest.mark.asyncio
async def test_extract_text_mock(adobe_service):
    """Test PDF text extraction with mock data"""
    file_url = "https://example.com/test.pdf"
    
    result = await adobe_service.extract_text(file_url)
    
    # Verify response structure
    assert "text" in result
    assert "pages" in result
    assert "metadata" in result
    
    # Verify text content
    assert isinstance(result["text"], str)
    assert len(result["text"]) > 0
    
    # Verify metadata
    metadata = result["metadata"]
    assert "source" in metadata
    assert metadata["source"] == file_url


@pytest.mark.asyncio
async def test_extract_coi_fields_mock(adobe_service):
    """Test COI field extraction with mock data"""
    file_url = "https://example.com/coi.pdf"
    
    result = await adobe_service.extract_coi_fields(file_url)
    
    # Verify response structure
    assert "source" in result
    assert "extractedAt" in result
    assert "policy_numbers" in result
    assert "coverage_limits" in result
    assert "effective_dates" in result
    assert "expiration_dates" in result
    assert "contact_emails" in result
    
    # Verify arrays
    assert isinstance(result["policy_numbers"], list)
    assert isinstance(result["coverage_limits"], list)


@pytest.mark.asyncio
async def test_sign_pdf_mock(adobe_service):
    """Test PDF signing with mock data"""
    file_url = "https://example.com/document.pdf"
    
    signed_url = await adobe_service.sign_pdf(file_url)
    
    # Verify signed URL format
    assert signed_url.startswith(file_url)
    assert "signed=true" in signed_url
    assert "timestamp=" in signed_url


@pytest.mark.asyncio
async def test_merge_pdfs_mock(adobe_service):
    """Test PDF merging with mock data"""
    file_urls = [
        "https://example.com/doc1.pdf",
        "https://example.com/doc2.pdf",
        "https://example.com/doc3.pdf"
    ]
    
    merged_url = await adobe_service.merge_pdfs(file_urls)
    
    # Verify merged URL format
    assert merged_url.startswith("https://storage.example.com/merged-")
    assert merged_url.endswith(".pdf")


def test_adobe_service_disabled_by_default(adobe_service):
    """Test that Adobe service is disabled when no API key is set"""
    assert adobe_service.enabled is False
    assert adobe_service.api_key is None
    assert adobe_service.client_id is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
