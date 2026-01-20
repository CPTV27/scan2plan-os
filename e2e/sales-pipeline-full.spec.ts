import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test("sales pipeline full flow", async ({ page }) => {
  test.setTimeout(360000);

  const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5000";
  const unique = Date.now();
  const clientName = `E2E Client ${unique}`;
  const projectName = `E2E Project ${unique}`;
  const projectAddress = "123 Test St, Troy, NY 12180";
  const productionProjectName = `${clientName} - ${projectAddress}`;
  const contactEmail = `e2e+${unique}@example.com`;
  const billingEmail = `billing+${unique}@example.com`;
  const docPath = "attached_assets/Pasted--CPQ-Architecture-Cleanup-Task-Context-We-previously-ha_1768191161800.txt";
  const reportDir = path.resolve("test-results", "sales-pipeline-report");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportSteps: { label: string; file: string }[] = [];
  let shotIndex = 1;

  const expectToast = async (text: string) => {
    const toast = page.getByRole("status").filter({ hasText: text }).first();
    await expect(toast).toBeVisible({ timeout: 15000 });
  };

  const capture = async (label: string) => {
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const filename = `${String(shotIndex).padStart(2, "0")}-${safeLabel}.png`;
    const filePath = path.join(reportDir, filename);
    await page.screenshot({ path: filePath, fullPage: true });
    reportSteps.push({ label, file: filename });
    shotIndex += 1;
  };

  const uploadDocumentWithRetry = async (maxAttempts = 2) => {
    await page.waitForTimeout(1000);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const uploadResponse = page.waitForResponse((response) => {
        return response.request().method() === "POST" &&
          response.url().includes(`/api/leads/${leadId}/documents`);
      });
      await page.getByTestId("input-upload-document").setInputFiles(docPath);
      const uploadResult = await uploadResponse;
      if (uploadResult.ok()) {
        return;
      }
      if (uploadResult.status() !== 429 || attempt === maxAttempts) {
        const detail = await uploadResult
          .json()
          .then((data) => JSON.stringify(data))
          .catch(() => "");
        throw new Error(`Document upload failed: ${uploadResult.status()} ${detail}`);
      }
      const retryAfterSeconds = await uploadResult
        .json()
        .then((data) => Number(data.retryAfter))
        .catch(() => 60);
      const waitMs = Number.isFinite(retryAfterSeconds) ? (retryAfterSeconds + 5) * 1000 : 65000;
      await page.waitForTimeout(waitMs);
    }
  };
  await page.goto(`${baseUrl}/sales`, { waitUntil: "networkidle" });

  await page.getByTestId("button-new-lead").click();
  await expect(page.getByTestId("page-deal-workspace")).toBeVisible();

  const leadIdMatch = page.url().match(/\/deals\/(\d+)/);
  if (!leadIdMatch) {
    throw new Error(`Could not determine lead id from URL: ${page.url()}`);
  }
  const leadId = leadIdMatch[1];

  await page.getByTestId("input-client-name").fill(clientName);
  await page.getByTestId("input-project-name").fill(projectName);
  await page.getByTestId("input-project-address").fill(projectAddress);
  await page.getByTestId("input-value").fill("25000");
  await page.getByTestId("slider-probability").click();
  await page.getByTestId("input-timeline").fill("Q2 2026");

  await page.getByTestId("select-deal-stage").click();
  await page.getByRole("option", { name: "Leads" }).click();

  await page.getByTestId("select-lead-source").click();
  await page.getByRole("option", { name: "Website" }).click();

  await page.getByTestId("select-lead-priority").click();
  await page.getByRole("option", { name: "4 - High" }).click();

  await page.getByTestId("checkbox-proposal-phase").check();
  await page.getByTestId("checkbox-in-hand").check();
  await page.getByTestId("checkbox-urgent").check();
  await page.getByTestId("checkbox-other").check();
  await page.getByTestId("input-other-status").fill("Client requested on-site review");

  await page.getByTestId("input-contact-name").fill("Test Contact");
  await page.getByTestId("input-contact-email").fill(contactEmail);
  await page.getByTestId("input-contact-phone").fill("(555) 100-2000");
  await page.getByTestId("input-billing-contact-name").fill("Billing Contact");
  await page.getByTestId("input-billing-contact-email").fill(billingEmail);
  await page.getByTestId("input-billing-contact-phone").fill("(555) 300-4000");

  await page.getByTestId("select-payment-terms").click();
  await page.getByRole("option", { name: "Net 30" }).click();

  await page.getByTestId("select-buyer-persona").click();
  const personaOptions = page.getByRole("option");
  await personaOptions.first().click();

  await page.getByTestId("input-proof-links").fill("https://example.com/case-study");
  await page.getByTestId("input-notes").fill("Full lead details completed via automated test.");

  await page.getByTestId("select-touchpoint").click();
  await page.getByRole("option").first().click();
  await page.getByTestId("button-add-touchpoint").click();

  await page.getByTestId("button-submit-lead").click();
  await expectToast("Deal updated successfully");
  await capture("lead details saved");

  const stages = ["Contacted", "Proposal", "Negotiation", "On Hold"];
  for (const stage of stages) {
    await page.getByTestId("select-deal-stage").click();
    await page.getByRole("option", { name: stage }).click();
    await page.getByTestId("button-submit-lead").click();
    await expectToast("Deal updated successfully");
  }
  await capture("pipeline progressed to on hold");

  await page.getByTestId("tab-quote").click();
  await page.getByTestId("select-area-building-type-0").click();
  await page.getByRole("option", { name: "Commercial / Office" }).click();
  await page.getByTestId("input-area-name-0").fill("Main Building");
  await page.getByTestId("input-area-sqft-0").fill("15000");
  await page.getByTestId("select-area-scope-0").click();
  await page.getByRole("option", { name: "Full Building" }).click();
  await page.getByTestId("checkbox-area-0-discipline-architecture").check();

  await page.getByTestId("button-save-quote").click();
  await page.waitForTimeout(1000);
  await capture("quote saved");

  await page.goto(`${baseUrl}/deals/${leadId}?tab=history`, { waitUntil: "networkidle" });
  await page.getByTestId("tab-history").click();
  const firstVersionCard = page.locator("[data-testid^=\"version-card-\"]").first();
  await expect(firstVersionCard).toBeVisible({ timeout: 15000 });
  await firstVersionCard.click();
  await expect(page.getByTestId("button-edit-this-version")).toBeVisible();
  await page.keyboard.press("Escape");
  await capture("version history shows quote");

  await page.getByTestId("tab-quote").click();
  await page.getByTestId("input-area-sqft-0").fill("16500");
  await page.getByTestId("button-save-quote").click();
  await page.waitForTimeout(1000);
  await capture("quote updated");

  await page.goto(`${baseUrl}/deals/${leadId}?tab=history`, { waitUntil: "networkidle" });
  await page.getByTestId("tab-history").click();
  const versionCards = page.locator("[data-testid^=\"version-card-\"]");
  await expect(versionCards.first()).toBeVisible({ timeout: 15000 });
  const versionCount = await versionCards.count();
  if (versionCount < 2) {
    throw new Error(`Expected at least 2 quote versions, found ${versionCount}`);
  }

  await page.getByTestId("tab-proposal").click();
  await page.getByTestId("button-open-proposal-builder").click();
  await expect(page.getByTestId("button-save-draft")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("button-save-draft").click();
  await expect(page.getByTestId("button-save-draft")).toBeEnabled({ timeout: 20000 });
  await capture("proposal builder saved draft");

  await page.goto(`${baseUrl}/deals/${leadId}?tab=documents`, { waitUntil: "networkidle" });
  await page.getByTestId("tab-documents").click();
  await uploadDocumentWithRetry();
  await page.goto(`${baseUrl}/deals/${leadId}?tab=documents`, { waitUntil: "networkidle" });
  await page.getByTestId("tab-documents").click();

  const documentItem = page.locator("[data-testid^=\"document-item-\"]").first();
  await expect(documentItem).toBeVisible({ timeout: 30000 });
  await capture("document uploaded");

  await documentItem.locator("[data-testid^=\"button-download-\"]").click();
  await page.waitForTimeout(1000);

  await page.goto(`${baseUrl}/deals/${leadId}`, { waitUntil: "networkidle" });
  await page.getByTestId("tab-lead").click();

  for (const stage of ["Closed Lost", "Closed Won"]) {
    await page.getByTestId("select-deal-stage").click();
    await page.getByRole("option", { name: stage }).click();
    await page.getByTestId("button-submit-lead").click();
    await expectToast("Deal updated successfully");
  }

  await page.goto(`${baseUrl}/sales`, { waitUntil: "networkidle" });
  const closedWonColumn = page.getByTestId("column-closed-won");
  await expect(closedWonColumn.getByText(clientName)).toBeVisible({ timeout: 20000 });
  await capture("closed won column");

  await page.goto(`${baseUrl}/production`, { waitUntil: "networkidle" });
  const productionProject = page.locator("h4", { hasText: productionProjectName });
  await expect(productionProject).toBeVisible({ timeout: 30000 });
  await capture("production project created");

  const reportPayload = {
    title: "Sales Pipeline Full Flow",
    runAt: new Date().toISOString(),
    baseUrl,
    leadId,
    clientName,
    projectName,
    steps: reportSteps,
  };
  fs.writeFileSync(path.join(reportDir, "report.json"), JSON.stringify(reportPayload, null, 2));
});
