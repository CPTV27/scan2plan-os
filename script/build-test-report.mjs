import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { chromium } from "playwright";

const reportDir = path.resolve("test-results", "sales-pipeline-report");
const reportJsonPath = path.join(reportDir, "report.json");
const reportHtmlPath = path.join(reportDir, "report.html");
const reportPdfPath = path.join(reportDir, "report.pdf");

if (!fs.existsSync(reportJsonPath)) {
  console.error(`Missing report data: ${reportJsonPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportJsonPath, "utf8"));

const rows = report.steps
  .map(
    (step, idx) => `
      <section class="step">
        <div class="step-header">
          <div class="step-index">${String(idx + 1).padStart(2, "0")}</div>
          <div class="step-title">${step.label}</div>
        </div>
        <img src="${step.file}" alt="${step.label}" />
      </section>
    `
  )
  .join("");

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${report.title}</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        font-family: "Georgia", "Times New Roman", serif;
        margin: 32px;
        color: #111;
      }
      header {
        border-bottom: 2px solid #111;
        padding-bottom: 16px;
        margin-bottom: 24px;
      }
      h1 {
        font-size: 26px;
        margin: 0 0 8px 0;
      }
      .meta {
        font-size: 12px;
        color: #555;
        display: grid;
        gap: 4px;
      }
      .step {
        margin-bottom: 28px;
        page-break-inside: avoid;
      }
      .step-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      .step-index {
        font-weight: bold;
        font-size: 14px;
        border: 1px solid #111;
        padding: 4px 8px;
      }
      .step-title {
        font-size: 16px;
        font-weight: 600;
      }
      img {
        width: 100%;
        border: 1px solid #ddd;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>${report.title}</h1>
      <div class="meta">
        <div>Run: ${report.runAt}</div>
        <div>Base URL: ${report.baseUrl}</div>
        <div>Lead ID: ${report.leadId}</div>
        <div>Client: ${report.clientName}</div>
        <div>Project: ${report.projectName}</div>
      </div>
    </header>
    ${rows}
  </body>
</html>`;

fs.writeFileSync(reportHtmlPath, html, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pathToFileURL(reportHtmlPath).toString(), { waitUntil: "networkidle" });
await page.pdf({
  path: reportPdfPath,
  format: "A4",
  printBackground: true,
});
await browser.close();

console.log(`Report written to ${reportPdfPath}`);
