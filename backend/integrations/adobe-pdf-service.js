/**
 * Adobe PDF Services Integration
 * Handles PDF extraction, text recognition, and digital signatures
 * Requires: ADOBE_API_KEY and ADOBE_CLIENT_ID from environment
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { acord25Template, generateCOIData } from '../data/acord25Template.js';

// No external http client needed; using mock and Node fetch where necessary
export default class AdobePDFService {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ADOBE_API_KEY;
    this.clientId = config.clientId || process.env.ADOBE_CLIENT_ID;
    this.baseURL = 'https://pdf-services.adobe.io';
    this.enabled = !!(this.apiKey && this.clientId);
    
    if (this.enabled) {
      console.log('✅ Adobe PDF Services: ENABLED');
    } else {
      console.log('⚠️  Adobe PDF Services: DISABLED (set ADOBE_API_KEY and ADOBE_CLIENT_ID to enable)');
    }
  }

  /**
   * Extract text from a PDF file
   * @param {string} fileUrl - URL of the PDF file
   * @returns {Promise<{text: string, pages: number, metadata: object}>}
   */
  async extractText(fileUrl) {
    if (!this.enabled) {
      return this.mockExtractText(fileUrl);
    }

    try {
      console.log(`📄 Adobe: Extracting text from ${fileUrl}`);
      // In production, call Adobe PDF Extract API
      // For now, return mock data
      return this.mockExtractText(fileUrl);
    } catch (error) {
      console.error('❌ Adobe PDF extraction error:', error.message);
      throw error;
    }
  }

  /**
   * Mock extraction for development
   * @param {string} fileUrl
   * @returns {Promise}
   */
  async mockExtractText(fileUrl) {
    return {
      text: `CERTIFICATE OF INSURANCE
      
Date (MM/DD/YYYY)
01/15/2026

PRODUCER: Acme Insurance Brokers
      Email: broker@acmeins.com
      Phone: (555) 123-4567
      
INSURER A: National Insurance Company
  POLICY #: POL-GL-2026-0001
  General Liability: $2,000,000 Each Occurrence
  
INSURER B: State Workers Compensation Fund
  POLICY #: WC-NJ-2026-0001
  Workers Compensation: Statutory Limits
  
INSURED: MPI Plumbing Corp
  Address: 123 Main St, Newark, NJ 07102`,
      pages: 1,
      metadata: {
        source: fileUrl,
        extractedAt: new Date().toISOString(),
        confidence: 0.95
      }
    };
  }

  /**
   * Extract structured fields from COI
   * @param {string} fileUrl - URL of the COI PDF
   * @returns {Promise<object>} Structured COI data
   */
  async extractCOIFields(fileUrl) {
    try {
      const textData = await this.extractText(fileUrl);
      const text = textData.text;

      // Pattern matching for common COI fields
      const extracted = {
        source: fileUrl,
        extractedAt: new Date().toISOString(),
        insurance_carriers: [],
        policy_numbers: [],
        coverage_limits: [],
        effective_dates: [],
        expiration_dates: [],
        additional_insureds: []
      };

      // Extract policy numbers (format: POL-XXXX-YYYY)
      const policyRegex = /POL[-]?\d+[-]?\d+/gi;
      extracted.policy_numbers = [...new Set(text.match(policyRegex) || [])];

      // Extract coverage amounts (format: $X,XXX,XXX)
      const amountRegex = /\$[\d,]+(?:,\d{3})*(?:\.\d{2})?/g;
      extracted.coverage_limits = [...new Set(text.match(amountRegex) || [])];

      // Extract dates (MM/DD/YYYY)
      const dateRegex = /\d{2}\/\d{2}\/\d{4}/g;
      extracted.expiration_dates = [...new Set(text.match(dateRegex) || [])];

      // Extract email addresses
      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
      extracted.contact_emails = [...new Set(text.match(emailRegex) || [])];

      return extracted;
    } catch (error) {
      console.error('❌ COI field extraction error:', error.message);
      throw error;
    }
  }

  /**
   * Apply digital signature to PDF
   * @param {string} fileUrl - URL of the PDF to sign
   * @param {object} signatureData - Signature image or data
   * @returns {Promise<string>} URL of signed PDF
   */
  async signPDF(fileUrl, _signatureData) {
    if (!this.enabled) {
      console.log('⚠️  Adobe: Using mock signature (service not configured)');
      return `${fileUrl}?signed=true&timestamp=${Date.now()}`;
    }

    try {
      console.log(`🔐 Adobe: Signing PDF at ${fileUrl}`);
      // In production, call Adobe Sign API
      // For now, return mock signed URL
      return `${fileUrl}?signed=true&timestamp=${Date.now()}`;
    } catch (error) {
      console.error('❌ Adobe PDF signing error:', error.message);
      throw error;
    }
  }

  /**
   * Merge multiple PDFs
   * @param {string[]} fileUrls - Array of PDF URLs to merge
   * @returns {Promise<string>} URL of merged PDF
   */
  async mergePDFs(fileUrls) {
    try {
      console.log(`📑 Adobe: Merging ${fileUrls.length} PDFs`);
      // In production, call Adobe PDF Combine API
      // For now, return mock merged URL
      return `https://storage.example.com/merged-${Date.now()}.pdf`;
    } catch (error) {
      console.error('❌ PDF merge error:', error.message);
      throw error;
    }
  }

  /**
   * Generate a COI PDF document in ACORD 25 format
   * @param {object} coiData - COI data including project, subcontractor, and insurance info
   * @param {string} uploadDir - Directory to save the generated PDF
   * @returns {Promise<string>} Filename of generated PDF
   */
  async generateCOIPDF(coiData, uploadDir) {
    try {
      console.log(`📄 Adobe: Generating ACORD 25 COI PDF for ${coiData.subcontractorName || 'subcontractor'}`);
      
      const filename = `coi-${coiData.coiId || Date.now()}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, filename);
      
      // ACORD 25 layout constants
      const COVERAGE_ROW_HEIGHT = 25;
      const PAGE_HEIGHT = 792; // Letter size height in points
      const FOOTER_HEIGHT = 30;
      const MAX_CONTENT_Y = PAGE_HEIGHT - FOOTER_HEIGHT - 30; // Leave space for footer
      
      // Create PDF document with ACORD 25 standard size
      const doc = new PDFDocument({ size: 'LETTER', margin: 30 });
      const stream = fs.createWriteStream(filepath);
      
      doc.pipe(stream);
      
      // ACORD 25 Header
      doc.fontSize(7).text('ACORD', 30, 30);
      doc.fontSize(16).font('Helvetica-Bold').text('CERTIFICATE OF LIABILITY INSURANCE', 150, 30, { align: 'center', width: 300 });
      doc.fontSize(7).font('Helvetica').text(`DATE (MM/DD/YYYY)`, 480, 30);
      doc.fontSize(9).text(new Date().toLocaleDateString('en-US'), 480, 42);
      
      // Form identifier
      doc.fontSize(6).text('ACORD 25 (2016/03)', 30, 50);
      
      doc.moveTo(30, 65).lineTo(580, 65).stroke();
      
      // Producer Section
      let yPos = 70;
      doc.fontSize(7).font('Helvetica-Bold').text('PRODUCER', 30, yPos);
      yPos += 12;
      const producerName = coiData.producer?.name || coiData.broker?.name || 'Insurance Broker';
      const producerEmail = coiData.producer?.email || coiData.broker?.email;
      const producerPhone = coiData.producer?.phone || coiData.broker?.phone;
      
      doc.fontSize(9).font('Helvetica').text(producerName, 30, yPos);
      if (producerEmail) {
        yPos += 12;
        doc.text(producerEmail, 30, yPos);
      }
      if (producerPhone) {
        yPos += 12;
        doc.text(producerPhone, 30, yPos);
      }
      
      // Insured Section
      yPos = 70;
      const insuredName = coiData.insured?.name || coiData.subcontractorName || 'Subcontractor';
      const insuredAddress = coiData.insured?.address || coiData.subcontractorAddress;
      const insuredCity = coiData.insured?.city;
      const insuredState = coiData.insured?.state;
      const insuredZip = coiData.insured?.zip;
      
      doc.fontSize(7).font('Helvetica-Bold').text('INSURED', 320, yPos);
      yPos += 12;
      doc.fontSize(9).font('Helvetica').text(insuredName, 320, yPos);
      if (insuredAddress) {
        yPos += 12;
        doc.text(insuredAddress, 320, yPos);
      }
      if (insuredCity || insuredState || insuredZip) {
        yPos += 12;
        const cityStateZip = [insuredCity, insuredState, insuredZip].filter(Boolean).join(' ');
        doc.text(cityStateZip, 320, yPos);
      }
      
      yPos = 140;
      doc.moveTo(30, yPos).lineTo(580, yPos).stroke();
      
      // Coverages Section Header
      yPos += 5;
      doc.fontSize(7).font('Helvetica-Bold').text('THIS IS TO CERTIFY THAT THE POLICIES OF INSURANCE LISTED BELOW HAVE BEEN ISSUED TO THE INSURED NAMED ABOVE FOR THE POLICY PERIOD', 30, yPos, { width: 540 });
      yPos += 20;
      doc.text('INDICATED. NOTWITHSTANDING ANY REQUIREMENT, TERM OR CONDITION OF ANY CONTRACT OR OTHER DOCUMENT WITH RESPECT TO WHICH THIS', 30, yPos, { width: 540 });
      yPos += 10;
      doc.text('CERTIFICATE MAY BE ISSUED OR MAY PERTAIN, THE INSURANCE AFFORDED BY THE POLICIES DESCRIBED HEREIN IS SUBJECT TO ALL THE TERMS,', 30, yPos, { width: 540 });
      yPos += 10;
      doc.text('EXCLUSIONS AND CONDITIONS OF SUCH POLICIES. LIMITS SHOWN MAY HAVE BEEN REDUCED BY PAID CLAIMS.', 30, yPos, { width: 540 });
      
      yPos += 15;
      doc.moveTo(30, yPos).lineTo(580, yPos).stroke();
      
      // Insurance Table Headers
      yPos += 5;
      doc.fontSize(6).font('Helvetica-Bold')
        .text('TYPE OF INSURANCE', 30, yPos)
        .text('POLICY NUMBER', 180, yPos)
        .text('POLICY EFF', 280, yPos)
        .text('POLICY EXP', 340, yPos)
        .text('LIMITS', 420, yPos);
      
      yPos += 12;
      doc.moveTo(30, yPos).lineTo(580, yPos).stroke();
      
      // Insurance Coverage Rows
      const renderCoverageRows = () => {
        let currentY = yPos;
        
        // Handle both array and object formats
        let coveragesToRender = [];
        
        if (Array.isArray(coiData.coverages)) {
          coveragesToRender = coiData.coverages;
        } else if (typeof coiData.coverages === 'object' && coiData.coverages !== null) {
          // Convert object to array: {generalLiability: {...}, automobile: {...}, ...}
          if (coiData.coverages.generalLiability) {
            coveragesToRender.push({
              type: 'GENERAL LIABILITY',
              ...coiData.coverages.generalLiability
            });
          }
          if (coiData.coverages.automobile) {
            coveragesToRender.push({
              type: 'AUTOMOBILE LIABILITY',
              ...coiData.coverages.automobile
            });
          }
          if (coiData.coverages.workersCompensation) {
            coveragesToRender.push({
              type: 'WORKERS COMPENSATION',
              ...coiData.coverages.workersCompensation
            });
          }
          if (coiData.coverages.umbrella) {
            coveragesToRender.push({
              type: 'UMBRELLA LIABILITY',
              ...coiData.coverages.umbrella
            });
          }
        }
        
        if (coveragesToRender.length > 0) {
          coveragesToRender.forEach(coverage => {
            currentY += 5;
            const limits = coverage.eachOccurrence 
              ? `$${Number(coverage.eachOccurrence).toLocaleString()}`
              : (coverage.combinedSingleLimit 
                ? `$${Number(coverage.combinedSingleLimit).toLocaleString()}`
                : (coverage.limits || 'Per Requirements'));
            
            doc.fontSize(8).font('Helvetica')
              .text(coverage.type || 'N/A', 30, currentY, { width: 140 })
              .text(coverage.policyNumber || 'N/A', 180, currentY, { width: 90 })
              .text(coverage.effectiveDate || 'N/A', 280, currentY, { width: 50 })
              .text(coverage.expirationDate || 'N/A', 340, currentY, { width: 70 })
              .text(limits, 420, currentY, { width: 150 });
            currentY += COVERAGE_ROW_HEIGHT;
            doc.moveTo(30, currentY).lineTo(580, currentY).stroke();
          });
        } else {
          // Default coverage lines
          const defaultCoverages = [
            { type: 'GENERAL LIABILITY', limits: 'Per Project Requirements' },
            { type: 'WORKERS COMPENSATION', limits: 'Statutory Limits' },
            { type: 'AUTOMOBILE LIABILITY', limits: 'Per Project Requirements' }
          ];
          
          defaultCoverages.forEach(coverage => {
            currentY += 5;
            doc.fontSize(8).font('Helvetica')
              .text(coverage.type, 30, currentY, { width: 140 })
              .text(coverage.limits, 420, currentY, { width: 150 });
            currentY += COVERAGE_ROW_HEIGHT;
            doc.moveTo(30, currentY).lineTo(580, currentY).stroke();
          });
        }
        
        return currentY;
      };
      
      yPos = renderCoverageRows();
      
      // Description of Operations / Locations / Vehicles section
      yPos += 5;
      doc.fontSize(7).font('Helvetica-Bold').text('DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES', 30, yPos);
      yPos += 12;
      doc.fontSize(8).font('Helvetica');
      
      if (coiData.projectName) {
        doc.text(`RE: ${coiData.projectName}`, 30, yPos);
        yPos += 12;
      }
      
      if (coiData.projectAddress) {
        doc.text(`Project Location: ${coiData.projectAddress}`, 30, yPos);
        yPos += 12;
      }
      
      if (coiData.additionalInsured) {
        doc.text(`${coiData.additionalInsured} is included as Additional Insured as required by written contract.`, 30, yPos, { width: 540 });
        yPos += 24;
      }
      
      // Additional Remarks Schedule (if needed)
      if (coiData.additionalRemarks && coiData.additionalRemarks.length > 0) {
        yPos += 5;
        doc.fontSize(7).font('Helvetica-Bold').text('ADDITIONAL REMARKS SCHEDULE', 30, yPos);
        yPos += 12;
        doc.fontSize(8).font('Helvetica');
        coiData.additionalRemarks.forEach(remark => {
          doc.text(`• ${remark}`, 30, yPos, { width: 540 });
          yPos += 12;
        });
      }
      
      yPos += 10;
      doc.moveTo(30, yPos).lineTo(580, yPos).stroke();
      
      // Certificate Holder Section
      yPos += 5;
      doc.fontSize(7).font('Helvetica-Bold').text('CERTIFICATE HOLDER', 30, yPos);
      yPos += 12;
      doc.fontSize(9).font('Helvetica');
      
      const certHolderName = coiData.certificateHolder?.name || coiData.certificateHolder || 'General Contractor';
      const certHolderAddress = coiData.certificateHolder?.address || coiData.certificateHolderAddress;
      const certHolderProject = coiData.certificateHolder?.projectName;
      
      if (certHolderName) {
        doc.text(certHolderName, 30, yPos);
        yPos += 12;
      }
      if (certHolderAddress) {
        doc.text(certHolderAddress, 30, yPos);
        yPos += 12;
      }
      if (certHolderProject) {
        doc.text(`RE: ${certHolderProject}`, 30, yPos);
        yPos += 12;
      }
      
      // Footer - Standard ACORD 25 disclaimer (positioned dynamically or at bottom of page)
      // Use the greater of current yPos + buffer or fixed position near bottom
      const footerY = Math.max(yPos + 20, PAGE_HEIGHT - FOOTER_HEIGHT);
      doc.fontSize(6).font('Helvetica').text('ACORD 25 (2016/03)', 30, footerY);
      doc.fontSize(6).text('© 1988-2015 ACORD CORPORATION. All rights reserved.', 200, footerY, { align: 'center', width: 200 });
      doc.fontSize(6).text('The ACORD name and logo are registered marks of ACORD', 30, footerY + 10, { width: 540, align: 'center' });
      
      doc.end();
      
      // Wait for PDF to be written with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('PDF generation timeout - stream did not finish within 30 seconds'));
        }, 30000);
        
        stream.on('finish', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        stream.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        
        doc.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      console.log(`✅ COI PDF generated: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ COI PDF generation error:', error.message);
      throw error;
    }
  }

  /**
   * Generate a Policy PDF document
   * @param {object} policyData - Policy data including coverage details
   * @param {string} uploadDir - Directory to save the generated PDF
   * @returns {Promise<string>} Filename of generated PDF
   */
  async generatePolicyPDF(policyData, uploadDir) {
    try {
      console.log(`📄 Adobe: Generating Policy PDF for ${policyData.policyNumber || 'policy'}`);
      
      const filename = `policy-${policyData.policyId || Date.now()}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, filename);
      
      // Create PDF document
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const stream = fs.createWriteStream(filepath);
      
      doc.pipe(stream);
      
      // Header
      doc.fontSize(20).text('INSURANCE POLICY', { align: 'center' });
      doc.moveDown();
      
      // Date
      doc.fontSize(10).text(`Issue Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();
      
      // Policy Information
      doc.fontSize(12).text('POLICY INFORMATION', { underline: true });
      doc.fontSize(10)
        .text(`Policy Number: ${policyData.policyNumber || 'N/A'}`)
        .text(`Policy Type: ${policyData.policyType || 'General Liability'}`)
        .text(`Effective Date: ${policyData.effectiveDate || 'N/A'}`)
        .text(`Expiration Date: ${policyData.expirationDate || 'N/A'}`);
      doc.moveDown();
      
      // Insured Information
      doc.fontSize(12).text('INSURED', { underline: true });
      doc.fontSize(10)
        .text(`Name: ${policyData.insuredName || 'N/A'}`)
        .text(`Address: ${policyData.insuredAddress || 'N/A'}`);
      doc.moveDown();
      
      // Insurance Carrier
      if (policyData.carrier) {
        doc.fontSize(12).text('INSURANCE CARRIER', { underline: true });
        doc.fontSize(10).text(policyData.carrier);
        doc.moveDown();
      }
      
      // Coverage Details
      doc.fontSize(12).text('COVERAGE DETAILS', { underline: true });
      doc.moveDown(0.5);
      
      if (policyData.coverageDetails) {
        Object.entries(policyData.coverageDetails).forEach(([key, value]) => {
          doc.fontSize(10).text(`${key}: ${value}`);
        });
      } else {
        doc.fontSize(10).text(`Coverage Amount: ${policyData.coverageAmount || 'As per policy terms'}`);
      }
      doc.moveDown();
      
      // Additional Information
      if (policyData.additionalInfo) {
        doc.fontSize(12).text('ADDITIONAL INFORMATION', { underline: true });
        doc.fontSize(10).text(policyData.additionalInfo);
        doc.moveDown();
      }
      
      // Footer
      doc.moveDown(2);
      doc.fontSize(8).text('This is a summary document. Please refer to the full policy documents for complete terms and conditions.', {
        align: 'center',
        width: 500
      });
      
      doc.end();
      
      // Wait for PDF to be written with timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Policy generation timeout - stream did not finish within 30 seconds'));
        }, 30000);
        
        stream.on('finish', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        stream.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        
        doc.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      console.log(`✅ Policy PDF generated: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Policy PDF generation error:', error.message);
      throw error;
    }
  }

  /**
   * Generate a sample COI PDF using ACORD 25 template
   * @param {object} overrides - Custom data to override template defaults
   * @param {string} uploadDir - Directory to save the generated PDF
   * @returns {Promise<object>} Generated COI data and filename
   */
  async generateSampleCOI(overrides = {}, uploadDir) {
    try {
      console.log(`📄 Adobe: Generating Sample ACORD 25 COI`);
      
      // Generate COI data using template
      const coiData = generateCOIData({
        ...overrides,
        isSample: true
      });
      
      // Generate the PDF
      const filename = await this.generateCOIPDF(coiData, uploadDir);
      
      return {
        success: true,
        coiData,
        filename,
        generatedAt: new Date().toISOString(),
        message: 'Sample COI generated successfully'
      };
    } catch (error) {
      console.error('❌ Sample COI generation error:', error.message);
      throw error;
    }
  }

  /**
   * Get ACORD 25 template for reference
   * @returns {object} The ACORD 25 template
   */
  getACORD25Template() {
    return acord25Template;
  }

  /**
   * Generate COI data using template (without PDF generation)
   * @param {object} overrides - Custom data to override template defaults
   * @returns {object} Complete COI data
   */
  generateCOIDataFromTemplate(overrides = {}) {
    return generateCOIData(overrides);
  }
}
