import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const MINUTE = 60 * 1000;
const AUTH_DIR = path.join(__dirname, '..', '.auth');
const STATE_FILE = path.join(AUTH_DIR, 'state.json');

const globalSetup = async (config: FullConfig) => {
  const baseURL = config.projects[0].use.baseURL!;
  const username = process.env.LOGIN_USERNAME || 'kubeadmin';

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Log in via browser and save storageState
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(baseURL);

  const idp = process.env.LOGIN_IDP || 'kube:admin';
  const password = process.env.LOGIN_PASSWORD!;

  // Select IDP if the login page shows identity provider selection
  const idpLink = page.locator(`a:has-text("${idp}")`);
  if (await idpLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await idpLink.click();
  }

  await page.locator('#inputUsername').fill(username);
  await page.locator('#inputPassword').fill(password);
  await page.locator('button[type=submit]').click();

  // Wait for console to load
  await page.waitForURL('**/');

  // Dismiss guided tour and prevent it from reappearing
  const tourSettings = {
    'console.guidedTour': { admin: { completed: true } },
  };
  await page.evaluate((settings) => {
    localStorage.setItem('console-user-settings', JSON.stringify(settings));
  }, tourSettings);

  const tourDismiss = page.locator('[data-test="tour-step-footer-secondary"]');
  if (await tourDismiss.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tourDismiss.click();
  }

  // Dismiss the "Welcome to the new OpenShift experience" tour modal (4.19+)
  const skipTour = page.getByRole('button', { name: 'Skip tour' });
  if (await skipTour.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipTour.click();
  }

  // Wait for the cluster update plugin to be ready by navigating to its route and waiting for the
  // page to render. The console may reload multiple times after plugin installation, so we poll
  // until the page is stable.
  await page.goto(`${baseURL}/administration/cluster-update`);
  await page.waitForLoadState('load', { timeout: 2 * MINUTE });

  const LOAD_MAX_POLLS = 36;
  const LOAD_POLL_INTERVAL = 10_000;
  const LOAD_REQUIRED_POLLS = 3;
  const pluginHeading = page.getByRole('heading', { name: 'Cluster Update' });
  let stableCount = 0;
  for (let i = 0; i < LOAD_MAX_POLLS; i++) {
    if (await pluginHeading.isVisible({ timeout: 1_000 }).catch(() => false)) {
      if (++stableCount >= LOAD_REQUIRED_POLLS) {
        break;
      }
      await page.waitForTimeout(LOAD_POLL_INTERVAL);
      continue;
    }
    stableCount = 0;
    await page.waitForTimeout(LOAD_POLL_INTERVAL);
    await page.goto(`${baseURL}/administration/cluster-update`);
    await page.waitForLoadState('load', { timeout: 2 * MINUTE });
  }

  // Dismiss any tour modals that appeared after stabilization reloads
  if (await skipTour.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await skipTour.click();
  }

  // Re-capture auth state after stabilization so cookies/tokens are fresh
  await context.storageState({ path: STATE_FILE });
  await browser.close();

  console.log(`Auth state saved to ${STATE_FILE}`);
};

export default globalSetup;
