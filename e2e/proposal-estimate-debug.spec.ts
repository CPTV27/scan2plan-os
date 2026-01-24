/**
 * Playwright test for debugging Proposal Estimate Table - uses existing lead 34
 */

import { test, expect } from "@playwright/test";

test.describe("Debug Estimate Table", () => {
  test("check proposal line items for lead 34", async ({ page }) => {
    // Capture console output
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate directly to deal 34
    await page.goto("http://127.0.0.1:5000/deals/34");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Screenshot deal page
    await page.screenshot({ path: "e2e/screenshots/debug-01-deal-34.png", fullPage: true });

    // Click on Proposal tab
    const proposalTab = page.locator('[role="tab"]:has-text("Proposal")');
    if (await proposalTab.isVisible()) {
      await proposalTab.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/debug-02-proposal-tab.png", fullPage: true });
    }

    // Click "Open Proposal Builder"
    const proposalBuilderBtn = page.locator('button:has-text("Open Proposal Builder")');
    if (await proposalBuilderBtn.isVisible()) {
      await proposalBuilderBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    }

    // Screenshot proposal builder
    await page.screenshot({ path: "e2e/screenshots/debug-03-proposal-builder.png", fullPage: true });

    // Check URL
    console.log("Current URL:", page.url());

    // Get proposal data via API
    const proposalData = await page.evaluate(async () => {
      try {
        const response = await fetch("/api/generated-proposals/lead/34", {
          credentials: "include",
        });
        if (!response.ok) return { error: `HTTP ${response.status}` };
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const p = data[0];
          return {
            id: p.id,
            lineItems: p.lineItems,
            lineItemsCount: Array.isArray(p.lineItems) ? p.lineItems.length : 0,
            subtotal: p.subtotal,
            total: p.total,
          };
        }
        return { noProposal: true };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== Proposal API Data ===");
    console.log(JSON.stringify(proposalData, null, 2));

    // Get quote data
    const quoteData = await page.evaluate(async () => {
      try {
        const response = await fetch("/api/leads/34/cpq-quotes", {
          credentials: "include",
        });
        if (!response.ok) return { error: `HTTP ${response.status}` };
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const q = data[0];
          return {
            id: q.id,
            totalPrice: q.totalPrice,
            pricingBreakdown: q.pricingBreakdown,
            pricingBreakdownType: typeof q.pricingBreakdown,
            hasItems: q.pricingBreakdown?.items ? true : false,
            itemsCount: q.pricingBreakdown?.items?.length || 0,
          };
        }
        return { noQuote: true };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== Quote API Data ===");
    console.log(JSON.stringify(quoteData, null, 2));

    // Scroll down to find the Estimate section
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "e2e/screenshots/debug-04-scrolled.png", fullPage: true });

    // Find the estimate table
    const estimateHeader = page.locator('h2:has-text("Estimate")');
    const estimateVisible = await estimateHeader.isVisible();
    console.log("\nEstimate header visible:", estimateVisible);

    if (estimateVisible) {
      await estimateHeader.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/debug-05-estimate-section.png", fullPage: true });
    }

    // Check table structure
    const tableInfo = await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      const results: any[] = [];

      tables.forEach((table, idx) => {
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const headers = thead ? Array.from(thead.querySelectorAll('th')).map(th => th.textContent?.trim()) : [];
        const rows = tbody ? Array.from(tbody.querySelectorAll('tr')).map(tr => {
          const cells = tr.querySelectorAll('td');
          return {
            cellCount: cells.length,
            firstCell: cells[0]?.textContent?.trim().substring(0, 50),
            lastCell: cells[cells.length - 1]?.textContent?.trim()
          };
        }) : [];

        results.push({
          tableIndex: idx,
          headers,
          rowCount: rows.length,
          rows: rows.slice(0, 5) // First 5 rows
        });
      });

      return results;
    });

    console.log("\n=== Table Structure ===");
    console.log(JSON.stringify(tableInfo, null, 2));

    // Check for "Click to edit" placeholders which indicate empty line items
    const clickToEditCount = await page.locator('text=Click to edit').count();
    console.log("\n'Click to edit' placeholder count:", clickToEditCount);

    // Check for $0.00 values
    const zeroValues = await page.locator('text=$0.00').count();
    console.log("$0.00 value count:", zeroValues);

    // Output console errors
    if (consoleErrors.length > 0) {
      console.log("\n=== Console Errors ===");
      consoleErrors.forEach(err => console.log(err));
    }

    // Final full page screenshot
    await page.screenshot({ path: "e2e/screenshots/debug-06-final.png", fullPage: true });
  });

  test("check pricingBreakdown structure in quote", async ({ page }) => {
    await page.goto("http://127.0.0.1:5000");
    await page.waitForLoadState("networkidle");

    // Get detailed quote data
    const quoteDetail = await page.evaluate(async () => {
      try {
        const response = await fetch("/api/leads/34/cpq-quotes", {
          credentials: "include",
        });
        if (!response.ok) return { error: `HTTP ${response.status}` };
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const q = data[0];
          return {
            id: q.id,
            quoteNumber: q.quoteNumber,
            totalPrice: q.totalPrice,
            areas: q.areas,
            areasCount: Array.isArray(q.areas) ? q.areas.length : 0,
            pricingBreakdown: q.pricingBreakdown,
            pricingBreakdownKeys: q.pricingBreakdown ? Object.keys(q.pricingBreakdown) : [],
            firstArea: Array.isArray(q.areas) && q.areas.length > 0 ? {
              name: q.areas[0].name,
              sqft: q.areas[0].squareFeet || q.areas[0].sqft,
              disciplines: q.areas[0].disciplines,
              gradeLod: q.areas[0].gradeLod,
              scanningCost: q.areas[0].scanningCost,
              modelingCost: q.areas[0].modelingCost
            } : null
          };
        }
        return { noQuote: true };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== Detailed Quote Data ===");
    console.log(JSON.stringify(quoteDetail, null, 2));
  });
});
