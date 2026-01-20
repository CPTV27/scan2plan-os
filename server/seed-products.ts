import { db } from "./db";
import { products } from "@shared/schema";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { log } from "./lib/logger";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CsvProduct {
  Category: string;
  "Product / Service": string;
  Description: string;
  SKU: string;
  Type: string;
  Price: string;
}

export async function seedProducts() {
  log("Seeding products from QB catalog...");

  const csvPath = path.join(__dirname, "../attached_assets/Products___Services_in_QB_October_2025_-_Sheet1_1768341995694.csv");

  if (!fs.existsSync(csvPath)) {
    log("WARN: Products CSV not found at " + csvPath);
    return;
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const records: CsvProduct[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  log(`Found ${records.length} products in CSV`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    if (!record.SKU || !record["Product / Service"]) {
      skipped++;
      continue;
    }

    const productData = {
      sku: record.SKU.trim(),
      category: record.Category?.trim() || "Uncategorized",
      name: record["Product / Service"]?.trim() || "",
      description: record.Description?.trim() || null,
      type: record.Type?.trim() || "Service",
      price: record.Price ? record.Price : "0",
      active: true,
    };

    try {
      const existing = await db.query.products.findFirst({
        where: (p, { eq }) => eq(p.sku, productData.sku),
      });

      if (existing) {
        await db
          .update(products)
          .set({
            name: productData.name,
            category: productData.category,
            description: productData.description,
            type: productData.type,
            price: productData.price,
            active: productData.active,
            updatedAt: new Date(),
          })
          .where(eq(products.id, existing.id));
        updated++;
      } else {
        await db.insert(products).values(productData as any);
        inserted++;
      }
    } catch (error: any) {
      if (error.code === "23505") {
        updated++;
      } else {
        log(`ERROR: Failed to insert product ${productData.sku}: ${error.message}`);
        skipped++;
      }
    }
  }

  log(`Products seeded: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedProducts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
