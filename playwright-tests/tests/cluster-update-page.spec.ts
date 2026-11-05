import { test, expect } from '../support/fixtures';

const CLUSTER_UPDATE_PATH = '/administration/cluster-update';

test.describe('Cluster Update Console Plugin', () => {
  test('should load the cluster update page', async ({ page }) => {
    await page.goto(CLUSTER_UPDATE_PATH);

    // Verify page title
    await expect(page).toHaveTitle(/Cluster Update/);

    // Verify main heading exists
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('should display the two tabs', async ({ page }) => {
    await page.goto(CLUSTER_UPDATE_PATH);

    // Check for tab navigation (Update history tab removed for Tech Preview)
    const updatePlanTab = page.getByRole('tab', { name: 'Updates plan' });
    const activePlansTab = page.getByRole('tab', { name: 'Active update plans' });

    await expect(updatePlanTab).toBeVisible();
    await expect(activePlansTab).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    await page.goto(CLUSTER_UPDATE_PATH);

    // Click Active Update Plans tab
    await page.getByRole('tab', { name: 'Active update plans' }).click();
    await expect(page).toHaveURL(/.*cluster-update/);

    // Click back to Updates Plan tab
    await page.getByRole('tab', { name: 'Updates plan' }).click();
    await expect(page).toHaveURL(/.*cluster-update/);
  });

  test('should handle missing Lightspeed CRD gracefully', async ({ page }) => {
    await page.goto(CLUSTER_UPDATE_PATH);

    // If Lightspeed is not installed, should show warning banner
    const warningBanner = page.locator('[data-test="lightspeed-not-available"]');

    // Check if banner exists (it's okay if it doesn't - means Lightspeed is installed)
    const bannerCount = await warningBanner.count();

    if (bannerCount > 0) {
      // If banner exists, it should explain AI features are unavailable
      await expect(warningBanner).toContainText(/AI.*unavailable|Lightspeed/i);
    }

    // Page should still be functional even without Lightspeed
    await expect(page.locator('h1')).toBeVisible();
  });
});
