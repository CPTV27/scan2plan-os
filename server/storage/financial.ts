/**
 * Financial Storage Repository
 * 
 * Domain-specific repository for financial module operations:
 * - Accounts (Profit First)
 * - Invoices (AR with Interest)
 * - Internal Loans
 * - Vendor Payables (AP)
 */

import { db } from "../db";
import { 
  accounts, invoices, internalLoans, vendorPayables,
  type Account, type InsertAccount, 
  type Invoice, type InsertInvoice,
  type InternalLoan, type InsertInternalLoan, 
  type VendorPayable, type InsertVendorPayable 
} from "@shared/schema";
import { eq, desc, and, lt, sql } from "drizzle-orm";

export class AccountRepository {
  async getAccounts(): Promise<Account[]> {
    return await db.select().from(accounts).orderBy(accounts.accountType);
  }

  async getAccount(id: number): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account;
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const dbValues = {
      ...insertAccount,
      actualBalance: insertAccount.actualBalance?.toString() || "0",
      virtualBalance: insertAccount.virtualBalance?.toString() || "0",
      allocationPercent: insertAccount.allocationPercent.toString(),
    };
    const [account] = await db.insert(accounts).values(dbValues).returning();
    return account;
  }

  async updateAccount(id: number, updates: Partial<InsertAccount>): Promise<Account> {
    const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if (key === 'actualBalance' || key === 'virtualBalance' || key === 'allocationPercent') {
        dbUpdates[key] = value?.toString();
      } else {
        dbUpdates[key] = value;
      }
    }
    const [updated] = await db.update(accounts).set(dbUpdates).where(eq(accounts.id, id)).returning();
    return updated;
  }
}

export class InvoiceRepository {
  async getInvoices(): Promise<Invoice[]> {
    return await db.select().from(invoices).orderBy(desc(invoices.dueDate));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoicesByLead(leadId: number): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.leadId, leadId)).orderBy(desc(invoices.dueDate));
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    return await db.select().from(invoices)
      .where(and(
        lt(invoices.dueDate, now),
        sql`${invoices.status} != 'Paid' AND ${invoices.status} != 'Written Off'`
      ))
      .orderBy(desc(invoices.dueDate));
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const dbValues = {
      ...insertInvoice,
      totalAmount: insertInvoice.totalAmount.toString(),
      amountPaid: (insertInvoice.amountPaid || 0).toString(),
    };
    const [invoice] = await db.insert(invoices).values(dbValues).returning();
    return invoice;
  }

  async updateInvoice(id: number, updates: Partial<Invoice>): Promise<Invoice> {
    const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if (key === 'totalAmount' || key === 'amountPaid' || key === 'interestAccrued') {
        dbUpdates[key] = value?.toString();
      } else {
        dbUpdates[key] = value;
      }
    }
    const [updated] = await db.update(invoices).set(dbUpdates).where(eq(invoices.id, id)).returning();
    return updated;
  }
}

export class InternalLoanRepository {
  async getInternalLoans(): Promise<InternalLoan[]> {
    return await db.select().from(internalLoans).orderBy(desc(internalLoans.loanDate));
  }

  async getActiveLoan(): Promise<InternalLoan | undefined> {
    const [loan] = await db.select().from(internalLoans)
      .where(eq(internalLoans.isFullyRepaid, false))
      .orderBy(desc(internalLoans.loanDate));
    return loan;
  }

  async createInternalLoan(insertLoan: InsertInternalLoan): Promise<InternalLoan> {
    const originalAmount = insertLoan.originalAmount;
    const amountRepaid = insertLoan.amountRepaid || 0;
    const remainingBalance = originalAmount - amountRepaid;
    
    const dbValues = {
      ...insertLoan,
      originalAmount: originalAmount.toString(),
      amountRepaid: amountRepaid.toString(),
      remainingBalance: remainingBalance.toString(),
      isFullyRepaid: remainingBalance <= 0,
    };
    const [loan] = await db.insert(internalLoans).values(dbValues).returning();
    return loan;
  }

