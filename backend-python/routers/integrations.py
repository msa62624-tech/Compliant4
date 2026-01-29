"""
Integrations router - External service integrations
Handles file uploads, email, PDF processing, LLM, Adobe Sign, etc.
"""
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from typing import Dict, Any, Optional, List
from middleware.auth import verify_token
from config.logger_config import setup_logger
from services.file_storage import save_upload_file, get_file_path, delete_file, get_file_info
from services.pdf_service import extract_text_from_pdf, parse_insurance_program_pdf, analyze_coi_compliance
import base64
import uuid

logger = setup_logger(__name__)
router = APIRouter()


@router.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Upload a file with real disk storage"""
    try:
        # Save file to disk with validation
        file_metadata = await save_upload_file(file, entity_type, entity_id)
        
        logger.info(f"File uploaded: {file_metadata['filename']} (ID: {file_metadata['id']})")
        
        return {
            "success": True,
            "fileId": file_metadata["id"],
            "filename": file_metadata["filename"],
            "size": file_metadata["size"],
            "mimeType": file_metadata["mimeType"],
            "path": file_metadata["relativePath"]
        }
    except ValueError as e:
        # Validation errors
        logger.warning(f"File validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File upload failed: {str(e)}"
        )


@router.post("/extract-data")
async def extract_data(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Extract data from uploaded PDF file"""
    try:
        file_id = data.get("fileId")
        if not file_id:
            raise ValueError("fileId is required")
        
        # Get file path
        file_path = get_file_path(file_id)
        if not file_path or not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        logger.info(f"Extracting data from file: {file_id}")
        
        # Extract text from PDF
        text = await extract_text_from_pdf(file_path)
        
        return {
            "success": True,
            "data": {
                "text": text,
                "metadata": {
                    "fileId": file_id,
                    "textLength": len(text)
                }
            }
        }
    except Exception as e:
        logger.error(f"Data extraction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/parse-program-pdf")
