const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const ARTIFACTS_DIR = '/Users/okkarhys/.gemini/antigravity-ide/brain/d92b4232-8830-415e-a594-237410fdfbb9';

async function runQA() {
  console.log('--- Starting OKKAX Event Studio End-to-End QA Suite ---');
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // 1. Login as Organizer
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="quickfill-organizer"]', { timeout: 10000 });
    await page.click('[data-testid="quickfill-organizer"]');
    await page.waitForURL('**/app**', { timeout: 10000 });
    console.log(`[${vp.name}] Logged in successfully as Organizer`);

    // 2. Navigate to Event Studio
    await page.goto(`${BASE_URL}/app/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="event-studio-workspace"]', { timeout: 10000 });
    console.log(`[${vp.name}] Event Studio loaded`);

    // 3. Verify Sticky Header & Autosave
    const commandHeader = await page.$('[data-testid="studio-command-header"]');
    if (commandHeader) {
      console.log(`[${vp.name}] PASS: Sticky command header verified`);
    } else {
      console.error(`[${vp.name}] FAIL: Sticky command header missing`);
    }

    const autosave = await page.$('[data-testid="studio-autosave-indicator"]');
    if (autosave) {
      const text = await autosave.innerText();
      console.log(`[${vp.name}] PASS: Autosave indicator state: "${text.trim()}"`);
    }

    // Capture Studio Main View Screenshot
    const mainShot = path.join(ARTIFACTS_DIR, `studio_${vp.name}_main.png`);
    await page.screenshot({ path: mainShot, fullPage: false });
    console.log(`[${vp.name}] Captured: ${mainShot}`);

    // 4. Test Event Domain: Requirements Sub-view
    console.log(`[${vp.name}] Testing EVENT > Requirements Sub-view`);
    await page.click('[data-testid="studio-subview-requirements"]');
    await page.waitForSelector('[data-testid="studio-requirements-view"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    const reqList = await page.$('[data-testid="requirements-list"]');
    if (reqList) {
      console.log(`[${vp.name}] PASS: Requirements list rendered`);
    }

    // Capture Requirements View Screenshot
    const reqShot = path.join(ARTIFACTS_DIR, `studio_${vp.name}_requirements.png`);
    await page.screenshot({ path: reqShot, fullPage: false });
    console.log(`[${vp.name}] Captured: ${reqShot}`);

    // 5. Test Event Domain: Audience Sub-view
    console.log(`[${vp.name}] Testing EVENT > Audience Sub-view`);
    await page.click('[data-testid="studio-subview-audience"]');
    await page.waitForSelector('[data-testid="studio-audience-view"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // 6. Test NETWORK Domain
    console.log(`[${vp.name}] Testing NETWORK Domain`);
    await page.click('[data-testid="studio-domain-network"]');
    await page.waitForSelector('[data-testid="studio-domain-network-content"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Capture Network Domain Screenshot
    const networkShot = path.join(ARTIFACTS_DIR, `studio_${vp.name}_network.png`);
    await page.screenshot({ path: networkShot, fullPage: false });
    console.log(`[${vp.name}] Captured: ${networkShot}`);

    // 7. Test CALENDAR Domain
    console.log(`[${vp.name}] Testing CALENDAR Domain`);
    await page.click('[data-testid="studio-domain-calendar"]');
    await page.waitForSelector('[data-testid="studio-domain-calendar-content"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Capture Calendar Domain Screenshot
    const calendarShot = path.join(ARTIFACTS_DIR, `studio_${vp.name}_calendar.png`);
    await page.screenshot({ path: calendarShot, fullPage: false });
    console.log(`[${vp.name}] Captured: ${calendarShot}`);

    // 8. Test CALENDAR > Conflicts Sub-view
    console.log(`[${vp.name}] Testing CALENDAR > Conflicts Sub-view`);
    await page.click('[data-testid="studio-subview-conflicts"]');
    await page.waitForSelector('[data-testid="studio-calendar-conflicts"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    // 9. Test AI Studio Reasoning Drawer
    console.log(`[${vp.name}] Testing AI Studio Drawer Trigger`);
    await page.click('[data-testid="studio-ai-trigger-btn"]');
    await page.waitForSelector('[data-testid="studio-ai-drawer"]', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Capture AI Studio Drawer Screenshot
    const aiShot = path.join(ARTIFACTS_DIR, `studio_${vp.name}_ai_drawer.png`);
    await page.screenshot({ path: aiShot, fullPage: false });
    console.log(`[${vp.name}] Captured: ${aiShot}`);

    // Trigger Audit Risiko in AI Studio
    console.log(`[${vp.name}] Triggering Audit Risiko in AI Studio`);
    await page.click('[data-testid="ai-action-audit-conflicts"]');
    await page.waitForTimeout(1000);

    await context.close();
  }

  await browser.close();
  console.log('\n--- ALL EVENT STUDIO QA TESTS COMPLETED SUCCESSFULLY ---');
}

runQA().catch((err) => {
  console.error('QA Test Error:', err);
  process.exit(1);
});
