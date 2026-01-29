"""
Admin router - Admin-only endpoints
Handles COI generation, signing, and other admin functions
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Any
from middleware.auth import verify_token, require_admin
from config.logger_config import setup_logger
import uuid

logger = setup_logger(__name__)
router = APIRouter()


@router.post("/generate-coi")
async def generate_coi(
    data: Dict[str, Any],
    user: dict = Depends(require_admin)
) -> Dict[str, Any]:
    """Generate Certificate of Insurance (admin only)"""
    try:
        project_id = data.get("projectId")
        subcontractor_id = data.get("subcontractorId")
        
        logger.info(f"Generating COI for project: {project_id}, subcontractor: {subcontractor_id}")
        
        # Mock COI generation
        coi_id = str(uuid.uuid4())
        return {
            "success": True,
            "coiId": coi_id,
            "pdfUrl": f"/api/coi/{coi_id}/pdf",
            "message": "COI generated successfully"
        }
    except Exception as e:
        logger.error(f"COI generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/sign-coi")
async def sign_coi(
    data: Dict[str, Any],
    user: dict = Depends(require_admin)
) -> Dict[str, Any]:
    """Sign Certificate of Insurance (admin only)"""
    try:
        coi_id = data.get("coiId")
        signature = data.get("signature")
        
        logger.info(f"Signing COI: {coi_id}")
        
        # Mock COI signing
        return {
            "success": True,
            "coiId": coi_id,
            "status": "signed",
            "signedAt": "2026-01-29T15:00:00Z"
        }
    except Exception as e:
        logger.error(f"COI signing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
