import type { Project, Lead } from "../schema";

export interface WorkflowGate {
  stage: string;
  requiredFields: string[];
  conditions?: Record<string, any>;
  blockMessage: string;
  bypassRoles: string[];
}

export interface GateValidationResult {
  allowed: boolean;
  gateType?: string;
  message?: string;
  missingFields?: string[];
}

export const WORKFLOW_GATES: Record<string, WorkflowGate> = {
  scanning_gate: {
    stage: "Scanning",
    requiredFields: ["retainerPaid", "universalProjectId"],
    blockMessage: "GATE LOCKED: Retainer payment must be confirmed and Universal ID generated before field deployment.",
    bypassRoles: ["ceo", "accounting"],
  },
  modeling_gate: {
    stage: "Modeling",
    requiredFields: ["bValidationStatus", "registrationRms"],
    conditions: {
      bValidationStatus: "passed",
    },
    blockMessage: "GATE LOCKED: B-Validation and RMS Registration check required before modeling begins.",
    bypassRoles: ["production_lead"],
  },
  delivery_gate: {
    stage: "Delivered",
    requiredFields: ["squareFootAuditCleared"],
    conditions: {
      squareFootAuditCleared: true,
      unpaidInvoicesCount: 0,
    },
    blockMessage: "GATE LOCKED: Delivery blocked due to unpaid invoices or pending Square Foot Audit.",
    bypassRoles: ["ceo", "accounting"],
  },
};

export const AUDIT_PARAMETERS = {
  squareFootAudit: {
    varianceThreshold: 0.10,
    alertStatus: "SQUARE FOOT AUDIT REQUIRED",
    autoFlagOnOverage: true,
  },
  stalenessEngine: {
    leadStalenessDays: 14,
    probabilityReductionPercent: 10,
  },
};

export function validateGateTransition(
  project: Partial<Project>,
  lead: Partial<Lead> | null,
  targetStatus: string,
  userRole?: string
): GateValidationResult {
  const gate = Object.values(WORKFLOW_GATES).find(g => g.stage === targetStatus);
  
  if (!gate) {
    return { allowed: true };
  }

  if (userRole && gate.bypassRoles.includes(userRole)) {
    return { allowed: true };
  }

  const missingFields: string[] = [];
  
  for (const field of gate.requiredFields) {
    let value: any;
    
    if (field === "retainerPaid" && lead) {
      value = lead.retainerPaid;
    } else if (field === "universalProjectId") {
      value = project.universalProjectId;
    } else if (field === "bValidationStatus") {
      value = project.bValidationStatus;
    } else if (field === "registrationRms") {
      value = project.registrationRms;
    } else if (field === "squareFootAuditCleared") {
      value = project.sqftAuditComplete;
    } else {
      value = (project as any)[field];
    }
    
    if (!value) {
      missingFields.push(field);
    }
    
    if (gate.conditions && gate.conditions[field] !== undefined) {
      if (value !== gate.conditions[field]) {
        missingFields.push(`${field} (must be ${gate.conditions[field]})`);
      }
    }
  }

  if (missingFields.length > 0) {
    return {
      allowed: false,
      gateType: Object.keys(WORKFLOW_GATES).find(k => WORKFLOW_GATES[k].stage === targetStatus),
      message: gate.blockMessage,
      missingFields,
    };
  }

  return { allowed: true };
}

export function calculateSqftVariance(estimatedSqft: number | null, actualSqft: number | null): {
  variance: number | null;
  exceedsThreshold: boolean;
  status: string;
} {
  if (!estimatedSqft || !actualSqft) {
    return { variance: null, exceedsThreshold: false, status: "pending" };
  }
  
  const variance = Math.abs((actualSqft - estimatedSqft) / estimatedSqft);
  const exceedsThreshold = variance > AUDIT_PARAMETERS.squareFootAudit.varianceThreshold;
  
  return {
    variance,
    exceedsThreshold,
    status: exceedsThreshold ? AUDIT_PARAMETERS.squareFootAudit.alertStatus : "passed",
  };
}

export function getGateForStatus(status: string): WorkflowGate | null {
  return Object.values(WORKFLOW_GATES).find(g => g.stage === status) || null;
}

export function canBypassGate(gate: WorkflowGate, userRole?: string): boolean {
  if (!userRole) return false;
  return gate.bypassRoles.includes(userRole);
}
