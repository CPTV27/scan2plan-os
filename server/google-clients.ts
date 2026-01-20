// Google Workspace Integration Clients
// Uses Service Account or OAuth credentials for authentication

import { google } from 'googleapis';
import { log } from "./lib/logger";

/**
 * Create Google auth client using Service Account or access token
 * 
 * Supports two authentication methods:
 * 1. Service Account (recommended for server-to-server): Set GOOGLE_SERVICE_ACCOUNT_JSON
 * 2. Direct access token: Set GOOGLE_ACCESS_TOKEN (for testing/development)
 */
async function getGoogleAuth() {
  // Option 1: Service Account JSON (recommended)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/gmail.labels',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/spreadsheets',
        ],
      });
      return auth;
    } catch (error) {
      log(`ERROR: Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON - ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
    }
  }

  // Option 2: Direct access token (for development/testing)
  if (process.env.GOOGLE_ACCESS_TOKEN) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: process.env.GOOGLE_ACCESS_TOKEN });
    return oauth2Client;
  }

  throw new Error('Google API credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_ACCESS_TOKEN in .env');
}

// Gmail Client
// Permissions: gmail.send, gmail.labels, gmail.readonly, gmail.compose
export async function getGmailClient() {
  const auth = await getGoogleAuth();
  return google.gmail({ version: 'v1', auth });
}

// Google Calendar Client
// Permissions: calendar.events, calendar.readonly, calendar.freebusy
export async function getCalendarClient() {
  const auth = await getGoogleAuth();
  return google.calendar({ version: 'v3', auth });
}

// Google Drive Client
// Permissions: drive.file, drive.appdata, docs, spreadsheets
export async function getDriveClient() {
  const auth = await getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

// Google Sheets Client
export async function getSheetsClient() {
  const auth = await getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
}

// Check if Google APIs are configured
export async function isGoogleConfigured(): Promise<boolean> {
  try {
    await getGoogleAuth();
    return true;
  } catch {
    return false;
  }
}
