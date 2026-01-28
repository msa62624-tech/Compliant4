import { describe, test, expect } from '@jest/globals';
import { escapeHtml } from '../utils/htmlEscaping.js';

describe('htmlEscaping', () => {
  describe('escapeHtml', () => {
    test('escapes ampersand', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    test('escapes less than', () => {
      expect(escapeHtml('A < B')).toBe('A &lt; B');
    });

    test('escapes greater than', () => {
      expect(escapeHtml('A > B')).toBe('A &gt; B');
    });

    test('escapes double quote', () => {
      expect(escapeHtml('Say "hello"')).toBe('Say &quot;hello&quot;');
    });

    test('escapes single quote', () => {
      expect(escapeHtml("It's working")).toBe('It&#x27;s working');
    });

    test('escapes forward slash', () => {
      expect(escapeHtml('path/to/file')).toBe('path&#x2F;to&#x2F;file');
    });

    test('escapes multiple special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    test('handles null input', () => {
      expect(escapeHtml(null)).toBe('');
    });

    test('handles undefined input', () => {
      expect(escapeHtml(undefined)).toBe('');
    });

    test('handles empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    test('handles normal text without special characters', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    test('handles numbers', () => {
      expect(escapeHtml(123)).toBe('123');
    });
  });
});
