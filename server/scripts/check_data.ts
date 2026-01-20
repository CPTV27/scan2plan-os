
import { db } from "../db";
import { leads, cpqQuotes } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkData() {
    const allLeads = await db.select().from(leads);
    console.log(`Found ${allLeads.length} leads.`);

    for (const lead of allLeads) {
        const quotes = await db.select().from(cpqQuotes).where(eq(cpqQuotes.leadId, lead.id));
        console.log(`Lead ID: ${lead.id}, Name: ${lead.clientName}, Quotes: ${quotes.length}`);
        if (quotes.length > 0) {
            console.log(`  Quote ID: ${quotes[0].id}, Total: ${quotes[0].totalAmount}`);
        }
    }
    process.exit(0);
}

checkData().catch(console.error);
