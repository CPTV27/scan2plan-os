import { createReadStream, existsSync } from 'fs';
import { parse } from 'csv-parse';
import { db } from '../db';
import { projects, leads } from '@shared/schema';

interface HistoricalProjectRow {
  project_name?: string;
  client_name?: string;
  project_address?: string;
  deal_value?: string;
  project_type?: string;
  building_type?: string;
  sqft?: string;
  status?: string;
  close_date?: string;
}

async function importHistoricalProjects(csvPath: string) {
  if (!existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`Importing historical projects from: ${csvPath}`);
  
  const records: HistoricalProjectRow[] = [];
  
  const parser = createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  );

  for await (const record of parser) {
    records.push(record);
  }

  console.log(`Found ${records.length} records to import`);

  let imported = 0;
  let skipped = 0;

  for (const row of records) {
    try {
      const clientName = row.client_name || row.project_name || 'Unknown';
      const value = row.deal_value ? parseFloat(row.deal_value.replace(/[$,]/g, '')) : 0;
      
      const [lead] = await db.insert(leads).values({
        clientName,
        projectName: row.project_name || null,
        projectAddress: row.project_address || null,
        value: value.toString(),
        buildingType: row.building_type || null,
        sqft: row.sqft ? parseInt(row.sqft.replace(/,/g, '')) : null,
        dealStage: 'Closed Won',
        probability: 100,
        createdAt: row.close_date ? new Date(row.close_date) : new Date(),
      }).returning();

      await db.insert(projects).values({
        name: row.project_name || clientName,
        leadId: lead.id,
        status: 'Delivered',
        progress: 100,
        priority: 'Normal',
      });

      imported++;
    } catch (error) {
      console.error(`Error importing row: ${JSON.stringify(row)}`, error);
      skipped++;
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
}

const csvPath = process.argv[2] || './attached_assets/historical_projects.csv';
importHistoricalProjects(csvPath)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
