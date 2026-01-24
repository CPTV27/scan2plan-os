/**
 * Regenerate proposal to pick up updated pricingBreakdown
 */

import { test, expect } from "@playwright/test";

test.describe("Regenerate Proposal", () => {
  test("create new proposal version with updated line items", async ({ page }) => {
    // Navigate to deal 34
    await page.goto("http://127.0.0.1:5000/deals/34");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click on Proposal tab
    const proposalTab = page.locator('[role="tab"]:has-text("Proposal")');
    if (await proposalTab.isVisible()) {
      await proposalTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: "e2e/screenshots/regen-01-proposal-tab.png", fullPage: true });

    // Look for "New Version" button or similar
    const newVersionBtn = page.locator('button:has-text("New Version"), button:has-text("Create New"), button:has-text("Regenerate")');
    if (await newVersionBtn.first().isVisible()) {
      console.log("Clicking New Version button...");
      await newVersionBtn.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/regen-02-after-new-version.png", fullPage: true });
    }

    // If there's an "Open Proposal Builder" button, click it
    const builderBtn = page.locator('button:has-text("Open Proposal Builder")');
    if (await builderBtn.isVisible()) {
      console.log("Clicking Open Proposal Builder...");
      await builderBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "e2e/screenshots/regen-03-proposal-builder.png", fullPage: true });

    // Check if there's a "Create Proposal" button (for new proposals)
    const createBtn = page.locator('button:has-text("Create Proposal")');
    if (await createBtn.isVisible()) {
      console.log("Creating new proposal...");
      await createBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: "e2e/screenshots/regen-04-after-create.png", fullPage: true });
    }

    // Verify proposal data
    const proposalData = await page.evaluate(async () => {
      try {
        const response = await fetch("/api/generated-proposals/lead/34", {
          credentials: "include",
        });
        if (!response.ok) return { error: `HTTP ${response.status}` };
        const proposals = await response.json();
        if (Array.isArray(proposals) && proposals.length > 0) {
          const p = proposals[0];
          return {
            id: p.id,
            version: p.version,
            lineItems: p.lineItems,
            lineItemsCount: Array.isArray(p.lineItems) ? p.lineItems.length : 0,
            subtotal: p.subtotal,
            total: p.total
          };
        }
        return { noProposal: true };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== Proposal Data After Regeneration ===");
    console.log(JSON.stringify(proposalData, null, 2));

    // Scroll to estimate section
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(500);

    // Find the estimate table
    const estimateSection = page.locator('.proposal-page').filter({ has: page.locator('h2:has-text("Estimate")') });
    if (await estimateSection.count() > 0) {
      await estimateSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: "e2e/screenshots/regen-05-estimate-section.png", fullPage: true });

    // Check table content
    const tableContent = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return { error: "No table found" };

      const tbody = table.querySelector('tbody');
      if (!tbody) return { error: "No tbody found" };

      const rows = tbody.querySelectorAll('tr');
      return {
        rowCount: rows.length,
        rows: Array.from(rows).map(row => {
          const cells = row.querySelectorAll('td');
          return {
            cells: Array.from(cells).map(cell => cell.textContent?.trim().substring(0, 80))
          };
        })
      };
    });

    console.log("\n=== Table Content ===");
    console.log(JSON.stringify(tableContent, null, 2));

    // Verify line items exist
    expect(proposalData.lineItemsCount).toBeGreaterThan(1);
  });

  test("manually trigger proposal recreation via API", async ({ page }) => {
    await page.goto("http://127.0.0.1:5000");
    await page.waitForLoadState("networkidle");

    // Create a new proposal version via API
    const result = await page.evaluate(async () => {
      try {
        // First, get the current quote ID
        const quotesResponse = await fetch("/api/leads/34/cpq-quotes", { credentials: "include" });
        const quotes = await quotesResponse.json();
        const quoteId = quotes[0]?.id;

        // Create new proposal version
        const response = await fetch("/api/proposals/34/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ createNewVersion: true, quoteId })
        });

        if (!response.ok) {
          const error = await response.text();
          return { error: `HTTP ${response.status}: ${error}` };
        }

        const proposal = await response.json();
        return {
          id: proposal.id,
          version: proposal.version,
          lineItems: proposal.lineItems,
          lineItemsCount: Array.isArray(proposal.lineItems) ? proposal.lineItems.length : 0,
          firstLineItem: proposal.lineItems?.[0],
          subtotal: proposal.subtotal,
          total: proposal.total
        };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== New Proposal Created via API ===");
    console.log(JSON.stringify(result, null, 2));

    // Verify line items
    expect(result.lineItemsCount).toBeGreaterThan(1);
    expect(result.error).toBeUndefined();
  });
});
