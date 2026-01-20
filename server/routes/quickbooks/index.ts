import type { Express } from "express";
import { quickbooksAuthRouter } from "./auth";
import { quickbooksQuotesRouter } from "./quotes";
import { quickbooksFinanceRouter } from "./finance";
import { quickbooksReportsRouter } from "./reports";
import { quickbooksSyncRouter } from "./sync";
import { quickbooksCustomersRouter } from "./customers";

export function registerQuickbooksRoutes(app: Express): void {
    app.use(quickbooksAuthRouter);
    app.use(quickbooksQuotesRouter);
    app.use(quickbooksFinanceRouter);
    app.use(quickbooksReportsRouter);
    app.use(quickbooksSyncRouter);
    app.use(quickbooksCustomersRouter);
}
