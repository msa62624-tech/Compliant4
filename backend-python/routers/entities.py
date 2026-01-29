"""
Entities router - CRUD operations for all entities
Equivalent to entities routes in server.js
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Dict, Any
from config.database import entities, get_entity, create_entity, update_entity, delete_entity
from middleware.auth import verify_token, require_admin
from config.logger_config import setup_logger

logger = setup_logger(__name__)
router = APIRouter()


@router.get("/{entity_type}")
async def list_entities(entity_type: str, user: dict = Depends(verify_token)) -> List[Dict[str, Any]]:
    """Get all entities of a specific type"""
    if entity_type not in entities:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity type '{entity_type}' not found"
        )
    
    return entities[entity_type]


@router.get("/{entity_type}/{entity_id}")
async def get_entity_by_id(
    entity_type: str,
    entity_id: str,
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Get a specific entity by ID"""
    entity = get_entity(entity_type, entity_id)
    
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity not found"
        )
    
    return entity


@router.post("/{entity_type}")
async def create_entity_endpoint(
    entity_type: str,
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Create a new entity"""
    try:
        entity = create_entity(entity_type, data)
        logger.info(f"Created {entity_type} with ID: {entity.get('id')}")
        return entity
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{entity_type}/{entity_id}")
async def update_entity_endpoint(
    entity_type: str,
    entity_id: str,
    data: Dict[str, Any],
    user: dict = Depends(verify_token)
) -> Dict[str, Any]:
    """Update an existing entity"""
    entity = update_entity(entity_type, entity_id, data)
    
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity not found"
        )
    
    logger.info(f"Updated {entity_type} with ID: {entity_id}")
    return entity


@router.delete("/{entity_type}/{entity_id}")
async def delete_entity_endpoint(
    entity_type: str,
    entity_id: str,
    user: dict = Depends(verify_token)
):
    """Delete an entity"""
    success = delete_entity(entity_type, entity_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entity not found"
        )
    
    logger.info(f"Deleted {entity_type} with ID: {entity_id}")
    return {"message": "Entity deleted successfully"}
