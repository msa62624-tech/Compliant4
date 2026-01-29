"""
PDF extraction and parsing service
Handles PDF text extraction and insurance program parsing
"""
import re
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime, timezone
from config.logger_config import setup_logger

logger = setup_logger(__name__)

# Try to import PDF library
try:
    from PyPDF2 import PdfReader
    PDF_AVAILABLE = True
except ImportError:
    logger.warning("PyPDF2 not available - PDF extraction will be limited")
    PDF_AVAILABLE = False


async def extract_text_from_pdf(file_path: Path) -> str:
    """
    Extract text content from PDF file
    Returns extracted text or empty string if extraction fails
    """
    if not PDF_AVAILABLE:
        logger.error("PyPDF2 not installed - cannot extract PDF text")
        return ""
    
    try:
        reader = PdfReader(str(file_path))
        text_content = []
        
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_content.append(page_text)
        
        full_text = "\n".join(text_content)
        logger.info(f"Extracted {len(full_text)} characters from PDF")
        return full_text
        
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return ""


def parse_insurance_program_pdf(text: str) -> Dict[str, Any]:
    """
    Parse insurance program PDF text to extract requirements
    Ported from Node.js backend - handles 3 different PDF formats
    
    Pattern 1: Tier/Trade table format
    Pattern 2: Prime Subcontractor format  
    Pattern 3: General tier format
    """
    
    requirements = []
    
    # Pattern 1: Tier/Trade table format
    # Example: "Tier 1 General Contractor $2,000,000 GL"
    pattern1_matches = re.finditer(
        r'Tier\s+(\d+)\s+([^\$]+)\$([0-9,]+)',
        text,
        re.IGNORECASE | re.MULTILINE
    )
    
    for match in pattern1_matches:
        tier = match.group(1)
        trade = match.group(2).strip()
        limit = match.group(3).replace(',', '')
        
        requirements.append({
            "tier": int(tier),
            "trade": trade,
            "gl_per_occurrence": int(limit),
            "pattern": "tier_trade_table"
        })
        logger.debug(f"Pattern 1 match: Tier {tier}, {trade}, ${limit}")
    
    # Pattern 2: Prime Subcontractor format
    # Example: "Prime Subcontractor: $5,000,000"
    pattern2_matches = re.finditer(
        r'Prime\s+Subcontractor[:\s]+\$([0-9,]+)',
        text,
        re.IGNORECASE
    )
    
    for match in pattern2_matches:
        limit = match.group(1).replace(',', '')
        requirements.append({
            "tier": 1,
            "trade": "Prime Subcontractor",
            "gl_per_occurrence": int(limit),
            "pattern": "prime_subcontractor"
        })
        logger.debug(f"Pattern 2 match: Prime Subcontractor, ${limit}")
    
    # Pattern 3: General tier format
    # Example: "All Tier 1 trades: $3,000,000"
    pattern3_matches = re.finditer(
        r'(?:All\s+)?Tier\s+(\d+)(?:\s+trades?)?[:\s]+\$([0-9,]+)',
        text,
        re.IGNORECASE
    )
    
    for match in pattern3_matches:
        tier = match.group(1)
        limit = match.group(2).replace(',', '')
        requirements.append({
            "tier": int(tier),
            "trade": f"Tier {tier} (All Trades)",
            "gl_per_occurrence": int(limit),
            "pattern": "general_tier"
        })
        logger.debug(f"Pattern 3 match: Tier {tier}, ${limit}")
    
    # Extract additional insurance types if present
    # Workers' Compensation
    wc_matches = re.finditer(
        r"Workers?\s*['\"]?\s*Comp(?:ensation)?[:\s]+\$([0-9,]+)",
        text,
        re.IGNORECASE
    )
    for match in wc_matches:
        limit = match.group(1).replace(',', '')
        requirements.append({
            "type": "workers_comp",
            "limit": int(limit),
            "pattern": "workers_comp"
        })
    
    # Auto Insurance
    auto_matches = re.finditer(
        r'Auto(?:mobile)?\s+(?:Liability)?[:\s]+\$([0-9,]+)',
        text,
        re.IGNORECASE
    )
    for match in auto_matches:
        limit = match.group(1).replace(',', '')
        requirements.append({
            "type": "auto",
            "limit": int(limit),
            "pattern": "auto"
        })
    
    # Umbrella/Excess
    umbrella_matches = re.finditer(
        r'(?:Umbrella|Excess)[:\s]+\$([0-9,]+)',
        text,
        re.IGNORECASE
    )
    for match in umbrella_matches:
        limit = match.group(1).replace(',', '')
        requirements.append({
            "type": "umbrella",
            "limit": int(limit),
            "pattern": "umbrella"
        })
    
    logger.info(f"Parsed {len(requirements)} insurance requirements from PDF")
    
    return {
        "success": True,
        "requirements": requirements,
        "totalFound": len(requirements)
    }


def analyze_coi_compliance(coi_data: Dict[str, Any], program_requirements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze COI compliance against program requirements
    Returns compliance status and issues
    """
    issues = []
    compliant = True
    
    # Check GL coverage
    coi_gl_limit = coi_data.get("gl_limits_per_occurrence", 0)
    
    for req in program_requirements:
        required_limit = req.get("gl_per_occurrence", 0)
        trade = req.get("trade", "Unknown")
        
        if required_limit > 0 and coi_gl_limit < required_limit:
            compliant = False
            issues.append({
                "type": "coverage_insufficient",
                "trade": trade,
                "required": required_limit,
                "actual": coi_gl_limit,
                "severity": "high"
            })
    
    # Check expiration
    expiration_date = coi_data.get("expiration_date") or coi_data.get("gl_expiration_date")
    if expiration_date:
        try:
            expiry_dt = datetime.fromisoformat(expiration_date.replace("Z", "+00:00"))
            if expiry_dt <= datetime.now(timezone.utc):
                compliant = False
                issues.append({
                    "type": "expired_coverage",
                    "message": "Certificate of Insurance has expired",
                    "expiration_date": expiration_date,
                    "severity": "critical"
                })
        except (ValueError, AttributeError) as e:
            logger.warning(f"Invalid expiration date format: {expiration_date}, error: {e}")
            issues.append({
                "type": "invalid_expiration_date",
                "message": "Unable to parse expiration date",
                "severity": "medium"
            })
    else:
        compliant = False
        issues.append({
            "type": "missing_expiration_date",
            "message": "Expiration date not found in COI",
            "severity": "high"
        })
    
    # Check additional insured
    required_additional_insured = []
    for req in program_requirements:
        if req.get("additional_insured"):
            required_additional_insured.append(req["additional_insured"])
    
    if required_additional_insured:
        coi_additional_insured = coi_data.get("additional_insured", [])
        if isinstance(coi_additional_insured, str):
            coi_additional_insured = [coi_additional_insured]
        
        missing_additional_insured = []
        for required in required_additional_insured:
            # Check if any of the COI's additional insureds match the required one
            found = False
            for coi_ai in coi_additional_insured:
                if required.lower() in str(coi_ai).lower():
                    found = True
                    break
            if not found:
                missing_additional_insured.append(required)
        
        if missing_additional_insured:
            compliant = False
            issues.append({
                "type": "missing_additional_insured",
                "message": "Required additional insured(s) not found in COI",
                "missing": missing_additional_insured,
                "severity": "high"
            })
    
    return {
        "compliant": compliant,
        "issues": issues,
        "summary": f"{'Compliant' if compliant else 'Non-compliant'} - {len(issues)} issues found"
    }
