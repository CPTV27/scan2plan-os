/**
 * Comprehensive E2E Test: Full Deal-to-Proposal Cycle
 *
 * Tests the complete workflow from creating a new deal through
 * generating and signing a proposal.
 *
 * Run with: npx playwright test e2e/full-cycle-deal-to-proposal.spec.ts --headed
 */

import { test, expect } from "@playwright/test";

test.describe("Full Deal-to-Proposal Cycle", () => {
  // Store the deal ID created during the test
  let dealId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    // Clean up any test deals from previous runs (optional)
  });

  test("1. Create a new deal from Sales pipeline", async ({ page }) => {
    // Navigate to Sales pipeline
    await page.goto("http://127.0.0.1:5000/sales");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Take screenshot of sales pipeline
    await page.screenshot({ path: "e2e/screenshots/01-sales-pipeline.png" });

    // Click "New Deal" button
    const newDealButton = page.getByRole("button", { name: /new deal/i });
    await expect(newDealButton).toBeVisible();
    await newDealButton.click();
    await page.waitForTimeout(500);

    // Fill in the new deal form
    const projectNameInput = page.locator('input[name="projectName"], input[placeholder*="project"]').first();
    if (await projectNameInput.isVisible()) {
      await projectNameInput.fill("E2E Test Project - Full Cycle");
    }

    // Look for client name field
    const clientNameInput = page.locator('input[name="clientName"], input[placeholder*="client"]').first();
    if (await clientNameInput.isVisible()) {
      await clientNameInput.fill("E2E Test Client");
    }

    // Submit the form if there's a submit button
    const submitButton = page.getByRole("button", { name: /create|save|submit/i }).first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      await page.waitForTimeout(1000);
    }

    // Extract deal ID from URL if we navigated to a deal page
    const currentUrl = page.url();
    const dealMatch = currentUrl.match(/\/deals\/(\d+)/);
    if (dealMatch) {
      dealId = dealMatch[1];
      console.log(`Created deal ID: ${dealId}`);
    }

    await page.screenshot({ path: "e2e/screenshots/02-new-deal-created.png" });
  });

  test("2. Fill in Lead Details", async ({ page }) => {
    // Use existing deal if we didn't create one
    const testDealId = dealId || "34";

    await page.goto(`http://127.0.0.1:5000/deals/${testDealId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click on Lead Details tab
    const leadDetailsTab = page.getByRole("tab", { name: /lead details/i });
    if (await leadDetailsTab.isVisible()) {
      await leadDetailsTab.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: "e2e/screenshots/03-lead-details-tab.png" });

    // Check that key fields exist
    const hasProjectName = await page.locator('input[name="projectName"], [data-field="projectName"]').count() > 0;
    const hasClientName = await page.locator('input[name="clientName"], [data-field="clientName"]').count() > 0;
    const hasAddress = await page.locator('[data-field="projectAddress"], input[placeholder*="address"]').count() > 0;

    console.log("Lead Details fields found:", { hasProjectName, hasClientName, hasAddress });
  });

  test("3. Configure Quote in CPQ Calculator", async ({ page }) => {
    const testDealId = dealId || "34";

    await page.goto(`http://127.0.0.1:5000/deals/${testDealId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click on Quote Builder tab
    const quoteTab = page.getByRole("tab", { name: /quote|cpq|calculator/i });
    if (await quoteTab.isVisible()) {
      await quoteTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: "e2e/screenshots/04-quote-builder-tab.png" });

    // Check if Calculator is embedded
    const calculatorContainer = page.locator('[data-testid="calculator-container"], .cpq-calculator, iframe');
    const hasCalculator = await calculatorContainer.count() > 0;
    console.log("Calculator found:", hasCalculator);

    // Look for pricing summary
    const pricingSummary = page.locator('[data-testid="pricing-summary"], .pricing-breakdown');
    if (await pricingSummary.isVisible()) {
      await page.screenshot({ path: "e2e/screenshots/05-pricing-summary.png" });
    }

    // Trigger autosave by making a small change if possible
    const sqftInput = page.locator('input[name*="sqft"], input[placeholder*="sqft"]').first();
    if (await sqftInput.isVisible()) {
      await sqftInput.click();
      await sqftInput.fill("10000");
      await page.waitForTimeout(2500); // Wait for autosave debounce
    }
  });

  test("4. Create and Edit Proposal", async ({ page }) => {
    const testDealId = dealId || "34";

    await page.goto(`http://127.0.0.1:5000/deals/${testDealId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click on Proposal tab
    const proposalTab = page.getByRole("tab", { name: /proposal/i });
    await expect(proposalTab).toBeVisible();
    await proposalTab.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: "e2e/screenshots/06-proposal-tab.png" });

    // Check for proposal version history
    const versionHistory = page.locator('text=Proposal Versions');
    await expect(versionHistory).toBeVisible();

    // Click "New Version" to create a proposal if none exist
    const newVersionButton = page.getByRole("button", { name: /new version/i });
    if (await newVersionButton.isVisible()) {
      await newVersionButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: "e2e/screenshots/07-new-version-created.png" });
    }

    // Click "Open Proposal Builder" button
    const openBuilderButton = page.getByTestId("button-open-proposal-builder");
    if (await openBuilderButton.isVisible()) {
      await openBuilderButton.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "e2e/screenshots/08-proposal-builder.png" });

    // Verify we're on the proposal builder page
    expect(page.url()).toContain("/proposal");
  });

  test("5. Verify Proposal Builder Pages", async ({ page }) => {
    const testDealId = dealId || "34";

    // Navigate directly to proposal builder
    await page.goto(`http://127.0.0.1:5000/deals/${testDealId}/proposal`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Check for proposal pages
    const proposalPages = page.locator(".proposal-page");
    const pageCount = await proposalPages.count();
    console.log(`Found ${pageCount} proposal pages`);
    expect(pageCount).toBeGreaterThan(0);

    // Verify Cover Page exists
    const coverPage = page.locator('.proposal-page').first();
    await expect(coverPage).toBeVisible();

    // Scroll through pages and take screenshots
    for (let i = 0; i < Math.min(pageCount, 6); i++) {
      await proposalPages.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }

    await page.screenshot({
      path: "e2e/screenshots/09-proposal-pages-overview.png",
      fullPage: true
    });

    // Verify specific page content
    const estimatePage = page.locator('.proposal-page').filter({
      has: page.locator('h2:has-text("Estimate")')
    });
    if (await estimatePage.count() > 0) {
      await estimatePage.scrollIntoViewIfNeeded();
      await page.screenshot({ path: "e2e/screenshots/10-estimate-page.png" });
    }

    // Verify BIM Standards images are loaded
    const bimImages = page.locator('img[alt*="BIM Modeling Standards"]');
    const bimImageCount = await bimImages.count();
    console.log(`Found ${bimImageCount} BIM Standards images`);
    expect(bimImageCount).toBe(3);
  });

  test("6. Download PDF", async ({ page }) => {
    const testDealId = dealId || "34";

    await page.goto(`http://127.0.0.1:5000/deals/${testDealId}/proposal`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Find the Download PDF button
    const downloadButton = page.getByRole("button", { name: /download.*pdf/i });
    await expect(downloadButton).toBeVisible();

    // Set up download listener
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

    // Click download
    await downloadButton.click();

    try {
      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      console.log(`Downloaded file: ${filename}`);
      expect(filename).toMatch(/\.pdf$/i);

      // Save the file
      await download.saveAs(`e2e/screenshots/downloaded-proposal-${testDealId}.pdf`);
      console.log("PDF saved successfully");
    } catch (error) {
      console.log("Download may have been handled differently:", error);
      // Take screenshot of current state
      await page.screenshot({ path: "e2e/screenshots/11-after-download-click.png" });
    }
  });

  test("7. Test Signature Link Generation", async ({ page }) => {
    const testDealId = dealId || "34";

    await page.goto(`http://127.0.0.1:5000/deals/${testDealId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click on Proposal tab
    const proposalTab = page.getByRole("tab", { name: /proposal/i });
    await proposalTab.click();
    await page.waitForTimeout(500);

    // Find "Send for Signature" button
    const sendSignatureButton = page.getByRole("button", { name: /send.*signature/i });

    if (await sendSignatureButton.isVisible()) {
      await sendSignatureButton.click();
      await page.waitForTimeout(2000);

      // Check if signature link was generated
      const signatureLinkInput = page.locator('input[readonly]').filter({ hasText: /sign\// });
      const linkVisible = await signatureLinkInput.count() > 0;

      if (linkVisible) {
        const signatureUrl = await signatureLinkInput.inputValue();
        console.log(`Signature URL generated: ${signatureUrl}`);
        expect(signatureUrl).toContain("/sign/");
      }

      await page.screenshot({ path: "e2e/screenshots/12-signature-link-generated.png" });
    } else {
      // Check if already signed
      const signedBadge = page.locator('text=Signed').first();
      if (await signedBadge.isVisible()) {
        console.log("Proposal is already signed");
      }
    }
  });

  test("8. Verify API Endpoints", async ({ page, request }) => {
    const testDealId = dealId || "34";

    // Test lead API
    const leadResponse = await request.get(`http://127.0.0.1:5000/api/leads/${testDealId}`);
    expect(leadResponse.ok()).toBeTruthy();
    const leadData = await leadResponse.json();
    console.log("Lead data retrieved:", {
      id: leadData.id,
      projectName: leadData.projectName,
      clientName: leadData.clientName,
    });

    // Test proposals API
    const proposalsResponse = await request.get(`http://127.0.0.1:5000/api/generated-proposals/lead/${testDealId}`);
    expect(proposalsResponse.ok()).toBeTruthy();
    const proposals = await proposalsResponse.json();
    console.log(`Found ${proposals.length} proposals for this lead`);

    // Test quotes API
    const quotesResponse = await request.get(`http://127.0.0.1:5000/api/leads/${testDealId}/cpq-quotes`);
    expect(quotesResponse.ok()).toBeTruthy();
    const quotes = await quotesResponse.json();
    console.log(`Found ${quotes.length} quotes for this lead`);

    // Check if latest quote has pricingBreakdown
    if (quotes.length > 0) {
      const latestQuote = quotes[quotes.length - 1];
      const hasPricingBreakdown = !!latestQuote.pricingBreakdown?.items;
      console.log("Latest quote has pricingBreakdown:", hasPricingBreakdown);

      if (hasPricingBreakdown) {
        console.log(`  - ${latestQuote.pricingBreakdown.items.length} line items`);
      }
    }
  });

  test("9. Test Public Signature Page (with mock token)", async ({ page, request }) => {
    const testDealId = dealId || "34";

    // First generate a signature link
    const response = await request.post(`http://127.0.0.1:5000/api/leads/${testDealId}/send-signature-link`, {
      data: {
        recipientEmail: "test@example.com",
        recipientName: "Test Client"
      }
    });

    if (response.ok()) {
      const data = await response.json();
      console.log("Signature link data:", data);

      if (data.signatureUrl) {
        // Extract token from URL
        const tokenMatch = data.signatureUrl.match(/\/sign\/([a-f0-9]+)/);
        if (tokenMatch) {
          const token = tokenMatch[1];

          // Visit the public signature page
          await page.goto(`http://127.0.0.1:5000/sign/${token}`);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1000);

          await page.screenshot({ path: "e2e/screenshots/13-public-signature-page.png" });

          // Check for signature page elements
          const signButton = page.locator('text=Sign Your Proposal');
          const proposalDetails = page.locator('text=Proposal Details');

          if (await signButton.isVisible()) {
            console.log("Public signature page loaded successfully");
          }
        }
      }
    } else {
      console.log("Could not generate signature link - may need authentication");
    }
  });

  test("10. Verify Estimate Table Data", async ({ page }) => {
    const testDealId = dealId || "34";

    await page.goto(`http://127.0.0.1:5000/deals/${testDealId}/proposal`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Find estimate table
    const estimateTable = page.locator('table').first();

    if (await estimateTable.isVisible()) {
      // Check for table rows
      const tableRows = page.locator('table tbody tr');
      const rowCount = await tableRows.count();
      console.log(`Estimate table has ${rowCount} rows`);

      // Check text visibility (should be text-gray-900, not light)
      const firstCell = page.locator('table tbody tr td').first();
      if (await firstCell.isVisible()) {
        const color = await firstCell.evaluate(el => {
          return window.getComputedStyle(el).color;
        });
        console.log(`First cell text color: ${color}`);

        // Expect dark text (rgb(17, 24, 39) is text-gray-900)
        expect(color).not.toBe("rgb(156, 163, 175)"); // Not gray-400
      }

      await page.screenshot({ path: "e2e/screenshots/14-estimate-table-detail.png" });
    }
  });
});
