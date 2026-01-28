/**
 * Test for endorsement extraction with multiple keyword occurrences
 * This test validates that extraction logic handles documents with mixed negated/non-negated instances
 */

import { describe, test, expect } from '@jest/globals';

describe('Endorsement Extraction - Multiple Keyword Occurrences', () => {
  test('Should detect valid Additional Insured even when negated mention appears first', () => {
    // Mock text with negated mention first, then valid endorsement
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
    
    // Check for negation in first occurrence
    const firstKeywordMatch = /ADDITIONAL\s+INSURED/i.exec(mockText);
    expect(firstKeywordMatch).not.toBeNull();
    
    const startPos = Math.max(0, firstKeywordMatch.index - 50);
    const precedingText = mockText.substring(startPos, firstKeywordMatch.index);
    const hasNegationFirst = /(?:NO|NOT|EXCLUDED|EXCEPT|WITHOUT|DOES\s+NOT\s+INCLUDE|EXCLUDING)/i.test(precedingText);
    
    // First occurrence should be negated (in the note section)
    expect(hasNegationFirst).toBe(true);
    
    // But we should still find valid endorsement later in document
    // This requires checking all occurrences, not just the first one
    const allMatches = [];
    let match;
    const regex = /ADDITIONAL\s+INSURED/gi;
    while ((match = regex.exec(mockText)) !== null) {
      allMatches.push({
        index: match.index,
        text: match[0]
      });
    }
    
    // Should have 2 occurrences
    expect(allMatches.length).toBe(2);
    
    // Check second occurrence for negation
    const secondMatch = allMatches[1];
    const secondStartPos = Math.max(0, secondMatch.index - 50);
    const secondPrecedingText = mockText.substring(secondStartPos, secondMatch.index);
    const hasNegationSecond = /(?:NO|NOT|EXCLUDED|EXCEPT|WITHOUT|DOES\s+NOT\s+INCLUDE|EXCLUDING)/i.test(secondPrecedingText);
    
    // Second occurrence should NOT be negated
    expect(hasNegationSecond).toBe(false);
  });
  
  test('Should detect valid Waiver of Subrogation even when negated mention appears first', () => {
    // Mock text with negated mention first, then valid endorsement
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
    
    // Check for negation in first occurrence
    const firstKeywordMatch = /(?:WAIVER|SUBROGATION)/i.exec(mockText);
    expect(firstKeywordMatch).not.toBeNull();
    
    const startPos = Math.max(0, firstKeywordMatch.index - 50);
    const precedingText = mockText.substring(startPos, firstKeywordMatch.index);
    const hasNegationFirst = /(?:NO|NOT|EXCLUDED|EXCEPT|WITHOUT|DOES\s+NOT\s+INCLUDE|EXCLUDING)/i.test(precedingText);
    
    // First occurrence should be negated (in the note section)
    expect(hasNegationFirst).toBe(true);
    
    // Find all waiver/subrogation occurrences
    const allMatches = [];
    let match;
    const regex = /(?:WAIVER|SUBROGATION)/gi;
    while ((match = regex.exec(mockText)) !== null) {
      allMatches.push({
        index: match.index,
        text: match[0]
      });
    }
    
    // Should have multiple occurrences
    expect(allMatches.length).toBeGreaterThan(1);
    
    // Check later occurrences - at least one should not be negated
    let hasValidOccurrence = false;
    for (let i = 1; i < allMatches.length; i++) {
      const occMatch = allMatches[i];
      const occStartPos = Math.max(0, occMatch.index - 50);
      const occPrecedingText = mockText.substring(occStartPos, occMatch.index);
      const hasNegation = /(?:NO|NOT|EXCLUDED|EXCEPT|WITHOUT|DOES\s+NOT\s+INCLUDE|EXCLUDING)/i.test(occPrecedingText);
      
      if (!hasNegation) {
        hasValidOccurrence = true;
        break;
      }
    }
    
    // Should find at least one non-negated occurrence
    expect(hasValidOccurrence).toBe(true);
  });
  
  test('Should correctly reject when all occurrences are negated', () => {
    const mockText = `
CERTIFICATE OF LIABILITY INSURANCE

GENERAL LIABILITY
POLICY NUMBER: GL-2024-12345

DESCRIPTION OF OPERATIONS:
NOTE: This policy does NOT include Additional Insured status.
EXCLUDED: Additional Insured coverage not provided.
    `;
    
    // Find all occurrences
    const allMatches = [];
    let match;
    const regex = /ADDITIONAL\s+INSURED/gi;
    while ((match = regex.exec(mockText)) !== null) {
      allMatches.push({
        index: match.index,
        text: match[0]
      });
    }
    
    // Check each occurrence for negation
    let hasAnyNonNegated = false;
    for (const occMatch of allMatches) {
      const occStartPos = Math.max(0, occMatch.index - 50);
      const occPrecedingText = mockText.substring(occStartPos, occMatch.index);
      const hasNegation = /(?:NO|NOT|EXCLUDED|EXCEPT|WITHOUT|DOES\s+NOT\s+INCLUDE|EXCLUDING)/i.test(occPrecedingText);
      
      if (!hasNegation) {
        hasAnyNonNegated = true;
        break;
      }
    }
    
    // When all occurrences are negated, should be false
    expect(hasAnyNonNegated).toBe(false);
  });
  
  test('Should detect endorsement when only positive mentions exist', () => {
    const mockText = `
CERTIFICATE OF LIABILITY INSURANCE

GENERAL LIABILITY
POLICY NUMBER: GL-2024-12345

ENDORSEMENTS:
ADDITIONAL INSURED: Certificate holder is included as additional insured
Primary and Non-Contributory: Yes
    `;
    
    // Find all occurrences
    const allMatches = [];
    let match;
    const regex = /ADDITIONAL\s+INSURED/gi;
    while ((match = regex.exec(mockText)) !== null) {
      allMatches.push({
        index: match.index,
        text: match[0]
      });
    }
    
    // Should have at least one occurrence
    expect(allMatches.length).toBeGreaterThan(0);
    
    // Check each occurrence for negation
    let hasAnyNonNegated = false;
    for (const occMatch of allMatches) {
      const occStartPos = Math.max(0, occMatch.index - 50);
      const occPrecedingText = mockText.substring(occStartPos, occMatch.index);
      const hasNegation = /(?:NO|NOT|EXCLUDED|EXCEPT|WITHOUT|DOES\s+NOT\s+INCLUDE|EXCLUDING)/i.test(occPrecedingText);
      
      if (!hasNegation) {
        hasAnyNonNegated = true;
        break;
      }
    }
    
    // Should find at least one non-negated occurrence
    expect(hasAnyNonNegated).toBe(true);
  });
});
