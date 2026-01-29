"""
COI Generation Router
Handles COI PDF generation endpoints
Equivalent to Node.js backend's /integrations/generate-sample-coi endpoint
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from middleware.auth import verify_token
from services.coi_pdf_service import COIPDFService
from config.database import get_entity, entities
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])

# Initialize COI PDF service
uploads_dir = os.environ.get("UPLOADS_DIR", "uploads")
coi_pdf_service = COIPDFService(uploads_dir=uploads_dir)


class InsurerInfo(BaseModel):
    """Insurer information"""
    letter: str = Field(..., description="Insurer letter (A-F)")
    name: str = Field(..., description="Insurance company name")
    naic: str = Field(..., description="NAIC number")


class CoverageInfo(BaseModel):
    """Coverage information"""
    type: str = Field(..., description="Type of insurance coverage")
    insurer: str = Field(..., description="Insurer letter (A-F)")
    policyNumber: str = Field(..., description="Policy number")
    effectiveDate: str = Field(..., description="Effective date (MM/DD/YYYY)")
    expirationDate: str = Field(..., description="Expiration date (MM/DD/YYYY)")
    limits: Dict[str, str] = Field(..., description="Coverage limits")


class ProducerInfo(BaseModel):
    """Producer/broker information"""
    name: Optional[str] = "ABC Insurance Brokers LLC"
    contactName: Optional[str] = "Contact Name"
    address: Optional[str] = "123 Insurance Plaza"
    city: Optional[str] = "New York"
    state: Optional[str] = "NY"
    zipCode: Optional[str] = "10005"
    phone: Optional[str] = "(555) 123-4567"
    email: Optional[str] = "broker@insurance.com"


class InsuredInfo(BaseModel):
    """Insured information"""
    address: Optional[str] = "456 Builder Avenue"
    city: Optional[str] = "Brooklyn"
    state: Optional[str] = "NY"
    zipCode: Optional[str] = "11201"


class GenerateCOIRequest(BaseModel):
    """Request model for COI generation"""
    coiId: Optional[str] = None
    subcontractorName: str = Field(..., description="Name of the insured subcontractor")
    projectName: str = Field(..., description="Name of the project")
    gcName: str = Field(..., description="Name of the general contractor")
    producerInfo: Optional[ProducerInfo] = None
    insuredInfo: Optional[InsuredInfo] = None
    insurers: Optional[List[InsurerInfo]] = None
    coverages: Optional[List[CoverageInfo]] = None
    description: Optional[str] = None


@router.post("/generate-sample-coi", status_code=status.HTTP_201_CREATED)
async def generate_sample_coi(
    request: GenerateCOIRequest,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """
    Generate a sample COI PDF in ACORD 25 format
    
    This endpoint creates a Certificate of Insurance PDF document
    using the provided information.
    """
    try:
        logger.info(f"User {current_user.get('username')} requested COI generation for {request.subcontractorName}")
        
        # Convert request to dict for service
        coi_data = request.model_dump()
        
        # Generate PDF
        filename = coi_pdf_service.generate_coi_pdf(coi_data)
        
        # Construct file URL
        base_url = os.environ.get("API_BASE_URL", "http://localhost:3001")
        file_url = f"{base_url}/uploads/{filename}"
        
        return {
            "success": True,
            "message": "COI PDF generated successfully",
            "filename": filename,
            "url": file_url,
            "coiId": request.coiId or coi_data.get("coiId", "generated")
        }
        
    except Exception as e:
        logger.error(f"Failed to generate COI PDF: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate COI PDF: {str(e)}"
        )


@router.post("/regenerate-coi/{coi_id}", status_code=status.HTTP_200_OK)
async def regenerate_coi(
    coi_id: str,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """
    Regenerate a COI PDF from existing COI record
    
    This endpoint regenerates a COI PDF using data from an existing
    GeneratedCOI entity in the database.
    """
    try:
        # Fetch COI record from database
        coi_record = get_entity("GeneratedCOI", coi_id)
        
        if not coi_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"COI record not found: {coi_id}"
            )
        
        logger.info(f"User {current_user.get('username')} requested COI regeneration for COI {coi_id}")
        
        # Get related entities
        subcontractor_id = coi_record.get("subcontractor_id")
        project_id = coi_record.get("project_id")
        
        subcontractor = get_entity("ProjectSubcontractor", subcontractor_id) if subcontractor_id else {}
        project = get_entity("Project", project_id) if project_id else {}
        
        # Build COI data from records
        coi_data = {
            "coiId": coi_id,
            "subcontractorName": subcontractor.get("company_name", "Subcontractor"),
            "projectName": project.get("project_name", "Construction Project"),
            "gcName": project.get("gc_name", "General Contractor"),
            "description": f"Work performed for {project.get('project_name', 'project')} by {subcontractor.get('company_name', 'subcontractor')}."
        }
        
        # Generate PDF
        filename = coi_pdf_service.generate_coi_pdf(coi_data)
        
        # Construct file URL
        base_url = os.environ.get("API_BASE_URL", "http://localhost:3001")
        file_url = f"{base_url}/uploads/{filename}"
        
        return {
            "success": True,
            "message": "COI PDF regenerated successfully",
            "filename": filename,
            "url": file_url,
            "coiId": coi_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate COI PDF: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate COI PDF: {str(e)}"
        )
