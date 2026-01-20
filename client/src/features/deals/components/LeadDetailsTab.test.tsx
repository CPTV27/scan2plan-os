/**
 * LeadDetailsTab Component Tests
 * 
 * Tests for the lead details form tab component including:
 * - Component rendering with lead data
 * - Form field population
 * - Buyer persona display
 * - Attribution requirements
 * - Stage-specific behavior
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render, createTestQueryClient } from "@/test/utils";
import { LeadDetailsTab } from "./LeadDetailsTab";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { leadFormSchema, type LeadFormData } from "@/features/deals/types";
import { Tabs } from "@/components/ui/tabs";
import type { Lead, LeadDocument } from "@shared/schema";

const mockLead: Lead = {
  id: 1,
  clientName: "Acme Corporation",
  projectName: "Office Building Scan",
  projectAddress: "123 Main Street, New York, NY",
  dealStage: "Leads",
  value: "150000",
  probability: 50,
  buildingType: "Commercial",
  contactName: "John Doe",
  contactEmail: "john@acme.com",
  contactPhone: "555-1234",
  notes: "Large commercial project",
  buyerPersona: "BP2",
  sqft: 50000,
  leadScore: 75,
  projectCode: "UPID-2024-001",
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-20"),
  lastContactDate: new Date("2024-01-18"),
  hubspotId: null,
  billingContactName: "Jane Smith",
  billingContactEmail: "billing@acme.com",
  billingContactPhone: "555-5678",
  source: "referral_client",
  pandaDocId: null,
  projectStatus: null,
  siteReadiness: null,
  retainerPaid: false,
  retainerAmount: null,
  retainerPaidDate: null,
  legalJurisdiction: "Welor County",
  quoteNumber: null,
  scope: null,
  disciplines: null,
  bimDeliverable: null,
  bimVersion: null,
  dispatchLocation: null,
  distance: null,
  travelRate: null,
  timeline: null,
  paymentTerms: null,
  quoteUrl: null,
  quoteVersion: null,
  cpqAreas: null,
  cpqRisks: null,
  cpqTravel: null,
  cpqServices: null,
  cpqScopingData: null,
  leadSource: null,
  referrerCompanyName: null,
  referrerContactName: null,
  leadPriority: 3,
  complexityScore: null,
  clientTier: null,
  regulatoryRisks: null,
  aiInsightsUpdatedAt: null,
  googleIntel: null,
  integrityStatus: null,
  integrityFlags: null,
  requiresOverride: false,
  overrideApproved: false,
  overrideApprovedBy: null,
  overrideApprovedAt: null,
  driveFolderId: null,
  driveFolderUrl: null,
  storageMode: "legacy_drive",
  gcsBucket: null,
  gcsPath: null,
  qboEstimateId: null,
  qboEstimateNumber: null,
  qboEstimateStatus: null,
  qboInvoiceId: null,
  qboInvoiceNumber: null,
  qboCustomerId: null,
  qboSyncedAt: null,
  qboHasLinkedInvoice: false,
  importSource: null,
  pandaDocStatus: null,
  pandaDocSentAt: null,
  ghlContactId: null,
  ghlOpportunityId: null,
  ownerId: null,
  abmTier: "None",
  firmSize: null,
  discipline: null,
  focusSector: null,
  estimatorCardId: null,
  estimatorCardUrl: null,
  proofLinks: null,
  siteReadinessQuestionsSent: null,
  siteReadinessStatus: "pending",
  siteReadinessSentAt: null,
  siteReadinessCompletedAt: null,
  clientToken: null,
  clientTokenExpiresAt: null,
  fieldAffirmations: null,
  deletedAt: null,
  deletedBy: null,
  projectZipCode: null,
  missingInfo: null,
  closedAt: null,
  lossReason: null,
  wonReason: null,
  mauticContactId: null,
  signatureImage: null,
  signerName: null,
  signerEmail: null,
  signedAt: null
};

const mockDocuments: LeadDocument[] = [
  {
    id: 1,
    leadId: 1,
    filename: "site_photos.pdf",
    driveFileUrl: "/documents/1",
    mimeType: "application/pdf",
    size: 1024000,
    uploadedAt: new Date("2024-01-16"),
    originalName: "site_photos.pdf",
    storageKey: "/leads/1/site_photos.pdf",
    uploadedBy: null,
    movedToDriveAt: null,
    driveFileId: null,
    metadata: null,
  },
];

function TestWrapper({ children, lead = mockLead }: { children?: React.ReactNode; lead?: Lead }) {
  const queryClient = createTestQueryClient();
  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      clientName: lead.clientName,
      projectName: lead.projectName || "",
      projectAddress: lead.projectAddress || "",
      dealStage: lead.dealStage || "Leads",
      billingContactName: lead.billingContactName || "",
      billingContactEmail: lead.billingContactEmail || "",
    },
  });

  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
  const mockToast = vi.fn();
  const mockUpdateMutation = {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
    failureCount: 0,
    failureReason: null,
    context: undefined,
    status: "idle" as const,
    isIdle: true,
    isPaused: false,
    variables: undefined,
    submittedAt: 0,
  };
  const mockUploadMutation = {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
    failureCount: 0,
    failureReason: null,
    context: undefined,
    status: "idle" as const,
    isIdle: true,
    isPaused: false,
    variables: undefined,
    submittedAt: 0,
  };

  return (
    <Tabs defaultValue="lead" className="flex-1">
      <LeadDetailsTab
        lead={lead}
        leadId={lead.id}
        form={form}
        onSubmit={mockOnSubmit}
        isPending={false}
        queryClient={queryClient}
        updateMutation={mockUpdateMutation as any}
        toast={mockToast}
        documents={mockDocuments}
        uploadDocumentMutation={mockUploadMutation as any}
      />
    </Tabs>
  );
}

describe("LeadDetailsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render project information section with client name input", () => {
    render(<TestWrapper />);

    expect(screen.getByText("Project Information")).toBeInTheDocument();
    const clientNameInput = screen.getByTestId("input-client-name");
    expect(clientNameInput).toBeInTheDocument();
    expect(clientNameInput).toHaveValue("Acme Corporation");
  });

  it("should render project address input with correct value", () => {
    render(<TestWrapper />);

    const addressInput = screen.getByTestId("input-project-address");
    expect(addressInput).toBeInTheDocument();
    expect(addressInput).toHaveValue("123 Main Street, New York, NY");
  });

  it("should show billing contact section with required fields", () => {
    render(<TestWrapper />);

    expect(screen.getByText("Billing Contact")).toBeInTheDocument();
    expect(screen.getByTestId("input-billing-contact-name")).toBeInTheDocument();
    expect(screen.getByTestId("input-billing-contact-email")).toBeInTheDocument();
    expect(screen.getByTestId("input-billing-contact-phone")).toBeInTheDocument();
  });

  it("should render documents section header", () => {
    render(<TestWrapper />);

    expect(screen.getByText("Notes & Documents")).toBeInTheDocument();
  });

  it("should render deal stage selector with options", () => {
    render(<TestWrapper />);

    const dealStageSelect = screen.getByTestId("select-deal-stage");
    expect(dealStageSelect).toBeInTheDocument();
  });

  it("should render deal value input with data-testid", () => {
    render(<TestWrapper />);

    const valueInput = screen.getByTestId("input-value");
    expect(valueInput).toBeInTheDocument();
  });

  it("should display probability slider with data-testid", () => {
    render(<TestWrapper />);

    const probabilitySlider = screen.getByTestId("slider-probability");
    expect(probabilitySlider).toBeInTheDocument();
    expect(screen.getByTestId("text-probability-value")).toBeInTheDocument();
  });

  it("should render contact information inputs", () => {
    render(<TestWrapper />);

    expect(screen.getByTestId("input-contact-name")).toBeInTheDocument();
    expect(screen.getByTestId("input-contact-email")).toBeInTheDocument();
    expect(screen.getByTestId("input-contact-phone")).toBeInTheDocument();
  });

  it("should have notes textarea for project context", () => {
    render(<TestWrapper />);

    expect(screen.getByText("Notes & Documents")).toBeInTheDocument();
    expect(screen.getByTestId("input-notes")).toBeInTheDocument();
  });

  it("should render submit button for saving lead details", () => {
    render(<TestWrapper />);

    const submitButton = screen.getByTestId("button-submit-lead");
    expect(submitButton).toBeInTheDocument();
    // Button text may be "Save", "Force Sync", or similar
    expect(submitButton).toHaveTextContent(/save|sync/i);
  });
});
