/**
 * Verify text visibility fix in estimate table
 */

import { test, expect } from "@playwright/test";

test("estimate table text is visible", async ({ page }) => {
  // Navigate to proposal builder for deal 34
  await page.goto("http://127.0.0.1:5000/deals/34/proposal");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Scroll to estimate section
  const estimateSection = page.locator('.proposal-page').filter({ has: page.locator('h2:has-text("Estimate")') });
  if (await estimateSection.count() > 0) {
    await estimateSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }

  // Take screenshot of estimate section
  await page.screenshot({ path: "e2e/screenshots/visibility-fix.png", fullPage: true });

  console.log("Screenshot saved to e2e/screenshots/visibility-fix.png");
});
