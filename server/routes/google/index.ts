import type { Express } from "express";
import { googleGmailRouter } from "./gmail";
import { googleCalendarRouter } from "./calendar";
import { googleDriveRouter } from "./drive";
import { googleMapsRouter } from "./maps";

export async function registerGoogleRoutes(app: Express): Promise<void> {
    app.use(googleGmailRouter);
    app.use(googleCalendarRouter);
    app.use(googleDriveRouter);
    app.use(googleMapsRouter);
}
