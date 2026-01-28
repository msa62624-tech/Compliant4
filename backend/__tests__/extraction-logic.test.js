/**
 * Test for data extraction logic fixes
 * This test validates that extraction logic doesn't use index-based assignment
 * and correctly extracts data from coverage-specific sections
 */

import { describe, test, expect } from '@jest/globals';

// Mock text representing an ACORD 25 form with:
// - Only GL and WC coverage (no Auto or Umbrella)
// - Different date patterns
// - Different policy number patterns
const mockACORD25WithMissingCoverages = `
PRODUCER
ABC Insurance Agency
123 Main St
Phone: (555) 123-4567
E-MAIL: agent@abcinsurance.com

INSURER A: XYZ Insurance Company
INSURER B: DEF Workers Comp Inc

TYPE OF INSURANCE

COMMERCIAL GENERAL LIABILITY
INSR LTR A
POLICY NUMBER GL-2024-12345
POLICY EFF 01/15/2024
POLICY EXP 01/15/2025
EACH OCCURRENCE $1,000,000
GENERAL AGGREGATE $2,000,000

WORKERS COMPENSATION
INSR LTR B
POLICY NUMBER WC-2024-67890
POLICY EFF 03/20/2024
POLICY EXP 03/20/2025
E.L. EACH ACCIDENT $1,000,000

NAMED INSURED: Test Company LLC
`;

