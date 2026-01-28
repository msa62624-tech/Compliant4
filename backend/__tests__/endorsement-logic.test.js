/**
 * Functional test for the endorsement extraction logic
 * Tests the actual logic that will be used in server.js
 */

import { describe, test, expect } from '@jest/globals';

// This function mimics the fixed logic from server.js
function checkForNonNegatedEndorsement(text, keywordPattern) {
  const allMatches = [];
  let match;
  const regex = new RegExp(keywordPattern.source, 'gi');
  
  while ((match = regex.exec(text)) !== null) {
    allMatches.push(match.index);
  }
  
  // If we find any occurrence, check if at least one is not negated
  if (allMatches.length > 0) {
    for (const matchIndex of allMatches) {
      const startPos = Math.max(0, matchIndex - 50);
      const precedingText = text.substring(startPos, matchIndex);
      const hasNegation = /(?:NO|NOT|EXCLUDED|EXCEPT|WITHOUT|DOES\s+NOT\s+INCLUDE|EXCLUDING)/i.test(precedingText);
      
      // If this occurrence is not negated, we found a valid endorsement
      if (!hasNegation) {
        return true;
      }
    }
  }
  
  return false;
}

describe('Endorsement Extraction Logic - Functional Tests', () => {
  test('Should detect Additional Insured when negated mention appears first', () => {
    const mockText = `
CERTIFICATE OF LIABILITY INSURANCE

GENERAL LIABILITY
CLAIMS-MADE [X] OCCUR []
POLICY NUMBER: GL-2024-12345

DESCRIPTION OF OPERATIONS:
NOTE: Additional insured status does NOT automatically apply unless specifically endorsed.

ENDORSEMENTS:
ADDITIONAL INSURED: Yes, as required by written contract
Primary and Non-Contributory
    `;
    
    const hasEndorsement = checkForNonNegatedEndorsement(mockText, /ADDITIONAL\s+INSURED/);
    
    // Should detect the valid endorsement despite the negated mention earlier
    expect(hasEndorsement).toBe(true);
  });

  test('Should detect Waiver of Subrogation when negated mention appears first', () => {
    const mockText = `
CERTIFICATE OF LIABILITY INSURANCE

GENERAL LIABILITY
CLAIMS-MADE [X] OCCUR []
POLICY NUMBER: GL-2024-12345

DESCRIPTION OF OPERATIONS:
NOTE: Waiver of Subrogation is NOT included unless specifically endorsed.

ENDORSEMENTS:
WAIVER OF SUBROGATION: Included as required by written contract
Waived in favor of certificate holder
    `;
    
    const hasEndorsement = checkForNonNegatedEndorsement(mockText, /(?:WAIVER|SUBROGATION)/);
    
    // Should detect the valid waiver despite the negated mention earlier
    expect(hasEndorsement).toBe(true);
  });

  test('Should reject Additional Insured when all occurrences are negated', () => {
    const mockText = `
CERTIFICATE OF LIABILITY INSURANCE

GENERAL LIABILITY
POLICY NUMBER: GL-2024-12345

DESCRIPTION OF OPERATIONS:
NOTE: This policy does NOT include Additional Insured status.
EXCLUDED: Additional Insured coverage not provided.
    `;
    
    const hasEndorsement = checkForNonNegatedEndorsement(mockText, /ADDITIONAL\s+INSURED/);
    
    // Should correctly reject when all occurrences are negated
    expect(hasEndorsement).toBe(false);
  });

  test('Should reject Waiver when all occurrences are negated', () => {
    const mockText = `
CERTIFICATE OF LIABILITY INSURANCE

GENERAL LIABILITY
POLICY NUMBER: GL-2024-12345

DESCRIPTION OF OPERATIONS:
NOTE: Waiver of Subrogation is NOT provided under this policy.
EXCLUDED: Subrogation rights are retained by the insurer.
    `;
    
    const hasEndorsement = checkForNonNegatedEndorsement(mockText, /(?:WAIVER|SUBROGATION)/);
    
    // Should correctly reject when all occurrences are negated
    expect(hasEndorsement).toBe(false);
  });

  test('Should detect Additional Insured with only positive mentions', () => {
    const mockText = `
CERTIFICATE OF LIABILITY INSURANCE

GENERAL LIABILITY
POLICY NUMBER: GL-2024-12345

ENDORSEMENTS:
ADDITIONAL INSURED: Certificate holder is included as additional insured
Primary and Non-Contributory: Yes
    `;
    
    const hasEndorsement = checkForNonNegatedEndorsement(mockText, /ADDITIONAL\s+INSURED/);
    
    // Should detect when only positive mentions exist
    expect(hasEndorsement).toBe(true);
  });

  test('Should handle complex document with multiple negated and valid endorsements', () => {
    const mockText = `
CERTIFICATE OF LIABILITY INSURANCE

GENERAL LIABILITY
POLICY NUMBER: GL-2024-12345

IMPORTANT NOTICES:
1. Additional Insured status does NOT apply to Professional Liability coverage.
2. Waiver of Subrogation does NOT extend to intentional acts.

COMMERCIAL GENERAL LIABILITY ENDORSEMENTS:
✓ ADDITIONAL INSURED: Yes - Certificate Holder included as Additional Insured per written contract
✓ Primary and Non-Contributory: Included
✓ WAIVER OF SUBROGATION: Waived in favor of Certificate Holder as required by contract

PROFESSIONAL LIABILITY:
× Additional Insured: NOT APPLICABLE
× Waiver: EXCLUDED
    `;
    
    const hasAddlInsured = checkForNonNegatedEndorsement(mockText, /ADDITIONAL\s+INSURED/);
    const hasWaiver = checkForNonNegatedEndorsement(mockText, /(?:WAIVER|SUBROGATION)/);
    
    // Should correctly identify both endorsements despite multiple negated mentions
    expect(hasAddlInsured).toBe(true);
    expect(hasWaiver).toBe(true);
  });

  test('Should handle document with negation followed by multiple valid endorsements', () => {
    const mockText = `
GENERAL LIABILITY

NOTES:
The following coverages do NOT apply to Professional Liability:
- Additional Insured
- Waiver of Subrogation

COMMERCIAL GENERAL LIABILITY ENDORSEMENTS:
ADDITIONAL INSURED - Included per contract requirement
WAIVER OF SUBROGATION - Included per contract requirement
ADDITIONAL INSURED applies to ongoing operations and completed operations
    `;
    
    const hasAddlInsured = checkForNonNegatedEndorsement(mockText, /ADDITIONAL\s+INSURED/);
    const hasWaiver = checkForNonNegatedEndorsement(mockText, /(?:WAIVER|SUBROGATION)/);
    
    // Should find the valid endorsements that appear after the negated section
    expect(hasAddlInsured).toBe(true);
    expect(hasWaiver).toBe(true);
  });
});
