import { Router } from "express";
import { isAuthenticated } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { getCalendarClient } from "../../google-clients";
import { log } from "../../lib/logger";

export const googleCalendarRouter = Router();

// GET /api/google/calendar/events
googleCalendarRouter.get(
    "/api/google/calendar/events",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        try {
            const calendar = await getCalendarClient();
            const maxResults = Number(req.query.maxResults) || 10;
            const timeMin = req.query.timeMin as string || new Date().toISOString();

            const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin,
                maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            });

            const events = (response.data.items || []).map(event => ({
                id: event.id,
                summary: event.summary,
                description: event.description,
                location: event.location,
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                htmlLink: event.htmlLink,
            }));

            res.json({ events });
        } catch (error: any) {
            log("ERROR: Calendar list error - " + (error?.message || error));
            res.status(500).json({ message: error.message || "Failed to fetch calendar events" });
        }
    })
);

// POST /api/google/calendar/events
googleCalendarRouter.post(
    "/api/google/calendar/events",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        try {
            const calendar = await getCalendarClient();
            const { summary, description, location, start, end } = req.body;

            if (!summary || !start || !end) {
                return res.status(400).json({ message: "summary, start, and end are required" });
            }

            const response = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                    summary,
                    description,
                    location,
                    start: { dateTime: start },
                    end: { dateTime: end },
                },
            });

            res.json({
                id: response.data.id,
                summary: response.data.summary,
                htmlLink: response.data.htmlLink,
            });
        } catch (error: any) {
            log("ERROR: Calendar create error - " + (error?.message || error));
            res.status(500).json({ message: error.message || "Failed to create event" });
        }
    })
);
