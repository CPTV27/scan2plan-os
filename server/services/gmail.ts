import { google, gmail_v1 } from 'googleapis';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('Gmail authentication not available');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

export async function getGmailClient(): Promise<gmail_v1.Gmail> {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export interface ParsedEmail {
  gmailMessageId: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  bodyPreview: string;
  bodyHtml: string | null;
  hasAttachments: boolean;
  attachmentNames: string[];
  sentAt: Date;
  isInbound: boolean;
}

export interface ParsedThread {
  gmailThreadId: string;
  subject: string;
  participants: string[];
  snippet: string;
  messageCount: number;
  hasAttachments: boolean;
  lastMessageAt: Date;
  messages: ParsedEmail[];
}

function parseEmailAddress(headerValue: string): { email: string; name: string | null } {
  const match = headerValue.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), email: match[2].trim() };
  }
  return { name: null, email: headerValue.trim() };
}

function parseEmailList(headerValue: string): string[] {
  if (!headerValue) return [];
  return headerValue.split(',').map(e => {
    const parsed = parseEmailAddress(e);
    return parsed.email;
  });
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function getBodyPreview(payload: gmail_v1.Schema$MessagePart | undefined, maxLength = 200): string {
  if (!payload) return '';

  function extractText(part: gmail_v1.Schema$MessagePart): string {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) {
      for (const subpart of part.parts) {
        const text = extractText(subpart);
        if (text) return text;
      }
    }
    return '';
  }

  const text = extractText(payload);
  return text.substring(0, maxLength).replace(/\s+/g, ' ').trim();
}

function getBodyHtml(payload: gmail_v1.Schema$MessagePart | undefined): string | null {
  if (!payload) return null;

  function extractHtml(part: gmail_v1.Schema$MessagePart): string | null {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) {
      for (const subpart of part.parts) {
        const html = extractHtml(subpart);
        if (html) return html;
      }
    }
    return null;
  }

  return extractHtml(payload);
}

function getAttachmentInfo(payload: gmail_v1.Schema$MessagePart | undefined): { hasAttachments: boolean; names: string[] } {
  const names: string[] = [];

  function findAttachments(part: gmail_v1.Schema$MessagePart): void {
    if (part.filename && part.body?.attachmentId) {
      names.push(part.filename);
    }
    if (part.parts) {
      part.parts.forEach(findAttachments);
    }
  }

  if (payload) {
    findAttachments(payload);
  }

  return { hasAttachments: names.length > 0, names };
}

export function parseMessage(msg: gmail_v1.Schema$Message, userEmail: string): ParsedEmail {
  const headers = msg.payload?.headers;
  const from = getHeader(headers, 'From');
  const to = getHeader(headers, 'To');
  const cc = getHeader(headers, 'Cc');
  const subject = getHeader(headers, 'Subject');
  const date = getHeader(headers, 'Date');

  const fromParsed = parseEmailAddress(from);
  const toEmails = parseEmailList(to);
  const ccEmails = parseEmailList(cc);
  const attachmentInfo = getAttachmentInfo(msg.payload);

  const isInbound = !fromParsed.email.toLowerCase().includes(userEmail.toLowerCase());

  return {
    gmailMessageId: msg.id || '',
    fromEmail: fromParsed.email,
    fromName: fromParsed.name,
    toEmails,
    ccEmails,
    subject,
    bodyPreview: msg.snippet || getBodyPreview(msg.payload),
    bodyHtml: getBodyHtml(msg.payload),
    hasAttachments: attachmentInfo.hasAttachments,
    attachmentNames: attachmentInfo.names,
    sentAt: date ? new Date(date) : new Date(),
    isInbound,
  };
}

export async function searchThreadsByEmail(gmail: gmail_v1.Gmail, email: string): Promise<gmail_v1.Schema$Thread[]> {
  try {
    const query = `from:${email} OR to:${email}`;
    const response = await gmail.users.threads.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    });

    return response.data.threads || [];
  } catch (error: any) {
    console.error('Gmail search error:', error.message);
    if (error.code === 403) {
      throw new Error('Gmail permissions insufficient. Please reconnect Gmail with read access.');
    }
    throw error;
  }
}

export async function getThreadDetails(gmail: gmail_v1.Gmail, threadId: string, userEmail: string): Promise<ParsedThread | null> {
  try {
    const response = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });

    const thread = response.data;
    if (!thread.messages || thread.messages.length === 0) {
      return null;
    }

    const messages = thread.messages.map(m => parseMessage(m, userEmail));
    const allParticipants = new Set<string>();
    let hasAttachments = false;

    messages.forEach(m => {
      allParticipants.add(m.fromEmail);
      m.toEmails.forEach(e => allParticipants.add(e));
      m.ccEmails.forEach(e => allParticipants.add(e));
      if (m.hasAttachments) hasAttachments = true;
    });

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    return {
      gmailThreadId: thread.id || '',
      subject: firstMessage.subject,
      participants: Array.from(allParticipants),
      snippet: thread.snippet || lastMessage.bodyPreview,
      messageCount: messages.length,
      hasAttachments,
      lastMessageAt: lastMessage.sentAt,
      messages,
    };
  } catch (error: any) {
    console.error('Gmail thread get error:', error.message);
    return null;
  }
}

export async function getUserEmail(gmail: gmail_v1.Gmail): Promise<string> {
  const profile = await gmail.users.getProfile({ userId: 'me' });
  return profile.data.emailAddress || '';
}

export async function sendEmail(gmail: gmail_v1.Gmail, to: string, subject: string, body: string): Promise<{ messageId: string | null; threadId: string | null }> {
  try {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    const encodedEmail = Buffer.from(email).toString('base64url');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedEmail },
    });

    return {
      messageId: response.data.id || null,
      threadId: response.data.threadId || null
    };
  } catch (error: any) {
    console.error('Gmail send error:', error.message);
    throw error;
  }
}

