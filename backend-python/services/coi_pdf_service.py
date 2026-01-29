"""
COI PDF Generation Service using ReportLab
Generates ACORD 25 Certificate of Liability Insurance PDFs
Equivalent to Node.js backend's adobe-pdf-service.js generateCOIPDF function
"""
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class COIPDFService:
    """Service for generating ACORD 25 COI PDFs using ReportLab"""
    
    def __init__(self, uploads_dir: str = "uploads"):
        self.uploads_dir = uploads_dir
        os.makedirs(uploads_dir, exist_ok=True)
    
    def generate_coi_pdf(self, coi_data: Dict[str, Any]) -> str:
        """
        Generate an ACORD 25 COI PDF
        
        Args:
            coi_data: Dictionary containing COI information including:
                - coiId: Unique identifier for the COI
                - subcontractorName: Name of the insured subcontractor
                - projectName: Name of the project
                - gcName: Name of the general contractor
                - producerInfo: Producer/broker information
                - insurers: List of insurance companies
                - coverages: List of coverage details
                
        Returns:
            str: Filename of the generated PDF
        """
        try:
            # Generate filename
            coi_id = coi_data.get('coiId', datetime.now().timestamp())
            timestamp = int(datetime.now().timestamp() * 1000)
            filename = f"coi-{coi_id}-{timestamp}.pdf"
            filepath = os.path.join(self.uploads_dir, filename)
            
            logger.info(f"Generating ACORD 25 COI PDF for {coi_data.get('subcontractorName', 'unknown')}")
            
            # Create PDF canvas
            c = canvas.Canvas(filepath, pagesize=letter)
            width, height = letter
            
            # Draw the ACORD 25 form
            self._draw_header(c, width, height, coi_data)
            self._draw_producer_section(c, coi_data)
            self._draw_insured_section(c, coi_data)
            self._draw_insurers_section(c, coi_data)
            self._draw_coverages_section(c, coi_data)
            self._draw_additional_insured_section(c, coi_data)
            self._draw_description_section(c, coi_data)
            self._draw_footer(c, width, height)
            
            # Save PDF
            c.save()
            
            logger.info(f"Successfully generated COI PDF: {filename}")
            return filename
            
        except Exception as e:
            logger.error(f"Failed to generate COI PDF: {str(e)}", exc_info=True)
            raise
    
    def _draw_header(self, c: canvas.Canvas, width: float, height: float, coi_data: Dict[str, Any]):
        """Draw ACORD 25 header"""
        # ACORD logo/text
        c.setFont("Helvetica-Bold", 8)
        c.drawString(30, height - 30, "ACORD")
        
        # Title
        c.setFont("Helvetica-Bold", 16)
        title = "CERTIFICATE OF LIABILITY INSURANCE"
        c.drawCentredString(width / 2, height - 35, title)
        
        # Date
        c.setFont("Helvetica", 8)
        c.drawString(width - 150, height - 30, "DATE (MM/DD/YYYY)")
        c.setFont("Helvetica-Bold", 10)
        current_date = datetime.now().strftime("%m/%d/%Y")
        c.drawString(width - 150, height - 45, current_date)
        
        # Form identifier
        c.setFont("Helvetica", 6)
        c.drawString(30, height - 45, "ACORD 25 (2016/03)")
        
        # Draw horizontal line
        c.line(30, height - 55, width - 30, height - 55)
    
    def _draw_producer_section(self, c: canvas.Canvas, coi_data: Dict[str, Any]):
        """Draw producer/broker information section"""
        producer_info = coi_data.get('producerInfo', {})
        
        y_start = 700
        c.setFont("Helvetica", 7)
        c.drawString(35, y_start, "PRODUCER")
        
        c.setFont("Helvetica-Bold", 9)
        c.drawString(35, y_start - 15, producer_info.get('name', 'ABC Insurance Brokers LLC'))
        
        c.setFont("Helvetica", 8)
        c.drawString(35, y_start - 30, producer_info.get('address', '123 Insurance Plaza'))
        c.drawString(35, y_start - 45, f"{producer_info.get('city', 'New York')}, {producer_info.get('state', 'NY')} {producer_info.get('zipCode', '10005')}")
        
        contact_name = producer_info.get('contactName', 'Contact Name')
        c.drawString(35, y_start - 65, f"Contact: {contact_name}")
        
        phone = producer_info.get('phone', '(555) 123-4567')
        c.drawString(35, y_start - 80, f"Phone: {phone}")
        
        email = producer_info.get('email', 'broker@insurance.com')
        c.drawString(35, y_start - 95, f"Email: {email}")
        
        # Draw border
        c.rect(30, y_start - 110, 280, 125)
    
    def _draw_insured_section(self, c: canvas.Canvas, coi_data: Dict[str, Any]):
        """Draw insured (subcontractor) information section"""
        y_start = 700
        x_start = 320
        
        c.setFont("Helvetica", 7)
        c.drawString(x_start, y_start, "INSURED")
        
        c.setFont("Helvetica-Bold", 10)
        insured_name = coi_data.get('subcontractorName', coi_data.get('insuredName', 'Subcontractor Name'))
        c.drawString(x_start, y_start - 15, insured_name)
        
        c.setFont("Helvetica", 8)
        insured_info = coi_data.get('insuredInfo', {})
        c.drawString(x_start, y_start - 30, insured_info.get('address', '456 Builder Avenue'))
        c.drawString(x_start, y_start - 45, f"{insured_info.get('city', 'Brooklyn')}, {insured_info.get('state', 'NY')} {insured_info.get('zipCode', '11201')}")
        
        # Draw border
        c.rect(315, y_start - 110, 280, 125)
    
    def _draw_insurers_section(self, c: canvas.Canvas, coi_data: Dict[str, Any]):
        """Draw insurers list section"""
        insurers = coi_data.get('insurers', [])
        
        y_start = 575
        c.setFont("Helvetica", 7)
        c.drawString(35, y_start, "INSURERS AFFORDING COVERAGE")
        
        c.setFont("Helvetica", 7)
        c.drawString(320, y_start, "NAIC #")
        
        # Default insurers if none provided
        if not insurers:
            insurers = [
                {'letter': 'A', 'name': 'National Liability Insurance Co.', 'naic': '10001'},
                {'letter': 'B', 'name': 'State Workers Compensation Fund', 'naic': '10002'},
                {'letter': 'C', 'name': 'American Auto Insurance Company', 'naic': '10003'},
            ]
        
        c.setFont("Helvetica", 8)
        for idx, insurer in enumerate(insurers[:6]):  # Max 6 insurers (A-F)
            y_pos = y_start - 15 - (idx * 15)
            letter = insurer.get('letter', chr(65 + idx))  # A-F
            c.drawString(35, y_pos, f"INSURER {letter}:")
            c.drawString(90, y_pos, insurer.get('name', f'Insurance Company {letter}'))
            c.drawString(320, y_pos, insurer.get('naic', '00000'))
        
        # Draw border
        c.rect(30, y_start - 105, 565, 115)
    
    def _draw_coverages_section(self, c: canvas.Canvas, coi_data: Dict[str, Any]):
        """Draw coverages table section"""
        coverages = coi_data.get('coverages', [])
        
        # Default coverages if none provided
        if not coverages:
            coverages = [
                {
                    'type': 'GENERAL LIABILITY',
                    'insurer': 'A',
                    'policyNumber': 'GL-2026-123456',
                    'effectiveDate': '01/01/2026',
                    'expirationDate': '01/01/2027',
                    'limits': {
                        'eachOccurrence': '$1,000,000',
                        'aggregate': '$2,000,000'
                    }
                },
                {
                    'type': 'WORKERS COMPENSATION',
                    'insurer': 'B',
                    'policyNumber': 'WC-2026-123456',
                    'effectiveDate': '01/01/2026',
                    'expirationDate': '01/01/2027',
                    'limits': {
                        'statutory': 'STATUTORY'
                    }
                }
            ]
        
        y_start = 455
        c.setFont("Helvetica-Bold", 7)
        c.drawString(35, y_start, "COVERAGES")
        
        # Draw table headers
        c.setFont("Helvetica", 6)
        headers_y = y_start - 15
        c.drawString(35, headers_y, "TYPE OF INSURANCE")
        c.drawString(150, headers_y, "POLICY NUMBER")
        c.drawString(250, headers_y, "POLICY EFF")
        c.drawString(320, headers_y, "POLICY EXP")
        c.drawString(390, headers_y, "LIMITS")
        
        # Draw coverages
        c.setFont("Helvetica", 7)
        row_height = 35
        for idx, coverage in enumerate(coverages[:6]):  # Max 6 rows
            y_pos = headers_y - 15 - (idx * row_height)
            
            # Coverage type
            coverage_type = coverage.get('type', 'GENERAL LIABILITY')
            c.drawString(35, y_pos, coverage_type)
            
            # Insurer letter
            insurer = coverage.get('insurer', 'A')
            c.drawString(120, y_pos, insurer)
            
            # Policy number
            policy_num = coverage.get('policyNumber', 'N/A')
            c.drawString(150, y_pos, policy_num)
            
            # Dates
            eff_date = coverage.get('effectiveDate', 'MM/DD/YYYY')
            exp_date = coverage.get('expirationDate', 'MM/DD/YYYY')
            c.drawString(250, y_pos, eff_date)
            c.drawString(320, y_pos, exp_date)
            
            # Limits
            limits = coverage.get('limits', {})
            y_limit = y_pos
            for limit_key, limit_value in limits.items():
                limit_label = limit_key.replace('_', ' ').title()
                c.drawString(390, y_limit, f"{limit_label}: {limit_value}")
                y_limit -= 10
        
        # Draw border
        c.rect(30, y_start - 235, 565, 250)
    
    def _draw_additional_insured_section(self, c: canvas.Canvas, coi_data: Dict[str, Any]):
        """Draw additional insured and special provisions section"""
        y_start = 205
        
        c.setFont("Helvetica-Bold", 7)
        c.drawString(35, y_start, "CERTIFICATE HOLDER")
        
        # Certificate holder (usually the GC)
        gc_name = coi_data.get('gcName', coi_data.get('certificateHolder', 'General Contractor'))
        project_name = coi_data.get('projectName', 'Construction Project')
        
        c.setFont("Helvetica-Bold", 9)
        c.drawString(35, y_start - 15, gc_name)
        c.setFont("Helvetica", 8)
        c.drawString(35, y_start - 30, f"RE: {project_name}")
        
        # Additional insured checkbox
        c.setFont("Helvetica", 7)
        checkbox_y = y_start - 50
        c.drawString(35, checkbox_y, "[X] Additional Insured")
        c.drawString(35, checkbox_y - 12, "[X] Waiver of Subrogation")
        c.drawString(35, checkbox_y - 24, "[X] Primary and Non-Contributory")
        
        # Draw border
        c.rect(30, y_start - 90, 280, 100)
    
    def _draw_description_section(self, c: canvas.Canvas, coi_data: Dict[str, Any]):
        """Draw description of operations section"""
        y_start = 205
        x_start = 320
        
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x_start, y_start, "DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES")
        
        c.setFont("Helvetica", 7)
        description = coi_data.get('description', f"Work performed for {coi_data.get('projectName', 'project')} by {coi_data.get('subcontractorName', 'subcontractor')}.")
        
        # Word wrap description
        words = description.split()
        line = ""
        y_pos = y_start - 15
        max_width = 260
        
        for word in words:
            test_line = line + " " + word if line else word
            if c.stringWidth(test_line, "Helvetica", 7) > max_width:
                c.drawString(x_start, y_pos, line)
                line = word
                y_pos -= 10
            else:
                line = test_line
        
        if line:
            c.drawString(x_start, y_pos, line)
        
        # Draw border
        c.rect(315, y_start - 90, 280, 100)
    
    def _draw_footer(self, c: canvas.Canvas, width: float, height: float):
        """Draw ACORD disclaimer footer"""
        footer_y = 90
        
        c.setFont("Helvetica", 6)
        
        disclaimer = (
            "IMPORTANT: If the certificate holder is an ADDITIONAL INSURED, the policy(ies) must have "
            "ADDITIONAL INSURED provisions or be endorsed. If SUBROGATION IS WAIVED, subject to the "
            "terms and conditions of the policy, certain policies may require an endorsement. A statement "
            "on this certificate does not confer rights to the certificate holder in lieu of such endorsement(s)."
        )
        
        # Word wrap disclaimer
        words = disclaimer.split()
        line = ""
        y_pos = footer_y
        max_width = width - 80
        
        for word in words:
            test_line = line + " " + word if line else word
            if c.stringWidth(test_line, "Helvetica", 6) > max_width:
                c.drawString(40, y_pos, line)
                line = word
                y_pos -= 8
            else:
                line = test_line
        
        if line:
            c.drawString(40, y_pos, line)
        
        # Copyright notice
        c.drawString(40, 40, "© 1988-2015 ACORD CORPORATION. All rights reserved.")
        c.drawString(40, 32, "The ACORD name and logo are registered marks of ACORD")
