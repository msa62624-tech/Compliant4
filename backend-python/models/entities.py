"""
SQLAlchemy models for PostgreSQL database
Defines database schema for all entities
"""
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()


def generate_uuid():
    """Generate a UUID string"""
    return str(uuid.uuid4())


class User(Base):
    """User entity"""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")
    status = Column(String, nullable=False, default="active")
    first_name = Column(String)
    last_name = Column(String)
    phone = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Contractor(Base):
    """Contractor (GC or Subcontractor) entity"""
    __tablename__ = "contractors"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_name = Column(String, nullable=False, index=True)
    contractor_type = Column(String, nullable=False)  # general_contractor, subcontractor
    email = Column(String)
    phone = Column(String)
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    status = Column(String, default="active")
    insurance_verified = Column(Boolean, default=False)
    compliance_status = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    projects = relationship("Project", back_populates="gc")


class Project(Base):
    """Project entity"""
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_name = Column(String, nullable=False, index=True)
    project_number = Column(String)
    gc_id = Column(String, ForeignKey("contractors.id"))
    owner_name = Column(String)
    location = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    status = Column(String, default="active")
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    budget = Column(Float)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    gc = relationship("Contractor", back_populates="projects")
    subcontractors = relationship("ProjectSubcontractor", back_populates="project")


class ProjectSubcontractor(Base):
    """ProjectSubcontractor entity - links subcontractors to projects"""
    __tablename__ = "project_subcontractors"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    subcontractor_id = Column(String, ForeignKey("contractors.id"))
    company_name = Column(String, nullable=False)
    contact_name = Column(String)
    email = Column(String)
    phone = Column(String)
    trades = Column(JSON)  # Array of trade IDs
    status = Column(String, default="pending")
    compliance_status = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="subcontractors")


class Trade(Base):
    """Trade entity"""
    __tablename__ = "trades"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text)
    category = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InsuranceDocument(Base):
    """Insurance document entity"""
    __tablename__ = "insurance_documents"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    subcontractor_id = Column(String, ForeignKey("project_subcontractors.id"))
    project_id = Column(String, ForeignKey("projects.id"))
    document_type = Column(String, nullable=False)
    file_name = Column(String)
    file_url = Column(String)
    file_size = Column(Integer)
    policy_number = Column(String)
    effective_date = Column(DateTime)
    expiration_date = Column(DateTime)
    status = Column(String, default="pending")
    approval_status = Column(String)
    uploaded_by = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GeneratedCOI(Base):
    """Generated COI entity"""
    __tablename__ = "generated_cois"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"))
    subcontractor_id = Column(String, ForeignKey("project_subcontractors.id"))
    status = Column(String, default="draft")
    first_coi_url = Column(String)
    regenerated_coi_url = Column(String)
    first_coi_filename = Column(String)
    regenerated_coi_filename = Column(String)
    expiration_date = Column(DateTime)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InsuranceProgram(Base):
    """Insurance program entity"""
    __tablename__ = "insurance_programs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    program_name = Column(String, nullable=False)
    gc_id = Column(String, ForeignKey("contractors.id"))
    description = Column(Text)
    requirements = Column(JSON)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SubInsuranceRequirement(Base):
    """Sub insurance requirement entity"""
    __tablename__ = "sub_insurance_requirements"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    trade_id = Column(String, ForeignKey("trades.id"))
    program_id = Column(String, ForeignKey("insurance_programs.id"))
    coverage_type = Column(String, nullable=False)
    limit_amount = Column(Float)
    required = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StateRequirement(Base):
    """State requirement entity"""
    __tablename__ = "state_requirements"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    state_code = Column(String, nullable=False, index=True)
    coverage_type = Column(String, nullable=False)
    minimum_limit = Column(Float)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Broker(Base):
    """Broker entity"""
    __tablename__ = "brokers"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_name = Column(String, nullable=False)
    contact_name = Column(String)
    email = Column(String)
    phone = Column(String)
    address = Column(String)
    city = Column(String)
    state = Column(String)
    zip_code = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ComplianceCheck(Base):
    """Compliance check entity"""
    __tablename__ = "compliance_checks"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    subcontractor_id = Column(String, ForeignKey("project_subcontractors.id"))
    project_id = Column(String, ForeignKey("projects.id"))
    check_type = Column(String)
    status = Column(String)
    result = Column(JSON)
    checked_by = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
