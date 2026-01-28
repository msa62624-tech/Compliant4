import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrokerUploadLink,
  createCOIReviewLink,
  createProjectDetailsLink,
} from '@/urlConfig';

describe('urlConfig - New URL Utilities', () => {
  let originalWindow;
  
  beforeEach(() => {
    originalWindow = global.window;
    global.window = {
      location: {
        origin: 'http://localhost:5175',
        protocol: 'http:',
        host: 'localhost:5175',
      }
    };
  });
  
  afterEach(() => {
    global.window = originalWindow;
  });

  describe('createBrokerUploadLink', () => {
    test('creates broker upload link with defaults', () => {
      const link = createBrokerUploadLink('abc123');
      expect(link).toBe('http://localhost:5175/broker-upload-coi?token=abc123&step=1&action=upload');
    });

    test('creates broker upload link with custom step', () => {
      const link = createBrokerUploadLink('abc123', 3);
      expect(link).toBe('http://localhost:5175/broker-upload-coi?token=abc123&step=3&action=upload');
    });

    test('creates broker upload link with custom action', () => {
      const link = createBrokerUploadLink('abc123', 3, 'sign');
      expect(link).toBe('http://localhost:5175/broker-upload-coi?token=abc123&step=3&action=sign');
    });

    test('handles different token formats', () => {
      const link = createBrokerUploadLink('token-with-dashes-123');
      expect(link).toContain('token=token-with-dashes-123');
    });
  });

  describe('createCOIReviewLink', () => {
    test('creates COI review link', () => {
      const link = createCOIReviewLink('coi-123');
      expect(link).toBe('http://localhost:5175/coi-review?id=coi-123');
    });

    test('handles numeric IDs', () => {
      const link = createCOIReviewLink(456);
      expect(link).toBe('http://localhost:5175/coi-review?id=456');
    });

    test('handles UUID format IDs', () => {
      const link = createCOIReviewLink('550e8400-e29b-41d4-a716-446655440000');
      expect(link).toContain('id=550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('createProjectDetailsLink', () => {
    test('creates project details link', () => {
      const link = createProjectDetailsLink('project-789');
      expect(link).toBe('http://localhost:5175/project-details?id=project-789');
    });

    test('handles numeric project IDs', () => {
      const link = createProjectDetailsLink(789);
      expect(link).toBe('http://localhost:5175/project-details?id=789');
    });

    test('handles UUID format project IDs', () => {
      const link = createProjectDetailsLink('650e8400-e29b-41d4-a716-446655440001');
      expect(link).toContain('id=650e8400-e29b-41d4-a716-446655440001');
    });
  });

  describe('Base URL handling', () => {
    test('uses window origin when available', () => {
      global.window.location.origin = 'https://app.example.com';
      const link = createProjectDetailsLink('123');
      expect(link).toContain('https://app.example.com');
    });

    test('handles Codespaces URLs', () => {
      global.window.location = {
        origin: 'https://abc-5175.app.github.dev',
        protocol: 'https:',
        host: 'abc-5175.app.github.dev',
      };
      const link = createProjectDetailsLink('123');
      expect(link).toContain('https://abc-5175.app.github.dev');
    });
  });
});
