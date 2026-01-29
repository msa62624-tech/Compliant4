"""
Public router - Public endpoints that don't require authentication
Handles broker signing, pending COIs, etc.
"""
from fastapi import APIRouter, HTTPException, status, Query
from typing import Dict, Any, List, Optional
from config.logger_config import setup_logger
import uuid

logger = setup_logger(__name__)
router = APIRouter()


@router.post("/broker-sign-coi")
async def broker_sign_coi(
    token: str = Query(...),
    data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Broker signs COI using token (no auth required)"""
    try:
        logger.info(f"Broker signing COI with token: {token[:10]}...")
        
        # Mock broker signing
        return {
            "success": True,
            "message": "COI signed successfully",
            "coiId": str(uuid.uuid4())
        }
    except Exception as e:
        logger.error(f"Broker COI signing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/pending-cois")
async def get_pending_cois() -> List[Dict[str, Any]]:
    """Get list of pending COIs (public endpoint)"""
    try:
        logger.info("Fetching pending COIs")
        
        # Mock pending COIs
        return []
    except Exception as e:
        logger.error(f"Error fetching pending COIs: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