  async updateInternalLoan(id: number, updates: Partial<InternalLoan>): Promise<InternalLoan> {
    const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if (key === 'originalAmount' || key === 'amountRepaid' || key === 'remainingBalance') {
        dbUpdates[key] = value?.toString();
      } else {
        dbUpdates[key] = value;
      }
    }
    const [updated] = await db.update(internalLoans).set(dbUpdates).where(eq(internalLoans.id, id)).returning();
    return updated;
  }
}

export class VendorPayableRepository {
  async getVendorPayables(): Promise<VendorPayable[]> {
    return await db.select().from(vendorPayables).orderBy(vendorPayables.dueDate);
  }

  async getUnpaidPayables(): Promise<VendorPayable[]> {
    return await db.select().from(vendorPayables)
      .where(eq(vendorPayables.isPaid, false))
      .orderBy(vendorPayables.dueDate);
  }

  async createVendorPayable(insertPayable: InsertVendorPayable): Promise<VendorPayable> {
    const dbValues = {
      ...insertPayable,
      amount: insertPayable.amount.toString(),
    };
    const [payable] = await db.insert(vendorPayables).values(dbValues).returning();
    return payable;
  }

  async updateVendorPayable(id: number, updates: Partial<VendorPayable>): Promise<VendorPayable> {
    const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      if (key === 'amount') {
        dbUpdates[key] = value?.toString();
      } else {
        dbUpdates[key] = value;
      }
    }
    const [updated] = await db.update(vendorPayables).set(dbUpdates).where(eq(vendorPayables.id, id)).returning();
    return updated;
  }
}

export const accountRepo = new AccountRepository();
export const invoiceRepo = new InvoiceRepository();
export const internalLoanRepo = new InternalLoanRepository();
export const vendorPayableRepo = new VendorPayableRepository();

export const accountStorage = {
  getAll: (): Promise<Account[]> => accountRepo.getAccounts(),
  getById: (id: number): Promise<Account | undefined> => accountRepo.getAccount(id),
  create: (account: InsertAccount): Promise<Account> => accountRepo.createAccount(account),
  update: (id: number, updates: Partial<InsertAccount>): Promise<Account> => accountRepo.updateAccount(id, updates),
};

export const invoiceStorage = {
  getAll: (): Promise<Invoice[]> => invoiceRepo.getInvoices(),
  getById: (id: number): Promise<Invoice | undefined> => invoiceRepo.getInvoice(id),
  getByLeadId: (leadId: number): Promise<Invoice[]> => invoiceRepo.getInvoicesByLead(leadId),
  getOverdue: (): Promise<Invoice[]> => invoiceRepo.getOverdueInvoices(),
  create: (invoice: InsertInvoice): Promise<Invoice> => invoiceRepo.createInvoice(invoice),
  update: (id: number, updates: Partial<Invoice>): Promise<Invoice> => invoiceRepo.updateInvoice(id, updates),
};

export const internalLoanStorage = {
  getAll: (): Promise<InternalLoan[]> => internalLoanRepo.getInternalLoans(),
  getActive: (): Promise<InternalLoan | undefined> => internalLoanRepo.getActiveLoan(),
  create: (loan: InsertInternalLoan): Promise<InternalLoan> => internalLoanRepo.createInternalLoan(loan),
  update: (id: number, updates: Partial<InternalLoan>): Promise<InternalLoan> => internalLoanRepo.updateInternalLoan(id, updates),
};

export const vendorPayableStorage = {
  getAll: (): Promise<VendorPayable[]> => vendorPayableRepo.getVendorPayables(),
  getUnpaid: (): Promise<VendorPayable[]> => vendorPayableRepo.getUnpaidPayables(),
  create: (payable: InsertVendorPayable): Promise<VendorPayable> => vendorPayableRepo.createVendorPayable(payable),
  update: (id: number, updates: Partial<VendorPayable>): Promise<VendorPayable> => vendorPayableRepo.updateVendorPayable(id, updates),
};
