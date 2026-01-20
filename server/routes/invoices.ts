import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireRole } from "../replit_integrations/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { log } from "../lib/logger";

export function registerInvoiceRoutes(app: Express): void {
  app.get("/api/invoices", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));

  app.get("/api/invoices/:id", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const invoice = await storage.getInvoice(Number(req.params.id));
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      res.json(invoice);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));

  app.post("/api/invoices", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const invoice = await storage.createInvoice(req.body);
      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));

  app.patch("/api/invoices/:id", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(Number(req.params.id), req.body);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      res.json(invoice);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));

  app.get("/api/projects/:id/invoices", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const project = await storage.getProject(Number(req.params.id));
      if (!project?.leadId) return res.json([]);
      const invoices = await storage.getInvoicesByLead(project.leadId);
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));

  app.get("/api/invoices/lead/:leadId", isAuthenticated, requireRole("ceo"), asyncHandler(async (req, res) => {
    try {
      const invoices = await storage.getInvoicesByLead(Number(req.params.leadId));
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }));
}
