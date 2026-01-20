import type { Express } from "express";
import { leadsCoreRouter } from "./core";
import { leadsOperationsRouter } from "./operations";
import { leadsEnrichmentRouter } from "./enrichment";
import { leadsScoringRouter } from "./scoring";
import { leadsImportRouter } from "./import";
import { leadsDocumentsRouter } from "./documents";

export async function registerLeadRoutes(app: Express): Promise<void> {
    // Register all sub-routers
    app.use(leadsCoreRouter);
    app.use(leadsOperationsRouter);
    app.use(leadsEnrichmentRouter);
    app.use(leadsScoringRouter);
    app.use(leadsImportRouter);
    app.use(leadsDocumentsRouter);
}
