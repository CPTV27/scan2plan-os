/**
 * Migrate CPQ Data from Original Database
 * 
 * Copies pricing matrices and parameters from the original CPQ database
 * to this Scan2Plan Sales Production database.
 * 
 * Run with: npx tsx scripts/migrate-cpq-data.ts
 */

import pg from "pg";

// Source database (original CPQ)
const SOURCE_DB = "postgresql://neondb_owner:npg_GR1WNPIHrji7@ep-fancy-union-ah19tnnp.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Target database (this app - uses DATABASE_URL from environment)
const TARGET_DB = process.env.DATABASE_URL!;

if (!TARGET_DB) {
    console.error("❌ DATABASE_URL environment variable not set");
    process.exit(1);
}

async function migrateCpqData() {
    console.log("🚀 Starting CPQ data migration...\n");

    // Connect to source database
    const sourceClient = new pg.Client({ connectionString: SOURCE_DB });
    await sourceClient.connect();
    console.log("✅ Connected to source database (original CPQ)");

    // Connect to target database
    const targetClient = new pg.Client({ connectionString: TARGET_DB });
    await targetClient.connect();
    console.log("✅ Connected to target database (Scan2Plan Sales Production)\n");

    try {
        // 1. Migrate pricing_matrix
        console.log("📦 Migrating pricing_matrix...");
        const pricingMatrix = await sourceClient.query("SELECT * FROM pricing_matrix");
        if (pricingMatrix.rows.length > 0) {
            // Clear existing data
            await targetClient.query("DELETE FROM pricing_matrix");

            for (const row of pricingMatrix.rows) {
                await targetClient.query(
                    `INSERT INTO pricing_matrix (id, building_type_id, area_tier, discipline, lod, rate_per_sq_ft, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (id) DO UPDATE SET
                       building_type_id = EXCLUDED.building_type_id,
                       area_tier = EXCLUDED.area_tier,
                       discipline = EXCLUDED.discipline,
                       lod = EXCLUDED.lod,
                       rate_per_sq_ft = EXCLUDED.rate_per_sq_ft,
                       updated_at = EXCLUDED.updated_at`,
                    [row.id, row.building_type_id, row.area_tier, row.discipline, row.lod, row.rate_per_sq_ft, row.updated_at]
                );
            }
            console.log(`   ✅ Migrated ${pricingMatrix.rows.length} pricing_matrix rows`);
        } else {
            console.log("   ⚠️ No pricing_matrix data found in source");
        }

        // 2. Migrate upteam_pricing_matrix
        console.log("📦 Migrating upteam_pricing_matrix...");
        const upteamPricing = await sourceClient.query("SELECT * FROM upteam_pricing_matrix");
        if (upteamPricing.rows.length > 0) {
            // Clear existing data
            await targetClient.query("DELETE FROM upteam_pricing_matrix");

            for (const row of upteamPricing.rows) {
                await targetClient.query(
                    `INSERT INTO upteam_pricing_matrix (id, building_type_id, area_tier, discipline, lod, rate_per_sq_ft, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT (id) DO UPDATE SET
                       building_type_id = EXCLUDED.building_type_id,
                       area_tier = EXCLUDED.area_tier,
                       discipline = EXCLUDED.discipline,
                       lod = EXCLUDED.lod,
                       rate_per_sq_ft = EXCLUDED.rate_per_sq_ft,
                       updated_at = EXCLUDED.updated_at`,
                    [row.id, row.building_type_id, row.area_tier, row.discipline, row.lod, row.rate_per_sq_ft, row.created_at, row.updated_at]
                );
            }
            console.log(`   ✅ Migrated ${upteamPricing.rows.length} upteam_pricing_matrix rows`);
        } else {
            console.log("   ⚠️ No upteam_pricing_matrix data found in source");
        }

        // 3. Migrate cad_pricing_matrix
        console.log("📦 Migrating cad_pricing_matrix...");
        const cadPricing = await sourceClient.query("SELECT * FROM cad_pricing_matrix");
        if (cadPricing.rows.length > 0) {
            // Clear existing data
            await targetClient.query("DELETE FROM cad_pricing_matrix");

            for (const row of cadPricing.rows) {
                await targetClient.query(
                    `INSERT INTO cad_pricing_matrix (id, building_type_id, area_tier, package_type, rate_per_sq_ft, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (id) DO UPDATE SET
                       building_type_id = EXCLUDED.building_type_id,
                       area_tier = EXCLUDED.area_tier,
                       package_type = EXCLUDED.package_type,
                       rate_per_sq_ft = EXCLUDED.rate_per_sq_ft,
                       updated_at = EXCLUDED.updated_at`,
                    [row.id, row.building_type_id, row.area_tier, row.package_type, row.rate_per_sq_ft, row.updated_at]
                );
            }
            console.log(`   ✅ Migrated ${cadPricing.rows.length} cad_pricing_matrix rows`);
        } else {
            console.log("   ⚠️ No cad_pricing_matrix data found in source");
        }

        // 4. Migrate pricing_parameters
        console.log("📦 Migrating pricing_parameters...");
        const pricingParams = await sourceClient.query("SELECT * FROM pricing_parameters");
        if (pricingParams.rows.length > 0) {
            // Clear existing data
            await targetClient.query("DELETE FROM pricing_parameters");

            for (const row of pricingParams.rows) {
                await targetClient.query(
                    `INSERT INTO pricing_parameters (id, parameter_key, parameter_value, parameter_type, description, category, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (id) DO UPDATE SET
                       parameter_key = EXCLUDED.parameter_key,
                       parameter_value = EXCLUDED.parameter_value,
                       parameter_type = EXCLUDED.parameter_type,
                       description = EXCLUDED.description,
                       category = EXCLUDED.category,
                       updated_at = EXCLUDED.updated_at`,
                    [row.id, row.parameter_key, row.parameter_value, row.parameter_type, row.description, row.category, row.updated_at]
                );
            }
            console.log(`   ✅ Migrated ${pricingParams.rows.length} pricing_parameters rows`);
        } else {
            console.log("   ⚠️ No pricing_parameters data found in source");
        }

        // 5. Check if quotes table exists and migrate if present
        console.log("📦 Checking for quotes data...");
        try {
            const quotes = await sourceClient.query("SELECT * FROM quotes LIMIT 100");
            if (quotes.rows.length > 0) {
                console.log(`   Found ${quotes.rows.length} quotes in source (skipping - may conflict with existing data)`);
                console.log("   ℹ️ Run separate quote migration if needed");
            } else {
                console.log("   ⚠️ No quotes data found in source");
            }
        } catch (e) {
            console.log("   ⚠️ quotes table not found or inaccessible in source");
        }

        console.log("\n🎉 CPQ data migration complete!");

    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    } finally {
        await sourceClient.end();
        await targetClient.end();
        console.log("\n✅ Database connections closed");
    }
}

migrateCpqData()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Migration error:", error);
        process.exit(1);
    });
