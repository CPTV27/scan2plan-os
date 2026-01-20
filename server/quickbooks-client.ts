import { db } from "./db";
import { quickbooksTokens, expenses, leads, projects, type Expense, type InsertExpense } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { log } from "./lib/logger";

const QB_BASE_URL = process.env.QB_SANDBOX === "true" 
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

interface QBTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  token_type: string;
}

interface QBExpense {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  Line: Array<{
    Description?: string;
    Amount: number;
    DetailType: string;
    AccountBasedExpenseLineDetail?: {
      AccountRef: { name: string; value: string };
      BillableStatus?: string;
    };
  }>;
  EntityRef?: { name: string; value: string };
  AccountRef?: { name: string; value: string };
  CustomerRef?: { name: string; value: string }; // Customer/Job reference for auto-linking
  PrivateNote?: string;
}

interface QBBill {
  Id: string;
  TxnDate: string;
  TotalAmt: number;
  VendorRef?: { name: string; value: string };
  CustomerRef?: { name: string; value: string };
  PrivateNote?: string;
  Line?: Array<{
    Description?: string;
    Amount: number;
    DetailType: string;
    AccountBasedExpenseLineDetail?: {
      AccountRef: { name: string; value: string };
      BillableStatus?: string;
    };
  }>;
}

