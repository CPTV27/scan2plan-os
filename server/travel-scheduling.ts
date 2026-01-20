// Simplified travel scheduling utilities for Sales and Production
// Full travel scheduling capabilities removed in stripped-down version

import { log } from "./lib/logger";

interface TravelResult {
    distanceMiles: number;
    durationMinutes: number;
    scenario: { type: string; message: string };
}

interface ShiftValidation {
    valid: boolean;
    message: string;
    shiftType: string;
}

interface CalendarEventResult {
    eventId: string;
    htmlLink: string;
}

interface TechnicianAvailability {
    available: boolean;
    slots: { start: string; end: string }[];
}

/**
 * Calculate travel distance - returns a basic estimate
 * Full Google Maps integration removed in stripped-down version
 */
export async function calculateTravelDistance(
    destination: string,
    origin?: string
): Promise<TravelResult | null> {
    log(`[Travel] Calculating distance to ${destination} from ${origin || "default dispatch"}`);

    // Return a basic estimate - full implementation would use Google Maps API
    return {
        distanceMiles: 50,
        durationMinutes: 60,
        scenario: {
            type: "local",
            message: "Travel calculation simplified in this version"
        }
    };
}

/**
 * Validate shift gate based on travel time
 */
export function validateShiftGate(
    travelTimeMinutes: number,
    scanDurationHours?: number
): ShiftValidation {
    const totalHours = (travelTimeMinutes / 60) * 2 + (scanDurationHours || 4);

    if (totalHours <= 8) {
        return {
            valid: true,
            message: "Standard shift",
            shiftType: "standard"
        };
    } else if (totalHours <= 10) {
        return {
            valid: true,
            message: "Extended shift required",
            shiftType: "extended"
        };
    } else {
        return {
            valid: false,
            message: "Shift exceeds maximum allowed hours. Consider multi-day scheduling.",
            shiftType: "overtime"
        };
    }
}

/**
 * Create calendar event for scan scheduling
 * Full Google Calendar integration removed in stripped-down version
 */
export async function createScanCalendarEvent(params: {
    projectId: number;
    projectName: string;
    projectAddress: string;
    universalProjectId?: string;
    startDateTime: Date;
    endDateTime: Date;
    technicianEmail?: string;
    travelInfo?: TravelResult;
    notes?: string;
    driveFolderUrl?: string;
    missionBriefUrl?: string;
}): Promise<CalendarEventResult | null> {
    log(`[Calendar] Would create event for project ${params.projectId}: ${params.projectName}`);

    // Return a mock result - full implementation would use Google Calendar API
    return {
        eventId: `scan-${params.projectId}-${Date.now()}`,
        htmlLink: "#"
    };
}

/**
 * Get technician availability for a given date
 * Full calendar integration removed in stripped-down version
 */
export async function getTechnicianAvailability(
    date: Date,
    technicianEmail?: string
): Promise<TechnicianAvailability> {
    log(`[Calendar] Checking availability for ${date.toISOString()}`);

    // Return basic availability - full implementation would check Google Calendar
    return {
        available: true,
        slots: [
            { start: "08:00", end: "12:00" },
            { start: "13:00", end: "17:00" }
        ]
    };
}
