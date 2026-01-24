/**
 * Verify text visibility fix in estimate table - full view
 */

import { test, expect } from "@playwright/test";

test("estimate table text visibility - scroll to top", async ({ page }) => {
  // Navigate to proposal builder for deal 34
  await page.goto("http://127.0.0.1:5000/deals/34/proposal");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Find the estimate page and scroll it into view
  const estimatePage = page.locator('.proposal-page').filter({ has: page.locator('h2:has-text("Estimate")') });

  if (await estimatePage.count() > 0) {
    // Scroll to the TOP of the estimate section
    await estimatePage.evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(500);
  }

  // Take screenshot
  await page.screenshot({ path: "e2e/screenshots/visibility-full-1.png", fullPage: false });

  // Also scroll down a bit to see more rows
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(300);
  await page.screenshot({ path: "e2e/screenshots/visibility-full-2.png", fullPage: false });

  // Check text colors via computed styles
  const textColors = await page.evaluate(() => {
    const results: any[] = [];

    // Check first column cells
    const tbody = document.querySelector('table tbody');
    if (tbody) {
      const firstRow = tbody.querySelector('tr');
      if (firstRow) {
        const cells = firstRow.querySelectorAll('td');
        cells.forEach((cell, idx) => {
          const computed = window.getComputedStyle(cell);
          const innerDiv = cell.querySelector('div');
          const innerComputed = innerDiv ? window.getComputedStyle(innerDiv) : null;
          results.push({
            cellIndex: idx,
            cellColor: computed.color,
            innerDivColor: innerComputed?.color,
            text: cell.textContent?.substring(0, 30)
          });
        });
      }
    }

    return results;
  });

  console.log("\n=== Computed Text Colors ===");
  console.log(JSON.stringify(textColors, null, 2));
});
