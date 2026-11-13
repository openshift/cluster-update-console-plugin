import { Page, expect } from '@playwright/test';

/**
 * Navigate to a specific console path
 */
export async function navigateTo(page: Page, path: string) {
  const baseUrl = process.env.BRIDGE_BASE_ADDRESS || 'http://localhost:9000';
  const url = `${baseUrl}${path}`;
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

/**
 * Check for console errors
 */
export async function checkForConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

/**
 * Wait for plugin to be loaded
 */
export async function waitForPluginLoad(page: Page, pluginName: string) {
  await navigateTo(page, '/k8s/cluster/operator.openshift.io~v1~Console/cluster/console-plugins');

  const pluginStatus = page.locator(`[data-test="${pluginName}-status"]`);
  await expect(pluginStatus).toContainText('Loaded', { timeout: 60000 });
}

/**
 * Check if element exists without failing
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
