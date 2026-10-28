import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5174';

const TARGET_DIRS = [
  path.resolve('d:\\CodeBuster\\docs\\screenshots'),
  path.resolve('C:\\Users\\LENOVO\\.gemini\\antigravity\\brain\\2197ce72-fc19-4f40-918b-623cb25e01f8')
];

for (const dir of TARGET_DIRS) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveScreenshot(page, filename, options = {}) {
  for (const dir of TARGET_DIRS) {
    const fullPath = path.join(dir, filename);
    await page.screenshot({ path: fullPath, ...options });
  }
  console.log(`✅ Saved: ${filename}`);
}

async function waitForPageReady(page, timeout = 15000) {
  try {
    await page.waitForFunction(
      () => !document.body.innerText.includes('Preparing your workspace…') &&
            !document.body.innerText.includes('Loading...'),
      { timeout }
    );
  } catch (e) {
    // proceed even if timed out
  }
  await sleep(1500);
}

async function run() {
  console.log('🚀 Launching Chrome for extended high-fidelity screenshots...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--force-device-scale-factor=1',
      '--disable-dev-shm-usage'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);

  try {
    // 14. Demo Tab: Sequence Diagram
    console.log('📸 14/26 Capturing Demo: Architectural Sequence Diagram...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.evaluate(() => {
      const demoSection = document.getElementById('demo') || document.querySelector('.cr-interactive-demo');
      if (demoSection) demoSection.scrollIntoView();
      // Click diagram tab
      const buttons = Array.from(document.querySelectorAll('button'));
      const diagBtn = buttons.find(b => b.innerText.includes('Sequence Diagram') || b.innerText.includes('Diagram'));
      if (diagBtn) diagBtn.click();
    });
    await sleep(2000);
    await saveScreenshot(page, '14_demo_sequence_diagram.png');

    // 15. Demo Tab: Interactive PR Chat & Automated Tests
    console.log('📸 15/26 Capturing Demo: Interactive PR AI Chat...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const chatBtn = buttons.find(b => b.innerText.includes('Chat') || b.innerText.includes('AI Discussion'));
      if (chatBtn) chatBtn.click();
    });
    await sleep(2000);
    await saveScreenshot(page, '15_demo_ai_chat.png');

    // 16. Landing Page: Comparison Matrix & Value Pillars
    console.log('📸 16/26 Capturing Landing Page: Comparison Matrix...');
    await page.evaluate(() => {
      const comp = document.getElementById('compare') || document.querySelector('.cr-compare-section') || document.querySelector('.cr-comparison-table');
      if (comp) {
        comp.scrollIntoView();
      } else {
        window.scrollBy(0, 1800);
      }
    });
    await sleep(2000);
    await saveScreenshot(page, '16_landing_comparison_matrix.png');

    // Authenticate session for authenticated routes
    console.log('🔑 Authenticating session for authenticated deep-dive views...');
    await page.goto(`${BASE_URL}/auth/demo`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(
      () => !document.body.innerText.includes('Preparing your workspace…'),
      { timeout: 20000 }
    );
    await sleep(2000);

    // 17. UI Design System & Component Showcase
    console.log('📸 17/26 Capturing Component Showcase...');
    await page.goto(`${BASE_URL}/components`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2000);
    await saveScreenshot(page, '17_component_showcase.png');

    // 18. GitHub Repository Search & Discovery
    console.log('📸 18/26 Capturing Repository Search & Integration...');
    await page.goto(`${BASE_URL}/repos/search`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '18_repo_search.png');

    // 19. Repository Deep-Dive Dashboard
    console.log('📸 19/26 Capturing Repository Deep-Dive Dashboard...');
    await page.goto(`${BASE_URL}/repos/51452756-4e7b-408c-b94d-4a0dc75913dd`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(3000);
    await saveScreenshot(page, '19_repo_detail_dashboard.png');

    // 20. Repository Bot & Security Settings
    console.log('📸 20/26 Capturing Repository Settings & Gating Rules...');
    await page.goto(`${BASE_URL}/repos/51452756-4e7b-408c-b94d-4a0dc75913dd/settings`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2000);
    await saveScreenshot(page, '20_repo_settings.png');

    // 21. Live Webhook & Event Telemetry Stream
    console.log('📸 21/26 Capturing Event Telemetry Stream...');
    await page.goto(`${BASE_URL}/events`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '21_events_telemetry_stream.png');

    // 22. Asynchronous Worker Queue & Jobs
    console.log('📸 22/26 Capturing Async Worker Queue & Jobs...');
    await page.goto(`${BASE_URL}/jobs`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '22_worker_jobs_queue.png');

    // 23. Enriched Multi-Perspective Review Hub
    console.log('📸 23/26 Capturing Enriched Review Hub...');
    await page.goto(`${BASE_URL}/enriched-review`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '23_enriched_review_hub.png');

    // 24. Review Detail Breakdown & Fix First Checklist
    console.log('📸 24/26 Capturing Review Detail & Fix Checklist...');
    await page.goto(`${BASE_URL}/reviews/c70fedca-d25c-49e5-b45b-ef183ffec8e9`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(3000);
    await saveScreenshot(page, '24_review_detail_checklist.png');

    // 25. Issue Detail & Automated Remediation Agent
    console.log('📸 25/26 Capturing Issue Detail & AI Remediation...');
    await page.goto(`${BASE_URL}/issues/14f8a4c3-d530-412e-9dda-66062e16e04f`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '25_issue_remediation_agent.png');

    // 26. Second Issue Detail (XSS Vulnerability with AST Highlight)
    console.log('📸 26/26 Capturing Issue Detail (XSS Vulnerability AST)...');
    await page.goto(`${BASE_URL}/issues/63712a3a-1e74-4cb8-b730-41268c15a1b9`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '26_issue_xss_ast_view.png');

    console.log('🎉 All 13 additional screenshots captured successfully!');
  } catch (error) {
    console.error('Error during extended screenshot capture:', error);
  } finally {
    await browser.close();
  }
}

run();
