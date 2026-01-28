import { describe, test, expect } from 'vitest';
import { validatePolicyTradeCoverage, TRADE_EXCLUSION_PATTERNS, NCCI_CLASS_CODE_MAPPINGS } from '../policyTradeValidator';

describe('policyTradeValidator', () => {
  describe('validatePolicyTradeCoverage', () => {
    test('returns compliant true when no trades required', () => {
      const result = validatePolicyTradeCoverage({}, []);
      expect(result.compliant).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('detects trade exclusions in policy notes', () => {
      const coi = {
        gl_policy_notes: 'no roofing work allowed',
      };
      const requiredTrades = ['roofing'];
      
      const result = validatePolicyTradeCoverage(coi, requiredTrades);
      
      expect(result.compliant).toBe(false);
      expect(result.excludedTrades).toHaveLength(1);
      expect(result.excludedTrades[0].trade).toBe('roofing');
    });

    test('validates classification codes', () => {
      const coi = {
        gl_class_codes: 5402, // Carpentry code
      };
      const requiredTrades = ['carpentry'];
      
      const result = validatePolicyTradeCoverage(coi, requiredTrades);
      
      expect(result.compliant).toBe(true);
    });

    test('warns about premium basis for multiple trades', () => {
      const coi = {
        gl_premium_basis: 'single trade only',
      };
      const requiredTrades = ['carpentry', 'roofing'];
      
      const result = validatePolicyTradeCoverage(coi, requiredTrades);
      
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('TRADE_EXCLUSION_PATTERNS', () => {
    test('exports trade exclusion patterns', () => {
      expect(TRADE_EXCLUSION_PATTERNS).toBeDefined();
      expect(TRADE_EXCLUSION_PATTERNS.roofing).toBeInstanceOf(Array);
      expect(TRADE_EXCLUSION_PATTERNS.carpentry).toContain('no carpentry');
    });
  });

  describe('NCCI_CLASS_CODE_MAPPINGS', () => {
    test('exports NCCI classification mappings', () => {
      expect(NCCI_CLASS_CODE_MAPPINGS).toBeDefined();
      expect(NCCI_CLASS_CODE_MAPPINGS[5402]).toContain('carpentry');
      expect(NCCI_CLASS_CODE_MAPPINGS[5474]).toContain('roofing');
    });
  });
});
