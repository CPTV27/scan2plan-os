import { log } from "../lib/logger";
import { storage } from "../storage";

export const projectService = {
  calculateSqftVariance(actualSqft: number | null, estimatedSqft: number | null): {
    variance: string | null;
    auditComplete: boolean;
  } {
    if (!actualSqft || !estimatedSqft) {
      return { variance: null, auditComplete: false };
    }

    const variance = ((actualSqft - estimatedSqft) / estimatedSqft) * 100;
    const auditComplete = Math.abs(variance) <= 10;

    return {
      variance: variance.toFixed(2),
      auditComplete,
    };
  },

  buildSqftAuditAlert(sqftVariance: string | null, estimatedSqft: number | null, actualSqft: number | null): object | null {
    if (!sqftVariance || Math.abs(Number(sqftVariance)) <= 10) {
      return null;
    }

    return {
      message: `Square Foot Audit Required: Variance of ${sqftVariance}% exceeds 10% tolerance. Billing adjustment approval required before Modeling.`,
      estimatedSqft,
      actualSqft,
      variancePercent: Number(sqftVariance),
    };
  },

  async buildSyncScopeData(lead: any): Promise<Record<string, any>> {
    const updateData: Record<string, any> = {};

    if (lead.value != null) updateData.quotedPrice = lead.value.toString();
    if (lead.grossMarginPercent != null) updateData.quotedMargin = lead.grossMarginPercent.toString();
    if (lead.cpqAreas && Array.isArray(lead.cpqAreas) && lead.cpqAreas.length > 0) {
      updateData.quotedAreas = lead.cpqAreas;
      updateData.estimatedSqft = lead.cpqAreas.reduce((sum: number, a: any) => sum + (Number(a.squareFeet) || 0), 0);
    }
    if (lead.cpqRisks) {
      updateData.quotedRisks = Array.isArray(lead.cpqRisks) ? lead.cpqRisks : [];
    }
    if (lead.cpqTravel) updateData.quotedTravel = lead.cpqTravel;
    if (lead.cpqServices) updateData.quotedServices = lead.cpqServices;
    if (lead.siteReadiness) updateData.siteReadiness = lead.siteReadiness;
    if (lead.clientName) updateData.clientName = lead.clientName;
    if (lead.contactName) updateData.clientContact = lead.contactName;
    if (lead.contactEmail) updateData.clientEmail = lead.contactEmail;
    if (lead.contactPhone) updateData.clientPhone = lead.contactPhone;
    if (lead.projectAddress) updateData.projectAddress = lead.projectAddress;
    if (lead.dispatchLocation) updateData.dispatchLocation = lead.dispatchLocation;
    if (lead.distance) updateData.distance = Number(lead.distance);

    return updateData;
  },

  getAppBaseUrl(): string {
    // Use APP_URL for configurable base URL
    if (process.env.APP_URL) {
      return process.env.APP_URL;
    }
    // Fallback to localhost
    const port = process.env.PORT || '5000';
    return `http://localhost:${port}`;
  },

  buildMissionBriefUrl(projectId: number): string {
    return `${this.getAppBaseUrl()}/projects/${projectId}/mission-brief`;
  },

  buildDriveFolderUrl(driveFolderId: string | null | undefined): string | undefined {
    if (!driveFolderId) return undefined;
    return `https://drive.google.com/drive/folders/${driveFolderId}`;
  },
};
