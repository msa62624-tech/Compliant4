import { describe, test, expect } from 'vitest';
import {
  EMAIL_SIGNATURE,
  formatInsuranceType,
  createEmailGreeting,
  formatEmailList,
  buildEmailSubject,
} from '@/utils/emailTemplates';

describe('emailTemplates', () => {
  describe('EMAIL_SIGNATURE', () => {
    test('exports standard signature', () => {
      expect(EMAIL_SIGNATURE).toBe('Best regards,\nInsureTrack System');
    });
  });

  describe('formatInsuranceType', () => {
    test('formats underscore-separated type', () => {
      expect(formatInsuranceType('general_liability')).toBe('General Liability');
    });

    test('formats workers_compensation', () => {
      expect(formatInsuranceType('workers_compensation')).toBe('Workers Compensation');
    });

    test('formats automobile_liability', () => {
      expect(formatInsuranceType('automobile_liability')).toBe('Automobile Liability');
    });

    test('handles single word', () => {
      expect(formatInsuranceType('umbrella')).toBe('Umbrella');
    });

    test('handles empty string', () => {
      expect(formatInsuranceType('')).toBe('');
    });

    test('handles null', () => {
      expect(formatInsuranceType(null)).toBe('');
    });

    test('handles undefined', () => {
      expect(formatInsuranceType(undefined)).toBe('');
    });
  });

  describe('createEmailGreeting', () => {
    test('creates broker greeting with name', () => {
      expect(createEmailGreeting('broker', 'John Smith')).toBe('Dear John Smith,');
    });

    test('creates broker greeting without name', () => {
      expect(createEmailGreeting('broker')).toBe('Dear Insurance Broker,');
    });

    test('creates gc greeting with name', () => {
      expect(createEmailGreeting('gc', 'Jane Doe')).toBe('Dear Jane Doe,');
    });

    test('creates gc greeting without name', () => {
      expect(createEmailGreeting('gc')).toBe('Dear General Contractor,');
    });

    test('creates subcontractor greeting with name', () => {
      expect(createEmailGreeting('subcontractor', 'John Doe')).toBe('Dear John Doe,');
    });

    test('creates subcontractor greeting without name', () => {
      expect(createEmailGreeting('subcontractor')).toBe('Dear Subcontractor,');
    });

    test('creates admin greeting without name', () => {
      expect(createEmailGreeting('admin')).toBe('Dear Admin,');
    });

    test('handles unknown recipient type', () => {
      expect(createEmailGreeting('unknown')).toBe('Dear User,');
    });
  });

  describe('formatEmailList', () => {
    test('formats array with default separator', () => {
      expect(formatEmailList(['Item 1', 'Item 2', 'Item 3'])).toBe('Item 1, Item 2, Item 3');
    });

    test('formats array with custom separator', () => {
      expect(formatEmailList(['Item 1', 'Item 2', 'Item 3'], ' | ')).toBe('Item 1 | Item 2 | Item 3');
    });

    test('handles single item', () => {
      expect(formatEmailList(['Only Item'])).toBe('Only Item');
    });

    test('handles empty array', () => {
      expect(formatEmailList([])).toBe('');
    });

    test('handles non-array input', () => {
      expect(formatEmailList(null)).toBe('');
    });
  });

  describe('buildEmailSubject', () => {
    test('adds URGENT prefix', () => {
      expect(buildEmailSubject('Policy Expiring', 'URGENT')).toBe('URGENT: Policy Expiring');
    });

    test('adds HIGH prefix', () => {
      expect(buildEmailSubject('Policy Expiring', 'HIGH')).toBe('HIGH: Policy Expiring');
    });

    test('does not add STANDARD prefix', () => {
      expect(buildEmailSubject('Policy Expiring', 'STANDARD')).toBe('Policy Expiring');
    });

    test('does not add prefix when urgency is null', () => {
      expect(buildEmailSubject('Policy Expiring', null)).toBe('Policy Expiring');
    });

    test('does not add prefix when urgency is undefined', () => {
      expect(buildEmailSubject('Policy Expiring')).toBe('Policy Expiring');
    });
  });
});