async def parse_program_pdf(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Parse insurance program PDF to extract requirements"""
    try:
        file_id = data.get("fileId")
        if not file_id:
            raise ValueError("fileId is required")
        
        # Get file path
        file_path = get_file_path(file_id)
        if not file_path or not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        logger.info(f"Parsing program PDF: {file_id}")
        
        # Extract text from PDF
        text = await extract_text_from_pdf(file_path)
        
        # Parse insurance requirements
        result = parse_insurance_program_pdf(text)
        
        return result
    except Exception as e:
        logger.error(f"PDF parsing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/send-email")
async def send_email(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Send email via SMTP"""
    try:
        from services.email_service import email_service
        
        to = data.get("to")
        subject = data.get("subject")
        body = data.get("body")
        html = data.get("html")
        
        if not to or not subject or not body:
            raise ValueError("to, subject, and body are required")
        
        logger.info(f"Sending email to: {to} - Subject: {subject}")
        
        result = await email_service.send_email(
            to=to,
            subject=subject,
            body=body,
            html=html
        )
        
        return result
    except Exception as e:
        logger.error(f"Email sending error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/analyze-policy")
async def analyze_policy(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Analyze insurance policy using AI"""
    try:
        policy_text = data.get("policyText", "")
        logger.info(f"Analyzing policy ({len(policy_text)} chars)")
        
        # Mock AI analysis
        return {
            "success": True,
            "analysis": {
                "coverage": "Comprehensive",
                "exclusions": [],
                "recommendations": []
            }
        }
    except Exception as e:
        logger.error(f"Policy analysis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/generate-image")
async def generate_image(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Generate image using AI"""
    try:
        prompt = data.get("prompt", "")
        logger.info(f"Generating image: {prompt}")
        
        # Mock image generation
        return {
            "success": True,
            "imageUrl": "https://via.placeholder.com/512",
            "imageId": str(uuid.uuid4())
        }
    except Exception as e:
        logger.error(f"Image generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/extract-file")
async def extract_file(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Extract file content"""
    try:
        file_id = data.get("fileId")
        logger.info(f"Extracting file: {file_id}")
        
        return {
            "success": True,
            "content": "",
            "metadata": {}
        }
    except Exception as e:
        logger.error(f"File extraction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/create-signed-url")
async def create_signed_url(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Create signed URL for secure file access"""
    try:
        file_id = data.get("fileId")
        expires_in = data.get("expiresIn", 3600)
        
        logger.info(f"Creating signed URL for file: {file_id}")
        
        # Mock signed URL
        return {
            "success": True,
            "signedUrl": f"https://storage.example.com/{file_id}?expires={expires_in}",
            "expiresAt": "2026-01-30T15:00:00Z"
        }
    except Exception as e:
        logger.error(f"Signed URL creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/upload-private-file")
async def upload_private_file(
    file: UploadFile = File(...),
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Upload private file to secure storage"""
    try:
        # Use the same storage service with private flag in entity_type
        private_entity_type = f"private/{entity_type}" if entity_type else "private"
        file_metadata = await save_upload_file(file, private_entity_type, entity_id)
        
        logger.info(f"Private file uploaded: {file_metadata['filename']} (ID: {file_metadata['id']})")
        
        return {
            "success": True,
            "fileId": file_metadata["id"],
            "filename": file_metadata["filename"],
            "size": file_metadata["size"],
            "private": True,
            "path": file_metadata["relativePath"]
        }
    except ValueError as e:
        logger.warning(f"Private file validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Private file upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Private file upload failed: {str(e)}"
        )


@router.post("/invoke-llm")
async def invoke_llm(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Invoke Large Language Model for AI tasks"""
    try:
        prompt = data.get("prompt", "")
        model = data.get("model", "gpt-3.5-turbo")
        
        logger.info(f"Invoking LLM: {model} with prompt length: {len(prompt)}")
        
        # Mock LLM response
        return {
            "success": True,
            "response": "This is a mock AI response",
            "model": model,
            "tokens": 0
        }
    except Exception as e:
        logger.error(f"LLM invocation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# Adobe Sign Integration
@router.post("/adobe/transientDocument")
async def create_transient_document(
    file: UploadFile = File(...),
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Create Adobe Sign transient document"""
    try:
        contents = await file.read()
        doc_id = str(uuid.uuid4())
        
        logger.info(f"Creating Adobe transient document: {file.filename}")
        
        return {
            "transientDocumentId": doc_id
        }
    except Exception as e:
        logger.error(f"Adobe transient document error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/adobe/agreement")
async def create_adobe_agreement(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Create Adobe Sign agreement"""
    try:
        logger.info("Creating Adobe Sign agreement")
        
        agreement_id = str(uuid.uuid4())
        return {
            "id": agreement_id,
            "status": "OUT_FOR_SIGNATURE"
        }
    except Exception as e:
        logger.error(f"Adobe agreement creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/adobe/agreement/{agreement_id}/url")
async def get_adobe_agreement_url(
    agreement_id: str,
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Get Adobe Sign agreement URL"""
    try:
        logger.info(f"Getting Adobe agreement URL: {agreement_id}")
        
        return {
            "signingUrl": f"https://secure.adobesign.com/public/esignWidget?wid={agreement_id}",
            "embeddedCode": f"<iframe src='https://secure.adobesign.com/public/esignWidget?wid={agreement_id}'></iframe>"
        }
    except Exception as e:
        logger.error(f"Adobe agreement URL error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# NYC Property Lookup
@router.post("/nyc/property")
async def lookup_nyc_property(
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Lookup NYC property information"""
    try:
        address = data.get("address", "")
        logger.info(f"Looking up NYC property: {address}")
        
        # Mock NYC property data
        return {
            "success": True,
            "property": {
                "address": address,
                "borough": "Manhattan",
                "block": "1234",
                "lot": "56",
                "zoning": "C6-2"
            }
        }
    except Exception as e:
        logger.error(f"NYC property lookup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
