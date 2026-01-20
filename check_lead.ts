
import { storage } from "./server/storage";
import { log } from "./server/lib/logger";

async function main() {
    try {
        const lead = await storage.getLead(2);
        console.log("Lead 2:", lead);

        const allLeads = await storage.getLeads();
        console.log("All Leads Count:", allLeads.length);
        console.log("All Leads IDs:", allLeads.map(l => l.id));
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit(0);
}

main();
