"""
AI Analysis Router
Handles AI-powered insurance document analysis endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from middleware.auth import verify_token
from integrations.ai_analysis_service import AIAnalysisService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai-analysis"])

# Initialize AI service
ai_service = AIAnalysisService()


class COIComplianceRequest(BaseModel):
    """Request for COI compliance analysis"""
    coi_data: Dict[str, Any] = Field(..., description="Extracted COI data")
    requirements: Optional[Dict[str, Any]] = Field(None, description="Project insurance requirements")


class PolicyExtractionRequest(BaseModel):
    """Request for policy data extraction"""
    policy_text: str = Field(..., description="Raw text from policy document")
    policy_type: str = Field("gl", description="Type of policy (gl, wc, umbrella, auto)")


class Deficiency(BaseModel):
    """Deficiency model"""
    title: str
    description: str
    severity: Optional[str] = "medium"


class RecommendationRequest(BaseModel):
    """Request for recommendations"""
    coi_data: Dict[str, Any] = Field(..., description="COI data")
    deficiencies: Optional[List[Dict[str, Any]]] = Field(None, description="List of deficiencies")


@router.post("/analyze-coi-compliance", status_code=status.HTTP_200_OK)
async def analyze_coi_compliance(
    request: COIComplianceRequest,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """
    Analyze a COI for compliance with project requirements
    
    Uses AI to evaluate insurance coverage, limits, dates, and endorsements
    against project requirements.
    """
    try:
        logger.info(f"User {current_user.get('username')} requested COI compliance analysis")
        
        result = await ai_service.analyze_coi_compliance(
            request.coi_data,
            request.requirements
        )
        
        return {
            "success": True,
            "message": "COI compliance analysis completed",
            "ai_enabled": ai_service.enabled,
            **result
        }
        
    except Exception as e:
        logger.error(f"COI compliance analysis failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze COI compliance: {str(e)}"
        )


@router.post("/extract-policy-data", status_code=status.HTTP_200_OK)
async def extract_policy_data(
    request: PolicyExtractionRequest,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """
    Extract structured data from insurance policy text
    
    Uses AI to parse and structure insurance policy information.
    """
    try:
        logger.info(f"User {current_user.get('username')} requested policy data extraction for type: {request.policy_type}")
        
        result = await ai_service.extract_policy_data(
            request.policy_text,
            request.policy_type
        )
        
        return {
            "success": True,
            "message": "Policy data extracted successfully",
            "ai_enabled": ai_service.enabled,
            "policy_data": result
        }
        
    except Exception as e:
        logger.error(f"Policy data extraction failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract policy data: {str(e)}"
        )


@router.post("/generate-recommendations", status_code=status.HTTP_200_OK)
async def generate_recommendations(
    request: RecommendationRequest,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """
    Generate review recommendations for admin reviewer
    
    Uses AI to provide actionable recommendations based on COI data
    and identified deficiencies.
    """
    try:
        logger.info(f"User {current_user.get('username')} requested review recommendations")
        
        result = await ai_service.generate_recommendations(
            request.coi_data,
            request.deficiencies
        )
        
        return {
            "success": True,
            "message": "Recommendations generated successfully",
            "ai_enabled": ai_service.enabled,
            "recommendations": result
        }
        
    except Exception as e:
        logger.error(f"Recommendation generation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recommendations: {str(e)}"
        )


@router.get("/status", status_code=status.HTTP_200_OK)
async def get_ai_status(current_user: Dict[str, Any] = Depends(verify_token)):
    """
    Get AI service status and configuration
    """
    return {
        "enabled": ai_service.enabled,
        "provider": ai_service.provider,
        "model": ai_service.model if ai_service.enabled else None,
        "message": "AI service is enabled" if ai_service.enabled else "AI service is disabled - set AI_API_KEY to enable"
    }
