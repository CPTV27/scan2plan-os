import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated, requireRole } from "./replit_integrations/auth";
import { asyncHandler } from "./middleware/errorHandler";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { log } from "./lib/logger";

import { registerUserRoutes } from "./routes/users";
import { registerLeadRoutes } from "./routes/leads";
import { registerCpqRoutes } from "./routes/cpq";
import { registerProjectRoutes } from "./routes/projects";
import { registerWebhookRoutes } from "./routes/webhooks";
import { registerQuickbooksRoutes } from "./routes/quickbooks";
import { registerInvoiceRoutes } from "./routes/invoices";
import { registerDocumentRoutes } from "./routes/documents";
import { registerProposalRoutes } from "./routes/proposals";
import { emailsRouter } from "./routes/emails";
import { personasRouter } from "./routes/personas";
import { registerStorageRoutes } from "./routes/storage";
import { registerDeliveryRoutes } from "./routes/delivery";
import { registerGHLRoutes } from "./routes/ghl";
import { registerHealthRoutes } from "./routes/health";
import { customersRouter } from "./routes/customers";
import { productsRouter } from "./routes/products";
import { proposalTemplatesRouter, proposalTemplateGroupsRouter, generatedProposalsRouter } from "./routes/proposalTemplates";
import { sequencesRouter, initSequenceScheduler } from "./routes/sequences";
import signaturesRouter from "./routes/signatures";
import publicSignatureRouter from "./routes/publicSignature";
import cpqChatRouter from "./routes/cpq-chat";
import { notificationsRouter } from "./routes/notifications";
import { registerGoogleRoutes } from "./routes/google";


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const publicPaths: Array<{ path: string; type: 'exact' | 'prefix' | 'pattern' }> = [
    { path: '/login', type: 'exact' },
    { path: '/callback', type: 'exact' },
    { path: '/logout', type: 'exact' },
    { path: '/test-login', type: 'exact' },
    { path: '/auth/session-status', type: 'exact' },
    { path: '/auth/password-status', type: 'exact' },
    { path: '/auth/set-password', type: 'exact' },
    { path: '/auth/verify-password', type: 'exact' },
    { path: '/auth/user', type: 'exact' },
    { path: '/proposals/track/', type: 'prefix' },
    { path: '/site-readiness/', type: 'prefix' },
    { path: '/public/site-readiness/', type: 'prefix' },
    { path: '/webhooks/', type: 'prefix' },
    { path: '/public/', type: 'prefix' },
  ];

  const publicPatterns: RegExp[] = [
    /^\/proposals\/[a-zA-Z0-9_-]{24}$/,
    /^\/proposals\/[a-zA-Z0-9_-]{24}\/pdf$/,
    /^\/client-input\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
  ];

  app.use('/api', (req, res, next) => {
    const routePath = req.path;

    const isPublicPath = publicPaths.some(({ path, type }) => {
      if (type === 'exact') {
        return routePath === path;
      }
      if (type === 'prefix') {
        return routePath.startsWith(path);
      }
      return false;
    });

    const matchesPublicPattern = publicPatterns.some(pattern => pattern.test(routePath));

    if (isPublicPath || matchesPublicPattern) {
      return next();
    }

    isAuthenticated(req, res, next);
  });

  registerChatRoutes(app);
  registerImageRoutes(app);

  // Public routes (no auth required)
  app.use(publicSignatureRouter);

  // Health checks (no auth required)
  registerHealthRoutes(app);

  // Core routes for Sales & Production
  registerUserRoutes(app);
  await registerLeadRoutes(app);
  await registerCpqRoutes(app);
  registerProjectRoutes(app);
  await registerWebhookRoutes(app);
  registerQuickbooksRoutes(app);
  registerInvoiceRoutes(app);
  registerDocumentRoutes(app);
  app.use("/api/emails", emailsRouter);
  app.use("/api/personas", personasRouter);
  registerProposalRoutes(app);
  registerStorageRoutes(app);
  registerDeliveryRoutes(app);
  registerGHLRoutes(app);
  await registerGoogleRoutes(app);
  app.use(customersRouter);
  app.use(productsRouter);
  app.use("/api/proposal-templates", proposalTemplatesRouter);
  app.use("/api/proposal-template-groups", proposalTemplateGroupsRouter);
  app.use("/api/generated-proposals", generatedProposalsRouter);

  app.use(sequencesRouter);
  initSequenceScheduler();

  // E-Signatures (DocuSeal)
  app.use("/api/signatures", signaturesRouter);

  // CPQ AI Chat Assistant
  app.use("/api/cpq/chat", cpqChatRouter);

  app.post("/api/projects/:projectId/completion-checklist", isAuthenticated, requireRole("ceo", "production"), asyncHandler(async (req: Request, res: Response) => {
    try {
      const projectId = Number(req.params.projectId);
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const items = req.body.items || [];
      const allComplete = items.length > 0 && items.every((item: any) => item.completed);

      await storage.updateProject(projectId, {
        status: allComplete ? "Complete" : project.status,
      } as any);

      res.json({ success: true, allComplete });
    } catch (error: any) {
      log("ERROR: Error updating completion checklist - " + (error?.message || error));
      res.status(500).json({ message: error.message });
    }
  }));

  // Notifications
  app.use("/api/notifications", notificationsRouter);

  return httpServer;
}
