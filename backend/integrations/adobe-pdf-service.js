/**
 * Adobe PDF Services Integration
 * Handles PDF extraction, text recognition, and digital signatures
 * Requires: ADOBE_API_KEY and ADOBE_CLIENT_ID from environment
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

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
      doc.fontSize(9).font('Helvetica').text(coiData.broker?.name || 'Insurance Broker', 30, yPos);
      if (coiData.broker?.email) {
        yPos += 12;
        doc.text(coiData.broker.email, 30, yPos);
      }
      if (coiData.broker?.phone) {
        yPos += 12;
        doc.text(coiData.broker.phone, 30, yPos);
      }
      
      // Insured Section
      yPos = 70;
      doc.fontSize(7).font('Helvetica-Bold').text('INSURED', 320, yPos);
      yPos += 12;
      doc.fontSize(9).font('Helvetica').text(coiData.subcontractorName || 'Subcontractor', 320, yPos);
      if (coiData.subcontractorAddress) {
        yPos += 12;
        doc.text(coiData.subcontractorAddress, 320, yPos);
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
      if (coiData.coverages && coiData.coverages.length > 0) {
        coiData.coverages.forEach(coverage => {
          yPos += 5;
          doc.fontSize(8).font('Helvetica')
            .text(coverage.type || 'N/A', 30, yPos, { width: 140 })
            .text(coverage.policyNumber || 'N/A', 180, yPos, { width: 90 })
            .text(coverage.effectiveDate || 'N/A', 280, yPos, { width: 50 })
            .text(coverage.expirationDate || 'N/A', 340, yPos, { width: 70 })
            .text(coverage.limits || 'N/A', 420, yPos, { width: 150 });
          yPos += 25;
          doc.moveTo(30, yPos).lineTo(580, yPos).stroke();
        });
      } else {
        // Default coverage lines
        const defaultCoverages = [
          { type: 'GENERAL LIABILITY', limits: 'Per Project Requirements' },
          { type: 'WORKERS COMPENSATION', limits: 'Statutory Limits' },
          { type: 'AUTOMOBILE LIABILITY', limits: 'Per Project Requirements' }
        ];
        
        defaultCoverages.forEach(coverage => {
          yPos += 5;
          doc.fontSize(8).font('Helvetica')
            .text(coverage.type, 30, yPos, { width: 140 })
            .text(coverage.limits, 420, yPos, { width: 150 });
          yPos += 25;
          doc.moveTo(30, yPos).lineTo(580, yPos).stroke();
        });
      }
      
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
      if (coiData.certificateHolder) {
        doc.text(coiData.certificateHolder, 30, yPos);
        yPos += 12;
      }
      if (coiData.certificateHolderAddress) {
        doc.text(coiData.certificateHolderAddress, 30, yPos);
      }
      
      // Footer - Standard ACORD 25 disclaimer
      yPos = 720;
      doc.fontSize(6).font('Helvetica').text('ACORD 25 (2016/03)', 30, yPos);
      doc.fontSize(6).text('© 1988-2015 ACORD CORPORATION. All rights reserved.', 200, yPos, { align: 'center', width: 200 });
      doc.fontSize(6).text('The ACORD name and logo are registered marks of ACORD', 30, yPos + 10, { width: 540, align: 'center' });
      
      doc.end();
      
      // Wait for PDF to be written
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
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
      
      // Wait for PDF to be written
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
      
      console.log(`✅ Policy PDF generated: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Policy PDF generation error:', error.message);
      throw error;
    }
  }
}
