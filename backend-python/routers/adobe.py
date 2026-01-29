"""
Adobe PDF Services Router
Handles PDF extraction, signing, and merging endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from middleware.auth import verify_token
from integrations.adobe_pdf_service import AdobePDFService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/adobe", tags=["adobe-pdf"])

# Initialize Adobe PDF service
adobe_service = AdobePDFService()


class ExtractTextRequest(BaseModel):
    """Request for text extraction"""
    file_url: str = Field(..., description="URL of the PDF file")


class ExtractCOIRequest(BaseModel):
    """Request for COI field extraction"""
    file_url: str = Field(..., description="URL of the COI PDF")


class SignPDFRequest(BaseModel):
    """Request for PDF signing"""
    file_url: str = Field(..., description="URL of the PDF to sign")
    signature_data: Optional[Dict[str, Any]] = Field(None, description="Signature data")


class MergePDFsRequest(BaseModel):
    """Request for PDF merging"""
    file_urls: List[str] = Field(..., description="List of PDF URLs to merge")


@router.post("/extract-text", status_code=status.HTTP_200_OK)
async def extract_text(
    request: ExtractTextRequest,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """
    Extract text from a PDF file
    
    Uses Adobe PDF Services to extract text content from PDFs.
    Falls back to mock data if Adobe services are not configured.
    """
    try:
        logger.info(f"User {current_user.get('username')} requested text extraction from: {request.file_url}")
        
        result = await adobe_service.extract_text(request.file_url)
        
        return {
            "success": True,
            "message": "Text extracted successfully",
            "adobe_enabled": adobe_service.enabled,
            **result
        }
        
    except Exception as e:
        logger.error(f"Text extraction failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract text: {str(e)}"
        )


@router.post("/extract-coi-fields", status_code=status.HTTP_200_OK)
async def extract_coi_fields(
    request: ExtractCOIRequest,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """
    Extract structured fields from a COI PDF
    
    Extracts policy numbers, coverage limits, dates, insurers, and other
    structured data from Certificate of Insurance documents.
    """
    try:
        logger.info(f"User {current_user.get('username')} requested COI field extraction from: {request.file_url}")
        
        result = await adobe_service.extract_coi_fields(request.file_url)
        
        return {
            "success": True,
            "message": "COI fields extracted successfully",
            "adobe_enabled": adobe_service.enabled,
            "extracted_data": result
        }
        
    except Exception as e:
        logger.error(f"COI field extraction failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract COI fields: {str(e)}"
        )


@router.post("/sign-pdf", status_code=status.HTTP_200_OK)
async def sign_pdf(
    request: SignPDFRequest,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """
    Apply digital signature to a PDF
    
    Uses Adobe Sign API to add digital signatures to PDFs.
    """
    try:
        logger.info(f"User {current_user.get('username')} requested PDF signing for: {request.file_url}")
        
        signed_url = await adobe_service.sign_pdf(request.file_url, request.signature_data)
        
        return {
            "success": True,
            "message": "PDF signed successfully",
            "adobe_enabled": adobe_service.enabled,
            "signed_url": signed_url
        }
        
    except Exception as e:
        logger.error(f"PDF signing failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sign PDF: {str(e)}"
        )


@router.post("/merge-pdfs", status_code=status.HTTP_200_OK)
async def merge_pdfs(
    request: MergePDFsRequest,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """
    Merge multiple PDFs into one
    
    Uses Adobe PDF Services to combine multiple PDF files.
    """
    try:
        logger.info(f"User {current_user.get('username')} requested merging {len(request.file_urls)} PDFs")
        
        merged_url = await adobe_service.merge_pdfs(request.file_urls)
        
        return {
            "success": True,
            "message": f"Successfully merged {len(request.file_urls)} PDFs",
            "adobe_enabled": adobe_service.enabled,
            "merged_url": merged_url
        }
        
    except Exception as e:
        logger.error(f"PDF merge failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to merge PDFs: {str(e)}"
        )


@router.get("/status", status_code=status.HTTP_200_OK)
async def get_adobe_status(current_user: Dict[str, Any] = Depends(verify_token)):
    """
    Get Adobe PDF Services status and configuration
    """
    return {
        "enabled": adobe_service.enabled,
        "message": "Adobe PDF Services is enabled" if adobe_service.enabled else "Adobe PDF Services is disabled - set ADOBE_API_KEY and ADOBE_CLIENT_ID to enable"
    }
