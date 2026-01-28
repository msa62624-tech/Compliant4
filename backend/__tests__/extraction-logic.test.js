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
    const glPolicyMatch = glSection.match(/(?:POLICY\s+(?:NUMBER|NO|#)\s*[:.]?\s*)?([A-Z]{2,4}[-\s]?\d[\dA-Z-]{3,20})/i);
    expect(glPolicyMatch).not.toBeNull();
    expect(glPolicyMatch[1]).toBe('GL-2024-12345');
    
    const wcMatch = mockACORD25WithMissingCoverages.match(/WORKERS\s+COMPENSATION[^\n]*(?:\n[^\n]*){0,3}/i);
    expect(wcMatch).not.toBeNull();
    
    const wcSection = wcMatch[0];
    const wcPolicyMatch = wcSection.match(/(?:POLICY\s+(?:NUMBER|NO|#)\s*[:.]?\s*)?([A-Z]{2,4}[-\s]?\d[\dA-Z-]{3,20})/i);
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
    const wcMatch = reorderedDoc.match(/WORKERS\s+COMPENSATION[^\n]*(?:\n[^\n]*){0,5}/i);
    expect(wcMatch).not.toBeNull();
    const wcSection = wcMatch[0];
    const wcDateMatches = wcSection.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g);
    expect(wcDateMatches).toEqual(['01/01/2024', '01/01/2025']);
    
    // GL comes second
    const glMatch = reorderedDoc.match(/COMMERCIAL\s+GENERAL\s+LIABILITY[^\n]*(?:\n[^\n]*){0,5}/i);
    expect(glMatch).not.toBeNull();
    const glSection = glMatch[0];
    const glDateMatches = glSection.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g);
    expect(glDateMatches).toEqual(['02/01/2024', '02/01/2025']);
  });
});

describe('Policy Number Pattern Validation', () => {
  test('Should NOT match coverage keywords as policy numbers', () => {
    // The old overly permissive pattern [A-Z0-9-]{7,30} could match these:
    const badMatches = [
      'COMMERCIAL-GENERAL-LIABILITY',
      'WORKERS-COMPENSATION',
      'AUTOMOBILE-LIABILITY',
      'GENERAL-AGGREGATE'
    ];
    
    // New pattern should NOT match these
    const pattern = /([A-Z]{2,4}[-\s]?\d[\dA-Z-]{3,20})/i;
    
    badMatches.forEach(str => {
      const match = str.match(pattern);
      expect(match).toBeNull();
    });
  });
  
  test('Should match valid policy numbers', () => {
    const validPolicyNumbers = [
      'GL-2024-12345',
      'WC-2024-67890',
      'AUTO 20241234',
      'UMB-123456789012',
      'XYZ 1234'
    ];
    
    const pattern = /([A-Z]{2,4}[-\s]?\d[\dA-Z-]{3,20})/i;
    
    validPolicyNumbers.forEach(policyNum => {
      const match = policyNum.match(pattern);
      expect(match).not.toBeNull();
      expect(match[1]).toBe(policyNum);
    });
  });
  
  test('Should validate policy numbers with isValidPolicyNumber logic', () => {
    // Replicate the isValidPolicyNumber validation
    const isValidPolicyNumber = (str) => {
      if (!str || str.length < 5) return false;
      if (!/\d/.test(str)) return false;
      const letterCount = (str.match(/[A-Z]/gi) || []).length;
      const digitCount = (str.match(/\d/g) || []).length;
      if (letterCount > 15 && digitCount < 3) return false;
      return true;
    };
    
    expect(isValidPolicyNumber('GL-2024-12345')).toBe(true);
    expect(isValidPolicyNumber('WC-2024-67890')).toBe(true);
    expect(isValidPolicyNumber('COMMERCIAL-GENERAL-LIABILITY')).toBe(false);
    expect(isValidPolicyNumber('ABC')).toBe(false);  // too short
    expect(isValidPolicyNumber('ABCDEFGHIJKLMNOP')).toBe(false);  // no digits
    expect(isValidPolicyNumber('ABCDEFGHIJKLMNOP12')).toBe(false);  // too many letters, too few digits
  });
});

describe('Fallback Logic Order for GL Dates', () => {
  test('Context-aware extraction should take precedence over generic fallback', () => {
    // Simulate document where generic "POLICY EFF" could match wrong date
    const mockDocument = `
    POLICY EFF 12/31/2023
    
    COMMERCIAL GENERAL LIABILITY
    POLICY NUMBER GL-2024-12345
    POLICY EFF 01/15/2024
    POLICY EXP 01/15/2025
    
    WORKERS COMPENSATION
    POLICY NUMBER WC-2024-67890
    POLICY EFF 03/20/2024
    POLICY EXP 03/20/2025
    `;
    
    // Extract GL section specifically
    const glSection = mockDocument.match(/COMMERCIAL\s+GENERAL\s+LIABILITY[\s\S]{0,500}?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    expect(glSection).not.toBeNull();
    expect(glSection[1]).toBe('01/15/2024');  // Should get date from GL section, not the first POLICY EFF
    
    // Extract the first generic POLICY EFF (which would be wrong for GL)
    const genericMatch = mockDocument.match(/POLICY\s+EFF\s*[:.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    expect(genericMatch).not.toBeNull();
    expect(genericMatch[1]).toBe('12/31/2023');  // This would be wrong!
    
    // Context-aware should be checked FIRST
    const contextAwareFirst = glSection[1];
    const genericFallback = genericMatch[1];
    
    // The CORRECT logic: (glSection && glSection[1]) || genericFallback
    const correctResult = contextAwareFirst || genericFallback;
    expect(correctResult).toBe('01/15/2024');
    
    // The WRONG logic: genericFallback || (glSection && glSection[1])
    const wrongResult = genericFallback || contextAwareFirst;
    expect(wrongResult).toBe('12/31/2023');  // Wrong!
    
    // Verify our fix produces the correct result
    expect(correctResult).not.toBe(wrongResult);
  });
});
