/**
 * Check pricing matrix data format
 */
import pg from "pg";
import fs from "fs";

const DATABASE_URL = process.env.DATABASE_URL!;

async function main() {
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();

    let output = "";

    // Check pricing_matrix sample
    const prices = await client.query('SELECT * FROM pricing_matrix LIMIT 5');
    output += "Pricing Matrix Sample (5 rows):\n";
    prices.rows.forEach(row => {
        output += `  ID ${row.id}: buildingTypeId=${row.building_type_id}, tier=${row.area_tier}, discipline=${row.discipline}, lod=${row.lod}, rate=${row.rate_per_sq_ft}\n`;
    });

    // Check distinct values
    const tiers = await client.query('SELECT DISTINCT area_tier FROM pricing_matrix ORDER BY area_tier');
    output += "\nDistinct Area Tiers:\n  " + tiers.rows.map(r => r.area_tier).join(", ") + "\n";

    const disciplines = await client.query('SELECT DISTINCT discipline FROM pricing_matrix ORDER BY discipline');
    output += "\nDistinct Disciplines:\n  " + disciplines.rows.map(r => r.discipline).join(", ") + "\n";

    const lods = await client.query('SELECT DISTINCT lod FROM pricing_matrix ORDER BY lod');
    output += "\nDistinct LODs:\n  " + lods.rows.map(r => r.lod).join(", ") + "\n";

    const buildingTypes = await client.query('SELECT DISTINCT building_type_id FROM pricing_matrix ORDER BY building_type_id');
    output += "\nDistinct Building Type IDs:\n  " + buildingTypes.rows.map(r => r.building_type_id).join(", ") + "\n";

    // Total count
    const count = await client.query('SELECT COUNT(*) as count FROM pricing_matrix');
    output += "\nTotal rows: " + count.rows[0].count + "\n";

    fs.writeFileSync("pricing-check-output.txt", output);
    console.log("Output written to pricing-check-output.txt");

    await client.end();
}

main().catch(console.error);
