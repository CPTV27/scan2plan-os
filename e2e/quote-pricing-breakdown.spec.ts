/**
 * Test pricingBreakdown saving in Quote Builder
 */

import { test, expect } from "@playwright/test";

test.describe("Quote pricingBreakdown", () => {
  test("verify pricingBreakdown is saved with items on quote save", async ({ page }) => {
    // Capture console and network
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    // Navigate to deal 34's Quote Builder
    await page.goto("http://127.0.0.1:5000/deals/34");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click on Quote Builder tab
    const quoteTab = page.locator('[role="tab"]:has-text("Quote"), button:has-text("Quote")');
    if (await quoteTab.isVisible()) {
      await quoteTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: "e2e/screenshots/pricing-01-quote-tab.png", fullPage: true });

    // Wait for pricing items to load
    await page.waitForTimeout(2000);

    // Check for pricing breakdown items in the DOM
    const pricingItems = await page.evaluate(() => {
      // Look for pricing breakdown summary
      const summaryItems = document.querySelectorAll('[class*="pricing"] [class*="item"], [class*="breakdown"] li');
      return {
        count: summaryItems.length,
        items: Array.from(summaryItems).slice(0, 5).map(el => el.textContent?.trim().substring(0, 100))
      };
    });

    console.log("\n=== DOM Pricing Items ===");
    console.log(JSON.stringify(pricingItems, null, 2));

    // Make a small change to trigger autosave - click on an input and modify it
    // Try to find a distance or travel field
    const distanceInput = page.locator('input[name="distance"], input[placeholder*="distance"], input[type="number"]').first();
    if (await distanceInput.isVisible()) {
      const currentValue = await distanceInput.inputValue();
      await distanceInput.click();
      await distanceInput.fill("1");
      await page.waitForTimeout(500);
      await distanceInput.fill(currentValue || "0");
    }

    // Wait for autosave (2 second debounce + some buffer)
    await page.waitForTimeout(4000);

    await page.screenshot({ path: "e2e/screenshots/pricing-02-after-change.png", fullPage: true });

    // Intercept the next save request to see what's being sent
    const savedQuoteData = await page.evaluate(async () => {
      // Fetch the quote again to see if pricingBreakdown was saved
      try {
        const response = await fetch("/api/leads/34/cpq-quotes", {
          credentials: "include",
        });
        if (!response.ok) return { error: `HTTP ${response.status}` };
        const quotes = await response.json();
        if (Array.isArray(quotes) && quotes.length > 0) {
          const q = quotes[0];
          return {
            id: q.id,
            pricingBreakdown: q.pricingBreakdown,
            pricingBreakdownKeys: q.pricingBreakdown ? Object.keys(q.pricingBreakdown) : [],
            hasItems: Array.isArray(q.pricingBreakdown?.items),
            itemsCount: q.pricingBreakdown?.items?.length || 0,
            firstItem: q.pricingBreakdown?.items?.[0]
          };
        }
        return { noQuote: true };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== Quote pricingBreakdown after save ===");
    console.log(JSON.stringify(savedQuoteData, null, 2));

    // Verify that pricingBreakdown has items
    expect(savedQuoteData.hasItems).toBe(true);
    expect(savedQuoteData.itemsCount).toBeGreaterThan(0);
  });

  test("manually trigger save and check pricingBreakdown", async ({ page }) => {
    // Navigate to the full quote builder page (not embedded)
    await page.goto("http://127.0.0.1:5000/new-cpq?leadId=34");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "e2e/screenshots/pricing-03-full-cpq.png", fullPage: true });

    // Check what the pricing summary shows
    const pricingSummary = await page.evaluate(() => {
      const container = document.querySelector('.pricing-summary, [class*="PricingSummary"], aside');
      if (!container) return { error: "No pricing summary found" };

      const items = container.querySelectorAll('li, [class*="item"], .flex');
      const result = Array.from(items).map(item => ({
        text: item.textContent?.trim().substring(0, 150),
        classes: item.className
      }));

      return {
        found: true,
        itemCount: result.length,
        items: result.slice(0, 10)
      };
    });

    console.log("\n=== Pricing Summary DOM ===");
    console.log(JSON.stringify(pricingSummary, null, 2));

    // Check if there's a "Save Quote" button and click it
    const saveBtn = page.locator('button:has-text("Save Quote"), button:has-text("Save")');
    if (await saveBtn.first().isVisible()) {
      await saveBtn.first().click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "e2e/screenshots/pricing-04-after-save.png", fullPage: true });

    // Verify quote data in database
    const quoteAfterSave = await page.evaluate(async () => {
      try {
        const response = await fetch("/api/leads/34/cpq-quotes", {
          credentials: "include",
        });
        if (!response.ok) return { error: `HTTP ${response.status}` };
        const quotes = await response.json();
        if (Array.isArray(quotes) && quotes.length > 0) {
          const q = quotes[0];
          return {
            id: q.id,
            totalPrice: q.totalPrice,
            pricingBreakdown: q.pricingBreakdown,
          };
        }
        return { noQuote: true };
      } catch (err) {
        return { error: String(err) };
      }
    });

    console.log("\n=== Quote after manual save ===");
    console.log(JSON.stringify(quoteAfterSave, null, 2));
  });

  test("check pricingItems state in Calculator component", async ({ page }) => {
    // Go to deal workspace and check the embedded quote builder
    await page.goto("http://127.0.0.1:5000/deals/34");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Click on Quote tab
    const quoteTab = page.locator('[role="tab"]:has-text("Quote")');
    if (await quoteTab.isVisible()) {
      await quoteTab.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: "e2e/screenshots/pricing-05-embedded-quote.png", fullPage: true });

    // Look for pricing items in the sidebar
    const sidebarContent = await page.evaluate(() => {
      // Look for the pricing sidebar
      const aside = document.querySelector('aside');
      if (!aside) return { error: "No aside found" };

      // Get all text content from the sidebar
      const allText = aside.textContent || "";

      // Look for specific pricing elements
      const priceElements = aside.querySelectorAll('[class*="price"], [class*="currency"], .font-semibold, .font-bold');
      const prices = Array.from(priceElements).map(el => el.textContent?.trim()).filter(Boolean);

      // Look for line items
      const listItems = aside.querySelectorAll('li, .flex.justify-between');
      const items = Array.from(listItems).map(li => {
        return li.textContent?.trim().substring(0, 100);
      }).filter(Boolean);

      return {
        found: true,
        textLength: allText.length,
        textSample: allText.substring(0, 500),
        priceCount: prices.length,
        prices: prices.slice(0, 10),
        itemCount: items.length,
        items: items.slice(0, 10)
      };
    });

    console.log("\n=== Sidebar Content ===");
    console.log(JSON.stringify(sidebarContent, null, 2));

    // Check for the presence of pricing breakdown section
    const hasBreakdown = await page.locator('text=Base Subtotal, text=Total, text=Architecture').count();
    console.log("\nPricing keywords found:", hasBreakdown);
  });
});
