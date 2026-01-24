/**
 * Playwright test for debugging Proposal Estimate Table
 */

import { test, expect } from "@playwright/test";

test.describe("Proposal Estimate Table", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("http://127.0.0.1:5000");

    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test("should display estimate table with line items", async ({ page }) => {
    // Listen for console messages
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Navigate to sales page
    await page.goto("http://127.0.0.1:5000/sales");
    await page.waitForLoadState("networkidle");

    // Take screenshot of sales page
    await page.screenshot({ path: "e2e/screenshots/01-sales-page.png", fullPage: true });

    // Find and click on a deal card (get the first one)
    const dealCard = page.locator('[data-testid="deal-card"]').first();
    const dealExists = await dealCard.count() > 0;

    if (!dealExists) {
      // Create a new deal first
      console.log("No deals found, creating a new one...");
      await page.click('button:has-text("New Deal")');
      await page.waitForTimeout(500);

      // Fill in deal form if visible
      const clientNameInput = page.locator('input[name="clientName"]');
      if (await clientNameInput.isVisible()) {
        await clientNameInput.fill("Test Client");
      }

      const projectNameInput = page.locator('input[name="projectName"]');
      if (await projectNameInput.isVisible()) {
        await projectNameInput.fill("Test Project");
      }

      // Save the deal
      const saveButton = page.locator('button:has-text("Save")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Try clicking on a deal to open it
    const cards = page.locator('.cursor-pointer').filter({ hasText: /@|Client/ });
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} potential deal cards`);

    if (cardCount > 0) {
      await cards.first().click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
    } else {
      // Try navigating directly to a deal URL
      await page.goto("http://127.0.0.1:5000/deals/1");
      await page.waitForLoadState("networkidle");
    }

    // Take screenshot of deal page
    await page.screenshot({ path: "e2e/screenshots/02-deal-page.png", fullPage: true });

    // Look for the Proposal tab
    const proposalTab = page.locator('button:has-text("Proposal"), [role="tab"]:has-text("Proposal")');
    if (await proposalTab.isVisible()) {
      await proposalTab.click();
      await page.waitForTimeout(500);
    }

    // Take screenshot of proposal tab
    await page.screenshot({ path: "e2e/screenshots/03-proposal-tab.png", fullPage: true });

    // Click "Open Proposal Builder" if visible
    const proposalBuilderBtn = page.locator('button:has-text("Open Proposal Builder")');
    if (await proposalBuilderBtn.isVisible()) {
      await proposalBuilderBtn.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
    }

    // Take screenshot after opening proposal builder
    await page.screenshot({ path: "e2e/screenshots/04-proposal-builder.png", fullPage: true });

    // Check current URL
    const currentUrl = page.url();
    console.log("Current URL:", currentUrl);

    // If we need to create a proposal first
    const createProposalBtn = page.locator('button:has-text("Create Proposal")');
    if (await createProposalBtn.isVisible()) {
      console.log("Creating new proposal...");
      await createProposalBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/05-after-create.png", fullPage: true });
    }

    // Look for the estimate table
    const estimateTable = page.locator('table').first();
    const tableVisible = await estimateTable.isVisible();
    console.log("Estimate table visible:", tableVisible);

    // Get the page content for debugging
    const pageContent = await page.content();

    // Check for line items in the table
    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();
    console.log("Table rows found:", rowCount);

    // Check for specific estimate elements
    const estimateHeader = page.locator('h2:has-text("Estimate")');
    const estimateHeaderVisible = await estimateHeader.isVisible();
    console.log("Estimate header visible:", estimateHeaderVisible);

    // Look for "DESCRIPTION" column header
    const descHeader = page.locator('th:has-text("DESCRIPTION")');
    const descHeaderVisible = await descHeader.isVisible();
    console.log("DESCRIPTION header visible:", descHeaderVisible);

    // Take full page screenshot
    await page.screenshot({ path: "e2e/screenshots/06-estimate-table.png", fullPage: true });

    // Scroll to the estimate section if it exists
    const estimatePage = page.locator('.proposal-page').filter({ has: page.locator('h2:has-text("Estimate")') });
    if (await estimatePage.count() > 0) {
      await estimatePage.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "e2e/screenshots/07-estimate-scrolled.png", fullPage: true });
    }

    // Check for any "Click to edit" placeholders
    const clickToEdit = page.locator('text=Click to edit');
    const clickToEditCount = await clickToEdit.count();
    console.log("'Click to edit' placeholders:", clickToEditCount);

    // Check for $0.00 amounts
    const zeroAmounts = page.locator('text=$0.00');
    const zeroAmountsCount = await zeroAmounts.count();
    console.log("$0.00 amounts found:", zeroAmountsCount);

    // Check the lineItems data via network
    const lineItemsData = await page.evaluate(() => {
      // Try to find React fiber for proposal data
      const wysiwyg = document.querySelector('.proposal-wysiwyg');
      if (!wysiwyg) return null;

      // Check for table content
      const tbody = document.querySelector('table tbody');
      if (!tbody) return { error: "No tbody found" };

      const rows = tbody.querySelectorAll('tr');
      const rowData = Array.from(rows).map((row, idx) => {
        const cells = row.querySelectorAll('td');
        return {
          row: idx,
          cellCount: cells.length,
          content: Array.from(cells).map(cell => cell.textContent?.trim().substring(0, 50))
        };
      });

      return { rowCount: rows.length, rows: rowData };
    });

    console.log("Line items data from DOM:", JSON.stringify(lineItemsData, null, 2));

    // Output console errors
    if (consoleErrors.length > 0) {
      console.log("\n=== Console Errors ===");
      consoleErrors.forEach(err => console.log(err));
    }

    // Output relevant console logs
    const relevantLogs = consoleLogs.filter(log =>
      log.includes("lineItem") ||
      log.includes("proposal") ||
      log.includes("estimate") ||
      log.includes("Error") ||
      log.includes("error")
    );

    if (relevantLogs.length > 0) {
      console.log("\n=== Relevant Console Logs ===");
      relevantLogs.forEach(log => console.log(log));
    }

    // Check API response for proposal data
    const apiResponse = await page.evaluate(async () => {
      // Get leadId from URL
      const urlMatch = window.location.pathname.match(/\/deals\/(\d+)/);
      const leadId = urlMatch ? urlMatch[1] : null;

      if (!leadId) return { error: "Could not determine leadId from URL", url: window.location.pathname };

      try {
        const response = await fetch(`/api/generated-proposals/lead/${leadId}`, {
          credentials: 'include'
        });
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          const proposal = data[0];
          return {
            id: proposal.id,
            lineItems: proposal.lineItems,
            lineItemsType: typeof proposal.lineItems,
            lineItemsLength: Array.isArray(proposal.lineItems) ? proposal.lineItems.length : 'not array',
            subtotal: proposal.subtotal,
            total: proposal.total
          };
        }

        return { noProposal: true, data };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== API Response for Proposal ===");
    console.log(JSON.stringify(apiResponse, null, 2));

    // Final screenshot
    await page.screenshot({ path: "e2e/screenshots/08-final.png", fullPage: true });
  });

  test("debug line items from backend", async ({ page }) => {
    // Go to a specific deal and check the API directly
    await page.goto("http://127.0.0.1:5000/deals/1/proposal");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Screenshot
    await page.screenshot({ path: "e2e/screenshots/10-direct-proposal.png", fullPage: true });

    // Get the full proposal data structure
    const proposalData = await page.evaluate(async () => {
      try {
        // First try to get existing proposals
        const response = await fetch(`/api/generated-proposals/lead/1`, {
          credentials: 'include'
        });

        if (!response.ok) {
          return { error: `HTTP ${response.status}`, url: '/api/generated-proposals/lead/1' };
        }

        const proposals = await response.json();

        if (Array.isArray(proposals) && proposals.length > 0) {
          const p = proposals[0];
          return {
            found: true,
            proposal: {
              id: p.id,
              leadId: p.leadId,
              name: p.name,
              lineItems: p.lineItems,
              lineItemsKeys: p.lineItems && typeof p.lineItems === 'object' ? Object.keys(p.lineItems[0] || {}) : [],
              coverData: p.coverData,
              projectData: p.projectData,
              subtotal: p.subtotal,
              total: p.total
            }
          };
        }

        return { found: false, proposals };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== Full Proposal Data ===");
    console.log(JSON.stringify(proposalData, null, 2));

    // Check the quote data too
    const quoteData = await page.evaluate(async () => {
      try {
        const response = await fetch(`/api/leads/1/cpq-quotes`, {
          credentials: 'include'
        });

        if (!response.ok) {
          return { error: `HTTP ${response.status}` };
        }

        const quotes = await response.json();

        if (Array.isArray(quotes) && quotes.length > 0) {
          const q = quotes[0];
          return {
            found: true,
            quote: {
              id: q.id,
              totalPrice: q.totalPrice,
              pricingBreakdown: q.pricingBreakdown,
              pricingBreakdownType: typeof q.pricingBreakdown,
              areas: q.areas,
              areasCount: Array.isArray(q.areas) ? q.areas.length : 0
            }
          };
        }

        return { found: false, quotes };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== Quote Data ===");
    console.log(JSON.stringify(quoteData, null, 2));
  });
});
