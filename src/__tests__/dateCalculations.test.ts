import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateDaysUntil, calculateDaysUntilExpiry } from '@/utils/dateCalculations';

describe('dateCalculations', () => {
  beforeEach(() => {
    // Set a fixed date for testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateDaysUntil', () => {
    test('calculates days until future date', () => {
      const futureDate = new Date('2024-01-20');
      expect(calculateDaysUntil(futureDate)).toBe(5);
    });

    test('calculates days for past date (negative)', () => {
      const pastDate = new Date('2024-01-10');
      expect(calculateDaysUntil(pastDate)).toBe(-5);
    });

    test('returns 0 for same day', () => {
      const today = new Date('2024-01-15');
      expect(calculateDaysUntil(today)).toBe(0);
    });

    test('handles string date input', () => {
      expect(calculateDaysUntil('2024-01-25')).toBe(10);
    });

    test('handles date one month away', () => {
      const nextMonth = new Date('2024-02-15');
      expect(calculateDaysUntil(nextMonth)).toBe(31);
    });

    test('handles date one year away', () => {
      const nextYear = new Date('2025-01-15');
      expect(calculateDaysUntil(nextYear)).toBe(366); // 2024 is a leap year
    });
  });

  describe('calculateDaysUntilExpiry', () => {
    test('calculates days until expiry', () => {
      const expiryDate = new Date('2024-01-30');
      expect(calculateDaysUntilExpiry(expiryDate)).toBe(15);
    });

    test('handles expired date', () => {
      const expiredDate = new Date('2024-01-01');
      expect(calculateDaysUntilExpiry(expiredDate)).toBe(-14);
    });

    test('handles string date input', () => {
      expect(calculateDaysUntilExpiry('2024-02-01')).toBe(17);
    });
  });
});
