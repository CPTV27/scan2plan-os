// Google Chat API Integration for Project Concierge
// Creates dedicated project spaces when Retainer Gate is cleared

import { google, chat_v1 } from 'googleapis';
import { log } from "./lib/logger";

const GOOGLE_CHAT_SERVICE_ACCOUNT = process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_JSON;
// The user email to impersonate for domain-wide delegation
const IMPERSONATE_USER = process.env.GOOGLE_CHAT_IMPERSONATE_USER || 'ceo@scan2plan.dev';

interface ChatSpaceConfig {
  universalProjectId: string;
  clientName: string;
  driveFolderUrl: string | null;
  scopeOfWork: string | null;
  memberEmails: string[];
}

interface CreateSpaceResult {
  success: boolean;
  spaceName?: string;
  spaceUrl?: string;
  error?: string;
}

async function getChatClient(): Promise<chat_v1.Chat | null> {
  if (!GOOGLE_CHAT_SERVICE_ACCOUNT) {
    log("WARN: Google Chat service account not configured");
    return null;
  }

  try {
    const credentials = JSON.parse(GOOGLE_CHAT_SERVICE_ACCOUNT);
    
    // Use JWT auth with subject for domain-wide delegation
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/chat.spaces',
        'https://www.googleapis.com/auth/chat.spaces.create',
        'https://www.googleapis.com/auth/chat.messages',
        'https://www.googleapis.com/auth/chat.memberships',
      ],
      subject: IMPERSONATE_USER, // Impersonate this user (requires domain-wide delegation)
    });

    await auth.authorize();
    return google.chat({ version: 'v1', auth });
  } catch (error) {
    log(`ERROR: Failed to initialize Google Chat client - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export function isGoogleChatConfigured(): boolean {
  return !!GOOGLE_CHAT_SERVICE_ACCOUNT;
}

export async function createProjectSpace(config: ChatSpaceConfig): Promise<CreateSpaceResult> {
  const chat = await getChatClient();
  
  if (!chat) {
    return { 
      success: false, 
      error: "Google Chat not configured. Add GOOGLE_CHAT_SERVICE_ACCOUNT_JSON to secrets." 
    };
  }

  try {
    const spaceName = `${config.universalProjectId} - ${config.clientName}`;
    
    // Use spaces.setup for Chat app to create and set up a space
    const spaceResponse = await chat.spaces.setup({
      requestBody: {
        space: {
          displayName: spaceName.slice(0, 128),
          spaceType: 'SPACE',
          singleUserBotDm: false,
          spaceDetails: {
            description: `Project space for ${config.clientName}. Universal ID: ${config.universalProjectId}`,
          },
        },
        memberships: config.memberEmails.map(email => ({
          member: {
            name: `users/${email}`,
            type: 'HUMAN',
          },
        })),
      },
    });

    const space = spaceResponse.data;
    
    if (!space.name) {
      return { success: false, error: "Failed to create space - no name returned" };
    }

    const welcomeMessage = buildWelcomeMessage(config);
    
    // Send welcome message to the space
    try {
      await chat.spaces.messages.create({
        parent: space.name,
        requestBody: {
          text: welcomeMessage,
        },
      });
    } catch (msgError) {
      log(`WARN: Failed to send welcome message - ${msgError instanceof Error ? msgError.message : String(msgError)}`);
    }

    const spaceUrl = `https://chat.google.com/room/${space.name?.replace('spaces/', '')}`;

    return {
      success: true,
      spaceName: space.name,
      spaceUrl,
    };
  } catch (error) {
    log(`ERROR: Failed to create project space - ${error instanceof Error ? error.message : String(error)}`);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

function buildWelcomeMessage(config: ChatSpaceConfig): string {
  const lines = [
    `*Project Space Created*`,
    ``,
    `*Universal Project ID:* ${config.universalProjectId}`,
    `*Client:* ${config.clientName}`,
    ``,
  ];

  if (config.driveFolderUrl) {
    lines.push(`*Google Drive Folder:* ${config.driveFolderUrl}`);
    lines.push(``);
  }

  if (config.scopeOfWork) {
    lines.push(`*Scope of Work:*`);
    lines.push(config.scopeOfWork);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`This space was automatically created when the retainer was received.`);
  lines.push(`All project stakeholders have been added.`);

  return lines.join('\n');
}

export async function sendProjectUpdate(
  spaceName: string, 
  message: string
): Promise<boolean> {
  const chat = await getChatClient();
  
  if (!chat) {
    log("WARN: Google Chat not configured");
    return false;
  }

  try {
    await chat.spaces.messages.create({
      parent: spaceName,
      requestBody: {
        text: message,
      },
    });
    return true;
  } catch (error) {
    log(`ERROR: Failed to send project update - ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
