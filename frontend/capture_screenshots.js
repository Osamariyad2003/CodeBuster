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
  console.log('🚀 Launching Chrome for high-fidelity screenshot capture...');
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
    // 1. Landing Page - Hero
    console.log('📸 1/13 Capturing Landing Page Hero...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await sleep(2500);
    await saveScreenshot(page, '01_landing_hero.png');

    // 2. Landing Page - Interactive Demo
    console.log('📸 2/13 Capturing Interactive Demo Section...');
    try {
      await page.evaluate(() => {
        const demoSection = document.getElementById('demo') || document.querySelector('.cr-interactive-demo');
        if (demoSection) {
          demoSection.scrollIntoView();
        } else {
          window.scrollBy(0, 950);
        }
      });
      await sleep(2000);
      await saveScreenshot(page, '02_landing_interactive_demo.png');
    } catch (e) {
      console.warn('Scroll demo error:', e.message);
    }

    // 3. Authenticate with Demo Session
    console.log('🔑 Authenticating via /auth/demo...');
    await page.goto(`${BASE_URL}/auth/demo`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(
      () => !document.body.innerText.includes('Preparing your workspace…'),
      { timeout: 20000 }
    );
    await sleep(2000);

    // 4. Dashboard Overview
    console.log('📸 3/13 Capturing Dashboard Overview...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500); // allow chart animations to settle
    await saveScreenshot(page, '03_dashboard_overview.png');

    // 5. Repositories Portfolio
    console.log('📸 4/13 Capturing Repositories Portfolio...');
    await page.goto(`${BASE_URL}/repos`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2000);
    await saveScreenshot(page, '04_repositories_list.png');

    // 6. Issues Explorer
    console.log('📸 5/13 Capturing Issues Explorer...');
    await page.goto(`${BASE_URL}/issues`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '05_issues_explorer.png');

    // 7. Reviews History
    console.log('📸 6/13 Capturing Reviews History...');
    await page.goto(`${BASE_URL}/reviews`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2000);
    await saveScreenshot(page, '06_reviews_history.png');

    // 8. Autonomous AI Agents
    console.log('📸 7/13 Capturing Autonomous Agents Swarm...');
    await page.goto(`${BASE_URL}/agents`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '07_autonomous_agents.png');

    // 9. Architecture Constellation (3D Graph)
    console.log('📸 8/13 Capturing Architecture Constellation...');
    await page.goto(`${BASE_URL}/constellation`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(4000); // allow Three.js / force graph to stabilize
    await saveScreenshot(page, '08_architecture_constellation.png');

    // 10. Commits Review Inbox
    console.log('📸 9/13 Capturing Commits Review Inbox...');
    await page.goto(`${BASE_URL}/commits`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2000);
    await saveScreenshot(page, '09_commits_inbox.png');

    // 11. Finding Quality & Trust Calibration
    console.log('📸 10/13 Capturing Feedback & Trust Insights...');
    await page.goto(`${BASE_URL}/feedback-insights`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '10_feedback_insights.png');

    // 12. Time Travel Analysis
    console.log('📸 11/13 Capturing Time Travel Git Analysis...');
    await page.goto(`${BASE_URL}/time-travel`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2500);
    await saveScreenshot(page, '11_time_travel.png');

    // 13. System Diagnostics & Job Queue
    console.log('📸 12/13 Capturing System Status & Queue Monitoring...');
    await page.goto(`${BASE_URL}/system-status`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2000);
    await saveScreenshot(page, '12_system_status.png');

    // 14. User Profile & AI Configuration
    console.log('📸 13/13 Capturing User Profile & AI Configuration...');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });
    await waitForPageReady(page);
    await sleep(2000);
    await saveScreenshot(page, '13_user_profile.png');

    console.log('🎉 All 13 application screenshots captured and saved successfully!');
  } catch (error) {
    console.error('Error during screenshot capture:', error);
  } finally {
    await browser.close();
  }
}

run();
