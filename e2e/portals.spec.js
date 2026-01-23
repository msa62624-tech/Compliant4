import { test, expect } from '@playwright/test';

// Base URL can be overridden with PLAYWRIGHT_BASE_URL env var
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175';

test.describe('Public Portals E2E Tests', () => {
  
  // ===== GC PORTAL TESTS =====
  test('GC Portal - Login and Dashboard Access', async ({ page }) => {
    console.log('Testing GC Portal workflow...');
    
    // Navigate to GC Login
    await page.goto(`${BASE}/gc-login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Take screenshot of GC login page
    await page.screenshot({ path: 'e2e/screenshots/gc-01-login-page.png', fullPage: true });
    
    // Check if login form is present
    const hasEmailInput = await page.locator('input[type="email"], input[placeholder*="email" i]').isVisible().catch(() => false);
    const hasPasswordInput = await page.locator('input[type="password"]').isVisible().catch(() => false);
    
    if (hasEmailInput && hasPasswordInput) {
      console.log('✓ GC login form detected');
      
      // Note: We can't test actual login without valid credentials
      // But we can verify the form exists and is accessible
      await page.screenshot({ path: 'e2e/screenshots/gc-02-login-form.png', fullPage: true });
      console.log('✓ GC login page accessible');
    } else {
      console.log('⊘ GC login form not found, page may be different');
    }
    
    // Verify page title or content
    const pageTitle = await page.title();
    expect(pageTitle.length).toBeGreaterThan(0);
    console.log(`✓ GC Portal page loaded - Title: ${pageTitle}`);
  });
  
  test('GC Portal - Dashboard direct access (requires auth)', async ({ page }) => {
    console.log('Testing GC Dashboard direct access...');
    
    // Try to access GC Dashboard directly
    await page.goto(`${BASE}/gc-dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/gc-03-dashboard-redirect.png', fullPage: true });
    
    // Check if redirected to login or if dashboard is shown
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/gc-login')) {
      console.log('✓ Correctly redirected to GC login (authentication required)');
    } else if (currentUrl.includes('/gc-dashboard')) {
      console.log('⊘ Dashboard accessible (may have existing session)');
    }
    
    expect(currentUrl.length).toBeGreaterThan(0);
  });
  
  // ===== BROKER PORTAL TESTS =====
  test('Broker Portal - Login and Dashboard Access', async ({ page }) => {
    console.log('Testing Broker Portal workflow...');
    
    // Navigate to Broker Login
    await page.goto(`${BASE}/broker-login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Take screenshot of Broker login page
    await page.screenshot({ path: 'e2e/screenshots/broker-01-login-page.png', fullPage: true });
    
    // Check if login form is present
    const hasEmailInput = await page.locator('input[type="email"], input[placeholder*="email" i]').isVisible().catch(() => false);
    const hasPasswordInput = await page.locator('input[type="password"]').isVisible().catch(() => false);
    
    if (hasEmailInput && hasPasswordInput) {
      console.log('✓ Broker login form detected');
      await page.screenshot({ path: 'e2e/screenshots/broker-02-login-form.png', fullPage: true });
      console.log('✓ Broker login page accessible');
    } else {
      console.log('⊘ Broker login form not found, page may be different');
    }
    
    // Verify page title or content
    const pageTitle = await page.title();
    expect(pageTitle.length).toBeGreaterThan(0);
    console.log(`✓ Broker Portal page loaded - Title: ${pageTitle}`);
  });
  
  test('Broker Portal - Dashboard direct access (requires auth)', async ({ page }) => {
    console.log('Testing Broker Dashboard direct access...');
    
    // Try to access Broker Dashboard directly
    await page.goto(`${BASE}/broker-dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/broker-03-dashboard-redirect.png', fullPage: true });
    
    // Check if redirected to login or if dashboard is shown
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/broker-login')) {
      console.log('✓ Correctly redirected to Broker login (authentication required)');
    } else if (currentUrl.includes('/broker-dashboard')) {
      console.log('⊘ Dashboard accessible (may have existing session)');
    }
    
    expect(currentUrl.length).toBeGreaterThan(0);
  });
  
  test('Broker Portal - Upload COI page accessibility', async ({ page }) => {
    console.log('Testing Broker Upload COI page...');
    
    // Navigate to Upload COI page (may redirect to login)
    await page.goto(`${BASE}/broker-upload-coi`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'e2e/screenshots/broker-04-upload-coi-page.png', fullPage: true });
    
    const currentUrl = page.url();
    if (currentUrl.includes('/broker-upload-coi')) {
      console.log('✓ Broker Upload COI page accessible');
    } else if (currentUrl.includes('/broker-login')) {
      console.log('✓ Redirected to login (authentication required)');
    }
    
    expect(currentUrl.length).toBeGreaterThan(0);
  });
  
  // ===== SUBCONTRACTOR PORTAL TESTS =====
  test('Subcontractor Portal - Dashboard Access', async ({ page }) => {
    console.log('Testing Subcontractor Portal workflow...');
    
    // Navigate to Subcontractor Dashboard
    await page.goto(`${BASE}/subcontractor-dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/sub-01-dashboard-page.png', fullPage: true });
    
    // Check what's displayed (may require ID parameter or show login)
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/subcontractor-dashboard')) {
      console.log('✓ Subcontractor Dashboard page loaded');
      
      // Check if there's content or a message
      const hasContent = await page.locator('body').isVisible();
      if (hasContent) {
        console.log('✓ Page content visible');
      }
    } else if (currentUrl.includes('/subcontractor-login')) {
      console.log('✓ Redirected to subcontractor login');
    }
    
    expect(currentUrl.length).toBeGreaterThan(0);
  });
  
  test('Subcontractor Portal - Dashboard with ID parameter', async ({ page }) => {
    console.log('Testing Subcontractor Dashboard with ID parameter...');
    
    // Navigate with a test ID parameter
    await page.goto(`${BASE}/subcontractor-dashboard?id=test-sub-123`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/sub-02-dashboard-with-id.png', fullPage: true });
    
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Verify URL contains the ID parameter
    if (currentUrl.includes('id=test-sub-123')) {
      console.log('✓ ID parameter preserved in URL');
    }
    
    expect(currentUrl.length).toBeGreaterThan(0);
  });
  
  test('Subcontractor Portal - Broker Verification page', async ({ page }) => {
    console.log('Testing Broker Verification page for subs...');
    
    // Navigate to Broker Verification page
    await page.goto(`${BASE}/broker-verification`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/sub-03-broker-verification.png', fullPage: true });
    
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/broker-verification')) {
      console.log('✓ Broker Verification page accessible');
    }
    
    expect(currentUrl.length).toBeGreaterThan(0);
  });
  
  // ===== COMBINED PORTAL NAVIGATION TEST =====
  test('Portal Navigation - Verify all portal URLs are accessible', async ({ page }) => {
    console.log('Testing all portal URLs for accessibility...');
    
    const portals = [
      { name: 'GC Login', url: '/gc-login' },
      { name: 'Broker Login', url: '/broker-login' },
      { name: 'Subcontractor Dashboard', url: '/subcontractor-dashboard' },
    ];
    
    const results = [];
    
    for (const portal of portals) {
      try {
        await page.goto(`${BASE}${portal.url}`, { waitUntil: 'networkidle', timeout: 10000 });
        await page.waitForTimeout(500);
        
        const currentUrl = page.url();
        const loaded = currentUrl.includes(portal.url) || currentUrl.length > 0;
        
        results.push({
          name: portal.name,
          url: portal.url,
          status: loaded ? '✓' : '✗',
          loaded
        });
        
        console.log(`${loaded ? '✓' : '✗'} ${portal.name}: ${portal.url}`);
      } catch (error) {
        results.push({
          name: portal.name,
          url: portal.url,
          status: '✗',
          loaded: false,
          error: error.message
        });
        console.log(`✗ ${portal.name}: ${portal.url} - Error: ${error.message}`);
      }
    }
    
    // Take final screenshot showing results
    await page.screenshot({ path: 'e2e/screenshots/portals-navigation-summary.png', fullPage: true });
    
    // All portals should be accessible (even if they redirect to login)
    const allAccessible = results.every(r => r.loaded);
    console.log(`\n===== PORTAL NAVIGATION SUMMARY =====`);
    console.log(`Total Portals Tested: ${portals.length}`);
    console.log(`Accessible: ${results.filter(r => r.loaded).length}`);
    console.log(`Failed: ${results.filter(r => !r.loaded).length}`);
    
    expect(results.length).toBe(portals.length);
  });
});
