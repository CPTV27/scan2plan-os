
import { db } from "../db";
import { leads } from "@shared/schema";

async function testLead() {
    console.log("Attempting to insert lead...");
    try {
        const [lead] = await db.insert(leads).values({
            clientName: "Simple Test Lead",
            dealStage: "Leads"
        }).returning();
        console.log("Success:", lead);
    } catch (err: any) {
        console.error("Error creating lead:");
        console.error(err.message);
        if (err.code) console.error("Code:", err.code);
        if (err.detail) console.error("Detail:", err.detail);
    }
    process.exit(0);
}

testLead();