export class QuickBooksClient {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.QUICKBOOKS_CLIENT_ID || "";
    this.clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || "";
    this.redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || "";
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.redirectUri);
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      scope: "com.intuit.quickbooks.accounting",
      redirect_uri: this.redirectUri,
      state,
    });
    return `${QB_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, realmId: string): Promise<void> {
    const response = await fetch(QB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data: QBTokenResponse = await response.json();
    await this.saveTokens(data, realmId);
  }

  private async saveTokens(data: QBTokenResponse, realmId: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + data.expires_in * 1000);
    const refreshExpiresAt = new Date(now.getTime() + data.x_refresh_token_expires_in * 1000);

    const existing = await db.select().from(quickbooksTokens).limit(1);
    
    if (existing.length > 0) {
      await db.update(quickbooksTokens)
        .set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          realmId,
          expiresAt,
          refreshExpiresAt,
          updatedAt: now,
        })
        .where(eq(quickbooksTokens.id, existing[0].id));
    } else {
      await db.insert(quickbooksTokens).values({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        realmId,
        expiresAt,
        refreshExpiresAt,
      });
    }
  }

  async getValidToken(): Promise<{ accessToken: string; realmId: string } | null> {
    const tokens = await db.select().from(quickbooksTokens).limit(1);
    if (tokens.length === 0) return null;

    const token = tokens[0];
    const now = new Date();

    if (token.expiresAt <= now) {
      if (token.refreshExpiresAt <= now) {
        await db.delete(quickbooksTokens).where(eq(quickbooksTokens.id, token.id));
        return null;
      }
      await this.refreshAccessToken(token.refreshToken, token.realmId);
      const refreshed = await db.select().from(quickbooksTokens).limit(1);
      return refreshed.length > 0 
        ? { accessToken: refreshed[0].accessToken, realmId: refreshed[0].realmId }
        : null;
    }

    return { accessToken: token.accessToken, realmId: token.realmId };
  }

  private async refreshAccessToken(refreshToken: string, realmId: string): Promise<void> {
    const response = await fetch(QB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data: QBTokenResponse = await response.json();
    await this.saveTokens(data, realmId);
  }

  async disconnect(): Promise<void> {
    await db.delete(quickbooksTokens);
  }

  async isConnected(): Promise<boolean> {
    const token = await this.getValidToken();
    return token !== null;
  }

  async fetchExpenses(startDate?: Date, endDate?: Date): Promise<QBExpense[]> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const start = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const query = `SELECT * FROM Purchase WHERE TxnDate >= '${start.toISOString().split("T")[0]}' AND TxnDate <= '${end.toISOString().split("T")[0]}' MAXRESULTS 1000`;

    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch expenses: ${error}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Purchase || [];
  }

  // Helper method to auto-link expense to lead/project via CustomerRef
  // Uses deterministic selection: prioritizes Closed Won leads, then most recent
  private async autoLinkToLeadAndProject(qboCustomerId: string): Promise<{ leadId: number | null; projectId: number | null }> {
    let leadId: number | null = null;
    let projectId: number | null = null;

    // Find all leads with matching qboCustomerId
    const matchedLeads = await db.select()
      .from(leads)
      .where(eq(leads.qboCustomerId, qboCustomerId));

    if (matchedLeads.length > 0) {
      // Deterministic selection: prefer Closed Won, then by most recent ID (highest ID = most recent)
      const sortedLeads = matchedLeads.sort((a, b) => {
        // Closed Won gets priority
        if (a.dealStage === "Closed Won" && b.dealStage !== "Closed Won") return -1;
        if (b.dealStage === "Closed Won" && a.dealStage !== "Closed Won") return 1;
        // Then by most recent (highest ID)
        return b.id - a.id;
      });
      
      const selectedLead = sortedLeads[0];
      leadId = selectedLead.id;
      
      // Also link to project if one exists
      const project = await db.select()
        .from(projects)
        .where(eq(projects.leadId, selectedLead.id))
        .limit(1);
      if (project.length > 0) {
        projectId = project[0].id;
      }
    }

    return { leadId, projectId };
  }

  async syncExpenses(): Promise<{ synced: number; errors: string[] }> {
    const qbExpenses = await this.fetchExpenses();
    const results = { synced: 0, errors: [] as string[] };

    for (const qbExp of qbExpenses) {
      try {
        const existing = await db.select()
          .from(expenses)
          .where(eq(expenses.qbExpenseId, qbExp.Id))
          .limit(1);

        const firstLine = qbExp.Line?.[0];
        const expenseData: InsertExpense = {
          qbExpenseId: qbExp.Id,
          vendorName: qbExp.EntityRef?.name || null,
          description: firstLine?.Description || qbExp.PrivateNote || null,
          amount: String(qbExp.TotalAmt),
          expenseDate: new Date(qbExp.TxnDate),
          category: this.categorizeExpense(firstLine?.AccountBasedExpenseLineDetail?.AccountRef?.name),
          accountName: firstLine?.AccountBasedExpenseLineDetail?.AccountRef?.name || qbExp.AccountRef?.name || null,
          isBillable: firstLine?.AccountBasedExpenseLineDetail?.BillableStatus === "Billable",
          source: "quickbooks",
        };

        // Auto-link to lead/project via CustomerRef
        if (qbExp.CustomerRef?.value) {
          const { leadId, projectId } = await this.autoLinkToLeadAndProject(qbExp.CustomerRef.value);
          if (leadId) expenseData.leadId = leadId;
          if (projectId) expenseData.projectId = projectId;
        }

        if (existing.length > 0) {
          await db.update(expenses)
            .set({ ...expenseData, syncedAt: new Date() })
            .where(eq(expenses.id, existing[0].id));
        } else {
          await db.insert(expenses).values(expenseData);
        }
        results.synced++;
      } catch (err: any) {
        results.errors.push(`Expense ${qbExp.Id}: ${err.message}`);
      }
    }

    return results;
  }

  // === BILL SYNC (Vendor Invoices / Accounts Payable) ===
  async fetchBills(startDate?: Date, endDate?: Date): Promise<QBBill[]> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const start = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const query = `SELECT * FROM Bill WHERE TxnDate >= '${start.toISOString().split("T")[0]}' AND TxnDate <= '${end.toISOString().split("T")[0]}' MAXRESULTS 1000`;

    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch bills: ${error}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Bill || [];
  }

  async syncBills(): Promise<{ synced: number; errors: string[] }> {
    const qbBills = await this.fetchBills();
    const results = { synced: 0, errors: [] as string[] };

    for (const bill of qbBills) {
      try {
        // Use BILL- prefix to distinguish Bills from Purchase expenses
        // This is intentional as QuickBooks uses separate ID spaces for different entity types
        const qbExpenseId = `BILL-${bill.Id}`;
        const existing = await db.select()
          .from(expenses)
          .where(eq(expenses.qbExpenseId, qbExpenseId))
          .limit(1);

        // Aggregate all lines for accurate categorization and description
        const allLines = bill.Line || [];
        const descriptions: string[] = [];
        const categories: string[] = [];
        let hasBillable = false;
        
        for (const line of allLines) {
          if (line.Description) {
            descriptions.push(line.Description);
          }
          
          // Handle AccountBasedExpenseLineDetail
          if (line.DetailType === "AccountBasedExpenseLineDetail" && line.AccountBasedExpenseLineDetail) {
            const accountName = line.AccountBasedExpenseLineDetail.AccountRef?.name;
            if (accountName) {
              categories.push(this.categorizeExpense(accountName));
            }
            if (line.AccountBasedExpenseLineDetail.BillableStatus === "Billable") {
              hasBillable = true;
            }
          }
          
          // Handle ItemBasedExpenseLineDetail (vendor invoices with items)
          if (line.DetailType === "ItemBasedExpenseLineDetail") {
            const itemLine = line as any;
            if (itemLine.ItemBasedExpenseLineDetail?.ItemRef?.name) {
              categories.push(this.categorizeExpense(itemLine.ItemBasedExpenseLineDetail.ItemRef.name));
            }
            if (itemLine.ItemBasedExpenseLineDetail?.BillableStatus === "Billable") {
              hasBillable = true;
            }
          }
        }
        
        // Use most common category or first found, defaulting to "Other"
        const primaryCategory = categories.length > 0 
          ? this.getMostCommonCategory(categories) 
          : "Other";
        
        const combinedDescription = descriptions.length > 0 
          ? descriptions.join("; ").substring(0, 500) // Limit description length
          : bill.PrivateNote || null;

        const expenseData: InsertExpense = {
          qbExpenseId,
          vendorName: bill.VendorRef?.name || null,
          description: combinedDescription,
          amount: String(bill.TotalAmt), // Use TotalAmt which sums all lines
          expenseDate: new Date(bill.TxnDate),
          category: primaryCategory,
          accountName: allLines[0]?.AccountBasedExpenseLineDetail?.AccountRef?.name || null,
          source: "quickbooks",
          isBillable: hasBillable,
        };

        // Auto-link to lead/project via CustomerRef
        if (bill.CustomerRef?.value) {
          const { leadId, projectId } = await this.autoLinkToLeadAndProject(bill.CustomerRef.value);
          if (leadId) expenseData.leadId = leadId;
          if (projectId) expenseData.projectId = projectId;
        }

        if (existing.length > 0) {
          await db.update(expenses)
            .set({ ...expenseData, syncedAt: new Date() })
            .where(eq(expenses.id, existing[0].id));
        } else {
          await db.insert(expenses).values(expenseData);
        }
        results.synced++;
      } catch (err: any) {
        results.errors.push(`Bill ${bill.Id}: ${err.message}`);
      }
    }

    return results;
  }

  // Helper to get most common category from a list
  private getMostCommonCategory(categories: string[]): string {
    const counts: Record<string, number> = {};
    for (const cat of categories) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
    let maxCount = 0;
    let mostCommon = "Other";
    for (const [cat, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = cat;
      }
    }
    return mostCommon;
  }

  // Combined sync method for purchases + bills
  async syncAllExpenses(): Promise<{ purchases: { synced: number; errors: string[] }; bills: { synced: number; errors: string[] } }> {
    const purchases = await this.syncExpenses();
    const bills = await this.syncBills();
    return { purchases, bills };
  }

  private categorizeExpense(accountName?: string): string {
    if (!accountName) return "Other";
    const lower = accountName.toLowerCase();
    if (lower.includes("travel") || lower.includes("mileage") || lower.includes("fuel")) return "Travel";
    if (lower.includes("equipment") || lower.includes("scanner") || lower.includes("hardware")) return "Equipment";
    if (lower.includes("labor") || lower.includes("payroll") || lower.includes("contractor")) return "Labor";
    if (lower.includes("software") || lower.includes("subscription") || lower.includes("license")) return "Software";
    if (lower.includes("office") || lower.includes("supplies")) return "Office Supplies";
    if (lower.includes("insurance")) return "Insurance";
    return "Other";
  }

  async getExpenses(): Promise<Expense[]> {
    return db.select().from(expenses).orderBy(desc(expenses.expenseDate));
  }

  async getExpensesByLead(leadId: number): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.leadId, leadId)).orderBy(desc(expenses.expenseDate));
  }

  async linkExpenseToLead(expenseId: number, leadId: number | null): Promise<Expense> {
    const [updated] = await db.update(expenses)
      .set({ leadId })
      .where(eq(expenses.id, expenseId))
      .returning();
    return updated;
  }

  async linkExpenseToProject(expenseId: number, projectId: number | null): Promise<Expense> {
    const [updated] = await db.update(expenses)
      .set({ projectId })
      .where(eq(expenses.id, expenseId))
      .returning();
    return updated;
  }

  async getExpenseSummaryByLead(leadId: number): Promise<{ total: number; byCategory: Record<string, number> }> {
    const leadExpenses = await this.getExpensesByLead(leadId);
    const byCategory: Record<string, number> = {};
    let total = 0;

    for (const exp of leadExpenses) {
      const amount = parseFloat(exp.amount);
      total += amount;
      const cat = exp.category || "Other";
      byCategory[cat] = (byCategory[cat] || 0) + amount;
    }

    return { total, byCategory };
  }

  // === JOB COSTING ANALYTICS ===
  async getJobCostingAnalytics(): Promise<{
    jobProfitability: Array<{
      leadId: number;
      projectId: number | null;
      clientName: string;
      projectName: string;
      quotedPrice: number;
      quotedMargin: number;
      hasQuotedMargin: boolean; // Indicates if margin was explicitly set
      actualRevenue: number;
      actualCosts: number;
      actualProfit: number;
      actualMargin: number;
      marginVariance: number;
      hasMarginVariance: boolean; // Indicates if variance calculation is valid
      costsByCategory: Record<string, number>;
    }>;
    overhead: {
      total: number;
      byCategory: Record<string, number>;
      byMonth: Array<{ month: string; amount: number }>;
    };
    summary: {
      totalRevenue: number;
      totalDirectCosts: number;
      totalOverhead: number;
      grossProfit: number;
      netProfit: number;
      averageJobMargin: number;
    };
  }> {
    const allExpenses = await db.select().from(expenses);
    const allLeads = await db.select().from(leads).where(eq(leads.dealStage, "Closed Won"));
    const allProjects = await db.select().from(projects);

    // Group expenses by lead
    const expensesByLead = new Map<number, typeof allExpenses>();
    const overheadExpenses: typeof allExpenses = [];

    for (const exp of allExpenses) {
      if (exp.leadId) {
        const existing = expensesByLead.get(exp.leadId) || [];
        existing.push(exp);
        expensesByLead.set(exp.leadId, existing);
      } else {
        overheadExpenses.push(exp);
      }
    }

    // Calculate job profitability
    const jobProfitability = allLeads.map(lead => {
      const project = allProjects.find(p => p.leadId === lead.id);
      const leadExpenses = expensesByLead.get(lead.id) || [];

      // Use project's quotedPrice if available, otherwise fall back to lead value
      const actualRevenue = project?.quotedPrice 
        ? parseFloat(String(project.quotedPrice)) 
        : parseFloat(lead.value || "0");
      
      const actualCosts = leadExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
      const actualProfit = actualRevenue - actualCosts;
      const actualMargin = actualRevenue > 0 ? (actualProfit / actualRevenue) * 100 : 0;

      // Get quoted margin from project (only if explicitly set)
      const quotedPrice = project?.quotedPrice ? parseFloat(String(project.quotedPrice)) : actualRevenue;
      const quotedMargin = project?.quotedMargin ? parseFloat(String(project.quotedMargin)) : null;
      
      // Only calculate variance if we have a real quoted margin
      const marginVariance = quotedMargin !== null ? actualMargin - quotedMargin : null;

      // Group costs by category
      const costsByCategory: Record<string, number> = {};
      for (const exp of leadExpenses) {
        const cat = exp.category || "Other";
        costsByCategory[cat] = (costsByCategory[cat] || 0) + parseFloat(exp.amount);
      }

      return {
        leadId: lead.id,
        projectId: project?.id || null,
        clientName: lead.clientName,
        projectName: lead.projectName || lead.projectAddress || "Unknown",
        quotedPrice,
        quotedMargin: quotedMargin ?? 0, // Default to 0 for display but flag it
        hasQuotedMargin: quotedMargin !== null, // Flag to indicate if margin was explicitly set
        actualRevenue,
        actualCosts,
        actualProfit,
        actualMargin,
        marginVariance: marginVariance ?? 0,
        hasMarginVariance: marginVariance !== null,
        costsByCategory,
      };
    }).sort((a, b) => b.actualProfit - a.actualProfit);

    // Calculate overhead (unlinked expenses)
    const overheadByCategory: Record<string, number> = {};
    const overheadByMonth: Record<string, number> = {};
    let totalOverhead = 0;

    for (const exp of overheadExpenses) {
      const amount = parseFloat(exp.amount);
      totalOverhead += amount;

      const cat = exp.category || "Other";
      overheadByCategory[cat] = (overheadByCategory[cat] || 0) + amount;

      if (exp.expenseDate) {
        const monthKey = exp.expenseDate.toISOString().slice(0, 7); // YYYY-MM
        overheadByMonth[monthKey] = (overheadByMonth[monthKey] || 0) + amount;
      }
    }

    const overheadByMonthArray = Object.entries(overheadByMonth)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Summary calculations
    const totalRevenue = jobProfitability.reduce((sum, j) => sum + j.actualRevenue, 0);
    const totalDirectCosts = jobProfitability.reduce((sum, j) => sum + j.actualCosts, 0);
    const grossProfit = totalRevenue - totalDirectCosts;
    const netProfit = grossProfit - totalOverhead;
    const averageJobMargin = jobProfitability.length > 0
      ? jobProfitability.reduce((sum, j) => sum + j.actualMargin, 0) / jobProfitability.length
      : 0;

    return {
      jobProfitability,
      overhead: {
        total: totalOverhead,
        byCategory: overheadByCategory,
        byMonth: overheadByMonthArray,
      },
      summary: {
        totalRevenue,
        totalDirectCosts,
        totalOverhead,
        grossProfit,
        netProfit,
        averageJobMargin,
      },
    };
  }

  // === CHART OF ACCOUNTS ===
  async getAccounts(): Promise<Array<{ id: string; name: string; type: string; subType?: string; balance?: number }>> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const query = "SELECT * FROM Account MAXRESULTS 200";
    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch accounts: ${error}`);
    }

    const data = await response.json();
    const accounts = data.QueryResponse?.Account || [];
    return accounts.map((acc: any) => ({
      id: acc.Id,
      name: acc.FullyQualifiedName || acc.Name,
      type: acc.AccountType,
      subType: acc.AccountSubType,
      balance: acc.CurrentBalance,
    }));
  }

  // Filter accounts by type for mapping UI
  async getBankAccounts(): Promise<Array<{ id: string; name: string; balance?: number }>> {
    const accounts = await this.getAccounts();
    return accounts
      .filter(acc => acc.type === "Bank")
      .map(({ id, name, balance }) => ({ id, name, balance }));
  }

  async getCreditCardAccounts(): Promise<Array<{ id: string; name: string; balance?: number }>> {
    const accounts = await this.getAccounts();
    return accounts
      .filter(acc => acc.type === "Credit Card")
      .map(({ id, name, balance }) => ({ id, name, balance }));
  }

  // === FINANCIAL REPORTS ===
  async getBalanceSheet(): Promise<any> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/reports/BalanceSheet`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch Balance Sheet: ${error}`);
    }

    return response.json();
  }

  async getProfitAndLoss(startDate?: Date, endDate?: Date): Promise<any> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1); // First of current month
    const end = endDate || now;

    const params = new URLSearchParams({
      start_date: start.toISOString().split("T")[0],
      end_date: end.toISOString().split("T")[0],
    });

    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/reports/ProfitAndLoss?${params}`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch P&L: ${error}`);
    }

    return response.json();
  }

  // === PROFIT FIRST SYNC ENGINE ===
  async syncFinancialMetrics(mapping: { operatingAccountId?: string; taxAccountId?: string }): Promise<{
    operating_cash: number;
    tax_reserve: number;
    revenue_mtd: number;
    synced_at: string;
  }> {
    // Ensure we have a valid token and capture it for reuse
    const tokenData = await this.getValidToken();
    if (!tokenData) {
      throw new Error("QuickBooks not connected");
    }

    let operating_cash = 0;
    let tax_reserve = 0;
    let revenue_mtd = 0;

    // Fetch account balances from Chart of Accounts using the validated token
    if (mapping.operatingAccountId || mapping.taxAccountId) {
      try {
        const accounts = await this.getAccountsWithToken(tokenData.accessToken, tokenData.realmId);
        
        if (mapping.operatingAccountId) {
          const opAccount = accounts.find(a => a.id === mapping.operatingAccountId);
          operating_cash = opAccount?.balance || 0;
        }
        
        if (mapping.taxAccountId) {
          const taxAccount = accounts.find(a => a.id === mapping.taxAccountId);
          tax_reserve = taxAccount?.balance || 0;
        }
      } catch (err) {
        log(`WARN: [QBO] Failed to fetch account balances - ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Fetch MTD revenue from P&L report using the validated token
    try {
      const pnl = await this.getProfitAndLossWithToken(tokenData.accessToken, tokenData.realmId);
      revenue_mtd = this.extractIncomeTotal(pnl);
    } catch (err) {
      log(`WARN: [QBO] Failed to fetch P&L for revenue_mtd - ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      operating_cash,
      tax_reserve,
      revenue_mtd,
      synced_at: new Date().toISOString(),
    };
  }

  // Helper to extract Total Income from P&L report robustly
  private extractIncomeTotal(report: any): number {
    if (!report?.Rows?.Row) return 0;
    
    // Strategy 1: Look for Income section's Summary (the section-level total is "Total Income")
    for (const section of report.Rows.Row) {
      if (section.group === "Income" && section.Summary?.ColData) {
        // The Summary row is specifically the "Total Income" row
        // Find the numeric column (usually index 1, but search all to be safe)
        for (let i = section.Summary.ColData.length - 1; i >= 0; i--) {
          const col = section.Summary.ColData[i];
          const val = parseFloat(col?.value);
          if (!isNaN(val)) {
            return val; // Last numeric value in Summary is typically the total
          }
        }
      }
    }
    
    // Strategy 2: Look for a row explicitly labeled "Total Income" within Income section only
    const findTotalIncomeInSection = (rows: any[], inIncomeSection: boolean): number => {
      for (const row of rows) {
        const isIncomeSection = row.group === "Income" || inIncomeSection;
        
        // Check row header for "Total Income" label
        if (isIncomeSection && row.Header?.ColData?.[0]?.value?.includes("Total Income")) {
          for (const col of row.Header.ColData) {
            const val = parseFloat(col?.value);
            if (!isNaN(val)) return val;
          }
        }
        
        // Check Summary for "Total Income" if within Income section
        if (isIncomeSection && row.Summary?.ColData) {
          const firstCol = row.Summary.ColData[0]?.value || "";
          if (firstCol.includes("Total Income") || (row.group === "Income" && !firstCol)) {
            for (let i = row.Summary.ColData.length - 1; i >= 0; i--) {
              const val = parseFloat(row.Summary.ColData[i]?.value);
              if (!isNaN(val)) return val;
            }
          }
        }
        
        // Recurse into child rows if in Income section
        if (isIncomeSection && row.Rows?.Row) {
          const found = findTotalIncomeInSection(row.Rows.Row, true);
          if (found !== 0) return found;
        }
      }
      return 0;
    };
    
    return findTotalIncomeInSection(report.Rows.Row, false);
  }

  // Internal method that uses a pre-validated token
  private async getAccountsWithToken(accessToken: string, realmId: string): Promise<Array<{ id: string; name: string; type: string; subType?: string; balance?: number }>> {
    const query = "SELECT * FROM Account MAXRESULTS 200";
    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch accounts: ${error}`);
    }

    const data = await response.json();
    const accounts = data.QueryResponse?.Account || [];
    return accounts.map((acc: any) => ({
      id: acc.Id,
      name: acc.FullyQualifiedName || acc.Name,
      type: acc.AccountType,
      subType: acc.AccountSubType,
      balance: acc.CurrentBalance,
    }));
  }

  // Internal method that uses a pre-validated token
  private async getProfitAndLossWithToken(accessToken: string, realmId: string, startDate?: Date, endDate?: Date): Promise<any> {
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate || now;

    const params = new URLSearchParams({
      start_date: start.toISOString().split("T")[0],
      end_date: end.toISOString().split("T")[0],
    });

    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${realmId}/reports/ProfitAndLoss?${params}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch P&L: ${error}`);
    }

    return response.json();
  }

  async getProfitabilityStats(): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    profitMargin: number;
    byLead: Array<{ leadId: number; clientName: string; revenue: number; expenses: number; profit: number; margin: number }>;
  }> {
    const { leads } = await import("@shared/schema");
    const allLeads = await db.select().from(leads);
    const allExpenses = await db.select().from(expenses);

    const expensesByLead = new Map<number, number>();
    let unlinkedExpenses = 0;

    for (const exp of allExpenses) {
      const amount = parseFloat(exp.amount);
      if (exp.leadId) {
        expensesByLead.set(exp.leadId, (expensesByLead.get(exp.leadId) || 0) + amount);
      } else {
        unlinkedExpenses += amount;
      }
    }

    const byLead = allLeads
      .filter(l => l.dealStage === "Closed Won")
      .map(lead => {
        const revenue = parseFloat(lead.value || "0");
        const exp = expensesByLead.get(lead.id) || 0;
        const profit = revenue - exp;
        return {
          leadId: lead.id,
          clientName: lead.clientName,
          revenue,
          expenses: exp,
          profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        };
      })
      .sort((a, b) => b.profit - a.profit);

    const totalRevenue = byLead.reduce((sum, l) => sum + l.revenue, 0);
    const totalLinkedExpenses = byLead.reduce((sum, l) => sum + l.expenses, 0);
    const totalExpenses = totalLinkedExpenses + unlinkedExpenses;
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

    return { totalRevenue, totalExpenses, profitMargin, byLead };
  }

  // === ESTIMATE SYNC ENGINE ===

  // Service item mapping: Map disciplines to QBO service item names
  private readonly SERVICE_MAPPING: Record<string, string> = {
    "Architecture": "Service:Architecture",
    "MEP": "Service:Engineering", 
    "Structural": "Service:Engineering",
    "Scanning": "Service:FieldScanning",
    "Point Cloud Processing": "Service:FieldScanning",
    "BIM Modeling": "Service:Architecture",
    "As-Built Documentation": "Service:Architecture",
    "Matterport": "Service:FieldScanning",
    "Site Photography": "Service:FieldScanning",
  };

  // Find or create a customer in QuickBooks
  async findOrCreateCustomer(clientName: string, email?: string): Promise<{ id: string; name: string }> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    // Search for existing customer by name
    const searchQuery = `SELECT * FROM Customer WHERE DisplayName = '${clientName.replace(/'/g, "\\'")}'`;
    const searchResponse = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/query?query=${encodeURIComponent(searchQuery)}`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const existing = searchData.QueryResponse?.Customer?.[0];
      if (existing) {
        return { id: existing.Id, name: existing.DisplayName };
      }
    }

    // Create new customer
    const customerPayload = {
      DisplayName: clientName,
      PrimaryEmailAddr: email ? { Address: email } : undefined,
    };

    const createResponse = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/customer`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customerPayload),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create customer: ${error}`);
    }

    const createData = await createResponse.json();
    return { 
      id: createData.Customer.Id, 
      name: createData.Customer.DisplayName 
    };
  }

  // Find service item by name (returns null if not found - we'll use description-only lines)
  private async findServiceItem(accessToken: string, realmId: string, serviceName: string): Promise<string | null> {
    const query = `SELECT * FROM Item WHERE FullyQualifiedName = '${serviceName.replace(/'/g, "\\'")}'`;
    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const item = data.QueryResponse?.Item?.[0];
      if (item) return item.Id;
    }
    return null;
  }

  // Find service item by SKU (Name field in QB = SKU in our system)
  private async findServiceItemBySku(accessToken: string, realmId: string, sku: string): Promise<{ id: string; name: string } | null> {
    // QB uses "Name" field for what we call SKU, search for it
    const query = `SELECT * FROM Item WHERE Name = '${sku.replace(/'/g, "\\'")}'`;
    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const item = data.QueryResponse?.Item?.[0];
      if (item) {
        return { id: item.Id, name: item.FullyQualifiedName || item.Name };
      }
    }
    return null;
  }

  // Create an estimate from proposal pricing data
  async createEstimateFromQuote(
    leadId: number,
    clientName: string,
    projectName: string,
    lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number; discipline?: string; sku?: string }>,
    email?: string
  ): Promise<{ estimateId: string; estimateNumber: string; customerId: string }> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    // Step 1: Find or create customer
    const customer = await this.findOrCreateCustomer(clientName, email);

    // Step 2: Build estimate lines with proper service item mapping
    const estimateLines = await Promise.all(
      lineItems.map(async (item, index) => {
        let itemRef: { value: string; name?: string } | undefined;
        
        // Priority 1: Use official SKU from our product catalog
        if (item.sku) {
          const skuItem = await this.findServiceItemBySku(token.accessToken, token.realmId, item.sku);
          if (skuItem) {
            itemRef = { value: skuItem.id, name: skuItem.name };
          }
        }
        
        // Priority 2: Try to map using the discipline field directly
        if (!itemRef && item.discipline && this.SERVICE_MAPPING[item.discipline]) {
          const serviceName = this.SERVICE_MAPPING[item.discipline];
          const itemId = await this.findServiceItem(token.accessToken, token.realmId, serviceName);
          if (itemId) {
            itemRef = { value: itemId, name: serviceName };
          }
        }
        
        // Fallback: Try to map from description
        if (!itemRef) {
          const mappedService = Object.entries(this.SERVICE_MAPPING).find(([key]) => 
            item.description.toLowerCase().includes(key.toLowerCase())
          );
          
          if (mappedService) {
            const itemId = await this.findServiceItem(token.accessToken, token.realmId, mappedService[1]);
            if (itemId) {
              itemRef = { value: itemId, name: mappedService[1] };
            }
          }
        }

        const line: any = {
          LineNum: index + 1,
          Description: item.description,
          Amount: item.amount,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            Qty: item.quantity,
            UnitPrice: item.unitPrice,
          },
        };

        if (itemRef) {
          line.SalesItemLineDetail.ItemRef = itemRef;
        }

        return line;
      })
    );

    // Step 3: Create estimate
    const estimatePayload = {
      CustomerRef: { value: customer.id },
      CustomerMemo: { value: `Proposal for ${projectName}` },
      Line: estimateLines,
      PrivateNote: `Synced from Scan2Plan OS - Lead #${leadId}`,
      DocNumber: `S2P-${leadId}-${Date.now().toString(36).toUpperCase()}`,
    };

    const createResponse = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/estimate`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(estimatePayload),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create estimate: ${error}`);
    }

    const estimateData = await createResponse.json();
    return {
      estimateId: estimateData.Estimate.Id,
      estimateNumber: estimateData.Estimate.DocNumber,
      customerId: customer.id,
    };
  }

  // Get QBO estimate URL for viewing
  getEstimateUrl(estimateId: string, realmId: string): string {
    const isSandbox = process.env.QB_SANDBOX === "true";
    const domain = isSandbox ? "sandbox.qbo.intuit.com" : "qbo.intuit.com";
    return `https://${domain}/app/estimate?txnId=${estimateId}&companyId=${realmId}`;
  }

  // Download estimate as PDF
  async downloadEstimatePdf(estimateId: string): Promise<Buffer> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/estimate/${estimateId}/pdf`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/pdf",
          "Content-Type": "application/pdf",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download estimate PDF: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Get QBO base URL configuration
  getConfig(): { baseUrl: string; isSandbox: boolean } {
    const isSandbox = process.env.QB_SANDBOX === "true";
    const domain = isSandbox ? "sandbox.qbo.intuit.com" : "qbo.intuit.com";
    return { baseUrl: `https://${domain}`, isSandbox };
  }

  // Get realm ID from stored tokens
  async getRealmId(): Promise<string | null> {
    const token = await this.getValidToken();
    return token?.realmId || null;
  }

  // === INVOICE & ESTIMATE SYNC FOR PIPELINE ===

  async fetchInvoices(startDate?: Date, endDate?: Date): Promise<any[]> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const query = `SELECT * FROM Invoice WHERE TxnDate >= '${start.toISOString().split("T")[0]}' AND TxnDate <= '${end.toISOString().split("T")[0]}' MAXRESULTS 500`;

    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch invoices: ${error}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Invoice || [];
  }

  async fetchEstimates(startDate?: Date, endDate?: Date): Promise<any[]> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const query = `SELECT * FROM Estimate WHERE TxnDate >= '${start.toISOString().split("T")[0]}' AND TxnDate <= '${end.toISOString().split("T")[0]}' MAXRESULTS 500`;

    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch estimates: ${error}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Estimate || [];
  }

  async getEstimate(estimateId: string): Promise<any | null> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/estimate/${estimateId}`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.text();
      throw new Error(`Failed to fetch estimate ${estimateId}: ${error}`);
    }

    const data = await response.json();
    return data.Estimate || null;
  }

  // Get QBO invoice URL for viewing
  getInvoiceUrl(invoiceId: string, realmId: string): string {
    const isSandbox = process.env.QB_SANDBOX === "true";
    const domain = isSandbox ? "sandbox.qbo.intuit.com" : "qbo.intuit.com";
    return `https://${domain}/app/invoice?txnId=${invoiceId}&companyId=${realmId}`;
  }

  // Fetch all customers from QuickBooks
  async getAllCustomers(): Promise<Array<{
    id: string;
    displayName: string;
    companyName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    fax?: string;
    billingAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    shippingAddress?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    balance?: number;
    active?: boolean;
  }>> {
    const token = await this.getValidToken();
    if (!token) throw new Error("QuickBooks not connected");

    const query = "SELECT * FROM Customer MAXRESULTS 1000";
    const response = await fetch(
      `${QB_BASE_URL}/v3/company/${token.realmId}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${token.accessToken}`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch customers: ${error}`);
    }

    const data = await response.json();
    const customers = data.QueryResponse?.Customer || [];

    return customers.map((c: any) => ({
      id: c.Id,
      displayName: c.DisplayName,
      companyName: c.CompanyName,
      email: c.PrimaryEmailAddr?.Address,
      phone: c.PrimaryPhone?.FreeFormNumber,
      mobile: c.Mobile?.FreeFormNumber,
      fax: c.Fax?.FreeFormNumber,
      billingAddress: c.BillAddr ? {
        line1: c.BillAddr.Line1,
        line2: c.BillAddr.Line2,
        city: c.BillAddr.City,
        state: c.BillAddr.CountrySubDivisionCode,
        postalCode: c.BillAddr.PostalCode,
        country: c.BillAddr.Country,
      } : undefined,
      shippingAddress: c.ShipAddr ? {
        line1: c.ShipAddr.Line1,
        line2: c.ShipAddr.Line2,
        city: c.ShipAddr.City,
        state: c.ShipAddr.CountrySubDivisionCode,
        postalCode: c.ShipAddr.PostalCode,
        country: c.ShipAddr.Country,
      } : undefined,
      balance: c.Balance,
      active: c.Active,
    }));
  }
}

export const quickbooksClient = new QuickBooksClient();
