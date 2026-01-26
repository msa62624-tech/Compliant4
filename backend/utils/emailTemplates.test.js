/**
 * Tests for email template security - ensuring XSS prevention
 */

import { getPasswordResetEmail, getDocumentReplacementNotificationEmail, escapeHtml } from './emailTemplates.js';

// Simple test runner
function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(`   ${error.message}`);
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNotContains(haystack, needle, message) {
  if (haystack.includes(needle)) {
    throw new Error(message);
  }
}

function assertContains(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message);
  }
}

// Run tests
console.log('\n🧪 Running Email Template Security Tests\n');

let passed = 0;
let failed = 0;

// Test escapeHtml function
if (test('escapeHtml - escapes < and >', () => {
  const result = escapeHtml('<script>alert("xss")</script>');
  assert(result === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'Should escape script tags');
})) passed++; else failed++;

if (test('escapeHtml - escapes quotes', () => {
  const result = escapeHtml('"><script>alert("xss")</script>');
  assert(result === '&quot;&gt;&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'Should escape quotes');
})) passed++; else failed++;

if (test('escapeHtml - escapes ampersands', () => {
  const result = escapeHtml('&<>"\'');
  assert(result === '&amp;&lt;&gt;&quot;&#039;', 'Should escape all special chars');
})) passed++; else failed++;

if (test('escapeHtml - handles null/undefined', () => {
  assert(escapeHtml(null) === '', 'Should handle null');
  assert(escapeHtml(undefined) === '', 'Should handle undefined');
})) passed++; else failed++;

// Test password reset email
if (test('getPasswordResetEmail - escapes malicious name', () => {
  const maliciousName = '<script>alert("xss")</script>';
  const email = getPasswordResetEmail(maliciousName, 'https://example.com/reset', 'general');
  assertNotContains(email, '<script>alert("xss")</script>', 'Should not contain unescaped script tag');
  assertContains(email, '&lt;script&gt;', 'Should contain escaped script tag');
})) passed++; else failed++;

if (test('getPasswordResetEmail - escapes malicious reset link', () => {
  const maliciousLink = 'javascript:alert("xss")';
  const email = getPasswordResetEmail('User', maliciousLink, 'general');
  // The link should be escaped, checking the escaped version
  assertContains(email, 'href="javascript:alert(&quot;xss&quot;)"', 'Should escape quotes in href');
})) passed++; else failed++;

if (test('getPasswordResetEmail - escapes HTML injection in name', () => {
  const maliciousName = '"><img src=x onerror=alert("xss")>';
  const email = getPasswordResetEmail(maliciousName, 'https://example.com/reset', 'general');
  assertNotContains(email, '"><img', 'Should not contain raw injection attempt');
  assertContains(email, '&quot;&gt;&lt;img', 'Should escape quotes and angle brackets');
})) passed++; else failed++;

// Test document replacement notification email
if (test('getDocumentReplacementNotificationEmail - escapes malicious subcontractor name', () => {
  const maliciousName = '<script>alert("xss")</script>';
  const email = getDocumentReplacementNotificationEmail(
    maliciousName,
    'Broker Name',
    'broker@example.com',
    'COI',
    'Testing'
  );
  assertNotContains(email, '<script>alert("xss")</script>', 'Should not contain unescaped script tag');
  assertContains(email, '&lt;script&gt;', 'Should contain escaped script tag');
})) passed++; else failed++;

if (test('getDocumentReplacementNotificationEmail - escapes malicious broker name', () => {
  const maliciousBrokerName = '"><script>alert("xss")</script>';
  const email = getDocumentReplacementNotificationEmail(
    'Sub Name',
    maliciousBrokerName,
    'broker@example.com',
    'COI',
    'Testing'
  );
  assertNotContains(email, '<script>alert("xss")</script>', 'Should not contain unescaped script tag');
  assertContains(email, '&lt;script&gt;', 'Should contain escaped script tag');
})) passed++; else failed++;

if (test('getDocumentReplacementNotificationEmail - escapes malicious broker email', () => {
  const maliciousEmail = '"><script>alert("xss")</script>';
  const email = getDocumentReplacementNotificationEmail(
    'Sub Name',
    'Broker Name',
    maliciousEmail,
    'COI',
    'Testing'
  );
  assertNotContains(email, '<script>alert("xss")</script>', 'Should not contain unescaped script tag');
  assertContains(email, '&lt;script&gt;', 'Should contain escaped script tag');
})) passed++; else failed++;

if (test('getDocumentReplacementNotificationEmail - escapes malicious doc type', () => {
  const maliciousDocType = '<img src=x onerror=alert("xss")>';
  const email = getDocumentReplacementNotificationEmail(
    'Sub Name',
    'Broker Name',
    'broker@example.com',
    maliciousDocType,
    'Testing'
  );
  assertNotContains(email, '<img', 'Should not contain unescaped img tag');
  assertContains(email, '&lt;img', 'Should contain escaped img tag');
})) passed++; else failed++;

if (test('getDocumentReplacementNotificationEmail - escapes malicious reason', () => {
  const maliciousReason = '<script>alert("xss")</script>';
  const email = getDocumentReplacementNotificationEmail(
    'Sub Name',
    'Broker Name',
    'broker@example.com',
    'COI',
    maliciousReason
  );
  assertNotContains(email, '<script>alert("xss")</script>', 'Should not contain unescaped script tag');
  assertContains(email, '&lt;script&gt;', 'Should contain escaped script tag');
})) passed++; else failed++;

// Test with normal safe inputs
if (test('getPasswordResetEmail - works with safe inputs', () => {
  const email = getPasswordResetEmail('John Doe', 'https://example.com/reset?token=abc123', 'gc');
  assertContains(email, 'John Doe', 'Should contain the name');
  assertContains(email, 'https://example.com/reset?token=abc123', 'Should contain the reset link');
  assertContains(email, 'GC Account', 'Should contain the user type');
})) passed++; else failed++;

if (test('getDocumentReplacementNotificationEmail - works with safe inputs', () => {
  const email = getDocumentReplacementNotificationEmail(
    'ABC Construction',
    'Insurance Broker LLC',
    'broker@example.com',
    'Certificate of Insurance',
    'Updated coverage limits'
  );
  assertContains(email, 'ABC Construction', 'Should contain subcontractor name');
  assertContains(email, 'Insurance Broker LLC', 'Should contain broker name');
  assertContains(email, 'broker@example.com', 'Should contain broker email');
  assertContains(email, 'Certificate of Insurance', 'Should contain doc type');
  assertContains(email, 'Updated coverage limits', 'Should contain reason');
})) passed++; else failed++;

// Summary
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
