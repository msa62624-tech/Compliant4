"""
File storage service for handling uploads
Equivalent to multer in Node.js backend
"""
import os
import uuid
import hashlib
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime
from fastapi import UploadFile
from config.logger_config import setup_logger

logger = setup_logger(__name__)

# Storage directory
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Allowed file types
ALLOWED_EXTENSIONS = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent directory traversal attacks
    Remove special characters and limit length
    """
    # Remove path components
    filename = os.path.basename(filename)
    
    # Remove dangerous characters
    safe_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
    filename = ''.join(c if c in safe_chars else '_' for c in filename)
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:250] + ext
    
    return filename


def get_file_extension(filename: str) -> str:
    """Get file extension without dot"""
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''


def validate_file_type(filename: str, content_type: str) -> Tuple[bool, Optional[str]]:
    """
    Validate file type by extension and content type
    Returns (is_valid, error_message)
    """
    ext = get_file_extension(filename)
    
    if not ext:
        return False, "File must have an extension"
    
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File type .{ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS.keys())}"
    
    expected_content_type = ALLOWED_EXTENSIONS[ext]
    if content_type and not content_type.startswith(expected_content_type.split('/')[0]):
        logger.warning(f"Content type mismatch: expected {expected_content_type}, got {content_type}")
    
    return True, None


async def save_upload_file(
    file: UploadFile,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None
) -> dict:
    """
    Save uploaded file to disk with validation
    
    Args:
        file: FastAPI UploadFile object
        entity_type: Optional entity type for organization (e.g., 'insurance', 'coi')
        entity_id: Optional entity ID
    
    Returns:
        dict with file metadata (id, path, filename, size, etc.)
    """
    try:
        # Validate filename
        if not file.filename:
            raise ValueError("Filename is required")
        
        safe_filename = sanitize_filename(file.filename)
        
        # Validate file type
        is_valid, error_msg = validate_file_type(safe_filename, file.content_type or '')
        if not is_valid:
            raise ValueError(error_msg)
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Validate file size
        if file_size > MAX_FILE_SIZE:
            raise ValueError(f"File too large. Max size: {MAX_FILE_SIZE / (1024*1024):.1f}MB")
        
        if file_size == 0:
            raise ValueError("File is empty")
        
        # Generate unique file ID and compute hash
        file_id = str(uuid.uuid4())
        file_hash = hashlib.sha256(content).hexdigest()
        
        # Create organized directory structure
        date_path = datetime.now().strftime("%Y/%m/%d")
        if entity_type:
            dir_path = UPLOAD_DIR / entity_type / date_path
        else:
            dir_path = UPLOAD_DIR / "general" / date_path
        
        dir_path.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename with ID prefix
        ext = get_file_extension(safe_filename)
        unique_filename = f"{file_id}.{ext}"
        file_path = dir_path / unique_filename
        
        # Save file
        with open(file_path, 'wb') as f:
            f.write(content)
        
        logger.info(f"File saved: {file_path} ({file_size} bytes)")
        
        # Return metadata
        return {
            "id": file_id,
            "filename": safe_filename,
            "originalFilename": file.filename,
            "path": str(file_path),
            "relativePath": str(file_path.relative_to(UPLOAD_DIR)),
            "size": file_size,
            "mimeType": file.content_type,
            "extension": ext,
            "hash": file_hash,
            "entityType": entity_type,
            "entityId": entity_id,
            "uploadedAt": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise


def get_file_path(file_id: str) -> Optional[Path]:
    """
    Find file by ID in upload directory
    Returns file path if found, None otherwise
    """
    for root, dirs, files in os.walk(UPLOAD_DIR):
        for file in files:
            if file.startswith(file_id):
                return Path(root) / file
    return None


async def delete_file(file_id: str) -> bool:
    """Delete file by ID"""
    try:
        file_path = get_file_path(file_id)
        if file_path and file_path.exists():
            file_path.unlink()
            logger.info(f"File deleted: {file_path}")
            return True
        return False
    except Exception as e:
        logger.error(f"File deletion error: {e}")
        return False


def get_file_info(file_id: str) -> Optional[dict]:
    """Get file metadata by ID"""
    try:
        file_path = get_file_path(file_id)
        if not file_path or not file_path.exists():
            return None
        
        stat = file_path.stat()
        return {
            "id": file_id,
            "path": str(file_path),
            "size": stat.st_size,
            "createdAt": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "modifiedAt": datetime.fromtimestamp(stat.st_mtime).isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting file info: {e}")
        return None