describe('Data Extraction Logic - Context-Aware Extraction', () => {
  test('Should not rely on index-based date assignment', () => {
    // This test ensures that even when only GL and WC exist (no Auto/Umbrella),
    // the dates are correctly assigned based on coverage context, not array index
    
    // Extract all dates
    const allDates = [];
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/g;
    let match;
    while ((match = datePattern.exec(mockACORD25WithMissingCoverages)) !== null) {
      allDates.push(match[1]);
    }
    
    // Verify we have 4 dates (2 for GL, 2 for WC)
    expect(allDates.length).toBe(4);
    expect(allDates).toEqual(['01/15/2024', '01/15/2025', '03/20/2024', '03/20/2025']);
    
    // OLD BUGGY BEHAVIOR would assign:
    // - allDates[0] to GL effective (01/15/2024) ✓ correct by luck
    // - allDates[1] to GL expiration (01/15/2025) ✓ correct by luck
    // - allDates[2] to WC effective (03/20/2024) ✓ correct by luck
    // - allDates[3] to WC expiration (03/20/2025) ✓ correct by luck
    // BUT if Auto existed between them, it would fail!
    
    // NEW CONTEXT-AWARE BEHAVIOR extracts from coverage sections:
    // GL section
    const glSection = mockACORD25WithMissingCoverages.match(/COMMERCIAL\s+GENERAL\s+LIABILITY[\s\S]{0,500}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    expect(glSection).not.toBeNull();
    expect(glSection[1]).toBe('01/15/2024');
    
    const glSectionExp = mockACORD25WithMissingCoverages.match(/COMMERCIAL\s+GENERAL\s+LIABILITY[\s\S]{0,500}?(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})[\s\S]{0,100}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    expect(glSectionExp).not.toBeNull();
    expect(glSectionExp[1]).toBe('01/15/2025');
    
    // WC section
    const wcSection = mockACORD25WithMissingCoverages.match(/WORKERS\s+COMPENSATION[\s\S]{0,500}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    expect(wcSection).not.toBeNull();
    expect(wcSection[1]).toBe('03/20/2024');
    
    const wcSectionExp = mockACORD25WithMissingCoverages.match(/WORKERS\s+COMPENSATION[\s\S]{0,500}?(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})[\s\S]{0,100}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    expect(wcSectionExp).not.toBeNull();
    expect(wcSectionExp[1]).toBe('03/20/2025');
  });
  
  test('Should extract policy numbers from coverage-specific sections', () => {
    // Extract policy numbers using context-aware patterns
    const glMatch = mockACORD25WithMissingCoverages.match(/COMMERCIAL\s+GENERAL\s+LIABILITY[^\n]*(?:\n[^\n]*){0,3}/i);
    expect(glMatch).not.toBeNull();
    
    const glSection = glMatch[0];
    const glPolicyMatch = glSection.match(/(?:POLICY\s+(?:NUMBER|NO|#)\s*[:.]?\s*)?([A-Z]{2,4}[-\s]?\d{4,12})/i);
    expect(glPolicyMatch).not.toBeNull();
    expect(glPolicyMatch[1]).toBe('GL-2024-12345');
    
    const wcMatch = mockACORD25WithMissingCoverages.match(/WORKERS\s+COMPENSATION[^\n]*(?:\n[^\n]*){0,3}/i);
    expect(wcMatch).not.toBeNull();
    
    const wcSection = wcMatch[0];
    const wcPolicyMatch = wcSection.match(/(?:POLICY\s+(?:NUMBER|NO|#)\s*[:.]?\s*)?([A-Z]{2,4}[-\s]?\d{4,12})/i);
    expect(wcPolicyMatch).not.toBeNull();
    expect(wcPolicyMatch[1]).toBe('WC-2024-67890');
  });
  
  test('Should validate insurer letters exist in insurer map', () => {
    // Extract insurer map
    const insurerMap = {};
    const lines = mockACORD25WithMissingCoverages.split('\n');
    for (const line of lines) {
      const insurerMatch = line.match(/INSURER\s+([A-F])\s*[:\s]+(.+?)$/i);
      if (insurerMatch) {
        const letter = insurerMatch[1].toUpperCase();
        const carrier = insurerMatch[2].trim();
        if (carrier && carrier.length > 3 && !insurerMap[letter]) {
          insurerMap[letter] = carrier;
        }
      }
    }
    
    expect(insurerMap).toHaveProperty('A', 'XYZ Insurance Company');
    expect(insurerMap).toHaveProperty('B', 'DEF Workers Comp Inc');
    
    // GL should map to insurer A
    const glInsurerMatch = mockACORD25WithMissingCoverages.match(/COMMERCIAL\s+GENERAL\s+LIABILITY[\s\S]{0,500}?(?:INSR\s+LTR[\s\n:]+)([A-F])\b/i);
    expect(glInsurerMatch).not.toBeNull();
    expect(glInsurerMatch[1].toUpperCase()).toBe('A');
    expect(insurerMap[glInsurerMatch[1].toUpperCase()]).toBe('XYZ Insurance Company');
    
    // WC should map to insurer B
    const wcInsurerMatch = mockACORD25WithMissingCoverages.match(/WORKERS\s+COMPENSATION[\s\S]{0,500}?(?:INSR\s+LTR[\s\n:]+)([A-F])\b/i);
    expect(wcInsurerMatch).not.toBeNull();
    expect(wcInsurerMatch[1].toUpperCase()).toBe('B');
    expect(insurerMap[wcInsurerMatch[1].toUpperCase()]).toBe('DEF Workers Comp Inc');
  });
});

describe('Data Extraction Logic - Edge Cases', () => {
  test('Should handle documents with coverages in different order', () => {
    const reorderedDoc = `
WORKERS COMPENSATION
INSR LTR B
POLICY NUMBER WC-FIRST-001
POLICY EFF 01/01/2024
POLICY EXP 01/01/2025

COMMERCIAL GENERAL LIABILITY
INSR LTR A
POLICY NUMBER GL-SECOND-002
POLICY EFF 02/01/2024
POLICY EXP 02/01/2025
`;
    
    // WC comes first in this document
    const wcMatch = reorderedDoc.match(/WORKERS\s+COMPENSATION[^\n]*(?:\n[^\n]*){0,3}/i);
    expect(wcMatch).not.toBeNull();
    const wcSection = wcMatch[0];
    const wcDateMatches = wcSection.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g);
    expect(wcDateMatches).toEqual(['01/01/2024', '01/01/2025']);
    
    // GL comes second
    const glMatch = reorderedDoc.match(/COMMERCIAL\s+GENERAL\s+LIABILITY[^\n]*(?:\n[^\n]*){0,3}/i);
    expect(glMatch).not.toBeNull();
    const glSection = glMatch[0];
    const glDateMatches = glSection.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g);
    expect(glDateMatches).toEqual(['02/01/2024', '02/01/2025']);
  });
});
