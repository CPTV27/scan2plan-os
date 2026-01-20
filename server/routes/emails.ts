import { Router } from 'express';
import { db } from '../db';
import { emailThreads, emailMessages, leads, type InsertEmailThread, type InsertEmailMessage } from '@shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getGmailClient, searchThreadsByEmail, getThreadDetails, getUserEmail } from '../services/gmail';

export const emailsRouter = Router();

emailsRouter.get('/leads/:leadId/threads', async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }

    const threads = await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.leadId, leadId))
      .orderBy(desc(emailThreads.lastMessageAt));

    res.json(threads);
  } catch (error: any) {
    console.error('Error fetching email threads:', error);
    res.status(500).json({ error: error.message });
  }
});

emailsRouter.get('/threads/:threadId/messages', async (req, res) => {
  try {
    const threadId = parseInt(req.params.threadId);
    if (isNaN(threadId)) {
      return res.status(400).json({ error: 'Invalid thread ID' });
    }

    const messages = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.threadId, threadId))
      .orderBy(emailMessages.sentAt);

    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching email messages:', error);
    res.status(500).json({ error: error.message });
  }
});

emailsRouter.post('/leads/:leadId/sync', async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId);
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }

    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const emails = [lead.contactEmail, lead.billingContactEmail].filter(Boolean) as string[];
    if (emails.length === 0) {
      return res.json({ synced: 0, message: 'No contact emails to sync' });
    }

    let gmail;
    let userEmail: string;
    try {
      gmail = await getGmailClient();
      userEmail = await getUserEmail(gmail);
    } catch (error: any) {
      return res.status(503).json({ 
        error: 'Gmail not connected', 
        message: 'Please connect Gmail in the integrations panel' 
      });
    }

    let totalSynced = 0;
    const syncedThreadIds: string[] = [];

    for (const email of emails) {
      try {
        const threadList = await searchThreadsByEmail(gmail, email);
        
        for (const t of threadList) {
          if (!t.id || syncedThreadIds.includes(t.id)) continue;
          
          const existingThread = await db
            .select()
            .from(emailThreads)
            .where(eq(emailThreads.gmailThreadId, t.id))
            .limit(1);

          if (existingThread.length > 0) {
            continue;
          }

          const threadDetails = await getThreadDetails(gmail, t.id, userEmail);
          if (!threadDetails) continue;

          const [newThread] = await db
            .insert(emailThreads)
            .values({
              leadId,
              gmailThreadId: threadDetails.gmailThreadId,
              subject: threadDetails.subject,
              participants: threadDetails.participants,
              snippet: threadDetails.snippet,
              messageCount: threadDetails.messageCount,
              hasAttachments: threadDetails.hasAttachments,
              lastMessageAt: threadDetails.lastMessageAt,
            })
            .returning();

          for (const msg of threadDetails.messages) {
            await db.insert(emailMessages).values({
              threadId: newThread.id,
              gmailMessageId: msg.gmailMessageId,
              fromEmail: msg.fromEmail,
              fromName: msg.fromName,
              toEmails: msg.toEmails,
              ccEmails: msg.ccEmails,
              subject: msg.subject,
              bodyPreview: msg.bodyPreview,
              bodyHtml: msg.bodyHtml,
              hasAttachments: msg.hasAttachments,
              attachmentNames: msg.attachmentNames,
              isInbound: msg.isInbound,
              sentAt: msg.sentAt,
            }).onConflictDoNothing();
          }

          syncedThreadIds.push(t.id);
          totalSynced++;
        }
      } catch (error: any) {
        console.error(`Error syncing email ${email}:`, error.message);
      }
    }

    res.json({ synced: totalSynced, message: `Synced ${totalSynced} new email threads` });
  } catch (error: any) {
    console.error('Error syncing emails:', error);
    res.status(500).json({ error: error.message });
  }
});

emailsRouter.get('/threads/:threadId', async (req, res) => {
  try {
    const threadId = parseInt(req.params.threadId);
    if (isNaN(threadId)) {
      return res.status(400).json({ error: 'Invalid thread ID' });
    }

    const [thread] = await db
      .select()
      .from(emailThreads)
      .where(eq(emailThreads.id, threadId));

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const messages = await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.threadId, threadId))
      .orderBy(emailMessages.sentAt);

    res.json({ ...thread, messages });
  } catch (error: any) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: error.message });
  }
});
