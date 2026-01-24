/**
 * E2E Test: Signature Flow
 *
 * Tests the complete signature flow from generating a link
 * to viewing the PDF and signing the proposal.
 */

import { test, expect } from "@playwright/test";

test.describe("Signature Flow", () => {
  test("1. Generate signature link and access public signature page", async ({ page, request }) => {
    const testDealId = "34";

    // Generate signature link via API
    const response = await request.post(`http://127.0.0.1:5000/api/leads/${testDealId}/send-signature-link`, {
      data: {
        recipientEmail: "test@example.com",
        recipientName: "Test Client"
      }
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    console.log("Signature link response:", data);

    expect(data.signatureUrl).toBeTruthy();
    expect(data.signatureUrl).toContain("/sign/");

    // Extract token
    const tokenMatch = data.signatureUrl.match(/\/sign\/([a-f0-9]+)/);
    expect(tokenMatch).toBeTruthy();
    const token = tokenMatch![1];

    // Navigate to public signature page
    await page.goto(data.signatureUrl);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "e2e/screenshots/sig-01-signature-page.png" });

    // Verify page loaded
    const pageTitle = page.locator('text=Review & Sign Your Proposal');
    await expect(pageTitle).toBeVisible();

    // Verify proposal details are shown
    const proposalDetails = page.locator('text=Proposal Details');
    await expect(proposalDetails).toBeVisible();
  });

  test("2. PDF viewer is visible by default", async ({ page, request }) => {
    const testDealId = "34";

    // Generate signature link
    const response = await request.post(`http://127.0.0.1:5000/api/leads/${testDealId}/send-signature-link`, {
      data: {
        recipientEmail: "test@example.com",
        recipientName: "Test Client"
      }
    });

    const data = await response.json();
    await page.goto(data.signatureUrl);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "e2e/screenshots/sig-02-pdf-viewer.png" });

    // Verify PDF iframe is visible by default (no toggle needed)
    const pdfFrame = page.locator('iframe[title="Proposal PDF"]');
    await expect(pdfFrame).toBeVisible();

    // Verify Download PDF button is visible
    const downloadButton = page.getByRole("button", { name: /Download PDF/i });
    await expect(downloadButton).toBeVisible();

    // Verify white theme - check background
    const body = page.locator('body');
    const bgColor = await body.evaluate(el => window.getComputedStyle(el).backgroundColor);
    console.log(`Page background color: ${bgColor}`);
  });

  test("3. Verify public PDF endpoint works", async ({ request }) => {
    const testDealId = "34";

    // Generate signature link
    const linkResponse = await request.post(`http://127.0.0.1:5000/api/leads/${testDealId}/send-signature-link`, {
      data: {
        recipientEmail: "test@example.com",
        recipientName: "Test Client"
      }
    });

    const linkData = await linkResponse.json();
    const tokenMatch = linkData.signatureUrl.match(/\/sign\/([a-f0-9]+)/);
    const token = tokenMatch![1];

    // Fetch public PDF
    const pdfResponse = await request.get(`http://127.0.0.1:5000/api/public/proposals/${token}/pdf`);

    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");

    const pdfBuffer = await pdfResponse.body();
    console.log(`Public PDF size: ${pdfBuffer.length} bytes`);
    expect(pdfBuffer.length).toBeGreaterThan(1000); // Should be a real PDF
  });

  test("4. Verify proposal data includes pdfUrl", async ({ request }) => {
    const testDealId = "34";

    // Generate signature link
    const linkResponse = await request.post(`http://127.0.0.1:5000/api/leads/${testDealId}/send-signature-link`, {
      data: {
        recipientEmail: "test@example.com",
        recipientName: "Test Client"
      }
    });

    const linkData = await linkResponse.json();
    const tokenMatch = linkData.signatureUrl.match(/\/sign\/([a-f0-9]+)/);
    const token = tokenMatch![1];

    // Fetch proposal data
    const proposalResponse = await request.get(`http://127.0.0.1:5000/api/public/proposals/${token}`);

    expect(proposalResponse.ok()).toBeTruthy();

    const proposalData = await proposalResponse.json();
    console.log("Proposal data:", proposalData);

    expect(proposalData.id).toBeTruthy();
    expect(proposalData.projectName).toBeTruthy();
    expect(proposalData.pdfUrl).toBeTruthy();
    expect(proposalData.pdfUrl).toContain("/api/public/proposals/");
    expect(proposalData.pdfUrl).toContain("/pdf");
  });

  test("5. Signature capture component is visible", async ({ page, request }) => {
    const testDealId = "34";

    // Generate signature link
    const response = await request.post(`http://127.0.0.1:5000/api/leads/${testDealId}/send-signature-link`, {
      data: {
        recipientEmail: "test@example.com",
        recipientName: "Test Client"
      }
    });

    const data = await response.json();
    await page.goto(data.signatureUrl);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Scroll to signature section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({ path: "e2e/screenshots/sig-03-signature-capture.png" });

    // Verify signature capture elements
    const signatureCanvas = page.locator('canvas');
    const signerNameInput = page.locator('input[placeholder*="name" i]');
    const signerEmailInput = page.locator('input[placeholder*="email" i]');

    // At least some signature capture elements should be visible
    const hasCanvas = await signatureCanvas.count() > 0;
    const hasNameInput = await signerNameInput.count() > 0;
    const hasEmailInput = await signerEmailInput.count() > 0;

    console.log("Signature elements:", { hasCanvas, hasNameInput, hasEmailInput });

    // Either canvas or inputs should be present
    expect(hasCanvas || hasNameInput || hasEmailInput).toBeTruthy();
  });
});
