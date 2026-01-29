"""
Adobe PDF Services Integration
Handles PDF extraction, text recognition, and digital signatures
Equivalent to Node.js backend's adobe-pdf-service.js
"""
import os
import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)


class AdobePDFService:
    """Service for Adobe PDF Services integration"""
    
    def __init__(self):
        self.api_key = os.environ.get("ADOBE_API_KEY")
        self.client_id = os.environ.get("ADOBE_CLIENT_ID")
        self.base_url = "https://pdf-services.adobe.io"
        self.enabled = bool(self.api_key and self.client_id)
        
        if self.enabled:
            logger.info("Adobe PDF Services enabled")
        else:
            logger.warning("Adobe PDF Services disabled - set ADOBE_API_KEY and ADOBE_CLIENT_ID to enable")
    
    async def extract_text(self, file_url: str) -> Dict[str, Any]:
        """
        Extract text from a PDF file
        
        Args:
            file_url: URL of the PDF file
            
        Returns:
            Dictionary with text, pages, and metadata
        """
        if not self.enabled:
            return await self._mock_extract_text(file_url)
        
        try:
            logger.info(f"Extracting text from PDF: {file_url}")
            # In production, call Adobe PDF Extract API
            # For now, return mock data
            return await self._mock_extract_text(file_url)
            
        except Exception as e:
            logger.error(f"Adobe PDF extraction failed: {str(e)}", exc_info=True)
            raise
    
    async def extract_coi_fields(self, file_url: str) -> Dict[str, Any]:
        """
        Extract structured fields from COI
        
        Args:
            file_url: URL of the COI PDF
            
        Returns:
            Structured COI data with extracted fields
        """
        try:
            text_data = await self.extract_text(file_url)
            text = text_data.get("text", "")
            
            # Pattern matching for common COI fields
            extracted = {
                "source": file_url,
                "extractedAt": datetime.utcnow().isoformat(),
                "insurance_carriers": [],
                "policy_numbers": [],
                "coverage_limits": [],
                "effective_dates": [],
                "expiration_dates": [],
                "additional_insureds": [],
                "contact_emails": []
            }
            
            # Extract policy numbers (format: POL-XXXX-YYYY or similar)
            policy_regex = r"POL[-]?\w+[-]?\d+"
            extracted["policy_numbers"] = list(set(re.findall(policy_regex, text, re.IGNORECASE)))
            
            # Extract coverage amounts (format: $X,XXX,XXX)
            amount_regex = r"\$[\d,]+(?:,\d{3})*(?:\.\d{2})?"
            extracted["coverage_limits"] = list(set(re.findall(amount_regex, text)))
            
            # Extract dates (MM/DD/YYYY)
            date_regex = r"\d{2}/\d{2}/\d{4}"
            dates = list(set(re.findall(date_regex, text)))
            extracted["expiration_dates"] = dates
            extracted["effective_dates"] = dates
            
            # Extract email addresses
            email_regex = r"[\w.-]+@[\w.-]+\.\w+"
            extracted["contact_emails"] = list(set(re.findall(email_regex, text)))
            
            # Extract insurance company names (basic pattern)
            # Look for lines with "Insurance", "Insurer", "Company"
            insurer_lines = re.findall(r"(?:INSURER|INSURANCE|COMPANY)\s+[A-Z]:\s*([A-Za-z\s&.,]+)", text, re.IGNORECASE)
            extracted["insurance_carriers"] = [name.strip() for name in insurer_lines]
            
            return extracted
            
        except Exception as e:
            logger.error(f"COI field extraction failed: {str(e)}", exc_info=True)
            raise
    
    async def sign_pdf(self, file_url: str, signature_data: Optional[Dict[str, Any]] = None) -> str:
        """
        Apply digital signature to PDF
        
        Args:
            file_url: URL of the PDF to sign
            signature_data: Signature image or data
            
        Returns:
            URL of signed PDF
        """
        if not self.enabled:
            logger.warning("Adobe PDF service not configured, using mock signature")
            return f"{file_url}?signed=true&timestamp={int(datetime.utcnow().timestamp())}"
        
        try:
            logger.info(f"Signing PDF: {file_url}")
            # In production, call Adobe Sign API
            # For now, return mock signed URL
            return f"{file_url}?signed=true&timestamp={int(datetime.utcnow().timestamp())}"
            
        except Exception as e:
            logger.error(f"Adobe PDF signing failed: {str(e)}", exc_info=True)
            raise
    
    async def merge_pdfs(self, file_urls: List[str]) -> str:
        """
        Merge multiple PDFs
        
        Args:
            file_urls: Array of PDF URLs to merge
            
        Returns:
            URL of merged PDF
        """
        try:
            logger.info(f"Merging {len(file_urls)} PDFs")
            # In production, call Adobe PDF Combine API
            # For now, return mock merged URL
            return f"https://storage.example.com/merged-{int(datetime.utcnow().timestamp())}.pdf"
            
        except Exception as e:
            logger.error(f"PDF merge failed: {str(e)}", exc_info=True)
            raise
    
    async def _mock_extract_text(self, file_url: str) -> Dict[str, Any]:
        """Mock extraction for development"""
        return {
            "text": """CERTIFICATE OF INSURANCE

Date (MM/DD/YYYY)
01/15/2026

PRODUCER: Acme Insurance Brokers
Email: broker@acmeins.com
Phone: (555) 123-4567

INSURER A: National Insurance Company
POLICY #: POL-GL-2026-0001
General Liability: $2,000,000 Each Occurrence

INSURER B: State Workers Compensation Fund
POLICY #: WC-NJ-2026-0001
Workers Compensation: Statutory Limits

INSURED: MPI Plumbing Corp
Address: 123 Main St, Newark, NJ 07102

Additional Insured: General Contractor XYZ
Waiver of Subrogation: Yes
Primary and Non-Contributory: Yes

Effective Date: 01/01/2026
Expiration Date: 01/01/2027""",
            "pages": 1,
            "metadata": {
                "source": file_url,
                "extractedAt": datetime.utcnow().isoformat(),
                "confidence": 0.95
            }
        }
